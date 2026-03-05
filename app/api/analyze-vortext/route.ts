// app/api/analyze-vortext/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

// ================= Types =================
type RiskLevel = "low" | "medium" | "high";

type RiskClause = {
  type: string;
  riskLevel: RiskLevel;
  text: string; // wörtlicher Auszug
  interpretation: string; // 1–2 Sätze
  confidence: number; // 0..1
};

type KeyFacts = Record<string, string>;
type KeyFactConfidence = Record<string, number>;

type LlmOut = {
  riskClauses: RiskClause[];
  keyFacts: KeyFacts;
  keyFactConfidence: KeyFactConfidence;
};

// ================= Limits =================
const HARD_MAX_CHARS = 18000; // bisschen mehr, damit LLM Kontext hat
const HARD_MAX_VALUE_CHARS = 260;
const MAX_RISK_CLAUSES = 14;

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
] as const;

type KeyFactKey = (typeof KEYSET)[number];

// ================= Helpers =================
function hardCut(s: string, max = HARD_MAX_CHARS) {
  const t = (s ?? "").toString();
  return t.length > max ? t.slice(0, max) : t;
}

function stripHtml(input: string) {
  let s = (input ?? "").toString();

  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<\/?[^>]+>/g, " ");

  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  s = s.replace(/\u00A0/g, " ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\s*\n\s*/g, "\n");

  return s.trim();
}

function sanitizeVortext(raw: string) {
  const s = stripHtml(hardCut(raw ?? ""));
  // super-häufiges GAEB-Müll raus (isolierte "No", "Yes", reine Zahlenzeilen)
  const lines = s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (/^(no|yes)$/i.test(l)) return false;
      if (/^\d+(?:\.\d+)?$/.test(l)) return false;
      if (/^[A-Z]{2,5}\s*\d{0,4}$/.test(l) && l.length <= 8) return false;
      return true;
    });
  return lines.join("\n").trim();
}

