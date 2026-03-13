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

  const meta: any = (user as any).user_metadata || {};

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: existing, error: selectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (selectError) {
      // eslint-disable-next-line no-console
      console.error("[ensureUserProfile] Fehler beim Laden des Profils", selectError);
      return;
    }
    if (existing) {
      // Optional: Profildaten aktualisieren, Plan nicht anfassen
      const updatePayload: Record<string, any> = {
        email: user.email,
      };
      if (typeof meta.first_name === "string" && meta.first_name.trim()) {
        updatePayload.first_name = meta.first_name.trim();
      }
      if (typeof meta.last_name === "string" && meta.last_name.trim()) {
        updatePayload.last_name = meta.last_name.trim();
      }
      if (typeof meta.company === "string" && meta.company.trim()) {
        updatePayload.company = meta.company.trim();
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", user.id);
      if (updateError) {
        // eslint-disable-next-line no-console
        console.error("[ensureUserProfile] Fehler beim Aktualisieren des Profils", updateError, {
          payload: updatePayload,
        });
      }
      return;
    }

    const insertPayload: Record<string, any> = {
      id: user.id,
      email: user.email,
      plan: getDefaultPlan(),
    };
    if (typeof meta.first_name === "string" && meta.first_name.trim()) {
      insertPayload.first_name = meta.first_name.trim();
    }
    if (typeof meta.last_name === "string" && meta.last_name.trim()) {
      insertPayload.last_name = meta.last_name.trim();
    }
    if (typeof meta.company === "string" && meta.company.trim()) {
      insertPayload.company = meta.company.trim();
    }

    const { error: insertError } = await supabase.from("profiles").insert(insertPayload);
    if (insertError) {
      // eslint-disable-next-line no-console
      console.error("[ensureUserProfile] Fehler beim Anlegen des Profils", insertError, {
        payload: insertPayload,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ensureUserProfile] Unerwarteter Fehler", err);
  }
}

