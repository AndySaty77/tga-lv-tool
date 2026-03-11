/**
 * Typen für die Systemlogik-Bibliothek (Lückenanalyse).
 * Zusätzliche Ebene; die bestehende Trigger-Engine bleibt unverändert.
 */

export type Severity = "low" | "medium" | "high" | "critical";

export type RequirementType = "required" | "contextRequired" | "optional";

export type CategoryKey =
  | "vertrags_lv_risiken"
  | "mengen_massenermittlung"
  | "technische_vollstaendigkeit"
  | "schnittstellen_nebenleistungen"
  | "kalkulationsunsicherheit";

export type SystemTrade =
  | "heating"
  | "sanitary"
  | "ventilation"
  | "electrical"
  | "msr"
  | "cross";

export type DetectionRule = {
  anyOf: string[];
  allOf?: string[];
  minHits?: number;
  /** Optionale Begriffe, die nur als Verstärker zählen (nie allein ausreichend). */
  weakTerms?: string[];
};

export type SystemComponent = {
  key: string;
  label: string;
  matchAny: string[];
  severity: Severity;
  requiredType: RequirementType;
  description?: string;
};

export type LogicRuleCondition = {
  detectedAny?: string[];
  missingAny?: string[];
};

export type LogicGapRule = {
  key: string;
  title: string;
  severity: Severity;
  condition: LogicRuleCondition;
  categoryImpacts: Partial<Record<CategoryKey, Severity>>;
  explanation: string;
  recommendation: string;
};

export type SystemLogicMetadata = {
  gewerk: string;
  systemKey: string;
  label: string;
  detection: DetectionRule;
  requiredComponents: SystemComponent[];
  optionalComponents: SystemComponent[];
  logicRules: LogicGapRule[];
};

export type SystemLogicDefinition = {
  id: string;
  trade: SystemTrade;
  name: string;
  metadata: SystemLogicMetadata;
};

export type DetectedSystemMatch = {
  definitionId: string;
  trade: SystemTrade;
  matchedTerms?: string[];
  confidence?: number;
};

export type MissingSystemComponentFinding = {
  definitionId: string;
  systemKey: string;
  ruleKey: string;
  title: string;
  trade: SystemTrade;
  severity: Severity;
  categoryImpacts: Partial<Record<CategoryKey, Severity>>;
  explanation: string;
  recommendation: string;
};

export type SystemLogicAnalysisResult = {
  detectedMatches: DetectedSystemMatch[];
  missingComponentFindings: MissingSystemComponentFinding[];
  tradeCoverage: Partial<Record<SystemTrade, boolean>>;
};