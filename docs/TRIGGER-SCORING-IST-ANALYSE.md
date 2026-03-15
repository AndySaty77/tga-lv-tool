# Trigger-, Kategorien- und Scoring-Logik – IST-Analyse

**Stand:** Vollständige Analyse des bestehenden Codes ohne Refaktorierung.  
**Ziel:** Transparenz, warum bestimmte Kategorien oft hoch/niedrig sind und wie Scores entstehen.

---

## 1. Wo werden Trigger definiert?

### 1.1 Übersicht nach Typ

| Typ | Quelle | Dateien / Module |
|-----|--------|-------------------|
| **DB-Trigger (Vorbemerkung + Position)** | Supabase-Tabelle `triggers` | `app/api/score/route.ts` (lädt Trigger), `lib/analyzeLvText.ts` (`applyDbTriggers`, `computeHits`, `getTextForTrigger`) |
| **Norm-Trigger (fest im Code)** | Preset-Findings + System-Checks | `lib/findingsPresets.ts`, `lib/analyzeLvText.ts` (DIN 1988, DIN EN 1717, Druckprüfung, Spülung) |
| **Weichwörter-/Nachtrag-Trigger (Score-Strang A)** | Konfiguration + Zählung | `lib/scoringConfig.ts` (`NACHTRAG_WEICHWOERTER`, `NACHTRAG_SCHWELLEN`), `lib/analyzeLvText.ts` (Weichwörter-Count → Finding „nachtrag“) |
| **Nachtrag-/Claim-Trigger (Strang B)** | Regelwerk im Code | `lib/changeOrderAnalysis.ts` (`NACHTRAG_SOURCES`, 25 Quellen), `lib/changePotentialModel.ts`; KeyFacts-basiert: `KEYFACTS_NACHTRAG_RELEVANT` in `changeOrderAnalysis.ts` |
| **LLM-Findings (optional)** | LLM-Aufruf | `lib/llmRelevanceFilter.ts` (`analyzeLvTextWithLLM`); wenn `useLlmRelevance === true` werden DB-Trigger **nicht** genutzt |

### 1.2 DB-Trigger (Supabase)

- **Tabelle:** `triggers`
- **Geladene Spalten:** `id`, `name`, `description`, `category`, `trigger_type`, `keywords`, `regex`, `norms`, `weight`, `claim_level`, `risk_interpretation`, `question_template`, `offer_text_template`, `is_active`, `disciplines`
- **Filter:** Nur `is_active === true`; zusätzlich **Gewerk-Filter:** Trigger werden nur geladen, wenn `disciplines` einen Eintrag enthält, der `"global"` ist oder in den erkannten Gewerken (primary + secondary) vorkommt. Wird **kein** Gewerk erkannt, werden alle Trigger zugelassen (defensiv).
- **Gewerk-Erkennung:** `detectDisciplines(lvText)` in `app/api/score/route.ts` – Keyword-Zählung für heizung, sanitaer, lueftung, msr, elektro, kaelte; mind. 3 Treffer für ein Gewerk; primary = stärkstes, secondary = ≥ 60 % der Treffer von primary.

### 1.3 Vorbemerkungs- vs Positions-Trigger

- **Nicht getrennt in der DB:** Ein Trigger hat optional `match_scope` (z. B. `"vortext_only"`).
- **Logik in `getTextForTrigger` (`lib/analyzeLvText.ts`):**
  - Ist `match_scope === "vortext_only"` und Vortext vorhanden (> 100 Zeichen) → es wird **nur** der Vortext durchsucht.
  - Enthält die **Kategorie** des Triggers (DB-String) „vertrag“, „vortext“ oder „lv.risiko“ und Vortext > 200 Zeichen → es wird nur der Vortext verwendet.
  - Sonst → **gesamter Text** (Vortext + Positionen, konkateniert).

Damit gibt es faktisch **Vorbemerkungs-Trigger** (über `match_scope` oder Kategorie) und **Positions-Trigger** (Rest sucht im vollen Text).

---

## 2. Pro Trigger-Typ: Methode, Gewicht, Verstärker, Mehrfachzählung

### 2.1 DB-Trigger

