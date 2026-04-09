/**
 * API: Nachtragsanalyse (Change Order Opportunities).
 * Hybrid: regelbasiert aus Findings/Vortext/KeyFacts + optional LLM.
 * Pro-Feature: Free-User erhalten 403.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { getUserPlan } from "@/lib/billing/userPlan";
import { hasFeature } from "@/lib/billing/plans";
import { stripEmbeddedBinaryAndBase64Artifacts } from "@/lib/sanitizeAnalysisText";
import { runChangeOrderAnalysis } from "../../../lib/changeOrderAnalysis";

export async function POST(req: Request) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const plan = await getUserPlan();
  if (!hasFeature(plan, "advancedChangeOrderAnalysis")) {
    return NextResponse.json(
      { error: "Nachtragsanalyse ist nur im Pro-Plan verfügbar." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const findings = Array.isArray(body.findings) ? body.findings : [];
    const riskClauses = Array.isArray(body.riskClauses) ? body.riskClauses : [];
    const keyFacts = body.keyFacts && typeof body.keyFacts === "object" ? body.keyFacts : {};
    const vortext = stripEmbeddedBinaryAndBase64Artifacts(String(body.vortext ?? "")).trim();
    const lvPositions = stripEmbeddedBinaryAndBase64Artifacts(String(body.lvPositions ?? "")).trim();
    const rawUseLlm = body.useLlm === true;
    // Neue, sprechende Steuerung für ChangePotential-LLM; für Alt-Clients fällt auf useLlm zurück.
    const useChangePotentialLlm = body.useChangePotentialLlm === true || (body.useChangePotentialLlm == null && rawUseLlm);

    const result = await runChangeOrderAnalysis({
      findings,
      riskClauses,
      keyFacts,
      vortext: vortext || undefined,
      lvPositions: lvPositions || undefined,
      // Alt-Feld bleibt für Backwards-Compat erhalten; wird intern nur noch als Fallback interpretiert.
      useLlm: rawUseLlm,
      useChangePotentialLlm,
    });

    const payload: Record<string, unknown> = {
      opportunities: result.opportunities,
      byCluster: result.byCluster,
      debug: result.debug,
    };
    if (result.changePotentialSummary != null) {
      payload.changePotentialSummary = result.changePotentialSummary;
    }
    if (result.commercialActionsFromChangePotential != null) {
      payload.commercialActionsFromChangePotential = result.commercialActionsFromChangePotential;
    }
    if (result.offerStrategySummary != null) {
      payload.offerStrategySummary = result.offerStrategySummary;
    }
    if (result.systemLogic != null) {
      payload.systemLogic = result.systemLogic;
    }
    if (result.scoreBreakdown != null) {
      payload.scoreBreakdown = result.scoreBreakdown;
    }
    if (result.scoreVersion != null) {
      payload.scoreVersion = result.scoreVersion;
    }
    if (Array.isArray(result.deterministicImmediateActions) && result.deterministicImmediateActions.length > 0) {
      payload.deterministicImmediateActions = result.deterministicImmediateActions;
    }
    return NextResponse.json(payload);
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "change-order-analysis failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
