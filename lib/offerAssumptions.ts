/**
 * Angebots-Annahmen-Generator.
 * Erzeugt Annahmen aus Findings, Rückfragen, Vortext-Risiken, KeyFacts.
 * LLM optional für Textoptimierung und Plausibilität.
 */

import type { ScoreCategory, QuestionGroup } from "./clarificationQuestions";

export type OfferAssumption = {
  id: string;
  category: ScoreCategory;
  severity: "low" | "medium" | "high";
  assumption: string;
  reason: string;
  sourceFindingId?: string;
  sourceQuestionId?: string;
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

const KEYFACT_LABELS: Record<string, string> = {
  baubeginn: "Baubeginn",
  bauzeit: "Bauzeit / Dauer",
  fertigstellung: "Fertigstellung / Abnahme",
  ausfuehrungsfrist: "Ausführungsfrist / Terminplan",
  ausfuehrungszeit: "Ausführungszeit",
  fristAngebot: "Angebotsfrist",
  bindefrist: "Bindefrist",
  submission_einreichung: "Submission / Einreichung",
  vertragsgrundlagen: "Vertragsgrundlagen",
  vertragsstrafe: "Vertragsstrafe",
  gewaerhleistung: "Gewährleistung",
  wartung_instandhaltung: "Wartung / Instandhaltung",
  vob_bgb: "VOB/BGB",
  zahlungsbedingungen: "Zahlungsbedingungen",
  abschlagszahlung: "Abschlagszahlung",
  schlussrechnung: "Schlussrechnung / Zahlungsziel",
  preisgleitung: "Preisgleitung",
  bauvorhaben: "Bauvorhaben",
  ort: "Ort / Standort",
  gewerk: "Gewerk",
  bauherr_ag: "Bauherr / Auftraggeber",
  planer: "Planer",
  rangfolge: "Rangfolge",
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

/**
 * Erzeugt Annahmen regelbasiert aus Findings, Rückfragen, Vortext-Risiken, KeyFacts.
 */
export function generateOfferAssumptions(input: OfferAssumptionInput): OfferAssumptionOutput {
  idCounter = 0;
  const assumptions: OfferAssumption[] = [];
  const debug: OfferAssumptionOutput["debug"] = [];

  const questionByFindingId = new Map<string, ClarificationQuestionInput>();
  for (const q of input.clarificationQuestions ?? []) {
    if (q.sourceFindingId) questionByFindingId.set(q.sourceFindingId, q);
  }

  const questionByKeyFact = new Map<string, ClarificationQuestionInput>();
  for (const q of input.clarificationQuestions ?? []) {
    if (q.sourceKeyFact) questionByKeyFact.set(q.sourceKeyFact, q);
  }

  // 1) Aus Trigger-Findings (+ ggf. zugehörige Rückfrage)
  for (const f of input.findings ?? []) {
    const cat = normalizeCategory(f.category);
    const sev = normalizeSeverity(f.severity);
    const assumption = `Wir gehen davon aus, dass die Anforderungen gemäß ${f.title} im Sinne der anerkannten Regeln der Technik ausgeführt werden, sofern keine abweichende Klarstellung erfolgt.`;
    const reason = `Finding: ${f.title}`;
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
    debug.push({
      findingId: f.id,
      questionId: q?.id,
      assumptionId: a.id,
      assumption: a.assumption,
    });
  }

  // 2) Aus Vortext-Risiken (ohne zugehöriges Finding)
  for (const r of input.riskClauses ?? []) {
    const sev = normalizeSeverity(r.riskLevel);
    const cat: ScoreCategory = "vertrags_lv_risiken";
    const assumption =
      r.interpretation && r.interpretation.length > 30
        ? `Wir gehen davon aus: ${r.interpretation}`
        : `Wir gehen davon aus, dass die Vertragsklausel im üblichen Sinne ausgelegt wird, sofern keine Klarstellung erfolgt.`;
    const a: OfferAssumption = {
      id: genId("r"),
      category: cat,
      severity: sev,
      assumption,
      reason: `Vortext-Risiko: ${r.type || "Vertragsklausel"}`,
      sourceQuestionId: input.clarificationQuestions?.find((q) => q.reason.includes(r.type || "Vertragsklausel"))?.id,
    };
    assumptions.push(a);
    debug.push({
      questionId: a.sourceQuestionId,
      assumptionId: a.id,
      assumption: a.assumption,
    });
  }

  // 3) Fehlende KeyFacts
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
      debug.push({
        questionId: q?.id,
        assumptionId: a.id,
        assumption: a.assumption,
      });
    }
  }

  // 4) Aus Rückfragen ohne bisherige Annahme (z. B. nur aus riskClause)
  const assumedQuestionIds = new Set(assumptions.map((a) => a.sourceQuestionId).filter(Boolean));
  for (const q of input.clarificationQuestions ?? []) {
    if (assumedQuestionIds.has(q.id)) continue;
    if (q.sourceFindingId || q.sourceKeyFact) continue;
    const cat = normalizeCategory(q.category ?? "vertrags_lv_risiken");
    const sev = normalizeSeverity(q.severity ?? "medium");
    const assumption = `Wir gehen davon aus, dass die Klarstellung zu „${q.question.slice(0, 80)}…" im üblichen Sinne beantwortet wird.`;
    const a: OfferAssumption = {
      id: genId("q"),
      category: cat,
      severity: sev,
      assumption,
      reason: q.reason,
      sourceQuestionId: q.id,
    };
    assumptions.push(a);
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
