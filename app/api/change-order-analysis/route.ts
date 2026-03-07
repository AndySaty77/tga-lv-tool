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
    const useLlm = body.useLlm === true && !!process.env.OPENAI_API_KEY;

    const result = await runChangeOrderAnalysis({
      findings,
      riskClauses,
      keyFacts,
      vortext: vortext || undefined,
      lvPositions: lvPositions || undefined,
      useLlm,
    });

    return NextResponse.json({
      opportunities: result.opportunities,
      byCluster: result.byCluster,
      debug: result.debug,
    });
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
