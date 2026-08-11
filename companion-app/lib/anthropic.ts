import Anthropic from "@anthropic-ai/sdk";

// Lazily constructed, not a top-level `new Anthropic(...)`: Next.js imports every API route
// module at build time to collect page data, before Vercel secrets are necessarily set, and
// an eagerly-constructed client with a missing key can throw right then and take the whole
// build down (this happened to the Stripe client, see lib/stripe.ts). Shared by every route
// that calls Claude (raise-hand draft/audit, admin ai-assist) so there's one client, not one
// per route file.
let cached: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!cached) cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cached;
}

// Every Claude call in this app that produces text a student or instructor will actually read
// gets this same guardrail appended: don't invent a shared classroom history that isn't in the
// prompt. Centralized so the raise-hand draft, the ai-assist revision, and anything added later
// all carry the same fabrication guard instead of each route restating it slightly differently.
export const NO_FABRICATED_CONTEXT_INSTRUCTION =
  `Do not reference lecture notes, "our unit," a specific textbook, page number, or any other course material as if you know what the student's class covered. ` +
  `You only know what's given in this prompt; do not imply a personal teaching relationship or shared class history that isn't given to you here.`;
