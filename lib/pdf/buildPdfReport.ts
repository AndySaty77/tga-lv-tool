/**
 * Baut aus Rohdaten (Analyse-Result / result_json + Lauf-Metadaten) ein stabiles AnalysisPdfReport.
 * Defensiv: keine Crashes bei fehlenden Feldern, Arrays normalisiert, leere Strings bereinigt.
 * Keine Debug-Felder oder technischen Rohdaten ins PDF-Modell.
 */

import type {
  AnalysisPdfReport,
  PdfCategoryScore,
  PdfClaimPotential,
  PdfClarification,
  PdfDisclaimer,
  PdfReportMeta,
  PdfQuestion,
  PdfSummary,
} from "./pdfTypes";
import {
  emptyFallback,
  formatDateDE,
  normalizeList,
  normalizeStringList,
  sanitizeText,
  scoreToTrafficLight,
} from "./pdfFormatters";

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
};

const DEFAULT_DISCLAIMER =
  "Dieser Bericht wurde automatisch aus der LV-Analyse erzeugt. Er dient der Unterstützung und ersetzt keine fachliche Prüfung.";

/**
 * Roh-Input: entweder komplette Analyse-Zeile (inkl. result_json, management_summary, created_at, project_name, file_name, score)
 * oder ein Objekt mit result_json/resultJson und optional meta-Feldern.
 */
export function buildPdfReport(input: unknown): AnalysisPdfReport {
  if (input == null || typeof input !== "object") {
    return getEmptyReport();
  }

  const raw = input as Record<string, unknown>;
  const resultJson = raw.result_json ?? raw.resultJson;
  const rj =
    resultJson != null && typeof resultJson === "object" ? (resultJson as Record<string, unknown>) : {};

  const meta = buildMeta(raw, rj);
  const summary = buildSummary(raw, rj);
  const categoryScores = buildCategoryScores(rj);
  const claimPotential = buildClaimPotential(rj);
  const questions = buildQuestions(rj);
  const clarifications = buildClarifications(rj);
  const disclaimer = buildDisclaimer(raw, rj);

  return {
    meta,
    summary,
    categoryScores,
    ...(claimPotential && Object.keys(claimPotential).length > 0 ? { claimPotential } : {}),
    ...(questions.length > 0 ? { questions } : {}),
    ...(clarifications.length > 0 ? { clarifications } : {}),
    disclaimer,
  };
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

  const projectName = safeString(raw.project_name ?? raw.projectName);
  const sourceFileName = safeString(raw.file_name ?? raw.fileName);
  const keyFacts = rj.keyFacts != null && typeof rj.keyFacts === "object" ? (rj.keyFacts as Record<string, unknown>) : {};
  const projectType = safeString(keyFacts.projektart ?? keyFacts.gewerk ?? keyFacts.bauvorhaben);
  const companyName = safeString(keyFacts.bauherr_ag ?? keyFacts.planer);

  return {
    ...(projectName ? { projectName } : {}),
    ...(sourceFileName ? { sourceFileName } : {}),
    analyzedAt,
    ...(projectType ? { projectType } : {}),
    ...(companyName ? { companyName } : {}),
  };
}

