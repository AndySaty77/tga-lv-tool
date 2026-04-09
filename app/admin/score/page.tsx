// app/admin/score/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Lesansicht } from "@/components/Lesansicht";
import { PositionenNodeView } from "@/components/PositionenNodeView";
import { VorbemerkungenDocumentView } from "@/components/VorbemerkungenDocumentView";
import { NachtragspotenzialBlock } from "@/components/NachtragspotenzialBlock";
import { VortextDetailModal } from "@/components/VortextDetailModal";
import { AnalyseCockpitView, type AnalyseCockpitViewProps } from "@/components/AnalyseCockpitView";
import { sanitizeForDisplay, stripTechnicalNoiseForDisplay } from "@/lib/displayText";
import { normalizeViewerPositionenText, normalizeViewerVorbemerkungenText } from "@/lib/gaebViewerNormalize";
import type { ChangeOrderResult } from "@/lib/changeOrderAnalysis";
import { AMPEL_THRESHOLDS } from "@/lib/scoringConfig";
import { DEFAULT_TEXTS_CONFIG } from "@/lib/textsConfig";
import { formatTradeConfidence, formatTradeConfidencePercent } from "@/lib/detectedTrades";
import { KEYFACT_LABELS } from "@/lib/keyFactsDefinition";
import {
  KEYFACTS_DISPLAY_ORDER_12,
  KEYFACT_FALLBACK_LABEL,
  getDisplayValueForStatus,
  type KeyFactFieldEntry,
} from "@/lib/keyFactsValidation";
import { PAGE_DESIGN } from "@/lib/ui/pageDesign";
import { SectionCard, StatusBadge } from "@/components/ui";
import { colors as themeColors } from "@/lib/ui/theme";
import Link from "next/link";
import { appTheme as T } from "@/components/app/appTheme";
import { getAnalysisDisplayTitle } from "@/lib/analysisDisplayTitle";
import { computeSavedReportCompleteness } from "@/lib/savedReportCompleteness";
import type { PlanId } from "@/lib/billing/plans";
import {
  parseManualProjectData,
  buildProjectInfoManualBundle,
  resolveDisplayProjectName,
  type ManualProjectData,
  type ManualProjectFieldKey,
} from "@/lib/manualProjectData";

/** Einheitliches Design für alle Tabs (Rückfragen, Risiken, Angebotsklarstellungen, Admin). */
const D = PAGE_DESIGN;

/** Kundenroute (/app/analyse): Dark-Oberflächen wie Header und gespeicherte Berichte (appTheme). */
const CX = {
  card: T.card,
  surface: T.surface,
  border: T.border,
  text: T.text,
  muted: T.muted,
  faint: T.faint,
  accent: T.accent,
  shadow: "0 1px 3px rgba(0,0,0,0.15)",
  /** Intro-/Hinweisboxen (ersetzt helles Blau) */
  intro: "rgba(224, 124, 94, 0.12)",
  chip: "rgba(255,255,255,0.1)",
  barTrack: "rgba(255,255,255,0.1)",
  inputBg: "rgba(255,255,255,0.06)",
  filterBg: "rgba(255,255,255,0.05)",
  rowHairline: "rgba(255,255,255,0.08)",
} as const;

/** Dark-Route: Oberflächen-Tokens für eingebettete Previews (ohne Konflikt mit PAGE_DESIGN-Literaltypen). */
type CustomerSurfaceTokens = {
  primary?: string;
  cardBg?: string;
  cardBorder?: string;
  textPrimary?: string;
  textSecondary?: string;
  textMuted?: string;
  filterBg?: string;
  pageBg?: string;
};

type CategoryKey =
  | "vertrags_lv_risiken"
  | "mengen_massenermittlung"
  | "technische_vollstaendigkeit"
  | "schnittstellen_nebenleistungen"
  | "kalkulationsunsicherheit";

const CATEGORY_ORDER: CategoryKey[] = [
  "vertrags_lv_risiken",
  "mengen_massenermittlung",
  "technische_vollstaendigkeit",
  "schnittstellen_nebenleistungen",
  "kalkulationsunsicherheit",
];

const GAEB_TABS = ["raw", "structure", "basis_vortext", "basis_positions"] as const;
type GaebTab = (typeof GAEB_TABS)[number];

/** Kategorie-Labels aus zentraler Textkonfiguration (kundenfreundlich). */
function catLabel(k: string) {
  return DEFAULT_TEXTS_CONFIG.internal.categoryLabels[k as keyof typeof DEFAULT_TEXTS_CONFIG.internal.categoryLabels] ?? k;
}

