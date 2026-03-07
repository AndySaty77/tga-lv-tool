# Bestandsaufnahme: Nutzerrelevante Texte und zentrale Textverwaltung

**Stand:** Analyse ohne Code-Umbau. Keine Fachlogik geändert.

---

## 1. Wo liegen aktuell nutzerrelevante Texte?

### 1.1 Bereits zentral vorbereitet (noch nicht angeschlossen)

| Ort | Inhalt |
|-----|--------|
| **`lib/textsConfig.ts`** | `DEFAULT_TEXTS_CONFIG`: Tab-Labels, KPI-Labels, sectionHeaders, buttonLabels, tabDescriptionUebersicht, explanation (Risiken, Nachtragspotenzial, Rückfragen, Angebotsklarstellungen, Transparenz, scoreCalculation), rueckfragen (emptyState, generateButton, groupLabels, …), angebotsklarstellungen (analog), internal (categoryLabels, severityLabels, keyFactLabels). |
| **`app/admin/texts/page.tsx`** | Zeigt die Config aus `GET /api/admin/texts` (Default = lib/textsConfig) nur an – **nicht bearbeitbar**, kein Speichern. |
| **`app/api/admin/texts/route.ts`** | Liefert aktuell fest `DEFAULT_TEXTS_CONFIG` und `source: "default"`. Kein GET aus DB/CMS, kein PUT. |

### 1.2 Hart im Code verteilte Texte (Analyse-/Score-UI)

**Datei: `app/admin/score/page.tsx`** (wird von `/analyse` über `<ScorePage customerRoute />` genutzt)

- **Tab-Labels** (Zeile ~1422–1429): `"Übersicht"`, `"Risiken"`, `"Nachtragspotenzial"`, `"Rückfragen"`, `"Angebotsklarstellungen"`, `"Risikodetails"`/`"Trigger"`, `"Transparenz"` – direkt im JSX-Array.
- **KPI-Labels Übersicht** (Zeile ~1458–1473): `"Komplexität"`, `"Gesamt-Risiko"`, `"Claim-Potenzial"`, `"Risiko-Ampel der Kategorien"`, `"Top Findings"`.
- **Ampel-Texte** (Zeile ~41–43, 99, 111): `"Grün"`, `"Gelb"`, `"Rot"`, `"Ampel: 0–39 Grün • 40–69 Gelb • 70–100 Rot"`.
- **Level-Labels** (Zeile ~152–159): `"HOCHRISIKO"`, `"MITTEL"`, `"SOLIDE"`, `"SAUBER"`.
- **Severity-Labels** (Zeile ~173–175): `"Hoch"`, `"Mittel"`, `"Niedrig"`.
- **Kategorie-Labels** (Zeile ~22–27): `CATEGORY_LABEL` – Vertrags-/LV-Risiken, Mengen & Massenermittlung, Technische Vollständigkeit, Schnittstellen & Nebenleistungen, Kalkulationsunsicherheit.
- **KeyFacts-Labels** (Zeile ~289–317): großes `KEYFACT_LABEL`-Objekt (Bauvorhaben, Ort, Gewerk, Baubeginn, Bauzeit, …).
- **Section-Header / Erklärungstexte:**
  - Risiken (Zeile ~1538, 1545–1546, 1598–1599): „Risiken — In diesem Bereich…“, „Projektdaten aus dem Leistungsverzeichnis“, „Wichtige Angaben aus der Einleitung…“, „Risiken im Einleitungstext“, „Künstliche Intelligenz analysiert…“
  - Nachtrag (Zeile ~1800, 1844, 1878): „Nachtragspotenzial — …“, Klicke „Nachtragspotenziale ermitteln“…, „Unklare oder fehlende…“
  - Rückfragen (Zeile ~2126, 2131, 2155, 2205): „Rückfragen — …“, „RÜCKFRAGEN / KLARSTELLUNGEN“, „Technische Fragen“ / „Vertragsfragen“ / „Terminliche Fragen“, emptyState-Text.
  - Angebotsklarstellungen (Zeile ~2225, 2230, 2254, 2303): „Angebotsklarstellungen — …“, „ANGEBOTS-ANNAHMEN“, „Technische Annahmen“ usw., emptyState.
  - Transparenz (Zeile ~2329, 2333, 2335–2339): „Transparenz — …“, „Erklärung der Score-Berechnung“, vollständiger Score-Erklärungstext.
