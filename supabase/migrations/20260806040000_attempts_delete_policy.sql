-- Migration: lets a student delete their own attempts, needed for the "reset my progress
-- for this subject" button on /progress. Scoped to their own rows only, same as the
-- existing read/insert policies on attempts; nobody can touch another user's attempts, and
-- nothing here touches the questions themselves.
create policy "delete own attempts" on attempts for delete using ((select auth.uid()) = user_id);
