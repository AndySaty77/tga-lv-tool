/**
 * Nachtragsanalyse – Strang B: echtes Nachtragspotenzial (Claim-Potenzial).
 * Intern führend: ChangePotentialEngine (lib/changePotentialModel.ts) → ChangePotentialSummary.
 * Nach außen: Legacy-Format (ChangeOrderOpportunity, byCluster) über Mapping für API/UI.
 *
 * Produktive Pipeline (einziger führender Strang):
 *   runChangePotentialEngine → optional refineChangePotentialWithLlm → mapChangePotentialSummaryToLegacy
 *   → opportunities / byCluster (kein Legacy-LLM mehr in den finalen Daten).
 * Legacy-LLM (runLlmChangeOrderAnalysis): nur noch für Debug/Vergleich bei input.useLlm,
 * Ergebnis fließt nicht mehr in opportunities/byCluster ein.
 */

import OpenAI from "openai";
import { runChangePotentialEngine, mapChangePotentialSummaryToLegacy, type ChangePotentialSummary } from "./changePotentialModel";
import { refineChangePotentialWithLlm } from "./changePotentialLlmRefinement";
import { enrichChangePotentialWithCommercialStrategy } from "./changePotentialCommercialStrategy";
import { buildNegotiationClusters } from "./changePotentialNegotiationClusters";
import { deriveCommercialActionsFromChangePotential } from "./changePotentialCommercialActions";
import { buildOfferStrategySummary } from "./offerStrategySummary";
import { runSystemLogicEngine } from "./system-logic";
export type { ChangePotentialSummary } from "./changePotentialModel";
export type { OfferStrategySummary } from "./changePotentialModel";
export type { CommercialActionsFromChangePotential } from "./changePotentialCommercialActions";

// ================= Types =================

export type ChangeOrderCluster =
  | "leistungsaenderung"
  | "leistungsmehrung"
  | "schnittstelle"
  | "erschwernis";

export type ChangeOrderOpportunity = {
  id: string;
  cluster: ChangeOrderCluster;
  title: string;
  description: string;
  potential: "low" | "medium" | "high";
  riskLevel?: "low" | "medium" | "high";
  assertiveness?: "schwach" | "mittel" | "stark";
  reason: string;
  sourceFindingIds?: string[];
  sourceTextSnippets?: string[];
  sourceType?: ("finding" | "preface" | "keyfact" | "llm")[];
};

export type FindingInput = {
  id: string;
  title: string;
  detail?: string;
  category?: string;
};

export type RiskClauseInput = {
  type: string;
  riskLevel: string;
  text: string;
  interpretation?: string;
};

export type ChangeOrderInput = {
  findings: FindingInput[];
  riskClauses: RiskClauseInput[];
  keyFacts: Record<string, string>;
  vortext?: string;
  lvPositions?: string;
  /** @deprecated Nur noch für Legacy-LLM-Debug; UI steuert useChangePotentialLlm. */
  useLlm?: boolean;
  /** Steuert die neue LLM-Veredelung der ChangePotential-Engine (refineChangePotentialWithLlm). */
  useChangePotentialLlm?: boolean;
};

// ================= 25 Nachtragsquellen → Cluster-Mapping (Strang B: echtes Nachtragspotenzial) =================

