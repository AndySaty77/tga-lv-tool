# Nachtragspotenzial – Top-Verhandlungspunkte / Cluster

**Stand:** Bündelung verwandter ChangePotentialItems zu übergeordneten, management- und vertriebsrelevanten Verhandlungspunkten. Keine freie Suche – Cluster nur auf Basis der bereits erkannten Items. Hybrid: regelbasierte Vorclusterung, optionale KI für Verdichtung/Benennung/Priorisierung.

---

## 1. Neue Struktur

### An ChangePotentialSummary (additiv)

- **`negotiationClusters?: NegotiationCluster[]`** – optional; maximal 3–5 Top-Verhandlungspunkte.

### Typ NegotiationCluster

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| **id** | string | Eindeutige ID (z. B. nc-schnittstelle-0) |
| **title** | string | Aussagekräftiger Titel des Verhandlungspunkts |
| **shortTitle** | string | Kurztitel (z. B. für Listen) |
| **relatedItemIds** | string[] | IDs der zugehörigen ChangePotentialItems |
| **dominantFieldTypes** | ChangePotentialFieldType[] | Dominante Feldtypen im Cluster |
| **dominantMechanisms** | ChangePotentialMechanism[] | Dominante Mechanismen |
| **affectedTrades** | string[] | Betroffene Gewerke |
| **commercialWeight** | "niedrig" \| "mittel" \| "hoch" \| "sehr_hoch" | Wirtschaftlicher Hebel (aus Items abgeleitet) |
| **enforceabilityAssessment** | "schwach" \| "mittel" \| "gut" \| "sehr_gut" | Durchsetzbarkeit (aus Items abgeleitet) |
| **whyThisMatters** | string | Kurze Begründung, warum der Punkt für die Verhandlung relevant ist |
| **recommendedNegotiationAction** | "rueckfrage" \| "angebotsklarstellung" \| "kalkulatorisch_absichern" \| "claim_feld_beobachten" | Empfohlene Aktion |
| **suggestedQuestion** | string (optional) | Eine konkrete Rückfrage |
| **suggestedClarification** | string (optional) | Eine Klarstellungsformulierung |
| **clusterReasoning** | string (optional) | Begründung der Bündelung (Expertenmodus) |

Definition: **lib/changePotentialModel.ts** (NegotiationCluster, NegotiationClusterAction).

---

## 2. Wie das Clustering zustande kommt

### Hybrid: Regel + optionale KI

1. **Regelbasierte Vorclusterung** (immer, in **lib/changePotentialNegotiationClusters.ts**):
   - Jedes ChangePotentialItem wird anhand seines **fieldType** einem **Thema** zugeordnet (FIELD_TYPE_TO_THEME).
   - Themen sind z. B.: Schnittstelle, Nebenleistung/Abgrenzung, Dokumentation/Inbetriebnahme, Bestand/Erschwernis, Bauablauf/Provisorium, Mengen/Konkretisierung, Normative, Sonstiges.
   - Pro Thema entsteht ein **Bucket** mit: relatedItemIds, dominantFieldTypes, dominantMechanisms, affectedTrades, commercialWeight (max. Impact der Items), enforceabilityAssessment (max. Durchsetzbarkeit).
   - Buckets werden nach commercialWeight und Durchsetzbarkeit sortiert; die **wichtigsten** werden für die Ausgabe verwendet (siehe Abschnitt 3).

2. **KI-Verdichtung** (optional, wenn aktiviert):
   - Ein LLM-Aufruf erhält die regelbasierten Bucket-Zusammenfassungen (Anzahl Items, Hebel, Durchsetzbarkeit, Feldtypen, Beispieltitel).
   - Die KI liefert pro Bucket: **title**, **shortTitle**, **whyThisMatters**, **recommendedNegotiationAction**, optional **suggestedQuestion**, **suggestedClarification**, **clusterReasoning**.
   - Diese Texte werden mit den regelbasierten Daten (relatedItemIds, commercialWeight, …) zu den finalen **NegotiationCluster**-Objekten zusammengeführt.

