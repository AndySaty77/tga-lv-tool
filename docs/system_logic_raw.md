# Systemlogik-Rohbibliothek

Diese Datei enthält die fachliche Rohbibliothek für die systemische Lückenanalyse im TGA-LV-Tool.

Sie dient als inhaltliche Quelle für die spätere Überführung in typisierte Systembibliotheken unter `lib/system-logic/`.

---

## Heizung

## 3.1 Heizkörperanlage

System-Key: heating_radiator_system  
Gewerk: Heizung

### System erkannt wenn
- Heizkörper
- Plattenheizkörper
- Röhrenradiatoren
- Ventilheizkörper

### Typische Pflichtbausteine
- Heizkörper
- Thermostatventile / Ventileinsätze
- Rücklaufverschraubungen
- Entlüftungsmöglichkeiten
- Befestigung / Konsolen
- Rohranschlüsse / Anschlussset
- Hydraulischer Abgleich oder Einregulierung
- Kennzeichnung / Voreinstellung, soweit beschrieben

### Optionale Bausteine
- Strangregulierventile
- Differenzdruckregler
- Abdeckrosetten
- Hahnblock
- Thermostatkopf separat
- Dämmung Anschlussleitungen

### Harte Lückenregeln
- Heizkörper vorhanden, aber **kein Thermostatventil**
- Heizkörper vorhanden, aber **kein Rücklauf-/Anschlussarmaturbezug**
- Heizkörperanlage vorhanden, aber **kein hydraulischer Abgleich / keine Einregulierung**

### Mittlere Lückenregeln
- viele Heizkörperpositionen, aber keine Strangregulierung im größeren Objekt
- Heizkörperanlage, aber keine Entlüftung / Zubehör / Befestigung erwähnt

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Claim-/Nachtragspotenzial

---

## 3.2 Fußbodenheizung

System-Key: heating_floor_heating_system  
Gewerk: Heizung

### System erkannt wenn
- Fußbodenheizung
- Flächenheizung
- Heizkreisverteiler
- FBH-Rohr
- Tackersystem / Noppensystem

### Typische Pflichtbausteine
- Heizrohr
- Verlegesystem
- Heizkreisverteiler
- Stellantriebe oder Regelbezug
- Anbindung Verteiler
- Regelung / Raumregelung
- Hydraulischer Abgleich / Volumenstromabgleich
- Druckprüfung
- Protokoll / Einregulierung

### Optionale Bausteine
- Dämmung
- Randdämmstreifen
- Systemplatten
- Estrichzusätze
- Schutzrohre
- Wärmemengenzähler
- Taupunktüberwachung bei Kühlfunktion

### Harte Lückenregeln
- FBH erkannt, aber **kein Heizkreisverteiler**
- FBH erkannt, aber **kein Regelungs-/Stellantriebsbezug**
- FBH erkannt, aber **keine Druckprüfung**
- FBH erkannt, aber **kein hydraulischer Abgleich / Einregulierung**

### Mittlere Lückenregeln
- FBH mit vielen Kreisen, aber keine Verteilerarmaturen
- Kühlfunktion erkennbar, aber keine Taupunktlogik

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Claim-/Nachtragspotenzial

---

## 3.3 Wärmepumpenanlage

System-Key: heating_heat_pump_system  
Gewerk: Heizung

### System erkannt wenn
- Wärmepumpe
- Luft/Wasser-Wärmepumpe
- Sole/Wasser-Wärmepumpe
- Innenmodul / Außeneinheit
- Kältemittelleitung im Kontext TGA-Heizung

### Typische Pflichtbausteine
- Wärmepumpeneinheit
- Hydraulische Einbindung
- Sicherheitsgruppe
- Ausdehnungsgefäß / MAG
- Schmutzfänger / Filter
- Entlüftung
- Kondensatführung, sofern erforderlich
- Regelung / Fühler
- Inbetriebnahme
- Hydraulischer Abgleich im Gesamtsystem

### Optionale Bausteine
- Pufferspeicher
- Hydraulische Weiche
- Elektroheizstab
- Schallschutzmaßnahmen
- Fundament / Konsole
- Frostschutzkonzept
- Glykol / Solekreis bei Sole-WP
- Energiezähler

### Harte Lückenregeln
- Wärmepumpe erkannt, aber **keine hydraulische Einbindung**
- Wärmepumpe erkannt, aber **kein Sicherheits-/MAG-Bezug**
- Wärmepumpe erkannt, aber **keine Inbetriebnahme**
- Sole-WP erkannt, aber **kein Solekreisbezug**

### Mittlere Lückenregeln
- WP mit Heizkörper-/FBH-System, aber keine Abgleichs- oder Regelungslogik
- Außeneinheit, aber keine Kondensat-, Schallschutz- oder Fundamenthinweise

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Claim-/Nachtragspotenzial

---

## 3.4 Kesselanlage / Gasheizung / Brennwert

System-Key: heating_boiler_system  
Gewerk: Heizung

### System erkannt wenn
- Brennwertkessel
- Gaskessel
- Heizkessel
- Kaskade
- Gas-Brennwertgerät

