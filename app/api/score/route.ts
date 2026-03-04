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
 * A) NORMALISIERUNG:
 * - pro Kategorie ein "Max", gegen das die Risiko-Last skaliert wird
 * - XXL-LVs kriegen zusätzlich einen Size-Faktor (mehr Text = mehr potentielle Treffer)
 * - weiche Kurve (sqrt), damit wenige Treffer nicht sofort rot werden
 */
const CAT_MAX: Record<CategoryKey, number> = {
  vertrags_lv_risiken: 70,
  mengen_massenermittlung: 60,
  technische_vollstaendigkeit: 80,
  schnittstellen_nebenleistungen: 70,
  kalkulationsunsicherheit: 60,
};

function clamp0_100(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

/**
 * LV-Größe: skaliert das "Max" (Aufnahmefähigkeit) nach Textlänge.
 * Ziel: Wohnungsbau XXL knallt nicht sofort auf 100.
 */
function lvSizeFactor(lvText: string) {
  const len = (lvText || "").length;
  // 1.0 .. ~1.6 (max +60%) je nach Textmenge
  const f = 1 + Math.min(0.6, Math.log10(1 + len / 2000));
  return f;
}

/**
 * ✅ GEWERK-ERKENNUNG (MVP)
 * Liefert Keys passend zu triggers.disciplines (text[]) in Supabase.
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

  return Array.from(new Set(found));
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/score" });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lvText = String((body as any)?.lvText ?? "");

  const supabase = supabaseServer();

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
  console.log("Detected disciplines:", detected);

  // 2) Trigger filtern: nur passende disciplines
  const dbTriggers: DbTrigger[] = (data ?? [])
    .filter((t: any) => (typeof t.is_active === "boolean" ? t.is_active : true))
    .filter((t: any) => {
      const td: string[] = Array.isArray(t.disciplines) ? t.disciplines : [];
      // Trigger ohne Disziplin bleibt drin (Legacy/Global)
      if (!td.length) return true;

      // Wenn LV nichts erkennt: defensiv -> alles zulassen
      if (!detected.length) return true;

      return td.some((d) => detected.includes(d as DisciplineKey));
    });

  // 3) Findings erzeugen (DB + SYS kommt aus analyzeLvText)
  const findings = analyzeLvText(lvText, dbTriggers);

  // 4) Kategorien auf 5 Keys mappen
  const findingsMapped = (findings ?? []).map((f: any) => ({
    ...f,
    category: mapCategoryTo5(f.category, f.title, f.detail),
  }));

  // 5) Bestehende Score-Logik (Detail/Findings etc.) behalten
  const result = computeScore({ findings: findingsMapped });

  // 6) Risiko-Last je Kategorie (ABS!), damit Vorzeichen nicht verwirrt
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

  // Debug: hilft beim Kalibrieren
  const sizeF = lvSizeFactor(lvText);
  console.log("perCategorySum (abs):", perCategorySum, "sizeF:", sizeF);

  // 7) NORMALISIERTE perCategory (0..100) mit Size-Faktor + weicher Kurve
  const perCategory: Record<CategoryKey, number> = {
    vertrags_lv_risiken: 0,
    mengen_massenermittlung: 0,
    technische_vollstaendigkeit: 0,
    schnittstellen_nebenleistungen: 0,
    kalkulationsunsicherheit: 0,
  };

  for (const k of CATEGORY_KEYS) {
    const sum = perCategorySum[k];
    const baseMax = CAT_MAX[k] || 60;
    const scaledMax = baseMax * sizeF;

    const ratio = clamp01(sum / scaledMax);
    const eased = Math.sqrt(ratio); // erste Treffer weniger brutal

    perCategory[k] = clamp0_100(eased * 100);
  }

  /**
   * TOTAL:
   * Durchschnitt der normalisierten Kategorien (Ampel konsistent)
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

    // optional debug fürs UI:
    // detectedDisciplines: detected,
    // triggersUsed: dbTriggers.length,
  });
}
