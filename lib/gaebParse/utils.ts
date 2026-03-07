/**
 * GAEB-Parsing: gemeinsame Hilfsfunktionen.
 */

export const HARD_MAX_CHARS = 200_000;

export function hardCut(s: string, max: number = HARD_MAX_CHARS): string {
  const t = (s ?? "").toString();
  return t.length > max ? t.slice(0, max) : t;
}

export function normalizeNewlines(s: string): string {
  return (s ?? "").toString().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function stripHtml(input: string): string {
  let s = (input ?? "").toString();
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<\/?[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\s*\n\s*/g, "\n");
  return s.trim();
}

export function clampIdx(idx: number, len: number): number {
  if (!Number.isFinite(idx)) return 0;
  return Math.max(0, Math.min(idx, len));
}
