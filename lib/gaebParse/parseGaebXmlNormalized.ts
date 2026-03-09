/**
 * GAEB XML / X83 → normalisierte Preview-Struktur (Gruppen, Hinweise, Positionen).
 * Mappings: BoQCtgy (RNoPart, LblTx), Remark > Description > CompleteText > DetailTxt, Item (RNoPart, Qty, QU, OutlineText, DetailTxt).
 */

import type {
  GaebPreviewNormalized,
  GaebPreviewGroup,
  GaebPreviewRemark,
  GaebPreviewItem,
  GaebPreviewDisplayNode,
} from "../gaebPreviewModel";
import type { RemarkScope } from "../gaebPreviewModel";
import {
  richTextToPlainText,
  richTextToPlainTextWithParagraphs,
  extractOutlineText,
  extractDetailTxt,
  buildPositionNumberFromHierarchy,
  looksLikePrefaceLabel,
} from "../gaebPreviewModel";
import { normalizeNewlines } from "./utils";
import { formatRemarkOrLabelText } from "./textFormatting";

const RX_LBLTX = /<LblTx[^>]*>([\s\S]*?)<\/LblTx>/i;
const RX_RNOPART_ATTR = /RNoPart\s*=\s*["']([^"']*)["']/i;
const RX_RNOPART_ELEMENT = /<RNoPart[^>]*>([^<]*)<\/RNoPart>/i;
const RX_DETAIL_TXT_IN_REMARK = /<DetailTxt[^>]*>([\s\S]*?)<\/DetailTxt>/i;
/** Item mit optionalem XML-Namespace-Prefix (z. B. da83:Item) für X83/DA83. */
const RX_ITEM_BLOCK = /<(?:[a-zA-Z_][\w.-]*:)?Item\s[^>]*>([\s\S]*?)<\/(?:[a-zA-Z_][\w.-]*:)?Item\s*>/gi;
/** BoQCtgy mit optionalem Namespace-Prefix. */
const RX_BOQCTGY = /<(?:[a-zA-Z_][\w.-]*:)?BoQCtgy\s[^>]*>([\s\S]*?)<\/(?:[a-zA-Z_][\w.-]*:)?BoQCtgy\s*>/gi;

/** Findet alle <TagName>…</TagName>-Blöcke in XML-Reihenfolge, inkl. verschachtelter. */
function findAllTagRanges(xml: string, tagName: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  const stack: number[] = [];
  const reOpen = new RegExp("<" + tagName + "[\\s>]", "i");
  const reClose = new RegExp("</" + tagName + "\\s*>", "i");
  let pos = 0;
  while (pos < xml.length) {
    const nextOpen = xml.slice(pos).search(reOpen);
    const nextClose = xml.slice(pos).search(reClose);
    const openIdx = nextOpen >= 0 ? pos + nextOpen : -1;
    const closeMatch = nextClose >= 0 ? xml.slice(pos + nextClose).match(reClose) : null;
    const closeTagLen = closeMatch?.[0]?.length ?? 10;
    const closeEnd = nextClose >= 0 ? pos + nextClose + closeTagLen : -1;

    if (openIdx < 0 && closeEnd < 0) break;
    if (closeEnd >= 0 && (openIdx < 0 || closeEnd <= openIdx)) {
      if (stack.length > 0) {
        const start = stack.pop()!;
        ranges.push({ start, end: closeEnd });
      }
      pos = closeEnd;
      continue;
    }
    if (openIdx >= 0) {
      stack.push(openIdx);
      pos = openIdx + 1;
    }
  }
  return ranges;
}

function findAllRemarkRanges(xml: string): { start: number; end: number }[] {
  return findAllTagRanges(xml, "Remark");
}

function extractRemarkText(innerXml: string): string {
  const detailMatch = innerXml.match(RX_DETAIL_TXT_IN_REMARK)
    || innerXml.match(/<CompleteText[^>]*>([\s\S]*?)<\/CompleteText>/i)
    || innerXml.match(/<Description[^>]*>([\s\S]*?)<\/Description>/i);
  const raw = detailMatch ? detailMatch[1] : innerXml;
  return richTextToPlainTextWithParagraphs(raw ?? "").trim();
}

function getRNoPartFromAttrs(attrs: string): string | undefined {
  const m = attrs.match(RX_RNOPART_ATTR);
  return m ? m[1].trim() : undefined;
}

