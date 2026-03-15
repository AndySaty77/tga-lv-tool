# Root-Cause-Analyse: Gewerkefremde Trigger (SYS_* in Elektro-LVs)

**Problem:** In Elektro-LVs feuern fachfremde SYS-Checks (DIN 1988, DIN EN 1717, Druckprüfung, Spülung).  
**Fokus:** Warum greift der Gewerk-Scope bei diesen Findings nicht?

---

## 1. Relevante Dateien

| Datei | Rolle |
|-------|--------|
| **`app/api/score/route.ts`** | Lädt Trigger aus Supabase, ruft `detectDisciplines(textForAnalysis)` auf, filtert DB-Trigger nach `allowDisciplines`, ruft `analyzeLvText(textForAnalysis, dbTriggers, opts)` auf. Enthält **nicht** die SYS-Checks. |
| **`lib/analyzeLvText.ts`** | Enthält die **gesamte** Finding-Erzeugung: `applyDbTriggers` (nur für übergebene `dbTriggers`) und **unconditional** die SYS-Checks (DIN 1988, DIN EN 1717, Druckprüfung, Spülung) sowie Weichwörter. Erhält **keine** Disziplin-/Gewerk-Information. |
| **`lib/findingsPresets.ts`** | Definiert PRESET_FINDINGS für DIN_1988_FEHLT, DRUCKPRUEFUNG_UNKLAR, VORTEXT_ABRECHNUNG_FEHLT (wird von analyzeLvText für SYS_* verwendet). |

**Kernbefund:** Die Gewerk-Logik lebt ausschließlich in **`app/api/score/route.ts`** (Filter auf DB-Trigger). Die SYS-Checks leben in **`lib/analyzeLvText.ts`** und haben **keinen Zugriff** auf Gewerk/Disciplines.

---

## 2. DB-Trigger-Flow

1. **Laden**  
   `app/api/score/route.ts` (ca. Zeile 254–271):  
   `supabase.from("triggers").select("id, name, ..., disciplines, ...")`  
   → Alle aktiven Trigger aus der DB.

2. **Gewerk ermitteln**  
   `detectDisciplines(textForAnalysis)` (Zeile 278)  
   → `allowDisciplines = det.all` (primary + secondary, nur Gewerke mit ≥ 3 Treffern).

3. **Filtern (vor dem Match)**  
   Zeile 282–294:  
   - Trigger mit `disciplines`-Array.  
   - Wenn `allowDisciplines.length > 0`: Trigger bleibt nur, wenn `disciplines` mindestens einen Eintrag hat, der `"global"` ist oder in `allowDisciplines` vorkommt.  
   - Trigger **ohne** `disciplines` werden verworfen (Legacy).  
   - Wenn **kein** Gewerk erkannt wurde (`allowDisciplines.length === 0`): **alle** Trigger werden zugelassen (defensiv).

4. **Matchen / Finding erzeugen**  
   `analyzeLvText(textForAnalysis, dbTriggers, opts)` (Zeile 314)  
   → Nur die **bereits gefilterten** `dbTriggers` werden in `applyDbTriggers` im Modul `analyzeLvText` verarbeitet.  
   **Kette:** Trigger laden → nach `allowDisciplines` filtern → `analyzeLvText` mit gefilterter Liste → `applyDbTriggers` → Findings nur von diesen Triggern.

**Fazit DB-Trigger:** Scope greift **vor** dem Match; nur Trigger mit passendem `disciplines`/global kommen in `analyzeLvText` und können Findings erzeugen.

---

## 3. SYS-Check-Flow

**Ort:** `lib/analyzeLvText.ts`, Funktion `analyzeLvText` (ab Zeile 352).

**Ablauf:**

1. Text wird bereinigt: `text = preprocessLvText(raw)` (Zeile 358).
2. **DB-Trigger** (falls `dbTriggers.length`): `applyDbTriggers(...)` → Findings nur von übergebenen Triggern (Zeile 361–365).
3. **SYS-Checks (unconditional):**  
   - Zeile 367–375: `hasDIN1988` / `hasEN1717` → wenn **nicht** im Text → sofort `findings.push(SYS_DIN_1988_FEHLT)` bzw. `SYS_DIN_EN_1717_FEHLT`.  
   - Zeile 385–401: `hasDruckpruefung` / `hasSpuelung` → wenn **nicht** im Text → `SYS_DRUCKPRUEFUNG_UNKLAR` bzw. `SYS_SPUELUNG_FEHLT`.  
4. Danach Weichwörter-Check (Strang A).

