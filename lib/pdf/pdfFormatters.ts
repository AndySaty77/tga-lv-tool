/**
 * Helper für PDF-Report: Formatierung, Normalisierung, Fallbacks.
 * Keine Abhängigkeit zu PDF-Bibliotheken.
 */

import type { TrafficLight } from "./pdfTypes";

/** Schwellen für Ampel (Score 0–100, höher = mehr Risiko). */
const RED_MIN = 70;
const YELLOW_MIN = 40;

/**
 * Datum im deutschen Format (TT.MM.JJJJ).
 */
export function formatDateDE(value: unknown): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Score (0–100, höher = mehr Risiko) → TrafficLight.
 */
export function scoreToTrafficLight(score: unknown): TrafficLight | undefined {
  if (typeof score !== "number" || Number.isNaN(score)) return undefined;
  if (score >= RED_MIN) return "red";
  if (score >= YELLOW_MIN) return "yellow";
  return "green";
}

/**
 * Leerer Fallback-Text: null/undefined/leerer String → Fallback, sonst getrimmter Wert.
 */
export function emptyFallback(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  return s === "" ? fallback : s;
}

/**
 * Text kürzen und säubern: Whitespace normalisieren, maximale Länge (optional), keine Debug-Tokens.
 */
const TECHNICAL_TOKENS = [
  "treffer",
  "basis",
  "faktor",
  "penalty",
  "claim-level",
  "claim level",
  "normen",
  "vertrags_lv_risiken",
  "schnittstellen_nebenleistungen",
  "mengen_massenermittlung",
  "technische_vollstaendigkeit",
  "kalkulationsunsicherheit",
];

export function sanitizeText(
  value: unknown,
  options?: { maxLength?: number; stripTechnical?: boolean }
): string {
  if (value == null) return "";
  const raw = typeof value === "string" ? value : String(value);
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";

  const stripTechnical = options?.stripTechnical !== false;
  if (stripTechnical) {
    const lower = s.toLowerCase();
    if (TECHNICAL_TOKENS.some((t) => lower.includes(t))) {
      const sentences = s.split(/(?<=[.!?])\s+/);
      const cleaned = sentences.filter((sent) => {
        const l = sent.toLowerCase();
        return !TECHNICAL_TOKENS.some((t) => l.includes(t));
      });
      s = cleaned.slice(0, 2).join(" ").trim() || s;
    }
  }

  const maxLength = options?.maxLength;
  if (typeof maxLength === "number" && maxLength > 0 && s.length > maxLength) {
    s = s.slice(0, maxLength).trim();
    if (!/[\s.!?]$/.test(s)) s += "…";
  }
  return s;
}

/**
 * Liste normalisieren: aus beliebigem Input ein Array von Strings oder Objekten mit text-ähnlichen Feldern.
 */
export function normalizeList<T>(
  value: unknown,
  itemMapper: (item: unknown, index: number) => T | null
): T[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (let i = 0; i < value.length; i++) {
    const mapped = itemMapper(value[i], i);
    if (mapped != null) out.push(mapped);
  }
  return out;
}

/**
 * String-Liste aus Array extrahieren (z. B. für topRisks).
 */
export function normalizeStringList(value: unknown, maxItems?: number): string[] {
  return normalizeList(value, (item) => {
    if (item == null) return null;
    if (typeof item === "string") {
      const t = item.trim();
      return t === "" ? null : t;
    }
    const obj = item as { title?: string; text?: string; question?: string };
    const t = [obj.title, obj.text, obj.question]
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .find((v) => v.length > 0);
    if (t) return t;
    const fallback = String(item).trim();
    return fallback === "" ? null : fallback;
  }).slice(0, typeof maxItems === "number" ? maxItems : undefined);
}
