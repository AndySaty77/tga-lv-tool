import type { NachtragEvidenceV2, NachtragResultV2 } from "./types";

export type FamiliesHistogram = Record<string, { count: number; totalWeight: number }>;

export type QualifierHistogram = {
  positive: Record<string, number>;
  negative: Record<string, number>;
};

export type ValidationWarning =
  | "warnTooManyGenericFamilies"
  | "warnNoMeaningfulQualifiers"
  | "warnAllAnchorsSilent"
  | "warnTooManyPositiveSignalsFromWeakQuality"
  | "warnBlockersMissingDespitePauschalLanguage"
  | "warnPotentialCollapsedUnexpectedly"
  | "warnExposureTooFlat"
  | "warnEnforceabilityTooOptimistic"
  | "warnEnforceabilityTooPessimistic";

export type ValidationReport = {
  summary: {
    exposureScore: number;
    enforceabilityScore: number;
    potentialScore: number;
  };
  keyFamilies: string[];
  familiesHistogram: FamiliesHistogram;
  qualifierHistogram: QualifierHistogram;
  firedAnchors: Array<{ id: string; label: string; reason?: string }>;
  nonFiredAnchors: Array<{ id: string; label: string; reason?: string }>;
  topExposureDrivers: string[];
  topEnforceabilityDrivers: string[];
  topEnforceabilityBlockers: string[];
  warnings: ValidationWarning[];
  metrics: {
    evidenceCount: number;
    distinctFamilyCount: number;
    positiveEnforceabilityCount: number;
    negativeEnforceabilityCount: number;
    unresolvedClaimTopicCount: number;
    firedAnchorCount: number;
    cappedFamilyCount: number;
    exposureVsEnforceabilityGap: number;
    potentialVsExposureGap: number;
    potentialVsEnforceabilityGap: number;
  };
};

export function buildFamiliesHistogram(evidences: NachtragEvidenceV2[]): FamiliesHistogram {
  const hist: FamiliesHistogram = {};
  for (const ev of evidences) {
    const fam = ev.family || "unknown";
    const w = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
    if (!hist[fam]) hist[fam] = { count: 0, totalWeight: 0 };
    hist[fam].count += 1;
    hist[fam].totalWeight += w;
  }
  return hist;
}

export function buildQualifierHistogramFromSignals(result: NachtragResultV2): QualifierHistogram {
  const q: QualifierHistogram = { positive: {}, negative: {} };

  const pos = Array.isArray((result.debug as any)?.positiveEnforceabilitySignals)
    ? ((result.debug as any).positiveEnforceabilitySignals as Array<{ matchedQualifiers?: string[] }>)
    : [];
  const neg = Array.isArray((result.debug as any)?.negativeEnforceabilitySignals)
    ? ((result.debug as any).negativeEnforceabilitySignals as Array<{ matchedQualifiers?: string[] }>)
    : [];

  for (const s of pos) {
    for (const k of s.matchedQualifiers ?? []) {
      q.positive[k] = (q.positive[k] ?? 0) + 1;
    }
  }
  for (const s of neg) {
    for (const k of s.matchedQualifiers ?? []) {
      q.negative[k] = (q.negative[k] ?? 0) + 1;
    }
  }

  return q;
}

function topFamilies(hist: FamiliesHistogram, limit = 6): string[] {
  return Object.entries(hist)
    .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
    .slice(0, limit)
    .map(([fam]) => fam);
}

function countCappedFamilies(caps: NachtragResultV2["commodityCaps"]): number {
  return (caps ?? []).filter((c) => Number(c.raw) > Number(c.capped) + 1e-6).length;
}

export function buildValidationWarnings(
  v2: NachtragResultV2,
  familiesHist: FamiliesHistogram,
  qualifierHist: QualifierHistogram
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const evidenceCount = Number((v2.debug as any)?.evidenceCount ?? 0);
  const firedAnchorCount = (v2.anchors ?? []).filter((a) => a.fired).length;

  const genericFamilies = new Set([
    "generic_text_noise",
    "schnittstelle_allgemein",
    "leistungsabgrenzung_allgemein",
    "nebenleistung_allgemein",
    "mengen_unbestimmt",
    "dokumentation_allgemein",
    "inbetriebnahme_allgemein",
  ]);

  const genericCount = Object.entries(familiesHist)
    .filter(([fam]) => genericFamilies.has(fam))
    .reduce((sum, [, v]) => sum + v.count, 0);

  if (evidenceCount >= 8 && genericCount / Math.max(1, evidenceCount) >= 0.65) {
    warnings.push("warnTooManyGenericFamilies");
  }

  const qualifierCount =
    Object.values(qualifierHist.positive).reduce((s, x) => s + x, 0) +
    Object.values(qualifierHist.negative).reduce((s, x) => s + x, 0);
  if (evidenceCount >= 6 && qualifierCount === 0) {
    warnings.push("warnNoMeaningfulQualifiers");
  }

  if (evidenceCount >= 8 && firedAnchorCount === 0) {
    warnings.push("warnAllAnchorsSilent");
  }

  const posCount = Array.isArray((v2.debug as any)?.positiveEnforceabilitySignals)
    ? ((v2.debug as any).positiveEnforceabilitySignals as any[]).length
    : 0;
  const negCount = Array.isArray((v2.debug as any)?.negativeEnforceabilitySignals)
    ? ((v2.debug as any).negativeEnforceabilitySignals as any[]).length
    : 0;

  if (posCount >= 6 && qualifierCount === 0) {
    warnings.push("warnTooManyPositiveSignalsFromWeakQuality");
  }

  const notesText = `${(v2.notes ?? []).join(" ")}`.toLowerCase();
  const hasPauschalLanguage =
    notesText.includes("pauschal") ||
    notesText.includes("vollständ") ||
    notesText.includes("vollstaend") ||
    notesText.includes("inkl.") ||
    notesText.includes("inklusive");
  if (hasPauschalLanguage && negCount <= 1) {
    warnings.push("warnBlockersMissingDespitePauschalLanguage");
  }

  const minScore = Math.min(v2.exposureScore, v2.enforceabilityScore);
  if (minScore >= 30 && v2.potentialScore < minScore - 18) {
    warnings.push("warnPotentialCollapsedUnexpectedly");
  }

  if (evidenceCount >= 10 && v2.exposureScore >= 40 && v2.exposureScore <= 60) {
    warnings.push("warnExposureTooFlat");
  }

  const hasStrongBlockers = negCount >= 3;
  if (hasStrongBlockers && v2.enforceabilityScore >= 70) {
    warnings.push("warnEnforceabilityTooOptimistic");
  }

  if (posCount >= 3 && v2.enforceabilityScore <= 25) {
    warnings.push("warnEnforceabilityTooPessimistic");
  }

  return warnings;
}

