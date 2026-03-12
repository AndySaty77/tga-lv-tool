import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "FAQ – TGA LV Tool",
  description: "Häufige Fragen zur LV-/GAEB-Analyse: Ergebnisse, Verantwortung, Daten, Admin-Parameter und nächste Schritte.",
};

function QA({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)" }}>
      <div style={{ fontSize: 15, fontWeight: 950, letterSpacing: "-0.02em", color: T.text }}>{q}</div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.8, color: T.muted }}>{a}</div>
    </div>
  );
}

export default function FaqPage() {
  return (
    <MarketingPageShell active="/faq">
      <MarketingSection
        eyebrow="FAQ"
        title="Fragen, die in B2B-Projekten wirklich zählen"
        lead="Kurz und konkret – ohne Versprechen, die ein LV-Kontext nicht hergibt."
      >
        <Container>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            <QA
              q="Ersetzt das Tool die fachliche Prüfung?"
              a="Nein. Es strukturiert den LV-Inhalt, hebt typische Risiken hervor und erzeugt Vorschläge (Rückfragen/Klarstellungen). Die Freigabe bleibt beim Team."
            />
            <QA
              q="Was ist der Unterschied zwischen /analyse und /admin/scoring?"
              a={
                <>
                  <strong>/analyse</strong> ist die produktive Nutzer-URL für die Analyse. <strong>/admin/scoring</strong> dient der Pflege der Parameter/Schwellenwerte.
                </>
              }
            />
            <QA
              q="Welche Outputs bekomme ich konkret?"
              a="Score/Kennzahlen, Management Summary, Risiko-Kategorien, Rückfragen, Angebotsklarstellungen und Nachtragspotenzial (Opportunities/Cluster)."
            />
            <QA
              q="Gibt es eine API oder Export?"
              a={
                <>
                  Das Projekt hat bereits API-Routen für Analyse-Teilbereiche. Öffentliche Exporte (PDF/Word/CSV) sind ein sinnvoller nächster Schritt und sollten fachlich
                  abgestimmt werden.
                </>
              }
            />
            <QA
              q="Wo starte ich?"
              a={
                <>
                  Am schnellsten über <Link href="/analyse" style={{ color: T.text, textDecoration: "underline" }}>/analyse</Link>. Für Produktdetails:{" "}
                  <Link href="/features" style={{ color: T.text, textDecoration: "underline" }}>/features</Link>.
                </>
              }
            />
            <QA
              q="Warum gibt es noch /admin/score?"
              a="Historisch. Technisch steckt dort die Shared Analyse-UI, die aktuell auch von /analyse gerendert wird. Diese Abhängigkeit wird in diesem Schritt bewusst nicht verändert."
            />
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}

