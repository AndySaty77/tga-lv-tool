export type { LegalSignal, LegalSignalType, LegalSignalSeverity } from "./types";
export { LEGAL_SIGNAL_RULES } from "./rules";
export { detectLegalSignals, LEGAL_SIGNALS_V1_ENABLED } from "./detect";
export { legalSignalsToFindings } from "./mapToScores";
export {
  severityLabelForUi,
  formatRecommendedLine,
  normalizeLegalSignalsForReport,
  type LegalSignalReportRow,
} from "./presentation";
