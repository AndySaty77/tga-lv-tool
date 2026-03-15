# KeyFacts – Bestandsaufnahme der aktuellen Architektur

**Stand:** Analyse ohne Umbau. Nur Transparenz über den Ist-Zustand.

---

## A) Liste aller relevanten Dateien

| Datei | Rolle in der KeyFacts-Logik |
|-------|-----------------------------|
| **`lib/keyFactsValidation.ts`** | Zentrale Validierung: 12-Facts-Reihenfolge, KeyFactFieldEntry (Candidate-Modell), Blacklist/Garbage, feldspezifische Regeln, Quellen-Ablehnung (Position), Status found/missing/rejected, Display-Mapping (getDisplayValueForStatus, KEYFACT_FALLBACK_LABEL), buildKeyFactsValidated, toLegacyKeyFacts/Confidence. |
| **`app/api/analyze-vortext/route.ts`** | Extraktion: CORE_KEYFACTS_V1 (12), KEYSET, Regex (extractKeyFactsRegex), Label-Extraktion (LABEL_PATTERNS, extractValueByLabel), strukturierte Segmente (globalRemarks, topLabelForPreface, groups, groupRemarks), LLM (llmExtract, llmKeyFactsFallback, llmRepairKeyFacts), FIELD_MATRIX, mergeKeyFactsPreferRegex, Quellenzuordnung (sourceTextType/sourcePath), setzt lv_strukturgroesse/vorbemerkungsumfang, ruft buildKeyFactsValidated auf, liefert keyFactsValidated. |
| **`app/admin/score/page.tsx`** | UI-Logik: ruft /api/analyze-vortext auf, speichert keyFacts/keyFactConfidence/keyFactsValidated/keyFactsDebug; baut keyFactsDisplayList aus KEYFACTS_DISPLAY_ORDER_12 + getDisplayValueForStatus; Gewerk-Fallback aus detectedTrades.primaryTrade; KEYFACT_LABELS, CORE_KEYFACTS_VISIBLE_ORDER (9), PROJEKTDATEN_KEYS, keyFactsVertragsrahmen, visible/hidden Debug. |
| **`components/AnalyseCockpitView.tsx`** | Darstellung: empfängt keyFactsDisplayList (12 Einträge mit key, label, value, isFallback), rendert feste KeyFacts-Karte; Expertenmodus (Confidence); separater Block „Erkannte Gewerke“ (detectedTrades.primaryTrade/secondaryTrades). |
| **`app/api/score/route.ts`** | Liefert detectedTrades (buildDetectedTrades aus detectDisciplines); keine KeyFacts-Extraktion. |
| **`lib/detectedTrades.ts`** | Typen und buildDetectedTrades(primary, secondary, scores) → primaryTrade, secondaryTrades, confidence; keine KeyFacts-Logik. |
| **`docs/KEYFACTS-KERN-V1.md`** | Konzept: 12 Kernfelder, Zuordnung Konzept ↔ Interner Name, Quelle/Methode/Confidence pro Feld. |
| **`docs/KEYFACTS-IST-ANALYSE.md`** | Ältere IST-Dokumentation (teilweise überholt, z. B. projektart/lv_strukturgroesse/vorbemerkungsumfang sind inzwischen umgesetzt). |
| **`lib/offerAssumptions.ts`**, **`lib/clarificationQuestions.ts`**, **`lib/changePotentialModel.ts`** | Nutzen keyFacts (flache Keys) für Rückfragen, Angebotsannahmen, Nachtragspotenzial; keine Extraktion. |
| **`lib/pdf/buildPdfReport.ts`** | Liest keyFacts (z. B. projektart, gewerk, bauvorhaben) für PDF; keine Extraktion. |
| **`app/api/change-order-analysis/route.ts`** | Erhält keyFacts im Request; keine KeyFacts-Extraktion. |

---

## B) Kurze Beschreibung pro Datei (KeyFacts-Bezug)

