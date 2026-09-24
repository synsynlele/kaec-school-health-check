create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_policies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  name text not null,
  operating_system text not null,
  owner_label text not null,
  priority text not null check (priority in ('C0','C1','C2')),
  status text not null default 'registered' check (status in ('registered','active','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table if not exists public.khpos_ops_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.khpos_ops_policies(id) on delete cascade,
  version integer not null check (version > 0),
  purpose text not null,
  scope text not null,
  principles jsonb not null default '[]'::jsonb check (jsonb_typeof(principles)='array'),
  policy_statements jsonb not null default '[]'::jsonb check (jsonb_typeof(policy_statements)='array'),
  roles_responsibilities jsonb not null default '[]'::jsonb check (jsonb_typeof(roles_responsibilities)='array'),
  rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules)='array'),
  exceptions jsonb not null default '[]'::jsonb check (jsonb_typeof(exceptions)='array'),
  escalation jsonb not null default '[]'::jsonb check (jsonb_typeof(escalation)='array'),
  records_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(records_evidence)='array'),
  effective_date date,
  review_date date,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','superseded','archived')),
  created_at timestamptz not null default now(),
  unique (policy_id, version)
);

create table if not exists public.khpos_ops_policy_roles (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.khpos_ops_policies(id) on delete cascade,
  role_id uuid not null references public.khpos_ops_roles(id) on delete cascade,
  requirement_type text not null default 'reference'
    check (requirement_type in ('mandatory','reference')),
  created_at timestamptz not null default now(),
  unique (policy_id, role_id)
);

create table if not exists public.khpos_ops_policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  policy_version_id uuid not null references public.khpos_ops_policy_versions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (policy_version_id, user_id)
);

create table if not exists public.khpos_ops_processes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  title text not null,
  operating_system text not null,
  owner_label text not null,
  criticality text not null check (criticality in ('P0','P1','P2')),
  governing_policy_codes text[] not null default '{}'::text[],
  technology text[] not null default '{}'::text[],
  status text not null default 'registered' check (status in ('registered','active','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table if not exists public.khpos_ops_process_versions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.khpos_ops_processes(id) on delete cascade,
  version integer not null check (version > 0),
  purpose text not null,
  trigger text not null,
  inputs jsonb not null default '[]'::jsonb check (jsonb_typeof(inputs)='array'),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps)='array'),
  sla text,
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence)='array'),
  expected_outcome text not null,
  exception_conditions jsonb not null default '[]'::jsonb check (jsonb_typeof(exception_conditions)='array'),
  escalation jsonb not null default '[]'::jsonb check (jsonb_typeof(escalation)='array'),
  kpis jsonb not null default '[]'::jsonb check (jsonb_typeof(kpis)='array'),
  effective_date date,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','superseded','archived')),
  created_at timestamptz not null default now(),
  unique (process_id, version)
);

create table if not exists public.khpos_ops_process_roles (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.khpos_ops_processes(id) on delete cascade,
  role_id uuid not null references public.khpos_ops_roles(id) on delete cascade,
  participation text not null
    check (participation in ('owner','approver','participant','consulted','informed')),
  created_at timestamptz not null default now(),
  unique (process_id, role_id, participation)
);

create table if not exists public.khpos_ops_tool_templates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  name text not null,
  tool_type text not null,
  purpose text not null,
  schema_definition jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create unique index if not exists uq_khpos_ops_policy_version_active
  on public.khpos_ops_policy_versions(policy_id)
  where status='active';
create unique index if not exists uq_khpos_ops_process_version_active
  on public.khpos_ops_process_versions(process_id)
  where status='active';

create index if not exists idx_khpos_ops_policies_org_system
  on public.khpos_ops_policies(organisation_id, operating_system, priority);
create index if not exists idx_khpos_ops_policy_versions_policy
  on public.khpos_ops_policy_versions(policy_id, version desc);
create index if not exists idx_khpos_ops_policy_versions_approved_by
  on public.khpos_ops_policy_versions(approved_by) where approved_by is not null;
create index if not exists idx_khpos_ops_policy_roles_role
  on public.khpos_ops_policy_roles(role_id, requirement_type);
create index if not exists idx_khpos_ops_policy_ack_user
  on public.khpos_ops_policy_acknowledgements(user_id, acknowledged_at desc);
create index if not exists idx_khpos_ops_policy_ack_org
  on public.khpos_ops_policy_acknowledgements(organisation_id, acknowledged_at desc);

create index if not exists idx_khpos_ops_processes_org_system
  on public.khpos_ops_processes(organisation_id, operating_system, criticality);
