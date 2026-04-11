/**
 * Bearbeitungsstatus gespeicherter Analysen (analyse_runs.lv_status) – reine Pflege, keine Auswertelogik.
 */

export const LV_STATUS_KEYS = [
  "offen",
  "in_bearbeitung",
  "zurueckgestellt",
  "nicht_abgegeben",
  "abgegeben",
  "gewonnen",
  "verloren",
] as const;

export type LvStatusKey = (typeof LV_STATUS_KEYS)[number];

/** UI-Labels (Bearbeitungsstatus). */
export const LV_STATUS_LABEL_DE: Record<LvStatusKey, string> = {
  offen: "Offen",
  in_bearbeitung: "In Bearbeitung",
  zurueckgestellt: "Zurückgestellt",
  nicht_abgegeben: "Nicht abgegeben",
  abgegeben: "Abgegeben",
  gewonnen: "Gewonnen",
  verloren: "Verloren",
};

export function normalizeLvStatus(raw: string | null | undefined): LvStatusKey {
  const v = (raw ?? "").trim().toLowerCase();
  if ((LV_STATUS_KEYS as readonly string[]).includes(v)) return v as LvStatusKey;
  return "offen";
}

export function lvStatusBadgeStyle(key: LvStatusKey): { background: string; color: string; border: string } {
  switch (key) {
    case "gewonnen":
      return { background: "rgba(74,222,128,0.12)", color: "#15803d", border: "rgba(74,222,128,0.35)" };
    case "verloren":
    case "nicht_abgegeben":
      return { background: "rgba(248,113,113,0.1)", color: "#b91c1c", border: "rgba(248,113,113,0.3)" };
    case "abgegeben":
      return { background: "rgba(96,165,250,0.12)", color: "#1d4ed8", border: "rgba(96,165,250,0.35)" };
    case "in_bearbeitung":
      return { background: "rgba(251,191,36,0.12)", color: "#a16207", border: "rgba(251,191,36,0.35)" };
    case "zurueckgestellt":
      return { background: "rgba(148,163,184,0.15)", color: "#475569", border: "rgba(148,163,184,0.35)" };
    case "offen":
    default:
      return { background: "rgba(148,163,184,0.1)", color: "#334155", border: "rgba(148,163,184,0.28)" };
  }
}

export function parseBidAmountNetFromDb(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Eingabe aus Formular: leer → null; unterstützt z. B. 1234,56 und 1.234,56. */
export function parseBidAmountNetInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const normalized = s.replace(/[^\d,.-]/g, "");
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  let t = normalized;
  if (lastComma > lastDot) {
    t = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    t = normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    t = normalized.replace(",", ".");
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function formatBidAmountNetEur(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}
