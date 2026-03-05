import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { analyzeLvText, DbTrigger } from "../../../lib/analyzeLvText";

export const runtime = "nodejs";

/** ---------------- OpenAI (optional) ---------------- */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return { riskClauses: [], raw: s };
  }
}

/** ---------------- Supabase ---------------- */
function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

/** ---------------- Helpers ---------------- */
function clampText(s: string, maxChars: number) {
  if (!s) return "";
  return s.length > maxChars ? s.slice(0, maxChars) : s;
}

/**
 * Entfernt HTML/Inline-Markup aus importierten Texten (Word/PDF/GAEB Exporte).
 */
function stripHtml(s: string) {
  return (s ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Heuristische Vortext-Extraktion:
 * - nimmt typischerweise den Anfang (Vorbemerkungen)
 * - stoppt wenn Positions-/Tabellenstruktur beginnt
 * - hat eine harte Zeichenbegrenzung
 */
function extractVortext(full: string) {
  const raw = (full ?? "").toString();
  if (!raw.trim()) return "";

  const t = stripHtml(raw);

  const HARD_MAX_CHARS = 12_000;
  const lower = t.toLowerCase();

  const markers = [
    "\nposition",
    "\npos.",
    "\npos ",
    "\nkurztext",
    "\nlangtext",
    "\nmenge",
    "\neinheit",
    "\nep",
    "\ngp",
    "\n€/ ",
    "\n€",
    "\n--------",
  ];

  let cutIdx = -1;
  for (const m of markers) {
    const i = lower.indexOf(m);
    if (i !== -1) cutIdx = cutIdx === -1 ? i : Math.min(cutIdx, i);
  }

  const candidate = cutIdx > 300 ? t.slice(0, cutIdx) : t;
  return clampText(candidate.trim(), HARD_MAX_CHARS);
}

function pickLine(t: string, pattern: RegExp, maxLen = 240) {
  const m = t.match(pattern);
  if (!m) return null;

  const idx = m.index ?? 0;
  const start = t.lastIndexOf("\n", idx);
  const end = t.indexOf("\n", idx);
  const line = t
    .slice(start === -1 ? 0 : start + 1, end === -1 ? t.length : end)
    .trim();

  const out = (line || m[0].trim()).trim();
  return clampText(out, maxLen);
}

function pickSectionByHeading(t: string, headingPattern: RegExp, maxChars = 900) {
  const lines = t.split("\n");
  let startIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (headingPattern.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;

  const sectionLines: string[] = [];
  sectionLines.push(lines[startIdx]);

  const nextHeading = /^\s*(\d{1,2}(\.\d{1,2})+|\d{1,2}\.)\s+/;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (nextHeading.test(line) && sectionLines.length > 1) break;

    sectionLines.push(line);
    const joined = sectionLines.join("\n").trim();
    if (joined.length >= maxChars) return clampText(joined, maxChars);
  }

  const out = sectionLines.join("\n").trim();
  return out ? clampText(out, maxChars) : null;
}

/**
 * KeyFacts: klein, objektiv, gut extrahierbar.
 * Ziel: UI Card sauber füllen (inkl. Zahlungsbedingungen/Preisgleitung).
 */
function extractKeyFacts(text: string) {
  const t = stripHtml((text ?? "").toString()).replace(/\r/g, "");

  const keyFacts: Record<string, string | null> = {
    // Termine
    baubeginn: null,
    bauzeit: null,
    fertigstellung_abnahme: null,
    ausfuehrungsfrist_terminplan: null,

    // Angebot/Vertrag
    angebotsfrist: null,
    bindefrist: null,
    vertragsstrafe: null,
    gewaerhleistung: null,

    // Zahlung/Preis
    zahlungsbedingungen: null,
    abschlagszahlung: null,
    schlussrechnung: null,
    zahlungsziel: null,
    preisgleitung_materialpreis: null,

    // Vertragsgrundlagen
    vob_b: null,
    bgb: null,
    rangfolge: null,
  };

  // Abschnitte (besser als 1 Zeile)
  keyFacts.ausfuehrungsfrist_terminplan =
    pickSectionByHeading(t, /^\s*1\.2\.\s+ausführungsfrist\b/i) ||
    pickSectionByHeading(t, /^\s*ausführungsfrist\b/i) ||
    pickSectionByHeading(t, /^\s*termin(ierung|plan)\b/i);

  keyFacts.zahlungsbedingungen =
    pickSectionByHeading(t, /^\s*1\.4\.\s+zahlungsbedingungen\b/i) ||
    pickSectionByHeading(t, /^\s*zahlungsbedingungen\b/i) ||
    pickSectionByHeading(t, /^\s*zahlung\b/i);

  keyFacts.preisgleitung_materialpreis =
    pickSectionByHeading(t, /^\s*1\.3\.\s+gültigkeit\s+des\s+angebots\b/i) ||
    pickSectionByHeading(t, /^\s*gültigkeit\s+des\s+angebots\b/i) ||
    pickLine(t, /(?:rohstoffpreise|materialpreise|preis(?:e)?\s*anpassung|preisvorbehalt|preisgleitung)[^\n]{0,220}/i);

  // Zeilen-Fallbacks
  keyFacts.baubeginn =
    pickLine(t, /(?:bau|ausführungs)\s*beginn[^:\n]{0,40}[:\-]?\s*[^\n]{0,160}/i) ||
    pickLine(t, /(?:beginn)\s*(?:der)?\s*(?:arbeiten|ausführung)[^:\n]{0,40}[:\-]?\s*[^\n]{0,160}/i);

  keyFacts.bauzeit =
    pickLine(t, /(?:bauzeit|ausführungsdauer|ausführungszeit)[^:\n]{0,40}[:\-]?\s*[^\n]{0,160}/i) ||
    pickLine(t, /\b\d{1,3}\s*(?:wochen|woche|tage|tag|monate|monat)\b/i);

  keyFacts.fertigstellung_abnahme =
    pickLine(t, /(?:fertigstellung|übergabe|abnahme)\s*(?:bis|spätestens|termin)?[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i) ||
    pickLine(t, /spätestens\s+bis\s+[^\n]{0,180}/i);

  keyFacts.angebotsfrist =
    pickLine(t, /(?:angebotsfrist|abgabefrist|abgabe\s*frist)[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i) ||
    pickLine(t, /(?:angebot)\s*(?:abgabe|einreichung)\s*(?:bis|spätestens)?[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i);

  keyFacts.bindefrist =
    pickLine(t, /(?:bindefrist|angebot\s*bindefrist|bindend\s*bis)[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i);

  keyFacts.vertragsstrafe =
    pickLine(t, /(?:vertragsstrafe|pönale|konventionalstrafe)[^:\n]{0,40}[:\-]?\s*[^\n]{0,220}/i);

  keyFacts.gewaerhleistung =
    pickLine(t, /(?:gewährleistung|mängelhaftung|verjährung)\s*(?:frist|dauer)?[^:\n]{0,40}[:\-]?\s*[^\n]{0,220}/i) ||
    pickLine(t, /\b(?:4|5)\s*(?:jahre|jahr)\b/i);

  // Zahlung-Fallbacks (auch wenn Abschnitt fehlt)
  keyFacts.abschlagszahlung =
    pickLine(t, /(?:abschlagszahlung|abschlag|anzahlung)[^\n]{0,220}/i) ||
    pickLine(t, /\b\d{1,3}\s*%\b[^\n]{0,200}(?:abschlag|anzahlung|materialanlieferung|lieferung)/i);

  keyFacts.schlussrechnung =
    pickLine(t, /(?:schlussrechnung|endabrechnung)[^\n]{0,220}/i) ||
    pickLine(t, /(?:rechnung)\s*(?:erfolgt|erfolgen|stellt)\s*(?:nach|bei)\s*(?:abnahme|übergabe)[^\n]{0,180}/i);

  keyFacts.zahlungsziel =
    pickLine(t, /(?:zahlbar|zahlung)\s*(?:innerhalb|binnen)\s*\d{1,3}\s*(?:tagen|tage)\b[^\n]{0,120}/i) ||
    pickLine(t, /\b\d{1,3}\s*(?:tage|tagen)\s*rein\s*netto\b[^\n]{0,120}/i) ||
    pickLine(t, /\bskonto\b[^\n]{0,160}/i);

  // Vertragsgrundlagen
  keyFacts.vob_b = pickLine(t, /\bvob\/b\b[^\n]{0,180}/i);
  keyFacts.bgb = pickLine(t, /\bbgb\b[^\n]{0,180}/i);
  keyFacts.rangfolge = pickLine(t, /rangfolge\s+der\s+vertragsunterlagen[^\n]{0,220}/i);

  // Clean + dedupe
  const seen = new Set<string>();
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(keyFacts)) {
    const vv = (v ?? "").trim();
    if (!vv) continue;
    const norm = vv.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    cleaned[k] = vv;
  }

  return cleaned;
}

/** ---------------- Trigger Filter (Vortext) ----------------
 * Minimalistisch & stabil:
 * - nutzt die DB-Trigger-Tabelle
 * - nimmt NUR aktive Trigger
 * - nimmt NUR Trigger, deren category "vortext" enthält
 *
 * => Du pflegst in Supabase für Vortext-Trigger category="vortext"
 */
function isVortextTrigger(t: any) {
  const c = String(t?.category ?? "").toLowerCase().trim();
  return c.includes("vortext");
}

/** ---------------- Route ---------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = String((body as any)?.text ?? "").trim();

    // optional: LLM abschaltbar (für Kosten/Quota)
    const useLLM = (body as any)?.useLLM === false ? false : true;

    if (!text) {
      return NextResponse.json({ keyFacts: {}, vortextSignals: [], riskClauses: [], error: "No text provided" }, { status: 400 });
    }

    // 1) Vortext extrahieren
    const vortext = extractVortext(text);

    // 2) KeyFacts aus Vortext
    const keyFacts = extractKeyFacts(vortext);

    // 3) Vortext-Trigger (Supabase) + analyzeLvText nur auf Vortext
    const supabase = supabaseServer();
    const { data, error } = await supabase.from("triggers").select(`
      id,
      name,
      description,
      category,
      trigger_type,
      keywords,
      regex,
      norms,
      weight,
      claim_level,
      risk_interpretation,
      question_template,
      offer_text_template,
      is_active,
      disciplines
    `);

    if (error) {
      console.error("Supabase Trigger Fehler (analyze-vortext):", error);
    }

    const vortextDbTriggers: DbTrigger[] = (data ?? [])
      .filter((t: any) => (typeof t.is_active === "boolean" ? t.is_active : true))
      .filter((t: any) => isVortextTrigger(t));

    const vortextFindings = analyzeLvText(vortext, vortextDbTriggers);

    // schlanke Signals fürs UI
    const vortextSignals = (vortextFindings ?? []).map((f: any) => ({
      id: f.id,
      category: f.category,
      title: f.title,
      detail: f.detail,
      severity: f.severity,
      penalty: f.penalty,
    }));

    // 4) LLM-Risiken (optional, mit harter Bremse)
    let riskClauses: any[] = [];
    let llmSkipped: string | null = null;

    if (!useLLM) {
      llmSkipped = "useLLM=false";
    } else if (!process.env.OPENAI_API_KEY) {
      llmSkipped = "no OPENAI_API_KEY";
    } else {
      const safeText = clampText(vortext, 10_000);

      const prompt = `
Du bist TGA-Sachverständiger und Prüfer für Leistungsverzeichnisse.

Aufgabe:
Finde in den Vorbemerkungen/Vortexten Risikoformulierungen, die Kosten-, Haftungs- oder Nachtragsrisiken auf den Auftragnehmer verlagern.

Suche nach:
- pauschalen Nebenleistungen / "mit abgegolten" / "ohne gesonderte Vergütung"
- unbegrenztem Leistungsumfang / Funktionsfähigkeit / Vollständigkeit
- unklarer Abgrenzung / "alle erforderlichen Leistungen" / "auch wenn nicht ausdrücklich beschrieben"
- Koordinations-/Schnittstellen-/Fremdgewerke-Verantwortung
- Normenpflicht ohne konkrete Norm oder ohne Vergütung
- Material-/Montagepauschalen
- Dokumentations-/Inbetriebnahme-/Prüfpflichten ohne klare Abrechnung

Regeln:
- Lieber 1–8 gute Treffer als 0.
- "text" muss ein exakter Auszug aus dem Input sein (max. 300 Zeichen).
- Maximal 12 riskClauses.

Antworte NUR als JSON:
{
  "riskClauses":[
    {
      "type":"Pauschalrisiko | Leistungsumfang | Normenrisiko | Koordination | Materialrisiko | Doku/IBN/Prüfung | Sonstiges",
      "riskLevel":"low | medium | high",
      "text":"...",
      "interpretation":"kurz und fachlich, warum das riskant ist"
    }
  ]
}

TEXT:
${safeText}
`.trim();

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          temperature: 0.2,
          max_tokens: 700,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Du bist Experte für TGA Leistungsverzeichnisse." },
            { role: "user", content: prompt },
          ],
        });

        const content = completion.choices?.[0]?.message?.content ?? "{}";
        const data = safeJsonParse(content);

        riskClauses = Array.isArray((data as any)?.riskClauses) ? (data as any).riskClauses.slice(0, 12) : [];
      } catch (err: any) {
        // Nicht das ganze Feature killen, nur LLM skippen
        llmSkipped = err?.message ?? "LLM failed";
        riskClauses = [];
      }
    }

    return NextResponse.json({
      keyFacts,
      vortextSignals,
      riskClauses,
      ...(llmSkipped ? { llmSkipped } : {}),
    });
  } catch (err: any) {
    console.error("analyze-vortext error:", err);

    return NextResponse.json(
      {
        error: "Vortext Analyse fehlgeschlagen",
        message: err?.message ?? String(err),
        type: err?.type,
        code: err?.code,
        status: err?.status,
      },
      { status: 500 }
    );
  }
}
