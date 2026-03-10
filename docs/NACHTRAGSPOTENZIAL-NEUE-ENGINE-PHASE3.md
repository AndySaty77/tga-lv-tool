# Nachtragspotenzial – Neue Engine (Phase 3)

**Stand:** Umsetzung der fachlich neuen Kernlogik auf Basis des internen Modells ChangePotentialItem / ChangePotentialSummary. API und UI unverändert (Legacy-Mapping).

---

## 1. Geänderte / neue Dateien

| Datei | Status | Inhalt |
|-------|--------|--------|
| **lib/changePotentialModel.ts** | **Neu** | Typen ChangePotentialItem, ChangePotentialSummary; Feldtypen, Mechanismen, Impact, Enforceability, RecommendedAction; Muster (PATTERNS + TRADE_PATTERNS + KEYFACT_PATTERNS); runChangePotentialEngine(); mergeItems(); mapChangePotentialSummaryToLegacy(). |
| **lib/changeOrderAnalysis.ts** | **Angepasst** | Import von runChangePotentialEngine + mapChangePotentialSummaryToLegacy; runChangeOrderAnalysis nutzt neue Engine als Baseline, Legacy-Mapping für opportunities/byCluster; getChangePotentialSummary() neu; runRuleBasedBaseline als @deprecated markiert. |

---

## 2. Ersetzte / umgeleitete alte Kernlogik

| Alt | Neu |
|-----|-----|
| **runRuleBasedBaseline(input)** | Wird in runChangeOrderAnalysis **nicht mehr aufgerufen**. Stattdessen: runChangePotentialEngine(input) → ChangePotentialSummary → mapChangePotentialSummaryToLegacy(summary) → „baseline“. runRuleBasedBaseline bleibt exportiert und @deprecated. |
| **NACHTRAG_SOURCES (25 Quellen) + matchSource + findingToCluster** | Ersetzt durch fachliche Muster in changePotentialModel (PATTERNS, TRADE_PATTERNS, KEYFACT_PATTERNS). Keine 1:1-Abhängigkeit mehr von einzelnen Findings; Evidenzen (Findings, RiskClauses, Vortext, Positionen) werden einheitlich gescannt. |
| **Opportunity-Erzeugung pro Finding / RiskClause / KeyFact** | Einheitliche Erkennung über Muster auf aggregiertem Text + pro Quelle (vortext, position, findings, riskClauses, keyFacts); Zusammenführung über mergeItems (fieldType + changeMechanism + Ähnlichkeit). |
| **Deduplizierung** | Alte deduplicate() bleibt für die **gemergte** Liste (Engine-Opportunities + LLM-Opportunities) im Legacy-Format. Zusätzlich: mergeItems() im neuen Modell fasst mehrere Evidenzen für dasselbe Nachtragsfeld zusammen. |

---

## 3. Neues intern führendes Modell

- **ChangePotentialItem:**  
  id, title, trade?, category?, sourceType (vortext|position|remark|addtext|global|unknown), sourcePath?, sourceQuote?, sourcePositionRef?, fieldType (12 Werte), changeMechanism (9 Werte), impactLevel (niedrig|mittel|hoch|sehr_hoch), enforceability (schwach|mittel|gut|sehr_gut), confidence, recommendedAction (5 Werte), reasoning, questionDraft?, clarificationDraft?, pricingHint?, tags?, legacySource?, evidenceIds?.

- **ChangePotentialSummary:**  
  overallIndex, totalItems, highImpactCount, veryHighImpactCount, strongEnforceabilityCount, items (ChangePotentialItem[]), topFields, topMechanisms.

- **Ablauf:**  
  runChangePotentialEngine(input) scannt Vortext, lvPositions, Findings, RiskClauses, fehlende KeyFacts; erzeugt Items pro Muster-Treffer; mergeItems() fasst Dubletten zusammen; gibt Summary zurück. runChangeOrderAnalysis ruft die Engine auf und mappt Summary.items über mapChangePotentialSummaryToLegacy() auf ChangeOrderOpportunity[] (und byCluster) für API/UI.

---

## 4. Legacy-Kompatibilität (Mapping)

