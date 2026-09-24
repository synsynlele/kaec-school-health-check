create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_staff_performance_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  affected_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  review_reference text not null,
  review_type text not null
    check (review_type in ('probation','monthly_check_in','term_review','annual_review','support_review')),
  period_start date not null,
  period_end date not null,
  status text not null default 'open'
    check (status in ('open','self_submitted','leader_reviewed','completed','cancelled')),
  performance_state text not null default 'not_assessed'
    check (performance_state in ('not_assessed','on_track','support_required','improvement_required')),
  self_reflection text,
  self_strengths text,
  self_support_needed text,
  self_submitted_at timestamptz,
  leader_summary text,
  strengths text,
  growth_areas text,
  opened_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (organisation_id,review_reference)
);

create index if not exists idx_khpos_ops_staff_perf_reviews_org_status
  on public.khpos_ops_staff_performance_reviews(organisation_id,status,period_end desc);
create index if not exists idx_khpos_ops_staff_perf_reviews_staff
  on public.khpos_ops_staff_performance_reviews(staff_id,status,period_end desc);
create index if not exists idx_khpos_ops_staff_perf_reviews_assignment
  on public.khpos_ops_staff_performance_reviews(affected_assignment_id,status);
create index if not exists idx_khpos_ops_staff_perf_reviews_opened_by
  on public.khpos_ops_staff_performance_reviews(opened_by,opened_at desc);
create index if not exists idx_khpos_ops_staff_perf_reviews_reviewed_by
  on public.khpos_ops_staff_performance_reviews(reviewed_by,reviewed_at desc)
  where reviewed_by is not null;
create index if not exists idx_khpos_ops_staff_perf_reviews_completed_by
  on public.khpos_ops_staff_performance_reviews(completed_by,completed_at desc)
  where completed_by is not null;
create index if not exists idx_khpos_ops_staff_perf_reviews_cancelled_by
  on public.khpos_ops_staff_performance_reviews(cancelled_by,cancelled_at desc)
  where cancelled_by is not null;

create table if not exists public.khpos_ops_staff_performance_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  review_id uuid not null references public.khpos_ops_staff_performance_reviews(id) on delete cascade,
  evidence_type text not null
    check (evidence_type in ('role_outcome','observation','kpi','work_execution','issue_pattern','feedback','development','other')),
  title text not null,
  note text not null,
  reference text,
  kpi_measurement_id uuid references public.khpos_ops_kpi_measurements(id) on delete set null,
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_staff_perf_evidence_review
  on public.khpos_ops_staff_performance_evidence(review_id,created_at desc);
create index if not exists idx_khpos_ops_staff_perf_evidence_kpi
  on public.khpos_ops_staff_performance_evidence(kpi_measurement_id)
  where kpi_measurement_id is not null;
create index if not exists idx_khpos_ops_staff_perf_evidence_added_by
  on public.khpos_ops_staff_performance_evidence(added_by,created_at desc);

create table if not exists public.khpos_ops_staff_development_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  review_id uuid not null references public.khpos_ops_staff_performance_reviews(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  action_type text not null
    check (action_type in ('coaching','training','practice','observation','process_support','resource_support','other')),
  title text not null,
  description text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  due_date date not null,
  status text not null default 'open'
    check (status in ('open','in_progress','evidence_submitted','verified','cancelled')),
  evidence_reference text,
  completion_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text
);

create index if not exists idx_khpos_ops_staff_dev_actions_review
  on public.khpos_ops_staff_development_actions(review_id,status,due_date);
create index if not exists idx_khpos_ops_staff_dev_actions_staff
  on public.khpos_ops_staff_development_actions(staff_id,status,due_date);
create index if not exists idx_khpos_ops_staff_dev_actions_owner
  on public.khpos_ops_staff_development_actions(owner_user_id,status,due_date);
create index if not exists idx_khpos_ops_staff_dev_actions_created_by
  on public.khpos_ops_staff_development_actions(created_by,created_at desc);
create index if not exists idx_khpos_ops_staff_dev_actions_verified_by
  on public.khpos_ops_staff_development_actions(verified_by,verified_at desc)
  where verified_by is not null;
create index if not exists idx_khpos_ops_staff_dev_actions_cancelled_by
  on public.khpos_ops_staff_development_actions(cancelled_by,cancelled_at desc)
  where cancelled_by is not null;

create table if not exists public.khpos_ops_staff_performance_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  review_id uuid not null references public.khpos_ops_staff_performance_reviews(id) on delete cascade,
  development_action_id uuid references public.khpos_ops_staff_development_actions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_staff_perf_events_review
  on public.khpos_ops_staff_performance_events(review_id,created_at desc);
