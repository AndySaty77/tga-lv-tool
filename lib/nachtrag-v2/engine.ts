import type { NachtragEvidenceV2, NachtragResultV2 } from "./types";
import { applyCommodityCaps } from "./commodityCaps";
import { evaluateAnchors } from "./anchors";
import { applyGates, type NachtragGateContext } from "./gates";
import { buildSubscores } from "./subscores";
import { analyzeEnforceability } from "./enforceability";
import { buildAggregateScores } from "./aggregate";
import { buildExplanations } from "./explain";

export function runNachtragV2Engine(
  allEvidences: NachtragEvidenceV2[],
  gateContext: NachtragGateContext
): NachtragResultV2 {
  const evidences = allEvidences ?? [];

  const originalWeights = new Map<string, number>();
  for (const ev of evidences) {
    const w = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
    originalWeights.set(ev.id, w);
  }

  // 1) Disziplin-/Kontext-Gates
  const gated = applyGates(evidences, gateContext);

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
    },
  };
}

