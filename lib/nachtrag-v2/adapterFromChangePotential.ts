import type { ChangePotentialSummary, ChangePotentialItem } from "../changePotentialModel";
import type { NachtragEvidenceV2 } from "./types";

function familyFromFieldType(item: ChangePotentialItem): string {
  const t = `${item.title ?? ""} ${item.reasoning ?? ""} ${item.sourceQuote ?? ""}`.toLowerCase();

  // Blocker / Pauschal / Vollständigkeit
  if (/\b(vollst(ä|ae)ndig|vollumf(ä|ae)nglich|komplett|pauschal|abgegolten|mit\s+dem\s+preis\s+abgegolten|inkl\.?|inklusive|nebenleistungen)\b/i.test(t)) {
    if (/\b(vollst(ä|ae)ndig|vollumf(ä|ae)nglich|komplett|funktionsverantwortung|systemverantwortung)\b/i.test(t)) {
      return "vollstaendigkeitspauschale";
    }
    return "nebenleistung_allgemein";
  }

  // Dokumentation / Prüf / Abnahme / IBN
  if (/\b(dokumentation|revision|revisionsunterlage|protokoll|nachweis|mess|pr(ü|ue)f|abnahme|inbetriebnahme|ibn)\b/i.test(t)) {
    if (/\b(abnahme|inbetriebnahme|ibn)\b/i.test(t)) return "inbetriebnahme_allgemein";
    if (/\b(pr(ü|ue)f|nachweis|mess|protokoll)\b/i.test(t)) return "pruef_mess_nachweis_allgemein";
    return "dokumentation_allgemein";
  }

  // Mengen / Aufmaß / EP / Mehrmengen
  if (/\b(menge|massen|masse|aufma(ß|ss)|einheitspreis|\bep\b|mehrmenge|mindermenge)\b/i.test(t)) {
    return "mengen_unbestimmt";
  }

  // Bauseits / Vorleistung / AG
  if (/\b(bauseits|bauherrseitig|ag-?seitig|vorleistung|durch\s+ag|auftraggeber)\b/i.test(t)) {
    return "bauseits_allgemein";
  }

  // Schnittstelle / Übergabe
  if (/\b(schnittstelle|übergabe|uebergabe|anschlussgrenze|liefergrenze|abgrenzung)\b/i.test(t)) {
    if (/\b(abgrenzung|leistungsgrenze)\b/i.test(t)) return "leistungsabgrenzung_allgemein";
    return "schnittstelle_allgemein";
  }

  switch (item.fieldType) {
    case "schnittstelle":
      return "schnittstelle_allgemein";
    case "nebenleistung":
      return "nebenleistung_allgemein";
    case "leistungsabgrenzung":
      return "leistungsabgrenzung_allgemein";
    case "mengenrisiko":
      return "mengen_unbestimmt";
    case "dokumentation_inbetriebnahme":
      // bewusst als allgemeine Doku-Familie; IBN wird über Mechanik/Reasoning im Text erkannt.
      return "dokumentation_allgemein";
    default:
      return "generic_text_noise";
  }
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
      family: familyFromFieldType(it),
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

