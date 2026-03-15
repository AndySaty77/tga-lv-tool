# LLM/KI-Bestandsaufnahme – LV Scope Analyse-Logik

**Stand:** Technische Bestandsaufnahme ohne Codeänderungen.  
**Ziel:** Exakte Fundstellen, wo LLM/KI in der TGA-Leistungsverzeichnis-Analyse eingesetzt wird, um Doppelbau bei neuer LLM-Validierung zu vermeiden.

---

## 1. Relevante Dateien

| Datei | Zweck (LLM/KI) |
|-------|-----------------|
| **`app/api/analyze-vortext/route.ts`** | Vortext-Analyse: KeyFacts + RiskClauses per LLM (llmExtract, llmRepairKeyFacts, llmKeyFactsFallback). |
| **`app/api/score/route.ts`** | Score-Pipeline: optional `analyzeLvTextWithLLM` für Findings (useLlmRelevance). Kein eigener LLM-Call, ruft lib auf. |
| **`lib/llmRelevanceFilter.ts`** | LLM-Recherche im LV-Text: eigenständige Finding-Erkennung ohne Trigger. |
| **`lib/changeOrderAnalysis.ts`** | Nachtragspotenzial: Legacy-LLM `runLlmChangeOrderAnalysis` (nur Debug); Orchestrierung von `refineChangePotentialWithLlm`. |
| **`lib/changePotentialLlmRefinement.ts`** | LLM-Veredelung der ChangePotential-Items: Top-3-Items, nur Textfelder (reasoning, questionDraft, clarificationDraft). |
| **`lib/offerStrategySummary.ts`** | Management-/Strategie-Summary auf Basis ChangePotential: executiveSummary, Varianten, Empfehlung (Offer Strategy LLM). |
| **`lib/changePotentialCommercialStrategy.ts`** | Pro Nachtragsfeld: kommerzielle Strategiebewertung (Strategie, Handling, interne Notiz). |
| **`lib/changePotentialNegotiationClusters.ts`** | Verhandlungscluster: regelbasierte Vorclusterung, LLM für Titel/Benennung/Empfehlung pro Bucket. |
| **`app/api/offer-assumptions/route.ts`** | Angebotsannahmen: regelbasiert erzeugt, optional `llmRefineAssumptions` zur Textoptimierung. |
| **`app/api/gaeb-split-llm/route.ts`** | GAEB-Split: LLM findet Marker für Trennung Vortext / Positions-Teil (kein Analyse-Inhalt). |
| **`app/api/admin/ai-status/route.ts`** | Status-Check: ob OPENAI_API_KEY gesetzt (kein Modell-Call). |

**Nicht LLM:**  
- `lib/managementSummary.ts` – Management Summary rein regelbasiert (Score, Findings, Texte).  
- `lib/analyzeLvText.ts` – Trigger-Anwendung und System-Checks regelbasiert; `collectTriggerEvaluations` nur Debug-Sammlung, keine KI.

---

## 2. Analyse-Pipeline mit KI-Einsatz

Grober Ablauf (wo KI eingreift):

1. **Upload / GAEB-Split**  
   - Optional: **`/api/gaeb-split-llm`** – LLM ermittelt Marker (Vortext vs. Positionen).  
   - Danach: Vortext und ggf. Positionen getrennt verfügbar.

2. **Vortext-Analyse**  
   - **`/api/analyze-vortext`**:  
     - Zuerst Regex/Label/strukturierte Extraktion (KeyFacts).  
     - **LLM:** `llmExtract` (Vollvortext) → keyFacts + keyFactConfidence + riskClauses.  
     - Optional: `llmKeyFactsFallback` (nur Lücken bei strukturierter Quelle).  
     - Merge (z. B. mergeKeyFactsPreferRegex), danach **llmRepairKeyFacts** (Bereinigung KeyFacts).  
   - Output: keyFacts, keyFactConfidence, keyFactsValidated, riskClauses.

3. **Score / Findings**  
   - **`/api/score`**:  
     - Entweder **Trigger-Modus:** `analyzeLvText(lvText, dbTriggers, …)` – regelbasiert.  
     - Oder **LLM-Modus** (`useLlmRelevance === true`):  
       - `analyzeLvText(…)` (weiterhin für System-Findings) + **`analyzeLvTextWithLLM(lvText)`** → zusätzliche Findings.  
     - Findings (Trigger + ggf. LLM) fließen in Score, Kategorien, total.  
   - Kein LLM in der reinen Score-Berechnung (computeScore).

