/**
 * Systemlogik Sanitär (Lückenanalyse).
 * Zusätzliche Ebene; Trigger-Engine bleibt unverändert.
 */

import type { SystemLogicDefinition } from "./types";

export const SANITARY_SYSTEMS: SystemLogicDefinition[] = [
  {
    id: "sanitary_drinking_water_installation",
    trade: "sanitary",
    name: "Trinkwasserinstallation",
    metadata: {
      gewerk: "Sanitär",
      systemKey: "sanitary_drinking_water_installation",
      label: "Trinkwasserinstallation",
      detection: {
        anyOf: [
          "Trinkwasser",
          "Kaltwasser",
          "Warmwasser",
          "PWC",
          "PWH",
          "Zirkulation",
          "Trinkwasserleitung",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "pipeNetwork",
          label: "Rohrnetz",
          matchAny: ["Rohrnetz", "Trinkwasserleitung", "Rohrleitung"],
          severity: "high",
          requiredType: "required",
          description: "Rohrnetz der Trinkwasserinstallation.",
        },
        {
          key: "fittings",
          label: "Formstücke / Verbindungstechnik",
          matchAny: [
            "Formstück",
            "Formstücke",
            "Verbindungstechnik",
            "Pressfitting",
            "Fitting",
          ],
          severity: "medium",
          requiredType: "required",
          description: "Formstücke und Verbindungstechnik des Rohrnetzes.",
        },
        {
          key: "valves",
          label: "Armaturen",
          matchAny: ["Armatur", "Armaturen", "Absperrarmatur"],
          severity: "medium",
          requiredType: "required",
          description: "Armaturen innerhalb der Trinkwasserinstallation.",
        },
        {
          key: "insulation",
          label: "Dämmung",
          matchAny: ["Dämmung", "Rohrdämmung", "Wärmedämmung"],
          severity: "medium",
          requiredType: "required",
          description: "Dämmung der Trinkwasserleitungen.",
        },
        {
          key: "mounting",
          label: "Befestigung",
          matchAny: ["Befestigung", "Rohrbefestigung", "Rohrschelle"],
          severity: "medium",
          requiredType: "required",
          description: "Befestigung und Montage der Leitungen.",
        },
        {
          key: "flushing",
          label: "Spülung",
          matchAny: ["Spülung", "Leitungsspülung"],
          severity: "high",
          requiredType: "required",
          description: "Spülung der Trinkwasserinstallation.",
        },
        {
          key: "pressureTest",
          label: "Druckprüfung / Dichtheitsprüfung",
          matchAny: ["Druckprüfung", "Dichtheitsprüfung"],
          severity: "high",
          requiredType: "required",
          description: "Druck- bzw. Dichtheitsprüfung der Anlage.",
        },
        {
          key: "hygieneCommissioning",
          label: "Hygienespülung / Inbetriebnahme",
          matchAny: ["Hygienespülung", "Inbetriebnahme"],
          severity: "high",
          requiredType: "required",
          description: "Hygienespülung und Inbetriebnahme der Trinkwasseranlage.",
        },
        {
          key: "marking",
          label: "Kennzeichnung",
          matchAny: ["Kennzeichnung", "Beschriftung"],
          severity: "low",
          requiredType: "contextRequired",
          description: "Kennzeichnung der Leitungen und Anlagenteile.",
        },
        {
          key: "circulation",
          label: "Zirkulation bei Warmwasseranlage",
          matchAny: ["Zirkulation", "Zirkulationsleitung", "Zirkulationssystem"],
          severity: "high",
          requiredType: "contextRequired",
          description: "Zirkulation bei Warmwasseranlagen, soweit technisch erforderlich.",
        },
        {
          key: "waterTreatment",
          label: "Wasserbehandlung",
          matchAny: ["Wasserbehandlung", "Filter", "Druckminderer"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Wasserbehandlung, sofern erforderlich.",
        },
      ],
      optionalComponents: [
        {
          key: "samplingValves",
          label: "Probennahmeventile",
          matchAny: ["Probennahmeventil", "Probennahmeventile"],
          severity: "medium",
          requiredType: "optional",
          description: "Probennahmeventile zur Trinkwasserhygiene.",
        },
        {
          key: "circulationBalancingValves",
          label: "Strangregulierventile Zirkulation",
          matchAny: [
            "Strangregulierventil",
            "Strangregulierventile",
            "Zirkulationsregulierventil",
          ],
          severity: "medium",
          requiredType: "optional",
          description: "Regulierventile in der Warmwasserzirkulation.",
        },
        {
          key: "leakProtection",
          label: "Leckageschutz",
          matchAny: ["Leckageschutz", "Leckageüberwachung"],
          severity: "medium",
          requiredType: "optional",
          description: "Leckageschutzsysteme.",
        },
        {
          key: "filter",
          label: "Filter",
          matchAny: ["Filter", "Trinkwasserfilter"],
          severity: "medium",
          requiredType: "optional",
          description: "Filter im Trinkwassersystem.",
        },
        {
          key: "pressureReducer",
          label: "Druckminderer",
          matchAny: ["Druckminderer"],
          severity: "medium",
          requiredType: "optional",
          description: "Druckminderer im Trinkwassersystem.",
        },
      ],
      logicRules: [
        {
          key: "hot_water_without_circulation",
          title: "Warmwasseranlage ohne Zirkulation",
          severity: "high",
          condition: {
            detectedAny: ["pipeNetwork"],
            missingAny: ["circulation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Bei erkennbarer Warmwasseranlage ohne Zirkulation ist die hygienische und technische Ausführung unklar.",
          recommendation:
            "Zirkulationssystem explizit beschreiben oder klar festhalten, warum keine Zirkulation vorgesehen ist.",
        },
        {
          key: "drinking_water_without_pressure_test_or_flushing",
          title: "Trinkwasserinstallation ohne Druckprüfung oder Spülung",
          severity: "high",
          condition: {
            detectedAny: ["pipeNetwork"],
            missingAny: ["pressureTest", "flushing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Druckprüfung oder Spülung fehlen wesentliche Leistungen für Abnahme, Hygiene und Haftung.",
          recommendation:
            "Druckprüfung und Spülung als eigene Leistungsbestandteile aufnehmen und mit Protokollpflicht versehen.",
        },
        {
          key: "circulation_without_balancing",
          title: "Warmwasser/Zirkulation ohne hydraulischen Abgleich oder Regulierventile",
          severity: "high",
          condition: {
            detectedAny: ["circulation"],
            missingAny: ["circulationBalancingValves"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Eine Zirkulation ohne Regulierventile oder Abgleichslogik birgt Funktions- und Hygienerisiken.",
          recommendation:
            "Regulierventile bzw. Abgleich der Zirkulationsstränge klar beschreiben oder gesondert ausschreiben.",
        },
        {
          key: "large_distribution_without_hygiene_logic",
          title: "Längere Verteilnetze ohne Hygiene-, Spül- oder Inbetriebnahmelogik",
          severity: "medium",
          condition: {
            detectedAny: ["pipeNetwork"],
            missingAny: ["flushing", "hygieneCommissioning"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei längeren Verteilnetzen fehlen ohne Hygiene- und Inbetriebnahmelogik wesentliche Angaben zum sicheren Betrieb.",
          recommendation:
            "Hygienespülung, Inbetriebnahme und ggf. Dokumentation der Trinkwasserhygiene ergänzen.",
        },
        {
          key: "drinking_water_without_insulation_or_mounting",
          title: "Trinkwassernetz ohne Dämmung oder Befestigungsbezug",
          severity: "medium",
          condition: {
            detectedAny: ["pipeNetwork"],
            missingAny: ["insulation", "mounting"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fehlende Angaben zu Dämmung oder Befestigung führen zu Unklarheiten im Montageumfang.",
          recommendation:
            "Dämmung und Befestigung der Leitungen als klaren Leistungsbestandteil ergänzen.",
        },
      ],
    },
  },
  {
    id: "sanitary_wastewater_installation",
    trade: "sanitary",
    name: "Abwasserinstallation",
    metadata: {
      gewerk: "Sanitär",
      systemKey: "sanitary_wastewater_installation",
      label: "Abwasserinstallation",
      detection: {
        anyOf: [
          "Schmutzwasser",
          "Abwasser",
          "Regenwasser innen",
          "Fallleitung",
          "Grundleitung",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "pipeSystem",
          label: "Rohrsystem",
          matchAny: ["Rohrsystem", "Abwasserleitung", "Fallleitung", "Grundleitung"],
          severity: "high",
          requiredType: "required",
          description: "Rohrsystem der Abwasserinstallation.",
        },
        {
          key: "fittings",
          label: "Formstücke",
          matchAny: ["Formstück", "Formstücke", "Bogen", "Abzweig"],
          severity: "medium",
          requiredType: "required",
          description: "Formstücke und Verbindungen im Rohrnetz.",
        },
        {
          key: "mounting",
          label: "Befestigung",
          matchAny: ["Befestigung", "Rohrbefestigung", "Rohrschelle"],
          severity: "medium",
          requiredType: "required",
          description: "Befestigung und Montage des Abwasserrohrnetzes.",
        },
        {
          key: "cleaningOpenings",
          label: "Reinigungsöffnungen",
          matchAny: ["Reinigungsöffnung", "Reinigungsöffnungen"],
          severity: "high",
          requiredType: "required",
          description: "Reinigungsöffnungen im Abwassersystem.",
        },
        {
          key: "soundInsulation",
          label: "Schallschutz",
          matchAny: ["Schallschutz", "Schallschutzrohr", "Schallschutzmaßnahme"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Schallschutzmaßnahmen, sofern relevant.",
        },
        {
          key: "fireStopping",
          label: "Brandschutzabschottung",
          matchAny: ["Brandschutzabschottung", "Abschottung", "Brandschutz"],
          severity: "high",
          requiredType: "contextRequired",
          description: "Brandschutzabschottung bei Deckendurchführungen und Brandabschnitten.",
        },
        {
          key: "tightnessTest",
          label: "Dichtheitsprüfung",
          matchAny: ["Dichtheitsprüfung", "Dichtheitsprobe"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Dichtheitsprüfung, sofern gefordert oder üblich.",
        },
        {
          key: "drainConnections",
          label: "Anschluss an Entwässerungspunkte",
          matchAny: ["Anschluss", "Entwässerungspunkt", "Anschlussleitung"],
          severity: "medium",
          requiredType: "required",
          description: "Anschlüsse an Entwässerungspunkte und Sanitärobjekte.",
        },
      ],
      optionalComponents: [
        {
          key: "liftingUnit",
          label: "Hebeanlage",
          matchAny: ["Hebeanlage"],
          severity: "medium",
          requiredType: "optional",
          description: "Hebeanlage für Schmutzwasser oder Kondensat.",
        },
        {
          key: "backflowPreventer",
          label: "Rückstauverschluss",
          matchAny: ["Rückstauverschluss"],
          severity: "medium",
          requiredType: "optional",
          description: "Rückstausicherung im Entwässerungssystem.",
        },
        {
          key: "floorDrains",
          label: "Bodenabläufe",
          matchAny: ["Bodenablauf", "Bodenabläufe"],
          severity: "low",
          requiredType: "optional",
          description: "Bodenabläufe im Entwässerungssystem.",
        },
        {
          key: "roofDrains",
          label: "Dachabläufe",
          matchAny: ["Dachablauf", "Dachabläufe"],
          severity: "low",
          requiredType: "optional",
          description: "Dachabläufe für innenliegende Entwässerung.",
        },
        {
          key: "emergencyDrainage",
          label: "Notentwässerung",
          matchAny: ["Notentwässerung"],
          severity: "medium",
          requiredType: "optional",
          description: "Notentwässerungskonzept.",
        },
      ],
      logicRules: [
        {
          key: "wastewater_without_cleaning_openings",
          title: "Abwasserstränge ohne Reinigungsöffnungen",
          severity: "high",
          condition: {
            detectedAny: ["pipeSystem"],
            missingAny: ["cleaningOpenings"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Abwasserstränge ohne Reinigungsöffnungen sind technisch unvollständig und erschweren Wartung und Betrieb.",
          recommendation:
            "Reinigungsöffnungen an den erforderlichen Stellen explizit als Leistungsbestandteil aufnehmen.",
        },
        {
          key: "wastewater_without_fire_stopping",
          title: "Entwässerungsleitungen durch Brandabschnitte ohne Brandschutzbezug",
          severity: "high",
          condition: {
            detectedAny: ["pipeSystem"],
            missingAny: ["fireStopping"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei Leitungsführungen durch Brandabschnitte ohne Brandschutzbezug drohen erhebliche Schnittstellen- und Nachtragsrisiken.",
          recommendation:
            "Abschottungen, Zuständigkeiten und Brandschutzsysteme klar beschreiben.",
        },
        {
          key: "wastewater_missing_lifting_unit",
          title: "Technisch erforderliche Hebeanlage nicht beschrieben",
          severity: "high",
          condition: {
            detectedAny: ["pipeSystem"],
            missingAny: ["liftingUnit"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Wenn eine Hebeanlage technisch erforderlich ist, aber nicht beschrieben wird, entstehen hohe Nachtrags- und Funktionsrisiken.",
          recommendation:
            "Hebeanlage und zugehörige Anschlüsse klar ausschreiben oder planerisch eindeutig ausschließen.",
        },
        {
          key: "wastewater_without_sound_insulation",
          title: "Größere Abwasserinstallation ohne Schallschutzmaßnahmen",
          severity: "medium",
          condition: {
            detectedAny: ["pipeSystem"],
            missingAny: ["soundInsulation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei größeren Entwässerungssystemen ohne Schallschutzbezug bleiben Komfort- und Ausführungsanforderungen offen.",
          recommendation:
            "Schallschutzanforderungen der Entwässerungsleitungen spezifizieren.",
        },
        {
          key: "wastewater_without_mounting",
          title: "Größere Rohrnetze ohne Befestigungs- oder Montagesystembezug",
          severity: "medium",
          condition: {
            detectedAny: ["pipeSystem"],
            missingAny: ["mounting"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fehlende Angaben zu Befestigung und Montagesystemen erschweren Kalkulation und Ausführung.",
          recommendation:
            "Montagesysteme, Befestigung und Tragkonstruktionen klar benennen.",
        },
      ],
    },
  },
  {
    id: "sanitary_fixtures_equipment",
    trade: "sanitary",
    name: "Sanitärgegenstände / Ausstattung",
    metadata: {
      gewerk: "Sanitär",
      systemKey: "sanitary_fixtures_equipment",
      label: "Sanitärgegenstände / Ausstattung",
      detection: {
        anyOf: [
          "WC",
          "Waschtisch",
          "Urinal",
          "Dusche",
          "Badewanne",
          "Ausgussbecken",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "fixtureObject",
          label: "Sanitärgegenstand / Objekt",
          matchAny: [
            "WC",
            "Waschtisch",
            "Urinal",
            "Dusche",
            "Badewanne",
            "Ausgussbecken",
          ],
          severity: "high",
          requiredType: "required",
          description: "Sanitärgegenstand bzw. Objekt.",
        },
        {
          key: "connectionSet",
          label: "Anschlussgarnitur",
          matchAny: ["Anschlussgarnitur", "Anschlussset", "Anschlusszubehör"],
          severity: "medium",
          requiredType: "required",
          description: "Anschlussgarnitur des Sanitärgegenstands.",
        },
        {
          key: "mounting",
          label: "Befestigung",
          matchAny: ["Befestigung", "Montage", "Montagesystem"],
          severity: "high",
          requiredType: "required",
          description: "Befestigung und Montage des Sanitärgegenstands.",
        },
        {
          key: "drainTrap",
          label: "Ablauf / Geruchverschluss",
          matchAny: ["Ablauf", "Geruchverschluss", "Siphon", "Ablaufgarnitur"],
          severity: "high",
          requiredType: "required",
          description: "Ablauf bzw. Geruchverschluss des Sanitärgegenstands.",
        },
        {
          key: "faucet",
          label: "Armatur",
          matchAny: ["Armatur", "Mischbatterie", "Ventilarmatur"],
          severity: "high",
          requiredType: "required",
          description: "Armatur des Sanitärgegenstands.",
        },
        {
          key: "accessories",
          label: "Zubehör",
          matchAny: ["WC-Sitz", "Betätigungsplatte", "Ablaufgarnitur", "Zubehör"],
          severity: "medium",
          requiredType: "required",
          description: "Objektspezifisches Zubehör, z. B. WC-Sitz, Betätigungsplatte, Ablaufgarnitur.",
        },
        {
          key: "soundInsulationSet",
          label: "Schallschutzset",
          matchAny: ["Schallschutzset", "Schallschutz", "Entkopplung"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Schallschutzset, sofern üblich oder erforderlich.",
        },
      ],
      optionalComponents: [
        {
          key: "prewallSystem",
          label: "Vorwandsysteme",
          matchAny: ["Vorwandsystem", "Vorwandsysteme"],
          severity: "medium",
          requiredType: "optional",
          description: "Vorwandsysteme für WC, Waschtisch oder Urinal.",
        },
        {
          key: "mountingFrame",
          label: "Montagerahmen",
          matchAny: ["Montagerahmen", "Tragrahmen"],
          severity: "medium",
          requiredType: "optional",
          description: "Montagerahmen und Tragrahmen.",
        },
        {
          key: "designCovers",
          label: "Designabdeckungen",
          matchAny: ["Designabdeckung", "Designabdeckungen"],
          severity: "low",
          requiredType: "optional",
          description: "Designabdeckungen oder sichtbares Zubehör.",
        },
        {
          key: "accessorySets",
          label: "Anschlusszubehörsets",
          matchAny: ["Anschlusszubehörset", "Anschlusszubehörsets"],
          severity: "low",
          requiredType: "optional",
          description: "Zusätzliche Zubehörsets für Sanitärgegenstände.",
        },
        {
          key: "specialTrap",
          label: "Geruchsverschlüsse mit Sonderfunktion",
          matchAny: ["Geruchsverschluss", "Sondergeruchsverschluss"],
          severity: "low",
          requiredType: "optional",
          description: "Geruchsverschlüsse mit Sonderfunktion.",
        },
      ],
      logicRules: [
        {
          key: "fixture_without_faucet_or_drain",
          title: "Sanitärgegenstand ohne Armatur oder Ablauf",
          severity: "high",
          condition: {
            detectedAny: ["fixtureObject"],
            missingAny: ["faucet", "drainTrap"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ein Sanitärgegenstand ohne Armatur oder Ablauf ist funktional unvollständig und führt zu Nachtragsrisiken.",
          recommendation:
            "Armatur und Ablaufgarnitur je Objekt eindeutig als Leistungsbestandteil aufnehmen.",
        },
        {
          key: "fixture_without_mounting",
          title: "Sanitärgegenstand ohne Befestigung oder Montagesystem",
          severity: "high",
          condition: {
            detectedAny: ["fixtureObject"],
            missingAny: ["mounting"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne Befestigung oder Montagesystem bleibt der Montageumfang unklar.",
          recommendation:
            "Befestigung, Vorwand- bzw. Montagesystem und Tragkonstruktion klar benennen.",
        },
        {
          key: "wc_without_plate_or_seat",
          title: "WC-System ohne Betätigungsplatte oder WC-Sitz",
          severity: "high",
          condition: {
            detectedAny: ["fixtureObject"],
            missingAny: ["accessories"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei WC-Systemen ohne Betätigungsplatte oder WC-Sitz ist das Objekt unvollständig beschrieben.",
          recommendation:
            "WC-Zubehör wie Betätigungsplatte und WC-Sitz explizit aufnehmen oder als bauseits definieren.",
        },
        {
          key: "many_fixtures_without_accessory_or_mounting_context",
          title: "Größere Anzahl Sanitärgegenstände ohne Zubehör- oder Montagebezug",
          severity: "medium",
          condition: {
            detectedAny: ["fixtureObject"],
            missingAny: ["accessories", "mounting"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei mehreren Sanitärgegenständen ohne Zubehör- oder Montagebezug bleiben Umfang und Qualität offen.",
          recommendation:
            "Zubehör- und Montageumfang je Objektgruppe spezifizieren.",
        },
        {
          key: "fixtures_without_sound_insulation_context",
          title: "Ausstattung ohne Schallschutzbezug bei mehrgeschossigen Gebäuden",
          severity: "medium",
          condition: {
            detectedAny: ["fixtureObject"],
            missingAny: ["soundInsulationSet"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Fehlender Schallschutzbezug kann bei Sanitärgegenständen in mehrgeschossigen Gebäuden zu Ausführungs- und Nachtragsrisiken führen.",
          recommendation:
            "Schallschutzsets bzw. Entkopplung für Sanitärgegenstände klar beschreiben, soweit relevant.",
        },
      ],
    },
  },
];