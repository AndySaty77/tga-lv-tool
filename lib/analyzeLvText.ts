import { PRESET_FINDINGS } from "./findingsPresets";
import { stripEmbeddedBinaryAndBase64Artifacts } from "./sanitizeAnalysisText";
import { Finding, Severity, ScoreCategory } from "./scoring";
import { dedupeUserHints, MAX_PRUEF_HINWEISE_STANDARD } from "./userHintsForFinding";
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
  /** Optional: kurzer Prüfhinweis für die Analyse-UI (read-only), ohne Engine-Logik. */
  user_hint?: string | null;
  question_template: string | null;
  offer_text_template: string | null;
  is_active: boolean;
  /** Optional: "vortext_only" = nur im Vortext matchen (weniger False Positives) */
  match_scope?: string | null;
  /** Optional: Trigger feuert nur, wenn mindestens ein Begriff in der Fenster-Umgebung des Keyword-Treffers vorkommt */
  context_required?: string[] | null;
  /** Optional: Trigger feuert nicht, wenn einer dieser Begriffe im Fenster um den Keyword-Treffer vorkommt */
  exclude_keywords?: string[] | null;
  /** Optional: erlaubte Gewerke/Disziplinen für diesen Trigger (z. B. "elektro", "sanitaer", "global"). */
  disciplines?: string[] | null;
};

/** Debug-Info pro ausgewertetem Trigger (gefeuert oder verhindert). */
export type TriggerEvaluation = {
  triggerId: string;
  name: string;
  fired: boolean;
  matchedKeyword?: string;
  matchedContext?: string;
  excludedBy?: string;
  reason: string;
};

// ===================== Text Preprocessing =====================

/**
 * Entfernt XML/GAEB-Ballast, damit Trigger nicht auf Tags/Metadaten feuern.
 * MVP, aber wirkt sofort.
 */
