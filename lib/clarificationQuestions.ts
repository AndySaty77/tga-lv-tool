/**
 * Rückfragen-Generator für Bieterfragen / Klarstellungen.
 * Regelbasiert; LLM nur optional für Umformulierung.
 * Optional: ChangePotentialSummary → CP-Rückfragen werden abgeleitet und mit Trigger-Fragen zusammengeführt (CP bevorzugt).
 */

import {
  buildClarificationFallbackFinding,
  buildClarificationFromHint,
  buildClarificationFromPlainText,
  buildClarificationHeadline,
  extractClarifyPointsFromHint,
  primaryUserHintFromFinding,
  type ClarificationItem,
  type FindingLike,
} from "./commercialCopyFromHints";
import {
  deriveCommercialActionsFromChangePotential,
  isSimilarToExistingQuestion,
} from "./changePotentialCommercialActions";
import {
  collapseSpecialtyBuckets,
  dedupeClarificationQuestionItems,
  guardCommercialUserFacingText,
  normalizeQuestionTitleForDisplay,
} from "./commercialOutputNormalize";
import type { ChangePotentialSummary } from "./changePotentialModel";
import { KEYFACT_LABELS } from "./keyFactsDefinition";

export type { ClarificationItem } from "./commercialCopyFromHints";

export type ScoreCategory =
  | "vertrags_lv_risiken"
  | "mengen_massenermittlung"
  | "technische_vollstaendigkeit"
  | "schnittstellen_nebenleistungen"
  | "kalkulationsunsicherheit";

/**
 * Strukturierte Rückfrage inkl. Gruppierung (category) und Rückwärtskompatibilität:
 * `reason` entspricht `why`, `sourceTextSnippet` spiegelt ggf. `expert.snippet`.
 */
export type ClarificationQuestion = ClarificationItem & {
  category: ScoreCategory;
  sourceFindingId?: string;
  sourceTextSnippet?: string;
  sourceKeyFact?: string;
  sourceChangePotentialItemId?: string;
  /** Alias für `why` (bestehende Clients). */
  reason: string;
};

export type QuestionGroup = "technisch" | "vertraglich" | "terminlich";

export type ClarificationInput = {
  findings: Array<{
    id: string;
    category: string;
    title: string;
    detail?: string;
    severity: string;
    penalty?: number;
    user_hint?: string | null;
    user_hints?: string[] | null;
    raw_excerpt?: string | null;
  }>;
  riskClauses?: Array<{
    type: string;
    riskLevel: string;
    text: string;
    interpretation: string;
    confidence?: number;
  }>;
  keyFacts?: Record<string, string>;
  /** Optional: Nachtragspotenzial-Summary; wenn gesetzt, werden CP-Rückfragen abgeleitet und mit Trigger-Fragen zusammengeführt (CP bevorzugt bei Duplikaten). */
  changePotentialSummary?: ChangePotentialSummary;
};

export type ClarificationOutput = {
  questions: ClarificationQuestion[];
  byGroup: Record<QuestionGroup, ClarificationQuestion[]>;
  debug: Array<{ source: string; sourceId?: string; questionId: string; question: string }>;
};

const CATEGORY_TO_GROUP: Record<string, QuestionGroup> = {
  technische_vollstaendigkeit: "technisch",
  mengen_massenermittlung: "technisch",
  schnittstellen_nebenleistungen: "technisch",
  vertrags_lv_risiken: "vertraglich",
  kalkulationsunsicherheit: "vertraglich",
};

const MISSING_KEYFACT_GROUPS: Record<string, QuestionGroup> = {
  baubeginn: "terminlich",
  bauzeit: "terminlich",
  fertigstellung: "terminlich",
  ausfuehrungsfrist: "terminlich",
  ausfuehrungszeit: "terminlich",
  fristAngebot: "terminlich",
  bindefrist: "terminlich",
  submission_einreichung: "terminlich",
  vertragsgrundlagen: "vertraglich",
  vertragsstrafe: "vertraglich",
  gewaerhleistung: "vertraglich",
  wartung_instandhaltung: "vertraglich",
  vob_bgb: "vertraglich",
  zahlungsbedingungen: "vertraglich",
  abschlagszahlung: "vertraglich",
  schlussrechnung: "vertraglich",
  preisgleitung: "vertraglich",
  bauvorhaben: "technisch",
  ort: "technisch",
  gewerk: "technisch",
  bauherr_ag: "vertraglich",
  planer: "vertraglich",
  rangfolge: "vertraglich",
};

const IMPORTANT_KEYFACTS = [
  "baubeginn",
  "bauzeit",
  "fertigstellung",
  "ausfuehrungsfrist",
  "fristAngebot",
  "vertragsgrundlagen",
  "gewaerhleistung",
  "zahlungsbedingungen",
  "schlussrechnung",
  "bauvorhaben",
  "ort",
  "gewerk",
];

