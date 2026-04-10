/**
 * Admin-only Schreiboperationen auf trigger_fires (Service Role).
 * Keine Änderungen an analyse_runs oder triggers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/billing/stripeProfileSync";
import { isUuidString } from "@/lib/triggerFiresLog";

const PAGE_SIZE = 1000;
/** Sicherheits-Deckel: Scan für distinct analysis_id (globaler Reset-Hinweis). */
const MAX_STATS_SCAN_ROWS = 2_000_000;

export type TriggerFiresGlobalStats = {
  totalRows: number;
  distinctAnalyses: number;
  /** true, wenn nicht alle Zeilen für distinct-Anzahl gelesen wurden */
  statsPartial: boolean;
};

export function getTriggerFiresAdminClient(): SupabaseClient | null {
  return getSupabaseServiceRole();
}

export async function fetchTriggerFiresGlobalStats(supabase: SupabaseClient): Promise<TriggerFiresGlobalStats> {
  const { count: totalRows, error: e0 } = await supabase.from("trigger_fires").select("*", { count: "exact", head: true });
  if (e0) throw new Error(e0.message);
  const total = totalRows ?? 0;
  if (total === 0) {
    return { totalRows: 0, distinctAnalyses: 0, statsPartial: false };
  }

  const analysisIds = new Set<string>();
  let rowsRead = 0;
  let statsPartial = false;

  while (true) {
    const from = rowsRead;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from("trigger_fires").select("analysis_id").range(from, to);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    if (chunk.length === 0) break;
    for (const row of chunk) {
      const id = (row as { analysis_id?: string }).analysis_id;
      if (typeof id === "string" && id) analysisIds.add(id);
    }
    rowsRead += chunk.length;
    if (chunk.length < PAGE_SIZE) break;
    if (rowsRead >= MAX_STATS_SCAN_ROWS) {
      statsPartial = true;
      break;
    }
  }

  if (rowsRead < total) statsPartial = true;

  return {
    totalRows: total,
    distinctAnalyses: analysisIds.size,
    statsPartial,
  };
}

export async function countTriggerFiresByAnalysis(supabase: SupabaseClient, analysisId: string): Promise<number> {
  const { count, error } = await supabase
    .from("trigger_fires")
    .select("*", { count: "exact", head: true })
    .eq("analysis_id", analysisId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function deleteTriggerFiresByAnalysis(
  supabase: SupabaseClient,
  analysisId: string
): Promise<{ deletedCount: number }> {
  if (!isUuidString(analysisId)) {
    throw new Error("Ungültige analysis_id");
  }
  const before = await countTriggerFiresByAnalysis(supabase, analysisId);
  if (before === 0) {
    return { deletedCount: 0 };
  }
  const { error } = await supabase.from("trigger_fires").delete().eq("analysis_id", analysisId);
  if (error) throw new Error(error.message);
  return { deletedCount: before };
}

/**
 * Alle trigger_fires löschen. Filter: analysis_id IS NOT NULL (alle normalen Zeilen).
 */
export async function deleteAllTriggerFires(supabase: SupabaseClient): Promise<{ deletedApprox: number }> {
  const { count: before, error: cErr } = await supabase.from("trigger_fires").select("*", { count: "exact", head: true });
  if (cErr) throw new Error(cErr.message);
  const n = before ?? 0;
  if (n === 0) {
    return { deletedApprox: 0 };
  }
  let { error } = await supabase.from("trigger_fires").delete().not("analysis_id", "is", null);
  if (error) {
    const fallback = await supabase.from("trigger_fires").delete().gte("created_at", "1970-01-01T00:00:00+00:00");
    error = fallback.error;
  }
  if (error) throw new Error(error.message);
  return { deletedApprox: n };
}
