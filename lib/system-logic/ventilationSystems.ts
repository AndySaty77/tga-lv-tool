/**
 * Systemlogik Lüftung / Klima (Lückenanalyse).
 * Zusätzliche Ebene; Trigger-Engine bleibt unverändert.
 */

import type { SystemLogicDefinition } from "./types";

export const VENTILATION_SYSTEMS: SystemLogicDefinition[] = [
  {
    id: "ventilation_air_handling_system",
    trade: "ventilation",
    name: "Lüftungsanlage allgemein",
    metadata: {
      gewerk: "Lüftung",
      systemKey: "ventilation_air_handling_system",
      label: "Lüftungsanlage allgemein",
      detection: {
        anyOf: [
          "Lüftungsgerät",
          "RLT-Gerät",
          "Zu-/Abluft",
          "Luftkanal",
          "Volumenstromregler",
          "Luftauslass",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "airHandlingUnit",
          label: "Lüftungsgerät / RLT-Gerät",
          matchAny: ["Lüftungsgerät", "RLT-Gerät", "Luftbehandlungsgerät"],
          severity: "high",
          requiredType: "required",
          description: "Lüftungsgerät bzw. RLT-Gerät als zentrale Luftbehandlungseinheit.",
        },
        {
          key: "ductNetwork",
          label: "Kanalnetz",
          matchAny: ["Luftkanal", "Kanalnetz", "Lüftungskanal"],
          severity: "high",
          requiredType: "required",
          description: "Kanalnetz der Lüftungsanlage.",
        },
        {
          key: "fittings",
          label: "Formstücke",
          matchAny: ["Formstück", "Formstücke", "Bogen", "Abzweig"],
          severity: "medium",
          requiredType: "required",
          description: "Formstücke und Verbindungen im Kanalnetz.",
        },
        {
          key: "mountingSystem",
          label: "Aufhängung / Befestigungssystem",
          matchAny: ["Aufhängung", "Befestigungssystem", "Befestigung"],
          severity: "medium",
          requiredType: "required",
          description: "Aufhängung und Befestigung des Kanalnetzes.",
        },
        {
          key: "airOutlets",
          label: "Luftdurchlässe",
          matchAny: ["Luftdurchlass", "Luftdurchlässe", "Luftauslass", "Luftauslässe"],
          severity: "high",
          requiredType: "required",
          description: "Luftdurchlässe und Auslässe der Anlage.",
        },
        {
          key: "flowControllers",
          label: "Volumenstromregler / Drosselorgane",
          matchAny: [
            "Volumenstromregler",
            "Drosselorgan",
            "Drosselorgane",
            "Volumenstrom",
          ],
          severity: "high",
          requiredType: "required",
          description: "Volumenstromregler oder Drosselorgane zur Einregulierung.",
        },
        {
          key: "silencers",
          label: "Schalldämpfer",
          matchAny: ["Schalldämpfer", "Schallschutz"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Schalldämpfer, sofern akustisch erforderlich.",
        },
        {
          key: "insulation",
          label: "Dämmung",
          matchAny: ["Dämmung", "Kanaldämmung", "Isolierung"],
          severity: "medium",
          requiredType: "required",
          description: "Dämmung des Kanalnetzes und der lufttechnischen Komponenten.",
        },
        {
          key: "fireDampers",
          label: "Brandschutzklappen",
          matchAny: ["Brandschutzklappe", "Brandschutzklappen"],
          severity: "high",
          requiredType: "contextRequired",
          description: "Brandschutzklappen, sofern brandabschnittsrelevant.",
        },
        {
          key: "measurementBalancing",
          label: "Messung / Einregulierung",
          matchAny: ["Messung", "Einregulierung", "Volumenstrommessung"],
          severity: "high",
          requiredType: "required",
          description: "Messung und Einregulierung der Lüftungsanlage.",
        },
        {
          key: "commissioning",
          label: "Funktionsprüfung / Inbetriebnahme",
          matchAny: ["Funktionsprüfung", "Inbetriebnahme", "Abnahmeprotokoll"],
          severity: "high",
          requiredType: "required",
          description: "Funktionsprüfung und Inbetriebnahme der Anlage.",
        },
      ],
      optionalComponents: [
        {
          key: "revisionOpenings",
          label: "Revisionsöffnungen",
          matchAny: ["Revisionsöffnung", "Revisionsöffnungen"],
          severity: "medium",
          requiredType: "optional",
          description: "Revisionsöffnungen im Kanalnetz.",
        },
        {
          key: "weatherProtectionGrilles",
          label: "Wetterschutzgitter",
          matchAny: ["Wetterschutzgitter"],
          severity: "low",
          requiredType: "optional",
          description: "Wetterschutzgitter für Außenluft/Fortluft.",
        },
        {
          key: "condensateDrain",
          label: "Kondensatablauf",
          matchAny: ["Kondensatablauf", "Kondensat", "Kondensatableitung"],
          severity: "medium",
          requiredType: "optional",
          description: "Kondensatablauf am Gerät, sofern erforderlich.",
        },
        {
          key: "vibrationIsolation",
          label: "Schwingungsdämpfer",
          matchAny: ["Schwingungsdämpfer", "Schwingungsentkopplung"],
          severity: "medium",
          requiredType: "optional",
          description: "Schwingungsdämpfer bzw. Entkopplungselemente.",
        },
        {
          key: "filterMonitoring",
          label: "Filterüberwachung",
          matchAny: ["Filterüberwachung", "Filterwächter"],
          severity: "medium",
          requiredType: "optional",
          description: "Überwachung des Filterzustands.",
        },
        {
          key: "heatRecovery",
          label: "Wärmerückgewinnung (WRG)",
          matchAny: ["Wärmerückgewinnung", "WRG"],
          severity: "medium",
          requiredType: "optional",
          description: "Wärmerückgewinnungssysteme der Lüftungsanlage.",
        },
      ],
      logicRules: [
        {
          key: "ahu_without_air_outlets",
          title: "Lüftungsanlage ohne Luftdurchlässe",
          severity: "high",
          condition: {
            detectedAny: ["airHandlingUnit", "ductNetwork"],
            missingAny: ["airOutlets"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Eine Lüftungsanlage ohne beschriebene Luftdurchlässe ist funktional unvollständig.",
          recommendation:
            "Luftdurchlässe je Raum oder Bereich als klaren Leistungsbestandteil aufnehmen.",
        },
        {
          key: "ahu_without_balancing",
          title: "Lüftungsanlage ohne Einregulierung oder Volumenstrommessung",
          severity: "high",
          condition: {
            detectedAny: ["airHandlingUnit", "ductNetwork"],
            missingAny: ["measurementBalancing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Einregulierung oder Volumenstrommessung fehlen wesentliche Leistungen für Funktion und Abnahme.",
          recommendation:
            "Volumenstrommessung, Einregulierung und Protokollierung explizit ausschreiben.",
        },
        {
          key: "ahu_without_fire_dampers",
          title: "Brandabschnittsübergreifendes Kanalnetz ohne Brandschutzklappenbezug",
          severity: "high",
          condition: {
            detectedAny: ["ductNetwork"],
            missingAny: ["fireDampers"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei Kanalführungen über Brandabschnitte hinweg ohne Brandschutzbezug entstehen erhebliche Schnittstellen- und Ausführungsrisiken.",
          recommendation:
            "Brandschutzklappen, Abschottungen und Zuständigkeiten eindeutig beschreiben.",
        },
        {
          key: "ahu_without_condensate",
          title: "Lüftungsgerät ohne Kondensatbezug",
          severity: "high",
          condition: {
            detectedAny: ["airHandlingUnit"],
            missingAny: ["condensateDrain"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei technisch naheliegender Kondensatbildung ohne beschriebenen Kondensatablauf bleibt die Entwässerung offen.",
          recommendation:
            "Kondensatablauf und zugehörige Ableitung am Gerät explizit regeln.",
        },
        {
          key: "large_ducts_without_revision_openings",
          title: "Größere Kanalnetze ohne Revisionsöffnungen",
          severity: "medium",
          condition: {
            detectedAny: ["ductNetwork"],
            missingAny: ["revisionOpenings"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Revisionsöffnungen ist die spätere Reinigung und Wartung größerer Kanalnetze unzureichend beschrieben.",
          recommendation:
            "Revisionsöffnungen entsprechend Wartungs- und Hygienekonzept aufnehmen.",
        },
        {
          key: "ahu_without_silencers",
          title: "Lüftungsanlage ohne Schalldämpfer bei sensiblen Nutzungen",
          severity: "medium",
          condition: {
            detectedAny: ["airHandlingUnit", "ductNetwork"],
            missingAny: ["silencers"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei sensiblen Nutzungen ohne Schalldämpferbezug bleibt die akustische Qualität offen.",
          recommendation:
            "Schalldämpfer und akustische Anforderungen klar beschreiben, soweit relevant.",
        },
        {
          key: "ahu_without_commissioning",
          title: "Lüftungsanlage ohne Funktionsprüfung oder Abnahmeprotokolle",
          severity: "medium",
          condition: {
            detectedAny: ["airHandlingUnit"],
            missingAny: ["commissioning"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Funktionsprüfung und Inbetriebnahme bleibt die geschuldete Abnahmeleistung unklar.",
          recommendation:
            "Funktionsprüfung, Inbetriebnahme und Abnahmeprotokolle ausdrücklich in den Leistungsumfang aufnehmen.",
        },
      ],
    },
  },
  {
    id: "ventilation_cooling_split_vrf_system",
    trade: "ventilation",
    name: "Kälte-/Klimaanlage / VRF / Split",
    metadata: {
      gewerk: "Lüftung",
      systemKey: "ventilation_cooling_split_vrf_system",
      label: "Kälte-/Klimaanlage / VRF / Split",
      detection: {
        anyOf: [
          "Klimagerät",
          "Splitgerät",
          "VRF",
          "Kältemittelleitung",
          "Fan Coil",
          "Deckenkassette",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "indoorOutdoorUnits",
          label: "Innen- und Außengerät",
          matchAny: [
            "Innengerät",
            "Außengerät",
            "Klimagerät",
            "Splitgerät",
            "Deckenkassette",
            "Fan Coil",
          ],
          severity: "high",
          requiredType: "required",
          description: "Innen- und Außengeräte der Klima-/Kälteanlage.",
        },
        {
          key: "refrigerantLines",
          label: "Kältemittelleitungen",
          matchAny: ["Kältemittelleitung", "Kältemittelleitungen"],
          severity: "high",
          requiredType: "required",
          description: "Kältemittelleitungen zwischen Innen- und Außengeräten.",
        },
        {
          key: "condensateLine",
          label: "Kondensatleitung",
          matchAny: ["Kondensatleitung", "Kondensatableitung", "Kondensat"],
          severity: "high",
          requiredType: "required",
          description: "Kondensatleitung der Innen- oder Fan-Coil-Geräte.",
        },
        {
          key: "mounting",
          label: "Halterung / Konsole",
          matchAny: ["Halterung", "Konsole", "Wandkonsole", "Montagekonsole"],
          severity: "medium",
          requiredType: "required",
          description: "Halterung bzw. Konsole für die Geräte.",
        },
        {
          key: "control",
          label: "Regelung",
          matchAny: ["Regelung", "Regler", "Steuerung"],
          severity: "high",
          requiredType: "required",
          description: "Regelung der Anlage bzw. der angeschlossenen Geräte.",
        },
        {
          key: "electricalMsrInterface",
          label: "Elektro- oder MSR-Schnittstelle",
          matchAny: ["MSR-Schnittstelle", "Elektroanschluss", "Schnittstelle"],
          severity: "medium",
          requiredType: "required",
          description: "Elektro- und/oder MSR-Schnittstellen der Anlage.",
        },
        {
          key: "commissioning",
          label: "Inbetriebnahme",
          matchAny: ["Inbetriebnahme"],
          severity: "high",
          requiredType: "required",
          description: "Inbetriebnahme der Kälte-/Klimaanlage.",
        },
        {
          key: "tightnessEvacuation",
          label: "Dichtheitsprüfung / Evakuierungsleistungen",
          matchAny: ["Dichtheitsprüfung", "Evakuierung", "Vakuumierung"],
          severity: "high",
          requiredType: "required",
          description: "Dichtheitsprüfung und Evakuierung der Kältemittelleitungen.",
        },
      ],
      optionalComponents: [
        {
          key: "coreDrillings",
          label: "Kernbohrungen",
          matchAny: ["Kernbohrung", "Kernbohrungen"],
          severity: "medium",
          requiredType: "optional",
          description: "Kernbohrungen für Leitungsdurchführungen.",
        },
        {
          key: "condensatePump",
          label: "Kondensatpumpe",
          matchAny: ["Kondensatpumpe"],
          severity: "medium",
          requiredType: "optional",
          description: "Kondensatpumpe für Geräte ohne freies Gefälle.",
        },
        {
          key: "noiseProtection",
          label: "Schallschutzmaßnahmen",
          matchAny: ["Schallschutzmaßnahme", "Schallschutzmaßnahmen"],
          severity: "medium",
          requiredType: "optional",
          description: "Schallschutzmaßnahmen für Innen- oder Außengeräte.",
        },
        {
          key: "roofOrWallMounting",
          label: "Wandkonsole / Dachaufständerung",
          matchAny: ["Wandkonsole", "Dachaufständerung"],
          severity: "medium",
          requiredType: "optional",
          description: "Montagesysteme für Außengeräte.",
        },
      ],
      logicRules: [
        {
          key: "cooling_without_condensate_line",
          title: "Klimagerät ohne Kondensatleitung",
          severity: "high",
          condition: {
            detectedAny: ["indoorOutdoorUnits"],
            missingAny: ["condensateLine"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ein Klimagerät ohne Kondensatleitung ist technisch unvollständig und birgt erhebliche Ausführungsrisiken.",
          recommendation:
            "Kondensatleitung inkl. Ableitung und ggf. Kondensatpumpe klar beschreiben.",
        },
        {
          key: "split_vrf_without_refrigerant_lines",
          title: "Split- oder VRF-System ohne Kältemittelleitungen",
          severity: "high",
          condition: {
            detectedAny: ["indoorOutdoorUnits"],
            missingAny: ["refrigerantLines"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne Kältemittelleitungen ist ein Split- oder VRF-System funktional nicht vollständig beschrieben.",
          recommendation:
            "Kältemittelleitungen, Leitungswege und Leistungsgrenzen ausdrücklich aufnehmen.",
        },
        {
          key: "cooling_without_commissioning_or_tightness",
          title: "Kälteanlage ohne Inbetriebnahme oder Dichtheitsprüfung",
          severity: "high",
          condition: {
            detectedAny: ["indoorOutdoorUnits"],
            missingAny: ["commissioning", "tightnessEvacuation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Inbetriebnahme oder Dichtheitsprüfung fehlen zentrale Leistungen für Funktionsnachweis und Abnahme.",
          recommendation:
            "Dichtheitsprüfung, Evakuierung und Inbetriebnahme als verbindliche Leistungen aufnehmen.",
        },
        {
          key: "outdoor_unit_without_mounting_context",
          title: "Außengerät ohne Montage- oder Fundamenthinweis",
          severity: "medium",
          condition: {
            detectedAny: ["indoorOutdoorUnits"],
            missingAny: ["mounting", "roofOrWallMounting"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne Montage- oder Fundamenthinweise bleiben Aufstellung und Tragkonstruktion unklar.",
          recommendation:
            "Wandkonsolen, Dachaufständerung, Fundament oder Tragkonstruktion eindeutig festlegen.",
        },
        {
          key: "multi_indoor_units_without_control_logic",
          title: "Mehrere Innengeräte ohne klare Regelungs- oder Steuerlogik",
          severity: "medium",
          condition: {
            detectedAny: ["indoorOutdoorUnits"],
            missingAny: ["control"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei mehreren Innengeräten ohne klare Steuerungslogik bleiben Bedienung, Zonenbildung und Schnittstellen offen.",
          recommendation:
            "Regelungs- und Steuerkonzept für mehrere Innenzonen bzw. Geräte präzisieren.",
        },
      ],
    },
  },
];