# KeyFacts – IST-Analyse der bestehenden Logik

**Stand:** Dokumentation des aktuellen Zustands ohne Architekturänderung.  
**Ziel:** Transparenz über Extraktion, Felder, Quellen, Methoden und Schwächen.

---

## 1. Welche KeyFacts werden aktuell extrahiert?

Die Extraktion arbeitet mit einem **festen KEYSET** (keine dynamischen Felder). Alle folgenden Felder sind im System definiert; ob sie gefüllt werden, hängt von Vortext und Extraktionsweg ab.

### 1.1 Definierte Felder (KEYSET in `app/api/analyze-vortext/route.ts`)

| Kategorie | Interner Feldname | Anzeige-Label (Score-Page) | Anmerkung |
|-----------|------------------|----------------------------|-----------|
| **Projekt & Beteiligte** | `bauvorhaben` | Bauvorhaben / Objekt | Wird in der UI auch für Projektname genutzt (Fallback: objektbezeichnung/projektbezeichnung, die von der API **nicht** geliefert werden). |
| | `ort` | Ort / Standort | |
| | `gewerk` | Gewerk | |
| | `bauherr_ag` | Bauherr / Auftraggeber | |
| | `planer` | Planer / Architekt | |
| **Termine/Fristen** | `baubeginn` | Baubeginn | |
| | `bauzeit` | Bauzeit / Dauer | |
| | `fertigstellung` | Fertigstellung / Abnahme | |
| | `ausfuehrungsfrist` | Ausführungsfrist / Terminplan | |
| | `ausfuehrungszeit` | Ausführungszeit | |
| | `fristAngebot` | Angebotsfrist | |
| | `bindefrist` | Bindefrist | |
| | `submission_einreichung` | Submission / Einreichung | |
| **Vertrag** | `vertragsgrundlagen` | Vertragsgrundlagen | |
| | `vertragsstrafe` | Vertragsstrafe / Pönale | |
| | `gewaerhleistung` | Gewährleistung / Mängelhaftung | |
| | `wartung_instandhaltung` | Wartung / Instandhaltung | |
| | `vob_bgb` | VOB/B / BGB | Kurzer Wert (z. B. "VOB", "BGB"). |
| | `rangfolge` | Rangfolge Vertragsunterlagen | |
| **Zahlung/Preis** | `zahlungsbedingungen` | Zahlungsbedingungen | |
| | `abschlagszahlung` | Abschlagszahlung | |
| | `schlussrechnung` | Schlussrechnung / Zahlungsziel | |
| | `preisgleitung` | Preisgleitklausel / Rohstoffpreise | |

**Nicht im KEYSET, aber in der UI erwartet:**  
- `objektbezeichnung`, `projektbezeichnung` – werden von der API **nicht** ausgegeben (Schema nur KEYSET). Projektname kommt in der Praxis aus `bauvorhaben` (über `nameKeysInOrder` beim Speichern bzw. Anzeige-Fallback).

---

## 2. Pro Feld: Quelle, Methode, UI, Confidence

### 2.1 Wo werden KeyFacts erzeugt?

| Komponente | Rolle |
|------------|--------|
| **`app/api/analyze-vortext/route.ts`** | Zentrale Extraktion: Aufruf durch Score-Pipeline mit Vortext (+ optional normalisierte GAEB-Struktur). Liefert `keyFacts`, `keyFactConfidence`, `keyFactsDebug`. |
| **`app/admin/score/page.tsx`** | Empfängt Vortext-Result, setzt `keyFacts`/`keyFactConfidence`/`keyFactsDebug` in State. Filtert für Anzeige: `keyFactsProjektdaten` (PROJEKTDATEN_KEYS), `keyFactsVertragsrahmen` (VERTRAGSRAHMEN_KEYS). Zeigt nur Felder mit Confidence ≥ 0,55 (bzw. nicht &lt; 0,55). |
| **`lib/clarificationQuestions.ts`** | Nutzt `keyFacts` für Rückfragen: fehlende IMPORTANT_KEYFACTS werden als „fehlende Angabe“ thematisiert. |
| **`lib/offerAssumptions.ts`** | Analog: KeyFacts für Angebotsannahmen. |
| **`lib/changePotentialModel.ts`** | KEYFACT_PATTERNS: fehlende Felder (z. B. bauzeit, baubeginn, fertigstellung, ausfuehrungsfrist, wartung_instandhaltung) werden als Nachtragspotenzial-Feld („nicht angegeben“) genutzt. |

### 2.2 Extraktionswege (nach Priorität)

