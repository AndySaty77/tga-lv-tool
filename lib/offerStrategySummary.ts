/**
 * Management Summary + Strategievarianten auf Dokumentebene.
 * Nur auf Basis bestehender ChangePotentialSummary, Items, Clusters und abgeleiteter Maßnahmen.
 * Keine freie Erkennung neuer Nachtragspotenziale.
 */

import OpenAI from "openai";
import type {
  ChangePotentialSummary,
  ChangePotentialItem,
  OfferStrategySummary,
  OfferStrategyApproach,
  OfferStrategyVariant,
  ChangePotentialFieldType,
  ChangePotentialMechanism,
  ChangePotentialImpactLevel,
  ChangePotentialEnforceability,
  ChangePotentialRecommendedAction,
} from "./changePotentialModel";
import type { CommercialActionsFromChangePotential } from "./changePotentialCommercialActions";
import { leadingNachtragspotenzialScore } from "./nachtrag-v2/leadingPotentialScore";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUMMARY_TIMEOUT_MS = 22000;
const MAX_RESPONSE_TOKENS = 1800;
const MAX_ITEMS_SNIPPET = 12;
const MAX_CLUSTERS_SNIPPET = 5;
const MAX_LIST_ITEMS = 6;
const APPROACHES: OfferStrategyApproach[] = ["defensiv", "ausgewogen", "offensiv"];

const HIGH_IMPACT_LEVELS: ChangePotentialImpactLevel[] = ["hoch", "sehr_hoch"];
const STRONG_ENFORCEABILITY_LEVELS: ChangePotentialEnforceability[] = ["gut", "sehr_gut"];
const WEAK_ENFORCEABILITY_LEVELS: ChangePotentialEnforceability[] = ["schwach", "mittel"];

function isOfferStrategyDebugEnabled(): boolean {
  return process.env.DEBUG_OFFER_STRATEGY === "true";
}

type SerializableItemSnapshot = {
  id: string;
  title: string;
  fieldType: ChangePotentialFieldType;
  changeMechanism: ChangePotentialMechanism;
  impactLevel: ChangePotentialImpactLevel;
  enforceability: ChangePotentialEnforceability;
  recommendedAction: ChangePotentialRecommendedAction;
  reasoning: string;
  sourceType: string;
  sourceQuote?: string;
  trade?: string;
  questionDraft?: string;
  clarificationDraft?: string;
};

type AggregatedSnapshot = {
  topFieldTypes: Array<{ fieldType: ChangePotentialFieldType; count: number }>;
  topMechanisms: Array<{ mechanism: ChangePotentialMechanism; count: number }>;
  highImpactCount: number;
  veryHighImpactCount: number;
  strongEnforceabilityCount: number;
  highImpactStrongEnforceabilityCount: number;
  highImpactWeakEnforceabilityCount: number;
  recommendedActionCounts: Record<ChangePotentialRecommendedAction, number>;
  dominantSourceTypes: string[];
  dominantTrades: string[];
};

function sortByImpactAndConfidence(items: ChangePotentialItem[]): ChangePotentialItem[] {
  const impactRank: Record<ChangePotentialImpactLevel, number> = {
    sehr_hoch: 4,
    hoch: 3,
    mittel: 2,
    niedrig: 1,
  };
  const enforceRank: Record<ChangePotentialEnforceability, number> = {
    sehr_gut: 4,
    gut: 3,
    mittel: 2,
    schwach: 1,
  };
  return [...items].sort((a, b) => {
    const aImpact = impactRank[a.impactLevel] ?? 0;
    const bImpact = impactRank[b.impactLevel] ?? 0;
    if (aImpact !== bImpact) return bImpact - aImpact;
    const aEnf = enforceRank[a.enforceability] ?? 0;
    const bEnf = enforceRank[b.enforceability] ?? 0;
    if (aEnf !== bEnf) return bEnf - aEnf;
    const aConf = a.llmConfidence ?? 0;
    const bConf = b.llmConfidence ?? 0;
    if (aConf !== bConf) return bConf - aConf;
    return (b.reasoning?.length ?? 0) - (a.reasoning?.length ?? 0);
  });
}

