/**
 * GAEB-Parsing: einheitliche Ergebnisstruktur für alle Parser.
 * Basis für KeyFacts, Vortext-Risiken, Gewerkeerkennung und Trigger.
 */

export type GaebFormat =
  | "gaeb-xml"      // Strukturierter GAEB DA XML
  | "plain-text"    // Plain-Text-Export (CaliforniaX, Dangl, etc.)
  | "raw-text";     // Kopierter Rohtext / Tool-Export

export type GaebParser =
  | "xml-gaeb"
  | "text-californiax"
  | "text-dangl"
  | "text-generic"
  | "raw-fallback";

export type GaebParseMeta = {
  filename?: string;
  encoding?: string;
  /** Aus XML: Projektnummer, Bezeichnung */
  projectId?: string;
  projectName?: string;
  /** Erkanntes Export-Tool falls erkennbar */
  exportTool?: string;
  /** Nur für Debug: erkannter Parser */
  parserUsed?: GaebParser;
  /** Nur für Debug: erkanntes Format */
  formatDetected?: GaebFormat;
  /** Cut-Methode (z. B. anchor-titel-n, xml-marker) */
  cutMethod?: string;
};

export type GaebParseOpts = {
  filename?: string;
};

export type GaebSection = {
  id?: string;
  title: string;
  text?: string;
  startOffset?: number;
  endOffset?: number;
};

export type GaebItem = {
  posNr?: string;
  shortText?: string;
  longText?: string;
  quantity?: string;
  unit?: string;
  raw?: string;
};

export type GaebParseResult = {
  /** Erkanntes Format */
  formatDetected: GaebFormat;
  /** Verwendeter Parser */
  parserUsed: GaebParser;
  /** Roher Dateiinhalt (normalisiert) */
  rawText: string;
  /** Bereinigter Text (HTML/Tags entfernt) */
  cleanedText: string;
  /** Metadaten */
  meta: GaebParseMeta;
  /** Vortext: Vorbemerkungen + Vertragsbedingungen (alles vor Positionen) */
  prefaceText: string;
  /** Optional: Vorbemerkungen getrennt */
  vorbemerkungenText?: string;
  /** Optional: Vertragsbedingungen getrennt */
  vortextText?: string;
  /** Abschnitts-/Titeltexte */
  sectionTexts: GaebSection[];
  /** Positions-/LV-Texte (roh oder strukturiert) */
  itemTexts: string;
  /** Strukturierte Positionen (wenn Parser liefert) */
  items?: GaebItem[];
  /** Anzahl erkannter Positionen */
  itemCount: number;
  /** Konfidenz der Strukturerkennung 0..1 */
  structureConfidence: number;
  /** Warnungen (z. B. "Keine klare Trennung", "XML unvollständig") */
  warnings: string[];
};
