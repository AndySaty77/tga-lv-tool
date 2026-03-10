# Nachtragspotenzial – Kommerzielle Maßnahmen aus ChangePotentialItems

**Stand:** Ableitung von Rückfragen, Angebotsklarstellungen, Kalkulationshinweisen und Claim-Monitoring aus der neuen Nachtragspotenzial-Engine. Additiv; bestehende Trigger-/Risiko-Logik bleibt, CP wird bei Duplikaten bevorzugt.

---

## 1. Bestehende Stellen (vor der Erweiterung)

| Bereich | Logik | Quelle | Frontend |
|--------|--------|--------|----------|
| **Rückfragen** | `generateClarificationQuestions()` in lib/clarificationQuestions.ts | Findings (Trigger), RiskClauses (Vortext), fehlende KeyFacts | Tab „Rückfragen“, Button „Rückfragen generieren“, byGroup (technisch/vertraglich/terminlich) |
| **Angebotsklarstellungen** | `generateOfferAssumptions()` in lib/offerAssumptions.ts | Findings, RiskClauses, KeyFacts, clarificationQuestions | Tab „Angebotsklarstellungen“, Button „Annahmen generieren“, byGroup |
| **Nachtragspotenzial (alt)** | Legacy Opportunity-Liste (cluster, title, reason) | runRuleBasedBaseline / jetzt Engine → Legacy-Mapping | Tab „Nachtragspotenzial“, keine direkte Ableitung zu Rückfragen/Klarstellungen |

**Überschneidungen:** Trigger-Findings und RiskClauses fließen sowohl in Rückfragen als auch in Annahmen; fehlende KeyFacts erzeugen Rückfragen und ggf. Standard-Annahmen. Bisher keine Verbindung zur Nachtragspotenzial-Engine (ChangePotentialItems).

---

## 2. Neue Ableitung: deriveCommercialActionsFromChangePotential

**Datei:** lib/changePotentialCommercialActions.ts

**Funktion:** `deriveCommercialActionsFromChangePotential(summary: ChangePotentialSummary | null) → CommercialActionsFromChangePotential`

**Regeln:**
- `recommendedAction === "rueckfrage"` → Eintrag in **questions** (Text aus questionDraft, sonst reasoning, sonst title)
- `recommendedAction === "angebotsklarstellung"` → Eintrag in **clarifications** (clarificationDraft, sonst reasoning, sonst title)
- `recommendedAction === "kalkulatorisch_absichern"` → Eintrag in **pricingHints** (pricingHint, sonst reasoning, sonst title)
- `recommendedAction === "claim_feld_beobachten"` → Eintrag in **monitoringHints** (title + reason)
- `recommendedAction === "nicht_verfolgen"` → kein Eintrag (nur intern kennzeichnbar)

**Quellenbezug:** Jeder Eintrag enthält itemId, sourceType, sourcePath, sourceQuote (soweit vom Item gesetzt).

**Deduplizierung innerhalb der Ableitung:**  
`dedupeBySimilarity()` mit Schwellen 0,72 (Wort-Überlappung): sehr ähnliche Texte werden zusammengeführt, nur ein Eintrag bleibt.

---

## 3. Merge mit bestehender Rückfragen-/Klarstellungs-Logik

**Rückfragen (clarification-questions):**
- **Input:** findings, riskClauses, keyFacts, optional **changePotentialSummary**
- **Ablauf:** Wenn changePotentialSummary vorhanden → CP-Rückfragen ableiten und zuerst in die Liste aufnehmen. Anschließend Trigger-Fragen (Findings, RiskClauses, KeyFacts). Jede Trigger-Frage wird nur übernommen, wenn **nicht** `isSimilarToExistingQuestion(triggerQuestion, cpQuestionTexts)` (Schwelle 0,65). Damit werden Dubletten vermieden und die präzisere CP-Variante bevorzugt.
- **Erweiterung am Typ:** ClarificationQuestion hat optional **sourceChangePotentialItemId** (Verweis auf ChangePotentialItem).

**Angebotsklarstellungen (offer-assumptions):**
- **Input:** findings, riskClauses, keyFacts, clarificationQuestions, optional **changePotentialSummary**
- **Ablauf:** Wenn changePotentialSummary vorhanden → CP-Klarstellungen als Annahmen am Anfang ergänzen. Danach Trigger-Annahmen (Findings, RiskClauses, KeyFacts, Rückfragen). Jede Trigger-Annahme wird nur übernommen, wenn **nicht** `isSimilarToExistingClarification(assumption, existingClarificationTexts)` (Schwelle 0,65). CP-Text wird bevorzugt.
- **Erweiterung am Typ:** OfferAssumption hat optional **sourceChangePotentialItemId**.

---

## 4. API / Ergebnis-Felder (additiv)

**POST /api/change-order-analysis**  
- **Bestehend:** opportunities, byCluster, debug, changePotentialSummary  
- **Neu:** **commercialActionsFromChangePotential** (sofern vorhanden)  
  - `questions`: CommercialQuestion[] (id, question, reason, severity, itemId, sourceType, sourcePath, sourceQuote, fieldType, changeMechanism)  
  - `clarifications`: CommercialClarification[]  
  - `pricingHints`: CommercialPricingHint[]  
  - `monitoringHints`: CommercialMonitoringHint[]  

**POST /api/clarification-questions**  
- **Request:** body um optional **changePotentialSummary** ergänzt  
- **Response:** unverändert (questions, byGroup, debug); Inhalt ist ggf. gemergt (CP zuerst, dann Trigger ohne Duplikate)

**POST /api/offer-assumptions**  
- **Request:** body um optional **changePotentialSummary** ergänzt  
- **Response:** unverändert (assumptions, byGroup, debug); Inhalt ist ggf. gemergt (CP-Klarstellungen zuerst, dann Trigger ohne Duplikate)

