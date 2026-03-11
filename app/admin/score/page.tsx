// app/admin/score/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Lesansicht } from "@/components/Lesansicht";
import { PositionenNodeView } from "@/components/PositionenNodeView";
import { VorbemerkungenDocumentView } from "@/components/VorbemerkungenDocumentView";
import { NachtragspotenzialBlock } from "@/components/NachtragspotenzialBlock";
import { VortextDetailModal } from "@/components/VortextDetailModal";
import { AnalyseCockpitView } from "@/components/AnalyseCockpitView";
import { sanitizeForDisplay, stripTechnicalNoiseForDisplay } from "@/lib/displayText";
import { normalizeViewerPositionenText, normalizeViewerVorbemerkungenText } from "@/lib/gaebViewerNormalize";
import type { ChangeOrderResult } from "@/lib/changeOrderAnalysis";
import { AMPEL_THRESHOLDS } from "@/lib/scoringConfig";
import { DEFAULT_TEXTS_CONFIG } from "@/lib/textsConfig";
import { PAGE_DESIGN } from "@/lib/ui/pageDesign";
import { SectionCard, StatusBadge } from "@/components/ui";
import { colors as themeColors } from "@/lib/ui/theme";

/** Einheitliches Design für alle Tabs (Rückfragen, Risiken, Angebotsklarstellungen, Admin). */
const D = PAGE_DESIGN;

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