| Aspekt | IST |
|--------|-----|
| **Methode** | **Regex** (wenn `trigger.regex` gesetzt) ODER **Keywords** (wenn `trigger.keywords` Array mit Einträgen). Keywords: Wortgrenzen, Phrase-Match, Kontextprüfung (s. u.). |
| **Basisgewicht** | `trigger.weight` (Zahl aus DB). |
| **Projekttyp-Faktor** | **Nicht genutzt.** `PROJECT_TYPE_FACTORS` in `scoringConfig.ts` ist leer. |
| **Norm-Verstärker** | **Nicht implementiert.** `trigger.norms` wird nur im Finding-Detail ausgegeben, beeinflusst den Score nicht. |
| **Komplexitäts-Faktor** | **Indirekt:** `lvSizeFactor` skaliert nur die **catMax** pro Kategorie (größeres LV → höherer catMax → gleiche Penalty-Summe führt zu niedrigerem 0–100-Score). Kein pro-Trigger-Komplexitätsfaktor. |
| **Mehrfachzählung** | **Pro Trigger:** Ein Finding pro Trigger (Dedupe „per_trigger“). Die **Anzahl Treffer (hits)** fließt in den **frequencyMultiplier** ein: `mult = clamp(1 + log10(hits)*0.6, 1, 2.0)` → **finalPenalty = round(weight * mult)**. Mehr Treffer = höherer Penalty, aber nur **ein** Finding pro Trigger. |
| **Negativ-/Kontextfilter** | **Ja.** Kontextfenster ±120 Zeichen; `isLikelyRelevantContext`: Digit-Ratio &lt; 45 %, Buchstaben-Ratio ≥ 20 %. Treffer in reinen Zahlenblöcken zählen nicht. Zusätzlich: Wenn im Kontext **Signalwörter** vorkommen (unklar, nicht definiert, fehlt, …), wird der Treffer gezählt. Keywords &lt; 4 Zeichen, Stopwords (pos, stück, din, …) werden ignoriert. Hits werden auf max. 50 gedeckelt. |

### 2.2 Norm-Trigger (System-Checks)

| Finding-ID | Kategorie (6er) | Methode | Basis-Penalty | Verstärker / Mehrfach |
|------------|-----------------|---------|----------------|------------------------|
| SYS_DIN_1988_FEHLT | normen | Keyword: „din 1988“, „din1988“ fehlt | 6 | Einmal pro Analyse |
| SYS_DIN_EN_1717_FEHLT | normen | Keyword: „din en 1717“, „en 1717“ fehlt | 5 | Einmal |
| SYS_DRUCKPRUEFUNG_UNKLAR | vollstaendigkeit | Keyword: druckprüfung/druckprobe fehlt | 7 | Einmal |
| SYS_SPUELUNG_FEHLT | vollstaendigkeit | Keyword: spül/spuel/spülprotokoll fehlt | 6 | Einmal |

### 2.3 Weichwörter-Trigger (Strang A – Score)

| Aspekt | IST |
|--------|-----|
| **Methode** | Zählung der Vorkommen von `NACHTRAG_WEICHWOERTER`: „bauseits“, „nach aufwand“, „optional“, „bedarfsweise“, „pauschal“. |
| **Basis-Penalty** | 6, dann `frequencyMultiplier(count)` → gedeckelt 0–12. |
| **Schwellen** | minFindings: 3 (unter 3 → kein Finding); highSeverityMin: 6 (≥ 6 → severity „high“). |
| **Kategorie-Zuordnung** | Finding-Kategorie **nachtrag** (6er). In der API wird **nachtrag** per `mapCategoryTo5` → **vertrags_lv_risiken** gemappt. |

### 2.4 Nachtrag-/Claim-Trigger (Strang B – nur Nachtragspotenzial)

- **Nicht score-relevant.** Sie fließen in `changeOrderAnalysis` (opportunities, byCluster) ein, **nicht** in die Score-Penalties.
- 25 feste Quellen (`NACHTRAG_SOURCES`) mit Keywords/RegExp; zusätzlich KeyFacts-basiert (`KEYFACTS_NACHTRAG_RELEVANT`: bauzeit, baubeginn, fertigstellung, ausfuehrungsfrist, wartung_instandhaltung). Keine Gewichte für den Risiko-Score.

