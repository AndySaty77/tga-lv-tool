import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";

export const metadata = {
  title: "Preise – TGA LV Tool",
  description: "Preismodell (Platzhalter) für LV-/GAEB-Analyse. Fokus: Team-Nutzung und nachvollziehbare Ergebnisse.",
};

function PriceCard({
  name,
  price,
  subtitle,
  items,
  ctaHref,
  ctaLabel,
  highlighted,
}: {
  name: string;
  price: string;
  subtitle: string;
  items: string[];
  ctaHref: string;
  ctaLabel: string;
  highlighted?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${T.border}`,
        background: highlighted ? "linear-gradient(180deg, rgba(94,234,212,0.10), rgba(255,255,255,0.03))" : "rgba(255,255,255,0.03)",
        padding: 18,
        boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 950, color: T.text }}>{name}</div>
        {highlighted && (
          <span style={{ fontSize: 12, fontWeight: 900, color: "#06121a", padding: "6px 10px", borderRadius: 999, background: `linear-gradient(90deg, ${T.brand}, ${T.brand2})` }}>
            empfohlen
          </span>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 34, fontWeight: 950, letterSpacing: "-0.03em" }}>{price}</div>
      <div style={{ marginTop: 6, color: T.muted, fontSize: 13, lineHeight: 1.6 }}>{subtitle}</div>
      <ul style={{ margin: "14px 0 0", paddingLeft: 18, color: T.muted, fontSize: 13, lineHeight: 1.85 }}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <div style={{ marginTop: 16 }}>
        <Link
          href={ctaHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 900,
            color: highlighted ? "#06121a" : T.text,
            padding: "10px 14px",
            borderRadius: 12,
            background: highlighted ? `linear-gradient(90deg, ${T.brand}, ${T.brand2})` : "rgba(255,255,255,0.03)",
            border: highlighted ? "1px solid transparent" : `1px solid ${T.border}`,
          }}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <MarketingPageShell active="/pricing">
      <MarketingSection
        eyebrow="Preise"
        title="Transparentes Modell für B2B-Teams"
        lead="Platzhalter-Seite: Preise und Pakete sollten an Zielkunden, Datenhaltung und Compliance-Anforderungen angepasst werden. Inhaltlich geht es um Team-Nutzung und nachvollziehbare Ergebnisse."
      >
        <Container>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <PriceCard
              name="Pilot"
              price="auf Anfrage"
              subtitle="Für Teams, die das Tool in echten Angebotsprozessen evaluieren wollen."
              items={[
                "Gemeinsame Einrichtung (Scope + Checkliste)",
                "Analyse via /analyse",
                "Feedback-Loop für Output-Qualität",
              ]}
              ctaHref="/analyse"
              ctaLabel="Analyse testen"
            />
            <PriceCard
              name="Team"
              price="ab X €/Monat"
              subtitle="Für Angebots-Teams mit wiederkehrenden LV-Prüfungen und klaren Workflows."
              items={[
                "Mehrbenutzer (später: Login/Organisation)",
                "Management Summary, Rückfragen, Klarstellungen, Nachtragspotenzial",
                "Admin-Parameter (Scoring/Texts) wie heute",
              ]}
              ctaHref="/login"
              ctaLabel="Interesse anmelden"
              highlighted
            />
            <PriceCard
              name="Enterprise"
              price="individuell"
              subtitle="Für größere Organisationen (Governance, Audit, Integrationen)."
              items={[
                "SSO / Rollen / Audit (später)",
                "Integrationen & Exporte",
                "SLA & Support",
              ]}
              ctaHref="/docs"
              ctaLabel="Technik ansehen"
            />
          </div>

          <div style={{ marginTop: 16, color: T.faint, fontSize: 12, lineHeight: 1.6, maxWidth: 920 }}>
            Hinweis: Diese Preisseite ist bewusst konservativ formuliert. Für ein echtes SaaS-Angebot sollten Datenschutz, Datenfluss, Hosting-Optionen und Rollenmodell vorab fachlich geklärt werden.
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}

