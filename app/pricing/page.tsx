import React from "react";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { Container } from "@/components/shared/Container";
import { marketingTheme as T } from "@/components/marketing/MarketingTheme";
import { getUserPlan } from "@/lib/billing/userPlan";

export const metadata = {
  title: "Preise – TGA LV Tool",
  description: "Einfache Free- und Pro-Pläne für die LV-Analyse.",
};

type PlanDefinition = {
  id: "free" | "pro" | "team";
  name: string;
  price: string;
  priceSubline?: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
  badge?: string;
  isContactPlan?: boolean;
};

function PriceCard({
  name,
  price,
  priceSubline,
  description,
  features,
  ctaHref,
  ctaLabel,
  featured,
  badge,
  isContactPlan,
}: Omit<PlanDefinition, "id">) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 20,
        border: `1px solid ${T.border}`,
        background: featured ? "rgba(56,189,248,0.08)" : "rgba(255,255,255,0.03)",
        padding: 18,
        boxShadow: "0 16px 40px rgba(15,23,42,0.65)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 950, color: T.text }}>{name}</div>
        {badge && (
          <span style={{ fontSize: 12, fontWeight: 900, color: "#020617", padding: "6px 10px", borderRadius: 999, background: T.brand }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: isContactPlan ? 16 : 34, fontWeight: 950, letterSpacing: isContactPlan ? "-0.01em" : "-0.03em" }}>
        {price}
      </div>
      {priceSubline && (
        <div style={{ marginTop: 4, color: T.muted, fontSize: 12, lineHeight: 1.5 }}>
          {priceSubline}
        </div>
      )}
      <div style={{ marginTop: 6, color: T.muted, fontSize: 13, lineHeight: 1.6 }}>{description}</div>
      <ul style={{ margin: "14px 0 0", paddingLeft: 18, color: T.muted, fontSize: 13, lineHeight: 1.85 }}>
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <Link
          href={ctaHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 900,
            color: featured ? "#020617" : T.text,
            padding: "10px 14px",
            borderRadius: 12,
            background: featured ? T.brand : "rgba(255,255,255,0.03)",
            border: featured ? "1px solid transparent" : `1px solid ${T.border}`,
          }}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

