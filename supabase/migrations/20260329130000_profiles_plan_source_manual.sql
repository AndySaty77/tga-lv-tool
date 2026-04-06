-- Manuelle Pro-/Trial-Freischaltung (ohne Stripe-Checkout); Webhooks unverändert.
alter table public.profiles
  add column if not exists plan_source text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists plan_notes text;

comment on column public.profiles.plan_source is 'z. B. manual für Einladung/Test; Stripe bleibt Default (null)';
comment on column public.profiles.trial_ends_at is 'optional: Gültigkeit manueller Pro-Zugang';
comment on column public.profiles.plan_notes is 'optional: interne Notiz (nicht in der App anzeigen)';
