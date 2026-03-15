# Trigger-Reclassification – fachliche Umhänge-Empfehlung

**Kontext:** Fachlich belastbare Zuordnung auffälliger Trigger (v. a. Elektro/Sanitär) zu den 5 Kategorien.  
**Hinweis:** Trigger-IDs und exakte Titel stammen aus Ihrer Supabase-Tabelle `triggers`. Die Tabelle unten arbeitet mit **Trigger-Titeln/-Themen**; die Zuordnung zu konkreten DB-Zeilen erfolgt über den **Namen** (Spalte `name`) beim manuellen Update oder CSV-Import.

**Fachlogik (Maßstab):**

- **vertrags_lv_risiken:** Nur echte Vertrags-/Abgrenzungs-/Haftungs-/weiche Formulierungsrisiken.
- **technische_vollstaendigkeit:** Fehlende oder unvollständige technische Systembestandteile („was fehlt“).
- **schnittstellen_nebenleistungen:** Nur wenn unklar ist, **wer** eine gewerkeübergreifende Leistung ausführt.
- **mengen_massenermittlung:** Fehlende, pauschale oder unklare Mengen / Stückzahlen / Abrechnungsmengen.
- **kalkulationsunsicherheit:** Unklare Aufwände, Erschwernisse, Leitungswege, Prüf-/Mess-/Protokollleistungen oder sonstige schwer kalkulierbare LV-Unschärfen.

---

## Reclassification-Tabelle

| Trigger-Titel / -Thema | Typische aktuelle Kategorie | Soll-Kategorie | Begründung |
|------------------------|-----------------------------|---------------|------------|
| Netzanschluss / Anschlussleistung ungeklärt | vertrags_lv_risiken oder technische_vollstaendigkeit | **kalkulationsunsicherheit** | Unklare Anschlussleistung/Netzanschluss betrifft direkt Aufwand und Kalkulation, nicht primär Vertragstext oder fehlende Bauteilbeschreibung. |
| Leitungswege unbekannt / nicht eindeutig | technische_vollstaendigkeit oder mengen_massenermittlung | **kalkulationsunsicherheit** | Leitungswege beeinflussen Mengen, Verlegung und Aufwand; schwer kalkulierbar, keine reine Mengenangabe. |
| Leistungsbeschreibung pauschal ohne Mengen | vertrags_lv_risiken oder schnittstellen_nebenleistungen | **mengen_massenermittlung** | Kern ist fehlende/pauschale Mengenangabe; Abrechnungs- und Mengenrisiko. |
| Stückzahlen ungeklärt | mengen_massenermittlung oder technische_vollstaendigkeit | **mengen_massenermittlung** | Passt bereits; ggf. von technische_vollstaendigkeit umhängen, wenn fälschlich dort. |
| Beleuchtung / Lux / Leuchtenliste fehlt | technische_vollstaendigkeit | **technische_vollstaendigkeit** oder **kalkulationsunsicherheit** | Fehlende Leuchtenliste = fehlender technischer Bestandteil → technische_vollstaendigkeit. Wenn Fokus „unklare Anzahl/Planung“: kalkulationsunsicherheit. |
| Anzahl UV ungeklärt | technische_vollstaendigkeit oder mengen_massenermittlung | **mengen_massenermittlung** oder **kalkulationsunsicherheit** | Unklare Stückzahl/Anzahl → mengen_massenermittlung; wenn eher Aufwands-/Planungsunsicherheit → kalkulationsunsicherheit. |
| Leitungsquerschnitte unbestimmt | technische_vollstaendigkeit | **kalkulationsunsicherheit** | Unbestimmte Querschnitte = Material- und Aufwandsunsicherheit, schwer kalkulierbar; kein reines „Bauteil fehlt“. |
| Rohrdämmung nicht beschrieben / unklar | technische_vollstaendigkeit | **technische_vollstaendigkeit** oder **kalkulationsunsicherheit** | Fehlende Dämmungsbeschreibung = technische Lücke → technische_vollstaendigkeit; wenn Umfang/Art unklar und kalkulationsrelevant → kalkulationsunsicherheit. |
| Schallschutzanforderungen fehlen / unkonkret | technische_vollstaendigkeit | **technische_vollstaendigkeit** | Fehlende oder unkonkret formulierte technische Anforderung. |
| Prüfaufwand / Protokolle unklar | vertrags_lv_risiken oder technische_vollstaendigkeit | **kalkulationsunsicherheit** | Prüf-/Protokollleistungen sind Aufwand und schwer kalkulierbar; kein reines Vertrags- oder Vollständigkeitsrisiko. |
| Hebeanlage / Alarmierung / Pumpensumpf unklar | technische_vollstaendigkeit oder schnittstellen_nebenleistungen | **technische_vollstaendigkeit** oder **kalkulationsunsicherheit** | Wenn „Hebeanlage fehlt/unklar“ als Systembestandteil → technische_vollstaendigkeit; wenn Fokus Aufwand/Umfang → kalkulationsunsicherheit. Schnittstelle nur, wenn Abgrenzung zu anderem Gewerk im Vordergrund. |
| Kernbohrungen nicht beschrieben / unklar | schnittstellen_nebenleistungen oder technische_vollstaendigkeit | **kalkulationsunsicherheit** oder **schnittstellen_nebenleistungen** | Kernbohrungen = Aufwand und oft gewerkeübergreifend. Wenn „wer macht’s“ unklar → schnittstellen_nebenleistungen; wenn Aufwands-/Mengenunsicherheit → kalkulationsunsicherheit. |
| Brandschutzabschottungen unklar | technische_vollstaendigkeit oder schnittstellen_nebenleistungen | **schnittstellen_nebenleistungen** oder **kalkulationsunsicherheit** | Oft Abgrenzung Bau/TGA/Elektro; wenn „wer“ unklar → schnittstellen_nebenleistungen. Wenn Umfang/Aufwand unklar → kalkulationsunsicherheit. |
| Tiefbau / Erdarbeiten unklar | schnittstellen_nebenleistungen oder vertrags_lv_risiken | **schnittstellen_nebenleistungen** oder **kalkulationsunsicherheit** | Typisch Schnittstelle Tiefbau/TGA; Aufwand schwer kalkulierbar → ggf. kalkulationsunsicherheit. |
| Blitzschutz-Einbindung unklar | technische_vollstaendigkeit | **schnittstellen_nebenleistungen** oder **technische_vollstaendigkeit** | Wenn Abgrenzung Blitzschutz/Elektro unklar → schnittstellen_nebenleistungen; wenn technische Anforderung fehlt → technische_vollstaendigkeit. |
| BKA-Sensorik / Raumthermostate Abgrenzung | technische_vollstaendigkeit oder schnittstellen_nebenleistungen | **schnittstellen_nebenleistungen** | Klassische Abgrenzung MSR/Elektro/Heizung; „wer liefert/installiert was“. |
| Heizwasseraufbereitung nicht beschrieben | technische_vollstaendigkeit | **technische_vollstaendigkeit** | Normativ erforderliche technische Komponente fehlt in der Beschreibung. |
| Vorleistungen anderer Gewerke nicht definiert | schnittstellen_nebenleistungen | **schnittstellen_nebenleistungen** | Passt; nur prüfen, ob fälschlich anders kategorisiert. |
| Bauseits-Leistungen unklar | vertrags_lv_risiken oder schnittstellen_nebenleistungen | **schnittstellen_nebenleistungen** | Unklarheit, wer (AG/Bau) was liefert = Schnittstelle. |
| Vollständigkeitsklauseln / „alles inbegriffen“ | vertrags_lv_risiken | **vertrags_lv_risiken** | Echte Vertrags-/Abgrenzungsrisiken; Beibehaltung. |
| Weiche Formulierungen (bauseits, optional, nach Aufwand) | vertrags_lv_risiken | **vertrags_lv_risiken** | Vertrags-/Formulierungsrisiko; SYS-Check bleibt hier. |
| Dokumentation / Revisionsunterlagen unklar | technische_vollstaendigkeit oder vertrags_lv_risiken | **kalkulationsunsicherheit** | Dokumentationsaufwand schwer kalkulierbar; Aufwandsrisiko. |
| Inbetriebnahme / Abnahme nicht abgegrenzt | vertrags_lv_risiken oder technische_vollstaendigkeit | **kalkulationsunsicherheit** oder **vertrags_lv_risiken** | Wenn Abgrenzung/Umgang unklar → vertrags_lv_risiken; wenn Aufwand/Umfang unklar → kalkulationsunsicherheit. |

