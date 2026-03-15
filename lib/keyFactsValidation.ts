/**
 * KeyFacts-Validierung: Trennung Extraktion → Validierung → Anzeige.
 * Regel: Lieber kein Wert als ein falscher Wert. Nur belastbare Key Facts im Standardmodus.
 */

import { KEYFACTS_CORE_12_KEYS } from "./keyFactsDefinition";

export type KeyFactSourceType =
  | "title"
  | "metadata"
  | "vortext"
  | "position"
  | "llm"
  | "derived"
  | "normalized-global-remarks"
  | "normalized-top-label"
  | "normalized-groups"
  | "normalized-group-remarks"
  | "normalized-items"
  | null;

export type KeyFactStatus = "found" | "missing" | "rejected";

export type KeyFactFieldEntry = {
  value: string | null;
  confidence: number | null;
  status: KeyFactStatus;
  sourceType: KeyFactSourceType;
  sourceText: string | null;
  rejectionReason?: string | null;
};

/** Feste Reihenfolge der 12 Key Facts für die Anzeige (stabiler Prüfblock). Aus keyFactsDefinition. */
export const KEYFACTS_DISPLAY_ORDER_12: readonly string[] = KEYFACTS_CORE_12_KEYS;

/** Projekt-Stammdaten-Felder: Werte aus Positions-Text ablehnen. */
const PROJECT_METADATA_FIELDS = new Set([
  "bauvorhaben",
  "ort",
  "bauherr_ag",
  "gewerk",
  "projektart",
  "vertragsgrundlagen",
  "fristAngebot",
  "bindefrist",
  "ausfuehrungszeitraum",
  "planer",
  "baubeginn",
  "bauzeit",
  "fertigstellung",
  "ausfuehrungsfrist",
  "ausfuehrungszeit",
  "submission_einreichung",
]);

/** Quellen, die als „Position/Leistungstext“ gelten – für Stammdaten nicht zulassen. */
const POSITION_LIKE_SOURCES = new Set<string>([
  "normalized-items",
  "position",
  "positionen",
]);

// ================= Globale Blacklist / Garbage =================

const GARBAGE_EXACT = new Set(
  [
    "n/a",
    "n.a.",
    "na",
    "none",
    "unknown",
    "tbd",
    "folgt",
    "k.a.",
    "ka",
    "nicht relevant",
    "keine angabe",
    "keine angaben",
    "keine angabe im lv erkannt",
    "—",
    "–",
    "-",
    ".",
    "...",
    "n.b.",
    "n.v.",
    "n/v",
    "zu benennen",
    "noch zu benennen",
    "siehe position",
    "gemäß position",
    "siehe anlage",
  ].map((s) => s.toLowerCase().trim())
);

const GARBAGE_PATTERNS: RegExp[] = [
  /^(?:n\.?\s*v\.?|n\/a|–|—|-|\.\.\.|tbd|k\.\s*a\.)\s*$/i,
  /^(?:keine\s+angabe|keine\s+angaben|nicht\s+relevant|unknown|none)\s*$/i,
  /^(?:zu\s+benennen|noch\s+zu\s+benennen|siehe\s+(?:anlage|position)|gemäß\s+position)\s*$/i,
  /\b(?:anzubringen|liefern\s+und\s+montieren|veranlassen|vorarbeiten|veranlassten\s+vorarbeiten)\s*$/i,
  /\bhafter\s+Ausführung\s+anzubringen\s*$/i,
  /^\s*(?:stück|pauschal|lfm)\s*$/i,
  /^(?:m2|m²|m3|m³|kg|st\.?|lfm)\s*$/i,
  /^\d+\s*(?:stück|st\.?|m2|m²|kg)\s*$/i,
  /\s(den|der|die|dem|das|sonstige|im)\s*$/i,
  /\s(oder|und)\s*$/i,
];

function isRejectedByBlacklist(value: string): boolean {
  const s = (value ?? "").trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  if (GARBAGE_EXACT.has(lower)) return true;
  for (const re of GARBAGE_PATTERNS) {
    if (typeof re === "function") continue;
    if (re.test(s)) return true;
  }
  if (s.length < 4 && !/^(vob|bgb|vob\/b|vob\/c)$/i.test(s)) return true;
  if (/^[\W_]+$/.test(s)) return true;
  if (/^\d{1,3}$/.test(s)) return true;
  if (!/[a-zA-ZÄÖÜäöüß]{3,}/.test(s)) return true;
  return false;
}

/** Offensichtlich Satzfragment (enden mit Artikel/Präposition, Verben). */
function looksLikeSentenceFragment(value: string): boolean {
  const s = (value ?? "").trim();
  if (s.length < 15) return false;
  if (/\s(den|der|die|dem|das|sonstige|im|oder|und)\s*$/i.test(s)) return true;
  if (/[a-zäöüß]\s*$/.test(s) && s.length > 60) return true;
  if (/\b(entnommen werden|zu erbringen|vorzulegen|zu bestätigen)\s*$/i.test(s)) return true;
  return false;
}

