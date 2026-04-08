/**
 * Listenansicht /app/analysen: Metadaten und Filter aus analyse_runs + result_json.
 * Nutzt dieselben finalen KeyFact-/Manual-Werte wie Cockpit/PDF (resolveFinalKeyFactDisplay).
 */

import { getAnalysisDisplayTitle } from "@/lib/analysisDisplayTitle";
import { KEYFACT_FALLBACK_LABEL } from "@/lib/keyFactsValidation";
import { buildKeyFactsDisplayListQuick } from "@/lib/keyFactsDisplayQuick";
import {
  parseManualProjectData,
  READONLY_PROJECT_KEYFACT_KEYS,
  resolveDisplayProjectName,
  resolveFinalKeyFactDisplay,
  type ManualProjectData,
} from "@/lib/manualProjectData";

const READONLY_KF = new Set<string>(READONLY_PROJECT_KEYFACT_KEYS);

function keyFactsToStringRecord(kf: unknown): Record<string, string> {
  if (kf == null || typeof kf !== "object" || Array.isArray(kf)) return {};
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(kf as Record<string, unknown>)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) o[k] = s;
  }
  return o;
}

function finalKeyFactLine(
  key: string,
  row: { value: string; isFallback: boolean },
  manualData: ManualProjectData,
): string {
  if (READONLY_KF.has(key)) return row.value;
  return resolveFinalKeyFactDisplay({
    keyFactKey: key,
    baseDisplay: row.value,
    isFallback: row.isFallback,
    manualData,
  }).final;
}

/** Erkennt belastbare Anzeige (kein Fallback-Label). */
export function isUsableListValue(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t === KEYFACT_FALLBACK_LABEL) return false;
  if (t.includes("nicht zuverlässig erkannt")) return false;
  return true;
}

/**
 * Versucht ein Datum aus Abgabefrist-Freitext (KeyFact fristAngebot; z. B. DD.MM.JJJJ) zu lesen.
 * Nur für Filter/Sortierung — keine fachliche Auslegung.
 */