4. **Nachtragspotenzial (Change Order)**  
   - **`/api/change-order-analysis`** (aufgerufen mit findings, riskClauses, keyFacts, vortext, …):  
     - **Regelbasiert:** `runChangeOrderAnalysis` (changePotentialModel etc.) → opportunities, byCluster, summary.  
     - **Optional LLM-Veredelung** (wenn `useChangePotentialLlm` und Env/Key):  
       - **`refineChangePotentialWithLlm`** (changePotentialLlmRefinement): Top-3-Items, nur reasoning/questionDraft/clarificationDraft.  
     - Optional **Legacy-LLM** `runLlmChangeOrderAnalysis` nur bei Debug (CHANGE_ORDER_LEGACY_LLM_DEBUG), Ergebnis nicht in Produktdaten.

5. **Verhandlungscluster**  
   - In Change-Order-Pipeline: **`buildNegotiationClusters`** (changePotentialNegotiationClusters):  
     - Regelbasierte Buckets, dann optional **LLM** pro Bucket (Titel, whyThisMatters, recommendedNegotiationAction, suggestedQuestion/Clarification).

6. **Kommerzielle Strategie pro Item**  
   - Optional: **`enrichChangePotentialWithCommercialStrategy`** (changePotentialCommercialStrategy):  
     - LLM pro Top-Item: strategyReasoning, handlingRecommendation, internalNote.

7. **Offer Strategy Summary**  
   - Optional: **`offerStrategySummary.ts`** – LLM erzeugt executiveSummary, finalRecommendation, Varianten (defensiv/ausgewogen/offensiv), topRisks, topNegotiationPoints, immediateActions.

8. **Angebotsannahmen**  
   - **`/api/offer-assumptions`**:  
     - Regelbasiert: `generateOfferAssumptions` (offerAssumptions).  
     - Optional: **`llmRefineAssumptions`** – nur Textoptimierung der Annahmen (Formulierung).

9. **Management Summary (Speichern der Analyse)**  
   - **`lib/managementSummary.ts`** – **kein LLM**; wird beim Save aus Score/Findings/KeyFacts/ChangeOrder-Ergebnis rein regelbasiert gebaut.

---

## 3. Konkrete LLM-Calls

### 3.1 Vortext: KeyFacts + RiskClauses

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `app/api/analyze-vortext/route.ts` |
| **Funktion** | `llmExtract(vortext: string)` |
| **Modell/Provider** | OpenAI, `OPENAI_MODEL` oder `gpt-4o-mini` |
| **Prompt/Zweck** | Ein Aufruf: Vortext analysieren → keyFacts (KEYSET), keyFactConfidence, riskClauses (max 14). Anweisungen zu kurzem Projektnamen, Gewerk, Vertragsgrundlagen, Ort, Fristen, etc. |
| **Input** | Sanitierter Vortext (bis 18.000 Zeichen), per `buildInstructions(vortext)` |
| **Output** | JSON: riskClauses[], keyFacts (Record), keyFactConfidence (Record). Wird mit Regex-Merge (mergeKeyFactsPreferRegex) und ggf. llmRepairKeyFacts genutzt. |

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `app/api/analyze-vortext/route.ts` |
| **Funktion** | `llmRepairKeyFacts(vortext, keyFacts)` |
| **Modell/Provider** | OpenAI, `gpt-4o-mini` (oder OPENAI_MODEL) |
| **Prompt/Zweck** | Bereinigung/Korrektur bestehender KeyFacts (keine neuen Felder): kurzer Projektname, Gewerk aus Code, Vertragsgrundlage, Fristen ohne Prozeduraltext, etc. |
| **Input** | Vortext (bis 12.000 Zeichen), aktuelles keyFacts-Objekt |
| **Output** | Bereinigtes KeyFacts-Objekt (alle Keys, leere Strings wo nicht gefunden). |

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `app/api/analyze-vortext/route.ts` |
| **Funktion** | `llmKeyFactsFallback(structuredInput, fieldsToRequest)` |
| **Modell/Provider** | OpenAI, `gpt-4o-mini` |
| **Prompt/Zweck** | Nur Lücken füllen: strukturierte Vorbemerkungen (globalRemarks, topLabelForPreface, groups) → angeforderte Felder (z. B. bauherr_ag, ort, bindefrist, …) extrahieren. |
| **Input** | JSON-Payload der strukturierten Texte, Liste der Felder (z. B. LLM_FALLBACK_FIELDS) |
| **Output** | Pro Feld: value, confidence (high/medium/low), reason. Wird nur übernommen, wenn Validierung (FIELD_MATRIX, Garbage-Check) besteht. |

---

