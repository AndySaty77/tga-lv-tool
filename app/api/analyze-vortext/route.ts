// src/app/api/analyze-vortext/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

// ========= Types =========
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
  return stripHtml(hardCut(raw ?? ""));
}

function normVal(v: any) {
  let s = (v ?? "").toString();

  // falls doch noch HTML-Reste kommen
  if (/<\/?[^>]+>/.test(s)) s = s.replace(/<\/?[^>]+>/g, " ");

  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > HARD_MAX_VALUE_CHARS ? s.slice(0, HARD_MAX_VALUE_CHARS) + "…" : s;
}

function isGarbageValue(v: string) {
  const s = (v ?? "").trim();
  if (!s) return true;
  if (s.length < 3) return true;
  if (/^(\[|z|\[z|\[z\.\b)$/i.test(s)) return true;
  if (/^(\]|\/span>|<\/span>)$/i.test(s)) return true;
  // “Platzhalter” im Text
  if (/\[z\.?b\.?\]/i.test(s)) return true;
  return false;
}

// ========= KeyFacts Regex =========
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

  out.baubeginn = pickAny([
    /Baubeginn\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
    /Ausführungsbeginn\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
  ]);

  out.fertigstellung = pickAny([
    /Fertigstellung\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
    /Abnahme\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
  ]);

  out.bauzeit = pickAny([
    /Bauzeit\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
    /Ausführungszeit\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
    /Dauer\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
  ]);

  out.ausfuehrungsfrist = pickAny([
    /Ausführungsfrist\s*[:\-]?\s*([^\n\r;.]{3,160})/i,
    /Terminplan\s*[:\-]?\s*([^\n\r;.]{3,160})/i,
    /Bauzeitenplan\s*[:\-]?\s*([^\n\r;.]{3,160})/i,
  ]);

  out.fristAngebot = pickAny([
    /Angebotsfrist\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
    /Abgabefrist\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
  ]);

  out.bindefrist = pickAny([
    /Bindefrist\s*[:\-]?\s*([^\n\r;.]{3,120})/i,
  ]);

  // VOB/B, VOB/C, BGB
  const hasVOB = /(vob\/b|vob b|vob\/c|vob c|\bvob\/?b\b|\bvob\/?c\b)/i.test(text);
  const hasBGB = /\bBGB\b/i.test(text);
  if (hasVOB) out.vob_bgb = "VOB";
  if (hasBGB) out.vob_bgb = out.vob_bgb ? out.vob_bgb + " + BGB" : "BGB";

  // Rangfolge
  {
    const m = /Rangfolge\s+(der\s+)?Vertragsunterlagen\s*[:\-]?\s*([^\n\r;.]{3,200})/i.exec(text);
    out.rangfolge = m?.[2]?.trim() ?? "";
  }

  // Gewährleistung – hier bewusst “bis Zeilenende”
  out.gewaerhleistung = pickAny([
    /Gewährleistung\s*(beträgt|:)?\s*([^\n\r]{3,200})/i, // Gruppe 2
  ]);
  if (out.gewaerhleistung) {
    // oben pick() nimmt Gruppe 1 — daher korrigieren:
    const m = /Gewährleistung\s*(beträgt|:)?\s*([^\n\r]{3,200})/i.exec(text);
    out.gewaerhleistung = m?.[2]?.trim() ?? out.gewaerhleistung;
  }

  out.vertragsstrafe = pickAny([
    /Vertragsstrafe\s*[:\-]?\s*([^\n\r]{3,220})/i,
    /Pönale\s*[:\-]?\s*([^\n\r]{3,220})/i,
  ]);

  out.zahlungsbedingungen = pickAny([
    /Zahlungsbedingungen\s*[:\-]?\s*([^\n\r]{3,220})/i,
  ]);

  out.abschlagszahlung = pickAny([
    /Abschlagszahlung(?:en)?\s*[:\-]?\s*([^\n\r]{3,220})/i,
    /Abschlagsrechn(?:ung|ungen)\s*[:\-]?\s*([^\n\r]{3,220})/i,
  ]);

  out.schlussrechnung = pickAny([
    /Schlussrechnung\s*[:\-]?\s*([^\n\r]{3,220})/i,
    /Zahlungsziel\s*[:\-]?\s*([^\n\r]{3,220})/i,
  ]);

  if (/(preisgleit|stoffpreis|rohstoff|index|gleitklausel)/i.test(lower)) {
    out.preisgleitung = pickAny([
      /Preisgleit(?:klausel|ung)\s*[:\-]?\s*([^\n\r]{3,220})/i,
      /(Stoffpreis[^\n\r]{0,200})/i,
    ]);
    if (!out.preisgleitung) out.preisgleitung = "Hinweis auf Preisgleitung/Stoffpreisregelung erkannt";
  }

  // normalize + garbage raus
  for (const k of Object.keys(out)) out[k] = normVal(out[k]);
  for (const [k, v] of Object.entries(out)) if (isGarbageValue(v)) delete out[k];

  return out;
}

// ========= Risk fallback (wenn LLM parse kaputt) =========
function fallbackRiskClausesRegex(v: string): RiskClause[] {
  const t = (v ?? "").toString();

  const rules: Array<{ re: RegExp; type: string; riskLevel: "low" | "medium" | "high"; interp: string }> = [
    {
      re: /Spätere Forderungen[^.\n]*werden nicht anerkannt/i,
      type: "Keine Nachforderungen",
      riskLevel: "high",
      interp: "Nachträge/Mehrkosten werden pauschal abgewehrt → hohes Nachtragsrisiko bzw. Streitpotenzial.",
    },
    {
      re: /Einheitspreise[^.\n]*(beinhalten|umfassen)[^.\n]*(auch wenn|auch dann|selbst wenn)[^.\n]*nicht explizit/i,
      type: "EP umfasst alles (auch nicht genannte Leistungen)",
      riskLevel: "high",
      interp: "Leistungsabgrenzung wird zu deinen Ungunsten ausgelegt → Kalkulations- und Nachtragsrisiko.",
    },
    {
      re: /Nachträge[^.\n]*nur anerkannt[^.\n]*schriftlich/i,
      type: "Nachträge nur schriftlich vor Ausführung",
      riskLevel: "medium",
      interp: "Formale Hürde für Nachträge; ohne saubere Freigabe droht Nichtvergütung.",
    },
    {
      re: /täglich besenrein/i,
      type: "Sauberkeitspflicht / Baustellenlogistik",
      riskLevel: "low",
      interp: "Zusätzlicher Aufwand/Logistik in EP einkalkulieren.",
    },
    {
      re: /Ersatzteilversorgung[^.\n]*10 Jahre/i,
      type: "Materialanforderung / Fabrikatsbindung",
      riskLevel: "medium",
      interp: "Einschränkung bei Fabrikaten → Preis-/Beschaffungsrisiko.",
    },
  ];

  const out: RiskClause[] = [];
  for (const r of rules) {
    const m = r.re.exec(t);
    if (m) {
      out.push({
        type: r.type,
        riskLevel: r.riskLevel,
        text: m[0].trim(),
        interpretation: r.interp,
      });
    }
  }
  return out.slice(0, MAX_RISK_CLAUSES);
}

// ========= JSON extraction (robust) =========
function extractJsonCandidate(raw: string) {
  const s = (raw ?? "").toString().trim();
  if (!s) return "";

  // 1) ```json ... ```
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(s);
  if (fenced?.[1]) return fenced[1].trim();

  // 2) erster { ... } Block mit Brace-Balancing
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

// ========= OpenAI =========
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildPrompt(vortext: string, missingKeys: string[]) {
  return [
    {
      role: "system",
      content:
        "Du analysierst deutschen Ausschreibungs-Vortext (TGA). " +
        "Gib AUSSCHLIESSLICH gültiges JSON zurück. Kein Fließtext, kein Markdown.",
    },
    {
      role: "user",
      content:
        `VORTEXT:\n${vortext}\n\n` +
        `missingKeys (NUR diese KeyFacts füllen): ${missingKeys.join(", ") || "(keine)"}\n\n` +
        `Gib GENAU dieses JSON-Objekt zurück:\n` +
        `{\n` +
        `  "riskClauses": [\n` +
        `    { "type": "…", "riskLevel": "low|medium|high", "text": "Originalpassage", "interpretation": "1 Satz" }\n` +
        `  ],\n` +
        `  "keyFacts": {\n` +
        `    "baubeginn": "", "bauzeit": "", "fertigstellung": "", "ausfuehrungsfrist": "", "fristAngebot": "", "bindefrist": "",\n` +
        `    "vertragsstrafe": "", "gewaerhleistung": "", "vob_bgb": "", "rangfolge": "",\n` +
        `    "zahlungsbedingungen": "", "abschlagszahlung": "", "schlussrechnung": "", "preisgleitung": ""\n` +
        `  }\n` +
        `}\n\n` +
        `Regeln:\n` +
        `- keyFacts: nur missingKeys befüllen, Rest leer.\n` +
        `- Keine Erfindungen. Unklar = "".\n` +
        `- riskClauses: max. ${MAX_RISK_CLAUSES}, text ist wörtlicher Auszug.\n`,
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

// ========= Route =========
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const vortext = sanitizeVortext((body?.text ?? "").toString());

    if (!vortext) {
      return NextResponse.json({ riskClauses: [], keyFacts: {} }, { status: 200 });
    }

    const regexFacts = extractKeyFactsRegex(vortext);

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

    // Wichtig: wenn Regex Müll liefert -> als missing behandeln
    const missing = KEYSET.filter((k) => !regexFacts[k] || isGarbageValue(regexFacts[k]));

    // LLM Call
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: buildPrompt(vortext, missing) as any,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(raw);

    const llmFacts: KeyFacts =
      parsed?.keyFacts && typeof parsed.keyFacts === "object" ? (parsed.keyFacts as KeyFacts) : {};
    const llmRisk: RiskClause[] = parsed ? cleanRiskClauses(parsed.riskClauses) : [];

    const keyFacts = mergeKeyFactsPreferRegex(regexFacts, llmFacts);

    // Fallback: wenn LLM-JSON nicht parsebar oder liefert 0 Risiken, nutze Regex-Risiken
    const riskClauses =
      llmRisk.length > 0 ? llmRisk : fallbackRiskClausesRegex(vortext);

    return NextResponse.json(
      {
        riskClauses,
        keyFacts,
        keyFactsDebug: {
          regexFound: Object.keys(regexFacts),
          missingKeysRequested: missing,
          llmParsed: !!parsed,
          llmRawPreview: raw ? raw.slice(0, 220) : "",
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
