"use client";

import React, { useState } from "react";
import Link from "next/link";
import { sanitizeForDisplay } from "@/lib/displayText";
import { DEFAULT_TEXTS_CONFIG } from "@/lib/textsConfig";
import { buildNachtragCustomerView } from "@/lib/nachtrag-v2/customerView";
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

/** Einheitliches visuelles System — Nachtragspotenzial-Modul (nur UI). */
const NP = {
  r: { sm: 8, md: 10, lg: 12 },
  border: { hairline: "1px solid #e2e8f0", card: "1px solid #e2e8f0", accent: "1px solid #cbd5e1" },
  bg: { canvas: "#f8fafc", card: "#ffffff", elevated: "#f1f5f9", action: "#eff6ff", next: "#f8fafc" },
  text: { title: "#0f172a", body: "#334155", muted: "#64748b", hint: "#94a3b8" },
  shadow: { kpi: "0 1px 3px rgba(15,23,42,0.07), 0 1px 2px rgba(15,23,42,0.04)", card: "0 1px 2px rgba(15,23,42,0.05)" },
  accent: { primary: "#2563eb", ink: "#1e293b" },
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

const SOURCE_TYPE_LABELS: Record<ChangePotentialSourceType, string> = {
  vortext: "Vortext",
  position: "Position",
  remark: "Vorbemerkung",
  addtext: "Zusatztext",
  global: "Analyse",
  unknown: "Unbekannt",
};

/** Kurzbezug für Arbeitskarten (verständlicher als Rohpfad). */
const SOURCE_CONTEXT_SHORT: Record<ChangePotentialSourceType, string> = {
  vortext: "Vorwort LV",
  position: "Position",
  remark: "Vorbemerkungen",
  addtext: "Zusatztext",
  global: "Gesamtbild",
  unknown: "—",
};

function humanPathFragment(path: string): string {
  const p = String(path ?? "").trim().toLowerCase();
  if (!p) return "";
  if (p === "vortext" || p.endsWith("/vortext")) return "Vorwort LV";
  if (p.includes("vorbemerk")) return "Vorbemerkungen";
  if (p.includes("position")) return "Positionstext";
  return path.trim();
}

function labelFor<T extends string>(map: Record<string, string>, value: T): string {
  return map[value] ?? String(value);
}

/** Klarsprache für Begründungs-Akkordeon (ohne Engine-Änderung, nur UI-Formulierung). */
function humanizeConfidenceNotes(s: string): string {
  return String(s ?? "")
    .replace(/\braw-basierte Evidenzen\b/gi, "LV-nahe Textstellen")
    .replace(/\bRaw-Anteil\b/gi, "Anteil LV-naher Textstellen")
    .replace(/\bRaw\b/g, "LV-nahe Textstellen");
}

function potentialWhySentence(
  label: import("@/lib/nachtrag-v2/customerView").NachtragCustomerView["potentialLabel"]
): string {
  if (label === "Hoch") return "Das Potenzial für spätere Zusatzthemen und Nachverhandlungen ist hoch.";
  if (label === "Erhöht") return "Offene oder widersprüchliche Stellen im Leistungsbild erhöhen das Nachtragspotenzial spürbar.";
  if (label === "Mittel") return "Es gibt erkennbare Spannungen; das Gesamtbild bleibt aber noch beherrschbar.";
  return "Das Potenzial für spätere Zusatzthemen wirkt derzeit eher gering.";
}

function enforceabilityWhySentence(
  label: import("@/lib/nachtrag-v2/customerView").NachtragCustomerView["enforceabilityLabel"]
): string {
  if (label === "Stark") return "Ansprüche lassen sich mit den vorliegenden Hinweisen vorbereitend gut begründen.";
  if (label === "Solide") return "Mit sauberen Nachweisen und Abgrenzungen ist eine tragfähige Argumentation möglich.";
  if (label === "Begrenzt") return "Ohne Klarstellungen und Belege bleibt die Durchsetzbarkeit begrenzt.";
  return "Die Grundlage für durchsetzbare Ansprüche ist dünn; zuerst Fakten schärfen.";
}

function driversMergedSentence(drivers: string[]): string | null {
  const d = drivers.filter(Boolean).slice(0, 3);
  if (d.length === 0) return null;
  if (d.length === 1) return `Maßgeblich ist vor allem: ${d[0]}.`;
  if (d.length === 2) return `Maßgeblich sind ${d[0]} und ${d[1]}.`;
  return `Schwerpunkte: ${d[0]}, ${d[1]} und ${d[2]}.`;
}

function buildWhyAssessmentBullets(
  summary: ChangePotentialSummary,
  v2: unknown
): { main: string[]; uncertainties: string[] } {
  const hasV2 = !!v2 && typeof (v2 as { potentialScore?: unknown }).potentialScore === "number";
  if (hasV2) {
    const view = buildNachtragCustomerView({ v2: v2 as import("@/lib/nachtrag-v2/types").NachtragResultV2 });
    const main: string[] = [potentialWhySentence(view.potentialLabel)];
    const merged = driversMergedSentence(view.topDrivers);
    if (merged) main.push(merged);
    main.push(enforceabilityWhySentence(view.enforceabilityLabel));
    const uncertainties: string[] = [];
    const note = humanizeConfidenceNotes(view.confidenceReason).trim();
    if ((view.confidenceLabel === "Niedrig" || view.confidenceLabel === "Mittel") && note) {
      uncertainties.push(note);
    }
    if (uncertainties.length === 0 && view.confidenceLabel === "Niedrig") {
      uncertainties.push("Einzelpositionen können von dieser Gesamteinschätzung abweichen.");
    }
    return { main: main.slice(0, 5), uncertainties: uncertainties.slice(0, 2) };
  }
  const main: string[] = [];
  if (summary.shortRiskReason?.trim()) {
    main.push(...summary.shortRiskReason.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2));
  } else {
    main.push(summary.riskClassLabel || "Die Einordnung folgt dem vorliegenden Leistungsbild.");
  }
  return { main: main.slice(0, 4), uncertainties: [] };
}

