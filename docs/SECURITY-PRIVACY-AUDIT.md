# LV Scope – Datenschutz- und Security-Audit (Ist-Zustand)

**Stand:** Analyse des Codebestands, keine Code-Änderungen vorgenommen.  
**Fokus:** Reale Risiken, Bestandsschonung, priorisierte Empfehlungen.

---

## 1. Rollen- und Rechte-Logik

| Aspekt | Ist-Zustand | Risiko | Kritikalität | Empfohlene minimale Änderung | Betroffene Dateien |
|--------|-------------|--------|--------------|------------------------------|--------------------|
| Rollenmodell | Es gibt nur „eingeloggt“ vs. „nicht eingeloggt“. Keine Admin-Rolle, kein RBAC. | Jeder eingeloggte Nutzer kann alle App-Funktionen nutzen; Admin-Funktionen sind nicht als „nur Admin“ geschützt. | **mittel** | Admin-Zugriff nur für bestimmte User-IDs oder E-Mail-Allowlist prüfen (z. B. in Middleware oder API). | `middleware.ts`, ggf. `lib/auth/` erweitern |
| Geschützte Pfade | Middleware schützt nur `/app/*` und `/analyse` (Redirect zu Login bei fehlendem User). | `/admin/*` und alle `/api/admin/*` sind **nicht** geschützt. | **hoch** | Admin-Routen in Middleware aufnehmen und mit Rollen-/Allowlist-Check versehen. | `middleware.ts` |

---

## 2. Supabase RLS und Policies

| Aspekt | Ist-Zustand | Risiko | Kritikalität | Empfohlene minimale Änderung | Betroffene Dateien / Tabellen |
|--------|-------------|--------|--------------|------------------------------|-------------------------------|
| RLS aktiv | Im Repo nur ein SQL-File (`contact_requests.sql`); RLS dort als „optional“ kommentiert. Keine Migrations mit RLS für andere Tabellen. | Ohne RLS hängt Isolation vom API-Code ab (user_id-Filter). Service-Role umgeht RLS; ein Fehler in einer Route könnte Daten anderer Nutzer zugänglich machen. | **hoch** | RLS für `analyse_runs`, `profiles`, `scoring_config`, `texts_config`, `triggers` in Supabase aktivieren und Policies (SELECT/INSERT/UPDATE) nach user_id bzw. Rolle definieren. | Supabase Dashboard / neue Migration; Tabellen: `analyse_runs`, `profiles`, `scoring_config`, `texts_config`, `triggers` |
| contact_requests | Tabelle per SQL angelegt, im App-Code **nicht** verwendet (Kontakt nur per Resend-E-Mail). | Wenn die Tabelle später genutzt wird ohne RLS: Lese-/Schreibzugriff von Anon möglich (je nach Policy). | **niedrig** | Falls Kontaktanfragen in DB gespeichert werden sollen: RLS aktivieren, nur Service-Role oder definierte Rolle schreiben lassen. | `supabase/contact_requests.sql` |

---

## 3. Mandantentrennung / tenant_id

| Aspekt | Ist-Zustand | Risiko | Kritikalität | Empfohlene minimale Änderung | Betroffene Dateien |
|--------|-------------|--------|--------------|------------------------------|--------------------|
| Mandantentrennung | Kein `tenant_id` oder vergleichbares Konzept. Nutzerisolation nur über `user_id` (auth.users.id) in `analyse_runs` und `profiles`. | Für ein Single-Tenant-/Pro-Nutzer-Modell ausreichend. Bei späterer Einführung von Organisationen/Mandanten fehlt eine klare Trennung. | **niedrig** | Keine Änderung zwingend. Bei Einführung von Teams/Orgas: tenant_id einführen und in allen Abfragen mitschneiden; RLS daran anpassen. | — |

---

## 4. Storage- und Upload-Sicherheit

| Aspekt | Ist-Zustand | Risiko | Kritikalität | Empfohlene minimale Änderung | Betroffene Dateien |
|--------|-------------|--------|--------------|------------------------------|--------------------|
| Datei-Uploads | Kein Supabase Storage. Uploads per FormData an `/api/gaeb-preview`, `/api/gaeb-split-llm`. Dateien im Speicher verarbeitet, nicht dauerhaft gespeichert. | Kein persistenter Zugriff auf hochgeladene Dateien; Risiko vor allem Größe und Inhalte (z. B. an LLM senden). | **mittel** | In `gaeb-split-llm` ist `HARD_MAX_CHARS = 200_000` vorhanden; gleiches Limit oder Request-Body-Limit für `/api/score` (lvText) und `/api/analyze-vortext` einführen. | `app/api/gaeb-split-llm/route.ts`, `app/api/score/route.ts`, `app/api/analyze-vortext/route.ts` |
| Authentifizierung Upload | `/api/gaeb-preview` und `/api/gaeb-split-llm` verlangen **keine** Anmeldung. | Beliebige Nutzer können große Dateien/Text senden → Kosten (LLM) und potenzielle DoS-/Abuse-Szenarien. | **mittel** | Optional: Upload-/Analyse-APIs nur für eingeloggte Nutzer erlauben (getUser) oder Rate-Limiting pro IP/User. | `app/api/gaeb-preview/route.ts`, `app/api/gaeb-split-llm/route.ts` |

