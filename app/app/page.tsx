import React from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { appTheme as T } from "@/components/app/appTheme";
import { DashboardStats } from "@/components/app/dashboardStats";
import { StatusBadge } from "@/components/shared/statusBadge";
import { getUser } from "@/lib/auth/get-user";
import type { PlanId } from "@/lib/billing/plans";
import { getUserPlan } from "@/lib/billing/userPlan";
import { getMonthlyUsageForPlan, type MonthlyUsageInfo } from "@/lib/billing/usage";

export const metadata = {
  title: "Dashboard – TGA LV Tool",
  description: "Übersicht und Einstieg in die LV-Analyse.",
};

type AnalyseRunRow = {
  id: string;
  created_at: string;
  project_name: string | null;
  file_name: string | null;
  score: number | null;
  status: string | null;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Noch keine Analysen";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Gerade eben";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Gerade eben";
  if (minutes < 60) return `vor ${minutes} Minute${minutes === 1 ? "" : "n"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Stunde${hours === 1 ? "" : "n"}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months} Monat${months === 1 ? "" : "en"}`;
  const years = Math.floor(months / 12);
  return `vor ${years} Jahr${years === 1 ? "" : "en"}`;
}

export default async function AppDashboardPage() {
  const user = await getUser();
  const supabase = getSupabase();

  let analysenGesamt = 0;
  let durchschnittScore: number | null = null;
  let letzteAnalyseIso: string | null = null;
  let lastAnalysen: AnalyseRunRow[] = [];
  let plan: PlanId = "free";
  let usageInfo: MonthlyUsageInfo | null = null;

  if (user && supabase) {
    try {
      // Alle Analysen für Aggregation laden (nur notwendige Felder)
      const { data: allRows } = await supabase
        .from("analyse_runs")
        .select("id, created_at, score")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const rows = Array.isArray(allRows) ? (allRows as { id: string; created_at: string; score: number | null }[]) : [];
      analysenGesamt = rows.length;

      if (rows.length > 0) {
        // letzte Analysezeit = created_at des ersten (da DESC sortiert)
        letzteAnalyseIso = rows[0].created_at;

        // Durchschnittlicher Score aus allen nicht-null Scores
        const scores = rows
          .map((r) => (typeof r.score === "number" && !Number.isNaN(r.score) ? r.score : null))
          .filter((v): v is number => v != null);
        if (scores.length > 0) {
          const sum = scores.reduce((acc, v) => acc + v, 0);
          durchschnittScore = sum / scores.length;
        }
      }
    } catch {
      // Fehler bei Aggregation: Dashboard zeigt dann Default-Werte
      analysenGesamt = analysenGesamt || 0;
      durchschnittScore = durchschnittScore ?? null;
      letzteAnalyseIso = letzteAnalyseIso ?? null;
    }

    try {
      // Letzte 5 Analysen für Tabelle
      const { data: lastRows } = await supabase
        .from("analyse_runs")
        .select("id, created_at, project_name, file_name, score, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (Array.isArray(lastRows)) {
        lastAnalysen = lastRows as AnalyseRunRow[];
      }
    } catch {
      lastAnalysen = [];
    }

    try {
      plan = await getUserPlan();
      usageInfo = await getMonthlyUsageForPlan(user.id, plan);
    } catch {
      plan = "free";
      usageInfo = null;
    }
  }

  const letzteAnalyseLabel = analysenGesamt > 0 ? formatRelativeTime(letzteAnalyseIso) : "Noch keine Analysen";

  return (
    <>
      <div style={{ marginBottom: T.space.lg }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Dashboard
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5, maxWidth: 560 }}>
          Übersicht und schneller Einstieg in die LV-Analyse. Starten Sie eine neue Analyse oder öffnen Sie ein bestehendes Ergebnis.
        </p>
      </div>

      <DashboardStats
        analysenGesamt={analysenGesamt}
        durchschnittScore={durchschnittScore}
        letzteAnalyse={letzteAnalyseLabel}
      />

      {/* Plan- und Nutzungsinfo */}
      {user && usageInfo && (
        <section
          aria-label="Plan und Nutzung"
          style={{ marginBottom: T.space.xl }}
        >
          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: T.radius,
              background: T.card,
              padding: T.space.lg,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxWidth: 480,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.faint,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Plan &amp; Nutzung
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
              Plan: {plan === "pro" ? "Pro" : "Free"}
            </div>
            {usageInfo.limit == null ? (
              <div style={{ fontSize: 13, color: T.muted }}>
                Unbegrenzte Analysen pro Monat.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: T.muted }}>
                  {usageInfo.usedThisMonth} von {usageInfo.limit} Analysen in diesem Monat genutzt.
                </div>
                <div style={{ fontSize: 13, color: T.muted }}>
                  {usageInfo.remaining && usageInfo.remaining > 0
                    ? `Noch ${usageInfo.remaining} Analyse${usageInfo.remaining === 1 ? "" : "n"} verfügbar.`
                    : "Monatslimit erreicht."}
                </div>
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  <Link
                    href="/pricing"
                    style={{
                      color: T.accent,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Zu den Plänen →
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <div style={{ marginBottom: T.space.xl }}>
        <Link
          href="/analyse"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: `${T.space.sm}px ${T.space.md}px`,
            borderRadius: T.radiusSm,
            fontSize: 13,
            fontWeight: 700,
            color: "#0c1222",
            background: T.accent,
            border: "none",
            textDecoration: "none",
          }}
        >
          Neue Analyse starten
        </Link>
      </div>

      <section aria-label="Letzte Analysen">
        <h2 style={{ margin: "0 0 " + T.space.md + "px", fontSize: 14, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Letzte Analysen
        </h2>
        <div
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            background: T.card,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                <th style={{ textAlign: "left", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint, textTransform: "uppercase", letterSpacing: "0.04em" }}>Projektname</th>
                <th style={{ textAlign: "left", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint, textTransform: "uppercase", letterSpacing: "0.04em" }}>Datum</th>
                <th style={{ textAlign: "right", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint, textTransform: "uppercase", letterSpacing: "0.04em" }}>Score</th>
                <th style={{ textAlign: "left", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint, textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</th>
                <th style={{ textAlign: "right", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint }}></th>
              </tr>
            </thead>
            <tbody>
              {lastAnalysen.map((row) => (
                <tr key={row.id} className="app-table-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: T.space.md, color: T.text }}>{row.project_name ?? row.file_name ?? "Unbenannt"}</td>
                  <td style={{ padding: T.space.md, color: T.muted }}>
                    {row.created_at ? new Date(row.created_at).toLocaleString("de-DE") : "—"}
                  </td>
                  <td style={{ padding: T.space.md, textAlign: "right" }}>
                    <span style={{ color: T.accent, fontWeight: 700, fontSize: 14 }}>
                      {row.score != null ? row.score : "—"}
                    </span>
                  </td>
                  <td style={{ padding: T.space.md }}>
                    <StatusBadge status={row.status ?? "Abgeschlossen"} />
                  </td>
                  <td style={{ padding: T.space.md, textAlign: "right" }}>
                    <Link
                      href={`/app/analysen/${row.id}`}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.accent,
                        textDecoration: "none",
                      }}
                    >
                      Ergebnis ansehen →
                    </Link>
                  </td>
                </tr>
              ))}
              {lastAnalysen.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: T.space.lg, fontSize: 13, color: T.muted }}>
                    Noch keine Analysen gespeichert.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </>
  );
}
