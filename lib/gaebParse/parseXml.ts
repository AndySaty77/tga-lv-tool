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

    // Positionen: <Position>, <LvPosition>, <Pos>, <Item> (DA83)
    const posBlocks = rawNorm.matchAll(
      /<(?:Position|LvPosition|Pos|Item)[^>]*>([\s\S]*?)<\/(?:Position|LvPosition|Pos|Item)>/gi
    );
    const posArr: string[] = [];
    for (const m of posBlocks) {
      const innerXml = m[1] ?? "";
      const block = stripHtml(innerXml).trim();
      if (block.length > 2) {
        posArr.push(block);

        // Strukturierte Positionsfelder aus dem unveränderten XML-Block lesen
        const nr =
          innerXml.match(/<PosNr[^>]*>([^<]*)<\/PosNr>/i)?.[1]?.trim() ||
          innerXml.match(/<Nr>([^<]*)<\/Nr>/i)?.[1]?.trim() ||
          innerXml.match(/<ItemNo[^>]*>([^<]*)<\/ItemNo>/i)?.[1]?.trim();

        const shortRaw =
          innerXml.match(/<Kurztext[^>]*>([\s\S]*?)<\/Kurztext>/i)?.[1] ||
          innerXml.match(/<ShortText[^>]*>([\s\S]*?)<\/ShortText>/i)?.[1] ||
          innerXml.match(/<OutlineAddText[^>]*>([\s\S]*?)<\/OutlineAddText>/i)?.[1];

        const longRaw =
          innerXml.match(/<Langtext[^>]*>([\s\S]*?)<\/Langtext>/i)?.[1] ||
          innerXml.match(/<LongText[^>]*>([\s\S]*?)<\/LongText>/i)?.[1] ||
          innerXml.match(/<DetailAddText[^>]*>([\s\S]*?)<\/DetailAddText>/i)?.[1] ||
          innerXml.match(/<AddText[^>]*>([\s\S]*?)<\/AddText>/i)?.[1];

        const qty =
          innerXml.match(/<Menge[^>]*>([^<]*)<\/Menge>/i)?.[1]?.trim() ||
          innerXml.match(/<Quantity[^>]*>([^<]*)<\/Quantity>/i)?.[1]?.trim() ||
          innerXml.match(/<Qty[^>]*>([^<]*)<\/Qty>/i)?.[1]?.trim();

        const unit =
          innerXml.match(/<Einheit[^>]*>([^<]*)<\/Einheit>/i)?.[1]?.trim() ||
          innerXml.match(/<Unit[^>]*>([^<]*)<\/Unit>/i)?.[1]?.trim() ||
          innerXml.match(/<(?:Uom|QtyUnit)[^>]*>([^<]*)<\/(?:Uom|QtyUnit)>/i)?.[1]?.trim();

        const short = shortRaw ? stripHtml(shortRaw).trim() : undefined;
        const long = longRaw ? stripHtml(longRaw).trim() : undefined;

        if (nr || short || long || block) {
          items.push({
            posNr: nr,
            shortText: short,
            longText: long,
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

    // Fallback: wenn kein Vortext aus XML, vor erstem Positions-/Item-Knoten nehmen
    if (!prefaceText && (rawNorm.includes("<Position") || rawNorm.includes("<Item"))) {
      const firstPosIdx = rawNorm.search(/<(?:Position|LvPosition|Pos|Item)\b/i);
      if (firstPosIdx !== -1) {
        const pre = rawNorm.slice(0, firstPosIdx);
        // Bevorzugt AddText-/OutlineAddText-/DetailAddText-Blöcke im Kopfbereich
        const addBlocks = pre.matchAll(
          /<(?:AddText|OutlineAddText|DetailAddText)[^>]*>([\s\S]*?)<\/(?:AddText|OutlineAddText|DetailAddText)>/gi
        );
        const addTexts: string[] = [];
        for (const a of addBlocks) {
          const t = stripHtml(a[1] ?? "").trim();
          if (t.length > 0) addTexts.push(t);
        }
        if (addTexts.length > 0) {
          prefaceText = addTexts.join("\n\n").trim();
        } else {
          const textPart = pre.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (textPart.length > 50) {
            prefaceText = stripHtml(pre).trim();
          }
        }
        if (prefaceText.length > 0) {
          warnings.push("Vortext aus Kopfbereich vor erster Position/Item rekonstruiert");
        }
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
