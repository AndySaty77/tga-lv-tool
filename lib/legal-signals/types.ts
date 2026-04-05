/**
 * V1 Vertrags-/Vergabesignale (VOB/B-orientiert, keyword-basiert).
 * Keine Rechtsberatung – nur heuristische Risikoindikatoren.
 */

export type LegalSignalType =
  | "unusual_risk_transfer"
  | "acceptance_documentation_risk"
  | "hindrance_dependency_risk"
  | "change_order_potential";

export type LegalSignalSeverity = "low" | "medium" | "high";

export type LegalSignalEvidence = {
  text: string;
  sourceType?: string;
  positionRef?: string | null;
};

export type LegalSignal = {
  id: string;
  signalType: LegalSignalType;
  title: string;
  summary: string;
  severity: LegalSignalSeverity;
  /** 0..1 – grobe Stärke aus Trefferzahl/Evidenz */
  confidence: number;
  evidence: LegalSignalEvidence[];
  /** Bestehende 5er-Kategorien (Hinweis / Reporting) */
  affectsCategories: string[];
  /** Optional: additive Gewichtungshinweise (V1 konservativ, nicht zwingend verrechnet) */
  scoreDelta?: Partial<Record<string, number>>;
  suggestedQuestion?: string;
  suggestedClarification?: string;
  /** Kurze Handlungsempfehlung für die Analyseansicht (nicht identisch mit Angebotsklarstellung). */
  recommendedAction?: string;
};

/** Interne Regel-Definition für Keyword-/Regex-Erkennung */
export type LegalSignalRuleDef = {
  ruleId: string;
  signalType: LegalSignalType;
  /** Mindestens ein Treffer */
  patterns: RegExp[];
  /** Wenn gesetzt: mindestens ein Muster darf NICHT nach negativePatterns matchen */
  negativePatterns?: RegExp[];
  title: string;
  summary: string;
  baseSeverity: LegalSignalSeverity;
  affectsCategories: string[];
  scoreDeltaHint?: Partial<Record<string, number>>;
  suggestedQuestion: string;
  suggestedClarification: string;
  /** Ein Satz, praxisnah – nur für UI-Anzeige */
  recommendedAction: string;
};
