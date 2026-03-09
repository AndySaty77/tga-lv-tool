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

/** Ein Hinweistext (Remark) – Vortext, Vorbemerkungen, allgemeine Hinweise */
export type GaebPreviewRemark = {
  /** Inhalt als Plain-Text */
  text: string;
  /** Optionale Kennung (z. B. „Vorbemerkungen“, „Hinweis 1“) */
  kind?: string;
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

export type GaebPreviewNormalized = {
  groups: GaebPreviewGroup[];
  remarks: GaebPreviewRemark[];
  items: GaebPreviewItem[];
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
