# UI/UX-Konzept: Standard- und Expertenmodus

**Gültig für:** TGA-LV-Tool (Next.js, `/admin/score`, `/admin/triggers`)  
**Ziel:** Professionelleres B2B-SaaS-Interface mit zwei Bedienmodi. Keine Fachlogik- oder Feature-Änderung; nur Struktur, Sichtbarkeit, Bedienung und Gruppierung.

---

## 1. Seitenstruktur

Die bestehende Score-Seite wird in **fünf klar getrennte Zonen** gegliedert. Inhalte und Funktionen bleiben dieselben; nur Anordnung und Sichtbarkeit werden gesteuert.

### 1.1 Header

- **Links:** App-Name / Logo (z. B. „TGA LV Tool“), optional kurzer Untertitel (eine Zeile).
- **Rechts:**  
  - Modus-Umschalter (Standard / Experte) – siehe Abschnitt 2.  
  - Link „Trigger-Admin“ (wie bisher zu `/admin/triggers`).
- **Konstant:** Immer sichtbar, gleiche Höhe; keine abhängigen States außer Modus.

### 1.2 Upload / Eingabe

- **Inhalt (unverändert fachlich):**
  - Dropzone (Drag & Drop)
  - Button „Datei wählen“ + verstecktes File-Input
  - Textarea für LV-Text
  - Datei-Limit-Hinweis (z. B. „Limit: 10 MB“)
- **Sichtbarkeit:**
  - **Standard:** Dropzone, Datei wählen, Textarea, Limit-Hinweis. Kein „Auto-Analyse“-Checkbox, kein „LLM-Split neu“, kein „LLM-Relevanzfilter“ in dieser Zone.
  - **Experte:** Zusätzlich in derselben Card: Auto-Analyse-Checkbox, Button „LLM-Split neu ausführen“, Checkbox „LLM-Relevanzfilter“, Button „Reset“ (oder Reset bleibt für beide sichtbar – siehe unten).
- **Aktion:** Ein Hauptbutton „Analysieren“ (wie bisher); gleicher Handler, gleicher Payload (useLlmRelevance aus State, auch wenn Checkbox nur im Expertenmodus sichtbar ist).

### 1.3 Analyseoptionen

- **Idee:** Alle Steuerungen, die die *Art* der Analyse beeinflussen (nicht die Eingabe selbst), hier bündeln.
- **Standard:** Diese Zone kann **entweder** weggelassen werden (Defaults: Auto-Analyse on, LLM-Relevanz off, kein manueller Split) **oder** als sehr kompakte Zeile mit nur „Analysieren“ + ggf. Reset erscheinen.
- **Experte:** Sichtbare „Analyseoptionen“-Sektion (Card oder klar abgegrenzter Block) mit:
  - Auto-Analyse (Checkbox)
  - LLM-Relevanzfilter (Checkbox)
  - LLM-Split neu ausführen (Button)
  - Reset (Button)
  - Optional: Hinweis auf Debug-URL `?debug=1` für Score-Debug.
- **Umsortierung:** Elemente, die heute in der Upload-Card stehen (Auto-Analyse, LLM-Relevanz, LLM-Split, Reset), werden im Expertenmodus hierher *optisch* gruppiert; State und Handler bleiben unverändert (keine neuen Handler, keine neuen States).

### 1.4 Ergebnisbereich

Gliederung in **Blöcke in fester Reihenfolge** (von oben nach unten). Inhalt und Datenquelle unverändert; nur Sichtbarkeit pro Modus.

1. **Score-Übersicht**  
   - Gesamt-Score + Ampel (Zahl, Balken, Label).  
   - Risiko-Ampel je Kategorie (5 Balken).  
   - **Beide Modi:** sichtbar.

2. **Key Facts (Vortext)**  
   - Wie heute: KeyFacts aus Vortext-Analyse, ggf. Confidence.  
   - **Standard:** Karte mit den Feldern; Confidence kann ausgeblendet werden.  
   - **Experte:** wie heute inkl. Confidence.

3. **Vortext-Risiken**  
   - riskClauses-Liste (type, riskLevel, text, interpretation).  
   - **Beide Modi:** sichtbar (für schnelle Einschätzung im Standard wichtig).