---

## 3. Strukturierte Übersicht (Trigger-/Finding-Quellen)

| Trigger-/Quelle-ID | Kategorie (5er UI) | Quelle | Methode | Basisgewicht | Verstärker | Mehrfachzählung | Bemerkung |
|--------------------|--------------------|--------|---------|--------------|------------|-----------------|-----------|
| DB_&lt;uuid&gt; | Über DB-`category` → mapSupabaseCategoryToScore → mapCategoryTo5 | Supabase `triggers` | Regex oder Keywords | `weight` aus DB | frequencyMultiplier(hits), cap 2.0 | 1 Finding/Trigger, Penalty skaliert mit Treffern | Gewerk-Filter, optional vortext_only |
| SYS_DIN_1988_FEHLT | vertrags_lv_risiken | analyzeLvText | Keyword fehlt | 6 | – | 1× | normen → mapCategoryTo5 → vertrags |
| SYS_DIN_EN_1717_FEHLT | vertrags_lv_risiken | analyzeLvText | Keyword fehlt | 5 | – | 1× | normen → vertrags |
| SYS_DRUCKPRUEFUNG_UNKLAR | technische_vollstaendigkeit | analyzeLvText | Keyword fehlt | 7 | – | 1× | vollstaendigkeit → technische |
| SYS_SPUELUNG_FEHLT | technische_vollstaendigkeit | analyzeLvText | Keyword fehlt | 6 | – | 1× | vollstaendigkeit → technische |
| SYS_EINIGE_WEICHE_FORMULIERUNGEN / SYS_VIELE_… | vertrags_lv_risiken | analyzeLvText | Weichwörter-Count | 6 (Basis) | frequencyMultiplier, max 12 | 1× | nachtrag → mapCategoryTo5 → vertrags |

**Hinweis:** Die 5er-Kategorie für DB-Trigger hängt von der **DB-Spalte `category`** und der Abbildung in `mapSupabaseCategoryToScore` ab (siehe Abschnitt 4). Dort entsteht die **kritische Lücke für Kalkulationsunsicherheit**.

---

## 4. Kategorie-Logik

### 4.1 Zwei Ebenen

- **6er-System (intern, lib/scoring.ts):** normen, vollstaendigkeit, vortext, mengen_schnittstellen, nachtrag, ausfuehrung. Wird von `computeScore` verwendet, aber die **API überschreibt** total und perCategory mit der 5er-Normierung.
- **5er-System (API/UI):** vertrags_lv_risiken, mengen_massenermittlung, technische_vollstaendigkeit, schnittstellen_nebenleistungen, kalkulationsunsicherheit.

### 4.2 Mapping DB/6er → 5er

**Schritt 1 – DB-Kategorie → 6er (`mapSupabaseCategoryToScore`, `lib/analyzeLvText.ts`):**

- „technische“ + „voll“ → vollstaendigkeit  
- „mengen“ / „massenermittlung“ → mengen_schnittstellen  
- „schnittstellen“ / „nebenleistungen“ → mengen_schnittstellen  
- „vertrag“ / „lv-risiko“ / „lv risiko“ → vortext  
- **„kalkulation“ → kalkulation** (6er-Durchlauf für 5er „kalkulationsunsicherheit“)  
- „unsicherheit“ (ohne „kalkulation“) → nachtrag  
- „norm“ → normen  
- Sonst → ausfuehrung  

**Schritt 2 – 6er → 5er (`mapCategoryTo5`, `app/api/score/route.ts`):**

- normen → **vertrags_lv_risiken**
- vollstaendigkeit → **technische_vollstaendigkeit**
- vortext → **vertrags_lv_risiken**
- nachtrag → **vertrags_lv_risiken** (z. B. Weichwörter-Strang A)
- **kalkulation → kalkulationsunsicherheit**
- ausfuehrung → **technische_vollstaendigkeit**
- mengen_schnittstellen → **schnittstellen_nebenleistungen** (wenn Titel/Detail Schnittstellen-Keywords enthalten) oder **mengen_massenermittlung** (wenn Mengen-Keywords oder Default)

