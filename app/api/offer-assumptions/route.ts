/**
 * API: Angebots-Annahmen-Generator.
 * Erzeugt Annahmen aus Findings, Rückfragen, Vortext-Risiken, KeyFacts.
 * LLM optional für Textoptimierung und Plausibilität.
 * Pro-Feature: Free-User erhalten 403.
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getUser } from "@/lib/auth/get-user";
import { getUserPlan } from "@/lib/billing/userPlan";
import { hasFeature } from "@/lib/billing/plans";
import { generateOfferAssumptions, type OfferAssumption } from "../../../lib/offerAssumptions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function llmRefineAssumptions(assumptions: OfferAssumption[]): Promise<OfferAssumption[]> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const maxItems = Math.min(assumptions.length, 20);

  const prompt = `Du optimierst Angebotsklarstellungen aus einem Ausschreibungs-Kontext.

REGELN:
- Nüchtern, absichernd, nicht aggressiv; typisch: "Unsere Kalkulation berücksichtigt ... nur insoweit, wie ..." oder ähnlich.
- Keine rohen Trigger-/Regelnamen als Hauptinhalt; keine Debug-Formulierungen.
- Hauptfeld "clarification": 1–2 Sätze; optional "scopeNote": ein kurzer zweiter absichernder Satz (kann leer sein).
- Keine Spekulationen über nicht beschriebene Leistungen.

Einträge (JSON):
${JSON.stringify(
    assumptions.slice(0, maxItems).map((a) => ({
      id: a.id,
      clarification: a.clarification ?? a.assumption,
      scopeNote: a.scopeNote ?? "",
    }))
  )}

Gib ein JSON-Objekt zurück: { "assumptions": [ { "id": "...", "clarification": "...", "scopeNote": "..." }, ... ] }`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content:
            "Du gibst AUSSCHLIESSLICH gültiges JSON zurück. Kein Markdown. Kein Text außerhalb des JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const refined = Array.isArray(parsed?.assumptions) ? parsed.assumptions : Array.isArray(parsed) ? parsed : [];

    const idToClar = new Map<string, string>();
    const idToScope = new Map<string, string>();
    for (const r of refined) {
      if (!r?.id) continue;
      const id = String(r.id);
      if (typeof r?.clarification === "string" && r.clarification.trim()) idToClar.set(id, r.clarification.trim());
      else if (typeof r?.assumption === "string" && r.assumption.trim()) idToClar.set(id, r.assumption.trim());
      if (typeof r?.scopeNote === "string" && r.scopeNote.trim()) idToScope.set(id, r.scopeNote.trim());
    }

    return assumptions.map((a) => {
      const clarification = idToClar.get(a.id) ?? a.clarification ?? a.assumption;
      const scopeNote = idToScope.has(a.id) ? idToScope.get(a.id)! : a.scopeNote;
      return {
        ...a,
        clarification,
        assumption: clarification,
        scopeNote,
      };
    });
  } catch {
    return assumptions;
  }
}

export async function POST(req: Request) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const plan = await getUserPlan();
  if (!hasFeature(plan, "advancedFeatures")) {
    return NextResponse.json(
      { error: "Angebotsklarstellungen sind nur im Pro-Plan verfügbar." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const findings = Array.isArray(body.findings) ? body.findings : [];
    const riskClauses = Array.isArray(body.riskClauses) ? body.riskClauses : [];
    const keyFacts = body.keyFacts && typeof body.keyFacts === "object" ? body.keyFacts : {};
    const clarificationQuestions = Array.isArray(body.clarificationQuestions) ? body.clarificationQuestions : [];
    const changePotentialSummary = body.changePotentialSummary && typeof body.changePotentialSummary === "object" ? body.changePotentialSummary : undefined;
    const useLlm = body.useLlm !== false && !!process.env.OPENAI_API_KEY;

    const result = generateOfferAssumptions({
      findings,
      riskClauses,
      keyFacts,
      clarificationQuestions,
      ...(changePotentialSummary && { changePotentialSummary }),
    });

    let assumptions = result.assumptions;
    if (useLlm && assumptions.length > 0) {
      assumptions = await llmRefineAssumptions(assumptions);
    }

    const byGroup = {
      technisch: result.byGroup.technisch.map((a) => assumptions.find((r) => r.id === a.id) ?? a),
      vertraglich: result.byGroup.vertraglich.map((a) => assumptions.find((r) => r.id === a.id) ?? a),
      terminlich: result.byGroup.terminlich.map((a) => assumptions.find((r) => r.id === a.id) ?? a),
    };

    return NextResponse.json({
      assumptions,
      byGroup,
      debug: result.debug.map((d) => ({
        ...d,
        assumption: assumptions.find((a) => a.id === d.assumptionId)?.assumption ?? d.assumption,
      })),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "offer-assumptions failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
