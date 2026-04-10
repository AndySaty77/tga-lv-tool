-- Optionaler, nutzertauglicher Prüfhinweis pro Trigger (Analyse-UI). Keine Engine-/Score-Logik.

ALTER TABLE triggers
  ADD COLUMN IF NOT EXISTS user_hint text;

COMMENT ON COLUMN triggers.user_hint IS
  'Kurzer Prüfhinweis für die Analyse-UI (read-only Anzeige). Leer = kein zusätzlicher Hinweis.';

-- Testinhalt für einen konkreten Trigger (anpassbar in Supabase); kein Einfluss auf Bewertung.
UPDATE triggers
SET user_hint = $hint$
Prüfen Sie im LV, ob Hebeanlage bzw. Pumpensumpf inkl. Alarmierung (Meldeketten, Notstrom, Leittechnik) eindeutig beschrieben sind. Unklare Alarm- oder Entleerungslogik oft relevant für Angebot und spätere Betriebsführung.
$hint$
WHERE name = 'Hebeanlage/Pumpensumpf/Alarmierung unklar';
