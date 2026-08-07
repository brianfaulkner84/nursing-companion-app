# Nursing Companion App (LPN Launchpad)

An NCLEX-PN practice app for LPN students. Students sign in with Google, work through
practice questions by subject, review the strategy walkthrough and rationale behind
each answer, build custom multi-subject review sessions, track progress, and raise a
hand on any question they're stuck on. Access is subscription-gated through Stripe,
with beta codes for early access.

## Scheduled piece

`app/api/cron/raised-hand-reminder/route.ts`, triggered daily at 13:00 UTC by Vercel
Cron (`vercel.json`). This is the escalation net, not an instructor's primary
notification -- an instructor sees new raised hands the moment they open
`/admin/inbox`, this route only exists to catch the ones nobody got to. It queries
`raised_hands` for anything still open past a 24-hour SLA and, if `RESEND_API_KEY` is
set, emails `NOTIFY_EMAIL` one deep link per thread straight into
`/admin/inbox?thread=<id>`, which scrolls to and highlights that exact conversation on
load. Authenticated with `CRON_SECRET`, which Vercel sends automatically as a bearer
token when it fires the job.

Because this only runs once a day, the true worst case for a hand raised right after
that day's run is closer to 48 hours before this catches it, not a clean 24 -- Vercel
Cron on the free/Hobby tier only allows once-a-day schedules. Running it every few
hours for a tighter SLA needs a paid Vercel plan; worth it once there are enough
schools that a daily check isn't fast enough, not before.

`NOTIFY_EMAIL` should always be a personal inbox, never a public-facing address. It's
never shown to students or instructors anywhere in the app (the outgoing sender
address students would ever see is `questions@lpnlaunchpad.com`, a completely separate
thing from where these system emails land), so there's no reason to route it through a
public alias, and doing so only risks pulling in mail unrelated to the app.

## On-demand piece