### Typische Pflichtbausteine
- Wärmeerzeuger
- Abgasführung / LAS / Schornsteinbezug
- Gasanschluss / Gasarmatur
- Sicherheitsgruppe
- MAG
- Füll-/Entleerung
- Regelung
- Pumpen / hydraulische Einbindung
- Wasseraufbereitung / Heizwasserqualität
- Inbetriebnahme

### Optionale Bausteine
- Neutralisation
- Kaskadenverteiler
- Schlammabscheider
- Mikroblasenabscheider
- Gasströmungswächter
- Kondensatneutralisation

### Harte Lückenregeln
- Kessel erkannt, aber **keine Abgasführung**
- Kessel erkannt, aber **kein Sicherheits-/MAG-Bezug**
- Brennwertanlage erkannt, aber **kein Kondensat-/Neutralisationsbezug**, sofern sachlich naheliegend
- keine Inbetriebnahme

### Mittlere Lückenregeln
- Kesselanlage ohne Wasserqualitäts- oder Aufbereitungsbezug
- Kaskadenanlage ohne Verteiler- oder Hydrauliklogik

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Vertrags-/LV-Risiken

---

## 3.5 Fernwärmestation

System-Key: heating_district_heating_station  
Gewerk: Heizung

### System erkannt wenn
- Fernwärme
- Übergabestation
- Wärmeübergabestation
- Fernwärmeanschluss

### Typische Pflichtbausteine
- Übergabestation
- Wärmetauscher
- Regelung
- Mess-/Absperrarmaturen
- Sicherheitsarmaturen
- Hydraulische Einbindung
- Wärmemengenzählerbezug
- Inbetriebnahme

### Optionale Bausteine
- Differenzdruckregelung
- Schmutzfänger
- Sekundärseitige Pumpengruppe
- Dokumentations- und Messkonzept

### Harte Lückenregeln
- Fernwärme erkannt, aber **keine Übergabestation / Einbindung**
- Fernwärme erkannt, aber **keine Mess-/Zählerlogik**
- keine Inbetriebnahme / kein hydraulischer Abgleich im Sekundärsystem

### Mittlere Lückenregeln
- Fernwärmeversorgung ohne Regelungs- oder Sekundärhydraulikbezug
- Übergabestation ohne Armaturen- oder Sicherheitslogik

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Schnittstellen & Nebenleistungen

---

## Sanitär

## 3.6 Trinkwasserinstallation

System-Key: sanitary_drinking_water_installation  
Gewerk: Sanitär

### System erkannt wenn
- Trinkwasser
- Kaltwasser
- Warmwasser
- PWC
- PWH
- Zirkulation
- Trinkwasserleitung

### Typische Pflichtbausteine
- Rohrnetz
- Formstücke / Verbindungstechnik
- Armaturen
- Dämmung
- Befestigung
- Spülung
- Druckprüfung / Dichtheitsprüfung
- Hygienespülung / Inbetriebnahme
- Kennzeichnung
- Zirkulation bei Warmwasseranlage
- Wasserbehandlung, sofern erforderlich

### Optionale Bausteine
- Probennahmeventile
- Strangregulierventile Zirkulation
- Leckageschutz
- Filter
- Druckminderer

### Harte Lückenregeln
- Warmwasseranlage erkannt, aber **keine Zirkulation**, obwohl diese bei Gebäudegröße technisch naheliegend ist
- Trinkwasserinstallation erkannt, aber **keine Druckprüfung oder Spülung beschrieben**
- Warmwasser/Zirkulation erkannt, aber **kein hydraulischer Abgleich oder keine Regulierventile in der Zirkulation**

### Mittlere Lückenregeln
- längere Verteilnetze ohne Hygiene-, Spül- oder Inbetriebnahmelogik
- Trinkwassernetz ohne Dämmung oder Befestigungsbezug

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Schnittstellen & Nebenleistungen

---

## 3.7 Abwasserinstallation

System-Key: sanitary_wastewater_installation  
Gewerk: Sanitär

### System erkannt wenn
- Schmutzwasser
- Abwasser
- Regenwasser innen
- Fallleitung
- Grundleitung

### Typische Pflichtbausteine
- Rohrsystem
- Formstücke
- Befestigung
- Reinigungsöffnungen
- Schallschutz, sofern relevant
- Brandschutzabschottung bei Deckendurchführungen
- Dichtheitsprüfung, sofern gefordert oder üblich
- Anschluss an Entwässerungspunkte

### Optionale Bausteine
- Hebeanlage
- Rückstauverschluss
- Bodenabläufe
- Dachabläufe
- Notentwässerung

### Harte Lückenregeln
- Abwasserstränge erkannt, aber **keine Reinigungsöffnungen beschrieben**
- Entwässerungsleitungen durch Brandabschnitte, aber **kein Brandschutzbezug**
- Hebeanlage technisch erforderlich, aber **nicht beschrieben**

### Mittlere Lückenregeln
- größere Abwasserinstallation ohne Schallschutzmaßnahmen
- größere Rohrnetze ohne Befestigungs- oder Montagesystembezug

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen
- Kalkulationsunsicherheit

---

## 3.8 Sanitärgegenstände / Ausstattung

System-Key: sanitary_fixtures_equipment  
Gewerk: Sanitär

