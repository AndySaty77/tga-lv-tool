"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";

type CategoryKey =
  | "vertrags_lv_risiken"
  | "mengen_massenermittlung"
  | "technische_vollstaendigkeit"
  | "schnittstellen_nebenleistungen"
  | "kalkulationsunsicherheit";

const CATEGORY_ORDER: CategoryKey[] = [
  "vertrags_lv_risiken",
  "mengen_massenermittlung",
  "technische_vollstaendigkeit",
  "schnittstellen_nebenleistungen",
  "kalkulationsunsicherheit",
];

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  vertrags_lv_risiken: "Vertrags-/LV-Risiken",
  mengen_massenermittlung: "Mengen & Massenermittlung",
  technische_vollstaendigkeit: "Technische Vollständigkeit",
  schnittstellen_nebenleistungen: "Schnittstellen & Nebenleistungen",
  kalkulationsunsicherheit: "Kalkulationsunsicherheit",
};

function catLabel(k: string) {
  return (CATEGORY_LABEL as any)[k] ?? k;
}

function clamp0_100(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function traffic(score: number) {
  if (score >= 70) return { dot: "🔴", text: "Rot", tone: "#b00020" };
  if (score >= 40) return { dot: "🟡", text: "Gelb", tone: "#a36b00" };
  return { dot: "🟢", text: "Grün", tone: "#0a7a2f" };
}

function ScoreBarRow(props: { k: CategoryKey; value: number }) {
  const v = clamp0_100(props.value);
  const amp = traffic(v);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr 60px 80px",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <div style={{ fontWeight: 900, color: "#111" }}>{CATEGORY_LABEL[props.k]}</div>

      <div
        style={{
          height: 14,
          borderRadius: 999,
          background: "#f0f0f0",
          border: "1px solid #e5e5e5",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${v}%`,
            height: "100%",
            background: amp.tone,
            borderRadius: 999,
            transition: "width 200ms",
          }}
        />
      </div>

      <div style={{ textAlign: "right", fontWeight: 900 }}>{v}</div>

      <div style={{ textAlign: "right", fontWeight: 900, color: amp.tone }}>
        {amp.dot} {amp.text}
      </div>
    </div>
  );
}

function ScoreBarsCard(props: { perCategory: Record<string, number>; total: number }) {
  const total = clamp0_100(props.total);
  const totalAmp = traffic(total);

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#111" }}>Risiko-Ampel je Kategorie</div>
        <div style={{ fontWeight: 900, color: totalAmp.tone }}>
          Gesamt: {total} {totalAmp.dot} {totalAmp.text}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {CATEGORY_ORDER.map((k) => (
          <ScoreBarRow key={k} k={k} value={props.perCategory?.[k] ?? 0} />
        ))}
      </div>

      <div style={{ marginTop: 10, color: "#666", fontSize: 12, fontWeight: 700 }}>
        Ampel: 0–39 Grün • 40–69 Gelb • 70–100 Rot
      </div>
    </div>
  );
}

type Finding = {
  id: string;
  category: string; // Key
  title: string;
  detail?: string;
  severity: "low" | "medium" | "high" | string;
  penalty: number;
};

type DebugBlock = {
  detectedDisciplines?: string[];
  triggersUsed?: number;
  perCategorySum?: Record<string, number>;
  sizeF?: number;
  scoringConfigVersion?: number | string;
  easing?: string;
};

type ScoreResult = {
  total: number;
  level: "hochriskant" | "mittel" | "solide" | "sauber" | string;
  perCategory: Record<string, number>; // Keys
  findingsSorted: Finding[];
  debug?: DebugBlock;
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

const MAX_FILE_BYTES = 10_000_000; // 10 MB MVP-Limit

type SourceFilter = "both" | "db" | "sys";
type SeverityFilter = "all" | "high" | "medium" | "low";
type SortMode = "penalty_desc" | "severity_desc" | "category_az";

const severityRank = (sev: string) => {
  if (sev === "high") return 3;
  if (sev === "medium") return 2;
  if (sev === "low") return 1;
  return 0;
};

export default function ScorePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [lvText, setLvText] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("both");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("penalty_desc");
  const [top10, setTop10] = useState(false);

  const meta = levelMeta(result?.level);
  const totalAmp = traffic(clamp0_100(result?.total ?? 0));

  const analyze = async (textOverride?: string) => {
    const textToUse = (textOverride ?? lvText).trim();
    if (!textToUse) return;

    setError(null);
    setLoading(true);
    setResult(null);

    try {
      // ✅ Debug-Flag aus URL lesen und an API durchreichen
      const debug =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
      const apiUrl = debug ? "/api/score?debug=1" : "/api/score";

      const res = await fetch(apiUrl, {
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

      // Filter reset/auto-adjust: wenn Kategorie nicht existiert, zurücksetzen
      const cats = new Set((data.findingsSorted ?? []).map((f) => f.category));
      if (categoryFilter !== "all" && !cats.has(categoryFilter)) {
        setCategoryFilter("all");
      }
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await loadFile(file);
  };

  const availableFindingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const f of result?.findingsSorted ?? []) set.add(f.category);
    const arr = Array.from(set);

    // sort by our category order first, then alphabetically
    arr.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a as any);
      const ib = CATEGORY_ORDER.indexOf(b as any);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });
    return arr;
  }, [result]);

  const filteredFindings = useMemo(() => {
    const all = result?.findingsSorted ?? [];
    const q = search.trim().toLowerCase();

    let list = all.filter((f) => {
      if (sourceFilter === "db" && !isDbFinding(f)) return false;
      if (sourceFilter === "sys" && !isSysFinding(f)) return false;

      if (severityFilter !== "all" && f.severity !== severityFilter) return false;

      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;

      if (q) {
        const hay = `${f.title ?? ""} ${f.detail ?? ""} ${f.id ?? ""} ${f.category ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (sortMode === "penalty_desc") return (b.penalty ?? 0) - (a.penalty ?? 0);
      if (sortMode === "severity_desc") return severityRank(b.severity) - severityRank(a.severity);
      if (sortMode === "category_az") return (a.category ?? "").localeCompare(b.category ?? "");
      return 0;
    });

    if (top10) list = list.slice(0, 10);
    return list;
  }, [result, sourceFilter, severityFilter, categoryFilter, search, sortMode, top10]);

  const dbFindings = useMemo(() => filteredFindings.filter(isDbFinding), [filteredFindings]);
  const sysFindings = useMemo(() => filteredFindings.filter(isSysFinding), [filteredFindings]);
  const otherFindings = useMemo(
    () => filteredFindings.filter((f) => !isDbFinding(f) && !isSysFinding(f)),
    [filteredFindings]
  );

  const resetFilters = () => {
    setSourceFilter("both");
    setSeverityFilter("all");
    setCategoryFilter("all");
    setSearch("");
    setSortMode("penalty_desc");
    setTop10(false);
  };

  return (
    <div style={{ padding: 28, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>TGA LV Score</h1>
          <div style={{ color: "#666", marginTop: 6 }}>Upload oder Text rein, Score raus. Filter machen’s nutzbar.</div>
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
            <div style={{ color: "#666", marginTop: 4 }}>MVP: TXT/XML wird als Text eingelesen. GAEB/XML Parsing kommt später.</div>
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
              <input type="checkbox" checked={autoAnalyze} onChange={(e) => setAutoAnalyze(e.target.checked)} />
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

          <div style={{ color: "#666", display: "flex", alignItems: "center" }}>Limit: {fmtKB(MAX_FILE_BYTES)}</div>
        </div>

        {error && <div style={{ marginTop: 12, color: "#b00020", fontWeight: 800 }}>{error}</div>}
      </div>

      {/* Results */}
      {result && (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          {/* Top Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
            {/* Score Card */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 800 }}>GESAMT</div>
                <div style={{ fontSize: 14, fontWeight: 900 }}>
                  {meta.dot} {meta.label}
                </div>
              </div>

              <div style={{ fontSize: 44, fontWeight: 900, marginTop: 10, color: totalAmp.tone }}>
                {clamp0_100(result.total)}
                <span style={{ fontSize: 16, color: "#666", marginLeft: 8 }}>/ 100</span>
              </div>

              <div style={{ marginTop: 10, height: 12, background: "#eee", borderRadius: 999 }}>
                <div
                  style={{
                    width: `${clamp0_100(result.total)}%`,
                    height: 12,
                    background: totalAmp.tone,
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ marginTop: 10, color: "#666", fontWeight: 700, fontSize: 12 }}>
                Ampel: 0–39 Grün • 40–69 Gelb • 70–100 Rot
              </div>
            </div>

            {/* Category Bars */}
            <ScoreBarsCard perCategory={result.perCategory ?? {}} total={result.total} />
          </div>

          {/* ✅ Debug Card */}
          {result.debug && (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>DEBUG</div>
                <div style={{ color: "#666", fontWeight: 700 }}>
                  Config: {String(result.debug.scoringConfigVersion ?? "-")} • Easing: {String(result.debug.easing ?? "-")}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 800 }}>
                  detectedDisciplines:{" "}
                  <span style={{ fontWeight: 700, color: "#111" }}>
                    {(result.debug.detectedDisciplines ?? []).join(", ") || "(leer)"}
                  </span>
                </div>
                <div style={{ fontWeight: 800 }}>
                  triggersUsed: <span style={{ fontWeight: 700, color: "#111" }}>{result.debug.triggersUsed ?? "-"}</span>
                </div>
                <div style={{ fontWeight: 800 }}>
                  sizeF: <span style={{ fontWeight: 700, color: "#111" }}>{result.debug.sizeF ?? "-"}</span>
                </div>

                <div style={{ fontWeight: 900, marginTop: 6 }}>perCategorySum (roh)</div>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #eee",
                    background: "#fafafa",
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  {JSON.stringify(result.debug.perCategorySum ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>FILTER</div>
              <div style={{ color: "#666", fontWeight: 700 }}>Treffer nach Filter: {filteredFindings.length}</div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr auto", gap: 10 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche (Titel, Detail, ID, Kategorie)..."
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              />

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              >
                <option value="both">Quelle: DB + SYS</option>
                <option value="db">Quelle: nur DB</option>
                <option value="sys">Quelle: nur SYS</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              >
                <option value="all">Severity: alle</option>
                <option value="high">Severity: high</option>
                <option value="medium">Severity: medium</option>
                <option value="low">Severity: low</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              >
                <option value="all">Kategorie: alle</option>
                {availableFindingCategories.map((c) => (
                  <option key={c} value={c}>
                    {catLabel(c)}
                  </option>
                ))}
              </select>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", width: "100%" }}
              >
                <option value="penalty_desc">Sort: Penalty ↓</option>
                <option value="severity_desc">Sort: Severity ↓</option>
                <option value="category_az">Sort: Kategorie A–Z</option>
              </select>

              <button
                onClick={resetFilters}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Reset
              </button>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={top10} onChange={(e) => setTop10(e.target.checked)} />
                <span style={{ fontWeight: 800 }}>Nur Top 10</span>
              </label>

              <div style={{ color: "#666", fontWeight: 700 }}>
                DB: {dbFindings.length} | SYS: {sysFindings.length}
                {otherFindings.length > 0 ? ` | Other: ${otherFindings.length}` : ""}
              </div>
            </div>
          </div>

          {/* Findings Blocks */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* DB */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>SUPABASE TRIGGER</div>
                <div style={{ color: "#666" }}>{dbFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {dbFindings.length === 0 ? (
                  <div style={{ color: "#666" }}>Keine DB-Trigger nach Filter.</div>
                ) : (
                  dbFindings.map((f) => (
                    <div key={f.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 900 }}>
                          {severityDot(f.severity)} {f.title}
                        </div>
                        <div style={{ color: "#666", fontWeight: 900 }}>-{f.penalty} ({catLabel(f.category)})</div>
                      </div>
                      {f.detail && <div style={{ marginTop: 6, color: "#444" }}>{f.detail}</div>}
                      <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>id: {stripPrefix(f.id)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SYS */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>SYSTEM CHECKS</div>
                <div style={{ color: "#666" }}>{sysFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {sysFindings.length === 0 ? (
                  <div style={{ color: "#666" }}>Keine System-Checks nach Filter.</div>
                ) : (
                  sysFindings.map((f) => (
                    <div key={f.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 900 }}>
                          {severityDot(f.severity)} {f.title}
                        </div>
                        <div style={{ color: "#666", fontWeight: 900 }}>-{f.penalty} ({catLabel(f.category)})</div>
                      </div>
                      {f.detail && <div style={{ marginTop: 6, color: "#444" }}>{f.detail}</div>}
                      <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>id: {stripPrefix(f.id)}</div>
                    </div>
                  ))
                )}
              </div>

              {otherFindings.length > 0 && (
                <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
                  Hinweis: {otherFindings.length} Findings ohne Prefix (DB_/SYS_) im Ergebnis.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
