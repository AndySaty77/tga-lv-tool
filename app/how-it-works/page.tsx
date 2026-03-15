import React from "react";
import Link from "next/link";
import Image from "next/image";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingCard, MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "So funktioniert’s – LV Scope",
  description: "So funktioniert die LV-Analyse: Upload, KI-Auswertung, Ergebnisübersicht und Handlungsempfehlungen. Schnell, strukturiert, angebotsorientiert.",
};

const cardStyle = {
  borderRadius: 18,
  border: `1px solid ${T.border}`,
  background: T.card,
  padding: 18,
  boxShadow: "0 14px 30px rgba(15,23,42,0.65)",
};

const stepImages = [
  "/how-it-works/how-it-works-step1-upload.png",
  "/how-it-works/how-it-works-step2-ki-analyse.png",
  "/how-it-works/how-it-works-step3-ergebnis.png",
  "/how-it-works/how-it-works-step4-handlung.png",
] as const;

const steps = [
  {
    step: 1,
    title: "LV hochladen",
    description: "Upload eines Leistungsverzeichnisses – unkompliziert und ohne Vorbereitung.",
    bullets: ["PDF oder Text", "automatische Texterkennung", "keine Vorbereitung nötig"],
  },
  {
    step: 2,
    title: "KI Analyse",
    description: "Analyse der LV-Struktur durch KI: Risiken, Klauseln und Leistungsdefinitionen werden erkannt.",
    bullets: ["Risikoanalyse", "Vertragsklauseln erkennen", "Leistungsdefinition prüfen"],
  },
  {
    step: 3,
    title: "Ergebnisübersicht",
    description: "Strukturierte Darstellung der Analyse – auf einen Blick für Projektleitung und Kalkulation.",
    bullets: ["Management Summary", "Risikobewertung", "Nachtragspotenzial"],
  },
  {
    step: 4,
    title: "Handlungsempfehlungen",
    description: "Nutzung der Analyse für Angebote: konkrete nächste Schritte und Texte für Rückfragen und Klarstellungen.",
    bullets: ["Rückfragen generieren", "Angebotsstrategie", "kritische Positionen erkennen"],
  },
];

const resultCards = [
  { title: "Risikoübersicht", text: "Score, Ampel pro Kategorie und kritische Trigger – so behalten Sie Risiken im Blick." },
  { title: "Nachtragspotenzial", text: "Opportunities geclustert und priorisiert: Abgrenzung, Schnittstellen, Mengenrisiken." },
  { title: "Rückfragenliste", text: "Strukturierte Rückfragen mit Kontext und Begründung, gruppiert nach Themen." },
  { title: "Angebotsstrategie", text: "Klarstellungstexte und Vorschläge, die Sie direkt ins Angebot übernehmen können." },
];

const benefitCards = [
  { title: "Schnellere LV-Prüfung", text: "Statt stundenlanger manueller Prüfung: strukturierte Auswertung in wenigen Minuten." },
  { title: "Risiken früh erkennen", text: "Kritische Punkte und Ampel-Bewertung vor Angebotsabgabe – weniger Überraschungen im Projekt." },
  { title: "Bessere Angebotsstrategie", text: "Klare Rückfragen und Klarstellungstexte sorgen für konsistentere und besser abgesicherte Angebote." },
];

export default function HowItWorksPage() {
  return (
    <MarketingPageShell active="/how-it-works">
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
                Ablauf
              </span>
            </div>
            <h1 style={{ margin: "16px 0 0", fontSize: 34, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.03em", color: T.text }}>
              So funktioniert LV Scope
            </h1>
            <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.7, color: T.muted, maxWidth: 640 }}>
              Von der LV-Datei bis zu Handlungsempfehlungen: LV Scope analysiert Ihr Leistungsverzeichnis, strukturiert Risiken und liefert Rückfragen sowie Klarstellungen – klar und angebotsorientiert.
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

      {/* 2. Analyseprozess – 4 Schritte mit Screenshot-Platzhalter */}
      <MarketingSection
        eyebrow="Analyseprozess"
        title="In vier Schritten zum Ergebnis"
        lead="Vom Upload bis zu den Handlungsempfehlungen – jeder Schritt ist klar definiert."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {steps.map(({ step, title, description, bullets }) => (
            <div key={step} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "rgba(224,124,94,0.2)",
                    border: `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 900,
                    color: T.brand,
                  }}
                >
                  {step}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.text, flex: 1 }}>{title}</div>
              </div>
              <div style={{ position: "relative", width: "100%", height: 90, borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
                <Image
                  src={stepImages[step - 1]}
                  alt={`${title} – Ansicht`}
                  fill
                  sizes="(max-width: 320px) 280px, 300px"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: T.muted }}>{description}</p>
              <ul style={{ margin: 0, paddingLeft: 18, color: T.muted, fontSize: 12, lineHeight: 1.7 }}>
                {bullets.map((b) => (
                  <li key={b} style={{ marginBottom: 4 }}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </MarketingSection>

      {/* 3. Analyse-Ergebnisse – 4 Karten */}
      <MarketingSection
        eyebrow="Ergebnisse"
        title="Analyse-Ergebnisse"
        lead="Was Sie nach der Auswertung erhalten: übersichtlich und sofort nutzbar."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {resultCards.map((item) => (
            <div key={item.title} style={{ ...cardStyle }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 8 }}>{item.title}</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: T.muted }}>{item.text}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      {/* 4. Vorteile – 3 Karten */}
      <MarketingSection
        eyebrow="Vorteile"
        title="Warum LV Scope nutzen"
        lead="Schnellere Prüfung, frühe Risikoerkennung und bessere Angebote."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {benefitCards.map((item) => (
            <MarketingCard
              key={item.title}
              title={item.title}
              text={item.text}
              accent="brand"
            />
          ))}
        </div>
      </MarketingSection>

      {/* 5. Abschluss CTA */}
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
    </MarketingPageShell>
  );
}