const NACHTRAG_SOURCES: Array<{
  id: number;
  title: string;
  cluster: ChangeOrderCluster;
  keywords: RegExp[];
  /** Höheres echtes Nachtragspotenzial (nicht nur Risiko) */
  highPotential?: boolean;
}> = [
  { id: 1, title: "Nebenleistungen nur pauschal erwähnt", cluster: "leistungsmehrung", keywords: [/nebenleistung|pauschal|alles inbegriffen|inkl\./i] },
  { id: 2, title: "Vollständigkeitsklauseln", cluster: "leistungsaenderung", keywords: [/vollständig|vollständig|vollumfänglich|umfassend/i], highPotential: false },
  { id: 3, title: "Bauseits-Leistungen unklar", cluster: "schnittstelle", keywords: [/bauseits|bauherrseitig|ag-seitig/i], highPotential: true },
  { id: 4, title: "Vorleistungen anderer Gewerke nicht definiert", cluster: "schnittstelle", keywords: [/vorleistung|vorarbeiten|andere gewerke|gewerk/i], highPotential: true },
  { id: 5, title: "Schnittstellen zwischen Gewerken unklar", cluster: "schnittstelle", keywords: [/schnittstelle|abgrenz|koordin|gewerk/i], highPotential: true },
  { id: 6, title: "Fehlende oder unklare Massenermittlung", cluster: "leistungsmehrung", keywords: [/masse|mengen|aufmaß|ermittlung|pauschal/i], highPotential: true },
  { id: 7, title: "Leitungswege nicht eindeutig", cluster: "leistungsmehrung", keywords: [/leitungsweg|verlegung|führung/i] },
  { id: 8, title: "Rohr- oder Kanaldimensionen unvollständig", cluster: "leistungsmehrung", keywords: [/dimension|dn|rohr|kanal|durchmesser/i] },
  { id: 9, title: "Dämmung nicht sauber beschrieben", cluster: "leistungsmehrung", keywords: [/dämmung|dämm/i] },
  { id: 10, title: "Brandschutzanforderungen unklar", cluster: "leistungsmehrung", keywords: [/brandschutz|brand/i] },
  { id: 11, title: "Schallschutzanforderungen fehlen oder unkonkret", cluster: "leistungsmehrung", keywords: [/schallschutz|schall/i] },
  { id: 12, title: "Druckprüfung / Dichtheitsprüfung nicht eindeutig", cluster: "leistungsaenderung", keywords: [/druckprüfung|druckprobe|dichtheitsprüfung/i], highPotential: true },
  { id: 13, title: "Spülung / Reinigung / Desinfektion unklar", cluster: "leistungsaenderung", keywords: [/spül|spuel|reinigung|desinfektion/i], highPotential: true },
  { id: 14, title: "Einregulierung / hydraulischer Abgleich unklar", cluster: "leistungsaenderung", keywords: [/einregul|hydraulisch|abgleich/i], highPotential: true },
  { id: 15, title: "Inbetriebnahme nicht sauber abgegrenzt", cluster: "leistungsaenderung", keywords: [/inbetriebnahme|ibn/i] },
  { id: 16, title: "Probebetrieb / Funktionsprüfung / Abnahmebegleitung unklar", cluster: "leistungsaenderung", keywords: [/probebetrieb|funktionsprüfung|abnahme/i] },
  { id: 17, title: "Dokumentation / Revisionsunterlagen unklar", cluster: "leistungsaenderung", keywords: [/dokumentation|revision|as-built|abnahmeprotokoll/i], highPotential: true },
  { id: 18, title: "Bestandsunterlagen fehlen oder unzuverlässig", cluster: "erschwernis", keywords: [/bestand|bestandsunterlage|aufnahme/i], highPotential: true },
  { id: 19, title: "Bestandssituation unzureichend beschrieben", cluster: "erschwernis", keywords: [/bestand|umbau|sanierung/i], highPotential: true },
  { id: 20, title: "Provisorien / Bauzwischenzustände nicht beschrieben", cluster: "erschwernis", keywords: [/provisor|zwischenzustand|bauphase/i], highPotential: true },
  { id: 21, title: "Bauzeit / Bauabschnitte / Taktung unklar", cluster: "erschwernis", keywords: [/bauzeit|bauabschnitt|taktung|termin/i] },
  { id: 22, title: "Zugänglichkeit / Erschwernisse nicht beschrieben", cluster: "erschwernis", keywords: [/zugänglich|erschwernis|erschwert/i] },
  { id: 23, title: "Hersteller- oder Systemvorgaben mit Zusatzpflichten", cluster: "leistungsaenderung", keywords: [/hersteller|systemvorgabe|zulassung/i] },
  { id: 24, title: "MSR-/GA-Schnittstellen unklar", cluster: "schnittstelle", keywords: [/msr|ga\b|gebäudeautomation|schnittstelle/i], highPotential: true },
  { id: 25, title: "Wartung / Einweisung / Schulung / Betreiberpflichten unklar", cluster: "leistungsaenderung", keywords: [/wartung|einweisung|schulung|betreiber/i], highPotential: true },
];

// KeyFacts, deren Fehlen Nachtragspotenzial signalisiert
const KEYFACTS_NACHTRAG_RELEVANT: Record<string, { cluster: ChangeOrderCluster; title: string }> = {
  bauzeit: { cluster: "erschwernis", title: "Bauzeit nicht angegeben" },
  baubeginn: { cluster: "erschwernis", title: "Baubeginn nicht angegeben" },
  fertigstellung: { cluster: "erschwernis", title: "Fertigstellung/Abnahme nicht angegeben" },
  ausfuehrungsfrist: { cluster: "erschwernis", title: "Ausführungsfrist/Terminplan nicht angegeben" },
  wartung_instandhaltung: { cluster: "leistungsaenderung", title: "Wartung/Instandhaltung nicht definiert" },
};

// ================= Regelbasierte Baseline =================

