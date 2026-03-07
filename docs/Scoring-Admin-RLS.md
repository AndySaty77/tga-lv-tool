# Scoring-Config speichern (RLS)

Die Tabelle `scoring_config` in Supabase ist standardmäßig durch **Row Level Security (RLS)** geschützt. Beim Speichern unter **Admin → Scoring** kann daher folgender Fehler auftreten:

```text
new row violates row-level security policy for table "scoring_config"
```

## Empfohlene Lösung: Service Role Key

Damit die Admin-API schreiben kann, **ohne** RLS für alle zu lockern:

1. Im **Supabase Dashboard** unter **Project Settings → API** den **service_role** Key kopieren (geheim halten).
2. In der lokalen `.env.local` eintragen (nur Server-seitig, **nicht** `NEXT_PUBLIC_`):

   ```env
   SUPABASE_SERVICE_ROLE_KEY=dein_service_role_key_hier
   ```

3. Dev-Server neu starten. Die Route `/api/admin/scoring-config` (GET/PUT) nutzt dann automatisch den Service Role und umgeht RLS nur für diesen Zugriff.

Der Service Role Key wird **nur im Backend** verwendet und nie an den Browser geschickt.

---

## Alternative: RLS-Policy für scoring_config

Falls du keinen Service Role Key verwenden willst, kannst du in Supabase unter **SQL Editor** eine Policy anlegen, die Lese-/Schreibzugriff auf die Zeile mit `key = 'default'` erlaubt (z. B. für die Rolle `anon`):

```sql
-- Nur ausführen, wenn du anon-Zugriff auf scoring_config erlauben willst.
-- Weniger sicher als Service Role, da jeder mit dem Anon-Key schreiben könnte.

ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read scoring_config default"
  ON scoring_config FOR SELECT
  USING (key = 'default');

CREATE POLICY "Allow insert/update scoring_config default"
  ON scoring_config FOR ALL
  USING (key = 'default')
  WITH CHECK (key = 'default');
```

Hinweis: Damit kann jeder Client mit dem Anon-Key die Config lesen und überschreiben. Für reine Admin-Tools ist der **Service Role Key** in der Backend-API die sauberere Variante.
