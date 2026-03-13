import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingCard, MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "Features – TGA LV Tool",
  description: "Funktionen für LV-/GAEB-Analyse: Risikoübersicht, Rückfragen, Angebotsklarstellungen, Nachtragspotenzial und Management Summary.",
};

export default function FeaturesPage() {
  return (
    <MarketingPageShell active="/features">
      <MarketingSection
        eyebrow="Features"
        title="Ergebnisse, die du direkt verwenden kannst"
        lead="Keine Demo-Romantik: Im Kern geht es um saubere Struktur, nachvollziehbare Begründungen und Outputs, die in Angebot und Klärung übergehen."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          <MarketingCard
            title="Score & Kennzahlen"
            accent="risk"
            text="Schneller Überblick über Komplexität und Gesamtrisiko. Dazu kritische Trigger und Ampel je Kategorie."
            bullets={["Komplexität / Gesamt-Risiko / Claim-Potenzial", "Kritische Trigger (hohe Befunde)", "Ampel pro Risiko-Kategorie"]}
          />
          <MarketingCard
            title="Management Summary"
            text="Kompakter Management-Block für Projektleitung und Kalkulation: Kernaussagen, Top-Risiken, Sofortmaßnahmen."
            bullets={["Executive Summary", "Top-Risiken & Sofortmaßnahmen", "managementtaugliche Textbreite & Struktur"]}
          />
          <MarketingCard
            title="Rückfragen"
            accent="ops"
            text="Aus Unklarheiten werden konkrete Fragen – gruppiert und mit Kontext."
            bullets={["Gruppierung nach Themen", "Formulierungen pro Frage", "Begründung/Quelle je Punkt"]}
          />
          <MarketingCard
            title="Angebotsklarstellungen"
            text="Vorschläge für Klarstellungen, die du als Angebotsbestandteil nutzen kannst – konsistent und nachvollziehbar."
            bullets={["Klarstellungstexte je Thema", "Ableitung aus Findings/Rückfragen", "für Angebotstexte vorbereitet"]}
          />
          <MarketingCard
            title="Nachtragspotenzial"
            accent="risk"
            text="Erkenne typische Nachtragsmechanismen (Abgrenzung, Schnittstelle, Mengenrisiko). Mit Priorisierung und Clustering."
            bullets={["Opportunities + Cluster", "Potenzial: hoch/mittel/niedrig", "Abgleich mit Risiken & Sofortmaßnahmen"]}
          />
          <MarketingCard
            title="Transparenz & Debug"
            text="Für Teams, die es genau wissen wollen: technische Details und Diagnoseinformationen, ohne die Kern-UI zu überfrachten."
            bullets={["Debug-Ansicht (optional)", "Nachvollziehbare Ableitungen", "für interne Qualitätssicherung"]}
          />
        </div>
      </MarketingSection>

      <MarketingSection
        eyebrow="Praxis"
        title="Typische Ergebnisse (Beispiele)"
        lead="Hier gehören später echte Screenshots hin. Bis dahin: die Art von Output, die du in Angebot/Projektdokumentation weiterreichen kannst."
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
              {
                title: "Kritischer Trigger",
                text: "„Leistungsschritte und Nebenleistungen sind nicht eindeutig abgegrenzt.“",
              },
              {
                title: "Rückfrage",
                text: "„Bitte bestätigen Sie, welche Vorleistungen bauseits bereitgestellt werden (Durchbrüche, Schotts, Brandschutzabschottung).“",
              },
              {
                title: "Klarstellung",
                text: "„Unser Angebot basiert auf der Ausführung gemäß LV; abweichende Anforderungen (z. B. zusätzliche Dokumentation/Inbetriebnahme) sind gesondert zu vergüten.“",
              },
            ].map((b) => (
              <div key={b.title} style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>{b.title}</div>
                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.7, color: T.muted }}>{b.text}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <Link
              href="/analyse"
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

