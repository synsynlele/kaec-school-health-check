-- KAEC HQ: corporate-only partner execution register and accountable School Pathfinders.
-- No school-private records are copied. All access is through verified HQ bearer API.
alter table public.kaec_hq_members drop constraint if exists kaec_hq_members_role_check;
alter table public.kaec_hq_members add constraint kaec_hq_members_role_check
  check (role in ('vision_custodian','system_steward','alliance_catalyst',
    'product_architect','movement_curator','finance_steward','team_member','school_pathfinder'));

create table if not exists public.kaec_hq_school_engagements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete restrict,
  engagement_status text not null default 'setup' check (engagement_status in ('setup','active','paused','ended')),
  agreement_reference text not null default '' check (char_length(agreement_reference)<=240),
  agreed_scope text not null default '' check (char_length(agreed_scope)<=3000),
  contract_verified_at timestamptz,
  contract_verified_by uuid references auth.users(id),
  representative_user_id uuid references public.kaec_hq_members(user_id) on delete set null,
  school_liaison text not null default '' check (char_length(school_liaison)<=140),
  next_virtual_check_on date,
  next_site_visit_on date,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kaec_hq_school_active_guard check
   (engagement_status<>'active' or
    (contract_verified_at is not null and contract_verified_by is not null and
     length(trim(agreement_reference))>=6 and length(trim(agreed_scope))>=20 and
     representative_user_id is not null))
);
create index if not exists kaec_hq_school_rep_idx on public.kaec_hq_school_engagements(representative_user_id,engagement_status);

create table if not exists public.kaec_hq_school_commitments (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.kaec_hq_school_engagements(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 4 and 180),
  agreed_expectation text not null check (char_length(trim(agreed_expectation)) between 15 and 3000),
  agreement_clause text not null check (char_length(trim(agreement_clause)) between 4 and 200),
  evidence_expected text not null check (char_length(trim(evidence_expected)) between 8 and 800),
  status text not null default 'planned' check (status in
     ('planned','in_progress','blocked','evidence_submitted','verified','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  due_on date,
  next_followup_on date,
  followup_mode text not null default 'virtual' check (followup_mode in ('virtual','onsite')),
  progress_note text not null default '' check (char_length(progress_note)<=3000),
  evidence_reference text not null default '' check (char_length(evidence_reference)<=700),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kaec_hq_school_verified_guard check
    (status <> 'verified' or (verified_by is not null and verified_at is not null))
);
create index if not exists kaec_hq_school_commitments_due_idx on public.kaec_hq_school_commitments(status,due_on,next_followup_on);
create index if not exists kaec_hq_school_commitments_engagement_idx on public.kaec_hq_school_commitments(engagement_id,status);

create table if not exists public.kaec_hq_school_followups (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.kaec_hq_school_commitments(id) on delete restrict,
  mode text not null check(mode in ('phone','whatsapp','video','email','site_visit')),
  outcome text not null check(char_length(trim(outcome)) between 15 and 3000),
  evidence_reference text not null default '' check(char_length(evidence_reference)<=700),
  next_followup_on date,
  next_visit_on date,
  recorded_by uuid not null references auth.users(id),
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists kaec_hq_school_followups_commitment_idx on public.kaec_hq_school_followups(commitment_id,created_at desc);

create table if not exists public.kaec_hq_school_events (
  id uuid primary key default gen_random_uuid(),
  entity_kind text not null,
  entity_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kaec_hq_school_events_entity_idx on public.kaec_hq_school_events(entity_kind,entity_id,created_at desc);

alter table public.kaec_hq_school_engagements enable row level security;
alter table public.kaec_hq_school_commitments enable row level security;
alter table public.kaec_hq_school_followups enable row level security;
alter table public.kaec_hq_school_events enable row level security;
revoke all on public.kaec_hq_school_engagements,public.kaec_hq_school_commitments,
  public.kaec_hq_school_followups,public.kaec_hq_school_events from public,anon,authenticated;
grant select,insert,update on public.kaec_hq_school_engagements, public.kaec_hq_school_commitments to service_role;
grant select,insert on public.kaec_hq_school_followups, public.kaec_hq_school_events to service_role;

create or replace function public.kaec_hq_audit_school_execution()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare actor uuid;
begin
 actor:=case when tg_table_name='kaec_hq_school_followups'
             then (to_jsonb(new)->>'recorded_by')::uuid
             else (to_jsonb(new)->>'updated_by')::uuid end;
 insert into public.kaec_hq_school_events(entity_kind,entity_id,actor_user_id,action,before_state,after_state)
 values (tg_table_name,new.id,actor,lower(tg_op),
   case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;
$$;
drop trigger if exists kaec_hq_audit_school_engagement on public.kaec_hq_school_engagements;
create trigger kaec_hq_audit_school_engagement after insert or update on public.kaec_hq_school_engagements
 for each row execute function public.kaec_hq_audit_school_execution();
drop trigger if exists kaec_hq_audit_school_commitment on public.kaec_hq_school_commitments;
create trigger kaec_hq_audit_school_commitment after insert or update on public.kaec_hq_school_commitments
 for each row execute function public.kaec_hq_audit_school_execution();
drop trigger if exists kaec_hq_audit_school_followup on public.kaec_hq_school_followups;
create trigger kaec_hq_audit_school_followup after insert on public.kaec_hq_school_followups
 for each row execute function public.kaec_hq_audit_school_execution();
revoke all on function public.kaec_hq_audit_school_execution() from public,anon,authenticated;

comment on table public.kaec_hq_school_engagements is 'Corporate agreement oversight only: no direct school KHP-OS access or implicit signed contract.';
comment on table public.kaec_hq_school_commitments is 'Agreed school transformation outputs, due dates, evidence and independent verification.';
comment on table public.kaec_hq_school_followups is 'Append-only virtual-first and site-visit supervision notes; do not include student personal data.';
comment on table public.kaec_hq_school_events is 'Database-atomic append-only corporate school oversight audit history.';
