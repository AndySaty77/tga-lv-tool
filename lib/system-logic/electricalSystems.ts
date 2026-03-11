/**
 * Systemlogik Elektro (Lückenanalyse).
 * Zusätzliche Ebene; Trigger-Engine bleibt unverändert.
 */

import type { SystemLogicDefinition } from "./types";

export const ELECTRICAL_SYSTEMS: SystemLogicDefinition[] = [
  {
    id: "electrical_general_installation",
    trade: "electrical",
    name: "Allgemeine Elektroinstallation",
    metadata: {
      gewerk: "Elektro",
      systemKey: "electrical_general_installation",
      label: "Allgemeine Elektroinstallation",
      detection: {
        anyOf: [
          "Elektroinstallation",
          "Starkstrom",
          "Installationsanlage",
          "Leitungsanlage",
          "Kabel und Leitungen",
          "Unterverteilung",
          "Steckdosen",
          "Schalterprogramm",
        ],
        minHits: 1,
        weakTerms: ["Elektroinstallation", "Unterverteilung", "Steckdosen", "Schalterprogramm", "Installationsanlage", "Leitungsanlage"],
      },
      requiredComponents: [
        {
          key: "cables",
          label: "Leitungen / Kabel",
          matchAny: ["Leitung", "Leitungen", "Kabel", "Kabel und Leitungen"],
          severity: "high",
          requiredType: "required",
          description: "Leitungen und Kabel der Elektroinstallation.",
        },
        {
          key: "routingSystems",
          label: "Installationsrohre / Trassen / Verlegesystem",
          matchAny: [
            "Installationsrohr",
            "Installationsrohre",
            "Trasse",
            "Trassen",
            "Verlegesystem",
          ],
          severity: "medium",
          requiredType: "required",
          description: "Installationsrohre, Trassen und Verlegesysteme.",
        },
        {
          key: "boxes",
          label: "Dosen / Abzweigdosen / Gerätedosen",
          matchAny: ["Dose", "Dosen", "Abzweigdose", "Gerätedose", "Gerätedosen"],
          severity: "high",
          requiredType: "required",
          description: "Dosen, Abzweigdosen und Gerätedosen.",
        },
        {
          key: "devices",
          label: "Schalter / Steckdosen / Bedienstellen",
          matchAny: ["Schalter", "Steckdose", "Steckdosen", "Bedienstelle", "Schalterprogramm"],
          severity: "high",
          requiredType: "required",
          description: "Installationsgeräte wie Schalter, Steckdosen und Bedienstellen.",
        },
        {
          key: "distribution",
          label: "Unterverteilungen / Stromkreisaufteilung",
          matchAny: ["Unterverteilung", "UV", "Stromkreis", "Stromkreisaufteilung"],
          severity: "high",
          requiredType: "required",
          description: "Unterverteilungen und Stromkreisaufteilung.",
        },
        {
          key: "protectionDevices",
          label: "Schutzorgane",
          matchAny: ["Schutzorgan", "Schutzorgane", "LS", "FI", "RCD", "Absicherung"],
          severity: "high",
          requiredType: "required",
          description: "Schutzorgane und Absicherung der Stromkreise.",
        },
        {
          key: "marking",
          label: "Beschriftung / Kennzeichnung",
          matchAny: ["Beschriftung", "Kennzeichnung", "Stromkreiskennzeichnung"],
          severity: "medium",
          requiredType: "required",
          description: "Beschriftung und Kennzeichnung der Anlage.",
        },
        {
          key: "testing",
          label: "Messung / Prüfung",
          matchAny: ["Messung", "Prüfung", "Erstprüfung"],
          severity: "high",
          requiredType: "required",
          description: "Messung und Prüfung der Elektroinstallation.",
        },
        {
          key: "documentation",
          label: "Dokumentation",
          matchAny: ["Dokumentation", "Bestandsunterlagen", "Revisionsunterlagen"],
          severity: "medium",
          requiredType: "required",
          description: "Dokumentation und Bestandsunterlagen.",
        },
      ],
      optionalComponents: [
        {
          key: "fireProtectionDucts",
          label: "Brandschutzkanäle",
          matchAny: ["Brandschutzkanal", "Brandschutzkanäle"],
          severity: "medium",
          requiredType: "optional",
          description: "Brandschutzkanäle für Leitungsführung.",
        },
        {
          key: "surgeProtection",
          label: "Überspannungsschutz",
          matchAny: ["Überspannungsschutz"],
          severity: "medium",
          requiredType: "optional",
          description: "Überspannungsschutz in der Anlage.",
        },
        {
          key: "wallConcreteAccessories",
          label: "Hohlwand-/Betonbauzubehör",
          matchAny: ["Hohlwandzubehör", "Betonbauzubehör", "Einbauzubehör"],
          severity: "low",
          requiredType: "optional",
          description: "Zubehör für Hohlwand- und Betoneinbau.",
        },
        {
          key: "mountingFrames",
          label: "Montagegestelle",
          matchAny: ["Montagegestell", "Montagegestelle"],
          severity: "low",
          requiredType: "optional",
          description: "Montagegestelle und Hilfskonstruktionen.",
        },
        {
          key: "reserves",
          label: "Reserveplätze / Reservestromkreise",
          matchAny: ["Reserveplatz", "Reserveplätze", "Reservestromkreis", "Reserven"],
          severity: "medium",
          requiredType: "optional",
          description: "Reserveplätze und Reservestromkreise.",
        },
      ],
      logicRules: [
        {
          key: "electrical_without_protection",
          title: "Leitungsinstallation ohne Schutzorgane / Absicherung",
          severity: "high",
          condition: {
            detectedAny: ["cables"],
            missingAny: ["protectionDevices"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Eine Leitungsinstallation ohne Schutzorgane oder Absicherung ist technisch unvollständig und sicherheitskritisch.",
          recommendation:
            "Schutzorgane und Absicherung der Stromkreise explizit definieren.",
        },
        {
          key: "electrical_without_testing",
          title: "Elektroinstallation ohne Messung / Erstprüfung",
          severity: "high",
          condition: {
            detectedAny: ["cables", "devices"],
            missingAny: ["testing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Messung oder Erstprüfung fehlen zentrale Leistungen für Abnahme und Haftung.",
          recommendation:
            "Erstprüfung, Messung und Prüfprotokolle ausdrücklich in den Leistungsumfang aufnehmen.",
        },
        {
          key: "distribution_without_marking",
          title: "Unterverteilung ohne Beschriftung / Stromkreiskennzeichnung",
          severity: "high",
          condition: {
            detectedAny: ["distribution"],
            missingAny: ["marking"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Beschriftung oder Stromkreiskennzeichnung bleibt die Anlage betrieblich unvollständig.",
          recommendation:
            "Beschriftung und Stromkreiskennzeichnung für Verteilungen und Stromkreise klar festlegen.",
        },
        {
          key: "devices_without_boxes",
          title: "Installationsgeräte ohne Gerätedosen / Anschlusslogik",
          severity: "high",
          condition: {
            detectedAny: ["devices"],
            missingAny: ["boxes"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Installationsgeräte ohne Gerätedosen oder Anschlusslogik führen zu unklaren Montage- und Materialumfängen.",
          recommendation:
            "Gerätedosen und Anschlusslogik je Gerätetyp ergänzen.",
        },
        {
          key: "large_installation_without_routing",
          title: "Größere Installation ohne Verlegesysteme / Trassen",
          severity: "medium",
          condition: {
            detectedAny: ["cables"],
            missingAny: ["routingSystems"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei größeren Installationen ohne Trassen- oder Verlegesystembezug bleiben Leitungsführung und Montageumfang offen.",
          recommendation:
            "Trassen, Installationsrohre und Verlegesysteme eindeutig beschreiben.",
        },
        {
          key: "distribution_without_reserves",
          title: "Unterverteilungen ohne Reserve-/Erweiterungslogik",
          severity: "medium",
          condition: {
            detectedAny: ["distribution"],
            missingAny: ["reserves"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Reserve- oder Erweiterungslogik bleibt die Zukunftsfähigkeit der Verteilung offen.",
          recommendation:
            "Reserveplätze und ggf. Reservestromkreise in der Verteilung vorsehen.",
        },
        {
          key: "electrical_without_documentation",
          title: "Elektroinstallation ohne Dokumentation / Bestandsunterlagen",
          severity: "medium",
          condition: {
            detectedAny: ["cables", "devices"],
            missingAny: ["documentation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Fehlende Dokumentation erschwert Inbetriebnahme, Betrieb und spätere Änderungen.",
          recommendation:
            "Bestandsunterlagen, Prüfprotokolle und Revisionsdokumentation ausdrücklich fordern.",
        },
      ],
    },
  },
  {
    id: "electrical_distribution_board",
    trade: "electrical",
    name: "Unterverteilung / Verteilerbau",
    metadata: {
      gewerk: "Elektro",
      systemKey: "electrical_distribution_board",
      label: "Unterverteilung / Verteilerbau",
      detection: {
        anyOf: [
          "Unterverteilung",
          "UV",
          "Feldverteiler",
          "Installationsverteiler",
          "Reiheneinbaugeräte",
          "Verteilerschrank",
        ],
        minHits: 1,
        weakTerms: ["Unterverteilung", "UV"],
      },
      requiredComponents: [
        {
          key: "cabinet",
          label: "Gehäuse / Schrank",
          matchAny: ["Gehäuse", "Schrank", "Verteilerschrank"],
          severity: "high",
          requiredType: "required",
          description: "Gehäuse bzw. Schrank der Unterverteilung.",
        },
        {
          key: "powerSupply",
          label: "Einspeisung",
          matchAny: ["Einspeisung", "Zuleitung"],
          severity: "high",
          requiredType: "required",
          description: "Einspeisung der Unterverteilung.",
        },
        {
          key: "protectionDevices",
          label: "Schutzorgane",
          matchAny: ["LS", "FI", "RCD", "RCBO", "Schutzorgan", "Schutzorgane"],
          severity: "high",
          requiredType: "required",
          description: "Schutzorgane der Unterverteilung.",
        },
        {
          key: "terminalBlocks",
          label: "Reihenklemmen",
          matchAny: ["Reihenklemme", "Reihenklemmen", "Klemme", "Klemmen"],
          severity: "medium",
          requiredType: "required",
          description: "Reihenklemmen und Anschlussebene.",
        },
        {
          key: "marking",
          label: "Beschriftung",
          matchAny: ["Beschriftung", "Kennzeichnung"],
          severity: "high",
          requiredType: "required",
          description: "Beschriftung der Verteilung und Abgänge.",
        },
        {
          key: "plans",
          label: "Stromlauf- / Verteilerplan",
          matchAny: ["Stromlaufplan", "Verteilerplan", "Schaltplan"],
          severity: "medium",
          requiredType: "required",
          description: "Stromlauf- und Verteilerpläne.",
        },
        {
          key: "outgoingCircuits",
          label: "Abgangslogik",
          matchAny: ["Abgang", "Abgänge", "Abgangslogik", "Stromkreis"],
          severity: "medium",
          requiredType: "required",
          description: "Abgangslogik und Zuordnung der Stromkreise.",
        },
        {
          key: "testing",
          label: "Messung / Prüfung",
          matchAny: ["Messung", "Prüfung", "Erstprüfung"],
          severity: "high",
          requiredType: "required",
          description: "Messung und Prüfung der Unterverteilung.",
        },
      ],
      optionalComponents: [
        {
          key: "surgeProtection",
          label: "Überspannungsschutz",
          matchAny: ["Überspannungsschutz"],
          severity: "medium",
          requiredType: "optional",
          description: "Überspannungsschutz in der Verteilung.",
        },
        {
          key: "energyMeter",
          label: "Energiezähler",
          matchAny: ["Energiezähler", "Zähler"],
          severity: "medium",
          requiredType: "optional",
          description: "Zähler in der Unterverteilung.",
        },
        {
          key: "blindCovers",
          label: "Blindabdeckungen",
          matchAny: ["Blindabdeckung", "Blindabdeckungen"],
          severity: "low",
          requiredType: "optional",
          description: "Blindabdeckungen in der Verteilung.",
        },
        {
          key: "reserves",
          label: "Reserven",
          matchAny: ["Reserve", "Reserven", "Reserveplatz", "Reserveplätze"],
          severity: "medium",
          requiredType: "optional",
          description: "Reserven in der Verteilung.",
        },
        {
          key: "cabinetLighting",
          label: "Schrankbeleuchtung",
          matchAny: ["Schrankbeleuchtung"],
          severity: "low",
          requiredType: "optional",
          description: "Beleuchtung innerhalb des Schrankes.",
        },
        {
          key: "doorContact",
          label: "Türkontaktschalter",
          matchAny: ["Türkontaktschalter"],
          severity: "low",
          requiredType: "optional",
          description: "Türkontaktschalter der Verteilung.",
        },
      ],
      logicRules: [
        {
          key: "uv_without_protection",
          title: "Unterverteilung ohne Schutzorgane",
          severity: "high",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["protectionDevices"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
          },
          explanation:
            "Eine Unterverteilung ohne Schutzorgane ist technisch unvollständig und sicherheitskritisch.",
          recommendation:
            "Schutzorgane (LS, FI/RCD, RCBO etc.) eindeutig definieren.",
        },
        {
          key: "uv_without_marking_or_plans",
          title: "Unterverteilung ohne Beschriftung / Dokumentation",
          severity: "high",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["marking", "plans"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Beschriftung oder Dokumentation ist die Verteilung betrieblich und normativ unvollständig.",
          recommendation:
            "Beschriftung, Verteilerplan und Stromlaufplan ausdrücklich vorsehen.",
        },
        {
          key: "uv_without_testing",
          title: "Verteilerbau ohne Prüfung / Messung",
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
            "Ohne Prüfung oder Messung fehlt eine wesentliche Leistung für Inbetriebnahme und Abnahme.",
          recommendation:
            "Prüfung und Messung der Unterverteilung mit Protokollpflicht aufnehmen.",
        },
        {
          key: "uv_without_supply_or_outgoing_logic",
          title: "UV ohne Einspeisungs- oder Abgangslogik",
          severity: "high",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["powerSupply", "outgoingCircuits"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Einspeisungs- oder Abgangslogik bleibt der technische Aufbau der Verteilung unklar.",
          recommendation:
            "Einspeisung, Abgänge und Stromkreiszuordnung strukturiert beschreiben.",
        },
        {
          key: "uv_without_surge_protection",
          title: "Größere UV ohne Überspannungsschutzbezug",
          severity: "medium",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["surgeProtection"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei größeren Verteilungen ohne Überspannungsschutzbezug bleibt der Schutzumfang offen.",
          recommendation:
            "Erforderlichkeit und Ausführung des Überspannungsschutzes prüfen und festlegen.",
        },
        {
          key: "uv_without_reserves",
          title: "Unterverteilung ohne Reservelogik",
          severity: "medium",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["reserves"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Reservelogik bleibt die Erweiterbarkeit der Verteilung unklar.",
          recommendation:
            "Reserveplätze und Reserven in der Planung der Unterverteilung berücksichtigen.",
        },
        {
          key: "uv_without_terminals",
          title: "Unterverteilung ohne Klemmen / Anschlussebene",
          severity: "medium",
          condition: {
            detectedAny: ["cabinet"],
            missingAny: ["terminalBlocks"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fehlende Klemmen oder Anschlussebenen erschweren Anschluss, Prüfung und Wartung.",
          recommendation:
            "Klemmen, Reihenklemmen und Anschlussebene als festen Bestandteil definieren.",
        },
      ],
    },
  },
  {
    id: "electrical_lighting_system",
    trade: "electrical",
    name: "Beleuchtungsanlage",
    metadata: {
      gewerk: "Elektro",
      systemKey: "electrical_lighting_system",
      label: "Beleuchtungsanlage",
      detection: {
        anyOf: [
          "Leuchte",
          "Beleuchtung",
          "Lichtband",
          "Downlight",
          "Pendelleuchte",
          "LED-Leuchte",
          "Sicherheitsbeleuchtung",
        ],
        minHits: 1,
        weakTerms: ["Beleuchtung", "Leuchte", "LED-Leuchte"],
      },
      requiredComponents: [
        {
          key: "luminaires",
          label: "Leuchten",
          matchAny: [
            "Leuchte",
            "Leuchten",
            "Lichtband",
            "Downlight",
            "Pendelleuchte",
            "LED-Leuchte",
          ],
          severity: "high",
          requiredType: "required",
          description: "Leuchten der Beleuchtungsanlage.",
        },
        {
          key: "mountingAccessories",
          label: "Befestigung / Montagezubehör",
          matchAny: ["Befestigung", "Montagezubehör", "Montage"],
          severity: "medium",
          requiredType: "required",
          description: "Montagezubehör und Befestigung der Leuchten.",
        },
        {
          key: "connectionMaterial",
          label: "Anschlussleitung / Anschlussmaterial",
          matchAny: ["Anschlussleitung", "Anschlussmaterial", "Anschluss"],
          severity: "high",
          requiredType: "required",
          description: "Elektrischer Anschluss der Leuchten.",
        },
        {
          key: "switchingLogic",
          label: "Schaltlogik",
          matchAny: ["Schaltlogik", "Schaltung", "Steuerung"],
          severity: "high",
          requiredType: "required",
          description: "Schalt- bzw. Steuerlogik der Beleuchtung.",
        },
        {
          key: "circuitAssignment",
          label: "Stromkreiszuordnung",
          matchAny: ["Stromkreiszuordnung", "Stromkreis", "Zuordnung"],
          severity: "medium",
          requiredType: "required",
          description: "Zuordnung der Leuchten zu Stromkreisen.",
        },
        {
          key: "marking",
          label: "Beschriftung",
          matchAny: ["Beschriftung", "Kennzeichnung"],
          severity: "medium",
          requiredType: "required",
          description: "Beschriftung der Beleuchtungsanlage.",
        },
        {
          key: "testing",
          label: "Prüfung / Messung",
          matchAny: ["Prüfung", "Messung", "Erstprüfung"],
          severity: "high",
          requiredType: "required",
          description: "Prüfung und Messung der Beleuchtungsanlage.",
        },
      ],
      optionalComponents: [
        {
          key: "dali",
          label: "DALI",
          matchAny: ["DALI"],
          severity: "medium",
          requiredType: "optional",
          description: "DALI-Bussystem für Beleuchtungssteuerung.",
        },
        {
          key: "presenceDetectors",
          label: "Präsenzmelder",
          matchAny: ["Präsenzmelder", "Bewegungsmelder"],
          severity: "medium",
          requiredType: "optional",
          description: "Präsenz- oder Bewegungsmelder.",
        },
        {
          key: "constantLightControl",
          label: "Konstantlichtregelung",
          matchAny: ["Konstantlichtregelung"],
          severity: "medium",
          requiredType: "optional",
          description: "Konstantlichtregelung der Beleuchtung.",
        },
        {
          key: "emergencyMonitoring",
          label: "Notlichtüberwachung",
          matchAny: ["Notlichtüberwachung", "Notlichtmonitoring"],
          severity: "medium",
          requiredType: "optional",
          description: "Überwachung der Sicherheitsbeleuchtung.",
        },
        {
          key: "mountingRails",
          label: "Montageschienen",
          matchAny: ["Montageschiene", "Montageschienen"],
          severity: "low",
          requiredType: "optional",
          description: "Montageschienen für Leuchten.",
        },
        {
          key: "suspensionSets",
          label: "Abhängesets",
          matchAny: ["Abhängeset", "Abhängesets"],
          severity: "low",
          requiredType: "optional",
          description: "Abhängesets für Leuchten.",
        },
      ],
      logicRules: [
        {
          key: "lighting_without_switching_logic",
          title: "Leuchten ohne Schalt- oder Steuerlogik",
          severity: "high",
          condition: {
            detectedAny: ["luminaires"],
            missingAny: ["switchingLogic"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Schalt- oder Steuerlogik ist die Beleuchtungsanlage funktional unvollständig beschrieben.",
          recommendation:
            "Schalt- und Steuerkonzept der Beleuchtung explizit definieren.",
        },
        {
          key: "lighting_without_connection_logic",
          title: "Leuchten ohne Anschlusslogik",
          severity: "high",
          condition: {
            detectedAny: ["luminaires"],
            missingAny: ["connectionMaterial"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Anschlusslogik ist unklar, wie die Leuchten elektrisch angebunden werden.",
          recommendation:
            "Anschlussmaterial und Anschlussart je Leuchtentyp beschreiben.",
        },
        {
          key: "emergency_lighting_without_monitoring",
          title: "Sicherheitsbeleuchtung ohne Prüf- oder Überwachungslogik",
          severity: "high",
          condition: {
            detectedAny: ["luminaires"],
            missingAny: ["testing", "emergencyMonitoring"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei Sicherheitsbeleuchtung ohne Prüf- oder Überwachungslogik fehlen zentrale Betriebs- und Nachweispflichten.",
          recommendation:
            "Prüf- und Überwachungslogik der Sicherheitsbeleuchtung klar aufnehmen.",
        },
        {
          key: "dali_without_bus_logic",
          title: "DALI- oder Lichtsteuerung ohne Bus- oder Adressierungslogik",
          severity: "high",
          condition: {
            detectedAny: ["dali"],
            missingAny: ["switchingLogic"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Eine DALI- oder Lichtsteuerung ohne Bus- oder Adressierungslogik ist planerisch unvollständig.",
          recommendation:
            "Buslogik, Adressierung und Steuerungskonzept eindeutig beschreiben.",
        },
        {
          key: "lighting_without_marking_or_documentation",
          title: "Größere Beleuchtungsanlage ohne Beschriftung / Dokumentation",
          severity: "medium",
          condition: {
            detectedAny: ["luminaires"],
            missingAny: ["marking"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Beschriftung und klare Zuordnung bleibt die spätere Wartung und Inbetriebnahme erschwert.",
          recommendation:
            "Beschriftung und Dokumentation der Leuchtenkreise ergänzen.",
        },
        {
          key: "lighting_with_control_without_sensors",
          title: "Leuchten mit Steuerungsbezug, aber ohne Sensorik oder Bedienstellen",
          severity: "medium",
          condition: {
            detectedAny: ["switchingLogic"],
            missingAny: ["presenceDetectors"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Bei gesteuerter Beleuchtung ohne erkennbare Sensorik oder Bedienstellen bleibt das Bedienkonzept offen.",
          recommendation:
            "Sensorik, Bedienstellen und Bedienlogik ausdrücklich definieren.",
        },
      ],
    },
  },
  {
    id: "electrical_cable_support_system",
    trade: "electrical",
    name: "Kabeltragsysteme / Trassen",
    metadata: {
      gewerk: "Elektro",
      systemKey: "electrical_cable_support_system",
      label: "Kabeltragsysteme / Trassen",
      detection: {
        anyOf: [
          "Kabelrinne",
          "Kabelleiter",
          "Brüstungskanal",
          "Installationskanal",
          "Kabeltragsystem",
          "Steigetrasse",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "supportRoutes",
          label: "Trassen / Kanäle",
          matchAny: [
            "Kabelrinne",
            "Kabelleiter",
            "Brüstungskanal",
            "Installationskanal",
            "Kabeltragsystem",
            "Steigetrasse",
          ],
          severity: "high",
          requiredType: "required",
          description: "Kabeltragsysteme, Trassen und Kanäle.",
        },
        {
          key: "fittings",
          label: "Formstücke",
          matchAny: ["Formstück", "Formstücke", "Bogen", "Abzweig", "Übergang"],
          severity: "medium",
          requiredType: "required",
          description: "Formstücke und Übergänge der Trassenanlage.",
        },
        {
          key: "mounting",
          label: "Befestigung",
          matchAny: ["Befestigung", "Abhängung", "Montage"],
          severity: "high",
          requiredType: "required",
          description: "Befestigung und Aufhängung der Trassenanlage.",
        },
        {
          key: "fireProtection",
          label: "Brandschutzmaßnahmen bei Durchführungen",
          matchAny: ["Brandschutz", "Abschottung", "Brandschutzmaßnahme"],
          severity: "high",
          requiredType: "contextRequired",
          description: "Brandschutzmaßnahmen bei Durchführungen und Brandabschnitten.",
        },
        {
          key: "equipotentialBonding",
          label: "Potentialausgleich",
          matchAny: ["Potentialausgleich", "PA"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Potentialausgleich der metallischen Trassen, sofern erforderlich.",
        },
        {
          key: "marking",
          label: "Kennzeichnung",
          matchAny: ["Kennzeichnung", "Beschriftung"],
          severity: "medium",
          requiredType: "required",
          description: "Kennzeichnung der Trassen und Systeme.",
        },
      ],
      optionalComponents: [
        {
          key: "separators",
          label: "Trennstege",
          matchAny: ["Trennsteg", "Trennstege"],
          severity: "low",
          requiredType: "optional",
          description: "Trennstege innerhalb der Trassen.",
        },
        {
          key: "covers",
          label: "Deckel",
          matchAny: ["Deckel"],
          severity: "low",
          requiredType: "optional",
          description: "Deckel für Trassen und Kanäle.",
        },
        {
          key: "corrosionProtection",
          label: "Korrosionsschutz",
          matchAny: ["Korrosionsschutz"],
          severity: "low",
          requiredType: "optional",
          description: "Korrosionsschutz der Trassenanlage.",
        },
        {
          key: "specialSuspensions",
          label: "Abhängungen Sonderbau",
          matchAny: ["Sonderabhängung", "Abhängung Sonderbau"],
          severity: "medium",
          requiredType: "optional",
          description: "Spezielle Abhängungen und Tragkonstruktionen.",
        },
        {
          key: "acousticDecoupling",
          label: "Schallschutzentkopplung",
          matchAny: ["Schallschutzentkopplung", "Entkopplung"],
          severity: "low",
          requiredType: "optional",
          description: "Schallschutzentkopplung der Trassen.",
        },
      ],
      logicRules: [
        {
          key: "cable_support_without_mounting",
          title: "Kabeltragsystem ohne Befestigung",
          severity: "high",
          condition: {
            detectedAny: ["supportRoutes"],
            missingAny: ["mounting"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ein Kabeltragsystem ohne Befestigung oder Aufhängung ist technisch unvollständig.",
          recommendation:
            "Befestigung, Abhängung und Tragkonstruktion eindeutig festlegen.",
        },
        {
          key: "cable_support_without_fire_protection",
          title: "Trassen durch Brandabschnitte ohne Brandschutzbezug",
          severity: "high",
          condition: {
            detectedAny: ["supportRoutes"],
            missingAny: ["fireProtection"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei Trassenführungen durch Brandabschnitte ohne Brandschutzbezug entstehen erhebliche Ausführungs- und Schnittstellenrisiken.",
          recommendation:
            "Brandschutzmaßnahmen und Abschottungen klar mit Zuständigkeiten beschreiben.",
        },
        {
          key: "cable_support_without_fittings",
          title: "Größere Trassenanlage ohne Formstücke / Übergänge",
          severity: "high",
          condition: {
            detectedAny: ["supportRoutes"],
            missingAny: ["fittings"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Formstücke oder Übergänge bleibt die konkrete Leitungsführung unvollständig beschrieben.",
          recommendation:
            "Bögen, Abzweige, Reduzierungen und Übergänge explizit aufnehmen.",
        },
        {
          key: "large_cable_support_without_marking",
          title: "Große Kabeltrassen ohne Kennzeichnung",
          severity: "medium",
          condition: {
            detectedAny: ["supportRoutes"],
            missingAny: ["marking"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fehlende Kennzeichnung erschwert Wartung, Erweiterung und Betrieb größerer Trassenanlagen.",
          recommendation:
            "Kennzeichnung der Trassen und Leitungswege ergänzen.",
        },
        {
          key: "metal_support_without_bonding",
          title: "Metallische Trassen ohne Potentialausgleich",
          severity: "medium",
          condition: {
            detectedAny: ["supportRoutes"],
            missingAny: ["equipotentialBonding"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Bei metallischen Trassen ohne Potentialausgleich bleibt die elektrische Sicherheit unvollständig beschrieben.",
          recommendation:
            "Potentialausgleich der metallischen Trassensysteme eindeutig festlegen.",
        },
      ],
    },
  },
  {
    id: "electrical_earthing_equipotential",
    trade: "electrical",
    name: "Erdung / Potentialausgleich",
    metadata: {
      gewerk: "Elektro",
      systemKey: "electrical_earthing_equipotential",
      label: "Erdung / Potentialausgleich",
      detection: {
        anyOf: [
          "Potentialausgleich",
          "Erdung",
          "PAS",
          "Hauptpotentialausgleich",
          "Funktionspotentialausgleich",
        ],
        minHits: 1,
        weakTerms: ["Erdung", "PAS", "Potentialausgleich"],
      },
      requiredComponents: [
        {
          key: "pasBar",
          label: "PAS-Schiene",
          matchAny: ["PAS-Schiene", "Potentialausgleichsschiene", "Hauptpotentialausgleichsschiene"],
          severity: "high",
          requiredType: "required",
          description: "Potentialausgleichsschiene bzw. PAS-Schiene.",
        },
        {
          key: "connectionConductors",
          label: "Anschlussleitungen",
          matchAny: ["Anschlussleitung", "Anschlussleitungen", "PA-Leiter"],
          severity: "high",
          requiredType: "required",
          description: "Anschlussleitungen für den Potentialausgleich.",
        },
        {
          key: "bondingOfForeignParts",
          label: "Einbindung fremder leitfähiger Teile",
          matchAny: [
            "fremde leitfähige Teile",
            "Einbindung",
            "Potentialausgleich fremder Teile",
          ],
          severity: "medium",
          requiredType: "required",
          description: "Einbindung fremder leitfähiger Teile in den Potentialausgleich.",
        },
        {
          key: "marking",
          label: "Kennzeichnung",
          matchAny: ["Kennzeichnung", "Beschriftung"],
          severity: "medium",
          requiredType: "required",
          description: "Kennzeichnung der PA-/Erdungsanlage.",
        },
        {
          key: "testing",
          label: "Messung / Prüfung",
          matchAny: ["Messung", "Prüfung", "Messprotokoll"],
          severity: "high",
          requiredType: "required",
          description: "Messung und Prüfung der Erdungs-/PA-Anlage.",
        },
        {
          key: "documentation",
          label: "Dokumentation",
          matchAny: ["Dokumentation", "Prüfprotokoll", "Bestandsunterlagen"],
          severity: "medium",
          requiredType: "required",
          description: "Dokumentation der Erdungs- und PA-Anlage.",
        },
      ],
      optionalComponents: [
        {
          key: "surgeCoordination",
          label: "Überspannungsschutzkoordination",
          matchAny: ["Überspannungsschutzkoordination"],
          severity: "medium",
          requiredType: "optional",
          description: "Koordination des Überspannungsschutzes mit der Erdungsanlage.",
        },
        {
          key: "lightningProtectionIntegration",
          label: "Blitzschutz-Einbindung",
          matchAny: ["Blitzschutz", "Blitzschutz-Einbindung"],
          severity: "medium",
          requiredType: "optional",
          description: "Einbindung eines äußeren oder inneren Blitzschutzsystems.",
        },
        {
          key: "functionalBonding",
          label: "Funktionspotentialausgleich für Technikräume",
          matchAny: ["Funktionspotentialausgleich"],
          severity: "medium",
          requiredType: "optional",
          description: "Funktionspotentialausgleich für Technikräume und Sonderanlagen.",
        },
      ],
      logicRules: [
        {
          key: "bonding_without_pas",
          title: "Potentialausgleich ohne PAS oder Anschlusspunkte",
          severity: "high",
          condition: {
            detectedAny: ["connectionConductors"],
            missingAny: ["pasBar"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ein Potentialausgleich ohne PAS-Schiene oder definierte Anschlusspunkte ist technisch unvollständig.",
          recommendation:
            "PAS-Schiene und Anschlusspunkte mit Lage und Funktion eindeutig festlegen.",
        },
        {
          key: "technical_installation_without_bonding",
          title: "Technische Anlage mit Erdungsbezug ohne Potentialausgleich",
          severity: "high",
          condition: {
            detectedAny: ["pasBar"],
            missingAny: ["bondingOfForeignParts"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Einbindung fremder leitfähiger Teile bleibt der Potentialausgleich unvollständig.",
          recommendation:
            "Einbindung aller relevanten leitfähigen Teile ausdrücklich beschreiben.",
        },
        {
          key: "bonding_without_testing",
          title: "Erdung / Potentialausgleich ohne Messung / Prüfung",
          severity: "high",
          condition: {
            detectedAny: ["pasBar", "connectionConductors"],
            missingAny: ["testing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Messung oder Prüfung fehlt ein zentraler Nachweis der Funktionsfähigkeit.",
          recommendation:
            "Messung, Prüfung und Dokumentation der Erdungs-/PA-Anlage verbindlich festlegen.",
        },
        {
          key: "earthing_without_documentation",
          title: "Erdungssystem ohne Dokumentation",
          severity: "medium",
          condition: {
            detectedAny: ["pasBar", "connectionConductors"],
            missingAny: ["documentation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fehlende Dokumentation erschwert Nachweis, Betrieb und spätere Prüfungen.",
          recommendation:
            "Dokumentation und Prüfunterlagen der Erdungsanlage ergänzen.",
        },
        {
          key: "bonding_without_foreign_parts",
          title: "Potentialausgleich ohne Einbindung fremder leitfähiger Teile",
          severity: "medium",
          condition: {
            detectedAny: ["pasBar"],
            missingAny: ["bondingOfForeignParts"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne Einbindung fremder leitfähiger Teile bleibt der Potentialausgleich funktional unvollständig.",
          recommendation:
            "Einbindung fremder leitfähiger Teile systematisch beschreiben.",
        },
      ],
    },
  },
  {
    id: "electrical_emergency_lighting_system",
    trade: "electrical",
    name: "Sicherheitsstrom / Notbeleuchtung",
    metadata: {
      gewerk: "Elektro",
      systemKey: "electrical_emergency_lighting_system",
      label: "Sicherheitsstrom / Notbeleuchtung",
      detection: {
        anyOf: [
          "Sicherheitsbeleuchtung",
          "Notlicht",
          "Sicherheitsstromversorgung",
          "Zentralbatterie",
          "Einzelbatterieleuchte",
          "Fluchtwegbeleuchtung",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "luminaires",
          label: "Leuchten",
          matchAny: ["Sicherheitsbeleuchtung", "Notlicht", "Leuchte", "Fluchtwegbeleuchtung"],
          severity: "high",
          requiredType: "required",
          description: "Leuchten der Sicherheitsbeleuchtung.",
        },
        {
          key: "powerSupply",
          label: "Stromversorgung / Batterie / Zentrale",
          matchAny: [
            "Sicherheitsstromversorgung",
            "Batterie",
            "Zentralbatterie",
            "Einzelbatterieleuchte",
          ],
          severity: "high",
          requiredType: "required",
          description: "Stromversorgung der Not- und Sicherheitsbeleuchtung.",
        },
        {
          key: "monitoring",
          label: "Überwachung",
          matchAny: ["Überwachung", "Überwachungssystem", "Monitoring"],
          severity: "high",
          requiredType: "required",
          description: "Überwachung der Sicherheitsbeleuchtung.",
        },
        {
          key: "testFunction",
          label: "Prüftaster / Testfunktion",
          matchAny: ["Prüftaster", "Testfunktion", "Test"],
          severity: "medium",
          requiredType: "required",
          description: "Prüftaster und Testfunktionen der Anlage.",
        },
        {
          key: "marking",
          label: "Kennzeichnung",
          matchAny: ["Kennzeichnung", "Beschriftung", "Fluchtwegkennzeichnung"],
          severity: "medium",
          requiredType: "required",
          description: "Kennzeichnung der Sicherheitsbeleuchtung.",
        },
        {
          key: "documentation",
          label: "Dokumentation / Prüfbuch",
          matchAny: ["Dokumentation", "Prüfbuch", "Prüfprotokoll"],
          severity: "high",
          requiredType: "required",
          description: "Dokumentation und Prüfbuch der Anlage.",
        },
      ],
      optionalComponents: [
        {
          key: "centralMonitoring",
          label: "Zentralüberwachung",
          matchAny: ["Zentralüberwachung"],
          severity: "medium",
          requiredType: "optional",
          description: "Zentralüberwachung der Sicherheitsbeleuchtung.",
        },
        {
          key: "automaticTests",
          label: "Automatische Testfunktionen",
          matchAny: ["automatische Testfunktion", "automatische Testfunktionen"],
          severity: "medium",
          requiredType: "optional",
          description: "Automatische Testfunktionen der Anlage.",
        },
        {
          key: "changeover",
          label: "Ersatzstromumschaltung",
          matchAny: ["Ersatzstromumschaltung"],
          severity: "medium",
          requiredType: "optional",
          description: "Umschaltung auf Sicherheitsstromversorgung.",
        },
        {
          key: "additionalEscapeSignage",
          label: "Zusätzliche Fluchtwegkennzeichnung",
          matchAny: ["zusätzliche Fluchtwegkennzeichnung"],
          severity: "low",
          requiredType: "optional",
          description: "Zusätzliche Fluchtwegkennzeichnung.",
        },
      ],
      logicRules: [
        {
          key: "emergency_without_monitoring",
          title: "Notbeleuchtung ohne Prüf- oder Überwachungslogik",
          severity: "high",
          condition: {
            detectedAny: ["luminaires"],
            missingAny: ["monitoring", "testFunction"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Prüf- oder Überwachungslogik fehlen wesentliche Betriebs- und Nachweispflichten.",
          recommendation:
            "Überwachung, Teststrategie und Prüfeinrichtungen verbindlich beschreiben.",
        },
        {
          key: "emergency_without_power_supply",
          title: "Sicherheitsbeleuchtung ohne Stromversorgungslogik",
          severity: "high",
          condition: {
            detectedAny: ["luminaires"],
            missingAny: ["powerSupply"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
          },
          explanation:
            "Ohne definierte Stromversorgung ist die Sicherheitsbeleuchtung funktional unvollständig.",
          recommendation:
            "Versorgungskonzept mit Zentralbatterie, Einzelbatterie oder Sicherheitsstromversorgung klar festlegen.",
        },
        {
          key: "escape_lighting_without_marking_or_documentation",
          title: "Fluchtwegbeleuchtung ohne Kennzeichnung oder Dokumentation",
          severity: "high",
          condition: {
            detectedAny: ["luminaires"],
            missingAny: ["marking", "documentation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fehlende Kennzeichnung oder Dokumentation erschweren Betrieb, Prüfung und Nachweis der Fluchtwegbeleuchtung.",
          recommendation:
            "Kennzeichnung, Prüfbuch und Dokumentation der Sicherheitsbeleuchtung ergänzen.",
        },
        {
          key: "emergency_without_logbook_context",
          title: "Sicherheitsstromanlage ohne Prüfbuch- oder Dokumentationsbezug",
          severity: "medium",
          condition: {
            detectedAny: ["powerSupply"],
            missingAny: ["documentation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Prüfbuch oder Dokumentationsbezug fehlen betriebliche und normative Nachweise.",
          recommendation:
            "Prüfbuch, Prüfprotokolle und Dokumentation ausdrücklich fordern.",
        },
        {
          key: "emergency_without_test_strategy",
          title: "Notbeleuchtung ohne klare Teststrategie",
          severity: "medium",
          condition: {
            detectedAny: ["luminaires"],
            missingAny: ["testFunction"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Teststrategie bleibt unklar, wie die regelmäßige Funktionsprüfung sichergestellt wird.",
          recommendation:
            "Testfunktion, Prüfrhythmus und Verantwortlichkeit der Anlage definieren.",
        },
      ],
    },
  },
  {
    id: "electrical_ev_charging_infrastructure",
    trade: "electrical",
    name: "E-Mobilität / Ladeinfrastruktur",
    metadata: {
      gewerk: "Elektro",
      systemKey: "electrical_ev_charging_infrastructure",
      label: "E-Mobilität / Ladeinfrastruktur",
      detection: {
        anyOf: [
          "Wallbox",
          "Ladepunkt",
          "Ladeinfrastruktur",
          "EV-Charger",
          "Ladesäule",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "chargingPoint",
          label: "Ladepunkt",
          matchAny: ["Wallbox", "Ladepunkt", "EV-Charger", "Ladesäule"],
          severity: "high",
          requiredType: "required",
          description: "Ladepunkt bzw. Ladeeinrichtung.",
        },
        {
          key: "supplyLine",
          label: "Zuleitung",
          matchAny: ["Zuleitung", "Anschlussleitung"],
          severity: "high",
          requiredType: "required",
          description: "Zuleitung zur Ladeeinrichtung.",
        },
        {
          key: "protectionDevices",
          label: "Schutzorgane",
          matchAny: ["Schutzorgan", "Schutzorgane", "LS", "FI", "RCD", "Absicherung"],
          severity: "high",
          requiredType: "required",
          description: "Schutzorgane der Ladeinfrastruktur.",
        },
        {
          key: "loadManagement",
          label: "Lastmanagement / Steuerlogik",
          matchAny: ["Lastmanagement", "Steuerlogik", "Lademanagement"],
          severity: "high",
          requiredType: "contextRequired",
          description: "Lastmanagement bei mehreren Ladepunkten.",
        },
        {
          key: "communicationBackend",
          label: "Kommunikation / Backendbezug",
          matchAny: ["Kommunikation", "Backend", "OCPP", "Backendanbindung"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Kommunikation und Backendbezug der Ladeinfrastruktur.",
        },
        {
          key: "foundationMounting",
          label: "Fundament / Montage",
          matchAny: ["Fundament", "Montage", "Wandmontage", "Säulenmontage"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Fundament oder Montage der Ladeeinrichtung, sofern freistehend oder baulich relevant.",
        },
        {
          key: "testingCommissioning",
          label: "Prüfung / Inbetriebnahme",
          matchAny: ["Prüfung", "Inbetriebnahme"],
          severity: "high",
          requiredType: "required",
          description: "Prüfung und Inbetriebnahme der Ladeinfrastruktur.",
        },
      ],
      optionalComponents: [
        {
          key: "backendConnection",
          label: "Backendanbindung",
          matchAny: ["Backendanbindung"],
          severity: "medium",
          requiredType: "optional",
          description: "Backendanbindung der Ladepunkte.",
        },
        {
          key: "energyMetering",
          label: "Energiemessung",
          matchAny: ["Energiemessung", "Energiezähler"],
          severity: "medium",
          requiredType: "optional",
          description: "Energiemessung pro Ladepunkt oder Anlage.",
        },
        {
          key: "accessControl",
          label: "Zugangskontrolle",
          matchAny: ["Zugangskontrolle", "RFID", "Freischaltung"],
          severity: "medium",
          requiredType: "optional",
          description: "Zugangskontrolle der Ladeinfrastruktur.",
        },
        {
          key: "surgeProtection",
          label: "Überspannungsschutz",
          matchAny: ["Überspannungsschutz"],
          severity: "medium",
          requiredType: "optional",
          description: "Überspannungsschutz im Zusammenhang mit der Ladeinfrastruktur.",
        },
        {
          key: "signage",
          label: "Beschilderung",
          matchAny: ["Beschilderung", "Kennzeichnung"],
          severity: "low",
          requiredType: "optional",
          description: "Beschilderung und Kennzeichnung der Ladepunkte.",
        },
      ],
      logicRules: [
        {
          key: "charging_without_protection",
          title: "Ladepunkt ohne Schutzorgane",
          severity: "high",
          condition: {
            detectedAny: ["chargingPoint"],
            missingAny: ["protectionDevices"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
          },
          explanation:
            "Ein Ladepunkt ohne Schutzorgane ist technisch unvollständig und sicherheitskritisch.",
          recommendation:
            "Schutzorgane, Fehlerstromschutz und Absicherung der Ladepunkte eindeutig definieren.",
        },
        {
          key: "multi_charging_without_load_management",
          title: "Mehrere Ladepunkte ohne Lastmanagementlogik",
          severity: "high",
          condition: {
            detectedAny: ["chargingPoint"],
            missingAny: ["loadManagement"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Bei mehreren Ladepunkten ohne Lastmanagement bleiben Netzanschluss und Steuerstrategie unklar.",
          recommendation:
            "Lastmanagement und Ladeleistungssteuerung für mehrere Ladepunkte ausdrücklich beschreiben.",
        },
        {
          key: "wallbox_without_commissioning",
          title: "Wallbox ohne Inbetriebnahme / Prüfung",
          severity: "high",
          condition: {
            detectedAny: ["chargingPoint"],
            missingAny: ["testingCommissioning"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Prüfung oder Inbetriebnahme fehlt eine zentrale Leistung für sicheren Betrieb und Abnahme.",
          recommendation:
            "Prüfung und Inbetriebnahme der Ladeinfrastruktur mit Protokollpflicht aufnehmen.",
        },
        {
          key: "free_standing_without_foundation",
          title: "Freistehende Ladesäule ohne Fundament- oder Montagebezug",
          severity: "high",
          condition: {
            detectedAny: ["chargingPoint"],
            missingAny: ["foundationMounting"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Fundament- oder Montagebezug bleibt die bauliche Umsetzung freistehender Ladepunkte offen.",
          recommendation:
            "Fundament, Säulenmontage oder Wandmontage eindeutig festlegen.",
        },
        {
          key: "charging_without_backend",
          title: "Ladeinfrastruktur ohne Kommunikations- oder Backendbezug",
          severity: "medium",
          condition: {
            detectedAny: ["chargingPoint"],
            missingAny: ["communicationBackend"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            schnittstellen_nebenleistungen: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Kommunikations- oder Backendbezug bleiben Steuerung, Abrechnung und Schnittstellen offen.",
          recommendation:
            "Kommunikationsprotokoll, Backend und Schnittstellen der Ladepunkte klar regeln.",
        },
        {
          key: "multi_charging_without_metering_or_control",
          title: "Mehrere Ladepunkte ohne Energiemess- oder Steuerlogik",
          severity: "medium",
          condition: {
            detectedAny: ["chargingPoint"],
            missingAny: ["energyMetering", "loadManagement"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei mehreren Ladepunkten ohne Energiemessung oder Steuerlogik bleibt der Betriebsumfang unklar.",
          recommendation:
            "Energiemessung und Lade-/Steuerlogik für die Gesamtanlage eindeutig definieren.",
        },
      ],
    },
  },
];