function buildItemSnapshots(summary: ChangePotentialSummary, maxItems = 8): SerializableItemSnapshot[] {
  const baseItems =
    (summary.topItemsForDisplay && summary.topItemsForDisplay.length > 0
      ? summary.topItemsForDisplay
      : (summary.items ?? []).filter((i) => !i.candidate)) ?? [];
  if (!baseItems.length) return [];
  const sorted = baseItems.slice(0, maxItems);
  return sorted.map((i) => ({
    id: i.id,
    title: i.title,
    fieldType: i.fieldType,
    changeMechanism: i.changeMechanism,
    impactLevel: i.impactLevel,
    enforceability: i.enforceability,
    recommendedAction: i.recommendedAction,
    reasoning: i.reasoning,
    sourceType: i.sourceType,
    sourceQuote: i.sourceQuote,
    trade: i.trade,
    questionDraft: i.questionDraft,
    clarificationDraft: i.clarificationDraft,
  }));
}

function buildAggregatedSnapshot(summary: ChangePotentialSummary): AggregatedSnapshot {
  const items = (summary.items ?? []).filter((i) => !i.candidate);
  const recommendedActionCounts: Record<ChangePotentialRecommendedAction, number> = {
    rueckfrage: 0,
    angebotsklarstellung: 0,
    kalkulatorisch_absichern: 0,
    claim_feld_beobachten: 0,
    nicht_verfolgen: 0,
  };
  const sourceTypeCounts: Record<string, number> = {};
  const tradeCounts: Record<string, number> = {};
  let highImpactStrong = 0;
  let highImpactWeak = 0;

  for (const item of items) {
    recommendedActionCounts[item.recommendedAction] =
      (recommendedActionCounts[item.recommendedAction] ?? 0) + 1;

    if (item.sourceType) {
      const key = String(item.sourceType);
      sourceTypeCounts[key] = (sourceTypeCounts[key] ?? 0) + 1;
    }
    if (item.trade) {
      const key = item.trade;
      tradeCounts[key] = (tradeCounts[key] ?? 0) + 1;
    }

    if (HIGH_IMPACT_LEVELS.includes(item.impactLevel)) {
      if (STRONG_ENFORCEABILITY_LEVELS.includes(item.enforceability)) {
        highImpactStrong += 1;
      } else if (WEAK_ENFORCEABILITY_LEVELS.includes(item.enforceability)) {
        highImpactWeak += 1;
      }
    }
  }

  const dominantSourceTypes = Object.entries(sourceTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  const dominantTrades = Object.entries(tradeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  return {
    topFieldTypes: summary.topFields ?? [],
    topMechanisms: summary.topMechanisms ?? [],
    highImpactCount: summary.highImpactCount,
    veryHighImpactCount: summary.veryHighImpactCount,
    strongEnforceabilityCount: summary.strongEnforceabilityCount,
    highImpactStrongEnforceabilityCount: highImpactStrong,
    highImpactWeakEnforceabilityCount: highImpactWeak,
    recommendedActionCounts,
    dominantSourceTypes,
    dominantTrades,
  };
}

function deriveFallbackApproachFromSummary(summary: ChangePotentialSummary): OfferStrategyApproach {
  const items = summary.items ?? [];
  if (!items.length) return "ausgewogen";

  const highImpactItems = items.filter((i) => HIGH_IMPACT_LEVELS.includes(i.impactLevel));
  if (!highImpactItems.length) {
    return "ausgewogen";
  }

  const strongCount = highImpactItems.filter((i) =>
    STRONG_ENFORCEABILITY_LEVELS.includes(i.enforceability)
  ).length;
  const weakCount = highImpactItems.filter((i) =>
    WEAK_ENFORCEABILITY_LEVELS.includes(i.enforceability)
  ).length;

  /**
   * Fallback-Regel für recommendedApproach (wenn LLM keinen gültigen Wert liefert):
   * - "offensiv": Viele hohe Hebel mit guter/sehr guter Durchsetzbarkeit dominieren.
   * - "defensiv": Viele hohe Hebel mit schwacher/mittlerer Durchsetzbarkeit dominieren.
   * - "ausgewogen": In allen anderen Fällen (Mischlage / wenig hohe Hebel).
   */
  if (strongCount >= 2 && strongCount >= weakCount * 1.2) {
    return "offensiv";
  }
  if (weakCount >= 2 && weakCount >= strongCount * 1.2) {
    return "defensiv";
  }
  return "ausgewogen";
}

function envEnabled(): boolean {
  return (
    process.env.CHANGE_POTENTIAL_OFFER_STRATEGY_ENABLED === "true" &&
    !!process.env.OPENAI_API_KEY
  );
}

function buildContext(summary: ChangePotentialSummary, actions: CommercialActionsFromChangePotential | null): string {
  const itemSnapshots = buildItemSnapshots(summary, MAX_ITEMS_SNIPPET);
  const aggregates = buildAggregatedSnapshot(summary);

  const nachtragKennzahl = leadingNachtragspotenzialScore(summary);
  const context: Record<string, unknown> = {
    overallIndex: nachtragKennzahl,
    totalItems: summary.totalItems,
    highImpactCount: summary.highImpactCount,
    veryHighImpactCount: summary.veryHighImpactCount,
    strongEnforceabilityCount: summary.strongEnforceabilityCount,
    items: itemSnapshots,
    aggregates,
  };

  if (summary.negotiationClusters && summary.negotiationClusters.length > 0) {
    context["topNegotiationClusters"] = summary.negotiationClusters.slice(0, MAX_CLUSTERS_SNIPPET).map((c) => ({
      id: c.id,
      title: c.title,
      shortTitle: c.shortTitle,
      relatedItemIds: c.relatedItemIds,
      dominantFieldTypes: c.dominantFieldTypes,
      dominantMechanisms: c.dominantMechanisms,
      affectedTrades: c.affectedTrades,
      commercialWeight: c.commercialWeight,
      enforceabilityAssessment: c.enforceabilityAssessment,
      recommendedNegotiationAction: c.recommendedNegotiationAction,
      whyThisMatters: c.whyThisMatters,
    }));
  }

  if (actions) {
    context["commercialActions"] = {
      questions: actions.questions.slice(0, 10).map((q) => ({
        id: q.id,
        question: q.question,
        reason: q.reason,
        severity: q.severity,
        itemId: q.itemId,
        fieldType: q.fieldType,
        changeMechanism: q.changeMechanism,
        sourceType: q.sourceType,
        sourceQuote: q.sourceQuote,
        trade: undefined as string | undefined,
      })),
      clarifications: actions.clarifications.slice(0, 10).map((c) => ({
        id: c.id,
        clarification: c.clarification,
        reason: c.reason,
        severity: c.severity,
        itemId: c.itemId,
        fieldType: c.fieldType,
        changeMechanism: c.changeMechanism,
        sourceType: c.sourceType,
        sourceQuote: c.sourceQuote,
      })),
      pricingHints: actions.pricingHints.slice(0, 10).map((p) => ({
        id: p.id,
        hint: p.hint,
        reason: p.reason,
        itemId: p.itemId,
        fieldType: p.fieldType,
        sourceType: p.sourceType,
        sourceQuote: p.sourceQuote,
      })),
      monitoringHints: actions.monitoringHints.slice(0, 10).map((m) => ({
        id: m.id,
        hint: m.hint,
        reason: m.reason,
        itemId: m.itemId,
        fieldType: m.fieldType,
        sourceType: m.sourceType,
        sourceQuote: m.sourceQuote,
      })),
    };
  }

  return JSON.stringify(context, null, 2);
}

function ensureStringArray(val: unknown, max: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim().slice(0, 300))
    .slice(0, max);
}

function parseVariant(raw: unknown): OfferStrategyVariant | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const description = typeof o.description === "string" ? o.description.trim().slice(0, 400) : "";
  const expectedTradeoff = typeof o.expectedTradeoff === "string" ? o.expectedTradeoff.trim().slice(0, 300) : "";
  const keyActions = ensureStringArray(o.keyActions, 5);
  if (!description || !expectedTradeoff) return null;
  return { description, expectedTradeoff, keyActions };
}

