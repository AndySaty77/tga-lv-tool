import React from "react";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";
import { DeleteAccountBlock } from "@/components/app/DeleteAccountBlock";
import {
  SubscriptionBadge,
  SubscriptionMetaRow,
  planAboShellStyle,
} from "@/components/app/subscriptionStatusUi";
import { getBillingProfileFields } from "@/lib/billing/billingProfile";
import { getUser } from "@/lib/auth/get-user";
import type { PlanId } from "@/lib/billing/plans";
import { getUserPlan } from "@/lib/billing/userPlan";
import { getTotalUsageForPlan, type TotalUsageInfo } from "@/lib/billing/usage";

export const metadata = {
  title: "Settings – LV Scope",
  description: "Profil, Plan und grundlegende Einstellungen.",
};

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
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

const linkCtaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: T.accent,
  textDecoration: "none",
  padding: "8px 14px",
  borderRadius: T.radiusSm,
  border: `1px solid ${T.border}`,
  background: "rgba(56,189,248,0.06)",
};

const linkMutedStyle: React.CSSProperties = {
  ...linkCtaStyle,
  background: "rgba(255,255,255,0.02)",
  color: T.muted,
};

function PlanAboFooter() {
  return (
    <div
      style={{
        marginTop: 18,
        paddingTop: 16,
        borderTop: `1px solid ${T.border}`,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Link href="/app/billing" style={linkCtaStyle}>
        Zum Billing
      </Link>
      <Link href="/pricing" style={linkMutedStyle}>
        Preise vergleichen
      </Link>
    </div>
  );
}

export default async function AppSettingsPage() {
  const user = await getUser().catch(() => null);

  let plan: PlanId = "free";
  let usage: TotalUsageInfo | null = null;

  if (user) {
    try {
      plan = await getUserPlan();
      usage = await getTotalUsageForPlan(user.id, plan);
    } catch {
      plan = "free";
      usage = null;
    }
  }

  const billing = user ? await getBillingProfileFields(user.id) : null;
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
  const freeUnpaidStripe = !isPro && hasStripeCustomer && bs === "unpaid";

  return (
    <>
      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Settings
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
          Profil, Planstatus und Nutzung – kompakt an einem Ort.
        </p>
      </div>

      <div style={planAboShellStyle()}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: T.text }}>
          Plan &amp; Abo
        </h2>
        <p style={{ margin: "6px 0 16px", fontSize: 13, color: T.muted, lineHeight: 1.45 }}>
          Status und Verwaltung
        </p>

        {!user ? (
          <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>Nicht angemeldet.</p>
        ) : billingLoadFailed && isPro ? (
          <>
            <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
              Abrechnungsdaten konnten nicht geladen werden. Bitte später erneut versuchen oder unter Billing nachsehen.
            </p>
            <PlanAboFooter />
          </>
        ) : !isPro && freeUnpaidStripe ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Free</span>
              <SubscriptionBadge tone="payment">Zahlung</SubscriptionBadge>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#fecaca", lineHeight: 1.55 }}>
              Zahlungsproblem beim Abo – bitte unter Billing im Kundenportal klären.
            </p>
            <PlanAboFooter />
          </>
        ) : isPro && !billingLoadFailed && !hasStripeCustomer ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Pro</span>
              <SubscriptionBadge tone="neutral">Ohne Online-Abrechnung</SubscriptionBadge>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
              Keine hinterlegte Abrechnung – Details nur eingeschränkt sichtbar.
            </p>
            <PlanAboFooter />
          </>
        ) : !billingLoadFailed && paymentIssuePro ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Pro</span>
              <SubscriptionBadge tone="payment">Zahlung</SubscriptionBadge>
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: T.faint }}>
              ABO
            </p>
            <SubscriptionMetaRow label="Zeitraum bis" value={periodEndLabel ?? "—"} isLast />
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "#fecaca", lineHeight: 1.55 }}>
              Zahlung ausstehend – bitte unter Billing im Kundenportal beheben.
            </p>
            <PlanAboFooter />
          </>
        ) : !billingLoadFailed && proCanceling ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Pro</span>
              <SubscriptionBadge tone="canceling">Gekündigt</SubscriptionBadge>
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: T.faint }}>
              ABO
            </p>
            <SubscriptionMetaRow label="Endet am" value={periodEndLabel ?? "—"} isLast />
            <p style={{ margin: "12px 0 0", fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
              Bis dahin bleibt Pro voll nutzbar.
            </p>
            <PlanAboFooter />
          </>
        ) : !billingLoadFailed && proActiveStripe ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Pro</span>
              <SubscriptionBadge tone="active">Aktiv</SubscriptionBadge>
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: T.faint }}>
              ABO
            </p>
            {periodEndLabel ? (
              <SubscriptionMetaRow label="Zeitraum bis" value={periodEndLabel} isLast />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Monatliches Abo</p>
            )}
            <p style={{ margin: "10px 0 0", fontSize: 12, color: T.faint, lineHeight: 1.45 }}>
              Verwaltung und Rechnungen unter Billing
            </p>
            <PlanAboFooter />
          </>
        ) : !isPro ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Free</span>
              <SubscriptionBadge tone="neutral">Begrenztes Kontingent</SubscriptionBadge>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
              Upgrade auf Pro für unbegrenzte Analysen und erweiterte Funktionen.
            </p>
            <PlanAboFooter />
          </>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Pro</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>Details zum Abo unter Billing.</p>
            <PlanAboFooter />
          </>
        )}
      </div>

      <SettingsCard title="Profil">
        {user ? (
          (() => {
            const meta: any = (user as any).user_metadata || {};
            const firstName = typeof meta.first_name === "string" ? meta.first_name : undefined;
            const lastName = typeof meta.last_name === "string" ? meta.last_name : undefined;
            const company = typeof meta.company === "string" ? meta.company : undefined;

            return (
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7 }}>
                {firstName || lastName ? (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: T.text }}>Name: </span>
                    <span>{[firstName, lastName].filter(Boolean).join(" ")}</span>
                  </div>
                ) : null}
                {company && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: T.text }}>Firma: </span>
                    <span>{company}</span>
                  </div>
                )}
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: T.text }}>E-Mail: </span>
                  <span>{user.email}</span>
                </div>
                <div style={{ fontSize: 12, color: T.faint }}>
                  Konto-ID: <code style={{ fontSize: 11 }}>{user.id}</code>
                </div>
              </div>
            );
          })()
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
            Keine Kontodaten verfügbar (nicht angemeldet).
          </p>
        )}
      </SettingsCard>

      <SettingsCard title="Nutzung (kostenlose Analysen)">
        {usage ? (
          <>
            {usage.limit == null ? (
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                Pro – unbegrenzte Analysen.
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 600, color: T.text }}>{usage.used}</span> von{" "}
                  <span style={{ fontWeight: 600, color: T.text }}>{usage.limit}</span> kostenlosen Analysen verbraucht.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                  {usage.remaining != null && usage.remaining > 0
                    ? `Noch ${usage.remaining} Analyse${usage.remaining === 1 ? "" : "n"} verfügbar.`
                    : "Kontingent verbraucht. Weitere Analysen mit Pro."}
                </p>
              </>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
            Nutzungsdaten konnten nicht geladen werden.
          </p>
        )}
      </SettingsCard>

      <SettingsCard title="Account">
        <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          Abmeldung aus dem geschützten Bereich.
        </p>
        <Link
          href="/app/logout"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#fecaca",
            textDecoration: "none",
            padding: "6px 10px",
            borderRadius: T.radiusSm,
            border: `1px solid ${T.border}`,
            background: "rgba(248,113,113,0.08)",
          }}
        >
          Logout
        </Link>
      </SettingsCard>

      {user && (
        <SettingsCard title="Konto löschen">
          <DeleteAccountBlock />
        </SettingsCard>
      )}
    </>
  );
}
