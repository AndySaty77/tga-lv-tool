/**
 * V1: LLM-Validierung für regelbasierte Trigger-Findings (nur DB_*).
 * Basiert ausschließlich auf raw_excerpt (Original-LV-Text um den Treffer).
 */

import OpenAI from "openai";

// ----- Input (pro Finding) -----
export type TriggerFindingValidationInput = {
  finding_id: string;
  raw_excerpt: string;
  title: string;
  category: string;
  penalty: number;
  matched_keyword?: string;
  matched_context?: string;
  discipline?: string;
};

// ----- Output (striktes JSON-Schema vom LLM) -----
export type TriggerFindingValidationResult = {
  finding_id: string;
  validation_status: "confirm" | "uncertain" | "reject";
  confidence: number;
  reason: string;
  suggested_category?: string;
  penalty_assessment?: "keep" | "lower";
};

/**
 * Baut das Validierungs-Input pro Finding.
 * Nur aufrufen, wenn finding.raw_excerpt vorhanden ist (kein Fallback auf detail).
 */
export function buildValidationInput(
  finding: { id: string; title: string; category: string; penalty: number; raw_excerpt?: string },
  opts?: { matched_keyword?: string; matched_context?: string; discipline?: string }
): TriggerFindingValidationInput | null {
  const raw_excerpt = typeof finding.raw_excerpt === "string" && finding.raw_excerpt.trim().length > 0
    ? finding.raw_excerpt.trim()
    : null;
  if (!raw_excerpt) return null;

  return {
    finding_id: finding.id,
    raw_excerpt,
    title: finding.title ?? "",
    category: String(finding.category ?? ""),
    penalty: Number(finding.penalty) || 0,
    matched_keyword: opts?.matched_keyword,
    matched_context: opts?.matched_context,
    discipline: opts?.discipline,
  };
}

const SYSTEM_PROMPT = `Du validierst Trigger-Treffer aus einem Leistungsverzeichnis (LV) für TGA-Bauleistungen.

WICHTIG – Beurteile NUR auf Basis des Feldes "raw_excerpt". Das ist der Original-LV-Text rund um den Treffer.
- Keine Spekulation. Kein Rückgriff auf allgemeines Fachwissen ohne Textbeleg im raw_excerpt.
- Wenn der Beleg im raw_excerpt nicht eindeutig ist -> validation_status: "uncertain".
- "reject" nur bei klarer Unplausibilität oder erkennbarem Gegenbeleg im Text (z.B. reiner Stichwort-Treffer ohne Risiko-Kontext, oder explizite Klarstellung).
- "confirm" nur wenn der raw_excerpt das Risiko plausibel stützt.
- Keine neuen Findings erzeugen. Keine freie Neuinterpretation des ganzen LV.
- confidence: 0.0 bis 1.0 (1.0 = sehr sicher).

Antworte ausschließlich mit einem JSON-Objekt in dieser Form (kein anderer Text):
{
  "validations": [
    {
      "finding_id": "<id aus der Eingabe>",
      "validation_status": "confirm" | "uncertain" | "reject",
      "confidence": <Zahl 0-1>,
      "reason": "<kurze Begründung, max. 2-3 Sätze, nur auf raw_excerpt gestützt>",
      "suggested_category": "<optional>",
      "penalty_assessment": "keep" | "lower"
    }
  ]
}`;

/**
 * Ruft das LLM zur Validierung der übergebenen DB-Findings auf.
 * Ein Batch-Call; bei Fehler/Timeout leeres Array.
 */
export async function validateTriggerFindingsWithLlm(
  inputs: TriggerFindingValidationInput[],
  options?: { openaiApiKey?: string; model?: string }
): Promise<TriggerFindingValidationResult[]> {
  const apiKey = options?.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey || inputs.length === 0) {
    return [];
  }

  const model = options?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });

  const userPayload = JSON.stringify(
    inputs.map((i) => ({
      finding_id: i.finding_id,
      raw_excerpt: i.raw_excerpt,
      title: i.title,
      category: i.category,
      penalty: i.penalty,
      ...(i.matched_keyword != null && { matched_keyword: i.matched_keyword }),
      ...(i.matched_context != null && { matched_context: i.matched_context }),
      ...(i.discipline != null && { discipline: i.discipline }),
    })),
    null,
    2
  );

  const userContent = `Validiere folgende Trigger-Treffer. Beurteile NUR anhand von "raw_excerpt" (Original-LV-Text):\n\n${userPayload}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```json?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const arr = Array.isArray(parsed?.validations) ? parsed.validations : [];

    const results: TriggerFindingValidationResult[] = [];
    const validStatuses = new Set(["confirm", "uncertain", "reject"]);

    for (const v of arr) {
      const r = v as Record<string, unknown>;
      const finding_id = String(r?.finding_id ?? "").trim();
      if (!finding_id) continue;

      const validation_status = validStatuses.has(String(r?.validation_status ?? ""))
        ? (r.validation_status as TriggerFindingValidationResult["validation_status"])
        : "uncertain";
      const confidence = Math.max(0, Math.min(1, Number(r?.confidence) ?? 0.5));
      const reason = String(r?.reason ?? "").trim() || "Keine Begründung";

      results.push({
        finding_id,
        validation_status,
        confidence,
        reason,
        suggested_category:
          typeof r?.suggested_category === "string" && r.suggested_category.trim()
            ? r.suggested_category.trim()
            : undefined,
        penalty_assessment:
          r?.penalty_assessment === "lower" || r?.penalty_assessment === "keep"
            ? r.penalty_assessment
            : undefined,
      });
    }

    return results;
  } catch {
    return [];
  }
}
