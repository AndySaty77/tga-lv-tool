import React from "react";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "So funktioniert LV Scope",
  description:
    "Einstieg und Orientierung: Ablauf der Analyse, Bedeutung der Ergebnisbereiche und Hinweis auf Hilfen im geschützten Bereich.",
};

const cardBase: React.CSSProperties = {
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 16,
  background: "rgba(255,255,255,0.03)",
};

const h3: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 17,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: T.text,
};

const body: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.65,
  color: T.muted,
};

const STEPS: { title: string; text: string }[] = [
  {
    title: "LV oder GAEB bereitstellen",
    text: "Sie laden Ihr Leistungsverzeichnis hoch oder fügen den Text ein – die Grundlage für die Auswertung.",
  },
  {
    title: "Analyse starten",
    text: "LV Scope wertet Inhalt, Struktur und typische Risikomuster aus. Sie sehen den Fortschritt in der Oberfläche.",
  },
  {
    title: "Ergebnisse sichten",
    text: "Score, Risiken, Vorbemerkungen, Positionen und Nachtragspotenzial erscheinen übersichtlich getrennt – je nach Dokument.",
  },
  {
    title: "Rückfragen und Klarstellungen nutzen",
    text: "Vorschläge für Rückfragen beim Auftraggeber und Formulierungshilfen für Ihr Angebot können Sie übernehmen und anpassen.",
  },
  {
    title: "Für Angebot und Abstimmung vorbereiten",
    text: "Die Ergebnisse dienen der Einordnung vor der Abgabe – für Kalkulation, technische Prüfung und Freigabe im Team.",
  },
];

const RESULT_AREAS: { name: string; text: string }[] = [
  {
    name: "Übersicht",
    text: "Kompakte Einordnung des Dokuments: Komplexität, Schwerpunkte und eine erste Orientierung für Entscheider.",
  },
  {
    name: "Risiken",
    text: "Erkannte Unklarheiten und typische Risikofelder – nachvollziehbar, damit Sie gezielt nachsteuern können.",
  },
  {
    name: "Vorbemerkungen",
    text: "Auswertung des Einleitungsteils: Vertragsrahmen, Bedingungen und Hinweise, die das Leistungsbild einordnen.",
  },
  {
    name: "Positionen",
    text: "Strukturierte Sicht auf die LV-Positionen, damit Sie Inhalte und Lücken schneller finden.",
  },
  {
    name: "Nachtragspotenzial",
    text: "Hinweise auf Stellen, an denen später Mehrleistungen oder Nachverhandlungen typischerweise entstehen können.",
  },
  {
    name: "Rückfragen",
    text: "Konkrete Klärungsfragen an den Auftraggeber, bevor Sie bindend anbieten.",
  },
  {
    name: "Angebotsklarstellungen",
    text: "Textbausteine und Abgrenzungen, mit denen Sie Ihr Angebot gegenüber Unklarheiten im LV absichern können.",
  },
];

const AUDIENCES: { title: string; text: string }[] = [
  {
    title: "Kalkulation",
    text: "Schnellere Einordnung von Unschärfen, Mengenrisiken und Schnittstellen – als Grundlage für Preis und Risiko.",
  },
  {
    title: "Projektleitung",
    text: "Überblick über offene Punkte und typische Nachtragsfelder für die spätere Ausführung.",
  },
  {
    title: "Geschäftsführung",
    text: "Verdichtete Einschätzung und Prioritäten, ohne jedes Detail lesen zu müssen.",
  },
  {
    title: "Angebotsprüfung / Freigabe",
    text: "Prüfung vor Abgabe: Risiken, Rückfragen und Klarstellungen in einem durchgängigen Bild.",
  },
];

export default function SoFunktioniertsPage() {
  return (
    <MarketingPageShell active="/docs">
      <MarketingSection
        eyebrow="Orientierung"
        title="So funktioniert LV Scope"
        lead="Hier erfahren Sie, wie die Analyse aufgebaut ist, welche Bereiche die Ergebnisse haben und wie Sie LV Scope im Alltag einordnen können – ohne technische Vertiefung und ohne Zwang zur Registrierung."
      >
        <Container>
          <div style={{ maxWidth: 800 }}>
            {/* B. Was Sie hier finden */}
            <div style={{ ...cardBase, marginBottom: 20 }}>
              <h3 style={h3}>Was Sie auf dieser Seite finden</h3>
              <p style={body}>
                Eine verständliche Orientierung zum Produkt: Ablauf von der Datenübergabe bis zur Nutzung der Ergebnisse, kurze
                Erklärungen der wichtigsten Anzeigen in der Auswertung, Hinweise für verschiedene Rollen im Angebotsprozess – und
                wohin Sie sich wenden, wenn Sie vertiefende Hilfe in der Anwendung suchen.
              </p>
            </div>

            {/* C. 5 Schritte */}
            <h3 style={{ ...h3, marginBottom: 14, marginTop: 8 }}>LV Scope in fünf Schritten</h3>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr",
                    gap: 14,
                    alignItems: "start",
                    ...cardBase,
                    padding: 18,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "rgba(224, 124, 94, 0.15)",
                      color: T.brand,
                      fontWeight: 900,
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 6, letterSpacing: "-0.01em" }}>
                      {s.title}
                    </div>
                    <p style={body}>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* D. Ergebnisbereiche */}
            <h3 style={{ ...h3, marginTop: 28, marginBottom: 14 }}>Die wichtigsten Ergebnisbereiche</h3>
            <p style={{ ...body, marginBottom: 14 }}>
              Die Auswertung ist in klar getrennte Bereiche gegliedert. Je nach Dokument sind nicht alle Kapitel gleich stark
              gefüllt – die Logik bleibt dieselbe.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {RESULT_AREAS.map((r) => (
                <div key={r.name} style={cardBase}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 8 }}>{r.name}</div>
                  <p style={body}>{r.text}</p>
                </div>
              ))}
            </div>

            {/* E. Für wen */}
            <h3 style={{ ...h3, marginTop: 28, marginBottom: 14 }}>Für wen LV Scope gedacht ist</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {AUDIENCES.map((a) => (
                <div key={a.title} style={cardBase}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 8 }}>{a.title}</div>
                  <p style={body}>{a.text}</p>
                </div>
              ))}
            </div>

            {/* F. Öffentlich vs. geschützt */}
            <div
              style={{
                marginTop: 28,
                padding: 22,
                borderRadius: 16,
                border: `1px solid ${T.border}`,
                background: "rgba(15,23,42,0.55)",
                boxShadow: "0 12px 32px rgba(15,23,42,0.35)",
              }}
            >
              <h3 style={{ ...h3, marginBottom: 12 }}>Öffentliche Einführung und geschützter Bereich</h3>
              <p style={{ ...body, marginBottom: 12 }}>
                Diese Seite ist für alle zugänglich und dient der Orientierung. Sie ersetzt keine individuelle Rechts- oder
                Fachberatung.
              </p>
              <p style={{ ...body, marginBottom: 12 }}>
                <strong style={{ color: T.text }}>Ausführlichere Hilfen zur Bedienung</strong>, Kontext-Hinweise in der
                Anwendung und Ihre gespeicherten Analysen finden Sie nach dem Login im geschützten Kundenbereich. Dort stehen
                Ihnen die Funktionen für Ihre Arbeit zur Verfügung – ohne technische Entwickler-Dokumentation und ohne
                interne Admin- oder Konfigurationsoberflächen.
              </p>
            </div>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}
