"use client";

import React from "react";
import { sanitizeForDisplay } from "@/lib/displayText";
import { DEFAULT_TEXTS_CONFIG } from "@/lib/textsConfig";
import type {
  ChangePotentialSummary,
  ChangePotentialItem,
  ChangePotentialFieldType,
  ChangePotentialMechanism,
  ChangePotentialImpactLevel,
  ChangePotentialEnforceability,
  ChangePotentialRecommendedAction,
  ChangePotentialSourceType,
  CommercialStrategyPrimaryAction,
  CommercialStrategyRiskLevel,
  NegotiationCluster,
  NegotiationClusterAction,
  OfferStrategySummary,
  OfferStrategyApproach,
} from "@/lib/changePotentialModel";

/** Einzelne Opportunity aus der Nachtragsanalyse (Strang B) – Legacy. */
export type NachtragspotenzialOpportunity = {
  id: string;
  cluster: string;
  title: string;
  description?: string;
  potential?: string;
  riskLevel?: string;
  assertiveness?: string;
  reason?: string;
  sourceFindingIds?: string[];
  sourceTextSnippets?: string[];
  sourceType?: string[];
};

/** Grund, warum KI-Veredelung nicht ausgeführt wurde (für Statusanzeige). */
export type ChangePotentialLlmReasonNotUsed =
  | "disabled_by_env"
  | "missing_api_key"
  | "not_requested"
  | "error"
  | null;

export type NachtragspotenzialAnalysisResult = {
  opportunities: NachtragspotenzialOpportunity[];
  byCluster: Record<string, NachtragspotenzialOpportunity[]>;
  debug?: {
    ruleBasedCount: number;
    llmCount: number;
    deduplicatedCount: number;
    usedChangePotentialLlm?: boolean;
    usedLegacyLlm?: boolean;
    requestedChangePotentialLlm?: boolean;
    changePotentialLlmAvailable?: boolean;
    reasonIfNotUsed?: ChangePotentialLlmReasonNotUsed;
    changePotentialLlmEnvEnabled?: boolean;
    changePotentialLlmEnvRaw?: string | null;
    openAiApiKeyPresent?: boolean;
    reasonDetails?: ("disabled_by_env" | "missing_api_key" | "error")[];
    llmRefinementTimedOut?: boolean;
    llmRefinementDurationMs?: number;
    llmRefinementFailed?: boolean;
    llmRefinementFailureReason?: string | null;
    refinedItemAttemptCount?: number;
    promptCharCount?: number;
    contextCharCount?: number;
    modelUsed?: string;
    llmRefinementMode?: string;
    refinedItemSuccessCount?: number;
    perItemTimeoutCount?: number;
    totalLlmDurationMs?: number;
  };
  changePotentialSummary?: ChangePotentialSummary;
  /** Aus ChangePotential abgeleitet; beim Generieren von Rückfragen/Klarstellungen einbezogen. */
  commercialActionsFromChangePotential?: import("@/lib/changePotentialCommercialActions").CommercialActionsFromChangePotential;
  /** Management Summary + Strategievarianten auf Dokumentebene (KI). */
  offerStrategySummary?: import("@/lib/changePotentialModel").OfferStrategySummary;
};

const CLUSTER_LABELS: Record<string, string> = {
  leistungsaenderung: "Leistungsänderung",
  leistungsmehrung: "Leistungsmehrung",
  schnittstelle: "Schnittstelle",
  erschwernis: "Erschwernis",
};

const FIELD_TYPE_LABELS: Record<ChangePotentialFieldType, string> = {
  leistungsabgrenzung: "Leistungsabgrenzung",
  nebenleistung: "Nebenleistung",
  schnittstelle: "Schnittstelle",
  mengenrisiko: "Mengenrisiko",
  planungsstand: "Planungsstand",
  systemfestlegung: "Systemfestlegung",
  bauablauf: "Bauablauf",
  bestand_erschwernis: "Bestand/Erschwernis",
  provisorium: "Provisorium",
  dokumentation_inbetriebnahme: "Dokumentation/Inbetriebnahme",
  normative_ergaenzung: "Normative Ergänzung",
  sonstiges: "Sonstiges",
};

const MECHANISM_LABELS: Record<ChangePotentialMechanism, string> = {
  zusätzliche_leistung: "Zusätzliche Leistung",
  geänderte_leistung: "Geänderte Leistung",
  mehrmenge: "Mehrmenge",
  erschwernis: "Erschwernis",
  bauablaufstörung: "Bauablaufstörung",
  fehlende_vorleistung: "Fehlende Vorleistung",
  spätere_konkretisierung: "Spätere Konkretisierung",
  normative_ergaenzung: "Normative Ergänzung",
  unklar: "Unklar",
};

const IMPACT_LABELS: Record<ChangePotentialImpactLevel, string> = {
  niedrig: "Niedrig",
  mittel: "Mittel",
  hoch: "Hoch",
  sehr_hoch: "Sehr hoch",
};

const ENFORCEABILITY_LABELS: Record<ChangePotentialEnforceability, string> = {
  schwach: "Schwach",
  mittel: "Mittel",
  gut: "Gut",
  sehr_gut: "Sehr gut",
};

const RECOMMENDED_ACTION_LABELS: Record<ChangePotentialRecommendedAction, string> = {
  rueckfrage: "Rückfrage",
  angebotsklarstellung: "Angebotsklarstellung",
  kalkulatorisch_absichern: "Kalkulatorisch absichern",
  claim_feld_beobachten: "Claim-Feld beobachten",
  nicht_verfolgen: "Nicht verfolgen",
};

