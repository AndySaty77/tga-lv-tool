# KeyFacts Kern V1 – 12 Kernfelder

**Version 1** fokussiert die KeyFacts-Logik auf 12 definierte Kernfelder. Nur 9 davon werden im Übersichtstab angezeigt; 3 bleiben intern.

---

## Zuordnung Konzept → Interner Feldname

| # | Konzept (Ziel) | Interner Feldname | Im UI sichtbar? |
|---|----------------|-------------------|------------------|
| 1 | Projektname | `bauvorhaben` | Ja |
| 2 | Ort | `ort` | Ja |
| 3 | Bauherr | `bauherr_ag` | Ja |
| 4 | Gewerk | `gewerk` | Ja |
| 5 | Projektart | `projektart` | Ja |
| 6 | Vertragsgrundlage | `vertragsgrundlagen` | Ja |
| 7 | Zusätzliche Vertragsbedingungen | `zusatzvertragsbedingungen` | Nein (intern) |
| 8 | Angebotsfrist | `fristAngebot` | Ja |
| 9 | Bindefrist | `bindefrist` | Ja |
| 10 | Ausführungszeitraum | `ausfuehrungszeitraum` | Ja |
| 11 | LV-Strukturgröße | `lv_strukturgroesse` | Nein (intern) |
| 12 | Vorbemerkungsumfang | `vorbemerkungsumfang` | Nein (intern) |

Bestehende interne Namen (`bauherr_ag`, `vertragsgrundlagen`, `fristAngebot`) wurden **nicht** umbenannt, um Risiken zu vermeiden. Die Zuordnung erfolgt über Labels und diese Tabelle.

---

## Pro KeyFact: Quelle, Methode, Confidence

| KeyFact (intern) | Quelle | Extraktionsmethode | Confidence |
|------------------|--------|--------------------|------------|
| **bauvorhaben** | GAEB: globalRemarks, topLabelForPreface, groups, groupRemarks. Legacy: Vortext. | Label (Bauvorhaben:, Projekt:, Objekt:) + Regex + LLM | 0,75 (legacy-fallback) / 0,85 (strukturiert/LLM) |
| **ort** | Wie oben | Label (Bauort:, Ort:, Standort:) + Regex + LLM | 0,75 / 0,85 |
| **bauherr_ag** | Wie oben | Label (Bauherr:, Auftraggeber:, AG:) + Regex + LLM | 0,75 / 0,85 |
| **gewerk** | Wie oben | Regex (Gewerk:, Teilgewerk:, GAEB-Code) + LLM | 0,75 / 0,85 |
| **projektart** | Vortext / strukturierte Segmente | Regex (Projektart:, Neubau/Sanierung/Umbau/Erweiterung) + LLM (optional) | 0,75 / 0,85 |
| **vertragsgrundlagen** | Wie oben | Regex (VOB Teile A/B/C, Vertragsgrundlage:, Maßgebende Unterlagen) + LLM | 0,75 / 0,85 |
| **zusatzvertragsbedingungen** | Vortext | Regex (Zusätzliche/Besondere Vertragsbedingungen) oder Übernahme aus Rangfolge; LLM optional | 0,75 / 0,85 |
| **fristAngebot** | Vortext / Segmente | Regex (Angebotsfrist, Abgabefrist) + LLM | 0,75 / 0,85 |
| **bindefrist** | GAEB/Legacy | Label (Bindefrist:) + Regex + LLM | 0,75 / 0,85 |
| **ausfuehrungszeitraum** | Vortext | Regex (Ausführungszeitraum, Bauzeit, Ausführungszeit, Dauer) + LLM | 0,75 / 0,85 |
| **lv_strukturgroesse** | GAEB-Struktur | Parser: Anzahl `normalized.groups` → z. B. "12 Gruppen". Kein Vortext. | 0,85 |
| **vorbemerkungsumfang** | Vortext-Länge | Parser: Zeichenanzahl → "kurz/mittel/lang (N Zeichen)". Kein Regex/LLM. | 0,85 |

- **Quelle:** Woher der Wert stammt (GAEB normalisierte Struktur, Vorbemerkung/Segmente, reine Struktur).
- **Methode:** Label = Wert rechts vom Label; Regex = Heuristik auf Text; LLM = Modell-Ausgabe; Parser = serverseitig aus Struktur/Länge.
- **Confidence:** Einheitlich 0,75 wenn `sourcePath === "legacy-fallback"`, sonst 0,85. Keine feinere Granularität.

---

## UI

- **Übersichtstab:** Es werden nur die **9 sichtbaren** Kern-KeyFacts in der Reihenfolge `CORE_KEYFACTS_VISIBLE_ORDER` angezeigt (Projektinformationen aus dem Leistungsverzeichnis). Der Block „Vertrags- und Abrechnungsrahmen“ ist für Kern V1 leer.
- **Intern:** `zusatzvertragsbedingungen`, `lv_strukturgroesse`, `vorbemerkungsumfang` werden extrahiert und in `keyFacts`/Debug geführt, erscheinen aber nicht im Übersichtstab.

---

## Optionale Felder

Alle weiteren KeyFacts (z. B. planer, baubeginn, bauzeit, fertigstellung, vertragsstrafe, gewaerhleistung, zahlungsbedingungen, …) bleiben im KEYSET und können für Rückfragen, Nachtragspotenzial und andere Module genutzt werden. Sie werden in Version 1 **nicht** im Übersichtstab angezeigt und nicht priorisiert ausgebaut.

---

## Referenzen

- **API:** `app/api/analyze-vortext/route.ts` – `CORE_KEYFACTS_V1`, `KEYSET`, `STRUCTURED_KEYFACT_FIELDS`, Regex für projektart/zusatzvertragsbedingungen/ausfuehrungszeitraum, Handler für lv_strukturgroesse/vorbemerkungsumfang.
- **UI:** `app/admin/score/page.tsx` – `CORE_KEYFACTS_VISIBLE_ORDER`, `PROJEKTDATEN_KEYS`, `VERTRAGSRAHMEN_KEYS_ORDER` (leer), `KEYFACT_LABELS`.