- **lib/keyFactsValidation.ts:** Definiert KEYFACTS_DISPLAY_ORDER_12, KeyFactSourceType, KeyFactStatus, KeyFactFieldEntry (value, confidence, status, sourceType, sourceText, rejectionReason). Enthält PROJECT_METADATA_FIELDS, POSITION_LIKE_SOURCES, GARBAGE_EXACT/GARBAGE_PATTERNS, isRejectedByBlacklist, looksLikeSentenceFragment, looksLikePositionText, validateField (feldspezifisch), validateKeyFactCandidate, buildKeyFactsValidated, getDisplayValueForStatus, KEYFACT_FALLBACK_LABEL, toLegacyKeyFacts/toLegacyKeyFactConfidence.
- **app/api/analyze-vortext/route.ts:** Definiert CORE_KEYFACTS_V1 (12), KEYSET, VortextSourceTextType, NormalizedPayload, STRUCTURED_KEYFACT_FIELDS, LLM_FALLBACK_FIELDS, LABEL_EXTRACTION_FIELDS, LABEL_PATTERNS, FIELD_MATRIX. Extraktion: extractKeyFactsFromNormalized (Segmente durchiteriert, Label dann Heuristik), LLM-Fallback für Lücken, Legacy-Pfad (Regex + llmExtract + mergeKeyFactsPreferRegex), llmRepairKeyFacts. Setzt keyFactsSourceByField pro Feld, dann buildKeyFactsValidated(keyFacts, keyFactConfidenceOut, keyFactsSourceByField); Response enthält keyFacts, keyFactConfidence, keyFactsValidated, keyFactsDebug.
- **app/admin/score/page.tsx:** Holt Vortext-Result (keyFacts, keyFactConfidence, keyFactsValidated). keyFactsDisplayList = KEYFACTS_DISPLAY_ORDER_12.map: pro key entry = keyFactsValidated[key]; bei Gewerk: found → value, sonst primaryTrade → value, sonst KEYFACT_FALLBACK_LABEL; sonst getDisplayValueForStatus(entry) bzw. Fallback bei fehlendem keyFactsValidated (Legacy keyFacts + normKeyFactValue + isGarbage/isWeak). Übergibt keyFactsDisplayList an AnalyseCockpitView.
- **components/AnalyseCockpitView.tsx:** Zeigt keyFactsDisplayList als InsightList (Label links, Wert rechts); isFallback → kursiv/muted; Expertenmodus: Confidence bei !isFallback. Eigenen Block „Erkannte Gewerke“ (primaryTrade, secondaryTrades, confidence).

---

## 1) Wo ist die 12-KeyFacts-Logik definiert?

- **Zentrale Feldliste (12):**  
  - **`lib/keyFactsValidation.ts`:** `KEYFACTS_DISPLAY_ORDER_12` (exportiert) – bauvorhaben, ort, bauherr_ag, gewerk, projektart, vertragsgrundlagen, zusatzvertragsbedingungen, fristAngebot, bindefrist, ausfuehrungszeitraum, lv_strukturgroesse, vorbemerkungsumfang.  
  - **`app/api/analyze-vortext/route.ts`:** `CORE_KEYFACTS_V1` – identische 12 Felder (Kommentar: „12 Kern-KeyFacts“).  
  - Keine weitere zentrale „Single Source of Truth“: zwei Stellen (lib + API) müssen synchron gehalten werden.
- **Feste Reihenfolge:** In der UI ausschließlich über `KEYFACTS_DISPLAY_ORDER_12` (lib); die Score-Page nutzt diese für keyFactsDisplayList.
- **Mapping in UI:** Score-Page: `KEYFACT_LABELS` (lokal) für Leselabels; keyFactsDisplayList liefert bereits label pro Eintrag (KEYFACT_LABELS[key]). AnalyseCockpitView rendert nur keyFactsDisplayList (keine eigene Feldreihenfolge).

**Einschätzung:** 12-Facts-Logik ist vorhanden; Definition doppelt (lib + API). Reihenfolge und UI-Mapping sind klar an KEYFACTS_DISPLAY_ORDER_12 gekoppelt.