function buildWorkSnapshotBlocks(
  summary: ChangePotentialSummary,
  v2: unknown
): { treiber: string[]; blocker: string[]; belastbarkeit: string[]; risiko: string[] } {
  const hasV2 = !!v2 && typeof (v2 as { potentialScore?: unknown }).potentialScore === "number";
  if (!hasV2) {
    return {
      treiber: [summary.riskClassLabel || "Orientierung über das vorliegende Potenzial."],
      blocker: ["Feiner Einordnung fehlt die erweiterte Sicht."],
      belastbarkeit: ["Arbeitsliste oder neue Analyse nutzen."],
      risiko: ["Gesamtbild nur grob einschätzbar."],
    };
  }
  const view = buildNachtragCustomerView({ v2: v2 as import("@/lib/nachtrag-v2/types").NachtragResultV2 });
  const treiber = [...view.topDrivers.slice(0, 4)];
  if (treiber.length < 2) {
    treiber.push("Unklare Leistungsgrenzen und Schnittstellen.");
  }

  const blocker: string[] = [];
  if (view.enforceabilityLabel === "Schwach" || view.enforceabilityLabel === "Begrenzt") {
    blocker.push("Ohne Nachweise und Klarstellungen wenig durchsetzbar.");
  }
  if (view.confidenceLabel === "Niedrig") {
    blocker.push("Viele Hinweise sind indirekt.");
  }
  if (blocker.length < 2) {
    blocker.push("Offene Mengen und Dokus bremsen Einigung.");
  }
  if (blocker.length < 2) {
    blocker.push("Mehrere Themen parallel verwässern Fokus.");
  }

  const belastbarkeit: string[] = [];
  if (view.confidenceLabel === "Hoch") {
    belastbarkeit.push("LV-Bezüge stützen die Einordnung.");
    belastbarkeit.push("Konkrete Textstellen nutzbar.");
  } else if (view.confidenceLabel === "Mittel") {
    belastbarkeit.push("Teils belastbar; sauber dokumentieren.");
    belastbarkeit.push("Nachweise erhöhen Tragfähigkeit.");
  } else {
    belastbarkeit.push("Wenig direkte Stützung im Text.");
    belastbarkeit.push("Vor Aussagen intern prüfen.");
  }

  const risiko: string[] = [];
  if (view.confidenceLabel === "Niedrig") {
    risiko.push("Fehleinschätzung möglich (dünne Lage).");
  } else {
    risiko.push("Einzelthemen weichen ab.");
  }
  risiko.push("Ohne Priorisierung: Zeit- und Kalkulationsrisiko.");

  return {
    treiber: treiber.slice(0, 4),
    blocker: blocker.slice(0, 4),
    belastbarkeit: belastbarkeit.slice(0, 4),
    risiko: risiko.slice(0, 4),
  };
}

