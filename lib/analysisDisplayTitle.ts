/**
 * Einheitlicher Anzeige- und Speicher-Titel für gespeicherte Analysen (analyse_runs.project_name).
 * Keine Engine-Logik – nur String-Priorität und Heuristiken für schwache Extraktionen.
 */

export const ANALYSIS_FALLBACK_TITLE = "Unbenannte Analyse";

/** GAEB-typische und häufige LV-Dateiendungen – nur für Anzeige, DB bleibt unverändert. */
const DISPLAY_FILE_EXT = /\.(x83|p83|d83|gml|xml|gaeb)$/i;

export function stripKnownGaebExtensionForDisplay(fileName: string): string {
  const t = typeof fileName === "string" ? fileName.trim() : "";
  if (!t) return t;
  const stripped = t.replace(DISPLAY_FILE_EXT, "").trim();
  return stripped.length > 0 ? stripped : t;
}

/**
 * Einzelne generische Begriffe ohne konkreten Projektkontext (nur als Ganzes oder wenn alle
 * Token aus dieser Menge stammen) → lieber Dateiname.
 */
const GENERIC_PROJECT_TOKENS = new Set([
  "projekt",
  "bauvorhaben",
  "sanierung",
  "lv",
  "anlage",
  "ausschreibung",
  "leistungsverzeichnis",
  "vortext",
  "gaeb",
  "nachtrag",
  "neubau",
  "umbau",
  "renovierung",
  "ausbau",
  "erweiterung",
  "bau",
  "bauarbeiten",
  "objekt",
  "gewerk",
  "verzeichnis",
  "dokument",
  "dokumente",
  "auftrag",
  "leistung",
]);

function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9äöüß]/gu, "");
}

function tokenizeProjectName(s: string): string[] {
  return s
    .split(/[\s\-_/.,;:()[\]{}]+/)
    .map((t) => normalizeToken(t))
    .filter(Boolean);
}

/**
 * True, wenn der gespeicherte/erkannte Projektname gegenüber einem Dateinamen vertrauenswürdig ist.
 * Schwache oder generische Extrakte sollen nicht den Dateinamen verdrängen.
 */
export function isReliableProjectName(projectName: string | null | undefined): boolean {
  const s = typeof projectName === "string" ? projectName.trim() : "";
  if (s.length === 0) return false;
  if (s === ANALYSIS_FALLBACK_TITLE) return false;
  if (/^[\s._\-–—]+$/.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  if (s.length < 3) return false;

  const tokens = tokenizeProjectName(s);
  if (tokens.length === 0) return false;
  if (tokens.every((t) => GENERIC_PROJECT_TOKENS.has(t))) return false;
  if (tokens.length === 1 && GENERIC_PROJECT_TOKENS.has(tokens[0])) return false;

  return true;
}

/**
 * Anzeigetitel: belastbarer Projektname, sonst Dateiname, sonst schwacher Name nur wenn keine Datei, sonst Fallback.
 */
export function getAnalysisDisplayTitle(projectName: string | null | undefined, fileName: string | null | undefined): string {
  const pn = typeof projectName === "string" ? projectName.trim() : "";
  const fn = typeof fileName === "string" ? fileName.trim() : "";

  if (pn && isReliableProjectName(pn)) return pn;
  if (fn) return stripKnownGaebExtensionForDisplay(fn);
  if (pn) return pn;
  return ANALYSIS_FALLBACK_TITLE;
}

/**
 * Vorbelegung beim INSERT (z. B. /api/analyse/save): nur belastbaren Projektnamen übernehmen, sonst Dateiname.
 */
export function resolveAnalysisTitleForInsert(projectNameFromClient: string | null | undefined, fileName: string | null | undefined): string {
  const pn = typeof projectNameFromClient === "string" ? projectNameFromClient.trim() : "";
  const fn = typeof fileName === "string" ? fileName.trim() : "";

  if (pn && isReliableProjectName(pn)) return pn;
  if (fn) return fn;
  if (pn) return pn;
  return ANALYSIS_FALLBACK_TITLE;
}

/**
 * Titel nach Bearbeitung speichern: getrimmter Text; leer → sinnvoller Fallback über Dateiname.
 * Explizit getippter Text (auch schwach) bleibt erhalten — Anzeige kann trotzdem Dateiname bevorzugen.
 */
export function normalizeEditableTitleInput(input: string | null | undefined, fileName: string | null | undefined): string {
  const t = typeof input === "string" ? input.trim() : "";
  if (t) return t;
  return resolveAnalysisTitleForInsert(null, fileName);
}
