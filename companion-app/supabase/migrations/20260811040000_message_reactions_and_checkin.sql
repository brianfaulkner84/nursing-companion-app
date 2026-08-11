-- Student reaction (thumbs up/down) on a specific sent reply, replacing the old thread-level
-- "Flag This Reply" button with a lighter, per-message signal that works on human replies too,
-- not just AI auto-sent ones. A down reaction escalates the thread the same way Flag used to
-- (see app/api/raised-hand-messages/[id]/react/route.ts); the old escalated_at column and its
-- meaning are unchanged, only what sets it changed.
alter table raised_hand_messages add column if not exists reaction text check (reaction in ('up', 'down'));

-- A status message the app sends itself, asking a student whether they're actually seeing
-- replies, once they've received several with zero reaction of any kind. This is the answer to
-- "if a thread silently never reached a student, how would I ever know" -- see the engagement
-- sweep in app/api/cron/raised-hand-reminder/route.ts. Distinct from is_acknowledgment (the hold
-- placeholder) so the UI never attaches reaction controls or the AI disclosure to it, and so the
-- sweep can tell "already asked this student" from "never asked" without re-sending it forever.
alter table raised_hand_messages add column if not exists is_checkin boolean not null default false;
