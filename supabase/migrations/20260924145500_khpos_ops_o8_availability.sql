create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_staff_availability_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  affected_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  case_reference text not null,
  case_type text not null
    check (case_type in ('planned_leave','unplanned_absence','late_arrival','early_departure','other_availability')),
  source_type text not null default 'self_report'
    check (source_type in ('self_report','leader_record','third_party_exception')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason_category text not null default 'not_disclosed'
    check (reason_category in ('not_disclosed','personal','family','emergency','transport','official_duty','other')),
  reason_note text,
  source_reference text,
  coverage_required boolean not null default false,
  coverage_confirmed_by uuid references auth.users(id) on delete set null,
  coverage_confirmed_at timestamptz,
  status text not null
    check (status in ('pending_approval','coverage_required','approved','active','returned','declined','cancelled','closed')),
  requested_by uuid references auth.users(id) on delete set null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  actual_return_at timestamptz,
  return_confirmed_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  unique (organisation_id,case_reference)
);

create index if not exists idx_khpos_ops_availability_org_status
  on public.khpos_ops_staff_availability_cases(organisation_id,status,start_at);
create index if not exists idx_khpos_ops_availability_staff
  on public.khpos_ops_staff_availability_cases(staff_id,status,start_at desc);
create index if not exists idx_khpos_ops_availability_assignment
  on public.khpos_ops_staff_availability_cases(affected_assignment_id,status);
create index if not exists idx_khpos_ops_availability_requested_by
  on public.khpos_ops_staff_availability_cases(requested_by,created_at desc)
  where requested_by is not null;
create index if not exists idx_khpos_ops_availability_recorded_by
  on public.khpos_ops_staff_availability_cases(recorded_by,created_at desc);
create index if not exists idx_khpos_ops_availability_decided_by
  on public.khpos_ops_staff_availability_cases(decided_by,decided_at desc)
  where decided_by is not null;
create index if not exists idx_khpos_ops_availability_coverage_confirmed_by
  on public.khpos_ops_staff_availability_cases(coverage_confirmed_by,coverage_confirmed_at desc)
  where coverage_confirmed_by is not null;
create index if not exists idx_khpos_ops_availability_return_confirmed_by
  on public.khpos_ops_staff_availability_cases(return_confirmed_by,actual_return_at desc)
  where return_confirmed_by is not null;
create index if not exists idx_khpos_ops_availability_closed_by
  on public.khpos_ops_staff_availability_cases(closed_by,closed_at desc)
  where closed_by is not null;

create table if not exists public.khpos_ops_staff_coverage_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  availability_case_id uuid not null references public.khpos_ops_staff_availability_cases(id) on delete cascade,
  cover_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  coverage_scope text not null,
  status text not null default 'assigned'
    check (status in ('assigned','accepted','declined','completed','cancelled')),
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  response_note text,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  unique (availability_case_id,cover_assignment_id,start_at,end_at)
);

create index if not exists idx_khpos_ops_coverage_case
  on public.khpos_ops_staff_coverage_assignments(availability_case_id,status,start_at);
create index if not exists idx_khpos_ops_coverage_assignment
  on public.khpos_ops_staff_coverage_assignments(cover_assignment_id,status,start_at);
create index if not exists idx_khpos_ops_coverage_assigned_by
  on public.khpos_ops_staff_coverage_assignments(assigned_by,assigned_at desc);
create index if not exists idx_khpos_ops_coverage_responded_by
  on public.khpos_ops_staff_coverage_assignments(responded_by,responded_at desc)
  where responded_by is not null;
create index if not exists idx_khpos_ops_coverage_completed_by
  on public.khpos_ops_staff_coverage_assignments(completed_by,completed_at desc)
  where completed_by is not null;

