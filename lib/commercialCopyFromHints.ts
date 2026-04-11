/**
 * Ableitung nutzerfreundlicher Rückfragen- und Angebotsklarstellungstexte aus
 * trigger.user_hint (Primärquelle) mit konservativen Fallbacks. Keine KI, keine Score-/Trigger-Engine.
 */

export type ClarificationExpertPayload = {
  findingId?: string;
  snippet?: string;
  keyword?: string;
  context?: string;
};

export type ClarificationItem = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  question: string;
  why: string;
  clarifyPoints: string[];
  sourceLabel: string;
  sourceType?: "db" | "sys" | "llm";
  expert?: ClarificationExpertPayload;
};

export type OfferClarificationExpertPayload = ClarificationExpertPayload;

export type OfferClarificationItem = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  clarification: string;
  scopeNote?: string;
  why: string;
  sourceLabel: string;
  sourceType?: "db" | "sys" | "llm";
  expert?: OfferClarificationExpertPayload;
};

export type FindingLike = {
  id: string;
  category?: string;
  title: string;
  detail?: string;
  severity?: string;
  user_hint?: string | null;
  user_hints?: string[] | null;
  raw_excerpt?: string | null;
};

export function inferSourceTypeFromFindingId(id: string | undefined | null): "db" | "sys" | "llm" | undefined {
  const s = String(id ?? "");
  if (s.startsWith("DB_")) return "db";
  if (s.startsWith("SYS_") || s.startsWith("LEGAL_")) return "sys";
  if (s.startsWith("LLM_")) return "llm";
  return undefined;
}

export function primaryUserHintFromFinding(f: FindingLike): string {
  if (Array.isArray(f.user_hints) && f.user_hints.length > 0) {
    const t = String(f.user_hints[0] ?? "").trim();
    if (t) return t;
  }
  const h = typeof f.user_hint === "string" ? f.user_hint.trim() : "";
  return h;
}

export function parseKeywordFromFindingDetail(detail: string | undefined): string | undefined {
  if (!detail?.trim()) return undefined;
  for (const part of detail.split(/\s*\|\s*/)) {
    const t = part.trim();
    if (t.toLowerCase().startsWith("keyword:")) {
      const v = t.slice("keyword:".length).trim();
      return v || undefined;
    }
  }
  return undefined;
}

export function parseContextFromFindingDetail(detail: string | undefined): string | undefined {
  if (!detail?.trim()) return undefined;
  for (const part of detail.split(/\s*\|\s*/)) {
    const t = part.trim();
    if (t.toLowerCase().startsWith("kontext:")) {
      const v = t.slice("kontext:".length).trim();
      return v || undefined;
    }
  }
  return undefined;
}

export function buildExpertPayload(f: FindingLike): ClarificationExpertPayload {
  const snippet =
    typeof f.raw_excerpt === "string" && f.raw_excerpt.trim()
      ? f.raw_excerpt.trim().slice(0, 2000)
      : typeof f.detail === "string"
        ? f.detail.trim().slice(0, 2000)
        : undefined;
  return {
    findingId: f.id,
    snippet,
    keyword: parseKeywordFromFindingDetail(f.detail),
    context: parseContextFromFindingDetail(f.detail),
  };
}

// ——— Text-Hilfen ———

const MAX_TITLE_WORDS = 8;

function oneLine(s: string): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstClause(s: string): string {
  const t = oneLine(s);
  const cut = t.split(/[.;](?=\s)/)[0]?.trim() ?? t;
  return cut;
}

/** Entfernt typische Floskeln am Satzanfang (nicht den inhaltlichen Kern kürzen). */
export function stripBureaucraticLead(s: string): string {
  let t = oneLine(s);
  t = t
    .replace(/^\s*im\s+(leistungsverzeichnis|lv)\b[^.;!?]*[;:,\s-]*/gi, "")
    .replace(/^\s*bitte\s+(konkretisieren|bestätigen|legen\s+fest)\s+sie[,:\s-]*/gi, "")
    .replace(/^\s*bitte\s+/i, "")
    .trim();
  return t;
}

function sanitizeSourceLabel(s: string): string {
  let t = oneLine(s);
  t = t.replace(/^(hinweis|risiko|unklar|trigger|prüfung|finding|db_|sys_|llm_)\s*[:–-]?\s*/i, "");
  return stripBureaucraticLead(t);
}

function tokensFrom(text: string): string[] {
  return oneLine(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x.replace(/[,;:.!?]+$/, ""));
}

const LEAD_SKIP = new Set([
  "wie",
  "ob",
  "dass",
  "sofern",
  "falls",
  "und",
  "oder",
  "im",
  "zur",
  "zum",
  "bei",
  "in",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "den",
  "dem",
  "des",
]);

function dropBadLeadingWords(words: string[]): string[] {
  const w = [...words];
  while (w.length) {
    const lw = w[0].replace(/[,;:]$/, "").toLowerCase();
    if (!LEAD_SKIP.has(lw)) break;
    w.shift();
  }
  return w;
}

