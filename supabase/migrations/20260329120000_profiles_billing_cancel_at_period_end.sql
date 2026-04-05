-- Kündigung zum Periodenende: Spiegel von Stripe subscription.cancel_at_period_end
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS billing_cancel_at_period_end boolean;

COMMENT ON COLUMN profiles.billing_cancel_at_period_end IS 'True, wenn das Abo zum Ende der laufenden Periode endet (Stripe cancel_at_period_end).';