create table if not exists public.khpos_ops_staff_availability_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  availability_case_id uuid not null references public.khpos_ops_staff_availability_cases(id) on delete cascade,
  coverage_assignment_id uuid references public.khpos_ops_staff_coverage_assignments(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_availability_events_case
  on public.khpos_ops_staff_availability_events(availability_case_id,created_at desc);
create index if not exists idx_khpos_ops_availability_events_coverage
  on public.khpos_ops_staff_availability_events(coverage_assignment_id,created_at desc)
  where coverage_assignment_id is not null;
create index if not exists idx_khpos_ops_availability_events_actor
  on public.khpos_ops_staff_availability_events(actor_user_id,created_at desc)
  where actor_user_id is not null;

alter table public.khpos_ops_staff_availability_cases enable row level security;
alter table public.khpos_ops_staff_coverage_assignments enable row level security;
alter table public.khpos_ops_staff_availability_events enable row level security;

revoke all privileges on table public.khpos_ops_staff_availability_cases from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_coverage_assignments from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_availability_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_staff_availability_cases to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_coverage_assignments to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_availability_events to service_role;

create or replace function khpos_private.ops_availability_has_membership(
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
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  );
$$;

create or replace function khpos_private.ops_availability_can_review_staff(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_staff s
    where s.id=p_staff_id
      and s.organisation_id=p_organisation_id
      and s.status='active'
      and s.user_id is distinct from p_actor_user_id
      and (
        khpos_private.ops_can_manage_people(p_actor_user_id,p_organisation_id)
        or exists(
          select 1
          from public.khpos_ops_role_assignments a
          join public.khpos_ops_roles r on r.id=a.role_id
          where a.user_id=p_actor_user_id
            and a.status='active'
            and r.organisation_id=p_organisation_id
            and r.status='active'
            and khpos_private.ops_role_is_ancestor(
              p_organisation_id,s.desired_role_id,r.id
            )
        )
      )
  );
$$;

create or replace function khpos_private.ops_availability_staff_is_self(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_staff s
    where s.id=p_staff_id
      and s.organisation_id=p_organisation_id
      and s.status='active'
      and s.user_id=p_actor_user_id
  );
$$;

create or replace function public.khpos_ops_get_availability_server(
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
  v_can_manage_people boolean := false;
  v_can_manage_availability boolean := false;
  v_staff_options jsonb := '[]'::jsonb;
  v_coverage_candidates jsonb := '[]'::jsonb;
  v_cases jsonb := '[]'::jsonb;
  v_pending integer := 0;
  v_coverage_gaps integer := 0;
  v_active integer := 0;
  v_overdue_return integer := 0;
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

  v_can_manage_people := khpos_private.ops_can_manage_people(
    p_actor_user_id,p_organisation_id
  );

  select (
    v_can_manage_people
    or exists(
      select 1
      from public.khpos_ops_staff s
      where s.organisation_id=p_organisation_id
        and s.status='active'
        and khpos_private.ops_availability_can_review_staff(
          p_actor_user_id,p_organisation_id,s.id
        )
    )
  ) into v_can_manage_availability;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'reference',s.staff_reference,
    'displayName',s.display_name,
    'roleTitle',r.title,
    'roleCode',r.code,
    'assignmentId',s.role_assignment_id,
    'campusName',c.name,
    'unitName',u.name,
    'isSelf',s.user_id=p_actor_user_id,
    'canReview',khpos_private.ops_availability_can_review_staff(
      p_actor_user_id,p_organisation_id,s.id
    )
  ) order by r.role_level,lower(s.display_name)),'[]'::jsonb)
  into v_staff_options
  from public.khpos_ops_staff s
  join public.khpos_ops_roles r on r.id=s.desired_role_id
  left join public.khpos_ops_campuses c on c.id=s.campus_id
  left join public.khpos_ops_units u on u.id=s.unit_id
  where s.organisation_id=p_organisation_id
    and s.status='active'
    and s.role_assignment_id is not null
    and (
      s.user_id=p_actor_user_id
      or khpos_private.ops_availability_can_review_staff(
        p_actor_user_id,p_organisation_id,s.id
      )
    );

  if v_can_manage_availability then
    select coalesce(jsonb_agg(jsonb_build_object(
      'staffId',s.id,
      'assignmentId',s.role_assignment_id,
      'displayName',s.display_name,
      'roleTitle',r.title,
      'campusName',c.name,
      'unitName',u.name
    ) order by r.role_level,lower(s.display_name)),'[]'::jsonb)
    into v_coverage_candidates
    from public.khpos_ops_staff s
    join public.khpos_ops_roles r on r.id=s.desired_role_id
    left join public.khpos_ops_campuses c on c.id=s.campus_id
    left join public.khpos_ops_units u on u.id=s.unit_id
    where s.organisation_id=p_organisation_id
      and s.status='active'
      and s.role_assignment_id is not null
      and (
        v_can_manage_people
        or khpos_private.ops_availability_can_review_staff(
          p_actor_user_id,p_organisation_id,s.id
        )
        or s.user_id=p_actor_user_id
      );
  end if;

  with visible as (
    select
      ac.*,
      s.display_name as staff_name,
      s.staff_reference,
      s.user_id as staff_user_id,
      r.title as role_title,
      c.name as campus_name,
      u.name as unit_name,
      khpos_private.ops_availability_can_review_staff(
        p_actor_user_id,p_organisation_id,s.id
      ) as can_review,
      (s.user_id=p_actor_user_id) as is_self,
      exists(
        select 1
        from public.khpos_ops_staff_coverage_assignments ca
        join public.khpos_ops_role_assignments ra on ra.id=ca.cover_assignment_id
        where ca.availability_case_id=ac.id
          and ra.user_id=p_actor_user_id
          and ra.status='active'
      ) as is_coverer
    from public.khpos_ops_staff_availability_cases ac
    join public.khpos_ops_staff s on s.id=ac.staff_id
    join public.khpos_ops_roles r on r.id=s.desired_role_id
    left join public.khpos_ops_campuses c on c.id=s.campus_id
    left join public.khpos_ops_units u on u.id=s.unit_id
    where ac.organisation_id=p_organisation_id
      and (
        s.user_id=p_actor_user_id
        or khpos_private.ops_availability_can_review_staff(
          p_actor_user_id,p_organisation_id,s.id
        )
        or exists(
          select 1
          from public.khpos_ops_staff_coverage_assignments ca
          join public.khpos_ops_role_assignments ra on ra.id=ca.cover_assignment_id
          where ca.availability_case_id=ac.id
            and ra.user_id=p_actor_user_id
            and ra.status='active'
        )
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,
    'reference',v.case_reference,
    'staffId',v.staff_id,
    'staffName',v.staff_name,
    'staffReference',v.staff_reference,
    'roleTitle',v.role_title,
    'campusName',v.campus_name,
    'unitName',v.unit_name,
    'caseType',v.case_type,
    'sourceType',v.source_type,
    'startAt',v.start_at,
    'endAt',v.end_at,
    'reasonCategory',case when v.is_self or v.can_review then v.reason_category else null end,
    'reasonNote',case when v.is_self or v.can_review then v.reason_note else null end,
    'sourceReference',case when v.can_review then v.source_reference else null end,
    'coverageRequired',v.coverage_required,
    'coverageConfirmed',v.coverage_confirmed_at is not null,
    'coverageConfirmedAt',v.coverage_confirmed_at,
    'status',v.status,
    'decisionNote',case when v.is_self or v.can_review then v.decision_note else null end,
    'decidedAt',v.decided_at,
    'actualReturnAt',v.actual_return_at,
    'createdAt',v.created_at,
    'isSelf',v.is_self,
    'canReview',v.can_review,
    'isCoverer',v.is_coverer,
    'coverage',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ca.id,
        'coverAssignmentId',ca.cover_assignment_id,
        'coverStaffId',cs.id,
        'coverStaffName',cs.display_name,
        'coverRoleTitle',cr.title,
        'startAt',ca.start_at,
        'endAt',ca.end_at,
        'coverageScope',ca.coverage_scope,
        'status',ca.status,
        'responseNote',case
          when v.can_review
            or ca.cover_assignment_id in (
              select a.id from public.khpos_ops_role_assignments a
              where a.user_id=p_actor_user_id and a.status='active'
            )
          then ca.response_note else null end,
        'completionNote',case
          when v.can_review
            or ca.cover_assignment_id in (
              select a.id from public.khpos_ops_role_assignments a
              where a.user_id=p_actor_user_id and a.status='active'
            )
          then ca.completion_note else null end,
        'assignedAt',ca.assigned_at,
        'respondedAt',ca.responded_at,
        'completedAt',ca.completed_at,
        'isCoverer',exists(
          select 1 from public.khpos_ops_role_assignments a
          where a.id=ca.cover_assignment_id
            and a.user_id=p_actor_user_id
            and a.status='active'
        ),
        'canAct',exists(
          select 1 from public.khpos_ops_role_assignments a
          where a.id=ca.cover_assignment_id
            and a.user_id=p_actor_user_id
            and a.status='active'
        ) or v.can_review
      ) order by ca.start_at,ca.created_at)
      from public.khpos_ops_staff_coverage_assignments ca
      join public.khpos_ops_role_assignments cra on cra.id=ca.cover_assignment_id
      left join public.khpos_ops_staff cs
        on cs.role_assignment_id=cra.id
        and cs.organisation_id=p_organisation_id
        and cs.status='active'
      join public.khpos_ops_roles cr on cr.id=cra.role_id
      where ca.availability_case_id=v.id
    ),'[]'::jsonb),
    'history',case when v.is_self or v.can_review then coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventType',e.event_type,
        'fromStatus',e.from_status,
        'toStatus',e.to_status,
        'note',e.note,
        'createdAt',e.created_at
      ) order by e.created_at desc)
      from (
        select event_type,from_status,to_status,note,created_at
        from public.khpos_ops_staff_availability_events
        where availability_case_id=v.id
        order by created_at desc
        limit 20
      ) e
    ),'[]'::jsonb) else '[]'::jsonb end
  ) order by
    case v.status
      when 'pending_approval' then 1
      when 'coverage_required' then 2
      when 'active' then 3
      when 'approved' then 4
      when 'returned' then 5
      when 'declined' then 6
      when 'cancelled' then 7
      else 8
    end,
    v.start_at desc
  ),'[]'::jsonb)
  into v_cases
  from visible v;

  with visible as (
    select ac.*
    from public.khpos_ops_staff_availability_cases ac
    join public.khpos_ops_staff s on s.id=ac.staff_id
    where ac.organisation_id=p_organisation_id
      and (
        s.user_id=p_actor_user_id
        or khpos_private.ops_availability_can_review_staff(
          p_actor_user_id,p_organisation_id,s.id
        )
        or exists(
          select 1
          from public.khpos_ops_staff_coverage_assignments ca
          join public.khpos_ops_role_assignments ra on ra.id=ca.cover_assignment_id
          where ca.availability_case_id=ac.id
            and ra.user_id=p_actor_user_id
            and ra.status='active'
        )
      )
  )
  select
    count(*) filter (where status='pending_approval')::integer,
    count(*) filter (where status='coverage_required')::integer,
    count(*) filter (where status in ('active','approved') and start_at<=now() and end_at>=now())::integer,
    count(*) filter (
      where status in ('active','approved','coverage_required')
        and end_at<now()
    )::integer
  into v_pending,v_coverage_gaps,v_active,v_overdue_return
  from visible;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canManageAvailability',v_can_manage_availability,
    'attendanceBoundary','Raw clock-in, attendance and payroll attendance calculations remain in the designated school/HR system. KHP-OS governs exceptions, approvals, coverage and return-to-work visibility.',
    'staffOptions',v_staff_options,
    'coverageCandidates',v_coverage_candidates,
    'summary',jsonb_build_object(
      'pendingApproval',v_pending,
      'coverageGaps',v_coverage_gaps,
      'currentlyUnavailable',v_active,
      'overdueReturn',v_overdue_return
    ),
    'cases',v_cases
  );
