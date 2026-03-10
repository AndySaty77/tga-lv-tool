/**
 * Kommerzielle Handlungsempfehlung pro ChangePotentialItem (KI-Strategiebewertung).
 * Setzt auf bestehenden Items auf; erfindet keine neuen. Regelbasierte Engine bleibt führend.
 */

import OpenAI from "openai";
import type {
  ChangePotentialSummary,
  ChangePotentialItem,
  CommercialStrategy,
  CommercialStrategyPrimaryAction,
  CommercialStrategyRiskLevel,
} from "./changePotentialModel";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_ITEMS_FOR_STRATEGY = 6;
const PER_ITEM_TIMEOUT_MS = 5000;
const MAX_RESPONSE_TOKENS = 400;
const MAX_REASONING_SNIPPET = 180;

const PRIMARY_ACTIONS: CommercialStrategyPrimaryAction[] = [
  "rueckfrage",
  "angebotsklarstellung",
  "kalkulatorisch_absichern",
  "claim_feld_beobachten",
  "nicht_aktiv_ansprechen",
];
const RISK_LEVELS: CommercialStrategyRiskLevel[] = ["niedrig", "mittel", "hoch"];

function envStrategyEnabled(): boolean {
  return (
    process.env.CHANGE_POTENTIAL_COMMERCIAL_STRATEGY_ENABLED === "true" &&
    !!process.env.OPENAI_API_KEY
  );
}

function rankItemsByRelevance(items: ChangePotentialItem[]): ChangePotentialItem[] {
  const impactOrder: Record<string, number> = { sehr_hoch: 4, hoch: 3, mittel: 2, niedrig: 1 };
  const enforceOrder: Record<string, number> = { sehr_gut: 4, gut: 3, mittel: 2, schwach: 1 };
  return [...items].sort((a, b) => {
    const impactA = impactOrder[a.impactLevel] ?? 0;
    const impactB = impactOrder[b.impactLevel] ?? 0;
    if (impactB !== impactA) return impactB - impactA;
    const enfA = enforceOrder[a.enforceability] ?? 0;
    const enfB = enforceOrder[b.enforceability] ?? 0;
    if (enfB !== enfA) return enfB - enfA;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
}

function parseStrategy(raw: unknown): CommercialStrategy | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const primary = PRIMARY_ACTIONS.includes((o.primaryAction as CommercialStrategyPrimaryAction)) ? (o.primaryAction as CommercialStrategyPrimaryAction) : null;
  const riskUn = RISK_LEVELS.includes((o.riskIfUnaddressed as CommercialStrategyRiskLevel)) ? (o.riskIfUnaddressed as CommercialStrategyRiskLevel) : null;
  const riskEarly = RISK_LEVELS.includes((o.riskIfAddressedTooEarly as CommercialStrategyRiskLevel)) ? (o.riskIfAddressedTooEarly as CommercialStrategyRiskLevel) : null;
  const reasoning = typeof o.strategyReasoning === "string" ? o.strategyReasoning.trim() : "";
  if (!primary || !riskUn || !riskEarly || reasoning.length < 5) return null;
  const secondary = PRIMARY_ACTIONS.includes((o.secondaryAction as CommercialStrategyPrimaryAction)) ? (o.secondaryAction as CommercialStrategyPrimaryAction) : undefined;
  const handling = typeof o.handlingRecommendation === "string" ? o.handlingRecommendation.trim() : undefined;
  const internalNote = typeof o.internalNote === "string" ? o.internalNote.trim() : undefined;
  const negotiationSensitivity = RISK_LEVELS.includes((o.negotiationSensitivity as CommercialStrategyRiskLevel)) ? (o.negotiationSensitivity as CommercialStrategyRiskLevel) : undefined;
  return {
    primaryAction: primary,
    secondaryAction: secondary,
    riskIfUnaddressed: riskUn,
    riskIfAddressedTooEarly: riskEarly,
    strategyReasoning: reasoning.slice(0, 500),
    negotiationSensitivity,
    handlingRecommendation: handling?.slice(0, 300),
    internalNote: internalNote?.slice(0, 200),
  };
}

async function fetchStrategyForItem(
  item: ChangePotentialItem,
  model: string
): Promise<CommercialStrategy | null> {
  const reasoningSnippet = (item.reasoning ?? "").slice(0, MAX_REASONING_SNIPPET);
  const userContent = `Bewerte die kommerzielle Strategie für dieses Nachtragspotenzial-Item. Gib NUR gültiges JSON zurück.

Item-ID: ${item.id}
Titel: ${item.title}
${item.trade ? `Gewerk: ${item.trade}` : ""}
Kurztext: ${reasoningSnippet || "(kein Text)"}
Impact: ${item.impactLevel}, Durchsetzbarkeit: ${item.enforceability}, bisherige Empfehlung: ${item.recommendedAction}

Antwort-Schema (nur dieses Objekt):
{
  "primaryAction": "rueckfrage"|"angebotsklarstellung"|"kalkulatorisch_absichern"|"claim_feld_beobachten"|"nicht_aktiv_ansprechen",
  "secondaryAction": "…" (optional),
  "riskIfUnaddressed": "niedrig"|"mittel"|"hoch",
  "riskIfAddressedTooEarly": "niedrig"|"mittel"|"hoch",
  "strategyReasoning": "1-3 kurze Sätze warum diese Strategie sinnvoll ist",
  "handlingRecommendation": "Kurz: Wie sollte Kalkulator/Vertrieb/Projektleiter damit umgehen?" (optional),
  "internalNote": "optional interne Anmerkung"
}`.trim();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("STRATEGY_ITEM_TIMEOUT")), PER_ITEM_TIMEOUT_MS)
  );

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: MAX_RESPONSE_TOKENS,
        messages: [
          { role: "system", content: "Du gibst ausschließlich gültiges JSON zurück. Kein Fließtext." },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
      timeoutPromise,
    ]);

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```json?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as unknown;
    return parseStrategy(parsed);
  } catch {
    return null;
  }
}

/**
 * Reichert die Top-Items der Summary mit optionaler KI-Strategiebewertung an.
 * Nur für die wichtigsten Items (Top 5–8 nach Impact/Enforceability).
 * Bei LLM-Fehler oder Timeout bleibt das Item ohne commercialStrategy; Pipeline läuft weiter.
 */
export async function enrichChangePotentialWithCommercialStrategy(
  summary: ChangePotentialSummary
): Promise<ChangePotentialSummary> {
  if (!envStrategyEnabled()) {
    return summary;
  }

  const items = summary.items ?? [];
  if (items.length === 0) return summary;

  const model =
    process.env.CHANGE_POTENTIAL_LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";

  const ranked = rankItemsByRelevance(items);
  const topItems = ranked.slice(0, MAX_ITEMS_FOR_STRATEGY);

  const results = await Promise.allSettled(
    topItems.map((item) => fetchStrategyForItem(item, model))
  );

  const strategyById = new Map<string, CommercialStrategy>();
  for (let i = 0; i < results.length; i++) {
    const item = topItems[i];
    if (!item) continue;
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      strategyById.set(item.id, r.value);
    }
  }

  const enrichedItems: ChangePotentialItem[] = summary.items.map((it) => {
    const strategy = strategyById.get(it.id);
    if (!strategy) return it;
    return { ...it, commercialStrategy: strategy };
  });

  if (process.env.NODE_ENV !== "test") {
    console.log(
      "[enrichChangePotentialWithCommercialStrategy] attempt:",
      topItems.length,
      "success:",
      strategyById.size
    );
  }

  return {
    ...summary,
    items: enrichedItems,
  };
}