function normalizeCategory(cat: string): ScoreCategory {
  const c = String(cat ?? "").trim();
  const valid: ScoreCategory[] = [
    "vertrags_lv_risiken",
    "mengen_massenermittlung",
    "technische_vollstaendigkeit",
    "schnittstellen_nebenleistungen",
    "kalkulationsunsicherheit",
  ];
  if (valid.includes(c as ScoreCategory)) return c as ScoreCategory;
  return "vertrags_lv_risiken";
}

function normalizeSeverity(sev: string): "low" | "medium" | "high" {
  const s = String(sev ?? "").toLowerCase();
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}

function snippet(text: string, maxLen = 120): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `cq_${prefix}_${idCounter}_${Date.now().toString(36)}`;
}

function fieldTypeToCategory(fieldType?: string): ScoreCategory {
  if (!fieldType) return "vertrags_lv_risiken";
  if (fieldType === "schnittstelle" || fieldType === "nebenleistung" || fieldType === "mengenrisiko") return "schnittstellen_nebenleistungen";
  if (fieldType === "bestand_erschwernis" || fieldType === "bauablauf" || fieldType === "provisorium") return "technische_vollstaendigkeit";
  return "vertrags_lv_risiken";
}

/**
 * Erzeugt strukturierte Rückfragen aus Findings, Vortext-Risiken, fehlenden KeyFacts.
 * Wenn changePotentialSummary übergeben wird: CP-Rückfragen werden abgeleitet und mit Trigger-Fragen zusammengeführt (CP bevorzugt bei Duplikaten).
 */
