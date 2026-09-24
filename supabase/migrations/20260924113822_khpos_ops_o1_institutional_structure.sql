create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_campuses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table if not exists public.khpos_ops_units (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid references public.khpos_ops_campuses(id) on delete cascade,
  parent_unit_id uuid references public.khpos_ops_units(id) on delete set null,
  code text not null,
  name text not null,
  unit_type text not null default 'other'
    check (unit_type in ('academic_section','academic_function','skills_function','administrative','programme','other')),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table if not exists public.khpos_ops_roles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  title text not null,
  category text not null default 'staff',
  role_level integer not null check (role_level between 1 and 20),
  reports_to_role_id uuid references public.khpos_ops_roles(id) on delete set null,
  system_scope text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table if not exists public.khpos_ops_role_assignments (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.khpos_ops_roles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  unit_id uuid references public.khpos_ops_units(id) on delete set null,
  primary_assignment boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive','ended')),
  start_date date not null default current_date,
  end_date date,
  appointed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.khpos_ops_role_charters (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.khpos_ops_roles(id) on delete cascade,
  version integer not null check (version > 0),
  mission text not null,
  owned_outcomes jsonb not null default '[]'::jsonb check (jsonb_typeof(owned_outcomes)='array'),
  responsibilities jsonb not null default '[]'::jsonb check (jsonb_typeof(responsibilities)='array'),
  decision_rights jsonb not null default '[]'::jsonb check (jsonb_typeof(decision_rights)='array'),
  escalation_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(escalation_rules)='array'),
  kpis jsonb not null default '[]'::jsonb check (jsonb_typeof(kpis)='array'),
  required_policy_codes text[] not null default '{}'::text[],
  effective_date date,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','superseded','archived')),
  created_at timestamptz not null default now(),
  unique (role_id, version)
);

create table if not exists public.khpos_ops_reporting_lines (
  id uuid primary key default gen_random_uuid(),
  subordinate_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete cascade,
  supervisor_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete cascade,
  relationship_type text not null default 'primary'
    check (relationship_type in ('primary','functional','dotted_line')),
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  check (subordinate_assignment_id <> supervisor_assignment_id),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.khpos_ops_backup_assignments (
  id uuid primary key default gen_random_uuid(),
  primary_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete cascade,
  backup_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete cascade,
  coverage_scope text not null default 'full_role',
  status text not null default 'active' check (status in ('active','inactive','ended')),
  effective_from date not null default current_date,
  effective_to date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (primary_assignment_id <> backup_assignment_id),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.khpos_ops_audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  object_type text not null,
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_campuses_org_status
  on public.khpos_ops_campuses(organisation_id, status);
create index if not exists idx_khpos_ops_units_org_campus
  on public.khpos_ops_units(organisation_id, campus_id, status);
create index if not exists idx_khpos_ops_roles_org_level
  on public.khpos_ops_roles(organisation_id, role_level, status);
create index if not exists idx_khpos_ops_role_assignments_role_status
  on public.khpos_ops_role_assignments(role_id, status);
create index if not exists idx_khpos_ops_role_assignments_user_status
  on public.khpos_ops_role_assignments(user_id, status);
create unique index if not exists uq_khpos_ops_role_assignment_active
  on public.khpos_ops_role_assignments(role_id, user_id, coalesce(campus_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(unit_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where status='active';
create unique index if not exists uq_khpos_ops_role_charter_active
  on public.khpos_ops_role_charters(role_id)
  where status='active';
create index if not exists idx_khpos_ops_reporting_subordinate
  on public.khpos_ops_reporting_lines(subordinate_assignment_id, effective_from desc);
create index if not exists idx_khpos_ops_backup_primary
  on public.khpos_ops_backup_assignments(primary_assignment_id, status);
create index if not exists idx_khpos_ops_audit_org_created
  on public.khpos_ops_audit_events(organisation_id, created_at desc);

alter table public.khpos_ops_campuses enable row level security;
alter table public.khpos_ops_units enable row level security;
alter table public.khpos_ops_roles enable row level security;
alter table public.khpos_ops_role_assignments enable row level security;
alter table public.khpos_ops_role_charters enable row level security;
alter table public.khpos_ops_reporting_lines enable row level security;
alter table public.khpos_ops_backup_assignments enable row level security;
alter table public.khpos_ops_audit_events enable row level security;

revoke all privileges on table public.khpos_ops_campuses from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_units from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_roles from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_role_assignments from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_role_charters from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_reporting_lines from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_backup_assignments from public, anon, authenticated;
revoke all privileges on table public.khpos_ops_audit_events from public, anon, authenticated;

grant select, insert, update, delete on table public.khpos_ops_campuses to service_role;
grant select, insert, update, delete on table public.khpos_ops_units to service_role;
grant select, insert, update, delete on table public.khpos_ops_roles to service_role;
grant select, insert, update, delete on table public.khpos_ops_role_assignments to service_role;
grant select, insert, update, delete on table public.khpos_ops_role_charters to service_role;
grant select, insert, update, delete on table public.khpos_ops_reporting_lines to service_role;
grant select, insert, update, delete on table public.khpos_ops_backup_assignments to service_role;
grant select, insert, update, delete on table public.khpos_ops_audit_events to service_role;

create or replace function public.khpos_ops_get_structure_server(
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
  v_campuses jsonb;
  v_units jsonb;
  v_roles jsonb;
  v_role_count integer := 0;
  v_assigned_role_count integer := 0;
begin
  select m.role, o.name
  into v_membership_role, v_organisation_name
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

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',c.id,
      'code',c.code,
      'name',c.name,
      'status',c.status
    )
    order by c.name
  ), '[]'::jsonb)
  into v_campuses
  from public.khpos_ops_campuses c
  where c.organisation_id=p_organisation_id
    and c.status <> 'archived';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',u.id,
      'campusId',u.campus_id,
      'parentUnitId',u.parent_unit_id,
      'code',u.code,
      'name',u.name,
      'unitType',u.unit_type,
      'status',u.status
    )
    order by u.name
  ), '[]'::jsonb)
  into v_units
  from public.khpos_ops_units u
  where u.organisation_id=p_organisation_id
    and u.status <> 'archived';

  select count(*) into v_role_count
  from public.khpos_ops_roles r
  where r.organisation_id=p_organisation_id
    and r.status <> 'archived';

  select count(distinct a.role_id) into v_assigned_role_count
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where r.organisation_id=p_organisation_id
    and r.status <> 'archived'
    and a.status='active';

  select coalesce(jsonb_agg(role_record order by role_level, title), '[]'::jsonb)
  into v_roles
  from (
    select
      r.role_level,
      r.title,
      jsonb_build_object(
        'id',r.id,
        'code',r.code,
        'title',r.title,
        'category',r.category,
        'level',r.role_level,
        'reportsToRoleId',r.reports_to_role_id,
        'reportsToTitle',parent_role.title,
        'status',r.status,
        'charter',case when charter.id is null then null else jsonb_build_object(
          'version',charter.version,
          'mission',charter.mission,
          'ownedOutcomes',charter.owned_outcomes,
          'responsibilities',charter.responsibilities,
          'decisionRights',charter.decision_rights,
          'escalationRules',charter.escalation_rules,
          'kpis',charter.kpis,
          'effectiveDate',charter.effective_date,
          'status',charter.status
        ) end,
        'assignments',coalesce(assignments.items,'[]'::jsonb)
      ) as role_record
    from public.khpos_ops_roles r
    left join public.khpos_ops_roles parent_role on parent_role.id=r.reports_to_role_id
    left join lateral (
      select c.*
      from public.khpos_ops_role_charters c
      where c.role_id=r.id and c.status='active'
      order by c.version desc
      limit 1
    ) charter on true
    left join lateral (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',a.id,
          'userId',a.user_id,
          'displayName',coalesce(
            nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
            nullif(btrim(u.raw_user_meta_data->>'name'),''),
            u.email,
            'Assigned user'
          ),
          'campusName',campus.name,
          'unitName',unit.name,
          'primaryAssignment',a.primary_assignment,
          'status',a.status
        )
        order by a.primary_assignment desc, lower(coalesce(u.email,''))
      ), '[]'::jsonb) as items
      from public.khpos_ops_role_assignments a
      join auth.users u on u.id=a.user_id
      left join public.khpos_ops_campuses campus on campus.id=a.campus_id
      left join public.khpos_ops_units unit on unit.id=a.unit_id
      where a.role_id=r.id
        and a.status='active'
    ) assignments on true
    where r.organisation_id=p_organisation_id
      and r.status <> 'archived'
  ) roles_query;

  return jsonb_build_object(
    'organisation',jsonb_build_object(
      'id',p_organisation_id,
      'name',v_organisation_name
    ),
    'membershipRole',v_membership_role,
    'campuses',v_campuses,
    'units',v_units,
    'roles',v_roles,
    'summary',jsonb_build_object(
      'campusCount',jsonb_array_length(v_campuses),
      'unitCount',jsonb_array_length(v_units),
      'roleCount',v_role_count,
      'assignedRoleCount',v_assigned_role_count,
      'unassignedRoleCount',greatest(v_role_count-v_assigned_role_count,0)
    )
  );
end;
$$;

revoke execute on function public.khpos_ops_get_structure_server(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.khpos_ops_get_structure_server(uuid,uuid)
  to service_role;
