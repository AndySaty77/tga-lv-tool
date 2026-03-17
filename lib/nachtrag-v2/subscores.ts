import type { NachtragEvidenceV2, NachtragSubscoresV2 } from "./types";

function emptySubscores(): NachtragSubscoresV2 {
  return {
    vertrags_abgrenzung: 0,
    ausfuehrung_mengen: 0,
    doku_ibn: 0,
    durchsetzbarkeit: 0,
  };
}

function normalizeRaw(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  const eased = Math.log10(1 + x);
  return Math.max(0, Math.min(100, Math.round(eased * 30)));
}

export function buildSubscores(evidences: NachtragEvidenceV2[]): {
  subscoresRaw: NachtragSubscoresV2;
  subscores: NachtragSubscoresV2;
} {
  const raw = emptySubscores();

  for (const ev of evidences) {
    const w = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
    if (w <= 0) continue;

    for (const key of ev.subscoreTargets) {
      raw[key] += w;
    }
  }

  const normalized: NachtragSubscoresV2 = {
    vertrags_abgrenzung: normalizeRaw(raw.vertrags_abgrenzung),
    ausfuehrung_mengen: normalizeRaw(raw.ausfuehrung_mengen),
    doku_ibn: normalizeRaw(raw.doku_ibn),
    durchsetzbarkeit: normalizeRaw(raw.durchsetzbarkeit),
  };

  return { subscoresRaw: raw, subscores: normalized };
}

