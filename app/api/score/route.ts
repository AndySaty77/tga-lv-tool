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

/**
 * A) NORMALISIERUNG: pro Kategorie definierst du ein "Max", gegen das die Penalty-Summe skaliert wird.
 * Sonst knallt jedes XXL-LV sofort auf 100/Rot.
 */
const CAT_MAX: Record<CategoryKey, number> = {
  vertrags_lv_risiken: 40,
  mengen_massenermittlung: 20,
  technische_vollstaendigkeit: 25,
  schnittstellen_nebenleistungen: 25,
  kalkulationsunsicherheit: 20,
};

function clamp0_100(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

/**
 * ✅ A3) GEWERK-ERKENNUNG (MVP)
 * Liefert Keys passend zu triggers.disciplines (text[]) in Supabase.
 * Du kannst die Regex später schärfer machen.
 */
type DisciplineKey = "heizung" | "sanitaer" | "lueftung" | "msr" | "elektro" | "kaelte";

function detectDisciplines(lvText: string): DisciplineKey[] {
  const t = (lvText || "").toLowerCase();

  const found: DisciplineKey[] = [];

  // Heizung
  if (
    /heizung|heizkreis|heizkörper|fussbodenheizung|fbh|wärmepumpe|waermepumpe|kessel|brennwert|puffer|speicher|hydraulik|mischer|weiche|vorlauf|ruecklauf|rücklauf|heizlast|din\s*en\s*12831/.test(
      t
    )
  ) {
    found.push("heizung");
  }

  // Sanitär
  if (
    /sanitär|sanitaer|trinkwasser|warmwasser|kaltwasser|zirkulation|zirkulationsleitung|armatur|wc|urinal|waschtisch|dusche|badewanne|abwass|entwässer|entwaesser|fallleitung|din\s*1988|din\s*1986|din\s*en\s*1717|din\s*en\s*806|din\s*en\s*12056/.test(
      t
    )
  ) {
    found.push("sanitaer");
  }

  // Lüftung
  if (/lüftung|lueftung|rlt|volumenstrom|kanal|luftkanal|luftmenge|brandschutzklappe|vav/.test(t)) {
    found.push("lueftung");
  }

  // MSR / GA
  if (/msr|ga\b|gebäudeautomation|gebaeudeautomation|regelung|ddc|bacnet|modbus|knx|bus/.test(t)) {
    found.push("msr");
  }

  // Elektro
  if (/elektro|elt\b|strom|verteiler|kabel|leitung|schutzschalter|fi\b|rccb|ls\b|potentialausgleich/.test(t)) {
    found.push("elektro");
  }

  // Kälte
  if (/kälte|kaelte|kältemittel|kaeltemittel|chiller|kuehlung|kühlung|verdampfer|verflüssiger|verfluessiger/.test(t)) {
    found.push("kaelte");
  }

  // Duplikate raus
  return Array.from(new Set(found));
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/score" });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lvText = String((body as any)?.lvText ?? "");

  const supabase = supabaseServer();

  // ✅ IMPORTANT: disciplines mitladen!
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

  // ✅ 1) Gewerke erkennen
  const detected = detectDisciplines(lvText);

  // Debug (Vercel Logs)
  console.log("Detected disciplines:", detected);

  // ✅ 2) Trigger filtern: nur passende disciplines
  const dbTriggers: DbTrigger[] = (data ?? [])
    .filter((t: any) => (typeof t.is_active === "boolean" ? t.is_active : true))
    .filter((t: any) => {
      const td: string[] = Array.isArray(t.disciplines) ? t.disciplines : [];
      // Wenn Trigger keine Disziplin hat, lassen wir ihn drin (Legacy/Global)
      if (!td.length) return true;

      // Wenn LV nichts erkennt: defensiv -> alles zulassen (sonst 0 Trigger)
      if (!detected.length) return true;

      return td.some((d) => detected.includes(d as DisciplineKey));
    });

  // 3) Findings erzeugen (DB + SYS kommt aus analyzeLvText)
  const findings = analyzeLvText(lvText, dbTriggers);

  // 4) Kategorien auf 5 Keys mappen (alte Bezeichnungen raus)
  const findingsMapped = (findings ?? []).map((f: any) => ({
    ...f,
    category: mapCategoryTo5(f.category, f.title, f.detail),
  }));

  // 5) Score rechnen (bestehende Logik bleibt)
  const result = computeScore({ findings: findingsMapped });

  // 6) Penalty-Summen je Kategorie (roh)
  const perCategorySum: Record<CategoryKey, number> = {
    vertrags_lv_risiken: 0,
    mengen_massenermittlung: 0,
    technische_vollstaendigkeit: 0,
    schnittstellen_nebenleistungen: 0,
    kalkulationsunsicherheit: 0,
  };

  for (const f of findingsMapped as any[]) {
    const k = mapCategoryTo5(f.category, f.title, f.detail);
    const pen = Number(f.penalty ?? 0);
    if (!Number.isFinite(pen)) continue;
    perCategorySum[k] += pen;
  }

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
    const max = CAT_MAX[k] || 20;
    perCategory[k] = clamp0_100((sum / max) * 100);
  }

  /**
   * A2) TOTAL FIX:
   * computeScore() kann bei vielen Treffern trotzdem 100 liefern.
   * Daher überschreiben wir total durch den Durchschnitt der normalisierten Kategorien.
   */
  const totalNormalized = clamp0_100(
    Math.round(
      (perCategory.vertrags_lv_risiken +
        perCategory.mengen_massenermittlung +
        perCategory.technische_vollstaendigkeit +
        perCategory.schnittstellen_nebenleistungen +
        perCategory.kalkulationsunsicherheit) / 5
    )
  );

  return NextResponse.json({
    ...result,
    total: totalNormalized,
    perCategory,
    findingsSorted: findingsMapped,

    // ✅ optional debug für UI/Logs:
    // detectedDisciplines: detected,
    // triggersUsed: dbTriggers.length,
  });
}
