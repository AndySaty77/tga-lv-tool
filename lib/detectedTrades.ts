/**
 * Gewerkserkennung: Typen und Hilfsfunktionen für die Ausgabe im Analyseergebnis.
 * Nutzt die bestehende detectDisciplines-Logik aus der Score-Route (primary, secondary, scores).
 */

export type DisciplineKey = "heizung" | "sanitaer" | "lueftung" | "msr" | "elektro" | "kaelte" | "global";

export type DetectedTrades = {
  primaryTrade: string | null;
  secondaryTrades: string[];
  confidence: number | string | null;
  signals?: string[];
  scores?: Record<string, number>;
};

const TRADE_LABELS: Record<Exclude<DisciplineKey, "global">, string> = {
  heizung: "Heizung",
  sanitaer: "Sanitär",
  lueftung: "Lüftung",
  msr: "MSR / GA",
  elektro: "Elektro",
  kaelte: "Kälte",
};

/** Interner Key → Anzeigelabel (z. B. "sanitaer" → "Sanitär"). */
export function normalizeTradeLabel(key: string | null | undefined): string {
  if (key == null || key === "") return "";
  const k = String(key).toLowerCase() as keyof typeof TRADE_LABELS;
  return TRADE_LABELS[k] ?? key;
}

/** Confidence 0–1 oder "hoch"|"mittel"|"niedrig" → Anzeigetext. */
export function formatTradeConfidence(
  confidence: number | string | null | undefined
): string {
  if (confidence == null) return "—";
  if (typeof confidence === "string") {
    const c = confidence.toLowerCase();
    if (c === "hoch") return "Hoch";
    if (c === "mittel") return "Mittel";
    if (c === "niedrig") return "Niedrig";
    return confidence;
  }
  const n = Number(confidence);
  if (!Number.isFinite(n)) return "—";
  if (n >= 0.7) return "Hoch";
  if (n >= 0.4) return "Mittel";
  return "Niedrig";
}

/** Confidence als Prozent (0–100) für Anzeige. */
export function formatTradeConfidencePercent(
  confidence: number | null | undefined
): string {
  const n = Number(confidence);
  if (!Number.isFinite(n)) return "—";
  const pct = Math.round(Math.max(0, Math.min(1, n)) * 100);
  return `${pct} %`;
}

/**
 * Baut das detectedTrades-Objekt aus dem Roh-Ergebnis von detectDisciplines.
 * Defensiv: bei leerem det → "nicht erkannt" / leere Arrays.
 */
export function buildDetectedTrades(det: {
  primary: DisciplineKey | null;
  secondary: DisciplineKey[];
  all: DisciplineKey[];
  scores: Record<Exclude<DisciplineKey, "global">, number>;
}): DetectedTrades {
  const primary = det.primary && det.primary !== "global" ? det.primary : null;
  const secondary = (det.secondary ?? []).filter((k) => k !== "global") as Array<Exclude<DisciplineKey, "global">>;
  const scores = det.scores ?? {};

  const primaryTrade = primary ? normalizeTradeLabel(primary) : null;
  const secondaryTrades = secondary.map((k) => normalizeTradeLabel(k));

  // Confidence: Anteil des primären Gewerks an der Summe der Treffer; 0–1
  let confidence: number | string | null = null;
  const scoreKeys = Object.keys(scores) as Array<Exclude<DisciplineKey, "global">>;
  const total = scoreKeys.reduce((s, k) => s + (scores[k] ?? 0), 0);
  if (primary && total > 0 && scores[primary] != null) {
    const ratio = (scores[primary] as number) / total;
    confidence = Math.round(ratio * 100) / 100;
  }
  if (primary && (confidence == null || !Number.isFinite(confidence))) {
    confidence = secondary.length > 0 ? "mittel" : "hoch";
  }
  if (primary && confidence != null && typeof confidence === "number" && confidence < 0.4) {
    confidence = "niedrig";
  }

  const scoresForApi: Record<string, number> = {};
  for (const k of scoreKeys) {
    const label = normalizeTradeLabel(k);
    if (label) scoresForApi[label] = scores[k] ?? 0;
  }

  return {
    primaryTrade: primaryTrade || null,
    secondaryTrades: secondaryTrades ?? [],
    confidence,
    signals: primary ? [primary, ...secondary].map((k) => normalizeTradeLabel(k)) : undefined,
    scores: Object.keys(scoresForApi).length ? scoresForApi : undefined,
  };
}

/** Fallback-Objekt, wenn keine Gewerke erkannt wurden (kein Fehler). */
export function emptyDetectedTrades(): DetectedTrades {
  return {
    primaryTrade: null,
    secondaryTrades: [],
    confidence: null,
  };
}
