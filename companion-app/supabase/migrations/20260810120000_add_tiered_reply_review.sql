-- Capstone build: tiered AI reply review. See LPN Launchpad Capstone design summary
-- (MNGT 745, Week 6) for the full design. This migration adds the schema for three pieces:
-- a per-reply audit trail, a per-subject trust ledger, and a per-question content hold state.
--
-- Deferred from this migration, on purpose: the source-tier/recency verification fields.
-- The grounded/extends check alone gates auto-send for this build; source verification is a
-- separate, scoped fast-follow, not redesigned here, just not yet built.

-- One row per AI-drafted raised-hand reply. subject is denormalized from questions.subject at
-- write time (same snapshot pattern raised_hands already uses for strategy/rationale), so the
-- category trust ladder can roll up by subject without joining back through questions on every
-- read.
create table reply_audits (
  id uuid primary key default gen_random_uuid(),
  raised_hand_id uuid not null references raised_hands(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  subject text not null,
  tier text not null check (tier in ('hold', 'high', 'low')),
  grounded boolean not null,
  confidence_score smallint not null check (confidence_score between 1 and 5),
  confidence_reason text not null,
  was_corrected boolean not null default false,
  correction_text text,
  corrected_by uuid references auth.users(id),
  -- Null until admin marks this sent reply as clean or corrects it, from the Sent, Needs Review
  -- queue. That single action both clears the item from the queue and drives the category trust
  -- ladder update (see lib/tier.ts nextCategoryTier). Always null for a hold-tier row, since
  -- those go through the ordinary approve-and-send flow instead, not this queue.
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index reply_audits_question_id_idx on reply_audits (question_id);
create index reply_audits_subject_idx on reply_audits (subject);
create index reply_audits_reviewed_at_idx on reply_audits (reviewed_at);

-- Internal audit data, never meant for a student's own view and not something instructors query
-- directly either -- every read and write goes through a service-role API route. RLS enabled
-- with no policies at all is a deliberate lockout, the same pattern beta_codes already uses,
-- not an oversight.
alter table reply_audits enable row level security;

-- One row per subject. Starts empty; every subject defaults to hold (see the tier-decision
-- logic in /api/raise-hand) until it earns its way down through consecutive clean reviews.
create table category_trust (
  subject text primary key,
  consecutive_clean_count integer not null default 0,
  current_tier text not null default 'hold' check (current_tier in ('hold', 'high', 'low')),
  updated_at timestamptz not null default now()
);

alter table category_trust enable row level security;

-- content_status is the per-question circuit breaker: once a question crosses two open
-- question_flags, this flips away from 'live' and the question stops being served in quizzes,
-- review sessions, and exams until it's resolved. flag_classification records how a reviewer
-- (instructor, school_admin, or admin) classified the flag; only admin can actually resolve a
-- hold (rewrite, remove, or unflag back to live), enforced in the API route, not in SQL.
alter table questions add column content_status text not null default 'live'
  check (content_status in ('live', 'needs_rewrite', 'needs_removal'));
alter table questions add column flag_classification text
  check (flag_classification in ('accurate', 'needs_rewrite', 'needs_removal'));

create index questions_content_status_idx on questions (content_status);

-- Set when a student flags an AI-auto-sent reply as wrong via "Flag This Reply." Null means not
-- escalated. Only meaningful on a thread whose reply was auto-sent (tier high/low in
-- reply_audits) -- a held reply already requires a human before it ever reaches the student, so
-- there's nothing for the student to escalate on that path.
alter table raised_hands add column escalated_at timestamptz;
