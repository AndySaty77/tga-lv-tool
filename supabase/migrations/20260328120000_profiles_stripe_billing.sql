-- Stripe-Billing: optionale Spiegel-Felder auf profiles (Entitlement bleibt über profiles.plan).
-- Keine Änderung an analysis_* oder bestehender plan-Semantik.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_status text,
  ADD COLUMN IF NOT EXISTS billing_current_period_end timestamptz;

COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe Customer ID (cus_…), optional.';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Stripe Subscription ID (sub_…), optional.';
COMMENT ON COLUMN profiles.billing_status IS 'Roher Stripe-Abostatus (z. B. active, canceled), optional.';
COMMENT ON COLUMN profiles.billing_current_period_end IS 'Ende der aktuellen Abrechnungsperiode (laut Stripe), optional.';
