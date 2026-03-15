import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
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
    return NextResponse.json({ error: "Supabase nicht konfiguriert" }, { status: 503 });
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

  const { data: deleted, error } = await supabase
    .from("analyse_runs")
    .delete()
    .eq("user_id", user.id)
    .in("id", ids)
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
