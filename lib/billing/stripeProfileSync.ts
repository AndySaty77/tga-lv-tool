import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { isAdminEmail } from "@/lib/auth/is-admin";

export function getSupabaseServiceRole(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

/**
 * Entitlement aus Stripe-Subscription-Status (minimal, konservativ).
 * incomplete = noch kein aktives Abo → free.
 */
export function mapStripeStatusToPlan(status: Stripe.Subscription["status"]): "pro" | "free" {
  if (status === "active" || status === "trialing" || status === "past_due" || status === "paused") {
    return "pro";
  }
  return "free";
}

function subscriptionIdForProfile(
  status: Stripe.Subscription["status"],
  subscriptionId: string
): string | null {
  if (status === "canceled" || status === "incomplete_expired" || status === "unpaid") {
    return null;
  }
  return subscriptionId;
}

/**
 * Spiegelt eine Stripe-Subscription nach profiles.
 * Admin-E-Mails (ADMIN_EMAILS): nur Billing-Felder, kein Überschreiben von plan (Schutz bestehender Admin-/Kontozuordnung).
 */
export async function syncProfileFromStripeSubscription(
  supabase: SupabaseClient,
  userId: string,
  subscription: Stripe.Subscription,
  customerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: profile, error: loadErr } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: loadErr.message };
  }

  const item0 = subscription.items?.data?.[0];
  const periodEndUnix = item0?.current_period_end;
  const periodEnd =
    typeof periodEndUnix === "number" && Number.isFinite(periodEndUnix)
      ? new Date(periodEndUnix * 1000).toISOString()
      : null;

  const rawStatus = subscription.status;
  const admin = isAdminEmail(profile?.email ?? null);

  if (admin) {
    const { error } = await supabase
      .from("profiles")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionIdForProfile(rawStatus, subscription.id),
        billing_status: rawStatus,
        billing_current_period_end: periodEnd,
      })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const plan = mapStripeStatusToPlan(rawStatus);
  const { error } = await supabase
    .from("profiles")
    .update({
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionIdForProfile(rawStatus, subscription.id),
      billing_status: rawStatus,
      billing_current_period_end: periodEnd,
    })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function resolveUserIdFromSubscriptionMetadata(subscription: Stripe.Subscription): string | null {
  const raw = subscription.metadata?.supabase_user_id;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

/**
 * User-ID aus Subscription-Metadaten oder – Fallback – aus Stripe-Customer-Metadaten (cus_…).
 */
export async function resolveUserIdForStripeSubscription(
  stripe: InstanceType<typeof Stripe>,
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromSub = resolveUserIdFromSubscriptionMetadata(subscription);
  if (fromSub) return fromSub;
  const cid = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!cid || typeof cid !== "string") return null;
  const customer = await stripe.customers.retrieve(cid);
  if (customer.deleted) return null;
  const raw = customer.metadata?.supabase_user_id;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}
