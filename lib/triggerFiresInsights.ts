/**
 * Read-only Aggregationen für Admin: Trigger-Fires (intern).
 *
 * Analysebezug: `analyse_runs` per `id = trigger_fires.analysis_id` (Service Role, Batches).
 * Fehlende Zeilen (z. B. gelöschte Analyse) → kein Eintrag in `analyseLabelsById` (UI zeigt Hinweis + UUID).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/billing/stripeProfileSync";

export type TriggerFireInsightRow = {
  analysis_id: string;
  trigger_id: string;
  created_at: string;
  trigger_name_snapshot: string | null;
  trigger_category_snapshot: string | null;
  discipline_context: string | null;
  matched_excerpt: string | null;
  is_top_risk: boolean;
};

export type TriggerFireKpis = {
  totalFires: number;
  /** null, wenn nur eine Teilmenge der Tabelle für Aggregationen geladen wurde */
  analysesWithFires: number | null;
  distinctTriggersFired: number | null;
  lastFireAt: string | null;
};

export type TopTriggerRow = {
  trigger_id: string;
  trigger_name_snapshot: string | null;
  trigger_category_snapshot: string | null;
  fireCount: number;
  /** Fires mit is_top_risk = true (Teilmenge wie Rangliste, wenn aggregationCapped) */
  topRiskFireCount: number;
  /** topRiskFireCount / fireCount, 0..1 */
  topRiskShare: number;
  analysisCount: number;
  lastFireAt: string | null;
};

export type PerAnalysisRow = {
  analysis_id: string;
  rowCount: number;
  distinctTriggers: number;
  lastFireAt: string | null;
};

/** Rohdaten aus analyse_runs für Anzeigetitel (getAnalysisDisplayTitle im UI). */
export type AnalyseRunLabels = {
  project_name: string | null;
  file_name: string | null;
};

export type TriggerFiresInsightsPayload = {
  ok: true;
  kpis: TriggerFireKpis;
  topTriggers: TopTriggerRow[];
  recentFires: TriggerFireInsightRow[];
  perAnalysis: PerAnalysisRow[];
  /** Key = analysis_id (UUID); fehlend = kein passender analyse_run (orphan / gelöscht) */
  analyseLabelsById: Record<string, AnalyseRunLabels>;
  /** true, wenn nicht alle Zeilen für Aggregationen geladen wurden (KPIs teilweise null, Tabellen nur Teilmenge) */
  aggregationCapped: boolean;
};

export type TriggerFiresInsightsError = {
  ok: false;
  error: string;
};

const SLIM_SELECT =
  "analysis_id, trigger_id, created_at, trigger_name_snapshot, trigger_category_snapshot, discipline_context, matched_excerpt, is_top_risk" as const;

const PAGE_SIZE = 1000;
/** Obergrenze Zeilen für In-Memory-Aggregation (intern, risikoarm). */
const MAX_AGGREGATION_ROWS = 50_000;

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

async function fetchTotalCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from("trigger_fires").select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function normalizeInsightRows(raw: unknown[]): TriggerFireInsightRow[] {
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      analysis_id: String(r.analysis_id ?? ""),
      trigger_id: String(r.trigger_id ?? ""),
      created_at: String(r.created_at ?? ""),
      trigger_name_snapshot: (r.trigger_name_snapshot as string | null) ?? null,
      trigger_category_snapshot: (r.trigger_category_snapshot as string | null) ?? null,
      discipline_context: (r.discipline_context as string | null) ?? null,
      matched_excerpt: (r.matched_excerpt as string | null) ?? null,
      is_top_risk: Boolean(r.is_top_risk),
    };
  });
}

