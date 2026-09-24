create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_kpis (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  name text not null,
  domain text not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,code)
);

create table if not exists public.khpos_ops_kpi_versions (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.khpos_ops_kpis(id) on delete cascade,
  version integer not null check (version > 0),
  definition text not null,
  owner_role_id uuid not null references public.khpos_ops_roles(id) on delete restrict,
  scope_type text not null check (scope_type in ('role','team','system','campus','institution')),
  scope_role_id uuid references public.khpos_ops_roles(id) on delete set null,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  unit_id uuid references public.khpos_ops_units(id) on delete set null,
  system_code text,
  indicator_type text not null check (indicator_type in ('outcome','process','risk')),
  unit text not null check (unit in ('number','percent','currency','days','hours','minutes','boolean','ratio')),
  direction text not null default 'baseline_only'
    check (direction in ('baseline_only','higher_is_better','lower_is_better','binary_control')),
  cadence text not null check (cadence in ('weekly','monthly','termly','quarterly','annual','ad_hoc')),
  source_type text not null default 'manual'
    check (source_type in ('manual','operational_engine','third_party','ksi','pipupath')),
  source_key text,
  target_config jsonb not null default '{}'::jsonb check (jsonb_typeof(target_config)='object'),
  critical_control boolean not null default false,
  effective_date date not null default current_date,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  status text not null default 'active' check (status in ('draft','active','superseded','archived')),
  created_at timestamptz not null default now(),
  unique (kpi_id,version),
  check (
    (scope_type='role' and scope_role_id is not null and campus_id is null and unit_id is null and system_code is null)
    or (scope_type='team' and unit_id is not null and scope_role_id is null and system_code is null)
    or (scope_type='system' and system_code is not null and scope_role_id is null and unit_id is null)
    or (scope_type='campus' and campus_id is not null and scope_role_id is null and unit_id is null and system_code is null)
    or (scope_type='institution' and scope_role_id is null and campus_id is null and unit_id is null and system_code is null)
  )
);

create unique index if not exists uq_khpos_ops_kpi_version_active
  on public.khpos_ops_kpi_versions(kpi_id)
  where status='active';

create table if not exists public.khpos_ops_kpi_measurements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kpi_id uuid not null references public.khpos_ops_kpis(id) on delete cascade,
  kpi_version_id uuid not null references public.khpos_ops_kpi_versions(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  value_numeric numeric not null,
  performance_status text not null
    check (performance_status in ('unbaselined','green','amber','red','critical')),
  note text,
  evidence_reference text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (kpi_version_id,period_start,period_end)
);

create index if not exists idx_khpos_ops_kpis_org_status
  on public.khpos_ops_kpis(organisation_id,status,name);
create index if not exists idx_khpos_ops_kpis_created_by
  on public.khpos_ops_kpis(created_by) where created_by is not null;
create index if not exists idx_khpos_ops_kpi_versions_owner
  on public.khpos_ops_kpi_versions(owner_role_id,status);
create index if not exists idx_khpos_ops_kpi_versions_scope_role
  on public.khpos_ops_kpi_versions(scope_role_id) where scope_role_id is not null;
create index if not exists idx_khpos_ops_kpi_versions_campus
  on public.khpos_ops_kpi_versions(campus_id) where campus_id is not null;
create index if not exists idx_khpos_ops_kpi_versions_unit
  on public.khpos_ops_kpi_versions(unit_id) where unit_id is not null;
create index if not exists idx_khpos_ops_kpi_versions_approved_by
  on public.khpos_ops_kpi_versions(approved_by) where approved_by is not null;
create index if not exists idx_khpos_ops_kpi_measurements_kpi_period
  on public.khpos_ops_kpi_measurements(kpi_id,period_end desc,recorded_at desc);
create index if not exists idx_khpos_ops_kpi_measurements_recorder
  on public.khpos_ops_kpi_measurements(recorded_by,recorded_at desc);

alter table public.khpos_ops_kpis enable row level security;
alter table public.khpos_ops_kpi_versions enable row level security;
alter table public.khpos_ops_kpi_measurements enable row level security;

revoke all privileges on table public.khpos_ops_kpis from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_kpi_versions from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_kpi_measurements from public,anon,authenticated;
grant select,insert,update,delete on table public.khpos_ops_kpis to service_role;
grant select,insert,update,delete on table public.khpos_ops_kpi_versions to service_role;
grant select,insert,update,delete on table public.khpos_ops_kpi_measurements to service_role;