- **API** `POST /api/change-order-analysis`: Request/Response unverändert (opportunities, byCluster, debug).
- **Mapping:**  
  - fieldType → cluster: schnittstelle→schnittstelle; nebenleistung/mengenrisiko→leistungsmehrung; bestand_erschwernis/provisorium/bauablauf→erschwernis; sonst→leistungsaenderung.  
  - impactLevel → potential (sehr_hoch/hoch→high, mittel→medium, niedrig→low).  
  - enforceability → assertiveness (sehr_gut/gut→stark, mittel→mittel, schwach→schwach).  
  - reason = reasoning; sourceTextSnippets = [sourceQuote]; sourceFindingIds = evidenceIds; sourceType = [sourceTypeToLegacy(sourceType)] (vortext/position/…→preface, global→finding).

---

## 5. Aktive fachliche Muster

**Allgemein (ohne Gewerk):**  
Leistungsabgrenzung unklar, Nebenleistungen pauschal, Schnittstellen/Gewerke/bauseits unklar, Vorleistungen anderer Gewerke, Bestand/Erschwernis/Zugänglichkeit, Bauzeit/Bauabschnitte/Taktung, Provisorien/Bauzwischenzustände, Inbetriebnahme/Abnahme/Dokumentation/Einregulierung/Druckprüfung/Spülung/Wartung unklar, normative Anforderungen implizit, Mengen/Massen/Dimensionen unklar, Hersteller-/Systemvorgaben, Brand-/Schall-/Dämmung/Leitungswege.

**Gewerke:**  
Heizung (Hydraulik/Abgleich), Sanitär (Dichtheitsprüfung/Spülung), Lüftung (Schächte bauseits, Kanallängen), Kälte (IBN/Kältemittel), Elektro/MSR (GA-Schnittstellen, Hersteller/Typen).

**KeyFacts (Fehlen = Item):**  
bauzeit, baubeginn, fertigstellung, ausfuehrungsfrist, wartung_instandhaltung.

---

## 6. Legacy-LLM aus produktiver Pipeline (März 2025)

**Ziel:** Nur noch ein führender Strang für Nachtragspotenzial; keine parallele Legacy-LLM-Mischung in den finalen Opportunities/byCluster.

**Änderungen in lib/changeOrderAnalysis.ts:**

- **Produktive Pipeline (einziger führender Strang):**  
  `runChangePotentialEngine` → optional `refineChangePotentialWithLlm` → `mapChangePotentialSummaryToLegacy` → `opportunities` / `byCluster`.  
  Die alte `runLlmChangeOrderAnalysis` (Legacy-LLM) wird **nicht mehr** in `merged`/`deduped` gemischt.

- **Legacy-LLM nur noch Debug/Vergleich:**  
  Wenn `input.useLlm` gesetzt ist, wird `runLlmChangeOrderAnalysis` weiterhin aufgerufen; das Ergebnis fließt nur in `debug.llmCount` (und ggf. zukünftig in ein optionales `debug.legacyLlmOpportunities`). Es wird **nicht** zu `opportunities`/`byCluster` hinzugefügt.

- **Debug-Metadaten (additiv):**  
  `debug.usedChangePotentialLlm` (boolean): ob die neue LLM-Veredelung (`refineChangePotentialWithLlm`) ausgeführt wurde.  
  `debug.usedLegacyLlm` (boolean): ob die Legacy-LLM für Debug/Vergleich lief.

- **Deduplizierung:**  
  `deduplicate(merged)` arbeitet nur noch auf `baseline` (Engine + optionale neue LLM-Veredelung), da `merged = baseline`.

**Status von runLlmChangeOrderAnalysis:**  
Existiert weiterhin; wird nur noch bei `input.useLlm` aufgerufen und dient ausschließlich Debug/Vergleich (Anzahl in `debug.llmCount`). Nicht deprecated entfernt, um Vergleichsmöglichkeiten zu erhalten.

