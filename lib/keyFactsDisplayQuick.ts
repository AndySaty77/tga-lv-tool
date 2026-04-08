/**
 * Schnelle KeyFacts-12-Zeilen aus gespeichertem result_json (ohne Live-Validierung).
 * Defensiv: gleiche Grob-Logik wie die Cockpit-Fallback-Pfade (Gewerk → primaryTrade).
 */

import { KEYFACTS_CORE_12 } from "@/lib/keyFactsDefinition";
import { KEYFACT_FALLBACK_LABEL } from "@/lib/keyFactsValidation";

export type KeyFactDisplayRow = { key: string; label: string; value: string; isFallback: boolean };

export function buildKeyFactsDisplayListQuick(rj: Record<string, unknown>): KeyFactDisplayRow[] {
  const kf =
    rj.keyFacts != null && typeof rj.keyFacts === "object" && !Array.isArray(rj.keyFacts)
      ? (rj.keyFacts as Record<string, string>)
      : {};
  const scoreResult = rj.scoreResult != null && typeof rj.scoreResult === "object" ? (rj.scoreResult as Record<string, unknown>) : {};
  const dt = scoreResult.detectedTrades as { primaryTrade?: string | null } | null | undefined;
  const primaryTrade = dt?.primaryTrade != null && String(dt.primaryTrade).trim() ? String(dt.primaryTrade).trim() : null;

  return KEYFACTS_CORE_12.map(({ key, label }) => {
    if (key === "gewerk") {
      const raw = kf.gewerk;
      if (raw != null && String(raw).trim()) {
        return { key, label, value: String(raw).trim(), isFallback: false };
      }
      if (primaryTrade) {
        return { key, label, value: primaryTrade, isFallback: false };
      }
      return { key, label, value: KEYFACT_FALLBACK_LABEL, isFallback: true };
    }
    const raw = kf[key];
    const v = raw != null ? String(raw).trim() : "";
    if (v) {
      return { key, label, value: v, isFallback: false };
    }
    return { key, label, value: KEYFACT_FALLBACK_LABEL, isFallback: true };
  });
}