### System erkannt wenn
- WC
- Waschtisch
- Urinal
- Dusche
- Badewanne
- Ausgussbecken

### Typische Pflichtbausteine
- Sanitärgegenstand / Objekt
- Anschlussgarnitur
- Befestigung
- Ablauf / Geruchverschluss
- Armatur
- Zubehör (z. B. WC-Sitz, Betätigungsplatte, Ablaufgarnitur)
- Schallschutzset, sofern üblich

### Optionale Bausteine
- Vorwandsysteme
- Montagerahmen
- Designabdeckungen
- Anschlusszubehörsets
- Geruchsverschlüsse mit Sonderfunktion

### Harte Lückenregeln
- Sanitärgegenstand vorhanden, aber **keine Armatur oder kein Ablauf beschrieben**
- Sanitärgegenstand vorhanden, aber **keine Befestigung oder Montagesysteme erwähnt**
- WC-System vorhanden, aber **keine Betätigungsplatte oder kein WC-Sitz beschrieben**, sofern nicht ausdrücklich bauseits

### Mittlere Lückenregeln
- größere Anzahl Sanitärgegenstände ohne Zubehör- oder Montagebezug
- Ausstattung ohne Schallschutzbezug bei mehrgeschossigen Gebäuden

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Schnittstellen & Nebenleistungen

---

## Lüftung

## 3.9 Lüftungsanlage allgemein

System-Key: ventilation_air_handling_system  
Gewerk: Lüftung

### System erkannt wenn
- Lüftungsgerät
- RLT-Gerät
- Zu-/Abluft
- Luftkanal
- Volumenstromregler
- Luftauslass

### Typische Pflichtbausteine
- Lüftungsgerät / RLT-Gerät
- Kanalnetz
- Formstücke
- Aufhängung / Befestigungssystem
- Luftdurchlässe
- Volumenstromregler / Drosselorgane
- Schalldämpfer, sofern erforderlich
- Dämmung
- Brandschutzklappen, sofern brandabschnittsrelevant
- Messung / Einregulierung
- Funktionsprüfung / Inbetriebnahme

### Optionale Bausteine
- Revisionsöffnungen
- Wetterschutzgitter
- Kondensatablauf
- Schwingungsdämpfer
- Filterüberwachung
- Wärmerückgewinnung (WRG)

### Harte Lückenregeln
- Lüftungsanlage erkannt, aber **keine Luftdurchlässe beschrieben**
- Lüftungsanlage erkannt, aber **keine Einregulierung oder Volumenstrommessung**
- brandabschnittsübergreifendes Kanalnetz, aber **kein Brandschutzklappenbezug**
- Lüftungsgerät erkannt, aber **kein Kondensatbezug**, sofern technisch naheliegend

### Mittlere Lückenregeln
- größere Kanalnetze ohne Revisionsöffnungen
- Lüftungsanlage ohne Schalldämpfer bei sensiblen Nutzungen
- Anlage ohne Funktionsprüfung oder Abnahmeprotokolle

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen
- Kalkulationsunsicherheit

---

## 3.10 Kälte-/Klimaanlage / VRF / Split

System-Key: ventilation_cooling_split_vrf_system  
Gewerk: Lüftung

### System erkannt wenn
- Klimagerät
- Splitgerät
- VRF
- Kältemittelleitung
- Fan Coil
- Deckenkassette

### Typische Pflichtbausteine
- Innen- und Außengerät
- Kältemittelleitungen
- Kondensatleitung
- Halterung / Konsole
- Regelung
- Elektro- oder MSR-Schnittstelle
- Inbetriebnahme
- Dichtheitsprüfung / Evakuierungsleistungen

### Optionale Bausteine
- Kernbohrungen
- Kondensatpumpe
- Schallschutzmaßnahmen
- Wandkonsole / Dachaufständerung

### Harte Lückenregeln
- Klimagerät erkannt, aber **keine Kondensatleitung**
- Split- oder VRF-System erkannt, aber **keine Kältemittelleitungen**
- Kälteanlage erkannt, aber **keine Inbetriebnahme oder Dichtheitsprüfung**

### Mittlere Lückenregeln
- Außengerät ohne Montage- oder Fundamenthinweis
- mehrere Innengeräte ohne klare Regelungs- oder Steuerlogik

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen
- Kalkulationsunsicherheit

---

## Elektro

## 3.15 Allgemeine Elektroinstallation

System-Key: electrical_general_installation  
Gewerk: Elektro

### System erkannt wenn
- Elektroinstallation
- Starkstrom
- Installationsanlage
- Leitungsanlage
- Kabel und Leitungen
- Unterverteilung
- Steckdosen
- Schalterprogramm

### Typische Pflichtbausteine
- Leitungen / Kabel
- Installationsrohre / Trassen / Verlegesystem
- Dosen / Abzweigdosen / Gerätedosen
- Schalter / Steckdosen / Bedienstellen
- Unterverteilungen / Stromkreisaufteilung
- Schutzorgane
- Beschriftung / Kennzeichnung
- Messung / Prüfung
- Dokumentation

### Optionale Bausteine
- Brandschutzkanäle
- Überspannungsschutz
- Hohlwand-/Betonbauzubehör
- Montagegestelle
- Reserveplätze / Reservestromkreise

