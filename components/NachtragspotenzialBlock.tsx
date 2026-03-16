"use client";

import React, { useState } from "react";
import Link from "next/link";
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
  /** Systemlogik-Lückenanalyse (LV-Text); nur gesetzt wenn Engine ohne Fehler lief. */
  systemLogic?: {
    systemsDetected: string[];
    findings: Array<{
      system: string;
      type: string;
      message: string;
      severity: "low" | "medium" | "high" | "critical";
      reasoningShort?: string;
      recommendedHandling?: string;
    }>;
    querschnittDetected?: string[];
    crossTopicsDetected?: string[];
    debugDetection?: Array<{
      systemKey: string;
      label: string;
      matchedDetectionTerms: string[];
      matchedStrongTerms?: string[];
      matchedWeakTerms?: string[];
      matchedAbbreviationTerms?: string[];
      detectionSource: string;
      detectionHitCount: number;
      detectionReason?: string;
      detectionConfidenceLabel?: string;
      detectionReasonShort?: string;
      recommendedHandling?: string;
    }>;
    systemSummaries?: Array<{
      system: string;
      detectionConfidenceLabel?: string;
      detectionReasonShort?: string;
      findingCount: number;
      highSeverityCount: number;
      mediumSeverityCount: number;
      topMissingComponents: string[];
      overallAssessmentShort: string;
      recommendedHandling: string;
      commercialRelevance?: "niedrig" | "mittel" | "hoch";
      procurementMeaning?: string;
      actionType?: "rueckfrage" | "klarstellung" | "kalkulationsaufschlag" | "beobachten" | "ignorieren";
      suggestedQuestion?: string;
      suggestedOfferNote?: string;
      nachtragspotenzialImpact?: "niedrig" | "mittel" | "hoch";
    }>;
  };
};

