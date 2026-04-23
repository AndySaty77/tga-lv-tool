/**
 * API: Rückfragen-Generator für Bieterfragen / Klarstellungen.
 * Regelbasiert; nutzt Findings, Vortext-Risiken, KeyFacts.
 * Pro-Feature: Free-User erhalten 403.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { getUserPlan } from "@/lib/billing/userPlan";
import { hasFeature } from "@/lib/billing/plans";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateClarificationQuestions } from "../../../lib/clarificationQuestions";

const CLARIFICATION_QUESTIONS_RATE_LIMIT_PER_10_MIN = 20;
const CLARIFICATION_QUESTIONS_RATE_WINDOW_MS = 10 * 60 * 1000;

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
  const rl = checkRateLimit(
    `clarification-questions:${user.id}`,
    CLARIFICATION_QUESTIONS_RATE_LIMIT_PER_10_MIN,
    CLARIFICATION_QUESTIONS_RATE_WINDOW_MS
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
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