### 3.2 Score: Findings aus LLM (LV-Text)

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `lib/llmRelevanceFilter.ts` |
| **Funktion** | `analyzeLvTextWithLLM(lvText: string)` |
| **Modell/Provider** | OpenAI, `OPENAI_MODEL` oder `gpt-4o-mini` |
| **Prompt/Zweck** | LV-Text eigenständig auf Bieter-Risiken durchsuchen – ohne Trigger. Kategorien: vertrags_lv_risiken, mengen_massenermittlung, technische_vollstaendigkeit, schnittstellen_nebenleistungen, kalkulationsunsicherheit. |
| **Input** | LV-Text (bis 12.000 Zeichen) |
| **Output** | JSON: findings[] mit title, detail, category, severity, penalty. IDs `LLM_1`, `LLM_2`, … Werden in `/api/score` mit System-Findings zusammengeführt und in Score/Kategorien eingerechnet. |

---

### 3.3 Nachtragspotenzial: Legacy-LLM (nur Debug)

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `lib/changeOrderAnalysis.ts` |
| **Funktion** | `runLlmChangeOrderAnalysis(vortext, lvPositions?)` |
| **Modell/Provider** | OpenAI, `gpt-4o-mini` |
| **Prompt/Zweck** | Freie Nachtragsanalyse: Vortext + LV-Auszüge → opportunities (cluster, potential, riskLevel, assertiveness, reason, evidence). |
| **Input** | Vortext (bis 10.000 Zeichen), optional LV-Positionen (bis 6.000) |
| **Output** | opportunities[] mit sourceType ["llm"]. **Nicht** in produktive opportunities gemischt; nur bei CHANGE_ORDER_LEGACY_LLM_DEBUG. |

---

### 3.4 Nachtragspotenzial: LLM-Veredelung (Top-3-Items, Text nur)

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `lib/changePotentialLlmRefinement.ts` |
| **Funktion** | `refineChangePotentialWithLlm(summary, ctx)` → intern `refineOneItemTextOnly(item, model)` |
| **Modell/Provider** | OpenAI, `CHANGE_POTENTIAL_LLM_MODEL` oder `OPENAI_MODEL` oder `gpt-4o-mini` |
| **Prompt/Zweck** | Pro Item (Top 3 nach Impact/Enforceability): nur improvedReasoning, improvedQuestionDraft, improvedClarificationDraft. fieldType, changeMechanism, impactLevel etc. bleiben regelbasiert. |
| **Input** | ChangePotentialSummary (Items), Kontext (vortext, lvPositions, keyFacts, findings, riskClauses). Pro Call: Item-ID, Titel, Gewerk, Reasoning-Snippet, Zitat. |
| **Output** | JSON pro Item: itemId, improvedReasoning, improvedQuestionDraft, improvedClarificationDraft. Wird als Patch auf das Item angewendet (llmAdjusted, llmChangedFields). |

---

### 3.5 Offer Strategy Summary (Dokumenten-Ebene)

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `lib/offerStrategySummary.ts` |
| **Funktion** | (intern nach buildContext) `openai.chat.completions.create` |
| **Modell/Provider** | OpenAI, `OPENAI_MODEL` oder `gpt-4o-mini` |
| **Prompt/Zweck** | Aus ChangePotentialSummary + Commercial Actions: executiveSummary, finalRecommendation, recommendedApproach (defensiv/ausgewogen/offensiv), topRisks, topNegotiationPoints, immediateActions, Varianten mit description/expectedTradeoff/keyActions. |
| **Input** | Kontext-String (buildContext): Gesamtindex, Items, Cluster, abgeleitete Maßnahmen. |
| **Output** | JSON: executiveSummary, finalRecommendation, recommendedApproach, topRisks[], topNegotiationPoints[], immediateActions[], variants[]. |

---

### 3.6 Commercial Strategy pro Item

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `lib/changePotentialCommercialStrategy.ts` |
| **Funktion** | `enrichChangePotentialWithCommercialStrategy(summary)` → intern `fetchStrategyForItem(item, model)` |
| **Modell/Provider** | OpenAI, `gpt-4o-mini` (oder Env) |
| **Prompt/Zweck** | Pro Top-Item: strategyReasoning, handlingRecommendation, internalNote (optional). |
| **Input** | ChangePotentialItem (Titel, reasoning, impactLevel, recommendedAction, …) |
| **Output** | JSON: strategyReasoning, handlingRecommendation, internalNote. Wird in Item als commercialStrategy angehängt. |

---

