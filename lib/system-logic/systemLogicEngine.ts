/**
 * SystemLogicEngine – führt die Regeln der Systemlogik-Bibliothek aus.
 * Reine Funktionen, keine Side Effects. Bestehende Systemdefinitionen werden nicht verändert.
 * Erkennung defensiv: starke vs. schwache Begriffe, Abkürzungen nur als Verstärker, Querschnitt getrennt.
 */

import { HEATING_SYSTEMS } from "./heatingSystems";
import { SANITARY_SYSTEMS } from "./sanitarySystems";
import { VENTILATION_SYSTEMS } from "./ventilationSystems";
import { ELECTRICAL_SYSTEMS } from "./electricalSystems";
import { MSR_SYSTEMS } from "./msrSystems";
import { CROSS_SYSTEMS } from "./crossSystemRules";
import type { SystemLogicDefinition } from "./types";

// ================= Input / Output =================

export type SystemLogicEngineInput = {
  vortext: string;
  positionsText: string;
  combinedText: string;
};

export type SystemLogicFindingType = "hard-gap" | "missing-required" | "medium-gap";

export type SystemLogicFinding = {
  system: string;
  type: SystemLogicFindingType;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  /** Kurze Begründung für die Einordnung (handlungsorientiert). */
  reasoningShort?: string;
  /** Empfohlene Reaktion. */
  recommendedHandling?: SystemLogicRecommendedHandling;
};

export type SystemLogicDetectionSource = "vortext" | "positions" | "combined";

export type SystemLogicConfidenceLabel = "hoch" | "mittel" | "niedrig";

export type SystemLogicRecommendedHandling =
  | "Rückfrage"
  | "Klarstellung"
  | "Kalkulatorisch beobachten"
  | "Nur Hinweis";

export type SystemLogicDebugDetectionEntry = {
  systemKey: string;
  label: string;
  matchedDetectionTerms: string[];
  matchedStrongTerms: string[];
  matchedWeakTerms: string[];
  matchedAbbreviationTerms: string[];
  detectionSource: SystemLogicDetectionSource;
  detectionHitCount: number;
  detectionReason?: string;
  /** Einordnung: wie belastbar die Erkennung ist. */
  detectionConfidenceLabel?: SystemLogicConfidenceLabel;
  /** Kurzer Satz, warum das System erkannt wurde (für UI). */
  detectionReasonShort?: string;
  /** Empfohlene Reaktion auf die Erkennung. */
  recommendedHandling?: SystemLogicRecommendedHandling;
};

/** Geschäftliche Relevanz / Nachtragspotenzial (additiv). */
export type SystemLogicRelevanceLabel = "niedrig" | "mittel" | "hoch";

/** Konkrete Handlungsart für Kalkulation/Angebot (additiv). */
export type SystemLogicActionType =
  | "rueckfrage"
  | "klarstellung"
  | "kalkulationsaufschlag"
  | "beobachten"
  | "ignorieren";

/** Verdichtete Zusammenfassung pro erkanntem System (Management-/Angebotssicht). */
export type SystemLogicSystemSummary = {
  system: string;
  detectionConfidenceLabel?: SystemLogicConfidenceLabel;
  detectionReasonShort?: string;
  findingCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  topMissingComponents: string[];
  overallAssessmentShort: string;
  recommendedHandling: SystemLogicRecommendedHandling;
  /** Geschäftliche Relevanz (additiv). */
  commercialRelevance?: SystemLogicRelevanceLabel;
  /** Beschaffungsrelevante Kernaussage in einem Satz (additiv). */
  procurementMeaning?: string;
  /** Konkrete Handlungsart (additiv). */
  actionType?: SystemLogicActionType;
  /** Vorschlag für Rückfrage (additiv). */
  suggestedQuestion?: string;
  /** Vorschlag für Angebotsklarstellung (additiv). */
  suggestedOfferNote?: string;
  /** Einschätzung Nachtragspotenzial (additiv). */
  nachtragspotenzialImpact?: SystemLogicRelevanceLabel;
};

