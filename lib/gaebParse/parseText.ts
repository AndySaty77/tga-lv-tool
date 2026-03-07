/**
 * GAEB-Parsing: Plain-Text-Parser (CaliforniaX, Dangl, generisch).
 */

import type { GaebParseResult, GaebParseMeta, GaebSection, GaebParser } from "./types";
import { hardCut, normalizeNewlines, stripHtml } from "./utils";
import { findCutIdx, splitVorbemerkungenVortext } from "../gaebExtract";

function countPositionsHeuristic(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  // CaliforniaX-Mengenblock: Zeile mit 123.456
  const qtyMatches = t.match(/(?:^|\n)\s*(\d{1,6}\.\d{3})\s*(?:\n|$)/g);
  if (qtyMatches && qtyMatches.length > 0) return qtyMatches.length;
  // TITEL n: als Abschnitt, nicht als Position
  const titelCount = (t.match(/(?:^|\n)TITEL\s+\d+\s*:/gi) ?? []).length;
  if (titelCount > 0 && t.length > 200) return Math.max(1, titelCount);
  return t.length > 50 ? 1 : 0;
}

export type ParseTextOpts = {
  filename?: string;
  parser: GaebParser;
};

/**
 * Parst Plain-Text-Export und liefert einheitliche Struktur.
 */
export function parseText(raw: string, opts: ParseTextOpts): GaebParseResult {
  const rawNorm = normalizeNewlines(hardCut(raw));
  const warnings: string[] = [];
  const meta: GaebParseMeta = {
    filename: opts?.filename,
    exportTool: opts.parser === "text-californiax" ? "CaliforniaX" : opts.parser === "text-dangl" ? "Dangl" : undefined,
  };

  const cut = findCutIdx(rawNorm);
  const cutIdx = Math.max(0, Math.min(cut.cutIdx, rawNorm.length));

  meta.cutMethod = cut.method;

  const preCutRaw = rawNorm.slice(0, cutIdx);
  const positionsRaw = rawNorm.slice(cutIdx);

  const { vorbemerkungen, vortext } = splitVorbemerkungenVortext(preCutRaw);
  const prefaceText = [vorbemerkungen, vortext].filter(Boolean).join("\n\n").trim();

  let structureConfidence = 0.6;
  if (cut.method.startsWith("anchor-") || cut.method === "anchor-titel-n") {
    structureConfidence = 0.85;
  } else if (cut.method === "xml-marker" || cut.method === "fallback-qty-unit") {
    structureConfidence = 0.7;
  } else if (cut.method === "fallback-no-cut-found") {
    structureConfidence = 0.3;
    warnings.push("Keine klare Trennung zwischen Vortext und Positionen gefunden");
  }

  // Abschnitte: TITEL n: aus CaliforniaX
  const sectionTexts: GaebSection[] = [];
  const titelRe = /(?:^|\n)(TITEL\s+\d+\s*:[^\n]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = titelRe.exec(positionsRaw)) !== null) {
    const title = m[1].trim();
    if (title.length > 2) {
      sectionTexts.push({ title });
    }
  }

  const cleanedText = stripHtml(rawNorm);

  // Heuristische Positionsanzahl (CaliforniaX: 123.456, Mengenblock)
  const itemCount = countPositionsHeuristic(positionsRaw);

  return {
    formatDetected: "plain-text",
    parserUsed: opts.parser,
    rawText: rawNorm,
    cleanedText,
    meta,
    prefaceText,
    vorbemerkungenText: vorbemerkungen || undefined,
    vortextText: vortext || undefined,
    sectionTexts,
    itemTexts: positionsRaw,
    itemCount,
    structureConfidence,
    warnings,
  };
}
