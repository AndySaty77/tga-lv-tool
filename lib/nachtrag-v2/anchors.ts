import type { NachtragEvidenceV2, AnchorEventResult } from "./types";

type AnchorDefinition = {
  id: string;
  label: string;
  requires: (evs: NachtragEvidenceV2[]) => boolean;
  impactExposure?: number;
  impactEnforceability?: number;
};

function hasClaimGapType(ev: NachtragEvidenceV2, type: string): boolean {
  return (ev.meta?.claimGapType as string) === type;
}

function w(ev: NachtragEvidenceV2): number {
  return typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
}

// Defensive Defaults: explizite Anchor-Events (Skeletons), Claim-/Gap-Typ berücksichtigt.
const DEFAULT_ANCHORS: AnchorDefinition[] = [
  {
    id: "ANCHOR_PAUSCHALE_BAUSEITS",
    label: "Bauseitige Leistungen / Pauschalen mit Nachtragspotenzial",
    requires: (evs) => {
      const bauseitsWeight = evs
        .filter((e) => hasClaimGapType(e, "bauseits_other_trade"))
        .reduce((s, e) => s + w(e), 0);
      const bauWeight = evs.filter((e) => e.family === "bau").reduce((s, e) => s + w(e), 0);
      const schnittstelleWeight = evs
        .filter((e) => e.family === "schnittstelle" || e.family === "schnittstelle_bau")
        .reduce((s, e) => s + w(e), 0);
      return bauseitsWeight >= 1 || (bauWeight >= 1 && schnittstelleWeight >= 1);
    },
    impactExposure: 7,
    impactEnforceability: 1,
  },
  {
    id: "ANCHOR_MENGEN_MEHRMENGE",
    label: "Offene / unbestimmte Mengen mit Mehrmengenpotenzial",
    requires: (evs) => {
      const mengenWeight = evs
        .filter((e) => e.subscoreTargets.includes("ausfuehrung_mengen") || hasClaimGapType(e, "open_quantity"))
        .reduce((s, e) => s + w(e), 0);
      return mengenWeight >= 2;
    },
    impactExposure: 8,
    impactEnforceability: 3,
  },
  {
    id: "ANCHOR_DOKU_ABNAHME",
    label: "Dokumentations- / Abnahmeanforderungen mit Claim-Hebel",
    requires: (evs) => evs.filter((e) => e.subscoreTargets.includes("doku_ibn")).reduce((s, e) => s + w(e), 0) >= 1,
    impactExposure: 5,
    impactEnforceability: 6,
  },
  {
    id: "ANCHOR_MSR_FREMDGEWERK",
    label: "MSR-Übergabe an Fremdgewerke mit erhöhtem Claim-Risiko",
    requires: (evs) => {
      const msrWeight = evs.filter((e) => e.family === "msr").reduce((s, e) => s + w(e), 0);
      if (msrWeight < 1) return false;
      const zweiteWeight = evs
        .filter(
          (e) =>
            e.family === "schnittstelle" ||
            e.family === "schnittstelle_bau" ||
            e.subscoreTargets.includes("vertrags_abgrenzung")
        )
        .reduce((s, e) => s + w(e), 0);
      return zweiteWeight >= 1;
    },
    impactExposure: 6,
    impactEnforceability: 5,
  },
];

