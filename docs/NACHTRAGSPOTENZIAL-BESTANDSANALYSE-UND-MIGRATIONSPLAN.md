# Nachtragspotenzial – Bestandsanalyse und Migrationsplan

**Stand:** Bestandsaufnahme ohne sofortige Umsetzung. Ziel: kontrollierte Überarbeitung ohne Schäden an Score, Trigger, KeyFacts, Vortextanalyse, Rückfragen, Angebotsklarstellungen, Gewerkeerkennung, LV-Split und UI.

---

## 1. Betroffene Dateien (Vollständige Liste)

| Datei | Rolle |
|-------|--------|
| **lib/changeOrderAnalysis.ts** | Kernlogik: Typen, 25 Nachtragsquellen (NACHTRAG_SOURCES), KEYFACTS_NACHTRAG_RELEVANT, runRuleBasedBaseline, findingToCluster, matchSource, deduplicate, NACHTRAG_LLM_PROMPT, runLlmChangeOrderAnalysis, runChangeOrderAnalysis |
| **app/api/change-order-analysis/route.ts** | API: POST nimmt findings, riskClauses, keyFacts, vortext, lvPositions, useLlm; liefert opportunities, byCluster, debug |
| **lib/analyzeLvText.ts** | Erzeugt ein **einzelnes** Finding mit category "nachtrag" (Weichwörter-Check); fließt in Score, wird an Change-Order-API als Teil von findings übergeben |
| **lib/scoringConfig.ts** | NACHTRAG_SCHWELLEN, NACHTRAG_WEICHWOERTER; CATEGORY_WEIGHTS_6 enthält "nachtrag" |
| **app/api/score/route.ts** | Mapping category "nachtrag" → "vertrags_lv_risiken" (Zeile 40) |
| **app/api/admin/scoring-config/route.ts** | Admin: nachtragSchwellen, nachtragWeichwoerter lesen/schreiben/validieren |
| **app/admin/score/page.tsx** | State (changeOrderAnalysis, changeOrderUseLlm, changeOrderLoading), generateChangeOrderAnalysis(), deduplicatedOpportunities, Tab "nachtragspotenzial" (nutzt NachtragspotenzialBlock), Tab "risiken" verweist auf Tab Nachtragspotenzial, KPI „Claim-Potenzial“ aus Nachtragsanalyse (Strang B) |
| **app/admin/texts/page.tsx** | Tab-Key "nachtragspotenzial", Button-Key "nachtragspotenzialErmitteln", explanation.nachtragspotenzial |
| **app/admin/settings/page.tsx** | Einstellung „Nachtragsanalyse aktiviert“ (localStorage admin.settings.nachtragEnabled) |
| **lib/textsConfig.ts** | tabLabels.nachtragspotenzial, kpiLabels.claimPotential, buttonLabels.nachtragspotenzialErmitteln, emptyStates.noNachtragspotenziale, explanation.nachtragspotenzial |
| **app/analyse/page.tsx** | Meta-Beschreibung: „Nachtragspotenziale vor der Angebotsabgabe erkennen“ |
| **lib/llmRelevanceFilter.ts** | Erwähnung „Nachtragspotenzial“ in Kontext |
| **app/api/analyze-vortext/route.ts** | Keine Nachtrags-Berechnung; nur Erwähnung in Trigger-Interpretationstexten (z. B. „Nachtrags-/Kalkulationsrisiko“) |

---

## 2. Aktuelle Architektur

### 2.1 Zwei getrennte „Nachtrag“-Stränge

