/**
 * Internes fachliches Kernmodell für Nachtragspotenzial (Strang B).
 * Führende Struktur: ChangePotentialItem + ChangePotentialSummary.
 * API/UI erhalten weiterhin das Legacy-Format (ChangeOrderOpportunity/byCluster) über Mapping.
 */

// ================= Typen =================

export type ChangePotentialSourceType =
  | "vortext"
  | "position"
  | "remark"
  | "addtext"
  | "global"
  | "unknown";

export type ChangePotentialFieldType =
  | "leistungsabgrenzung"
  | "nebenleistung"
  | "schnittstelle"
  | "mengenrisiko"
  | "planungsstand"
  | "systemfestlegung"
  | "bauablauf"
  | "bestand_erschwernis"
  | "provisorium"
  | "dokumentation_inbetriebnahme"
  | "normative_ergaenzung"
  | "sonstiges";

export type ChangePotentialMechanism =
  | "zusätzliche_leistung"
  | "geänderte_leistung"
  | "mehrmenge"
  | "erschwernis"
  | "bauablaufstörung"
  | "fehlende_vorleistung"
  | "spätere_konkretisierung"
  | "normative_ergaenzung"
  | "unklar";

export type ChangePotentialImpactLevel =
  | "niedrig"
  | "mittel"
  | "hoch"
  | "sehr_hoch";

export type ChangePotentialEnforceability =
  | "schwach"
  | "mittel"
  | "gut"
  | "sehr_gut";

export type ChangePotentialRecommendedAction =
  | "rueckfrage"
  | "angebotsklarstellung"
  | "kalkulatorisch_absichern"
  | "claim_feld_beobachten"
  | "nicht_verfolgen";

/** Kommerzielle Handlungsempfehlung pro Fund (KI-Strategiebewertung auf Basis bestehender Items). */
export type CommercialStrategyPrimaryAction =
  | "rueckfrage"
  | "angebotsklarstellung"
  | "kalkulatorisch_absichern"
  | "claim_feld_beobachten"
  | "nicht_aktiv_ansprechen";

export type CommercialStrategyRiskLevel = "niedrig" | "mittel" | "hoch";

export type CommercialStrategy = {
  primaryAction: CommercialStrategyPrimaryAction;
  secondaryAction?: CommercialStrategyPrimaryAction;
  riskIfUnaddressed: CommercialStrategyRiskLevel;
  riskIfAddressedTooEarly: CommercialStrategyRiskLevel;
  strategyReasoning: string;
  negotiationSensitivity?: CommercialStrategyRiskLevel;
  /** Kurz: Wie sollte Kalkulator/Vertrieb/Projektleiter damit umgehen? */
  handlingRecommendation?: string;
  internalNote?: string;
};

export type ChangePotentialItem = {
  id: string;
  title: string;
  trade?: string;
  category?: string;
  sourceType: ChangePotentialSourceType;
  sourcePath?: string;
  sourceQuote?: string;
  sourcePositionRef?: string;
  fieldType: ChangePotentialFieldType;
  changeMechanism: ChangePotentialMechanism;
  impactLevel: ChangePotentialImpactLevel;
  enforceability: ChangePotentialEnforceability;
  confidence: number;
  recommendedAction: ChangePotentialRecommendedAction;
  reasoning: string;
  questionDraft?: string;
  clarificationDraft?: string;
  pricingHint?: string;
  tags?: string[];
  legacySource?: string;
  /** Mehrere Evidenzen für dasselbe Feld (z. B. mehrere Textstellen) */
  evidenceIds?: string[];
  /** LLM hat das Item geprüft (validiert). */
  llmValidated?: boolean;
  /** LLM hat ein oder mehrere Felder angepasst. */
  llmAdjusted?: boolean;
  /** Vertrauensgrad der LLM-Bewertung (0–1). Nur gesetzt wenn LLM einen echten Wert liefert (> 0). */
  llmConfidence?: number;
  /** Konkret durch die KI geänderte Felder (z. B. impactLevel, reasoning, questionDraft). */
  llmChangedFields?: string[];
  /** Freitext-Hinweis aus der LLM-Bewertung. */
  llmNotes?: string;
  /** Markierung für Vorschlags-Items aus LLM (nicht Teil der Kernliste). */
  candidate?: boolean;
  /** Optionale KI-Bewertung: kommerzielle Handlungsempfehlung (nur auf Basis dieses Items). */
  commercialStrategy?: CommercialStrategy;
};

/** Empfohlene Aktion auf Cluster-Ebene (nur aktive Handlungsoptionen). */
export type NegotiationClusterAction =
  | "rueckfrage"
  | "angebotsklarstellung"
  | "kalkulatorisch_absichern"
  | "claim_feld_beobachten";

