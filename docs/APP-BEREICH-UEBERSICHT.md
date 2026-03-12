# App-Bereich (/app) – Übersicht

Dark-SaaS-Kundenbereich. Keine Änderungen an `/analyse`, `/admin/*` oder `app/admin/score/page.tsx`.

---

## Neu erstellte Dateien

| Datei | Zweck |
|-------|--------|
| `components/app/appTheme.ts` | Design-System: Dark-Hintergründe, dezent Border, Akzent sparsam, Abstände |
| `components/app/sidebar.tsx` | App-Navigation: Dashboard, Analysen, Settings, Billing + Link „Zur Analyse“ |
| `app/app/layout.tsx` | Layout: Sidebar links, Content rechts, einheitlicher Hintergrund |
| `app/app/page.tsx` | Dashboard: Titel, Beschreibung, Button „Neue Analyse starten“ → /analyse, Tabelle „Letzte Analysen“ (Mock) |
| `app/app/analysen/page.tsx` | Analysen-Liste: Tabelle mit Projektname, Datum, Score, Status, „Ergebnis ansehen“ (Mock) |
| `app/app/analysen/[id]/page.tsx` | Ergebnisansicht: Management-Summary-Card, Score, Platzhalter Risiken/Rückfragen/Nachtragspotenzial |
| `app/app/settings/page.tsx` | Settings: Platzhalter Profil, Sprache, Einstellungen |
| `app/app/billing/page.tsx` | Billing: Planübersicht, Hinweis „Billing wird später integriert“ |

---

## Neu erstellte Komponenten

- **`components/app/appTheme.ts`** – Theme-Objekt (keine React-Komponente): `bg`, `surface`, `card`, `border`, `text`, `muted`, `faint`, `accent`, `accentMuted`, `success`, `warning`, `danger`, `space`, `radius`.
- **`components/app/sidebar.tsx`** – **AppSidebar**: feste Breite 240px, Nav-Links mit `usePathname` für aktiven Zustand, Link „Zur Analyse“ unten.

---

## Wo Mockdaten verwendet werden

| Stelle | Inhalt |
|--------|--------|
| `app/app/page.tsx` | Konstante `MOCK_LAST_ANALYSEN`: 3 Einträge (id, projektname, datum, score, status). Tabelle „Letzte Analysen“. |
| `app/app/analysen/page.tsx` | Konstante `MOCK_ANALYSEN`: 4 Einträge. Tabelle mit gleichen Spalten. |
| `app/app/analysen/[id]/page.tsx` | Keine Mock-Liste; Score und Management Summary als Platzhaltertexte („—“ bzw. „Platzhalter …“). Risiken, Rückfragen, Nachtragspotenzial nur als Platzhalter-Blöcke. |

---

## Wo später echte Analysedaten angebunden werden müssen

1. **Dashboard (`app/app/page.tsx`)**  
   „Letzte Analysen“ aus Backend/DB (z. B. nach User/Org gefiltert), statt `MOCK_LAST_ANALYSEN`.

2. **Analysen-Liste (`app/app/analysen/page.tsx`)**  
   Tabellenquelle aus API/DB (Analysen mit Projektname, Datum, Score, Status), Pagination/Filter optional.

3. **Ergebnisansicht (`app/app/analysen/[id]/page.tsx`)**  
   - Analyse per `id` laden (API oder DB).  
   - **Score:** Gesamt-Score und ggf. Kategorien aus Analyse-Ergebnis.  
   - **Management Summary:** aus Nachtragsanalyse / `offerStrategySummary` (wie in der bestehenden Analyse-UI).  
   - **Risiken:** Findings/Risiko-Kategorien aus Analyse.  
   - **Rückfragen:** gruppierte Rückfragen aus Clarification-Questions.  
   - **Nachtragspotenzial:** Opportunities, Cluster, Claim-Potenzial aus Change-Order-Analyse.  

   Technisch: Entweder gespeicherte Analyse-Ergebnisse (JSON/DB) pro `id` abrufen oder bestehende APIs (`/api/score`, Nachtragsanalyse, Rückfragen, etc.) mit gespeicherten Inputs neu aufrufen – abhängig vom gewählten Persistenzmodell.

4. **Settings / Billing**  
   Keine Analysedaten; Profil aus Auth/User-Service, Billing aus Zahlungsanbieter (z. B. Stripe).

---

## Design (Dark SaaS)

- Hintergrund: `#0c1222` (Haupt), `#111827` (Sidebar), `#151d2e` (Cards).  
- Borders: `rgba(255,255,255,0.08)`.  
- Akzent: `#38bdf8` nur für primäre Aktionen und Links.  
- Keine übertriebenen Verläufe oder Neon; ruhig, professionell, B2B.

---

## Unverändert

- `app/analyse/page.tsx`
- `app/admin/*` (alle Seiten)
- `app/admin/score/page.tsx`
- Keine Analyse-Logik geändert
