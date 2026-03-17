import type { NachtragEvidenceV2, AnchorEventResult } from "./types";

type AnchorDefinition = {
  id: string;
  label: string;
  requires: (evs: NachtragEvidenceV2[]) => boolean;
  impactExposure?: number;
  impactEnforceability?: number;
};

// Defensive Defaults: explizite Anchor-Events (Skeletons), einfach kombinatorisch.
const DEFAULT_ANCHORS: AnchorDefinition[] = [
  {
    id: "ANCHOR_PAUSCHALE_BAUSEITS",
    label: "Bauseitige Leistungen / Pauschalen mit Nachtragspotenzial",
    requires: (evs) => {
      const hasBauseits = evs.some((e) => e.family === "bauseits_allgemein");
      const hasAbgrenzung = evs.some((e) => e.family === "leistungsabgrenzung_allgemein");
      return hasBauseits && hasAbgrenzung;
    },
    impactExposure: 7,
    impactEnforceability: 1,
  },
  {
    id: "ANCHOR_MENGEN_MEHRMENGE",
    label: "Offene / unbestimmte Mengen mit Mehrmengenpotenzial",
    requires: (evs) => {
      const mengenEvs = evs.filter((e) => e.family === "mengen_unbestimmt");
      if (mengenEvs.length === 0) return false;

      const secondMengenHebelCount = evs.filter(
        (e) =>
          e.family === "mengen_unbestimmt" ||
          e.subscoreTargets.includes("ausfuehrung_mengen")
      ).length;

      return secondMengenHebelCount >= 2;
    },
    impactExposure: 8,
    impactEnforceability: 3,
  },
  {
    id: "ANCHOR_DOKU_ABNAHME",
    label: "Dokumentations- / Abnahmeanforderungen mit Claim-Hebel",
    requires: (evs) => {
      const hasDoku = evs.some((e) => e.family === "dokumentation_allgemein");
      const hasInbetriebnahme = evs.some((e) => e.family === "inbetriebnahme_allgemein");
      const hasPruefMess = evs.some((e) => e.family === "pruef_mess_nachweis_allgemein");
      return (hasDoku || hasInbetriebnahme) && hasPruefMess;
    },
    impactExposure: 5,
    impactEnforceability: 6,
  },
  {
    id: "ANCHOR_MSR_FREMDGEWERK",
    label: "MSR-Übergabe an Fremdgewerke mit erhöhtem Claim-Risiko",
    requires: (evs) => {
      const hasMsr = evs.some((e) => e.family === "msr_fremdgewerk_uebergang");
      if (!hasMsr) return false;
      const hasZweiteKomponente = evs.some(
        (e) =>
          e.family === "schnittstelle_allgemein" ||
          e.family === "leistungsabgrenzung_allgemein" ||
          e.subscoreTargets.includes("vertrags_abgrenzung")
      );
      return hasZweiteKomponente;
    },
    impactExposure: 6,
    impactEnforceability: 5,
  },
];

export function evaluateAnchors(evidences: NachtragEvidenceV2[]): AnchorEventResult[] {
  const results: AnchorEventResult[] = [];

  for (const def of DEFAULT_ANCHORS) {
    const fired = def.requires(evidences);
    results.push({
      id: def.id,
      label: def.label,
      fired,
      impactExposure: fired ? def.impactExposure : 0,
      impactEnforceability: fired ? def.impactEnforceability : 0,
      reason: fired
        ? "Defensiver Default-Anchor: Kombination mehrerer kritischer Subscores erkannt."
        : "Bedingungen für diesen Anchor wurden nicht erfüllt (defensive Neutralstellung).",
    });
  }

  return results;
}

export function getActiveAnchors(): AnchorDefinition[] {
  return [...DEFAULT_ANCHORS];
}

