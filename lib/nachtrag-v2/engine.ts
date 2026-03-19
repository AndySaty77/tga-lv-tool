import type { NachtragEvidenceV2, NachtragResultV2 } from "./types";
import { applyCommodityCaps } from "./commodityCaps";
import { evaluateAnchors } from "./anchors";
import { applyGates, type NachtragGateContext } from "./gates";
import { buildSubscores } from "./subscores";
import { analyzeEnforceability } from "./enforceability";
import { buildAggregateScores } from "./aggregate";
import { buildExplanations } from "./explain";
import { shouldFilterEvidence, getEvidenceText, type NoiseFilterContext } from "./noiseFilter";
import { resolveFamilyFromTextWithDebug } from "./families";
import { detectClaimGapType } from "./claimGapType";
import {
  detectEvidenceOrigin,
  familyFromFieldTypeForSynthetic,
  type EvidenceOriginType,
} from "./evidenceOrigin";

const CLAIM_GAP_TYPES_FOR_HISTOGRAM = [
  "scope_exclusion",
  "bauseits_other_trade",
  "coordination_interface",
  "missing_definition",
  "open_quantity",
  "documentation_acceptance",
  "all_inclusive_blocker",
  "unresolved_claim_topic",
  "none",
] as const;

export function runNachtragV2Engine(
  allEvidences: NachtragEvidenceV2[],
  gateContext: NachtragGateContext
): NachtragResultV2 {
  const rawEvidences = allEvidences ?? [];
  const noiseContext: NoiseFilterContext = { seenNormalized: new Set() };
  const filtered = rawEvidences.filter((ev) => {
    const text = getEvidenceText(ev);
    return !shouldFilterEvidence(text, noiseContext);
  });

  const unknownDebugSamples: Array<{
    snippet: string;
    claimGapType: string;
    family: string;
    familyScores: Record<string, number>;
    source: string;
    evidenceOrigin: string;
    unknownReason?: string;
  }> = [];

  const evidences = filtered.map((ev) => {
    const text = getEvidenceText(ev);
    const evidenceOrigin = detectEvidenceOrigin(text, ev.meta);
    let claimGapType = detectClaimGapType(text);
    let { family, scores, unknownReason } = resolveFamilyFromTextWithDebug(text, claimGapType);

    const lower = text.toLowerCase();
    let resolvedVia: string | undefined;
    let topicCluster: string | undefined;

    const isSynthetic =
      evidenceOrigin === "synthetic_claim_wrapper" || evidenceOrigin === "synthetic_risk_summary";
    if (family === "unknown" && isSynthetic) {
      const inherited = familyFromFieldTypeForSynthetic(ev.meta?.fieldType as string);
      if (inherited) family = inherited;
    }

    if (evidenceOrigin === "raw_lv_evidence" && family === "unknown") {
      if (
        /\bbrandschutz\b/i.test(text) ||
        /abschott/i.test(text) ||
        /durchf(ü|ue)hrung\b/i.test(text) ||
        /durchdringung/i.test(text)
      ) {
        family = "bau";
        resolvedVia = "topic_bridge";
        topicCluster = "brandschutz";
      } else if (/druckpr(ü|ue)fung/i.test(text) || /dichtheitspr(ü|ue)fung/i.test(text)) {
        if (/\btrinkwasser\b/i.test(text) || /\babwasser\b/i.test(text) || /\brohr\b/i.test(text) || /\bleitung\b/i.test(text)) {
          family = "sanitaer";
        } else if (/\bheiz/i.test(text) || /\bvorlauf\b/i.test(text) || /\br(ü|ue)cklauf\b/i.test(text)) {
          family = "heizung";
        } else if (/\bl(ü|ue)ft/i.test(text) || /\bkanal\b/i.test(text) || /\bklima\b/i.test(text)) {
          family = "lueftung";
        } else {
          family = "sanitaer";
        }
        resolvedVia = "topic_bridge";
        topicCluster = "pruefung";
      } else if (
        /k(ä|ae)lte\b/i.test(text) ||
        /k(ä|ae)ltemittel\b/i.test(text) ||
        /\bkaltwassersatz\b/i.test(text) ||
        /k(ä|ae)lte-?ibn\b/i.test(text)
      ) {
        family = "heizung";
        resolvedVia = "topic_bridge";
        topicCluster = "kaelte";
      }
    }

    if (claimGapType !== "none" && family === "unknown" && claimGapType !== "documentation_acceptance" && claimGapType !== "open_quantity") {
      claimGapType = "unresolved_claim_topic";
    }
    if (claimGapType === "none") {
      const targets = ev.subscoreTargets ?? [];
      if (targets.includes("doku_ibn")) claimGapType = "documentation_acceptance";
      else if (targets.includes("ausfuehrung_mengen")) claimGapType = "open_quantity";
    }
    const meta = { ...ev.meta, claimGapType, evidenceOrigin, resolvedVia, topicCluster };

    if (family === "unknown" && unknownDebugSamples.length < 10) {
      unknownDebugSamples.push({
        snippet: text.slice(0, 120).trim() + (text.length > 120 ? "…" : ""),
        claimGapType,
        family,
        familyScores: { ...scores },
        source: ev.sourceContext ?? (ev.meta?.sourceType as string) ?? (ev.meta?.fieldType as string) ?? "unknown",
        evidenceOrigin,
        unknownReason,
      });
    }

    return { ...ev, family, meta };
  });

  const claimGapTypeHistogram: Record<string, number> = {};
  for (const t of CLAIM_GAP_TYPES_FOR_HISTOGRAM) {
    claimGapTypeHistogram[t] = 0;
  }
  for (const ev of evidences) {
    const t = (ev.meta?.claimGapType as string) ?? "none";
    claimGapTypeHistogram[t] = (claimGapTypeHistogram[t] ?? 0) + 1;
  }

  const originHistogram: Record<string, number> = {};
  const ORIGIN_TYPES: EvidenceOriginType[] = [
    "raw_lv_evidence",
    "synthetic_claim_wrapper",
    "synthetic_risk_summary",
    "derived_anchor_hint",
    "unknown_origin",
  ];
  for (const o of ORIGIN_TYPES) originHistogram[o] = 0;
  for (const ev of evidences) {
    const o = (ev.meta?.evidenceOrigin as string) ?? "unknown_origin";
    originHistogram[o] = (originHistogram[o] ?? 0) + 1;
  }

  const SYNTHETIC_ORIGINS = new Set<string>([
    "synthetic_claim_wrapper",
    "synthetic_risk_summary",
    "derived_anchor_hint",
  ]);
  const evidencesForFamilyHistogram = evidences.filter(
    (e) => !SYNTHETIC_ORIGINS.has((e.meta?.evidenceOrigin as string) ?? "")
  );
  const familyExcludedCount = evidences.length - evidencesForFamilyHistogram.length;

  // ===== Confidence-/Origin-Gewichtung (einfach, defensiv, ohne Score-Neuberechnung) =====
  // Idee: echte LV-Evidenz soll die gesamte Pipeline stärker beeinflussen als synthetische Wrapper.
  const ORIGIN_QUALITY_WEIGHTS: Partial<Record<EvidenceOriginType, number>> = {
    raw_lv_evidence: 1.0,
    synthetic_claim_wrapper: 0.6,
    synthetic_risk_summary: 0.35,
    derived_anchor_hint: 0.2,
    unknown_origin: 0.15,
  };
  const TOPIC_BRIDGE_FACTOR = 0.75; // zwischen raw (1.0) und synthetic (0.6/0.35)
  const FAMILY_UNKNOWN_FACTOR = 0.5;
  const UNRESOLVED_CLAIM_TOPIC_FACTOR = 0.5;

  const rawEvidenceCount = evidences.filter((e) => (e.meta?.evidenceOrigin as string) === "raw_lv_evidence").length;
  const syntheticEvidenceCount = evidences.filter(
    (e) =>
      (e.meta?.evidenceOrigin as string) === "synthetic_claim_wrapper" ||
      (e.meta?.evidenceOrigin as string) === "synthetic_risk_summary"
  ).length;
  const rawEvidenceShare = evidences.length > 0 ? rawEvidenceCount / evidences.length : 0;

  let totalRawWeight = 0;
  let totalEffectiveWeight = 0;

  const evidencesForAnalysis = evidences.map((ev) => {
    const origin = (ev.meta?.evidenceOrigin as EvidenceOriginType) ?? "unknown_origin";
    const baseWeight = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
    totalRawWeight += baseWeight;

    let factor =
      ORIGIN_QUALITY_WEIGHTS[origin] ??
      (origin === "raw_lv_evidence" ? 1.0 : origin === "synthetic_claim_wrapper" ? 0.6 : 0.15);

    const isTopicBridge = (ev.meta?.resolvedVia as string | undefined) === "topic_bridge";
    if (isTopicBridge) factor *= TOPIC_BRIDGE_FACTOR;
    if (ev.family === "unknown") factor *= FAMILY_UNKNOWN_FACTOR;
    if ((ev.meta?.claimGapType as string) === "unresolved_claim_topic") factor *= UNRESOLVED_CLAIM_TOPIC_FACTOR;

    // sehr defensiv clampen: kein negatives/über 1 geraten
    factor = Math.max(0.05, Math.min(1, factor));

    const effectiveWeight = baseWeight * factor;
    totalEffectiveWeight += effectiveWeight;

    return {
      ...ev,
      rawWeight: effectiveWeight,
      // für Debug-/Nachvollziehbarkeit: Factor im Meta ablegen (kein UI-Umbau nötig)
      meta: {
        ...ev.meta,
        evidenceQualityFactor: factor,
      },
    };
  });

  const evidenceQualityFactor = totalRawWeight > 0 ? totalEffectiveWeight / totalRawWeight : 0;
  const analysisConfidence = evidenceQualityFactor; // einfache Ableitung, ohne weitere Score-Logik

  const originalWeights = new Map<string, number>();
  for (const ev of evidencesForAnalysis) {
    const w = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
    originalWeights.set(ev.id, w);
  }

  // 1) Disziplin-/Kontext-Gates
  const gated = applyGates(evidencesForAnalysis, gateContext);

  // 2) Commodity-Caps anwenden
  const { cappedEvidences, caps } = applyCommodityCaps(gated);

  // 3) Subscores ableiten
  const { subscoresRaw, subscores } = buildSubscores(cappedEvidences);

  // 3b) Durchsetzbarkeit analysieren (separater Pfad)
  const enforceability = analyzeEnforceability(cappedEvidences);

  // 4) Anchor-Events prüfen
  const anchors = evaluateAnchors(cappedEvidences);

  // 5) Aggregate Scores
  const aggregates = buildAggregateScores(subscores, enforceability.normalizedScore, anchors, caps);

  // 6) Erläuterungen (Explain-Layer)
  const explain = buildExplanations(
    subscores,
    aggregates,
    anchors,
    caps,
    enforceability
  );

  const gatedEvidenceDebug = gated
    .map((ev) => {
      const before = originalWeights.get(ev.id) ?? 0;
      const after = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
      if (after >= before || before === 0) return null;
      return {
        id: ev.id,
        family: ev.family,
        before,
        after,
      };
    })
    .filter(Boolean) as Array<{ id: string; family: string; before: number; after: number }>;

  return {
    exposureScore: aggregates.exposureScore,
    enforceabilityScore: aggregates.enforceabilityScore,
    potentialScore: aggregates.potentialScore,
    subscores,
    commodityCaps: caps,
    anchors,
    drivers: explain.drivers,
    blockers: explain.blockers,
    notes: explain.notes,
    debug: {
      rawSubscores: subscoresRaw,
      evidenceCount: evidences.length,
      rawEvidenceCount,
      syntheticEvidenceCount,
      rawEvidenceShare,
      evidenceQualityFactor,
      analysisConfidence,
      claimGapTypeHistogram,
      originHistogram,
      processedEvidences: evidencesForAnalysis,
      evidencesForFamilyHistogram,
      familyExcludedCount,
      unknownDebugSamples,
      exposureComponents: aggregates.debug.exposureComponents,
      anchorsEvaluated: anchors.map((a) => ({
        id: a.id,
        label: a.label,
        fired: a.fired,
        impactExposure: a.impactExposure ?? 0,
        impactEnforceability: a.impactEnforceability ?? 0,
        reason: a.reason,
      })),
      gatedEvidence: gatedEvidenceDebug,
      positiveEnforceabilitySignals: enforceability.positiveSignals,
      negativeEnforceabilitySignals: enforceability.negativeSignals,
      unresolvedClaimTopics: enforceability.unresolvedClaimTopics,
      rawEnforceabilityBeforeClamp: enforceability.rawScore,
      normalizedEnforceability: enforceability.normalizedScore,
      enforceabilityRawBeforeNormalize: enforceability.enforceabilityRawBeforeNormalize,
      enforceabilityRawAfterNormalize: enforceability.enforceabilityRawAfterNormalize,
      positiveContributionSum: enforceability.positiveContributionSum,
      negativeContributionSum: enforceability.negativeContributionSum,
      strongestPositiveDriver: enforceability.strongestPositiveDriver,
      strongestNegativeBlocker: enforceability.strongestNegativeBlocker,
      enforceabilityMarkerContributions: enforceability.markerContributions,
      positiveEnforceabilityDebug: enforceability.positiveEnforceabilityDebug,
      enforceabilityRawBaseScore: enforceability.rawBaseScore,
      enforceabilityRawPositiveScore: enforceability.rawPositiveScore,
      enforceabilityRawNegativeScore: enforceability.rawNegativeScore,
      enforceabilityScoreBeforeNormalize: enforceability.scoreBeforeNormalize,
      enforceabilityScoreAfterNormalize: enforceability.scoreAfterNormalize,
      enforceabilityScoreAfterFloorClamp: enforceability.scoreAfterFloorClamp,
      enforceabilityFloorApplied: enforceability.floorApplied,
      enforceabilityFloorValue: enforceability.floorValue,
      normalizeClampApplied: enforceability.normalizeClampApplied,
      normalizeClampRange: enforceability.normalizeClampRange,
      normalizeRoundedFrom: enforceability.normalizeRoundedFrom,
      enforceabilityFinalEnforceabilityScore: aggregates.debug.enforceabilityDebug.finalEnforceabilityScore,
      enforceabilityBaseNormalized: aggregates.debug.enforceabilityDebug.enforceabilityBase,
      anchorEnforceabilityBoost: aggregates.debug.enforceabilityDebug.anchorEnforceabilityBoost,
      enforceabilityScoreBeforeRoundClamp: aggregates.debug.enforceabilityDebug.scoreBeforeRoundClamp,
      enforceabilityRoundedFrom: aggregates.debug.enforceabilityDebug.roundedFrom,
      enforceabilityClampApplied: aggregates.debug.enforceabilityDebug.clampApplied,
      enforceabilityClampRange: aggregates.debug.enforceabilityDebug.clampRange,
    },
  };
}

