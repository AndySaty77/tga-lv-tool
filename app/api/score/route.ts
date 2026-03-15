// app/api/score/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import { checkRateLimit } from "@/lib/rateLimit";
import { analyzeLvText, DbTrigger, TriggerEvaluation } from "../../../lib/analyzeLvText";
import { computeScore } from "../../../lib/scoring";
import { analyzeLvTextWithLLM } from "../../../lib/llmRelevanceFilter";
import { FALLBACK_SCORING_CONFIG } from "../../../lib/scoringConfig";
import { buildDetectedTrades, emptyDetectedTrades } from "../../../lib/detectedTrades";

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
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

async function getScoringConfig(supabase: ReturnType<typeof supabaseServer>): Promise<ScoringConfig> {
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

/**
 * ✅ GEWERK-ERKENNUNG (primary + secondary)
 */
type DisciplineKey = "heizung" | "sanitaer" | "lueftung" | "msr" | "elektro" | "kaelte" | "global";

type DisciplineDetect = {
  primary: DisciplineKey | null;
  secondary: DisciplineKey[];
  all: DisciplineKey[];
  scores: Record<Exclude<DisciplineKey, "global">, number>;
};

function countHits(t: string, re: RegExp) {
  const m = t.match(re);
  return m ? m.length : 0;
}

function detectDisciplines(lvText: string): DisciplineDetect {
  const t = (lvText || "").toLowerCase();

  const scores: Record<Exclude<DisciplineKey, "global">, number> = {
    heizung: 0,
    sanitaer: 0,
    lueftung: 0,
    msr: 0,
    elektro: 0,
    kaelte: 0,
  };

  scores.heizung += countHits(
    t,
    /\bheizung\b|\bheizkreis\b|\bheizkörper\b|\bfussbodenheizung\b|\bfbh\b|\bwärmepumpe\b|\bwaermepumpe\b|\bkessel\b|\bbrennwert\b|\bpuffer\b|\bspeicher\b|\bhydraulik\b|\bmischer\b|\bweiche\b|\bvorlauf\b|\br(ü|ue)cklauf\b|\bheizlast\b|\bdin\s*en\s*12831\b/g
  );

  scores.sanitaer += countHits(
    t,
    /\bsanit(ä|ae)r\b|\btrinkwasser\b|\bwarmwasser\b|\bkaltwasser\b|\bzirkulation\b|\bzirkulationsleitung\b|\barmatur\b|\bwc\b|\burinal\b|\bwaschtisch\b|\bdusche\b|\bbadewanne\b|\babwass/g
  );
  scores.sanitaer += countHits(
    t,
    /\bentw(ä|ae)sser\b|\bfallleitung\b|\bdin\s*1988\b|\bdin\s*1986\b|\bdin\s*en\s*1717\b|\bdin\s*en\s*806\b|\bdin\s*en\s*12056\b/g
  );

  scores.lueftung += countHits(
    t,
    /\bl(ü|ue)ftung\b|\brlt\b|\bvolumenstrom\b|\bkanal\b|\bluftkanal\b|\bluftmenge\b|\bbrandschutzklappe\b|\bvav\b/g
  );

  scores.msr += countHits(
    t,
    /\bmsr\b|\bga\b|\bgeb(ä|ae)udeautomation\b|\bregelung\b|\bddc\b|\bbacnet\b|\bmodbus\b|\bknx\b|\bbus\b/g
  );

  scores.elektro += countHits(
    t,
    /\belektro\b|\belt\b|\bstrom\b|\bverteiler\b|\bkabel\b|\bleitung\b|\bschutzschalter\b|\bfi\b|\brccb\b|\bls\b|\bpotentialausgleich\b/g
  );

  scores.kaelte += countHits(
    t,
    /\bk(ä|ae)lte\b|\bk(ä|ae)ltemittel\b|\bchiller\b|\bk(ü|ue)hlung\b|\bverdampfer\b|\bverfl(ü|ue)ssiger\b/g
  );

  const MIN_HITS = 3;

  const ordered = (Object.keys(scores) as Array<Exclude<DisciplineKey, "global">>)
    .filter((k) => scores[k] >= MIN_HITS)
    .sort((a, b) => scores[b] - scores[a]);

  const primary = ordered.length ? (ordered[0] as DisciplineKey) : null;

  const secondary =
    primary
      ? (ordered
          .filter((k) => k !== primary && scores[k] >= Math.ceil(scores[primary as Exclude<DisciplineKey, "global">] * 0.6))
          .map((k) => k as DisciplineKey) as DisciplineKey[])
      : [];

  const all = primary ? [primary, ...secondary] : [];

  return { primary, secondary, all, scores };
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
  const debug = url.searchParams.get("debug") === "1";

  const body = await req.json().catch(() => ({} as any));

  // Backward compatible: lvText bleibt Pflichtfeld wie bisher
  const lvText = String((body as any)?.lvText ?? "");

  // Neu: getrennt, kommt vom LLM-Split
  const vortext = String((body as any)?.vortext ?? "");
  const positions = String((body as any)?.positions ?? "");

  // Wichtiger Fix: für Trigger/Scoring NICHT mehr "guessen" – wenn Split da ist:
  const hasSplit = (vortext.trim().length > 0 || positions.trim().length > 0);
  const textForAnalysis = hasSplit ? [vortext, positions].filter((s) => String(s).trim().length > 0).join("\n\n") : lvText;

  const supabase = supabaseServer();
  const cfg = await getScoringConfig(supabase);

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
      disciplines,
      context_required,
      exclude_keywords
    `);

  if (error) {
    console.error("Supabase Trigger Fehler:", error?.message ?? "Unbekannt");
  }

  // 1) Gewerke erkennen (primary + secondary) – auf dem Text, den wir wirklich analysieren
  const det = detectDisciplines(textForAnalysis);
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
  const analyzeOpts = {
    vortext: hasSplit ? vortext : undefined,
    allowDisciplines: allowDisciplines,
    ...(debug ? { collectTriggerEvaluations: triggerEvaluations } : {}),
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

  // 5) computeScore behalten (Detailausgaben)
  const result = computeScore({ findings: findingsMapped });

  // 6) Risiko-Last pro Kategorie (ABS)
  const perCategorySum: Record<CategoryKey, number> = {
    vertrags_lv_risiken: 0,
    mengen_massenermittlung: 0,
    technische_vollstaendigkeit: 0,
    schnittstellen_nebenleistungen: 0,
    kalkulationsunsicherheit: 0,
  };

  for (const f of findingsMapped as any[]) {
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

  const json: Record<string, unknown> = {
    ...result,
    total: totalNormalized,
    perCategory,
    findingsSorted: findingsMapped,
    detectedTrades,
    ...(debug
      ? {
          debug: {
            splitUsed: hasSplit,
            lens: { lvText: lvText.length, vortext: vortext.length, positions: positions.length },
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
            /** Gefeuerte Findings: ID, 5er-Kategorie, Penalty, Titel (Nachvollziehbarkeit Score). */
            firedFindings: (findingsMapped as any[]).map((f: any) => ({
              triggerId: f.id,
              category: mapCategoryTo5(f.category, f.title, f.detail),
              penalty: f.penalty,
              title: f.title,
            })),
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