function matchSource(text: string): { source: typeof NACHTRAG_SOURCES[0]; snippet: string } | null {
  const lower = `${text}`.toLowerCase();
  for (const src of NACHTRAG_SOURCES) {
    for (const re of src.keywords) {
      const m = text.match(re);
      if (m) {
        return { source: src, snippet: m[0].slice(0, 120) };
      }
    }
  }
  return null;
}

function findingToCluster(f: FindingInput): ChangeOrderCluster | null {
  const text = `${f.title} ${f.detail ?? ""}`.toLowerCase();
  const cat = (f.category ?? "").toLowerCase();

  if (/schnittstelle|bauseits|vorleistung|gewerk|msr|ga\b/.test(text) || cat.includes("schnittstelle")) {
    return "schnittstelle";
  }
  if (/mengen|masse|aufmaß|pauschal|m²|m³|dimension|rohr|kanal|dämmung|brand|schall/.test(text) || cat.includes("mengen")) {
    return "leistungsmehrung";
  }
  if (/bestand|umbau|provisor|bauzeit|zugänglich|erschwernis/.test(text)) {
    return "erschwernis";
  }
  return "leistungsaenderung";
}

function severityToPotential(sev: string): "low" | "medium" | "high" {
  if (sev === "high") return "medium";
  if (sev === "medium") return "medium";
  return "low";
}

function severityToAssertiveness(sev: string): "schwach" | "mittel" | "stark" {
  if (sev === "high") return "stark";
  if (sev === "medium") return "mittel";
  return "schwach";
}

let _idCounter = 0;
function nextId() {
  _idCounter += 1;
  return `NACHTRAG_${_idCounter}`;
}

/** @deprecated Intern ersetzt durch runChangePotentialEngine + mapChangePotentialSummaryToLegacy (changePotentialModel). Nur noch für Referenz/Tests vorhanden. */
export function runRuleBasedBaseline(input: ChangeOrderInput): ChangeOrderOpportunity[] {
  const out: ChangeOrderOpportunity[] = [];
  _idCounter = 0;

  // 1) Findings → Opportunities (Legacy)
  for (const f of input.findings) {
    const cluster = findingToCluster(f);
    if (!cluster) continue;

    const match = matchSource(`${f.title} ${f.detail ?? ""}`);
    const source = match?.source ?? NACHTRAG_SOURCES.find((s) => s.cluster === cluster);
    if (!source) continue;

    const riskLevel = (f as any).severity === "high" ? "high" : (f as any).severity === "medium" ? "medium" : "low";
    const potential = source.highPotential ? "high" : source.title.toLowerCase().includes("vollständig") ? "low" : "medium";

    out.push({
      id: nextId(),
      cluster,
      title: source.title,
      description: f.detail ?? f.title,
      potential,
      riskLevel: riskLevel as "low" | "medium" | "high",
      assertiveness: severityToAssertiveness(riskLevel),
      reason: f.detail ?? f.title,
      sourceFindingIds: [f.id],
      sourceTextSnippets: match ? [match.snippet] : [f.title.slice(0, 100)],
      sourceType: ["finding"],
    });
  }

  // 2) RiskClauses (Vortext-Risiken) → Opportunities
  for (const r of input.riskClauses) {
    const match = matchSource(`${r.type} ${r.text} ${r.interpretation ?? ""}`);
    const source = match?.source ?? NACHTRAG_SOURCES[0];
    const cluster = source.cluster;

    const riskLevel = r.riskLevel === "high" ? "high" : r.riskLevel === "medium" ? "medium" : "low";
    const potential = source.highPotential ? "high" : source.title.toLowerCase().includes("vollständig") ? "low" : "medium";

    out.push({
      id: nextId(),
      cluster,
      title: source.title,
      description: r.interpretation ?? r.type,
      potential,
      riskLevel: riskLevel as "low" | "medium" | "high",
      assertiveness: severityToAssertiveness(riskLevel),
      reason: r.interpretation ?? r.text.slice(0, 200),
      sourceFindingIds: [],
      sourceTextSnippets: [r.text.slice(0, 150)],
      sourceType: ["preface"],
    });
  }

  // 3) Fehlende KeyFacts → Opportunities
  for (const [key, meta] of Object.entries(KEYFACTS_NACHTRAG_RELEVANT)) {
    const val = (input.keyFacts[key] ?? "").trim();
    if (val && val.length > 3) continue;

    out.push({
      id: nextId(),
      cluster: meta.cluster,
      title: meta.title,
      description: `KeyFact "${key}" fehlt oder ist leer.`,
      potential: "medium",
      riskLevel: "medium",
      assertiveness: "mittel",
      reason: `Fehlender KeyFact: ${key}`,
      sourceFindingIds: [],
      sourceTextSnippets: [],
      sourceType: ["keyfact"],
    });
  }

  return out;
}

// ================= Deduplizierung =================

