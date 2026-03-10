# Nachtragspotenzial – API- und UI-Anbindung der neuen Struktur

**Stand:** Additive Anbindung der neuen Engine-Struktur (ChangePotentialSummary) an API und Frontend. Keine Breaking Changes; Legacy bleibt funktionsfähig.

---

## 1. API – additiv neue Felder

**Route:** `app/api/change-order-analysis/route.ts` (POST)

**Bestehende Response (unverändert):**
- `opportunities`: ChangeOrderOpportunity[] (Legacy)
- `byCluster`: Record<ChangeOrderCluster, ChangeOrderOpportunity[]>
- `debug`: { ruleBasedCount, llmCount, deduplicatedCount }

**Neu hinzugefügt (additiv):**
- `changePotentialSummary`: nur gesetzt, wenn die neue Engine ein Ergebnis liefert (bei jedem Aufruf der Fall). Enthält:
  - `overallIndex`: number (0–100)
  - `totalItems`: number
  - `highImpactCount`: number
  - `veryHighImpactCount`: number
  - `strongEnforceabilityCount`: number
  - `topFields`: Array<{ fieldType, count }>
  - `topMechanisms`: Array<{ mechanism, count }>
  - `items`: Array<ChangePotentialItem>

**Pro Item (changePotentialSummary.items[]):**
- `id`, `title`, `trade`, `category`
- `sourceType`, `sourcePath`, `sourceQuote`, `sourcePositionRef`
- `fieldType`, `changeMechanism`
- `impactLevel`, `enforceability`, `confidence`
- `recommendedAction`, `reasoning`
- `questionDraft`, `clarificationDraft`, `pricingHint`
- `tags`, `evidenceIds`, `legacySource`

**Defensive Logik:**  
`changePotentialSummary` wird nur in die JSON-Response aufgenommen, wenn `result.changePotentialSummary != null` ist. Fehlt das Feld, arbeitet das Frontend mit dem Legacy-Fallback.

---

## 2. Geänderte Komponenten

| Komponente / Datei | Anpassung |
|--------------------|-----------|
| **app/api/change-order-analysis/route.ts** | Response um optionales `changePotentialSummary` ergänzt (payload-Objekt, nur bei Vorhandensein gesetzt). |
| **lib/changeOrderAnalysis.ts** | `ChangeOrderResult` um `changePotentialSummary?: ChangePotentialSummary` erweitert; `runChangeOrderAnalysis` liefert `summary` mit. |
| **app/admin/score/page.tsx** | State-Typ von `changeOrderAnalysis` um `changePotentialSummary?: ChangePotentialSummary` erweitert. |
| **components/NachtragspotenzialBlock.tsx** | Typen um `changePotentialSummary` in `NachtragspotenzialAnalysisResult` ergänzt. Bevorzugte Darstellung: wenn `analysis.changePotentialSummary` vorhanden und `summary.items.length > 0` → **NewEngineView** (neue Struktur). Sonst **LegacyView** (bisherige Darstellung). Zusätzlich: Labels für fieldType, changeMechanism, impactLevel, enforceability, recommendedAction, sourceType. |

---

## 3. Fallback auf Legacy

- **Bedingung für neue Darstellung:**  
  `analysis.changePotentialSummary != null && analysis.changePotentialSummary.items.length > 0`

- **Fallback (Legacy):**  
  Wenn `changePotentialSummary` fehlt oder `items` leer ist, rendert die Komponente wie bisher:
  - Kurzfassung „Nachtragspotenzial: Hoch/Mittel/Gering/Keine“ aus `deduplicatedOpportunities`
  - Liste „Mögliche Ursachen“ (nur Titel)
  - Im Expertenmodus: Gruppierung nach Cluster (leistungsaenderung, leistungsmehrung, schnittstelle, erschwernis) mit Potential, Risiko, Assertiv, reason, sourceTextSnippets, sourceFindingIds

- **Leerer Zustand:**  
  Wenn weder neue Struktur noch Legacy-Einträge vorhanden sind (`deduplicatedOpportunities.length === 0`), wird der bestehende Empty-State „Keine Nachtragspotenziale erkannt“ angezeigt.

---

## 4. UI – was basiert auf der neuen Engine?

**Wenn `changePotentialSummary` mit Einträgen geliefert wird:**

- **Überblick (A):**
  - Gesamtindex 0–100 (farbig nach Schwellen)
  - Anzahl Felder, Anzahl hohe/sehr hohe Hebel, Anzahl gut durchsetzbar
  - Top-Feldtypen und Top-Mechanismen (Kurzinfo)

- **Pro Item (B):**
  - Titel, ggf. Gewerk (trade)
  - Feldtyp, Mechanismus, Hebel (impactLevel), Durchsetzbarkeit, **empfohlene Aktion** (hervorgehoben)
  - Begründung (reasoning)
  - Bei Vorhandensein: Rückfrage-Vorschlag (questionDraft), Klarstellungs-Vorschlag (clarificationDraft), Kalkulationshinweis (pricingHint)

- **Expertenmodus (D):**
  - Quelle (sourceType), Pfad (sourcePath), Zitat (sourceQuote), Positionsreferenz (sourcePositionRef)
  - Konfidenz (confidence), Tags

**Legacy-Teile (weiterhin genutzt beim Fallback):**
- Level aus potential (high/medium/low) → „Hoch/Mittel/Gering“
- Liste möglicher Ursachen (nur Titel)
- Expertenmodus: Darstellung nach Cluster mit reason, sourceTextSnippets, sourceFindingIds

---

## 5. Was noch Übergang ist

- **KPI „Claim-Potenzial“ auf der Übersicht:**  
  Basiert weiterhin auf `deduplicatedOpportunities` (Legacy-Liste), die aus dem gleichen Lauf wie die neue Engine stammt (gemappt aus derselben Summary). Inhaltlich konsistent; eine spätere Umstellung auf direkte Nutzung von `changePotentialSummary.overallIndex` oder aggregierten Werten ist möglich.

- **Legacy-Felder `opportunities` und `byCluster`:**  
  Werden von der API weiterhin geliefert und von der UI nur im Fallback verwendet. Keine Abschaltung oder Entfernung.

- **LLM:**  
  In diesem Schritt unverändert; LLM-Opportunities werden wie bisher mit den Engine-Ergebnissen zusammengeführt und erscheinen in der Legacy-Liste. Die neue UI zeigt ausschließlich die Engine-Items (`changePotentialSummary.items`), ohne LLM-Ergebnisse in die neue Darstellung zu übernehmen (keine LLM-Erweiterung in diesem Schritt).

---

## 6. Kurzfassung

- **API:** `changePotentialSummary` additiv in der Response; bestehende Felder unverändert.
- **Frontend:** NachtragspotenzialBlock nutzt bevorzugt die neue Struktur (Überblick + Items mit Feldtyp, Mechanismus, Hebel, Durchsetzbarkeit, empfohlene Aktion, Entwürfe); Fallback auf Legacy-Darstellung wenn keine neue Summary mit Einträgen.
- **Keine Breaking Changes;** Legacy-Darstellung und -Daten bleiben gültig und werden bei Bedarf weiter genutzt.
