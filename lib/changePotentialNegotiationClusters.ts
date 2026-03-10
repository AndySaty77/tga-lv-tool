/**
 * Top-Verhandlungspunkte: Bündelung verwandter ChangePotentialItems zu übergeordneten,
 * management- und vertriebsrelevanten Clustern. Keine freie Suche – nur auf Basis bestehender Items.
 * Hybrid: regelbasierte Vorclusterung, KI für Verdichtung/Benennung/Priorisierung.
 */

import OpenAI from "openai";
import type {
  ChangePotentialSummary,
  ChangePotentialItem,
  NegotiationCluster,
  NegotiationClusterAction,
  ChangePotentialFieldType,
  ChangePotentialMechanism,
  ChangePotentialImpactLevel,
  ChangePotentialEnforceability,
} from "./changePotentialModel";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_CLUSTERS = 5;
const MAX_BUCKETS_FOR_LLM = 8;
const CLUSTER_TIMEOUT_MS = 15000;
const MAX_RESPONSE_TOKENS = 1200;

/** Feldtyp → thematisches Vorcluster (kommerzielle Bündelung). */
const FIELD_TYPE_TO_THEME: Record<ChangePotentialFieldType, string> = {
  schnittstelle: "schnittstelle",
  nebenleistung: "nebenleistung_abgrenzung",
  leistungsabgrenzung: "nebenleistung_abgrenzung",
  dokumentation_inbetriebnahme: "dokumentation_ibn",
  bestand_erschwernis: "bestand_erschwernis",
  provisorium: "bauablauf_provisorium",
  bauablauf: "bauablauf_provisorium",
  mengenrisiko: "mengen_konkretisierung",
  planungsstand: "mengen_konkretisierung",
  systemfestlegung: "mengen_konkretisierung",
  normative_ergaenzung: "normative",
  sonstiges: "sonstiges",
};

const THEME_FALLBACK_TITLES: Record<string, string> = {
  schnittstelle: "Schnittstellen und bauseitige Leistungen",
  nebenleistung_abgrenzung: "Nebenleistungen und Leistungsabgrenzung",
  dokumentation_ibn: "Dokumentation, Inbetriebnahme, Einregulierung",
  bestand_erschwernis: "Bestand, Erschwernisse, Zugänglichkeit",
  bauablauf_provisorium: "Bauablauf, Provisorien, abschnittsweise Ausführung",
  mengen_konkretisierung: "Mengen, technische Konkretisierung, Leistungsgrenzen",
  normative: "Normative Ergänzungen",
  sonstiges: "Weitere Verhandlungspunkte",
};

const IMPACT_ORDER: Record<ChangePotentialImpactLevel, number> = {
  sehr_hoch: 4,
  hoch: 3,
  mittel: 2,
  niedrig: 1,
};
const ENFORCE_ORDER: Record<ChangePotentialEnforceability, number> = {
  sehr_gut: 4,
  gut: 3,
  mittel: 2,
  schwach: 1,
};

const NEGOTIATION_ACTIONS: NegotiationClusterAction[] = [
  "rueckfrage",
  "angebotsklarstellung",
  "kalkulatorisch_absichern",
  "claim_feld_beobachten",
];

function envClustersEnabled(): boolean {
  return (
    process.env.CHANGE_POTENTIAL_NEGOTIATION_CLUSTERS_ENABLED === "true" &&
    !!process.env.OPENAI_API_KEY
  );
}

type RuleBucket = {
  theme: string;
  relatedItemIds: string[];
  items: ChangePotentialItem[];
  dominantFieldTypes: ChangePotentialFieldType[];
  dominantMechanisms: ChangePotentialMechanism[];
  affectedTrades: string[];
  commercialWeight: ChangePotentialImpactLevel;
  enforceabilityAssessment: ChangePotentialEnforceability;
};