create index if not exists idx_khpos_ops_staff_perf_events_action
  on public.khpos_ops_staff_performance_events(development_action_id,created_at desc)
  where development_action_id is not null;
create index if not exists idx_khpos_ops_staff_perf_events_actor
  on public.khpos_ops_staff_performance_events(actor_user_id,created_at desc)
  where actor_user_id is not null;

alter table public.khpos_ops_staff_performance_reviews enable row level security;
alter table public.khpos_ops_staff_performance_evidence enable row level security;
alter table public.khpos_ops_staff_development_actions enable row level security;
alter table public.khpos_ops_staff_performance_events enable row level security;

revoke all privileges on table public.khpos_ops_staff_performance_reviews from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_performance_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_development_actions from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_performance_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_staff_performance_reviews to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_performance_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_development_actions to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_performance_events to service_role;

create or replace function khpos_private.ops_performance_has_membership(
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

create or replace function khpos_private.ops_performance_can_review_staff(
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

create or replace function public.khpos_ops_get_staff_performance_server(
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
  v_can_manage boolean := false;
  v_staff_options jsonb := '[]'::jsonb;
  v_reviews jsonb := '[]'::jsonb;
  v_open integer := 0;
  v_self_due integer := 0;
  v_leader_due integer := 0;
  v_overdue_actions integer := 0;
  v_improvement integer := 0;
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

  v_can_manage := khpos_private.ops_can_manage_people(
    p_actor_user_id,p_organisation_id
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'reference',s.staff_reference,
    'displayName',s.display_name,
    'userId',s.user_id,
    'roleId',r.id,
    'roleCode',r.code,
    'roleTitle',r.title,
    'roleLevel',r.role_level,
    'assignmentId',s.role_assignment_id,
    'campusName',c.name,
    'unitName',u.name,
    'isSelf',s.user_id=p_actor_user_id,
    'canReview',khpos_private.ops_performance_can_review_staff(
      p_actor_user_id,p_organisation_id,s.id
    ),
    'roleKpis',coalesce((
      select jsonb_agg(jsonb_build_object(
        'kpiId',k.id,
        'code',k.code,
        'name',k.name,
        'definition',kv.definition,
        'indicatorType',kv.indicator_type,
        'unit',kv.unit,
        'direction',kv.direction,
        'cadence',kv.cadence,
        'criticalControl',kv.critical_control,
        'latestMeasurement',case when lm.id is null then null else jsonb_build_object(
          'id',lm.id,
          'periodStart',lm.period_start,
          'periodEnd',lm.period_end,
          'value',lm.value_numeric,
          'performanceStatus',lm.performance_status,
          'note',lm.note,
          'evidenceReference',lm.evidence_reference
        ) end
      ) order by k.name)
      from public.khpos_ops_kpis k
      join public.khpos_ops_kpi_versions kv
        on kv.kpi_id=k.id and kv.status='active'
      left join lateral (
        select m.*
        from public.khpos_ops_kpi_measurements m
        where m.kpi_id=k.id
        order by m.period_end desc,m.recorded_at desc
        limit 1
      ) lm on true
      where k.organisation_id=p_organisation_id
        and k.status='active'
        and kv.scope_type='role'
        and kv.scope_role_id=s.desired_role_id
    ),'[]'::jsonb)
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
      or khpos_private.ops_performance_can_review_staff(
        p_actor_user_id,p_organisation_id,s.id
      )
    );

  with visible as (
    select
      pr.*,
      s.display_name as staff_name,
      s.staff_reference,
      s.user_id as staff_user_id,
      r.title as role_title,
      c.name as campus_name,
      u.name as unit_name,
      (s.user_id=p_actor_user_id) as is_self,
      khpos_private.ops_performance_can_review_staff(
        p_actor_user_id,p_organisation_id,s.id
      ) as can_review
    from public.khpos_ops_staff_performance_reviews pr
    join public.khpos_ops_staff s on s.id=pr.staff_id
    join public.khpos_ops_roles r on r.id=s.desired_role_id
    left join public.khpos_ops_campuses c on c.id=s.campus_id
    left join public.khpos_ops_units u on u.id=s.unit_id
    where pr.organisation_id=p_organisation_id
      and (
        s.user_id=p_actor_user_id
        or khpos_private.ops_performance_can_review_staff(
          p_actor_user_id,p_organisation_id,s.id
        )
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,
    'reference',v.review_reference,
    'staffId',v.staff_id,
    'staffName',v.staff_name,
    'staffReference',v.staff_reference,
    'roleTitle',v.role_title,
    'campusName',v.campus_name,
    'unitName',v.unit_name,
    'reviewType',v.review_type,
    'periodStart',v.period_start,
    'periodEnd',v.period_end,
    'status',v.status,
    'performanceState',v.performance_state,
    'selfReflection',v.self_reflection,
    'selfStrengths',v.self_strengths,
    'selfSupportNeeded',v.self_support_needed,
    'selfSubmittedAt',v.self_submitted_at,
    'leaderSummary',v.leader_summary,
    'strengths',v.strengths,
    'growthAreas',v.growth_areas,
    'reviewedAt',v.reviewed_at,
    'completedAt',v.completed_at,
    'createdAt',v.created_at,
    'isSelf',v.is_self,
    'canReview',v.can_review,
    'evidence',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,
        'evidenceType',e.evidence_type,
        'title',e.title,
        'note',e.note,
        'reference',e.reference,
        'createdAt',e.created_at,
        'kpiMeasurement',case when km.id is null then null else jsonb_build_object(
          'id',km.id,
          'kpiCode',k.code,
          'kpiName',k.name,
          'periodStart',km.period_start,
          'periodEnd',km.period_end,
          'value',km.value_numeric,
          'performanceStatus',km.performance_status,
          'note',km.note,
          'evidenceReference',km.evidence_reference
        ) end
      ) order by e.created_at desc)
      from public.khpos_ops_staff_performance_evidence e
      left join public.khpos_ops_kpi_measurements km on km.id=e.kpi_measurement_id
      left join public.khpos_ops_kpis k on k.id=km.kpi_id
      where e.review_id=v.id
    ),'[]'::jsonb),
    'developmentActions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',da.id,
        'actionType',da.action_type,
        'title',da.title,
        'description',da.description,
        'ownerUserId',da.owner_user_id,
        'ownerName',coalesce(
          nullif(btrim(owner.raw_user_meta_data->>'full_name'),''),
          nullif(btrim(owner.raw_user_meta_data->>'name'),''),
          owner.email,
          'Action owner'
        ),
        'dueDate',da.due_date,
        'status',da.status,
        'evidenceReference',da.evidence_reference,
        'completionNote',da.completion_note,
        'submittedAt',da.submitted_at,
        'verifiedAt',da.verified_at,
        'isOwner',da.owner_user_id=p_actor_user_id,
        'canVerify',v.can_review
      ) order by
        case da.status
          when 'open' then 1
          when 'in_progress' then 2
          when 'evidence_submitted' then 3
          when 'verified' then 4
          else 5
        end,
        da.due_date,da.created_at)
      from public.khpos_ops_staff_development_actions da
      join auth.users owner on owner.id=da.owner_user_id
      where da.review_id=v.id
    ),'[]'::jsonb),
    'history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventType',ev.event_type,
        'fromStatus',ev.from_status,
        'toStatus',ev.to_status,
        'note',ev.note,
        'createdAt',ev.created_at
      ) order by ev.created_at desc)
      from (
        select event_type,from_status,to_status,note,created_at
        from public.khpos_ops_staff_performance_events
        where review_id=v.id
        order by created_at desc
        limit 30
      ) ev
    ),'[]'::jsonb)
  ) order by
    case v.status
      when 'open' then 1
      when 'self_submitted' then 2
      when 'leader_reviewed' then 3
      when 'completed' then 4
      else 5
    end,
    v.period_end desc,v.created_at desc
  ),'[]'::jsonb)
  into v_reviews
  from visible v;

  with visible as (
    select pr.*,s.user_id as staff_user_id,
      khpos_private.ops_performance_can_review_staff(
        p_actor_user_id,p_organisation_id,s.id
      ) as can_review
    from public.khpos_ops_staff_performance_reviews pr
    join public.khpos_ops_staff s on s.id=pr.staff_id
    where pr.organisation_id=p_organisation_id
      and (
        s.user_id=p_actor_user_id
        or khpos_private.ops_performance_can_review_staff(
          p_actor_user_id,p_organisation_id,s.id
        )
      )
  )
  select
    count(*) filter (where status not in ('completed','cancelled'))::integer,
    count(*) filter (
      where status='open' and staff_user_id=p_actor_user_id
    )::integer,
    count(*) filter (
      where status='self_submitted' and can_review
    )::integer,
    count(*) filter (
      where performance_state='improvement_required'
        and status not in ('cancelled')
    )::integer
  into v_open,v_self_due,v_leader_due,v_improvement
  from visible;

  select count(*)::integer
  into v_overdue_actions
  from public.khpos_ops_staff_development_actions da
  join public.khpos_ops_staff_performance_reviews pr on pr.id=da.review_id
  join public.khpos_ops_staff s on s.id=pr.staff_id
  where da.organisation_id=p_organisation_id
    and da.status in ('open','in_progress','evidence_submitted')
    and da.due_date<current_date
    and (
      da.owner_user_id=p_actor_user_id
      or s.user_id=p_actor_user_id
      or khpos_private.ops_performance_can_review_staff(
        p_actor_user_id,p_organisation_id,s.id
      )
    );

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canManagePeople',v_can_manage,
    'principle','Performance review is evidence plus dialogue plus development. It is not a one-number staff rating, and attendance exceptions do not become performance judgments automatically.',
    'staffOptions',v_staff_options,
    'summary',jsonb_build_object(
      'openReviews',v_open,
      'selfReflectionsDue',v_self_due,
      'leaderReviewsDue',v_leader_due,
      'overdueDevelopmentActions',v_overdue_actions,
      'improvementRequired',v_improvement
    ),
    'reviews',v_reviews
  );
