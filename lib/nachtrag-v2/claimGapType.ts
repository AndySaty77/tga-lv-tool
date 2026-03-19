/**
 * Vorgelagerte Claim-/Gap-Typisierung für Nachtragspotenzial V2.
 * Läuft nur auf Texte, die den Noise-/Claim-/Gap-Filter bestanden haben.
 * Vor dem Family-Mapping.
 */

export type ClaimGapType =
  | "scope_exclusion"
  | "bauseits_other_trade"
  | "coordination_interface"
  | "missing_definition"
  | "open_quantity"
  | "documentation_acceptance"
  | "all_inclusive_blocker"
  | "unresolved_claim_topic"
  | "none";

/** Patterns pro Typ (Reihenfolge: spezifisch vor allgemein). */
const TYPE_PATTERNS: Array<{ type: ClaimGapType; patterns: RegExp[] }> = [
  {
    type: "documentation_acceptance",
    patterns: [
      /\bdokumentation\b/i,
      /\babnahme\b/i,
      /\binbetriebnahme\b/i,
      /\bibn\b/i,
      /\bnachweis\b/i,
      /\bprotokoll\b/i,
      /\brevisionsunterlage\b/i,
      /\bas-?built\b/i,
    ],
  },
  {
    type: "open_quantity",
    patterns: [
      /\bmengen\s*k(ö|oe)nnen\s*abweichen\b/i,
      /\bnach\s*erfordernis\b/i,
      /\bvorl(ä|ae)ufig\b/i,
      /\bgesch(ä|ae)tzt\b/i,
      /\bca\.\b/i,
      /\bcirca\b/i,
      /\bmengen?ermittlung\b/i,
      /\bmassenermittlung\b/i,
      /\bmengen\s+(unklar|nicht\s+definiert)\b/i,
      /\bpauschal\b/i,
      /\baufma(ß|ss)\b/i,
      /\bmehrmenge\b/i,
      /\bmindermenge\b/i,
      /\bansatzlogik\b/i,
    ],
  },
  {
    type: "scope_exclusion",
    patterns: [
      /\bnicht\s*im\s*leistungsumfang\b/i,
      /\baußerhalb\s*(des\s*)?(leistungs)?umfangs\b/i,
      /\bnicht\s*enthalten\b/i,
      /\bnicht\s*bestandteil\b/i,
    ],
  },
  {
    type: "bauseits_other_trade",
    patterns: [
      /\bdurch\s*andere\s*gewerke\b/i,
      /\bdurch\s*auftraggeber\b/i,
      /\bbauseits\b/i,
      /\bbauherrseitig\b/i,
      /\bag-?seitig\b/i,
    ],
  },
  {
    type: "coordination_interface",
    patterns: [
      /\babzustimmen\b/i,
      /\bschnittstelle\b/i,
      /\bkoordination\b/i,
      /\babgrenzung\b/i,
      /\bleistungsgrenze\b/i,
      /\bvorleistung\b/i,
    ],
  },
  {
    type: "missing_definition",
    patterns: [
      /\bunklar\b/i,
      /\bnicht\s*definiert\b/i,
      /\bnicht\s*beschrieben\b/i,
      /\bnicht\s*angegeben\b/i,
      /\bnicht\s*festgelegt\b/i,
      /\bzu\s*kl(ä|ae)ren\b/i,
      /\boffen\b/i,
      /\bfehlt\b/i,
      /\bfehlen\b/i,
    ],
  },
  {
    type: "all_inclusive_blocker",
    patterns: [
      /\binklusive\s*aller\s*nebenleistungen\b/i,
      /\bvollst(ä|ae)ndig\b/i,
      /\bbetriebsfertig\b/i,
      /\bfunktionsf(ä|ae)hig\s*komplett\b/i,
      /\bmit\s*dem\s*preis\s*abgegolten\b/i,
      /\bpauschal\s*abgegolten\b/i,
    ],
  },
];

/**
 * Ermittelt den Claim-/Gap-Typ aus dem Text.
 * Erste passende Regel gewinnt (spezifisch vor allgemein).
 */
export function detectClaimGapType(text: string): ClaimGapType {
  const t = (text ?? "").trim();
  if (t.length < 10) return "none";

  for (const { type, patterns } of TYPE_PATTERNS) {
    if (patterns.some((r) => r.test(t))) return type;
  }

  return "none";
}
