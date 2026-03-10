# Nachtragspotenzial – Management Summary + Strategievarianten (Dokumentebene)

**Stand:** KI-Auswertung auf Dokumentebene: knappe Management Summary und drei Angebotsstrategievarianten. Nur auf Basis der bereits strukturierten Ergebnisse (ChangePotentialSummary, Items, Clusters, abgeleitete Maßnahmen). Keine freie Erkennung neuer Nachtragspotenziale.

---

## 1. Neue Struktur

### Im Analyse-Ergebnis (ChangeOrderResult / API-Response)

- **`offerStrategySummary?: OfferStrategySummary`** – optional; nur gesetzt, wenn die KI die Summary erfolgreich erzeugt hat.

### Typ OfferStrategySummary

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| **executiveSummary** | string | 5–8 Sätze: wichtigste kommerzielle Themen, Klärungsbedarf, Empfehlung Klarstellung vs. kalkulatorisch. |
| **topRisks** | string[] | Wichtigste Risiken (kurze Liste). |
| **topNegotiationPoints** | string[] | Wichtigste Verhandlungspunkte. |
| **immediateActions** | string[] | Sofortmaßnahmen vor/bei Angebotsabgabe. |
| **recommendedApproach** | "defensiv" \| "ausgewogen" \| "offensiv" | Empfohlener Gesamtansatz. |
| **strategyVariants** | object | Drei Varianten (s. u.). |
| **finalRecommendation** | string | 2–4 Sätze: welche Strategie sinnvoll ist und warum. |

### strategyVariants

Je Variante (defensiv, ausgewogen, offensiv):

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| **description** | string | Kurze Beschreibung der Strategie. |
| **expectedTradeoff** | string | Vor-/Nachteile in einem Satz. |
| **keyActions** | string[] | Konkrete empfohlene Maßnahmen. |

Definition: **lib/changePotentialModel.ts** (OfferStrategySummary, OfferStrategyApproach, OfferStrategyVariant).

---

## 2. Verwendete Inputs

Die KI erhält **ausschließlich** bereits vorliegende, strukturierte Daten:

- **ChangePotentialSummary:** overallIndex, totalItems, highImpactCount, veryHighImpactCount, strongEnforceabilityCount.
- **ChangePotentialItems (Auszug):** Titel, Hebel (impactLevel), empfohlene Aktion (recommendedAction), Kurztext reasoning (Top-N-Items).
- **NegotiationClusters (falls vorhanden):** Titel, commercialWeight, recommendedNegotiationAction, whyThisMatters.
- **CommercialActionsFromChangePotential:** Anzahl Rückfragen, Klarstellungen, Kalkulationshinweise, Claim-Monitoring; ggf. Beispieltexte (Rückfrage/Klarstellung).

Es werden **keine** Rohdaten (Vortext, Findings) direkt in den Prompt gegeben; die Verdichtung erfolgt über die bestehende Engine und abgeleiteten Maßnahmen.

---

## 3. Aufbau der Strategievarianten

- **defensiv:** Vorsichtige Positionierung, viele Klärungen vor Angebotsabgabe, kalkulatorische Absicherung.
- **ausgewogen:** Mix aus gezielten Rückfragen, Klarstellungen und kalkulatorischer Vorsorge; Balance zwischen Risiko und Aufwand.
- **offensiv:** Weniger Rückfragen, stärkere Nutzung von Angebotsklarstellungen und klaren Formulierungen; höheres Risiko, dafür schneller.

Die KI beschreibt pro Variante in 1–2 Sätzen das Vorgehen, nennt Vor-/Nachteile (expectedTradeoff) und bis zu 5 konkrete keyActions. **recommendedApproach** und **finalRecommendation** begründen, welche der drei Varianten für das vorliegende LV sinnvoll ist.

---

## 4. Wo die Summary erzeugt wird

