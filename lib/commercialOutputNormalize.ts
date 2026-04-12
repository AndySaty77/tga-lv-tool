/**
 * Zentrale Verdichtung von Rückfragen und Angebotsklarstellungen für UI/PDF.
 * Keine Analyse-Engine – nur Darstellung, Deduplizierung, Qualitätsfilter.
 */

import { normalizeForCompare, textSimilarity } from "./changePotentialCommercialActions";

const PRIORITY_QUESTION_CAP = 18;
const PRIORITY_CLARIFICATION_CAP = 12;

/** Themen-Buckets: führende Einträge pro Cluster (nicht „topic_other“) werden zusammengeführt. */
const TOPIC_BUCKET_RULES: Array<{ re: RegExp; bucket: string }> = [
  {
    re: /nebenleistung|\binkl\.|\binkl\b|inklusive|pauschal\s*\/\s*inkl|pauschal.*inkl/i,
    bucket: "topic_nebenleistungen",
  },
  { re: /vertragsklausel|pönale|poenale|vertragsstrafe|bonität|bonitaet/i, bucket: "topic_vertrag" },
  { re: /bauzeit|bauabschnitt|bauphase|terminplan|fertigstellungstermin/i, bucket: "topic_zeit" },
  { re: /brandschutz|brandschot|abschott|durchdring|schottung|brandabschnitt|rauch|feuerwiderstand/i, bucket: "topic_brandschutz" },
  {
    re: /inbetrieb|inbetriebnahme|ibn\b|funktionsprüf|funktionspruef|abnahme.*protokoll|nutzungsübergabe|nutzungsuebergabe|übergabeprotokoll|uebergabeprotokoll|instandhalt|wartungsbuch|betriebshandbuch/i,
    bucket: "topic_ibn_abnahme",
  },
  {
    re: /vorleistung|bauseit|nachbar|benachbart|nachbargewerk|schnittstellen|übergabe|uebergabe|gewerk.*grenz|fremdgewerk|koordination.*gewerk|leistungsgrenz|mitwirkung|übergabepunkt|uebergabepunkt|anschluss.*fremd/i,
    bucket: "topic_schnittstelle",
  },
  {
    re: /dokumentation|nachweis|prüfpflicht|pruefpflicht|logbuch|prüfumfang|pruefumfang|prüf.*nachweis|pruef.*nachweis|vde|dguv/i,
    bucket: "topic_doku",
  },
  { re: /mengen|aufmaß|aufmas|mehrmenge|mindermenge|dimensionierung|massenermittlung|flächenleistung|flaechenleistung|leistungsdichte/i, bucket: "topic_mengen" },
  {
    re: /bestand|bestandsunterlage|bestandslage|bestandssituation|abbruch|anpassung|altbau|bestehend|bestandsdaten|ist-.*zustand|istzustand/i,
    bucket: "topic_bestand",
  },
  { re: /wärmepumpe|waermepumpe|wp\b|elektro.*anschluss|regelung|msr\b|kälte|kaelte|hkvs|heizung|lüftung|lueftung/i, bucket: "topic_tga_system" },
];

function inferTopicBucket(text: string): string {
  const t = text ?? "";
  for (const r of TOPIC_BUCKET_RULES) {
    if (r.re.test(t)) return r.bucket;
  }
  return "topic_other";
}

