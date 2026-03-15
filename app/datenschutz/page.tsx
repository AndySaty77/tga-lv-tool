import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "Datenschutz – LV Scope",
  description: "Datenschutzerklärung für die Nutzung der SaaS-Plattform LV Scope.",
};

const sectionTitle = {
  fontSize: 18,
  fontWeight: 700,
  color: T.text,
  marginTop: 28,
  marginBottom: 10,
} as const;
const subSectionTitle = {
  fontSize: 15,
  fontWeight: 600,
  color: T.text,
  marginTop: 18,
  marginBottom: 8,
} as const;
const paragraph = { fontSize: 14, lineHeight: 1.75, color: T.muted, marginBottom: 10 };
const list = { marginBottom: 10, paddingLeft: 20 };
const listItem = { fontSize: 14, lineHeight: 1.75, color: T.muted, marginBottom: 4 };

export default function DatenschutzPage() {
  return (
    <MarketingPageShell active="/datenschutz">
      <MarketingSection
        eyebrow="Rechtliches"
        title="Datenschutzerklärung"
        lead="LV Scope – lvscope.de | Stand: März 2026"
      >
        <Container>
          <div style={{ maxWidth: 720, marginBottom: 48 }}>
            <h2 style={sectionTitle}>1. Verantwortlicher</h2>
            <p style={paragraph}>
              Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) und anderer nationaler
              Datenschutzgesetze sowie sonstiger datenschutzrechtlicher Bestimmungen ist:
            </p>
            <p style={{ ...paragraph, marginLeft: 16 }}>
              LV Scope<br />
              Kontaktdaten (Anschrift, E-Mail) siehe Impressum.
            </p>
            <p style={paragraph}>
              Für Datenschutzanfragen: datenschutz@lvscope.de<br />
              Website: https://lvscope.de
            </p>

            <h2 style={sectionTitle}>2. Allgemeines zur Datenverarbeitung</h2>
            <p style={subSectionTitle}>2.1 Umfang der Verarbeitung personenbezogener Daten</p>
            <p style={paragraph}>
              Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies zur Bereitstellung
              einer funktionsfähigen Website sowie unserer Inhalte und Leistungen erforderlich ist. Die Verarbeitung
              personenbezogener Daten erfolgt regelmäßig nur nach Einwilligung des Nutzers. Eine Ausnahme gilt in solchen
              Fällen, in denen eine vorherige Einholung einer Einwilligung aus tatsächlichen Gründen nicht möglich ist
              und die Verarbeitung der Daten durch gesetzliche Vorschriften gestattet ist.
            </p>
            <p style={subSectionTitle}>2.2 Rechtsgrundlage für die Verarbeitung</p>
            <p style={paragraph}>
              Soweit wir für Verarbeitungsvorgänge personenbezogener Daten eine Einwilligung der betroffenen Person
              einholen, dient Art. 6 Abs. 1 lit. a DSGVO als Rechtsgrundlage. Bei der Verarbeitung von personenbezogenen
              Daten, die zur Erfüllung eines Vertrages erforderlich ist, dient Art. 6 Abs. 1 lit. b DSGVO als
              Rechtsgrundlage. Soweit eine Verarbeitung zur Wahrung eines berechtigten Interesses unseres Unternehmens
              oder eines Dritten erforderlich ist, dient Art. 6 Abs. 1 lit. f DSGVO als Rechtsgrundlage.
            </p>
            <p style={subSectionTitle}>2.3 Datenlöschung und Speicherdauer</p>
            <p style={paragraph}>
              Die personenbezogenen Daten der betroffenen Person werden gelöscht oder gesperrt, sobald der Zweck der
              Speicherung entfällt. Eine Speicherung kann darüber hinaus erfolgen, wenn dies durch den europäischen oder
              nationalen Gesetzgeber in unionsrechtlichen Verordnungen, Gesetzen oder sonstigen Vorschriften, denen der
              Verantwortliche unterliegt, vorgesehen wurde. Eine Sperrung oder Löschung der Daten erfolgt auch dann, wenn
              eine durch die genannten Normen vorgeschriebene Speicherfrist abläuft.
            </p>

            <h2 style={sectionTitle}>3. Bereitstellung der Website und Logfiles</h2>
            <p style={subSectionTitle}>3.1 Beschreibung und Umfang der Datenverarbeitung</p>
            <p style={paragraph}>
              Bei jedem Aufruf unserer Website erfasst unser System automatisiert Daten und Informationen vom
              Computersystem des aufrufenden Rechners. Folgende Daten werden erhoben:
            </p>
            <ul style={list}>
              <li style={listItem}>IP-Adresse des Nutzers (anonymisiert)</li>
              <li style={listItem}>Datum und Uhrzeit des Zugriffs</li>
              <li style={listItem}>Referrer-URL (zuvor besuchte Website)</li>
              <li style={listItem}>Browsertyp und Browserversion</li>
              <li style={listItem}>Betriebssystem des Nutzers</li>
              <li style={listItem}>Aufgerufene Seite / Ressource</li>
            </ul>
            <p style={paragraph}>
              Diese Daten werden in den Logfiles unseres Systems gespeichert. Eine Speicherung dieser Daten zusammen
              mit anderen personenbezogenen Daten des Nutzers findet nicht statt.
            </p>
            <p style={subSectionTitle}>3.2 Rechtsgrundlage</p>
            <p style={paragraph}>
              Rechtsgrundlage für die vorübergehende Speicherung der Daten und der Logfiles ist Art. 6 Abs. 1 lit. f
              DSGVO.
            </p>
            <p style={subSectionTitle}>3.3 Zweck und Speicherdauer</p>
            <p style={paragraph}>
              Die vorübergehende Speicherung der IP-Adresse durch das System ist notwendig, um eine Auslieferung der
              Website an den Rechner des Nutzers zu ermöglichen. Technische Logs werden nur so lange und in dem Umfang
              aufbewahrt, wie es für den Betrieb erforderlich ist; die Löschung erfolgt in der Regel innerhalb von 30
              Tagen, soweit durch uns oder unseren Hosting-Anbieter so umgesetzt.
            </p>

            <h2 style={sectionTitle}>4. Registrierung und Nutzerkonto</h2>
            <p style={subSectionTitle}>4.1 Beschreibung und Umfang der Datenverarbeitung</p>
            <p style={paragraph}>
              Auf unserer Website können Sie sich registrieren und ein Nutzerkonto anlegen. Die Anmeldung (Login) erfolgt
              über dasselbe Konto. Für Registrierung, Login und die Speicherung von Kontodaten setzen wir den Dienst
              Supabase (Authentifizierung und Datenbank) ein. Bei der Registrierung werden folgende Daten erhoben:
            </p>
            <ul style={list}>
              <li style={listItem}>E-Mail-Adresse</li>
              <li style={listItem}>Gewähltes Passwort (gespeichert als sicherer Hash)</li>
              <li style={listItem}>Vor- und Nachname (optional)</li>
              <li style={listItem}>Unternehmen (optional)</li>
              <li style={listItem}>Datum und Uhrzeit der Registrierung</li>
            </ul>
            <p style={subSectionTitle}>4.2 Rechtsgrundlage</p>
            <p style={paragraph}>
              Rechtsgrundlage für die Verarbeitung der Daten ist bei Vorliegen einer Einwilligung des Nutzers Art. 6
              Abs. 1 lit. a DSGVO. Dient die Registrierung der Erfüllung eines Vertrages, dessen Vertragspartei der
              Nutzer ist, so ist Art. 6 Abs. 1 lit. b DSGVO zusätzliche Rechtsgrundlage.
            </p>
            <p style={subSectionTitle}>4.3 Speicherdauer</p>
            <p style={paragraph}>
              Registrierungs- und Kontodaten werden für die Dauer des Nutzerkontos gespeichert. Nach Kündigung bzw.
              Löschung des Nutzerkontos werden die mit dem Konto verbundenen personenbezogenen Daten gelöscht, sofern
              keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Die Löschung können Sie selbst über die
              Einstellungen der Anwendung vornehmen (siehe Ziff. 4.4); eine automatische Löschung nach Ablauf einer
              Frist ist derzeit nicht technisch umgesetzt.
            </p>
            <p style={subSectionTitle}>4.4 Kontolöschung durch den Nutzer</p>
            <p style={paragraph}>
              Sie können Ihr Nutzerkonto jederzeit selbstständig löschen. Die Funktion steht in den Einstellungen der
              Anwendung unter „Konto löschen“ zur Verfügung (nach Anmeldung). Bei der Kontolöschung werden Ihre
              nutzerbezogenen Anwendungsdaten – einschließlich gespeicherter Analyseergebnisse und Profildaten – sowie
              Ihr Authentifizierungszugang (Login) dauerhaft aus unseren Systemen entfernt. Es erfolgt eine echte
              Löschung; ein erneuter Zugriff auf das Konto ist nicht mehr möglich. In Backups oder Snapshots können
              Ihre Daten technisch bedingt noch für eine begrenzte Zeit vorhanden sein und werden mit der üblichen
              Backup-Rotation überschrieben. Gesetzliche Aufbewahrungspflichten bleiben unberührt.
            </p>

            <h2 style={sectionTitle}>5. Verarbeitung hochgeladener Dokumente (LV-/GAEB-Dateien)</h2>
            <p style={subSectionTitle}>5.1 Beschreibung</p>
            <p style={paragraph}>
              LV Scope ist ein KI-gestütztes Analysetool für Leistungsverzeichnisse (LV) und GAEB-Dateien aus dem
              TGA-Bereich. Nutzer laden Dokumente hoch, die durch das System analysiert werden. Diese Dokumente können
              Informationen zu Bauprojekten, Leistungsbeschreibungen und ggf. personenbezogene Daten (z. B. Namen von
              Projektverantwortlichen) enthalten.
            </p>
            <p style={subSectionTitle}>5.2 Verarbeitungszweck und Rechtsgrundlage</p>
            <p style={paragraph}>
              Die hochgeladenen Dokumente werden ausschließlich zur Erbringung der vertraglich vereinbarten
              Analyseleistung verarbeitet (Art. 6 Abs. 1 lit. b DSGVO). Eine Nutzung für andere Zwecke findet nicht
              statt. Die Dokumente werden nicht dauerhaft gespeichert und nicht für das Training von KI-Modellen
              verwendet.
            </p>
            <p style={subSectionTitle}>5.3 Einsatz von KI-Diensten (Sub-Prozessoren)</p>
            <p style={paragraph}>
              Für die KI-gestützte Analyse setzen wir Dienste von Drittanbietern ein (derzeit: OpenAI). Dabei werden
              Dokumentinhalte zur Analyse an diesen Anbieter übermittelt. Die Verarbeitung erfolgt auf Grundlage von
              Auftragsverarbeitungsverträgen gemäß Art. 28 DSGVO; wir setzen ausschließlich Anbieter mit angemessenen
              Datenschutzgarantien (z. B. EU-Standardvertragsklauseln) ein. Eine aktuelle Liste der Sub-Prozessoren
              erhalten Sie auf Anfrage.
            </p>
            <p style={subSectionTitle}>5.4 Speicherdauer</p>
            <p style={paragraph}>
              Hochgeladene Dateien werden nicht dauerhaft als Dateien gespeichert; sie werden ausschließlich für die
              Dauer der Verarbeitung zur Analyse genutzt. Die daraus erzeugten Analyseergebnisse werden in Ihrem
              Nutzerkonto (Datenbank) gespeichert. Eine Löschung erfolgt durch Sie (Löschen einzelner Analysen bzw. des
              Kontos) oder im Rahmen einer künftig implementierten Systemlöschlogik. Derzeit ist keine automatische
              Löschung nach einer festen Frist technisch umgesetzt.
            </p>

            <h2 style={sectionTitle}>6. Kontaktformular und E-Mail-Kontakt</h2>
            <p style={subSectionTitle}>6.1 Kontaktformular</p>
            <p style={paragraph}>
              Über das Kontaktformular auf der Website können Sie uns (Name, Unternehmen, E-Mail, Nachricht etc.)
              anfragen. Die Angaben werden zur Bearbeitung Ihrer Anfrage per E-Mail an uns übermittelt. Hierfür setzen
              wir den Dienst Resend ein; die Daten werden nicht in einer Datenbank unserer Anwendung gespeichert. Die
              E-Mail-Kommunikation und ggf. bei uns gespeicherte Korrespondenz werden nach Erledigung der Anfrage
              gelöscht oder in der Regel innerhalb von 6 Monaten, soweit keine gesetzlichen Aufbewahrungspflichten
              entgegenstehen. Eine automatische Löschung nach genau 6 Monaten ist derzeit nicht technisch umgesetzt.
            </p>
            <p style={subSectionTitle}>6.2 E-Mail-Kontakt</p>
            <p style={paragraph}>
              Wenn Sie uns direkt per E-Mail kontaktieren, werden die von Ihnen mitgeteilten Daten zur Bearbeitung
              Ihrer Anfrage verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse). Die
              Daten werden gelöscht, sobald sie für den Zweck nicht mehr erforderlich sind, oder die Verarbeitung wird
              eingeschränkt, falls Aufbewahrungspflichten bestehen.
            </p>

            <h2 style={sectionTitle}>7. Cookies</h2>
            <p style={paragraph}>
              Unsere Website verwendet Cookies. Dabei handelt es sich um Textdateien, die im Internetbrowser bzw. vom
              Internetbrowser auf dem Computersystem des Nutzers gespeichert werden. Wir setzen ausschließlich technisch
              notwendige Cookies ein, die für den Betrieb der Website und die Authentifizierung (Session-Management)
              erforderlich sind. Diese Cookies werden auf Basis von Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am
              sicheren Betrieb der Plattform) gesetzt und erfordern keine gesonderte Einwilligung. Sie können die
              Speicherung von Cookies durch eine entsprechende Einstellung Ihres Browsers verhindern; wir weisen jedoch
              darauf hin, dass Sie in diesem Fall möglicherweise nicht alle Funktionen unserer Website in vollem Umfang
              nutzen können.
            </p>

            <h2 style={sectionTitle}>8. Analyse- und Trackingdienste</h2>
            <p style={paragraph}>
              Wir setzen derzeit keine externen Analyse- oder Trackingdienste (z. B. Google Analytics oder vergleichbare
              Dienste) ein. Sollten wir künftig solche Dienste einsetzen, werden wir diese Datenschutzerklärung
              aktualisieren und gegebenenfalls Ihre Einwilligung einholen.
            </p>

            <h2 style={sectionTitle}>9. Zahlungsabwicklung</h2>
            <p style={paragraph}>
              Soweit wir für kostenpflichtige Leistungen externe Zahlungsdienstleister (z. B. Stripe) einsetzen, erfolgt
              die Abwicklung über diese. Die Übermittlung von Zahlungsdaten erfolgt direkt an den jeweiligen Anbieter;
              wir erhalten und speichern keine vollständigen Zahlungsdaten (z. B. Kreditkartennummern). Rechtsgrundlage
              ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung). Die Datenschutzhinweise des eingesetzten Anbieters
              finden Sie auf dessen Website.
            </p>

            <h2 style={sectionTitle}>10. Rechte der betroffenen Person</h2>
            <p style={paragraph}>
              Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit folgende Rechte:
            </p>
            <ul style={list}>
              <li style={listItem}>
                <strong>Recht auf Auskunft (Art. 15 DSGVO):</strong> Sie können Auskunft über Ihre bei uns gespeicherten
                personenbezogenen Daten verlangen.
              </li>
              <li style={listItem}>
                <strong>Recht auf Berichtigung (Art. 16 DSGVO):</strong> Sie können die Berichtigung unrichtiger oder
                unvollständiger Daten verlangen.
              </li>
              <li style={listItem}>
                <strong>Recht auf Löschung (Art. 17 DSGVO):</strong> Sie können die Löschung Ihrer Daten verlangen,
                sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
              </li>
              <li style={listItem}>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO).</li>
              <li style={listItem}>Recht auf Datenübertragbarkeit (Art. 20 DSGVO).</li>
              <li style={listItem}>
                Widerspruchsrecht (Art. 21 DSGVO): Sie können der Verarbeitung Ihrer Daten auf Grundlage berechtigter
                Interessen widersprechen.
              </li>
              <li style={listItem}>
                Recht auf Widerruf einer erteilten Einwilligung (Art. 7 Abs. 3 DSGVO).
              </li>
            </ul>
            <p style={paragraph}>
              Zur Ausübung Ihrer Rechte wenden Sie sich bitte an: datenschutz@lvscope.de (oder die im Impressum
              genannte Kontaktstelle).
            </p>
            <p style={paragraph}>
              Unbeschadet eines anderweitigen verwaltungsrechtlichen oder gerichtlichen Rechtsbehelfs steht Ihnen das
              Recht auf Beschwerde bei einer Aufsichtsbehörde zu, wenn Sie der Ansicht sind, dass die Verarbeitung der
              Sie betreffenden personenbezogenen Daten gegen die DSGVO verstößt. Die zuständige Aufsichtsbehörde richtet
              sich nach Ihrem Bundesland des gewöhnlichen Aufenthalts.
            </p>

            <h2 style={sectionTitle}>11. Datensicherheit</h2>
            <p style={paragraph}>
              Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten gegen zufällige oder
              vorsätzliche Manipulationen, Verlust, Zerstörung oder gegen den Zugriff unberechtigter Personen zu
              schützen. Unsere Sicherheitsmaßnahmen werden entsprechend der technologischen Entwicklung fortlaufend
              verbessert. Die Datenübertragung zwischen Ihrem Browser und unseren Servern erfolgt verschlüsselt über
              HTTPS/TLS.
            </p>

            <h2 style={sectionTitle}>12. Aktualität und Änderung dieser Datenschutzerklärung</h2>
            <p style={paragraph}>
              Diese Datenschutzerklärung ist aktuell gültig und hat den Stand März 2026. Durch die Weiterentwicklung
              unserer Website und Angebote oder aufgrund geänderter gesetzlicher beziehungsweise behördlicher Vorgaben
              kann es notwendig werden, diese Datenschutzerklärung zu ändern. Die jeweils aktuelle Datenschutzerklärung
              kann jederzeit auf der Website unter https://lvscope.de/datenschutz abgerufen und ausgedruckt werden.
            </p>

            <p style={{ marginTop: 32, fontSize: 13, color: T.faint, textAlign: "center" }}>
              LV Scope | lvscope.de | Stand: März 2026
            </p>
            <p style={{ marginTop: 16, fontSize: 12, color: T.faint, textAlign: "center" }}>
              <Link href="/agb" style={{ color: T.muted, textDecoration: "underline" }}>
                AGB
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
