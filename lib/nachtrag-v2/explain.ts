import type { NachtragResultV2, NachtragSubscoresV2 } from "./types";
import type { AnchorEventResult, CommodityCapResult } from "./types";
import type { EnforceabilityAnalysis } from "./enforceability";

function claimQualityLabelForFamily(fam: string): string {
  switch (fam) {
    case "bauseits_allgemein":
      return "klare Zuweisung (bauseits/AG/Fremdgewerk)";
    case "leistungsabgrenzung_allgemein":
      return "klare Leistungsgrenze / Verantwortungsgrenze";
    case "schnittstelle_allgemein":
      return "klarer Schnittstellen-/Übergabepunkt";
    case "mengen_unbestimmt":
      return "abrechenbare Mengen-/Aufmaßmechanik (EP/Aufmaß/Mehrmenge)";
    case "pruef_mess_nachweis_allgemein":
      return "Prüf-/Nachweis-/Messbezug (dokumentierbar)";
    case "inbetriebnahme_allgemein":
      return "Abnahme-/Inbetriebnahmebezug (Übergabe/Freigabe)";
    case "vollstaendigkeitspauschale":
      return "Vollständigkeits-/Komplettverantwortung (Blocker)";
    case "nebenleistung_allgemein":
      return "All-inclusive/Nebenleistungen inklusive (Blocker)";
    default:
      return "Claim-Thema (Qualität unklar)";
  }
}

export function buildExplanations(
  subscores: NachtragSubscoresV2,
  result: Pick<NachtragResultV2, "exposureScore" | "enforceabilityScore" | "potentialScore">,
  anchors: AnchorEventResult[],
  caps: CommodityCapResult[],
  enforceability: EnforceabilityAnalysis
): Pick<NachtragResultV2, "drivers" | "blockers" | "notes"> {
  const drivers: string[] = [];
  const blockers: string[] = [];
  const notes: string[] = [];

  if (result.exposureScore >= 60) {
    drivers.push(
      "Hohe wirtschaftliche Exposure durch deutliche Risiken in Vertragsabgrenzung und/oder Mengen."
    );
  }
  if (result.exposureScore <= 30) {
    blockers.push(
      "Begrenzte Exposure aus den vorhandenen Triggern – aktuell nur wenige oder schwache Nachtragshebel ableitbar."
    );
  }

  if (result.enforceabilityScore >= 60) {
    drivers.push(
      "Gute Durchsetzbarkeit: mehrere klare Claim-Hebel (z. B. bauseits, Schnittstellen, abrechenbare Mechaniken) sind erkennbar."
    );
  }
  if (result.enforceabilityScore <= 30) {
    blockers.push(
      "Schwache Durchsetzbarkeit: stärkere Blocker (z. B. Vollständigkeits-/Pauschalklauseln oder diffuse Nebenleistungsformeln) begrenzen die Claim-Chance."
    );
  }

  const firedAnchors = anchors.filter((a) => a.fired);
  if (firedAnchors.length > 0) {
    notes.push(
      `Anchor-Events aktiv: ${firedAnchors.map((a) => a.label).join(" · ")}.`
    );
  }

  if (caps.length > 0) {
    notes.push(
      "Commodity-Caps begrenzen den Einfluss stark wiederkehrender, generischer Trigger-Familien (defensiver Default)."
    );
  }

  if (subscores.doku_ibn >= 60 && result.enforceabilityScore < 60) {
    notes.push(
      "Erhöhtes Risiko in Dokumentation/Inbetriebnahme, wobei die Durchsetzbarkeit noch nicht voll abgesichert ist."
    );
  }

  if (enforceability.positiveSignals.length > 0) {
    const fams = Array.from(new Set(enforceability.positiveSignals.map((s) => s.family)));
    notes.push(
      `Durchsetzbarkeit: positive Claim-Hebel u. a. durch ${fams.map(claimQualityLabelForFamily).join(", ")}.`
    );
  }
  if (enforceability.negativeSignals.length > 0) {
    const fams = Array.from(new Set(enforceability.negativeSignals.map((s) => s.family)));
    notes.push(
      `Durchsetzbarkeit: Claim-Blocker u. a. durch ${fams.map(claimQualityLabelForFamily).join(", ")}.`
    );
  }

  return { drivers, blockers, notes };
}

