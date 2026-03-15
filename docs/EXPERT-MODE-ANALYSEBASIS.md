# Expert-Modus: Analysebasis und Tabs (Stand nach Entschlackung)

**Stand:** Nach Reduktion der Expert-Ansichten auf die technisch relevanten Sichten.  
**Keine Änderung** an Parsing-, Trigger-, Score- oder Analyse-Logik; nur UI-/Bezeichnungs- und Sichtlogik.

---

## 1. Aktuelle Tab-Struktur im Expert-Bereich

Im Expertenmodus werden nur noch folgende Ansichten angeboten:

| Tab | Bedeutung |
|-----|-----------|
| **Struktur** | Erkannte GAEB-/LV-Hierarchie (Gruppen, Hinweise, Positionen). Nur sichtbar, wenn `gaebPreview.normalized` vorhanden. |
| **Analysebasis Vorbemerkungen** | Der bereinigte Text, auf dem die Analyse für Vorbemerkungen/Einleitung tatsächlich basiert. |
| **Analysebasis Positionen** | Der bereinigte Text, auf dem die Analyse für Positionen tatsächlich basiert. |
| **Diagnose / Rohdaten** | Technische Rohdaten (z. B. Roh-XML/Roh-Text). Optisch als „nur für technische Prüfung“ nachrangig dargestellt. |
| **In Textfeld übernehmen** | Button (kein Tab): schreibt den Inhalt des aktuell gewählten Tabs in die LV-Textarea. |

---

## 2. Verwendete Datenquellen

### Analysebasis Vorbemerkungen

- **Verwendete Datenquelle:** `vortextForDocumentViewDisplay`
- **Herkunft:** `vortextForDocumentViewDisplay` = `stripTechnicalNoiseForDisplay(sanitizeForDisplay(vortextForDocumentView))`
- **`vortextForDocumentView`** ist dieselbe Quelle wie für den **produktiven Tab „Vorbemerkungen“** (Dokumentleseansicht):
  - Bevorzugt: `structuredVortextForView` (bei GAEB-XML: globale Remarks, Top-Label-Fallback, structure.vorbemerkungen/vortext, vortextFullClean)
  - Fallback: `normalizeViewerVorbemerkungenText(split?.vortext ?? gaebPreview?.vortextGuessClean ?? structureVortext ?? "")`
- Damit zeigt „Analysebasis Vorbemerkungen“ exakt den Text, der auch in der normalen Vorbemerkungen-Ansicht und für die Risikoanalyse Einleitung genutzt wird.

### Analysebasis Positionen

- **Verwendete Datenquelle:** `positionsForDocumentViewDisplay`
- **Herkunft:** `positionsForDocumentViewDisplay` = `stripTechnicalNoiseForDisplay(sanitizeForDisplay(positionsForDocumentView))`
- **`positionsForDocumentView`** ist dieselbe Quelle wie für den **produktiven Tab „Positionen“** (Dokumentleseansicht):
  - Bei GAEB-XML: `positionsFromDisplayNodes` oder `positionsFromNormalizedItems`
  - Sonst: `positionsFromDisplayNodes` / `positionsFromNormalizedItems` / `positionsFromStructuredItems` oder `normalizeViewerPositionenText(split?.positions ?? gaebPreview?.positionsGuessClean ?? structurePositions ?? "")`
- Damit zeigt „Analysebasis Positionen“ exakt den Text, der auch in der normalen Positionen-Ansicht und für die Positionsanalyse genutzt wird.

---

## 3. Entfernte bzw. zusammengeführte Tabs

Die folgenden **alten** Expert-Tabs erscheinen **nicht mehr** als eigene sichtbare Hauptansichten:

| Alter Tab | Ehemalige Datenquelle | Verbleib / Zuordnung |
|-----------|------------------------|----------------------|
| **Einleitung (KI)** | `split?.vortext` | In die **Analysebasis Vorbemerkungen** eingeflossen, sofern diese Quelle in der Fallback-Kette von `vortextForDocumentView` genutzt wird (wenn keine strukturierte GAEB-Quelle vorhanden ist). Kein eigener Tab mehr. |
| **Positionen (KI)** | `split?.positions` | In die **Analysebasis Positionen** eingeflossen, sofern in der Fallback-Kette von `positionsForDocumentView` genutzt. Kein eigener Tab mehr. |
| **Einleitung** | `gaebPreview.vortextGuessClean` | Ebenfalls Teil der Fallback-Kette von `vortextForDocumentView`; angezeigt als **Analysebasis Vorbemerkungen**, wenn diese Quelle gewählt wird. Kein eigener Tab mehr. |
| **Positionen** | `gaebPreview.positionsGuessClean` | Ebenfalls Teil der Fallback-Kette von `positionsForDocumentView`; angezeigt als **Analysebasis Positionen**, wenn diese Quelle gewählt wird. Kein eigener Tab mehr. |
| **Bereinigt** | `gaebPreview.cleanPreview` | Entfernt. War ein einziger Fließtextblock (stripHtml ohne Gliederung); für die klare Analysebasis-Vermittlung nicht mehr als eigener Tab angeboten. |

**Struktur** und **Rohdaten** blieben erhalten; Rohdaten unter dem Namen **Diagnose / Rohdaten** und optisch nachrangig.

---

## 4. Hilfetext im Expert-Bereich

Oberhalb der Tab-Leiste wird folgender Hinweis angezeigt:

- **Struktur** zeigt die erkannte GAEB-/LV-Gliederung.
- **Analysebasis Vorbemerkungen** und **Analysebasis Positionen** zeigen den bereinigten Text, auf dem die Analyse tatsächlich basiert.
- **Diagnose / Rohdaten** ist nur für technische Prüfung gedacht.

---

## 5. Betroffene Datei

- **`app/admin/score/page.tsx`**: Zustand `gaebTab` (Typ und Default), `gaebTextForTab` (Berechnung nach `vortextForDocumentViewDisplay` / `positionsForDocumentViewDisplay`), Tab-Buttons, Tab-Inhalte, Hilfetext, Darstellung „Diagnose / Rohdaten“.

Die unteren Produkttabs (**Vorbemerkungen**, **Positionen** usw.) sind unverändert; sie bleiben die lesbare Nutzeransicht. Die neuen Expert-Ansichten zeigen die technische Analysebasis, ohne die gleiche Sicht doppelt anzubieten.
