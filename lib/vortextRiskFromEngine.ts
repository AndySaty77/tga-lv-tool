/**
 * Gemeinsame Typen für Vortext-Risiko (API/UI). Merge + Grounding: lib/vortextRiskGrounding.
 */

export type VortextRiskClause = {
  type: string;
  riskLevel: "low" | "medium" | "high";
  text: string;
  interpretation: string;
  confidence: number;
  /** Nur für Debug / Transparenz */
  source?: "db_trigger" | "legal_signal" | "sys_check" | "llm" | "regex_fallback";
};

const CAT_DISPLAY: Record<string, string> = {
  vertrags_lv_risiken: "Vertrags-/LV-Risiken",
  mengen_massenermittlung: "Mengen & Massenermittlung",
  technische_vollstaendigkeit: "Technische Vollständigkeit",
  schnittstellen_nebenleistungen: "Schnittstellen & Nebenleistungen",
  kalkulationsunsicherheit: "Kalkulationsunsicherheit",
  vortext: "Vertrags-/LV-Risiken",
  vollstaendigkeit: "Technische Vollständigkeit",
  mengen_schnittstellen: "Schnittstellen & Nebenleistungen",
  kalkulation: "Kalkulationsunsicherheit",
  normen: "Normen",
  ausfuehrung: "Ausführung",
  nachtrag: "Vertrags-/LV-Risiken",
};

export function displayCategoryForVortext(cat: string): string {
  const k = (cat ?? "").trim().toLowerCase();
  return CAT_DISPLAY[k] ?? cat;
}

/** @deprecated Nur noch für Zähler-Debug; Grounding übernimmt Merge. */
export function countEngineRaw(findings: unknown[], legal: unknown[]): number {
  return findings.length + legal.length;
}
