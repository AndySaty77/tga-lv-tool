import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { appTheme as T } from "@/components/app/appTheme";
import { getUser } from "@/lib/auth/get-user";

export const metadata = {
  title: "Hilfe & Dokumentation – LV Scope",
  description: "Anwendungshilfe: Analysebereiche einordnen, Ablauf und Grenzen verstehen.",
};

function Block({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        background: T.card,
        padding: T.space.lg,
        marginBottom: T.space.lg,
      }}
    >
      <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      <div style={{ fontSize: 13, lineHeight: 1.65, color: T.muted }}>{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 12px" }}>{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: "0 0 12px", paddingLeft: 18, color: T.muted }}>
      {items.map((t) => (
        <li key={t} style={{ marginBottom: 6 }}>
          {t}
        </li>
      ))}
    </ul>
  );
}

const RESULTS: {
  name: string;
  was: string;
  wofuer: string;
  praxis: string;
  beachten: string;
}[] = [
  {
    name: "Übersicht",
    was: "Eine verdichtete Darstellung der wichtigsten Einschätzungen zu Ihrem Leistungsverzeichnis.",
    wofuer: "Schneller Überblick für alle Beteiligten – vor der Detailarbeit in den anderen Tabs.",
    praxis: "Zuerst lesen, um Prioritäten zu setzen, dann gezielt in Risiken, Positionen und Nachtragspotenzial gehen.",
    beachten: "Die Übersicht fasst zusammen; sie ersetzt nicht die Prüfung in den Fach-Tabs.",
  },
  {
    name: "Risiken",
    was: "Erkannte Unklarheiten, typische Stolperstellen und Risikohinweise im LV.",
    wofuer: "Um vor der Abgabe zu klären, was später zu Mehrkosten, Streit oder Nachträgen führen könnte.",
    praxis: "Jeden Punkt gegen Ihr Bau- und Vertragswissen prüfen; bei unklaren Stellen Rückfragen oder Klarstellungen vorbereiten.",
    beachten: "Risiken sind Hinweise auf mögliche Probleme – keine vollständige Liste aller denkbaren Fälle.",
  },
  {
    name: "Vorbemerkungen",
    was: "Auswertung des Einleitungsteils (Vertragsrahmen, Bedingungen, Hinweise zur Leistung).",
    wofuer: "Einordnung, bevor Sie in die Positionen gehen; oft entscheidend für Zuschnitt und Abgrenzung.",
    praxis: "Mit Vertrag und LV-Logik abgleichen; Widersprüche notieren und in Rückfragen oder Klarstellungen adressieren.",
    beachten: "Je nach Upload kann der Umfang variieren; fehlende Vorbemerkungen im Dokument schränken die Aussage ein.",
  },
  {
    name: "Positionen",
    was: "Strukturierte Sicht auf die LV-Positionen und Inhalte.",
    wofuer: "Schnelles Auffinden von Mengen, Schnittstellen und Lücken in der Leistungsbeschreibung.",
    praxis: "Mit Ihrer Kalkulation und Gewerkegrenzen abgleichen; offene Punkte für Rückfragen markieren.",
    beachten: "Technische Vollständigkeit hängt von der Qualität der eingespielten Daten ab.",
  },
  {
    name: "Nachtragspotenzial",
    was: "Hinweise auf Bereiche, in denen später typischerweise Zusatzleistungen, Nachverhandlungen oder Konflikte entstehen können.",
    wofuer: "Frühwarnung und Arbeitsliste – nicht als „garantierter Nachtrag“, sondern als Vorbereitung.",
    praxis: "Für interne Abstimmung, Rückfragen an den Auftraggeber und Formulierung von Klarstellungen im Angebot nutzen.",
    beachten: "Siehe auch den Abschnitt „Nachtragspotenzial richtig einordnen“.",
  },
  {
    name: "Rückfragen",
    was: "Konkrete Klärungsfragen an den Auftraggeber, bevor Sie bindend anbieten.",
    wofuer: "Scope, Schnittstellen, Mengen und unklare Leistungsgrenzen vor der Abgabe zu klären.",
    praxis: "Formulierungen übernehmen, an Ihre Sprache anpassen und nur stellen, die für die Kalkulation wirklich nötig sind.",
    beachten: "Zu viele Rückfragen können den Prozess verzögern – Priorität setzen.",
  },
  {
    name: "Angebotsklarstellungen",
    was: "Textvorschläge und Abgrenzungen, mit denen Sie Ihr Angebot gegenüber Unklarheiten im LV absichern.",
    wofuer: "Annahmen, Mitwirkung, Nachweise und Grenzen der Leistung transparent machen.",
    praxis: "In Angebots- und Vertragsdokumente einarbeiten; rechtlich und fachlich durch Ihre Organisation prüfen lassen.",
    beachten: "Keine automatische Rechtsberatung; Freigabe nach internen Regeln.",
  },
];

