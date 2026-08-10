-- Supports the new in-app Inbox: when an instructor sends a reply (see
-- /api/raised-hands/[id]/respond), we stamp when it happened so the student's Inbox can show
-- "Answered 2 days ago" instead of just the original raised-hand date.

alter table raised_hands add column if not exists answered_at timestamptz;
