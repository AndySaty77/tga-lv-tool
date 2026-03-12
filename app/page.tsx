import React from "react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingCard, MarketingSection } from "@/components/marketing/MarketingSection";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";
import { Container } from "@/components/shared/Container";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
      }}
    >
      {/* Marketing-Navigation (öffentlich) */}
      {/* NOTE: Keine Änderungen an /analyse oder /admin/* */}
      <MarketingNav active="/" />

      <>
        {/* Hero */}
        <section style={{ padding: "64px 0 28px" }}>
          <Container>
            <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 18, alignItems: "start" }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.04)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: T.brand }} />
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted }}>
                    TGA-/GAEB-/LV-Analyse für Angebots-Teams
                  </span>
                </div>

                    <h1 style={{ margin: "16px 0 0", fontSize: 46, lineHeight: 1.05, fontWeight: 950, letterSpacing: "-0.04em", color: T.text }}>
                      LV prüfen wie ein <span style={{ color: T.brand }}>Profi</span>.
                    </h1>
                    <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.75, color: T.muted, maxWidth: 780 }}>
                      Für TGA-Projekte zählt, was im LV steht – und was nicht. Dieses Tool strukturiert Risiken, erzeugt klare Rückfragen, liefert Angebotsklarstellungen und identifiziert
                      Nachtragspotenzial. Ergebnisorientiert, managementtauglich, ohne Buzzword-Show.
                    </p>

                    <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <a
                        href="/analyse"
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

                    <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap", color: T.faint, fontSize: 12, lineHeight: 1.5 }}>
                      <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>Risikoanalyse</span>
                      <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>Rückfragen</span>
                      <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>Angebotsklarstellungen</span>
                      <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>Nachtragspotenzial</span>
                      <span style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>Management Summary</span>
                    </div>
              </div>

              <div style={{ position: "relative" }}>
                <div
                  style={{
                    borderRadius: 22,
                    border: `1px solid ${T.border}`,
                    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
                    overflow: "hidden",
                  }}
                >
                      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint }}>Ergebnis-Überblick</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.20)" }} />
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.20)" }} />
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.20)" }} />
                        </div>
                      </div>
                      <div style={{ padding: 16, display: "grid", gap: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: 12, background: "rgba(255,255,255,0.03)" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Score</div>
                            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 950, letterSpacing: "-0.02em" }}>74</div>
                            <div style={{ marginTop: 6, fontSize: 12, color: T.muted }}>Ampel je Kategorie</div>
                          </div>
                          <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: 12, background: "rgba(255,255,255,0.03)" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Kritische Trigger</div>
                            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 950, letterSpacing: "-0.02em" }}>6</div>
                            <div style={{ marginTop: 6, fontSize: 12, color: T.muted }}>mit hoher Relevanz</div>
                          </div>
                        </div>

                        <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: 12, background: "rgba(255,255,255,0.03)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Management Summary</div>
                          <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: T.muted }}>
                            Drei Kernaussagen, Sofortmaßnahmen, Top-Risiken – komprimiert für Projektleitung und Kalkulation.
                          </p>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: 12, background: "rgba(255,255,255,0.03)" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Rückfragen</div>
                            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900 }}>Gruppiert</div>
                            <div style={{ marginTop: 6, fontSize: 12, color: T.muted }}>nach Themen & Bauteilen</div>
                          </div>
                          <div style={{ border: `1px solid ${T.border}`, borderRadius: 16, padding: 12, background: "rgba(255,255,255,0.03)" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>Klarstellungen</div>
                            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900 }}>Formulierbar</div>
                            <div style={{ marginTop: 6, fontSize: 12, color: T.muted }}>für Angebotstext</div>
                          </div>
                        </div>
                      </div>
                </div>
                <div style={{ marginTop: 10, color: T.faint, fontSize: 12 }}>
                  Platzhalter-UI. Später ideal mit echten Screenshots ersetzen.
                </div>
              </div>
            </div>
          </Container>
        </section>

            {/* Value Props */}
            <MarketingSection
              eyebrow="Warum"
              title="Von Upload zu Entscheidungsvorlage"
              lead="Nicht „noch ein Viewer“, sondern ein Ergebnis-Workflow: Score, Summary und konkrete Maßnahmen. Damit Teams schneller, konsistenter und nachvollziehbar entscheiden."
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <MarketingCard
                  title="Risiken sichtbar machen"
                  accent="risk"
                  text="Kritische Stellen werden strukturiert – inklusive Kategorien, Severity und Kontext."
                  bullets={["Ampel je Kategorie", "Top Findings & Trigger", "Transparenz/Debug für Nachvollziehbarkeit"]}
                />
                <MarketingCard
                  title="Rückfragen ableiten"
                  accent="ops"
                  text="Aus Unsicherheiten werden klare Fragen, die du in die Klärung geben kannst."
                  bullets={["Gruppierung nach Themen", "Konkrete Formulierungen", "Quelle/Begründung je Punkt"]}
                />
                <MarketingCard
                  title="Nachtragspotenzial erkennen"
                  text="Finde typische Nachtragsmechanismen (Leistungsabgrenzung, Mengenrisiko, Schnittstellen) und priorisiere."
                  bullets={["Opportunities & Cluster", "Claim-Potenzial (hoch/mittel/niedrig)", "Management Summary für Entscheider"]}
                />
              </div>
            </MarketingSection>

            <MarketingSection
              eyebrow="Für Teams"
              title="Kalkulation, Projektleitung, Einkauf – eine Sicht"
              lead="Das Tool übersetzt LV-Komplexität in eine konsistente Struktur: Ergebnis oben, Details in Tabs. Für Angebote, die sauber begründet und intern anschlussfähig sind."
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>Einsatz</div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900 }}>Vor Angebotsabgabe</div>
                  <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: T.muted }}>
                    Schnellcheck für Vollständigkeit/Abgrenzung, Ableitung von Rückfragen und Klarstellungen als Angebotsbestandteil.
                  </p>
                </div>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>Einsatz</div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900 }}>Interne Freigabe</div>
                  <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: T.muted }}>
                    Management Summary + Top-Risiken als Entscheidungsgrundlage – weniger Interpretationsspielraum, mehr Konsistenz.
                  </p>
                </div>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>Einsatz</div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900 }}>Nachtragsprävention</div>
                  <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: T.muted }}>
                    Unklare Leistungsgrenzen, Schnittstellen und Mengen früh markieren – bevor sie teuer werden.
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
                    <a href="/analyse" style={{ textDecoration: "none", fontSize: 13, fontWeight: 900, color: "#020617", padding: "10px 14px", borderRadius: 12, background: T.brand, border: "1px solid transparent" }}>
                      Zur Analyse
                    </a>
                    <a href="/features" style={{ textDecoration: "none", fontSize: 13, fontWeight: 800, color: T.text, padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>
                      Features im Detail
                    </a>
                  </div>
                </div>
              </Container>
            </section>

        <MarketingFooter />
      </>
    </main>
  );
}
