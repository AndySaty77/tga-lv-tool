/**
 * Stabiles Datenmodell für den PDF-Export.
 * Unabhängig von der internen Analyse-Struktur; wird ausschließlich über buildPdfReport befüllt.
 */

export type TrafficLight = "green" | "yellow" | "red";

export type PdfReportMeta = {
  projectName?: string;
  sourceFileName?: string;
  analyzedAt: string;
  projectType?: string;
  companyName?: string;
};

export type PdfCategoryScore = {
  key: string;
  label: string;
  score?: number;
  trafficLight?: TrafficLight;
  shortReason?: string;
  topDrivers?: string[];
};

export type PdfSummary = {
  executiveSummary?: string;
  totalScore?: number;
  totalRiskLabel?: string;
  complexityScore?: number;
  claimLevel?: string;
  questionCount?: number;
  clarificationCount?: number;
};

export type PdfClaimPotential = {
  executiveSummary?: string;
  topRisks?: string[];
  topNegotiationPoints?: string[];
  immediateActions?: string[];
  finalRecommendation?: string;
};

export type PdfQuestion = {
  title?: string;
  text: string;
  priority?: string | number;
  /** Themengebiet (z. B. Score-Kategorie), falls in der Quelle vorhanden. */
  categoryLabel?: string;
};

export type PdfClarification = {
  title?: string;
  text: string;
  /** Gruppe / Kategorie für die Lesbarkeit im Bericht. */
  categoryLabel?: string;
};

export type PdfDisclaimer = {
  text: string;
};

/** Eckdaten für PDF und App-Bericht (gleiche Quelle wie keyFacts in result_json). */
export type PdfKeyFactRow = {
  label: string;
  value: string;
};

/** Priorisierte Risiko-Zeile für den PDF-Teil „Top-Risiken“ (aus Findings). */
export type PdfTopRiskItem = {
  title: string;
  categoryLabel?: string;
  detail?: string;
  /** Lesbare Risiko-Stufe, z. B. „Hohes Risiko“. */
  severityHint?: string;
};

export type AnalysisPdfReport = {
  meta: PdfReportMeta;
  summary: PdfSummary;
  categoryScores: PdfCategoryScore[];
  /** Gefilterte Key Facts mit Anzeige-Label (Projektkontext). */
  keyFacts?: PdfKeyFactRow[];
  /** 3–5 verdichtete Handlungspunkte vor Abgabe (aus Rückfragen, Klarstellungen, Strategie). */
  nextSteps?: string[];
  /** Bis zu 8 priorisierte Einzelfindings mit Kurzkontext. */
  topRisks?: PdfTopRiskItem[];
  claimPotential?: PdfClaimPotential;
  questions?: PdfQuestion[];
  clarifications?: PdfClarification[];
  disclaimer: PdfDisclaimer;
};
