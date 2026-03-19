import type { NachtragResultV2, AnchorEventResult } from "./types";

export type NachtragCustomerView = {
  potentialScore: number;
  potentialLabel: "Niedrig" | "Mittel" | "Erhöht" | "Hoch";
  enforceabilityScore: number;
  enforceabilityLabel: "Schwach" | "Begrenzt" | "Solide" | "Stark";
  confidenceLabel: "Niedrig" | "Mittel" | "Hoch";
  confidenceReason: string;
  topDrivers: string[];
  topLevers: Array<{
    title: string;
    fieldType: string;
    mechanism: string;
    leverageLabel: string;
    explanation: string;
  }>;
  immediateActions: string[];
  managementSummary: string;
  recommendedStrategy: {
    title: string;
    rationale: string;
  };
  stats: {
    relevantFieldsCount: number;
    highLeverageCount: number;
    goodEnforceabilityCount: number;
  };
};

export type BuildNachtragCustomerViewInput = {
  v2: NachtragResultV2;
  confidenceOverride?: {
    rawLvCount?: number;
    rawEvidenceShare?: number;
  };
};

function safeNumber(x: unknown, fallback = 0): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const n = typeof x === "string" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function scoreToLabel(score: number): NachtragCustomerView["potentialLabel"] {
  const s = Math.max(0, Math.min(100, score));
  if (s <= 24) return "Niedrig";
  if (s <= 49) return "Mittel";
  if (s <= 74) return "Erhöht";
  return "Hoch";
}

function enforceabilityToLabel(score: number): NachtragCustomerView["enforceabilityLabel"] {
  const s = Math.max(0, Math.min(100, score));
  if (s <= 24) return "Schwach";
  if (s <= 49) return "Begrenzt";
  if (s <= 74) return "Solide";
  return "Stark";
}

function confidenceFromRaw(rawLvCount: number, rawEvidenceShare: number) {
  const rawLv = Math.max(0, rawLvCount);
  const share = Math.max(0, rawEvidenceShare);
  if (rawLv >= 3 || share >= 0.4) {
    return {
      label: "Hoch" as const,
      reason: `Die Einschätzung ist gut belastbar (${rawLv} raw-basierte Evidenzen, Raw-Anteil ${Math.round(share * 100)}%).`,
    };
  }
  if (rawLv >= 1 || share > 0) {
    return {
      label: "Mittel" as const,
      reason: `Die Einschätzung ist teilweise belastbar (${rawLv} raw-basierte Evidenzen, Raw-Anteil ${Math.round(share * 100)}%).`,
    };
  }
  return {
    label: "Niedrig" as const,
    reason: `Die Einschätzung basiert überwiegend auf indirekten Hinweisen (Raw-Anteil ${Math.round(share * 100)}%).`,
  };
}