function similarity(a: ChangeOrderOpportunity, b: ChangeOrderOpportunity): number {
  const ta = `${a.title} ${a.reason}`.toLowerCase();
  const tb = `${b.title} ${b.reason}`.toLowerCase();
  if (ta === tb) return 1;
  const wordsA = new Set(ta.split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(tb.split(/\s+/).filter((w) => w.length > 3));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size, 1);
}

function deduplicate(opps: ChangeOrderOpportunity[], threshold = 0.6): ChangeOrderOpportunity[] {
  const out: ChangeOrderOpportunity[] = [];
  for (const o of opps) {
    const dup = out.find((e) => e.cluster === o.cluster && similarity(e, o) >= threshold);
    if (dup) {
      dup.sourceFindingIds = [...new Set([...(dup.sourceFindingIds ?? []), ...(o.sourceFindingIds ?? [])])];
      dup.sourceTextSnippets = [...new Set([...(dup.sourceTextSnippets ?? []), ...(o.sourceTextSnippets ?? [])])].slice(0, 5);
      dup.sourceType = [...new Set([...(dup.sourceType ?? []), ...(o.sourceType ?? [])])];
      if (o.potential === "high" && dup.potential !== "high") dup.potential = "high";
    } else {
      out.push({ ...o });
    }
  }
  return out;
}

// ================= LLM Nachtragsanalyse =================

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_VORTEXT_CHARS = 10000;
const MAX_POSITIONS_CHARS = 6000;

/** Interner LLM-Prompt für direkte LV-Nachtragsanalyse (Vortext + LV-Auszüge) */
export const NACHTRAG_LLM_PROMPT = `Du analysierst einen TGA-Ausschreibungs-VORTEXT und relevante LV-Auszüge auf mögliche Nachtragspotenziale (Change Orders).

WICHTIGE REGELN:
- Keine freie Fantasie. Nur Nachtragspotenziale nennen, die sich KONKRET aus dem Text ableiten lassen.
- Eher konservativ als spekulativ.
- Vollständigkeitsklauseln NICHT automatisch als starkes Nachtragspotenzial bewerten (oft hohes Risiko, aber geringes echtes Nachtragspotenzial).
- Zwischen Risiko und echtem Nachtragspotenzial unterscheiden.
- evidence/snippets: wörtliche Textstellen aus dem Dokument.

FOKUS auf:
- Unklare Leistungsabgrenzungen
- Pauschale Nebenleistungsforderungen
- Unklare Prüf-/Dokumentationspflichten (Druckprüfung, Spülung, Dokumentation)
- Bestands- und Umbauunsicherheiten
- bauseits / Vorleistungen / Schnittstellen
- Mengen- und Massenunsicherheiten
- Bauablauf / Provisorien / Erschwernisse
- MSR-/GA-Schnittstellen
- Wartung / Einweisung / Betreiberleistungen

CLUSTER:
- leistungsaenderung: Änderung der Leistung (nicht mehr Leistung, sondern andere/unklare Abgrenzung)
- leistungsmehrung: Zusätzliche Leistung (Mengen, Dimensionen, Dämmung, Brand/Schall)
- schnittstelle: Bauseits, Vorleistungen, Gewerke, MSR/GA
- erschwernis: Bestand, Provisorien, Bauzeit, Zugänglichkeit

Antworte NUR mit gültigem JSON:
{
  "opportunities": [
    {
      "title": "...",
      "cluster": "leistungsaenderung | leistungsmehrung | schnittstelle | erschwernis",
      "potential": "low | medium | high",
      "riskLevel": "low | medium | high",
      "assertiveness": "schwach | mittel | stark",
      "reason": "...",
      "evidence": ["...", "..."]
    }
  ]
}

Maximal 12 opportunities.`;

/**
 * Legacy-LLM-Nachtragsanalyse (freie LLM-Suche). Wird nur noch für Debug/Vergleich aufgerufen;
 * Ergebnis fließt nicht mehr in die produktiven opportunities/byCluster.
 * @deprecated Nur noch Debug/Compare; produktiv ist die ChangePotential-Engine + optionale refineChangePotentialWithLlm führend.
 */