1. **GAEB-XML / normalisierte Struktur** (`useNormalizedStructure === true`):
   - **Quelle:** `normalized.globalRemarks`, `normalized.topLabelForPreface`, `normalized.groups[].label`, `normalized.groupRemarks`.
   - **Methode:** Zuerst **Label-basiert** (LABEL_PATTERNS: Bauherr, Ort, Bauvorhaben, Bindefrist, Submission, Baubeginn), dann **Heuristik** (extractKeyFactsRegex pro Segment). Nur STRUCTURED_KEYFACT_FIELDS (10 Felder).
   - **LLM-Fallback:** Für fehlende Felder aus LLM_FALLBACK_FIELDS wird ein separater LLM-Aufruf (llmKeyFactsFallback) genutzt; Eingabe nur strukturierte Texte (kein Rohtext). Quelle dann `llm-fallback`.

2. **Legacy-Text** (Vortext aus Split/Structure/Raw):
   - **Quelle:** Einleitungstext (z. B. split.vortext, structure.raw.full[0:vortextEnd], oder lvText).
   - **Methode:** **Regex** (extractKeyFactsRegex) + **LLM** (llmExtract mit vollem Vortext). Merge: mergeKeyFactsPreferRegex (Regex bevorzugt, LLM nur bei LLM_PREFERRED_FIELDS oder leerem/ungültigem Regex-Wert, Confidence ≥ 0,55).

3. **Nachbearbeitung:** llmRepairKeyFacts (Bereinigung/Reparatur), dann Validierung (isGarbageValue, isInvalidOrGenericValue, isWeakOrInvalidFieldValue, FIELD_MATRIX).

### 2.3 Confidence (Sicherheit)

- **Berechnung:** Pro Feld wird **keine** echte Metrik aus dem Text berechnet. Es gibt zwei feste Werte:
  - `sourcePath === "legacy-fallback"` → **0,75**
  - sonst → **0,85**
- Bei LLM-Fallback liefert das LLM ein eigenes `keyFactConfidence` (0..1); das wird für Merge/Filter genutzt (Schwelle 0,55), aber **nicht** 1:1 in `keyFactConfidence` der Response übernommen – die Response setzt nur 0,75/0,85.
- **UI:** Felder mit Confidence &lt; 0,55 werden in der Übersicht nicht angezeigt (gefiltert in keyFactsProjektdaten/keyFactsVertragsrahmen). Optional wird „Sicherheit: X%“ angezeigt (z. B. 85 %), abgeleitet aus dem gleichen Wert.

---

## 3. Kompakte Übersichtstabelle

| KeyFact | Vorhanden? | Interner Name | Quelle | Methode | UI sichtbar | Confidence? | Bemerkung |
|---------|------------|---------------|--------|---------|-------------|------------|-----------|
| Projektname/Objekt | Ja (als bauvorhaben) | bauvorhaben | Remarks, TopLabel, Groups, Vortext | Label + Regex + LLM | Ja (Projektdaten) | 0,75/0,85 | objektbezeichnung/projektbezeichnung nicht aus API; Projektname = bauvorhaben |
| Ort/Standort | Ja | ort | Wie oben | Label + Regex + LLM | Ja | 0,75/0,85 | |
| Bauherr/Auftraggeber | Ja | bauherr_ag | Wie oben | Label + Regex + LLM | Ja | 0,75/0,85 | |
| Gewerk | Ja | gewerk | Wie oben | Regex + LLM (LLM preferred) | Ja | 0,75/0,85 | |
| Planer | Ja | planer | Vortext (nur Legacy/LLM) | Regex + LLM | Nein | 0,75/0,85 | planer ist nicht in PROJEKTDATEN_KEYS_ORDER → wird in der Übersicht nicht angezeigt |
| Baubeginn | Ja | baubeginn | Wie oben | Label + Regex + LLM | Ja | 0,75/0,85 | |
| Bauzeit | Ja | bauzeit | Vortext | Regex + LLM | Ja (Projektdaten) | 0,75/0,85 | |
| Fertigstellung | Ja | fertigstellung | Vortext | Regex + LLM | Ja (Projektdaten) | 0,75/0,85 | |
| Ausführungsfrist | Ja | ausfuehrungsfrist | Vortext | Regex + LLM | Nein | 0,75/0,85 | |
| Ausführungszeit | Ja | ausfuehrungszeit | Vortext | Regex + LLM | Nein | 0,75/0,85 | |
| Angebotsfrist | Ja | fristAngebot | Vortext | Regex + LLM | Nein | 0,75/0,85 | |
| Bindefrist | Ja | bindefrist | Wie oben | Label + Regex + LLM | Ja | 0,75/0,85 | |
| Submission/Einreichung | Ja | submission_einreichung | Wie oben | Label + Regex + LLM | Ja | 0,75/0,85 | |
| Vertragsgrundlagen | Ja | vertragsgrundlagen | Wie oben | Regex + Heuristik + LLM | Ja | 0,75/0,85 | |
| Vertragsstrafe | Ja | vertragsstrafe | Vortext | Regex + LLM | Ja (Vertragsrahmen) | 0,75/0,85 | |
| Gewährleistung | Ja | gewaerhleistung | Vortext | Regex + LLM | Ja (Vertragsrahmen) | 0,75/0,85 | |
| Wartung/Instandhaltung | Ja | wartung_instandhaltung | Vortext | Regex + LLM | Nein | 0,75/0,85 | Nutzung in Nachtragspotenzial (KEYFACT_PATTERNS). |
| VOB/BGB | Ja | vob_bgb | Alle Segmente / Vortext | Heuristik (Keyword) + LLM | Ja | 0,75/0,85 | |
| Rangfolge | Ja | rangfolge | Vortext | Regex | Nein | 0,75/0,85 | |
| Zahlungsbedingungen | Ja | zahlungsbedingungen | Vortext | Regex + LLM | Nein | 0,75/0,85 | |
| Abschlagszahlung | Ja | abschlagszahlung | Vortext | Regex + LLM | Ja (Vertragsrahmen) | 0,75/0,85 | |
| Schlussrechnung | Ja | schlussrechnung | Vortext | Regex + LLM | Ja (Vertragsrahmen) | 0,75/0,85 | |
| Preisgleitung | Ja | preisgleitung | Vortext | Regex (Keyword-Trigger) + LLM | Nein | 0,75/0,85 | |

