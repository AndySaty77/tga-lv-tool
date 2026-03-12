import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";

type Payload = {
  projectName?: string | null;
  fileName?: string | null;
  score?: number | null;
  status?: string | null;
  managementSummary?: string | null;
  resultJson?: unknown;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

export async function POST(req: Request) {
  const user = await getUser().catch(() => null);
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase nicht konfiguriert" }, { status: 503 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body muss ein Objekt sein" }, { status: 400 });
  }

  if (body.resultJson === undefined) {
    return NextResponse.json({ error: "resultJson ist erforderlich" }, { status: 400 });
  }

  const projectName =
    typeof body.projectName === "string" && body.projectName.trim().length > 0
      ? body.projectName.trim()
      : typeof body.fileName === "string" && body.fileName.trim().length > 0
        ? body.fileName.trim()
        : "Unbenannte Analyse";

  const fileName = typeof body.fileName === "string" && body.fileName.trim().length > 0 ? body.fileName.trim() : null;
  const score = body.score != null && Number.isFinite(Number(body.score)) ? Number(body.score) : null;
  const status = (body.status && String(body.status)) || "completed";
  const managementSummary =
    typeof body.managementSummary === "string" && body.managementSummary.trim().length > 0
      ? body.managementSummary
      : null;

  const { data, error } = await supabase
    .from("analyse_runs")
    .insert({
      project_name: projectName,
      file_name: fileName,
      score,
      status,
      management_summary: managementSummary,
      user_id: user?.id ?? null,
      result_json: body.resultJson,
    })
    .select("id, created_at, project_name, file_name, score, status, management_summary")
    .single();

  if (error) {
    const isRls = error.message?.includes("row-level security");
    const msg = isRls
      ? "Speichern durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}