---

## Kurz-Zuordnung nach Soll-Kategorie

**vertrags_lv_risiken:** Vollständigkeitsklauseln, weiche Formulierungen, ggf. Abgrenzung Inbetriebnahme/Abnahme (wenn vertraglich).

**technische_vollstaendigkeit:** Heizwasseraufbereitung, Schallschutz fehlt, ggf. Beleuchtung/Leuchtenliste fehlt, Hebeanlage/System fehlt, Blitzschutz (wenn technische Anforderung).

**schnittstellen_nebenleistungen:** Bauseits/Vorleistungen unklar, Brandschutzabschottung (wer), BKA-Sensorik/Raumthermostate-Abgrenzung, Tiefbau/Erdarbeiten (Abgrenzung), Blitzschutz (Abgrenzung).

**mengen_massenermittlung:** Pauschale Leistung ohne Mengen, Stückzahlen/Anzahl UV ungeklärt (wenn reine Mengenfrage).

**kalkulationsunsicherheit:** Netzanschluss/Anschlussleistung, Leitungswege, Leitungsquerschnitte, Prüfaufwand/Protokolle, Dokumentation/Revision, Kernbohrungen (Aufwand), Brandschutz (Umfang/Aufwand), Tiefbau (Aufwand), ggf. Inbetriebnahme/Abnahme (Aufwand).

---

## Umsetzungshinweis

- **Kein Code/DB-Update in diesem Schritt.** Die Tabelle dient als fachliche Vorlage.
- Beim Update in Supabase: Trigger anhand des **Namens** (oder Export mit ID) identifizieren und Spalte `category` auf die **Soll-Kategorie** setzen.
- Bei CSV-Import: Spalte „Risikokategorie“ / „category“ mit dem Soll-Key (z. B. `kalkulationsunsicherheit`) befüllen; Import-Logik akzeptiert bereits die 5 Keys.
