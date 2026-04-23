import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/auth/is-admin";

const TRIGGER_SELECT =
  "id,name,description,category,trigger_type,keywords,regex,norms,project_types,weight,claim_level,risk_interpretation,user_hint,question_template,offer_text_template,is_active,disciplines,created_at,match_scope,context_required,exclude_keywords,review_status,internal_note,family_cluster,last_reviewed_at,reviewed_by";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

type PostBody =
  | { action: "upsert_many"; data: Record<string, unknown>[] }
  | { action: "save_one"; payload: Record<string, unknown>; existingId?: string | null };

export async function GET() {
  const user = await getUser().catch(() => null);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("triggers")
    .select(TRIGGER_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getUser().catch(() => null);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt" }, { status: 503 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof body.action !== "string") {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  if (body.action === "upsert_many") {
    if (!Array.isArray(body.data)) {
      return NextResponse.json({ error: "data muss ein Array sein" }, { status: 400 });
    }
    const { error } = await supabase.from("triggers").upsert(body.data as any[], { onConflict: "name" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: body.data.length });
  }

  if (body.action === "save_one") {
    if (!body.payload || typeof body.payload !== "object") {
      return NextResponse.json({ error: "payload fehlt" }, { status: 400 });
    }
    const payload = { ...body.payload } as Record<string, unknown>;
    if (payload.last_reviewed_at && !payload.reviewed_by && user.email) {
      payload.reviewed_by = user.email;
    }

    if (typeof body.existingId === "string" && body.existingId.trim()) {
      const { error } = await supabase.from("triggers").update(payload).eq("id", body.existingId.trim());
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, mode: "update" });
    }

    const { error } = await supabase.from("triggers").insert(payload);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mode: "insert" });
  }

  return NextResponse.json({ error: "Unbekannte action" }, { status: 400 });
}
