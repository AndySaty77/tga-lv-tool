import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "AGB – LV Scope",
  description: "Allgemeine Geschäftsbedingungen für die Nutzung der SaaS-Plattform LV Scope.",
};

const sectionTitle = (num: number, title: string) => ({
  fontSize: 18,
  fontWeight: 700,
  color: T.text,
  marginTop: 28,
  marginBottom: 10,
});
const paragraph = { fontSize: 14, lineHeight: 1.75, color: T.muted, marginBottom: 10 };
const list = { marginBottom: 10, paddingLeft: 20 };
const listItem = { fontSize: 14, lineHeight: 1.75, color: T.muted, marginBottom: 4 };

export default function AgbPage() {
  return (
    <MarketingPageShell active="/agb">
      <MarketingSection
        eyebrow="Rechtliches"
        title="Allgemeine Geschäftsbedingungen (AGB)"
        lead="LV Scope – lvscope.de | Stand: März 2026"
      >
        <Container>
          <div style={{ maxWidth: 720, marginBottom: 48 }}>
            <h2 style={sectionTitle(1, "1. Geltungsbereich und Vertragspartner")}>
              1. Geltungsbereich und Vertragspartner
            </h2>
            <p style={paragraph}>
              (1) Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge zwischen:
            </p>
            <p style={{ ...paragraph, marginLeft: 16 }}>
              LV Scope<br />
              [Ihr Name / Firmenname]<br />
              [Straße, Hausnummer], [PLZ Ort]<br />
              E-Mail: [kontakt@lvscope.de]
            </p>
            <p style={paragraph}>
              (nachfolgend „Anbieter“) und dem Nutzer der SaaS-Plattform LV Scope (nachfolgend „Kunde“).
            </p>
            <p style={paragraph}>
              (2) LV Scope richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB, d. h. natürliche oder
              juristische Personen oder rechtsfähige Personengesellschaften, die bei Abschluss des Rechtsgeschäfts in
              Ausübung ihrer gewerblichen oder selbständigen beruflichen Tätigkeit handeln (B2B). Vertragsschlüsse mit
              Verbrauchern sind ausgeschlossen.
            </p>
            <p style={paragraph}>
              (3) Abweichende, entgegenstehende oder ergänzende AGB des Kunden werden nicht Vertragsbestandteil, es sei
              denn, ihrer Geltung wird ausdrücklich schriftlich zugestimmt.
            </p>

            <h2 style={sectionTitle(2, "2. Leistungsbeschreibung")}>2. Leistungsbeschreibung</h2>
            <p style={paragraph}>
              (1) LV Scope ist eine cloudbasierte Softwareanwendung (Software-as-a-Service) zur KI-gestützten Analyse
              von Leistungsverzeichnissen (LV) und GAEB-Dateien im Bereich der Technischen Gebäudeausrüstung (TGA). Der
              Leistungsumfang umfasst insbesondere:
            </p>
            <ul style={list}>
              <li style={listItem}>Strukturierung und Bewertung von Risiken im Leistungsverzeichnis</li>
              <li style={listItem}>Generierung von Rückfragen und Angebotsklarstellungen</li>
              <li style={listItem}>Identifikation von Nachtragspotenzial</li>
              <li style={listItem}>Erstellung von Management Summaries</li>
            </ul>
            <p style={paragraph}>
              (2) Der Anbieter stellt die Software über das Internet zur Verfügung. Der Kunde erhält das
              nicht-ausschließliche, nicht-übertragbare Recht zur Nutzung der Software im Rahmen des gebuchten Tarifs.
            </p>
            <p style={paragraph}>
              (3) Der genaue Leistungsumfang richtet sich nach dem zum Zeitpunkt des Vertragsschlusses geltenden
              Leistungsbeschrieb auf lvscope.de/features sowie dem gewählten Tarifmodell.
            </p>
            <p style={paragraph}>
              (4) Die Analysen werden unter Einsatz von KI-Technologien erstellt. Die Ergebnisse sind als
              Entscheidungshilfe zu verstehen und ersetzen nicht die fachkundige Prüfung durch qualifiziertes Personal.
              Der Anbieter übernimmt keine Haftung für die inhaltliche Richtigkeit der KI-generierten Ergebnisse (vgl. §
              8).
            </p>

            <h2 style={sectionTitle(3, "3. Vertragsschluss und Registrierung")}>
              3. Vertragsschluss und Registrierung
            </h2>
            <p style={paragraph}>
              (1) Die Darstellung der Leistungen auf der Website stellt kein rechtlich bindendes Angebot, sondern eine
              Aufforderung zur Abgabe eines Angebots (invitatio ad offerendum) dar.
            </p>
            <p style={paragraph}>
              (2) Der Vertrag kommt zustande durch Registrierung auf der Plattform und Bestätigung des gewählten Tarifs
              durch den Kunden (Angebot) sowie die darauffolgende Aktivierung des Zugangs durch den Anbieter oder
              automatisiert durch das System (Annahme).
            </p>
            <p style={paragraph}>
              (3) Der Kunde ist verpflichtet, bei der Registrierung wahrheitsgemäße Angaben zu machen und diese aktuell
              zu halten. Die Zugangsdaten sind vertraulich zu behandeln und dürfen nicht an Dritte weitergegeben werden.
            </p>
            <p style={paragraph}>
              (4) Pro Unternehmen / Person ist grundsätzlich nur ein Konto zulässig, sofern im jeweiligen Tarif keine
              Teamfunktionen vorgesehen sind.
            </p>

            <h2 style={sectionTitle(4, "4. Tarifmodelle und Nutzungsrechte")}>
              4. Tarifmodelle und Nutzungsrechte
            </h2>
            <p style={paragraph}>
              (1) LV Scope wird in verschiedenen Tarifen angeboten (z. B. Free, Pro, Team). Der jeweilige
              Leistungsumfang, die Anzahl der enthaltenen Analysen und weitere Beschränkungen richten sich nach der auf
              lvscope.de/pricing veröffentlichten Tarifübersicht.
            </p>
            <p style={paragraph}>
              (2) Die im Rahmen des jeweiligen Tarifs gewährten Nutzungsrechte sind nicht übertragbar und nicht
              sublizenzierbar. Eine Nutzung durch Dritte ist ausgeschlossen, sofern nicht ausdrücklich im Tarif
              vorgesehen (z. B. Team-Tarif mit mehreren Nutzersitzen).
            </p>
            <p style={paragraph}>
              (3) Der Anbieter ist berechtigt, das Leistungsangebot und die Tarifstruktur jederzeit anzupassen.
              Änderungen werden dem Kunden rechtzeitig mit einer Ankündigungsfrist von mindestens 30 Tagen vor
              Inkrafttreten mitgeteilt.
            </p>

            <h2 style={sectionTitle(5, "5. Vergütung und Zahlungsbedingungen")}>
              5. Vergütung und Zahlungsbedingungen
            </h2>
            <p style={paragraph}>
              (1) Die Vergütung richtet sich nach dem gewählten Tarif gemäß der zum Zeitpunkt des Vertragsschlusses
              geltenden Preisliste auf lvscope.de/pricing. Alle Preise verstehen sich zzgl. der gesetzlichen
              Umsatzsteuer.
            </p>
            <p style={paragraph}>
              (2) Die Abrechnung erfolgt – je nach Tarif – monatlich oder jährlich im Voraus. Die Zahlungspflicht
              entsteht mit Vertragsschluss bzw. zu Beginn des jeweiligen Abrechnungszeitraums.
            </p>
            <p style={paragraph}>
              (3) Die Zahlung erfolgt per Kreditkarte oder anderen auf der Plattform angebotenen Zahlungsmethoden über
              einen externen Zahlungsdienstleister (z. B. Stripe).
            </p>
            <p style={paragraph}>
              (4) Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang zur Plattform nach Ablauf einer Nachfrist
              von 7 Tagen zu sperren und Verzugszinsen gemäß § 288 Abs. 2 BGB (9 Prozentpunkte über dem Basiszinssatz)
              zu verlangen.
            </p>
            <p style={paragraph}>
              (5) Der Anbieter ist berechtigt, Preise mit einer Ankündigungsfrist von 30 Tagen zu ändern. Der Kunde hat
              in diesem Fall ein außerordentliches Kündigungsrecht zum Zeitpunkt des Inkrafttretens der Preisänderung.
            </p>

            <h2 style={sectionTitle(6, "6. Laufzeit und Kündigung")}>6. Laufzeit und Kündigung</h2>
            <p style={paragraph}>
              (1) Der Vertrag wird für die im jeweiligen Tarif angegebene Mindestlaufzeit geschlossen (z. B. monatlich
              oder jährlich) und verlängert sich automatisch um den gleichen Zeitraum, wenn er nicht rechtzeitig
              gekündigt wird.
            </p>
            <p style={paragraph}>
              (2) Die Kündigung muss spätestens 7 Tage vor Ablauf der laufenden Vertragslaufzeit in Textform (z. B. per
              E-Mail) eingehen.
            </p>
            <p style={paragraph}>
              (3) Kostenlose Tarife (Free) können jederzeit ohne Frist beendet werden.
            </p>
            <p style={paragraph}>
              (4) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund
              liegt für den Anbieter insbesondere vor, wenn der Kunde:
            </p>
            <ul style={list}>
              <li style={listItem}>
                gegen diese AGB verstößt und den Verstoß trotz Abmahnung nicht abstellt,
              </li>
              <li style={listItem}>falsche Angaben bei der Registrierung gemacht hat,</li>
              <li style={listItem}>die Plattform missbräuchlich oder rechtswidrig nutzt.</li>
            </ul>
            <p style={paragraph}>
              (5) Bei Kündigung durch den Kunden besteht kein Anspruch auf anteilige Rückerstattung bereits geleisteter
              Zahlungen für den laufenden Abrechnungszeitraum, sofern nicht gesetzlich vorgeschrieben.
            </p>

            <h2 style={sectionTitle(7, "7. Pflichten des Kunden")}>7. Pflichten des Kunden</h2>
            <p style={paragraph}>
              (1) Der Kunde stellt sicher, dass er über die erforderlichen Rechte an den hochgeladenen Dokumenten
              verfügt und durch das Hochladen keine Rechte Dritter verletzt werden.
            </p>
            <p style={paragraph}>
              (2) Der Kunde ist verantwortlich für die Einhaltung datenschutzrechtlicher Vorgaben bei der Nutzung der
              Plattform, insbesondere wenn in hochgeladenen Dokumenten personenbezogene Daten Dritter enthalten sind.
            </p>
            <p style={paragraph}>
              (3) Der Kunde verpflichtet sich, die Plattform nicht zu missbräuchlichen Zwecken zu nutzen und
              insbesondere:
            </p>
            <ul style={list}>
              <li style={listItem}>keine automatisierten Zugriffe (Scraping, Bots) durchzuführen,</li>
              <li style={listItem}>keine schädlichen Inhalte oder Malware hochzuladen,</li>
              <li style={listItem}>die Plattform nicht für rechtswidrige Zwecke zu nutzen,</li>
              <li style={listItem}>Zugangsdaten sicher aufzubewahren und nicht weiterzugeben.</li>
            </ul>

            <h2 style={sectionTitle(8, "8. Haftung und Gewährleistung")}>8. Haftung und Gewährleistung</h2>
            <p style={{ ...paragraph, fontWeight: 600, color: T.text }}>8.1 Haftungsbeschränkung</p>
            <p style={paragraph}>
              (1) Der Anbieter haftet uneingeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der
              Gesundheit sowie für Schäden, die auf Vorsatz oder grober Fahrlässigkeit beruhen, sowie für Schäden, die
              auf dem Fehlen einer garantierten Beschaffenheit beruhen.
            </p>
            <p style={paragraph}>
              (2) Für leichte Fahrlässigkeit haftet der Anbieter nur bei Verletzung einer wesentlichen Vertragspflicht
              (Kardinalpflicht). Die Haftung ist in diesen Fällen auf den vorhersehbaren, vertragstypischen Schaden
              begrenzt, maximal auf den vom Kunden in den letzten 12 Monaten vor dem Schadenseintritt an den Anbieter
              gezahlten Betrag.
            </p>
            <p style={paragraph}>
              (3) Eine weitergehende Haftung des Anbieters ist ausgeschlossen. Dies gilt insbesondere für entgangenen
              Gewinn, mittelbare Schäden und Folgeschäden.
            </p>
            <p style={{ ...paragraph, fontWeight: 600, color: T.text }}>8.2 KI-generierte Inhalte</p>
            <p style={paragraph}>
              (4) Die durch das System generierten Analysen, Rückfragen, Klarstellungen und Potenzialhinweise basieren
              auf KI-Technologien und stellen keine rechtliche, kaufmännische oder technische Beratung dar. Der Anbieter
              übernimmt keine Gewähr für die Vollständigkeit, Richtigkeit oder Angemessenheit der KI-generierten
              Ergebnisse. Der Kunde ist verpflichtet, die Ergebnisse eigenverantwortlich zu prüfen, bevor er
              geschäftliche Entscheidungen darauf stützt.
            </p>
            <p style={{ ...paragraph, fontWeight: 600, color: T.text }}>8.3 Verfügbarkeit</p>
            <p style={paragraph}>
              (5) Der Anbieter strebt eine hohe Verfügbarkeit der Plattform an, übernimmt jedoch keine Garantie für eine
              ununterbrochene Verfügbarkeit. Wartungsarbeiten werden nach Möglichkeit außerhalb der Hauptgeschäftszeiten
              durchgeführt. Der Anbieter haftet nicht für Ausfälle, die durch Umstände verursacht werden, die außerhalb
              seines Einflussbereichs liegen (höhere Gewalt, Ausfälle von Drittanbietern etc.).
            </p>

            <h2 style={sectionTitle(9, "9. Datenschutz und Auftragsverarbeitung")}>
              9. Datenschutz und Auftragsverarbeitung
            </h2>
            <p style={paragraph}>
              (1) Die Verarbeitung personenbezogener Daten im Rahmen der Vertragsbeziehung erfolgt gemäß unserer
              Datenschutzerklärung, die unter lvscope.de/datenschutz abrufbar ist.
            </p>
            <p style={paragraph}>
              (2) Soweit der Kunde im Rahmen der Nutzung der Plattform personenbezogene Daten Dritter verarbeitet und
              der Anbieter dabei als Auftragsverarbeiter tätig wird, schließen die Parteien einen gesonderten
              Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO ab. Der Abschluss eines AVV kann unter
              datenschutz@lvscope.de angefordert werden.
            </p>

            <h2 style={sectionTitle(10, "10. Vertraulichkeit und geistiges Eigentum")}>
              10. Vertraulichkeit und geistiges Eigentum
            </h2>
            <p style={paragraph}>
              (1) Alle im Rahmen der Nutzung von LV Scope generierten Analyseergebnisse stehen dem Kunden zur freien
              Verwendung für betriebliche Zwecke zu.
            </p>
            <p style={paragraph}>
              (2) Die Plattform selbst, einschließlich Quellcode, Algorithmen, Benutzeroberfläche, Marken und Logos,
              ist Eigentum des Anbieters und urheberrechtlich geschützt. Dem Kunden werden hieran keine Rechte
              übertragen.
            </p>
            <p style={paragraph}>
              (3) Der Anbieter ist berechtigt, anonymisierte und aggregierte Nutzungsdaten (ohne Personenbezug und ohne
              Inhalte hochgeladener Dokumente) zur Verbesserung der Plattform zu verwenden.
            </p>

            <h2 style={sectionTitle(11, "11. Änderungen der AGB")}>11. Änderungen der AGB</h2>
            <p style={paragraph}>
              (1) Der Anbieter ist berechtigt, diese AGB mit einer Ankündigungsfrist von 30 Tagen zu ändern. Die
              Änderungen werden dem Kunden per E-Mail oder durch einen Hinweis beim nächsten Login mitgeteilt.
            </p>
            <p style={paragraph}>
              (2) Widerspricht der Kunde den geänderten AGB nicht innerhalb von 30 Tagen nach Bekanntgabe in Textform,
              gelten die geänderten AGB als akzeptiert. Auf die Bedeutung des Schweigens wird in der
              Änderungsmitteilung ausdrücklich hingewiesen.
            </p>
            <p style={paragraph}>
              (3) Im Falle eines Widerspruchs ist der Anbieter berechtigt, das Vertragsverhältnis mit dem Kunden zum
              Zeitpunkt des Inkrafttretens der geänderten AGB zu kündigen.
            </p>

            <h2 style={sectionTitle(12, "12. Schlussbestimmungen")}>12. Schlussbestimmungen</h2>
            <p style={paragraph}>
              (1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts (CISG).
            </p>
            <p style={paragraph}>
              (2) Ausschließlicher Gerichtsstand für alle Streitigkeiten aus und im Zusammenhang mit diesem Vertrag ist
              – soweit gesetzlich zulässig – der Sitz des Anbieters.
            </p>
            <p style={paragraph}>
              (3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der
              übrigen Bestimmungen unberührt. Die unwirksame Bestimmung ist durch eine wirksame Bestimmung zu ersetzen,
              die dem wirtschaftlichen Zweck der unwirksamen Bestimmung möglichst nahe kommt.
            </p>
            <p style={paragraph}>
              (4) Änderungen und Ergänzungen des Vertrages bedürfen der Textform. Dies gilt auch für die Aufhebung des
              Textformerfordernisses selbst.
            </p>

            <p style={{ marginTop: 32, fontSize: 13, color: T.faint, textAlign: "center" }}>
              LV Scope | lvscope.de | Stand: März 2026
            </p>
            <p style={{ marginTop: 16, fontSize: 12, color: T.faint, textAlign: "center" }}>
              <Link href="/datenschutz" style={{ color: T.muted, textDecoration: "underline" }}>
                Datenschutzhinweise
              </Link>
              {" · "}
              <Link href="/" style={{ color: T.muted, textDecoration: "underline" }}>
                Startseite
              </Link>
            </p>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}
