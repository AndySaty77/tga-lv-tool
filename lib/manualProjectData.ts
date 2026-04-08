/**
 * Manuelle Projektdaten-Ebene in result_json.manualProjectData.
 * Trennung von automatisch erkannten KeyFacts – keine Änderung an keyFacts-Struktur oder -Inhalten.
 */

import { KEYFACTS_CORE_12_KEYS } from "@/lib/keyFactsDefinition";
import { KEYFACT_FALLBACK_LABEL } from "@/lib/keyFactsValidation";

/** Erste 10 Kern-KeyFacts (ohne LV-Strukturgröße / Vorbemerkungsumfang). */
export const EDITABLE_KEYFACT_KEYS = KEYFACTS_CORE_12_KEYS.slice(0, 10) as readonly string[];

export const READONLY_PROJECT_KEYFACT_KEYS = KEYFACTS_CORE_12_KEYS.slice(10, 12) as readonly string[];

/** Speicher-Keys für manuelle Einträge (snake_case wie vorgegeben). */
export type ManualProjectFieldKey =
  | "projektname"
  | "ort_standort"
  | "bauherr"
  | "gewerk"
  | "projektart"
  | "vertragsgrundlage"
  | "zusatzvertragsbedingungen"
  | "angebotsfrist"
  | "bindefrist"
  | "ausfuehrungszeitraum"
  | "interne_notizen";

export type ManualProjectEntry = {
  manualValue: string;
  updatedAt: string;
  updatedBy?: string;
};

export type ManualProjectData = Partial<Record<ManualProjectFieldKey, ManualProjectEntry>>;

/** KeyFact-Key → manualProjectData-Feld (1:1). */
export const KEYFACT_KEY_TO_MANUAL: Record<string, ManualProjectFieldKey> = {
  bauvorhaben: "projektname",
  ort: "ort_standort",
  bauherr_ag: "bauherr",
  gewerk: "gewerk",
  projektart: "projektart",
  vertragsgrundlagen: "vertragsgrundlage",
  zusatzvertragsbedingungen: "zusatzvertragsbedingungen",
  fristAngebot: "angebotsfrist",
  bindefrist: "bindefrist",
  ausfuehrungszeitraum: "ausfuehrungszeitraum",
};

export const MANUAL_TO_KEYFACT: Partial<Record<ManualProjectFieldKey, string>> = Object.fromEntries(
  Object.entries(KEYFACT_KEY_TO_MANUAL).map(([kf, m]) => [m, kf]),
) as Partial<Record<ManualProjectFieldKey, string>>;

export type ManualValueSource =
  | "lv"
  | "manual_fill"
  | "manual_override"
  | "none";

const SOURCE_LABELS: Record<ManualValueSource, string> = {
  lv: "aus LV erkannt",
  manual_fill: "manuell ergänzt",
  manual_override: "manuell überschrieben",
  none: "nicht erkannt",
};

export function sourceLabelForDisplay(source: ManualValueSource): string {
  return SOURCE_LABELS[source];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isUsableRecognized(value: string, isFallbackRow: boolean): boolean {
  if (!value.trim()) return false;
  if (isFallbackRow) return false;
  if (value.trim() === KEYFACT_FALLBACK_LABEL) return false;
  return true;
}

export function parseManualProjectData(raw: unknown): ManualProjectData {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ManualProjectData = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const e = v as Record<string, unknown>;
    const mv = e.manualValue;
    if (!isNonEmptyString(mv)) continue;
    const ua = e.updatedAt;
    out[k as ManualProjectFieldKey] = {
      manualValue: mv.trim(),
      updatedAt: typeof ua === "string" && ua.trim() ? ua.trim() : new Date().toISOString(),
      updatedBy: isNonEmptyString(e.updatedBy) ? e.updatedBy.trim() : undefined,
    };
  }
  return out;
}

/**
 * Deep-Merge für PATCH: nur übergebene Felder werden überschrieben/ergänzt.
 */
export function mergeManualProjectDataPatch(prev: unknown, patch: unknown): ManualProjectData {
  const base = parseManualProjectData(prev);
  if (patch == null || typeof patch !== "object" || Array.isArray(patch)) return base;
  const next: ManualProjectData = { ...base };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v == null) continue;
    if (typeof v !== "object" || Array.isArray(v)) continue;
    const e = v as Record<string, unknown>;
    const mv = e.manualValue;
    if (mv === "") {
      delete next[k as ManualProjectFieldKey];
      continue;
    }
    if (!isNonEmptyString(mv)) continue;
    const ua = e.updatedAt;
    next[k as ManualProjectFieldKey] = {
      manualValue: mv.trim(),
      updatedAt: typeof ua === "string" && ua.trim() ? ua.trim() : new Date().toISOString(),
      updatedBy: isNonEmptyString(e.updatedBy) ? e.updatedBy.trim() : undefined,
    };
  }
  return next;
}

export type ProjectInfoRowModel = {
  manualKey: ManualProjectFieldKey | null;
  keyFactKey: string | null;
  label: string;
  finalValue: string;
  recognizedValue: string;
  recognizedUsable: boolean;
  source: ManualValueSource;
  sourceLabel: string;
  editable: boolean;
  multiline: boolean;
  /** Anzeige kursiv/grau (kein belastbarer erkannter Wert, kein manueller Ersatz). */
  emphasizeFallback: boolean;
};

