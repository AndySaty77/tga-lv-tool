"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "admin.debug.lastScoreResponse";

const sectionStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 16,
  border: "1px solid #e5e5e5",
  borderRadius: 14,
  background: "#fafafa",
};

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #eee",
  background: "#fff",
  fontSize: 12,
  whiteSpace: "pre-wrap",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  overflow: "auto",
  maxHeight: 400,
};

type DebugData = {
  debug?: {
    splitUsed?: boolean;
    lens?: { lvText?: number; vortext?: number; positions?: number };
    disciplineScores?: Record<string, number>;
    detectedDisciplines?: string[];
    primaryDiscipline?: string | null;
    secondaryDisciplines?: string[];
    triggersUsed?: number;
    llmMode?: boolean;
    findingsBeforeLlm?: number;
    findingsAfterLlm?: number;
    perCategorySum?: Record<string, number>;
    sizeF?: number;
    scoringConfigVersion?: number | string;
    easing?: string;
  };
  total?: number;
  perCategory?: Record<string, number>;
  findingsSorted?: unknown[];
  [key: string]: unknown;
};

function DebugBlock({ data }: { data: DebugData }) {
  const d = data?.debug;
  if (!d) {
    return (
      <div style={sectionStyle}>
        <div style={{ fontSize: 14, color: "#666", fontWeight: 700 }}>Kein debug-Block in den Daten.</div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>API mit <code>?debug=1</code> aufrufen oder Analyse unter /admin/score ausführen und „Debug-Ansicht öffnen“ klicken.</div>
      </div>
    );
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: "#111" }}>Rohdaten / Technische Details</div>

      <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
        <div><strong>splitUsed:</strong> {String(d.splitUsed ?? "-")}</div>
        {d.lens && (
          <div>
            <strong>lens:</strong>
            <pre style={{ ...preStyle, marginTop: 6, maxHeight: 80 }}>{JSON.stringify(d.lens, null, 2)}</pre>
          </div>
        )}
        <div><strong>scoringConfigVersion:</strong> {String(d.scoringConfigVersion ?? "-")}</div>
        <div><strong>easing:</strong> {String(d.easing ?? "-")}</div>
        <div><strong>sizeF:</strong> {String(d.sizeF ?? "-")}</div>
        <div><strong>triggersUsed:</strong> {String(d.triggersUsed ?? "-")}</div>
        <div><strong>detectedDisciplines:</strong> {(d.detectedDisciplines ?? []).join(", ") || "—"}</div>
        <div><strong>primaryDiscipline:</strong> {String(d.primaryDiscipline ?? "-")}</div>
        <div><strong>secondaryDisciplines:</strong> {(d.secondaryDisciplines ?? []).join(", ") || "—"}</div>
        {d.llmMode && (
          <>
            <div><strong>findingsBeforeLlm:</strong> {String(d.findingsBeforeLlm ?? "-")}</div>
            <div><strong>findingsAfterLlm:</strong> {String(d.findingsAfterLlm ?? "-")}</div>
          </>
        )}
        {d.disciplineScores && Object.keys(d.disciplineScores).length > 0 && (
          <div>
            <strong>disciplineScores:</strong>
            <pre style={{ ...preStyle, marginTop: 6, maxHeight: 120 }}>{JSON.stringify(d.disciplineScores, null, 2)}</pre>
          </div>
        )}
        {d.perCategorySum && Object.keys(d.perCategorySum).length > 0 && (
          <div>
            <strong>perCategorySum (roh):</strong>
            <pre style={{ ...preStyle, marginTop: 6 }}>{JSON.stringify(d.perCategorySum, null, 2)}</pre>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, color: "#666", fontWeight: 900, marginBottom: 6 }}>Gesamt / perCategory (normiert)</div>
        <div style={{ fontSize: 13 }}>total: {String(data.total ?? "-")}</div>
        {data.perCategory && Object.keys(data.perCategory).length > 0 && (
          <pre style={{ ...preStyle, marginTop: 6, maxHeight: 150 }}>{JSON.stringify(data.perCategory, null, 2)}</pre>
        )}
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Vollständige JSON-Antwort</summary>
        <pre style={{ ...preStyle, marginTop: 8, maxHeight: 360 }}>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

export default function AdminDebugPage() {
  const [data, setData] = useState<DebugData | null>(null);
  const [pasteRaw, setPasteRaw] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DebugData;
        setData(parsed);
      }
    } catch (_) {
      setData(null);
    }
  }, []);

  const loadFromPaste = () => {
    setPasteError(null);
    if (!pasteRaw.trim()) {
      setData(null);
      return;
    }
    try {
      const parsed = JSON.parse(pasteRaw) as DebugData;
      setData(parsed);
      try {
        sessionStorage.setItem(STORAGE_KEY, pasteRaw);
      } catch (_) {}
    } catch (e: unknown) {
      setPasteError(e instanceof Error ? e.message : "Ungültiges JSON");
      setData(null);
    }
  };

  const clearStored = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    setData(null);
    setPasteRaw("");
    setPasteError(null);
  };

  return (
    <div
      style={{
        padding: 28,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        maxWidth: 900,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Debug</h1>
          <p style={{ color: "#666", marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
            Interne Rohdaten und Diagnose. Nicht für Kunden – nur für Entwicklung und Fehlersuche. Keine Fachlogik geändert.
          </p>
        </div>
        <a href="/admin" style={{ color: "#111", textDecoration: "underline", fontSize: 14 }}>
          Zurück zum Admin
        </a>
      </header>

      <div style={sectionStyle}>
        <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>Datenquelle</h2>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 12px", lineHeight: 1.5 }}>
          Entweder: Analyse unter <a href="/admin/score" style={{ color: "#111", textDecoration: "underline" }}>/admin/score</a> ausführen, Tab „Transparenz“ öffnen und „Debug-Ansicht öffnen“ klicken (dann werden die Daten hier angezeigt). Oder: JSON-Antwort der API (z. B. <code>POST /api/score?debug=1</code>) unten einfügen und „Anzeigen“ klicken.
        </p>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 6 }}>JSON einfügen (volle Score-Antwort)</label>
          <textarea
            value={pasteRaw}
            onChange={(e) => setPasteRaw(e.target.value)}
            placeholder='{"total": 42, "perCategory": {...}, "debug": {...}, ...}'
            rows={4}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              resize: "vertical",
            }}
          />
          <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={loadFromPaste}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Anzeigen
            </button>
            <button
              type="button"
              onClick={clearStored}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Gespeicherte Daten löschen
            </button>
            {pasteError && <span style={{ color: "#b00020", fontWeight: 700, fontSize: 13 }}>{pasteError}</span>}
          </div>
        </div>
      </div>

      {data ? <DebugBlock data={data} /> : !pasteRaw.trim() ? (
        <div style={{ ...sectionStyle, color: "#666", fontSize: 14 }}>
          Noch keine Daten. Analyse unter /admin/score ausführen und „Debug-Ansicht öffnen“ wählen, oder JSON oben einfügen.
        </div>
      ) : null}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee" }}>
        <a href="/admin/score" style={{ color: "#111", textDecoration: "underline", fontSize: 14 }}>
          Zur Analyse (Admin)
        </a>
        {" · "}
        <a href="/analyse" style={{ color: "#111", textDecoration: "underline", fontSize: 14 }}>
          Kundenbereich (/analyse)
        </a>
      </div>
    </div>
  );
}
