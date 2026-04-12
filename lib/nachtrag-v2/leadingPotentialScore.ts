/**
 * Eine führende Nachtragspotenzial-Kennzahl (0–100) für UI, Summary und PDF.
 * Wenn Nachtrag-V2 vorliegt: potentialScore aus v2Debug; sonst legacy overallIndex der Summary.
 */

export type LeadingPotentialInput = {
  overallIndex: number;
  v2Debug?: unknown;
};

export function leadingNachtragspotenzialScore(summary: LeadingPotentialInput): number {
  const v2 = summary.v2Debug;
  if (v2 != null && typeof v2 === "object") {
    const o = v2 as { potentialScore?: unknown; enforceabilityScore?: unknown };
    if (typeof o.potentialScore === "number" && typeof o.enforceabilityScore === "number") {
      return Math.max(0, Math.min(100, Math.round(o.potentialScore)));
    }
  }
  const idx = summary.overallIndex;
  if (typeof idx === "number" && Number.isFinite(idx)) {
    return Math.max(0, Math.min(100, Math.round(idx)));
  }
  return 0;
}

/** Ersetzt veraltete Index-Zahlen in Fließtext (z. B. gespeichertes Management-Summary). */
export function alignStoredTextNachtragIndexParagraphs(text: string, unifiedScore: number): string {
  if (!text.trim()) return text;
  let t = text;
  t = t.replace(/\(\s*Index\s+\d{1,3}\s*\/\s*100\s*\)/gi, `(Index ${unifiedScore}/100)`);
  t = t.replace(/\(\s*Nachtragspotenzial-Index\s+\d{1,3}\s*\/\s*100\s*\)/gi, `(Nachtragspotenzial-Index ${unifiedScore}/100)`);
  t = t.replace(/\bNachtragspotenzial-Index\s+\d{1,3}\s*\/\s*100\b/gi, `Nachtragspotenzial-Index ${unifiedScore}/100`);
  return t;
}
