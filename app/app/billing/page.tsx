import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingPortalButton } from "@/components/app/BillingPortalButton";
import { CheckoutProButton } from "@/components/app/CheckoutProButton";
import { appTheme as T } from "@/components/app/appTheme";
import {
  isCheckoutAllowedForEmail,
  parseStripeCheckoutAllowedEmails,
} from "@/lib/billing/checkoutAllowlist";
import { getBillingProfileFields } from "@/lib/billing/billingProfile";
import { CONTACT_PRO_INQUIRY_HREF, isManualProPlan } from "@/lib/billing/planSource";
import type { PlanId } from "@/lib/billing/plans";
import { getUserPlan } from "@/lib/billing/userPlan";
import { getTotalUsageForPlan, type TotalUsageInfo } from "@/lib/billing/usage";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/auth/is-admin";
import {
  SubscriptionBadge,
  SubscriptionMetaRow,
  type SubscriptionTone,
} from "@/components/app/subscriptionStatusUi";

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

function proShellStyle(tone: SubscriptionTone): React.CSSProperties {
  if (tone === "active") {
    return {
      border: `1px solid ${T.accentMuted}`,
      background: `linear-gradient(155deg, ${T.accentMuted} 0%, ${T.card} 48%, ${T.card} 100%)`,
      boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
    };
  }
  if (tone === "canceling") {
    return {
      border: "1px solid rgba(251,191,36,0.28)",
      background: `linear-gradient(155deg, rgba(251,191,36,0.1) 0%, ${T.card} 52%, ${T.card} 100%)`,
      boxShadow: "0 12px 36px rgba(0,0,0,0.22)",
    };
  }
  if (tone === "payment") {
    return {
      border: "1px solid rgba(248,113,113,0.35)",
      background: `linear-gradient(155deg, rgba(248,113,113,0.08) 0%, ${T.card} 52%, ${T.card} 100%)`,
      boxShadow: "0 12px 36px rgba(0,0,0,0.22)",
    };
  }
  return {
    border: `1px solid ${T.border}`,
    background: T.card,
    boxShadow: "none",
  };
}

function ProVerwaltungCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        background: "rgba(255,255,255,0.02)",
        padding: T.space.lg,
        marginBottom: T.space.lg,
      }}
    >
      <h2 style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: T.faint }}>
        VERWALTUNG
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
        Rechnungen, Zahlungsdaten und Vertragsänderungen
      </p>
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

/** Kurze Pro-Mehrwerte für den Free-Upgrade-Bereich (nur Darstellung). */
const FREE_PRO_FEATURES = [
  "Unbegrenzte Analysen",
  "Erweiterte Auswertungen",
  "Vertiefte Risiko- und Nachtragsanalyse",
  "Rückfragen, Klarstellungen und Angebotsstrategie",
  "Analyse-Archiv",
  "PDF-Export",
] as const;