export async function runLlmChangeOrderAnalysis(
  vortext: string,
  lvPositions?: string
): Promise<ChangeOrderOpportunity[]> {
  if (!process.env.OPENAI_API_KEY || !vortext?.trim()) return [];

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const vortextSlice = vortext.slice(0, MAX_VORTEXT_CHARS);
  const positionsSlice = (lvPositions ?? "").slice(0, MAX_POSITIONS_CHARS);
  const textBlock = positionsSlice
    ? `VORTEXT:\n${vortextSlice}\n\n---\nLV-POSITIONEN (Auszug):\n${positionsSlice}`
    : `VORTEXT:\n${vortextSlice}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.15,
      max_tokens: 2500,
      messages: [
        { role: "system", content: "Du gibst ausschließlich gültiges JSON zurück. Kein anderer Text." },
        { role: "user", content: `${NACHTRAG_LLM_PROMPT}\n\n${textBlock}` },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```json?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const arr = Array.isArray(parsed?.opportunities) ? parsed.opportunities : [];
    const out: ChangeOrderOpportunity[] = [];

    for (let i = 0; i < arr.length; i++) {
      const o = arr[i] as Record<string, unknown>;
      const title = String(o?.title ?? "").trim();
      if (!title) continue;

      const cluster = ["leistungsaenderung", "leistungsmehrung", "schnittstelle", "erschwernis"].includes(
        String(o?.cluster ?? "")
      )
        ? (o.cluster as ChangeOrderCluster)
        : "leistungsaenderung";

      const potential = ["low", "medium", "high"].includes(String(o?.potential ?? ""))
        ? (o.potential as "low" | "medium" | "high")
        : "medium";

      const riskLevel = ["low", "medium", "high"].includes(String(o?.riskLevel ?? ""))
        ? (o.riskLevel as "low" | "medium" | "high")
        : "medium";

      const assertiveness = ["schwach", "mittel", "stark"].includes(String(o?.assertiveness ?? ""))
        ? (o.assertiveness as "schwach" | "mittel" | "stark")
        : "mittel";

      const evidence = Array.isArray(o?.evidence)
        ? (o.evidence as string[]).filter((x): x is string => typeof x === "string").slice(0, 5)
        : [];

      out.push({
        id: `NACHTRAG_LLM_${i + 1}`,
        cluster,
        title,
        description: String(o?.reason ?? "").trim() || title,
        potential,
        riskLevel,
        assertiveness,
        reason: String(o?.reason ?? "").trim() || title,
        sourceFindingIds: [],
        sourceTextSnippets: evidence,
        sourceType: ["llm"],
      });
    }

    return out;
  } catch {
    return [];
  }
}

// ================= Hauptfunktion =================

/** Grund, warum die KI-Veredelung trotz Anforderung nicht ausgeführt wurde (für transparente UI-Anzeige). */
export type ChangePotentialLlmReasonNotUsed =
  | "disabled_by_env"
  | "missing_api_key"
  | "not_requested"
  | "error"
  | null;

