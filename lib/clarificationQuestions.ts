/**
 * Rückfragen-Generator für Bieterfragen / Klarstellungen.
 * Regelbasiert; LLM nur optional für Umformulierung.
 */

export type ScoreCategory =
  | "vertrags_lv_risiken"
  | "mengen_massenermittlung"
  | "technische_vollstaendigkeit"
  | "schnittstellen_nebenleistungen"
  | "kalkulationsunsicherheit";

export type ClarificationQuestion = {
  id: string;
  category: ScoreCategory;
  severity: "low" | "medium" | "high";
  question: string;
  reason: string;
  sourceFindingId?: string;
  sourceTextSnippet?: string;
  /** Bei fehlendem KeyFact: Key für Gruppierung */
  sourceKeyFact?: string;
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
  }>;
  riskClauses?: Array<{
    type: string;
    riskLevel: string;
    text: string;
    interpretation: string;
    confidence?: number;
  }>;
  keyFacts?: Record<string, string>;
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

/**
 * Erzeugt strukturierte Rückfragen aus Findings, Vortext-Risiken, fehlenden KeyFacts.
 */
export function generateClarificationQuestions(input: ClarificationInput): ClarificationOutput {
  idCounter = 0;
  const questions: ClarificationQuestion[] = [];
  const debug: ClarificationOutput["debug"] = [];

  // 1) Aus Trigger-Findings
  for (const f of input.findings ?? []) {
    const cat = normalizeCategory(f.category);
    const sev = normalizeSeverity(f.severity);
    const question = `Bitte Klarstellung zu: ${f.title}. ${(f.detail ?? "").split("|")[0]?.trim() ?? ""}`.trim();
    const reason = `Trigger-Finding: ${f.title}`;
    const q: ClarificationQuestion = {
      id: genId("f"),
      category: cat,
      severity: sev,
      question,
      reason,
      sourceFindingId: f.id,
      sourceTextSnippet: snippet(f.detail ?? ""),
    };
    questions.push(q);
    debug.push({ source: "finding", sourceId: f.id, questionId: q.id, question: q.question });
  }

  // 2) Aus Vortext-Risiken (riskClauses)
  for (const r of input.riskClauses ?? []) {
    const sev = normalizeSeverity(r.riskLevel);
    const cat: ScoreCategory = "vertrags_lv_risiken";
    const question =
      r.interpretation && r.interpretation.length > 20
        ? r.interpretation
        : `Bitte Klarstellung zur Vertragsklausel: ${snippet(r.text, 80)}`;
    const q: ClarificationQuestion = {
      id: genId("r"),
      category: cat,
      severity: sev,
      question,
      reason: `Vortext-Risiko: ${r.type || "Vertragsklausel"}`,
      sourceTextSnippet: snippet(r.text),
    };
    questions.push(q);
    debug.push({ source: "riskClause", sourceId: r.type, questionId: q.id, question: q.question });
  }

  // 3) Fehlende KeyFacts (nur wichtige)
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
      const question = `Bitte Angabe zu ${label}: Keine klare Angabe im Vortext gefunden.`;
      const q: ClarificationQuestion = {
        id: genId("k"),
        category: cat,
        severity: "medium",
        question,
        reason: `Fehlendes KeyFact: ${label}`,
        sourceKeyFact: key,
      };
      questions.push(q);
      debug.push({ source: "missingKeyFact", sourceId: key, questionId: q.id, question: q.question });
    }
  }

  // 4) Gruppierung
  const byGroup: Record<QuestionGroup, ClarificationQuestion[]> = {
    technisch: [],
    vertraglich: [],
    terminlich: [],
  };

  for (const q of questions) {
    let group: QuestionGroup = CATEGORY_TO_GROUP[q.category] ?? "vertraglich";
    if (q.sourceKeyFact) {
      group = MISSING_KEYFACT_GROUPS[q.sourceKeyFact] ?? group;
    }
    byGroup[group].push(q);
  }

  return { questions, byGroup, debug };
}
