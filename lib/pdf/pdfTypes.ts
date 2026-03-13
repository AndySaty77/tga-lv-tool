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
};

export type PdfClarification = {
  title?: string;
  text: string;
};

export type PdfDisclaimer = {
  text: string;
};

export type AnalysisPdfReport = {
  meta: PdfReportMeta;
  summary: PdfSummary;
  categoryScores: PdfCategoryScore[];
  claimPotential?: PdfClaimPotential;
  questions?: PdfQuestion[];
  clarifications?: PdfClarification[];
  disclaimer: PdfDisclaimer;
};
