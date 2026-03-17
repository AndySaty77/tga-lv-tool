export type NachtragFamilyId =
  | "schnittstelle_allgemein"
  | "nebenleistung_allgemein"
  | "leistungsabgrenzung_allgemein"
  | "bauseits_allgemein"
  | "vollstaendigkeitspauschale"
  | "mengen_unbestimmt"
  | "bestandsunsicherheit"
  | "dokumentation_allgemein"
  | "pruef_mess_nachweis_allgemein"
  | "inbetriebnahme_allgemein"
  | "msr_fremdgewerk_uebergang"
  | "generic_text_noise";

export type NachtragFamily = {
  id: NachtragFamilyId;
  label: string;
};

const FAMILIES: Record<NachtragFamilyId, NachtragFamily> = {
  schnittstelle_allgemein: { id: "schnittstelle_allgemein", label: "Schnittstellen / Abgrenzungen (allgemein)" },
  nebenleistung_allgemein: { id: "nebenleistung_allgemein", label: "Nebenleistungen / Mitwirkung (allgemein)" },
  leistungsabgrenzung_allgemein: { id: "leistungsabgrenzung_allgemein", label: "Leistungsabgrenzung (allgemein)" },
  bauseits_allgemein: { id: "bauseits_allgemein", label: "Bauseitige Leistungen / Voraussetzungen" },
  vollstaendigkeitspauschale: { id: "vollstaendigkeitspauschale", label: "Vollständigkeitspauschalen / globales LV-Risiko" },
  mengen_unbestimmt: { id: "mengen_unbestimmt", label: "Unbestimmte / offene Mengen" },
  bestandsunsicherheit: { id: "bestandsunsicherheit", label: "Bestandsunsicherheit" },
  dokumentation_allgemein: { id: "dokumentation_allgemein", label: "Dokumentation / Nachweise (allgemein)" },
  pruef_mess_nachweis_allgemein: { id: "pruef_mess_nachweis_allgemein", label: "Prüf-, Mess- und Nachweispflichten (allgemein)" },
  inbetriebnahme_allgemein: { id: "inbetriebnahme_allgemein", label: "Inbetriebnahme / Abnahme (allgemein)" },
  msr_fremdgewerk_uebergang: { id: "msr_fremdgewerk_uebergang", label: "MSR-Übergabe / Fremdgewerk" },
  generic_text_noise: { id: "generic_text_noise", label: "Generischer Text / Rest" },
};

export function getNachtragFamily(id: NachtragFamilyId): NachtragFamily {
  return FAMILIES[id];
}

export function resolveFamilyFromTrigger(triggerName?: string | null, category?: string | null): NachtragFamilyId {
  const name = (triggerName ?? "").toLowerCase();
  const cat = (category ?? "").toLowerCase();

  if (name.includes("schnittstelle") || cat.includes("schnittstelle")) return "schnittstelle_allgemein";
  if (name.includes("nebenleistung") || name.includes("mitwirkung")) return "nebenleistung_allgemein";
  if (name.includes("leistungsabgrenzung") || name.includes("abgrenzung")) return "leistungsabgrenzung_allgemein";
  if (name.includes("bauseits") || name.includes("bauseit") || cat.includes("bauseits")) return "bauseits_allgemein";
  if (name.includes("vollstaendigkeit") || name.includes("vollständigkeit") || cat.includes("vollstaendigkeit")) {
    return "vollstaendigkeitspauschale";
  }
  if (name.includes("menge") || cat.includes("menge") || cat.includes("mengen_massenermittlung")) {
    return "mengen_unbestimmt";
  }
  if (name.includes("bestand") || cat.includes("bestand")) return "bestandsunsicherheit";
  if (name.includes("dokumentation") || cat.includes("doku") || cat.includes("dokumentation")) {
    return "dokumentation_allgemein";
  }
  if (name.includes("prüf") || name.includes("mess") || name.includes("nachweis")) return "pruef_mess_nachweis_allgemein";
  if (name.includes("inbetrieb") || name.includes("abnahme") || cat.includes("ibn")) return "inbetriebnahme_allgemein";
  if (name.includes("msr") && (name.includes("fremd") || name.includes("übergang") || name.includes("uebergang"))) {
    return "msr_fremdgewerk_uebergang";
  }

  return "generic_text_noise";
}