**Triggerarten, die in „kalkulationsunsicherheit“ laufen:** DB-Trigger, deren Kategorie (DB-Spalte `category`) den Begriff **„kalkulation“** enthält (z. B. „Kalkulationsunsicherheit“, „Kalkulation“). Die 6er-Kategorie `kalkulation` hat Gewicht 0 und dient nur als Durchlauf; die API summiert deren Penalties in `perCategorySum.kalkulationsunsicherheit` und normiert wie die anderen 5er-Kategorien.

### 4.3 Anzahl Trigger pro Kategorie (konzeptionell)

- **Vertrags-/LV-Risiken:** Alle DB-Trigger mit category „vertrag/vortext/lv-risiko“, alle normen-Findings, alle nachtrag-Findings (Weichwörter), **und** der Default-Fall in mapCategoryTo5 (unbekannte 6er-Kategorie). → **Sehr viele Zuflüsse.**
- **Technische Vollständigkeit:** vollstaendigkeit, ausfuehrung + System-Checks (Druckprüfung, Spülung). → **Mittel.**
- **Mengen & Massenermittlung:** nur mengen_schnittstellen ohne Schnittstellen-Keywords. → **Weniger.**
- **Schnittstellen & Nebenleistungen:** nur mengen_schnittstellen mit Schnittstellen-Keywords. → **Weniger.**
- **Kalkulationsunsicherheit:** **0** (kein Mapping-Ziel).

Die **konkrete** Anzahl pro Kategorie hängt von der **Belegung der DB** (Tabelle `triggers`) ab; im Code ist nur die Zuordnungslogik festgelegt.

---

## 5. Score-Berechnung

### 5.1 Ablauf (app/api/score/route.ts)

1. Findings erzeugen (DB-Trigger + System-Checks + ggf. LLM).
2. Jedes Finding: `category` = `mapCategoryTo5(f.category, f.title, f.detail)` (5er).
3. **perCategorySum[k]** = Summe der `penalty` (Absolutwert) aller Findings in Kategorie k.
4. **lvSizeFactor** = `1 + min(maxBoost, log10(1 + len(lvText) / baseDivisor))` (z. B. baseDivisor 2000, maxBoost 0,6).
5. **scaledMax[k]** = catMax[k] * lvSizeFactor (catMax aus DB `scoring_config` oder Fallback).
6. **ratio[k]** = clamp01(perCategorySum[k] / scaledMax[k]).
7. **eased[k]** = sqrt(ratio) bei easing „sqrt“, sonst linear.
8. **perCategory[k]** = clamp0_100(eased[k] * 100) → **0–100 pro Kategorie.**
9. **Gesamt-Score (total)** = **Mittel der 5 Kategorie-Scores** (gerundet, 0–100).

### 5.2 Wann ist 100 erreicht?

- **Pro Kategorie:** 100, wenn ratio ≥ 1, d. h. **perCategorySum[k] ≥ scaledMax[k]**.
- **Gesamt:** 100, wenn alle 5 Kategorien 100 sind (Mittel = 100).

### 5.3 Rohpunkte und Skalierung

- Rohpunkte = Penalty-Summe pro Kategorie (keine Obergrenze pro Finding; Summe kann beliebig hoch werden).
- Normierung: Division durch **scaledMax** (catMax * sizeF), dann clamp 0–1, dann sqrt (oder linear), dann * 100. **Kein fester „Rohpunkt-Deckel“** vor der Normierung; nur die Ratio wird auf 1 gedeckelt.

### 5.4 computeScore (lib/scoring.ts)

- Wird mit **5er-kategorisierten** Findings aufgerufen (weil findingsMapped vorher mit mapCategoryTo5 überschrieben wurde).
- `computeScore` arbeitet aber mit **6er** CATEGORY_WEIGHTS (normen, vollstaendigkeit, …). Da die Findings nur noch 5er-Keys haben, werden Abzüge auf **nicht existierende** 6er-Keys geschrieben (perCategory["vertrags_lv_risiken"] etc.), die **nicht** in der 6er-Summe vorkommen. **result.total** und **result.perCategory** aus computeScore sind für die 5er-UI **nicht** maßgeblich; die API setzt **total = totalNormalized** und **perCategory = die 5er 0–100-Werte** aus Schritt 5.1.

