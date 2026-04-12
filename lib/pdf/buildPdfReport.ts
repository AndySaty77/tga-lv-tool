/**
 * Baut aus Rohdaten (Analyse-Result / result_json + Lauf-Metadaten) ein stabiles AnalysisPdfReport.
 * Defensiv: keine Crashes bei fehlenden Feldern, Arrays normalisiert, leere Strings bereinigt.
 * Keine Debug-Felder oder technischen Rohdaten ins PDF-Modell.
 */

import { getAnalysisDisplayTitle } from "@/lib/analysisDisplayTitle";
import { KEYFACT_LABELS } from "@/lib/keyFactsDefinition";
import { buildKeyFactsDisplayListQuick } from "@/lib/keyFactsDisplayQuick";
import {
  getInternalTeamNotesTextForPdf,
  parseManualProjectData,
  READONLY_PROJECT_KEYFACT_KEYS,
  resolveDisplayProjectName,
  resolveFinalKeyFactDisplay,
  type ManualProjectData,
} from "@/lib/manualProjectData";
import { collectPruefHinweiseFromFinding } from "@/lib/userHintsForFinding";
import type {
  AnalysisPdfReport,
  PdfCategoryScore,
  PdfClaimPotential,
  PdfClarification,
  PdfDisclaimer,
  PdfKeyFactRow,
  PdfQuestion,
  PdfReportMeta,
  PdfSummary,
  PdfTopRiskItem,
} from "./pdfTypes";
import {
  formatDateDE,
  normalizeList,
  normalizeStringList,
  sanitizeMultilineNoteForPdf,
  sanitizeText,
  scoreToTrafficLight,
  stripScoringEngineeringJargon,
} from "./pdfFormatters";
import { normalizeLegalSignalsForReport } from "@/lib/legal-signals/presentation";
import type { PdfLegalSignalItem } from "./pdfTypes";
import {
  computeCommercialOutputMetrics,
  flattenStoredClarificationQuestions,
  flattenStoredOfferAssumptions,
  guardCommercialUserFacingText,
  resolveClarificationQuestionDisplayTitle,
  resolveOfferAssumptionDisplayTitle,
  type CommercialOutputMetrics,
} from "@/lib/commercialOutputNormalize";
import { buildNachtragCustomerView } from "@/lib/nachtrag-v2/customerView";
import { alignStoredTextNachtragIndexParagraphs, leadingNachtragspotenzialScore } from "@/lib/nachtrag-v2/leadingPotentialScore";
import type { NachtragResultV2 } from "@/lib/nachtrag-v2/types";

/** Kategorien-Labels (5er-API und UI); 6er-Kategorien aus scoring.ts werden auf lesbare Labels gemappt. */
const CATEGORY_LABELS: Record<string, string> = {
  vertrags_lv_risiken: "Vertrags- und LV-Risiken",
  mengen_massenermittlung: "Mengen und Massenermittlung",
  technische_vollstaendigkeit: "Technische Vollständigkeit",
  schnittstellen_nebenleistungen: "Schnittstellen und Nebenleistungen",
  kalkulationsunsicherheit: "Kalkulationsunsicherheit",
  normen: "Normen und Vertragsgrundlagen",
  vollstaendigkeit: "Vollständigkeit",
  vortext: "Vortext / Projektkontext",
  mengen_schnittstellen: "Mengen und Schnittstellen",
  nachtrag: "Nachtragsrisiko",
  ausfuehrung: "Ausführung",
  kalkulation: "Kalkulation",
};

const DEFAULT_DISCLAIMER =
  "Dieser Bericht wurde automatisch aus der LV-Analyse erzeugt. Er dient der Unterstützung und ersetzt keine fachliche Prüfung.";

/** PDF-Export: nur gesetzte Flags wirken; interne Notizen nur bei explizitem `includeInternalTeamNotes: true`. */
export type BuildPdfReportOptions = {
  /** Nur bei `true`: `internalTeamNotes` ins Report-Modell (sonst kein Feld, auch wenn Notiztext existiert). Standard: ausgelassen = nicht anzeigen. */
  includeInternalTeamNotes?: boolean;
};

/** Nur LV-Strukturgröße / Vorbemerkungsumfang – keine manuelle Schicht (gleiche Regel wie UI). */
const READONLY_KF_SET = new Set<string>(READONLY_PROJECT_KEYFACT_KEYS);

function keyFactsUnknownToStringRecord(kf: Record<string, unknown>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(kf)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) o[k] = s;
  }
  return o;
}

