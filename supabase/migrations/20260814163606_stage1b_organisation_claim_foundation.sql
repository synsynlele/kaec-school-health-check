create extension if not exists pgcrypto;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  organisation_type text not null default 'school',
  country text,
  state text,
  city text,
  school_type text,
  school_level text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  source_school_snapshot_id uuid references public.schools(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('executive','transformation_lead','functional_owner','contributor','reviewer','observer')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create table if not exists public.khpos_audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  object_type text,
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.assessments add column if not exists organisation_id uuid references public.organisations(id) on delete set null;
alter table public.assessments add column if not exists framework_id text not null default 'kshc';
alter table public.assessments add column if not exists framework_version text not null default '1.0';
alter table public.assessments add column if not exists scoring_version text not null default '1.0';
alter table public.assessments add column if not exists status text not null default 'in_progress';
alter table public.assessments add column if not exists completed_at timestamptz;
alter table public.assessments add column if not exists overall_score integer;
alter table public.assessments add column if not exists health_rating text;
alter table public.assessments add column if not exists priority_area text;
alter table public.assessments add column if not exists claimed_at timestamptz;
alter table public.assessments add column if not exists claimed_by uuid references auth.users(id) on delete set null;

alter table public.reports add column if not exists report_schema_version integer not null default 1;
alter table public.reports add column if not exists scoring_version text not null default '1.0';
alter table public.reports add column if not exists prompt_version text not null default '1.0';
alter table public.reports add column if not exists ai_provider text;
alter table public.reports add column if not exists ai_model text;
alter table public.reports add column if not exists generation_status text not null default 'complete';

update public.assessments a
set
  status = 'completed',
  completed_at = coalesce(a.completed_at, r.created_at at time zone 'UTC'),
  overall_score = coalesce(a.overall_score, nullif(r.full_report->>'overallScore','')::integer, r.overall_score::integer),
  health_rating = coalesce(a.health_rating, r.full_report->>'healthRating', r.readiness_level),
  priority_area = coalesce(a.priority_area, r.full_report->>'priorityArea')
from public.reports r
where r.assessment_id = a.id;

update public.reports
set
  report_schema_version = coalesce(nullif(full_report->>'schemaVersion','')::integer, report_schema_version, 1),
  ai_provider = coalesce(ai_provider, case when full_report->>'engine' = 'openai' then 'openai' when full_report->>'engine' = 'engine' then 'deterministic' else null end),
  generation_status = coalesce(generation_status, 'complete');

create index if not exists idx_assessments_organisation on public.assessments (organisation_id);
create index if not exists idx_memberships_user on public.organisation_memberships (user_id);
create index if not exists idx_memberships_org on public.organisation_memberships (organisation_id);
create index if not exists idx_audit_events_org_created on public.khpos_audit_events (organisation_id, created_at desc);

alter table public.organisations enable row level security;
alter table public.organisation_memberships enable row level security;
alter table public.khpos_audit_events enable row level security;

revoke all privileges on table public.organisations from anon, authenticated;
revoke all privileges on table public.organisation_memberships from anon, authenticated;
revoke all privileges on table public.khpos_audit_events from anon, authenticated;
grant select, update on table public.organisations to authenticated;
grant select on table public.organisation_memberships to authenticated;
grant select on table public.khpos_audit_events to authenticated;
grant select on table public.assessments, public.answers, public.reports to authenticated;

create or replace function public.khpos_is_org_member(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organisation_memberships m
    where m.organisation_id = p_organisation_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.khpos_has_org_role(p_organisation_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organisation_memberships m
    where m.organisation_id = p_organisation_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
  );
$$;

create or replace function public.khpos_is_assessment_member(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.assessments a
    join public.organisation_memberships m on m.organisation_id = a.organisation_id
    where a.id = p_assessment_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

revoke all on function public.khpos_is_org_member(uuid) from public;
revoke all on function public.khpos_has_org_role(uuid, text[]) from public;
revoke all on function public.khpos_is_assessment_member(uuid) from public;
grant execute on function public.khpos_is_org_member(uuid) to authenticated;
grant execute on function public.khpos_has_org_role(uuid, text[]) to authenticated;
grant execute on function public.khpos_is_assessment_member(uuid) to authenticated;

create policy organisations_member_select
on public.organisations for select
to authenticated
using (public.khpos_is_org_member(id));

create policy organisations_lead_update
on public.organisations for update
to authenticated
using (public.khpos_has_org_role(id, array['executive','transformation_lead']))
with check (public.khpos_has_org_role(id, array['executive','transformation_lead']));

create policy memberships_member_select
on public.organisation_memberships for select
to authenticated
using (public.khpos_is_org_member(organisation_id));

create policy audit_member_select
on public.khpos_audit_events for select
to authenticated
using (public.khpos_is_org_member(organisation_id));

create policy assessments_org_member_select
on public.assessments for select
to authenticated
using (organisation_id is not null and public.khpos_is_org_member(organisation_id));

create policy answers_org_member_select
on public.answers for select
to authenticated
using (public.khpos_is_assessment_member(assessment_id));

create policy reports_org_member_select
on public.reports for select
to authenticated
using (public.khpos_is_assessment_member(assessment_id));

create or replace function public.claim_kshc_assessment(p_assessment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_assessment public.assessments%rowtype;
  v_school public.schools%rowtype;
  v_organisation_id uuid;
begin
  if v_user_id is null or v_auth_email = '' then
    raise exception 'Authentication with a verified email is required.';
  end if;

  select * into v_assessment
  from public.assessments
  where id = p_assessment_id
  for update;

  if not found then
    raise exception 'Assessment not found.';
  end if;

  if not exists (select 1 from public.reports r where r.assessment_id = p_assessment_id) then
    raise exception 'Assessment must have a completed report before activation.';
  end if;

  select * into v_school
  from public.schools s
  where s.id::text = v_assessment.school_id;

  if not found then
    raise exception 'School snapshot not found.';
  end if;

  if lower(trim(v_school.email)) <> v_auth_email then
    raise exception 'The signed-in email does not match the email used for this assessment.';
  end if;

  if v_assessment.organisation_id is not null then
    v_organisation_id := v_assessment.organisation_id;
  else
    select o.id into v_organisation_id
    from public.organisations o
    join public.organisation_memberships m on m.organisation_id = o.id
    where m.user_id = v_user_id
      and m.status = 'active'
      and lower(trim(o.name)) = lower(trim(v_school.school_name))
    order by o.created_at asc
    limit 1;

    if v_organisation_id is null then
      insert into public.organisations (
        name, organisation_type, country, state, school_type, school_level,
        source_school_snapshot_id, created_by
      ) values (
        v_school.school_name, 'school', v_school.country, v_school.state,
        v_school.school_type, v_school.school_level, v_school.id, v_user_id
      ) returning id into v_organisation_id;
    end if;

    update public.assessments
    set organisation_id = v_organisation_id,
        claimed_at = now(),
        claimed_by = v_user_id
    where id = p_assessment_id;
  end if;

  insert into public.organisation_memberships (organisation_id, user_id, role, status)
  values (v_organisation_id, v_user_id, 'executive', 'active')
  on conflict (organisation_id, user_id)
  do update set status = 'active', updated_at = now();

  insert into public.khpos_audit_events (
    organisation_id, actor_user_id, event_type, object_type, object_id, metadata
  ) values (
    v_organisation_id, v_user_id, 'assessment_claimed', 'assessment', p_assessment_id,
    jsonb_build_object('source','kshc','framework_version',v_assessment.framework_version)
  );

  return v_organisation_id;
end;
$$;

revoke all on function public.claim_kshc_assessment(uuid) from public;
grant execute on function public.claim_kshc_assessment(uuid) to authenticated;

comment on table public.organisations is 'Canonical KHP-OS institution identity. KSHC school rows remain diagnostic snapshots.';
comment on table public.organisation_memberships is 'Institution-scoped KHP-OS user authority; roles belong to membership, not to the global user.';
comment on function public.claim_kshc_assessment(uuid) is 'Atomically activates a completed KSHC assessment into KHP-OS when the authenticated email matches the assessment contact email.';