/**
 * Finale Anzeige + Herkunft aus KeyFact-Zeile (wie Cockpit) und manuellem Eintrag.
 */
export function resolveRowPresentation(args: {
  keyFactKey: string | null;
  /** z. B. interne_notizen ohne KeyFact-Key */
  explicitManualKey?: ManualProjectFieldKey | null;
  label: string;
  /** Anzeigewert aus Analyse (inkl. Fallback-Label) */
  displayValue: string;
  /** true wenn keyFactsDisplayList isFallback gesetzt hat */
  isFallback: boolean;
  manual?: ManualProjectEntry | null;
  editable: boolean;
  multiline?: boolean;
}): ProjectInfoRowModel {
  const multiline = args.multiline ?? false;
  const manual = args.manual?.manualValue?.trim() ?? "";
  const hasManual = manual.length > 0;
  const recognizedUsable = args.keyFactKey
    ? isUsableRecognized(args.displayValue, args.isFallback)
    : false;

  let finalValue: string;
  let source: ManualValueSource;

  if (hasManual) {
    finalValue = manual;
    if (args.keyFactKey) {
      source = recognizedUsable ? "manual_override" : "manual_fill";
    } else {
      source = "manual_fill";
    }
  } else if (args.keyFactKey) {
    finalValue = args.displayValue;
    source = recognizedUsable ? "lv" : "none";
  } else {
    finalValue = "";
    source = "none";
  }

  const manualKey =
    args.explicitManualKey ??
    (args.keyFactKey ? KEYFACT_KEY_TO_MANUAL[args.keyFactKey] ?? null : null);

  const emphasizeFallback =
    !hasManual &&
    (args.keyFactKey ? !recognizedUsable : finalValue.trim().length === 0);

  return {
    manualKey,
    keyFactKey: args.keyFactKey,
    label: args.label,
    finalValue,
    recognizedValue: args.displayValue,
    recognizedUsable,
    source,
    sourceLabel: sourceLabelForDisplay(source),
    editable: args.editable,
    multiline,
    emphasizeFallback,
  };
}

/**
 * Liefert finalen String für ein KeyFact-Feld inkl. manueller Override (für spätere PDF-Nutzung).
 */
export function resolveFinalKeyFactDisplay(args: {
  keyFactKey: string;
  baseDisplay: string;
  isFallback: boolean;
  manualData: ManualProjectData;
}): { final: string; source: ManualValueSource } {
  const manualKey = KEYFACT_KEY_TO_MANUAL[args.keyFactKey];
  const entry = manualKey ? args.manualData[manualKey] : undefined;
  const row = resolveRowPresentation({
    keyFactKey: args.keyFactKey,
    label: "",
    displayValue: args.baseDisplay,
    isFallback: args.isFallback,
    manual: entry,
    editable: true,
  });
  return { final: row.finalValue, source: row.source };
}

export type ProjectInfoManualBundle = {
  rows: ProjectInfoRowModel[];
  notesRow: ProjectInfoRowModel;
};

/**
 * Bündelt die 12 Cockpit-KeyFact-Zeilen inkl. manueller Schicht + separater Notiz-Zeile.
 * Nur editierbare Keys erhalten manuelle Werte; LV-Strukturgröße / Vorbemerkungsumfang bleiben rein automatisch.
 */
export function buildProjectInfoManualBundle(
  keyFactsDisplayList: Array<{ key: string; label: string; value: string; isFallback: boolean }>,
  manualData: ManualProjectData,
): ProjectInfoManualBundle {
  const rows: ProjectInfoRowModel[] = [];
  for (const item of keyFactsDisplayList) {
    const editable = EDITABLE_KEYFACT_KEYS.includes(item.key);
    const manualKey = KEYFACT_KEY_TO_MANUAL[item.key];
    const m = editable && manualKey ? manualData[manualKey] : undefined;
    rows.push(
      resolveRowPresentation({
        keyFactKey: item.key,
        label: item.label,
        displayValue: item.value,
        isFallback: item.isFallback,
        manual: m,
        editable,
        multiline: false,
      }),
    );
  }
  const notesRow = resolveRowPresentation({
    keyFactKey: null,
    explicitManualKey: "interne_notizen",
    label: "Interne Notizen",
    displayValue: "",
    isFallback: true,
    manual: manualData.interne_notizen,
    editable: true,
    multiline: true,
  });
  return { rows, notesRow };
}

/**
 * Interne Team-Notizen für PDF (nur `manualValue`, keine KeyFact-Spiegelung).
 * @returns getrimmter Text oder `undefined`, wenn keine Notiz hinterlegt.
 */
export function getInternalTeamNotesTextForPdf(manualData: ManualProjectData): string | undefined {
  const v = manualData.interne_notizen?.manualValue?.trim();
  return v && v.length > 0 ? v : undefined;
}

/** Finaler Projektname für Kopfzeilen: manuell (projektname) vor KeyFacts-Kandidaten. */
export function resolveDisplayProjectName(
  manualData: ManualProjectData,
  keyFacts: Record<string, string> | undefined,
): string {
  const manual = manualData.projektname?.manualValue?.trim();
  if (manual) return manual;
  const kf = keyFacts ?? {};
  return (
    kf.objektbezeichnung?.trim() ||
    kf.projektbezeichnung?.trim() ||
    kf.bauvorhaben?.trim() ||
    ""
  );
}
