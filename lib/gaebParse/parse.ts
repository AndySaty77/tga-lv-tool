/**
 * GAEB-Parsing: zentrale parse()-Funktion mit Format-Erkennung.
 * Einheitliche Struktur für alle GAEB-/Exportformen.
 */

import type { GaebParseResult, GaebParseOpts } from "./types";
import { detectFormat } from "./detectFormat";
import { parseXml } from "./parseXml";
import { parseText } from "./parseText";
import { parseRaw } from "./parseRaw";

/**
 * Parst GAEB-Inhalt (XML, Plain-Text, Rohtext) und liefert einheitliche Struktur.
 */
export function parse(raw: string, opts?: GaebParseOpts): GaebParseResult {
  const { format, parser, confidence: detectedConfidence } = detectFormat(raw);
  const filename = opts?.filename;

  let result: GaebParseResult;

  switch (parser) {
    case "xml-gaeb":
      result = parseXml(raw, { filename });
      break;
    case "text-californiax":
    case "text-dangl":
    case "text-generic":
      result = parseText(raw, { filename, parser });
      break;
    default:
      result = parseRaw(raw, { filename });
  }

  // Konfidenz aus Format-Erkennung mit einbeziehen
  const combinedConfidence = (result.structureConfidence + detectedConfidence) / 2;
  result.structureConfidence = Math.min(1, Math.round(combinedConfidence * 100) / 100);

  result.meta.formatDetected = format;
  result.meta.parserUsed = parser;

  return result;
}
