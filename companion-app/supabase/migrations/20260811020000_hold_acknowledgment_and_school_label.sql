-- Two additions to the raised-hand thread flow, both about what the student sees while
-- waiting: (1) a canned acknowledgment message so a held thread isn't total silence until an
-- instructor reviews it, and (2) enough info to tell the student apart a reply from their own
-- school's instructor versus a general LPN Launchpad instructor (which covers AI auto-sent
-- replies, the acknowledgment itself, and any admin/instructor replying outside their own
-- school -- admin can answer any school's threads, see app/admin/inbox/page.tsx).

alter table raised_hand_messages add column if not exists is_acknowledgment boolean not null default false;
