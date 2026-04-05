import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { getUser } from "@/lib/auth/get-user";
import { getSupabaseServiceRole } from "@/lib/billing/stripeProfileSync";
import { getUserPlan } from "@/lib/billing/userPlan";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { getStripe, getStripePriceProMonthly } from "@/lib/stripe/server";

/**
 * POST /api/billing/checkout
 * Startet eine Stripe Checkout Session (Pro, monatlich) für eingeloggte Free-Nutzer.
 * Antwort: { url: string } oder Fehler-JSON (konsistent zu anderen APIs).
 */
export async function POST() {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  if (isAdmin(user)) {
    return NextResponse.json(
      {
        error: "admin_checkout",
        message: "Für Admin-Konten ist kein Checkout vorgesehen.",
      },
      { status: 403 }
    );
  }

  let plan;
  try {
    plan = await getUserPlan();
  } catch {
    plan = "free" as const;
  }
  if (plan === "pro") {
    return NextResponse.json(
      {
        error: "already_pro",
        message: "Dein Konto ist bereits auf Pro. Ein weiterer Checkout ist nicht nötig.",
      },
      { status: 409 }
    );
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      { error: "Konfiguration fehlt (SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 }
    );
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripe();
    priceId = getStripePriceProMonthly();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stripe nicht konfiguriert." },
      { status: 503 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    if (profile) {
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
      if (upErr) {
        // eslint-disable-next-line no-console
        console.error("[checkout] stripe_customer_id update failed", upErr.message);
        return NextResponse.json({ error: "Profil konnte nicht aktualisiert werden." }, { status: 500 });
      }
    } else {
      const { error: insErr } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        plan: "free",
        analysis_used_total: 0,
        analysis_limit_total: 3,
        stripe_customer_id: customerId,
      });
      if (insErr) {
        // eslint-disable-next-line no-console
        console.error("[checkout] profile insert failed", insErr.message);
        return NextResponse.json({ error: "Profil konnte nicht angelegt werden." }, { status: 500 });
      }
    }
  }

  const base = getAppBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/app/billing?checkout=success`,
    cancel_url: `${base}/app/billing?checkout=canceled`,
    client_reference_id: user.id,
    metadata: { supabase_user_id: user.id },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Checkout-URL fehlt." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