**Projektart, Anzahl Einheiten, Energiestandard, LV-Strukturgröße, Vorbemerkungsumfang, Textkomplexität, Datenquelle, Extraktionssicherheit (echte Metrik):** aktuell **nicht** als KeyFact-Felder vorhanden.

---

## 4. Lücken und Bewertung

### 4.1 Ziel-KeyFacts, die komplett fehlen

- Projektart (z. B. Neubau/Sanierung/Umbau) – nur indirekt in bauvorhaben-Text möglich  
- Anzahl Einheiten / Mengengerüst  
- Energiestandard (z. B. KfW, QNG)  
- LV-Strukturgröße (Anzahl Positionen/Gruppen)  
- Vorbemerkungsumfang (Zeichen/Seiten)  
- Textkomplexität (Metrik)  
- Explizites Feld „Datenquelle“ (es gibt keyFactsSourceMode, aber kein KeyFact-Feld)  
- Echte Extraktionssicherheit pro Feld (nur 0,75/0,85 pauschal)

### 4.2 Rudimentär oder unzuverlässig

- **bauvorhaben:** Oft zu lang oder Beschreibung statt Kurzbezeichnung; LLM-Instruktion „KURZ“, trotzdem oft unsauber.  
- **ort:** Fragment „lich“ (von „örtlich“), falsche Zuordnung von Fließtext.  
- **Termine (baubeginn, fertigstellung, bauzeit, submission_einreichung, bindefrist):** Strikte Validierung (FIELD_MATRIX, requiredSignal) filtert viele echte Werte; „vorzulegen“, „zu bestätigen“ etc. werden ausgeschlossen, was sinnvoll ist, aber manche echten Fristen gehen verloren.  
- **planer:** In PROJEKTDATEN_KEYS fehlt planer → wird in der Übersicht nicht angezeigt (nur intern/Rückfragen/Nachtrag nutzbar).

### 4.3 Im UI, begrenzter Analyse-Mehrwert

- **vob_bgb:** Oft nur „VOB“ oder „BGB“ – für Risiko/Nachtrag wenig Differenzierung.  
- **rangfolge:** Wird extrahiert, aber nicht in PROJEKTDATEN_KEYS/VERTRAGSRAHMEN_KEYS → erscheint nicht in der Übersicht.

### 4.4 Intern wichtig, noch nicht extrahiert

- **Projektart** (Neubau/Sanierung/…) – für Nachtrag/Risiko-Kontext.  
- **Energiestandard/QNG** – relevant für Anforderungen und Nachtrag.  
- **Konkrete Fristen als strukturierte Daten** (Datum/Zeitraum) – für Termin-Risiko und Rückfragen.  
- **Mengen-/Einheiten-Hinweise** – für Kalkulationsrisiko.

---

## 5. Kurzbewertung

### Was ist gut?