- **Button-Texte:** „Nachtragspotenziale ermitteln“, „Analysiere…“, „Rückfragen generieren“, „Generiere…“, „Annahmen generieren“, „Arbeite…“.
- **Leer-/Fehlerzustände:** „Keine Treffer.“, „Keine Projektdaten gefunden.“, „Keine auffälligen Risikoformulierungen erkannt.“, „Keine Nachtragspotenziale erkannt.“, „Keine Treffer aus der Regel-Datenbank.“, „Keine Treffer aus Systemprüfung.“, „Projektdaten nicht verfügbar…“, „Der Einleitungstext wird…“
- **Intern-only (nur wenn !customerRoute):** „Trigger-Admin“, „Trigger-ID:“ vs. „Prüfregel:“, „Erkannte Risiken (Regel-Datenbank)“ / „(Systemprüfung)“ / „(KI-Analyse)“, „Claim-Level:“, „Debug-Ansicht öffnen“, „Technische Details“, „KI-Analyse: … Regeln + … KI = … erkannte Risiken“, „Hinweis: … erkannte Risiken ohne Zuordnung“.

**Datei: `app/analyse/page.tsx`**  
- Nur Metadata: `title: "LV Analyse"`, `description: "Risiko- und Bewertungsanalyse für Leistungsverzeichnisse"`. Sonst wird nur `ScorePage` gerendert.

### 1.3 Texte in Backend / Logik (Findings, Nachtrag, KeyFacts)

| Datei | Art | Beispiele |
|-------|-----|-----------|
| **`lib/analyzeLvText.ts`** | Finding-Titel/Details (kundenrelevant, sobald in UI) | „DIN EN 1717 nicht genannt…“, „Spülung/Spülprotokoll nicht eindeutig…“, „Viele weiche Formulierungen…“ / „Mehrere weiche Formulierungen…“, `detail: Trefferanzahl: …` |
| **`lib/changeOrderAnalysis.ts`** | Titel von Nachtrag-Clustern (Presets) | „Nebenleistungen nur pauschal erwähnt“, „Bauseits-Leistungen unklar“, „KEYFACTS_NACHTRAG_RELEVANT“ (z. B. „Bauzeit nicht angegeben“) – viele feste Titel |
| **`lib/findingsPresets.ts`** | Preset-Finding-Titel | „DIN 1988 nicht genannt (Trinkwasserinstallation)“, „Druckprüfung/Protokoll nicht eindeutig beschrieben“, „Vortext: Abrechnungs-/Ausführungsregeln fehlen…“ |
| **`lib/clarificationQuestions.ts`** / **`lib/offerAssumptions.ts`** | Struktur (title), inhaltliche Texte kommen von API/LLM | Typen mit `title`; konkrete Nutzer-Texte eher in API-Responses |

**API-Fehlermeldungen (nutzerrelevant):**  
- `app/admin/score/page.tsx`: „Rückfragen fehlgeschlagen“, „Nachtragsanalyse fehlgeschlagen“, „Annahmen fehlgeschlagen“, „Vortext Analyse fehlgeschlagen“, „gaeb-preview failed“ usw.

### 1.4 Interne / Admin-Texte (nur Admin-Routen)

| Ort | Inhalt |
|-----|--------|
| **`app/admin/page.tsx`** | „Admin-Bereich“, Karten: Trigger, Analyse-Einstellungen, Scoring, Texte, Debug, Beschreibungstexte je Karte, „Zur Kundenseite (Analyse)“. |
| **`app/admin/score/page.tsx`** | Wie oben: alles, was nur bei `!customerRoute` oder Expertenmodus sichtbar ist (Trigger, Risikodetails, Debug, Trigger-ID, Regel-Datenbank/System/KI). |
| **`app/admin/triggers/page.tsx`** | Formularlabels, „Trigger-Admin“, „Noch keine Trigger – CSV importieren“, „Keine Keywords hinterlegt“, „Klicken zum Auswählen“ usw. |
| **`app/admin/scoring/page.tsx`** | „Scoring“, „Interne Konfiguration…“, Hilfetexte zu Ampel/Claim/Nachtrag/Komplexität/Kategorien/Projekttyp. |
| **`app/admin/texts/page.tsx`** | „Texte“, „Zentrale Pflege…“, „Keine Einträge.“, Bereichsüberschriften (1.–5.). |
| **`app/admin/debug/page.tsx`** | „Interne Rohdaten und Diagnose…“, „Noch keine Daten. Analyse unter…“ |
| **`app/admin/settings/page.tsx`** | Überschriften und Beschreibungen der Analyse-/KI-Einstellungen. |

---

## 2. Welche Texte sind kundenrelevant?

- **Alle sichtbaren Texte auf `/analyse`** (d. h. in `ScorePage` bei `customerRoute === true`):
  - Tab-Namen, KPI-Bezeichnungen, Section-Header, Erklärungstexte der Tabs, Button-Texte, Empty-States, Score-Erklärung, Ampel-/Level-/Severity-Labels, Kategorie-Namen, KeyFacts-Labels.
  - Alle Finding-Titel und -Details, die in der Analyse erscheinen (aus `analyzeLvText`, `changeOrderAnalysis`, Presets, API-Responses).
  - Fehlermeldungen, die dem Nutzer angezeigt werden (z. B. „Rückfragen fehlgeschlagen“).
