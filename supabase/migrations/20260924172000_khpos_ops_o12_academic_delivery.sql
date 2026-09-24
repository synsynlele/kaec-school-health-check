create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_academic_terms (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  session_label text not null,
  term_code text not null,
  term_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft'
    check (status in ('draft','active','closed','cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create unique index if not exists uq_khpos_ops_academic_term_scope
  on public.khpos_ops_academic_terms(
    organisation_id,
    coalesce(campus_id,'00000000-0000-0000-0000-000000000000'::uuid),
    lower(session_label),
    lower(term_code)
  );

create unique index if not exists uq_khpos_ops_academic_active_term_scope
  on public.khpos_ops_academic_terms(
    organisation_id,
    coalesce(campus_id,'00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status='active';

create index if not exists idx_khpos_ops_academic_terms_org_status
  on public.khpos_ops_academic_terms(organisation_id,status,start_date desc);

create table if not exists public.khpos_ops_academic_delivery_streams (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  unit_id uuid references public.khpos_ops_units(id) on delete set null,
  class_label text not null,
  section_label text,
  subject_label text not null,
  subject_code text,
  teacher_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  scheme_source text not null
    check (scheme_source in ('KSI','SIS','external','manual')),
  scheme_reference text not null,
  scheme_version text,
  timetable_reference text not null,
  expected_weeks integer not null default 12
    check (expected_weeks between 1 and 24),
  status text not null default 'draft'
    check (status in ('draft','approved','active','closed','cancelled')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_khpos_ops_academic_stream_identity
  on public.khpos_ops_academic_delivery_streams(
    term_id,
    coalesce(campus_id,'00000000-0000-0000-0000-000000000000'::uuid),
    lower(class_label),
    lower(coalesce(section_label,'')),
    lower(subject_label)
  );

create index if not exists idx_khpos_ops_academic_stream_teacher
  on public.khpos_ops_academic_delivery_streams(teacher_assignment_id,status);
create index if not exists idx_khpos_ops_academic_stream_term
  on public.khpos_ops_academic_delivery_streams(term_id,status);
create index if not exists idx_khpos_ops_academic_stream_campus
  on public.khpos_ops_academic_delivery_streams(campus_id,status)
  where campus_id is not null;

create table if not exists public.khpos_ops_academic_weekly_targets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  stream_id uuid not null references public.khpos_ops_academic_delivery_streams(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 24),
  target_reference text not null,
  target_label text not null,
  planned_start_date date,
  planned_end_date date,
  state text not null default 'planned'
    check (state in (
      'planned','ready','in_progress','delivered',
      'partial','missed','recovery_required','recovered','closed'
    )),
  readiness_note text,
  readiness_reference text,
  readiness_updated_by uuid references auth.users(id) on delete set null,
  readiness_updated_at timestamptz,
  delivery_note text,
  delivery_reference text,
  delivered_by uuid references auth.users(id) on delete set null,
  delivered_at timestamptz,
  verification_state text not null default 'unverified'
    check (verification_state in ('unverified','verified','rejected')),
  verification_note text,
  verification_reference text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stream_id,week_number,target_reference),
  check (
    planned_start_date is null
    or planned_end_date is null
    or planned_end_date >= planned_start_date
  )
);

create index if not exists idx_khpos_ops_academic_targets_stream_week
  on public.khpos_ops_academic_weekly_targets(stream_id,week_number,state);
create index if not exists idx_khpos_ops_academic_targets_state
  on public.khpos_ops_academic_weekly_targets(organisation_id,state,planned_end_date);
create index if not exists idx_khpos_ops_academic_targets_delivered_by
  on public.khpos_ops_academic_weekly_targets(delivered_by,delivered_at desc)
  where delivered_by is not null;
create index if not exists idx_khpos_ops_academic_targets_verified_by
  on public.khpos_ops_academic_weekly_targets(verified_by,verified_at desc)
  where verified_by is not null;

create table if not exists public.khpos_ops_academic_debt (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  target_id uuid not null references public.khpos_ops_academic_weekly_targets(id) on delete cascade,
  stream_id uuid not null references public.khpos_ops_academic_delivery_streams(id) on delete cascade,
  debt_type text not null
    check (debt_type in ('partial_delivery','missed_delivery','verification_rejected')),
  cause_category text not null
    check (cause_category in (
      'absence','timetable_disruption','resource',
      'teacher_readiness','learner_gap','event_disruption',
      'infrastructure','other'
    )),
  cause_note text not null,
  severity text not null default 'P3'
    check (severity in ('P2','P3','P4')),
  recovery_owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  recovery_plan text,
  recovery_due_date date,
  status text not null default 'open'
    check (status in ('open','planned','in_progress','evidence_submitted','closed')),
  completion_note text,
  evidence_reference text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  linked_issue_id uuid references public.khpos_ops_issues(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (target_id)
);

create index if not exists idx_khpos_ops_academic_debt_owner
  on public.khpos_ops_academic_debt(recovery_owner_assignment_id,status,recovery_due_date);
create index if not exists idx_khpos_ops_academic_debt_org
  on public.khpos_ops_academic_debt(organisation_id,status,recovery_due_date);
create index if not exists idx_khpos_ops_academic_debt_stream
  on public.khpos_ops_academic_debt(stream_id,status);
create index if not exists idx_khpos_ops_academic_debt_issue
  on public.khpos_ops_academic_debt(linked_issue_id)
  where linked_issue_id is not null;

create table if not exists public.khpos_ops_academic_observations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  stream_id uuid not null references public.khpos_ops_academic_delivery_streams(id) on delete cascade,
  target_id uuid references public.khpos_ops_academic_weekly_targets(id) on delete set null,
  observed_teacher_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  observer_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  observer_user_id uuid not null references auth.users(id) on delete restrict,
  observation_type text not null
    check (observation_type in ('micro','development','qa')),
  observed_at timestamptz not null,
  strengths text not null,
  improvement_area text,
  required_action text,
  action_due_date date,
  follow_up_status text not null default 'none'
    check (follow_up_status in ('none','open','evidence_submitted','verified','closed')),
  follow_up_note text,
  follow_up_reference text,
  follow_up_submitted_by uuid references auth.users(id) on delete set null,
  follow_up_submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    nullif(btrim(coalesce(required_action,'')),'') is null
    or action_due_date is not null
  )
);

create index if not exists idx_khpos_ops_academic_observations_stream
  on public.khpos_ops_academic_observations(stream_id,observed_at desc);
create index if not exists idx_khpos_ops_academic_observations_teacher
  on public.khpos_ops_academic_observations(observed_teacher_assignment_id,observed_at desc);
create index if not exists idx_khpos_ops_academic_observations_followup
  on public.khpos_ops_academic_observations(organisation_id,follow_up_status,action_due_date);

create table if not exists public.khpos_ops_academic_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid references public.khpos_ops_academic_terms(id) on delete cascade,
  stream_id uuid references public.khpos_ops_academic_delivery_streams(id) on delete cascade,
  target_id uuid references public.khpos_ops_academic_weekly_targets(id) on delete cascade,
  debt_id uuid references public.khpos_ops_academic_debt(id) on delete cascade,
  observation_id uuid references public.khpos_ops_academic_observations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_state text,
  to_state text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(term_id,stream_id,target_id,debt_id,observation_id)>=1)
);

create index if not exists idx_khpos_ops_academic_events_term
  on public.khpos_ops_academic_events(term_id,created_at desc)
  where term_id is not null;
create index if not exists idx_khpos_ops_academic_events_stream
  on public.khpos_ops_academic_events(stream_id,created_at desc)
  where stream_id is not null;
create index if not exists idx_khpos_ops_academic_events_target
  on public.khpos_ops_academic_events(target_id,created_at desc)
  where target_id is not null;
create index if not exists idx_khpos_ops_academic_events_debt
  on public.khpos_ops_academic_events(debt_id,created_at desc)
  where debt_id is not null;
create index if not exists idx_khpos_ops_academic_events_observation
  on public.khpos_ops_academic_events(observation_id,created_at desc)
  where observation_id is not null;

alter table public.khpos_ops_academic_terms enable row level security;
alter table public.khpos_ops_academic_delivery_streams enable row level security;
alter table public.khpos_ops_academic_weekly_targets enable row level security;
alter table public.khpos_ops_academic_debt enable row level security;
alter table public.khpos_ops_academic_observations enable row level security;
alter table public.khpos_ops_academic_events enable row level security;

revoke all privileges on table public.khpos_ops_academic_terms from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_academic_delivery_streams from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_academic_weekly_targets from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_academic_debt from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_academic_observations from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_academic_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_academic_terms to service_role;
grant select,insert,update,delete on table public.khpos_ops_academic_delivery_streams to service_role;
grant select,insert,update,delete on table public.khpos_ops_academic_weekly_targets to service_role;
grant select,insert,update,delete on table public.khpos_ops_academic_debt to service_role;
grant select,insert,update,delete on table public.khpos_ops_academic_observations to service_role;
grant select,insert,update,delete on table public.khpos_ops_academic_events to service_role;

create or replace function khpos_private.ops_academic_has_membership(
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

create or replace function khpos_private.ops_academic_member_role(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns text
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select m.role
  from public.organisation_memberships m
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
  limit 1;
$$;

create or replace function khpos_private.ops_academic_actor_has_role(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_role_codes text[]
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
      and r.code=any(p_role_codes)
  );
$$;

create or replace function khpos_private.ops_academic_can_plan(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select
    khpos_private.ops_academic_member_role(p_actor_user_id,p_organisation_id)='executive'
    or khpos_private.ops_academic_actor_has_role(
      p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR']
    );
$$;

create or replace function khpos_private.ops_academic_can_monitor(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select
    khpos_private.ops_academic_can_plan(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_academic_actor_has_role(
      p_actor_user_id,p_organisation_id,array['SECTIONAL_PROMOTER']
    );
$$;

create or replace function khpos_private.ops_academic_assignment_owned_by(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_assignment_id uuid
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
    where a.id=p_assignment_id
      and a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  );
$$;

create or replace function khpos_private.ops_academic_stream_visible(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_stream_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_academic_delivery_streams s
    join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
    where s.id=p_stream_id
      and s.organisation_id=p_organisation_id
      and (
        khpos_private.ops_academic_can_monitor(p_actor_user_id,p_organisation_id)
        or a.user_id=p_actor_user_id
        or khpos_private.ops_academic_actor_has_role(
          p_actor_user_id,p_organisation_id,array['VISION_CUSTODIAN']
        )
      )
  );
$$;

create or replace function khpos_private.ops_academic_target_teacher(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_academic_weekly_targets t
    join public.khpos_ops_academic_delivery_streams s on s.id=t.stream_id
    join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
    where t.id=p_target_id
      and t.organisation_id=p_organisation_id
      and a.user_id=p_actor_user_id
      and a.status='active'
  );
$$;

create or replace function khpos_private.ops_academic_debt_owner(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_debt_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_academic_debt d
    join public.khpos_ops_role_assignments a on a.id=d.recovery_owner_assignment_id
    where d.id=p_debt_id
      and d.organisation_id=p_organisation_id
      and a.user_id=p_actor_user_id
      and a.status='active'
  );
$$;

create or replace function public.khpos_ops_get_academic_delivery_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_org_name text;
  v_member_role text;
  v_can_plan boolean;
  v_can_monitor boolean;
  v_terms jsonb := '[]'::jsonb;
  v_campuses jsonb := '[]'::jsonb;
  v_units jsonb := '[]'::jsonb;
  v_teacher_assignments jsonb := '[]'::jsonb;
  v_streams jsonb := '[]'::jsonb;
  v_observations jsonb := '[]'::jsonb;
begin
  if not khpos_private.ops_academic_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select o.name,m.role into v_org_name,v_member_role
  from public.organisations o
  join public.organisation_memberships m on m.organisation_id=o.id
  where o.id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
  limit 1;

  v_can_plan := khpos_private.ops_academic_can_plan(
    p_actor_user_id,p_organisation_id
  );
  v_can_monitor := khpos_private.ops_academic_can_monitor(
    p_actor_user_id,p_organisation_id
  );

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

  if v_can_plan or v_can_monitor then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,
      'userId',a.user_id,
      'roleId',a.role_id,
      'campusId',a.campus_id,
      'unitId',a.unit_id,
      'displayName',coalesce(
        st.display_name,
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        au.email
      )
    ) order by coalesce(st.display_name,au.email)),'[]'::jsonb)
    into v_teacher_assignments
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    left join public.khpos_ops_staff st
      on st.organisation_id=p_organisation_id and st.role_assignment_id=a.id
    left join auth.users au on au.id=a.user_id
    where a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code='TEACHER';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,
    'campusId',t.campus_id,
    'sessionLabel',t.session_label,
    'termCode',t.term_code,
    'termName',t.term_name,
    'startDate',t.start_date,
    'endDate',t.end_date,
    'status',t.status
  ) order by t.start_date desc),'[]'::jsonb)
  into v_terms
  from public.khpos_ops_academic_terms t
  where t.organisation_id=p_organisation_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'termId',s.term_id,
    'campusId',s.campus_id,
    'unitId',s.unit_id,
    'classLabel',s.class_label,
    'sectionLabel',s.section_label,
    'subjectLabel',s.subject_label,
    'subjectCode',s.subject_code,
    'teacherAssignmentId',s.teacher_assignment_id,
    'teacherUserId',a.user_id,
    'teacherDisplay',coalesce(
      st.display_name,
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.email
    ),
    'schemeSource',s.scheme_source,
    'schemeReference',s.scheme_reference,
    'schemeVersion',s.scheme_version,
    'timetableReference',s.timetable_reference,
    'expectedWeeks',s.expected_weeks,
    'status',s.status,
    'isTeacher',a.user_id=p_actor_user_id,
    'canPlan',v_can_plan,
    'canMonitor',v_can_monitor,
    'targets',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',wt.id,
        'weekNumber',wt.week_number,
        'targetReference',wt.target_reference,
        'targetLabel',wt.target_label,
        'plannedStartDate',wt.planned_start_date,
        'plannedEndDate',wt.planned_end_date,
        'state',wt.state,
        'readinessNote',wt.readiness_note,
        'readinessReference',wt.readiness_reference,
        'deliveryNote',wt.delivery_note,
        'deliveryReference',wt.delivery_reference,
        'deliveredAt',wt.delivered_at,
        'verificationState',wt.verification_state,
        'verificationNote',wt.verification_note,
        'verificationReference',wt.verification_reference,
        'verifiedAt',wt.verified_at,
        'debt',(
          select jsonb_build_object(
            'id',d.id,
            'debtType',d.debt_type,
            'causeCategory',d.cause_category,
            'causeNote',d.cause_note,
            'severity',d.severity,
            'recoveryOwnerAssignmentId',d.recovery_owner_assignment_id,
            'recoveryPlan',d.recovery_plan,
            'recoveryDueDate',d.recovery_due_date,
            'status',d.status,
            'completionNote',d.completion_note,
            'evidenceReference',d.evidence_reference,
            'linkedIssueId',d.linked_issue_id,
            'isOwner',khpos_private.ops_academic_debt_owner(
              p_actor_user_id,p_organisation_id,d.id
            )
          )
          from public.khpos_ops_academic_debt d
          where d.target_id=wt.id
        )
      ) order by wt.week_number,wt.created_at)
      from public.khpos_ops_academic_weekly_targets wt
      where wt.stream_id=s.id
    ),'[]'::jsonb)
  ) order by s.class_label,s.subject_label),'[]'::jsonb)
  into v_streams
  from public.khpos_ops_academic_delivery_streams s
  join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
  left join public.khpos_ops_staff st
    on st.organisation_id=p_organisation_id and st.role_assignment_id=a.id
  left join auth.users u on u.id=a.user_id
  where s.organisation_id=p_organisation_id
    and khpos_private.ops_academic_stream_visible(
      p_actor_user_id,p_organisation_id,s.id
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,
    'streamId',o.stream_id,
    'targetId',o.target_id,
    'observedTeacherAssignmentId',o.observed_teacher_assignment_id,
    'observerUserId',o.observer_user_id,
    'observationType',o.observation_type,
    'observedAt',o.observed_at,
    'strengths',o.strengths,
    'improvementArea',o.improvement_area,
    'requiredAction',o.required_action,
    'actionDueDate',o.action_due_date,
    'followUpStatus',o.follow_up_status,
    'followUpNote',o.follow_up_note,
    'followUpReference',o.follow_up_reference,
    'isObservedTeacher',ta.user_id=p_actor_user_id,
    'canMonitor',v_can_monitor
  ) order by o.observed_at desc),'[]'::jsonb)
  into v_observations
  from public.khpos_ops_academic_observations o
  join public.khpos_ops_academic_delivery_streams s on s.id=o.stream_id
  join public.khpos_ops_role_assignments ta on ta.id=o.observed_teacher_assignment_id
  where o.organisation_id=p_organisation_id
    and khpos_private.ops_academic_stream_visible(
      p_actor_user_id,p_organisation_id,s.id
    );

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canPlan',v_can_plan,
    'canMonitor',v_can_monitor,
    'principle','Planned is not Delivered, and Delivered is not Verified. Academic debt remains visible until recovery evidence is independently verified.',
    'technologyBoundary','KSI owns lesson/scheme intelligence; SIS owns timetable and transactional records. KHP-OS stores execution references, delivery state, verification, academic debt, recovery and leadership exceptions.',
    'campuses',v_campuses,
    'units',v_units,
    'teacherAssignments',v_teacher_assignments,
    'terms',v_terms,
    'streams',v_streams,
    'observations',v_observations,
    'summary',jsonb_build_object(
      'activeTerms',(
        select count(*) from public.khpos_ops_academic_terms
        where organisation_id=p_organisation_id and status='active'
      ),
      'visibleStreams',jsonb_array_length(v_streams),
      'plannedTargets',(
        select count(*)
        from public.khpos_ops_academic_weekly_targets wt
        join public.khpos_ops_academic_delivery_streams s on s.id=wt.stream_id
        where wt.organisation_id=p_organisation_id
          and khpos_private.ops_academic_stream_visible(
            p_actor_user_id,p_organisation_id,s.id
          )
      ),
      'verifiedTargets',(
        select count(*)
        from public.khpos_ops_academic_weekly_targets wt
        join public.khpos_ops_academic_delivery_streams s on s.id=wt.stream_id
        where wt.organisation_id=p_organisation_id
          and wt.verification_state='verified'
          and khpos_private.ops_academic_stream_visible(
            p_actor_user_id,p_organisation_id,s.id
          )
      ),
      'openDebt',(
        select count(*)
        from public.khpos_ops_academic_debt d
        join public.khpos_ops_academic_delivery_streams s on s.id=d.stream_id
        where d.organisation_id=p_organisation_id
          and d.status<>'closed'
          and khpos_private.ops_academic_stream_visible(
            p_actor_user_id,p_organisation_id,s.id
          )
      ),
      'overdueDebt',(
        select count(*)
        from public.khpos_ops_academic_debt d
        join public.khpos_ops_academic_delivery_streams s on s.id=d.stream_id
        where d.organisation_id=p_organisation_id
          and d.status<>'closed'
          and d.recovery_due_date is not null
          and d.recovery_due_date<current_date
          and khpos_private.ops_academic_stream_visible(
            p_actor_user_id,p_organisation_id,s.id
          )
      ),
      'openObservationFollowUp',(
        select count(*)
        from public.khpos_ops_academic_observations o
        join public.khpos_ops_academic_delivery_streams s on s.id=o.stream_id
        where o.organisation_id=p_organisation_id
          and o.follow_up_status in ('open','evidence_submitted')
          and khpos_private.ops_academic_stream_visible(
            p_actor_user_id,p_organisation_id,s.id
          )
      )
    )
  );