function buildSummary(raw: Record<string, unknown>, rj: Record<string, unknown>): PdfSummary {
  const managementSummary = safeString(raw.management_summary ?? raw.managementSummary);
  const scoreResult = rj.scoreResult != null && typeof rj.scoreResult === "object" ? (rj.scoreResult as Record<string, unknown>) : {};
  const changeOrder = rj.changeOrderAnalysis != null && typeof rj.changeOrderAnalysis === "object" ? (rj.changeOrderAnalysis as Record<string, unknown>) : {};
  const offerSummary = changeOrder.offerStrategySummary != null && typeof changeOrder.offerStrategySummary === "object"
    ? (changeOrder.offerStrategySummary as Record<string, unknown>)
    : {};

  const executiveSummary =
    managementSummary ||
    safeString(offerSummary.executiveSummary) ||
    undefined;

  const totalScore = numberOrNull(raw.score ?? scoreResult.total);
  const level = safeString(scoreResult.level);
  const totalRiskLabel = level ? levelToRiskLabel(level) : totalScore != null ? scoreToRiskLabel(totalScore) : undefined;

  const clarificationQuestions = Array.isArray(rj.clarificationQuestions) ? rj.clarificationQuestions : [];
  const offerAssumptions = Array.isArray(rj.offerAssumptions) ? rj.offerAssumptions : [];

  return {
    ...(executiveSummary ? { executiveSummary } : {}),
    ...(totalScore != null ? { totalScore } : {}),
    ...(totalRiskLabel ? { totalRiskLabel } : {}),
    ...(clarificationQuestions.length > 0 ? { questionCount: clarificationQuestions.length } : {}),
    ...(offerAssumptions.length > 0 ? { clarificationCount: offerAssumptions.length } : {}),
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

function buildClaimPotential(rj: Record<string, unknown>): PdfClaimPotential | undefined {
  const changeOrder = rj.changeOrderAnalysis != null && typeof rj.changeOrderAnalysis === "object"
    ? (rj.changeOrderAnalysis as Record<string, unknown>)
    : {};
  const offerSummary = changeOrder.offerStrategySummary != null && typeof changeOrder.offerStrategySummary === "object"
    ? (changeOrder.offerStrategySummary as Record<string, unknown>)
    : {};
  const opportunities = Array.isArray(changeOrder.opportunities) ? changeOrder.opportunities : [];
  const scoreResult = rj.scoreResult != null && typeof rj.scoreResult === "object" ? (rj.scoreResult as Record<string, unknown>) : {};
  const findingsSorted = Array.isArray(scoreResult.findingsSorted) ? scoreResult.findingsSorted : [];

  const executiveSummary = sanitizeText(offerSummary.executiveSummary);
  const topRisks = normalizeStringList(findingsSorted, 5).map((t) => sanitizeText(t, { maxLength: 200 }));
  const topNegotiationPoints = normalizeStringList(
    opportunities.map((o) => (o as { title?: string; summary?: string }).title ?? (o as { summary?: string }).summary),
    5
  ).map((t) => sanitizeText(t, { maxLength: 200 }));
  const immediateActions = normalizeStringList(offerSummary.immediateActions, 5);
  const finalRecommendation = sanitizeText(offerSummary.finalRecommendation ?? offerSummary.recommendation);

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

function buildQuestions(rj: Record<string, unknown>): PdfQuestion[] {
  const clarificationQuestions = Array.isArray(rj.clarificationQuestions) ? rj.clarificationQuestions : [];
  return normalizeList(clarificationQuestions, (item) => {
    if (item == null) return null;
    const obj = item as { question?: string; text?: string; title?: string; priority?: string | number };
    const text =
      safeString(obj.question) || safeString(obj.text) || safeString(obj.title) || String(item).trim();
    if (!text) return null;
    return {
      ...(safeString(obj.title) ? { title: obj.title!.trim() } : {}),
      text: sanitizeText(text, { maxLength: 500 }),
      ...(obj.priority != null ? { priority: obj.priority } : {}),
    };
  });
}

function buildClarifications(rj: Record<string, unknown>): PdfClarification[] {
  const offerAssumptions = Array.isArray(rj.offerAssumptions) ? rj.offerAssumptions : [];
  return normalizeList(offerAssumptions, (item) => {
    if (item == null) return null;
    const obj = item as { assumption?: string; text?: string; title?: string };
    const text = safeString(obj.assumption) || safeString(obj.text) || safeString(obj.title) || String(item).trim();
    if (!text) return null;
    return {
      ...(safeString(obj.title) ? { title: obj.title!.trim() } : {}),
      text: sanitizeText(text, { maxLength: 500 }),
    };
  });
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