end;
$$;

create or replace function public.khpos_ops_create_availability_case_server(
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
  v_staff_id uuid;
  v_staff public.khpos_ops_staff%rowtype;
  v_role_code text;
  v_case_type text := lower(nullif(btrim(p_input->>'caseType'),''));
  v_source_type text := lower(coalesce(nullif(btrim(p_input->>'sourceType'),''),'self_report'));
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_reason_category text := lower(coalesce(nullif(btrim(p_input->>'reasonCategory'),''),'not_disclosed'));
  v_reason_note text := nullif(btrim(coalesce(p_input->>'reasonNote','')),'');
  v_source_reference text := nullif(btrim(coalesce(p_input->>'sourceReference','')),'');
  v_coverage_required boolean := coalesce((p_input->>'coverageRequired')::boolean,false);
  v_is_self boolean := false;
  v_can_review boolean := false;
  v_status text;
  v_case_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_availability_has_membership(p_actor_user_id,p_organisation_id) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  begin v_staff_id := (p_input->>'staffId')::uuid;
  exception when others then raise exception 'A valid active staff record is required.'; end;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_staff_id
    and organisation_id=p_organisation_id
    and status='active'
    and role_assignment_id is not null
  for update;

  if v_staff.id is null then
    raise exception 'Only active deployed staff can use the availability workflow.';
  end if;

  select code into v_role_code
  from public.khpos_ops_roles
  where id=v_staff.desired_role_id
    and organisation_id=p_organisation_id
    and status='active';

  v_is_self := v_staff.user_id=p_actor_user_id;
  v_can_review := khpos_private.ops_availability_can_review_staff(
    p_actor_user_id,p_organisation_id,v_staff.id
  );

  if not v_is_self and not v_can_review then
    raise exception 'This staff availability record is outside your reporting authority.';
  end if;

  if v_case_type not in ('planned_leave','unplanned_absence','late_arrival','early_departure','other_availability') then
    raise exception 'Unsupported availability case type.';
  end if;

  if v_source_type not in ('self_report','leader_record','third_party_exception') then
    raise exception 'Unsupported availability source type.';
  end if;

  if v_is_self and v_source_type<>'self_report' then
    raise exception 'Staff self-reporting must use the self-report source.';
  end if;

  if not v_is_self and v_source_type='self_report' then
    raise exception 'Leaders cannot submit another staff member as a self-report.';
  end if;

  begin v_start_at := (p_input->>'startAt')::timestamptz;
  exception when others then raise exception 'Availability start time is invalid.'; end;
  begin v_end_at := (p_input->>'endAt')::timestamptz;
  exception when others then raise exception 'Availability end time is invalid.'; end;

  if v_end_at<=v_start_at then
    raise exception 'Availability end time must be after the start time.';
  end if;

  if v_reason_category not in ('not_disclosed','personal','family','emergency','transport','official_duty','other') then
    raise exception 'Unsupported reason category.';
  end if;

  if length(coalesce(v_reason_note,''))>2000 then
    raise exception 'Availability note is too long.';
  end if;

  if length(coalesce(v_source_reference,''))>500 then
    raise exception 'Source reference is too long.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff_availability_cases existing
    where existing.staff_id=v_staff.id
      and existing.status not in ('declined','cancelled','closed')
      and tstzrange(existing.start_at,existing.end_at,'[)')
          && tstzrange(v_start_at,v_end_at,'[)')
  ) then
    raise exception 'This staff member already has an overlapping open availability case.';
  end if;

  if v_case_type='planned_leave' then
    if v_is_self and v_role_code='VISION_CUSTODIAN' then
      v_status := case when v_coverage_required then 'coverage_required' else 'approved' end;
    else
      v_status := 'pending_approval';
    end if;
  else
    v_status := case when v_coverage_required then 'coverage_required' else 'active' end;
  end if;

  v_reference := 'AVL-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_availability_cases(
    organisation_id,staff_id,affected_assignment_id,case_reference,case_type,
    source_type,start_at,end_at,reason_category,reason_note,source_reference,
    coverage_required,status,requested_by,recorded_by
  ) values (
    p_organisation_id,v_staff.id,v_staff.role_assignment_id,v_reference,v_case_type,
    v_source_type,v_start_at,v_end_at,v_reason_category,left(v_reason_note,2000),
    left(v_source_reference,500),v_coverage_required,v_status,
    case when v_is_self then p_actor_user_id else null end,p_actor_user_id
  ) returning id into v_case_id;

  insert into public.khpos_ops_staff_availability_events(
    organisation_id,availability_case_id,actor_user_id,event_type,to_status,note,metadata
  ) values (
    p_organisation_id,v_case_id,p_actor_user_id,'availability_created',v_status,
    left(v_reason_note,2000),
    jsonb_build_object(
      'caseType',v_case_type,
      'sourceType',v_source_type,
      'coverageRequired',v_coverage_required,
      'roleCode',v_role_code
    )
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_availability_created',
    'staff_availability',v_case_id,
    jsonb_build_object(
      'reference',v_reference,
      'staffId',v_staff.id,
      'caseType',v_case_type,
      'status',v_status
    )
  );

  return v_case_id;