### 3.7 Verhandlungscluster (LLM-Benennung)

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `lib/changePotentialNegotiationClusters.ts` |
| **Funktion** | `buildNegotiationClusters(summary)` → `enrichBucketsWithLlm(toEmit, model)` |
| **Modell/Provider** | OpenAI, `gpt-4o-mini` (oder Env) |
| **Prompt/Zweck** | Pro Bucket (regelbasiert vorgeclustert): title, shortTitle, whyThisMatters, recommendedNegotiationAction, suggestedQuestion, suggestedClarification, clusterReasoning. |
| **Input** | Top-Buckets (bis MAX_BUCKETS_FOR_LLM), Kontext aus Summary |
| **Output** | JSON: clusters[] mit obigen Feldern. Ersetzt regelbasierte Fallback-Titel/Beschreibungen. |

---

### 3.8 Angebotsannahmen: Textoptimierung

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `app/api/offer-assumptions/route.ts` |
| **Funktion** | `llmRefineAssumptions(assumptions)` |
| **Modell/Provider** | OpenAI, `gpt-4o-mini` |
| **Prompt/Zweck** | Bestehende Annahmen (regelbasiert erzeugt) formulierungstechnisch optimieren: klar, prägnant, rechtssicher; „Wir gehen davon aus, dass …“. |
| **Input** | Array von OfferAssumption (id, assumption), max 20. |
| **Output** | JSON: assumptions[] mit id und optimiertem assumption-Text. Ersetzt nur das Textfeld. |

---

### 3.9 GAEB-Split (Vortext/Positionen-Trennung)

| Aspekt | Inhalt |
|--------|--------|
| **Datei** | `app/api/gaeb-split-llm/route.ts` |
| **Funktion** | POST-Handler (inline LLM-Call) |
| **Modell/Provider** | OpenAI, Modell fest `gpt-4.1-mini` |
| **Prompt/Zweck** | In GAEB-Text den Übergang von VORTEXT zu POSITIONS-/LV-Teil finden; exakter Marker (1–3 Zeilen) + confidence, reason. |
| **Input** | Bereinigter Datei-Text (bis 200.000 Zeichen). |
| **Output** | JSON: marker, marker_line_count, confidence, reason. Kein Analyse-Inhalt; nur Split-Entscheidung. |

---

## 4. Welche Ergebnisse heute schon durch LLM beeinflusst werden

| Ergebnis | LLM-Einfluss | Wo |
|----------|--------------|-----|
| **KeyFacts** | Ja (stark) | analyze-vortext: llmExtract, llmKeyFactsFallback, llmRepairKeyFacts. Merge mit Regex; Validierung in keyFactsValidation. |
| **RiskClauses** | Ja | analyze-vortext: llmExtract liefert riskClauses; Fallback fallbackRiskClausesRegex wenn LLM leer. |
| **Findings** | Ja (optional) | score: bei useLlmRelevance werden LLM-Findings (llmRelevanceFilter) zu System-Findings addiert; fließen in findingsSorted, Kategorien, total. |
| **Scores** | Indirekt | Nur über Findings: mehr/weniger Findings → andere Penalty-Summen → andere perCategory und total. Kein direkter LLM-Score. |
| **Summary / Management** | Teilweise | buildManagementSummary: **kein LLM**. offerStrategySummary: **LLM** (executiveSummary, Varianten, Empfehlung). Beim Speichern der Analyse wird buildManagementSummary verwendet (regelbasiert); Offer-Strategy-Summary ist separates Feature. |
| **Nachtragspotenzial (opportunities, byCluster)** | Ja (optional) | Regel-Engine führend; LLM-Veredelung: reasoning, questionDraft, clarificationDraft (Top-3). NegotiationClusters: LLM für Titel/Empfehlung. CommercialStrategy: LLM pro Item. Legacy-LLM nur Debug, nicht in Produktdaten. |
| **Angebotsannahmen** | Optional | Regelbasiert erzeugt; LLM nur zur Textoptimierung (llmRefineAssumptions). |
| **Trigger-Erkennung** | Nein | Trigger werden in analyzeLvText regelbasiert angewendet (DB-Trigger + Fenster-Logik). collectTriggerEvaluations nur Debug. Keine LLM-Validierung von Triggern. |

---

## 5. Gibt es bereits etwas, das einer Trigger-Validierung ähnlich ist?

**Antwort: Nein.**

