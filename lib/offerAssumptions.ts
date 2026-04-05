/**
 * Angebots-Annahmen-Generator.
 * Erzeugt Annahmen aus Findings, Rückfragen, Vortext-Risiken, KeyFacts.
 * Optional: ChangePotentialSummary → CP-Klarstellungen werden als Annahmen ergänzt (CP bevorzugt bei Duplikaten).
 * LLM optional für Textoptimierung und Plausibilität.
 */

import type { ScoreCategory, QuestionGroup } from "./clarificationQuestions";
import {
  deriveCommercialActionsFromChangePotential,
  isSimilarToExistingClarification,
} from "./changePotentialCommercialActions";
import type { ChangePotentialSummary } from "./changePotentialModel";
import { KEYFACT_LABELS } from "./keyFactsDefinition";

export type OfferAssumption = {
  id: string;
  category: ScoreCategory;
  severity: "low" | "medium" | "high";
  assumption: string;
  reason: string;
  sourceFindingId?: string;
  sourceQuestionId?: string;
  /** Aus Nachtragspotenzial-Engine (ChangePotentialItem). */
  sourceChangePotentialItemId?: string;
};

export type ClarificationQuestionInput = {
  id: string;
  category?: string;
  severity?: string;
  question: string;
  reason: string;
  sourceFindingId?: string;
  sourceKeyFact?: string;
};

export type OfferAssumptionInput = {
  findings: Array<{
    id: string;
    category: string;
    title: string;
    detail?: string;
    severity: string;
  }>;
  riskClauses?: Array<{
    type: string;
    riskLevel: string;
    text: string;
    interpretation: string;
  }>;
  keyFacts?: Record<string, string>;
  clarificationQuestions?: ClarificationQuestionInput[];
  /** Optional: Nachtragspotenzial-Summary; wenn gesetzt, werden CP-Klarstellungen als Annahmen ergänzt (CP bevorzugt bei Duplikaten). */
  changePotentialSummary?: ChangePotentialSummary;
};

export type OfferAssumptionOutput = {
  assumptions: OfferAssumption[];
  byGroup: Record<QuestionGroup, OfferAssumption[]>;
  debug: Array<{
    findingId?: string;
    questionId?: string;
    assumptionId: string;
    assumption: string;
  }>;
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

let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `oa_${prefix}_${idCounter}_${Date.now().toString(36)}`;
}

function fieldTypeToCategory(fieldType?: string): ScoreCategory {
  if (!fieldType) return "vertrags_lv_risiken";
  if (fieldType === "schnittstelle" || fieldType === "nebenleistung" || fieldType === "mengenrisiko") return "schnittstellen_nebenleistungen";
  if (fieldType === "bestand_erschwernis" || fieldType === "bauablauf" || fieldType === "provisorium") return "technische_vollstaendigkeit";
  return "vertrags_lv_risiken";
}

/**
 * Erzeugt Annahmen regelbasiert aus Findings, Rückfragen, Vortext-Risiken, KeyFacts.
 * Wenn changePotentialSummary übergeben: CP-Klarstellungen werden als Annahmen vorangestellt (CP bevorzugt bei Duplikaten).
 */
