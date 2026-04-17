/**
 * Strenges Grounding für Vortext-Risiko-Treffer: Titel, Beleg und Interpretation
 * müssen aus demselben Evidence-String ableitbar sein (kein Mix aus Katalog-Titel + fremdem Chunk).
 */

import type { Finding } from "./scoring";
import type { LegalSignal } from "./legal-signals/types";
import type { VortextRiskClause } from "./vortextRiskFromEngine";
import { buildReadableSnippet, formatEvidenceForDisplay } from "./evidenceSnippet";

const MIN_EVIDENCE_CHARS = 24;

/** MSR-/RLT-Regelung: „Regelung“ im Vertragswortlaut ohne diese Anker nicht technisch interpretieren. */
const REGULATION_TECH_ANCHORS = [
  "msr",
  "gebäudeautomation",
  "gebaeudeautomation",
  "sollwert",
  "istwert",
  "witterungsgef",
  "raumgef",
  "fernzugriff",
  "parametr",
  "regelungstechnik",
  "stellantrieb",
  "stellmotor",
  "ventil",
  "mischer",
  "bacnet",
  "modbus",
  "ddc",
  "knx",
  "rlt",
  "vav",
];

/** Mehrdeutige Wortstämme im Beleg → technische Deutung nur mit genügend Fach-Ankern (s. Paare). */
const AMBIGUOUS_EVIDENCE_PATTERNS: Array<{
  id: string;
  /** Wenn das im Beleg vorkommt … */
  evidenceTest: (evN: string) => boolean;
  /** … brauchen wir mindestens so viele Treffer aus anchorList im Beleg für „spezifische“ Titel/Interpretation. */
  minAnchors: number;
  anchorList: string[];
}> = [
  {
    id: "regelung",
    evidenceTest: (evN) => /\bregelung(en|stechnik)?\b/.test(evN) || evN.includes("regelungs"),
    minAnchors: 1,
    anchorList: [...REGULATION_TECH_ANCHORS],
  },
  {
    id: "schutz",
    evidenceTest: (evN) =>
      /\bschutz\b/.test(evN) &&
      !/\b(brandschutz|schallschutz|datenschutz|schadensersatz|gew(ä|ae)hrleist|verj(ä|ae)hrung|überspann|ueberspann)\b/.test(
        evN
      ),
    minAnchors: 1,
    anchorList: [
      "brandschutz",
      "schallschutz",
      "korrosionsschutz",
      "überspannungsschutz",
      "ueberspannungsschutz",
      "personenschutz",
      "ip ",
      "schutzklasse",
      "potentialausgleich",
      "rcd",
      " fi ",
    ],
  },
  {
    id: "anschluss",
    evidenceTest: (evN) =>
      /\banschluss\b/.test(evN) &&
      !/\b(vertrags|vertraglich|anspruch|eignung|unternehmen)\b/.test(evN),
    minAnchors: 1,
    anchorList: [
      "elektro",
      "heiz",
      "kälte",
      "kaelte",
      "gas",
      "wasser",
      "kanal",
      "muffe",
      "übergang",
      "uebergang",
      "leitung",
      "verteiler",
    ],
  },
  {
    id: "pruefung",
    evidenceTest: (evN) => /\bprüfung\b/.test(evN) || /\bpruefung\b/.test(evN),
    minAnchors: 1,
    anchorList: [
      "abnahme",
      "druckprüfung",
      "druckpruefung",
      "dichtheit",
      "funktionsprüfung",
      "messung",
      "protokoll",
      "din ",
      "vde",
    ],
  },
  {
    id: "nachweis",
    evidenceTest: (evN) => /\bnachweis\b/.test(evN),
    minAnchors: 1,
    anchorList: [
      "statik",
      "brandschutz",
      "schall",
      "wärmeschutz",
      "waermeschutz",
      "förderfähig",
      "foerderfaehig",
      "ce ",
      "ü-z",
      "ue-z",
      "typprüfung",
    ],
  },
];

/**
 * Spezifische Ausdrücke in Interpretation/Titel-Zusatz: nur wenn wörtlich (normalisiert) im Beleg,
 * sonst Entfernen / generischer Fallback.
 */
