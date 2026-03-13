"use client";

import React from "react";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";

type AnalyseItem = {
  id: string;
  created_at: string | null;
  project_name: string | null;
  file_name: string | null;
  score: number | null;
  status: string | null;
  management_summary: string | null;
  result_json?: unknown;
};

function Block({
  title,
  children,
  fallback = "Keine Daten vorhanden.",
}: { title: string; children: React.ReactNode; fallback?: string }) {
  return (
    <section
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        background: T.card,
        padding: T.space.lg,
      }}
    >
      <h2
        style={{
          margin: "0 0 " + T.space.md + "px",
          fontSize: 14,
          fontWeight: 700,
          color: T.faint,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </h2>
      {children != null && children !== "" ? children : <p style={{ margin: 0, fontSize: 13, color: T.muted }}>{fallback}</p>}
    </section>
  );
}

const KEYFACT_LABELS: Record<string, string> = {
  bauvorhaben: "Bauvorhaben",
  ort: "Ort",
  gewerk: "Gewerk",
  bauherr_ag: "Bauherr",
  planer: "Planer",
  baubeginn: "Baubeginn",
  bauzeit: "Bauzeit",
  fertigstellung: "Fertigstellung",
  ausfuehrungsfrist: "Ausführungsfrist",
  ausfuehrungszeit: "Ausführungszeit",
  fristAngebot: "Angebotsfrist",
  bindefrist: "Bindefrist",
  submission_einreichung: "Submission / Einreichung",
  vob_bgb: "Vertragsgrundlage",
  vertragsgrundlagen: "Vertragsgrundlagen",
};

const RISK_CATEGORY_LABELS: Record<string, string> = {
  vertrags_lv_risiken: "Vertrags- und LV-Risiken",
  mengen_massenermittlung: "Mengen und Massenermittlung",
  technische_vollstaendigkeit: "Technische Vollständigkeit",
  schnittstellen_nebenleistungen: "Schnittstellen und Nebenleistungen",
  kalkulationsunsicherheit: "Kalkulationsunsicherheit",
};

function prettyKey(k: string): string {
  return (KEYFACT_LABELS[k] ?? k)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isMeaningfulValue(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (!t) return false;
  if (/^nicht erkannt/i.test(t)) return false;
  if (/^(n\/a|k\.a\.)$/i.test(t)) return false;
  if (/^\[debug\]/i.test(t)) return false;
  if (t === "-") return false;
  return true;
}

function mapStatus(status: string | null): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "completed" || s === "done") return "Abgeschlossen";
  return status;
}

function scoreToLabel(score: number | null): { title: string; description: string } | null {
  if (score == null) return null;
  if (score < 40) {
    return {
      title: "Niedriges Risiko",
      description: "Die Ausschreibung wirkt insgesamt solide mit überschaubaren Risiken.",
    };
  }
  if (score < 70) {
    return {
      title: "Erhöhtes Risiko",
      description: "Es bestehen mehrere Punkte, die genauer geprüft werden sollten.",
    };
  }
  return {
    title: "Kritische Ausschreibung",
    description: "Hohe vertragliche oder technische Risiken – sorgfältige Prüfung empfohlen.",
  };
}

function getFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename="?([^";\n]+)"?/i);
  return match ? match[1].trim() : null;
}

