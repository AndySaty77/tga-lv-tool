# Routing & SaaS-Produktisierung – Bestand und Empfehlung

Stand: März 2025. Ziel: risikoarme Vorbereitung für SaaS (Marketing, Auth, geschützter Bereich /app), **ohne** produktive Routen zu verändern.

---

## 1. Aktuelle Routing-Bestandsaufnahme

### 1.1 Übersicht

| Route | Datei | Bemerkung |
|-------|--------|-----------|
| `/` | `app/page.tsx` | Minimale Home („Route Test: /admin/triggers“) |
| `/analyse` | `app/analyse/page.tsx` | **Kundenroute** – rendert `<ScorePage customerRoute />` aus `app/admin/score/page.tsx` |
| `/admin` | `app/admin/page.tsx` | Admin-Hub mit Links zu allen Admin-Unterrouten |
| `/admin/settings` | `app/admin/settings/page.tsx` | Analyse- und KI-Einstellungen |
| `/admin/scoring` | `app/admin/scoring/page.tsx` | Schwellenwerte, Ampel, Claim-/Nachtragsschwellen |
| `/admin/triggers` | `app/admin/triggers/page.tsx` | Trigger verwalten, CSV, Tests |
| `/admin/debug` | `app/admin/debug/page.tsx` | Rohdaten, Test- und Diagnoseinfos |
| `/admin/texts` | `app/admin/texts/page.tsx` | UI-Texte, Erklärungstexte, Standardformulierungen |
| `/admin/score` | `app/admin/score/page.tsx` | **Kern-Analyse-UI** (Expertenmodus, Debug). Wird von `/analyse` per Import genutzt. |
| `/test` | `app/test/page.tsx` | Test-Route (nicht produktiv) |

### 1.2 Abhängigkeiten

- **`/analyse`** hängt direkt von **`app/admin/score/page.tsx`** ab:
  - `app/analyse/page.tsx` importiert `ScorePage` aus `../admin/score/page` und rendert `<ScorePage customerRoute />`.
- **Kein** eigenes Layout unter `app/analyse/` oder `app/admin/` – nur **ein** Root-Layout: `app/layout.tsx`.
- **Gemeinsame Komponenten** (von Analyse und Admin genutzt):
  - `app/admin/score/page.tsx` importiert aus `@/components`: Lesansicht, PositionenNodeView, VorbemerkungenDocumentView, NachtragspotenzialBlock, VortextDetailModal, AnalyseCockpitView, SectionCard, StatusBadge.

### 1.3 Layouts

- **Vorhanden:** nur `app/layout.tsx` (Root, `<html><body>{children}</body>`, Metadata „TGA LV Tool“, „MVP“).
- **Nicht vorhanden:** `app/analyse/layout.tsx`, `app/admin/layout.tsx`, Route Groups wie `(marketing)` oder `(app)`.

### 1.4 Auth & Middleware

- **Middleware:** keine `middleware.ts` im Projekt.
- Keine zentrale Absicherung von Routen.

---

## 2. Empfohlene Zielstruktur (minimal, risikoarm)

### 2.1 Prinzip

- **Bestehende produktive Routen unverändert lassen** (keine Verschiebung von Dateien für `/analyse`, `/admin/*`).
- **Nur ergänzen:** Marketing (Home), Auth-Vorbereitung, neuer Bereich `/app` und ggf. neue Layouts in **neuen** Dateien.

### 2.2 Ziel-Routing (nach Ergänzung)

| Route | Quelle | Aktion |
|-------|--------|--------|
| `/` | `app/page.tsx` | **Inhalt anpassen** – minimale Marketing/Landing (Links zu Analyse, App, ggf. Login). |
| `/analyse` | `app/analyse/page.tsx` | **Unverändert** (weiterhin Import von `ScorePage` aus `admin/score`). |
| `/admin` | `app/admin/page.tsx` | **Unverändert** |
| `/admin/settings` | `app/admin/settings/page.tsx` | **Unverändert** |
| `/admin/scoring` | `app/admin/scoring/page.tsx` | **Unverändert** |
| `/admin/triggers` | `app/admin/triggers/page.tsx` | **Unverändert** |
| `/admin/debug` | `app/admin/debug/page.tsx` | **Unverändert** |
| `/admin/texts` | `app/admin/texts/page.tsx` | **Unverändert** |
| `/admin/score` | `app/admin/score/page.tsx` | **Unverändert** (weiter zentraler Ort der Analyse-UI). |
| `/app` | **neu** `app/app/page.tsx` | **Neu** – Einstieg geschützter Bereich (z. B. Redirect zu `/analyse` oder kleines Dashboard). |
| (optional) `/app/dashboard` | **neu** `app/app/dashboard/page.tsx` | Optional später. |

### 2.3 Layout-Empfehlung

