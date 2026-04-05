import type { LegalSignalSeverity } from "./types";

/** Kurzes Severity-Label für die Analyseansicht (ruhig, ohne Alarmismus). */
export function severityLabelForUi(severity: LegalSignalSeverity | undefined): string | null {
  if (!severity) return null;
  if (severity === "high") return "Erhöht";
  if (severity === "medium") return "Mittel";
  return "Gering";
}

/**
 * Handlungsempfehlung für die UI – ein Satz mit optionalem „Empfehlung:“-Präfix.
 */
export function formatRecommendedLine(action: string | undefined): string | null {
  const t = action?.trim();
  if (!t) return null;
  if (/^empfehlung\s*:/i.test(t)) return t;
  return `Empfehlung: ${t}`;
}

/** Für Berichtsansicht & PDF: gleiche Logik, max. N Einträge, keine Evidenz-Rohdaten. */
export type LegalSignalReportRow = {
  title: string;
  summary: string;
  severityLabel: string | null;
  recommendation: string | null;
};

/**
 * Normalisiert gespeicherte oder API-`legalSignals` für Anzeige (gespeicherter Bericht, PDF).
 */
export function normalizeLegalSignalsForReport(raw: unknown, max = 3): LegalSignalReportRow[] {
  if (!Array.isArray(raw)) return [];
  const out: LegalSignalReportRow[] = [];
  for (const item of raw) {
    if (out.length >= max) break;
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const summary = typeof o.summary === "string" ? o.summary.trim() : "";
    if (!title && !summary) continue;
    const sevRaw = o.severity;
    const sev =
      typeof sevRaw === "string" && (sevRaw === "low" || sevRaw === "medium" || sevRaw === "high")
        ? (sevRaw as LegalSignalSeverity)
        : undefined;
    const severityLabel = severityLabelForUi(sev);
    const rec = formatRecommendedLine(
      typeof o.recommendedAction === "string" && o.recommendedAction.trim() ? o.recommendedAction : undefined
    );
    out.push({
      title: title || "Hinweis",
      summary,
      severityLabel,
      recommendation: rec,
    });
  }
  return out;
}
