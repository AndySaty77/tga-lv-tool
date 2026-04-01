/**
 * UX-Hilfe: erkennt, ob die drei nachgelagerten Blöcke im gespeicherten Bericht-Kontext
 * bereits vorliegen (gleiche Datenbasis wie Live-State / result_json).
 */

export type SavedReportCompleteness = {
  complete: boolean;
  /** Deutsche Labels für die Anzeige „Es fehlen noch: …“ */
  missingLabels: string[];
};

type CQ = { questions?: unknown[] } | null | undefined;
type OA = { assumptions?: unknown[] } | null | undefined;
type CO = {
  opportunities?: unknown[];
  changePotentialSummary?: unknown;
  offerStrategySummary?: { executiveSummary?: string };
} | null | undefined;

export function computeSavedReportCompleteness(
  clarificationQuestions: CQ,
  offerAssumptions: OA,
  changeOrderAnalysis: CO,
): SavedReportCompleteness {
  const hasRueckfragen = (clarificationQuestions?.questions?.length ?? 0) > 0;

  const hasAngebotsklarstellungen = (offerAssumptions?.assumptions?.length ?? 0) > 0;

  let hasNachtragspotenzial = false;
  const co = changeOrderAnalysis;
  if (co) {
    if (Array.isArray(co.opportunities) && co.opportunities.length > 0) {
      hasNachtragspotenzial = true;
    } else if (co.changePotentialSummary != null) {
      hasNachtragspotenzial = true;
    } else if (
      typeof co.offerStrategySummary?.executiveSummary === "string" &&
      co.offerStrategySummary.executiveSummary.trim().length > 0
    ) {
      hasNachtragspotenzial = true;
    }
  }

  const missingLabels: string[] = [];
  if (!hasRueckfragen) missingLabels.push("Rückfragen");
  if (!hasAngebotsklarstellungen) missingLabels.push("Angebotsklarstellungen");
  if (!hasNachtragspotenzial) missingLabels.push("Nachtragspotenzial");

  return {
    complete: missingLabels.length === 0,
    missingLabels,
  };
}
