/**
 * Phase 1: Persistiert ausgelöste DB-Trigger in `trigger_fires` (typisch nach analyse/save).
 * Schema: analysis_id + trigger_id sind NOT NULL (UUID). Keine SYS/LEGAL/LLM-Zeilen.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/billing/stripeProfileSync";
import type { DbTrigger, TriggerEvaluation } from "@/lib/analyzeLvText";

/** UUID v4 (locker, case-insensitive), passend zu Postgres uuid. */
export function isUuidString(v: string | null | undefined): boolean {
  if (v == null || typeof v !== "string") return false;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export type TriggerFireInsert = {
  analysis_id: string;
  trigger_id: string;
  trigger_name_snapshot: string | null;
  trigger_category_snapshot: string | null;
  trigger_type_snapshot: string | null;
  trigger_weight_snapshot: number | null;
  claim_level_snapshot: string | null;
  source_scope: string | null;
  match_type: string | null;
  matched_keyword: string | null;
  matched_pattern: string | null;
  matched_excerpt: string | null;
  discipline_context: string | null;
  project_type: string | null;
  score_impact: number | null;
  is_top_risk: boolean;
  finding_key: string;
  finding_group: string | null;
  severity_level: string | null;
  used_in_questions: boolean;
  used_in_clarifications: boolean;
  used_in_management_summary: boolean;
};

/** Erkennt zusammengeführte DB-Trigger-IDs aus mergeSimilarFindings-Detail. */
function parseMergedTriggerIdsFromDetail(detail: string | undefined): string[] | null {
  if (!detail || !detail.includes("Zusammengeführt")) return null;
  const m = detail.match(/IDs:\s*([^\n|]+)/i);
  if (!m) return null;
  const part = m[1].trim();
  const ids = part
    .split(/,\s*/)
    .map((s) => s.replace(/\s*…\s*$/, "").trim())
    .filter((s) => s.length >= 8 && /^[0-9a-f-]+$/i.test(s));
  return ids.length > 0 ? ids : null;
}

const MAX_MATCHED_KEYWORD_SNAPSHOT = 2000;

/**
 * Liest „Keyword: …“ aus dem von applyDbTriggers erzeugten Finding-Detail (pipe-separiert).
 * Bei Regex-Triggern ist der Wert das tatsächlich gematchte Textfragment (Engine-Bezeichnung „Keyword:“ bleibt historisch).
 * Keine Heuristik auf LV-Rohdaten – nur parsen, wenn das Format passt.
 */
export function parseMatchedKeywordFromFindingDetail(detail: unknown): string | null {
  if (typeof detail !== "string" || !detail.trim()) return null;
  const parts = detail.split(/\s*\|\s*/);
  for (const p of parts) {
    const t = p.trim();
    if (t.length > 9 && t.toLowerCase().startsWith("keyword:")) {
      const v = t.slice("keyword:".length).trim();
      if (!v) return null;
      return v.length > MAX_MATCHED_KEYWORD_SNAPSHOT ? v.slice(0, MAX_MATCHED_KEYWORD_SNAPSHOT - 1) + "…" : v;
    }
  }
  return null;
}

function inferMatchType(t: DbTrigger | undefined): string | null {
  if (!t) return null;
  const rx = (t.regex ?? "").trim();
  return rx.length > 0 ? "regex" : "keyword";
}

function snapshotFromTrigger(t: DbTrigger): {
  trigger_name_snapshot: string | null;
  trigger_category_snapshot: string | null;
  trigger_type_snapshot: string | null;
  trigger_weight_snapshot: number | null;
  claim_level_snapshot: string | null;
  matched_pattern: string | null;
  source_scope: string | null;
} {
  return {
    trigger_name_snapshot: t.name ?? null,
    trigger_category_snapshot: (t.category ?? null) as string | null,
    trigger_type_snapshot: t.trigger_type ?? null,
    trigger_weight_snapshot: Number.isFinite(Number(t.weight)) ? Number(t.weight) : null,
    claim_level_snapshot: t.claim_level ?? null,
    matched_pattern: (t.regex ?? "").trim() || null,
    source_scope: (t.match_scope ?? "").trim() || "lv_full",
  };
}

/**
 * Nur DB-Trigger (Findings mit DB_*). Ohne gültige analysis_id (UUID): leeres Array.
 * Pro zusammengeführten DB-Finding: eine Zeile pro zugrunde liegendem Trigger (nur gültige trigger-UUIDs).
 */
export function buildTriggerFireRows(args: {
  findingsMapped: any[];
  dbTriggers: DbTrigger[];
  triggerEvaluations: TriggerEvaluation[];
  allowDisciplines: string[];
  analysisId: string | null | undefined;
  /** Wenn gesetzt, wird dieses Feld als discipline_context genutzt (Save-Flow: erkannte Gewerke als Anzeigenamen). */
  disciplineContextOverride?: string | null;
}): TriggerFireInsert[] {
  const {
    findingsMapped,
    dbTriggers,
    triggerEvaluations,
    allowDisciplines,
    analysisId,
    disciplineContextOverride,
  } = args;
  const analysis = typeof analysisId === "string" ? analysisId.trim() : "";
  if (!isUuidString(analysis)) {
    return [];
  }

  const evalById = new Map(triggerEvaluations.map((e) => [e.triggerId, e]));
  const triggerById = new Map(dbTriggers.map((t) => [t.id, t]));
  const disc =
    disciplineContextOverride !== undefined
      ? disciplineContextOverride?.trim() || null
      : allowDisciplines?.length
        ? allowDisciplines.join(",")
        : null;

  const rows: TriggerFireInsert[] = [];

  for (const f of findingsMapped ?? []) {
    const fid = String(f?.id ?? "");
    if (!fid.startsWith("DB_")) continue;

    const findingGroup = String(f?.category ?? "") || null;
    const severity = String(f?.severity ?? "").toLowerCase();
    const penalty = Number(f?.penalty ?? 0);
    const scoreExcluded = f?.score_excluded === true;
    const isTop = severity === "high" || severity === "critical" || (Number.isFinite(penalty) && penalty >= 8);

    const merged = parseMergedTriggerIdsFromDetail(typeof f.detail === "string" ? f.detail : undefined);
    const rawIds = merged ?? [fid.replace(/^DB_/, "")];
    const isMerged = (merged?.length ?? 0) > 1;
    /** Nur der erste Eintrag im Merge trägt das Keyword/Auszug aus first.detail; andere IDs nicht zuordenbar. */
    const primaryMergedTid = isMerged ? rawIds[0] : null;
    const detailKeyword = parseMatchedKeywordFromFindingDetail(f.detail);
    const findingTopKeyword =
      typeof f.matched_keyword === "string" && f.matched_keyword.trim() ? f.matched_keyword.trim() : null;

    for (const tid of rawIds) {
      if (!isUuidString(tid)) continue;

      const t = triggerById.get(tid);
      const ev = evalById.get(tid);
      const snap = t
        ? snapshotFromTrigger(t)
        : {
            trigger_name_snapshot: (f.title as string) ?? null,
            trigger_category_snapshot: null,
            trigger_type_snapshot: null,
            trigger_weight_snapshot: null,
            claim_level_snapshot: null,
            matched_pattern: null,
            source_scope: "lv_full" as string | null,
          };

      const scoreImpact = !scoreExcluded && !isMerged && Number.isFinite(penalty) ? penalty : null;

      const canUseSharedMatchFields = !isMerged || tid === primaryMergedTid;

      let matchedKeyword: string | null = (ev?.matchedKeyword ?? "").trim() || null;
      if (!matchedKeyword && findingTopKeyword && canUseSharedMatchFields) {
        matchedKeyword = findingTopKeyword;
      }
      if (!matchedKeyword && detailKeyword && canUseSharedMatchFields) {
        matchedKeyword = detailKeyword;
      }
      if (matchedKeyword && matchedKeyword.length > MAX_MATCHED_KEYWORD_SNAPSHOT) {
        matchedKeyword = matchedKeyword.slice(0, MAX_MATCHED_KEYWORD_SNAPSHOT - 1) + "…";
      }

      const excerptRaw =
        typeof f.raw_excerpt === "string" && f.raw_excerpt.trim() ? f.raw_excerpt.trim().slice(0, 8000) : null;
      const matched_excerpt = canUseSharedMatchFields ? excerptRaw : null;

      rows.push({
        analysis_id: analysis,
        trigger_id: tid,
        trigger_name_snapshot: snap.trigger_name_snapshot,
        trigger_category_snapshot: snap.trigger_category_snapshot,
        trigger_type_snapshot: snap.trigger_type_snapshot,
        trigger_weight_snapshot: snap.trigger_weight_snapshot,
        claim_level_snapshot: snap.claim_level_snapshot,
        source_scope: snap.source_scope,
        match_type: t ? inferMatchType(t) : null,
        matched_keyword: matchedKeyword,
        matched_pattern: snap.matched_pattern,
        matched_excerpt,
        discipline_context: disc,
        project_type: null,
        score_impact: scoreImpact,
        is_top_risk: isTop,
        finding_key: isMerged ? `${fid}#${tid}` : fid,
        finding_group: findingGroup,
        severity_level: f.severity ?? null,
        used_in_questions: false,
        used_in_clarifications: false,
        used_in_management_summary: false,
      });
    }
  }

  return rows;
}

/** Letzte Absicherung vor Insert (NOT NULL uuid). */
export function filterValidTriggerFireRows(rows: TriggerFireInsert[]): TriggerFireInsert[] {
  return rows.filter((r) => isUuidString(r.analysis_id) && isUuidString(r.trigger_id));
}

export type PersistTriggerFiresDebugContext = {
  analysisIdRaw: string | null | undefined;
  logPrefix?: string;
};

/** Gewerkekontext aus gespeichertem scoreResult (ohne Engine-Änderung). */
export function disciplineContextFromScoreResult(scoreResult: unknown): string | null {
  if (!scoreResult || typeof scoreResult !== "object") return null;
  const sr = scoreResult as Record<string, unknown>;
  const dt = sr.detectedTrades as Record<string, unknown> | undefined;
  if (!dt) return null;
  const parts: string[] = [];
  const p = dt.primaryTrade;
  if (typeof p === "string" && p.trim()) parts.push(p.trim());
  const sec = dt.secondaryTrades;
  if (Array.isArray(sec)) {
    for (const s of sec) {
      if (typeof s === "string" && s.trim()) parts.push(s.trim());
    }
  }
  return parts.length ? parts.join(", ") : null;
}

/** Gleiche Spalten wie /api/score (nur für Snapshot-Zuordnung beim Save). */
export async function fetchDbTriggersForLogging(supabase: SupabaseClient): Promise<DbTrigger[]> {
  const { data, error } = await supabase.from("triggers").select(`
      id,
      name,
      description,
      category,
      trigger_type,
      keywords,
      regex,
      norms,
      weight,
      claim_level,
      risk_interpretation,
      user_hint,
      question_template,
      offer_text_template,
      is_active,
      disciplines,
      context_required,
      exclude_keywords,
      match_scope
    `);
  if (error) {
    throw new Error(error.message ?? "triggers select failed");
  }
  return (data ?? []) as DbTrigger[];
}

/**
 * Nach erfolgreichem analyse/save: Findings aus result_json.scoreResult, Trigger aus DB, Insert mit fester analyse_run.id.
 */
export async function logTriggerFiresAfterAnalyseSave(args: {
  resultJson: unknown;
  analyseRunId: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const log = "[trigger_fires:save:debug]";
  const { resultJson, analyseRunId, supabase } = args;

  try {
    console.log(log, "analyse_run_id=", analyseRunId);

    if (!isUuidString(analyseRunId)) {
      console.log(log, "skip: invalid analyse_run_id");
      return;
    }

    const rj = resultJson && typeof resultJson === "object" ? (resultJson as Record<string, unknown>) : null;
    const scoreResult = rj?.scoreResult;
    const findingsSorted =
      scoreResult && typeof scoreResult === "object" && Array.isArray((scoreResult as any).findingsSorted)
        ? ((scoreResult as any).findingsSorted as any[])
        : null;

    console.log(log, "findingsSorted_count=", findingsSorted?.length ?? 0);

    if (!findingsSorted?.length) {
      console.log(log, "skip_build: no findingsSorted in scoreResult");
      await persistTriggerFires([], { analysisIdRaw: analyseRunId, logPrefix: log });
      return;
    }

    let dbTriggers: DbTrigger[];
    try {
      dbTriggers = await fetchDbTriggersForLogging(supabase);
      console.log(log, "triggers_loaded_for_snapshots=", dbTriggers.length);
    } catch (e) {
      console.warn(
        log,
        "triggers_fetch_failed:",
        e instanceof Error ? e.message : String(e)
      );
      return;
    }

    const discCtx = disciplineContextFromScoreResult(scoreResult);
    /** Evaluations aus dem Live-Score-Lauf liegen hier nicht vor; Match-Evidence kommt aus findingsSorted (detail/raw_excerpt). */
    const rowsBuilt = buildTriggerFireRows({
      findingsMapped: findingsSorted,
      dbTriggers,
      triggerEvaluations: [],
      allowDisciplines: [],
      analysisId: analyseRunId,
      disciplineContextOverride: discCtx,
    });

    console.log(log, "rows_built=", rowsBuilt.length, "| has_db_trigger_candidates=", rowsBuilt.length > 0);

    await persistTriggerFires(rowsBuilt, { analysisIdRaw: analyseRunId, logPrefix: log });
  } catch (e) {
    console.warn(
      "[trigger_fires:save:debug] unexpected_error:",
      e instanceof Error ? e.message : String(e)
    );
  }
}

/**
 * Batch-Insert in `trigger_fires`. Scheitert still — aufrufender Flow läuft weiter.
 */
export async function persistTriggerFires(
  rowsBuilt: TriggerFireInsert[],
  debug: PersistTriggerFiresDebugContext
): Promise<void> {
  const prefix = debug.logPrefix ?? "[trigger_fires:debug]";
  const analysisIdPresent = isUuidString(
    typeof debug.analysisIdRaw === "string" ? debug.analysisIdRaw.trim() : undefined
  );

  console.log(
    prefix,
    "analysis_id_valid_for_logging:",
    analysisIdPresent,
    "| raw_length:",
    typeof debug.analysisIdRaw === "string" ? debug.analysisIdRaw.length : 0
  );
  console.log(prefix, "rows_built:", rowsBuilt.length);

  const rows = filterValidTriggerFireRows(rowsBuilt);
  console.log(prefix, "rows_after_validation:", rows.length);

  if (rows.length === 0) {
    console.log(prefix, "skip_insert: no valid rows");
    return;
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    console.warn(prefix, "skip_insert: SUPABASE_SERVICE_ROLE_KEY fehlt");
    return;
  }

  try {
    const { error } = await supabase.from("trigger_fires").insert(rows as any);
    if (error) {
      console.warn(prefix, "insert_failed:", error.message, error.code ?? "");
    } else {
      console.log(prefix, "insert_ok: row_count=", rows.length);
    }
  } catch (e) {
    console.warn(prefix, "insert_exception:", e instanceof Error ? e.message : String(e));
  }
}
