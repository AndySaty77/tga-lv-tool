"use client";

import React from "react";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";
import { StatusBadge } from "@/components/shared/statusBadge";

const PAGE_SIZE = 10;

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
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const skipNextLoadRef = React.useRef(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const effectivePage = Math.max(1, Math.min(page, totalPages));
  const from = total === 0 ? 0 : (effectivePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(effectivePage * PAGE_SIZE, total);

  const loadPage = React.useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyse/list?page=${pageNum}&pageSize=${PAGE_SIZE}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Laden der Analysen fehlgeschlagen");
      }
      const newTotal = Number(data?.total) ?? 0;
      setItems((data?.items ?? []) as AnalyseRun[]);
      setTotal(newTotal);
      setSelectedIds(new Set());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    void loadPage(page);
  }, [page, loadPage]);

  // Wenn page > totalPages (z. B. nach Löschen), auf gültige Seite wechseln
  React.useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (total > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [total, page]);

  const hasItems = (items?.length ?? 0) > 0;
  const pageIds = (items ?? []).map((r) => r.id);
  const allOnPageSelected = hasItems && pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const handleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const msg =
      selectedIds.size === 1
        ? "Diese Analyse unwiderruflich löschen?"
        : `${selectedIds.size} ausgewählte Analysen unwiderruflich löschen?`;
    if (!window.confirm(msg)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/analyse/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Löschen fehlgeschlagen");
      const deletedCount = data?.deleted ?? selectedIds.size;
      const nextTotal = Math.max(0, total - deletedCount);
      const nextPage = nextTotal === 0 ? 1 : Math.min(effectivePage, Math.ceil(nextTotal / PAGE_SIZE));
      setSelectedIds(new Set());
      setPage(nextPage);
      skipNextLoadRef.current = true;
      await loadPage(nextPage);
    } catch {
      window.alert("Löschen fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSingleDeleted = async () => {
    const nextTotal = Math.max(0, total - 1);
    setSelectedIds(new Set());
    if (nextTotal === 0) {
      setTotal(0);
      setItems([]);
      setPage(1);
      skipNextLoadRef.current = true;
      return;
    }
    const nextPage = Math.min(effectivePage, Math.ceil(nextTotal / PAGE_SIZE));
    setPage(nextPage);
    skipNextLoadRef.current = true;
    await loadPage(nextPage);
  };

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

      {someSelected && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: T.space.md,
            padding: T.space.sm,
            marginBottom: T.space.md,
            borderRadius: T.radiusSm,
            background: T.surface,
            border: `1px solid ${T.border}`,
            fontSize: 13,
          }}
        >
          <span style={{ color: T.muted, fontWeight: 600 }}>
            {selectedIds.size} {selectedIds.size === 1 ? "Analyse" : "Analysen"} ausgewählt
          </span>
          <button
            type="button"
            onClick={handleClearSelection}
            style={{
              padding: "6px 12px",
              borderRadius: T.radiusSm,
              fontSize: 12,
              fontWeight: 600,
              color: T.text,
              background: "transparent",
              border: `1px solid ${T.border}`,
              cursor: "pointer",
            }}
          >
            Auswahl aufheben
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            style={{
              padding: "6px 12px",
              borderRadius: T.radiusSm,
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              background: T.danger,
              border: "none",
              cursor: bulkDeleting ? "not-allowed" : "pointer",
              opacity: bulkDeleting ? 0.7 : 1,
            }}
          >
            {bulkDeleting ? "…" : "Ausgewählte löschen"}
          </button>
        </div>
      )}

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
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    <th style={{ width: 44, padding: T.space.md, verticalAlign: "middle" }}>
                      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={handleSelectAllOnPage}
                          aria-label="Alle auf dieser Seite auswählen"
                          style={{ width: 16, height: 16, accentColor: T.accent }}
                        />
                      </label>
                    </th>
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
                      <td style={{ padding: T.space.md, verticalAlign: "middle" }}>
                        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => handleToggleRow(row.id)}
                            aria-label={`Analyse ${row.project_name ?? row.file_name ?? row.id} auswählen`}
                            style={{ width: 16, height: 16, accentColor: T.accent }}
                          />
                        </label>
                      </td>
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
                          <DeleteButton rowId={row.id} onDeleted={handleSingleDeleted} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: T.space.md,
                  padding: T.space.md,
                  borderTop: `1px solid ${T.border}`,
                  fontSize: 13,
                  color: T.muted,
                }}
              >
                <span>
                  {from}–{to} von {total} Analysen
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: T.space.sm }}>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={effectivePage <= 1}
                    style={{
                      padding: "6px 14px",
                      borderRadius: T.radiusSm,
                      fontSize: 12,
                      fontWeight: 600,
                      color: effectivePage <= 1 ? T.faint : T.text,
                      background: "transparent",
                      border: `1px solid ${T.border}`,
                      cursor: effectivePage <= 1 ? "not-allowed" : "pointer",
                      opacity: effectivePage <= 1 ? 0.6 : 1,
                    }}
                  >
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={effectivePage >= totalPages}
                    style={{
                      padding: "6px 14px",
                      borderRadius: T.radiusSm,
                      fontSize: 12,
                      fontWeight: 600,
                      color: effectivePage >= totalPages ? T.faint : T.text,
                      background: "transparent",
                      border: `1px solid ${T.border}`,
                      cursor: effectivePage >= totalPages ? "not-allowed" : "pointer",
                      opacity: effectivePage >= totalPages ? 0.6 : 1,
                    }}
                  >
                    Weiter
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
