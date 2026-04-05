"use client";

const cardStyle: React.CSSProperties = {
  padding: 18,
  border: "1px solid #e5e5e5",
  borderRadius: 14,
  background: "#fafafa",
  textDecoration: "none",
  color: "#111",
  display: "block",
  transition: "background 0.15s ease, border-color 0.15s ease",
};

const linkGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 14,
  marginTop: 24,
};

export default function AdminPage() {
  return (
    <div
      style={{
        padding: 28,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        maxWidth: 900,
      }}
    >
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Admin-Bereich</h1>
        <p style={{ color: "#666", marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          Intern: Konfiguration, Trigger, Bewertung, Textpflege, Diagnose. Kein Kundenprodukt – für Weiterentwicklung und Betrieb.
        </p>
      </header>

      <nav aria-label="Admin-Bereiche">
        <div style={linkGridStyle}>
          <a href="/admin/triggers" style={cardStyle}>
            <strong style={{ fontSize: 15 }}>Trigger</strong>
            <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>Live-Regeln in der DB: pflegen, CSV, Test gegen LV-Text</div>
          </a>
          <a href="/admin/score" style={cardStyle}>
            <strong style={{ fontSize: 15 }}>Analyse (intern)</strong>
            <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
              Helle Expertenansicht derselben Analyse wie unter /app/analyse – ohne Kunden-Layout, mit Debug/Transparenz
            </div>
          </a>
          <a href="/admin/settings" style={cardStyle}>
            <strong style={{ fontSize: 15 }}>Analyse-Einstellungen</strong>
            <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>Defaults (z. B. LLM, Modus) – teils nur im Browser, siehe Seite</div>
          </a>
          <a href="/admin/scoring" style={cardStyle}>
            <strong style={{ fontSize: 15 }}>Scoring-Konfiguration</strong>
            <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>DB-Werte für Bewertung – nicht jedes Feld steuert die Laufzeit (Hinweise auf der Seite)</div>
          </a>
          <a href="/admin/texts" style={cardStyle}>
            <strong style={{ fontSize: 15 }}>Texte</strong>
            <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>Textbausteine in der DB – Anbindung an die Live-UI ist unvollständig (siehe Seite)</div>
          </a>
          <a href="/admin/debug" style={cardStyle}>
            <strong style={{ fontSize: 15 }}>Debug</strong>
            <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>Interne Score-Rohdaten / JSON – nicht für Endkunden</div>
          </a>
        </div>
      </nav>

      <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid #eee" }}>
        <a href="/app/analyse" style={{ color: "#111", textDecoration: "underline", fontSize: 14 }}>
          Zur Kundenanalyse (/app/analyse)
        </a>
      </div>
    </div>
  );
}