const CASUAL_OR_RAW_PATTERNS: RegExp[] = [
  /\bliegt bei dir\b/i,
  /\bbei dir\b/i,
  /\bbei euch\b/i,
  /\bmal gucken\b/i,
  /\bliegt bei Ihnen\b.*\bdu\b/i,
  /\bwird'?s teuer\b/i,
  /\bwird teuer\b/i,
  /\bwird teurer\b/i,
  /\bcheck mal\b/i,
  /\bdinge?\b.*\bpassiert\b/i,
  /\bpasst schon\b/i,
  /\bkein stress\b/i,
  /\btypisch halt\b/i,
  /\bpeinlich\b/i,
  /\bquick\s*and\s*dirty\b/i,
  /\bintern:\s*/i,
  /\broh(entwurf)?\b/i,
  /\bhalbwahrheit\b/i,
  /\bgeht so\b/i,
  /\bkein bock\b/i,
  /\bblöd(e)?\b/i,
  /\bblödsinn\b/i,
  /\btrigger(?:-fire|firing)?\b/i,
  /\bfinding\s*[#:]?\s*\d+/i,
  /\bprompt\s*[-–:]?\s*rest\b/i,
  /\bplaceholder\b/i,
  /\btbd\s*[:=]/i,
];

/** Halbsätze / interne Kurzsprache: Zeile verworfen wenn getroffen. */
const REJECT_LINE_PATTERNS: RegExp[] = [
  /^\s*evtl\.?\s*$/i,
  /^\s*tbd\.?\s*$/i,
  /^\s*n\.?\s*a\.?\s*$/i,
  /\bdu musst\b/i,
  /\bihr müsst\b/i,
  /\bdu solltest\b/i,
  /\bmal sehen\b/i,
  /^\s*gg?f\.?\s*[.:–-]?\s*$/i,
  /^\s*bitte\s+(noch|kurz)\s*[.:]?\s*$/i,
  /\bkostet extra\b/i,
  /\bauf eigene faust\b/i,
  /\bwir\s+gehen\s+davon\s+aus\s+dass\s+abgrenzen\b/i,
  /\bunser\s+angebot\s+umfasst\s+nur\s+die\s+abgrenzen\b/i,
  /\bdass\s+abgrenzen\b/i,
  /\b(nur|die)\s+die\s+abgrenzen\b/i,
];

const GENERIC_CLARIFICATION_SUBSTRINGS: RegExp[] = [
  /^unsere kalkulation berücksichtigt die offene rückfrage/i,
  /^unsere kalkulation berücksichtigt/i,
  /^unsere kalkulation bezieht sich/i,
  /^unser angebot berücksichtigt/i,
  /^unser angebot bezieht sich/i,
  /^unser preisansatz berücksichtigt/i,
  /^unser leistungsumfang/i,
  /weitergehende oder nicht eindeutig beschriebene anforderungen/i,
  /nicht eindeutig beschriebene leistungen/i,
  /nur insoweit,?\s*wie sie sich aus dem leistungsverzeichnis/i,
  /nur insoweit,?\s*wie.*ohne weitere klarstellung/i,
  /soweit.*ohne weitere klarstellung zum üblichen verständnis ergibt/i,
  /zum üblichen verständnis des leistungsverzeichnisses/i,
  /nicht leistungsbestandteil\.?\s*$/i,
  /soweit nicht ausdrücklich/i,
  /fehlende angaben.*nicht.*angerechnet/i,
];

export function stripCasualOrInternalPhrasing(text: string): string {
  let t = (text ?? "").replace(/\s+/g, " ").trim();
  for (const p of CASUAL_OR_RAW_PATTERNS) {
    t = t.replace(p, " ").replace(/\s+/g, " ").trim();
  }
  return t.trim();
}

export function guardCommercialUserFacingText(text: string, minLen = 14): string {
  let t = stripCasualOrInternalPhrasing(text);
  t = t.replace(/\s*…\s*$/, "").replace(/\s*\.\.\.\s*$/, "").trim();
  for (const p of REJECT_LINE_PATTERNS) {
    if (p.test(t)) return "";
  }
  if (t.length < minLen) return "";
  if (/^[,;:\-–—]+$/.test(t)) return "";
  const lower = t.toLowerCase();
  if ((lower.match(/\b(und|oder)\b/g) ?? []).length >= 4 && t.length < 50) return "";
  if (t.length < 42 && !/[.!??:]$/.test(t) && /\b(du|euch|dir|mal|irgendwie|so ungefähr)\b/i.test(t)) return "";
  if (/^(falls|sofern|wenn)\s+[^.!?]{0,80}$/i.test(t) && t.length < 55) return "";
  if (/\b(und|oder|sowie)\s+(abgrenzen|klären|prüfen|konkretisieren|bestätigen|festlegen)\s*$/i.test(t)) return "";
  if (/\b(konkretisierungen|konkretisierung)\s+und\s+abgrenzen\b/i.test(t)) return "";
  if (/\b(nur|die)\s+die\s+abgrenzen\b/i.test(t)) return "";
  if (/\bwir\s+gehen\s+davon\s+aus\s+dass\b/i.test(t) && t.length < 90) return "";
  return t;
}

/** Harte Titel-Glättung für Rückfragen (keine zerstückelten / abgeschnittenen Überschriften). */
const TITLE_BROKEN_PATTERNS: RegExp[] = [
  /\bzu benachbarten klären\b/i,
  /\bWelche Anpassungen am klären\b/i,
  /\bPrüfumfang und oft prüfen\b/i,
  /kann zu Mengen- und klären\b/i,
  /\b vor Welche\b/i,
  /\bam klären\b/i,
  /\bzu klären\s*$/i,
  /\bzu prüfen\s*$/i,
  /\bzu konkretisieren\s*$/i,
  /\s(und|oder)\s+klären\s*$/i,
  /\s(und|oder)\s+prüfen\s*$/i,
  /^\s*Welche\s+.+\s+zu\s*$/i,
  /\bDimensionierung kann zu\b/i,
  /\bMengen- und klären\b/i,
  /\b und oft prüfen\b/i,
  /\bWelche\s+.+\s+und Grenzen zu\b/i,
  /\bUnterlagen vor Welche\b/i,
  /\s+zu\s+benachbarten\s*$/i,
  /^\s*Welche\s+.+\s+(und|oder)\s*$/i,
  /\b(oft|zu)\s+klären\s*$/i,
  /\b\/\s*Bau\s+oft\s+klären\b/i,
  /\bSchnittstelle\s+.+\s+oft\s+klären\b/i,
  /\b(und|oder)\s+abgrenzen\s*$/i,
  /\b(konkretisierungen|konkretisierung)\s+und\s+abgrenzen\b/i,
  /\b(nur|umfasst)\s+die\s+abgrenzen\b/i,
  /\bdass\s+abgrenzen\b/i,
  /\b(oft\s+unklar|oft\s+unklar\.?)\s*$/i,
  /\bals\s+zusätzliche\s+abgrenzen\b/i,
  /\bkönnen\s+zu\s+Mehrkosten\s+abgrenzen\b/i,
  /\bUnklare\s+Dokumentationspflichten\s+können\s+als\b/i,
  /^Bitte konkretisieren Sie:/i,
  /\bKann\s+Bauablauf-\s*oder\s+Abgrenzungsrisiko\s+bedeuten\b/i,
  /\bfür\s+nicht\s+bese/i,
  /\bZusatzleistunge/i,
  /\bnicht\s+bese/i,
];

const TITLE_JUNK_PREFIX = /^(?:Welche\s+(?:Anpassungen|Vorleistungen|Unterlagen)\s+vor\s+)/i;

/** Roh-Titel oder abgeleiteter Titel: bei Treffer nicht anzeigen, auf Fließtext/Thema wechseln (keine Reparatur). */
const TITLE_HARD_REJECT: RegExp[] = [
  /\bkönnen\s+als\s+zusätzliche\s+abgrenzen\b/i,
  /\bkönnen\s+als\s+zusätzliche\b/i,
  /\bals\s+zusätzliche\s+abgrenzen\b/i,
  /\bnur\s+Anlagen\s+der\s+Position\s+prüfen\b/i,
  /\bAnlagen\s+der\s+Position\s+prüfen\b/i,
  /\boft\s+klären\b/i,
  /\bpauschal\s+formuliert\s+prüfen\b/i,
  /\bfehlender\s+key\s*fact\b/i,
  /\bfehlender\s+keyfact\b/i,
  /Mehrere\s+weiche\s+Formulierungen\s*[→\u2192]/i,
  /\bweiche\s+formulierungen\s*[→\u2192]/i,
  /\bUnklare\s+Dokumentationspflichten\s+können\b/i,
  /\bUmfang\s+Einregulierung\b.*\bPosition\s+prüfen\b/i,
];

const RE_DEDUPE_TRAILING_VERBS =
  /(\s+(klären|prüfen|abgrenzen|konkretisieren|bestätigen|festlegen))(?:\s+\2)+$/gi;

/** Befund-/Pipeline-Reste: gehören in den Fließtext, nicht in die Überschrift. */
function stripFindingResidueFromTitle(s: string): string {
  let t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return t;
  t = t.replace(/\s*(?:→|\u2192|->)\s*Nachtragspotenzial\b.*$/i, "").trim();
  t = t.replace(/\b→\s*Nachtragspotenzial\b/gi, "").trim();
  t = t.replace(/\bFehlender\s+KeyFact:?\s*/gi, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\bpauschal\s+formuliert\b/gi, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\bMehrere weiche Formulierungen\b/gi, "Weiche Formulierungen");
  t = t.replace(/\s+oft\s+(klären|prüfen|abgrenzen|konkretisieren|bestätigen|festlegen)\b/gi, " $1");
  t = t.replace(/\s+oft\s+/gi, " ").replace(/\s+/g, " ").trim();
  t = t.replace(
    /\s+unklar\.?\s+(klären|prüfen|abgrenzen|konkretisieren|bestätigen|festlegen)\b/gi,
    " $1",
  );
  t = t.replace(/\s+unklar\.?\s*$/i, "").trim();
  t = t.replace(
    /\s*(?:→|\u2192|->)\s*(klären|prüfen|abgrenzen|konkretisieren|bestätigen|festlegen)\s*$/i,
    " $1",
  );
  return t.replace(/\s+/g, " ").trim();
}

/** Mehrfach angehängte Verben am Ende entfernen (idempotent bei einmaligem Aufruf). */
function dedupeTrailingVerbs(s: string): string {
  let t = s.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 10; i++) {
    const next = t.replace(RE_DEDUPE_TRAILING_VERBS, "$1");
    if (next === t) break;
    t = next;
  }
  return t.trim();
}