### Harte Lückenregeln
- Leitungsinstallation erkannt, aber **keine Schutzorgane / keine Absicherung**
- Elektroinstallation erkannt, aber **keine Messung / Erstprüfung**
- Unterverteilung erkannt, aber **keine Beschriftung / Stromkreiskennzeichnung**
- Installationsgeräte ausgeschrieben, aber **keine Gerätedosen / Anschlusslogik**

### Mittlere Lückenregeln
- größere Installation, aber **keine Verlegesysteme / Trassen**
- Unterverteilungen ohne **Reserve-/Erweiterungslogik**
- keine **Dokumentation / Bestandsunterlagen**

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Vertrags-/LV-Risiken

---

## 3.16 Unterverteilung / Verteilerbau

System-Key: electrical_distribution_board  
Gewerk: Elektro

### System erkannt wenn
- Unterverteilung
- UV
- Feldverteiler
- Installationsverteiler
- Reiheneinbaugeräte
- Verteilerschrank

### Typische Pflichtbausteine
- Gehäuse / Schrank
- Einspeisung
- Schutzorgane (LS, FI/RCD, ggf. RCBO)
- Reihenklemmen
- Beschriftung
- Stromlauf- / Verteilerplan
- Abgangslogik
- Messung / Prüfung

### Optionale Bausteine
- Überspannungsschutz
- Energiezähler
- Blindabdeckungen
- Reserven
- Schrankbeleuchtung
- Türkontaktschalter

### Harte Lückenregeln
- Unterverteilung erkannt, aber **keine Schutzorgane**
- Unterverteilung erkannt, aber **keine Beschriftung / keine Dokumentation**
- Verteilerbau erkannt, aber **keine Prüfung / Messung**
- UV erkannt, aber **keine Einspeisungs- oder Abgangslogik**

### Mittlere Lückenregeln
- größere UV ohne **Überspannungsschutzbezug**
- keine **Reservelogik**
- keine **Klemmen / Anschlussebene**

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit

---

## 3.17 Beleuchtungsanlage

System-Key: electrical_lighting_system  
Gewerk: Elektro

### System erkannt wenn
- Leuchte
- Beleuchtung
- Lichtband
- Downlight
- Pendelleuchte
- LED-Leuchte
- Sicherheitsbeleuchtung

### Typische Pflichtbausteine
- Leuchten
- Befestigung / Montagezubehör
- Anschlussleitung / Anschlussmaterial
- Schaltlogik
- Stromkreiszuordnung
- Beschriftung
- Prüfung / Messung

### Optionale Bausteine
- DALI
- Präsenzmelder
- Konstantlichtregelung
- Notlichtüberwachung
- Montageschienen
- Abhängesets

### Harte Lückenregeln
- Leuchten erkannt, aber **keine Schalt- oder Steuerlogik**
- Leuchten erkannt, aber **keine Anschlusslogik**
- Sicherheitsbeleuchtung erkannt, aber **keine Prüf- oder Überwachungslogik**
- DALI- oder Lichtsteuerung erkennbar, aber **keine Bus- oder Adressierungslogik**

### Mittlere Lückenregeln
- größere Beleuchtungsanlage ohne **Beschriftung / Dokumentation**
- Leuchten mit Steuerungsbezug, aber **keine Sensorik oder Bedienstellen**

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen
- Kalkulationsunsicherheit

---

## 3.18 Kabeltragsysteme / Trassen

System-Key: electrical_cable_support_system  
Gewerk: Elektro

### System erkannt wenn
- Kabelrinne
- Kabelleiter
- Brüstungskanal
- Installationskanal
- Kabeltragsystem
- Steigetrasse

### Typische Pflichtbausteine
- Trassen / Kanäle
- Formstücke
- Befestigung
- Brandschutzmaßnahmen bei Durchführungen
- Potentialausgleich, sofern erforderlich
- Kennzeichnung

### Optionale Bausteine
- Trennstege
- Deckel
- Korrosionsschutz
- Abhängungen Sonderbau
- Schallschutzentkopplung

### Harte Lückenregeln
- Kabeltragsystem erkannt, aber **keine Befestigung**
- Trassen durch Brandabschnitte, aber **kein Brandschutzbezug**
- größere Trassenanlage, aber **keine Formstücke / Übergänge**

### Mittlere Lückenregeln
- große Kabeltrassen ohne Kennzeichnung
- fehlender Potentialausgleich bei metallischen Trassen

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen

---

## 3.19 Erdung / Potentialausgleich

System-Key: electrical_earthing_equipotential  
Gewerk: Elektro

### System erkannt wenn
- Potentialausgleich
- Erdung
- PAS
- Hauptpotentialausgleich
- Funktionspotentialausgleich

### Typische Pflichtbausteine
- PAS-Schiene
- Anschlussleitungen
- Einbindung fremder leitfähiger Teile
- Kennzeichnung
- Messung / Prüfung
- Dokumentation

### Optionale Bausteine
- Überspannungsschutzkoordination
- Blitzschutz-Einbindung
- Funktionspotentialausgleich für Technikräume

