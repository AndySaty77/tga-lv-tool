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
        background: highlighted ? "rgba(56,189,248,0.08)" : "rgba(255,255,255,0.03)",
        padding: 18,
        boxShadow: "0 16px 40px rgba(15,23,42,0.65)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 950, color: T.text }}>{name}</div>
        {highlighted && (
          <span style={{ fontSize: 12, fontWeight: 900, color: "#020617", padding: "6px 10px", borderRadius: 999, background: T.brand }}>
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
            color: highlighted ? "#020617" : T.text,
            padding: "10px 14px",
            borderRadius: 12,
            background: highlighted ? T.brand : "rgba(255,255,255,0.03)",
            border: highlighted ? "1px solid transparent" : `1px solid ${T.border}`,
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

  return (
    <MarketingPageShell active="/pricing">
      <MarketingSection
        eyebrow="Preise"
        title="Einfache Pläne für Ihre LV-Analysen"
        lead="Starten Sie mit dem Free-Plan oder schalten Sie mit Pro unbegrenzte Analysen und erweiterte Auswertungen frei."
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

          {/* Free / Pro Karten */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <PriceCard
              name={plan === "free" ? "Free (aktuell)" : "Free"}
              price="0 €"
              subtitle="Für Nutzer, die erste LV-Analysen im Alltag ausprobieren möchten."
              items={[
                "3 Analysen pro Monat",
                "Dashboard mit Kennzahlen",
                "Analyse-Archiv / gespeicherte Ergebnisse",
                "Management-Zusammenfassung",
                "Basis-Risikoanalyse und Ergebnisansicht",
              ]}
              ctaHref={plan === "free" ? "/analyse" : "/login"}
              ctaLabel={plan === "free" ? "Mit Free weiter analysieren" : "Kostenlos starten"}
            />
            <PriceCard
              name={plan === "pro" ? "Pro (aktuell)" : "Pro"}
              price="ab X € / Monat"
              subtitle="Für Teams, die LV-Analysen regelmäßig und mit voller Funktionsbreite einsetzen möchten."
              items={[
                "Unbegrenzte Analysen pro Monat",
                "Vollständige Analyse mit vertiefter Auswertung",
                "Erweiterte Risiko- und Nachtragsanalyse (Pro-Funktionen)",
                "Rückfragen / Klarstellungen und Angebotsstrategien",
                "PDF-Export (bald verfügbar)",
              ]}
              ctaHref={plan === "pro" ? "/analyse" : "/login"}
              ctaLabel={plan === "pro" ? "Pro nutzen" : "Upgrade bald verfügbar"}
              highlighted
            />
          </div>

          {/* Feature-Vergleich */}
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
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    <th style={{ textAlign: "left", padding: 12, color: T.faint, fontSize: 12 }}>Feature</th>
                    <th style={{ textAlign: "center", padding: 12, color: T.faint, fontSize: 12 }}>Free</th>
                    <th style={{ textAlign: "center", padding: 12, color: T.faint, fontSize: 12 }}>Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Analysen pro Monat", free: "3", pro: "unbegrenzt" },
                    { label: "Dashboard", free: "inklusive", pro: "inklusive" },
                    { label: "Analyse-Archiv", free: "inklusive", pro: "inklusive" },
                    { label: "Management-Zusammenfassung", free: "inklusive", pro: "inklusive" },
                    { label: "Risikoanalyse", free: "Basis", pro: "Erweitert" },
                    { label: "Rückfragen / Klarstellungen", free: "inklusive", pro: "inklusive" },
                    { label: "Nachtragspotenzial (Pro-Funktionen)", free: "eingeschränkt", pro: "vollständig" },
                    { label: "PDF-Export", free: "nicht verfügbar", pro: "bald verfügbar" },
                  ].map((row) => (
                    <tr key={row.label} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: 10, color: T.text }}>{row.label}</td>
                      <td style={{ padding: 10, textAlign: "center", color: T.muted }}>{row.free}</td>
                      <td style={{ padding: 10, textAlign: "center", color: T.muted }}>{row.pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Container>
      </MarketingSection>
    </MarketingPageShell>
  );
}


