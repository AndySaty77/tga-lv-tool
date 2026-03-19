import type { NachtragEvidenceV2 } from "./types";
import {
  detectEnforceabilityQualifiers,
  type PositiveQualifierKey,
  type NegativeQualifierKey,
} from "./enforceabilityQualifiers";

export type EnforceabilitySignal = {
  evidenceId: string;
  family: string;
  matchedQualifiers: Array<PositiveQualifierKey | NegativeQualifierKey>;
  weight: number;
  reason: string;
};

export type EnforceabilityAnalysis = {
  rawScore: number;
  normalizedScore: number;
  positiveSignals: EnforceabilitySignal[];
  negativeSignals: EnforceabilitySignal[];
  unresolvedClaimTopics: Array<{ evidenceId: string; family: string; reason: string }>;
  enforceabilityRawBeforeNormalize: number;
  enforceabilityRawAfterNormalize: number;
  positiveContributionSum: number;
  negativeContributionSum: number;
  strongestPositiveDriver?: EnforceabilitySignal;
  strongestNegativeBlocker?: EnforceabilitySignal;
  rawBaseScore: number;
  rawPositiveScore: number;
  rawNegativeScore: number;
  scoreBeforeNormalize: number;
  scoreAfterNormalize: number;
  scoreAfterFloorClamp: number;
  floorApplied: boolean;
  floorValue: number;
  normalizeClampApplied: boolean;
  normalizeClampRange: [number, number];
  normalizeRoundedFrom: number;
  markerContributions: {
    unresolvedClaimTopic: number;
    allInclusiveLanguage: number;
    vagueBoundary: number;
    explicitAssignment: number;
    rawBackedAnchorSupport: number;
    familyConfidenceEvidenceQuality: number;
  };
  positiveEnforceabilityDebug: {
    detectedPositiveQualifiers: Partial<Record<PositiveQualifierKey, number>>;
    detectedNegativeQualifiers: Partial<Record<NegativeQualifierKey, number>>;
    requiredPositiveQualifiers: PositiveQualifierKey[];
    allowPositive: { allowPositiveTrue: number; allowPositiveFalse: number };
    countPositiveCandidates: number;
    countNegativeCandidates: number;
    acceptedPositiveQualifiers: Partial<Record<PositiveQualifierKey, number>>;
    partiallyAcceptedPositiveQualifiers: Partial<Record<PositiveQualifierKey, number>>;
    rejectedPositiveQualifiers: Partial<Record<PositiveQualifierKey, Partial<Record<string, number>>>>;
    familyAgnosticQualityGateCounts: {
      raw_present: number;
      raw_share: number;
      quality: number;
      fail: number;
    };
    lastFamilyAgnosticQualityGateReason: "raw_present" | "raw_share" | "quality" | "fail";
    lastFamilyAgnosticQualityGatePass: boolean;
    hasRawSupport: boolean;
    rawLvCount: number;
    rawEvidenceShare: number;
  };
};

const POSITIVE_FAMILY_WEIGHTS: Record<string, number> = {
  schnittstelle: 3,
  schnittstelle_bau: 4,
  heizung: 2,
  lueftung: 2,
  sanitaer: 2,
  elektro: 2,
  msr: 4,
  bau: 3,
};

const NEGATIVE_FAMILY_WEIGHTS: Record<string, number> = {};

const REQUIRED_POS_QUALIFIERS_BY_FAMILY: Record<string, PositiveQualifierKey[]> = {
  schnittstelle: ["clearBoundary", "handoverPointPresent"],
  schnittstelle_bau: ["explicitAssignment", "clearBoundary", "handoverPointPresent"],
  heizung: ["clearBoundary", "handoverPointPresent"],
  lueftung: ["clearBoundary", "handoverPointPresent"],
  sanitaer: ["clearBoundary", "handoverPointPresent"],
  elektro: ["clearBoundary", "handoverPointPresent"],
  msr: ["explicitAssignment", "clearBoundary", "handoverPointPresent"],
  bau: ["explicitAssignment", "clearBoundary"],
};

