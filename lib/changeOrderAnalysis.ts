/**
 * Nachtragsanalyse – hybrid (regelbasiert + optional LLM).
 * Nutzt Findings, Vortext-Risiken, KeyFacts als harte Basis.
 * LLM optional für komplexe/indirekte Nachtragshinweise.
 */

import OpenAI from "openai";

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
  useLlm?: boolean;
};

// ================= 25 Nachtragsquellen → Cluster-Mapping =================

const NIGHTRAG_SOURCES: Array<{
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

function matchSource(text: string): { source: typeof NIGHTRAG_SOURCES[0]; snippet: string } | null {
  const lower = `${text}`.toLowerCase();
  for (const src of NIGHTRAG_SOURCES) {
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

export function runRuleBasedBaseline(input: ChangeOrderInput): ChangeOrderOpportunity[] {
  const out: ChangeOrderOpportunity[] = [];
  _idCounter = 0;

  // 1) Findings → Opportunities
  for (const f of input.findings) {
    const cluster = findingToCluster(f);
    if (!cluster) continue;

    const match = matchSource(`${f.title} ${f.detail ?? ""}`);
    const source = match?.source ?? NIGHTRAG_SOURCES.find((s) => s.cluster === cluster);
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
    const source = match?.source ?? NIGHTRAG_SOURCES[0];
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

export type ChangeOrderResult = {
  opportunities: ChangeOrderOpportunity[];
  byCluster: Record<ChangeOrderCluster, ChangeOrderOpportunity[]>;
  debug: {
    ruleBasedCount: number;
    llmCount: number;
    deduplicatedCount: number;
  };
};

export async function runChangeOrderAnalysis(input: ChangeOrderInput): Promise<ChangeOrderResult> {
  const baseline = runRuleBasedBaseline(input);
  let llmOpps: ChangeOrderOpportunity[] = [];

  if (input.useLlm && process.env.OPENAI_API_KEY && (input.vortext?.trim() || input.lvPositions?.trim())) {
    llmOpps = await runLlmChangeOrderAnalysis(input.vortext ?? "", input.lvPositions);
  }

  const merged = [...baseline, ...llmOpps];
  const deduped = deduplicate(merged);

  const byCluster: Record<ChangeOrderCluster, ChangeOrderOpportunity[]> = {
    leistungsaenderung: deduped.filter((o) => o.cluster === "leistungsaenderung"),
    leistungsmehrung: deduped.filter((o) => o.cluster === "leistungsmehrung"),
    schnittstelle: deduped.filter((o) => o.cluster === "schnittstelle"),
    erschwernis: deduped.filter((o) => o.cluster === "erschwernis"),
  };

  return {
    opportunities: deduped,
    byCluster,
    debug: {
      ruleBasedCount: baseline.length,
      llmCount: llmOpps.length,
      deduplicatedCount: deduped.length,
    },
  };
}