/** Leistungs-/Positionstext-Muster (soll nicht in Stammdaten landen). */
function looksLikePositionText(value: string): boolean {
  const s = (value ?? "").trim().toLowerCase();
  if (/\b(liefern und montieren|einbauen|ausführen|pauschal|stück|lfm|m2|m²)\b/.test(s)) return true;
  if (/\b(veranlassen|vorarbeiten|anzubringen)\b/.test(s)) return true;
  if (/^\d+\s*(st\.?|stück|meter|m\s*)\s*/.test(s)) return true;
  return false;
}

// ================= Feldspezifische Validierung =================

const MAX_LENGTH: Record<string, number> = {
  bauvorhaben: 120,
  ort: 100,
  bauherr_ag: 120,
  gewerk: 80,
  projektart: 60,
  vertragsgrundlagen: 200,
  fristAngebot: 80,
  bindefrist: 80,
  ausfuehrungszeitraum: 120,
  planer: 100,
  baubeginn: 80,
  bauzeit: 80,
  fertigstellung: 100,
  ausfuehrungsfrist: 120,
  ausfuehrungszeit: 80,
  submission_einreichung: 80,
};

const PROJECT_TYPE_VALID = /^(?:neubau|umbau|sanierung|bestand|erweiterung|modernisierung|instandsetzung|wohnungsbau|gewerbe|sonderbau|öffentlich)/i;
const CONTRACT_BASIS_VALID = /^(?:vob|vob\/?a|vob\/?b|vob\/?c|bgb|hoai|vob\s*,\s*teile?\s*a)/i;
const DATE_OR_PERIOD = /\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}|\d{1,2}\.\s*KW\s*\d{4}|\b(?:bis|ab|von)\s+\.*\/\d|wochen?|monate?|jahre?|kw\s*\d/i;

function validateField(field: string, value: string, sourceType: KeyFactSourceType): { ok: boolean; reason?: string } {
  const s = (value ?? "").trim();
  if (!s) return { ok: false, reason: "empty" };

  if (isRejectedByBlacklist(s)) return { ok: false, reason: "blacklist" };
  if (looksLikeSentenceFragment(s)) return { ok: false, reason: "sentence_fragment" };

  if (PROJECT_METADATA_FIELDS.has(field) && sourceType && POSITION_LIKE_SOURCES.has(String(sourceType))) {
    return { ok: false, reason: "source_position_for_metadata" };
  }

  if (looksLikePositionText(s) && PROJECT_METADATA_FIELDS.has(field)) {
    return { ok: false, reason: "position_text_in_metadata" };
  }

  const maxLen = MAX_LENGTH[field] ?? 200;
  if (s.length > maxLen) return { ok: false, reason: "max_length" };

  switch (field) {
    case "bauvorhaben":
      if (/^(nicht\s+relevant|unknown|n\.?a\.?)\s*$/i.test(s)) return { ok: false, reason: "invalid_project_name" };
      if (s.split(/\s+/).length > 15) return { ok: false, reason: "too_long_project_name" };
      if (/\d{4,}/.test(s) && s.length < 20) return { ok: false, reason: "likely_id_not_name" };
      break;
    case "ort":
      if (!/\d{5}|[A-Za-zäöüÄÖÜß\-]{3,}/.test(s)) return { ok: false, reason: "no_location_signal" };
      break;
    case "bauherr_ag":
      if (/^(nicht\s+relevant|unknown)\s*$/i.test(s)) return { ok: false, reason: "invalid_client" };
      break;
    case "vertragsgrundlagen":
      if (!CONTRACT_BASIS_VALID.test(s) && s.length < 10) return { ok: false, reason: "no_contract_signal" };
      break;
    case "projektart":
      if (!PROJECT_TYPE_VALID.test(s) && s.length < 4) return { ok: false, reason: "no_project_type_signal" };
      break;
    case "fristAngebot":
    case "bindefrist":
    case "ausfuehrungszeitraum":
    case "baubeginn":
    case "bauzeit":
    case "fertigstellung":
    case "ausfuehrungsfrist":
    case "ausfuehrungszeit":
    case "submission_einreichung":
      if (!DATE_OR_PERIOD.test(s) && s.length < 8) return { ok: false, reason: "no_date_signal" };
      if (/(vorzulegen|zu bestätigen|entnommen werden|der die zeitliche)/i.test(s)) return { ok: false, reason: "date_fragment" };
      if (s.length > 100) return { ok: false, reason: "date_too_long" };
      break;
    default:
      break;
  }

  return { ok: true };
}

// ================= Confidence: nur für validierte Werte =================

function confidenceForDisplay(confidence: number | null | undefined, status: KeyFactStatus): number | null {
  if (status !== "found") return null;
  const c = Number(confidence);
  if (!Number.isFinite(c) || c < 0.55) return null;
  return Math.min(1, Math.max(0, c));
}

