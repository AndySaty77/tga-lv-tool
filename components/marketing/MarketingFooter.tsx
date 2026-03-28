import Link from "next/link";
import React from "react";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "./MarketingTheme";

const groupTitle = {
  fontSize: 12,
  fontWeight: 800,
  color: T.text,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};
const linkBlock = { marginTop: 10, display: "grid", gap: 8 };

export function MarketingFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${T.border}`, marginTop: 64 }}>
      <Container style={{ paddingTop: 28, paddingBottom: 32 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 24,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: T.text, letterSpacing: "-0.01em", fontSize: 15 }}>LV Scope</div>
            <p style={{ margin: "10px 0 0", color: T.muted, fontSize: 13, lineHeight: 1.55, maxWidth: 320 }}>
              KI-gestützte LV-/GAEB-Analyse für TGA-Angebote. Risiken, Rückfragen und Nachtragspotenzial strukturiert – für Kalkulation, Projektleitung und Freigabe.
            </p>
          </div>

          <div>
            <div style={groupTitle}>Produkt</div>
            <nav style={linkBlock} aria-label="Produkt">
              <Link href="/features" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Features</Link>
              <Link href="/how-it-works" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Ablauf</Link>
              <Link href="/docs" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>So funktioniert's</Link>
              <Link href="/pricing" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Preise</Link>
              <Link href="/faq" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>FAQ</Link>
            </nav>
          </div>

          <div>
            <div style={groupTitle}>Rechtliches</div>
            <nav style={linkBlock} aria-label="Rechtliches">
              <Link href="/datenschutz" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Datenschutz</Link>
              <Link href="/agb" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>AGB</Link>
              <Link href="/impressum" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Impressum</Link>
            </nav>
          </div>

          <div>
            <div style={groupTitle}>Zugang</div>
            <nav style={linkBlock} aria-label="Zugang">
              <Link href="/login" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Login</Link>
              <Link href="/app/analyse" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Analyse starten</Link>
            </nav>
          </div>
        </div>

        <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
          <span style={{ color: T.faint, fontSize: 12 }}>© {new Date().getFullYear()} LV Scope</span>
        </div>
      </Container>
    </footer>
  );
}