---

## 2) Wo werden KeyFacts aktuell extrahiert?

- **Regex:** `app/api/analyze-vortext/route.ts` – `extractKeyFactsRegex(input)` auf Volltext oder pro Segment (globalRemarks, topLabelForPreface, groups, groupRemarks). Pro Feld feste Patterns (z. B. Bauvorhaben:, Ort:, Gewerk:, Bindefrist:, VOB/BGB, projektart, zusatzvertragsbedingungen, ausfuehrungszeitraum).
- **Parser (strukturiert):** Gleiche Route – bei GAEB-XML: Segmente aus `normalized.globalRemarks`, `topLabelForPreface`, `groups[].label`, `groupRemarks`. Kein eigener GAEB-Parser in anderer Datei für KeyFacts; die Struktur kommt von außen (body.normalized).
- **LLM:** Gleiche Route – (1) `llmExtract(vortext)` auf vollem Legacy-Vortext (keyFacts + keyFactConfidence + riskClauses); (2) `llmKeyFactsFallback(structuredInput, fieldsToRequest)` nur für Lücken bei strukturierter Extraktion; (3) `llmRepairKeyFacts(vortext, keyFacts)` zur Bereinigung.
- **Mischlogik:** Ja. Bei normalisierter Struktur: zuerst Label/Heuristik pro Segment (erstes Treffer gewinnt pro Feld), dann LLM-Fallback für fehlende Felder. Bei Legacy: Regex + LLM, dann mergeKeyFactsPreferRegex (Regex bevorzugt, LLM bei LLM_PREFERRED_FIELDS oder leerem/ungültigem Regex), danach llmRepairKeyFacts.

**Einschätzung:** Extraktion ist klar in der analyze-vortext-Route; Regex, strukturierte Segmente und LLM sind verbunden; keine doppelte Extraktion an anderer Stelle.

---

## 3) Trennung: Raw Extraction vs. Validation vs. Display Mapping

- **Raw Extraction:** In der API: extractKeyFactsRegex, extractValueByLabel, extractKeyFactsFromNormalized, LLM-Aufrufe. Ausgabe: flache keyFacts (Record<string, string>) + keyFactsSourceByField.
- **Validation:**  
  - **In der API:** isGarbageValue, isInvalidOrGenericValue, isWeakOrInvalidFieldValue, validateKeyFactValue (FIELD_MATRIX); Bereinigung vor buildKeyFactsValidated.  
  - **In lib/keyFactsValidation.ts:** validateKeyFactCandidate, validateField (Blacklist, Satzfragment, Positions-Quelle, feldspezifisch); buildKeyFactsValidated ruft validateKeyFactCandidate pro Feld auf.
- **Display Mapping:** In lib: getDisplayValueForStatus(entry) → found + value → value, sonst KEYFACT_FALLBACK_LABEL. In der Score-Page: keyFactsDisplayList nutzt getDisplayValueForStatus bzw. KEYFACT_FALLBACK_LABEL; Gewerk-Sonderfall (primaryTrade).

**Einschätzung:** Trennung ist vorhanden: Extraktion in der API, Validierung API + lib, Display-Mapping in lib + Score-Page. Validierung ist an zwei Stellen (API-Filter + lib buildKeyFactsValidated); konzeptionell sauber, aber doppelte Prüfung.

---

## 4) Candidate-Modell pro Feld

- **Vorhanden.** `KeyFactFieldEntry` in lib/keyFactsValidation.ts: value, confidence, status (found | missing | rejected), sourceType, sourceText, rejectionReason.  
- **Erzeugung:** buildKeyFactsValidated(keyFacts, keyFactConfidence, sourcesByField) erzeugt pro Feld ein KeyFactFieldEntry über validateKeyFactCandidate.  
- **Nicht:** Es wird nicht „mehrere Kandidaten pro Feld“ verwaltet (kein Array von Kandidaten mit Scoring). Es gibt genau einen Rohwert pro Feld (aus Extraktion/Merge), der dann validiert wird und genau ein Entry ergibt.