### 5.5 Standard vs. Expertenmodus

- Im Code der Score-Route gibt es **keinen** Unterschied zwischen Standard- und Expertenmodus für die **Berechnung** von total oder perCategory. Unterschiede betreffen nur die **Darstellung** (z. B. in der UI).

---

## 6. Symptome: Vertrags-/LV-Risiken oft hoch, Kalkulationsunsicherheit oft 0

### 6.1 Warum „Vertrags-/LV-Risiken“ sehr häufig rot oder 100?

- **Viele Zuflüsse:** normen, vortext, nachtrag (Weichwörter) mappen **alle** auf vertrags_lv_risiken.
- **Default in mapCategoryTo5:** Jede unbekannte oder nicht explizit behandelte 6er-Kategorie landet in vertrags_lv_risiken.
- **DB-Trigger:** Wenn viele Trigger in der DB als „Vertrags-/LV-Risiken“ oder „Vortext“ kategorisiert sind, summieren sich die Penalties in vertrags_lv_risiken.
- **catMax:** Fallback für vertrags_lv_risiken ist 70. Bei moderater Penalty-Summe wird ratio schnell ≥ 1 → 100.

### 6.2 Warum „Kalkulationsunsicherheit“ früher 0 war (Behoben)

- **Ursache war:** DB-Trigger mit category „Kalkulationsunsicherheit“ wurden in `mapSupabaseCategoryToScore` als **nachtrag** (6er) gemappt und in `mapCategoryTo5` nach **vertrags_lv_risiken** weitergeleitet.
- **Behebung:** 6er-Kategorie **kalkulation** eingeführt (Gewicht 0). DB-Kategorie mit „kalkulation“ → 6er „kalkulation“ → 5er „kalkulationsunsicherheit“. Weichwörter-Findings bleiben „nachtrag“ → vertrags_lv_risiken.

---

## 7. Claim-/Nachtragspotenzial

- **Berechnung:** `lib/changeOrderAnalysis.ts` → `runChangePotentialEngine` (changePotentialModel) + optionale LLM-Veredelung + Commercial-Strategy + Negotiation-Clusters + Offer-Strategy-Summary. Ausgabe: **opportunities**, **byCluster**, **offerStrategySummary**.
- **Trigger/Regeln:** 25 NACHTRAG_SOURCES (Keyword/RegExp), KeyFacts-basiert (KEYFACTS_NACHTRAG_RELEVANT), System-Logic-Engine, Findings/RiskClauses/KeyFacts als Input. **Nicht** die gleichen Gewichte wie der Score; reines Nachtragspotenzial.
- **„Nur ein Strich“ in der Übersicht:** Wenn **changeOrderAnalysis** null ist (noch nicht geladen, Fehler, oder Feature nicht ausgeführt), zeigt das Cockpit keinen Claim-Level. Wenn **opportunities.length === 0**, wird „Keine“ (grün) angezeigt. Ein **Strich (—)** erscheint typischerweise, wenn **changeOrderAnalysis** null ist und die UI einen Platzhalter rendert (z. B. „—“ statt „Hoch/Mittel/Gering“). Technisch: Feld ist optional; wenn der Aufruf von `/api/change-order-analysis` unterbleibt oder fehlschlägt, bleibt changeOrderAnalysis null.

---

## 8. Optionale Debug-Ausgabe

Unter **?debug=1** liefert die Score-API bereits `perCategorySum`, `sizeF`, `triggersUsed`, `findingsBeforeLlm`, `findingsAfterLlm`.  

Zusätzlich wurde eine **Debug-Erweiterung** eingebaut: Bei **GET/POST mit ?debug=1** enthält die API-Antwort `debug.firedFindings`: ein Array mit Objekten `{ triggerId, category, penalty, title }` (category = 5er-Kategorie). So sieht man, welche Findings gefeuert haben und welcher Kategorie sie zugeordnet wurden. Eine noch detailliertere Ausgabe (pro DB-Trigger: baseWeight, frequencyMultiplier, finalPenalty) wäre nur mit Anpassung von `applyDbTriggers` (Rückgabe von Metadaten) möglich und wurde nicht umgesetzt.

