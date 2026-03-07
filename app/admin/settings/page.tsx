"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY_LLM_DEFAULT = "admin.settings.useLlmRelevanceDefault";
const STORAGE_KEY_ANALYSIS_MODE = "admin.settings.analysisModeDefault";
const STORAGE_KEY_NACHTRAG_ENABLED = "admin.settings.nachtragEnabled";

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
  padding: 20,
  border: "1px solid #e5e5e5",
  borderRadius: 14,
  background: "#fafafa",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "#111",
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginTop: 4,
};

const placeholderStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#888",
  fontStyle: "italic",
  padding: "8px 0",
};

export default function AdminSettingsPage() {
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [useLlmDefault, setUseLlmDefault] = useState(false);
  const [analysisModeDefault, setAnalysisModeDefault] = useState<"standard" | "expert">("standard");
  const [nachtragEnabled, setNachtragEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ai-status")
      .then((r) => r.json())
      .then((d) => setAiConfigured(d.openaiConfigured === true))
      .catch(() => setAiConfigured(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const llm = localStorage.getItem(STORAGE_KEY_LLM_DEFAULT);
      setUseLlmDefault(llm === "true");
      const mode = localStorage.getItem(STORAGE_KEY_ANALYSIS_MODE);
      if (mode === "standard" || mode === "expert") setAnalysisModeDefault(mode);
      const nachtrag = localStorage.getItem(STORAGE_KEY_NACHTRAG_ENABLED);
      setNachtragEnabled(nachtrag !== "false");
    } catch (_) {}
  }, []);

  const persistLlm = (v: boolean) => {
    setUseLlmDefault(v);
    try {
      localStorage.setItem(STORAGE_KEY_LLM_DEFAULT, String(v));
    } catch (_) {}
  };

  const persistAnalysisMode = (v: "standard" | "expert") => {
    setAnalysisModeDefault(v);
    try {
      localStorage.setItem(STORAGE_KEY_ANALYSIS_MODE, v);
    } catch (_) {}
  };

  const persistNachtrag = (v: boolean) => {
    setNachtragEnabled(v);
    try {
      localStorage.setItem(STORAGE_KEY_NACHTRAG_ENABLED, String(v));
    } catch (_) {}
  };

  return (
    <div
      style={{
        padding: 28,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        maxWidth: 720,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Analyse-Einstellungen</h1>
          <p style={{ color: "#666", marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
            Zentrale Steuerung für Analyse- und KI-Verhalten. Änderungen wirken als Defaults in der Analyse-Seite (wo angebunden).
          </p>
        </div>
        <a href="/admin" style={{ color: "#111", textDecoration: "underline", fontSize: 14 }}>
          Zurück zum Admin
        </a>
      </header>

      {/* 1. Künstliche Intelligenz */}
      <section style={sectionStyle} aria-labelledby="section-ki">
        <h2 id="section-ki" style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
          1. Künstliche Intelligenz
        </h2>

        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Globaler Status</span>
          {aiConfigured === null ? (
            <span style={hintStyle}>Lade…</span>
          ) : (
            <span style={{ ...hintStyle, color: aiConfigured ? "#0a7a2f" : "#b00020" }}>
              {aiConfigured ? "KI verfügbar (OPENAI_API_KEY gesetzt)" : "KI nicht konfiguriert (OPENAI_API_KEY fehlt)"}
            </span>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={useLlmDefault}
              onChange={(e) => persistLlm(e.target.checked)}
            />
            <span style={labelStyle as any}>Relevanzfilter (LLM) als Standard in der Analyse</span>
          </label>
          <div style={hintStyle}>
            Wenn aktiviert, startet die Analyse-Seite mit „LLM-Relevanzfilter“ vorausgewählt. Nutzer kann es pro Lauf ändern.
          </div>
        </div>

        <div style={placeholderStyle}>
          Nutzung in einzelnen Modulen: (Platzhalter – zukünftig pro Modul ein-/ausschaltbar.)
        </div>
      </section>

      {/* 2. Analyseverhalten */}
      <section style={sectionStyle} aria-labelledby="section-analyse">
        <h2 id="section-analyse" style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
          2. Analyseverhalten
        </h2>

        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Standardmodus beim Öffnen der Analyse</span>
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="radio"
                name="analysisMode"
                checked={analysisModeDefault === "standard"}
                onChange={() => persistAnalysisMode("standard")}
              />
              <span>Standard</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="radio"
                name="analysisMode"
                checked={analysisModeDefault === "expert"}
                onChange={() => persistAnalysisMode("expert")}
              />
              <span>Experte</span>
            </label>
          </div>
          <div style={hintStyle}>Steuert, ob die Analyse-Seite zunächst in Standard- oder Expertenansicht startet.</div>
        </div>

        <div style={placeholderStyle}>
          Sichtbarkeit technischer Bereiche: (Platzhalter – zukünftig Steuerung welche Tabs/Bereiche sichtbar sind.)
        </div>
        <div style={{ ...placeholderStyle, marginTop: 8 }}>
          Optionale Analysemodule: (Platzhalter – zukünftig Module ein-/auswählbar.)
        </div>
      </section>

      {/* 3. Nachtragsanalyse */}
      <section style={sectionStyle} aria-labelledby="section-nachtrag">
        <h2 id="section-nachtrag" style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
          3. Nachtragsanalyse
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={nachtragEnabled}
              onChange={(e) => persistNachtrag(e.target.checked)}
            />
            <span style={labelStyle as any}>Nachtragsanalyse aktiviert</span>
          </label>
          <div style={hintStyle}>
            Steuert, ob die Nachtragsanalyse in der Analyse-Seite angeboten und standardmäßig genutzt wird. (Aktuell nur Default gespeichert.)
          </div>
        </div>

        <div style={placeholderStyle}>
          Intensität / Modus: (Platzhalter – Logik noch nicht angebunden.)
        </div>
      </section>

      {/* 4. Textanalyse / Split-Verhalten */}
      <section style={sectionStyle} aria-labelledby="section-split">
        <h2 id="section-split" style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
          4. Textanalyse / Split-Verhalten
        </h2>
        <div style={placeholderStyle}>
          Interne Steueroptionen für automatische Texttrennung (Vortext / Positionen): (Platzhalter – zukünftig Konfiguration für GAEB-Split und Fallbacks.)
        </div>
      </section>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee" }}>
        <a href="/analyse" style={{ color: "#111", textDecoration: "underline", fontSize: 14 }}>
          Zur Analyse-Seite (Kundenseite)
        </a>
      </div>
    </div>
  );
}
