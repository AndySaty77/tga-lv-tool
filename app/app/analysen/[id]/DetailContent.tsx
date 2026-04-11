"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appTheme as T } from "@/components/app/appTheme";
import { getAnalysisDisplayTitle, normalizeEditableTitleInput } from "@/lib/analysisDisplayTitle";
import { buildPdfReport } from "@/lib/pdf/buildPdfReport";
import { stripScoringEngineeringJargon } from "@/lib/pdf/pdfFormatters";
import { sanitizeForDisplay } from "@/lib/displayText";
import { ProjectInfoManualLayer } from "@/components/ProjectInfoManualLayer";
import {
  parseManualProjectData,
  buildProjectInfoManualBundle,
  type ManualProjectData,
  type ManualProjectFieldKey,
} from "@/lib/manualProjectData";
import { buildKeyFactsDisplayListQuick } from "@/lib/keyFactsDisplayQuick";
import type { PdfTopRiskItem, PdfCategoryScore, PdfQuestion } from "@/lib/pdf/pdfTypes";
import { collectPruefHinweiseFromFinding, MAX_PRUEF_HINWEISE_STANDARD } from "@/lib/userHintsForFinding";
import {
  LV_STATUS_KEYS,
  LV_STATUS_LABEL_DE,
  normalizeLvStatus,
  parseBidAmountNetFromDb,
  parseBidAmountNetInput,
  type LvStatusKey,
} from "@/lib/analyseRunLvStatus";

type AnalyseItem = {
  id: string;
  created_at: string | null;
  project_name: string | null;
  file_name: string | null;
  score: number | null;
  status: string | null;
  management_summary: string | null;
  result_json?: unknown;
  lv_status?: string | null;
  bid_amount_net?: unknown;
};

type RiskFinding = {
  id?: string;
  category?: string;
  title?: string;
  detail?: string;
  severity?: string;
  penalty?: number;
  user_hint?: string | null;
  user_hints?: string[];
};

const RISK_CATEGORY_LABELS: Record<string, string> = {
  vertrags_lv_risiken: "Vertrags- und LV-Risiken",
  mengen_massenermittlung: "Mengen und Massenermittlung",
  technische_vollstaendigkeit: "Technische Vollständigkeit",
  schnittstellen_nebenleistungen: "Schnittstellen und Nebenleistungen",
  kalkulationsunsicherheit: "Kalkulationsunsicherheit",
  normen: "Normen und Vertragsgrundlagen",
  mengen_schnittstellen: "Mengen und Schnittstellen",
  nachtrag: "Nachtragsrisiko",
  ausfuehrung: "Ausführung",
  vollstaendigkeit: "Vollständigkeit",
  vortext: "Vortext / Projektkontext",
};

function mapStatus(status: string | null): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "completed" || s === "done") return "Analyse abgeschlossen";
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

function labelUnknownCategory(catKey: string): string {
  return catKey.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function bidNetToInputString(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: true }).format(n);
}

function severityRank(s?: string): number {
  const x = (s || "").toLowerCase();
  if (x === "high") return 0;
  if (x === "medium") return 1;
  if (x === "low") return 2;
  return 3;
}

function sortFindingsByPriority(findings: RiskFinding[]): RiskFinding[] {
  return [...findings].sort((a, b) => {
    const sr = severityRank(a.severity) - severityRank(b.severity);
    if (sr !== 0) return sr;
    const pa = typeof a.penalty === "number" && !Number.isNaN(a.penalty) ? a.penalty : 0;
    const pb = typeof b.penalty === "number" && !Number.isNaN(b.penalty) ? b.penalty : 0;
    return pb - pa;
  });
}

function isHighPriority(priority: unknown): boolean {
  if (priority == null) return false;
  if (typeof priority === "number") return priority <= 1;
  const s = String(priority).toLowerCase().trim();
  if (s === "1" || s === "p1") return true;
  return s.includes("hoch") || s === "high" || s === "kritisch";
}

function sortQuestions(qs: PdfQuestion[]): PdfQuestion[] {
  const high = qs.filter((q) => isHighPriority(q.priority));
  const rest = qs.filter((q) => !isHighPriority(q.priority));
  return [...high, ...rest];
}

/** Anzeige-Text ohne Engine-Sprache; optional längeren Klartext für „Mehr“. */
function cleanRiskProse(raw: string): string {
  return stripScoringEngineeringJargon(raw.replace(/\s+/g, " ").trim());
}

function severityLabelDe(sev?: string): string {
  const s = (sev || "").toLowerCase();
  if (s === "high") return "Hohes Einzelrisiko";
  if (s === "medium") return "Mittleres Einzelrisiko";
  if (s === "low") return "Niedriges Einzelrisiko";
  return "";
}

function trafficLightLabel(t: "green" | "yellow" | "red"): string {
  if (t === "green") return "Niedrig";
  if (t === "yellow") return "Erhöht";
  return "Kritisch";
}

/** Einheitliche Fläche für Arbeitsblöcke (heller als reine Engine-Karten). */
function workSurfaceStyle(): React.CSSProperties {
  return {
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    background: T.surface,
    padding: T.space.lg,
  };
}

function ZoneTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header style={{ marginBottom: T.space.md }}>
      {kicker ? (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.faint,
            marginBottom: 6,
          }}
        >
          {kicker}
        </div>
      ) : null}
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>{title}</h2>
      {subtitle ? (
        <p style={{ margin: "6px 0 0", fontSize: 13, color: T.muted, lineHeight: 1.5, maxWidth: 640 }}>{subtitle}</p>
      ) : null}
    </header>
  );
}

export function DetailContent({ id, canPdfExport = true }: { id: string; canPdfExport?: boolean }) {
  const [item, setItem] = React.useState<AnalyseItem | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expandedRiskId, setExpandedRiskId] = React.useState<string | null>(null);
  const [expandedTechnicalRiskId, setExpandedTechnicalRiskId] = React.useState<string | null>(null);
  const [depthOpen, setDepthOpen] = React.useState(false);
  const [exportLoading, setExportLoading] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  /** PDF: nur bei aktivem Haken werden interne Team-Notizen mit exportiert (Default: aus). */
  const [pdfIncludeInternalNotes, setPdfIncludeInternalNotes] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [titleSaving, setTitleSaving] = React.useState(false);
  const [titleError, setTitleError] = React.useState<string | null>(null);
  const [lvStatusDraft, setLvStatusDraft] = React.useState<LvStatusKey>("offen");
  const [bidDraft, setBidDraft] = React.useState("");
  const [bidAmountFocused, setBidAmountFocused] = React.useState(false);
  const [vorgangSaving, setVorgangSaving] = React.useState(false);
  const [vorgangError, setVorgangError] = React.useState<string | null>(null);
  const [manualProjectData, setManualProjectData] = React.useState<ManualProjectData>({});
  const router = useRouter();

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

  React.useEffect(() => {
    if (!item) return;
    const rj = (item.result_json ?? {}) as Record<string, unknown>;
    setManualProjectData(parseManualProjectData(rj.manualProjectData));
  }, [item?.id, item?.result_json]);

  React.useEffect(() => {
    if (item) {
      setTitleDraft(item.project_name?.trim() ?? "");
      setTitleError(null);
    }
  }, [item?.id, item?.project_name]);

  React.useEffect(() => {
    if (!item) return;
    setLvStatusDraft(normalizeLvStatus(item.lv_status ?? undefined));
    setBidDraft(bidNetToInputString(parseBidAmountNetFromDb(item.bid_amount_net)));
    setVorgangError(null);
  }, [item?.id, item?.lv_status, item?.bid_amount_net]);

  const handleSaveManualField = React.useCallback(
    async (key: ManualProjectFieldKey, value: string) => {
      const trimmed = value.trim();
      const updatedAt = new Date().toISOString();
      setManualProjectData((prev) => {
        const next = { ...prev };
        if (trimmed) next[key] = { manualValue: trimmed, updatedAt };
        else delete next[key];
        return next;
      });
      const patch =
        trimmed.length > 0
          ? { [key]: { manualValue: trimmed, updatedAt } }
          : { [key]: { manualValue: "", updatedAt } };
      try {
        const res = await fetch(`/api/analyse/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultJsonMerge: { manualProjectData: patch } }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Speichern fehlgeschlagen.");
        if (data?.item) setItem(data.item as AnalyseItem);
      } catch {
        try {
          const res = await fetch(`/api/analyse/${id}`);
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.item) setItem(data.item as AnalyseItem);
        } catch {
          /* ignore */
        }
      }
    },
    [id],
  );

  const titleDirty = React.useMemo(() => {
    if (!item) return false;
    return (
      normalizeEditableTitleInput(titleDraft, item.file_name) !==
      normalizeEditableTitleInput(item.project_name ?? "", item.file_name)
    );
  }, [item, titleDraft]);

  const handleSaveTitle = React.useCallback(async () => {
    if (!item || !titleDirty) return;
    setTitleSaving(true);
    setTitleError(null);
    try {
      const res = await fetch(`/api/analyse/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: titleDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Titel konnte nicht gespeichert werden.");
      if (data?.item) setItem(data.item as AnalyseItem);
    } catch (e: unknown) {
      setTitleError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setTitleSaving(false);
    }
  }, [id, item, titleDirty, titleDraft]);

  const vorgangDirty = React.useMemo(() => {
    if (!item) return false;
    const curLv = normalizeLvStatus(item.lv_status ?? undefined);
    const curBid = parseBidAmountNetFromDb(item.bid_amount_net);
    const draftBid = parseBidAmountNetInput(bidDraft);
    const bidEqual =
      (draftBid == null && curBid == null) || (draftBid != null && curBid != null && draftBid === curBid);
    return lvStatusDraft !== curLv || !bidEqual;
  }, [item, lvStatusDraft, bidDraft]);

  const handleSaveVorgang = React.useCallback(async () => {
    if (!item || !vorgangDirty) return;
    setVorgangSaving(true);
    setVorgangError(null);
    try {
      const res = await fetch(`/api/analyse/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lvStatus: lvStatusDraft,
          bidAmountNet: parseBidAmountNetInput(bidDraft),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Speichern fehlgeschlagen.");
      if (data?.item) setItem(data.item as AnalyseItem);
    } catch (e: unknown) {
      setVorgangError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setVorgangSaving(false);
    }
  }, [id, item, vorgangDirty, lvStatusDraft, bidDraft]);

  const handlePdfExport = React.useCallback(async () => {
    if (!item || !canPdfExport) return;
    setExportError(null);
    setExportLoading(true);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: item.id,
          includeInternalTeamNotes: pdfIncludeInternalNotes,
        }),
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
  }, [item, id, canPdfExport, pdfIncludeInternalNotes]);

  const handleDelete = React.useCallback(async () => {
    if (!item || !window.confirm("Diese Analyse unwiderruflich löschen? Alle zugehörigen Daten (Ergebnis, Score, Rückfragen etc.) werden entfernt.")) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/analyse/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Löschen fehlgeschlagen");
      router.push("/app/analysen");
    } catch {
      setDeleteLoading(false);
      window.alert("Analyse konnte nicht gelöscht werden. Bitte erneut versuchen.");
    }
  }, [item, id, router]);

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

  const report = buildPdfReport(
    {
      result_json: item.result_json,
      management_summary: item.management_summary,
      score: item.score,
      project_name: item.project_name,
      file_name: item.file_name,
      created_at: item.created_at,
    },
    { includeInternalTeamNotes: false },
  );

  const scoreResult = rj.scoreResult as { total?: number; level?: string; findingsSorted?: RiskFinding[] } | undefined;
  const changeOrder = rj.changeOrderAnalysis as {
    offerStrategySummary?: { executiveSummary?: string };
    opportunities?: unknown[];
  } | undefined;
  const findingsSorted = scoreResult?.findingsSorted;

  const displayScore = item.score ?? scoreResult?.total ?? null;
  const displaySummary = report.summary.executiveSummary?.trim() || null;

  const mappedStatus = mapStatus(item.status);

  const detailManualBundle = buildProjectInfoManualBundle(buildKeyFactsDisplayListQuick(rj), manualProjectData);
  const questions = sortQuestions(report.questions ?? []);
  const offerClarifications = report.clarifications ?? [];
  const hasQuestions = questions.length > 0;
  const hasOfferClarifications = offerClarifications.length > 0;
  const cp = report.claimPotential;
  const hasClaimPotential = !!(cp && Object.keys(cp).length > 0);
  const hasChangeOrder = !!(
    changeOrder &&
    (changeOrder.offerStrategySummary != null || (Array.isArray(changeOrder.opportunities) && changeOrder.opportunities.length > 0))
  );
  const showNachtragFallback = !hasClaimPotential && hasChangeOrder;

  const scoreMeta = scoreToLabel(displayScore);
  const categoryScores = Array.isArray(report.categoryScores) ? report.categoryScores : [];
  const hasCategoryScores = categoryScores.length > 0;

  const topFromReport: PdfTopRiskItem[] = report.topRisks ?? [];
  const sortedFindings = Array.isArray(findingsSorted) ? sortFindingsByPriority(findingsSorted) : [];
  const fallbackTopSlice = sortedFindings.slice(0, 8);
  const useReportTop = topFromReport.length > 0;
  const hasTopRisksBlock = useReportTop || fallbackTopSlice.length > 0;

  const hideClaimTopRisksList = topFromReport.length > 0;
  const hasMoreFindingsThanTop = Array.isArray(findingsSorted) && findingsSorted.length > (useReportTop ? topFromReport.length : fallbackTopSlice.length);

  const nextSteps = report.nextSteps ?? [];
  const legalSignalsReport = report.legalSignals ?? [];
  const hasLegalSignals = legalSignalsReport.length > 0;

  return (
    <>
      {/* A. Berichtskopf */}
      <div style={{ marginBottom: T.space.xl }}>
        <div style={{ marginBottom: T.space.md, display: "flex", alignItems: "center", gap: T.space.md, flexWrap: "wrap" }}>
          <Link href="/app/analysen" style={{ fontSize: 13, fontWeight: 600, color: T.muted, textDecoration: "none" }}>
            ← Analysen
          </Link>
          <span style={{ color: T.faint }}>/</span>
          <span style={{ fontSize: 12, color: T.faint, letterSpacing: "0.04em", textTransform: "uppercase" }}>Gespeicherter Bericht</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: T.space.lg }}>
          <div style={{ minWidth: 0, flex: "1 1 280px" }}>
            <label htmlFor="analyse-title-edit" style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint, marginBottom: 8 }}>
              Analyse-Titel
            </label>
            <input
              id="analyse-title-edit"
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder={getAnalysisDisplayTitle(null, item.file_name)}
              autoComplete="off"
              style={{
                display: "block",
                width: "100%",
                maxWidth: 560,
                boxSizing: "border-box",
                margin: 0,
                padding: "10px 12px",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: T.text,
                lineHeight: 1.25,
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm,
                outline: "none",
              }}
            />
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              {titleDirty ? (
                <button
                  type="button"
                  onClick={() => void handleSaveTitle()}
                  disabled={titleSaving}
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0c1222",
                    background: T.accent,
                    border: "none",
                    borderRadius: T.radiusSm,
                    cursor: titleSaving ? "not-allowed" : "pointer",
                    opacity: titleSaving ? 0.75 : 1,
                  }}
                >
                  {titleSaving ? "Speichern…" : "Titel speichern"}
                </button>
              ) : null}
              {titleError ? <span style={{ fontSize: 13, color: T.danger }}>{titleError}</span> : null}
            </div>
            <div
              style={{
                marginTop: T.space.md,
                paddingTop: T.space.sm,
                borderTop: `1px solid ${T.border}`,
                maxWidth: 560,
              }}
            >
              <div
                style={{
                  padding: `${T.space.sm}px ${T.space.md}px`,
                  borderRadius: T.radiusSm,
                  border: `1px solid ${T.border}`,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: T.faint,
                    marginBottom: 4,
                  }}
                >
                  Bearbeitung & Angebot
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: T.muted, lineHeight: 1.45 }}>
                  Diese Angaben dienen nur Ihrer internen Verwaltung und ändern weder Analyse noch PDF.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200, flex: "1 1 180px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Bearbeitungsstatus</span>
                    <select
                      value={lvStatusDraft}
                      onChange={(e) => setLvStatusDraft(e.target.value as LvStatusKey)}
                      style={{
                        padding: "8px 10px",
                        fontSize: 13,
                        borderRadius: T.radiusSm,
                        border: `1px solid ${T.border}`,
                        background: T.card,
                        color: T.text,
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      {LV_STATUS_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {LV_STATUS_LABEL_DE[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180, flex: "1 1 180px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Angebotsbetrag netto in €</span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "stretch",
                        borderRadius: T.radiusSm,
                        border: `1px solid ${bidAmountFocused ? "rgba(100, 116, 139, 0.45)" : T.border}`,
                        background: T.card,
                        boxShadow: bidAmountFocused ? "0 0 0 2px rgba(100, 116, 139, 0.1)" : "none",
                        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                        maxWidth: 260,
                      }}
                    >
                      <input
                        type="text"
                        inputMode="decimal"
                        value={bidDraft}
                        onChange={(e) => setBidDraft(e.target.value)}
                        onFocus={() => setBidAmountFocused(true)}
                        onBlur={() => setBidAmountFocused(false)}
                        placeholder="z. B. 125.000,50 €"
                        autoComplete="off"
                        aria-label="Angebotsbetrag netto in Euro"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          padding: "8px 10px",
                          fontSize: 13,
                          color: T.text,
                        }}
                      />
                      <span
                        style={{
                          padding: "8px 10px",
                          fontSize: 13,
                          fontWeight: 600,
                          color: T.muted,
                          background: "rgba(148, 163, 184, 0.08)",
                          borderLeft: `1px solid ${T.border}`,
                          userSelect: "none",
                          lineHeight: 1.25,
                          display: "flex",
                          alignItems: "center",
                        }}
                        aria-hidden
                      >
                        €
                      </span>
                    </div>
                  </label>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      flex: "0 0 auto",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSaveVorgang()}
                      disabled={!vorgangDirty || vorgangSaving}
                      style={{
                        padding: "9px 14px",
                        fontSize: 13,
                        fontWeight: vorgangDirty ? 700 : 600,
                        letterSpacing: vorgangDirty ? "0.01em" : "0",
                        color: vorgangDirty ? "#0c1222" : T.muted,
                        background: vorgangDirty ? T.accent : T.card,
                        border: `1px solid ${vorgangDirty ? "rgba(224, 124, 94, 0.55)" : T.border}`,
                        borderRadius: T.radiusSm,
                        boxShadow: vorgangDirty ? "0 1px 0 rgba(0,0,0,0.22),0 2px 8px rgba(224, 124, 94, 0.2)" : "none",
                        cursor: !vorgangDirty || vorgangSaving ? "not-allowed" : "pointer",
                        opacity: vorgangSaving ? 0.85 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {vorgangSaving ? "Speichern…" : "Vorgang speichern"}
                    </button>
                  </div>
                </div>
                {vorgangError ? (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: T.danger }}>{vorgangError}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <p
              style={{
                margin: `${T.space.md}px 0 0`,
                paddingTop: T.space.sm,
                borderTop: `1px solid ${T.border}`,
                fontSize: 12,
                color: T.muted,
                lineHeight: 1.5,
              }}
            >
              {item.created_at ? new Date(item.created_at).toLocaleString("de-DE") : "—"}
              {mappedStatus ? (
                <>
                  {" · "}
                  <span>{mappedStatus}</span>
                </>
              ) : null}
              {item.file_name ? (
                <>
                  {" · "}
                  <span title={item.file_name}>Datei: {item.file_name}</span>
                </>
              ) : null}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            {canPdfExport ? (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  color: T.muted,
                  cursor: exportLoading ? "default" : "pointer",
                  userSelect: "none",
                  maxWidth: 280,
                  textAlign: "right",
                  lineHeight: 1.35,
                }}
              >
                <input
                  type="checkbox"
                  checked={pdfIncludeInternalNotes}
                  onChange={(e) => setPdfIncludeInternalNotes(e.target.checked)}
                  disabled={exportLoading}
                  style={{ width: 16, height: 16, flexShrink: 0, cursor: exportLoading ? "not-allowed" : "pointer" }}
                />
                Interne Notizen einbeziehen
              </label>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {!canPdfExport && (
                <>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>PDF nur in Pro</span>
                  <Link href="/pricing" style={{ fontSize: 12, fontWeight: 600, color: T.accent, textDecoration: "none" }}>
                    → Pro
                  </Link>
                </>
              )}
              <button
                type="button"
                onClick={handlePdfExport}
                disabled={exportLoading || !canPdfExport}
                style={{
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0c1222",
                  background: T.accent,
                  border: "none",
                  borderRadius: T.radiusSm,
                  cursor: exportLoading || !canPdfExport ? "not-allowed" : "pointer",
                  opacity: exportLoading || !canPdfExport ? 0.7 : 1,
                }}
              >
                {exportLoading ? "PDF …" : "PDF exportieren"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.danger ?? "#f87171",
                  background: "transparent",
                  border: `1px solid ${T.border}`,
                  borderRadius: T.radiusSm,
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                  opacity: deleteLoading ? 0.7 : 1,
                }}
              >
                {deleteLoading ? "Löschen …" : "Löschen"}
              </button>
            </div>
          </div>
        </div>
        {exportError ? <p style={{ margin: "12px 0 0", fontSize: 13, color: T.danger }}>{exportError}</p> : null}
      </div>

      {/* B. Management-Zone */}
      <section
        style={{
          marginBottom: T.space.xl,
          padding: T.space.lg,
          borderRadius: T.radius,
          border: `1px solid ${T.border}`,
          background: `linear-gradient(135deg, ${T.surface} 0%, rgba(224,124,94,0.06) 100%)`,
          borderLeft: `4px solid ${T.accent}`,
        }}
      >
        <ZoneTitle
          kicker="Entscheidung & Einordnung"
          title="Management"
          subtitle="Kurzfassung für Abstimmung mit Angebots- und Kalkulationsteam."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: T.space.lg, alignItems: "start" }}>
          {displaySummary ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Management Summary
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: T.muted, whiteSpace: "pre-wrap" }}>{displaySummary}</div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: T.faint }}>Kein Management Summary hinterlegt.</p>
          )}
          <div
            style={{
              padding: T.space.md,
              borderRadius: T.radiusSm,
              border: `1px solid ${T.border}`,
              background: "rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Gesamtbewertung
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: T.text, lineHeight: 1 }}>{displayScore != null ? displayScore : "—"}</span>
              <span style={{ fontSize: 13, color: T.muted }}>/ 100</span>
            </div>
            {report.summary.totalRiskLabel ? (
              <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: T.text }}>{report.summary.totalRiskLabel}</div>
            ) : null}
            {scoreMeta ? (
              <p style={{ margin: "10px 0 0", fontSize: 13, color: T.muted, lineHeight: 1.55 }}>{scoreMeta.description}</p>
            ) : null}
          </div>
        </div>
      </section>

      {/* C. Arbeits-Zone */}
      <section style={{ marginBottom: T.space.xl }}>
        <ZoneTitle
          kicker="Operative Bearbeitung"
          title="Arbeitsbereiche"
          subtitle="Eckdaten, priorisierte Risiken, Rückfragen, Klarstellungen und Strategie – in der Reihenfolge der Bearbeitung."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: T.space.lg }}>
          {nextSteps.length > 0 ? (
            <div style={workSurfaceStyle()}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Nächste Schritte · vor Angebotsabgabe
              </div>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: T.muted, lineHeight: 1.65 }}>
                {nextSteps.map((s, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div style={workSurfaceStyle()}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: T.space.md }}>Projektinformationen aus dem Leistungsverzeichnis</div>
            <p style={{ margin: `0 0 ${T.space.md}px`, fontSize: 13, color: T.muted, lineHeight: 1.5, maxWidth: 640 }}>
              Erkannte Eckdaten und manuelle Ergänzungen (getrennt gekennzeichnet).
            </p>
            <ProjectInfoManualLayer
              rows={detailManualBundle.rows}
              notesRow={detailManualBundle.notesRow}
              sanitize={sanitizeForDisplay}
              canPersist
              onSaveField={handleSaveManualField}
            />
          </div>

          {hasTopRisksBlock ? (
            <div style={workSurfaceStyle()}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>Top-Risiken</div>
              <p style={{ margin: `0 0 ${T.space.md}px`, fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
                Priorisiert nach Dringlichkeit – fachliche Kurzeinordnung ohne Bewertungsrohdaten.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: T.space.md }}>
                {useReportTop
                  ? topFromReport.map((tr, i) => {
                      const key = `tr-${i}-${tr.title}`;
                      return (
                        <div
                          key={key}
                          style={{
                            padding: T.space.md,
                            borderRadius: T.radiusSm,
                            border: `1px solid ${T.border}`,
                            background: "rgba(0,0,0,0.12)",
                          }}
                        >
                          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>{tr.title}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                            {tr.categoryLabel ? (
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)" }}>
                                {tr.categoryLabel}
                              </span>
                            ) : null}
                            {tr.severityHint ? (
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.warning, padding: "4px 8px", borderRadius: 6, background: "rgba(251,191,36,0.1)" }}>
                                {tr.severityHint}
                              </span>
                            ) : null}
                          </div>
                          {tr.detail ? (
                            <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.6 }}>{cleanRiskProse(tr.detail)}</p>
                          ) : null}
                          {Array.isArray(tr.pruefHinweise) && tr.pruefHinweise.length > 0 ? (
                            <div
                              style={{
                                marginTop: 10,
                                padding: "10px 12px",
                                borderRadius: T.radiusSm,
                                border: `1px solid ${T.border}`,
                                background: "rgba(96, 165, 250, 0.08)",
                              }}
                            >
                              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>Prüfhinweise</div>
                              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
                                {tr.pruefHinweise.map((line, hi) => (
                                  <li key={hi} style={{ marginBottom: 4 }}>
                                    {sanitizeForDisplay(line)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  : fallbackTopSlice.map((f, i) => {
                      const riskId = f.id ?? `fb-${i}`;
                      const catKey = (f.category ?? "").trim();
                      const catLabel = catKey ? RISK_CATEGORY_LABELS[catKey] ?? labelUnknownCategory(catKey) : "";
                      const titleText = (f.title ?? "").trim() || `Risiko ${i + 1}`;
                      const rawDetail = (f.detail ?? "").toString();
                      const cleaned = cleanRiskProse(rawDetail);
                      const sev = severityLabelDe(f.severity);
                      const isOpen = expandedRiskId === riskId;
                      const techOpen = expandedTechnicalRiskId === riskId;
                      return (
                        <div
                          key={riskId}
                          style={{
                            padding: T.space.md,
                            borderRadius: T.radiusSm,
                            border: `1px solid ${T.border}`,
                            background: "rgba(0,0,0,0.12)",
                          }}
                        >
                          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>{titleText}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                            {catLabel ? (
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)" }}>
                                {catLabel}
                              </span>
                            ) : null}
                            {sev ? (
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.warning, padding: "4px 8px", borderRadius: 6, background: "rgba(251,191,36,0.1)" }}>
                                {sev}
                              </span>
                            ) : null}
                          </div>
                          {cleaned ? (
                            <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                              {isOpen || cleaned.length <= 320 ? cleaned : `${cleaned.slice(0, 320)}…`}
                            </p>
                          ) : null}
                          {cleaned && cleaned.length > 320 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedRiskId(isOpen ? null : riskId)}
                              style={{
                                marginTop: 10,
                                padding: 0,
                                border: "none",
                                background: "none",
                                fontSize: 12,
                                fontWeight: 600,
                                color: T.accent,
                                cursor: "pointer",
                              }}
                            >
                              {isOpen ? "Weniger" : "Vollständige Einordnung"}
                            </button>
                          ) : null}
                          {(() => {
                            const ph = collectPruefHinweiseFromFinding(f, MAX_PRUEF_HINWEISE_STANDARD);
                            if (ph.length === 0) return null;
                            return (
                              <div
                                style={{
                                  marginTop: 12,
                                  padding: "10px 12px",
                                  borderRadius: T.radiusSm,
                                  border: `1px solid ${T.border}`,
                                  background: "rgba(96, 165, 250, 0.08)",
                                }}
                              >
                                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>Prüfhinweise</div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>
                                  {ph.map((line, hi) => (
                                    <li key={hi} style={{ marginBottom: 4 }}>
                                      {sanitizeForDisplay(line)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })()}
                          {(typeof f.penalty === "number" || rawDetail.length > 0) ? (
                            <div style={{ marginTop: 10 }}>
                              <button
                                type="button"
                                onClick={() => setExpandedTechnicalRiskId(techOpen ? null : riskId)}
                                style={{
                                  padding: 0,
                                  border: "none",
                                  background: "none",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: T.faint,
                                  cursor: "pointer",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                }}
                              >
                                {techOpen ? "Technische Details ausblenden" : "Technische Details (optional)"}
                              </button>
                              {techOpen ? (
                                <div
                                  style={{
                                    marginTop: 8,
                                    padding: T.space.sm,
                                    borderRadius: T.radiusSm,
                                    border: `1px dashed ${T.border}`,
                                    fontSize: 12,
                                    color: T.faint,
                                    fontFamily: "ui-monospace, monospace",
                                    whiteSpace: "pre-wrap",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {typeof f.penalty === "number" ? <div>Interner Abzug (Kategorie): {f.penalty}</div> : null}
                                  {rawDetail ? <div style={{ marginTop: 6 }}>{rawDetail}</div> : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
              </div>
            </div>
          ) : null}

          {hasLegalSignals ? (
            <div style={workSurfaceStyle()}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>Vertraglich auffällige Punkte</div>
              <p style={{ margin: `0 0 ${T.space.md}px`, fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
                Aus dem Vortext erkannte Formulierungen mit praktischer Angebotsrelevanz (keine Rechtsbewertung).
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: T.space.md }}>
                {legalSignalsReport.map((ls, i) => (
                  <div
                    key={`ls-${i}-${ls.title}`}
                    style={{
                      padding: T.space.md,
                      borderRadius: T.radiusSm,
                      border: `1px solid ${T.border}`,
                      background: "rgba(0,0,0,0.08)",
                      borderLeft: `3px solid ${T.muted}`,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, flex: "1 1 12rem", lineHeight: 1.35 }}>
                        {ls.title}
                      </div>
                      {ls.severityLabel ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: T.faint }}>{ls.severityLabel}</span>
                      ) : null}
                    </div>
                    {ls.summary ? (
                      <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.55 }}>{ls.summary}</p>
                    ) : null}
                    {ls.recommendation ? (
                      <p style={{ margin: `${T.space.sm}px 0 0`, fontSize: 13, fontWeight: 600, color: T.accent, lineHeight: 1.5 }}>
                        {ls.recommendation}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasQuestions ? (
            <div style={workSurfaceStyle()}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>Rückfragen an Auftraggeber / Planung</div>
              <p style={{ margin: `0 0 ${T.space.md}px`, fontSize: 13, color: T.muted }}>
                Priorisierte Bieterfragen – für E-Mail oder Rückfragenliste.
              </p>
              <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", counterReset: "rq" }}>
                {questions.map((q, i) => (
                  <li
                    key={i}
                    style={{
                      counterIncrement: "rq",
                      marginBottom: T.space.md,
                      padding: T.space.md,
                      borderRadius: T.radiusSm,
                      border: `1px solid ${T.border}`,
                      background: "rgba(0,0,0,0.1)",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{i + 1}.</span>
                      {q.categoryLabel ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{q.categoryLabel}</span>
                      ) : null}
                      {isHighPriority(q.priority) ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.danger, padding: "2px 8px", borderRadius: 999, background: "rgba(248,113,113,0.12)" }}>
                          Dringend
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 14, color: T.text, lineHeight: 1.6 }}>
                      {q.title ? <strong>{q.title}: </strong> : null}
                      {q.text}
                    </div>
                    {q.priority != null && q.priority !== "" && !isHighPriority(q.priority) ? (
                      <div style={{ marginTop: 6, fontSize: 12, color: T.faint }}>Priorität: {String(q.priority)}</div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {hasOfferClarifications ? (
            <div style={workSurfaceStyle()}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>Angebotsklarstellungen</div>
              <p style={{ margin: `0 0 ${T.space.md}px`, fontSize: 13, color: T.muted }}>Formulierungen für Anschreiben oder Anlage – zum Übernehmen.</p>
              <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                {offerClarifications.map((c, i) => (
                  <li
                    key={i}
                    style={{
                      marginBottom: T.space.md,
                      padding: T.space.md,
                      borderRadius: T.radiusSm,
                      border: `1px solid ${T.border}`,
                      background: "rgba(0,0,0,0.1)",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{i + 1}.</span>
                      {c.categoryLabel ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.categoryLabel}</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 14, color: T.text, lineHeight: 1.65 }}>
                      {c.title ? <strong>{c.title}: </strong> : null}
                      {c.text}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {(hasClaimPotential || showNachtragFallback) && (
            <div style={{ ...workSurfaceStyle(), borderLeft: `4px solid ${T.accent}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6 }}>Nachtragspotenzial & Angebotsstrategie</div>
              <p style={{ margin: `0 0 ${T.space.md}px`, fontSize: 13, color: T.muted }}>Einordnung, Maßnahmen und Verhandlung aus der Strategieauswertung.</p>
              {hasClaimPotential && cp ? (
                <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.65 }}>
                  {cp.executiveSummary ? (
                    <div style={{ marginBottom: T.space.md }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>Einordnung</div>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{cp.executiveSummary}</p>
                    </div>
                  ) : null}
                  {cp.finalRecommendation ? (
                    <div style={{ marginBottom: T.space.md }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>Empfehlung & Strategie</div>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{cp.finalRecommendation}</p>
                    </div>
                  ) : null}
                  {cp.immediateActions && cp.immediateActions.length > 0 ? (
                    <div style={{ marginBottom: T.space.md }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>Sofortmaßnahmen</div>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {cp.immediateActions.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {cp.topNegotiationPoints && cp.topNegotiationPoints.length > 0 ? (
                    <div style={{ marginBottom: T.space.md }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>Verhandlungspunkte</div>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {cp.topNegotiationPoints.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {!hideClaimTopRisksList && cp.topRisks && cp.topRisks.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>Zusätzliche Stichworte</div>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {cp.topRisks.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : showNachtragFallback && changeOrder ? (
                <>
                  {typeof changeOrder.offerStrategySummary?.executiveSummary === "string" && changeOrder.offerStrategySummary.executiveSummary.trim() ? (
                    <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{changeOrder.offerStrategySummary.executiveSummary}</div>
                  ) : Array.isArray(changeOrder.opportunities) && changeOrder.opportunities.length > 0 ? (
                    <p style={{ margin: 0, fontSize: 14, color: T.muted }}>{changeOrder.opportunities.length} Einträge im Nachtragspotenzial.</p>
                  ) : (
                    <p style={{ margin: 0, fontSize: 14, color: T.muted }}>Daten aus der Nachtragsanalyse vorhanden.</p>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {/* D. Vertiefung */}
      {(hasCategoryScores || hasMoreFindingsThanTop) && (
        <section style={{ marginBottom: T.space.xl }}>
          <button
            type="button"
            onClick={() => setDepthOpen(!depthOpen)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: T.space.md,
              borderRadius: T.radius,
              border: `1px solid ${T.border}`,
              background: "rgba(0,0,0,0.2)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              Vertiefung · optional
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Score-Kategorien & technische Details</div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{depthOpen ? "Einklappen" : "Ausklappen – für Kalkulation und Feinarbeit"}</div>
          </button>
          {depthOpen ? (
            <div style={{ marginTop: T.space.md, padding: T.space.lg, borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.card }}>
              {hasCategoryScores ? (
                <div style={{ marginBottom: hasMoreFindingsThanTop ? T.space.xl : 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: T.space.md }}>Score nach Kategorien</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: T.space.md }}>
                    {categoryScores.map((cat: PdfCategoryScore) => (
                      <div
                        key={cat.key}
                        style={{
                          padding: T.space.md,
                          borderRadius: T.radiusSm,
                          border: `1px solid ${T.border}`,
                          background: T.surface,
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{cat.label}</div>
                        <div style={{ marginTop: 6, fontSize: 13, color: T.muted }}>
                          {cat.score != null ? `${cat.score} Punkte` : ""}
                          {cat.trafficLight ? (
                            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600 }}>· Ampel: {trafficLightLabel(cat.trafficLight)}</span>
                          ) : null}
                        </div>
                        {cat.shortReason ? <p style={{ margin: "8px 0 0", fontSize: 13, color: T.muted }}>{cat.shortReason}</p> : null}
                        {cat.topDrivers && cat.topDrivers.length > 0 ? (
                          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: T.faint }}>
                            {cat.topDrivers.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasMoreFindingsThanTop && Array.isArray(findingsSorted) ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: T.space.sm }}>Alle Einzelrisiken (Liste)</div>
                  <p style={{ margin: `0 0 ${T.space.md}px`, fontSize: 12, color: T.faint }}>
                    Vollständige Liste aus der Bewertung – bei Bedarf mit Rohdetails.
                  </p>
                  {(() => {
                    const byCat: Record<string, RiskFinding[]> = {};
                    findingsSorted.forEach((f) => {
                      const key = (f.category ?? "ohne_kategorie") || "ohne_kategorie";
                      if (!byCat[key]) byCat[key] = [];
                      byCat[key].push(f);
                    });
                    const groups = Object.entries(byCat).sort((a, b) =>
                      (RISK_CATEGORY_LABELS[a[0]] ?? a[0]).localeCompare(RISK_CATEGORY_LABELS[b[0]] ?? b[0], "de")
                    );
                    return groups.map(([catKey, items]) => (
                      <div key={catKey} style={{ marginBottom: T.space.lg }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.faint, marginBottom: 8 }}>
                          {RISK_CATEGORY_LABELS[catKey] ?? labelUnknownCategory(catKey)}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: T.space.sm }}>
                          {items.map((f, i) => {
                            const riskId = f.id ?? `${catKey}-${i}`;
                            const titleText = (f.title ?? "").trim() || `Risiko ${i + 1}`;
                            const rawDetail = (f.detail ?? "").toString();
                            return (
                              <div
                                key={riskId}
                                style={{
                                  padding: T.space.sm,
                                  borderRadius: T.radiusSm,
                                  border: `1px solid ${T.border}`,
                                  fontSize: 12,
                                  color: T.muted,
                                }}
                              >
                                <div style={{ fontWeight: 600, color: T.text }}>{titleText}</div>
                                <div style={{ marginTop: 4 }}>{cleanRiskProse(rawDetail) || "—"}</div>
                                <details style={{ marginTop: 8 }}>
                                  <summary style={{ cursor: "pointer", fontSize: 11, color: T.faint }}>Technische Rohdaten</summary>
                                  <div style={{ marginTop: 6, fontFamily: "ui-monospace, monospace", fontSize: 11, color: T.faint, whiteSpace: "pre-wrap" }}>
                                    {typeof f.penalty === "number" ? `Abzug: ${f.penalty}\n` : ""}
                                    {rawDetail}
                                  </div>
                                </details>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      )}

      <p style={{ margin: `0 0 ${T.space.xl}px`, fontSize: 12, color: T.faint, lineHeight: 1.6, maxWidth: 560 }}>{report.disclaimer.text}</p>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: T.space.md }}>
        <Link href="/app/analysen" style={{ fontSize: 13, fontWeight: 600, color: T.accent, textDecoration: "none" }}>
          ← Zurück zur Liste
        </Link>
        <span style={{ color: T.faint }}>·</span>
        <Link
          href="/app/analyse"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 14px",
            borderRadius: T.radiusSm,
            fontSize: 13,
            fontWeight: 600,
            color: "#0c1222",
            background: T.accent,
            textDecoration: "none",
          }}
        >
          Neue Analyse starten
        </Link>
      </div>
    </>
  );
}
