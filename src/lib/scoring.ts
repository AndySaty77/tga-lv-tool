export type ScoreCategory =
  | "normen"
  | "vollstaendigkeit"
  | "vortext"
  | "mengen_schnittstellen"
  | "nachtrag"
  | "ausfuehrung";

export const CATEGORY_WEIGHTS: Record<ScoreCategory, number> = {
  normen: 15,
  vollstaendigkeit: 20,
  vortext: 15,
  mengen_schnittstellen: 15,
  nachtrag: 20,
  ausfuehrung: 15,
};

export type Severity = "low" | "medium" | "high";

export type Finding = {
  id: string;
  category: ScoreCategory;
  title: string;
  detail?: string;
  severity: Severity;
  // points to deduct inside category weight, 0..weight
  penalty: number;
};

export type ScoreInput = {
  findings: Finding[];
  // optional positive evidence (later); for MVP: keep empty
  bonuses?: Array<{
    category: ScoreCategory;
    title: string;
    points: number; // add inside category weight
  }>;
};

export type ScoreResult = {
  total: number; // 0..100
  level: "hochriskant" | "mittel" | "solide" | "sauber";
  perCategory: Record<ScoreCategory, number>; // 0..weight
  findingsSorted: Finding[];
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const levelFromTotal = (t: number): ScoreResult["level"] => {
  if (t < 40) return "hochriskant";
  if (t < 70) return "mittel";
  if (t < 86) return "solide";
  return "sauber";
};

export function computeScore(input: ScoreInput): ScoreResult {
  const findings = [...input.findings];

  // Start = volle Punktzahl je Kategorie
  const perCategory: Record<ScoreCategory, number> = {
    normen: CATEGORY_WEIGHTS.normen,
    vollstaendigkeit: CATEGORY_WEIGHTS.vollstaendigkeit,
    vortext: CATEGORY_WEIGHTS.vortext,
    mengen_schnittstellen: CATEGORY_WEIGHTS.mengen_schnittstellen,
    nachtrag: CATEGORY_WEIGHTS.nachtrag,
    ausfuehrung: CATEGORY_WEIGHTS.ausfuehrung,
  };

  // Abzüge
  for (const f of findings) {
    const maxInCat = CATEGORY_WEIGHTS[f.category];
    const p = clamp(f.penalty, 0, maxInCat);
    perCategory[f.category] = clamp(perCategory[f.category] - p, 0, maxInCat);
  }

  // Bonus (optional)
  if (input.bonuses?.length) {
    for (const b of input.bonuses) {
      const maxInCat = CATEGORY_WEIGHTS[b.category];
      perCategory[b.category] = clamp(perCategory[b.category] + b.points, 0, maxInCat);
    }
  }

  const total =
    perCategory.normen +
    perCategory.vollstaendigkeit +
    perCategory.vortext +
    perCategory.mengen_schnittstellen +
    perCategory.nachtrag +
    perCategory.ausfuehrung;

  // Priorisierung: high severity + hohe penalty zuerst
  const severityRank: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
  const findingsSorted = findings.sort((a, b) => {
    const s = severityRank[b.severity] - severityRank[a.severity];
    if (s !== 0) return s;
    return b.penalty - a.penalty;
  });

  return {
    total,
    level: levelFromTotal(total),
    perCategory,
    findingsSorted,
  };
}