function mapRecommendedToHandlung(action: ChangePotentialRecommendedAction): string {
  if (action === "rueckfrage") return "Rückfrage";
  if (action === "angebotsklarstellung") return "Klarstellung";
  if (action === "kalkulatorisch_absichern") return "Vorbehalt";
  if (action === "claim_feld_beobachten") return "Nachweis";
  if (action === "nicht_verfolgen") return "Nicht priorisieren";
  return "Nachweis";
}

function priorityFromImpact(impact: ChangePotentialImpactLevel): "hoch" | "mittel" | "niedrig" {
  if (impact === "sehr_hoch" || impact === "hoch") return "hoch";
  if (impact === "mittel") return "mittel";
  return "niedrig";
}

function buildNextStepParts(item: ChangePotentialItem): Array<{ label: string; text: string }> {
  const out: Array<{ label: string; text: string }> = [];
  if (item.questionDraft?.trim()) out.push({ label: "Rückfrage", text: item.questionDraft.trim() });
  if (item.clarificationDraft?.trim()) out.push({ label: "Klarstellung", text: item.clarificationDraft.trim() });
  if (item.pricingHint?.trim()) out.push({ label: "Kalkulation", text: item.pricingHint.trim() });
  return out;
}

function formatBezugZeile(
  item: ChangePotentialItem,
  labelForSourceType: (v: ChangePotentialSourceType) => string
): string {
  const parts: string[] = [];
  if (item.trade?.trim()) parts.push(item.trade.trim());
  if (item.sourcePositionRef?.trim()) {
    parts.push(`Pos. ${item.sourcePositionRef.trim()}`);
  } else if (item.sourcePath?.trim()) {
    const h = humanPathFragment(item.sourcePath);
    parts.push(h);
  } else if (item.sourceType != null) {
    parts.push(SOURCE_CONTEXT_SHORT[item.sourceType] ?? labelForSourceType(item.sourceType));
  }
  return parts.join(" · ") || "";
}