end;
$$;

create or replace function public.khpos_ops_availability_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_action text,
  p_note text default null,
  p_coverage_required boolean default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_availability_cases%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_is_self boolean := false;
  v_can_review boolean := false;
  v_from_status text;
  v_to_status text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_coverage_required boolean;
begin
  if not khpos_private.ops_availability_has_membership(p_actor_user_id,p_organisation_id) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_case
  from public.khpos_ops_staff_availability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Availability case not found.'; end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_case.staff_id and organisation_id=p_organisation_id;

  if v_staff.id is null then raise exception 'Staff record not found.'; end if;

  v_is_self := v_staff.user_id=p_actor_user_id;
  v_can_review := khpos_private.ops_availability_can_review_staff(
    p_actor_user_id,p_organisation_id,v_staff.id
  );

  if not v_is_self and not v_can_review then
    raise exception 'This availability case is outside your authority.';
  end if;

  v_from_status := v_case.status;
  v_coverage_required := coalesce(p_coverage_required,v_case.coverage_required);

  if p_action='approve' then
    if not v_can_review then
      raise exception 'Only the appropriate reporting leader can approve planned leave.';
    end if;
    if v_case.status<>'pending_approval' then
      raise exception 'Only pending planned leave can be approved.';
    end if;

    v_to_status := case when v_coverage_required then 'coverage_required' else 'approved' end;

    update public.khpos_ops_staff_availability_cases
    set status=v_to_status,
        coverage_required=v_coverage_required,
        decided_by=p_actor_user_id,
        decided_at=now(),
        decision_note=left(v_note,2000),
        updated_at=now()
    where id=v_case.id;

  elsif p_action='decline' then
    if not v_can_review then
      raise exception 'Only the appropriate reporting leader can decline planned leave.';
    end if;
    if v_case.status<>'pending_approval' then
      raise exception 'Only pending planned leave can be declined.';
    end if;
    if v_note is null then raise exception 'Explain why the leave request was declined.'; end if;

    v_to_status := 'declined';
    update public.khpos_ops_staff_availability_cases
    set status='declined',
        decided_by=p_actor_user_id,
        decided_at=now(),
        decision_note=left(v_note,2000),
        updated_at=now()
    where id=v_case.id;

  elsif p_action='cancel' then
    if v_case.status not in ('pending_approval','coverage_required','approved') then
      raise exception 'Only a pending or future approved availability case can be cancelled.';
    end if;
    if v_is_self and v_case.start_at<=now() then
      raise exception 'An availability case that has started must be returned/closed rather than cancelled.';
    end if;
    if not v_is_self and not v_can_review then
      raise exception 'This availability case cannot be cancelled by this user.';
    end if;

    v_to_status := 'cancelled';
    update public.khpos_ops_staff_availability_cases
    set status='cancelled',
        decision_note=coalesce(left(v_note,2000),decision_note),
        updated_at=now()
    where id=v_case.id;

    update public.khpos_ops_staff_coverage_assignments
    set status='cancelled',
        updated_at=now()
    where availability_case_id=v_case.id
      and status in ('assigned','accepted');

  elsif p_action='require_coverage' then
    if not v_can_review then
      raise exception 'Only the appropriate reporting leader can require coverage.';
    end if;
    if v_case.status not in ('approved','active','pending_approval') then
      raise exception 'Coverage can only be required for an open availability case.';
    end if;

    v_to_status := 'coverage_required';
    update public.khpos_ops_staff_availability_cases
    set coverage_required=true,
        coverage_confirmed_by=null,
        coverage_confirmed_at=null,
        status='coverage_required',
        updated_at=now()
    where id=v_case.id;

  elsif p_action='confirm_coverage' then
    if not v_can_review then
      raise exception 'Only the appropriate reporting leader can confirm the coverage plan.';
    end if;
    if v_case.status<>'coverage_required' or not v_case.coverage_required then
      raise exception 'This availability case is not waiting for coverage confirmation.';
    end if;
    if not exists(
      select 1
      from public.khpos_ops_staff_coverage_assignments ca
      where ca.availability_case_id=v_case.id
        and ca.status in ('accepted','completed')
    ) then
      raise exception 'At least one assigned colleague must accept coverage before the plan can be confirmed.';
    end if;

    v_to_status := case when v_case.case_type='planned_leave' then 'approved' else 'active' end;
    update public.khpos_ops_staff_availability_cases
    set status=v_to_status,
        coverage_confirmed_by=p_actor_user_id,
        coverage_confirmed_at=now(),
        updated_at=now()
    where id=v_case.id;

  elsif p_action='return' then
    if v_case.status not in ('approved','active','coverage_required') then
      raise exception 'Only an open approved/active availability case can be marked returned.';
    end if;
    if not v_is_self and not v_can_review then
      raise exception 'This availability case cannot be marked returned by this user.';
    end if;
    if v_is_self and now()<v_case.start_at then
      raise exception 'A future availability case should be cancelled rather than marked returned.';
    end if;

    v_to_status := 'returned';
    update public.khpos_ops_staff_availability_cases
    set status='returned',
        actual_return_at=now(),
        return_confirmed_by=p_actor_user_id,
        updated_at=now()
    where id=v_case.id;

  elsif p_action='close' then
    if not v_can_review then
      raise exception 'Only the appropriate reporting leader can close a returned availability case.';
    end if;
    if v_case.status<>'returned' then
      raise exception 'Only a returned availability case can be closed.';
    end if;

    v_to_status := 'closed';
    update public.khpos_ops_staff_availability_cases
    set status='closed',
        closed_by=p_actor_user_id,
        closed_at=now(),
        updated_at=now()
    where id=v_case.id;

  else
    raise exception 'Unsupported availability action.';
  end if;

  insert into public.khpos_ops_staff_availability_events(
    organisation_id,availability_case_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'availability_'||p_action,
    v_from_status,v_to_status,left(v_note,2000),
    jsonb_build_object('coverageRequired',v_coverage_required)
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_availability_'||p_action,
    'staff_availability',v_case.id,
    jsonb_build_object('fromStatus',v_from_status,'toStatus',v_to_status)
  );