end;
$$;

create or replace function public.khpos_ops_create_staff_review_server(
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
  v_review_type text := lower(nullif(btrim(p_input->>'reviewType'),''));
  v_period_start date;
  v_period_end date;
  v_reference text;
  v_review_id uuid;
begin
  if not khpos_private.ops_performance_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
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
    raise exception 'Only active deployed staff can enter the performance review process.';
  end if;

  if not khpos_private.ops_performance_can_review_staff(
    p_actor_user_id,p_organisation_id,v_staff.id
  ) then
    raise exception 'Only the appropriate reporting leader can open a staff performance review.';
  end if;

  if v_review_type not in ('probation','monthly_check_in','term_review','annual_review','support_review') then
    raise exception 'Unsupported staff review type.';
  end if;

  begin v_period_start := (p_input->>'periodStart')::date;
  exception when others then raise exception 'Review period start is invalid.'; end;
  begin v_period_end := (p_input->>'periodEnd')::date;
  exception when others then raise exception 'Review period end is invalid.'; end;

  if v_period_end<v_period_start then
    raise exception 'Review period end cannot precede the start.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff_performance_reviews pr
    where pr.staff_id=v_staff.id
      and pr.review_type=v_review_type
      and pr.status<>'cancelled'
      and daterange(pr.period_start,pr.period_end,'[]')
          && daterange(v_period_start,v_period_end,'[]')
  ) then
    raise exception 'This staff member already has an overlapping review of the same type.';
  end if;

  v_reference := 'PRF-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_performance_reviews(
    organisation_id,staff_id,affected_assignment_id,review_reference,
    review_type,period_start,period_end,status,performance_state,opened_by
  ) values (
    p_organisation_id,v_staff.id,v_staff.role_assignment_id,v_reference,
    v_review_type,v_period_start,v_period_end,'open','not_assessed',p_actor_user_id
  ) returning id into v_review_id;

  insert into public.khpos_ops_staff_performance_events(
    organisation_id,review_id,actor_user_id,event_type,to_status,note,metadata
  ) values (
    p_organisation_id,v_review_id,p_actor_user_id,'review_opened','open',
    'Performance review opened for evidence, reflection and development.',
    jsonb_build_object(
      'reviewType',v_review_type,
      'periodStart',v_period_start,
      'periodEnd',v_period_end,
      'staffId',v_staff.id
    )
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_review_opened',
    'staff_performance_review',v_review_id,
    jsonb_build_object('reference',v_reference,'staffId',v_staff.id)
  );

  return v_review_id;
