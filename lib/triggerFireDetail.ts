/**
 * Read-only Daten für Admin: Trigger-Detail aus trigger_fires + optional triggers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbTrigger } from "@/lib/analyzeLvText";
import { getSupabaseServiceRole } from "@/lib/billing/stripeProfileSync";
import { isUuidString } from "@/lib/triggerFiresLog";
import type { AnalyseRunLabels } from "@/lib/triggerFiresInsights";

const PAGE = 1000;
const MAX_AGG_SCAN = 250_000;
const RECENT_LIMIT = 120;

const TRIGGER_SELECT = `
  id,
  name,
  description,
  category,
  trigger_type,
  keywords,
  regex,
  norms,
  weight,
  claim_level,
  risk_interpretation,
  user_hint,
  question_template,
  offer_text_template,
  is_active,
  disciplines,
  context_required,
  exclude_keywords,
  match_scope
`;

const FIRE_DETAIL_SELECT = `
  analysis_id,
  created_at,
  trigger_name_snapshot,
  trigger_category_snapshot,
  discipline_context,
  matched_excerpt,
  is_top_risk,
  source_scope,
  match_type,
  matched_keyword,
  matched_pattern,
  score_impact,
  severity_level
`;

export type TriggerFireRowDetail = {
  analysis_id: string;
  created_at: string;
  trigger_name_snapshot: string | null;
  trigger_category_snapshot: string | null;
  discipline_context: string | null;
  matched_excerpt: string | null;
  is_top_risk: boolean;
  source_scope: string | null;
  match_type: string | null;
  matched_keyword: string | null;
  matched_pattern: string | null;
  score_impact: number | null;
  severity_level: string | null;
};

export type DistributionRow = { key: string; count: number };

export type TriggerFireDetailPayload =
  | { ok: false; error: string }
  | {
      ok: true;
      triggerId: string;
      currentTrigger: DbTrigger | null;
      /** Aus jüngstem Fire, falls sinnvoll */
      latestSnapshotName: string | null;
      latestSnapshotCategory: string | null;
      stats: {
        totalFires: number;
        analysesWithFires: number;
        topRiskCount: number;
        topRiskShare: number;
        lastFireAt: string | null;
        statsPartial: boolean;
      };
      recentFires: TriggerFireRowDetail[];
      firesByAnalysis: DistributionRow[];
      firesByDiscipline: DistributionRow[];
      analyseLabelsById: Record<string, AnalyseRunLabels>;
    };

function shorten(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

/** Verständliche Einordnung des gespeicherten Scopes (nur heuristisch). */
export function humanizeSourceScope(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v || v === "lv_full") {
    return "Im gespeicherten Snapshot: Auswertung über den zusammengeführten LV-Text (Vorbemerkung und Positionen, je nach Import).";
  }
  if (v === "vortext_only") {
    return "Im Snapshot: Fokus auf Vorbemerkung/Vortext, nicht auf alle Positionen.";
  }
  return `Technischer Scope-Kennwert im Snapshot: „${String(raw).trim()}“ (Details siehe aktuelle Regel in /admin/triggers).`;
}

/** Kompakte technische Zeile (ohne Fließtext) für die Fire-Tabelle. */
export function humanizeSourceScopeShort(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v || v === "lv_full") return "Zusammengeführter LV-Text (Flag: lv_full oder leer).";
  if (v === "vortext_only") return "Schwerpunkt Vortext/Vorbemerkung (Flag: vortext_only).";
  return `Unbekanntes oder projektspezifisches Scope-Flag: „${String(raw).trim()}“.`;
}

export function humanizeMatchTypeForLayperson(matchType: string | null | undefined): string {
  const m = (matchType ?? "").toLowerCase().trim();
  if (m === "regex") return "Der Trigger nutzt ein Suchmuster (regulärer Ausdruck).";
  if (m === "keyword") return "Der Trigger sucht nach definierten Schlüsselwörtern im Text.";
  if (!m) return "";
  return `Technischer Match-Typ im Snapshot: „${matchType}“.`;
}

export type FireRowTechnicalLine = { label: string; value: string };

/**
 * Strukturierte Darstellung pro Fire: fachliche Bausteine (Pflege + Snapshot) und technische Nachvollziehbarkeit getrennt.
 * Keine neue Bewertungslogik – nur aus vorhandenen Feldern, ohne Spekulation.
 */