- **Metadata:** `app/analyse/page.tsx` (title, description) für SEO/Browser.

---

## 3. Welche Texte sind intern / admin-relevant?

- Alles unter **`/admin/*`**: Überschriften, Beschreibungen, Hinweise, Formularlabels, leere Zustände (z. B. „Noch keine Trigger“).
- In der **Score-Page bei `customerRoute === false`**: „Trigger“, „Trigger-ID“, „Regel-Datenbank“, „Systemprüfung“, „KI-Analyse“, „Debug-Ansicht öffnen“, „Technische Details“, Expertenmodus-Texte.
- **Debug-/Technik:** „Config:“, „Easing:“, „detectedDisciplines“, „triggersUsed“, „findingsBeforeLlm“, etc.

---

## 4. Eignung für zentrale Textverwaltung

| Bereich | Eignung | Anmerkung |
|--------|--------|-----------|
| **Tab-Labels, KPI-Labels, Section-Header** | Sehr gut | Bereits in `textsConfig` abgebildet, nur Anschluss in Score-Page nötig. |
| **Erklärungstexte (Tabs + Score)** | Sehr gut | In `explanation.*` vorhanden; lange Texte, zentrale Pflege sinnvoll. |
| **Button-Texte, Empty-States (Rückfragen/Annahmen)** | Sehr gut | In `customerUI.buttonLabels`, `rueckfragen.*`, `angebotsklarstellungen.*`. |
| **Rückfragen-/Angebots-Gruppenlabels** | Sehr gut | `groupLabels` (technisch/vertraglich/terminlich) in Config. |
| **Kategorie-Labels (5er)** | Sehr gut | In `textsConfig.internal.categoryLabels` und in `scoringConfig`/Score-Page doppelt – eine Quelle bevorzugen. |
| **Severity-/Ampel-Labels** | Gut | Kurz, aber mehrsprachig/barrierefrei änderbar. |
| **KeyFacts-Labels** | Gut | Viele Keys; in Score-Page großes Objekt, in `textsConfig.internal.keyFactLabels` nur Auswahl – erweiterbar. |
| **Finding-Titel aus Logik** (analyzeLvText, changeOrderAnalysis, Presets) | Mittel | Viele feste Strings in Fachlogik; zentrale Config würde Logik nur lesen, keine Änderung der Regeln. |
| **API-Fehlermeldungen** | Mittel | Heute in UI/API verstreut; zentrale Liste möglich, Anschluss in catch-Blöcken. |
| **Admin-UI-Texte** | Optional | Können in zweiter Phase in eigener „admin“-Sektion der Text-Config oder separater Admin-Config liegen. |
| **Metadata (title/description)** | Gut | Eine Stelle (z. B. Config oder Seite) für Analyse-Seite. |

---

## 5. Betroffene Dateien (Überblick)

| Datei | Rolle |
|-------|--------|
| **`lib/textsConfig.ts`** | Bereits zentrale Definition (Default); Referenz für Anschluss. |
| **`app/admin/score/page.tsx`** | Hauptort aller kunden- und teils internen Texte der Analyse-UI; größter Umfang für Umstellung. |
| **`app/analyse/page.tsx`** | Nur Metadata. |
| **`app/admin/texts/page.tsx`** | Zeigt Texte nur an; spätere Erweiterung: Bearbeitung + Speichern. |
| **`app/api/admin/texts/route.ts`** | Aktuell nur Default-Auslieferung; spätere Option: DB/CMS, PUT. |
| **`lib/analyzeLvText.ts`** | Finding-Titel/Details (Nachtrag, DIN, etc.). |
| **`lib/changeOrderAnalysis.ts`** | Titel von Nachtrag-Presets und KEYFACTS_NACHTRAG_RELEVANT. |
| **`lib/findingsPresets.ts`** | Preset-Finding-Titel. |
| **`app/admin/page.tsx`**, **triggers**, **scoring**, **settings**, **debug** | Interne Beschriftungen; bei Bedarf später in zentrale Admin-Texte. |

---

## 6. Risikoarmer Umsetzungsplan (ohne sofortigen Code-Umbau)

### Phase 1: Anschluss ohne neue Speicherlogik

