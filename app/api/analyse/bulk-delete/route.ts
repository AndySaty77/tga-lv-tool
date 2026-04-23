import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

/**
 * Löscht mehrere Analysen (nur eigene, user_id). Body: { ids: string[] }.
 * Effizient per delete().in('id', ids).
 */
export async function POST(req: NextRequest) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt" }, { status: 503 });
  }

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const raw = body?.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "ids (Array mit mindestens einer ID) erforderlich" }, { status: 400 });
  }

  const ids = raw
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .slice(0, 200);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Keine gültigen IDs" }, { status: 400 });
  }

  // Nur tatsächlich dem Nutzer gehörende IDs berücksichtigen.
  const { data: ownedRows, error: ownedErr } = await supabase
    .from("analyse_runs")
    .select("id")
    .eq("user_id", user.id)
    .in("id", ids);

  if (ownedErr) {
    const isRls = ownedErr.message?.includes("row-level security");
    const msg = isRls
      ? "Lesen durch RLS blockiert."
      : ownedErr.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const ownedIds = (ownedRows ?? [])
    .map((r) => (typeof r.id === "string" ? r.id : ""))
    .filter((id) => id.length > 0);

  if (ownedIds.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  // Reihenfolge: zuerst trigger_fires der betroffenen Analysen entfernen.
  const { error: firesErr } = await supabase
    .from("trigger_fires")
    .delete()
    .in("analysis_id", ownedIds);

  if (firesErr) {
    return NextResponse.json({ error: firesErr.message }, { status: 500 });
  }

  const { data: deleted, error } = await supabase
    .from("analyse_runs")
    .delete()
    .eq("user_id", user.id)
    .in("id", ownedIds)
    .select("id");

  if (error) {
    const isRls = error.message?.includes("row-level security");
    const msg = isRls
      ? "Löschen durch RLS blockiert."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const deletedCount = deleted?.length ?? 0;
  return NextResponse.json({ ok: true, deleted: deletedCount });
}