---

## 5. Frontend

- **Nachtragspotenzial:** Nach „Nachtragspotenziale ermitteln“ wird die Response inkl. commercialActionsFromChangePotential gespeichert. Im Tab „Nachtragspotenzial“ erscheint bei neuer Engine-Ansicht ein Hinweis: „Abgeleitete Maßnahmen: X Rückfragen, Y Klarstellungen, Z Kalkulationshinweise, W Claim-Monitoring — werden beim Generieren der Tabs Rückfragen/Angebotsklarstellungen einbezogen (CP bevorzugt bei Duplikaten).“
- **Rückfragen generieren:** Beim Klick wird – falls vorhanden – **changeOrderAnalysis.changePotentialSummary** mit an die API geschickt. Die API liefert die gemergte Liste (CP + Trigger, ohne Doppelungen).
- **Annahmen generieren:** Ebenso wird changePotentialSummary mitgeschickt; die API liefert Annahmen inkl. CP-Klarstellungen, Trigger-Dubletten entfallen.

---

## 6. Deduplizierung – Kurzüberblick

| Ebene | Methode | Zweck |
|-------|--------|--------|
| **Innerhalb CP-Ableitung** | dedupeBySimilarity(items, getText, 0.72) | Mehrfach identische oder sehr ähnliche Rückfragen/Klarstellungen/Hinweise aus verschiedenen Items zu einem Eintrag zusammenführen |
| **Trigger vs. CP (Rückfragen)** | isSimilarToExistingQuestion(triggerQuestion, cpQuestions), 0.65 | Trigger-Frage weglassen, wenn bereits eine sehr ähnliche CP-Rückfrage existiert |
| **Trigger vs. CP (Annahmen)** | isSimilarToExistingClarification(assumption, existingClarificationTexts), 0.65 | Trigger-Annahme weglassen, wenn bereits eine sehr ähnliche CP-Klarstellung existiert |

Ähnlichkeit: Normalisierung (trim, lowercase, Kollabieren von Leerzeichen), Wortmenge (Wörter > 2 Zeichen), Jaccard-ähnlicher Koeffizient.

---

## 7. Was kommt aus der neuen Engine, was ist noch Legacy/Trigger?

- **Direkt aus ChangePotentialItems:**  
  Alle Einträge in commercialActionsFromChangePotential (questions, clarifications, pricingHints, monitoringHints) und die daraus in den Tabs „Rückfragen“ bzw. „Angebotsklarstellungen“ erscheinenden CP-Anteile (erkennbar an sourceChangePotentialItemId bzw. id-Präfix cpa_q_/cpa_c_/cpa_p_/cpa_m_).

- **Weiterhin Trigger-/Risiko-/KeyFact-getrieben:**  
  Rückfragen aus Findings, RiskClauses, fehlenden KeyFacts, sofern sie nicht als Dublette zu einer CP-Rückfrage entfernt wurden. Annahmen aus Findings, RiskClauses, KeyFacts, Rückfragen, sofern nicht als Dublette zu einer CP-Klarstellung entfernt wurden.

- **Führend:**  
  Bei inhaltlicher Überschneidung ist die Variante aus der Nachtragspotenzial-Engine (ChangePotentialItem mit questionDraft/clarificationDraft/pricingHint/reasoning) maßgeblich; die Trigger-Variante entfällt in diesem Fall.

---

## 8. Geänderte/neu angelegte Dateien

| Datei | Änderung |
|-------|----------|
| **lib/changePotentialCommercialActions.ts** | **Neu.** deriveCommercialActionsFromChangePotential, Typen CommercialQuestion/Clarification/PricingHint/MonitoringHint, dedupeBySimilarity, isSimilarToExistingQuestion, isSimilarToExistingClarification |
| **lib/changeOrderAnalysis.ts** | commercialActionsFromChangePotential im Result, Aufruf deriveCommercialActionsFromChangePotential(summary), Export CommercialActionsFromChangePotential |
| **app/api/change-order-analysis/route.ts** | commercialActionsFromChangePotential in Response aufnehmen |
| **lib/clarificationQuestions.ts** | changePotentialSummary im Input, CP-Rückfragen ableiten und vorne einfügen, Trigger-Fragen nur wenn nicht isSimilarToExistingQuestion, ClarificationQuestion.sourceChangePotentialItemId |
| **lib/offerAssumptions.ts** | changePotentialSummary im Input, CP-Klarstellungen als Annahmen vorne, Trigger-Annahmen nur wenn nicht isSimilarToExistingClarification, OfferAssumption.sourceChangePotentialItemId |
| **app/api/clarification-questions/route.ts** | body.changePotentialSummary lesen und an generateClarificationQuestions übergeben |
| **app/api/offer-assumptions/route.ts** | body.changePotentialSummary lesen und an generateOfferAssumptions übergeben |
| **app/admin/score/page.tsx** | State changeOrderAnalysis um commercialActionsFromChangePotential erweitert; bei POST clarification-questions und POST offer-assumptions changePotentialSummary mit senden |
| **components/NachtragspotenzialBlock.tsx** | analysis.commercialActionsFromChangePotential, Anzeige „Abgeleitete Maßnahmen“ mit Anzahlen und Hinweis auf Tabs Rückfragen/Angebotsklarstellungen |

---

## 9. Nicht umgesetzt (laut Vorgabe)

- LLM für diese Ableitung weder neu angebunden noch umgebaut  
- Keine Persistenz  
- Legacy-Strukturen (opportunities, byCluster, Trigger-Logik) nicht gelöscht  
- Kein großer UI-Refactor; nur additive Hinweise und Anbindung der bestehenden Tabs
