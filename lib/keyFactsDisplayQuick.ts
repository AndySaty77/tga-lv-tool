/**
 * Schnelle KeyFacts-12-Zeilen aus gespeichertem result_json (ohne Live-Validierung).
 * Zentraler Resolver: gleiche Plausibilität wie PDF + UI (siehe resolveRowPresentation).
 */

import { KEYFACTS_CORE_12 } from "@/lib/keyFactsDefinition";
import { isPlausibleKeyFactDisplayValue, KEYFACT_FALLBACK_LABEL } from "@/lib/keyFactsValidation";

export type KeyFactDisplayRow = { key: string; label: string; value: string; isFallback: boolean };

/** Ein Kern-KeyFact-Wert inkl. Fallback – für PDF/UI identisch. */
export function resolveKeyFactDisplayValue(
  key: string,
  raw: string | undefined | null,
  primaryTrade: string | null,
): { value: string; isFallback: boolean } {
  const v = raw != null ? String(raw).trim() : "";
  if (key === "gewerk") {
    if (v && isPlausibleKeyFactDisplayValue("gewerk", v)) return { value: v, isFallback: false };
    if (primaryTrade && isPlausibleKeyFactDisplayValue("gewerk", primaryTrade)) {
      return { value: primaryTrade, isFallback: false };
    }
    return { value: KEYFACT_FALLBACK_LABEL, isFallback: true };
  }
  if (!v) return { value: KEYFACT_FALLBACK_LABEL, isFallback: true };
  if (!isPlausibleKeyFactDisplayValue(key, v)) {
    return { value: KEYFACT_FALLBACK_LABEL, isFallback: true };
  }
  return { value: v, isFallback: false };
}

export function buildKeyFactsDisplayListQuick(rj: Record<string, unknown>): KeyFactDisplayRow[] {
  const kf =
    rj.keyFacts != null && typeof rj.keyFacts === "object" && !Array.isArray(rj.keyFacts)
      ? (rj.keyFacts as Record<string, string>)
      : {};
  const scoreResult = rj.scoreResult != null && typeof rj.scoreResult === "object" ? (rj.scoreResult as Record<string, unknown>) : {};
  const dt = scoreResult.detectedTrades as { primaryTrade?: string | null } | null | undefined;
  const primaryTrade = dt?.primaryTrade != null && String(dt.primaryTrade).trim() ? String(dt.primaryTrade).trim() : null;

  return KEYFACTS_CORE_12.map(({ key, label }) => {
    const raw = key === "gewerk" ? kf.gewerk : kf[key];
    const resolved = resolveKeyFactDisplayValue(key, raw, primaryTrade);
    return { key, label, value: resolved.value, isFallback: resolved.isFallback };
  });
}
