import type { ChangePotentialSummary, ChangePotentialItem } from "../changePotentialModel";
import type { NachtragEvidenceV2 } from "./types";
import { resolveFamilyFromText } from "./families";

function familyFromItem(item: ChangePotentialItem): string {
  const text = `${item.title ?? ""} ${item.reasoning ?? ""} ${item.sourceQuote ?? ""}`.trim();
  return resolveFamilyFromText(text);
}

function subscoresFromFieldType(item: ChangePotentialItem): NachtragEvidenceV2["subscoreTargets"] {
  switch (item.fieldType) {
    case "mengenrisiko":
      return ["ausfuehrung_mengen"];
    case "dokumentation_inbetriebnahme":
      return ["doku_ibn"];
    case "schnittstelle":
    case "nebenleistung":
    case "leistungsabgrenzung":
      return ["vertrags_abgrenzung"];
    default:
      return ["vertrags_abgrenzung"];
  }
}

function weightFromItem(item: ChangePotentialItem): number {
  const impact = item.impactLevel === "sehr_hoch" ? 4 : item.impactLevel === "hoch" ? 3 : item.impactLevel === "mittel" ? 2 : 1;
  const conf = Number.isFinite(item.confidence) ? Math.max(0.1, Math.min(1, item.confidence)) : 0.5;
  const enforceabilityFactor =
    item.enforceability === "sehr_gut" ? 1.2 : item.enforceability === "gut" ? 1.1 : item.enforceability === "mittel" ? 1.0 : 0.9;
  return Math.max(0.5, Math.min(12, impact * 3.0 * conf * enforceabilityFactor));
}

export function mapChangePotentialSummaryToNachtragEvidences(summary: ChangePotentialSummary): NachtragEvidenceV2[] {
  const items = Array.isArray(summary.items) ? summary.items : [];

  return items.map((it) => {
    const title = it.title ?? "";
    const detail = it.reasoning ?? "";
    const raw_excerpt = it.sourceQuote ?? "";

    return {
      id: String(it.id),
      title: title,
      family: familyFromItem(it),
      signalType: "commodity",
      riskDirection: "both",
      subscoreTargets: subscoresFromFieldType(it),
      sourceContext: it.sourceType === "vortext" ? "vortext" : it.sourceType === "position" ? "position" : "unknown",
      confidence: it.confidence,
      rawWeight: weightFromItem(it),
      meta: {
        title,
        detail,
        raw_excerpt,
        triggerName: "",
        triggerCategory: "",
        fieldType: it.fieldType,
        mechanism: it.changeMechanism,
        sourceType: it.sourceType,
      },
    };
  });
}