function FreeUpgradeHero({ showStripeCheckout }: { showStripeCheckout: boolean }) {
  return (
    <div
      style={{
        marginBottom: T.space.lg,
        borderRadius: T.radius,
        border: `1px solid ${T.accentMuted}`,
        background: `linear-gradient(155deg, ${T.accentMuted} 0%, ${T.card} 52%, ${T.card} 100%)`,
        padding: T.space.xl,
        boxShadow: "0 16px 48px rgba(0,0,0,0.38)",
      }}
    >
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: T.faint,
        }}
      >
        Aktuell: Free
      </p>
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: T.text,
          lineHeight: 1.2,
        }}
      >
        {showStripeCheckout ? "Pro freischalten" : "Pro auf Anfrage"}
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: T.muted, lineHeight: 1.65, maxWidth: 540 }}>
        {showStripeCheckout
          ? "Für Ihr Konto ist der direkte Checkout freigeschaltet. Nach erfolgreicher Zahlung aktivieren wir Pro wie gewohnt."
          : "Pro ist derzeit nicht im Selbstservice buchbar. Wir schalten Zugang auf Anfrage oder Einladung frei – für Tests und produktiven Einsatz."}
      </p>
      <ul
        style={{
          margin: "0 0 18px",
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: 8,
        }}
      >
        {FREE_PRO_FEATURES.map((line) => (
          <li
            key={line}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 13,
              color: T.text,
              lineHeight: 1.45,
            }}
          >
            <span style={{ color: T.accent, fontWeight: 700, flexShrink: 0, marginTop: 1 }} aria-hidden="true">
              ✓
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {!showStripeCheckout ? (
        <div
          style={{
            marginBottom: 20,
            padding: "14px 16px",
            borderRadius: T.radiusSm,
            border: `1px solid ${T.border}`,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>Früher Zugang auf Einladung</p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
            Schreiben Sie uns kurz – wir melden uns mit den nächsten Schritten.
          </p>
        </div>
      ) : (
        <div
          style={{
            marginBottom: 20,
            padding: "14px 16px",
            borderRadius: T.radiusSm,
            border: `1px solid ${T.border}`,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>Alternativ ohne Direktkauf</p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
            Sie können uns auch weiterhin für eine Einladung oder Demo kontaktieren.
          </p>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        {showStripeCheckout ? (
          <CheckoutProButton variant="hero" />
        ) : (
          <Link
            href={CONTACT_PRO_INQUIRY_HREF}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 15,
              fontWeight: 700,
              color: "#0a0e1a",
              padding: "14px 28px",
              borderRadius: T.radius,
              border: "1px solid rgba(224,124,94,0.95)",
              background: T.accent,
              textDecoration: "none",
              boxShadow: "0 8px 24px rgba(224,124,94,0.25)",
              minWidth: 260,
            }}
          >
            Pro-Zugang anfragen
          </Link>
        )}
      </div>
      {showStripeCheckout ? (
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.faint, lineHeight: 1.5 }}>
          <Link href={CONTACT_PRO_INQUIRY_HREF} style={{ color: T.accent, fontWeight: 600, textDecoration: "none" }}>
            Pro-Zugang anfragen (ohne Checkout)
          </Link>
        </p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Link href="/pricing" style={linkButtonStyle("muted")}>
          Preise &amp; Leistungen
        </Link>
        <Link href="/app/analyse" style={linkButtonStyle("muted")}>
          Zur Analyse
        </Link>
      </div>
    </div>
  );
}

export default async function AppBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string }>;
}) {
  const sp = await searchParams;

  const user = await getUser().catch(() => null);
  if (!user) {
    redirect("/login?redirectTo=/app/billing");
  }
  const showBillingDebug = sp.debug === "1" && isAdmin(user);

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
  const planSource = billing?.plan_source ?? null;
  const trialEndsManualLabel = formatPeriodEnd(billing?.trial_ends_at ?? null);

  const isPro = plan === "pro";
  const isManualPro = isPro && !billingLoadFailed && isManualProPlan(plan, planSource);
  const paymentIssuePro =
    isPro && !isManualPro && hasStripeCustomer && (bs === "past_due" || bs === "unpaid");
  const proCanceling =
    isPro &&
    !isManualPro &&
    hasStripeCustomer &&
    !paymentIssuePro &&
    cancelAtPeriodEnd &&
    (bs === "active" || bs === "trialing");
  const proActiveStripe = isPro && !isManualPro && hasStripeCustomer && !paymentIssuePro && !proCanceling;

  const freeUnpaidStripe =
    !isPro && hasStripeCustomer && bs === "unpaid";

  const checkoutAllowlistSet = parseStripeCheckoutAllowedEmails(process.env.STRIPE_CHECKOUT_ALLOWED_EMAILS);
  const isEmailAllowed = isCheckoutAllowedForEmail(user.email ?? null, checkoutAllowlistSet);
  const showStripeCheckoutForFree = plan === "free" && isEmailAllowed;

  const debugRow = (label: string, value: string) => (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 200px) 1fr", gap: 8, marginBottom: 4 }}>
      <span style={{ color: T.faint }}>{label}</span>
      <code style={{ fontSize: 11, color: T.muted, wordBreak: "break-all" }}>{value}</code>
    </div>
  );

  return (
    <>
      {showBillingDebug ? (
        <div
          style={{
            marginBottom: T.space.md,
            padding: 12,
            borderRadius: T.radiusSm,
            border: `1px dashed ${T.border}`,
            background: "rgba(255,255,255,0.03)",
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <div style={{ fontWeight: 700, color: T.faint, marginBottom: 8, letterSpacing: "0.04em" }}>
            DEBUG (?debug=1) – Checkout-Allowlist
          </div>
          {debugRow("user.email", user.email ?? "(null)")}
          {debugRow("plan", plan)}
          {debugRow("DISABLE_PUBLIC_PRO_CHECKOUT", process.env.DISABLE_PUBLIC_PRO_CHECKOUT ?? "(unset)")}
          {debugRow("STRIPE_CHECKOUT_ALLOWED_EMAILS configured", checkoutAllowlistSet.size > 0 ? "yes" : "no")}
          {debugRow("allowedEmailCount", String(checkoutAllowlistSet.size))}
          {debugRow("isEmailAllowed", String(isEmailAllowed))}
          {debugRow("showStripeCheckoutForFree", String(showStripeCheckoutForFree))}
        </div>
      ) : null}

      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Billing
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
          {isManualPro
            ? "Ihr Pro-Zugang ist unten beschrieben. Ein über diese Seite gebuchtes kostenpflichtiges Online-Abo besteht dafür nicht."
            : "Monatliches Abo, Kündigung zum Ende des Abrechnungszeitraums. Rechnungen und Zahlungsdaten verwalten Sie im Kundenportal."}
        </p>
      </div>

      {!isPro && freeUnpaidStripe ? (
        <BillingCard title="Zahlung">
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#fecaca", lineHeight: 1.65 }}>
            Für Ihr Abonnement liegt ein Zahlungsproblem vor. Bitte aktualisieren Sie die Zahlungsdaten oder klären Sie den
            offenen Betrag im Kundenportal. Nach erfolgreicher Zahlung ist Ihr Abo wieder aktiv.
          </p>
          <BillingPortalButton label="Abo & Abrechnung prüfen" variant="primary" />
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

      {isPro && !billingLoadFailed && isManualPro ? (
        <div
          style={{
            borderRadius: T.radius,
            padding: T.space.xl,
            marginBottom: T.space.lg,
            ...proShellStyle("neutral"),
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: T.text }}>Pro</span>
            <SubscriptionBadge tone="active">Manuell freigeschaltet</SubscriptionBadge>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
            Ihr Pro-Zugang wurde manuell freigeschaltet (Einladung oder Testzugang). Ein selbst gebuchtes kostenpflichtiges
            Online-Abo über diese Oberfläche liegt nicht vor.
          </p>
          {trialEndsManualLabel ? (
            <SubscriptionMetaRow label="Gültig bis" value={trialEndsManualLabel} isLast />
          ) : null}
          <p style={{ margin: trialEndsManualLabel ? "14px 0 0" : "0", fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
            Bei Fragen:{" "}
            <a href="mailto:support@lvscope.de" style={{ color: T.accent, fontWeight: 600 }}>
              support@lvscope.de
            </a>
          </p>
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link href="/app" style={linkButtonStyle("primary")}>
              Zur App
            </Link>
            <Link href={CONTACT_PRO_INQUIRY_HREF} style={linkButtonStyle("muted")}>
              Kontakt
            </Link>
          </div>
        </div>
      ) : null}

      {isPro && !billingLoadFailed && !isManualPro && !hasStripeCustomer ? (
        <div
          style={{
            borderRadius: T.radius,
            padding: T.space.xl,
            marginBottom: T.space.lg,
            ...proShellStyle("neutral"),
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: T.text }}>Pro</span>
            <SubscriptionBadge tone="neutral">Ohne Online-Abrechnung</SubscriptionBadge>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
            Unbegrenzte Analysen und erweiterte Funktionen. Für dieses Konto ist keine Online-Abrechnung hinterlegt.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link href="/app" style={linkButtonStyle("primary")}>
              Zur App
            </Link>
            <Link href="/pricing" style={linkButtonStyle("muted")}>
              Preise &amp; Leistungen
            </Link>
          </div>
        </div>
      ) : null}

      {!billingLoadFailed && paymentIssuePro ? (
        <>
          <div
            style={{
              borderRadius: T.radius,
              padding: T.space.xl,
              marginBottom: T.space.md,
              ...proShellStyle("payment"),
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: T.text }}>Pro</span>
              <SubscriptionBadge tone="payment">Zahlung</SubscriptionBadge>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: T.faint, letterSpacing: "0.04em" }}>ABO-STATUS</p>
            <SubscriptionMetaRow label="Zeitraum bis" value={periodEndLabel ?? "—"} isLast />
            <p style={{ margin: "14px 0 0", fontSize: 13, color: "#fecaca", lineHeight: 1.55 }}>
              {bs === "past_due"
                ? "Letzte Zahlung fehlgeschlagen oder ausstehend – bitte im Kundenportal beheben, damit Pro bestehen bleibt."
                : "Zahlungsproblem – bitte Abrechnung im Kundenportal prüfen."}
            </p>
          </div>
          <ProVerwaltungCard>
            <BillingPortalButton />
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/app" style={linkButtonStyle("muted")}>
                Zur App
              </Link>
            </div>
          </ProVerwaltungCard>
        </>
      ) : !billingLoadFailed && proCanceling ? (
        <>
          <div
            style={{
              borderRadius: T.radius,
              padding: T.space.xl,
              marginBottom: T.space.md,
              ...proShellStyle("canceling"),
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: T.text }}>Pro</span>
              <SubscriptionBadge tone="canceling">Gekündigt</SubscriptionBadge>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: T.faint, letterSpacing: "0.04em" }}>ABO-STATUS</p>
            <SubscriptionMetaRow label="Endet am" value={periodEndLabel ?? "—"} isLast />
            <p style={{ margin: "14px 0 0", fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
              Bis zu diesem Datum nutzen Sie Pro ohne Einschränkung. Kündigung wirkt zum Ende des bezahlten Zeitraums.
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: T.faint, lineHeight: 1.5 }}>
              Rücknahme oder Anpassungen im Kundenportal, sofern verfügbar.
            </p>
          </div>
          <ProVerwaltungCard>
            <BillingPortalButton />
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/app" style={linkButtonStyle("muted")}>
                Zur App
              </Link>
            </div>
          </ProVerwaltungCard>
        </>
      ) : !billingLoadFailed && proActiveStripe ? (
        <>
          <div
            style={{
              borderRadius: T.radius,
              padding: T.space.xl,
              marginBottom: T.space.md,
              ...proShellStyle("active"),
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: T.text }}>Pro</span>
              <SubscriptionBadge tone="active">Aktiv</SubscriptionBadge>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: T.faint, letterSpacing: "0.04em" }}>ABO-STATUS</p>
            {periodEndLabel ? (
              <SubscriptionMetaRow label="Zeitraum bis" value={periodEndLabel} isLast />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Monatliches Abo – Details im Kundenportal.</p>
            )}
            <p style={{ margin: "14px 0 0", fontSize: 12, color: T.faint, lineHeight: 1.5 }}>
              Kündigung zum Ende des laufenden Abrechnungszeitraums möglich.
            </p>
          </div>
          <ProVerwaltungCard>
            <BillingPortalButton />
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/app" style={linkButtonStyle("muted")}>
                Zur App
              </Link>
              <Link href="/pricing" style={linkButtonStyle("muted")}>
                Preise &amp; Leistungen
              </Link>
            </div>
          </ProVerwaltungCard>
        </>
      ) : null}

      {!isPro ? (
        <>
          {!freeUnpaidStripe ? (
            <FreeUpgradeHero showStripeCheckout={showStripeCheckoutForFree} />
          ) : null}

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
