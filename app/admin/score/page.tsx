"use client";

import { useMemo, useState } from "react";

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

export default function ScorePage() {
  const [lvText, setLvText] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = levelMeta(result?.level);

  const analyze = async () => {
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lvText }),
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

  const onFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setLvText(text);
  };

  const catRows = useMemo(() => {
    if (!result) return [];
    const entries = Object.entries(result.perCategory ?? {});
    // feste Reihenfolge
    const order = Object.keys(CATEGORY_MAX);
    entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    return entries;
  }, [result]);

  return (
    <div style={{ padding: 28, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>TGA LV Score</h1>
          <div style={{ color: "#666", marginTop: 6 }}>
            Upload oder Text rein, Score raus. Kein Gelaber.
          </div>
        </div>
        <a href="/admin/triggers" style={{ color: "#111", textDecoration: "underline" }}>
          Trigger-Admin
        </a>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontWeight: 600 }}>Upload:</label>
          <input
            type="file"
            accept=".txt,.xml,.gaeb,.x83,.x84,.x86,.json"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <div style={{ color: "#666" }}>
            (.xml / GAEB kommt später „richtig“, aktuell wird Text einfach eingelesen)
          </div>
        </div>

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

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={analyze}
            disabled={loading || lvText.trim().length === 0}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: loading ? "#eee" : "#111",
              color: loading ? "#111" : "#fff",
              cursor: loading ? "default" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Analysiere..." : "Analysieren"}
          </button>

          <button
            onClick={() => {
              setLvText("");
              setResult(null);
              setError(null);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reset
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "#b00020", fontWeight: 700 }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Score Card */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, color: "#666", fontWeight: 700 }}>GESAMT</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {meta.dot} {meta.label}
              </div>
            </div>

            <div style={{ fontSize: 44, fontWeight: 900, marginTop: 10 }}>
              {result.total}
              <span style={{ fontSize: 16, color: "#666", marginLeft: 8 }}>/ 100</span>
            </div>

            {/* Progress */}
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
              Hinweis: Kategorien sind aktuell nur so gut wie die Checks/Trigger, die wir implementiert haben.
            </div>
          </div>

          {/* Category Bars */}
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 14, color: "#666", fontWeight: 800, marginBottom: 10 }}>
              KATEGORIEN
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {catRows.map(([cat, val]) => {
                const max = CATEGORY_MAX[cat] ?? 20;
                const pct = Math.round((val / max) * 100);
                return (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
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

          {/* Findings */}
          <div style={{ gridColumn: "1 / -1", border: "1px solid #e5e5e5", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 14, color: "#666", fontWeight: 800 }}>FINDINGS</div>
              <div style={{ color: "#666" }}>{result.findingsSorted?.length ?? 0} Treffer</div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {(result.findingsSorted ?? []).map((f) => (
                <div
                  key={f.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 900 }}>
                      {severityDot(f.severity)} {f.title}
                    </div>
                    <div style={{ color: "#666", fontWeight: 800 }}>
                      -{f.penalty} ({f.category})
                    </div>
                  </div>
                  {f.detail && <div style={{ marginTop: 6, color: "#444" }}>{f.detail}</div>}
                  <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>
                    id: {f.id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
