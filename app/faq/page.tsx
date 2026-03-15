import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "FAQ – LV Scope",
  description: "Häufige Fragen zu LV Scope: Produkt, Analyse, Nutzung, Datenschutz und Einsatz in der Praxis.",
};

function QACard({ question, answer }: { question: string; answer: string }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: T.card }}>
      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", color: T.text }}>{question}</div>
      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.75, color: T.muted }}>{answer}</div>
    </div>
  );
}

const faqProdukt = [
  {
    question: "Was ist LV Scope?",
    answer:
      "LV Scope ist ein Analyse-Tool für TGA-Leistungsverzeichnisse. Die Anwendung unterstützt dabei, Risiken, Unklarheiten und potenzielle Nachtragsthemen frühzeitig zu erkennen und strukturiert auszuwerten.",
  },
  {
    question: "Für wen ist LV Scope gedacht?",
    answer:
      "LV Scope richtet sich an TGA-Unternehmen, Kalkulatoren, Projektleiter und Entscheider, die Leistungsverzeichnisse schneller und strukturierter prüfen möchten.",
  },
  {
    question: "Welche Probleme löst LV Scope?",
    answer:
      "Das Tool hilft dabei, unklare Leistungsbeschreibungen, fehlende Nebenleistungen, Schnittstellenprobleme sowie mögliche Risiko- und Nachtragsthemen frühzeitig sichtbar zu machen.",
  },
];

const faqAnalyse = [
  {
    question: "Welche Dateien kann ich hochladen?",
    answer:
      "Je nach aktuellem Funktionsumfang können Leistungsverzeichnisse als PDF oder in textbasierten Formaten verarbeitet werden. Maßgeblich ist der jeweils in der Anwendung unterstützte Upload.",
  },
  {
    question: "Was erkennt die Analyse?",
    answer:
      "Die Analyse bewertet Inhalte strukturiert und liefert Hinweise auf Risiken, Unklarheiten, potenzielle Nachtragsthemen, Rückfragen sowie strategisch relevante Punkte für Angebot und Projektvorbereitung.",
  },
  {
    question: "Welche Ergebnisse erhalte ich?",
    answer:
      "Sie erhalten unter anderem eine Ergebnisübersicht, Management Summary, Risikohinweise, Rückfragen, Klarstellungen sowie weitere strukturierte Analysebausteine abhängig vom jeweiligen Dokument.",
  },
  {
    question: "Ersetzt die Analyse die fachliche Prüfung?",
    answer:
      "Nein. LV Scope unterstützt die Prüfung und Strukturierung eines Leistungsverzeichnisses, ersetzt jedoch nicht die fachliche, kaufmännische oder rechtliche Endbewertung durch erfahrene Verantwortliche.",
  },
];

const faqDatenschutz = [
  {
    question: "Was passiert mit meinen hochgeladenen Daten?",
    answer:
      "Ihre Daten werden ausschließlich zur Durchführung der Analyse verarbeitet. Maßgeblich sind die jeweils aktuellen Angaben in der Datenschutzerklärung sowie die tatsächlich im System umgesetzten technischen Prozesse.",
  },
  {
    question: "Werden Daten für KI-Training verwendet?",
    answer:
      "Für die Nutzung externer KI-Dienste gelten die jeweils eingesetzten technischen und vertraglichen Rahmenbedingungen. Maßgeblich sind die aktuelle Datenschutzerklärung sowie die Systemkonfiguration von LV Scope.",
  },
  {
    question: "Kann ich Analysen und mein Konto löschen?",
    answer:
      "Ja. Analysen können innerhalb der Anwendung gelöscht werden. Zusätzlich besteht die Möglichkeit, das Nutzerkonto über die Einstellungen der Anwendung dauerhaft zu löschen.",
  },
];

const faqNutzung = [
  {
    question: "Brauche ich technisches Vorwissen?",
    answer:
      "Nein. Die Anwendung ist darauf ausgelegt, Ergebnisse strukturiert und verständlich darzustellen. Fachliche Erfahrung im Umgang mit Leistungsverzeichnissen bleibt jedoch wichtig.",
  },
  {
    question: "Wie schnell ist eine Analyse?",
    answer:
      "Die Dauer hängt vom jeweiligen Dokument und der Verarbeitung ab. In der Regel erfolgt die Auswertung innerhalb kurzer Zeit ohne manuelle Vorstrukturierung.",
  },
  {
    question: "Muss ich etwas installieren?",
    answer: "Nein. LV Scope ist eine webbasierte Anwendung und kann direkt im Browser genutzt werden.",
  },
];

export default function FaqPage() {
  return (
    <MarketingPageShell active="/faq">
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
                FAQ
              </span>
            </div>
            <h1 style={{ margin: "16px 0 0", fontSize: 34, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.03em", color: T.text }}>
              Häufige Fragen zu LV Scope
            </h1>
            <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.7, color: T.muted, maxWidth: 640 }}>
              Antworten zu Analyse, Nutzung, Ergebnissen, Datenschutz und Einsatz in der Praxis.
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

      {/* 2. Bereich 1 – Produkt & Nutzen */}
      <MarketingSection
        eyebrow="Produkt"
        title="Produkt & Nutzen"
        lead="Was LV Scope ist und wem es nützt."
      >
        <Container>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {faqProdukt.map((item) => (
              <QACard key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </Container>
      </MarketingSection>

      {/* Bereich 2 – Analyse & Ergebnisse */}
      <MarketingSection
        eyebrow="Analyse"
        title="Analyse & Ergebnisse"
        lead="Dateien, Auswertung und was Sie zurückbekommen."
      >
        <Container>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {faqAnalyse.map((item) => (
              <QACard key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </Container>
      </MarketingSection>

      {/* Bereich 3 – Datenschutz & Sicherheit */}
      <MarketingSection
        eyebrow="Datenschutz"
        title="Datenschutz & Sicherheit"
        lead="Umgang mit Daten und Löschung."
      >
        <Container>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {faqDatenschutz.map((item) => (
              <QACard key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </Container>
      </MarketingSection>

      {/* Bereich 4 – Nutzung & Zugang */}
      <MarketingSection
        eyebrow="Nutzung"
        title="Nutzung & Zugang"
        lead="Voraussetzungen und Ablauf."
      >
        <Container>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {faqNutzung.map((item) => (
              <QACard key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </Container>
      </MarketingSection>

      {/* 4. Abschluss CTA */}
      <MarketingSection
        eyebrow="Testen"
        title="Noch Fragen? Testen Sie LV Scope direkt in der Anwendung."
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
