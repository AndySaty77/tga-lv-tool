import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeLvText, DbTrigger } from "../../../lib/analyzeLvText";
import { computeScore } from "../../../lib/scoring";

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/score" });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lvText = String((body as any)?.lvText ?? "");

  const supabase = supabaseServer();

  // Trigger laden
  const { data, error } = await supabase
    .from("triggers")
    .select(`
      id,
      name,
      description,
      category,
      trigger_type,
      keywords,
      regex,
      norms,
      weight,
      claim_level,
      risk_interpretation,
      question_template,
      offer_text_template,
      is_active
    `);

  if (error) {
    console.error("Supabase Trigger Fehler:", error);
  }

  // Optional: wenn is_active existiert, filtern
  const dbTriggers: DbTrigger[] = (data ?? []).filter((t: any) =>
    typeof t.is_active === "boolean" ? t.is_active : true
  );

  const findings = analyzeLvText(lvText, dbTriggers);
  const result = computeScore({ findings });

  return NextResponse.json(result);
}