/** Debug-Infos (systemLogic, Regeln, KI-Veredelung Diagnose) im normalen UI ausblenden. */
const SHOW_DEBUG_UI = false;

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
  const [analysisOverviewOpen, setAnalysisOverviewOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const { overallIndex, totalItems, highImpactCount, veryHighImpactCount, strongEnforceabilityCount, items, topFields, topMechanisms, negotiationClusters } = summary;
  const indexTone = overallIndex >= 70 ? "#b00020" : overallIndex >= 40 ? "#a36b00" : "#0a7a2f";

  return (
    <>
      {/* Analyseübersicht – einklappbar (Abgeleitete Maßnahmen, Gesamtindex, Top-Feldtypen, Top-Mechanismen, Top-Verhandlungspunkte) */}
      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          onClick={() => setAnalysisOverviewOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "8px 0",
            background: "none",
            border: "none",
            borderBottom: "1px solid #e2e8f0",
            cursor: "pointer",
            fontWeight: 600,
            color: "#334155",
            fontSize: 14,
            textAlign: "left",
          }}
        >
          <span>Analyseübersicht</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{analysisOverviewOpen ? "▼" : "▶"}</span>
        </button>
        {analysisOverviewOpen && (
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
          </>
        )}
      </div>

      {/* B) Pro Item – einklappbar */}
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={() => setFieldsOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "8px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 800,
            color: "#333",
            fontSize: 14,
            textAlign: "left",
          }}
        >
          <span>Erkannte Nachtragsfelder</span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{fieldsOpen ? "▼" : "▶"}</span>
        </button>
        {fieldsOpen && (
          <>
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
        )}
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
  const primaryFieldType =
    cluster.dominantFieldTypes && cluster.dominantFieldTypes.length > 0
      ? labelForFieldType(cluster.dominantFieldTypes[0])
      : null;
  const primaryMechanism =
    cluster.dominantMechanisms && cluster.dominantMechanisms.length > 0
      ? labelForMechanism(cluster.dominantMechanisms[0])
      : null;

  return (
    <div style={{ border: "1px solid #e0e7ef", borderRadius: 12, padding: 14, background: "#f8fafc" }}>
      <div style={{ fontWeight: 800, color: "#111", fontSize: 14, marginBottom: 4 }}>
        {sanitize(cluster.title)}
      </div>
      {(primaryFieldType || primaryMechanism) && (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
          Nachtragshebel:{" "}
          {[primaryFieldType, primaryMechanism].filter(Boolean).join(" · ")}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, marginBottom: 8 }}>
        <span style={{ color: impactTone(cluster.commercialWeight), fontWeight: 700 }}>Hebel: {labelForImpact(cluster.commercialWeight)}</span>
        <span style={{ color: "#555" }}>Durchsetzbarkeit: {labelForEnforceability(cluster.enforceabilityAssessment)}</span>
        <span style={{ color: actionTone(cluster.recommendedNegotiationAction as ChangePotentialRecommendedAction), fontWeight: 700 }}>
          Empfohlen: {labelForClusterAction(cluster.recommendedNegotiationAction)}
        </span>
      </div>
      {!isExpertMode && (cluster.dominantFieldTypes.length > 0 || cluster.dominantMechanisms.length > 0) && (
        <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
          {cluster.dominantFieldTypes.length > 0 && (
            <span>Feldtypen: {cluster.dominantFieldTypes.map(labelForFieldType).join(", ")}</span>
          )}
          {cluster.dominantMechanisms.length > 0 && (
            <span>
              {cluster.dominantFieldTypes.length > 0 ? " · " : ""}
              Mechanismen: {cluster.dominantMechanisms.map(labelForMechanism).join(", ")}
            </span>
          )}
        </div>
      )}
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

// ================= Executive Panel (kompakte Managementübersicht) =================

const RELEVANCE_ORDER: Record<string, number> = { sehr_hoch: 4, hoch: 3, mittel: 2, niedrig: 1 };

function NachtragExecutivePanel({
  analysis,
  sanitize,
}: {
  analysis: NachtragspotenzialAnalysisResult;
  sanitize: (s: string) => string;
}) {
  const summary = analysis?.changePotentialSummary;
  const offerSummary = analysis?.offerStrategySummary;
  const index = summary?.overallIndex ?? (analysis as { summaryIndex?: number; totalIndex?: number })?.summaryIndex ?? (analysis as { summaryIndex?: number; totalIndex?: number })?.totalIndex ?? 0;
  const fieldCount = summary?.items?.length ?? (analysis as { fields?: unknown[] })?.fields?.length ?? 0;
  const highLeverage =
    (summary?.highImpactCount ?? 0) + (summary?.veryHighImpactCount ?? 0) ||
    (analysis as { highLeverageCount?: number })?.highLeverageCount ||
    0;
  const goodFeasibility =
    (summary?.strongEnforceabilityCount ?? (analysis as { goodFeasibilityCount?: number })?.goodFeasibilityCount) ?? 0;
  const clusters = analysis?.changePotentialSummary?.negotiationClusters ?? [];
  const sortedClusters = [...clusters].sort(
    (a, b) => (RELEVANCE_ORDER[b?.commercialWeight ?? ""] ?? 0) - (RELEVANCE_ORDER[a?.commercialWeight ?? ""] ?? 0)
  );
  const topClusters = sortedClusters.slice(0, 3);

  const deterministicImmediate =
    (analysis as { deterministicImmediateActions?: string[] })?.deterministicImmediateActions ?? [];
  const primaryImmediate = offerSummary?.immediateActions ?? [];
  const effectiveImmediate =
    Array.isArray(primaryImmediate) && primaryImmediate.length > 0
      ? primaryImmediate
      : deterministicImmediate;
  const topActions = Array.isArray(effectiveImmediate) ? effectiveImmediate.slice(0, 3) : [];

  const cardStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    background: "#ffffff",
  };
  const titleStyle = { fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#334155" };
  const badgeStyle = { padding: "2px 8px", borderRadius: 999, fontSize: 12, background: "#eef2ff", color: "#3730a3" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 48, alignItems: "stretch" }}>
      {/* Karte 1: Nachtragspotenzial Index */}
      <div style={{ ...cardStyle, height: "100%" }}>
        <div style={titleStyle}>Nachtragspotenzial</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
          Risikoklasse: {summary?.riskClassLabel ?? "—"}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
          {index} von 100 Punkten
        </div>
        {summary?.shortRiskReason && (
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>
            {sanitize(summary.shortRiskReason)}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
          <span>Anzahl Nachtragsfelder: {fieldCount}</span>
          <span>Hohe Hebel: {highLeverage}</span>
          <span>Gut durchsetzbar: {goodFeasibility}</span>
        </div>
      </div>
      {/* Karte 2: Wichtigste Hebel */}
      <div style={{ ...cardStyle, height: "100%" }}>
        <div style={titleStyle}>Wichtigste Hebel</div>
        {summary?.topItemsForDisplay && summary.topItemsForDisplay.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {summary.topItemsForDisplay.slice(0, 3).map((item) => (
              <div key={item.id}>
                <div style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>
                  {sanitize(item.title)}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {[
                    `Feldtyp: ${labelFor(FIELD_TYPE_LABELS, item.fieldType)}`,
                    `Mechanismus: ${labelFor(MECHANISM_LABELS, item.changeMechanism)}`,
                    `Hebel: ${labelFor(IMPACT_LABELS, item.impactLevel)}`,
                  ].join(" · ")}
                </div>
              </div>
            ))}
          </div>
        ) : topClusters.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topClusters.map((c) => (
              <div key={c?.id ?? c?.title}>
                <div style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>{sanitize(c?.title ?? "")}</div>
                <span style={badgeStyle}>
                  {c?.commercialWeight === "sehr_hoch" || c?.commercialWeight === "hoch" ? "Hoch" : "Mittel"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Keine Hebel erkannt</span>
        )}
      </div>
      {/* Karte 3: Sofortmaßnahmen */}
      <div style={{ ...cardStyle, height: "100%" }}>
        <div style={titleStyle}>Sofortmaßnahmen</div>
        {topActions.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
            {topActions.map((a, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{sanitize(String(a))}</li>
            ))}
          </ul>
        ) : (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Keine Maßnahmen erkannt</span>
        )}
      </div>
    </div>
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
    <div style={{ marginTop: 32, marginBottom: 24, border: "1px solid #1e3a5f", borderRadius: 12, padding: 16, background: "#f0f7ff" }}>
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

function getSystemlogikSeverityLabel(severity: string | undefined): string {
  if (severity === "critical" || severity === "high") return "Hoch";
  if (severity === "medium") return "Mittel";
  if (severity === "low") return "Niedrig";
  return severity ?? "—";
}

function getSystemlogikSeverityStyle(severity: string | undefined): { color: string; fontWeight: number; background?: string } {
  if (severity === "critical" || severity === "high") return { color: "#b91c1c", fontWeight: 700, background: "#fef2f2" };
  if (severity === "medium") return { color: "#a36b00", fontWeight: 600, background: "#fffbeb" };
  if (severity === "low") return { color: "#64748b", fontWeight: 500 };
  return { color: "#64748b", fontWeight: 500 };
}

type SystemlogikSectionProps = {
  systemLogic: NonNullable<NachtragspotenzialAnalysisResult["systemLogic"]>;
  sanitize: (s: string) => string;
  isExpertMode?: boolean;
};

function SystemlogikSection({ systemLogic, sanitize, isExpertMode }: SystemlogikSectionProps) {
  const systems = systemLogic?.systemsDetected ?? [];
  const findings = systemLogic?.findings ?? [];
  const querschnitt = systemLogic?.querschnittDetected ?? [];
  const debugEntries = systemLogic?.debugDetection ?? [];
  const systemSummaries = systemLogic?.systemSummaries ?? [];
  const hasSystems = Array.isArray(systems) && systems.length > 0;
  const hasFindings = Array.isArray(findings) && findings.length > 0;
  const hasQuerschnitt = Array.isArray(querschnitt) && querschnitt.length > 0;
  const showDebug = isExpertMode && Array.isArray(debugEntries) && debugEntries.length > 0;
  const summariesForSystems = systemSummaries.filter((s) => systems.includes(s?.system ?? ""));
  const summariesForQuerschnitt = systemSummaries.filter((s) => querschnitt.includes(s?.system ?? ""));
  const hasSummaries = Array.isArray(summariesForSystems) && summariesForSystems.length > 0;
  const hasQuerschnittSummaries = Array.isArray(summariesForQuerschnitt) && summariesForQuerschnitt.length > 0;

  const relevanceOrder = (r: typeof summariesForSystems[0]) =>
    r?.commercialRelevance === "hoch" ? 3 : r?.commercialRelevance === "mittel" ? 2 : r?.commercialRelevance === "niedrig" ? 1 : 0;
  const sortedSummaries = [...summariesForSystems].sort((a, b) => relevanceOrder(b) - relevanceOrder(a));

  const [findingsExpanded, setFindingsExpanded] = useState(false);

  return (
    <div
      style={{
        marginTop: 20,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 20,
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        {hasSystems ? (
          <>
            {hasSummaries ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {sortedSummaries.map((sum, i) => {
                  const relevanceLabel =
                    sum?.commercialRelevance === "hoch"
                      ? "Relevanz: hoch"
                      : sum?.commercialRelevance === "mittel"
                        ? "Relevanz: mittel"
                        : sum?.commercialRelevance === "niedrig"
                          ? "Relevanz: niedrig"
                          : null;
                  const actionLabel =
                    sum?.actionType === "rueckfrage"
                      ? "Rückfrage"
                      : sum?.actionType === "klarstellung"
                        ? "Klarstellung"
                        : sum?.actionType === "kalkulationsaufschlag"
                          ? "Kalkulationsaufschlag"
                          : sum?.actionType === "beobachten"
                            ? "Beobachten"
                            : sum?.actionType === "ignorieren"
                              ? "Ignorieren"
                              : sum?.recommendedHandling ?? "";
                  return (
                    <div
                      key={i}
                      style={{
                        padding: 16,
                        background: "#f8fafc",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#334155" }}>{sanitize(sum?.system ?? "")}</span>
                        {sum?.detectionConfidenceLabel != null && sum.detectionConfidenceLabel !== "" && (
                          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 9999, background: "#e2e8f0", color: "#475569" }}>
                            Erkennung: {sanitize(sum.detectionConfidenceLabel)}
                          </span>
                        )}
                        {relevanceLabel && (
                          <span
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 9999,
                              background:
                                sum?.commercialRelevance === "hoch"
                                  ? "#fef2f2"
                                  : sum?.commercialRelevance === "mittel"
                                    ? "#fffbeb"
                                    : "#f0fdf4",
                              color:
                                sum?.commercialRelevance === "hoch"
                                  ? "#b91c1c"
                                  : sum?.commercialRelevance === "mittel"
                                    ? "#a36b00"
                                    : "#15803d",
                            }}
                          >
                            {relevanceLabel}
                          </span>
                        )}
                      </div>
                      {sum?.detectionReasonShort != null && sum.detectionReasonShort !== "" && (
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{sanitize(sum.detectionReasonShort)}</div>
                      )}
                      {sum?.procurementMeaning != null && sum.procurementMeaning !== "" && (
                        <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, marginBottom: 10 }}>
                          {sanitize(sum.procurementMeaning)}
                        </div>
                      )}
                      <div style={{ fontWeight: 600, fontSize: 12, color: "#1e40af", marginBottom: 10 }}>
                        Empfohlene Aktion: {actionLabel}
                      </div>
                      {(sum?.suggestedQuestion != null && sum.suggestedQuestion !== "") ||
                      (sum?.suggestedOfferNote != null && sum.suggestedOfferNote !== "") ? (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                          {sum?.suggestedQuestion != null && sum.suggestedQuestion !== "" && (
                            <div style={{ fontSize: 12, color: "#475569", marginBottom: 6, paddingLeft: 8, borderLeft: "3px solid #94a3b8" }}>
                              <span style={{ fontWeight: 600, color: "#64748b" }}>Rückfrage: </span>
                              {sanitize(sum.suggestedQuestion)}
                            </div>
                          )}
                          {sum?.suggestedOfferNote != null && sum.suggestedOfferNote !== "" && (
                            <div style={{ fontSize: 12, color: "#475569", paddingLeft: 8, borderLeft: "3px solid #94a3b8" }}>
                              <span style={{ fontWeight: 600, color: "#64748b" }}>Angebotsklarstellung: </span>
                              {sanitize(sum.suggestedOfferNote)}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              debugEntries.filter((e) => systems.includes(e?.label ?? "")).length > 0 && (
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                  {debugEntries.filter((e) => systems.includes(e?.label ?? "")).map((e, i) => (
                    <div key={i} style={{ marginBottom: 6, padding: "6px 8px", background: "#f1f5f9", borderRadius: 6 }}>
                      <span style={{ fontWeight: 600, color: "#334155" }}>{sanitize(e?.label ?? "")}</span>
                      {e?.detectionConfidenceLabel != null && e.detectionConfidenceLabel !== "" && (
                        <span style={{ marginLeft: 6, color: "#64748b" }}>· Konfidenz: {sanitize(e.detectionConfidenceLabel)}</span>
                      )}
                      {e?.detectionReasonShort != null && e.detectionReasonShort !== "" && (
                        <div style={{ marginTop: 4, color: "#475569" }}>{sanitize(e.detectionReasonShort)}</div>
                      )}
                      {e?.recommendedHandling != null && e.recommendedHandling !== "" && (
                        <div style={{ marginTop: 2, fontWeight: 600, color: "#1e40af" }}>Empfohlen: {sanitize(e.recommendedHandling)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        ) : (
          <span style={{ fontSize: 13, color: "#64748b" }}>Keine Systeme erkannt</span>
        )}
      </div>

      {hasQuerschnitt && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>Querschnittsthemen</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: hasQuerschnittSummaries ? 8 : 0 }}>
            {querschnitt.map((name, i) => (
              <span
                key={`q-${name}-${i}`}
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 9999,
                  background: "#f1f5f9",
                  color: "#64748b",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {sanitize(name)}
              </span>
            ))}
          </div>
          {hasQuerschnittSummaries && (
            <div style={{ display: "grid", gap: 8 }}>
              {summariesForQuerschnitt.map((sum, i) => (
                <div key={i} style={{ padding: 8, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 4 }}>{sanitize(sum?.system ?? "")}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>{sanitize(sum?.overallAssessmentShort ?? "")}</div>
                  {(sum?.findingCount ?? 0) > 0 && (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {sum.findingCount} Findings · Empfohlen: {sanitize(sum?.recommendedHandling ?? "")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={() => setFindingsExpanded((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#64748b",
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          {findingsExpanded ? "Details ausblenden" : "Details anzeigen"}
          <span style={{ fontSize: 10 }}>{findingsExpanded ? " ▲" : " ▼"}</span>
        </button>
        {findingsExpanded && (
          <div style={{ marginTop: 8 }}>
            {hasFindings ? (
              <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                {findings.map((f, i) => {
                  const style = getSystemlogikSeverityStyle(f?.severity);
                  return (
                    <li
                      key={i}
                      style={{
                        listStyleType: "disc",
                        ...(style.background && { padding: "4px 6px", borderRadius: 4, background: style.background }),
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#475569" }}>{sanitize(f?.system ?? "")}</span>
                      {" — "}
                      <span style={{ color: style.color, fontWeight: style.fontWeight }}>
                        {getSystemlogikSeverityLabel(f?.severity)}
                      </span>
                      <div style={{ marginTop: 2, color: "#64748b" }}>{sanitize(f?.message ?? "")}</div>
                      {(f?.reasoningShort != null && f.reasoningShort !== "") && (
                        <div style={{ marginTop: 2, fontSize: 11, color: "#94a3b8" }}>{sanitize(f.reasoningShort)}</div>
                      )}
                      {(f?.recommendedHandling != null && f.recommendedHandling !== "") && (
                        <div style={{ marginTop: 2, fontWeight: 600, fontSize: 11, color: "#1e40af" }}>Empfohlen: {sanitize(f.recommendedHandling)}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Keine systemlogischen Auffälligkeiten erkannt</span>
            )}
          </div>
        )}
      </div>

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
  /** Wenn true: Button deaktiviert, Hinweis „Nur in Pro“ (Feature-Gate Free vs. Pro). */
  proFeatureLocked?: boolean;
  /** Optionale Design-Tokens (z. B. PAGE_DESIGN) für einheitliche Karten/Typo/Farben. */
  designTokens?: {
    cardBorder: string;
    cardBg: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    primary: string;
    spacingCard: string;
    radiusButton: number;
    cardRadius: string;
    fontSizeSectionTitle: number;
    fontWeightSection: number;
  };
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
  proFeatureLocked = false,
  designTokens,
}: Props) {
  const [systemOpen, setSystemOpen] = useState(false);
  const D = designTokens;
  const cardBorder = D ? `1px solid ${D.cardBorder}` : (customerRoute ? "1px solid #e2e8f0" : "1px solid #e5e5e5");
  const cardBg = D ? D.cardBg : (customerRoute ? "#ffffff" : "#fff");
  const textPrimary = D?.textPrimary ?? "#334155";
  const textSecondary = D?.textSecondary ?? "#475569";
  const textMuted = D?.textMuted ?? "#64748b";
  const primary = D?.primary ?? "#334155";
  const radius = D?.radiusButton ?? 8;
  const cardRadius = D?.cardRadius ?? "12px";
  const fontSizeTitle = D?.fontSizeSectionTitle ?? 14;
  const fontWeightTitle = D?.fontWeightSection ?? 700;

  return (
    <div style={{ border: cardBorder, borderRadius: D?.cardRadius ?? 14, padding: D ? 20 : 16, background: cardBg, marginTop: D ? 0 : 24 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: D ? 16 : 16,
          rowGap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: fontSizeTitle, color: textPrimary, fontWeight: fontWeightTitle }}>Nachtragspotenzial</div>
        {isExpertMode && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: textSecondary, fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={useChangePotentialLlm}
              onChange={(e) => onUseChangePotentialLlmChange(e.target.checked)}
            />
            KI‑Veredelung aktivieren
          </label>
        )}
        {proFeatureLocked && (
          <>
            <span style={{ fontSize: 12, fontWeight: 600, color: textMuted }}>Nur in Pro</span>
            <Link href="/pricing" style={{ fontSize: 12, fontWeight: 600, color: primary }}>→ Pro</Link>
          </>
        )}
        <button
          onClick={onGenerate}
          disabled={loading || proFeatureLocked}
          style={{
            padding: "10px 18px",
            borderRadius: radius,
            border: "none",
            background: loading || proFeatureLocked ? textMuted : primary,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || proFeatureLocked ? "not-allowed" : "pointer",
            opacity: loading || proFeatureLocked ? 0.8 : 1,
          }}
        >
          {loading
            ? DEFAULT_TEXTS_CONFIG.customerUI.buttonLabels.nachtragspotenzialErmittelnLoading
            : DEFAULT_TEXTS_CONFIG.customerUI.buttonLabels.nachtragspotenzialErmitteln}
        </button>
      </div>

      {loading && (
        <div style={{ marginTop: 14, padding: 20, textAlign: "center", color: textSecondary, fontWeight: fontWeightTitle }}>
          Analyse läuft…
        </div>
      )}

      {!loading && !analysis && (
        <div style={{ marginTop: 14, color: textSecondary, fontSize: 13, fontWeight: 600 }}>
          Klicke „Nachtragspotenziale ermitteln", um mögliche Nachtragstreiber aus der Analyse abzuleiten (Strang B).
        </div>
      )}

      {isExpertMode && !customerRoute && (
        <div style={{ marginTop: 8, color: textMuted, fontSize: 11 }}>
          Die KI verfeinert die erkannten Nachtragspotenziale fachlich/präziser, erzeugt aber keine völlig freien neuen
          Haupttreffer.
        </div>
      )}

      {!loading && analysis && (
        <>
          <NachtragExecutivePanel analysis={analysis} sanitize={sanitizeForDisplay} />

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

          {analysis.offerStrategySummary && (
            <OfferStrategyBlock
              data={analysis.offerStrategySummary}
              isExpertMode={isExpertMode}
              sanitize={sanitizeForDisplay}
            />
          )}

          {analysis?.systemLogic != null && (
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setSystemOpen((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 0",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid #e2e8f0",
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "#334155",
                  fontSize: 14,
                  textAlign: "left",
                }}
              >
                <span>Systemanalyse</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{systemOpen ? "▼" : "▶"}</span>
              </button>
              {systemOpen && (
                <SystemlogikSection
                  systemLogic={analysis.systemLogic}
                  sanitize={sanitizeForDisplay}
                  isExpertMode={isExpertMode}
                />
              )}
            </div>
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
