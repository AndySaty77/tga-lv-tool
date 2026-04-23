// app/api/score/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import { checkRateLimit } from "@/lib/rateLimit";
import { isAdmin } from "@/lib/auth/is-admin";
import { analyzeLvText, DbTrigger, TriggerEvaluation } from "../../../lib/analyzeLvText";
import { computeScore } from "../../../lib/scoring";
import { analyzeLvTextWithLLM } from "../../../lib/llmRelevanceFilter";
import {
  buildValidationInput,
  validateTriggerFindingsWithLlm,
  type TriggerFindingValidationInput,
} from "../../../lib/triggerValidationLlm";
import { FALLBACK_SCORING_CONFIG } from "../../../lib/scoringConfig";
import { stripEmbeddedBinaryAndBase64Artifacts } from "../../../lib/sanitizeAnalysisText";
import { computeNachtragV2FromLegacy, type NachtragResultV2 } from "../../../lib/nachtrag-v2";
import { buildDetectedTrades, emptyDetectedTrades } from "../../../lib/detectedTrades";
import { detectDisciplines, type DisciplineKey } from "../../../lib/disciplineDetect";
import {
  detectLegalSignals,
  legalSignalsToFindings,
  LEGAL_SIGNALS_V1_ENABLED,
  type LegalSignal,
} from "../../../lib/legal-signals";

type CategoryKey =
  | "vertrags_lv_risiken"
  | "mengen_massenermittlung"
  | "technische_vollstaendigkeit"
  | "schnittstellen_nebenleistungen"
  | "kalkulationsunsicherheit";

const CATEGORY_KEYS: CategoryKey[] = [
  "vertrags_lv_risiken",
  "mengen_massenermittlung",
  "technische_vollstaendigkeit",
  "schnittstellen_nebenleistungen",
  "kalkulationsunsicherheit",
];

function isCategoryKey(v: string): v is CategoryKey {
  return (CATEGORY_KEYS as string[]).includes(v);
}

/**
 * Alte Baseline-Kategorien -> 5 Ziel-Kategorien.
 */
function mapCategoryTo5(cat: string, title?: string, detail?: string): CategoryKey {
  const c = String(cat ?? "").trim();
  const text = `${title ?? ""} ${detail ?? ""}`.toLowerCase();

  if (isCategoryKey(c)) return c;

  if (c === "normen") return "vertrags_lv_risiken";
  if (c === "vollstaendigkeit") return "technische_vollstaendigkeit";
  if (c === "vortext") return "vertrags_lv_risiken";
  // Strang A: Weichwörter-Finding (nachtrag) → vertrags_lv_risiken; echtes Nachtragspotenzial (Strang B) ist getrennt.
  if (c === "nachtrag") return "vertrags_lv_risiken";
  if (c === "kalkulation") return "kalkulationsunsicherheit";
  if (c === "ausfuehrung") return "technische_vollstaendigkeit";

  if (c === "mengen_schnittstellen") {
    if (
      /schnittstelle|bauseits|gewerk|abgrenz|koordin|msr|elt|elektro|gu\b|bauherr|vorleistung|bim|planer|liefergrenze/.test(
        text
      )
    ) {
      return "schnittstellen_nebenleistungen";
    }
    if (/mengen|masse|aufmaß|pauschal|einheit|pos\.|position|meter|stück|kg|m2|m3/.test(text)) {
      return "mengen_massenermittlung";
    }
    return "mengen_massenermittlung";
  }

  return "vertrags_lv_risiken";
}

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

/** ---------- Scoring Config (DB) ---------- */

type ScoringConfig = {
  version: number;
  catMax: Record<CategoryKey, number>;
  lvSize: { baseDivisor: number; maxBoost: number };
  easing: { type: "sqrt" | "linear" };
  total: { method: "mean" };
};

const FALLBACK_CONFIG: ScoringConfig = FALLBACK_SCORING_CONFIG as ScoringConfig;