/** Explizit sauberer Roh-Titel: keine Befund-Reparatur, nur Whitespace und doppelte Endverben. */
function finalizeExplicitTitle(s: string): string {
  let t = s.replace(/\s+/g, " ").trim();
  t = dedupeTrailingVerbs(t);
  if (!t) return t;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return capTitleAtWord(t, 88);
}

/** Aus Fließtext oder Fallback: Reste strippen, wie bisher final glätten. */
function finalizeDerivedTitle(s: string): string {
  let t = stripFindingResidueFromTitle(s);
  t = dedupeTrailingVerbs(t);
  if (!t) return t;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  t = capTitleAtWord(t, 88);
  return dedupeTrailingVerbs(stripFindingResidueFromTitle(t));
}

function titleMatchesHardReject(s: string): boolean {
  return TITLE_HARD_REJECT.some((re) => re.test(s));
}

function isExplicitCleanTitle(raw: string): boolean {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(TITLE_JUNK_PREFIX, "").trim();
  if (s.length < 10 || s.length > 94) return false;
  if (titleMatchesHardReject(s)) return false;
  for (const p of TITLE_BROKEN_PATTERNS) {
    if (p.test(s)) return false;
  }
  if (titleAppearsTruncatedOrCorrupt(s)) return false;
  if (titleIsExplanatoryProse(s)) return false;
  if (titleEndsWithBrokenInfinitive(s)) return false;
  if (/\s und\s und\s/i.test(s)) return false;
  if (/\b(zu|für|mit)\s*$/i.test(s)) return false;
  if (
    /\b(abgrenzen|klären|prüfen|konkretisieren|bestätigen|festlegen)\s*\.?$/i.test(s) &&
    s.length < 100
  ) {
    const before = s
      .replace(/\s*(abgrenzen|klären|prüfen|konkretisieren|bestätigen|festlegen)\s*\.?$/i, "")
      .trim();
    if (before.length < 22 || /\b(zu|am|beim|für|und|oder|oft|die|nur|dass|als|können)\s*$/i.test(before)) {
      return false;
    }
  }
  return true;
}

