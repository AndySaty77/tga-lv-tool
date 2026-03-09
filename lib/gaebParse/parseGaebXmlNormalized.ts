/**
 * GAEB XML / X83 → normalisierte Preview-Struktur (Gruppen, Hinweise, Positionen).
 * Mappings: BoQCtgy (RNoPart, LblTx), Remark > Description > CompleteText > DetailTxt, Item (RNoPart, Qty, QU, OutlineText, DetailTxt).
 */

import type {
  GaebPreviewNormalized,
  GaebPreviewGroup,
  GaebPreviewRemark,
  GaebPreviewItem,
} from "../gaebPreviewModel";
import {
  richTextToPlainText,
  extractOutlineText,
  extractDetailTxt,
  buildPositionNumberFromHierarchy,
} from "../gaebPreviewModel";
import { normalizeNewlines } from "./utils";

const RX_LBLTX = /<LblTx[^>]*>([\s\S]*?)<\/LblTx>/i;
const RX_RNOPART_ATTR = /RNoPart\s*=\s*["']([^"']*)["']/i;
const RX_REMARK_BLOCK = /<Remark[^>]*>([\s\S]*?)<\/Remark>/gi;
const RX_DETAIL_TXT_IN_REMARK = /<DetailTxt[^>]*>([\s\S]*?)<\/DetailTxt>/i;
const RX_ITEM_BLOCK = /<Item\s[^>]*>([\s\S]*?)<\/Item>/gi;

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

  // --- Gruppen: BoQCtgy mit RNoPart und LblTx (Hierarchie durch Reihenfolge + Level) ---
  const boqCtgyBlocks = norm.matchAll(/<BoQCtgy\s[^>]*>([\s\S]*?)<\/BoQCtgy>/gi);
  const groupStack: { rno: string; label: string; level: number }[] = [];
  let level = 0;
  for (const m of boqCtgyBlocks) {
    const fullMatch = m[0];
    const openTag = fullMatch.match(/<BoQCtgy\s([^>]*)>/i);
    const attrs = openTag?.[1] ?? "";
    const inner = m[1] ?? "";
    const rno = getRNoPartFromAttrs(attrs) ?? "";
    const label = getLblTxFromInner(inner);
    // Nested BoQCtgy: wenn inner noch <BoQCtgy enthält, sind wir auf gleicher Ebene; sonst Leaf
    const hasNested = /<BoQCtgy\s/i.test(inner);
    const g: GaebPreviewGroup = {
      posNr: buildPositionNumberFromHierarchy([...groupStack.map((x) => x.rno), rno].filter(Boolean)),
      label: label || rno || "(ohne Bezeichnung)",
      level,
      _source: "BoQCtgy",
    };
    groups.push(g);
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
        label: richTextToPlainText(m[2] ?? "").trim() || (m[1] ?? "").trim(),
        level: 0,
        _source: "Section",
      });
    }
  }

  // --- Hinweise: Remark > Description > CompleteText > DetailTxt ---
  const remarkBlocks = [...norm.matchAll(RX_REMARK_BLOCK)];
  for (const m of remarkBlocks) {
    const inner = m[1] ?? "";
    const detailMatch = inner.match(RX_DETAIL_TXT_IN_REMARK)
      || inner.match(/<CompleteText[^>]*>([\s\S]*?)<\/CompleteText>/i)
      || inner.match(/<Description[^>]*>([\s\S]*?)<\/Description>/i);
    const text = detailMatch ? richTextToPlainText(detailMatch[1]) : richTextToPlainText(inner);
    if (text.trim()) {
      remarks.push({
        text: text.trim(),
        kind: "Hinweis",
        _source: "Remark",
      });
    }
  }

  // Vorbemerkungen/Vortext als einen Remark, falls noch keine Remarks
  if (remarks.length === 0) {
    const vorMatch = norm.match(/<Vorbemerkungen[^>]*>([\s\S]*?)<\/Vorbemerkungen>/i)
      || norm.match(/<Vortext[^>]*>([\s\S]*?)<\/Vortext>/i)
      || norm.match(/<Preface[^>]*>([\s\S]*?)<\/Preface>/i);
    if (vorMatch) {
      const t = richTextToPlainText(vorMatch[1]).trim();
      if (t) remarks.push({ text: t, kind: "Vorbemerkungen", _source: "Vorbemerkungen" });
    }
  }

  // --- Positionen: Item mit RNoPart, Qty, QU, OutlineText, DetailTxt; Positionsnummer aus Gruppenhierarchie ---
  // Ereignisse: BoQCtgy open/close und Item, nach Position im Text sortiert, um aktuellen Gruppenpfad pro Item zu kennen
  type Event = { idx: number; type: "boqOpen" | "boqClose" | "item"; rno?: string; itemInner?: string; itemAttrs?: string };
  const events: Event[] = [];
  for (const m of norm.matchAll(/<BoQCtgy\s([^>]*)>/gi)) {
    events.push({ idx: m.index ?? 0, type: "boqOpen", rno: getRNoPartFromAttrs(m[1] ?? "") });
  }
  for (const m of norm.matchAll(/<\/BoQCtgy>/gi)) {
    events.push({ idx: m.index ?? 0, type: "boqClose" });
  }
  for (const m of norm.matchAll(RX_ITEM_BLOCK)) {
    const openTag = m[0].match(/<Item\s([^>]*)>/i);
    events.push({
      idx: m.index ?? 0,
      type: "item",
      itemAttrs: openTag?.[1],
      itemInner: m[1],
    });
  }
  events.sort((a, b) => a.idx - b.idx);

  const currentGroupPath: string[] = [];
  for (const ev of events) {
    if (ev.type === "boqOpen" && ev.rno != null) {
      currentGroupPath.push(ev.rno);
    } else if (ev.type === "boqClose") {
      currentGroupPath.pop();
    } else if (ev.type === "item" && ev.itemInner != null) {
      const inner = ev.itemInner;
      const itemRno = ev.itemAttrs ? getRNoPartFromAttrs(ev.itemAttrs) : undefined;
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
      items.push({
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
      });
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

  return { groups, remarks, items };
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

  const itemMatches = [...norm.matchAll(/<Item\s[^>]*>([\s\S]*?)<\/Item>/gi)];
  for (let i = 0; i < Math.min(2, itemMatches.length); i++) {
    const m = itemMatches[i];
    const fullMatch = m?.[0];
    const inner = m?.[1] ?? "";
    if (!fullMatch) continue;
    const openTag = fullMatch.match(/<Item\s([^>]*)>/i);
    const attrs = openTag?.[1] ?? "";
    const extracted = {
      RNoPart: getRNoPartFromAttrs(attrs),
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