/** Ein gebündelter Verhandlungspunkt aus mehreren verwandten ChangePotentialItems. */
export type NegotiationCluster = {
  id: string;
  title: string;
  shortTitle: string;
  relatedItemIds: string[];
  dominantFieldTypes: ChangePotentialFieldType[];
  dominantMechanisms: ChangePotentialMechanism[];
  affectedTrades: string[];
  commercialWeight: ChangePotentialImpactLevel;
  enforceabilityAssessment: ChangePotentialEnforceability;
  whyThisMatters: string;
  recommendedNegotiationAction: NegotiationClusterAction;
  suggestedQuestion?: string;
  suggestedClarification?: string;
  /** Expertenmodus: Begründung / Reasoning des Clusters (z. B. aus KI). */
  clusterReasoning?: string;
};

export type ChangePotentialSummary = {
  overallIndex: number;
  totalItems: number;
  highImpactCount: number;
  veryHighImpactCount: number;
  strongEnforceabilityCount: number;
  items: ChangePotentialItem[];
  topFields: Array<{ fieldType: ChangePotentialFieldType; count: number }>;
  topMechanisms: Array<{ mechanism: ChangePotentialMechanism; count: number }>;
  /** Optionale LLM-Vorschläge (nicht in items enthalten). */
  candidateItems?: ChangePotentialItem[];
  /** Metadaten zur LLM-Veredelung. */
  llmMeta?: {
    enabled: boolean;
    usedModel?: string;
    refinedItemCount?: number;
    candidateItemCount?: number;
    error?: string;
    /** Anzahl der zur KI geschickten Items (Verschlankung). */
    refinedItemAttemptCount?: number;
    /** Zeichenzahl des gesamten Prompts. */
    promptCharCount?: number;
    /** Zeichenzahl Kontext (Vortext/Positionen/KeyFacts). */
    contextCharCount?: number;
    /** Modus der Veredelung (z. B. top3_text_only). */
    llmRefinementMode?: string;
    /** Anzahl der Items, die die KI erfolgreich veredelt hat. */
    refinedItemSuccessCount?: number;
    /** Anzahl der Items, die pro Item-Timeout abgebrochen wurden. */
    perItemTimeoutCount?: number;
    /** Gesamtdauer aller LLM-Aufrufe in ms. */
    totalLlmDurationMs?: number;
  };
  /** Optionale Top-Verhandlungspunkte: Bündelung verwandter Items (regelbasiert vorgeclustert, KI verdichtet). */
  negotiationClusters?: NegotiationCluster[];
};

/** Empfohlener Gesamtansatz für die Angebotsstrategie. */
export type OfferStrategyApproach = "defensiv" | "ausgewogen" | "offensiv";

/** Eine Strategievariante (defensiv / ausgewogen / offensiv) mit Beschreibung und Maßnahmen. */
export type OfferStrategyVariant = {
  description: string;
  expectedTradeoff: string;
  keyActions: string[];
};

/** Management Summary + Strategievarianten auf Dokumentebene (KI, nur auf Basis bestehender CP-Ergebnisse). */
export type OfferStrategySummary = {
  executiveSummary: string;
  topRisks: string[];
  topNegotiationPoints: string[];
  immediateActions: string[];
  recommendedApproach: OfferStrategyApproach;
  strategyVariants: {
    defensiv: OfferStrategyVariant;
    ausgewogen: OfferStrategyVariant;
    offensiv: OfferStrategyVariant;
  };
  finalRecommendation: string;
};

// ================= Muster-Definitionen =================

type PatternDef = {
  fieldType: ChangePotentialFieldType;
  changeMechanism: ChangePotentialMechanism;
  title: string;
  keywords: RegExp[];
  impactLevel: ChangePotentialImpactLevel;
  enforceability: ChangePotentialEnforceability;
  recommendedAction: ChangePotentialRecommendedAction;
  reasoning: string;
  questionDraft?: string;
  clarificationDraft?: string;
  trade?: string;
  confidenceBase?: number;
};

