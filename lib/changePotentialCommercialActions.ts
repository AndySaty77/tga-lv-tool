/**
 * Ableitung kommerzieller Maßnahmen aus ChangePotentialItems.
 * Rückfragen, Angebotsklarstellungen, Kalkulationshinweise, Claim-Monitoring.
 * Quellenbezug (itemId, sourceType, sourceQuote, sourcePath) wird erhalten.
 */

import type {
  ChangePotentialSummary,
  ChangePotentialItem,
  ChangePotentialSourceType,
  ChangePotentialRecommendedAction,
} from "./changePotentialModel";

// ================= Output-Typen =================

export type CommercialQuestion = {
  id: string;
  question: string;
  reason: string;
  severity: "low" | "medium" | "high";
  itemId: string;
  sourceType?: ChangePotentialSourceType;
  sourcePath?: string;
  sourceQuote?: string;
  fieldType?: string;
  changeMechanism?: string;
};

export type CommercialClarification = {
  id: string;
  clarification: string;
  reason: string;
  severity: "low" | "medium" | "high";
  itemId: string;
  sourceType?: ChangePotentialSourceType;
  sourcePath?: string;
  sourceQuote?: string;
  fieldType?: string;
  changeMechanism?: string;
};

export type CommercialPricingHint = {
  id: string;
  hint: string;
  reason: string;
  itemId: string;
  sourceType?: ChangePotentialSourceType;
  sourceQuote?: string;
  fieldType?: string;
};

export type CommercialMonitoringHint = {
  id: string;
  hint: string;
  reason: string;
  itemId: string;
  sourceType?: ChangePotentialSourceType;
  sourceQuote?: string;
  fieldType?: string;
};

export type CommercialActionsFromChangePotential = {
  questions: CommercialQuestion[];
  clarifications: CommercialClarification[];
  pricingHints: CommercialPricingHint[];
  monitoringHints: CommercialMonitoringHint[];
};

// ================= Hilfen =================

function impactToSeverity(impact: string): "low" | "medium" | "high" {
  if (impact === "sehr_hoch" || impact === "hoch") return "high";
  if (impact === "mittel") return "medium";
  return "low";
}

let _actionIdCounter = 0;
function nextActionId(prefix: string): string {
  _actionIdCounter += 1;
  return `cpa_${prefix}_${_actionIdCounter}`;
}

