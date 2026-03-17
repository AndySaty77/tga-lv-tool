import type { NachtragEvidenceV2 } from "./types";

export type PositiveQualifierKey =
  | "explicitAssignment"
  | "clearBoundary"
  | "billingMechanismPresent"
  | "handoverPointPresent"
  | "testAcceptanceLinkPresent";

export type NegativeQualifierKey =
  | "vagueBoundary"
  | "globalResponsibility"
  | "allInclusiveLanguage"
  | "pauschalCompensationLanguage"
  | "unresolvedClaimTopic";

export type QualifierMatch = {
  positive: PositiveQualifierKey[];
  negative: NegativeQualifierKey[];
  checkedText: string;
  matchedFragments: Partial<Record<PositiveQualifierKey | NegativeQualifierKey, string[]>>;
};

function pickTextFragments(ev: NachtragEvidenceV2): string[] {
  const meta = (ev.meta ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  const title = typeof ev.title === "string" ? ev.title : (typeof meta.title === "string" ? (meta.title as string) : "");
  const detail = typeof meta.detail === "string" ? (meta.detail as string) : "";
  const rawExcerpt = typeof meta.raw_excerpt === "string" ? (meta.raw_excerpt as string) : "";
  const triggerName = typeof meta.triggerName === "string" ? (meta.triggerName as string) : "";
  const triggerCategory = typeof meta.triggerCategory === "string" ? (meta.triggerCategory as string) : "";

  if (title.trim()) parts.push(title);
  if (detail.trim()) parts.push(detail);
  if (rawExcerpt.trim()) parts.push(rawExcerpt);
  if (triggerName.trim()) parts.push(triggerName);
  if (triggerCategory.trim()) parts.push(triggerCategory);

  return parts;
}

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  try {
    const m = text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
    if (m) out.push(...m.map((s) => s.trim()).filter(Boolean));
  } catch {
    // ignore
  }
  return out;
}

export function detectEnforceabilityQualifiers(ev: NachtragEvidenceV2): QualifierMatch {
  const checkedText = pickTextFragments(ev).join(" \n ").toLowerCase();
  const matchedFragments: QualifierMatch["matchedFragments"] = {};

  const pos: PositiveQualifierKey[] = [];
  const neg: NegativeQualifierKey[] = [];

  // Positive: klare Zuweisung
  const mAssign = matchAll(
    checkedText,
    /\b(bauseits|bauherrseitig|ag-?seitig|durch\s+(ag|auftraggeber|bauherr)|liegt\s+bei|zust(ä|ae)ndig|verantwortlich)\b/gi
  );
  if (mAssign.length) {
    pos.push("explicitAssignment");
    matchedFragments.explicitAssignment = mAssign.slice(0, 5);
  }

  // Positive: klare Grenze / Abgrenzung
  const mBoundary = matchAll(
    checkedText,
    /\b(leistungsgrenze|abgrenzung|bis\s+einschl|bis\s+einschlie(ß|ss)lich|ab\s+|anschlussgrenze|schnittstellenpunkt|liefergrenze|zust(ä|ae)ndigkeitsgrenze)\b/gi
  );
  if (mBoundary.length) {
    pos.push("clearBoundary");
    matchedFragments.clearBoundary = mBoundary.slice(0, 5);
  }

  // Positive: Abrechnungsmechanik
  const mBilling = matchAll(
    checkedText,
    /\b(aufma(ß|ss)|einheitspreis|\bep\b|mehrmenge|mindermenge|abrechnung\s+nach\s+aufwand|nachweisf(ü|ue)hrung|nach\s+nachweis)\b/gi
  );
  if (mBilling.length) {
    pos.push("billingMechanismPresent");
    matchedFragments.billingMechanismPresent = mBilling.slice(0, 5);
  }

  // Positive: Übergabepunkt
  const mHandover = matchAll(
    checkedText,
    /\b(übergabepunkt|uebergabepunkt|übergabestelle|uebergabestelle|freigabe|aufschaltung|anschluss\s+an|anbindung|schnittstelle\s+bei)\b/gi
  );
  if (mHandover.length) {
    pos.push("handoverPointPresent");
    matchedFragments.handoverPointPresent = mHandover.slice(0, 5);
  }

  // Positive: Prüf-/Abnahmebezug
  const mTest = matchAll(
    checkedText,
    /\b(pr(ü|ue)f|nachweis|mess|protokoll|abnahme|inbetriebnahme|funktionspr(ü|ue)fung)\b/gi
  );
  if (mTest.length) {
    pos.push("testAcceptanceLinkPresent");
    matchedFragments.testAcceptanceLinkPresent = mTest.slice(0, 5);
  }

  // Negative: vage Grenze / Abstimmung
  const mVague = matchAll(
    checkedText,
    /\b(in\s+abstimmung|abzustimmen|in\s+zusammenarbeit|nach\s+erfordernis|nach\s+bedarf|unscharf|zu\s+kl(ä|ae)ren|wird\s+koordiniert)\b/gi
  );
  if (mVague.length) {
    neg.push("vagueBoundary");
    matchedFragments.vagueBoundary = mVague.slice(0, 5);
  }

  // Negative: globale Verantwortung
  const mGlobalResp = matchAll(
    checkedText,
    /\b(gesamtverantwortung|systemverantwortung|erfolgsschuld|funktionsverantwortung|komplettverantwortung|vollst(ä|ae)ndige\s+verantwortung)\b/gi
  );
  if (mGlobalResp.length) {
    neg.push("globalResponsibility");
    matchedFragments.globalResponsibility = mGlobalResp.slice(0, 5);
  }

  // Negative: all-inclusive Sprache
  const mAllIncl = matchAll(
    checkedText,
    /\b(inkl\.?|inklusive|einschl\.?|s(ä|ae)mtliche|alle\s+erforderlichen|vollst(ä|ae)ndig|komplett|nebenleistungen\s+inklusive)\b/gi
  );
  if (mAllIncl.length) {
    neg.push("allInclusiveLanguage");
    matchedFragments.allInclusiveLanguage = mAllIncl.slice(0, 5);
  }

  // Negative: pauschal abgegolten
  const mPauschal = matchAll(
    checkedText,
    /\b(pauschal\s+abgegolten|mit\s+dem\s+preis\s+abgegolten|ohne\s+gesonderte\s+verg(ü|ue)tung|keine\s+zus(ä|ae)tzliche\s+verg(ü|ue)tung|im\s+preis\s+enthalten)\b/gi
  );
  if (mPauschal.length) {
    neg.push("pauschalCompensationLanguage");
    matchedFragments.pauschalCompensationLanguage = mPauschal.slice(0, 5);
  }

  // Negative: unresolved Claim Topic (Thema da, aber keine klare Zuweisung/Mechanik)
  const hasClaimTopic = /\b(nachtrag|mehrkosten|zusatzleistung|claim)\b/i.test(checkedText);
  const hasStrongPos = pos.includes("explicitAssignment") || pos.includes("clearBoundary") || pos.includes("billingMechanismPresent");
  if (hasClaimTopic && !hasStrongPos) {
    neg.push("unresolvedClaimTopic");
    matchedFragments.unresolvedClaimTopic = ["claim-topic-ohne-klare-zuweisung/mechanik"];
  }

  // Dedup
  const posDedup = Array.from(new Set(pos));
  const negDedup = Array.from(new Set(neg));

  return { positive: posDedup, negative: negDedup, checkedText, matchedFragments };
}