export function buildValidationReport(
  v2: NachtragResultV2,
  evidences: NachtragEvidenceV2[]
): ValidationReport {
  const familiesHistogram = buildFamiliesHistogram(evidences);
  const qualifierHistogram = buildQualifierHistogramFromSignals(v2);

  const anchorsEvaluated = Array.isArray((v2.debug as any)?.anchorsEvaluated)
    ? ((v2.debug as any).anchorsEvaluated as Array<{ id: string; label: string; fired: boolean; reason?: string }>)
    : (v2.anchors ?? []).map((a) => ({ id: a.id, label: a.label, fired: a.fired, reason: a.reason }));

  const firedAnchors = anchorsEvaluated.filter((a) => a.fired).map((a) => ({ id: a.id, label: a.label, reason: a.reason }));
  const nonFiredAnchors = anchorsEvaluated.filter((a) => !a.fired).map((a) => ({ id: a.id, label: a.label, reason: a.reason }));

  const positiveSignals = Array.isArray((v2.debug as any)?.positiveEnforceabilitySignals)
    ? ((v2.debug as any).positiveEnforceabilitySignals as Array<{ reason?: string; weight?: number }>)
    : [];
  const negativeSignals = Array.isArray((v2.debug as any)?.negativeEnforceabilitySignals)
    ? ((v2.debug as any).negativeEnforceabilitySignals as Array<{ reason?: string; weight?: number }>)
    : [];

  const topEnforceabilityDrivers = [...positiveSignals]
    .sort((a, b) => Number(b.weight ?? 0) - Number(a.weight ?? 0))
    .slice(0, 3)
    .map((s) => (s.reason ? String(s.reason) : "Positiver Claim-Hebel"));

  const topEnforceabilityBlockers = [...negativeSignals]
    .sort((a, b) => Number(b.weight ?? 0) - Number(a.weight ?? 0))
    .slice(0, 3)
    .map((s) => (s.reason ? String(s.reason) : "Claim-Blocker"));

  const topExposureDrivers = [
    `Vertragsabgrenzung: ${v2.subscores.vertrags_abgrenzung}/100`,
    `Ausführung/Mengen: ${v2.subscores.ausfuehrung_mengen}/100`,
    `Doku/IBN: ${v2.subscores.doku_ibn}/100`,
  ].sort((a, b) => {
    const na = Number(a.match(/(\d+)\/100/)?.[1] ?? 0);
    const nb = Number(b.match(/(\d+)\/100/)?.[1] ?? 0);
    return nb - na;
  }).slice(0, 3);

  const evidenceCount = Number((v2.debug as any)?.evidenceCount ?? evidences.length ?? 0);
  const distinctFamilyCount = Object.keys(familiesHistogram).length;
  const positiveEnforceabilityCount = positiveSignals.length;
  const negativeEnforceabilityCount = negativeSignals.length;
  const unresolvedClaimTopicCount = Array.isArray((v2.debug as any)?.unresolvedClaimTopics)
    ? ((v2.debug as any).unresolvedClaimTopics as any[]).length
    : 0;
  const firedAnchorCount = firedAnchors.length;
  const cappedFamilyCount = countCappedFamilies(v2.commodityCaps ?? []);

  const warnings = buildValidationWarnings(v2, familiesHistogram, qualifierHistogram);

  return {
    summary: {
      exposureScore: v2.exposureScore,
      enforceabilityScore: v2.enforceabilityScore,
      potentialScore: v2.potentialScore,
    },
    keyFamilies: topFamilies(familiesHistogram, 6),
    familiesHistogram,
    qualifierHistogram,
    firedAnchors,
    nonFiredAnchors,
    topExposureDrivers,
    topEnforceabilityDrivers,
    topEnforceabilityBlockers,
    warnings,
    metrics: {
      evidenceCount,
      distinctFamilyCount,
      positiveEnforceabilityCount,
      negativeEnforceabilityCount,
      unresolvedClaimTopicCount,
      firedAnchorCount,
      cappedFamilyCount,
      exposureVsEnforceabilityGap: v2.exposureScore - v2.enforceabilityScore,
      potentialVsExposureGap: v2.potentialScore - v2.exposureScore,
      potentialVsEnforceabilityGap: v2.potentialScore - v2.enforceabilityScore,
    },
  };
}

