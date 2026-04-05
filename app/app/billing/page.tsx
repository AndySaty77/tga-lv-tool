import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutProButton } from "@/components/app/CheckoutProButton";
import { appTheme as T } from "@/components/app/appTheme";
import { getUser } from "@/lib/auth/get-user";
import type { PlanId } from "@/lib/billing/plans";
import { getUserPlan } from "@/lib/billing/userPlan";
import { getTotalUsageForPlan, type TotalUsageInfo } from "@/lib/billing/usage";

export const metadata = {
  title: "Billing – LV Scope",
  description: "Plan, Nutzung und Abrechnung.",
};

function BillingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        background: T.card,
        padding: T.space.lg,
        marginBottom: T.space.lg,
      }}
    >
      <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 14, fontWeight: 700, color: T.text }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function linkButtonStyle(accent: "primary" | "muted"): React.CSSProperties {
  if (accent === "primary") {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 13,
      fontWeight: 600,
      color: T.accent,
      textDecoration: "none",
      padding: "8px 12px",
      borderRadius: T.radiusSm,
      border: `1px solid ${T.border}`,
      background: "rgba(56,189,248,0.06)",
    };
  }
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: T.muted,
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: T.radiusSm,
    border: `1px solid ${T.border}`,
    background: "rgba(255,255,255,0.02)",
  };
}

export default async function AppBillingPage() {
  const user = await getUser().catch(() => null);
  if (!user) {
    redirect("/login?redirectTo=/app/billing");
  }

  let plan: PlanId = "free";
  let usage: TotalUsageInfo | null = null;
  try {
    plan = await getUserPlan();
    usage = await getTotalUsageForPlan(user.id, plan);
  } catch {
    plan = "free";
    usage = null;
  }

  const isPro = plan === "pro";

  return (
    <>
      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Billing
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
          Plan, Nutzung und künftige Verwaltung von Abonnement und Rechnungen.
        </p>
      </div>

      {isPro ? (
        <>
          <BillingCard title="Aktueller Plan">
            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Sie nutzen den <span style={{ fontWeight: 600, color: T.text }}>Pro-Plan</span> mit den
              zugehörigen Funktionen und unbegrenzten Analysen.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Self-Service für Abrechnung, Zahlungsmittel und Rechnungen wird hier in Kürze ergänzt –
              ohne dass sich Ihr Zugang ändert.
            </p>
          </BillingCard>

          <BillingCard title="Nächste Schritte">
            <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Bis die Verwaltung direkt hier verfügbar ist, erreichen Sie uns bei Fragen zum Vertrag oder zur
              Abrechnung über den Kontakt.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/app" style={linkButtonStyle("primary")}>
                Zur App
              </Link>
              <Link href="/pricing" style={linkButtonStyle("muted")}>
                Preise &amp; Leistungen
              </Link>
              <Link href="/contact?topic=team" style={linkButtonStyle("muted")}>
                Kontakt
              </Link>
            </div>
          </BillingCard>
        </>
      ) : (
        <>
          <BillingCard title="Aktueller Plan">
            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Sie nutzen den <span style={{ fontWeight: 600, color: T.text }}>Free-Plan</span> mit den
              enthaltenen Funktionen und einem begrenzten Kontingent kostenloser Analysen.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Mit Pro erhalten Sie unbegrenzte Analysen und die erweiterten Auswertungen – ideal für regelmäßige
              LV-Prüfung im Berufsalltag.
            </p>
          </BillingCard>

          <BillingCard title="Nutzung (kostenlose Analysen)">
            {usage ? (
              usage.limit == null ? (
                <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
                  Unbegrenzte Analysen (Pro).
                </p>
              ) : (
                <>
                  <p style={{ margin: "0 0 4px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
                    <span style={{ fontWeight: 600, color: T.text }}>{usage.used}</span> von{" "}
                    <span style={{ fontWeight: 600, color: T.text }}>{usage.limit}</span> kostenlosen Analysen
                    verbraucht.
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
                    {usage.remaining != null && usage.remaining > 0
                      ? `Noch ${usage.remaining} Analyse${usage.remaining === 1 ? "" : "n"} verfügbar.`
                      : "Kontingent verbraucht. Weitere Analysen sind nur mit Pro möglich."}
                  </p>
                </>
              )
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
                Nutzungsdaten konnten nicht geladen werden.
              </p>
            )}
          </BillingCard>

          <BillingCard title="Upgrade">
            <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Pro-Abonnement (monatlich) über Stripe: Nach erfolgreicher Zahlung wird Ihr Plan in der Datenbank auf
              Pro gesetzt (über Webhook). Details und Vergleich finden Sie weiter auf der Preisseite.
            </p>
            <CheckoutProButton />
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/pricing" style={linkButtonStyle("muted")}>
                Preise &amp; Leistungen
              </Link>
              <Link href="/app/analyse" style={linkButtonStyle("muted")}>
                Zur Analyse
              </Link>
            </div>
          </BillingCard>
        </>
      )}

      <BillingCard title="Team & Organisation">
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
          Für mehrere Nutzer, Kontingente oder Organisationen gibt es individuelle Lösungen – kein separater
          Plan in der Oberfläche.{" "}
          <Link href="/contact?topic=team" style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}>
            Team-Lösung anfragen
          </Link>
        </p>
      </BillingCard>
    </>
  );
}
