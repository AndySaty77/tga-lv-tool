import React from "react";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";
import { DashboardStats } from "@/components/app/dashboardStats";
import { StatusBadge } from "@/components/shared/statusBadge";

export const metadata = {
  title: "Dashboard – TGA LV Tool",
  description: "Übersicht und Einstieg in die LV-Analyse.",
};

/** Mock: letzte Analysen (später durch echte Daten ersetzen) */
const MOCK_LAST_ANALYSEN = [
  { id: "1", projektname: "Bürogebäude Musterstadt – TGA", datum: "2025-03-10", score: 62, status: "Abgeschlossen" },
  { id: "2", projektname: "Klinik Nord – HLSE", datum: "2025-03-08", score: 78, status: "Abgeschlossen" },
  { id: "3", projektname: "Schulbau Projekt Alpha", datum: "2025-03-05", score: 45, status: "Abgeschlossen" },
];

export default function AppDashboardPage() {
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

      <DashboardStats />

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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
              {MOCK_LAST_ANALYSEN.map((row) => (
                <tr key={row.id} className="app-table-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: T.space.md, color: T.text }}>{row.projektname}</td>
                  <td style={{ padding: T.space.md, color: T.muted }}>{row.datum}</td>
                  <td style={{ padding: T.space.md, textAlign: "right" }}>
                    <span style={{ color: T.accent, fontWeight: 700, fontSize: 14 }}>{row.score}</span>
                  </td>
                  <td style={{ padding: T.space.md }}>
                    <StatusBadge status={row.status} />
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
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: T.space.sm, fontSize: 12, color: T.faint }}>
          Mockdaten. Später: echte Analysen aus Backend/DB anbinden.
        </p>
      </section>
    </>
  );
}
