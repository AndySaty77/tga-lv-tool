/**
 * Systemlogik Heizung (Lückenanalyse).
 * Zusätzliche Ebene; Trigger-Engine bleibt unverändert.
 */

import type { SystemLogicDefinition } from "./types";

export const HEATING_SYSTEMS: SystemLogicDefinition[] = [
  {
    id: "heating_radiator_system",
    trade: "heating",
    name: "Heizkörperanlage",
    metadata: {
      gewerk: "Heizung",
      systemKey: "heating_radiator_system",
      label: "Heizkörperanlage",
      detection: {
        anyOf: [
          "Heizkörper",
          "Plattenheizkörper",
          "Röhrenradiatoren",
          "Ventilheizkörper",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "radiators",
          label: "Heizkörper",
          matchAny: [
            "Heizkörper",
            "Plattenheizkörper",
            "Röhrenheizkörper",
            "Röhrenradiatoren",
            "Ventilheizkörper",
          ],
          severity: "high",
          requiredType: "required",
          description: "Heizkörper bzw. Platten- oder Röhrenheizkörper als Wärmeabgabesystem.",
        },
        {
          key: "thermostaticValves",
          label: "Thermostatventile / Ventileinsätze",
          matchAny: [
            "Thermostatventil",
            "Thermostatventile",
            "Ventileinsatz",
            "Ventileinsätze",
          ],
          severity: "high",
          requiredType: "required",
          description: "Thermostatventile oder Ventileinsätze zur Raumtemperaturregelung.",
        },
        {
          key: "returnFittings",
          label: "Rücklaufverschraubungen",
          matchAny: [
            "Rücklaufverschraubung",
            "Rücklaufverschraubungen",
            "Rücklaufarmatur",
            "Anschlussarmatur",
          ],
          severity: "medium",
          requiredType: "required",
          description: "Rücklaufverschraubungen bzw. Anschlussarmaturen an den Heizkörpern.",
        },
        {
          key: "airVent",
          label: "Entlüftungsmöglichkeiten",
          matchAny: ["Entlüftung", "Entlüfter", "Entlüftungsmöglichkeit"],
          severity: "medium",
          requiredType: "required",
          description: "Entlüftung an Heizkörpern oder im System.",
        },
        {
          key: "mountingBrackets",
          label: "Befestigung / Konsolen",
          matchAny: [
            "Befestigung",
            "Konsolen",
            "Heizkörperkonsole",
            "Heizkörperbefestigung",
          ],
          severity: "medium",
          requiredType: "required",
          description: "Konsolen bzw. Befestigung der Heizkörper.",
        },
        {
          key: "connectionSet",
          label: "Rohranschlüsse / Anschlussset",
          matchAny: ["Anschlussset", "Rohranschluss", "Rohranschlüsse"],
          severity: "medium",
          requiredType: "required",
          description: "Rohranschlüsse oder Anschlusssets für Heizkörper.",
        },
        {
          key: "hydraulicBalancing",
          label: "Hydraulischer Abgleich / Einregulierung",
          matchAny: ["hydraulischer Abgleich", "Einregulierung"],
          severity: "high",
          requiredType: "required",
          description: "Hydraulischer Abgleich oder Einregulierung der Heizkörperanlage.",
        },
        {
          key: "presettingMarking",
          label: "Kennzeichnung / Voreinstellung",
          matchAny: [
            "Voreinstellung",
            "Voreinstellung Thermostatventil",
            "Kennzeichnung Voreinstellung",
          ],
          severity: "low",
          requiredType: "contextRequired",
          description: "Kennzeichnung und Voreinstellung der Ventile, soweit beschrieben.",
        },
      ],
      optionalComponents: [
        {
          key: "strangRegulation",
          label: "Strangregulierventile",
          matchAny: [
            "Strangregulierventil",
            "Strangregulierventile",
            "Strangregulierung",
          ],
          severity: "medium",
          requiredType: "optional",
          description: "Strangregulierventile für größere Anlagen.",
        },
        {
          key: "diffPressureControl",
          label: "Differenzdruckregler",
          matchAny: ["Differenzdruckregler", "Differenzdruckregelung"],
          severity: "medium",
          requiredType: "optional",
          description: "Differenzdruckregelung für Heizkörperstränge.",
        },
        {
          key: "coverRosettes",
          label: "Abdeckrosetten",
          matchAny: ["Abdeckrosette", "Abdeckrosetten"],
          severity: "low",
          requiredType: "optional",
          description: "Abdeckrosetten für Rohrdurchführungen.",
        },
        {
          key: "hahnBlock",
          label: "Hahnblock",
          matchAny: ["Hahnblock"],
          severity: "low",
          requiredType: "optional",
          description: "Hahnblöcke als kombinierte Vor-/Rücklaufarmatur.",
        },
        {
          key: "separateThermostatHead",
          label: "Thermostatkopf separat",
          matchAny: ["Thermostatkopf", "separater Thermostatkopf"],
          severity: "low",
          requiredType: "optional",
          description: "Separate Thermostatköpfe.",
        },
        {
          key: "pipeInsulation",
          label: "Dämmung Anschlussleitungen",
          matchAny: ["Dämmung Anschlussleitung", "Dämmung Anschlussleitungen"],
          severity: "medium",
          requiredType: "optional",
          description: "Dämmung der Anschlussleitungen zu Heizkörpern.",
        },
      ],
      logicRules: [
        {
          key: "radiator_without_thermostatic_valve",
          title: "Heizkörper ohne Thermostatventil",
          severity: "high",
          condition: {
            detectedAny: ["radiators"],
            missingAny: ["thermostaticValves"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Eine Heizkörperanlage ohne Thermostatventile lässt die Regelungsstrategie offen und ist fachlich unvollständig.",
          recommendation:
            "Thermostatventile bzw. Ventileinsätze explizit ausschreiben oder klären, wie die Raumregelung vorgesehen ist.",
        },
        {
          key: "radiator_without_return_fitting",
          title: "Heizkörper ohne Rücklauf-/Anschlussarmatur",
          severity: "high",
          condition: {
            detectedAny: ["radiators"],
            missingAny: ["returnFittings"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "high",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Fehlende Rücklauf- bzw. Anschlussarmaturen führen zu unklaren Schnittstellen und Nachtragsrisiken.",
          recommendation:
            "Rücklaufverschraubungen bzw. Anschlussarmaturen je Heizkörper klar benennen oder klären, ob diese bauseits sind.",
        },
        {
          key: "radiator_without_hydraulic_balancing",
          title: "Heizkörperanlage ohne hydraulischen Abgleich",
          severity: "high",
          condition: {
            detectedAny: ["radiators"],
            missingAny: ["hydraulicBalancing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne hydraulischen Abgleich sind Komfort, Effizienz und Verantwortlichkeiten unklar.",
          recommendation:
            "Hydraulischen Abgleich bzw. Einregulierung als Leistungsbestandteil aufnehmen oder als bauseits / AG-Leistung kennzeichnen.",
        },
        {
          key: "many_radiators_without_strang_regulation",
          title: "Viele Heizkörper ohne Strangregulierung",
          severity: "medium",
          condition: {
            detectedAny: ["radiators"],
            missingAny: ["strangRegulation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei größeren Anlagen ohne Strangregulierung drohen unausgeglichene Stränge und spätere Nachforderungen.",
          recommendation:
            "Bei größeren Heizkörperanlagen Strangregulierventile prüfen und ggf. als eigene Position aufnehmen.",
        },
        {
          key: "radiator_missing_accessories",
          title: "Heizkörperanlage ohne Entlüftung / Zubehör / Befestigung",
          severity: "medium",
          condition: {
            detectedAny: ["radiators"],
            missingAny: ["airVent", "mountingBrackets"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Fehlende Angaben zu Entlüftung, Befestigung oder Zubehör führen zu Unklarheiten in Montageumfang und Haftung.",
          recommendation:
            "Entlüftung, Befestigung und typisches Montagezubehör als Leistungsumfang präzisieren oder explizit ausschließen.",
        },
      ],
    },
  },
  {
    id: "heating_floor_heating_system",
    trade: "heating",
    name: "Fußbodenheizung",
    metadata: {
      gewerk: "Heizung",
      systemKey: "heating_floor_heating_system",
      label: "Fußbodenheizung",
      detection: {
        anyOf: [
          "Fußbodenheizung",
          "Flächenheizung",
          "Heizkreisverteiler",
          "FBH-Rohr",
          "Tackersystem",
          "Noppensystem",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "heatingPipe",
          label: "Heizrohr",
          matchAny: ["Heizrohr", "FBH-Rohr"],
          severity: "high",
          requiredType: "required",
          description: "Heizrohr der Fußbodenheizung.",
        },
        {
          key: "layingSystem",
          label: "Verlegesystem",
          matchAny: ["Verlegesystem", "Tackersystem", "Noppensystem"],
          severity: "medium",
          requiredType: "required",
          description: "Verlegesystem der Fußbodenheizung.",
        },
        {
          key: "manifold",
          label: "Heizkreisverteiler",
          matchAny: ["Heizkreisverteiler"],
          severity: "high",
          requiredType: "required",
          description: "Heizkreisverteiler für die FBH.",
        },
        {
          key: "actuators",
          label: "Stellantriebe / Regelbezug",
          matchAny: [
            "Stellantrieb",
            "Stellantriebe",
            "Raumregelung",
            "Regelung Heizkreis",
          ],
          severity: "high",
          requiredType: "required",
          description: "Stellantriebe bzw. Regelungsbezug pro Heizkreis.",
        },
        {
          key: "manifoldConnection",
          label: "Anbindung Verteiler",
          matchAny: ["Anbindung Verteiler", "Verteileranschluss"],
          severity: "medium",
          requiredType: "required",
          description: "Hydraulische Anbindung der Heizkreisverteiler.",
        },
        {
          key: "roomControl",
          label: "Regelung / Raumregelung",
          matchAny: ["Raumregelung", "Regelung FBH"],
          severity: "high",
          requiredType: "required",
          description: "Regelung bzw. Raumregelung der FBH.",
        },
        {
          key: "hydraulicBalancing",
          label: "Hydraulischer Abgleich / Volumenstromabgleich",
          matchAny: ["hydraulischer Abgleich", "Volumenstromabgleich"],
          severity: "high",
          requiredType: "required",
          description: "Hydraulischer Abgleich / Volumenstromabgleich der FBH-Kreise.",
        },
        {
          key: "pressureTest",
          label: "Druckprüfung",
          matchAny: ["Druckprüfung"],
          severity: "high",
          requiredType: "required",
          description: "Druckprüfung der FBH.",
        },
        {
          key: "commissioning",
          label: "Protokoll / Einregulierung",
          matchAny: ["Protokoll", "Einregulierung"],
          severity: "medium",
          requiredType: "required",
          description: "Protokoll und Einregulierung der FBH.",
        },
      ],
      optionalComponents: [
        {
          key: "insulation",
          label: "Dämmung",
          matchAny: ["Dämmung", "Wärmedämmung"],
          severity: "medium",
          requiredType: "optional",
          description: "Dämmung unter der FBH.",
        },
        {
          key: "edgeInsulation",
          label: "Randdämmstreifen",
          matchAny: ["Randdämmstreifen"],
          severity: "medium",
          requiredType: "optional",
          description: "Randdämmstreifen an aufgehenden Bauteilen.",
        },
        {
          key: "systemBoards",
          label: "Systemplatten",
          matchAny: ["Systemplatte", "Systemplatten"],
          severity: "low",
          requiredType: "optional",
          description: "Systemplatten, z. B. Noppensysteme.",
        },
        {
          key: "screedAdditives",
          label: "Estrichzusätze",
          matchAny: ["Estrichzusatz", "Estrichzusätze"],
          severity: "low",
          requiredType: "optional",
          description: "Estrichzusätze im Zusammenhang mit FBH.",
        },
        {
          key: "protectivePipes",
          label: "Schutzrohre",
          matchAny: ["Schutzrohr", "Schutzrohre"],
          severity: "low",
          requiredType: "optional",
          description: "Schutzrohre, z. B. unter Türdurchgängen.",
        },
        {
          key: "heatMeter",
          label: "Wärmemengenzähler",
          matchAny: ["Wärmemengenzähler"],
          severity: "medium",
          requiredType: "optional",
          description: "Wärmemengenzähler für FBH-Systeme.",
        },
        {
          key: "dewPointMonitoring",
          label: "Taupunktüberwachung bei Kühlfunktion",
          matchAny: ["Taupunktüberwachung", "Taupunktlogik"],
          severity: "medium",
          requiredType: "optional",
          description: "Taupunktüberwachung bei FBH mit Kühlfunktion.",
        },
      ],
      logicRules: [
        {
          key: "fbh_without_manifold",
          title: "FBH ohne Heizkreisverteiler",
          severity: "high",
          condition: {
            detectedAny: ["heatingPipe", "layingSystem"],
            missingAny: ["manifold"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Eine erkannte Fußbodenheizung ohne Verteiler ist fachlich unvollständig und erzeugt Nachtragsrisiken.",
          recommendation:
            "Heizkreisverteiler mit Anzahl und Ausstattung explizit aufnehmen.",
        },
        {
          key: "fbh_without_actuators",
          title: "FBH ohne Regelungs-/Stellantriebsbezug",
          severity: "high",
          condition: {
            detectedAny: ["manifold"],
            missingAny: ["actuators", "roomControl"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne klare Angabe zu Stellantrieben oder Raumregelung ist die Regelstrategie der FBH offen.",
          recommendation:
            "Stellantriebe und Raumregelung je Heizkreis spezifizieren oder als bauseits kennzeichnen.",
        },
        {
          key: "fbh_without_pressure_test",
          title: "FBH ohne Druckprüfung",
          severity: "high",
          condition: {
            detectedAny: ["heatingPipe", "layingSystem"],
            missingAny: ["pressureTest"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Druckprüfungsnachweis ist die Abnahme- und Haftungsbasis unklar.",
          recommendation:
            "Druckprüfung mit Verfahren, Prüfdruck und Protokoll als Leistung aufnehmen.",
        },
        {
          key: "fbh_without_balancing",
          title: "FBH ohne hydraulischen Abgleich / Einregulierung",
          severity: "high",
          condition: {
            detectedAny: ["heatingPipe", "manifold"],
            missingAny: ["hydraulicBalancing"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Abgleich drohen Komfortprobleme, Energieverluste und spätere Nachforderungen.",
          recommendation:
            "Hydraulischen Abgleich je Heizkreis inkl. Protokoll vorsehen.",
        },
        {
          key: "fbh_many_loops_without_fittings",
          title: "FBH mit vielen Kreisen ohne Verteilerarmaturen",
          severity: "medium",
          condition: {
            detectedAny: ["heatingPipe"],
            missingAny: ["manifoldConnection"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Viele Kreise ohne genaue Beschreibung der Verteilerarmaturen erschweren die Kalkulation.",
          recommendation:
            "Verteilerarmaturen (Absperrung, Messventile etc.) spezifizieren oder gesondert ausschreiben.",
        },
      ],
    },
  },
  {
    id: "heating_heat_pump_system",
    trade: "heating",
    name: "Wärmepumpenanlage",
    metadata: {
      gewerk: "Heizung",
      systemKey: "heating_heat_pump_system",
      label: "Wärmepumpenanlage",
      detection: {
        anyOf: [
          "Wärmepumpe",
          "Luft/Wasser-Wärmepumpe",
          "Sole/Wasser-Wärmepumpe",
          "WP-Innenmodul",
          "WP-Außeneinheit",
          "Wärmepumpeneinheit",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "unit",
          label: "Wärmepumpeneinheit",
          matchAny: [
            "Wärmepumpe",
            "Wärmepumpeneinheit",
            "WP-Innenmodul",
            "WP-Außeneinheit",
            "Luft/Wasser-Wärmepumpe",
            "Sole/Wasser-Wärmepumpe",
          ],
          severity: "high",
          requiredType: "required",
          description: "Wärmepumpeneinheit (Innen- und/oder Außeneinheit).",
        },
        {
          key: "hydraulicIntegration",
          label: "Hydraulische Einbindung",
          matchAny: ["hydraulische Einbindung"],
          severity: "high",
          requiredType: "required",
          description: "Hydraulische Einbindung der Wärmepumpe in das Heizsystem.",
        },
        {
          key: "safetyGroup",
          label: "Sicherheitsgruppe",
          matchAny: ["Sicherheitsgruppe"],
          severity: "high",
          requiredType: "required",
          description: "Sicherheitsgruppe an der Wärmepumpenanlage.",
        },
        {
          key: "mag",
          label: "Ausdehnungsgefäß / MAG",
          matchAny: ["MAG", "Ausdehnungsgefäß"],
          severity: "high",
          requiredType: "required",
          description: "Membran-Ausdehnungsgefäß für den Heizkreis.",
        },
        {
          key: "filter",
          label: "Schmutzfänger / Filter",
          matchAny: ["Schmutzfänger", "Filter"],
          severity: "medium",
          requiredType: "required",
          description: "Schmutzfänger bzw. Filter im Heizkreis.",
        },
        {
          key: "airVent",
          label: "Entlüftung",
          matchAny: ["Entlüftung", "Entlüfter"],
          severity: "medium",
          requiredType: "required",
          description: "Entlüftung im Wärmepumpensystem.",
        },
        {
          key: "condensate",
          label: "Kondensatführung",
          matchAny: ["Kondensat", "Kondensatführung"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Kondensatabführung, sofern erforderlich.",
        },
        {
          key: "control",
          label: "Regelung / Fühler",
          matchAny: ["Regelung", "Regler", "Fühler"],
          severity: "high",
          requiredType: "required",
          description: "Regelung inkl. Fühler für die Wärmepumpenanlage.",
        },
        {
          key: "commissioning",
          label: "Inbetriebnahme",
          matchAny: ["Inbetriebnahme"],
          severity: "high",
          requiredType: "required",
          description: "Inbetriebnahme der Wärmepumpenanlage.",
        },
        {
          key: "systemBalancing",
          label: "Hydraulischer Abgleich im Gesamtsystem",
          matchAny: ["hydraulischer Abgleich", "Systemabgleich"],
          severity: "high",
          requiredType: "required",
          description: "Hydraulischer Abgleich des Gesamtsystems mit Wärmepumpe.",
        },
      ],
      optionalComponents: [
        {
          key: "buffer",
          label: "Pufferspeicher",
          matchAny: ["Pufferspeicher"],
          severity: "medium",
          requiredType: "optional",
          description: "Pufferspeicher zur hydraulischen Entkopplung.",
        },
        {
          key: "hydraulicSeparator",
          label: "Hydraulische Weiche",
          matchAny: ["hydraulische Weiche"],
          severity: "medium",
          requiredType: "optional",
          description: "Hydraulische Weiche im Heizsystem.",
        },
        {
          key: "electricHeater",
          label: "Elektroheizstab",
          matchAny: ["Elektroheizstab"],
          severity: "medium",
          requiredType: "optional",
          description: "Elektrischer Heizstab als Zusatzheizung.",
        },
        {
          key: "noiseProtection",
          label: "Schallschutzmaßnahmen",
          matchAny: ["Schallschutzmaßnahme", "Schallschutzmaßnahmen"],
          severity: "medium",
          requiredType: "optional",
          description: "Schallschutzmaßnahmen für Außeneinheiten.",
        },
        {
          key: "foundation",
          label: "Fundament / Konsole",
          matchAny: ["Fundament", "Konsole"],
          severity: "medium",
          requiredType: "optional",
          description: "Fundament oder Konsole für die Außeneinheit.",
        },
        {
          key: "frostProtection",
          label: "Frostschutzkonzept",
          matchAny: ["Frostschutzkonzept", "Frostschutz"],
          severity: "medium",
          requiredType: "optional",
          description: "Frostschutzkonzept für Außenleitungen.",
        },
        {
          key: "glycol",
          label: "Glykol / Solekreis",
          matchAny: ["Glykol", "Solekreis"],
          severity: "medium",
          requiredType: "optional",
          description: "Glykol bzw. Solekreis bei Sole-Wärmepumpen.",
        },
        {
          key: "energyMeter",
          label: "Energiezähler",
          matchAny: ["Energiezähler"],
          severity: "medium",
          requiredType: "optional",
          description: "Energiezähler für die Wärmepumpenanlage.",
        },
      ],
      logicRules: [
        {
          key: "heat_pump_without_hydraulic_integration",
          title: "Wärmepumpe ohne hydraulische Einbindung",
          severity: "high",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["hydraulicIntegration"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne hydraulische Einbindung ist unklar, wie die Wärmepumpe das System versorgt.",
          recommendation:
            "Hydraulische Einbindung (Vorlauf/Rücklauf, Weiche/Puffer etc.) eindeutig beschreiben.",
        },
        {
          key: "heat_pump_without_safety_or_mag",
          title: "Wärmepumpe ohne Sicherheits-/MAG-Bezug",
          severity: "high",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["safetyGroup", "mag"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Sicherheitsgruppe oder MAG ist die Betriebssicherheit nicht geregelt.",
          recommendation:
            "Sicherheitsgruppe und Ausdehnungsgefäß dimensioniert ausschreiben oder Verantwortung klären.",
        },
        {
          key: "heat_pump_without_commissioning",
          title: "Wärmepumpe ohne Inbetriebnahme",
          severity: "high",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["commissioning"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Inbetriebnahme ist unklar, wer Funktionsprüfung und Parametrierung schuldet.",
          recommendation:
            "Inbetriebnahme inkl. Parametrierung und Protokoll als Leistung aufnehmen.",
        },
        {
          key: "sole_heat_pump_without_sole_loop",
          title: "Sole-WP ohne Solekreisbezug",
          severity: "high",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["glycol"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Bei einer Sole-Wärmepumpe ohne Solekreisbeschreibung sind Quelle, Medium und Verantwortung offen.",
          recommendation:
            "Solekreis (Leitungen, Medium, Frostschutz) beschreiben oder klar als bauseits definieren.",
        },
        {
          key: "heat_pump_without_balancing_or_control",
          title: "WP-System ohne Abgleichs- oder Regelungslogik",
          severity: "medium",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["systemBalancing", "control"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Abgleichs- oder Regelungskonzept ist unklar, wie WP und Heizflächen zusammenspielen.",
          recommendation:
            "Regelungs- und Abgleichskonzept für das Gesamtsystem (WP + Heizflächen) beschreiben.",
        },
        {
          key: "outdoor_unit_without_condensate_noise_foundation",
          title: "Außeneinheit ohne Kondensat-, Schallschutz- oder Fundamenthinweise",
          severity: "medium",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["condensate", "noiseProtection", "foundation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Bei Außeneinheiten ohne Kondensat-, Schallschutz- oder Fundamentangaben drohen Schnittstellen- und Nachtragsrisiken.",
          recommendation:
            "Kondensatabführung, Schallschutz und Fundament/Unterkonstruktion klar regeln.",
        },
      ],
    },
  },
  {
    id: "heating_boiler_system",
    trade: "heating",
    name: "Kesselanlage / Gasheizung / Brennwert",
    metadata: {
      gewerk: "Heizung",
      systemKey: "heating_boiler_system",
      label: "Kesselanlage / Gasheizung / Brennwert",
      detection: {
        anyOf: [
          "Brennwertkessel",
          "Gaskessel",
          "Heizkessel",
          "Kaskade",
          "Gas-Brennwertgerät",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "boiler",
          label: "Wärmeerzeuger",
          matchAny: [
            "Brennwertkessel",
            "Gaskessel",
            "Heizkessel",
            "Gas-Brennwertgerät",
          ],
          severity: "high",
          requiredType: "required",
          description: "Brennwertkessel / Gaskessel / Heizkessel.",
        },
        {
          key: "flue",
          label: "Abgasführung / LAS / Schornsteinbezug",
          matchAny: ["Abgasführung", "LAS", "Schornstein"],
          severity: "high",
          requiredType: "required",
          description: "Abgasführung inkl. LAS / Schornsteinbezug.",
        },
        {
          key: "gasConnection",
          label: "Gasanschluss / Gasarmatur",
          matchAny: ["Gasanschluss", "Gasarmatur"],
          severity: "high",
          requiredType: "required",
          description: "Gasanschluss inkl. Absperr- und Sicherungsarmaturen.",
        },
        {
          key: "safetyGroup",
          label: "Sicherheitsgruppe",
          matchAny: ["Sicherheitsgruppe"],
          severity: "high",
          requiredType: "required",
          description: "Sicherheitsgruppe am Kessel.",
        },
        {
          key: "mag",
          label: "MAG",
          matchAny: ["MAG", "Ausdehnungsgefäß"],
          severity: "high",
          requiredType: "required",
          description: "Membran-Ausdehnungsgefäß.",
        },
        {
          key: "fillDrain",
          label: "Füll-/Entleerung",
          matchAny: ["Füllung", "Füll-/Entleerung"],
          severity: "medium",
          requiredType: "required",
          description: "Füll- und Entleerungsarmaturen.",
        },
        {
          key: "control",
          label: "Regelung",
          matchAny: ["Regelung", "Regler"],
          severity: "high",
          requiredType: "required",
          description: "Regelung des Kessels und der Anlage.",
        },
        {
          key: "pumps",
          label: "Pumpen / hydraulische Einbindung",
          matchAny: ["Pumpe", "Pumpen", "hydraulische Einbindung"],
          severity: "medium",
          requiredType: "required",
          description: "Pumpen und hydraulische Einbindung des Wärmeerzeugers.",
        },
        {
          key: "waterTreatment",
          label: "Wasseraufbereitung / Heizwasserqualität",
          matchAny: ["Wasseraufbereitung", "Heizwasserqualität"],
          severity: "medium",
          requiredType: "contextRequired",
          description: "Heizwasserqualität oder Wasseraufbereitung.",
        },
        {
          key: "commissioning",
          label: "Inbetriebnahme",
          matchAny: ["Inbetriebnahme"],
          severity: "high",
          requiredType: "required",
          description: "Inbetriebnahme der Kesselanlage.",
        },
      ],
      optionalComponents: [
        {
          key: "neutralisation",
          label: "Neutralisation",
          matchAny: ["Neutralisation"],
          severity: "medium",
          requiredType: "optional",
          description: "Neutralisation von Kondensat.",
        },
        {
          key: "cascadeDistributor",
          label: "Kaskadenverteiler",
          matchAny: ["Kaskadenverteiler"],
          severity: "medium",
          requiredType: "optional",
          description: "Verteiler für Kaskadenanlagen.",
        },
        {
          key: "dirtSeparator",
          label: "Schlammabscheider",
          matchAny: ["Schlammabscheider"],
          severity: "medium",
          requiredType: "optional",
          description: "Schlammabscheider im Heizkreis.",
        },
        {
          key: "microBubbleSeparator",
          label: "Mikroblasenabscheider",
          matchAny: ["Mikroblasenabscheider"],
          severity: "medium",
          requiredType: "optional",
          description: "Mikroblasenabscheider im Heizkreis.",
        },
        {
          key: "gasFlowGuard",
          label: "Gasströmungswächter",
          matchAny: ["Gasströmungswächter"],
          severity: "medium",
          requiredType: "optional",
          description: "Gasströmungswächter im Gasstrang.",
        },
        {
          key: "condensateNeutralisation",
          label: "Kondensatneutralisation",
          matchAny: ["Kondensatneutralisation"],
          severity: "medium",
          requiredType: "optional",
          description: "Neutralisation von Brennwertkondensat.",
        },
      ],
      logicRules: [
        {
          key: "boiler_without_flue",
          title: "Kessel ohne Abgasführung",
          severity: "high",
          condition: {
            detectedAny: ["boiler"],
            missingAny: ["flue"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "high",
          },
          explanation:
            "Ohne Abgasführung ist die Betriebssicherheit und Genehmigungsfähigkeit unklar.",
          recommendation:
            "Abgassystem (LAS/Schornstein) mit Verantwortung und Anschluss klar definieren.",
        },
        {
          key: "boiler_without_safety_or_mag",
          title: "Kessel ohne Sicherheits-/MAG-Bezug",
          severity: "high",
          condition: {
            detectedAny: ["boiler"],
            missingAny: ["safetyGroup", "mag"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Fehlende Sicherheitsgruppe oder MAG führen zu unklarer Verantwortlichkeit für Anlagensicherheit.",
          recommendation:
            "Sicherheitsgruppe und Ausdehnungsgefäß explizit aufnehmen oder bauseits definieren.",
        },
        {
          key: "condensing_without_condensate_neutralisation",
          title: "Brennwertanlage ohne Kondensat-/Neutralisationsbezug",
          severity: "high",
          condition: {
            detectedAny: ["boiler"],
            missingAny: ["condensateNeutralisation"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Bei Brennwertkesseln ohne Kondensat- bzw. Neutralisationskonzept drohen Folgekosten und Haftungsfragen.",
          recommendation:
            "Kondensatführung und Neutralisation samt Zuständigkeiten beschreiben.",
        },
        {
          key: "boiler_without_commissioning",
          title: "Kesselanlage ohne Inbetriebnahme",
          severity: "high",
          condition: {
            detectedAny: ["boiler"],
            missingAny: ["commissioning"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Inbetriebnahme ist unklar, wer Funktion und Einstellungen schuldet.",
          recommendation:
            "Inbetriebnahme inkl. Abnahmeprotokoll und ggf. Schornsteinfegerabnahme definieren.",
        },
        {
          key: "boiler_without_water_treatment",
          title: "Kesselanlage ohne Wasserqualitäts-/Aufbereitungsbezug",
          severity: "medium",
          condition: {
            detectedAny: ["boiler"],
            missingAny: ["waterTreatment"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne Regelung zur Wasserqualität sind Korrosion und Gewährleistungsrisiken offen.",
          recommendation:
            "Heizwasserqualität und Wasseraufbereitung regeln.",
        },
        {
          key: "cascade_without_distributor_or_hydraulics",
          title: "Kaskadenanlage ohne Verteiler- oder Hydrauliklogik",
          severity: "medium",
          condition: {
            detectedAny: ["boiler"],
            missingAny: ["cascadeDistributor", "pumps"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Bei Kaskaden ohne Verteiler- oder Hydrauliklogik sind Aufteilung und Redundanz unklar.",
          recommendation:
            "Kaskadenverteiler, Hydraulik und Regelstrategie der Kaskade beschreiben.",
        },
      ],
    },
  },
  {
    id: "heating_district_heating_station",
    trade: "heating",
    name: "Fernwärmestation",
    metadata: {
      gewerk: "Heizung",
      systemKey: "heating_district_heating_station",
      label: "Fernwärmestation",
      detection: {
        anyOf: [
          "Fernwärme",
          "Übergabestation",
          "Wärmeübergabestation",
          "Fernwärmeanschluss",
        ],
        minHits: 1,
      },
      requiredComponents: [
        {
          key: "unit",
          label: "Übergabestation",
          matchAny: ["Übergabestation", "Wärmeübergabestation"],
          severity: "high",
          requiredType: "required",
          description: "Fernwärme-Übergabestation.",
        },
        {
          key: "heatExchanger",
          label: "Wärmetauscher",
          matchAny: ["Wärmetauscher"],
          severity: "high",
          requiredType: "required",
          description: "Wärmetauscher der Fernwärmestation.",
        },
        {
          key: "control",
          label: "Regelung",
          matchAny: ["Regelung", "Regler"],
          severity: "high",
          requiredType: "required",
          description: "Regelung der Übergabestation.",
        },
        {
          key: "valves",
          label: "Mess-/Absperrarmaturen",
          matchAny: ["Messarmatur", "Absperrarmatur", "Mess-/Absperrarmaturen"],
          severity: "medium",
          requiredType: "required",
          description: "Mess- und Absperrarmaturen.",
        },
        {
          key: "safetyValves",
          label: "Sicherheitsarmaturen",
          matchAny: ["Sicherheitsarmatur", "Sicherheitsarmaturen"],
          severity: "high",
          requiredType: "required",
          description: "Sicherheitsarmaturen der Station.",
        },
        {
          key: "hydraulicIntegration",
          label: "Hydraulische Einbindung",
          matchAny: ["hydraulische Einbindung"],
          severity: "high",
          requiredType: "required",
          description: "Hydraulische Einbindung der Station ins Sekundärsystem.",
        },
        {
          key: "heatMeter",
          label: "Wärmemengenzählerbezug",
          matchAny: ["Wärmemengenzähler", "Energiezähler"],
          severity: "medium",
          requiredType: "required",
          description: "Wärmemengenzähler bzw. Messkonzept.",
        },
        {
          key: "commissioning",
          label: "Inbetriebnahme",
          matchAny: ["Inbetriebnahme"],
          severity: "high",
          requiredType: "required",
          description: "Inbetriebnahme der Fernwärmestation.",
        },
      ],
      optionalComponents: [
        {
          key: "diffPressureControl",
          label: "Differenzdruckregelung",
          matchAny: ["Differenzdruckregelung", "Differenzdruckregler"],
          severity: "medium",
          requiredType: "optional",
          description: "Differenzdruckregelung im Fernwärmesystem.",
        },
        {
          key: "filter",
          label: "Schmutzfänger",
          matchAny: ["Schmutzfänger"],
          severity: "medium",
          requiredType: "optional",
          description: "Schmutzfänger im Fernwärmeanschluss.",
        },
        {
          key: "pumpGroup",
          label: "Sekundärseitige Pumpengruppe",
          matchAny: ["Pumpengruppe", "sekundärseitige Pumpengruppe"],
          severity: "medium",
          requiredType: "optional",
          description: "Sekundärseitige Pumpengruppe.",
        },
        {
          key: "docMetering",
          label: "Dokumentations- und Messkonzept",
          matchAny: ["Dokumentationskonzept", "Messkonzept"],
          severity: "medium",
          requiredType: "optional",
          description: "Dokumentations- und Messkonzept für Übergabestation.",
        },
      ],
      logicRules: [
        {
          key: "district_heating_without_station_or_integration",
          title: "Fernwärme ohne Übergabestation / Einbindung",
          severity: "high",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["hydraulicIntegration"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "high",
          },
          explanation:
            "Ohne klare Übergabestation oder Einbindung sind Schnittstellen und Verantwortlichkeiten unklar.",
          recommendation:
            "Übergabestation und hydraulische Einbindung zur Gebäudeanlage eindeutig beschreiben.",
        },
        {
          key: "district_heating_without_metering",
          title: "Fernwärme ohne Mess-/Zählerlogik",
          severity: "high",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["heatMeter"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "high",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Mess- oder Zählerlogik sind Abrechnung und Verantwortlichkeiten unklar.",
          recommendation:
            "Messkonzept und Zählerverantwortung mit dem Versorger abstimmen und im LV abbilden.",
        },
        {
          key: "district_heating_without_commissioning_or_balancing",
          title:
            "Fernwärme ohne Inbetriebnahme / hydraulischen Abgleich im Sekundärsystem",
          severity: "high",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["commissioning"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "high",
            kalkulationsunsicherheit: "medium",
            vertrags_lv_risiken: "medium",
          },
          explanation:
            "Ohne Inbetriebnahme oder Abgleich im Sekundärsystem bleiben Komfort- und Haftungsfragen offen.",
          recommendation:
            "Inbetriebnahme und hydraulischen Abgleich des Sekundärsystems vertraglich regeln.",
        },
        {
          key: "district_heating_without_control_or_hydraulics",
          title:
            "Fernwärmeversorgung ohne Regelungs- oder Sekundärhydraulikbezug",
          severity: "medium",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["control", "hydraulicIntegration"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
          },
          explanation:
            "Ohne klare Regelungs- oder Sekundärhydraulikbeschreibung ist unklar, wie die Station das Gebäude versorgt.",
          recommendation:
            "Regelungs- und Hydraulikkonzept der Sekundärseite beschreiben, z. B. Pumpen, Mischer, Regelstrategie.",
        },
        {
          key: "district_heating_station_without_valve_or_safety_logic",
          title: "Übergabestation ohne Armaturen- oder Sicherheitslogik",
          severity: "medium",
          condition: {
            detectedAny: ["unit"],
            missingAny: ["valves", "safetyValves"],
          },
          categoryImpacts: {
            technische_vollstaendigkeit: "medium",
            kalkulationsunsicherheit: "medium",
            schnittstellen_nebenleistungen: "medium",
          },
          explanation:
            "Ohne klare Armaturen- und Sicherheitslogik sind Wartung und Verantwortlichkeiten unklar.",
          recommendation:
            "Mess-, Absperr- und Sicherheitsarmaturen mit Funktion und Verantwortlichkeit beschreiben.",
        },
      ],
    },
  },
];