export function tryParseAngebotsfristDate(raw: string): Date | null {
  const t = raw.trim();
  if (!t || !isUsableListValue(t)) return null;
  const dm = t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (dm) {
    const day = parseInt(dm[1], 10);
    const month = parseInt(dm[2], 10) - 1;
    let year = parseInt(dm[3], 10);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const d = new Date(year, month, day, 12, 0, 0, 0);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10) - 1;
    const day = parseInt(iso[3], 10);
    const d = new Date(y, m, day, 12, 0, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function formatDeDate(d: Date): string {
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const y = d.getFullYear();
  return `${day}.${month}.${y}`;
}

export type AnalyseListRowInput = {
  id: string;
  created_at: string;
  project_name: string | null;
  file_name: string | null;
  score: number | null;
  status: string | null;
  result_json: unknown;
  /** Spalte `analyse_runs.is_favorite`; fehlend/null = false. */
  is_favorite?: boolean | null;
};

export type AnalyseListDerived = {
  id: string;
  created_at: string;
  project_name: string | null;
  file_name: string | null;
  score: number | null;
  status: string | null;
  /** Zeilen-Titel */
  listTitle: string;
  /** Segmente für Meta-Zeile (Dateiname, Gewerk, …) */
  metaSegments: string[];
  /** Für Suche / Filter */
  gewerkNorm: string;
  projektartNorm: string;
  bauherrNorm: string;
  offerDeadline: Date | null;
  /** Kalendertage relativ zu heute; null ohne parsebare Abgabefrist. */
  deadlineDayDelta: number | null;
  /** Nur wenn parsebar und in 0…7 Tagen oder überfällig; sonst null. */
  deadlineWarnBadge: AnalyseListDeadlineWarnBadge | null;
  /** Persönliche Favoriten-Markierung (DB), kein Status. */
  isFavorite: boolean;
  searchBlob: string;
};

function normalizeResultJson(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (typeof p === "object" && p !== null && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export function deriveAnalyseListRow(row: AnalyseListRowInput): AnalyseListDerived {
  const rj = normalizeResultJson(row.result_json);
  const manualData = parseManualProjectData(rj.manualProjectData);
  const quick = buildKeyFactsDisplayListQuick(rj);
  const byKey = Object.fromEntries(quick.map((r) => [r.key, r])) as Record<
    string,
    { value: string; isFallback: boolean }
  >;

  const kfStr = keyFactsToStringRecord(rj.keyFacts);

  const resolvedName = resolveDisplayProjectName(manualData, kfStr).trim();
  const listTitle =
    resolvedName || getAnalysisDisplayTitle(row.project_name ?? null, row.file_name ?? null);

  const gewerk = finalKeyFactLine("gewerk", byKey.gewerk ?? { value: "", isFallback: true }, manualData);
  const projektart = finalKeyFactLine("projektart", byKey.projektart ?? { value: "", isFallback: true }, manualData);
  const bauherr = finalKeyFactLine("bauherr_ag", byKey.bauherr_ag ?? { value: "", isFallback: true }, manualData);
  const fristRaw = finalKeyFactLine("fristAngebot", byKey.fristAngebot ?? { value: "", isFallback: true }, manualData);

  const gewerkNorm = isUsableListValue(gewerk) ? gewerk.trim() : "";
  const projektartNorm = isUsableListValue(projektart) ? projektart.trim() : "";
  const bauherrNorm = isUsableListValue(bauherr) ? bauherr.trim() : "";

  const offerDeadline = tryParseAngebotsfristDate(fristRaw);
  const deadlineDayDelta = offerDeadline != null ? calendarDaysAfterToday(offerDeadline) : null;
  const deadlineWarnBadge = deriveDeadlineWarnBadge(offerDeadline);
  const fristDisplay = offerDeadline ? formatDeDate(offerDeadline) : isUsableListValue(fristRaw) ? fristRaw.trim() : "";

  const fileTrim = row.file_name?.trim() ?? "";
  const metaSegments: string[] = [];
  if (fileTrim) metaSegments.push(fileTrim);
  if (gewerkNorm) metaSegments.push(gewerkNorm);
  if (projektartNorm) metaSegments.push(projektartNorm);
  if (fristDisplay) metaSegments.push(fristDisplay);

  const metaStrLen = metaSegments.join(" · ").length;
  if (bauherrNorm && metaStrLen + bauherrNorm.length < 140) {
    metaSegments.push(bauherrNorm);
  }

  const searchBlob = [
    listTitle,
    fileTrim,
    row.project_name?.trim() ?? "",
    gewerkNorm,
    projektartNorm,
    bauherrNorm,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isFavorite = row.is_favorite === true;

  return {
    id: row.id,
    created_at: row.created_at,
    project_name: row.project_name,
    file_name: row.file_name,
    score: row.score,
    status: row.status,
    listTitle,
    metaSegments,
    gewerkNorm,
    projektartNorm,
    bauherrNorm,
    offerDeadline,
    deadlineDayDelta,
    deadlineWarnBadge,
    isFavorite,
    searchBlob,
  };
}

export type AnalyseListFristFilter =
  | ""
  | "present"
  | "none"
  | "overdue"
  | "today"
  | "d1to3"
  | "d4to7"
  | "within7";
export type AnalyseListSort = "newest" | "oldest" | "deadline" | "favorites_first";

export type AnalyseListFavoriteFilter = "" | "only";

export type AnalyseListQuery = {
  q: string;
  gewerk: string;
  projektart: string;
  frist: AnalyseListFristFilter;
  sort: AnalyseListSort;
  favorite: AnalyseListFavoriteFilter;
};

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Kalendertage zwischen heute (lokal, 0:00) und dem Abgabetag (nur Datum).
 * Negativ = überfällig. `null`, wenn kein parsebares Datum.
 */
export function calendarDaysAfterToday(deadline: Date): number {
  const sod = startOfTodayLocal();
  const a = Date.UTC(sod.getFullYear(), sod.getMonth(), sod.getDate());
  const b = Date.UTC(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  return Math.round((b - a) / 86400000);
}

/** Nur Abgabefrist (fristAngebot), nur bei parsebarem Datum; keine Bindefrist. */
export type AnalyseListDeadlineWarnBadge = "overdue" | "today" | "d1to3" | "d4to7";

/**
 * Warn-Badge nur für Abgabefrist in den nächsten 7 Tagen bzw. überfällig/heute.
 * Später als +7 Tage: neutral (kein Badge).
 */
export function deriveDeadlineWarnBadge(offerDeadline: Date | null): AnalyseListDeadlineWarnBadge | null {
  if (!offerDeadline) return null;
  const d = calendarDaysAfterToday(offerDeadline);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d >= 1 && d <= 3) return "d1to3";
  if (d >= 4 && d <= 7) return "d4to7";
  return null;
}

/** Substring-Match, case-insensitive */
function matchesToken(haystack: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return haystack.toLowerCase().includes(n);
}

export function filterAndSortAnalyseList(rows: AnalyseListDerived[], query: AnalyseListQuery): AnalyseListDerived[] {
  const q = query.q.trim().toLowerCase();
  const g = query.gewerk.trim();
  const p = query.projektart.trim();
  const frist = query.frist;
  const sort = query.sort;
  const favorite = query.favorite;

  let out = rows.filter((r) => {
    if (q && !r.searchBlob.includes(q)) return false;
    if (g && !matchesToken(r.gewerkNorm, g)) return false;
    if (p && !matchesToken(r.projektartNorm, p)) return false;
    if (favorite === "only" && !r.isFavorite) return false;

    const d = r.deadlineDayDelta;

    if (frist === "present") {
      if (d === null) return false;
    } else if (frist === "none") {
      if (d !== null) return false;
    } else if (frist === "overdue") {
      if (d === null || d >= 0) return false;
    } else if (frist === "today") {
      if (d !== 0) return false;
    } else if (frist === "d1to3") {
      if (d === null || d < 1 || d > 3) return false;
    } else if (frist === "d4to7") {
      if (d === null || d < 4 || d > 7) return false;
    } else if (frist === "within7") {
      if (d === null || d < 0 || d > 7) return false;
    }

    return true;
  });

  if (sort === "newest") {
    out = [...out].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else if (sort === "oldest") {
    out = [...out].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else if (sort === "deadline") {
    out = [...out].sort((a, b) => {
      const da = a.offerDeadline?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = b.offerDeadline?.getTime() ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  } else if (sort === "favorites_first") {
    out = [...out].sort((a, b) => {
      const fa = a.isFavorite ? 1 : 0;
      const fb = b.isFavorite ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  return out;
}