export type CommercialTitleRole = "question" | "clarification";

/** Erster Satz / Fragekern → fester Kurztitel (Primärquelle statt kaputtem Roh-Titel). */
function mapOpeningSentenceToTitle(sentence: string, role: CommercialTitleRole): string | null {
  const t = sentence.replace(/\s+/g, " ").trim();
  if (!t || titleMatchesHardReject(t)) return null;
  if (/^Unklare\s+Dokumentationspflichten\b/i.test(t)) {
    return role === "clarification" ? "Dokumentationspflichten abgrenzen" : "Dokumentationspflichten klären";
  }
  if (/^(?:Nicht\s+beschriebene|Beschriebene)\s+Erschwernisse\b/i.test(t)) {
    return role === "clarification" ? "Erschwernisse und Mehrkosten abgrenzen" : "Erschwernisse und Mehrkosten klären";
  }
  if (/^Schnittstelle\s+Lüftung\s*\/\s*Bau\b/i.test(t) || /Schnittstelle.*Lüftung.*\/\s*Bau/i.test(t) || /Lüftung\s*\/\s*Bau.*unklar/i.test(t)) {
    return role === "clarification" ? "Schnittstelle Lüftung/Bau abgrenzen" : "Schnittstelle Lüftung/Bau klären";
  }
  if (/spül|reinigungsumfang/i.test(t)) {
    return role === "clarification" ? "Spül- und Reinigungsumfang abgrenzen" : "Spül- und Reinigungsumfang prüfen";
  }
  if (/mehrere\s+weiche\s+formulierungen|weiche\s+formulierungen\s*[→\u2192]/i.test(t)) {
    return role === "clarification" ? "Weiche Formulierungen abgrenzen" : "Weiche Formulierungen klären";
  }
  if (/IBN|Abnahme|Inbetriebnahme/i.test(t) && /Nachforderungen|Zusatzleistung|Mehrkosten/i.test(t)) {
    return role === "clarification" ? "Inbetriebnahme und Abnahme abgrenzen" : "Inbetriebnahme und Abnahme klären";
  }
  if (/\bvertragsklausel\b|\bpönale\b|\bpoenale\b|\bvertragsstrafe\b/i.test(t)) {
    return role === "clarification" ? "Vertragsklausel und Risiken abgrenzen" : "Vertragsklausel prüfen";
  }
  if (/Vertragsklausel|Pönale|Poena/i.test(t) && /Auftraggeber|Kosten/i.test(t)) {
    return role === "clarification" ? "Vertragskosten und Klauselrisiken abgrenzen" : "Kostenrisiko aus Vertragsklausel klären";
  }
  return null;
}

function derivePrimaryTitleFromBody(body: string, role: CommercialTitleRole): string {
  const full = stripTitleInternalPrefixes((body ?? "").replace(/\s+/g, " ").trim());
  if (!full || full.length < 12) return "";

  const qIdx = full.indexOf("?");
  if (qIdx >= 18 && qIdx <= 140) {
    const question = full.slice(0, qIdx + 1).trim();
    if (
      !titleMatchesHardReject(question) &&
      !titleAppearsTruncatedOrCorrupt(question) &&
      !titleEndsWithBrokenInfinitive(question) &&
      question.split(/\s+/).length <= 24 &&
      question.length <= 96
    ) {
      return capTitleAtWord(question.charAt(0).toUpperCase() + question.slice(1), 92);
    }
  }

  const first = (full.split(/[.!?]/)[0] ?? full).trim();
  const firstClean = stripTitleInternalPrefixes(first).replace(/\s+/g, " ").trim();
  if (!firstClean) return "";

  const mapped = mapOpeningSentenceToTitle(firstClean, role);
  if (mapped) return mapped;

  let frag = stripFindingResidueFromTitle(firstClean);
  frag = frag.replace(/\s+(abgrenzen|klären|prüfen|konkretisieren|bestätigen|festlegen)\s*\.?$/i, "").trim();
  if (frag.length < 18) return "";
  if (titleMatchesHardReject(frag)) return "";
  if (titleIsExplanatoryProse(frag) || titleAppearsTruncatedOrCorrupt(frag)) return "";
  if (/\b(zu|für|mit|und|oder|als|dass|die|nur|können)\s*$/i.test(frag)) return "";
  if (/\b(abgedeckt|geplant)\s*$/i.test(frag)) return "";
  return capTitleAtWord(frag.charAt(0).toUpperCase() + frag.slice(1), 72);
}

