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
        lead="LV Scope – lvscope.de | Stand: April 2026"
      >
        <Container>
          <div style={{ maxWidth: 720, marginBottom: 48 }}>
            <h2 style={sectionTitle}>1. Verantwortlicher</h2>
            <p style={paragraph}>
              Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) und sonstiger datenschutzrechtlicher
              Vorschriften ist:
            </p>
            <p style={{ ...paragraph, marginLeft: 16 }}>
              LV Scope<br />
              Kontaktdaten (Anschrift, E-Mail) siehe Impressum.<br />
              Für Datenschutzanfragen: datenschutz@lvscope.de<br />
              Website: lvscope.de
            </p>

            <h2 style={sectionTitle}>2. Allgemeines zur Datenverarbeitung</h2>
            <p style={subSectionTitle}>2.1 Umfang der Verarbeitung personenbezogener Daten</p>
            <p style={paragraph}>
              Wir verarbeiten personenbezogene Daten unserer Nutzer grundsaetzlich nur, soweit dies fuer den Betrieb der
              Website, die Bereitstellung unseres Nutzerkontos sowie die Durchfuehrung der angebotenen Analyseleistungen
              erforderlich ist.
            </p>
            <p style={subSectionTitle}>2.2 Rechtsgrundlagen</p>
            <p style={paragraph}>
              Soweit wir eine Einwilligung einholen, ist Rechtsgrundlage Art. 6 Abs. 1 lit. a DSGVO. Soweit die
              Verarbeitung zur Durchfuehrung vorvertraglicher Massnahmen oder zur Erfuellung eines Vertrages erforderlich
              ist, ist Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO. Soweit die Verarbeitung zur Wahrung unserer
              berechtigten Interessen erforderlich ist, ist Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO.
            </p>
            <p style={subSectionTitle}>2.3 Datenlöschung und Speicherdauer</p>
            <p style={paragraph}>
              Personenbezogene Daten werden geloescht, sobald der Zweck der Speicherung entfaellt und keine gesetzlichen
              Aufbewahrungspflichten entgegenstehen. Soweit im Folgenden keine genauere Frist genannt ist, erfolgt die
              Loeschung nach Zweckfortfall oder im Rahmen der von uns vorgesehenen Loeschprozesse.
            </p>

            <h2 style={sectionTitle}>3. Bereitstellung der Website und technische Logfiles</h2>
            <p style={subSectionTitle}>3.1 Beschreibung und Umfang der Verarbeitung</p>
            <p style={paragraph}>
              Bei jedem Aufruf unserer Website werden automatisiert technische Daten verarbeitet, die fuer die
              Auslieferung und den sicheren Betrieb der Website erforderlich sind. Hierzu koennen insbesondere gehoeren:
            </p>
            <ul style={list}>
              <li style={listItem}>IP-Adresse des aufrufenden Systems</li>
              <li style={listItem}>Datum und Uhrzeit des Zugriffs</li>
              <li style={listItem}>Browsertyp und Browserversion</li>
              <li style={listItem}>Betriebssystem</li>
              <li style={listItem}>Referrer-URL</li>
              <li style={listItem}>aufgerufene Seiten und Ressourcen</li>
            </ul>
            <p style={subSectionTitle}>3.2 Rechtsgrundlage</p>
            <p style={paragraph}>
              Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
            </p>
            <p style={subSectionTitle}>3.3 Zweck</p>
            <p style={paragraph}>
              Die Verarbeitung erfolgt zur technischen Bereitstellung der Website, zur Fehleranalyse, zur Systemsicherheit
              und zur Missbrauchsabwehr.
            </p>
            <p style={subSectionTitle}>3.4 Speicherdauer</p>
            <p style={paragraph}>
              Technische Logdaten werden nur so lange gespeichert, wie dies fuer den Betrieb, die Stabilitaet und die
              Sicherheit der Website erforderlich ist. Soweit durch uns oder unseren Hosting-Anbieter umgesetzt, erfolgt
              die Loeschung in der Regel innerhalb von 30 Tagen.
            </p>

            <h2 style={sectionTitle}>4. Registrierung und Nutzerkonto</h2>
            <p style={subSectionTitle}>4.1 Beschreibung und Umfang der Verarbeitung</p>
            <p style={paragraph}>
              Auf unserer Website koennen Sie ein Nutzerkonto anlegen. Fuer Registrierung, Login und die Speicherung
              nutzerbezogener Anwendungsdaten nutzen wir Supabase fuer Authentifizierung und Datenbankfunktionen.
            </p>
            <p style={paragraph}>Im Rahmen der Registrierung und Nutzung des Kontos verarbeiten wir insbesondere:</p>
            <ul style={list}>
              <li style={listItem}>E-Mail-Adresse</li>
              <li style={listItem}>Passwort in gehashter Form</li>
              <li style={listItem}>Vor- und Nachname, soweit angegeben</li>
              <li style={listItem}>Unternehmen, soweit angegeben</li>
              <li style={listItem}>Zeitpunkte der Registrierung und Kontoaktivitaet</li>
              <li style={listItem}>
                plan- und nutzungsbezogene Kontoinformationen, soweit fuer die Bereitstellung des Dienstes erforderlich
              </li>
            </ul>
            <p style={subSectionTitle}>4.2 Rechtsgrundlage</p>
            <p style={paragraph}>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>
            <p style={subSectionTitle}>4.3 Speicherdauer</p>
            <p style={paragraph}>
              Kontodaten werden fuer die Dauer des bestehenden Nutzerkontos gespeichert. Nach Loeschung des Nutzerkontos
              werden die zugehoerigen personenbezogenen Daten geloescht, soweit keine gesetzlichen Aufbewahrungspflichten
              entgegenstehen.
            </p>
            <p style={subSectionTitle}>4.4 Kontoloeschung</p>
            <p style={paragraph}>
              Sie koennen Ihr Nutzerkonto ueber die Anwendung loeschen. Mit der Kontoloeschung werden Ihr Nutzerkonto,
              zugehoerige Profildaten und die dem Konto zugeordneten Anwendungsdaten geloescht. In Backups oder Snapshots
              koennen Daten technisch bedingt noch fuer eine begrenzte Zeit vorhanden sein und werden mit der ueblichen
              Backup-Rotation ueberschrieben.
            </p>

            <h2 style={sectionTitle}>5. Verarbeitung hochgeladener Dokumente und Analyseergebnisse</h2>
            <p style={subSectionTitle}>5.1 Beschreibung</p>
            <p style={paragraph}>
              LV Scope ist ein Analysewerkzeug fuer Leistungsverzeichnisse und GAEB-Dateien. Nutzer koennen Dokumente
              hochladen, die durch unser System verarbeitet und analysiert werden. Diese Dokumente koennen projektbezogene
              Inhalte und im Einzelfall auch personenbezogene Daten enthalten, etwa Namen von Ansprechpartnern oder
              Projektverantwortlichen.
            </p>
            <p style={subSectionTitle}>5.2 Verarbeitungszweck</p>
            <p style={paragraph}>
              Die Verarbeitung erfolgt ausschliesslich zur Durchfuehrung der von Ihnen angeforderten Analyseleistung,
              insbesondere zur strukturierten Auswertung von Dokumentinhalten, zur Ableitung von Risiko- und
              Hinweisinformationen, zur Erstellung von Analyseergebnissen und zur Anzeige dieser Ergebnisse in Ihrem
              Nutzerkonto.
            </p>
            <p style={subSectionTitle}>5.3 Rechtsgrundlage</p>
            <p style={paragraph}>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>
            <p style={subSectionTitle}>5.4 Speicherung</p>
            <p style={paragraph}>
              Hochgeladene Dateien werden nicht dauerhaft als Dateien in einem separaten Dateispeicher vorgehalten. Die
              im Rahmen der Analyse erzeugten Analyseergebnisse werden jedoch Ihrem Nutzerkonto zugeordnet und in unserer
              Datenbank gespeichert. Dazu koennen insbesondere gehoeren:
            </p>
            <ul style={list}>
              <li style={listItem}>strukturierte Analyseergebnisse</li>
              <li style={listItem}>Key Facts</li>
              <li style={listItem}>Risikobewertungen</li>
              <li style={listItem}>Rueckfragen</li>
              <li style={listItem}>Angebotsannahmen bzw. Klarstellungen</li>
              <li style={listItem}>Management-Zusammenfassungen</li>
              <li style={listItem}>
                ggf. technische Diagnose- oder Auditinformationen, soweit diese fuer Betrieb und Nachvollziehbarkeit
                erforderlich sind
              </li>
            </ul>
            <p style={subSectionTitle}>5.5 Speicherdauer</p>
            <p style={paragraph}>
              Analyseergebnisse bleiben grundsaetzlich gespeichert, bis Sie einzelne Analysen oder Ihr Nutzerkonto
              loeschen, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Eine automatische Loeschung nach
              einer festen Frist ist derzeit nicht allgemein fuer alle Analyseergebnisse technisch umgesetzt.
            </p>

            <h2 style={sectionTitle}>6. Einsatz von KI-Diensten</h2>
            <p style={subSectionTitle}>6.1 Beschreibung</p>
            <p style={paragraph}>
              Zur Durchfuehrung bestimmter Analysefunktionen nutzen wir externe KI-Dienste, derzeit insbesondere OpenAI.
              Dabei koennen Inhalte aus hochgeladenen Dokumenten oder daraus abgeleitete Textsegmente an diesen Dienst
              uebermittelt werden, soweit dies fuer die angeforderte Analysefunktion erforderlich ist.
            </p>
            <p style={subSectionTitle}>6.2 Verarbeitete Datenarten</p>
            <p style={paragraph}>
              Je nach Funktion koennen insbesondere folgende Datenkategorien an den eingesetzten KI-Dienst uebermittelt
              werden:
            </p>
            <ul style={list}>
              <li style={listItem}>Dokumentinhalte aus LV-/GAEB-Dateien</li>
              <li style={listItem}>Textauszuege</li>
              <li style={listItem}>strukturierte Analysekontexte</li>
              <li style={listItem}>daraus erzeugte oder weiterverarbeitete Eingaben fuer Analysezwecke</li>
            </ul>
            <p style={subSectionTitle}>6.3 Rechtsgrundlage</p>
            <p style={paragraph}>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>
            <p style={subSectionTitle}>6.4 Hinweise</p>
            <p style={paragraph}>
              Die Uebermittlung erfolgt ausschliesslich zur Erbringung der angeforderten Analyseleistung. Eine Nutzung
              Ihrer Inhalte fuer andere Zwecke durch uns erfolgt nicht. Informationen zu eingesetzten
              Auftragsverarbeitern oder Unterauftragsverarbeitern stellen wir auf Anfrage zur Verfuegung.
            </p>

            <h2 style={sectionTitle}>7. Kontaktformular und E-Mail-Kontakt</h2>
            <p style={subSectionTitle}>7.1 Kontaktformular</p>
            <p style={paragraph}>
              Wenn Sie unser Kontaktformular verwenden, verarbeiten wir die von Ihnen eingegebenen Daten zur Bearbeitung
              Ihrer Anfrage. Hierzu koennen insbesondere gehoeren:
            </p>
            <ul style={list}>
              <li style={listItem}>Name</li>
              <li style={listItem}>E-Mail-Adresse</li>
              <li style={listItem}>Unternehmen</li>
              <li style={listItem}>Nachricht</li>
              <li style={listItem}>weitere freiwillige Angaben</li>
            </ul>
            <p style={paragraph}>Fuer den Versand der Kontaktanfragen per E-Mail nutzen wir Resend.</p>
            <p style={subSectionTitle}>7.2 Rechtsgrundlage</p>
            <p style={paragraph}>
              Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit es um vorvertragliche Anfragen geht, andernfalls
              Art. 6 Abs. 1 lit. f DSGVO.
            </p>
            <p style={subSectionTitle}>7.3 Speicherdauer</p>
            <p style={paragraph}>
              Kontaktanfragen werden nur so lange gespeichert oder in der E-Mail-Korrespondenz vorgehalten, wie dies zur
              Bearbeitung und Nachverfolgung erforderlich ist. Soweit keine gesetzlichen Aufbewahrungspflichten bestehen,
              erfolgt die Loeschung in der Regel innerhalb von 6 Monaten nach Abschluss der Anfrage. Eine starre
              automatische Loeschung nach exakt 6 Monaten ist derzeit nicht in allen Faellen technisch umgesetzt.
            </p>
            <p style={subSectionTitle}>7.4 Direkter E-Mail-Kontakt</p>
            <p style={paragraph}>
              Wenn Sie uns direkt per E-Mail kontaktieren, verarbeiten wir die von Ihnen mitgeteilten Daten ausschliesslich
              zur Bearbeitung Ihrer Anfrage.
            </p>

            <h2 style={sectionTitle}>8. Zahlungsabwicklung</h2>
            <p style={paragraph}>
              Soweit wir kostenpflichtige Leistungen anbieten und hierfuer externe Zahlungsdienstleister einsetzen, erfolgt
              die Zahlungsabwicklung ueber den jeweiligen Anbieter, derzeit insbesondere Stripe, sofern dieses
              Zahlungsmodell im konkreten Fall genutzt wird.
            </p>
            <p style={paragraph}>
              Wir speichern keine vollstaendigen Zahlungsdaten wie Kreditkartennummern. Es koennen jedoch
              abrechnungsbezogene Referenzdaten verarbeitet werden, z. B.:
            </p>
            <ul style={list}>
              <li style={listItem}>E-Mail-Adresse</li>
              <li style={listItem}>Kunden- oder Abo-ID</li>
              <li style={listItem}>Zahlungs- oder Rechnungsstatus</li>
              <li style={listItem}>tarifbezogene Informationen</li>
            </ul>
            <p style={paragraph}>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>

            <h2 style={sectionTitle}>9. Cookies und technisch notwendige Sitzungsdaten</h2>
            <p style={paragraph}>
              Wir verwenden technisch notwendige Cookies bzw. vergleichbare technische Mechanismen, soweit diese fuer den
              sicheren Betrieb der Website, die Authentifizierung und die Bereitstellung der Anwendung erforderlich sind.
            </p>
            <p style={paragraph}>Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.</p>
            <p style={paragraph}>
              Eine Nutzung externer Tracking- oder Analyse-Dienste zu Marketing- oder Reichweitenzwecken erfolgt derzeit
              nicht.
            </p>

            <h2 style={sectionTitle}>10. Analyse- und Trackingdienste</h2>
            <p style={paragraph}>
              Wir setzen derzeit keine externen Tracking- oder Webanalyse-Dienste wie etwa Google Analytics ein. Sollten
              solche Dienste kuenftig eingesetzt werden, werden wir diese Datenschutzerklaerung entsprechend aktualisieren
              und - soweit erforderlich - eine Einwilligung einholen.
            </p>

            <h2 style={sectionTitle}>11. Löschung und Aufbewahrung</h2>
            <p style={subSectionTitle}>11.1 Durch Nutzer ausloesbare Loeschung</p>
            <p style={paragraph}>Sie koennen:</p>
            <ul style={list}>
              <li style={listItem}>einzelne Analysen loeschen</li>
              <li style={listItem}>Ihr gesamtes Nutzerkonto loeschen</li>
            </ul>
            <p style={subSectionTitle}>11.2 Umfang der Loeschung</p>
            <p style={paragraph}>
              Bei Loeschung einer Analyse werden die zugehoerigen gespeicherten Analyseinformationen aus unseren aktiven
              Systemen entfernt. Bei Loeschung des Nutzerkontos werden das Nutzerkonto und die dem Konto zugeordneten
              Anwendungsdaten geloescht.
            </p>
            <p style={subSectionTitle}>11.3 Backups und externe Systeme</p>
            <p style={paragraph}>
              Daten koennen technisch bedingt noch fuer eine begrenzte Zeit in Backups oder Snapshots vorhanden sein.
              Soweit Daten an externe Dienstleister uebermittelt wurden, gelten zusaetzlich deren technische und
              vertragliche Rahmenbedingungen. Gesetzliche Aufbewahrungspflichten bleiben unberuehrt.
            </p>

            <h2 style={sectionTitle}>12. Empfänger und Kategorien von Empfängern</h2>
            <p style={paragraph}>
              Zur Bereitstellung unseres Angebots arbeiten wir mit technischen Dienstleistern zusammen. Dazu gehoeren
              insbesondere:
            </p>
            <ul style={list}>
              <li style={listItem}>Supabase fuer Authentifizierung und Datenbank</li>
              <li style={listItem}>Vercel fuer Hosting und Auslieferung der Anwendung</li>
              <li style={listItem}>OpenAI fuer bestimmte KI-Analysefunktionen</li>
              <li style={listItem}>Resend fuer den Versand von Kontakt-E-Mails</li>
              <li style={listItem}>Stripe, soweit Zahlungsabwicklung im konkreten Fall erfolgt</li>
            </ul>
            <p style={paragraph}>Eine Uebermittlung erfolgt nur, soweit sie fuer die jeweilige Leistung erforderlich ist.</p>

            <h2 style={sectionTitle}>13. Rechte der betroffenen Person</h2>
            <p style={paragraph}>
              Sie haben nach Massgabe der gesetzlichen Vorschriften insbesondere folgende Rechte:
            </p>
            <ul style={list}>
              <li style={listItem}>Recht auf Auskunft gemaess Art. 15 DSGVO</li>
              <li style={listItem}>Recht auf Berichtigung gemaess Art. 16 DSGVO</li>
              <li style={listItem}>Recht auf Loeschung gemaess Art. 17 DSGVO</li>
              <li style={listItem}>Recht auf Einschraenkung der Verarbeitung gemaess Art. 18 DSGVO</li>
              <li style={listItem}>Recht auf Datenuebertragbarkeit gemaess Art. 20 DSGVO</li>
              <li style={listItem}>Widerspruchsrecht gemaess Art. 21 DSGVO</li>
              <li style={listItem}>Recht auf Widerruf erteilter Einwilligungen gemaess Art. 7 Abs. 3 DSGVO</li>
            </ul>
            <p style={paragraph}>Zur Ausuebung Ihrer Rechte wenden Sie sich bitte an: datenschutz@lvscope.de</p>
            <p style={paragraph}>
              Ausserdem haben Sie das Recht, sich bei einer Datenschutzaufsichtsbehoerde zu beschweren.
            </p>

            <h2 style={sectionTitle}>14. Datensicherheit</h2>
            <p style={paragraph}>
              Wir setzen angemessene technische und organisatorische Massnahmen ein, um personenbezogene Daten vor Verlust,
              Manipulation und unberechtigtem Zugriff zu schuetzen. Die Uebertragung zwischen Browser und unseren Systemen
              erfolgt verschluesselt ueber HTTPS/TLS.
            </p>

            <h2 style={sectionTitle}>15. Aktualität und Änderung dieser Datenschutzerklärung</h2>
            <p style={paragraph}>
              Wir behalten uns vor, diese Datenschutzerklaerung anzupassen, wenn sich technische, rechtliche oder
              organisatorische Rahmenbedingungen aendern. Es gilt jeweils die auf unserer Website veroeffentlichte aktuelle
              Fassung.
            </p>

            <p style={{ marginTop: 32, fontSize: 13, color: T.faint, textAlign: "center" }}>
              LV Scope | lvscope.de | Stand: April 2026
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
