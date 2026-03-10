/**
 * LLM-Veredelung für ChangePotentialItems.
 * - Regelbasierte Engine bleibt führend.
 * - Strategie: Top 3 Items, je 1 kurzer LLM-Call pro Item, nur reasoning/questionDraft/clarificationDraft.
 * - fieldType, changeMechanism, impactLevel, enforceability, recommendedAction bleiben regelbasiert.
 */

import OpenAI from "openai";
import type { ChangePotentialSummary, ChangePotentialItem } from "./changePotentialModel";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Top-N-Strategie: nur die N relevantesten Items zur KI. */
const MAX_ITEMS_TOP3 = 3;
/** Timeout pro Einzel-Item-Call (Sekunden). */
const PER_ITEM_TIMEOUT_MS = 5500;
/** Max. Tokens Antwort pro Item (kurze Texte). */
const MAX_RESPONSE_TOKENS_SINGLE = 450;
/** Pro Item: max. Zeichen für Reasoning/SourceQuote im Prompt. */
const MAX_PROMPT_REASONING_CHARS = 120;
const MAX_PROMPT_SOURCE_QUOTE_CHARS = 80;

type LlmRefinementContext = {
  vortext?: string;
  lvPositions?: string;
  keyFacts?: Record<string, string>;
  findings?: Array<{ id: string; title: string; detail?: string; category?: string }>;
  riskClauses?: Array<{ type: string; riskLevel: string; text: string; interpretation?: string }>;
};

/** Nur Text-Felder; impactLevel, enforceability, fieldType etc. bleiben regelbasiert. */
type TextOnlyPatch = {
  itemId: string;
  improvedReasoning?: string;
  improvedQuestionDraft?: string;
  improvedClarificationDraft?: string;
};

type LlmItemPatch = {
  itemId: string;
  isPlausible?: boolean;
  adjustedFieldType?: string;
  adjustedChangeMechanism?: string;
  adjustedImpactLevel?: string;
  adjustedEnforceability?: string;
  adjustedRecommendedAction?: string;
  improvedReasoning?: string;
  improvedQuestionDraft?: string;
  improvedClarificationDraft?: string;
  improvedPricingHint?: string;
  llmConfidence?: number;
  notes?: string;
};

type LlmRefinementResponse = {
  items?: LlmItemPatch[];
  candidateItems?: Array<{
    title: string;
    fieldType?: string;
    changeMechanism?: string;
    impactLevel?: string;
    enforceability?: string;
    recommendedAction?: string;
    reasoning?: string;
    questionDraft?: string;
    clarificationDraft?: string;
    pricingHint?: string;
    trade?: string;
  }>;
};

function envLlmEnabled(): boolean {
  return process.env.CHANGE_POTENTIAL_LLM_ENABLED === "true" && !!process.env.OPENAI_API_KEY;
}

/** Wendet nur reasoning/questionDraft/clarificationDraft an; Rest bleibt regelbasiert. */
function applyTextOnlyPatch(item: ChangePotentialItem, patch: TextOnlyPatch): ChangePotentialItem {
  const updated: ChangePotentialItem = { ...item };
  const changedFields: string[] = [];
  if (patch.improvedReasoning?.trim()) {
    updated.reasoning = patch.improvedReasoning.trim();
    changedFields.push("reasoning");
  }
  if (patch.improvedQuestionDraft?.trim()) {
    updated.questionDraft = patch.improvedQuestionDraft.trim();
    changedFields.push("questionDraft");
  }
  if (patch.improvedClarificationDraft?.trim()) {
    updated.clarificationDraft = patch.improvedClarificationDraft.trim();
    changedFields.push("clarificationDraft");
  }
  if (changedFields.length > 0) {
    updated.llmAdjusted = true;
    updated.llmChangedFields = changedFields;
  }
  return updated;
}