### Harte Lückenregeln
- Potentialausgleich erkannt, aber **keine PAS oder Anschlusspunkte**
- technische Anlage mit Erdungsbezug, aber **kein Potentialausgleich erwähnt**
- keine **Messung / Prüfung**

### Mittlere Lückenregeln
- Erdungssystem ohne Dokumentation
- Potentialausgleich ohne Einbindung fremder leitfähiger Teile

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit

---

## 3.20 Sicherheitsstrom / Notbeleuchtung

System-Key: electrical_emergency_lighting_system  
Gewerk: Elektro

### System erkannt wenn
- Sicherheitsbeleuchtung
- Notlicht
- Sicherheitsstromversorgung
- Zentralbatterie
- Einzelbatterieleuchte
- Fluchtwegbeleuchtung

### Typische Pflichtbausteine
- Leuchten
- Stromversorgung / Batterie / Zentrale
- Überwachung
- Prüftaster / Testfunktion
- Kennzeichnung
- Dokumentation / Prüfbuch

### Optionale Bausteine
- Zentralüberwachung
- automatische Testfunktionen
- Ersatzstromumschaltung
- zusätzliche Fluchtwegkennzeichnung

### Harte Lückenregeln
- Notbeleuchtung erkannt, aber **keine Prüf- oder Überwachungslogik**
- Sicherheitsbeleuchtung erkannt, aber **keine Stromversorgungslogik**
- Fluchtwegbeleuchtung erkannt, aber **keine Kennzeichnung oder Dokumentation**

### Mittlere Lückenregeln
- Sicherheitsstromanlage ohne Prüfbuch- oder Dokumentationsbezug
- Notbeleuchtung ohne klare Teststrategie

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Vertrags-/LV-Risiken

---

## 3.21 E-Mobilität / Ladeinfrastruktur

System-Key: electrical_ev_charging_infrastructure  
Gewerk: Elektro

### System erkannt wenn
- Wallbox
- Ladepunkt
- Ladeinfrastruktur
- EV-Charger
- Ladesäule

### Typische Pflichtbausteine
- Ladepunkt
- Zuleitung
- Schutzorgane
- Lastmanagement / Steuerlogik (bei mehreren Ladepunkten)
- Kommunikation / Backendbezug
- Fundament / Montage (bei freistehenden Säulen)
- Prüfung / Inbetriebnahme

### Optionale Bausteine
- Backendanbindung
- Energiemessung
- Zugangskontrolle
- Überspannungsschutz
- Beschilderung

### Harte Lückenregeln
- Ladepunkt erkannt, aber **keine Schutzorgane**
- mehrere Ladepunkte, aber **keine Lastmanagementlogik**
- Wallbox erkannt, aber **keine Inbetriebnahme / Prüfung**
- freistehende Ladesäule, aber **kein Fundament- oder Montagebezug**

### Mittlere Lückenregeln
- Ladeinfrastruktur ohne Kommunikations- oder Backendbezug
- mehrere Ladepunkte ohne Energiemess- oder Steuerlogik

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen
- Kalkulationsunsicherheit

---

## MSR

## 3.22 MSR / Gebäudeautomation allgemein

System-Key: msr_building_automation_system  
Gewerk: MSR

### System erkannt wenn
- MSR
- Gebäudeautomation
- GA
- DDC
- Automationsstation
- Regelung
- BACnet
- Modbus
- KNX im TGA-Kontext

### Typische Pflichtbausteine
- Automationsstation / Controller
- Feldgeräte / Sensorik / Aktorik
- Schaltschrankanbindung
- Datenpunktliste / Funktionsliste
- Kommunikationsschnittstellen
- Parametrierung / Programmierung
- Inbetriebnahme
- Funktionsprüfung
- Dokumentation

### Optionale Bausteine
- Visualisierung
- Trend / Alarmierung
- Fernzugriff
- BACnet-Managementebene
- GLT-Aufschaltung
- Optimierungsfunktionen

### Harte Lückenregeln
- GA/MSR erkannt, aber **keine Sensorik- oder Aktoriklogik**
- DDC erkannt, aber **keine Parametrierung / Inbetriebnahme**
- BACnet/Modbus/KNX erkannt, aber **keine Schnittstellenbeschreibung**
- MSR erkannt, aber **keine Datenpunkt- oder Funktionslogik**
- GA erkannt, aber **keine Dokumentation oder Prüfleistungen**

### Mittlere Lückenregeln
- Visualisierung angedeutet, aber **keine Beschreibung**
- Fernzugriff oder Alarmierung **unklar beschrieben**
- keine Abgrenzung zwischen **Hardware- und Software-Datenpunkten**

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen
- Kalkulationsunsicherheit

---

## 3.23 Feldgeräte: Sensorik / Aktorik

System-Key: msr_field_devices  
Gewerk: MSR

### System erkannt wenn
- Temperaturfühler
- Drucksensor
- Differenzdrucksensor
- Feuchtefühler
- Volumenstromsensor
- Stellmotor
- Ventilantrieb
- Klappenantrieb

### Typische Pflichtbausteine
- Fühler / Sensoren
- Aktoren / Stellantriebe
- Montagezubehör / Tauchhülsen / Messnippel
- Verdrahtung / Anschluss
- Adressierung / Zuordnung
- Parametrierung / Prüfung

