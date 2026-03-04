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
 * ✅ GEWERK-ERKENNUNG (MVP)
 * Liefert Keys passend zu triggers.disciplines (text[]) in Supabase.
 */
type DisciplineKey = "heizung" | "sanitaer" | "lueftung" | "msr" | "elektro" | "kaelte";

function detectDisciplines(lvText: string): DisciplineKey[] {
  const t = (lvText || "").toLowerCase();
  const found: DisciplineKey[] = [];

  if (
    /heizung|heizkreis|heizkörper|fussbodenheizung|fbh|wärmepumpe|waermepumpe|kessel|brennwert|puffer|speicher|hydraulik|mischer|weiche|vorlauf|ruecklauf|rücklauf|heizlast|din\s*en\s*12831/.test(
      t
    )
  ) {
    found.push("heizung");
  }

  if (
    /sanitär|sanitaer|trinkwasser|warmwasser|kaltwasser|zirkulation|zirkulationsleitung|armatur|wc|urinal|waschtisch|dusche|badewanne|abwass|entwässer|entwaesser|fallleitung|din\s*1988|din\s*1986|din\s*en\s*1717|din\s*en\s*806|din\s*en\s*12056/.test(
      t
    )
  ) {
    found.push("sanitaer");
  }

  if (/lüftung|lueftung|rlt|volumenstrom|kanal|luftkanal|luftmenge|brandschutzklappe|vav/.test(t)) {
    found.push("lueftung");
  }

  if (/msr|ga\b|gebäudeautomation|gebaeudeautomation|regelung|ddc|bacnet|modbus|knx|bus/.test(t)) {
    found.push("msr");
  }

  if (/elektro|elt\b|strom|verteiler|kabel|leitung|schutzschalter|fi\b|rccb|ls\b|potentialausgleich/.test(t)) {
    found.push("elektro");
  }

  if (/kälte|kaelte|kältemittel|kaeltemittel|chiller|kuehlung|kühlung|verdampfer|verflüssiger|verfluessiger/.test(t)) {
    found.push("kaelte");
  }

  return Array.from(new Set(found));
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

  // 1) Gewerke erkennen
  const detected = detectDisciplines(lvText);

  // 2) Trigger filtern: nur passende disciplines
  const dbTriggers: DbTrigger[] = (data ?? [])
    .filter((t: any) => (typeof t.is_active === "boolean" ? t.is_active : true))
    .filter((t: any) => {
      const td: string[] = Array.isArray(t.disciplines) ? t.disciplines : [];
      if (!td.length) return true; // Legacy/Global
      if (!detected.length) return true; // defensiv
      return td.some((d) => detected.includes(d as DisciplineKey));
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
    console.log("Detected disciplines:", detected);
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
            detectedDisciplines: detected,
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