function clamp01(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function normVal(v: any) {
  let s = (v ?? "").toString();
  if (/<\/?[^>]+>/.test(s)) s = s.replace(/<\/?[^>]+>/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";

  // harte Kürzung
  if (s.length > HARD_MAX_VALUE_CHARS) s = s.slice(0, HARD_MAX_VALUE_CHARS) + "…";
  return s;
}

function isGarbageValue(v: string) {
  const s = (v ?? "").trim();
  if (!s) return true;

  // zu kurz / nur Satzzeichen / nur Zahlen
  if (s.length < 4) return true;
  if (/^[\W_]+$/.test(s)) return true;
  if (/^\d{1,3}$/.test(s)) return true; // ":30" / "11" etc.
  if (/^[:;,.\-–—]+$/.test(s)) return true;

  // typische Fragment-Reste
  if (/^(en:|und abnahme:|sfrist|, d)$/i.test(s)) return true;
  if (/^\[z/i.test(s)) return true;
  if (/\[z\.?\s*b\.?\]/i.test(s)) return true;

  // muss wenigstens ein Wort mit Buchstaben haben
  if (!/[a-zA-ZÄÖÜäöüß]{3,}/.test(s)) return true;

  return false;
}

function mergeKeyFactsPreferRegex(regexFacts: KeyFacts, llmFacts: KeyFacts, llmConf?: KeyFactConfidence): KeyFacts {
  const out: KeyFacts = { ...(regexFacts ?? {}) };

  for (const [k, v] of Object.entries(llmFacts ?? {})) {
    if (!KEYSET.includes(k as any)) continue;
    const vv = normVal(v);
    const conf = clamp01(llmConf?.[k] ?? 0);

    if (!vv) continue;
    if (conf < 0.55) continue; // knallhart: low confidence -> weg

    if (!out[k] || isGarbageValue(out[k])) out[k] = vv;
  }

  for (const k of Object.keys(out)) out[k] = normVal(out[k]);
  for (const [k, v] of Object.entries(out)) if (isGarbageValue(v)) delete out[k];

  return out;
}

// ================= KeyFacts Regex (nur „sichere“ Treffer) =================
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

  // Termine/Fristen (mit bisschen Schutz gegen Fragment-Auszüge)
  out.baubeginn = pickAny([
    /Baubeginn\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Ausführungsbeginn\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
  ]);

  out.fertigstellung = pickAny([
    /Fertigstellung\s*[:\-]?\s*([^\n\r;.]{6,140})/i,
    /Abnahme\s*[:\-]?\s*([^\n\r;.]{6,140})/i,
    /Übergabe\s*[:\-]?\s*([^\n\r;.]{6,140})/i,
  ]);

  out.bauzeit = pickAny([
    /Bauzeit\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Ausführungszeit\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Dauer\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
  ]);

  out.ausfuehrungsfrist = pickAny([
    /Ausführungsfrist\s*[:\-]?\s*([^\n\r;.]{6,180})/i,
    /Terminplan\s*[:\-]?\s*([^\n\r;.]{6,180})/i,
    /Bauzeitenplan\s*[:\-]?\s*([^\n\r;.]{6,180})/i,
  ]);

  out.fristAngebot = pickAny([
    /Angebots(?:abgabe)?frist\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Abgabefrist\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
  ]);

  out.bindefrist = pickAny([/Bindefrist\s*(?:beträgt|:)?\s*([^\n\r;.]{6,120})/i]);

  // VOB/B / BGB
  const hasVOB = /(vob\/b|vob b|vob\/c|vob c|\bvob\/?b\b|\bvob\/?c\b)/i.test(text);
  const hasBGB = /\bBGB\b/i.test(text);
  if (hasVOB) out.vob_bgb = "VOB";
  if (hasBGB) out.vob_bgb = out.vob_bgb ? out.vob_bgb + " + BGB" : "BGB";

  // Rangfolge (oft als Liste, daher länger erlauben)
  {
    const m =
      /Rangfolge\s+(?:der\s+)?Vertragsunterlagen\s*[:\-]?\s*([\s\S]{10,420}?)(?:\n{2,}|$)/i.exec(text) ||
      /folgenden\s+Vertragsbestandteile\s+.*?Reihenfolge\s+maßgebend:\s*([\s\S]{10,420}?)(?:\n{2,}|$)/i.exec(text);
    out.rangfolge = m?.[1]?.trim() ?? "";
  }

  // Gewährleistung
  {
    const m = /Gewährleistung(?:\s+und\s+Abnahme)?\s*[:\-]?\s*([\s\S]{10,240}?)(?:\n|$)/i.exec(text);
    out.gewaerhleistung = m?.[1]?.trim() ?? "";
  }

  // Vertragsstrafe / Pönale
  out.vertragsstrafe = pickAny([
    /Vertragsstrafe\s*[:\-]?\s*([^\n\r]{10,240})/i,
    /Pönale\s*[:\-]?\s*([^\n\r]{10,240})/i,
  ]);

  // Zahlungsbedingungen
  out.zahlungsbedingungen = pickAny([/Zahlungsbedingungen\s*[:\-]?\s*([^\n\r]{10,240})/i]);

  // Abschlagszahlung
  out.abschlagszahlung = pickAny([
    /Abschlagszahlung(?:en)?\s*[:\-]?\s*([^\n\r]{10,240})/i,
    /Abschlagsrechn(?:ung|ungen)\s*[:\-]?\s*([^\n\r]{10,240})/i,
  ]);

  // Schlussrechnung / Zahlungsziel
  out.schlussrechnung = pickAny([
    /Schlussrechnung\s*[:\-]?\s*([^\n\r]{10,240})/i,
    /Zahlungsziel\s*[:\-]?\s*([^\n\r]{10,240})/i,
    /Schlusszahlung\s*[:\-]?\s*([^\n\r]{10,240})/i,
  ]);

  // Preisgleitung
  if (/(preisgleit|stoffpreis|rohstoff|index|gleitklausel|kostensteiger)/i.test(lower)) {
    out.preisgleitung = pickAny([
      /Preisgleit(?:klausel|ung)\s*[:\-]?\s*([^\n\r]{10,240})/i,
      /(Stoffpreis[^\n\r]{0,220})/i,
      /(Materialpreis[^\n\r]{0,220})/i,
    ]);
    if (!out.preisgleitung) out.preisgleitung = "Hinweis auf Preisgleitung/Stoffpreisregelung erkannt";
  }

  for (const k of Object.keys(out)) out[k] = normVal(out[k]);
  for (const [k, v] of Object.entries(out)) if (isGarbageValue(v)) delete out[k];

  return out;
}

// ================= Risk fallback (wenn LLM leer/kaputt) =================
function fallbackRiskClausesRegex(v: string): RiskClause[] {
  const t = (v ?? "").toString();

  const rules: Array<{ re: RegExp; type: string; riskLevel: RiskLevel; interp: string }> = [
    {
      re: /Festpreise\s+bis\s+Bauende/i,
      type: "Festpreis bis Bauende",
      riskLevel: "high",
      interp: "Preis-/Mengenrisiko liegt bei dir; ohne saubere Nachtragslogik wird’s teuer.",
    },
    {
      re: /Kostensteigerungen\s+f(ü|ue)hren\s+nicht\s+zu\s+einer\s+(Ä|Ae)nderung/i,
      type: "Keine Preisänderung bei Kostensteigerung",
      riskLevel: "high",
      interp: "Preisgleitung ausgeschlossen → Material-/Lohnkostenrisiko voll bei dir.",
    },
    {
      re: /alles\s+inbegriffen[\s\S]{0,200}Nebenleistungen/i,
      type: "Alles inbegriffen / Nebenleistungen pauschal",
      riskLevel: "high",
      interp: "Leistungsabgrenzung wird breit gezogen → Nachtrags-/Kalkulationsrisiko.",
    },
    {
      re: /Vertragsstrafe[\s\S]{0,220}/i,
      type: "Vertragsstrafe",
      riskLevel: "medium",
      interp: "Terminrisiko monetarisiert → Ablauf-/Puffer prüfen.",
    },
    {
      re: /Einbehalt[\s\S]{0,220}10%/i,
      type: "Hoher Einbehalt/Sicherheit",
      riskLevel: "medium",
      interp: "Liquiditätsrisiko durch Sicherheiten/Einbehalte → Finanzierung einkalkulieren.",
    },
    {
      re: /Schuttmulden[\s\S]{0,220}auf\s+Kosten\s+des\s+NU/i,
      type: "Entsorgung/Schutt auf eigene Kosten",
      riskLevel: "low",
      interp: "Zusatzaufwand/Logistik in EP einkalkulieren.",
    },
  ];

  const out: RiskClause[] = [];
  for (const r of rules) {
    const m = r.re.exec(t);
    if (m) {
      out.push({
        type: r.type,
        riskLevel: r.riskLevel,
        text: m[0].trim().slice(0, 900),
        interpretation: r.interp,
        confidence: 0.6,
      });
    }
  }
  return out.slice(0, MAX_RISK_CLAUSES);
}

// ================= Robust JSON parsing (fallback) =================
function extractJsonCandidate(raw: string) {
  const s = (raw ?? "").toString().trim();
  if (!s) return "";

  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(s);
  if (fenced?.[1]) return fenced[1].trim();

  const start = s.indexOf("{");
  if (start === -1) return "";

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    if (c === "}") depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }
  return "";
}

function safeParseJson(raw: string) {
  const cand = extractJsonCandidate(raw);
  if (!cand) return null;
  try {
    return JSON.parse(cand);
  } catch {
    return null;
  }
}

function cleanRiskClauses(list: any[]): RiskClause[] {
  return (Array.isArray(list) ? list : [])
    .slice(0, MAX_RISK_CLAUSES)
    .map((r: any) => ({
      type: normVal(r?.type) || "Risiko",
      riskLevel: r?.riskLevel === "high" || r?.riskLevel === "medium" || r?.riskLevel === "low" ? r.riskLevel : "low",
      text: (r?.text ?? "").toString().trim().slice(0, 900),
      interpretation: (r?.interpretation ?? "").toString().trim().slice(0, 520),
      confidence: clamp01(r?.confidence ?? 0.5),
    }))
    .filter((r) => r.text.length > 0 && r.confidence >= 0.55);
}

function cleanKeyFacts(obj: any): KeyFacts {
  const out: KeyFacts = {};
  for (const k of KEYSET) {
    const v = normVal(obj?.[k] ?? "");
    if (!v) continue;
    if (isGarbageValue(v)) continue;
    out[k] = v;
  }
  return out;
}

function cleanKeyFactConfidence(obj: any): KeyFactConfidence {
  const out: KeyFactConfidence = {};
  for (const k of KEYSET) out[k] = clamp01(obj?.[k] ?? 0);
  return out;
}

// ================= OpenAI client =================
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Wir versuchen zuerst Responses API mit JSON-Schema.
// Falls das in deiner openai-Version nicht klappt oder im Deploy crasht,
// fallen wir automatisch auf chat.completions zurück.
function buildSchema() {
  return {
    name: "vortext_extract",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        riskClauses: {
          type: "array",
          maxItems: MAX_RISK_CLAUSES,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string" },
              riskLevel: { type: "string", enum: ["low", "medium", "high"] },
              text: { type: "string" },
              interpretation: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["type", "riskLevel", "text", "interpretation", "confidence"],
          },
        },
        keyFacts: {
          type: "object",
          additionalProperties: false,
          properties: Object.fromEntries(KEYSET.map((k) => [k, { type: "string" }])),
          required: [...KEYSET],
        },
        keyFactConfidence: {
          type: "object",
          additionalProperties: false,
          properties: Object.fromEntries(KEYSET.map((k) => [k, { type: "number" }])),
          required: [...KEYSET],
        },
      },
      required: ["riskClauses", "keyFacts", "keyFactConfidence"],
    },
  } as const;
}

