# Nachtragspotenzial – Bereinigung Phase 2 (umgesetzt)

**Datum:** März 2025  
**Ziel:** Bestehende Darstellung und Verdrahtung fachlich sauberziehen, keine neue Engine – nur Trennung Strang A/B, KPI-Korrektur, UI-Entdopplung, Konstante NACHTRAG.

---

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| **lib/changeOrderAnalysis.ts** | Konstante `NIGHTRAG_SOURCES` → `NACHTRAG_SOURCES` (alle Referenzen); Datei-Kommentar um „Strang B“ ergänzt; Kommentar bei NACHTRAG_SOURCES um „Strang B“ ergänzt. |
| **lib/analyzeLvText.ts** | Kommentar beim Weichwörter-Check: klare Zuordnung zu „Strang A“ und Hinweis, dass Strang B (echtes Nachtragspotenzial) getrennt ist. |
| **app/api/score/route.ts** | Kommentar beim Mapping `nachtrag` → `vertrags_lv_risiken`: Strang A vs. Strang B. |
| **app/admin/score/page.tsx** | KPI „Claim-Potenzial“ aus Nachtragsanalyse (Strang B) gespeist, sonst „Nicht ermittelt“; Tab „Risiken“: NACHTRAGSANALYSE-Block durch Hinweis + Button „Zum Tab Nachtragspotenzial“ ersetzt; Tab „Nachtragspotenzial“: Inhalt durch gemeinsame Komponente `NachtragspotenzialBlock` ersetzt; Import der neuen Komponente. |
| **components/NachtragspotenzialBlock.tsx** | **Neu.** Wiederverwendbare UI-Komponente für die Nachtragsanalyse (Strang B): Header, KI-Checkbox, Button, Lade-/Leerzustand, Level + Liste „Mögliche Ursachen“, Experten-Ansicht nach Cluster. |

---

## KPI „Claim-Potenzial“ – vorher / nachher

- **Vorher (fachlich falsch):**  
  Die Karte zeigte dieselbe Logik wie „Gesamt-Risiko“: abgeleitet aus `result.total` (Score 0–100). Es wurden also **keine** Nachtragspotenziale angezeigt, sondern nur die allgemeine Risikostufe (niedrig/mittel/hoch). Das war begrifflich falsch und vermischte Strang A (Score) mit der Bezeichnung „Claim-Potenzial“.

- **Nachher:**  
  - **Wenn** die Nachtragsanalyse (Strang B) durchgeführt wurde (`changeOrderAnalysis` vorhanden): Anzeige **Hoch / Mittel / Gering / Keine** aus den deduplizierten Opportunities (`deduplicatedOpportunities`), abgeleitet aus den Feldern `potential` (high/medium/low).  
  - **Wenn** noch keine Nachtragsanalyse durchgeführt wurde: Anzeige **„Nicht ermittelt“** (dezent).  
  Es wird also **keine** Fallback-Logik aus `result.total` mehr verwendet; die Karte bezieht sich ausschließlich auf die on-demand Nachtragsanalyse (Strang B).

---

## UI-Dopplung – zusammengeführte Komponenten

- **Vorher:**  
  - Im Tab **„Risiken“** gab es einen großen Block „NACHTRAGSANALYSE“ (Button, KI-Checkbox, Ladezustand, bei Daten: Debug-Zeile + Darstellung nach Cluster).  
  - Im Tab **„Nachtragspotenzial“** gab es einen zweiten Block mit gleichem Button/Checkbox/Ladezustand und bei Daten: Level + „Mögliche Ursachen“-Liste + Footer.  
  → Derselbe Inhalt (Button, Analyse, Ergebnis) war an zwei Stellen implementiert und gepflegt.

- **Nachher:**  
  - **Eine** gemeinsame Komponente: **`NachtragspotenzialBlock`** (`components/NachtragspotenzialBlock.tsx`).  
  - Sie wird **nur im Tab „Nachtragspotenzial“** gerendert (inkl. Kurzfassung Level + Liste und im Expertenmodus Darstellung nach Cluster).  
  - Im Tab **„Risiken“** steht nur noch ein kurzer Hinweis: „Die Nachtragsanalyse wird im Tab ‚Nachtragspotenzial‘ ermittelt und angezeigt“ plus Button **„Zum Tab Nachtragspotenzial“** (wechselt per `setResultTab('nachtragspotenzial')`).  
  → Eine einzige Stelle für die Nachtragsanalyse-UI; keine doppelte Implementierung mehr.

---

## Begriffstrennung Strang A / Strang B

- **Strang A (unverändert, nur kommentiert):**  
  - Weichwörter-Check in `lib/analyzeLvText.ts` erzeugt ein Finding mit `category: "nachtrag"`.  
  - Dieses Finding fließt in den Score und wird in der Score-Route der Kategorie „vertrags_lv_risiken“ zugeordnet.  
  - In Code und Kommentaren ist nun klar: „Strang A“ = Risiko-/Weichwörter-Indikator für die Bewertung, **kein** vollwertiges Nachtragspotenzial-Ergebnis.

- **Strang B (unverändert, nur kommentiert):**  
  - On-demand Nachtragsanalyse über `POST /api/change-order-analysis` → Opportunities, byCluster, debug.  
  - Datei-Kommentar in `lib/changeOrderAnalysis.ts` und Kommentar bei `NACHTRAG_SOURCES` kennzeichnen dies als „Strang B: echtes Nachtragspotenzial“.  
  - Weichwörter-Findings werden **nicht** als vollwertige Nachtragspotenziale etikettiert; sie können als **eine** Eingabe in die Nachtragsanalyse einfließen (als normales Finding), die Auswertung bleibt die strukturierte Opportunity-Liste (Strang B).

- **Score-Mapping:**  
  Das bestehende Mapping `category "nachtrag"` → `"vertrags_lv_risiken"` in der Score-Route bleibt unverändert; nur ein Kommentar kennzeichnet es als Strang A.

---

## Konstante NIGHTRAG → NACHTRAG

- In **lib/changeOrderAnalysis.ts** hieß die Konstante für die 25 Nachtragsquellen bisher **`NIGHTRAG_SOURCES`** (Tippfehler „NIGHTRAG“).  
- Umbenennung in **`NACHTRAG_SOURCES`** in der Definition und in allen Verwendungen:  
  - `matchSource` (Parameter-Typ und Schleife),  
  - `runRuleBasedBaseline` (Fallback bei Findings und bei RiskClauses).

---

## Was bewusst nicht geändert wurde

- **API-Contract** `POST /api/change-order-analysis`: unverändert (Request/Response).  
- **Score-Berechnung** und Kategorie-Gewichte: unverändert.  
- **Neue Nachtragspotenzial-Engine:** nicht gebaut; nur Bestandslogik bereinigt und UI/KPI angepasst.

---

## Kurzfassung

- **Dateien geändert:** 5 (changeOrderAnalysis, analyzeLvText, score/route, admin/score/page, neue Komponente NachtragspotenzialBlock).  
- **KPI:** Claim-Potenzial kommt jetzt ausschließlich aus der Nachtragsanalyse (Strang B) oder zeigt „Nicht ermittelt“.  
- **UI:** Eine Komponente `NachtragspotenzialBlock`, nur im Tab „Nachtragspotenzial“; Tab „Risiken“ verweist per Hinweis + Button auf diesen Tab.  
- **Begriffe:** Strang A (Weichwörter/Score) und Strang B (echtes Nachtragspotenzial) im Code und in der UI klar getrennt und kommentiert.  
- **Konstante:** NIGHTRAG_SOURCES → NACHTRAG_SOURCES.