create index if not exists idx_khpos_ops_process_versions_process
  on public.khpos_ops_process_versions(process_id, version desc);
create index if not exists idx_khpos_ops_process_versions_approved_by
  on public.khpos_ops_process_versions(approved_by) where approved_by is not null;
create index if not exists idx_khpos_ops_process_roles_role
  on public.khpos_ops_process_roles(role_id, participation);
create index if not exists idx_khpos_ops_tools_org_type
  on public.khpos_ops_tool_templates(organisation_id, tool_type, status);

create or replace function public.khpos_ops_guard_policy_version_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then
      raise exception 'Approved policy versions are immutable.';
    end if;
    return old;
  end if;

  if old.status='draft' then
    return new;
  end if;

  if old.status='active'
     and new.status='superseded'
     and new.policy_id=old.policy_id
     and new.version=old.version
     and new.purpose=old.purpose
     and new.scope=old.scope
     and new.principles=old.principles
     and new.policy_statements=old.policy_statements
     and new.roles_responsibilities=old.roles_responsibilities
     and new.rules=old.rules
     and new.exceptions=old.exceptions
     and new.escalation=old.escalation
     and new.records_evidence=old.records_evidence
     and new.effective_date is not distinct from old.effective_date
     and new.review_date is not distinct from old.review_date
     and new.approved_by is not distinct from old.approved_by
     and new.approved_at is not distinct from old.approved_at
  then
    return new;
  end if;

  raise exception 'Approved policy versions are immutable; publish a new version instead.';
end;
$$;

drop trigger if exists trg_khpos_ops_guard_policy_version_mutation
  on public.khpos_ops_policy_versions;
create trigger trg_khpos_ops_guard_policy_version_mutation
before update or delete on public.khpos_ops_policy_versions
for each row execute function public.khpos_ops_guard_policy_version_mutation();

create or replace function public.khpos_ops_guard_process_version_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then
      raise exception 'Approved process versions are immutable.';
    end if;
    return old;
  end if;

  if old.status='draft' then
    return new;
  end if;

  if old.status='active'
     and new.status='superseded'
     and new.process_id=old.process_id
     and new.version=old.version
     and new.purpose=old.purpose
     and new.trigger=old.trigger
     and new.inputs=old.inputs
     and new.steps=old.steps
     and new.sla is not distinct from old.sla
     and new.evidence=old.evidence
     and new.expected_outcome=old.expected_outcome
     and new.exception_conditions=old.exception_conditions
     and new.escalation=old.escalation
     and new.kpis=old.kpis
     and new.effective_date is not distinct from old.effective_date
     and new.approved_by is not distinct from old.approved_by
     and new.approved_at is not distinct from old.approved_at
  then
    return new;
  end if;

  raise exception 'Approved process versions are immutable; publish a new version instead.';
end;
$$;

drop trigger if exists trg_khpos_ops_guard_process_version_mutation
  on public.khpos_ops_process_versions;
create trigger trg_khpos_ops_guard_process_version_mutation
before update or delete on public.khpos_ops_process_versions
for each row execute function public.khpos_ops_guard_process_version_mutation();

alter table public.khpos_ops_policies enable row level security;
alter table public.khpos_ops_policy_versions enable row level security;
alter table public.khpos_ops_policy_roles enable row level security;
alter table public.khpos_ops_policy_acknowledgements enable row level security;
alter table public.khpos_ops_processes enable row level security;
alter table public.khpos_ops_process_versions enable row level security;
alter table public.khpos_ops_process_roles enable row level security;
alter table public.khpos_ops_tool_templates enable row level security;

revoke all privileges on table public.khpos_ops_policies from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_policy_versions from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_policy_roles from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_policy_acknowledgements from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_processes from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_process_versions from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_process_roles from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_tool_templates from public, anon, authenticated;

grant select,insert,update,delete on table public.khpos_ops_policies to service_role;
grant select,insert,update,delete on table public.khpos_ops_policy_versions to service_role;
grant select,insert,update,delete on table public.khpos_ops_policy_roles to service_role;
grant select,insert,update,delete on table public.khpos_ops_policy_acknowledgements to service_role;
grant select,insert,update,delete on table public.khpos_ops_processes to service_role;
grant select,insert,update,delete on table public.khpos_ops_process_versions to service_role;
grant select,insert,update,delete on table public.khpos_ops_process_roles to service_role;
grant select,insert,update,delete on table public.khpos_ops_tool_templates to service_role;