- Klare Trennung: strukturierte GAEB-Quelle vs. Legacy-Vortext; LLM-Fallback nur für fehlende Felder bei GAEB.  
- Feste Feldliste (KEYSET) und Validierung (FIELD_MATRIX, isGarbageValue, isInvalidOrGenericValue) reduzieren Müll.  
- Label-Extraktion (Bauherr:, Ort:, …) ist nachvollziehbar und liefert oft stabile Werte.  
- Debug-Objekt keyFactsDebug (keyFactsWithSource, keyFactsSourceMode, mergeWinnerPerField, llmFallback) unterstützt Nachvollziehbarkeit.  
- Nutzung in Rückfragen, Annahmen und Nachtragspotenzial (fehlende KeyFacts → Themen) ist sinnvoll angebunden.

### Was ist dünn, hart codiert oder fehleranfällig?

- **Confidence:** Nur zwei Werte (0,75/0,85), keine echte Extraktionssicherheit.  
- **Projektname:** UI erwartet objektbezeichnung/projektbezeichnung; API liefert nur bauvorhaben → konzeptionelle Lücke.  
- **Viele Felder** (planer, bauzeit, fertigstellung, zahlungsbedingungen, preisgleitung, rangfolge, wartung_instandhaltung, ausfuehrungsfrist, ausfuehrungszeit, fristAngebot) **nicht** in PROJEKTDATEN_KEYS/VERTRAGSRAHMEN_KEYS → in der Übersicht unsichtbar, obwohl extrahiert.  
- **Regex und LABEL_PATTERNS** sind stark deutsch und formatabhängig; andere LV-Formulierungen schlagen fehl.  
- **LLM-Schema** (additionalProperties: false) verhindert Erweiterung um neue Felder ohne Code-Änderung.

### Top 5 KeyFacts für Priorisierung (Mehrwert für Risiko, Rückfragen, Nachtrag)

1. **Baubeginn / Fertigstellung / Bauzeit** (strukturiert) – zentral für Termin-Risiko und Nachtrag (KEYFACT_PATTERNS). Bereits extrahiert; Verbesserung: bessere Validierung/Parse und **in UI anzeigen**.  
2. **Projektart** (neu) – Neubau/Sanierung/Umbau für Kontext Risiko/Nachtrag.  
3. **Angebotsfrist / Bindefrist / Submission** – bereits vorhanden; sichtbar machen und für Rückfragen stabil nutzen.  
4. **Gewährleistung / Vertragsstrafe** – bereits in Vertragsrahmen; für Nachtrag/Risiko weiter schärfen (z. B. Fristen extrahieren).  
5. **Energiestandard / QNG** (neu) – zunehmend relevant für Anforderungen und Nachtrag.

---

## 6. Optionale Debug-Ausgabe

Es wurde eine **minimale Server-Log-Ausgabe** ergänzt: Nach erfolgreicher KeyFacts-Extraktion in `app/api/analyze-vortext/route.ts` wird einmal pro Request **nur in `NODE_ENV=development`** ein kompakter Log geschrieben:

- `mode`: keyFactsSourceMode (normalized-structure | legacy-text | mixed | llm-fallback)
- `filled`: Anzahl der KeyFacts mit nicht-leerem Wert
- `keys`: Liste der gefüllten Feldnamen (kommagetrennt)
- `confidence`: pro gefülltem Key der Confidence-Wert (oder null)

Es werden **keine** LV-Inhalte oder personenbezogenen Daten geloggt, nur die Struktur (Feldnamen + Zahlen). So siehst du nach einer Analyse im Server-Log sofort, welche KeyFacts erkannt wurden und mit welcher Confidence.

---

## 7. Referenzen (Dateien)

| Datei | Inhalt |
|-------|--------|
| `app/api/analyze-vortext/route.ts` | KEYSET, STRUCTURED_KEYFACT_FIELDS, LLM_FALLBACK_FIELDS, LABEL_PATTERNS, FIELD_MATRIX, extractKeyFactsRegex, extractKeyFactsFromNormalized, mergeKeyFactsPreferRegex, Confidence 0,75/0,85, keyFactsDebug. |
| `app/admin/score/page.tsx` | KEYFACT_LABELS, PROJEKTDATEN_KEYS, VERTRAGSRAHMEN_KEYS, keyFactsProjektdaten, keyFactsVertragsrahmen, Projektname aus bauvorhaben/objektbezeichnung/projektbezeichnung. |
| `lib/clarificationQuestions.ts` | KEYFACT_LABELS, IMPORTANT_KEYFACTS, MISSING_KEYFACT_GROUPS. |
| `lib/offerAssumptions.ts` | Analog für Annahmen. |
| `lib/changePotentialModel.ts` | KEYFACT_PATTERNS (fehlende KeyFacts → Nachtragstitel). |
| `lib/textsConfig.ts` | internal.keyFactLabels (Teilmenge). |

---

*Ende der IST-Analyse. Keine Änderung an Trigger-, Score- oder Analyse-Kernlogik.*