- **Trigger:** Werden in `lib/analyzeLvText.ts` ausschließlich regelbasiert angewendet (Keywords, context_required, exclude_keywords, Fenster-Logik). Es gibt keine Stelle, an der ein LLM prüft, ob ein Trigger „wirklich“ zutrifft oder ob ein Finding gerechtfertigt ist.
- **LLM-Findings** (`analyzeLvTextWithLLM`): Eigenständige Suche nach Risiken **ohne** Trigger; additive Findings, keine Validierung/Korrektur von Trigger-Findings.
- **Konsequenz:** Eine „Trigger-Validierung“ (z. B. LLM prüft, ob ein gefeuertes Finding fachlich stimmt oder ob es ein False Positive ist) existiert im Code **nicht**. Das wäre neu und würde sich mit keiner bestehenden LLM-Logik doppeln.

---

## 6. Risiken für Doppelbau

| Geplante LLM-Validierung | Überschneidung mit bestehender Logik? | Hinweis |
|---------------------------|----------------------------------------|---------|
| **Trigger-Validierung** (z. B. „Ist dieses Finding ein False Positive?“) | Nein | Es gibt aktuell keine LLM-Validierung von Triggern oder Findings. Klar getrennt von KeyFacts-, Risk- und Nachtrags-LLM. |
| **KeyFacts nochmal per LLM prüfen** | Ja (teilweise) | KeyFacts werden bereits per llmExtract, llmRepairKeyFacts, llmKeyFactsFallback erzeugt/bereinigt. Zusätzliche „reine“ LLM-Validierung könnte mit llmRepairKeyFacts überlappen (Korrektur/Bereinigung). |
| **RiskClauses nochmal per LLM klassifizieren** | Ja (teilweise) | riskClauses kommen schon aus llmExtract. Weitere LLM-Klassifikation (z. B. Relevanz/Priorität) wäre ergänzend, aber nahe an bestehender Risiko-LLM-Nutzung. |
| **Findings per LLM filtern/bewerten** | Teilweise | LLM-Findings sind additive Recherche; es wird nicht bewertet, ob ein DB-Trigger-Finding „stimmt“. Eine solche Bewertung wäre neu; Überschneidung nur thematisch („Risiko im LV“), nicht fachlich doppelt. |

**Empfehlung:** Trigger-Validierung (Findings/False-Positive-Check) ist der Bereich mit **keiner** bestehenden LLM-Logik. KeyFacts- und RiskClauses-Validierung sind bereits stark LLM-gestützt; hier nur ergänzen, nicht eine zweite „vollständige“ LLM-Extraktion bauen.

---

## 7. Empfehlung: Wo neue LLM-Validierung am saubersten ergänzt werden kann

- **Sauberste Stelle für eine neue LLM-Validierung (z. B. Trigger/Findings):**  
  **Nach** der bestehenden Finding-Erzeugung, **vor** oder **innerhalb** der Score-Nutzung (z. B. vor computeScore oder vor persist/Save).  
  - Konkret: In **`app/api/score/route.ts`** nach dem Schritt „Findings erzeugen“ (Trigger-Modus oder Trigger+LLM-Modus) und vor `findingsMapped`/computeScore eine neue Funktion aufrufen, z. B. `validateOrFilterFindingsWithLlm(findings, lvText, vortext?)`.  
  - Diese Funktion sollte **nur** bewerten/filtern (z. B. „behalten/verwerfen“ oder „confidence“), keine neuen Findings aus freier Recherche erzeugen – das macht bereits `analyzeLvTextWithLLM`.  
  - Alternativ: Eigenes Modul `lib/triggerValidationLlm.ts` (oder ähnlich), das von der Score-Route aus aufgerufen wird; Input: findings + Kontext, Output: bereinigte/annotierte Findings. So bleibt die Score-Route schlank und die Validierung testbar und wiederverwendbar.

- **Nicht doppeln:**  
  - Keine zweite „Voll-KeyFacts-Extraktion“ per LLM (bereits llmExtract + llmRepair + llmKeyFactsFallback).  
  - Keine zweite „Risiko-Clause-Extraktion“ (bereits in llmExtract).  
  - Nachtrags-LLM (Refinement, Clusters, Commercial, Offer Strategy) bleibt für Nachtragspotenzial; Trigger-Validierung ist thematisch „Risiko/Findings“, aber fachlich andere Aufgabe (Validierung von Trigger-Treffern, nicht Nachtragsanalyse).

- **Technisch:**  
  - Bestehende Patterns nutzen: `OPENAI_API_KEY`, `OPENAI_MODEL`/`gpt-4o-mini`, `response_format: { type: "json_object" }` oder JSON-Schema, kurzer Prompt mit klarem Schema (z. B. pro Finding: „relevant: boolean, reason?: string“).  
  - Optional: Timeout und Fallback wie in changePotentialLlmRefinement (bei Fehler/Timeout: unverändert alle Findings behalten).

---

**Ende der Bestandsaufnahme.**