/** Gemeinsame Finale mit UI: Helper aus manualProjectData + Basiszeilen wie keyFactsDisplayQuick. */
function finalKeyFactValueForPdf(
  key: string,
  row: { value: string; isFallback: boolean },
  manualData: ManualProjectData,
): string {
  if (READONLY_KF_SET.has(key)) return row.value;
  return resolveFinalKeyFactDisplay({
    keyFactKey: key,
    baseDisplay: row.value,
    isFallback: row.isFallback,
    manualData,
  }).final;
}

function flattenByGroup(byGroup: Record<string, unknown[]> | undefined): unknown[] {
  if (!byGroup || typeof byGroup !== "object") return [];
  const flat: unknown[] = [];
  for (const arr of Object.values(byGroup) as unknown[]) {
    if (Array.isArray(arr)) for (const item of arr) flat.push(item);
  }
  return flat;
}

/** Rohdaten: Vereinigung von `questions` und `byGroup` (keine stillen Teilzählungen). */
function extractClarificationQuestionsArray(rj: Record<string, unknown>): unknown[] {
  const raw = rj.clarificationQuestions ?? rj.clarification_questions;
  return flattenStoredClarificationQuestions(raw);
}

/** Analog Angebotsklarstellungen: `assumptions` ∪ `byGroup`. */
function extractOfferAssumptionItems(rj: Record<string, unknown>): unknown[] {
  const raw = rj.offerAssumptions ?? rj.offer_assumptions;
  return flattenStoredOfferAssumptions(raw);
}

function tryNachtragV2FromResultJson(rj: Record<string, unknown>): NachtragResultV2 | null {
  const cp = rj.changePotentialSummary;
  if (cp == null || typeof cp !== "object") return null;
  const v2 = (cp as { v2Debug?: unknown }).v2Debug;
  if (v2 == null || typeof v2 !== "object") return null;
  const o = v2 as { potentialScore?: unknown; enforceabilityScore?: unknown };
  if (typeof o.potentialScore !== "number" || typeof o.enforceabilityScore !== "number") return null;
  return v2 as NachtragResultV2;
}

/**
 * Gleiche V2-Erkennung wie PDF/Report: `result_json` gemerged wie in `buildPdfReport`
 * (z. B. damit UI keinen zweiten KI-Strategietext zeigt, wenn Nachtrag-V2 maßgeblich ist).
 */
export function analysisInputHasNachtragV2(input: unknown): boolean {
  if (input == null || typeof input !== "object") return false;
  const raw = input as Record<string, unknown>;
  const rj = mergeResultJsonWithTopLevel(raw);
  return tryNachtragV2FromResultJson(rj) !== null;
}

