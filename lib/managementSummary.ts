import type { ScoreResult, Finding } from "./scoring";

export type ManagementSummaryInput = {
  scoreResult?: ScoreResult | {
    total?: number;
    level?: string;
    findingsSorted?: Partial<Finding & { category?: string }>[] | null;
  };
  keyFacts?: Record<string, string> | null;
  changeOrderAnalysis?: { offerStrategySummary?: { executiveSummary?: string | null } | null } | null;
  clarificationQuestions?: unknown[] | null;
};

function normalizeTotal(scoreResult?: ManagementSummaryInput["scoreResult"]): number | null {
  if (!scoreResult) return null;
  const t = (scoreResult as ScoreResult).total ?? scoreResult.total;
  if (typeof t !== "number" || Number.isNaN(t)) return null;
  return t;
}

function normalizeLevel(scoreResult?: ManagementSummaryInput["scoreResult"]): string | null {
  if (!scoreResult) return null;
  const l = (scoreResult as ScoreResult).level ?? scoreResult.level;
  return typeof l === "string" && l.trim() ? l.trim() : null;
}

function normalizeFindings(
  scoreResult?: ManagementSummaryInput["scoreResult"],
): Array<Partial<Finding & { category?: string }>> {
  if (!scoreResult) return [];
  const arr = (scoreResult as ScoreResult).findingsSorted ?? scoreResult.findingsSorted;
  return Array.isArray(arr) ? arr : [];
}

function levelToSentence(total: number | null, level: string | null): string | null {
  if (total == null && !level) return null;

  if (level) {
    switch (level) {
      case "hochriskant":
        return "Die Ausschreibung weist ein hohes Risiko- und Konfliktpotenzial auf.";
      case "mittel":
        return "Die Ausschreibung zeigt ein moderates Risikoprofil mit mehreren kritischen Punkten.";
      case "solide":
        return "Die Ausschreibung macht insgesamt einen soliden Eindruck mit überschaubaren Risiken.";
      case "sauber":
        return "Die Ausschreibung wirkt aus heutiger Sicht weitgehend sauber und gut strukturiert.";
      default:
        break;
    }
  }

  if (total == null) return null;
  if (total < 40) {
    return "Die Ausschreibung macht insgesamt einen soliden Eindruck mit überschaubaren Risiken.";
  }
  if (total < 70) {
    return "Die Ausschreibung weist ein erhöhtes Risiko auf und sollte vor Angebotsabgabe sorgfältig geprüft werden.";
  }
  return "Die Ausschreibung ist kritisch zu bewerten und birgt ein deutlich erhöhtes Risiko für Nachträge und Konflikte.";
}

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

function sanitizeDetailText(detail: string): string {
  const text = detail.replace(/\s+/g, " ").trim();
  if (!text) return "";

  // grobe Satzaufteilung
  const rawSentences = text.split(/(?<=[.!?])\s+/);
  const cleaned = rawSentences.filter((s) => {
    const lower = s.toLowerCase();
    return !TECHNICAL_TOKENS.some((token) => lower.includes(token));
  });

  return cleaned.slice(0, 2).join(" ");
}

type RiskClusterId =
  | "contracts_lv"
  | "technical"
  | "interfaces"
  | "quantities"
  | "calculation"
  | "other";

const CATEGORY_TO_CLUSTER: Record<string, RiskClusterId> = {
  vertrags_lv_risiken: "contracts_lv",
  normen: "contracts_lv",
  vollstaendigkeit: "technical",
  technische_vollstaendigkeit: "technical",
  schnittstellen_nebenleistungen: "interfaces",
  mengen_massenermittlung: "quantities",
  kalkulationsunsicherheit: "calculation",
};

const CLUSTER_DESCRIPTIONS: Record<RiskClusterId, string> = {
  contracts_lv: "vertragliche Regelungen und Ausschreibungstexte",
  technical: "technische Beschreibung und Systemfestlegung",
  interfaces: "Schnittstellen, Nebenleistungen und Koordination mit anderen Gewerken",
  quantities: "Mengen, Massenermittlung und LV-Struktur",
  calculation: "Kalkulations- und wirtschaftliche Risiken",
  other: "weitere fachliche Punkte",
};