export type ChangeOrderResult = {
  opportunities: ChangeOrderOpportunity[];
  byCluster: Record<ChangeOrderCluster, ChangeOrderOpportunity[]>;
  debug: {
    ruleBasedCount: number;
    /** Legacy-LLM-Anzahl (nur gesetzt wenn Legacy-LLM für Debug/Vergleich lief; nicht mehr in opportunities gemischt). */
    llmCount: number;
    deduplicatedCount: number;
    /** true wenn refineChangePotentialWithLlm (neue LLM-Veredelung) ausgeführt wurde. */
    usedChangePotentialLlm?: boolean;
    /** true wenn runLlmChangeOrderAnalysis (Legacy) für Debug/Vergleich ausgeführt wurde. */
    usedLegacyLlm?: boolean;
    /** true wenn der Request die KI-Veredelung angefordert hat (useChangePotentialLlm bzw. Fallback useLlm). */
    requestedChangePotentialLlm?: boolean;
    /** true wenn serverseitig Env + API-Key die Veredelung erlauben würden. */
    changePotentialLlmAvailable?: boolean;
    /** Wenn angefordert, aber nicht ausgeführt: Grund (für Statusanzeige im UI). */
    reasonIfNotUsed?: ChangePotentialLlmReasonNotUsed;
    /** Experten-Diagnose: Env-Flag CHANGE_POTENTIAL_LLM_ENABLED === "true". */
    changePotentialLlmEnvEnabled?: boolean;
    /** Experten-Diagnose: Rohwert des Env-Flags (niemals API-Key). "true" | "false" | "" | null. */
    changePotentialLlmEnvRaw?: string | null;
    /** Experten-Diagnose: OPENAI_API_KEY gesetzt (nur true/false, niemals Key-Wert). */
    openAiApiKeyPresent?: boolean;
    /** Wenn angefordert, aber nicht ausgeführt: alle zutreffenden Blocker (z. B. env + api_key). */
    reasonDetails?: ("disabled_by_env" | "missing_api_key" | "error")[];
    /** KI-Veredelung: Timeout überschritten (Fallback auf Regel-Engine). */
    llmRefinementTimedOut?: boolean;
    /** KI-Veredelung: Dauer in ms (nur gesetzt wenn Veredelung angefragt/gestartet). */
    llmRefinementDurationMs?: number;
    /** KI-Veredelung: Aufruf fehlgeschlagen (Timeout oder anderer Fehler). */
    llmRefinementFailed?: boolean;
    /** KI-Veredelung: Fehlergrund (z. B. LLM_REFINEMENT_TIMEOUT oder Exception-Message). */
    llmRefinementFailureReason?: string | null;
    /** Anzahl der zur KI geschickten Items (Verschlankung). */
    refinedItemAttemptCount?: number;
    /** Zeichenzahl des gesamten Prompts. */
    promptCharCount?: number;
    /** Zeichenzahl Kontext (Vortext/Positionen/KeyFacts). */
    contextCharCount?: number;
    /** Verwendetes Modell für KI-Veredelung. */
    modelUsed?: string;
    /** Modus der Veredelung (z. B. top3_text_only). */
    llmRefinementMode?: string;
    /** Anzahl der Items, die die KI erfolgreich veredelt hat. */
    refinedItemSuccessCount?: number;
    /** Anzahl der Items, die pro Item-Timeout abgebrochen wurden. */
    perItemTimeoutCount?: number;
    /** Gesamtdauer aller LLM-Aufrufe in ms (innerhalb der Veredelung). */
    totalLlmDurationMs?: number;
  };
  /** Transparente Aufschlüsselung der Score-Berechnung (Nachtragspotenzial-Index). */
  scoreBreakdown?: import("./changePotentialModel").ChangePotentialScoreBreakdown;
  /** Wichtigste Items für Anzeige/Management-Sicht (5–8 Items, stabil sortiert). */
  topItemsForDisplay?: import("./changePotentialModel").ChangePotentialItem[];
  /** Deterministische Sofortmaßnahmen aus ChangePotential (Fallback, wenn LLM leer ist). */
  deterministicImmediateActions?: string[];
  /** Version der Scoring-Logik (z. B. "cp_score_v2"). */
  scoreVersion?: string;
  /** Neue Engine-Struktur (additiv); für API/Frontend. Fehlt bei reinem LLM-Pfad. */
  changePotentialSummary?: ChangePotentialSummary;
  /** Aus ChangePotentialItems abgeleitete Maßnahmen (Rückfragen, Klarstellungen, Kalkulation, Monitoring). */
  commercialActionsFromChangePotential?: import("./changePotentialCommercialActions").CommercialActionsFromChangePotential;
  /** Management Summary + Strategievarianten auf Dokumentebene (KI, nur auf Basis bestehender CP-Ergebnisse). */
  offerStrategySummary?: import("./changePotentialModel").OfferStrategySummary;
  /** Systemlogik-Lückenanalyse (LV-Text); fail-safe: nur gesetzt wenn Engine ohne Fehler lief. */
  systemLogic?: import("./system-logic").SystemLogicResult;
}

/** Intern: neues Kernmodell (ChangePotentialSummary) für spätere Erweiterungen/API. */
export function getChangePotentialSummary(input: ChangeOrderInput): ChangePotentialSummary {
  return runChangePotentialEngine({
    findings: input.findings,
    riskClauses: input.riskClauses,
    keyFacts: input.keyFacts,
    vortext: input.vortext,
    lvPositions: input.lvPositions,
  });
}

/** Max. Wartezeit für die KI-Veredelung; danach Fallback auf regelbasierte Summary. */
const LLM_REFINEMENT_TIMEOUT_MS = 20000;

function timeoutPromise<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

