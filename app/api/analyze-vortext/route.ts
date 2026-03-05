import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

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

function clampText(s: string, maxChars: number) {
  if (!s) return "";
  return s.length > maxChars ? s.slice(0, maxChars) : s;
}

/**
 * Entfernt HTML/Inline-Markup aus importierten Texten (Word/PDF/GAEB Exporte).
 * Ziel: KeyFacts sollen lesbar sein, ohne <span ...>.
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

  // WICHTIG: erst HTML/Markup entfernen, dann Marker suchen
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
  const trimmed = candidate.trim();

  return clampText(trimmed, HARD_MAX_CHARS);
}

/**
 * Extrahiert "harte Fakten" aus Vortext/Vertragsklauseln (regex-basiert).
 * Ziel: gezielt anzeigen, ohne LLM-Kosten.
 */
function extractKeyFacts(text: string) {
  // nochmal strippen, weil hier auch einzelne Zeilen HTML enthalten können
  const src = stripHtml((text ?? "").toString());
  const t = src.replace(/\r/g, "");

  const pickLine = (pattern: RegExp) => {
    const m = t.match(pattern);
    if (!m) return null;

    const idx = m.index ?? 0;
    const start = t.lastIndexOf("\n", idx);
    const end = t.indexOf("\n", idx);
    const line = t
      .slice(start === -1 ? 0 : start + 1, end === -1 ? t.length : end)
      .trim();

    // final clean + clamp, damit keine Monster-Zeilen im UI landen
    const out = (line || m[0].trim()).trim();
    return clampText(out, 240);
  };

  const keyFacts: Record<string, string | null> = {
    baubeginn: null,
    bauzeit: null,
    fertigstellung: null,
    ausfuehrungsfrist: null,
    fristAngebot: null,
    bindefrist: null,
    vertragsstrafe: null,
    gewaerhleistung: null,
  };

  keyFacts.baubeginn =
    pickLine(/(?:bau|ausführungs)\s*beginn[^:\n]{0,40}[:\-]?\s*[^\n]{0,160}/i) ||
    pickLine(/(?:beginn)\s*(?:der)?\s*(?:arbeiten|ausführung)[^:\n]{0,40}[:\-]?\s*[^\n]{0,160}/i);

  keyFacts.bauzeit =
    pickLine(/(?:bauzeit|ausführungsdauer|ausführungszeit)[^:\n]{0,40}[:\-]?\s*[^\n]{0,160}/i) ||
    pickLine(/(?:dauer)\s*(?:der)?\s*(?:ausführung|arbeiten)[^:\n]{0,40}[:\-]?\s*[^\n]{0,160}/i) ||
    pickLine(/\b\d{1,3}\s*(?:wochen|woche|tage|tag|monate|monat)\b/i);

  keyFacts.fertigstellung =
    pickLine(/(?:fertigstellung|übergabe|abnahme)\s*(?:bis|spätestens|termin)?[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i) ||
    pickLine(/spätestens\s+bis\s+[^\n]{0,180}/i);

  keyFacts.ausfuehrungsfrist =
    pickLine(/(?:ausführungsfrist|fristenplan|terminplan)[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i) ||
    pickLine(/(?:frist)\s*(?:für)?\s*(?:ausführung|arbeiten)[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i);

  keyFacts.fristAngebot =
    pickLine(/(?:angebotsfrist|abgabefrist|abgabe\s*frist)[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i) ||
    pickLine(/(?:angebot)\s*(?:abgabe|einreichung)\s*(?:bis|spätestens)?[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i);

  keyFacts.bindefrist =
    pickLine(/(?:bindefrist|angebot\s*bindefrist|bindend\s*bis)[^:\n]{0,40}[:\-]?\s*[^\n]{0,180}/i);

  keyFacts.vertragsstrafe =
    pickLine(/(?:vertragsstrafe|pönale|konventionalstrafe)[^:\n]{0,40}[:\-]?\s*[^\n]{0,220}/i);

  keyFacts.gewaerhleistung =
    pickLine(/(?:gewährleistung|mängelhaftung|verjährung)\s*(?:frist|dauer)?[^:\n]{0,40}[:\-]?\s*[^\n]{0,220}/i) ||
    pickLine(/\b(?:4|5)\s*(?:jahre|jahr)\b/i);

  // dedupe: gleiche Zeile nicht in 2 Feldern ausgeben
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = (body?.text ?? "").toString().trim();

    if (!text) {
      return NextResponse.json({ riskClauses: [], keyFacts: {}, error: "No text provided" }, { status: 400 });
    }

    // 1) Vortext extrahieren (damit LLM nicht das ganze LV bekommt)
    const vortext = extractVortext(text);

    // 2) KeyFacts aus Vortext ziehen (regex-basiert)
    const keyFacts = extractKeyFacts(vortext);

    // 3) Server-seitige Sicherheitsbremse für LLM
    const MAX_CHARS = 10_000;
    const safeText = clampText(vortext, MAX_CHARS);

    const prompt = `
Du bist TGA-Sachverständiger und Prüfer für Leistungsverzeichnisse.

Aufgabe:
Finde in den Vorbemerkungen/Vortexten Risikoformulierungen, die Kosten-, Haftungs- oder Nachtragsrisiken auf den Auftragnehmer verlagern.

Suche nach:
- pauschalen Nebenleistungen / "mit abgegolten"
- unbegrenztem Leistungsumfang / Funktionsfähigkeit / Vollständigkeit
- unklarer Abgrenzung / "alle erforderlichen Leistungen"
- Koordinations-/GU-Pflichten
- Normenpflicht ohne konkrete Norm oder ohne Vergütung
- Material-/Montagepauschalen
- Dokumentations-/Inbetriebnahme-/Prüfpflichten ohne klare Leistung/Abrechnung

Regeln:
- Wenn du eine plausible Risiko-Klausel siehst, gib sie aus. Lieber 1–5 gute Treffer als 0.
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

    const clauses = Array.isArray((data as any)?.riskClauses) ? (data as any).riskClauses.slice(0, 12) : [];

    return NextResponse.json({
      keyFacts,
      riskClauses: clauses,
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
