import React from "react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingCard, MarketingSection } from "@/components/marketing/MarketingSection";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";
import { Container } from "@/components/shared/Container";
import { AnalysisPreviewShowcase } from "@/components/marketing/AnalysisPreviewShowcase";

export default function Home() {
  return (
    <main
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100%",
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
      }}
    >
      <MarketingNav active="/" />

      <>
        {/* Hero */}
        <section style={{ padding: "48px 0 28px" }}>
          <Container>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 18,
                alignItems: "start",
              }}
            >
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.04)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: T.brand }} />
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted }}>
                    TGA-/GAEB-/LV-Analyse für Angebots-Teams
                  </span>
                </div>

                    <h1 style={{ margin: "16px 0 0", fontSize: 34, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.03em", color: T.text }}>
                      LVs prüfen, Risiken erkennen, <span style={{ color: T.brand }}>Angebote besser absichern</span>.
                    </h1>
                    <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.75, color: T.muted, maxWidth: 780 }}>
                      In TGA-Projekten entscheidet, was im LV steht – und was fehlt. LV Scope strukturiert Risiken, erzeugt klare Rückfragen und Angebotsklarstellungen und identifiziert Nachtragspotenzial. Ergebnisorientiert und managementtauglich.
                    </p>

                    <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <a
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
                          padding: "12px 16px",
                          borderRadius: 14,
                          background: T.brand,
                          border: "1px solid transparent",
                        }}
                      >
                        Analyse starten
                        <span style={{ fontWeight: 900, opacity: 0.9 }}>→</span>
                      </a>
                      <a
                        href="/how-it-works"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textDecoration: "none",
                          fontSize: 14,
                          fontWeight: 800,
                          color: T.text,
                          padding: "12px 16px",
                          borderRadius: 14,
                          border: `1px solid ${T.border}`,
                          background: "rgba(255,255,255,0.04)",
                        }}
                      >
                        So funktioniert’s
                      </a>
                      <a
                        href="/pricing"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textDecoration: "none",
                          fontSize: 14,
                          fontWeight: 700,
                          color: T.muted,
                          padding: "12px 16px",
                          borderRadius: 14,
                        }}
                      >
                        Preise ansehen
                      </a>
                    </div>

              </div>

              <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
                <AnalysisPreviewShowcase />
              </div>
            </div>
          </Container>
        </section>

            {/* Value Props */}
            <MarketingSection
              eyebrow="Warum"
              title="Von Upload zu Entscheidungsvorlage"
              lead="Score, Summary und konkrete Maßnahmen statt LV-Chaos. Kalkulation und Projektleitung erhalten eine gemeinsame Basis – klarere Entscheidungen, weniger Interpretationsspielraum, schneller zur Freigabe."
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <MarketingCard
                  title="Risiken sichtbar machen"
                  accent="risk"
                  text="Kritische Stellen strukturiert nach Kategorie und Relevanz – so können Angebots-Teams und Projektleitung dieselbe Grundlage nutzen und zügiger entscheiden."
                  bullets={["Ampel je Kategorie", "Top Findings & Trigger", "Nachvollziehbare Grundlage für Freigaben"]}
                />
                <MarketingCard
                  title="Rückfragen ableiten"
                  accent="ops"
                  text="Aus Unsicherheiten werden klare, formulierte Fragen für die Klärung – weniger Hin und Her, schnelleres Arbeiten in Kalkulation und Einkauf."
                  bullets={["Gruppierung nach Themen", "Konkrete Formulierungen fürs Angebot", "Quelle/Begründung je Punkt"]}
                />
                <MarketingCard
                  title="Nachtragspotenzial erkennen"
                  text="Typische Nachtragsmechanismen (Leistungsabgrenzung, Mengenrisiko, Schnittstellen) priorisiert – für bessere Freigabefähigkeit und weniger böse Überraschungen."
                  bullets={["Opportunities & Cluster", "Claim-Potenzial (hoch/mittel/niedrig)", "Management Summary für Entscheider"]}
                />
              </div>
            </MarketingSection>

            <MarketingSection
              eyebrow="Für Teams"
              title="Kalkulation, Projektleitung, Freigabe – konkreter Nutzen je Rolle"
              lead="LV Scope liefert für jede Rolle die passende Sicht: strukturierte Vorarbeit für die Kalkulation, frühe Risiko- und Schnittstellensicht für die Projektleitung, komprimierte Entscheidungsgrundlage für Einkauf und Geschäftsführung."
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>Kalkulation</div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900 }}>Risiken und Rückfragen vor Abgabe bündeln</div>
                  <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: T.muted }}>
                    Typisch: Risiken, Unklarheiten und offene Rückfragen verstreut, Angebotsklarstellungen im Nachlauf. LV Scope strukturiert beides vor Abgabe – nach Kategorien, mit konkreten Formulierungen. Ergebnis: weniger Nacharbeit, sauberere Angebotsunterlagen.
                  </p>
                </div>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>Projektleitung</div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900 }}>Kritische Punkte und Nachtragspotenzial früh erkennen</div>
                  <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: T.muted }}>
                    Kritische Stellen, Schnittstellen und typisches Nachtragspotenzial fallen oft erst spät auf. LV Scope hebt sie priorisiert hervor – mit Score, Top-Risiken und Potenzial-Clustern. Ergebnis: bessere Steuerung vor Projektstart, weniger böse Überraschungen.
                  </p>
                </div>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>Einkauf / Freigabe / Geschäftsführung</div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900 }}>Komprimierte Sicht für bessere Entscheidungen</div>
                  <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: T.muted }}>
                    Zu viel Detail im LV, zu wenig vergleichbare Grundlage für Freigaben. LV Scope liefert Management Summary, Kernaussagen und Top-Risiken auf einen Blick. Ergebnis: bessere Entscheidungsgrundlage, weniger Interpretationsspielraum, schnellere Freigabefähigkeit.
                  </p>
                </div>
              </div>
            </MarketingSection>

            {/* CTA */}
            <section style={{ padding: "10px 0 64px" }}>
              <Container>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 22, padding: 20, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: "-0.02em" }}>Direkt testen: LV hochladen und Ergebnis sehen</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>Analyse-UI und Admin bleiben technisch getrennt; diese Seite ist nur die öffentliche Produktdarstellung.</div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="/app/analyse" style={{ textDecoration: "none", fontSize: 13, fontWeight: 900, color: "#020617", padding: "10px 14px", borderRadius: 12, background: T.brand, border: "1px solid transparent" }}>
                      Zur Analyse
                    </a>
                    <a href="/features" style={{ textDecoration: "none", fontSize: 13, fontWeight: 800, color: T.text, padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>
                      Features im Detail
                    </a>
                  </div>
                </div>
              </Container>
            </section>

            {/* Blueprint / Workflow-Illustration – zentriert vor Footer */}
            <section style={{ padding: "32px 0 56px" }}>
              <Container>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <img
                    src="/images/blueprint-dashboard.png"
                    alt="LV Scope: Von technischem Dokument zur Analyse und zum Dashboard"
                    style={{
                      width: "100%",
                      maxWidth: 900,
                      height: "auto",
                      display: "block",
                      borderRadius: 12,
                    }}
                  />
                </div>
              </Container>
            </section>

        <MarketingFooter />
      </>
    </main>
  );
}