### Optionale Bausteine
- Schutzrohre
- Montagekonsolen
- Wettergehäuse
- Kalibrierung
- Redundanzsensorik

### Harte Lückenregeln
- Sensorik erkannt, aber **keine Verdrahtungs- oder Anschlusslogik**
- Temperaturmessung erkannt, aber **keine Tauchhülse oder Einbauzubehör**
- Aktorik erkannt, aber **keine Ansteuerungslogik**
- Ventile oder Klappen im HLS-System erkannt, aber **kein Antrieb / keine Regelungszuordnung**

### Mittlere Lückenregeln
- Feldgeräte ohne Adressierungs- oder Zuordnungslogik
- Sensorik ohne Prüf- oder Kalibrierbezug

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen

---

## 3.24 Schaltschrank / Automationsschrank

System-Key: msr_control_cabinet  
Gewerk: MSR

### System erkannt wenn
- Schaltschrank MSR
- GA-Schrank
- DDC-Schrank
- Automationsschrank
- Feldverteiler Automation

### Typische Pflichtbausteine
- Schrank / Gehäuse
- Controller / Automationsstation
- Netzteile
- Klemmen / I/O-Ebene
- Sicherungen
- Beschriftung
- Stromlauf- / Klemmenpläne
- Prüfung
- Dokumentation

### Optionale Bausteine
- USV
- Schrankklimatisierung
- Bedientableau
- Router / Switch
- Fernwartungsmodul

### Harte Lückenregeln
- Automationsschrank erkannt, aber **keine I/O- oder Klemmenlogik**
- Schaltschrank erkannt, aber **keine Stromversorgung / Absicherung**
- Schrank erkannt, aber **keine Pläne / Dokumentation / Beschriftung**
- MSR-Schrank erkannt, aber **keine Prüfung / Funktionsprüfung**

### Mittlere Lückenregeln
- Schaltschrank ohne Fernwartungs- oder Netzwerkkonzept
- I/O-Ebene ohne Klemmen- oder Beschriftungslogik

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit

---

## 3.25 Kommunikationssysteme / BACnet / Modbus / KNX / M-Bus

System-Key: msr_communication_protocols  
Gewerk: MSR

### System erkannt wenn
- BACnet
- Modbus
- KNX
- M-Bus
- TCP/IP
- Kommunikationsschnittstelle
- Protokollintegration

### Typische Pflichtbausteine
- Kommunikationsschnittstelle
- Netzwerkanbindung
- Adressierung
- Datenpunktmapping
- Integrationstest
- Dokumentation

### Optionale Bausteine
- Gateways
- Router
- VLAN-/IT-Abstimmung
- Zeitserver
- Redundanz

### Harte Lückenregeln
- BACnet/Modbus/KNX erkannt, aber **keine Datenpunktzuordnung**
- Kommunikationsprotokoll erkannt, aber **kein Integrationstest**
- Schnittstelle erwähnt, aber **keine Verantwortlichkeitsabgrenzung**
- GLT-Anbindung erkannt, aber **keine Netzwerkanbindung / IT-Schnittstelle**

### Mittlere Lückenregeln
- Kommunikationssystem ohne IT-Abstimmungs- oder Gatewaylogik
- Protokollintegration ohne Adressierungs- oder Mappingkonzept

### Score-Wirkung
- Schnittstellen & Nebenleistungen
- Kalkulationsunsicherheit
- Claim-/Nachtragspotenzial

---

## 3.26 Raumautomation

System-Key: msr_room_automation  
Gewerk: MSR

### System erkannt wenn
- Raumautomation
- Einzelraumregelung
- Raumregler
- Präsenzmelder
- CO₂-Fühler
- KNX-Raumcontroller
- VAV-Regelung im Raum

### Typische Pflichtbausteine
- Raumregler / Controller
- Sensorik
- Aktorik
- Verdrahtung / Bus
- Parametrierung
- Funktionsbeschreibung
- Inbetriebnahme

### Optionale Bausteine
- Szenensteuerung
- Zeitprogramme
- Fensterkontakte
- Taupunktsensorik
- App- oder Visualisierungsanbindung

### Harte Lückenregeln
- Raumautomation erkannt, aber **keine Sensorik**
- Raumautomation erkannt, aber **keine Aktorik / Stellglieder**
- Einzelraumregelung erkannt, aber **keine Parametrierung / Inbetriebnahme**
- Raumregler erkannt, aber **keine Funktionsbeschreibung**

### Mittlere Lückenregeln
- Raumautomation ohne Bus- oder Verdrahtungskonzept
- Raumregler ohne Szenen-, Zeit- oder Nutzungslogik bei komplexeren Anwendungen

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen

---

## 3.27 Heizungs-/Lüftungs-/Kälte-MSR-Funktionsmodule

System-Key: msr_hvac_control_modules  
Gewerk: MSR

### System erkannt wenn
- Heizkreisregelung
- Pumpensteuerung
- Mischerregelung
- Lüftungsregelung
- VAV-Regelung
- Kälteerzeuger-Anbindung
- Wärmepumpenintegration