- **Strang A – Scoring / Findings („nachtrag“-Kategorie)**  
  - In `analyzeLvText.ts`: Zählung der Weichwörter (NACHTRAG_WEICHWOERTER) im LV-Text.  
  - Wenn `countNachtrag >= NACHTRAG_SCHWELLEN.minFindings` → **ein** Finding mit `category: "nachtrag"`, Titel je nach Schwellen („Mehrere weiche Formulierungen …“ / „Viele weiche …“).  
  - Dieses Finding fließt in `result.findingsSorted`, wird in der Score-Route der Kategorie „vertrags_lv_risiken“ zugeordnet und geht in die Gesamtpunktzahl ein.  
  - Es gibt **keine** strukturierten „Opportunities“ oder Cluster in diesem Strang.

- **Strang B – Nachtragspotenzial (Change Order)**  
  - **Nur on-demand:** Nutzer klickt „Nachtragspotenziale ermitteln“.  
  - Request: `POST /api/change-order-analysis` mit Body:  
    `findings`, `riskClauses`, `keyFacts`, `vortext`, `lvPositions`, `useLlm`.  
  - Antwort: `opportunities`, `byCluster`, `debug` (ruleBasedCount, llmCount, deduplicatedCount).  
  - Regelbasis: Findings → Opportunities (über findingToCluster + matchSource), RiskClauses → Opportunities, fehlende KeyFacts (5 Stück) → Opportunities.  
  - Optional: LLM analysiert Vortext + lvPositions und liefert weitere Opportunities.  
  - Deduplizierung (similarity 0,6), dann Gruppierung nach Cluster (leistungsaenderung, leistungsmehrung, schnittstelle, erschwernis).  
  - UI: Tab „Nachtragspotenzial“ und ein Übersichts-Block zeigen dieselben Daten (deduplicatedOpportunities bzw. byCluster).

### 2.2 Datenstruktur (aktuell)

- **ChangeOrderOpportunity** (lib/changeOrderAnalysis.ts):  
  `id`, `cluster`, `title`, `description`, `potential` (low|medium|high), `riskLevel`, `assertiveness`, `reason`, `sourceFindingIds`, `sourceTextSnippets`, `sourceType` (finding|preface|keyfact|llm).

- **ChangeOrderInput**:  
  `findings` (FindingInput[]), `riskClauses` (RiskClauseInput[]), `keyFacts` (Record<string, string>), `vortext?`, `lvPositions?`, `useLlm?`.

- **API-Response** `/api/change-order-analysis`:  
  `opportunities`, `byCluster`, `debug: { ruleBasedCount, llmCount, deduplicatedCount }`.

- **Frontend** (app/admin/score/page.tsx):  
  Typ `ChangeOrderOpp` (lokal, entspricht ChangeOrderOpportunity); State `changeOrderAnalysis` mit `opportunities`, `byCluster`, `debug`; `deduplicatedOpportunities` = nach Titel deduplizierte opportunities.

### 2.3 Ablauf

1. Nutzer startet Analyse → Score-Route läuft → Findings (inkl. ggf. einem „nachtrag“-Finding) und Score entstehen.  
2. Vortextanalyse (analyze-vortext) liefert riskClauses, keyFacts.  
3. Nutzer öffnet Übersicht oder Tab „Nachtragspotenzial“ und klickt „Nachtragspotenziale ermitteln“.  
4. Frontend sendet findings, riskClauses, keyFacts, vortext, lvPositions, useLlm an `/api/change-order-analysis`.  
5. Regelbasierte Opportunities aus Findings/RiskClauses/KeyFacts; optional LLM-Opportunities; Merge + Deduplizierung; Antwort an Client.  
6. UI zeigt Gesamtbewertung (Keine/Gering/Mittel/Hoch aus potential) und Listen pro Cluster bzw. deduplizierte Liste.

### 2.4 UI-Darstellung

- **Tab „Nachtragspotenzial“:**  
  Erklärungstext, Checkbox „KI nutzen“, Button „Nachtragspotenziale ermitteln“, bei vorhandenen Daten: Gesamtbewertung (Nachtragspotenzial: Keine/Gering/Mittel/Hoch), Liste „Mögliche Ursachen“ (Titel), ggf. Experten-Debug (Regeln/KI/Dedupliziert).  
  Im Expertenmodus: pro Cluster (Leistungsänderung, Leistungsmehrung, Schnittstelle, Erschwernis) Karten mit title, potential, riskLevel, assertiveness, reason, sourceTextSnippets, sourceFindingIds.