const COMMERCIAL_STRATEGY_ACTION_LABELS: Record<CommercialStrategyPrimaryAction, string> = {
  rueckfrage: "Rückfrage",
  angebotsklarstellung: "Angebotsklarstellung",
  kalkulatorisch_absichern: "Kalkulatorisch absichern",
  claim_feld_beobachten: "Claim-Feld beobachten",
  nicht_aktiv_ansprechen: "Nicht aktiv ansprechen",
};

const RISK_LEVEL_LABELS: Record<CommercialStrategyRiskLevel, string> = {
  niedrig: "Niedrig",
  mittel: "Mittel",
  hoch: "Hoch",
};

const NEGOTIATION_CLUSTER_ACTION_LABELS: Record<NegotiationClusterAction, string> = {
  rueckfrage: "Rückfrage",
  angebotsklarstellung: "Angebotsklarstellung",
  kalkulatorisch_absichern: "Kalkulatorisch absichern",
  claim_feld_beobachten: "Claim-Feld beobachten",
};

const OFFER_STRATEGY_APPROACH_LABELS: Record<OfferStrategyApproach, string> = {
  defensiv: "Defensiv",
  ausgewogen: "Ausgewogen",
  offensiv: "Offensiv",
};

const SOURCE_TYPE_LABELS: Record<ChangePotentialSourceType, string> = {
  vortext: "Vortext",
  position: "Position",
  remark: "Vorbemerkung",
  addtext: "Zusatztext",
  global: "Analyse",
  unknown: "Unbekannt",
};

function labelFor<T extends string>(map: Record<string, string>, value: T): string {
  return map[value] ?? String(value);
}

function impactTone(impact: ChangePotentialImpactLevel): string {
  if (impact === "sehr_hoch") return "#b00020";
  if (impact === "hoch") return "#c62828";
  if (impact === "mittel") return "#a36b00";
  return "#666";
}

function actionTone(action: ChangePotentialRecommendedAction): string {
  if (action === "rueckfrage" || action === "angebotsklarstellung") return "#1565c0";
  if (action === "kalkulatorisch_absichern") return "#a36b00";
  if (action === "claim_feld_beobachten") return "#2e7d32";
  return "#666";
}

// ================= Neue Engine – Darstellung (bevorzugt wenn changePotentialSummary vorhanden) =================

type NewEngineViewProps = {
  summary: ChangePotentialSummary;
  commercialActions?: import("@/lib/changePotentialCommercialActions").CommercialActionsFromChangePotential | null;
  isExpertMode: boolean;
  customerRoute: boolean;
  labelForFieldType: (v: ChangePotentialFieldType) => string;
  labelForMechanism: (v: ChangePotentialMechanism) => string;
  labelForImpact: (v: ChangePotentialImpactLevel) => string;
  labelForEnforceability: (v: ChangePotentialEnforceability) => string;
  labelForAction: (v: ChangePotentialRecommendedAction) => string;
  labelForSourceType: (v: ChangePotentialSourceType) => string;
  sanitize: (s: string) => string;
};