function hasAny<T extends string>(have: T[], required: T[]): boolean {
  for (const r of required) {
    if (have.includes(r)) return true;
  }
  return false;
}

function normalizeEnforceability(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const eased = Math.log10(1 + raw);
  // Leicht entschärft: weak/synthetic bleibt klar niedrig,
  // mixed/raw fällt aber weniger hart in den unteren Bereich.
  return Math.max(0, Math.min(100, Math.round(eased * 50)));
}

export function analyzeEnforceability(evidences: NachtragEvidenceV2[]): EnforceabilityAnalysis {
  const positiveSignals: EnforceabilitySignal[] = [];
  const negativeSignals: EnforceabilitySignal[] = [];
  const unresolvedClaimTopics: Array<{ evidenceId: string; family: string; reason: string }> = [];

  const originByEvidenceId = new Map<string, string>();

  // Für family-agnostische Positivsignale: harte Qualitätsvoraussetzung,
  // damit synthetic-only weiterhin praktisch keine positive Wirkung entfaltet.
  const includedEvidences = evidences.filter(
    (ev) => typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) && (ev.rawWeight ?? 0) > 0
  );
  const includedCount = includedEvidences.length;
  const rawLvIncludedCount = includedEvidences.filter((ev) => (ev.meta?.evidenceOrigin as string) === "raw_lv_evidence").length;
  const rawLvWeightSum = includedEvidences
    .filter((ev) => (ev.meta?.evidenceOrigin as string) === "raw_lv_evidence")
    .reduce((s, ev) => {
      const w = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
      return s + w;
    }, 0);
  const allWeightSum = includedEvidences.reduce((s, ev) => {
    const w = typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
    return s + w;
  }, 0);
  const rawEvidenceShare = allWeightSum > 0 ? rawLvWeightSum / allWeightSum : 0;
  const hasAnyRawLvEvidence = rawLvWeightSum > 0;
  const RAW_SHARE_MIN_FOR_AGNOSTIC = 0.12;
  const EVIDENCE_QUALITY_MIN_FOR_AGNOSTIC = 0.5;
  const FAMILY_AGNOSTIC_POS_KEYS: Set<PositiveQualifierKey> = new Set<PositiveQualifierKey>([
    "explicitAssignment",
    "clearBoundary",
    "testAcceptanceLinkPresent",
  ]);
  const FAMILY_AGNOSTIC_PARTIAL_CREDIT = 0.45;

  const detectedPositiveQualifiers: Partial<Record<PositiveQualifierKey, number>> = {};
  const detectedNegativeQualifiers: Partial<Record<NegativeQualifierKey, number>> = {};
  const requiredPositiveQualifiersSet = new Set<PositiveQualifierKey>();
  const allowPositiveCounts = { allowPositiveTrue: 0, allowPositiveFalse: 0 };
  let countPositiveCandidates = 0;
  let countNegativeCandidates = 0;
  const rejectedPositiveQualifiers: Partial<Record<PositiveQualifierKey, Partial<Record<string, number>>>> = {};
  const acceptedPositiveQualifiers: Partial<Record<PositiveQualifierKey, number>> = {};
  const partiallyAcceptedPositiveQualifiers: Partial<Record<PositiveQualifierKey, number>> = {};
  const familyAgnosticQualityGateCounts = {
    raw_present: 0,
    raw_share: 0,
    quality: 0,
    fail: 0,
  };
  let lastFamilyAgnosticQualityGateReason: "raw_present" | "raw_share" | "quality" | "fail" = "fail";
  let lastFamilyAgnosticQualityGatePass = false;

  function bumpRejected(qual: PositiveQualifierKey, reason: string, count = 1) {
    if (!rejectedPositiveQualifiers[qual]) rejectedPositiveQualifiers[qual] = {};
    rejectedPositiveQualifiers[qual]![reason] = (rejectedPositiveQualifiers[qual]![reason] ?? 0) + count;
  }

  for (const ev of evidences) {
    const baseWeight =
      typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
    const fam = ev.family;
    const q = detectEnforceabilityQualifiers(ev);

    const posQ = q.positive;
    const negQ = q.negative;
    const origin = (ev.meta?.evidenceOrigin as string) ?? "unknown_origin";
    // Gate-Logik: wenn keine evidenceQualityFactor vorhanden ist, gilt die Qualität als 0 (defensiv).
    const evidenceQuality = typeof ev.meta?.evidenceQualityFactor === "number" ? (ev.meta?.evidenceQualityFactor as number) : 0;
    originByEvidenceId.set(ev.id, origin);

    // Debug candidates (unabhängig vom späteren Weight-Gate)
    countPositiveCandidates += posQ.length;
    countNegativeCandidates += negQ.length;
    for (const k of posQ) detectedPositiveQualifiers[k] = (detectedPositiveQualifiers[k] ?? 0) + 1;
    for (const k of negQ) detectedNegativeQualifiers[k] = (detectedNegativeQualifiers[k] ?? 0) + 1;

    // Claim-Blocker sollen nicht implizit nur über Family laufen: immer qualifierbasiert (allInclusive/pauschal/etc.)
    const hasNegativeQualifiers = negQ.length > 0;

    // Weight Gate (nur Debuggründe)
    if (baseWeight <= 0) {
      for (const k of posQ) bumpRejected(k, "weight_too_low");
      continue;
    }

    // Positive Enforceability-Gate:
    // A) family-gebunden: braucht requiredPos + Family-Match (streng)
    // B) family-agnostisch: erlaubt begrenzt Positivsignale (nur bei Mindest-Qualität)
    const requiredPos = REQUIRED_POS_QUALIFIERS_BY_FAMILY[fam] ?? [];
    for (const r of requiredPos) requiredPositiveQualifiersSet.add(r);
    const familyMatch = requiredPos.length > 0 ? hasAny(posQ, requiredPos) : false;
    const familyBoundAccept = POSITIVE_FAMILY_WEIGHTS[fam] != null && familyMatch;

    const anyAgnosticPresent = posQ.some((k) => FAMILY_AGNOSTIC_POS_KEYS.has(k));
    const hasRawSupport = hasAnyRawLvEvidence || rawEvidenceShare > 0;
    // Strict rule für synthetic-only: ohne echtes Raw-Support darf kein agnostic Positivcredit entstehen.
    let qualityGateReason: "raw_present" | "raw_share" | "quality" | "fail" = "fail";
    if (hasRawSupport) {
      qualityGateReason = hasAnyRawLvEvidence ? "raw_present" : "raw_share";
    }
    const qualityOkForAgnostic = hasRawSupport && evidenceQuality >= EVIDENCE_QUALITY_MIN_FOR_AGNOSTIC;
    const finalQualityGateReason: typeof qualityGateReason | "fail" = qualityOkForAgnostic ? "quality" : qualityGateReason;
    const familyAgnosticAccept = anyAgnosticPresent && qualityOkForAgnostic;
    familyAgnosticQualityGateCounts[finalQualityGateReason] += 1;

    const allowPositive = familyBoundAccept || familyAgnosticAccept;
    if (allowPositive) allowPositiveCounts.allowPositiveTrue += 1;
    else allowPositiveCounts.allowPositiveFalse += 1;

    const acceptMode: "fully_accepted" | "partially_accepted" | "rejected" = familyBoundAccept
      ? "fully_accepted"
      : familyAgnosticAccept
        ? "partially_accepted"
        : "rejected";
    if (acceptMode === "partially_accepted") {
      lastFamilyAgnosticQualityGateReason = qualityGateReason;
      lastFamilyAgnosticQualityGatePass = qualityOkForAgnostic;
    }

    const rejectReason =
      acceptMode === "rejected"
        ? fam === "unknown"
          ? "unknown_family_penalty"
          : !familyMatch
            ? "no_required_match"
            : negQ.includes("unresolvedClaimTopic")
              ? "unresolved_penalty"
              : anyAgnosticPresent && !qualityOkForAgnostic
                ? "origin_damped"
                : "rejected"
        : undefined;

    // Debug: accept/reject Semantik getrennt führen.
    for (const k of posQ) {
      if (acceptMode === "fully_accepted") {
        acceptedPositiveQualifiers[k] = (acceptedPositiveQualifiers[k] ?? 0) + 1;
      } else if (acceptMode === "partially_accepted") {
        partiallyAcceptedPositiveQualifiers[k] = (partiallyAcceptedPositiveQualifiers[k] ?? 0) + 1;
      } else {
        bumpRejected(k, rejectReason ?? "rejected");
      }
    }

    // Unresolved Claim Topic: Thema vorhanden, aber keine Freischaltung für positiven Hebel.
    if (!allowPositive && negQ.includes("unresolvedClaimTopic")) {
      unresolvedClaimTopics.push({
        evidenceId: ev.id,
        family: fam,
        reason: "Claim-Thema vorhanden, aber keine klare Zuweisung/Grenze/Mechanik erkannt.",
      });
    }

    if (familyBoundAccept) {
      // A) family-gebunden: streng nach requiredPos + Family-Match.
      const qualityBoost = 1 + Math.min(0.35, Math.max(0, posQ.length - 1) * 0.12);
      const negDamp = hasNegativeQualifiers
        ? posQ.includes("explicitAssignment") || posQ.includes("clearBoundary")
          ? 0.85
          : 0.75
        : 1.0;

      let originDamp = 1;
      if (fam === "unknown") originDamp *= 0.75;
      if (origin === "raw_lv_evidence") originDamp *= 1.08;
      if (origin === "synthetic_claim_wrapper") originDamp *= 0.85;
      if (origin === "synthetic_risk_summary") originDamp *= 0.75;
      if (origin === "derived_anchor_hint") originDamp *= 0.7;
      if (origin === "unknown_origin") originDamp *= 0.65;
      if (negQ.includes("unresolvedClaimTopic")) originDamp *= 0.85;

      const qualityDamp = Math.max(0.65, Math.min(1.0, Math.pow(evidenceQuality, 0.25)));

      const strongPositiveBoost =
        1 +
        (posQ.includes("explicitAssignment") ? 0.18 : 0) +
        (posQ.includes("clearBoundary") ? 0.12 : 0) +
        (posQ.includes("billingMechanismPresent") ? 0.06 : 0);

      const w =
        POSITIVE_FAMILY_WEIGHTS[fam] *
        baseWeight *
        qualityBoost *
        negDamp *
        originDamp *
        qualityDamp *
        strongPositiveBoost;

      positiveSignals.push({
        evidenceId: ev.id,
        family: fam,
        matchedQualifiers: [...posQ],
        weight: w,
        reason: `Positiver Claim-Hebel: ${fam} (freigeschaltet durch ${posQ.join(", ")})`,
      });
    } else if (familyAgnosticAccept) {
      // B) family-agnostisch: begrenzter Positivcredit nur mit Mindest-Qualität.
      const posQUsed = posQ.filter((k) => FAMILY_AGNOSTIC_POS_KEYS.has(k));
      if (posQUsed.length > 0) {
        const qualityBoost = 1 + Math.min(0.30, Math.max(0, posQUsed.length - 1) * 0.10);
        const negDamp = hasNegativeQualifiers
          ? posQUsed.includes("explicitAssignment") || posQUsed.includes("clearBoundary")
            ? 0.9
            : 0.8
          : 1.0;

        let originDamp = 1;
        if (fam === "unknown") originDamp *= 0.75;
        if (origin === "raw_lv_evidence") originDamp *= 1.08;
        if (origin === "synthetic_claim_wrapper") originDamp *= 0.85;
        if (origin === "synthetic_risk_summary") originDamp *= 0.75;
        if (origin === "derived_anchor_hint") originDamp *= 0.7;
        if (origin === "unknown_origin") originDamp *= 0.65;
        if (negQ.includes("unresolvedClaimTopic")) originDamp *= 0.85;

        const qualityDamp = Math.max(0.65, Math.min(1.0, Math.pow(evidenceQuality, 0.25)));

        const strongPositiveBoost =
          1 +
          (posQUsed.includes("explicitAssignment") ? 0.12 : 0) +
          (posQUsed.includes("clearBoundary") ? 0.08 : 0) +
          (posQUsed.includes("testAcceptanceLinkPresent") ? 0.05 : 0);

        const famWeightForAgnostic = POSITIVE_FAMILY_WEIGHTS[fam] ?? 2;
        const w =
          famWeightForAgnostic *
          baseWeight *
          qualityBoost *
          negDamp *
          originDamp *
          qualityDamp *
          strongPositiveBoost *
          FAMILY_AGNOSTIC_PARTIAL_CREDIT;

        positiveSignals.push({
          evidenceId: ev.id,
          family: fam,
          matchedQualifiers: [...posQUsed],
          weight: w,
          reason: `Agnostic Positivcredit (${famWeightForAgnostic}): ${posQUsed.join(", ")}`,
        });
      }
    }

    // Negative: qualifiergetrieben (und bei expliziten Blocker-Familien verstärkt).
    if (hasNegativeQualifiers) {
      const baseNeg = 2.2; // Qualifier-Basis, damit Blocker nicht "nur implizit" bleiben
      const familyBoost = NEGATIVE_FAMILY_WEIGHTS[fam] != null ? NEGATIVE_FAMILY_WEIGHTS[fam] : 0;
      const qualBoost = 1 + Math.min(0.35, Math.max(0, negQ.length - 1) * 0.15);
      // Deutlichere Negativbehandlung bei schwacher Beleglage und "claim-topic ohne Mechanik".
      let negBoost = 1;
      if (fam === "unknown") negBoost *= 1.1;
      if (origin === "synthetic_claim_wrapper") negBoost *= 1.05;
      if (origin === "synthetic_risk_summary") negBoost *= 1.1;
      if (origin === "derived_anchor_hint" || origin === "unknown_origin") negBoost *= 1.15;
      if (negQ.includes("allInclusiveLanguage")) negBoost *= 1.1;
      if (negQ.includes("unresolvedClaimTopic")) negBoost *= 1.15;
      if (negQ.includes("vagueBoundary")) negBoost *= 1.05;
      // Auch hier: leichte Qualitäts-Spreizung.
      const qualityNeg = Math.max(0.7, Math.min(1.0, Math.pow(evidenceQuality, 0.18)));

      const w = (baseNeg + familyBoost) * baseWeight * qualBoost * negBoost * qualityNeg;
      negativeSignals.push({
        evidenceId: ev.id,
        family: fam,
        matchedQualifiers: [...negQ],
        weight: w,
        reason: `Claim-Blocker: ${fam} (Marker: ${negQ.join(", ")})`,
      });
    }
  }

  const positiveSum = positiveSignals.reduce((s, sig) => s + sig.weight, 0);
  const negativeSum = negativeSignals.reduce((s, sig) => s + sig.weight, 0);

  const rawBeforeFloor = positiveSum - negativeSum;
  const floorApplied = rawBeforeFloor <= 0;
  const floorValue = 0;
  const rawScore = Math.max(0, rawBeforeFloor);

  const normalizedScore = normalizeEnforceability(rawScore);

  const normalizeClampRange: [number, number] = [0, 100];
  let normalizeRoundedFrom = 0;
  let normalizeClampApplied = false;
  if (rawScore <= 0) {
    normalizeRoundedFrom = 0;
    normalizeClampApplied = false;
  } else {
    const eased = Math.log10(1 + rawScore);
    normalizeRoundedFrom = Math.round(eased * 50);
    normalizeClampApplied = normalizeRoundedFrom < normalizeClampRange[0] || normalizeRoundedFrom > normalizeClampRange[1];
  }

  const scoreBeforeNormalize = rawScore;
  const scoreAfterNormalize = normalizedScore;
  const scoreAfterFloorClamp = rawScore;

  const strongestPositiveDriver =
    positiveSignals.length > 0
      ? positiveSignals.reduce((best, cur) => (cur.weight > best.weight ? cur : best))
      : undefined;
  const strongestNegativeBlocker =
    negativeSignals.length > 0
      ? negativeSignals.reduce((best, cur) => (cur.weight > best.weight ? cur : best))
      : undefined;

  const sumNegIf = (key: NegativeQualifierKey): number =>
    negativeSignals.reduce((s, sig) => (sig.matchedQualifiers.includes(key) ? s + sig.weight : s), 0);
  const sumPosIf = (key: PositiveQualifierKey): number =>
    positiveSignals.reduce((s, sig) => (sig.matchedQualifiers.includes(key) ? s + sig.weight : s), 0);

  const unresolvedClaimTopic = sumNegIf("unresolvedClaimTopic");
  const allInclusiveLanguage = sumNegIf("allInclusiveLanguage");
  const vagueBoundary = sumNegIf("vagueBoundary");
  const explicitAssignment = sumPosIf("explicitAssignment");

  const rawBackedAnchorSupport = positiveSignals.reduce((s, sig) => {
    const origin = originByEvidenceId.get(sig.evidenceId);
    return origin === "raw_lv_evidence" ? s + sig.weight : s;
  }, 0);

  const rawNet =
    positiveSignals.reduce((s, sig) => (originByEvidenceId.get(sig.evidenceId) === "raw_lv_evidence" ? s + sig.weight : s), 0) -
    negativeSignals.reduce((s, sig) => (originByEvidenceId.get(sig.evidenceId) === "raw_lv_evidence" ? s + sig.weight : s), 0);

  const defensiveNet =
    positiveSignals.reduce((s, sig) => (originByEvidenceId.get(sig.evidenceId) !== "raw_lv_evidence" ? s + sig.weight : s), 0) -
    negativeSignals.reduce((s, sig) => (originByEvidenceId.get(sig.evidenceId) !== "raw_lv_evidence" ? s + sig.weight : s), 0);

  const familyConfidenceEvidenceQuality = rawNet - defensiveNet;

  return {
    rawScore,
    normalizedScore,
    positiveSignals,
    negativeSignals,
    unresolvedClaimTopics,
    enforceabilityRawBeforeNormalize: rawScore,
    enforceabilityRawAfterNormalize: normalizedScore,
    positiveContributionSum: positiveSum,
    negativeContributionSum: negativeSum,
    strongestPositiveDriver,
    strongestNegativeBlocker,
    rawBaseScore: rawScore,
    rawPositiveScore: positiveSum,
    rawNegativeScore: negativeSum,
    scoreBeforeNormalize,
    scoreAfterNormalize,
    scoreAfterFloorClamp,
    floorApplied,
    floorValue,
    normalizeClampApplied,
    normalizeClampRange,
    normalizeRoundedFrom,
    markerContributions: {
      unresolvedClaimTopic,
      allInclusiveLanguage,
      vagueBoundary,
      explicitAssignment,
      rawBackedAnchorSupport,
      familyConfidenceEvidenceQuality,
    },
    positiveEnforceabilityDebug: {
      detectedPositiveQualifiers,
      detectedNegativeQualifiers,
      requiredPositiveQualifiers: Array.from(requiredPositiveQualifiersSet),
      allowPositive: allowPositiveCounts,
      countPositiveCandidates,
      countNegativeCandidates,
      acceptedPositiveQualifiers,
      partiallyAcceptedPositiveQualifiers,
      familyAgnosticQualityGateCounts,
      lastFamilyAgnosticQualityGateReason,
      lastFamilyAgnosticQualityGatePass,
      hasRawSupport: hasAnyRawLvEvidence || rawEvidenceShare > 0,
      rawLvCount: rawLvIncludedCount,
      rawEvidenceShare,
      rejectedPositiveQualifiers,
    },
  };
}

