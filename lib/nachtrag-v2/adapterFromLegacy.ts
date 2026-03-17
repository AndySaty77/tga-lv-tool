import type { DbTrigger } from "../analyzeLvText";
import type { NachtragEvidenceV2, NachtragRiskDirection, NachtragSubscoreKey } from "./types";
import { resolveFamilyFromTrigger, type NachtragFamilyId } from "./families";

export type LegacyFinding = {
  id: string;
  title?: string;
  detail?: string;
  category?: string;
  penalty?: number;
  raw_excerpt?: string;
};

function mapCategoryToSubscores(cat: string | undefined): NachtragSubscoreKey[] {
  const c = String(cat ?? "").toLowerCase().trim();

  if (!c) return ["vertrags_abgrenzung"];

  if (c.includes("norm") || c.includes("vertrag") || c.includes("vortext") || c.includes("nachtrag")) {
    return ["vertrags_abgrenzung"];
  }
  if (c.includes("mengen") || c.includes("schnittstellen")) {
    return ["ausfuehrung_mengen"];
  }
  if (c.includes("doku") || c.includes("ibn") || c.includes("inbetriebnahme")) {
    return ["doku_ibn"];
  }
  if (c.includes("kalkulation") || c.includes("unsicherheit")) {
    return ["durchsetzbarkeit"];
  }

  return ["vertrags_abgrenzung"];
}

function inferRiskDirection(_finding: LegacyFinding): NachtragRiskDirection {
  // Defensive Default: Mehrheit der Fälle ist wirtschaftliche Exposure.
  return "exposure";
}

export function mapLegacyToNachtragEvidence(
  findings: LegacyFinding[],
  dbTriggers: DbTrigger[]
): NachtragEvidenceV2[] {
  const byId = new Map<string, DbTrigger>();
  for (const t of dbTriggers) {
    if (t.id) byId.set(String(t.id), t);
  }

  const evidences: NachtragEvidenceV2[] = [];

  for (const f of findings) {
    const isDb = f.id && String(f.id).startsWith("DB_");
    let family: NachtragFamilyId = "generic_text_noise";

    if (isDb) {
      const triggerId = String(f.id).replace(/^DB_/, "");
      const trigger = byId.get(triggerId);
      family = resolveFamilyFromTrigger(trigger?.name, trigger?.category);
    } else if (f.category) {
      family = resolveFamilyFromTrigger(undefined, f.category);
    }

    const subscoreTargets = mapCategoryToSubscores(f.category);
    const riskDirection = inferRiskDirection(f);
    const baseWeight = Math.max(1, Math.min(10, Math.abs(Number(f.penalty ?? 0)) || 1));

    const ev: NachtragEvidenceV2 = {
      id: String(f.id ?? `LEGACY_${evidences.length}`),
      title: f.title,
      family,
      signalType: "commodity",
      riskDirection,
      subscoreTargets,
      disciplineTags: isDb && byId.get(String(f.id).replace(/^DB_/, ""))?.disciplines
        ? (byId.get(String(f.id).replace(/^DB_/, ""))!.disciplines as string[])
        : [],
      sourceContext: "unknown",
      confidence: 0.5,
      rawWeight: baseWeight,
      meta: {
        legacyCategory: f.category,
        legacyPenalty: f.penalty,
      },
    };

    evidences.push(ev);
  }

  return evidences;
}