function ruleBasedPreCluster(items: ChangePotentialItem[]): RuleBucket[] {
  const byTheme = new Map<string, ChangePotentialItem[]>();
  for (const item of items) {
    if (item.candidate) continue;
    const theme = FIELD_TYPE_TO_THEME[item.fieldType] ?? "sonstiges";
    if (!byTheme.has(theme)) byTheme.set(theme, []);
    byTheme.get(theme)!.push(item);
  }

  const buckets: RuleBucket[] = [];
  for (const [theme, list] of byTheme) {
    if (list.length === 0) continue;
    const ids = list.map((i) => i.id);
    const impactOrdered = [...list].sort(
      (a, b) => (IMPACT_ORDER[b.impactLevel] ?? 0) - (IMPACT_ORDER[a.impactLevel] ?? 0)
    );
    const enforceOrdered = [...list].sort(
      (a, b) => (ENFORCE_ORDER[b.enforceability] ?? 0) - (ENFORCE_ORDER[a.enforceability] ?? 0)
    );
    const commercialWeight = impactOrdered[0]?.impactLevel ?? "niedrig";
    const enforceabilityAssessment = enforceOrdered[0]?.enforceability ?? "schwach";

    const fieldCounts = new Map<ChangePotentialFieldType, number>();
    const mechCounts = new Map<ChangePotentialMechanism, number>();
    const trades = new Set<string>();
    for (const i of list) {
      fieldCounts.set(i.fieldType, (fieldCounts.get(i.fieldType) ?? 0) + 1);
      mechCounts.set(i.changeMechanism, (mechCounts.get(i.changeMechanism) ?? 0) + 1);
      if (i.trade?.trim()) trades.add(i.trade.trim());
    }
    const dominantFieldTypes = [...fieldCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
    const dominantMechanisms = [...mechCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    buckets.push({
      theme,
      relatedItemIds: ids,
      items: list,
      dominantFieldTypes,
      dominantMechanisms,
      affectedTrades: [...trades],
      commercialWeight,
      enforceabilityAssessment,
    });
  }

  buckets.sort((a, b) => {
    const impA = IMPACT_ORDER[a.commercialWeight] ?? 0;
    const impB = IMPACT_ORDER[b.commercialWeight] ?? 0;
    if (impB !== impA) return impB - impA;
    const enfA = ENFORCE_ORDER[a.enforceabilityAssessment] ?? 0;
    const enfB = ENFORCE_ORDER[b.enforceabilityAssessment] ?? 0;
    return enfB - enfA;
  });
  return buckets;
}

function fallbackCluster(bucket: RuleBucket, index: number): NegotiationCluster {
  const title = THEME_FALLBACK_TITLES[bucket.theme] ?? "Verhandlungspunkt";
  return {
    id: `nc-${bucket.theme}-${index}`,
    title,
    shortTitle: title.slice(0, 50) + (title.length > 50 ? "…" : ""),
    relatedItemIds: bucket.relatedItemIds,
    dominantFieldTypes: bucket.dominantFieldTypes,
    dominantMechanisms: bucket.dominantMechanisms,
    affectedTrades: bucket.affectedTrades,
    commercialWeight: bucket.commercialWeight,
    enforceabilityAssessment: bucket.enforceabilityAssessment,
    whyThisMatters: "Bündelung verwandter Nachtragsfelder (ohne KI-Verdichtung).",
    recommendedNegotiationAction: "rueckfrage",
  };
}

type LlmClusterPayload = {
  title: string;
  shortTitle: string;
  whyThisMatters: string;
  recommendedNegotiationAction: NegotiationClusterAction;
  suggestedQuestion?: string;
  suggestedClarification?: string;
  clusterReasoning?: string;
};

function parseLlmCluster(raw: unknown): LlmClusterPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const shortTitle = typeof o.shortTitle === "string" ? o.shortTitle.trim() : title.slice(0, 50);
  const whyThisMatters = typeof o.whyThisMatters === "string" ? o.whyThisMatters.trim() : "";
  const action = NEGOTIATION_ACTIONS.includes((o.recommendedNegotiationAction as NegotiationClusterAction))
    ? (o.recommendedNegotiationAction as NegotiationClusterAction)
    : null;
  if (!title || !whyThisMatters || !action) return null;
  return {
    title,
    shortTitle: shortTitle || title.slice(0, 50),
    whyThisMatters: whyThisMatters.slice(0, 600),
    recommendedNegotiationAction: action,
    suggestedQuestion: typeof o.suggestedQuestion === "string" ? o.suggestedQuestion.trim().slice(0, 300) : undefined,
    suggestedClarification: typeof o.suggestedClarification === "string" ? o.suggestedClarification.trim().slice(0, 300) : undefined,
    clusterReasoning: typeof o.clusterReasoning === "string" ? o.clusterReasoning.trim().slice(0, 400) : undefined,
  };
}

async function enrichBucketsWithLlm(
  buckets: RuleBucket[],
  model: string
): Promise<(LlmClusterPayload | null)[]> {
  const summaries = buckets.map((b, i) => {
    const sampleTitles = b.items.slice(0, 3).map((it) => it.title).join(" | ");
    return `[${i}] ${b.theme}: ${b.relatedItemIds.length} Items, Hebel ${b.commercialWeight}, Durchsetzbarkeit ${b.enforceabilityAssessment}. Feldtypen: ${b.dominantFieldTypes.join(", ")}. Mechanismen: ${b.dominantMechanisms.join(", ")}. Beispiele: ${sampleTitles.slice(0, 120)}`;
  });

  const userContent = `Du bist Experte für kommerzielle Verhandlungen im Baubereich. Bündle die folgenden Vorcluster zu prägnanten, management- und vertriebsrelevanten Verhandlungspunkten.

Vorcluster (regelbasiert, Reihenfolge = Priorität):
${summaries.join("\n")}

Antworte NUR mit einem JSON-Objekt mit einem Array "clusters". Pro Vorcluster genau ein Eintrag in gleicher Reihenfolge:
{
  "clusters": [
    {
      "title": "Kurzer, prägnanter Verhandlungspunkt-Titel (max. 80 Zeichen)",
      "shortTitle": "Sehr kurzer Titel (max. 40 Zeichen)",
      "whyThisMatters": "1-3 Sätze: warum das für die Verhandlung wichtig ist",
      "recommendedNegotiationAction": "rueckfrage" | "angebotsklarstellung" | "kalkulatorisch_absichern" | "claim_feld_beobachten",
      "suggestedQuestion": "Optional: eine konkrete Rückfrage",
      "suggestedClarification": "Optional: eine Klarstellungsformulierung",
      "clusterReasoning": "Optional: kurze Begründung der Bündelung"
    }
  ]
}`.trim();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("NEGOTIATION_CLUSTERS_TIMEOUT")), CLUSTER_TIMEOUT_MS)
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
    const parsed = JSON.parse(cleaned) as { clusters?: unknown[] };
    const arr = Array.isArray(parsed.clusters) ? parsed.clusters : [];
    return arr.map((entry) => parseLlmCluster(entry));
  } catch {
    return [];
  }
}