create or replace function khpos_private.ops_kpi_status(
  p_direction text,
  p_target_config jsonb,
  p_value numeric
)
returns text
language plpgsql
immutable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_green numeric;
  v_amber numeric;
  v_red numeric;
  v_success numeric;
begin
  if p_direction='baseline_only' then
    return 'unbaselined';
  end if;

  if p_direction='binary_control' then
    begin
      v_success := (p_target_config->>'successValue')::numeric;
    exception when others then
      raise exception 'Binary control requires a numeric successValue.';
    end;
    return case when p_value=v_success then 'green' else 'critical' end;
  end if;

  if p_direction='higher_is_better' then
    begin
      v_green := (p_target_config->>'greenMin')::numeric;
      v_amber := (p_target_config->>'amberMin')::numeric;
      v_red := (p_target_config->>'redMin')::numeric;
    exception when others then
      raise exception 'Higher-is-better target requires greenMin, amberMin and redMin.';
    end;

    if not (v_green > v_amber and v_amber > v_red) then
      raise exception 'Higher-is-better thresholds must satisfy greenMin > amberMin > redMin.';
    end if;

    return case
      when p_value>=v_green then 'green'
      when p_value>=v_amber then 'amber'
      when p_value>=v_red then 'red'
      else 'critical'
    end;
  end if;

  if p_direction='lower_is_better' then
    begin
      v_green := (p_target_config->>'greenMax')::numeric;
      v_amber := (p_target_config->>'amberMax')::numeric;
      v_red := (p_target_config->>'redMax')::numeric;
    exception when others then
      raise exception 'Lower-is-better target requires greenMax, amberMax and redMax.';
    end;

    if not (v_green < v_amber and v_amber < v_red) then
      raise exception 'Lower-is-better thresholds must satisfy greenMax < amberMax < redMax.';
    end if;

    return case
      when p_value<=v_green then 'green'
      when p_value<=v_amber then 'amber'
      when p_value<=v_red then 'red'
      else 'critical'
    end;
  end if;

  raise exception 'Unsupported KPI direction.';
end;
$$;

create or replace function khpos_private.ops_can_govern_performance(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('VISION_CUSTODIAN','SCHOOL_GUARDIAN')
  );
$$;

create or replace function public.khpos_ops_get_performance_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_member_role text;
  v_org_name text;
  v_actor_min_level integer;
  v_can_govern boolean := false;
  v_roles jsonb := '[]'::jsonb;
  v_campuses jsonb := '[]'::jsonb;
  v_units jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_active_kpis integer := 0;
  v_unbaselined integer := 0;
  v_green integer := 0;
  v_amber integer := 0;
  v_red integer := 0;
  v_critical integer := 0;
  v_critical_controls_failing integer := 0;
  v_work_open integer := 0;
  v_work_overdue integer := 0;
  v_work_blocked integer := 0;
  v_issue_open integer := 0;
  v_issue_p1 integer := 0;
  v_issue_p2 integer := 0;
  v_issue_overdue integer := 0;
  v_decision_pending integer := 0;
  v_decision_overdue integer := 0;
  v_roles_total integer := 0;
  v_roles_assigned integer := 0;
  v_process_total integer := 0;
  v_process_active integer := 0;