function NewEngineView({
  summary,
  commercialActions,
  isExpertMode,
  customerRoute,
  labelForFieldType,
  labelForMechanism,
  labelForImpact,
  labelForEnforceability,
  labelForAction,
  labelForSourceType,
  sanitize,
}: NewEngineViewProps) {
  const { overallIndex, totalItems, highImpactCount, veryHighImpactCount, strongEnforceabilityCount, items, topFields, topMechanisms, negotiationClusters } = summary;
  const indexTone = overallIndex >= 70 ? "#b00020" : overallIndex >= 40 ? "#a36b00" : "#0a7a2f";

  return (
    <>
      {/* Abgeleitete Maßnahmen (Rückfragen/Klarstellungen/Kalkulation/Monitoring) */}
      {commercialActions && (commercialActions.questions.length > 0 || commercialActions.clarifications.length > 0 || commercialActions.pricingHints.length > 0 || commercialActions.monitoringHints.length > 0) && (
        <div style={{ marginTop: 14, padding: 10, background: "#f0f7ff", borderRadius: 10, fontSize: 12, color: "#333" }}>
          <strong>Abgeleitete Maßnahmen:</strong>{" "}
          {commercialActions.questions.length > 0 && <span>{commercialActions.questions.length} Rückfragen</span>}
          {commercialActions.questions.length > 0 && commercialActions.clarifications.length > 0 && " · "}
          {commercialActions.clarifications.length > 0 && <span>{commercialActions.clarifications.length} Klarstellungen</span>}
          {(commercialActions.questions.length > 0 || commercialActions.clarifications.length > 0) && (commercialActions.pricingHints.length > 0 || commercialActions.monitoringHints.length > 0) && " · "}
          {commercialActions.pricingHints.length > 0 && <span>{commercialActions.pricingHints.length} Kalkulationshinweise</span>}
          {commercialActions.pricingHints.length > 0 && commercialActions.monitoringHints.length > 0 && " · "}
          {commercialActions.monitoringHints.length > 0 && <span>{commercialActions.monitoringHints.length} Claim-Monitoring</span>}
          {" — werden beim Generieren der Tabs „Rückfragen“ und „Angebotsklarstellungen“ einbezogen (CP bevorzugt bei Duplikaten)."}
        </div>
      )}

      {/* A) Überblick */}
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>
          Gesamtindex: <span style={{ color: indexTone }}>{overallIndex}</span> / 100
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: "#444" }}>
          <span><strong>{totalItems}</strong> Felder</span>
          {(highImpactCount > 0 || veryHighImpactCount > 0) && (
            <span style={{ color: "#b00020" }}>
              <strong>{veryHighImpactCount + highImpactCount}</strong> hohe / sehr hohe Hebel
            </span>
          )}
          {strongEnforceabilityCount > 0 && (
            <span style={{ color: "#1565c0" }}>
              <strong>{strongEnforceabilityCount}</strong> gut durchsetzbar
            </span>
          )}
        </div>
        {topFields.length > 0 && (
          <div style={{ fontSize: 12, color: "#666" }}>
            Top-Feldtypen: {topFields.slice(0, 4).map((f) => `${labelForFieldType(f.fieldType)} (${f.count})`).join(" · ")}
          </div>
        )}
        {topMechanisms.length > 0 && (
          <div style={{ fontSize: 12, color: "#666" }}>
            Top-Mechanismen: {topMechanisms.slice(0, 3).map((m) => `${labelForMechanism(m.mechanism)} (${m.count})`).join(" · ")}
          </div>
        )}
      </div>

      {/* Top-Verhandlungspunkte (gebündelte Cluster) */}
      {negotiationClusters && negotiationClusters.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, color: "#333", fontSize: 14, marginBottom: 10 }}>Top-Verhandlungspunkte</div>
          <div style={{ display: "grid", gap: 12 }}>
            {negotiationClusters.map((cluster) => (
              <NegotiationClusterCard
                key={cluster.id}
                cluster={cluster}
                isExpertMode={isExpertMode}
                labelForFieldType={labelForFieldType}
                labelForMechanism={labelForMechanism}
                labelForImpact={labelForImpact}
                labelForEnforceability={labelForEnforceability}
                labelForClusterAction={(a) => labelFor(NEGOTIATION_CLUSTER_ACTION_LABELS, a)}
                impactTone={impactTone}
                actionTone={actionTone}
                sanitize={sanitize}
              />
            ))}
          </div>
        </div>
      )}

      {/* B) Pro Item */}
      <div style={{ marginTop: 16, fontWeight: 800, color: "#333", fontSize: 14 }}>Erkannte Nachtragsfelder</div>
      <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
        {items.map((it) => (
          <ItemCard
            key={it.id}
            item={it}
            isExpertMode={isExpertMode}
            labelForFieldType={labelForFieldType}
            labelForMechanism={labelForMechanism}
            labelForImpact={labelForImpact}
            labelForEnforceability={labelForEnforceability}
            labelForAction={labelForAction}
            labelForSourceType={labelForSourceType}
            impactTone={impactTone}
            actionTone={actionTone}
            sanitize={sanitize}
          />
        ))}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #eee", color: "#666", fontSize: 13, lineHeight: 1.5 }}>
        Darstellung basiert auf der neuen Nachtragspotenzial-Engine (Feldtypen, Mechanismus, Hebel, Durchsetzbarkeit, empfohlene Aktion).
      </div>
    </>
  );
}

