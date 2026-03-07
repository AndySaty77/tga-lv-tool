# Scoring – Bestandsaufnahme und risikoarmer Umsetzungsplan

**Stand:** Analyse ohne Code-Umbau. Keine Bewertungslogik verändert.

---

## 1. Wo liegen die Parameter aktuell?

### 1.1 Ampel-Schwellen (Traffic Light)

| Ort | Art | Werte | Nutzung |
|-----|-----|-------|---------|
| **app/admin/score/page.tsx** | Funktion `traffic(score)` (Zeile 39–43) | 0–39 Grün, 40–69 Gelb, 70–100 Rot | Nur Darstellung: Ampel-Farbe und -Text für Gesamt-Score und pro Kategorie |
| **lib/scoring.ts** | Funktion `levelFromTotal(t)` (Zeile 48–53) | t&lt;40 → hochriskant, t&lt;70 → mittel, t&lt;86 → solide, sonst sauber | Wird in `computeScore()` genutzt; **das Ergebnis `level` wird von der API überschrieben** (s. u.) |

**Befund:** Zwei getrennte Logiken: (1) **UI-Ampel** nur im Frontend, hart codiert (70/40). (2) **level** in lib/scoring (40/70/86) – für die API-Antwort irrelevant, weil die API einen **normierten total** (0–100, Mittel der 5 Kategorien) berechnet und zurückgibt; die Anzeige nutzt ausschließlich `traffic(total)` im Frontend.

---

### 1.2 Claim- / Nachtragsschwellen

| Ort | Art | Werte / Logik | Nutzung |
|-----|-----|----------------|---------|
| **Trigger-DB (Supabase)** | Pro Trigger: `claim_level` | "Niedrig" \| "Mittel" \| "Hoch" | Wird in Findings durchgereicht und nur in der UI angezeigt (Claim-Level pro Finding). **Keine zentrale Schwellenlogik** (z. B. „ab X Findings mit Hoch = hohes Claim-Potenzial“). |
| **lib/analyzeLvText.ts** (Zeile 401–420) | System-Check „Weiche Formulierungen“ | Schwellen **hart:** ≥3 Treffer → Finding, ≥6 → "high" severity, sonst "medium". Penalty 0–12, Faktor über `frequencyMultiplier(countNachtrag)`. Liste `nachtragWorte` fest: bauseits, nach aufwand, optional, bedarfsweise, pauschal. | Einfluss auf Findings/Kategorie „nachtrag“, dann über mapCategoryTo5 in die 5 Kategorien. |
| **lib/changeOrderAnalysis.ts** | Nachtragsanalyse (Regeln + optional LLM) | Keine konfigurierbaren Schwellen in einem zentralen Objekt; Regeln und Cluster-Mapping fest im Code. | Eigenständige Nachtragsanalyse; Ergebnis wird nur dargestellt, nicht in den numerischen Score eingerechnet. |

**Befund:** Keine zentrale „Claim-/Nachtragsschwellen“-Config. Claim-Level kommt nur aus den Triggern. Nachtrag-Relevanz in analyzeLvText (3/6, Wortliste, Penalty-Cap) ist fest im Code.

---

### 1.3 Komplexitäts-Schwellen (LV-Größe)

| Ort | Art | Werte | Nutzung |
|-----|-----|-------|---------|
| **app/api/score/route.ts** | `ScoringConfig.lvSize` (aus DB oder FALLBACK_CONFIG) | `baseDivisor: 2000`, `maxBoost: 0.6` | `lvSizeFactor(lvText, cfg)` → Faktor 1 … 1+maxBoost; skaliert `catMax` pro Kategorie (scaledMax = baseMax * sizeF). |
| **FALLBACK_CONFIG** (Zeile 74–86) | Fallback, wenn scoring_config fehlt | Wie oben | Gleiche Werte. |

**Befund:** **Bereits zentral und editierbar vorbereitet:** Werte kommen aus `scoring_config` (key "default", JSON in `value`). API und GET /api/admin/scoring-config lesen dieselbe Struktur. Nur **Schreibzugriff** (PUT/PATCH + UI) fehlt.

---

### 1.4 Kategorie-Gewichtungen

Es gibt **zwei getrennte Systeme**:

| System | Ort | Kategorien | Verwendung |
|--------|-----|------------|------------|
| **A) 6er-System (Baseline)** | **lib/scoring.ts** | normen, vollstaendigkeit, vortext, mengen_schnittstellen, nachtrag, ausfuehrung. `CATEGORY_WEIGHTS` je 15/20/15/15/20/15. | `computeScore()`: Abzüge aus Findings, Summe = total. **Dieser total wird in der API nicht für die Antwort genutzt.** |
| **B) 5er-System (API/UI)** | **app/api/score/route.ts** | vertrags_lv_risiken, mengen_massenermittlung, technische_vollstaendigkeit, schnittstellen_nebenleistungen, kalkulationsunsicherheit. **catMax** aus `ScoringConfig` (DB). | Findings werden mit `mapCategoryTo5()` auf 5 Kategorien gemappt. pro Kategorie: `perCategorySum[k]`, dann Normierung mit `catMax[k] * sizeF`, Easing, → perCategory 0–100. **Gesamt-Score = Mittel der 5.** |