function getLblTxFromInner(inner: string): string {
  const m = inner.match(RX_LBLTX);
  return m ? richTextToPlainText(m[1]) : "";
}

/**
 * Parst GAEB-XML und liefert normalisierte Struktur für die Preview-UI.
 * Bestehende parseXml()-Ergebnisse werden nicht verändert; diese Funktion ist nur für die Anzeige.
 */
export function parseGaebXmlNormalized(raw: string): GaebPreviewNormalized {
  const groups: GaebPreviewGroup[] = [];
  const remarks: GaebPreviewRemark[] = [];
  const items: GaebPreviewItem[] = [];
  const norm = normalizeNewlines(raw);

  // --- Gruppen: BoQCtgy mit RNoPart und LblTx (namespace-robust) ---
  const boqCtgyBlocks = [...norm.matchAll(RX_BOQCTGY)];
  const groupStack: { rno: string; label: string; level: number }[] = [];
  const groupNodes: { idx: number; group: GaebPreviewGroup }[] = [];
  let level = 0;
  for (const m of boqCtgyBlocks) {
    const idx = m.index ?? 0;
    const fullMatch = m[0];
    const openTag = fullMatch.match(/<BoQCtgy\s([^>]*)>/i);
    const attrs = openTag?.[1] ?? "";
    const inner = m[1] ?? "";
    const rno = getRNoPartFromAttrs(attrs) ?? "";
    const label = getLblTxFromInner(inner);
    const hasNested = /<BoQCtgy\s/i.test(inner);
    const g: GaebPreviewGroup = {
      posNr: buildPositionNumberFromHierarchy([...groupStack.map((x) => x.rno), rno].filter(Boolean)),
      label: formatRemarkOrLabelText(label) || rno || "(ohne Bezeichnung)",
      level,
      _source: "BoQCtgy",
    };
    groups.push(g);
    groupNodes.push({ idx, group: g });
    if (hasNested) {
      groupStack.push({ rno, label, level });
      level++;
    }
  }

  // Falls keine BoQCtgy gefunden: alternative Abschnitte (Titel/Section) als Gruppen
  if (groups.length === 0) {
    const titelBlocks = norm.matchAll(/<(?:Titel|Section|Abschnitt)[^>]*(?:Nr|Id)="?([^">]*)"?[^>]*>([\s\S]*?)<\/(?:Titel|Section|Abschnitt)>/gi);
    for (const m of titelBlocks) {
      groups.push({
        posNr: (m[1] ?? "").trim(),
        label: formatRemarkOrLabelText(richTextToPlainText(m[2] ?? "").trim()) || (m[1] ?? "").trim(),
        level: 0,
        _source: "Section",
      });
    }
  }

  // BoQCtgy-Ranges in Dokumentreihenfolge (Stack für Verschachtelung); Itemlist-Ranges
  const boqCtgyRangesFromTag = findAllTagRanges(norm, "BoQCtgy");
  const boqCtgyRanges: { start: number; end: number }[] =
    boqCtgyRangesFromTag.length > 0
      ? boqCtgyRangesFromTag
      : boqCtgyBlocks.map((m) => ({
          start: m.index ?? 0,
          end: (m.index ?? 0) + (m[0]?.length ?? 0),
        }));
  const firstBoQCtgyStart = boqCtgyRanges[0]?.start ?? Infinity;
  const itemlistRanges = findAllTagRanges(norm, "Itemlist");

  // Oberste BoQCtgy (nicht in einer anderen enthalten) => BoQBody der Hauptgruppe
  const topLevelBoQCtgy = boqCtgyRanges.find(
    (r) => !boqCtgyRanges.some((o) => o.start < r.start && o.end > r.end)
  );
  const nestedAndItemlistStarts: number[] =
    topLevelBoQCtgy == null
      ? []
      : [
          ...boqCtgyRanges
            .filter((r) => r.start > topLevelBoQCtgy!.start && r.end < topLevelBoQCtgy!.end)
            .map((r) => r.start),
          ...itemlistRanges
            .filter((r) => r.start >= topLevelBoQCtgy!.start && r.end <= topLevelBoQCtgy!.end)
            .map((r) => r.start),
        ];
  const minStructuralStartInTopLevel =
    nestedAndItemlistStarts.length === 0 ? Infinity : Math.min(...nestedAndItemlistStarts);

  function classifyRemarkScope(remarkStart: number, remarkEnd: number): RemarkScope {
    if (remarkEnd < firstBoQCtgyStart) return "global";
    const insideTopLevel =
      topLevelBoQCtgy != null &&
      remarkStart >= topLevelBoQCtgy.start &&
      remarkEnd <= topLevelBoQCtgy.end;
    if (insideTopLevel && remarkEnd < minStructuralStartInTopLevel) return "global";
    const insideBoQCtgy = boqCtgyRanges.find((r) => remarkStart >= r.start && remarkEnd <= r.end);
    if (!insideBoQCtgy) return "global";
    const insideItemlist = itemlistRanges.some((r) => remarkStart >= r.start && remarkEnd <= r.end);
    if (insideItemlist) return "itemlist-note";
    return "group";
  }


  // --- Hinweise: alle Remark-Knoten rekursiv in XML-Reihenfolge sammeln, mit Scope ---
  const remarkRanges = findAllRemarkRanges(norm);
  const remarkNodes: { idx: number; remark: GaebPreviewRemark }[] = [];
  for (const { start, end } of remarkRanges) {
    const block = norm.slice(start, end);
    const openEnd = block.indexOf(">") + 1;
    const closeTag = block.match(/<\/Remark\s*>$/i)?.[0] ?? "</Remark>";
    const inner = block.slice(openEnd, block.length - closeTag.length);
    const text = formatRemarkOrLabelText(extractRemarkText(inner));
    if (text.length > 0) {
      const scope = classifyRemarkScope(start, end);
      const remark: GaebPreviewRemark = {
        text,
        kind: "Hinweis",
        scope,
        _source: "Remark",
      };
      remarks.push(remark);
      remarkNodes.push({ idx: start, remark });
    }
  }

  // Debug: Reihenfolge der direkten Kinder in der obersten BoQCtgy
  const topLevelBoQBodyChildSequence: string[] = [];
  if (topLevelBoQCtgy != null) {
    const childPositions: { pos: number; type: string }[] = [];
    for (const r of remarkRanges) {
      if (r.start >= topLevelBoQCtgy.start && r.end <= topLevelBoQCtgy.end)
        childPositions.push({ pos: r.start, type: "Remark" });
    }
    for (const r of boqCtgyRanges) {
      if (r.start > topLevelBoQCtgy.start && r.end < topLevelBoQCtgy.end)
        childPositions.push({ pos: r.start, type: "BoQCtgy" });
    }
    for (const r of itemlistRanges) {
      if (r.start >= topLevelBoQCtgy.start && r.end <= topLevelBoQCtgy.end)
        childPositions.push({ pos: r.start, type: "Itemlist" });
    }
    childPositions.sort((a, b) => a.pos - b.pos);
    topLevelBoQBodyChildSequence.push(...childPositions.map((c) => c.type));
  }

  // Vorbemerkungen/Vortext als globaler Remark, falls noch keine Remarks
  if (remarks.length === 0) {
    const vorMatch = norm.match(/<Vorbemerkungen[^>]*>([\s\S]*?)<\/Vorbemerkungen>/i)
      || norm.match(/<Vortext[^>]*>([\s\S]*?)<\/Vortext>/i)
      || norm.match(/<Preface[^>]*>([\s\S]*?)<\/Preface>/i);
    if (vorMatch) {
      const t = formatRemarkOrLabelText(richTextToPlainTextWithParagraphs(vorMatch[1]).trim());
      if (t.length > 0) {
        const remark: GaebPreviewRemark = {
          text: t,
          kind: "Vorbemerkungen",
          scope: "global",
          _source: "Vorbemerkungen",
        };
        remarks.push(remark);
      }
    }
  }

  // Einleitungsfallback: LblTx der obersten BoQCtgy, wenn keine globalen Remarks und LblTx wie Einleitung
  let topLabelForPreface: string | undefined;
  const globalRemarks = remarks.filter((r) => r.scope === "global");
  if (globalRemarks.length === 0 && groups.length > 0 && groups[0]) {
    const topLabel = (groups[0].label ?? "").trim();
    if (topLabel.length > 0 && looksLikePrefaceLabel(topLabel)) {
      topLabelForPreface = topLabel;
    }
  }

  // --- Positionen: Item mit RNoPart, Qty, QU, OutlineText, DetailTxt; Positionsnummer aus Gruppenhierarchie ---
  // Ereignisse: BoQCtgy open/close und Item, nach Position im Text sortiert, um aktuellen Gruppenpfad pro Item zu kennen
  type Event = { idx: number; type: "boqOpen" | "boqClose" | "item"; rno?: string; itemInner?: string; itemAttrs?: string };
  const events: Event[] = [];
  const boqOpenRegex = /<(?:[a-zA-Z_][\w.-]*:)?BoQCtgy\s([^>]*)>/gi;
  for (const m of norm.matchAll(boqOpenRegex)) {
    events.push({ idx: m.index ?? 0, type: "boqOpen", rno: getRNoPartFromAttrs(m[1] ?? "") });
  }
  const boqCloseRegex = /<\/(?:[a-zA-Z_][\w.-]*:)?BoQCtgy\s*>/gi;
  for (const m of norm.matchAll(boqCloseRegex)) {
    events.push({ idx: m.index ?? 0, type: "boqClose" });
  }
  for (const m of norm.matchAll(RX_ITEM_BLOCK)) {
    const openTag = m[0].match(/<(?:[a-zA-Z_][\w.-]*:)?Item\s([^>]*)>/i);
    events.push({
      idx: m.index ?? 0,
      type: "item",
      itemAttrs: openTag?.[1],
      itemInner: m[1],
    });
  }
  events.sort((a, b) => a.idx - b.idx);

  const currentGroupPath: string[] = [];
  const itemNodes: { idx: number; item: GaebPreviewItem }[] = [];
  for (const ev of events) {
    if (ev.type === "boqOpen" && ev.rno != null) {
      currentGroupPath.push(ev.rno);
    } else if (ev.type === "boqClose") {
      currentGroupPath.pop();
    } else if (ev.type === "item" && ev.itemInner != null) {
      const idx = ev.idx ?? 0;
      const inner = ev.itemInner;
      const itemRno =
        (ev.itemAttrs ? getRNoPartFromAttrs(ev.itemAttrs) : undefined) ??
        inner.match(RX_RNOPART_ELEMENT)?.[1]?.trim();
      const itemRnoStr = itemRno != null ? itemRno : "";
      const shortText = extractOutlineText(inner);
      const longText = extractDetailTxt(inner);
      const qty =
        inner.match(/<Qty[^>]*>([^<]*)<\/Qty>/i)?.[1]?.trim() ??
        inner.match(/<Quantity[^>]*>([^<]*)<\/Quantity>/i)?.[1]?.trim() ??
        inner.match(/<Menge[^>]*>([^<]*)<\/Menge>/i)?.[1]?.trim();
      const unit =
        inner.match(/<QU[^>]*>([^<]*)<\/QU>/i)?.[1]?.trim() ??
        inner.match(/<Unit[^>]*>([^<]*)<\/Unit>/i)?.[1]?.trim() ??
        inner.match(/<Uom[^>]*>([^<]*)<\/Uom>/i)?.[1]?.trim() ??
        inner.match(/<Einheit[^>]*>([^<]*)<\/Einheit>/i)?.[1]?.trim();

      const hierarchyNr = buildPositionNumberFromHierarchy([...currentGroupPath, itemRnoStr].filter(Boolean));
      const posNr = hierarchyNr || itemRnoStr;
      const item: GaebPreviewItem = {
        posNr: posNr || String(items.length + 1),
        shortText: shortText || longText.slice(0, 80) || "—",
        longText: longText || shortText || "—",
        quantity: qty ?? "",
        unit: unit ?? "",
        _source: {
          shortText: "OutlineText/ShortText",
          longText: "DetailTxt/DetailAddText",
          qty: "Qty",
          unit: "QU/Unit",
        },
      };
      items.push(item);
      itemNodes.push({ idx, item });
    }
  }

  // Fallback: <Position> / <Pos> / <LvPosition> wenn keine <Item>-Blöcke
  if (items.length === 0) {
    const posBlocks = norm.matchAll(
      /<(?:Position|LvPosition|Pos)[^>]*>([\s\S]*?)<\/(?:Position|LvPosition|Pos)>/gi
    );
    for (const m of posBlocks) {
      const inner = m[1] ?? "";
      const shortText = extractOutlineText(inner);
      const longText = extractDetailTxt(inner);
      const nr =
        inner.match(/<PosNr[^>]*>([^<]*)<\/PosNr>/i)?.[1]?.trim() ??
        inner.match(/<Nr>([^<]*)<\/Nr>/i)?.[1]?.trim();
      const qty =
        inner.match(/<Qty[^>]*>([^<]*)<\/Qty>/i)?.[1]?.trim() ??
        inner.match(/<Quantity[^>]*>([^<]*)<\/Quantity>/i)?.[1]?.trim() ??
        inner.match(/<Menge[^>]*>([^<]*)<\/Menge>/i)?.[1]?.trim();
      const unit =
        inner.match(/<QU[^>]*>([^<]*)<\/QU>/i)?.[1]?.trim() ??
        inner.match(/<Unit[^>]*>([^<]*)<\/Unit>/i)?.[1]?.trim() ??
        inner.match(/<Einheit[^>]*>([^<]*)<\/Einheit>/i)?.[1]?.trim();
      items.push({
        posNr: nr ?? String(items.length + 1),
        shortText: shortText || longText.slice(0, 80) || "—",
        longText: longText || shortText || "—",
        quantity: qty ?? "",
        unit: unit ?? "",
        _source: {
          shortText: "OutlineText/Kurztext",
          longText: "DetailTxt/Langtext",
          qty: "Qty/Menge",
          unit: "QU/Unit",
        },
      });
    }
  }

  // DisplayNodes in Dokumentreihenfolge: Gruppe, group/itemlist-Remark (keine globalen), Item
  const nonGlobalRemarkNodes = remarkNodes.filter(
    (n) => n.remark.scope === "group" || n.remark.scope === "itemlist-note"
  );
  type NodeWithIdx = { idx: number; node: GaebPreviewDisplayNode };
  const allWithIdx: NodeWithIdx[] = [
    ...groupNodes.map(({ idx, group }) => ({
      idx,
      node: {
        type: "group" as const,
        posNr: group.posNr,
        label: group.label,
        level: group.level,
        _source: group._source,
      },
    })),
    ...nonGlobalRemarkNodes.map(({ idx, remark }) => ({
      idx,
      node: {
        type: "remark" as const,
        text: remark.text,
        kind: remark.kind,
        scope: remark.scope,
        _source: remark._source,
      },
    })),
    ...itemNodes.map(({ idx, item }) => ({
      idx,
      node: {
        type: "item" as const,
        posNr: item.posNr,
        shortText: item.shortText,
        longText: item.longText,
        quantity: item.quantity,
        unit: item.unit,
        _source: item._source,
      },
    })),
  ];
  allWithIdx.sort((a, b) => a.idx - b.idx);
  const displayNodes: GaebPreviewDisplayNode[] = allWithIdx.map((x) => x.node);

  const rawItemMatches = [...norm.matchAll(RX_ITEM_BLOCK)];
  const positionsParserDebug = {
    rawItemCount: rawItemMatches.length,
    structurePositionenItemsCount: items.length,
    namespaceStrategy: "tag-name-with-optional-prefix",
    firstItem:
      items.length > 0
        ? {
            id: items[0].posNr,
            RNoPart: items[0].posNr,
            Qty: items[0].quantity,
            QU: items[0].unit,
            OutlineText: (items[0].shortText ?? "").slice(0, 120),
            DetailTxt: (items[0].longText ?? "").slice(0, 200),
          }
        : null,
    secondItem:
      items.length > 1
        ? {
            id: items[1].posNr,
            RNoPart: items[1].posNr,
            Qty: items[1].quantity,
            QU: items[1].unit,
            OutlineText: (items[1].shortText ?? "").slice(0, 120),
            DetailTxt: (items[1].longText ?? "").slice(0, 200),
          }
        : null,
  };

  const debugExtra = {
    topLevelBoQBodyChildSequence,
    globalRemarkTexts: remarks.filter((r) => r.scope === "global").map((r) => r.text).slice(0, 3),
    groupRemarkTexts: remarks.filter((r) => r.scope === "group").map((r) => r.text).slice(0, 3),
    positionsParserDebug,
  };

  return { groups, remarks, items, displayNodes, topLabelForPreface, debugExtra };
}

