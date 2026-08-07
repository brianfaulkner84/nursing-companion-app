import Stripe from "stripe";

// Server-only. Never import this into a client component, the secret key can't reach the
// browser.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});
