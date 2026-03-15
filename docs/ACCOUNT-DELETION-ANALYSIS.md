# Kontolöschung und Account-Datenfluss – Analyse (Ist-Zustand)

**Stand:** Nur Prüfung und Dokumentation, keine Code- oder DB-Änderungen.

---

## 1. Wo Nutzerkonten technisch liegen

| Ort | Beschreibung |
|-----|--------------|
| **Supabase Auth (`auth.users`)** | Primäre Identität: E-Mail, Passwort-Hash, `user_metadata` (first_name, last_name, company aus Registrierung). Wird über `supabase.auth.signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `updateUser` genutzt. Zugriff serverseitig über `getUser()` (Cookie-Session). |
| **Tabelle `profiles` (public)** | Eine Zeile pro Nutzer; `id` = `auth.users.id` (UUID). Felder: `id`, `email`, `plan` (free/pro), optional `first_name`, `last_name`, `company`. Wird bei erstem Aufruf von `/app/*` durch `ensureUserProfile()` angelegt (siehe `app/app/layout.tsx`). |
| **Keine weiteren nutzergebundenen Tabellen** | `contact_requests` enthält keine `user_id` und wird von der App nicht beschrieben (Kontakt nur per Resend-E-Mail). |

---

## 2. Tabellen direkt oder indirekt an User gebunden

| Tabelle | Bindung | Verwendung im Code |
|---------|---------|--------------------|
| **auth.users** | Supabase Auth (extern verwaltet) | Identität, Login, Registrierung, Passwort-Reset. |
| **profiles** | `id` = `auth.users.id` | Plan (free/pro), optional Name/Firma; gelesen in `getUserPlan()`, geschrieben/aktualisiert in `ensureUserProfile()`. |
| **analyse_runs** | `user_id` = `auth.users.id` | Pro Nutzer: gespeicherte Analysen (Metadaten + `result_json`). Gelesen in List, Detail, Export-PDF, Dashboard, Usage; geschrieben in Save; gelöscht einzeln per DELETE `/api/analyse/[id]`. |

**Nicht nutzergebunden:** `scoring_config`, `texts_config`, `triggers` (globale Konfiguration), `contact_requests` (ohne User-Referenz im aktuellen Einsatz).

---

## 3. Daten, die bei Kontolöschung mit gelöscht werden müssten

- **analyse_runs:** Alle Zeilen mit `user_id = <Nutzer-UUID>` (echte Löschung, bereits pro Einzelanalyse möglich).
- **profiles:** Die Zeile mit `id = <Nutzer-UUID>`.
- **auth.users:** Der Eintrag in Supabase Auth (nur über Admin-API mit Service-Role: `auth.admin.deleteUser(uid)`).

Ohne Löschung in dieser Reihenfolge bleiben entweder verwaiste Zeilen (wenn zuerst Auth gelöscht wird) oder ein Auth-User ohne App-Daten (wenn nur App-Daten gelöscht werden).

---

## 4. Vorhandene Funktionen (Ist-Zustand)

| Funktion | Existiert | Ort / Anmerkung |
|----------|-----------|------------------|
| **Logout** | Ja | `app/app/logout/page.tsx`: `supabase.auth.signOut()`, dann Redirect auf `/`. |
| **Profil-Laden** | Indirekt | Plan über `getUserPlan()` (liest `profiles`). Nutzerdaten für Anzeige aus `getUser()` + `user_metadata` (z. B. Settings-Seite). |
| **Profil-Anlage** | Ja | `ensureUserProfile()` in `lib/billing/bootstrapProfile.ts`: bei erstem Besuch von `/app` wird eine Zeile in `profiles` angelegt (id, email, plan, optional first_name, last_name, company aus user_metadata). |
| **User-Delete (Auth)** | Nein | Weder in der App noch in einer API-Route. Löschung aus `auth.users` wäre nur per Supabase Admin API (Service-Role) möglich: `createClient(url, serviceRoleKey).auth.admin.deleteUser(userId)`. |
| **Löschung aller Analysen eines Nutzers** | Nein | Einzelne Analyse löschen: ja (DELETE `/api/analyse/[id]`). Keine Route „lösche alle Analysen für user_id X“. |

---

## 5. Verknüpfung Analysen ↔ user_id

- **analyse_runs.user_id:** Wird beim Speichern gesetzt (`user_id: user?.id ?? null` in `app/api/analyse/save/route.ts`). Alle Lese-/Löschzugriffe filtern nach `user_id` (List, Detail, Export, DELETE).
- **Kein Foreign Key in der App-Definition:** Im Repo gibt es keine Migrations mit FK von `analyse_runs.user_id` oder `profiles.id` auf `auth.users.id`. Supabase kann standardmäßig keine FK von `public` auf `auth.users` haben; die Bindung ist fachlich (gleiche UUID).

---

## 6. Referenzielle Risiken bei User-Löschung

- **Wenn zuerst `auth.users` gelöscht wird:** In `profiles` und `analyse_runs` bleiben Zeilen mit der gleichen UUID. Es entstehen verwaiste Datensätze; keine technische FK-Verletzung, aber inkonsistenter Zustand und Restdaten.
- **Wenn nur App-Daten, nicht Auth gelöscht werden:** Nutzer kann sich weiter einloggen; `profiles` fehlt oder ist gelöscht → `getUserPlan()` fällt auf Default (free), `ensureUserProfile()` legt ggf. Profil wieder an. Keine echte Kontolöschung.
- **Empfohlene Reihenfolge:** (1) Alle `analyse_runs` mit `user_id = X` löschen, (2) Zeile in `profiles` mit `id = X` löschen, (3) Nutzer in Auth mit Admin-API löschen. So gibt es keine Verweise mehr von der App auf den User und der User existiert nicht mehr in Auth.

---

## 7. Reihenfolge: zuerst App-Daten, dann Auth-User

Ja. Zuerst alle nutzergebundenen App-Daten löschen (analyse_runs, profiles), danach den Eintrag in `auth.users` per Admin-API entfernen. So bleiben keine verwaisten Zeilen und der Account ist vollständig entfernt.

---

## 8. Minimal-Lösung mit geringem Breaking-Risiko

- **Eine geschützte API-Route** (z. B. `POST /api/account/delete` oder `DELETE /api/account`): Nur für den aktuell eingeloggten Nutzer (getUser(), dann dessen `user.id` verwenden).
- **Ablauf serverseitig:**
  1. `getUser()`; wenn nicht eingeloggt → 401.
  2. Supabase Client mit **Service-Role** (für DELETE in public und für `auth.admin.deleteUser`).
  3. `DELETE FROM analyse_runs WHERE user_id = user.id`.
  4. `DELETE FROM profiles WHERE id = user.id`.
  5. `supabase.auth.admin.deleteUser(user.id)`.
  6. Response 200 mit Hinweis, dass der Nutzer sich abmelden bzw. die Session endet (Client-seitig nach Erfolg `signOut()` + Redirect).
- **Kein Soft Delete nötig:** Echte Löschung ist gewollt; keine zusätzliche Spalte oder „deaktiviert“-Flag.
- **Breaking-Risiko:** Gering, wenn die Route nur von einer klar erkennbaren „Konto löschen“-Aktion aufgerufen wird und Bestätigung (z. B. Passwort oder Checkbox) verlangt wird.

---

## Empfohlene Löschreihenfolge (technisch)

1. **analyse_runs:** `DELETE FROM analyse_runs WHERE user_id = :userId`
2. **profiles:** `DELETE FROM profiles WHERE id = :userId`
3. **auth.users:** `auth.admin.deleteUser(userId)` (Supabase Admin API mit Service-Role-Key)

---

## Betroffene Tabellen / Dateien (Überblick)

| Tabellen | Aktion bei Kontolöschung |
|----------|---------------------------|
| analyse_runs | Alle Zeilen mit `user_id = userId` löschen |
| profiles | Zeile mit `id = userId` löschen |
| auth.users | Nutzer per Admin-API löschen |

| Relevante Dateien (nur Lesen/Referenz) | Rolle |
|----------------------------------------|--------|
| lib/auth/get-user.ts | Liefert aktuellen User (auth) |
| lib/billing/bootstrapProfile.ts | Legt/aktualisiert profiles an |
| lib/billing/userPlan.ts | Liest Plan aus profiles |
| lib/billing/usage.ts | Zählt analyse_runs pro user_id |
| app/app/logout/page.tsx | signOut, kein Delete |
| app/app/settings/page.tsx | Zeigt Nutzerdaten, kein Delete |
| app/app/layout.tsx | Ruft ensureUserProfile auf |
| app/api/analyse/* | Nutzen user_id für Filterung; DELETE nur einzeln |

---

## Kritikalität / Breaking-Risiko

| Aspekt | Bewertung |
|--------|-----------|
| **Vergessen von analyse_runs** | Hoch: Ohne Löschung bleiben personenbezogene Analyseergebnisse erhalten. |
| **Vergessen von profiles** | Mittel: Bei erneutem Login könnte ensureUserProfile ein neues Profil anlegen; alte Zeile wäre verwaist. |
| **Auth zuerst löschen** | Mittel: Kein FK-Crash, aber verwaiste Einträge in profiles und analyse_runs. |
| **Keine Bestätigung vor Löschung** | Hoch: Ein Klick könnte Konto unwiderruflich löschen. |
| **Service-Role in neuer Route** | Gering: Nur für diese Route, nur mit userId aus Session; kein zusätzliches Expose. |

---

## Handlungsempfehlung in 3 Teilen

### 1. Was sofort sicher umsetzbar ist

- **Eine API-Route für Kontolöschung** (z. B. `POST /api/account/delete`):
  - Nur für eingeloggten Nutzer (getUser), userId aus Session.
  - Mit Service-Role-Client: nacheinander alle `analyse_runs` mit dieser `user_id` löschen, dann die Zeile in `profiles` mit diesem `id` löschen, dann `auth.admin.deleteUser(userId)`.
  - Keine UI-Änderung nötig für die reine Funktionalität (Route kann z. B. per curl/Postman getestet werden); für Nutzer später ein „Konto löschen“-Button mit Bestätigung (z. B. auf der Einstellungsseite) anbieten.
- **Dokumentation:** Ablauf und Reihenfolge (wie oben) im Projekt dokumentieren (z. B. in dieser Datei oder in docs/DELETION.md ergänzen).

### 2. Was technisch heikel ist

- **Auth-Admin-API:** Erfordert Service-Role-Key; muss strikt serverseitig und nur in der Lösch-Route verwendet werden. Kein Key-Leak ins Frontend.
- **Endgültigkeit:** Nach `auth.admin.deleteUser` ist der Login sofort ungültig; Session sollte danach clientseitig mit `signOut()` beendet und Redirect durchgeführt werden.
- **Fehler in der Mitte:** Wenn z. B. profiles gelöscht ist, aber auth.admin.deleteUser fehlschlägt, ist der Nutzer in Auth noch vorhanden, hat aber kein Profil mehr. Beim nächsten Login legt ensureUserProfile wieder ein Profil an. Optional: Transaktion ist bei Supabase über mehrere Tabellen + Auth hinweg nicht trivial; pragmatisch: Reihenfolge einhalten und bei Fehler nach Schritt 1/2 loggen und ggf. manuell nacharbeiten.

### 3. Welche konkrete Minimalversion jetzt gebaut werden sollte

- **Minimalversion „Echte Kontolöschung“:**
  - **Backend:** Eine Route (z. B. `POST /api/account/delete`) mit obiger Reihenfolge: analyse_runs löschen → profiles löschen → auth.admin.deleteUser. Nur aufrufbar mit gültiger Session; userId ausschließlich aus getUser().
  - **Optional, aber empfohlen:** Body-Parameter oder Query zur Bestätigung (z. B. `{ "confirm": "Konto löschen" }` oder Passwort-Check), um versehentliche Aufrufe zu erschweren.
  - **Frontend (minimal):** Ein Button „Konto löschen“ auf der Einstellungsseite mit Bestätigungsdialog (und ggf. Eingabe „Konto löschen“ oder Passwort). Nach Erfolg: signOut(), Redirect zu Startseite.
- **Keine Deaktivierung:** Es geht um echte Löschung (Hard Delete in DB + Auth). Ein „Account deaktivieren“ (Soft Delete / Flag) wäre ein anderes Feature und würde die Daten weiter vorhalten.

---

## Kurz: Echte Kontolöschung vs. Deaktivierung

- **Echte Kontolöschung (empfohlene Minimalversion):** Alle analyse_runs des Nutzers löschen, Zeile in profiles löschen, Nutzer in auth.users per Admin-API löschen. Danach existiert das Konto nicht mehr; Login ist nicht mehr möglich.
- **Deaktivierung (nicht umgesetzt):** z. B. Flag „deaktiviert“ in profiles oder auth.user_metadata; Nutzer kann sich nicht mehr einloggen, Daten bleiben erhalten. Entspricht nicht der hier beschriebenen Minimal-Lösung und erfordert zusätzliche Logik (Anzeige, Reaktivierung, Retention).

---

---

## Implementierungsstand (Kontolöschung)

- **API:** `POST /api/account/delete` – nur für eingeloggte Nutzer, Bestätigungswort `LÖSCHEN` im Body erforderlich. Reihenfolge: analyse_runs → profiles → auth.admin.deleteUser. Bei Fehler wird keine Teillöschung als Erfolg zurückgegeben.
- **UI:** Settings-Seite – Karte „Konto löschen“ mit Button, Bestätigungsdialog und Eingabe von „LÖSCHEN“. Nach Erfolg Redirect zu `/app/logout`.
- **Auth-Löschung:** Vollständig umgesetzt über Supabase Admin API (Service-Role), sofern `SUPABASE_SERVICE_ROLE_KEY` gesetzt ist.

*Ende der Analyse. Keine weiteren DB- oder RLS-Änderungen.*