end;
$$;

create or replace function public.khpos_ops_submit_staff_reflection_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_review_id uuid,
  p_reflection text,
  p_strengths text,
  p_support_needed text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_review public.khpos_ops_staff_performance_reviews%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_from_status text;
begin
  if not khpos_private.ops_performance_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_review
  from public.khpos_ops_staff_performance_reviews
  where id=p_review_id and organisation_id=p_organisation_id
  for update;

  if v_review.id is null then raise exception 'Staff performance review not found.'; end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_review.staff_id and organisation_id=p_organisation_id;

  if v_staff.id is null or v_staff.user_id<>p_actor_user_id then
    raise exception 'Only the staff member can submit their own performance reflection.';
  end if;

  if v_review.status not in ('open','self_submitted') then
    raise exception 'Self-reflection can only be submitted before leader review.';
  end if;

  if nullif(btrim(coalesce(p_reflection,'')),'') is null
     or nullif(btrim(coalesce(p_strengths,'')),'') is null then
    raise exception 'Reflection and strengths are required before submission.';
  end if;

  v_from_status := v_review.status;

  update public.khpos_ops_staff_performance_reviews
  set status='self_submitted',
      self_reflection=left(btrim(p_reflection),6000),
      self_strengths=left(btrim(p_strengths),4000),
      self_support_needed=left(nullif(btrim(coalesce(p_support_needed,'')),''),4000),
      self_submitted_at=now(),
      updated_at=now()
  where id=v_review.id;

  insert into public.khpos_ops_staff_performance_events(
    organisation_id,review_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_review.id,p_actor_user_id,'self_reflection_submitted',
    v_from_status,'self_submitted',
    'Staff self-reflection submitted for leader review.'
  );
