/**
 * Viewer-Normalisierung für die Kundenansicht (Tabs Vorbemerkungen + Positionen).
 * Nur für die Darstellung – keine Analyse-, Score- oder Parser-Änderung.
 * Reihenfolge der Inhalte bleibt erhalten; nur typische Export-/Strukturmarker
 * werden für die Anzeige entschärft.
 */

/** HTML-Entities für die Anzeige dekodieren (nur Darstellung). */
function decodeHtmlEntities(s: string): string {
  let t = (s ?? "").toString();
  t = t
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return code <= 0xffff ? String.fromCharCode(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return code <= 0xffff ? String.fromCharCode(code) : "";
    });
  t = t
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return t.replace(/\u00A0/g, " ");
}

/** Zeilen, die ausschließlich typische Export-/Strukturmarker sind (ganze Zeile, case-insensitive). Keine fachlichen Inhalte. */
const VIEWER_NOISE_LINE_SET = new Set([
  "alltxt",
  "boqlevel",
  "item",
  "yes",
  "bereich",
]);

/** Prüft, ob eine Zeile nur aus bekannten Marker-Tokens besteht (getrennt durch Leerzeichen). */
function isOnlyMarkerLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (VIEWER_NOISE_LINE_SET.has(lower)) return true;
  const tokens = trimmed.split(/\s+/).map((t) => t.toLowerCase());
  if (tokens.length > 1 && tokens.every((t) => VIEWER_NOISE_LINE_SET.has(t))) return true;
  return false;
}

/**
 * Rohtext für die Vorbemerkungen-Lesansicht aufbereiten.
 * Nur Anzeige – Reihenfolge bleibt, nur technische Marker-Zeilen und Formatierung angepasst.
 */
export function normalizeViewerVorbemerkungenText(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let s = decodeHtmlEntities(raw);
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = s.split("\n");
  const filtered = lines
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => !isOnlyMarkerLine(line));
  s = filtered.join("\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * Rohtext für die Positionen-Lesansicht aufbereiten.
 * Nur Anzeige – Reihenfolge bleibt, nur technische Marker-Zeilen und Formatierung angepasst.
 */
export function normalizeViewerPositionenText(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let s = decodeHtmlEntities(raw);
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = s.split("\n");
  const filtered = lines
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => !isOnlyMarkerLine(line));
  s = filtered.join("\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