function truncateOneLine(s: string, max: number): string {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

// ================= Neue Engine – Darstellung (bevorzugt wenn changePotentialSummary vorhanden) =================

type NewEngineViewProps = {
  analysis: NachtragspotenzialAnalysisResult;
  summary: ChangePotentialSummary;
  isExpertMode: boolean;
  labelForFieldType: (v: ChangePotentialFieldType) => string;
  labelForMechanism: (v: ChangePotentialMechanism) => string;
  labelForEnforceability: (v: ChangePotentialEnforceability) => string;
  labelForSourceType: (v: ChangePotentialSourceType) => string;
  sanitize: (s: string) => string;
};

function WorkSnapshotMiniGrid({
  treiber,
  blocker,
  belastbarkeit,
  risiko,
}: {
  treiber: string[];
  blocker: string[];
  belastbarkeit: string[];
  risiko: string[];
}) {
  const cell = (title: string, lines: string[]) => (
    <div
      style={{
        background: NP.bg.card,
        padding: "8px 10px 10px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 11,
          color: NP.text.muted,
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: "1px solid #e2e8f0",
          letterSpacing: "0.02em",
        }}
      >
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11, color: NP.text.body, lineHeight: 1.38, display: "grid", gap: 2 }}>
        {lines.map((line, i) => (
          <li key={i} style={{ paddingLeft: 2 }}>
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div
      style={{
        marginTop: 10,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(152px, 1fr))",
        gap: 1,
        background: "#cbd5e1",
        borderRadius: NP.r.md,
        overflow: "hidden",
        border: "1px solid #cbd5e1",
        boxShadow: NP.shadow.card,
      }}
    >
      {cell("Treiber", treiber)}
      {cell("Blocker", blocker)}
      {cell("Belastbarkeit", belastbarkeit)}
      {cell("Risiko", risiko)}
    </div>
  );
}

function NewEngineView({
  analysis,
  summary,
  isExpertMode,
  labelForFieldType,
  labelForMechanism,
  labelForEnforceability,
  labelForSourceType,
  sanitize,
}: NewEngineViewProps) {
  const [analysisOverviewOpen, setAnalysisOverviewOpen] = useState(false);
  const [workOverviewOpen, setWorkOverviewOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const { items } = summary;
  const v2 = (analysis as { changePotentialSummary?: { v2Debug?: unknown } }).changePotentialSummary?.v2Debug;
  const why = buildWhyAssessmentBullets(summary, v2);
  const snapshot = buildWorkSnapshotBlocks(summary, v2);

  const accBtn: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "10px 4px",
    background: NP.bg.card,
    border: NP.border.hairline,
    borderRadius: NP.r.sm,
    cursor: "pointer",
    fontWeight: 700,
    color: NP.text.title,
    fontSize: 13,
    textAlign: "left",
    marginTop: 8,
    boxShadow: NP.shadow.card,
  };

  return (
    <>
      {/* 1. Warum diese Einschätzung? — Begründung, keine Statistik */}
      <div style={{ marginTop: 0 }}>
        <button type="button" onClick={() => setAnalysisOverviewOpen((v) => !v)} style={{ ...accBtn, marginTop: 0 }}>
          <span style={{ letterSpacing: "-0.01em" }}>Warum diese Einschätzung?</span>
          <span style={{ fontSize: 11, color: NP.text.muted, fontWeight: 700 }}>{analysisOverviewOpen ? "▼" : "▶"}</span>
        </button>
        {analysisOverviewOpen && (
          <div style={{ marginTop: 12, paddingLeft: 2, paddingRight: 4 }}>
            <div style={{ display: "grid", gap: 10 }}>
              {why.main.map((line, i) => (
                <p key={i} style={{ margin: 0, fontSize: 13, color: NP.text.body, lineHeight: 1.55 }}>
                  {sanitize(line)}
                </p>
              ))}
            </div>
            {why.uncertainties.length > 0 && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: NP.bg.card, borderRadius: NP.r.sm, border: NP.border.hairline }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: NP.text.muted, marginBottom: 6 }}>Was unsicher bleibt</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {why.uncertainties.map((line, i) => (
                    <p key={i} style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
                      {sanitize(line)}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Arbeitslage auf einen Blick — Verdichtung (keine System-Einzelkarten) */}
      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={() => setWorkOverviewOpen((v) => !v)} style={accBtn}>
          <span style={{ letterSpacing: "-0.01em" }}>Arbeitslage auf einen Blick</span>
          <span style={{ fontSize: 11, color: NP.text.muted, fontWeight: 700 }}>{workOverviewOpen ? "▼" : "▶"}</span>
        </button>
        {workOverviewOpen && (
          <WorkSnapshotMiniGrid
            treiber={snapshot.treiber}
            blocker={snapshot.blocker}
            belastbarkeit={snapshot.belastbarkeit}
            risiko={snapshot.risiko}
          />
        )}
      </div>

      {/* 3. Arbeitsliste Nachtragsfelder */}
      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={() => setFieldsOpen((v) => !v)} style={accBtn}>
          <span style={{ letterSpacing: "-0.01em" }}>Arbeitsliste Nachtragsfelder</span>
          <span style={{ fontSize: 11, color: NP.text.muted, fontWeight: 700 }}>{fieldsOpen ? "▼" : "▶"}</span>
        </button>
        {fieldsOpen && (
          <>
            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              {items.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  isExpertMode={isExpertMode}
                  labelForFieldType={labelForFieldType}
                  labelForMechanism={labelForMechanism}
                  labelForEnforceability={labelForEnforceability}
                  labelForSourceType={labelForSourceType}
                  sanitize={sanitize}
                />
              ))}
            </div>
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #e2e8f0", color: NP.text.hint, fontSize: 11, lineHeight: 1.45 }}>
              Operative Liste — technische Rohdaten nur im Expertenmodus.
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ItemCard({
  item,
  isExpertMode,
  labelForFieldType,
  labelForMechanism,
  labelForEnforceability,
  labelForSourceType,
  sanitize,
}: {
  item: ChangePotentialItem;
  isExpertMode: boolean;
  labelForFieldType: (v: ChangePotentialFieldType) => string;
  labelForMechanism: (v: ChangePotentialMechanism) => string;
  labelForEnforceability: (v: ChangePotentialEnforceability) => string;
  labelForSourceType: (v: ChangePotentialSourceType) => string;
  sanitize: (s: string) => string;
}) {
  const handlung = mapRecommendedToHandlung(item.recommendedAction);
  const prio = priorityFromImpact(item.impactLevel);
  const nextParts = buildNextStepParts(item);
  const bezug = formatBezugZeile(item, labelForSourceType);
  const showMeta =
    isExpertMode &&
    !(item.fieldType === "sonstiges" && item.changeMechanism === "unklar");
  const hasTech =
    isExpertMode &&
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
      item.candidate);

  return (
    <div
      style={{
        border: NP.border.card,
        borderRadius: NP.r.md,
        borderLeft: `3px solid ${NP.accent.primary}`,
        padding: "12px 14px 12px 13px",
        background: NP.bg.card,
        boxShadow: NP.shadow.card,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontWeight: 700, color: NP.text.title, fontSize: 14, lineHeight: 1.35, flex: 1, letterSpacing: "-0.02em" }}>{sanitize(item.title)}</div>
        <span
          title="Priorität"
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            padding: "5px 11px",
            borderRadius: 6,
            background: prio === "hoch" ? "#fff1f2" : prio === "mittel" ? "#fffbeb" : NP.bg.canvas,
            color: prio === "hoch" ? "#be123c" : prio === "mittel" ? "#b45309" : "#64748b",
            border: `1px solid ${prio === "hoch" ? "#fecdd3" : prio === "mittel" ? "#fde68a" : "#e2e8f0"}`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {prio}
        </span>
      </div>

      {bezug ? (
        <div style={{ fontSize: 11, color: NP.text.hint, marginBottom: 10, lineHeight: 1.35 }}>{sanitize(bezug)}</div>
      ) : null}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: NP.text.muted, marginBottom: 5 }}>Inhalt</div>
        <div style={{ fontSize: 13, color: NP.text.body, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{sanitize(item.reasoning)}</div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "10px 16px",
          padding: "10px 0",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: NP.text.muted, marginBottom: 4 }}>Aktion</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: NP.accent.primary, letterSpacing: "-0.02em" }}>{handlung}</div>
        </div>
        <div style={{ fontSize: 11, color: NP.text.hint, textAlign: "right", maxWidth: 200 }}>
          <span style={{ color: NP.text.hint }}>Tragfähigkeit </span>
          <span style={{ fontWeight: 600, color: NP.text.muted }}>{labelForEnforceability(item.enforceability)}</span>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: "10px 0 0 12px",
          borderLeft: `3px solid ${NP.accent.primary}`,
          background: "linear-gradient(90deg, #eff6ff 0%, #ffffff 48%)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>Als Nächstes</div>
        {nextParts.length > 0 ? (
          <div style={{ display: "grid", gap: 6 }}>
            {nextParts.map((p, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, fontWeight: 600, color: NP.text.muted, marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontSize: 13, color: NP.text.title, lineHeight: 1.4 }}>{sanitize(p.text)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: NP.text.muted, lineHeight: 1.45 }}>Rückfrage oder Klarstellung vorbereiten und intern abstimmen.</div>
        )}
      </div>

      {showMeta && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#cbd5e1", lineHeight: 1.35 }}>
          {labelForFieldType(item.fieldType)} · {labelForMechanism(item.changeMechanism)}
        </div>
      )}

      {item.commercialStrategy && isExpertMode && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: NP.bg.action, borderRadius: NP.r.sm, fontSize: 11, color: NP.text.body, lineHeight: 1.4, border: "1px solid #bfdbfe" }}>
          <span style={{ fontWeight: 700, color: "#1d4ed8" }}>Kommerziell </span>
          {labelFor(COMMERCIAL_STRATEGY_ACTION_LABELS, item.commercialStrategy.primaryAction)} — {sanitize(truncateOneLine(item.commercialStrategy.strategyReasoning, 140))}
        </div>
      )}

      {!isExpertMode && (item.llmValidated || item.llmAdjusted) && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#cbd5e1" }}>{item.llmAdjusted ? "KI überarbeitet" : "KI geprüft"}</div>
      )}

      {hasTech && (
        <details style={{ marginTop: 10 }}>
          <summary
            style={{
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: NP.text.hint,
              listStyle: "none",
              outline: "none",
            }}
          >
            Technische Herkunft
          </summary>
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              background: NP.bg.canvas,
              borderRadius: NP.r.sm,
              fontSize: 10,
              color: NP.text.muted,
              lineHeight: 1.45,
              border: NP.border.hairline,
            }}
          >
            {item.sourceType != null && <div>Quelle: {labelForSourceType(item.sourceType)}</div>}
            {item.sourcePath && <div>Pfad: {sanitize(item.sourcePath)}</div>}
            {item.sourceQuote && (
              <div style={{ fontFamily: "ui-monospace, monospace", marginTop: 4, wordBreak: "break-word", color: NP.text.hint }}>
                „{sanitize(String(item.sourceQuote).slice(0, 100))}{item.sourceQuote.length > 100 ? "…" : ""}“
              </div>
            )}
            {item.sourcePositionRef && <div>Position: {sanitize(item.sourcePositionRef)}</div>}
            {item.confidence !== undefined && <div>Konfidenz: {Math.round(item.confidence * 100)}%</div>}
            {item.tags && item.tags.length > 0 && <div>Tags: {item.tags.join(", ")}</div>}
            {(item.llmValidated || item.llmAdjusted) && (
              <div>
                KI: {typeof item.llmConfidence === "number" && item.llmConfidence > 0 ? `${Math.round(item.llmConfidence * 100)} %` : "—"} · {item.llmAdjusted ? "angepasst" : "geprüft"}
              </div>
            )}
            {(item.llmAdjusted || (item.llmChangedFields?.length ?? 0) > 0) && (
              <div>Geändert: {item.llmChangedFields && item.llmChangedFields.length > 0 ? item.llmChangedFields.join(", ") : "—"}</div>
            )}
            {item.llmNotes && <div>Notiz: {sanitize(item.llmNotes)}</div>}
            {item.candidate && <div>Vorschlags-Item</div>}
          </div>
        </details>
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

