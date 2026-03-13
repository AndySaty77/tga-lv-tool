export type PlanId = "free" | "pro";

export type PlanLimits = {
  analysesPerMonth: number | null; // null = unbegrenzt
  pdfExport: boolean;
  advancedChangeOrderAnalysis: boolean;
  advancedFeatures: boolean;
};

export type PlanDefinition = PlanLimits & {
  id: PlanId;
  label: string;
  description: string;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    label: "Free",
    description: "Einstieg mit begrenzter Anzahl an Analysen pro Monat.",
    analysesPerMonth: 3,
    pdfExport: false,
    advancedChangeOrderAnalysis: false,
    advancedFeatures: false,
  },
  pro: {
    id: "pro",
    label: "Pro",
    description: "Unbegrenzte Analysen und erweiterte Pro-Funktionen.",
    analysesPerMonth: null,
    pdfExport: true,
    advancedChangeOrderAnalysis: true,
    advancedFeatures: true,
  },
};

export function getDefaultPlan(): PlanId {
  return "free";
}

export function getPlanDefinition(plan: PlanId): PlanDefinition {
  return PLANS[plan];
}

export function getPlanLimits(plan: PlanId): PlanLimits {
  const { analysesPerMonth, pdfExport, advancedChangeOrderAnalysis, advancedFeatures } = PLANS[plan];
  return { analysesPerMonth, pdfExport, advancedChangeOrderAnalysis, advancedFeatures };
}

export function hasFeature(
  plan: PlanId,
  feature: keyof Omit<PlanLimits, "analysesPerMonth">,
): boolean {
  const limits = getPlanLimits(plan);
  return !!limits[feature];
}