export function buildFireRowPresentation(row: TriggerFireRowDetail, trigger: DbTrigger | null): {
  signalImLv: string;
  fachlichRelevant: string;
  pruefbedarf: string;
  technical: FireRowTechnicalLine[];
  thinSnapshot: boolean;
} {
  const mt = (row.match_type ?? "").toLowerCase().trim();
  const kw = row.matched_keyword?.trim() ?? "";
  const pat = row.matched_pattern?.trim() ?? "";
  const excerpt = row.matched_excerpt?.trim() ?? "";

  let signalImLv: string;
  if (mt === "keyword" && kw) {
    signalImLv = `Im LV wurde ein gepflegter Begriff bzw. ein Schlüsselwort-Kontext erkannt: „${shorten(kw, 160)}“.`;
  } else if (mt === "keyword" && !kw) {
    signalImLv = excerpt
      ? "Schlüsselwort-Logik (match_type keyword), aber ohne gespeichertes Einzeltrefferwort im Fire – der LV-Auszug zeigt den Kontext."
      : "Schlüsselwort-Logik (match_type keyword), ohne Trefferwort und ohne LV-Auszug im Snapshot.";
  } else if (mt === "regex") {
    if (pat && kw) {
      signalImLv = `RegEx-Trigger: das hinterlegte Muster (technische Zeile „matched_pattern“) hat im LV ein konkretes Fragment erzeugt: „${shorten(kw, 160)}“.`;
    } else if (pat) {
      signalImLv = `RegEx-Trigger mit hinterlegtem Muster (Vorschau: „${shorten(pat, 120)}“); das konkret gematchte Textfragment ist im Snapshot nicht als matched_keyword hinterlegt${excerpt ? " – siehe LV-Auszug" : ""}.`;
    } else {
      signalImLv =
        "Auslösung über RegEx-Logik; im Fire-Snapshot ist keine Muster-Vorschau gespeichert – fachliche Einordnung nur über LV-Auszug oder Trigger-Pflege.";
    }
  } else if (kw) {
    signalImLv = `Treffer-Hinweis im Snapshot (ohne klaren match_type): „${shorten(kw, 160)}“.`;
  } else if (excerpt) {
    signalImLv =
      "Konkretes Schlüsselwort oder Muster ist im Snapshot nicht hinterlegt; der gespeicherte LV-Auszug zeigt die Fundstelle.";
  } else {
    signalImLv =
      "Im Fire-Snapshot fehlen Schlüsselwort, Muster-Vorschau und Textauszug – die Auslösung ist technisch protokolliert, aber hier nicht weiter aufdröselbar.";
  }

  let fachlichRelevant: string;
  const ri = trigger?.risk_interpretation?.trim();
  const desc = trigger?.description?.trim();
  const snapCat = row.trigger_category_snapshot?.trim();
  if (ri) {
    fachlichRelevant = shorten(ri, 320);
  } else if (desc) {
    fachlichRelevant = shorten(desc, 320);
  } else if (snapCat) {
    fachlichRelevant = `In der Pflege liegt keine gesonderte Risiko-Einordnung vor. Snapshot-Kategorie zum Zeitpunkt der Analyse: „${snapCat}“.`;
  } else {
    fachlichRelevant =
      "Keine belastbare fachliche Einordnung aus diesem Fire allein: weder Risiko-Einordnung/Beschreibung in „triggers“ noch Snapshot-Kategorie vorhanden. Bitte Regel unter /admin/triggers prüfen.";
  }

  let pruefbedarf: string;
  const uh = trigger?.user_hint?.trim();
  if (uh) {
    pruefbedarf = shorten(uh, 280);
  } else if (row.severity_level?.trim()) {
    pruefbedarf = `Im Analyselauf eingestuft als „${row.severity_level.trim()}“. Typischerweise lohnt sich die fachliche Prüfung der Fundstelle im LV-Kontext; ein gesonderter Prüfhinweis (user_hint) ist nicht gepflegt.`;
  } else {
    pruefbedarf =
      "Es ist kein gesonderter Prüfhinweis (user_hint) hinterlegt und keine Schwere im Snapshot gesetzt – bitte Fundstelle und LV-Kontext bei Bedarf manuell bewerten.";
  }

  const technical: FireRowTechnicalLine[] = [
    { label: "match_type", value: row.match_type?.trim() || "—" },
    { label: "source_scope (Snapshot)", value: row.source_scope?.trim() || "—" },
    { label: "Scope (Kurzbedeutung)", value: humanizeSourceScopeShort(row.source_scope) },
  ];
  if (kw) technical.push({ label: "matched_keyword", value: shorten(kw, 200) });
  if (pat) technical.push({ label: "matched_pattern", value: shorten(pat, 200) });
  if (row.severity_level?.trim()) technical.push({ label: "severity_level", value: row.severity_level.trim() });
  if (row.score_impact != null && Number.isFinite(row.score_impact)) {
    technical.push({ label: "score_impact (Snapshot)", value: String(row.score_impact) });
  }

  const thinSnapshot = !kw && !excerpt && !(mt === "regex" && Boolean(pat));

  return { signalImLv, fachlichRelevant, pruefbedarf, technical, thinSnapshot };
}