begin
  select m.role,o.name into v_member_role,v_org_name
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_member_role is null then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select min(r.role_level) into v_actor_min_level
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.user_id=p_actor_user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.status='active';

  v_can_govern := khpos_private.ops_can_govern_performance(p_actor_user_id,p_organisation_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'code',r.code,'title',r.title,'level',r.role_level
  ) order by r.role_level,r.title),'[]'::jsonb)
  into v_roles
  from public.khpos_ops_roles r
  where r.organisation_id=p_organisation_id and r.status='active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'code',c.code,'name',c.name
  ) order by c.name),'[]'::jsonb)
  into v_campuses
  from public.khpos_ops_campuses c
  where c.organisation_id=p_organisation_id and c.status='active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,'code',u.code,'name',u.name,'campusId',u.campus_id
  ) order by u.name),'[]'::jsonb)
  into v_units
  from public.khpos_ops_units u
  where u.organisation_id=p_organisation_id and u.status='active';

  select
    count(*) filter (where w.status not in ('completed','cancelled'))::integer,
    count(*) filter (
      where w.status not in ('completed','cancelled')
        and w.due_at is not null and w.due_at<now()
    )::integer,
    count(*) filter (where w.status='blocked')::integer
  into v_work_open,v_work_overdue,v_work_blocked
  from public.khpos_ops_work_items w
  where w.organisation_id=p_organisation_id;

  select
    count(*) filter (where i.status not in ('verified','closed'))::integer,
    count(*) filter (where i.status not in ('verified','closed') and i.severity='P1')::integer,
    count(*) filter (where i.status not in ('verified','closed') and i.severity='P2')::integer,
    count(*) filter (
      where i.status not in ('verified','closed')
        and i.due_at is not null and i.due_at<now()
    )::integer
  into v_issue_open,v_issue_p1,v_issue_p2,v_issue_overdue
  from public.khpos_ops_issues i
  where i.organisation_id=p_organisation_id and i.sensitivity='standard';

  select
    count(*) filter (where d.status in ('submitted','under_review','returned'))::integer,
    count(*) filter (
      where d.status in ('submitted','under_review','returned')
        and d.decision_due_at is not null and d.decision_due_at<now()
    )::integer
  into v_decision_pending,v_decision_overdue
  from public.khpos_ops_decisions d
  where d.organisation_id=p_organisation_id and d.sensitivity='standard';

  select count(*)::integer into v_roles_total
  from public.khpos_ops_roles r
  where r.organisation_id=p_organisation_id and r.status='active';

  select count(distinct a.role_id)::integer into v_roles_assigned
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where r.organisation_id=p_organisation_id
    and r.status='active'
    and a.status='active';

  select
    count(*)::integer,
    count(*) filter (where p.status='active')::integer
  into v_process_total,v_process_active
  from public.khpos_ops_processes p
  where p.organisation_id=p_organisation_id
    and p.status<>'archived';

  with actor_roles as (
    select r.id as role_id,a.campus_id,a.unit_id
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  ),
  visible as (
    select
      k.id,
      k.code,
      k.name,
      k.domain,
      v.id as version_id,
      v.version,
      v.definition,
      v.owner_role_id,
      owner.title as owner_role_title,
      v.scope_type,
      v.scope_role_id,
      scope_role.title as scope_role_title,
      v.campus_id,
      campus.name as campus_name,
      v.unit_id,
      unit.name as unit_name,
      v.system_code,
      v.indicator_type,
      v.unit as measurement_unit,
      v.direction,
      v.cadence,
      v.source_type,
      v.source_key,
      v.target_config,
      v.critical_control,
      latest.id as latest_measurement_id,
      latest.period_start as latest_period_start,
      latest.period_end as latest_period_end,
      latest.value_numeric as latest_value,
      latest.performance_status as latest_status,
      latest.note as latest_note,
      latest.evidence_reference as latest_evidence,
      latest.recorded_at as latest_recorded_at,
      previous.value_numeric as previous_value,
      previous.performance_status as previous_status,
      (
        v_can_govern
        or exists(select 1 from actor_roles ar where ar.role_id=v.owner_role_id)
      ) as can_record
    from public.khpos_ops_kpis k
    join public.khpos_ops_kpi_versions v
      on v.kpi_id=k.id and v.status='active'
    join public.khpos_ops_roles owner on owner.id=v.owner_role_id
    left join public.khpos_ops_roles scope_role on scope_role.id=v.scope_role_id
    left join public.khpos_ops_campuses campus on campus.id=v.campus_id
    left join public.khpos_ops_units unit on unit.id=v.unit_id
    left join lateral (
      select m.*
      from public.khpos_ops_kpi_measurements m
      where m.kpi_id=k.id
      order by m.period_end desc,m.recorded_at desc
      limit 1
    ) latest on true
    left join lateral (
      select m.*
      from public.khpos_ops_kpi_measurements m
      where m.kpi_id=k.id
        and (latest.id is null or m.id<>latest.id)
      order by m.period_end desc,m.recorded_at desc
      limit 1
    ) previous on true
    where k.organisation_id=p_organisation_id
      and k.status='active'
      and (
        coalesce(v_actor_min_level,99)<=3
        or v.scope_type in ('institution','campus')
        or (v.scope_type='role' and exists(select 1 from actor_roles ar where ar.role_id=v.scope_role_id))
        or (v.scope_type='team' and exists(select 1 from actor_roles ar where ar.unit_id=v.unit_id))
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,
    'code',x.code,
    'name',x.name,
    'domain',x.domain,
    'versionId',x.version_id,
    'version',x.version,
    'definition',x.definition,
    'ownerRoleId',x.owner_role_id,
    'ownerRoleTitle',x.owner_role_title,
    'scopeType',x.scope_type,
    'scopeRoleId',x.scope_role_id,
    'scopeRoleTitle',x.scope_role_title,
    'campusId',x.campus_id,
    'campusName',x.campus_name,
    'unitId',x.unit_id,
    'unitName',x.unit_name,
    'systemCode',x.system_code,
    'indicatorType',x.indicator_type,
    'unit',x.measurement_unit,
    'direction',x.direction,
    'cadence',x.cadence,
    'sourceType',x.source_type,
    'sourceKey',x.source_key,
    'targetConfig',x.target_config,
    'criticalControl',x.critical_control,
    'canRecord',x.can_record,
    'latest',case when x.latest_measurement_id is null then null else jsonb_build_object(
      'id',x.latest_measurement_id,
      'periodStart',x.latest_period_start,
      'periodEnd',x.latest_period_end,
      'value',x.latest_value,
      'status',x.latest_status,
      'note',x.latest_note,
      'evidenceReference',x.latest_evidence,
      'recordedAt',x.latest_recorded_at
    ) end,
    'previous',case when x.previous_value is null then null else jsonb_build_object(
      'value',x.previous_value,
      'status',x.previous_status
    ) end
  ) order by
    case x.latest_status when 'critical' then 1 when 'red' then 2 when 'amber' then 3 when 'unbaselined' then 4 when 'green' then 5 else 6 end,
    x.critical_control desc,
    x.name
  ),'[]'::jsonb)
  into v_items
  from visible x;

  with latest_per_kpi as (
    select distinct on (m.kpi_id)
      m.kpi_id,m.performance_status,v.critical_control
    from public.khpos_ops_kpi_measurements m
    join public.khpos_ops_kpi_versions v on v.id=m.kpi_version_id and v.status='active'
    join public.khpos_ops_kpis k on k.id=m.kpi_id
    where m.organisation_id=p_organisation_id and k.status='active'
    order by m.kpi_id,m.period_end desc,m.recorded_at desc
  )
  select
    (select count(*)::integer from public.khpos_ops_kpis k
      join public.khpos_ops_kpi_versions v on v.kpi_id=k.id and v.status='active'
      where k.organisation_id=p_organisation_id and k.status='active'),
    count(*) filter (where performance_status='unbaselined')::integer,
    count(*) filter (where performance_status='green')::integer,
    count(*) filter (where performance_status='amber')::integer,
    count(*) filter (where performance_status='red')::integer,
    count(*) filter (where performance_status='critical')::integer,
    count(*) filter (where critical_control and performance_status in ('red','critical'))::integer
  into v_active_kpis,v_unbaselined,v_green,v_amber,v_red,v_critical,v_critical_controls_failing
  from latest_per_kpi;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canGovernKpis',v_can_govern,
    'roles',v_roles,
    'campuses',v_campuses,
    'units',v_units,
    'operationalPulse',jsonb_build_object(
      'work',jsonb_build_object('open',v_work_open,'overdue',v_work_overdue,'blocked',v_work_blocked),
      'issues',jsonb_build_object('open',v_issue_open,'p1',v_issue_p1,'p2',v_issue_p2,'overdue',v_issue_overdue),
      'decisions',jsonb_build_object('pending',v_decision_pending,'overdue',v_decision_overdue),
      'roles',jsonb_build_object('total',v_roles_total,'assigned',v_roles_assigned,'unassigned',greatest(v_roles_total-v_roles_assigned,0)),
      'processes',jsonb_build_object('total',v_process_total,'active',v_process_active,'notPublished',greatest(v_process_total-v_process_active,0))
    ),
    'scorecardSummary',jsonb_build_object(
      'activeKpis',v_active_kpis,
      'unbaselined',v_unbaselined,
      'green',v_green,
      'amber',v_amber,
      'red',v_red,
      'critical',v_critical,
      'criticalControlsFailing',v_critical_controls_failing
    ),
    'items',v_items
  );