const INTERP_SPECIFIC_PHRASES: string[] = [
  "hydraulische weiche",
  "hydraulikweiche",
  "hydraulische anbindung",
  "dimensionierung",
  "dimensioniert",
  "verantwortung",
  "zuständigkeit",
  "zustaendigkeit",
  "ungeklärt",
  "ungeklaert",
  "regelungskonzept",
  "regelstrategie",
  "witterungsgeführt",
  "witterungsgefuehrt",
  "raumgeführt",
  "raumgefuehrt",
  "parametrierung",
  "parametrieren",
  "fernwirk",
  "fernzugriff",
  "gebäudeautomation",
  "gebaeudeautomation",
  "msr-technik",
  "stellgröße",
  "stellgroesse",
];

const GENERIC_INTERP_TAIL =
  "Hinweis im Einleitungstext – fachliche und technische Ausgestaltung anhand des Auszugs prüfen, ohne nicht belegte Details zu übernehmen.";

/** Begriffe: nur wenn sie im Trigger-Titel vorkommen, müssen sie auch im Beleg stehen. */
const TECH_LEXICON = [
  "regelungskonzept",
  "witterungsgeführt",
  "witterungsgefuehrt",
  "raumgeführt",
  "raumgefuehrt",
  "fernzugriff",
  "elektroanschluss",
  "hydraulisch",
  "hydraulische",
  "weiche",
  "kernbohrung",
  "kernbohrungen",
  "brandschutz",
  "abschottung",
  "abschottungen",
  "salvatorisch",
  "unverbindlich",
  "durchführbar",
  "undurchführbar",
];

const STOP = new Set([
  "nicht",
  "eine",
  "einen",
  "einer",
  "einem",
  "sowie",
  "oder",
  "auch",
  "wird",
  "werden",
  "kann",
  "muss",
  "soll",
  "nach",
  "über",
  "ueber",
  "unter",
  "dass",
  "wenn",
  "dann",
  "sich",
  "sind",
  "ist",
  "hat",
  "haben",
  "wurde",
  "wurden",
  "dieser",
  "dieses",
  "diese",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "das",
  "und",
  "im",
  "in",
  "am",
  "an",
  "auf",
  "zu",
  "zur",
  "zum",
  "vom",
  "von",
  "mit",
  "ohne",
  "bei",
  "als",
  "für",
  "fuer",
]);

export type TitleOrigin = "rule_template" | "llm" | "generated_keyword" | "generic_fallback" | "regex_template";

export type EvidenceOrigin = "raw_excerpt" | "legal_evidence" | "llm_quote" | "regex_match";

export type InterpretationGroundingDebug = {
  interpretationAnchors: string[];
  blockedSpecificTerms: string[];
  ambiguousContextViolations: string[];
  downgradedToGeneric: boolean;
  downgradeReason?: string;
};

export type GroundedVortextRiskItem = {
  id: string;
  finalTitle: string;
  category: string;
  severity: "low" | "medium" | "high";
  evidenceText: string;
  evidenceSourceLayer: NonNullable<VortextRiskClause["source"]>;
  evidenceStart?: number;
  evidenceEnd?: number;
  interpretation: string;
  triggerId?: string;
  sourceRuleId?: string;
  mergeOrigin: string;
  dedupeGroup: string;
  titleOrigin: TitleOrigin;
  evidenceOrigin: EvidenceOrigin;
  previewText: string;
  interpretationDebug?: InterpretationGroundingDebug;
  titleDowngradeReason?: string;
};

export type GroundingDropReason = {
  layer: string;
  originalTitle?: string;
  evidenceSnippet?: string;
  reason: string;
  triggerId?: string;
  ruleId?: string;
};

export type GroundingResult = {
  items: GroundedVortextRiskItem[];
  dropped: GroundingDropReason[];
  /** Für API-Kompatibilität (Karte + Modal) */
  riskClauses: VortextRiskClause[];
};

type RawCandidate = {
  __rank: number;
  sourceLayer: NonNullable<VortextRiskClause["source"]>;
  triggerTitle?: string;
  triggerId?: string;
  ruleId?: string;
  categoryLabel: string;
  severity: "low" | "medium" | "high";
  evidenceText: string;
  evidenceOrigin: EvidenceOrigin;
  matchedKeyword?: string;
  interpretationBase: string;
  userHint?: string;
  mergeOrigin: string;
};

