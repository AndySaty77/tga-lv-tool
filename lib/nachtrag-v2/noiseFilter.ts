/**
 * Vorfilterung für Nachtragspotenzial V2: reduziert generic_text_noise.
 * Texte nur behalten, wenn sie ein klares Claim-Signal oder echten Gap-/Scope-Hinweis haben.
 * Reine technische Beschreibungen ohne Claim-/Gap-Signal werden verworfen.
 */

/** Harte Noise-Patterns: Standardfloskeln, DIN/VOB, Hersteller, fachgerecht, betriebsfertig. */
const NOISE_PATTERNS = [
  /\b(din\s*\d+|vob\s*[a-z]?|vob\s*\d+)\b/i,
  /\b(hersteller|herstellerangabe|herstellerangaben|hersteller\s*vorgabe)\b/i,
  /\b(fachgerecht|fachgerechte|fachgerechter)\b/i,
  /\b(betriebsfertig|betriebsbereit)\b/i,
  /\b(normgerecht|normenkonform)\b/i,
  /\b(regelkonform|regelgerecht)\b/i,
  /\b(zulassung|allgemein\s*bauaufsichtlich)\b/i,
  /\b(stand\s*der\s*technik|state\s*of\s*the\s*art)\b/i,
  /\b(entsprechend\s*den\s*vorgaben|entsprechend\s*den\s*anforderungen)\b/i,
  /\b(alle\s*erforderlichen|sämtliche\s*erforderlichen)\b/i,
  /\b(ordnungsgemäß|ordnungsgemäße)\b/i,
];

/** Klare Claim-Signale: bauseits, Schnittstelle, Zuweisung, Abgrenzung. */
const CLAIM_SIGNAL_PATTERNS = [
  /\bbauseits\b/i,
  /\bnicht\s*enthalten\b/i,
  /\bnicht\s*bestandteil\b/i,
  /\boptional\b/i,
  /\bseparat\b/i,
  /\babzustimmen\b/i,
  /\bschnittstelle\b/i,
  /\bdurch\s*andere\s*gewerke\b/i,
  /\bdurch\s*auftraggeber\b/i,
  /\bvorleistung\b/i,
  /\babgrenzung\b/i,
  /\bleistungsgrenze\b/i,
];

/** Echte Gap-/Scope-Hinweise: Lücke, Unklarheit, fehlende Definition. */
const GAP_SCOPE_PATTERNS = [
  /\bunklar\b/i,
  /\bnicht\s*definiert\b/i,
  /\bnicht\s*beschrieben\b/i,
  /\bnicht\s*angegeben\b/i,
  /\bnicht\s*festgelegt\b/i,
  /\bfehlt\b/i,
  /\bfehlen\b/i,
  /\bzu\s*kl(ä|ae)ren\b/i,
  /\boffen\b/i,
  /\bnicht\s*im\s*leistungsumfang\b/i,
  /\baußerhalb\s*(des\s*)?(leistungs)?umfangs\b/i,
];

const MIN_TEXT_LENGTH = 25;

function hasClaimSignal(text: string): boolean {
  return CLAIM_SIGNAL_PATTERNS.some((r) => r.test(text));
}

function hasGapScopeSignal(text: string): boolean {
  return GAP_SCOPE_PATTERNS.some((r) => r.test(text));
}

/** Normalisiert Text für Dublettenprüfung. */
function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\wäöüß\s]/g, "")
    .trim()
    .slice(0, 200);
}

export type NoiseFilterContext = {
  /** Bereits gesehene normalisierte Texte (für Deduplizierung). */
  seenNormalized: Set<string>;
};

/**
 * Prüft, ob ein Evidence gefiltert werden soll (nicht in Pipeline aufnehmen).
 * - Mindestlänge 25 Zeichen.
 * - Dubletten werden verworfen.
 * - Nur behalten, wenn klares Claim-Signal ODER echter Gap-/Scope-Hinweis.
 * - Reine technische Beschreibungen ohne Claim-/Gap-Signal werden verworfen.
 */
export function shouldFilterEvidence(
  text: string,
  context: NoiseFilterContext
): boolean {
  const t = (text ?? "").trim();
  if (t.length < MIN_TEXT_LENGTH) return true;

  const norm = normalizeForDedup(t);
  if (context.seenNormalized.has(norm)) return true;
  context.seenNormalized.add(norm);

  if (hasClaimSignal(t)) return false;
  if (hasGapScopeSignal(t)) return false;

  return true;
}

/** Extrahiert alle relevanten Textteile aus einem Evidence-Objekt. */
export function getEvidenceText(ev: { title?: string; meta?: Record<string, unknown> }): string {
  const parts: string[] = [];
  if (ev.title) parts.push(ev.title);
  const m = ev.meta ?? {};
  if (typeof m.detail === "string") parts.push(m.detail);
  if (typeof m.raw_excerpt === "string") parts.push(m.raw_excerpt);
  if (typeof m.triggerName === "string") parts.push(m.triggerName);
  if (typeof m.triggerCategory === "string") parts.push(m.triggerCategory);
  return parts.filter(Boolean).join(" ");
}
