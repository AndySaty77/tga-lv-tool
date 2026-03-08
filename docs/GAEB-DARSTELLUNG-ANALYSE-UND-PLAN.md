# GAEB-Darstellung in /analyse: Bestandsaufnahme und risikoarmer Verbesserungsplan

**Stand:** Analyse der aktuellen Implementierung  
**Ziel:** Darstellung wie ein Dokument-Viewer, nicht wie ein Debug-Textfeld.  
**Einschränkung:** Noch kein riskanter Umbau; keine Analyse-/Scoring-Logik ändern.

---

## 1. Wie die GAEB-Daten aktuell in /analyse dargestellt werden

### 1.1 Sichtbarkeit und Kontext

- Die GAEB-Darstellung erscheint **nur im Expertenmodus** (`isExpertMode === true`), unter dem Upload-Bereich.
- Block: **„Dateistruktur“** (Kundenroute) bzw. **„Struktur des Leistungsverzeichnisses“** (Admin).
- Voraussetzung: `!gaebPreviewLoading && (gaebPreview || split)` – also entweder GAEB-Preview und/oder LLM-Split geladen.

### 1.2 Aktuelle UI-Struktur

- **Tab-Leiste** mit 6 Optionen (alle gleichberechtigt, technische Bezeichnungen):
  - **KI: Einleitungstext** (`llm_vortext`) → `split?.vortext`
  - **KI: Positionen** (`llm_positions`) → `split?.positions`
  - **Einleitung (Struktur)** (`vortext`) → `gaebPreview.vortextGuessClean`
  - **Positionen (Struktur)** (`positions`) → `gaebPreview.positionsGuessClean`
  - **Rohdaten** (`raw`) → `gaebPreview.rawPreview`
  - **Bereinigt** (`clean`) → `gaebPreview.cleanPreview`
- **Ein einziges `<pre>`** (Monospace, `whiteSpace: pre-wrap`, maxHeight 260px, scrollbar) zeigt den **rohen String** des gewählten Tabs (`gaebTextForTab`).
- **Aktion:** Button „In Textfeld übernehmen“ schreibt `gaebTextForTab` in die LV-Textarea.
- **Metadatenzeile** darunter: Zeichenzahlen (Einleitung/Positionen), ggf. Strukturmethode, Vorbemerkungen-Länge, nur in Admin zusätzlich Debug-Zahlen.

### 1.3 Was konkret „zu roh und technisch“ ist

| Tab | Datenquelle | Problem |
|-----|-------------|--------|
| **Rohdaten** | `gaebPreview.rawPreview` = `parsed.rawText` | **Vollständiger Dateiinhalt** – bei GAEB-XML: komplette XML-Struktur, Tags, Namespaces. Für Kunden unlesbar. |
| **Bereinigt** | `gaebPreview.cleanPreview` = `parsed.cleanedText` | HTML/XML-Tags entfernt (`stripHtml`), aber ein **einziger Fließtextblock** ohne Gliederung, Absätze oder Struktur. |
| **Einleitung (Struktur)** | `gaebPreview.vortextGuessClean` = `parsed.prefaceText` | Oft schon textlich bereinigt (Parser-abhängig), aber **keine Absatz-/Überschriftenstruktur**, nur Zeilenumbrüche. |
| **Positionen (Struktur)** | `gaebPreview.positionsGuessClean` = `parsed.itemTexts` | **Konkatenierter Text** aller Positionen (z. B. `\n\n`-getrennt), keine Nummer/Kurztext/Langtext/Menge visuell getrennt. |
| **KI: Einleitungstext** | `split?.vortext` | LLM-Ausgabe; kann **Markdown oder Sonderzeichen** enthalten, aktuell 1:1 im `<pre>`. |
| **KI: Positionen** | `split?.positions` | Analog; ein großer Textblock. |

Kernproblem: **Alles wird als ein einziger Monospace-Textblock in einem `<pre>` ausgegeben.** Es gibt keine dokumentenähnliche Lesansicht (Absätze, Überschriften, ggf. leichte Typografie), keine nutzerfreundliche Struktur- oder Positionsansicht, und der Rohdaten-Tab zeigt echte Rohdaten (XML/HTML) ohne Hinweis „nur für Experten“.