- **Übersichts-Bereich (oben auf der Seite):**  
  Derselbe Block (Button, Checkbox, gleiche Liste/Debug) wird ein zweites Mal gerendert.

- **KPI „Claim-Potenzial“ (Übersicht, 3. Karte):**  
  Zeigt **nicht** die Nachtragsanalyse, sondern eine von `result.total` abgeleitete Stufe (low/medium/high wie beim Gesamt-Risiko). Inhaltlich also doppeltes Gesamt-Risiko unter anderem Label.

---

## 3. Erkennbare Schwächen

### 3.1 Fachlich / Konzeptionell

- **Nachtrag (Scoring) vs. Nachtragspotenzial (Change Order) unklar:**  
  Ein „nachtrag“-Finding (Weichwörter) fließt nur als ein Risiko-Punkt in den Score; die strukturierten „Opportunities“ entstehen erst in einem separaten Schritt und haben keine Rückwirkung auf den Score. Die Begriffe „Nachtrag“ (Ampel/Score) und „Nachtragspotenzial“ (Opportunities) sind nicht einheitlich definiert.

- **Claim-Potenzial-Karte irreführend:**  
  Nutzer könnte erwarten, dass „Claim-Potenzial“ aus der Nachtragsanalyse kommt; tatsächlich ist es nur eine Duplikat-Anzeige des Gesamt-Risikos (total).

- **Regelbasierte Opportunities stark von Findings abhängig:**  
  Wenn die Score-/Trigger-Logik wenig oder keine Findings liefert (z. B. bei kurzem oder untypischen Text), liefert die Nachtragsanalyse kaum Regel-Opportunities. LLM kann das teilweise ausgleichen, ist aber optional.

- **Fehlende KeyFacts nur 5 Felder:**  
  KEYFACTS_NACHTRAG_RELEVANT: bauzeit, baubeginn, fertigstellung, ausfuehrungsfrist, wartung_instandhaltung. Andere für Nachträge relevante Felder (z. B. Schnittstellen, Mengen) sind nicht abgebildet.

- **Ein „nachtrag“-Finding pro Datei:**  
  Der Weichwörter-Check erzeugt nur **ein** aggregiertes Finding („Mehrere weiche Formulierungen …“). Es gibt keine Zuordnung zu konkreten Stellen oder Clustern; die Change-Order-Logik ordnet dieses Finding dann heuristisch einem Cluster zu (findingToCluster).

### 3.2 Technisch / Strukturell

- **Doppelte Darstellung:**  
  Tab „Nachtragspotenzial“ und Übersichts-Block enthalten dieselbe Logik und denselben Inhalt; Änderungen müssen an zwei Stellen gepflegt werden.

- **Kein Persistieren der Nachtragsanalyse:**  
  Ergebnis liegt nur im React-State; bei Reload oder neuem Analyse-Durchlauf ohne erneuten Klick geht es verloren.

- **findingToCluster heuristisch:**  
  Cluster-Zuordnung aus Finding-Text/Kategorie; kann bei kurzen oder generischen Titeln zu „leistungsaenderung“ als Fallback führen. NIGHTRAG_SOURCES-Matching (matchSource) liefert konkrete Titel, aber nicht jedes Finding matcht eine Source.

- **Typo in Konstante:**  
  ~~`NIGHTRAG_SOURCES`~~ → in Phase-2-Bereinigung umbenannt in `NACHTRAG_SOURCES`.

- **LLM optional und getrennt:**  
  useLlm wird nur bei explizitem Häkchen genutzt; Regel- und LLM-Ergebnisse werden erst nachträglich zusammengeführt und dedupliziert. Keine Abstimmung mit anderen LLM-Aufrufen (z. B. Vortext-Risiken).