**Einschätzung:** Ein Kandidat pro Feld mit Status und optional rejectionReason; kein Multi-Candidate-Modell.

---

## 5) Quellensegmentierung

- **Vorhanden.** In der API: Segmente mit explizitem Typ.  
  - **NormalizedPayload:** globalRemarks[], topLabelForPreface, groups[].label, groupRemarks[].  
  - **VortextSourceTextType:** normalized-global-remarks, normalized-top-label, normalized-groups, normalized-group-remarks, normalized-items, displayNodes, legacy-preface-text, legacy-cleaned-text, raw-text.  
- **Pro Feld** wird sourceTextType und sourcePath gespeichert (keyFactsSourceByField) und an buildKeyFactsValidated übergeben (sourcesByField); in KeyFactFieldEntry als sourceType/sourceText abgelegt.  
- **Keine** expliziten Segmente wie „fileName“, „documentTitle“, „header“, „metaSection“, „preamble“, „positions“ als eigene Typen; aber „normalized-global-remarks“, „normalized-top-label“, „normalized-groups“, „normalized-group-remarks“ entsprechen inhaltlich Meta/Vorbemerkung/Struktur; „normalized-items“/„position“ werden in der Validierung als positionsartig behandelt.

**Einschätzung:** Quellensegmentierung ist vorhanden (GAEB-normalisiert + Legacy); feineres Modell (z. B. header vs. preamble vs. positions) nur teilweise (über sourceTextType und POSITION_LIKE_SOURCES).

---

## 6) Quellenpriorität je Feld

- **Implicit vorhanden, nicht als festes Ranking definiert.**  
  - Bei strukturierter Extraktion: Reihenfolge der Segmente (globalRemarks → topLabelForPreface → groups → groupRemarks); erstes Treffer pro Feld gewinnt; danach LLM-Fallback nur für Lücken.  
  - Bei Legacy-Merge: mergeKeyFactsPreferRegex – Regex füllt zuerst; LLM überschreibt nur bei LLM_PREFERRED_FIELDS oder leerem/ungültigem Regex, Confidence ≥ 0,55.  
- **Kein** explizites Ranking wie „Projektname bevorzugt aus Header/Meta“, „Vertragsgrundlage aus Vergabetext“, „Ort aus Meta“. Priorität ergibt sich aus Ablauf (Struktur zuerst, dann Legacy, LLM als Lückenfüller/Repair).

**Einschätzung:** Quellenpriorität ist über Ablauf und Merge-Regeln umgesetzt; keine konfigurierbare Prioritätsmatrix pro Feld.

---

## 7) Feldspezifische Validierung / Reject-Regeln

- **Wo:** `lib/keyFactsValidation.ts` (validateField) und `app/api/analyze-vortext/route.ts` (FIELD_MATRIX, isInvalidOrGenericValue, isWeakOrInvalidFieldValue).  
- **Wie stark:**  
  - Lib: Blacklist, Satzfragment, Position-Quelle für Stammdaten, maxLength, dann switch(field): bauvorhaben (zu lang, likely_id_not_name), ort (no_location_signal), bauherr_ag, vertragsgrundlagen (no_contract_signal), projektart (no_project_type_signal), Frist-/Datumsfelder (no_date_signal, date_fragment, date_too_long).  
  - API: FIELD_MATRIX für viele Felder (positivePatterns, negativePatterns, requiredSignal, maxLength); isInvalidOrGenericValue, isWeakOrInvalidFieldValue vor Übernahme in keyFacts.  
- **Felder:** Praktisch alle genutzten KeyFact-Felder haben entweder in der lib oder in der API spezifische Regeln.

**Einschätzung:** Feldspezifische Validierung und Reject-Regeln sind vorhanden und recht stark (lib + API).

---

## 8) Garbage-Filter / Blacklist

