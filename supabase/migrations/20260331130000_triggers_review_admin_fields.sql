-- Admin-Pflege: Prüfstatus und zugehörige Felder (keine Auswirkung auf Analyse-Engine)
ALTER TABLE triggers
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS family_cluster text,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by text;

COMMENT ON COLUMN triggers.review_status IS 'Admin: Prüfstatus (draft, in_progress, checked_content, checked_output, approved, problematic)';
COMMENT ON COLUMN triggers.internal_note IS 'Admin: interne Notiz für Pflegende';
COMMENT ON COLUMN triggers.family_cluster IS 'Admin: Themenfamilie / inhaltliche Gruppierung';
COMMENT ON COLUMN triggers.last_reviewed_at IS 'Admin: Zeitpunkt der letzten inhaltlichen Prüfung (gesetzt bei bestimmten Statuswechseln)';
COMMENT ON COLUMN triggers.reviewed_by IS 'Admin: wer zuletzt geprüft hat (falls aus Login ermittelbar)';
