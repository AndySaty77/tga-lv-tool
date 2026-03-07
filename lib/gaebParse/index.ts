/**
 * GAEB-Parsing: robuste Parsing-/Strukturstufe für verschiedene GAEB-/Exportformen.
 */

export { parse } from "./parse";
export type { GaebParseResult, GaebParseOpts, GaebFormat, GaebParser, GaebParseMeta, GaebSection, GaebItem } from "./types";
export { detectFormat } from "./detectFormat";
export type { FormatDetectionResult } from "./detectFormat";
export { parseXml } from "./parseXml";
export { parseText } from "./parseText";
export { parseRaw } from "./parseRaw";
