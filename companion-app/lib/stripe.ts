import Stripe from "stripe";

// Server-only. Never import this into a client component, the secret key can't reach the
// browser. Lazily constructed instead of a top-level `new Stripe(...)`: Next.js imports every
// API route module during "Collecting page data" at build time, even before secrets are
// configured in Vercel, and the Stripe SDK throws immediately in its constructor if the key
// is missing. A top-level instance turned that into a build-time crash that took down the
// whole deploy; getStripe() only throws if a route that actually needs Stripe is called
// without the key set.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!cached) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    cached = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });
  }
  return cached;
}
