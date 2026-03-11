/**
 * Systemlogik Querschnitt / gewerkeübergreifende Themen (Lückenanalyse).
 * Zusätzliche Ebene; Trigger-Engine bleibt unverändert.
 */

import type { SystemLogicDefinition } from "./types";

export const CROSS_SYSTEMS: SystemLogicDefinition[] = [
  {
    id: "cross_secondary_hydraulic_groups",
    trade: "cross",
    name: "Pumpengruppen / Sekundärhydraulik",
    metadata: {
      gewerk: "Querschnitt",
      systemKey: "cross_secondary_hydraulic_groups",
      label: "Pumpengruppen / Sekundärhydraulik",
      detection: {
        anyOf: [
          "Pumpengruppe",
          "Umwälzpumpe",
          "Mischergruppe",
          "Verteilerbalken",
          "Heizkreisgruppe",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "pump",
          label: "Pumpe",
          matchAny: ["Pumpe", "Umwälzpumpe", "Pumpengruppe"],
          severity: "high",
          requiredType: "required",
          description: "Pumpe bzw. Pumpeneinheit der Hydraulikgruppe.",
        },
        {
          key: "shutoffValves",
          label: "Absperrarmaturen",
          matchAny: ["Absperrarmatur", "Absperrarmaturen", "Absperrung"],
          severity: "high",
          requiredType: "required",
          description: "Absperrarmaturen der Hydraulikgruppe.",
        },
        {
          key: "controlValves",
          label: "Regelarmaturen / Mischer",
          matchAny: ["Regelarmatur", "Regelarmaturen", "Mischer", "Mischergruppe"],
          severity: "high",
          requiredType: "required",
          description: "Regelarmaturen und Mischer der Sekundärhydraulik.",
        },
        {
          key: "sensors",
          label: "Fühler / Messstellen",
          matchAny: ["Fühler", "Messstelle", "Messstellen", "Temperaturfühler"],
          severity: "medium",
          requiredType: "required",
          description: "Fühler und Messstellen der Hydraulikgruppe.",
        },
        {
          key: "insulation",
          label: "Dämmung",
          matchAny: ["Dämmung", "Isolierung"],
          severity: "medium",
          requiredType: "required",
          description: "Dämmung der Hydraulikgruppe.",
        },
        {
          key: "msrConnection",
          label: "Elektrische / MSR-Anbindung",
          matchAny: ["MSR-Anbindung", "elektrische Anbindung", "Regelungsanbindung"],
          severity: "high",
          requiredType: "required",
          description: "Elektrische bzw. MSR-Anbindung der Hydraulikgruppe.",
        },
        {
          key: "balancing",
          label: "Einregulierung",
          matchAny: ["Einregulierung", "hydraulischer Abgleich"],
          severity: "high",
          requiredType: "required",
          description: "Einregulierung der Pumpen- bzw. Heizkreisgruppen.",
        },
      ],
      optionalComponents: [
        {
          key: "diffPressureControl",
          label: "Differenzdruckregelung",
          matchAny: ["Differenzdruckregelung", "Differenzdruckregler"],
          severity: "medium",
          requiredType: "optional",
          description: "Differenzdruckregelung der Hydraulikgruppe.",
        },
        {
          key: "shutoffGroups",
          label: "Absperrgruppen",
          matchAny: ["Absperrgruppe", "Absperrgruppen"],
          severity: "low",
          requiredType: "optional",
          description: "Zusätzliche Absperrgruppen.",
        },
        {
          key: "serviceValves",
          label: "Service- / Wartungsarmaturen",
          matchAny: ["Servicearmatur", "Wartungsarmatur", "Wartungsarmaturen"],
          severity: "low",
          requiredType: "optional",
          description: "Service- und Wartungsarmaturen.",
        },
        {
          key: "hydraulicSeparator",
          label: "Hydraulische Weiche",
          matchAny: ["Hydraulische Weiche"],
          severity: "medium",
          requiredType: "optional",
          description: "Hydraulische Weiche im System.",
        },
        {
          key: "header",
          label: "Verteilerbalken",
          matchAny: ["Verteilerbalken"],
          severity: "low",
          requiredType: "optional",
          description: "Verteilerbalken der Sekundärhydraulik.",
        },
      ],
      logicRules: [
        {
          key: "hydraulic_group_without_valves",
          title: "Pumpengruppe ohne Absperr- oder Regelarmaturen",
          severity: "high",
          condition: {
            detectedAny: ["pump"],
            missingAny: ["shutoffValves", "controlValves"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Eine Pumpen- oder Hydraulikgruppe ohne Absperr- oder Regelarmaturen ist technisch unvollständig.",
          recommendation:
            "Absperrarmaturen und Regelorgane je Pumpen- oder Heizkreisgruppe eindeutig festlegen.",
        },
        {
          key: "hydraulic_group_without_msr_logic",
          title: "Hydraulikgruppe ohne MSR- oder Regelungslogik",
          severity: "high",
          condition: {
            detectedAny: ["pump", "controlValves"],
            missingAny: ["msrConnection"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne MSR- oder Regelungslogik bleibt die Funktion der Hydraulikgruppe im System offen.",
          recommendation:
            "MSR-Anbindung, Signalpunkte und Regelungskonzept der Gruppe ausdrücklich beschreiben.",
        },
        {
          key: "heating_circuits_without_balancing",
          title: "Heizkreisgruppen ohne Einregulierung",
          severity: "high",
          condition: {
            detectedAny: ["pump", "controlValves"],
            missingAny: ["balancing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Heizkreisgruppen ohne Einregulierung führen zu unklaren Funktions- und Leistungsgrenzen.",
          recommendation:
            "Einregulierung bzw. hydraulischen Abgleich der Gruppen ausdrücklich aufnehmen.",
        },
        {
          key: "larger_hydraulic_system_without_measurement_points",
          title: "Größere Hydrauliksysteme ohne Messstellen",
          severity: "medium",
          condition: {
            detectedAny: ["pump"],
            missingAny: ["sensors"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Messstellen bleibt die Betriebs- und Einregulierbarkeit größerer Hydrauliksysteme offen.",
          recommendation:
            "Messstellen und Fühler für Betrieb, Prüfung und Optimierung ergänzen.",
        },
        {
          key: "pump_groups_without_insulation",
          title: "Pumpengruppen ohne Dämmung",
          severity: "medium",
          condition: {
            detectedAny: ["pump"],
            missingAny: ["insulation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fehlende Dämmung an Pumpengruppen führt zu offenen Anforderungen an Energieeffizienz und Ausführung.",
          recommendation:
            "Dämmung der Pumpengruppen und Anschlussleitungen eindeutig festlegen.",
        },
      ],
    },
  },
  {
    id: "cross_heating_water_treatment",
    trade: "cross",
    name: "Wasseraufbereitung / Heizwasserqualität",
    metadata: {
      gewerk: "Querschnitt",
      systemKey: "cross_heating_water_treatment",
      label: "Wasseraufbereitung / Heizwasserqualität",
      detection: {
        anyOf: [
          "VDI 2035",
          "Heizwasseraufbereitung",
          "Enthärtung",
          "Vollentsalzung",
          "Nachfüllarmatur",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "treatmentMeasure",
          label: "Aufbereitungsmaßnahme",
          matchAny: ["Heizwasseraufbereitung", "Enthärtung", "Vollentsalzung"],
          severity: "high",
          requiredType: "required",
          description: "Art der Wasseraufbereitung bzw. Aufbereitungsmaßnahme.",
        },
        {
          key: "fillingResupply",
          label: "Befüllung / Nachspeisung",
          matchAny: ["Befüllung", "Nachspeisung", "Nachfüllarmatur"],
          severity: "high",
          requiredType: "required",
          description: "Befüllung und Nachspeisung des Heizsystems.",
        },
        {
          key: "waterQualityDocs",
          label: "Wasserqualitätsanforderung / Dokumentation",
          matchAny: ["VDI 2035", "Wasserqualität", "Dokumentation Wasserqualität"],
          severity: "high",
          requiredType: "required",
          description: "Qualitätsanforderungen und Dokumentation des Heizwassers.",
        },
        {
          key: "measurementProtocol",
          label: "Messung / Protokoll",
          matchAny: ["Messung", "Protokoll", "Messprotokoll"],
          severity: "medium",
          requiredType: "required",
          description: "Messung und Protokollierung der Wasserparameter.",
        },
      ],
      optionalComponents: [
        {
          key: "fillingStation",
          label: "Füllstation",
          matchAny: ["Füllstation"],
          severity: "medium",
          requiredType: "optional",
          description: "Füllstation für Befüllung und Nachspeisung.",
        },
        {
          key: "conductivityMonitoring",
          label: "Leitfähigkeitsüberwachung",
          matchAny: ["Leitfähigkeitsüberwachung"],
          severity: "medium",
          requiredType: "optional",
          description: "Überwachung der Leitfähigkeit des Heizwassers.",
        },
        {
          key: "filtersSeparators",
          label: "Filter / Schlammabscheider",
          matchAny: ["Filter", "Schlammabscheider"],
          severity: "medium",
          requiredType: "optional",
          description: "Filter- oder Abscheideeinrichtungen.",
        },
        {
          key: "automaticResupply",
          label: "Automatische Nachspeisung",
          matchAny: ["automatische Nachspeisung"],
          severity: "medium",
          requiredType: "optional",
          description: "Automatische Nachspeisung des Heizsystems.",
        },
      ],
      logicRules: [
        {
          key: "heating_water_without_treatment_or_responsibility",
          title: "Heizungsanlage ohne Aufbereitung oder Verantwortlichkeitsregelung",
          severity: "high",
          condition: {
            detectedAny: ["waterQualityDocs"],
            missingAny: ["treatmentMeasure"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Wenn Heizwasserqualität thematisch relevant ist, aber keine Aufbereitung oder Verantwortlichkeit beschrieben wird, bleibt ein wesentliches Risiko offen.",
          recommendation:
            "Aufbereitungsmaßnahme und Verantwortlichkeiten für Heizwasserqualität verbindlich festlegen.",
        },
        {
          key: "resupply_without_safeguard_concept",
          title: "Nachspeisung ohne Sicherung oder Konzept",
          severity: "high",
          condition: {
            detectedAny: ["fillingResupply"],
            missingAny: ["treatmentMeasure", "measurementProtocol"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Nachspeisung ohne Sicherungs- oder Qualitätskonzept birgt Risiken für Betrieb und Gewährleistung.",
          recommendation:
            "Nachspeisung mit Sicherung, Wasserbehandlung und Dokumentationspflicht konkret beschreiben.",
        },
        {
          key: "larger_heating_system_without_water_quality_note",
          title: "Größere Heizungsanlagen ohne Hinweis auf Wasserqualität",
          severity: "medium",
          condition: {
            detectedAny: ["fillingResupply"],
            missingAny: ["waterQualityDocs"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Hinweis auf Wasserqualität bleibt bei größeren Anlagen ein wichtiger Qualitäts- und Gewährleistungspunkt offen.",
          recommendation:
            "Wasserqualitätsanforderungen und anzuwendende Regeln, z. B. nach VDI 2035, ergänzen.",
        },
        {
          key: "heating_system_without_water_parameter_docs",
          title: "Heizsystem ohne Dokumentation der Wasserparameter",
          severity: "medium",
          condition: {
            detectedAny: ["treatmentMeasure"],
            missingAny: ["measurementProtocol"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Dokumentation der Wasserparameter fehlt ein wichtiger Nachweis für Betrieb und Gewährleistung.",
          recommendation:
            "Messung und Protokollierung der Wasserparameter verbindlich vorsehen.",
        },
      ],
    },
  },
  {
    id: "cross_testing_commissioning",
    trade: "cross",
    name: "Mess-, Prüf- und Inbetriebnahmeleistungen",
    metadata: {
      gewerk: "Querschnitt",
      systemKey: "cross_testing_commissioning",
      label: "Mess-, Prüf- und Inbetriebnahmeleistungen",
      detection: {
        anyOf: [
          "Inbetriebnahme",
          "Einregulierung",
          "Funktionsprüfung",
          "Messprotokoll",
          "Druckprüfung",
          "Spülung",
        ],
        minHits: 1,
        weakTerms: ["Inbetriebnahme", "Messprotokoll", "Druckprüfung", "Funktionsprüfung"],
      },
      requiredComponents: [
        {
          key: "testing",
          label: "Prüfung",
          matchAny: ["Prüfung", "Funktionsprüfung", "Druckprüfung"],
          severity: "high",
          requiredType: "required",
          description: "Prüfleistungen im Querschnitt über mehrere Gewerke.",
        },
        {
          key: "balancing",
          label: "Einregulierung",
          matchAny: ["Einregulierung", "Abgleich"],
          severity: "high",
          requiredType: "required",
          description: "Einregulierung und Abgleich technischer Systeme.",
        },
        {
          key: "commissioning",
          label: "Inbetriebnahme",
          matchAny: ["Inbetriebnahme"],
          severity: "high",
          requiredType: "required",
          description: "Inbetriebnahme der Anlagen.",
        },
        {
          key: "documentation",
          label: "Dokumentation",
          matchAny: ["Dokumentation", "Messprotokoll", "Prüfprotokoll"],
          severity: "medium",
          requiredType: "required",
          description: "Dokumentation von Prüf-, Mess- und Inbetriebnahmeleistungen.",
        },
      ],
      optionalComponents: [
        {
          key: "handoverProtocols",
          label: "Übergabeprotokolle",
          matchAny: ["Übergabeprotokoll", "Übergabeprotokolle"],
          severity: "low",
          requiredType: "optional",
          description: "Übergabeprotokolle der Anlagen.",
        },
        {
          key: "acceptanceDocs",
          label: "Abnahmeunterlagen",
          matchAny: ["Abnahmeunterlage", "Abnahmeunterlagen"],
          severity: "low",
          requiredType: "optional",
          description: "Abnahmeunterlagen der Gewerke.",
        },
        {
          key: "measurementDocs",
          label: "Messwertdokumentation",
          matchAny: ["Messwertdokumentation"],
          severity: "medium",
          requiredType: "optional",
          description: "Zusätzliche Messwertdokumentation.",
        },
        {
          key: "operatorDocs",
          label: "Betreiberunterlagen",
          matchAny: ["Betreiberunterlagen"],
          severity: "low",
          requiredType: "optional",
          description: "Unterlagen für den Betreiber.",
        },
      ],
      logicRules: [
        {
          key: "complex_plant_without_commissioning",
          title: "Komplexe Anlage ohne Inbetriebnahmeleistung",
          severity: "high",
          condition: {
            detectedAny: ["testing", "balancing"],
            missingAny: ["commissioning"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Bei komplexen Anlagen ohne Inbetriebnahmeleistung bleibt die betriebsbereite Übergabe offen.",
          recommendation:
            "Inbetriebnahme als eigenständigen und dokumentierten Leistungsbestandteil aufnehmen.",
        },
        {
          key: "water_system_without_pressure_test_or_flushing",
          title: "Wasserführendes System ohne Druckprüfung oder Spülung",
          severity: "high",
          condition: {
            detectedAny: ["testing"],
            missingAny: ["documentation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Bei wasserführenden Systemen ohne klare Prüf- und Nachweisstruktur bleiben Abnahme und Haftung offen.",
          recommendation:
            "Druckprüfung, Spülung und zugehörige Protokolle verbindlich festlegen.",
        },
        {
          key: "air_system_without_balancing",
          title: "Lufttechnisches System ohne Einregulierung",
          severity: "high",
          condition: {
            detectedAny: ["commissioning"],
            missingAny: ["balancing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Einregulierung bleibt die Funktionsfähigkeit lufttechnischer Systeme offen.",
          recommendation:
            "Einregulierung und Messnachweise für lufttechnische Systeme ausdrücklich vorsehen.",
        },
        {
          key: "controlled_system_without_function_test",
          title: "Geregeltes System ohne Funktionsprüfung",
          severity: "high",
          condition: {
            detectedAny: ["commissioning"],
            missingAny: ["testing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ein geregeltes System ohne Funktionsprüfung ist in der Abnahme und Leistungsprüfung unklar.",
          recommendation:
            "Funktionsprüfung mit Prüfschritten und Protokollpflicht verbindlich definieren.",
        },
        {
          key: "larger_system_without_measurement_logs",
          title: "Größere Anlage ohne Messprotokolle",
          severity: "medium",
          condition: {
            detectedAny: ["testing", "commissioning"],
            missingAny: ["documentation"],
          },
          categoryImpacts: {
            kalkulationsunsicherheit: "medium",
            technische_vollstaendigkeit: "medium",
          },
          explanation:
            "Ohne Messprotokolle fehlt bei größeren Anlagen ein belastbarer Nachweis der Leistungserbringung.",
          recommendation:
            "Messprotokolle und Messwertdokumentation in den Leistungsumfang aufnehmen.",
        },
        {
          key: "plant_without_handover_protocol",
          title: "Anlage ohne Übergabeprotokoll",
          severity: "medium",
          condition: {
            detectedAny: ["commissioning"],
            missingAny: ["handoverProtocols"],
          },
          categoryImpacts: {
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Übergabeprotokoll bleibt die formale Übergabe der Anlage unscharf.",
          recommendation:
            "Übergabeprotokolle und Abnahmeunterlagen ausdrücklich fordern.",
        },
      ],
    },
  },
  {
    id: "cross_documentation_handover",
    trade: "cross",
    name: "Dokumentation / Bestandsunterlagen",
    metadata: {
      gewerk: "Querschnitt",
      systemKey: "cross_documentation_handover",
      label: "Dokumentation / Bestandsunterlagen",
      detection: {
        anyOf: [
          "Dokumentation",
          "Revisionsunterlagen",
          "Bestandspläne",
          "Einweisungen",
          "Wartungsunterlagen",
        ],
        minHits: 1,
        weakTerms: ["Dokumentation"],
      },
      requiredComponents: [
        {
          key: "revisionDocs",
          label: "Revisionsunterlagen",
          matchAny: ["Revisionsunterlagen", "Revision"],
          severity: "high",
          requiredType: "required",
          description: "Revisionsunterlagen der Anlagen.",
        },
        {
          key: "asBuiltPlans",
          label: "Bestandspläne",
          matchAny: ["Bestandspläne", "Bestandsplan"],
          severity: "high",
          requiredType: "required",
          description: "Bestandspläne und Ausführungsstände.",
        },
        {
          key: "systemDocumentation",
          label: "Dokumentation der Anlagen",
          matchAny: ["Dokumentation", "Anlagendokumentation"],
          severity: "high",
          requiredType: "required",
          description: "Dokumentation der technischen Anlagen.",
        },
        {
          key: "instructionHandover",
          label: "Einweisung / Übergabe",
          matchAny: ["Einweisung", "Übergabe", "Betreiber-Einweisung"],
          severity: "medium",
          requiredType: "required",
          description: "Einweisung des Betreibers und formale Übergabe.",
        },
        {
          key: "maintenanceDocs",
          label: "Wartungsunterlagen",
          matchAny: ["Wartungsunterlagen", "Betriebsunterlagen"],
          severity: "medium",
          requiredType: "required",
          description: "Wartungs- und Betriebsunterlagen.",
        },
      ],
      optionalComponents: [
        {
          key: "digitalDocs",
          label: "Digitale Anlagendokumentation",
          matchAny: ["Digitale Anlagendokumentation"],
          severity: "low",
          requiredType: "optional",
          description: "Digitale Anlagendokumentation.",
        },
        {
          key: "revisionFolder",
          label: "Revisionsordner",
          matchAny: ["Revisionsordner"],
          severity: "low",
          requiredType: "optional",
          description: "Physischer oder digitaler Revisionsordner.",
        },
        {
          key: "operatorManual",
          label: "Betreiberhandbuch",
          matchAny: ["Betreiberhandbuch"],
          severity: "medium",
          requiredType: "optional",
          description: "Betreiberhandbuch der Anlagen.",
        },
        {
          key: "trainingDocs",
          label: "Schulungsunterlagen",
          matchAny: ["Schulungsunterlagen"],
          severity: "low",
          requiredType: "optional",
          description: "Unterlagen für Schulung und Einweisung.",
        },
      ],
      logicRules: [
        {
          key: "complex_system_without_documentation",
          title: "Komplexe Anlage ohne Dokumentationsleistungen",
          severity: "high",
          condition: {
            detectedAny: ["systemDocumentation"],
            missingAny: ["revisionDocs", "asBuiltPlans"],
          },
          categoryImpacts: {
            vertrags_lv_risiken: "high",
            kalkulationsunsicherheit: "medium",
            technische_vollstaendigkeit: "medium",
          },
          explanation:
            "Bei komplexen Anlagen ohne belastbare Dokumentationsleistungen bleibt ein wirtschaftlich und vertraglich kritischer Leistungsblock offen.",
          recommendation:
            "Revisionsunterlagen, Bestandspläne und Anlagendokumentation verbindlich festlegen.",
        },
        {
          key: "handover_without_instruction",
          title: "Übergabe der Anlage ohne Einweisung",
          severity: "high",
          condition: {
            detectedAny: ["systemDocumentation"],
            missingAny: ["instructionHandover"],
          },
          categoryImpacts: {
            vertrags_lv_risiken: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Einweisung bleibt die geschuldete Übergabeleistung unvollständig.",
          recommendation:
            "Einweisung des Betreibers und formale Übergabeleistung ausdrücklich vorsehen.",
        },
        {
          key: "project_without_revision_or_asbuilt",
          title: "Größeres Projekt ohne Revisionsunterlagen oder Bestandspläne",
          severity: "high",
          condition: {
            detectedAny: ["systemDocumentation"],
            missingAny: ["revisionDocs", "asBuiltPlans"],
          },
          categoryImpacts: {
            vertrags_lv_risiken: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Revisionsunterlagen oder Bestandspläne fehlen wesentliche Grundlagen für Betrieb und spätere Umbauten.",
          recommendation:
            "Revisionsunterlagen und Bestandspläne als festen Projektbestandteil definieren.",
        },
        {
          key: "documentation_without_clear_scope",
          title: "Dokumentation ohne klaren Umfang",
          severity: "medium",
          condition: {
            detectedAny: ["systemDocumentation"],
            missingAny: ["maintenanceDocs"],
          },
          categoryImpacts: {
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Dokumentation ohne klaren Umfang führt regelmäßig zu Nachträgen und Streit über Leistungsgrenzen.",
          recommendation:
            "Umfang, Form und Inhalt der Dokumentation präzise festlegen.",
        },
        {
          key: "missing_maintenance_or_operation_docs",
          title: "Keine Wartungs- oder Betriebsunterlagen",
          severity: "medium",
          condition: {
            detectedAny: ["systemDocumentation"],
            missingAny: ["maintenanceDocs"],
          },
          categoryImpacts: {
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Wartungs- oder Betriebsunterlagen bleibt die betriebliche Nutzbarkeit der Dokumentation unzureichend.",
          recommendation:
            "Wartungs- und Betriebsunterlagen als verpflichtenden Bestandteil der Übergabe aufnehmen.",
        },
      ],
    },
  },
];