/** result_json kann als Objekt oder (selten) JSON-String vorliegen; Felder auch auf Analyse-Zeile. */
function normalizeResultJson(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === "string") {
    try {
      const p = JSON.parse(value);
      if (typeof p === "object" && p !== null && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      return {};
    }
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function mergeResultJsonWithTopLevel(raw: Record<string, unknown>): Record<string, unknown> {
  const rj = normalizeResultJson(raw.result_json ?? raw.resultJson);
  const out: Record<string, unknown> = { ...rj };
  const lift = (camel: string, snake: string) => {
    if (out[camel] == null && out[snake] != null) out[camel] = out[snake];
    if (out[camel] == null && raw[camel] != null) out[camel] = raw[camel];
    if (out[camel] == null && raw[snake] != null) out[camel] = raw[snake];
  };
  lift("clarificationQuestions", "clarification_questions");
  lift("offerAssumptions", "offer_assumptions");
  lift("legalSignals", "legal_signals");
  if (out.changePotentialSummary == null && out.changeOrderAnalysis != null && typeof out.changeOrderAnalysis === "object") {
    const co = out.changeOrderAnalysis as Record<string, unknown>;
    if (co.changePotentialSummary != null) out.changePotentialSummary = co.changePotentialSummary;
  }
  return out;
}

/**
 * Roh-Input: entweder komplette Analyse-Zeile (inkl. result_json, management_summary, created_at, project_name, file_name, score)
 * oder ein Objekt mit result_json/resultJson und optional meta-Feldern.
 */
export function buildPdfReport(input: unknown, options?: BuildPdfReportOptions): AnalysisPdfReport {
  if (input == null || typeof input !== "object") {
    return getEmptyReport();
  }

  const raw = input as Record<string, unknown>;
  const rj = mergeResultJsonWithTopLevel(raw);

  const flatQuestionsRaw = extractClarificationQuestionsArray(rj);
  const flatAssumptionsRaw = extractOfferAssumptionItems(rj);
  const { metrics: commercialMetrics, questionsNet, assumptionsNet } = computeCommercialOutputMetrics(
    flatQuestionsRaw,
    flatAssumptionsRaw,
  );

  const meta = buildMeta(raw, rj);
  const summary = buildSummary(raw, rj, commercialMetrics);
  const categoryScores = buildCategoryScores(rj);
  const keyFacts = buildKeyFactRows(rj);
  const claimPotential = buildClaimPotential(rj, tryNachtragV2FromResultJson(rj));
  const questions = buildQuestionsFromItems(questionsNet);
  const clarifications = buildClarificationsFromItems(assumptionsNet);
  const topRisks = buildTopRisksItems(rj);
  const legalSignals = buildLegalSignalsItems(rj);
  const nextSteps = buildNextSteps(questions, clarifications, claimPotential);
  const disclaimer = buildDisclaimer(raw, rj);
  const internalTeamNotes = buildInternalTeamNotes(rj, options);

  return {
    meta,
    summary,
    categoryScores,
    ...(keyFacts.length > 0 ? { keyFacts } : {}),
    ...(nextSteps.length > 0 ? { nextSteps } : {}),
    ...(topRisks.length > 0 ? { topRisks } : {}),
    ...(legalSignals.length > 0 ? { legalSignals } : {}),
    ...(claimPotential && Object.keys(claimPotential).length > 0 ? { claimPotential } : {}),
    ...(questions.length > 0 ? { questions } : {}),
    ...(clarifications.length > 0 ? { clarifications } : {}),
    ...(internalTeamNotes ? { internalTeamNotes } : {}),
    disclaimer,
  };
}

function buildInternalTeamNotes(
  rj: Record<string, unknown>,
  options?: BuildPdfReportOptions,
): string | undefined {
  if (options?.includeInternalTeamNotes !== true) return undefined;
  const manualData = parseManualProjectData(rj.manualProjectData);
  const raw = getInternalTeamNotesTextForPdf(manualData);
  if (!raw) return undefined;
  const sanitized = sanitizeMultilineNoteForPdf(raw);
  return sanitized.length > 0 ? sanitized : undefined;
}

function getEmptyReport(): AnalysisPdfReport {
  return {
    meta: { analyzedAt: formatDateDE(new Date()) },
    summary: {},
    categoryScores: [],
    disclaimer: { text: DEFAULT_DISCLAIMER },
  };
}

function buildMeta(raw: Record<string, unknown>, rj: Record<string, unknown>): PdfReportMeta {
  const createdAt = raw.created_at ?? raw.createdAt;
  const analyzedAt =
    typeof createdAt === "string" || typeof createdAt === "number" || createdAt instanceof Date
      ? formatDateDE(createdAt)
      : formatDateDE(new Date());

  const pn = safeString(raw.project_name ?? raw.projectName);
  const fn = safeString(raw.file_name ?? raw.fileName);
  const sourceFileName = safeString(raw.file_name ?? raw.fileName);
  const keyFacts = rj.keyFacts != null && typeof rj.keyFacts === "object" ? (rj.keyFacts as Record<string, unknown>) : {};
  const kfStr = keyFactsUnknownToStringRecord(keyFacts);
  const manualData = parseManualProjectData(rj.manualProjectData);
  const quick = buildKeyFactsDisplayListQuick(rj);
  const byKey = Object.fromEntries(quick.map((r) => [r.key, r])) as Record<
    string,
    { value: string; isFallback: boolean }
  >;

  const resolvedTitle = resolveDisplayProjectName(manualData, kfStr).trim();
  const projectName = resolvedTitle || getAnalysisDisplayTitle(pn || null, fn || null);

  const ft = (k: string) =>
    finalKeyFactValueForPdf(k, byKey[k] ?? { value: "", isFallback: true }, manualData);

  const projectTypeCombined = ft("projektart") || ft("gewerk") || ft("bauvorhaben");
  const projectType = projectTypeCombined.trim() ? projectTypeCombined.trim() : undefined;

  const bauherrFinal = ft("bauherr_ag").trim();
  const companyName =
    bauherrFinal ||
    safeString(keyFacts.planer) ||
    undefined;

  return {
    projectName,
    ...(sourceFileName ? { sourceFileName } : {}),
    analyzedAt,
    ...(projectType ? { projectType } : {}),
    ...(companyName ? { companyName } : {}),
  };
}

function buildSummary(raw: Record<string, unknown>, rj: Record<string, unknown>, metrics: CommercialOutputMetrics): PdfSummary {
  let managementSummary = safeString(raw.management_summary ?? raw.managementSummary);
  const scoreResult = rj.scoreResult != null && typeof rj.scoreResult === "object" ? (rj.scoreResult as Record<string, unknown>) : {};
  const changeOrder = rj.changeOrderAnalysis != null && typeof rj.changeOrderAnalysis === "object" ? (rj.changeOrderAnalysis as Record<string, unknown>) : {};
  const offerSummary = changeOrder.offerStrategySummary != null && typeof changeOrder.offerStrategySummary === "object"
    ? (changeOrder.offerStrategySummary as Record<string, unknown>)
    : {};

  const v2 = tryNachtragV2FromResultJson(rj);
  const cpForScore = rj.changePotentialSummary;
  let nachtragCustomerView: ReturnType<typeof buildNachtragCustomerView> | null = null;

  if (v2) {
    nachtragCustomerView = buildNachtragCustomerView({ v2 });
    if (cpForScore != null && typeof cpForScore === "object") {
      const unified = leadingNachtragspotenzialScore(cpForScore as { overallIndex: number; v2Debug?: unknown });
      if (managementSummary.trim()) {
        managementSummary = alignStoredTextNachtragIndexParagraphs(managementSummary, unified);
      }
    }
  }

  /**
   * Bei Nachtrag-V2: **eine** Strategiequelle (buildNachtragCustomerView) – keine KI-Angebotsstrategie,
   * die „defensiv/offensiv“ widersprüchlich zur Nachtragspotenzial-Kachel wäre.
   */
  let executiveSummary: string | undefined;
  if (v2 && nachtragCustomerView) {
    const view = nachtragCustomerView;
    const strategyOnly = `${view.recommendedStrategy.title}. ${view.recommendedStrategy.rationale}`;
    const base = managementSummary?.trim() ? managementSummary.trim() : "";
    executiveSummary = base ? `${base}\n\n${strategyOnly}` : strategyOnly;
  } else {
    executiveSummary =
      safeString(offerSummary.executiveSummary) ||
      managementSummary ||
      undefined;
  }

  const countsExplanation =
    metrics.questionsTotalDetected > 0 || metrics.clarificationsTotalDetected > 0
      ? `Rückfragen: ${metrics.questionsTotalDetected} erkannt, ${metrics.questionsAfterDedupe} nach inhaltlicher Verdichtung (Handlungsfokus bis zu ${metrics.questionsPrioritizedForManagement}). ` +
        `Angebotsklarstellungen: ${metrics.clarificationsTotalDetected} erkannt, ${metrics.clarificationsAfterDedupe} nach Verdichtung (Fokus bis zu ${metrics.clarificationsPrioritizedForManagement}). ` +
        `Ausführliche Listen im Bericht entsprechen der verdichteten Auswahl.`
      : undefined;

  if (countsExplanation) {
    executiveSummary = executiveSummary ? `${executiveSummary}\n\n${countsExplanation}` : countsExplanation;
  }

  const totalScore = numberOrNull(raw.score ?? scoreResult.total);
  const level = safeString(scoreResult.level);
  const totalRiskLabel = level ? levelToRiskLabel(level) : totalScore != null ? scoreToRiskLabel(totalScore) : undefined;

  return {
    ...(executiveSummary ? { executiveSummary } : {}),
    ...(totalScore != null ? { totalScore } : {}),
    ...(totalRiskLabel ? { totalRiskLabel } : {}),
    ...(nachtragCustomerView
      ? {
          claimLevel: `${nachtragCustomerView.potentialLabel} · ${Math.round(nachtragCustomerView.potentialScore)}/100`,
        }
      : {}),
    ...(metrics.questionsAfterDedupe > 0 ? { questionCount: metrics.questionsAfterDedupe } : {}),
    ...(metrics.clarificationsAfterDedupe > 0 ? { clarificationCount: metrics.clarificationsAfterDedupe } : {}),
    ...(metrics.questionsTotalDetected > 0 ? { questionsTotalDetected: metrics.questionsTotalDetected } : {}),
    ...(metrics.questionsAfterDedupe > 0 ? { questionsAfterDedupe: metrics.questionsAfterDedupe } : {}),
    ...(metrics.questionsPrioritizedForManagement > 0 ? { questionsPrioritizedForManagement: metrics.questionsPrioritizedForManagement } : {}),
    ...(metrics.clarificationsTotalDetected > 0 ? { clarificationsTotalDetected: metrics.clarificationsTotalDetected } : {}),
    ...(metrics.clarificationsAfterDedupe > 0 ? { clarificationsAfterDedupe: metrics.clarificationsAfterDedupe } : {}),
    ...(metrics.clarificationsPrioritizedForManagement > 0
      ? { clarificationsPrioritizedForManagement: metrics.clarificationsPrioritizedForManagement }
      : {}),
    ...(countsExplanation ? { countsExplanation } : {}),
  };
}

function levelToRiskLabel(level: string): string {
  const l = level.toLowerCase();
  if (l === "hochriskant") return "Hohes Risiko";
  if (l === "mittel") return "Erhöhtes Risiko";
  if (l === "solide") return "Moderates Risiko";
  if (l === "sauber") return "Niedriges Risiko";
  return level;
}

function scoreToRiskLabel(score: number): string {
  if (score < 40) return "Niedriges Risiko";
  if (score < 70) return "Erhöhtes Risiko";
  return "Kritische Ausschreibung";
}

function buildCategoryScores(rj: Record<string, unknown>): PdfCategoryScore[] {
  const scoreResult = rj.scoreResult != null && typeof rj.scoreResult === "object" ? (rj.scoreResult as Record<string, unknown>) : {};
  const perCategory = scoreResult.perCategory != null && typeof scoreResult.perCategory === "object"
    ? (scoreResult.perCategory as Record<string, unknown>)
    : {};
  const findingsSorted = Array.isArray(scoreResult.findingsSorted) ? scoreResult.findingsSorted : [];

  const entries = Object.entries(perCategory).filter(
    ([k]) => !/^(debug|raw|_)/i.test(k) && typeof perCategory[k] === "number"
  );

  if (entries.length === 0 && findingsSorted.length > 0) {
    const byCat: Record<string, { score?: number; items: unknown[] }> = {};
    for (const f of findingsSorted) {
      const obj = f as { category?: string };
      const key = (obj.category && String(obj.category).trim()) || "ohne_kategorie";
      if (!byCat[key]) byCat[key] = { items: [] };
      byCat[key].items.push(f);
    }
    return Object.entries(byCat).map(([key, data]) => ({
      key,
      label: CATEGORY_LABELS[key] ?? key.replace(/_/g, " "),
      trafficLight: undefined as PdfCategoryScore["trafficLight"],
      shortReason: undefined,
      topDrivers: normalizeStringList(data.items, 3),
    }));
  }

  return entries.map(([key, value]) => {
    const num = typeof value === "number" && !Number.isNaN(value) ? value : undefined;
    const findingsInCat = findingsSorted.filter((f) => (f as { category?: string }).category === key);
    const topDrivers = normalizeStringList(
      findingsInCat.map((f) => (f as { title?: string; detail?: string }).title ?? (f as { detail?: string }).detail),
      3
    ).map((t) => sanitizeText(t, { maxLength: 120 }));

    return {
      key,
      label: CATEGORY_LABELS[key] ?? key.replace(/_/g, " "),
      ...(num != null ? { score: num } : {}),
      ...(num != null ? { trafficLight: scoreToTrafficLight(num) } : {}),
      topDrivers: topDrivers.length > 0 ? topDrivers : undefined,
    };
  });
}

function buildClaimPotential(rj: Record<string, unknown>, v2: NachtragResultV2 | null): PdfClaimPotential | undefined {
  const changeOrder = rj.changeOrderAnalysis != null && typeof rj.changeOrderAnalysis === "object"
    ? (rj.changeOrderAnalysis as Record<string, unknown>)
    : {};
  const offerSummary = changeOrder.offerStrategySummary != null && typeof changeOrder.offerStrategySummary === "object"
    ? (changeOrder.offerStrategySummary as Record<string, unknown>)
    : {};
  const opportunities = Array.isArray(changeOrder.opportunities) ? changeOrder.opportunities : [];
  const scoreResult = rj.scoreResult != null && typeof rj.scoreResult === "object" ? (rj.scoreResult as Record<string, unknown>) : {};
  const findingsSorted = Array.isArray(scoreResult.findingsSorted) ? scoreResult.findingsSorted : [];

  /** Bei V2 keine separate KI-„Einordnung“ mit konkurrierender Angebotsstrategie (siehe Executive Summary / finalRecommendation). */
  const executiveSummary = v2 ? undefined : sanitizeText(offerSummary.executiveSummary);
  const topRisks = normalizeStringList(findingsSorted, 5)
    .map((t) => sanitizeText(stripScoringEngineeringJargon(t), { maxLength: 200, stripTechnical: false }))
    .filter((t) => t.trim().length > 0);
  const topNegotiationPoints = normalizeStringList(
    opportunities.map((o) => (o as { title?: string; summary?: string }).title ?? (o as { summary?: string }).summary),
    5
  ).map((t) => sanitizeText(t, { maxLength: 200 }));
  const immediateActions = normalizeStringList(offerSummary.immediateActions, 5);
  let finalRecommendation = sanitizeText(offerSummary.finalRecommendation ?? offerSummary.recommendation);

  /** Eine maßgebliche Strategie: bei vorhandenem Nachtrag-V2 identisch zur Kundenansicht (Nachtragspotenzial-UI). */
  if (v2) {
    const view = buildNachtragCustomerView({ v2 });
    finalRecommendation = `${view.recommendedStrategy.title}. ${view.recommendedStrategy.rationale}`;
  }

  if (
    !executiveSummary &&
    topRisks.length === 0 &&
    topNegotiationPoints.length === 0 &&
    immediateActions.length === 0 &&
    !finalRecommendation
  ) {
    return undefined;
  }

  return {
    ...(executiveSummary ? { executiveSummary } : {}),
    ...(topRisks.length > 0 ? { topRisks } : {}),
    ...(topNegotiationPoints.length > 0 ? { topNegotiationPoints } : {}),
    ...(immediateActions.length > 0 ? { immediateActions } : {}),
    ...(finalRecommendation ? { finalRecommendation } : {}),
  };
}

function prettyKeyFactLabel(k: string): string {
  const fromMap = KEYFACT_LABELS[k];
  if (fromMap) return fromMap;
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildKeyFactRows(rj: Record<string, unknown>): PdfKeyFactRow[] {
  const manualData = parseManualProjectData(rj.manualProjectData);
  const quick = buildKeyFactsDisplayListQuick(rj);
  const rows: PdfKeyFactRow[] = [];
  for (const q of quick) {
    const value = finalKeyFactValueForPdf(q.key, { value: q.value, isFallback: q.isFallback }, manualData);
    rows.push({
      label: KEYFACT_LABELS[q.key] ?? prettyKeyFactLabel(q.key),
      value,
    });
  }
  return rows;
}

function severityToReadablePriority(sev: unknown): string | number | undefined {
  if (sev == null) return undefined;
  const s = String(sev).toLowerCase();
  if (s === "high") return "hoch";
  if (s === "medium") return "mittel";
  if (s === "low") return "niedrig";
  return sev as string | number;
}

function buildQuestionsFromItems(clarificationQuestions: unknown[]): PdfQuestion[] {
  return normalizeList(clarificationQuestions, (item) => {
    if (item == null) return null;
    const obj = item as {
      question?: string;
      why?: string;
      reason?: string;
      clarifyPoints?: string[];
      text?: string;
      title?: string;
      user_hint?: string;
      userHint?: string;
      priority?: string | number;
      severity?: string;
      category?: string;
    };
    const bullets =
      Array.isArray(obj.clarifyPoints) && obj.clarifyPoints.length > 0
        ? obj.clarifyPoints.map((p) => guardCommercialUserFacingText(String(p).trim(), 8)).filter(Boolean)
        : [];
    const mainQ = guardCommercialUserFacingText(safeString(obj.question), 8) || safeString(obj.question);
    const text =
      mainQ && bullets.length
        ? `${mainQ}\n• ${bullets.slice(0, 4).join("\n• ")}`
        : mainQ ||
          guardCommercialUserFacingText(safeString(obj.text), 8) ||
          safeString(obj.text) ||
          guardCommercialUserFacingText(safeString(obj.why), 8) ||
          safeString(obj.why) ||
          guardCommercialUserFacingText(safeString(obj.reason), 8) ||
          safeString(obj.reason) ||
          guardCommercialUserFacingText(safeString(obj.title), 8) ||
          safeString(obj.title) ||
          String(item).trim();
    const textClean = guardCommercialUserFacingText(text, 12);
    if (!textClean) return null;
    const catKey = obj.category ? String(obj.category).trim() : "";
    const categoryLabel = catKey ? CATEGORY_LABELS[catKey] ?? catKey.replace(/_/g, " ") : undefined;
    const priority =
      obj.priority != null ? obj.priority : obj.severity != null ? severityToReadablePriority(obj.severity) : undefined;
    const titleNorm = resolveClarificationQuestionDisplayTitle(item);
    const titleOk = titleNorm ? guardCommercialUserFacingText(titleNorm, 8) || titleNorm : "";
    return {
      ...(titleOk ? { title: sanitizeText(titleOk, { maxLength: 160 }) } : {}),
      text: sanitizeText(textClean, { maxLength: 500 }),
      ...(priority != null ? { priority } : {}),
      ...(categoryLabel ? { categoryLabel } : {}),
    };
  });
}

function clarificationFromOfferAssumptionItem(item: unknown): PdfClarification | null {
  if (item == null) return null;
   const obj = item as {
    clarification?: string;
    scopeNote?: string;
    assumption?: string;
    text?: string;
    title?: string;
    reason?: string;
    why?: string;
    user_hint?: string;
    userHint?: string;
    category?: string;
  };
  const coreRaw =
    safeString(obj.clarification) ||
    safeString(obj.assumption) ||
    safeString(obj.text) ||
    safeString(obj.why) ||
    safeString(obj.reason) ||
    safeString(obj.title) ||
    (typeof item === "string" ? item.trim() : "");
  const core = guardCommercialUserFacingText(coreRaw, 14) || coreRaw.trim();
  const scope = guardCommercialUserFacingText(safeString(obj.scopeNote), 6) || safeString(obj.scopeNote);
  const text = scope && core ? `${core} ${scope}` : core;
  const textClean = guardCommercialUserFacingText(text, 14);
  if (!textClean) return null;
  const catKey = typeof obj.category === "string" && obj.category.trim() ? obj.category.trim() : "";
  const categoryLabel = catKey ? CATEGORY_LABELS[catKey] ?? catKey.replace(/_/g, " ") : "";
  const titleNorm = resolveOfferAssumptionDisplayTitle(item);
  const titleOk = titleNorm ? guardCommercialUserFacingText(titleNorm, 8) || titleNorm : "";
  const title = titleOk || (categoryLabel ? categoryLabel : undefined);
  return {
    ...(title ? { title: sanitizeText(title, { maxLength: 160 }) } : {}),
    text: sanitizeText(textClean, { maxLength: 500 }),
    ...(categoryLabel && safeString(obj.title).trim() ? { categoryLabel } : {}),
  };
}

function buildClarificationsFromItems(items: unknown[]): PdfClarification[] {
  return normalizeList(items, (item) => clarificationFromOfferAssumptionItem(item));
}

function buildLegalSignalsItems(rj: Record<string, unknown>): PdfLegalSignalItem[] {
  const rows = normalizeLegalSignalsForReport(rj.legalSignals, 3);
  return rows.map((r) => ({
    title: sanitizeText(r.title, { maxLength: 200 }),
    summary: sanitizeText(r.summary, { maxLength: 420 }),
    ...(r.severityLabel ? { severityLabel: r.severityLabel } : {}),
    ...(r.recommendation ? { recommendation: sanitizeText(r.recommendation, { maxLength: 400 }) } : {}),
  }));
}

type RawFinding = {
  category?: string;
  title?: string;
  detail?: string;
  severity?: string;
  penalty?: number;
  user_hint?: string | null;
  user_hints?: string[];
};

function severityRankSeverity(sev: string | undefined): number {
  const s = (sev || "").toLowerCase();
  if (s === "high") return 0;
  if (s === "medium") return 1;
  if (s === "low") return 2;
  return 3;
}

function severityLabelDe(sev: string | undefined): string | undefined {
  const s = (sev || "").toLowerCase();
  if (s === "high") return "Hohes Einzelrisiko";
  if (s === "medium") return "Mittleres Einzelrisiko";
  if (s === "low") return "Niedriges Einzelrisiko";
  return undefined;
}

function buildTopRisksItems(rj: Record<string, unknown>): PdfTopRiskItem[] {
  const scoreResult =
    rj.scoreResult != null && typeof rj.scoreResult === "object" ? (rj.scoreResult as Record<string, unknown>) : {};
  const findingsSorted = Array.isArray(scoreResult.findingsSorted) ? (scoreResult.findingsSorted as RawFinding[]) : [];
  if (findingsSorted.length === 0) return [];

  const sorted = [...findingsSorted].sort((a, b) => {
    const sr = severityRankSeverity(a.severity) - severityRankSeverity(b.severity);
    if (sr !== 0) return sr;
    const pa = typeof a.penalty === "number" && !Number.isNaN(a.penalty) ? a.penalty : 0;
    const pb = typeof b.penalty === "number" && !Number.isNaN(b.penalty) ? b.penalty : 0;
    return pb - pa;
  });

  const out: PdfTopRiskItem[] = [];
  for (const f of sorted.slice(0, 8)) {
    const titleRaw =
      safeString(f.title) ||
      safeString((f as { text?: string }).text) ||
      "Risiko";
    const title = sanitizeText(stripScoringEngineeringJargon(titleRaw), { maxLength: 200, stripTechnical: false }).trim();
    if (!title) continue;
    const catKey = f.category ? String(f.category).trim() : "";
    const cat = catKey ? CATEGORY_LABELS[catKey] ?? catKey.replace(/_/g, " ") : undefined;
    const detail = safeString(f.detail);
    const detailSanRaw = detail ? stripScoringEngineeringJargon(detail) : "";
    const detailSan = detailSanRaw
      ? sanitizeText(detailSanRaw, { maxLength: 400, stripTechnical: false }).trim()
      : undefined;
    const sevHint = severityLabelDe(f.severity);
    const pruefHinweise = collectPruefHinweiseFromFinding(f);
    out.push({
      title,
      ...(cat ? { categoryLabel: cat } : {}),
      ...(detailSan && detailSan.length > 0 ? { detail: detailSan } : {}),
      ...(sevHint ? { severityHint: sevHint } : {}),
      ...(pruefHinweise.length > 0 ? { pruefHinweise } : {}),
    });
  }
  return out;
}

function isHighPriority(priority: unknown): boolean {
  if (priority == null) return false;
  if (typeof priority === "number") return priority <= 1;
  const s = String(priority).toLowerCase().trim();
  if (s === "1" || s === "p1") return true;
  return s.includes("hoch") || s === "high" || s === "kritisch";
}

/**
 * 3–5 priorisierte Handlungspunkte aus Rückfragen, Klarstellungen und Strategietexten (keine neue Analyse).
 */
function buildNextSteps(
  questions: PdfQuestion[],
  clarifications: PdfClarification[],
  claim: PdfClaimPotential | undefined
): string[] {
  const steps: string[] = [];
  const seen = new Set<string>();

  function pushUnique(s: string) {
    if (steps.length >= 5) return;
    const t = sanitizeText(s, { maxLength: 340 }).trim();
    if (!t) return;
    const key = t.toLowerCase().slice(0, 120);
    if (seen.has(key)) return;
    seen.add(key);
    steps.push(t);
  }

  if (claim?.immediateActions?.length) {
    for (const a of claim.immediateActions.slice(0, 2)) {
      pushUnique(a);
    }
  }

  const highQ = questions.filter((q) => isHighPriority(q.priority));
  for (const q of highQ.slice(0, 2)) {
    const line = q.title ? `${q.title}: ${q.text}` : q.text;
    pushUnique(`Vor Angebotsabgabe schriftlich beim Auftraggeber klären: ${line}`);
  }

  for (const q of questions) {
    if (steps.length >= 5) break;
    if (highQ.includes(q)) continue;
    const line = q.title ? `${q.title}: ${q.text}` : q.text;
    pushUnique(`Rückfrage vorbereiten und Termin mit AG/Planung abstimmen: ${line}`);
  }

  for (const c of clarifications.slice(0, 2)) {
    if (steps.length >= 5) break;
    const line = c.title ? `${c.title}: ${c.text}` : c.text;
    pushUnique(`Im Angebotsanschreiben und LV-Zuordnung als vertragliche Annahme festhalten: ${line}`);
  }

  if (claim?.finalRecommendation && steps.length < 5) {
    const fr = claim.finalRecommendation;
    const firstSentence = fr.split(/(?<=[.!?])\s+/)[0]?.trim() || fr.slice(0, 240).trim();
    if (firstSentence) pushUnique(firstSentence);
  }

  if (claim?.topNegotiationPoints?.length) {
    for (const n of claim.topNegotiationPoints.slice(0, 2)) {
      if (steps.length >= 5) break;
      pushUnique(`Für Angebotsöffnung / Nachverhandlung vormerken und Positionierung vorbereiten: ${n}`);
    }
  }

  if (steps.length < 3 && claim?.topRisks?.length) {
    for (const r of claim.topRisks.slice(0, 2)) {
      if (steps.length >= 5) break;
      pushUnique(`Im Angebot und Leistungsbeschreibung konkretisieren oder vor Abgabe schriftlich klären: ${r}`);
    }
  }

  return steps.slice(0, 5);
}

function buildDisclaimer(raw: Record<string, unknown>, rj: Record<string, unknown>): PdfDisclaimer {
  const text = safeString(rj.pdfDisclaimer ?? raw.pdfDisclaimer);
  return { text: text || DEFAULT_DISCLAIMER };
}

function safeString(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  return s.trim();
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
