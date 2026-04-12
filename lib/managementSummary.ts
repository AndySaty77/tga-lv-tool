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
  /**
   * Optional: bereits berechnete Nachtrags-Kennzahl (keine Neuberechnung).
   * Nur für sprachliche Trennung: niedriges Gesamtrisiko vs. erhöhtes Nachtragspotenzial.
   */
  changePotentialSummary?: {
    v2Debug?: { potentialScore?: number; enforceabilityScore?: number } | null;
    overallIndex?: number;
  } | null;
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

  const rawSentences = text.split(/(?<=[.!?])\s+/);
  const cleaned = rawSentences.filter((s) => {
    const lower = s.toLowerCase();
    return !TECHNICAL_TOKENS.some((token) => lower.includes(token));
  });

  return cleaned.slice(0, 2).join(" ");
}

function truncateTopic(text: string, maxLen = 72): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1).trimEnd()}…`;
}

function quoteTopic(t: string): string {
  return `„${truncateTopic(t).replace(/"/g, "")}“`;
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

function isGenericRiskProfileBoilerplate(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const single =
    /^Schwerpunkte der Risiken liegen vor allem in .+,\s*wo mehrere Punkte unklar oder nur teilweise geregelt sind\.$/;
  const double =
    /^Die wesentlichen Risiken betreffen insbesondere .+ sowie .+,\s*mit erhöhtem Klärungs- und Abstimmungsbedarf\.$/;
  return single.test(t) || double.test(t);
}

/** Sortierung wie bisher bei summarizeTopRisks: stärkste Findings zuerst. */
function collectTopFindingTopics(
  findings: Array<Partial<Finding & { category?: string }>>,
  maxTopics: number,
): string[] {
  if (!findings.length || maxTopics < 1) return [];

  const bySeverityRank: Record<string, number> = { high: 3, critical: 3, medium: 2, low: 1 };
  const weighted = [...findings].sort((a, b) => {
    const sa = bySeverityRank[(a.severity as string) ?? "low"] ?? 1;
    const sb = bySeverityRank[(b.severity as string) ?? "low"] ?? 1;
    if (sb !== sa) return sb - sa;
    const pa = typeof a.penalty === "number" ? a.penalty : 0;
    const pb = typeof b.penalty === "number" ? b.penalty : 0;
    return pb - pa;
  });

  const topics: string[] = [];
  for (const f of weighted) {
    if (topics.length >= maxTopics) break;
    const title = (f.title ?? "").toString().trim();
    const rawDetail = (f.detail ?? "").toString().trim();
    const detail = sanitizeDetailText(rawDetail);
    const pick = title || detail;
    if (pick) topics.push(pick);
  }

  return topics;
}

function followUpTriggers(
  clarificationQuestions?: unknown[] | null,
  changeOrderAnalysis?: ManagementSummaryInput["changeOrderAnalysis"],
): { hasQuestions: boolean; hasChangeOrder: boolean } {
  const hasQuestions = Array.isArray(clarificationQuestions) && clarificationQuestions.length > 0;
  const hasChangeOrder =
    !!changeOrderAnalysis &&
    !!changeOrderAnalysis.offerStrategySummary &&
    typeof changeOrderAnalysis.offerStrategySummary.executiveSummary === "string" &&
    changeOrderAnalysis.offerStrategySummary.executiveSummary.trim().length > 0;
  return { hasQuestions, hasChangeOrder };
}

/** Gleiche Trigger wie zuvor; Texte für die 3-Teil-Summary liegen in {@link empfehlungSentence}. */
function summarizeFollowUps(
  clarificationQuestions?: unknown[] | null,
  changeOrderAnalysis?: ManagementSummaryInput["changeOrderAnalysis"],
): string | null {
  const { hasQuestions, hasChangeOrder } = followUpTriggers(clarificationQuestions, changeOrderAnalysis);

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

function findingsMentionSchedulePressure(
  findings: Array<Partial<Finding & { category?: string }>>,
): boolean {
  const keys = ["termin", "frist", "bestand", "vertragsstrafe", "verzug", "liquidität", "bauzeit"];
  for (const f of findings) {
    const s = `${(f.title ?? "").toString()} ${(f.detail ?? "").toString()}`.toLowerCase();
    if (keys.some((k) => s.includes(k))) return true;
  }
  return false;
}

/**
 * Wenn die Gesamtbewertung niedrig ist, das Nachtragspotenzial aber mindestens „erhöht“ (≥50/100) ist:
 * klarstellen, dass kommerzielle Hebel separat zu betrachten sind (ohne neue Kennzahl).
 */
function riskVsClaimBridge(
  total: number | null,
  level: string | null,
  changePotentialSummary?: ManagementSummaryInput["changePotentialSummary"],
): string | null {
  const lowOverall =
    level === "solide" || level === "sauber" || (total != null && total < 40);
  if (!lowOverall) return null;
  const cp = changePotentialSummary;
  if (!cp) return null;
  let score: number | null = null;
  const v2 = cp.v2Debug;
  if (v2 && typeof v2.potentialScore === "number" && typeof v2.enforceabilityScore === "number") {
    score = Math.round(v2.potentialScore);
  } else if (typeof cp.overallIndex === "number" && Number.isFinite(cp.overallIndex)) {
    score = Math.round(cp.overallIndex);
  }
  if (score == null || score < 50) return null;

  return "Die Gesamtlage kann überschaubar wirken; gleichzeitig ist das Nachtragspotenzial aus Abgrenzung und Schnittstellen erhöht – diese Themen sollten in Angebot und Kalkulation separat und bewusst adressiert werden.";
}

/** Absatz 1: Einordnung – ohne „sauber/gut strukturiert“-Floskeln. */
function einordnungSentence(
  total: number | null,
  level: string | null,
  findings: Array<Partial<Finding & { category?: string }>>,
): string | null {
  if (level === "hochriskant") {
    return "Das LV ist aus Angebots- und Risikosicht kritisch zu bewerten.";
  }
  if (level === "mittel") {
    return "Das LV ist insgesamt bearbeitbar, enthält aber mehrere klärungsrelevante Punkte.";
  }
  if (level === "solide") {
    return "Die Ausschreibung ist grundsätzlich kalkulierbar, weist aber noch einzelne Abgrenzungs- und Klärungsthemen auf.";
  }
  if (level === "sauber") {
    return "Das LV ist grundsätzlich bearbeitbar; die Risiken sind überwiegend überschaubar.";
  }

  if (total != null) {
    if (total < 40) {
      return "Die Ausschreibung ist grundsätzlich kalkulierbar, weist aber noch einzelne Abgrenzungs- und Klärungsthemen auf.";
    }
    if (total < 70) {
      return "Das LV ist insgesamt bearbeitbar, enthält aber mehrere klärungsrelevante Punkte.";
    }
    return "Das LV ist aus Angebots- und Risikosicht kritisch zu bewerten.";
  }

  if (findings.length) {
    const bySeverityRank: Record<string, number> = { high: 3, critical: 3, medium: 2, low: 1 };
    let maxRank = 0;
    for (const f of findings) {
      const r = bySeverityRank[((f.severity as string) ?? "").toLowerCase()] ?? 0;
      if (r > maxRank) maxRank = r;
    }
    if (maxRank >= 3) {
      return "Das LV ist insgesamt bearbeitbar, enthält aber mehrere klärungsrelevante Punkte.";
    }
    if (maxRank >= 2) {
      return "Die Ausschreibung ist grundsätzlich kalkulierbar, weist aber relevante Abgrenzungs- und Schnittstellenthemen auf.";
    }
    return "Das LV ist grundsätzlich bearbeitbar; die Risiken sind überwiegend überschaubar.";
  }

  return null;
}

/** Absatz 2: Haupttreiber – konkrete Finding-Themen, sonst defensiver Fallback. */
function formatMainDriversParagraph(
  findings: Array<Partial<Finding & { category?: string }>>,
  topics: string[],
): string {
  const q = topics.map(quoteTopic);

  if (q.length >= 4) {
    return `Als Haupttreiber zeigen sich ${q[0]}, ${q[1]}, ${q[2]} und ${q[3]}.`;
  }
  if (q.length === 3) {
    return `Als Haupttreiber zeigen sich ${q[0]}, ${q[1]} sowie ${q[2]}.`;
  }
  if (q.length === 2) {
    return `Als Haupttreiber zeigen sich ${q[0]} und ${q[1]}.`;
  }
  if (q.length === 1) {
    return `Maßgeblich ist ${q[0]}; weitere LV-Positionen sollten ergänzend geprüft werden.`;
  }

  const profile = summarizeRiskProfile(findings);
  if (profile && !isGenericRiskProfileBoilerplate(profile)) {
    return profile.trim();
  }

  if (findings.length) {
    return "Die Risiken verteilen sich über mehrere Bereiche der Ausschreibung; eine Detailprüfung im Team ist erforderlich.";
  }

  return "Konkrete Einzelfindings liegen nicht vor; die Einordnung stützt sich auf das Gesamtrisiko.";
}

/** Absatz 3: Empfehlung – Handlung für Angebots- und Kalkulationsteam (Trigger wie {@link summarizeFollowUps}). */
function empfehlungSentence(
  level: string | null,
  total: number | null,
  findings: Array<Partial<Finding & { category?: string }>>,
  clarificationQuestions?: unknown[] | null,
  changeOrderAnalysis?: ManagementSummaryInput["changeOrderAnalysis"],
): string {
  const schedule = findingsMentionSchedulePressure(findings);
  const { hasQuestions, hasChangeOrder } = followUpTriggers(clarificationQuestions, changeOrderAnalysis);
  const followUpContext = summarizeFollowUps(clarificationQuestions, changeOrderAnalysis);

  if (followUpContext) {
    if (hasQuestions && hasChangeOrder) {
      return (
        "Vor Angebotsabgabe sollten diese Punkte gezielt per Rückfrage geklärt und im Angebot sauber abgegrenzt werden; " +
        "die Nachtragsperspektive sollte in der Angebotsstrategie berücksichtigt werden."
      );
    }
    if (hasQuestions) {
      return "Vor Angebotsabgabe sollten diese Punkte gezielt per Rückfrage geklärt und im Angebot sauber abgegrenzt werden.";
    }
    return "Die Nachtragslage sollte in der Angebotsstrategie berücksichtigt und mit sauber abgegrenztem Leistungsbild dokumentiert werden.";
  }

  const highRisk =
    level === "hochriskant" || (total != null && total >= 70);
  const midRisk =
    level === "mittel" || (total != null && total >= 40 && total < 70);
  const lowRisk =
    level === "solide" ||
    level === "sauber" ||
    (total != null && total < 40);

  if (highRisk) {
    let s =
      "Eine Angebotsabgabe ist nur mit konsequenter Klarstellung und dokumentierter Abgrenzung sinnvoll.";
    if (schedule) {
      s += " Termin- und Fristthemen sollten dabei explizit gegenkalkuliert und dokumentiert werden.";
    }
    return s;
  }
  if (midRisk) {
    let s =
      "Ohne belastbare Rückfragen und klare Angebotsklarstellungen steigt das Risiko späterer Diskussionen deutlich.";
    if (schedule) {
      s += " Bei Termin- oder Bestandsdruck zusätzlich Reserven einplanen.";
    }
    return s;
  }
  if (lowRisk) {
    return "Das Angebot sollte die vereinbarten Punkte konsistent und nachvollziehbar abbilden; verbleibende Unklarheiten dokumentieren.";
  }

  return "Vor Angebotsabgabe die offenen Punkte im Team abstimmen und im Angebot klar abgrenzen.";
}

export function buildManagementSummary(input: ManagementSummaryInput): string | null {
  const total = normalizeTotal(input.scoreResult);
  const level = normalizeLevel(input.scoreResult);
  const findings = normalizeFindings(input.scoreResult);

  const topics = collectTopFindingTopics(findings, 4);
  const einordnung = einordnungSentence(total, level, findings);
  if (!einordnung) return null;

  const bridge = riskVsClaimBridge(total, level, input.changePotentialSummary);
  const mainDrivers = formatMainDriversParagraph(findings, topics);
  const empfehlung = empfehlungSentence(
    level,
    total,
    findings,
    input.clarificationQuestions,
    input.changeOrderAnalysis,
  );

  const parts = [einordnung];
  if (bridge) parts.push(bridge);
  parts.push(mainDrivers, empfehlung);
  return parts.join("\n\n");
}