**Befund:** Die **sichtbare Bewertung** (total, perCategory, Ampel) kommt ausschließlich aus dem **5er-System und catMax** in der API. Die 6er-Gewichtung in lib/scoring.ts steuert nur die interne `computeScore`-Ausgabe (und Sortierung); die API überschreibt `total` und `perCategory` mit der eigenen Berechnung. **Editierbar** ist de facto nur **catMax** (bereits in scoring_config); die 6er-Weights in lib/scoring.ts sind aktuell nicht über Config/UI angebunden.

---

### 1.5 Projekttyp-Faktoren

| Ort | Art | Befund |
|-----|-----|--------|
| **Trigger-DB** | Pro Trigger: `project_types` (Array) | Wird in Trigger-Verwaltung und -Export genutzt; **nicht** in app/api/score/route.ts oder in der Scoring-Formel. |
| **Scoring-Config / API** | – | **Keine** projekttyp-spezifischen Faktoren (Multiplikatoren, Schwellen). |

**Befund:** Projekttyp ist nur Datenfeld, nicht Teil der Bewertungslogik. Eine spätere Erweiterung (z. B. Faktoren je Projekttyp) müsste neu in Config und API eingeführt werden.

---

## 2. Was ist bereits so strukturiert, dass es editierbar gemacht werden kann?

- **Scoring-Config (DB)**  
  - **Tabelle:** `scoring_config` (key = "default", is_active = true, value = JSON).  
  - **Inhalt:** version, catMax (5 Kategorien), lvSize (baseDivisor, maxBoost), easing (type: "sqrt" \| "linear"), total (method: "mean").  
  - **Lesen:** app/api/score/route.ts (getScoringConfig), GET /api/admin/scoring-config.  
  - **Schreiben:** Es gibt **keinen** PUT/PATCH oder Insert/Update aus dem UI. Editierbar machbar durch: (1) API-Route zum Schreiben (z. B. PUT /api/admin/scoring-config), (2) Validierung gegen FALLBACK_CONFIG-Grenzen, (3) UI auf /admin/scoring mit Formularen für catMax, lvSize, easing.

- **Ampel-Schwellen**  
  - **Nicht** in der DB. Nur in `traffic()` im Frontend (70/40). Für editierbar: entweder (a) Schwellen in scoring_config aufnehmen und API liefert sie mit (Frontend liest sie), oder (b) kleines Config-Objekt im Frontend (z. B. aus API oder eigener Config-Route) und `traffic(score, schwellen)`.

- **Claim-/Nachtragsschwellen / Projekttyp-Faktoren**  
  - Noch **nicht** als Konfigurationsobjekt vorhanden; würden Neuerungen in Config-Struktur und ggf. Logik erfordern.

---

## 3. Was müsste zuerst zentralisiert werden, bevor UI-Bearbeitung sicher ist?

- **Ampel-Schwellen**  
  - **Option A (minimal):** Ein Konstanten- oder Config-Objekt (z. B. in lib oder in scoring_config) mit drei Schwellen (z. B. rotAb, gelbAb), von Frontend und ggf. API gelesen. **Keine** Änderung der Berechnungslogik.  
  - **Option B:** Weiter nur im Frontend, aber aus einer einzigen Quelle (z. B. Konstante in einer gemeinsamen Datei), damit sie später durch Config ersetzt werden kann.

- **Claim-/Nachtragsschwellen**  
  - Bevor sie im UI editierbar sind: **zentrales Config-Objekt** (z. B. in scoring_config oder eigener Tabelle) definieren (z. B. Schwellen für „hohes Claim-Potenzial“, Nachtrag-Wortliste oder -Schwellen nur dann, wenn die Fachlogik das vorsieht). **Analyse-Logik (analyzeLvText, changeOrderAnalysis) erst anbinden, wenn Konzept steht** – sonst Risiko für unkontrollierte Änderung.

- **Nachtrag-Weichwörter und -Schwellen (analyzeLvText)**  
  - Aktuell fest: 3/6, Wortliste, Penalty. Zentralisierung = diese Werte in ein Config-Objekt auslagern und analyzeLvText damit füttern. **Erst danach** UI-Bearbeitung; Validierung (z. B. Mindestanzahl Wörter, sinnvolle Schwellen) definieren.

- **Projekttyp-Faktoren**  
  - Erst wenn fachlich gewünscht: Struktur in ScoringConfig (z. B. `projectTypeFactors: Record<string, number>`) und Nutzung in der API (z. B. Faktor auf catMax oder total). Ohne das: nur Platzhalter im UI, keine Logik-Änderung.

