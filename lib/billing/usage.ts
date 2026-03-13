import { createClient } from "@supabase/supabase-js";
import type { PlanId } from "./plans";
import { getPlanLimits } from "./plans";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Zählt, wie viele Analysen ein Nutzer im aktuellen Kalendermonat bereits durchgeführt hat.
 */
export async function getMonthlyAnalysisCount(userId: string, now: Date = new Date()): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const from = startOfMonth(now).toISOString();

  try {
    const { count, error } = await supabase
      .from("analyse_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", from);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export type MonthlyUsageInfo = {
  usedThisMonth: number;
  limit: number | null; // null = unbegrenzt
  remaining: number | null; // null = unbegrenzt
  isLimited: boolean;
  hasReachedLimit: boolean;
};

/**
 * Liefert Nutzungsinformationen für den aktuellen Monat, abhängig vom Plan.
 */
export async function getMonthlyUsageForPlan(
  userId: string,
  plan: PlanId,
  now: Date = new Date(),
): Promise<MonthlyUsageInfo> {
  const usedThisMonth = await getMonthlyAnalysisCount(userId, now);
  const limits = getPlanLimits(plan);

  if (limits.analysesPerMonth == null) {
    return {
      usedThisMonth,
      limit: null,
      remaining: null,
      isLimited: false,
      hasReachedLimit: false,
    };
  }

  const limit = limits.analysesPerMonth;
  const remaining = Math.max(limit - usedThisMonth, 0);
  const hasReachedLimit = usedThisMonth >= limit;

  return {
    usedThisMonth,
    limit,
    remaining,
    isLimited: true,
    hasReachedLimit,
  };
}


