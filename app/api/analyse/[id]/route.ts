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

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("analyse_runs")
    .select("id, created_at, project_name, file_name, score, status, management_summary, result_json, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    const isRls = error.message?.includes("row-level security");
    const msg = isRls
      ? "Lesen durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Analyse nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ item: data });
}

/**
 * Löscht eine Analyse (echte Zeilenlöschung in analyse_runs).
 * Nur der eigene Datensatz (user_id) wird gelöscht. Es gibt keinen separaten
 * File-Storage – alle zugehörigen Daten liegen in dieser Zeile (result_json etc.).
 */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  }

  const { data: deleted, error } = await supabase
    .from("analyse_runs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    const isRls = error.message?.includes("row-level security");
    const msg = isRls
      ? "Löschen durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!deleted?.length) {
    return NextResponse.json({ error: "Analyse nicht gefunden oder kein Zugriff" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