**Kommerzielle Handlungsempfehlung (KI-Strategie pro Item):**  
Optional kann nach der LLM-Veredelung eine weitere Anreicherung laufen: `enrichChangePotentialWithCommercialStrategy` bewertet pro Item (Top 5–8) die kommerzielle Strategie (primaryAction, Risiken, Begründung). Details: **docs/NACHTRAGSPOTENZIAL-COMMERCIAL-STRATEGY.md**.

**Top-Verhandlungspunkte (Cluster):**  
`buildNegotiationClusters` bündelt verwandte Items zu 3–5 übergeordneten Verhandlungspunkten (regelbasierte Vorclusterung, optionale KI-Verdichtung/Benennung). Summary-Feld `negotiationClusters`. Details: **docs/NACHTRAGSPOTENZIAL-NEGOTIATION-CLUSTERS.md**.

**Management Summary + Strategievarianten (Dokumentebene):**  
`buildOfferStrategySummary` erzeugt eine knappe Executive Summary und drei Strategievarianten (defensiv/ausgewogen/offensiv) nur auf Basis der bestehenden CP-Ergebnisse. Ergebnis-Feld `offerStrategySummary`. Details: **docs/NACHTRAGSPOTENZIAL-OFFER-STRATEGY-SUMMARY.md**.

**API/UI:**  
Keine Breaking Changes; Response-Struktur (opportunities, byCluster, debug) unverändert; optionale Felder changePotentialSummary, commercialActionsFromChangePotential, offerStrategySummary additiv. Bestehende UI (z. B. „Regeln / KI / Nach Bereinigung“) zeigt weiterhin `ruleBasedCount`, `llmCount`, `deduplicatedCount`; `llmCount` ist bei produktivem Lauf ohne Legacy-Mischung 0, sofern nicht explizit `useLlm` für Vergleich gesetzt wurde.

---

## 7. Transparente KI-Veredelung (Statusanzeige, März 2025)

**Ziel:** Im UI erkennbar machen, ob die KI-Veredelung tatsächlich lief oder warum sie bei gesetzter Checkbox nicht aktiv war.

**Ergänzte Debug-Felder (additiv, in `result.debug` / API-Response):**

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `requestedChangePotentialLlm` | boolean | Request hat KI-Veredelung angefordert (useChangePotentialLlm bzw. Fallback useLlm). |
| `usedChangePotentialLlm` | boolean | refineChangePotentialWithLlm wurde ausgeführt. |
| `changePotentialLlmAvailable` | boolean | Serverseitig sind Env (`CHANGE_POTENTIAL_LLM_ENABLED=true`) und API-Key gesetzt. |
| `reasonIfNotUsed` | `"disabled_by_env" \| "missing_api_key" \| "not_requested" \| "error" \| null` | Wenn angefordert, aber nicht ausgeführt: (erster) Grund für UI-Meldung. |
| `changePotentialLlmEnvEnabled` | boolean | Experten-Diagnose: Env-Flag entspricht exakt `"true"`. |
| `changePotentialLlmEnvRaw` | string \| null | Experten-Diagnose: Rohwert des Env-Flags (z. B. `"true"`, `"false"`, `""`, `null`). **Niemals API-Key.** |
| `openAiApiKeyPresent` | boolean | Experten-Diagnose: OPENAI_API_KEY gesetzt (nur ja/nein, **niemals Key-Wert**). |
| `reasonDetails` | `("disabled_by_env" \| "missing_api_key" \| "error")[]` | Wenn angefordert, aber nicht ausgeführt: alle zutreffenden Blocker (z. B. Env fehlt und API-Key fehlt). |

**Nicht-Aktivierungsgründe:**

- `not_requested` – Checkbox war aus bzw. Request-Flag nicht gesetzt.
- `disabled_by_env` – Checkbox war an, aber `CHANGE_POTENTIAL_LLM_ENABLED` ist nicht `"true"`.
- `missing_api_key` – Checkbox war an, aber `OPENAI_API_KEY` fehlt.
- `error` – Checkbox war an, Veredelung wurde versucht, aber LLM-Aufruf ist fehlgeschlagen (try/catch).
- `null` – Veredelung wurde ausgeführt (oder nicht angefordert und daher kein „Grund“ gesetzt).

