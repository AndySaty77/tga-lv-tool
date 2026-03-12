import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "Docs – TGA LV Tool",
  description: "Dokumentation (öffentlich): Einstieg, Begriffe, empfohlener Workflow und Hinweise zur fachlichen Prüfung.",
};

function DocCard({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        border: `1px solid ${T.border}`,
        borderRadius: 18,
        padding: 18,
        background: "rgba(255,255,255,0.03)",
        color: T.text,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 950, letterSpacing: "-0.02em" }}>{title}</div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.75, color: T.muted }}>{text}</div>
      <div style={{ marginTop: 12, fontSize: 12, fontWeight: 900, color: T.faint, letterSpacing: "0.08em", textTransform: "uppercase" }}>Öffnen →</div>
    </Link>
  );
}

export default function DocsPage() {
  return (
    <MarketingPageShell active="/docs">
      <MarketingSection
        eyebrow="Docs"
        title="Öffentliche Dokumentation (Kurzform)"
        lead="Diese Seite beschreibt den empfohlenen Workflow und Begriffe. Tiefe technische Details können später ausgebaut werden."
      >
        <Container>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <DocCard title="Schnellstart" text="Analyse starten, Ergebnis lesen, Rückfragen und Klarstellungen übernehmen." href="/how-it-works" />
            <DocCard title="Feature-Übersicht" text="Welche Blöcke es gibt (Score, Summary, Risiken, Rückfragen, Klarstellungen, Nachtragspotenzial)." href="/features" />
            <DocCard title="Preise & Pakete" text="Platzhalter: Wie B2B-Pakete sinnvoll geschnitten werden können." href="/pricing" />
          </div>

          <div style={{ marginTop: 22, border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)", maxWidth: 980 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: T.faint }}>Begriffe</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10, color: T.muted, fontSize: 13, lineHeight: 1.75 }}>
              <div>
                <strong style={{ color: T.text }}>Rückfragen:</strong> Fragen zur Klärung vor Angebotsabgabe (Scope, Vorleistungen, Mengen, Schnittstellen).
              </div>
              <div>
                <strong style={{ color: T.text }}>Angebotsklarstellungen:</strong> Formulierungen, die das Angebot gegenüber Unklarheiten abgrenzen (Annahmen, Mitwirkung, Nachweise).
              </div>
              <div>
                <strong style={{ color: T.text }}>Nachtragspotenzial:</strong> Hinweise auf typische Mechanismen (Abgrenzung, Schnittstelle, Mengenrisiko, Bauablauf), die zu Mehrleistungen führen können.
              </div>
              <div>
                <strong style={{ color: T.text }}>Management Summary:</strong> Verdichtete Ergebnisdarstellung für Entscheider (Kernaussagen, Top-Risiken, Sofortmaßnahmen).
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, color: T.faint, fontSize: 12, lineHeight: 1.6, maxWidth: 980 }}>
            Hinweis: Diese Docs sind bewusst öffentlich und konservativ. Admin-Konfigurationen bleiben unter `/admin/*`; die produktive Analyse läuft unter `/analyse`.
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}