---

## 2. Vorhandene Datenquellen (Backend / API)

### 2.1 API `POST /api/gaeb-preview`

- **Eingabe:** Datei (File).
- **Ausgabe** (relevant für Darstellung):
  - `filename`, `size`
  - **rawPreview** = `parsed.rawText` (Rohtext, kann XML sein)
  - **cleanPreview** = `parsed.cleanedText` (stripHtml des Rohtexts)
  - **vortextGuessClean** / **vortextGuessRaw** = gekürzter `parsed.prefaceText`
  - **positionsGuessClean** / **positionsGuessRaw** = `parsed.itemTexts` (ein String)
  - **structure:**
    - **meta:** u. a. `cutMethod`, `projectName`, `projectId`
    - **vorbemerkungen:** String (wenn Parser trennt)
    - **vortext:** String (Vertragsbedingungen/Vortext, wenn getrennt)
    - **abschnitte:** `sectionTexts` → Array von `{ id?, title, text? }` (Titel/Abschnitte)
    - **positionen:**
      - **raw:** `parsed.itemTexts` (konkatenierter Positions-Text)
      - **items:** `parsed.items` – Array von **strukturierten Positionen** (`GaebItem`: `posNr`, `shortText`, `longText`, `quantity`, `unit`, `raw`) – **nur bei XML-Parser gesetzt**, bei Text-Parser oft fehlend/leer.

### 2.2 API `POST /api/gaeb-split-llm`

- **Eingabe:** Datei.
- **Ausgabe:** `{ vortext, positions }` als lange Strings (LLM-getrennt, bereinigter Ausgangstext).

### 2.3 Parser (lib/gaebParse)

- **parseXml:** Liefert `prefaceText`, `itemTexts`, **items** (strukturierte Positionen mit Kurztext/Langtext/Menge/Einheit), `sectionTexts`.
- **parseText / parseRaw:** Liefern `prefaceText`, `itemTexts`; **items** oft nicht oder nur teilweise; `sectionTexts` z. B. über „TITEL n:“-Heuristik.
- **stripHtml** wird in allen Parsern verwendet; `cleanedText` = stripHtml(rawNorm). Die **Anzeige** nutzt aber teils trotzdem `rawText` (Rohdaten-Tab).

Zusammenfassung Datenquellen:

- **Vortext / Hinweistext:** `prefaceText`, optional getrennt in `vorbemerkungen` und `vortext` (in `structure`), plus LLM-Variante `split.vortext`.
- **Positionen:** Ein String `itemTexts` / `positionen.raw`; **strukturiert** nur bei XML: `structure.positionen.items` (Array von GaebItem).
- **Struktur:** `structure.abschnitte` (Titel), `structure.meta` (cutMethod, projectName), `structure.raw` (vortextEnd, full).
- **Rohdaten:** `rawText` (roh), `cleanedText` (stripHtml).

---

## 3. Wo HTML/XML-Fragmente oder unbereinigte Texte in der UI landen

- **Rohdaten-Tab:** Zeigt **unverändert** `gaebPreview.rawPreview` (= `parsed.rawText`). Bei GAEB-XML-Dateien erscheint die **gesamte XML-Struktur** inkl. Tags. Bei Text-Exporten können Sonderzeichen oder Tool-Artefakte vorkommen.
- **Bereinigt-Tab:** Zeigt `cleanedText` – tags entfernt, aber keine Strukturierung; lange Absätze können schwer lesbar sein.
- **Einleitung (Struktur) / Positionen (Struktur):** Kommen aus dem Parser (prefaceText, itemTexts); bei XML sind die Inhalte aus den Knoten mit stripHtml geholt, können aber noch **CDATA, Sonderzeichen, doppelte Leerzeichen** enthalten. Die **Darstellung** ist trotzdem ein einziges `<pre>`.
- **KI: Einleitungstext / KI: Positionen:** Unverarbeitete LLM-Ausgabe; möglich sind Markdown, Zeilenumbrüche, gelegentlich Halluzinationen oder Formatierungsreste.

