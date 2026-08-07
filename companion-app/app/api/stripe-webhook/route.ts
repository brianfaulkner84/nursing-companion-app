import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

// Stripe calls this directly, no user session involved, so this route trusts nothing except
// a request whose signature verifies against STRIPE_WEBHOOK_SECRET. That signature check is
// the only thing standing between "a real Stripe event" and "anyone on the internet POSTing
// a fake 'subscription active' event," so every code path below runs after it, never before.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `signature verification failed: ${err.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  async function upsertFromSubscription(subscription: Stripe.Subscription, userId?: string) {
    let resolvedUserId = userId ?? subscription.metadata?.supabase_user_id;

    // First webhook for a brand-new subscription: metadata may not have propagated to the
    // subscription object yet, fall back to looking up the existing row by customer id.
    if (!resolvedUserId) {
      const { data: existing } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", subscription.customer as string)
        .maybeSingle();
      resolvedUserId = existing?.user_id;
    }
    if (!resolvedUserId) return;

    await admin.from("subscriptions").upsert(
      {
        user_id: resolvedUserId,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        price_id: subscription.items.data[0]?.price?.id ?? null,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: "user_id" }
    );

    const hasAccess = subscription.status === "trialing" || subscription.status === "active";
    if (hasAccess) {
      await admin.from("profiles").update({ access_type: "paid" }).eq("id", resolvedUserId);
    } else {
      // past_due/canceled/unpaid/incomplete: don't silently grant access, but don't clobber
      // a lifetime-free beta grant either, only downgrade someone who was on "paid".
      await admin.from("profiles").update({ access_type: "free-trial" }).eq("id", resolvedUserId).eq("access_type", "paid");
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertFromSubscription(subscription, session.client_reference_id ?? undefined);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      await upsertFromSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertFromSubscription(subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
