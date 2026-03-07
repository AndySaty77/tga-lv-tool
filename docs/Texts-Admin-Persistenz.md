# Texte speichern (Admin → Texte)

Die Admin-Seite **/admin/texts** kann Texte und Labels zentral pflegen. Damit das **Speichern** dauerhaft funktioniert, wird eine Tabelle **texts_config** in Supabase benötigt.

## Tabelle anlegen

Im **Supabase Dashboard** unter **SQL Editor** ausführen:

```sql
-- Tabelle für zentrale Text-Konfiguration (analog scoring_config)
CREATE TABLE IF NOT EXISTS texts_config (
  key text PRIMARY KEY,
  is_active boolean DEFAULT true,
  value jsonb NOT NULL DEFAULT '{}'
);

-- Optional: RLS aktivieren; dann Service Role Key für die Admin-API verwenden
-- (siehe docs/Scoring-Admin-RLS.md) oder Policies für anon definieren.
ALTER TABLE texts_config ENABLE ROW LEVEL SECURITY;
```

- **key:** Eindeutiger Schlüssel, z. B. `"default"` für die Haupt-Config.
- **value:** JSON-Objekt mit der kompletten Textstruktur (customerUI, explanation, rueckfragen, angebotsklarstellungen, internal).

Die API **GET /api/admin/texts** liest die Zeile mit `key = 'default'`. **PUT** führt ein Upsert mit `onConflict: "key"` aus. Ohne Tabelle oder bei RLS-Fehler liefert GET die Default-Config aus `lib/textsConfig.ts`; PUT antwortet mit einer Fehlermeldung (z. B. Hinweis auf Service Role Key oder RLS-Policy).

## Persistenz-Status auf der Admin-Seite

- **Quelle: Datenbank (texts_config)** → Speicherung ist dauerhaft.
- **Quelle: Default (lib/textsConfig.ts)** → Keine persistente Speicherung; Tabelle anlegen und ggf. Service Role Key setzen (siehe [Scoring-Admin-RLS.md](./Scoring-Admin-RLS.md)).

## Hinweis zur Analyse-Seite

Die Analyse-Seite (/analyse) liest derzeit die Texte aus **lib/textsConfig.ts** (Build-Zeit). Eine spätere Anbindung kann die Config aus der API bzw. aus der Datenbank laden, damit in /admin/texts gespeicherte Änderungen sofort auf /analyse sichtbar werden.