function parseFireRow(r: Record<string, unknown>): TriggerFireRowDetail {
  return {
    analysis_id: String(r.analysis_id ?? ""),
    created_at: String(r.created_at ?? ""),
    trigger_name_snapshot: (r.trigger_name_snapshot as string | null) ?? null,
    trigger_category_snapshot: (r.trigger_category_snapshot as string | null) ?? null,
    discipline_context: (r.discipline_context as string | null) ?? null,
    matched_excerpt: (r.matched_excerpt as string | null) ?? null,
    is_top_risk: Boolean(r.is_top_risk),
    source_scope: (r.source_scope as string | null) ?? null,
    match_type: (r.match_type as string | null) ?? null,
    matched_keyword: (r.matched_keyword as string | null) ?? null,
    matched_pattern: (r.matched_pattern as string | null) ?? null,
    score_impact: r.score_impact != null && Number.isFinite(Number(r.score_impact)) ? Number(r.score_impact) : null,
    severity_level: (r.severity_level as string | null) ?? null,
  };
}

async function fetchCurrentTrigger(supabase: SupabaseClient, triggerId: string): Promise<DbTrigger | null> {
  const { data, error } = await supabase.from("triggers").select(TRIGGER_SELECT).eq("id", triggerId).maybeSingle();
  if (error) {
    console.warn("[triggerFireDetail] triggers lookup:", error.message);
    return null;
  }
  return data ? (data as DbTrigger) : null;
}

const ANALYSE_BATCH = 120;

async function fetchAnalyseLabelsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Record<string, AnalyseRunLabels>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out: Record<string, AnalyseRunLabels> = {};
  for (let i = 0; i < unique.length; i += ANALYSE_BATCH) {
    const batch = unique.slice(i, i + ANALYSE_BATCH);
    const { data, error } = await supabase.from("analyse_runs").select("id, project_name, file_name").in("id", batch);
    if (error) {
      console.warn("[triggerFireDetail] analyse_runs batch:", error.message);
      continue;
    }
    for (const row of data ?? []) {
      const r = row as { id: string; project_name: string | null; file_name: string | null };
      if (r.id) out[r.id] = { project_name: r.project_name ?? null, file_name: r.file_name ?? null };
    }
  }
  return out;
}

/** Klartext-Bausteine für „Warum schlägt dieser Trigger an?“ aus DB-Metadaten. */
export function buildWhyTriggerPlainLanguage(trigger: DbTrigger | null): string[] {
  if (!trigger) {
    return [
      "Zu dieser ID ist aktuell kein Eintrag in der Tabelle „triggers“ hinterlegt (nur historische Snapshots in trigger_fires möglich).",
    ];
  }
  const lines: string[] = [];
  if (trigger.description?.trim()) {
    lines.push(trigger.description.trim());
  }
  if (trigger.user_hint?.trim()) {
    lines.push(`Prüfhinweis für Nutzer: ${trigger.user_hint.trim()}`);
  }
  if (trigger.risk_interpretation?.trim()) {
    lines.push(`Risiko-Einordnung: ${trigger.risk_interpretation.trim()}`);
  }
  const usesRegex = Boolean(trigger.regex?.trim());
  const mtLine = humanizeMatchTypeForLayperson(usesRegex ? "regex" : "keyword");
  if (mtLine) lines.push(mtLine);

  const scopeRaw = (trigger.match_scope ?? "").trim().toLowerCase();
  if (scopeRaw === "vortext_only") {
    lines.push("Typische Fundstelle: Vorbemerkung/Vortext – weniger in den Einzelpositionen.");
  } else if (!scopeRaw || scopeRaw === "lv_full") {
    lines.push("Typische Fundstelle: im gesamten ausgewerteten LV-Text (abhängig vom Import: Vorbemerkung und/oder Positionen).");
  } else {
    lines.push(`Konfigurierter Suchbereich (match_scope): „${trigger.match_scope}“.`);
  }

  if (trigger.keywords?.length) {
    const sample = trigger.keywords.filter((k) => k && String(k).trim()).slice(0, 12);
    if (sample.length) {
      lines.push(`Beispielhafte Schlüsselbegriffe aus der Pflege: ${sample.map((k) => `„${k}“`).join(", ")}${trigger.keywords.length > 12 ? " …" : ""}`);
    }
  }
  if (trigger.regex?.trim()) {
    lines.push(
      "Zusätzlich ist ein regulärer Ausdruck hinterlegt (technische Regel – Vollansicht unter /admin/triggers)."
    );
  }
  if (lines.length === 0) {
    lines.push("Für diesen Trigger liegt in der Pflege keine ausführliche Beschreibung vor – siehe Kurzbezeichnung und Kategorie.");
  }
  return lines;
}

