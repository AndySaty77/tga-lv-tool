import React from "react";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";
import { getUser } from "@/lib/auth/get-user";
import type { PlanId } from "@/lib/billing/plans";
import { getUserPlan } from "@/lib/billing/userPlan";
import { getMonthlyUsageForPlan, type MonthlyUsageInfo } from "@/lib/billing/usage";

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

export default async function AppSettingsPage() {
  const user = await getUser().catch(() => null);

  let plan: PlanId = "free";
  let usage: MonthlyUsageInfo | null = null;

  if (user) {
    try {
      plan = await getUserPlan();
      usage = await getMonthlyUsageForPlan(user.id, plan);
    } catch {
      plan = "free";
      usage = null;
    }
  }

  const isPro = plan === "pro";

  return (
    <>
      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Settings
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
          Kontodaten, Plan und Nutzung für dein LV Scope Konto.
        </p>
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
                    <span>
                      {[firstName, lastName].filter(Boolean).join(" ")}
                    </span>
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
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: T.text }}>Plan: </span>
                  <span>{isPro ? "Pro" : "Free"}</span>
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

      <SettingsCard title="Plan">
        <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          Sie nutzen aktuell den{" "}
          <span style={{ fontWeight: 600, color: T.text }}>{isPro ? "Pro-Plan" : "Free-Plan"}</span>.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          {isPro
            ? "Mit Pro stehen Ihnen unbegrenzt viele Analysen und erweiterte Auswertungen zur Verfügung."
            : "Mit dem Free-Plan können Sie bis zu 3 Analysen pro Monat durchführen und alle Basisfunktionen testen."}
        </p>
      </SettingsCard>

      <SettingsCard title="Nutzung im aktuellen Monat">
        {usage ? (
          <>
            {usage.limit == null ? (
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                Sie nutzen Pro mit unbegrenzten Analysen. Aktuell wurden in diesem Monat{" "}
                <span style={{ fontWeight: 600, color: T.text }}>{usage.usedThisMonth}</span> Analysen durchgeführt.
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                  Sie haben in diesem Monat{" "}
                  <span style={{ fontWeight: 600, color: T.text }}>{usage.usedThisMonth}</span> von{" "}
                  <span style={{ fontWeight: 600, color: T.text }}>{usage.limit}</span> möglichen Analysen genutzt.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                  {usage.remaining && usage.remaining > 0
                    ? `Es verbleiben noch ${usage.remaining} Analyse${
                        usage.remaining === 1 ? "" : "n"
                      } in diesem Monat.`
                    : "Das Monatslimit ist erreicht. Weitere Analysen sind im Free-Plan aktuell nicht möglich."}
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

      <SettingsCard title="Preise & Upgrade">
        <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          Auf der Preisseite sehen Sie die Unterschiede zwischen Free und Pro.
        </p>
        <Link
          href="/pricing"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: T.accent,
            textDecoration: "none",
            padding: "6px 10px",
            borderRadius: T.radiusSm,
            border: `1px solid ${T.border}`,
            background: "rgba(56,189,248,0.06)",
          }}
        >
          Preise ansehen →
        </Link>
      </SettingsCard>

      <SettingsCard title="Account">
        <p style={{ margin: "0 0 8px", fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          Du kannst dich hier aus dem geschützten Bereich abmelden.
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
    </>
  );
}