export default async function PricingPage() {
  const plan = await getUserPlan().catch(() => "free" as const);

  const plans: PlanDefinition[] = [
    {
      id: "free",
      name: "Free",
      price: "0 €",
      description: "Für den Einstieg und erste Tests im Arbeitsalltag.",
      features: ["3 Analysen", "Basis-Ergebnisansicht", "Basis-Risikoanalyse", "Management-Zusammenfassung", "Analyse-Archiv"],
      ctaHref: "/register",
      ctaLabel: "Kostenlos starten",
      featured: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: "79 € / Monat",
      description:
        "Für Unternehmen, die Leistungsverzeichnisse regelmäßig fundiert prüfen, Risiken erkennen und Angebote sauber absichern wollen.",
      features: [
        "Unbegrenzte Analysen",
        "Vollständige Analyse mit erweiterten Auswertungen",
        "Vertiefte Risiko- und Nachtragsanalyse",
        "Rückfragen / Klarstellungen / Angebotsstrategie",
        "Analyse-Archiv",
        "PDF-Export",
      ],
      ctaHref: "/register",
      ctaLabel: "Pro wählen",
      featured: true,
      badge: "Empfohlen",
    },
    {
      id: "team",
      name: "Team",
      price: "Individuelle Anfrage",
      description: "Für Unternehmen, Planungsbüros und größere Teams mit mehreren Nutzern.",
      features: [
        "Alle Pro-Funktionen",
        "Mehrere Nutzer",
        "Individuelle Kontingente",
        "Perspektivisch Team- und Organisationsfunktionen",
        "Priorisierter Support / individuelle Abstimmung",
        "PDF-Export",
      ],
      ctaHref: "/contact",
      ctaLabel: "Anfrage senden",
      featured: false,
      isContactPlan: true,
    },
  ];

  return (
    <MarketingPageShell active="/pricing">
      <MarketingSection
        eyebrow="Preise"
        title="Das passende Modell für Ihre LV-Prüfung"
        lead="Vom Einstieg bis zur regelmäßigen LV-Prüfung im Team – wählen Sie den passenden Plan für Ausschreibung, Kalkulation und Risikobewertung."
      >
        <Container>
          {/* Aktueller Plan */}
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: "rgba(15,23,42,0.7)",
              fontSize: 13,
              color: T.muted,
            }}
          >
            <span style={{ fontWeight: 600, color: T.text }}>Aktueller Plan:</span>{" "}
            <span style={{ fontWeight: 600, color: T.text }}>
              {plan === "pro" ? "Pro" : "Free"}
            </span>
          </div>

          {/* Pricing-Karten */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {plans.map((p) => (
              <PriceCard
                key={p.id}
                name={p.name}
                price={p.price}
                priceSubline={p.priceSubline}
                description={p.description}
                features={p.features}
                ctaHref={p.ctaHref}
                ctaLabel={p.ctaLabel}
                featured={p.featured}
                badge={p.badge}
                isContactPlan={p.isContactPlan}
              />
            ))}
          </div>

          {/* Vergleichsmatrix */}
          <div style={{ marginTop: 32 }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 14,
                fontWeight: 700,
                color: T.text,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Funktionsübersicht
            </h2>
            <div
              style={{
                borderRadius: 16,
                border: `1px solid ${T.border}`,
                background: "rgba(15,23,42,0.7)",
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr repeat(3, 1fr)",
                  gap: 4,
                  fontSize: 12,
                }}
              >
                {/* Header */}
                <div style={{ padding: 8, color: T.faint }}>Funktion</div>
                <div style={{ padding: 8, textAlign: "center", color: T.faint }}>Free</div>
                <div style={{ padding: 8, textAlign: "center", color: T.faint }}>Pro</div>
                <div style={{ padding: 8, textAlign: "center", color: T.faint }}>Team</div>

                {[
                  {
                    label: "Analysen pro Monat",
                    free: "3",
                    pro: "unbegrenzt",
                    team: "individuell",
                  },
                  {
                    label: "Basis-Ergebnisansicht",
                    free: "ja",
                    pro: "ja",
                    team: "ja",
                  },
                  {
                    label: "Erweiterte Auswertungen",
                    free: "–",
                    pro: "ja",
                    team: "ja",
                  },
                  {
                    label: "Risikoanalyse",
                    free: "Basis",
                    pro: "Erweitert",
                    team: "Erweitert",
                  },
                  {
                    label: "Nachtragsanalyse",
                    free: "–",
                    pro: "ja",
                    team: "ja",
                  },
                  {
                    label: "Rückfragen / Klarstellungen",
                    free: "–",
                    pro: "ja",
                    team: "ja",
                  },
                  {
                    label: "Angebotsstrategie",
                    free: "–",
                    pro: "ja",
                    team: "ja",
                  },
                  {
                    label: "PDF-Export",
                    free: "–",
                    pro: "ja",
                    team: "ja",
                  },
                  {
                    label: "Mehrere Nutzer",
                    free: "–",
                    pro: "–",
                    team: "ja",
                  },
                  {
                    label: "Individuelle Kontingente",
                    free: "–",
                    pro: "–",
                    team: "ja",
                  },
                ].map((row) => (
                  <React.Fragment key={row.label}>
                    <div
                      style={{
                        padding: 8,
                        borderTop: `1px solid ${T.border}`,
                        color: T.text,
                      }}
                    >
                      {row.label}
                    </div>
                    <div
                      style={{
                        padding: 8,
                        borderTop: `1px solid ${T.border}`,
                        textAlign: "center",
                        color: T.muted,
                      }}
                    >
                      {row.free}
                    </div>
                    <div
                      style={{
                        padding: 8,
                        borderTop: `1px solid ${T.border}`,
                        textAlign: "center",
                        color: T.muted,
                      }}
                    >
                      {row.pro}
                    </div>
                    <div
                      style={{
                        padding: 8,
                        borderTop: `1px solid ${T.border}`,
                        textAlign: "center",
                        color: T.muted,
                      }}
                    >
                      {row.team}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}


