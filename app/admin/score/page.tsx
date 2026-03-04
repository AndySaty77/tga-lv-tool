"use client";

import { useMemo, useRef, useState } from "react";

type Finding = {
  id: string;
  category: string;
  title: string;
  detail?: string;
  severity: "low" | "medium" | "high" | string;
  penalty: number;
};

type ScoreResult = {
  total: number;
  level: "hochriskant" | "mittel" | "solide" | "sauber" | string;
  perCategory: Record<string, number>;
  findingsSorted: Finding[];
};

const CATEGORY_MAX: Record<string, number> = {
  normen: 15,
  vollstaendigkeit: 20,
  vortext: 15,
  mengen_schnittstellen: 15,
  nachtrag: 20,
  ausfuehrung: 15,
};

function levelMeta(level?: string) {
  switch (level) {
    case "hochriskant":
      return { label: "HOCHRISIKO", dot: "🔴" };
    case "mittel":
      return { label: "MITTEL", dot: "🟠" };
    case "solide":
      return { label: "SOLIDE", dot: "🟢" };
    case "sauber":
      return { label: "SAUBER", dot: "🔵" };
    default:
      return { label: level ?? "-", dot: "⚪️" };
  }
}

function severityDot(sev: string) {
  if (sev === "high") return "🔴";
  if (sev === "medium") return "🟠";
  return "🟡";
}

function isDbFinding(f: Finding) {
  return (f.id ?? "").startsWith("DB_");
}
function isSysFinding(f: Finding) {
  return (f.id ?? "").startsWith("SYS_");
}
function stripPrefix(id: string) {
  return id.replace(/^DB_/, "").replace(/^SYS_/, "");
}