function normalizeFold(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(text: string): string[] {
  const t = normalizeFold(text).replace(/[^\p{L}\p{N}\s-]/gu, " ");
  return t
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length >= 5 && !STOP.has(w));
}

function lexiconHitsInTitle(title: string): string[] {
  const n = normalizeFold(title);
  return TECH_LEXICON.filter((term) => n.includes(term));
}

function allTermsInEvidence(terms: string[], evidence: string): boolean {
  const ev = normalizeFold(evidence);
  return terms.every((t) => ev.includes(t));
}

function tokenOverlapCount(title: string, evidence: string): number {
  const tt = new Set(significantTokens(title));
  if (tt.size === 0) return 0;
  const ev = normalizeFold(evidence);
  let n = 0;
  for (const tok of tt) {
    if (ev.includes(tok)) n++;
  }
  return n;
}

function locateInFullText(full: string, excerpt: string): { start?: number; end?: number } {
  const needle = excerpt.slice(0, Math.min(72, excerpt.length)).trim();
  if (needle.length < 12) return {};
  let idx = full.indexOf(needle);
  if (idx >= 0) return { start: idx, end: Math.min(full.length, idx + excerpt.length) };
  const fn = normalizeFold(full);
  const nn = normalizeFold(needle);
  idx = fn.indexOf(nn);
  if (idx >= 0) return { start: idx, end: Math.min(full.length, idx + excerpt.length) };
  return {};
}

function shortId(parts: string[]): string {
  let h = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `vr-${Math.abs(h).toString(36)}`;
}

function uniqueSorted(arr: string[]): string[] {
  return [...new Set(arr)].sort();
}

function countAnchorsInEvidence(evN: string, anchorList: string[]): number {
  return anchorList.filter((a) => a.trim().length > 0 && evN.includes(a)).length;
}

function evaluateAmbiguousEvidenceContext(evidence: string): {
  violations: string[];
  anchorsMatchedInEvidence: string[];
} {
  const evN = normalizeFold(evidence);
  const violations: string[] = [];
  const anchorsHit: string[] = [];
  for (const p of AMBIGUOUS_EVIDENCE_PATTERNS) {
    for (const a of p.anchorList) {
      if (evN.includes(a)) anchorsHit.push(a);
    }
    if (p.evidenceTest(evN)) {
      const n = countAnchorsInEvidence(evN, p.anchorList);
      if (n < p.minAnchors) violations.push(p.id);
    }
  }
  return { violations: [...new Set(violations)], anchorsMatchedInEvidence: uniqueSorted(anchorsHit) };
}

