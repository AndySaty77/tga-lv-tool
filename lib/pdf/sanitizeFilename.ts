/**
 * Sanitiert einen String für die Verwendung in Dateinamen.
 * Deutsche Sonderzeichen ersetzt, Kleinbuchstaben, Leerzeichen → Bindestriche.
 */

const UNSAFE = /[<>:"/\\|?*\x00-\x1f]/g;
const MULTI_DASH = /-+/g;
const TRIM_DASH = /^-|-$/g;

const DE_REPLACE: [RegExp, string][] = [
  [/ä/g, "ae"],
  [/ö/g, "oe"],
  [/ü/g, "ue"],
  [/ß/g, "ss"],
  [/Ä/g, "ae"],
  [/Ö/g, "oe"],
  [/Ü/g, "ue"],
];

/**
 * Erzeugt einen sicheren Dateinamen-Teil: Kleinbuchstaben, Sonderzeichen ersetzt,
 * Leerzeichen → Bindestriche, keine reservierten Zeichen.
 * Leerer Ergebnis-String → "report".
 */
export function sanitizeFilename(part: unknown): string {
  if (part == null) return "report";
  let s = String(part).trim();
  if (!s) return "report";
  for (const [re, replacement] of DE_REPLACE) {
    s = s.replace(re, replacement);
  }
  s = s.replace(UNSAFE, "-").replace(/\s+/g, "-").replace(MULTI_DASH, "-").replace(TRIM_DASH, "");
  s = s.toLowerCase();
  return s || "report";
}
