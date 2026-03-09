/**
 * Bereinigung und Aufbereitung von Text für die Anzeige (keine Fachlogik).
 * Entfernt HTML/XML-Fragmente, dekodiert HTML-Entities, erhält Absätze und Zeilenumbrüche.
 */

/** Dekodiert numerische HTML-Entities (&#123; und &#x7B;) für die Lesbarkeit. Reihenfolge unverändert. */
function decodeNumericHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return code <= 0xffff ? String.fromCharCode(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return code <= 0xffff ? String.fromCharCode(code) : "";
    });
}

/**
 * Entfernt HTML/XML-Fragmente für die Anzeige; dekodiert HTML-Entities; erhält Absätze und Zeilenumbrüche.
 * Nur Darstellung – keine inhaltliche Verfälschung, keine Umgruppierung.
 */
export function sanitizeForDisplay(input: string): string {
  let s = (input ?? "").toString();
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<\/?(?:p|div|br|tr|li|h[1-6])[^>]*>/gi, "\n");
  s = s.replace(/<\/?[^>]+>/g, " ");
  // Zuerst numerische Entities (&#x26; -> &, &#38; -> &), dann benannte
  s = decodeNumericHtmlEntities(s);
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * Teilt bereinigten Text in Absätze (Doppelzeilenumbruch = Absatz).
 */
export function toParagraphs(sanitizedText: string): string[] {
  if (!sanitizedText.trim()) return [];
  return sanitizedText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
}

/** Entfernt technische Metadaten aus Text für die reine Lesefläche (keine Fachlogik). */
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const VERSION_LIKE = /^\s*(v\d+\.\d+.*|version\s+\d+.*|rev\.?\s*\d+.*)\s*$/i;
const ONLY_CURRENCY = /^\s*(EUR|USD|CHF|GBP)\s*$/i;
const PARSER_META = /^\s*(parser|export|format|encoding|source):\s*.+$/i;

/**
 * Entfernt technische Informationen (UUIDs, Versions-, Parser-Metadaten, isolierte Währungscodes)
 * aus dem Text, damit sie nicht in der Dokumentlesefläche erscheinen.
 * Nur für Anzeige – keine inhaltliche Verfälschung des eigentlichen Inhalts.
 */
export function stripTechnicalNoiseForDisplay(input: string): string {
  let s = (input ?? "").toString();
  s = s.replace(UUID_REGEX, " ");
  const lines = s.split("\n");
  const filtered = lines
    .map((line) => line.replace(UUID_REGEX, " "))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => {
      if (!line) return false;
      if (VERSION_LIKE.test(line)) return false;
      if (ONLY_CURRENCY.test(line)) return false;
      if (PARSER_META.test(line)) return false;
      return true;
    });
  s = filtered.join("\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