4. **Findings (Treffer)**  
   - **Standard:** Eine **einheitliche Liste** aller Findings (DB + SYS + LLM kombiniert), sortiert z. B. nach Penalty absteigend (oder Severity). Keine Filterleiste, keine getrennten Blöcke „SUPABASE TRIGGER“ / „SYSTEM CHECKS“ / „LLM-ANALYSE“. Keine Anzeige von IDs/Quelle in der ersten Zeile (optional: nur bei Klick/Expand).  
   - **Experte:** Filter-Card (Suche, Quelle, Severity, Kategorie, Sortierung, Top 10, Reset) + getrennte Blöcke DB / SYS / LLM / Other wie heute; alle IDs und Quellen sichtbar.

5. **Rückfragen & Annahmen**  
   - **Standard:** Eine Card „Rückfragen & Annahmen“ mit zwei Buttons: „Rückfragen generieren“, „Annahmen generieren“. Darunter die gruppierten Listen (technisch/vertraglich/terminlich); **ohne** Debug-Bereiche (Quelle→Rückfrage, Finding→Frage→Annahme).  
   - **Experte:** Gleiche Card inkl. Debug-Bereiche.

6. **Nachtragsanalyse**  
   - **Standard:** Eine Card mit einem Button „Nachtragspotenziale ermitteln“. Keine Checkbox „LLM ergänzen“, keine Debug-Zeile (ruleBasedCount, llmCount, deduplicatedCount). Ausgabe nach Clustern wie heute; sourceFindingIds/sourceTextSnippets/sourceType können in der Standard-Ansicht weggelassen oder gekürzt werden.  
   - **Experte:** Zusätzlich Checkbox „LLM ergänzen“ und Debug-Zeile; volle Quellen-Anzeige.

7. **GAEB Preview / Split**  
   - **Standard:** **Nicht sichtbar.** (Split läuft weiter im Hintergrund bei Datei-Upload; Nutzer sieht nur Ergebnis.)  
   - **Experte:** Volle Card wie heute (Tabs: LLM Vortext, LLM Positionen, Vortext guess, Positionen guess, Raw, Clean; „In Textfeld übernehmen“; Zeichenzahlen).

8. **Score-Debug**  
   - **Standard:** Nicht sichtbar.  
   - **Experte:** Nur sichtbar, wenn `result.debug` existiert (z. B. `?debug=1`); gleiche Felder wie heute (disciplines, triggersUsed, llmMode, findingsBeforeLlm/AfterLlm, sizeF, perCategorySum).

### 1.5 Einstellungsbereich

- **Standard:** Kein eigener „Einstellungsbereich“. Alle wirksamen Defaults sind implizit (z. B. useLlmRelevance = false, changeOrderUseLlm = false).  
- **Experte:** Optional eine **kompakte Card „Einstellungen“** (z. B. am rechten Rand oder unter dem Modus-Umschalter), die nur die bereits vorhandenen Optionen bündelt:  
  - Auto-Analyse  
  - LLM-Relevanzfilter  
  - (Später erweiterbar, ohne jetzt Logik zu ändern)  
  Alternativ: Diese Optionen bleiben in „Analyseoptionen“; dann entfällt eine separate Einstellungs-Card.  
- **Keine neuen Einstellungen:** Es werden keine neuen Features oder Konfigurationen eingeführt; nur vorhandene UI-Elemente umgruppiert oder ein-/ausgeblendet.

---

## 2. Modus-Umschalter (Standard / Experte)

- **Position:** Im Header rechts, vor dem Link „Trigger-Admin“. Gut sichtbar, aber nicht dominant (z. B. Segment-Button oder Toggle, kein Full-Width-Banner).
- **Darstellung:**  
  - Zwei Zustände: „Standard“ und „Experte“ (oder „Erweitert“).  
  - Ein Klick wechselt den Modus; State z. B. `isExpertMode` (boolean).  
  - Optional: Persistenz per `localStorage` oder URL-Query (`?mode=expert`), damit der Modus beim Reload erhalten bleibt. Keine Pflicht für MVP.
- **Verhalten:**  
  - Nur UI-Sichtbarkeit wird gesteuert (siehe Abschnitte 3 und 4).  
  - Keine API-Parameter oder Logik abhängig vom Modus; alle bestehenden States (useLlmRelevance, changeOrderUseLlm, autoAnalyze, Filter, etc.) bleiben technisch unverändert. Im Standardmodus sind die zugehörigen Eingaben ausgeblendet; ihre Werte bleiben auf dem aktuellen Stand (typisch: Defaults).

---

## 3. Elemente im Standardmodus (sichtbar)

