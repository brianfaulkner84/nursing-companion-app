-- Lets a student archive a thread they're done with, purely on their own side, same pattern
-- as archived_by_instructor: hides it from their default Inbox view without touching the
-- data the instructor can see.

alter table raised_hands add column if not exists archived_by_student boolean not null default false;