**Mehrere Blocker:** Wenn sowohl Env-Flag fehlt als auch API-Key fehlt, enthält `reasonDetails` beide Einträge (`["disabled_by_env", "missing_api_key"]`). `reasonIfNotUsed` zeigt den ersten geprüften Grund (Env vor API-Key). Die Experten-Diagnose zeigt alle rohen Ursachen einzeln.

**UI-Anzeige (NachtragspotenzialBlock):**

- Wenn `usedChangePotentialLlm`: dezenter grüner Hinweis **„KI-Veredelung aktiv“**.
- Wenn `requestedChangePotentialLlm` und `reasonIfNotUsed` gesetzt: orangefarbener Hinweis mit Grund:
  - **„KI-Veredelung angefordert, aber serverseitig deaktiviert“** (`disabled_by_env`)
  - **„KI-Veredelung angefordert, aber kein API-Key vorhanden“** (`missing_api_key`)
  - **„KI-Veredelung angefordert, aber Fehler beim LLM-Aufruf“** (`error`)
- **Expertenmodus – KI-Veredelung Diagnose (kleine Sektion):**
  - Request angefordert: ja/nein
  - Env-Flag aktiv (CHANGE_POTENTIAL_LLM_ENABLED): ja/nein
  - Env-Rohwert: `"…"` (nur Flag-Wert, keine Secrets)
  - API-Key vorhanden: ja/nein
  - LLM tatsächlich genutzt: ja/nein
  - reasonIfNotUsed: …
  - Blocker: … (wenn `reasonDetails` gesetzt, z. B. `disabled_by_env, missing_api_key`)

**Sicherheit:** Es werden niemals API-Keys oder andere Secrets ausgegeben; nur `openAiApiKeyPresent` (boolean) und `changePotentialLlmEnvRaw` (nur die Env-Flag-Variable).

---

## 8. KI-Veredelung pro Item (llmConfidence, llmChangedFields)

**Problem:** Items zeigten teils „LLM geprüft: ja (Felder angepasst)“ und gleichzeitig „LLM-Confidence: 0 %“ – widersprüchlich, da das Prompt-Beispiel `llmConfidence: 0.0` lieferte und dieser Wert persistiert wurde.

**Ursache llmConfidence:** In `applyPatchToItem` wurde jeder numerische Wert aus dem Patch (inkl. 0) per `clamp01` übernommen. Wenn das LLM 0 oder 0.0 zurückgab (z. B. als Platzhalter), wurde `llmConfidence = 0` gesetzt und im UI als „0 %“ angezeigt.

**Anpassungen:**

- **Backend (lib/changePotentialLlmRefinement.ts):**
  - `llmConfidence` wird nur noch gesetzt, wenn `clamp01(patch.llmConfidence)` einen Wert **> 0** hat. 0/0.0 wird nicht mehr persistiert (gilt als „nicht angegeben“).
  - Beim Anwenden der Patches wird **`llmChangedFields`** (string[]) befüllt: für jede tatsächlich geänderte Eigenschaft wird der Feldname ergänzt (fieldType, changeMechanism, impactLevel, enforceability, recommendedAction, reasoning, questionDraft, clarificationDraft, pricingHint).

- **Modell (lib/changePotentialModel.ts):**
  - `ChangePotentialItem.llmChangedFields?: string[]` ergänzt.

- **UI (NachtragspotenzialBlock):**
  - **Standardmodus:** Nur dezente Zeile „KI geprüft“ bzw. „KI angepasst“ (ohne Experten-Details).
  - **Expertenmodus (nur bei LLM-Beteiligung):**
    - **KI-Confidence:** Nur anzeigen, wenn Wert vorhanden und > 0, als „xx %“; sonst „—“ (kein „0 %“ mehr).
    - **KI angepasst/geprüft:** wie zuvor, sprachlich vereinheitlicht.
    - **Geändert:** Liste der geänderten Felder aus `llmChangedFields` (kommagetrennt). Wenn `llmAdjusted` true, aber `llmChangedFields` leer/fehlt: „nicht spezifiziert“.