---

## 5. API-Routen und serverseitige Schutzmechanismen

| Aspekt | Ist-Zustand | Risiko | Kritikalität | Empfohlene minimale Änderung | Betroffene Dateien |
|--------|-------------|--------|--------------|------------------------------|--------------------|
| /api/score (POST) | **Keine** Authentifizierung. Jeder kann LV-Text und optional Vortext senden; bei `useLlmRelevance: true` wird an OpenAI gesendet. Liest `triggers` und `scoring_config` aus Supabase (anon oder service role). | Missbrauch: kostenpflichtige Analysen und Datenfluss an OpenAI ohne Nutzerkonto; mögliche Kostenexplosion. | **hoch** | Mindestens: Aufruf nur für eingeloggte Nutzer (getUser) oder striktes Rate-Limiting. Langfristig: Nutzer immer erforderlich. | `app/api/score/route.ts` |
| /api/analyze-vortext (POST) | Keine Authentifizierung. Verarbeitet Vortext, sendet ggf. an OpenAI. | Wie bei /api/score: Kosten und Datenschutz (LV-Inhalte an Drittanbieter). | **hoch** | Gleiche Maßnahme wie bei /api/score: Auth oder starkes Rate-Limiting. | `app/api/analyze-vortext/route.ts` |
| /api/gaeb-split-llm (POST) | Keine Authentifizierung. Sendet Datei-Inhalt an OpenAI. | Kosten- und Datenschutzrisiko; Upload-Größe durch HARD_MAX_CHARS begrenzt. | **mittel** | Auth oder Rate-Limiting; Limit beibehalten. | `app/api/gaeb-split-llm/route.ts` |
| /api/admin/* | Keine Prüfung von Rolle oder User. GET/PUT `scoring-config`, GET/PUT `texts`, GET `ai-status` sind **öffentlich** aufrufbar. | Jeder kann Scoring- und Text-Konfiguration lesen und **ändern**; ai-status verrät, ob OPENAI_API_KEY gesetzt ist. | **hoch** | In allen Admin-APIs: User aus Session laden und gegen Allowlist/Admin-Rolle prüfen; bei fehlender Berechtigung 403. | `app/api/admin/scoring-config/route.ts`, `app/api/admin/texts/route.ts`, `app/api/admin/ai-status/route.ts` |
| /api/contact (POST) | Öffentlich, keine Rate-Limits. | Spam, E-Mail-Missbrauch, ggf. Ressourcenerschöpfung. | **mittel** | Rate-Limiting (z. B. pro IP oder pro E-Mail) einführen. | `app/api/contact/route.ts` |
| /api/test-trigger (POST) | Öffentlich, kein Auth. | Gering; kann zum Testen von Trigger-Logik genutzt werden. | **niedrig** | Optional: nur für eingeloggte Admin-Nutzer oder entfernen/deaktivieren. | `app/api/test-trigger/route.ts` |
| /api/export/pdf (POST) | Wenn `analysisId` gesetzt: Nutzer erforderlich, Analyse wird per user_id geladen. **Ohne** analysisId: Body wird direkt als Payload genutzt (kein DB-Zugriff). | Ohne analysisId kann theoretisch beliebiger JSON-Body als Report gerendert werden – kein Zugriff auf fremde Analysen, aber unkontrollierte PDF-Erzeugung. | **niedrig** | Optional: PDF-Export ohne analysisId nur für eingeloggte Nutzer oder abschaffen. | `app/api/export/pdf/route.ts` |
| User-Isolation in APIs | Analyse-APIs (list, [id], save, export mit analysisId) filtern konsequent mit `user_id`. | Bei korrekter Nutzung keine Überschreitung der Nutzergrenze. Ohne RLS bleibt ein Restrisiko bei Fehlern. | **mittel** | RLS ergänzen (siehe Abschnitt 2). | `app/api/analyse/list/route.ts`, `app/api/analyse/[id]/route.ts`, `app/api/analyse/save/route.ts`, `app/api/export/pdf/route.ts` |
| Rate-Limiting | Keine Rate-Limits in der Anwendung. | DoS, Kostenmissbrauch (OpenAI), Spam (Kontaktformular). | **mittel** | Zentrales oder pro-Route Rate-Limiting (z. B. Vercel/Edge oder Middleware) für score, analyze-vortext, contact. | Middleware oder API-Routen |

---

## 6. Admin-Bereich

| Aspekt | Ist-Zustand | Risiko | Kritikalität | Empfohlene minimale Änderung | Betroffene Dateien |
|--------|-------------|--------|--------------|------------------------------|--------------------|
| Seiten-Routing | Middleware-Matcher enthält **nur** `/app/:path*` und `/analyse`, **nicht** `/admin`. | Seiten unter `/admin` (scoring, texts, triggers, settings, debug) sind ohne Login erreichbar. | **hoch** | `/admin` und `/admin/:path*` in Middleware aufnehmen; nur erlauben, wenn User eingeloggt **und** (z. B.) in Admin-Allowlist. | `middleware.ts` |
| Admin-APIs | Siehe Abschnitt 5: keine Auth in scoring-config, texts, ai-status. | Konfiguration lesbar und änderbar durch jeden. | **hoch** | Siehe Abschnitt 5 (Admin-APIs absichern). | `app/api/admin/*` |

---

## 7. OpenAI-Datenfluss

| Aspekt | Ist-Zustand | Risiko | Kritikalität | Empfohlene minimale Änderung | Betroffene Dateien |
|--------|-------------|--------|--------------|------------------------------|--------------------|
| Welche Daten an OpenAI | LV-/Vortext-Inhalte, Positionstexte, Trigger-Kontext werden an OpenAI gesendet (score mit LLM, analyze-vortext, gaeb-split-llm, change-order, offer-assumptions, LLM-Refinement, etc.). | Vertragliche/DSGVO-relevante Inhalte (LVs, Angebote) bei Drittanbieter; ohne Auth können unbekannte Nutzer gezielt Daten einspeisen. | **hoch** | (1) Auth für alle Routen, die LV-Daten an OpenAI senden. (2) Datenschutzhinweis/AV-Vertrag mit OpenAI prüfen; ggf. Opt-Out oder klare Einwilligung. | Alle Routen/Libs, die `openai.chat.completions.create` oder ähnlich aufrufen |
| API-Key | `OPENAI_API_KEY` nur serverseitig (process.env), nicht in NEXT_PUBLIC_. | Key wird nicht an den Client gesendet. | **niedrig** | So beibehalten. | — |
| ai-status | GET `/api/admin/ai-status` gibt nur `openaiConfigured: boolean` zurück. | Information, ob ein Key gesetzt ist, ist für jeden abrufbar (siehe Admin). | **niedrig** | Mit Admin-Auth versehen, dann akzeptabel. | `app/api/admin/ai-status/route.ts` |

---

## 8. Logging / Debugging

| Aspekt | Ist-Zustand | Risiko | Kritikalität | Empfohlene minimale Änderung | Betroffene Dateien |
|--------|-------------|--------|--------------|------------------------------|--------------------|
| console.log / console.error | In Produktion genutzt: z. B. contact (E-Mail-Status), PDF-Export (Schritte, Fehler), score (debug-Parameter), changeOrderAnalysis, ensureUserProfile, offerStrategySummary, changePotential*. | Logs können in zentralen Systemen landen; je nach Inhalt Gefahr von PII oder sensiblen Strukturdaten (z. B. findings, IDs). | **mittel** | (1) Keine LV-Texte oder personenbezogenen Daten in Logs. (2) Debug-Ausgaben nur bei explizitem Flag (z. B. debug=1) oder NODE_ENV !== 'production'. | `app/api/contact/route.ts`, `app/api/export/pdf/route.ts`, `app/api/score/route.ts`, `lib/changeOrderAnalysis.ts`, `lib/billing/bootstrapProfile.ts`, weitere Libs mit console.* |
| Debug-Endpunkte | /api/score?debug=1 erweitert Response um interne Details. | Nur bei Aufruf mit debug; Aufruf derzeit ungeschützt (öffentliche Route). | **niedrig** | Wenn score geschützt wird, ist debug nur für eingeloggte (ggf. Admin-)Nutzer verfügbar. | `app/api/score/route.ts` |
| Admin Debug-Seite | /admin/debug zeigt Analyse-Daten aus localStorage oder eingegebenem JSON. | Daten bleiben im Browser; Seite selbst sollte nur für Admins erreichbar sein. | **niedrig** | Mit Admin-Schutz der Route absichern. | `app/admin/debug/page.tsx` |

---

## 9. Löschlogik / Retention

| Aspekt | Ist-Zustand | Risiko | Kritikalität | Empfohlene minimale Änderung | Betroffene Dateien / Tabellen |
|--------|-------------|--------|--------------|------------------------------|-------------------------------|
| Automatische Löschung | Keine implementierte Retention oder automatische Löschung für `analyse_runs`, `profiles`, `contact_requests` (falls genutzt). | Daten bleiben unbefristet; DSGVO „Speicherdauer begrenzen“ und Zweckbindung können verletzt werden. | **mittel** | (1) Datenschutz-Seite: Platzhalter „[X Tagen]“ durch konkrete Frist ersetzen. (2) Optional: Cron/Edge-Job oder Supabase PG-Funktion, die alte analyse_runs nach X Monaten löscht/anonymisiert. | `app/datenschutz/page.tsx`; Supabase/DB |
| Nutzerlöschung | Kein beschriebener Flow zum Löschen eines Nutzerkontos und zugehöriger Daten (analyse_runs, profiles). | Auskunfts- und Löschansprüche (DSGVO) schwer umsetzbar. | **mittel** | Prozess definieren: Nutzeranfrage → manuell oder per Admin-Funktion alle zugehörigen Daten löschen; auth.users in Supabase ggf. mit einbeziehen. | Dokumentation; ggf. Admin-Tool oder API |

---

## Priorisierte Top-10 (Risiko ↑, Eingriff ↓, Breaking ↓)

1. **Admin-APIs absichern** – In `/api/admin/*` (scoring-config, texts, ai-status) Nutzer prüfen und nur für Admin-Allowlist/Rolle zulassen. **Risiko: hoch. Eingriff: gering. Breaking: keins**, wenn nur Berechtigungsprüfung ergänzt wird.
2. **Admin-Seiten schützen** – Middleware um `/admin` und `/admin/:path*` erweitern; Zugriff nur für eingeloggte Nutzer mit Admin-Berechtigung. **Risiko: hoch. Eingriff: gering. Breaking: ja** für nicht-admin Nutzer (derzeit können alle /admin sehen).
3. **RLS für analyse_runs aktivieren** – Policies so, dass Nutzer nur eigene Zeilen lesen/schreiben; Service-Role für Backend. **Risiko: hoch. Eingriff: mittel. Breaking: möglich**, wenn aktuell ohne RLS mit Anon-Key gearbeitet wird (Code nutzt bereits user_id; Service-Role wird oft genutzt).
4. **/api/score (POST) authentifizieren** – Mindestens `getUser()`; bei fehlendem User 401. Optional Rate-Limit. **Risiko: hoch. Eingriff: gering. Breaking: ja** für anonyme Nutzer (z. B. Demo ohne Login).
5. **/api/analyze-vortext (POST) authentifizieren** – Wie bei score. **Risiko: hoch. Eingriff: gering. Breaking: ja** für unangemeldete Nutzer.
6. **Rate-Limiting für Kontakt und Analyse** – Z. B. pro IP oder pro User für `/api/contact`, `/api/score`, `/api/gaeb-split-llm`. **Risiko: mittel. Eingriff: mittel. Breaking: keins**, wenn Limits großzügig.
7. **RLS für scoring_config und texts_config** – Nur Service-Role oder definierte Admin-Rolle schreiben; Lesen je nach Produktentscheidung. **Risiko: hoch. Eingriff: mittel. Breaking: gering**, wenn Admin-APIs nur mit Service-Role schreiben.
8. **Logging bereinigen** – Keine LV-Texte/PII in console.*; Debug-Logs nur bei Flag oder !production. **Risiko: mittel. Eingriff: gering. Breaking: keins.**
9. **Retention/Datenschutz-Text** – Konkrete Speicherfrist in Datenschutz-Seite; optional automatische Löschung alter analyse_runs. **Risiko: mittel. Eingriff: gering (Text) bis mittel (Cron). Breaking: keins.**
10. **/api/gaeb-split-llm und /api/gaeb-preview** – Optional Auth oder Rate-Limit; Body-/Upload-Größenlimits einheitlich dokumentieren und durchsetzen. **Risiko: mittel. Eingriff: gering. Breaking: optional.**

---

## Breaking-Risiken (explizit)

- **Admin-Schutz:** Sobald `/admin` in der Middleware geschützt wird, können **nicht** als Admin markierte Nutzer die Admin-Seiten nicht mehr aufrufen (derzeit können alle sie aufrufen).
- **Score/Analyse-Vortext Auth:** Wenn POST `/api/score` und `/api/analyze-vortext` nur noch mit gültigem User aufrufbar sind, funktionieren **anonyme** oder **nicht eingeloggte** Nutzerflows (z. B. „Analyse ohne Konto“) nicht mehr, sofern nicht explizit erlaubt (z. B. über API-Key oder separater Demo-Route).
- **RLS:** Wenn RLS aktiviert wird und Policies zu restriktiv sind (z. B. kein SELECT für Service-Role oder falsche user_id-Bedingung), können bestehende Aufrufe (z. B. aus API mit Service-Role) fehlschlagen. Policies und alle Zugriffe (inkl. Service-Role) vor Go-Live testen.

---

*Ende der Audit-Zusammenfassung. Keine Code-Änderungen vorgenommen.*
