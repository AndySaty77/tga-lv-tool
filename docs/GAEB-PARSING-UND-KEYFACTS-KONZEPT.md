# GAEB-Parsing & Hybrid-KeyFacts – Analyse und Konzept

**Stand:** März 2025  
**Ziel:** Saubere GAEB-Struktur-Extraktion vor LLM-Verbesserungen; regelbasiertes Scoring, KI nur für Interpretation.

---

## 1. Aktuelle Parsing-/Extraktionskette (Analyse)

### 1.1 Datenfluss (High-Level)

```
[Datei-Upload] 
    → gaeb-preview (regelbasiert: findCutIdx)     → vortextGuessRaw / positionsGuessRaw
    → gaeb-split-llm (LLM: Marker finden)         → vortext / positions
    → lvText = roher Dateiinhalt (für Score-Payload)
    
[Analyse]
    → Score-API: body.lvText ODER (body.vortext + body.positions)  → textForAnalysis
    → analyzeLvText(textForAnalysis, dbTriggers)  → Findings (Trigger + System-Checks)
    → Vortext für Risiko/KeyFacts: split.vortext ODER extractVortextUI(lvText)
    → analyze-vortext API (vortext)               → riskClauses + keyFacts (regex + LLM merge)
```

### 1.2 Wo es hakt

| Problem | Ursache (aus Code) |
|--------|---------------------|
| **KeyFacts unzuverlässig** | 1) Vortext oft falsch abgeschnitten → KeyFacts-Suche läuft auf Positions-/Müll-Text. 2) KEYSET fehlt Felder: Bauvorhaben, Ort, Gewerk, Bauherr/AG, Planer, Submission, Wartung/Instandhaltung. 3) LLM bekommt manchmal gekürzten oder gemischten Input. |
| **Vortext-Risiken leer/schwach** | Gleicher Input: wenn Vortext zu kurz oder mit Positions-Resten verseucht ist, liefert LLM wenig/ungenau. |
| **Vortext falsch abgeschnitten** | **gaeb-preview** nutzt nur wenige, export-spezifische Regeln: Dangl-Anchor „Einrichtungsgegenstände“, CaliforniaX „TITEL n:“, XML-Marker, Mengenblock „Zahl + Einheit“. Andere Exporte (z. B. reines GAEB-XML-Export, andere Tools) haben keine Treffer → `fallback-no-cut-found` oder zu früher Cut. |
| **GAEB-Inhalt nicht sauber getrennt** | Es gibt **keine** explizite Struktur „Meta | Vorbemerkungen | Vortext | Abschnitts-/Titeltexte | Positionen“. Alles ist „alles vor Cut = Vortext, danach = Positionen“. Vorbemerkungen vs. allgemeine Vertragsbedingungen werden nicht unterschieden. |
| **Folgefehler** | Trigger/Scoring laufen auf `textForAnalysis` (vortext + positions zusammengefügt). Wenn Vortext Positionsreste enthält, feuern Trigger evtl. doppelt oder auf falschem Kontext; KeyFacts/Risiken basieren auf verseuchtem Vortext. |

### 1.3 Relevante Stellen im Code

- **Vortext-Cut (regelbasiert):** `app/api/gaeb-preview/route.ts` → `findCutIdx()` (Dangl, CaliforniaX, XML, Mengenblock, sonst kein Cut).
- **Vortext-Cut (LLM):** `app/api/gaeb-split-llm/route.ts` → LLM liefert einen „Marker“, dann `findCutByMarker(clean, marker)`; bei nicht gefundenem Marker → 422.
- **Vortext-Fallback UI:** `app/admin/score/page.tsx` → `extractVortextUI()`: sucht erste Zeile mit z. B. `\ntitel `, `\nposition`, `\nmenge` usw., schneidet davor (min. 300 Zeichen Kontext).
- **Welcher Vortext geht in Analyse:** Beim `analyze()` wird `vortextForRisk = split?.vortext ?? extractVortextUI(textToUse)`. Wenn LLM-Split fehlschlägt oder nicht genutzt wird, nur UI-Fallback.
- **KeyFacts:** `app/api/analyze-vortext/route.ts`: Regex `extractKeyFactsRegex`, dann LLM `llmExtract`, dann `mergeKeyFactsPreferRegex`. KEYSET nur Termine/Vertrag/Zahlung, keine Projekt-/Beteiligten-Felder.
- **Trigger/Scoring:** `lib/analyzeLvText.ts` → `preprocessLvText` (XML/HTML raus), dann Keywords/Regex auf dem ganzen Text; keine Trennung Vortext vs. Positionen für Trigger.

---

## 2. Vorgeschlagene Datenstruktur: GAEB-Struktur