- **Header:** App-Name, Modus-Umschalter, Link Trigger-Admin.
- **Upload/Eingabe:** Dropzone, Datei wählen, Textarea, Limit-Hinweis, Button „Analysieren“, Button „Reset“ (Reset kann auch nur Experte sein – dann im Standard nur „Analysieren“).
- **Ergebnisbereich (wenn `result` vorhanden):**
  - Score-Übersicht (Gesamt + 5 Kategorien)
  - Key Facts (ohne Confidence, optional)
  - Vortext-Risiken
  - Findings: **eine** kombinierte Liste (sortiert), ohne Filterleiste, ohne Unterteilung DB/SYS/LLM
  - Rückfragen & Annahmen: zwei Buttons + Listen, ohne Debug
  - Nachtragsanalyse: ein Button + Cluster-Ausgabe, ohne „LLM ergänzen“, ohne Debug-Zeile
- **Nicht sichtbar im Standard:** GAEB-Preview-Card, Score-Debug-Card, Auto-Analyse-Checkbox, LLM-Relevanzfilter-Checkbox, Button „LLM-Split neu“, Filter-Card (Suche, Quelle, Severity, Kategorie, Sort, Top 10, Reset), getrennte Findings-Blöcke (DB/SYS/LLM), alle Debug-Bereiche, „LLM ergänzen“ bei Nachtragsanalyse.

---

## 4. Elemente im Expertenmodus (zusätzlich sichtbar)

- **Upload/Eingabe oder Analyseoptionen:**  
  Auto-Analyse (Checkbox), LLM-Relevanzfilter (Checkbox), Button „LLM-Split neu ausführen“, ggf. Reset hier oder in Analyseoptionen.
- **Ergebnisbereich:**  
  - Filter-Card: Suche, Quelle (alle/DB/SYS/LLM), Severity, Kategorie, Sortierung, Top 10, Reset; Zähler DB/SYS/LLM/Other.  
  - Findings in getrennten Blöcken: SUPABASE TRIGGER, SYSTEM CHECKS, LLM-ANALYSE, Other.  
  - Rückfragen & Annahmen: Debug-Bereiche (Quelle→Rückfrage, Finding→Frage→Annahme).  
  - Nachtragsanalyse: Checkbox „LLM ergänzen“, Debug-Zeile (ruleBasedCount, llmCount, deduplicatedCount), volle Quellen (sourceFindingIds, sourceTextSnippets, sourceType).  
  - GAEB-Preview-Card: alle Tabs, „In Textfeld übernehmen“, Zeichenzahlen.  
  - Score-Debug-Card: wenn `result.debug` gesetzt (z. B. `?debug=1`).
- **Optional:** Einstellungs-Card mit denselben Optionen (Auto-Analyse, LLM-Relevanz) nur zur Bündelung; keine zusätzliche Logik.

---

## 5. Umsortierung ohne Funktionsänderung

- **Keine neuen Handler:** Kein neuer `onClick`/`onChange` außer für den Modus-Umschalter (`setIsExpertMode` oder Lesen von URL).
- **Keine neuen API-Calls:** Alle `fetch` (Score, Vortext, Split, Preview, Rückfragen, Annahmen, Nachtragsanalyse, Test-Trigger) bleiben unverändert aufgerufen mit denselben Parametern.
- **Bestehende States:** `lvText`, `result`, `useLlmRelevance`, `changeOrderUseLlm`, `autoAnalyze`, `sourceFilter`, `severityFilter`, `categoryFilter`, `search`, `sortMode`, `top10`, alle übrigen States werden weder umbenannt noch in ihrer Bedeutung geändert. Nur die **Rendering-Bedingung** (sichtbar ja/nein) hängt vom Modus ab.
- **Umsortierung rein visuell:**  
  - Elemente, die heute in der Upload-Card stehen (Auto-Analyse, LLM-Relevanz, LLM-Split, Reset), können im Expertenmodus in einer „Analyseoptionen“-Sektion gerendert werden; sie nutzen weiter dieselben State-Setter (`setAutoAnalyze`, `setUseLlmRelevance`, etc.).  
  - Optional: Dieselben Elemente an zwei Stellen rendern (z. B. einmal in Upload, einmal in Analyseoptionen), wobei nur eine Stelle pro Modus sichtbar ist – vermeidet Duplikation von Logik, nur Duplikation von JSX mit gleichen Props/Handlern.

---

## 6. Komponenten (Auslagerung / Anlegen)

Empfehlung: **Zuerst** nur mit einem Modus-State und bedingtem Rendern in der bestehenden Page arbeiten; **danach** schrittweise auslagern, um Wartbarkeit zu verbessern. Keine Logik verschieben, nur JSX und ggf. Props durchreichen.