function NegotiationClusterCard({
  cluster,
  isExpertMode,
  labelForFieldType,
  labelForMechanism,
  labelForImpact,
  labelForEnforceability,
  labelForClusterAction,
  impactTone,
  actionTone,
  sanitize,
}: {
  cluster: NegotiationCluster;
  isExpertMode: boolean;
  labelForFieldType: (v: ChangePotentialFieldType) => string;
  labelForMechanism: (v: ChangePotentialMechanism) => string;
  labelForImpact: (v: ChangePotentialImpactLevel) => string;
  labelForEnforceability: (v: ChangePotentialEnforceability) => string;
  labelForClusterAction: (v: NegotiationClusterAction) => string;
  impactTone: (v: ChangePotentialImpactLevel) => string;
  actionTone: (v: ChangePotentialRecommendedAction) => string;
  sanitize: (s: string) => string;
}) {
  return (
    <div style={{ border: "1px solid #e0e7ef", borderRadius: 12, padding: 14, background: "#f8fafc" }}>
      <div style={{ fontWeight: 800, color: "#111", fontSize: 14, marginBottom: 8 }}>{sanitize(cluster.title)}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, marginBottom: 8 }}>
        <span style={{ color: impactTone(cluster.commercialWeight), fontWeight: 700 }}>Hebel: {labelForImpact(cluster.commercialWeight)}</span>
        <span style={{ color: "#555" }}>Durchsetzbarkeit: {labelForEnforceability(cluster.enforceabilityAssessment)}</span>
        <span style={{ color: actionTone(cluster.recommendedNegotiationAction as ChangePotentialRecommendedAction), fontWeight: 700 }}>
          Empfohlen: {labelForClusterAction(cluster.recommendedNegotiationAction)}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>{sanitize(cluster.whyThisMatters)}</div>
      {(cluster.suggestedQuestion ?? cluster.suggestedClarification) && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee", fontSize: 12, color: "#444" }}>
          {cluster.suggestedQuestion && (
            <div style={{ marginBottom: 4 }}><strong>Rückfrage:</strong> {sanitize(cluster.suggestedQuestion)}</div>
          )}
          {cluster.suggestedClarification && (
            <div><strong>Klarstellung:</strong> {sanitize(cluster.suggestedClarification)}</div>
          )}
        </div>
      )}
      {isExpertMode && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #eee", fontSize: 11, color: "#777" }}>
          <div>Zugehörige Items: {cluster.relatedItemIds.join(", ")}</div>
          {cluster.dominantFieldTypes.length > 0 && (
            <div>Feldtypen: {cluster.dominantFieldTypes.map(labelForFieldType).join(", ")}</div>
          )}
          {cluster.dominantMechanisms.length > 0 && (
            <div>Mechanismen: {cluster.dominantMechanisms.map(labelForMechanism).join(", ")}</div>
          )}
          {cluster.affectedTrades.length > 0 && (
            <div>Gewerke: {cluster.affectedTrades.join(", ")}</div>
          )}
          {cluster.clusterReasoning && (
            <div style={{ marginTop: 4 }}>Begründung: {sanitize(cluster.clusterReasoning)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item,
  isExpertMode,
  labelForFieldType,
  labelForMechanism,
  labelForImpact,
  labelForEnforceability,
  labelForAction,
  labelForSourceType,
  impactTone,
  actionTone,
  sanitize,
}: {
  item: ChangePotentialItem;
  isExpertMode: boolean;
  labelForFieldType: (v: ChangePotentialFieldType) => string;
  labelForMechanism: (v: ChangePotentialMechanism) => string;
  labelForImpact: (v: ChangePotentialImpactLevel) => string;
  labelForEnforceability: (v: ChangePotentialEnforceability) => string;
  labelForAction: (v: ChangePotentialRecommendedAction) => string;
  labelForSourceType: (v: ChangePotentialSourceType) => string;
  impactTone: (v: ChangePotentialImpactLevel) => string;
  actionTone: (v: ChangePotentialRecommendedAction) => string;
  sanitize: (s: string) => string;
}) {
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14, background: "#fafafa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, color: "#111", fontSize: 14 }}>{sanitize(item.title)}</span>
        {item.trade && (
          <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>{sanitize(item.trade)}</span>
        )}
      </div>
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12 }}>
        <span style={{ color: "#555" }}>Feldtyp: {labelForFieldType(item.fieldType)}</span>
        <span style={{ color: "#555" }}>Mechanismus: {labelForMechanism(item.changeMechanism)}</span>
        <span style={{ color: impactTone(item.impactLevel), fontWeight: 700 }}>Hebel: {labelForImpact(item.impactLevel)}</span>
        <span style={{ color: "#555" }}>Durchsetzbarkeit: {labelForEnforceability(item.enforceability)}</span>
        <span style={{ color: actionTone(item.recommendedAction), fontWeight: 700 }}>
          Empfohlen: {labelForAction(item.recommendedAction)}
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: "#333", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
        {sanitize(item.reasoning)}
      </div>
      {item.commercialStrategy && (
        <div style={{ marginTop: 10, padding: 10, background: "#f0f7ff", borderRadius: 8, borderLeft: "4px solid #1565c0", fontSize: 12, color: "#333" }}>
          <div style={{ fontWeight: 700, color: "#1565c0", marginBottom: 6 }}>Kommerzielle Handlungsempfehlung</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
            <span><strong>Primäre Strategie:</strong> {labelFor(COMMERCIAL_STRATEGY_ACTION_LABELS, item.commercialStrategy.primaryAction)}</span>
            <span><strong>Risiko bei Nicht-Adressierung:</strong> {labelFor(RISK_LEVEL_LABELS, item.commercialStrategy.riskIfUnaddressed)}</span>
            <span><strong>Risiko bei zu offensiver Adressierung:</strong> {labelFor(RISK_LEVEL_LABELS, item.commercialStrategy.riskIfAddressedTooEarly)}</span>
          </div>
          <div style={{ marginBottom: isExpertMode ? 6 : 0 }}>{sanitize(item.commercialStrategy.strategyReasoning)}</div>
          {isExpertMode && (
            <>
              {item.commercialStrategy.secondaryAction && (
                <div style={{ marginTop: 4, color: "#555" }}><strong>Alternative:</strong> {labelFor(COMMERCIAL_STRATEGY_ACTION_LABELS, item.commercialStrategy.secondaryAction)}</div>
              )}
              {item.commercialStrategy.handlingRecommendation && (
                <div style={{ marginTop: 4, color: "#555" }}><strong>Umgang:</strong> {sanitize(item.commercialStrategy.handlingRecommendation)}</div>
              )}
              {item.commercialStrategy.internalNote && (
                <div style={{ marginTop: 4, color: "#777", fontSize: 11 }}><strong>Intern:</strong> {sanitize(item.commercialStrategy.internalNote)}</div>
              )}
            </>
          )}
        </div>
      )}
      {(item.questionDraft ?? item.clarificationDraft ?? item.pricingHint) && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #eee", fontSize: 12, color: "#444" }}>
          {item.questionDraft && (
            <div style={{ marginBottom: 4 }}>
              <strong>Rückfrage-Vorschlag:</strong> {sanitize(item.questionDraft)}
            </div>
          )}
          {item.clarificationDraft && (
            <div style={{ marginBottom: 4 }}>
              <strong>Klarstellungs-Vorschlag:</strong> {sanitize(item.clarificationDraft)}
            </div>
          )}
          {item.pricingHint && (
            <div><strong>Kalkulationshinweis:</strong> {sanitize(item.pricingHint)}</div>
          )}
        </div>
      )}
      {/* Standardmodus: nur dezente KI-Kennzeichnung */}
      {!isExpertMode && (item.llmValidated || item.llmAdjusted) && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
          {item.llmAdjusted ? "KI angepasst" : "KI geprüft"}
        </div>
      )}
      {isExpertMode &&
        (item.sourceType != null ||
          item.sourcePath ||
          item.sourceQuote ||
          item.sourcePositionRef ||
          (item.tags?.length ?? 0) > 0 ||
          typeof item.confidence === "number" ||
          (typeof item.llmConfidence === "number" && item.llmConfidence > 0) ||
          item.llmValidated ||
          item.llmAdjusted ||
          (item.llmChangedFields?.length ?? 0) > 0 ||
          item.llmNotes ||
          item.candidate) && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #eee", fontSize: 11, color: "#777" }}>
          {item.sourceType != null && <div>Quelle: {labelForSourceType(item.sourceType)}</div>}
          {item.sourcePath && <div>Pfad: {sanitize(item.sourcePath)}</div>}
          {item.sourceQuote && (
            <div style={{ fontFamily: "ui-monospace, monospace", marginTop: 4 }}>
              &quot;{sanitize(String(item.sourceQuote).slice(0, 120))}{item.sourceQuote.length > 120 ? "…" : ""}&quot;
            </div>
          )}
          {item.sourcePositionRef && <div>Position: {sanitize(item.sourcePositionRef)}</div>}
          {item.confidence !== undefined && <div>Konfidenz: {Math.round(item.confidence * 100)}%</div>}
          {item.tags && item.tags.length > 0 && <div>Tags: {item.tags.join(", ")}</div>}
          {(item.llmValidated || item.llmAdjusted) && (
            <>
              <div>
                KI-Confidence:{" "}
                {typeof item.llmConfidence === "number" && item.llmConfidence > 0
                  ? `${Math.round(item.llmConfidence * 100)} %`
                  : "—"}
              </div>
              <div>{item.llmAdjusted ? "KI angepasst" : "KI geprüft"}</div>
            </>
          )}
          {(item.llmAdjusted || (item.llmChangedFields?.length ?? 0) > 0) && (
            <div>
              Geändert:{" "}
              {item.llmChangedFields && item.llmChangedFields.length > 0
                ? item.llmChangedFields.join(", ")
                : "nicht spezifiziert"}
            </div>
          )}
          {item.llmNotes && <div>LLM-Notiz: {sanitize(item.llmNotes)}</div>}
          {item.candidate && <div>Kandidat (LLM-Vorschlag, nicht Kern-Item)</div>}
        </div>
      )}
    </div>
  );
}