---

## 9. Kurzbewertung

### Was ist gut?

- Klare Trennung: DB-Trigger vs. System-Checks vs. Weichwörter vs. Nachtrag-Strang B.
- Kontextbewusstes Matching (Kontextfenster, Digit-/Letter-Ratio, Signalwörter) reduziert False Positives.
- frequencyMultiplier begrenzt die Wirkung von Massentreffern (cap 2.0).
- Gewerk-Filter vermeidet fachfremde Trigger.
- Vortext-only-Option für vertragsnahe Trigger.
- 5er-Kategorien mit konfigurierbarem catMax und sizeF ermöglichen unterschiedlich große LVs.

### Wo ist es fachlich/technisch unsauber?

- **Kalkulationsunsicherheit** wird nie befüllt (Mapping-Lücke).
- **Vertrags-/LV-Risiken** sammeln zu viele 6er-Kategorien (normen, vortext, nachtrag + Default) → oft überhöht.
- **computeScore** wird mit 5er-kategorisierten Findings aufgerufen, rechnet aber mit 6er-Gewichten → result.total/level unbrauchbar (wird überschrieben).
- **Projekttyp- und Norm-Verstärker** sind nicht angebunden (Platzhalter).
- **Mehrfachzählung:** Pro Trigger nur ein Finding; bei vielen verschiedenen Triggern in derselben Kategorie kann die Summe trotzdem stark steigen (v. a. in vertrags_lv_risiken).

### Die 5 größten Schwachstellen

1. ~~**Mapping: „kalkulationsunsicherheit“ wird nie gesetzt**~~ → **Behoben:** 6er „kalkulation“ + Mapping auf 5er „kalkulationsunsicherheit“.
2. **Vertrags-/LV-Risiken als „Sammelbecken“** (normen, vortext, nachtrag, Default) → oft 100 oder rot.
3. **Keine Gewichtung/Normierung pro Kategorie nach „Wichtigkeit“** – alle 5 Kategorien zählen gleich (Mittel), unabhängig von der Anzahl der Trigger pro Kategorie.
4. **DB-Trigger-Anzahl und -Gewichte** unbekannt ohne DB-Einblick; Ungleichgewicht zwischen Kategorien möglich.
5. **Claim-Anzeige „Strich“** bei fehlendem oder fehlgeschlagenem change-order-analysis-Aufruf nicht explizit dokumentiert; Nutzer können das als „kein Nachtragspotenzial“ missverstehen.

### Die 5 Anpassungen mit dem größten Hebel

1. ~~**mapCategoryTo5 + mapSupabaseCategoryToScore:** Kalkulationsunsicherheit befüllen**~~ → **Umgesetzt:** 6er „kalkulation“, DB „kalkulation“ → 5er „kalkulationsunsicherheit“.
2. **Vertrags-/LV-Risiken entlasten:** normen oder nachtrag (Weichwörter) in eigene 5er-Zuordnung oder Unterlogik (z. B. nur „vortext“-Findings in vertrags_lv_risiken), um Überflutung zu vermeiden.
3. **catMax und Trigger-Mix prüfen:** In der DB Verteilung der Trigger auf die 5 Kategorien und catMax-Werte so anpassen, dass keine Kategorie systematisch über- oder unterbewertet wird.
4. **Debug-Output erweitern:** Pro Finding (oder pro DB-Trigger) baseWeight, mult, finalPenalty und 5er-Kategorie ausgeben (z. B. nur bei debug=1), um Nachvollziehbarkeit zu verbessern.
5. **UI/API:** Bei fehlendem changeOrderAnalysis klare Kennzeichnung (z. B. „Nachtragspotenzial nicht berechnet“ statt nur Strich), um Missverständnisse zu vermeiden.

---

*Ende der IST-Analyse. Keine Änderung an Produktoberfläche oder Architektur.*