function truncateTopic(s: string, maxLen: number) {
  const text = String(s ?? "").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

function inferRecommendedStrategy(
  potentialLabel: NachtragCustomerView["potentialLabel"],
  enforceabilityLabel: NachtragCustomerView["enforceabilityLabel"],
  confidenceLabel: NachtragCustomerView["confidenceLabel"],
  potentialScore: number,
  enforceabilityScore: number
): { title: string; rationale: string } {
  if (
    potentialScore >= 55 &&
    enforceabilityScore >= 60 &&
    (confidenceLabel === "Hoch" || confidenceLabel === "Mittel") &&
    (potentialLabel === "Hoch" || potentialLabel === "Erhöht")
  ) {
    return {
      title: "Offensiv ausrichten",
      rationale:
        "Die Konstellation ist tragfähig: Erhöhtes Potenzial trifft auf solide Durchsetzbarkeit. Hebel sollten aktiv verfolgt und mit belastbarer Nachweisführung früh positioniert werden.",
    };
  }

  if (confidenceLabel === "Niedrig" || enforceabilityLabel === "Schwach" || enforceabilityLabel === "Begrenzt") {
    return {
      title: "Defensiv absichern",
      rationale:
        "Zuerst Anspruchs- und Abgrenzungsbasis stabilisieren (Nachweise, Verantwortlichkeiten, Mechanik), bevor Nachtragshebel aktiv verfolgt werden.",
    };
  }

  return {
    title: "Ausgewogen steuern",
    rationale:
      "Potenzial nutzen und parallel die Durchsetzbarkeit absichern. Hebel priorisieren, kritische Punkte früh abstimmen und Nachweise schrittweise konsolidieren.",
  };
}

function deriveTopDrivers(v2: NachtragResultV2): string[] {
  const out: string[] = [];
  if (safeNumber(v2.subscores?.vertrags_abgrenzung, 0) >= 50) out.push("Unklare Leistungsabgrenzungen und Schnittstellen");
  if (safeNumber(v2.subscores?.ausfuehrung_mengen, 0) >= 50) out.push("Offene Mengen und Mehrmengenrisiken");
  if (safeNumber(v2.subscores?.doku_ibn, 0) >= 50) out.push("Dokumentations- und Abnahmepflichten");

  const fired = Array.isArray(v2.anchors) ? v2.anchors.filter((a) => a.fired) : [];
  for (const a of fired) {
    const l = String(a.label ?? "").toLowerCase();
    if (l.includes("bauseit") || l.includes("pausch")) out.push("Pauschalen und bauseitige Leistungen");
    if (l.includes("msr") || l.includes("uebergab") || l.includes("übergab")) out.push("Schnittstellen / Fremdgewerke");
    if (l.includes("mengen")) out.push("Offene Mengen und Mehrmengenrisiken");
    if (l.includes("dokument") || l.includes("abnahme")) out.push("Dokumentations- und Abnahmepflichten");
  }
  const uniq = Array.from(new Set(out)).slice(0, 3);
  return uniq.length ? uniq : ["Schnittstellen / Abgrenzungen", "Mengen- und Leistungsklarheit", "Nachweis- und Dokumentationsbezug"].slice(0, 3);
}

function mapAnchorToLever(anchor: AnchorEventResult & any) {
  const id = String(anchor?.id ?? "");
  const label = String(anchor?.label ?? "");
  const lower = label.toLowerCase();
  const mode = String(anchor?.anchorSupportMode ?? "none");
  const syntheticOnly = mode === "synthetic_claim_wrapper" || mode === "synthetic_risk_summary";
  const explanation = syntheticOnly
    ? "Dieser Hebel basiert überwiegend auf indirekten Hinweisen und sollte mit konkreten LV-Belegen validiert werden."
    : "Dieser Hebel ist grundsätzlich belastbar, wenn Abgrenzung und Nachweisführung sauber dokumentiert werden.";

  if (id.includes("MENGEN") || lower.includes("mengen") || lower.includes("mehr")) {
    return {
      title: "Offene Mengen",
      fieldType: "Mengen / Aufmaß",
      mechanism: "Mehr-/Mindermengenpotenzial",
      leverageLabel: "Offene / unbestimmte Mengen",
      explanation,
    };
  }
  if (id.includes("DOKU") || lower.includes("dokument") || lower.includes("abnahme") || lower.includes("ibn")) {
    return {
      title: "Dokumentation und Abnahme",
      fieldType: "Dokumentation / IBN",
      mechanism: "Nachweis- und Protokollbezug",
      leverageLabel: "Dokumentations- / Abnahmepflichten",
      explanation,
    };
  }
  if (id.includes("PAUSCHALE") || lower.includes("bauseit") || lower.includes("pausch")) {
    return {
      title: "Pauschalen und bauseitige Zuordnung",
      fieldType: "Vertragsabgrenzung",
      mechanism: "Leistungszuweisung / Abgrenzung",
      leverageLabel: "Bauseitige Leistungen / Pauschalen",
      explanation,
    };
  }
  if (id.includes("MSR") || lower.includes("msr") || lower.includes("übergabe") || lower.includes("uebergabe") || lower.includes("fremd")) {
    return {
      title: "Schnittstellen und Übergaben",
      fieldType: "Schnittstellen",
      mechanism: "Übergabepunkte / Verantwortlichkeiten",
      leverageLabel: "Schnittstellen-Übergabe",
      explanation,
    };
  }
  return {
    title: "Relevanter Hebel",
    fieldType: "Nachtragspotenzial",
    mechanism: "Abgrenzung / Nachweise",
    leverageLabel: truncateTopic(label || id || "Hebel", 60) || "Hebel",
    explanation,
  };
}

function buildImmediateActions(v2: NachtragResultV2, enforceabilityLabel: NachtragCustomerView["enforceabilityLabel"]) {
  const fired = Array.isArray(v2.anchors) ? v2.anchors.filter((a) => a.fired) : [];
  const topics = new Set<string>();
  for (const a of fired) {
    const l = String(a.label ?? "").toLowerCase();
    if (l.includes("mengen")) topics.add("mengen");
    if (l.includes("dokument") || l.includes("abnahme") || l.includes("ibn")) topics.add("doku");
    if (l.includes("bauseit") || l.includes("pausch")) topics.add("pauschal");
    if (l.includes("msr") || l.includes("uebergab") || l.includes("übergab") || l.includes("fremd")) topics.add("schnittstelle");
  }

  const mapped: string[] = [];
  if (topics.has("schnittstelle")) mapped.push("Schnittstellen und Übergabepunkte konkretisieren (Verantwortlichkeiten, Leistungsgrenzen, Reihenfolge).");
  if (topics.has("mengen")) mapped.push("Mengenannahmen kalkulatorisch absichern und Mehr-/Mindermengenbezug dokumentieren.");
  if (topics.has("doku")) mapped.push("Dokumentations- und Nachweispflichten präzisieren (Abnahme-/IBN-Protokolle, prüfbare Nachweise).");
  if (topics.has("pauschal")) mapped.push("Pauschal-/Bauseits-Leistungen sauber abgrenzen und die Anspruchsbasis nachvollziehbar belegen.");
  if (mapped.length >= 3) return mapped.slice(0, 3);

  if (enforceabilityLabel === "Schwach" || enforceabilityLabel === "Begrenzt") {
    return [
      "Rückfragen zu unklaren Vorleistungen und Zuständigkeiten vorbereiten.",
      "Mengenannahmen und Leistungsgrenzen vor Angebotsabgabe intern absichern.",
      "Nachweis- und Dokumentationspflichten mit dem Auftraggeber frühzeitig eingrenzen.",
    ];
  }
  return [
    "Wesentliche Hebel priorisieren und mit belastbaren Nachweisen unterlegen.",
    "Schnittstellen und Leistungsabgrenzungen vor Umsetzungsstart verbindlich abstimmen.",
    "Offene Mengen-/Dokumentationsthemen frühzeitig in die Angebotsstrategie integrieren.",
  ];
}

export function buildNachtragCustomerView(input: BuildNachtragCustomerViewInput): NachtragCustomerView {
  const v2 = input.v2;
  const potentialScore = safeNumber(v2.potentialScore, 0);
  const enforceabilityScore = safeNumber(v2.enforceabilityScore, 0);
  const potentialLabel = scoreToLabel(potentialScore);
  const enforceabilityLabel = enforceabilityToLabel(enforceabilityScore);

  const rawLvCountFromV2 = safeNumber((v2.debug as any)?.rawEvidenceCount, 0);
  const rawEvidenceShareFromV2 = safeNumber((v2.debug as any)?.rawEvidenceShare, 0);
  const rawLvCount = safeNumber(input.confidenceOverride?.rawLvCount ?? rawLvCountFromV2, rawLvCountFromV2);
  const rawEvidenceShare = safeNumber(input.confidenceOverride?.rawEvidenceShare ?? rawEvidenceShareFromV2, rawEvidenceShareFromV2);
  const confidence = confidenceFromRaw(rawLvCount, rawEvidenceShare);

  const topDrivers = deriveTopDrivers(v2);
  const topLevers = (Array.isArray(v2.anchors) ? v2.anchors.filter((a) => a.fired) : [])
    .slice()
    .sort((a: any, b: any) => safeNumber(b?.impactEnforceability, 0) - safeNumber(a?.impactEnforceability, 0))
    .slice(0, 3)
    .map((a: any) => mapAnchorToLever(a));

  const immediateActions = buildImmediateActions(v2, enforceabilityLabel);
  const managementSummary = [
    potentialLabel === "Hoch"
      ? "Das Nachtragspotenzial ist deutlich ausgeprägt."
      : potentialLabel === "Erhöht"
        ? "Das Nachtragspotenzial ist erhöht."
        : potentialLabel === "Mittel"
          ? "Das Nachtragspotenzial ist moderat."
          : "Das Nachtragspotenzial ist derzeit eher begrenzt.",
    `Die wichtigsten Treiber liegen in ${topDrivers.slice(0, 2).join(" und ")}.`,
    enforceabilityLabel === "Stark" || enforceabilityLabel === "Solide"
      ? "Die Durchsetzbarkeit wirkt grundsätzlich tragfähig, wenn die Nachweisführung sauber erfolgt."
      : "Die Durchsetzbarkeit ist aktuell begrenzt und sollte zuerst über klare Abgrenzung und Nachweise stabilisiert werden.",
    `Empfohlene nächste Handlung: ${immediateActions[0] ?? "Kritische Punkte priorisieren und belastbar klären."}`,
  ].join(" ");

  const recommendedStrategy = inferRecommendedStrategy(
    potentialLabel,
    enforceabilityLabel,
    confidence.label,
    potentialScore,
    enforceabilityScore
  );

  const evidenceCount = safeNumber((v2.debug as any)?.evidenceCount, 0);
  const firedAnchorsCount = Array.isArray(v2.anchors) ? v2.anchors.filter((a) => a.fired).length : 0;
  const goodEnforceabilityCount = (() => {
    const anchors = Array.isArray(v2.anchors) ? v2.anchors.filter((a) => a.fired) : [];
    const hasConfidenceFields = anchors.some((a: any) => typeof a?.anchorConfidence === "number" || typeof a?.anchorSupportMode === "string");
    if (hasConfidenceFields) {
      return anchors.filter((a: any) => a?.anchorSupportMode === "raw" || (typeof a?.anchorConfidence === "number" && a.anchorConfidence >= 0.6)).length;
    }
    return 0;
  })();

  return {
    potentialScore,
    potentialLabel,
    enforceabilityScore,
    enforceabilityLabel,
    confidenceLabel: confidence.label,
    confidenceReason: confidence.reason,
    topDrivers,
    topLevers,
    immediateActions,
    managementSummary,
    recommendedStrategy,
    stats: {
      relevantFieldsCount: evidenceCount,
      highLeverageCount: firedAnchorsCount,
      goodEnforceabilityCount,
    },
  };
}