end;
$$;

create or replace function public.khpos_ops_add_staff_performance_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_review_id uuid,
  p_evidence_type text,
  p_title text,
  p_note text,
  p_reference text default null,
  p_kpi_measurement_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_review public.khpos_ops_staff_performance_reviews%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_is_self boolean := false;
  v_can_review boolean := false;
  v_evidence_id uuid;
  v_type text := lower(nullif(btrim(p_evidence_type),''));
begin
  if not khpos_private.ops_performance_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_review
  from public.khpos_ops_staff_performance_reviews
  where id=p_review_id and organisation_id=p_organisation_id;

  if v_review.id is null then raise exception 'Staff performance review not found.'; end if;
  if v_review.status in ('completed','cancelled') then
    raise exception 'Evidence cannot be added after the review is completed or cancelled.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_review.staff_id and organisation_id=p_organisation_id;

  v_is_self := v_staff.user_id=p_actor_user_id;
  v_can_review := khpos_private.ops_performance_can_review_staff(
    p_actor_user_id,p_organisation_id,v_staff.id
  );

  if not v_is_self and not v_can_review then
    raise exception 'This performance review is outside your authority.';
  end if;

  if v_type not in ('role_outcome','observation','kpi','work_execution','issue_pattern','feedback','development','other') then
    raise exception 'Unsupported performance evidence type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'Evidence title and note are required.';
  end if;

  if v_type='kpi' then
    if p_kpi_measurement_id is null then
      raise exception 'KPI evidence must reference a governed KPI measurement.';
    end if;

    if not exists(
      select 1
      from public.khpos_ops_kpi_measurements km
      join public.khpos_ops_kpi_versions kv on kv.id=km.kpi_version_id
      join public.khpos_ops_kpis k on k.id=km.kpi_id
      where km.id=p_kpi_measurement_id
        and km.organisation_id=p_organisation_id
        and k.organisation_id=p_organisation_id
        and kv.scope_type='role'
        and kv.scope_role_id=v_staff.desired_role_id
    ) then
      raise exception 'KPI evidence must belong to the reviewed staff role and organisation.';
    end if;
  elsif p_kpi_measurement_id is not null then
    raise exception 'Only KPI evidence can link a KPI measurement.';
  end if;

  insert into public.khpos_ops_staff_performance_evidence(
    organisation_id,review_id,evidence_type,title,note,reference,
    kpi_measurement_id,added_by
  ) values (
    p_organisation_id,v_review.id,v_type,left(btrim(p_title),240),
    left(btrim(p_note),5000),left(nullif(btrim(coalesce(p_reference,'')),''),1000),
    p_kpi_measurement_id,p_actor_user_id
  ) returning id into v_evidence_id;

  insert into public.khpos_ops_staff_performance_events(
    organisation_id,review_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_review.id,p_actor_user_id,'evidence_added',
    left(btrim(p_title),240),
    jsonb_build_object(
      'evidenceId',v_evidence_id,
      'evidenceType',v_type,
      'kpiMeasurementId',p_kpi_measurement_id
    )
  );

  return v_evidence_id;
end;
$$;

create or replace function public.khpos_ops_leader_review_staff_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_review_id uuid,
  p_performance_state text,
  p_summary text,
  p_strengths text,
  p_growth_areas text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_review public.khpos_ops_staff_performance_reviews%rowtype;
  v_state text := lower(nullif(btrim(p_performance_state),''));
  v_evidence_count integer := 0;