function finalizeInterpretation(args: {
  evidenceText: string;
  interpretation: string;
  categoryLabel: string;
  ambiguousViolations: string[];
  anchorsMatchedInEvidence: string[];
}): { text: string; debug: InterpretationGroundingDebug } {
  const evN = normalizeFold(args.evidenceText);
  const interN = normalizeFold(args.interpretation);
  const blocked: string[] = [];

  for (const ph of INTERP_SPECIFIC_PHRASES) {
    const pn = normalizeFold(ph);
    if (pn.length >= 4 && interN.includes(pn) && !evN.includes(pn)) blocked.push(ph);
  }

  const strictInterpTerms = ["weiche", "hydraulisch", "hydraulik", "mischerkreis", "pufferspeicher-kreis", "stellkreis"];
  for (const t of strictInterpTerms) {
    if (interN.includes(t) && !evN.includes(t) && !blocked.includes(t)) blocked.push(t);
  }

  /** Zwei-Anker-Heuristik: Begriff nur zulässig, wenn wörtlich im Beleg ODER mind. 2 Anker aus REGULATION_TECH_ANCHORS im Beleg (für nicht wörtliche technische Zusatzbehauptungen). */
  const anchorCountReg = countAnchorsInEvidence(evN, REGULATION_TECH_ANCHORS);
  const techClaimsInInterp = [
    "hydraulische weiche",
    "hydraulikweiche",
    "dimensionierung",
    "verantwortung",
    "zuständigkeit",
    "zustaendigkeit",
    "regelungskonzept",
  ].filter((ph) => {
    const pn = normalizeFold(ph);
    return pn.length >= 4 && interN.includes(pn);
  });
  for (const ph of techClaimsInInterp) {
    const pn = normalizeFold(ph);
    const literalInEv = evN.includes(pn);
    if (!literalInEv && anchorCountReg < 2) {
      if (!blocked.includes(ph)) blocked.push(`${ph}(needs_literal_or_2_anchors)`);
    }
  }

  let downgraded = false;
  let downgradeReason: string | undefined;
  let out = args.interpretation.trim();

  if (args.ambiguousViolations.length > 0) {
    downgraded = true;
    downgradeReason = `ambiguous_keyword_missing_anchors:${args.ambiguousViolations.join(",")}`;
    out = `Kategorie: ${args.categoryLabel}. ${GENERIC_INTERP_TAIL}`.slice(0, 520);
  } else if (blocked.length > 0) {
    downgraded = true;
    downgradeReason = `specific_not_evidence_backed:${blocked.slice(0, 8).join(";")}`;
    out = `Kategorie: ${args.categoryLabel}. ${GENERIC_INTERP_TAIL}`.slice(0, 520);
  }

  const debug: InterpretationGroundingDebug = {
    interpretationAnchors: args.anchorsMatchedInEvidence,
    blockedSpecificTerms: blocked,
    ambiguousContextViolations: args.ambiguousViolations,
    downgradedToGeneric: downgraded,
    downgradeReason,
  };
  return { text: out, debug };
}