export type SystemLogicResult = {
  systemsDetected: string[];
  findings: SystemLogicFinding[];
  querschnittDetected?: string[];
  crossTopicsDetected?: string[];
  debugDetection?: SystemLogicDebugDetectionEntry[];
  /** Verdichtete Zusammenfassung pro erkanntem System (additiv). */
  systemSummaries?: SystemLogicSystemSummary[];
};

// Alle Definitionen aus den Gewerk-Dateien
const ALL_DEFINITIONS: SystemLogicDefinition[] = [
  ...HEATING_SYSTEMS,
  ...SANITARY_SYSTEMS,
  ...VENTILATION_SYSTEMS,
  ...ELECTRICAL_SYSTEMS,
  ...MSR_SYSTEMS,
  ...CROSS_SYSTEMS,
];

// ================= Abkürzungen: nie allein ausreichend =================
const ABBREVIATIONS_LOWER = new Set<string>([
  "uv", "ga", "pas", "pa", "ls", "fi", "rcd", "ev", "led", "msr", "hvac", "kwh",
]);

function isAbbreviation(term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  if (ABBREVIATIONS_LOWER.has(t)) return true;
  if (t.length <= 3 && /^[a-zäöüß0-9]+$/.test(t)) return true;
  return false;
}

// ================= Generische/schwache Begriffe: nur Verstärker =================
const WEAK_GENERIC_TERMS_LOWER = new Set<string>([
  "elektroinstallation", "unterverteilung", "dokumentation", "inbetriebnahme",
  "beleuchtung", "prüfung", "prüfleistung", "messleistung", "messung", "messprotokoll",
  "revisionsunterlagen", "bestandspläne", "einweisungen", "wartungsunterlagen",
  "installationsanlage", "leitungsanlage", "schalterprogramm", "steckdosen",
  "erdung", "potentialausgleich", "generalabnahme", "abnahme",
]);

function isWeakTerm(term: string, ruleWeakTerms: string[] | undefined): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  if (Array.isArray(ruleWeakTerms) && ruleWeakTerms.length > 0) {
    const set = new Set(ruleWeakTerms.map((s) => s.trim().toLowerCase()));
    if (set.has(t)) return true;
  }
  return WEAK_GENERIC_TERMS_LOWER.has(t);
}

/** Klassifizierung: strong = belastbarer Treffer, weak = nur Verstärker, abbreviation = nur Verstärker. */
function classifyTerm(
  term: string,
  ruleWeakTerms: string[] | undefined
): "strong" | "weak" | "abbreviation" {
  if (isAbbreviation(term)) return "abbreviation";
  if (isWeakTerm(term, ruleWeakTerms)) return "weak";
  return "strong";
}

/** Einordnung der Erkennung: 2+ starke Treffer = hoch, 1 stark + Verstärker = mittel, nur 1 stark = niedrig. */
function getConfidenceLabel(
  strongCount: number,
  weakCount: number,
  abbrevCount: number
): SystemLogicConfidenceLabel {
  if (strongCount >= 2) return "hoch";
  if (strongCount === 1 && (weakCount > 0 || abbrevCount > 0)) return "mittel";
  return "niedrig";
}

/** Empfohlene Reaktion aus Confidence. */
function getRecommendedHandlingFromConfidence(
  confidence: SystemLogicConfidenceLabel
): SystemLogicRecommendedHandling {
  if (confidence === "hoch") return "Nur Hinweis";
  if (confidence === "mittel") return "Kalkulatorisch beobachten";
  return "Rückfrage";
}

/** Empfohlene Reaktion aus Severity (für Findings). */
function getRecommendedHandlingFromSeverity(
  severity: "low" | "medium" | "high" | "critical"
): SystemLogicRecommendedHandling {
  if (severity === "high" || severity === "critical") return "Rückfrage";
  if (severity === "medium") return "Klarstellung";
  return "Nur Hinweis";
}

/** Kurzer Satz, warum das System erkannt wurde. */
function getDetectionReasonShort(matchedStrong: string[]): string {
  if (matchedStrong.length === 0) return "Erkennung über Verstärker-Begriffe.";
  if (matchedStrong.length <= 3) {
    return "Erkannt durch: " + matchedStrong.join(", ") + ".";
  }
  return "Erkannt durch belastbare Begriffe: " + matchedStrong.slice(0, 3).join(", ") + ".";
}