// --- Reine Debug-Ausgabe: Rohstrukturen + extrahierte Felder (für Feldpfad-Mapping) ---

export type RawStructureDebug = {
  firstBoQCtgy: { rawXml: string; extracted: { RNoPart: string | undefined } } | null;
  firstRemark: { rawXml: string; extracted: { DetailTxt: string; CompleteText?: string } } | null;
  firstItem: {
    rawXml: string;
    extracted: { RNoPart: string | undefined; Qty: string; QU: string; OutlineText: string; DetailTxt: string };
  } | null;
  secondItem: {
    rawXml: string;
    extracted: { RNoPart: string | undefined; Qty: string; QU: string; OutlineText: string; DetailTxt: string };
  } | null;
};

/**
 * Debug-Funktion: liefert für die gegebene XML-Rohdatei die ersten gefundenen
 * BoQCtgy, Remark, Item (1. + 2.) als Roh-XML und die extrahierten Felder.
 * Keine UI – Ausgabe z. B. in API debug.rawStructures oder Console.
 */
export function debugRawStructures(raw: string): RawStructureDebug {
  const norm = normalizeNewlines(raw);
  const out: RawStructureDebug = {
    firstBoQCtgy: null,
    firstRemark: null,
    firstItem: null,
    secondItem: null,
  };

  const firstBoQCtgyMatch = norm.match(/<BoQCtgy\s[^>]*>[\s\S]*?<\/BoQCtgy>/i);
  if (firstBoQCtgyMatch) {
    const rawXml = firstBoQCtgyMatch[0];
    const openTag = rawXml.match(/<BoQCtgy\s([^>]*)>/i);
    const attrs = openTag?.[1] ?? "";
    out.firstBoQCtgy = {
      rawXml,
      extracted: { RNoPart: getRNoPartFromAttrs(attrs) },
    };
  }

  const firstRemarkMatch = norm.match(/<Remark[^>]*>[\s\S]*?<\/Remark>/i);
  if (firstRemarkMatch) {
    const rawXml = firstRemarkMatch[0];
    const inner = rawXml.replace(/<Remark[^>]*>([\s\S]*?)<\/Remark>/i, "$1");
    const detailTxtRaw = inner.match(/<DetailTxt[^>]*>([\s\S]*?)<\/DetailTxt>/i)?.[1] ?? "";
    const completeTextRaw = inner.match(/<CompleteText[^>]*>([\s\S]*?)<\/CompleteText>/i)?.[1];
    out.firstRemark = {
      rawXml,
      extracted: {
        DetailTxt: detailTxtRaw ? richTextToPlainText(detailTxtRaw) : "",
        ...(completeTextRaw !== undefined ? { CompleteText: richTextToPlainText(completeTextRaw) } : {}),
      },
    };
  }

  const itemMatches = [...norm.matchAll(RX_ITEM_BLOCK)];
  for (let i = 0; i < Math.min(2, itemMatches.length); i++) {
    const m = itemMatches[i];
    const fullMatch = m?.[0];
    const inner = m?.[1] ?? "";
    if (!fullMatch) continue;
    const openTag = fullMatch.match(/<(?:[a-zA-Z_][\w.-]*:)?Item\s([^>]*)>/i);
    const attrs = openTag?.[1] ?? "";
    const extracted = {
      RNoPart: getRNoPartFromAttrs(attrs) ?? inner.match(RX_RNOPART_ELEMENT)?.[1]?.trim(),
      Qty:
        inner.match(/<Qty[^>]*>([^<]*)<\/Qty>/i)?.[1]?.trim() ??
        inner.match(/<Quantity[^>]*>([^<]*)<\/Quantity>/i)?.[1]?.trim() ??
        inner.match(/<Menge[^>]*>([^<]*)<\/Menge>/i)?.[1]?.trim() ??
        "",
      QU:
        inner.match(/<QU[^>]*>([^<]*)<\/QU>/i)?.[1]?.trim() ??
        inner.match(/<Unit[^>]*>([^<]*)<\/Unit>/i)?.[1]?.trim() ??
        inner.match(/<Uom[^>]*>([^<]*)<\/Uom>/i)?.[1]?.trim() ??
        inner.match(/<Einheit[^>]*>([^<]*)<\/Einheit>/i)?.[1]?.trim() ??
        "",
      OutlineText: extractOutlineText(inner),
      DetailTxt: extractDetailTxt(inner),
    };
    const block = { rawXml: fullMatch, extracted };
    if (i === 0) out.firstItem = block;
    else out.secondItem = block;
  }

  return out;
}