**Wichtig:**  
- Es gibt **keine** Bedingung auf Gewerk, Disziplin oder `allowDisciplines`.  
- Es gibt **keinen** Parameter `disciplines` oder `primaryDiscipline` in `analyzeLvText(lvTextRaw, dbTriggers, opts)`.  
- `opts` enthält nur `vortext?: string`.  
- Die vier SYS-Checks (DIN 1988, EN 1717, Druckprüfung, Spülung) laufen **immer** auf dem gesamten, bereinigten LV-Text.

**Antwort auf Punkt 3:**  
SYS_* werden in **`lib/analyzeLvText.ts`** in `analyzeLvText` erzeugt. Dort findet **kein** Gewerk-/Discipline-Check statt; die Checks sind explizit Trinkwasser/Sanitär-relevant, werden aber für **jedes** LV (also auch reines Elektro-LV) ausgeführt.

---

## 4. Scope-/Discipline-Prüfung

| Wo | Was wird geprüft? | Gilt für |
|----|-------------------|----------|
| **app/api/score/route.ts** (Zeile 282–294) | `allowDisciplines` (aus `detectDisciplines`); Filter: Trigger nur, wenn `disciplines` ∩ (global ∪ allowDisciplines). | **Nur DB-Trigger.** |
| **lib/analyzeLvText.ts** | **Keine** Prüfung auf Disziplin/Gewerk. | – |

**Weiche Defaults:**  
- Wenn **kein** Gewerk erkannt wird (`allowDisciplines.length === 0`), werden **alle** DB-Trigger zugelassen (Zeile 291–292: `return true`). Das betrifft nur DB-Trigger, nicht die SYS-Checks.  
- Es gibt keine Aufweichung wie `"all"`, `"general"`, `"querschnitt"`, `"*"` für die **SYS-Checks** – diese werden schlicht nie anhand von Disziplin gefiltert.

**Kernpunkt:**  
Die einzige Stelle, an der `disciplines`/Scope genutzt wird, ist der **Filter der DB-Trigger** in der Score-Route. Die SYS-Checks liegen in einem Modul, das **keine** Gewerk-Information erhält und sie auch nicht auswertet.

---

## 5. Nutzen DB-Trigger und SYS-Checks dieselbe Scope-Logik?

**Nein.**

- **DB-Trigger:**  
  - Werden in der **Route** nach `allowDisciplines` gefiltert.  
  - Nur Trigger mit `disciplines` ⊇ { global oder erkanntes Gewerk } werden an `analyzeLvText` übergeben.  
  - Scope-Logik: **nur hier**, vor dem Aufruf von `analyzeLvText`.

- **SYS-Checks:**  
  - Werden **innerhalb** von `analyzeLvText` erzeugt, ohne Gewerk-Parameter.  
  - Es gibt **keine** Scope-Logik für SYS_*; sie laufen immer.

**Relevante Stellen:**  
- Scope für DB-Trigger: `app/api/score/route.ts` Zeile 282–294.  
- SYS-Checks ohne Scope: `lib/analyzeLvText.ts` Zeile 366–401 (kein if/guard auf sanitaer/elektro/…).

---

## 6. Wie wird das Dokument-/LV-Gewerk bestimmt?

- **Funktion:** `detectDisciplines(lvText: string)` in **`app/api/score/route.ts`** (Zeile 149–211).  
- **Eingabe:** `textForAnalysis` = bei vorhandenem Split: konkatenierter Vortext + Positionen; sonst voller `lvText`.  
- **Logik:**  
  - Pro Gewerk (heizung, sanitaer, lueftung, msr, elektro, kaelte) werden Keyword/Regex-Treffer gezählt.  
  - **Primary:** Gewerk mit den meisten Treffern, sofern ≥ `MIN_HITS` (3).  
  - **Secondary:** alle anderen Gewerke mit Trefferzahl ≥ 60 % der Primary-Treffer.  
  - **all** = primary + secondary (ohne "global"; "global" kommt nur aus der DB bei Triggern).  
- **Ausgabe:** `det.primary`, `det.secondary`, `det.all`, `det.scores`.  
- **Verwendung:**  
  - `allowDisciplines = det.all` → nur dafür wird der DB-Trigger-Filter gebaut.  
  - `det` wird **nicht** an `analyzeLvText` übergeben; die SYS-Checks kennen weder primary noch all.

**Antworten auf die Einzelfragen:**

- Es gibt ein **primary** (Hauptgewerk) und **secondary** (Nebengewerke über 60 %-Schwelle).  
- Vortext und Positionen werden **nicht** getrennt bewertet; es wird ein gemeinsamer `textForAnalysis` gebildet und einmal `detectDisciplines` darauf angewendet.  
- **Ja:** Schon wenige Sanitär-Begriffe (z. B. "Trinkwasser", "DIN 1988") im Text erhöhen `scores.sanitaer`. Wenn dadurch Sanitär als primary oder secondary zählt, werden **DB-Trigger** mit `disciplines: ["sanitaer"]` zugelassen. Die **SYS-Checks** hingegen hängen **nicht** von dieser Erkennung ab – sie feuern unabhängig davon in jedem LV.

