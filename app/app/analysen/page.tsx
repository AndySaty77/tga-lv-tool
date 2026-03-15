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

function DeleteButton({ rowId, onDeleted }: { rowId: string; onDeleted: () => void }) {
  const [loading, setLoading] = React.useState(false);
  const handleDelete = async () => {
    if (!window.confirm("Diese Analyse unwiderruflich löschen?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analyse/${rowId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Löschen fehlgeschlagen");
      onDeleted();
    } catch {
      setLoading(false);
      window.alert("Löschen fehlgeschlagen. Bitte erneut versuchen.");
    }
  };
  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      style={{
        padding: "6px 12px",
        borderRadius: T.radiusSm,
        fontSize: 12,
        fontWeight: 600,
        color: T.danger,
        background: "transparent",
        border: `1px solid ${T.border}`,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "…" : "Löschen"}
    </button>
  );
}

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

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <div style={{ marginBottom: T.space.lg, display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: T.space.md }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
            Analysen
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted, lineHeight: 1.5, maxWidth: 520 }}>
            Alle gespeicherten LV-Analysen. Öffnen Sie ein Ergebnis für Details, Score und Export.
          </p>
        </div>
        <Link
          href="/app/analyse"
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

      <div
        style={{
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          background: T.card,
          overflow: "hidden",
        }}
      >
        {loading && (
          <div style={{ padding: T.space.xl, fontSize: 13, color: T.muted }}>Lade Analysen…</div>
        )}
        {error && !loading && (
          <div style={{ padding: T.space.xl, fontSize: 13, color: T.danger }}>Fehler: {error}</div>
        )}
        {!loading && !error && !hasItems && (
          <div
            style={{
              padding: T.space.xl * 1.5,
              textAlign: "center",
              fontSize: 14,
              color: T.muted,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0, marginBottom: T.space.md }}>Noch keine Analysen gespeichert.</p>
            <p style={{ margin: 0, marginBottom: T.space.lg, fontSize: 13 }}>Starten Sie Ihre erste LV-Analyse – Upload, Auswertung und Ergebnis in der App.</p>
            <Link
              href="/app/analyse"
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
        )}
        {hasItems && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  <th style={{ textAlign: "left", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint, textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 140 }}>Projekt / Datei</th>
                  <th style={{ textAlign: "left", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>Datum</th>
                  <th style={{ textAlign: "right", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint, textTransform: "uppercase", letterSpacing: "0.04em", width: 72 }}>Score</th>
                  <th style={{ textAlign: "left", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint, textTransform: "uppercase", letterSpacing: "0.04em", width: 120 }}>Status</th>
                  <th style={{ textAlign: "right", padding: T.space.md, fontWeight: 600, fontSize: 12, color: T.faint, width: 180 }}></th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((row) => (
                  <tr key={row.id} className="app-table-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: T.space.md, color: T.text, minWidth: 0 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }} title={row.project_name ?? row.file_name ?? ""}>
                        {row.project_name ?? row.file_name ?? "Unbenannt"}
                      </span>
                    </td>
                    <td style={{ padding: T.space.md, color: T.muted, whiteSpace: "nowrap", fontSize: 12 }}>
                      {formatDate(row.created_at)}
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
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Link
                          href={`/app/analysen/${row.id}`}
                          style={{
                            display: "inline-block",
                            padding: "6px 12px",
                            borderRadius: T.radiusSm,
                            fontSize: 12,
                            fontWeight: 600,
                            color: T.accent,
                            textDecoration: "none",
                            border: `1px solid ${T.border}`,
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          Ergebnis ansehen
                        </Link>
                        <DeleteButton
                          rowId={row.id}
                          onDeleted={() => setItems((prev) => (prev ?? []).filter((r) => r.id !== row.id))}
                        />
                      </div>
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
