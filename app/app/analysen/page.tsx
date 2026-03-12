import React from "react";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";
import { StatusBadge } from "@/components/shared/statusBadge";

export const metadata = {
  title: "Analysen – TGA LV Tool",
  description: "Übersicht aller Analysen.",
};

/** Mock: Analysenliste (später durch echte Daten ersetzen) */
const MOCK_ANALYSEN = [
  { id: "1", projektname: "Bürogebäude Musterstadt – TGA", datum: "2025-03-10", score: 62, status: "Abgeschlossen" as const },
  { id: "2", projektname: "Klinik Nord – HLSE", datum: "2025-03-08", score: 78, status: "Abgeschlossen" as const },
  { id: "3", projektname: "Schulbau Projekt Alpha", datum: "2025-03-05", score: 45, status: "In Analyse" as const },
  { id: "4", projektname: "Industriehalle Lüftung", datum: "2025-03-02", score: 71, status: "Abgeschlossen" as const },
  { id: "5", projektname: "Sanierung Bestand Ost", datum: "2025-02-28", score: 0, status: "Fehler" as const },
];

export default function AppAnalysenPage() {
  return (
    <>
      <div style={{ marginBottom: T.space.xl }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
          Analysen
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
          Alle durchgeführten LV-Analysen. Ergebnis ansehen öffnet die Detailansicht.
        </p>
      </div>

      <div
        style={{
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          background: T.card,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
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
              {MOCK_ANALYSEN.map((row) => (
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
                      Ergebnis ansehen
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: T.space.md, fontSize: 12, color: T.faint }}>
          Mockdaten. Später: echte Analysen aus Backend/DB anbinden.
        </p>
      </div>
    </>
  );
}
