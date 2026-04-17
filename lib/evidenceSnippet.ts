/**
 * Lesbare Belegtexte für UI: Wort-/Satzgrenzen, keine Darstellung mitten im Wort.
 * Nur Darstellung – keine Scoring-/Grounding-Logik.
 */

function normalizeFold(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function isWordChar(ch: string): boolean {
  if (!ch) return false;
  return /[\p{L}\p{N}]/u.test(ch);
}

/** Whitespace und Zeilenumbrüche für Fließtext-Vorschau glätten. */
export function collapseWhitespaceDisplay(s: string): string {
  return (s ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Faltung wie normalizeFold, mit Index-Mapping: folded[i] stammt von fullText[foldToOrigStart[i]]. */
function buildFoldMap(fullText: string): { folded: string; foldToOrigStart: number[] } {
  const foldToOrigStart: number[] = [];
  let folded = "";
  for (let i = 0; i < fullText.length; ) {
    const cp = fullText.codePointAt(i)!;
    const w = cp > 0xffff ? 2 : 1;
    const origStart = i;
    i += w;
    const seg = String.fromCodePoint(cp);
    for (const c of seg.normalize("NFD")) {
      if (/\p{M}/u.test(c)) continue;
      foldToOrigStart.push(origStart);
      folded += c.toLowerCase();
    }
  }
  return { folded, foldToOrigStart };
}

/**
 * Sucht needle im Volltext per identischer Faltung; liefert Original-Indizes [start, end) oder null.
 * Behebt den Fehler, bei dem indexOf auf gefaltetem String ohne Mapping geschnitten wurde.
 */
function findFoldedRangeInFullText(fullText: string, needle: string): { start: number; end: number } | null {
  if (!needle || !fullText) return null;
  const { folded, foldToOrigStart } = buildFoldMap(fullText);
  const n = normalizeFold(needle);
  if (!n) return null;
  const idx = folded.indexOf(n);
  if (idx < 0) return null;
  const endFold = idx + n.length;
  if (idx >= foldToOrigStart.length) return null;
  const origStart = foldToOrigStart[idx];
  const origEnd =
    endFold < foldToOrigStart.length ? foldToOrigStart[endFold] : fullText.length;
  return { start: origStart, end: origEnd };
}

function stripOuterPunct(tok: string): string {
  return tok.replace(/^[\s"'„‚«»(•\-–\[\u2026]+|[\s"':.;,!?)\]\u2026]+$/gu, "");
}

/**
 * Verdächtige Anfänge nach hartem Fensterschnitt (kein Wörterbuch; nur robuste Muster).
 */
function isSuspiciousLeadingToken(core: string, hasFollowing: boolean): boolean {
  if (!core) return false;
  const coreN = normalizeFold(core);
  if (/^\d{1,2}$/.test(core) && hasFollowing) return true;
  if (/^ch[a-zäöüß]{3,}$/iu.test(core)) return true;
  if (/^inderung$/u.test(coreN)) return true;
  if (/^kW\)?$/iu.test(core)) return true;
  if (/^mW\)?$/iu.test(core)) return true;
  if (/^\d+kW\)?$/iu.test(core)) return true;
  return false;
}

function isSuspiciousTrailingToken(core: string, hasPreceding: boolean): boolean {
  if (!core) return false;
  const coreN = normalizeFold(core);
  if (/^\d{1,2}$/.test(core) && hasPreceding) return true;
  if (/^inderung$/u.test(coreN) && hasPreceding) return true;
  if (/^kW\)?$/iu.test(core)) return true;
  if (/^mW\)?$/iu.test(core)) return true;
  if (/^\d+kW\)?$/iu.test(core)) return true;
  if (/^\([^)]*$/u.test(core)) return true;
  return false;
}

export type FragmentClipResult = {
  text: string;
  clippedStart: boolean;
  clippedEnd: boolean;
};

/**
 * Entfernt führende/schließende Token, die typischerweise Fensterfragmente sind.
 * Bei Entfernen: clippedStart/clippedEnd für Ellipsis-Kennzeichnung.
 */
export function stripFragmentTokenEdges(text: string, depth = 0): FragmentClipResult {
  const base = collapseWhitespaceDisplay(text);
  if (!base) return { text: "", clippedStart: false, clippedEnd: false };
  if (depth > 14) return { text: base, clippedStart: false, clippedEnd: false };

  let parts = base.split(/\s+/).filter((p) => p.length > 0);
  let clippedStart = false;
  let clippedEnd = false;
  const maxPasses = parts.length + 4;

  for (let pass = 0; pass < maxPasses && parts.length; pass++) {
    const core = stripOuterPunct(parts[0]!);
    if (!core) {
      parts.shift();
      clippedStart = true;
      continue;
    }
    if (!isSuspiciousLeadingToken(core, parts.length > 1)) break;
    parts.shift();
    clippedStart = true;
  }

  for (let pass = 0; pass < maxPasses && parts.length; pass++) {
    const core = stripOuterPunct(parts[parts.length - 1]!);
    if (!core) {
      parts.pop();
      clippedEnd = true;
      continue;
    }
    if (!isSuspiciousTrailingToken(core, parts.length > 1)) break;
    parts.pop();
    clippedEnd = true;
  }

  let out = parts.join(" ").trim();

  if (!out && base) {
    const t = base.split(/\s+/).filter(Boolean);
    if (t.length > 1) {
      const rest = t.slice(1).join(" ").trim();
      const again = stripFragmentTokenEdges(rest, depth + 1);
      return {
        text: again.text,
        clippedStart: true || again.clippedStart,
        clippedEnd: clippedEnd || again.clippedEnd,
      };
    }
    if (t.length === 1 && isSuspiciousLeadingToken(stripOuterPunct(t[0]!), false)) {
      return { text: "", clippedStart: true, clippedEnd };
    }
  }

  if (!out && base) {
    const sp = base.indexOf(" ");
    if (sp > 0) {
      out = base.slice(sp + 1).trim();
      clippedStart = true;
    } else {
      out = base;
    }
  }

  return { text: out, clippedStart, clippedEnd };
}