export function groundTitleAndInterpretation(args: {
  catalogTitle: string;
  evidenceText: string;
  matchedKeyword?: string;
  categoryLabel: string;
  interpretationBase: string;
  userHint?: string;
  layer: RawCandidate["sourceLayer"];
  proposedTitleOrigin: TitleOrigin;
}): {
  finalTitle: string;
  titleOrigin: TitleOrigin;
  interpretation: string;
  ok: boolean;
  dropReason?: string;
  interpretationDebug?: InterpretationGroundingDebug;
  titleDowngradeReason?: string;
} {
  const ev = args.evidenceText.trim();
  if (ev.length < MIN_EVIDENCE_CHARS) {
    return { finalTitle: "", titleOrigin: args.proposedTitleOrigin, interpretation: "", ok: false, dropReason: "evidence_too_short" };
  }

  const { violations: ambiguousViolations, anchorsMatchedInEvidence } = evaluateAmbiguousEvidenceContext(ev);

  const lex = lexiconHitsInTitle(args.catalogTitle);
  const lexOk = lex.length === 0 || allTermsInEvidence(lex, ev);
  const overlap = tokenOverlapCount(args.catalogTitle, ev);
  const mk = args.matchedKeyword?.trim();
  const mkInEv = mk ? normalizeFold(ev).includes(normalizeFold(mk)) : false;

  let titleOrigin = args.proposedTitleOrigin;
  let finalTitle = args.catalogTitle.trim();

  if (!lexOk) {
    if (mkInEv && mk) {
      finalTitle = `Vortext-Hinweis (Treffer: „${mk}“)`;
      titleOrigin = "generated_keyword";
    } else if (overlap >= 2) {
      finalTitle = args.catalogTitle.trim();
      titleOrigin = "rule_template";
    } else if (overlap >= 1 && normalizeFold(args.catalogTitle).length < 50) {
      finalTitle = args.catalogTitle.trim();
      titleOrigin = "rule_template";
    } else {
      finalTitle = "Hinweis im Einleitungstext";
      titleOrigin = "generic_fallback";
    }
  } else if (overlap >= 1 || mkInEv || lex.length > 0) {
    titleOrigin = args.proposedTitleOrigin === "llm" && overlap < 1 && !mkInEv ? "generic_fallback" : args.proposedTitleOrigin;
    if (titleOrigin === "generic_fallback" && args.proposedTitleOrigin === "llm") {
      finalTitle = "Formulierung im Einleitungstext";
    }
  } else {
    if (mkInEv && mk) {
      finalTitle = `Vortext-Hinweis (Treffer: „${mk}“)`;
      titleOrigin = "generated_keyword";
    } else {
      finalTitle = "Hinweis im Einleitungstext";
      titleOrigin = "generic_fallback";
    }
  }

  // LLM: keine technischen Titel ohne lexikalische Deckung
  if (args.layer === "llm") {
    const llmLex = lexiconHitsInTitle(args.catalogTitle);
    if (llmLex.length && !allTermsInEvidence(llmLex, ev)) {
      finalTitle = "Formulierung im Einleitungstext";
      titleOrigin = "generic_fallback";
    } else if (overlap < 1 && !mkInEv && llmLex.length === 0) {
      finalTitle = "Formulierung im Einleitungstext";
      titleOrigin = "generic_fallback";
    }
  }

  let interpretation = args.interpretationBase.trim();
  const hint = args.userHint?.trim();
  if (hint && tokenOverlapCount(hint, ev) >= 1) {
    interpretation = `Kategorie: ${args.categoryLabel}. ${hint}`.slice(0, 520);
  } else {
    interpretation = `Kategorie: ${args.categoryLabel}. ${interpretation}`.slice(0, 520);
  }

  let titleDowngradeReason: string | undefined;
  const evN = normalizeFold(ev);
  if (ambiguousViolations.includes("regelung")) {
    const techTitleFrags = [
      "regelungskonzept",
      "witterungsgef",
      "raumgef",
      "fernzugriff",
      "parametr",
      "regelstrategie",
      "gebäudeautomation",
      "gebaeudeautomation",
    ];
    const ft = normalizeFold(finalTitle);
    if (techTitleFrags.some((f) => ft.includes(f) && !evN.includes(f))) {
      finalTitle = "Hinweis im Einleitungstext – technische Ausgestaltung prüfen";
      titleOrigin = "generic_fallback";
      titleDowngradeReason = "regelung_ambiguous_without_msr_anchors";
    }
  }

  // Strenge Konsistenz: technische Wörter im finalen Titel müssen im Beleg vorkommen
  const titleLex = lexiconHitsInTitle(finalTitle);
  if (titleLex.length && !allTermsInEvidence(titleLex, ev)) {
    return {
      finalTitle: "",
      titleOrigin,
      interpretation: "",
      ok: false,
      dropReason: "title_evidence_mismatch_after_grounding",
    };
  }

  const fin = finalizeInterpretation({
    evidenceText: ev,
    interpretation,
    categoryLabel: args.categoryLabel,
    ambiguousViolations,
    anchorsMatchedInEvidence,
  });

  return {
    finalTitle,
    titleOrigin,
    interpretation: fin.text,
    ok: true,
    interpretationDebug: fin.debug,
    ...(titleDowngradeReason ? { titleDowngradeReason } : {}),
  };
}

function rawFromFinding(f: Finding, categoryLabel: string): RawCandidate | null {
  const id = String(f.id ?? "");
  const raw = (f.raw_excerpt ?? "").trim();
  if (raw.length < MIN_EVIDENCE_CHARS) return null;

  const layer: RawCandidate["sourceLayer"] = id.startsWith("DB_")
    ? "db_trigger"
    : id.startsWith("LEGAL_")
      ? "legal_signal"
      : "sys_check";

  const triggerId = id.startsWith("DB_") ? id.replace(/^DB_/, "") : undefined;

  let interpretationBase = "";
  if (f.user_hint?.trim() && tokenOverlapCount(f.user_hint, raw) >= 1) {
    interpretationBase = f.user_hint.trim();
  }
  const riskLine = (f.detail ?? "").match(/Risiko:\s*([^|]+)/);
  const risikoFromDetail = riskLine?.[1]?.trim() ?? "";
  if (!interpretationBase && risikoFromDetail && tokenOverlapCount(risikoFromDetail, raw) >= 1) {
    interpretationBase = risikoFromDetail;
  }
  if (!interpretationBase) {
    interpretationBase = "Bitte den zitierten Auszug im Angebots- und Ausführungskontext prüfen.";
  }
  const interpretationBaseResolved = interpretationBase;

  return {
    __rank: 1000 + Math.min(Math.abs(Number(f.penalty ?? 0)), 20),
    sourceLayer: layer,
    triggerTitle: f.title,
    triggerId,
    categoryLabel,
    severity: f.severity === "high" || f.severity === "medium" || f.severity === "low" ? f.severity : "low",
    evidenceText: raw.slice(0, 900),
    evidenceOrigin: "raw_excerpt",
    matchedKeyword: f.matched_keyword,
    interpretationBase: interpretationBaseResolved.slice(0, 400),
    userHint: f.user_hint ?? undefined,
    mergeOrigin: `finding:${f.id}`,
  };
}