- **Wo:**  
  - **lib/keyFactsValidation.ts:** GARBAGE_EXACT (n/a, n.a., na, none, unknown, tbd, folgt, k.a., keine angabe, …), GARBAGE_PATTERNS (Regex-Liste), isRejectedByBlacklist; zusätzlich Kurzwerte, nur Sonderzeichen, nur Ziffern, zu wenig Buchstaben; looksLikeSentenceFragment; looksLikePositionText.  
  - **app/api/analyze-vortext/route.ts:** isGarbageValue (eigene Implementierung: VALID_SHORT_VALUES, Längen-/Fragment-/Prozedural-Phrasen-Checks).  
- **Global vs. feldspezifisch:** Blacklist/Garbage in der lib ist global (für alle Felder in validateField); in der API wird isGarbageValue global auf jeden Kandidaten angewendet. Feldspezifisch sind nur die zusätzlichen validateField-/FIELD_MATRIX-Regeln.

**Einschätzung:** Garbage-Filter und Blacklist sind vorhanden (lib + API); teilweise doppelt (z. B. „keine angabe“, Fragmente), aber konsistent genutzt.

---

## 9) LLM-Extraktion für KeyFacts

- **Vorhanden.** In analyze-vortext/route.ts:  
  - **llmExtract(vortext):** Volles Schema (riskClauses + keyFacts + keyFactConfidence) auf Vortext; KEYSET-Felder; cleanKeyFacts/cleanKeyFactConfidence nach Parsing.  
  - **llmKeyFactsFallback(structuredInput, fieldsToRequest):** Nur strukturierte Texte (globalRemarks, topLabelForPreface, groups); nur für LLM_FALLBACK_FIELDS und nur für fehlende Felder.  
  - **llmRepairKeyFacts(vortext, keyFacts):** Bereinigung/Reparatur bestehender keyFacts (keine neuen Felder).  
- **Textsegmentierung:** llmExtract = ganzer Vortext; LLM-Fallback = nur strukturierte Segmente (kein Positions-Text).  
- **Validierung:** LLM-Output wird mit isGarbageValue, isInvalidOrGenericValue, isWeakOrInvalidFieldValue, validateKeyFactValue geprüft; LLM-Fallback nur bei validation.valid && notGarbage; danach buildKeyFactsValidated (lib) für alle Felder.

**Einschätzung:** LLM-Extraktion ist für alle KeyFact-Felder (über KEYSET) und für Lücken (LLM-Fallback) vorhanden; Validierung nach LLM ist eingebaut.

---

## 10) Finale Auswahl eines KeyFact-Werts

- **Strukturierter Pfad:** Pro Segment (globalRemarks, topLabel, groups, groupRemarks) wird pro Feld nur der erste Treffer übernommen (`if (keyFacts[field]) continue`). Label vor Heuristik. Danach LLM-Fallback nur für leere Felder.  
- **Legacy-Pfad:** mergeKeyFactsPreferRegex: Regex füllt; LLM überschreibt nur wenn LLM_PREFERRED_FIELDS oder kein/ungültiger Regex-Wert, und Confidence ≥ 0,55.  
- **Quellenranking:** Kein explizites Punktesystem; Reihenfolge = Priorität (Struktur → Legacy-Fallback; innerhalb Legacy: Regex vor LLM mit obigen Bedingungen).  
- **Fallback:** Bei Struktur + Lücken: Legacy-Vortext wird pro Feld gefüllt (legacy-fallback), sofern noch leer; danach llmRepairKeyFacts.  
- **Gewerk:** Kein Sonderweg bei der Extraktion; Sonderfall nur in der UI (detectedTrades.primaryTrade, siehe unten).

**Einschätzung:** „Erster Treffer“ + „Regex vor LLM (mit Ausnahmen)“ + LLM-Fallback für Lücken; kein Scoring, kein explizites Quellen-Ranking.

---

## 11) Wo wird found / missing / rejected für die UI entschieden?