**Felder, die die KI-Änderungen transparent machen:** `llmChangedFields` listet genau die Eigenschaften, die der Patch geändert hat (fieldType, changeMechanism, impactLevel, enforceability, recommendedAction, reasoning, questionDraft, clarificationDraft, pricingHint). Zusammen mit **KI-Confidence** (nur wenn > 0) und **LLM-Notiz** ist die Anzeige pro Item fachlich nachvollziehbar.

---

## 9. Timeout und Fallback für KI-Veredelung

**Problem:** Die Nachtragspotenzial-Analyse konnte im Zusammenhang mit der KI-Veredelung sehr lange im Ladezustand hängen und kein Ergebnis liefern (z. B. weil der OpenAI-Call ohne Timeout lief oder das LLM sehr langsam antwortete).

**Ursache:** In `refineChangePotentialWithLlm` wird `await openai.chat.completions.create(...)` ohne Zeitbegrenzung ausgeführt. Bei Netzwerkproblemen, Überlastung oder sehr großem Kontext kann der Aufruf sehr lange dauern oder praktisch nicht fertig werden. Der Aufrufer (`runChangeOrderAnalysis`) hat gewartet, bis die Veredelung fertig war; ein Fehler wurde nur bei Exception gefangen, nicht bei Zeitüberschreitung.

**Lösung:**

- **Harter Timeout:** In `lib/changeOrderAnalysis.ts` wird die LLM-Veredelung mit `Promise.race` gegen ein Timeout-Promise (20 Sekunden) ausgeführt. Konstante: `LLM_REFINEMENT_TIMEOUT_MS = 20000`.
- **Fallback:** Wenn das Timeout gewinnt oder eine Exception geworfen wird, wird die **regelbasierte Summary unverändert** weiterverwendet; die Route antwortet trotzdem erfolgreich mit diesem Ergebnis. Die KI-Veredelung ist optionaler Bonus, nie Blocker.
- **Logging:** Intern (außer in NODE_ENV=test): Log „regelbasierte Engine fertig“ mit Dauer, „LLM-Veredelung start“, „LLM-Veredelung Ende“ mit Dauer bzw. „LLM-Veredelung Fallback“ mit Dauer, Timeout-Flag und Grund.
- **Kontext-Kürzung:** In `lib/changePotentialLlmRefinement.ts` wurden die Kontextgrößen begrenzt (siehe Abschnitt 10 für die spätere weitere Verschlankung).

**Neue Debug-Metadaten (additiv in `result.debug`):**

| Feld | Bedeutung |
|------|-----------|
| `llmRefinementTimedOut` | true, wenn die Veredelung wegen Timeout abgebrochen wurde. |
| `llmRefinementDurationMs` | Dauer in ms (gesetzt sobald Veredelung angefragt/gestartet wurde). |
| `llmRefinementFailed` | true, wenn der Aufruf fehlgeschlagen ist (Timeout oder andere Exception). |
| `llmRefinementFailureReason` | Fehlergrund (z. B. `LLM_REFINEMENT_TIMEOUT` oder Exception-Message). |

**Frontend:** Bei Timeout wird dezent „KI-Veredelung wegen Timeout übersprungen; Ergebnis basiert auf der regelbasierten Analyse.“ angezeigt; bei anderem Fehler „KI-Veredelung fehlgeschlagen; …“. Im Expertenmodus sind Dauer, Timeout und Fehlergrund in der KI-Veredelung-Diagnose sichtbar.

**Garantie:** Die Analyse-Pipeline liefert immer ein Ergebnis (regelbasiert oder veredelt). Das Frontend-Loading endet immer; es gibt keinen unbegrenzten Wartezustand mehr.

---

## 10. Verschlankung der KI-Veredelung (Performance)

**Problem:** Die KI-Veredelung lief regelmäßig ins 20-Sekunden-Timeout; der Fallback funktionierte, die KI lieferte aber faktisch keinen Mehrwert.

