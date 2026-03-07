/**
 * GAEB-Parsing: XML-Parser für strukturierte GAEB-DA-Dateien.
 */

import type { GaebParseResult, GaebParseMeta, GaebSection, GaebItem } from "./types";
import { hardCut, normalizeNewlines, stripHtml } from "./utils";

export type ParseXmlOpts = {
  filename?: string;
};

/**
 * Parst GAEB-XML und liefert einheitliche Struktur.
 * Fallback: wenn XML-Parsing fehlschlägt, wird cleanedText + Rohtext zurückgegeben.
 */
export function parseXml(raw: string, opts?: ParseXmlOpts): GaebParseResult {
  const rawNorm = normalizeNewlines(hardCut(raw));
  const warnings: string[] = [];
  const meta: GaebParseMeta = {
    filename: opts?.filename,
    exportTool: "gaeb-xml",
    cutMethod: "xml-parsed",
  };

  let prefaceText = "";
  const sectionTexts: GaebSection[] = [];
  let itemTexts = "";
  const items: GaebItem[] = [];
  let structureConfidence = 0.5;

  try {
    // Einfache Regex-basierte Extraktion (ohne DOM-Parser für Edge/Node-Kompatibilität)
    const projectMatch = rawNorm.match(/<Project[^>]*>[\s\S]*?<Name>([^<]*)<\/Name>/i)
      || rawNorm.match(/<ProjectName>([^<]*)<\/ProjectName>/i)
      || rawNorm.match(/<Bezeichnung>([^<]*)<\/Bezeichnung>/i);
    if (projectMatch) {
      meta.projectName = projectMatch[1].trim();
      meta.projectId = rawNorm.match(/<ProjectId>([^<]*)<\/ProjectId>/i)?.[1]?.trim();
    }

    // Vortext: Vorbemerkungen, Vertragsbedingungen aus XML
    const vorMatch = rawNorm.match(/<Vorbemerkungen[^>]*>([\s\S]*?)<\/Vorbemerkungen>/i)
      || rawNorm.match(/<Vortext[^>]*>([\s\S]*?)<\/Vortext>/i)
      || rawNorm.match(/<Preface[^>]*>([\s\S]*?)<\/Preface>/i);
    if (vorMatch) {
      prefaceText = stripHtml(vorMatch[1]).trim();
      structureConfidence = Math.min(1, structureConfidence + 0.2);
    }

    // Positionen: <Position>, <LvPosition>, <Pos>
    const posBlocks = rawNorm.matchAll(
      /<(?:Position|LvPosition|Pos)[^>]*>([\s\S]*?)<\/(?:Position|LvPosition|Pos)>/gi
    );
    const posArr: string[] = [];
    for (const m of posBlocks) {
      const block = stripHtml(m[1]).trim();
      if (block.length > 2) {
        posArr.push(block);
        const nr = block.match(/<PosNr[^>]*>([^<]*)<\/PosNr>/i)?.[1]?.trim()
          || block.match(/<Nr>([^<]*)<\/Nr>/i)?.[1]?.trim();
        const short = block.match(/<Kurztext[^>]*>([\s\S]*?)<\/Kurztext>/i)?.[1]?.trim()
          || block.match(/<ShortText[^>]*>([\s\S]*?)<\/ShortText>/i)?.[1]?.trim();
        const long = block.match(/<Langtext[^>]*>([\s\S]*?)<\/Langtext>/i)?.[1]?.trim()
          || block.match(/<LongText[^>]*>([\s\S]*?)<\/LongText>/i)?.[1]?.trim();
        const qty = block.match(/<Menge[^>]*>([^<]*)<\/Menge>/i)?.[1]?.trim()
          || block.match(/<Quantity[^>]*>([^<]*)<\/Quantity>/i)?.[1]?.trim();
        const unit = block.match(/<Einheit[^>]*>([^<]*)<\/Einheit>/i)?.[1]?.trim()
          || block.match(/<Unit[^>]*>([^<]*)<\/Unit>/i)?.[1]?.trim();
        if (nr || short || long || block) {
          items.push({
            posNr: nr,
            shortText: short ? stripHtml(short) : undefined,
            longText: long ? stripHtml(long) : undefined,
            quantity: qty,
            unit: unit,
            raw: block,
          });
        }
      }
    }
    itemTexts = posArr.join("\n\n");
    if (posArr.length > 0) structureConfidence = Math.min(1, structureConfidence + 0.3);

    // Abschnitte: <Titel>, <Section>
    const titelBlocks = rawNorm.matchAll(
      /<(?:Titel|Section|Abschnitt)[^>]*(?:Nr|Id)="?([^">]*)"?[^>]*>([\s\S]*?)<\/(?:Titel|Section|Abschnitt)>/gi
    );
    for (const m of titelBlocks) {
      const title = stripHtml(m[2]).trim();
      if (title.length > 0) {
        sectionTexts.push({ id: m[1]?.trim(), title });
      }
    }

    // Fallback: wenn kein Vortext aus XML, vor erstem <Position> nehmen
    if (!prefaceText && rawNorm.includes("<Position")) {
      const firstPos = rawNorm.indexOf("<Position");
      const pre = rawNorm.slice(0, firstPos);
      const textPart = pre.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (textPart.length > 50) {
        prefaceText = stripHtml(pre).trim();
        warnings.push("Vortext aus Text vor erstem <Position> rekonstruiert");
      }
    }

    if (items.length === 0 && !prefaceText) {
      warnings.push("Keine Positionen oder Vortext in XML gefunden");
      structureConfidence = 0.2;
    }
  } catch (e) {
    warnings.push(`XML-Parsing fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    structureConfidence = 0.1;
    prefaceText = "";
    itemTexts = stripHtml(rawNorm);
  }

  const cleanedText = stripHtml(rawNorm);

  return {
    formatDetected: "gaeb-xml",
    parserUsed: "xml-gaeb",
    rawText: rawNorm,
    cleanedText,
    meta,
    prefaceText,
    sectionTexts,
    itemTexts,
    items: items.length > 0 ? items : undefined,
    itemCount: items.length || (itemTexts ? 1 : 0),
    structureConfidence,
    warnings,
  };
}
