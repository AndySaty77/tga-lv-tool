# Kontaktformular – Team / Individuelle Anfrage

Das Kontaktformular unter `/contact` sendet Anfragen per E-Mail über **Resend**.

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|--------|--------------|
| `RESEND_API_KEY` | ja | API-Key von [resend.com](https://resend.com) (z. B. `re_…`) |
| `CONTACT_FORM_TO_EMAIL` | ja | E-Mail-Adresse, an die jede Anfrage gesendet wird |
| `CONTACT_FORM_FROM_EMAIL` | nein | Absender (z. B. `TGA LV Tool <kontakt@ihredomain.de>`). Ohne Angabe: `TGA LV Tool <onboarding@resend.dev>` (Resend-Test-Absender) |

## Geänderte / genutzte Dateien

- **`app/api/contact/route.ts`** – POST-Route: Validierung, E-Mail-Versand mit Resend, JSON-Response (200/400/503/500)
- **`app/contact/ContactForm.tsx`** – unverändert; ruft weiterhin `POST /api/contact` auf, zeigt Loading/Erfolg/Fehler
- **`package.json`** – Abhängigkeit `resend` ergänzt
- **`.env.example`** – Beispiel für Resend- und Kontakt-Env-Variablen

## Ablauf

1. Nutzer füllt das Formular auf `/contact` aus und klickt auf „Anfrage senden“.
2. Frontend sendet `POST /api/contact` mit JSON (name, company, email, message, optional phone, teamSize, interest).
3. API prüft Pflichtfelder und E-Mail-Format; bei Fehlern: `400` mit `{ error: "…" }`.
4. API sendet eine E-Mail per Resend:
   - **An:** `CONTACT_FORM_TO_EMAIL`
   - **Betreff:** `Neue Team-/Individuelle Anfrage – [Unternehmen]`
   - **Body:** strukturierter Text (alle Felder + Zeitstempel)
   - **Reply-To:** Absender-E-Mail aus dem Formular
5. Bei Erfolg: `200` mit `{ ok: true }`, bei Resend-Fehler: `500` mit Fehlermeldung.
6. Das Frontend zeigt die Erfolgs- oder Fehlermeldung ohne Reload.

## Lokal

1. Bei [Resend](https://resend.com) anmelden und API-Key erzeugen.
2. In `.env.local` eintragen:
   ```
   RESEND_API_KEY=re_...
   CONTACT_FORM_TO_EMAIL=ihre-test@email.de
   ```
3. Dev-Server starten (`npm run dev`), Formular unter `/contact` testen.
4. Ohne eigene Domain nutzt Resend den Test-Absender `onboarding@resend.dev`; Empfang nur an die bei Resend verifizierte Adresse (in der Regel Ihre eigene).

## Vercel

1. Im Vercel-Projekt: **Settings → Environment Variables**
2. Eintragen:
   - `RESEND_API_KEY` (z. B. für Production)
   - `CONTACT_FORM_TO_EMAIL` (Zieladresse für Anfragen)
   - optional `CONTACT_FORM_FROM_EMAIL` (eigene Domain, z. B. `Kontakt <kontakt@ihredomain.de>`; Domain bei Resend verifizieren)
3. Nach dem nächsten Deploy antwortet die API mit dem konfigurierten Versand.

## Keine Datenbank

Der Versand erfolgt ausschließlich per E-Mail. Es wird keine Datenbank und keine Admin-Seite verwendet.