- **AnalysisModeToggle**  
  - Inhalt: Umschalter Standard/Experte (z. B. zwei Buttons oder ein Toggle).  
  - Props: `value: boolean`, `onChange: (v: boolean) => void`.  
  - Keine eigene Logik außer Darstellung und Aufruf von `onChange`.  
  - Einsatz: Header der Score-Seite.

- **ResultsSummaryCard**  
  - Inhalt: Gesamt-Score (Zahl, Ampel, kurzer Balken) + optional die 5 Kategorien-Balken (kann auch in einer zweiten Komponente bleiben).  
  - Props: `result` (total, level, perCategory).  
  - Bestehende Logik (clamp0_100, traffic, levelMeta, ScoreBarsCard) kann hierher verschoben werden oder als reine Darstellungskomponente die bereits berechneten Werte erhalten.  
  - Einsatz: oberster Block im Ergebnisbereich.

- **FindingsList** (oder **FindingsListStandard** / **FindingsListExpert**)  
  - **Standard-Variante:** Eine flache Liste aus `result.findingsSorted` (oder aus dem bereits gefilterten Array, z. B. mit festen Defaults: sourceFilter=both, sortMode=penalty_desc), ohne Filter-UI, ohne Unterteilung nach Quelle.  
  - **Experten-Variante:** Filter-Card + getrennte Blöcke DB/SYS/LLM/Other; nutzt `filteredFindings`, `dbFindings`, `sysFindings`, `llmFindings`, `otherFindings`.  
  - Beide Varianten: gleiche Datenbasis und gleiche State-Quellen; nur Darstellung und Sichtbarkeit von Filter/Blöcken unterschiedlich.  
  - Optional: Eine Komponente mit `mode: 'standard' | 'expert'` und intern zwei Darstellungszweige.

- **FilterPanel** (Experte)  
  - Inhalt: Suche, Quelle-Dropdown, Severity-Dropdown, Kategorie-Dropdown, Sortierung-Dropdown, Top-10-Checkbox, Reset-Button, Zähler DB/SYS/LLM/Other.  
  - Props: alle aktuellen States und Setter (search, sourceFilter, severityFilter, categoryFilter, sortMode, top10, resetFilters, dbFindings.length, etc.).  
  - Nur Darstellung und Event-Bindung; Filterlogik bleibt in der Page (useMemo filteredFindings).

- **LlmOptionsPanel** (Experte)  
  - Inhalt: Auto-Analyse, LLM-Relevanzfilter, Button „LLM-Split neu ausführen“.  
  - Props: autoAnalyze, useLlmRelevance, setAutoAnalyze, setUseLlmRelevance, onReSplit (runGaebSplitLLM), splitLoading, lastFile.  
  - Reine Bündelung der bestehenden Inputs; keine neuen States.

- **GaebPreviewCard** (Experte)  
  - Inhalt: aktuelle GAEB-Preview-Card (Tabs, Pre, „In Textfeld übernehmen“, Zeichenzahlen).  
  - Props: gaebPreview, gaebTab, setGaebTab, gaebTextForTab, setLvText, effectiveVortextLen, effectivePositionsLen, split, gaebPreviewLoading, gaebPreviewError, splitError.  
  - 1:1 Auslagerung des bestehenden Blocks.

- **SettingsPanel** (optional, Experte)  
  - Falls gewünscht: Bündelung von Auto-Analyse, LLM-Relevanzfilter in einer kleinen Card „Einstellungen“. Kann dieselben Props wie LlmOptionsPanel nutzen oder nur eine Teilmenge.  
  - Ohne SettingsPanel: diese Optionen bleiben in LlmOptionsPanel / Analyseoptionen.

- **TriggerControlPanel**  
  - Nicht auf der Score-Seite; nur relevant für `/admin/triggers`.  
  - Dort: optional eine Card „Trigger-Steuerung“ mit CSV Import/Export, Refresh (bereits vorhanden). Keine neue Logik; nur optische Gruppierung.  
  - Oder: Trigger-Seite unverändert lassen und nur später visuell aufräumen.

- **DebugCard** (Experte)  
  - Inhalt: Score-Debug (result.debug).  
  - Props: result.debug.  
  - Nur sichtbar wenn `result?.debug` und `isExpertMode`.