end;
$$;

create or replace function public.khpos_ops_create_kpi_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_code text := upper(nullif(btrim(p_input->>'code'),''));
  v_name text := nullif(btrim(p_input->>'name'),'');
  v_domain text := lower(nullif(btrim(p_input->>'domain'),''));
  v_definition text := nullif(btrim(p_input->>'definition'),'');
  v_owner_role uuid;
  v_scope_type text := lower(nullif(btrim(p_input->>'scopeType'),''));
  v_scope_role uuid;
  v_campus uuid;
  v_unit uuid;
  v_system_code text := nullif(btrim(p_input->>'systemCode'),'');
  v_indicator_type text := lower(nullif(btrim(p_input->>'indicatorType'),''));
  v_measurement_unit text := lower(nullif(btrim(p_input->>'unit'),''));
  v_direction text := lower(coalesce(nullif(btrim(p_input->>'direction'),''),'baseline_only'));
  v_cadence text := lower(nullif(btrim(p_input->>'cadence'),''));
  v_source_type text := lower(coalesce(nullif(btrim(p_input->>'sourceType'),''),'manual'));
  v_source_key text := nullif(btrim(p_input->>'sourceKey'),'');
  v_target_config jsonb := coalesce(p_input->'targetConfig','{}'::jsonb);
  v_critical_control boolean := coalesce((p_input->>'criticalControl')::boolean,false);
  v_kpi_id uuid;
  v_version_id uuid;
