/**
 * Systemlogik-Bibliothek für Lückenanalyse.
 * Zusätzliche Ebene; die bestehende Trigger-Engine bleibt vollständig erhalten.
 */

export type {
  Severity,
  RequirementType,
  CategoryKey,
  SystemTrade,
  SystemComponent,
  LogicGapRule,
  SystemLogicDefinition,
  DetectedSystemMatch,
  MissingSystemComponentFinding,
  SystemLogicAnalysisResult,
} from "./types";

export { HEATING_SYSTEMS } from "./heatingSystems";
export { SANITARY_SYSTEMS } from "./sanitarySystems";
export { VENTILATION_SYSTEMS } from "./ventilationSystems";
export { ELECTRICAL_SYSTEMS } from "./electricalSystems";
export { MSR_SYSTEMS } from "./msrSystems";
export { CROSS_SYSTEMS } from "./crossSystemRules";

import { HEATING_SYSTEMS } from "./heatingSystems";
import { SANITARY_SYSTEMS } from "./sanitarySystems";
import { VENTILATION_SYSTEMS } from "./ventilationSystems";
import { ELECTRICAL_SYSTEMS } from "./electricalSystems";
import { MSR_SYSTEMS } from "./msrSystems";
import { CROSS_SYSTEMS } from "./crossSystemRules";
import type { SystemLogicDefinition } from "./types";

export const ALL_SYSTEM_LOGIC_DEFINITIONS: SystemLogicDefinition[] = [
  ...HEATING_SYSTEMS,
  ...SANITARY_SYSTEMS,
  ...VENTILATION_SYSTEMS,
  ...ELECTRICAL_SYSTEMS,
  ...MSR_SYSTEMS,
  ...CROSS_SYSTEMS,
];

export {
  runSystemLogicEngine,
  type SystemLogicEngineInput,
  type SystemLogicResult,
  type SystemLogicFinding,
  type SystemLogicFindingType,
  type SystemLogicDetectionSource,
  type SystemLogicConfidenceLabel,
  type SystemLogicRecommendedHandling,
  type SystemLogicRelevanceLabel,
  type SystemLogicActionType,
  type SystemLogicDebugDetectionEntry,
  type SystemLogicSystemSummary,
} from "./systemLogicEngine";