---

## 4. Bewertung: Was erhalten, ersetzen, migrieren?

### 4.1 Beibehalten (evtl. refaktoriert)

- **API-Contract** `/api/change-order-analysis`:  
  Ein- und Ausgabe (findings, riskClauses, keyFacts, vortext, lvPositions, useLlm → opportunities, byCluster, debug) als stabile Schnittstelle beibehalten; interne Implementierung kann schrittweise ersetzt werden.

- **Cluster-Modell** (leistungsaenderung, leistungsmehrung, schnittstelle, erschwernis):  
  Fachlich sinnvoll; beibehalten, ggf. um fehlende Cluster oder Untertypen erweitern.

- **Typen** ChangeOrderOpportunity, ChangeOrderInput, ChangeOrderResult:  
  Beibehalten; optional um Felder (z. B. positionRef, sourcePosition) ergänzen.

- **Weichwörter-Check** in analyzeLvText (nachtrag-Finding):  
  Als **ein** Indikator für „weiche Formulierungen“ im Score beibehalten; klare Trennung: Dieses Finding ist ein Risiko-Signal für die Bewertung, nicht die einzige Quelle für Nachtragspotenzial.

- **Scoring-Mapping** „nachtrag“ → „vertrags_lv_risiken“:  
  Beibehalten, bis eine neue Kategorie oder ein neues Scoring-Modell eingeführt wird.

- **Texte und Konfiguration** (textsConfig, explanation.nachtragspotenzial, Admin-Texte, nachtragSchwellen/nachtragWeichwoerter):  
  Beibehalten; nur anpassen, wenn sich Fachkonzept oder UX ändert.

### 4.2 Ersetzen / neu konzipieren

- **Regelbasierte Opportunity-Erzeugung** (runRuleBasedBaseline):  
  Aktuell: Findings/RiskClauses/KeyFacts → feste 25 Quellen + 5 KeyFacts. Ersetzen durch klare, erweiterbare Regeln (z. B. eigene „Nachtrags-Trigger“, Stellenbezug, bessere Cluster-Zuordnung), ohne die bestehende API zunächst zu ändern (gleiche Felder, bessere Befüllung).

- **KPI „Claim-Potenzial“ auf der Übersicht:**  
  Entweder entfernen oder tatsächlich aus der Nachtragsanalyse ableiten (z. B. aus deduplicatedOpportunities oder einem aggregierten „Nachtrags-Score“). Heutige Duplikat-Logik (result.total) ersetzen.

- **Doppelte UI (Tab + Übersichts-Block):**  
  Eine gemeinsame Quelle/Komponente für „Nachtragspotenzial“-Inhalt; nur eine Stelle mit Button und Liste, die andere verweist darauf oder zeigt nur Kurzinfo/Link.

### 4.3 Migrieren (schrittweise anpassen)

- **Eingaben der Nachtragsanalyse:**  
  Weiterhin findings, riskClauses, keyFacts, vortext, lvPositions; optional um strukturierte Positionsreferenzen oder Abschnitts-IDs erweitern, wenn GAEB/Struktur das hergibt.

- **LLM-Integration:**  
  Prompt und Aufruf in changeOrderAnalysis behalten; optional an ein gemeinsames „Analyse-Context“-Modell anbinden (z. B. gleicher Vortext-/Positions-Kontext wie bei Risiken), ohne sofort andere Features zu verändern.

- **Deduplizierung:**  
  Beibehalten, aber Schwellen und Ähnlichkeitsmaß dokumentieren und ggf. konfigurierbar machen.

---

## 5. Risiken und Breaking Changes

- **API `/api/change-order-analysis`:**  
  Änderung der Response-Struktur (z. B. neue Pflichtfelder, Umbenennung von `byCluster`) wäre Breaking für das Frontend. Empfehlung: nur additive Felder; Umbenennungen erst in neuer API-Version oder mit Abwärtskompatibilität.

