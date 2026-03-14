/**
 * API: Rückfragen-Generator für Bieterfragen / Klarstellungen.
 * Regelbasiert; nutzt Findings, Vortext-Risiken, KeyFacts.
 * Pro-Feature: Free-User erhalten 403.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { getUserPlan } from "@/lib/billing/userPlan";
import { hasFeature } from "@/lib/billing/plans";
import { generateClarificationQuestions } from "../../../lib/clarificationQuestions";

export async function POST(req: Request) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const plan = await getUserPlan();
  if (!hasFeature(plan, "advancedFeatures")) {
    return NextResponse.json(
      { error: "Rückfragen sind nur im Pro-Plan verfügbar." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const findings = Array.isArray(body.findings) ? body.findings : [];
    const riskClauses = Array.isArray(body.riskClauses) ? body.riskClauses : [];
    const keyFacts = body.keyFacts && typeof body.keyFacts === "object" ? body.keyFacts : {};
    const changePotentialSummary = body.changePotentialSummary && typeof body.changePotentialSummary === "object" ? body.changePotentialSummary : undefined;

    const result = generateClarificationQuestions({
      findings,
      riskClauses,
      keyFacts,
      ...(changePotentialSummary && { changePotentialSummary }),
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
