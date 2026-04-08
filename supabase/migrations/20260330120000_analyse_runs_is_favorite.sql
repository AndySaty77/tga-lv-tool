-- Persönliche Favoriten-Markierung pro gespeicherter Analyse (MVP, nutzerbezogen).
-- Keine Auswirkung auf Analyseinhalte; Default false für bestehende Zeilen.

ALTER TABLE analyse_runs
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN analyse_runs.is_favorite IS 'Nutzer-Markierung (Favorit), keine Status- oder Teamlogik';