function buildInstructions(vortext: string) {
  return `
Du analysierst deutschen Ausschreibungs-VORTEXT (TGA/GAEB). Liefere NUR JSON gemäß Schema.

Regeln:
- Nichts erfinden. Unklar = "" und confidence niedrig.
- KeyFacts: nur echte Angaben aus dem Text. Keine Fragmente. Keine einzelnen Zahlen/Zeichen.
- keyFactConfidence: 0..1. Unter 0.55 gilt als unzuverlässig.
- riskClauses:
  - max ${MAX_RISK_CLAUSES}
  - text = WÖRTLICHER Auszug aus dem Vortext (kurz, aber eindeutig)
  - interpretation: 1–2 Sätze, konkret (Auswirkung für NU/Kalkulation/Vertrag)
  - confidence: 0..1
- Fokus auf echte Vortext-Risiken: Festpreis/Preisgleitung, Vertragsstrafe, Sicherheiten/Einbehalt, Abnahmefiktion ausgeschlossen, Nachtragslogik, Haftung/Freistellung, Behinderungsanzeigen, Rangfolge, Prüfpflichten, Fristen, Dokumentationspflichten (DGNB/QNG), etc.

VORTEXT:
${vortext}
`.trim();
}

async function llmExtract(vortext: string): Promise<{ ok: boolean; data?: LlmOut; raw?: string; mode: "responses" | "chat" }> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // 1) Responses API (Schema)
  try {
    const schema = buildSchema();
    const resp: any = await (openai as any).responses.create({
      model,
      input: buildInstructions(vortext),
      temperature: 0.1,
      max_output_tokens: 1200,
      response_format: { type: "json_schema", json_schema: schema },
    });

    const json = resp?.output_parsed ?? resp?.output?.[0]?.content?.[0]?.parsed ?? null;
    if (json && typeof json === "object") {
      const out: LlmOut = {
        riskClauses: cleanRiskClauses(json.riskClauses),
        keyFacts: cleanKeyFacts(json.keyFacts),
        keyFactConfidence: cleanKeyFactConfidence(json.keyFactConfidence),
      };
      return { ok: true, data: out, mode: "responses" };
    }

    // falls SDK kein parsed liefert
    const raw = resp?.output_text ?? "";
    const parsed = safeParseJson(raw);
    if (parsed) {
      const out: LlmOut = {
        riskClauses: cleanRiskClauses(parsed.riskClauses),
        keyFacts: cleanKeyFacts(parsed.keyFacts),
        keyFactConfidence: cleanKeyFactConfidence(parsed.keyFactConfidence),
      };
      return { ok: true, data: out, raw, mode: "responses" };
    }
  } catch (e: any) {
    // ignore -> fallback
  }

  // 2) Chat Completions (Fallback)
  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "Du gibst AUSSCHLIESSLICH gültiges JSON zurück. Kein Markdown. Kein Text außerhalb des JSON.",
        },
        { role: "user", content: buildInstructions(vortext) + "\n\nGib JSON gemäß Schema zurück." },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(raw);
    if (parsed) {
      const out: LlmOut = {
        riskClauses: cleanRiskClauses(parsed.riskClauses),
        keyFacts: cleanKeyFacts(parsed.keyFacts),
        keyFactConfidence: cleanKeyFactConfidence(parsed.keyFactConfidence),
      };
      return { ok: true, data: out, raw, mode: "chat" };
    }

    return { ok: false, raw, mode: "chat" };
  } catch (e: any) {
    return { ok: false, raw: e?.message || String(e), mode: "chat" };
  }
}