function clamp0_100(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function traffic(score: number) {
  const ampel = DEFAULT_TEXTS_CONFIG.customerUI.ampel;
  if (score >= AMPEL_THRESHOLDS.redMin) return { dot: "🔴", text: ampel.red, tone: "#b00020" };
  if (score >= AMPEL_THRESHOLDS.yellowMin) return { dot: "🟡", text: ampel.yellow, tone: "#a36b00" };
  return { dot: "🟢", text: ampel.green, tone: "#0a7a2f" };
}

function ScoreBarRow(props: { k: CategoryKey; value: number }) {
  const v = clamp0_100(props.value);
  const amp = traffic(v);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr 60px 80px",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <div style={{ fontWeight: 900, color: "#111" }}>{catLabel(props.k)}</div>

      <div
        style={{
          height: 14,
          borderRadius: 999,
          background: "#f0f0f0",
          border: "1px solid #e5e5e5",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${v}%`,
            height: "100%",
            background: amp.tone,
            borderRadius: 999,
            transition: "width 200ms",
          }}
        />
      </div>

      <div style={{ textAlign: "right", fontWeight: 900 }}>{v}</div>

      <div style={{ textAlign: "right", fontWeight: 900, color: amp.tone }}>
        {amp.dot} {amp.text}
      </div>
    </div>
  );
}

function ScoreBarsCard(props: { perCategory: Record<string, number>; total: number }) {
  const total = clamp0_100(props.total);
  const totalAmp = traffic(total);

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#111" }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.riskAmpelJeKategorie}</div>
        <div style={{ fontWeight: 900, color: totalAmp.tone }}>
          Gesamt: {total} {totalAmp.dot} {totalAmp.text}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {CATEGORY_ORDER.map((k) => (
          <ScoreBarRow key={k} k={k} value={props.perCategory?.[k] ?? 0} />
        ))}
      </div>

      <div style={{ marginTop: 10, color: "#666", fontSize: 12, fontWeight: 700 }}>
        {DEFAULT_TEXTS_CONFIG.customerUI.ampelLegend}
      </div>
    </div>
  );
}

type Finding = {
  id: string;
  category: string; // Key
  title: string;
  detail?: string;
  severity: "low" | "medium" | "high" | string;
  penalty: number;
};

type DebugBlock = {
  detectedDisciplines?: string[];
  triggersUsed?: number;
  llmMode?: boolean;
  findingsBeforeLlm?: number;
  findingsAfterLlm?: number;
  perCategorySum?: Record<string, number>;
  sizeF?: number;
  scoringConfigVersion?: number | string;
  easing?: string;
};

type DetectedTradesResult = {
  primaryTrade: string | null;
  secondaryTrades: string[];
  confidence: number | string | null;
  signals?: string[];
  scores?: Record<string, number>;
};

type ScoreResult = {
  total: number;
  level: "hochriskant" | "mittel" | "solide" | "sauber" | string;
  perCategory: Record<string, number>; // Keys
  findingsSorted: Finding[];
  detectedTrades?: DetectedTradesResult | null;
  debug?: DebugBlock;
  llmMode?: boolean;
  findingsBeforeLlm?: number;
  findingsAfterLlm?: number;
  /** V1: optionale Vertrags-/Vergabesignale (API legalSignals) */
  legalSignals?: Array<{
    id: string;
    signalType: string;
    title: string;
    summary: string;
    severity: string;
    confidence?: number;
    recommendedAction?: string;
  }>;
  internalScores?: {
    nachtragspotenzialV2?: {
      exposureScore: number;
      enforceabilityScore: number;
      potentialScore: number;
      subscores: {
        vertrags_abgrenzung: number;
        ausfuehrung_mengen: number;
        doku_ibn: number;
        durchsetzbarkeit: number;
      };
      commodityCaps: {
        family: string;
        raw: number;
        capped: number;
        cap: number;
      }[];
      anchors: {
        id: string;
        label: string;
        fired: boolean;
        impactExposure?: number;
        impactEnforceability?: number;
        reason?: string;
      }[];
      drivers: string[];
      blockers: string[];
      notes?: string[];
    };
  };
};

function levelMeta(level?: string) {
  switch (level) {
    case "hochriskant":
      return { label: "HOCHRISIKO", dot: "🔴" };
    case "mittel":
      return { label: "MITTEL", dot: "🟠" };
    case "solide":
      return { label: "SOLIDE", dot: "🟢" };
    case "sauber":
      return { label: "SAUBER", dot: "🔵" };
    default:
      return { label: level ?? "-", dot: "⚪️" };
  }
}

function severityDot(sev: string) {
  if (sev === "high") return "🔴";
  if (sev === "medium") return "🟠";
  return "🟡";
}

/** Risiko-Label für Darstellung (aus zentraler Textconfig). */
function severityLabel(sev: string) {
  const L = DEFAULT_TEXTS_CONFIG.internal.severityLabels;
  if (sev === "high") return L.high;
  if (sev === "medium") return L.medium;
  return L.low;
}

function isDbFinding(f: Finding) {
  return (f.id ?? "").startsWith("DB_");
}
function isSysFinding(f: Finding) {
  return (f.id ?? "").startsWith("SYS_");
}
function isLlmFinding(f: Finding) {
  return (f.id ?? "").startsWith("LLM_");
}
function stripPrefix(id: string) {
  return id.replace(/^DB_/, "").replace(/^SYS_/, "").replace(/^LLM_/, "");
}

function fmtKB(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

const MAX_FILE_BYTES = 10_000_000; // 10 MB MVP-Limit

type SourceFilter = "both" | "db" | "sys" | "llm";
type SeverityFilter = "all" | "high" | "medium" | "low";
type SortMode = "penalty_desc" | "severity_desc" | "category_az";

const severityRank = (sev: string) => {
  if (sev === "high") return 3;
  if (sev === "medium") return 2;
  if (sev === "low") return 1;
  return 0;
};

// ===== VORTEXT (LLM) TYPES =====
type RiskClause = {
  type: string;
  riskLevel: "low" | "medium" | "high";
  text: string;
  interpretation: string;
};

function riskIcon(level: "low" | "medium" | "high") {
  if (level === "high") return "🔴";
  if (level === "medium") return "🟡";
  return "🟢";
}

function riskTone(level: "low" | "medium" | "high") {
  if (level === "high") return "#b00020";
  if (level === "medium") return "#a36b00";
  return "#0a7a2f";
}

/**
 * UI-seitig: Vortext grob aus Anfang extrahieren (Fallback).
 */
function extractVortextUI(full: string) {
  const t = (full ?? "").toString();
  if (!t.trim()) return "";

  const HARD_MAX_CHARS = 12000;
  const hardCut = (s: string) => (s.length > HARD_MAX_CHARS ? s.slice(0, HARD_MAX_CHARS) : s);

  const markers = [
    "\ntitel ",
    "\nlos ",
    "\nabschnitt ",
    "\nposition",
    "\npos.",
    "\npos ",
    "\nleistungsverzeichnis",
    "\nkurztext",
    "\nlangtext",
    "\nmenge",
    "\neinheit",
    "\n ep",
    "\ngp",
    "\n€",
    "<position",
    "<pos",
    "<lvpos",
  ];

  const lower = t.toLowerCase();
  let cutIdx = -1;

  for (const m of markers) {
    const i = lower.indexOf(m);
    if (i !== -1) cutIdx = cutIdx === -1 ? i : Math.min(cutIdx, i);
  }

  const candidate = cutIdx > 300 ? t.slice(0, cutIdx) : t;
  return hardCut(candidate.trim());
}

function prettyKey(k: string) {
  return (k ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

// ===== UI KeyFacts: 12 Kern-KeyFacts (zentrale Definition aus keyFactsDefinition) =====
/** Projektinformationen = die 12 Kern-KeyFacts (feste Reihenfolge). */
const PROJEKTDATEN_KEYS_ORDER = KEYFACTS_DISPLAY_ORDER_12;
const PROJEKTDATEN_KEYS = new Set(PROJEKTDATEN_KEYS_ORDER);

/** Vertragsrahmen: vorerst leer – Kern V1 zeigt nur die 9 Projektdaten-KeyFacts. */
const VERTRAGSRAHMEN_KEYS_ORDER: string[] = [];
const VERTRAGSRAHMEN_KEYS = new Set(VERTRAGSRAHMEN_KEYS_ORDER);

// ===== UI KeyFacts Cleaning (Fix) =====
const KEYFACT_HARD_MAX_VALUE = 260;
const VALID_SHORT_KEYFACTS = new Set(["vob", "bgb", "vob/b", "vob b", "vob/c", "vob c"]);

function normKeyFactValue(v: any) {
  let s = (v ?? "").toString();
  if (/<\/?[^>]+>/.test(s)) s = s.replace(/<\/?[^>]+>/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  // Leading punctuation (z. B. ":6 Wochen" -> "6 Wochen", ", MÄNGELANSPRÜCHE" -> "MÄNGELANSPRÜCHE")
  s = s.replace(/^[\s.,;:\-–—]+/, "");
  // Trailing Füllwörter und Satzzeichen
  s = s.replace(/\s*(,?\s*(und|bzw\.?|sowie|oder)\s*)$/i, "").trim();
  s = s.replace(/\s*[,;.:\-–—]+\s*$/, "").trim();
  if (s.length > KEYFACT_HARD_MAX_VALUE) s = s.slice(0, KEYFACT_HARD_MAX_VALUE) + "…";
  return s;
}

function isGarbageKeyFactValue(v: string) {
  const s = (v ?? "").trim();
  if (!s) return true;
  if (s.length <= 8 && VALID_SHORT_KEYFACTS.has(s.toLowerCase().replace(/\s+/g, " "))) return false;
  if (s.length < 4) return true;

  if (/^[\W_]+$/.test(s)) return true;
  if (/^[:;,\.\-–—\s]*\d{1,3}\s*$/.test(s)) return true;
  if (/^,\s*[a-z]$/i.test(s)) return true;
  if (/^(en:|und abnahme:|sfrist|lich|örtlich)$/i.test(s)) return true;

  // Prozeduraler Text statt Name (z. B. QNG-Anforderung in Bauherr-Feld)
  if (/zur\s+Einhaltung\s+der\s+QNG|gemäß\s+beiliegendem\s+QNG-Anforderungskatalog/i.test(s)) return true;

  // offensichtlich abgeschnittene Phrasen (enden mit Artikel/Präposition ohne Fortsetzung)
  if (/\s(den|der|die|dem|das|sonstige|im)\s*$/i.test(s) && s.length < 80) return true;
  if (/\s(oder|und)\s*$/i.test(s) && s.length < 50) return true;
  // einzelne Verben ohne Kontext (z. B. "einzubehalten")
  if (/^[a-zA-ZÄÖÜäöüß]+$/.test(s) && s.length >= 10 && /(halten|behalten|einhalten)$/i.test(s)) return true;

  // KW-Angaben (z. B. "11. KW 2026") sind gültig für Anzeige
  if (/\d{1,2}\.\s*KW\s*\d{4}\b/i.test(s)) return false;

  if (!/[a-zA-ZÄÖÜäöüß]{3,}/.test(s)) return true;
  return false;
}

/** Schwache/ungültige Werte nicht anzeigen (UI-Regel: lieber weniger, aber sauber). */
function isWeakKeyFactValueForDisplay(v: string, field: string): boolean {
  const s = (v ?? "").trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  if (/\bund\/?oder\s+von\s+der\s+schlussrechnung\b/i.test(s)) return true;
  if (field === "submission_einreichung" && /\b(gmbh|ag|co\.\s*kg)\b/i.test(s)) return true;
  if (field === "gewaerhleistung" && /^(gewa[eä]hrleistung|mängelhaftung)(\s+und\s+abnahme)?$/i.test(lower.replace(/\s+/g, " "))) return true;
  if (["fertigstellung", "bauzeit", "baubeginn"].includes(field) && /^(und|oder|von\s+der)\s+/i.test(s)) return true;
  return false;
}

// ===== SPLIT RESULT =====
type SplitResult = {
  vortext: string;
  positions: string;
  meta?: any;
};

export function ScorePage(props: { customerRoute?: boolean; plan?: PlanId; isAdminUser?: boolean } = {}) {
  const { customerRoute = false, plan, isAdminUser = false } = props;
  /** In der Kundenroute: Pro-Features nur bei plan === "pro". Admin-Route: immer erlaubt. */
  const canUseChangeOrder = !customerRoute || plan !== "free";
  const canUseAdvancedFeatures = !customerRoute || plan !== "free";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Nach /api/analyse/save: ID für PATCH (Rückfragen / Angebotsklarstellungen in result_json nachziehen). */
  const savedAnalyseIdRef = useRef<string | null>(null);
  /** Kundenroute: nach erfolgreichem Save — UI für CTA „Bericht öffnen“ (nur bei gültiger ID). */
  const [savedReportBanner, setSavedReportBanner] = useState<{ id: string; titleHint: string } | null>(null);
  /** Manuelle Projektdaten (result_json.manualProjectData) – getrennt von erkannten KeyFacts */
  const [manualProjectData, setManualProjectData] = useState<ManualProjectData>({});
  const clearSavedReportBanner = React.useCallback(() => {
    savedAnalyseIdRef.current = null;
    setSavedReportBanner(null);
    setManualProjectData({});
  }, []);

  useEffect(() => {
    const id = savedReportBanner?.id;
    if (!id || !customerRoute) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/analyse/${id}`);
        const j = (await res.json().catch(() => ({}))) as { item?: { result_json?: unknown } };
        if (!res.ok || cancelled) return;
        const rj = j?.item?.result_json as Record<string, unknown> | undefined;
        setManualProjectData(parseManualProjectData(rj?.manualProjectData));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [savedReportBanner?.id, customerRoute]);

  const patchSavedAnalysisResultJson = React.useCallback(async (resultJsonMerge: Record<string, unknown>) => {
    if (!customerRoute) return;
    const id = savedAnalyseIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/analyse/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultJsonMerge }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("[analyse PATCH]", j?.error ?? res.status);
      }
    } catch (e) {
      console.error("[analyse PATCH]", e);
    }
  }, [customerRoute]);

  const [lvText, setLvText] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  /** 'file' = Datei wird vorbereitet (sofortiges Feedback), 'analyze' = mehrstufige Analyseanzeige. */
  const [loadingPhase, setLoadingPhase] = useState<"file" | "analyze">("analyze");
  /** Fortschritts-Schritt für die Analyse-Warteanzeige (0–5), zeitbasiert. */
  const [analysisStep, setAnalysisStep] = useState(0);
  /** Rotierender Unterstatus im letzten Schritt (nur UI, bessere Fortschrittswahrnehmung). */
  const [lastStepSubIndex, setLastStepSubIndex] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  // ===== GAEB PREVIEW STATE =====
  const [gaebPreviewLoading, setGaebPreviewLoading] = useState(false);
  const [gaebPreviewError, setGaebPreviewError] = useState<string | null>(null);
  const [gaebPreview, setGaebPreview] = useState<any>(null);
  const [gaebTab, setGaebTab] = useState<GaebTab>("basis_vortext");

  /** Transparenz-Tab: Index des aufklappbaren Finding-Details (null = keins). */
  const [transparenzExpandedIndex, setTransparenzExpandedIndex] = useState<number | null>(null);

  // ===== SPLIT (LLM) STATE =====
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [split, setSplit] = useState<SplitResult | null>(null);

  // ===== VORTEXT (LLM) STATE =====
  const [vortextLoading, setVortextLoading] = useState(false);
  const [vortextError, setVortextError] = useState<string | null>(null);
  const [riskClauses, setRiskClauses] = useState<RiskClause[]>([]);
  /** Index des geöffneten Vortext-/Risiko-Detail-Modals (Risiken im Einleitungstext). */
  const [riskClauseDetailIndex, setRiskClauseDetailIndex] = useState<number | null>(null);
  const [keyFacts, setKeyFacts] = useState<Record<string, string>>({});
  // optional: falls Route später confidence liefert
  const [keyFactConfidence, setKeyFactConfidence] = useState<Record<string, number>>({});
  /** Validierte KeyFacts inkl. Status (found/missing/rejected) aus analyze-vortext API */
  const [keyFactsValidated, setKeyFactsValidated] = useState<Record<string, KeyFactFieldEntry> | null>(null);
  /** Debug: Quelle der KeyFacts (aus analyze-vortext API) */
  const [keyFactsDebug, setKeyFactsDebug] = useState<{
    keyFactsSourceMode?: string;
    keyFactsWithSource?: Array<{
      field: string;
      value: string;
      sourceTextType: string;
      sourcePath: string;
      confidence: number;
      acceptedByPositivePattern?: boolean;
      rejectedByNegativePattern?: boolean;
      validationReason?: string;
      extractionMode?: "label" | "heuristic" | "llm" | "none";
      matchedLabel?: string;
      rawMatchedText?: string;
      cleanedCandidateValue?: string;
      llmConfidence?: string;
      llmReason?: string;
      llmRawValue?: string;
    }>;
    llmFallbackUsed?: boolean;
    llmFieldsRequested?: string[];
    llmFieldsAccepted?: string[];
    llmFieldsRejected?: string[];
    llmRawResponse?: string;
    llmParsedResponse?: Record<string, unknown> | null;
    llmFallbackDebugPerField?: Record<string, { llmWasRequested: boolean; llmRawValue?: string; llmValidated: boolean; llmRejectedReason?: string; llmRejectedByNegativePattern?: boolean; llmRejectedByRequiredSignal?: boolean; garbageCheckReason?: string }>;
    mergeWinnerPerField?: Record<string, string>;
    overwrittenByLegacy?: Record<string, boolean>;
    previousValueBeforeLegacyMerge?: Record<string, string>;
  } | null>(null);

  // Nur Admin/Debug: expliziter Toggle für V2-Anzeige im Nachtrag-Tab.
  const [showNachtragV2Debug, setShowNachtragV2Debug] = useState(false);

  // ===== RÜCKFRAGEN (CLARIFICATION QUESTIONS) =====
  const [clarificationQuestions, setClarificationQuestions] = useState<{
    questions: Array<{
      id: string;
      category: string;
      severity: string;
      question: string;
      reason: string;
      sourceFindingId?: string;
      sourceTextSnippet?: string;
    }>;
    byGroup: Record<string, Array<unknown>>;
    debug: Array<{ source: string; sourceId?: string; questionId: string; question: string }>;
  } | null>(null);

  // ===== NACHTRAGSANALYSE =====
  const [clarificationQuestionsLoading, setClarificationQuestionsLoading] = useState(false);
  const [changeOrderLoading, setChangeOrderLoading] = useState(false);
  // Steuert die neue KI-Veredelung der Nachtragspotenziale (ChangePotential-LLM).
  const [useChangePotentialLlm, setUseChangePotentialLlm] = useState(false);
  const [changeOrderAnalysis, setChangeOrderAnalysis] = useState<ChangeOrderResult | null>(null);

  // ===== ANGEBOTS-ANNAHMEN =====
  const [offerAssumptionsLoading, setOfferAssumptionsLoading] = useState(false);
  const [offerAssumptions, setOfferAssumptions] = useState<{
    assumptions: Array<{
      id: string;
      category: string;
      severity: string;
      assumption: string;
      reason: string;
      sourceFindingId?: string;
      sourceQuestionId?: string;
    }>;
    byGroup: Record<string, Array<unknown>>;
    debug: Array<{ findingId?: string; questionId?: string; assumptionId: string; assumption: string }>;
  } | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("both");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("penalty_desc");
  const [top10, setTop10] = useState(false);
  const [useLlmRelevance, setUseLlmRelevance] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("admin.settings.useLlmRelevanceDefault") === "true";
    } catch {
      return false;
    }
  });

  /** UI-Modus: nur Darstellung (sichtbare Tabs, Detailoptionen). Keine Logik-Änderung, keine Neuberechnung. */
  const [analysisMode, setAnalysisMode] = useState<"standard" | "expert">(() => {
    if (typeof window === "undefined") return "standard";
    try {
      const v = localStorage.getItem("admin.settings.analysisModeDefault");
      return v === "expert" ? "expert" : "standard";
    } catch {
      return "standard";
    }
  });
  const isExpertMode = analysisMode === "expert";

  /** Aktiver Tab der Analyse-Ausgabe (nur Darstellung). */
  type ResultTabId = "uebersicht" | "risiken" | "vorbemerkungen" | "positionen" | "nachtragspotenzial" | "rueckfragen" | "angebotsklarstellungen" | "trigger" | "transparenz";
  const [resultTab, setResultTab] = useState<ResultTabId>("uebersicht");
  const [vorbemerkungenModalOpen, setVorbemerkungenModalOpen] = useState(false);
  const [vorbemerkungenSearchQuery, setVorbemerkungenSearchQuery] = useState("");
  const [vorbemerkungenCurrentHitIndex, setVorbemerkungenCurrentHitIndex] = useState(0);
  const [positionenSearchQuery, setPositionenSearchQuery] = useState("");
  const [positionenCurrentHitIndex, setPositionenCurrentHitIndex] = useState(0);

  const totalAmp = traffic(clamp0_100(result?.total ?? 0));
  const projectNameForCustomer = (keyFacts as Record<string, string> | undefined)?.objektbezeichnung
    ?? (keyFacts as Record<string, string> | undefined)?.projektbezeichnung
    ?? null;

  const resetVortext = () => {
    setVortextError(null);
    setRiskClauses([]);
    setKeyFacts({});
    setKeyFactConfidence({});
    setKeyFactsValidated(null);
    setKeyFactsDebug(null);
    setVortextLoading(false);
    setClarificationQuestions(null);
    setOfferAssumptions(null);
    setChangeOrderAnalysis(null);
    setOfferAssumptionsLoading(false);
  };

  const resetGaebPreview = () => {
    setGaebPreview(null);
    setGaebPreviewError(null);
    setGaebPreviewLoading(false);
    setGaebTab("basis_vortext");
  };

  const resetSplit = () => {
    setSplit(null);
    setSplitError(null);
    setSplitLoading(false);
  };

  const generateClarificationQuestions = async () => {
    const findings = result?.findingsSorted ?? [];
    if (findings.length === 0 && riskClauses.length === 0 && Object.keys(keyFacts).length === 0) return;
    setClarificationQuestionsLoading(true);
    try {
      const res = await fetch("/api/clarification-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findings,
          riskClauses,
          keyFacts,
          ...(changeOrderAnalysis?.changePotentialSummary && { changePotentialSummary: changeOrderAnalysis.changePotentialSummary }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Rückfragen fehlgeschlagen");
      setClarificationQuestions(data);
      void patchSavedAnalysisResultJson({ clarificationQuestions: data });
    } catch {
      console.error("Clarification questions: Fehler");
      setClarificationQuestions(null);
    } finally {
      setClarificationQuestionsLoading(false);
    }
  };

  const generateChangeOrderAnalysis = async () => {
    const findings = result?.findingsSorted ?? [];
    if (findings.length === 0 && riskClauses.length === 0 && Object.keys(keyFacts).length === 0) return;
    setChangeOrderLoading(true);
    setChangeOrderAnalysis(null);
    try {
      const structureVortext = gaebPreview?.structure
        ? gaebPreview.structure.raw.full.slice(0, gaebPreview.structure.raw.vortextEnd)
        : "";
      const structurePositions = gaebPreview?.structure?.positionen?.raw ?? "";
      const vortextForCo = (split?.vortext ?? structureVortext ?? extractVortextUI(lvText)).trim();
      const positionsForCo = (split?.positions ?? structurePositions ?? "").trim();

      const res = await fetch("/api/change-order-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findings,
          riskClauses,
          keyFacts,
          vortext: vortextForCo,
          lvPositions: positionsForCo,
          useChangePotentialLlm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Nachtragsanalyse fehlgeschlagen");
      setChangeOrderAnalysis(data as ChangeOrderResult);
      void patchSavedAnalysisResultJson({ changeOrderAnalysis: data });
    } catch {
      console.error("Change order analysis: Fehler");
      setChangeOrderAnalysis(null);
    } finally {
      setChangeOrderLoading(false);
    }
  };

  const generateOfferAssumptions = async () => {
    const findings = result?.findingsSorted ?? [];
    const questions = clarificationQuestions?.questions ?? [];
    if (findings.length === 0 && riskClauses.length === 0 && Object.keys(keyFacts).length === 0) return;
    setOfferAssumptionsLoading(true);
    setOfferAssumptions(null);
    try {
      const res = await fetch("/api/offer-assumptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findings,
          riskClauses,
          keyFacts,
          clarificationQuestions: questions,
          ...(changeOrderAnalysis?.changePotentialSummary && { changePotentialSummary: changeOrderAnalysis.changePotentialSummary }),
          useLlm: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Annahmen fehlgeschlagen");
      setOfferAssumptions(data);
      void patchSavedAnalysisResultJson({ offerAssumptions: data });
    } catch {
      console.error("Offer assumptions: Fehler");
      setOfferAssumptions(null);
    } finally {
      setOfferAssumptionsLoading(false);
    }
  };

  const runGaebPreview = async (file: File): Promise<any | null> => {
    resetGaebPreview();
    setGaebPreviewLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/gaeb-preview", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || j?.error || "gaeb-preview failed");
      setGaebPreview(j);
      if (j?.normalized) setGaebTab("structure");
      return j;
    } catch (e: any) {
      setGaebPreviewError(e?.message || "gaeb-preview failed");
      setGaebPreview(null);
      return null;
    } finally {
      setGaebPreviewLoading(false);
    }
  };

  const runGaebSplitLLM = async (file: File): Promise<SplitResult | null> => {
    resetSplit();
    setSplitLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/gaeb-split-llm", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || j?.error || "gaeb-split-llm failed");
      const s: SplitResult = {
        vortext: String(j?.vortext ?? ""),
        positions: String(j?.positions ?? ""),
        meta: j?.meta ?? j?.debug ?? null,
      };
      setSplit(s);
      return s;
    } catch (e: any) {
      setSplitError(e?.message || "gaeb-split-llm failed");
      setSplit(null);
      return null;
    } finally {
      setSplitLoading(false);
    }
  };

  type VortextSource = {
    sourceTextType: "normalized-global-remarks" | "normalized-top-label" | "normalized-groups" | "normalized-group-remarks" | "normalized-items" | "displayNodes" | "legacy-preface-text" | "legacy-cleaned-text" | "raw-text";
    sourcePath: string;
    keyFactsSourceMode: "normalized-structure" | "legacy-text" | "mixed";
  };

  type NormalizedPayload = {
    globalRemarks: string[];
    topLabelForPreface?: string;
    groups: { label: string }[];
    groupRemarks?: string[];
  };

  type VortextResult = { keyFacts: Record<string, string>; riskClauses: unknown[]; keyFactsDebug: object | null };

  const analyzeVortextLLM = async (
    vortext: string,
    vortextSource?: VortextSource,
    options?: { normalized?: NormalizedPayload; formatDetected?: string }
  ): Promise<VortextResult | null> => {
    setVortextLoading(true);
    setVortextError(null);
    setRiskClauses([]);
    setKeyFacts({});
    setKeyFactConfidence({});
    setKeyFactsDebug(null);

    try {
      const body: Record<string, unknown> = {
        text: vortext,
        ...(vortextSource && { vortextSource }),
      };
      if (options?.formatDetected === "gaeb-xml" && options?.normalized) {
        body.formatDetected = "gaeb-xml";
        body.normalized = options.normalized;
      }
      const vRes = await fetch("/api/analyze-vortext", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const vData = await vRes.json();

      if (!vRes.ok) {
        setVortextError(vData?.message || vData?.error || "Vortext Analyse fehlgeschlagen");
        setRiskClauses([]);
        setKeyFacts({});
        setKeyFactConfidence({});
        setKeyFactsValidated(null);
        return null;
      }
      const clauses = Array.isArray(vData?.riskClauses) ? vData.riskClauses : [];
      setRiskClauses(clauses);

      const facts = vData?.keyFacts && typeof vData.keyFacts === "object" ? vData.keyFacts : {};
      setKeyFacts(facts);

      const conf =
        vData?.keyFactConfidence && typeof vData.keyFactConfidence === "object" ? vData.keyFactConfidence : {};
      setKeyFactConfidence(conf);

      const validated =
        vData?.keyFactsValidated && typeof vData.keyFactsValidated === "object" ? vData.keyFactsValidated : null;
      setKeyFactsValidated(validated);

      const debug =
        vData?.keyFactsDebug && typeof vData.keyFactsDebug === "object"
          ? {
              keyFactsSourceMode: vData.keyFactsDebug.keyFactsSourceMode,
              llmFallbackUsed: vData.keyFactsDebug.llmFallbackUsed,
              llmFieldsRequested: vData.keyFactsDebug.llmFieldsRequested,
              llmFieldsAccepted: vData.keyFactsDebug.llmFieldsAccepted,
              llmFieldsRejected: vData.keyFactsDebug.llmFieldsRejected,
              llmRawResponse: vData.keyFactsDebug.llmRawResponse,
              llmParsedResponse: vData.keyFactsDebug.llmParsedResponse,
              llmFallbackDebugPerField: vData.keyFactsDebug.llmFallbackDebugPerField,
              mergeWinnerPerField: vData.keyFactsDebug.mergeWinnerPerField,
              overwrittenByLegacy: vData.keyFactsDebug.overwrittenByLegacy,
              previousValueBeforeLegacyMerge: vData.keyFactsDebug.previousValueBeforeLegacyMerge,
              keyFactsWithSource: Array.isArray(vData.keyFactsDebug.keyFactsWithSource)
                ? vData.keyFactsDebug.keyFactsWithSource
                : undefined,
            }
          : null;
      setKeyFactsDebug(debug);
      return { keyFacts: facts, riskClauses: clauses, keyFactsDebug: debug };
    } catch (e: any) {
      setVortextError(e?.message || "Vortext Analyse fehlgeschlagen");
      setRiskClauses([]);
      setKeyFacts({});
      setKeyFactConfidence({});
      setKeyFactsValidated(null);
      setKeyFactsDebug(null);
      return null;
    } finally {
      setVortextLoading(false);
    }
  };

  const analyze = async (
    textOverride?: string,
    options?: { gaebPreviewData?: any; splitData?: SplitResult | null; sourceFileName?: string }
  ) => {
    const textToUse = (textOverride ?? lvText).trim();
    if (!textToUse) {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    setLoadingPhase("analyze");
    setResult(null);
    clearSavedReportBanner();
    resetVortext();

    try {
      // Debug-Modus: immer ?debug=1 für echte Analyse (firedFindings etc. sichtbar)
      const apiUrl = "/api/score?debug=1";

      // Datenquelle: Override (frisch aus loadFile) oder State
      const preview = options?.gaebPreviewData ?? gaebPreview;
      const splitUsed = options?.splitData ?? split;

      // Score-Payload: Split-LLM bevorzugt, sonst GaebStructure (Preview) als Fallback
      const structureVortext = preview?.structure
        ? preview.structure.raw.full.slice(0, preview.structure.raw.vortextEnd)
        : "";
      const structurePositions = preview?.structure ? preview.structure.positionen.raw : "";

      const payload: any = { lvText: textToUse, useLlmRelevance };
      if (splitUsed?.vortext || splitUsed?.positions || structureVortext || structurePositions) {
        payload.vortext = (splitUsed?.vortext ?? structureVortext ?? "").trim();
        payload.positions = (splitUsed?.positions ?? structurePositions ?? "").trim();
      }

      // Gewerkserkennung in /api/score: disciplineText nutzt fileName/projectName (Route) – vorher oft leer.
      const effectiveSourceFileNameForScore =
        (typeof options?.sourceFileName === "string" && options.sourceFileName.trim() ? options.sourceFileName.trim() : null) ??
        (typeof fileMeta?.name === "string" && fileMeta.name.trim() ? fileMeta.name.trim() : null) ??
        (typeof lastFile?.name === "string" && lastFile.name.trim() ? lastFile.name.trim() : null);
      if (effectiveSourceFileNameForScore) {
        payload.fileName = effectiveSourceFileNameForScore;
      }
      // Nur manueller Projektname: keyFacts sind im gleichen Takt nach resetVortext noch nicht zuverlässig befüllt.
      const projectNameForScore = resolveDisplayProjectName(manualProjectData, {}).trim();
      if (projectNameForScore) {
        payload.projectName = projectNameForScore;
      }

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`API ${res.status}: ${t}`);
      }

      const data = (await res.json()) as ScoreResult;
      setResult(data);
      setClarificationQuestions(null);
      setOfferAssumptions(null);

      if (typeof window !== "undefined" && (data as any)?.debug) {
        console.log("SCORE DEBUG", (data as any).debug);
      }

      const cats = new Set((data.findingsSorted ?? []).map((f) => f.category));
      if (categoryFilter !== "all" && !cats.has(categoryFilter)) setCategoryFilter("all");

      // ===== VORTEXT ANALYSE =====
      // Bei gaeb-xml: KeyFacts primär aus normalisierter Struktur; Legacy-Vortext nur für Risiken + Fallback
      const vortextForRisk =
        (splitUsed?.vortext ?? "").trim() ||
        structureVortext.trim() ||
        extractVortextUI(textToUse);

      const vortextSource: VortextSource = (splitUsed?.vortext ?? "").trim()
        ? { sourceTextType: "legacy-cleaned-text", sourcePath: "split.vortext", keyFactsSourceMode: "legacy-text" }
        : structureVortext.trim()
          ? { sourceTextType: "legacy-preface-text", sourcePath: "structure.raw.full[0:vortextEnd]", keyFactsSourceMode: "legacy-text" }
          : { sourceTextType: "raw-text", sourcePath: "extractVortextUI(lvText)", keyFactsSourceMode: "legacy-text" };

      const norm = preview?.normalized as { remarks?: { text: string; scope?: string }[]; topLabelForPreface?: string; groups?: { label: string }[] } | undefined;
      const normalizedPayload: NormalizedPayload | undefined =
        norm && Array.isArray(norm.remarks) && Array.isArray(norm.groups)
          ? {
              globalRemarks: (norm.remarks as { text: string; scope?: string }[]).filter((r) => r.scope === "global").map((r) => r.text ?? ""),
              topLabelForPreface: norm.topLabelForPreface,
              groups: (norm.groups as { label: string }[]).map((g) => ({ label: g?.label ?? "" })),
              groupRemarks: (norm.remarks as { text: string; scope?: string }[]).filter((r) => r.scope === "group").map((r) => r.text ?? ""),
            }
          : undefined;
      const isGaebXml = preview?.debug?.formatDetected === "gaeb-xml" || (preview?.normalized != null && Array.isArray((preview.normalized as any)?.remarks));

      let vortextResult: VortextResult | null = null;
      if (vortextForRisk.trim().length > 0 || normalizedPayload) {
        vortextResult = await analyzeVortextLLM(vortextForRisk, vortextSource, isGaebXml && normalizedPayload ? { normalized: normalizedPayload, formatDetected: "gaeb-xml" } : undefined);
      } else {
        setVortextError("Vortext ist leer (Split/Extraktion hat nichts geliefert).");
      }

      // Persistenz erst nach Score + Vortext (keyFacts), damit project_name und resultJson möglichst vollständig sind
      if (props.customerRoute && data) {
        try {
          const kf = vortextResult?.keyFacts ?? {};
          const nameKeysInOrder = [
            "objektbezeichnung",
            "projektbezeichnung",
            "bauvorhaben",
            "projekt",
            "objekt",
            "titel",
            "lvTitel",
            "bezeichnung",
          ];
          let nameFromKeyFacts: string | null = null;
          for (const key of nameKeysInOrder) {
            const raw = (kf as Record<string, unknown>)[key];
            if (typeof raw === "string") {
              const trimmed = raw.trim();
              if (trimmed) {
                nameFromKeyFacts = trimmed;
                break;
              }
            }
          }

          // Wichtig: fileMeta/lastFile sind im selben Takt wie setFileMeta noch stale (Closure vor Re-Render).
          // Dateiname daher immer aus options.sourceFileName (loadFile) oder Fallback nach State.
          const effectiveSourceFileName =
            (typeof options?.sourceFileName === "string" && options.sourceFileName.trim() ? options.sourceFileName.trim() : null) ??
            (typeof fileMeta?.name === "string" && fileMeta.name.trim() ? fileMeta.name.trim() : null) ??
            (typeof lastFile?.name === "string" && lastFile.name.trim() ? lastFile.name.trim() : null);

          const projectName =
            nameFromKeyFacts ??
            (effectiveSourceFileName ?? "Unbenannte Analyse");

          const execSummary = (changeOrderAnalysis as ChangeOrderResult | null)?.offerStrategySummary?.executiveSummary;
          const payload = {
            projectName,
            fileName: effectiveSourceFileName,
            score: data.total,
            status: "completed",
            managementSummary: typeof execSummary === "string" && execSummary.trim() ? execSummary : null,
            resultJson: {
              scoreResult: data,
              changeOrderAnalysis,
              clarificationQuestions,
              offerAssumptions,
              keyFacts: vortextResult?.keyFacts ?? {},
              riskClauses: vortextResult?.riskClauses ?? [],
              keyFactsDebug: vortextResult?.keyFactsDebug ?? null,
              gaebPreview,
              split,
              ...(Array.isArray(data.legalSignals) && data.legalSignals.length > 0 ? { legalSignals: data.legalSignals } : {}),
            },
          };
          try {
            const saveRes = await fetch("/api/analyse/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const saveJson = (await saveRes.json().catch(() => ({}))) as {
              item?: { id?: string; project_name?: string | null; file_name?: string | null };
            };
            const savedRow = saveJson?.item;
            if (saveRes.ok && savedRow?.id && typeof savedRow.id === "string") {
              const savedId: string = savedRow.id;
              savedAnalyseIdRef.current = savedId;
              setSavedReportBanner({
                id: savedId,
                titleHint: getAnalysisDisplayTitle(savedRow.project_name, savedRow.file_name),
              });
            } else {
              clearSavedReportBanner();
            }
          } catch {
            clearSavedReportBanner();
          }
        } catch {
          // Fehler bei der Vorbereitung der Persistenz ignorieren
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  // Fortschritts-Schritte für die Warteanzeige (alle ~2 s weiter)
  useEffect(() => {
    if (!loading) {
      setAnalysisStep(0);
      setLastStepSubIndex(0);
      setLoadingPhase("analyze");
      return;
    }
    setLastStepSubIndex(0);
    const interval = setInterval(() => {
      setAnalysisStep((s) => Math.min(s + 1, 5));
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  // Im letzten Schritt: rotierende Unterstatus-Texte (nur UI, keine Backend-Logik)
  const isLastStep = loading && analysisStep === 5;
  useEffect(() => {
    if (!isLastStep) {
      setLastStepSubIndex(0);
      return;
    }
    const subInterval = setInterval(() => {
      setLastStepSubIndex((i) => (i + 1) % 4);
    }, 3000);
    return () => clearInterval(subInterval);
  }, [isLastStep]);

  const loadFile = async (file: File) => {
    setError(null);
    setResult(null);
    clearSavedReportBanner();
    resetVortext();
    resetGaebPreview();
    resetSplit();
    setLastFile(file);

    if (file.size > MAX_FILE_BYTES) {
      setFileMeta({ name: file.name, size: file.size });
      setLvText("");
      setError(`Datei zu groß (${fmtKB(file.size)}). Limit aktuell: 10 MB.`);
      return;
    }

    // Sofort Ladeanzeige, damit Nutzer direkt Feedback sieht (vor allen async Schritten)
    if (autoAnalyze) {
      setLoading(true);
      setLoadingPhase("file");
      setAnalysisStep(0);
    }

    try {
      // 1) Preview (Debug)
      const previewData = await runGaebPreview(file);

      // 2) LLM Split (Echte Trennung, stabiler als Guess)
      const splitData = await runGaebSplitLLM(file);

      // 3) Originaltext in Textarea (Debug/Transparenz)
      const text = await file.text();
      setFileMeta({ name: file.name, size: file.size });
      setLvText(text);

      if (autoAnalyze) {
        setLoadingPhase("analyze");
        setAnalysisStep(0);
        await analyze(text, {
          gaebPreviewData: previewData ?? undefined,
          splitData: splitData ?? undefined,
          sourceFileName: file.name,
        });
      }
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Laden oder bei der Analyse");
      if (autoAnalyze) setLoading(false);
    } finally {
      if (!autoAnalyze) setLoading(false);
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    await loadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await loadFile(file);
  };

  const availableFindingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const f of result?.findingsSorted ?? []) set.add(f.category);
    const arr = Array.from(set);

    arr.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a as any);
      const ib = CATEGORY_ORDER.indexOf(b as any);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });

    return arr;
  }, [result]);

  const filteredFindings = useMemo(() => {
    const all = result?.findingsSorted ?? [];
    const q = search.trim().toLowerCase();

    let list = all.filter((f) => {
      if (sourceFilter === "db" && !isDbFinding(f)) return false;
      if (sourceFilter === "sys" && !isSysFinding(f)) return false;
      if (sourceFilter === "llm" && !isLlmFinding(f)) return false;
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;

      if (q) {
        const hay = `${f.title ?? ""} ${f.detail ?? ""} ${f.id ?? ""} ${f.category ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortMode === "penalty_desc") return (b.penalty ?? 0) - (a.penalty ?? 0);
      if (sortMode === "severity_desc") return severityRank(b.severity) - severityRank(a.severity);
      if (sortMode === "category_az") return (a.category ?? "").localeCompare(b.category ?? "");
      return 0;
    });

    if (top10) list = list.slice(0, 10);
    return list;
  }, [result, sourceFilter, severityFilter, categoryFilter, search, sortMode, top10]);

  const dbFindings = useMemo(() => filteredFindings.filter(isDbFinding), [filteredFindings]);
  const sysFindings = useMemo(() => filteredFindings.filter(isSysFinding), [filteredFindings]);
  const llmFindings = useMemo(() => filteredFindings.filter(isLlmFinding), [filteredFindings]);
  const otherFindings = useMemo(
    () => filteredFindings.filter((f) => !isDbFinding(f) && !isSysFinding(f) && !isLlmFinding(f)),
    [filteredFindings]
  );

  /** Nachtragspotenziale nach Titel dedupliziert (nur erste Nennung pro Titel). */
  const deduplicatedOpportunities = useMemo(() => {
    const opps = changeOrderAnalysis?.opportunities ?? [];
    const seen = new Set<string>();
    return opps.filter((o) => {
      const k = (o.title ?? "").trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [changeOrderAnalysis?.opportunities]);

  const resetFilters = () => {
    setSourceFilter("both");
    setSeverityFilter("all");
    setCategoryFilter("all");
    setSearch("");
    setSortMode("penalty_desc");
    setTop10(false);
  };

  // Feste 12 Key Facts: immer alle in Reihenfolge anzeigen; found → Wert, missing/rejected → "im LV nicht zuverlässig erkannt"
  const keyFactsDisplayList = useMemo(() => {
    const validated = keyFactsValidated ?? null;
    const primaryTrade = (result as any)?.detectedTrades?.primaryTrade ?? null;
    return KEYFACTS_DISPLAY_ORDER_12.map((key) => {
      const entry = validated?.[key];
      const status = entry?.status ?? "missing";
      let value: string;
      let isFallback: boolean;
      if (key === "gewerk") {
        if (status === "found" && entry?.value) {
          value = entry.value;
          isFallback = false;
        } else if (primaryTrade) {
          value = primaryTrade;
          isFallback = false;
        } else {
          value = KEYFACT_FALLBACK_LABEL;
          isFallback = true;
        }
      } else {
        value = validated ? getDisplayValueForStatus(entry) : (() => {
          const raw = keyFacts?.[key];
          const norm = raw != null ? normKeyFactValue(raw) : "";
          const valid = !!norm && !isGarbageKeyFactValue(norm) && !isWeakKeyFactValueForDisplay(norm, key);
          const c = Number(keyFactConfidence?.[key]);
          const passesConf = !Number.isFinite(c) || c >= 0.55;
          return valid && passesConf ? norm : KEYFACT_FALLBACK_LABEL;
        })();
        isFallback = value === KEYFACT_FALLBACK_LABEL;
      }
      return {
        key,
        label: KEYFACT_LABELS[key] ?? key,
        value,
        isFallback,
      };
    });
  }, [keyFactsValidated, keyFacts, keyFactConfidence, result]);

  const manualProjectBundle = useMemo(() => {
    if (!customerRoute) return null;
    return buildProjectInfoManualBundle(keyFactsDisplayList, manualProjectData);
  }, [customerRoute, keyFactsDisplayList, manualProjectData]);

  const saveManualProjectField = React.useCallback(
    async (key: ManualProjectFieldKey, value: string) => {
      const id = savedAnalyseIdRef.current;
      if (!id) return;
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
      await patchSavedAnalysisResultJson({ manualProjectData: patch });
    },
    [patchSavedAnalysisResultJson],
  );

  // Vertrags- und Abrechnungsrahmen: Abschlagszahlung, Schlussrechnung, Gewährleistung, Vertragsstrafe
  const keyFactsVertragsrahmen = useMemo((): [string, string][] => {
    const conf = keyFactConfidence ?? {};
    const entries: [string, string][] = Object.entries(keyFacts ?? {})
      .filter(([k]) => VERTRAGSRAHMEN_KEYS.has(k))
      .map(([k, v]) => [k, String(normKeyFactValue(v) ?? "")] as [string, string])
      .filter(([k, v]) => {
        if (!v) return false;
        if (isGarbageKeyFactValue(v)) return false;
        if (isWeakKeyFactValueForDisplay(v, k)) return false;
        const c = Number(conf[k]);
        if (Number.isFinite(c) && c > 0 && c < 0.55) return false;
        return true;
      });
    entries.sort(([a], [b]) => VERTRAGSRAHMEN_KEYS_ORDER.indexOf(a) - VERTRAGSRAHMEN_KEYS_ORDER.indexOf(b));
    return entries;
  }, [keyFacts, keyFactConfidence]);

  /** Alle KeyFacts (12 Projekt + Vertragsrahmen) für Stellen, die die Gesamtanzahl brauchen. */
  const keyFactsEntries = useMemo(
    (): [string, string][] => [
      ...keyFactsDisplayList.map(({ key, value }) => [key, value] as [string, string]),
      ...keyFactsVertragsrahmen.map(([key, value]) => [key, String(value ?? "")] as [string, string]),
    ],
    [keyFactsDisplayList, keyFactsVertragsrahmen]
  );

  // UI-Debug: welche KeyFacts werden angezeigt, welche ausgeblendet und warum (nur für Keys, die in keyFacts vorkommen)
  const { visibleProjectKeyFactKeys, hiddenProjectKeyFactKeys, hiddenReasonPerField } = useMemo(() => {
    const visible: string[] = [];
    const hidden: string[] = [];
    const reasonPerField: Record<string, string> = {};
    const conf = keyFactConfidence ?? {};
    const allowedSet = new Set([...PROJEKTDATEN_KEYS_ORDER, ...VERTRAGSRAHMEN_KEYS_ORDER]);
    for (const k of Object.keys(keyFacts ?? {})) {
      if (!allowedSet.has(k)) continue;
      const v = keyFacts![k];
      const norm = v != null ? normKeyFactValue(v) : "";
      if (!norm) {
        reasonPerField[k] = v != null && String(v).trim() !== "" ? "normKeyFactValue_empty" : "empty";
        hidden.push(k);
        continue;
      }
      if (isGarbageKeyFactValue(norm)) {
        reasonPerField[k] = "isGarbageKeyFactValue";
        hidden.push(k);
        continue;
      }
      if (isWeakKeyFactValueForDisplay(norm, k)) {
        reasonPerField[k] = "isWeakKeyFactValueForDisplay";
        hidden.push(k);
        continue;
      }
      const c = Number(conf[k]);
      if (Number.isFinite(c) && c > 0 && c < 0.55) {
        reasonPerField[k] = "lowConfidence";
        hidden.push(k);
        continue;
      }
      visible.push(k);
    }
    return {
      visibleProjectKeyFactKeys: visible,
      hiddenProjectKeyFactKeys: hidden,
      hiddenReasonPerField: reasonPerField,
    };
  }, [keyFacts, keyFactConfidence]);

  const structureVortext = useMemo(() => {
    const s = gaebPreview?.structure;
    if (!s?.raw) return "";
    return s.raw.full.slice(0, s.raw.vortextEnd);
  }, [gaebPreview?.structure]);

  const structurePositions = useMemo(() => {
    return gaebPreview?.structure?.positionen?.raw ?? "";
  }, [gaebPreview?.structure]);

  /** Strukturierte Vorbemerkungen/Vortext-Quelle. Bei GAEB-XML: nur globale Remarks, sonst LblTx-Fallback. */
  const structuredVortextForView = useMemo(() => {
    const remarks = gaebPreview?.normalized?.remarks;
    if (Array.isArray(remarks)) {
      const globalOnly = remarks.filter((r: any) => r?.scope === "global");
      if (globalOnly.length > 0) {
        const joined = globalOnly.map((r: any) => (r?.text ?? "").trim()).filter(Boolean).join("\n\n");
        if (joined.length > 0) return joined;
      }
      const topLabel = (gaebPreview?.normalized as any)?.topLabelForPreface;
      if (typeof topLabel === "string" && topLabel.trim().length > 0) {
        return topLabel.trim();
      }
    }

    const vorb = (gaebPreview?.structure?.vorbemerkungen ?? "").trim();
    const vort = (gaebPreview?.structure?.vortext ?? "").trim();
    if (vorb || vort) return [vorb, vort].filter(Boolean).join("\n\n").trim();

    const isXml = gaebPreview?.structure?.meta?.formatDetected === "gaeb-xml";
    const preface = (gaebPreview as any)?.vortextFullClean ?? (gaebPreview as any)?.vortextFullRaw;
    if (isXml && typeof preface === "string" && preface.trim().length > 0) {
      return preface.trim();
    }

    return "";
  }, [gaebPreview]);

  const effectiveVortextLen = (split?.vortext ?? structureVortext ?? "").trim().length;
  const effectivePositionsLen = (split?.positions ?? structurePositions ?? "").trim().length;

  /** Explizite Quellenwahl Vorbemerkungen – nur für Verifikation/Debug. */
  const vortextSourceUsed = useMemo((): string => {
    const remarks = gaebPreview?.normalized?.remarks;
    const globalCount = Array.isArray(remarks) ? remarks.filter((r: any) => r?.scope === "global").length : 0;
    if (globalCount > 0 && structuredVortextForView.length > 0) return "global-remarks";
    if ((gaebPreview?.normalized as any)?.topLabelForPreface && structuredVortextForView.length > 0) return "top-label-fallback";
    if (structuredVortextForView.length > 0) {
      const vorb = (gaebPreview?.structure?.vorbemerkungen ?? "").trim();
      const vort = (gaebPreview?.structure?.vortext ?? "").trim();
      return vorb || vort ? "structured-vortext" : "vortextFullClean";
    }
    const s = (split?.vortext ?? "").trim();
    if (s.length > 0) return "split-vortext";
    const g = (gaebPreview?.vortextGuessClean ?? "").trim();
    if (g.length > 0) return "vortextGuessClean";
    const st = (structureVortext ?? "").trim();
    if (st.length > 0) return "structureVortext";
    return "none";
  }, [gaebPreview?.normalized?.remarks, structuredVortextForView, gaebPreview?.structure?.vorbemerkungen, gaebPreview?.structure?.vortext, split?.vortext, gaebPreview?.vortextGuessClean, structureVortext]);

  /** Vortext für die Dokumentleseansicht (Vorbemerkungen-Tab). Strukturierte Quelle bevorzugt; Fallback durch Viewer-Normalisierung. */
  const vortextForDocumentView = useMemo(() => {
    if (structuredVortextForView.length > 0) return structuredVortextForView;
    const raw = (split?.vortext ?? gaebPreview?.vortextGuessClean ?? structureVortext ?? "").trim();
    return normalizeViewerVorbemerkungenText(raw);
  }, [structuredVortextForView, split?.vortext, gaebPreview?.vortextGuessClean, structureVortext]);

  /** Bereinigt und ohne technische Metadaten – nur für Anzeige im Vorbemerkungen-Tab. Inkl. gruppenbezogene remark-only Kategorien aus normalized.remarks (via displayNodes). */
  const vortextForDocumentViewDisplay = useMemo(() => {
    let base = vortextForDocumentView;
    const nodes = gaebPreview?.normalized?.displayNodes;
    if (Array.isArray(nodes) && nodes.length > 0) {
      const groupBlocks: string[] = [];
      let currentLabel = "";
      const currentTexts: string[] = [];
      const flush = () => {
        if (currentLabel.length > 0 && currentTexts.length > 0) {
          groupBlocks.push(currentLabel + "\n\n" + currentTexts.join("\n\n"));
        }
        currentTexts.length = 0;
      };
      for (const n of nodes) {
        if (n.type === "group") {
          flush();
          currentLabel = (n.label ?? "").trim();
        } else if (n.type === "remark" && (n.scope === "group" || n.scope === "itemlist-note")) {
          const t = (n.text ?? "").trim();
          if (t.length > 0) currentTexts.push(t);
        }
      }
      flush();
      const groupPart = [...new Set(groupBlocks)].filter(Boolean).join("\n\n\n");
      if (groupPart.length > 0) base = base.length > 0 ? base + "\n\n\n" + groupPart : groupPart;
    }
    return stripTechnicalNoiseForDisplay(sanitizeForDisplay(base));
  }, [vortextForDocumentView, gaebPreview?.normalized?.displayNodes]);

  /** Bei GAEB-XML: Tab Positionen ausschließlich aus displayNodes (group + remark scope group/itemlist + item). Kein Legacy-Pfad. */
  const isGaebXml = useMemo(
    () =>
      gaebPreview?.structure?.meta?.formatDetected === "gaeb-xml" ||
      gaebPreview?.parseResult?.formatDetected === "gaeb-xml",
    [gaebPreview]
  );

  /** Bei GAEB-XML mit displayNodes: Positionen inkl. Gruppen- und Untergruppenüberschriften sowie Hinweise in Dokumentreihenfolge. */
  const positionsFromDisplayNodes = useMemo(() => {
    const nodes = gaebPreview?.normalized?.displayNodes;
    if (!Array.isArray(nodes) || nodes.length === 0) return "";
    const blocks: string[] = [];
    for (const n of nodes) {
      if (n.type === "group") {
        const line = ("Gruppe " + (n.posNr || "—") + " – " + (n.label || "(ohne Bezeichnung)")).trim();
        if (line.length > 0) blocks.push(line);
      } else if (n.type === "remark") {
        const t = (n.text ?? "").trim();
        if (t.length > 0) blocks.push(t);
      } else if (n.type === "item") {
        const posNr = String(n.posNr ?? "").trim();
        const shortText = String(n.shortText ?? "").trim();
        const longText = String(n.longText ?? "").trim();
        const quantity = String(n.quantity ?? "").trim();
        const unit = String(n.unit ?? "").trim();
        const mengeEinheit = [quantity, unit].filter(Boolean).join(" ").trim();
        const lines = [posNr, shortText, mengeEinheit, longText].filter(Boolean);
        if (lines.length > 0) blocks.push(lines.join("\n"));
      }
    }
    return blocks.join("\n\n");
  }, [gaebPreview?.normalized?.displayNodes]);

  /** Bei GAEB-XML: Positionstext nur aus normalized.items (Fallback wenn displayNodes leer/fehlt). */
  const positionsFromNormalizedItems = useMemo(() => {
    if (isGaebXml && (gaebPreview?.normalized?.displayNodes?.length ?? 0) > 0) return "";
    const items = gaebPreview?.normalized?.items;
    if (!Array.isArray(items) || items.length === 0) return "";
    const blocks: string[] = [];
    for (const it of items) {
      const posNr = String((it as any)?.posNr ?? "").trim();
      const shortText = String((it as any)?.shortText ?? "").trim();
      const longText = String((it as any)?.longText ?? "").trim();
      const quantity = String((it as any)?.quantity ?? "").trim();
      const unit = String((it as any)?.unit ?? "").trim();
      const mengeEinheit = [quantity, unit].filter(Boolean).join(" ").trim();
      const lines = [posNr, shortText, mengeEinheit, longText].filter(Boolean);
      if (lines.length > 0) blocks.push(lines.join("\n"));
    }
    return blocks.join("\n\n");
  }, [isGaebXml, gaebPreview?.normalized?.displayNodes, gaebPreview?.normalized?.items]);

  /** Legacy: Positionstext aus structure.positionen.items. Bei gaeb-xml nicht verwenden. */
  const positionsFromStructuredItems = useMemo(() => {
    if (isGaebXml) return "";
    const items = gaebPreview?.structure?.positionen?.items;
    if (!Array.isArray(items) || items.length === 0) return "";
    const blocks: string[] = [];
    for (const it of items) {
      const posNr = (it?.posNr ?? "").trim();
      const shortText = (it?.shortText ?? "").trim();
      const longText = (it?.longText ?? "").trim();
      const quantity = (it?.quantity ?? "").trim();
      const unit = (it?.unit ?? "").trim();
      const mengeEinheit = [quantity, unit].filter(Boolean).join(" ").trim();
      let lines: string[] = [posNr, shortText, mengeEinheit, longText].filter(Boolean);
      const hasStructuredText = shortText.length > 0 || longText.length > 0;
      if (!hasStructuredText && (it?.raw ?? "").trim().length > 0) {
        const normalizedRaw = normalizeViewerPositionenText((it?.raw ?? "").trim());
        if (normalizedRaw.length > 0) lines.push(normalizedRaw);
      }
      if (lines.length > 0) blocks.push(lines.join("\n"));
    }
    return blocks.join("\n\n");
  }, [isGaebXml, gaebPreview?.structure?.positionen?.items]);

  /** Explizite Quellenwahl Positionen – nur für Verifikation/Debug. Bei gaeb-xml: "displayNodes" oder "normalized-items" (nur Items). */
  const positionsSourceUsed = useMemo((): string => {
    if (isGaebXml && (gaebPreview?.normalized?.displayNodes?.length ?? 0) > 0) return "displayNodes";
    if (positionsFromDisplayNodes.length > 0) return "displayNodes";
    if (positionsFromNormalizedItems.length > 0) return "normalized-items";
    if (positionsFromStructuredItems.length > 0) return "legacy-structured-items";
    const s = (split?.positions ?? "").trim();
    if (s.length > 0) return "split-positions";
    const g = (gaebPreview?.positionsGuessClean ?? "").trim();
    if (g.length > 0) return "positionsGuessClean";
    const st = (structurePositions ?? "").trim();
    if (st.length > 0) return "structurePositions";
    return "none";
  }, [isGaebXml, gaebPreview?.normalized?.displayNodes?.length, positionsFromDisplayNodes, positionsFromNormalizedItems, positionsFromStructuredItems, split?.positions, gaebPreview?.positionsGuessClean, structurePositions]);

  /** Positionen für die Dokumentleseansicht (Positionen-Tab). Für gaeb-xml nur displayNodes oder items-Fallback; nie positionsGuessClean/Legacy. */
  const positionsForDocumentView = useMemo(() => {
    if (isGaebXml) {
      if ((gaebPreview?.normalized?.displayNodes?.length ?? 0) > 0) return positionsFromDisplayNodes;
      if ((gaebPreview?.normalized?.items?.length ?? 0) > 0) return positionsFromNormalizedItems;
      return positionsFromDisplayNodes || positionsFromNormalizedItems || "";
    }
    if (positionsFromDisplayNodes.length > 0) return positionsFromDisplayNodes;
    if (positionsFromNormalizedItems.length > 0) return positionsFromNormalizedItems;
    if (positionsFromStructuredItems.length > 0) return positionsFromStructuredItems;
    const raw = (split?.positions ?? gaebPreview?.positionsGuessClean ?? structurePositions ?? "").trim();
    return normalizeViewerPositionenText(raw);
  }, [isGaebXml, gaebPreview?.normalized?.displayNodes?.length, gaebPreview?.normalized?.items?.length, positionsFromDisplayNodes, positionsFromNormalizedItems, positionsFromStructuredItems, split?.positions, gaebPreview?.positionsGuessClean, structurePositions]);

  /** Bereinigter Positionstext für Suche/Trefferzählung – identisch mit der in der Ansicht angezeigten Version. */
  const positionsForDocumentViewDisplay = useMemo(
    () => stripTechnicalNoiseForDisplay(sanitizeForDisplay(positionsForDocumentView)),
    [positionsForDocumentView]
  );

  /** Text für aktuellen Expert-Tab (u. a. für „In Textfeld übernehmen“). Analysebasis = dieselbe Quelle wie Vorbemerkungen-/Positionen-Tab. */
  const gaebTextForTab = useMemo(() => {
    if (gaebTab === "structure") return "";
    if (gaebTab === "basis_vortext") return vortextForDocumentViewDisplay;
    if (gaebTab === "basis_positions") return positionsForDocumentViewDisplay;
    if (gaebTab === "raw" && gaebPreview) return gaebPreview.rawPreview ?? "";
    return "";
  }, [gaebTab, vortextForDocumentViewDisplay, positionsForDocumentViewDisplay, gaebPreview]);

  /** Trefferanzahl für Suche im Vorbemerkungen-Tab (nur angezeigter Text, case-insensitive). */
  const vorbemerkungenMatchCount = useMemo(() => {
    const q = vorbemerkungenSearchQuery.trim();
    if (!q) return 0;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    let count = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(vortextForDocumentViewDisplay)) !== null) count++;
    return count;
  }, [vorbemerkungenSearchQuery, vortextForDocumentViewDisplay]);

  /** Trefferanzahl für Suche im Positionen-Tab (nur angezeigter Text, case-insensitive). */
  const positionenMatchCount = useMemo(() => {
    const q = positionenSearchQuery.trim();
    if (!q) return 0;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    let count = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(positionsForDocumentViewDisplay)) !== null) count++;
    return count;
  }, [positionenSearchQuery, positionsForDocumentViewDisplay]);

  useEffect(() => {
    if (vorbemerkungenMatchCount > 0) {
      setVorbemerkungenCurrentHitIndex((i) => Math.min(i, vorbemerkungenMatchCount - 1));
    }
  }, [vorbemerkungenMatchCount]);

  useEffect(() => {
    if (positionenMatchCount > 0) {
      setPositionenCurrentHitIndex((i) => Math.min(i, positionenMatchCount - 1));
    }
  }, [positionenMatchCount]);

  useEffect(() => {
    if (resultTab !== "vorbemerkungen" || vorbemerkungenMatchCount === 0) return;
    const el = document.getElementById(`vorbemerkungen-hit-${vorbemerkungenCurrentHitIndex}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [resultTab, vorbemerkungenCurrentHitIndex, vorbemerkungenMatchCount]);

  useEffect(() => {
    if (resultTab !== "positionen" || positionenMatchCount === 0) return;
    const el = document.getElementById(`positionen-hit-${positionenCurrentHitIndex}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [resultTab, positionenCurrentHitIndex, positionenMatchCount]);

  const analysisStatus = loading ? "Analysiere…" : result ? "Abgeschlossen" : "Bereit";

  const analysisSteps = [
    "Leistungsverzeichnis wird verarbeitet",
    "Vorbemerkungen werden analysiert",
    "Risiken werden erkannt",
    "Score wird berechnet",
    "Nachtragspotenziale werden ermittelt",
    "KI erstellt Zusammenfassung",
  ];

  const lastStepSubStatuses = [
    "Rückfragen werden formuliert …",
    "Angebotsklarstellungen werden erstellt …",
    "Zusammenfassung wird aufbereitet …",
    "Ergebnisansicht wird vorbereitet …",
  ];

  const hasResult = Boolean(result && !loading);

  const savedReportCompleteness = useMemo(() => {
    if (!customerRoute || !savedReportBanner) return null;
    return computeSavedReportCompleteness(clarificationQuestions, offerAssumptions, changeOrderAnalysis);
  }, [customerRoute, savedReportBanner, clarificationQuestions, offerAssumptions, changeOrderAnalysis]);

  return (
    <div
      className={customerRoute ? "tga-analyse-dark" : undefined}
      style={{
        padding: customerRoute ? (hasResult ? 16 : 32) : (hasResult ? 12 : 28),
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        ...(customerRoute ? { background: T.bg, minHeight: "100vh", color: T.text } : {}),
      }}
    >
      {/* Micro-Animations nur für Kundenroute (keine neuen Abhängigkeiten); .tga-analyse-dark = dunkle App-Sprache */}
      {customerRoute && (
        <style dangerouslySetInnerHTML={{ __html: `
          .tga-analyse-dark .tga-toggle-option:hover { background-color: rgba(255,255,255,0.08) !important; }
          .tga-analyse-dark .tga-toggle-option[data-active]:hover { background-color: rgba(255,255,255,0.18) !important; }
          .tga-analyse-dark .tga-toggle-option:not([data-active]):hover { color: rgba(255,255,255,0.85) !important; }
          .tga-analyse-dark .tga-toggle-option[data-active] { box-shadow: 0 1px 2px rgba(0,0,0,0.25); }
          .tga-btn-primary { transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease; }
          .tga-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(56,189,248,0.3); }
          .tga-btn-primary:active:not(:disabled) { transform: translateY(0); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
          .tga-btn-primary:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
          .tga-btn-secondary { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease; }
          .tga-btn-secondary:hover { border-color: rgba(255,255,255,0.12) !important; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
          .tga-btn-secondary:active { transform: translateY(0); }
          .tga-btn-secondary:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
          .tga-toggle-option { transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
          .tga-toggle-option:hover { background-color: #f1f5f9 !important; }
          .tga-toggle-option:not([data-active]):hover { color: #0f172a !important; }
          .tga-toggle-option[data-active] { box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
          .tga-toggle-option:active { transform: scale(0.98); }
          .tga-toggle-option:focus-visible { outline: 2px solid #38bdf8; outline-offset: 1px; }
          .tga-tab { transition: color 0.2s ease, border-color 0.2s ease; }
          .tga-analyse-dark .tga-tab:hover { color: rgba(255,255,255,0.92) !important; }
          .tga-tab:hover { color: #0f172a !important; }
          .tga-tab:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
          .tga-benefit-card { transition: box-shadow 0.2s ease; }
          .tga-benefit-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          .tga-analyse-dark textarea::placeholder { color: rgba(255,255,255,0.45); }
        ` }} />
      )}

      {/* Analyse-Warteanzeige: Overlay, abdunkeln, Tabs/Inhalt ausgeblendet über result && !loading */}
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              background: customerRoute ? T.card : "#fff",
              borderRadius: 16,
              padding: "28px 32px",
              maxWidth: 420,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              border: customerRoute ? `1px solid ${T.border}` : undefined,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: customerRoute ? T.text : "#111", marginBottom: 20 }}>
              {loadingPhase === "file" ? "Datei wird vorbereitet" : "Analyse läuft"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {analysisSteps.map((label, i) => {
                const effectiveStep = loadingPhase === "file" ? 0 : analysisStep;
                const stepLabel = loadingPhase === "file" && i === 0 ? "Datei wird geladen und vorbereitet" : label;
                return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                    color: i < effectiveStep ? (customerRoute ? T.accent : "#0a7a2f") : i === effectiveStep ? (customerRoute ? T.text : "#111") : (customerRoute ? T.faint : "#999"),
                    fontWeight: i === effectiveStep ? 700 : 500,
                    ...(i === effectiveStep && customerRoute ? { paddingLeft: 4, borderLeft: `3px solid ${T.accent}`, marginLeft: -4 } : {}),
                  }}
                >
                  <span style={{ width: 20, textAlign: "center", flexShrink: 0 }}>
                    {i < effectiveStep ? "✓" : i === effectiveStep ? "→" : "•"}
                  </span>
                  <span>{stepLabel}</span>
                </div>
              ); })}
              {loadingPhase === "analyze" && analysisStep === 5 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${customerRoute ? T.border : "#e2e8f0"}`, fontSize: 13, color: customerRoute ? T.muted : "#64748b", fontWeight: 500 }}>
                  {lastStepSubStatuses[lastStepSubIndex]}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warteanzeige: Nachtragspotenzial, Rückfragen, Annahmen */}
      {(changeOrderLoading || clarificationQuestionsLoading || offerAssumptionsLoading) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              background: customerRoute ? T.card : "#fff",
              borderRadius: 16,
              padding: "28px 32px",
              maxWidth: 380,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              border: customerRoute ? `1px solid ${T.border}` : undefined,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: customerRoute ? T.text : "#111", marginBottom: 12 }}>
              {changeOrderLoading && "Nachtragspotenziale werden ermittelt…"}
              {!changeOrderLoading && clarificationQuestionsLoading && "Rückfragen werden generiert…"}
              {!changeOrderLoading && !clarificationQuestionsLoading && offerAssumptionsLoading && "Annahmen werden generiert…"}
            </div>
            <div style={{ color: customerRoute ? T.muted : "#666", fontSize: 14 }}>
              Bitte einen Moment warten.
            </div>
          </div>
        </div>
      )}

      {/* Header: kompakt nach Analyse (Toolbar), sonst etwas mehr Raum */}
      <header
        style={{
          marginBottom: 0,
          padding: hasResult ? (customerRoute ? "10px 20px" : "8px 16px") : (customerRoute ? `${T.space.lg}px ${T.space.xl}px` : "0 28px"),
          minHeight: hasResult ? (customerRoute ? 48 : 44) : (customerRoute ? 72 : 64),
          height: hasResult ? "auto" : (customerRoute ? "auto" : 64),
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: hasResult ? 16 : 28,
          background: customerRoute ? T.card : "#fff",
          borderBottom: customerRoute ? `1px solid ${T.border}` : "1px solid #e5e7eb",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: hasResult ? 12 : (customerRoute ? 8 : 2), minWidth: 0, flex: "1 1 280px" }}>
          {customerRoute ? (
            <>
              <h1 style={{ margin: 0, fontSize: hasResult ? 18 : 26, fontWeight: hasResult ? 700 : 800, color: T.text, letterSpacing: "-0.025em", lineHeight: 1.2 }}>
                Leistungsverzeichnis analysieren
              </h1>
              {fileMeta?.name && (
                <span style={{ fontSize: 12, color: T.faint, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(hasResult ? { marginLeft: 8, paddingLeft: 12, borderLeft: `1px solid ${T.border}` } : { marginTop: 4 }) }}>
                  {fileMeta.name}
                  {fileMeta.size ? ` · ${fmtKB(fileMeta.size)}` : ""}
                </span>
              )}
            </>
          ) : (
            <>
              <h1 style={{ margin: 0, fontSize: hasResult ? 16 : 20, fontWeight: 600, color: "#111", letterSpacing: "-0.02em" }}>
                LV Analyse
              </h1>
              {fileMeta?.name && (
                <span style={{ fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(hasResult ? { marginLeft: 8, paddingLeft: 8, borderLeft: "1px solid #e5e7eb" } : { marginTop: 4, display: "block" }) }}>
                  {fileMeta.name}
                  {fileMeta.size ? ` · ${fmtKB(fileMeta.size)}` : ""}
                </span>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: hasResult ? 12 : (customerRoute ? 24 : 20), flexShrink: 0 }}>
          {hasResult && (
            <button
              type="button"
              onClick={() => {
                setLvText("");
                setResult(null);
                setError(null);
                setFileMeta(null);
                setLastFile(null);
                clearSavedReportBanner();
                resetVortext();
                resetGaebPreview();
                resetSplit();
              }}
              style={{
                padding: customerRoute ? "8px 14px" : "6px 12px",
                borderRadius: customerRoute ? T.radiusSm : D.radiusButton,
                border: "none",
                background: customerRoute ? T.accent : "#111",
                color: customerRoute ? "#0c1222" : "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Neue Analyse
            </button>
          )}
          {analysisStatus && (
            <span
              style={{
                fontSize: customerRoute ? 12 : 11,
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: loading ? T.warning : result ? (customerRoute ? "#0c1222" : "#047857") : (customerRoute ? "rgba(255,255,255,0.6)" : "#9ca3af"),
                padding: hasResult ? "4px 10px" : (customerRoute ? "6px 12px" : "4px 10px"),
                borderRadius: customerRoute ? T.radiusSm : 6,
                background: loading ? "rgba(251,191,36,0.15)" : result ? (customerRoute ? T.accent : "#ecfdf5") : (customerRoute ? "rgba(255,255,255,0.08)" : "#f9fafb"),
                border: customerRoute ? `1px solid ${loading ? T.warning : result ? T.accent : "rgba(255,255,255,0.1)"}` : "none",
              }}
            >
              {loading ? "Analyse läuft…" : result ? "Abgeschlossen" : "Bereit"}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!hasResult && customerRoute && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{customerRoute ? "Ansicht" : "Modus"}</span>
            )}
            <div style={{ display: "flex", background: customerRoute ? "rgba(0,0,0,0.35)" : "#f3f4f6", borderRadius: customerRoute ? T.radiusSm : 8, padding: 3 }}>
              <button
                type="button"
                className={customerRoute ? "tga-toggle-option" : undefined}
                data-active={customerRoute && analysisMode === "standard" ? "true" : undefined}
                onClick={() => {
                  setAnalysisMode("standard");
                  if (resultTab === "trigger" || resultTab === "transparenz") setResultTab("uebersicht");
                }}
                style={{
                  padding: hasResult ? "6px 12px" : (customerRoute ? "8px 16px" : "6px 14px"),
                  border: "none",
                  borderRadius: 6,
                  background: analysisMode === "standard" ? (customerRoute ? "rgba(255,255,255,0.14)" : "#fff") : "transparent",
                  color: analysisMode === "standard" ? (customerRoute ? "#ffffff" : "#111") : (customerRoute ? "rgba(255,255,255,0.55)" : "#6b7280"),
                  fontWeight: 600,
                  fontSize: hasResult ? 12 : 13,
                  cursor: "pointer",
                  boxShadow: analysisMode === "standard" ? (customerRoute ? "0 1px 2px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.08)") : "none",
                }}
              >
                Standard
              </button>
              <button
                type="button"
                className={customerRoute ? "tga-toggle-option" : undefined}
                data-active={customerRoute && analysisMode === "expert" ? "true" : undefined}
                onClick={() => setAnalysisMode("expert")}
                style={{
                  padding: hasResult ? "6px 12px" : (customerRoute ? "8px 16px" : "6px 14px"),
                  border: "none",
                  borderRadius: 6,
                  background: analysisMode === "expert" ? (customerRoute ? "rgba(255,255,255,0.14)" : "#fff") : "transparent",
                  color: analysisMode === "expert" ? (customerRoute ? "#ffffff" : "#111") : (customerRoute ? "rgba(255,255,255,0.55)" : "#6b7280"),
                  fontWeight: 600,
                  fontSize: hasResult ? 12 : 13,
                  cursor: "pointer",
                  boxShadow: analysisMode === "expert" ? (customerRoute ? "0 1px 2px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.08)") : "none",
                }}
              >
                Experte
              </button>
            </div>
          </div>
          {!customerRoute && (
            <a href="/admin/triggers" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", fontWeight: 500 }}>
              Trigger-Admin
            </a>
          )}
        </div>
      </header>

      {/* Analysebereich: nach Ergebnis kompakte Leiste, sonst voller Upload */}
      <div
        style={{
          marginTop: hasResult ? (customerRoute ? 12 : 10) : (customerRoute ? T.space.xl : 24),
          padding: hasResult ? (customerRoute ? "10px 16px" : "8px 12px") : (customerRoute ? 28 : 16),
          border: customerRoute ? `1px solid ${T.border}` : "1px solid #e5e7eb",
          borderRadius: customerRoute ? T.radius : 16,
          background: customerRoute ? T.card : "#fafafa",
          boxShadow: customerRoute ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
        }}
      >
        {hasResult ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: customerRoute ? T.muted : "#6b7280", fontWeight: 500 }}>
              {fileMeta?.name ? (<>Aktuelle Datei: <strong style={{ color: customerRoute ? T.text : "#111" }}>{fileMeta.name}</strong>{fileMeta.size ? ` · ${fmtKB(fileMeta.size)}` : ""}</>) : "Analyse abgeschlossen"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input ref={fileInputRef} type="file" accept=".txt,.xml,.gaeb,.x83,.x84,.x86,.json" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: "6px 12px", borderRadius: customerRoute ? T.radiusSm : D.radiusButton, border: `1px solid ${customerRoute ? T.border : D.cardBorder}`, background: customerRoute ? T.card : D.cardBg, color: customerRoute ? T.muted : D.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Andere Datei laden</button>
            </div>
          </div>
        ) : (
        <>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? (customerRoute ? T.accent : "#0a7a2f") : (customerRoute ? T.border : "#d1d5db")}`,
            borderRadius: customerRoute ? T.radiusSm : 14,
            padding: customerRoute ? 32 : 14,
            background: dragOver ? (customerRoute ? T.accentMuted : "#f0fdf4") : customerRoute ? "rgba(255,255,255,0.03)" : "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 280px" }}>
            {customerRoute ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, letterSpacing: "-0.01em" }}>
                  Leistungsverzeichnis hochladen
                </div>
                <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.55 }}>
                  Datei hierher ziehen oder über den Button auswählen. Anschließend Analyse starten.
                </p>
                {!fileMeta && (
                  <ul style={{ margin: "16px 0 0", paddingLeft: 20, fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
                    <li>Erkennt Risiken im Leistungsverzeichnis</li>
                    <li>Zeigt mögliche Nachtragspotenziale</li>
                    <li>Formuliert Rückfragen und Angebotsklarstellungen</li>
                  </ul>
                )}
                {fileMeta && (
                  <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: T.radiusSm, background: T.accentMuted, border: `1px solid ${T.border}`, color: T.accent, fontWeight: 600, fontSize: 13 }}>
                    Geladen: {fileMeta.name}
                    {fileMeta.size ? ` · ${fmtKB(fileMeta.size)}` : ""}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontWeight: 900 }}>Drag & Drop Datei hier rein</div>
                <div style={{ color: "#666", marginTop: 4 }}>
                  Struktur des Leistungsverzeichnisses und automatische Textanalyse trennen Einleitung und Positionen.
                </div>
                {fileMeta && (
                  <div style={{ marginTop: 8, color: "#111", fontWeight: 700 }}>
                    Geladen: {fileMeta.name}{" "}
                    <span style={{ color: "#666", fontWeight: 600 }}>({fmtKB(fileMeta.size)})</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: customerRoute ? "flex-end" : "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.xml,.gaeb,.x83,.x84,.x86,.json"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className={customerRoute ? "tga-btn-primary" : undefined}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: customerRoute ? `${T.space.sm}px ${T.space.md}px` : "10px 14px",
                borderRadius: customerRoute ? T.radiusSm : 12,
                border: "none",
                background: customerRoute ? T.accent : "#111",
                color: customerRoute ? "#0c1222" : "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                boxShadow: customerRoute ? "0 1px 3px rgba(56,189,248,0.25)" : "none",
              }}
            >
              {customerRoute ? "Datei auswählen" : "Datei wählen"}
            </button>
            {customerRoute && (
              <span style={{ fontSize: 11, color: T.faint }}>Max. 10 MB · TXT, XML, GAEB</span>
            )}
            {isExpertMode && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={autoAnalyze} onChange={(e) => setAutoAnalyze(e.target.checked)} />
                <span style={{ fontWeight: 700, color: customerRoute ? T.text : "#111" }}>{customerRoute ? "Analyse nach Upload" : "Auto-Analyse"}</span>
              </label>
            )}
          </div>
        </div>

        {/* Textarea */}
        {customerRoute && (
          <label style={{ display: "block", marginTop: customerRoute ? T.space.md : 12, marginBottom: 6, fontSize: 13, fontWeight: 600, color: T.text }}>
            LV-Text einfügen (Beta)
          </label>
        )}
        <textarea
          rows={10}
          style={{
            width: "100%",
            marginTop: customerRoute ? 0 : 12,
            borderRadius: customerRoute ? T.radiusSm : 12,
            border: customerRoute ? `1px solid ${T.border}` : "1px solid #ddd",
            padding: customerRoute ? T.space.md : 12,
            resize: "vertical",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.5,
            ...(customerRoute ? { background: T.surface, color: T.text } : {}),
          }}
          placeholder={customerRoute ? "LV-Text hier einfügen …" : "LV Text hier einfügen..."}
          value={lvText}
          onChange={(e) => setLvText(e.target.value)}
        />
        {customerRoute && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
            Diese Funktion funktioniert nur bei strukturiertem LV-Text. Für zuverlässige Ergebnisse empfehlen wir den Import einer GAEB-Datei.
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: customerRoute ? 12 : 10, marginTop: customerRoute ? 20 : 14, flexWrap: "wrap", alignItems: "center" }}>
            <button
            type="button"
            className={customerRoute ? "tga-btn-primary" : undefined}
            onClick={() => {
              if (lvText.trim().length === 0) return;
              setError(null);
              setResult(null);
              setLoading(true);
              setLoadingPhase("analyze");
              setAnalysisStep(0);
              void analyze();
            }}
            disabled={loading || lvText.trim().length === 0}
            style={{
              padding: customerRoute ? `${T.space.sm}px ${T.space.md}px` : "10px 14px",
              borderRadius: customerRoute ? T.radiusSm : 12,
              border: "none",
              background: loading ? (customerRoute ? T.surface : "rgba(0,0,0,0.06)") : customerRoute ? T.accent : "#111",
              color: loading ? (customerRoute ? T.faint : "#6b7280") : (customerRoute ? "#0c1222" : "#fff"),
              cursor: loading ? "default" : "pointer",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: customerRoute && !loading ? "0 1px 3px rgba(56,189,248,0.25)" : "none",
            }}
          >
            {loading ? "Analysiere…" : "Analysieren"}
          </button>

          {isExpertMode && (
            <button
              onClick={async () => {
                if (!lastFile) {
                  setSplitError("Kein File vorhanden (nur Text im Feld). Re-Split geht nur mit Datei.");
                  return;
                }
                await runGaebSplitLLM(lastFile);
              }}
              disabled={splitLoading || !lastFile}
              style={{
                padding: customerRoute ? "10px 16px" : "10px 14px",
                borderRadius: customerRoute ? T.radiusSm : 12,
                border: customerRoute ? `1px solid ${T.border}` : "1px solid #ddd",
                background: customerRoute ? T.card : "#fff",
                color: splitLoading || !lastFile ? (customerRoute ? T.faint : "#999") : (customerRoute ? T.muted : "#374151"),
                cursor: splitLoading || !lastFile ? "default" : "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
              title={!lastFile ? "Nur möglich, wenn eine Datei geladen wurde." : ""}
            >
              {splitLoading ? "Analysiere…" : "Automatische Textanalyse erneut ausführen"}
            </button>
          )}

          <button
            type="button"
            className={customerRoute ? "tga-btn-secondary" : undefined}
            onClick={() => {
              setLvText("");
              setResult(null);
              setError(null);
              setFileMeta(null);
              setLastFile(null);
              clearSavedReportBanner();
              resetVortext();
              resetGaebPreview();
              resetSplit();
            }}
            style={{
              padding: customerRoute ? `${T.space.sm}px ${T.space.md}px` : "10px 14px",
              borderRadius: customerRoute ? T.radiusSm : 12,
              border: customerRoute ? `1px solid ${T.border}` : "1px solid #d1d5db",
              background: customerRoute ? T.card : "#fff",
              color: customerRoute ? T.muted : "#6b7280",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {customerRoute ? "Eingabe zurücksetzen" : "Zurücksetzen"}
          </button>

          {isExpertMode && (
            <label
              title={customerRoute ? "Bei Aktivierung werden bei der Analyse zusätzliche Risiken per KI ermittelt." : "Bei Aktivierung werden bei der Analyse zusätzliche Risiken per KI ermittelt (Relevanzfilter)."}
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                color: customerRoute ? T.muted : "#6b7280", fontWeight: 500, fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={useLlmRelevance}
                onChange={(e) => setUseLlmRelevance(e.target.checked)}
              />
              {customerRoute ? "Erweiterte Filter (KI-Risiken)" : "Relevanzfilter (KI)"}
            </label>
          )}
          <span style={{ fontSize: 12, color: customerRoute ? T.faint : "#9ca3af" }}>Max. 10 MB</span>
        </div>

        {error && <div style={{ marginTop: 12, color: customerRoute ? T.danger : "#b00020", fontWeight: 600, fontSize: 13 }}>{error}</div>}
        </>
        )}
      </div>

      {/* Value-Preview: Was Sie nach der Analyse erhalten (nur Kundenroute, Startzustand) */}
      {customerRoute && !result && !loading && (
        <div style={{ marginTop: T.space.xl }}>
          <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>Nach der Analyse erhalten Sie</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: T.space.md }}>
            <div className="tga-benefit-card" style={{ padding: T.space.md, minHeight: 120, borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.card, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>Risikoübersicht</div>
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>Erkennen Sie kritische Punkte in Vorbemerkungen, Mengen und Leistungsgrenzen.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: T.space.md, minHeight: 120, borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.card, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>Nachtragspotenzial</div>
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>Identifizieren Sie mögliche Ursachen für spätere Mehrkosten.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: T.space.md, minHeight: 120, borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.card, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>Rückfragen</div>
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>Erhalten Sie konkrete Fragen zur Klärung vor Angebotsabgabe.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: T.space.md, minHeight: 120, borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.card, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>Angebotsklarstellungen</div>
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>Nutzen Sie Formulierungsvorschläge für Ihr Angebot.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: T.space.md, minHeight: 120, borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.card, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.vorbemerkungen}</div>
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>Lesbare Darstellung der Vorbemerkungen aus Ihrem LV inkl. Suche und Volltextansicht.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: T.space.md, minHeight: 120, borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.card, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.positionen}</div>
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.55 }}>Übersicht der Positionsinhalte des Leistungsverzeichnisses mit Suchfunktion.</p>
            </div>
          </div>
        </div>
      )}

      {/* Dateistruktur / Struktur LV (nur in erweiterter Ansicht) – heller Content-Bereich, eigene Light-Logik (keine Vererbung von T.text) */}
      {isExpertMode && (
      <div
        className={customerRoute ? "tga-expert-dark-panel" : "tga-expert-light-panel"}
        style={{
          marginTop: 14,
          border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e2e8f0",
          borderRadius: customerRoute ? T.radius : 14,
          padding: 16,
          background: customerRoute ? CX.card : "#fff",
          color: customerRoute ? CX.text : D.textPrimary,
          boxShadow: customerRoute ? CX.shadow : undefined,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontSize: 14, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 900 }}>{customerRoute ? "Dateistruktur" : "Struktur des Leistungsverzeichnisses"}</div>
          <div style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 700 }}>
            {gaebPreviewLoading ? "Lade…" : gaebPreview ? `${gaebPreview.filename} (${fmtKB(gaebPreview.size)})` : "—"}
          </div>
        </div>

        <p style={{ margin: "10px 0 0", fontSize: 12, color: customerRoute ? CX.faint : D.textMuted, lineHeight: 1.5, maxWidth: 720 }}>
          <strong>Struktur</strong> zeigt die erkannte GAEB-/LV-Gliederung. <strong>Analysebasis Vorbemerkungen</strong> und <strong>Analysebasis Positionen</strong> zeigen den bereinigten Text, auf dem die Analyse tatsächlich basiert. <strong>Diagnose / Rohdaten</strong> ist nur für technische Prüfung gedacht.
        </p>

        {(gaebPreviewError || splitError) && (
          <div style={{ marginTop: 10, color: "#b00020", fontWeight: 800 }}>
            {gaebPreviewError ? `Struktur: ${gaebPreviewError}` : ""}
            {gaebPreviewError && splitError ? " • " : ""}
            {splitError ? `Textanalyse: ${splitError}` : ""}
          </div>
        )}

        {!gaebPreviewLoading && (gaebPreview || split) && (
          <>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(gaebPreview?.normalized
                ? (["structure", "basis_vortext", "basis_positions", "raw"] as const)
                : (["basis_vortext", "basis_positions", "raw"] as const)
              ).map((t: GaebTab) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGaebTab(t)}
                  style={{
                    padding: t === "raw" ? "6px 9px" : "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${customerRoute ? CX.border : t === "raw" ? "#cbd5e1" : "#e2e8f0"}`,
                    background: gaebTab === t
                      ? (t === "raw" ? "#64748b" : customerRoute ? T.accent : "#111")
                      : customerRoute
                        ? (t === "raw" ? "rgba(255,255,255,0.08)" : CX.surface)
                        : (t === "raw" ? "#f1f5f9" : "#fff"),
                    color: gaebTab === t
                      ? (t === "raw" ? "#fff" : customerRoute ? "#0c1222" : "#fff")
                      : customerRoute
                        ? (t === "raw" ? CX.faint : CX.muted)
                        : (t === "raw" ? "#64748b" : D.textPrimary),
                    cursor: "pointer",
                    fontWeight: t === "raw" ? 600 : 700,
                    fontSize: t === "raw" ? 12 : undefined,
                  }}
                >
                  {t === "structure"
                    ? "Struktur"
                    : t === "basis_vortext"
                      ? "Analysebasis Vorbemerkungen"
                      : t === "basis_positions"
                        ? "Analysebasis Positionen"
                        : "Diagnose / Rohdaten"}
                </button>
              ))}

              {!result && (
                <button
                  type="button"
                  onClick={() => setLvText(gaebTextForTab || "")}
                    style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${customerRoute ? CX.border : D.textPrimary}`,
                    background: customerRoute ? CX.surface : "#fff",
                    color: customerRoute ? CX.text : D.textPrimary,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  In Textfeld übernehmen
                </button>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              {gaebTab === "structure" && gaebPreview?.normalized ? (
                <GaebNormalizedPreview
                  normalized={gaebPreview.normalized}
                  debug={gaebPreview.debug}
                  customerRoute={!!customerRoute}
                  customerDesign={
                    customerRoute
                      ? {
                          primary: D.primary,
                          cardBg: CX.card,
                          cardBorder: CX.border,
                          textPrimary: CX.text,
                          textSecondary: CX.muted,
                          textMuted: CX.faint,
                          pageBg: T.bg,
                          filterBg: CX.filterBg,
                        }
                      : undefined
                  }
                />
              ) : gaebTab === "structure" && !gaebPreview?.normalized ? (
                <div style={{ padding: 12, color: customerRoute ? CX.faint : D.textMuted, fontSize: 13 }}>Keine Strukturansicht verfügbar (nur bei GAEB-Daten mit Gliederung).</div>
              ) : gaebTab === "raw" ? (
                gaebPreview ? (
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      borderRadius: 12,
                      border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e2e8f0",
                      background: customerRoute ? CX.surface : "#f8fafc",
                      color: customerRoute ? CX.text : D.textPrimary,
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      maxHeight: 320,
                      overflow: "auto",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                  >
                    {gaebTextForTab}
                  </pre>
                ) : (
                  <div style={{ padding: 12, color: customerRoute ? CX.faint : D.textMuted, fontSize: 13 }}>Rohdaten nur nach Datei-Upload verfügbar.</div>
                )
              ) : (
                <Lesansicht
                  content={gaebTab === "basis_vortext" ? (vortextForDocumentViewDisplay ?? "") : (positionsForDocumentViewDisplay ?? "")}
                  maxHeight="320px"
                  styles={
                    customerRoute
                      ? {
                          textPrimary: CX.text,
                          textSecondary: CX.muted,
                        }
                      : undefined
                  }
                />
              )}
            </div>

            <div style={{ marginTop: 8, color: customerRoute ? CX.muted : D.textSecondary, fontSize: 12, fontWeight: 600 }}>
              {split ? (
                <>
                  Automatische Textanalyse: Einleitung {effectiveVortextLen} Zeichen • Positionen {effectivePositionsLen} Zeichen
                </>
              ) : gaebPreview?.structure ? (
                <>
                  Struktur: {gaebPreview.structure.raw.cutMethod} • Einleitung {effectiveVortextLen} Zeichen • Positionen{" "}
                  {effectivePositionsLen} Zeichen
                  {gaebPreview.structure.vorbemerkungen ? (
                    <> • Vorbemerkungen {gaebPreview.structure.vorbemerkungen.length} Zeichen</>
                  ) : null}
                  {gaebPreview.normalized ? (
                    <> • Normalisiert: {gaebPreview.normalized.groups?.length ?? 0} Gruppen, {gaebPreview.normalized.remarks?.length ?? 0} Hinweise, {gaebPreview.normalized.items?.length ?? 0} Positionen</>
                  ) : null}
                </>
              ) : (!customerRoute && (
                <>
                  Struktur: Vorschau {gaebPreview?.debug?.previewChars ?? 0} Zeichen • Einleitung{" "}
                  {gaebPreview?.debug?.vortextFullChars ?? 0} • Positionen {gaebPreview?.debug?.positionsFullChars ?? 0}
                </>
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {/* Results: Tabs + Inhalt (kompakt unter Header/Upload-Leiste) */}
      {result && !loading && (
        <div style={{ marginTop: hasResult ? (customerRoute ? 12 : 10) : (customerRoute ? D.spacingSection : 18) }}>
          {customerRoute && savedReportBanner && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 14px",
                borderRadius: T.radiusSm,
                border: `1px solid ${T.border}`,
                background: T.surface,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "8px 14px",
                }}
              >
                <span style={{ fontWeight: 600, color: T.text }}>Analyse gespeichert.</span>
                <span
                  style={{
                    color: T.muted,
                    flex: "1 1 140px",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={savedReportBanner.titleHint}
                >
                  {savedReportBanner.titleHint}
                </span>
                <Link
                  href={`/app/analysen/${savedReportBanner.id}`}
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#0c1222",
                    background: T.accent,
                    padding: "6px 14px",
                    borderRadius: T.radiusSm,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Bericht öffnen
                </Link>
              </div>
              {savedReportCompleteness && (
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.45 }}>
                  {savedReportCompleteness.complete ? (
                    <span style={{ color: T.text, fontWeight: 600 }}>Bericht vollständig</span>
                  ) : (
                    <>
                      <span style={{ color: T.text, fontWeight: 600 }}>Bericht noch nicht vollständig</span>
                      <span style={{ display: "block", marginTop: 4 }}>
                        Es fehlen noch: {savedReportCompleteness.missingLabels.join(", ")}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Tab-Leiste */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 10,
              padding: "4px 0",
              borderBottom: customerRoute ? `2px solid ${T.border}` : "2px solid #e5e5e5",
              flexWrap: "wrap",
            }}
          >
            {(
              [
                ["uebersicht", DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.uebersicht],
                ["risiken", DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.risiken],
                ["vorbemerkungen", DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.vorbemerkungen],
                ["positionen", DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.positionen],
                ["nachtragspotenzial", DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.nachtragspotenzial],
                ["rueckfragen", DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.rueckfragen],
                ["angebotsklarstellungen", DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.angebotsklarstellungen],
                ...(analysisMode === "expert" ? [["trigger", customerRoute ? DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.risikodetails : DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.trigger] as const] : []),
                ...(analysisMode === "expert" ? [["transparenz", DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.transparenz] as const] : []),
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={customerRoute ? "tga-tab" : undefined}
                onClick={() => setResultTab(id)}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  borderBottom: resultTab === id ? `2px solid ${customerRoute ? T.accent : "#111"}` : "2px solid transparent",
                  marginBottom: -8,
                  background: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  color: resultTab === id ? (customerRoute ? T.text : "#111") : (customerRoute ? T.muted : "#666"),
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab-Inhalt: Übersicht – Analyse-Cockpit (Kundenroute) oder klassisches Dashboard */}
          {resultTab === "uebersicht" && (
          customerRoute && result ? (
            <AnalyseCockpitView
              projectName={
                resolveDisplayProjectName(manualProjectData, keyFacts as Record<string, string> | undefined) ||
                (keyFacts as Record<string, string> | undefined)?.objektbezeichnung ||
                (keyFacts as Record<string, string> | undefined)?.projektbezeichnung ||
                (keyFacts as Record<string, string> | undefined)?.bauvorhaben
              }
              fileName={fileMeta?.name}
              fileSize={fileMeta?.size ?? undefined}
              result={result}
              legalSignals={result.legalSignals}
              changeOrderAnalysis={changeOrderAnalysis ?? undefined}
              clarificationQuestions={(clarificationQuestions ?? undefined) as AnalyseCockpitViewProps["clarificationQuestions"]}
              offerAssumptions={(offerAssumptions ?? undefined) as AnalyseCockpitViewProps["offerAssumptions"]}
              keyFactsDisplayList={keyFactsDisplayList}
              keyFactConfidence={keyFactConfidence ?? undefined}
              sanitize={sanitizeForDisplay}
              expertMode={isExpertMode}
              onTabChange={(tab) => setResultTab(tab as ResultTabId)}
              manualProject={
                manualProjectBundle
                  ? {
                      rows: manualProjectBundle.rows,
                      notesRow: manualProjectBundle.notesRow,
                      canPersist: !!savedReportBanner?.id,
                      onSaveField: saveManualProjectField,
                    }
                  : null
              }
            />
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: customerRoute ? D.spacingCard : 12, maxHeight: "calc(100vh - 220px)", minHeight: 0 }}>
            {/* Erkannte Gewerke – kompakte Kopfzone (defensiv: nur wenn detectedTrades vorhanden) */}
            {(result as any)?.detectedTrades != null && (
              <div style={{ background: customerRoute ? CX.card : "#fff", border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? "12px 16px" : "10px 14px", boxShadow: customerRoute ? CX.shadow : undefined }}>
                <div style={{ fontSize: 11, color: customerRoute ? CX.faint : "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8 }}>Erkannte Gewerke</div>
                {(() => {
                  const dt = (result as any).detectedTrades as DetectedTradesResult | undefined;
                  const primary = dt?.primaryTrade ?? null;
                  const secondary = (dt?.secondaryTrades ?? []) as string[];
                  const confidence = dt?.confidence;
                  if (!primary && (!secondary || secondary.length === 0)) {
                    return <span style={{ fontSize: 14, color: customerRoute ? CX.faint : "#9ca3af", fontStyle: "italic" }}>Keine eindeutige Zuordnung</span>;
                  }
                  const confText = typeof confidence === "number" && Number.isFinite(confidence)
                    ? formatTradeConfidencePercent(confidence)
                    : formatTradeConfidence(confidence);
                  return (
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                      {primary && (
                        <span style={{ fontSize: 16, fontWeight: 700, color: customerRoute ? CX.text : "#111" }}>{primary}</span>
                      )}
                      {secondary.length > 0 && (
                        <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {secondary.map((s) => (
                            <span key={s} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, background: customerRoute ? CX.chip : "#f3f4f6", color: customerRoute ? CX.muted : "#4b5563", fontWeight: 500 }}>{s}</span>
                          ))}
                        </span>
                      )}
                      {(confText && confText !== "—") && (
                        <span style={{ fontSize: 12, color: customerRoute ? CX.faint : "#9ca3af", fontWeight: 500 }}>Sicherheit: {confText}</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            {/* Zeile 1: KPI-Karten Komplexität | Gesamt-Risiko | Claim-Potenzial */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: customerRoute ? 12 : 10 }}>
              <div style={{ background: customerRoute ? CX.card : "#fff", border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? "14px 16px" : "12px 14px", boxShadow: customerRoute ? CX.shadow : undefined }}>
                <div style={{ fontSize: 11, color: customerRoute ? CX.faint : "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.complexity}</div>
                <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700, color: customerRoute ? CX.text : "#111" }}>
                  {clamp0_100(result.total)}
                  <span style={{ fontSize: 14, color: customerRoute ? CX.faint : "#9ca3af", fontWeight: 500 }}> / 100</span>
                </div>
              </div>
              <div style={{ background: customerRoute ? CX.card : "#fff", border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? "14px 16px" : "12px 14px", boxShadow: customerRoute ? CX.shadow : undefined }}>
                <div style={{ fontSize: 11, color: customerRoute ? CX.faint : "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.totalRisk}</div>
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{totalAmp.dot}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: totalAmp.tone }}>{totalAmp.text}</span>
                </div>
              </div>
              {/* Claim-Potenzial: nur aus Nachtragsanalyse (Strang B), nicht aus Gesamt-Score – sonst "Nicht ermittelt" */}
              <div style={{ background: customerRoute ? CX.card : "#fff", border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? "14px 16px" : "12px 14px", boxShadow: customerRoute ? CX.shadow : undefined }}>
                <div style={{ fontSize: 11, color: customerRoute ? CX.faint : "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.claimPotential}</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: customerRoute ? CX.text : "#111" }}>
                  {(() => {
                    if (!changeOrderAnalysis) {
                      return <span style={{ color: customerRoute ? CX.faint : "#9ca3af", fontWeight: 600 }}>Nicht ermittelt</span>;
                    }
                    const opps = deduplicatedOpportunities;
                    const hasHigh = opps.some((o) => (o.potential ?? "").toString().toLowerCase() === "high");
                    const hasMedium = opps.some((o) => (o.potential ?? "").toString().toLowerCase() === "medium");
                    const level = opps.length === 0 ? "Keine" : hasHigh ? "Hoch" : hasMedium ? "Mittel" : "Gering";
                    const tone = level === "Hoch" ? "#b00020" : level === "Mittel" ? "#a36b00" : level === "Keine" ? "#0a7a2f" : "#666";
                    return <span style={{ color: tone }}>{level}</span>;
                  })()}
                </div>
              </div>
            </div>

            {/* Zeile 2: Risiko-Ampel + Top Findings nebeneinander */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: customerRoute ? D.spacingCard : 12, flex: 1, minHeight: 0 }}>
              <div style={{ background: customerRoute ? CX.card : "#fff", border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? D.spacingCard : 12, overflow: "auto", boxShadow: customerRoute ? CX.shadow : undefined }}>
                <div style={{ fontSize: 12, color: customerRoute ? CX.muted : "#6b7280", fontWeight: 700, marginBottom: 10 }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.riskAmpelCategories}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {CATEGORY_ORDER.map((k) => {
                    const v = clamp0_100(result.perCategory?.[k] ?? 0);
                    const amp = traffic(v);
                    return (
                      <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 1fr 28px", gap: 8, alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: customerRoute ? CX.text : "#374151", fontWeight: 500 }}>{catLabel(k)}</span>
                        <div style={{ height: 8, background: customerRoute ? CX.barTrack : "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${v}%`, height: "100%", background: amp.tone, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: amp.tone }}>{amp.dot}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ background: customerRoute ? CX.card : "#fff", border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? D.spacingCard : 12, overflow: "auto", boxShadow: customerRoute ? CX.shadow : undefined }}>
                <div style={{ fontSize: 12, color: customerRoute ? CX.muted : "#6b7280", fontWeight: 700, marginBottom: 10 }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.topFindings}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(filteredFindings.slice(0, 8)).length === 0 ? (
                    <div style={{ color: customerRoute ? CX.faint : "#9ca3af", fontSize: 13 }}>{DEFAULT_TEXTS_CONFIG.customerUI.emptyStates.noTreffer}</div>
                  ) : (
                    filteredFindings.slice(0, 8).map((f) => (
                      <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: customerRoute ? `1px solid ${CX.rowHairline}` : "1px solid #f3f4f6" }}>
                        <span style={{ flexShrink: 0 }}>{severityDot(f.severity)}</span>
                        <span style={{ fontSize: 13, color: customerRoute ? CX.text : "#111", fontWeight: 500, lineHeight: 1.35 }}>{sanitizeForDisplay(f.title ?? "")}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          )
          )}

          {/* Tab-Inhalt: Risiken */}
          {resultTab === "risiken" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: D.spacingCard }}>
          <SectionCard accent="accent" style={{ marginBottom: 4, background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
            <p style={{ margin: 0, color: customerRoute ? CX.text : D.textPrimary, fontSize: 14, lineHeight: 1.65 }}>
              <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.risiken}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.risiken}
            </p>
          </SectionCard>

          {/* ===== Risiken im Einleitungstext ===== */}
          <SectionCard accent="warning" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 700 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.risikenVortext}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: customerRoute ? CX.faint : D.textMuted, fontWeight: 500 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.risikenVortextSub}</div>
              </div>
              <div style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>
                {vortextLoading ? "Analysiere…" : `${riskClauses.length} Treffer`}
              </div>
            </div>

            {vortextError && (
              <div style={{ marginTop: 10, padding: 12, borderRadius: D.cardRadius, background: themeColors.dangerMuted, border: `1px solid ${D.danger}` }}>
                <div style={{ fontWeight: 700, color: D.danger }}>Fehler</div>
                <div style={{ marginTop: 6, color: D.danger, fontWeight: 500, fontSize: 13 }}>{vortextError}</div>
              </div>
            )}

            {!vortextLoading && !vortextError && riskClauses.length === 0 && (
              <div style={{ marginTop: 10, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: D.fontWeightSection }}>{DEFAULT_TEXTS_CONFIG.customerUI.emptyStates.noRisikoformulierungen}</div>
            )}

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {riskClauses.map((r, idx) => {
                const teaserLen = 120;
                const cleaned = sanitizeForDisplay(r.text);
                const teaser = cleaned.length <= teaserLen ? cleaned : `${cleaned.slice(0, teaserLen)}…`;
                const title = `${r.type || "Risiko"} · ${String(r.riskLevel).toUpperCase()}`;
                return (
                  <div key={idx} style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: customerRoute ? CX.card : D.cardBg }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontWeight: D.fontWeightSection, color: customerRoute ? CX.text : D.textPrimary, fontSize: D.fontSizeCardTitle }}>
                        {riskIcon(r.riskLevel)} {r.type || "Risiko"}
                      </div>
                      <StatusBadge variant={(() => { const l = String(r.riskLevel); return l === "high" || l === "sehr_hoch" ? "danger" : l === "medium" || l === "mittel" ? "warning" : "success"; })()} small>
                        {String(r.riskLevel).toUpperCase()}
                      </StatusBadge>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: customerRoute ? CX.text : D.textPrimary,
                      }}
                    >
                      {teaser}
                    </div>

                    <button
                      type="button"
                      onClick={() => setRiskClauseDetailIndex(idx)}
                      style={{
                        marginTop: 10,
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`,
                        background: "transparent",
                        color: customerRoute ? T.accent : D.primary,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Vollständig anzeigen
                    </button>
                  </div>
                );
              })}
            </div>

            {riskClauseDetailIndex !== null && riskClauses[riskClauseDetailIndex] && (
              <VortextDetailModal
                title={`${riskClauses[riskClauseDetailIndex].type || "Risiko"} · ${String(riskClauses[riskClauseDetailIndex].riskLevel).toUpperCase()}`}
                shortText={sanitizeForDisplay(riskClauses[riskClauseDetailIndex].text).slice(0, 140)}
                longText={riskClauses[riskClauseDetailIndex].text}
                interpretation={riskClauses[riskClauseDetailIndex].interpretation}
                onClose={() => setRiskClauseDetailIndex(null)}
                theme={{
                  textPrimary: customerRoute ? CX.text : D.textPrimary,
                  textSecondary: customerRoute ? CX.muted : D.textSecondary,
                  cardBg: customerRoute ? CX.card : D.cardBg,
                  cardBorder: customerRoute ? CX.border : D.cardBorder,
                }}
              />
            )}

            <div style={{ marginTop: 10, color: customerRoute ? CX.faint : D.textMuted, fontSize: 12, fontWeight: 500 }}>
              Einleitungstext aus automatischer Textanalyse.
            </div>
          </SectionCard>

          {/* Nachtragspotenzial (Strang B): Hinweis → Tab „Nachtragspotenzial“ */}
          <SectionCard accent="secondary" style={{ marginTop: D.spacingCard, background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
            <div style={{ fontSize: 14, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 700, marginBottom: 8 }}>Nachtragspotenzial (Claim-Potenzial)</div>
            <p style={{ margin: 0, fontSize: 13, color: customerRoute ? CX.text : D.textPrimary, lineHeight: 1.5 }}>
              Die Nachtragsanalyse wird im Tab „{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.nachtragspotenzial}" ermittelt und angezeigt.
            </p>
            <button
              type="button"
              onClick={() => setResultTab("nachtragspotenzial")}
              style={{
                marginTop: 12,
                padding: "8px 14px",
                borderRadius: D.radiusButton,
                border: "none",
                background: D.secondary,
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Zum Tab {DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.nachtragspotenzial}
            </button>
          </SectionCard>

          </div>
          )}

          {/* Tab-Inhalt: Vorbemerkungen – lesbare Dokumentansicht (Standard + Experte), keine Risiko-/Technik-Vermischung */}
          {resultTab === "vorbemerkungen" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: customerRoute ? D.spacingCard : 16 }}>
            <div
              style={{
                padding: customerRoute ? "18px 20px" : "14px 18px",
                borderRadius: customerRoute ? D.cardRadius : 12,
                background: customerRoute ? CX.intro : "#f0f4f8",
                border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e2e8f0",
                marginBottom: 4,
              }}
            >
              <p style={{ margin: 0, color: customerRoute ? CX.text : "#334155", fontSize: 14, lineHeight: 1.65 }}>
                <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.vorbemerkungen}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.vorbemerkungen}
              </p>
            </div>
            <div style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: D.cardRadiusLg, padding: D.spacingCard, background: customerRoute ? CX.card : D.cardBg, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="vorbemerkungen-suche" style={{ display: "block", fontSize: 13, fontWeight: 600, color: customerRoute ? CX.muted : "#475569", marginBottom: 6 }}>
                  In Vorbemerkungen suchen
                </label>
                <input
                  id="vorbemerkungen-suche"
                  type="text"
                  placeholder="Suchbegriff eingeben …"
                  value={vorbemerkungenSearchQuery}
                  onChange={(e) => {
                    setVorbemerkungenSearchQuery(e.target.value);
                    setVorbemerkungenCurrentHitIndex(0);
                  }}
                  style={{
                    width: "100%",
                    maxWidth: 360,
                    padding: "10px 14px",
                    borderRadius: customerRoute ? D.radiusButton : 10,
                    border: `1px solid ${customerRoute ? CX.border : "#e2e8f0"}`,
                    background: customerRoute ? CX.inputBg : "#fff",
                    fontSize: 14,
                    color: customerRoute ? CX.text : "#0f172a",
                  }}
                />
              </div>
              {vorbemerkungenSearchQuery.trim() && (
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {vorbemerkungenMatchCount === 0 ? (
                    <span style={{ fontSize: 13, color: customerRoute ? CX.faint : "#94a3b8" }}>
                      Keine Treffer für &quot;{vorbemerkungenSearchQuery.trim()}&quot;.
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 600, color: customerRoute ? CX.muted : "#475569" }}>
                        {vorbemerkungenMatchCount} {vorbemerkungenMatchCount === 1 ? "Treffer" : "Treffer"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setVorbemerkungenCurrentHitIndex((i) => (i - 1 + vorbemerkungenMatchCount) % vorbemerkungenMatchCount)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${customerRoute ? CX.border : "#e2e8f0"}`,
                          background: customerRoute ? CX.surface : "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          color: customerRoute ? CX.muted : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        Vorheriger
                      </button>
                      <button
                        type="button"
                        onClick={() => setVorbemerkungenCurrentHitIndex((i) => (i + 1) % vorbemerkungenMatchCount)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${customerRoute ? CX.border : "#e2e8f0"}`,
                          background: customerRoute ? CX.surface : "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          color: customerRoute ? CX.muted : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        Nächster
                      </button>
                    </>
                  )}
                </div>
              )}
              <VorbemerkungenDocumentView
                content={vortextForDocumentViewDisplay}
                maxHeight="420px"
                searchQuery={vorbemerkungenSearchQuery.trim() || undefined}
                theme={{
                  textPrimary: customerRoute ? CX.text : D.textPrimary,
                  textSecondary: customerRoute ? CX.muted : D.textSecondary,
                  cardBorder: customerRoute ? CX.border : D.cardBorder,
                  ...(customerRoute
                    ? {
                        surfaceBg: CX.card,
                        highlightBg: "rgba(251, 191, 36, 0.2)",
                        highlightBgPositionen: "rgba(255,255,255,0.14)",
                      }
                    : {}),
                }}
              />
              {vortextForDocumentViewDisplay.trim().length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setVorbemerkungenModalOpen(true)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: customerRoute ? D.radiusButton : 10,
                      border: `1px solid ${customerRoute ? CX.border : "#ddd"}`,
                      background: "transparent",
                      color: customerRoute ? T.accent : "#111",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Volltext lesen
                  </button>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Tab-Inhalt: Positionen – vorhandene LV-Positionen aus GAEB (Standard + Experte), nur Anzeige */}
          {resultTab === "positionen" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: customerRoute ? D.spacingCard : 16 }}>
            <div
              style={{
                padding: customerRoute ? "18px 20px" : "14px 18px",
                borderRadius: customerRoute ? D.cardRadius : 12,
                background: customerRoute ? CX.intro : "#f0f4f8",
                border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e2e8f0",
                marginBottom: 4,
              }}
            >
              <p style={{ margin: 0, color: customerRoute ? CX.text : "#334155", fontSize: 14, lineHeight: 1.65 }}>
                <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.positionen}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.positionen}
              </p>
            </div>
            <div style={{ border: customerRoute ? `1px solid ${CX.border}` : "1px solid #e5e5e5", borderRadius: customerRoute ? D.cardRadiusLg : 14, padding: customerRoute ? D.spacingCard : 16, background: customerRoute ? CX.card : "#fff", boxShadow: customerRoute ? CX.shadow : undefined }}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="positionen-suche" style={{ display: "block", fontSize: 13, fontWeight: 600, color: customerRoute ? CX.muted : "#475569", marginBottom: 6 }}>
                  In Positionen suchen
                </label>
                <input
                  id="positionen-suche"
                  type="text"
                  placeholder="Suchbegriff eingeben …"
                  value={positionenSearchQuery}
                  onChange={(e) => {
                    setPositionenSearchQuery(e.target.value);
                    setPositionenCurrentHitIndex(0);
                  }}
                  style={{
                    width: "100%",
                    maxWidth: 360,
                    padding: "10px 14px",
                    borderRadius: customerRoute ? D.radiusButton : 10,
                    border: `1px solid ${customerRoute ? CX.border : "#e2e8f0"}`,
                    background: customerRoute ? CX.inputBg : "#fff",
                    fontSize: 14,
                    color: customerRoute ? CX.text : "#0f172a",
                  }}
                />
              </div>
              {positionenSearchQuery.trim() && (
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {positionenMatchCount === 0 ? (
                    <span style={{ fontSize: 13, color: customerRoute ? CX.faint : "#94a3b8" }}>
                      Keine Treffer für &quot;{positionenSearchQuery.trim()}&quot;.
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 600, color: customerRoute ? CX.muted : "#475569" }}>
                        {positionenMatchCount} {positionenMatchCount === 1 ? "Treffer" : "Treffer"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPositionenCurrentHitIndex((i) => (i - 1 + positionenMatchCount) % positionenMatchCount)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${customerRoute ? CX.border : "#e2e8f0"}`,
                          background: customerRoute ? CX.surface : "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          color: customerRoute ? CX.muted : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        Vorheriger
                      </button>
                      <button
                        type="button"
                        onClick={() => setPositionenCurrentHitIndex((i) => (i + 1) % positionenMatchCount)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${customerRoute ? CX.border : "#e2e8f0"}`,
                          background: customerRoute ? CX.surface : "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          color: customerRoute ? CX.muted : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        Nächster
                      </button>
                    </>
                  )}
                </div>
              )}
              {isGaebXml && (gaebPreview?.normalized?.displayNodes?.length ?? 0) > 0 ? (
                <PositionenNodeView
                  nodes={gaebPreview.normalized.displayNodes as import("@/lib/gaebPreviewModel").GaebPreviewDisplayNode[]}
                  maxHeight="420px"
                  theme={{
                    textPrimary: customerRoute ? CX.text : D.textPrimary,
                    textSecondary: customerRoute ? CX.muted : D.textSecondary,
                    cardBorder: customerRoute ? CX.border : D.cardBorder,
                    ...(customerRoute
                      ? {
                          surfaceBg: CX.card,
                          groupRowBg: CX.filterBg,
                          expandedRowBg: CX.inputBg,
                          groupAccentBorder: CX.muted,
                          controlAccent: T.accent,
                        }
                      : {}),
                  }}
                />
              ) : (
                <VorbemerkungenDocumentView
                  content={positionsForDocumentView}
                  maxHeight="420px"
                  variant="positionen"
                  searchQuery={positionenSearchQuery.trim() || undefined}
                  theme={{
                    textPrimary: customerRoute ? CX.text : D.textPrimary,
                    textSecondary: customerRoute ? CX.muted : D.textSecondary,
                    cardBorder: customerRoute ? CX.border : D.cardBorder,
                    ...(customerRoute
                      ? {
                          surfaceBg: CX.card,
                          highlightBg: "rgba(251, 191, 36, 0.2)",
                          highlightBgPositionen: "rgba(255,255,255,0.14)",
                        }
                      : {}),
                  }}
                />
              )}
            </div>
          </div>
          )}

          {vorbemerkungenModalOpen && vortextForDocumentViewDisplay.trim().length > 0 && (
            <VortextDetailModal
              title={DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.vorbemerkungen}
              longText={vortextForDocumentViewDisplay}
              onClose={() => setVorbemerkungenModalOpen(false)}
              theme={{
                textPrimary: customerRoute ? CX.text : D.textPrimary,
                textSecondary: customerRoute ? CX.muted : D.textSecondary,
                cardBg: customerRoute ? CX.card : D.cardBg,
                cardBorder: customerRoute ? CX.border : D.cardBorder,
              }}
            />
          )}

          {/* Tab-Inhalt: Nachtragspotenzial (Strang B) – eine gemeinsame Komponente, keine Dopplung */}
          {resultTab === "nachtragspotenzial" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: D.spacingCard }}>
            <SectionCard accent="accent" style={{ marginBottom: 0, background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
              <p style={{ margin: 0, color: customerRoute ? CX.text : D.textPrimary, fontSize: D.fontSizeSectionTitle, lineHeight: 1.65 }}>
                <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.nachtragspotenzial}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.nachtragspotenzial}
              </p>
            </SectionCard>
            {isAdminUser && (
              customerRoute ? (
                <div
                  role="region"
                  style={{
                    borderRadius: D.cardRadius,
                    border: `1px solid ${CX.border}`,
                    background: CX.surface,
                    boxShadow: CX.shadow,
                    padding: 20,
                    borderLeft: `3px solid ${T.accent}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: D.fontSizeBody, color: CX.text, fontWeight: 600 }}>
                      Interne V2-Berechnung (Nachtragspotenzial) ist nur zu Analysezwecken vorgesehen.
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: D.fontSizeBody, color: CX.muted }}>
                      <input
                        type="checkbox"
                        checked={showNachtragV2Debug}
                        onChange={(e) => setShowNachtragV2Debug(e.target.checked)}
                      />
                      <span>V2 Debug anzeigen</span>
                    </label>
                  </div>
                </div>
              ) : (
                <SectionCard accent="secondary" style={{ background: D.cardBg, borderColor: D.cardBorder, boxShadow: D.cardShadow }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: D.fontSizeBody, color: D.textSecondary, fontWeight: 600 }}>
                      Interne V2-Berechnung (Nachtragspotenzial) ist nur zu Analysezwecken vorgesehen.
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: D.fontSizeBody, color: D.textSecondary }}>
                      <input
                        type="checkbox"
                        checked={showNachtragV2Debug}
                        onChange={(e) => setShowNachtragV2Debug(e.target.checked)}
                      />
                      <span>V2 Debug anzeigen</span>
                    </label>
                  </div>
                </SectionCard>
              )
            )}
            <NachtragspotenzialBlock
              analysis={changeOrderAnalysis}
              loading={changeOrderLoading}
              useChangePotentialLlm={useChangePotentialLlm}
              onUseChangePotentialLlmChange={setUseChangePotentialLlm}
              onGenerate={generateChangeOrderAnalysis}
              deduplicatedOpportunities={deduplicatedOpportunities}
              isExpertMode={isExpertMode}
              customerRoute={!!customerRoute}
              designTokens={
                customerRoute
                  ? {
                      ...D,
                      cardBg: CX.card,
                      cardBorder: CX.border,
                      textPrimary: CX.text,
                      textSecondary: CX.muted,
                      textMuted: CX.faint,
                      primary: T.accent,
                    }
                  : D
              }
              proFeatureLocked={!canUseChangeOrder}
            />
            {isAdminUser && showNachtragV2Debug && changeOrderAnalysis?.changePotentialSummary?.v2Debug && (
              <SectionCard accent="secondary" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div style={{ fontSize: D.fontSizeSectionTitle, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: D.fontWeightSection }}>
                    Nachtragspotenzial V2 (intern)
                  </div>
                  <div style={{ fontSize: D.fontSizeCaption, color: customerRoute ? CX.faint : D.textMuted }}>
                    Nur Admin/Debug – Legacy bleibt produktiv.
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: D.fontSizeBody, color: customerRoute ? CX.text : D.textPrimary }}>
                  <div>
                    <strong>Exposure-Score:</strong> {changeOrderAnalysis.changePotentialSummary.v2Debug.exposureScore} / 100
                  </div>
                  <div>
                    <strong>Durchsetzbarkeit:</strong> {changeOrderAnalysis.changePotentialSummary.v2Debug.enforceabilityScore} / 100
                  </div>
                  {(() => {
                    const v: any = changeOrderAnalysis.changePotentialSummary.v2Debug;
                    const d: any = v?.debug ?? {};
                    const rawPositive = Number(d.enforceabilityRawPositiveScore ?? d.positiveContributionSum ?? 0);
                    const rawNegative = Number(d.enforceabilityRawNegativeScore ?? d.negativeContributionSum ?? 0);
                    const rawBaseScore = Number(d.enforceabilityRawBaseScore ?? d.enforceabilityRawBeforeNormalize ?? d.rawEnforceabilityBeforeClamp ?? 0);
                    const floorApplied = Boolean(d.enforceabilityFloorApplied ?? false);
                    const floorValue = Number(d.enforceabilityFloorValue ?? 0);

                    const scoreBeforeNormalize = Number(d.enforceabilityScoreBeforeNormalize ?? rawBaseScore ?? 0);
                    const scoreAfterNormalize = Number(d.enforceabilityScoreAfterNormalize ?? d.enforceabilityRawAfterNormalize ?? d.normalizedEnforceability ?? 0);
                    const normalizeRoundedFrom = Number(d.normalizeRoundedFrom ?? 0);
                    const normalizeClampApplied = Boolean(d.normalizeClampApplied ?? false);

                    const anchorBoost = Number(d.anchorEnforceabilityBoost ?? 0);
                    const beforeRoundClamp = Number(d.enforceabilityScoreBeforeRoundClamp ?? (scoreAfterNormalize + anchorBoost));
                    const roundedFrom = Number(d.enforceabilityRoundedFrom ?? 0);
                    const clampApplied = Boolean(d.enforceabilityClampApplied ?? false);
                    const finalEnforceabilityScore = Number(d.enforceabilityFinalEnforceabilityScore ?? NaN);
                    const mc = d.enforceabilityMarkerContributions ?? {};
                    const pd = d.positiveEnforceabilityDebug ?? {};
                    const sp = d.strongestPositiveDriver;
                    const sn = d.strongestNegativeBlocker;
                    const tokens = [
                      `unresolvedClaimTopic: -${Number(mc.unresolvedClaimTopic ?? 0).toFixed(2)}`,
                      `allInclusiveLanguage: -${Number(mc.allInclusiveLanguage ?? 0).toFixed(2)}`,
                      `vagueBoundary: -${Number(mc.vagueBoundary ?? 0).toFixed(2)}`,
                      `explicitAssignment: +${Number(mc.explicitAssignment ?? 0).toFixed(2)}`,
                      `raw-backed anchor support: +${Number(mc.rawBackedAnchorSupport ?? 0).toFixed(2)}`,
                      `family confidence / evidence quality: ${Number(mc.familyConfidenceEvidenceQuality ?? 0) >= 0 ? "+" : ""}${Number(mc.familyConfidenceEvidenceQuality ?? 0).toFixed(2)}`,
                    ];
                    const strongPos = sp
                      ? `${sp.family} (${sp.evidenceId}) w:${Number(sp.weight ?? 0).toFixed(2)}`
                      : "-";
                    const strongNeg = sn
                      ? `${sn.family} (${sn.evidenceId}) w:${Number(sn.weight ?? 0).toFixed(2)}`
                      : "-";

                    const formatQualMap = (m: any) => {
                      try {
                        const entries = Object.entries(m ?? {});
                        if (!entries.length) return "-";
                        return entries
                          .sort((a: any, b: any) => Number(b[1] ?? 0) - Number(a[1] ?? 0))
                          .slice(0, 6)
                          .map(([k, v]: any) => `${k}:${Number(v ?? 0).toFixed(0)}`)
                          .join(", ");
                      } catch {
                        return "-";
                      }
                    };

                    const formatRejected = (rej: any) => {
                      try {
                        const out: string[] = [];
                        const keys = Object.keys(rej ?? {});
                        for (const k of keys.slice(0, 6)) {
                          const reasons = rej[k] ?? {};
                          const rEntries = Object.entries(reasons).sort((a: any, b: any) => Number(b[1] ?? 0) - Number(a[1] ?? 0));
                          const top = rEntries.slice(0, 2).map(([rk, rv]: any) => `${rk}:${Number(rv ?? 0).toFixed(0)}`);
                          out.push(`${k}[${top.join("|")}]`);
                        }
                        return out.length ? out.join(" · ") : "-";
                      } catch {
                        return "-";
                      }
                    };

                    return (
                      <>
                        <div>
                          <strong>Enforceability Debug (Final Source-of-Truth):</strong> final = `lib/nachtrag-v2/aggregate.ts` → `buildAggregateScores().enforceabilityScore`
                          <br />
                          Pos {rawPositive.toFixed(2)} - Neg {rawNegative.toFixed(2)} = RawBase {rawBaseScore.toFixed(2)}
                          {floorApplied ? ` (floorApplied:true; floor:${floorValue})` : " (floorApplied:false)"} · ScoreBeforeNorm {scoreBeforeNormalize.toFixed(2)} → AfterNorm {scoreAfterNormalize.toFixed(2)}
                          {normalizeClampApplied ? ` (normalizeClampApplied:true; roundedFrom:${normalizeRoundedFrom})` : ""}
                          <br />
                          +AnchorBoost {anchorBoost.toFixed(2)} ⇒ scoreBeforeRoundClamp {beforeRoundClamp.toFixed(2)}
                          <br />
                          Rounded {roundedFrom} → ClampRange [0..100] ⇒ final ={" "}
                          {Number.isFinite(finalEnforceabilityScore) ? `${finalEnforceabilityScore.toFixed(0)} / 100` : `debugMissing (fallback final=${Number(v?.enforceabilityScore ?? 0).toFixed(0)} / 100)`}
                          <br />
                          ClampApplied: {clampApplied ? "true" : "false"} (what happens after Rounded: clamp to [0..100])
                          <br />
                          Strongest: Pos {sp ? `${sp.family} (${sp.evidenceId})` : "-"} · Neg {sn ? `${sn.family} (${sn.evidenceId})` : "-"}
                        </div>
                        <div>
                          <strong>Marker Beiträge:</strong> {tokens.join(" · ")}
                        </div>
                        <div>
                          <strong>Strong Driver/Blocker:</strong> Pos {strongPos} · Neg {strongNeg}
                          {!sp && !sn && anchorBoost > 0 ? " (Final kommt nur von Anchor-Boost)" : ""}
                        </div>
                        <div>
                          <strong>Pos-Qualifier Debug:</strong>{" "}
                          detectedPos: {formatQualMap(pd.detectedPositiveQualifiers)} · detectedNeg: {formatQualMap(pd.detectedNegativeQualifiers)}
                          <br />
                          requiredPos: {(pd.requiredPositiveQualifiers ?? []).length ? (pd.requiredPositiveQualifiers ?? []).join(", ") : "-"} · allowPositive:{" "}
                          {pd.allowPositive?.allowPositiveTrue ?? 0}/{pd.allowPositive?.allowPositiveFalse ?? 0}
                          <br />
                          candidates: +{pd.countPositiveCandidates ?? 0} / -{pd.countNegativeCandidates ?? 0}
                          <br />
                          acceptedPos: {formatQualMap(pd.acceptedPositiveQualifiers)} · partiallyAcceptedPos: {formatQualMap(pd.partiallyAcceptedPositiveQualifiers)}
                          <br />
                          rejectedPos: {formatRejected(pd.rejectedPositiveQualifiers)}
                          <br />
                          familyAgnosticQualityGate:{" "}
                          {pd.lastFamilyAgnosticQualityGatePass ? "pass" : "fail"} (
                          {pd.lastFamilyAgnosticQualityGateReason ?? "fail"})
                          <br />
                          hasRawSupport: {pd.hasRawSupport ? "true" : "false"} · rawLvCount: {pd.rawLvCount ?? 0} · rawEvidenceShare:{" "}
                          {(pd.rawEvidenceShare ?? 0).toFixed(2)}
                        </div>
                      </>
                    );
                  })()}
                  <div>
                    <strong>Gesamtpotenzial V2:</strong> {changeOrderAnalysis.changePotentialSummary.v2Debug.potentialScore} / 100
                  </div>
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: D.fontSizeCaption, color: customerRoute ? CX.muted : D.textSecondary }}>
                  <div>
                    <strong>Subscores:</strong>{" "}
                    VA {changeOrderAnalysis.changePotentialSummary.v2Debug.subscores.vertrags_abgrenzung} ·{" "}
                    AM {changeOrderAnalysis.changePotentialSummary.v2Debug.subscores.ausfuehrung_mengen} ·{" "}
                    DI {changeOrderAnalysis.changePotentialSummary.v2Debug.subscores.doku_ibn}
                  </div>
                  {changeOrderAnalysis.changePotentialSummary.v2Debug.anchors.length > 0 && (
                    <div>
                      <strong>Anchor-Events:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.anchors
                        .map((a) => {
                          const mass = typeof a.anchorWeightedMass === "number" ? a.anchorWeightedMass : 0;
                          const rawMass = typeof a.anchorRawWeightedMass === "number" ? a.anchorRawWeightedMass : 0;
                          const synMass =
                            (typeof a.anchorSyntheticClaimWeightedMass === "number" ? a.anchorSyntheticClaimWeightedMass : 0) +
                            (typeof a.anchorSyntheticRiskWeightedMass === "number" ? a.anchorSyntheticRiskWeightedMass : 0);
                          const conf = typeof a.anchorConfidence === "number" ? a.anchorConfidence : 0;
                          const mode = a.anchorSupportMode ?? "none";
                          const why = a.fired ? a.whyFired : a.whySuppressed;
                          const whyShort = typeof why === "string" ? why.slice(0, 70) : "";
                          const syntheticOnly =
                            a.fired &&
                            (mode === "synthetic_claim_wrapper" || mode === "synthetic_risk_summary") &&
                            conf < 0.45;
                          const status = a.fired ? (syntheticOnly ? " (synthetic-only, defensiv aktiv)" : " (aktiv)") : " (suppr.)";
                          return `${a.label}${status} [m:${mass.toFixed(2)}; raw:${rawMass.toFixed(2)}; syn:${synMass.toFixed(2)}; conf:${conf.toFixed(2)}; ${mode}]${whyShort ? ` · ${whyShort}` : ""}`;
                        })
                        .join(" || ") || "keine Anchor-Events"}
                    </div>
                  )}
                  {changeOrderAnalysis.changePotentialSummary.v2Debug.commodityCaps.length > 0 && (
                    <div>
                      <strong>Commodity-Caps:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.commodityCaps
                        .map((c) => `${c.family}: ${c.capped.toFixed(1)}/${c.cap.toFixed(1)}`)
                        .join(" · ")}
                    </div>
                  )}
                  {changeOrderAnalysis.changePotentialSummary.v2Debug.drivers.length > 0 && (
                    <div>
                      <strong>Treiber:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.drivers.join(" | ")}
                    </div>
                  )}
                  {changeOrderAnalysis.changePotentialSummary.v2Debug.blockers.length > 0 && (
                    <div>
                      <strong>Blocker:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.blockers.join(" | ")}
                    </div>
                  )}
                  {changeOrderAnalysis.changePotentialSummary.v2Debug.notes &&
                    changeOrderAnalysis.changePotentialSummary.v2Debug.notes.length > 0 && (
                      <div>
                        <strong>Notizen:</strong>{" "}
                        {changeOrderAnalysis.changePotentialSummary.v2Debug.notes.join(" | ")}
                      </div>
                    )}
                </div>
              </SectionCard>
            )}

            {isAdminUser &&
              showNachtragV2Debug &&
              changeOrderAnalysis?.changePotentialSummary?.v2Debug?.validationReport && (
                <SectionCard accent="secondary" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
                  <div style={{ fontSize: D.fontSizeSectionTitle, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: D.fontWeightSection, marginBottom: 8 }}>
                    V2-Kalibrierungsreport
                  </div>

                  <div style={{ display: "grid", gap: 8, fontSize: D.fontSizeCaption, color: customerRoute ? CX.muted : D.textSecondary }}>
                    <div>
                      <strong>Family-Verteilung (nur family-eligible evidences):</strong>{" "}
                      {Object.entries(
                        changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.familiesHistogram ?? {}
                      )
                        .sort((a, b) => (b[1]?.totalWeight ?? 0) - (a[1]?.totalWeight ?? 0))
                        .slice(0, 10)
                        .map(([fam, v]) => `${fam} (${v.count})`)
                        .join(" · ") || "-"}
                      {(changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.familyExcludedCount ?? 0) > 0 && (
                        <span style={{ marginLeft: 8, color: customerRoute ? CX.muted : D.textSecondary }}>
                          · Ausgeschlossen: {changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.familyExcludedCount} synthetic evidences
                        </span>
                      )}
                    </div>
                    <div>
                      <strong>Evidence-Confidence:</strong>{" "}
                      {(() => {
                        const vr = changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport;
                        const raw = Number(vr.rawEvidenceCount ?? 0);
                        const syn = Number(vr.syntheticEvidenceCount ?? 0);
                        const share = Number(vr.rawEvidenceShare ?? 0);
                        const q = Number(vr.evidenceQualityFactor ?? 0);
                        const sharePct = Math.round(share * 100);
                        return `Raw ${raw} · Synthetic ${syn} · Raw-Share: ${sharePct}% · Qualität: ${q.toFixed(2)}`;
                      })()}
                    </div>
                    {Object.keys(changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.claimGapTypeHistogram ?? {}).length > 0 && (
                      <div>
                        <strong>Claim-/Gap-Typen:</strong>{" "}
                        {Object.entries(
                          changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.claimGapTypeHistogram ?? {}
                        )
                          .sort((a, b) => b[1] - a[1])
                          .map(([t, c]) => `${t} (${c})`)
                          .join(" · ")}
                      </div>
                    )}
                    {Object.keys(changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.originHistogram ?? {}).length > 0 && (
                      <div>
                        <strong>Evidence-Origin:</strong>{" "}
                        {Object.entries(
                          changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.originHistogram ?? {}
                        )
                          .sort((a, b) => b[1] - a[1])
                          .map(([o, c]) => `${o} (${c})`)
                          .join(" · ")}
                      </div>
                    )}

                    <div>
                      <strong>Qualifier-Verteilung:</strong>{" "}
                      {(() => {
                        const q = changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.qualifierHistogram;
                        const pos = Object.entries(q?.positive ?? {})
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 6)
                          .map(([k, v]) => `${k} (${v})`)
                          .join(", ");
                        const neg = Object.entries(q?.negative ?? {})
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 6)
                          .map(([k, v]) => `${k} (${v})`)
                          .join(", ");
                        return `${pos ? `Positiv: ${pos}` : "Positiv: -"} · ${neg ? `Negativ: ${neg}` : "Negativ: -"}`;
                      })()}
                    </div>

                    <div>
                      <strong>Warnflags:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.warnings.length > 0
                        ? changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.warnings.join(" · ")
                        : "keine"}
                    </div>

                    <div>
                      <strong>Top Exposure-Treiber:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.topExposureDrivers.join(" | ") || "-"}
                    </div>
                    <div>
                      <strong>Top Enforceability-Treiber:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.topEnforceabilityDrivers.join(" | ") || "-"}
                    </div>
                    <div>
                      <strong>Top Enforceability-Blocker:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.topEnforceabilityBlockers.join(" | ") || "-"}
                    </div>

                    <div>
                      <strong>Fired Anchors:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.firedAnchors.length > 0
                        ? changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.firedAnchors
                            .map((a) => a.label)
                            .join(" · ")
                        : "keine"}
                    </div>
                    <div>
                      <strong>Non-fired Anchors:</strong>{" "}
                      {changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.nonFiredAnchors.length > 0
                        ? changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.nonFiredAnchors
                            .slice(0, 6)
                            .map((a) => `${a.label}${a.reason ? ` (${a.reason})` : ""}`)
                            .join(" · ")
                        : "keine"}
                    </div>

                    {(changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.unknownDebugSamples?.length ?? 0) > 0 && (
                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                          Unknown-Debug (erste {changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.unknownDebugSamples?.length ?? 0} Fälle)
                        </summary>
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                          {(changeOrderAnalysis.changePotentialSummary.v2Debug.validationReport.unknownDebugSamples ?? []).map((u: any, i: number) => (
                            <div
                              key={i}
                              style={{
                                padding: 10,
                                background: "#f8fafc",
                                borderRadius: 8,
                                border: "1px solid #e2e8f0",
                                fontSize: 12,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              <div>Snippet: {u.snippet}</div>
                              <div>Quelle: {u.source} · Origin: {u.evidenceOrigin ?? "-"} · Typ: {u.claimGapType} · Family: {u.family}</div>
                              <div>Grund: {u.unknownReason ?? "-"}</div>
                              <div>Family-Scores: {Object.entries(u.familyScores ?? {})
                                .filter(([, v]) => Number(v) > 0)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(", ") || "alle 0"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </SectionCard>
              )}
          </div>
          )}

          {/* Tab-Inhalt: Trigger */}
          {resultTab === "trigger" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: D.spacingCard }}>
          {isExpertMode && (
          <SectionCard accent="secondary" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: D.fontSizeSectionTitle, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: D.fontWeightSection }}>Filter</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                {result.llmMode && (
                  <div style={{ fontSize: D.fontSizeSmall, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>
                    KI-Analyse: {result.findingsBeforeLlm ?? 0} Regeln + {(result.findingsAfterLlm ?? 0) - (result.findingsBeforeLlm ?? 0)} KI = {result.findingsAfterLlm ?? 0} erkannte Risiken
                  </div>
                )}
                <div style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Treffer nach Filter: {filteredFindings.length}</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr auto", gap: 10 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche (Titel, Detail, ID, Kategorie)..."
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
              />

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
              >
                <option value="both">Quelle: alle</option>
                <option value="db">Quelle: nur DB</option>
                <option value="sys">Quelle: nur SYS</option>
                <option value="llm">Quelle: nur KI</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
              >
                <option value="all">Risiko: alle</option>
                <option value="high">Risiko: hoch</option>
                <option value="medium">Risiko: mittel</option>
                <option value="low">Risiko: niedrig</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
              >
                <option value="all">Kategorie: alle</option>
                {availableFindingCategories.map((c) => (
                  <option key={c} value={c}>
                    {catLabel(c)}
                  </option>
                ))}
              </select>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
              >
                <option value="penalty_desc">Sort: Gewichtung ↓</option>
                <option value="severity_desc">Sort: Risiko ↓</option>
                <option value="category_az">Sort: Kategorie A–Z</option>
              </select>

              <button
                onClick={resetFilters}
                style={{
                  padding: "10px 12px",
                  borderRadius: D.radiusButton,
                  border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`,
                  background: customerRoute ? CX.card : D.cardBg,
                  color: customerRoute ? CX.muted : D.textSecondary,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: D.fontSizeBody,
                }}
              >
                Filter zurücksetzen
              </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", color: customerRoute ? CX.text : D.textPrimary, fontWeight: 600, fontSize: D.fontSizeBody }}>
                <input type="checkbox" checked={top10} onChange={(e) => setTop10(e.target.checked)} />
                <span>Nur die 10 wichtigsten</span>
              </label>

              <div style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600, fontSize: D.fontSizeCaption }}>
                Datenbank: {dbFindings.length} | System: {sysFindings.length}
                {llmFindings.length > 0 ? ` | KI: ${llmFindings.length}` : ""}
                {otherFindings.length > 0 ? ` | Sonstige: ${otherFindings.length}` : ""}
              </div>
            </div>
          </SectionCard>
          )}

          {/* Findings: Standard = vereinfachte Darstellung (nur Titel, Kategorie, Risiko), Experte = Filter + getrennte Blöcke mit allen Infos */}
          {!isExpertMode && (
          <SectionCard accent="primary" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: D.fontSizeSectionTitle, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: D.fontWeightSection }}>Treffer</div>
              <div style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>{filteredFindings.length} Treffer</div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {filteredFindings.length === 0 ? (
                <div style={{ color: customerRoute ? CX.faint : D.textMuted, fontSize: D.fontSizeBody }}>Keine Treffer.</div>
              ) : (
                filteredFindings.map((f) => (
                  <div key={f.id} style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: customerRoute ? CX.card : D.cardBg }}>
                    <div style={{ fontWeight: D.fontWeightCardTitle, color: customerRoute ? CX.text : D.textPrimary, marginBottom: 6, fontSize: D.fontSizeBody }}>{sanitizeForDisplay(f.title ?? "")}</div>
                    <div style={{ fontSize: D.fontSizeBody, color: customerRoute ? CX.muted : D.textSecondary }}>Kategorie: {catLabel(f.category)}</div>
                    <div style={{ fontSize: D.fontSizeBody, color: customerRoute ? CX.muted : D.textSecondary, marginTop: 2 }}>Risiko: {severityLabel(f.severity)}</div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
          )}

          {/* Findings Blocks (nur Expertenmodus) */}
          {isExpertMode && (
          <div style={{ display: "grid", gap: D.spacingCard }}>
            {/* DB */}
            <SectionCard accent="primary" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: D.fontSizeSectionTitle, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: D.fontWeightSection }}>Erkannte Risiken (Regel-Datenbank)</div>
                <div style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>{dbFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {dbFindings.length === 0 ? (
                  <div style={{ color: customerRoute ? CX.faint : D.textMuted, fontSize: D.fontSizeBody }}>Keine Treffer aus der Regel-Datenbank.</div>
                ) : (
                  dbFindings.map((f) => (
                    <div key={f.id} style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: customerRoute ? CX.card : D.cardBg }}>
                      <div style={{ display: "grid", gap: 6, fontSize: D.fontSizeBody }}>
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>{customerRoute ? "Prüfregel: " : "Trigger-ID: "}</span>{stripPrefix(f.id)}</div>
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Kategorie:</span> {catLabel(f.category)}</div>
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Gewichtung:</span> -{f.penalty}</div>
                        {(f as any).norm != null && (f as any).norm !== "" && <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Norm:</span> {(f as any).norm}</div>}
                        {(f as any).claimLevel != null && (f as any).claimLevel !== "" && <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Claim-Level:</span> {(f as any).claimLevel}</div>}
                        {(f as any).regex != null && (f as any).regex !== "" && <div style={{ fontFamily: "ui-monospace, monospace", fontSize: D.fontSizeCaption }}><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Regex:</span> {(f as any).regex}</div>}
                        {(f as any).keywords != null && (f as any).keywords !== "" && <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Keywords:</span> {(f as any).keywords}</div>}
                        <div style={{ marginTop: 4, fontWeight: D.fontWeightCardTitle, color: customerRoute ? CX.text : D.textPrimary }}>{sanitizeForDisplay(f.title ?? "")}</div>
                        {f.detail && <div style={{ color: customerRoute ? CX.muted : D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(f.detail)}</div>}
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Risiko:</span> {severityLabel(f.severity)} {severityDot(f.severity)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            {/* SYS */}
            <SectionCard accent="accent" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: D.fontSizeSectionTitle, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: D.fontWeightSection }}>Erkannte Risiken (Systemprüfung)</div>
                <div style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>{sysFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {sysFindings.length === 0 ? (
                  <div style={{ color: customerRoute ? CX.faint : D.textMuted, fontSize: D.fontSizeBody }}>Keine Treffer aus Systemprüfung.</div>
                ) : (
                  sysFindings.map((f) => (
                    <div key={f.id} style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: customerRoute ? CX.card : D.cardBg }}>
                      <div style={{ display: "grid", gap: 6, fontSize: D.fontSizeBody }}>
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>{customerRoute ? "Prüfregel: " : "Trigger-ID: "}</span>{stripPrefix(f.id)}</div>
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Kategorie:</span> {catLabel(f.category)}</div>
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Gewichtung:</span> -{f.penalty}</div>
                        {(f as any).norm != null && (f as any).norm !== "" && <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Norm:</span> {(f as any).norm}</div>}
                        {(f as any).claimLevel != null && (f as any).claimLevel !== "" && <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Claim-Level:</span> {(f as any).claimLevel}</div>}
                        {(f as any).regex != null && (f as any).regex !== "" && <div style={{ fontFamily: "ui-monospace, monospace", fontSize: D.fontSizeCaption }}><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Regex:</span> {(f as any).regex}</div>}
                        {(f as any).keywords != null && (f as any).keywords !== "" && <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Keywords:</span> {(f as any).keywords}</div>}
                        <div style={{ marginTop: 4, fontWeight: D.fontWeightCardTitle, color: customerRoute ? CX.text : D.textPrimary }}>{sanitizeForDisplay(f.title ?? "")}</div>
                        {f.detail && <div style={{ color: customerRoute ? CX.muted : D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(f.detail)}</div>}
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Risiko:</span> {severityLabel(f.severity)} {severityDot(f.severity)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {otherFindings.length > 0 && (
                <div style={{ marginTop: 12, color: customerRoute ? CX.faint : D.textMuted, fontSize: D.fontSizeCaption }}>
                  Hinweis: {otherFindings.length} erkannte Risiken ohne Zuordnung (Datenbank/System/KI) im Ergebnis.
                </div>
              )}
            </SectionCard>

            {/* LLM */}
            {llmFindings.length > 0 && (
              <SectionCard accent="secondary" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: D.fontSizeSectionTitle, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: D.fontWeightSection }}>Erkannte Risiken (KI-Analyse)</div>
                  <div style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>{llmFindings.length} Treffer</div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {llmFindings.map((f) => (
                    <div key={f.id} style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: customerRoute ? CX.card : D.cardBg }}>
                      <div style={{ display: "grid", gap: 6, fontSize: D.fontSizeBody }}>
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>{customerRoute ? "Prüfregel: " : "Trigger-ID: "}</span>{stripPrefix(f.id)}</div>
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Kategorie:</span> {catLabel(f.category)}</div>
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Gewichtung:</span> -{f.penalty}</div>
                        {(f as any).norm != null && (f as any).norm !== "" && <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Norm:</span> {(f as any).norm}</div>}
                        {(f as any).claimLevel != null && (f as any).claimLevel !== "" && <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Claim-Level:</span> {(f as any).claimLevel}</div>}
                        {(f as any).regex != null && (f as any).regex !== "" && <div style={{ fontFamily: "ui-monospace, monospace", fontSize: D.fontSizeCaption }}><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Regex:</span> {(f as any).regex}</div>}
                        {(f as any).keywords != null && (f as any).keywords !== "" && <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Keywords:</span> {(f as any).keywords}</div>}
                        <div style={{ marginTop: 4, fontWeight: D.fontWeightCardTitle, color: customerRoute ? CX.text : D.textPrimary }}>{sanitizeForDisplay(f.title ?? "")}</div>
                        {f.detail && <div style={{ color: customerRoute ? CX.muted : D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(f.detail)}</div>}
                        <div><span style={{ color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>Risiko:</span> {severityLabel(f.severity)} {severityDot(f.severity)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
          )}
          </div>
          )}

          {/* Tab-Inhalt: Rückfragen */}
          {resultTab === "rueckfragen" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: D.spacingCard }}>
          <SectionCard accent="accent" style={{ marginBottom: 0, background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
            <p style={{ margin: 0, color: customerRoute ? CX.text : D.textPrimary, fontSize: D.fontSizeSectionTitle, lineHeight: 1.65 }}>
              <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.rueckfragen}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.rueckfragen}
            </p>
          </SectionCard>
          <SectionCard accent="primary" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: clarificationQuestions ? 16 : 0 }}>
              <div style={{ fontSize: 15, color: customerRoute ? CX.text : D.textPrimary, fontWeight: 700 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.rueckfragenBlock}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!canUseAdvancedFeatures && (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 600, color: customerRoute ? CX.faint : D.textMuted }}>Nur in Pro</span>
                    <Link href="/pricing" style={{ fontSize: 12, fontWeight: 600, color: D.primary }}>→ Pro</Link>
                  </>
                )}
                <button
                  onClick={generateClarificationQuestions}
                  disabled={clarificationQuestionsLoading || !canUseAdvancedFeatures}
                  style={{
                    padding: "10px 18px",
                    borderRadius: D.radiusButton,
                    border: "none",
                    background: !canUseAdvancedFeatures ? D.textMuted : clarificationQuestionsLoading ? D.textMuted : D.primary,
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: clarificationQuestionsLoading || !canUseAdvancedFeatures ? "not-allowed" : "pointer",
                    opacity: clarificationQuestionsLoading || !canUseAdvancedFeatures ? 0.8 : 1,
                  }}
                >
                  {clarificationQuestionsLoading ? DEFAULT_TEXTS_CONFIG.rueckfragen.generateButtonLoading : DEFAULT_TEXTS_CONFIG.rueckfragen.generateButton}
                </button>
              </div>
            </div>

            {clarificationQuestions && (
              <>
                <div style={{ display: "grid", gap: D.spacingCard }}>
                  {(["technisch", "vertraglich", "terminlich"] as const).map((group) => {
                    const items = clarificationQuestions.byGroup?.[group] ?? [];
                    const labels = DEFAULT_TEXTS_CONFIG.rueckfragen.groupLabels;
                    if (items.length === 0) return null;
                    return (
                      <div key={group} style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: D.cardRadius, padding: 14, background: customerRoute ? CX.filterBg : D.filterBg }}>
                        <div style={{ fontSize: 12, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 700, marginBottom: 10 }}>
                          {labels[group]} ({items.length})
                        </div>
                        <div style={{ display: "grid", gap: 10 }}>
                          {items.map((q: any) => (
                            <div key={q.id} style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: 10, padding: 12, background: customerRoute ? CX.card : D.cardBg }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <StatusBadge variant={q.severity === "high" ? "danger" : q.severity === "medium" ? "warning" : "info"} small>
                                  {q.severity ?? "—"}
                                </StatusBadge>
                                {q.sourceFindingId && (
                                  <span style={{ fontSize: 11, color: customerRoute ? CX.faint : D.textMuted }}>← {q.sourceFindingId}</span>
                                )}
                              </div>
                              <div style={{ marginTop: 8, fontWeight: 600, color: customerRoute ? CX.text : D.textPrimary, fontSize: 13, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(q.question ?? "")}</div>
                              <div style={{ marginTop: 6, fontSize: 12, color: customerRoute ? CX.muted : D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(q.reason ?? "")}</div>
                              {q.sourceTextSnippet && (
                                <div style={{ marginTop: 6, fontSize: 11, color: customerRoute ? CX.faint : D.textMuted, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap" }}>
                                  &quot;{sanitizeForDisplay(q.sourceTextSnippet)}&quot;
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </>
            )}

            {!clarificationQuestions && (
              <div style={{ marginTop: 12, color: customerRoute ? CX.muted : D.textSecondary, fontSize: 13, fontWeight: 600 }}>
                {DEFAULT_TEXTS_CONFIG.rueckfragen.emptyState}
              </div>
            )}
          </SectionCard>
          </div>
          )}

          {/* Tab-Inhalt: Angebotsklarstellungen */}
          {resultTab === "angebotsklarstellungen" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: D.spacingCard }}>
          <SectionCard accent="primary" style={{ marginBottom: 0, background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
            <p style={{ margin: 0, color: customerRoute ? CX.text : D.textPrimary, fontSize: D.fontSizeSectionTitle, lineHeight: 1.65 }}>
              <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.angebotsklarstellungen}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.angebotsklarstellungen}
            </p>
          </SectionCard>
          <SectionCard accent="secondary" style={{ background: customerRoute ? CX.card : D.cardBg, borderColor: customerRoute ? CX.border : D.cardBorder, boxShadow: customerRoute ? CX.shadow : D.cardShadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: offerAssumptions ? 16 : 0 }}>
              <div style={{ fontSize: 15, color: customerRoute ? CX.text : D.textPrimary, fontWeight: 700 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.angebotsBlock}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!canUseAdvancedFeatures && (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 600, color: customerRoute ? CX.faint : D.textMuted }}>Nur in Pro</span>
                    <Link href="/pricing" style={{ fontSize: 12, fontWeight: 600, color: D.primary }}>→ Pro</Link>
                  </>
                )}
                <button
                  onClick={generateOfferAssumptions}
                  disabled={offerAssumptionsLoading || !canUseAdvancedFeatures}
                  style={{
                    padding: "10px 18px",
                    borderRadius: D.radiusButton,
                    border: "none",
                    background: !canUseAdvancedFeatures ? D.textMuted : offerAssumptionsLoading ? D.textMuted : D.primary,
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: offerAssumptionsLoading || !canUseAdvancedFeatures ? "not-allowed" : "pointer",
                    opacity: offerAssumptionsLoading || !canUseAdvancedFeatures ? 0.8 : 1,
                  }}
                >
                  {offerAssumptionsLoading ? DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.generateButtonLoading : DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.generateButton}
                </button>
              </div>
            </div>

            {offerAssumptions && (
              <>
                <div style={{ display: "grid", gap: D.spacingCard }}>
                  {(["technisch", "vertraglich", "terminlich"] as const).map((group) => {
                    const items = offerAssumptions.byGroup?.[group] ?? [];
                    const labels = DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.groupLabels;
                    if (items.length === 0) return null;
                    return (
                      <div key={group} style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: D.cardRadius, padding: 14, background: customerRoute ? CX.filterBg : D.filterBg }}>
                        <div style={{ fontSize: 12, color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 700, marginBottom: 10 }}>
                          {labels[group]} ({items.length})
                        </div>
                        <div style={{ display: "grid", gap: 10 }}>
                          {items.map((a: any) => (
                            <div key={a.id} style={{ border: `1px solid ${customerRoute ? CX.border : D.cardBorder}`, borderRadius: 10, padding: 12, background: customerRoute ? CX.card : D.cardBg }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <StatusBadge variant={a.severity === "high" ? "danger" : a.severity === "medium" ? "warning" : "info"} small>
                                  {a.severity ?? "—"}
                                </StatusBadge>
                                <span style={{ fontSize: 11, color: customerRoute ? CX.faint : D.textMuted }}>
                                  {a.sourceFindingId && <>Risiko: {a.sourceFindingId}</>}
                                  {a.sourceFindingId && a.sourceQuestionId && " · "}
                                  {a.sourceQuestionId && <>Frage: {a.sourceQuestionId}</>}
                                </span>
                              </div>
                              <div style={{ marginTop: 8, fontWeight: 600, color: customerRoute ? CX.text : D.textPrimary, fontSize: 13, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(a.assumption ?? "")}</div>
                              <div style={{ marginTop: 6, fontSize: 12, color: customerRoute ? CX.muted : D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(a.reason ?? "")}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </>
            )}

            {!offerAssumptions && !offerAssumptionsLoading && (
              <div style={{ marginTop: 12, color: customerRoute ? CX.muted : D.textSecondary, fontSize: 13, fontWeight: 600 }}>
                {DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.emptyState}
              </div>
            )}

            {offerAssumptionsLoading && (
              <div style={{ marginTop: 14, padding: 20, textAlign: "center", color: customerRoute ? CX.muted : D.textSecondary, fontWeight: 600 }}>
                Annahmen werden erzeugt… (KI-Optimierung kann einige Sekunden dauern)
              </div>
            )}
          </SectionCard>
          </div>
          )}

          {/* Tab-Inhalt: Transparenz */}
          {resultTab === "transparenz" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: "#f0f4f8",
              border: "1px solid #e2e8f0",
              marginBottom: 4,
            }}
          >
            <p style={{ margin: 0, color: "#334155", fontSize: 14, lineHeight: 1.65 }}>
              <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.transparenz}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.transparenz}
            </p>
          </div>
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
            <div style={{ fontSize: 14, color: "#666", fontWeight: 900, marginBottom: 12 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.scoreErklaerung}</div>
            <p style={{ margin: 0, color: "#333", fontSize: 14, lineHeight: 1.6 }}>
              {DEFAULT_TEXTS_CONFIG.explanation.scoreCalculation}
            </p>
          </div>
          {/* Einklappbare Debug-Sektion: gefeuerte Findings + KI-Validierung (nur bei vorhandenen debug-Daten) */}
          {(result as any)?.debug?.firedFindings != null && Array.isArray((result as any).debug.firedFindings) && (
            <details style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", overflow: "hidden", color: "#000" }}>
              <summary style={{ padding: "12px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#000" }}>
                Score-Debug: {((result as any).debug.firedFindings as any[]).length} gefeuerte Findings
              </summary>
              <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", color: "#000" }}>
                {/* Validierungs-Zusammenfassung (nur wenn triggerValidation vorhanden) */}
                {(result as any)?.debug?.triggerValidation != null && (() => {
                  const tv = (result as any).debug.triggerValidation as { total?: number; validated?: number; confirm?: number; uncertain?: number; reject?: number };
                  return (
                    <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#e2e8f0", fontSize: 13, display: "flex", flexWrap: "wrap", gap: "12px 20px", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: "#334155" }}>KI-Validierung:</span>
                      <span>validierte Findings: <strong>{Number(tv.validated ?? tv.total ?? 0)}</strong></span>
                      <span>bestätigt: <strong style={{ color: "#0a7a2f" }}>{Number(tv.confirm ?? 0)}</strong></span>
                      <span>unsicher: <strong style={{ color: "#a36b00" }}>{Number(tv.uncertain ?? 0)}</strong></span>
                      <span>verworfen: <strong style={{ color: "#b00020" }}>{Number(tv.reject ?? 0)}</strong></span>
                    </div>
                  );
                })()}
                {((result as any)?.debug?.firedFindings != null && (result as any).debug.triggerValidation == null) && (
                  <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>Keine KI-Validierung aktiv (nur Trigger-Modus mit API-Key führt Validierung aus).</p>
                )}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 12, color: "#000" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#000" }}>Trigger-ID</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#000" }}>Kategorie</th>
                        <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700, color: "#000" }}>Penalty</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#000" }}>Titel</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#000" }}>Validierungsstatus</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#000" }}>Score-wirksam</th>
                        <th style={{ width: 44, padding: "8px 4px" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {((result as any).debug.firedFindings as any[]).map((row: any, i: number) => {
                        const statusLabel = row.validation_status === "confirm" ? "Bestätigt" : row.validation_status === "uncertain" ? "Unsicher" : row.validation_status === "reject" ? "Verworfen" : "—";
                        const statusColor = row.validation_status === "confirm" ? "#0a7a2f" : row.validation_status === "uncertain" ? "#a36b00" : row.validation_status === "reject" ? "#b00020" : "#64748b";
                        const scoreWirksam = row.score_excluded === true ? "Nein (aus Score entfernt)" : "Ja";
                        const isExpanded = transparenzExpandedIndex === i;
                        return (
                          <React.Fragment key={i}>
                            <tr style={{ borderBottom: "1px solid #e2e8f0", background: isExpanded ? "#f1f5f9" : undefined }}>
                              <td style={{ padding: "8px 10px", fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#000" }}>{row.triggerId ?? "—"}</td>
                              <td style={{ padding: "8px 10px", color: "#000" }}>{row.category ?? "—"}</td>
                              <td style={{ padding: "8px 10px", textAlign: "right", color: "#000" }}>{row.penalty ?? "—"}</td>
                              <td style={{ padding: "8px 10px", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#000" }} title={row.title}>{row.title ?? "—"}</td>
                              <td style={{ padding: "8px 10px" }}>
                                {row.validation_status != null ? (
                                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${statusColor}18`, color: statusColor }}>{statusLabel}</span>
                                ) : (
                                  <span style={{ color: "#94a3b8" }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                {row.score_excluded === true ? (
                                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#fef2f2", color: "#b00020" }}>nicht scorewirksam</span>
                                ) : row.validation_status != null ? (
                                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#f0fdf4", color: "#0a7a2f" }}>scorewirksam</span>
                                ) : (
                                  <span style={{ color: "#94a3b8" }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: "8px 4px" }}>
                                <button
                                  type="button"
                                  onClick={() => setTransparenzExpandedIndex(isExpanded ? null : i)}
                                  style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#475569" }}
                                >
                                  {isExpanded ? "Schließen" : "Details"}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                                <td colSpan={7} style={{ padding: "12px 14px", fontSize: 12, lineHeight: 1.55, color: "#334155", verticalAlign: "top" }}>
                                  <div style={{ display: "grid", gap: 10 }}>
                                    {row.validation_reason != null && (
                                      <div>
                                        <div style={{ fontWeight: 700, marginBottom: 4, color: "#475569" }}>Begründung (KI)</div>
                                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{row.validation_reason}</div>
                                      </div>
                                    )}
                                    {row.validation_confidence != null && (
                                      <div>
                                        <span style={{ fontWeight: 700, color: "#475569" }}>Confidence: </span>
                                        <span>{Number(row.validation_confidence).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    )}
                                    {row.validation_suggested_category != null && row.validation_suggested_category !== "" && (
                                      <div>
                                        <span style={{ fontWeight: 700, color: "#475569" }}>Vorgeschlagene Kategorie: </span>
                                        <span>{row.validation_suggested_category}</span>
                                      </div>
                                    )}
                                    {row.validation_penalty_assessment != null && (
                                      <div>
                                        <span style={{ fontWeight: 700, color: "#475569" }}>Penalty-Einschätzung: </span>
                                        <span>{row.validation_penalty_assessment === "lower" ? "Niedriger" : "Beibehalten"}</span>
                                      </div>
                                    )}
                                    {row.matched_keyword != null && row.matched_keyword !== "" && (
                                      <div>
                                        <span style={{ fontWeight: 700, color: "#475569" }}>Matched Keyword: </span>
                                        <span style={{ fontFamily: "ui-monospace, monospace" }}>{row.matched_keyword}</span>
                                      </div>
                                    )}
                                    {row.matched_context != null && row.matched_context !== "" && (
                                      <div>
                                        <span style={{ fontWeight: 700, color: "#475569" }}>Matched Context: </span>
                                        <span>{row.matched_context}</span>
                                      </div>
                                    )}
                                    {row.raw_excerpt != null && row.raw_excerpt !== "" && (
                                      <div>
                                        <div style={{ fontWeight: 700, marginBottom: 6, color: "#475569" }}>Raw-Excerpt (LV-Text um Treffer)</div>
                                        <pre style={{ margin: 0, padding: 12, background: "#e2e8f0", borderRadius: 8, fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "auto", maxHeight: 280, fontFamily: "ui-monospace, monospace", color: "#334155", border: "1px solid #cbd5e1" }}>
                                          {row.raw_excerpt}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Normalisierte GAEB-Preview: Gruppen, Hinweise, Positionen-Tabelle (nur aus normalisierter Struktur, kein Roh-XML). */
function GaebNormalizedPreview(props: {
  normalized: { groups: any[]; remarks: any[]; items: any[] };
  debug?: Record<string, any>;
  customerRoute: boolean;
  customerDesign?: CustomerSurfaceTokens;
}) {
  const { normalized, customerRoute, customerDesign } = props;
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const primary = customerDesign?.primary ?? "#111";
  const maxH = "320px";

  const dark = customerRoute && customerDesign;
  const border = dark ? (customerDesign!.cardBorder ?? CX.border) : "#eee";
  const bg = dark ? (customerDesign!.cardBg ?? CX.card) : "#fff";
  const labelColor = dark ? (customerDesign!.textSecondary ?? CX.muted) : "#666";
  const bodyColor = dark ? (customerDesign!.textPrimary ?? CX.text) : "#111";
  const groupRowBg = dark ? CX.filterBg : "#fafafa";
  const remarkBg = dark ? CX.inputBg : "#f8f9fa";
  const rowLine = dark ? CX.rowHairline : "#eee";
  const theadBorder = dark ? "rgba(255,255,255,0.14)" : "#ddd";
  const expandRowBg = dark ? CX.filterBg : "#f8f9fa";

  return (
    <div
      style={{
        maxHeight: maxH,
        overflow: "auto",
        border: `1px solid ${border}`,
        borderRadius: D.cardRadius,
        background: bg,
        color: bodyColor,
      }}
    >
      {/* Gruppen als Abschnitte */}
      {normalized.groups?.length > 0 && (
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${rowLine}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: labelColor, marginBottom: 8 }}>Gruppen</div>
          {normalized.groups.map((g: any, i: number) => (
            <div
              key={i}
              style={{
                marginBottom: 6,
                paddingLeft: (g.level ?? 0) * 12,
                borderLeft: `3px solid ${primary}`,
                padding: "6px 10px",
                background: groupRowBg,
                borderRadius: 6,
              }}
            >
              <span style={{ fontWeight: 800, color: primary }}>{g.posNr}</span>
              {g.posNr && " "}
              <span>{g.label || "(ohne Bezeichnung)"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hinweistexte separat */}
      {normalized.remarks?.length > 0 && (
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${rowLine}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: labelColor, marginBottom: 8 }}>Hinweise / Vorbemerkungen</div>
          {normalized.remarks.map((r: any, i: number) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                padding: 8,
                background: remarkBg,
                borderRadius: 8,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                color: bodyColor,
              }}
            >
              {r.kind && <strong>{r.kind}: </strong>}
              {r.text}
            </div>
          ))}
        </div>
      )}

      {/* Positionen tabellarisch: Pos, Kurztext, Menge, Einheit, Langtext per Accordion */}
      {normalized.items?.length > 0 && (
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: labelColor, marginBottom: 8 }}>Positionen</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: bodyColor }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${theadBorder}` }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 800, color: labelColor }}>Pos</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 800, color: labelColor }}>Kurztext</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 800, color: labelColor }}>Menge</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 800, color: labelColor }}>Einheit</th>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {normalized.items.map((it: any, idx: number) => (
                  <React.Fragment key={idx}>
                    <tr style={{ borderBottom: `1px solid ${rowLine}` }}>
                      <td style={{ padding: "6px", fontWeight: 700, verticalAlign: "top" }}>{it.posNr ?? "—"}</td>
                      <td style={{ padding: "6px", verticalAlign: "top" }}>{it.shortText ?? "—"}</td>
                      <td style={{ padding: "6px", textAlign: "right", verticalAlign: "top" }}>{it.quantity ?? "—"}</td>
                      <td style={{ padding: "6px", verticalAlign: "top" }}>{it.unit ?? "—"}</td>
                      <td style={{ padding: "6px", verticalAlign: "top" }}>
                        {(it.longText ?? "").trim() ? (
                          <button
                            type="button"
                            onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                            style={{
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              fontWeight: 800,
                              padding: 4,
                              color: dark ? CX.accent : undefined,
                            }}
                            aria-expanded={expandedRow === idx}
                          >
                            {expandedRow === idx ? "▼" : "▶"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {expandedRow === idx && (it.longText ?? "").trim() && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            padding: "8px 6px 12px",
                            background: expandRowBg,
                            whiteSpace: "pre-wrap",
                            fontSize: 12,
                            borderBottom: `1px solid ${rowLine}`,
                            color: bodyColor,
                          }}
                        >
                          {it.longText}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Admin-Route /admin/score: volle Analyse-UI inkl. Expertenmodus und Debug-Ansicht (customerRoute=false). */
export default function AdminScorePage() {
  return <ScorePage customerRoute={false} isAdminUser />;
}
