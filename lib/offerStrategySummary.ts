/**
 * Management Summary + Strategievarianten auf Dokumentebene.
 * Nur auf Basis bestehender ChangePotentialSummary, Items, Clusters und abgeleiteter Maßnahmen.
 * Keine freie Erkennung neuer Nachtragspotenziale.
 */

import OpenAI from "openai";
import type {
  ChangePotentialSummary,
  OfferStrategySummary,
  OfferStrategyApproach,
  OfferStrategyVariant,
} from "./changePotentialModel";
import type { CommercialActionsFromChangePotential } from "./changePotentialCommercialActions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUMMARY_TIMEOUT_MS = 22000;
const MAX_RESPONSE_TOKENS = 1800;
const MAX_ITEMS_SNIPPET = 12;
const MAX_CLUSTERS_SNIPPET = 5;
const MAX_LIST_ITEMS = 6;
const APPROACHES: OfferStrategyApproach[] = ["defensiv", "ausgewogen", "offensiv"];

function envEnabled(): boolean {
  return (
    process.env.CHANGE_POTENTIAL_OFFER_STRATEGY_ENABLED === "true" &&
    !!process.env.OPENAI_API_KEY
  );
}

function buildContext(summary: ChangePotentialSummary, actions: CommercialActionsFromChangePotential | null): string {
  const parts: string[] = [];
  parts.push(`Gesamtindex Nachtragspotenzial: ${summary.overallIndex}/100.`);
  parts.push(`Anzahl erkannter Felder: ${summary.totalItems}. Hohe/sehr hohe Hebel: ${summary.highImpactCount + summary.veryHighImpactCount}. Gut durchsetzbar: ${summary.strongEnforceabilityCount}.`);

  const items = summary.items ?? [];
  const topItems = items
    .filter((i) => !i.candidate)
    .slice(0, MAX_ITEMS_SNIPPET)
    .map((i) => `- ${i.title} (Hebel: ${i.impactLevel}, Aktion: ${i.recommendedAction})${i.reasoning ? ` | ${i.reasoning.slice(0, 80)}…` : ""}`);
  if (topItems.length > 0) {
    parts.push("\nWichtigste Nachtragsfelder:\n" + topItems.join("\n"));
  }

  const clusters = summary.negotiationClusters ?? [];
  if (clusters.length > 0) {
    const clusterLines = clusters.slice(0, MAX_CLUSTERS_SNIPPET).map(
      (c) => `- ${c.title} (${c.commercialWeight}, ${c.recommendedNegotiationAction}): ${c.whyThisMatters.slice(0, 100)}…`
    );
    parts.push("\nTop-Verhandlungspunkte (Cluster):\n" + clusterLines.join("\n"));
  }

  if (actions) {
    parts.push(
      `\nAbgeleitete Maßnahmen: ${actions.questions.length} Rückfragen, ${actions.clarifications.length} Klarstellungen, ${actions.pricingHints.length} Kalkulationshinweise, ${actions.monitoringHints.length} Claim-Monitoring-Hinweise.`
    );
    if (actions.questions.length > 0) {
      const samples = actions.questions.slice(0, 2).map((q) => q.question.slice(0, 80));
      parts.push("Beispiel-Rückfragen: " + samples.join(" | "));
    }
    if (actions.clarifications.length > 0) {
      const samples = actions.clarifications.slice(0, 2).map((c) => c.clarification.slice(0, 80));
      parts.push("Beispiel-Klarstellungen: " + samples.join(" | "));
    }
  }

  return parts.join("\n");
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

function parsePayload(raw: unknown): OfferStrategySummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const executiveSummary = typeof o.executiveSummary === "string" ? o.executiveSummary.trim().slice(0, 1200) : "";
  const finalRecommendation = typeof o.finalRecommendation === "string" ? o.finalRecommendation.trim().slice(0, 600) : "";
  const recommendedApproach = APPROACHES.includes((o.recommendedApproach as OfferStrategyApproach)) ? (o.recommendedApproach as OfferStrategyApproach) : "ausgewogen";
  if (!executiveSummary || !finalRecommendation) return null;

  const topRisks = ensureStringArray(o.topRisks, MAX_LIST_ITEMS);
  const topNegotiationPoints = ensureStringArray(o.topNegotiationPoints, MAX_LIST_ITEMS);
  const immediateActions = ensureStringArray(o.immediateActions, MAX_LIST_ITEMS);

  const variants = o.strategyVariants && typeof o.strategyVariants === "object" ? o.strategyVariants as Record<string, unknown> : {};
  const defensiv = parseVariant(variants.defensiv);
  const ausgewogen = parseVariant(variants.ausgewogen);
  const offensiv = parseVariant(variants.offensiv);
  if (!defensiv || !ausgewogen || !offensiv) return null;

  return {
    executiveSummary,
    topRisks,
    topNegotiationPoints,
    immediateActions,
    recommendedApproach,
    strategyVariants: { defensiv, ausgewogen, offensiv },
    finalRecommendation,
  };
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

  const userContent = `Du bist Experte für Angebotsstrategie im Baubereich. Erstelle eine knappe, entscheidungsrelevante Management-Zusammenfassung und drei Strategievarianten NUR auf Basis der folgenden strukturierten Analyse. Erfinde keine neuen Themen.

Kontext (bereits erkannte Nachtragsfelder, Cluster, abgeleitete Maßnahmen):
${context}

Antworte NUR mit einem JSON-Objekt im folgenden Schema (kein anderer Text):
{
  "executiveSummary": "5–8 Sätze: Was sind die wichtigsten kommerziellen Themen in diesem LV? Welche Punkte müssen vor Angebotsabgabe geklärt werden? Wo Klarstellung vs. kalkulatorisch vorsorgen? Knapp und geschäftlich brauchbar.",
  "topRisks": ["Risiko 1", "Risiko 2", "…"],
  "topNegotiationPoints": ["Verhandlungspunkt 1", "…"],
  "immediateActions": ["Sofortmaßnahme 1", "…"],
  "recommendedApproach": "defensiv" | "ausgewogen" | "offensiv",
  "strategyVariants": {
    "defensiv": {
      "description": "Kurze Beschreibung der defensiven Strategie.",
      "expectedTradeoff": "Vor-/Nachteile in einem Satz.",
      "keyActions": ["Maßnahme 1", "Maßnahme 2"]
    },
    "ausgewogen": {
      "description": "Kurze Beschreibung der ausgewogenen Strategie.",
      "expectedTradeoff": "Vor-/Nachteile in einem Satz.",
      "keyActions": ["Maßnahme 1", "Maßnahme 2"]
    },
    "offensiv": {
      "description": "Kurze Beschreibung der offensiven Strategie.",
      "expectedTradeoff": "Vor-/Nachteile in einem Satz.",
      "keyActions": ["Maßnahme 1", "Maßnahme 2"]
    }
  },
  "finalRecommendation": "2–4 Sätze: Welche Angebotsstrategie ist insgesamt sinnvoll und warum?"
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
    const result = parsePayload(parsed);
    if (process.env.NODE_ENV !== "test" && result) {
      console.log("[buildOfferStrategySummary] success");
    }
    return result;
  } catch (e) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[buildOfferStrategySummary] Fehler:", e);
    }
    return null;
  }
}