type ScoreResult = {
  total: number;
  level: "hochriskant" | "mittel" | "solide" | "sauber" | string;
  perCategory: Record<string, number>; // Keys
  findingsSorted: Finding[];
  debug?: DebugBlock;
  llmMode?: boolean;
  findingsBeforeLlm?: number;
  findingsAfterLlm?: number;
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

// ===== KEY FACT LABELS (optional nice names) =====
const KEYFACT_LABELS: Record<string, string> = {
  // Projekt & Beteiligte
  bauvorhaben: "Bauvorhaben / Objekt",
  ort: "Ort / Standort",
  gewerk: "Gewerk",
  bauherr_ag: "Bauherr / Auftraggeber",
  planer: "Planer / Architekt",

  // Termine/Fristen
  baubeginn: "Baubeginn",
  bauzeit: "Bauzeit / Dauer",
  fertigstellung: "Fertigstellung / Abnahme",
  ausfuehrungsfrist: "Ausführungsfrist / Terminplan",
  ausfuehrungszeit: "Ausführungszeit",
  fristAngebot: "Angebotsfrist",
  bindefrist: "Bindefrist",
  submission_einreichung: "Submission / Einreichung",

  // Vertrag
  vertragsgrundlagen: "Vertragsgrundlagen",
  vertragsstrafe: "Vertragsstrafe / Pönale",
  gewaerhleistung: "Gewährleistung / Mängelhaftung",
  wartung_instandhaltung: "Wartung / Instandhaltung",
  vob_bgb: "VOB/B / BGB",
  rangfolge: "Rangfolge Vertragsunterlagen",

  // Zahlung/Preis
  zahlungsbedingungen: "Zahlungsbedingungen",
  abschlagszahlung: "Abschlagszahlung",
  schlussrechnung: "Schlussrechnung / Zahlungsziel",
  preisgleitung: "Preisgleitklausel / Rohstoffpreise",
};

function prettyKey(k: string) {
  return (k ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

// ===== UI KeyFacts: Projektdaten vs. Vertragsrahmen =====
/** Nur diese Felder im oberen Block „Projektdaten aus dem Leistungsverzeichnis“ (Reihenfolge für Anzeige). */
const PROJEKTDATEN_KEYS_ORDER = [
  "bauherr_ag",
  "ort",
  "gewerk",
  "bindefrist",
  "submission_einreichung",
  "baubeginn",
  "fertigstellung",
  "bauzeit",
  "vob_bgb",
  "vertragsgrundlagen",
];
const PROJEKTDATEN_KEYS = new Set(PROJEKTDATEN_KEYS_ORDER);

/** Diese Felder im separaten Block „Vertrags- und Abrechnungsrahmen“ (Reihenfolge für Anzeige). */
const VERTRAGSRAHMEN_KEYS_ORDER = ["abschlagszahlung", "schlussrechnung", "gewaerhleistung", "vertragsstrafe"];
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

export function ScorePage(props: { customerRoute?: boolean } = {}) {
  const { customerRoute = false } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [gaebTab, setGaebTab] = useState<
    "structure" | "vortext" | "positions" | "raw" | "clean" | "llm_vortext" | "llm_positions"
  >("vortext");

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

  const resetVortext = () => {
    setVortextError(null);
    setRiskClauses([]);
    setKeyFacts({});
    setKeyFactConfidence({});
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
    setGaebTab("vortext");
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
    } catch (e: unknown) {
      console.error("Clarification questions:", e);
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
    } catch (e: unknown) {
      console.error("Change order analysis:", e);
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
    } catch (e: unknown) {
      console.error("Offer assumptions:", e);
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

  const analyzeVortextLLM = async (
    vortext: string,
    vortextSource?: VortextSource,
    options?: { normalized?: NormalizedPayload; formatDetected?: string }
  ) => {
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
      } else {
        const clauses = Array.isArray(vData?.riskClauses) ? vData.riskClauses : [];
        setRiskClauses(clauses);

        const facts = vData?.keyFacts && typeof vData.keyFacts === "object" ? vData.keyFacts : {};
        setKeyFacts(facts);

        const conf =
          vData?.keyFactConfidence && typeof vData.keyFactConfidence === "object" ? vData.keyFactConfidence : {};
        setKeyFactConfidence(conf);

        setKeyFactsDebug(
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
            : null
        );
      }
    } catch (e: any) {
      setVortextError(e?.message || "Vortext Analyse fehlgeschlagen");
      setRiskClauses([]);
      setKeyFacts({});
      setKeyFactConfidence({});
      setKeyFactsDebug(null);
    } finally {
      setVortextLoading(false);
    }
  };

  const analyze = async (
    textOverride?: string,
    options?: { gaebPreviewData?: any; splitData?: SplitResult | null }
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
    resetVortext();

    try {
      const debug =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
      const apiUrl = debug ? "/api/score?debug=1" : "/api/score";

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

      if (vortextForRisk.trim().length > 0 || normalizedPayload) {
        await analyzeVortextLLM(vortextForRisk, vortextSource, isGaebXml && normalizedPayload ? { normalized: normalizedPayload, formatDetected: "gaeb-xml" } : undefined);
      } else {
        setVortextError("Vortext ist leer (Split/Extraktion hat nichts geliefert).");
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
        await analyze(text, { gaebPreviewData: previewData ?? undefined, splitData: splitData ?? undefined });
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

  // Projektdaten: nur belastbare Stammdaten (Bauherr, Ort, Gewerk, Fristen, VOB/BGB etc.)
  const keyFactsProjektdaten = useMemo(() => {
    const conf = keyFactConfidence ?? {};
    const entries = Object.entries(keyFacts ?? {})
      .filter(([k]) => PROJEKTDATEN_KEYS.has(k))
      .map(([k, v]) => [k, normKeyFactValue(v)] as const)
      .filter(([k, v]) => {
        if (!v) return false;
        if (isGarbageKeyFactValue(v)) return false;
        if (isWeakKeyFactValueForDisplay(v, k)) return false;
        const c = Number(conf[k]);
        if (Number.isFinite(c) && c > 0 && c < 0.55) return false;
        return true;
      });
    entries.sort(([a], [b]) => PROJEKTDATEN_KEYS_ORDER.indexOf(a) - PROJEKTDATEN_KEYS_ORDER.indexOf(b));
    return entries;
  }, [keyFacts, keyFactConfidence]);

  // Vertrags- und Abrechnungsrahmen: Abschlagszahlung, Schlussrechnung, Gewährleistung, Vertragsstrafe
  const keyFactsVertragsrahmen = useMemo(() => {
    const conf = keyFactConfidence ?? {};
    const entries = Object.entries(keyFacts ?? {})
      .filter(([k]) => VERTRAGSRAHMEN_KEYS.has(k))
      .map(([k, v]) => [k, normKeyFactValue(v)] as const)
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

  /** Alle KeyFacts (Projektdaten + Vertragsrahmen) für Stellen, die noch die Gesamtanzahl brauchen. */
  const keyFactsEntries = useMemo(
    () => [...keyFactsProjektdaten, ...keyFactsVertragsrahmen],
    [keyFactsProjektdaten, keyFactsVertragsrahmen]
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

  const gaebTextForTab = useMemo(() => {
    if (gaebTab === "llm_vortext") return (split?.vortext ?? "").toString();
    if (gaebTab === "llm_positions") return (split?.positions ?? "").toString();

    if (!gaebPreview) return "";
    if (gaebTab === "structure") return gaebPreview.vortextGuessClean ?? "";
    if (gaebTab === "vortext") return gaebPreview.vortextGuessClean ?? "";
    if (gaebTab === "positions") return gaebPreview.positionsGuessClean ?? "";
    if (gaebTab === "raw") return gaebPreview.rawPreview ?? "";
    return gaebPreview.cleanPreview ?? "";
  }, [gaebPreview, gaebTab, split]);

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

  /** Bereinigt und ohne technische Metadaten – nur für Anzeige im Vorbemerkungen-Tab. */
  const vortextForDocumentViewDisplay = useMemo(
    () => stripTechnicalNoiseForDisplay(sanitizeForDisplay(vortextForDocumentView)),
    [vortextForDocumentView]
  );

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

  return (
    <div
      style={{
        padding: customerRoute ? (hasResult ? 16 : 32) : (hasResult ? 12 : 28),
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        ...(customerRoute ? { background: D.pageBg, minHeight: "100vh" } : {}),
      }}
    >
      {/* Micro-Animations nur für Kundenroute (keine neuen Abhängigkeiten) */}
      {customerRoute && (
        <style dangerouslySetInnerHTML={{ __html: `
          .tga-btn-primary { transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease; }
          .tga-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(30,95,116,0.25); }
          .tga-btn-primary:active:not(:disabled) { transform: translateY(0); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
          .tga-btn-primary:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
          .tga-btn-secondary { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease; }
          .tga-btn-secondary:hover { border-color: #cbd5e1 !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .tga-btn-secondary:active { transform: translateY(0); }
          .tga-btn-secondary:focus-visible { outline: 2px solid #1e5f74; outline-offset: 2px; }
          .tga-toggle-option { transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
          .tga-toggle-option:hover { background-color: #f1f5f9 !important; }
          .tga-toggle-option:not([data-active]):hover { color: #0f172a !important; }
          .tga-toggle-option[data-active] { box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
          .tga-toggle-option:active { transform: scale(0.98); }
          .tga-toggle-option:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
          .tga-tab { transition: color 0.2s ease, border-color 0.2s ease; }
          .tga-tab:hover { color: #0f172a !important; }
          .tga-tab:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
          .tga-benefit-card { transition: box-shadow 0.2s ease; }
          .tga-benefit-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
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
              background: "#fff",
              borderRadius: 16,
              padding: "28px 32px",
              maxWidth: 420,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 20 }}>
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
                    color: i < effectiveStep ? (customerRoute ? D.primary : "#0a7a2f") : i === effectiveStep ? "#111" : "#999",
                    fontWeight: i === effectiveStep ? 700 : 500,
                    ...(i === effectiveStep && customerRoute ? { paddingLeft: 4, borderLeft: `3px solid ${D.primary}`, marginLeft: -4 } : {}),
                  }}
                >
                  <span style={{ width: 20, textAlign: "center", flexShrink: 0 }}>
                    {i < effectiveStep ? "✓" : i === effectiveStep ? "→" : "•"}
                  </span>
                  <span>{stepLabel}</span>
                </div>
              ); })}
              {loadingPhase === "analyze" && analysisStep === 5 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0", fontSize: 13, color: "#64748b", fontWeight: 500 }}>
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
              background: "#fff",
              borderRadius: 16,
              padding: "28px 32px",
              maxWidth: 380,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 12 }}>
              {changeOrderLoading && "Nachtragspotenziale werden ermittelt…"}
              {!changeOrderLoading && clarificationQuestionsLoading && "Rückfragen werden generiert…"}
              {!changeOrderLoading && !clarificationQuestionsLoading && offerAssumptionsLoading && "Annahmen werden generiert…"}
            </div>
            <div style={{ color: "#666", fontSize: 14 }}>
              Bitte einen Moment warten.
            </div>
          </div>
        </div>
      )}

      {/* Header: kompakt nach Analyse (Toolbar), sonst etwas mehr Raum */}
      <header
        style={{
          marginBottom: 0,
          padding: hasResult ? (customerRoute ? "10px 20px" : "8px 16px") : (customerRoute ? `${D.headerPaddingV}px ${D.headerPaddingH}px` : "0 28px"),
          minHeight: hasResult ? (customerRoute ? 48 : 44) : (customerRoute ? 72 : 64),
          height: hasResult ? "auto" : (customerRoute ? "auto" : 64),
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: hasResult ? 16 : 28,
          background: customerRoute ? D.cardBg : "#fff",
          borderBottom: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e5e7eb",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: hasResult ? 12 : (customerRoute ? 8 : 2), minWidth: 0, flex: "1 1 280px" }}>
          {customerRoute ? (
            <>
              <h1 style={{ margin: 0, fontSize: hasResult ? 18 : 26, fontWeight: hasResult ? 700 : 800, color: D.textPrimary, letterSpacing: "-0.025em", lineHeight: 1.2 }}>
                Leistungsverzeichnis analysieren
              </h1>
              {!hasResult && (
                <p style={{ margin: 0, fontSize: 13, color: D.textSecondary, fontWeight: 400, maxWidth: 480, lineHeight: 1.5 }}>
                  Erkennen Sie Risiken, Unklarheiten und mögliche Nachtragspotenziale vor der Angebotsabgabe.
                </p>
              )}
              {fileMeta?.name && (
                <span style={{ fontSize: 12, color: D.textMuted, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(hasResult ? { marginLeft: 8, paddingLeft: 12, borderLeft: `1px solid ${D.cardBorder}` } : { marginTop: 4 }) }}>
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
          {analysisStatus && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: loading ? "#b45309" : result ? (customerRoute ? D.primary : "#047857") : (customerRoute ? D.textSecondary : "#9ca3af"),
                padding: hasResult ? "4px 10px" : (customerRoute ? "6px 12px" : "4px 10px"),
                borderRadius: customerRoute ? D.badgeRadius : 6,
                background: loading ? "#fffbeb" : result ? (customerRoute ? "#e8f4f8" : "#ecfdf5") : (customerRoute ? "#f8fafc" : "#f9fafb"),
                border: customerRoute ? `1px solid ${loading ? "#fde68a" : result ? "#b8dce6" : D.cardBorder}` : "none",
              }}
            >
              {loading ? "Analyse läuft…" : result ? "Abgeschlossen" : "Bereit"}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!hasResult && customerRoute && (
              <span style={{ fontSize: 11, color: D.textMuted, fontWeight: 500 }}>{customerRoute ? "Ansicht" : "Modus"}</span>
            )}
            <div style={{ display: "flex", background: customerRoute ? D.cardBorder : "#f3f4f6", borderRadius: customerRoute ? D.radiusToggle : 8, padding: 3 }}>
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
                  background: analysisMode === "standard" ? (customerRoute ? D.cardBg : "#fff") : "transparent",
                  color: analysisMode === "standard" ? (customerRoute ? D.textPrimary : "#111") : (customerRoute ? D.textSecondary : "#6b7280"),
                  fontWeight: 600,
                  fontSize: hasResult ? 12 : 13,
                  cursor: "pointer",
                  boxShadow: analysisMode === "standard" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
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
                  background: analysisMode === "expert" ? (customerRoute ? D.cardBg : "#fff") : "transparent",
                  color: analysisMode === "expert" ? (customerRoute ? D.textPrimary : "#111") : (customerRoute ? D.textSecondary : "#6b7280"),
                  fontWeight: 600,
                  fontSize: hasResult ? 12 : 13,
                  cursor: "pointer",
                  boxShadow: analysisMode === "expert" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
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
          marginTop: hasResult ? (customerRoute ? 12 : 10) : (customerRoute ? D.spacingSection : 24),
          padding: hasResult ? (customerRoute ? "10px 16px" : "8px 12px") : (customerRoute ? 28 : 16),
          border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e5e7eb",
          borderRadius: customerRoute ? D.cardRadiusLg : 16,
          background: customerRoute ? D.cardBg : "#fafafa",
          boxShadow: customerRoute ? D.cardShadow : "none",
        }}
      >
        {hasResult ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: customerRoute ? D.textSecondary : "#6b7280", fontWeight: 500 }}>
              {fileMeta?.name ? (<>Aktuelle Datei: <strong style={{ color: customerRoute ? D.textPrimary : "#111" }}>{fileMeta.name}</strong>{fileMeta.size ? ` · ${fmtKB(fileMeta.size)}` : ""}</>) : "Analyse abgeschlossen"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input ref={fileInputRef} type="file" accept=".txt,.xml,.gaeb,.x83,.x84,.x86,.json" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: "6px 12px", borderRadius: D.radiusButton, border: `1px solid ${D.cardBorder}`, background: D.cardBg, color: D.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Andere Datei</button>
              <button type="button" onClick={() => { setLvText(""); setResult(null); setError(null); setFileMeta(null); setLastFile(null); resetVortext(); resetGaebPreview(); resetSplit(); }} style={{ padding: "6px 12px", borderRadius: D.radiusButton, border: `1px solid ${D.cardBorder}`, background: "transparent", color: D.textSecondary, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Neue Analyse starten</button>
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
            border: `2px dashed ${dragOver ? (customerRoute ? D.primary : "#0a7a2f") : (customerRoute ? D.cardBorder : "#d1d5db")}`,
            borderRadius: customerRoute ? D.cardRadius : 14,
            padding: customerRoute ? 32 : 14,
            background: dragOver ? (customerRoute ? "#e8f4f8" : "#f0fdf4") : customerRoute ? "#f8fafc" : "#fff",
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
                <div style={{ fontSize: 20, fontWeight: 700, color: D.textPrimary, marginBottom: 8, letterSpacing: "-0.01em" }}>
                  Leistungsverzeichnis hochladen
                </div>
                <p style={{ margin: 0, fontSize: 14, color: D.textSecondary, lineHeight: 1.55 }}>
                  Datei hierher ziehen oder über den Button auswählen. Anschließend Analyse starten.
                </p>
                {!fileMeta && (
                  <ul style={{ margin: "16px 0 0", paddingLeft: 20, fontSize: 13, color: D.textSecondary, lineHeight: 1.65 }}>
                    <li>Erkennt Risiken im Leistungsverzeichnis</li>
                    <li>Zeigt mögliche Nachtragspotenziale</li>
                    <li>Formuliert Rückfragen und Angebotsklarstellungen</li>
                  </ul>
                )}
                {fileMeta && (
                  <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: D.radiusButton, background: "#e8f4f8", border: `1px solid ${D.cardBorder}`, color: D.primary, fontWeight: 600, fontSize: 13 }}>
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
                padding: customerRoute ? "12px 20px" : "10px 14px",
                borderRadius: customerRoute ? D.radiusButton : 12,
                border: "none",
                background: customerRoute ? D.primary : "#111",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: customerRoute ? 14 : 13,
                boxShadow: customerRoute ? D.cardShadow : "none",
              }}
            >
              {customerRoute ? "Datei auswählen" : "Datei wählen"}
            </button>
            {customerRoute && (
              <span style={{ fontSize: 11, color: D.textMuted }}>Max. 10 MB · TXT, XML, GAEB</span>
            )}
            {isExpertMode && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={autoAnalyze} onChange={(e) => setAutoAnalyze(e.target.checked)} />
                <span style={{ fontWeight: 700, color: "#111" }}>{customerRoute ? "Analyse nach Upload" : "Auto-Analyse"}</span>
              </label>
            )}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          rows={10}
          style={{
            width: "100%",
            marginTop: customerRoute ? 16 : 12,
            borderRadius: customerRoute ? D.cardRadius : 12,
            border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #ddd",
            padding: customerRoute ? 14 : 12,
            resize: "vertical",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
          }}
          placeholder={customerRoute ? "Optional: Text hier einfügen oder nur Datei nutzen …" : "LV Text hier einfügen..."}
          value={lvText}
          onChange={(e) => setLvText(e.target.value)}
        />

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
              padding: customerRoute ? "12px 20px" : "10px 14px",
              borderRadius: customerRoute ? D.radiusButton : 12,
              border: "none",
              background: loading ? "#d1d5db" : customerRoute ? D.primary : "#111",
              color: loading ? "#6b7280" : "#fff",
              cursor: loading ? "default" : "pointer",
              fontWeight: 700,
              fontSize: customerRoute ? 14 : 13,
              boxShadow: customerRoute && !loading ? D.cardShadow : "none",
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
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: splitLoading || !lastFile ? "default" : "pointer",
                fontWeight: 700,
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
              resetVortext();
              resetGaebPreview();
              resetSplit();
            }}
            style={{
              padding: "10px 14px",
              borderRadius: customerRoute ? D.radiusButton : 12,
              border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #d1d5db",
              background: customerRoute ? D.cardBg : "#fff",
              color: customerRoute ? D.textSecondary : "#6b7280",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 13,
            }}
          >
            {customerRoute ? "Eingabe zurücksetzen" : "Zurücksetzen"}
          </button>

          {isExpertMode && (
            <label
              title={customerRoute ? "Bei Aktivierung werden bei der Analyse zusätzliche Risiken per KI ermittelt." : "Bei Aktivierung werden bei der Analyse zusätzliche Risiken per KI ermittelt (Relevanzfilter)."}
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                color: "#6b7280", fontWeight: 500, fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={useLlmRelevance}
                onChange={(e) => setUseLlmRelevance(e.target.checked)}
              />
              {customerRoute ? "Erweiterte Filter (KI-Risiken)" : "Relevanzfilter (KI)"}
            </label>
          )}
          <span style={{ fontSize: 12, color: customerRoute ? D.textMuted : "#9ca3af" }}>Max. 10 MB</span>
        </div>

        {error && <div style={{ marginTop: 12, color: "#b00020", fontWeight: 800 }}>{error}</div>}
        </>
        )}
      </div>

      {/* Value-Preview: Was Sie nach der Analyse erhalten (nur Kundenroute, Startzustand) */}
      {customerRoute && !result && !loading && (
        <div style={{ marginTop: D.spacingSection }}>
          <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800, color: D.textPrimary, letterSpacing: "-0.02em" }}>Nach der Analyse erhalten Sie</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: D.spacingCard }}>
            <div className="tga-benefit-card" style={{ padding: D.spacingCard, minHeight: 120, borderRadius: D.cardRadius, border: `1px solid ${D.cardBorder}`, background: D.cardBg, boxShadow: D.cardShadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, marginBottom: 8 }}>Risikoübersicht</div>
              <p style={{ margin: 0, fontSize: 13, color: D.textSecondary, lineHeight: 1.55 }}>Erkennen Sie kritische Punkte in Vorbemerkungen, Mengen und Leistungsgrenzen.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: D.spacingCard, minHeight: 120, borderRadius: D.cardRadius, border: `1px solid ${D.cardBorder}`, background: D.cardBg, boxShadow: D.cardShadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, marginBottom: 8 }}>Nachtragspotenzial</div>
              <p style={{ margin: 0, fontSize: 13, color: D.textSecondary, lineHeight: 1.55 }}>Identifizieren Sie mögliche Ursachen für spätere Mehrkosten.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: D.spacingCard, minHeight: 120, borderRadius: D.cardRadius, border: `1px solid ${D.cardBorder}`, background: D.cardBg, boxShadow: D.cardShadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, marginBottom: 8 }}>Rückfragen</div>
              <p style={{ margin: 0, fontSize: 13, color: D.textSecondary, lineHeight: 1.55 }}>Erhalten Sie konkrete Fragen zur Klärung vor Angebotsabgabe.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: D.spacingCard, minHeight: 120, borderRadius: D.cardRadius, border: `1px solid ${D.cardBorder}`, background: D.cardBg, boxShadow: D.cardShadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, marginBottom: 8 }}>Angebotsklarstellungen</div>
              <p style={{ margin: 0, fontSize: 13, color: D.textSecondary, lineHeight: 1.55 }}>Nutzen Sie Formulierungsvorschläge für Ihr Angebot.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: D.spacingCard, minHeight: 120, borderRadius: D.cardRadius, border: `1px solid ${D.cardBorder}`, background: D.cardBg, boxShadow: D.cardShadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, marginBottom: 8 }}>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.vorbemerkungen}</div>
              <p style={{ margin: 0, fontSize: 13, color: D.textSecondary, lineHeight: 1.55 }}>Lesbare Darstellung der Vorbemerkungen aus Ihrem LV inkl. Suche und Volltextansicht.</p>
            </div>
            <div className="tga-benefit-card" style={{ padding: D.spacingCard, minHeight: 120, borderRadius: D.cardRadius, border: `1px solid ${D.cardBorder}`, background: D.cardBg, boxShadow: D.cardShadow }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: D.textPrimary, marginBottom: 8 }}>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.positionen}</div>
              <p style={{ margin: 0, fontSize: 13, color: D.textSecondary, lineHeight: 1.55 }}>Übersicht der Positionsinhalte des Leistungsverzeichnisses mit Suchfunktion.</p>
            </div>
          </div>
        </div>
      )}

      {/* Dateistruktur / Struktur LV (nur in erweiterter Ansicht) */}
      {isExpertMode && (
      <div style={{ marginTop: 14, border: "1px solid #e5e5e5", borderRadius: 14, padding: 16, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>{customerRoute ? "Dateistruktur" : "Struktur des Leistungsverzeichnisses"}</div>
          <div style={{ color: "#666", fontWeight: 700 }}>
            {gaebPreviewLoading ? "Lade…" : gaebPreview ? `${gaebPreview.filename} (${fmtKB(gaebPreview.size)})` : "—"}
          </div>
        </div>

        {(gaebPreviewError || splitError) && (
          <div style={{ marginTop: 10, color: "#b00020", fontWeight: 800 }}>
            {gaebPreviewError ? `Struktur: ${gaebPreviewError}` : ""}
            {gaebPreviewError && splitError ? " • " : ""}
            {splitError ? `Textanalyse: ${splitError}` : ""}
          </div>
        )}

        {!gaebPreviewLoading && (gaebPreview || split) && (
          <>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ...(gaebPreview?.normalized ? (["structure"] as const) : []),
                ...(customerRoute
                  ? (["llm_vortext", "llm_positions", "vortext", "positions", "clean", "raw"] as const)
                  : (["llm_vortext", "llm_positions", "vortext", "positions", "raw", "clean"] as const)),
              ].map((t) => (
                <button
                  key={t}
                  onClick={() => setGaebTab(t)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: gaebTab === t ? (customerRoute ? D.primary : "#111") : "#fff",
                    color: gaebTab === t ? "#fff" : "#111",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  {t === "structure"
                    ? "Struktur"
                    : t === "llm_vortext"
                      ? "Einleitung (KI)"
                      : t === "llm_positions"
                        ? "Positionen (KI)"
                        : t === "vortext"
                          ? "Einleitung"
                          : t === "positions"
                            ? "Positionen"
                            : t === "raw"
                              ? customerRoute
                                ? "Rohdaten (technisch)"
                                : "Rohdaten"
                              : "Bereinigt"}
                </button>
              ))}

              <button
                onClick={() => setLvText(gaebTextForTab || "")}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                In Textfeld übernehmen
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              {gaebTab === "structure" && gaebPreview?.normalized ? (
                <GaebNormalizedPreview
                  normalized={gaebPreview.normalized}
                  debug={gaebPreview.debug}
                  customerRoute={!!customerRoute}
                  customerDesign={customerRoute ? D : undefined}
                />
              ) : gaebTab === "raw" ? (
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #eee",
                    background: "#fafafa",
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
                <Lesansicht
                  content={gaebTextForTab ?? ""}
                  maxHeight="320px"
                  styles={
                    customerRoute
                      ? {
                          textPrimary: D.textPrimary,
                          textSecondary: D.textSecondary,
                        }
                      : undefined
                  }
                />
              )}
            </div>

            <div style={{ marginTop: 8, color: "#666", fontSize: 12, fontWeight: 700 }}>
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
          {/* Tab-Leiste */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 10,
              padding: "4px 0",
              borderBottom: customerRoute ? `2px solid ${D.cardBorder}` : "2px solid #e5e5e5",
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
                  borderBottom: resultTab === id ? `2px solid ${customerRoute ? D.primary : "#111"}` : "2px solid transparent",
                  marginBottom: -8,
                  background: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  color: resultTab === id ? (customerRoute ? D.textPrimary : "#111") : (customerRoute ? D.textSecondary : "#666"),
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
              projectName={(keyFacts as Record<string, string> | undefined)?.objektbezeichnung ?? (keyFacts as Record<string, string> | undefined)?.projektbezeichnung}
              fileName={fileMeta?.name}
              fileSize={fileMeta?.size ?? undefined}
              result={result}
              changeOrderAnalysis={changeOrderAnalysis ?? undefined}
              clarificationQuestions={clarificationQuestions ?? undefined}
              offerAssumptions={offerAssumptions ?? undefined}
              keyFactsProjektdaten={keyFactsProjektdaten}
              keyFactLabels={KEYFACT_LABELS}
              sanitize={sanitizeForDisplay}
              onTabChange={setResultTab}
            />
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: customerRoute ? D.spacingCard : 12, maxHeight: "calc(100vh - 220px)", minHeight: 0 }}>
            {/* Zeile 1: KPI-Karten Komplexität | Gesamt-Risiko | Claim-Potenzial */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: customerRoute ? 12 : 10 }}>
              <div style={{ background: customerRoute ? D.cardBg : "#fff", border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? "14px 16px" : "12px 14px", boxShadow: customerRoute ? D.cardShadow : undefined }}>
                <div style={{ fontSize: 11, color: customerRoute ? D.textMuted : "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.complexity}</div>
                <div style={{ marginTop: 4, fontSize: 28, fontWeight: 700, color: customerRoute ? D.textPrimary : "#111" }}>
                  {clamp0_100(result.total)}
                  <span style={{ fontSize: 14, color: customerRoute ? D.textMuted : "#9ca3af", fontWeight: 500 }}> / 100</span>
                </div>
              </div>
              <div style={{ background: customerRoute ? D.cardBg : "#fff", border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? "14px 16px" : "12px 14px", boxShadow: customerRoute ? D.cardShadow : undefined }}>
                <div style={{ fontSize: 11, color: customerRoute ? D.textMuted : "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.totalRisk}</div>
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{totalAmp.dot}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: totalAmp.tone }}>{totalAmp.text}</span>
                </div>
              </div>
              {/* Claim-Potenzial: nur aus Nachtragsanalyse (Strang B), nicht aus Gesamt-Score – sonst "Nicht ermittelt" */}
              <div style={{ background: customerRoute ? D.cardBg : "#fff", border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? "14px 16px" : "12px 14px", boxShadow: customerRoute ? D.cardShadow : undefined }}>
                <div style={{ fontSize: 11, color: customerRoute ? D.textMuted : "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.claimPotential}</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: customerRoute ? D.textPrimary : "#111" }}>
                  {(() => {
                    if (!changeOrderAnalysis) {
                      return <span style={{ color: customerRoute ? D.textMuted : "#9ca3af", fontWeight: 600 }}>Nicht ermittelt</span>;
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
              <div style={{ background: customerRoute ? D.cardBg : "#fff", border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? D.spacingCard : 12, overflow: "auto", boxShadow: customerRoute ? D.cardShadow : undefined }}>
                <div style={{ fontSize: 12, color: customerRoute ? D.textSecondary : "#6b7280", fontWeight: 700, marginBottom: 10 }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.riskAmpelCategories}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {CATEGORY_ORDER.map((k) => {
                    const v = clamp0_100(result.perCategory?.[k] ?? 0);
                    const amp = traffic(v);
                    return (
                      <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 1fr 28px", gap: 8, alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: customerRoute ? D.textPrimary : "#374151", fontWeight: 500 }}>{catLabel(k)}</span>
                        <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${v}%`, height: "100%", background: amp.tone, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: amp.tone }}>{amp.dot}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ background: customerRoute ? D.cardBg : "#fff", border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e5e7eb", borderRadius: customerRoute ? D.cardRadius : 12, padding: customerRoute ? D.spacingCard : 12, overflow: "auto", boxShadow: customerRoute ? D.cardShadow : undefined }}>
                <div style={{ fontSize: 12, color: customerRoute ? D.textSecondary : "#6b7280", fontWeight: 700, marginBottom: 10 }}>{DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.topFindings}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(filteredFindings.slice(0, 8)).length === 0 ? (
                    <div style={{ color: customerRoute ? D.textMuted : "#9ca3af", fontSize: 13 }}>{DEFAULT_TEXTS_CONFIG.customerUI.emptyStates.noTreffer}</div>
                  ) : (
                    filteredFindings.slice(0, 8).map((f) => (
                      <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ flexShrink: 0 }}>{severityDot(f.severity)}</span>
                        <span style={{ fontSize: 13, color: customerRoute ? D.textPrimary : "#111", fontWeight: 500, lineHeight: 1.35 }}>{sanitizeForDisplay(f.title ?? "")}</span>
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
          <SectionCard accent="accent" style={{ marginBottom: 4, background: D.cardBg, borderColor: D.cardBorder }}>
            <p style={{ margin: 0, color: D.textPrimary, fontSize: 14, lineHeight: 1.65 }}>
              <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.risiken}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.risiken}
            </p>
          </SectionCard>
          {/* ===== Projektdaten aus dem Leistungsverzeichnis (KeyFacts) ===== */}
          <SectionCard accent="primary" style={{ background: D.cardBg, borderColor: D.cardBorder }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div>
                <div style={{ fontSize: D.fontSizeSectionTitle, color: D.textSecondary, fontWeight: D.fontWeightSection }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.projektdaten}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: D.textMuted, fontWeight: 600 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.projektdatenSub}</div>
              </div>
              <div style={{ color: D.textSecondary, fontWeight: 600 }}>
                {vortextLoading ? "Extrahiere…" : `${keyFactsProjektdaten.length} Felder`}
              </div>
            </div>

            {vortextError && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: themeColors.dangerMuted, border: `1px solid ${D.danger}`, color: D.danger, fontWeight: 600 }}>
                Projektdaten nicht verfügbar (Analyse des Einleitungstextes fehlgeschlagen).
              </div>
            )}

            {!vortextLoading && !vortextError && keyFactsProjektdaten.length === 0 && (
              <div style={{ marginTop: 10, color: D.textSecondary, fontWeight: 600 }}>{DEFAULT_TEXTS_CONFIG.customerUI.emptyStates.noProjektdaten}</div>
            )}

            {!vortextError && keyFactsProjektdaten.length > 0 && (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {keyFactsProjektdaten.map(([k, v]) => {
                  const c = Number(keyFactConfidence?.[k]);
                  const hasC = Number.isFinite(c) && c > 0;
                  return (
                    <div key={k} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: D.cardBg }}>
                      <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}>
                        {KEYFACT_LABELS[k] ?? prettyKey(k)}
                      </div>
                      {hasC && (
                        <div style={{ marginTop: 4, fontSize: 11, color: D.textMuted, fontWeight: 500 }}>
                          Sicherheit: {Math.round(c * 100)}%
                        </div>
                      )}
                      <div style={{ marginTop: 6, fontWeight: 600, color: D.textPrimary, fontSize: 13, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(v)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 10, color: D.textMuted, fontSize: 12, fontWeight: 500 }}>
              Der Einleitungstext wird automatisch aus der Datei ermittelt. Ist er leer, prüfen Sie die hochgeladene Datei bzw. den GAEB-Import.
            </div>
          </SectionCard>

          {/* ===== Vertrags- und Abrechnungsrahmen ===== */}
          {keyFactsVertragsrahmen.length > 0 && (
            <SectionCard accent="secondary" style={{ marginTop: D.spacingCard, background: D.cardBg, borderColor: D.cardBorder }}>
              <div style={{ fontSize: 14, color: D.textSecondary, fontWeight: 700 }}>Vertrags- und Abrechnungsrahmen</div>
              <div style={{ marginTop: 4, fontSize: 12, color: D.textMuted, fontWeight: 500 }}>Zahlungsbedingungen, Gewährleistung, Vertragsstrafe</div>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {keyFactsVertragsrahmen.map(([k, v]) => {
                  const c = Number(keyFactConfidence?.[k]);
                  const hasC = Number.isFinite(c) && c > 0;
                  return (
                    <div key={k} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: D.cardBg }}>
                      <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 600 }}>{KEYFACT_LABELS[k] ?? prettyKey(k)}</div>
                      {hasC && (
                        <div style={{ marginTop: 4, fontSize: 11, color: D.textMuted, fontWeight: 500 }}>Sicherheit: {Math.round(c * 100)}%</div>
                      )}
                      <div style={{ marginTop: 6, fontWeight: 600, color: D.textPrimary, fontSize: 13, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(v)}</div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* ===== Risiken im Einleitungstext ===== */}
          <SectionCard accent="warning" style={{ background: D.cardBg, borderColor: D.cardBorder }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, color: D.textSecondary, fontWeight: 700 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.risikenVortext}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: D.textMuted, fontWeight: 500 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.risikenVortextSub}</div>
              </div>
              <div style={{ color: D.textSecondary, fontWeight: 600 }}>
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
              <div style={{ marginTop: 10, color: D.textSecondary, fontWeight: D.fontWeightSection }}>{DEFAULT_TEXTS_CONFIG.customerUI.emptyStates.noRisikoformulierungen}</div>
            )}

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {riskClauses.map((r, idx) => {
                const teaserLen = 120;
                const cleaned = sanitizeForDisplay(r.text);
                const teaser = cleaned.length <= teaserLen ? cleaned : `${cleaned.slice(0, teaserLen)}…`;
                const title = `${r.type || "Risiko"} · ${String(r.riskLevel).toUpperCase()}`;
                return (
                  <div key={idx} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: D.cardBg }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ fontWeight: D.fontWeightSection, color: D.textPrimary, fontSize: D.fontSizeCardTitle }}>
                        {riskIcon(r.riskLevel)} {r.type || "Risiko"}
                      </div>
                      <StatusBadge variant={r.riskLevel === "high" || r.riskLevel === "sehr_hoch" ? "danger" : r.riskLevel === "medium" || r.riskLevel === "mittel" ? "warning" : "success"} small>
                        {String(r.riskLevel).toUpperCase()}
                      </StatusBadge>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: D.textPrimary,
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
                        border: `1px solid ${D.cardBorder}`,
                        background: "transparent",
                        color: D.primary,
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
                theme={{ textPrimary: D.textPrimary, textSecondary: D.textSecondary, cardBg: D.cardBg, cardBorder: D.cardBorder }}
              />
            )}

            <div style={{ marginTop: 10, color: D.textMuted, fontSize: 12, fontWeight: 500 }}>
              Einleitungstext aus automatischer Textanalyse.
            </div>
          </SectionCard>

          {/* Nachtragspotenzial (Strang B): Hinweis → Tab „Nachtragspotenzial“ */}
          <SectionCard accent="secondary" style={{ marginTop: D.spacingCard, background: D.cardBg, borderColor: D.cardBorder }}>
            <div style={{ fontSize: 14, color: D.textSecondary, fontWeight: 700, marginBottom: 8 }}>Nachtragspotenzial (Claim-Potenzial)</div>
            <p style={{ margin: 0, fontSize: 13, color: D.textPrimary, lineHeight: 1.5 }}>
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
                background: customerRoute ? "#e8f4f8" : "#f0f4f8",
                border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e2e8f0",
                marginBottom: 4,
              }}
            >
              <p style={{ margin: 0, color: customerRoute ? D.textPrimary : "#334155", fontSize: 14, lineHeight: 1.65 }}>
                <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.vorbemerkungen}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.vorbemerkungen}
              </p>
            </div>
            <div style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadiusLg, padding: D.spacingCard, background: D.cardBg, boxShadow: D.cardShadow }}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="vorbemerkungen-suche" style={{ display: "block", fontSize: 13, fontWeight: 600, color: customerRoute ? D.textSecondary : "#475569", marginBottom: 6 }}>
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
                    border: `1px solid ${customerRoute ? D.cardBorder : "#e2e8f0"}`,
                    background: "#fff",
                    fontSize: 14,
                    color: customerRoute ? D.textPrimary : "#0f172a",
                  }}
                />
              </div>
              {vorbemerkungenSearchQuery.trim() && (
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {vorbemerkungenMatchCount === 0 ? (
                    <span style={{ fontSize: 13, color: customerRoute ? D.textMuted : "#94a3b8" }}>
                      Keine Treffer für &quot;{vorbemerkungenSearchQuery.trim()}&quot;.
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 600, color: customerRoute ? D.textSecondary : "#475569" }}>
                        {vorbemerkungenMatchCount} {vorbemerkungenMatchCount === 1 ? "Treffer" : "Treffer"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setVorbemerkungenCurrentHitIndex((i) => (i - 1 + vorbemerkungenMatchCount) % vorbemerkungenMatchCount)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${customerRoute ? D.cardBorder : "#e2e8f0"}`,
                          background: "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          color: customerRoute ? D.textSecondary : "#475569",
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
                          border: `1px solid ${customerRoute ? D.cardBorder : "#e2e8f0"}`,
                          background: "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          color: customerRoute ? D.textSecondary : "#475569",
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
                content={vortextForDocumentView}
                maxHeight="420px"
                searchQuery={vorbemerkungenSearchQuery.trim() || undefined}
                theme={{ textPrimary: D.textPrimary, textSecondary: D.textSecondary, cardBorder: D.cardBorder }}
              />
              {vortextForDocumentViewDisplay.trim().length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setVorbemerkungenModalOpen(true)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: customerRoute ? D.radiusButton : 10,
                      border: `1px solid ${customerRoute ? D.cardBorder : "#ddd"}`,
                      background: "transparent",
                      color: customerRoute ? D.primary : "#111",
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
                background: customerRoute ? "#e8f4f8" : "#f0f4f8",
                border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e2e8f0",
                marginBottom: 4,
              }}
            >
              <p style={{ margin: 0, color: customerRoute ? D.textPrimary : "#334155", fontSize: 14, lineHeight: 1.65 }}>
                <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.positionen}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.positionen}
              </p>
            </div>
            <div style={{ border: customerRoute ? `1px solid ${D.cardBorder}` : "1px solid #e5e5e5", borderRadius: customerRoute ? D.cardRadiusLg : 14, padding: customerRoute ? D.spacingCard : 16, background: customerRoute ? D.cardBg : "#fff", boxShadow: customerRoute ? D.cardShadow : undefined }}>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="positionen-suche" style={{ display: "block", fontSize: 13, fontWeight: 600, color: customerRoute ? D.textSecondary : "#475569", marginBottom: 6 }}>
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
                    border: `1px solid ${customerRoute ? D.cardBorder : "#e2e8f0"}`,
                    background: "#fff",
                    fontSize: 14,
                    color: customerRoute ? D.textPrimary : "#0f172a",
                  }}
                />
              </div>
              {positionenSearchQuery.trim() && (
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {positionenMatchCount === 0 ? (
                    <span style={{ fontSize: 13, color: customerRoute ? D.textMuted : "#94a3b8" }}>
                      Keine Treffer für &quot;{positionenSearchQuery.trim()}&quot;.
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 600, color: customerRoute ? D.textSecondary : "#475569" }}>
                        {positionenMatchCount} {positionenMatchCount === 1 ? "Treffer" : "Treffer"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPositionenCurrentHitIndex((i) => (i - 1 + positionenMatchCount) % positionenMatchCount)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${customerRoute ? D.cardBorder : "#e2e8f0"}`,
                          background: "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          color: customerRoute ? D.textSecondary : "#475569",
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
                          border: `1px solid ${customerRoute ? D.cardBorder : "#e2e8f0"}`,
                          background: "#fff",
                          fontSize: 13,
                          fontWeight: 500,
                          color: customerRoute ? D.textSecondary : "#475569",
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
                  theme={{ textPrimary: D.textPrimary, textSecondary: D.textSecondary, cardBorder: D.cardBorder }}
                />
              ) : (
                <VorbemerkungenDocumentView
                  content={positionsForDocumentView}
                  maxHeight="420px"
                  variant="positionen"
                  searchQuery={positionenSearchQuery.trim() || undefined}
                  theme={{ textPrimary: D.textPrimary, textSecondary: D.textSecondary, cardBorder: D.cardBorder }}
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
              theme={{ textPrimary: D.textPrimary, textSecondary: D.textSecondary, cardBg: D.cardBg, cardBorder: D.cardBorder }}
            />
          )}

          {/* Tab-Inhalt: Nachtragspotenzial (Strang B) – eine gemeinsame Komponente, keine Dopplung */}
          {resultTab === "nachtragspotenzial" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: D.spacingCard }}>
            <SectionCard accent="accent" style={{ marginBottom: 0, background: D.cardBg, borderColor: D.cardBorder }}>
              <p style={{ margin: 0, color: D.textPrimary, fontSize: D.fontSizeSectionTitle, lineHeight: 1.65 }}>
                <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.nachtragspotenzial}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.nachtragspotenzial}
              </p>
            </SectionCard>
            <NachtragspotenzialBlock
              analysis={changeOrderAnalysis}
              loading={changeOrderLoading}
              useChangePotentialLlm={useChangePotentialLlm}
              onUseChangePotentialLlmChange={setUseChangePotentialLlm}
              onGenerate={generateChangeOrderAnalysis}
              deduplicatedOpportunities={deduplicatedOpportunities}
              isExpertMode={isExpertMode}
              customerRoute={!!customerRoute}
              designTokens={D}
            />
          </div>
          )}

          {/* Tab-Inhalt: Trigger */}
          {resultTab === "trigger" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: D.spacingCard }}>
          {isExpertMode && (
          <SectionCard accent="secondary" style={{ background: D.cardBg, borderColor: D.cardBorder }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: D.fontSizeSectionTitle, color: D.textSecondary, fontWeight: D.fontWeightSection }}>Filter</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                {result.llmMode && (
                  <div style={{ fontSize: D.fontSizeSmall, color: D.textSecondary, fontWeight: 600 }}>
                    KI-Analyse: {result.findingsBeforeLlm ?? 0} Regeln + {(result.findingsAfterLlm ?? 0) - (result.findingsBeforeLlm ?? 0)} KI = {result.findingsAfterLlm ?? 0} erkannte Risiken
                  </div>
                )}
                <div style={{ color: D.textSecondary, fontWeight: 600 }}>Treffer nach Filter: {filteredFindings.length}</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr auto", gap: 10 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche (Titel, Detail, ID, Kategorie)..."
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
              />

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
              >
                <option value="both">Quelle: alle</option>
                <option value="db">Quelle: nur DB</option>
                <option value="sys">Quelle: nur SYS</option>
                <option value="llm">Quelle: nur KI</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
              >
                <option value="all">Risiko: alle</option>
                <option value="high">Risiko: hoch</option>
                <option value="medium">Risiko: mittel</option>
                <option value="low">Risiko: niedrig</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
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
                style={{ padding: "10px 12px", borderRadius: D.radiusButton, border: `1px solid ${D.cardBorder}`, width: "100%", fontSize: D.fontSizeBody }}
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
                  border: `1px solid ${D.cardBorder}`,
                  background: D.cardBg,
                  color: D.textSecondary,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: D.fontSizeBody,
                }}
              >
                Filter zurücksetzen
              </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", color: D.textPrimary, fontWeight: 600, fontSize: D.fontSizeBody }}>
                <input type="checkbox" checked={top10} onChange={(e) => setTop10(e.target.checked)} />
                <span>Nur die 10 wichtigsten</span>
              </label>

              <div style={{ color: D.textSecondary, fontWeight: 600, fontSize: D.fontSizeCaption }}>
                Datenbank: {dbFindings.length} | System: {sysFindings.length}
                {llmFindings.length > 0 ? ` | KI: ${llmFindings.length}` : ""}
                {otherFindings.length > 0 ? ` | Sonstige: ${otherFindings.length}` : ""}
              </div>
            </div>
          </SectionCard>
          )}

          {/* Findings: Standard = vereinfachte Darstellung (nur Titel, Kategorie, Risiko), Experte = Filter + getrennte Blöcke mit allen Infos */}
          {!isExpertMode && (
          <SectionCard accent="primary" style={{ background: D.cardBg, borderColor: D.cardBorder }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: D.fontSizeSectionTitle, color: D.textSecondary, fontWeight: D.fontWeightSection }}>Treffer</div>
              <div style={{ color: D.textSecondary, fontWeight: 600 }}>{filteredFindings.length} Treffer</div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {filteredFindings.length === 0 ? (
                <div style={{ color: D.textMuted, fontSize: D.fontSizeBody }}>Keine Treffer.</div>
              ) : (
                filteredFindings.map((f) => (
                  <div key={f.id} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: D.cardBg }}>
                    <div style={{ fontWeight: D.fontWeightCardTitle, color: D.textPrimary, marginBottom: 6, fontSize: D.fontSizeBody }}>{sanitizeForDisplay(f.title ?? "")}</div>
                    <div style={{ fontSize: D.fontSizeBody, color: D.textSecondary }}>Kategorie: {catLabel(f.category)}</div>
                    <div style={{ fontSize: D.fontSizeBody, color: D.textSecondary, marginTop: 2 }}>Risiko: {severityLabel(f.severity)}</div>
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
            <SectionCard accent="primary" style={{ background: D.cardBg, borderColor: D.cardBorder }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: D.fontSizeSectionTitle, color: D.textSecondary, fontWeight: D.fontWeightSection }}>Erkannte Risiken (Regel-Datenbank)</div>
                <div style={{ color: D.textSecondary, fontWeight: 600 }}>{dbFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {dbFindings.length === 0 ? (
                  <div style={{ color: D.textMuted, fontSize: D.fontSizeBody }}>Keine Treffer aus der Regel-Datenbank.</div>
                ) : (
                  dbFindings.map((f) => (
                    <div key={f.id} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: D.cardBg }}>
                      <div style={{ display: "grid", gap: 6, fontSize: D.fontSizeBody }}>
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>{customerRoute ? "Prüfregel: " : "Trigger-ID: "}</span>{stripPrefix(f.id)}</div>
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Kategorie:</span> {catLabel(f.category)}</div>
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Gewichtung:</span> -{f.penalty}</div>
                        {(f as any).norm != null && (f as any).norm !== "" && <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Norm:</span> {(f as any).norm}</div>}
                        {(f as any).claimLevel != null && (f as any).claimLevel !== "" && <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Claim-Level:</span> {(f as any).claimLevel}</div>}
                        {(f as any).regex != null && (f as any).regex !== "" && <div style={{ fontFamily: "ui-monospace, monospace", fontSize: D.fontSizeCaption }}><span style={{ color: D.textSecondary, fontWeight: 600 }}>Regex:</span> {(f as any).regex}</div>}
                        {(f as any).keywords != null && (f as any).keywords !== "" && <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Keywords:</span> {(f as any).keywords}</div>}
                        <div style={{ marginTop: 4, fontWeight: D.fontWeightCardTitle, color: D.textPrimary }}>{sanitizeForDisplay(f.title ?? "")}</div>
                        {f.detail && <div style={{ color: D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(f.detail)}</div>}
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Risiko:</span> {severityLabel(f.severity)} {severityDot(f.severity)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            {/* SYS */}
            <SectionCard accent="accent" style={{ background: D.cardBg, borderColor: D.cardBorder }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: D.fontSizeSectionTitle, color: D.textSecondary, fontWeight: D.fontWeightSection }}>Erkannte Risiken (Systemprüfung)</div>
                <div style={{ color: D.textSecondary, fontWeight: 600 }}>{sysFindings.length} Treffer</div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {sysFindings.length === 0 ? (
                  <div style={{ color: D.textMuted, fontSize: D.fontSizeBody }}>Keine Treffer aus Systemprüfung.</div>
                ) : (
                  sysFindings.map((f) => (
                    <div key={f.id} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: D.cardBg }}>
                      <div style={{ display: "grid", gap: 6, fontSize: D.fontSizeBody }}>
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>{customerRoute ? "Prüfregel: " : "Trigger-ID: "}</span>{stripPrefix(f.id)}</div>
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Kategorie:</span> {catLabel(f.category)}</div>
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Gewichtung:</span> -{f.penalty}</div>
                        {(f as any).norm != null && (f as any).norm !== "" && <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Norm:</span> {(f as any).norm}</div>}
                        {(f as any).claimLevel != null && (f as any).claimLevel !== "" && <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Claim-Level:</span> {(f as any).claimLevel}</div>}
                        {(f as any).regex != null && (f as any).regex !== "" && <div style={{ fontFamily: "ui-monospace, monospace", fontSize: D.fontSizeCaption }}><span style={{ color: D.textSecondary, fontWeight: 600 }}>Regex:</span> {(f as any).regex}</div>}
                        {(f as any).keywords != null && (f as any).keywords !== "" && <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Keywords:</span> {(f as any).keywords}</div>}
                        <div style={{ marginTop: 4, fontWeight: D.fontWeightCardTitle, color: D.textPrimary }}>{sanitizeForDisplay(f.title ?? "")}</div>
                        {f.detail && <div style={{ color: D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(f.detail)}</div>}
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Risiko:</span> {severityLabel(f.severity)} {severityDot(f.severity)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {otherFindings.length > 0 && (
                <div style={{ marginTop: 12, color: D.textMuted, fontSize: D.fontSizeCaption }}>
                  Hinweis: {otherFindings.length} erkannte Risiken ohne Zuordnung (Datenbank/System/KI) im Ergebnis.
                </div>
              )}
            </SectionCard>

            {/* LLM */}
            {llmFindings.length > 0 && (
              <SectionCard accent="secondary" style={{ background: D.cardBg, borderColor: D.cardBorder }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: D.fontSizeSectionTitle, color: D.textSecondary, fontWeight: D.fontWeightSection }}>Erkannte Risiken (KI-Analyse)</div>
                  <div style={{ color: D.textSecondary, fontWeight: 600 }}>{llmFindings.length} Treffer</div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {llmFindings.map((f) => (
                    <div key={f.id} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadius, padding: 12, background: D.cardBg }}>
                      <div style={{ display: "grid", gap: 6, fontSize: D.fontSizeBody }}>
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>{customerRoute ? "Prüfregel: " : "Trigger-ID: "}</span>{stripPrefix(f.id)}</div>
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Kategorie:</span> {catLabel(f.category)}</div>
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Gewichtung:</span> -{f.penalty}</div>
                        {(f as any).norm != null && (f as any).norm !== "" && <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Norm:</span> {(f as any).norm}</div>}
                        {(f as any).claimLevel != null && (f as any).claimLevel !== "" && <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Claim-Level:</span> {(f as any).claimLevel}</div>}
                        {(f as any).regex != null && (f as any).regex !== "" && <div style={{ fontFamily: "ui-monospace, monospace", fontSize: D.fontSizeCaption }}><span style={{ color: D.textSecondary, fontWeight: 600 }}>Regex:</span> {(f as any).regex}</div>}
                        {(f as any).keywords != null && (f as any).keywords !== "" && <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Keywords:</span> {(f as any).keywords}</div>}
                        <div style={{ marginTop: 4, fontWeight: D.fontWeightCardTitle, color: D.textPrimary }}>{sanitizeForDisplay(f.title ?? "")}</div>
                        {f.detail && <div style={{ color: D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(f.detail)}</div>}
                        <div><span style={{ color: D.textSecondary, fontWeight: 600 }}>Risiko:</span> {severityLabel(f.severity)} {severityDot(f.severity)}</div>
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
          <SectionCard accent="accent" style={{ marginBottom: 0, background: D.cardBg, borderColor: D.cardBorder }}>
            <p style={{ margin: 0, color: D.textPrimary, fontSize: D.fontSizeSectionTitle, lineHeight: 1.65 }}>
              <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.rueckfragen}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.rueckfragen}
            </p>
          </SectionCard>
          <SectionCard accent="primary" style={{ background: D.cardBg, borderColor: D.cardBorder }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: clarificationQuestions ? 16 : 0 }}>
              <div style={{ fontSize: 15, color: D.textPrimary, fontWeight: 700 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.rueckfragenBlock}</div>
              <button
                onClick={generateClarificationQuestions}
                disabled={clarificationQuestionsLoading}
                style={{
                  padding: "10px 18px",
                  borderRadius: D.radiusButton,
                  border: "none",
                  background: clarificationQuestionsLoading ? D.textMuted : D.primary,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: clarificationQuestionsLoading ? "wait" : "pointer",
                  opacity: clarificationQuestionsLoading ? 0.9 : 1,
                }}
              >
                {clarificationQuestionsLoading ? DEFAULT_TEXTS_CONFIG.rueckfragen.generateButtonLoading : DEFAULT_TEXTS_CONFIG.rueckfragen.generateButton}
              </button>
            </div>

            {clarificationQuestions && (
              <>
                <div style={{ display: "grid", gap: D.spacingCard }}>
                  {(["technisch", "vertraglich", "terminlich"] as const).map((group) => {
                    const items = clarificationQuestions.byGroup?.[group] ?? [];
                    const labels = DEFAULT_TEXTS_CONFIG.rueckfragen.groupLabels;
                    if (items.length === 0) return null;
                    return (
                      <div key={group} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadius, padding: 14, background: D.filterBg }}>
                        <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 700, marginBottom: 10 }}>
                          {labels[group]} ({items.length})
                        </div>
                        <div style={{ display: "grid", gap: 10 }}>
                          {items.map((q: any) => (
                            <div key={q.id} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: 10, padding: 12, background: D.cardBg }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <StatusBadge variant={q.severity === "high" ? "danger" : q.severity === "medium" ? "warning" : "info"} small>
                                  {q.severity ?? "—"}
                                </StatusBadge>
                                {q.sourceFindingId && (
                                  <span style={{ fontSize: 11, color: D.textMuted }}>← {q.sourceFindingId}</span>
                                )}
                              </div>
                              <div style={{ marginTop: 8, fontWeight: 600, color: D.textPrimary, fontSize: 13, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(q.question ?? "")}</div>
                              <div style={{ marginTop: 6, fontSize: 12, color: D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(q.reason ?? "")}</div>
                              {q.sourceTextSnippet && (
                                <div style={{ marginTop: 6, fontSize: 11, color: D.textMuted, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap" }}>
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
              <div style={{ marginTop: 12, color: D.textSecondary, fontSize: 13, fontWeight: 600 }}>
                {DEFAULT_TEXTS_CONFIG.rueckfragen.emptyState}
              </div>
            )}
          </SectionCard>
          </div>
          )}

          {/* Tab-Inhalt: Angebotsklarstellungen */}
          {resultTab === "angebotsklarstellungen" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: D.spacingCard }}>
          <SectionCard accent="primary" style={{ marginBottom: 0, background: D.cardBg, borderColor: D.cardBorder }}>
            <p style={{ margin: 0, color: D.textPrimary, fontSize: D.fontSizeSectionTitle, lineHeight: 1.65 }}>
              <strong>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.angebotsklarstellungen}</strong> — {DEFAULT_TEXTS_CONFIG.explanation.angebotsklarstellungen}
            </p>
          </SectionCard>
          <SectionCard accent="secondary" style={{ background: D.cardBg, borderColor: D.cardBorder }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: offerAssumptions ? 16 : 0 }}>
              <div style={{ fontSize: 15, color: D.textPrimary, fontWeight: 700 }}>{DEFAULT_TEXTS_CONFIG.customerUI.sectionHeaders.angebotsBlock}</div>
              <button
                onClick={generateOfferAssumptions}
                disabled={offerAssumptionsLoading}
                style={{
                  padding: "10px 18px",
                  borderRadius: D.radiusButton,
                  border: "none",
                  background: offerAssumptionsLoading ? D.textMuted : D.secondary,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: offerAssumptionsLoading ? "wait" : "pointer",
                  opacity: offerAssumptionsLoading ? 0.9 : 1,
                }}
              >
                {offerAssumptionsLoading ? DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.generateButtonLoading : DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.generateButton}
              </button>
            </div>

            {offerAssumptions && (
              <>
                <div style={{ display: "grid", gap: D.spacingCard }}>
                  {(["technisch", "vertraglich", "terminlich"] as const).map((group) => {
                    const items = offerAssumptions.byGroup?.[group] ?? [];
                    const labels = DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.groupLabels;
                    if (items.length === 0) return null;
                    return (
                      <div key={group} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: D.cardRadius, padding: 14, background: D.filterBg }}>
                        <div style={{ fontSize: 12, color: D.textSecondary, fontWeight: 700, marginBottom: 10 }}>
                          {labels[group]} ({items.length})
                        </div>
                        <div style={{ display: "grid", gap: 10 }}>
                          {items.map((a: any) => (
                            <div key={a.id} style={{ border: `1px solid ${D.cardBorder}`, borderRadius: 10, padding: 12, background: D.cardBg }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <StatusBadge variant={a.severity === "high" ? "danger" : a.severity === "medium" ? "warning" : "info"} small>
                                  {a.severity ?? "—"}
                                </StatusBadge>
                                <span style={{ fontSize: 11, color: D.textMuted }}>
                                  {a.sourceFindingId && <>Risiko: {a.sourceFindingId}</>}
                                  {a.sourceFindingId && a.sourceQuestionId && " · "}
                                  {a.sourceQuestionId && <>Frage: {a.sourceQuestionId}</>}
                                </span>
                              </div>
                              <div style={{ marginTop: 8, fontWeight: 600, color: D.textPrimary, fontSize: 13, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(a.assumption ?? "")}</div>
                              <div style={{ marginTop: 6, fontSize: 12, color: D.textSecondary, whiteSpace: "pre-wrap" }}>{sanitizeForDisplay(a.reason ?? "")}</div>
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
              <div style={{ marginTop: 12, color: D.textSecondary, fontSize: 13, fontWeight: 600 }}>
                {DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.emptyState}
              </div>
            )}

            {offerAssumptionsLoading && (
              <div style={{ marginTop: 14, padding: 20, textAlign: "center", color: D.textSecondary, fontWeight: 600 }}>
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
  customerDesign?: typeof D;
}) {
  const { normalized, debug, customerRoute, customerDesign } = props;
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const primary = customerDesign?.primary ?? "#111";
  const maxH = "320px";

  return (
    <div style={{ maxHeight: maxH, overflow: "auto", border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
      {/* Gruppen als Abschnitte */}
      {normalized.groups?.length > 0 && (
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#666", marginBottom: 8 }}>Gruppen</div>
          {normalized.groups.map((g: any, i: number) => (
            <div
              key={i}
              style={{
                marginBottom: 6,
                paddingLeft: (g.level ?? 0) * 12,
                borderLeft: `3px solid ${primary}`,
                padding: "6px 10px",
                background: "#fafafa",
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
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#666", marginBottom: 8 }}>Hinweise / Vorbemerkungen</div>
          {normalized.remarks.map((r: any, i: number) => (
            <div key={i} style={{ marginBottom: 8, padding: 8, background: "#f8f9fa", borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 12 }}>
              {r.kind && <strong>{r.kind}: </strong>}
              {r.text}
            </div>
          ))}
        </div>
      )}

      {/* Positionen tabellarisch: Pos, Kurztext, Menge, Einheit, Langtext per Accordion */}
      {normalized.items?.length > 0 && (
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#666", marginBottom: 8 }}>Positionen</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ddd" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 800 }}>Pos</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 800 }}>Kurztext</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 800 }}>Menge</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 800 }}>Einheit</th>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {normalized.items.map((it: any, idx: number) => (
                  <React.Fragment key={idx}>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
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
                        <td colSpan={5} style={{ padding: "8px 6px 12px", background: "#f8f9fa", whiteSpace: "pre-wrap", fontSize: 12, borderBottom: "1px solid #eee" }}>
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
  return <ScorePage customerRoute={false} />;
}