// ================= Route =================
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const vortext = sanitizeVortext((body?.text ?? "").toString());

    if (!vortext) {
      return NextResponse.json({ riskClauses: [], keyFacts: {}, keyFactsDebug: { empty: true } }, { status: 200 });
    }

    // 1) Regex-Facts (nur sichere)
    const regexFacts = extractKeyFactsRegex(vortext);

    // 2) LLM Extract (komplett: KeyFacts + Risks + Confidence)
    const llm = await llmExtract(vortext);

    const llmFacts = llm.ok ? llm.data!.keyFacts : {};
    const llmConf = llm.ok ? llm.data!.keyFactConfidence : {};
    const llmRisk = llm.ok ? llm.data!.riskClauses : [];

    // 3) Merge Facts: Regex first, dann LLM nur wenn confidence passt
    const keyFacts = mergeKeyFactsPreferRegex(regexFacts, llmFacts, llmConf);

    // 4) Risks: wenn LLM leer -> Regex-Fallback (damit nie „immer 0“ bleibt)
    const riskClauses = llmRisk.length ? llmRisk : fallbackRiskClausesRegex(vortext);

    return NextResponse.json(
      {
        riskClauses,
        keyFacts,
        keyFactsDebug: {
          mode: llm.mode,
          llmOk: llm.ok,
          regexFound: Object.keys(regexFacts),
          llmRawPreview: llm.raw ? String(llm.raw).slice(0, 260) : "",
          filteredLowConfidence: true,
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