function buildDeterministicExecutiveSummary(summary: ChangePotentialSummary, actions: CommercialActionsFromChangePotential | null): string {
  const parts: string[] = [];
  const index = leadingNachtragspotenzialScore(summary);
  const total = summary.totalItems;

  // 1) Satz: Gesamtlage
  if (index >= 70) {
    parts.push(
      `Das Leistungsverzeichnis weist ein hohes Nachtragspotenzial auf (Index ${index}/100) mit ${total} erkannten Nachtragsfeldern.`
    );
  } else if (index >= 40) {
    parts.push(
      `Das Leistungsverzeichnis zeigt ein erhöhtes Nachtragspotenzial (Index ${index}/100) mit ${total} relevanten Nachtragsfeldern.`
    );
  } else {
    parts.push(
      `Das Leistungsverzeichnis wirkt insgesamt moderat risikobehaftet (Nachtragspotenzial-Index ${index}/100) bei ${total} erkannten Nachtragsfeldern.`
    );
  }

  // 2) Sätze: wichtigste konkrete Nachtragsmuster aus Top-Items
  const topItems = (summary.topItemsForDisplay && summary.topItemsForDisplay.length > 0
    ? summary.topItemsForDisplay
    : summary.items ?? []).slice(0, 3);
  if (topItems.length > 0) {
    const itemPhrases = topItems.map((it) => {
      const fieldType = it.fieldType.replace(/_/g, " ");
      const mech = it.changeMechanism.replace(/_/g, " ");
      return `${it.title} (Feldtyp ${fieldType}, Mechanismus ${mech}, Hebel ${it.impactLevel})`;
    });
    parts.push(
      `Kommerziell prägend sind insbesondere folgende Nachtragsmuster: ${itemPhrases.join("; ")}.`
    );
  }

  // 3) Satz: empfohlene Angebotslinie / Maßnahmen aus CommercialActions
  const act = actions ?? { questions: [], clarifications: [], pricingHints: [], monitoringHints: [] };
  const counts: string[] = [];
  if (act.questions.length > 0) counts.push(`${act.questions.length} Rückfragen`);
  if (act.clarifications.length > 0) counts.push(`${act.clarifications.length} Angebotsklarstellungen`);
  if (act.pricingHints.length > 0) counts.push(`${act.pricingHints.length} Kalkulationshinweise`);
  if (act.monitoringHints.length > 0) counts.push(`${act.monitoringHints.length} Claim-Monitoring-Hinweise`);
  if (counts.length > 0) {
    parts.push(
      `Kurzfristig sollten insbesondere ${counts.join(", ")} vorbereitet werden, um die wirtschaftlich wichtigsten Unklarheiten vor Angebotsabgabe zu klären.`
    );
  }

  return parts.join(" ");
}

