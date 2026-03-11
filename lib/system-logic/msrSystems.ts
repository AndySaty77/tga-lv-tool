/**
 * Systemlogik MSR / Gebäudeautomation (Lückenanalyse).
 * Zusätzliche Ebene; Trigger-Engine bleibt unverändert.
 */

import type { SystemLogicDefinition } from "./types";

export const MSR_SYSTEMS: SystemLogicDefinition[] = [
  {
    id: "msr_building_automation_system",
    trade: "msr",
    name: "MSR / Gebäudeautomation allgemein",
    metadata: {
      gewerk: "MSR",
      systemKey: "msr_building_automation_system",
      label: "MSR / Gebäudeautomation allgemein",
      detection: {
        anyOf: [
          "MSR",
          "Gebäudeautomation",
          "GA",
          "DDC",
          "Automationsstation",
          "Regelung",
          "BACnet",
          "Modbus",
          "KNX",
          "Datenpunktliste",
          "Funktionsliste",
          "GLT",
          "Schaltschrankanbindung",
        ],
        minHits: 1,
        weakTerms: ["Regelung", "GA", "MSR", "Gebäudeautomation"],
      },
      requiredComponents: [
        {
          key: "automationController",
          label: "Automationsstation / Controller",
          matchAny: ["Automationsstation", "Controller", "DDC"],
          severity: "high",
          requiredType: "required",
          description: "Automationsstation bzw. Controller der GA/MSR.",
        },
        {
          key: "fieldDevices",
          label: "Feldgeräte / Sensorik / Aktorik",
          matchAny: ["Sensorik", "Aktorik", "Feldgerät", "Feldgeräte"],
          severity: "high",
          requiredType: "required",
          description: "Feldgeräte, Sensorik und Aktorik der Anlage.",
        },
        {
          key: "cabinetInterface",
          label: "Schaltschrankanbindung",
          matchAny: ["Schaltschrankanbindung", "Schaltschrank", "GA-Schrank"],
          severity: "medium",
          requiredType: "required",
          description: "Anbindung an Schaltschrank bzw. Automationsschrank.",
        },
        {
          key: "dataPointList",
          label: "Datenpunktliste / Funktionsliste",
          matchAny: ["Datenpunktliste", "Funktionsliste", "DPL"],
          severity: "high",
          requiredType: "required",
          description: "Datenpunkt- bzw. Funktionsliste der Gebäudeautomation.",
        },
        {
          key: "interfaces",
          label: "Kommunikationsschnittstellen",
          matchAny: ["Kommunikationsschnittstelle", "BACnet", "Modbus", "KNX"],
          severity: "high",
          requiredType: "required",
          description: "Kommunikationsschnittstellen der Automationslösung.",
        },
        {
          key: "engineering",
          label: "Parametrierung / Programmierung",
          matchAny: ["Parametrierung", "Programmierung", "Engineering"],
          severity: "high",
          requiredType: "required",
          description: "Parametrierung und Programmierung der GA/MSR.",
        },
        {
          key: "commissioning",
          label: "Inbetriebnahme",
          matchAny: ["Inbetriebnahme"],
          severity: "high",
          requiredType: "required",
          description: "Inbetriebnahme der GA/MSR-Anlage.",
        },
        {
          key: "functionalTesting",
          label: "Funktionsprüfung",
          matchAny: ["Funktionsprüfung", "Funktionstest"],
          severity: "high",
          requiredType: "required",
          description: "Funktionsprüfung der Automationsanlage.",
        },
        {
          key: "documentation",
          label: "Dokumentation",
          matchAny: ["Dokumentation", "Revisionsunterlagen"],
          severity: "medium",
          requiredType: "required",
          description: "Dokumentation der GA/MSR-Anlage.",
        },
      ],
      optionalComponents: [
        {
          key: "visualization",
          label: "Visualisierung",
          matchAny: ["Visualisierung", "GLT", "Managementebene"],
          severity: "medium",
          requiredType: "optional",
          description: "Visualisierung und Managementebene.",
        },
        {
          key: "trendingAlarming",
          label: "Trend / Alarmierung",
          matchAny: ["Trend", "Alarmierung", "Trendaufzeichnung"],
          severity: "medium",
          requiredType: "optional",
          description: "Trend- und Alarmierungsfunktionen.",
        },
        {
          key: "remoteAccess",
          label: "Fernzugriff",
          matchAny: ["Fernzugriff", "Fernwartung"],
          severity: "medium",
          requiredType: "optional",
          description: "Fernzugriff auf die Automationsanlage.",
        },
        {
          key: "bacnetManagement",
          label: "BACnet-Managementebene",
          matchAny: ["BACnet-Managementebene"],
          severity: "medium",
          requiredType: "optional",
          description: "BACnet-Managementebene der Anlage.",
        },
        {
          key: "gltConnection",
          label: "GLT-Aufschaltung",
          matchAny: ["GLT-Aufschaltung", "GLT-Anbindung"],
          severity: "medium",
          requiredType: "optional",
          description: "Aufschaltung auf eine GLT/Managementebene.",
        },
        {
          key: "optimizationFunctions",
          label: "Optimierungsfunktionen",
          matchAny: ["Optimierungsfunktion", "Optimierungsfunktionen"],
          severity: "medium",
          requiredType: "optional",
          description: "Optimierungsfunktionen der GA.",
        },
      ],
      logicRules: [
        {
          key: "ga_without_field_logic",
          title: "GA/MSR ohne Sensorik- oder Aktoriklogik",
          severity: "high",
          condition: {
            detectedAny: ["automationController"],
            missingAny: ["fieldDevices"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Eine GA/MSR-Anlage ohne Sensorik- oder Aktoriklogik ist funktional unvollständig.",
          recommendation:
            "Sensorik, Aktorik und Feldgeräte je Anlage bzw. Regelkreis klar zuordnen.",
        },
        {
          key: "ddc_without_engineering_or_commissioning",
          title: "DDC ohne Parametrierung / Inbetriebnahme",
          severity: "high",
          condition: {
            detectedAny: ["automationController"],
            missingAny: ["engineering", "commissioning"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Parametrierung oder Inbetriebnahme bleibt unklar, wer die Anlage betriebsbereit herstellt.",
          recommendation:
            "Engineering, Parametrierung und Inbetriebnahme ausdrücklich in den Leistungsumfang aufnehmen.",
        },
        {
          key: "protocols_without_interface_description",
          title: "BACnet/Modbus/KNX ohne Schnittstellenbeschreibung",
          severity: "high",
          condition: {
            detectedAny: ["interfaces"],
            missingAny: ["interfaces"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Erkannte Kommunikationsprotokolle ohne belastbare Schnittstellenbeschreibung erzeugen hohe Integrationsrisiken.",
          recommendation:
            "Schnittstellen, Protokolle, Verantwortlichkeiten und Übergabepunkte konkret beschreiben.",
        },
        {
          key: "ga_without_data_point_logic",
          title: "MSR ohne Datenpunkt- oder Funktionslogik",
          severity: "high",
          condition: {
            detectedAny: ["automationController"],
            missingAny: ["dataPointList"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne Datenpunkt- oder Funktionslogik ist der tatsächliche Leistungsumfang der GA kaum belastbar.",
          recommendation:
            "Datenpunktliste, Funktionsliste und Anlagenlogik verbindlich ergänzen.",
        },
        {
          key: "ga_without_docs_or_tests",
          title: "GA ohne Dokumentation oder Prüfleistungen",
          severity: "high",
          condition: {
            detectedAny: ["automationController"],
            missingAny: ["documentation", "functionalTesting"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fehlende Dokumentation oder Prüfleistungen erschweren Abnahme, Betrieb und Gewährleistung.",
          recommendation:
            "Dokumentation, Funktionsprüfung und Prüfprotokolle ausdrücklich festlegen.",
        },
        {
          key: "visualization_unclear",
          title: "Visualisierung angedeutet, aber ohne Beschreibung",
          severity: "medium",
          condition: {
            detectedAny: ["visualization"],
            missingAny: ["gltConnection"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Eine nur angedeutete Visualisierung ohne klare Beschreibung führt zu offenen Leistungsgrenzen.",
          recommendation:
            "Umfang, Bilder, Bedienfunktionen und Schnittstellen der Visualisierung konkret beschreiben.",
        },
        {
          key: "remote_or_alarming_unclear",
          title: "Fernzugriff oder Alarmierung unklar beschrieben",
          severity: "medium",
          condition: {
            detectedAny: ["remoteAccess", "trendingAlarming"],
            missingAny: ["documentation"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fernzugriff oder Alarmierung ohne klare Beschreibung erzeugen Sicherheits- und Schnittstellenfragen.",
          recommendation:
            "Fernzugriff, Alarmierung, Benutzerrechte und technische Umsetzung konkret festlegen.",
        },
        {
          key: "hardware_software_split_missing",
          title: "Keine Abgrenzung zwischen Hardware- und Software-Datenpunkten",
          severity: "medium",
          condition: {
            detectedAny: ["dataPointList"],
            missingAny: ["engineering"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Trennung von Hardware- und Softwaredatenpunkten bleibt der Engineering-Umfang unscharf.",
          recommendation:
            "Hardware- und Softwaredatenpunkte sowie Engineering-Anteile getrennt ausweisen.",
        },
      ],
    },
  },
  {
    id: "msr_field_devices",
    trade: "msr",
    name: "Feldgeräte: Sensorik / Aktorik",
    metadata: {
      gewerk: "MSR",
      systemKey: "msr_field_devices",
      label: "Feldgeräte: Sensorik / Aktorik",
      detection: {
        anyOf: [
          "Temperaturfühler",
          "Drucksensor",
          "Differenzdrucksensor",
          "Feuchtefühler",
          "Volumenstromsensor",
          "Stellmotor",
          "Ventilantrieb",
          "Klappenantrieb",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "sensors",
          label: "Fühler / Sensoren",
          matchAny: [
            "Temperaturfühler",
            "Drucksensor",
            "Differenzdrucksensor",
            "Feuchtefühler",
            "Volumenstromsensor",
            "Sensor",
          ],
          severity: "high",
          requiredType: "required",
          description: "Sensorik und Fühler der Automationsanlage.",
        },
        {
          key: "actuators",
          label: "Aktoren / Stellantriebe",
          matchAny: ["Stellmotor", "Ventilantrieb", "Klappenantrieb", "Aktor", "Aktorik"],
          severity: "high",
          requiredType: "required",
          description: "Aktoren und Stellantriebe der Automationsanlage.",
        },
        {
          key: "mountingAccessories",
          label: "Montagezubehör / Tauchhülsen / Messnippel",
          matchAny: ["Tauchhülse", "Messnippel", "Montagezubehör"],
          severity: "medium",
          requiredType: "required",
          description: "Montagezubehör wie Tauchhülsen oder Messnippel.",
        },
        {
          key: "wiring",
          label: "Verdrahtung / Anschluss",
          matchAny: ["Verdrahtung", "Anschluss", "Signalanschluss"],
          severity: "high",
          requiredType: "required",
          description: "Verdrahtung und Anschluss der Feldgeräte.",
        },
        {
          key: "addressing",
          label: "Adressierung / Zuordnung",
          matchAny: ["Adressierung", "Zuordnung", "Kennzeichnung"],
          severity: "medium",
          requiredType: "required",
          description: "Adressierung und logische Zuordnung der Feldgeräte.",
        },
        {
          key: "parameterizationTesting",
          label: "Parametrierung / Prüfung",
          matchAny: ["Parametrierung", "Prüfung", "Test"],
          severity: "medium",
          requiredType: "required",
          description: "Parametrierung und Prüfung der Feldgeräte.",
        },
      ],
      optionalComponents: [
        {
          key: "protectionTubes",
          label: "Schutzrohre",
          matchAny: ["Schutzrohr", "Schutzrohre"],
          severity: "low",
          requiredType: "optional",
          description: "Schutzrohre für Fühler und Leitungen.",
        },
        {
          key: "mountingConsoles",
          label: "Montagekonsolen",
          matchAny: ["Montagekonsole", "Montagekonsolen"],
          severity: "low",
          requiredType: "optional",
          description: "Montagekonsolen und Halterungen.",
        },
        {
          key: "weatherHousing",
          label: "Wettergehäuse",
          matchAny: ["Wettergehäuse"],
          severity: "low",
          requiredType: "optional",
          description: "Wettergehäuse für Außenfühler o. Ä.",
        },
        {
          key: "calibration",
          label: "Kalibrierung",
          matchAny: ["Kalibrierung"],
          severity: "medium",
          requiredType: "optional",
          description: "Kalibrierung der Sensorik.",
        },
        {
          key: "redundancySensors",
          label: "Redundanzsensorik",
          matchAny: ["Redundanzsensorik", "Redundanzfühler"],
          severity: "medium",
          requiredType: "optional",
          description: "Redundante Sensorik bei kritischen Messstellen.",
        },
      ],
      logicRules: [
        {
          key: "sensorics_without_wiring",
          title: "Sensorik ohne Verdrahtungs- oder Anschlusslogik",
          severity: "high",
          condition: {
            detectedAny: ["sensors"],
            missingAny: ["wiring"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Sensorik ohne Verdrahtungs- oder Anschlusslogik ist für Montage und Inbetriebnahme unvollständig beschrieben.",
          recommendation:
            "Verdrahtung, Anschlussart und Einbindung der Sensorik eindeutig festlegen.",
        },
        {
          key: "temperature_measurement_without_accessories",
          title: "Temperaturmessung ohne Tauchhülse oder Einbauzubehör",
          severity: "high",
          condition: {
            detectedAny: ["sensors"],
            missingAny: ["mountingAccessories"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei Temperaturmessung ohne Tauchhülse oder Einbauzubehör ist die technische Ausführung offen.",
          recommendation:
            "Tauchhülsen, Messnippel und Einbauzubehör je Messstelle eindeutig beschreiben.",
        },
        {
          key: "actuator_without_control_logic",
          title: "Aktorik ohne Ansteuerungslogik",
          severity: "high",
          condition: {
            detectedAny: ["actuators"],
            missingAny: ["parameterizationTesting"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Aktorik ohne Ansteuerungs- oder Parametrierlogik ist funktional nicht belastbar beschrieben.",
          recommendation:
            "Ansteuerung, Signalart und Parametrierung der Aktoren festlegen.",
        },
        {
          key: "valves_or_dampers_without_actuator_assignment",
          title: "Ventile oder Klappen ohne Antrieb / Regelungszuordnung",
          severity: "high",
          condition: {
            detectedAny: ["actuators"],
            missingAny: ["addressing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne Zuordnung von Antrieben zu Ventilen oder Klappen bleibt der Regelkreis technisch offen.",
          recommendation:
            "Antrieb, Regelungszuordnung und Funktionsbezug je Feldgerät klar definieren.",
        },
        {
          key: "field_devices_without_addressing",
          title: "Feldgeräte ohne Adressierungs- oder Zuordnungslogik",
          severity: "medium",
          condition: {
            detectedAny: ["sensors", "actuators"],
            missingAny: ["addressing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne Adressierungs- oder Zuordnungslogik wird die Inbetriebnahme und Dokumentation unnötig unscharf.",
          recommendation:
            "Adressierung, Benennung und Gerätezuordnung verbindlich festlegen.",
        },
        {
          key: "sensorics_without_testing_or_calibration",
          title: "Sensorik ohne Prüf- oder Kalibrierbezug",
          severity: "medium",
          condition: {
            detectedAny: ["sensors"],
            missingAny: ["parameterizationTesting", "calibration"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Prüf- oder Kalibrierbezug bleibt die Qualität und Genauigkeit der Messstellen offen.",
          recommendation:
            "Prüfung und gegebenenfalls Kalibrierung der Sensorik ausdrücklich vorsehen.",
        },
      ],
    },
  },
  {
    id: "msr_control_cabinet",
    trade: "msr",
    name: "Schaltschrank / Automationsschrank",
    metadata: {
      gewerk: "MSR",
      systemKey: "msr_control_cabinet",
      label: "Schaltschrank / Automationsschrank",
      detection: {
        anyOf: [
          "Schaltschrank MSR",
          "GA-Schrank",
          "DDC-Schrank",
          "Automationsschrank",
          "Feldverteiler Automation",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "cabinet",
          label: "Schrank / Gehäuse",
          matchAny: ["Schrank", "Gehäuse", "Automationsschrank", "DDC-Schrank"],
          severity: "high",
          requiredType: "required",
          description: "Schrank bzw. Gehäuse der Automation.",
        },
        {
          key: "controller",
          label: "Controller / Automationsstation",
          matchAny: ["Controller", "Automationsstation", "DDC"],
          severity: "high",
          requiredType: "required",
          description: "Controller oder Automationsstation im Schrank.",
        },
        {
          key: "powerSupplies",
          label: "Netzteile",
          matchAny: ["Netzteil", "Netzteile"],
          severity: "medium",
          requiredType: "required",
          description: "Netzteile und Hilfsspannungsversorgung.",
        },
        {
          key: "ioTerminalLevel",
          label: "Klemmen / I/O-Ebene",
          matchAny: ["Klemmen", "I/O", "I/O-Ebene", "Reihenklemmen"],
          severity: "high",
          requiredType: "required",
          description: "Klemmen und I/O-Ebene des Schranks.",
        },
        {
          key: "fuses",
          label: "Sicherungen",
          matchAny: ["Sicherung", "Sicherungen"],
          severity: "medium",
          requiredType: "required",
          description: "Absicherung im Automationsschrank.",
        },
        {
          key: "marking",
          label: "Beschriftung",
          matchAny: ["Beschriftung", "Kennzeichnung"],
          severity: "medium",
          requiredType: "required",
          description: "Beschriftung des Schranks, der Klemmen und Komponenten.",
        },
        {
          key: "plans",
          label: "Stromlauf- / Klemmenpläne",
          matchAny: ["Stromlaufplan", "Klemmenplan", "Schaltplan"],
          severity: "high",
          requiredType: "required",
          description: "Stromlauf- und Klemmenpläne des Schranks.",
        },
        {
          key: "testing",
          label: "Prüfung",
          matchAny: ["Prüfung", "Schrankprüfung", "Funktionsprüfung"],
          severity: "high",
          requiredType: "required",
          description: "Prüfung des Schaltschranks.",
        },
        {
          key: "documentation",
          label: "Dokumentation",
          matchAny: ["Dokumentation", "Revisionsunterlagen"],
          severity: "medium",
          requiredType: "required",
          description: "Dokumentation des Automationsschranks.",
        },
      ],
      optionalComponents: [
        {
          key: "ups",
          label: "USV",
          matchAny: ["USV"],
          severity: "medium",
          requiredType: "optional",
          description: "Unterbrechungsfreie Stromversorgung.",
        },
        {
          key: "cabinetClimate",
          label: "Schrankklimatisierung",
          matchAny: ["Schrankklimatisierung"],
          severity: "medium",
          requiredType: "optional",
          description: "Kühlung oder Belüftung des Schaltschranks.",
        },
        {
          key: "localPanel",
          label: "Bedientableau",
          matchAny: ["Bedientableau", "Bedienpanel"],
          severity: "low",
          requiredType: "optional",
          description: "Lokales Bedien- oder Anzeigeelement.",
        },
        {
          key: "networkDevices",
          label: "Router / Switch",
          matchAny: ["Router", "Switch"],
          severity: "medium",
          requiredType: "optional",
          description: "Netzwerkkomponenten im Schaltschrank.",
        },
        {
          key: "remoteMaintenance",
          label: "Fernwartungsmodul",
          matchAny: ["Fernwartungsmodul", "Fernwartung"],
          severity: "medium",
          requiredType: "optional",
          description: "Fernwartungsmodul oder Fernzugriffshardware.",
        },
      ],
      logicRules: [
        {
          key: "cabinet_without_io_logic",
          title: "Automationsschrank ohne I/O- oder Klemmenlogik",
          severity: "high",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["ioTerminalLevel"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ein Automationsschrank ohne I/O- oder Klemmenlogik ist technisch nicht belastbar beschrieben.",
          recommendation:
            "I/O-Ebene, Klemmenstruktur und Anschlusslogik des Schranks klar definieren.",
        },
        {
          key: "cabinet_without_power_or_fuses",
          title: "Schaltschrank ohne Stromversorgung / Absicherung",
          severity: "high",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["powerSupplies", "fuses"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Stromversorgung oder Absicherung bleibt der Grundaufbau des Schranks offen.",
          recommendation:
            "Netzteile, Spannungsversorgung und Absicherung ausdrücklich festlegen.",
        },
        {
          key: "cabinet_without_plans_docs_marking",
          title: "Schrank ohne Pläne / Dokumentation / Beschriftung",
          severity: "high",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["plans", "documentation", "marking"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Pläne, Dokumentation oder Beschriftung ist der Schrank nicht sauber prüf- und wartbar beschrieben.",
          recommendation:
            "Pläne, Dokumentation und Beschriftung des Schranks verbindlich vorsehen.",
        },
        {
          key: "cabinet_without_testing",
          title: "MSR-Schrank ohne Prüfung / Funktionsprüfung",
          severity: "high",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["testing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Schrankprüfung oder Funktionsprüfung fehlen zentrale Nachweise für Inbetriebnahme und Abnahme.",
          recommendation:
            "Prüfung und Funktionsprüfung des Schranks mit Protokollpflicht festlegen.",
        },
        {
          key: "cabinet_without_remote_or_network_concept",
          title: "Schaltschrank ohne Fernwartungs- oder Netzwerkkonzept",
          severity: "medium",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["networkDevices", "remoteMaintenance"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Fernwartungs- oder Netzwerkkonzept bleiben Kommunikations- und Betriebsaspekte unklar.",
          recommendation:
            "Netzwerk- und Fernwartungskonzept des Schranks bei Bedarf ausdrücklich beschreiben.",
        },
        {
          key: "cabinet_without_terminal_marking",
          title: "I/O-Ebene ohne Klemmen- oder Beschriftungslogik",
          severity: "medium",
          condition: {
            detectedAny: ["ioTerminalLevel"],
            missingAny: ["marking"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Klemmen- oder Beschriftungslogik bleibt die Anschluss- und Servicefähigkeit eingeschränkt.",
          recommendation:
            "Klemmenkennzeichnung und Beschriftungslogik im Schaltschrank verbindlich festlegen.",
        },
      ],
    },
  },
  {
    id: "msr_communication_protocols",
    trade: "msr",
    name: "Kommunikationssysteme / BACnet / Modbus / KNX / M-Bus",
    metadata: {
      gewerk: "MSR",
      systemKey: "msr_communication_protocols",
      label: "Kommunikationssysteme / BACnet / Modbus / KNX / M-Bus",
      detection: {
        anyOf: [
          "BACnet",
          "Modbus",
          "KNX",
          "M-Bus",
          "TCP/IP",
          "Kommunikationsschnittstelle",
          "Protokollintegration",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "communicationInterface",
          label: "Kommunikationsschnittstelle",
          matchAny: ["Kommunikationsschnittstelle", "Schnittstelle"],
          severity: "high",
          requiredType: "required",
          description: "Kommunikationsschnittstelle der Anlage.",
        },
        {
          key: "networkConnection",
          label: "Netzwerkanbindung",
          matchAny: ["Netzwerkanbindung", "TCP/IP", "Netzwerk"],
          severity: "high",
          requiredType: "required",
          description: "Netzwerkanbindung der Automations- oder Managementebene.",
        },
        {
          key: "addressing",
          label: "Adressierung",
          matchAny: ["Adressierung", "Adresse", "Device ID"],
          severity: "medium",
          requiredType: "required",
          description: "Adressierung der Kommunikationsgeräte und Datenpunkte.",
        },
        {
          key: "mapping",
          label: "Datenpunktmapping",
          matchAny: ["Datenpunktmapping", "Mapping", "Objektzuordnung"],
          severity: "high",
          requiredType: "required",
          description: "Datenpunktzuordnung und Mapping.",
        },
        {
          key: "integrationTest",
          label: "Integrationstest",
          matchAny: ["Integrationstest", "Schnittstellentest"],
          severity: "high",
          requiredType: "required",
          description: "Integrationstest der Kommunikationsschnittstellen.",
        },
        {
          key: "documentation",
          label: "Dokumentation",
          matchAny: ["Dokumentation", "Schnittstellenbeschreibung"],
          severity: "medium",
          requiredType: "required",
          description: "Dokumentation der Kommunikationsschnittstellen.",
        },
      ],
      optionalComponents: [
        {
          key: "gateways",
          label: "Gateways",
          matchAny: ["Gateway", "Gateways"],
          severity: "medium",
          requiredType: "optional",
          description: "Kommunikationsgateways.",
        },
        {
          key: "routers",
          label: "Router",
          matchAny: ["Router"],
          severity: "medium",
          requiredType: "optional",
          description: "Router oder Kommunikationsrouter.",
        },
        {
          key: "itAlignment",
          label: "VLAN-/IT-Abstimmung",
          matchAny: ["VLAN", "IT-Abstimmung", "Netzwerkabstimmung"],
          severity: "medium",
          requiredType: "optional",
          description: "Abstimmung mit IT/VLAN-Umgebung.",
        },
        {
          key: "timeServer",
          label: "Zeitserver",
          matchAny: ["Zeitserver"],
          severity: "low",
          requiredType: "optional",
          description: "Zeitserver für synchronisierte Systeme.",
        },
        {
          key: "redundancy",
          label: "Redundanz",
          matchAny: ["Redundanz", "redundant"],
          severity: "medium",
          requiredType: "optional",
          description: "Redundanz der Kommunikationsstruktur.",
        },
      ],
      logicRules: [
        {
          key: "protocol_without_mapping",
          title: "BACnet/Modbus/KNX ohne Datenpunktzuordnung",
          severity: "high",
          condition: {
            detectedAny: ["communicationInterface"],
            missingAny: ["mapping"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
            technische_vollstaendigkeit: "high",
          },
          explanation:
            "Ohne Datenpunktzuordnung ist eine Kommunikationsschnittstelle fachlich und technisch nicht belastbar beschrieben.",
          recommendation:
            "Objekt- bzw. Datenpunktmapping verbindlich ergänzen.",
        },
        {
          key: "protocol_without_integration_test",
          title: "Kommunikationsprotokoll ohne Integrationstest",
          severity: "high",
          condition: {
            detectedAny: ["communicationInterface"],
            missingAny: ["integrationTest"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "high",
            vertrags_lv_risiken: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Integrationstest bleibt offen, wer die funktionierende Übergabe zwischen Systemen sicherstellt.",
          recommendation:
            "Integrationstest und Abnahmekriterien der Schnittstellen ausdrücklich festlegen.",
        },
        {
          key: "protocol_without_responsibility_split",
          title: "Schnittstelle ohne Verantwortlichkeitsabgrenzung",
          severity: "high",
          condition: {
            detectedAny: ["communicationInterface"],
            missingAny: ["documentation"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Eine Schnittstelle ohne Verantwortlichkeitsabgrenzung erzeugt hohe Abstimmungs- und Nachtragsrisiken.",
          recommendation:
            "Schnittstellenbeschreibung mit Zuständigkeiten, Übergabepunkten und Liefergrenzen erstellen.",
        },
        {
          key: "glt_connection_without_network_context",
          title: "GLT-Anbindung ohne Netzwerkanbindung / IT-Schnittstelle",
          severity: "high",
          condition: {
            detectedAny: ["communicationInterface"],
            missingAny: ["networkConnection", "itAlignment"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
            technische_vollstaendigkeit: "medium",
          },
          explanation:
            "Eine GLT- oder Managementanbindung ohne Netzwerk- und IT-Kontext ist in der Umsetzung hoch riskant.",
          recommendation:
            "Netzwerkanbindung, IT-Abstimmung und Sicherheitsanforderungen klar festlegen.",
        },
        {
          key: "communication_without_gateway_or_it_context",
          title: "Kommunikationssystem ohne IT-Abstimmungs- oder Gatewaylogik",
          severity: "medium",
          condition: {
            detectedAny: ["communicationInterface"],
            missingAny: ["gateways", "itAlignment"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Gateway- oder IT-Abstimmungslogik bleiben Integrationsgrenzen und technische Voraussetzungen offen.",
          recommendation:
            "Erforderliche Gateways und IT-Abstimmungen im Leistungsumfang berücksichtigen.",
        },
        {
          key: "protocol_without_addressing_logic",
          title: "Protokollintegration ohne Adressierungs- oder Mappingkonzept",
          severity: "medium",
          condition: {
            detectedAny: ["communicationInterface"],
            missingAny: ["addressing", "mapping"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Adressierungs- oder Mappingkonzept ist die Schnittstellenintegration nur oberflächlich beschrieben.",
          recommendation:
            "Adressierung, Mapping und Objektstruktur verbindlich spezifizieren.",
        },
      ],
    },
  },
  {
    id: "msr_room_automation",
    trade: "msr",
    name: "Raumautomation",
    metadata: {
      gewerk: "MSR",
      systemKey: "msr_room_automation",
      label: "Raumautomation",
      detection: {
        anyOf: [
          "Raumautomation",
          "Einzelraumregelung",
          "Raumregler",
          "Präsenzmelder",
          "CO₂-Fühler",
          "KNX-Raumcontroller",
          "VAV-Regelung",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "roomController",
          label: "Raumregler / Controller",
          matchAny: ["Raumregler", "Raumcontroller", "KNX-Raumcontroller"],
          severity: "high",
          requiredType: "required",
          description: "Raumregler bzw. Controller der Raumautomation.",
        },
        {
          key: "sensorics",
          label: "Sensorik",
          matchAny: ["Präsenzmelder", "CO₂-Fühler", "Sensorik", "Temperaturfühler"],
          severity: "high",
          requiredType: "required",
          description: "Sensorik der Raumautomation.",
        },
        {
          key: "actuators",
          label: "Aktorik",
          matchAny: ["Aktorik", "Stellglied", "Ventilantrieb", "Klappenantrieb"],
          severity: "high",
          requiredType: "required",
          description: "Aktorik und Stellglieder der Raumautomation.",
        },
        {
          key: "busWiring",
          label: "Verdrahtung / Bus",
          matchAny: ["Verdrahtung", "Bus", "KNX-Bus"],
          severity: "medium",
          requiredType: "required",
          description: "Verdrahtung bzw. Bus der Raumautomation.",
        },
        {
          key: "parameterization",
          label: "Parametrierung",
          matchAny: ["Parametrierung", "Programmierung"],
          severity: "high",
          requiredType: "required",
          description: "Parametrierung der Raumautomation.",
        },
        {
          key: "functionalDescription",
          label: "Funktionsbeschreibung",
          matchAny: ["Funktionsbeschreibung", "Funktionsliste"],
          severity: "high",
          requiredType: "required",
          description: "Funktionsbeschreibung des Raumregelkonzepts.",
        },
        {
          key: "commissioning",
          label: "Inbetriebnahme",
          matchAny: ["Inbetriebnahme"],
          severity: "high",
          requiredType: "required",
          description: "Inbetriebnahme der Raumautomation.",
        },
      ],
      optionalComponents: [
        {
          key: "sceneControl",
          label: "Szenensteuerung",
          matchAny: ["Szenensteuerung"],
          severity: "medium",
          requiredType: "optional",
          description: "Szenensteuerung der Raumautomation.",
        },
        {
          key: "timePrograms",
          label: "Zeitprogramme",
          matchAny: ["Zeitprogramm", "Zeitprogramme"],
          severity: "medium",
          requiredType: "optional",
          description: "Zeitprogramme der Raumautomation.",
        },
        {
          key: "windowContacts",
          label: "Fensterkontakte",
          matchAny: ["Fensterkontakt", "Fensterkontakte"],
          severity: "low",
          requiredType: "optional",
          description: "Fensterkontakte in der Raumautomation.",
        },
        {
          key: "dewPointSensors",
          label: "Taupunktsensorik",
          matchAny: ["Taupunktsensorik", "Taupunktsensor"],
          severity: "medium",
          requiredType: "optional",
          description: "Taupunktsensorik für Kühl- oder Komfortfunktionen.",
        },
        {
          key: "appVisualization",
          label: "App- oder Visualisierungsanbindung",
          matchAny: ["App-Anbindung", "Visualisierungsanbindung"],
          severity: "low",
          requiredType: "optional",
          description: "App- oder Visualisierungsanbindung der Raumautomation.",
        },
      ],
      logicRules: [
        {
          key: "room_automation_without_sensorics",
          title: "Raumautomation ohne Sensorik",
          severity: "high",
          condition: {
            detectedAny: ["roomController"],
            missingAny: ["sensorics"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Eine Raumautomation ohne Sensorik ist funktional unvollständig.",
          recommendation:
            "Sensorik je Raumfunktion eindeutig festlegen.",
        },
        {
          key: "room_automation_without_actuators",
          title: "Raumautomation ohne Aktorik / Stellglieder",
          severity: "high",
          condition: {
            detectedAny: ["roomController"],
            missingAny: ["actuators"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne Aktorik oder Stellglieder bleibt offen, wie die Regelung in den Raum eingreift.",
          recommendation:
            "Aktorik und Stellglieder je Raumregelkreis ausdrücklich definieren.",
        },
        {
          key: "room_control_without_param_or_commissioning",
          title: "Einzelraumregelung ohne Parametrierung / Inbetriebnahme",
          severity: "high",
          condition: {
            detectedAny: ["roomController"],
            missingAny: ["parameterization", "commissioning"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Parametrierung oder Inbetriebnahme bleibt unklar, wer die Raumregelung betriebsbereit herstellt.",
          recommendation:
            "Parametrierung und Inbetriebnahme je Raumautomation verbindlich aufnehmen.",
        },
        {
          key: "room_controller_without_function_desc",
          title: "Raumregler ohne Funktionsbeschreibung",
          severity: "high",
          condition: {
            detectedAny: ["roomController"],
            missingAny: ["functionalDescription"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ein Raumregler ohne Funktionsbeschreibung ist in seiner Wirkung und seinem Umfang unklar.",
          recommendation:
            "Funktionsbeschreibung, Betriebsarten und Logik des Raumreglers eindeutig festlegen.",
        },
        {
          key: "room_automation_without_bus_context",
          title: "Raumautomation ohne Bus- oder Verdrahtungskonzept",
          severity: "medium",
          condition: {
            detectedAny: ["roomController"],
            missingAny: ["busWiring"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Bus- oder Verdrahtungskonzept bleiben Installation und Schnittstellen unklar.",
          recommendation:
            "Bus- bzw. Verdrahtungskonzept der Raumautomation klar beschreiben.",
        },
        {
          key: "room_controller_without_usage_logic",
          title: "Raumregler ohne Szenen-, Zeit- oder Nutzungslogik",
          severity: "medium",
          condition: {
            detectedAny: ["roomController"],
            missingAny: ["sceneControl", "timePrograms"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei komplexeren Anwendungen ohne Nutzungslogik bleibt die tatsächliche Funktionalität unklar.",
          recommendation:
            "Szenen, Zeitprogramme oder sonstige Nutzungslogiken je Raumfunktion ergänzen.",
        },
      ],
    },
  },
  {
    id: "msr_hvac_control_modules",
    trade: "msr",
    name: "Heizungs-/Lüftungs-/Kälte-MSR-Funktionsmodule",
    metadata: {
      gewerk: "MSR",
      systemKey: "msr_hvac_control_modules",
      label: "Heizungs-/Lüftungs-/Kälte-MSR-Funktionsmodule",
      detection: {
        anyOf: [
          "Heizkreisregelung",
          "Pumpensteuerung",
          "Mischerregelung",
          "Lüftungsregelung",
          "VAV-Regelung",
          "Kälteerzeuger-Anbindung",
          "Wärmepumpenintegration",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "sensorics",
          label: "Sensorik",
          matchAny: ["Sensorik", "Fühler", "Temperaturfühler", "Drucksensor"],
          severity: "high",
          requiredType: "required",
          description: "Sensorik der Regelungsfunktion.",
        },
        {
          key: "actuators",
          label: "Aktorik",
          matchAny: ["Aktorik", "Stellantrieb", "Antrieb", "Relais"],
          severity: "high",
          requiredType: "required",
          description: "Aktorik der Regelungsfunktion.",
        },
        {
          key: "controlDescription",
          label: "Regelbeschreibung",
          matchAny: ["Regelbeschreibung", "Funktionsbeschreibung"],
          severity: "high",
          requiredType: "required",
          description: "Regelbeschreibung des Moduls.",
        },
        {
          key: "enablesInterlocks",
          label: "Freigaben / Verriegelungen",
          matchAny: ["Freigabe", "Verriegelung", "Freigaben", "Verriegelungen"],
          severity: "high",
          requiredType: "required",
          description: "Freigaben und Verriegelungen der Anlagenfunktion.",
        },
        {
          key: "setpointsModes",
          label: "Sollwerte / Betriebsarten",
          matchAny: ["Sollwert", "Sollwerte", "Betriebsart", "Betriebsarten"],
          severity: "medium",
          requiredType: "required",
          description: "Sollwerte und Betriebsarten.",
        },
        {
          key: "alarms",
          label: "Alarm- / Störmeldungen",
          matchAny: ["Alarm", "Störmeldung", "Alarmmeldung"],
          severity: "medium",
          requiredType: "required",
          description: "Alarm- und Störmeldungen.",
        },
        {
          key: "parameterization",
          label: "Parametrierung",
          matchAny: ["Parametrierung", "Programmierung"],
          severity: "high",
          requiredType: "required",
          description: "Parametrierung des Regelmoduls.",
        },
        {
          key: "functionalTesting",
          label: "Funktionsprüfung",
          matchAny: ["Funktionsprüfung", "Funktionstest"],
          severity: "high",
          requiredType: "required",
          description: "Funktionsprüfung des Regelmoduls.",
        },
      ],
      optionalComponents: [
        {
          key: "optimizationFunctions",
          label: "Optimierungsfunktionen",
          matchAny: ["Optimierungsfunktion", "Optimierungsfunktionen"],
          severity: "medium",
          requiredType: "optional",
          description: "Optimierungsfunktionen des Moduls.",
        },
        {
          key: "energyOptimization",
          label: "Energieoptimierung",
          matchAny: ["Energieoptimierung"],
          severity: "medium",
          requiredType: "optional",
          description: "Energieoptimierung.",
        },
        {
          key: "nightSetback",
          label: "Nachtabsenkung",
          matchAny: ["Nachtabsenkung"],
          severity: "low",
          requiredType: "optional",
          description: "Nachtabsenkung oder Nachtbetrieb.",
        },
        {
          key: "gltMessageHierarchy",
          label: "GLT-Meldehierarchien",
          matchAny: ["GLT-Meldehierarchie", "Meldehierarchie"],
          severity: "low",
          requiredType: "optional",
          description: "Hierarchie der Meldungen in der GLT.",
        },
        {
          key: "trending",
          label: "Trendaufzeichnung",
          matchAny: ["Trendaufzeichnung", "Trend"],
          severity: "medium",
          requiredType: "optional",
          description: "Trendaufzeichnung und Auswertung.",
        },
      ],
      logicRules: [
        {
          key: "control_loop_without_sensor_actuator_assignment",
          title: "Regelkreis ohne Sensorik- oder Aktorikzuordnung",
          severity: "high",
          condition: {
            detectedAny: ["controlDescription"],
            missingAny: ["sensorics", "actuators"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ein Regelkreis ohne Sensorik- oder Aktorikzuordnung ist funktional nicht belastbar beschrieben.",
          recommendation:
            "Sensorik und Aktorik je Regelkreis eindeutig zuordnen.",
        },
        {
          key: "control_loop_without_function_description",
          title: "Regelkreis ohne Funktionsbeschreibung",
          severity: "high",
          condition: {
            detectedAny: ["sensorics", "actuators"],
            missingAny: ["controlDescription"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Funktionsbeschreibung ist die tatsächliche Regelstrategie der Anlage offen.",
          recommendation:
            "Funktionsbeschreibung und Regelstrategie des Moduls verbindlich ergänzen.",
        },
        {
          key: "hvac_without_alarm_or_enable_logic",
          title: "Anlage mit MSR-Bezug ohne Störmelde- oder Freigabelogik",
          severity: "high",
          condition: {
            detectedAny: ["controlDescription"],
            missingAny: ["enablesInterlocks", "alarms"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Freigaben, Verriegelungen oder Störmeldelogik bleibt die Betriebs- und Sicherheitslogik unvollständig.",
          recommendation:
            "Freigaben, Verriegelungen und Störmeldungen je Anlage klar definieren.",
        },
        {
          key: "hls_component_without_automation_connection",
          title: "HLS-Komponente ohne Automationsanbindung",
          severity: "high",
          condition: {
            detectedAny: ["sensorics", "actuators"],
            missingAny: ["parameterization"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "high",
          },
          explanation:
            "Eine HLS-Komponente mit MSR-Bezug ohne belastbare Automationsanbindung ist schnittstellenseitig offen.",
          recommendation:
            "Automationsanbindung, Signalpunkte und Parametrierung der HLS-Komponente ausdrücklich beschreiben.",
        },
        {
          key: "control_module_without_modes_or_alarms",
          title: "Regelungsmodul ohne Sollwert-, Betriebsarten- oder Alarmstruktur",
          severity: "medium",
          condition: {
            detectedAny: ["controlDescription"],
            missingAny: ["setpointsModes", "alarms"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Sollwert-, Betriebsarten- oder Alarmstruktur bleibt der Betriebsumfang unscharf.",
          recommendation:
            "Sollwerte, Betriebsarten und Alarmstruktur des Moduls spezifizieren.",
        },
        {
          key: "hvac_without_trend_or_optimization",
          title: "HVAC-Regelung ohne Trend- oder Optimierungslogik",
          severity: "medium",
          condition: {
            detectedAny: ["controlDescription"],
            missingAny: ["trending", "optimizationFunctions"],
          },
          categoryImpacts: {
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Bei komplexeren Anlagen ohne Trend- oder Optimierungslogik bleiben spätere Betriebsanforderungen offen.",
          recommendation:
            "Trendaufzeichnung und gegebenenfalls Optimierungsfunktionen im Leistungsumfang berücksichtigen.",
        },
      ],
    },
  },
  {
    id: "msr_management_level_visualization",
    trade: "msr",
    name: "Visualisierung / GLT / Managementebene",
    metadata: {
      gewerk: "MSR",
      systemKey: "msr_management_level_visualization",
      label: "Visualisierung / GLT / Managementebene",
      detection: {
        anyOf: [
          "GLT",
          "Managementebene",
          "Visualisierung",
          "Leittechnik",
          "Dashboard",
          "BACnet-Client",
          "Bedien- und Beobachtungssystem",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "softwareLicenses",
          label: "Visualisierungslizenzen / Software",
          matchAny: ["Visualisierungslizenz", "Software", "Visualisierung"],
          severity: "high",
          requiredType: "required",
          description: "Software und Lizenzen der Visualisierung.",
        },
        {
          key: "dataPointConnection",
          label: "Datenpunktaufschaltung",
          matchAny: ["Datenpunktaufschaltung", "Aufschaltung", "Datenpunktanbindung"],
          severity: "high",
          requiredType: "required",
          description: "Aufschaltung der Datenpunkte auf die Managementebene.",
        },
        {
          key: "operatorScreens",
          label: "Bedienbilder",
          matchAny: ["Bedienbild", "Bedienbilder"],
          severity: "high",
          requiredType: "required",
          description: "Bedienbilder und Ansichten der GLT.",
        },
        {
          key: "alarmsTrends",
          label: "Alarme / Trends",
          matchAny: ["Alarm", "Alarme", "Trend", "Trends"],
          severity: "medium",
          requiredType: "required",
          description: "Alarm- und Trendfunktionen.",
        },
        {
          key: "userRights",
          label: "Benutzerrechte",
          matchAny: ["Benutzerrechte", "Rollen", "Rechtekonzept"],
          severity: "medium",
          requiredType: "required",
          description: "Benutzerrechte und Rollenmodell.",
        },
        {
          key: "commissioningTest",
          label: "Inbetriebnahme / Test",
          matchAny: ["Inbetriebnahme", "Test", "Abnahmetest"],
          severity: "high",
          requiredType: "required",
          description: "Inbetriebnahme und Test der Managementebene.",
        },
        {
          key: "documentation",
          label: "Dokumentation",
          matchAny: ["Dokumentation", "Handbuch"],
          severity: "medium",
          requiredType: "required",
          description: "Dokumentation der Managementebene.",
        },
      ],
      optionalComponents: [
        {
          key: "webAccess",
          label: "Webzugriff",
          matchAny: ["Webzugriff"],
          severity: "low",
          requiredType: "optional",
          description: "Webzugriff auf die Visualisierung.",
        },
        {
          key: "mobileAccess",
          label: "Mobile Zugriffslösung",
          matchAny: ["Mobile Zugriffslösung", "mobiler Zugriff"],
          severity: "low",
          requiredType: "optional",
          description: "Mobiler Zugriff auf die Managementebene.",
        },
        {
          key: "reporting",
          label: "Reporting",
          matchAny: ["Reporting", "Berichtswesen"],
          severity: "medium",
          requiredType: "optional",
          description: "Reporting- und Auswertungsfunktionen.",
        },
        {
          key: "energyMonitoring",
          label: "Energiemonitoring",
          matchAny: ["Energiemonitoring"],
          severity: "medium",
          requiredType: "optional",
          description: "Energiemonitoring innerhalb der GLT.",
        },
        {
          key: "historization",
          label: "Historisierung",
          matchAny: ["Historisierung"],
          severity: "medium",
          requiredType: "optional",
          description: "Historisierung der Datenpunkte.",
        },
      ],
      logicRules: [
        {
          key: "visualization_without_datapoint_connection",
          title: "GLT/Visualisierung ohne Datenpunktaufschaltung",
          severity: "high",
          condition: {
            detectedAny: ["softwareLicenses"],
            missingAny: ["dataPointConnection"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "high",
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Eine Visualisierung ohne Datenpunktaufschaltung ist funktional wertlos und technisch unvollständig.",
          recommendation:
            "Datenpunktaufschaltung und Umfang der Anbindung verbindlich definieren.",
        },
        {
          key: "visualization_without_operator_screens",
          title: "Visualisierung ohne Bedienbilder / Softwarelogik",
          severity: "high",
          condition: {
            detectedAny: ["softwareLicenses"],
            missingAny: ["operatorScreens"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Bedienbilder oder Softwarelogik bleibt der tatsächliche Nutzen der Visualisierung offen.",
          recommendation:
            "Bedienbilder, Navigationslogik und Softwareumfang konkret beschreiben.",
        },
        {
          key: "management_without_commissioning",
          title: "Managementebene ohne Inbetriebnahme / Test",
          severity: "high",
          condition: {
            detectedAny: ["softwareLicenses"],
            missingAny: ["commissioningTest"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Inbetriebnahme oder Test fehlt ein belastbarer Nachweis der Betriebsbereitschaft.",
          recommendation:
            "Test- und Inbetriebnahmekonzept der Managementebene ausdrücklich festlegen.",
        },
        {
          key: "glt_without_network_responsibility",
          title: "GLT-Anbindung ohne Schnittstellen- oder Netzwerkverantwortung",
          severity: "high",
          condition: {
            detectedAny: ["dataPointConnection"],
            missingAny: ["documentation"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne klare Schnittstellen- und Netzwerkverantwortung entstehen hohe Integrationsrisiken.",
          recommendation:
            "Verantwortlichkeiten, Netzwerkvoraussetzungen und Übergabepunkte klar dokumentieren.",
        },
        {
          key: "visualization_without_reporting_or_rights",
          title: "Visualisierung ohne Reporting-, Historisierungs- oder Benutzerrechtslogik",
          severity: "medium",
          condition: {
            detectedAny: ["softwareLicenses"],
            missingAny: ["reporting", "historization", "userRights"],
          },
          categoryImpacts: {
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne Reporting, Historisierung oder Benutzerrechtslogik bleibt die Managementebene funktional eingeschränkt.",
          recommendation:
            "Reporting, Historisierung und Rechtekonzept nach Bedarf ausdrücklich aufnehmen.",
        },
        {
          key: "management_without_clear_uplift_test",
          title: "Managementebene ohne klares Aufschaltungs- oder Testkonzept",
          severity: "medium",
          condition: {
            detectedAny: ["dataPointConnection"],
            missingAny: ["commissioningTest"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne klares Aufschaltungs- oder Testkonzept bleibt die tatsächliche Übergabe an den Betrieb offen.",
          recommendation:
            "Aufschaltungsstrategie, Testablauf und Abnahmekriterien klar definieren.",
        },
      ],
    },
  },
  {
    id: "msr_data_point_engineering",
    trade: "msr",
    name: "Datenpunktlisten / Softwaredatenpunkte / Engineering",
    metadata: {
      gewerk: "MSR",
      systemKey: "msr_data_point_engineering",
      label: "Datenpunktlisten / Softwaredatenpunkte / Engineering",
      detection: {
        anyOf: [
          "Datenpunktliste",
          "DPL",
          "Hardwaredatenpunkte",
          "Softwaredatenpunkte",
          "BACnet-Objekte",
          "GA-Engineering",
          "Funktionsliste",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "dataPointList",
          label: "Datenpunktliste",
          matchAny: ["Datenpunktliste", "DPL"],
          severity: "high",
          requiredType: "required",
          description: "Datenpunktliste der GA/MSR.",
        },
        {
          key: "hardwareSoftwareSplit",
          label: "Zuordnung Hardware / Software",
          matchAny: ["Hardwaredatenpunkte", "Softwaredatenpunkte", "Zuordnung Hardware / Software"],
          severity: "high",
          requiredType: "required",
          description: "Trennung und Zuordnung von Hardware- und Softwaredatenpunkten.",
        },
        {
          key: "namingAddressing",
          label: "Benennung / Adressierung",
          matchAny: ["Benennung", "Adressierung", "Objektname"],
          severity: "medium",
          requiredType: "required",
          description: "Benennung und Adressierung der Datenpunkte.",
        },
        {
          key: "alarmTexts",
          label: "Alarmtexte",
          matchAny: ["Alarmtext", "Alarmtexte"],
          severity: "medium",
          requiredType: "required",
          description: "Alarmtexte der Datenpunkte.",
        },
        {
          key: "trendDefinitions",
          label: "Trenddefinitionen",
          matchAny: ["Trenddefinition", "Trenddefinitionen"],
          severity: "medium",
          requiredType: "required",
          description: "Trenddefinitionen und Historisierungsvorgaben.",
        },
        {
          key: "functionalDescription",
          label: "Funktionsbeschreibung",
          matchAny: ["Funktionsbeschreibung", "Funktionsliste"],
          severity: "high",
          requiredType: "required",
          description: "Funktionsbeschreibung und Engineering-Logik.",
        },
        {
          key: "engineering",
          label: "Engineering / Parametrierung",
          matchAny: ["Engineering", "Parametrierung", "GA-Engineering"],
          severity: "high",
          requiredType: "required",
          description: "Engineering und Parametrierung der Datenpunkte.",
        },
        {
          key: "testingAcceptance",
          label: "Test / Abnahme",
          matchAny: ["Test", "Abnahme", "Integrationstest"],
          severity: "high",
          requiredType: "required",
          description: "Test und Abnahme der Datenpunkt- und Softwarelogik.",
        },
      ],
      optionalComponents: [
        {
          key: "namingConvention",
          label: "Naming-Konvention",
          matchAny: ["Naming-Konvention"],
          severity: "low",
          requiredType: "optional",
          description: "Standardisierte Naming-Konvention.",
        },
        {
          key: "templateEngineering",
          label: "Template-Engineering",
          matchAny: ["Template-Engineering"],
          severity: "low",
          requiredType: "optional",
          description: "Vorlagenbasiertes Engineering.",
        },
        {
          key: "importExport",
          label: "Import-/Export-Schnittstellen",
          matchAny: ["Import", "Export", "Import-/Export-Schnittstelle"],
          severity: "medium",
          requiredType: "optional",
          description: "Import-/Export-Schnittstellen für Engineeringdaten.",
        },
        {
          key: "standardLibrary",
          label: "GA-Standardbibliothek",
          matchAny: ["GA-Standardbibliothek", "Standardbibliothek"],
          severity: "medium",
          requiredType: "optional",
          description: "Standardbibliothek für Engineering oder Bausteine.",
        },
      ],
      logicRules: [
        {
          key: "ga_without_data_point_list",
          title: "MSR/GA ohne Datenpunktliste",
          severity: "high",
          condition: {
            detectedAny: ["functionalDescription"],
            missingAny: ["dataPointList"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
          },
          explanation:
            "Ohne Datenpunktliste bleibt der reale Engineering- und Implementierungsumfang unklar.",
          recommendation:
            "Datenpunktliste für alle relevanten Funktionen verbindlich ergänzen.",
        },
        {
          key: "points_without_hw_sw_split",
          title: "Datenpunkte ohne Trennung Hardware / Software",
          severity: "high",
          condition: {
            detectedAny: ["dataPointList"],
            missingAny: ["hardwareSoftwareSplit"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Trennung von Hardware- und Softwaredatenpunkten bleibt der Engineeringumfang unscharf.",
          recommendation:
            "Hardware- und Softwaredatenpunkte separat ausweisen.",
        },
        {
          key: "glt_without_object_mapping",
          title: "BACnet-/GLT-Aufschaltung ohne Objekt- oder Mappinglogik",
          severity: "high",
          condition: {
            detectedAny: ["dataPointList"],
            missingAny: ["namingAddressing"],
          },
          categoryImpacts: {
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
            technische_vollstaendigkeit: "medium",
          },
          explanation:
            "Ohne Objekt- oder Mappinglogik ist eine GLT- oder BACnet-Aufschaltung nicht belastbar spezifiziert.",
          recommendation:
            "Objektstruktur, Benennung und Mapping verbindlich festlegen.",
        },
        {
          key: "engineering_without_parametric_scope",
          title: "Engineering ohne Parametrier- oder Softwareleistung",
          severity: "high",
          condition: {
            detectedAny: ["functionalDescription"],
            missingAny: ["engineering"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
          },
          explanation:
            "Erkennbar erforderliches Engineering ohne Parametrier- oder Softwareleistung führt zu massiven Leistungsunsicherheiten.",
          recommendation:
            "Engineering- und Softwareleistungen ausdrücklich mit aufnehmen.",
        },
        {
          key: "dpl_without_alarm_or_trend_logic",
          title: "Datenpunktliste ohne Alarm-, Trend- oder Benennungslogik",
          severity: "medium",
          condition: {
            detectedAny: ["dataPointList"],
            missingAny: ["alarmTexts", "trendDefinitions", "namingAddressing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Alarm-, Trend- oder Benennungslogik bleibt die spätere Betriebsqualität unklar.",
          recommendation:
            "Alarmtexte, Trenddefinitionen und Benennungslogik je Datenpunkt ergänzen.",
        },
        {
          key: "engineering_without_import_or_library_context",
          title: "Engineering ohne Import-/Export- oder Standardbibliotheksbezug",
          severity: "medium",
          condition: {
            detectedAny: ["engineering"],
            missingAny: ["importExport", "standardLibrary"],
          },
          categoryImpacts: {
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Wiederverwendungs- oder Schnittstellenkonzept kann der Engineering-Aufwand unnötig hoch ausfallen.",
          recommendation:
            "Import-/Export-Schnittstellen oder Standardbibliotheken einbeziehen, soweit sinnvoll.",
        },
      ],
    },
  },
  {
    id: "msr_commissioning_optimization",
    trade: "msr",
    name: "Inbetriebnahme, Probebetrieb, Optimierung MSR",
    metadata: {
      gewerk: "MSR",
      systemKey: "msr_commissioning_optimization",
      label: "Inbetriebnahme, Probebetrieb, Optimierung MSR",
      detection: {
        anyOf: [
          "Inbetriebnahme MSR",
          "Funktionsprüfung",
          "Probebetrieb",
          "Optimierung",
          "Einstellarbeiten",
          "Betreiber-Einweisung",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "ioTest",
          label: "I/O-Test",
          matchAny: ["I/O-Test", "IO-Test"],
          severity: "high",
          requiredType: "required",
          description: "I/O-Test der Automationsanlage.",
        },
        {
          key: "fieldTest",
          label: "Feldtest",
          matchAny: ["Feldtest"],
          severity: "high",
          requiredType: "required",
          description: "Feldtest der angeschlossenen Komponenten.",
        },
        {
          key: "controlTest",
          label: "Regeltest",
          matchAny: ["Regeltest"],
          severity: "high",
          requiredType: "required",
          description: "Regeltest der Automationsfunktionen.",
        },
        {
          key: "integrationTest",
          label: "Integrationstest",
          matchAny: ["Integrationstest"],
          severity: "high",
          requiredType: "required",
          description: "Integrationstest der Gesamtanlage.",
        },
        {
          key: "trialOperation",
          label: "Probebetrieb",
          matchAny: ["Probebetrieb"],
          severity: "high",
          requiredType: "required",
          description: "Probebetrieb der MSR-Anlage.",
        },
        {
          key: "optimization",
          label: "Optimierung",
          matchAny: ["Optimierung", "Einstellarbeiten"],
          severity: "high",
          requiredType: "required",
          description: "Optimierung und Feinjustierung der Anlage.",
        },
        {
          key: "operatorInstruction",
          label: "Einweisung",
          matchAny: ["Einweisung", "Betreiber-Einweisung"],
          severity: "medium",
          requiredType: "required",
          description: "Einweisung des Betreibers.",
        },
        {
          key: "documentation",
          label: "Dokumentation",
          matchAny: ["Dokumentation", "Protokoll"],
          severity: "medium",
          requiredType: "required",
          description: "Dokumentation der Inbetriebnahme und Optimierung.",
        },
      ],
      optionalComponents: [
        {
          key: "longTermTrendReview",
          label: "Langzeittrendbewertung",
          matchAny: ["Langzeittrendbewertung"],
          severity: "low",
          requiredType: "optional",
          description: "Langfristige Bewertung von Trends und Betriebsdaten.",
        },
        {
          key: "operatorWorkshops",
          label: "Betreiber-Workshops",
          matchAny: ["Betreiber-Workshop", "Betreiber-Workshops"],
          severity: "low",
          requiredType: "optional",
          description: "Vertiefende Workshops mit dem Betreiber.",
        },
        {
          key: "postOptimization",
          label: "Nachoptimierung",
          matchAny: ["Nachoptimierung"],
          severity: "medium",
          requiredType: "optional",
          description: "Nachoptimierung nach dem Probebetrieb.",
        },
        {
          key: "remoteSupport",
          label: "Remote-Support",
          matchAny: ["Remote-Support"],
          severity: "low",
          requiredType: "optional",
          description: "Remote-Support im laufenden Betrieb.",
        },
        {
          key: "fineTuningOperation",
          label: "Feinjustierung im Betrieb",
          matchAny: ["Feinjustierung im Betrieb"],
          severity: "low",
          requiredType: "optional",
          description: "Feinjustierung im Realbetrieb.",
        },
      ],
      logicRules: [
        {
          key: "msr_without_commissioning",
          title: "MSR ohne Inbetriebnahme",
          severity: "high",
          condition: {
            detectedAny: ["ioTest", "fieldTest", "controlTest"],
            missingAny: ["trialOperation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Inbetriebnahme bzw. Probebetrieb bleibt die betriebsbereite Übergabe der Anlage offen.",
          recommendation:
            "Probebetrieb und formale Inbetriebnahme als verbindliche Leistungen aufnehmen.",
        },
        {
          key: "complex_system_without_integration_test",
          title: "Komplexes Automationssystem ohne Integrationstest",
          severity: "high",
          condition: {
            detectedAny: ["ioTest", "fieldTest", "controlTest"],
            missingAny: ["integrationTest"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Integrationstest bleibt unklar, ob die Gesamtanlage im Zusammenspiel funktioniert.",
          recommendation:
            "Integrationstest mit klaren Prüfszenarien und Abnahmekriterien festlegen.",
        },
        {
          key: "control_system_without_trial_or_optimization",
          title: "Regelungssystem ohne Probebetrieb / Optimierung",
          severity: "high",
          condition: {
            detectedAny: ["controlTest"],
            missingAny: ["trialOperation", "optimization"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Probebetrieb oder Optimierung bleibt die Feinabstimmung des Regelungssystems ungeklärt.",
          recommendation:
            "Probebetrieb und Optimierungsphase verbindlich in den Leistungsumfang aufnehmen.",
        },
        {
          key: "msr_without_operator_instruction",
          title: "Keine Betreiber-Einweisung / keine Übergabeleistung",
          severity: "high",
          condition: {
            detectedAny: ["trialOperation"],
            missingAny: ["operatorInstruction"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Betreiber-Einweisung bleibt die ordnungsgemäße Übergabe der Anlage unvollständig.",
          recommendation:
            "Betreiber-Einweisung und formale Übergabeleistung ausdrücklich fordern.",
        },
        {
          key: "commissioning_without_test_structure",
          title: "Inbetriebnahme ohne Test- oder Übergabestruktur",
          severity: "medium",
          condition: {
            detectedAny: ["trialOperation"],
            missingAny: ["ioTest", "fieldTest", "controlTest", "documentation"],
          },
          categoryImpacts: {
            kalkulationsunsicherheit: "medium",
            technische_vollstaendigkeit: "medium",
          },
          explanation:
            "Eine Inbetriebnahme ohne strukturierte Test- oder Übergabelogik bleibt in Umfang und Nachweis offen.",
          recommendation:
            "Teststruktur, Protokollierung und Übergabedokumentation klar festlegen.",
        },
        {
          key: "optimization_without_proof_logic",
          title: "Optimierung ohne Nachweis- oder Dokumentationslogik",
          severity: "medium",
          condition: {
            detectedAny: ["optimization"],
            missingAny: ["documentation"],
          },
          categoryImpacts: {
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Nachweis oder Dokumentation der Optimierung ist die tatsächliche Leistung kaum prüfbar.",
          recommendation:
            "Optimierung mit Protokollen, Nachweisen und ggf. Trendauswertung dokumentieren.",
        },
      ],
    },
  },
];