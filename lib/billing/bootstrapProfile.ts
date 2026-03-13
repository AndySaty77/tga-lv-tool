import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import { getDefaultPlan } from "./plans";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

/**
 * Stellt sicher, dass für den aktuell eingeloggten Benutzer ein Eintrag in `profiles` existiert.
 * Wird ausschließlich serverseitig im geschützten App-Bereich aufgerufen.
 */
export async function ensureUserProfile() {
  const user = await getUser().catch(() => null);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: existing, error: selectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (selectError) return;
    if (existing) {
      // Optional: E-Mail aktualisieren, Plan nicht anfassen
      await supabase
        .from("profiles")
        .update({ email: user.email })
        .eq("id", user.id);
      return;
    }

    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      plan: getDefaultPlan(),
    });
  } catch {
    // Profil-Bootstrap darf den App-Bereich nicht blockieren
    return;
  }
}