**Wahrscheinliche Ursachen des Timeouts:**
- Zu viele Items (bis zu 20) mit vollem Feldumfang (fieldType, changeMechanism, reasoning, questionDraft, clarificationDraft, pricingHint, sourceQuote, sourcePath, …) im Prompt.
- Großer Kontext (Vortext 3000, Positionen 2000 Zeichen) plus langes JSON-Schema und ausführliche Aufgabenbeschreibung.
- Antwort-Schema mit vielen Feldern (adjustedFieldType, adjustedChangeMechanism, adjustedRecommendedAction, improvedPricingHint, candidateItems) → hohe erwartete Output-Token-Zahl (max_tokens 3000).
- Keine Priorisierung: die ersten N Items wurden geschickt, nicht die fachlich wichtigsten.

**Eingebaute Reduktionen:**

| Bereich | Vorher | Nachher |
|--------|--------|---------|
| Max. Items an KI | 20 | **10** (nur Top-Items nach Impact + Enforceability) |
| Vortext | 3000 Zeichen | **1500** |
| LV-Positionen | 2000 Zeichen | **1000** |
| KeyFacts-Wert | 80 Zeichen | **50** |
| Pro-Item-Payload | Alle Felder inkl. sourceQuote, sourcePath, trade, fieldType, changeMechanism, recommendedAction, pricingHint | Nur **itemId, title, impactLevel, enforceability**, reasoning (max. 180 Zeichen), questionDraft (80), clarificationDraft (80) |
| Prompt-Aufgabe | Ausführliche Beschreibung + großes JSON-Schema + candidateItems | **Kurzaufgabe:** nur Plausibilität, impactLevel, enforceability, reasoning/questionDraft/clarificationDraft kurz verbessern; Schema nur items mit den genannten Feldern, **keine candidateItems** |
| max_tokens Antwort | 3000 | **2000** |

**Item-Auswahl:** Items werden nach Relevanz sortiert (Impact: sehr_hoch > hoch > mittel > niedrig; Enforceability: sehr_gut > gut > mittel > schwach), dann die **10 wichtigsten** an die KI geschickt. Unveredelte Items bleiben regelbasiert; die finale Summary setzt sich aus veredelten (wo Patch vorhanden) und unveredelten zusammen.

**Modell:** Verwendet wird `CHANGE_POTENTIAL_LLM_MODEL` oder `OPENAI_MODEL` oder Fallback **gpt-4o-mini** (schnell, für strukturierte Kurzaufgaben geeignet). Kein Wechsel zu einem anderen Modell im Code; Override per Env möglich.

**Ziel:** Typischer Lauf der LLM-Stufe **deutlich unter 20 Sekunden**, ideal 5–10 Sekunden, bei stabiler Nutzung des Timeouts als letzte Absicherung.

**Neue Debug-Felder (additiv):** In `result.debug` bzw. Experten-Diagnose: `refinedItemAttemptCount` (wie viele Items an die KI), `promptCharCount`, `contextCharCount`, `modelUsed`. So ist erkennbar, ob die Veredelung schlanker geworden ist.

---

## 11. Top-3-Einzelcall-Strategie (top3_text_only)

**Problem:** Trotz Verschlankung (Abschnitt 10) lief die KI-Veredelung weiterhin regelmäßig in den 20-Sekunden-Timeout. Ein großer Batch mit vielen Items in einem Request-Response-Lauf erwies sich als Flaschenhals.

**Entfernt/deaktivierte LLM-Logik:**
- **Ein großer Batch-Aufruf** mit bis zu 10 Items in einem LLM-Call wurde abgelöst. Es gibt keinen einzelnen Aufruf mehr, der alle Items gemeinsam mit langem Kontext (Vortext, LV-Positionen, KeyFacts) und großem Antwort-Schema verarbeitet.
- **Anpassung durch die KI an fieldType, changeMechanism, impactLevel, enforceability, recommendedAction** wurde abgeschaltet. Diese Felder kommen ausschließlich aus der regelbasierten Engine und werden von der KI nicht mehr überschrieben.
- **candidateItems** werden in diesem Modus nicht mehr erzeugt; die KI schlägt keine zusätzlichen Kandidaten-Items vor.
- Kontext aus Vortext/LV-Positionen/KeyFacts wird **nicht mehr** in die LLM-Prompts gegeben (minimaler Pro-Item-Kontext nur: Titel, kurzer Reasoning-Ausschnitt, optional sourceQuote, optional Gewerk).