- **Ziel:** Score-Page (und damit `/analyse`) bezieht alle kundenrelevanten UI-Texte aus einer einzigen Quelle.
- **Quelle:** Weiterhin `lib/textsConfig.ts` (oder dieselbe Struktur aus `GET /api/admin/texts`), **keine** DB-Pflicht.
- **Vorgehen:**
  1. Score-Page: Texte nicht mehr aus lokalem `CATEGORY_LABEL`, `KEYFACT_LABEL`, festen Strings im JSX, sondern aus einem eingebundenen Config-Objekt (z. B. `DEFAULT_TEXTS_CONFIG` oder Response von `/api/admin/texts`).
  2. Einmalige Abgleichsliste: Jeder sichtbare String auf `/analyse` einem Key in `textsConfig` zuordnen; fehlende Keys in `textsConfig` ergänzen (Struktur ist bereits weitgehend vorhanden).
  3. Keine Änderung an Berechnungs- oder API-Logik; nur Ersetzung von Literalen durch Config-Lookup (z. B. `texts.customerUI.tabLabels.risiken` statt `"Risiken"`).
  4. Fallback: Wo kein Key existiert, weiter alter String (oder kurzer Default), um Lücken sichtbar zu machen ohne Fehler.
- **Risiko:** Gering; Verhalten bleibt gleich, nur Herkunft der Strings ändert sich.

### Phase 2: Admin-Seite Texte bearbeitbar machen

- **Ziel:** `/admin/texts` kann bestehende Werte anzeigen, in Formularen bearbeiten und speichern.
- **Speicherort-Optionen (eine davon):**
  - **A)** Weiter nur Code: Bearbeitung in `lib/textsConfig.ts`, Build/Deploy (einfach, keine DB).
  - **B)** DB-Tabelle `texts_config` (analog `scoring_config`): GET liest aus DB mit Fallback auf `DEFAULT_TEXTS_CONFIG`; PUT speichert (mit Service-Role oder RLS-Policy). Admin-Seite sendet PUT mit geänderten Objekten.
  - **C)** Später: CMS/Headless (gleiche API-Struktur, andere Backend-Implementierung).
- **Vorgehen:**
  1. API `GET /api/admin/texts`: optional aus DB lesen, sonst `DEFAULT_TEXTS_CONFIG`.
  2. API `PUT /api/admin/texts`: Body validieren, in DB schreiben (falls B); Response wie GET.
  3. Admin-Seite: pro Bereich (customerUI, explanation, rueckfragen, angebotsklarstellungen, internal) Formulare/Textareas, Speichern-Button ruft PUT auf.
  4. Keine Änderung an der Analyse-Seite nötig, sobald sie bereits aus GET (oder aus demselben Config-Objekt) liest.
- **Risiko:** Gering, wenn nur Texte geändert werden und keine Keys/Struktur entfernt werden.

### Phase 3 (optional): Finding-Titel und Fehlermeldungen

- **Finding-Titel:** In `analyzeLvText`, `changeOrderAnalysis`, `findingsPresets` könnten Titel aus einer Config (z. B. `textsConfig.findings` oder eigene Datei) gelesen werden; IDs bleiben in Logik, nur Anzeige-String extern. Größerer Eingriff in Fachlogik, daher optional und schrittweise.
- **Fehlermeldungen:** Zentrale Map (z. B. `errorMessages.rueckfragenFailed`) und in Score-Page/APIs nur noch Key übergeben; Anzeige aus Config. Geringer Umfang, gut machbar.

### Wichtige Regeln für alle Phasen

- Keine Keys/Struktur entfernen, die die Score-Page oder APIs erwarten; nur ergänzen oder 1:1 ersetzen.
- Kundenroute (`/analyse`): nur kundenrelevante Texte aus der zentralen Quelle; keine internen Begriffe („Trigger“, „Debug“, „Regel-Datenbank“) wenn `customerRoute === true`.
- Bestehende `textsConfig`-Struktur beibehalten oder nur erweitern, damit Admin-Seite und spätere Bearbeitung kompatibel bleiben.

---

## 7. Kurzfassung

- **Hart im Code:** Fast alle kundenrelevanten Texte der Analyse-UI stehen in **`app/admin/score/page.tsx`** (Tabs, KPIs, Erklärungen, Buttons, Leerzustände, Kategorien, KeyFacts, Ampel/Severity). Zusätzlich Finding-Titel in **`lib/analyzeLvText.ts`**, **`lib/changeOrderAnalysis.ts`**, **`lib/findingsPresets.ts`**.
- **Bereits zentral vorbereitet:** **`lib/textsConfig.ts`** deckt Tab-Labels, Erklärungstexte, Rückfragen-/Angebots-Texte, Kategorie-/Severity-/KeyFact-Labels ab; **`/admin/texts`** zeigt sie nur an und ist noch nicht bearbeitbar.
- **Risikoarmer Einstieg:** Zuerst Score-Page auf Bezug von Texten aus `textsConfig` (oder GET `/api/admin/texts`) umstellen; danach Admin-Seite um Bearbeitung und optional Speicherung (DB) erweitern. Finding-Titel und Fehlermeldungen können in einer späteren Phase folgen.
