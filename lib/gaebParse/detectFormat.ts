/**
 * GAEB-Parsing: Format- und Parser-Erkennung.
 */

import type { GaebFormat, GaebParser } from "./types";
import { normalizeNewlines } from "./utils";

export type FormatDetectionResult = {
  format: GaebFormat;
  parser: GaebParser;
  confidence: number;
  hints: string[];
};

/**
 * Erkennt das GAEB-Format und den passenden Parser.
 */
export function detectFormat(raw: string): FormatDetectionResult {
  const t = normalizeNewlines((raw ?? "").toString()).trim();
  const lower = t.toLowerCase();
  const hints: string[] = [];

  // 1) XML / strukturierter GAEB
  const xmlRootMatch = /<\s*(\w+)[\s>]/.exec(t);
  if (xmlRootMatch) {
    const root = xmlRootMatch[1].toLowerCase();
    if (
      root.includes("gaeb") ||
      root.includes("exchange") ||
      root.includes("project") ||
      root.includes("lev") ||
      root.includes("position")
    ) {
      hints.push(`XML-Root: ${root}`);
      return {
        format: "gaeb-xml",
        parser: "xml-gaeb",
        confidence: root.includes("gaeb") ? 0.95 : 0.8,
        hints,
      };
    }
    if (root === "xml" || t.startsWith("<?xml")) {
      hints.push("XML-Deklaration erkannt");
      return {
        format: "gaeb-xml",
        parser: "xml-gaeb",
        confidence: 0.7,
        hints,
      };
    }
  }

  // 2) Plain-Text-Export (CaliforniaX, Dangl, etc.)
  if (lower.includes("californiax")) {
    hints.push("CaliforniaX-Export erkannt");
    return {
      format: "plain-text",
      parser: "text-californiax",
      confidence: 0.9,
      hints,
    };
  }
  if (lower.includes("einrichtungsgegenstände") || lower.includes("dangl")) {
    hints.push("Dangl-Export erkannt");
    return {
      format: "plain-text",
      parser: "text-dangl",
      confidence: 0.9,
      hints,
    };
  }

  // Typische Plain-Text-Marker
  const hasTitelN = /(?:^|\n)titel\s+\d+\s*:/i.test(t);
  const hasQtyUnit = /(?:^|\n)\s*\d{1,6}\.\d{3}\s*\n\s*(m|st|kg|t|l|h|std|psch|m2|m²|m3|m³)\s*\n/i.test(t);
  const hasXmlMarker = /<lvpos|<position|<pos/i.test(lower);
  const hasVertragsbedingungen = /vertragsbedingungen|vob\s*teil|allgemeine\s+vertragsbedingungen/i.test(lower);

  if (hasTitelN || hasQtyUnit || hasXmlMarker) {
    hints.push(hasTitelN ? "TITEL n: gefunden" : hasQtyUnit ? "Mengenblock gefunden" : "XML-Marker gefunden");
    return {
      format: "plain-text",
      parser: hasTitelN ? "text-californiax" : "text-generic",
      confidence: 0.85,
      hints,
    };
  }

  if (hasVertragsbedingungen && t.length > 500) {
    hints.push("Vertragsbedingungen + Länge: Plain-Text");
    return {
      format: "plain-text",
      parser: "text-generic",
      confidence: 0.6,
      hints,
    };
  }

  // 3) Rohtext-Fallback
  hints.push("Kein klares Format – Rohtext-Fallback");
  return {
    format: "raw-text",
    parser: "raw-fallback",
    confidence: 0.3,
    hints,
  };
}