create or replace function public.khpos_ops_get_library_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_membership_role text;
  v_organisation_name text;
  v_role_codes text[] := '{}'::text[];
  v_policies jsonb := '[]'::jsonb;
  v_processes jsonb := '[]'::jsonb;
  v_tools jsonb := '[]'::jsonb;
  v_policy_count integer := 0;
  v_active_policy_count integer := 0;
  v_required_policy_count integer := 0;
  v_unacknowledged_count integer := 0;
  v_process_count integer := 0;
  v_active_process_count integer := 0;
begin
  select m.role,o.name
  into v_membership_role,v_organisation_name
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_membership_role is null then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select coalesce(array_agg(distinct r.code order by r.code),'{}'::text[])
  into v_role_codes
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.user_id=p_actor_user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.status='active';

  select count(*) into v_policy_count
  from public.khpos_ops_policies p
  where p.organisation_id=p_organisation_id and p.status <> 'retired';

  select count(*) into v_active_policy_count
  from public.khpos_ops_policies p
  where p.organisation_id=p_organisation_id
    and exists (
      select 1 from public.khpos_ops_policy_versions pv
      where pv.policy_id=p.id and pv.status='active'
    );

  select count(distinct p.id) into v_required_policy_count
  from public.khpos_ops_policies p
  join public.khpos_ops_policy_roles pr on pr.policy_id=p.id and pr.requirement_type='mandatory'
  join public.khpos_ops_roles r on r.id=pr.role_id
  join public.khpos_ops_role_assignments a on a.role_id=r.id
  where p.organisation_id=p_organisation_id
    and a.user_id=p_actor_user_id
    and a.status='active'
    and p.status <> 'retired';

  select count(distinct p.id) into v_unacknowledged_count
  from public.khpos_ops_policies p
  join public.khpos_ops_policy_roles pr on pr.policy_id=p.id and pr.requirement_type='mandatory'
  join public.khpos_ops_roles r on r.id=pr.role_id
  join public.khpos_ops_role_assignments a on a.role_id=r.id
  join public.khpos_ops_policy_versions pv on pv.policy_id=p.id and pv.status='active'
  where p.organisation_id=p_organisation_id
    and a.user_id=p_actor_user_id
    and a.status='active'
    and not exists (
      select 1 from public.khpos_ops_policy_acknowledgements pa
      where pa.policy_version_id=pv.id and pa.user_id=p_actor_user_id
    );

  select coalesce(jsonb_agg(item order by priority,code),'[]'::jsonb)
  into v_policies
  from (
    select
      p.priority,
      p.code,
      jsonb_build_object(
        'id',p.id,
        'code',p.code,
        'name',p.name,
        'operatingSystem',p.operating_system,
        'ownerLabel',p.owner_label,
        'priority',p.priority,
        'status',p.status,
        'requiredForMyRole',exists(
          select 1
          from public.khpos_ops_policy_roles pr
          join public.khpos_ops_roles r on r.id=pr.role_id
          join public.khpos_ops_role_assignments a on a.role_id=r.id
          where pr.policy_id=p.id
            and pr.requirement_type='mandatory'
            and a.user_id=p_actor_user_id
            and a.status='active'
        ),
        'acknowledgementRequired',exists(
          select 1
          from public.khpos_ops_policy_roles pr
          join public.khpos_ops_roles r on r.id=pr.role_id
          join public.khpos_ops_role_assignments a on a.role_id=r.id
          where pr.policy_id=p.id
            and pr.requirement_type='mandatory'
            and a.user_id=p_actor_user_id
            and a.status='active'
        ),
        'acknowledgedAt',case when pv.id is null then null else (
          select pa.acknowledged_at
          from public.khpos_ops_policy_acknowledgements pa
          where pa.policy_version_id=pv.id and pa.user_id=p_actor_user_id
          limit 1
        ) end,
        'activeVersion',case when pv.id is null then null else jsonb_build_object(
          'id',pv.id,
          'version',pv.version,
          'purpose',pv.purpose,
          'scope',pv.scope,
          'principles',pv.principles,
          'policyStatements',pv.policy_statements,
          'rolesResponsibilities',pv.roles_responsibilities,
          'rules',pv.rules,
          'exceptions',pv.exceptions,
          'escalation',pv.escalation,
          'recordsEvidence',pv.records_evidence,
          'effectiveDate',pv.effective_date,
          'reviewDate',pv.review_date,
          'status',pv.status
        ) end
      ) as item
    from public.khpos_ops_policies p
    left join lateral (
      select x.*
      from public.khpos_ops_policy_versions x
      where x.policy_id=p.id and x.status='active'
      order by x.version desc
      limit 1
    ) pv on true
    where p.organisation_id=p_organisation_id
      and p.status <> 'retired'
  ) policy_rows;

  select count(*) into v_process_count
  from public.khpos_ops_processes p
  where p.organisation_id=p_organisation_id and p.status <> 'retired';

  select count(*) into v_active_process_count
  from public.khpos_ops_processes p
  where p.organisation_id=p_organisation_id
    and exists (
      select 1 from public.khpos_ops_process_versions pv
      where pv.process_id=p.id and pv.status='active'
    );

  select coalesce(jsonb_agg(item order by criticality,code),'[]'::jsonb)
  into v_processes
  from (
    select
      p.criticality,
      p.code,
      jsonb_build_object(
        'id',p.id,
        'code',p.code,
        'title',p.title,
        'operatingSystem',p.operating_system,
        'ownerLabel',p.owner_label,
        'criticality',p.criticality,
        'governingPolicyCodes',to_jsonb(p.governing_policy_codes),
        'technology',to_jsonb(p.technology),
        'status',p.status,
        'activeVersion',case when pv.id is null then null else jsonb_build_object(
          'id',pv.id,
          'version',pv.version,
          'purpose',pv.purpose,
          'trigger',pv.trigger,
          'inputs',pv.inputs,
          'steps',pv.steps,
          'sla',pv.sla,
          'evidence',pv.evidence,
          'expectedOutcome',pv.expected_outcome,
          'exceptionConditions',pv.exception_conditions,
          'escalation',pv.escalation,
          'kpis',pv.kpis,
          'effectiveDate',pv.effective_date,
          'status',pv.status
        ) end
      ) as item
    from public.khpos_ops_processes p
    left join lateral (
      select x.*
      from public.khpos_ops_process_versions x
      where x.process_id=p.id and x.status='active'
      order by x.version desc
      limit 1
    ) pv on true
    where p.organisation_id=p_organisation_id
      and p.status <> 'retired'
  ) process_rows;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',t.id,
      'code',t.code,
      'name',t.name,
      'toolType',t.tool_type,
      'purpose',t.purpose,
      'status',t.status
    )
    order by t.code
  ),'[]'::jsonb)
  into v_tools
  from public.khpos_ops_tool_templates t
  where t.organisation_id=p_organisation_id
    and t.status='active';

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_organisation_name),
    'membershipRole',v_membership_role,
    'operatingRoleCodes',to_jsonb(v_role_codes),
    'policies',v_policies,
    'processes',v_processes,
    'tools',v_tools,
    'summary',jsonb_build_object(
      'policyCount',v_policy_count,
      'activePolicyDocuments',v_active_policy_count,
      'requiredPolicyCount',v_required_policy_count,
      'unacknowledgedRequiredPolicies',v_unacknowledged_count,
      'processCount',v_process_count,
      'activeProcessDocuments',v_active_process_count,
      'toolCount',jsonb_array_length(v_tools)
    )
  );
