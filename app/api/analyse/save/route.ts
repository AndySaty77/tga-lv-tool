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

function extractProjectNameFromResultJson(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rj = value as Record<string, unknown>;
  const keyFacts = rj.keyFacts;
  if (!keyFacts || typeof keyFacts !== "object" || Array.isArray(keyFacts)) return null;
  const raw = (keyFacts as Record<string, unknown>).bauvorhaben;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeResultJsonForPersistence(value: unknown): unknown {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return value;
  const obj = value as Record<string, unknown>;
  const { gaebPreview: _dropGaebPreview, split: _dropSplit, ...rest } = obj;
  return rest;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function POST(req: Request) {
  const user = await getUser().catch(() => null);
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt" }, { status: 503 });
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
  const sanitizedResultJson = sanitizeResultJsonForPersistence(body.resultJson);

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

  const nameFromCurrentResult = extractProjectNameFromResultJson(sanitizedResultJson);
  const incomingProjectName = typeof body.projectName === "string" ? body.projectName.trim() : "";
  const incomingFileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const projectNameForInsert =
    incomingProjectName && incomingProjectName !== incomingFileName
      ? incomingProjectName
      : (nameFromCurrentResult ?? incomingProjectName);
  const projectName = resolveAnalysisTitleForInsert(projectNameForInsert, body.fileName);

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
      result_json: sanitizedResultJson,
    })
    .select("id, created_at, project_name, file_name, score, status, management_summary")
    .single();

  if (error) {
    const isRls = error.message?.includes("row-level security");
    const msg = isRls
      ? "Speichern durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
      : "Analyse konnte nicht gespeichert werden.";
    if (!isRls && process.env.NODE_ENV !== "test") {
      console.error("[analyse/save] db_insert_failed", error.message);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  void logTriggerFiresAfterAnalyseSave({
    resultJson: sanitizedResultJson,
    analyseRunId: data.id,
    supabase,
  });

  const analyseGespeichert = true;
  // Temporäres Logging (Debug: warum wird analysis_used_total nicht erhöht?)
  const logCtx = {
    "save-route": true,
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

