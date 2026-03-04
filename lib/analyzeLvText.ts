import { PRESET_FINDINGS } from "./findingsPresets";
import { Finding, Severity, ScoreCategory } from "./scoring";

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
  question_template: string | null;
  offer_text_template: string | null;
  is_active: boolean;
};

// ===================== Text Preprocessing =====================

/**
 * Entfernt XML/GAEB-Ballast, damit Trigger nicht auf Tags/Metadaten feuern.
 * MVP, aber wirkt sofort.
 */
function preprocessLvText(input: string): string {
  let t = input ?? "";

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
  if (
    ["pos", "position", "stück", "stk", "m2", "m3", "m", "dn", "en", "din", "iso", "mm", "cm"].includes(lower)
  ) {
    return false;
  }

  return true;
}

/**
 * Treffer zählen:
 * - Regex (Trigger-regex) hat Priorität
 * - Keywords: Wortgrenzen für Einzelwörter, Phrase-Match für Mehrwort
 */
function computeHits(text: string, trigger: DbTrigger): number {
  let hits = 0;

  // 1) Trigger-Regex (präzise)
  if (trigger.regex && trigger.regex.trim().length > 0) {
    try {
      const re = new RegExp(trigger.regex, "gi");
      hits = (text.match(re) ?? []).length;
      return hits;
    } catch {
      // ignore
    }
  }

  // 2) Keywords (gehärtet)
  const kws = Array.isArray(trigger.keywords) ? trigger.keywords : [];
  if (!kws.length) return 0;

  const lower = text.toLowerCase();

  for (const raw of kws) {
    if (!isUsableKeyword(raw)) continue;

    const kw = raw.trim().toLowerCase();

    // Mehrwort-Phrase: simple substring
    if (kw.includes(" ")) {
      const parts = lower.split(kw);
      hits += Math.max(0, parts.length - 1);
      continue;
    }

    // Einzelwort: Wortgrenze (damit "an" nicht in "dangl" matched)
    const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "g");
    hits += (lower.match(re) ?? []).length;
  }

  // Cap: selbst wenn es noch ausrastet, nicht ins Unendliche
  return clamp(hits, 0, 50);
}

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

type DedupeMode = "per_trigger" | "none";
const DEFAULT_DEDUPE_MODE: DedupeMode = "per_trigger";

function applyDbTriggers(cleanText: string, triggers: DbTrigger[], dedupeMode: DedupeMode): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const t of triggers) {
    if (!t.is_active) continue;

    const hits = computeHits(cleanText, t);
    if (hits <= 0) continue;

    const id = `DB_${t.id}`;

    if (dedupeMode === "per_trigger") {
      if (seen.has(id)) continue;
      seen.add(id);
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
      id,
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
  const raw = lvTextRaw ?? "";
  const text = preprocessLvText(raw); // <-- DAS ist der Gamechanger
  const findings: Finding[] = [];

  // 0) DB Trigger
  if (dbTriggers.length) {
    findings.push(...applyDbTriggers(text, dbTriggers, DEFAULT_DEDUPE_MODE));
  }

  // 1) System/Baseline Checks (auf bereinigtem Text!)
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
      category: "normen",
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

  // Nachtrag-/Weichwörter (auch hier capped)
  const nachtragWorte = ["bauseits", "nach aufwand", "optional", "bedarfsweise", "pauschal"];
  const lower = text.toLowerCase();
  const countNachtrag = nachtragWorte.reduce((acc, w) => acc + (lower.split(w).length - 1), 0);

  if (countNachtrag >= 3) {
    const mult = frequencyMultiplier(countNachtrag);
    const penalty = clamp(Math.round(6 * mult), 0, 12);

    findings.push({
      id: countNachtrag >= 6 ? "SYS_VIELE_WEICHE_FORMULIERUNGEN" : "SYS_EINIGE_WEICHE_FORMULIERUNGEN",
      category: "nachtrag",
      title:
        countNachtrag >= 6
          ? "Viele weiche Formulierungen (bauseits/optional/nach Aufwand) → hohes Nachtragspotenzial"
          : "Mehrere weiche Formulierungen → Nachtragspotenzial",
      detail: `Trefferanzahl: ${countNachtrag} | Faktor: ${mult.toFixed(2)} | Penalty: ${penalty}`,
      severity: countNachtrag >= 6 ? "high" : "medium",
      penalty,
    });
  }

  return findings;
}