/** Ranking: 1. impactLevel (sehr_hoch > … > niedrig), 2. enforceability, 3. confidence. */
function rankItemsForRefinement(items: ChangePotentialItem[]): ChangePotentialItem[] {
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

function clamp01(n: unknown): number | undefined {
  const x = Number(n);
  if (!Number.isFinite(x)) return undefined;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function applyPatchToItem(item: ChangePotentialItem, patch: LlmItemPatch): ChangePotentialItem {
  const updated: ChangePotentialItem = { ...item };
  let adjusted = false;
  const changedFields: string[] = [];

  const mapFieldType = (v?: string): ChangePotentialItem["fieldType"] | undefined => {
    if (!v) return undefined;
    const s = v.trim() as any;
    return s;
  };
  const mapMechanism = (v?: string): ChangePotentialItem["changeMechanism"] | undefined => {
    if (!v) return undefined;
    const s = v.trim() as any;
    return s;
  };
  const mapImpact = (v?: string): ChangePotentialItem["impactLevel"] | undefined => {
    if (!v) return undefined;
    const s = v.trim() as any;
    return s;
  };
  const mapEnforceability = (v?: string): ChangePotentialItem["enforceability"] | undefined => {
    if (!v) return undefined;
    const s = v.trim() as any;
    return s;
  };
  const mapAction = (v?: string): ChangePotentialItem["recommendedAction"] | undefined => {
    if (!v) return undefined;
    const s = v.trim() as any;
    return s;
  };

  if (patch.adjustedFieldType) {
    const mapped = mapFieldType(patch.adjustedFieldType);
    if (mapped) {
      updated.fieldType = mapped;
      adjusted = true;
      changedFields.push("fieldType");
    }
  }
  if (patch.adjustedChangeMechanism) {
    const mapped = mapMechanism(patch.adjustedChangeMechanism);
    if (mapped) {
      updated.changeMechanism = mapped;
      adjusted = true;
      changedFields.push("changeMechanism");
    }
  }
  if (patch.adjustedImpactLevel) {
    const mapped = mapImpact(patch.adjustedImpactLevel);
    if (mapped) {
      updated.impactLevel = mapped;
      adjusted = true;
      changedFields.push("impactLevel");
    }
  }
  if (patch.adjustedEnforceability) {
    const mapped = mapEnforceability(patch.adjustedEnforceability);
    if (mapped) {
      updated.enforceability = mapped;
      adjusted = true;
      changedFields.push("enforceability");
    }
  }
  if (patch.adjustedRecommendedAction) {
    const mapped = mapAction(patch.adjustedRecommendedAction);
    if (mapped) {
      updated.recommendedAction = mapped;
      adjusted = true;
      changedFields.push("recommendedAction");
    }
  }

  if (patch.improvedReasoning && patch.improvedReasoning.trim().length > 0) {
    updated.reasoning = patch.improvedReasoning.trim();
    adjusted = true;
    changedFields.push("reasoning");
  }
  if (patch.improvedQuestionDraft && patch.improvedQuestionDraft.trim().length > 0) {
    updated.questionDraft = patch.improvedQuestionDraft.trim();
    adjusted = true;
    changedFields.push("questionDraft");
  }
  if (patch.improvedClarificationDraft && patch.improvedClarificationDraft.trim().length > 0) {
    updated.clarificationDraft = patch.improvedClarificationDraft.trim();
    adjusted = true;
    changedFields.push("clarificationDraft");
  }
  if (patch.improvedPricingHint && patch.improvedPricingHint.trim().length > 0) {
    updated.pricingHint = patch.improvedPricingHint.trim();
    adjusted = true;
    changedFields.push("pricingHint");
  }

  const conf = clamp01(patch.llmConfidence);
  if (conf !== undefined && conf > 0) {
    updated.llmConfidence = conf;
  }
  if (typeof patch.isPlausible === "boolean") {
    updated.llmValidated = true;
  }
  if (patch.notes && patch.notes.trim().length > 0) {
    updated.llmNotes = patch.notes.trim();
  }
  if (adjusted) {
    updated.llmAdjusted = true;
    updated.llmChangedFields = changedFields.length > 0 ? changedFields : undefined;
  }

  return updated;
}

/** Ein kurzer LLM-Call pro Item: nur reasoning, questionDraft, clarificationDraft verfeinern. */
async function refineOneItemTextOnly(
  item: ChangePotentialItem,
  model: string
): Promise<TextOnlyPatch | null> {
  const reasoningSnippet = (item.reasoning ?? "").slice(0, MAX_PROMPT_REASONING_CHARS);
  const quoteSnippet = (item.sourceQuote ?? "").slice(0, MAX_PROMPT_SOURCE_QUOTE_CHARS);
  const userContent = `Verfeinere nur diese 3 Texte für ein Nachtragspotenzial-Item. Gib NUR gültiges JSON zurück.

Item-ID: ${item.id}
Titel: ${item.title}
${item.trade ? `Gewerk: ${item.trade}` : ""}
Aktueller Kurztext (Reasoning): ${reasoningSnippet || "(leer)"}
${quoteSnippet ? `Zitat: ${quoteSnippet}` : ""}

Antwort-Schema (nur dieses Objekt):
{"itemId":"${item.id}","improvedReasoning":"1-2 Sätze","improvedQuestionDraft":"kurze Rückfrage","improvedClarificationDraft":"kurze Klarstellung"}
Nur Felder angeben, die du tatsächlich verbesserst.`.trim();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("PER_ITEM_TIMEOUT")), PER_ITEM_TIMEOUT_MS)
  );

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: MAX_RESPONSE_TOKENS_SINGLE,
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
    const parsed = JSON.parse(cleaned) as TextOnlyPatch & { improvedReasoning?: string; improvedQuestionDraft?: string; improvedClarificationDraft?: string };
    if (!parsed?.itemId) return null;
    return {
      itemId: String(parsed.itemId),
      improvedReasoning: parsed.improvedReasoning?.trim(),
      improvedQuestionDraft: parsed.improvedQuestionDraft?.trim(),
      improvedClarificationDraft: parsed.improvedClarificationDraft?.trim(),
    };
  } catch {
    return null;
  }
}