begin
  if not khpos_private.ops_performance_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_review
  from public.khpos_ops_staff_performance_reviews
  where id=p_review_id and organisation_id=p_organisation_id
  for update;

  if v_review.id is null then raise exception 'Staff performance review not found.'; end if;

  if not khpos_private.ops_performance_can_review_staff(
    p_actor_user_id,p_organisation_id,v_review.staff_id
  ) then
    raise exception 'Only the appropriate reporting leader can complete the leader review.';
  end if;

  if v_review.status<>'self_submitted' then
    raise exception 'Leader review requires the staff self-reflection first.';
  end if;

  if v_state not in ('on_track','support_required','improvement_required') then
    raise exception 'Unsupported performance state.';
  end if;

  if nullif(btrim(coalesce(p_summary,'')),'') is null
     or nullif(btrim(coalesce(p_strengths,'')),'') is null
     or nullif(btrim(coalesce(p_growth_areas,'')),'') is null then
    raise exception 'Leader summary, strengths and growth areas are required.';
  end if;

  select count(*)::integer into v_evidence_count
  from public.khpos_ops_staff_performance_evidence
  where review_id=v_review.id;

  if v_evidence_count=0 then
    raise exception 'Add at least one evidence item before making a leader performance judgment.';
  end if;

  update public.khpos_ops_staff_performance_reviews
  set status='leader_reviewed',
      performance_state=v_state,
      leader_summary=left(btrim(p_summary),6000),
      strengths=left(btrim(p_strengths),4000),
      growth_areas=left(btrim(p_growth_areas),4000),
      reviewed_by=p_actor_user_id,
      reviewed_at=now(),
      updated_at=now()
  where id=v_review.id;

  insert into public.khpos_ops_staff_performance_events(
    organisation_id,review_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_review.id,p_actor_user_id,'leader_reviewed',
    'self_submitted','leader_reviewed',
    'Leader review completed from documented evidence and dialogue.',
    jsonb_build_object('performanceState',v_state,'evidenceCount',v_evidence_count)
  );
end;
$$;

create or replace function public.khpos_ops_create_development_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_review_id uuid,
  p_action_type text,
  p_title text,
  p_description text,
  p_owner_user_id uuid,
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_review public.khpos_ops_staff_performance_reviews%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_is_self boolean := false;
  v_can_review boolean := false;
  v_type text := lower(nullif(btrim(p_action_type),''));
  v_action_id uuid;
begin
  if not khpos_private.ops_performance_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_review
  from public.khpos_ops_staff_performance_reviews
  where id=p_review_id and organisation_id=p_organisation_id;

  if v_review.id is null then raise exception 'Staff performance review not found.'; end if;
  if v_review.status in ('completed','cancelled') then
    raise exception 'Development actions cannot be created after review closure.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_review.staff_id and organisation_id=p_organisation_id;

  v_is_self := v_staff.user_id=p_actor_user_id;
  v_can_review := khpos_private.ops_performance_can_review_staff(
    p_actor_user_id,p_organisation_id,v_staff.id
  );

  if not v_is_self and not v_can_review then
    raise exception 'This performance review is outside your authority.';
  end if;

  if v_type not in ('coaching','training','practice','observation','process_support','resource_support','other') then
    raise exception 'Unsupported development action type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_description,'')),'') is null then
    raise exception 'Development action title and description are required.';
  end if;

  if p_due_date<current_date then
    raise exception 'Development action due date cannot be in the past.';
  end if;

  if not exists(
    select 1
    from public.organisation_memberships m
    where m.organisation_id=p_organisation_id
      and m.user_id=p_owner_user_id
      and m.status='active'
  ) then
    raise exception 'Development action owner must have active organisation access.';
  end if;

  if v_is_self and p_owner_user_id<>p_actor_user_id then
    raise exception 'Staff may only create a self-owned development commitment.';
  end if;

  if v_can_review and p_owner_user_id not in (v_staff.user_id,p_actor_user_id) then
    raise exception 'Leader-created development actions must be owned by the staff member or the reviewing leader.';
  end if;

  insert into public.khpos_ops_staff_development_actions(
    organisation_id,review_id,staff_id,action_type,title,description,
    owner_user_id,due_date,status,created_by
  ) values (
    p_organisation_id,v_review.id,v_staff.id,v_type,left(btrim(p_title),240),
    left(btrim(p_description),5000),p_owner_user_id,p_due_date,'open',
    p_actor_user_id
  ) returning id into v_action_id;

  insert into public.khpos_ops_staff_performance_events(
    organisation_id,review_id,development_action_id,actor_user_id,
    event_type,note,metadata
  ) values (
    p_organisation_id,v_review.id,v_action_id,p_actor_user_id,
    'development_action_created',left(btrim(p_title),240),
    jsonb_build_object('actionType',v_type,'ownerUserId',p_owner_user_id,'dueDate',p_due_date)
  );

  return v_action_id;
end;
$$;

create or replace function public.khpos_ops_development_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_action_id uuid,
  p_action text,
  p_note text default null,
  p_evidence_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_action public.khpos_ops_staff_development_actions%rowtype;
  v_review public.khpos_ops_staff_performance_reviews%rowtype;
  v_can_review boolean := false;
  v_is_owner boolean := false;
  v_from_status text;
  v_to_status text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
