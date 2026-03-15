import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import { getDefaultPlan, type PlanId } from "./plans";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

/**
 * Lädt den Plan für den aktuell eingeloggten Nutzer.
 *
 * Erwartet eine Supabase-Tabelle `profiles` mit Spalte:
 * - id: uuid (User-ID aus auth.users.id)
 * - plan: text (z. B. 'free' | 'pro')
 *
 * Fällt bei fehlender oder ungültiger Plan-Information auf den Default-Plan zurück.
 */
export async function getUserPlan(): Promise<PlanId> {
  const user = await getUser().catch(() => null);
  if (!user) {
    return getDefaultPlan();
  }

  const supabase = getSupabase();
  if (!supabase) {
    return getDefaultPlan();
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data || !data.plan || typeof data.plan !== "string") {
      return getDefaultPlan();
    }

    const raw = data.plan.toLowerCase();
    if (raw === "pro" || raw === "admin") return "pro";
    return "free";
  } catch {
    return getDefaultPlan();
  }
}