export async function loadTriggerFireDetail(triggerIdRaw: string): Promise<TriggerFireDetailPayload> {
  const triggerId = typeof triggerIdRaw === "string" ? triggerIdRaw.trim() : "";
  if (!isUuidString(triggerId)) {
    return { ok: false, error: "Ungültige Trigger-ID" };
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY fehlt" };
  }

  try {
    const [{ count: totalFires, error: cErr }, currentTrigger] = await Promise.all([
      supabase.from("trigger_fires").select("*", { count: "exact", head: true }).eq("trigger_id", triggerId),
      fetchCurrentTrigger(supabase, triggerId),
    ]);
    if (cErr) throw new Error(cErr.message);
    const total = totalFires ?? 0;

    const { data: recentRaw, error: rErr } = await supabase
      .from("trigger_fires")
      .select(FIRE_DETAIL_SELECT)
      .eq("trigger_id", triggerId)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT);
    if (rErr) throw new Error(rErr.message);
    const recentFires = (recentRaw ?? []).map((row) => parseFireRow(row as Record<string, unknown>));

    const latestSnapshotName = recentFires[0]?.trigger_name_snapshot ?? null;
    const latestSnapshotCategory = recentFires[0]?.trigger_category_snapshot ?? null;

    let lastFireAt: string | null = null;
    if (total > 0) {
      const { data: lastRow, error: lErr } = await supabase
        .from("trigger_fires")
        .select("created_at")
        .eq("trigger_id", triggerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lErr) throw new Error(lErr.message);
      lastFireAt = (lastRow as { created_at?: string } | null)?.created_at ?? null;
    }

    const analysisSet = new Set<string>();
    let topRiskCount = 0;
    const perAnalysis = new Map<string, number>();
    const perDisc = new Map<string, number>();
    let scanned = 0;
    let statsPartial = false;

    if (total > 0) {
      let offset = 0;
      while (offset < MAX_AGG_SCAN) {
        const to = offset + PAGE - 1;
        const { data: chunk, error: aErr } = await supabase
          .from("trigger_fires")
          .select("analysis_id, is_top_risk, created_at, discipline_context")
          .eq("trigger_id", triggerId)
          .range(offset, to);
        if (aErr) throw new Error(aErr.message);
        const rows = chunk ?? [];
        if (rows.length === 0) break;
        for (const raw of rows) {
          const r = raw as {
            analysis_id: string;
            is_top_risk?: boolean;
            created_at: string;
            discipline_context: string | null;
          };
          analysisSet.add(r.analysis_id);
          if (r.is_top_risk) topRiskCount++;
          perAnalysis.set(r.analysis_id, (perAnalysis.get(r.analysis_id) ?? 0) + 1);
          const dk = r.discipline_context?.trim() || "—";
          perDisc.set(dk, (perDisc.get(dk) ?? 0) + 1);
        }
        scanned += rows.length;
        if (rows.length < PAGE) break;
        offset += PAGE;
        if (scanned >= MAX_AGG_SCAN) {
          statsPartial = true;
          break;
        }
      }
      if (scanned < total) statsPartial = true;
    }

    const topRiskShare =
      total > 0 ? (statsPartial ? (scanned > 0 ? topRiskCount / scanned : 0) : topRiskCount / total) : 0;

    const firesByAnalysis: DistributionRow[] = [...perAnalysis.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const firesByDiscipline: DistributionRow[] = [...perDisc.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const allAnalysisIds = new Set<string>();
    for (const id of analysisSet) allAnalysisIds.add(id);
    for (const f of recentFires) allAnalysisIds.add(f.analysis_id);

    const analyseLabelsById = await fetchAnalyseLabelsByIds(supabase, [...allAnalysisIds]);

    return {
      ok: true,
      triggerId,
      currentTrigger,
      latestSnapshotName,
      latestSnapshotCategory,
      stats: {
        totalFires: total,
        analysesWithFires: analysisSet.size,
        topRiskCount,
        topRiskShare,
        lastFireAt,
        statsPartial,
      },
      recentFires,
      firesByAnalysis,
      firesByDiscipline,
      analyseLabelsById,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
