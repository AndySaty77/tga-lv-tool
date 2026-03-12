"use client";

import React from "react";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";
import { StatusBadge } from "@/components/shared/statusBadge";

type AnalyseRun = {
  id: string;
  created_at: string;
  project_name: string | null;
  file_name: string | null;
  score: number | null;
  status: string | null;
};

export default function AppAnalysenPage() {
  const [items, setItems] = React.useState<AnalyseRun[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/analyse/list");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Laden der Analysen fehlgeschlagen");
        }
        if (!cancelled) {
          setItems((data?.items ?? []) as AnalyseRun[]);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unbekannter Fehler");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasItems = (items?.length ?? 0) > 0;

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
        {loading && (
          <div style={{ padding: T.space.lg, fontSize: 13, color: T.muted }}>Lade Analysen…</div>
        )}
        {error && !loading && (
          <div style={{ padding: T.space.lg, fontSize: 13, color: T.danger }}>Fehler: {error}</div>
        )}
        {!loading && !error && !hasItems && (
          <div style={{ padding: T.space.lg, fontSize: 13, color: T.muted }}>Noch keine Analysen gespeichert.</div>
        )}
        {hasItems && (
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
                {(items ?? []).map((row) => (
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
                        Ergebnis ansehen
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
