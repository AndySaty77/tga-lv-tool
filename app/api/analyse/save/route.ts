import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import { buildManagementSummary, type ManagementSummaryInput } from "@/lib/managementSummary";
import { getUserPlan } from "@/lib/billing/userPlan";
import { getMonthlyUsageForPlan } from "@/lib/billing/usage";

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

  // Analyse-Limitierung pro Monat (Free vs. Pro) nur für eingeloggte Nutzer
  if (user) {
    try {
      const plan = await getUserPlan();
      const usage = await getMonthlyUsageForPlan(user.id, plan);

      if (usage.hasReachedLimit) {
        return NextResponse.json(
          {
            ok: false,
            code: "LIMIT_REACHED",
            message:
              "Ihr Free-Plan enthält 3 Analysen pro Monat. Bitte upgraden Sie auf Pro, um weitere Analysen durchzuführen.",
          },
          { status: 403 },
        );
      }
    } catch {
      // Bei Fehlern in der Limitprüfung die Analyse nicht blockieren
    }
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

  let managementSummary: string | null = null;
  try {
    if (body.resultJson && typeof body.resultJson === "object") {
      const rj = body.resultJson as any;
      const summaryInput: ManagementSummaryInput = {
        scoreResult: rj.scoreResult,
        keyFacts: rj.keyFacts ?? null,
        changeOrderAnalysis: rj.changeOrderAnalysis ?? null,
        clarificationQuestions: rj.clarificationQuestions ?? null,
      };
      managementSummary = buildManagementSummary(summaryInput);
    }
  } catch {
    // Fehler bei der Summary-Erzeugung dürfen den Save-Flow nicht bremsen
    managementSummary = null;
  }

  // Fallback: vorhandene Summary aus dem Request beibehalten (z. B. Executive Summary der Nachtragsanalyse)
  if (
    !managementSummary &&
    typeof body.managementSummary === "string" &&
    body.managementSummary.trim().length > 0
  ) {
    managementSummary = body.managementSummary.trim();
  }

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