- **Frontend State (changeOrderAnalysis):**  
  Wenn das erwartete Format von `opportunities` oder `byCluster` sich ändert (z. B. neues Pflichtfeld), müssen alle Stellen in app/admin/score/page.tsx angepasst werden (Tab, Übersichts-Block, deduplicatedOpportunities).

- **Score-Route und Kategorie-Mapping:**  
  Wenn „nachtrag“ anders gemappt oder die Kategorie abgeschafft wird, muss die Score-Berechnung und ggf. die Ampel angepasst werden. analyzeLvText liefert weiterhin ein Finding mit category "nachtrag"; nur die Zuordnung in der Score-Route sollte explizit dokumentiert bleiben.

- **Scoring-Config (Admin):**  
  nachtragSchwellen und nachtragWeichwoerter werden von analyzeLvText und ggf. von der Admin-UI gelesen. Änderung der Keys oder Struktur betrifft lib/analyzeLvText.ts, lib/scoringConfig.ts und app/api/admin/scoring-config/route.ts.

---

## 6. Migrationsplan (konkrete Schritte)

### Phase 1 – Dokumentation und Absicherung (ohne Verhalten zu ändern)

1. **Schnittstellen dokumentieren**  
   - Request/Response von `POST /api/change-order-analysis` (inkl. optionale Felder) in einer API-Doc oder Kommentar festhalten.  
   - Alle Stellen im Frontend auflisten, die `changeOrderAnalysis`, `deduplicatedOpportunities`, `byCluster` lesen.

2. **Tests / Manuelle Checkliste**  
   - Nach jeder späteren Änderung: Score-Berechnung, Trigger-Anzeige, KeyFacts, Vortextanalyse, Rückfragen, Angebotsklarstellungen, GAEB-Split und Tabs (Risiken, Vorbemerkungen, Positionen) unverändert funktionsfähig.

### Phase 2 – Entkopplung und Klarstellung (minimal invasiv)

3. **KPI „Claim-Potenzial“ bereinigen**  
   - Option A: Label in „Gesamt-Risiko (Stufe)“ ändern oder Karte entfernen.  
   - Option B: Karte nur anzeigen, wenn `changeOrderAnalysis` vorhanden ist, und Wert aus Nachtragsanalyse ableiten (z. B. „Hoch/Mittel/Gering“ aus deduplicatedOpportunities).

4. **Doppelte UI zusammenführen**  
   - Eine wiederverwendbare Komponente (z. B. `NachtragspotenzialBlock`) einführen: Inhalt (Button, Checkbox, Liste, Debug).  
   - Tab „Nachtragspotenzial“ und Übersichts-Block rendern nur diese Komponente; keine Duplikation der Logik.

5. **Konstante umbenennen**  
   - `NIGHTRAG_SOURCES` → `NACHTRAG_SOURCES` (oder passenden Namen) in lib/changeOrderAnalysis.ts; reine Refaktorierung.

### Phase 3 – Fachliche Verbesserung (kontrolliert)

6. **Regelbasierte Nachtragslogik erweitern**  
   - KEYFACTS_NACHTRAG_RELEVANT um weitere Felder ergänzen (z. B. ort, gewerk), nur wenn fachlich gewünscht.  
   - findingToCluster und matchSource beibehalten, aber dokumentieren und ggf. um explizite „Nachtrags-Trigger“ oder Muster ergänzen, ohne bestehende Findings-/Risiken-Logik zu ersetzen.

7. **Nachtrag (Weichwörter) vs. Nachtragspotenzial trennbar machen**  
   - In der UI oder in Texten klarstellen: „Weiche Formulierungen“ (ein Finding im Risiko-Tab) vs. „Nachtragspotenziale“ (eigener Schritt, Opportunities).  
   - Optional: „nachtrag“-Finding in der Nachtragsanalyse als eigene Opportunity-Quelle sichtbar machen (z. B. sourceType "weichwoerter").