export function generateOfferAssumptions(input: OfferAssumptionInput): OfferAssumptionOutput {
  idCounter = 0;
  const assumptions: OfferAssumption[] = [];
  const debug: OfferAssumptionOutput["debug"] = [];

  if (input.changePotentialSummary?.items?.length) {
    const actions = deriveCommercialActionsFromChangePotential(input.changePotentialSummary);
    for (const c of actions.clarifications) {
      const a: OfferAssumption = {
        id: c.id,
        category: fieldTypeToCategory(c.fieldType),
        severity: c.severity,
        assumption: c.clarification,
        reason: c.reason,
        sourceChangePotentialItemId: c.itemId,
      };
      assumptions.push(a);
      debug.push({ assumptionId: a.id, assumption: a.assumption });
    }
  }

  const existingClarificationTexts = assumptions.map((a) => ({ assumption: a.assumption }));

  const questionByFindingId = new Map<string, ClarificationQuestionInput>();
  for (const q of input.clarificationQuestions ?? []) {
    if (q.sourceFindingId) questionByFindingId.set(q.sourceFindingId, q);
  }

  const questionByKeyFact = new Map<string, ClarificationQuestionInput>();
  for (const q of input.clarificationQuestions ?? []) {
    if (q.sourceKeyFact) questionByKeyFact.set(q.sourceKeyFact, q);
  }

  // 1) Aus Trigger-Findings (+ ggf. zugehörige Rückfrage) (nur wenn nicht Dublette zu CP)
  for (const f of input.findings ?? []) {
    const cat = normalizeCategory(f.category);
    const sev = normalizeSeverity(f.severity);
    const legalA =
      typeof (f as { legalMeta?: { suggestedClarification?: string } }).legalMeta?.suggestedClarification === "string"
        ? String((f as { legalMeta?: { suggestedClarification?: string } }).legalMeta?.suggestedClarification ?? "").trim()
        : "";
    const assumption = legalA
      ? legalA
      : `Wir gehen davon aus, dass die Anforderungen gemäß ${f.title} im Sinne der anerkannten Regeln der Technik ausgeführt werden, sofern keine abweichende Klarstellung erfolgt.`;
    if (existingClarificationTexts.length > 0 && isSimilarToExistingClarification(assumption, existingClarificationTexts)) continue;
    const reason = String(f.id ?? "").startsWith("LEGAL_")
      ? `Vertrags-/Vergabehinweis: ${f.title}`
      : `Finding: ${f.title}`;
    const q = questionByFindingId.get(f.id);
    const a: OfferAssumption = {
      id: genId("f"),
      category: cat,
      severity: sev,
      assumption,
      reason,
      sourceFindingId: f.id,
      sourceQuestionId: q?.id,
    };
    assumptions.push(a);
    existingClarificationTexts.push({ assumption: a.assumption });
    debug.push({
      findingId: f.id,
      questionId: q?.id,
      assumptionId: a.id,
      assumption: a.assumption,
    });
  }

  // 2) Aus Vortext-Risiken (ohne zugehöriges Finding) (nur wenn nicht Dublette zu CP)
  for (const r of input.riskClauses ?? []) {
    const sev = normalizeSeverity(r.riskLevel);
    const cat: ScoreCategory = "vertrags_lv_risiken";
    const assumption =
      r.interpretation && r.interpretation.length > 30
        ? `Wir gehen davon aus: ${r.interpretation}`
        : `Wir gehen davon aus, dass die Vertragsklausel im üblichen Sinne ausgelegt wird, sofern keine Klarstellung erfolgt.`;
    if (existingClarificationTexts.length > 0 && isSimilarToExistingClarification(assumption, existingClarificationTexts)) continue;
    const a: OfferAssumption = {
      id: genId("r"),
      category: cat,
      severity: sev,
      assumption,
      reason: `Vortext-Risiko: ${r.type || "Vertragsklausel"}`,
      sourceQuestionId: input.clarificationQuestions?.find((q) => q.reason.includes(r.type || "Vertragsklausel"))?.id,
    };
    assumptions.push(a);
    existingClarificationTexts.push({ assumption: a.assumption });
    debug.push({
      questionId: a.sourceQuestionId,
      assumptionId: a.id,
      assumption: a.assumption,
    });
  }

  // 3) Fehlende KeyFacts (nur wenn nicht Dublette zu CP)
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
      const standardAssumption: Record<string, string> = {
        baubeginn: "Baubeginn erfolgt zum vereinbarten Termin gemäß Vertragsunterlagen.",
        bauzeit: "Bauzeit entspricht den vertraglichen Vorgaben.",
        fertigstellung: "Fertigstellung/Abnahme erfolgt gemäß VOB.",
        ausfuehrungsfrist: "Ausführungsfristen entnehmen wir dem beigefügten Terminplan.",
        fristAngebot: "Angebotsfrist wird eingehalten.",
        vertragsgrundlagen: "VOB, Teile A, B und C gelten als Vertragsgrundlage.",
        gewaerhleistung: "Gewährleistung gemäß VOB/B.",
        zahlungsbedingungen: "Zahlungsbedingungen gemäß VOB/B.",
        schlussrechnung: "Schlussrechnung wird fristgerecht eingereicht.",
        bauvorhaben: "Projektbezeichnung aus Ausschreibungsunterlagen.",
        ort: "Ort/Standort aus Ausschreibungsunterlagen.",
        gewerk: "Gewerk aus Leistungsverzeichnis.",
      };
      const assumption =
        standardAssumption[key] ??
        `Wir gehen davon aus, dass ${label} gemäß den Vertragsunterlagen bzw. anerkannten Regeln gilt.`;
      if (existingClarificationTexts.length > 0 && isSimilarToExistingClarification(assumption, existingClarificationTexts)) continue;
      const q = questionByKeyFact.get(key);
      const a: OfferAssumption = {
        id: genId("k"),
        category: cat,
        severity: "medium",
        assumption,
        reason: `Fehlendes KeyFact: ${label}`,
        sourceQuestionId: q?.id,
      };
      assumptions.push(a);
      existingClarificationTexts.push({ assumption: a.assumption });
      debug.push({
        questionId: q?.id,
        assumptionId: a.id,
        assumption: a.assumption,
      });
    }
  }

  // 4) Aus Rückfragen ohne bisherige Annahme (z. B. nur aus riskClause) (nur wenn nicht Dublette zu CP)
  const assumedQuestionIds = new Set(assumptions.map((a) => a.sourceQuestionId).filter(Boolean));
  for (const q of input.clarificationQuestions ?? []) {
    if (assumedQuestionIds.has(q.id)) continue;
    if (q.sourceFindingId || q.sourceKeyFact) continue;
    const cat = normalizeCategory(q.category ?? "vertrags_lv_risiken");
    const sev = normalizeSeverity(q.severity ?? "medium");
    const assumption = `Wir gehen davon aus, dass die Klarstellung zu „${q.question.slice(0, 80)}…" im üblichen Sinne beantwortet wird.`;
    if (existingClarificationTexts.length > 0 && isSimilarToExistingClarification(assumption, existingClarificationTexts)) continue;
    const a: OfferAssumption = {
      id: genId("q"),
      category: cat,
      severity: sev,
      assumption,
      reason: q.reason,
      sourceQuestionId: q.id,
    };
    assumptions.push(a);
    existingClarificationTexts.push({ assumption: a.assumption });
    debug.push({
      questionId: q.id,
      assumptionId: a.id,
      assumption: a.assumption,
    });
  }

  // 5) Gruppierung
  const byGroup: Record<QuestionGroup, OfferAssumption[]> = {
    technisch: [],
    vertraglich: [],
    terminlich: [],
  };

  for (const a of assumptions) {
    let group: QuestionGroup = CATEGORY_TO_GROUP[a.category] ?? "vertraglich";
    const keyFactMatch = input.clarificationQuestions?.find((q) => q.id === a.sourceQuestionId)?.sourceKeyFact;
    if (keyFactMatch) group = MISSING_KEYFACT_GROUPS[keyFactMatch] ?? group;
    byGroup[group].push(a);
  }

  return { assumptions, byGroup, debug };
}
