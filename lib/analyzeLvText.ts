import { PRESET_FINDINGS } from "./findingsPresets";
import { Finding, Severity, ScoreCategory } from "./scoring";
import { NACHTRAG_SCHWELLEN, NACHTRAG_WEICHWOERTER } from "./scoringConfig";

// ===== DB Trigger Typ (entspricht deiner Supabase-Tabelle) =====
export type DbTrigger = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  trigger_type: string | null;
  keywords: string[] | null;
  regex: string | null;
  norms: string[] | null;
  weight: number;
  claim_level: string | null;
  risk_interpretation: string | null;
  question_template: string | null;
  offer_text_template: string | null;
  is_active: boolean;
  /** Optional: "vortext_only" = nur im Vortext matchen (weniger False Positives) */
  match_scope?: string | null;
};

// ===================== Text Preprocessing =====================

/**
 * Entfernt XML/GAEB-Ballast, damit Trigger nicht auf Tags/Metadaten feuern.
 * MVP, aber wirkt sofort.
 */
function preprocessLvText(input: string): string {
  let t = input ?? "";

  // Kommentare raus
  t = t.replace(/<!--[\s\S]*?-->/g, " ");

  // XML Tags raus
  t = t.replace(/<[^>]+>/g, " ");

  // Entities grob normalisieren
  t = t.replace(/&nbsp;|&#160;/gi, " ");
  t = t.replace(/&amp;/gi, "&");
  t = t.replace(/&lt;/gi, "<");
  t = t.replace(/&gt;/gi, ">");
  t = t.replace(/&quot;/gi, '"');
  t = t.replace(/&apos;/gi, "'");

  // typische GAEB Header Tokens entschärfen (sonst feuern generische Keywords)
  t = t.replace(/\b(gaeb|gaebinfo|version|versdate|progsystem|progname|date|time|xmlns)\b/gi, " ");

  // whitespace glätten
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

// ===================== Helpers =====================

const hasAny = (text: string, patterns: Array<string | RegExp>) => {
  const t = text.toLowerCase();
  return patterns.some((p) => (p instanceof RegExp ? p.test(text) : t.includes(p.toLowerCase())));
};

const severityFromWeight = (weight: number): Severity => {
  if (weight >= 8) return "high";
  if (weight >= 4) return "medium";
  return "low";
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Frequency Scaling:
 * - verhindert Score-Explosion bei vielen Treffern
 * - cap bei 2.0 (= max 200% vom Basisgewicht)
 */
function frequencyMultiplier(hits: number) {
  if (hits <= 1) return 1;
  const mult = 1 + Math.log10(hits) * 0.6; // 2->~1.18, 10->~1.6, 100->~2.2
  return clamp(mult, 1, 2.0);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Keywords härten:
 * - ignoriert zu kurze/zu generische Tokens
 * - ignoriert reine Zahlen
 */
function isUsableKeyword(raw: string) {
  const kw = (raw ?? "").trim();
  if (!kw) return false;

  const lower = kw.toLowerCase();

  // zu kurz -> praktisch immer false positives in XML/LV
  if (lower.length < 4) return false;

  // reine Zahl
  if (/^\d+([.,]\d+)?$/.test(lower)) return false;

  // harte Stopwords (erweiterbar)
  const stopwords = [
    "pos", "position", "stück", "stk", "m2", "m3", "m", "dn", "en", "din", "iso", "mm", "cm",
    "rep", "ref", "stlb", "bau", "yes", "no", "aaa", "od", "id",
  ];
  if (stopwords.includes(lower)) return false;

  return true;
}

/** Kontext um Treffer: prüft ob Match in „sinnvollem" Text oder in Zahl-/Code-Block */
const CONTEXT_CHARS = 120;
const DIGIT_RATIO_THRESHOLD = 0.45;

function getContextAt(text: string, index: number): string {
  const start = Math.max(0, index - CONTEXT_CHARS);
  const end = Math.min(text.length, index + CONTEXT_CHARS);
  return text.slice(start, end);
}

function isLikelyRelevantContext(context: string): boolean {
  const digits = (context.match(/\d/g) ?? []).length;
  const letters = (context.match(/[a-zA-ZäöüÄÖÜß]/g) ?? []).length;
  const total = context.replace(/\s/g, "").length;
  if (total < 10) return true;
  const digitRatio = digits / total;
  if (digitRatio > DIGIT_RATIO_THRESHOLD) return false;
  const letterRatio = letters / total;
  if (letterRatio < 0.2) return false;
  return true;
}

const SIGNAL_WORDS = /\b(unklar|nicht\s+definiert|fehlt|nicht\s+eindeutig|ohne\s+angabe|siehe\s+position|nicht\s+genannt)\b/i;

/**
 * Treffer zählen (kontextbewusst):
 * - Regex: nur Treffer in sinnvollem Kontext (keine reinen Zahlblöcke)
 * - Keywords: Wortgrenzen, Phrase-Match, Kontextprüfung
 * - Signal-Wörter (unklar, nicht definiert) im Kontext = relevanter Treffer
 */
function computeHits(text: string, trigger: DbTrigger): number {
  let hits = 0;

  // 1) Trigger-Regex (präzise, kontextbewusst)
  if (trigger.regex && trigger.regex.trim().length > 0) {
    try {
      const re = new RegExp(trigger.regex, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const ctx = getContextAt(text, m.index);
        if (isLikelyRelevantContext(ctx) || SIGNAL_WORDS.test(ctx)) hits += 1;
      }
      if (hits > 0) return clamp(hits, 0, 50);
    } catch {
      // ignore
    }
  }

  // 2) Keywords (gehärtet, kontextbewusst)
  const kws = Array.isArray(trigger.keywords) ? trigger.keywords : [];
  if (!kws.length) return 0;

  const lower = text.toLowerCase();

  for (const raw of kws) {
    if (!isUsableKeyword(raw)) continue;

    const kw = raw.trim().toLowerCase();

    if (kw.includes(" ")) {
      let idx = lower.indexOf(kw);
      while (idx >= 0) {
        const ctx = getContextAt(text, idx);
        if (isLikelyRelevantContext(ctx) || SIGNAL_WORDS.test(ctx)) hits += 1;
        idx = lower.indexOf(kw, idx + 1);
      }
      continue;
    }

    const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      const ctx = getContextAt(text, m.index);
      if (isLikelyRelevantContext(ctx) || SIGNAL_WORDS.test(ctx)) hits += 1;
    }
  }

  return clamp(hits, 0, 50);
}

// ===== Mapping: Supabase Kategorie -> Scoring Kategorie =====
const mapSupabaseCategoryToScore = (catRaw: string): ScoreCategory => {
  const c = (catRaw ?? "").trim().toLowerCase();

  if (c.includes("technische") && c.includes("voll")) return "vollstaendigkeit";
  if (c.includes("mengen")) return "mengen_schnittstellen";
  if (c.includes("massenermittlung") || c.includes("massenermittle")) return "mengen_schnittstellen";
  if (c.includes("schnittstellen") || c.includes("nebenleistungen")) return "mengen_schnittstellen";
  if (c.includes("vertrag") || c.includes("lv-risiko") || c.includes("lv risiko")) return "vortext";
  if (c.includes("kalkulation") || c.includes("unsicherheit")) return "nachtrag";
  if (c.includes("norm")) return "normen";

  return "ausfuehrung";
};

type DedupeMode = "per_trigger" | "none";
const DEFAULT_DEDUPE_MODE: DedupeMode = "per_trigger";

function getTextForTrigger(
  fullText: string,
  vortext: string | undefined,
  trigger: DbTrigger
): string {
  const scope = (trigger.match_scope ?? "").toString().toLowerCase();
  if (scope === "vortext_only" && vortext && vortext.trim().length > 100) {
    return vortext;
  }
  if (/vertrag|vortext|lv.risiko/.test((trigger.category ?? "").toLowerCase()) && vortext && vortext.length > 200) {
    return vortext;
  }
  return fullText;
}

function applyDbTriggers(
  cleanText: string,
  triggers: DbTrigger[],
  dedupeMode: DedupeMode,
  vortext?: string
): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const t of triggers) {
    if (!t.is_active) continue;

    const textToUse = getTextForTrigger(cleanText, vortext ? preprocessLvText(vortext) : undefined, t);
    const hits = computeHits(textToUse, t);
    if (hits <= 0) continue;

    const id = `DB_${t.id}`;

    if (dedupeMode === "per_trigger") {
      if (seen.has(id)) continue;
      seen.add(id);
    }

    const base = Number(t.weight ?? 0);
    const mult = frequencyMultiplier(hits);
    const finalPenalty = Math.round(base * mult);

    const detailParts: string[] = [];
    if (t.description) detailParts.push(t.description);
    detailParts.push(`Treffer: ${hits}`);
    detailParts.push(`Basis: ${base} | Faktor: ${mult.toFixed(2)} | Penalty: ${finalPenalty}`);
    if (t.risk_interpretation) detailParts.push(`Risiko: ${t.risk_interpretation}`);
    if (t.claim_level) detailParts.push(`Claim-Level: ${t.claim_level}`);
    if (t.norms && t.norms.length) detailParts.push(`Normen: ${t.norms.join(", ")}`);

    findings.push({
      id,
      category: mapSupabaseCategoryToScore(t.category),
      title: t.name,
      severity: severityFromWeight(finalPenalty),
      penalty: finalPenalty,
      detail: detailParts.join(" | "),
    });
  }

  return findings;
}

// ===================== Merge ähnlicher Findings =====================

/** Muster für Zusammenführung: gleicher Merge-Key = ein Finding */
const MERGE_PATTERNS: Array<{ pattern: RegExp; mergedTitle: string }> = [
  {
    pattern: /(?:Wartung\/Intervall|Wartung)\s*(?:für\s+)?Armaturengruppe\s+\d+/i,
    mergedTitle: "Sanitär-Detail: Wartung/Intervall für Armaturengruppen unklar",
  },
  {
    pattern: /Armaturengruppe\s+\d+\s*[Uu]nklar/i,
    mergedTitle: "Armaturengruppen: Unklare Anforderungen (mehrere Gruppen)",
  },
];

function getMergedTitle(f: Finding): string | null {
  for (const { pattern, mergedTitle } of MERGE_PATTERNS) {
    if (pattern.test(f.title)) return mergedTitle;
  }
  return null;
}

/**
 * Fasst ähnliche DB-Findings zusammen (z. B. "Armaturengruppe 03/09/11 unklar" → ein Finding).
 */
function mergeSimilarFindings(findings: Finding[]): Finding[] {
  const dbFindings = findings.filter((f) => f.id.startsWith("DB_"));
  const otherFindings = findings.filter((f) => !f.id.startsWith("DB_"));

  const groups = new Map<string, Finding[]>();
  const unmerged: Finding[] = [];

  for (const f of dbFindings) {
    const mergedTitle = getMergedTitle(f);
    if (mergedTitle) {
      const key = mergedTitle;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    } else {
      unmerged.push(f);
    }
  }

  const merged: Finding[] = [];
  for (const [key, group] of groups) {
    if (group.length === 0) continue;
    const first = group[0];
    const totalPenalty = group.reduce((s, g) => s + g.penalty, 0);
    const maxPenalty = Math.max(...group.map((g) => g.penalty));
    const penalty = clamp(maxPenalty + Math.floor((group.length - 1) * 2), 0, 20);
    const ids = group.map((g) => g.id.replace(/^DB_/, "")).slice(0, 5);
    merged.push({
      id: first.id,
      category: first.category,
      title: key,
      severity: severityFromWeight(penalty),
      penalty,
      detail: [
        `Zusammengeführt aus ${group.length} ähnlichen Triggern`,
        `IDs: ${ids.join(", ")}${group.length > 5 ? " …" : ""}`,
        first.detail,
      ]
        .filter(Boolean)
        .join(" | "),
    });
  }

  return [...otherFindings, ...unmerged, ...merged];
}

// ===================== Hauptfunktion =====================

export type AnalyzeLvTextOptions = {
  vortext?: string;
};

export function analyzeLvText(
  lvTextRaw: string,
  dbTriggers: DbTrigger[] = [],
  opts?: AnalyzeLvTextOptions
): Finding[] {
  const raw = lvTextRaw ?? "";
  const text = preprocessLvText(raw);
  const findings: Finding[] = [];

  // 0) DB Trigger (mit kontextbewusstem Matching, optional vortext_only)
  if (dbTriggers.length) {
    const dbFindings = applyDbTriggers(text, dbTriggers, DEFAULT_DEDUPE_MODE, opts?.vortext);
    findings.push(...mergeSimilarFindings(dbFindings));
  }

  // 1) System/Baseline Checks (auf bereinigtem Text!)
  const hasDIN1988 = hasAny(text, ["din 1988", "din1988"]);
  const hasEN1717 = hasAny(text, ["din en 1717", "en 1717"]);

  if (!hasDIN1988)
    findings.push({
      ...PRESET_FINDINGS.DIN_1988_FEHLT(),
      id: "SYS_DIN_1988_FEHLT",
    });

  if (!hasEN1717)
    findings.push({
      id: "SYS_DIN_EN_1717_FEHLT",
      category: "normen",
      title: "DIN EN 1717 nicht genannt (Trinkwasserschutz)",
      severity: "high",
      penalty: 5,
    });

  const hasDruckpruefung = hasAny(text, ["druckprüfung", "druckprobe", /druck\s*prüf/i]);
  const hasSpuelung = hasAny(text, ["spül", "spuel", "spülprotokoll", "spuelprotokoll"]);

  if (!hasDruckpruefung)
    findings.push({
      ...PRESET_FINDINGS.DRUCKPRUEFUNG_UNKLAR(),
      id: "SYS_DRUCKPRUEFUNG_UNKLAR",
    });

  if (!hasSpuelung)
    findings.push({
      id: "SYS_SPUELUNG_FEHLT",
      category: "vollstaendigkeit",
      title: "Spülung/Spülprotokoll nicht eindeutig beschrieben",
      severity: "high",
      penalty: 6,
    });

  // Nachtrag-/Weichwörter (aus zentraler Konfiguration)
  const lower = text.toLowerCase();
  const countNachtrag = NACHTRAG_WEICHWOERTER.reduce(
    (acc, w) => acc + (lower.split(w).length - 1),
    0
  );

  if (countNachtrag >= NACHTRAG_SCHWELLEN.minFindings) {
    const mult = frequencyMultiplier(countNachtrag);
    const penalty = clamp(
      Math.round(NACHTRAG_SCHWELLEN.basePenalty * mult),
      0,
      NACHTRAG_SCHWELLEN.penaltyMax
    );

    findings.push({
      id:
        countNachtrag >= NACHTRAG_SCHWELLEN.highSeverityMin
          ? "SYS_VIELE_WEICHE_FORMULIERUNGEN"
          : "SYS_EINIGE_WEICHE_FORMULIERUNGEN",
      category: "nachtrag",
      title:
        countNachtrag >= NACHTRAG_SCHWELLEN.highSeverityMin
          ? "Viele weiche Formulierungen (bauseits/optional/nach Aufwand) → hohes Nachtragspotenzial"
          : "Mehrere weiche Formulierungen → Nachtragspotenzial",
      detail: `Trefferanzahl: ${countNachtrag} | Faktor: ${mult.toFixed(2)} | Penalty: ${penalty}`,
      severity: countNachtrag >= NACHTRAG_SCHWELLEN.highSeverityMin ? "high" : "medium",
      penalty,
    });
  }

  return findings;
}
