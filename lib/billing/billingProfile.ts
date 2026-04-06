import { getSupabaseServiceRole } from "@/lib/billing/stripeProfileSync";

export type BillingProfileRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_status: string | null;
  billing_current_period_end: string | null;
  billing_cancel_at_period_end: boolean | null;
  plan_source: string | null;
  trial_ends_at: string | null;
  plan_notes: string | null;
};

/**
 * Liest Billing-relevante Spalten aus profiles (Service Role, Server-only).
 */
export async function getBillingProfileFields(userId: string): Promise<BillingProfileRow | null> {
  const supabase = getSupabaseServiceRole();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "stripe_customer_id, stripe_subscription_id, billing_status, billing_current_period_end, billing_cancel_at_period_end, plan_source, trial_ends_at, plan_notes"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    stripe_customer_id: typeof data.stripe_customer_id === "string" ? data.stripe_customer_id : null,
    stripe_subscription_id: typeof data.stripe_subscription_id === "string" ? data.stripe_subscription_id : null,
    billing_status: typeof data.billing_status === "string" ? data.billing_status : null,
    billing_current_period_end:
      typeof data.billing_current_period_end === "string" ? data.billing_current_period_end : null,
    billing_cancel_at_period_end:
      typeof data.billing_cancel_at_period_end === "boolean" ? data.billing_cancel_at_period_end : null,
    plan_source: typeof data.plan_source === "string" ? data.plan_source : null,
    trial_ends_at: typeof data.trial_ends_at === "string" ? data.trial_ends_at : null,
    plan_notes: typeof data.plan_notes === "string" ? data.plan_notes : null,
  };
}
