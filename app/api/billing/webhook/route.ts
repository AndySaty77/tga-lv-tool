import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getSupabaseServiceRole,
  resolveUserIdForStripeSubscription,
  resolveUserIdFromSubscriptionMetadata,
  syncProfileFromStripeSubscription,
} from "@/lib/billing/stripeProfileSync";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function customerIdFromStripeField(
  customer: Stripe.Subscription["customer"]
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.id;
}

/** Stripe API: Subscription-ID liegt bei Rechnungen unter parent.subscription_details. */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const p = invoice.parent;
  if (!p || p.type !== "subscription_details" || !p.subscription_details) return null;
  const sub = p.subscription_details.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/**
 * POST /api/billing/webhook
 * Stripe Webhooks (Signaturpflicht). Spiegelt Abo-Status nach profiles.
 *
 * Konfiguration in Stripe Dashboard: Events u. a.
 * checkout.session.completed, customer.subscription.updated, customer.subscription.deleted,
 * invoice.paid, invoice.payment_failed
 */
export async function POST(req: Request) {
  let stripe: Stripe;
  let secret: string;
  try {
    stripe = getStripe();
    secret = getStripeWebhookSecret();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stripe nicht konfiguriert." },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Keine Signatur" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch {
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt" }, { status: 503 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data"] });
        const userId =
          (typeof session.client_reference_id === "string" && session.client_reference_id.trim()) ||
          (typeof session.metadata?.supabase_user_id === "string" && session.metadata.supabase_user_id.trim()) ||
          (await resolveUserIdForStripeSubscription(stripe, sub));
        if (!userId) break;
        const customerId = customerIdFromStripeField(sub.customer);
        if (!customerId) break;
        await syncProfileFromStripeSubscription(supabase, userId, sub, customerId);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subObj = event.data.object as Stripe.Subscription;
        const sub = await stripe.subscriptions.retrieve(subObj.id, { expand: ["items.data"] });
        const userId =
          resolveUserIdFromSubscriptionMetadata(sub) || (await resolveUserIdForStripeSubscription(stripe, sub));
        if (!userId) break;
        const customerId = customerIdFromStripeField(sub.customer);
        if (!customerId) break;
        await syncProfileFromStripeSubscription(supabase, userId, sub, customerId);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = subscriptionIdFromInvoice(invoice);
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data"] });
        const userId = await resolveUserIdForStripeSubscription(stripe, sub);
        if (!userId) break;
        const customerId = customerIdFromStripeField(sub.customer);
        if (!customerId) break;
        await syncProfileFromStripeSubscription(supabase, userId, sub, customerId);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
