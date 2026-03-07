/**
 * LLM-Analyse des LV-Textes.
 * Das LLM durchsucht den Text auf eigene Recherche – ohne Trigger zu beachten.
 */

import OpenAI from "openai";
import type { Finding, Severity } from "./scoring";

/** Finding mit flexibler category (wird in der Route via mapCategoryTo5 gemappt) */
type FindingLike = Omit<Finding, "category"> & { category: string };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TEXT_CHARS = 12000;

const CATEGORY_HINTS =
  "vertrags_lv_risiken | mengen_massenermittlung | technische_vollstaendigkeit | schnittstellen_nebenleistungen | kalkulationsunsicherheit";

/**
 * LLM analysiert den LV-Text eigenständig und findet Bieter-Risiken.
 * Ignoriert alle Trigger – reine Recherche im Text.
 */
export async function analyzeLvTextWithLLM(lvText: string): Promise<FindingLike[]> {
  if (!process.env.OPENAI_API_KEY || !lvText?.trim()) {
    return [];
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const textSlice = lvText.slice(0, MAX_TEXT_CHARS);

  const prompt = `Du analysierst ein Leistungsverzeichnis (LV) für TGA-Bauleistungen.

LV-TEXT (Auszug):
${textSlice}

AUFGABE: Durchsuche den Text auf eigene Recherche und finde ECHTE Bieter-Risiken:
- Unklare oder fehlende Angaben
- Nachtragspotenzial (z.B. "bauseits", "optional", "nach Aufwand")
- Unvollständige technische Spezifikationen
- Abgrenzungsprobleme zwischen Gewerken
- Mengen-/Massenermittlungsunsicherheiten

Beachte KEINE vordefinierten Trigger oder Keywords – analysiere den Text selbstständig.

Antworte mit JSON:
{
  "findings": [
    {
      "title": "Kurzer Titel des Risikos",
      "detail": "Konkrete Stelle oder Begründung",
      "category": "${CATEGORY_HINTS}",
      "severity": "low" | "medium" | "high",
      "penalty": 1-15
    }
  ]
}

Maximal 15 Findings. Nur echte Risiken, keine technischen Standardbegriffe.`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: "Du gibst ausschließlich gültiges JSON zurück. Kein anderer Text.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```json?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const arr = Array.isArray(parsed?.findings) ? parsed.findings : [];
    const findings: FindingLike[] = [];

    for (let i = 0; i < arr.length; i++) {
      const f = arr[i] as Record<string, unknown>;
      const title = String(f?.title ?? "").trim();
      if (!title) continue;

      const severity = ["low", "medium", "high"].includes(String(f?.severity ?? ""))
        ? (f.severity as Severity)
        : "medium";
      const penalty = Math.min(15, Math.max(1, Number(f?.penalty) || 5));
      const category = String(f?.category ?? "vertrags_lv_risiken").trim();

      findings.push({
        id: `LLM_${i + 1}`,
        category: category || "vertrags_lv_risiken",
        title,
        detail: String(f?.detail ?? "").trim() || undefined,
        severity,
        penalty,
      });
    }

    return findings;
  } catch {
    return [];
  }
}