begin
  if not khpos_private.ops_performance_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_action
  from public.khpos_ops_staff_development_actions
  where id=p_action_id and organisation_id=p_organisation_id
  for update;

  if v_action.id is null then raise exception 'Development action not found.'; end if;

  select * into v_review
  from public.khpos_ops_staff_performance_reviews
  where id=v_action.review_id and organisation_id=p_organisation_id;

  if v_review.id is null then raise exception 'Staff performance review not found.'; end if;

  v_is_owner := v_action.owner_user_id=p_actor_user_id;
  v_can_review := khpos_private.ops_performance_can_review_staff(
    p_actor_user_id,p_organisation_id,v_review.staff_id
  );
  v_from_status := v_action.status;

  if p_action='start' then
    if not v_is_owner then raise exception 'Only the development action owner can start it.'; end if;
    if v_action.status<>'open' then raise exception 'Only an open development action can be started.'; end if;
    v_to_status := 'in_progress';
    update public.khpos_ops_staff_development_actions
    set status='in_progress',updated_at=now()
    where id=v_action.id;

  elsif p_action='submit_evidence' then
    if not v_is_owner then raise exception 'Only the development action owner can submit completion evidence.'; end if;
    if v_action.status not in ('open','in_progress') then
      raise exception 'Only open or in-progress development actions can submit evidence.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Completion note and evidence reference are required.';
    end if;
    v_to_status := 'evidence_submitted';
    update public.khpos_ops_staff_development_actions
    set status='evidence_submitted',
        completion_note=left(v_note,4000),
        evidence_reference=left(v_evidence,1000),
        submitted_at=now(),
        updated_at=now()
    where id=v_action.id;

  elsif p_action='verify' then
    if not v_can_review then raise exception 'Only the appropriate reporting leader can verify development.'; end if;
    if v_action.status<>'evidence_submitted' then
      raise exception 'Only submitted development evidence can be verified.';
    end if;
    if v_action.owner_user_id=p_actor_user_id then
      raise exception 'The development action owner cannot verify their own completion.';
    end if;
    v_to_status := 'verified';
    update public.khpos_ops_staff_development_actions
    set status='verified',
        verified_by=p_actor_user_id,
        verified_at=now(),
        updated_at=now()
    where id=v_action.id;

  elsif p_action='reopen' then
    if not v_can_review then raise exception 'Only the appropriate reporting leader can reopen development work.'; end if;
    if v_action.status not in ('evidence_submitted','verified') then
      raise exception 'Only submitted or verified development work can be reopened.';
    end if;
    if v_note is null then raise exception 'Explain why the development action is being reopened.'; end if;
    v_to_status := 'in_progress';
    update public.khpos_ops_staff_development_actions
    set status='in_progress',
        verified_by=null,
        verified_at=null,
        updated_at=now()
    where id=v_action.id;

  elsif p_action='cancel' then
    if not v_can_review and not (v_is_owner and v_action.created_by=p_actor_user_id) then
      raise exception 'Only the reviewing leader or the owner of a self-created action can cancel it.';
    end if;
    if v_action.status in ('verified','cancelled') then
      raise exception 'Verified or cancelled development actions cannot be cancelled.';
    end if;
    if v_note is null then raise exception 'Explain why the development action is being cancelled.'; end if;
    v_to_status := 'cancelled';
    update public.khpos_ops_staff_development_actions
    set status='cancelled',
        cancelled_by=p_actor_user_id,
        cancelled_at=now(),
        cancellation_note=left(v_note,4000),
        updated_at=now()
    where id=v_action.id;

  else
    raise exception 'Unsupported development action.';
  end if;

  insert into public.khpos_ops_staff_performance_events(
    organisation_id,review_id,development_action_id,actor_user_id,
    event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_review.id,v_action.id,p_actor_user_id,
    'development_'||p_action,v_from_status,v_to_status,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence)
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_development_'||p_action,
    'staff_development_action',v_action.id,
    jsonb_build_object('reviewId',v_review.id,'fromStatus',v_from_status,'toStatus',v_to_status)
  );
end;
$$;