const WEAK_KEYFACT_TITLE_FALLBACK: Record<string, string> = {
  bauzeit: "Bauzeit klären",
  baubeginn: "Baubeginn klären",
  bindefrist: "Bindefrist klären",
  fristangebot: "Abgabefrist klären",
  fristAngebot: "Abgabefrist klären",
  ausfuehrungszeitraum: "Ausführungszeitraum klären",
  projektart: "Projektart klären",
  gewerk: "Gewerk klären",
  bestandsunterlagen: "Bestandsunterlagen klären",
};

function salvageFromFehlenderKeyFactTitle(raw: string): string | null {
  const t = raw.trim();
  let m = t.match(/^Fehlender\s+KeyFact:?\s*([a-zäöüß_]+)\s*(klären|prüfen|abgrenzen|konkretisieren)?\s*$/i);
  if (!m) m = t.match(/^Fehlender\s+KeyFact\s+([a-zäöüß_]+)\s*(klären|prüfen)?\s*$/i);
  if (!m) return null;
  const k = m[1].toLowerCase();
  if (WEAK_KEYFACT_TITLE_FALLBACK[k]) return WEAK_KEYFACT_TITLE_FALLBACK[k];
  const label = k.replace(/_/g, " ");
  return `${label.charAt(0).toUpperCase() + label.slice(1)} klären`;
}

const TITLE_FALLBACK_BY_TOPIC: Record<
  string,
  { question: string; clarification: string }
> = {
  topic_nebenleistungen: {
    question: "Nebenleistungen und Pauschaltexte klären",
    clarification: "Nebenleistungen abgrenzen",
  },
  topic_vertrag: {
    question: "Vertragsklausel prüfen",
    clarification: "Vertragsklausel und Risiken abgrenzen",
  },
  topic_zeit: {
    question: "Bauzeit und Bauabschnitte klären",
    clarification: "Zeitliche Leistungsgrenzen abgrenzen",
  },
  topic_schnittstelle: {
    question: "Schnittstellen und Leistungsgrenzen klären",
    clarification: "Schnittstellen und Leistungsgrenzen abgrenzen",
  },
  topic_bestand: {
    question: "Bestandsunterlagen und Annahmen klären",
    clarification: "Bestandsunterlagen und Annahmen abgrenzen",
  },
  topic_ibn_abnahme: {
    question: "Inbetriebnahme und Funktionsprüfung klären",
    clarification: "Inbetriebnahme und Abnahme abgrenzen",
  },
  topic_doku: {
    question: "Dokumentationspflichten klären",
    clarification: "Dokumentationspflichten abgrenzen",
  },
  topic_mengen: {
    question: "Mengen und Erschwernisse klären",
    clarification: "Erschwernisse und Mehrkosten abgrenzen",
  },
  topic_brandschutz: {
    question: "Brandschutz und Abschottungen klären",
    clarification: "Brandschutzvorgaben abgrenzen",
  },
  topic_tga_system: {
    question: "Systemvorgaben und Regelung klären",
    clarification: "Systemleistungen abgrenzen",
  },
};

function stripTitleInternalPrefixes(s: string): string {
  return s
    .replace(/^Fehlender KeyFact:\s*[^.]+\.\s*/i, "")
    .replace(/^Bitte\s+konkretisieren\s+Sie:\s*/i, "")
    .replace(/^Bitte\s+konfirmieren\s+Sie:\s*/i, "")
    .trim();
}

function titleAppearsTruncatedOrCorrupt(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (/\.\.\.\s*$|…\s*$|\u2026\s*$/.test(t)) return true;
  if (/\b(bese|leistunge|zusatzleistunge)\b/i.test(t)) return true;
  if (/\bfür\s+nicht\s+bese/i.test(t)) return true;
  if (/\bZusatzleistunge/i.test(t)) return true;
  return false;
}

/** Langer erklärender Satz statt kompakter Überschrift. */
function titleIsExplanatoryProse(s: string): boolean {
  const t = s.trim();
  if (t.length > 92) return true;
  const commas = (t.match(/,/g) ?? []).length;
  if (commas >= 2 && t.length > 55) return true;
  if (/^Die\s+Abgrenzung\s+von\s+/i.test(t) && t.length > 55) return true;
  if (/\bKann\s+.+\s+bedeuten\.?\s*$/i.test(t)) return true;
  if (/^Der\s+Auftraggeber\s+kann\b/i.test(t)) return true;
  if (/^Unklare\s+.+\s+können\s+als\b/i.test(t)) return true;
  if (/^Beschriebene\s+Erschwernisse\s+können\s+zu\b/i.test(t)) return true;
  if (/^Unklare\s+Dokumentationspflichten\s+können\b/i.test(t)) return true;
  if (/^Bitte\s+konkretisieren\s+Sie:/i.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 14) return true;
  return false;
}

function titleEndsWithBrokenInfinitive(t: string): boolean {
  const m = t.match(/^(.+?)\s+(abgrenzen|klären|prüfen|konkretisieren|bestätigen|festlegen)\s*\.?$/i);
  if (!m) return false;
  const before = m[1].trim();
  if (before.length < 8) return true;
  if (!/\s/.test(before) && before.length >= 10) return false;
  if (before.length < 18) return true;
  if (/\b(und|oder|sowie|\/)\s*$/i.test(before)) return true;
  if (/\b(umfasst|gehen|dass|nur|die|als|zu|können)\s*$/i.test(before)) return true;
  if (/\b(oft|zu)\s*$/i.test(before)) return true;
  if (/\b(zusätzliche|Mehrkosten)\s*$/i.test(before)) return true;
  if (/\b(abgedeckt|geplant|umfasst|inkl\.|inkl)\s*$/i.test(before)) return true;
  if (/\b(welche|welcher|welches)\s+/i.test(before) && before.length > 35) return true;
  return false;
}