end;
$$;

create or replace function public.khpos_ops_acknowledge_policy_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_policy_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_membership_role text;
  v_policy_id uuid;
  v_allowed boolean := false;
begin
  select m.role into v_membership_role
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_membership_role is null then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select p.id into v_policy_id
  from public.khpos_ops_policy_versions pv
  join public.khpos_ops_policies p on p.id=pv.policy_id
  where pv.id=p_policy_version_id
    and pv.status='active'
    and p.organisation_id=p_organisation_id
    and p.status <> 'retired';

  if v_policy_id is null then
    raise exception 'Active policy version not found.';
  end if;

  if v_membership_role in ('executive','transformation_lead') then
    v_allowed := true;
  else
    select exists(
      select 1
      from public.khpos_ops_policy_roles pr
      join public.khpos_ops_role_assignments a on a.role_id=pr.role_id
      where pr.policy_id=v_policy_id
        and a.user_id=p_actor_user_id
        and a.status='active'
    ) into v_allowed;
  end if;

  if not v_allowed then
    raise exception 'This policy is not assigned to your active role.';
  end if;

  insert into public.khpos_ops_policy_acknowledgements(
    organisation_id,policy_version_id,user_id,acknowledged_at
  ) values (
    p_organisation_id,p_policy_version_id,p_actor_user_id,now()
  )
  on conflict (policy_version_id,user_id) do update
  set acknowledged_at=excluded.acknowledged_at;
end;
$$;

revoke execute on function public.khpos_ops_get_library_server(uuid,uuid)
  from public, anon, authenticated;
revoke execute on function public.khpos_ops_acknowledge_policy_server(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.khpos_ops_get_library_server(uuid,uuid)
  to service_role;
grant execute on function public.khpos_ops_acknowledge_policy_server(uuid,uuid,uuid)
  to service_role;
