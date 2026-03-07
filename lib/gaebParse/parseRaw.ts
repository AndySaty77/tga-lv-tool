/**
 * GAEB-Parsing: Rohtext-Fallback für kopierten Text / Tool-Export.
 */

import type { GaebParseResult, GaebParseMeta } from "./types";
import { hardCut, normalizeNewlines, stripHtml } from "./utils";
import { findCutIdx, splitVorbemerkungenVortext } from "../gaebExtract";

function countPositionsHeuristic(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const qtyMatches = t.match(/(?:^|\n)\s*(\d{1,6}\.\d{3})\s*(?:\n|$)/g);
  if (qtyMatches && qtyMatches.length > 0) return qtyMatches.length;
  return t.length > 50 ? 1 : 0;
}

export type ParseRawOpts = {
  filename?: string;
};

/**
 * Fallback-Parser für Rohtext ohne klares Format.
 * Nutzt dieselbe Cut-Logik wie Plain-Text, aber mit niedrigerer Konfidenz.
 */
export function parseRaw(raw: string, opts?: ParseRawOpts): GaebParseResult {
  const rawNorm = normalizeNewlines(hardCut(raw));
  const warnings: string[] = ["Rohtext-Fallback: keine Format-Erkennung"];
  const meta: GaebParseMeta = {
    filename: opts?.filename,
  };

  const cut = findCutIdx(rawNorm);
  const cutIdx = Math.max(0, Math.min(cut.cutIdx, rawNorm.length));

  meta.cutMethod = cut.method;

  const preCutRaw = rawNorm.slice(0, cutIdx);
  const positionsRaw = rawNorm.slice(cutIdx);

  const { vorbemerkungen, vortext } = splitVorbemerkungenVortext(preCutRaw);
  const prefaceText = [vorbemerkungen, vortext].filter(Boolean).join("\n\n").trim();

  const structureConfidence = cut.method === "fallback-no-cut-found" ? 0.2 : 0.4;
  if (cut.method === "fallback-no-cut-found") {
    warnings.push("Keine klare Trennung – gesamter Text als Vortext behandelt");
  }

  const cleanedText = stripHtml(rawNorm);
  const itemCount = countPositionsHeuristic(positionsRaw);

  return {
    formatDetected: "raw-text",
    parserUsed: "raw-fallback",
    rawText: rawNorm,
    cleanedText,
    meta,
    prefaceText,
    vorbemerkungenText: vorbemerkungen || undefined,
    vortextText: vortext || undefined,
    sectionTexts: [],
    itemTexts: positionsRaw,
    itemCount,
    structureConfidence,
    warnings,
  };
}
