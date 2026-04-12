import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import { buildManagementSummary, type ManagementSummaryInput } from "@/lib/managementSummary";
import type { PlanId } from "@/lib/billing/plans";
import { getUserPlan } from "@/lib/billing/userPlan";
import { canCreateAnalysis, incrementAnalysisUsedTotal } from "@/lib/billing/usage";
import { resolveAnalysisTitleForInsert } from "@/lib/analysisDisplayTitle";
import { logTriggerFiresAfterAnalyseSave } from "@/lib/triggerFiresLog";

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

  let plan: PlanId = "free";
  if (user) {
    try {
      plan = await getUserPlan();
      const allowed = await canCreateAnalysis(user.id, plan);
      if (!allowed) {
        return NextResponse.json(
          {
            ok: false,
            code: "LIMIT_REACHED",
            message:
              "Sie haben Ihr Kontingent an kostenlosen Analysen verbraucht. Bitte upgraden Sie auf Pro, um weitere Analysen durchzuführen.",
          },
          { status: 403 },
        );
      }
    } catch {
      // Bei Fehlern in der Limitprüfung die Analyse nicht blockieren
    }
  }

  const projectName = resolveAnalysisTitleForInsert(body.projectName, body.fileName);

  const fileName = typeof body.fileName === "string" && body.fileName.trim().length > 0 ? body.fileName.trim() : null;
  const score = body.score != null && Number.isFinite(Number(body.score)) ? Number(body.score) : null;
  const status = (body.status && String(body.status)) || "completed";

  let managementSummary: string | null = null;

  // 1) Primär: vorhandene Summary aus dem Request (z. B. LLM-Executive-Summary der Nachtragsanalyse)
  if (typeof body.managementSummary === "string" && body.managementSummary.trim().length > 0) {
    managementSummary = body.managementSummary.trim();
  } else {
    // 2) Fallback: generische Template-Summary auf Basis der Kernanalyse
    try {
      if (body.resultJson && typeof body.resultJson === "object") {
        const rj = body.resultJson as any;
        const co = rj.changeOrderAnalysis as { changePotentialSummary?: unknown } | null | undefined;
        const summaryInput: ManagementSummaryInput = {
          scoreResult: rj.scoreResult,
          keyFacts: rj.keyFacts ?? null,
          changeOrderAnalysis: rj.changeOrderAnalysis ?? null,
          clarificationQuestions: rj.clarificationQuestions ?? null,
          changePotentialSummary:
            (rj.changePotentialSummary as ManagementSummaryInput["changePotentialSummary"]) ??
            (co?.changePotentialSummary as ManagementSummaryInput["changePotentialSummary"]) ??
            null,
        };
        managementSummary = buildManagementSummary(summaryInput);
      }
    } catch {
      // Fehler bei der Summary-Erzeugung dürfen den Save-Flow nicht bremsen
      managementSummary = null;
    }
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

  void logTriggerFiresAfterAnalyseSave({
    resultJson: body.resultJson,
    analyseRunId: data.id,
    supabase,
  });

  const analyseGespeichert = true;
  // Temporäres Logging (Debug: warum wird analysis_used_total nicht erhöht?)
  const logCtx = {
    "save-route": true,
    userId: user?.id ?? null,
    plan,
    analyseGespeichert,
  };

  // Zähler nur für Free-User nach erfolgreichem Speichern erhöhen (Löschen gibt Kontingent nicht frei).
  if (user?.id && plan === "free") {
    const incrementResult = await incrementAnalysisUsedTotal(user.id);
    console.error("[analyse/save] Inkrement-Log", {
      ...logCtx,
      incrementGestartet: true,
      incrementOk: incrementResult.ok,
      incrementError: incrementResult.ok ? null : incrementResult.error,
    });
    if (!incrementResult.ok) {
      // Antwort trotzdem 200 – Analyse ist gespeichert; Zähler-Reparatur ggf. manuell
    }
  } else {
    console.error("[analyse/save] Inkrement-Log", {
      ...logCtx,
      incrementGestartet: false,
      reason: !user?.id ? "kein user" : "plan !== free",
    });
  }

  return NextResponse.json({ ok: true, item: data });
}