export default async function AppHelpPage() {
  const user = await getUser().catch(() => null);
  if (!user) redirect("/login?redirectTo=/app/help");

  return (
    <>
      <div style={{ marginBottom: T.space.xl, maxWidth: 720 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Hilfe & Dokumentation
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.55 }}>
          Praxisnahe Orientierung zur Nutzung von LV Scope in der Analyse – für Kalkulation, technische Prüfung und Angebotsvorbereitung.
        </p>
      </div>

      <div style={{ maxWidth: 800 }}>
        <Block title="A. Einstieg" id="einstieg">
          <P>
            Diese Hilfeseite erklärt, wie Sie LV Scope im Alltag sinnvoll einsetzen: von der ersten Analyse bis zur Einordnung der
            Ergebnisbereiche. Sie richtet sich an alle, die Angebote vorbereiten, prüfen oder freigeben.
          </P>
          <P>
            LV Scope unterstützt Sie bei der <strong style={{ color: T.text }}>Prüfung</strong>, der{" "}
            <strong style={{ color: T.text }}>Kalkulation</strong> und der{" "}
            <strong style={{ color: T.text }}>Klarstellung von Angeboten</strong> – strukturiert und nachvollziehbar. Die
            Auswertung ersetzt aber keine fachliche Freigabe in Ihrem Unternehmen und keine Rechts- oder Gewerkebeurteilung durch
            Expert:innen vor Ort.
          </P>
        </Block>

        <Block title="B. Arbeiten mit einer Analyse" id="ablauf">
          <P>Ein sinnvoller Ablauf in der Regel:</P>
          <Ul
            items={[
              "LV oder GAEB hochladen bzw. einspielen und die Analyse starten.",
              "Übersicht lesen – Schwerpunkte und erste Einschätzung verstehen.",
              "Risiken und Vorbemerkungen prüfen – Vertrags-/LV-Rahmen und typische Stolperstellen.",
              "Positionen gegenprüfen – Mengen, Schnittstellen und Abgrenzungen zur eigenen Kalkulation.",
              "Rückfragen und Angebotsklarstellungen ableiten – was vor Abgabe geklärt werden muss und wie Sie Ihr Angebot absichern.",
              "Nachtragspotenzial als Frühwarn- und Arbeitsbereich nutzen – intern abstimmen und in Rückfragen/Klarstellungen einbeziehen.",
            ]}
          />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: T.muted }}>
            Die Reihenfolge können Sie an Ihr Vorgehen anpassen – wichtig ist, Übersicht, Risiken und Leistungsinhalt nicht zu
            vermischen, bevor Sie bindend anbieten.
          </p>
        </Block>

        <Block title="C. Ergebnisbereiche verstehen" id="ergebnisse">
          <P>Folgende Bereiche finden Sie in der Auswertung – jeweils mit anderem Fokus:</P>
          {RESULTS.map((r, i) => (
            <div
              key={r.name}
              style={{
                marginBottom: i < RESULTS.length - 1 ? T.space.md : 0,
                paddingBottom: i < RESULTS.length - 1 ? T.space.md : 0,
                borderBottom: i < RESULTS.length - 1 ? `1px solid ${T.border}` : "none",
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: T.text }}>{r.name}</h3>
              <P>
                <strong style={{ color: T.text }}>Was zeigt dieser Bereich?</strong> {r.was}
              </P>
              <P>
                <strong style={{ color: T.text }}>Wofür ist er nützlich?</strong> {r.wofuer}
              </P>
              <P>
                <strong style={{ color: T.text }}>Wie praktisch nutzen?</strong> {r.praxis}
              </P>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: T.muted }}>
                <strong style={{ color: T.text }}>Was beachten?</strong> {r.beachten}
              </p>
            </div>
          ))}
        </Block>

        <Block title="D. Nachtragspotenzial richtig einordnen" id="nachtragspotenzial">
          <P>
            Der Bereich <strong style={{ color: T.text }}>Nachtragspotenzial</strong> ist kein Nachweis für einen späteren
            tatsächlichen Nachtrag oder einen konkreten Anspruch. Er zeigt vielmehr Hinweise auf Felder, in denen in der Praxis
            häufig Zusatzleistungen, Nachverhandlungen oder Konflikte entstehen können – etwa bei Abgrenzungen, Schnittstellen,
            Mengen oder Bauablauf.
          </P>
          <P>
            Nutzen Sie ihn zur <strong style={{ color: T.text }}>Vorbereitung</strong>: interne Abstimmung, Rückfragen an den
            Auftraggeber, Klarstellungen im Angebot und bewusste Absicherung. So reduzieren Sie Überraschungen in der
            Ausführungsphase – ohne aus der Anzeige einen automatischen Nachtrag abzuleiten.
          </P>
        </Block>

        <Block title="E. Rückfragen und Angebotsklarstellungen richtig nutzen" id="rueckfragen-klarstellungen">
          <P>
            <strong style={{ color: T.text }}>Rückfragen</strong> sind sinnvoll, wenn ohne Klärung keine belastbare Kalkulation oder
            keine eindeutige Leistungszuordnung möglich ist – z. B. bei offenen Mengen, unklaren Schnittstellen oder widersprüchlichen
            Anforderungen. Sie zielen auf Antworten des Auftraggebers vor der Angebotsabgabe.
          </P>
          <P>
            <strong style={{ color: T.text }}>Angebotsklarstellungen</strong> sind sinnvoll, wenn Sie trotz verbleibender Unschärfen
            anbieten müssen: Sie dokumentieren Annahmen, Grenzen der Leistung, Mitwirkung und Nachweise – damit Ihr Angebot gegenüber
            dem LV klar abgegrenzt ist.
          </P>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: T.muted }}>
            <strong style={{ color: T.text }}>Gemeinsam:</strong> Oft klären Sie mit Rückfragen, was möglich ist, und sichern den
            Rest mit Klarstellungen im Angebot ab. Beide Bereiche in LV Scope ergänzen sich – Priorität und rechtliche Prüfung
            bleiben bei Ihnen.
          </p>
        </Block>

        <Block title="F. Grenzen der Analyse" id="grenzen">
          <Ul
            items={[
              "Die Qualität der Auswertung hängt von der Qualität und Vollständigkeit Ihrer LV-/GAEB-Unterlagen ab.",
              "Unklare, lückenhafte oder widersprüchliche Texte können die Aussagekraft begrenzen – die Analyse kann nur das auswerten, was erkennbar ist.",
              "Ergebnisse sind eine Unterstützung für Ihre Entscheidungen, keine automatische Freigabe und keine Rechtsbewertung.",
              "Technische Sonderfälle, lokale Regeln oder individuelle Vertragsstrategien ersetzt keine Software – die Einschätzung Ihrer Fach- und Rechtsseite bleibt nötig.",
            ]}
          />
        </Block>

        <Block title="G. Hilfe & Feedback" id="feedback">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: T.muted }}>
            Wenn etwas in der Anwendung nicht wie erwartet funktioniert, Sie eine Idee für die Verbesserung haben oder eine Frage zur
            Bedienung: Nutzen Sie den Bereich{" "}
            <Link href="/app/feedback" style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}>
              Feedback
            </Link>{" "}
            in der App. Dort können Sie Bugs, Wünsche und andere Rückmeldungen an uns senden – wir melden uns bei Bedarf bei Ihnen.
          </p>
        </Block>
      </div>
    </>
  );
}
