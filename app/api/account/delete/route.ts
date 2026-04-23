import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";

const CONFIRM_WORD = "LÖSCHEN";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function POST(req: NextRequest) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let body: { confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage. Bestätigung erforderlich." },
      { status: 400 }
    );
  }

  const confirm = typeof body?.confirm === "string" ? body.confirm.trim() : "";
  if (confirm !== CONFIRM_WORD) {
    return NextResponse.json(
      { error: "Zum Löschen des Kontos musst du das Bestätigungswort eingeben." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Kontolöschung derzeit nicht möglich. Bitte später erneut versuchen." },
      { status: 503 }
    );
  }

  const userId = user.id;

  // 1. Alle Analyse-IDs des Nutzers ermitteln
  const { data: runRows, error: errRunIds } = await supabase
    .from("analyse_runs")
    .select("id")
    .eq("user_id", userId);

  if (errRunIds) {
    return NextResponse.json(
      { error: "Kontolöschung fehlgeschlagen. Bitte später erneut versuchen oder den Support kontaktieren." },
      { status: 500 }
    );
  }

  const runIds = (runRows ?? [])
    .map((r) => (typeof r.id === "string" ? r.id : ""))
    .filter((id) => id.length > 0);

  // 2. Zugehörige trigger_fires löschen, damit keine Orphans bleiben
  if (runIds.length > 0) {
    const { error: errFires } = await supabase
      .from("trigger_fires")
      .delete()
      .in("analysis_id", runIds);

    if (errFires) {
      return NextResponse.json(
        { error: "Kontolöschung fehlgeschlagen. Bitte später erneut versuchen oder den Support kontaktieren." },
        { status: 500 }
      );
    }
  }

  // 3. Alle analyse_runs des Nutzers löschen
  const { error: errRuns } = await supabase
    .from("analyse_runs")
    .delete()
    .eq("user_id", userId);

  if (errRuns) {
    return NextResponse.json(
      { error: "Kontolöschung fehlgeschlagen. Bitte später erneut versuchen oder den Support kontaktieren." },
      { status: 500 }
    );
  }

  // 4. Profil des Nutzers löschen
  const { error: errProfile } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (errProfile) {
    return NextResponse.json(
      { error: "Kontolöschung fehlgeschlagen. Bitte später erneut versuchen oder den Support kontaktieren." },
      { status: 500 }
    );
  }

  // 5. Auth-User löschen (nur mit Service-Role möglich)
  const { error: errAuth } = await supabase.auth.admin.deleteUser(userId);

  if (errAuth) {
    return NextResponse.json(
      { error: "Kontolöschung fehlgeschlagen. Bitte später erneut versuchen oder den Support kontaktieren." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
