/**
 * Selektive Freigabe für Stripe Checkout, wenn DISABLE_PUBLIC_PRO_CHECKOUT aktiv ist.
 * Keine DB, nur ENV – Webhooks/Stripe-Session bleiben unverändert.
 */

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

/** Parst STRIPE_CHECKOUT_ALLOWED_EMAILS (kommasepariert). Leer/Whitespace → leeres Set. */
export function parseStripeCheckoutAllowedEmails(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const n = normalizeEmail(part);
    if (n) set.add(n);
  }
  return set;
}

/** True, wenn die Nutzer-E-Mail in der Allowlist vorkommt (trim + lowercase). */
export function isCheckoutAllowedForEmail(userEmail: string | null | undefined, allowed: Set<string>): boolean {
  if (!userEmail?.trim() || allowed.size === 0) return false;
  return allowed.has(normalizeEmail(userEmail));
}
