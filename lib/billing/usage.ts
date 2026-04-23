import { createClient } from "@supabase/supabase-js";
import type { PlanId } from "./plans";

const FREE_DEFAULT_LIMIT = 3;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

function getSupabaseServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

/** Nutzungsinformationen (gesamte Lebenszeit für Free; Pro unbegrenzt). */
export type TotalUsageInfo = {
  used: number;
  limit: number | null;
  remaining: number | null;
  isLimited: boolean;
  hasReachedLimit: boolean;
};

/** Liest aus `profiles`: analysis_used_total, analysis_limit_total, plan. */
export async function getProfileUsageFields(userId: string): Promise<{
  plan: string | null;
  analysis_used_total: number;
  analysis_limit_total: number | null;
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("plan, analysis_used_total, analysis_limit_total")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const used = typeof data.analysis_used_total === "number" && data.analysis_used_total >= 0
    ? data.analysis_used_total
    : 0;
  const limit = typeof data.analysis_limit_total === "number" && data.analysis_limit_total >= 0
    ? data.analysis_limit_total
    : null;
  return {
    plan: data.plan ?? null,
    analysis_used_total: used,
    analysis_limit_total: limit,
  };
}

/**
 * Liefert Nutzungsinformationen für das Analyse-Limit (Lebenszeit).
 * Free: limit aus profiles (oder 3), used = analysis_used_total.
 * Pro/Admin: unbegrenzt (limit/remaining null, hasReachedLimit false).
 */
export async function getTotalUsageForPlan(
  userId: string,
  plan: PlanId,
): Promise<TotalUsageInfo> {
  const normalizedPlan = plan.toLowerCase() as PlanId;
  if (normalizedPlan === "pro") {
    return {
      used: 0,
      limit: null,
      remaining: null,
      isLimited: false,
      hasReachedLimit: false,
    };
  }

  const profile = await getProfileUsageFields(userId);
  const limit = profile?.analysis_limit_total ?? FREE_DEFAULT_LIMIT;
  const used = profile?.analysis_used_total ?? 0;
  const remaining = Math.max(limit - used, 0);
  const hasReachedLimit = used >= limit;

  return {
    used,
    limit,
    remaining,
    isLimited: true,
    hasReachedLimit,
  };
}

/**
 * Zentrale Prüfung: Darf dieser User eine neue Analyse anlegen?
 * Pro/Admin: ja. Free: nur wenn analysis_used_total < analysis_limit_total.
 */
export async function canCreateAnalysis(userId: string, plan: PlanId): Promise<boolean> {
  const usage = await getTotalUsageForPlan(userId, plan);
  return !usage.hasReachedLimit;
}

export type IncrementResult = { ok: true } | { ok: false; error: string };

/**
 * Erhöht den Zähler „insgesamt verbrauchte Analysen“ um 1.
 * Nur nach erfolgreichem Speichern einer Analyse und nur für Free-User aufrufen.
 * Löschen einer Analyse darf diesen Zähler nicht reduzieren.
 *
 * Verwendet direkten UPDATE (kein RPC), damit keine DB-Funktion in Produktion nötig ist.
 */
export async function incrementAnalysisUsedTotal(userId: string): Promise<IncrementResult> {
  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY fehlt" };
  }

  const { error } = await supabase.rpc("increment_analysis_used_total", {
    p_user_id: userId,
  });

  if (error) {
    return { ok: false, error: `RPC increment_analysis_used_total: ${error.message}` };
  }

  return { ok: true };
}