### Phase 4 – Optionale Erweiterungen (nur bei Bedarf)

8. **Persistenz**  
   - Nachtragsanalyse-Ergebnis in Session/LocalStorage oder Backend speichern, damit es nach Reload oder erneutem Analyse-Run (ohne erneuten Klick) verfügbar ist. Dafür API und Frontend erweitern; bestehende Response-Struktur beibehalten.

9. **LLM-Anbindung**  
   - Gleichen Vortext-/Positions-Kontext wie bei der Vortext-Risikoanalyse nutzen; keine Änderung an Risiken-Pipeline, nur an runLlmChangeOrderAnalysis.

10. **Neue Nachtrags-API-Version**  
    - Wenn ein völlig neues Modell (z. B. mit Positionsbezug, anderen Clustern) eingeführt wird: neue Route oder Query-Parameter (z. B. v=2), alte Route weiterhin unterstützen.

---

## 7. Empfehlung: Refaktor vs. Ersetzen

| Bereich | Empfehlung | Begründung |
|--------|------------|------------|
| **Weichwörter-Finding (analyzeLvText)** | **Refaktor** | Ein klarer Indikator; nur Dokumentation und evtl. Konstante/Config-Zugriff aufräumen. |
| **runRuleBasedBaseline** | **Ersetzen (schrittweise)** | Quellen- und KeyFact-Liste erweiterbar machen; Zuordnung zu Clustern und Stellen klarer definieren; API-Format beibehalten. |
| **runLlmChangeOrderAnalysis** | **Refaktor** | Prompt und Validierung schärfen; Eingabe (Vortext/Positionen) ggf. aus gemeinsamer Quelle; Ausgabeformat unverändert. |
| **Deduplizierung** | **Refaktor** | Beibehalten; Schwellen und Metrik dokumentieren, ggf. konfigurierbar. |
| **API change-order-analysis** | **Stabil halten** | Keine Breaking Changes; nur additive Felder. Neue Logik hinter gleicher Schnittstelle. |
| **UI (Tab + Übersicht)** | **Refaktor** | Eine Komponente, zwei Einbindungen; KPI „Claim-Potenzial“ nur anpassen oder ersetzen. |
| **Score-Mapping nachtrag → vertrags_lv_risiken** | **Beibehalten** | Bis ein neues Scoring-/Kategorien-Modell kommt. |

---

## 8. Kurzfassung

- **Betroffene Dateien:** 13 (Kern: lib/changeOrderAnalysis.ts, app/api/change-order-analysis/route.ts, app/admin/score/page.tsx; dazu analyzeLvText, scoringConfig, score-Route, Admin-Config, Admin-Texte, Settings, textsConfig, analyse-Meta, llmRelevanceFilter, analyze-vortext nur Erwähnung).
- **Architektur:** Zwei Stränge – (A) ein „nachtrag“-Finding im Score, (B) on-demand Nachtragspotenzial über separate API mit Regel + optional LLM.
- **Schwächen:** Claim-Potenzial-Karte falsch belegt, doppelte UI, keine Persistenz, Regel-Opportunities stark von Findings abhängig, nur 5 KeyFacts für „fehlt = Opportunity“.
- **Migrationsplan:** Phase 1 Dokumentation/Abgleich, Phase 2 KPI und doppelte UI bereinigen, Phase 3 Regel-/KeyFact-Logik und Begriffe schärfen, Phase 4 optional Persistenz und LLM-Anbindung.
- **Empfehlung:** Bestehende API und Typen beibehalten; Regelbaseline schrittweise ersetzen/erweitern; Weichwörter-Check und LLM refaktorieren; UI auf eine Komponente zusammenführen und KPI korrigieren.
