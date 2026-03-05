// src/app/api/analyze-vortext/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

// ========= Types (UI-kompatibel) =========
type RiskClause = {
  type: string;
  riskLevel: "low" | "medium" | "high";
  text: string;
  interpretation: string;
};

type KeyFacts = Record<string, string>;

// ========= Limits =========
const HARD_MAX_CHARS = 12000;
const HARD_MAX_VALUE_CHARS = 280;
const MAX_RISK_CLAUSES = 12;

function hardCut(s: string, max = HARD_MAX_CHARS) {
  const t = (s ?? "").toString();
  return t.length > max ? t.slice(0, max) : t;
}

function normVal(v: any) {
  const s = (v ?? "").toString().replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > HARD_MAX_VALUE_CHARS ? s.slice(0, HARD_MAX_VALUE_CHARS) + "…" : s;
}

function mergeKeyFactsPreferRegex(regexFacts: KeyFacts, llmFacts: KeyFacts): KeyFacts {
  const out: KeyFacts = { ...(regexFacts ?? {}) };
  for (const [k, v] of Object.entries(llmFacts ?? {})) {
    const vv = normVal(v);
    if (!vv) continue;
    if (!out[k] || !out[k].trim()) out[k] = vv; // nur Lücken füllen
  }
  for (const k of Object.keys(out)) out[k] = normVal(out[k]);
  for (const [k, v] of Object.entries(out)) if (!v) delete out[k];
  return out;
}

// ========= Regex-KeyFacts (schnell/stabil) =========
function extractKeyFactsRegex(input: string): KeyFacts {
  const text = (input ?? "").toString();
  const lower = text.toLowerCase();

  const pick = (re: RegExp) => {
    const m = re.exec(text);
    return m?.[1] ? m[1].trim() : "";
  };

  const pickAny = (res: RegExp[]) => {
    for (const re of res) {
      const v = pick(re);
      if (v) return v;
    }
    return "";
  };

  const out: KeyFacts = {};

  // --- Termine/Fristen ---
  out.baubeginn = pickAny([
    /Baubeginn\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
    /Ausführungsbeginn\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
    /Beginn\s+der\s+Arbeiten\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
  ]);

  out.fertigstellung = pickAny([
    /Fertigstellung\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
    /Abnahme\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
    /Übergabe\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
  ]);

  out.bauzeit = pickAny([
    /Bauzeit\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
    /Ausführungszeit\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
    /Dauer\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
  ]);

  out.ausfuehrungsfrist = pickAny([
    /Ausführungsfrist\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
    /Terminplan\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
    /Fristenplan\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
  ]);

  out.fristAngebot = pickAny([
    /Angebotsfrist\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
    /Abgabefrist\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
  ]);

  out.bindefrist = pickAny([
    /Bindefrist\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
    /Binde\s*frist\s*[:\-]?\s*([^\n\r;.]{3,80})/i,
  ]);

  // --- Vertrag / Recht ---
  if (/(vob\/b|vob b|vob\/c|vob c)/i.test(text)) out.vob_bgb = "VOB";
  if (/\bBGB\b/i.test(text)) out.vob_bgb = out.vob_bgb ? out.vob_bgb + " + BGB" : "BGB";

  // Rangfolge
  {
    const m = /Rangfolge\s+(der\s+)?Vertragsunterlagen\s*[:\-]?\s*([^\n\r;.]{3,140})/i.exec(text);
    out.rangfolge = m?.[2]?.trim() ?? "";
  }

  out.gewaerhleistung = pickAny([
    /Gewährleistung\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
    /Mängelhaftung\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
    /Verjährung\s+von\s+Mängelansprüchen\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
  ]);

  out.vertragsstrafe = pickAny([
    /Vertragsstrafe\s*[:\-]?\s*([^\n\r;.]{3,140})/i,
    /Pönale\s*[:\-]?\s*([^\n\r;.]{3,140})/i,
  ]);

  // --- Zahlung / Preis ---
  out.zahlungsbedingungen = pickAny([
    /Zahlungsbedingungen\s*[:\-]?\s*([^\n\r;.]{3,180})/i,
    /Zahlung\s*[:\-]?\s*([^\n\r;.]{3,180})/i,
  ]);

  out.abschlagszahlung = pickAny([
    /Abschlagszahlung(?:en)?\s*[:\-]?\s*([^\n\r;.]{3,180})/i,
    /Abschlagsrechn(?:ung|ungen)\s*[:\-]?\s*([^\n\r;.]{3,180})/i,
  ]);

  out.schlussrechnung = pickAny([
    /Schlussrechnung\s*[:\-]?\s*([^\n\r;.]{3,180})/i,
    /Zahlungsziel\s*[:\-]?\s*([^\n\r;.]{3,180})/i,
    /Fälligkeit\s*[:\-]?\s*([^\n\r;.]{3,180})/i,
  ]);

  if (/(preisgleit|stoffpreis|rohstoff|index|gleitklausel)/i.test(lower)) {
    out.preisgleitung = pickAny([
      /Preisgleit(?:klausel|ung)\s*[:\-]?\s*([^\n\r;.]{3,180})/i,
      /(Stoffpreis[^.\n\r]{0,160})/i,
    ]);
    if (!out.preisgleitung) out.preisgleitung = "Hinweis auf Preisgleitung/Stoffpreisregelung erkannt";
  }

  // normalize + remove empties
  for (const k of Object.keys(out)) out[k] = normVal(out[k]);
  for (const [k, v] of Object.entries(out)) if (!v) delete out[k];

  return out;
}