### Typische Pflichtbausteine
- Sensorik
- Aktorik
- Regelbeschreibung
- Freigaben / Verriegelungen
- Sollwerte / Betriebsarten
- Alarm- / Störmeldungen
- Parametrierung
- Funktionsprüfung

### Optionale Bausteine
- Optimierungsfunktionen
- Energieoptimierung
- Nachtabsenkung
- GLT-Meldehierarchien
- Trendaufzeichnung

### Harte Lückenregeln
- Regelkreis erkannt, aber **keine Sensorik- oder Aktorikzuordnung**
- Regelkreis erkannt, aber **keine Funktionsbeschreibung**
- Anlage mit MSR-Bezug, aber **keine Störmelde- oder Freigabelogik**
- HLS-Komponente vorhanden, aber **keine Automationsanbindung**

### Mittlere Lückenregeln
- Regelungsmodul ohne Sollwert-, Betriebsarten- oder Alarmstruktur
- HVAC-Regelung ohne Trend- oder Optimierungslogik bei komplexeren Anlagen

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen
- Claim-/Nachtragspotenzial

---

## 3.28 Visualisierung / GLT / Managementebene

System-Key: msr_management_level_visualization  
Gewerk: MSR

### System erkannt wenn
- GLT
- Managementebene
- Visualisierung
- Leittechnik
- Dashboard
- BACnet-Client
- Bedien- und Beobachtungssystem

### Typische Pflichtbausteine
- Visualisierungslizenzen / Software
- Datenpunktaufschaltung
- Bedienbilder
- Alarme / Trends
- Benutzerrechte
- Inbetriebnahme / Test
- Dokumentation

### Optionale Bausteine
- Webzugriff
- Mobile Zugriffslösung
- Reporting
- Energiemonitoring
- Historisierung

### Harte Lückenregeln
- GLT/Visualisierung erkannt, aber **keine Datenpunktaufschaltung**
- Visualisierung erkannt, aber **keine Bedienbilder / keine Softwarelogik**
- Managementebene erwähnt, aber **keine Inbetriebnahme / kein Test**
- GLT-Anbindung erwähnt, aber **keine Schnittstellen- oder Netzwerkverantwortung**

### Mittlere Lückenregeln
- Visualisierung ohne Reporting-, Historisierungs- oder Benutzerrechtslogik
- Managementebene ohne klares Aufschaltungs- oder Testkonzept

### Score-Wirkung
- Schnittstellen & Nebenleistungen
- Kalkulationsunsicherheit
- Claim-/Nachtragspotenzial

---

## 3.29 Datenpunktlisten / Softwaredatenpunkte / Engineering

System-Key: msr_data_point_engineering  
Gewerk: MSR

### System erkannt wenn
- Datenpunktliste
- DPL
- Hardwaredatenpunkte
- Softwaredatenpunkte
- BACnet-Objekte
- GA-Engineering
- Funktionsliste

### Typische Pflichtbausteine
- Datenpunktliste
- Zuordnung Hardware / Software
- Benennung / Adressierung
- Alarmtexte
- Trenddefinitionen
- Funktionsbeschreibung
- Engineering / Parametrierung
- Test / Abnahme

### Optionale Bausteine
- Naming-Konvention
- Template-Engineering
- Import-/Export-Schnittstellen
- GA-Standardbibliothek

### Harte Lückenregeln
- MSR/GA erkannt, aber **keine Datenpunktliste**
- Datenpunkte erwähnt, aber **keine Trennung Hardware / Software**
- BACnet-/GLT-Aufschaltung, aber **keine Objekt- oder Mappinglogik**
- Engineering erkennbar nötig, aber **keine Parametrier- oder Softwareleistung**

### Mittlere Lückenregeln
- Datenpunktliste ohne Alarm-, Trend- oder Benennungslogik
- Engineering ohne Import-/Export- oder Standardbibliotheksbezug

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Claim-/Nachtragspotenzial

---

## 3.30 Inbetriebnahme, Probebetrieb, Optimierung MSR

System-Key: msr_commissioning_optimization  
Gewerk: MSR

### System erkannt wenn
- Inbetriebnahme MSR
- Funktionsprüfung
- Probebetrieb
- Optimierung
- Einstellarbeiten
- Betreiber-Einweisung

### Typische Pflichtbausteine
- I/O-Test
- Feldtest
- Regeltest
- Integrationstest
- Probebetrieb
- Optimierung
- Einweisung
- Dokumentation

### Optionale Bausteine
- Langzeittrendbewertung
- Betreiber-Workshops
- Nachoptimierung
- Remote-Support
- Feinjustierung im Betrieb

### Harte Lückenregeln
- MSR erkannt, aber **keine Inbetriebnahme**
- komplexes Automationssystem, aber **kein Integrationstest**
- Regelungssystem erkannt, aber **kein Probebetrieb / keine Optimierung**
- keine Betreiber-Einweisung / keine Übergabeleistung

### Mittlere Lückenregeln
- Inbetriebnahme ohne Test- oder Übergabestruktur
- Optimierung ohne Nachweis- oder Dokumentationslogik

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Claim-/Nachtragspotenzial

---

## Querschnitt

## 3.11 Pumpengruppen / Sekundärhydraulik

