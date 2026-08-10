-- Closes two Supabase linter warnings (anon/authenticated_security_definer_function_executable)
-- on prevent_self_privilege_escalation. It's a trigger function -- meant to fire automatically
-- on profiles updates, never meant to be called directly -- but Supabase auto-exposes every
-- public-schema function as a /rest/v1/rpc/<name> endpoint, and it was marked `security
-- definer` as a side effect of an earlier search_path fix, not because it actually needs
-- elevated privilege. It only reads NEW/OLD and calls auth.role(), neither of which needs
-- definer-level access, so switching to invoker removes the risk outright instead of just
-- gating it. The trigger keeps working either way -- Postgres doesn't check EXECUTE grants the
-- same way for a function firing as a trigger as it does for a direct call/RPC.

alter function public.prevent_self_privilege_escalation() security invoker;

-- Tightened from `public` to fully empty, matching set_updated_at's stricter pattern
-- elsewhere in this file -- the function doesn't reference anything unqualified besides
-- auth.role(), which is already schema-qualified, so there's nothing it needs `public` for.
alter function public.prevent_self_privilege_escalation() set search_path = '';

revoke execute on function public.prevent_self_privilege_escalation() from anon, authenticated;