export function generateClarificationQuestions(input: ClarificationInput): ClarificationOutput {
  idCounter = 0;
  const questions: ClarificationQuestion[] = [];
  const debug: ClarificationOutput["debug"] = [];

  const cpSummary = input.changePotentialSummary;

  if (cpSummary?.items?.length) {
    const actions = deriveCommercialActionsFromChangePotential(cpSummary);
    for (const q of actions.questions) {
      const cat = fieldTypeToCategory(q.fieldType);
      const title =
        buildClarificationHeadline(q.question, "Nachtragspotenzial", cat).trim() || "Nachtragspotenzial";
      const cpPoints = extractClarifyPointsFromHint(q.question, title, "Nachtragspotenzial", cat);
      const base = buildClarificationFromPlainText({
        id: q.id,
        severity: q.severity,
        title,
        question: q.question,
        why: q.reason,
        clarifyPoints: cpPoints,
        sourceLabel: "Nachtragspotenzial",
        sourceType: "sys",
        expert: q.sourceQuote ? { snippet: q.sourceQuote } : undefined,
      });
      const cq: ClarificationQuestion = {
        ...base,
        category: cat,
        reason: base.why,
        sourceTextSnippet: q.sourceQuote,
        sourceChangePotentialItemId: q.itemId,
      };
      questions.push(cq);
      debug.push({ source: "changePotential", sourceId: q.itemId, questionId: cq.id, question: cq.question });
    }
  }

  const cpQuestionTexts = questions.map((q) => ({ question: q.question }));

  // 1) Aus Trigger-Findings (nur wenn nicht Dublette zu CP)
  for (const f of input.findings ?? []) {
    const cat = normalizeCategory(f.category);
    const sev = normalizeSeverity(f.severity);
    const fl = f as FindingLike;
    const legalQ =
      typeof (f as { legalMeta?: { suggestedQuestion?: string } }).legalMeta?.suggestedQuestion === "string"
        ? String((f as { legalMeta?: { suggestedQuestion?: string } }).legalMeta?.suggestedQuestion ?? "").trim()
        : "";
    const hint = primaryUserHintFromFinding(fl);
    let baseItem: ClarificationItem;
    if (legalQ) {
      baseItem = buildClarificationFallbackFinding(fl, {
        id: genId("f"),
        severity: sev,
        legalQuestion: legalQ,
      });
    } else if (hint) {
      baseItem = buildClarificationFromHint(fl, { id: genId("f"), severity: sev });
    } else {
      baseItem = buildClarificationFallbackFinding(fl, {
        id: genId("f"),
        severity: sev,
      });
    }
    const skipFindingDup =
      sev !== "high" &&
      cpQuestionTexts.length > 0 &&
      isSimilarToExistingQuestion(baseItem.question, cpQuestionTexts);
    if (skipFindingDup) continue;
    const q: ClarificationQuestion = {
      ...baseItem,
      category: cat,
      sourceFindingId: f.id,
      reason: baseItem.why,
      sourceTextSnippet: baseItem.expert?.snippet?.slice(0, 500) ?? snippet(f.detail ?? ""),
    };
    questions.push(q);
    cpQuestionTexts.push({ question: q.question });
    debug.push({ source: "finding", sourceId: f.id, questionId: q.id, question: q.question });
  }

  // 2) Aus Vortext-Risiken (riskClauses) (nur wenn nicht Dublette zu CP)
  for (const r of input.riskClauses ?? []) {
    const sev = normalizeSeverity(r.riskLevel);
    const cat: ScoreCategory = "vertrags_lv_risiken";
    const label = r.type || "Vertragsklausel";
    const question =
      r.interpretation && r.interpretation.length > 20
        ? (r.interpretation.trim().startsWith("Bitte ") ? r.interpretation.trim() : `Bitte konkretisieren Sie: ${r.interpretation.trim()}`)
        : `Bitte legen Sie die Auslegung der Klausel im Einleitungstext fest (${snippet(r.text, 72)}).`;
    const riskHigh = normalizeSeverity(r.riskLevel) === "high";
    const skipRiskDup =
      !riskHigh &&
      cpQuestionTexts.length > 0 &&
      isSimilarToExistingQuestion(question, cpQuestionTexts);
    if (skipRiskDup) continue;
    const hintForTitle = (r.interpretation || "").trim();
    const title = hintForTitle.length >= 6
      ? buildClarificationHeadline(hintForTitle, label, "vertrags_lv_risiken").trim() || `Vortext: ${label}`
      : `Vortext: ${label}`;
    const base = buildClarificationFromPlainText({
      id: genId("r"),
      severity: sev,
      title,
      question,
      why: `Hinweis aus der Vortext-Analyse (${label}).`,
      clarifyPoints: extractClarifyPointsFromHint(hintForTitle, title, label, "vertrags_lv_risiken"),
      sourceLabel: label,
      sourceType: "sys",
      expert: { snippet: r.text },
    });
    const q: ClarificationQuestion = {
      ...base,
      category: cat,
      reason: base.why,
      sourceTextSnippet: snippet(r.text),
    };
    questions.push(q);
    cpQuestionTexts.push({ question: q.question });
    debug.push({ source: "riskClause", sourceId: r.type, questionId: q.id, question: q.question });
  }

  // 3) Fehlende KeyFacts (nur wichtige) (nur wenn nicht Dublette zu CP)
  const keyFacts = input.keyFacts ?? {};
  for (const key of IMPORTANT_KEYFACTS) {
    const val = (keyFacts[key] ?? "").trim();
    if (val.length < 4) {
      const group = MISSING_KEYFACT_GROUPS[key] ?? "vertraglich";
      const label = KEYFACT_LABELS[key] ?? key;
      const cat: ScoreCategory =
        group === "terminlich"
          ? "vertrags_lv_risiken"
          : group === "technisch"
            ? "technische_vollstaendigkeit"
            : "vertrags_lv_risiken";
      const question = `Bitte konkretisieren Sie ${label}: Im Vortext wurde keine ausreichend klare Angabe gefunden.`;
      if (cpQuestionTexts.length > 0 && isSimilarToExistingQuestion(question, cpQuestionTexts)) continue;
      const base = buildClarificationFromPlainText({
        id: genId("k"),
        severity: "medium",
        title: `Fehlende Angabe: ${label}`,
        question,
        why: "Ohne diese Angabe ist der Leistungs- oder Terminrahmen im Angebot unscharf.",
        clarifyPoints: [
          `Erwartete Information: ${label}.`,
          "Bitte bestätigen Sie die gültigen Werte oder verweisen Sie auf die maßgebliche Vertragsurkunde.",
        ],
        sourceLabel: label,
        sourceType: "sys",
      });
      const q: ClarificationQuestion = {
        ...base,
        category: cat,
        reason: base.why,
        sourceKeyFact: key,
      };
      questions.push(q);
      cpQuestionTexts.push({ question: q.question });
      debug.push({ source: "missingKeyFact", sourceId: key, questionId: q.id, question: q.question });
    }
  }

  const polished: ClarificationQuestion[] = questions.map((q) => {
    const qt = guardCommercialUserFacingText(q.question, 10) || q.question;
    const tt = q.title ? guardCommercialUserFacingText(q.title, 6) || q.title : q.title;
    const wy = q.why ? guardCommercialUserFacingText(q.why, 8) || q.why : q.why;
    return { ...q, question: qt, ...(tt ? { title: tt } : {}), why: wy, reason: wy };
  });

  const pass1 = dedupeClarificationQuestionItems(polished, 0.4);
  const pass2 = dedupeClarificationQuestionItems(collapseSpecialtyBuckets(pass1), 0.34);
  const deduped = dedupeClarificationQuestionItems(pass2, 0.3) as ClarificationQuestion[];

  const withTitles = deduped.map((q) => ({
    ...q,
    title: normalizeQuestionTitleForDisplay(q.title, [q.question, q.reason, q.why].filter(Boolean).join(" ")),
  }));

  const byGroup: Record<QuestionGroup, ClarificationQuestion[]> = {
    technisch: [],
    vertraglich: [],
    terminlich: [],
  };

  for (const q of withTitles) {
    let group: QuestionGroup = CATEGORY_TO_GROUP[q.category] ?? "vertraglich";
    if (q.sourceKeyFact) {
      group = MISSING_KEYFACT_GROUPS[q.sourceKeyFact] ?? group;
    }
    byGroup[group].push(q);
  }

  return { questions: withTitles, byGroup, debug };
}
