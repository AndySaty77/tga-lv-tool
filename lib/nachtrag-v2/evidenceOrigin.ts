/**
 * Evidence-Origin-Typisierung für Nachtragspotenzial V2.
 * Trennt Roh-Evidences von synthetischen/generischen Claim- oder Risiko-Wrappern.
 */

export type EvidenceOriginType =
  | "raw_lv_evidence"
  | "synthetic_claim_wrapper"
  | "synthetic_risk_summary"
  | "derived_anchor_hint"
  | "unknown_origin";

/** Muster für synthetische Claim-Wrapper (z. B. "Leistungsabgrenzung unklar ..."). */
const SYNTHETIC_CLAIM_PATTERNS = [
  /\bleistungsabgrenzung\s+(unklar|mehrdeutig|nicht\s+definiert)\b/i,
  /\bnebenleistungen\s+(nur\s+)?pauschal\b/i,
  /\bschnittstellen?\s+(zu\s+)?(anderen\s+)?gewerken\s+unklar\b/i,
  /\bvorleistungen?\s+(nicht\s+)?(definiert|beschrieben)\b/i,
  /\b(unklar|mehrdeutig)\s+oder\s+(unklar|mehrdeutig)\b/i,
  /\b(abgrenzung|leistungsumfang)\s+(unklar|nicht\s+klar)\b/i,
  /\bbauseits[-\s\/]*(ag[-\s]*)?leistungen?\s+(nicht\s+)?(definiert|beschrieben)\b/i,
  /\b(ag|auftraggeber)[-\s\/]*leistungen?\s+(nicht\s+)?(definiert|beschrieben)\b/i,
  /\binbetriebnahme\s*[\/]\s*abnahme\s+(nicht\s+)?(sauber\s+)?abgegrenzt\b/i,
  /\babnahme\s+(nicht\s+)?(sauber\s+)?abgegrenzt\b/i,
  /\bmassenermittlung\s*[\/]\s*mengen\s+unklar\b/i,
  /\bmengen\s+(unklar|nicht\s+definiert)\b/i,
  /\bmassenermittlung\s+(unklar|offen)\b/i,
];

/** Muster für synthetische Risiko-Zusammenfassungen. */
const SYNTHETIC_RISK_PATTERNS = [
  /\bkann\s+zu\s+nachforderungen\s+führen\b/i,
  /\bbirgt\s+risiko\b/i,
  /\bführt\s+häufig\s+zu\b/i,
  /\bspätere\s+konkretisierung\s+kann\b/i,
  /\brisiko\s+(für|bei)\s+(nachträge|mehrmengen)\b/i,
  /\bkann\s+zu\s+zusatzkosten\s+führen\b/i,
  /\btypisches\s+nachtragspotenzial\b/i,
  /\bpotenzial\s+für\s+(change\s+order|nachtrag)\b/i,
];

/** Muster für abgeleitete Anchor-Hinweise (z. B. aus KeyFacts, fehlenden Angaben). */
const DERIVED_ANCHOR_PATTERNS = [
  /\bkeyfact\s+fehlt\b/i,
  /\bfehlender\s+keyfact\b/i,
  /\bkeine\s+angabe\s+(zu|für)\b/i,
  /\bfehlt\s+oder\s+leer\b/i,
  /\bbauzeit\s+nicht\s+angegeben\b/i,
];

function hasSyntheticClaimPattern(text: string): boolean {
  return SYNTHETIC_CLAIM_PATTERNS.some((r) => r.test(text));
}

function hasSyntheticRiskPattern(text: string): boolean {
  return SYNTHETIC_RISK_PATTERNS.some((r) => r.test(text));
}

function hasDerivedAnchorPattern(text: string): boolean {
  return DERIVED_ANCHOR_PATTERNS.some((r) => r.test(text));
}

/**
 * Ermittelt den Evidence-Origin-Typ aus Text und Meta.
 */
export function detectEvidenceOrigin(
  text: string,
  meta?: Record<string, unknown>
): EvidenceOriginType {
  const t = (text ?? "").trim();
  if (t.length < 15) return "unknown_origin";

  if (hasDerivedAnchorPattern(t)) return "derived_anchor_hint";
  if (hasSyntheticRiskPattern(t)) return "synthetic_risk_summary";
  if (hasSyntheticClaimPattern(t)) return "synthetic_claim_wrapper";

  const fieldType = meta?.fieldType as string | undefined;
  const title = (meta?.title ?? "") as string;
  const hasGenericTitle =
    /^(leistungsabgrenzung|nebenleistung|schnittstelle|mengenrisiko|dokumentation|bauseits|inbetriebnahme|abnahme|massen)\s*[-\/]?/i.test(
      title.slice(0, 50)
    ) && /(unklar|nicht\s+definiert|pauschal|nicht\s+abgegrenzt|nicht\s+beschrieben)/i.test(title);
  if (hasGenericTitle && t.length < 300) return "synthetic_claim_wrapper";

  const hasRawExcerpt = typeof meta?.raw_excerpt === "string" && (meta.raw_excerpt as string).trim().length > 30;
  const hasPositionContext = meta?.sourceType === "position" || meta?.sourceContext === "position";
  if (hasRawExcerpt || hasPositionContext) return "raw_lv_evidence";

  if (fieldType && ["leistungsabgrenzung", "nebenleistung", "schnittstelle", "mengenrisiko", "dokumentation_inbetriebnahme"].includes(String(fieldType))) {
    if (t.length < 250 && !hasRawExcerpt) return "synthetic_claim_wrapper";
  }

  return "unknown_origin";
}

/**
 * Family aus fieldType für synthetische Wrapper ableiten (Erbe vom Quellkontext).
 */
export function familyFromFieldTypeForSynthetic(fieldType?: string): string | null {
  if (!fieldType) return null;
  const f = String(fieldType).toLowerCase();
  if (f === "schnittstelle" || f === "leistungsabgrenzung" || f === "nebenleistung") return "schnittstelle";
  return null;
}
