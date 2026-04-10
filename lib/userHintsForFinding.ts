/**
 * Nutzertaugliche Prüfhinweise aus `triggers.user_hint` / Finding-Feldern.
 * Nur Anzeige-Logik – keine Scoring-/Engine-Auswirkung.
 */

export const MAX_PRUEF_HINWEISE_STANDARD = 3;

function normalizeHintKey(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Dedupliziert nach normalisiertem Text; behält jeweils die erste Originalform. */
export function dedupeUserHints(candidates: (string | null | undefined)[], max: number = MAX_PRUEF_HINWEISE_STANDARD): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const t = typeof c === "string" ? c.trim() : "";
    if (!t) continue;
    const k = normalizeHintKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

type FindingHintFields = {
  user_hints?: string[] | null;
  user_hint?: string | null;
};

/**
 * Liste für Standard-UI / PDF / Bericht: bevorzugt `user_hints`, sonst einzelnes `user_hint`.
 */
export function collectPruefHinweiseFromFinding(f: FindingHintFields, max: number = MAX_PRUEF_HINWEISE_STANDARD): string[] {
  if (Array.isArray(f.user_hints) && f.user_hints.length > 0) {
    return dedupeUserHints(f.user_hints, max);
  }
  return dedupeUserHints([f.user_hint], max);
}