- **Modul:** **lib/offerStrategySummary.ts**
  - **Funktion:** `buildOfferStrategySummary(summary: ChangePotentialSummary, commercialActions: CommercialActionsFromChangePotential | null): Promise<OfferStrategySummary | null>`
  - Kontext wird aus Summary + commercialActions gebaut (siehe Abschnitt 2).
  - Ein LLM-Aufruf mit strukturierter JSON-Ausgabe; Parsing und Validierung mit Fallback (ungültige Antwort → null).

- **Einbindung:** **lib/changeOrderAnalysis.ts**
  - Nach `deriveCommercialActionsFromChangePotential(summary)` wird `buildOfferStrategySummary(summary, commercialActionsFromChangePotential)` in einem **try/catch** aufgerufen.
  - Bei Fehler oder null: kein offerStrategySummary im Ergebnis; die übrige Pipeline (Opportunities, Clusters, etc.) läuft unverändert weiter.

- **Aktivierung:** Summary wird nur erzeugt, wenn
  - **CHANGE_POTENTIAL_OFFER_STRATEGY_ENABLED=true** und
  - **OPENAI_API_KEY** gesetzt ist und
  - mindestens ein ChangePotentialItem vorhanden ist.

---

## 5. Fallback

- **KI deaktiviert / API-Key fehlt:** `buildOfferStrategySummary` gibt **null** zurück; im Ergebnis erscheint kein **offerStrategySummary**.
- **KI-Fehler (Timeout, API-Fehler, Parse-Fehler):** try/catch in changeOrderAnalysis fängt den Fehler; **offerStrategySummary** wird nicht gesetzt; Analyse-Ergebnis (Opportunities, Summary, Clusters, commercialActions) bleibt unverändert.
- **UI:** Wenn **offerStrategySummary** fehlt, wird der Block „Management Summary“ / „Angebotsstrategie“ nicht angezeigt (Block leer). Die Grundfunktion (Nachtragspotenzial, Rückfragen, Klarstellungen, etc.) ist davon nicht betroffen.

---

## 6. UI

- **Komponente:** **components/NachtragspotenzialBlock.tsx**
- Neuer Block **„Management Summary“** / **„Angebotsstrategie“** (nur wenn **analysis.offerStrategySummary** vorhanden):
  - **Standardmodus (verdichtet):** Executive Summary, empfohlener Gesamtansatz (defensiv/ausgewogen/offensiv), finalRecommendation, wichtigste Sofortmaßnahmen, drei Strategievarianten kompakt (Titel + kurze Beschreibung, empfohlene Variante hervorgehoben).
  - **Expertenmodus:** Zusätzlich topRisks, topNegotiationPoints, Sofortmaßnahmen vollständig, Strategievarianten mit description, expectedTradeoff und keyActions.

---

## 7. API

- **POST /api/change-order-analysis:** Das Response-Payload enthält bei Erfolg und aktivierter KI optional **offerStrategySummary** (Objekt wie oben). Fehlt das Feld, wurde die Summary nicht erzeugt oder die KI war deaktiviert/fehlgeschlagen.

---

## 8. Abhängigkeiten

- **Modell:** changePotentialModel.ts (OfferStrategySummary, OfferStrategyApproach, OfferStrategyVariant).
- **Logik:** offerStrategySummary.ts (buildContext, buildOfferStrategySummary).
- **Pipeline:** changeOrderAnalysis.ts (Aufruf nach commercialActions, try/catch; offerStrategySummary im Return).
- **API:** app/api/change-order-analysis/route.ts (offerStrategySummary im JSON-Response).
- **UI:** NachtragspotenzialBlock.tsx (OfferStrategyBlock, Einbindung bei analysis.offerStrategySummary).

Es werden **keine neuen Nachtragspotenziale** erfunden; die Management Summary und die Strategievarianten basieren ausschließlich auf den bereits erkannten Items, Clustern und abgeleiteten Maßnahmen.
