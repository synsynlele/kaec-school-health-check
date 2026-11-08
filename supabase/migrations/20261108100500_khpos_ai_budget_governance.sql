-- AI spending is optional. Ordinary KHP-OS workflows must keep working if quota is unavailable.
-- Server-only ledger; no raw prompts, learner information, or school records are stored here.
create table if not exists public.khpos_ai_usage_months (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  month_start date not null,
  spent_micro_usd bigint not null default 0 check (spent_micro_usd >= 0),
  reserved_micro_usd bigint not null default 0 check (reserved_micro_usd >= 0),
  updated_at timestamptz not null default now(),
  primary key (organisation_id, month_start)
);

create table if not exists public.khpos_ai_usage_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  actor_user_id uuid,
  month_start date not null,
  feature text not null check (feature in ('ask','briefing','meeting','improvement','review','network')),
  status text not null default 'reserved' check (status in ('reserved','settled','failed')),
  reserved_micro_usd bigint not null check (reserved_micro_usd >= 0),
  actual_micro_usd bigint not null default 0 check (actual_micro_usd >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  model text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists khpos_ai_usage_requests_month_idx
  on public.khpos_ai_usage_requests (organisation_id, month_start, created_at desc);

alter table public.khpos_ai_usage_months enable row level security;
alter table public.khpos_ai_usage_requests enable row level security;
revoke all on public.khpos_ai_usage_months from public, anon, authenticated;
revoke all on public.khpos_ai_usage_requests from public, anon, authenticated;
grant select, insert, update on public.khpos_ai_usage_months to service_role;
grant select, insert, update on public.khpos_ai_usage_requests to service_role;

-- Atomic reservation prevents concurrent API requests from exceeding the configured cap.
-- Only the trusted server's service-role credentials can execute this RPC.
create or replace function public.khpos_ai_budget_reserve(
  p_org uuid,
  p_actor uuid,
  p_feature text,
  p_estimate_micro_usd bigint,
  p_limit_micro_usd bigint
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_spent bigint;
  v_reserved bigint;
  v_id uuid;
begin
  if p_org is null
     or p_feature not in ('ask','briefing','meeting','improvement','review','network')
     or p_estimate_micro_usd is null or p_estimate_micro_usd <= 0
     or p_limit_micro_usd is null or p_limit_micro_usd <= 0 then
    return null;
  end if;

  insert into public.khpos_ai_usage_months (organisation_id, month_start)
    values (p_org, v_month)
    on conflict do nothing;

  select spent_micro_usd, reserved_micro_usd
    into v_spent, v_reserved
    from public.khpos_ai_usage_months
   where organisation_id = p_org and month_start = v_month
   for update;

  if v_spent + v_reserved + p_estimate_micro_usd > p_limit_micro_usd then
    return null;
  end if;

  insert into public.khpos_ai_usage_requests
    (organisation_id, actor_user_id, month_start, feature, reserved_micro_usd)
    values (p_org, p_actor, v_month, p_feature, p_estimate_micro_usd)
    returning id into v_id;

  update public.khpos_ai_usage_months
     set reserved_micro_usd = reserved_micro_usd + p_estimate_micro_usd,
         updated_at = now()
   where organisation_id = p_org and month_start = v_month;

  return v_id;
end;
$$;

-- Settlement is idempotent. Failed requests return their reservation to the monthly allowance.
create or replace function public.khpos_ai_budget_settle(
  p_reservation uuid,
  p_actual_micro_usd bigint,
  p_input_tokens integer,
  p_output_tokens integer,
  p_model text,
  p_success boolean
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_month date;
  v_reserved bigint;
  v_status text;
begin
  if p_reservation is null or p_actual_micro_usd is null
     or p_actual_micro_usd < 0 or p_input_tokens is null
     or p_input_tokens < 0 or p_output_tokens is null or p_output_tokens < 0 then
    return false;
  end if;

  select organisation_id, month_start into v_org, v_month
    from public.khpos_ai_usage_requests where id = p_reservation;
  if not found then return false; end if;

  perform 1 from public.khpos_ai_usage_months
    where organisation_id = v_org and month_start = v_month for update;
  select reserved_micro_usd, status into v_reserved, v_status
    from public.khpos_ai_usage_requests where id = p_reservation for update;

  if v_status <> 'reserved' then return false; end if;

  update public.khpos_ai_usage_months
     set reserved_micro_usd = greatest(0, reserved_micro_usd - v_reserved),
         spent_micro_usd = spent_micro_usd + p_actual_micro_usd,
         updated_at = now()
   where organisation_id = v_org and month_start = v_month;

  update public.khpos_ai_usage_requests
     set actual_micro_usd = p_actual_micro_usd,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         model = left(p_model, 120),
         status = case when p_success then 'settled' else 'failed' end,
         settled_at = now()
   where id = p_reservation;
  return true;
end;
$$;

revoke all on function public.khpos_ai_budget_reserve(uuid, uuid, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.khpos_ai_budget_settle(uuid, bigint, integer, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.khpos_ai_budget_reserve(uuid, uuid, text, bigint, bigint) to service_role;
grant execute on function public.khpos_ai_budget_settle(uuid, bigint, integer, integer, text, boolean) to service_role;
