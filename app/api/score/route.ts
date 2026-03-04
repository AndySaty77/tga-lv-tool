import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeLvText, DbTrigger } from "../../../lib/analyzeLvText";
import { computeScore } from "../../../lib/scoring";

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
  if (c === "nachtrag") return "vertrags_lv_risiken";
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

const FALLBACK_CONFIG: ScoringConfig = {
  version: 1,
  catMax: {
    vertrags_lv_risiken: 70,
    mengen_massenermittlung: 60,
    technische_vollstaendigkeit: 80,
    schnittstellen_nebenleistungen: 70,
    kalkulationsunsicherheit: 60,
  },
  lvSize: { baseDivisor: 2000, maxBoost: 0.6 },
  easing: { type: "sqrt" },
  total: { method: "mean" },
};

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

  // Defensive: fehlende Keys ergänzen
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
 * Wir zählen Treffer je Gewerk, wählen primary (höchster Score),
 * und sekundäre nur, wenn sie nah genug dran sind.
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

  // Substanziell erst ab MIN_HITS
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

export async function POST(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  const body = await req.json().catch(() => ({}));
  const lvText = String((body as any)?.lvText ?? "");

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
      disciplines
    `);

  if (error) {
    console.error("Supabase Trigger Fehler:", error);
  }

  // 1) Gewerke erkennen (primary + secondary)
  const det = detectDisciplines(lvText);
  const allowDisciplines = det.all; // nur primary + secondary

  // 2) Trigger filtern: NUR primary+secondary + global
  const dbTriggers: DbTrigger[] = (data ?? [])
    .filter((t: any) => (typeof t.is_active === "boolean" ? t.is_active : true))
    .filter((t: any) => {
      const td: string[] = Array.isArray(t.disciplines) ? t.disciplines : [];

      // Wenn wir etwas erkannt haben: nur passende + global
      if (allowDisciplines.length) {
        // Legacy ohne disciplines NICHT mehr pauschal zulassen -> sonst wieder 181
        if (!td.length) return false;

        // global immer mitnehmen, plus primary/secondary
        return td.some((d) => d === "global" || allowDisciplines.includes(d as DisciplineKey));
      }

      // Wenn nichts erkannt: defensiv alles zulassen
      return true;
    });

  // 3) Findings erzeugen
  const findings = analyzeLvText(lvText, dbTriggers);

  // 4) Kategorien mappen
  const findingsMapped = (findings ?? []).map((f: any) => ({
    ...f,
    category: mapCategoryTo5(f.category, f.title, f.detail),
  }));

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

  const sizeF = lvSizeFactor(lvText, cfg);

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

  // TOTAL = mean (Ampel konsistent)
  const totalNormalized = clamp0_100(
    Math.round(
      (perCategory.vertrags_lv_risiken +
        perCategory.mengen_massenermittlung +
        perCategory.technische_vollstaendigkeit +
        perCategory.schnittstellen_nebenleistungen +
        perCategory.kalkulationsunsicherheit) / 5
    )
  );

  if (debug) {
    console.log("Discipline scores:", det.scores);
    console.log("Detected primary:", det.primary, "secondary:", det.secondary);
    console.log("Triggers used:", dbTriggers.length);
    console.log("perCategorySum(abs):", perCategorySum, "sizeF:", sizeF, "cfg.version:", cfg.version);
  }

  return NextResponse.json({
    ...result,
    total: totalNormalized,
    perCategory,
    findingsSorted: findingsMapped,
    ...(debug
      ? {
          debug: {
            disciplineScores: det.scores,
            detectedDisciplines: det.all,
            primaryDiscipline: det.primary,
            secondaryDisciplines: det.secondary,
            triggersUsed: dbTriggers.length,
            perCategorySum,
            sizeF,
            scoringConfigVersion: cfg.version,
            easing: cfg.easing.type,
          },
        }
      : {}),
  });
}
