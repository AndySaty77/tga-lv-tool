import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "Ablauf – TGA LV Tool",
  description: "So funktioniert die LV-/GAEB-Analyse: Upload, Ergebnis-Cockpit, Rückfragen, Klarstellungen und Nachtragspotenzial.",
};

function Step({
  nr,
  title,
  text,
}: {
  nr: string;
  title: string;
  text: string;
}) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>Schritt {nr}</div>
        <div style={{ width: 10, height: 10, borderRadius: 999, background: T.brand2, boxShadow: "0 0 0 4px rgba(255,255,255,0.06)" }} />
      </div>
      <div style={{ marginTop: 10, fontSize: 16, fontWeight: 950, letterSpacing: "-0.02em", color: T.text }}>{title}</div>
      <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.75, color: T.muted }}>{text}</p>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <MarketingPageShell active="/how-it-works">
      <MarketingSection
        eyebrow="Ablauf"
        title="In Minuten von LV zu klaren nächsten Schritten"
        lead="Der Fokus liegt auf dem Ergebnis: Kennzahlen, Summary, zentrale Risiken. Danach Details in Tabs – damit Angebote schneller und konsistenter werden."
      >
        <Container>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <Step
              nr="1"
              title="LV/GAEB bereitstellen"
              text="Du startest über `/analyse`. Das Tool nimmt dein LV als Grundlage – inklusive Vorbemerkungen und Positionsinhalten (je nach Format/Extraktion)."
            />
            <Step
              nr="2"
              title="Ergebnis-Cockpit"
              text="Oben siehst du Score/Kennzahlen. Darunter Management Summary und die wichtigsten Risikoaussagen – kompakt, lesbar und handlungsorientiert."
            />
            <Step
              nr="3"
              title="Rückfragen & Klarstellungen"
              text="Aus Unschärfen werden strukturierte Rückfragen. Gleichzeitig werden Klarstellungen vorbereitet, die du ins Angebot übernehmen kannst."
            />
            <Step
              nr="4"
              title="Nachtragspotenzial"
              text="Opportunities werden geclustert und priorisiert. So erkennst du Mechanismen wie Leistungsabgrenzung, Schnittstellen oder Mengenrisiken frühzeitig."
            />
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/analyse"
              style={{
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 900,
                color: "#06121a",
                padding: "10px 14px",
                borderRadius: 12,
                background: `linear-gradient(90deg, ${T.brand}, ${T.brand2})`,
              }}
            >
              Analyse starten →
            </Link>
            <Link href="/docs" style={{ textDecoration: "none", fontSize: 13, fontWeight: 800, color: T.text, padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>
              Docs ansehen
            </Link>
          </div>
        </Container>
      </MarketingSection>

      <MarketingSection
        eyebrow="Hinweise"
        title="Was du fachlich prüfen solltest"
        lead="Das Tool liefert Struktur und Vorschläge – fachliche Freigabe bleibt beim Team. Besonders wichtig für LV-Abgrenzungen, Mengenannahmen und Schnittstellen."
      >
        <Container>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)", maxWidth: 880 }}>
            <ul style={{ margin: 0, paddingLeft: 18, color: T.muted, fontSize: 13, lineHeight: 1.8 }}>
              <li>Leistungsabgrenzung vs. Nebenleistungen (VOB/C, projektspezifische Regelungen)</li>
              <li>Mengenannahmen und Massenermittlung (Prüfung gegen Pläne/Leistungsbeschreibung)</li>
              <li>Schnittstellen zwischen Gewerken (TGA/ELT/MSR/Bau)</li>
              <li>Inbetriebnahme, Dokumentation, Prüfpflichten, Abnahmen</li>
              <li>Termin-/Behinderungsrisiken, Mitwirkungspflichten, bauseitige Leistungen</li>
            </ul>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}