function fmtKB(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

const MAX_FILE_BYTES = 2_000_000; // 2 MB MVP-Limit

export default function ScorePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [lvText, setLvText] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);

  const meta = levelMeta(result?.level);

  const analyze = async (textOverride?: string) => {
    const textToUse = (textOverride ?? lvText).trim();
    if (!textToUse) return;

    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lvText: textToUse }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`API ${res.status}: ${t}`);
      }

      const data = (await res.json()) as ScoreResult;
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (file: File) => {
    setError(null);
    setResult(null);

    if (file.size > MAX_FILE_BYTES) {
      setFileMeta({ name: file.name, size: file.size });
      setLvText("");
      setError(`Datei zu groß (${fmtKB(file.size)}). Limit aktuell: ${fmtKB(MAX_FILE_BYTES)}.`);
      return;
    }

    // MVP: textbasiert (TXT/XML) -> später echtes GAEB/XML Parsing
    const text = await file.text();

    setFileMeta({ name: file.name, size: file.size });
    setLvText(text);

    if (autoAnalyze) {
      await analyze(text);
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    await loadFile(file);
    // reset input, damit man gleiche Datei nochmal auswählen kann
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    await loadFile(file);
  };

  const catRows = useMemo(() => {
    if (!result) return [];
    const entries = Object.entries(result.perCategory ?? {});
    const order = Object.keys(CATEGORY_MAX);
    entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    return entries;
  }, [result]);

  const dbFindings = useMemo(() => (result?.findingsSorted ?? []).filter(isDbFinding), [result]);
  const sysFindings = useMemo(() => (result?.findingsSorted ?? []).filter(isSysFinding), [result]);
  const otherFindings = useMemo(
    () => (result?.findingsSorted ?? []).filter((f) => !isDbFinding(f) && !isSysFinding(f)),
    [result]
  );

  return (
    <div style={{ padding: 28, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>TGA LV Score</h1>
          <div style={{ color: "#666", marginTop: 6 }}>
            Upload oder Text rein, Score raus. DB-Trigger vs System getrennt.
          </div>
        </div>
        <a href="/admin/triggers" style={{ color: "#111", textDecoration: "underline" }}>
          Trigger-Admin
        </a>
      </div>

      {/* Upload + Input Card */}
      <div
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          background: "#fafafa",
        }}
      >
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? "#111" : "#ddd"}`,
            borderRadius: 14,
            padding: 14,
            background: dragOver ? "#f1f1f1" : "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 900 }}>Drag & Drop Datei hier rein</div>
            <div style={{ color: "#666", marginTop: 4 }}>
              MVP: TXT/XML wird als Text eingelesen. GAEB/XML Parsing kommt später.
            </div>
            {fileMeta && (
              <div style={{ marginTop: 8, color: "#111", fontWeight: 700 }}>
                Geladen: {fileMeta.name} <span style={{ color: "#666", fontWeight: 600 }}>({fmtKB(fileMeta.size)})</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.xml,.gaeb,.x83,.x84,.x86,.json"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Datei wählen
            </button>

            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
              />
              <span style={{ fontWeight: 700, color: "#111" }}>Auto-Analyse</span>
            </label>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          rows={10}
          style={{
            width: "100%",
            marginTop: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            padding: 12,
            resize: "vertical",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
          }}
          placeholder="LV Text hier einfügen..."
          value={lvText}
          onChange={(e) => setLvText(e.target.value)}
        />

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => analyze()}
            disabled={loading || lvText.trim().length === 0}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: loading ? "#eee" : "#111",
              color: loading ? "#111" : "#fff",
              cursor: loading ? "default" : "pointer",
              fontWeight: 800,
            }}
          >
            {loading ? "Analysiere..." : "Analysieren"}
          </button>

          <button
            onClick={() => {
              setLvText("");
              setResult(null);
              setError(null);
              setFileMeta(null);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Reset
          </button>

          <div style={{ color: "#666", display: "flex", alignItems: "center" }}>
            Limit: {fmtKB(MAX_FILE_BYTES)}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "#b00020", fontWeight: 800 }}>
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Score Card */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, color: "#666", fontWeight: 800 }}>GESAMT</div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                {meta.dot} {meta.label}
              </div>
            </div>

            <div style={{ fontSize: 44, fontWeight: 900, marginTop: 10 }}>
              {result.total}
              <span style={{ fontSize: 16, color: "#666", marginLeft: 8 }}>/ 100</span>
            </div>

            <div style={{ marginTop: 10, height: 12, background: "#eee", borderRadius: 999 }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, result.total))}%`,
                  height: 12,
                  background: "#111",
                  borderRadius: 999,
                }}
              />
            </div>

            <div style={{ marginTop: 12, color: "#666" }}>
              Tipp: Auto-Analyse ist gut für Upload-Workflows.
            </div>
          </div>

          {/* Category Bars */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 14, color: "#666", fontWeight: 900, marginBottom: 10 }}>
              KATEGORIEN
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {catRows.map(([cat, val]) => {
                const max = CATEGORY_MAX[cat] ?? 20;
                const pct = Math.round((val / max) * 100);
                return (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                      <span>{cat}</span>
                      <span style={{ color: "#666" }}>
                        {val} / {max} ({pct}%)
                      </span>
                    </div>
                    <div style={{ marginTop: 6, height: 10, background: "#eee", borderRadius: 999 }}>
                      <div
                        style={{
                          width: `${Math.max(0, Math.min(100, pct))}%`,
                          height: 10,
                          background: "#111",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Findings Blocks */}
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: 16 }}>
            {/* DB */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>SUPABASE TRIGGER</div>
                <div style={{ color: "#666" }}>{dbFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {dbFindings.length === 0 ? (
                  <div style={{ color: "#666" }}>Keine DB-Trigger getroffen.</div>
                ) : (
                  dbFindings.map((f) => (
                    <div key={f.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 900 }}>
                          {severityDot(f.severity)} {f.title}
                        </div>
                        <div style={{ color: "#666", fontWeight: 900 }}>
                          -{f.penalty} ({f.category})
                        </div>
                      </div>
                      {f.detail && <div style={{ marginTop: 6, color: "#444" }}>{f.detail}</div>}
                      <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>
                        id: {stripPrefix(f.id)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SYS */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>SYSTEM CHECKS</div>
                <div style={{ color: "#666" }}>{sysFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {sysFindings.length === 0 ? (
                  <div style={{ color: "#666" }}>Keine System-Checks getroffen.</div>
                ) : (
                  sysFindings.map((f) => (
                    <div key={f.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 900 }}>
                          {severityDot(f.severity)} {f.title}
                        </div>
                        <div style={{ color: "#666", fontWeight: 900 }}>
                          -{f.penalty} ({f.category})
                        </div>
                      </div>
                      {f.detail && <div style={{ marginTop: 6, color: "#444" }}>{f.detail}</div>}
                      <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>
                        id: {stripPrefix(f.id)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {otherFindings.length > 0 && (
                <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
                  Hinweis: {otherFindings.length} Findings ohne Prefix (DB_/SYS_) gefunden.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
