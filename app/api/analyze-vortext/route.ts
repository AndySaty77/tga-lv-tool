// app/api/analyze-vortext/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getUser } from "@/lib/auth/get-user";
import { checkRateLimit } from "@/lib/rateLimit";

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

/** Quelle des Vortexts für KeyFacts – zur klaren Zuordnung im Debug. */
export type VortextSourceTextType =
  | "normalized-global-remarks"
  | "normalized-top-label"
  | "normalized-groups"
  | "normalized-group-remarks"
  | "normalized-items"
  | "displayNodes"
  | "legacy-preface-text"
  | "legacy-cleaned-text"
  | "raw-text";

export type KeyFactsSourceMode = "normalized-structure" | "legacy-text" | "mixed" | "llm-fallback";

export type KeyFactWithSource = {
  field: string;
  value: string;
  sourceTextType: VortextSourceTextType;
  sourcePath: string;
  confidence: number;
  acceptedByPositivePattern?: boolean;
  rejectedByNegativePattern?: boolean;
  validationReason?: string;
  /** "label" | "heuristic" | "llm" | "none" */
  extractionMode?: "label" | "heuristic" | "llm" | "none";
  matchedLabel?: string;
  rawMatchedText?: string;
  cleanedCandidateValue?: string;
  /** Nur bei extractionMode "llm" */
  llmConfidence?: string;
  llmReason?: string;
  llmRawValue?: string;
};

type FieldMatrixEntry = {
  maxLength: number;
  /** Mindestens ein Pattern muss auf den Wert zutreffen (echtes Feld-Signal). */
  positivePatterns: RegExp[];
  /** Kein Pattern darf zutreffen (Fehlzuordnungen ausschließen). */
  negativePatterns: RegExp[];
  /** Optional: Zusätzliches Pflicht-Signal (z. B. Orts-/Datums-Signal). */
  requiredSignal?: RegExp;
};

type ValidationResult = {
  valid: boolean;
  acceptedByPositivePattern?: boolean;
  rejectedByNegativePattern?: boolean;
  rejectedByRequiredSignal?: boolean;
  validationReason?: string;
};

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

  // KW-Angaben (z. B. "11. KW 2026") sind gültig, auch wenn nur "KW" als Wort (2 Buchstaben)
  if (/\d{1,2}\.\s*KW\s*\d{4}\b/i.test(s)) return false;

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

// ================= LLM KeyFacts Fallback (nur strukturierte Quellen, nur Lücken füllen) =================
type LlmKeyFactsFallbackEntry = { value: string; confidence: "high" | "medium" | "low"; reason: string };
type LlmKeyFactsFallbackResult = Partial<Record<KeyFactKey, LlmKeyFactsFallbackEntry>>;

function buildStructuredPromptForKeyFacts(input: {
  globalRemarks: string[];
  topLabelForPreface?: string;
  groups: string[];
}): string {
  const payload = {
    globalRemarks: input.globalRemarks.filter((t) => (t ?? "").trim().length > 0),
    topLabelForPreface: (input.topLabelForPreface ?? "").trim() || undefined,
    groups: input.groups.filter((g) => (g ?? "").trim().length > 0),
  };
  return JSON.stringify(payload, null, 2);
}