/**
 * Erzeugt Top-Verhandlungspunkte aus der Summary: regelbasierte Vorclusterung,
 * dann optional KI-Verdichtung/Benennung. Maximal MAX_CLUSTERS Cluster.
 * Bei KI-Ausfall: Fallback mit regelbasierten Titeln, keine Abbruch der Pipeline.
 */
export async function buildNegotiationClusters(
  summary: ChangePotentialSummary
): Promise<ChangePotentialSummary> {
  const items = summary.items ?? [];
  if (items.length === 0) {
    return summary;
  }

  const buckets = ruleBasedPreCluster(items);
  const topBuckets = buckets.slice(0, MAX_BUCKETS_FOR_LLM).filter((b) => b.relatedItemIds.length > 0);
  const toEmit = topBuckets.slice(0, MAX_CLUSTERS);

  if (toEmit.length === 0) {
    return summary;
  }

  let payloads: (LlmClusterPayload | null)[] = [];
  if (envClustersEnabled()) {
    const model =
      process.env.CHANGE_POTENTIAL_LLM_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini";
    payloads = await enrichBucketsWithLlm(toEmit, model);
  }

  const clusters: NegotiationCluster[] = toEmit.map((bucket, index) => {
    const llm = payloads[index];
    const base = fallbackCluster(bucket, index);
    if (!llm) {
      return base;
    }
    return {
      ...base,
      title: llm.title,
      shortTitle: llm.shortTitle,
      whyThisMatters: llm.whyThisMatters,
      recommendedNegotiationAction: llm.recommendedNegotiationAction,
      suggestedQuestion: llm.suggestedQuestion,
      suggestedClarification: llm.suggestedClarification,
      clusterReasoning: llm.clusterReasoning,
    };
  });

  if (process.env.NODE_ENV !== "test") {
    console.log(
      "[buildNegotiationClusters] buckets:",
      toEmit.length,
      "llm_ok:",
      payloads.filter(Boolean).length
    );
  }

  return {
    ...summary,
    negotiationClusters: clusters,
  };
}