function summarizeRiskProfile(
  findings: Array<Partial<Finding & { category?: string }>>,
): string | null {
  if (!findings.length) return null;

  const bySeverityRank: Record<string, number> = { high: 3, critical: 3, medium: 2, low: 1 };
  const clusterWeights: Record<RiskClusterId, number> = {
    contracts_lv: 0,
    technical: 0,
    interfaces: 0,
    quantities: 0,
    calculation: 0,
    other: 0,
  };

  for (const f of findings) {
    const sev = ((f.severity as string) ?? "").toLowerCase();
    const sevWeight = bySeverityRank[sev] ?? 1;
    const penalty = typeof f.penalty === "number" ? Math.max(f.penalty, 0) : 0;
    const baseWeight = sevWeight * (1 + penalty / 10);

    const rawCat = (f.category ?? "").toString().toLowerCase();
    const cluster: RiskClusterId =
      CATEGORY_TO_CLUSTER[rawCat] ?? CATEGORY_TO_CLUSTER[rawCat.replace(/-/g, "_")] ?? "other";

    clusterWeights[cluster] += baseWeight;
  }

  const entries = Object.entries(clusterWeights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) return null;

  const top = entries.slice(0, 2).map(([id]) => id as RiskClusterId);
  const labels = top.map((id) => CLUSTER_DESCRIPTIONS[id]);

  if (labels.length === 1) {
    return `Schwerpunkte der Risiken liegen vor allem in ${labels[0]}, wo mehrere Punkte unklar oder nur teilweise geregelt sind.`;
  }

  if (labels.length >= 2) {
    return `Die wesentlichen Risiken betreffen insbesondere ${labels[0]} sowie ${labels[1]}, mit erhöhtem Klärungs- und Abstimmungsbedarf.`;
  }

  return null;
}

function summarizeTopRisks(
  findings: Array<Partial<Finding & { category?: string }>>,
): string | null {
  if (!findings.length) return null;

  const bySeverityRank: Record<string, number> = { high: 3, critical: 3, medium: 2, low: 1 };
  const weighted = [...findings].sort((a, b) => {
    const sa = bySeverityRank[(a.severity as string) ?? "low"] ?? 1;
    const sb = bySeverityRank[(b.severity as string) ?? "low"] ?? 1;
    if (sb !== sa) return sb - sa;
    const pa = typeof a.penalty === "number" ? a.penalty : 0;
    const pb = typeof b.penalty === "number" ? b.penalty : 0;
    return pb - pa;
  });

  const top = weighted.slice(0, 3);
  if (!top.length) return null;

  const topics: string[] = [];
  for (const f of top) {
    const title = (f.title ?? "").toString().trim();
    const rawDetail = (f.detail ?? "").toString().trim();
    const detail = sanitizeDetailText(rawDetail);

    if (title) {
      topics.push(title);
    } else if (detail) {
      topics.push(detail);
    }
  }

  if (!topics.length) return null;

  const quoted = topics.slice(0, 3).map((t) => `„${t}“`);

  if (quoted.length === 1) {
    return `Inhaltlich steht insbesondere das Thema ${quoted[0]} im Fokus.`;
  }
  if (quoted.length === 2) {
    return `Inhaltlich stehen vor allem die Themen ${quoted[0]} und ${quoted[1]} im Fokus.`;
  }
  return `Inhaltlich stehen vor allem die Themen ${quoted[0]}, ${quoted[1]} sowie ${quoted[2]} im Fokus.`;
}

function summarizeFollowUps(
  clarificationQuestions?: unknown[] | null,
  changeOrderAnalysis?: ManagementSummaryInput["changeOrderAnalysis"],
): string | null {
  const hasQuestions = Array.isArray(clarificationQuestions) && clarificationQuestions.length > 0;
  const hasChangeOrder =
    !!changeOrderAnalysis &&
    !!changeOrderAnalysis.offerStrategySummary &&
    typeof changeOrderAnalysis.offerStrategySummary.executiveSummary === "string" &&
    changeOrderAnalysis.offerStrategySummary.executiveSummary.trim().length > 0;

  if (hasQuestions && hasChangeOrder) {
    return "Zu einzelnen Punkten sollten Rückfragen und Angebotsklarstellungen frühzeitig mit dem Auftraggeber abgestimmt werden, um Nachtragsrisiken zu begrenzen.";
  }
  if (hasQuestions) {
    return "Aus den identifizierten Risiken ergeben sich Rückfragen, die vor Angebotsabgabe mit dem Auftraggeber geklärt werden sollten.";
  }
  if (hasChangeOrder) {
    return "Die Nachtragsanalyse zeigt zusätzliches Potenzial für Nachträge und Anpassungen, das in der Angebotsstrategie berücksichtigt werden sollte.";
  }
  return null;
}

export function buildManagementSummary(input: ManagementSummaryInput): string | null {
  const total = normalizeTotal(input.scoreResult);
  const level = normalizeLevel(input.scoreResult);
  const findings = normalizeFindings(input.scoreResult);

  const firstSentence = levelToSentence(total, level);
  const profileSentence = summarizeRiskProfile(findings);
  const risksSentence = summarizeTopRisks(findings);
  const followUpSentence = summarizeFollowUps(input.clarificationQuestions, input.changeOrderAnalysis);

  const sentences = [firstSentence, profileSentence, risksSentence, followUpSentence].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );

  if (!sentences.length) return null;

  // Als Absätze zurückgeben, damit das UI sie gut lesbar darstellen kann
  return sentences.join("\n\n");
}