// ========= OpenAI =========
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const JSON_SCHEMA = {
  name: "vortext_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      riskClauses: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string" },
            riskLevel: { type: "string", enum: ["low", "medium", "high"] },
            text: { type: "string" },
            interpretation: { type: "string" },
          },
          required: ["type", "riskLevel", "text", "interpretation"],
        },
      },
      keyFacts: {
        type: "object",
        additionalProperties: { type: "string" },
      },
    },
    required: ["riskClauses", "keyFacts"],
  },
} as const;

// Kein OpenAI-Typ hier. Kein readonly. TS-safe.
function buildPrompt(vortext: string, missingKeys: string[]) {
  return [
    {
      role: "system",
      content:
        "Du extrahierst aus deutschem Ausschreibungs-Vortext (TGA LV) zwei Dinge: (1) riskClauses, (2) keyFacts. " +
        "Wichtig: keyFacts nur für die geforderten missingKeys befüllen. Wenn nicht eindeutig: leer lassen. " +
        "Keine Erfindungen. Kurz, präzise. Werte maximal 1–2 Sätze, keine Romane.",
    },
    {
      role: "user",
      content:
        `VORTEXT:\n${vortext}\n\n` +
        `missingKeys (nur diese befüllen): ${missingKeys.join(", ") || "(keine)"}\n\n` +
        `Regeln:\n` +
        `- keyFacts: nur missingKeys liefern; wenn nicht klar -> "".\n` +
        `- riskClauses: max. ${MAX_RISK_CLAUSES} Treffer; text = Originalsatz/Passage; interpretation = 1 Satz.\n` +
        `- Output muss JSON gemäß Schema sein.`,
    },
  ];
}

function cleanRiskClauses(list: any[]): RiskClause[] {
  return (Array.isArray(list) ? list : [])
    .slice(0, MAX_RISK_CLAUSES)
    .map((r: any) => ({
      type: normVal(r?.type) || "Risiko",
      riskLevel: r?.riskLevel === "high" || r?.riskLevel === "medium" || r?.riskLevel === "low" ? r.riskLevel : "low",
      text: (r?.text ?? "").toString().trim().slice(0, 900),
      interpretation: (r?.interpretation ?? "").toString().trim().slice(0, 500),
    }))
    .filter((r) => r.text.length > 0);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const textRaw = (body?.text ?? "").toString();
    const vortext = hardCut(textRaw).trim();

    if (!vortext) {
      return NextResponse.json({ riskClauses: [], keyFacts: {} }, { status: 200 });
    }

    // 1) Regex zuerst
    const regexFacts = extractKeyFactsRegex(vortext);

    // 2) Missing bestimmen
    const KEYSET = [
      "baubeginn",
      "bauzeit",
      "fertigstellung",
      "ausfuehrungsfrist",
      "fristAngebot",
      "bindefrist",
      "vertragsstrafe",
      "gewaerhleistung",
      "vob_bgb",
      "rangfolge",
      "zahlungsbedingungen",
      "abschlagszahlung",
      "schlussrechnung",
      "preisgleitung",
    ];

    const missing = KEYSET.filter((k) => !(regexFacts[k] && regexFacts[k].trim().length > 0));

    // 3) LLM call
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const resp = await openai.responses.create({
      model,
      // TS: erzwinge mutables Array (keine readonly tuples)
      input: buildPrompt(vortext, missing) as any,
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA as any },
      temperature: 0.2,
      max_output_tokens: 900,
    });

    const raw = (resp as any).output_text || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { riskClauses: [], keyFacts: {} };
    }

    const llmRisk = cleanRiskClauses(parsed?.riskClauses);
    const llmFacts: KeyFacts = parsed?.keyFacts && typeof parsed.keyFacts === "object" ? parsed.keyFacts : {};

    // 4) Merge
    const keyFacts = mergeKeyFactsPreferRegex(regexFacts, llmFacts);

    return NextResponse.json(
      {
        riskClauses: llmRisk,
        keyFacts,
        keyFactsDebug: {
          regexFound: Object.keys(regexFacts),
          llmFilled: Object.keys(llmFacts || {}).filter((k) => !!normVal((llmFacts as any)[k])),
          missingKeysRequested: missing,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Vortext Analyse fehlgeschlagen", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
