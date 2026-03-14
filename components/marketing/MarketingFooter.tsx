import Link from "next/link";
import React from "react";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "./MarketingTheme";

export function MarketingFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${T.border}`, marginTop: 64 }}>
      <Container style={{ paddingTop: 28, paddingBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 18 }}>
          <div>
            <div style={{ fontWeight: 900, color: T.text, letterSpacing: "-0.01em" }}>LV Scope</div>
            <p style={{ margin: "10px 0 0", color: T.muted, fontSize: 13, lineHeight: 1.6, maxWidth: 440 }}>
              KI-gestützte LV-/GAEB-Analyse für TGA-Angebote: Risiken erkennen, Rückfragen ableiten, Klarstellungen formulieren und Nachtragspotenzial managementtauglich zusammenfassen.
            </p>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>Produkt</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <Link href="/features" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Features</Link>
              <Link href="/how-it-works" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Ablauf</Link>
              <Link href="/pricing" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Preise</Link>
              <Link href="/faq" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>FAQ</Link>
              <Link href="/docs" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Docs</Link>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>Start</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <Link href="/app/analyse" style={{ color: T.muted, textDecoration: "none", fontSize: 13 }}>Analyse starten</Link>
              <Link href="/app" style={{ color: T.faint, textDecoration: "none", fontSize: 13 }}>App (bald)</Link>
              <Link href="/login" style={{ color: T.faint, textDecoration: "none", fontSize: 13 }}>Login (Platzhalter)</Link>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: T.faint, fontSize: 12 }}>© {new Date().getFullYear()} LV Scope</span>
          <span style={{ color: T.faint, fontSize: 12 }}>
            Analyse starten über App; Marketingseiten öffentlich.
          </span>
        </div>
      </Container>
    </footer>
  );
}