Nirgends wird aktuell eine **sicher escapete HTML- oder „Dokumenten“-Ansicht** (z. B. nur für Anzeige mit Absätzen/Überschriften) erzeugt; alles läuft über denselben `<pre>`-Roh-String.

---

## 4. Welche Teile reine Darstellung sind und risikoarm verbessert werden können

- **Keine Änderung nötig (und nicht anfassen):**
  - Analyse-Logik, Scoring, Trigger, Nachtrag/Rückfragen/Klarstellungen.
  - APIs: `/api/gaeb-preview`, `/api/gaeb-split-llm`, `/api/analyze-vortext` – nur deren **Rückgabewerte** werden anders **dargestellt**.
  - Welche Daten wann geladen werden (Upload, Auto-Analyse, Split) und welche Strings an die Analyse übergeben werden.

- **Reine Darstellung (risikoarm verbesserbar):**
  - **Welcher Inhalt** in welchem Tab angezeigt wird (weiterhin aus `gaebPreview` / `split`), aber **wie** er gerendert wird:
    - Statt eines einzigen `<pre>` mit dem Roh-String: **mehrere Ansichten** (Lesansicht, Struktur, Positionen, Rohdaten) mit unterschiedlicher Aufbereitung.
  - **Textaufbereitung nur für die Anzeige:** Absätze (Doppelzeilenumbruch → `<p>` oder Blöcke), Überschriften aus Titeln, Listen – **ohne** die zugrundeliegenden Daten (z. B. `prefaceText`, `itemTexts`, `split`) zu verändern.
  - **Rohdaten-Tab** nur in einer „Experten“-Ansicht anzeigen und ggf. mit Hinweis „Technische Rohdaten“ versehen.
  - **Strukturierte Positionen** nutzen: Wenn `structure.positionen.items` vorhanden ist, diese in einer **Positionsansicht** (Tabelle oder Karten) anzeigen statt nur `positionen.raw` im `<pre>`.

- **Minimales Risiko:** Keine neuen API-Routen, keine Änderung an Parser- oder Analyse-Inputs; nur **Mapping bestehender Daten auf neue UI-Komponenten** und optional eine **Anzeige-Bereinigung** (z. B. normalize Whitespace, Absätze) ausschließlich für das Rendering.

---

## 5. Vorschlag: Viewer-Struktur (4 Ansichten)

Vier klar getrennte Ansichten, die die **gleichen** Datenquellen wie heute nutzen, aber dokumentenähnlich und weniger technisch wirken.

### 5.1 Lesansicht (Standard für Kunden)

- **Ziel:** Wie ein gelesenes Dokument – Einleitung/Vortext und Positionen lesbar, ohne Tags und ohne Debug-Optik.
- **Datenquellen (unverändert):**
  - Vortext: bevorzugt `split?.vortext`, Fallback `gaebPreview.vortextGuessClean` bzw. `structure.vortext` / `structure.vorbemerkungen` (kombiniert oder getrennt, je nach vorhanden).
  - Positionen: bevorzugt `split?.positions`, Fallback `gaebPreview.positionsGuessClean` bzw. `structure.positionen.raw`.
- **Darstellung (nur UI):**
  - Vortext-Bereich: Absätze aus Doppelzeilenumbruch oder sinnvollen Zeilenumbrüchen; optional leichte Überschrift „Einleitung / Vorbemerkungen“. Kein `<pre>`, sondern z. B. `<div>` mit `white-space: pre-wrap` und Absatz-Splits oder einfaches Markdown-Subset (nur Absätze/Zeilenumbrüche).
  - Positionen-Bereich: Entweder denselben Text als lesbaren Block mit Absätzen **oder** (wenn `structure.positionen.items` existiert) eine **Positionsansicht** (siehe unten) – dann Lesansicht = „Vortext lesbar + Positionen als Tabelle/Liste“.
- **Risiko:** Nur Rendering; Datenquelle und Analyse-Input bleiben gleich.

### 5.2 Strukturansicht

