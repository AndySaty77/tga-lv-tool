import type { NachtragResultV2, NachtragSubscoresV2 } from "./types";
import type { AnchorEventResult, CommodityCapResult } from "./types";

function dominanceWeightedExposure(sub: NachtragSubscoresV2): number {
  const values = [
    sub.vertrags_abgrenzung,
    sub.ausfuehrung_mengen,
    sub.doku_ibn,
  ].sort((a, b) => b - a);
  const [first = 0, second = 0, third = 0] = values;

  const weighted = first * 0.6 + second * 0.3 + third * 0.1;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

function combineExposureAndEnforceability(exposure: number, enforceability: number): number {
  const e = Math.max(0, Math.min(100, exposure));
  const d = Math.max(0, Math.min(100, enforceability));

  if (e <= 5) return 0;

  // Konservativ: geometrisches Mittel, mit leichter Zusatzdämpfung bei schwacher Durchsetzbarkeit.
  let base = Math.sqrt(e * d);
  if (d < 30) {
    base *= 0.7;
  }
  if (d < 15) {
    base *= 0.5;
  }

  return Math.max(0, Math.min(100, Math.round(base)));
}

export function buildAggregateScores(
  subscores: NachtragSubscoresV2,
  normalizedEnforceability: number,
  anchors: AnchorEventResult[],
  caps: CommodityCapResult[]
): {
  exposureScore: number;
  enforceabilityScore: number;
  potentialScore: number;
  debug: {
    exposureComponents: {
      vertrags_abgrenzung: number;
      ausfuehrung_mengen: number;
      doku_ibn: number;
    };
  };
} {
  const anchorExposureBoost = anchors.reduce(
    (sum, a) => sum + (a.fired ? a.impactExposure ?? 0 : 0),
    0
  );
  const anchorEnforceabilityBoost = anchors.reduce(
    (sum, a) => sum + (a.fired ? a.impactEnforceability ?? 0 : 0),
    0
  );

  const exposureBase = dominanceWeightedExposure(subscores);
  const enforceabilityBase = normalizedEnforceability;

  const exposureScore = Math.max(
    0,
    Math.min(100, Math.round(exposureBase + anchorExposureBoost))
  );
  const enforceabilityScore = Math.max(
    0,
    Math.min(100, Math.round(enforceabilityBase + anchorEnforceabilityBoost))
  );

  const potentialScore = combineExposureAndEnforceability(exposureScore, enforceabilityScore);

  return {
    exposureScore,
    enforceabilityScore,
    potentialScore,
    debug: {
      exposureComponents: {
        vertrags_abgrenzung: subscores.vertrags_abgrenzung,
        ausfuehrung_mengen: subscores.ausfuehrung_mengen,
        doku_ibn: subscores.doku_ibn,
      },
    },
  };
}