begin
  if not exists(
    select 1 from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  if not khpos_private.ops_can_govern_performance(p_actor_user_id,p_organisation_id) then
    raise exception 'KPI governance requires an active School Guardian or Vision Custodian role.';
  end if;

  if v_code is null or v_name is null or v_domain is null or v_definition is null then
    raise exception 'KPI code, name, domain and definition are required.';
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$' then
    raise exception 'KPI code must use 2–40 uppercase letters, numbers, hyphens or underscores.';
  end if;
  if v_scope_type not in ('role','team','system','campus','institution') then raise exception 'Unsupported KPI scope.'; end if;
  if v_indicator_type not in ('outcome','process','risk') then raise exception 'Unsupported indicator type.'; end if;
  if v_measurement_unit not in ('number','percent','currency','days','hours','minutes','boolean','ratio') then raise exception 'Unsupported KPI unit.'; end if;
  if v_direction not in ('baseline_only','higher_is_better','lower_is_better','binary_control') then raise exception 'Unsupported KPI direction.'; end if;
  if v_cadence not in ('weekly','monthly','termly','quarterly','annual','ad_hoc') then raise exception 'Unsupported KPI cadence.'; end if;
  if v_source_type not in ('manual','operational_engine','third_party','ksi','pipupath') then raise exception 'Unsupported KPI source type.'; end if;
  if jsonb_typeof(v_target_config)<>'object' then raise exception 'KPI target configuration must be an object.'; end if;

  begin v_owner_role := (p_input->>'ownerRoleId')::uuid;
  exception when others then raise exception 'A valid KPI owner role is required.'; end;

  if not exists(select 1 from public.khpos_ops_roles where id=v_owner_role and organisation_id=p_organisation_id and status='active') then
    raise exception 'KPI owner role is not active in this organisation.';
  end if;

  if v_scope_type='role' then
    begin v_scope_role := (p_input->>'scopeRoleId')::uuid;
    exception when others then raise exception 'Role scorecards require a valid scope role.'; end;
    if not exists(select 1 from public.khpos_ops_roles where id=v_scope_role and organisation_id=p_organisation_id and status='active') then
      raise exception 'Scope role is not active in this organisation.';
    end if;
  elsif v_scope_type='team' then
    begin v_unit := (p_input->>'unitId')::uuid;
    exception when others then raise exception 'Team scorecards require a valid unit.'; end;
    if not exists(select 1 from public.khpos_ops_units where id=v_unit and organisation_id=p_organisation_id and status='active') then
      raise exception 'Scope unit is not active in this organisation.';
    end if;
  elsif v_scope_type='campus' then
    begin v_campus := (p_input->>'campusId')::uuid;
    exception when others then raise exception 'Campus scorecards require a valid campus.'; end;
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_organisation_id and status='active') then
      raise exception 'Scope campus is not active in this organisation.';
    end if;
  elsif v_scope_type='system' and v_system_code is null then
    raise exception 'Operating-system scorecards require a system code.';
  end if;

  perform khpos_private.ops_kpi_status(v_direction,v_target_config,0);

  insert into public.khpos_ops_kpis(
    organisation_id,code,name,domain,status,created_by
  ) values (
    p_organisation_id,v_code,left(v_name,180),left(v_domain,80),'active',p_actor_user_id
  )
  returning id into v_kpi_id;

  insert into public.khpos_ops_kpi_versions(
    kpi_id,version,definition,owner_role_id,scope_type,scope_role_id,campus_id,unit_id,system_code,
    indicator_type,unit,direction,cadence,source_type,source_key,target_config,critical_control,
    effective_date,approved_by,approved_at,status
  ) values (
    v_kpi_id,1,left(v_definition,4000),v_owner_role,v_scope_type,v_scope_role,v_campus,v_unit,
    case when v_scope_type='system' then left(v_system_code,100) else null end,
    v_indicator_type,v_measurement_unit,v_direction,v_cadence,v_source_type,left(v_source_key,120),
    v_target_config,v_critical_control,current_date,p_actor_user_id,now(),'active'
  )
  returning id into v_version_id;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_kpi_created','kpi',v_kpi_id,
    jsonb_build_object(
      'versionId',v_version_id,'code',v_code,'direction',v_direction,
      'scopeType',v_scope_type,'criticalControl',v_critical_control
    )
  );

  return v_kpi_id;
