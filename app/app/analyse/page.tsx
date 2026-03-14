// app/app/analyse/page.tsx – Analyse im App-Bereich (geschützt, gleiche Analyse-UI wie /analyse)
import React from "react";
import Link from "next/link";
import { ScorePage } from "@/app/admin/score/page";
import { appTheme as T } from "@/components/app/appTheme";
import { getUser } from "@/lib/auth/get-user";
import { getUserPlan } from "@/lib/billing/userPlan";
import { getMonthlyUsageForPlan } from "@/lib/billing/usage";

export const metadata = {
  title: "Leistungsverzeichnis analysieren – TGA LV Tool",
  description:
    "Risiken, Unklarheiten und Nachtragspotenziale vor der Angebotsabgabe erkennen – mit Rückfragen und Angebotsklarstellungen.",
};

export default async function AppAnalysePage() {
  const user = await getUser().catch(() => null);

  if (!user) {
    return null;
  }

  try {
    const plan = await getUserPlan();
    const usage = await getMonthlyUsageForPlan(user.id, plan);

    if (usage.hasReachedLimit && usage.limit != null) {
      return (
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: T.space.xl,
            borderRadius: T.radius,
            border: `1px solid ${T.border}`,
            background: T.card,
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: T.space.md,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: T.text,
            }}
          >
            Analyse-Limit erreicht
          </h1>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: T.muted, lineHeight: 1.6 }}>
            Ihr Free-Plan enthält {usage.limit} Analysen pro Monat. Für diesen Monat wurden bereits{" "}
            {usage.usedThisMonth} Analysen durchgeführt.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.6 }}>
            Bitte upgraden Sie auf Pro, um weitere Analysen durchführen zu können, oder versuchen Sie es im nächsten
            Monat erneut.
          </p>
          <div style={{ marginTop: T.space.lg, display: "flex", gap: T.space.md, flexWrap: "wrap" }}>
            <Link
              href="/pricing"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#020617",
                background: T.accent,
                borderRadius: T.radiusSm,
                padding: "8px 14px",
                textDecoration: "none",
              }}
            >
              Zu den Plänen →
            </Link>
            <Link
              href="/app/analysen"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: T.text,
                borderRadius: T.radiusSm,
                padding: "8px 14px",
                border: `1px solid ${T.border}`,
                textDecoration: "none",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              Gespeicherte Analysen ansehen
            </Link>
          </div>
        </div>
      );
    }
  } catch {
    // Bei Fehlern in der Limitprüfung Analyse nicht blockieren
  }

  return <ScorePage customerRoute />;
}
