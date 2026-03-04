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
 * Wenn dein Fachmapping anders sein soll, ändere es hier zentral.
 */
function mapCategoryTo5(cat: string, title?: string, detail?: string): CategoryKey {
  const c = String(cat ?? "").trim();
  const text = `${title ?? ""} ${detail ?? ""}`.toLowerCase();

  // Wenn schon neue Keys: durchlassen
  if (isCategoryKey(c)) return c;

  // Alte Keys:
  // normen -> meist vertraglich/normativ (Risiko/Haftung) oder technische Vollständigkeit.
  // Ich mappe es auf Vertrags-/LV-Risiken, weil das in der Praxis Claim-/Haftungshebel ist.
  if (c === "normen") return "vertrags_lv_risiken";

  if (c === "vollstaendigkeit") return "technische_vollstaendigkeit";

  // Vortexte = Vertrags-/LV-Risiken (bauseits, Abgrenzung, etc.)
  if (c === "vortext") return "vertrags_lv_risiken";

  // Nachtrag = Vertrags-/LV-Risiken (Claim-Potenzial)
  if (c === "nachtrag") return "vertrags_lv_risiken";

  // Ausführung -> technisch/Qualität/Leistungsbild
  if (c === "ausfuehrung") return "technische_vollstaendigkeit";

  // Mengen & Schnittstellen: heuristisch splitten
  if (c === "mengen_schnittstellen") {
    // Schnittstellen-Heuristik
    if (
      /schnittstelle|bauseits|gewerk|abgrenz|koordin|msr|elt|elektro|gu\b|bauherr|vorleistung|bim|planer|liefergrenze/.test(
        text
      )
    ) {
      return "schnittstellen_nebenleistungen";
    }
    // Mengen-Heuristik
    if (/mengen|masse|aufmaß|pauschal|einheit|pos\.|position|meter|stück|kg|m2|m3/.test(text)) {
      return "mengen_massenermittlung";
    }
    // Default: eher Mengen (weil die meisten Treffer dort landen)
    return "mengen_massenermittlung";
  }

  // Letzter Fallback: Vertragsrisiken (konservativ)
  return "vertrags_lv_risiken";
}

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
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
      is_active
    `);

  if (error) {
    console.error("Supabase Trigger Fehler:", error);
  }

  const dbTriggers: DbTrigger[] = (data ?? []).filter((t: any) =>
    typeof t.is_active === "boolean" ? t.is_active : true
  );

  // 1) Findings erzeugen (DB + SYS kommt aus analyzeLvText)
  const findings = analyzeLvText(lvText, dbTriggers);

  // 2) Kategorien auf 5 Keys mappen (alte Bezeichnungen raus)
  const findingsMapped = (findings ?? []).map((f: any) => ({
    ...f,
    category: mapCategoryTo5(f.category, f.title, f.detail),
  }));

  // 3) Score rechnen (weiterhin deine bestehende Logik nutzen)
  const result = computeScore({ findings: findingsMapped });

  // 4) perCategory hart korrekt machen: aus gemappten Findings neu aufbauen
  const perCategory: Record<CategoryKey, number> = {
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
    perCategory[k] += pen;
  }

  // Clamp 0..100, damit UI sauber bleibt
  for (const k of CATEGORY_KEYS) {
    perCategory[k] = Math.max(0, Math.min(100, Math.round(perCategory[k])));
  }

  // 5) Response: alte Kategorien komplett eliminiert
  return NextResponse.json({
    ...result,
    perCategory,
    findingsSorted: findingsMapped,
  });
}