Ein **einheitliches Objekt** für die extrahierte GAEB-Struktur (unabhängig ob aus XML, Text-Export oder Hybrid):

```ts
// lib/gaebStructure.ts (neu)

export type GaebStructure = {
  meta: GaebMeta;
  vorbemerkungen: string;   // reine Vorbemerkungen (LV-spezifisch, oft vor „Allgemeine Vertragsbedingungen“)
  vortext: string;          // Vertragsbedingungen, Fristen, Rangfolge, etc. (Kern für Risiko + KeyFacts)
  abschnitte: GaebAbschnitt[];  // Titel/Abschnittstexte (ohne Positionen)
  positionen: GaebPositionBlock; // Rohtext oder strukturierte Positionen
  raw: {
    full: string;
    cutMethod: string;
    vortextStart: number;
    vortextEnd: number;
  };
};

export type GaebMeta = {
  source: "gaeb-xml" | "text-export" | "unknown";
  filename?: string;
  encoding?: string;
  // optional, wenn aus XML: Projektnummer, Bezeichnung, etc.
  projectId?: string;
  projectName?: string;
};

export type GaebAbschnitt = {
  id?: string;
  titel: string;
  text?: string;
  startOffset?: number;
  endOffset?: number;
};

export type GaebPositionBlock = {
  raw: string;
  /** Wenn später: strukturierte Positionen (Kurztext, Langtext, Menge, Einheit, EP…) */
  items?: GaebPositionItem[];
};

export type GaebPositionItem = {
  posNr?: string;
  kurztext?: string;
  langtext?: string;
  menge?: string;
  einheit?: string;
  // … erweiterbar
};
```

**Wichtig:**  
- **vorbemerkungen** und **vortext** getrennt: Vortextanalyse (Risiken + KeyFacts) nur auf `vortext`; Vorbemerkungen optional für Kontext oder spätere eigene Auswertung.  
- **abschnitte** ermöglichen später gewerk-/bereichsbezogene Auswertung ohne in Einzelpositionen zu gehen.  
- **raw** und **cutMethod** bleiben für Debug und Nachvollziehbarkeit.

---

## 3. Parsing-Flow (saubere Extraktion)

### 3.1 Stufen

1. **Input-Normalisierung**  
   - Eine gemeinsame Funktion: Newlines normalisieren, Zeichenlimit (z. B. 200k), optional Encoding.

2. **Format-Erkennung**  
   - Ist der Inhalt GAEB-XML (Root-Element prüfen)? → Pfad **XML**.  
   - Sonst → Pfad **Text-Export**.

3. **Pfad XML (später)**  
   - GAEB DA XML parsen: Meta, Vorbemerkungen-, Vortext-, Titel-/Positions-Knoten laut GAEB-Schema auslesen.  
   - Daraus `GaebStructure` befüllen.  
   - Kein „Cut“ nötig; Trennung ist strukturell.

4. **Pfad Text-Export (aktuell ausbauen)**  
   - **Phase A – Vortext/Positionen-Trennung (robust):**  
     - Zuerst **regelbasiert** (wie heute in gaeb-preview, aber erweiterte Marker-Liste und klare Priorität).  
     - Wenn Cut unsicher (z. B. nur „fallback-no-cut-found“ oder sehr früher Cut): **LLM** wie in gaeb-split-llm, aber mit klarem Vertrag: „Erster Satz/Zeile, ab dem der reine Positions-/LV-Inhalt beginnt.“  
     - Ausgabe: `vortextStart`, `vortextEnd`, `cutMethod` (z. B. `anchor-titel-n`, `llm-marker`, `fallback-qty-unit`).  
   - **Phase B – Vorbemerkungen vs. Vortext (optional, aber empfohlen):**  
     - Auf dem Abschnitt **vor** Positionen: Erkennung „Vorbemerkungen“-Block vs. „Allgemeine Vertragsbedingungen“ / „Vortext“.  
     - Regex/LLM: typische Überschriften („Vorbemerkungen“, „Allgemeines“, „Vertragsbedingungen“) → zwei Bereiche: `vorbemerkungen`, `vortext`.  
     - Wenn nicht trennbar: alles vor Positionen als `vortext`, `vorbemerkungen` leer.

5. **Struktur befüllen**  
   - `meta.source = "text-export"`, `meta.filename` vom Upload.  
   - `vortext` = ermittelter Vortext-String (ohne Positionsreste).  
   - `vorbemerkungen` = optional getrennter Block.  
   - `positionen.raw` = Rest nach Cut.  
   - `abschnitte` zunächst leer oder aus einfacher Heuristik (z. B. Zeilen „TITEL n:“ als Abschnittsstart).  
   - `raw.full`, `raw.cutMethod`, `raw.vortextStart/End` setzen.