const PATTERNS: PatternDef[] = [
  // Leistungsabgrenzung unklar
  {
    fieldType: "leistungsabgrenzung",
    changeMechanism: "spätere_konkretisierung",
    title: "Leistungsabgrenzung unklar oder mehrdeutig",
    keywords: [/vollständig|vollständig|vollumfänglich|umfassend|alle.*leistung|leistungsumfang/i, /abgrenz|inbegriffen|inkl\./i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "angebotsklarstellung",
    reasoning: "Formulierung lässt Leistungsumfang offen; spätere Konkretisierung kann zu Nachforderungen führen.",
    questionDraft: "Welcher genaue Leistungsumfang ist in „…“ enthalten?",
    clarificationDraft: "Unser Angebot umfasst nur die explizit beschriebenen Leistungen; weitere Konkretisierungen sind nicht enthalten.",
    confidenceBase: 0.75,
  },
  // Nebenleistungen offen oder pauschal
  {
    fieldType: "nebenleistung",
    changeMechanism: "zusätzliche_leistung",
    title: "Nebenleistungen nur pauschal oder unklar erwähnt",
    keywords: [/nebenleistung|pauschal|alles inbegriffen|inkl\.|sämtlich/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Pauschale Nebenleistungsformulierung birgt Risiko zusätzlicher Leistungsanforderungen.",
    questionDraft: "Welche konkreten Nebenleistungen sind mit „pauschal/inkl.“ abgedeckt?",
    clarificationDraft: "Nebenleistungen gemäß Ausschreibung; darüber hinausgehende Anforderungen sind nicht enthalten.",
    confidenceBase: 0.85,
  },
  // Schnittstellen zu Fremdgewerken
  {
    fieldType: "schnittstelle",
    changeMechanism: "fehlende_vorleistung",
    title: "Schnittstellen zu anderen Gewerken unklar",
    keywords: [/schnittstelle|abgrenz|koordin|gewerk|fremdgewerk/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Unklare Schnittstellendefinition kann zu Doppel- oder Fehlleistungen und Nachforderungen führen.",
    questionDraft: "Welche Vorleistungen und Grenzen sind zu benachbarten Gewerken definiert?",
    confidenceBase: 0.8,
  },
  {
    fieldType: "schnittstelle",
    changeMechanism: "fehlende_vorleistung",
    title: "Bauseits-/AG-Leistungen nicht definiert",
    keywords: [/bauseits|bauherrseitig|ag-seitig|auftraggeber.*leistung/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Nicht definierte bauseitige Leistungen führen zu Abgrenzungsstreit und möglichen Nachträgen.",
    questionDraft: "Welche bauseitigen Vorleistungen sind bis wann zu erbringen?",
    confidenceBase: 0.85,
  },
  {
    fieldType: "schnittstelle",
    changeMechanism: "fehlende_vorleistung",
    title: "Vorleistungen anderer Gewerke nicht beschrieben",
    keywords: [/vorleistung|vorarbeiten|andere gewerke/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Fehlende Definition der Vorleistungen Dritter birgt Koordinations- und Nachforderungsrisiko.",
    confidenceBase: 0.8,
  },
  // Bestand / Erschwernis
  {
    fieldType: "bestand_erschwernis",
    changeMechanism: "erschwernis",
    title: "Bestandssituation unzureichend beschrieben",
    keywords: [/bestand|umbau|sanierung|bestandsunterlage|aufnahme/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Unklare Bestandslage führt zu Erschwernissen und Mengen-/Leistungsnachforderungen.",
    questionDraft: "Liegen belastbare Bestandsunterlagen vor? Welche Anpassungen am Bestand sind angenommen?",
    confidenceBase: 0.8,
  },
  {
    fieldType: "bestand_erschwernis",
    changeMechanism: "erschwernis",
    title: "Zugänglichkeit / Erschwernisse nicht beschrieben",
    keywords: [/zugänglich|erschwernis|erschwert|zugang/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "angebotsklarstellung",
    reasoning: "Nicht beschriebene Erschwernisse können zu Mehrkosten und Nachforderungen führen.",
    confidenceBase: 0.7,
  },
  // Bauablauf
  {
    fieldType: "bauablauf",
    changeMechanism: "bauablaufstörung",
    title: "Bauzeit / Bauabschnitte / Taktung unklar",
    keywords: [/bauzeit|bauabschnitt|taktung|termin|bauablauf/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "rueckfrage",
    reasoning: "Unklare Termin- oder Taktvorgaben bergen Risiko für Mehrkosten bei Störungen.",
    questionDraft: "Sind Bauabschnitte und Terminvorgaben verbindlich definiert?",
    confidenceBase: 0.75,
  },
  // Provisorien
  {
    fieldType: "provisorium",
    changeMechanism: "zusätzliche_leistung",
    title: "Provisorien / Bauzwischenzustände nicht beschrieben",
    keywords: [/provisor|zwischenzustand|bauphase|interims/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Nicht definierte Provisorien können als zusätzliche Leistung nachgefordert werden.",
    questionDraft: "Welche Provisorien bzw. Bauzwischenzustände sind ausgeschrieben?",
    confidenceBase: 0.8,
  },
  // Dokumentation / Inbetriebnahme
  {
    fieldType: "dokumentation_inbetriebnahme",
    changeMechanism: "geänderte_leistung",
    title: "Inbetriebnahme / Abnahme nicht sauber abgegrenzt",
    keywords: [/inbetriebnahme|ibn|abnahme|probebetrieb|funktionsprüfung/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "angebotsklarstellung",
    reasoning: "Unklare Abgrenzung von IBN/Abnahme kann zu Nachforderungen für Zusatzleistungen führen.",
    confidenceBase: 0.75,
  },
  {
    fieldType: "dokumentation_inbetriebnahme",
    changeMechanism: "geänderte_leistung",
    title: "Dokumentation / Revisionsunterlagen unklar",
    keywords: [/dokumentation|revision|as-built|abnahmeprotokoll/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "angebotsklarstellung",
    reasoning: "Unklare Dokumentationspflichten können als zusätzliche Leistung interpretiert werden.",
    confidenceBase: 0.7,
  },
  {
    fieldType: "dokumentation_inbetriebnahme",
    changeMechanism: "geänderte_leistung",
    title: "Einregulierung / hydraulischer Abgleich unklar",
    keywords: [/einregul|hydraulisch|abgleich/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Einregulierung und Abgleich sind oft streitig; unklare Definition begünstigt Nachforderungen.",
    questionDraft: "Umfang Einregulierung/Abgleich: nur Anlagen der Position oder Gesamtsystem?",
    confidenceBase: 0.8,
  },
  {
    fieldType: "dokumentation_inbetriebnahme",
    changeMechanism: "geänderte_leistung",
    title: "Druckprüfung / Dichtheitsprüfung nicht eindeutig",
    keywords: [/druckprüfung|druckprobe|dichtheitsprüfung/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Prüfumfang und Verantwortung oft unklar; Nachforderungsrisiko.",
    confidenceBase: 0.8,
  },
  {
    fieldType: "dokumentation_inbetriebnahme",
    changeMechanism: "geänderte_leistung",
    title: "Spülung / Reinigung / Desinfektion unklar",
    keywords: [/spül|spuel|reinigung|desinfektion/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Spül- und Reinigungsumfang oft pauschal formuliert; Klärung empfohlen.",
    confidenceBase: 0.8,
  },
  // Normative Ergänzung
  {
    fieldType: "normative_ergaenzung",
    changeMechanism: "normative_ergaenzung",
    title: "Normative Anforderungen nur implizit",
    keywords: [/norm|din|en|vdi|vob|gemäß.*vorschrift/i],
    impactLevel: "mittel",
    enforceability: "schwach",
    recommendedAction: "claim_feld_beobachten",
    reasoning: "Implizite Verweisung auf Normen kann zu späterer Konkretisierung und Nachforderungen führen.",
    confidenceBase: 0.6,
  },
  // Mengen / Massen
  {
    fieldType: "mengenrisiko",
    changeMechanism: "mehrmenge",
    title: "Massenermittlung / Mengen unklar oder pauschal",
    keywords: [/masse|mengen|aufmaß|ermittlung|pauschal|m²|m³|meter|stück/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "kalkulatorisch_absichern",
    reasoning: "Unklare Mengen- oder Ansatzlogik begünstigt Mehrmengen-Nachforderungen.",
    questionDraft: "Sind Mengen verbindlich oder nach Aufmaß zu ermitteln?",
    confidenceBase: 0.85,
  },
  {
    fieldType: "mengenrisiko",
    changeMechanism: "mehrmenge",
    title: "Rohr- oder Kanaldimensionen unvollständig",
    keywords: [/dimension|dn|rohr|kanal|durchmesser/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "rueckfrage",
    reasoning: "Fehlende Dimensionierung kann zu Mengen- und Leistungsnachforderungen führen.",
    confidenceBase: 0.75,
  },
  // Systemfestlegung
  {
    fieldType: "systemfestlegung",
    changeMechanism: "spätere_konkretisierung",
    title: "Hersteller- oder Systemvorgaben mit Zusatzpflichten",
    keywords: [/hersteller|systemvorgabe|zulassung|typ/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "angebotsklarstellung",
    reasoning: "Systemvorgaben können spätere Konkretisierungen und Zusatzleistungen auslösen.",
    confidenceBase: 0.7,
  },
  // Schutz / Brand / Wiederherstellung
  {
    fieldType: "sonstiges",
    changeMechanism: "zusätzliche_leistung",
    title: "Brandschutzanforderungen unklar",
    keywords: [/brandschutz|brand/i],
    impactLevel: "hoch",
    enforceability: "gut",
    recommendedAction: "rueckfrage",
    reasoning: "Unklare Brandschutzanforderungen führen häufig zu Nachforderungen.",
    confidenceBase: 0.8,
  },
  {
    fieldType: "sonstiges",
    changeMechanism: "zusätzliche_leistung",
    title: "Schallschutzanforderungen fehlen oder unkonkret",
    keywords: [/schallschutz|schall/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "angebotsklarstellung",
    reasoning: "Fehlende Schallschutzangaben können später zu Nachforderungen führen.",
    confidenceBase: 0.7,
  },
  {
    fieldType: "sonstiges",
    changeMechanism: "zusätzliche_leistung",
    title: "Dämmung nicht sauber beschrieben",
    keywords: [/dämmung|dämm/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "rueckfrage",
    reasoning: "Unklare Dämmungsanforderungen bergen Mengen- und Leistungsrisiko.",
    confidenceBase: 0.75,
  },
  {
    fieldType: "sonstiges",
    changeMechanism: "zusätzliche_leistung",
    title: "Leitungswege nicht eindeutig",
    keywords: [/leitungsweg|verlegung|führung/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "kalkulatorisch_absichern",
    reasoning: "Unklare Leitungsführung kann zu Mehrmengen oder Zusatzleistungen führen.",
    confidenceBase: 0.7,
  },
  // Wartung / Betreiber
  {
    fieldType: "dokumentation_inbetriebnahme",
    changeMechanism: "geänderte_leistung",
    title: "Wartung / Einweisung / Betreiberpflichten unklar",
    keywords: [/wartung|einweisung|schulung|betreiber/i],
    impactLevel: "mittel",
    enforceability: "mittel",
    recommendedAction: "angebotsklarstellung",
    reasoning: "Unklare Wartungs- oder Einweisungspflichten können als Nachforderung interpretiert werden.",
    confidenceBase: 0.75,
  },
];

// ================= Gewerkespezifische Muster =================

const TRADE_PATTERNS: PatternDef[] = [
  { fieldType: "dokumentation_inbetriebnahme", changeMechanism: "geänderte_leistung", title: "Heizung: Hydraulischer Abgleich / Einregulierung unklar", keywords: [/heizung|heizkörper|hydraulik|abgleich|einregul/i], impactLevel: "hoch", enforceability: "gut", recommendedAction: "rueckfrage", reasoning: "In Heizungsausschreibungen oft streitig; Klärung empfohlen.", trade: "Heizung", confidenceBase: 0.8 },
  { fieldType: "dokumentation_inbetriebnahme", changeMechanism: "geänderte_leistung", title: "Sanitär: Dichtheitsprüfung / Spülung unklar", keywords: [/sanitär|wasser|leitung|druckprüf|spül/i], impactLevel: "hoch", enforceability: "gut", recommendedAction: "rueckfrage", reasoning: "Prüf- und Spülumfang in Sanitär oft pauschal.", trade: "Sanitär", confidenceBase: 0.8 },
  { fieldType: "schnittstelle", changeMechanism: "fehlende_vorleistung", title: "Lüftung: Zu- und Abluftöffnungen / Schächte bauseits?", keywords: [/lüftung|luft|schacht|öffnung|außenluft/i], impactLevel: "hoch", enforceability: "gut", recommendedAction: "rueckfrage", reasoning: "Schnittstelle Lüftung/Bau oft unklar.", trade: "Lüftung", confidenceBase: 0.75 },
  { fieldType: "mengenrisiko", changeMechanism: "mehrmenge", title: "Lüftung: Kanallängen / Querschnitte nicht definiert", keywords: [/kanal|luftleitung|lüftung.*meter|m²/i], impactLevel: "hoch", enforceability: "gut", recommendedAction: "kalkulatorisch_absichern", reasoning: "Mengenrisiko bei Lüftungskanälen häufig.", trade: "Lüftung", confidenceBase: 0.8 },
  { fieldType: "dokumentation_inbetriebnahme", changeMechanism: "geänderte_leistung", title: "Kälte: Inbetriebnahme / Kältemittelbefüllung unklar", keywords: [/kälte|klima|kältemittel|befüll|inbetriebnahme/i], impactLevel: "hoch", enforceability: "gut", recommendedAction: "rueckfrage", reasoning: "Kälte-IBN und Befüllung oft nicht abgegrenzt.", trade: "Kälte", confidenceBase: 0.8 },
  { fieldType: "schnittstelle", changeMechanism: "fehlende_vorleistung", title: "Elektro / MSR: Schnittstellen Gebäudeautomation unklar", keywords: [/msr|ga\b|gebäudeautomation|bus|knx|ddc/i], impactLevel: "hoch", enforceability: "gut", recommendedAction: "rueckfrage", reasoning: "MSR-/GA-Schnittstellen bergen hohes Nachforderungsrisiko.", trade: "Elektro/MSR", confidenceBase: 0.85 },
  { fieldType: "systemfestlegung", changeMechanism: "spätere_konkretisierung", title: "Elektro: Hersteller-/Typenbindung mit Zusatzpflichten", keywords: [/elektro|kabel|leitung|hersteller|typ/i], impactLevel: "mittel", enforceability: "mittel", recommendedAction: "angebotsklarstellung", reasoning: "Typenbindung kann spätere Konkretisierungen auslösen.", trade: "Elektro/MSR", confidenceBase: 0.7 },
];

// ================= KeyFacts: Fehlen = Nachtragsfeld =================

const KEYFACT_PATTERNS: Array<{ key: string; fieldType: ChangePotentialFieldType; title: string; changeMechanism: ChangePotentialMechanism }> = [
  { key: "bauzeit", fieldType: "bauablauf", title: "Bauzeit nicht angegeben", changeMechanism: "bauablaufstörung" },
  { key: "baubeginn", fieldType: "bauablauf", title: "Baubeginn nicht angegeben", changeMechanism: "bauablaufstörung" },
  { key: "fertigstellung", fieldType: "bauablauf", title: "Fertigstellung/Abnahme nicht angegeben", changeMechanism: "bauablaufstörung" },
  { key: "ausfuehrungsfrist", fieldType: "bauablauf", title: "Ausführungsfrist/Terminplan nicht angegeben", changeMechanism: "bauablaufstörung" },
  { key: "wartung_instandhaltung", fieldType: "dokumentation_inbetriebnahme", title: "Wartung/Instandhaltung nicht definiert", changeMechanism: "geänderte_leistung" },
];

let _itemIdCounter = 0;
function nextItemId(): string {
  _itemIdCounter += 1;
  return `CP_${_itemIdCounter}`;
}

// ================= Engine: Text scannen → Items =================

export type ChangePotentialEngineInput = {
  findings: Array<{ id: string; title: string; detail?: string; category?: string }>;
  riskClauses: Array<{ type: string; riskLevel: string; text: string; interpretation?: string }>;
  keyFacts: Record<string, string>;
  vortext?: string;
  lvPositions?: string;
};

function findMatches(
  text: string,
  sourceType: ChangePotentialSourceType,
  sourcePath?: string
): Array<{ pattern: PatternDef; snippet: string }> {
  const out: Array<{ pattern: PatternDef; snippet: string }> = [];
  const combined = [...PATTERNS, ...TRADE_PATTERNS];
  for (const p of combined) {
    for (const re of p.keywords) {
      const m = text.match(re);
      if (m) {
        out.push({ pattern: p, snippet: m[0].slice(0, 120) });
        break;
      }
    }
  }
  return out;
}

function buildItemFromPattern(
  pattern: PatternDef,
  opts: {
    sourceType: ChangePotentialSourceType;
    sourcePath?: string;
    sourceQuote?: string;
    sourcePositionRef?: string;
    evidenceIds?: string[];
  }
): ChangePotentialItem {
  return {
    id: nextItemId(),
    title: pattern.title,
    trade: pattern.trade,
    sourceType: opts.sourceType,
    sourcePath: opts.sourcePath,
    sourceQuote: opts.sourceQuote,
    sourcePositionRef: opts.sourcePositionRef,
    fieldType: pattern.fieldType,
    changeMechanism: pattern.changeMechanism,
    impactLevel: pattern.impactLevel,
    enforceability: pattern.enforceability,
    confidence: pattern.confidenceBase ?? 0.7,
    recommendedAction: pattern.recommendedAction,
    reasoning: pattern.reasoning,
    questionDraft: pattern.questionDraft,
    clarificationDraft: pattern.clarificationDraft,
    evidenceIds: opts.evidenceIds,
  };
}

/** Ähnlichkeit zweier Items (gleiches Feld + Mechanismus = zusammenführen) */
function itemSimilarity(a: ChangePotentialItem, b: ChangePotentialItem): number {
  if (a.fieldType === b.fieldType && a.changeMechanism === b.changeMechanism) {
    const ta = (a.title ?? "").toLowerCase();
    const tb = (b.title ?? "").toLowerCase();
    if (ta === tb) return 1;
    const wordsA = new Set(ta.split(/\s+/).filter((w) => w.length > 2));
    const wordsB = new Set(tb.split(/\s+/).filter((w) => w.length > 2));
    let overlap = 0;
    for (const w of wordsA) if (wordsB.has(w)) overlap++;
    return 0.5 + 0.5 * (overlap / Math.max(wordsA.size, wordsB.size, 1));
  }
  const ta = `${a.title} ${a.reasoning}`.toLowerCase();
  const tb = `${b.title} ${b.reasoning}`.toLowerCase();
  const wordsA = new Set(ta.split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(tb.split(/\s+/).filter((w) => w.length > 3));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size, 1);
}

function mergeItems(items: ChangePotentialItem[], threshold = 0.65): ChangePotentialItem[] {
  const out: ChangePotentialItem[] = [];
  for (const it of items) {
    const existing = out.find((e) => itemSimilarity(e, it) >= threshold);
    if (existing) {
      existing.sourceQuote = existing.sourceQuote || it.sourceQuote;
      existing.evidenceIds = [...new Set([...(existing.evidenceIds ?? []), ...(it.evidenceIds ?? []), it.id])];
      if (it.impactLevel === "sehr_hoch" || (it.impactLevel === "hoch" && existing.impactLevel !== "sehr_hoch"))
        existing.impactLevel = it.impactLevel;
      if (it.confidence > existing.confidence) existing.confidence = it.confidence;
    } else {
      out.push({ ...it });
    }
  }
  return out;
}

export function runChangePotentialEngine(input: ChangePotentialEngineInput): ChangePotentialSummary {
  _itemIdCounter = 0;
  const items: ChangePotentialItem[] = [];
  const seenTitles = new Set<string>();

  const fullText = [
    input.vortext ?? "",
    input.lvPositions ?? "",
    ...(input.findings ?? []).map((f) => `${f.title} ${f.detail ?? ""}`).filter(Boolean),
    ...(input.riskClauses ?? []).map((r) => `${r.type} ${r.text} ${r.interpretation ?? ""}`).filter(Boolean),
  ].join("\n");

  // 1) Vortext
  if (input.vortext?.trim()) {
    const matches = findMatches(input.vortext, "vortext", "vortext");
    for (const { pattern, snippet } of matches) {
      const key = `${pattern.fieldType}:${pattern.changeMechanism}:${pattern.title}`;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      items.push(
        buildItemFromPattern(pattern, {
          sourceType: "vortext",
          sourcePath: "vortext",
          sourceQuote: snippet,
          evidenceIds: [],
        })
      );
    }
  }

  // 2) LV-Positionen
  if (input.lvPositions?.trim()) {
    const matches = findMatches(input.lvPositions, "position", "lvPositions");
    for (const { pattern, snippet } of matches) {
      const key = `${pattern.fieldType}:${pattern.changeMechanism}:${pattern.title}`;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      items.push(
        buildItemFromPattern(pattern, {
          sourceType: "position",
          sourcePath: "lvPositions",
          sourceQuote: snippet,
          evidenceIds: [],
        })
      );
    }
  }

  // 3) Findings (als Evidenz, nicht 1:1 pro Finding)
  for (const f of input.findings ?? []) {
    const text = `${f.title} ${f.detail ?? ""}`.trim();
    if (!text) continue;
    const matches = findMatches(text, "global", "finding");
    for (const { pattern } of matches) {
      const key = `${pattern.fieldType}:${pattern.changeMechanism}:${pattern.title}:${f.id}`;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      items.push(
        buildItemFromPattern(pattern, {
          sourceType: "global",
          sourcePath: "finding",
          sourceQuote: (f.detail ?? f.title).slice(0, 150),
          evidenceIds: [f.id],
        })
      );
    }
  }

  // 4) RiskClauses
  for (const r of input.riskClauses ?? []) {
    const text = `${r.type} ${r.text} ${r.interpretation ?? ""}`.trim();
    if (!text) continue;
    const matches = findMatches(text, "vortext", "riskClause");
    for (const { pattern, snippet } of matches) {
      const key = `${pattern.fieldType}:${pattern.changeMechanism}:${pattern.title}:risk:${r.type}`;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      items.push(
        buildItemFromPattern(pattern, {
          sourceType: "vortext",
          sourcePath: "riskClause",
          sourceQuote: snippet,
          evidenceIds: [],
        })
      );
    }
  }

  // 5) Fehlende KeyFacts
  for (const { key, fieldType, title, changeMechanism } of KEYFACT_PATTERNS) {
    const val = (input.keyFacts[key] ?? "").trim();
    if (val && val.length > 3) continue;
    const keyDedup = `keyfact:${key}`;
    if (seenTitles.has(keyDedup)) continue;
    seenTitles.add(keyDedup);
    items.push({
      id: nextItemId(),
      title,
      sourceType: "global",
      sourcePath: "keyFacts",
      fieldType,
      changeMechanism,
      impactLevel: "mittel",
      enforceability: "mittel",
      confidence: 0.85,
      recommendedAction: "rueckfrage",
      reasoning: `Fehlender KeyFact: ${key}. Kann Bauablauf- oder Abgrenzungsrisiko bedeuten.`,
      evidenceIds: [],
    });
  }

  const merged = mergeItems(items);

  const highImpactCount = merged.filter((i) => i.impactLevel === "hoch").length;
  const veryHighImpactCount = merged.filter((i) => i.impactLevel === "sehr_hoch").length;
  const strongEnforceabilityCount = merged.filter(
    (i) => i.enforceability === "sehr_gut" || i.enforceability === "gut"
  ).length;

  const fieldCounts = new Map<ChangePotentialFieldType, number>();
  const mechCounts = new Map<ChangePotentialMechanism, number>();
  for (const i of merged) {
    fieldCounts.set(i.fieldType, (fieldCounts.get(i.fieldType) ?? 0) + 1);
    mechCounts.set(i.changeMechanism, (mechCounts.get(i.changeMechanism) ?? 0) + 1);
  }

  const topFields = [...fieldCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([fieldType, count]) => ({ fieldType, count }));

  const topMechanisms = [...mechCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([mechanism, count]) => ({ mechanism, count }));

  const totalScore = merged.reduce((acc, i) => {
    const impact = { niedrig: 1, mittel: 2, hoch: 3, sehr_hoch: 4 }[i.impactLevel];
    return acc + impact * i.confidence;
  }, 0);
  const maxScore = merged.length * 4;
  const overallIndex = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return {
    overallIndex: Math.min(100, overallIndex),
    totalItems: merged.length,
    highImpactCount,
    veryHighImpactCount,
    strongEnforceabilityCount,
    items: merged,
    topFields,
    topMechanisms,
  };
}

// ================= Mapping auf Legacy (ChangeOrderOpportunity / byCluster) =================

export type ChangeOrderCluster =
  | "leistungsaenderung"
  | "leistungsmehrung"
  | "schnittstelle"
  | "erschwernis";

export type LegacyOpportunity = {
  id: string;
  cluster: ChangeOrderCluster;
  title: string;
  description: string;
  potential: "low" | "medium" | "high";
  riskLevel?: "low" | "medium" | "high";
  assertiveness?: "schwach" | "mittel" | "stark";
  reason: string;
  sourceFindingIds?: string[];
  sourceTextSnippets?: string[];
  sourceType?: ("finding" | "preface" | "keyfact" | "llm")[];
};

function fieldTypeToCluster(ft: ChangePotentialFieldType): ChangeOrderCluster {
  if (ft === "schnittstelle") return "schnittstelle";
  if (ft === "nebenleistung" || ft === "mengenrisiko") return "leistungsmehrung";
  if (ft === "bestand_erschwernis" || ft === "provisorium" || ft === "bauablauf") return "erschwernis";
  return "leistungsaenderung";
}

function impactToPotential(impact: ChangePotentialImpactLevel): "low" | "medium" | "high" {
  if (impact === "sehr_hoch" || impact === "hoch") return "high";
  if (impact === "mittel") return "medium";
  return "low";
}

function enforceabilityToAssertiveness(e: ChangePotentialEnforceability): "schwach" | "mittel" | "stark" {
  if (e === "sehr_gut" || e === "gut") return "stark";
  if (e === "mittel") return "mittel";
  return "schwach";
}

function sourceTypeToLegacy(st: ChangePotentialSourceType): "finding" | "preface" | "keyfact" {
  if (st === "vortext" || st === "position" || st === "remark" || st === "addtext") return "preface";
  if (st === "global") return "finding";
  return "finding";
}

export function mapChangePotentialSummaryToLegacy(summary: ChangePotentialSummary): LegacyOpportunity[] {
  return summary.items.map((it) => ({
    id: it.id,
    cluster: fieldTypeToCluster(it.fieldType),
    title: it.title,
    description: it.reasoning,
    potential: impactToPotential(it.impactLevel),
    riskLevel: (it.impactLevel === "sehr_hoch" ? "high" : it.impactLevel === "hoch" ? "high" : it.impactLevel === "mittel" ? "medium" : "low") as "low" | "medium" | "high",
    assertiveness: enforceabilityToAssertiveness(it.enforceability),
    reason: it.reasoning,
    sourceFindingIds: it.evidenceIds ?? [],
    sourceTextSnippets: it.sourceQuote ? [it.sourceQuote] : [],
    sourceType: [sourceTypeToLegacy(it.sourceType)],
  }));
}