function capTitleAtWord(s: string, maxLen: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const sp = cut.lastIndexOf(" ");
  if (sp > 24) return cut.slice(0, sp).trim();
  return cut.trim();
}

function topicFallbackTitle(bucket: string, role: CommercialTitleRole): string | null {
  const row = TITLE_FALLBACK_BY_TOPIC[bucket];
  if (!row) return null;
  return role === "clarification" ? row.clarification : row.question;
}

/**
 * Reihenfolge: (a) explizit sauberer Roh-Titel ohne Reparatur → (b) Primär aus Fließtext (erster Satz/Frage) →
 * (c) KeyFact-Ersatz aus Rohzeile → (d) Themen-Fallback. Kaputte Roh-Titel werden verworfen, nicht nachgebessert.
 */
export function normalizeQuestionTitleForDisplay(
  title: string | undefined | null,
  questionBody: string,
  role: CommercialTitleRole = "question",
): string {
  const rawTitleInput = (title ?? "").replace(/\s+/g, " ").trim();
  const q = (questionBody ?? "").replace(/\s+/g, " ").trim();
  const fallbackDefault =
    role === "clarification"
      ? "Klarstellung zum Leistungs- oder Vertragskontext"
      : "Rückfrage zum Leistungs- oder Schnittstellenkontext";

  const bucketHint = inferTopicBucket(q.length >= 12 ? q : `${rawTitleInput} ${q}`);

  if (isExplicitCleanTitle(rawTitleInput)) {
    const explicit = rawTitleInput.replace(/\s+/g, " ").trim().replace(TITLE_JUNK_PREFIX, "").trim();
    return finalizeExplicitTitle(explicit);
  }

  const fromBody = derivePrimaryTitleFromBody(q, role);
  if (fromBody.length >= 12 && !titleMatchesHardReject(fromBody)) {
    return finalizeDerivedTitle(fromBody);
  }

  const kfTitle = salvageFromFehlenderKeyFactTitle(rawTitleInput);
  if (kfTitle) return finalizeDerivedTitle(kfTitle);

  const topicFb = topicFallbackTitle(bucketHint, role);
  if (topicFb) return finalizeDerivedTitle(topicFb);

  return finalizeDerivedTitle(fallbackDefault);
}

