-- Free-Limit: von "Analysen pro Monat" auf "insgesamt verbrauchte Analysen" (Lebenszeit).
-- profiles: analysis_limit_total (z. B. 3 für Free), analysis_used_total (nur erhöhen, nie beim Löschen reduzieren).

-- Neue Spalten
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS analysis_limit_total integer,
  ADD COLUMN IF NOT EXISTS analysis_used_total integer NOT NULL DEFAULT 0;

-- Bestehende Free-User: Limit 3; Verbrauch = bisherige Anzahl Analysen (Backfill)
UPDATE profiles
SET
  analysis_limit_total = 3,
  analysis_used_total = (
    SELECT COUNT(*)::integer
    FROM analyse_runs
    WHERE analyse_runs.user_id = profiles.id
  )
WHERE plan = 'free';

-- Pro/Admin: analysis_limit_total bleibt NULL (unbegrenzt)
-- Kein weiteres UPDATE nötig.

COMMENT ON COLUMN profiles.analysis_limit_total IS 'Max. Anzahl Analysen gesamt (nur Free). NULL = unbegrenzt (Pro/Admin).';
COMMENT ON COLUMN profiles.analysis_used_total IS 'Bisher insgesamt verbrauchte Analysen. Wird nur bei neu gespeicherter Analyse erhöht, nie beim Löschen reduziert.';

-- Atomares Erhöhen des Zählers (vermeidet Race-Conditions bei mehrfachen Klicks).
CREATE OR REPLACE FUNCTION increment_analysis_used_total(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE profiles
  SET analysis_used_total = COALESCE(analysis_used_total, 0) + 1
  WHERE id = p_user_id;
$$;
