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
  // Projekt & Beteiligte
  "bauvorhaben",
  "ort",
  "gewerk",
  "bauherr_ag",
  "planer",
  // Termine/Fristen
  "baubeginn",
  "bauzeit",
  "fertigstellung",
  "ausfuehrungsfrist",
  "ausfuehrungszeit",
  "fristAngebot",
  "bindefrist",
  "submission_einreichung",
  // Vertrag
  "vertragsgrundlagen",
  "vertragsstrafe",
  "gewaerhleistung",
  "wartung_instandhaltung",
  "vob_bgb",
  "rangfolge",
  // Zahlung/Preis
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

  // Leading punctuation (z. B. ":6 Wochen" -> "6 Wochen", ", MÄNGELANSPRÜCHE" -> "MÄNGELANSPRÜCHE")
  s = s.replace(/^[\s.,;:\-–—]+/, "");
  // Trailing Füllwörter und Satzzeichen
  s = s.replace(/\s*(,?\s*(und|bzw\.?|sowie|oder)\s*$)/i, "");
  s = s.replace(/\s*[,;.:\-–—]+\s*$/, "").trim();

  // harte Kürzung
  if (s.length > HARD_MAX_VALUE_CHARS) s = s.slice(0, HARD_MAX_VALUE_CHARS) + "…";
  return s;
}

/** Kurze Werte, die trotzdem gültig sind (z. B. VOB, BGB) */
const VALID_SHORT_VALUES = new Set(["vob", "bgb", "vob/b", "vob b", "vob/c", "vob c"]);