`app/api/raise-hand/route.ts`, triggered by the "Raise your hand" button on a missed
question. This is also the agentic step: it assembles the question, the student's
selected answer, the strategy walkthrough, and the student's note into a prompt, then
calls Claude (Haiku) to draft a reply in an instructor's voice addressing the
student's specific confusion, not just repeating the rationale. The draft is saved to
`raised_hands.claude_draft_reply` and queued in the instructor's in-app review
inbox — it is never sent to the student automatically. A header badge (shown to
instructor and admin roles, see [Roles and schools](#roles-and-schools)) shows the
open-thread count, and the instructor reviews and edits the draft at `/admin/inbox` and sends it from there;
`/api/raised-hands/[id]/respond` writes the final reply and marks the thread
resolved. The student sees it on their own `/inbox` page — no student or instructor
email address is ever exchanged in-app. (An optional email nudge exists too: if
`RESEND_API_KEY` is set, a new raised hand also emails `NOTIFY_EMAIL` as a backup
notification, but the badge and in-app inbox are the primary path and work without it.)

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

## Roles and schools

Three roles: `student`, `instructor`, `admin`, stored on `profiles.role`. An instructor can
do everything admin can except manage content: they run `/admin/inbox` (reply to raised
hands) and `/admin/feedback` (review general feedback and flagged questions), scoped to their
own school's students. `/admin/content-gaps` and the question bank stay admin-only, that's
curriculum ownership, not day-to-day student support. Admin sees every school unfiltered,
which is deliberate: it's how Brian can audit any student/instructor conversation, not just
the ones he personally replied to.

Feedback and question flags escalate exactly one level: a student's submission is visible to
instructors (and admin), an instructor's own submission skips the instructor queue and goes
to admin only, so instructors never see each other's escalations.

Only one school exists today (seeded by the migration), but `schools` and `profiles.school_id`
/ `beta_codes.school_id` are already wired up, on purpose: retrofitting school scoping onto
tables full of real student data later would be a much riskier migration than building it in
now while nothing's live. There's no admin UI for multi-school yet, that's still worth
building once a second real school shows up.

**Brian's own admin access is permanent, not just database state.** `lib/roles.ts`
checks `ADMIN_EMAIL` on every request and forces `role` to `'admin'` for a matching
signed-in email regardless of what `profiles.role` says in the database. `profiles.role`
is set to `'admin'` for that account too (belt-and-suspenders), but even if that row were
ever wrong, corrupted by a bad migration, or changed by a manual SQL mistake, the
`ADMIN_EMAIL` check still wins. The only way to actually lose this is unsetting
`ADMIN_EMAIL` in Vercel.

Role and school are set on beta-code redemption (`/api/redeem-code`), never by the user
directly — the `prevent_self_privilege_escalation` trigger in `schema.sql` blocks a signed-in
user from changing their own `role`, `school_id`, `access_type`, or `beta_code_used`, even
though the RLS policy that lets them update their own profile row has no column restriction
by itself. To generate a code for a new school's instructor or student batch:

```sql
insert into schools (name) values ('Some Other Nursing Program') returning id;
-- then, using the id returned above:
insert into beta_codes (code, grant_type, active, role, school_id) values
  ('SOMEPROGRAM-INSTRUCTOR', 'lifetime-free', true, 'instructor', '<school id>'),
  ('SOMEPROGRAM-STUDENT', 'lifetime-free', true, 'student', '<school id>');
```

A school-level package with an expiration date isn't built yet, codes just grant lifetime
access today, same as `68C-FTW`.

### Expiration and archiving

A school bought for one semester gets an `access_expires_at` date. `hasAccess()`
(`lib/access.ts`) checks it on every access-gated page load, so access ends automatically the
moment it passes -- nothing to run, nothing to remember. Archiving is a separate, manual, and
immediate override for "this ends right now regardless of any date," at either the whole-school
or single-person level. Neither one deletes anything: attempts, raised hands, everything stays
in the database untouched, so if a school renews or a person's access is restored, they pick
back up exactly where they left off. `/subscribe` explains which of these happened instead of
just showing the generic paywall, and still lets someone whose school merely expired subscribe
individually to keep going -- someone who was deliberately archived can't buy their way back in,
that has to be undone by you.

There's no admin UI for any of this yet (same reasoning as no multi-school UI: one school,
one admin, direct SQL is faster than building a page for it right now). All of these are
plain profile/school updates through the Supabase SQL editor, which bypasses RLS the same way
the service role does:

```sql
-- Set a school's semester package to expire on a date.
update schools set access_expires_at = '2026-12-20' where name = 'Some Other Nursing Program';

-- Archive a school entirely (stopped paying, program ended, etc). Locks out every student
-- and instructor at that school immediately, keeps all their data.
update schools set archived_at = now() where name = 'Some Other Nursing Program';

-- Un-archive a school (they came back).
update schools set archived_at = null where name = 'Some Other Nursing Program';

-- Archive one student or instructor without touching their whole school (removed from the
-- organization, needs pulling individually).
update profiles set archived_at = now() where id = (select id from auth.users where email = 'someone@example.com');

-- Un-archive one person.
update profiles set archived_at = null where id = (select id from auth.users where email = 'someone@example.com');
```

**Correcting a role, school, or a wrongly-redeemed code.** Role and school_id only ever
change through a service-role write (redeem-code, or a raw SQL update like these -- see the
`prevent_self_privilege_escalation` trigger in `schema.sql`), so if someone redeems the wrong
code, self-service redemption alone might not fix it. Redeeming a second, correct code
*does* self-correct `school_id` (always overwritten by whatever code was redeemed), but it
will NOT downgrade `role` -- if someone accidentally redeemed an instructor code and should be
a student, redeeming a student code afterward won't undo that, roles only ever escalate
through the redemption flow, on purpose (see `/api/redeem-code`). For that case, or removing
an instructor from an organization, fix it directly:

```sql
-- Correct someone's role and/or school directly (e.g. accidentally redeemed an instructor
-- code, or an instructor is being moved to a different school).
update profiles set role = 'student', school_id = (select id from schools where name = 'Some Other Nursing Program')
where id = (select id from auth.users where email = 'someone@example.com');

-- Fully reset a wrongly-redeemed code so someone can start over with the right one.
update profiles set beta_code_used = null, access_type = 'free-trial', role = 'student', school_id = null
where id = (select id from auth.users where email = 'someone@example.com');
```

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
`/help` page walking through every screen, per-subject progress reset, a daily
reminder cron, and in-app feedback: a general `/feedback` form plus a "Flag this
question" control on the answer breakdown screen for content-specific issues, both
reviewed by the instructor at `/admin/feedback`. Full brand styling pulled from the
LPN Launchpad logo and design packet.

New subjects need a module tag to show up under the right module on the dashboard
(they show under "Other" until tagged) — see
`supabase/migrations/20260806070000_tag_subjects_with_modules.sql`.

## What's not built yet

A profile/preferences screen and a weekly performance email.
