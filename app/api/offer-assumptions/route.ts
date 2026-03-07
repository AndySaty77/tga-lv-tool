/**
 * API: Angebots-Annahmen-Generator.
 * Erzeugt Annahmen aus Findings, Rückfragen, Vortext-Risiken, KeyFacts.
 * LLM optional für Textoptimierung und Plausibilität.
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generateOfferAssumptions, type OfferAssumption } from "../../../lib/offerAssumptions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function llmRefineAssumptions(assumptions: OfferAssumption[]): Promise<OfferAssumption[]> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const maxItems = Math.min(assumptions.length, 20);

  const prompt = `Du optimierst Angebotsannahmen aus einem Ausschreibungs-Kontext.

REGELN:
- Jede Annahme soll klar, prägnant und rechtssicher formuliert sein.
- Formulierung: "Wir gehen davon aus, dass..." oder "Es wird angenommen, dass..."
- Keine Spekulationen, nur plausible Annahmen bei Unklarheiten.
- Länge: 1-2 Sätze pro Annahme.
- Gib das JSON-Array unverändert zurück, nur das Feld "assumption" pro Eintrag optimiert.

Annahmen (JSON):
${JSON.stringify(assumptions.slice(0, maxItems).map((a) => ({ id: a.id, assumption: a.assumption })))}

Gib ein JSON-Objekt zurück: { "assumptions": [ { "id": "...", "assumption": "optimierter Text" }, ... ] }`;

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

    const idToText = new Map<string, string>();
    for (const r of refined) {
      if (r?.id && typeof r?.assumption === "string") idToText.set(String(r.id), r.assumption.trim());
    }

    return assumptions.map((a) => ({
      ...a,
      assumption: idToText.get(a.id) || a.assumption,
    }));
  } catch {
    return assumptions;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const findings = Array.isArray(body.findings) ? body.findings : [];
    const riskClauses = Array.isArray(body.riskClauses) ? body.riskClauses : [];
    const keyFacts = body.keyFacts && typeof body.keyFacts === "object" ? body.keyFacts : {};
    const clarificationQuestions = Array.isArray(body.clarificationQuestions) ? body.clarificationQuestions : [];
    const useLlm = body.useLlm !== false && !!process.env.OPENAI_API_KEY;

    const result = generateOfferAssumptions({
      findings,
      riskClauses,
      keyFacts,
      clarificationQuestions,
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