- **Ziel:** Dokumentenstruktur sichtbar machen – Abschnitte/Titel, Vortext vs. Positionen, Zeichenumfänge.
- **Datenquellen:** `gaebPreview.structure` (meta, abschnitte, vorbemerkungen, vortext, positionen.raw/items), `split` (Zeichenzahlen).
- **Darstellung:**
  - Meta: Dateiname, cutMethod, Projektname/ID falls vorhanden.
  - „Einleitung“: Länge (Zeichen), ggf. kurzer Vorschau-Text (z. B. erste 200 Zeichen).
  - „Abschnitte“: Liste von `structure.abschnitte` (Titel + optional id).
  - „Positionen“: Anzahl (aus `itemCount` oder `structure.positionen.items?.length` oder Länge von `positionen.raw`), optional Vorschau.
- **Keine Rohdaten**, keine XML-Tags; nur Übersicht und Struktur. Geringes Risiko.

### 5.3 Positionsansicht

- **Ziel:** Positionen als Tabelle oder Liste (Pos.-Nr., Kurztext, Langtext, Menge, Einheit) – wie ein LV-Auszug.
- **Datenquellen:**
  - Wenn `gaebPreview.structure.positionen.items` vorhanden (XML-Parser): **strukturierte Darstellung** (Spalten/Zeilen).
  - Sonst: Fallback auf den bisherigen Textblock `positionen.raw` / `positionsGuessClean`, aber **formatiert** (z. B. Zeilen als Liste, Absätze) statt rohes `<pre>`.
- **Darstellung:** Tabelle oder Karten mit posNr, shortText, longText, quantity, unit; lange Texte kürzbar mit „Mehr“. Keine Logik-Änderung, nur Nutzung von bereits gelieferten `items`.

### 5.4 Rohdatenansicht (nur Experte)

- **Ziel:** Technische Rohdaten für Experten; nicht für Standard-Kunden.
- **Sichtbarkeit:** Nur wenn Expertenmodus aktiv (bereits heute: gesamter Block nur bei `isExpertMode`). Optional: Rohdaten-Tab/Unteransicht explizit als „Rohdaten (Experte)“ beschriften.
- **Inhalt:** Wie heute „Rohdaten“ und ggf. „Bereinigt“ – weiterhin `rawPreview` / `cleanPreview` in einem `<pre>` oder in einem klar als „technisch“ markierten Bereich.
- **Optional:** Hinweis „Zur Fehleranalyse; nicht für die inhaltliche Prüfung.“ Damit ist klar, dass es sich um Debug-/Technik-Ansicht handelt.

---

## 6. Risikoarme Umsetzungsreihenfolge

1. **Lesansicht (Phase 1)**  
   - Neue „Lesansicht“-Darstellung: Vortext- und Positions-String aus bestehenden Quellen nehmen, **nur für die Anzeige** in Absätze/Blöcke gliedern (z. B. `\n\n` → Absätze, kein `<pre>`).  
   - Tabs umbenennen/erweitern: z. B. erster Tab „Lesansicht“, weitere wie heute (oder Struktur/Positionen/Rohdaten).  
   - Keine API-Änderung, keine Änderung der an die Analyse übergebenen Werte.

2. **Strukturansicht (Phase 2)**  
   - Zweiter Tab „Struktur“: Nutzung von `gaebPreview.structure` (meta, abschnitte, Längen) nur für Anzeige.  
   - Keine neuen API-Calls, keine Logik.

3. **Positionsansicht (Phase 3)**  
   - Wenn `structure.positionen.items` existiert: neue Darstellung als Tabelle/Liste.  
   - Fallback: gleicher Text wie heute, aber in lesbarer Form (Absätze/Listen) statt einem einzigen `<pre>`.

4. **Rohdaten nur Experte + Klarstellung (Phase 4)**  
   - Rohdaten- und ggf. Bereinigt-Tab in der bestehenden Experten-Sektion belassen und als „Rohdaten (Experte)“ kennzeichnen.  
   - Optional Hinweistext, dass dies technische Rohdaten sind.

Durchgängig: **Keine Änderung an Analyse-, Scoring- oder API-Logik;** nur Darstellung und Gliederung der bereits vorhandenen Daten in der UI.