exception when unique_violation then
  raise exception 'A KPI with this code already exists.';
end;
$$;

create or replace function public.khpos_ops_record_kpi_measurement_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_kpi_id uuid,
  p_period_start date,
  p_period_end date,
  p_value numeric,
  p_note text default null,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_version public.khpos_ops_kpi_versions%rowtype;
  v_status text;
  v_measurement_id uuid;
  v_authorized boolean := false;
begin
  if not exists(
    select 1 from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select v.* into v_version
  from public.khpos_ops_kpi_versions v
  join public.khpos_ops_kpis k on k.id=v.kpi_id
  where v.kpi_id=p_kpi_id
    and v.status='active'
    and k.organisation_id=p_organisation_id
    and k.status='active'
  limit 1;

  if v_version.id is null then raise exception 'Active KPI definition not found.'; end if;
  if p_period_end<p_period_start then raise exception 'KPI period end cannot precede period start.'; end if;

  v_authorized := khpos_private.ops_can_govern_performance(p_actor_user_id,p_organisation_id)
    or exists(
      select 1
      from public.khpos_ops_role_assignments a
      join public.khpos_ops_roles r on r.id=a.role_id
      where a.user_id=p_actor_user_id
        and a.status='active'
        and r.id=v_version.owner_role_id
        and r.organisation_id=p_organisation_id
        and r.status='active'
    );

  if not v_authorized then
    raise exception 'KPI measurement requires the KPI owner role, School Guardian or Vision Custodian.';
  end if;

  v_status := khpos_private.ops_kpi_status(v_version.direction,v_version.target_config,p_value);

  insert into public.khpos_ops_kpi_measurements(
    organisation_id,kpi_id,kpi_version_id,period_start,period_end,value_numeric,
    performance_status,note,evidence_reference,recorded_by,recorded_at,updated_at
  ) values (
    p_organisation_id,p_kpi_id,v_version.id,p_period_start,p_period_end,p_value,
    v_status,nullif(btrim(coalesce(p_note,'')),''),
    nullif(btrim(coalesce(p_evidence_reference,'')),''),
    p_actor_user_id,now(),now()
  )
  on conflict (kpi_version_id,period_start,period_end) do update
    set value_numeric=excluded.value_numeric,
        performance_status=excluded.performance_status,
        note=excluded.note,
        evidence_reference=excluded.evidence_reference,
        recorded_by=excluded.recorded_by,
        recorded_at=now(),
        updated_at=now()
  returning id into v_measurement_id;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_kpi_measurement_recorded','kpi',p_kpi_id,
    jsonb_build_object(
      'measurementId',v_measurement_id,
      'periodStart',p_period_start,
      'periodEnd',p_period_end,
      'value',p_value,
      'performanceStatus',v_status
    )
  );

  return v_measurement_id;
end;
$$;


create or replace function public.khpos_ops_configure_kpi_target_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_kpi_id uuid,
  p_direction text,
  p_target_config jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_current public.khpos_ops_kpi_versions%rowtype;
  v_new_id uuid;
  v_next_version integer;
  v_direction text := lower(nullif(btrim(p_direction),''));
