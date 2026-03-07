/**
 * GAEB-Struktur: einheitliche Datenstruktur für extrahierte LV-Inhalte.
 * Basis für saubere Trennung Vortext vs. Positionen und spätere Analysen.
 */

export type GaebMeta = {
  source: "gaeb-xml" | "text-export" | "unknown";
  filename?: string;
  encoding?: string;
  projectId?: string;
  projectName?: string;
};

export type GaebAbschnitt = {
  id?: string;
  titel: string;
  text?: string;
  startOffset?: number;
  endOffset?: number;
};

export type GaebPositionItem = {
  posNr?: string;
  kurztext?: string;
  langtext?: string;
  menge?: string;
  einheit?: string;
};

export type GaebPositionBlock = {
  raw: string;
  items?: GaebPositionItem[];
};

export type GaebStructure = {
  meta: GaebMeta;
  /** Reine Vorbemerkungen (LV-spezifisch), oft vor „Allgemeine Vertragsbedingungen“ */
  vorbemerkungen: string;
  /** Vertragsbedingungen, Fristen, Rangfolge – Kern für Risiko + KeyFacts */
  vortext: string;
  /** Titel/Abschnittstexte (ohne Positionen) */
  abschnitte: GaebAbschnitt[];
  /** Rohtext oder strukturierte Positionen */
  positionen: GaebPositionBlock;
  /** Debug-Infos zur Extraktion */
  raw: {
    full: string;
    cutMethod: string;
    vortextStart: number;
    vortextEnd: number;
  };
};
