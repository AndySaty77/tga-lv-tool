import type { NachtragEvidenceV2 } from "./types";

export type NachtragGateContext = {
  primaryDiscipline?: string | null;
  secondaryDisciplines?: string[] | null;
};

/**
 * Defensives Gating:
 * - Keine harten Löschungen, nur Abschwächung (Weight-Faktor).
 * - Ziel: Sanitär-/Fremdgewerke-Signale nicht ungefiltert in Elektro-/Notstrom-Analysen dominieren lassen.
 */
export function applyGates(
  evidences: NachtragEvidenceV2[],
  context: NachtragGateContext
): NachtragEvidenceV2[] {
  const primary = (context.primaryDiscipline ?? "").toLowerCase();
  const secondary = (context.secondaryDisciplines ?? []).map((s) => (s ?? "").toLowerCase());

  const allowedDisciplines = new Set<string>();
  if (primary) allowedDisciplines.add(primary);
  for (const d of secondary) {
    if (d) allowedDisciplines.add(d);
  }

  return evidences.map((ev) => {
    const baseWeight =
      typeof ev.rawWeight === "number" && Number.isFinite(ev.rawWeight) ? ev.rawWeight : 0;

    let factor = 1;

    const tags = Array.isArray(ev.disciplineTags) ? ev.disciplineTags.map((t) => t.toLowerCase()) : [];
    const hasTags = tags.length > 0;
    const isGlobal = tags.includes("global");
    const matchesAnyDiscipline = tags.some((t) => allowedDisciplines.has(t));

    if (hasTags && !isGlobal && !matchesAnyDiscipline && allowedDisciplines.size > 0) {
      factor *= 0.4;
    }

    const isBroadGenericFamily =
      ev.family === "schnittstelle_allgemein" ||
      ev.family === "nebenleistung_allgemein" ||
      ev.family === "leistungsabgrenzung_allgemein" ||
      ev.family === "dokumentation_allgemein" ||
      ev.family === "inbetriebnahme_allgemein" ||
      ev.family === "mengen_unbestimmt" ||
      ev.family === "bestandsunsicherheit";

    if (isBroadGenericFamily && hasTags && !isGlobal && !matchesAnyDiscipline && allowedDisciplines.size > 0) {
      factor *= 0.7;
    }

    return {
      ...ev,
      rawWeight: baseWeight * factor,
    };
  });
}