export function evaluateAnchors(evidences: NachtragEvidenceV2[]): AnchorEventResult[] {
  const results: AnchorEventResult[] = [];

  const rawOrigin = "raw_lv_evidence";
  const syntheticClaimOrigin = "synthetic_claim_wrapper";
  const syntheticRiskOrigin = "synthetic_risk_summary";

  function originOf(ev: NachtragEvidenceV2): string {
    return (ev.meta?.evidenceOrigin as string) ?? "unknown_origin";
  }

  function isRelevantForAnchor(anchorId: string, ev: NachtragEvidenceV2): boolean {
    switch (anchorId) {
      case "ANCHOR_PAUSCHALE_BAUSEITS":
        return (
          hasClaimGapType(ev, "bauseits_other_trade") ||
          ev.family === "bau" ||
          ev.family === "schnittstelle" ||
          ev.family === "schnittstelle_bau"
        );
      case "ANCHOR_MENGEN_MEHRMENGE":
        return ev.subscoreTargets.includes("ausfuehrung_mengen") || hasClaimGapType(ev, "open_quantity");
      case "ANCHOR_DOKU_ABNAHME":
        return ev.subscoreTargets.includes("doku_ibn");
      case "ANCHOR_MSR_FREMDGEWERK":
        return (
          ev.family === "msr" ||
          ev.family === "schnittstelle" ||
          ev.family === "schnittstelle_bau" ||
          ev.subscoreTargets.includes("vertrags_abgrenzung")
        );
      default:
        return false;
    }
  }

  function computeMass(anchorId: string) {
    const relevant = evidences.filter((e) => isRelevantForAnchor(anchorId, e));
    let total = 0;
    let raw = 0;
    let synClaim = 0;
    let synRisk = 0;

    for (const ev of relevant) {
      const mw = w(ev);
      total += mw;
      const o = originOf(ev);
      if (o === rawOrigin) raw += mw;
      else if (o === syntheticClaimOrigin) synClaim += mw;
      else if (o === syntheticRiskOrigin) synRisk += mw;
    }

    const rawShare = total > 0 ? raw / total : 0;
    const synShare = total > 0 ? (synClaim + synRisk) / total : 0;
    const synRiskShare = total > 0 ? synRisk / total : 0;
    return {
      relevantCount: relevant.length,
      totalMass: total,
      rawMass: raw,
      syntheticClaimMass: synClaim,
      syntheticRiskMass: synRisk,
      rawShare,
      synShare,
      synRiskShare,
    };
  }

  const minRawMassForFiring = 0.8;
  const minRawShareForFiring = 0.25;
  const minSyntheticClaimMassForFiring = 2.5;

  for (const def of DEFAULT_ANCHORS) {
    const baseFired = def.requires(evidences);
    const masses = computeMass(def.id);

    // Raw-first firing gate: synthetik kann unterstützen, aber nicht "always-on".
    const rawOk = masses.rawMass >= minRawMassForFiring || masses.rawShare >= minRawShareForFiring;
    const syntheticClaimFallbackOk =
      masses.syntheticClaimMass >= minSyntheticClaimMassForFiring && masses.syntheticRiskMass <= masses.syntheticClaimMass * 0.7;

    const fired = baseFired && (rawOk || syntheticClaimFallbackOk);

    // Impact-Scale: maximaler Einfluss bei rawShare=0 stark gedeckelt.
    const targetMassByAnchor: Record<string, number> = {
      ANCHOR_PAUSCHALE_BAUSEITS: 3.0,
      ANCHOR_MENGEN_MEHRMENGE: 3.0,
      ANCHOR_DOKU_ABNAHME: 1.5,
      ANCHOR_MSR_FREMDGEWERK: 3.0,
    };
    const targetMass = targetMassByAnchor[def.id] ?? 2.0;
    const baseScale = targetMass > 0 ? Math.min(1, masses.totalMass / targetMass) : 0;

    // Wenn nur synthetische Evidenz vorhanden ist: deutlich defensiver Deckel.
    const rawBoost = 0.2 + 0.8 * masses.rawShare; // 0.2..1.0
    const synRiskDamp = 1 - 0.35 * masses.synRiskShare; // max -35% wenn alles risk
    const scale = Math.max(0, Math.min(1, baseScale * rawBoost * synRiskDamp));

    const anchorConfidence = Math.max(0, Math.min(1, masses.rawShare * 0.9 + (1 - masses.rawShare) * 0.1));
    const supportMode =
      masses.rawMass > 0 && masses.rawShare >= 0.5
        ? "raw"
        : masses.syntheticClaimMass >= masses.syntheticRiskMass && masses.syntheticClaimMass > 0
          ? masses.rawShare > 0
            ? "mixed"
            : "synthetic_claim_wrapper"
          : masses.syntheticRiskMass > 0
            ? masses.rawShare > 0
              ? "mixed"
              : "synthetic_risk_summary"
            : "none";

    const whyFired = fired
      ? rawOk
        ? `raw-gestützt (rawShare ${(masses.rawShare * 100).toFixed(0)}%)`
        : `synthetic defensiv (synClaim ${masses.syntheticClaimMass.toFixed(2)}; rawShare ${(masses.rawShare * 100).toFixed(0)}%)`
      : baseFired
        ? `suppressed: raw zu niedrig und synClaim nicht genug (rawShare ${(masses.rawShare * 100).toFixed(0)}%)`
        : `suppressed: relevante Mindestmasse nicht erreicht`;

    results.push({
      id: def.id,
      label: def.label,
      fired,
      anchorWeightedMass: masses.totalMass,
      anchorRawWeightedMass: masses.rawMass,
      anchorSyntheticClaimWeightedMass: masses.syntheticClaimMass,
      anchorSyntheticRiskWeightedMass: masses.syntheticRiskMass,
      anchorConfidence,
      anchorSupportMode: supportMode,
      whyFired: fired ? whyFired : undefined,
      whySuppressed: !fired ? whyFired : undefined,
      impactExposure: fired ? (def.impactExposure ?? 0) * scale : 0,
      impactEnforceability: fired ? (def.impactEnforceability ?? 0) * scale : 0,
      reason: fired
        ? "Defensiver Default-Anchor: Kombination mehrerer kritischer Subscores erkannt."
        : "Bedingungen für diesen Anchor wurden nicht erfüllt (defensive Neutralstellung).",
    });
  }

  return results;
}

export function getActiveAnchors(): AnchorDefinition[] {
  return [...DEFAULT_ANCHORS];
}

