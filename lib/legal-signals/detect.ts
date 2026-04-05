import { LEGAL_SIGNAL_RULES } from "./rules";
import type { LegalSignal, LegalSignalEvidence, LegalSignalSeverity } from "./types";

/** Server: `LEGAL_SIGNALS_V1=0` schaltet die Schicht aus (Default: an). */
export const LEGAL_SIGNALS_V1_ENABLED = process.env.LEGAL_SIGNALS_V1 !== "0";

function severityRank(s: LegalSignalSeverity): number {
  if (s === "high") return 3;
  if (s === "medium") return 2;
  return 1;
}

function bumpSeverity(base: LegalSignalSeverity, hits: number): LegalSignalSeverity {
  if (hits >= 4) {
    if (base === "low") return "medium";
    if (base === "medium") return "high";
  }
  if (hits >= 2 && base === "low") return "medium";
  return base;
}

/**
 * Erkennt Vertrags-/Vergabesignale im Vortext (oder Ersatztext).
 * Kurze Texte: leeres Array (keine aggressive Erkennung auf zu wenig Kontext).
 */
export function detectLegalSignals(sourceText: string): LegalSignal[] {
  const text = sourceText ?? "";
  const trimmed = text.trim();
  if (trimmed.length < 120) return [];

  const signals: LegalSignal[] = [];

  for (const rule of LEGAL_SIGNAL_RULES) {
    const evidence: LegalSignalEvidence[] = [];

    for (const re of rule.patterns) {
      const flags = re.global ? re.flags : `${re.flags}g`;
      const rx = new RegExp(re.source, flags);
      let m: RegExpExecArray | null;
      while ((m = rx.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        const excerpt = text.slice(Math.max(0, start - 100), Math.min(text.length, end + 100)).trim();
        if (rule.negativePatterns?.length) {
          if (rule.negativePatterns.some((np) => np.test(excerpt))) continue;
        }
        evidence.push({ text: excerpt.slice(0, 320), sourceType: "vortext" });
        if (evidence.length >= 6) break;
      }
      if (evidence.length >= 6) break;
    }

    if (evidence.length === 0) continue;

    const dedup = new Map<string, LegalSignalEvidence>();
    for (const e of evidence) {
      const k = e.text.slice(0, 48);
      if (!dedup.has(k)) dedup.set(k, e);
    }
    const evFinal = [...dedup.values()].slice(0, 4);
    const hits = evFinal.length;
    const severity = bumpSeverity(rule.baseSeverity, hits);
    const confidence = Math.min(1, 0.32 + hits * 0.14 + (severity === "high" ? 0.08 : 0));

    signals.push({
      id: `${rule.ruleId}`,
      signalType: rule.signalType,
      title: rule.title,
      summary: rule.summary,
      severity,
      confidence,
      evidence: evFinal,
      affectsCategories: [...rule.affectsCategories],
      scoreDelta: rule.scoreDeltaHint ? { ...rule.scoreDeltaHint } : undefined,
      suggestedQuestion: rule.suggestedQuestion,
      suggestedClarification: rule.suggestedClarification,
      recommendedAction: rule.recommendedAction,
    });
  }

  signals.sort((a, b) => {
    const d = severityRank(b.severity) - severityRank(a.severity);
    if (d !== 0) return d;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  return signals.slice(0, 10);
}
