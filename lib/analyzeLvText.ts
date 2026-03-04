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
  weight: number; // int4 -> penalty (Basis)
  claim_level: string | null;
  risk_interpretation: string | null;
  question_template: string | null;
  offer_text_template: string | null;
  is_active: boolean;
};

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

const countOccurrences = (haystackLower: string, needleLower: string) => {
  if (!needleLower) return 0;
  return haystackLower.split(needleLower).length - 1;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Frequency Scaling:
 * - verhindert Score-Explosion bei 100+ Positionstreffern
 * - 1 Treffer -> 100% weight
 * - 2 Treffer -> 120%
 * - 3 Treffer -> 140%
 * - 5 Treffer -> ~160%
 * - 10 Treffer -> ~180%
 * - Cap bei 200%
 */
function frequencyMultiplier(hits: number) {
  if (hits <= 1) return 1;
  const mult = 1 + Math.log10(hits) * 0.6; // 2->~1.18, 10->~1.6, 100->~2.2
  return clamp(mult, 1, 2.0);
}

/**
 * Dedupe:
 * - einige Trigger feuern pro Position, sollen aber pro LV "Thema" nur einmal wirken
 * - default: pro Trigger-ID einmal (mit Frequency Scaling auf penalty)
 */
type DedupeMode = "per_trigger" | "none";
const DEFAULT_DEDUPE_MODE: DedupeMode = "per_trigger";

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

/**
 * Treffer zählen (Regex priorisiert, dann Keywords additiv)
 */
function computeHits(textRaw: string, textLower: string, t: DbTrigger): number {
  let hits = 0;

  // 1) Regex (prioritär)
  if (t.regex && t.regex.trim().length > 0) {
    try {
      const re = new RegExp(t.regex, "gi");
      hits = (textRaw.match(re) ?? []).length;
    } catch {
      hits = 0;
    }
  }

  // 2) Keywords (additiv)
  if (t.keywords && t.keywords.length > 0) {
    for (const k of t.keywords) {
      const kw = (k ?? "").trim().toLowerCase();
      if (!kw) continue;
      hits += countOccurrences(textLower, kw);
    }
  }

  return hits;
}

/**
 * DB Trigger anwenden:
 * - Dedupe per Trigger-ID
 * - Frequency Scaling auf Penalty
 * - Detail zeigt Basispunkte + Hits + Multiplier + Final
 */
function applyDbTriggers(textRaw: string, triggers: DbTrigger[], dedupeMode: DedupeMode): Finding[] {
  const findings: Finding[] = [];
  const textLower = (textRaw ?? "").toLowerCase();

  // Dedupe-Sets
  const seenTrigger = new Set<string>();

  for (const t of triggers) {
    if (!t.is_active) continue;

    const hits = computeHits(textRaw, textLower, t);
    if (hits <= 0) continue;

    // Dedupe: pro Trigger nur einmal zählen (aber penalty skaliert über hits)
    if (dedupeMode === "per_trigger") {
      const key = `DB_${t.id}`;
      if (seenTrigger.has(key)) continue;
      seenTrigger.add(key);
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
      id: `DB_${t.id}`,
      category: mapSupabaseCategoryToScore(t.category),
      title: t.name,
      severity: severityFromWeight(finalPenalty),
      penalty: finalPenalty,
      detail: detailParts.join(" | "),
    });
  }

  return findings;
}

// ===================== Hauptfunktion =====================

export function analyzeLvText(lvTextRaw: string, dbTriggers: DbTrigger[] = []): Finding[] {
  const text = lvTextRaw ?? "";
  const findings: Finding[] = [];

  // 0) DB Trigger (Supabase) - dedupe + frequency scaling aktiv
  if (dbTriggers.length) {
    findings.push(...applyDbTriggers(text, dbTriggers, DEFAULT_DEDUPE_MODE));
  }

  // 1) System/Baseline Checks (Prefix SYS_)
  // Normen-Checks (MVP: simple)
  const hasDIN1988 = hasAny(text, ["din 1988", "din1988"]);
  const hasEN806 = hasAny(text, ["din en 806", "en 806"]);
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

  // (EN 806 ist aktuell nur „erkannt“, aber nicht bewertet – wenn du willst, bauen wir das als SYS finding ein)
  void hasEN806;

  // Vollständigkeit: Druckprüfung / Spülung
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

  // Vortext: “bauseits/nach Aufwand/optional” als Nachtrags-Booster
  // WICHTIG: hier ebenfalls keine lineare Explosion, sondern skaliert + cap.
  const nachtragWorte = ["bauseits", "nach aufwand", "optional", "bedarfsweise", "pauschal"];
  const textLower = text.toLowerCase();
  const countNachtrag = nachtragWorte.reduce((acc, w) => acc + countOccurrences(textLower, w), 0);

  const nachtragMult = frequencyMultiplier(Math.max(1, countNachtrag));
  // Basispenalty bleibt wie gehabt, aber wir capen final (sonst zerschießt „bauseits“ alles)
  const nachtragPenalty = clamp(Math.round(6 * nachtragMult), 0, 12);

  if (countNachtrag >= 6) {
    findings.push({
      id: "SYS_VIELE_WEICHE_FORMULIERUNGEN",
      category: "nachtrag",
      title: "Viele weiche Formulierungen (bauseits/optional/nach Aufwand) → hohes Nachtragspotenzial",
      detail: `Trefferanzahl: ${countNachtrag} | Faktor: ${nachtragMult.toFixed(2)} | Penalty: ${nachtragPenalty}`,
      severity: "high",
      penalty: nachtragPenalty,
    });
  } else if (countNachtrag >= 3) {
    findings.push({
      id: "SYS_EINIGE_WEICHE_FORMULIERUNGEN",
      category: "nachtrag",
      title: "Mehrere weiche Formulierungen → Nachtragspotenzial",
      detail: `Trefferanzahl: ${countNachtrag} | Faktor: ${nachtragMult.toFixed(2)} | Penalty: ${nachtragPenalty}`,
      severity: "medium",
      penalty: clamp(nachtragPenalty, 0, 10),
    });
  }

  return findings;
}