function preprocessLvText(input: string): string {
  let t = input ?? "";
  t = stripEmbeddedBinaryAndBase64Artifacts(t);

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

/** Zeichenfenster um Keyword-Treffer für context_required / exclude_keywords (±250 Zeichen). */
const WINDOW_CHARS = 250;

function getContextAt(text: string, index: number): string {
  const start = Math.max(0, index - CONTEXT_CHARS);
  const end = Math.min(text.length, index + CONTEXT_CHARS);
  return text.slice(start, end);
}

function getTextWindow(text: string, matchStart: number, matchLength: number): string {
  const start = Math.max(0, matchStart - WINDOW_CHARS);
  const end = Math.min(text.length, matchStart + matchLength + WINDOW_CHARS);
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

type MatchPosition = { index: number; length: number; matchedKeyword: string };

/**
 * Liefert alle Keyword-/Regex-Treffer mit Position (für Fenster-Logik).
 * Nur Treffer in sinnvollem Kontext (wie bisher).
 */
function getMatchPositions(text: string, trigger: DbTrigger): MatchPosition[] {
  const positions: MatchPosition[] = [];

  // 1) Regex
  if (trigger.regex && trigger.regex.trim().length > 0) {
    try {
      const re = new RegExp(trigger.regex, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const ctx = getContextAt(text, m.index);
        if (isLikelyRelevantContext(ctx) || SIGNAL_WORDS.test(ctx)) {
          positions.push({ index: m.index, length: m[0].length, matchedKeyword: m[0] });
        }
      }
      if (positions.length) return positions;
    } catch {
      // ignore
    }
  }

  // 2) Keywords
  const kws = Array.isArray(trigger.keywords) ? trigger.keywords : [];
  const lower = text.toLowerCase();

  for (const raw of kws) {
    if (!isUsableKeyword(raw)) continue;
    const kw = raw.trim().toLowerCase();

    if (kw.includes(" ")) {
      let idx = lower.indexOf(kw);
      while (idx >= 0) {
        const ctx = getContextAt(text, idx);
        if (isLikelyRelevantContext(ctx) || SIGNAL_WORDS.test(ctx)) {
          positions.push({ index: idx, length: kw.length, matchedKeyword: raw.trim() });
        }
        idx = lower.indexOf(kw, idx + 1);
      }
      continue;
    }

    const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      const ctx = getContextAt(text, m.index);
      if (isLikelyRelevantContext(ctx) || SIGNAL_WORDS.test(ctx)) {
        positions.push({ index: m.index, length: m[0].length, matchedKeyword: raw.trim() });
      }
    }
  }

  return positions;
}

/** Prüft, ob im Fenster mindestens ein Begriff aus terms vorkommt (Substring, case-insensitive). */
function windowContainsAny(window: string, terms: string[]): { found: boolean; matched?: string } {
  const w = window.toLowerCase();
  for (const t of terms) {
    const term = (t ?? "").trim();
    if (!term) continue;
    if (w.includes(term.toLowerCase())) return { found: true, matched: term };
    const wordRe = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
    if (wordRe.test(window)) return { found: true, matched: term };
  }
  return { found: false };
}

export type TriggerEvalResult = {
  fire: boolean;
  hits: number;
  matchedKeyword?: string;
  matchedContext?: string;
  excludedBy?: string;
  reason: string;
  /** Erster gültiger Treffer: Position im Text (für raw_excerpt). */
  firstMatchIndex?: number;
  firstMatchLength?: number;
};

/**
 * Neue Match-Logik mit Fenster (±WINDOW_CHARS):
 * 1. Mindestens ein Keyword-Treffer nötig.
 * 2. Wenn context_required befüllt: mindestens ein Begriff im Fenster um einen Treffer.
 * 3. Wenn exclude_keywords im Fenster: dieser Treffer zählt nicht; Trigger feuert nur, wenn es einen Treffer ohne Ausschluss gibt.
 * Leere/null context_required oder exclude_keywords = rückwärtskompatibel (Check entfällt).
 */
function evaluateTrigger(text: string, trigger: DbTrigger): TriggerEvalResult {
  const positions = getMatchPositions(text, trigger);
  if (positions.length === 0) {
    return { fire: false, hits: 0, reason: "kein Keyword-Treffer" };
  }

  const contextRequired = (Array.isArray(trigger.context_required) ? trigger.context_required : []).filter(
    (s) => (s ?? "").trim().length > 0
  );
  const excludeKeywords = (Array.isArray(trigger.exclude_keywords) ? trigger.exclude_keywords : []).filter(
    (s) => (s ?? "").trim().length > 0
  );

  let validHits = 0;
  let firstValid: { keyword: string; context?: string; index: number; length: number } | null = null;
  let lastExcludedBy: string | undefined;
  let lastMissingContext = false;

  for (const pos of positions) {
    const window = getTextWindow(text, pos.index, pos.length);

    if (excludeKeywords.length) {
      const ex = windowContainsAny(window, excludeKeywords);
      if (ex.found) {
        lastExcludedBy = ex.matched;
        continue;
      }
    }

    if (contextRequired.length) {
      const ctx = windowContainsAny(window, contextRequired);
      if (!ctx.found) {
        lastMissingContext = true;
        continue;
      }
      validHits++;
      if (!firstValid) firstValid = { keyword: pos.matchedKeyword, context: ctx.matched, index: pos.index, length: pos.length };
    } else {
      validHits++;
      if (!firstValid) firstValid = { keyword: pos.matchedKeyword, index: pos.index, length: pos.length };
    }
  }

  if (validHits > 0 && firstValid) {
    return {
      fire: true,
      hits: validHits,
      matchedKeyword: firstValid.keyword,
      matchedContext: firstValid.context,
      firstMatchIndex: firstValid.index,
      firstMatchLength: firstValid.length,
      reason: contextRequired.length
        ? "Keyword + mind. ein context_required im Fenster, kein exclude_keyword"
        : "Keyword getroffen, keine Kontext-/Ausschlussbedingung",
    };
  }

  return {
    fire: false,
    hits: 0,
    matchedKeyword: positions[0].matchedKeyword,
    matchedContext: undefined,
    excludedBy: lastExcludedBy,
    reason: lastExcludedBy
      ? `Ausschluss durch exclude_keyword: „${lastExcludedBy}" im Fenster`
      : "context_required nicht im Fenster um den Keyword-Treffer",
  };
}

/**
 * Treffer zählen (kontextbewusst) – für Rückwärtskompatibilität und SYS-Checks.
 * Nutzt keine Fenster-/context/exclude-Logik.
 */
function computeHits(text: string, trigger: DbTrigger): number {
  const positions = getMatchPositions(text, trigger);
  return clamp(positions.length, 0, 50);
}

// ===== Mapping: Supabase Kategorie -> Scoring Kategorie =====
const mapSupabaseCategoryToScore = (catRaw: string): ScoreCategory => {
  const c = (catRaw ?? "").trim().toLowerCase();

  if (c.includes("technische") && c.includes("voll")) return "vollstaendigkeit";
  if (c.includes("mengen")) return "mengen_schnittstellen";
  if (c.includes("massenermittlung") || c.includes("massenermittle")) return "mengen_schnittstellen";
  if (c.includes("schnittstellen") || c.includes("nebenleistungen")) return "mengen_schnittstellen";
  if (c.includes("vertrag") || c.includes("lv-risiko") || c.includes("lv risiko")) return "vortext";
  // Kalkulationsunsicherheit (5er) → 6er "kalkulation", damit mapCategoryTo5 auf kalkulationsunsicherheit mappt
  if (c.includes("kalkulation")) return "kalkulation";
  if (c.includes("unsicherheit")) return "nachtrag";
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
  vortext?: string,
  collectEvaluations?: TriggerEvaluation[]
): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const t of triggers) {
    if (!t.is_active) continue;

    const textToUse = getTextForTrigger(cleanText, vortext ? preprocessLvText(vortext) : undefined, t);
    const evalResult = evaluateTrigger(textToUse, t);

    if (collectEvaluations && (evalResult.fire || evalResult.matchedKeyword)) {
      collectEvaluations.push({
        triggerId: t.id,
        name: t.name,
        fired: evalResult.fire,
        matchedKeyword: evalResult.matchedKeyword,
        matchedContext: evalResult.matchedContext,
        excludedBy: evalResult.excludedBy,
        reason: evalResult.reason,
      });
    }

    if (!evalResult.fire || evalResult.hits <= 0) continue;

    const id = `DB_${t.id}`;

    if (dedupeMode === "per_trigger") {
      if (seen.has(id)) continue;
      seen.add(id);
    }

    const hits = evalResult.hits;
    const base = Number(t.weight ?? 0);
    const mult = frequencyMultiplier(hits);
    const finalPenalty = Math.round(base * mult);

    const detailParts: string[] = [];
    if (t.description) detailParts.push(t.description);
    detailParts.push(`Treffer: ${hits}`);
    if (evalResult.matchedKeyword) detailParts.push(`Keyword: ${evalResult.matchedKeyword}`);
    if (evalResult.matchedContext) detailParts.push(`Kontext: ${evalResult.matchedContext}`);
    detailParts.push(`Basis: ${base} | Faktor: ${mult.toFixed(2)} | Penalty: ${finalPenalty}`);
    if (t.risk_interpretation) detailParts.push(`Risiko: ${t.risk_interpretation}`);
    if (t.claim_level) detailParts.push(`Claim-Level: ${t.claim_level}`);
    if (t.norms && t.norms.length) detailParts.push(`Normen: ${t.norms.join(", ")}`);

    const raw_excerpt =
      evalResult.firstMatchIndex != null &&
      evalResult.firstMatchLength != null &&
      Number.isFinite(evalResult.firstMatchIndex) &&
      Number.isFinite(evalResult.firstMatchLength)
        ? getTextWindow(textToUse, evalResult.firstMatchIndex, evalResult.firstMatchLength)
        : undefined;

    const hints = dedupeUserHints([t.user_hint], MAX_PRUEF_HINWEISE_STANDARD);
    findings.push({
      id,
      category: mapSupabaseCategoryToScore(t.category),
      title: t.name,
      severity: severityFromWeight(finalPenalty),
      penalty: finalPenalty,
      detail: detailParts.join(" | "),
      ...(raw_excerpt != null && raw_excerpt.length > 0 ? { raw_excerpt } : {}),
      ...(hints.length
        ? { user_hint: hints[0], user_hints: hints }
        : {}),
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
    const maxPenalty = Math.max(...group.map((g) => g.penalty));
    const penalty = clamp(maxPenalty + Math.floor((group.length - 1) * 2), 0, 20);
    const ids = group.map((g) => g.id.replace(/^DB_/, "")).slice(0, 5);
    const hintPool: string[] = [];
    for (const g of group) {
      if (g.user_hints?.length) hintPool.push(...g.user_hints);
      else if (g.user_hint?.trim()) hintPool.push(g.user_hint.trim());
    }
    const mergedHints = dedupeUserHints(hintPool, MAX_PRUEF_HINWEISE_STANDARD);
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
      ...(first.raw_excerpt != null && { raw_excerpt: first.raw_excerpt }),
      ...(mergedHints.length ? { user_hint: mergedHints[0], user_hints: mergedHints } : {}),
    });
  }

  return [...otherFindings, ...unmerged, ...merged];
}

