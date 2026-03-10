# Nachtragspotenzial – Kommerzielle Handlungsempfehlung (KI-Strategie pro Fund)

**Stand:** Einführung einer optionalen KI-Auswertung pro ChangePotentialItem: Bewertung der **kommerziellen Strategie** (nicht der Felderkennung). Die regelbasierte Engine bleibt führend; es werden keine neuen Items erfunden.

---

## 1. Neu eingeführte Felder

### An ChangePotentialItem (additiv)

- **`commercialStrategy?: CommercialStrategy`** – optional; nur gesetzt, wenn die KI-Strategie für dieses Item erfolgreich berechnet wurde.

### Typ CommercialStrategy

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| **primaryAction** | `"rueckfrage"` \| `"angebotsklarstellung"` \| `"kalkulatorisch_absichern"` \| `"claim_feld_beobachten"` \| `"nicht_aktiv_ansprechen"` | Primäre Vorgehensweise |
| **secondaryAction** | wie primaryAction (optional) | Zweitbeste alternative Strategie |
| **riskIfUnaddressed** | `"niedrig"` \| `"mittel"` \| `"hoch"` | Risiko, wenn das Thema gar nicht adressiert wird |
| **riskIfAddressedTooEarly** | `"niedrig"` \| `"mittel"` \| `"hoch"` | Risiko bei zu früher/zu offensiver Adressierung |
| **strategyReasoning** | string | 1–3 kurze Sätze: Warum diese Strategie sinnvoll ist |
| **negotiationSensitivity** | `"niedrig"` \| `"mittel"` \| `"hoch"` (optional) | Verhandlungsempfindlichkeit |
| **handlingRecommendation** | string (optional) | Kurz: Umgang für Kalkulator/Vertrieb/Projektleiter |
| **internalNote** | string (optional) | Interne Anmerkung |

Definition: **lib/changePotentialModel.ts** (CommercialStrategy, CommercialStrategyPrimaryAction, CommercialStrategyRiskLevel).

---

## 2. Wo die KI-Strategie berechnet wird

- **Modul:** **lib/changePotentialCommercialStrategy.ts**
  - **Funktion:** `enrichChangePotentialWithCommercialStrategy(summary: ChangePotentialSummary): Promise<ChangePotentialSummary>`
  - Items werden nach **Impact** und **Enforceability** gerankt; nur die **wichtigsten Items** werden an die KI geschickt (siehe Abschnitt 3).
  - Pro Item ein eigener LLM-Aufruf mit strukturierter JSON-Ausgabe (primaryAction, riskIfUnaddressed, riskIfAddressedTooEarly, strategyReasoning, optional secondaryAction, handlingRecommendation, internalNote).
  - Ergebnis wird in `summary.items` nur für die Items eingetragen, für die eine gültige Antwort geparst werden konnte.

- **Einbindung in die Pipeline:** **lib/changeOrderAnalysis.ts**
  - Nach der optionalen LLM-Veredelung (`refineChangePotentialWithLlm`) und **vor** dem Legacy-Mapping wird `enrichChangePotentialWithCommercialStrategy(summary)` aufgerufen.
  - Der Aufruf liegt in einem **try/catch**: Bei Fehler wird nur geloggt; die Pipeline läuft mit der bisherigen Summary weiter (kein Abbruch).

- **Aktivierung:** Die Strategie-Anreicherung läuft nur, wenn
  - `CHANGE_POTENTIAL_COMMERCIAL_STRATEGY_ENABLED=true` und
  - `OPENAI_API_KEY` gesetzt ist.

---

## 3. Maximale Anzahl bewerteter Items

- Es werden maximal **6 Items** pro Analyse mit der KI bewertet (Konstante `MAX_ITEMS_FOR_STRATEGY` in **lib/changePotentialCommercialStrategy.ts**).
- Auswahl: Die Items werden nach **impactLevel** (sehr_hoch > hoch > mittel > niedrig) und **enforceability** (sehr_gut > gut > mittel > schwach) sortiert; die **Top 6** erhalten einen LLM-Aufruf.
- Eine Anpassung auf 5–8 Items ist durch Ändern von `MAX_ITEMS_FOR_STRATEGY` möglich.

---

## 4. Fallback-Verhalten

- **LLM nicht aktiv / Env nicht gesetzt:** `enrichChangePotentialWithCommercialStrategy` gibt die Summary unverändert zurück; keine Items erhalten `commercialStrategy`.
- **Timeout pro Item:** Pro Item gilt ein Timeout (z. B. 5 s). Bei Überschreitung wird für dieses Item kein `commercialStrategy` gesetzt; die übrigen Items werden weiter verarbeitet (`Promise.allSettled`).
- **Parse-Fehler / ungültiges JSON:** Für das betroffene Item wird kein `commercialStrategy` gesetzt; die restliche Pipeline läuft normal weiter.
- **Fehler in der Anreicherung (z. B. API-Fehler):** Der gesamte Aufruf in `changeOrderAnalysis` fängt den Fehler im catch; die **bisherige** Summary (ohne Strategie-Anreicherung) wird für Legacy-Mapping und Response verwendet. Es gibt keinen Abbruch der Route.

---

## 5. UI-Darstellung

- **Komponente:** **components/NachtragspotenzialBlock.tsx**
- Pro Item mit `item.commercialStrategy` wird ein zusätzlicher Block angezeigt:
  - **Standardmodus (kompakt):** Primäre Strategie, Risiko bei Nicht-Adressierung, Risiko bei zu offensiver Adressierung, strategische Begründung.
  - **Expertenmodus (vollständiger):** Zusätzlich alternative Strategie (secondaryAction), Umgang (handlingRecommendation), interne Anmerkung (internalNote).

---

## 6. Abhängigkeiten

- **Modell:** `changePotentialModel.ts` (CommercialStrategy, Anbindung an ChangePotentialItem).
- **Pipeline:** `changeOrderAnalysis.ts` (einmaliger Aufruf nach LLM-Veredelung, in try/catch).
- **UI:** `NachtragspotenzialBlock.tsx` (Darstellung pro Item, Standard- vs. Expertenmodus).

Die bestehenden Bausteine (Rückfragen, Angebotsklarstellungen, Kalkulationshinweise, Claim-/Monitoring-Hinweise, optionale KI-Veredelung für Textfelder) bleiben unverändert; die kommerzielle Strategie ist eine **additive** KI-Stufe auf Basis der bereits erkannten ChangePotentialItems.
