/**
 * GAEB-Parsing: XML-Parser für strukturierte GAEB-DA-Dateien.
 */

import type { GaebParseResult, GaebParseMeta, GaebSection, GaebItem } from "./types";
import { hardCut, normalizeNewlines, stripHtml, MAX_XML_PARSING_CHARS } from "./utils";

export type ParseXmlOpts = {
  filename?: string;
};

/**
 * Parst GAEB-XML und liefert einheitliche Struktur.
 * Fallback: wenn XML-Parsing fehlschlägt, wird cleanedText + Rohtext zurückgegeben.
 */
export function parseXml(raw: string, opts?: ParseXmlOpts): GaebParseResult {
  const rawNorm = normalizeNewlines(hardCut(raw, MAX_XML_PARSING_CHARS));
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
    const extractTagValue = (xml: string, tagName: string): string => {
      const re = new RegExp(`<(?:[a-zA-Z_][\\w.-]*:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z_][\\w.-]*:)?${tagName}>`, "i");
      const m = xml.match(re);
      if (!m?.[1]) return "";
      return stripHtml(m[1]).replace(/\s+/g, " ").trim();
    };

    const lblPrj = extractTagValue(rawNorm, "LblPrj");
    const namePrj = extractTagValue(rawNorm, "NamePrj");
    const prjName = extractTagValue(rawNorm, "PrjName");
    const projectNameTag = extractTagValue(rawNorm, "ProjectName");
    const projectMatch = rawNorm.match(/<Project[^>]*>[\s\S]*?<Name>([^<]*)<\/Name>/i)
      || rawNorm.match(/<ProjectName>([^<]*)<\/ProjectName>/i)
      || rawNorm.match(/<Bezeichnung>([^<]*)<\/Bezeichnung>/i);

    // LblPrj ist für Anzeigenamen i.d.R. die bessere Quelle als NamePrj (oft nur numerische Projektnummer).
    const metaProjectName =
      (lblPrj && lblPrj.trim()) ||
      (prjName && prjName.trim()) ||
      (projectNameTag && projectNameTag.trim()) ||
      (namePrj && !/^\d{1,12}$/.test(namePrj.trim()) ? namePrj.trim() : "") ||
      (projectMatch?.[1]?.trim() ?? "");

    if (metaProjectName) meta.projectName = metaProjectName;
    if (namePrj) (meta as GaebParseMeta & { namePrj?: string }).namePrj = namePrj;
    if (lblPrj) (meta as GaebParseMeta & { lblPrj?: string }).lblPrj = lblPrj;
    if (prjName) (meta as GaebParseMeta & { prjName?: string }).prjName = prjName;
    if (projectNameTag) (meta as GaebParseMeta & { projectNameTag?: string }).projectNameTag = projectNameTag;

    // Einfache Regex-basierte Extraktion (ohne DOM-Parser für Edge/Node-Kompatibilität)
    if (projectMatch) {
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

    // Positionen: <Position>, <LvPosition>, <Pos>, <Item> (DA83/X83); namespace-robust (optional prefix z. B. da83:)
    const posTagRegex =
      /<(?:[a-zA-Z_][\w.-]*:)?(?:Position|LvPosition|Pos|Item)\s[^>]*>([\s\S]*?)<\/(?:[a-zA-Z_][\w.-]*:)?(?:Position|LvPosition|Pos|Item)\s*>/gi;
    const posBlocks = rawNorm.matchAll(posTagRegex);
    const posArr: string[] = [];
    const rnoPartAttr = /RNoPart\s*=\s*["']([^"']*)["']/i;
    for (const m of posBlocks) {
      const fullTag = m[0];
      const innerXml = m[1] ?? "";
      const block = stripHtml(innerXml).trim();
      if (block.length > 2) {
        posArr.push(block);

        const openTag = fullTag.match(/<(?:[a-zA-Z_][\w.-]*:)?(?:Position|LvPosition|Pos|Item)\s([^>]*)>/i);
        const itemAttrs = openTag?.[1] ?? "";
        const rnoFromAttr = itemAttrs.match(rnoPartAttr)?.[1]?.trim();
        const nr =
          rnoFromAttr ||
          innerXml.match(/<RNoPart[^>]*>([^<]*)<\/RNoPart>/i)?.[1]?.trim() ||
          innerXml.match(/<PosNr[^>]*>([^<]*)<\/PosNr>/i)?.[1]?.trim() ||
          innerXml.match(/<Nr>([^<]*)<\/Nr>/i)?.[1]?.trim() ||
          innerXml.match(/<ItemNo[^>]*>([^<]*)<\/ItemNo>/i)?.[1]?.trim();

        const shortRaw =
          innerXml.match(/<Kurztext[^>]*>([\s\S]*?)<\/Kurztext>/i)?.[1] ||
          innerXml.match(/<ShortText[^>]*>([\s\S]*?)<\/ShortText>/i)?.[1] ||
          innerXml.match(/<OutlineAddText[^>]*>([\s\S]*?)<\/OutlineAddText>/i)?.[1];

        let longRaw =
          innerXml.match(/<Langtext[^>]*>([\s\S]*?)<\/Langtext>/i)?.[1] ||
          innerXml.match(/<LongText[^>]*>([\s\S]*?)<\/LongText>/i)?.[1] ||
          innerXml.match(/<DetailAddText[^>]*>([\s\S]*?)<\/DetailAddText>/i)?.[1] ||
          innerXml.match(/<AddText[^>]*>([\s\S]*?)<\/AddText>/i)?.[1];
        if (!longRaw && /<Description[^>]*>/i.test(innerXml)) {
          const descBlock = innerXml.match(/<Description[^>]*>([\s\S]*?)<\/Description>/i)?.[1];
          if (descBlock) {
            longRaw =
              descBlock.match(/<DetailTxt[^>]*>([\s\S]*?)<\/DetailTxt>/i)?.[1] ||
              descBlock.match(/<CompleteText[^>]*>([\s\S]*?)<\/CompleteText>/i)?.[1];
          }
        }
        if (!longRaw) {
          longRaw = innerXml.match(/<DetailTxt[^>]*>([\s\S]*?)<\/DetailTxt>/i)?.[1];
        }

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
      const firstPosIdx = rawNorm.search(/<(?:[a-zA-Z_][\w.-]*:)?(?:Position|LvPosition|Pos|Item)\s/i);
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