function coItemString(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/**
 * Finaler sichtbarer Titel für Rückfragen aus gespeichertem Item (result_json).
 * Verwendet dieselbe Kontextzusammensetzung wie `buildPdfReport` → `buildQuestionsFromItems`.
 * Gerendert wird ausschließlich der Rückgabewert; das Rohfeld `title` allein wird nicht angezeigt.
 */
export function resolveClarificationQuestionDisplayTitle(item: unknown): string {
  if (item == null) {
    return normalizeQuestionTitleForDisplay("", "", "question");
  }
  if (typeof item === "string") {
    return normalizeQuestionTitleForDisplay("", coItemString(item), "question");
  }
  if (typeof item !== "object") {
    return normalizeQuestionTitleForDisplay("", "", "question");
  }
  const obj = item as {
    question?: string;
    why?: string;
    reason?: string;
    clarifyPoints?: unknown[];
    text?: string;
    title?: string;
    user_hint?: string;
    userHint?: string;
  };
  const bullets =
    Array.isArray(obj.clarifyPoints) && obj.clarifyPoints.length > 0
      ? obj.clarifyPoints.map((p) => guardCommercialUserFacingText(String(p).trim(), 8)).filter(Boolean)
      : [];
  const mainQ = guardCommercialUserFacingText(coItemString(obj.question), 8) || coItemString(obj.question);
  const text =
    mainQ && bullets.length
      ? `${mainQ}\n• ${bullets.slice(0, 4).join("\n• ")}`
      : mainQ ||
        guardCommercialUserFacingText(coItemString(obj.text), 8) ||
        coItemString(obj.text) ||
        guardCommercialUserFacingText(coItemString(obj.why), 8) ||
        coItemString(obj.why) ||
        guardCommercialUserFacingText(coItemString(obj.reason), 8) ||
        coItemString(obj.reason) ||
        guardCommercialUserFacingText(coItemString(obj.title), 8) ||
        coItemString(obj.title) ||
        "";
  const textClean = guardCommercialUserFacingText(text, 12) || "";
  const questionCore = mainQ || coItemString(obj.question) || coItemString(obj.text) || textClean;
  const hintForTitle = [coItemString(obj.user_hint), coItemString(obj.userHint)].filter(Boolean).join(" ");
  const titleContextBody = [questionCore, hintForTitle].filter(Boolean).join(" ");
  return normalizeQuestionTitleForDisplay(coItemString(obj.title), titleContextBody, "question");
}

/**
 * Finaler sichtbarer Titel für Angebotsklarstellungen aus gespeichertem Item.
 * Gleiche Logik wie `buildPdfReport` → `clarificationFromOfferAssumptionItem`.
 */
export function resolveOfferAssumptionDisplayTitle(item: unknown): string {
  if (item == null) {
    return normalizeQuestionTitleForDisplay("", "", "clarification");
  }
  if (typeof item === "string") {
    return normalizeQuestionTitleForDisplay("", coItemString(item), "clarification");
  }
  if (typeof item !== "object") {
    return normalizeQuestionTitleForDisplay("", "", "clarification");
  }
  const obj = item as {
    clarification?: string;
    scopeNote?: string;
    assumption?: string;
    text?: string;
    title?: string;
    reason?: string;
    why?: string;
    user_hint?: string;
    userHint?: string;
  };
  const coreRaw =
    coItemString(obj.clarification) ||
    coItemString(obj.assumption) ||
    coItemString(obj.text) ||
    coItemString(obj.why) ||
    coItemString(obj.reason) ||
    coItemString(obj.title) ||
    "";
  const core = guardCommercialUserFacingText(coreRaw, 14) || coreRaw.trim();
  const scope = guardCommercialUserFacingText(coItemString(obj.scopeNote), 6) || coItemString(obj.scopeNote);
  const text = scope && core ? `${core} ${scope}` : core;
  const textClean = guardCommercialUserFacingText(text, 14) || "";
  const explicitRaw = guardCommercialUserFacingText(coItemString(obj.title), 6) || coItemString(obj.title);
  const hintForTitle = [coItemString(obj.user_hint), coItemString(obj.userHint)].filter(Boolean).join(" ");
  const titleContextBody = [textClean, hintForTitle].filter(Boolean).join(" ");
  return normalizeQuestionTitleForDisplay(explicitRaw, titleContextBody, "clarification");
}

function isGenericClarification(text: string): boolean {
  const n = normalizeForCompare(text);
  if (n.length < 28) return true;
  if (GENERIC_CLARIFICATION_SUBSTRINGS.some((re) => re.test(n))) return true;
  const scopeHits = (n.match(/\binsoweit\b|\bohne weitere klarstellung\b|\büblichen verständnis\b|\bleistungsverzeichnis\b/g) ?? []).length;
  if (scopeHits >= 2 && n.length < 220) return true;
  return false;
}

function flattenByGroup(byGroup: Record<string, unknown[]> | undefined): unknown[] {
  if (!byGroup || typeof byGroup !== "object") return [];
  const flat: unknown[] = [];
  for (const arr of Object.values(byGroup) as unknown[]) {
    if (Array.isArray(arr)) for (const item of arr) flat.push(item);
  }
  return flat;
}

function questionItemKey(item: unknown): string {
  if (item == null) return "";
  const o = item as { id?: string; question?: string; text?: string; title?: string };
  if (o.id && String(o.id).trim()) return `id:${String(o.id).trim()}`;
  const q = String(o.question ?? o.text ?? "").trim();
  if (q) return `q:${normalizeForCompare(q).slice(0, 200)}`;
  return `t:${normalizeForCompare(String(o.title ?? "")).slice(0, 120)}`;
}

function assumptionItemKey(item: unknown): string {
  if (item == null) return "";
  const o = item as { id?: string; clarification?: string; assumption?: string; text?: string };
  if (o.id && String(o.id).trim()) return `id:${String(o.id).trim()}`;
  const c = String(o.clarification ?? o.assumption ?? o.text ?? "").trim();
  if (c) return `c:${normalizeForCompare(c).slice(0, 220)}`;
  return "";
}

export function flattenStoredClarificationQuestions(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return [...raw];
  if (typeof raw === "object") {
    const o = raw as { questions?: unknown[]; byGroup?: Record<string, unknown[]> };
    const fromQ = Array.isArray(o.questions) ? o.questions : [];
    const fromG = flattenByGroup(o.byGroup);
    const out: unknown[] = [];
    const seen = new Set<string>();
    for (const it of [...fromQ, ...fromG]) {
      const k = questionItemKey(it);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }
  return [];
}

export function flattenStoredOfferAssumptions(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return [...raw];
  if (typeof raw === "object") {
    const o = raw as { assumptions?: unknown[]; byGroup?: Record<string, unknown[]> };
    const fromA = Array.isArray(o.assumptions) ? o.assumptions : [];
    const fromG = flattenByGroup(o.byGroup);
    const out: unknown[] = [];
    const seen = new Set<string>();
    for (const it of [...fromA, ...fromG]) {
      const k = assumptionItemKey(it);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }
  return [];
}

function getQuestionComparableText(item: unknown): string {
  const o = item as { question?: string; text?: string; title?: string; why?: string; reason?: string };
  return [o.question, o.text, o.title, o.why, o.reason].filter(Boolean).join(" ");
}

function getAssumptionComparableText(item: unknown): string {
  const o = item as { clarification?: string; assumption?: string; text?: string; title?: string; why?: string; reason?: string };
  return [o.clarification, o.assumption, o.text, o.title, o.why, o.reason].filter(Boolean).join(" ");
}

function severityRank(item: unknown): number {
  const o = item as { severity?: string; priority?: string | number };
  const s = String(o.severity ?? "").toLowerCase();
  if (s === "high") return 0;
  if (s === "medium") return 1;
  if (s === "low") return 2;
  const p = o.priority;
  if (typeof p === "number" && p <= 1) return 0;
  if (typeof p === "string" && /hoch|high|1|p1/i.test(p)) return 0;
  return 3;
}

function pickBetterQuestion(a: unknown, b: unknown): unknown {
  const ra = severityRank(a);
  const rb = severityRank(b);
  if (ra !== rb) return ra < rb ? a : b;
  const la = getQuestionComparableText(a).length;
  const lb = getQuestionComparableText(b).length;
  return la >= lb ? a : b;
}

/**
 * Pro Fach-Bucket (alles außer „topic_other“) nur **einen** führenden Eintrag –
 * echte Verdichtung statt nur Dubletten-Removal.
 */
export function collapseSpecialtyBuckets(items: unknown[]): unknown[] {
  const leaders = new Map<string, unknown>();
  const other: unknown[] = [];
  for (const it of items) {
    const text = getQuestionComparableText(it);
    const cleaned = guardCommercialUserFacingText(text, 10);
    if (!cleaned) continue;
    const bucket = inferTopicBucket(cleaned);
    if (bucket === "topic_other") {
      other.push(it);
      continue;
    }
    const cur = leaders.get(bucket);
    if (!cur) leaders.set(bucket, it);
    else leaders.set(bucket, pickBetterQuestion(cur, it));
  }
  return [...leaders.values(), ...other];
}

export function dedupeClarificationQuestionItems(items: unknown[], similarityThreshold = 0.44): unknown[] {
  const sorted = [...items].sort((a, b) => severityRank(a) - severityRank(b));
  const out: unknown[] = [];
  const bucketLeaders = new Map<string, unknown>();

  for (const it of sorted) {
    const text = getQuestionComparableText(it);
    const cleaned = guardCommercialUserFacingText(text, 10);
    if (!cleaned) continue;
    const bucket = inferTopicBucket(cleaned);
    const existingLeader = bucketLeaders.get(bucket);
    if (existingLeader) {
      const exText = getQuestionComparableText(existingLeader);
      if (textSimilarity(cleaned, exText) >= similarityThreshold) continue;
    }

    const dupGlobal = out.some((e) => textSimilarity(cleaned, getQuestionComparableText(e)) >= similarityThreshold);
    if (dupGlobal) continue;

    out.push(it);
    if (!existingLeader) bucketLeaders.set(bucket, it);
  }
  return out;
}

export function dedupeAndFilterOfferAssumptions(
  items: unknown[],
  questionTextsForNearDupCheck: string[],
  similarityThreshold = 0.52,
): unknown[] {
  const qNorm = questionTextsForNearDupCheck.map((t) => normalizeForCompare(t)).filter((t) => t.length > 12);
  const out: unknown[] = [];

  for (const it of items) {
    const text = getAssumptionComparableText(it);
    let cleaned = guardCommercialUserFacingText(text, 18);
    if (!cleaned || isGenericClarification(cleaned)) continue;

    const nearQuestion = qNorm.some((q) => textSimilarity(cleaned, q) >= 0.72);
    if (nearQuestion) continue;

    const dup = out.some((e) => textSimilarity(cleaned, getAssumptionComparableText(e)) >= similarityThreshold);
    if (dup) continue;

    out.push(it);
  }
  return out;
}

export type CommercialOutputMetrics = {
  questionsTotalDetected: number;
  questionsAfterDedupe: number;
  questionsPrioritizedForManagement: number;
  clarificationsTotalDetected: number;
  clarificationsAfterDedupe: number;
  clarificationsPrioritizedForManagement: number;
};

export function computeCommercialOutputMetrics(
  flatQuestionsRaw: unknown[],
  flatAssumptionsRaw: unknown[],
): { metrics: CommercialOutputMetrics; questionsNet: unknown[]; assumptionsNet: unknown[] } {
  const pass1 = dedupeClarificationQuestionItems(flatQuestionsRaw, 0.4);
  const pass2 = dedupeClarificationQuestionItems(collapseSpecialtyBuckets(pass1), 0.34);
  const questionsNet = dedupeClarificationQuestionItems(pass2, 0.3);
  const qTexts = questionsNet.map((q) => getQuestionComparableText(q));
  const assumptionsNet = dedupeAndFilterOfferAssumptions(flatAssumptionsRaw, qTexts, 0.52);

  const sortQ = [...questionsNet].sort((a, b) => severityRank(a) - severityRank(b));
  const sortA = [...assumptionsNet].sort((a, b) => severityRank(a) - severityRank(b));

  return {
    metrics: {
      questionsTotalDetected: flatQuestionsRaw.length,
      questionsAfterDedupe: questionsNet.length,
      questionsPrioritizedForManagement: Math.min(PRIORITY_QUESTION_CAP, sortQ.length),
      clarificationsTotalDetected: flatAssumptionsRaw.length,
      clarificationsAfterDedupe: assumptionsNet.length,
      clarificationsPrioritizedForManagement: Math.min(PRIORITY_CLARIFICATION_CAP, sortA.length),
    },
    questionsNet: sortQ,
    assumptionsNet: sortA,
  };
}

export { PRIORITY_QUESTION_CAP, PRIORITY_CLARIFICATION_CAP };