- **Entscheidung:** In `lib/keyFactsValidation.ts` – `validateKeyFactCandidate` setzt status auf "missing" (kein Wert), "rejected" (Validierung fehlgeschlagen) oder "found". `buildKeyFactsValidated` erzeugt für alle Keys der internen Menge (inkl. der 12) ein Entry; fehlt Rohwert oder Validierung schlägt fehl → missing/rejected.  
- **UI:** In `app/admin/score/page.tsx` – keyFactsDisplayList nutzt entry?.status; bei "found" + value wird Wert angezeigt, sonst getDisplayValueForStatus → KEYFACT_FALLBACK_LABEL ("im LV nicht zuverlässig erkannt"). Gewerk: found → value; sonst primaryTrade → value; sonst Fallback.  
- **Rückgabe:** API liefert keyFactsValidated (Record<string, KeyFactFieldEntry>); die Score-Page speichert das und leitet es in keyFactsDisplayList weiter. Kein zweiter Ort, der found/missing/rejected setzt.

**Einschätzung:** Status wird einmalig in der lib gesetzt; UI folgt diesem Status über getDisplayValueForStatus und Gewerk-Fallback.

---

## 12) Verbindung detectedTrades ↔ KeyFact „Gewerk“ ↔ Haupt-/weitere Gewerke

- **detectedTrades:** Wird in `app/api/score/route.ts` aus detectDisciplines gebaut (`buildDetectedTrades(det)`); enthält primaryTrade, secondaryTrades, confidence. Unabhängig von der Vortext-/KeyFacts-Pipeline.  
- **KeyFact „Gewerk“:** Wird wie alle anderen KeyFacts aus Vortext/Struktur/LLM extrahiert (Regex/Label/LLM); kein direkter Datenfluss von detectedTrades in die analyze-vortext-Route.  
- **UI (Hauptgewerk):** In der Score-Page: Für die Zeile „Gewerk“ in keyFactsDisplayList – wenn keyFactsValidated.gewerk.status === "found" und value vorhanden → Anzeige dieses Werts; sonst Fallback auf `detectedTrades.primaryTrade`; wenn der auch fehlt → KEYFACT_FALLBACK_LABEL.  
- **Weitere Gewerke:** Werden nur im Block „Erkannte Gewerke“ in AnalyseCockpitView angezeigt (secondaryTrades als Badges); nicht in der KeyFacts-Tabelle. Es gibt keine zweite KeyFact-Zeile „Weitere Gewerke“; die 12 Zeilen enthalten nur eine Gewerk-Zeile (Hauptgewerk aus KeyFacts oder primaryTrade).

**Einschätzung:** Sauber getrennt: KeyFact Gewerk = Vortext/Struktur/LLM; Fallback in der UI auf primaryTrade; weitere Gewerke nur im separaten „Erkannte Gewerke“-Block, nicht in den 12 Facts.

---

## C) Einschätzung: Vorhanden / Teilweise / Fehlt

| Thema | Vorhanden | Teilweise | Fehlt |
|-------|-----------|-----------|--------|
| 12-Facts-Definition & Reihenfolge | ✅ (lib + API) | – | Doppelte Definition (lib/API) |
| Zentrale Feldliste (Single Source) | – | ✅ (inhaltlich gleich) | Eine echte Single Source |
| Extraktion (Regex + Label + LLM) | ✅ | – | – |
| Quellensegmentierung (Segmente/Typen) | ✅ | – | Feineres Modell (header/preamble/positions) nur implizit |
| Quellenpriorität pro Feld | – | ✅ (über Ablauf) | Konfigurierbare Prioritätsmatrix |
| Trennung Extraktion / Validierung / Display | ✅ | – | – |
| Candidate-Modell (ein Entry pro Feld) | ✅ | – | Multi-Candidate/Scoring |
| Feldspezifische Validierung/Reject | ✅ | – | – |
| Garbage/Blacklist | ✅ | – | – |
| LLM-Extraktion + Validierung | ✅ | – | – |
| Status found/missing/rejected | ✅ | – | – |
| Display-Mapping (Fallback-Text) | ✅ | – | – |
| Gewerk + detectedTrades (UI) | ✅ | – | – |
| Expertenmodus (sourceType, rejectionReason, raw) | – | ✅ (Confidence nur) | sourceType/rejectionReason/raw in UI |