function rawFromLegal(s: LegalSignal, categoryLabel: string): RawCandidate | null {
  const ev = (s.evidence[0]?.text ?? "").trim();
  if (ev.length < MIN_EVIDENCE_CHARS) return null;
  const sev = s.severity === "high" ? 3 : s.severity === "medium" ? 2 : 1;
  return {
    __rank: 850 + sev * 15 + (s.confidence ?? 0) * 25,
    sourceLayer: "legal_signal",
    ruleId: s.id,
    triggerTitle: s.title,
    categoryLabel,
    severity: s.severity,
    evidenceText: ev.slice(0, 900),
    evidenceOrigin: "legal_evidence",
    interpretationBase: s.summary,
    mergeOrigin: `legal:${s.id}`,
  };
}

function rawFromLlm(c: VortextRiskClause): RawCandidate | null {
  const ev = (c.text ?? "").trim();
  if (ev.length < MIN_EVIDENCE_CHARS) return null;
  return {
    __rank: 450 + (c.confidence ?? 0.5) * 80,
    sourceLayer: "llm",
    categoryLabel: "Vertrags-/LV-Risiken",
    severity: c.riskLevel,
    evidenceText: ev.slice(0, 900),
    evidenceOrigin: "llm_quote",
    interpretationBase: (c.interpretation ?? "").replace(/^Kategorie:\s*[^\n.]+\.\s*/i, "").trim() || "KI-gestützte Einordnung – bitte Auszug verifizieren.",
    mergeOrigin: "llm",
    triggerTitle: c.type,
  };
}

function rawFromRegex(c: VortextRiskClause): RawCandidate | null {
  const ev = (c.text ?? "").trim();
  if (ev.length < MIN_EVIDENCE_CHARS) return null;
  return {
    __rank: 360 + (c.confidence ?? 0.5) * 40,
    sourceLayer: "regex_fallback",
    categoryLabel: "Vertrags-/LV-Risiken",
    severity: c.riskLevel,
    evidenceText: ev.slice(0, 900),
    evidenceOrigin: "regex_match",
    interpretationBase: c.interpretation,
    mergeOrigin: "regex_fallback",
    triggerTitle: c.type,
  };
}

function dedupeKey(evidence: string): string {
  return normalizeFold(evidence).slice(0, 180);
}