// ===================== Discipline-Scope für SYS-Checks =====================

/** Gewerke, für die Sanitär-spezifische SYS-Checks (DIN 1988, EN 1717, Druckprüfung, Spülung) laufen dürfen. */
const SANITAER_SYS_CHECK_DISCIPLINES = ["sanitaer"];

/**
 * Prüft, ob Sanitär-SYS-Checks ausgeführt werden sollen.
 * Konservativ: nur wenn allowDisciplines explizit "sanitaer" enthält.
 * Leer/undefined → false (keine False Positives in gewerkefremden LVs).
 */
function shouldRunSanitaerSysChecks(allowDisciplines: string[] | undefined): boolean {
  if (!allowDisciplines || allowDisciplines.length === 0) return false;
  const lower = allowDisciplines.map((d) => String(d).toLowerCase());
  return SANITAER_SYS_CHECK_DISCIPLINES.some((d) => lower.includes(d));
}

// ===================== Hauptfunktion =====================

export type AnalyzeLvTextOptions = {
  vortext?: string;
  /** Erkannte Gewerke (z. B. aus detectDisciplines). SYS-Checks mit Gewerk-Scope laufen nur bei passendem Eintrag. */
  allowDisciplines?: string[];
  /** Optional: Array zum Sammeln der Trigger-Evaluationen (für Debug: keyword/context/excludedBy/reason). */
  collectTriggerEvaluations?: TriggerEvaluation[];
};

export function analyzeLvText(
  lvTextRaw: string,
  dbTriggers: DbTrigger[] = [],
  opts?: AnalyzeLvTextOptions
): Finding[] {
  const raw = lvTextRaw ?? "";
  const text = preprocessLvText(raw);
  const findings: Finding[] = [];

  // 0) DB Trigger (mit Fenster-Logik: context_required / exclude_keywords)
  if (dbTriggers.length) {
    const dbFindings = applyDbTriggers(
      text,
      dbTriggers,
      DEFAULT_DEDUPE_MODE,
      opts?.vortext,
      opts?.collectTriggerEvaluations
    );
    findings.push(...mergeSimilarFindings(dbFindings));
  }

  // 1) System/Baseline Checks (nur in fachlich passenden Gewerken)
  const runSanitaerSysChecks = shouldRunSanitaerSysChecks(opts?.allowDisciplines);

  if (runSanitaerSysChecks) {
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
        category: "vollstaendigkeit",
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
  }

  // Strang A: Weichwörter-Finding für Score (Kategorie „nachtrag“ → vertrags_lv_risiken). Nicht verwechseln mit Strang B (echtes Nachtragspotenzial /api/change-order-analysis).
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
