export type NachtragSignalType = "commodity" | "high-signal" | "anchor-seed";

export type NachtragRiskDirection = "exposure" | "enforceability" | "both";

export type NachtragSubscoreKey =
  | "vertrags_abgrenzung"
  | "ausfuehrung_mengen"
  | "doku_ibn"
  | "durchsetzbarkeit";

export type NachtragEvidenceV2 = {
  id: string;
  title?: string;
  family: string;
  signalType: NachtragSignalType;
  riskDirection: NachtragRiskDirection;
  subscoreTargets: NachtragSubscoreKey[];
  disciplineTags?: string[];
  sourceContext?: "vortext" | "position" | "heading" | "unknown";
  confidence?: number;
  rawWeight?: number;
  meta?: Record<string, unknown>;
};

export type CommodityCapResult = {
  family: string;
  raw: number;
  capped: number;
  cap: number;
};

export type AnchorEventResult = {
  id: string;
  label: string;
  fired: boolean;
  impactExposure?: number;
  impactEnforceability?: number;
  reason?: string;
  // Debug-/Qualitätsfelder (Admin-Debug)
  anchorWeightedMass?: number;
  anchorRawWeightedMass?: number;
  anchorSyntheticClaimWeightedMass?: number;
  anchorSyntheticRiskWeightedMass?: number;
  anchorConfidence?: number;
  anchorSupportMode?: "raw" | "synthetic_claim_wrapper" | "synthetic_risk_summary" | "mixed" | "none";
  whyFired?: string;
  whySuppressed?: string;
};

export type NachtragSubscoresV2 = {
  vertrags_abgrenzung: number;
  ausfuehrung_mengen: number;
  doku_ibn: number;
  durchsetzbarkeit: number;
};

export type NachtragResultV2 = {
  exposureScore: number;
  enforceabilityScore: number;
  potentialScore: number;
  subscores: NachtragSubscoresV2;
  commodityCaps: CommodityCapResult[];
  anchors: AnchorEventResult[];
  drivers: string[];
  blockers: string[];
  notes?: string[];
  debug?: Record<string, unknown>;
};

