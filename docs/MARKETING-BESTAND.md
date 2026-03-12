# Marketing-Seiten & Komponenten – Bestandsprüfung

Stand: Nach Prüfung (Cursor-Absturz abgefangen). **Keine Änderungen an /analyse, /admin/* oder app/admin/score/page.tsx.**

---

## 1. Öffentliche Marketing-Routen (alle vorhanden)

| Route | Datei | Status |
|-------|--------|--------|
| `/` | `app/page.tsx` | B2B-Landingpage (Hero, Value Props, CTA, Footer) |
| `/features` | `app/features/page.tsx` | Features-Übersicht, MarketingCard-Grid, Praxis-Beispiele |
| `/how-it-works` | `app/how-it-works/page.tsx` | Ablauf in 4 Schritten, Hinweise fachliche Prüfung |
| `/pricing` | `app/pricing/page.tsx` | Preise (Platzhalter: Pilot, Team, Enterprise) |
| `/faq` | `app/faq/page.tsx` | FAQ (QA-Komponente, u. a. /analyse vs /admin/scoring, /admin/score) |
| `/docs` | `app/docs/page.tsx` | Docs (Schnellstart, Feature-Übersicht, Begriffe) |
| `/login` | `app/login/page.tsx` | Login/Registrierung Platzhalter |
| `/app` | `app/app/page.tsx` | Geschützter Bereich Platzhalter |

---

## 2. Komponenten (alle vorhanden)

### components/marketing/

- `MarketingTheme.ts` – Farben/Variablen (bg, surface, brand, brand2, text, muted, faint, border)
- `MarketingNav.tsx` – Sticky-Nav mit Links (Features, Ablauf, Preise, FAQ, Docs), Login + „Zur Analyse“
- `MarketingFooter.tsx` – 3-Spalten (Produkt, Start), Copyright, Hinweis auf Analyse/Admin
- `MarketingSection.tsx` – MarketingSection (eyebrow, title, lead), MarketingCard (title, text, bullets, accent)
- `MarketingPageShell.tsx` – Wrapper: Nav + children + Footer, Hintergrund-Gradient

### components/shared/

- `Container.tsx` – maxWidth-Container mit Padding

---

## 3. Im letzten Schritt geänderte/angelegte Dateien (Rekonstruktion)

- **Geändert:** `app/page.tsx` (von Minimal-Home zu voller Landingpage)
- **Neu (Seiten):**  
  `app/features/page.tsx`, `app/how-it-works/page.tsx`, `app/pricing/page.tsx`, `app/faq/page.tsx`, `app/docs/page.tsx`, `app/login/page.tsx`, `app/app/page.tsx`
- **Neu (Komponenten):**  
  `components/shared/Container.tsx`  
  `components/marketing/MarketingTheme.ts`, `MarketingNav.tsx`, `MarketingFooter.tsx`, `MarketingSection.tsx`, `MarketingPageShell.tsx`

**Unberührt:**  
`app/analyse/page.tsx`, `app/admin/page.tsx`, `app/admin/score/page.tsx`, `app/admin/settings/page.tsx`, `app/admin/scoring/page.tsx`, `app/admin/triggers/page.tsx`, `app/admin/debug/page.tsx`, `app/admin/texts/page.tsx`

---

## 4. Fehlende Dateien

**Keine.** Alle genannten Seiten und Komponenten existieren und sind inhaltlich vollständig. Es wurde nichts überschrieben.