Keine neuen globalen Stores oder Context nötig; Modus-State kann in der Score-Page bleiben und bei Bedarf per Props an die ausgelagerten Komponenten gegeben werden.

---

## 7. Reihenfolge der Umsetzung (risikoarm)

1. **Modus-State und Toggle (ohne Auslagerung)**  
   - In `app/admin/score/page.tsx`: `isExpertMode` (useState, Default false).  
   - Einfacher Toggle/Buttons im Header: „Standard“ | „Experte“; Klick setzt State.  
   - Noch keine Sichtbarkeitslogik; nur Toggle einbauen und prüfen.

2. **Sichtbarkeit steuern (bedingtes Rendern)**  
   - Mit `isExpertMode` die bestehenden Blöcke ein-/ausblenden:  
     - GAEB-Preview-Card: nur wenn `isExpertMode`.  
     - Score-Debug-Card: nur wenn `isExpertMode && result?.debug`.  
     - Auto-Analyse, LLM-Relevanzfilter, LLM-Split-Button: nur wenn `isExpertMode`.  
     - Filter-Card: nur wenn `isExpertMode`.  
     - Getrennte Findings-Blöcke (DB/SYS/LLM): nur wenn `isExpertMode`; sonst eine kombinierte Liste (gleiche Daten, z. B. filteredFindings mit sourceFilter=both fest).  
     - Debug in Rückfragen/Annahmen/Nachtragsanalyse: nur wenn `isExpertMode`.  
     - „LLM ergänzen“ und Nachtrags-Debug-Zeile: nur wenn `isExpertMode`.  
   - Keine neuen Komponenten; nur `{isExpertMode && (...)}` bzw. `{!isExpertMode && (...)}` um bestehende JSX-Blöcke.  
   - Test: Beide Modi durchklicken, alle Flows (Upload, Analysieren, Rückfragen, Annahmen, Nachtragsanalyse) unverändert.

3. **Standardmodus: eine Findings-Liste**  
   - Wenn `!isExpertMode`: Statt Filter-Card + DB/SYS/LLM-Blöcken eine einzige Liste rendern (z. B. `filteredFindings` mit festen Defaults oder `result.findingsSorted` mit fester Sortierung).  
   - Keine neuen States; evtl. ein useMemo „standardFindings“ = sortierte/gefilterte Liste mit Default-Filterwerten, oder direkte Nutzung von findingsSorted + Sortierung.

4. **Optionale Analyseoptionen-Sektion (Experte)**  
   - Im Expertenmodus: Auto-Analyse, LLM-Relevanz, LLM-Split, Reset in eine eigene Card „Analyseoptionen“ verschieben (oder unter der Upload-Card); in der Upload-Card diese Elemente im Expertenmodus ausblenden, um Doppelung zu vermeiden.  
   - Weiterhin dieselben States und Handler.

5. **Auslagern: AnalysisModeToggle**  
   - JSX des Umschalters in `AnalysisModeToggle.tsx` auslagern; Props `value`, `onChange`.  
   - In der Page nur noch `<AnalysisModeToggle value={isExpertMode} onChange={setIsExpertMode} />`.

6. **Auslagern: weitere Komponenten (optional)**  
   - Nacheinander: ResultsSummaryCard, FindingsList (Standard/Experte), FilterPanel, LlmOptionsPanel, GaebPreviewCard, DebugCard.  
   - Jedes Mal: bestehenden JSX-Block 1:1 in Komponente verschieben, Props = bisherige State/Handler; Page rendert Komponente mit denselben Werten.  
   - Keine Logik in neue Dateien verschieben (Filter-Berechnung, useMemo etc. bleiben in der Page), außer rein darstellende Hilfsfunktionen (z. B. traffic, levelMeta).

7. **Trigger-Seite und Startseite**  
   - `/admin/triggers`: nur optisch aufräumen (Abstände, Typo, Cards), kein Modus.  
   - `/`: optional Link „Zur Analyse“ auf `/admin/score`; optional Hinweis auf Modus (z. B. „Standardmodus für schnelle Analyse“).  
   - Keine Logikänderung.

8. **Persistenz Modus (optional)**  
   - `isExpertMode` in localStorage schreiben/lesen oder URL `?mode=expert` setzen/lesen; beim Mount Modus daraus setzen.  
   - Keine Änderung an API oder Fachlogik.

Damit bleibt die bestehende Fachlogik und alle Features erhalten; nur Struktur, Sichtbarkeit und Gruppierung werden angepasst, und die Umsetzung erfolgt schrittweise mit geringem Risiko.