export async function refineChangePotentialWithLlm(
  summary: ChangePotentialSummary,
  _ctx: LlmRefinementContext
): Promise<ChangePotentialSummary> {
  if (!envLlmEnabled()) {
    return summary;
  }

  const items = summary.items ?? [];
  if (items.length === 0) {
    return summary;
  }

  const model =
    process.env.CHANGE_POTENTIAL_LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";

  const ranked = rankItemsForRefinement(items);
  const topItems = ranked.slice(0, MAX_ITEMS_TOP3);
  const refinedItemAttemptCount = topItems.length;

  const t0 = Date.now();
  let refinedItemSuccessCount = 0;
  let perItemTimeoutCount = 0;

  const results = await Promise.allSettled(
    topItems.map((item) => refineOneItemTextOnly(item, model))
  );

  const patchById = new Map<string, TextOnlyPatch>();
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const item = topItems[i];
    if (!item) continue;
    if (r.status === "fulfilled" && r.value) {
      patchById.set(item.id, r.value);
      refinedItemSuccessCount++;
    }
    if (r.status === "rejected" && String((r as PromiseRejectedResult).reason ?? "").includes("PER_ITEM_TIMEOUT")) {
      perItemTimeoutCount++;
    }
  }

  const totalLlmDurationMs = Date.now() - t0;
  if (process.env.NODE_ENV !== "test") {
    console.log(
      "[refineChangePotentialWithLlm] top3_text_only Ende, Dauer ms:",
      totalLlmDurationMs,
      "attempt:",
      refinedItemAttemptCount,
      "success:",
      refinedItemSuccessCount,
      "timeout:",
      perItemTimeoutCount
    );
  }

  const refinedItems: ChangePotentialItem[] = summary.items.map((it) => {
    const patch = patchById.get(it.id);
    if (!patch) return it;
    return applyTextOnlyPatch(it, patch);
  });

  return {
    ...summary,
    items: refinedItems,
    candidateItems: summary.candidateItems,
    llmMeta: {
      ...(summary.llmMeta ?? {}),
      enabled: true,
      usedModel: model,
      refinedItemCount: refinedItemSuccessCount,
      candidateItemCount: 0,
      llmRefinementMode: "top3_text_only",
      refinedItemAttemptCount,
      refinedItemSuccessCount,
      ...(perItemTimeoutCount > 0 && { perItemTimeoutCount }),
      totalLlmDurationMs,
    },
  };
}

