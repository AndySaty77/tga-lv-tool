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

export async function GET(_req: NextRequest) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet", items: [] }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ items: [] });
  }

  const { data, error } = await supabase
    .from("analyse_runs")
    .select("id, created_at, project_name, file_name, score, status, management_summary")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    const isRls = error.message?.includes("row-level security");
    const msg = isRls
      ? "Lesen durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
      : error.message;
    return NextResponse.json({ error: msg, items: [] }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

