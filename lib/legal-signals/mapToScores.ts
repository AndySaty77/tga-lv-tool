import type { Finding, ScoreCategory, Severity } from "../scoring";
import type { LegalSignal, LegalSignalType } from "./types";

function severityToFinding(sev: LegalSignal["severity"]): Severity {
  if (sev === "high") return "high";
  if (sev === "medium") return "medium";
  return "low";
}

/** Primär-Kategorie (6er-Modell für computeScore / mapCategoryTo5). */
function categoryForSignalType(t: LegalSignalType): ScoreCategory {
  switch (t) {
    case "unusual_risk_transfer":
      return "vortext";
    case "acceptance_documentation_risk":
      return "vollstaendigkeit";
    case "hindrance_dependency_risk":
      return "mengen_schnittstellen";
    case "change_order_potential":
      return "kalkulation";
    default:
      return "vortext";
  }
}

function penaltyForSignal(s: LegalSignal): number {
  const base = s.severity === "high" ? 4 : s.severity === "medium" ? 3 : 2;
  return Math.min(5, base);
}

/**
 * Wandelt erkannte Signale in score-wirksame Findings um (konservative Penalties).
 * IDs mit Präfix LEGAL_ – filterbar in der UI.
 */
export function legalSignalsToFindings(signals: LegalSignal[]): Finding[] {
  return signals.map((s) => {
    const cat = categoryForSignalType(s.signalType);
    const pen = penaltyForSignal(s);
    const detailParts = [
      s.summary,
      s.evidence.length ? `Hinweise: ${s.evidence.length} Textstelle(n)` : "",
      s.affectsCategories.length ? `Kategorien: ${s.affectsCategories.join(", ")}` : "",
    ].filter(Boolean);

    return {
      id: `LEGAL_${s.signalType}_${s.id}`,
      category: cat,
      title: `[Vertragskontext] ${s.title}`,
      detail: detailParts.join(" | "),
      severity: severityToFinding(s.severity),
      penalty: pen,
      ...(s.evidence[0]?.text ? { raw_excerpt: s.evidence[0].text.slice(0, 500) } : {}),
      legalMeta: {
        signalType: s.signalType,
        suggestedQuestion: s.suggestedQuestion,
        suggestedClarification: s.suggestedClarification,
      },
    };
  });
}