export async function runChangeOrderAnalysis(input: ChangeOrderInput): Promise<ChangeOrderResult> {
  const t0Engine = Date.now();
  let summary = runChangePotentialEngine({
    findings: input.findings,
    riskClauses: input.riskClauses,
    keyFacts: input.keyFacts,
    vortext: input.vortext,
    lvPositions: input.lvPositions,
  });
  if (process.env.NODE_ENV !== "test") {
    console.log("[changeOrderAnalysis] regelbasierte Engine fertig, Dauer ms:", Date.now() - t0Engine);
  }

  const requestedChangePotentialLlm =
    input.useChangePotentialLlm === true ||
    (input.useChangePotentialLlm == null && input.useLlm === true);

  const envRaw = process.env.CHANGE_POTENTIAL_LLM_ENABLED ?? null;
  const changePotentialLlmEnvEnabled = process.env.CHANGE_POTENTIAL_LLM_ENABLED === "true";
  const openAiApiKeyPresent = !!process.env.OPENAI_API_KEY;
  const changePotentialLlmAvailable = changePotentialLlmEnvEnabled && openAiApiKeyPresent;

  let usedChangePotentialLlm = false;
  let reasonIfNotUsed: ChangePotentialLlmReasonNotUsed = null;
  const reasonDetails: ("disabled_by_env" | "missing_api_key" | "error")[] = [];

  let llmRefinementTimedOut = false;
  let llmRefinementDurationMs: number | undefined;
  let llmRefinementFailed = false;
  let llmRefinementFailureReason: string | null = null;

  if (!requestedChangePotentialLlm) {
    reasonIfNotUsed = "not_requested";
  } else {
    if (process.env.CHANGE_POTENTIAL_LLM_ENABLED !== "true") {
      reasonIfNotUsed = reasonIfNotUsed ?? "disabled_by_env";
      reasonDetails.push("disabled_by_env");
    }
    if (!process.env.OPENAI_API_KEY) {
      reasonIfNotUsed = reasonIfNotUsed ?? "missing_api_key";
      reasonDetails.push("missing_api_key");
    }
  }

  if (requestedChangePotentialLlm && changePotentialLlmAvailable) {
    const t0Llm = Date.now();
    if (process.env.NODE_ENV !== "test") {
      console.log("[changeOrderAnalysis] LLM-Veredelung start");
    }
    try {
      summary = await Promise.race([
        refineChangePotentialWithLlm(summary, {
          vortext: input.vortext,
          lvPositions: input.lvPositions,
          keyFacts: input.keyFacts,
          findings: input.findings,
          riskClauses: input.riskClauses,
        }),
        timeoutPromise<ChangePotentialSummary>(
          LLM_REFINEMENT_TIMEOUT_MS,
          "LLM_REFINEMENT_TIMEOUT"
        ),
      ]);
      usedChangePotentialLlm = true;
      reasonIfNotUsed = null;
      reasonDetails.length = 0;
      llmRefinementDurationMs = Date.now() - t0Llm;
      if (process.env.NODE_ENV !== "test") {
        console.log("[changeOrderAnalysis] LLM-Veredelung Ende, Dauer ms:", llmRefinementDurationMs);
      }
    } catch (e) {
      llmRefinementDurationMs = Date.now() - t0Llm;
      llmRefinementFailed = true;
      llmRefinementFailureReason = e instanceof Error ? e.message : String(e);
      llmRefinementTimedOut = llmRefinementFailureReason.includes("LLM_REFINEMENT_TIMEOUT");
      if (requestedChangePotentialLlm) {
        reasonIfNotUsed = "error";
        reasonDetails.push("error");
      }
      if (process.env.NODE_ENV !== "test") {
        console.warn(
          "[changeOrderAnalysis] LLM-Veredelung Fallback, Dauer ms:",
          llmRefinementDurationMs,
          "Timeout:",
          llmRefinementTimedOut
        );
      }
      // Summary bleibt die regelbasierte Version (kein Overwrite).
    }
  }

  // Optionale KI-Strategiebewertung pro Item (Top 5–8); bei Fehler läuft Pipeline weiter.
  try {
    summary = await enrichChangePotentialWithCommercialStrategy(summary);
  } catch {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[changeOrderAnalysis] Commercial-Strategy-Anreicherung Fehler");
    }
  }

  try {
    summary = await buildNegotiationClusters(summary);
  } catch {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[changeOrderAnalysis] Negotiation-Clusters Fehler");
    }
  }

  const baseline = mapChangePotentialSummaryToLegacy(summary);

  // Legacy-LLM nur noch für Debug/Vergleich; NICHT mehr an die UI-Checkbox gekoppelt.
  let legacyLlmCount = 0;
  let usedLegacyLlm = false;
  if (
    process.env.CHANGE_ORDER_LEGACY_LLM_DEBUG === "true" &&
    process.env.OPENAI_API_KEY &&
    (input.vortext?.trim() || input.lvPositions?.trim())
  ) {
    const llmOpps = await runLlmChangeOrderAnalysis(input.vortext ?? "", input.lvPositions);
    legacyLlmCount = llmOpps.length;
    usedLegacyLlm = true;
    // llmOpps bewusst nicht in produktive Daten mischen
  }

  const merged = baseline;
  const deduped = deduplicate(merged);

  const byCluster: Record<ChangeOrderCluster, ChangeOrderOpportunity[]> = {
    leistungsaenderung: deduped.filter((o) => o.cluster === "leistungsaenderung"),
    leistungsmehrung: deduped.filter((o) => o.cluster === "leistungsmehrung"),
    schnittstelle: deduped.filter((o) => o.cluster === "schnittstelle"),
    erschwernis: deduped.filter((o) => o.cluster === "erschwernis"),
  };

  const commercialActionsFromChangePotential = deriveCommercialActionsFromChangePotential(summary);

  function buildDeterministicImmediateActions(): string[] {
    const actions = commercialActionsFromChangePotential;
    const candidates: Array<{ text: string; score: number }> = [];

    const severityRank: Record<"low" | "medium" | "high", number> = {
      low: 1,
      medium: 2,
      high: 3,
    };

    for (const q of actions.questions) {
      const sev = severityRank[q.severity] ?? 2;
      const score = sev * 2.2; // Rückfragen sind starke Sofortmaßnahmen
      candidates.push({ text: `Rückfrage: ${q.question}`, score });
    }
    for (const c of actions.clarifications) {
      const sev = severityRank[c.severity] ?? 2;
      const score = sev * 2.0;
      candidates.push({ text: `Klarstellung: ${c.clarification}`, score });
    }
    for (const p of actions.pricingHints) {
      const score = 2.5; // Kalkulationshinweise sind wichtig, aber meist weniger dringend als Rückfragen
      candidates.push({ text: `Kalkulation: ${p.hint}`, score });
    }
    for (const m of actions.monitoringHints) {
      const score = 1.8;
      candidates.push({ text: `Monitoring: ${m.hint}`, score });
    }

    const sorted = candidates
      .filter((c) => c.text.trim().length > 0)
      .sort((a, b) => b.score - a.score);

    return sorted.slice(0, 3).map((c) => c.text);
  }

  let offerStrategySummary: import("./changePotentialModel").OfferStrategySummary | undefined;
  try {
    const oss = await buildOfferStrategySummary(summary, commercialActionsFromChangePotential);
    if (oss) offerStrategySummary = oss;
  } catch {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[changeOrderAnalysis] Offer-Strategy-Summary Fehler");
    }
  }

  let systemLogicResult: import("./system-logic").SystemLogicResult | undefined;
  try {
    const vortext = input.vortext ?? "";
    const positionsText = input.lvPositions ?? "";
    const combinedText = [vortext, positionsText].filter(Boolean).join("\n").trim() || vortext + " " + positionsText;
    systemLogicResult = runSystemLogicEngine({ vortext, positionsText, combinedText });
  } catch (_e) {
    // fail-safe: bei Fehler keine systemLogic setzen
  }

  return {
    opportunities: deduped,
    byCluster,
    debug: {
      ruleBasedCount: baseline.length,
      llmCount: legacyLlmCount,
      deduplicatedCount: deduped.length,
      usedChangePotentialLlm,
      usedLegacyLlm,
      requestedChangePotentialLlm,
      changePotentialLlmAvailable,
      reasonIfNotUsed,
      changePotentialLlmEnvEnabled,
      changePotentialLlmEnvRaw: envRaw,
      openAiApiKeyPresent,
      ...(reasonDetails.length > 0 && { reasonDetails }),
      ...(llmRefinementDurationMs != null && { llmRefinementDurationMs }),
      ...(llmRefinementTimedOut && { llmRefinementTimedOut }),
      ...(llmRefinementFailed && { llmRefinementFailed }),
      ...(llmRefinementFailureReason != null && { llmRefinementFailureReason }),
      ...(summary.llmMeta?.refinedItemAttemptCount != null && { refinedItemAttemptCount: summary.llmMeta.refinedItemAttemptCount }),
      ...(summary.llmMeta?.promptCharCount != null && { promptCharCount: summary.llmMeta.promptCharCount }),
      ...(summary.llmMeta?.contextCharCount != null && { contextCharCount: summary.llmMeta.contextCharCount }),
      ...(summary.llmMeta?.usedModel && { modelUsed: summary.llmMeta.usedModel }),
      ...(summary.llmMeta?.llmRefinementMode && { llmRefinementMode: summary.llmMeta.llmRefinementMode }),
      ...(summary.llmMeta?.refinedItemSuccessCount != null && { refinedItemSuccessCount: summary.llmMeta.refinedItemSuccessCount }),
      ...(summary.llmMeta?.perItemTimeoutCount != null && { perItemTimeoutCount: summary.llmMeta.perItemTimeoutCount }),
      ...(summary.llmMeta?.totalLlmDurationMs != null && { totalLlmDurationMs: summary.llmMeta.totalLlmDurationMs }),
    },
    changePotentialSummary: summary,
    commercialActionsFromChangePotential,
    scoreBreakdown: summary.scoreBreakdown,
    topItemsForDisplay: summary.topItemsForDisplay,
    deterministicImmediateActions: buildDeterministicImmediateActions(),
    scoreVersion: summary.scoreVersion,
    ...(offerStrategySummary && { offerStrategySummary }),
    ...(systemLogicResult != null && { systemLogic: systemLogicResult }),
  };
}