begin
  if not khpos_private.ops_can_govern_performance(p_actor_user_id,p_organisation_id) then
    raise exception 'KPI target governance requires an active School Guardian or Vision Custodian role.';
  end if;

  if v_direction not in ('baseline_only','higher_is_better','lower_is_better','binary_control') then
    raise exception 'Unsupported KPI direction.';
  end if;
  if jsonb_typeof(coalesce(p_target_config,'{}'::jsonb))<>'object' then
    raise exception 'KPI target configuration must be an object.';
  end if;

  select v.* into v_current
  from public.khpos_ops_kpi_versions v
  join public.khpos_ops_kpis k on k.id=v.kpi_id
  where v.kpi_id=p_kpi_id
    and v.status='active'
    and k.organisation_id=p_organisation_id
    and k.status='active'
  for update;

  if v_current.id is null then raise exception 'Active KPI definition not found.'; end if;

  perform khpos_private.ops_kpi_status(v_direction,coalesce(p_target_config,'{}'::jsonb),0);

  select coalesce(max(version),0)+1 into v_next_version
  from public.khpos_ops_kpi_versions
  where kpi_id=p_kpi_id;

  update public.khpos_ops_kpi_versions
  set status='superseded'
  where id=v_current.id;

  insert into public.khpos_ops_kpi_versions(
    kpi_id,version,definition,owner_role_id,scope_type,scope_role_id,campus_id,unit_id,system_code,
    indicator_type,unit,direction,cadence,source_type,source_key,target_config,critical_control,
    effective_date,approved_by,approved_at,status
  ) values (
    v_current.kpi_id,v_next_version,v_current.definition,v_current.owner_role_id,
    v_current.scope_type,v_current.scope_role_id,v_current.campus_id,v_current.unit_id,
    v_current.system_code,v_current.indicator_type,v_current.unit,v_direction,
    v_current.cadence,v_current.source_type,v_current.source_key,
    coalesce(p_target_config,'{}'::jsonb),v_current.critical_control,
    current_date,p_actor_user_id,now(),'active'
  ) returning id into v_new_id;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_kpi_target_configured','kpi',p_kpi_id,
    jsonb_build_object(
      'previousVersionId',v_current.id,
      'newVersionId',v_new_id,
      'direction',v_direction,
      'note',nullif(btrim(coalesce(p_note,'')),'')
    )
  );

  return v_new_id;
end;
$$;

create or replace function public.khpos_ops_retire_kpi_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_kpi_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
begin
  if not khpos_private.ops_can_govern_performance(p_actor_user_id,p_organisation_id) then
    raise exception 'KPI retirement requires an active School Guardian or Vision Custodian role.';
  end if;
  if nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'A retirement reason is required.';
  end if;
  if not exists(
    select 1 from public.khpos_ops_kpis
    where id=p_kpi_id and organisation_id=p_organisation_id and status='active'
  ) then
    raise exception 'Active KPI not found.';
  end if;

  update public.khpos_ops_kpis
  set status='retired',updated_at=now()
  where id=p_kpi_id and organisation_id=p_organisation_id;

  update public.khpos_ops_kpi_versions
  set status='archived'
  where kpi_id=p_kpi_id and status='active';

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_kpi_retired','kpi',p_kpi_id,
    jsonb_build_object('reason',left(btrim(p_note),4000))
  );
end;
$$;

revoke execute on function khpos_private.ops_kpi_status(text,jsonb,numeric)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_can_govern_performance(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_get_performance_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_kpi_server(uuid,uuid,jsonb)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_record_kpi_measurement_server(uuid,uuid,uuid,date,date,numeric,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_configure_kpi_target_server(uuid,uuid,uuid,text,jsonb,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_retire_kpi_server(uuid,uuid,uuid,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_kpi_status(text,jsonb,numeric) to service_role;
grant execute on function khpos_private.ops_can_govern_performance(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_get_performance_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_kpi_server(uuid,uuid,jsonb) to service_role;
grant execute on function public.khpos_ops_record_kpi_measurement_server(uuid,uuid,uuid,date,date,numeric,text,text) to service_role;
grant execute on function public.khpos_ops_configure_kpi_target_server(uuid,uuid,uuid,text,jsonb,text) to service_role;
grant execute on function public.khpos_ops_retire_kpi_server(uuid,uuid,uuid,text) to service_role;
