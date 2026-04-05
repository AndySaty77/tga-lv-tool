import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingPortalButton } from "@/components/app/BillingPortalButton";
import { CheckoutProButton } from "@/components/app/CheckoutProButton";
import { appTheme as T } from "@/components/app/appTheme";
import { getBillingProfileFields } from "@/lib/billing/billingProfile";
import type { PlanId } from "@/lib/billing/plans";
import { getUserPlan } from "@/lib/billing/userPlan";
import { getTotalUsageForPlan, type TotalUsageInfo } from "@/lib/billing/usage";
import { getUser } from "@/lib/auth/get-user";

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

function formatPeriodEnd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
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

  const billing = await getBillingProfileFields(user.id);
  const billingLoadFailed = billing === null;
  const hasStripeCustomer = !!billing?.stripe_customer_id;
  const bs = billing?.billing_status ?? null;
  const periodEndLabel = formatPeriodEnd(billing?.billing_current_period_end ?? null);
  const cancelAtPeriodEnd = billing?.billing_cancel_at_period_end === true;

  const isPro = plan === "pro";
  const paymentIssuePro =
    isPro && hasStripeCustomer && (bs === "past_due" || bs === "unpaid");
  const proCanceling =
    isPro &&
    hasStripeCustomer &&
    !paymentIssuePro &&
    cancelAtPeriodEnd &&
    (bs === "active" || bs === "trialing");
  const proActiveStripe = isPro && hasStripeCustomer && !paymentIssuePro && !proCanceling;

  const freeUnpaidStripe =
    !isPro && hasStripeCustomer && bs === "unpaid";

  return (
    <>
      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Billing
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
          Monatliches Pro-Abo über Stripe. Kündigung wirkt zum Ende des laufenden Abrechnungszeitraums – bis dahin bleibt der
          vereinbarte Zugang bestehen. Zahlungsdaten, Rechnungen und Abo-Verwaltung erfolgen im Stripe-Kundenportal.
        </p>
      </div>

      {!isPro && freeUnpaidStripe ? (
        <BillingCard title="Zahlung">
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#fecaca", lineHeight: 1.65 }}>
            Für Ihr Abonnement liegt ein Zahlungsproblem vor. Bitte aktualisieren Sie die Zahlungsdaten oder klären Sie den
            offenen Betrag im Kundenportal. Nach erfolgreicher Zahlung stellt Stripe Ihr Abo wieder her.
          </p>
          <BillingPortalButton label="Zahlung und Abrechnung prüfen" variant="primary" />
        </BillingCard>
      ) : null}

      {billingLoadFailed && isPro ? (
        <BillingCard title="Abrechnung">
          <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
            Abrechnungsdaten konnten nicht geladen werden (Server-Konfiguration). Bitte später erneut öffnen oder den Support
            informieren, falls das weiterhin auftritt.
          </p>
        </BillingCard>
      ) : null}

      {isPro && !billingLoadFailed && !hasStripeCustomer ? (
        <>
          <BillingCard title="Aktueller Plan">
            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Sie nutzen <span style={{ fontWeight: 600, color: T.text }}>Pro</span> mit unbegrenzten Analysen und den
              erweiterten Funktionen. Für dieses Konto ist kein Stripe-Abrechnungskonto hinterlegt – die Verwaltung über das
              Kundenportal steht hier nicht zur Verfügung.
            </p>
          </BillingCard>
          <BillingCard title="Weiter">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/app" style={linkButtonStyle("primary")}>
                Zur App
              </Link>
              <Link href="/pricing" style={linkButtonStyle("muted")}>
                Preise &amp; Leistungen
              </Link>
            </div>
          </BillingCard>
        </>
      ) : null}

      {!billingLoadFailed && paymentIssuePro ? (
        <>
          <BillingCard title="Aktueller Plan">
            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Plan: <span style={{ fontWeight: 600, color: T.text }}>Pro</span>
              {periodEndLabel ? (
                <>
                  {" "}
                  · nächste Abrechnung / Zeitraum bis:{" "}
                  <span style={{ fontWeight: 600, color: T.text }}>{periodEndLabel}</span>
                </>
              ) : null}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#fecaca", lineHeight: 1.65 }}>
              {bs === "past_due"
                ? "Die letzte Zahlung ist fehlgeschlagen oder ausstehend. Bitte beheben Sie das im Kundenportal, damit Ihr Pro-Zugang erhalten bleibt."
                : "Es besteht ein Problem mit der Zahlung. Bitte prüfen Sie die Abrechnung im Kundenportal."}
            </p>
          </BillingCard>
          <BillingCard title="Abrechnung">
            <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Zahlungsmittel aktualisieren, Rechnungen einsehen und das Abo verwalten – alles über Stripe.
            </p>
            <BillingPortalButton label="Abrechnung verwalten (Stripe)" />
          </BillingCard>
        </>
      ) : !billingLoadFailed && proCanceling ? (
        <>
          <BillingCard title="Aktueller Plan">
            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Plan: <span style={{ fontWeight: 600, color: T.text }}>Pro</span> · Status:{" "}
              <span style={{ fontWeight: 600, color: T.text }}>gekündigt zum Periodenende</span>
            </p>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              {periodEndLabel ? (
                <>
                  Ihr Pro-Zugang endet am <span style={{ fontWeight: 600, color: T.text }}>{periodEndLabel}</span>. Bis zu
                  diesem Zeitpunkt können Sie Pro uneingeschränkt nutzen. Eine Kündigung wirkt nicht sofort mitten im
                  laufenden Monat, sondern zum Ende des bezahlten Zeitraums.
                </>
              ) : (
                "Ihr Pro-Zugang ist zur Kündigung am Ende der laufenden Periode vorgemerkt. Bis dahin können Sie Pro weiter nutzen."
              )}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Eine erneute Buchung oder Anpassungen sind im Stripe-Kundenportal möglich, sofern Stripe das für Ihr Konto
              anbietet.
            </p>
          </BillingCard>
          <BillingCard title="Abrechnung">
            <BillingPortalButton label="Abrechnung verwalten (Stripe)" />
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/app" style={linkButtonStyle("muted")}>
                Zur App
              </Link>
            </div>
          </BillingCard>
        </>
      ) : !billingLoadFailed && proActiveStripe ? (
        <>
          <BillingCard title="Aktueller Plan">
            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Plan: <span style={{ fontWeight: 600, color: T.text }}>Pro</span> · Status:{" "}
              <span style={{ fontWeight: 600, color: T.text }}>aktiv</span>
              {periodEndLabel ? (
                <>
                  {" "}
                  · aktueller Zeitraum bis:{" "}
                  <span style={{ fontWeight: 600, color: T.text }}>{periodEndLabel}</span>
                </>
              ) : null}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Unbegrenzte Analysen und erweiterte Auswertungen. Änderungen am Abo oder Zahlungsmittel nehmen Sie im
              Kundenportal vor.
            </p>
          </BillingCard>
          <BillingCard title="Abrechnung">
            <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Rechnungen, Zahlungsdaten und Vertragsende / Kündigung zum Periodenende: alles zentral bei Stripe.
            </p>
            <BillingPortalButton label="Abrechnung verwalten (Stripe)" />
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/app" style={linkButtonStyle("muted")}>
                Zur App
              </Link>
              <Link href="/pricing" style={linkButtonStyle("muted")}>
                Preise &amp; Leistungen
              </Link>
            </div>
          </BillingCard>
        </>
      ) : null}

      {!isPro ? (
        <>
          <BillingCard title="Aktueller Plan">
            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Sie nutzen den <span style={{ fontWeight: 600, color: T.text }}>Free-Plan</span> mit den enthaltenen
              Funktionen und einem begrenzten Kontingent kostenloser Analysen.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Mit Pro (monatlich) erhalten Sie unbegrenzte Analysen und die erweiterten Auswertungen. Mindestlaufzeit
              entspricht der monatlichen Abrechnung; Kündigung ist zum Ende des laufenden Abrechnungszeitraums möglich
              (Details im Checkout und im Kundenportal nach Abschluss).
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

          <BillingCard title="Upgrade auf Pro">
            <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
              Checkout über Stripe schaltet nach erfolgreicher Zahlung Pro frei (Webhook). Anschließend verwalten Sie das
              Abo im Kundenportal.
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
      ) : null}

      <BillingCard title="Team & Organisation">
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
          Für mehrere Nutzer, Kontingente oder Organisationen gibt es individuelle Lösungen – kein separater Plan in der
          Oberfläche.{" "}
          <Link href="/contact?topic=team" style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}>
            Team-Lösung anfragen
          </Link>
        </p>
      </BillingCard>
    </>
  );
}