---

## D) Empfehlung

- **Erhalten:**  
  - Gesamte Validierungskette (lib: buildKeyFactsValidated, validateKeyFactCandidate, Blacklist, feldspezifische Regeln, POSITION_LIKE_SOURCES).  
  - Extraktionsablauf in der API (Struktur → Label/Heuristik → LLM-Fallback, Legacy Regex+LLM+Repair).  
  - keyFactsValidated als zentrales Objekt (Status + sourceType + rejectionReason).  
  - 12er-Anzeige (KEYFACTS_DISPLAY_ORDER_12, keyFactsDisplayList, getDisplayValueForStatus, KEYFACT_FALLBACK_LABEL).  
  - Gewerk-Logik: KeyFact bevorzugt, Fallback primaryTrade in der UI; weitere Gewerke im eigenen Block.  

- **Refactoring (ohne Verhalten zu ändern):**  
  - 12-Facts-Liste an einer Stelle definieren (z. B. nur in lib exportieren) und in der API importieren, um Duplikate zu vermeiden.  
  - Optional: CORE_KEYFACTS_VISIBLE_ORDER (9) in der Score-Page durch KEYFACTS_DISPLAY_ORDER_12 oder eine abgeleitete „sichtbare“ Teilmenge ersetzen, falls nur noch 12 Zeilen relevant sind.  

- **Neu ergänzen (optional):**  
  - Expertenmodus: keyFactsValidated (oder sourceType, rejectionReason, raw candidate) an die UI übergeben und bei expertMode anzeigen.  
  - Optional: „Weitere Gewerke“ als eigene Zeile unter den 12 (z. B. „Weitere Gewerke: A, B, C“), wenn gewünscht.  
  - Optional: Quellenpriorität pro Feld als Konfiguration (z. B. Projektname bevorzugt aus topLabel/Meta), falls fachlich gewünscht.  

---

## E) Hybridlogik: Bereits vorhanden?

**Ja, in Teilen vollständig umgesetzt:**

- **Regex:** Pro Segment und auf Legacy-Vortext; feldspezifische Patterns.  
- **Quellenpriorität:** Über Ablauf (Struktur zuerst, dann Legacy; Label vor Heuristik; LLM als Lückenfüller/Repair); kein konfigurierbares Ranking.  
- **LLM:** Voll-Vortext (llmExtract), Lücken-Fallback (llmKeyFactsFallback), Repair (llmRepairKeyFacts).  
- **Validation:** Zwei Stufen (API: Garbage/FIELD_MATRIX; lib: Blacklist, Satzfragment, Position-Ausschluss, feldspezifisch); finale Status-Entscheidung in buildKeyFactsValidated.  
- **Display:** Einheitlich found → Wert, sonst „im LV nicht zuverlässig erkannt“; Gewerk mit primaryTrade-Fallback.  

**Was fehlt für eine „vollständige“ Hybridlogik:**

- Explizites Quellen-Ranking pro Feld (z. B. Projektname: Meta > Header > Preamble > Positions).  
- Multi-Candidate-Scoring (mehrere Kandidaten pro Feld, dann Auswahl nach Score).  
- Experten-Infos (sourceType, rejectionReason, raw) in der UI.  

**Fazit:** Die Architektur ist bereits eine echte Hybridlogik (Regex + strukturierte Quellen + LLM + Validierung) mit klarer Trennung und fester 12-Facts-Anzeige. Keine doppelte Extraktion; Duplikate nur bei der Definition der 12 Felder (lib vs. API). Nichts neu bauen; bei Erweiterungen bestehende Stellen (KEYFACTS_DISPLAY_ORDER_12, buildKeyFactsValidated, keyFactsDisplayList, getDisplayValueForStatus) wiederverwenden und nur gezielt ergänzen.
