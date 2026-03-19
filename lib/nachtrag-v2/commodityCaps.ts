import type { NachtragEvidenceV2, CommodityCapResult } from "./types";
import type { NachtragFamilyId } from "./families";

type CommodityCapRule = {
  family: NachtragFamilyId;
  cap: number;
};

// Defensive Defaults: Caps auf technische Familien und Schnittstellen.
const DEFAULT_COMMODITY_CAPS: CommodityCapRule[] = [
  { family: "schnittstelle", cap: 8 },
  { family: "schnittstelle_bau", cap: 8 },
  { family: "heizung", cap: 6 },
  { family: "lueftung", cap: 6 },
  { family: "sanitaer", cap: 6 },
  { family: "elektro", cap: 6 },
  { family: "msr", cap: 6 },
  { family: "bau", cap: 8 },
];

export type ApplyCommodityCapsOptions = {
  rules?: CommodityCapRule[];
};

export function applyCommodityCaps(
  evidences: NachtragEvidenceV2[],
  opts: ApplyCommodityCapsOptions = {}
): { cappedEvidences: NachtragEvidenceV2[]; caps: CommodityCapResult[] } {
  const rules = opts.rules ?? DEFAULT_COMMODITY_CAPS;

  const byFamily = new Map<string, { raw: number; evidences: NachtragEvidenceV2[] }>();

  for (const ev of evidences) {
    const family = ev.family || "unknown";
    const weight = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 1;
    if (!byFamily.has(family)) {
      byFamily.set(family, { raw: 0, evidences: [] });
    }
    const bucket = byFamily.get(family)!;
    bucket.raw += weight;
    bucket.evidences.push(ev);
  }

  const caps: CommodityCapResult[] = [];
  const cappedEvidences: NachtragEvidenceV2[] = [];

  for (const [family, bucket] of byFamily.entries()) {
    const rule = rules.find((r) => r.family === (family as NachtragFamilyId));
    if (!rule) {
      cappedEvidences.push(...bucket.evidences);
      continue;
    }

    const cap = rule.cap;
    const factor = bucket.raw > 0 ? Math.min(1, cap / bucket.raw) : 1;

    for (const ev of bucket.evidences) {
      const w = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 1;
      cappedEvidences.push({
        ...ev,
        rawWeight: w * factor,
      });
    }

    caps.push({
      family,
      raw: bucket.raw,
      capped: bucket.raw * factor,
      cap,
    });
  }

  return { cappedEvidences, caps };
}

export function getActiveCommodityCaps(): CommodityCapRule[] {
  return [...DEFAULT_COMMODITY_CAPS];
}

