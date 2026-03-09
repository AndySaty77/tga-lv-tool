/**
 * Einheitliches internes Modell für die GAEB-Preview-Anzeige.
 * UI rendert ausschließlich diese Struktur – keine Roh-XML-Strings.
 */

/** Eine Gruppe (Kapitel/Abschnitt) aus BoQCtgy o. ä. */
export type GaebPreviewGroup = {
  /** Positionsnummer der Gruppe (z. B. "01", "01.01") aus RNoPart / Hierarchie */
  posNr: string;
  /** Bezeichnung der Gruppe (z. B. aus LblTx) */
  label: string;
  /** Tiefe in der Hierarchie (0 = oberste Ebene) */
  level: number;
  /** Optionale Quelle für Debug */
  _source?: "BoQCtgy" | "Section" | "Titel";
};

/** Kontext eines Remarks: global (Einleitung), gruppenbezogen, oder Itemlist-Hinweis. */
export type RemarkScope = "global" | "group" | "itemlist-note";

/** Ein Hinweistext (Remark) – Vortext, Vorbemerkungen, allgemeine Hinweise */
export type GaebPreviewRemark = {
  /** Inhalt als Plain-Text */
  text: string;
  /** Optionale Kennung (z. B. „Vorbemerkungen“, „Hinweis 1“) */
  kind?: string;
  /** Kontext: global = Einleitung, group = Gruppenhinweis, itemlist-note = Hinweis in/bei Itemlist */
  scope?: RemarkScope;
  _source?: "Remark" | "Vorbemerkungen" | "Preface";
};

/** Eine Position (Item) */
export type GaebPreviewItem = {
  /** Positionsnummer (z. B. "01.01.03" oder aus Item @RNoPart) */
  posNr: string;
  /** Kurztext (OutlineText) */
  shortText: string;
  /** Langtext (DetailTxt) */
  longText: string;
  /** Menge (Qty) */
  quantity: string;
  /** Einheit (QU) */
  unit: string;
  /** Quelle der Felder für Debug */
  _source?: {
    shortText?: string;
    longText?: string;
    qty?: string;
    unit?: string;
  };
};

/** Einheitliche Anzeige-Knoten in Dokumentreihenfolge (Gruppe, Hinweis, Position). Nur group/group-remark/itemlist-note/item – keine globalen Remarks. */
export type GaebPreviewDisplayNode =
  | { type: "group"; posNr: string; label: string; level: number; _source?: string }
  | { type: "remark"; text: string; kind?: string; scope?: RemarkScope; _source?: string }
  | { type: "item"; posNr: string; shortText: string; longText: string; quantity: string; unit: string; _source?: GaebPreviewItem["_source"] };

export type GaebPreviewNormalized = {
  groups: GaebPreviewGroup[];
  remarks: GaebPreviewRemark[];
  items: GaebPreviewItem[];
  /** Optionale Liste in Dokumentreihenfolge für Positionsansicht (Gruppen + group/itemlist-remarks + Items, ohne globale Remarks). */
  displayNodes?: GaebPreviewDisplayNode[];
  /** LblTx der obersten BoQCtgy, wenn als Einleitungsfallback genutzt (z. B. bei fehlenden globalen Remarks). */
  topLabelForPreface?: string;
  /** Optionale Debug-Daten (z. B. topLevelBoQBodyChildSequence, globalRemarkTexts). */
  debugExtra?: {
    topLevelBoQBodyChildSequence?: string[];
    globalRemarkTexts?: string[];
    groupRemarkTexts?: string[];
  };
};

// --- Hilfsfunktionen ---

/**
 * Rich-Text / XML-Inhalt in Plain-Text umwandeln.
 * Entfernt Tags, decodiert HTML-Entities, normalisiert Leerzeichen.
 */
export function richTextToPlainText(xmlOrHtml: string): string {
  if (!xmlOrHtml || typeof xmlOrHtml !== "string") return "";
  let s = xmlOrHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/(?:Paragraph|P|Li|Dd|Dt)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  s = s.replace(/\s+/g, " ").replace(/\n\s+/g, "\n").trim();
  return s;
}

/**
 * Rich-Text für Vorbemerkungen/Remarks: Absätze und Zeilenumbrüche erhalten.
 * - <br> / <br/> als Zeilenumbruch
 * - mehrere <br> oder Block-Enden als Absatztrennung
 * - Keine aggressive Leerzeichen-Zusammenziehung über Absatzgrenzen
 */
export function richTextToPlainTextWithParagraphs(xmlOrHtml: string): string {
  if (!xmlOrHtml || typeof xmlOrHtml !== "string") return "";
  let s = xmlOrHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<\/tr>/gi, "\n");
  s = s.replace(/<\/(?:Paragraph|P|Li|Dd|Dt|Heading|H[1-6])>/gi, "\n\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  const lines = s.split(/\n/);
  const normalized = lines.map((line) => line.replace(/\s+/g, " ").trim());
  const withParagraphs = normalized
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return withParagraphs;
}

/**
 * OutlineText aus XML-Block extrahieren (Kurztext).
 * Sucht nach <OutlineText>, <ShortText>, <Kurztext>, <OutlineAddText> etc.
 */
export function extractOutlineText(innerXml: string): string {
  const raw =
    innerXml.match(/<OutlineText[^>]*>([\s\S]*?)<\/OutlineText>/i)?.[1] ??
    innerXml.match(/<ShortText[^>]*>([\s\S]*?)<\/ShortText>/i)?.[1] ??
    innerXml.match(/<Kurztext[^>]*>([\s\S]*?)<\/Kurztext>/i)?.[1] ??
    innerXml.match(/<OutlineAddText[^>]*>([\s\S]*?)<\/OutlineAddText>/i)?.[1];
  return raw ? richTextToPlainText(raw) : "";
}

/**
 * DetailTxt aus XML-Block extrahieren (Langtext).
 * Sucht nach <DetailTxt>, <DetailAddText>, <Langtext>, <LongText>, <AddText> etc.
 */
export function extractDetailTxt(innerXml: string): string {
  const raw =
    innerXml.match(/<DetailTxt[^>]*>([\s\S]*?)<\/DetailTxt>/i)?.[1] ??
    innerXml.match(/<DetailAddText[^>]*>([\s\S]*?)<\/DetailAddText>/i)?.[1] ??
    innerXml.match(/<Langtext[^>]*>([\s\S]*?)<\/Langtext>/i)?.[1] ??
    innerXml.match(/<LongText[^>]*>([\s\S]*?)<\/LongText>/i)?.[1] ??
    innerXml.match(/<AddText[^>]*>([\s\S]*?)<\/AddText>/i)?.[1];
  return raw ? richTextToPlainText(raw) : "";
}

/**
 * Positionsnummer aus Gruppenhierarchie zusammensetzen (z. B. ["01", "01", "03"] → "01.01.03").
 */
export function buildPositionNumberFromHierarchy(parts: string[]): string {
  if (!parts?.length) return "";
  return parts.filter(Boolean).join(".");
}

/** Prüft, ob LblTx-Text wie Einleitung/Vorbemerkung wirkt (mehrzeilig, Stichworte oder längerer Fließtext). */
export function looksLikePrefaceLabel(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 3) return false;
  if (/\n/.test(t)) return true;
  if (t.length > 80 && t.includes(".")) return true;
  if (t.length > 150) return true;
  const lower = t.toLowerCase();
  const keywords = ["allg.", "hinweis", "inkl.", "vorbemerkung", "vorbemerkungen", "allgemein", "einleitung"];
  return keywords.some((k) => lower.includes(k));
}