function buildFallbackVariants(): OfferStrategySummary["strategyVariants"] {
  const makeVariant = (label: string): OfferStrategyVariant => ({
    description: `${label} Angebotslinie: Mischung aus klarer Risikoadressierung und pragmatischer Wettbewerbsfähigkeit.`,
    expectedTradeoff: "Abwägung zwischen Marge, Auftragswahrscheinlichkeit und Claim-Risiken in einem ausgewogenen Rahmen.",
    keyActions: [
      "Wesentliche Nachtragsfelder im Angebotstext adressieren",
      "kritische Unklarheiten als Rückfragen oder Klarstellungen aufnehmen",
      "Kalkulatorische Sicherheiten für schwer einschätzbare Risiken einplanen",
    ],
  });
  return {
    defensiv: makeVariant("Defensive"),
    ausgewogen: makeVariant("Ausgewogene"),
    offensiv: makeVariant("Offensive"),
  };
}

function parsePayload(raw: unknown, summary: ChangePotentialSummary, actions: CommercialActionsFromChangePotential | null): OfferStrategySummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rawExecutiveSummary = typeof o.executiveSummary === "string" ? o.executiveSummary.trim().slice(0, 1200) : "";
  const rawFinalRecommendation = typeof o.finalRecommendation === "string" ? o.finalRecommendation.trim().slice(0, 600) : "";
  const approachFromModel = APPROACHES.includes(o.recommendedApproach as OfferStrategyApproach)
    ? (o.recommendedApproach as OfferStrategyApproach)
    : null;
  const recommendedApproach =
    approachFromModel ?? deriveFallbackApproachFromSummary(summary);

  const topRisks = ensureStringArray(o.topRisks, MAX_LIST_ITEMS);
  const topNegotiationPoints = ensureStringArray(o.topNegotiationPoints, MAX_LIST_ITEMS);
  const immediateActions = ensureStringArray(o.immediateActions, MAX_LIST_ITEMS);

  const variantsRaw = o.strategyVariants && typeof o.strategyVariants === "object" ? (o.strategyVariants as Record<string, unknown>) : {};
  let defensiv = parseVariant(variantsRaw.defensiv);
  let ausgewogen = parseVariant(variantsRaw.ausgewogen);
  let offensiv = parseVariant(variantsRaw.offensiv);
  if (!defensiv || !ausgewogen || !offensiv) {
    const fallbackVariants = buildFallbackVariants();
    defensiv = defensiv ?? fallbackVariants.defensiv;
    ausgewogen = ausgewogen ?? fallbackVariants.ausgewogen;
    offensiv = offensiv ?? fallbackVariants.offensiv;
  }

  // Executive Summary: deterministischer, top-item-basierter Text ist führend.
  // LLM-Output (rawExecutiveSummary) wird aus Stabilitätsgründen aktuell NICHT priorisiert.
  const effectiveExecSummary = buildDeterministicExecutiveSummary(summary, actions);

  const effectiveFinalRecommendation =
    rawFinalRecommendation && rawFinalRecommendation.length > 0
      ? rawFinalRecommendation
      : `Auf Basis der erkannten Nachtragsfelder und Maßnahmen ist eine ${recommendedApproach}-orientierte Angebotslinie sinnvoll, die sowohl wirtschaftliche Chancen als auch Claim-Risiken ausgewogen adressiert.`;

  const result: OfferStrategySummary = {
    executiveSummary: effectiveExecSummary,
    topRisks,
    topNegotiationPoints,
    immediateActions,
    recommendedApproach,
    strategyVariants: { defensiv, ausgewogen, offensiv },
    finalRecommendation: effectiveFinalRecommendation,
  };

  if (isOfferStrategyDebugEnabled()) {
    // Debug: nachvollziehbar machen, ob recommendedApproach vom LLM kam oder aus der Fallback-Regel.
    console.log("[buildOfferStrategySummary][debug] recommendedApproach", {
      fromModel: approachFromModel,
      final: recommendedApproach,
      source: approachFromModel ? "llm" : "fallback_from_summary",
    });
  }

  return result;
}