/**
 * Start nicht mitten im Wort: sehr kurzes Konsonantenstück ohne Vokal am Anfang entfernen.
 */
export function trimToWordBoundaryStart(text: string): string {
  let s = text.trim();
  if (!s) return s;

  const sp = s.search(/\s/u);
  const firstWord = sp === -1 ? s : s.slice(0, sp);
  if (sp > 0 && firstWord.length <= 3 && !/[aeiouäöüAEIOUÄÖÜ]/.test(firstWord)) {
    s = s.slice(sp).trim();
  }
  return s;
}

/**
 * Ende nicht mitten im Wort: hängende Buchstaben-/Ziffernfolge am Ende abschneiden.
 */
export function trimToWordBoundaryEnd(text: string): string {
  let s = text.trimEnd();
  if (!s) return s;
  let e = s.length;
  while (e > 0 && isWordChar(s[e - 1])) e--;
  if (e === 0) return s;
  s = s.slice(0, e);
  return s.replace(/\s+$/u, "").trimEnd();
}

/** Einheitliche Bereinigung für alle sichtbaren Belegpfade (Karte, Modal, API-Text). */
export function normalizeEvidenceDisplayString(text: string): string {
  const { text: stripped, clippedStart, clippedEnd } = stripFragmentTokenEdges(text);
  let s = trimToWordBoundaryEnd(trimToWordBoundaryStart(stripped));
  if (!s) return stripped;
  if (clippedStart) s = `… ${s}`;
  if (clippedEnd) s = `${s} …`;
  return s.trim();
}

const MAX_WORD_PULL = 512;

/**
 * Beleg im vollen Vortext einbetten: Fenster an Wortgrenzen im Original erweitern.
 */
export function expandEvidenceInContext(
  fullText: string,
  excerpt: string,
  _maxExtend = 40
): string {
  const ex = excerpt.trim();
  if (!ex) return "";
  if (!fullText.trim()) return ex;

  const needleLen = Math.min(56, ex.length);
  let idx = -1;
  let matchEndOrig = -1;

  for (let L = needleLen; L >= 20; L -= 2) {
    const needle = ex.slice(0, L);
    const direct = fullText.indexOf(needle);
    if (direct >= 0) {
      idx = direct;
      matchEndOrig = direct + needle.length;
      break;
    }
    const foldedHit = findFoldedRangeInFullText(fullText, needle);
    if (foldedHit) {
      idx = foldedHit.start;
      matchEndOrig = foldedHit.end;
      break;
    }
  }

  if (idx < 0) return ex;

  const end0 = Math.min(fullText.length, idx + ex.length);
  const alignEnd = Math.max(end0, matchEndOrig);
  let start = idx;
  let end = Math.min(fullText.length, alignEnd);

  while (start > 0 && isWordChar(fullText[start - 1]) && idx - start < MAX_WORD_PULL) {
    start--;
  }
  while (end < fullText.length && isWordChar(fullText[end]) && end - end0 < MAX_WORD_PULL) {
    end++;
  }

  return fullText.slice(start, end);
}

export type ReadableSnippetOptions = {
  preferSentence?: boolean;
  ellipsis?: string;
};

/**
 * Kurzvorschau: max. maxLen Zeichen, Schnitt an Satz- oder Wortgrenze, Ellipsis nur bei Längenkürzung.
 */
export function buildReadableSnippet(
  text: string,
  maxLen: number,
  options: ReadableSnippetOptions = {}
): string {
  const ellipsis = options.ellipsis ?? "…";
  const preferSentence = options.preferSentence !== false;
  const normalized = normalizeEvidenceDisplayString(text);
  const t = normalized.replace(/\n/g, " ");
  if (!t) return t;
  if (maxLen < 8) return t.slice(0, maxLen);
  if (t.length <= maxLen) return trimToWordBoundaryEnd(trimToWordBoundaryStart(t));

  const budget = maxLen - ellipsis.length;
  if (budget < 6) return t.slice(0, maxLen);

  let cut = budget;
  const minCut = Math.max(8, Math.floor(budget * 0.55));

  if (preferSentence) {
    const slice = t.slice(0, budget + 1);
    const sentenceEnds = [...slice.matchAll(/[.!?](?:\s|$)/gu)];
    for (let i = sentenceEnds.length - 1; i >= 0; i--) {
      const pos = (sentenceEnds[i].index ?? 0) + 1;
      if (pos >= minCut && pos <= budget) {
        cut = pos;
        break;
      }
    }
  }

  if (cut === budget) {
    const slice = t.slice(0, budget);
    let sp = slice.lastIndexOf(" ");
    if (sp >= minCut) cut = sp;
  }

  let out = t.slice(0, cut).trimEnd();
  out = trimToWordBoundaryEnd(out);
  if (out.length >= t.length) return trimToWordBoundaryStart(t);
  return `${out}${ellipsis}`;
}

/**
 * Vollständiger Beleg für Karte/Modal: Kontext aus Vortext, dann harte Fragment-Bereinigung.
 */
export function formatEvidenceForDisplay(fullVortext: string, excerpt: string): string {
  const expanded = expandEvidenceInContext(fullVortext, excerpt, 40);
  return normalizeEvidenceDisplayString(expanded);
}

/**
 * Modal-Body: gleiche Pipeline wie übrige Belegdarstellung.
 */
export function formatEvidenceModalBody(text: string): string {
  return normalizeEvidenceDisplayString(text);
}