end;
$$;

create or replace function public.khpos_ops_assign_coverage_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_cover_assignment_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_scope text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_availability_cases%rowtype;
  v_unavailable_staff public.khpos_ops_staff%rowtype;
  v_cover_staff public.khpos_ops_staff%rowtype;
  v_scope text := nullif(btrim(coalesce(p_scope,'')),'');
  v_coverage_id uuid;
begin
  if not khpos_private.ops_availability_has_membership(p_actor_user_id,p_organisation_id) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_case
  from public.khpos_ops_staff_availability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Availability case not found.'; end if;

  select * into v_unavailable_staff
  from public.khpos_ops_staff
  where id=v_case.staff_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_unavailable_staff.id is null then
    raise exception 'Unavailable staff record not found.';
  end if;

  if not khpos_private.ops_availability_can_review_staff(
    p_actor_user_id,p_organisation_id,v_case.staff_id
  ) then
    raise exception 'Only the appropriate reporting leader can assign temporary coverage.';
  end if;

  if v_case.status in ('declined','cancelled','returned','closed') then
    raise exception 'Coverage cannot be assigned to a closed availability case.';
  end if;

  if not v_case.coverage_required then
    raise exception 'Mark the availability case as requiring coverage before assigning a colleague.';
  end if;

  if v_scope is null then raise exception 'Describe what the covering colleague is expected to cover.'; end if;
  if length(v_scope)>1500 then raise exception 'Coverage scope is too long.'; end if;
  if p_end_at<=p_start_at then raise exception 'Coverage end time must be after the start time.'; end if;
  if p_start_at<v_case.start_at or p_end_at>v_case.end_at then
    raise exception 'Coverage timing must sit within the availability period.';
  end if;
  if p_cover_assignment_id=v_case.affected_assignment_id then
    raise exception 'A staff member cannot cover their own unavailable assignment.';
  end if;

  select s.* into v_cover_staff
  from public.khpos_ops_staff s
  join public.khpos_ops_role_assignments a on a.id=s.role_assignment_id
  join public.khpos_ops_roles r on r.id=a.role_id
  where s.organisation_id=p_organisation_id
    and s.status='active'
    and s.role_assignment_id=p_cover_assignment_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.status='active'
  limit 1;

  if v_cover_staff.id is null then
    raise exception 'Coverage must be assigned to another active deployed staff member.';
  end if;

  if v_cover_staff.user_id is not null
     and v_unavailable_staff.user_id is not null
     and v_cover_staff.user_id=v_unavailable_staff.user_id then
    raise exception 'The unavailable person cannot cover their own absence through another role assignment.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff_availability_cases ac
    where ac.staff_id=v_cover_staff.id
      and ac.status not in ('declined','cancelled','closed','returned')
      and tstzrange(ac.start_at,ac.end_at,'[)')
          && tstzrange(p_start_at,p_end_at,'[)')
  ) then
    raise exception 'The proposed covering staff member has an overlapping availability exception.';
  end if;

  insert into public.khpos_ops_staff_coverage_assignments(
    organisation_id,availability_case_id,cover_assignment_id,start_at,end_at,
    coverage_scope,status,assigned_by
  ) values (
    p_organisation_id,v_case.id,p_cover_assignment_id,p_start_at,p_end_at,
    left(v_scope,1500),'assigned',p_actor_user_id
  ) returning id into v_coverage_id;

  insert into public.khpos_ops_staff_availability_events(
    organisation_id,availability_case_id,coverage_assignment_id,
    actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_case.id,v_coverage_id,p_actor_user_id,
    'coverage_assigned',left(v_scope,1500),
    jsonb_build_object(
      'coverAssignmentId',p_cover_assignment_id,
      'startAt',p_start_at,
      'endAt',p_end_at
    )
  );

  return v_coverage_id;
