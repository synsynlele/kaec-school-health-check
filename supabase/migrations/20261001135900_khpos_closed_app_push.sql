-- Closed-app Web Push for KHP-OS.
-- Subscription endpoints are capability secrets and remain server-only.
create table if not exists public.khpos_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  constraint khpos_push_subscriptions_endpoint_nonempty check (length(btrim(endpoint)) >= 20),
  constraint khpos_push_subscriptions_key_nonempty check (length(btrim(p256dh)) >= 20),
  constraint khpos_push_subscriptions_auth_nonempty check (length(btrim(auth_secret)) >= 8),
  constraint khpos_push_subscriptions_org_user_endpoint_key unique (organisation_id, user_id, endpoint)
);

create index if not exists idx_khpos_push_subscriptions_active_user
  on public.khpos_push_subscriptions(user_id, organisation_id)
  where disabled_at is null;

create index if not exists idx_khpos_push_subscriptions_endpoint
  on public.khpos_push_subscriptions(endpoint);

alter table public.khpos_push_subscriptions enable row level security;
revoke all on public.khpos_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.khpos_push_subscriptions to service_role;

create table if not exists public.khpos_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.khpos_push_subscriptions(id) on delete cascade,
  alert_id text not null,
  delivered_on date not null default current_date,
  delivered_at timestamptz not null default now(),
  constraint khpos_push_deliveries_alert_nonempty check (length(btrim(alert_id)) >= 3),
  constraint khpos_push_deliveries_subscription_alert_day_key unique (subscription_id, alert_id, delivered_on)
);

create index if not exists idx_khpos_push_deliveries_subscription_day
  on public.khpos_push_deliveries(subscription_id, delivered_on desc);

alter table public.khpos_push_deliveries enable row level security;
revoke all on public.khpos_push_deliveries from public, anon, authenticated;
grant select, insert, delete on public.khpos_push_deliveries to service_role;

comment on table public.khpos_push_subscriptions is
  'Server-only Web Push subscriptions for KHP-OS. Endpoint URLs are capability secrets and must never be exposed through browser database access.';

comment on table public.khpos_push_deliveries is
  'Daily deduplication ledger for KHP-OS device push alerts.';
