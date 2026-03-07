/**
 * API: Rückfragen-Generator für Bieterfragen / Klarstellungen.
 * Regelbasiert; nutzt Findings, Vortext-Risiken, KeyFacts.
 */

import { NextResponse } from "next/server";
import { generateClarificationQuestions } from "../../../lib/clarificationQuestions";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const findings = Array.isArray(body.findings) ? body.findings : [];
    const riskClauses = Array.isArray(body.riskClauses) ? body.riskClauses : [];
    const keyFacts = body.keyFacts && typeof body.keyFacts === "object" ? body.keyFacts : {};

    const result = generateClarificationQuestions({
      findings,
      riskClauses,
      keyFacts,
    });

    return NextResponse.json({
      questions: result.questions,
      byGroup: result.byGroup,
      debug: result.debug,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "clarification-questions failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