/** Wörter, die in Kurztiteln keinen sachlichen Kern bilden (Satzreste vermeiden). */
const NUCLEUS_WEAK = new Set([
  "nicht",
  "kein",
  "keine",
  "beschrieben",
  "eindeutig",
  "unklar",
  "genannt",
  "fehlt",
  "fehlen",
  "liegt",
  "liegen",
  "verantwortung",
  "ausführung",
  "vollständig",
  "inhalt",
  "relevant",
  "ausreichend",
  "erforderlich",
  "sowie",
  "bzw",
  "wird",
  "werden",
  "ist",
  "sind",
]);

function titleCasePhrase(words: string[]): string {
  if (!words.length) return "";
  const s = words.join(" ").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function stripTitleActionSuffix(title: string): string {
  return title
    .replace(
      /\s+(klären|festlegen|konkretisieren|absichern|abgrenzen|vorbehalten|bestätigen|prüfen|einordnen)$/i,
      ""
    )
    .trim();
}

function enforceTitleWordCap(title: string, maxWords = MAX_TITLE_WORDS): string {
  const w = oneLine(title).split(/\s+/).filter(Boolean);
  if (w.length <= maxWords) return w.join(" ");
  return w.slice(0, maxWords).join(" ");
}

function combinedHaystack(hint: string, label: string): string {
  return `${hint} ${label}`.toLowerCase();
}

/** Feste, sprachlich geprüfte Kurztitel Rückfrage (Thema + Aktion). Spezifische Muster zuerst. */
function clarificationTitleFromPatterns(hint: string, label: string, category?: string): string | null {
  const x = combinedHaystack(hint, label);
  const c = (category ?? "").toLowerCase();
  if (/\b1717\b|din\s*en\s*1717|en\s*1717/i.test(x)) return "DIN EN 1717 und Überschutz konkretisieren";
  if (/\b1988\b|din\s*1988/i.test(x)) return "DIN 1988 Trinkwasserinstallation konkretisieren";
  if (/warmwasserbereiter|warmwasserspeicher|speicherparameter|speichergrö(ß|ss)e|wwspeicher/i.test(x))
    return "Warmwasserbereiter und Speicherparameter festlegen";
  if (/brandschutz|brandabschott|brandschott|durchdring|brandwand|feuerschutz/i.test(x))
    return "Brandschutzabschottungen und Durchdringungen festlegen";
  if (/inbetriebnahme|\bibn\b|funktionsprüf|funktionsnachweis|abnahme.*funktion|prüfprotokoll/i.test(x))
    return "Inbetriebnahme und Funktionsprüfung abgrenzen";
  if (/netzanschluss|anschlussleistung|hausanschluss|\bhlz\b|anschlusswert/i.test(x))
    return "Netzanschluss und Anschlussleistung klären";
  if (/zähler|zaehler|messkonzept|messstelle|eichrecht|zählerschrank/i.test(x)) return "Zählerplatz und Messkonzept klären";
  if (/absperr|entleerung|entleeren|spülstell|spülung.*strang|strang.*spül|druckprobe/i.test(x))
    return "Absperr-, Entleerungs- und Spülstellen je Strang klären";
  if (/hebeanlage|pumpensumpf|pumpenschacht|hebeschacht|förderwerk|sink|überlauf.*hebe/i.test(x))
    return "Hebeanlage, Pumpensumpf und Alarmierung festlegen";
  if (/schallschutz|schalltechnisch|\bschall\b/i.test(x)) {
    if (/sanitär|bad|wc|urinal|wasch/i.test(x)) return "Schallschutz Sanitär Ausführungsstandard bestätigen";
    return "Schallschutz Ausführungsstandard bestätigen";
  }
  if (/\bwarmwasserparameter\b|\bwarmwasser\b/i.test(x) && !/trinkwasserinstallation/i.test(x))
    return "Warmwasserparameter konkretisieren";
  if (/\bvorrang\b|langtext|planwerk|planungsstand/i.test(x)) return "Vorrang von Langtext und Plänen klären";
  if (/mängel|gewährleist.*anspruch|ansprüche.*mängel/i.test(x) || (c.includes("vertrag") && /mängel/i.test(x)))
    return "Vertragsregel zu Mängelansprüchen prüfen";
  return null;
}

/** Feste Kurztitel Angebot. */
function offerTitleFromPatterns(hint: string, label: string): string | null {
  const x = combinedHaystack(hint, label);
  if (/\b1717\b|din\s*en\s*1717|en\s*1717/i.test(x)) return "DIN EN 1717 Anforderungen abgrenzen";
  if (/\b1988\b|din\s*1988/i.test(x)) return "DIN 1988 Trinkwasser abgrenzen";
  if (/warmwasserbereiter|warmwasserspeicher|speicherparameter|wwspeicher/i.test(x))
    return "Warmwasserbereiter und Speicher abgrenzen";
  if (/brandschutz|brandabschott|durchdring|feuerschutz/i.test(x)) return "Brandschutzabschottungen abgrenzen";
  if (/inbetriebnahme|\bibn\b|funktionsprüf|funktionsnachweis/i.test(x)) return "Inbetriebnahme und Prüfung abgrenzen";
  if (/netzanschluss|anschlussleistung|hausanschluss|\bhlz\b/i.test(x)) return "Netzanschluss und Leistung abgrenzen";
  if (/zähler|zaehler|messkonzept|messstelle/i.test(x)) return "Zählerplatz und Messung absichern";
  if (/armatur|brause|wc-besteck|sanitär.*armatur/i.test(x)) return "Armaturenumfang absichern";
  if (/hebeanlage|pumpensumpf|pumpenschacht/i.test(x)) return "Hebeanlagenumfang abgrenzen";
  if (/schallschutz|schalltechnisch/i.test(x)) {
    if (/sanitär|bad|wc|urinal|wasch/i.test(x)) return "Schallschutzstandard Sanitär vorbehalten";
    return "Schallschutzstandard vorbehalten";
  }
  if (/\bwarmwasserparameter\b|\bwarmwasser\b/i.test(x)) return "Warmwasserparameter abgrenzen";
  if (/vertragsklausel|vortext|einleitungstext|nachfrist|bindefrist/i.test(x)) return "Vertragsklausel einordnen";
  if (/\bvorrang\b|langtext|planwerk/i.test(x)) return "Vorrangregelung absichern";
  return null;
}

function clarificationTailVerb(hint: string, category?: string): string {
  const h = hint.toLowerCase();
  const c = (category ?? "").toLowerCase();
  if (/brandschutz|durchdring|feuerschutz/i.test(h)) return "festlegen";
  if (/inbetriebnahme|funktionsprüf|funktionsnachweis/i.test(h)) return "abgrenzen";
  if (/netzanschluss|anschlussleistung|hlz/i.test(h)) return "klären";
  if (/zähler|zaehler|messkonzept/i.test(h)) return "klären";
  if (/schallschutz|schall\b/i.test(h)) return "bestätigen";
  if (/hebeanlage|hebeanlagen|alarm|pumpensumpf|sink|überlauf/i.test(h)) return "festlegen";
  if (/norm|din|vdi|dvgw|qualität|parameter/i.test(h)) return "konkretisieren";
  if (/mängel|gewährleist|vertrag|zahlung|binde|vob|bgb|klausel/i.test(h) || c.includes("vertrag")) return "prüfen";
  if (/vorrang|langtext|plan/i.test(h)) return "klären";
  if (/menge|me\b|mass|einheit/i.test(h)) return "klären";
  if (/schnittstelle|gewerk|nachbar/i.test(h)) return "klären";
  if (/armatur|brause|wc|urinal|sanitär/i.test(h)) return "absichern";
  return "klären";
}

function offerHeadlineVerb(hint: string): string {
  const h = hint.toLowerCase();
  if (/schallschutz|schall\b/i.test(h)) return "vorbehalten";
  if (/vertrag|vorbemerk|klausel|vortext|mängel|gewährleist/i.test(h)) return "einordnen";
  if (/vorrang|langtext|plan/i.test(h)) return "absichern";
  if (/zähler|zaehler|messkonzept/i.test(h)) return "absichern";
  if (/inbetriebnahme|funktionsprüf/i.test(h)) return "abgrenzen";
  if (/hebeanlage|alarm|pumpe|pumpensumpf/i.test(h)) return "abgrenzen";
  if (/warmwasser|parameter|din|norm/i.test(h)) return "abgrenzen";
  if (/armatur|sanitär|entwäss/i.test(h)) return "absichern";
  return "abgrenzen";
}

function buildNucleusFromHintOrLabel(hint: string, label: string, maxWords: number): string {
  const segment = stripBureaucraticLead(firstClause(hint));
  let words = dropBadLeadingWords(tokensFrom(segment));
  words = words.filter((w) => !NUCLEUS_WEAK.has(w.toLowerCase().replace(/[,;:]$/, "")));
  while (words.length && NUCLEUS_WEAK.has(words[words.length - 1].toLowerCase().replace(/[,;:]$/, ""))) words.pop();
  while (words.length && /^(klären|festlegen|konkretisieren|absichern|abgrenzen|vorbehalten|bestätigen|prüfen)$/i.test(words[words.length - 1]))
    words.pop();

  if (words.length >= 2) {
    return titleCasePhrase(words.slice(0, maxWords));
  }

  const fromLabel = dropBadLeadingWords(tokensFrom(sanitizeSourceLabel(label))).filter(
    (w) => !NUCLEUS_WEAK.has(w.toLowerCase())
  );
  if (fromLabel.length >= 1) {
    return titleCasePhrase(fromLabel.slice(0, maxWords));
  }
  return "";
}

/**
 * Kurz-Überschrift Rückfrage: Themenkern + eine Aktion, keine Satzreste, max. ca. 8 Wörter.
 */
export function buildClarificationHeadline(hint: string, triggerTitle: string, category?: string): string {
  const h = (hint ?? "").trim();
  const label = String(triggerTitle ?? "").trim();
  const patterned = h ? clarificationTitleFromPatterns(h, label, category) : null;
  if (patterned) return enforceTitleWordCap(patterned);

  const nucleus = buildNucleusFromHintOrLabel(h || label, label || h, 6);
  const verb = clarificationTailVerb(h || label, category);
  let title = nucleus ? `${nucleus} ${verb}`.trim() : "";
  if (!title || /^klären$/i.test(title) || /^konkretisieren$/i.test(title)) {
    const fb = buildNucleusFromHintOrLabel(label, label, 5);
    title = fb ? `${fb} klären` : "Leistungsumfang klären";
  }
  const low = title.toLowerCase();
  if (
    /\b(liegt|liegen|verantwortung|ausführung)\b.*\b(klären|festlegen|konkretisieren)\b/i.test(title) ||
    /nicht eindeutig beschrieben\s+klären/i.test(low) ||
    /^wie\b/i.test(low)
  ) {
    const fb = buildNucleusFromHintOrLabel(label, label, 5);
    title = fb ? `${fb} klären` : "Leistungsumfang klären";
  }
  return enforceTitleWordCap(oneLine(title));
}

/**
 * Kurz-Überschrift Angebot: Muster oder Thema + eine Angebotsaktion.
 */
export function buildOfferHeadline(hint: string, triggerTitle: string): string {
  const h = (hint ?? "").trim();
  const label = String(triggerTitle ?? "").trim();
  const patterned = h ? offerTitleFromPatterns(h, label) : null;
  if (patterned) return enforceTitleWordCap(patterned);

  const verb = offerHeadlineVerb(h || label);
  const nucleus = buildNucleusFromHintOrLabel(h || label, label || h, 5);
  if (nucleus) return enforceTitleWordCap(`${nucleus} ${verb}`);
  const fb = buildNucleusFromHintOrLabel(label, label, 4);
  return enforceTitleWordCap(fb ? `${fb} ${verb}` : `Leistungsumfang ${verb}`);
}

/** Ein Satz „Warum relevant“ für Anzeige (Risiko-Tab, Kurzdarstellung) – gleiche Familienlogik wie Rückfragen. */
export function whyFromHintAndCategory(hint: string, category: string | undefined): string {
  const h = hint.toLowerCase();
  if (/hebeanlage|pumpensumpf|pumpenschacht|alarm|sink|überlauf|hebeschacht/i.test(h)) {
    return "Systemumfang, Zubehör, Aufstellbedingungen und Schnittstellen (Elektro/MSR) bestimmen Kosten, Termine sowie Mängel- und Nachtragsrisiko.";
  }
  if (/schallschutz|schalltechnisch|\bschall\b/i.test(h)) {
    return "Ausführungsstandard, Materialwahl und Befestigung wirken auf Prüfbarkeit, Mängelbeseitigung und Nachbesserungsrisiko.";
  }
  if (/\b1717\b|din\s*en\s*1717|überschutz|trinkwasser|din\s*1988/i.test(h)) {
    return "Normen setzen Leistungsgrenzen und anerkannte Regeln der Technik fest; Unklarheit erzeugt Zusatzumfang und Haftungsstreit.";
  }
  if (/norm|din|vdi|dvgw|\ben\s*\d/i.test(h)) {
    return "Normbezug begrenzt oder erweitert den Leistungsumfang gegenüber der reinen LV-Beschreibung und wirkt auf Zusatzkosten.";
  }
  if (/brandschutz|brandabschott|durchdring|feuerschutz/i.test(h)) {
    return "Brandschutz an Durchdringungen ist koordinations- und nachweisintensiv; Lücken führen zu Nachbesserung und Behinderungsfolgen.";
  }
  if (/inbetriebnahme|\bibn\b|funktionsprüf|funktionsnachweis/i.test(h)) {
    return "Inbetriebnahme und Funktionsnachweise koppeln Ausführung, Mitwirkung Dritter und Abnahme – bei Lücken drohen Termin- und Mehrkosten.";
  }
  if (/netzanschluss|anschlussleistung|hausanschluss|\bhlz\b/i.test(h)) {
    return "Anschlussleistung und Netzparameter sind preis- und terminrelevant; Unklarheit verschiebt Risiko auf die Ausführungsphase.";
  }
  if (/zähler|zaehler|messkonzept|messstelle|eichrecht/i.test(h)) {
    return "Messkonzept und Zählerplatz betreffen Schnittstellen zum Versorger, Umbaukosten und spätere Betriebsführung.";
  }
  if (/mehrpreis|nachtrag|zusatzkosten|nachforder/i.test(h)) {
    return "Der Punkt wirkt direkt auf Mehrkosten und Nachtragsrisiko nach Zuschlag.";
  }
  if (/schnittstelle|gewerk|nachbar|übergang|nebengewerk/i.test(h)) {
    return "Ohne klare Schnittstellen drohen Lücken im Leistungsbild und Streit zwischen den Gewerken.";
  }
  if (/termin|frist|ablauf|bauzeit|verzug/i.test(h)) {
    return "Zeitliche Vorgaben wirken auf Ablauf, Vorhalte und Folgekosten.";
  }
  if (/pauschal|pauschale|lump|einheitspreis|pau/i.test(h) || (/menge|me\b|mass|einheit/i.test(h) && /unklar|unvollständig|fehlt/i.test(h))) {
    return "Mengen, Pauschalen und Einheiten sind unmittelbar kalkulationsrelevant und bei Unklarheit nachtragsanfällig.";
  }
  if (/menge|me\b|mass|einheit|abschnitt/i.test(h)) {
    return "Mengen und Einheiten sind unmittelbar kalkulationsrelevant.";
  }
  return whyFromCategoryFallback(category);
}

function whyFromCategoryFallback(category: string | undefined): string {
  const c = String(category ?? "").toLowerCase();
  if (c.includes("vertrag") || c.includes("vortext")) {
    return "Auslegungs- und Haftungsrisiko steigen, wenn vertragliche Anforderungen oder Rangfolgen im LV nicht eindeutig sind.";
  }
  if (c.includes("mengen") || c.includes("schnittstellen") || c.includes("neben")) {
    return "Unklare Schnittstellen, Mengen oder Pauschalen begünstigen Kalkulations- und Nachtragsrisiko.";
  }
  if (c.includes("voll") || c.includes("techn")) {
    return "Technische Lücken erschweren eine belastbare und vergleichbare Kalkulation.";
  }
  if (c.includes("kalkulation") || c.includes("unsicher")) {
    return "Kalkulationsunschärfen wirken direkt auf Preis und Risikopuffer.";
  }
  return "Der Punkt ist vor Angebotsabgabe wirtschaftlich zu klären, um Nachtragsrisiken zu begrenzen.";
}

/** 1–2 kurze Sätze, ohne vollen user_hint und ohne why zu wiederholen. */
export function buildQuestionWordingFromHint(hint: string, title: string, why: string): string {
  const topic = stripTitleActionSuffix(title);
  const h = hint.toLowerCase();
  let q = "";
  if (/\bob\s|gilt\s|zulässig|erforderlich|ausreichend/i.test(h)) {
    q = `Ist für „${topic}“ der Leistungsumfang in Ihrem Verständnis eindeutig – und welche Positionen sind maßgeblich?`;
  } else if (/fehlt|nicht genannt|nicht beschrieben|unklar|unvollständig/i.test(h)) {
    q = `Welche Leistungen, Mengen und Schnittstellen schließen Sie bei „${topic}“ ausdrücklich ein?`;
  } else if (/norm|din|vdi|qualität/i.test(h)) {
    q = `Welche Normen, Qualitätsstufen und Nachweise gelten für „${topic}“ verbindlich?`;
  } else {
    q = `Bitte legen Sie Umfang, technische Mindestanforderungen und Schnittstellen zu „${topic}“ für die Angebotsprüfung schriftlich fest.`;
  }
  const whyL = why.toLowerCase();
  if (whyL && q.toLowerCase().includes(whyL.slice(0, Math.min(28, whyL.length)))) {
    q = q.split("?")[0] + "?";
  }
  return oneLine(q);
}

/** Kurze Prüfaspekte (nominal), max. 4 – keine Halbsätze aus Chunk-Kürzung. */
function domainClarifyPoints(hint: string): string[] | null {
  const h = hint.toLowerCase();
  if (/hebeanlage|pumpensumpf|pumpenschacht|hebeschacht|förderwerk/i.test(h)) {
    return [
      "Anlagentyp und Förderleistung",
      "Alarmierung und Stromversorgung",
      "Aufstellort und Zugänglichkeit",
      "Schnittstellen zu Elektro und MSR",
    ];
  }
  if (/schallschutz|schalltechnisch|\bschall\b/i.test(h)) {
    return [
      "Geforderter Schallschutzstandard",
      "Betroffene Bereiche",
      "Material- und Befestigungsanforderungen",
      "Nachweise und Detailvorgaben",
    ];
  }
  if (/mängel|gewährleist.*anspruch/i.test(h)) {
    return [
      "Vertragliche Grundlage",
      "Abweichung von Standardregelungen",
      "Betroffene Leistungsbereiche",
      "Wirtschaftliche Relevanz",
    ];
  }
  if (/\bwarmwasser\b|trinkwasser|din\s*1988|trinkwasserinstallation/i.test(h)) {
    return [
      "Geforderte Parameter und Speichergrößen",
      "Zirkulation und Entlüftung",
      "Normen und Hygienevorgaben",
      "Mess-, Regel- und Schnittstellen",
    ];
  }
  if (/\b1717\b|din\s*en\s*1717|überschutz/i.test(h)) {
    return [
      "Trinkwasser vs. Nichttrinkwasser / Überschutz",
      "Kategorie nach DIN EN 1717",
      "Sicherheitseinrichtungen und Kennzeichnung",
      "Nachweise und Abnahmevorgaben",
    ];
  }
  if (/brandschutz|brandabschott|durchdring|feuerschutz/i.test(h)) {
    return [
      "Abschottqualität und Systemzugehörigkeit",
      "Durchführungen und Rohrdurchführungen",
      "Nachweise und Übergabe an andere Gewerke",
      "Mitwirkung und Schnittstellenfolgen",
    ];
  }
  if (/inbetriebnahme|\bibn\b|funktionsprüf|funktionsnachweis/i.test(h)) {
    return [
      "Leistungsumfang der Inbetriebnahme",
      "Prüfumfang und Abnahmekriterien",
      "Mitwirkung Dritter und Termine",
      "Dokumentation und Protokolle",
    ];
  }
  if (/netzanschluss|anschlussleistung|hausanschluss|\bhlz\b/i.test(h)) {
    return [
      "Anschlusswerte und Leistungsreserven",
      "Übergabepunkt und Eigentumsgrenzen",
      "Mitwirkung Energieversorger",
      "Terminliche Einbindung in die Bauabwicklung",
    ];
  }
  if (/zähler|zaehler|messkonzept|messstelle|eichrecht/i.test(h)) {
    return [
      "Messkonzept und Zählerkonzept",
      "Zählerplatz und Aufstellbedingungen",
      "Schnittstellen Elektro / MSR",
      "Eich- und Betriebsvorgaben",
    ];
  }
  if (/schnittstelle|gewerk|nachbar|nebengewerk/i.test(h)) {
    return [
      "Leistungsabgrenzung zum Nachbargewerk",
      "Koordination und Übergabetermine",
      "Mitwirkung und Bereitstellungen",
      "Mehrkosten bei Schnittstellenänderungen",
    ];
  }
  if (/menge|me\b|mass|einheit/i.test(h)) {
    return [
      "Maßgebliche Mengen und Einheiten",
      "Messlogik und Bezugsflächen",
      "Abweichungen zum Planstand",
      "Positionierung im LV",
    ];
  }
  return null;
}

function genericFallbackClarifyPoints(category?: string, sourceLabel?: string): string[] {
  const c = (category ?? "").toLowerCase();
  const tag = sanitizeSourceLabel(sourceLabel ?? "");
  const shortTag = tag.split(/\s+/).slice(0, 4).join(" ");
  const labelPoint =
    shortTag.length >= 6 && shortTag.length <= 42 && !/\b(weil|damit|sodass|obwohl)\b/i.test(shortTag)
      ? `Fachliche Einordnung: ${shortTag}`
      : null;

  if (c.includes("vertrag") || c.includes("vortext")) {
    return [
      labelPoint ?? "Vertragliche Grundlage und Auslegung",
      "Abgrenzung zu Neben- und Mitwirkungsleistungen",
      "Auswirkungen auf Preis und Mehrkostenrisiko",
      "Maßgebliche LV-Positionen und Anlagen",
    ];
  }
  if (c.includes("mengen") || c.includes("schnittstellen") || c.includes("neben")) {
    return [
      labelPoint ?? "Leistungsumfang und zugeordnete Positionen",
      "Schnittstellen und Übergänge",
      "Mengen und beschreibende Einordnung",
      "Wirtschaftliche Relevanz bei Klärung",
    ];
  }
  return [
    labelPoint ?? "Technischer Mindestinhalt und Spezifikation",
    "Schnittstellen zu vor- und nachgelagerten Gewerken",
    "Ausführungs- und Nachweisanforderungen",
    "Mengen und Einordnung im Leistungsverzeichnis",
  ];
}

export function extractClarifyPointsFromHint(
  hint: string,
  title: string,
  sourceLabel = "",
  category?: string
): string[] {
  const banned = /ist\s+relevant|weil\b|prüfen\s+sie\s+vor\s+angebotsabgabe|vor\s+angebotsabgabe/i;
  const domain = domainClarifyPoints(hint);
  if (domain) {
    return domain.slice(0, 4).filter((p) => !banned.test(p));
  }
  return genericFallbackClarifyPoints(category, sourceLabel || stripTitleActionSuffix(title)).slice(0, 4);
}

function offerLeadClause(hint: string, title: string): string {
  const h = hint.toLowerCase();
  const nuc = stripTitleActionSuffix(title);
  if (/din\s*1988|trinkwasserinstallation|\btrinkwasser\b/i.test(h) && !/warmwasserbereiter/i.test(h)) {
    return "Leistungen der Trinkwasserinstallation";
  }
  if (/warmwasserbereiter|warmwasserspeicher|speicherparameter/i.test(h)) {
    return "Warmwasserbereiter und zugehörige Speicherparameter";
  }
  if (/hebeanlage|pumpensumpf|alarm/i.test(h)) {
    return "die Leistungen für die Hebeanlage einschließlich Pumpensumpf und Alarmierung";
  }
  if (/schallschutz/i.test(h)) {
    return "die Schallschutzmaßnahmen im hier beschriebenen Umfang";
  }
  if (/schnittstelle|gewerk|nachbar/i.test(h)) {
    return "die genannten Schnittstellen und Übergänge zu Nachbargewerken";
  }
  if (nuc.length >= 8 && nuc.length <= 72) {
    const lower = nuc.charAt(0).toLowerCase() + nuc.slice(1);
    return lower.startsWith("die ") || lower.startsWith("der ") ? lower : `den Leistungsbereich „${nuc}“`;
  }
  return "die im Hinweis genannten Leistungen";
}

/** Triggernaher Angebotssatz, ohne generisches „Unser Angebot zu …“. */
export function buildOfferClarificationSentence(hint: string, title: string): string {
  const lead = offerLeadClause(hint, title);
  const h = hint.toLowerCase();
  if (/ausschl|nicht enthalten|nicht kalkul|ohne\s+mehrpreis/i.test(h)) {
    return oneLine(
      `Wir kalkulieren ${lead} nur für den im Leistungsverzeichnis ausdrücklich beschriebenen Umfang; ausgeschlossene oder nicht erfasste Zusatzleistungen sind nicht enthalten.`
    );
  }
  if (/mindest|mind\.|standard|üblich/i.test(h)) {
    return oneLine(
      `Für ${lead} beziehen wir uns auf die im Leistungsverzeichnis genannten Mindestanforderungen; weitergehende Ausführungen wären gesondert zu bewerten.`
    );
  }
  return oneLine(
    `Unser Angebot berücksichtigt ${lead} nur insoweit, wie der maßgebliche Leistungsinhalt im Leistungsverzeichnis eindeutig beschrieben ist.`
  );
}

function offerScopeNoteIfNeeded(clarification: string): string | undefined {
  const c = clarification.toLowerCase();
  if (/nicht enthalten|ausgeschlossen|gesondert|nur insoweit|nur nach dem im leistungsverzeichnis/i.test(c)) return undefined;
  return "Weitergehende oder nicht ausdrücklich beschriebene Anforderungen sind nicht Leistungsbestandteil.";
}

function offerWhyFromHint(hint: string, category: string | undefined): string {
  const h = hint.toLowerCase();
  if (/ausschl|nicht enthalten/i.test(h)) return "Die Abgrenzung schützt vor schleichender Leistungserweiterung im Ausführungsfall.";
  if (/hebeanlage|pumpensumpf|alarm|hebeschacht/i.test(h)) {
    return "Hebeanlagen bündeln Ausrüstung, Alarmierung und Schnittstellen; ohne klare Beschreibung steigen Mängel- und Nachtragsrisiko.";
  }
  if (/schallschutz|schalltechnisch/i.test(h)) {
    return "Schallschutz wirkt auf Material, Aufbau und Abnahmefähigkeit – und damit auf Nachbesserung und Nachträge.";
  }
  if (/\b1717\b|din\s*1988|din\s*en\s*1717|trinkwasser/i.test(h)) {
    return "Normvorgaben für Trinkwasser und Überschutz definieren Leistungsgrenzen; Abweichungen erzeugen Zusatzumfang.";
  }
  if (/norm|din|vdi|qualität/i.test(h)) {
    return "Normen und anerkannte Regeln der Technik steuern den erforderlichen Mindestumfang und damit Preis und Haftung.";
  }
  if (/brandschutz|durchdring|feuerschutz/i.test(h)) {
    return "Brandschutz an Durchdringungen ist koordinationsintensiv; Unklarheit führt zu Nachbesserung und Terminfolgen.";
  }
  if (/menge|pauschal|pauschale/i.test(h)) {
    return "Mengen und Pauschalen sind direkt preiswirksam; Unschärfe erhöht Kalkulations- und Nachtragsrisiko.";
  }
  if (/schnittstelle|gewerk/i.test(h)) return "Klare Abgrenzung reduziert Schnittstellenstreit und Nachträge.";
  return whyFromHintAndCategory(hint, category);
}

// ——— Legacy export names ———

/** @deprecated Nutze buildClarificationHeadline – behalten für Import-Stabilität. */
export function deriveTitleFromFinding(f: FindingLike, hint: string): string {
  const h = hint.trim();
  if (h) return buildClarificationHeadline(h, String(f.title ?? "").trim(), f.category);
  return buildFallbackClarificationTitle(String(f.title ?? "").trim(), f.category);
}

/** @deprecated Nutze buildClarificationHeadline */
export function deriveTitleFromHint(hint: string): string {
  return hint.trim() ? buildClarificationHeadline(hint, "", undefined) : "";
}

export function buildClarificationFromHint(f: FindingLike, args: { id: string; severity: "low" | "medium" | "high" }): ClarificationItem {
  const hint = primaryUserHintFromFinding(f);
  const sourceLabel = String(f.title ?? "").trim() || "Trigger";
  const st = inferSourceTypeFromFindingId(f.id);
  if (!hint) throw new Error("buildClarificationFromHint: hint required; use fallback path");

  const why = whyFromHintAndCategory(hint, f.category);
  const title = buildClarificationHeadline(hint, sourceLabel, f.category);
  const question = buildQuestionWordingFromHint(hint, title, why);
  const clarifyPoints = extractClarifyPointsFromHint(hint, title, sourceLabel, f.category);

  return {
    id: args.id,
    severity: args.severity,
    title,
    question,
    why,
    clarifyPoints,
    sourceLabel,
    sourceType: st,
    expert: buildExpertPayload(f),
  };
}

export function buildOfferClarificationFromHint(f: FindingLike, args: { id: string; severity: "low" | "medium" | "high" }): OfferClarificationItem {
  const hint = primaryUserHintFromFinding(f);
  const sourceLabel = String(f.title ?? "").trim() || "Trigger";
  const st = inferSourceTypeFromFindingId(f.id);
  if (!hint) throw new Error("buildOfferClarificationFromHint: hint required; use fallback path");

  const title = buildOfferHeadline(hint, sourceLabel);
  const clarification = buildOfferClarificationSentence(hint, title);
  const scopeNote = offerScopeNoteIfNeeded(clarification);
  const why = offerWhyFromHint(hint, f.category);

  return {
    id: args.id,
    severity: args.severity,
    title,
    clarification,
    ...(scopeNote ? { scopeNote } : {}),
    why,
    sourceLabel,
    sourceType: st,
    expert: buildExpertPayload(f),
  };
}

function buildFallbackClarificationTitle(triggerTitle: string, category?: string): string {
  const label = sanitizeSourceLabel(triggerTitle);
  const n = buildNucleusFromHintOrLabel(label, label, 5);
  if (n) return enforceTitleWordCap(`${n} klären`);
  if ((category ?? "").toLowerCase().includes("vertrag")) return "Vertragsauslegung prüfen";
  return "Leistungsinhalt klären";
}

function buildFallbackOfferTitle(triggerTitle: string): string {
  const label = sanitizeSourceLabel(triggerTitle);
  const n = buildNucleusFromHintOrLabel(label, label, 4);
  if (n) return enforceTitleWordCap(`${n} abgrenzen`);
  return "Leistungsumfang abgrenzen";
}

export function buildClarificationFallbackFinding(
  f: FindingLike,
  args: { id: string; severity: "low" | "medium" | "high"; legalQuestion?: string }
): ClarificationItem {
  const sourceLabel = String(f.title ?? "").trim() || "Trigger";
  const st = inferSourceTypeFromFindingId(f.id);
  const expert = buildExpertPayload(f);

  if (args.legalQuestion?.trim()) {
    const qRaw = args.legalQuestion.trim();
    const title = buildClarificationHeadline(qRaw, sourceLabel, f.category);
    return {
      id: args.id,
      severity: args.severity,
      title,
      question: qRaw.startsWith("Bitte ") ? qRaw : `Bitte bestätigen Sie schriftlich: ${qRaw}`,
      why: "Vergabe- und vertragsspezifischer Hinweis – Auslegung sollte vor Abgabe geklärt werden.",
      clarifyPoints: extractClarifyPointsFromHint(qRaw, title, sourceLabel, f.category).slice(0, 4),
      sourceLabel,
      sourceType: st ?? "sys",
      expert,
    };
  }

  const title = buildFallbackClarificationTitle(sourceLabel, f.category);
  const question = `Welche Anforderungen und Leistungsgrenzen gelten für „${sourceLabel}“ aus Ihrer Sicht verbindlich – bitte mit Verweis auf LV-Positionen oder Anlagen?`;
  return {
    id: args.id,
    severity: args.severity,
    title,
    question,
    why: whyFromCategoryFallback(f.category),
    clarifyPoints: extractClarifyPointsFromHint("", title, sourceLabel, f.category),
    sourceLabel,
    sourceType: st,
    expert,
  };
}

export function buildOfferClarificationFallbackFinding(
  f: FindingLike,
  args: { id: string; severity: "low" | "medium" | "high"; legalClarification?: string }
): OfferClarificationItem {
  const sourceLabel = String(f.title ?? "").trim() || "Trigger";
  const st = inferSourceTypeFromFindingId(f.id);
  const expert = buildExpertPayload(f);

  if (args.legalClarification?.trim()) {
    const c = args.legalClarification.trim();
    const title = buildOfferHeadline(c, sourceLabel);
    return {
      id: args.id,
      severity: args.severity,
      title,
      clarification: c,
      why: "Absicherung zu einem vertraglichen Hinweis aus der Ausschreibung.",
      sourceLabel,
      sourceType: st ?? "sys",
      expert,
    };
  }

  const title = buildFallbackOfferTitle(sourceLabel);
  const clarification = oneLine(
    `Im Bereich „${stripTitleActionSuffix(title)}“ beziehen sich unsere Leistungen und Preise nur auf den im Leistungsverzeichnis ohne weitergehende Auslegung erkennbaren Umfang.`
  );
  return {
    id: args.id,
    severity: args.severity,
    title,
    clarification,
    why: whyFromCategoryFallback(f.category),
    sourceLabel,
    sourceType: st,
    expert,
  };
}

export function buildClarificationFromPlainText(args: {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  question: string;
  why: string;
  clarifyPoints: string[];
  sourceLabel: string;
  sourceType?: "db" | "sys" | "llm";
  expert?: ClarificationExpertPayload;
}): ClarificationItem {
  return {
    id: args.id,
    severity: args.severity,
    title: args.title,
    question: args.question,
    why: args.why,
    clarifyPoints: args.clarifyPoints,
    sourceLabel: args.sourceLabel,
    sourceType: args.sourceType,
    expert: args.expert,
  };
}

export function buildOfferFromPlainText(args: {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  clarification: string;
  scopeNote?: string;
  why: string;
  sourceLabel: string;
  sourceType?: "db" | "sys" | "llm";
  expert?: OfferClarificationExpertPayload;
}): OfferClarificationItem {
  return {
    id: args.id,
    severity: args.severity,
    title: args.title,
    clarification: args.clarification,
    scopeNote: args.scopeNote,
    why: args.why,
    sourceLabel: args.sourceLabel,
    sourceType: args.sourceType,
    expert: args.expert,
  };
}
