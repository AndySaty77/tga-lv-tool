-- LV-/Angebotsvorgang: Bearbeitungsstatus und optionaler Angebotsbetrag (Nutzerpflege, keine Engine-Logik)
ALTER TABLE analyse_runs
  ADD COLUMN IF NOT EXISTS lv_status text NOT NULL DEFAULT 'offen',
  ADD COLUMN IF NOT EXISTS bid_amount_net numeric(15, 2);

COMMENT ON COLUMN analyse_runs.lv_status IS 'Bearbeitungsstatus des LV-/Angebotsvorgangs (Nutzer/Admin)';
COMMENT ON COLUMN analyse_runs.bid_amount_net IS 'Angebotsbetrag netto in Euro (optional)';

ALTER TABLE analyse_runs
  DROP CONSTRAINT IF EXISTS analyse_runs_lv_status_check;

ALTER TABLE analyse_runs
  ADD CONSTRAINT analyse_runs_lv_status_check CHECK (
    lv_status IN (
      'offen',
      'in_bearbeitung',
      'zurueckgestellt',
      'nicht_abgegeben',
      'abgegeben',
      'gewonnen',
      'verloren'
    )
  );
