# Nursing Companion App

Built to match the Assignment 5A design and the 5B build plan. Compiles cleanly, no type errors.

## Deploy steps

1. Push this folder to a new GitHub repo.
2. In Supabase, create a project, then run `supabase/schema.sql` in the SQL editor. It creates the five tables, Row Level Security policies, and seeds the 68C-FTW beta code.
3. In Supabase Auth > Providers, enable Google, using the client ID and secret from your Google Cloud OAuth client. Set the redirect URL to `https://<your-vercel-domain>/auth/callback` (or `https://lpnlaunchpad.com/auth/callback` once the custom domain is connected).
4. In Vercel, import the GitHub repo. Set these environment variables (from `.env.local.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, from Supabase Settings > API.
   - `SUPABASE_SERVICE_ROLE_KEY`, also from Supabase Settings > API. Server-only, never expose this one.
   - `ANTHROPIC_API_KEY`, from platform.claude.com.
   - `RESEND_API_KEY` and `NOTIFY_EMAIL`. Sign up at resend.com, add and verify `lpnlaunchpad.com` as a sending domain there (it gives you a few DNS records to add in Cloudflare), then set `NOTIFY_EMAIL` to your own inbox so drafts and reminders land there. The code already sends from `questions@lpnlaunchpad.com`. Until the domain is verified with Resend, these emails are skipped but everything else still works.
   - `CRON_SECRET`, any random string. Vercel automatically sends it as a bearer token when it triggers the cron job.
5. Deploy. Vercel reads `vercel.json` and schedules the daily reminder job automatically.
6. Connect `lpnlaunchpad.com` in Vercel under Settings > Domains, then in Cloudflare's DNS add the record Vercel gives you, with the proxy (orange cloud) switched off for that record so it's DNS-only.
7. Once you have `questions.json` back from the other AI (see `question_format.md`), run `node scripts/import-questions.js questions.json` locally with your Supabase env vars set, to load them in.

## What's built

Sign-In, Subscribe (with beta code), Dashboard, Quiz, Answer Breakdown, Raise Your Hand, Subject Complete, and Progress screens. The Raise Your Hand submit is the on-demand piece with a live Claude API call drafting the reply. The daily reminder is the scheduled Cron piece.

## What's not built yet

Profile/Preferences screen, the weekly performance email, and the bank-exhaustion batch-generation flow. All three are specified in the 5A design and can be added once the core loop is confirmed working.
