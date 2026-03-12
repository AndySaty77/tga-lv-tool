import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "Login – TGA LV Tool",
  description: "Platzhalter für Login/Registrierung (SaaS-Produktisierung).",
};

export default function LoginPage() {
  return (
    <MarketingPageShell>
      <MarketingSection
        eyebrow="SaaS"
        title="Login / Registrierung (Platzhalter)"
        lead="Dieser Bereich ist vorbereitet, aber noch nicht implementiert. Die produktive Analyse ist weiterhin ohne Login unter /analyse verfügbar."
      >
        <Container>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.03)", maxWidth: 820 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>Nächste Schritte für Auth (später)</div>
            <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: T.muted, fontSize: 13, lineHeight: 1.85 }}>
              <li>Organisationen/Teams, Rollen (z. B. Viewer/Editor/Admin)</li>
              <li>Schutz für `/app/*` per Middleware</li>
              <li>Audit/Logging je Analyse (optional)</li>
            </ul>
            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/analyse"
                style={{
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#020617",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: T.brand,
                  border: "1px solid transparent",
                }}
              >
                Zur Analyse →
              </Link>
              <Link href="/" style={{ textDecoration: "none", fontSize: 13, fontWeight: 800, color: T.text, padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" }}>
                Zur Landing
              </Link>
            </div>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}

