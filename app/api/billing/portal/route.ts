import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { getSupabaseServiceRole } from "@/lib/billing/stripeProfileSync";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { getStripe } from "@/lib/stripe/server";

/**
 * POST /api/billing/portal
 * Stripe Customer Portal – Zahlungsmittel, Rechnungen, Abo (Kündigung/Weiterlauf).
 * Antwort: { url: string } wie Checkout.
 */
export async function POST() {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      { error: "Konfiguration fehlt (SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id;
  if (!customerId || typeof customerId !== "string") {
    return NextResponse.json(
      {
        error: "no_stripe_customer",
        message:
          "Kein Stripe-Kundenkonto hinterlegt. Bitte zuerst ein Pro-Abo abschließen oder den Support kontaktieren.",
      },
      { status: 400 }
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stripe nicht konfiguriert." },
      { status: 503 }
    );
  }

  const base = getAppBaseUrl();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/app/billing`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Portal-URL fehlt." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
