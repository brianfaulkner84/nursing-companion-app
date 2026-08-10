import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Starts a Stripe Checkout session for the $5/mo plan with a 14-day trial baked in.
// Stripe hosts the actual payment page, no card data ever touches this app.
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const origin = new URL(request.url).origin;
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { supabase_user_id: user.id },
    },
    // Also stamped on the session itself so the webhook can find the user even if the
    // subscription's metadata is ever missing for some reason.
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    success_url: `${origin}/dashboard?subscribed=1`,
    cancel_url: `${origin}/subscribe`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
