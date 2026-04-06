import type { PlanId } from "./plans";

/** Link zur Kontaktseite mit Demo-Kategorie (Pro-/Zugangsanfrage). */
export const CONTACT_PRO_INQUIRY_HREF = "/contact?category=demo";

/**
 * Pro rein über manuelle Freischaltung (Einladung/Test), kein Stripe-Abo in der UI.
 */
export function isManualProPlan(plan: PlanId, planSource: string | null | undefined): boolean {
  return plan === "pro" && planSource === "manual";
}

/**
 * Pro mit aktivem Stripe-Abo (Subscription-ID); für Portal / Abrechnungs-UI.
 * Manuelle Freischaltung schließt die Stripe-Billing-Ansicht aus (auch wenn historisch Kundendaten existieren).
 */
export function isStripeSubscriptionPro(
  plan: PlanId,
  planSource: string | null | undefined,
  stripeSubscriptionId: string | null | undefined
): boolean {
  if (plan !== "pro") return false;
  if (planSource === "manual") return false;
  return !!stripeSubscriptionId;
}