System-Key: cross_secondary_hydraulic_groups  
Gewerk: Querschnitt

### System erkannt wenn
- Pumpengruppe
- Umwälzpumpe
- Mischergruppe
- Verteilerbalken
- Heizkreisgruppe

### Typische Pflichtbausteine
- Pumpe
- Absperrarmaturen
- Regelarmaturen / Mischer
- Fühler / Messstellen
- Dämmung
- elektrische / MSR-Anbindung
- Einregulierung

### Optionale Bausteine
- Differenzdruckregelung
- Absperrgruppen
- Service- / Wartungsarmaturen
- Hydraulische Weiche
- Verteilerbalken

### Harte Lückenregeln
- Pumpengruppe erkannt, aber **keine Absperr- oder Regelarmaturen**
- Hydraulikgruppe erkannt, aber **keine MSR- oder Regelungslogik**
- Heizkreisgruppen vorhanden, aber **keine Einregulierung**

### Mittlere Lückenregeln
- größere Hydrauliksysteme ohne Messstellen
- Pumpengruppen ohne Dämmung

### Score-Wirkung
- Technische Vollständigkeit
- Schnittstellen & Nebenleistungen
- Kalkulationsunsicherheit

---

## 3.12 Wasseraufbereitung / Heizwasserqualität

System-Key: cross_heating_water_treatment  
Gewerk: Querschnitt

### System erkannt wenn
- VDI 2035
- Heizwasseraufbereitung
- Enthärtung
- Vollentsalzung
- Nachfüllarmatur

### Typische Pflichtbausteine
- Aufbereitungsmaßnahme
- Befüllung / Nachspeisung
- Wasserqualitätsanforderung / Dokumentation
- Messung / Protokoll

### Optionale Bausteine
- Füllstation
- Leitfähigkeitsüberwachung
- Filter / Schlammabscheider
- automatische Nachspeisung

### Harte Lückenregeln
- Heizungsanlage vorhanden und **VDI-2035 / Wasserqualität thematisch relevant**, aber keine Aufbereitung oder keine Verantwortlichkeitsregelung
- Nachspeisung erkennbar, aber **keine Sicherung oder kein Konzept**

### Mittlere Lückenregeln
- größere Heizungsanlagen ohne Hinweis auf Wasserqualität
- Heizsystem ohne Dokumentation der Wasserparameter

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Vertrags-/LV-Risiken

---

## 3.13 Mess-, Prüf- und Inbetriebnahmeleistungen

System-Key: cross_testing_commissioning  
Gewerk: Querschnitt

### System erkannt wenn
- Inbetriebnahme
- Einregulierung
- Funktionsprüfung
- Messprotokoll
- Druckprüfung
- Spülung

### Logik
Dieses Modul ist kein eigenständiger Anlagentyp, sondern ein **gewerkeübergreifendes Querschnittsthema**.

Fast jedes technische System benötigt:
- Prüfung
- Einregulierung
- Inbetriebnahme
- Dokumentation

### Typische Pflichtbausteine
- Prüfung
- Einregulierung
- Inbetriebnahme
- Dokumentation

### Optionale Bausteine
- Übergabeprotokolle
- Abnahmeunterlagen
- Messwertdokumentation
- Betreiberunterlagen

### Harte Lückenregeln
- komplexe Anlage vorhanden, aber **keine Inbetriebnahmeleistung**
- wasserführendes System vorhanden, aber **keine Druckprüfung oder Spülung**
- lufttechnisches System vorhanden, aber **keine Einregulierung**
- geregeltes System vorhanden, aber **keine Funktionsprüfung**

### Mittlere Lückenregeln
- größere Anlage ohne Messprotokolle
- Anlagen ohne Übergabeprotokoll

### Score-Wirkung
- Technische Vollständigkeit
- Kalkulationsunsicherheit
- Claim-/Nachtragspotenzial

---

## 3.14 Dokumentation / Bestandsunterlagen

System-Key: cross_documentation_handover  
Gewerk: Querschnitt

### System erkannt wenn
- Dokumentation
- Revisionsunterlagen
- Bestandspläne
- Einweisungen
- Wartungsunterlagen

### Logik
Dokumentationsleistungen sind nicht immer technisch kritisch, haben aber **hohe wirtschaftliche Relevanz** für Angebot und Nachträge.

### Typische Pflichtbausteine
- Revisionsunterlagen
- Bestandspläne
- Dokumentation der Anlagen
- Einweisung / Übergabe
- Wartungsunterlagen

### Optionale Bausteine
- Digitale Anlagendokumentation
- Revisionsordner
- Betreiberhandbuch
- Schulungsunterlagen

### Harte Lückenregeln
- komplexe Anlage vorhanden, aber **keine Dokumentationsleistungen**
- Übergabe der Anlage vorgesehen, aber **keine Einweisung**
- größere Projekte ohne **Revisionsunterlagen oder Bestandspläne**

### Mittlere Lückenregeln
- Dokumentation ohne klaren Umfang
- keine Wartungs- oder Betriebsunterlagen

### Score-Wirkung
- Vertrags-/LV-Risiken
- Kalkulationsunsicherheit
- Claim-/Nachtragspotenzial