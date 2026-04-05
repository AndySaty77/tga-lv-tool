import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

/**
 * Stripe-Client nur für Server (Route Handler, Server Actions).
 * Wirft, wenn STRIPE_SECRET_KEY fehlt – Aufrufer sollen 503 liefern.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || typeof key !== "string" || !key.trim()) {
    throw new Error("STRIPE_SECRET_KEY fehlt oder ist leer (nur serverseitig setzen).");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || typeof secret !== "string" || !secret.trim()) {
    throw new Error("STRIPE_WEBHOOK_SECRET fehlt oder ist leer.");
  }
  return secret.trim();
}

export function getStripePriceProMonthly(): string {
  const id = process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!id || typeof id !== "string" || !id.trim()) {
    throw new Error("STRIPE_PRICE_PRO_MONTHLY fehlt oder ist leer.");
  }
  return id.trim();
}
