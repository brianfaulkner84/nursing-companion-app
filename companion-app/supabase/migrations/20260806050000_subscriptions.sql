-- Migration: subscriptions table, synced from Stripe via webhook. profiles.access_type
-- stays the simple gate pages check ('free-trial' | 'lifetime-free' | 'paid'); this table
-- holds the Stripe-sourced detail behind that flag (status, current period, price).
--
-- Additive only, no changes to existing tables besides new RLS-safe reads elsewhere. Safe
-- to run any time.

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  status text not null default 'incomplete' check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'
  )),
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index on subscriptions (stripe_customer_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = '';

create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

alter table subscriptions enable row level security;

-- Read-only for the owning user, so the account/billing screen can show status. All writes
-- happen through /api/stripe-webhook using the service role, since only Stripe's own
-- signed events should ever change subscription state, never the client directly.
create policy "read own subscription" on subscriptions for select using ((select auth.uid()) = user_id);
