/**
 * Nutzertaugliche Prüfhinweise aus `triggers.user_hint` / Finding-Feldern.
 * Nur Anzeige-Logik – keine Scoring-/Engine-Auswirkung.
 *
 * Risiko-Tab: eigene Präsentation (Finding-Titel + originalnahe user_hint),
 * bewusst ohne Rückfragen-/Angebots-Headline-Logik.
 */

import { stripBureaucraticLead, whyFromHintAndCategory } from "./commercialCopyFromHints";

export const MAX_PRUEF_HINWEISE_STANDARD = 3;

/** Ab dieser Länge wird ein einzelner Prüfhinweis weich an Wortgrenzen gekürzt (nur Darstellung). */
const MAX_PRUEF_HINWEIS_CHARS = 2000;

function normalizeHintKey(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Dedupliziert nach normalisiertem Text; behält jeweils die erste Originalform. */
export function dedupeUserHints(candidates: (string | null | undefined)[], max: number = MAX_PRUEF_HINWEISE_STANDARD): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const t = typeof c === "string" ? c.trim() : "";
    if (!t) continue;
    const k = normalizeHintKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

type FindingHintFields = {
  user_hints?: string[] | null;
  user_hint?: string | null;
};

/**
 * Liste für Standard-UI / PDF / Bericht: bevorzugt `user_hints`, sonst einzelnes `user_hint`.
 */
export function collectPruefHinweiseFromFinding(f: FindingHintFields, max: number = MAX_PRUEF_HINWEISE_STANDARD): string[] {
  if (Array.isArray(f.user_hints) && f.user_hints.length > 0) {
    return dedupeUserHints(f.user_hints, max);
  }
  return dedupeUserHints([f.user_hint], max);
}

export type FindingForRiskTab = FindingHintFields & {
  title?: string;
  category?: string;
};

function normalizeFindingTitle(s: string | undefined): string {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Entfernt am Textanfang wiederholt: Punkte, Bullets, Gedankenstriche inkl. Kombination mit Leerzeichen (z. B. „. Das ist …“). */
function stripLeadingDotBulletArtifacts(s: string): string {
  let t = s;
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/^[\s\u00A0]*(?:[.•·‧\u2022\u2023\u2043*\-–—…])+[\s\u00A0]*/u, "");
  }
  return t;
}

/**
 * Leichte Bereinigung von user_hint: keine Umformulierung, keine Rückfragen-Sprache.
 */
export function lightCleanUserHintForRiskTab(raw: string): string {
  let t = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!t) return "";
  t = stripLeadingDotBulletArtifacts(t);
  t = t.replace(/^[•\-\u2022\*]+\s*/gm, "");
  t = stripBureaucraticLead(t);
  t = stripLeadingDotBulletArtifacts(t);
  t = t.replace(/[ \t\f\v]+/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return stripLeadingDotBulletArtifacts(t.trim());
}

function truncateAtWordBoundary(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars - 1);
  const sp = cut.lastIndexOf(" ");
  const out = (sp > maxChars * 0.4 ? cut.slice(0, sp) : cut).trim();
  return out + "…";
}

/** Listen-Titel Risiko-Tab: am Finding/Trigger ausgerichtet, nicht an Handels-Kurzüberschriften. */
function riskTabListenTitel(f: FindingForRiskTab): string {
  const titel = normalizeFindingTitle(f.title);
  if (titel) return titel;
  const hints = collectPruefHinweiseFromFinding(f, 1);
  if (hints[0]) return truncateAtWordBoundary(lightCleanUserHintForRiskTab(hints[0]), 120);
  return "Treffer";
}

/**
 * Darstellung nur für den Risiko-Tab: Finding-Titel, user_hint(s) originalnah, Relevanz getrennt.
 * Keine buildClarificationHeadline / Angebots-Titel-Logik.
 */
export function riskTabFindingPresentation(f: FindingForRiskTab): {
  /** Zeile 1: Trigger- / Finding-Titel (wie in den Daten) */
  kurztitel: string;
  /** Gleich wie `title` aus dem Finding; für optionale zweite Zeile nur bei künftiger Erweiterung */
  triggerLabel: string;
  /** Ein Eintrag pro user_hint (leicht bereinigt, max. Länge begrenzt) */
  pruefhinweise: string[];
  /** Kurzer Kontext aus derselben why-Familie wie Rückfragen – nur Relevanz, nicht als Titel genutzt */
  mehrwert: string;
} {
  const hints = collectPruefHinweiseFromFinding(f, MAX_PRUEF_HINWEISE_STANDARD);
  const hintPrimary = hints[0] ?? "";
  const cat = f.category;
  const kurztitel = riskTabListenTitel(f);
  const triggerLabel = normalizeFindingTitle(f.title);
  const pruefhinweise = hints
    .map((h) => lightCleanUserHintForRiskTab(h))
    .filter(Boolean)
    .map((h) => (h.length > MAX_PRUEF_HINWEIS_CHARS ? truncateAtWordBoundary(h, MAX_PRUEF_HINWEIS_CHARS) : h));
  const mehrwert = hintPrimary ? whyFromHintAndCategory(hintPrimary, cat) : "";
  return { kurztitel, triggerLabel, pruefhinweise, mehrwert };
}
