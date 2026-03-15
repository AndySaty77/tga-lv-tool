import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingCard, MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "Features – LV Scope",
  description: "KI-Analyse für TGA-Leistungsverzeichnisse: Risikoanalyse, Management Summary, Rückfragen, Angebotsstrategie. Moderne SaaS für Kalkulation und Projektleitung.",
};

const cardStyle = {
  borderRadius: 18,
  border: `1px solid ${T.border}`,
  background: T.card,
  padding: 18,
  boxShadow: "0 14px 30px rgba(15,23,42,0.65)",
};

export default function FeaturesPage() {
  return (
    <MarketingPageShell active="/features">
      {/* 1. Hero Section */}
      <section style={{ padding: "48px 0 40px" }}>
        <Container>
          <div style={{ maxWidth: 720 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 999,
                border: `1px solid ${T.border}`,
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: T.brand }} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted }}>
                TGA-Leistungsverzeichnisse
              </span>
            </div>
            <h1 style={{ margin: "16px 0 0", fontSize: 34, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.03em", color: T.text }}>
              KI-Analyse für TGA-Leistungsverzeichnisse
            </h1>
            <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.7, color: T.muted, maxWidth: 640 }}>
              LV Scope analysiert Ihre LVs und GAEB-Dateien, strukturiert Risiken, erzeugt Rückfragen und Klarstellungen und liefert eine managementtaugliche Zusammenfassung – in wenigen Minuten statt manueller Stunden.
            </p>
            <div style={{ marginTop: 24 }}>
              <Link
                href="/app/analyse"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#020617",
                  padding: "12px 18px",
                  borderRadius: 14,
                  background: T.brand,
                  border: "1px solid transparent",
                }}
              >
                Jetzt LV analysieren
                <span style={{ fontWeight: 900, opacity: 0.9 }}>→</span>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* 2. Hauptfeatures – 4 Feature Cards */}
      <MarketingSection
        eyebrow="Hauptfeatures"
        title="Was LV Scope kann"
        lead="Strukturierte Auswertungen und sofort nutzbare Texte für Angebot und Klärung – ohne Demo-Romantik."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          <MarketingCard
            title="Risikoanalyse"
            accent="risk"
            text="Schneller Überblick über Komplexität, Gesamtrisiko und Claim-Potenzial. Kritische Trigger und Ampel je Kategorie – so behalten Sie die Risiken im Blick."
            bullets={["Komplexität, Gesamt-Risiko, Claim-Potenzial", "Kritische Trigger (hohe Befunde)", "Ampel pro Risiko-Kategorie"]}
          />
          <MarketingCard
            title="Management Summary"
            text="Kompakter Block für Projektleitung und Kalkulation: Kernaussagen, Top-Risiken und Sofortmaßnahmen in managementtauglicher Struktur."
            bullets={["Executive Summary", "Top-Risiken & Sofortmaßnahmen", "Klare Textbreite & Struktur"]}
          />
          <MarketingCard
            title="Rückfragen Generator"
            accent="ops"
            text="Aus Unklarheiten werden konkrete Rückfragen – gruppiert nach Themen, mit Formulierung und Begründung je Punkt."
            bullets={["Gruppierung nach Themen", "Formulierungen pro Frage", "Begründung/Quelle je Punkt"]}
          />
          <MarketingCard
            title="Angebotsstrategie"
            text="Vorschläge für Klarstellungen und Nachtragspotenzial, die Sie als Angebotsbestandteil nutzen können – konsistent und nachvollziehbar."
            bullets={["Klarstellungstexte je Thema", "Nachtragspotenzial priorisiert", "Für Angebotstexte vorbereitet"]}
          />
        </div>
      </MarketingSection>

      {/* 3. Analyse Workflow – 4 Schritte */}
      <MarketingSection
        eyebrow="Ablauf"
        title="Analyse Workflow"
        lead="Vom Upload bis zu den Handlungsempfehlungen in vier klaren Schritten."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          {[
            { step: 1, title: "LV hochladen", text: "GAEB- oder LV-Datei auswählen und hochladen." },
            { step: 2, title: "KI Analyse", text: "Strukturierte Auswertung von Risiken, Rückfragen und Nachtragspotenzial." },
            { step: 3, title: "Risikoübersicht", text: "Score, Ampel und Management Summary auf einen Blick." },
            { step: 4, title: "Handlungsempfehlungen", text: "Konkrete Rückfragen, Klarstellungen und nächste Schritte." },
          ].map(({ step, title, text }) => (
            <div
              key={step}
              style={{
                ...cardStyle,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(224,124,94,0.2)",
                  border: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 900,
                  color: T.brand,
                }}
              >
                {step}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{title}</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: T.muted, flex: 1 }}>{text}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      {/* 4. Screenshot Bereich – 3 Platzhalter-Karten */}
      <MarketingSection
        eyebrow="Ergebnisansicht"
        title="Beispielansichten der Analyse"
        lead="So präsentieren sich Score, Nachtragspotenzial und Rückfragen in der Anwendung."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {/* Karte 1: Analyse Übersicht */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Analyse Übersicht</div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: T.brand }}>72</span>
                <span style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>Score</span>
              </div>
              {[
                { label: "Vertrags- & LV-Risiken", status: "mittel", color: "rgba(251,191,36,0.85)" },
                { label: "Mengen & Massenermittlung", status: "niedrig", color: "rgba(74,222,128,0.8)" },
                { label: "Schnittstellen", status: "hoch", color: "rgba(248,113,113,0.85)" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 11,
                    color: T.muted,
                    padding: "4px 0",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: row.color, flexShrink: 0 }} />
                </div>
              ))}
              <p style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.5, color: T.faint }}>
                Klärungsbedarf bei Abgrenzung Nebenleistungen; ansonsten gut strukturiert.
              </p>
            </div>
          </div>

          {/* Karte 2: Nachtragspotenzial */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Nachtragspotenzial</div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
              }}
            >
              {[
                { text: "Abgrenzung LÜ zu Nebenleistungen", prio: "hoch", color: T.brand },
                { text: "Schnittstelle Brandschutzabschottung", prio: "mittel", color: T.muted },
                { text: "Mengenrisiko Massenermittlung", prio: "niedrig", color: T.faint },
              ].map((item) => (
                <div
                  key={item.text}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 12,
                    color: T.muted,
                    lineHeight: 1.5,
                    padding: "6px 0",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: item.color,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {item.prio}
                  </span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Karte 3: Rückfragen / Klarstellungen */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Rückfragen / Klarstellungen</div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: T.faint, marginBottom: 6 }}>Rückfrage</div>
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: T.muted }}>
                Bitte bestätigen Sie, welche Vorleistungen bauseits (Durchbrüche, Schotts) bereitgestellt werden.
              </p>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: T.faint, marginTop: 10, marginBottom: 6 }}>Klarstellung</div>
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: T.muted }}>
                Unser Angebot basiert auf Ausführung gemäß LV; abweichende Anforderungen sind gesondert zu vergüten.
              </p>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* 5. Vorteile nach Zielgruppe – 3 Karten */}
      <MarketingSection
        eyebrow="Zielgruppen"
        title="Vorteile nach Zielgruppe"
        lead="Ob Kalkulation, Projektleitung oder Geschäftsführung – jeder erhält die passenden Informationen."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              title: "Für Kalkulatoren",
              text: "Klare Risikobewertung und Nachtragspotenzial pro Kategorie. Rückfragen und Klarstellungen direkt für das Angebot nutzbar.",
              bullets: ["Strukturierte Risiko- und Komplexitätsbewertung", "Rückfragen und Klarstellungstexte", "Nachtragspotenzial priorisiert"],
            },
            {
              title: "Für Projektleiter",
              text: "Management Summary und Top-Risiken auf einen Blick. Sofortmaßnahmen und Handlungsempfehlungen für die Freigabe.",
              bullets: ["Executive Summary", "Top-Risiken & Sofortmaßnahmen", "Entscheidungsvorlage für Freigabe"],
            },
            {
              title: "Für Geschäftsführung",
              text: "Überblick über Projektrisiken und Claim-Potenzial ohne Detailtiefe. Managementtaugliche Darstellung.",
              bullets: ["Gesamtrisiko und Score", "Kernaussagen kompakt", "Transparenz ohne technisches Detail"],
            },
          ].map((item) => (
            <MarketingCard
              key={item.title}
              title={item.title}
              text={item.text}
              bullets={item.bullets}
              accent="brand"
            />
          ))}
        </div>
      </MarketingSection>

      {/* 6. Abschluss CTA */}
      <MarketingSection
        eyebrow="Start"
        title="Analysieren Sie Ihr nächstes LV in wenigen Minuten."
        lead="Registrieren Sie sich oder melden Sie sich an – die erste Analyse ist nur wenige Klicks entfernt."
      >
        <div style={{ marginTop: 8 }}>
          <Link
            href="/app/analyse"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 900,
              color: "#020617",
              padding: "14px 20px",
              borderRadius: 14,
              background: T.brand,
              border: "1px solid transparent",
            }}
          >
            Jetzt Analyse starten
            <span style={{ fontWeight: 900, opacity: 0.9 }}>→</span>
          </Link>
        </div>
      </MarketingSection>

      {/* Bestehende Praxis-Section beibehalten (keine Komponenten entfernen) */}
      <MarketingSection
        eyebrow="Praxis"
        title="Typische Ergebnisse (Beispiele)"
        lead="Die Art von Output, die Sie in Angebot und Projektdokumentation weiterreichen können."
      >
        <Container>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {[
              { title: "Kritischer Trigger", text: "„Leistungsschritte und Nebenleistungen sind nicht eindeutig abgegrenzt.“" },
              { title: "Rückfrage", text: "„Bitte bestätigen Sie, welche Vorleistungen bauseits bereitgestellt werden (Durchbrüche, Schotts, Brandschutzabschottung).“" },
              { title: "Klarstellung", text: "„Unser Angebot basiert auf der Ausführung gemäß LV; abweichende Anforderungen (z. B. zusätzliche Dokumentation/Inbetriebnahme) sind gesondert zu vergüten.“" },
            ].map((b) => (
              <div key={b.title} style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>{b.title}</div>
                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.7, color: T.muted }}>{b.text}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <Link
              href="/app/analyse"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 900,
                color: "#020617",
                padding: "10px 14px",
                borderRadius: 12,
                background: T.brand,
                border: "1px solid transparent",
              }}
            >
              Zur Analyse
              <span style={{ fontWeight: 900 }}>→</span>
            </Link>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}