async function fetchRecentFires(supabase: SupabaseClient, limit: number): Promise<TriggerFireInsightRow[]> {
  const { data, error } = await supabase
    .from("trigger_fires")
    .select(SLIM_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return normalizeInsightRows(data ?? []);
}

/**
 * Lädt schlanke Zeilen in Seiten für Aggregationen (KPIs ohne doppeltes Zählen, Top-Trigger, pro Analyse).
 */
/**
 * Lädt bis zu `maxRows` Zeilen, neueste zuerst (stabile Aggregation auf Zeitfenster bei großen Tabellen).
 */
async function fetchSlimNewestForAggregation(
  supabase: SupabaseClient,
  knownTotal: number,
  maxRows: number
): Promise<{ rows: TriggerFireInsightRow[]; capped: boolean }> {
  const rows: TriggerFireInsightRow[] = [];
  let from = 0;

  while (from < maxRows) {
    const pageEnd = Math.min(from + PAGE_SIZE - 1, maxRows - 1);
    const { data, error } = await supabase
      .from("trigger_fires")
      .select(SLIM_SELECT)
      .order("created_at", { ascending: false })
      .range(from, pageEnd);
    if (error) throw new Error(error.message);
    const chunk = normalizeInsightRows(data ?? []);
    if (chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const capped = knownTotal > rows.length;
  return { rows, capped };
}

function buildTopTriggers(rows: TriggerFireInsightRow[]): TopTriggerRow[] {
  const byTrigger = new Map<
    string,
    {
      name: string | null;
      category: string | null;
      fires: number;
      topRiskFires: number;
      analyses: Set<string>;
      last: string | null;
    }
  >();

  for (const r of rows) {
    const tid = r.trigger_id;
    let e = byTrigger.get(tid);
    if (!e) {
      e = {
        name: r.trigger_name_snapshot,
        category: r.trigger_category_snapshot,
        fires: 0,
        topRiskFires: 0,
        analyses: new Set(),
        last: null,
      };
      byTrigger.set(tid, e);
    }
    e.fires++;
    if (r.is_top_risk) e.topRiskFires++;
    e.analyses.add(r.analysis_id);
    e.last = maxIso(e.last, r.created_at);
    if (r.trigger_name_snapshot) e.name = r.trigger_name_snapshot;
    if (r.trigger_category_snapshot) e.category = r.trigger_category_snapshot;
  }

  return [...byTrigger.entries()]
    .map(([trigger_id, v]) => {
      const topRiskFireCount = v.topRiskFires;
      const topRiskShare = v.fires > 0 ? topRiskFireCount / v.fires : 0;
      return {
        trigger_id,
        trigger_name_snapshot: v.name,
        trigger_category_snapshot: v.category,
        fireCount: v.fires,
        topRiskFireCount,
        topRiskShare,
        analysisCount: v.analyses.size,
        lastFireAt: v.last,
      };
    })
    .sort((a, b) => b.fireCount - a.fireCount);
}

function buildPerAnalysis(rows: TriggerFireInsightRow[]): PerAnalysisRow[] {
  const byAnalysis = new Map<
    string,
    {
      rowCount: number;
      triggers: Set<string>;
      last: string | null;
    }
  >();

  for (const r of rows) {
    let e = byAnalysis.get(r.analysis_id);
    if (!e) {
      e = { rowCount: 0, triggers: new Set(), last: null };
      byAnalysis.set(r.analysis_id, e);
    }
    e.rowCount++;
    e.triggers.add(r.trigger_id);
    e.last = maxIso(e.last, r.created_at);
  }

  return [...byAnalysis.entries()]
    .map(([analysis_id, v]) => ({
      analysis_id,
      rowCount: v.rowCount,
      distinctTriggers: v.triggers.size,
      lastFireAt: v.last,
    }))
    .sort((a, b) => b.rowCount - a.rowCount);
}

const ANALYSE_ID_BATCH = 120;

async function fetchAnalyseLabelsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Record<string, AnalyseRunLabels>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out: Record<string, AnalyseRunLabels> = {};

  for (let i = 0; i < unique.length; i += ANALYSE_ID_BATCH) {
    const batch = unique.slice(i, i + ANALYSE_ID_BATCH);
    const { data, error } = await supabase
      .from("analyse_runs")
      .select("id, project_name, file_name")
      .in("id", batch);

    if (error) {
      console.warn("[trigger_fires:insights] analyse_runs batch failed:", error.message);
      continue;
    }

    for (const row of data ?? []) {
      const r = row as { id: string; project_name: string | null; file_name: string | null };
      if (r.id) {
        out[r.id] = { project_name: r.project_name ?? null, file_name: r.file_name ?? null };
      }
    }
  }

  return out;
}

export async function loadTriggerFiresInsights(): Promise<TriggerFiresInsightsPayload | TriggerFiresInsightsError> {
  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY fehlt – Auswertung nur mit Service-Role möglich." };
  }

  try {
    const totalFires = await fetchTotalCount(supabase);
    if (totalFires === 0) {
      return {
        ok: true,
        kpis: {
          totalFires: 0,
          analysesWithFires: 0,
          distinctTriggersFired: 0,
          lastFireAt: null,
        },
        topTriggers: [],
        recentFires: [],
        perAnalysis: [],
        analyseLabelsById: {},
        aggregationCapped: false,
      };
    }

    const [recentFires, { rows: aggRows, capped: aggregationCapped }] = await Promise.all([
      fetchRecentFires(supabase, 50),
      fetchSlimNewestForAggregation(supabase, totalFires, MAX_AGGREGATION_ROWS),
    ]);

    const analysisIdsForLabels = new Set<string>();
    for (const r of recentFires) analysisIdsForLabels.add(r.analysis_id);

    const analysisSet = new Set(aggRows.map((r) => r.analysis_id));
    const triggerSet = new Set(aggRows.map((r) => r.trigger_id));
    const lastFireAt = aggRows.length ? aggRows[0]?.created_at ?? null : null;

    const kpis: TriggerFireKpis = {
      totalFires,
      analysesWithFires: aggregationCapped ? null : analysisSet.size,
      distinctTriggersFired: aggregationCapped ? null : triggerSet.size,
      lastFireAt,
    };

    const topTriggers = buildTopTriggers(aggRows);
    const perAnalysis = buildPerAnalysis(aggRows);

    for (const p of perAnalysis) analysisIdsForLabels.add(p.analysis_id);

    const analyseLabelsById = await fetchAnalyseLabelsByIds(supabase, [...analysisIdsForLabels]);

    return {
      ok: true,
      kpis,
      topTriggers,
      recentFires,
      perAnalysis,
      analyseLabelsById,
      aggregationCapped,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