export function DetailContent({ id }: { id: string }) {
  const [item, setItem] = React.useState<AnalyseItem | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expandedRiskId, setExpandedRiskId] = React.useState<string | null>(null);
  const [exportLoading, setExportLoading] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analyse/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Analyse nicht gefunden");
        if (!cancelled && data?.item) setItem(data.item as AnalyseItem);
        else if (!cancelled) setError("Analyse nicht gefunden");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePdfExport = React.useCallback(async () => {
    if (!item) return;
    setExportError(null);
    setExportLoading(true);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: item.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const stage = typeof data?.stage === "string" ? data.stage : "";
        const message = typeof data?.message === "string" ? data.message : (data?.error ?? "Export fehlgeschlagen");
        const display = stage ? `${stage} – ${message}` : message;
        throw new Error(display);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filename = getFilenameFromDisposition(disposition) ?? `analysebericht-${id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setExportError(null);
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : "PDF-Export fehlgeschlagen.");
    } finally {
      setExportLoading(false);
    }
  }, [item, id]);

  if (loading) {
    return (
      <>
        <div style={{ marginBottom: T.space.lg, display: "flex", alignItems: "center", gap: T.space.md, flexWrap: "wrap" }}>
          <Link href="/app/analysen" style={{ fontSize: 13, fontWeight: 600, color: T.muted, textDecoration: "none" }}>
            ← Analysen
          </Link>
          <span style={{ color: T.faint }}>/</span>
          <span style={{ fontSize: 13, color: T.text }}>Analyse {id}</span>
        </div>
        <p style={{ fontSize: 14, color: T.muted }}>Lade Ergebnis…</p>
      </>
    );
  }

  if (error || !item) {
    return (
      <>
        <div style={{ marginBottom: T.space.lg, display: "flex", alignItems: "center", gap: T.space.md, flexWrap: "wrap" }}>
          <Link href="/app/analysen" style={{ fontSize: 13, fontWeight: 600, color: T.muted, textDecoration: "none" }}>
            ← Analysen
          </Link>
        </div>
        <p style={{ fontSize: 14, color: T.danger }}>{error ?? "Analyse nicht gefunden."}</p>
      </>
    );
  }

  const rj = (item.result_json ?? {}) as Record<string, unknown>;
  type RiskFinding = {
    id?: string;
    category?: string;
    title?: string;
    detail?: string;
    severity?: string;
    penalty?: number;
  };

  const scoreResult = rj.scoreResult as { total?: number; level?: string; findingsSorted?: RiskFinding[] } | undefined;
  const changeOrder = rj.changeOrderAnalysis as { offerStrategySummary?: { executiveSummary?: string }; opportunities?: unknown[] } | undefined;
  const keyFacts = rj.keyFacts as Record<string, string> | undefined;
  const clarificationQuestions = rj.clarificationQuestions as unknown[] | undefined;
  const riskCategories = (scoreResult as { riskCategories?: unknown[] })?.riskCategories;
  const findingsSorted = scoreResult?.findingsSorted;

  const displayScore = item.score ?? scoreResult?.total ?? null;
  const displaySummary =
    (typeof item.management_summary === "string" && item.management_summary.trim())
    || (typeof changeOrder?.offerStrategySummary?.executiveSummary === "string" && changeOrder.offerStrategySummary.executiveSummary.trim())
    || null;
  const title = ((typeof item.project_name === "string" && item.project_name.trim()) || item.file_name) ?? "Ergebnisansicht";

  const mappedStatus = mapStatus(item.status);

  const keyFactEntries =
    keyFacts && typeof keyFacts === "object"
      ? Object.entries(keyFacts).filter(([, v]) => isMeaningfulValue(v))
      : [];

  const hasKeyFacts = keyFactEntries.length > 0;
  const hasRisks = (Array.isArray(riskCategories) && riskCategories.length > 0) || (Array.isArray(findingsSorted) && findingsSorted.length > 0);
  const hasClarifications = Array.isArray(clarificationQuestions) && clarificationQuestions.length > 0;
  const hasChangeOrder = changeOrder && (changeOrder.offerStrategySummary != null || (Array.isArray(changeOrder.opportunities) && changeOrder.opportunities.length > 0));

  const scoreMeta = scoreToLabel(displayScore);

  const groupedFindings: Array<{ categoryKey: string; label: string; items: RiskFinding[] }> = [];
  if (Array.isArray(findingsSorted) && findingsSorted.length > 0) {
    const byCat: Record<string, RiskFinding[]> = {};
    findingsSorted.forEach((f) => {
      const key = (f.category ?? "ohne_kategorie") || "ohne_kategorie";
      if (!byCat[key]) byCat[key] = [];
      byCat[key].push(f);
    });
    Object.entries(byCat).forEach(([catKey, items]) => {
      const label = RISK_CATEGORY_LABELS[catKey] ?? prettyKey(catKey);
      groupedFindings.push({ categoryKey: catKey, label, items });
    });
    groupedFindings.sort((a, b) => a.label.localeCompare(b.label, "de"));
  }

  return (
    <>
      <div style={{ marginBottom: T.space.lg, display: "flex", alignItems: "center", gap: T.space.md, flexWrap: "wrap" }}>
        <Link href="/app/analysen" style={{ fontSize: 13, fontWeight: 600, color: T.muted, textDecoration: "none" }}>
          ← Analysen
        </Link>
        <span style={{ color: T.faint }}>/</span>
        <span style={{ fontSize: 13, color: T.text }}>{title}</span>
      </div>

      <div style={{ marginBottom: T.space.xl }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: T.space.md }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>{title}</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted }}>
              {item.created_at ? new Date(item.created_at).toLocaleString("de-DE") : "—"}
              {mappedStatus && (
                <>
                  {" · "}
                  <span style={{ textTransform: "capitalize" }}>{mappedStatus}</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePdfExport}
            disabled={exportLoading}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: T.text,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              cursor: exportLoading ? "not-allowed" : "pointer",
              opacity: exportLoading ? 0.7 : 1,
            }}
          >
            {exportLoading ? "Export läuft…" : "PDF exportieren"}
          </button>
        </div>
        {exportError && (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: T.danger }}>{exportError}</p>
        )}
      </div>

      {displaySummary && (
        <div style={{ marginBottom: T.space.lg }}>
          <Block title="Management-Zusammenfassung">
            <div
              style={{
                padding: T.space.md,
                background: "rgba(255,255,255,0.03)",
                borderRadius: T.radiusSm,
                borderLeft: `3px solid ${T.accent}`,
                fontSize: 14,
                lineHeight: 1.7,
                color: T.muted,
                whiteSpace: "pre-wrap",
                maxWidth: 720,
              }}
            >
              {displaySummary}
            </div>
          </Block>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: T.space.lg }}>
        <Block title="Gesamtbewertung">
          <div style={{ display: "flex", alignItems: "baseline", gap: T.space.lg, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: T.faint, marginBottom: 4 }}>Gesamt</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.text }}>{displayScore != null ? displayScore : "—"}</div>
              <div style={{ fontSize: 12, color: T.muted }}>von 100 Punkten</div>
            </div>
            {scoreMeta && (
              <div style={{ maxWidth: 320, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{scoreMeta.title}</div>
                <div>{scoreMeta.description}</div>
              </div>
            )}
          </div>
        </Block>

        {hasKeyFacts && (
          <Block title="Eckdaten">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: T.space.md,
                fontSize: 13,
                color: T.muted,
              }}
            >
              {keyFactEntries.map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    padding: T.space.sm,
                    borderRadius: T.radiusSm,
                    border: `1px solid ${T.border}`,
                    background: "rgba(15,23,42,0.7)",
                  }}
                >
                  <div style={{ fontSize: 11, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                    {prettyKey(k)}
                  </div>
                  <div style={{ fontSize: 13, color: T.text }}>{String(v).trim()}</div>
                </div>
              ))}
            </div>
          </Block>
        )}

        {hasRisks && (
          <Block title="Risiken">
            {groupedFindings.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: T.space.md }}>
                {groupedFindings.map((group) => (
                  <section key={group.categoryKey}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.faint,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 6,
                      }}
                    >
                      {group.label}{" "}
                      <span style={{ fontWeight: 400, color: T.muted }}>({group.items.length} Risiko{group.items.length === 1 ? "" : "s"})</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: T.space.md }}>
                      {group.items.slice(0, 16).map((f, i) => {
                        const riskId = f.id ?? `${group.categoryKey}-${i}`;
                        const titleText = (f.title ?? "").toString().trim() || group.label || `Risiko ${i + 1}`;
                        const fullDetail = (f.detail ?? "").toString().trim();
                        const shortDetail = fullDetail.length > 220 ? `${fullDetail.slice(0, 220)}…` : fullDetail;
                        const severity = (f.severity ?? "").toString().toLowerCase();
                        const penalty = typeof f.penalty === "number" ? f.penalty : null;

                        const severityLabel =
                          severity === "high" ? "Hohes Risiko" : severity === "medium" ? "Mittleres Risiko" : severity === "low" ? "Niedriges Risiko" : "";
                        const severityColor =
                          severity === "high" ? "#fecaca" : severity === "medium" ? "#fed7aa" : severity === "low" ? "#bbf7d0" : T.muted;

                        const isExpanded = expandedRiskId === riskId;

                        return (
                          <div
                            key={riskId}
                            style={{
                              borderRadius: T.radiusSm,
                              border: `1px solid ${T.border}`,
                              background: "rgba(15,23,42,0.7)",
                              padding: T.space.md,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{titleText}</div>
                            {shortDetail && (
                              <p style={{ margin: 0, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                                {shortDetail}
                              </p>
                            )}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, marginTop: 2 }}>
                              {severityLabel && (
                                <span
                                  style={{
                                    padding: "3px 6px",
                                    borderRadius: 999,
                                    border: "1px solid transparent",
                                    background: "rgba(0,0,0,0.3)",
                                    color: severityColor,
                                    fontWeight: 600,
                                  }}
                                >
                                  {severityLabel}
                                </span>
                              )}
                              {penalty != null && (
                                <span
                                  style={{
                                    padding: "3px 6px",
                                    borderRadius: 999,
                                    border: `1px solid ${T.border}`,
                                    color: T.muted,
                                  }}
                                >
                                  Abzug: {penalty}
                                </span>
                              )}
                            </div>
                            {fullDetail && fullDetail.length > shortDetail.length && (
                              <button
                                type="button"
                                onClick={() => setExpandedRiskId(isExpanded ? null : riskId)}
                                style={{
                                  marginTop: 4,
                                  alignSelf: "flex-start",
                                  padding: "2px 0",
                                  border: "none",
                                  background: "transparent",
                                  fontSize: 11,
                                  color: T.accent,
                                  cursor: "pointer",
                                }}
                              >
                                {isExpanded ? "Weniger Details" : "Mehr Details"}
                              </button>
                            )}
                            {isExpanded && fullDetail && (
                              <div
                                style={{
                                  marginTop: 4,
                                  paddingTop: 4,
                                  borderTop: `1px dashed ${T.border}`,
                                  fontSize: 12,
                                  color: T.muted,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {fullDetail}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : Array.isArray(riskCategories) && riskCategories.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: T.space.lg, fontSize: 13, color: T.muted }}>
                {riskCategories.slice(0, 20).map((c: unknown, i: number) => (
                  <li key={i}>{typeof c === "object" && c != null && "label" in c ? String((c as { label?: string }).label) : String(c)}</li>
                ))}
              </ul>
            ) : null}
          </Block>
        )}

        {hasClarifications && (
          <Block title="Rückfragen">
            <ul style={{ margin: 0, paddingLeft: T.space.lg, fontSize: 13, color: T.muted }}>
              {clarificationQuestions!.slice(0, 15).map((q: unknown, i: number) => (
                <li key={i}>{typeof q === "object" && q != null && "question" in q ? String((q as { question?: string }).question) : String(q)}</li>
              ))}
            </ul>
          </Block>
        )}

        {hasChangeOrder && (
          <Block title="Nachtragspotenzial / Angebotsstrategie">
            {typeof changeOrder!.offerStrategySummary?.executiveSummary === "string" && changeOrder!.offerStrategySummary.executiveSummary.trim() ? (
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{changeOrder!.offerStrategySummary.executiveSummary}</div>
            ) : Array.isArray(changeOrder!.opportunities) && changeOrder!.opportunities.length > 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: T.muted }}>{changeOrder!.opportunities.length} Einträge im Nachtragspotenzial.</p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: T.muted }}>Daten aus der Nachtragsanalyse vorhanden.</p>
            )}
          </Block>
        )}
      </div>

      <div style={{ marginTop: T.space.xl }}>
        <Link href="/app/analysen" style={{ fontSize: 13, fontWeight: 600, color: T.accent, textDecoration: "none" }}>
          ← Zurück zur Liste
        </Link>
      </div>
    </>
  );
}

