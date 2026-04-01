/**
 * Baut aus Rohdaten (Analyse-Result / result_json + Lauf-Metadaten) ein stabiles AnalysisPdfReport.
 * Defensiv: keine Crashes bei fehlenden Feldern, Arrays normalisiert, leere Strings bereinigt.
 * Keine Debug-Felder oder technischen Rohdaten ins PDF-Modell.
 */

import { getAnalysisDisplayTitle } from "@/lib/analysisDisplayTitle";
import { KEYFACT_LABELS } from "@/lib/keyFactsDefinition";
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
  sanitizeText,
  scoreToTrafficLight,
  stripScoringEngineeringJargon,
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
  kalkulation: "Kalkulation",
};

const DEFAULT_DISCLAIMER =
  "Dieser Bericht wurde automatisch aus der LV-Analyse erzeugt. Er dient der Unterstützung und ersetzt keine fachliche Prüfung.";

function flattenByGroup(byGroup: Record<string, unknown[]> | undefined): unknown[] {
  if (!byGroup || typeof byGroup !== "object") return [];
  const flat: unknown[] = [];
  for (const arr of Object.values(byGroup) as unknown[]) {
    if (Array.isArray(arr)) for (const item of arr) flat.push(item);
  }
  return flat;
}

/**
 * Gespeicherte Analysen nutzen oft `{ questions, byGroup }` statt eines flachen Arrays.
 * Wichtig: `questions` kann leer sein, während `byGroup` die eigentlichen Einträge enthält.
 */
function extractClarificationQuestionsArray(rj: Record<string, unknown>): unknown[] {
  const raw = rj.clarificationQuestions ?? rj.clarification_questions;
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const o = raw as { questions?: unknown[]; byGroup?: Record<string, unknown[]> };
    const fromGroup = flattenByGroup(o.byGroup);
    if (Array.isArray(o.questions) && o.questions.length > 0) return o.questions;
    if (fromGroup.length > 0) return fromGroup;
    if (Array.isArray(o.questions)) return o.questions;
  }
  return [];
}

/** Analog: `{ assumptions, byGroup }` aus Angebotsklarstellungen. */
function extractOfferAssumptionItems(rj: Record<string, unknown>): unknown[] {
  const raw = rj.offerAssumptions ?? rj.offer_assumptions;
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const o = raw as { assumptions?: unknown[]; byGroup?: Record<string, unknown[]> };
    const fromGroup = flattenByGroup(o.byGroup);
    if (Array.isArray(o.assumptions) && o.assumptions.length > 0) return o.assumptions;
    if (fromGroup.length > 0) return fromGroup;
    if (Array.isArray(o.assumptions)) return o.assumptions;
  }
  return [];
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
  return out;
}

/**
 * Roh-Input: entweder komplette Analyse-Zeile (inkl. result_json, management_summary, created_at, project_name, file_name, score)
 * oder ein Objekt mit result_json/resultJson und optional meta-Feldern.
 */