export function mergeAndGroundVortextRisks(args: {
  fullVortext: string;
  engineFindings: Finding[];
  legalSignals: LegalSignal[];
  llm: VortextRiskClause[];
  regexFb: VortextRiskClause[];
  maxItems: number;
  categoryLabelForFinding: (cat: string) => string;
  /** Interpretations-Grounding-Metadaten pro Treffer (z. B. Admin-Debug). */
  includeInterpretationDebug?: boolean;
}): GroundingResult {
  const dropped: GroundingDropReason[] = [];
  const raws: RawCandidate[] = [];

  const { categoryLabelForFinding } = args;

  for (const f of args.engineFindings) {
    const cat = categoryLabelForFinding(String(f.category));
    const r = rawFromFinding(f, cat);
    if (!r) {
      dropped.push({
        layer: "engine",
        originalTitle: f.title,
        evidenceSnippet: (f.raw_excerpt ?? "").slice(0, 80),
        reason: "no_usable_raw_excerpt",
        triggerId: f.id.startsWith("DB_") ? f.id.replace(/^DB_/, "") : undefined,
      });
      continue;
    }
    raws.push(r);
  }

  for (const s of args.legalSignals) {
    const cat = categoryLabelForFinding(s.affectsCategories[0] ?? "vertrags_lv_risiken");
    const r = rawFromLegal(s, cat);
    if (!r) {
      dropped.push({ layer: "legal", originalTitle: s.title, reason: "no_legal_evidence" });
      continue;
    }
    raws.push(r);
  }

  for (const c of args.llm) {
    const r = rawFromLlm(c);
    if (!r) {
      dropped.push({ layer: "llm", originalTitle: c.type, reason: "llm_text_too_short" });
      continue;
    }
    raws.push(r);
  }

  for (const c of args.regexFb) {
    const r = rawFromRegex(c);
    if (!r) {
      dropped.push({ layer: "regex", originalTitle: c.type, reason: "regex_match_too_short" });
      continue;
    }
    raws.push(r);
  }

  raws.sort((a, b) => b.__rank - a.__rank);

  const seenDedupe = new Set<string>();
  const afterDedupe: RawCandidate[] = [];
  for (const r of raws) {
    const k = dedupeKey(r.evidenceText);
    if (seenDedupe.has(k)) {
      dropped.push({
        layer: r.sourceLayer,
        originalTitle: r.triggerTitle,
        evidenceSnippet: r.evidenceText.slice(0, 72),
        reason: "dedupe_same_evidence_bundle",
        triggerId: r.triggerId,
        ruleId: r.ruleId,
      });
      continue;
    }
    seenDedupe.add(k);
    afterDedupe.push(r);
  }

  const items: GroundedVortextRiskItem[] = [];
  const riskClauses: VortextRiskClause[] = [];

  for (const r of afterDedupe) {
    if (items.length >= args.maxItems) break;

    const proposedOrigin: TitleOrigin =
      r.sourceLayer === "llm"
        ? "llm"
        : r.sourceLayer === "regex_fallback"
          ? "regex_template"
          : r.sourceLayer === "legal_signal"
            ? "rule_template"
            : "rule_template";

    const g = groundTitleAndInterpretation({
      catalogTitle: r.triggerTitle ?? "Hinweis im Einleitungstext",
      evidenceText: r.evidenceText,
      matchedKeyword: r.matchedKeyword,
      categoryLabel: r.categoryLabel,
      interpretationBase: r.interpretationBase,
      userHint: r.userHint,
      layer: r.sourceLayer,
      proposedTitleOrigin: proposedOrigin,
    });

    if (!g.ok || !g.finalTitle) {
      dropped.push({
        layer: r.sourceLayer,
        originalTitle: r.triggerTitle,
        evidenceSnippet: r.evidenceText.slice(0, 100),
        reason: g.dropReason ?? "grounding_failed",
        triggerId: r.triggerId,
        ruleId: r.ruleId,
      });
      continue;
    }

    const loc = locateInFullText(args.fullVortext, r.evidenceText);
    const dedupeGroup = dedupeKey(r.evidenceText);
    const id = shortId([r.mergeOrigin, dedupeGroup, g.finalTitle]);

    const displayText = formatEvidenceForDisplay(args.fullVortext, r.evidenceText);
    const previewText = buildReadableSnippet(displayText, 120);

    const item: GroundedVortextRiskItem = {
      id,
      finalTitle: g.finalTitle,
      category: r.categoryLabel,
      severity: r.severity,
      evidenceText: r.evidenceText,
      evidenceSourceLayer: r.sourceLayer,
      evidenceStart: loc.start,
      evidenceEnd: loc.end,
      interpretation: g.interpretation,
      triggerId: r.triggerId,
      sourceRuleId: r.ruleId,
      mergeOrigin: r.mergeOrigin,
      dedupeGroup,
      titleOrigin: g.titleOrigin,
      evidenceOrigin: r.evidenceOrigin,
      previewText,
      ...(args.includeInterpretationDebug && g.interpretationDebug ? { interpretationDebug: g.interpretationDebug } : {}),
      ...(g.titleDowngradeReason ? { titleDowngradeReason: g.titleDowngradeReason } : {}),
    };
    items.push(item);

    riskClauses.push({
      type: g.finalTitle,
      riskLevel: r.severity,
      text: displayText,
      interpretation: g.interpretation,
      confidence: Math.min(0.92, 0.65 + Math.min(r.__rank, 600) * 0.00025),
      source: r.sourceLayer,
    });
  }

  return { items, dropped, riskClauses };
}
