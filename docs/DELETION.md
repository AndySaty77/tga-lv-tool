# Löschlogik für Analysen (Uploads)

## Kontext

- **Kein separater File-Storage:** Hochgeladene LV-/GAEB-Dateien werden nicht in Supabase Storage oder auf dem Dateisystem persistiert. Sie werden nur zur Analyse verarbeitet; gespeichert wird ausschließlich der Datensatz in der Tabelle `analyse_runs` (Metadaten + `result_json`).
- **Eine „Analyse“ = eine Zeile in `analyse_runs`.** Das Löschen einer Analyse ist daher die Löschung genau dieser Zeile.

## Löschablauf (aktuell)

1. **Auslösung**
   - **Detailseite:** Button „Analyse löschen“ (mit Bestätigungsdialog).
   - **Liste:** Button „Löschen“ pro Zeile (mit Bestätigungsdialog).

2. **API**
   - `DELETE /api/analyse/[id]`
   - Voraussetzung: Nutzer eingeloggt (Session).
   - Prüfung: Zeile wird nur gelöscht, wenn `id` und `user_id` (aktuelle User-ID) übereinstimmen.

3. **Datenbank**
   - `DELETE FROM analyse_runs WHERE id = ? AND user_id = ?`
   - Es wird genau eine Zeile gelöscht (echte Zeilenlöschung, **Hard Delete**). Es gibt **kein** Soft Delete (kein `deleted_at`).

4. **Nach dem Löschen**
   - Detailseite: Redirect zu `/app/analysen`.
   - Liste: Entfernung der Zeile aus der Anzeige (State-Update ohne kompletten Reload).

## Was wird gelöscht (echte Löschung)

- Die komplette Zeile in `analyse_runs`, inklusive:
  - `project_name`, `file_name`, `score`, `status`, `management_summary`
  - `result_json` (gesamtes Analyseergebnis, Rückfragen, Klarstellungen, Nachtragspotenzial etc.)
  - `user_id`, `created_at`
- Es bleiben **keine** Kopien dieser Analyse in der Anwendung zurück (keine weiteren Tabellen mit Foreign Key auf `analyse_runs.id`).

## Was aktuell nicht existiert

- **Kein File-Storage:** Es gibt keine gespeicherten Upload-Dateien, die zusätzlich bereinigt werden müssten.
- **Kein Soft Delete:** Kein `deleted_at` und kein Ausblenden „gelöschter“ Datensätze; die Zeile wird physisch entfernt.
- **Keine automatische Retention:** Keine zeitgesteuerte Löschung alter Analysen; Löschung nur manuell über die UI/API.

## Restrisiken / Offenes

- **RLS:** Wenn Row Level Security für `analyse_runs` aktiv ist, muss die DELETE-Policy das Löschen eigener Zeilen erlauben (oder die API nutzt Service-Role mit gleicher `user_id`-Prüfung).
- **Backups:** Gelöschte Zeilen können in Backups/Snapshots der Datenbank noch vorhanden sein; das ist betrieblich zu berücksichtigen.
- **Kontolöschung:** Das Löschen eines **Nutzerkontos** inklusive aller seiner Analysen ist mit dieser API nicht abgedeckt. Detaillierte Analyse, betroffene Tabellen, Löschreihenfolge und Handlungsempfehlung: siehe **[docs/ACCOUNT-DELETION-ANALYSIS.md](ACCOUNT-DELETION-ANALYSIS.md)**.

## Betroffene Dateien (Implementierung)

| Datei | Änderung |
|-------|----------|
| `app/api/analyse/[id]/route.ts` | `DELETE`-Handler: Auth, dann `delete().eq("id", id).eq("user_id", user.id).select("id")`; bei 0 Zeilen 404, sonst 200 `{ ok: true }`. |
| `app/app/analysen/[id]/DetailContent.tsx` | Button „Analyse löschen“, Bestätigung, `fetch DELETE`, bei Erfolg `router.push("/app/analysen")`. |
| `app/app/analysen/page.tsx` | Komponente `DeleteButton` pro Zeile; nach erfolgreichem DELETE Zeile aus State entfernen. |