end;
$$;

create or replace function public.khpos_ops_create_academic_term_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_campus_id uuid,
  p_session_label text,
  p_term_code text,
  p_term_name text,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
begin
  if not khpos_private.ops_academic_has_membership(
    p_actor_user_id,p_organisation_id
  ) or not khpos_private.ops_academic_can_plan(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only Academic Inspector, School Guardian or institutional executive authority can create the academic term.';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then
    raise exception 'Academic term requires valid start and end dates.';
  end if;

  if nullif(btrim(coalesce(p_session_label,'')),'') is null
     or nullif(btrim(coalesce(p_term_code,'')),'') is null
     or nullif(btrim(coalesce(p_term_name,'')),'') is null then
    raise exception 'Session, term code and term name are required.';
  end if;

  if p_campus_id is not null
     and not exists(
       select 1 from public.khpos_ops_campuses c
       where c.id=p_campus_id
         and c.organisation_id=p_organisation_id
         and c.status='active'
     ) then
    raise exception 'Academic term campus must be active in this organisation.';
  end if;

  insert into public.khpos_ops_academic_terms(
    organisation_id,campus_id,session_label,term_code,term_name,
    start_date,end_date,status,created_by
  ) values (
    p_organisation_id,p_campus_id,left(btrim(p_session_label),120),
    left(btrim(p_term_code),60),left(btrim(p_term_name),120),
    p_start_date,p_end_date,'draft',p_actor_user_id
  )
  returning id into v_id;

  insert into public.khpos_ops_academic_events(
    organisation_id,term_id,actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'term_created','draft',
    'Academic term baseline opened.'
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_academic_term_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_term public.khpos_ops_academic_terms%rowtype;
  v_to text;
begin
  select * into v_term
  from public.khpos_ops_academic_terms
  where id=p_term_id and organisation_id=p_organisation_id
  for update;

  if v_term.id is null then raise exception 'Academic term not found.'; end if;

  if not khpos_private.ops_academic_can_plan(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic planning authority can change academic-term status.';
  end if;

  if p_action='activate' then
    if v_term.status<>'draft' then
      raise exception 'Only a draft academic term can be activated.';
    end if;
    if not exists(
      select 1
      from public.khpos_ops_academic_delivery_streams s
      where s.term_id=v_term.id and s.status='approved'
    ) then
      raise exception 'Approve at least one curriculum delivery stream before activating the term.';
    end if;

    v_to := 'active';
    update public.khpos_ops_academic_terms
    set status=v_to,activated_by=p_actor_user_id,activated_at=now(),updated_at=now()
    where id=v_term.id;

    update public.khpos_ops_academic_delivery_streams
    set status='active',updated_at=now()
    where term_id=v_term.id and status='approved';

  elsif p_action='cancel' then
    if v_term.status<>'draft' then
      raise exception 'Only a draft academic term can be cancelled here.';
    end if;
    v_to := 'cancelled';
    update public.khpos_ops_academic_terms
    set status=v_to,updated_at=now()
    where id=v_term.id;

    update public.khpos_ops_academic_delivery_streams
    set status='cancelled',updated_at=now()
    where term_id=v_term.id and status in ('draft','approved');

  else
    raise exception 'Unsupported academic-term action.';
  end if;

  insert into public.khpos_ops_academic_events(
    organisation_id,term_id,actor_user_id,event_type,
    from_state,to_state,note
  ) values (
    p_organisation_id,v_term.id,p_actor_user_id,
    'term_'||p_action,v_term.status,v_to,left(nullif(btrim(coalesce(p_note,'')),''),4000)
  );
end;
$$;

create or replace function public.khpos_ops_create_academic_stream_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_campus_id uuid,
  p_unit_id uuid,
  p_class_label text,
  p_section_label text,
  p_subject_label text,
  p_subject_code text,
  p_teacher_assignment_id uuid,
  p_scheme_source text,
  p_scheme_reference text,
  p_scheme_version text,
  p_timetable_reference text,
  p_expected_weeks integer
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_term public.khpos_ops_academic_terms%rowtype;
  v_id uuid;
begin
  if not khpos_private.ops_academic_can_plan(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic planning authority can create curriculum delivery streams.';
  end if;

  select * into v_term
  from public.khpos_ops_academic_terms
  where id=p_term_id
    and organisation_id=p_organisation_id
    and status in ('draft','active');

  if v_term.id is null then
    raise exception 'Choose a draft or active academic term.';
  end if;

  if nullif(btrim(coalesce(p_class_label,'')),'') is null
     or nullif(btrim(coalesce(p_subject_label,'')),'') is null
     or nullif(btrim(coalesce(p_scheme_reference,'')),'') is null
     or nullif(btrim(coalesce(p_timetable_reference,'')),'') is null then
    raise exception 'Class, subject, approved scheme reference and timetable reference are required.';
  end if;

  if p_scheme_source not in ('KSI','SIS','external','manual') then
    raise exception 'Scheme source must be KSI, SIS, external or manual.';
  end if;

  if p_expected_weeks is null or p_expected_weeks not between 1 and 24 then
    raise exception 'Expected teaching weeks must be between 1 and 24.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.id=p_teacher_assignment_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code='TEACHER'
  ) then
    raise exception 'Academic delivery stream requires an active Teacher role assignment.';
  end if;

  if p_campus_id is not null
     and not exists(
       select 1 from public.khpos_ops_campuses c
       where c.id=p_campus_id
         and c.organisation_id=p_organisation_id
         and c.status='active'
     ) then
    raise exception 'Delivery-stream campus must be active.';
  end if;

  if p_unit_id is not null
     and not exists(
       select 1 from public.khpos_ops_units u
       where u.id=p_unit_id
         and u.organisation_id=p_organisation_id
         and u.status='active'
     ) then
    raise exception 'Delivery-stream unit must be active.';
  end if;

  insert into public.khpos_ops_academic_delivery_streams(
    organisation_id,term_id,campus_id,unit_id,class_label,section_label,
    subject_label,subject_code,teacher_assignment_id,scheme_source,
    scheme_reference,scheme_version,timetable_reference,expected_weeks,
    status,created_by
  ) values (
    p_organisation_id,p_term_id,p_campus_id,p_unit_id,
    left(btrim(p_class_label),120),
    left(nullif(btrim(coalesce(p_section_label,'')),''),120),
    left(btrim(p_subject_label),160),
    left(nullif(btrim(coalesce(p_subject_code,'')),''),80),
    p_teacher_assignment_id,p_scheme_source,left(btrim(p_scheme_reference),1000),
    left(nullif(btrim(coalesce(p_scheme_version,'')),''),120),
    left(btrim(p_timetable_reference),1000),p_expected_weeks,
    'draft',p_actor_user_id
  )
  returning id into v_id;

  insert into public.khpos_ops_academic_events(
    organisation_id,term_id,stream_id,actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,p_term_id,v_id,p_actor_user_id,
    'delivery_stream_created','draft',
    'Curriculum delivery stream created with external scheme/timetable references.'
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_academic_stream_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_stream_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_term_status text;
  v_to text;
begin
  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=p_stream_id and organisation_id=p_organisation_id
  for update;

  if v_stream.id is null then raise exception 'Academic delivery stream not found.'; end if;

  if not khpos_private.ops_academic_can_plan(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic planning authority can approve or cancel delivery streams.';
  end if;

  select status into v_term_status
  from public.khpos_ops_academic_terms
  where id=v_stream.term_id;

  if p_action='approve' then
    if v_stream.status<>'draft' then
      raise exception 'Only a draft delivery stream can be approved.';
    end if;
    if not exists(
      select 1
      from public.khpos_ops_academic_weekly_targets wt
      where wt.stream_id=v_stream.id
    ) then
      raise exception 'Add at least one approved-scheme weekly target before stream approval.';
    end if;

    v_to := case when v_term_status='active' then 'active' else 'approved' end;
    update public.khpos_ops_academic_delivery_streams
    set status=v_to,approved_by=p_actor_user_id,approved_at=now(),updated_at=now()
    where id=v_stream.id;

  elsif p_action='cancel' then
    if v_stream.status not in ('draft','approved') then
      raise exception 'Only a draft or approved delivery stream can be cancelled.';
    end if;
    v_to := 'cancelled';
    update public.khpos_ops_academic_delivery_streams
    set status=v_to,updated_at=now()
    where id=v_stream.id;

  else
    raise exception 'Unsupported academic-stream action.';
  end if;

  insert into public.khpos_ops_academic_events(
    organisation_id,term_id,stream_id,actor_user_id,event_type,
    from_state,to_state,note
  ) values (
    p_organisation_id,v_stream.term_id,v_stream.id,p_actor_user_id,
    'delivery_stream_'||p_action,v_stream.status,v_to,
    left(nullif(btrim(coalesce(p_note,'')),''),4000)
  );
end;
$$;

create or replace function public.khpos_ops_update_academic_stream_assignment_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_stream_id uuid,
  p_teacher_assignment_id uuid,
  p_timetable_reference text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $
declare
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=p_stream_id and organisation_id=p_organisation_id
  for update;

  if v_stream.id is null then raise exception 'Academic delivery stream not found.'; end if;

  if not khpos_private.ops_academic_can_plan(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic planning authority can change stream deployment.';
  end if;

  if v_stream.status not in ('approved','active') then
    raise exception 'Only approved/active streams can change teacher deployment.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.id=p_teacher_assignment_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code='TEACHER'
  ) then
    raise exception 'Replacement delivery owner must be an active Teacher role assignment.';
  end if;

  if nullif(btrim(coalesce(p_timetable_reference,'')),'') is null or v_note is null then
    raise exception 'Updated timetable/deployment reference and change note are required.';
  end if;

  update public.khpos_ops_academic_delivery_streams
  set teacher_assignment_id=p_teacher_assignment_id,
      timetable_reference=left(btrim(p_timetable_reference),1000),
      updated_at=now()
  where id=v_stream.id;

  insert into public.khpos_ops_academic_events(
    organisation_id,term_id,stream_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_stream.term_id,v_stream.id,p_actor_user_id,
    'delivery_stream_assignment_updated',left(v_note,4000),
    jsonb_build_object(
      'fromTeacherAssignmentId',v_stream.teacher_assignment_id,
      'toTeacherAssignmentId',p_teacher_assignment_id,
      'fromTimetableReference',v_stream.timetable_reference,
      'toTimetableReference',left(btrim(p_timetable_reference),1000)
    )
  );
end;
$;

create or replace function public.khpos_ops_add_academic_target_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_stream_id uuid,
  p_week_number integer,
  p_target_reference text,
  p_target_label text,
  p_planned_start_date date,
  p_planned_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_id uuid;
begin
  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=p_stream_id and organisation_id=p_organisation_id;

  if v_stream.id is null then raise exception 'Academic delivery stream not found.'; end if;

  if not khpos_private.ops_academic_can_monitor(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only Sectional Promoter, Academic Inspector, School Guardian or executive authority can set weekly curriculum targets.';
  end if;

  if v_stream.status not in ('draft','approved','active') then
    raise exception 'Weekly target cannot be added to a closed or cancelled delivery stream.';
  end if;

  if p_week_number is null or p_week_number<1 or p_week_number>v_stream.expected_weeks then
    raise exception 'Week number must be within the stream''s approved teaching weeks.';
  end if;

  if nullif(btrim(coalesce(p_target_reference,'')),'') is null
     or nullif(btrim(coalesce(p_target_label,'')),'') is null then
    raise exception 'Weekly target reference and concise target label are required.';
  end if;

  if p_planned_start_date is not null
     and p_planned_end_date is not null
     and p_planned_end_date<p_planned_start_date then
    raise exception 'Weekly target end date cannot precede its start date.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_academic_terms term
    where term.id=v_stream.term_id
      and (
        (p_planned_start_date is not null and p_planned_start_date<term.start_date)
        or (p_planned_end_date is not null and p_planned_end_date>term.end_date)
      )
  ) then
    raise exception 'Weekly target dates must fall within the academic term.';
  end if;

  insert into public.khpos_ops_academic_weekly_targets(
    organisation_id,stream_id,week_number,target_reference,target_label,
    planned_start_date,planned_end_date,state,created_by
  ) values (
    p_organisation_id,p_stream_id,p_week_number,
    left(btrim(p_target_reference),500),left(btrim(p_target_label),500),
    p_planned_start_date,p_planned_end_date,'planned',p_actor_user_id
  )
  returning id into v_id;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,p_stream_id,v_id,p_actor_user_id,
    'weekly_target_added','planned',left(btrim(p_target_label),500)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_academic_target_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_target_id uuid,
  p_action text,
  p_note text default null,
  p_reference text default null,
  p_cause_category text default null,
  p_severity text default 'P3'
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_target public.khpos_ops_academic_weekly_targets%rowtype;
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_teacher_user uuid;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_reference text := nullif(btrim(coalesce(p_reference,'')),'');
  v_from text;
  v_to text;
  v_debt_type text;
  v_debt_id uuid;
begin
  select * into v_target
  from public.khpos_ops_academic_weekly_targets
  where id=p_target_id and organisation_id=p_organisation_id
  for update;

  if v_target.id is null then raise exception 'Academic weekly target not found.'; end if;

  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=v_target.stream_id;

  select a.user_id into v_teacher_user
  from public.khpos_ops_role_assignments a
  where a.id=v_stream.teacher_assignment_id
    and a.status='active';

  if v_teacher_user is distinct from p_actor_user_id then
    raise exception 'Only the assigned teacher can update readiness or delivery for this target.';
  end if;

  if v_stream.status not in ('approved','active') then
    raise exception 'The curriculum delivery stream must be approved before lesson execution can be recorded.';
  end if;

  v_from := v_target.state;

  if p_action='ready' then
    if v_target.state not in ('planned','ready') then
      raise exception 'Only a planned target can be marked ready.';
    end if;
    if v_reference is null then
      raise exception 'Lesson readiness requires a preparation reference, such as the KSI lesson or approved lesson record.';
    end if;
    v_to := 'ready';

    update public.khpos_ops_academic_weekly_targets
    set state=v_to,readiness_note=v_note,
        readiness_reference=left(v_reference,1000),
        readiness_updated_by=p_actor_user_id,
        readiness_updated_at=now(),updated_at=now()
    where id=v_target.id;

  elsif p_action='start' then
    if v_target.state<>'ready' then
      raise exception 'Mark the target ready before starting delivery.';
    end if;
    v_to := 'in_progress';
    update public.khpos_ops_academic_weekly_targets
    set state=v_to,updated_at=now()
    where id=v_target.id;

  elsif p_action='delivered' then
    if v_target.state not in ('ready','in_progress') then
      raise exception 'Only ready or in-progress learning can be marked delivered.';
    end if;
    if v_note is null or v_reference is null then
      raise exception 'Delivered learning requires a delivery note and evidence/reference.';
    end if;
    v_to := 'delivered';

    update public.khpos_ops_academic_weekly_targets
    set state=v_to,delivery_note=left(v_note,6000),
        delivery_reference=left(v_reference,1000),
        delivered_by=p_actor_user_id,delivered_at=now(),
        verification_state='unverified',
        verification_note=null,verification_reference=null,
        verified_by=null,verified_at=null,updated_at=now()
    where id=v_target.id;

  elsif p_action in ('partial','missed') then
    if v_target.state not in ('ready','in_progress','planned') then
      raise exception 'Only planned, ready or in-progress learning can be marked partial/missed.';
    end if;
    if v_note is null then
      raise exception 'Partial or missed delivery requires a specific cause note.';
    end if;
    if p_cause_category not in (
      'absence','timetable_disruption','resource','teacher_readiness',
      'learner_gap','event_disruption','infrastructure','other'
    ) then
      raise exception 'Choose a valid academic-debt cause category.';
    end if;
    if p_severity not in ('P2','P3','P4') then
      raise exception 'Academic debt severity must be P2, P3 or P4.';
    end if;

    v_to := 'recovery_required';
    v_debt_type := case when p_action='partial'
      then 'partial_delivery' else 'missed_delivery' end;

    update public.khpos_ops_academic_weekly_targets
    set state=v_to,delivery_note=left(v_note,6000),
        delivery_reference=left(v_reference,1000),
        delivered_by=p_actor_user_id,delivered_at=now(),
        verification_state='unverified',
        verification_note=null,verification_reference=null,
        verified_by=null,verified_at=null,updated_at=now()
    where id=v_target.id;

    insert into public.khpos_ops_academic_debt(
      organisation_id,target_id,stream_id,debt_type,cause_category,cause_note,
      severity,recovery_owner_assignment_id,status,created_by
    ) values (
      p_organisation_id,v_target.id,v_stream.id,v_debt_type,p_cause_category,
      left(v_note,6000),p_severity,v_stream.teacher_assignment_id,'open',
      p_actor_user_id
    )
    on conflict (target_id) do update
      set debt_type=excluded.debt_type,
          cause_category=excluded.cause_category,
          cause_note=excluded.cause_note,
          severity=excluded.severity,
          recovery_owner_assignment_id=excluded.recovery_owner_assignment_id,
          status=case
            when public.khpos_ops_academic_debt.status='closed'
            then 'open'
            else public.khpos_ops_academic_debt.status
          end,
          updated_at=now()
    returning id into v_debt_id;

  else
    raise exception 'Unsupported academic target action.';
  end if;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,debt_id,actor_user_id,event_type,
    from_state,to_state,note,metadata
  ) values (
    p_organisation_id,v_stream.id,v_target.id,v_debt_id,p_actor_user_id,
    'target_'||p_action,v_from,v_to,left(v_note,4000),
    jsonb_build_object('reference',v_reference,'causeCategory',p_cause_category)
  );
end;
$$;

create or replace function public.khpos_ops_verify_academic_target_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_target_id uuid,
  p_decision text,
  p_note text,
  p_reference text default null,
  p_rejection_cause_category text default 'other',
  p_severity text default 'P3'
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_target public.khpos_ops_academic_weekly_targets%rowtype;
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_teacher_user uuid;
  v_debt_id uuid;
begin
  select * into v_target
  from public.khpos_ops_academic_weekly_targets
  where id=p_target_id and organisation_id=p_organisation_id
  for update;

  if v_target.id is null then raise exception 'Academic weekly target not found.'; end if;

  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=v_target.stream_id;

  if not khpos_private.ops_academic_can_monitor(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic monitoring authority can verify lesson delivery.';
  end if;

  select user_id into v_teacher_user
  from public.khpos_ops_role_assignments
  where id=v_stream.teacher_assignment_id;

  if v_teacher_user=p_actor_user_id then
    raise exception 'The delivering teacher cannot verify their own delivery.';
  end if;

  if v_target.state<>'delivered' then
    raise exception 'Only a fully delivered target can enter delivery verification.';
  end if;

  if v_target.verification_state<>'unverified' then
    raise exception 'This delivery already has a verification decision; reopen through academic recovery rather than overwriting history.';
  end if;

  if p_decision not in ('verify','reject') then
    raise exception 'Delivery verification decision must be verify or reject.';
  end if;

  if nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'Verification note is required.';
  end if;

  if p_decision='verify' then
    update public.khpos_ops_academic_weekly_targets
    set verification_state='verified',
        verification_note=left(btrim(p_note),6000),
        verification_reference=left(nullif(btrim(coalesce(p_reference,'')),''),1000),
        verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
    where id=v_target.id;

  else
    if p_rejection_cause_category not in (
      'absence','timetable_disruption','resource','teacher_readiness',
      'learner_gap','event_disruption','infrastructure','other'
    ) then
      raise exception 'Choose a valid cause category for rejected delivery.';
    end if;
    if p_severity not in ('P2','P3','P4') then
      raise exception 'Academic debt severity must be P2, P3 or P4.';
    end if;

    update public.khpos_ops_academic_weekly_targets
    set state='recovery_required',
        verification_state='rejected',
        verification_note=left(btrim(p_note),6000),
        verification_reference=left(nullif(btrim(coalesce(p_reference,'')),''),1000),
        verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
    where id=v_target.id;

    insert into public.khpos_ops_academic_debt(
      organisation_id,target_id,stream_id,debt_type,cause_category,cause_note,
      severity,recovery_owner_assignment_id,status,created_by
    ) values (
      p_organisation_id,v_target.id,v_stream.id,'verification_rejected',
      p_rejection_cause_category,left(btrim(p_note),6000),p_severity,
      v_stream.teacher_assignment_id,'open',p_actor_user_id
    )
    on conflict (target_id) do update
      set debt_type='verification_rejected',
          cause_category=excluded.cause_category,
          cause_note=excluded.cause_note,
          severity=excluded.severity,
          recovery_owner_assignment_id=excluded.recovery_owner_assignment_id,
          status='open',recovery_plan=null,recovery_due_date=null,
          completion_note=null,evidence_reference=null,
          submitted_by=null,submitted_at=null,verified_by=null,verified_at=null,
          closed_at=null,updated_at=now()
    returning id into v_debt_id;
  end if;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,debt_id,actor_user_id,event_type,
    from_state,to_state,note,metadata
  ) values (
    p_organisation_id,v_stream.id,v_target.id,v_debt_id,p_actor_user_id,
    'target_verification_'||p_decision,
    v_target.verification_state,
    case when p_decision='verify' then 'verified' else 'rejected' end,
    left(btrim(p_note),4000),
    jsonb_build_object('reference',nullif(btrim(coalesce(p_reference,'')),''))
  );
end;
$$;

create or replace function public.khpos_ops_academic_debt_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_debt_id uuid,
  p_action text,
  p_note text default null,
  p_due_date date default null,
  p_evidence_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_debt public.khpos_ops_academic_debt%rowtype;
  v_target public.khpos_ops_academic_weekly_targets%rowtype;
  v_owner boolean;
  v_monitor boolean;
  v_from text;
  v_to text;
begin
  select * into v_debt
  from public.khpos_ops_academic_debt
  where id=p_debt_id and organisation_id=p_organisation_id
  for update;

  if v_debt.id is null then raise exception 'Academic debt record not found.'; end if;

  select * into v_target
  from public.khpos_ops_academic_weekly_targets
  where id=v_debt.target_id
  for update;

  v_owner := khpos_private.ops_academic_debt_owner(
    p_actor_user_id,p_organisation_id,v_debt.id
  );
  v_monitor := khpos_private.ops_academic_can_monitor(
    p_actor_user_id,p_organisation_id
  );
  v_from := v_debt.status;

  if p_action='plan' then
    if not v_owner and not v_monitor then
      raise exception 'Only the recovery owner or academic monitoring authority can plan recovery.';
    end if;
    if v_debt.status not in ('open','planned') then
      raise exception 'Only open/planned academic debt can update its recovery plan.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null or p_due_date is null then
      raise exception 'Recovery plan and due date are required.';
    end if;
    if p_due_date<current_date then
      raise exception 'Recovery due date cannot be in the past.';
    end if;

    v_to := 'planned';
    update public.khpos_ops_academic_debt
    set recovery_plan=left(btrim(p_note),6000),
        recovery_due_date=p_due_date,status=v_to,updated_at=now()
    where id=v_debt.id;

  elsif p_action='start' then
    if not v_owner then raise exception 'Only the recovery owner can start recovery.'; end if;
    if v_debt.status<>'planned' then raise exception 'Plan recovery before starting it.'; end if;

    v_to := 'in_progress';
    update public.khpos_ops_academic_debt
    set status=v_to,updated_at=now()
    where id=v_debt.id;

  elsif p_action='submit_evidence' then
    if not v_owner then raise exception 'Only the recovery owner can submit recovery evidence.'; end if;
    if v_debt.status not in ('planned','in_progress') then
      raise exception 'Only planned/in-progress recovery can submit evidence.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null
       or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
      raise exception 'Recovery completion note and evidence reference are required.';
    end if;

    v_to := 'evidence_submitted';
    update public.khpos_ops_academic_debt
    set status=v_to,completion_note=left(btrim(p_note),6000),
        evidence_reference=left(btrim(p_evidence_reference),1000),
        submitted_by=p_actor_user_id,submitted_at=now(),updated_at=now()
    where id=v_debt.id;

  elsif p_action='verify' then
    if not v_monitor then raise exception 'Only academic monitoring authority can verify recovery.'; end if;
    if v_debt.status<>'evidence_submitted' then
      raise exception 'Only submitted recovery evidence can be verified.';
    end if;
    if v_owner then
      raise exception 'The recovery owner cannot verify their own recovery evidence.';
    end if;

    v_to := 'closed';
    update public.khpos_ops_academic_debt
    set status=v_to,verified_by=p_actor_user_id,verified_at=now(),
        closed_at=now(),updated_at=now()
    where id=v_debt.id;

    update public.khpos_ops_academic_weekly_targets
    set state='recovered',verification_state='verified',
        verification_note='Academic debt recovery independently verified.',
        verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
    where id=v_target.id;

  elsif p_action='reopen' then
    if not v_monitor then raise exception 'Only academic monitoring authority can reopen recovery.'; end if;
    if v_debt.status not in ('evidence_submitted','closed') then
      raise exception 'Only submitted or closed academic debt can be reopened.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'Explain why academic debt is being reopened.';
    end if;

    v_to := 'in_progress';
    update public.khpos_ops_academic_debt
    set status=v_to,completion_note=null,evidence_reference=null,
        submitted_by=null,submitted_at=null,verified_by=null,verified_at=null,
        closed_at=null,updated_at=now()
    where id=v_debt.id;

    update public.khpos_ops_academic_weekly_targets
    set state='recovery_required',verification_state='rejected',
        verification_note=left(btrim(p_note),6000),
        verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
    where id=v_target.id;

  else
    raise exception 'Unsupported academic-debt action.';
  end if;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,debt_id,actor_user_id,event_type,
    from_state,to_state,note,metadata
  ) values (
    p_organisation_id,v_debt.stream_id,v_debt.target_id,v_debt.id,
    p_actor_user_id,'academic_debt_'||p_action,
    v_from,v_to,left(nullif(btrim(coalesce(p_note,'')),''),4000),
    jsonb_build_object(
      'dueDate',p_due_date,
      'evidenceReference',nullif(btrim(coalesce(p_evidence_reference,'')),'')
    )
  );
end;
$$;

create or replace function public.khpos_ops_reassign_academic_debt_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_debt_id uuid,
  p_recovery_owner_assignment_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $
declare
  v_debt public.khpos_ops_academic_debt%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_debt
  from public.khpos_ops_academic_debt
  where id=p_debt_id and organisation_id=p_organisation_id
  for update;

  if v_debt.id is null then raise exception 'Academic debt record not found.'; end if;
  if v_debt.status='closed' then raise exception 'Closed academic debt cannot be reassigned.'; end if;

  if not khpos_private.ops_academic_can_monitor(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic monitoring authority can reassign recovery ownership.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.id=p_recovery_owner_assignment_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code='TEACHER'
  ) then
    raise exception 'Academic recovery owner must be an active Teacher assignment.';
  end if;

  if v_note is null then raise exception 'Recovery-owner reassignment note is required.'; end if;

  update public.khpos_ops_academic_debt
  set recovery_owner_assignment_id=p_recovery_owner_assignment_id,
      updated_at=now()
  where id=v_debt.id;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,debt_id,actor_user_id,
    event_type,note,metadata
  ) values (
    p_organisation_id,v_debt.stream_id,v_debt.target_id,v_debt.id,
    p_actor_user_id,'academic_debt_owner_reassigned',left(v_note,4000),
    jsonb_build_object(
      'fromAssignmentId',v_debt.recovery_owner_assignment_id,
      'toAssignmentId',p_recovery_owner_assignment_id
    )
  );
end;
$;

create or replace function public.khpos_ops_escalate_academic_debt_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_debt_id uuid,
  p_severity text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_debt public.khpos_ops_academic_debt%rowtype;
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_target public.khpos_ops_academic_weekly_targets%rowtype;
  v_process_id uuid;
  v_issue_id uuid;
  v_owner_role uuid;
  v_parent_role uuid;
begin
  if not khpos_private.ops_academic_can_monitor(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic monitoring authority can escalate academic debt.';
  end if;

  if p_severity not in ('P1','P2','P3','P4') then
    raise exception 'Issue severity must be P1, P2, P3 or P4.';
  end if;

  if nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'Escalation reason is required.';
  end if;

  select * into v_debt
  from public.khpos_ops_academic_debt
  where id=p_debt_id and organisation_id=p_organisation_id
  for update;

  if v_debt.id is null then raise exception 'Academic debt record not found.'; end if;
  if v_debt.status='closed' then raise exception 'Closed academic debt cannot be escalated.'; end if;

  if v_debt.linked_issue_id is not null
     and exists(
       select 1 from public.khpos_ops_issues i
       where i.id=v_debt.linked_issue_id and i.status<>'closed'
     ) then
    return v_debt.linked_issue_id;
  end if;

  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=v_debt.stream_id;

  select * into v_target
  from public.khpos_ops_academic_weekly_targets
  where id=v_debt.target_id;

  select id into v_process_id
  from public.khpos_ops_processes
  where organisation_id=p_organisation_id and code='ACD-007';

  insert into public.khpos_ops_issues(
    organisation_id,campus_id,unit_id,process_id,
    issue_type,category,severity,sensitivity,title,description,status,
    owner_assignment_id,reported_by,due_at,immediate_action
  ) values (
    p_organisation_id,v_stream.campus_id,v_stream.unit_id,v_process_id,
    'system_exception','academic_execution',p_severity,'standard',
    left('Academic debt: '||v_stream.class_label||' · '||
      v_stream.subject_label||' · '||v_target.target_label,180),
    left(btrim(p_reason),4000),'assigned',
    v_debt.recovery_owner_assignment_id,p_actor_user_id,
    case when v_debt.recovery_due_date is null then null
      else v_debt.recovery_due_date::timestamptz end,
    'Recover the missed/weak learning and verify evidence before the debt is closed.'
  )
  returning id into v_issue_id;

  insert into public.khpos_ops_issue_events(
    organisation_id,issue_id,actor_user_id,event_type,to_status,note,metadata
  ) values (
    p_organisation_id,v_issue_id,p_actor_user_id,'auto_reported','assigned',
    left(btrim(p_reason),4000),
    jsonb_build_object('academicDebtId',v_debt.id,'targetId',v_target.id)
  );

  if p_severity='P1' then
    select a.role_id into v_owner_role
    from public.khpos_ops_role_assignments a
    where a.id=v_debt.recovery_owner_assignment_id;

    select reports_to_role_id into v_parent_role
    from public.khpos_ops_roles where id=v_owner_role;

    if v_parent_role is not null then
      insert into public.khpos_ops_issue_escalations(
        organisation_id,issue_id,from_role_id,target_role_id,
        escalated_by,reason
      ) values (
        p_organisation_id,v_issue_id,v_owner_role,v_parent_role,
        p_actor_user_id,'P1 academic delivery exception requires immediate leadership visibility.'
      );
    end if;
  end if;

  update public.khpos_ops_academic_debt
  set linked_issue_id=v_issue_id,updated_at=now()
  where id=v_debt.id;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,debt_id,actor_user_id,
    event_type,note,metadata
  ) values (
    p_organisation_id,v_debt.stream_id,v_debt.target_id,v_debt.id,
    p_actor_user_id,'academic_debt_escalated',left(btrim(p_reason),4000),
    jsonb_build_object('issueId',v_issue_id,'severity',p_severity)
  );

  return v_issue_id;
end;
$$;

create or replace function public.khpos_ops_create_academic_observation_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_stream_id uuid,
  p_target_id uuid,
  p_observation_type text,
  p_observed_at timestamptz,
  p_strengths text,
  p_improvement_area text default null,
  p_required_action text default null,
  p_action_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_observer_assignment uuid;
  v_teacher_user uuid;
  v_id uuid;
  v_followup text;
begin
  if not khpos_private.ops_academic_can_monitor(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic monitoring authority can record teaching observations.';
  end if;

  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=p_stream_id and organisation_id=p_organisation_id;

  if v_stream.id is null then raise exception 'Academic delivery stream not found.'; end if;

  select user_id into v_teacher_user
  from public.khpos_ops_role_assignments
  where id=v_stream.teacher_assignment_id;

  if v_teacher_user=p_actor_user_id then
    raise exception 'A teacher cannot record an institutional observation of their own teaching.';
  end if;

  if p_observation_type not in ('micro','development','qa') then
    raise exception 'Observation type must be micro, development or qa.';
  end if;

  if nullif(btrim(coalesce(p_strengths,'')),'') is null then
    raise exception 'Teaching observation requires specific observed strengths/evidence.';
  end if;

  if nullif(btrim(coalesce(p_required_action,'')),'') is not null
     and p_action_due_date is null then
    raise exception 'Required observation action must have a due date.';
  end if;

  if p_target_id is not null
     and not exists(
       select 1 from public.khpos_ops_academic_weekly_targets wt
       where wt.id=p_target_id and wt.stream_id=v_stream.id
     ) then
    raise exception 'Observation target does not belong to this delivery stream.';
  end if;

  select a.id into v_observer_assignment
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.user_id=p_actor_user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.code in ('SECTIONAL_PROMOTER','ACADEMIC_INSPECTOR','SCHOOL_GUARDIAN')
  order by r.role_level,a.primary_assignment desc,a.created_at
  limit 1;

  v_followup := case
    when nullif(btrim(coalesce(p_required_action,'')),'') is null
    then 'none' else 'open' end;

  insert into public.khpos_ops_academic_observations(
    organisation_id,stream_id,target_id,observed_teacher_assignment_id,
    observer_assignment_id,observer_user_id,observation_type,observed_at,
    strengths,improvement_area,required_action,action_due_date,
    follow_up_status
  ) values (
    p_organisation_id,v_stream.id,p_target_id,v_stream.teacher_assignment_id,
    v_observer_assignment,p_actor_user_id,p_observation_type,
    coalesce(p_observed_at,now()),left(btrim(p_strengths),6000),
    left(nullif(btrim(coalesce(p_improvement_area,'')),''),6000),
    left(nullif(btrim(coalesce(p_required_action,'')),''),6000),
    p_action_due_date,v_followup
  )
  returning id into v_id;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,observation_id,
    actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,v_stream.id,p_target_id,v_id,p_actor_user_id,
    'teaching_observation_recorded',v_followup,left(btrim(p_strengths),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_academic_observation_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_observation_id uuid,
  p_action text,
  p_note text default null,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_obs public.khpos_ops_academic_observations%rowtype;
  v_teacher_user uuid;
  v_from text;
  v_to text;
begin
  select * into v_obs
  from public.khpos_ops_academic_observations
  where id=p_observation_id and organisation_id=p_organisation_id
  for update;

  if v_obs.id is null then raise exception 'Teaching observation not found.'; end if;

  select user_id into v_teacher_user
  from public.khpos_ops_role_assignments
  where id=v_obs.observed_teacher_assignment_id;

  v_from := v_obs.follow_up_status;

  if p_action='submit_followup' then
    if v_teacher_user is distinct from p_actor_user_id then
      raise exception 'Only the observed teacher can submit observation follow-up evidence.';
    end if;
    if v_obs.follow_up_status<>'open' then
      raise exception 'This observation is not awaiting teacher follow-up.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null
       or nullif(btrim(coalesce(p_reference,'')),'') is null then
      raise exception 'Follow-up note and evidence reference are required.';
    end if;

    v_to := 'evidence_submitted';
    update public.khpos_ops_academic_observations
    set follow_up_status=v_to,follow_up_note=left(btrim(p_note),6000),
        follow_up_reference=left(btrim(p_reference),1000),
        follow_up_submitted_by=p_actor_user_id,
        follow_up_submitted_at=now(),updated_at=now()
    where id=v_obs.id;

  elsif p_action='verify_followup' then
    if not khpos_private.ops_academic_can_monitor(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only academic monitoring authority can verify observation follow-up.';
    end if;
    if v_teacher_user=p_actor_user_id then
      raise exception 'The observed teacher cannot verify their own follow-up.';
    end if;
    if v_obs.follow_up_status<>'evidence_submitted' then
      raise exception 'Only submitted observation follow-up can be verified.';
    end if;

    v_to := 'closed';
    update public.khpos_ops_academic_observations
    set follow_up_status=v_to,verified_by=p_actor_user_id,
        verified_at=now(),updated_at=now()
    where id=v_obs.id;

  elsif p_action='reopen_followup' then
    if not khpos_private.ops_academic_can_monitor(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only academic monitoring authority can reopen observation follow-up.';
    end if;
    if v_obs.follow_up_status not in ('evidence_submitted','closed') then
      raise exception 'Only submitted/closed observation follow-up can be reopened.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'Explain why observation follow-up is being reopened.';
    end if;

    v_to := 'open';
    update public.khpos_ops_academic_observations
    set follow_up_status=v_to,follow_up_note=null,follow_up_reference=null,
        follow_up_submitted_by=null,follow_up_submitted_at=null,
        verified_by=null,verified_at=null,updated_at=now()
    where id=v_obs.id;

  else
    raise exception 'Unsupported observation follow-up action.';
  end if;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,observation_id,
    actor_user_id,event_type,from_state,to_state,note,metadata
  ) values (
    p_organisation_id,v_obs.stream_id,v_obs.target_id,v_obs.id,
    p_actor_user_id,'observation_'||p_action,v_from,v_to,
    left(nullif(btrim(coalesce(p_note,'')),''),4000),
    jsonb_build_object('reference',nullif(btrim(coalesce(p_reference,'')),''))
  );
end;
$$;

revoke execute on function khpos_private.ops_academic_has_membership(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_academic_member_role(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_academic_actor_has_role(uuid,uuid,text[])
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_academic_can_plan(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_academic_can_monitor(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_academic_assignment_owned_by(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_academic_stream_visible(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_academic_target_teacher(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_academic_debt_owner(uuid,uuid,uuid)
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_academic_delivery_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_academic_term_server(uuid,uuid,uuid,text,text,text,date,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_academic_term_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_academic_stream_server(uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,text,text,text,text,integer)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_academic_stream_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_update_academic_stream_assignment_server(uuid,uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_academic_target_server(uuid,uuid,uuid,integer,text,text,date,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_academic_target_action_server(uuid,uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_verify_academic_target_server(uuid,uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_academic_debt_action_server(uuid,uuid,uuid,text,text,date,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_reassign_academic_debt_server(uuid,uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_escalate_academic_debt_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_academic_observation_server(uuid,uuid,uuid,uuid,text,timestamp with time zone,text,text,text,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_academic_observation_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_academic_has_membership(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_academic_member_role(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_academic_actor_has_role(uuid,uuid,text[]) to service_role;
grant execute on function khpos_private.ops_academic_can_plan(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_academic_can_monitor(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_academic_assignment_owned_by(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_academic_stream_visible(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_academic_target_teacher(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_academic_debt_owner(uuid,uuid,uuid) to service_role;

grant execute on function public.khpos_ops_get_academic_delivery_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_academic_term_server(uuid,uuid,uuid,text,text,text,date,date) to service_role;
grant execute on function public.khpos_ops_academic_term_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_create_academic_stream_server(uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,text,text,text,text,integer) to service_role;
grant execute on function public.khpos_ops_academic_stream_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_update_academic_stream_assignment_server(uuid,uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_add_academic_target_server(uuid,uuid,uuid,integer,text,text,date,date) to service_role;
grant execute on function public.khpos_ops_academic_target_action_server(uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_verify_academic_target_server(uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_academic_debt_action_server(uuid,uuid,uuid,text,text,date,text) to service_role;
grant execute on function public.khpos_ops_reassign_academic_debt_server(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.khpos_ops_escalate_academic_debt_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_create_academic_observation_server(uuid,uuid,uuid,uuid,text,timestamp with time zone,text,text,text,date) to service_role;
grant execute on function public.khpos_ops_academic_observation_action_server(uuid,uuid,uuid,text,text,text) to service_role;