exception when unique_violation then
  raise exception 'This exact coverage assignment already exists.';
end;
$$;

create or replace function public.khpos_ops_coverage_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_coverage_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_coverage public.khpos_ops_staff_coverage_assignments%rowtype;
  v_case public.khpos_ops_staff_availability_cases%rowtype;
  v_cover_user uuid;
  v_can_review boolean := false;
  v_is_coverer boolean := false;
  v_from_status text;
  v_to_status text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  if not khpos_private.ops_availability_has_membership(p_actor_user_id,p_organisation_id) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_coverage
  from public.khpos_ops_staff_coverage_assignments
  where id=p_coverage_id and organisation_id=p_organisation_id
  for update;

  if v_coverage.id is null then raise exception 'Coverage assignment not found.'; end if;

  select * into v_case
  from public.khpos_ops_staff_availability_cases
  where id=v_coverage.availability_case_id
    and organisation_id=p_organisation_id;

  if v_case.id is null then raise exception 'Availability case not found.'; end if;

  select user_id into v_cover_user
  from public.khpos_ops_role_assignments
  where id=v_coverage.cover_assignment_id
    and status='active';

  v_is_coverer := v_cover_user=p_actor_user_id;
  v_can_review := khpos_private.ops_availability_can_review_staff(
    p_actor_user_id,p_organisation_id,v_case.staff_id
  );
  v_from_status := v_coverage.status;

  if p_action='accept' then
    if not v_is_coverer then
      raise exception 'Only the assigned covering staff member can accept coverage.';
    end if;
    if v_coverage.status<>'assigned' then
      raise exception 'Only an assigned coverage request can be accepted.';
    end if;

    v_to_status := 'accepted';
    update public.khpos_ops_staff_coverage_assignments
    set status='accepted',
        responded_by=p_actor_user_id,
        responded_at=now(),
        response_note=left(v_note,1500),
        updated_at=now()
    where id=v_coverage.id;

  elsif p_action='decline' then
    if not v_is_coverer then
      raise exception 'Only the assigned covering staff member can decline coverage.';
    end if;
    if v_coverage.status<>'assigned' then
      raise exception 'Only an assigned coverage request can be declined.';
    end if;
    if v_note is null then raise exception 'Explain why this coverage cannot be accepted.'; end if;

    v_to_status := 'declined';
    update public.khpos_ops_staff_coverage_assignments
    set status='declined',
        responded_by=p_actor_user_id,
        responded_at=now(),
        response_note=left(v_note,1500),
        updated_at=now()
    where id=v_coverage.id;

  elsif p_action='complete' then
    if not v_is_coverer and not v_can_review then
      raise exception 'Only the covering staff member or reporting leader can complete coverage.';
    end if;
    if v_coverage.status<>'accepted' then
      raise exception 'Only accepted coverage can be completed.';
    end if;
    if v_note is null then raise exception 'Record a short completion note for the coverage handback.'; end if;

    v_to_status := 'completed';
    update public.khpos_ops_staff_coverage_assignments
    set status='completed',
        completed_by=p_actor_user_id,
        completed_at=now(),
        completion_note=left(v_note,1500),
        updated_at=now()
    where id=v_coverage.id;

  elsif p_action='cancel' then
    if not v_can_review then
      raise exception 'Only the appropriate reporting leader can cancel a coverage assignment.';
    end if;
    if v_coverage.status not in ('assigned','accepted') then
      raise exception 'Only active coverage assignments can be cancelled.';
    end if;
    if v_coverage.status='accepted' and v_note is null then
      raise exception 'Explain why accepted coverage is being cancelled.';
    end if;

    v_to_status := 'cancelled';
    update public.khpos_ops_staff_coverage_assignments
    set status='cancelled',
        completion_note=left(v_note,1500),
        updated_at=now()
    where id=v_coverage.id;

  else
    raise exception 'Unsupported coverage action.';
  end if;

  insert into public.khpos_ops_staff_availability_events(
    organisation_id,availability_case_id,coverage_assignment_id,
    actor_user_id,event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,v_coverage.id,p_actor_user_id,
    'coverage_'||p_action,v_from_status,v_to_status,left(v_note,1500)
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_coverage_'||p_action,
    'staff_coverage',v_coverage.id,
    jsonb_build_object(
      'availabilityCaseId',v_case.id,
      'fromStatus',v_from_status,
      'toStatus',v_to_status
    )
  );
end;
$$;

revoke execute on function khpos_private.ops_availability_has_membership(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_availability_can_review_staff(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_availability_staff_is_self(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_get_availability_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_availability_case_server(uuid,uuid,jsonb)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_availability_action_server(uuid,uuid,uuid,text,text,boolean)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_assign_coverage_server(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_coverage_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_availability_has_membership(uuid,uuid)
  to service_role;
grant execute on function khpos_private.ops_availability_can_review_staff(uuid,uuid,uuid)
  to service_role;
grant execute on function khpos_private.ops_availability_staff_is_self(uuid,uuid,uuid)
  to service_role;
grant execute on function public.khpos_ops_get_availability_server(uuid,uuid)
  to service_role;
grant execute on function public.khpos_ops_create_availability_case_server(uuid,uuid,jsonb)
  to service_role;
grant execute on function public.khpos_ops_availability_action_server(uuid,uuid,uuid,text,text,boolean)
  to service_role;
grant execute on function public.khpos_ops_assign_coverage_server(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text)
  to service_role;
grant execute on function public.khpos_ops_coverage_action_server(uuid,uuid,uuid,text,text)
  to service_role;