async function getScoringConfig(
  supabase: ReturnType<typeof supabaseServer> | null
): Promise<ScoringConfig> {
  if (!supabase) return FALLBACK_CONFIG;
  const { data, error } = await supabase
    .from("scoring_config")
    .select("value")
    .eq("key", "default")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.value) return FALLBACK_CONFIG;

  const v = data.value as any;

  const cfg: ScoringConfig = {
    version: Number(v?.version ?? FALLBACK_CONFIG.version),
    catMax: (v?.catMax ?? FALLBACK_CONFIG.catMax) as Record<CategoryKey, number>,
    lvSize: (v?.lvSize ?? FALLBACK_CONFIG.lvSize) as { baseDivisor: number; maxBoost: number },
    easing: (v?.easing ?? FALLBACK_CONFIG.easing) as { type: "sqrt" | "linear" },
    total: (v?.total ?? FALLBACK_CONFIG.total) as { method: "mean" },
  };

  for (const k of CATEGORY_KEYS) {
    if (!Number.isFinite(Number(cfg.catMax?.[k]))) cfg.catMax[k] = FALLBACK_CONFIG.catMax[k];
  }
  if (!Number.isFinite(Number(cfg.lvSize?.baseDivisor))) cfg.lvSize.baseDivisor = FALLBACK_CONFIG.lvSize.baseDivisor;
  if (!Number.isFinite(Number(cfg.lvSize?.maxBoost))) cfg.lvSize.maxBoost = FALLBACK_CONFIG.lvSize.maxBoost;
  if (cfg.easing?.type !== "sqrt" && cfg.easing?.type !== "linear") cfg.easing = FALLBACK_CONFIG.easing;
  if (cfg.total?.method !== "mean") cfg.total = FALLBACK_CONFIG.total;

  return cfg;
}

/** ---------- Utils ---------- */