- **6er-Kategorien (lib/scoring.ts)**  
  - CATEGORY_WEIGHTS dort beeinflussen nur computeScore (und damit indirekt Sortierung/Detail); die **angezeigte** Bewertung kommt aus dem 5er-System. Wenn man die 6er-Weights editierbar machen will: zuerst in Config-Struktur abbilden und computeScore aus Config lesen lassen. **Niedrige Priorität**, solange die Anzeige nur das 5er-System nutzt.

---

## 4. Minimalinvasiver Weg: /admin/scoring bearbeitbar machen

**Grundsatz:** Nur Werte editierbar machen, die **bereits** aus einer zentralen Config gelesen werden und die **gesamte** Bewertungslogik unverändert lassen (keine neuen Formeln, keine neuen Schwellen in der Berechnung).

### Schritt 1: Nur bestehende scoring_config schreibbar machen (risikoarm)

- **Backend:**  
  - **PUT (oder PATCH) /api/admin/scoring-config** implementieren: Body = Objekt wie ScoringConfig (bzw. Teil davon). Validierung: Typen prüfen, catMax pro Kategorie 1–100 (oder sinnvoller Bereich), lvSize.baseDivisor &gt; 0, lvSize.maxBoost 0–1, easing nur "sqrt" \| "linear".  
  - Schreiben in Supabase: `scoring_config` für key "default" upserten (value = JSON). Keine Änderung an getScoringConfig oder an der Score-Berechnung in app/api/score/route.ts.

- **Frontend /admin/scoring:**  
  - Bestehende Anzeige (catMax, lvSize, easing) um **Formulare** ergänzen: Eingabefelder für catMax je Kategorie, baseDivisor, maxBoost, Easing (Dropdown).  
  - Speichern-Button → PUT /api/admin/scoring-config mit den aktuellen Werten. Optional: „Auf Fallback zurücksetzen“.  
  - **Keine** neuen Config-Felder (keine Ampel-, Claim-, Projekttyp-Logik), damit keine Fachlogik berührt wird.

**Ergebnis:** catMax, lvSize, easing sind über die bestehende Struktur und die bestehende Lese-Logik editierbar; die Bewertungslogik bleibt 1:1.

### Schritt 2 (optional, später): Ampel-Schwellen lesbar und editierbar

- **Konfiguration:** Entweder (a) Ampel-Schwellen (z. B. rotAb, gelbAb) in scoring_config.value aufnehmen und von der API mit ausliefern, oder (b) eigene kleine Config (z. B. "ui" oder "ampel") in der DB.  
- **Frontend:** traffic(score) entweder aus API-Antwort oder aus separatem GET lesen; Anzeige wie heute.  
- **Edit:** Auf /admin/scoring Abschnitt „Ampel-Schwellen“ mit zwei Zahlenfeldern (z. B. „Rot ab Score“, „Gelb ab Score“), Speichern in derselben Config.  
- **Keine** Änderung an total-Berechnung oder an levelFromTotal in lib/scoring.ts.

### Schritt 3 (später): Claim-/Nachtrag-/Projekttyp

- Erst nach **fachlicher** Definition und Zentralisierung in Config-Struktur (s. Abschnitt 3).  
- Dann: Anzeige und Bearbeitung auf /admin/scoring nur für die dann existierenden Config-Felder; Logik-Anbindung schrittweise und getrennt von der „nur Config schreibbar“-Phase.

---

## 5. Kurzfassung

| Parameter | Aktuell | Zentralisiert? | Editierbar ohne Logik-Risiko? |
|-----------|---------|----------------|-------------------------------|
| **Ampel-Schwellen** | Frontend traffic() (70/40) | Nein | Erst nach Auslagerung in Config (nur Darstellung). |
| **Claim-/Nachtragsschwellen** | Trigger claim_level; analyzeLvText 3/6 fest | Nein | Nein – zuerst Konzept und zentrale Config. |
| **Komplexitäts-Schwellen** | lvSize in scoring_config | Ja (DB) | Ja – nur Schreib-API + UI. |
| **Kategorie-Gewichtungen (5er)** | catMax in scoring_config | Ja (DB) | Ja – nur Schreib-API + UI. |
| **Easing** | In scoring_config | Ja (DB) | Ja – nur Schreib-API + UI. |
| **Projekttyp-Faktoren** | Nicht vorhanden | Nein | Nein – nur Platzhalter ohne Logik. |

**Empfehlung:** Zuerst **nur** scoring_config schreibbar machen (PUT + Formulare für catMax, lvSize, easing). Damit ist /admin/scoring für die bereits zentral gehaltenen Parameter bearbeitbar, ohne Bewertungslogik zu verändern. Ampel und weitere Schwellen in einem zweiten Schritt nach Zentralisierung.