// ================= Hilfsfunktionen (pure, null-safe) =================

function normalizeText(s: string | undefined | null): string {
  if (s == null || typeof s !== "string") return "";
  return s.toLowerCase().trim();
}

function getSearchText(input: SystemLogicEngineInput): string {
  const combined = normalizeText(input.combinedText);
  if (combined.length > 0) return combined;
  const vortext = normalizeText(input.vortext);
  const positions = normalizeText(input.positionsText);
  return [vortext, positions].filter(Boolean).join(" ");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchTerm(text: string, term: string): boolean {
  if (!text) return false;
  const t = (term ?? "").trim().toLowerCase();
  if (!t) return false;
  const escaped = escapeRegex(t);
  try {
    const withWordBoundary = new RegExp("\\b" + escaped + "\\b");
    if (withWordBoundary.test(text)) return true;
  } catch {
    // fallback
  }
  return text.includes(t);
}

function getMatchedTerms(text: string, terms: string[]): string[] {
  if (!text || !Array.isArray(terms)) return [];
  const out: string[] = [];
  for (const term of terms) {
    if (typeof term === "string" && term.trim().length > 0 && matchTerm(text, term)) {
      out.push(term.trim());
    }
  }
  return out;
}

function textContainsAny(text: string, terms: string[]): boolean {
  return getMatchedTerms(text, terms).length > 0;
}

/**
 * Effektives minHits: Regelwert nutzen; für Querschnitt/Elektro/MSR/Beleuchtung/Erdung defensiv mind. 2.
 */
function getEffectiveMinHits(def: SystemLogicDefinition): number {
  const meta = def.metadata;
  if (!meta?.detection) return 2;
  const ruleMin = meta.detection.minHits;
  const fromRule = typeof ruleMin === "number" && ruleMin > 0 ? ruleMin : 2;
  if (def.trade === "cross") return Math.max(fromRule, 2);
  const systemKey = (meta.systemKey ?? def.id ?? "").toLowerCase();
  const defensiveKeys = [
    "electrical_general_installation", "electrical_subdistribution", "electrical_lighting",
    "electrical_earthing", "electrical_safety_lighting", "cross_documentation", "cross_testing_commissioning",
  ];
  if (defensiveKeys.some((k) => systemKey.includes(k))) return Math.max(fromRule, 2);
  if (def.trade === "electrical" || def.trade === "msr") return Math.max(fromRule, 2);
  return fromRule;
}

type DetectionOutcome = {
  detected: boolean;
  matchedTerms: string[];
  matchedStrong: string[];
  matchedWeak: string[];
  matchedAbbrev: string[];
  hitCount: number;
  source: SystemLogicDetectionSource;
  reason: string;
};

/**
 * Prüft, ob ein System erkannt wird. Mindestens 1 starker Treffer; Abkürzungen/schwache nur als Verstärker.
 */
function runDetection(
  textVortext: string,
  textPositions: string,
  textCombined: string,
  def: SystemLogicDefinition
): DetectionOutcome {
  const meta = def.metadata;
  const anyOf = meta?.detection?.anyOf;
  const ruleWeakTerms = meta?.detection?.weakTerms;
  if (!Array.isArray(anyOf) || anyOf.length === 0) {
    return {
      detected: false,
      matchedTerms: [],
      matchedStrong: [],
      matchedWeak: [],
      matchedAbbrev: [],
      hitCount: 0,
      source: "combined",
      reason: "keine anyOf-Begriffe",
    };
  }
  const effectiveMinHits = getEffectiveMinHits(def);
  const primaryText = textCombined.length > 0 ? textCombined : (textVortext + " " + textPositions).trim();
  const matchedPrimary = getMatchedTerms(primaryText, anyOf);

  const matchedStrong: string[] = [];
  const matchedWeak: string[] = [];
  const matchedAbbrev: string[] = [];
  for (const term of matchedPrimary) {
    switch (classifyTerm(term, ruleWeakTerms)) {
      case "strong":
        matchedStrong.push(term);
        break;
      case "weak":
        matchedWeak.push(term);
        break;
      case "abbreviation":
        matchedAbbrev.push(term);
        break;
    }
  }
  const strongCount = matchedStrong.length;
  const totalCount = matchedPrimary.length;

  if (strongCount < 1) {
    const reason = totalCount === 0
      ? "keine Treffer"
      : "nur schwache/Abkürzungs-Treffer (mind. 1 starker nötig)";
    return {
      detected: false,
      matchedTerms: matchedPrimary,
      matchedStrong,
      matchedWeak,
      matchedAbbrev,
      hitCount: totalCount,
      source: textCombined.length > 0 ? "combined" : (textPositions.length > 0 ? "positions" : "vortext"),
      reason,
    };
  }
  if (totalCount < effectiveMinHits) {
    return {
      detected: false,
      matchedTerms: matchedPrimary,
      matchedStrong,
      matchedWeak,
      matchedAbbrev,
      hitCount: totalCount,
      source: textCombined.length > 0 ? "combined" : (textPositions.length > 0 ? "positions" : "vortext"),
      reason: `Treffer ${totalCount} < minHits ${effectiveMinHits}`,
    };
  }

  let source: SystemLogicDetectionSource = "combined";
  const matchedCombined = getMatchedTerms(textCombined, anyOf);
  const matchedVortext = getMatchedTerms(textVortext, anyOf);
  const matchedPositions = getMatchedTerms(textPositions, anyOf);
  if (textCombined.length > 0 && matchedCombined.length >= effectiveMinHits) {
    source = "combined";
  } else if (matchedVortext.length >= effectiveMinHits) {
    source = "vortext";
  } else if (matchedPositions.length >= effectiveMinHits) {
    source = "positions";
  } else {
    source = textCombined.length > 0 ? "combined" : (matchedPositions.length > 0 ? "positions" : "vortext");
  }

  const reason = [
    strongCount > 0 && `${strongCount} stark`,
    matchedWeak.length > 0 && `${matchedWeak.length} Verstärker`,
    matchedAbbrev.length > 0 && `${matchedAbbrev.length} Abk.`,
  ].filter(Boolean).join(", ");

  return {
    detected: true,
    matchedTerms: matchedPrimary,
    matchedStrong,
    matchedWeak,
    matchedAbbrev,
    hitCount: totalCount,
    source,
    reason: reason || "erkannt",
  };
}

function getDetectedComponentKeys(text: string, def: SystemLogicDefinition): Set<string> {
  const keys = new Set<string>();
  const meta = def.metadata;
  if (!meta) return keys;
  const components = [
    ...(Array.isArray(meta.requiredComponents) ? meta.requiredComponents : []),
    ...(Array.isArray(meta.optionalComponents) ? meta.optionalComponents : []),
  ];
  for (const comp of components) {
    if (!comp || typeof comp.key !== "string") continue;
    if (Array.isArray(comp.matchAny) && textContainsAny(text, comp.matchAny)) keys.add(comp.key);
  }
  return keys;
}

function getMissingRequiredFindings(
  def: SystemLogicDefinition,
  detectedKeys: Set<string>,
  systemLabel: string
): SystemLogicFinding[] {
  const out: SystemLogicFinding[] = [];
  const meta = def.metadata;
  if (!meta?.requiredComponents?.length) return out;
  for (const comp of meta.requiredComponents) {
    if (!comp || comp.requiredType !== "required") continue;
    if (detectedKeys.has(comp.key)) continue;
    const label = typeof comp.label === "string" ? comp.label : comp.key;
    const severity =
      comp.severity === "critical" || comp.severity === "high" || comp.severity === "medium" || comp.severity === "low"
        ? comp.severity
        : "medium";
    const message = `${systemLabel}: Pflichtbaustein fehlt – ${label}`;
    out.push({
      system: systemLabel,
      type: "missing-required",
      message,
      severity,
      reasoningShort: `Pflichtbaustein „${label}“ fehlt in der Beschreibung.`,
      recommendedHandling: getRecommendedHandlingFromSeverity(severity),
    });
  }
  return out;
}

function getLogicRuleFindings(
  def: SystemLogicDefinition,
  detectedKeys: Set<string>,
  systemLabel: string
): SystemLogicFinding[] {
  const out: SystemLogicFinding[] = [];
  const meta = def.metadata;
  if (!meta?.logicRules?.length) return out;
  for (const rule of meta.logicRules) {
    if (!rule?.condition) continue;
    const cond = rule.condition;
    const detectedAny = Array.isArray(cond.detectedAny) ? cond.detectedAny : [];
    const missingAny = Array.isArray(cond.missingAny) ? cond.missingAny : [];
    const allDetectedPresent = detectedAny.length === 0 || detectedAny.every((k) => detectedKeys.has(k));
    const atLeastOneMissing = missingAny.length > 0 && missingAny.some((k) => !detectedKeys.has(k));
    if (!allDetectedPresent || !atLeastOneMissing) continue;
    const severity =
      rule.severity === "critical" || rule.severity === "high" || rule.severity === "medium" || rule.severity === "low"
        ? rule.severity
        : "medium";
    const type: SystemLogicFindingType =
      severity === "high" || severity === "critical" ? "hard-gap" : "medium-gap";
    const title = typeof rule.title === "string" ? rule.title : rule.key;
    out.push({
      system: systemLabel,
      type,
      message: title,
      severity,
      reasoningShort: title,
      recommendedHandling: getRecommendedHandlingFromSeverity(severity),
    });
  }
  return out;
}

function deduplicateFindings(findings: SystemLogicFinding[]): SystemLogicFinding[] {
  if (!Array.isArray(findings) || findings.length === 0) return [];
  const seen = new Set<string>();
  const out: SystemLogicFinding[] = [];
  for (const f of findings) {
    if (!f || typeof f.system !== "string" || typeof f.message !== "string") continue;
    const key = `${f.system}\n${f.type ?? ""}\n${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

const PFLICHTBAUSTEIN_PREFIX = "Pflichtbaustein fehlt – ";

/** Extrahiert Komponentenlabel aus Message "System: Pflichtbaustein fehlt – XYZ". */
function extractMissingComponentLabel(message: string): string | null {
  if (!message || typeof message !== "string") return null;
  const idx = message.indexOf(PFLICHTBAUSTEIN_PREFIX);
  if (idx === -1) return null;
  return message.slice(idx + PFLICHTBAUSTEIN_PREFIX.length).trim();
}

/** Leitet geschäftliche Relevanz und Nachtragspotenzial aus Erkennung + Findings ab. */
function deriveCommercialRelevance(
  confidence: SystemLogicConfidenceLabel,
  findingCount: number,
  highSeverityCount: number,
  mediumSeverityCount: number
): SystemLogicRelevanceLabel {
  if (highSeverityCount > 0) return "hoch";
  if (mediumSeverityCount >= 2 || (findingCount >= 3 && mediumSeverityCount > 0)) return "mittel";
  if (mediumSeverityCount > 0 || findingCount >= 1) return "mittel";
  if (confidence === "niedrig" && findingCount === 0) return "niedrig";
  if (confidence === "hoch" && findingCount === 0) return "niedrig";
  return "mittel";
}

/** Leitet konkrete Handlungsart ab (nicht nur Severity). */
function deriveActionType(
  confidence: SystemLogicConfidenceLabel,
  findingCount: number,
  highSeverityCount: number,
  mediumSeverityCount: number,
  missingCount: number,
  recommendedHandling: SystemLogicRecommendedHandling
): SystemLogicActionType {
  if (confidence === "niedrig" && findingCount <= 1 && highSeverityCount === 0) return "ignorieren";
  if (confidence === "niedrig" && mediumSeverityCount <= 1) return "beobachten";
  if (highSeverityCount > 0 && missingCount > 0) return "rueckfrage";
  if (highSeverityCount > 0) return "klarstellung";
  if (mediumSeverityCount >= 2 || findingCount >= 3) return "klarstellung";
  if (mediumSeverityCount >= 1 && confidence === "mittel") return "kalkulationsaufschlag";
  if (recommendedHandling === "Rückfrage") return "rueckfrage";
  if (recommendedHandling === "Klarstellung") return "klarstellung";
  if (recommendedHandling === "Kalkulatorisch beobachten") return "beobachten";
  return "beobachten";
}

/** Kernaussage in einem Satz (beschaffungs-/angebotsrelevant). */
function buildProcurementMeaning(
  systemLabel: string,
  overallAssessmentShort: string,
  commercialRelevance: SystemLogicRelevanceLabel,
  topMissingComponents: string[]
): string {
  if (topMissingComponents.length > 0) {
    const list = topMissingComponents.slice(0, 3).join(", ");
    if (commercialRelevance === "hoch") {
      return `${systemLabel}: Fehlende bzw. unklare Bausteine (z. B. ${list}) – kalkulatorisch und in der Angebotsklarstellung berücksichtigen.`;
    }
    if (commercialRelevance === "mittel") {
      return `${systemLabel}: ${overallAssessmentShort} Angebotsklarstellung empfohlen.`;
    }
  }
  if (commercialRelevance === "niedrig") {
    return `${systemLabel}: Keine wesentlichen Lücken – nur zur Kenntnis.`;
  }
  return `${systemLabel}: ${overallAssessmentShort}`;
}

/** Vorschlag für Rückfrage. */
function buildSuggestedQuestion(topMissingComponents: string[], systemLabel: string): string {
  if (!topMissingComponents.length) return "";
  const list = topMissingComponents.slice(0, 3).join(", ");
  return `Sind folgende Leistungen im LV/Umfang enthalten: ${list}?`;
}

/** Vorschlag für Angebotsklarstellung. */
function buildSuggestedOfferNote(topMissingComponents: string[], systemLabel: string): string {
  if (!topMissingComponents.length) return "";
  const list = topMissingComponents.slice(0, 3).join(", ");
  return `Angebot unter Vorbehalt der Klärung: ${list}.`;
}

/** Baut verdichtete SystemSummaries aus debugDetection und findings. */
function buildSystemSummaries(
  debugDetection: SystemLogicDebugDetectionEntry[],
  findings: SystemLogicFinding[]
): SystemLogicSystemSummary[] {
  if (!Array.isArray(debugDetection) || debugDetection.length === 0) return [];
  const summaries: SystemLogicSystemSummary[] = [];
  for (const entry of debugDetection) {
    const systemLabel = entry.label ?? "";
    if (!systemLabel) continue;
    const systemFindings = findings.filter((f) => (f?.system ?? "") === systemLabel);
    const findingCount = systemFindings.length;
    const highSeverityCount = systemFindings.filter(
      (f) => f.severity === "high" || f.severity === "critical"
    ).length;
    const mediumSeverityCount = systemFindings.filter((f) => f.severity === "medium").length;
    const missingComponents: string[] = [];
    for (const f of systemFindings) {
      if (f.type === "missing-required") {
        const label = extractMissingComponentLabel(f.message ?? "");
        if (label && !missingComponents.includes(label)) missingComponents.push(label);
      }
    }
    const topMissingComponents = missingComponents.slice(0, 5);
    let overallAssessmentShort: string;
    if (findingCount === 0) {
      overallAssessmentShort = "Keine Lücken erkannt.";
    } else if (highSeverityCount > 0 && mediumSeverityCount > 0) {
      overallAssessmentShort = `${highSeverityCount} kritische Lücke(n), ${mediumSeverityCount} weitere.`;
    } else if (highSeverityCount > 0) {
      overallAssessmentShort = `${highSeverityCount} kritische Lücke(n).`;
    } else if (mediumSeverityCount > 0) {
      overallAssessmentShort = `${mediumSeverityCount} Lücke(n) (mittlere Schwere).`;
    } else {
      overallAssessmentShort = `${findingCount} Lücke(n) (niedrige Schwere).`;
    }
    const recommendedHandling =
      highSeverityCount > 0
        ? "Rückfrage"
        : mediumSeverityCount > 0
          ? "Klarstellung"
          : (entry.recommendedHandling ?? "Nur Hinweis");
    const confidence = entry.detectionConfidenceLabel ?? "mittel";
    const commercialRelevance = deriveCommercialRelevance(
      confidence,
      findingCount,
      highSeverityCount,
      mediumSeverityCount
    );
    const nachtragspotenzialImpact = commercialRelevance;
    const actionType = deriveActionType(
      confidence,
      findingCount,
      highSeverityCount,
      mediumSeverityCount,
      topMissingComponents.length,
      recommendedHandling
    );
    const procurementMeaning = buildProcurementMeaning(
      systemLabel,
      overallAssessmentShort,
      commercialRelevance,
      topMissingComponents
    );
    const suggestedQuestion =
      (actionType === "rueckfrage" || actionType === "klarstellung") && topMissingComponents.length > 0
        ? buildSuggestedQuestion(topMissingComponents, systemLabel)
        : undefined;
    const suggestedOfferNote =
      (actionType === "klarstellung" || actionType === "kalkulationsaufschlag") && topMissingComponents.length > 0
        ? buildSuggestedOfferNote(topMissingComponents, systemLabel)
        : undefined;
    summaries.push({
      system: systemLabel,
      detectionConfidenceLabel: entry.detectionConfidenceLabel,
      detectionReasonShort: entry.detectionReasonShort,
      findingCount,
      highSeverityCount,
      mediumSeverityCount,
      topMissingComponents,
      overallAssessmentShort,
      recommendedHandling,
      commercialRelevance,
      procurementMeaning,
      actionType,
      suggestedQuestion,
      suggestedOfferNote,
      nachtragspotenzialImpact,
    });
  }
  return summaries;
}

// ================= Hauptfunktion =================

export function runSystemLogicEngine(input: SystemLogicEngineInput): SystemLogicResult {
  const systemsDetected: string[] = [];
  const querschnittDetected: string[] = [];
  const findings: SystemLogicFinding[] = [];
  const debugDetection: SystemLogicDebugDetectionEntry[] = [];

  if (!input || typeof input !== "object") {
    return { systemsDetected, findings };
  }

  const textVortext = normalizeText(input.vortext);
  const textPositions = normalizeText(input.positionsText);
  const textCombined = normalizeText(input.combinedText);
  const primaryText = textCombined.length > 0 ? textCombined : (textVortext + " " + textPositions).trim();

  if (primaryText.length === 0) {
    return { systemsDetected, findings };
  }

  const definitions = Array.isArray(ALL_DEFINITIONS) ? ALL_DEFINITIONS : [];
  for (const def of definitions) {
    if (!def?.metadata) continue;
    const systemLabel = (def.metadata.label || def.name || def.id || "").trim() || "System";
    const systemKey = def.metadata.systemKey ?? def.id ?? "";

    const outcome = runDetection(textVortext, textPositions, textCombined, def);
    if (!outcome.detected) continue;

    if (def.trade === "cross") {
      querschnittDetected.push(systemLabel);
    } else {
      systemsDetected.push(systemLabel);
    }

    const confidence = getConfidenceLabel(
      outcome.matchedStrong.length,
      outcome.matchedWeak.length,
      outcome.matchedAbbrev.length
    );
    debugDetection.push({
      systemKey,
      label: systemLabel,
      matchedDetectionTerms: outcome.matchedTerms,
      matchedStrongTerms: outcome.matchedStrong,
      matchedWeakTerms: outcome.matchedWeak,
      matchedAbbreviationTerms: outcome.matchedAbbrev,
      detectionSource: outcome.source,
      detectionHitCount: outcome.hitCount,
      detectionReason: outcome.reason,
      detectionConfidenceLabel: confidence,
      detectionReasonShort: getDetectionReasonShort(outcome.matchedStrong),
      recommendedHandling: getRecommendedHandlingFromConfidence(confidence),
    });

    const detectedKeys = getDetectedComponentKeys(primaryText, def);
    findings.push(...getMissingRequiredFindings(def, detectedKeys, systemLabel));
    findings.push(...getLogicRuleFindings(def, detectedKeys, systemLabel));
  }

  const querschnitt = querschnittDetected.length > 0 ? [...new Set(querschnittDetected)] : undefined;
  const dedupedFindings = deduplicateFindings(findings);
  const systemSummaries = buildSystemSummaries(debugDetection, dedupedFindings);
  return {
    systemsDetected: [...new Set(systemsDetected)],
    findings: dedupedFindings,
    querschnittDetected: querschnitt,
    crossTopicsDetected: querschnitt,
    debugDetection: debugDetection.length > 0 ? debugDetection : undefined,
    systemSummaries: systemSummaries.length > 0 ? systemSummaries : undefined,
  };
}
