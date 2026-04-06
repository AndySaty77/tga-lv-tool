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
            <h2 style={{ ...sectionTitle, marginTop: 0 }}>Angaben gemäß § 5 DDG</h2>
            <p style={{ ...paragraph, marginBottom: 4 }}>Tanja Sauer</p>
            <p style={{ ...paragraph, marginBottom: 4 }}>Hofwiesen 31</p>
            <p style={{ ...paragraph, marginBottom: 4 }}>72348 Rosenfeld</p>
            <p style={{ ...paragraph, marginBottom: 14 }}>Deutschland</p>

            <h3 style={blockHead}>Kontakt</h3>
            <p style={paragraph}>
              Telefon:{" "}
              <a href="tel:+491606798271" style={{ color: T.brand, textDecoration: "none", fontWeight: 600 }}>
                01606798271
              </a>
            </p>
            <p style={{ ...paragraph, marginBottom: 14 }}>
              E-Mail:{" "}
              <a href="mailto:support@lvscope.de" style={{ color: T.brand, textDecoration: "none", fontWeight: 600 }}>
                support@lvscope.de
              </a>
            </p>

            <h2 style={sectionTitle}>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <p style={{ ...paragraph, marginBottom: 0 }}>Tanja Sauer</p>

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
