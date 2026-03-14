"use client";

import React, { useState } from "react";
import {
  PageShell,
  MetricCard,
  AccentCard,
  SectionCard,
  ScoreBadge,
  AccordionSection,
  InsightList,
} from "@/components/ui";
import { colors, spacing, radius, shadows } from "@/lib/ui/theme";
import type { ChangeOrderResult } from "@/lib/changeOrderAnalysis";
import { DEFAULT_TEXTS_CONFIG } from "@/lib/textsConfig";

type CategoryKey =
  | "vertrags_lv_risiken"
  | "mengen_massenermittlung"
  | "technische_vollstaendigkeit"
  | "schnittstellen_nebenleistungen"
  | "kalkulationsunsicherheit";

const CATEGORY_ORDER: CategoryKey[] = [
  "vertrags_lv_risiken",
  "mengen_massenermittlung",
  "technische_vollstaendigkeit",
  "schnittstellen_nebenleistungen",
  "kalkulationsunsicherheit",
];

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  vertrags_lv_risiken: colors.danger,
  mengen_massenermittlung: "#F59E0B",
  technische_vollstaendigkeit: colors.primary,
  schnittstellen_nebenleistungen: colors.secondary,
  kalkulationsunsicherheit: "#EAB308",
};

function catLabel(k: string) {
  return DEFAULT_TEXTS_CONFIG.internal.categoryLabels[k as keyof typeof DEFAULT_TEXTS_CONFIG.internal.categoryLabels] ?? k;
}

