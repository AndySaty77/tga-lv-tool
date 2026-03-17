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
};

const POSITIVE_FAMILY_WEIGHTS: Record<string, number> = {
  bauseits_allgemein: 4,
  leistungsabgrenzung_allgemein: 4,
  schnittstelle_allgemein: 3,
  mengen_unbestimmt: 2,
  msr_fremdgewerk_uebergang: 4,
  pruef_mess_nachweis_allgemein: 3,
  inbetriebnahme_allgemein: 3,
};

const NEGATIVE_FAMILY_WEIGHTS: Record<string, number> = {
  vollstaendigkeitspauschale: 7,
  nebenleistung_allgemein: 5,
};

const REQUIRED_POS_QUALIFIERS_BY_FAMILY: Record<string, PositiveQualifierKey[]> = {
  bauseits_allgemein: ["explicitAssignment", "clearBoundary"],
  leistungsabgrenzung_allgemein: ["explicitAssignment", "clearBoundary"],
  schnittstelle_allgemein: ["clearBoundary", "handoverPointPresent"],
  mengen_unbestimmt: ["billingMechanismPresent"],
  pruef_mess_nachweis_allgemein: ["testAcceptanceLinkPresent", "clearBoundary"],
  inbetriebnahme_allgemein: ["testAcceptanceLinkPresent", "handoverPointPresent", "clearBoundary"],
  msr_fremdgewerk_uebergang: ["explicitAssignment", "clearBoundary", "handoverPointPresent"],
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
  return Math.max(0, Math.min(100, Math.round(eased * 40)));
}

export function analyzeEnforceability(evidences: NachtragEvidenceV2[]): EnforceabilityAnalysis {
  const positiveSignals: EnforceabilitySignal[] = [];
  const negativeSignals: EnforceabilitySignal[] = [];
  const unresolvedClaimTopics: Array<{ evidenceId: string; family: string; reason: string }> = [];

  for (const ev of evidences) {
    const baseWeight =
      typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;
    if (baseWeight <= 0) continue;

    const fam = ev.family;
    const q = detectEnforceabilityQualifiers(ev);

    const posQ = q.positive;
    const negQ = q.negative;

    // Claim-Blocker sollen nicht implizit nur über Family laufen: immer qualifierbasiert (allInclusive/pauschal/etc.)
    const hasNegativeQualifiers = negQ.length > 0;

    // Positive Hebel sind streng an Qualifier gekoppelt.
    const requiredPos = REQUIRED_POS_QUALIFIERS_BY_FAMILY[fam] ?? [];
    const allowPositive = requiredPos.length > 0 ? hasAny(posQ, requiredPos) : false;

    // Unresolved Claim Topic: Thema vorhanden, aber keine Freischaltung für positiven Hebel.
    if (!allowPositive && negQ.includes("unresolvedClaimTopic")) {
      unresolvedClaimTopics.push({
        evidenceId: ev.id,
        family: fam,
        reason: "Claim-Thema vorhanden, aber keine klare Zuweisung/Grenze/Mechanik erkannt.",
      });
    }

    if (POSITIVE_FAMILY_WEIGHTS[fam] != null && allowPositive) {
      // Positive nur, wenn ein passender positiver Qualifier matcht. Keine Familien-Bypässe.
      const qualityBoost = 1 + Math.min(0.35, Math.max(0, posQ.length - 1) * 0.12);
      const negDamp = hasNegativeQualifiers ? 0.75 : 1.0;
      const w = POSITIVE_FAMILY_WEIGHTS[fam] * Math.sqrt(baseWeight) * qualityBoost * negDamp;
      positiveSignals.push({
        evidenceId: ev.id,
        family: fam,
        matchedQualifiers: [...posQ],
        weight: w,
        reason: `Positiver Claim-Hebel: ${fam} (freigeschaltet durch ${posQ.join(", ")})`,
      });
    }

    // Negative: qualifiergetrieben (und bei expliziten Blocker-Familien verstärkt).
    if (hasNegativeQualifiers) {
      const baseNeg = 2.2; // Qualifier-Basis, damit Blocker nicht "nur implizit" bleiben
      const familyBoost = NEGATIVE_FAMILY_WEIGHTS[fam] != null ? NEGATIVE_FAMILY_WEIGHTS[fam] : 0;
      const qualBoost = 1 + Math.min(0.35, Math.max(0, negQ.length - 1) * 0.15);
      const w = (baseNeg + familyBoost) * Math.sqrt(baseWeight) * qualBoost;
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

  const rawScore = Math.max(0, positiveSum - negativeSum);
  const normalizedScore = normalizeEnforceability(rawScore);

  return {
    rawScore,
    normalizedScore,
    positiveSignals,
    negativeSignals,
    unresolvedClaimTopics,
  };
}

