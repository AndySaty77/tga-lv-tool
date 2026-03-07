/**
 * Zentrale Scoring-Konfiguration.
 * Alle Werte unverändert aus dem bisherigen Code übernommen.
 * Keine fachliche Änderung – nur Zusammenführung für spätere Editierbarkeit (z. B. /admin/scoring).
 */

// ==================== Ampel (UI-Darstellung Gesamt-Score) ====================
/** Schwellen für die Risiko-Ampel in der Analyse-UI (score 0–100). */
export const AMPEL_THRESHOLDS = {
  /** Ab diesem Score: Rot (hohes Risiko). */
  redMin: 70,
  /** Ab diesem Score: Gelb (mittel). Darunter: Grün. */
  yellowMin: 40,
} as const;

// ==================== Level (lib/scoring.ts levelFromTotal) ====================
/** Schwellen für das Text-Level (hochriskant/mittel/solide/sauber) aus Gesamtpunktzahl. */
export const LEVEL_THRESHOLDS = {
  hochriskantMax: 40,
  mittelMax: 70,
  solideMax: 86,
} as const;

// ==================== 6er-Kategorien (lib/scoring.ts computeScore) ====================
export const CATEGORY_WEIGHTS_6: Record<string, number> = {
  normen: 15,
  vollstaendigkeit: 20,
  vortext: 15,
  mengen_schnittstellen: 15,
  nachtrag: 20,
  ausfuehrung: 15,
};

// ==================== 5er-Kategorien + API-Fallback (scoring_config) ====================
export type CategoryKey5 =
  | "vertrags_lv_risiken"
  | "mengen_massenermittlung"
  | "technische_vollstaendigkeit"
  | "schnittstellen_nebenleistungen"
  | "kalkulationsunsicherheit";

export const CATEGORY_KEYS_5: CategoryKey5[] = [
  "vertrags_lv_risiken",
  "mengen_massenermittlung",
  "technische_vollstaendigkeit",
  "schnittstellen_nebenleistungen",
  "kalkulationsunsicherheit",
];

/** Fallback, wenn scoring_config in der DB fehlt oder ungültig ist. */
export const FALLBACK_SCORING_CONFIG = {
  version: 1,
  catMax: {
    vertrags_lv_risiken: 70,
    mengen_massenermittlung: 60,
    technische_vollstaendigkeit: 80,
    schnittstellen_nebenleistungen: 70,
    kalkulationsunsicherheit: 60,
  } as Record<CategoryKey5, number>,
  lvSize: { baseDivisor: 2000, maxBoost: 0.6 },
  easing: { type: "sqrt" as const },
  total: { method: "mean" as const },
};

// ==================== Claim-Level (Trigger-Validierung / Anzeige) ====================
export const CLAIM_LEVELS = ["Niedrig", "Mittel", "Hoch"] as const;

// ==================== Nachtrag-Weichwörter (lib/analyzeLvText.ts) ====================
/** Schwellen für den System-Check „Weiche Formulierungen“. */
export const NACHTRAG_SCHWELLEN = {
  /** Mindesttreffer für ein Finding. */
  minFindings: 3,
  /** Ab dieser Trefferzahl: severity "high" statt "medium". */
  highSeverityMin: 6,
  /** Basis-Penalty vor Faktor. */
  basePenalty: 6,
  /** Maximaler Penalty (nach Faktor). */
  penaltyMax: 12,
} as const;

/** Wörter, die als weiche Formulierung gezählt werden. */
export const NACHTRAG_WEICHWOERTER = [
  "bauseits",
  "nach aufwand",
  "optional",
  "bedarfsweise",
  "pauschal",
] as const;

// ==================== Projekttyp-Faktoren (Platzhalter) ====================
/** Projekttyp-spezifische Faktoren. Aktuell keine Logik angebunden – leer. */
export const PROJECT_TYPE_FACTORS: Record<string, number> = {};