export function buildPdfReport(input: unknown): AnalysisPdfReport {
  if (input == null || typeof input !== "object") {
    return getEmptyReport();
  }

  const raw = input as Record<string, unknown>;
  const rj = mergeResultJsonWithTopLevel(raw);

  const meta = buildMeta(raw, rj);
  const summary = buildSummary(raw, rj);
  const categoryScores = buildCategoryScores(rj);
  const keyFacts = buildKeyFactRows(rj);
  const claimPotential = buildClaimPotential(rj);
  const questions = buildQuestions(rj);
  const clarifications = buildClarifications(rj);
  const topRisks = buildTopRisksItems(rj);
  const nextSteps = buildNextSteps(questions, clarifications, claimPotential);
  const disclaimer = buildDisclaimer(raw, rj);

  return {
    meta,
    summary,
    categoryScores,
    ...(keyFacts.length > 0 ? { keyFacts } : {}),
    ...(nextSteps.length > 0 ? { nextSteps } : {}),
    ...(topRisks.length > 0 ? { topRisks } : {}),
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

  const pn = safeString(raw.project_name ?? raw.projectName);
  const fn = safeString(raw.file_name ?? raw.fileName);
  const projectName = getAnalysisDisplayTitle(pn || null, fn || null);
  const sourceFileName = safeString(raw.file_name ?? raw.fileName);
  const keyFacts = rj.keyFacts != null && typeof rj.keyFacts === "object" ? (rj.keyFacts as Record<string, unknown>) : {};
  const projectType = safeString(keyFacts.projektart ?? keyFacts.gewerk ?? keyFacts.bauvorhaben);
  const companyName = safeString(keyFacts.bauherr_ag ?? keyFacts.planer);

  return {
    projectName,
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

  /** Gleiche Priorität wie gespeicherte Ansicht: Offer-Strategie zuerst, dann DB-Template. */
  const executiveSummary =
    safeString(offerSummary.executiveSummary) ||
    managementSummary ||
    undefined;

  const totalScore = numberOrNull(raw.score ?? scoreResult.total);
  const level = safeString(scoreResult.level);
  const totalRiskLabel = level ? levelToRiskLabel(level) : totalScore != null ? scoreToRiskLabel(totalScore) : undefined;

  const nQuestions = extractClarificationQuestionsArray(rj).length;
  const nAssumptions = extractOfferAssumptionItems(rj).length;

  return {
    ...(executiveSummary ? { executiveSummary } : {}),
    ...(totalScore != null ? { totalScore } : {}),
    ...(totalRiskLabel ? { totalRiskLabel } : {}),
    ...(nQuestions > 0 ? { questionCount: nQuestions } : {}),
    ...(nAssumptions > 0 ? { clarificationCount: nAssumptions } : {}),
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
  const topRisks = normalizeStringList(findingsSorted, 5)
    .map((t) => sanitizeText(stripScoringEngineeringJargon(t), { maxLength: 200, stripTechnical: false }))
    .filter((t) => t.trim().length > 0);
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

function isMeaningfulKeyFactValue(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (!t) return false;
  if (/^nicht erkannt/i.test(t)) return false;
  if (/^(n\/a|k\.a\.)$/i.test(t)) return false;
  if (/^\[debug\]/i.test(t)) return false;
  if (t === "-") return false;
  return true;
}

function prettyKeyFactLabel(k: string): string {
  const fromMap = KEYFACT_LABELS[k];
  if (fromMap) return fromMap;
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildKeyFactRows(rj: Record<string, unknown>): PdfKeyFactRow[] {
  const keyFacts = rj.keyFacts != null && typeof rj.keyFacts === "object" ? (rj.keyFacts as Record<string, unknown>) : {};
  const rows: PdfKeyFactRow[] = [];
  for (const [k, v] of Object.entries(keyFacts)) {
    if (!isMeaningfulKeyFactValue(v)) continue;
    rows.push({
      label: prettyKeyFactLabel(k),
      value: String(v).trim(),
    });
  }
  rows.sort((a, b) => a.label.localeCompare(b.label, "de"));
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

function buildQuestions(rj: Record<string, unknown>): PdfQuestion[] {
  const clarificationQuestions = extractClarificationQuestionsArray(rj);
  return normalizeList(clarificationQuestions, (item) => {
    if (item == null) return null;
    const obj = item as {
      question?: string;
      reason?: string;
      text?: string;
      title?: string;
      priority?: string | number;
      severity?: string;
      category?: string;
    };
    const text =
      safeString(obj.question) ||
      safeString(obj.reason) ||
      safeString(obj.text) ||
      safeString(obj.title) ||
      String(item).trim();
    if (!text) return null;
    const catKey = obj.category ? String(obj.category).trim() : "";
    const categoryLabel = catKey ? CATEGORY_LABELS[catKey] ?? catKey.replace(/_/g, " ") : undefined;
    const priority =
      obj.priority != null ? obj.priority : obj.severity != null ? severityToReadablePriority(obj.severity) : undefined;
    return {
      ...(safeString(obj.title) ? { title: obj.title!.trim() } : {}),
      text: sanitizeText(text, { maxLength: 500 }),
      ...(priority != null ? { priority } : {}),
      ...(categoryLabel ? { categoryLabel } : {}),
    };
  });
}

function clarificationFromOfferAssumptionItem(item: unknown): PdfClarification | null {
  if (item == null) return null;
  const obj = item as { assumption?: string; text?: string; title?: string; reason?: string; category?: string };
  const text =
    safeString(obj.assumption) ||
    safeString(obj.text) ||
    safeString(obj.reason) ||
    safeString(obj.title) ||
    (typeof item === "string" ? item.trim() : "");
  if (!text) return null;
  const catKey = typeof obj.category === "string" && obj.category.trim() ? obj.category.trim() : "";
  const categoryLabel = catKey ? CATEGORY_LABELS[catKey] ?? catKey.replace(/_/g, " ") : "";
  const explicitTitle = safeString(obj.title);
  const title = explicitTitle || categoryLabel;
  return {
    ...(title ? { title } : {}),
    text: sanitizeText(text, { maxLength: 500 }),
    ...(categoryLabel && explicitTitle ? { categoryLabel } : {}),
  };
}

function buildClarifications(rj: Record<string, unknown>): PdfClarification[] {
  const items = extractOfferAssumptionItems(rj);
  return normalizeList(items, (item) => clarificationFromOfferAssumptionItem(item));
}

type RawFinding = {
  category?: string;
  title?: string;
  detail?: string;
  severity?: string;
  penalty?: number;
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
    out.push({
      title,
      ...(cat ? { categoryLabel: cat } : {}),
      ...(detailSan && detailSan.length > 0 ? { detail: detailSan } : {}),
      ...(sevHint ? { severityHint: sevHint } : {}),
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
