-- KAEC HQ: separate corporate tenant and seven-module operating foundation.
-- Deliberately no FK to school organisation records; no school user gains HQ access.
create table if not exists public.kaec_hq_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('vision_custodian','system_steward','alliance_catalyst','product_architect','movement_curator','finance_steward','team_member')),
  status text not null default 'active' check (status in ('active','suspended')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kaec_hq_members_status_role_idx on public.kaec_hq_members(status,role);

create table if not exists public.kaec_hq_records (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('governance','people','work','partnerships','products','finance')),
  record_type text not null check (char_length(record_type) between 2 and 40),
  title text not null check (char_length(btrim(title)) between 4 and 180),
  description text not null default '' check (char_length(description)<=5000),
  status text not null default 'draft' check (status in ('draft','active','in_review','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  owner_user_id uuid references public.kaec_hq_members(user_id) on delete set null,
  backup_user_id uuid references public.kaec_hq_members(user_id) on delete set null,
  due_on date,
  cadence text not null default 'once' check (cadence in ('once','daily','weekly','monthly','termly','quarterly','yearly')),
  amount numeric(14,2) check (amount is null or amount>=0),
  currency text not null default 'NGN' check (currency in ('NGN','USD','GBP','EUR')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kaec_hq_finance_amount_only check (module='finance' or amount is null),
  constraint kaec_hq_backup_separate check (backup_user_id is null or owner_user_id is distinct from backup_user_id),
  constraint kaec_hq_active_has_owner check (status not in ('active','in_review','completed') or owner_user_id is not null)
);
create index if not exists kaec_hq_records_module_updated_idx on public.kaec_hq_records(module, updated_at desc);
create index if not exists kaec_hq_records_owner_status_idx on public.kaec_hq_records(owner_user_id,status,due_on);
create index if not exists kaec_hq_records_backup_status_idx on public.kaec_hq_records(backup_user_id,status,due_on);
create index if not exists kaec_hq_records_due_idx on public.kaec_hq_records(due_on) where status in ('active','in_review');

create table if not exists public.kaec_hq_audit_events (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references public.kaec_hq_records(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  summary text not null default '',
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kaec_hq_audit_events_record_idx on public.kaec_hq_audit_events(record_id, created_at desc);
create index if not exists kaec_hq_audit_events_created_idx on public.kaec_hq_audit_events(created_at desc);

-- No browser Data API access. Verified bearer authentication + separate HQ role
-- checks in the API are compulsory. RLS remains enabled in defence in depth.
alter table public.kaec_hq_members enable row level security;
alter table public.kaec_hq_records enable row level security;
alter table public.kaec_hq_audit_events enable row level security;
revoke all on public.kaec_hq_members, public.kaec_hq_records, public.kaec_hq_audit_events from public, anon, authenticated;
grant select, insert, update on public.kaec_hq_members to service_role;
grant select, insert, update on public.kaec_hq_records to service_role;
grant select, insert on public.kaec_hq_audit_events to service_role;
comment on table public.kaec_hq_members is 'KAEC-NG corporate roles only, separate from every KHP-OS school membership.';
comment on table public.kaec_hq_records is 'Governance, People, Work, Partnerships, Products and Finance records powering seven KAEC HQ areas.';
comment on table public.kaec_hq_audit_events is 'Append-only corporate operating audit trail; never expose through browser Supabase.';
