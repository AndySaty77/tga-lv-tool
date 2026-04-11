/**
 * Nur Darstellung: Verdichtung von Rückfragen-/Angebotsklarstellungstexten für die UI.
 * Keine Business- oder Scoring-Logik.
 */

export function stripLeadingLvPhrase(s: string): string {
  return s
    .replace(/^\s*im\s+leistungsverzeichnis[^,.;:!?]*[,.\s]*/i, "")
    .replace(/^\s*im\s+lv[^,.;:!?]*[,.\s]*/i, "")
    .trim();
}

function truncateAtWord(s: string, maxLen: number, ellipsis = "…"): string {
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen - ellipsis.length);
  const sp = cut.lastIndexOf(" ");
  return (sp > maxLen * 0.45 ? cut.slice(0, sp) : cut).trim() + ellipsis;
}

/**
 * Titel für Karten: nur normalisieren; harte Kürzung nur bei untypisch langen Legacy-Strings.
 * Kurzüberschriften aus der Mapper-Schicht sollen unverändert durchgehen.
 */
export function shortenClarificationTitle(raw: string, maxLen = 220): string {
  let t = stripLeadingLvPhrase(String(raw ?? "").trim());
  if (!t) return "";
  t = t.replace(/\s+/g, " ");
  if (t.length > 14 && /^[a-zäöüß]/.test(t)) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  if (t.endsWith(".") && t.length > 20) t = t.slice(0, -1).trim();
  // Kurztitel aus der Mapper-Schicht unverändert lassen; Ellipsen nur bei untypisch langen Strings.
  return t.length > maxLen ? truncateAtWord(t, maxLen) : t;
}

/** Normalisiert Whitespace für „Relevanz“ / „Warum sinnvoll“; voller Text, nur bei extremen Längen weiche Kürzung. */
const WHY_DISPLAY_SOFT_MAX = 8000;

export function compactWhy(why: string, maxLen = WHY_DISPLAY_SOFT_MAX): string {
  const t = String(why ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.length > maxLen ? truncateAtWord(t, maxLen) : t;
}

/** Rückfrage auf 1–2 Sätze und Länge begrenzen; Doppelung mit Titel vorsichtig kürzen. */
export function compactQuestionForDisplay(question: string, title: string, maxSentences = 2, maxChars = 280): string {
  let q = stripLeadingLvPhrase(String(question ?? "").trim()).replace(/\s+/g, " ");
  if (!q) return "";
  const tit = String(title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const ql = q.toLowerCase();
  const prefixLen = Math.min(28, tit.length);
  if (tit.length >= 12 && prefixLen > 0 && ql.startsWith(tit.slice(0, prefixLen))) {
    q = q.slice(title.trim().length).replace(/^[\s.:–\-]+/, "").trim();
  }
  const sentences = q.split(/(?<=[.!?])\s+/).filter(Boolean);
  q = sentences.slice(0, maxSentences).join(" ").trim();
  if (!q) return "";
  return q.length > maxChars ? truncateAtWord(q, maxChars) : q;
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** 3–4 kompakte Prüfpunkte; lange Sätze kürzen; offensichtliche Duplikate zu Titel/Frage weglassen. */
export function normalizeClarifyPoints(
  points: string[],
  title: string,
  question: string,
  options?: { maxPoints?: number; maxLen?: number }
): string[] {
  const maxP = options?.maxPoints ?? 4;
  const maxL = options?.maxLen ?? 88;
  const t = normKey(title);
  const q = normKey(question);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of points ?? []) {
    let p = String(raw ?? "").trim().replace(/\s+/g, " ");
    if (!p) continue;
    if (p.length > maxL) p = truncateAtWord(p, maxL);
    const pn = normKey(p);
    if (pn.length < 6) continue;
    if (seen.has(pn)) continue;
    if (t && (pn === t || (t.length > 20 && t.startsWith(pn)) || (pn.length > 20 && pn.startsWith(t.slice(0, Math.min(32, t.length)))))) continue;
    if (q && pn.length > 15 && q.includes(pn)) continue;
    seen.add(pn);
    const readsAsSentence = /\b(ist|sind|wird|werden|bitte|prüfen|muss|soll|kann|haben|hat)\b/i.test(p);
    if (readsAsSentence && !/[.!?…]$/.test(p)) p += ".";
    out.push(p);
    if (out.length >= maxP) break;
  }
  return out;
}

/** Angebotsklarstellung: 1–2 Sätze, Länge begrenzen. */
export function compactOfferClarificationBody(text: string, maxSentences = 2, maxChars = 270): string {
  let s = stripLeadingLvPhrase(String(text ?? "").trim()).replace(/\s+/g, " ");
  if (!s) return "";
  const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
  s = parts.slice(0, maxSentences).join(" ").trim();
  return s.length > maxChars ? truncateAtWord(s, maxChars) : s;
}

export function compactOfferScopeNote(note: string, maxChars = 160): string {
  const s = stripLeadingLvPhrase(String(note ?? "").trim()).replace(/\s+/g, " ");
  if (!s) return "";
  const first = s.split(/(?<=[.!?])\s+/)[0] ?? s;
  return first.length > maxChars ? truncateAtWord(first, maxChars) : first.trim();
}