3. **Ohne KI** (Fallback):
   - Es werden nur die regelbasierten Buckets verwendet, mit **Fallback-Titeln** aus THEME_FALLBACK_TITLES (z. B. „Schnittstellen und bauseitige Leistungen“, „Nebenleistungen und Leistungsabgrenzung“).
   - whyThisMatters = generischer Hinweis; suggestedQuestion/suggestedClarification/clusterReasoning entfallen.
   - Die Grundfunktion (Anzeige der gebündelten Verhandlungspunkte) bleibt nutzbar.

---

## 3. Maximale Anzahl Cluster

- Es werden **maximal 5** Top-Verhandlungspunkte ausgegeben (Konstante **MAX_CLUSTERS** in **lib/changePotentialNegotiationClusters.ts**).
- Aus der regelbasierten Vorclusterung werden bis zu 8 Buckets an die KI übergeben (MAX_BUCKETS_FOR_LLM); für die finale Liste werden nur die **ersten 5** (nach Priorität) übernommen.
- Weniger als 5 Cluster entstehen, wenn es weniger thematische Buckets mit Items gibt.

---

## 4. Zusammenspiel KI und Regelteil

| Schritt | Verantwortung | Bei Ausfall |
|--------|----------------|-------------|
| Vorclusterung | Regel-Engine (fieldType → Thema, Aggregation) | Entfällt nicht; Basis für alles. |
| Priorisierung | Regel-Engine (Sortierung nach Hebel/Durchsetzbarkeit) | Entfällt nicht. |
| Titel, Begründung, Aktion, Rückfrage/Klarstellung | Optional KI | Fallback: thematische Standardtitel, generische whyThisMatters, recommendedNegotiationAction = „rueckfrage“. |
| Anzahl/Struktur der Cluster | Regel-Engine (Buckets, MAX_CLUSTERS) | Unverändert. |

Die Pipeline (**lib/changeOrderAnalysis.ts**) ruft **buildNegotiationClusters(summary)** in einem **try/catch** auf. Bei Fehler (z. B. Timeout, API-Fehler) wird die bestehende Summary ohne negotiationClusters weiterverwendet; die übrige Analyse läuft normal weiter.

---

## 5. Aktivierung

- Die **KI-Verdichtung** (Titel, whyThisMatters, Aktion, Rückfrage/Klarstellung) ist aktiv, wenn
  - **CHANGE_POTENTIAL_NEGOTIATION_CLUSTERS_ENABLED=true** und
  - **OPENAI_API_KEY** gesetzt ist.
- Wenn nur die Umgebungsvariable fehlt oder die KI fehlschlägt, werden weiterhin **regelbasierte Cluster mit Fallback-Titeln** erzeugt, sofern Items vorhanden sind.

---

## 6. UI

- **Komponente:** **components/NachtragspotenzialBlock.tsx**
- Neuer Bereich **„Top-Verhandlungspunkte“** (zwischen Überblick und „Erkannte Nachtragsfelder“):
  - Pro Cluster: **Titel**, **Hebel** (commercialWeight), **Durchsetzbarkeit**, **empfohlene Aktion**, **Begründung** (whyThisMatters), optional **eine Rückfrage** und/oder **eine Klarstellung**.
- **Expertenmodus:** Zusätzlich **relatedItemIds**, **Feldtypen**, **Mechanismen**, **Gewerke**, **clusterReasoning**.

---

## 7. Abhängigkeiten

- **Modell:** changePotentialModel.ts (NegotiationCluster, NegotiationClusterAction; negotiationClusters an ChangePotentialSummary).
- **Logik:** changePotentialNegotiationClusters.ts (ruleBasedPreCluster, enrichBucketsWithLlm, buildNegotiationClusters).
- **Pipeline:** changeOrderAnalysis.ts (Aufruf nach Commercial-Strategy, in try/catch).
- **UI:** NachtragspotenzialBlock.tsx (NegotiationClusterCard, Bereich „Top-Verhandlungspunkte“).

Es werden **keine neuen Nachtragspotenziale** erfunden; alle Cluster basieren ausschließlich auf den von der regelbasierten Engine erkannten ChangePotentialItems.