function clamp0_100(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

export type AnalyseCockpitViewProps = {
  /** Projektname (z. B. aus KeyFacts) */
  projectName?: string;
  /** Dateiname */
  fileName?: string;
  /** Dateigröße in Bytes */
  fileSize?: number;
  /** Projektart (optional) */
  projectType?: string;
  /** Analysezeitpunkt (optional, z. B. "06.03.2025 14:30") */
  analysisTimestamp?: string;
  /** Score-Ergebnis */
  result: {
    total: number;
    perCategory?: Record<string, number>;
    level?: string;
    findingsSorted?: Array<{ id: string; title?: string; severity?: string; category?: string }>;
  };
  /** Nachtragsanalyse (Claim-Potenzial, Management Summary) – vollständiger Typ aus API */
  changeOrderAnalysis?: ChangeOrderResult | null;
  /** Rückfragen (gruppiert) */
  clarificationQuestions?: { questions?: unknown[]; byGroup?: Record<string, Array<{ question?: string; title?: string }>> } | null;
  /** Angebotsklarstellungen (gruppiert) */
  offerAssumptions?: { assumptions?: unknown[]; byGroup?: Record<string, Array<{ assumption?: string; title?: string }>> } | null;
  /** KeyFacts / Projektdaten für Detailanalyse */
  keyFactsProjektdaten?: Array<[string, string]>;
  keyFactLabels?: Record<string, string>;
  /** Sanitize-Funktion für Text */
  sanitize: (s: string) => string;
  /** Wechsel zu anderem Tab (z. B. "nachtragspotenzial", "rueckfragen") */
  onTabChange?: (tab: string) => void;
};

function fmtKB(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Analyse-Cockpit: moderne Darstellung der Hauptanalyse-Seite.
 * Nur Layout/UI – keine Business-Logik. Daten kommen ausschließlich über Props.
 */
export function AnalyseCockpitView({
  projectName,
  fileName,
  fileSize,
  projectType,
  analysisTimestamp,
  result,
  changeOrderAnalysis,
  clarificationQuestions,
  offerAssumptions,
  keyFactsProjektdaten = [],
  keyFactLabels = {},
  sanitize,
  onTabChange,
}: AnalyseCockpitViewProps) {
  const [keyFactsOpen, setKeyFactsOpen] = useState(false);
  const total = clamp0_100(result?.total ?? 0);
  const perCategory = result?.perCategory ?? {};
  const findings = result?.findingsSorted ?? [];
  const criticalCount = findings.filter((f) => f.severity === "high" || f.severity === "critical").length;

  const claimLevel = (() => {
    if (!changeOrderAnalysis) return null;
    const opps = changeOrderAnalysis as { opportunities?: Array<{ potential?: string }> };
    const list = opps.opportunities ?? [];
    const hasHigh = list.some((o) => (o.potential ?? "").toString().toLowerCase() === "high");
    const hasMedium = list.some((o) => (o.potential ?? "").toString().toLowerCase() === "medium");
    if (list.length === 0) return { text: "Keine", variant: "success" as const };
    if (hasHigh) return { text: "Hoch", variant: "danger" as const };
    if (hasMedium) return { text: "Mittel", variant: "warning" as const };
    return { text: "Gering", variant: "success" as const };
  })();

  const offerSummary = changeOrderAnalysis?.offerStrategySummary;

  return (
    <PageShell maxWidth="1280px" compact>
      {/* 1 Header – kompakt für Cockpit-Ansicht */}
      <header
        style={{
          marginBottom: spacing[4],
          paddingBottom: spacing[2],
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ display: "grid", gap: spacing[2], gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {projectName && (
            <div>
              <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Projekt</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{sanitize(projectName)}</div>
            </div>
          )}
          {fileName && (
            <div>
              <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Datei</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{sanitize(fileName)}{fileSize ? ` · ${fmtKB(fileSize)}` : ""}</div>
            </div>
          )}
          {projectType && (
            <div>
              <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Projektart</div>
              <div style={{ fontSize: 14, color: colors.text }}>{sanitize(projectType)}</div>
            </div>
          )}
          {analysisTimestamp && (
            <div>
              <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Analysezeitpunkt</div>
              <div style={{ fontSize: 14, color: colors.text }}>{analysisTimestamp}</div>
            </div>
          )}
        </div>
      </header>

      {/* 2 Kennzahlen-Row – nur diese 4 KPI-Karten zentriert */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: spacing[3], marginBottom: spacing[4] }}>
        <MetricCard
          center
          title={DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.complexity}
          value={total}
          subtitle="von 100 Punkten"
          variant={total >= 70 ? "danger" : total >= 40 ? "warning" : "success"}
        />
        <MetricCard
          center
          title={DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.totalRisk}
          value={<ScoreBadge value={total} max={100} />}
          variant="neutral"
        />
        <MetricCard
          center
          title={DEFAULT_TEXTS_CONFIG.customerUI.kpiLabels.claimPotential}
          value={claimLevel ? claimLevel.text : "—"}
          variant={claimLevel?.variant ?? "neutral"}
        />
        <MetricCard
          center
          title="Kritische Trigger"
          value={criticalCount}
          subtitle={criticalCount === 1 ? "hoher Befund" : "hohe Befunde"}
          variant={criticalCount > 0 ? "danger" : "success"}
        />
      </div>

      {/* 3 Management Summary – kompakt, managementtauglich */}
      {offerSummary?.executiveSummary && (
        <div style={{ marginBottom: spacing[4] }}>
          <AccentCard title="Management Summary" variant="primary" thick padding="14px 18px">
            <div style={{ fontSize: 14, lineHeight: 1.6, color: colors.text, whiteSpace: "pre-wrap", maxWidth: "72ch" }}>
              {sanitize(offerSummary.executiveSummary)}
            </div>
          </AccentCard>
        </div>
      )}

      {/* 4 Risiko-Kategorien als Karten-Grid */}
      <div style={{ marginBottom: spacing[4] }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: spacing[3] }}>Risiko-Kategorien</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: spacing[4] }}>
          {CATEGORY_ORDER.map((k) => {
            const v = clamp0_100(perCategory[k] ?? 0);
            const accentColor = CATEGORY_COLORS[k];
            return (
              <SectionCard key={k} accent="none" style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}>
                <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600, marginBottom: 4 }}>{catLabel(k)}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: accentColor }}>{v}</div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>von 100</div>
              </SectionCard>
            );
          })}
        </div>
      </div>

      {/* Aktionsbereiche: ruhige Dark-Cards wie KPI/Kategorien, Farbe nur als Akzent (linker Rand + Button) */}
      {(() => {
        const actionCardStyle = (accent: string) => ({
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderLeft: `4px solid ${accent}`,
          borderRadius: radius.lg,
          boxShadow: shadows.md,
          padding: spacing[4],
        });
        const actionTitleStyle = {
          fontSize: 15,
          fontWeight: 700,
          color: colors.text,
          margin: "0 0 " + spacing[2],
        };
        const actionBodyStyle = {
          margin: 0,
          fontSize: 14,
          color: colors.textMuted,
          lineHeight: 1.5,
        };
        const actionButtonStyle = (accent: string) => ({
          marginTop: spacing[3],
          padding: "10px 16px",
          borderRadius: radius.md,
          border: "none" as const,
          background: accent,
          color: "#fff",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer" as const,
        });

        return (
          <>
            {/* 5 Nachtragspotenzial */}
            <div style={{ marginBottom: spacing[4] }}>
              <div style={actionCardStyle(colors.secondary)}>
                <h2 style={actionTitleStyle}>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.nachtragspotenzial}</h2>
                <p style={actionBodyStyle}>
                  Die detaillierte Nachtragsanalyse mit Hebel und Sofortmaßnahmen finden Sie im Tab „{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.nachtragspotenzial}".
                </p>
                {onTabChange && (
                  <button type="button" onClick={() => onTabChange("nachtragspotenzial")} style={actionButtonStyle(colors.secondary)}>
                    Zum Tab {DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.nachtragspotenzial}
                  </button>
                )}
              </div>
            </div>

            {/* 6 Rückfragen */}
            <div style={{ marginBottom: spacing[4] }}>
              <div style={actionCardStyle(colors.primary)}>
                <h2 style={actionTitleStyle}>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.rueckfragen}</h2>
                {clarificationQuestions?.questions && clarificationQuestions.questions.length > 0 ? (
                  <>
                    <p style={{ ...actionBodyStyle, marginBottom: spacing[2] }}>{DEFAULT_TEXTS_CONFIG.explanation.rueckfragen}</p>
                    <p style={{ ...actionBodyStyle, fontSize: 13, marginBottom: 0 }}>{clarificationQuestions.questions.length} Rückfragen vorhanden.</p>
                  </>
                ) : (
                  <p style={actionBodyStyle}>{DEFAULT_TEXTS_CONFIG.rueckfragen.emptyState}</p>
                )}
                {onTabChange && (
                  <button type="button" onClick={() => onTabChange("rueckfragen")} style={actionButtonStyle(colors.primary)}>
                    {DEFAULT_TEXTS_CONFIG.rueckfragen.generateButton}
                  </button>
                )}
              </div>
            </div>

            {/* 7 Angebotsklarstellungen */}
            <div style={{ marginBottom: spacing[4] }}>
              <div style={actionCardStyle(colors.accent)}>
                <h2 style={actionTitleStyle}>{DEFAULT_TEXTS_CONFIG.customerUI.tabLabels.angebotsklarstellungen}</h2>
                {offerAssumptions?.assumptions && offerAssumptions.assumptions.length > 0 ? (
                  <>
                    <p style={{ ...actionBodyStyle, marginBottom: spacing[2] }}>{DEFAULT_TEXTS_CONFIG.explanation.angebotsklarstellungen}</p>
                    <p style={{ ...actionBodyStyle, fontSize: 13, marginBottom: 0 }}>{offerAssumptions.assumptions.length} Annahmen vorhanden.</p>
                  </>
                ) : (
                  <p style={actionBodyStyle}>{DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.emptyState}</p>
                )}
                {onTabChange && (
                  <button type="button" onClick={() => onTabChange("angebotsklarstellungen")} style={actionButtonStyle(colors.accent)}>
                    {DEFAULT_TEXTS_CONFIG.angebotsklarstellungen.generateButton}
                  </button>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* 8 KeyFacts / Detailanalyse – einklappbar */}
      <AccordionSection
        title="KeyFacts / Detailanalyse"
        defaultOpen={false}
        open={keyFactsOpen}
        onToggle={setKeyFactsOpen}
        accentColor={colors.accent}
      >
        {keyFactsProjektdaten.length > 0 ? (
          <InsightList
            items={keyFactsProjektdaten.map(([k, v]) => ({
              label: keyFactLabels[k] ?? k,
              value: sanitize(v).slice(0, 80) + (v.length > 80 ? "…" : ""),
              variant: "neutral",
            }))}
            compact
          />
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>Keine Projektdaten extrahiert.</p>
        )}
      </AccordionSection>
    </PageShell>
  );
}
