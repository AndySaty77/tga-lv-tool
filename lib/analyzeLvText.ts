import { PRESET_FINDINGS } from "./findingsPresets";
import { Finding, Severity, ScoreCategory } from "./scoring";

// ===== DB Trigger Typ (entspricht deiner Supabase-Tabelle) =====
export type DbTrigger = {
  id: string;
  name: string;
  description: string | null;
  category: string; // z.B. "Technische Vollständigkeit"
  trigger_type: string | null;
  keywords: string[] | null; // text[]
  regex: string | null;
  norms: string[] | null; // text[]
  weight: number; // int4 -> penalty
  claim_level: string | null;
  risk_interpretation: string | null;
  question_template: string | null;
  offer_text_template: string | null;
  is_active: boolean;
};

const hasAny = (text: string, patterns: Array<string | RegExp>) => {
  const t = text.toLowerCase();
  return patterns.some((p) => (p instanceof RegExp ? p.test(text) : t.includes(p.toLowerCase())));
};

const severityFromWeight = (weight: number): Severity => {
  if (weight >= 8) return "high";
  if (weight >= 4) return "medium";
  return "low";
};

const countOccurrences = (haystackLower: string, needleLower: string) => {
  if (!needleLower) return 0;
  return haystackLower.split(needleLower).length - 1;
};

// ===== Mapping: Supabase Kategorie -> Scoring Kategorie =====
const mapSupabaseCategoryToScore = (catRaw: string): ScoreCategory => {
  const c = (catRaw ?? "").trim().toLowerCase();

  // deine geplanten Kategorien:
  // - Technische Vollständigkeit
  // - Vertrags-/LV-Risiko
  // - Kalkulationsunsicherheit
  // - Mengen & Massenermittlung
  // - Schnittstellen & Nebenleistungen

  if (c.includes("technische") && c.includes("voll")) return "vollstaendigkeit";

  if (c.includes("mengen")) return "mengen_schnittstellen";
  if (c.includes("massenermittlung") || c.includes("massenermittle")) return "mengen_schnittstellen";

  if (c.includes("schnittstellen") || c.includes("nebenleistungen")) return "mengen_schnittstellen";

  if (c.includes("vertrag") || c.includes("lv-risiko") || c.includes("lv risiko")) return "vortext";

  if (c.includes("kalkulation") || c.includes("unsicherheit")) return "nachtrag";

  // optional, falls du später "Normen & Regelwerke" etc. einführst
  if (c.includes("norm")) return "normen";

  // Fallback: lieber irgendwo landen als crashen
  return "ausfuehrung";
};

function applyDbTriggers(textRaw: string, triggers: DbTrigger[]): Finding[] {
  const findings: Finding[] = [];
  const textLower = (textRaw ?? "").toLowerCase();

  for (const t of triggers) {
    if (!t.is_active) continue;

    let hits = 0;

    // 1) Regex hat Priorität
    if (t.regex && t.regex.trim().length > 0) {
      try {
        const re = new RegExp(t.regex, "gi");
        hits = (textRaw.match(re) ?? []).length;
      } catch {
        hits = 0;
      }
    }

    // 2) Keywords (text[]) nur wenn regex nicht getroffen hat (oder nicht vorhanden)
    if (hits === 0 && t.keywords && t.keywords.length > 0) {
      for (const k of t.keywords) {
        const kw = (k ?? "").trim().toLowerCase();
        if (!kw) continue;
        hits += countOccurrences(textLower, kw);
      }
    }

    if (hits > 0) {
      const detailParts: string[] = [];
      if (t.description) detailParts.push(t.description);
      detailParts.push(`Treffer: ${hits}`);
      if (t.risk_interpretation) detailParts.push(`Risiko: ${t.risk_interpretation}`);
      if (t.claim_level) detailParts.push(`Claim-Level: ${t.claim_level}`);
      if (t.norms && t.norms.length) detailParts.push(`Normen: ${t.norms.join(", ")}`);

      findings.push({
        id: t.id,
        category: mapSupabaseCategoryToScore(t.category),
        title: t.name,
        severity: severityFromWeight(t.weight),
        penalty: t.weight,
        detail: detailParts.join(" | "),
      });
    }
  }

  return findings;
}

// ===== Hauptfunktion =====
export function analyzeLvText(lvTextRaw: string, dbTriggers: DbTrigger[] = []): Finding[] {
  const text = lvTextRaw ?? "";
  const findings: Finding[] = [];

  // 0) DB Trigger (Supabase)
  if (dbTriggers.length) {
    findings.push(...applyDbTriggers(text, dbTriggers));
  }

  // 1) Baseline-Checks (bleiben!)
  // Normen-Checks (MVP: simple)
  const hasDIN1988 = hasAny(text, ["din 1988", "din1988"]);
  const hasEN806 = hasAny(text, ["din en 806", "en 806"]);
  const hasEN1717 = hasAny(text, ["din en 1717", "en 1717"]);

  if (!hasDIN1988) findings.push(PRESET_FINDINGS.DIN_1988_FEHLT());
  if (!hasEN1717)
    findings.push({
      id: "DIN_EN_1717_FEHLT",
      category: "normen",
      title: "DIN EN 1717 nicht genannt (Trinkwasserschutz)",
      severity: "high",
      penalty: 5,
    });

  // Vollständigkeit: Druckprüfung / Spülung
  const hasDruckpruefung = hasAny(text, ["druckprüfung", "druckprobe", /druck\s*prüf/i]);
  const hasSpuelung = hasAny(text, ["spül", "spuel", "spülprotokoll", "spuelprotokoll"]);

  if (!hasDruckpruefung) findings.push(PRESET_FINDINGS.DRUCKPRUEFUNG_UNKLAR());
  if (!hasSpuelung)
    findings.push({
      id: "SPUELUNG_FEHLT",
      category: "vollstaendigkeit",
      title: "Spülung/Spülprotokoll nicht eindeutig beschrieben",
      severity: "high",
      penalty: 6,
    });

  // Vortext: “bauseits/nach Aufwand/optional” als Nachtrags-Booster
  const nachtragWorte = ["bauseits", "nach aufwand", "optional", "bedarfsweise", "pauschal"];
  const countNachtrag = nachtragWorte.reduce(
    (acc, w) => acc + (text.toLowerCase().split(w).length - 1),
    0
  );

  if (countNachtrag >= 6) {
    findings.push({
      id: "VIELE_WEICHE_FORMULIERUNGEN",
      category: "nachtrag",
      title: "Viele weiche Formulierungen (bauseits/optional/nach Aufwand) → hohes Nachtragspotenzial",
      detail: `Trefferanzahl: ${countNachtrag}`,
      severity: "high",
      penalty: 10,
    });
  } else if (countNachtrag >= 3) {
    findings.push({
      id: "EINIGE_WEICHE_FORMULIERUNGEN",
      category: "nachtrag",
      title: "Mehrere weiche Formulierungen → Nachtragspotenzial",
      detail: `Trefferanzahl: ${countNachtrag}`,
      severity: "medium",
      penalty: 6,
    });
  }

  return findings;
}