async function llmKeyFactsFallback(
  structuredInput: { globalRemarks: string[]; topLabelForPreface?: string; groups: string[] },
  fieldsToRequest: KeyFactKey[]
): Promise<{ result: LlmKeyFactsFallbackResult; raw: string; parsed: Record<string, unknown> | null }> {
  const empty = { result: {} as LlmKeyFactsFallbackResult, raw: "", parsed: null };
  if (fieldsToRequest.length === 0) return empty;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const promptPayload = buildStructuredPromptForKeyFacts(structuredInput);
  const fieldList = fieldsToRequest.join(", ");

  const systemPrompt = `Du erhältst strukturierte Vorbemerkungen aus einem GAEB-Leistungsverzeichnis (globalRemarks, topLabelForPreface, groups).
Deine Aufgabe: Extrahiere NUR die angefragten Projektdaten. Gib AUSSCHLIESSLICH gültiges JSON im erwarteten Schema zurück. Kein Markdown, keine Erklärungen außerhalb des JSON.
Regeln: Wenn ein Feld nicht eindeutig im Text steht, gib für value leeren String "" zurück. Erfinde nichts. Verwende nur Informationen aus dem bereitgestellten Text. Keine Rückschlüsse aus allgemeinem Bauwissen.`;

  const userPrompt = `Extrahiere nur diese Felder: ${fieldList}.

Feldspezifische Regeln:
- bauherr_ag: nur Auftraggeber/Bauherr, nicht Bieter oder Empfänger
- ort: nur Bauort/Standort (z.B. Straße, PLZ Ort), nicht allgemeine Beschreibungen
- bindefrist: nur Fristangabe (z.B. "6 Wochen")
- submission_einreichung: nur Angebotsabgabe/Einreichung/Submission mit Datum/Uhrzeit/Frist (z.B. "30. Oktober 2025")
- baubeginn: nur Ausführungsbeginn/Baubeginn (z.B. "11. KW 2026")
- vob_bgb: nur Vertragsgrundlage (z.B. "VOB, Teile A, B und C")
- bauvorhaben: nur kurzer Projektname/Titel (z.B. "Neubau Rettungszentrum Rebland"), NICHT lange Beschreibung

Antworte NUR mit einem JSON-Objekt. Pro Feld: { "value": "...", "confidence": "high"|"medium"|"low", "reason": "..." }. Bei Unklarheit value: "".

Strukturierte Vorbemerkungen:
${promptPayload}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== "object") return { result: {}, raw, parsed: null };

    const out: LlmKeyFactsFallbackResult = {};
    for (const field of fieldsToRequest) {
      const entry = parsed[field];
      if (!entry || typeof entry !== "object") continue;
      const value = typeof entry.value === "string" ? entry.value.trim() : "";
      const confidence = entry.confidence === "high" || entry.confidence === "medium" || entry.confidence === "low" ? entry.confidence : "low";
      const reason = typeof entry.reason === "string" ? entry.reason.trim() : "";
      out[field] = { value, confidence, reason };
    }
    return { result: out, raw, parsed };
  } catch {
    return empty;
  }
}

// ================= Route =================
const LEGACY_SOURCE: { sourceTextType: VortextSourceTextType; sourcePath: string; keyFactsSourceMode: KeyFactsSourceMode } = {
  sourceTextType: "legacy-preface-text",
  sourcePath: "unknown",
  keyFactsSourceMode: "legacy-text",
};

// ================= Normalisierte GAEB-Struktur (KeyFacts primär daraus) =================
export type NormalizedPayload = {
  globalRemarks: string[];
  topLabelForPreface?: string;
  groups: { label: string }[];
  groupRemarks?: string[];
};

/** Felder, die zuerst aus strukturierten Quellen extrahiert werden (bei gaeb-xml). */
const STRUCTURED_KEYFACT_FIELDS: KeyFactKey[] = [
  "bauherr_ag",
  "ort",
  "bauvorhaben",
  "gewerk",
  "submission_einreichung",
  "bindefrist",
  "baubeginn",
  "fertigstellung",
  "vob_bgb",
  "vertragsgrundlagen",
];

/** Phase-1-Felder für LLM-Fallback (nur fehlende/unsichere aus strukturierten Quellen ergänzen). */
const LLM_FALLBACK_FIELDS: KeyFactKey[] = ["bauherr_ag", "ort", "bindefrist", "submission_einreichung", "baubeginn", "vob_bgb", "bauvorhaben"];

// ================= Stufe A: Label-basierte Extraktion (Wert nur rechts vom Label) =================
const LABEL_EXTRACTION_FIELDS: KeyFactKey[] = ["bauherr_ag", "ort", "bauvorhaben", "bindefrist", "submission_einreichung", "baubeginn"];

/** Pro Feld: Regex mit einer Capturing-Gruppe für den Wert rechts vom Label. */
const LABEL_PATTERNS: Record<string, Array<{ regex: RegExp; labelName: string }>> = {
  bauherr_ag: [
    { regex: /\bBauherr\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "Bauherr:" },
    { regex: /\bAuftraggeber\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "Auftraggeber:" },
    { regex: /\bAG\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "AG:" },
  ],
  ort: [
    { regex: /\bBauort\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "Bauort:" },
    { regex: /\bOrt\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "Ort:" },
    { regex: /\bStandort\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "Standort:" },
    { regex: /\bOrt\s+der\s+Leistung\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "Ort der Leistung:" },
  ],
  bindefrist: [
    { regex: /\bBindefrist\s*(?:beträgt\s*)?[:\-]?\s*([^\n\r;]{1,80})/i, labelName: "Bindefrist" },
    { regex: /\bBindefrist\s*[:\-]\s*([^\n\r;]{1,80})/i, labelName: "Bindefrist:" },
  ],
  submission_einreichung: [
    { regex: /\bAngebotsabgabefrist\s*[:\-]\s*([^\n\r;]{1,80})/i, labelName: "Angebotsabgabefrist:" },
    { regex: /\bSubmission\s*[:\-]\s*([^\n\r;]{1,80})/i, labelName: "Submission:" },
    { regex: /\bEinreichung\s*[:\-]\s*([^\n\r;]{1,80})/i, labelName: "Einreichung:" },
    { regex: /\bAngebotsfrist\s*[:\-]\s*([^\n\r;]{1,80})/i, labelName: "Angebotsfrist:" },
  ],
  baubeginn: [
    { regex: /\bAusführungsbeginn\s*[:\-]\s*([^\n\r;]{1,80})/i, labelName: "Ausführungsbeginn:" },
    { regex: /\bBaubeginn\s*[:\-]\s*([^\n\r;]{1,80})/i, labelName: "Baubeginn:" },
  ],
  bauvorhaben: [
    { regex: /\bBauvorhaben\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "Bauvorhaben:" },
    { regex: /\bProjekt\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "Projekt:" },
    { regex: /\bObjekt\s*[:\-]\s*([^\n\r;]{1,120})/i, labelName: "Objekt:" },
  ],
};

/** Felder, bei denen 1–2 folgende Zeilen mitgenommen werden, sofern keine neue Feldbezeichnung beginnt. */
const MULTILINE_LABEL_FIELDS: KeyFactKey[] = ["ort", "bauvorhaben", "submission_einreichung", "baubeginn", "bindefrist"];
/** Zeilenanfang, der eine neue KeyFact-Bezeichnung einleitet → nächste Zeile nicht anhängen. */
const LINE_START_LABEL = /^(?:Bauherr|Auftraggeber|\bAG\b|Bauort|Ort\s|Standort|Ort\s+der\s+Leistung|Bindefrist|Angebotsabgabefrist|Submission|Einreichung|Angebotsfrist|Ausführungsbeginn|Baubeginn|Bauvorhaben|Projekt|Objekt|Angebotssumme|Angebotsumme|Summe\s+netto|Summe\s+brutto)\s*[:\-]?/i;

function extractValueByLabel(text: string, field: string): { value: string; matchedLabel: string; rawMatchedText: string } | null {
  const patterns = LABEL_PATTERNS[field];
  if (!patterns) return null;
  for (const { regex, labelName } of patterns) {
    const m = text.match(regex);
    if (m && m[1]) {
      let raw = m[1].trim();
      if (raw.length === 0) continue;
      if (MULTILINE_LABEL_FIELDS.includes(field as KeyFactKey)) {
        const lines = text.split(/\r?\n/);
        const charIndex = m.index ?? 0;
        const lineIndex = text.slice(0, charIndex).split(/\r?\n/).length - 1;
        const extra: string[] = [];
        for (let i = lineIndex + 1; i < lines.length && extra.length < 2; i++) {
          const line = lines[i].trim();
          if (!line) break;
          if (LINE_START_LABEL.test(line)) break;
          extra.push(line);
        }
        if (extra.length > 0) raw = [raw, ...extra].join(", ");
      }
      // Baubeginn (und ähnliche): Wert nicht über bekannte Folgelabels hinaus mitnehmen (z. B. ", Angebotssumme netto:")
      if (field === "baubeginn" && /\s*,?\s*Angebotssumme\s/i.test(raw)) {
        const idx = raw.search(/\s*,?\s*Angebotssumme\s/i);
        raw = raw.slice(0, idx).replace(/\s*,\s*$/, "").trim();
      }
      return { value: raw, matchedLabel: labelName, rawMatchedText: raw };
    }
  }
  return null;
}

// ================= Feld-Matrix: feldspezifische Validierung =================
const FIELD_MATRIX: Partial<Record<KeyFactKey, FieldMatrixEntry>> = {
  bauherr_ag: {
    maxLength: 120,
    positivePatterns: [
      /[A-Za-zÄÖÜäöüß\-\.]{2,}/,
      /\b(?:GmbH|AG|KG|e\.?V\.?)\b/i,
    ],
    negativePatterns: [
      /(?:vob|vertrag|gemäß|leistung|qng|anforderung)/i,
      /zur\s+Einhaltung|zu\s+benennen/,
    ],
  },
  ort: {
    maxLength: 120,
    positivePatterns: [
      /\b(?:Bau)?ort\s*[:\-]\s*/i,
      /\bStandort\s*[:\-]\s*/i,
      /\bOrt\s+der\s+Leistung\s*[:\-]\s*/i,
      /\b(?:Straße|Str\.|Platz|Weg)\s*[:\-]?\s*\S/i,
      /\d{5}\s+[A-Za-zÄÖÜäöüß\-]/,
      /[A-Za-zäöüß\-]+\s+\d+\s*[,\s]+[\d]{5}/,
      /,\s*\d{5}\s+[A-Za-zÄÖÜäöüß\-]/, // "Berliner Straße, 79211 Denzlingen"
    ],
    negativePatterns: [
      /\bVOB\b/i,
      /\bvertrags?\w*/i,
      /\bleistung\s+(?:ist|sind|wird|werden|gemäß|nach)/i,
      /\bder\s+leistung\s+(?:eingereicht|vorzulegen|zu\s+erbringen)/i,
      /\ballgemein|maßgebend|vertragsbestimmungen/i,
      /gemäß\s+(?:vob|§)/i,
    ],
    requiredSignal: /(?:ort|standort|straße|str\.|platz|adresse|plz|\d{5}\s|[A-Za-zÄÖÜäöüß\-]{2,})/i,
  },
  bauvorhaben: {
    maxLength: 120,
    positivePatterns: [
      /\b(?:Neubau|Sanierung|Umbau|Erweiterung|Bauvorhaben|Projekt)\b/i,
      /[A-Za-zÄÖÜäöüß\-]{4,}\s+[A-Za-zÄÖÜäöüß\-]{4,}/, // mind. 2 Wörter (z.B. "Neubau Rettungszentrum Rebland")
    ],
    negativePatterns: [
      /^(?:Bei dem|Es handelt sich|Das Bauvorhaben)\s/i,
      /\b(?:vob|vertrag|§|gemäß)\b/i,
    ],
    requiredSignal: /.{10,}/,
  },
  gewerk: {
    maxLength: 120,
    positivePatterns: [
      /\bGewerk\s*[:\-]\s*/i,
      /\bTeilgewerk\s*[:\-]\s*/i,
      /\bLeistungsbereich\s*[:\-]\s*/i,
      /\d{4}\s+(?:Heizungs|Sanitär|Lüftungs|MSR|Elektro|Kälte)arbeiten/i,
    ],
    negativePatterns: [
      /(?:vob|vertrag|abnahme|zahlung|gewährleistung)/i,
    ],
  },
  bindefrist: {
    maxLength: 100,
    positivePatterns: [
      /\bBindefrist\s*(?:beträgt|:)?\s*/i,
      /\d+\s*(?:Tage?|Wochen?|Wochten?|Monate?)/i,
      /\d{1,2}[.\-/]\d{1,2}/,
    ],
    negativePatterns: [
      /^(?:und|oder|von|bis|nach)\s+/i,
      /(?:vob|vertrag)\s/i,
    ],
  },
  submission_einreichung: {
    maxLength: 100,
    positivePatterns: [
      /\b(?:Submission|Einreichung|Angebotsabgabe|Abgabefrist)\s*[:\-]?\s*/i,
      /\d{1,2}[.\-/]\d{1,2}([.\-/]\d{2,4})?/,
      /\d{1,2}\.\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}/i, // "30. Oktober 2025"
      /\b(?:bis|zum|bis\s+zum)\s+\d/i,
      /\bKW\s*\d+/i,
      /\b(?:Uhr|:\d{2})/,
      /\bFrist\b/i,
    ],
    negativePatterns: [
      /\b(GmbH|AG|Co\.\s*KG|KG\b|UG\b)\b/i,
      /^[A-Z][a-z]+(?:\s+[A-Za-z]+)*(?:\s+GmbH)?\s*$/,
    ],
    requiredSignal: /\d|frist|abgabe|einreichung|bis\s+zum|uhr|kw|oktober|januar|februar|märz|april|mai|juni|juli|august|september|november|dezember/i,
  },
  baubeginn: {
    maxLength: 100,
    positivePatterns: [
      /\b(?:Baubeginn|Ausführungsbeginn)\s*[:\-]?\s*/i,
      /\d{1,2}[.\-/]\d{1,2}([.\-/]\d{2,4})?/,
      /\d{1,2}\.\s*KW\s*\d{4}/i, // "11. KW 2026"
      /\bKW\s*\d+/i,
      /\b(?:Frist|Dauer|Zeitraum)\b/i,
      /siehe\s+(?:Termin|Bauzeiten)/i,
    ],
    negativePatterns: [
      /^(?:und|oder|von\s+der|der\s+leistung|eingereicht|vorzulegen)\s+/i,
      /\bVOB\b|\bvertrags?\w*/i,
    ],
    requiredSignal: /\d|kw|frist|dauer|termin|siehe/i,
  },
  fertigstellung: {
    maxLength: 100,
    positivePatterns: [
      /\b(?:Fertigstellung|Abnahme|Übergabe)\s*[:\-]?\s*/i,
      /\d{1,2}[.\-/]\d{1,2}([.\-/]\d{2,4})?/,
      /\bKW\s*\d+/i,
      /\d+\s*(?:Wochten?|Monate?|Jahre?)/i,
      /siehe\s+(?:Termin|Bauzeiten|Abnahme)/i,
      /\bFrist\b/i,
    ],
    negativePatterns: [
      /^(?:und|oder|von\s+der|bis\s+zur)\s+/i,
      /\bder\s+leistung\s+eingereicht\b/i,
      /\bVOB\b|\ballgemein|vertragsbestimmungen/i,
      /(?:teile\s+in\s+betrieb|teilabnahmen).{30,}/i,
    ],
    requiredSignal: /\d|kw|frist|dauer|termin|siehe|abnahme\s+bis|bis\s+zum/i,
  },
  bauzeit: {
    maxLength: 100,
    positivePatterns: [
      /\b(?:Bauzeit|Ausführungszeit|Ausführungsdauer|Dauer)\s*[:\-]?\s*/i,
      /\d+\s*(?:Wochten?|Monate?|Jahre?)/i,
      /\d{1,2}[.\-/]\d{1,2}/,
      /siehe\s+(?:Termin|Bauzeiten)/i,
    ],
    negativePatterns: [
      /^(?:und|oder|von\s+der)\s+/i,
      /\bVOB\b|\bvertrags?\w*/i,
    ],
    requiredSignal: /\d|frist|dauer|siehe|wochten?|monate?|jahre?/i,
  },
  vob_bgb: {
    maxLength: 30,
    positivePatterns: [
      /^(?:VOB|BGB|VOB\/B|VOB\s*B|VOB\/C)(?:\s*\+\s*BGB)?$/i,
      /VOB/i,
      /BGB/i,
    ],
    negativePatterns: [],
  },
  vertragsgrundlagen: {
    maxLength: 180,
    positivePatterns: [
      /VOB,?\s*Teile?\s*A,?\s*B\s*und\s*C/i,
      /\bVertragsgrundlage(?:n)?\s*[:\-]?\s*/i,
      /\bMaßgebende\s+Unterlagen\s*[:\-]?\s*/i,
    ],
    negativePatterns: [
      /^(?:Gewährleistung|Mängelhaftung|Zahlung|Abnahme)\s*$/i,
    ],
  },
  schlussrechnung: {
    maxLength: 120,
    positivePatterns: [
      /\b(?:Schlussrechnung|Zahlungsziel|Schlusszahlung)\s*[:\-]?\s*/i,
      /%\s*|\d+\s*(?:Tage?|Wochten?|Monate?)/i,
      /\bFrist\b.*\b(?:Zahlung|Rechnung)/i,
    ],
    negativePatterns: [
      /\bund\/?oder\s+von\s+der\s+schlussrechnung\b/i,
      /^(?:und|oder|sowie)\s+/i,
    ],
    requiredSignal: /%|\d|zahlungsziel|frist|rechnung|tage?|wochten?|monate?/i,
  },
  gewaerhleistung: {
    maxLength: 120,
    positivePatterns: [
      /\d+\s*(?:Jahre?|Monate?|Jahres?frist)/i,
      /\bGewährleistung(?:sfrist)?\s*[:\-]?\s*.{5,}/i,
      /\bMängel(?:haftung|ansprüche)?\s*[:\-]?\s*.{5,}/i,
    ],
    negativePatterns: [
      /^(?:Gewährleistung|Mängelhaftung)(?:\s+und\s+Abnahme)?\s*$/i,
      /\bVOB\b.*\b(?:§|Abschnitt)\s/i,
    ],
    requiredSignal: /\d|frist|jahre?|monate?|regelung/i,
  },
  abschlagszahlung: {
    maxLength: 120,
    positivePatterns: [
      /\bAbschlagszahlung(?:en)?\s*[:\-]?\s*/i,
      /\bAbschlagsrechn(?:ung|ungen)\s*[:\-]?\s*/i,
      /%\s*|\d+\s*(?:Tage?|Wochten?|Monate?)/i,
    ],
    negativePatterns: [
      /\bund\/?oder\s+von\s+der\s+schlussrechnung\b/i,
      /^(?:und|oder|sowie)\s+/i,
    ],
    requiredSignal: /%|\d|frist|tage?|wochten?|monate?|zahlung|rechnung/i,
  },
  vertragsstrafe: {
    maxLength: 120,
    positivePatterns: [
      /\bVertragsstrafe\s*[:\-]?\s*.{5,}/i,
      /\bPönale\s*[:\-]?\s*.{5,}/i,
      /\d+[\s,%]/,
    ],
    negativePatterns: [
      /^(?:Vertragsstrafe|Pönale)\s*$/i,
    ],
    requiredSignal: /.{10,}|\d/,
  },
};

function validateKeyFactValue(field: string, value: string): ValidationResult {
  const s = (value ?? "").trim();
  if (!s) return { valid: false, validationReason: "empty" };
  const entry = FIELD_MATRIX[field as KeyFactKey];
  if (!entry) return { valid: true };
  if (s.length > entry.maxLength) return { valid: false, validationReason: "maxLength" };
  const rejectedByNegativePattern = entry.negativePatterns.some((r) => r.test(s));
  if (rejectedByNegativePattern) return { valid: false, rejectedByNegativePattern: true, validationReason: "negativePattern" };
  const acceptedByPositivePattern = entry.positivePatterns.some((r) => r.test(s));
  if (!acceptedByPositivePattern) return { valid: false, acceptedByPositivePattern: false, validationReason: "noPositiveMatch" };
  const failedRequiredSignal = entry.requiredSignal && !entry.requiredSignal.test(s);
  if (failedRequiredSignal) return { valid: false, rejectedByRequiredSignal: true, validationReason: "requiredSignal" };
  return { valid: true, acceptedByPositivePattern: true, rejectedByNegativePattern: false };
}

/** Generische/Platzhalter-Werte nicht als gültiges KeyFact übernehmen. */
function isInvalidOrGenericValue(value: string, field: string): boolean {
  const s = (value ?? "").trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  if (/^(zu\s+benennen|noch\s+zu\s+benennen|wird\s+(noch\s+)?bekannt\s+gegeben|siehe\s+anlage|\.\.\.|n\.\s*b\.|tbd|k\.\s*a\.)$/i.test(lower)) return true;
  if (/^(n\.?\s*v\.?|n\/a|–|—|-)$/i.test(lower)) return true;
  // Lange Satzfetzen bei Termin/Frist-Feldern nicht übernehmen
  const dateLikeFields = ["baubeginn", "fertigstellung", "bauzeit", "ausfuehrungsfrist", "ausfuehrungszeit", "bindefrist", "submission_einreichung"];
  if (dateLikeFields.includes(field) && s.length > 100) return true;
  if (dateLikeFields.includes(field) && /(vorzulegen|zu bestätigen|entnommen werden|der die zeitliche)/i.test(s)) return true;
  return false;
}

/** Harte Validierung: Feld-Matrix hat Vorrang; sonst Fallback-Logik für Felder ohne Matrix. */
function isWeakOrInvalidFieldValue(value: string, field: string): boolean {
  const result = validateKeyFactValue(field, value);
  if (FIELD_MATRIX[field as KeyFactKey]) return !result.valid;
  const s = (value ?? "").trim();
  if (!s) return true;
  if (field === "gewaerhleistung" && s.length < 25 && !/\d/.test(s)) return true;
  if ((field === "abschlagszahlung" || field === "schlussrechnung") && /\bund\/?oder\s+von\s+der\s+schlussrechnung\b/i.test(s)) return true;
  return false;
}

type ExtractionDebugEntry = {
  extractionMode: "label" | "heuristic" | "llm" | "none";
  matchedLabel?: string;
  rawMatchedText?: string;
  cleanedCandidateValue?: string;
  llmConfidence?: string;
  llmReason?: string;
  llmRawValue?: string;
};

/** KeyFacts aus normalisierter Struktur extrahieren. Stufe A: label-basiert (5 Felder); Stufe B: Heuristik. */
function extractKeyFactsFromNormalized(normalized: NormalizedPayload): {
  keyFacts: KeyFacts;
  sources: Record<string, { sourceTextType: VortextSourceTextType; sourcePath: string }>;
  extractionDebug: Record<string, ExtractionDebugEntry>;
} {
  const keyFacts: KeyFacts = {};
  const sources: Record<string, { sourceTextType: VortextSourceTextType; sourcePath: string }> = {};
  const extractionDebug: Record<string, ExtractionDebugEntry> = {};
  const segments: { text: string; sourceTextType: VortextSourceTextType; sourcePath: string }[] = [];

  (normalized.globalRemarks ?? []).forEach((t, i) => {
    if ((t ?? "").trim()) segments.push({ text: t.trim(), sourceTextType: "normalized-global-remarks", sourcePath: `normalized.globalRemarks[${i}]` });
  });
  if ((normalized.topLabelForPreface ?? "").trim()) {
    segments.push({ text: normalized.topLabelForPreface!.trim(), sourceTextType: "normalized-top-label", sourcePath: "normalized.topLabelForPreface" });
  }
  (normalized.groups ?? []).forEach((g, i) => {
    const label = (g?.label ?? "").trim();
    if (label) segments.push({ text: label, sourceTextType: "normalized-groups", sourcePath: `normalized.groups[${i}].label` });
  });
  (normalized.groupRemarks ?? []).forEach((t, i) => {
    if ((t ?? "").trim()) segments.push({ text: t.trim(), sourceTextType: "normalized-group-remarks", sourcePath: `normalized.groupRemarks[${i}]` });
  });

  for (const seg of segments) {
    const partial = extractKeyFactsRegex(seg.text);
    for (const field of STRUCTURED_KEYFACT_FIELDS) {
      if (keyFacts[field]) continue;
      let candidate: string | null = null;
      let mode: "label" | "heuristic" | "none" = "none";
      let matchedLabel: string | undefined;
      let rawMatchedText: string | undefined;

      if (LABEL_EXTRACTION_FIELDS.includes(field)) {
        const labelResult = extractValueByLabel(seg.text, field);
        if (labelResult) {
          const cleaned = normVal(labelResult.value);
          if (cleaned && !isGarbageValue(cleaned) && !isInvalidOrGenericValue(cleaned, field) && !isWeakOrInvalidFieldValue(cleaned, field)) {
            candidate = cleaned;
            mode = "label";
            matchedLabel = labelResult.matchedLabel;
            rawMatchedText = labelResult.rawMatchedText;
          }
        }
      }
      if (!candidate) {
        const v = normVal(partial[field] ?? "");
        if (v && !isGarbageValue(v) && !isInvalidOrGenericValue(v, field) && !isWeakOrInvalidFieldValue(v, field)) {
          candidate = v;
          mode = "heuristic";
          rawMatchedText = partial[field] ?? undefined;
        }
      }
      if (candidate) {
        keyFacts[field] = candidate;
        sources[field] = { sourceTextType: seg.sourceTextType, sourcePath: seg.sourcePath };
        extractionDebug[field] = {
          extractionMode: mode,
          matchedLabel,
          rawMatchedText,
          cleanedCandidateValue: candidate,
        };
      }
    }
    if (!keyFacts.vob_bgb && /(vob\/b|vob b|vob\/c|vob c|\bvob\/?b\b|\bvob\/?c\b)/i.test(seg.text)) keyFacts.vob_bgb = "VOB";
    if (!keyFacts.vob_bgb && /\bBGB\b/i.test(seg.text)) keyFacts.vob_bgb = "BGB";
    if (keyFacts.vob_bgb && !sources.vob_bgb) sources.vob_bgb = { sourceTextType: seg.sourceTextType, sourcePath: seg.sourcePath };
  }

  for (const k of Object.keys(keyFacts)) {
    if (isGarbageValue(keyFacts[k]) || isInvalidOrGenericValue(keyFacts[k], k) || isWeakOrInvalidFieldValue(keyFacts[k], k)) {
      delete keyFacts[k];
      delete sources[k];
      delete extractionDebug[k];
    }
  }
  return { keyFacts, sources, extractionDebug };
}

const VORTEXT_RATE_LIMIT_PER_MINUTE = 5;
const VORTEXT_RATE_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const rl = checkRateLimit(`vortext:${user.id}`, VORTEXT_RATE_LIMIT_PER_MINUTE, VORTEXT_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const vortext = sanitizeVortext((body?.text ?? "").toString());

    const rawSrc = body?.vortextSource && typeof body.vortextSource === "object" ? body.vortextSource : null;
    const srcTypeOk = rawSrc && ["normalized-global-remarks", "normalized-top-label", "normalized-groups", "normalized-group-remarks", "normalized-items", "displayNodes", "legacy-preface-text", "legacy-cleaned-text", "raw-text"].includes(rawSrc.sourceTextType);
    const modeOk = rawSrc && ["normalized-structure", "legacy-text", "mixed", "llm-fallback"].includes(rawSrc.keyFactsSourceMode);
    const vortextSource = rawSrc
      ? {
          sourceTextType: srcTypeOk ? (rawSrc.sourceTextType as VortextSourceTextType) : LEGACY_SOURCE.sourceTextType,
          sourcePath: rawSrc.sourcePath != null ? String(rawSrc.sourcePath) : "unknown",
          keyFactsSourceMode: modeOk ? (rawSrc.keyFactsSourceMode as KeyFactsSourceMode) : LEGACY_SOURCE.keyFactsSourceMode,
        }
      : LEGACY_SOURCE;

    const useNormalizedStructure =
      body?.formatDetected === "gaeb-xml" &&
      body?.normalized &&
      typeof body.normalized === "object" &&
      Array.isArray((body.normalized as NormalizedPayload).globalRemarks);

    let keyFacts: KeyFacts = {};
    const keyFactsSourceByField: Record<string, { sourceTextType: VortextSourceTextType; sourcePath: string }> = {};
    const keyFactsExtractionDebug: Record<string, ExtractionDebugEntry> = {};
    let keyFactsSourceMode: KeyFactsSourceMode = "legacy-text";
    let llmFallbackUsed = false;
    const llmFieldsRequested: KeyFactKey[] = [];
    const llmFieldsAccepted: KeyFactKey[] = [];
    const llmFieldsRejected: KeyFactKey[] = [];
    let llmRawResponse = "";
    let llmParsedResponse: Record<string, unknown> | null = null;
    const llmFallbackDebugPerField: Record<string, { llmWasRequested: boolean; llmRawValue?: string; llmValidated: boolean; llmRejectedReason?: string; llmRejectedByNegativePattern?: boolean; llmRejectedByRequiredSignal?: boolean; garbageCheckReason?: string }> = {};
    const mergeWinnerPerField: Record<string, string> = {};
    const overwrittenByLegacy: Record<string, boolean> = {};
    const previousValueBeforeLegacyMerge: Record<string, string> = {};

    if (useNormalizedStructure) {
      const normalized = body.normalized as NormalizedPayload;
      const payload = {
        globalRemarks: Array.isArray(normalized.globalRemarks) ? normalized.globalRemarks : [],
        topLabelForPreface: normalized.topLabelForPreface,
        groups: Array.isArray(normalized.groups) ? normalized.groups : [],
        groupRemarks: Array.isArray(normalized.groupRemarks) ? normalized.groupRemarks : [],
      };
      const hasAnySegment =
        payload.globalRemarks.some((t) => (t ?? "").trim().length > 0) ||
        (payload.topLabelForPreface ?? "").trim().length > 0 ||
        payload.groups.some((g) => (g?.label ?? "").trim().length > 0) ||
        (payload.groupRemarks ?? []).some((t) => (t ?? "").trim().length > 0);

      if (hasAnySegment) {
        const { keyFacts: structuredFacts, sources: structuredSources, extractionDebug: structuredExtractionDebug } = extractKeyFactsFromNormalized(payload);
        keyFacts = { ...structuredFacts };
        Object.assign(keyFactsSourceByField, structuredSources);
        Object.assign(keyFactsExtractionDebug, structuredExtractionDebug);
      }

      // LLM-Fallback nur für fehlende Phase-1-Felder, nur strukturierte Quellen (kein Rohtext)
      const fieldsToRequest = LLM_FALLBACK_FIELDS.filter((f) => !keyFacts[f] || (keyFacts[f] ?? "").trim() === "");
      if (fieldsToRequest.length > 0) {
        const structuredInput = {
          globalRemarks: payload.globalRemarks ?? [],
          topLabelForPreface: payload.topLabelForPreface,
          groups: (payload.groups ?? []).map((g: { label?: string }) => (g?.label ?? "").trim()).filter(Boolean),
        };
        llmFieldsRequested.push(...fieldsToRequest);
        llmFallbackUsed = true;
        const { result: llmFallbackResult, raw: llmRaw, parsed: llmParsed } = await llmKeyFactsFallback(structuredInput, fieldsToRequest);
        llmRawResponse = llmRaw;
        llmParsedResponse = llmParsed;
        for (const field of fieldsToRequest) {
          const entry = llmFallbackResult[field];
          const rawValue = entry?.value ?? "";
          const val = normVal(rawValue);
          const validation = validateKeyFactValue(field, val);
          const garbageFail = !val || isGarbageValue(val);
          const invalidFail = !garbageFail && isInvalidOrGenericValue(val, field);
          const weakFail = !garbageFail && !invalidFail && isWeakOrInvalidFieldValue(val, field);
          const notGarbage = !!val && !garbageFail && !invalidFail && !weakFail;
          const accepted = !!(entry && rawValue.trim() !== "" && validation.valid && notGarbage);
          const garbageCheckReason =
            garbageFail ? "isGarbageValue" : invalidFail ? "isInvalidOrGenericValue" : weakFail ? "isWeakOrInvalidFieldValue" : undefined;
          llmFallbackDebugPerField[field] = {
            llmWasRequested: true,
            llmRawValue: rawValue || undefined,
            llmValidated: validation.valid && notGarbage,
            llmRejectedReason: accepted ? undefined : (validation.validationReason ?? (notGarbage ? undefined : "garbage_or_invalid")),
            llmRejectedByNegativePattern: validation.rejectedByNegativePattern,
            llmRejectedByRequiredSignal: validation.rejectedByRequiredSignal,
            garbageCheckReason: accepted ? undefined : garbageCheckReason,
          };
          if (accepted) {
            keyFacts[field] = val;
            keyFactsSourceByField[field] = { sourceTextType: "normalized-global-remarks", sourcePath: "llm-fallback" };
            keyFactsExtractionDebug[field] = {
              extractionMode: "llm",
              cleanedCandidateValue: val,
              llmConfidence: entry!.confidence,
              llmReason: entry!.reason,
              llmRawValue: entry!.value,
            };
            llmFieldsAccepted.push(field);
          } else if (entry && rawValue.trim() !== "") {
            llmFieldsRejected.push(field);
          }
        }
        if (llmFieldsAccepted.length > 0) keyFactsSourceMode = "llm-fallback";
      }
    }

    let riskClauses: RiskClause[] = [];
    let llmResult: { ok: boolean; data?: LlmOut; raw?: string; mode: "responses" | "chat" } | null = null;
    let regexFactsLegacy: KeyFacts = {};
    const legacyVortext = vortext || "";
    if (legacyVortext) {
      regexFactsLegacy = extractKeyFactsRegex(legacyVortext);
      llmResult = await llmExtract(legacyVortext);
      const llmFacts = llmResult.ok ? llmResult.data!.keyFacts : {};
      const llmConf = llmResult.ok ? llmResult.data!.keyFactConfidence : {};
      const llmRisk = llmResult.ok ? llmResult.data!.riskClauses : [];
      riskClauses = llmRisk.length ? llmRisk : fallbackRiskClausesRegex(legacyVortext);

      if (useNormalizedStructure && (Object.keys(keyFacts).length > 0 || Object.keys(keyFactsSourceByField).length > 0)) {
        const keyFactsBeforeLegacy: KeyFacts = { ...keyFacts };
        const keyFactsSourceBeforeLegacy: Record<string, { sourceTextType: VortextSourceTextType; sourcePath: string }> = { ...keyFactsSourceByField };
        for (const field of KEYSET) {
          if (keyFacts[field]) continue;
          if (keyFactsSourceByField[field]?.sourcePath === "llm-fallback") continue;
          if (keyFactsSourceByField[field]?.sourcePath?.startsWith("normalized")) continue;
          let v: string | null = null;
          let fallbackDebug: ExtractionDebugEntry = { extractionMode: "heuristic", cleanedCandidateValue: undefined };
          if (LABEL_EXTRACTION_FIELDS.includes(field)) {
            const labelResult = extractValueByLabel(legacyVortext, field);
            if (labelResult) {
              const cleaned = normVal(labelResult.value);
              if (cleaned && !isGarbageValue(cleaned) && !isInvalidOrGenericValue(cleaned, field) && !isWeakOrInvalidFieldValue(cleaned, field)) {
                v = cleaned;
                fallbackDebug = {
                  extractionMode: "label",
                  matchedLabel: labelResult.matchedLabel,
                  rawMatchedText: labelResult.rawMatchedText,
                  cleanedCandidateValue: cleaned,
                };
              }
            }
          }
          if (!v) {
            const fromRegex = normVal(regexFactsLegacy[field] ?? "");
            const fromLlm = normVal(llmFacts[field] ?? "");
            const conf = clamp01(llmConf[field] ?? 0);
            v = fromRegex;
            if (LLM_PREFERRED_FIELDS.has(field) && fromLlm && conf >= 0.55 && (isGarbageValue(fromRegex) || !fromRegex)) v = fromLlm;
            else if (!v && fromLlm && conf >= 0.55) v = fromLlm;
            fallbackDebug.cleanedCandidateValue = v ?? undefined;
          }
          if (!v || isGarbageValue(v) || isInvalidOrGenericValue(v, field) || isWeakOrInvalidFieldValue(v, field)) continue;
          keyFacts[field] = v;
          keyFactsSourceByField[field] = { sourceTextType: "legacy-preface-text", sourcePath: "legacy-fallback" };
          if (!keyFactsExtractionDebug[field]) keyFactsExtractionDebug[field] = fallbackDebug;
        }
        if (Object.keys(keyFacts).length > 0) {
          keyFacts = await llmRepairKeyFacts(legacyVortext, keyFacts);
          for (const k of Object.keys(keyFacts)) {
            if (llmFieldsAccepted.includes(k as KeyFactKey)) continue;
            if (isGarbageValue(keyFacts[k]) || isInvalidOrGenericValue(keyFacts[k], k) || isWeakOrInvalidFieldValue(keyFacts[k], k)) delete keyFacts[k], delete keyFactsSourceByField[k];
          }
        }
        for (const field of Object.keys(keyFacts)) {
          const src = keyFactsSourceByField[field]?.sourcePath ?? "unknown";
          mergeWinnerPerField[field] = src;
          const hadBefore = keyFactsBeforeLegacy[field] != null && String(keyFactsBeforeLegacy[field] ?? "").trim() !== "";
          const srcBefore = keyFactsSourceBeforeLegacy[field]?.sourcePath;
          const wasNonLegacy = srcBefore && srcBefore !== "legacy-fallback";
          if (src === "legacy-fallback" && hadBefore && wasNonLegacy) {
            overwrittenByLegacy[field] = true;
            previousValueBeforeLegacyMerge[field] = String(keyFactsBeforeLegacy[field] ?? "").trim();
          } else {
            overwrittenByLegacy[field] = false;
          }
        }
        keyFactsSourceMode = Object.values(keyFactsSourceByField).some((s) => s.sourcePath === "legacy-fallback") ? "mixed" : "normalized-structure";
      } else {
        keyFacts = mergeKeyFactsPreferRegex(regexFactsLegacy, llmFacts, llmConf);
        if (Object.keys(keyFacts).length > 0) keyFacts = await llmRepairKeyFacts(legacyVortext, keyFacts);
        for (const [field, val] of Object.entries(keyFacts)) {
          keyFactsSourceByField[field] = { sourceTextType: vortextSource.sourceTextType, sourcePath: vortextSource.sourcePath };
          keyFactsExtractionDebug[field] = { extractionMode: "heuristic", cleanedCandidateValue: val };
        }
        keyFactsSourceMode = vortextSource.keyFactsSourceMode;
      }
    } else if (useNormalizedStructure && Object.keys(keyFacts).length > 0) {
      keyFactsSourceMode = "normalized-structure";
    }

    for (const k of Object.keys(keyFacts)) {
      if (llmFieldsAccepted.includes(k as KeyFactKey)) continue;
      if (isGarbageValue(keyFacts[k]) || isInvalidOrGenericValue(keyFacts[k], k) || isWeakOrInvalidFieldValue(keyFacts[k], k)) delete keyFacts[k], delete keyFactsSourceByField[k];
    }

    if (llmFallbackUsed && llmFieldsAccepted.length > 0) keyFactsSourceMode = "llm-fallback";

    for (const field of Object.keys(keyFacts)) {
      mergeWinnerPerField[field] = keyFactsSourceByField[field]?.sourcePath ?? "unknown";
    }

    const keyFactConfidenceOut: KeyFactConfidence = {};
    for (const [k, val] of Object.entries(keyFacts)) {
      keyFactConfidenceOut[k] = keyFactsSourceByField[k]?.sourcePath === "legacy-fallback" ? 0.75 : 0.85;
    }

    const keyFactsWithSource: KeyFactWithSource[] = Object.entries(keyFacts).map(([field, value]) => {
      const v = String(value ?? "");
      const valResult = validateKeyFactValue(field, v);
      const ext = keyFactsExtractionDebug[field];
      const out: KeyFactWithSource = {
        field,
        value: v,
        sourceTextType: keyFactsSourceByField[field]?.sourceTextType ?? vortextSource.sourceTextType,
        sourcePath: keyFactsSourceByField[field]?.sourcePath ?? vortextSource.sourcePath,
        confidence: keyFactConfidenceOut[field] ?? 0,
        acceptedByPositivePattern: valResult.acceptedByPositivePattern,
        rejectedByNegativePattern: valResult.rejectedByNegativePattern,
        validationReason: valResult.valid ? undefined : valResult.validationReason,
        extractionMode: ext?.extractionMode ?? "heuristic",
        matchedLabel: ext?.matchedLabel,
        rawMatchedText: ext?.rawMatchedText,
        cleanedCandidateValue: ext?.cleanedCandidateValue,
      };
      if (ext?.extractionMode === "llm") {
        out.llmConfidence = ext.llmConfidence;
        out.llmReason = ext.llmReason;
        out.llmRawValue = ext.llmRawValue;
      }
      return out;
    });

    return NextResponse.json(
      {
        riskClauses,
        keyFacts,
        keyFactConfidence: keyFactConfidenceOut,
        keyFactsDebug: {
          mode: llmResult?.mode,
          llmOk: llmResult?.ok,
          regexFound: Object.keys(regexFactsLegacy),
          llmRawPreview: llmResult?.raw ? String(llmResult.raw).slice(0, 260) : "",
          filteredLowConfidence: true,
          repairApplied: true,
          keyFactsSourceMode,
          keyFactsWithSource,
          llmFallbackUsed,
          llmFieldsRequested,
          llmFieldsAccepted,
          llmFieldsRejected,
          llmRawResponse,
          llmParsedResponse,
          llmFallbackDebugPerField,
          mergeWinnerPerField,
          overwrittenByLegacy,
          previousValueBeforeLegacyMerge,
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