- **Root:** `app/layout.tsx` beibehalten (ggf. nur um globale Provider oder Fonts ergänzen).
- **Neue Layouts nur als Ergänzung:**
  - **Optional:** `app/app/layout.tsx` – Layout nur für `/app` und ggf. `/app/*`; später Platz für Auth-Provider oder „nur eingeloggt“-Wrapper. Keine Änderung an bestehenden Seiten.
  - **Optional:** Route Group `(marketing)` nur dann, wenn du die Home bewusst in eine Gruppe verschieben willst (z. B. `app/(marketing)/page.tsx`). **Risiko:** URL bleibt `/`, aber Pfad der Datei ändert sich; alle Links zu `/` bleiben gültig. Erst wenn du wirklich eine getrennte „Marketing“-Sektion willst.

Empfehlung: **zunächst keine Route Groups**; nur neue Dateien unter `app/app/` und angepasste `app/page.tsx`.

### 2.4 Auth-Vorbereitung

- **Neu:** `middleware.ts` im **Projektroot** (neben `app/`).
  - Matcher z. B. auf `/app` und `/app/:path*`.
  - In der ersten Phase nur `next()` (kein Redirect, keine echte Prüfung), damit später Auth-Checks ergänzt werden können, ohne die bestehenden Routen zu berühren.

---

## 3. Dateien, die unberührt bleiben sollten

Diese Dateien **nicht** verschieben und **nicht** umbenennen; keine Änderung der Exporte oder der Routen-Pfade:

- `app/analyse/page.tsx` – Kundenroute Analyse.
- `app/admin/page.tsx` – Admin-Hub.
- `app/admin/settings/page.tsx`
- `app/admin/scoring/page.tsx`
- `app/admin/triggers/page.tsx`
- `app/admin/debug/page.tsx`
- `app/admin/texts/page.tsx`
- `app/admin/score/page.tsx` – Kern der Analyse-UI; wird von `/analyse` importiert.

Falls du später ein **eigenes** Layout nur für Admin willst: **neue** Datei `app/admin/layout.tsx` anlegen und darin nur `children` rendern (oder Navigation). Keine bestehenden Page-Dateien verschieben.

---

## 4. Dateien, die risikoarm angepasst werden können

### 4.1 Geringes Risiko (nur Inhalt/Erweiterung)

| Datei | Aktion |
|-------|--------|
| `app/page.tsx` | Inhalt ersetzen: kleine Landing/Marketing (Titel, Kurzbeschreibung, Links zu „Zur Analyse“ → `/analyse`, „Zum geschützten Bereich“ → `/app`, ggf. „Login“). Keine Route ändern. |
| `app/layout.tsx` | Optional: nur Metadata, Fonts oder einen globalen Provider ergänzen. Keine strukturelle Änderung. |

### 4.2 Nur neue Dateien (kein bestehender Code geändert)

| Neue Datei | Zweck |
|------------|--------|
| `middleware.ts` (Projektroot) | Matcher für `/app` und `/app/*`; vorerst nur `next()`. Später: Redirect auf Login wenn nicht authentifiziert. |
| `app/app/page.tsx` | Einstiegsseite für `/app` (z. B. Redirect nach `/analyse` oder minimales „Willkommen im geschützten Bereich“ mit Link zu `/analyse`). |
| `app/app/layout.tsx` | Optional: Layout nur für `/app` (z. B. gemeinsamer Header/Footer für alle zukünftigen `/app/*`-Seiten). |

### 4.3 Optional später (nicht zwingend für „minimal“)

- `app/(marketing)/layout.tsx` + Verschiebung von `app/page.tsx` → `app/(marketing)/page.tsx` (URL bleibt `/`; nur wenn du Route Groups nutzen willst).
- Eigene Auth-Provider-Komponente und Einbindung in `app/app/layout.tsx` oder Root-Layout.

---

## 5. Kurz-Checkliste für die Umsetzung

1. **Bestand prüfen** – erledigt (siehe Abschnitt 1).
2. **Marketing:** `app/page.tsx` auf minimale Landing umstellen (Links zu `/analyse`, `/app`).
3. **Auth:** `middleware.ts` anlegen, Matcher `['/app', '/app/:path*']`, Body vorerst nur `return next();`.
4. **Geschützter Bereich:** `app/app/page.tsx` (und optional `app/app/layout.tsx`) anlegen; Inhalt z. B. Redirect zu `/analyse` oder kurzer Willkommenstext.
5. **Bestehende Routen** `/analyse`, `/admin`, `/admin/*` und `app/admin/score/page.tsx` **nicht** anfassen.

Damit bleibt die bestehende Analyse- und Admin-Logik vollständig erhalten, und du hast eine klare, erweiterbare Basis für Marketing, Auth und den Bereich `/app`.