// ================= Legacy-Darstellung (Fallback wenn keine changePotentialSummary) =================

type LegacyViewProps = {
  analysis: NachtragspotenzialAnalysisResult;
  deduplicatedOpportunities: NachtragspotenzialOpportunity[];
  isExpertMode: boolean;
  sanitize: (s: string) => string;
};

function LegacyView({ analysis, deduplicatedOpportunities, isExpertMode, sanitize }: LegacyViewProps) {
  return (
    <>
      <div style={{ marginTop: 14 }}>
        {(() => {
          const opps = deduplicatedOpportunities;
          const hasHigh = opps.some((o) => (o.potential ?? "").toString().toLowerCase() === "high");
          const hasMedium = opps.some((o) => (o.potential ?? "").toString().toLowerCase() === "medium");
          const level = opps.length === 0 ? "Keine" : hasHigh ? "Hoch" : hasMedium ? "Mittel" : "Gering";
          const levelTone = level === "Hoch" ? "#b00020" : level === "Mittel" ? "#a36b00" : level === "Keine" ? "#0a7a2f" : "#666";
          return (
            <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>
              Nachtragspotenzial: <span style={{ color: levelTone }}>{level}</span>
            </div>
          );
        })()}
      </div>
      <div style={{ marginTop: 14, fontWeight: 800, color: "#333", fontSize: 14 }}>Mögliche Ursachen:</div>
      <ul style={{ marginTop: 8, paddingLeft: 20, color: "#333", fontSize: 14, lineHeight: 1.6 }}>
        {deduplicatedOpportunities.map((o) => (
          <li key={o.id} style={{ marginBottom: 4 }}>{sanitize(o.title ?? "")}</li>
        ))}
      </ul>
      {isExpertMode && (
        <div style={{ marginTop: 14, display: "grid", gap: 16 }}>
          {(["leistungsaenderung", "leistungsmehrung", "schnittstelle", "erschwernis"] as const).map((cluster) => {
            const rawItems = analysis.byCluster?.[cluster] ?? [];
            const seen = new Set<string>();
            const items = rawItems.filter((o) => {
              const k = (o.title ?? "").trim().toLowerCase();
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            if (items.length === 0) return null;
            return (
              <div key={cluster} style={{ border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fafafa" }}>
                <div style={{ fontSize: 12, color: "#666", fontWeight: 900, marginBottom: 10 }}>
                  {CLUSTER_LABELS[cluster] ?? cluster} ({items.length})
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {items.map((o) => (
                    <div key={o.id} style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, color: "#111" }}>{sanitize(o.title ?? "")}</span>
                        <div style={{ display: "flex", gap: 8, fontSize: 11, fontWeight: 700 }}>
                          <span style={{ color: o.potential === "high" ? "#b00020" : o.potential === "medium" ? "#a36b00" : "#666" }}>
                            Potential: {o.potential}
                          </span>
                          {o.riskLevel && <span style={{ color: "#666" }}>Risiko: {o.riskLevel}</span>}
                          {o.assertiveness && <span style={{ color: "#666" }}>Assertiv: {o.assertiveness}</span>}
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, color: "#333", whiteSpace: "pre-wrap" }}>
                        {sanitize(o.reason ?? "")}
                      </div>
                      {o.sourceTextSnippets && o.sourceTextSnippets.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "#999", fontFamily: "ui-monospace, monospace" }}>
                          {o.sourceTextSnippets.slice(0, 2).map((s, i) => (
                            <div key={i} style={{ marginTop: 4 }}>
                              &quot;{sanitize(String(s).slice(0, 100))}{s.length > 100 ? "…" : ""}&quot;
                            </div>
                          ))}
                        </div>
                      )}
                      {o.sourceFindingIds && o.sourceFindingIds.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#777" }}>
                          Quellen: {o.sourceFindingIds.join(", ")}
                          {o.sourceType && o.sourceType.length > 0 && ` [${o.sourceType.join(", ")}]`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #eee", color: "#666", fontSize: 13, lineHeight: 1.5 }}>
        Unklare oder fehlende Leistungsbeschreibungen, Schnittstellen und Erschwernisse können zu Nachtragsansprüchen führen. (Legacy-Darstellung.)
      </div>
    </>
  );
}

// ================= Management Summary / Angebotsstrategie =================

function OfferStrategyBlock({
  data,
  isExpertMode,
  sanitize,
}: {
  data: OfferStrategySummary;
  isExpertMode: boolean;
  sanitize: (s: string) => string;
}) {
  const approachLabel = labelFor(OFFER_STRATEGY_APPROACH_LABELS, data.recommendedApproach);
  return (
    <div style={{ marginTop: 16, border: "1px solid #1e3a5f", borderRadius: 12, padding: 16, background: "#f0f7ff" }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: "#1e3a5f", marginBottom: 12 }}>Management Summary</div>
      <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12 }}>
        {sanitize(data.executiveSummary)}
      </div>

      <div style={{ fontWeight: 800, fontSize: 14, color: "#1e3a5f", marginBottom: 8 }}>Angebotsstrategie</div>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontWeight: 700, color: "#1565c0" }}>Empfohlener Ansatz: {approachLabel}</span>
      </div>
      <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5, marginBottom: 14 }}>
        {sanitize(data.finalRecommendation)}
      </div>

      {!isExpertMode && data.immediateActions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 6 }}>Wichtigste Sofortmaßnahmen</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#333" }}>
            {data.immediateActions.slice(0, 5).map((a, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{sanitize(a)}</li>
            ))}
          </ul>
        </div>
      )}

      {isExpertMode && (
        <>
          {data.topRisks.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 4 }}>Top-Risiken</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#333" }}>
                {data.topRisks.map((r, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{sanitize(r)}</li>
                ))}
              </ul>
            </div>
          )}
          {data.topNegotiationPoints.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 4 }}>Top-Verhandlungspunkte</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#333" }}>
                {data.topNegotiationPoints.map((p, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{sanitize(p)}</li>
                ))}
              </ul>
            </div>
          )}
          {data.immediateActions.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 4 }}>Sofortmaßnahmen</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#333" }}>
                {data.immediateActions.map((a, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{sanitize(a)}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ marginTop: 14, fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>Strategievarianten</div>
          <div style={{ display: "grid", gap: 12 }}>
            {(["defensiv", "ausgewogen", "offensiv"] as const).map((key) => {
              const v = data.strategyVariants[key];
              const label = labelFor(OFFER_STRATEGY_APPROACH_LABELS, key);
              return (
                <div key={key} style={{ border: "1px solid #c5d9f0", borderRadius: 8, padding: 10, background: "#fff", fontSize: 12 }}>
                  <div style={{ fontWeight: 800, color: "#1e3a5f", marginBottom: 6 }}>{label}</div>
                  <div style={{ marginBottom: 4, color: "#333" }}>{sanitize(v.description)}</div>
                  <div style={{ marginBottom: 6, color: "#555", fontStyle: "italic" }}>{sanitize(v.expectedTradeoff)}</div>
                  {v.keyActions.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 16, color: "#444" }}>
                      {v.keyActions.map((action, i) => (
                        <li key={i} style={{ marginBottom: 2 }}>{sanitize(action)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!isExpertMode && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {(["defensiv", "ausgewogen", "offensiv"] as const).map((key) => {
            const v = data.strategyVariants[key];
            const label = labelFor(OFFER_STRATEGY_APPROACH_LABELS, key);
            const isRecommended = data.recommendedApproach === key;
            return (
              <div key={key} style={{ border: "1px solid #c5d9f0", borderRadius: 8, padding: 8, background: isRecommended ? "#e8f0fa" : "#fff", fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: "#333" }}>{label}</span>
                {isRecommended && <span style={{ marginLeft: 6, color: "#1565c0", fontWeight: 600 }}>— empfohlen</span>}
                <div style={{ marginTop: 4, color: "#555" }}>{sanitize(v.description)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Props = {
  /** Ergebnis der on-demand Nachtragsanalyse (Strang B). null = noch nicht ermittelt. */
  analysis: NachtragspotenzialAnalysisResult | null;
  loading: boolean;
  /** Steuert die neue KI-Veredelung der Nachtragspotenziale (ChangePotential-LLM). */
  useChangePotentialLlm: boolean;
  onUseChangePotentialLlmChange: (value: boolean) => void;
  onGenerate: () => void;
  /** Nach Titel deduplizierte Opportunities (gleiche Quelle wie analysis.opportunities). */
  deduplicatedOpportunities: NachtragspotenzialOpportunity[];
  isExpertMode: boolean;
  /** Kundenroute /analyse: optional andere Styles. */
  customerRoute?: boolean;
};

/**
 * Einheitliche Darstellung der Nachtragsanalyse (Strang B: echtes Nachtragspotenzial).
 * Wird nur im Tab „Nachtragspotenzial“ gerendert; im Tab „Risiken“ wird stattdessen
 * auf diesen Tab verwiesen, um Dopplung zu vermeiden.
 */
export function NachtragspotenzialBlock({
  analysis,
  loading,
  useChangePotentialLlm,
  onUseChangePotentialLlmChange,
  onGenerate,
  deduplicatedOpportunities,
  isExpertMode,
  customerRoute = false,
}: Props) {
  const cardBorder = customerRoute ? "1px solid #e2e8f0" : "1px solid #e5e5e5";
  const cardBg = customerRoute ? "#ffffff" : "#fff";

  return (
    <div style={{ border: cardBorder, borderRadius: 14, padding: 16, background: cardBg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, color: "#666", fontWeight: 900 }}>NACHTRAGSPOTENZIAL</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isExpertMode && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={useChangePotentialLlm}
                onChange={(e) => onUseChangePotentialLlmChange(e.target.checked)}
              />
              KI‑Veredelung aktivieren
            </label>
          )}
          <button
            onClick={onGenerate}
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid #333",
              background: loading ? "#666" : "#111",
              color: "#fff",
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.9 : 1,
            }}
          >
            {loading
              ? DEFAULT_TEXTS_CONFIG.customerUI.buttonLabels.nachtragspotenzialErmittelnLoading
              : DEFAULT_TEXTS_CONFIG.customerUI.buttonLabels.nachtragspotenzialErmitteln}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ marginTop: 14, padding: 20, textAlign: "center", color: "#666", fontWeight: 700 }}>
          Analyse läuft…
        </div>
      )}

      {!loading && !analysis && (
        <div style={{ marginTop: 14, color: "#666", fontSize: 13, fontWeight: 700 }}>
          Klicke „Nachtragspotenziale ermitteln", um mögliche Nachtragstreiber aus der Analyse abzuleiten (Strang B).
        </div>
      )}

      {isExpertMode && !customerRoute && (
        <div style={{ marginTop: 8, color: "#64748b", fontSize: 11 }}>
          Die KI verfeinert die erkannten Nachtragspotenziale fachlich/präziser, erzeugt aber keine völlig freien neuen
          Haupttreffer.
        </div>
      )}

      {!loading && analysis && (
        <>
          {/* Klare Statusanzeige: KI-Veredelung aktiv vs. angefordert aber nicht ausgeführt */}
          {analysis.debug && (
            <div style={{ marginTop: 12, fontSize: 12 }}>
              {analysis.debug.usedChangePotentialLlm ? (
                <span style={{ color: "#15803d", fontWeight: 600 }}>KI-Veredelung aktiv</span>
              ) : analysis.debug.requestedChangePotentialLlm && analysis.debug.reasonIfNotUsed ? (
                <span style={{ color: "#b45309", fontWeight: 600 }}>
                  {analysis.debug.reasonIfNotUsed === "disabled_by_env"
                    ? "KI-Veredelung angefordert, aber serverseitig deaktiviert"
                    : analysis.debug.reasonIfNotUsed === "missing_api_key"
                      ? "KI-Veredelung angefordert, aber kein API-Key vorhanden"
                      : analysis.debug.reasonIfNotUsed === "error"
                        ? "KI-Veredelung angefordert, aber Fehler beim LLM-Aufruf"
                        : null}
                </span>
              ) : null}
              {analysis.debug.llmRefinementTimedOut && (
                <div style={{ marginTop: 4, color: "#b45309", fontSize: 11 }}>
                  KI-Veredelung wegen Timeout übersprungen; Ergebnis basiert auf der regelbasierten Analyse.
                </div>
              )}
              {analysis.debug.llmRefinementFailed && !analysis.debug.llmRefinementTimedOut && (
                <div style={{ marginTop: 4, color: "#b45309", fontSize: 11 }}>
                  KI-Veredelung fehlgeschlagen; Ergebnis basiert auf der regelbasierten Analyse.
                </div>
              )}
            </div>
          )}

          {isExpertMode && analysis.debug && (
            <>
              <div style={{ marginTop: 14, color: "#666", fontSize: 12, fontWeight: 700 }}>
                Regeln: {analysis.debug.ruleBasedCount} • Legacy-KI (Debug): {analysis.debug.llmCount} • Nach Bereinigung:{" "}
                {analysis.debug.deduplicatedCount} • Legacy-LLM: {analysis.debug.usedLegacyLlm ? "aktiv (Debug)" : "inaktiv"}
              </div>
              {/* Präzise KI-Veredelung-Diagnose (ohne Secrets) */}
              {(analysis.debug.requestedChangePotentialLlm != null ||
                analysis.debug.changePotentialLlmEnvEnabled != null ||
                analysis.debug.openAiApiKeyPresent != null ||
                analysis.debug.llmRefinementDurationMs != null ||
                analysis.debug.llmRefinementTimedOut ||
                analysis.debug.llmRefinementFailed ||
                analysis.debug.refinedItemAttemptCount != null ||
                analysis.debug.promptCharCount != null ||
                analysis.debug.modelUsed ||
                analysis.debug.llmRefinementMode ||
                analysis.debug.refinedItemSuccessCount != null ||
                analysis.debug.totalLlmDurationMs != null) && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    background: "#f8fafc",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    color: "#334155",
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6, color: "#475569" }}>KI-Veredelung Diagnose</div>
                  <div>
                    Request angefordert: {analysis.debug.requestedChangePotentialLlm === true ? "ja" : "nein"}
                  </div>
                  <div>
                    Env-Flag aktiv (CHANGE_POTENTIAL_LLM_ENABLED):{" "}
                    {analysis.debug.changePotentialLlmEnvEnabled === true ? "ja" : "nein"}
                  </div>
                  <div>
                    Env-Rohwert: &quot;{analysis.debug.changePotentialLlmEnvRaw ?? "—"}&quot;
                  </div>
                  <div>API-Key vorhanden: {analysis.debug.openAiApiKeyPresent === true ? "ja" : "nein"}</div>
                  <div>
                    LLM tatsächlich genutzt: {analysis.debug.usedChangePotentialLlm === true ? "ja" : "nein"}
                  </div>
                  <div>reasonIfNotUsed: {String(analysis.debug.reasonIfNotUsed ?? "—")}</div>
                  {analysis.debug.reasonDetails && analysis.debug.reasonDetails.length > 0 && (
                    <div style={{ marginTop: 4 }}>Blocker: {analysis.debug.reasonDetails.join(", ")}</div>
                  )}
                  {analysis.debug.llmRefinementDurationMs != null && (
                    <div>LLM-Veredelung Dauer: {analysis.debug.llmRefinementDurationMs} ms</div>
                  )}
                  {analysis.debug.llmRefinementTimedOut && (
                    <div style={{ color: "#b45309" }}>Timeout: ja (Fallback Regel-Engine)</div>
                  )}
                  {analysis.debug.llmRefinementFailed && (
                    <div style={{ color: "#b45309" }}>
                      Fehlgeschlagen: ja
                      {analysis.debug.llmRefinementFailureReason
                        ? ` — ${String(analysis.debug.llmRefinementFailureReason).slice(0, 80)}`
                        : ""}
                    </div>
                  )}
                  {analysis.debug.refinedItemAttemptCount != null && (
                    <div>Items an KI: {analysis.debug.refinedItemAttemptCount}</div>
                  )}
                  {analysis.debug.promptCharCount != null && (
                    <div>Prompt (Zeichen): {analysis.debug.promptCharCount}</div>
                  )}
                  {analysis.debug.contextCharCount != null && (
                    <div>Kontext (Zeichen): {analysis.debug.contextCharCount}</div>
                  )}
                  {analysis.debug.modelUsed && (
                    <div>Modell: {analysis.debug.modelUsed}</div>
                  )}
                  {analysis.debug.llmRefinementMode && (
                    <div>Modus: {analysis.debug.llmRefinementMode}</div>
                  )}
                  {analysis.debug.refinedItemSuccessCount != null && (
                    <div>Erfolgreich veredelt: {analysis.debug.refinedItemSuccessCount}</div>
                  )}
                  {analysis.debug.perItemTimeoutCount != null && analysis.debug.perItemTimeoutCount > 0 && (
                    <div style={{ color: "#b45309" }}>Pro-Item-Timeout: {analysis.debug.perItemTimeoutCount}</div>
                  )}
                  {analysis.debug.totalLlmDurationMs != null && (
                    <div>LLM-Gesamtdauer: {analysis.debug.totalLlmDurationMs} ms</div>
                  )}
                </div>
              )}
            </>
          )}

          {analysis.offerStrategySummary && (
            <OfferStrategyBlock
              data={analysis.offerStrategySummary}
              isExpertMode={isExpertMode}
              sanitize={sanitizeForDisplay}
            />
          )}

          {(() => {
            const summary = analysis.changePotentialSummary;
            const useNewEngine = summary != null && summary.items.length > 0;

            if (useNewEngine) {
              return (
                <NewEngineView
                  summary={summary!}
                  commercialActions={analysis.commercialActionsFromChangePotential}
                  isExpertMode={isExpertMode}
                  customerRoute={customerRoute}
                  labelForFieldType={(v) => labelFor(FIELD_TYPE_LABELS, v)}
                  labelForMechanism={(v) => labelFor(MECHANISM_LABELS, v)}
                  labelForImpact={(v) => labelFor(IMPACT_LABELS, v)}
                  labelForEnforceability={(v) => labelFor(ENFORCEABILITY_LABELS, v)}
                  labelForAction={(v) => labelFor(RECOMMENDED_ACTION_LABELS, v)}
                  labelForSourceType={(v) => labelFor(SOURCE_TYPE_LABELS, v)}
                  sanitize={sanitizeForDisplay}
                />
              );
            }

            if (deduplicatedOpportunities.length === 0) {
              return (
                <div style={{ marginTop: 14, color: "#666", fontWeight: 700 }}>
                  {DEFAULT_TEXTS_CONFIG.customerUI.emptyStates.noNachtragspotenziale}
                </div>
              );
            }

            return (
              <LegacyView
                analysis={analysis}
                deduplicatedOpportunities={deduplicatedOpportunities}
                isExpertMode={isExpertMode}
                sanitize={sanitizeForDisplay}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}
