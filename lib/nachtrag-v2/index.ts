import type { DbTrigger } from "../analyzeLvText";
import type { NachtragResultV2 } from "./types";
import { mapLegacyToNachtragEvidence, type LegacyFinding } from "./adapterFromLegacy";
import { runNachtragV2Engine } from "./engine";

export type { NachtragResultV2 } from "./types";

export function computeNachtragV2FromLegacy(
  findings: LegacyFinding[],
  dbTriggers: DbTrigger[],
  gateContext: { primaryDiscipline?: string | null; secondaryDisciplines?: string[] | null }
): NachtragResultV2 {
  const evidences = mapLegacyToNachtragEvidence(findings, dbTriggers);
  return runNachtragV2Engine(evidences, {
    primaryDiscipline: gateContext.primaryDiscipline,
    secondaryDisciplines: gateContext.secondaryDisciplines,
  });
}

