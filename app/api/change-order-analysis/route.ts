/**
 * API: Nachtragsanalyse (Change Order Opportunities).
 * Hybrid: regelbasiert aus Findings/Vortext/KeyFacts + optional LLM.
 */

import { NextResponse } from "next/server";
import { runChangeOrderAnalysis } from "../../../lib/changeOrderAnalysis";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const findings = Array.isArray(body.findings) ? body.findings : [];
    const riskClauses = Array.isArray(body.riskClauses) ? body.riskClauses : [];
    const keyFacts = body.keyFacts && typeof body.keyFacts === "object" ? body.keyFacts : {};
    const vortext = String(body.vortext ?? "").trim();
    const lvPositions = String(body.lvPositions ?? "").trim();
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