**Neue Strategie – warum stabiler:**
- **Max. 3 Items** werden zur KI geschickt (Top 3 nach Ranking: impactLevel → enforceability → confidence).
- **1 kurzer LLM-Call pro Item** statt einem Batch. Jeder Call hat wenig Input (nur Titel, Reasoning-Snippet, ggf. Zitat) und erwartet nur eine kurze JSON-Antwort (reasoning, questionDraft, clarificationDraft).
- **Timeout pro Item 5,5 s** (PER_ITEM_TIMEOUT_MS). Wenn ein Item hängt, werden die anderen trotzdem ausgewertet; **Teilresultate** sind erlaubt.
- **Promise.allSettled**: Alle 3 Calls laufen parallel. Ein Fehler oder Timeout bei einem Item führt nicht zum Abbruch der anderen. Erfolgreiche Patches werden übernommen, fehlgeschlagene Items bleiben regelbasiert.
- Kein langer Vortext/Positions-Kontext mehr → geringere Latenz und weniger Risiko für Timeouts.

**Anzahl Items zur KI:** Es gehen **maximal 3** Items zur KI (die 3 relevantesten nach Impact, dann Enforceability, dann Confidence). Bei weniger als 3 Items in der Summary entsprechend weniger.

**Felder, die die KI noch verändert:** Nur noch **reasoning**, **questionDraft**, **clarificationDraft**. Alle übrigen Felder (fieldType, changeMechanism, impactLevel, enforceability, recommendedAction, pricingHint, …) bleiben vollständig regelbasiert und werden von der KI nicht angepasst.

**Debug (additiv):** `llmRefinementMode: "top3_text_only"`, `refinedItemAttemptCount`, `refinedItemSuccessCount`, `perItemTimeoutCount` (optional), `modelUsed`, `totalLlmDurationMs`. Im Expertenmodus in der KI-Veredelung-Diagnose sichtbar.

**Ergebnis:** Regelbasierte Items bleiben vollständig erhalten. Nur bei den Top-3-Items werden bei erfolgreichem LLM-Call die Texte reasoning/questionDraft/clarificationDraft ggf. überschrieben. Bei LLM-Fehlern oder Timeout liefert die Route weiterhin ein vollständiges Ergebnis (regelbasiert bzw. mit Teilveredelung).

---

## 12. Nächster sinnvoller Schritt

- **Optional:** API erweitern (z. B. Query-Parameter oder neues Feld), um bei Bedarf die rohe ChangePotentialSummary (items mit fieldType, changeMechanism, impactLevel, recommendedAction, questionDraft, clarificationDraft) an das Frontend zu liefern, ohne UI sofort umzubauen.
- **Optional:** UI schrittweise um Anzeige der neuen Felder (z. B. Empfehlung, Frage-/Klarstellungsentwurf) ergänzen, weiterhin auf gleicher API aufsetzend oder auf erweiterter Response.
- **Optional:** LLM-Ergebnisse in das neue Modell überführen (LLM liefert strukturierte Items mit fieldType/changeMechanism), dann in Summary mergen und nur noch einmal auf Legacy mappen.
- **Optional:** sourcePath/sourcePositionRef aus GAEB-Struktur (Positionen, Vorbemerkungen) befüllen für bessere Nachvollziehbarkeit.
- **Optional:** `runLlmChangeOrderAnalysis` nur noch über explizites Flag/Env (z. B. `CHANGE_ORDER_LEGACY_LLM_DEBUG`) aufrufen. (Bereits umgesetzt: Checkbox steuert useChangePotentialLlm; Legacy-LLM nur bei CHANGE_ORDER_LEGACY_LLM_DEBUG.)
- Timeout für KI-Veredelung ist 20 s (Gesamtaufruf); pro Item gilt ein Timeout von 5,5 s. Bei Überschreitung oder Fehler wird automatisch auf die regelbasierte Summary bzw. Teilresultate zurückgefallen (Abschnitte 9 und 11).