---

## 7. Wahrscheinlichste technische Ursachen (1–3)

1. **SYS-Checks haben keine Scope-Logik (Hauptursache)**  
   Die vier Sanitär/Trinkwasser-SYS-Checks (DIN 1988, DIN EN 1717, Druckprüfung, Spülung) werden in `lib/analyzeLvText.ts` ohne jede Gewerk-Prüfung ausgeführt. `analyzeLvText` bekommt keine Disziplin-Information und enthält keine Bedingung wie „nur ausführen, wenn Sanitär in allowDisciplines / primary ist“. Daher feuern sie in **jedem** LV, also auch in reinen Elektro-LVs.

2. **Gewerk-Erkennung wird nur für DB-Trigger genutzt**  
   `detectDisciplines` und `allowDisciplines` existieren nur in der Score-Route und fließen ausschließlich in den **Filter der DB-Trigger** ein. Die Ergebnisliste (primary, secondary, all) wird nicht an `analyzeLvText` übergeben. Dadurch kann die SYS-Logik den Scope gar nicht berücksichtigen, auch wenn man ihn später einbauen wollte.

3. **Kein zweiter Filter auf Findings nach Gewerk**  
   Nach `analyzeLvText` gibt es keinen Schritt, der einzelne Findings (z. B. SYS_*) anhand des erkannten Gewerks verwirft. Alle Findings (DB + SYS) gehen direkt in Kategorien-Mapping und Score. Ein „nachträglicher“ Scope-Filter auf Finding-Ebene existiert nicht.

---

## 8. Konkreter Fix-Vorschlag

- **Option A (minimal, empfohlen):** SYS-Checks nur ausführen, wenn das LV-Gewerk „sanitaer“-relevant ist.  
  - In **`app/api/score/route.ts`:** Ergebnis von `detectDisciplines` an `analyzeLvText` übergeben (z. B. neuer Parameter `allowedDisciplinesForSysChecks` oder `primaryDiscipline`).  
  - In **`lib/analyzeLvText.ts`:**  
    - Signatur erweitern, z. B. `opts?: { vortext?: string; allowDisciplines?: string[] }`.  
    - Vor den vier SYS-Checks (DIN 1988, EN 1717, Druckprüfung, Spülung) eine Guard: nur ausführen, wenn `allowDisciplines` leer ist (defensiv wie bei DB-Triggern) **oder** `allowDisciplines` mindestens `"sanitaer"` enthält (oder eine konfigurierbare Liste sanitaer-relevanter Keys).  
  - So bleiben die Checks in Sanitär-LVs aktiv, in reinen Elektro-LVs (nur elektro in `all`) werden sie nicht erzeugt.

- **Option B (strikter):** SYS-Checks pro Gewerk konfigurierbar machen (z. B. welche SYS_* für welches Gewerk laufen) und in `analyzeLvText` anhand von `allowDisciplines`/primary auswerten. Aufwand größer, aber flexibler für künftige Gewerke.

- **Option C:** Nach dem Aufruf von `analyzeLvText` in der Route Findings filtern: SYS_DIN_1988_FEHLT, SYS_DIN_EN_1717_FEHLT, SYS_DRUCKPRUEFUNG_UNKLAR, SYS_SPUELUNG_FEHLT entfernen, wenn `allowDisciplines` nicht "sanitaer" enthält. Weniger sauber (Logik bleibt zweigeteilt), aber ohne Signaturänderung von `analyzeLvText`.

---

## 9. Welche Datei zuerst anfassen?

**Zuerst:** **`lib/analyzeLvText.ts`**  
- Hier werden die SYS-Checks erzeugt; hier muss entweder eine Gewerk-Abhängigkeit eingebaut werden (sobald Gewerk übergeben wird) oder – bei Option C – die Route.  
- Sinnvolle Reihenfolge:  
  1. **`app/api/score/route.ts`:** `det` (oder `allowDisciplines`/primary) an `analyzeLvText(..., opts)` übergeben (z. B. `opts.allowDisciplines = det.all`).  
  2. **`lib/analyzeLvText.ts`:** `AnalyzeLvTextOptions` um `allowDisciplines?: string[]` erweitern und vor den vier SYS-Checks die Guard einbauen (nur ausführen, wenn Sanitär im Scope oder Scope leer).

Damit nutzen DB-Trigger und SYS-Checks dieselbe Gewerk-Basis, und gewerkefremde SYS-Findings in Elektro-LVs entfallen.
