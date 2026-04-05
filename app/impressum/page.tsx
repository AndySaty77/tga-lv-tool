import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "Impressum – LV Scope",
  description: "Impressum und Anbieterkennzeichnung für LV Scope (lvscope.de).",
};

const sectionTitle = {
  fontSize: 18,
  fontWeight: 700,
  color: T.text,
  marginTop: 28,
  marginBottom: 12,
} as const;

const blockHead = {
  fontSize: 15,
  fontWeight: 600,
  color: T.text,
  marginTop: 22,
  marginBottom: 8,
} as const;

const paragraph = { fontSize: 14, lineHeight: 1.75, color: T.muted, marginBottom: 6 };
const placeholder = { fontSize: 14, lineHeight: 1.75, color: T.faint, fontStyle: "italic" as const };

export default function ImpressumPage() {
  return (
    <MarketingPageShell active="/impressum">
      <MarketingSection
        eyebrow="Rechtliches"
        title="Impressum"
        lead="LV Scope – lvscope.de | Stand: März 2026"
      >
        <Container>
          <div style={{ maxWidth: 720, marginBottom: 48 }}>
            <p style={{ ...paragraph, marginBottom: 20, fontSize: 13, color: T.faint }}>
              Die folgenden Angaben sind Platzhalter – bitte durch Ihre Firmendaten ersetzen.
            </p>
            <h2 style={{ ...sectionTitle, marginTop: 0 }}>Angaben gemäß § 5 DDG</h2>
            <p style={placeholder}>[Firmenname / vollständige Firmierung]</p>
            <p style={{ ...placeholder, marginBottom: 14 }}>
              [Rechtsform, z. B. GmbH / UG (haftungsbeschränkt) / Einzelunternehmen / e.K.]
            </p>

            <h3 style={blockHead}>Vertreten durch:</h3>
            <p style={placeholder}>[Vorname Nachname]</p>
            <p style={{ ...placeholder, marginBottom: 14 }}>
              [Funktion, z. B. Geschäftsführer / Inhaber]
            </p>

            <h3 style={blockHead}>Anschrift:</h3>
            <p style={placeholder}>[Straße Hausnummer]</p>
            <p style={placeholder}>[PLZ Ort]</p>
            <p style={{ ...placeholder, marginBottom: 14 }}>[Land]</p>

            <h3 style={blockHead}>Kontakt:</h3>
            <p style={placeholder}>Telefon: [Telefonnummer]</p>
            <p style={{ ...placeholder, marginBottom: 14 }}>E-Mail: [E-Mail-Adresse]</p>

            <h3 style={blockHead}>Registereintrag</h3>
            <p style={{ ...paragraph, marginBottom: 6 }}>
              <span style={{ color: T.muted }}>Nur falls vorhanden – sonst diesen Abschnitt entfernen oder anpassen:</span>
            </p>
            <p style={{ ...placeholder, marginBottom: 0 }}>
              [Registergericht, Registernummer, USt-IdNr. – je nach Erfordernis]
            </p>

            <p style={{ marginTop: 32, fontSize: 13, color: T.faint, textAlign: "center" }}>
              LV Scope | lvscope.de
            </p>
            <p style={{ marginTop: 16, fontSize: 12, color: T.faint, textAlign: "center" }}>
              <Link href="/datenschutz" style={{ color: T.muted, textDecoration: "underline" }}>
                Datenschutz
              </Link>
              {" · "}
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