### 3.2 Einbindung in bestehende APIs

- **gaeb-preview:** Sollte **eine** gemeinsame Extraktionsfunktion nutzen (z. B. `extractGaebStructure(raw): GaebStructure`), die ihrerseits `findCutIdx` + optional LLM-Fallback kapselt. Response um `structure: GaebStructure` erweitern.
- **gaeb-split-llm:** Entweder durch obigen Flow ersetzen oder als „nur LLM-Cut“-Variante behalten; Ergebnis in dasselbe `GaebStructure`-Format gießen.
- **Score-API:** Statt `vortext`/`positions` als zwei Strings: optional **ein** Objekt `gaebStructure` akzeptieren; `textForAnalysis = gaebStructure.vortext + "\n\n" + gaebStructure.positionen.raw` (und für Trigger nur Vortext, wenn ihr das später trennen wollt). Abwärtskompatibel: weiterhin `vortext` + `positions` unterstützen.
- **analyze-vortext:** Bekommt nur noch **sauberen** Vortext (aus `GaebStructure.vortext`), nie den kompletten Dateiinhalt.

---

## 4. Hybrid-KeyFacts (Regex first, LLM Fallback, Herkunft)

### 4.1 Erweiterte KeyFacts-Liste

Deckungsgleich mit deiner Liste; technische Keys z. B.:

- **Projekt/Bauvorhaben:** `bauvorhaben`
- **Ort:** `ort`
- **Gewerk:** `gewerk` (für spätere Trigger-Filterung)
- **Bauherr / AG:** `bauherr_ag`
- **Planer:** `planer`
- **Bauzeit:** `bauzeit` (vorhanden)
- **Baubeginn:** `baubeginn` (vorhanden)
- **Fertigstellung:** `fertigstellung` (vorhanden)
- **Ausführungszeit:** `ausfuehrungszeit` (oder `ausfuehrungsfrist`, konsolidieren)
- **Submission / Einreichung:** `submission_einreichung` oder `fristAngebot` (vorhanden)
- **Vertragsgrundlagen:** `vertragsgrundlagen` (z. B. VOB/B, BGB → teilweise `vob_bgb`)
- **Gewährleistung:** `gewaerhleistung` (vorhanden)
- **Wartung / Instandhaltung:** `wartung_instandhaltung` (neu)

Bestehende Felder (baubeginn, bauzeit, fertigstellung, ausfuehrungsfrist, fristAngebot, bindefrist, vertragsstrafe, gewaerhleistung, vob_bgb, rangfolge, zahlungsbedingungen, abschlagszahlung, schlussrechnung, preisgleitung) bleiben; neue Keys ergänzen.

### 4.2 Hybrid-Logik (pro Feld)

- **Schritt 1 – Regex:** Für jedes KeyFact definierte Regex/Patterns (wie bisher in `extractKeyFactsRegex`). Nur sichere Treffer behalten (Mindestlänge, kein Müll).
- **Schritt 2 – LLM:** LLM liefert alle KeyFacts inkl. Confidence. Nur Felder nutzen, die **noch leer** sind ODER wo Regex unsicher (z. B. sehr kurzer Treffer). LLM-Werte nur übernehmen wenn `confidence >= Schwellwert` (z. B. 0.55).
- **Schritt 3 – Herkunft:** Jedes Feld hat ein Attribut `source: "regex" | "llm"`. Für Debug/UI anzeigen („Baubeginn: 01.03.2025 (Regex)“).

Typ für KeyFacts mit Herkunft:

```ts
type KeyFactEntry = { value: string; source: "regex" | "llm" };
type KeyFactsWithSource = Record<string, KeyFactEntry>;
```

API-Response z. B.:  
`keyFacts: Record<string, string>` (wie heute, für Abwärtskompatibilität)  
`keyFactsSource: Record<string, "regex" | "llm">` (optional, für Debug-Anzeige).

### 4.3 Reihenfolge

1. GAEB-Struktur sauber extrahieren (Vortext ohne Positionsreste).  
2. KeyFacts-Regex um neue Felder (Bauvorhaben, Ort, Gewerk, Bauherr, Planer, Submission, Wartung/Instandhaltung, Vertragsgrundlagen) erweitern.  
3. LLM-Schema (KEYSET + keyFactConfidence) um dieselben Keys erweitern.  
4. Merge-Logik auf „pro Feld: Regex zuerst, LLM nur wenn leer oder Regex fragwürdig“ umstellen und `keyFactsSource` setzen.

---

## 5. Debug-/Preview-Ansicht erweitern

In der Admin-Score-Page (oder einer dedizierten Debug-Seite) sichtbar machen:

