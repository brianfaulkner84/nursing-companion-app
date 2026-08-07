# Nursing Companion App (LPN Launchpad)

An NCLEX-PN practice app for LPN students. Students sign in with Google, work through
practice questions by subject, review the strategy walkthrough and rationale behind
each answer, build custom multi-subject review sessions, track progress, and raise a
hand on any question they're stuck on. Access is subscription-gated through Stripe,
with beta codes for early access.

## Scheduled piece

`app/api/cron/raised-hand-reminder/route.ts`, triggered daily at 13:00 UTC by Vercel
Cron (`vercel.json`). It queries `raised_hands` for anything still open after 2 days
and, if `RESEND_API_KEY` is set, emails a summary so nothing silently ages out past a
1 to 2 business day response goal. Authenticated with `CRON_SECRET`, which Vercel
sends automatically as a bearer token when it fires the job.

## On-demand piece

`app/api/raise-hand/route.ts`, triggered by the "Raise your hand" button on a missed
question. This is also the agentic step: it assembles the question, the student's
selected answer, the strategy walkthrough, and the student's note into a prompt, then
calls Claude (Haiku) to draft a reply in an instructor's voice addressing the
student's specific confusion, not just repeating the rationale. The draft is saved to
`raised_hands.claude_draft_reply` and emailed to the instructor for review — it is
never sent to the student automatically. The instructor reviews and edits the draft at
`/admin/inbox` (gated to whichever Google account matches `ADMIN_EMAIL`) and sends it
from there; `/api/raised-hands/[id]/respond` writes the final reply and marks the
thread resolved. The student sees it on their own `/inbox` page — no student or
instructor email address is ever exchanged in-app.

This is an ongoing thread, not a single message and reply. Every message either side
sends is a row in `raised_hand_messages` (`/api/raised-hands/[id]/reply` for the
student, the respond route above for the instructor); a student reply reopens the
thread, which is what puts it back in front of the instructor at `/admin/inbox`.
Students can delete their own messages (`/api/raised-hand-messages/[id]`, DELETE);
instructor messages can't be deleted this way, checked server-side. `/admin/inbox`
also has a "Clear replied" button (`/api/raised-hands/clear-replied`) that hides
answered threads from the instructor's queue via `raised_hands.archived_by_instructor`
— it never touches the underlying rows, so the student's own Inbox is unaffected.

## Data model

Real Supabase Postgres, no mock data. `questions` holds question content;
`question_interactions` / `question_options` / `response_keys` hold the answer
structure (built as a small interaction layer so future NCLEX item formats like
bow-tie or matrix can be added without another schema rewrite, even though only
single-choice, multiple-response, and select-N are implemented today); `attempts`
tracks what a student has answered; `subject_folders` / `subject_folder_items` hold
saved custom review sets; `subscriptions` and `profiles.access_type` gate access;
`raised_hands` holds the agentic-step records. All access is row-level-security
scoped to the signed-in user. Server-side answer scoring (`/api/submit-attempt`) uses
the service-role key so the answer key is never shipped to the browser before a
question is submitted.

## Secrets

All credentials are environment variables, set in Vercel and never committed. See
`.env.local.example` for the full list (Supabase URL/anon/service-role keys,
Anthropic API key, Stripe keys, Resend key, cron secret, admin email).

## Deploy steps

1. Push this folder to a GitHub repo, with the repo's Root Directory set correctly in
   Vercel (case-sensitive — this bit me once).
2. In Supabase, create a project and run `supabase/schema.sql` in the SQL editor,
   followed by any files in `supabase/migrations/` in date order.
3. In Supabase Auth > Providers, enable Google with a Google Cloud OAuth client.
   Redirect URL: `https://<your-domain>/auth/callback`.
4. In Vercel, import the repo and set the environment variables listed above.
5. Deploy. Vercel reads `vercel.json` and schedules the daily reminder automatically.
6. Run `node scripts/import-questions.js questions.json` locally (with Supabase env
   vars set) to load a question bank. Format documented in `question_format.md`.

## What's built

Google sign-in, Stripe subscription with a 14-day trial (plus beta codes), a
dashboard that browses subjects three ways (by course module, pulled from the table
of contents of the LPN Launchpad study books; by NCLEX test-plan topic; or by
question type) instead of one flat list, single-subject and multi-subject review
sessions, a custom review builder with saved folders, answer breakdown with strategy
and rationale, raise-a-hand with a Claude-drafted reply reviewed and sent by the
instructor through `/admin/inbox`, a student-facing `/inbox` showing that reply, a
`/help` page walking through every screen, per-subject progress reset, and a daily
reminder cron. Full brand styling pulled from the LPN Launchpad logo and design
packet.

New subjects need a module tag to show up under the right module on the dashboard
(they show under "Other" until tagged) — see
`supabase/migrations/20260806070000_tag_subjects_with_modules.sql`.

## What's not built yet

A profile/preferences screen and a weekly performance email.