/** Normalisierung für Ähnlichkeitsvergleich (Trim, Kleinbuchstaben, Reduktion mehrfacher Leerzeichen). */
export function normalizeForCompare(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Wort-Überlappung 0..1 (Jaccard-ähnlich auf Wörtern > 2 Zeichen). */
export function textSimilarity(a: string, b: string): number {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (na === nb) return 1;
  const wordsA = new Set(na.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size, 1);
}

/** Dubletten in einer Liste zusammenführen: sehr ähnliche Texte mergen, erste/beste behalten. */
function dedupeBySimilarity<T extends { id: string }>(
  items: T[],
  getText: (t: T) => string,
  threshold = 0.72
): T[] {
  const out: T[] = [];
  for (const it of items) {
    const text = getText(it);
    const existing = out.find((e) => textSimilarity(getText(e), text) >= threshold);
    if (existing) continue;
    out.push(it);
  }
  return out;
}

// ================= Ableitung aus Items =================

function deriveFromItem(item: ChangePotentialItem): Partial<CommercialActionsFromChangePotential> {
  const action = item.recommendedAction;
  const severity = impactToSeverity(item.impactLevel);
  const base = {
    itemId: item.id,
    sourceType: item.sourceType,
    sourcePath: item.sourcePath,
    sourceQuote: item.sourceQuote,
    fieldType: item.fieldType,
    changeMechanism: item.changeMechanism,
  };

  const result: Partial<CommercialActionsFromChangePotential> = {};

  if (action === "rueckfrage") {
    const question = (item.questionDraft ?? item.reasoning ?? item.title ?? "").trim();
    if (question) {
      result.questions = [
        {
          id: nextActionId("q"),
          question,
          reason: item.reasoning ?? item.title ?? "",
          severity,
          ...base,
        },
      ];
    }
  } else if (action === "angebotsklarstellung") {
    const clarification = (item.clarificationDraft ?? item.reasoning ?? item.title ?? "").trim();
    if (clarification) {
      result.clarifications = [
        {
          id: nextActionId("c"),
          clarification,
          reason: item.reasoning ?? item.title ?? "",
          severity,
          ...base,
        },
      ];
    }
  } else if (action === "kalkulatorisch_absichern") {
    const hint = (item.pricingHint ?? item.reasoning ?? item.title ?? "").trim();
    if (hint) {
      result.pricingHints = [
        {
          id: nextActionId("p"),
          hint,
          reason: item.reasoning ?? item.title ?? "",
          ...base,
        },
      ];
    }
  } else if (action === "claim_feld_beobachten") {
    const hint = (item.reasoning ?? item.title ?? "").trim();
    if (hint) {
      result.monitoringHints = [
        {
          id: nextActionId("m"),
          hint: item.title ?? hint,
          reason: hint,
          ...base,
        },
      ];
    }
  }
  // "nicht_verfolgen" → nichts ableiten (nur intern kennzeichnen, hier kein Eintrag)

  return result;
}

/**
 * Leitet aus der neuen Nachtragspotenzial-Engine kommerzielle Maßnahmen ab.
 * Bevorzugt questionDraft, clarificationDraft, pricingHint; Fallback reasoning/title.
 * Deduplizierung: sehr ähnliche Texte werden zusammengeführt.
 */
export function deriveCommercialActionsFromChangePotential(
  summary: ChangePotentialSummary | null | undefined
): CommercialActionsFromChangePotential {
  _actionIdCounter = 0;
  const questions: CommercialQuestion[] = [];
  const clarifications: CommercialClarification[] = [];
  const pricingHints: CommercialPricingHint[] = [];
  const monitoringHints: CommercialMonitoringHint[] = [];

  if (!summary?.items?.length) {
    return { questions, clarifications, pricingHints, monitoringHints };
  }

  for (const item of summary.items) {
    const derived = deriveFromItem(item);
    if (derived.questions) questions.push(...derived.questions);
    if (derived.clarifications) clarifications.push(...derived.clarifications);
    if (derived.pricingHints) pricingHints.push(...derived.pricingHints);
    if (derived.monitoringHints) monitoringHints.push(...derived.monitoringHints);
  }

  return {
    questions: dedupeBySimilarity(questions, (q) => q.question),
    clarifications: dedupeBySimilarity(clarifications, (c) => c.clarification),
    pricingHints: dedupeBySimilarity(pricingHints, (p) => p.hint),
    monitoringHints: dedupeBySimilarity(monitoringHints, (m) => m.hint),
  };
}

/**
 * Prüft, ob eine Trigger-basierte Frage mit einer CP-Frage inhaltlich nahezu identisch ist.
 * Nur echte Dubletten (hohe Überschneidung): mittelschwere inhaltliche Nähe reicht nicht,
 * damit starke Einzelthemen (z. B. Hebeanlage) nicht mit einer generischen CP-Rückfrage verdrängt werden.
 */
export function isSimilarToExistingQuestion(
  newQuestionText: string,
  existingQuestions: Array<{ question: string }>,
  threshold = 0.9
): boolean {
  const norm = normalizeForCompare(newQuestionText);
  if (norm.length < 24) return false;
  for (const eq of existingQuestions) {
    const o = normalizeForCompare(eq.question);
    if (o.length < 24) continue;
    if (textSimilarity(eq.question, norm) >= threshold) return true;
  }
  return false;
}

/**
 * Prüft, ob eine Trigger-Klarstellung mit einer CP-Klarstellung nahezu identisch ist.
 */
export function isSimilarToExistingClarification(
  newClarificationText: string,
  existingClarifications: Array<{ clarification?: string; assumption?: string }>,
  threshold = 0.9
): boolean {
  const norm = normalizeForCompare(newClarificationText);
  if (norm.length < 28) return false;
  for (const ec of existingClarifications) {
    const text = (ec.clarification ?? ec.assumption ?? "").trim();
    if (text.length < 28) continue;
    if (text && textSimilarity(text, norm) >= threshold) return true;
  }
  return false;
}