| Anzeige | Inhalt |
|--------|--------|
| **Erkannter Vortext** | `GaebStructure.vortext` (evtl. mit Zeichenzahl und Hinweis ob gekürzt). |
| **Erkannte Vorbemerkungen** | `GaebStructure.vorbemerkungen` (falls getrennt). |
| **Erkannte KeyFacts** | Tabelle/Liste aller KeyFacts inkl. **Herkunft** (Regex/LLM). |
| **Erkannter Gewerketyp** | Bereits vorhanden: `detectDisciplines` → primary/secondary; in Debug-Bereich prominent anzeigen. |
| **Strukturvorschau** | Kurze Übersicht: `meta.source`, `raw.cutMethod`, Längen (vorbemerkungen, vortext, positionen), erste Zeilen von vortext und positionen. |

Technisch:  
- Score-API liefert bei `debug=1` bereits Infos; um `gaebStructure` (oder die gleichen Felder flach) und `keyFactsSource` erweitern.  
- Frontend: Tabs/Blöcke „Struktur“, „Vortext“, „KeyFacts (mit Herkunft)“, „Gewerk“, „Positionen-Vorschau“.

---

## 6. Gewerk-Erkennung (Vorbereitung Trigger-Filter)

Bereits umgesetzt in `app/api/score/route.ts`:  
`detectDisciplines(textForAnalysis)` → `primary`, `secondary`, `all`; Trigger werden gefiltert nach `disciplines` (global + erkannte Gewerke).  

Empfehlung:  
- Gewerk-Erkennung **nur auf Vortext + Abschnitts-/Positionsüberschriften** laufen lassen (optional nur Vortext), nicht auf vollem Positionstext, um Verzerrung durch Mengen/Kurztexte zu reduzieren.  
- Wenn KeyFact **Gewerk** aus dem Vortext extrahiert wird, kann dieser Wert zusätzlich zur heuristischen `detectDisciplines` genutzt werden (z. B. als Priorität oder Fallback).

---

## 7. Implementierungs-Reihenfolge (Kurz)

1. **Datenstruktur** `GaebStructure` + Typen in `lib/gaebStructure.ts` anlegen.  
2. **Parsing-Flow** in einer neuen Modul-Datei (z. B. `lib/gaebExtract.ts`): `extractGaebStructure(raw, filename?)` mit regelbasiertem Cut + optional LLM-Fallback; Ausgabe `GaebStructure`.  
3. **gaeb-preview** auf `extractGaebStructure` umstellen; Response um `structure` erweitern.  
4. **Score-API** (und ggf. gaeb-split-llm) so anpassen, dass sie mit `GaebStructure` oder weiterhin mit `vortext`/`positions` arbeiten.  
5. **Vortext für analyze-vortext** ausschließlich aus `GaebStructure.vortext` speisen.  
6. **Debug-Ansicht** erweitern: Vortext, KeyFacts mit Herkunft, Gewerk, Strukturvorschau.  
7. **KeyFacts** erweitern (KEYSET + Regex + LLM-Schema) und **Hybrid mit Herkunft** (`keyFactsSource`) implementieren.  
8. Optional: **Vorbemerkungen vs. Vortext** im Text-Export trennen und in `GaebStructure` abbilden; Vortextanalyse weiter nur auf `vortext`.  
9. Optional: GAEB-XML-Pfad für echte XML-Exporte (Meta, Vorbemerkungen, Vortext, Positionen aus Knoten).

---

## 8. Zusammenfassung

- **Hauptursache** für schlechte KeyFacts und schwache Vortext-Risiken ist die **unsaubere Trennung** von Vortext und Positions-LV sowie fehlende Felder im KEYSET.  
- **Lösung:** Einheitliche **GAEB-Struktur** (Meta, Vorbemerkungen, Vortext, Abschnitte, Positionen) und ein **robuster Parsing-Flow** (regelbasiert + LLM-Fallback), sodass alle nachgelagerten Schritte (Scoring, Vortextanalyse, KeyFacts) nur noch auf sauberem Input laufen.  
- **KeyFacts:** Erweiterte Liste, **Hybrid** (Regex first, LLM für Lücken), **Herkunft pro Feld** für Transparenz.  
- **Debug:** Strukturvorschau, erkannter Vortext, KeyFacts inkl. Herkunft, Gewerk anzeigen.  
- **Gewerk:** Bereits genutzt für Trigger-Filter; optional nur auf Vortext/Überschriften anwenden und mit KeyFact „Gewerk“ abstimmen.

Wenn du möchtest, können wir als Nächstes konkret die neuen Typen in `lib/gaebStructure.ts` und die Signatur von `extractGaebStructure` in `lib/gaebExtract.ts` ausimplementieren und `findCutIdx` aus gaeb-preview dorthin auslagern.