create or replace function public.khpos_ops_staff_review_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_review_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_review public.khpos_ops_staff_performance_reviews%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_can_review boolean := false;
  v_is_self boolean := false;
  v_from_status text;
  v_to_status text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  if not khpos_private.ops_performance_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_review
  from public.khpos_ops_staff_performance_reviews
  where id=p_review_id and organisation_id=p_organisation_id
  for update;

  if v_review.id is null then raise exception 'Staff performance review not found.'; end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_review.staff_id and organisation_id=p_organisation_id;

  v_is_self := v_staff.user_id=p_actor_user_id;
  v_can_review := khpos_private.ops_performance_can_review_staff(
    p_actor_user_id,p_organisation_id,v_staff.id
  );
  v_from_status := v_review.status;

  if p_action='complete' then
    if not v_can_review then
      raise exception 'Only the appropriate reporting leader can complete the performance review.';
    end if;
    if v_review.status<>'leader_reviewed' then
      raise exception 'Only a leader-reviewed performance review can be completed.';
    end if;

    if v_review.performance_state in ('support_required','improvement_required') then
      if not exists(
        select 1
        from public.khpos_ops_staff_development_actions da
        where da.review_id=v_review.id
          and da.status<>'cancelled'
      ) then
        raise exception 'Support or improvement reviews require at least one development action before closure.';
      end if;

      if exists(
        select 1
        from public.khpos_ops_staff_development_actions da
        where da.review_id=v_review.id
          and da.status not in ('verified','cancelled')
      ) then
        raise exception 'Verify the agreed development response before completing this review.';
      end if;
    end if;

    if exists(
      select 1
      from public.khpos_ops_staff_development_actions da
      where da.review_id=v_review.id
        and da.status not in ('verified','cancelled')
    ) then
      raise exception 'Open development actions must be verified or cancelled before review completion.';
    end if;

    v_to_status := 'completed';
    update public.khpos_ops_staff_performance_reviews
    set status='completed',
        completed_by=p_actor_user_id,
        completed_at=now(),
        updated_at=now()
    where id=v_review.id;

  elsif p_action='cancel' then
    if not v_can_review then
      raise exception 'Only the appropriate reporting leader can cancel a performance review.';
    end if;
    if v_review.status in ('completed','cancelled') then
      raise exception 'Completed or cancelled reviews cannot be cancelled.';
    end if;
    if v_note is null then raise exception 'Explain why this performance review is being cancelled.'; end if;

    v_to_status := 'cancelled';
    update public.khpos_ops_staff_performance_reviews
    set status='cancelled',
        cancelled_by=p_actor_user_id,
        cancelled_at=now(),
        cancellation_note=left(v_note,4000),
        updated_at=now()
    where id=v_review.id;

    update public.khpos_ops_staff_development_actions
    set status='cancelled',
        cancelled_by=p_actor_user_id,
        cancelled_at=now(),
        cancellation_note=coalesce(cancellation_note,'Parent review cancelled.'),
        updated_at=now()
    where review_id=v_review.id
      and status not in ('verified','cancelled');

  else
    raise exception 'Unsupported staff review action.';
  end if;

  insert into public.khpos_ops_staff_performance_events(
    organisation_id,review_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_review.id,p_actor_user_id,'review_'||p_action,
    v_from_status,v_to_status,left(v_note,4000)
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_review_'||p_action,
    'staff_performance_review',v_review.id,
    jsonb_build_object('fromStatus',v_from_status,'toStatus',v_to_status)
  );
end;
$$;

revoke execute on function khpos_private.ops_performance_has_membership(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_performance_can_review_staff(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_get_staff_performance_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_staff_review_server(uuid,uuid,jsonb)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_submit_staff_reflection_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_staff_performance_evidence_server(uuid,uuid,uuid,text,text,text,text,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_leader_review_staff_server(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_development_action_server(uuid,uuid,uuid,text,text,text,uuid,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_development_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_staff_review_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_performance_has_membership(uuid,uuid)
  to service_role;
grant execute on function khpos_private.ops_performance_can_review_staff(uuid,uuid,uuid)
  to service_role;
grant execute on function public.khpos_ops_get_staff_performance_server(uuid,uuid)
  to service_role;
grant execute on function public.khpos_ops_create_staff_review_server(uuid,uuid,jsonb)
  to service_role;
grant execute on function public.khpos_ops_submit_staff_reflection_server(uuid,uuid,uuid,text,text,text)
  to service_role;
grant execute on function public.khpos_ops_add_staff_performance_evidence_server(uuid,uuid,uuid,text,text,text,text,uuid)
  to service_role;
grant execute on function public.khpos_ops_leader_review_staff_server(uuid,uuid,uuid,text,text,text,text)
  to service_role;
grant execute on function public.khpos_ops_create_development_action_server(uuid,uuid,uuid,text,text,text,uuid,date)
  to service_role;
grant execute on function public.khpos_ops_development_action_server(uuid,uuid,uuid,text,text,text)
  to service_role;
grant execute on function public.khpos_ops_staff_review_action_server(uuid,uuid,uuid,text,text)
  to service_role;