function clamp0_100(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function lvSizeFactor(lvText: string, cfg: ScoringConfig) {
  const len = (lvText || "").length;
  const baseDivisor = cfg.lvSize.baseDivisor || 2000;
  const maxBoost = cfg.lvSize.maxBoost ?? 0.6;
  return 1 + Math.min(maxBoost, Math.log10(1 + len / baseDivisor));
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/score" });
}

const SCORE_RATE_LIMIT_PER_MINUTE = 5;
const SCORE_RATE_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const rl = checkRateLimit(`score:${user.id}`, SCORE_RATE_LIMIT_PER_MINUTE, SCORE_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const url = new URL(req.url);
  const debugParam = url.searchParams.get("debug") === "1";
  const isAdminUser = isAdmin(user);
  const debug = debugParam && isAdminUser;

  const body = await req.json().catch(() => ({} as any));

  // Backward compatible: lvText bleibt Pflichtfeld wie bisher
  let lvText = String((body as any)?.lvText ?? "");

  // Neu: getrennt, kommt vom LLM-Split
  let vortext = String((body as any)?.vortext ?? "");
  let positions = String((body as any)?.positions ?? "");

  lvText = stripEmbeddedBinaryAndBase64Artifacts(lvText);
  vortext = stripEmbeddedBinaryAndBase64Artifacts(vortext);
  positions = stripEmbeddedBinaryAndBase64Artifacts(positions);

  // Wichtiger Fix: für Trigger/Scoring NICHT mehr "guessen" – wenn Split da ist:
  const hasSplit = (vortext.trim().length > 0 || positions.trim().length > 0);
  const splitCombinedLen = vortext.trim().length + positions.trim().length;
  const lvLen = lvText.trim().length;

  /**
   * GAEB-Fälle: Split liefert nur wenige hundert Zeichen, das LV ist aber sehr groß →
   * Trigger/Regex matchen praktisch nichts. Dann auf bereinigtes Gesamt-`lvText` zurückfallen.
   * Schutz: greift nur bei großem LV; Verhältnis + Obergrenze vermeiden False Positives bei kleinen echten LV.
   */
  const MIN_LV_CHARS_FOR_SPLIT_FALLBACK = 20_000;
  const SPLIT_FALLBACK_MAX_EXPECTED_SHARE = 0.04;
  const SPLIT_FALLBACK_ABS_CEILING = 12_000;
  const splitTooSmallForScore =
    hasSplit &&
    lvLen >= MIN_LV_CHARS_FOR_SPLIT_FALLBACK &&
    splitCombinedLen < Math.min(SPLIT_FALLBACK_ABS_CEILING, lvLen * SPLIT_FALLBACK_MAX_EXPECTED_SHARE);

  const textForAnalysis = hasSplit
    ? splitTooSmallForScore
      ? lvText
      : [vortext, positions].filter((s) => String(s).trim().length > 0).join("\n\n")
    : lvText;

  const supabase = supabaseServer();
  const cfg = await getScoringConfig(supabase);

  const { data, error } = supabase
    ? await supabase.from("triggers").select(`
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
      user_hint,
      question_template,
      offer_text_template,
      is_active,
      disciplines,
      context_required,
      exclude_keywords
    `)
    : { data: null, error: new Error("SUPABASE_SERVICE_ROLE_KEY fehlt") };

  if (error) {
    console.error("Supabase Trigger Fehler:", error?.message ?? "Unbekannt");
  }

  // 1) Gewerke erkennen (primary + secondary) – mit Schwerpunkt auf Datei/Titel/Positionen, Logistikbegriffe entschärfen
  const fileNameForDisciplines = typeof (body as any)?.fileName === "string" ? String((body as any).fileName) : "";
  const projectNameForDisciplines = typeof (body as any)?.projectName === "string" ? String((body as any).projectName) : "";
  const disciplineBaseParts = [
    projectNameForDisciplines,
    fileNameForDisciplines,
    positions,
    vortext,
  ].filter((s) => String(s).trim().length > 0);
  let disciplineText = disciplineBaseParts.join("\n\n");
  if (!disciplineText.trim()) {
    disciplineText = textForAnalysis;
  }
  // Baustellen-/Logistikkontext für Sanitär/Abwasser aus der Gewerkeerkennung herausfiltern
  disciplineText = disciplineText
    .replace(/bauwasser/gi, " ")
    .replace(/abwasser\s+aus\s+baugrube/gi, " ")
    .replace(/baustellenentwässerung/gi, " ")
    .replace(/sanitärcontainer/gi, " ")
    .replace(/wc-?container/gi, " ")
    .replace(/baustellenversorgung/gi, " ");

  const det = detectDisciplines(disciplineText);
  const allowDisciplines = det.all; // nur primary + secondary

  // 2) Trigger filtern: NUR primary+secondary + global
  const dbTriggers: DbTrigger[] = (data ?? [])
    .filter((t: any) => (typeof t.is_active === "boolean" ? t.is_active : true))
    .filter((t: any) => {
      const td: string[] = Array.isArray(t.disciplines) ? t.disciplines : [];

      if (allowDisciplines.length) {
        if (!td.length) return false; // Legacy ohne disciplines NICHT pauschal zulassen
        return td.some((d) => d === "global" || allowDisciplines.includes(d as DisciplineKey));
      }

      // Wenn nichts erkannt: defensiv alles zulassen
      return true;
    });

  // 3) Findings erzeugen
  const useLlmRelevance = (body as any)?.useLlmRelevance === true && !!process.env.OPENAI_API_KEY;

  let findings: any[];
  let findingsBeforeLlm = 0;
  let findingsAfterLlm = 0;

  let triggerEvaluations: TriggerEvaluation[] = [];
  const runTriggerValidation = !(body as any)?.useLlmRelevance && !!process.env.OPENAI_API_KEY;
  const analyzeOpts = {
    // Bei Fallback: kein Mini-Vortext für vortext_only — sonst würde nur der künstlich kurze Split durchsucht.
    vortext: hasSplit && !splitTooSmallForScore ? vortext : undefined,
    allowDisciplines: allowDisciplines,
    ...(debug || runTriggerValidation ? { collectTriggerEvaluations: triggerEvaluations } : {}),
  };

  if (useLlmRelevance) {
    // LLM-Modus: eigene Recherche im LV-Text, Trigger werden ignoriert
    const systemFindings = analyzeLvText(textForAnalysis, [], analyzeOpts);
    const llmFindings = await analyzeLvTextWithLLM(textForAnalysis);
    findings = [...systemFindings, ...llmFindings];
    findingsBeforeLlm = systemFindings.length;
    findingsAfterLlm = findings.length;
  } else {
    // Trigger-Modus: Fenster-Logik (context_required / exclude_keywords)
    findings = analyzeLvText(textForAnalysis, dbTriggers, analyzeOpts);
    findingsBeforeLlm = findings.length;
    findingsAfterLlm = findings.length;
  }

  /** V1: additive Vertrags-/Vergabesignale (keyword-basiert, kein Ersatz für Trigger). */
  let legalSignals: LegalSignal[] = [];
  if (LEGAL_SIGNALS_V1_ENABLED) {
    const legalSource =
      hasSplit && !splitTooSmallForScore && vortext.trim().length >= 120 ? vortext : textForAnalysis;
    legalSignals = detectLegalSignals(legalSource);
    if (legalSignals.length > 0) {
      findings = [...findings, ...legalSignalsToFindings(legalSignals)];
    }
  }

  // 3b) LLM-Validierung V1: nur DB_*, penalty >= 8, max. 8, nur mit raw_excerpt (kein Fallback auf detail)
  let triggerValidationSummary: {
    total: number;
    validated: number;
    confirm: number;
    uncertain: number;
    reject: number;
  } | null = null;
  if (runTriggerValidation && (findings ?? []).length > 0) {
    const dbOnly = (findings as any[]).filter((f: any) => f.id && String(f.id).startsWith("DB_"));
    const withPenalty = dbOnly.filter((f: any) => Number(f.penalty) >= 8);
    const withExcerpt = withPenalty.filter((f: any) => typeof f.raw_excerpt === "string" && f.raw_excerpt.trim().length > 0);
    const sorted = [...withExcerpt].sort((a: any, b: any) => Number(b.penalty) - Number(a.penalty));
    const toValidate = sorted.slice(0, 8);
    const evalByTriggerId = new Map(triggerEvaluations.map((e) => [e.triggerId, e]));
    const inputs: TriggerFindingValidationInput[] = [];
    for (const f of toValidate) {
      const triggerId = String(f.id).replace(/^DB_/, "");
      const trigger = dbTriggers.find((t: DbTrigger) => t.id === triggerId);
      const eval_ = evalByTriggerId.get(triggerId);
      const input = buildValidationInput(f, {
        matched_keyword: eval_?.matchedKeyword,
        matched_context: eval_?.matchedContext,
        discipline: Array.isArray(trigger?.disciplines) ? (trigger as any).disciplines[0] : undefined,
      });
      if (input) inputs.push(input);
    }
    if (inputs.length > 0) {
      const validations = await validateTriggerFindingsWithLlm(inputs);
      triggerValidationSummary = {
        total: toValidate.length,
        validated: inputs.length,
        confirm: 0,
        uncertain: 0,
        reject: 0,
      };
      for (const v of validations) {
        if (v.validation_status === "confirm") triggerValidationSummary.confirm++;
        else if (v.validation_status === "uncertain") triggerValidationSummary.uncertain++;
        else triggerValidationSummary.reject++;
      }
      const validationByFindingId = new Map(validations.map((v) => [v.finding_id, v]));
      for (const f of findings as any[]) {
        const v = validationByFindingId.get(f.id);
        if (!v) continue;
        f.validation_status = v.validation_status;
        f.validation_confidence = v.confidence;
        f.validation_reason = v.reason;
        f.score_excluded = v.validation_status === "reject";
        if (debug) {
          f.validation_suggested_category = v.suggested_category;
          f.validation_penalty_assessment = v.penalty_assessment;
        }
      }
    }
  }

  // 4) Kategorien mappen: DB-Trigger mit 5er-Kategorie in Supabase behalten, sonst 6er→5er-Mapping
  const findingsMapped = (findings ?? []).map((f: any) => {
    let category5: CategoryKey;
    if (f.id && String(f.id).startsWith("DB_") && dbTriggers.length) {
      const triggerId = String(f.id).replace(/^DB_/, "");
      const trigger = dbTriggers.find((t: DbTrigger) => t.id === triggerId);
      if (trigger && isCategoryKey(String(trigger.category ?? "").trim())) {
        category5 = trigger.category as CategoryKey;
      } else {
        category5 = mapCategoryTo5(f.category, f.title, f.detail);
      }
    } else {
      category5 = mapCategoryTo5(f.category, f.title, f.detail);
    }
    return { ...f, category: category5 };
  });

  // 5) computeScore: nur scorewirksame Findings (reject-Findings sind score_excluded)
  const scoreRelevantFindings = (findingsMapped as any[]).filter((f: any) => !f.score_excluded);
  const result = computeScore({ findings: scoreRelevantFindings });

  // 6) Risiko-Last pro Kategorie (ABS): nur scorewirksame
  const perCategorySum: Record<CategoryKey, number> = {
    vertrags_lv_risiken: 0,
    mengen_massenermittlung: 0,
    technische_vollstaendigkeit: 0,
    schnittstellen_nebenleistungen: 0,
    kalkulationsunsicherheit: 0,
  };

  for (const f of scoreRelevantFindings) {
    const k = mapCategoryTo5(f.category, f.title, f.detail);
    const pen = Math.abs(Number(f.penalty ?? 0));
    if (!Number.isFinite(pen)) continue;
    perCategorySum[k] += pen;
  }

  const sizeF = lvSizeFactor(textForAnalysis, cfg);

  // 7) NORMALISIERTE perCategory (0..100)
  const perCategory: Record<CategoryKey, number> = {
    vertrags_lv_risiken: 0,
    mengen_massenermittlung: 0,
    technische_vollstaendigkeit: 0,
    schnittstellen_nebenleistungen: 0,
    kalkulationsunsicherheit: 0,
  };

  for (const k of CATEGORY_KEYS) {
    const sum = perCategorySum[k];
    const baseMax = cfg.catMax[k] || FALLBACK_CONFIG.catMax[k] || 60;
    const scaledMax = baseMax * sizeF;

    const ratio = clamp01(sum / scaledMax);
    const eased = cfg.easing.type === "linear" ? ratio : Math.sqrt(ratio);

    perCategory[k] = clamp0_100(eased * 100);
  }

  // TOTAL = mean
  const totalNormalized = clamp0_100(
    Math.round(
      (perCategory.vertrags_lv_risiken +
        perCategory.mengen_massenermittlung +
        perCategory.technische_vollstaendigkeit +
        perCategory.schnittstellen_nebenleistungen +
        perCategory.kalkulationsunsicherheit) / 5
    )
  );

  const detectedTrades = det.all?.length
    ? buildDetectedTrades(det)
    : emptyDetectedTrades();

  let nachtragV2: NachtragResultV2 | null = null;
  if (debug) {
    try {
      nachtragV2 = computeNachtragV2FromLegacy(findingsMapped as any, dbTriggers, {
        primaryDiscipline: det.primary,
        secondaryDisciplines: det.secondary,
      });
    } catch (e) {
      console.warn("[/api/score] Nachtrag-V2 Engine Fehler (defensiv ignoriert):", e);
      nachtragV2 = null;
    }
  }

  const json: Record<string, unknown> = {
    ...result,
    total: totalNormalized,
    perCategory,
    findingsSorted: findingsMapped,
    detectedTrades,
    ...(legalSignals.length > 0 ? { legalSignals } : {}),
    // TODO(security): internalScores/nachtragspotenzialV2 ist nur für Admins gedacht.
    // Der aktuelle Guard basiert auf ADMIN_EMAILS + ?debug=1 und ersetzt keine echte, fein granulare Rollen-/Rechteverwaltung.
    ...(nachtragV2
      ? {
          internalScores: {
            ...(result as any)?.internalScores,
            nachtragspotenzialV2: nachtragV2,
          },
        }
      : {}),
    ...(debug
      ? {
          debug: {
            splitUsed: hasSplit,
            splitFallbackToFullLv: splitTooSmallForScore,
            lens: {
              lvText: lvText.length,
              vortext: vortext.length,
              positions: positions.length,
              textForAnalysis: textForAnalysis.length,
            },
            disciplineScores: det.scores,
            detectedDisciplines: det.all,
            primaryDiscipline: det.primary,
            secondaryDisciplines: det.secondary,
            triggersUsed: useLlmRelevance ? 0 : dbTriggers.length,
            llmMode: useLlmRelevance,
            findingsBeforeLlm,
            findingsAfterLlm,
            perCategorySum,
            sizeF,
            scoringConfigVersion: cfg.version,
            easing: cfg.easing.type,
            /** Gefeuerte Findings: ID, Kategorie, Penalty, Titel, Validierung, für Transparenz-Tab ggf. raw_excerpt, matched_keyword, matched_context. */
            firedFindings: (findingsMapped as any[]).map((f: any) => {
              const triggerIdRaw = f.id && String(f.id).startsWith("DB_") ? String(f.id).replace(/^DB_/, "") : f.id;
              const eval_ = triggerEvaluations.find((e: TriggerEvaluation) => e.triggerId === triggerIdRaw);
              return {
                triggerId: f.id,
                category: mapCategoryTo5(f.category, f.title, f.detail),
                penalty: f.penalty,
                title: f.title,
                ...(f.raw_excerpt != null && f.raw_excerpt !== "" && { raw_excerpt: f.raw_excerpt }),
                ...(eval_?.matchedKeyword != null && { matched_keyword: eval_.matchedKeyword }),
                ...(eval_?.matchedContext != null && { matched_context: eval_.matchedContext }),
                ...(f.score_excluded != null && { score_excluded: f.score_excluded }),
                ...(f.validation_status != null && { validation_status: f.validation_status }),
                ...(f.validation_confidence != null && { validation_confidence: f.validation_confidence }),
                ...(f.validation_reason != null && { validation_reason: f.validation_reason }),
                ...(debug && f.validation_suggested_category != null && { validation_suggested_category: f.validation_suggested_category }),
                ...(debug && f.validation_penalty_assessment != null && { validation_penalty_assessment: f.validation_penalty_assessment }),
              };
            }),
            ...(triggerValidationSummary && {
              triggerValidation: triggerValidationSummary,
            }),
            /** Pro Trigger: ob gefeuert/verhindert, getroffenes Keyword, Kontext, exclude_keyword, Begründung. */
            triggerEvaluations: triggerEvaluations.map((e) => ({
              triggerId: e.triggerId,
              name: e.name,
              fired: e.fired,
              matchedKeyword: e.matchedKeyword,
              matchedContext: e.matchedContext,
              excludedBy: e.excludedBy,
              reason: e.reason,
            })),
          },
        }
      : {}),
  };

  if (useLlmRelevance) {
    json.llmMode = true;
    json.findingsBeforeLlm = findingsBeforeLlm;
    json.findingsAfterLlm = findingsAfterLlm;
  }

  return NextResponse.json(json);
}