function NachtragExecutivePanel({
  analysis,
  sanitize,
}: {
  analysis: NachtragspotenzialAnalysisResult;
  sanitize: (s: string) => string;
}) {
  const v2 = (analysis as any)?.changePotentialSummary?.v2Debug;
  const hasV2 = !!v2 && typeof v2.potentialScore === "number" && typeof v2.enforceabilityScore === "number";

  if (!hasV2) {
    const summary = analysis?.changePotentialSummary;
    const index =
      summary?.overallIndex ??
      (analysis as { summaryIndex?: number; totalIndex?: number })?.summaryIndex ??
      (analysis as { summaryIndex?: number; totalIndex?: number })?.totalIndex ??
      0;
    return (
      <div
        style={{
          marginBottom: 16,
          border: NP.border.card,
          borderRadius: NP.r.md,
          padding: "12px 14px",
          background: NP.bg.card,
          boxShadow: NP.shadow.card,
        }}
      >
        <div style={{ fontWeight: 700, color: NP.text.title, marginBottom: 4, fontSize: 13, letterSpacing: "-0.02em" }}>Nachtragspotenzial</div>
        <div style={{ fontSize: 12, color: NP.text.muted, lineHeight: 1.45 }}>
          Einordnung folgt. Orientierung: <span style={{ fontWeight: 700, color: NP.text.body, fontVariantNumeric: "tabular-nums" }}>{Math.round(Number(index) || 0)}</span>
          <span style={{ color: NP.text.hint }}>/100</span>
        </div>
      </div>
    );
  }

  const view = buildNachtragCustomerView({ v2 });

  const kpiCard: React.CSSProperties = {
    border: NP.border.card,
    borderRadius: NP.r.md,
    padding: "12px 14px",
    background: NP.bg.card,
    boxShadow: NP.shadow.kpi,
    minHeight: 92,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  const insightCard: React.CSSProperties = {
    border: NP.border.card,
    borderRadius: NP.r.md,
    padding: "12px 14px",
    background: NP.bg.card,
    boxShadow: NP.shadow.card,
    minHeight: 120,
  };

  return (
    <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <div style={kpiCard}>
          <div style={{ fontSize: 12, fontWeight: 600, color: NP.text.muted }}>Potenzial</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: NP.text.title, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{view.potentialLabel}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: NP.accent.primary, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{Math.round(view.potentialScore)}</span>
          </div>
          <div style={{ fontSize: 11, color: NP.text.hint, fontWeight: 500 }}>Skala 0–100</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 12, fontWeight: 600, color: NP.text.muted }}>Durchsetzung</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: NP.text.title, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{view.enforceabilityLabel}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: NP.accent.primary, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{Math.round(view.enforceabilityScore)}</span>
          </div>
          <div style={{ fontSize: 11, color: NP.text.hint, fontWeight: 500 }}>Skala 0–100</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 12, fontWeight: 600, color: NP.text.muted }}>Belastbarkeit</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: NP.text.title, letterSpacing: "-0.03em", marginTop: 4, lineHeight: 1.15 }}>{view.confidenceLabel}</div>
          <div style={{ fontSize: 11, color: NP.text.muted, lineHeight: 1.35, marginTop: 4 }}>{sanitize(humanizeConfidenceNotes(view.confidenceReason))}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <div style={insightCard}>
          <div style={{ fontSize: 13, fontWeight: 700, color: NP.text.body, marginBottom: 8 }}>Treiber</div>
          {view.topDrivers.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 12, color: NP.text.body, lineHeight: 1.45 }}>
              {view.topDrivers.slice(0, 3).map((d, i) => (
                <li key={i}>{sanitize(d)}</li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: 12, color: NP.text.hint }}>—</div>
          )}
        </div>

        <div style={insightCard}>
          <div style={{ fontSize: 13, fontWeight: 700, color: NP.text.body, marginBottom: 8 }}>Schwerpunkte</div>
          {view.topLevers.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {view.topLevers.slice(0, 3).map((l, i) => (
                <div key={i} style={{ borderTop: i ? "1px solid #e2e8f0" : "none", paddingTop: i ? 8 : 0 }}>
                  <div style={{ fontWeight: 600, color: NP.text.title, fontSize: 12 }}>{sanitize(l.title)}</div>
                  <div style={{ fontSize: 11, color: NP.text.muted, marginTop: 3, lineHeight: 1.4 }}>{sanitize(truncateOneLine(l.explanation, 100))}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: NP.text.hint }}>—</div>
          )}
        </div>

        <div
          style={{
            ...insightCard,
            borderLeft: `3px solid ${NP.accent.primary}`,
            background: NP.bg.action,
            borderColor: "#bfdbfe",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 8 }}>Nächste Schritte</div>
          {view.immediateActions.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5, fontSize: 12, color: "#1e3a8a", lineHeight: 1.45, fontWeight: 500 }}>
              {view.immediateActions.slice(0, 3).map((a, i) => (
                <li key={i}>{sanitize(String(a))}</li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: 12, color: "#93c5fd" }}>—</div>
          )}
        </div>
      </div>

      <div
        style={{
          border: NP.border.hairline,
          borderRadius: NP.r.md,
          padding: "12px 14px",
          background: NP.bg.canvas,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: NP.text.muted, marginBottom: 6 }}>Kurzfassung</div>
        <div style={{ fontSize: 12, color: NP.text.body, lineHeight: 1.5 }}>{sanitize(view.managementSummary)}</div>
      </div>

      <div
        style={{
          border: NP.border.accent,
          borderRadius: NP.r.md,
          padding: "12px 14px 12px 16px",
          background: NP.bg.card,
          borderLeft: `4px solid ${NP.text.title}`,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: NP.text.muted, marginBottom: 6 }}>Strategie</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: NP.text.title, marginBottom: 6, letterSpacing: "-0.02em" }}>{sanitize(view.recommendedStrategy.title)}</div>
        <div style={{ fontSize: 12, color: NP.text.muted, lineHeight: 1.45 }}>{sanitize(view.recommendedStrategy.rationale)}</div>
      </div>
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
    <div
      style={{
        border: cardBorder,
        borderRadius: D?.cardRadius ?? 12,
        padding: D ? 20 : 18,
        background: D ? cardBg : "#fafbfc",
        marginTop: D ? 0 : 24,
        boxShadow: D ? undefined : "0 1px 3px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: D ? 16 : 16,
          rowGap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: fontSizeTitle, color: textPrimary, fontWeight: fontWeightTitle, letterSpacing: "-0.01em" }}>Nachtragspotenzial</div>
        {isExpertMode && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: textSecondary, fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={useChangePotentialLlm}
              onChange={(e) => onUseChangePotentialLlmChange(e.target.checked)}
            />
            KI‑Feinschliff
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
        <div style={{ marginTop: 12, padding: "16px 12px", textAlign: "center", color: textMuted, fontSize: 13 }}>
          Auswertung läuft …
        </div>
      )}

      {!loading && !analysis && (
        <div style={{ marginTop: 12, color: textSecondary, fontSize: 13, lineHeight: 1.45 }}>
          „Nachtragspotenziale ermitteln“ starten — dann erscheint die Einordnung und die Arbeitsliste.
        </div>
      )}

      {isExpertMode && !customerRoute && (
        <div style={{ marginTop: 6, color: textMuted, fontSize: 11, lineHeight: 1.4 }}>
          KI schärft Formulierungen, erfindet keine neuen Kerntreffer.
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

          {/* Experten-/Arbeitsansicht – klar abgetrennt */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: "1px solid #cbd5e1",
              background: "linear-gradient(180deg, #f1f5f9 0%, #f8fafc 32px, transparent 100%)",
              marginLeft: -2,
              marginRight: -2,
              paddingLeft: 10,
              paddingRight: 10,
              paddingBottom: 4,
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 14, letterSpacing: "-0.01em" }}>Arbeitsansicht</div>

            {(() => {
              const summary = analysis.changePotentialSummary;
              const useNewEngine = summary != null && summary.items.length > 0;

              if (useNewEngine) {
                return (
                  <NewEngineView
                    analysis={analysis}
                    summary={summary!}
                    isExpertMode={isExpertMode}
                    labelForFieldType={(v) => labelFor(FIELD_TYPE_LABELS, v)}
                    labelForMechanism={(v) => labelFor(MECHANISM_LABELS, v)}
                    labelForEnforceability={(v) => labelFor(ENFORCEABILITY_LABELS, v)}
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
                <>
                  {analysis.systemLogic != null && (
                    <div style={{ marginTop: 0 }}>
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
                        <span>Arbeitslage auf einen Blick</span>
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
                  <LegacyView
                    analysis={analysis}
                    deduplicatedOpportunities={deduplicatedOpportunities}
                    isExpertMode={isExpertMode}
                    sanitize={sanitizeForDisplay}
                  />
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