function isGarbageValue(v: string) {
  const s = (v ?? "").trim();
  if (!s) return true;

  // kurze bekannte Codes erlauben
  if (s.length <= 8 && VALID_SHORT_VALUES.has(s.toLowerCase().replace(/\s+/g, " "))) return false;

  // zu kurz (außer oben)
  if (s.length < 4) return true;
  if (/^[\W_]+$/.test(s)) return true;
  if (/^\d{1,3}$/.test(s)) return true; // ":30" / "11" etc.
  if (/^[:;,.\-–—]+$/.test(s)) return true;

  // typische Fragment-Reste
  if (/^(en:|und abnahme:|sfrist|, d|lich|örtlich|n zu erbringen|entnommen werden)$/i.test(s)) return true;
  if (/^\[z/i.test(s)) return true;
  if (/\[z\.?\s*b\.?\]/i.test(s)) return true;

  // Prozeduraler Text statt Name/Fakt (z. B. QNG-Anforderung in Bauherr-Feld)
  if (/zur\s+Einhaltung\s+der\s+QNG|gemäß\s+beiliegendem\s+QNG-Anforderungskatalog/i.test(s)) return true;

  // Prozedurale Phrasen statt KeyFact-Wert
  if (/^(entnommen werden|zu erbringen|zur Objektdokumentation abzugeben|erforderlich)$/i.test(s)) return true;
  if (/^enplan,?\s+der\s+die\s+zeitliche\s+Abfolge/i.test(s)) return true; // Bauzeitenplan-Fragment
  if (/^zur\s+Objektdokumentation\s+abzugeben/i.test(s)) return true;
  if (/Abstimmung im Einzelfall mit dem Auftraggeber erforderlich/i.test(s)) return true;
  if (/dies gilt evtl\.?/i.test(s)) return true;
  if (/Teile in Betrieb zu nehmen/i.test(s) && /Teilabnahmen abgenommen/i.test(s)) return true;
  if (/an den AN zu übertragen/i.test(s) && /evtl/i.test(s)) return true;

  // Abschnittsnummern im Wert (0.2.13, 0.2.14) = zu viel Kontext erfasst
  if (/\b0\.\d+\.\d{2}\s+/.test(s) && s.length > 80) return true;

  // offensichtlich abgeschnittene Phrasen (enden mit Artikel/Präposition ohne Fortsetzung)
  if (/\s(den|der|die|dem|das|sonstige|im)\s*$/i.test(s) && s.length < 80) return true;
  if (/\s(oder|und)\s*$/i.test(s) && s.length < 50) return true;
  // einzelne Verben ohne Kontext (z. B. "einzubehalten" aus Schlussrechnung)
  if (/^[a-zA-ZÄÖÜäöüß]+$/.test(s) && s.length >= 10 && /(halten|behalten|einhalten)$/i.test(s)) return true;

  // muss wenigstens ein Wort mit Buchstaben haben
  if (!/[a-zA-ZÄÖÜäöüß]{3,}/.test(s)) return true;

  return false;
}

/** Felder, bei denen LLM bevorzugt wird (Regex liefert oft falsche Zuordnung) */
const LLM_PREFERRED_FIELDS = new Set([
  "bauvorhaben",
  "gewerk",
  "vertragsgrundlagen",
  "ort",
  "planer",
  "bauherr_ag",
]);

function mergeKeyFactsPreferRegex(regexFacts: KeyFacts, llmFacts: KeyFacts, llmConf?: KeyFactConfidence): KeyFacts {
  const out: KeyFacts = { ...(regexFacts ?? {}) };

  for (const [k, v] of Object.entries(llmFacts ?? {})) {
    if (!KEYSET.includes(k as any)) continue;
    const vv = normVal(v);
    const conf = clamp01(llmConf?.[k] ?? 0);

    if (!vv) continue;
    if (conf < 0.55) continue;

    const useLlm =
      LLM_PREFERRED_FIELDS.has(k) ||
      !out[k] ||
      isGarbageValue(out[k]);
    if (useLlm) out[k] = vv;
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

  // Projekt & Beteiligte (kurze Projektnamen oft am Anfang: "Neubau Rettungszentrum Rebland", "2025 Rettungszentrum Rebland")
  out.bauvorhaben = pickAny([
    /(?:^|\n)((?:Neubau|Sanierung|Umbau)\s+[^\n\r]{4,80}?)(?:\n|$)/i,
    /(?:^|\n)20\d{2}\s+([^\n\r]{4,80}?)(?:\n|$)/,
    /Bauvorhaben\s*[:\-]?\s*([^\n\r;.]{4,180})/i,
    /Objekt\s*[:\-]?\s*([^\n\r;.]{4,180})/i,
    /Projekt(?:bezeichnung)?\s*[:\-]?\s*([^\n\r;.]{4,180})/i,
  ]);
  out.ort = pickAny([
    /(?:Bau)?ort\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
    /Standort\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
    /Ort\s+der\s+Leistung\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
  ]);
  out.gewerk = pickAny([
    /Gewerk\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
    /Teilgewerk\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
    /Leistungsbereich\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
    // GAEB-Code: "4200 Heizungsarbeiten" -> "Heizungsarbeiten"
    /(?:^|\n)\d{4}\s+((?:Heizungs|Sanitär|Lüftungs|MSR|Elektro|Kälte)arbeiten)/i,
  ]);
  out.bauherr_ag = pickAny([
    /\bBauherr\b\s*[:\-]\s*([^\n\r;.]{4,120})/i,
    /\bAuftraggeber\b\s*[:\-]\s*([^\n\r;.]{4,120})/i,
    /\bAG\b\s*[:\-]\s*([^\n\r;.]{4,120})/i,
    /\bBauherr\b\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
    /\bAuftraggeber\b\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
  ]);
  out.planer = pickAny([
    /Planer\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
    /(?:Objekt)?[Pp]laner\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
    /Architekt\s*[:\-]?\s*([^\n\r;.]{4,120})/i,
  ]);

  // Termine/Fristen (mit bisschen Schutz gegen Fragment-Auszüge)
  out.baubeginn = pickAny([
    /Baubeginn\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Ausführungsbeginn\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
  ]);

  out.fertigstellung = pickAny([
    /\bFertigstellung\b\s*[:\-]\s*([^\n\r;.]{6,140})/i,
    /\bAbnahme\b\s*[:\-]\s*([^\n\r;.]{6,140})/i,
    /\bÜbergabe\b\s*[:\-]\s*([^\n\r;.]{6,140})/i,
    /\bFertigstellung\b\s*[:\-]?\s*([^\n\r;.]{6,140})/i,
    /\bAbnahme\b\s*[:\-]?\s*([^\n\r;.]{6,140})/i,
    /\bÜbergabe\b\s*[:\-]?\s*([^\n\r;.]{6,140})/i,
  ]);

  out.bauzeit = pickAny([
    /\bBauzeit\b\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /\bAusführungszeit\b\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Dauer\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
  ]);

  out.ausfuehrungsfrist = pickAny([
    /\bAusführungsfrist\b\s*[:\-]\s*([^\n\r;.]{6,180})/i,
    /\bTerminplan\b\s*[:\-]\s*([^\n\r;.]{6,180})/i,
    /\bBauzeitenplan\b\s*[:\-]\s*([^\n\r;.]{6,180})/i,
    /\bAusführungsfrist\b\s*[:\-]?\s*([^\n\r;.]{6,180})/i,
    /\bTerminplan\b\s*[:\-]?\s*([^\n\r;.]{6,180})/i,
    /\bBauzeitenplan\b\s*[:\-]?\s*([^\n\r;.]{6,180})/i,
  ]);

  out.fristAngebot = pickAny([
    /Angebots(?:abgabe)?frist\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Abgabefrist\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
  ]);

  out.bindefrist = pickAny([/Bindefrist\s*(?:beträgt|:)?\s*([^\n\r;.]{6,120})/i]);

  out.ausfuehrungszeit = pickAny([
    /Ausführungszeit\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Ausführungsdauer\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
  ]);

  out.submission_einreichung = pickAny([
    /Submission\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Einreichung\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /Angebotsabgabe\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
  ]);

  // Vertragsgrundlagen: VOB Teile A, B, C explizit
  out.vertragsgrundlagen = pickAny([
    /(VOB,?\s*Teile?\s*A,?\s*B\s*und\s*C[^\n\r]{0,80})/i,
    /Vertragsgrundlage(?:n)?\s*[:\-]?\s*([^\n\r;.]{6,240})/i,
    /Maßgebende\s+Unterlagen\s*[:\-]?\s*([^\n\r;.]{6,240})/i,
  ]);
  out.wartung_instandhaltung = pickAny([
    /\bWartung\b\s*[:\-]\s*([^\n\r;.]{6,180})/i,
    /\bInstandhaltung\b\s*[:\-]\s*([^\n\r;.]{6,180})/i,
    /\bWartungsvertrag\b\s*[:\-]\s*([^\n\r;.]{6,180})/i,
    /\bWartung\b\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /\bInstandhaltung\b\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
    /\bWartungsvertrag\b\s*[:\-]?\s*([^\n\r;.]{6,120})/i,
  ]);

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

  // Schlussrechnung / Zahlungsziel (Label: Wert bevorzugt, sonst kurze Frist)
  out.schlussrechnung = pickAny([
    /\bSchlussrechnung\b\s*[:\-]\s*([^\n\r]{10,120})/i,
    /\bZahlungsziel\b\s*[:\-]\s*([^\n\r]{10,120})/i,
    /\bSchlusszahlung\b\s*[:\-]\s*([^\n\r]{10,120})/i,
    /\bSchlussrechnung\b\s*[:\-]?\s*([^\n\r]{10,120})/i,
    /\bZahlungsziel\b\s*[:\-]?\s*([^\n\r]{10,120})/i,
    /\bSchlusszahlung\b\s*[:\-]?\s*([^\n\r]{10,120})/i,
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

GAEB-STRUKTUR: Der Vortext hat oft am ANFANG Metadaten (CaliforniaX, Datum, Projektname, Gewerk-Code), dann Anlagenbeschreibung, dann VERTRAGSBEDINGUNGEN.

KEYFACTS – WICHTIG (dynamisch aus dem Text auswerten):
- bauvorhaben: KURZER Projektname/Titel (z. B. "Neubau Rettungszentrum Rebland"), NICHT die lange Beschreibung ("Bei dem Bauvorhaben handelt es sich um..."). Oft in den ersten Zeilen.
- gewerk: Gewerk aus Code/Überschrift (z. B. "4200 Heizungsarbeiten" → "Heizung" oder "Heizungsarbeiten"). NICHT Text aus anderen Abschnitten (z. B. "nachhaltiger Forstwirtschaft").
- vertragsgrundlagen / vob_bgb: Aus Abschnitt VERTRAGSBEDINGUNGEN: "VOB, Teile A, B und C" wenn genannt. Konkret extrahieren.
- ort: Konkreter Ort/Standort (Stadt, Adresse). NICHT "lich" (Fragment von "örtlich").
- bauzeit, baubeginn, fertigstellung: Datum oder konkrete Frist (z. B. "2026-01-09"). NICHT Handlungsanweisungen ("vorzulegen", "zu bestätigen").
- bauherr_ag, planer: Konkreter Name/Firma (z. B. "G&W Software AG"). NICHT "(Auftraggeber)" oder Beschreibung von Plänen.
- ausfuehrungsfrist: Konkrete Frist (z. B. "Siehe Vertragsunterlagen"). NICHT Überschriften wie "BESONDERE VERTRAGSBEDINGUNGEN".

Regeln:
- Nichts erfinden. Unklar = "" und confidence niedrig.
- Keine Fragmente. Keine Satzanfänge ("en", "n", "der").
- keyFactConfidence: 0..1. Unter 0.55 gilt als unzuverlässig.
- riskClauses: max ${MAX_RISK_CLAUSES}, text = wörtlicher Auszug, interpretation = 1–2 Sätze, confidence 0..1.
- Fokus Risiken: Festpreis, Preisgleitung, Vertragsstrafe, Sicherheiten, Abnahmefiktion, Nachtragslogik, Haftung, Fristen, DGNB/QNG.

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

// ================= LLM KeyFacts Repair (Validierung & Korrektur) =================
const REPAIR_VORTEXT_MAX = 12000;

async function llmRepairKeyFacts(vortext: string, keyFacts: KeyFacts): Promise<KeyFacts> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const vortextSlice = hardCut(vortext, REPAIR_VORTEXT_MAX);

  const prompt = `Du korrigierst fehlerhafte KeyFacts aus einem Ausschreibungs-VORTEXT (GAEB).

STRUKTUR: Oft Metadaten am Anfang (Projektname, "4200 Heizungsarbeiten", Datum), dann Anlagenbeschreibung, dann VERTRAGSBEDINGUNGEN.

KORREKTUR-REGELN:
- bauvorhaben: KURZER Projektname (z. B. "Neubau Rettungszentrum Sulzburg"), NICHT lange Beschreibung
- gewerk: Aus Gewerk-Code/Überschrift (z. B. "4200 Heizungsarbeiten" → "Heizung")
- vertragsgrundlagen / vob_bgb: "VOB, Teile A, B und C" aus Vertragsbedingungen
- baubeginn, fertigstellung, bauzeit, ausfuehrungsfrist: Datum, Frist oder kurzer Verweis (z. B. "Siehe Terminplan"). NICHT prozeduraler Text ("entnommen werden", "vorzulegen", "zu bestätigen", "der die zeitliche Abfolge koordiniert")
- planer, bauherr_ag: Konkreter Name/Firma. NICHT "(Auftraggeber)", "Pläne", "zu erbringen", "erforderlich"
- ausfuehrungsfrist: Wenn nur "können dem Terminplan entnommen werden" → "Siehe beigefügter Terminplan" oder ""
- schlussrechnung: Kurze Frist (z. B. "12 Werktage vor Abnahme"). NICHT "zur Objektdokumentation abzugeben" oder Abschnittsnummern (0.2.13, 0.2.14)
- wartung_instandhaltung: Kurzer Hinweis. NICHT "an den AN zu übertragen, dies gilt evtl." oder lange Beschreibung
- fertigstellung: Datum oder kurze Frist. NICHT "Teile in Betrieb zu nehmen, werden durch Teilabnahmen abgenommen"
- ort: Konkreter Ort (Stadt, Straße). NICHT "lich" (Fragment)
- Keine Fragmente, Verben oder prozeduraler Text. Wenn nicht klar im Text: ""

Aktuelle KeyFacts (zu prüfen):
${JSON.stringify(keyFacts, null, 2)}

VORTEXT:
${vortextSlice}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content:
            "Du gibst AUSSCHLIESSLICH gültiges JSON zurück. Kein Markdown. Kein Text außerhalb des JSON. Alle Keys aus dem Objekt müssen im Output vorhanden sein (leerer String wenn nicht gefunden).",
        },
        {
          role: "user",
          content:
            prompt +
            "\n\nGib NUR das bereinigte JSON-Objekt zurück. Format: { \"baubeginn\": \"...\", \"bauzeit\": \"...\", ... } mit allen Keys.",
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(raw);
    if (parsed && typeof parsed === "object") {
      const repaired = cleanKeyFacts(parsed);
      const out: KeyFacts = { ...keyFacts };
      for (const k of KEYSET) {
        if (!(k in (repaired ?? {}))) continue;
        const v = normVal(repaired?.[k] ?? "");
        if (v && !isGarbageValue(v)) out[k] = v;
        else delete out[k]; // Repair hat explizit geleert/korrigiert → schlechten Wert entfernen
      }
      for (const [k, v] of Object.entries(out)) if (isGarbageValue(v)) delete out[k];
      return out;
    }
  } catch {
    // Bei Fehler: unverändert zurückgeben
  }
  return keyFacts;
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
    let keyFacts = mergeKeyFactsPreferRegex(regexFacts, llmFacts, llmConf);

    // 4) LLM Repair: Fragmente, falsche Zuordnungen und Platzhalter korrigieren
    if (Object.keys(keyFacts).length > 0) {
      keyFacts = await llmRepairKeyFacts(vortext, keyFacts);
    }

    // 5) Risks: wenn LLM leer -> Regex-Fallback (damit nie „immer 0“ bleibt)
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
          repairApplied: true,
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
