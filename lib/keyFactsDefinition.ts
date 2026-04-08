/**
 * Zentrale Definition der 12 Key Facts (Single Source of Truth).
 * Alle Stellen, die Reihenfolge, Keys oder Labels der Kern-KeyFacts brauchen, importieren von hier.
 * Keine Fachlogik – nur Felddefinitionen, Reihenfolge und UI-Labels.
 */

export type KeyFactCoreEntry = {
  key: string;
  label: string;
};

/** Feste Definition der 12 Kern-KeyFacts in fester Reihenfolge (Anzeige & API). */
export const KEYFACTS_CORE_12: readonly KeyFactCoreEntry[] = [
  { key: "bauvorhaben", label: "Projektname" },
  { key: "ort", label: "Ort / Standort" },
  { key: "bauherr_ag", label: "Bauherr" },
  { key: "gewerk", label: "Gewerk" },
  { key: "projektart", label: "Projektart" },
  { key: "vertragsgrundlagen", label: "Vertragsgrundlage" },
  { key: "zusatzvertragsbedingungen", label: "Zusätzliche Vertragsbedingungen" },
  { key: "fristAngebot", label: "Abgabefrist" },
  { key: "bindefrist", label: "Bindefrist" },
  { key: "ausfuehrungszeitraum", label: "Ausführungszeitraum" },
  { key: "lv_strukturgroesse", label: "LV-Strukturgröße" },
  { key: "vorbemerkungsumfang", label: "Vorbemerkungsumfang" },
] as const;

/** Nur die Keys der 12 Kern-KeyFacts in fester Reihenfolge (für Iteration, KEYSET-Spread, Display). */
export const KEYFACTS_CORE_12_KEYS: readonly string[] = KEYFACTS_CORE_12.map((e) => e.key);

/** Labels nur für die 12 Kern-KeyFacts (key → label). */
export const KEYFACT_CORE_LABELS: Record<string, string> = Object.fromEntries(
  KEYFACTS_CORE_12.map((e) => [e.key, e.label])
);

/**
 * Alle KeyFact-Labels (12 Kern + optionale Felder für Rückfragen, Nachtrag, Vertragsrahmen etc.).
 * Eine zentrale Quelle für UI-Labels in Score-Page, DetailContent, clarificationQuestions, offerAssumptions.
 */
export const KEYFACT_LABELS: Record<string, string> = {
  ...KEYFACT_CORE_LABELS,
  // Optionale Felder (nicht in den 12 Kern)
  planer: "Planer / Architekt",
  baubeginn: "Baubeginn",
  bauzeit: "Bauzeit / Dauer",
  fertigstellung: "Fertigstellung / Abnahme",
  ausfuehrungsfrist: "Ausführungsfrist / Terminplan",
  ausfuehrungszeit: "Ausführungszeit",
  submission_einreichung: "Submission / Einreichung",
  vertragsstrafe: "Vertragsstrafe / Pönale",
  gewaerhleistung: "Gewährleistung / Mängelhaftung",
  wartung_instandhaltung: "Wartung / Instandhaltung",
  vob_bgb: "VOB/B / BGB",
  rangfolge: "Rangfolge Vertragsunterlagen",
  zahlungsbedingungen: "Zahlungsbedingungen",
  abschlagszahlung: "Abschlagszahlung",
  schlussrechnung: "Schlussrechnung / Zahlungsziel",
  preisgleitung: "Preisgleitklausel / Rohstoffpreise",
};

/** Helper: Label für einen KeyFact-Key (Kern oder optional). */
export function getKeyFactLabel(key: string): string {
  return KEYFACT_LABELS[key] ?? key;
}