/**
 * Erzeugt die Management Summary + Strategievarianten auf Basis der bestehenden Analyse.
 * Bei Fehler oder deaktivierter KI: null; Pipeline läuft weiter.
 */
export async function buildOfferStrategySummary(
  summary: ChangePotentialSummary,
  commercialActions: CommercialActionsFromChangePotential | null
): Promise<OfferStrategySummary | null> {
  if (!envEnabled()) return null;

  const items = summary.items ?? [];
  if (items.length === 0) return null;

  const context = buildContext(summary, commercialActions);
  const model =
    process.env.CHANGE_POTENTIAL_LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";

  if (isOfferStrategyDebugEnabled()) {
    console.log("[buildOfferStrategySummary][debug] llm_context_meta", {
      contextLength: context.length,
      itemCount: summary.items?.length ?? 0,
      hasCommercialActions: commercialActions != null,
    });
  }

  const userContent = `Du bist Experte für Angebotsstrategie im Baubereich. Erstelle eine knappe, entscheidungsrelevante Management-Zusammenfassung und drei Strategievarianten NUR auf Basis der folgenden strukturierten Analyse. Erfinde keine neuen Themen und nenne keine allgemeinen TGA-Standardaussagen, die nicht direkt durch die Daten gestützt sind.

Die folgende JSON-Struktur beschreibt die bereits erkannten Nachtragsfelder, ihre Hebel, Durchsetzbarkeit, Mechanismen, Feldtypen, Evidenz und abgeleitete Maßnahmen:
${context}

Nutze für die Managementzusammenfassung vor allem:
- die 5–8 wichtigsten Einzel-Claim-Felder (fields.items),
- ihre Feldtypen (fieldType) und Mechanismen (changeMechanism),
- Hebel (impactLevel) und Durchsetzbarkeit (enforceability),
- empfohlene Aktionen (recommendedAction),
- Reasoning, Frage- und Klarstellungsentwürfe (reasoning, questionDraft, clarificationDraft),
- dominierende Feldtypen/Mechanismen und Gewerke (aggregates.topFieldTypes/topMechanisms/dominantTrades),
- vorhandene Verhandlungskluster (topNegotiationClusters) und kommerzielle Aktionen (commercialActions).

Antworte NUR mit einem JSON-Objekt im folgenden Schema (kein anderer Text):
{
  "executiveSummary": "Maximal 6 Sätze. Struktur: (1) 1 Satz zur spezifischen Gesamtlage dieses LV (kein Allgemeinplatz). (2) 2–3 Sätze zu den wichtigsten konkreten Nachtragsmustern/Feldern mit Bezug auf Feldtypen, Mechanismen und Evidenz (z.B. unklare Schnittstellen in Gewerk X, Mengenrisiken in Positionen Y, fehlende Dokumentations-/IBN-Regelungen). (3) 1 Satz mit der empfohlenen Angebotslinie inkl. kurzer Begründung. Keine Wiederholungen, keine generischen Formeln.",
  "topRisks": ["Risiko 1", "Risiko 2", "…"],
  "topNegotiationPoints": ["Verhandlungspunkt 1", "…"],
  "immediateActions": ["Sofortmaßnahme 1", "…"],
  "recommendedApproach": "defensiv" | "ausgewogen" | "offensiv",
  "strategyVariants": {
    "defensiv": {
      "description": "Kurzbeschreibung der defensiven Angebotslinie, mit Bezug auf die konkreten Felder/Cluster aus der Analyse.",
      "expectedTradeoff": "Erwartete Vor-/Nachteile in einem Satz, bezogen auf Marge, Auftragswahrscheinlichkeit und Claim-Risiko.",
      "keyActions": ["2–4 konkrete Schlüsselmaßnahmen zur Umsetzung dieser Linie, knackig formuliert."]
    },
    "ausgewogen": {
      "description": "Kurzbeschreibung der ausgewogenen Angebotslinie, mit Bezug auf die konkreten Felder/Cluster aus der Analyse.",
      "expectedTradeoff": "Erwartete Vor-/Nachteile in einem Satz, bezogen auf Marge, Auftragswahrscheinlichkeit und Claim-Risiko.",
      "keyActions": ["2–4 konkrete Schlüsselmaßnahmen zur Umsetzung dieser Linie, knackig formuliert."]
    },
    "offensiv": {
      "description": "Kurzbeschreibung der offensiven Angebotslinie, mit Bezug auf die konkreten Felder/Cluster aus der Analyse.",
      "expectedTradeoff": "Erwartete Vor-/Nachteile in einem Satz, bezogen auf Marge, Auftragswahrscheinlichkeit und Claim-Risiko.",
      "keyActions": ["2–4 konkrete Schlüsselmaßnahmen zur Umsetzung dieser Linie, knackig formuliert."]
    }
  },
  "finalRecommendation": "2–4 Sätze: Welche Angebotsstrategie ist insgesamt sinnvoll und warum? Beziehe Dich explizit auf die wichtigsten Nachtragsfelder, Feldtypen, Mechanismen und die Qualität der Durchsetzbarkeit. Wenn die Datenbasis insgesamt schwach oder unsicher ist, benenne das offen."
}`.trim();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("OFFER_STRATEGY_SUMMARY_TIMEOUT")), SUMMARY_TIMEOUT_MS)
  );

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: MAX_RESPONSE_TOKENS,
        messages: [
          { role: "system", content: "Du gibst ausschließlich gültiges JSON zurück. Kein Fließtext außerhalb des JSON." },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
      timeoutPromise,
    ]);

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```json?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    const result = parsePayload(parsed, summary, commercialActions);
    if (process.env.NODE_ENV !== "test" && result) {
      console.log("[buildOfferStrategySummary] success");
    }
    return result;
  } catch {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[buildOfferStrategySummary] Fehler");
    }
    return null;
  }
}