// ================= Öffentliche API =================

/**
 * Validiert einen KeyFact-Kandidaten und liefert ein KeyFactFieldEntry.
 * Bei Ablehnung: status "rejected" und rejectionReason.
 */
export function validateKeyFactCandidate(
  field: string,
  rawValue: string | null | undefined,
  options: {
    sourceType?: KeyFactSourceType | string | null;
    sourceText?: string | null;
    rawConfidence?: number | null;
  } = {}
): KeyFactFieldEntry {
  const { sourceType = null, sourceText = null, rawConfidence = null } = options;
  const value = (rawValue ?? "").toString().trim();

  if (!value) {
    return {
      value: null,
      confidence: null,
      status: "missing",
      sourceType: sourceType as KeyFactSourceType,
      sourceText,
      rejectionReason: "empty",
    };
  }

  const src = sourceType != null ? String(sourceType) : null;
  const validation = validateField(field, value, src as KeyFactSourceType);

  if (!validation.ok) {
    return {
      value: null,
      confidence: null,
      status: "rejected",
      sourceType: sourceType as KeyFactSourceType,
      sourceText,
      rejectionReason: validation.reason ?? "validation_failed",
    };
  }

  const conf = confidenceForDisplay(rawConfidence, "found");
  return {
    value,
    confidence: conf,
    status: "found",
    sourceType: sourceType as KeyFactSourceType,
    sourceText,
  };
}

/**
 * Erzeugt aus flachen keyFacts + keyFactConfidence + sources eine Map von KeyFactFieldEntry.
 * Nur Einträge mit status "found" sind für die Standard-Anzeige nutzbar.
 */
export function buildKeyFactsValidated(
  keyFacts: Record<string, string> | null | undefined,
  keyFactConfidence: Record<string, number> | null | undefined,
  sourcesByField: Record<string, { sourceTextType?: string; sourcePath?: string }> | null | undefined
): Record<string, KeyFactFieldEntry> {
  const out: Record<string, KeyFactFieldEntry> = {};
  const keys = new Set([
    "bauvorhaben",
    "ort",
    "bauherr_ag",
    "gewerk",
    "projektart",
    "vertragsgrundlagen",
    "fristAngebot",
    "bindefrist",
    "ausfuehrungszeitraum",
    "planer",
    "baubeginn",
    "bauzeit",
    "fertigstellung",
    "ausfuehrungsfrist",
    "ausfuehrungszeit",
    "submission_einreichung",
    "vob_bgb",
    "zusatzvertragsbedingungen",
    "lv_strukturgroesse",
    "vorbemerkungsumfang",
  ]);

  for (const field of keys) {
    const raw = keyFacts?.[field];
    const conf = keyFactConfidence?.[field];
    const src = sourcesByField?.[field];
    const entry = validateKeyFactCandidate(field, raw ?? null, {
      sourceType: src?.sourceTextType ?? null,
      sourceText: src?.sourcePath ?? null,
      rawConfidence: conf ?? null,
    });
    out[field] = entry;
  }

  return out;
}

/** Nur Felder mit status "found" und gültigem value für Standard-Anzeige. */
export function getDisplayableKeyFacts(
  validated: Record<string, KeyFactFieldEntry>
): Array<{ field: string; value: string; confidence: number | null }> {
  return Object.entries(validated)
    .filter(([, e]) => e.status === "found" && e.value != null && e.value.trim() !== "")
    .map(([field, e]) => ({ field, value: e.value!, confidence: e.confidence }));
}

/** Legacy: flaches keyFacts-Objekt nur mit akzeptierten Werten (für Rückwärtskompatibilität). */
export function toLegacyKeyFacts(validated: Record<string, KeyFactFieldEntry>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, e] of Object.entries(validated)) {
    if (e.status === "found" && e.value) out[k] = e.value;
  }
  return out;
}

/** Legacy: Confidence nur für gefundene Werte. */
export function toLegacyKeyFactConfidence(validated: Record<string, KeyFactFieldEntry>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, e] of Object.entries(validated)) {
    if (e.status === "found" && e.confidence != null) out[k] = e.confidence;
  }
  return out;
}

/** Einheitlicher Fallback-Text für missing/rejected im Standardmodus. */
export const KEYFACT_FALLBACK_LABEL = "im LV nicht zuverlässig erkannt";

/**
 * Liefert den Anzeigewert für ein Feld im Standardmodus:
 * found → value, sonst → KEYFACT_FALLBACK_LABEL
 */
export function getDisplayValueForStatus(
  entry: KeyFactFieldEntry | null | undefined
): string {
  if (!entry) return KEYFACT_FALLBACK_LABEL;
  if (entry.status === "found" && entry.value != null && entry.value.trim() !== "") return entry.value;
  return KEYFACT_FALLBACK_LABEL;
}
