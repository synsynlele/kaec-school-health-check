create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_assessment_cycles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  cycle_reference text not null,
  title text not null,
  cycle_type text not null
    check (cycle_type in (
      'continuous_assessment','midterm','terminal','mock',
      'external_exam','practical','other'
    )),
  exam_body_label text,
  starts_on date not null,
  ends_on date not null,
  results_due_on date,
  external_system text,
  external_reference text,
  status text not null default 'draft'
    check (status in (
      'draft','planned','ready','in_progress',
      'results_pending','closed','cancelled'
    )),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,cycle_reference),
  check (ends_on>=starts_on),
  check (results_due_on is null or results_due_on>=ends_on)
);

create index if not exists idx_khpos_ops_assessment_cycles_term
  on public.khpos_ops_assessment_cycles(term_id,status,starts_on);
create index if not exists idx_khpos_ops_assessment_cycles_org
  on public.khpos_ops_assessment_cycles(organisation_id,status,starts_on);
create index if not exists idx_khpos_ops_assessment_cycles_campus
  on public.khpos_ops_assessment_cycles(campus_id,status)
  where campus_id is not null;

create table if not exists public.khpos_ops_assessment_packages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  cycle_id uuid not null references public.khpos_ops_assessment_cycles(id) on delete cascade,
  stream_id uuid not null references public.khpos_ops_academic_delivery_streams(id) on delete cascade,
  package_reference text not null,
  assessment_source text not null
    check (assessment_source in ('KSI','SIS','CBT','external','manual')),
  source_reference text not null,
  blueprint_reference text not null,
  integrity_declaration boolean not null default false,
  moderation_state text not null default 'draft'
    check (moderation_state in (
      'draft','submitted','changes_required','approved','withdrawn'
    )),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  moderator_user_id uuid references auth.users(id) on delete set null,
  moderation_note text,
  moderated_at timestamptz,
  approved_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id,stream_id),
  unique (organisation_id,package_reference)
);

create index if not exists idx_khpos_ops_assessment_packages_cycle
  on public.khpos_ops_assessment_packages(cycle_id,moderation_state);
create index if not exists idx_khpos_ops_assessment_packages_stream
  on public.khpos_ops_assessment_packages(stream_id,moderation_state);
create index if not exists idx_khpos_ops_assessment_packages_submitter
  on public.khpos_ops_assessment_packages(submitted_by,submitted_at desc)
  where submitted_by is not null;

create table if not exists public.khpos_ops_exam_readiness_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  cycle_id uuid not null references public.khpos_ops_assessment_cycles(id) on delete cascade,
  stream_id uuid references public.khpos_ops_academic_delivery_streams(id) on delete set null,
  item_code text not null,
  category text not null
    check (category in (
      'candidate_list','timetable','venue','invigilation',
      'paper_material','practical','cbt_device','power',
      'security','access','accommodation','communication',
      'external_registration','other'
    )),
  title text not null,
  description text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  due_date date not null,
  mandatory boolean not null default true,
  status text not null default 'pending'
    check (status in (
      'pending','in_progress','evidence_submitted',
      'verified','exception_accepted'
    )),
  completion_note text,
  evidence_reference text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  exception_reason text,
  exception_reference text,
  exception_accepted_by uuid references auth.users(id) on delete set null,
  exception_accepted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id,item_code)
);

create index if not exists idx_khpos_ops_exam_readiness_cycle
  on public.khpos_ops_exam_readiness_items(cycle_id,status,due_date);
create index if not exists idx_khpos_ops_exam_readiness_owner
  on public.khpos_ops_exam_readiness_items(owner_assignment_id,status,due_date);
create index if not exists idx_khpos_ops_exam_readiness_stream
  on public.khpos_ops_exam_readiness_items(stream_id,status)
  where stream_id is not null;

create table if not exists public.khpos_ops_academic_integrity_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  cycle_id uuid references public.khpos_ops_assessment_cycles(id) on delete set null,
  stream_id uuid references public.khpos_ops_academic_delivery_streams(id) on delete set null,
  learner_id uuid references public.khpos_ops_learner_anchors(id) on delete set null,
  subject_staff_id uuid references public.khpos_ops_staff(id) on delete set null,
  case_reference text not null,
  subject_type text not null
    check (subject_type in ('learner','staff','process','system')),
  incident_type text not null
    check (incident_type in (
      'cheating','plagiarism','collusion','unauthorised_aid',
      'impersonation','paper_leakage','mark_tampering',
      'result_manipulation','administrative_irregularity','other'
    )),
  severity text not null
    check (severity in ('standard','high','critical')),
  incident_summary text not null,
  source_reference text,
  representation_note text,
  representation_reference text,
  representation_recorded_by uuid references auth.users(id) on delete set null,
  representation_recorded_at timestamptz,
  reported_by uuid not null references auth.users(id) on delete restrict,
  reported_at timestamptz not null default now(),
  status text not null default 'open'
    check (status in (
      'open','under_review','decision_recorded',
      'referred','closed'
    )),
  outcome text
    check (outcome is null or outcome in (
      'no_breach','substantiated','inconclusive','referred_other_process'
    )),
  academic_action text
    check (academic_action is null or academic_action in (
      'no_change','hold_result_pending_process','invalidate_component',
      'reassessment_required','correction_required','release_result','other'
    )),
  decision_note text,
  related_process_reference text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,case_reference),
  check (
    (subject_type='learner' and learner_id is not null and subject_staff_id is null)
    or (subject_type='staff' and subject_staff_id is not null and learner_id is null)
    or (subject_type in ('process','system') and learner_id is null and subject_staff_id is null)
  )
);

create index if not exists idx_khpos_ops_integrity_cases_term
  on public.khpos_ops_academic_integrity_cases(term_id,status,severity);
create index if not exists idx_khpos_ops_integrity_cases_cycle
  on public.khpos_ops_academic_integrity_cases(cycle_id,status,severity)
  where cycle_id is not null;
create index if not exists idx_khpos_ops_integrity_cases_learner
  on public.khpos_ops_academic_integrity_cases(learner_id,reported_at desc)
  where learner_id is not null;
create index if not exists idx_khpos_ops_integrity_cases_staff
  on public.khpos_ops_academic_integrity_cases(subject_staff_id,reported_at desc)
  where subject_staff_id is not null;

create table if not exists public.khpos_ops_academic_integrity_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_academic_integrity_cases(id) on delete cascade,
  evidence_type text not null
    check (evidence_type in (
      'document','system_record','observation','witness_note',
      'communication','external_reference','other'
    )),
  title text not null,
  note text not null,
  evidence_reference text,
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_integrity_evidence_case
  on public.khpos_ops_academic_integrity_evidence(case_id,created_at desc);

create table if not exists public.khpos_ops_result_corrections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  cycle_id uuid not null references public.khpos_ops_assessment_cycles(id) on delete cascade,
  stream_id uuid not null references public.khpos_ops_academic_delivery_streams(id) on delete cascade,
  learner_id uuid references public.khpos_ops_learner_anchors(id) on delete set null,
  integrity_case_id uuid references public.khpos_ops_academic_integrity_cases(id) on delete set null,
  correction_reference text not null,
  external_result_reference text not null,
  correction_type text not null
    check (correction_type in (
      'clerical','transcription','moderation_calculation',
      'identity_mapping','integrity_outcome','other'
    )),
  request_note text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  status text not null default 'requested'
    check (status in (
      'requested','approved','rejected','implemented',
      'verified','cancelled'
    )),
  reviewed_by uuid references auth.users(id) on delete set null,
  decision_note text,
  reviewed_at timestamptz,
  implementation_reference text,
  implementation_note text,
  implemented_by uuid references auth.users(id) on delete set null,
  implemented_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,correction_reference)
);

create index if not exists idx_khpos_ops_result_corrections_cycle
  on public.khpos_ops_result_corrections(cycle_id,status);
create index if not exists idx_khpos_ops_result_corrections_stream
  on public.khpos_ops_result_corrections(stream_id,status);
create index if not exists idx_khpos_ops_result_corrections_learner
  on public.khpos_ops_result_corrections(learner_id,requested_at desc)
  where learner_id is not null;
create index if not exists idx_khpos_ops_result_corrections_integrity
  on public.khpos_ops_result_corrections(integrity_case_id)
  where integrity_case_id is not null;

create table if not exists public.khpos_ops_academic_closeouts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  closeout_reference text not null,
  curriculum_summary text not null,
  assessment_summary text not null,
  learner_support_summary text not null,
  integrity_summary text not null,
  external_exam_summary text,
  lessons_summary text not null,
  carryover_reference text,
  evidence_reference text,
  status text not null default 'draft'
    check (status in ('draft','in_review','approved','closed','cancelled')),
  prepared_by uuid not null references auth.users(id) on delete restrict,
  prepared_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  approval_note text,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id),
  unique (organisation_id,closeout_reference)
);

create index if not exists idx_khpos_ops_academic_closeouts_org
  on public.khpos_ops_academic_closeouts(organisation_id,status,prepared_at desc);

create table if not exists public.khpos_ops_academic_assurance_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid references public.khpos_ops_academic_terms(id) on delete cascade,
  cycle_id uuid references public.khpos_ops_assessment_cycles(id) on delete cascade,
  package_id uuid references public.khpos_ops_assessment_packages(id) on delete cascade,
  readiness_item_id uuid references public.khpos_ops_exam_readiness_items(id) on delete cascade,
  integrity_case_id uuid references public.khpos_ops_academic_integrity_cases(id) on delete cascade,
  correction_id uuid references public.khpos_ops_result_corrections(id) on delete cascade,
  closeout_id uuid references public.khpos_ops_academic_closeouts(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_state text,
  to_state text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    num_nonnulls(
      term_id,cycle_id,package_id,readiness_item_id,
      integrity_case_id,correction_id,closeout_id
    )>=1
  )
);

create index if not exists idx_khpos_ops_assurance_events_term
  on public.khpos_ops_academic_assurance_events(term_id,created_at desc)
  where term_id is not null;
create index if not exists idx_khpos_ops_assurance_events_cycle
  on public.khpos_ops_academic_assurance_events(cycle_id,created_at desc)
  where cycle_id is not null;
create index if not exists idx_khpos_ops_assurance_events_integrity
  on public.khpos_ops_academic_assurance_events(integrity_case_id,created_at desc)
  where integrity_case_id is not null;

alter table public.khpos_ops_assessment_cycles enable row level security;
alter table public.khpos_ops_assessment_packages enable row level security;
alter table public.khpos_ops_exam_readiness_items enable row level security;
alter table public.khpos_ops_academic_integrity_cases enable row level security;
alter table public.khpos_ops_academic_integrity_evidence enable row level security;
alter table public.khpos_ops_result_corrections enable row level security;
alter table public.khpos_ops_academic_closeouts enable row level security;
alter table public.khpos_ops_academic_assurance_events enable row level security;

revoke all privileges on table public.khpos_ops_assessment_cycles from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_assessment_packages from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_exam_readiness_items from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_academic_integrity_cases from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_academic_integrity_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_result_corrections from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_academic_closeouts from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_academic_assurance_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_assessment_cycles to service_role;
grant select,insert,update,delete on table public.khpos_ops_assessment_packages to service_role;
grant select,insert,update,delete on table public.khpos_ops_exam_readiness_items to service_role;
grant select,insert,update,delete on table public.khpos_ops_academic_integrity_cases to service_role;
grant select,insert,update,delete on table public.khpos_ops_academic_integrity_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_result_corrections to service_role;
grant select,insert,update,delete on table public.khpos_ops_academic_closeouts to service_role;
grant select,insert,update,delete on table public.khpos_ops_academic_assurance_events to service_role;

create or replace function khpos_private.ops_assurance_actor_has_role(
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

create or replace function khpos_private.ops_assurance_can_manage(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select khpos_private.ops_assurance_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR']
  );
$$;

create or replace function khpos_private.ops_assurance_can_coordinate(
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
    khpos_private.ops_assurance_can_manage(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_assurance_actor_has_role(
      p_actor_user_id,p_organisation_id,array['SECTIONAL_PROMOTER']
    );
$$;

create or replace function khpos_private.ops_assurance_is_school_guardian(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select khpos_private.ops_assurance_actor_has_role(
    p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN']
  );
$$;

create or replace function khpos_private.ops_assurance_cycle_visible(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_cycle_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_assessment_cycles c
    where c.id=p_cycle_id
      and c.organisation_id=p_organisation_id
      and (
        khpos_private.ops_assurance_can_coordinate(
          p_actor_user_id,p_organisation_id
        )
        or exists(
          select 1
          from public.khpos_ops_academic_delivery_streams s
          join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
          where s.term_id=c.term_id
            and (c.campus_id is null or s.campus_id=c.campus_id)
            and a.user_id=p_actor_user_id
            and a.status='active'
        )
      )
  );
$$;

create or replace function khpos_private.ops_assurance_stream_teacher(
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
      and a.user_id=p_actor_user_id
      and a.status='active'
  );
$$;

create or replace function khpos_private.ops_assurance_case_visible(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_academic_integrity_cases c
    where c.id=p_case_id
      and c.organisation_id=p_organisation_id
      and (
        khpos_private.ops_assurance_can_coordinate(
          p_actor_user_id,p_organisation_id
        )
        or c.reported_by=p_actor_user_id
        or (
          c.stream_id is not null
          and khpos_private.ops_assurance_stream_teacher(
            p_actor_user_id,p_organisation_id,c.stream_id
          )
        )
      )
  );
$$;

create or replace function public.khpos_ops_get_academic_assurance_server(
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
  v_can_manage boolean;
  v_can_coordinate boolean;
  v_has_operating_role boolean;
  v_terms jsonb := '[]'::jsonb;
  v_cycles jsonb := '[]'::jsonb;
  v_streams jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
  v_staff jsonb := '[]'::jsonb;
  v_integrity jsonb := '[]'::jsonb;
  v_corrections jsonb := '[]'::jsonb;
  v_closeouts jsonb := '[]'::jsonb;
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

  v_can_manage := khpos_private.ops_assurance_can_manage(
    p_actor_user_id,p_organisation_id
  );
  v_can_coordinate := khpos_private.ops_assurance_can_coordinate(
    p_actor_user_id,p_organisation_id
  );
  v_has_operating_role := v_can_coordinate or exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code='TEACHER'
  );

  if v_has_operating_role then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',t.id,'campusId',t.campus_id,'sessionLabel',t.session_label,
      'termCode',t.term_code,'termName',t.term_name,
      'startDate',t.start_date,'endDate',t.end_date,'status',t.status
    ) order by t.start_date desc),'[]'::jsonb)
    into v_terms
    from public.khpos_ops_academic_terms t
    where t.organisation_id=p_organisation_id
      and t.status in ('draft','active','closed');

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'termId',s.term_id,'campusId',s.campus_id,
      'classLabel',s.class_label,'sectionLabel',s.section_label,
      'subjectLabel',s.subject_label,'subjectCode',s.subject_code,
      'teacherAssignmentId',s.teacher_assignment_id,
      'teacherUserId',a.user_id,'status',s.status,
      'isTeacher',a.user_id=p_actor_user_id
    ) order by s.class_label,s.subject_label),'[]'::jsonb)
    into v_streams
    from public.khpos_ops_academic_delivery_streams s
    join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
    where s.organisation_id=p_organisation_id
      and s.status in ('approved','active','closed')
      and (
        v_can_coordinate
        or a.user_id=p_actor_user_id
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'userId',a.user_id,'roleCode',r.code,'roleTitle',r.title,
      'campusId',a.campus_id,'unitId',a.unit_id,
      'displayName',coalesce(st.display_name,au.email)
    ) order by r.role_level,coalesce(st.display_name,au.email)),'[]'::jsonb)
    into v_assignments
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    left join public.khpos_ops_staff st
      on st.organisation_id=p_organisation_id and st.role_assignment_id=a.id
    left join auth.users au on au.id=a.user_id
    where a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (
        v_can_coordinate
        or a.user_id=p_actor_user_id
      );

    if v_can_coordinate then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',l.id,'displayName',l.display_name,'campusId',l.campus_id,
        'classLabel',l.class_label,'sectionLabel',l.section_label
      ) order by l.display_name),'[]'::jsonb)
      into v_learners
      from public.khpos_ops_learner_anchors l
      where l.organisation_id=p_organisation_id and l.status='active';

      select coalesce(jsonb_agg(jsonb_build_object(
        'id',s.id,'displayName',s.display_name,
        'roleCode',r.code,'roleTitle',r.title
      ) order by s.display_name),'[]'::jsonb)
      into v_staff
      from public.khpos_ops_staff s
      join public.khpos_ops_roles r on r.id=s.desired_role_id
      where s.organisation_id=p_organisation_id
        and s.status in ('active','exiting');
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',c.id,'termId',c.term_id,'campusId',c.campus_id,
      'reference',c.cycle_reference,'title',c.title,
      'cycleType',c.cycle_type,'examBodyLabel',c.exam_body_label,
      'startsOn',c.starts_on,'endsOn',c.ends_on,
      'resultsDueOn',c.results_due_on,'externalSystem',c.external_system,
      'externalReference',c.external_reference,'status',c.status,
      'canManage',v_can_manage,
      'packages',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',p.id,'streamId',p.stream_id,'reference',p.package_reference,
          'assessmentSource',p.assessment_source,
          'sourceReference',p.source_reference,
          'blueprintReference',p.blueprint_reference,
          'integrityDeclaration',p.integrity_declaration,
          'moderationState',p.moderation_state,
          'submittedBy',p.submitted_by,'submittedAt',p.submitted_at,
          'moderatorUserId',p.moderator_user_id,
          'moderationNote',p.moderation_note,
          'moderatedAt',p.moderated_at,'approvedAt',p.approved_at,
          'isSubmitter',p.submitted_by=p_actor_user_id,
          'canModerate',v_can_manage and p.submitted_by is distinct from p_actor_user_id
        ) order by p.created_at)
        from public.khpos_ops_assessment_packages p
        join public.khpos_ops_academic_delivery_streams s on s.id=p.stream_id
        join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
        where p.cycle_id=c.id
          and (
            v_can_coordinate
            or a.user_id=p_actor_user_id
          )
      ),'[]'::jsonb),
      'readinessItems',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',ri.id,'streamId',ri.stream_id,'itemCode',ri.item_code,
          'category',ri.category,'title',ri.title,
          'description',ri.description,'ownerAssignmentId',ri.owner_assignment_id,
          'dueDate',ri.due_date,'mandatory',ri.mandatory,'status',ri.status,
          'completionNote',ri.completion_note,
          'evidenceReference',ri.evidence_reference,
          'exceptionReason',ri.exception_reason,
          'exceptionReference',ri.exception_reference,
          'isOwner',oa.user_id=p_actor_user_id,
          'canVerify',v_can_manage and oa.user_id is distinct from p_actor_user_id
        ) order by ri.due_date,ri.created_at)
        from public.khpos_ops_exam_readiness_items ri
        join public.khpos_ops_role_assignments oa on oa.id=ri.owner_assignment_id
        where ri.cycle_id=c.id
          and (
            v_can_coordinate
            or oa.user_id=p_actor_user_id
            or (
              ri.stream_id is not null
              and khpos_private.ops_assurance_stream_teacher(
                p_actor_user_id,p_organisation_id,ri.stream_id
              )
            )
          )
      ),'[]'::jsonb)
    ) order by c.starts_on desc,c.created_at desc),'[]'::jsonb)
    into v_cycles
    from public.khpos_ops_assessment_cycles c
    where c.organisation_id=p_organisation_id
      and khpos_private.ops_assurance_cycle_visible(
        p_actor_user_id,p_organisation_id,c.id
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',ic.id,'termId',ic.term_id,'cycleId',ic.cycle_id,
      'streamId',ic.stream_id,'learnerId',ic.learner_id,
      'learnerName',l.display_name,'subjectStaffId',ic.subject_staff_id,
      'subjectStaffName',st.display_name,'reference',ic.case_reference,
      'subjectType',ic.subject_type,'incidentType',ic.incident_type,
      'severity',ic.severity,'incidentSummary',ic.incident_summary,
      'sourceReference',ic.source_reference,
      'representationNote',ic.representation_note,
      'representationReference',ic.representation_reference,
      'representationRecordedAt',ic.representation_recorded_at,
      'reportedBy',ic.reported_by,
      'reportedAt',ic.reported_at,'status',ic.status,
      'outcome',ic.outcome,'academicAction',ic.academic_action,
      'decisionNote',ic.decision_note,
      'relatedProcessReference',ic.related_process_reference,
      'decidedAt',ic.decided_at,
      'isReporter',ic.reported_by=p_actor_user_id,
      'canDecide',v_can_manage and ic.reported_by is distinct from p_actor_user_id,
      'evidence',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',e.id,'evidenceType',e.evidence_type,'title',e.title,
          'note',e.note,'evidenceReference',e.evidence_reference,
          'createdAt',e.created_at
        ) order by e.created_at desc)
        from public.khpos_ops_academic_integrity_evidence e
        where e.case_id=ic.id
      ),'[]'::jsonb)
    ) order by ic.reported_at desc),'[]'::jsonb)
    into v_integrity
    from public.khpos_ops_academic_integrity_cases ic
    left join public.khpos_ops_learner_anchors l on l.id=ic.learner_id
    left join public.khpos_ops_staff st on st.id=ic.subject_staff_id
    where ic.organisation_id=p_organisation_id
      and khpos_private.ops_assurance_case_visible(
        p_actor_user_id,p_organisation_id,ic.id
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',rc.id,'termId',rc.term_id,'cycleId',rc.cycle_id,
      'streamId',rc.stream_id,'learnerId',rc.learner_id,
      'reference',rc.correction_reference,
      'externalResultReference',rc.external_result_reference,
      'correctionType',rc.correction_type,'requestNote',rc.request_note,
      'requestedBy',rc.requested_by,'requestedAt',rc.requested_at,
      'status',rc.status,'decisionNote',rc.decision_note,
      'implementationReference',rc.implementation_reference,
      'implementationNote',rc.implementation_note,
      'implementedBy',rc.implemented_by,'implementedAt',rc.implemented_at,
      'verifiedAt',rc.verified_at,
      'isRequester',rc.requested_by=p_actor_user_id,
      'canReview',v_can_manage and rc.requested_by is distinct from p_actor_user_id,
      'canVerify',v_can_manage
        and rc.implemented_by is not null
        and rc.implemented_by is distinct from p_actor_user_id
        and rc.requested_by is distinct from p_actor_user_id
    ) order by rc.requested_at desc),'[]'::jsonb)
    into v_corrections
    from public.khpos_ops_result_corrections rc
    join public.khpos_ops_academic_delivery_streams s on s.id=rc.stream_id
    join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
    where rc.organisation_id=p_organisation_id
      and (
        v_can_coordinate
        or a.user_id=p_actor_user_id
        or rc.requested_by=p_actor_user_id
      );

    if v_can_coordinate then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',cl.id,'termId',cl.term_id,'reference',cl.closeout_reference,
        'curriculumSummary',cl.curriculum_summary,
        'assessmentSummary',cl.assessment_summary,
        'learnerSupportSummary',cl.learner_support_summary,
        'integritySummary',cl.integrity_summary,
        'externalExamSummary',cl.external_exam_summary,
        'lessonsSummary',cl.lessons_summary,
        'carryoverReference',cl.carryover_reference,
        'evidenceReference',cl.evidence_reference,'status',cl.status,
        'preparedBy',cl.prepared_by,'preparedAt',cl.prepared_at,
        'submittedAt',cl.submitted_at,'approvedBy',cl.approved_by,
        'approvedAt',cl.approved_at,'approvalNote',cl.approval_note,
        'canApprove',khpos_private.ops_assurance_is_school_guardian(
          p_actor_user_id,p_organisation_id
        ) and cl.prepared_by is distinct from p_actor_user_id
      ) order by cl.prepared_at desc),'[]'::jsonb)
      into v_closeouts
      from public.khpos_ops_academic_closeouts cl
      where cl.organisation_id=p_organisation_id;
    end if;
  end if;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canManage',v_can_manage,
    'canCoordinate',v_can_coordinate,
    'executiveSummaryOnly',v_member_role='executive' and not v_has_operating_role,
    'principle','Assessment evidence must be valid, moderated and traceable; examinations must be operationally ready; integrity concerns and result corrections must never be hidden or silently edited.',
    'technologyBoundary','SIS/CBT remains the authoritative marks/results engine. KSI may generate assessment intelligence. KHP-OS stores references, approvals, readiness, integrity cases, result-correction audit and academic close-out controls, not duplicate scorebooks.',
    'terms',v_terms,
    'streams',v_streams,
    'assignments',v_assignments,
    'learners',v_learners,
    'staff',v_staff,
    'cycles',v_cycles,
    'integrityCases',v_integrity,
    'resultCorrections',v_corrections,
    'closeouts',v_closeouts,
    'summary',jsonb_build_object(
      'activeCycles',(
        select count(*) from public.khpos_ops_assessment_cycles c
        where c.organisation_id=p_organisation_id
          and c.status in ('planned','ready','in_progress','results_pending')
      ),
      'packagesAwaitingModeration',(
        select count(*) from public.khpos_ops_assessment_packages p
        where p.organisation_id=p_organisation_id
          and p.moderation_state='submitted'
      ),
      'unresolvedReadiness',(
        select count(*) from public.khpos_ops_exam_readiness_items ri
        where ri.organisation_id=p_organisation_id
          and ri.mandatory
          and ri.status not in ('verified','exception_accepted')
      ),
      'openIntegrityCases',(
        select count(*) from public.khpos_ops_academic_integrity_cases ic
        where ic.organisation_id=p_organisation_id
          and ic.status not in ('closed')
      ),
      'openResultCorrections',(
        select count(*) from public.khpos_ops_result_corrections rc
        where rc.organisation_id=p_organisation_id
          and rc.status not in ('verified','rejected','cancelled')
      ),
      'closeoutsAwaitingApproval',(
        select count(*) from public.khpos_ops_academic_closeouts cl
        where cl.organisation_id=p_organisation_id
          and cl.status='in_review'
      )
    )
  );
end;
$$;

create or replace function public.khpos_ops_create_assessment_cycle_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_campus_id uuid,
  p_title text,
  p_cycle_type text,
  p_exam_body_label text,
  p_starts_on date,
  p_ends_on date,
  p_results_due_on date,
  p_external_system text,
  p_external_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_term public.khpos_ops_academic_terms%rowtype;
  v_id uuid;
  v_ref text;
begin
  if not khpos_private.ops_assurance_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only Academic Inspector or School Guardian can create assessment cycles.';
  end if;

  select * into v_term
  from public.khpos_ops_academic_terms
  where id=p_term_id
    and organisation_id=p_organisation_id
    and status in ('draft','active');

  if v_term.id is null then
    raise exception 'Assessment cycle requires a draft or active academic term.';
  end if;

  if p_cycle_type not in (
    'continuous_assessment','midterm','terminal','mock',
    'external_exam','practical','other'
  ) then
    raise exception 'Unsupported assessment cycle type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or p_starts_on is null or p_ends_on is null
     or p_ends_on<p_starts_on then
    raise exception 'Assessment title and valid start/end dates are required.';
  end if;

  if p_results_due_on is not null and p_results_due_on<p_ends_on then
    raise exception 'Results due date cannot precede the assessment end date.';
  end if;

  if p_campus_id is not null
     and not exists(
       select 1 from public.khpos_ops_campuses c
       where c.id=p_campus_id
         and c.organisation_id=p_organisation_id
         and c.status='active'
     ) then
    raise exception 'Assessment-cycle campus must be active.';
  end if;

  if v_term.campus_id is not null
     and p_campus_id is distinct from v_term.campus_id then
    raise exception 'Assessment-cycle campus must match the term campus.';
  end if;

  v_ref := 'ASM-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_assessment_cycles(
    organisation_id,term_id,campus_id,cycle_reference,title,cycle_type,
    exam_body_label,starts_on,ends_on,results_due_on,
    external_system,external_reference,status,created_by
  ) values (
    p_organisation_id,p_term_id,p_campus_id,v_ref,left(btrim(p_title),240),
    p_cycle_type,left(nullif(btrim(coalesce(p_exam_body_label,'')),''),160),
    p_starts_on,p_ends_on,p_results_due_on,
    left(nullif(btrim(coalesce(p_external_system,'')),''),120),
    left(nullif(btrim(coalesce(p_external_reference,'')),''),1000),
    'draft',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,p_term_id,v_id,p_actor_user_id,
    'assessment_cycle_created','draft',left(btrim(p_title),240)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_assessment_cycle_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_cycle_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_cycle public.khpos_ops_assessment_cycles%rowtype;
  v_to text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_cycle
  from public.khpos_ops_assessment_cycles
  where id=p_cycle_id and organisation_id=p_organisation_id
  for update;

  if v_cycle.id is null then raise exception 'Assessment cycle not found.'; end if;

  if not khpos_private.ops_assurance_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only Academic Inspector or School Guardian can change assessment-cycle status.';
  end if;

  if p_action='approve_plan' then
    if v_cycle.status<>'draft' then
      raise exception 'Only a draft assessment cycle can be approved.';
    end if;
    v_to := 'planned';
    update public.khpos_ops_assessment_cycles
    set status=v_to,approved_by=p_actor_user_id,approved_at=now(),updated_at=now()
    where id=v_cycle.id;

  elsif p_action='mark_ready' then
    if v_cycle.status<>'planned' then
      raise exception 'Only a planned assessment cycle can be marked ready.';
    end if;

    if not exists(
      select 1
      from public.khpos_ops_exam_readiness_items ri
      where ri.cycle_id=v_cycle.id
        and ri.mandatory
    ) then
      raise exception 'Assessment cycle cannot be marked ready without at least one mandatory readiness control.';
    end if;

    if exists(
      select 1
      from public.khpos_ops_exam_readiness_items ri
      where ri.cycle_id=v_cycle.id
        and ri.mandatory
        and ri.status not in ('verified','exception_accepted')
    ) then
      raise exception 'Resolve every mandatory examination-readiness control before marking the cycle ready.';
    end if;

    if v_cycle.cycle_type='external_exam'
       and not exists(
         select 1
         from public.khpos_ops_exam_readiness_items ri
         where ri.cycle_id=v_cycle.id
           and ri.category='external_registration'
           and ri.mandatory
           and ri.status in ('verified','exception_accepted')
       ) then
      raise exception 'External examination readiness requires a resolved mandatory external-registration control.';
    end if;

    if v_cycle.cycle_type<>'external_exam'
       and exists(
         select 1
         from public.khpos_ops_assessment_packages p
         where p.cycle_id=v_cycle.id
           and p.moderation_state not in ('approved','withdrawn')
       ) then
      raise exception 'Resolve every created assessment package through approval or withdrawal before marking the cycle ready.';
    end if;

    if v_cycle.cycle_type<>'external_exam'
       and not exists(
         select 1
         from public.khpos_ops_assessment_packages p
         where p.cycle_id=v_cycle.id
           and p.moderation_state='approved'
       ) then
      raise exception 'Approve at least one moderated assessment package before marking an internal cycle ready.';
    end if;

    v_to := 'ready';
    update public.khpos_ops_assessment_cycles
    set status=v_to,updated_at=now()
    where id=v_cycle.id;

  elsif p_action='start' then
    if v_cycle.status<>'ready' then
      raise exception 'Only a ready assessment cycle can start.';
    end if;
    if current_date<v_cycle.starts_on then
      raise exception 'Assessment cycle cannot start before its approved start date.';
    end if;
    v_to := 'in_progress';
    update public.khpos_ops_assessment_cycles
    set status=v_to,started_by=p_actor_user_id,started_at=now(),updated_at=now()
    where id=v_cycle.id;

  elsif p_action='results_pending' then
    if v_cycle.status<>'in_progress' then
      raise exception 'Only an in-progress assessment cycle can move to results pending.';
    end if;
    if current_date<v_cycle.ends_on then
      raise exception 'Assessment cycle cannot move to results pending before its approved end date.';
    end if;
    v_to := 'results_pending';
    update public.khpos_ops_assessment_cycles
    set status=v_to,updated_at=now()
    where id=v_cycle.id;

  elsif p_action='close' then
    if v_cycle.status<>'results_pending' then
      raise exception 'Only a results-pending assessment cycle can close.';
    end if;

    if exists(
      select 1
      from public.khpos_ops_academic_integrity_cases ic
      where ic.cycle_id=v_cycle.id
        and ic.status not in ('closed')
        and ic.severity in ('high','critical')
    ) then
      raise exception 'Resolve or govern every high/critical integrity case before closing the assessment cycle.';
    end if;

    if exists(
      select 1
      from public.khpos_ops_result_corrections rc
      where rc.cycle_id=v_cycle.id
        and rc.status not in ('verified','rejected','cancelled')
    ) then
      raise exception 'Resolve every result-correction workflow before closing the assessment cycle.';
    end if;

    if exists(
      select 1
      from public.khpos_ops_exam_readiness_items ri
      where ri.cycle_id=v_cycle.id
        and ri.mandatory
        and ri.status not in ('verified','exception_accepted')
    ) then
      raise exception 'Assessment cycle cannot close with unresolved mandatory readiness controls.';
    end if;

    v_to := 'closed';
    update public.khpos_ops_assessment_cycles
    set status=v_to,closed_by=p_actor_user_id,closed_at=now(),updated_at=now()
    where id=v_cycle.id;

  elsif p_action='cancel' then
    if v_cycle.status not in ('draft','planned','ready') then
      raise exception 'Only a pre-start assessment cycle can be cancelled here.';
    end if;
    if v_note is null then
      raise exception 'Assessment-cycle cancellation reason is required.';
    end if;
    v_to := 'cancelled';
    update public.khpos_ops_assessment_cycles
    set status=v_to,updated_at=now()
    where id=v_cycle.id;

  else
    raise exception 'Unsupported assessment-cycle action.';
  end if;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,actor_user_id,event_type,
    from_state,to_state,note
  ) values (
    p_organisation_id,v_cycle.term_id,v_cycle.id,p_actor_user_id,
    'assessment_cycle_'||p_action,v_cycle.status,v_to,left(v_note,4000)
  );
end;
$$;

create or replace function public.khpos_ops_create_assessment_package_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_cycle_id uuid,
  p_stream_id uuid,
  p_assessment_source text,
  p_source_reference text,
  p_blueprint_reference text,
  p_integrity_declaration boolean
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_cycle public.khpos_ops_assessment_cycles%rowtype;
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_id uuid;
  v_ref text;
begin
  select * into v_cycle
  from public.khpos_ops_assessment_cycles
  where id=p_cycle_id
    and organisation_id=p_organisation_id
    and status in ('draft','planned');

  if v_cycle.id is null then
    raise exception 'Assessment package requires a draft or planned assessment cycle.';
  end if;

  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=p_stream_id
    and organisation_id=p_organisation_id
    and status in ('approved','active');

  if v_stream.id is null or v_stream.term_id<>v_cycle.term_id then
    raise exception 'Assessment package stream must be active/approved in the same academic term.';
  end if;

  if not (
    khpos_private.ops_assurance_can_manage(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_assurance_stream_teacher(
      p_actor_user_id,p_organisation_id,p_stream_id
    )
  ) then
    raise exception 'Only the assigned teacher or academic assurance authority can create this assessment package.';
  end if;

  if p_assessment_source not in ('KSI','SIS','CBT','external','manual') then
    raise exception 'Assessment source must be KSI, SIS, CBT, external or manual.';
  end if;

  if nullif(btrim(coalesce(p_source_reference,'')),'') is null
     or nullif(btrim(coalesce(p_blueprint_reference,'')),'') is null then
    raise exception 'Assessment source reference and blueprint/specification reference are required.';
  end if;

  v_ref := 'PKG-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_assessment_packages(
    organisation_id,cycle_id,stream_id,package_reference,
    assessment_source,source_reference,blueprint_reference,
    integrity_declaration,moderation_state,created_by
  ) values (
    p_organisation_id,p_cycle_id,p_stream_id,v_ref,p_assessment_source,
    left(btrim(p_source_reference),1000),
    left(btrim(p_blueprint_reference),1000),
    coalesce(p_integrity_declaration,false),'draft',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,package_id,
    actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,v_cycle.term_id,p_cycle_id,v_id,
    p_actor_user_id,'assessment_package_created','draft',v_ref
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_assessment_package_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_package_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_package public.khpos_ops_assessment_packages%rowtype;
  v_cycle public.khpos_ops_assessment_cycles%rowtype;
  v_is_teacher boolean;
  v_to text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_package
  from public.khpos_ops_assessment_packages
  where id=p_package_id and organisation_id=p_organisation_id
  for update;

  if v_package.id is null then raise exception 'Assessment package not found.'; end if;

  select * into v_cycle
  from public.khpos_ops_assessment_cycles
  where id=v_package.cycle_id;

  v_is_teacher := khpos_private.ops_assurance_stream_teacher(
    p_actor_user_id,p_organisation_id,v_package.stream_id
  );

  if p_action='submit' then
    if not (v_is_teacher or khpos_private.ops_assurance_can_manage(
      p_actor_user_id,p_organisation_id
    )) then
      raise exception 'Only the assigned teacher or academic assurance authority can submit this package.';
    end if;
    if v_package.moderation_state not in ('draft','changes_required') then
      raise exception 'Only draft or changes-required packages can be submitted.';
    end if;
    if not v_package.integrity_declaration then
      raise exception 'Assessment package cannot be submitted without the integrity declaration.';
    end if;
    v_to := 'submitted';
    update public.khpos_ops_assessment_packages
    set moderation_state=v_to,
        submitted_by=p_actor_user_id,
        submitted_at=now(),
        moderator_user_id=null,
        moderation_note=null,
        moderated_at=null,
        approved_at=null,
        updated_at=now()
    where id=v_package.id;

  elsif p_action in ('approve','request_changes') then
    if not khpos_private.ops_assurance_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only Academic Inspector or School Guardian can moderate assessment packages.';
    end if;
    if v_package.moderation_state<>'submitted' then
      raise exception 'Only a submitted package can be moderated.';
    end if;
    if v_package.submitted_by=p_actor_user_id then
      raise exception 'The package submitter cannot approve or moderate their own assessment package.';
    end if;
    if p_action='request_changes' and v_note is null then
      raise exception 'State the moderation changes required.';
    end if;

    v_to := case when p_action='approve' then 'approved' else 'changes_required' end;
    update public.khpos_ops_assessment_packages
    set moderation_state=v_to,
        moderator_user_id=p_actor_user_id,
        moderation_note=left(v_note,6000),
        moderated_at=now(),
        approved_at=case when p_action='approve' then now() else null end,
        updated_at=now()
    where id=v_package.id;

  elsif p_action='withdraw' then
    if not (v_is_teacher or khpos_private.ops_assurance_can_manage(
      p_actor_user_id,p_organisation_id
    )) then
      raise exception 'You cannot withdraw this assessment package.';
    end if;
    if v_package.moderation_state='approved'
       or v_cycle.status not in ('draft','planned') then
      raise exception 'Approved or live-cycle packages cannot be withdrawn here.';
    end if;
    if v_note is null then raise exception 'Package withdrawal reason is required.'; end if;
    v_to := 'withdrawn';
    update public.khpos_ops_assessment_packages
    set moderation_state=v_to,moderation_note=left(v_note,6000),updated_at=now()
    where id=v_package.id;

  else
    raise exception 'Unsupported assessment-package action.';
  end if;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,package_id,actor_user_id,event_type,
    from_state,to_state,note
  ) values (
    p_organisation_id,v_cycle.term_id,v_cycle.id,v_package.id,p_actor_user_id,
    'assessment_package_'||p_action,v_package.moderation_state,v_to,left(v_note,4000)
  );
end;
$$;

create or replace function public.khpos_ops_create_exam_readiness_item_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_cycle_id uuid,
  p_stream_id uuid,
  p_category text,
  p_title text,
  p_description text,
  p_owner_assignment_id uuid,
  p_due_date date,
  p_mandatory boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_cycle public.khpos_ops_assessment_cycles%rowtype;
  v_id uuid;
  v_code text;
begin
  if not khpos_private.ops_assurance_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only Academic Inspector or School Guardian can create exam-readiness controls.';
  end if;

  select * into v_cycle
  from public.khpos_ops_assessment_cycles
  where id=p_cycle_id
    and organisation_id=p_organisation_id
    and status in ('draft','planned');

  if v_cycle.id is null then
    raise exception 'Exam-readiness control requires a draft or planned assessment cycle.';
  end if;

  if p_category not in (
    'candidate_list','timetable','venue','invigilation',
    'paper_material','practical','cbt_device','power',
    'security','access','accommodation','communication',
    'external_registration','other'
  ) then
    raise exception 'Unsupported exam-readiness category.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_description,'')),'') is null
     or p_due_date is null then
    raise exception 'Readiness title, description and due date are required.';
  end if;

  if p_stream_id is not null
     and not exists(
       select 1
       from public.khpos_ops_academic_delivery_streams s
       where s.id=p_stream_id
         and s.organisation_id=p_organisation_id
         and s.term_id=v_cycle.term_id
     ) then
    raise exception 'Readiness stream must belong to the assessment-cycle term.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.id=p_owner_assignment_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  ) then
    raise exception 'Readiness owner must have an active operating-role assignment.';
  end if;

  v_code := 'RDY-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_exam_readiness_items(
    organisation_id,cycle_id,stream_id,item_code,category,title,description,
    owner_assignment_id,due_date,mandatory,status,created_by
  ) values (
    p_organisation_id,p_cycle_id,p_stream_id,v_code,p_category,
    left(btrim(p_title),240),left(btrim(p_description),6000),
    p_owner_assignment_id,p_due_date,coalesce(p_mandatory,true),'pending',
    p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,readiness_item_id,
    actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,v_cycle.term_id,p_cycle_id,v_id,
    p_actor_user_id,'exam_readiness_created','pending',left(btrim(p_title),240)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_exam_readiness_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_item_id uuid,
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
  v_item public.khpos_ops_exam_readiness_items%rowtype;
  v_cycle public.khpos_ops_assessment_cycles%rowtype;
  v_owner_user uuid;
  v_to text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
begin
  select * into v_item
  from public.khpos_ops_exam_readiness_items
  where id=p_item_id and organisation_id=p_organisation_id
  for update;

  if v_item.id is null then raise exception 'Exam-readiness control not found.'; end if;

  select * into v_cycle from public.khpos_ops_assessment_cycles where id=v_item.cycle_id;
  select user_id into v_owner_user from public.khpos_ops_role_assignments where id=v_item.owner_assignment_id;

  if p_action='start' then
    if v_owner_user<>p_actor_user_id then
      raise exception 'Only the readiness owner can start this control.';
    end if;
    if v_item.status<>'pending' then raise exception 'Only pending readiness work can start.'; end if;
    v_to := 'in_progress';
    update public.khpos_ops_exam_readiness_items
    set status=v_to,updated_at=now()
    where id=v_item.id;

  elsif p_action='submit_evidence' then
    if v_owner_user<>p_actor_user_id then
      raise exception 'Only the readiness owner can submit completion evidence.';
    end if;
    if v_item.status not in ('pending','in_progress') then
      raise exception 'Only pending/in-progress readiness work can submit evidence.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Completion note and evidence reference are required.';
    end if;
    v_to := 'evidence_submitted';
    update public.khpos_ops_exam_readiness_items
    set status=v_to,completion_note=left(v_note,6000),
        evidence_reference=left(v_evidence,1000),
        submitted_by=p_actor_user_id,submitted_at=now(),updated_at=now()
    where id=v_item.id;

  elsif p_action='verify' then
    if not khpos_private.ops_assurance_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only Academic Inspector or School Guardian can verify exam readiness.';
    end if;
    if v_item.status<>'evidence_submitted' then
      raise exception 'Only submitted readiness evidence can be verified.';
    end if;
    if v_owner_user=p_actor_user_id then
      raise exception 'The readiness owner cannot verify their own completion.';
    end if;
    v_to := 'verified';
    update public.khpos_ops_exam_readiness_items
    set status=v_to,verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
    where id=v_item.id;

  elsif p_action='reopen' then
    if not khpos_private.ops_assurance_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only Academic Inspector or School Guardian can reopen readiness work.';
    end if;
    if v_item.status not in ('evidence_submitted','verified','exception_accepted') then
      raise exception 'Only submitted, verified or exception-accepted readiness work can reopen.';
    end if;
    if v_note is null then raise exception 'State why the readiness control is being reopened.'; end if;
    v_to := 'in_progress';
    update public.khpos_ops_exam_readiness_items
    set status=v_to,verified_by=null,verified_at=null,
        exception_reason=null,exception_reference=null,
        exception_accepted_by=null,exception_accepted_at=null,
        updated_at=now()
    where id=v_item.id;

  elsif p_action='accept_exception' then
    if not khpos_private.ops_assurance_is_school_guardian(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian can accept an exam-readiness exception.';
    end if;
    if v_item.status in ('verified','exception_accepted') then
      raise exception 'This readiness control is already resolved.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Exception reason and authority/mitigation reference are required.';
    end if;
    v_to := 'exception_accepted';
    update public.khpos_ops_exam_readiness_items
    set status=v_to,exception_reason=left(v_note,6000),
        exception_reference=left(v_evidence,1000),
        exception_accepted_by=p_actor_user_id,
        exception_accepted_at=now(),updated_at=now()
    where id=v_item.id;

  else
    raise exception 'Unsupported exam-readiness action.';
  end if;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,readiness_item_id,
    actor_user_id,event_type,from_state,to_state,note,metadata
  ) values (
    p_organisation_id,v_cycle.term_id,v_cycle.id,v_item.id,p_actor_user_id,
    'exam_readiness_'||p_action,v_item.status,v_to,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence)
  );
end;
$$;

create or replace function public.khpos_ops_report_integrity_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_cycle_id uuid,
  p_stream_id uuid,
  p_subject_type text,
  p_learner_id uuid,
  p_subject_staff_id uuid,
  p_incident_type text,
  p_severity text,
  p_incident_summary text,
  p_source_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_ref text;
  v_id uuid;
  v_term public.khpos_ops_academic_terms%rowtype;
begin
  if not khpos_private.ops_academic_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership is required.';
  end if;

  select * into v_term
  from public.khpos_ops_academic_terms
  where id=p_term_id and organisation_id=p_organisation_id;

  if v_term.id is null then raise exception 'Academic term not found.'; end if;

  if p_stream_id is not null
     and not (
       khpos_private.ops_assurance_can_coordinate(p_actor_user_id,p_organisation_id)
       or khpos_private.ops_assurance_stream_teacher(
         p_actor_user_id,p_organisation_id,p_stream_id
       )
     ) then
    raise exception 'This academic stream is outside your integrity-reporting scope.';
  end if;

  if p_cycle_id is not null
     and not exists(
       select 1 from public.khpos_ops_assessment_cycles c
       where c.id=p_cycle_id
         and c.organisation_id=p_organisation_id
         and c.term_id=p_term_id
     ) then
    raise exception 'Integrity case assessment cycle must belong to the same term.';
  end if;

  if p_stream_id is not null
     and not exists(
       select 1 from public.khpos_ops_academic_delivery_streams s
       where s.id=p_stream_id
         and s.organisation_id=p_organisation_id
         and s.term_id=p_term_id
     ) then
    raise exception 'Integrity case stream must belong to the same term.';
  end if;

  if p_subject_type not in ('learner','staff','process','system') then
    raise exception 'Unsupported academic-integrity subject type.';
  end if;

  if p_subject_type='learner' then
    if p_learner_id is null or p_subject_staff_id is not null then
      raise exception 'Learner integrity case requires one learner and no staff subject.';
    end if;
    if not exists(
      select 1 from public.khpos_ops_learner_anchors l
      where l.id=p_learner_id
        and l.organisation_id=p_organisation_id
        and l.status='active'
    ) then
      raise exception 'Learner anchor not found.';
    end if;
  elsif p_subject_type='staff' then
    if p_subject_staff_id is null or p_learner_id is not null then
      raise exception 'Staff integrity case requires one staff subject and no learner subject.';
    end if;
    if not exists(
      select 1 from public.khpos_ops_staff s
      where s.id=p_subject_staff_id
        and s.organisation_id=p_organisation_id
        and s.status in ('active','exiting')
    ) then
      raise exception 'Staff subject not found.';
    end if;
  elsif p_learner_id is not null or p_subject_staff_id is not null then
    raise exception 'Process/system integrity cases do not take learner or staff subjects.';
  end if;

  if p_incident_type not in (
    'cheating','plagiarism','collusion','unauthorised_aid',
    'impersonation','paper_leakage','mark_tampering',
    'result_manipulation','administrative_irregularity','other'
  ) then
    raise exception 'Unsupported academic-integrity incident type.';
  end if;

  if p_severity not in ('standard','high','critical') then
    raise exception 'Academic-integrity severity must be standard, high or critical.';
  end if;

  if nullif(btrim(coalesce(p_incident_summary,'')),'') is null then
    raise exception 'Academic-integrity incident summary is required.';
  end if;

  v_ref := 'INT-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_academic_integrity_cases(
    organisation_id,term_id,cycle_id,stream_id,learner_id,subject_staff_id,
    case_reference,subject_type,incident_type,severity,incident_summary,
    source_reference,reported_by,status
  ) values (
    p_organisation_id,p_term_id,p_cycle_id,p_stream_id,p_learner_id,
    p_subject_staff_id,v_ref,p_subject_type,p_incident_type,p_severity,
    left(btrim(p_incident_summary),8000),
    left(nullif(btrim(coalesce(p_source_reference,'')),''),1000),
    p_actor_user_id,'open'
  ) returning id into v_id;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,integrity_case_id,
    actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,p_term_id,p_cycle_id,v_id,p_actor_user_id,
    'integrity_case_reported','open',left(btrim(p_incident_summary),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_record_integrity_representation_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_representation_note text,
  p_representation_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $
declare
  v_case public.khpos_ops_academic_integrity_cases%rowtype;
begin
  select * into v_case
  from public.khpos_ops_academic_integrity_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Academic-integrity case not found.'; end if;

  if v_case.subject_type not in ('learner','staff') then
    raise exception 'Subject representation applies only to learner/staff integrity cases.';
  end if;

  if not khpos_private.ops_assurance_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only authorised academic leadership can record the subject representation.';
  end if;

  if v_case.reported_by=p_actor_user_id then
    raise exception 'The integrity-case reporter cannot be the sole recorder of the subject representation.';
  end if;

  if v_case.status in ('decision_recorded','referred','closed') then
    raise exception 'Subject representation must be recorded before the integrity decision.';
  end if;

  if nullif(btrim(coalesce(p_representation_note,'')),'') is null then
    raise exception 'Record the learner/staff explanation or the documented fact that they declined/unable to respond.';
  end if;

  update public.khpos_ops_academic_integrity_cases
  set representation_note=left(btrim(p_representation_note),8000),
      representation_reference=left(
        nullif(btrim(coalesce(p_representation_reference,'')),''),
        1000
      ),
      representation_recorded_by=p_actor_user_id,
      representation_recorded_at=now(),
      status=case when status='open' then 'under_review' else status end,
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,integrity_case_id,
    actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_case.term_id,v_case.cycle_id,v_case.id,
    p_actor_user_id,'integrity_subject_representation_recorded',
    left(btrim(p_representation_note),4000),
    jsonb_build_object(
      'representationReference',
      nullif(btrim(coalesce(p_representation_reference,'')),'')
    )
  );
end;
$;

create or replace function public.khpos_ops_add_integrity_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_evidence_type text,
  p_title text,
  p_note text,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_academic_integrity_cases%rowtype;
  v_id uuid;
begin
  select * into v_case
  from public.khpos_ops_academic_integrity_cases
  where id=p_case_id and organisation_id=p_organisation_id;

  if v_case.id is null then raise exception 'Academic-integrity case not found.'; end if;

  if not khpos_private.ops_assurance_case_visible(
    p_actor_user_id,p_organisation_id,p_case_id
  ) then
    raise exception 'This integrity case is outside your visibility.';
  end if;

  if v_case.status='closed' then
    raise exception 'Closed integrity cases cannot accept new evidence.';
  end if;

  if p_evidence_type not in (
    'document','system_record','observation','witness_note',
    'communication','external_reference','other'
  ) then
    raise exception 'Unsupported integrity evidence type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'Integrity evidence title and note are required.';
  end if;

  insert into public.khpos_ops_academic_integrity_evidence(
    organisation_id,case_id,evidence_type,title,note,evidence_reference,added_by
  ) values (
    p_organisation_id,p_case_id,p_evidence_type,left(btrim(p_title),240),
    left(btrim(p_note),8000),
    left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000),
    p_actor_user_id
  ) returning id into v_id;

  update public.khpos_ops_academic_integrity_cases
  set status=case when status='open' then 'under_review' else status end,
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,integrity_case_id,
    actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_case.term_id,v_case.cycle_id,v_case.id,
    p_actor_user_id,'integrity_evidence_added',left(btrim(p_title),240),
    jsonb_build_object('evidenceId',v_id,'evidenceType',p_evidence_type)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_decide_integrity_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_outcome text,
  p_academic_action text,
  p_decision_note text,
  p_related_process_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_academic_integrity_cases%rowtype;
  v_related text := nullif(btrim(coalesce(p_related_process_reference,'')),'');
begin
  select * into v_case
  from public.khpos_ops_academic_integrity_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Academic-integrity case not found.'; end if;

  if not khpos_private.ops_assurance_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only Academic Inspector or School Guardian can decide an academic-integrity case.';
  end if;

  if v_case.reported_by=p_actor_user_id then
    raise exception 'The integrity-case reporter cannot decide their own reported case.';
  end if;

  if v_case.severity='critical'
     and not khpos_private.ops_assurance_is_school_guardian(
       p_actor_user_id,p_organisation_id
     ) then
    raise exception 'Critical academic-integrity cases require School Guardian decision authority.';
  end if;

  if v_case.status not in ('open','under_review') then
    raise exception 'Only open or under-review integrity cases can be decided.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_academic_integrity_evidence e
    where e.case_id=v_case.id
  ) then
    raise exception 'Add at least one specific evidence item before deciding the integrity case.';
  end if;

  if v_case.subject_type in ('learner','staff')
     and v_case.representation_recorded_at is null then
    raise exception 'Record the learner/staff representation before deciding the academic-integrity case.';
  end if;

  if p_outcome not in (
    'no_breach','substantiated','inconclusive','referred_other_process'
  ) then
    raise exception 'Unsupported academic-integrity outcome.';
  end if;

  if p_academic_action not in (
    'no_change','hold_result_pending_process','invalidate_component',
    'reassessment_required','correction_required','release_result','other'
  ) then
    raise exception 'Unsupported academic-integrity academic action.';
  end if;

  if nullif(btrim(coalesce(p_decision_note,'')),'') is null then
    raise exception 'Reasoned integrity decision note is required.';
  end if;

  if v_case.subject_type='staff'
     and v_case.severity in ('high','critical')
     and p_outcome='substantiated'
     and v_related is null then
    raise exception 'Substantiated high/critical staff integrity cases require a separate People/O10 or external-process reference.';
  end if;

  update public.khpos_ops_academic_integrity_cases
  set status=case
        when p_outcome='referred_other_process' then 'referred'
        else 'decision_recorded'
      end,
      outcome=p_outcome,
      academic_action=p_academic_action,
      decision_note=left(btrim(p_decision_note),8000),
      related_process_reference=left(v_related,1000),
      decided_by=p_actor_user_id,
      decided_at=now(),
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,integrity_case_id,
    actor_user_id,event_type,from_state,to_state,note,metadata
  ) values (
    p_organisation_id,v_case.term_id,v_case.cycle_id,v_case.id,
    p_actor_user_id,'integrity_case_decided',v_case.status,
    case when p_outcome='referred_other_process' then 'referred' else 'decision_recorded' end,
    left(btrim(p_decision_note),4000),
    jsonb_build_object('outcome',p_outcome,'academicAction',p_academic_action)
  );
end;
$$;

create or replace function public.khpos_ops_integrity_case_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_academic_integrity_cases%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_case
  from public.khpos_ops_academic_integrity_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Academic-integrity case not found.'; end if;

  if p_action='close' then
    if not khpos_private.ops_assurance_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only Academic Inspector or School Guardian can close an integrity case.';
    end if;
    if v_case.status not in ('decision_recorded','referred') then
      raise exception 'Integrity case requires a recorded decision/referral before closure.';
    end if;

    if v_case.academic_action='correction_required'
       and not exists(
         select 1
         from public.khpos_ops_result_corrections rc
         where rc.integrity_case_id=v_case.id
           and rc.status='verified'
       ) then
      raise exception 'Verify the linked result correction before closing this integrity case.';
    end if;

    update public.khpos_ops_academic_integrity_cases
    set status='closed',closed_by=p_actor_user_id,closed_at=now(),updated_at=now()
    where id=v_case.id;

    insert into public.khpos_ops_academic_assurance_events(
      organisation_id,term_id,cycle_id,integrity_case_id,
      actor_user_id,event_type,from_state,to_state,note
    ) values (
      p_organisation_id,v_case.term_id,v_case.cycle_id,v_case.id,
      p_actor_user_id,'integrity_case_closed',v_case.status,'closed',
      left(v_note,4000)
    );
  else
    raise exception 'Unsupported integrity-case action.';
  end if;
end;
$$;

create or replace function public.khpos_ops_request_result_correction_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_cycle_id uuid,
  p_stream_id uuid,
  p_learner_id uuid,
  p_integrity_case_id uuid,
  p_external_result_reference text,
  p_correction_type text,
  p_request_note text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_cycle public.khpos_ops_assessment_cycles%rowtype;
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_id uuid;
  v_ref text;
begin
  select * into v_cycle
  from public.khpos_ops_assessment_cycles
  where id=p_cycle_id and organisation_id=p_organisation_id;

  if v_cycle.id is null then raise exception 'Assessment cycle not found.'; end if;

  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=p_stream_id and organisation_id=p_organisation_id;

  if v_stream.id is null or v_stream.term_id<>v_cycle.term_id then
    raise exception 'Result-correction stream must belong to the assessment-cycle term.';
  end if;

  if not (
    khpos_private.ops_assurance_can_manage(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_assurance_stream_teacher(
      p_actor_user_id,p_organisation_id,p_stream_id
    )
  ) then
    raise exception 'Only the stream teacher or academic assurance authority can request this result correction.';
  end if;

  if p_correction_type not in (
    'clerical','transcription','moderation_calculation',
    'identity_mapping','integrity_outcome','other'
  ) then
    raise exception 'Unsupported result-correction type.';
  end if;

  if nullif(btrim(coalesce(p_external_result_reference,'')),'') is null
     or nullif(btrim(coalesce(p_request_note,'')),'') is null then
    raise exception 'External result reference and correction reason are required.';
  end if;

  if p_learner_id is not null
     and not exists(
       select 1 from public.khpos_ops_learner_anchors l
       where l.id=p_learner_id
         and l.organisation_id=p_organisation_id
         and l.status='active'
     ) then
    raise exception 'Learner anchor not found.';
  end if;

  if p_integrity_case_id is not null
     and not exists(
       select 1
       from public.khpos_ops_academic_integrity_cases ic
       where ic.id=p_integrity_case_id
         and ic.organisation_id=p_organisation_id
         and ic.term_id=v_cycle.term_id
     ) then
    raise exception 'Linked integrity case must belong to the same academic term.';
  end if;

  v_ref := 'COR-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_result_corrections(
    organisation_id,term_id,cycle_id,stream_id,learner_id,integrity_case_id,
    correction_reference,external_result_reference,correction_type,
    request_note,requested_by,status
  ) values (
    p_organisation_id,v_cycle.term_id,p_cycle_id,p_stream_id,p_learner_id,
    p_integrity_case_id,v_ref,left(btrim(p_external_result_reference),1000),
    p_correction_type,left(btrim(p_request_note),8000),
    p_actor_user_id,'requested'
  ) returning id into v_id;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,correction_id,
    actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,v_cycle.term_id,p_cycle_id,v_id,p_actor_user_id,
    'result_correction_requested','requested',left(btrim(p_request_note),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_result_correction_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_correction_id uuid,
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
  v_corr public.khpos_ops_result_corrections%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_reference text := nullif(btrim(coalesce(p_reference,'')),'');
  v_to text;
begin
  select * into v_corr
  from public.khpos_ops_result_corrections
  where id=p_correction_id and organisation_id=p_organisation_id
  for update;

  if v_corr.id is null then raise exception 'Result-correction request not found.'; end if;

  if p_action in ('approve','reject') then
    if not khpos_private.ops_assurance_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only Academic Inspector or School Guardian can approve/reject result corrections.';
    end if;
    if v_corr.status<>'requested' then
      raise exception 'Only requested result corrections can be reviewed.';
    end if;
    if v_corr.requested_by=p_actor_user_id then
      raise exception 'The correction requester cannot approve or reject their own request.';
    end if;
    if v_note is null then raise exception 'Reasoned result-correction decision note is required.'; end if;

    v_to := case when p_action='approve' then 'approved' else 'rejected' end;
    update public.khpos_ops_result_corrections
    set status=v_to,reviewed_by=p_actor_user_id,
        decision_note=left(v_note,8000),reviewed_at=now(),updated_at=now()
    where id=v_corr.id;

  elsif p_action='implement' then
    if v_corr.status<>'approved' then
      raise exception 'Only an approved result correction can be marked implemented.';
    end if;
    if not (
      khpos_private.ops_assurance_can_manage(p_actor_user_id,p_organisation_id)
      or khpos_private.ops_assurance_stream_teacher(
        p_actor_user_id,p_organisation_id,v_corr.stream_id
      )
      or v_corr.requested_by=p_actor_user_id
    ) then
      raise exception 'You are not authorised to record implementation of this result correction.';
    end if;
    if v_note is null or v_reference is null then
      raise exception 'Implementation note and SIS/CBT implementation reference are required.';
    end if;

    v_to := 'implemented';
    update public.khpos_ops_result_corrections
    set status=v_to,implementation_note=left(v_note,8000),
        implementation_reference=left(v_reference,1000),
        implemented_by=p_actor_user_id,implemented_at=now(),updated_at=now()
    where id=v_corr.id;

  elsif p_action='verify' then
    if not khpos_private.ops_assurance_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only Academic Inspector or School Guardian can verify result correction implementation.';
    end if;
    if v_corr.status<>'implemented' then
      raise exception 'Only an implemented result correction can be verified.';
    end if;
    if v_corr.implemented_by=p_actor_user_id
       or v_corr.requested_by=p_actor_user_id
       or v_corr.reviewed_by=p_actor_user_id then
      raise exception 'Result-correction verification must be independent of the requester, approver and implementer.';
    end if;

    v_to := 'verified';
    update public.khpos_ops_result_corrections
    set status=v_to,verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
    where id=v_corr.id;

  elsif p_action='cancel' then
    if v_corr.status not in ('requested','approved') then
      raise exception 'Only requested or approved corrections can be cancelled.';
    end if;
    if not (
      v_corr.requested_by=p_actor_user_id
      or khpos_private.ops_assurance_can_manage(p_actor_user_id,p_organisation_id)
    ) then
      raise exception 'Only the requester or academic assurance authority can cancel this correction.';
    end if;
    if v_note is null then raise exception 'Correction cancellation reason is required.'; end if;

    v_to := 'cancelled';
    update public.khpos_ops_result_corrections
    set status=v_to,cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,8000),updated_at=now()
    where id=v_corr.id;

  else
    raise exception 'Unsupported result-correction action.';
  end if;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,cycle_id,correction_id,
    actor_user_id,event_type,from_state,to_state,note,metadata
  ) values (
    p_organisation_id,v_corr.term_id,v_corr.cycle_id,v_corr.id,
    p_actor_user_id,'result_correction_'||p_action,
    v_corr.status,v_to,left(v_note,4000),
    jsonb_build_object('implementationReference',v_reference)
  );
end;
$$;

create or replace function public.khpos_ops_create_academic_closeout_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_curriculum_summary text,
  p_assessment_summary text,
  p_learner_support_summary text,
  p_integrity_summary text,
  p_external_exam_summary text,
  p_lessons_summary text,
  p_carryover_reference text,
  p_evidence_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
  v_ref text;
begin
  if not khpos_private.ops_assurance_actor_has_role(
    p_actor_user_id,p_organisation_id,array['ACADEMIC_INSPECTOR']
  ) then
    raise exception 'Academic close-out must be prepared by the Academic Inspector.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_academic_terms t
    where t.id=p_term_id
      and t.organisation_id=p_organisation_id
      and t.status='active'
  ) then
    raise exception 'Academic close-out requires an active academic term.';
  end if;

  if nullif(btrim(coalesce(p_curriculum_summary,'')),'') is null
     or nullif(btrim(coalesce(p_assessment_summary,'')),'') is null
     or nullif(btrim(coalesce(p_learner_support_summary,'')),'') is null
     or nullif(btrim(coalesce(p_integrity_summary,'')),'') is null
     or nullif(btrim(coalesce(p_lessons_summary,'')),'') is null then
    raise exception 'Curriculum, assessment, learner-support, integrity and institutional-learning summaries are required.';
  end if;

  v_ref := 'CLO-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_academic_closeouts(
    organisation_id,term_id,closeout_reference,curriculum_summary,
    assessment_summary,learner_support_summary,integrity_summary,
    external_exam_summary,lessons_summary,carryover_reference,
    evidence_reference,status,prepared_by
  ) values (
    p_organisation_id,p_term_id,v_ref,left(btrim(p_curriculum_summary),8000),
    left(btrim(p_assessment_summary),8000),
    left(btrim(p_learner_support_summary),8000),
    left(btrim(p_integrity_summary),8000),
    left(nullif(btrim(coalesce(p_external_exam_summary,'')),''),8000),
    left(btrim(p_lessons_summary),8000),
    left(nullif(btrim(coalesce(p_carryover_reference,'')),''),1000),
    left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000),
    'draft',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,closeout_id,actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,p_term_id,v_id,p_actor_user_id,
    'academic_closeout_created','draft',v_ref
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_academic_closeout_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_closeout_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_closeout public.khpos_ops_academic_closeouts%rowtype;
  v_to text;
  v_open_debt integer;
  v_open_p2 integer;
  v_open_support integer;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_closeout
  from public.khpos_ops_academic_closeouts
  where id=p_closeout_id and organisation_id=p_organisation_id
  for update;

  if v_closeout.id is null then raise exception 'Academic close-out not found.'; end if;

  if p_action='submit' then
    if v_closeout.prepared_by<>p_actor_user_id then
      raise exception 'Only the Academic Inspector who prepared this close-out can submit it.';
    end if;
    if v_closeout.status<>'draft' then raise exception 'Only draft close-out can be submitted.'; end if;

    if not exists(
      select 1
      from public.khpos_ops_assessment_cycles c
      where c.term_id=v_closeout.term_id
    ) then
      raise exception 'Academic term close-out requires at least one governed assessment cycle for the term.';
    end if;

    if exists(
      select 1
      from public.khpos_ops_assessment_cycles c
      where c.term_id=v_closeout.term_id
        and c.status not in ('closed','cancelled')
    ) then
      raise exception 'Close or cancel every assessment cycle before submitting academic term close-out.';
    end if;

    if exists(
      select 1
      from public.khpos_ops_academic_integrity_cases ic
      where ic.term_id=v_closeout.term_id
        and ic.severity in ('high','critical')
        and ic.status<>'closed'
    ) then
      raise exception 'Resolve every high/critical academic-integrity case before term close-out.';
    end if;

    if exists(
      select 1
      from public.khpos_ops_result_corrections rc
      where rc.term_id=v_closeout.term_id
        and rc.status not in ('verified','rejected','cancelled')
    ) then
      raise exception 'Resolve every result-correction workflow before term close-out.';
    end if;

    select count(*) into v_open_debt
    from public.khpos_ops_academic_debt d
    join public.khpos_ops_academic_delivery_streams s on s.id=d.stream_id
    where s.term_id=v_closeout.term_id
      and d.status<>'closed';

    select count(*) into v_open_p2
    from public.khpos_ops_academic_debt d
    join public.khpos_ops_academic_delivery_streams s on s.id=d.stream_id
    where s.term_id=v_closeout.term_id
      and d.status<>'closed'
      and d.severity='P2'
      and d.linked_issue_id is null;

    select count(*) into v_open_support
    from public.khpos_ops_learner_support_cases lc
    where lc.term_id=v_closeout.term_id
      and lc.status<>'closed';

    if v_open_p2>0 then
      raise exception 'Open P2 academic debt requires an institutional issue/escalation reference before close-out.';
    end if;

    if (v_open_debt>0 or v_open_support>0)
       and nullif(btrim(coalesce(v_closeout.carryover_reference,'')),'') is null then
      raise exception 'Open academic debt/learner support requires an explicit carry-over reference before close-out.';
    end if;

    v_to := 'in_review';
    update public.khpos_ops_academic_closeouts
    set status=v_to,submitted_at=now(),updated_at=now()
    where id=v_closeout.id;

  elsif p_action='approve' then
    if not khpos_private.ops_assurance_is_school_guardian(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian can approve academic term close-out.';
    end if;
    if v_closeout.status<>'in_review' then
      raise exception 'Only submitted academic close-out can be approved.';
    end if;
    if v_closeout.prepared_by=p_actor_user_id then
      raise exception 'Academic close-out requires independent School Guardian approval.';
    end if;
    if v_note is null then raise exception 'Close-out approval note is required.'; end if;

    v_to := 'approved';
    update public.khpos_ops_academic_closeouts
    set status=v_to,approved_by=p_actor_user_id,approved_at=now(),
        approval_note=left(v_note,8000),updated_at=now()
    where id=v_closeout.id;

  elsif p_action='close_term' then
    if not khpos_private.ops_assurance_is_school_guardian(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian can close an approved academic term.';
    end if;
    if v_closeout.status<>'approved' then
      raise exception 'Academic term can close only after approved close-out.';
    end if;

    update public.khpos_ops_academic_terms
    set status='closed',closed_by=p_actor_user_id,closed_at=now(),updated_at=now()
    where id=v_closeout.term_id and status='active';

    if not found then
      raise exception 'Academic term is no longer active.';
    end if;

    update public.khpos_ops_academic_delivery_streams
    set status='closed',updated_at=now()
    where term_id=v_closeout.term_id and status='active';

    v_to := 'closed';
    update public.khpos_ops_academic_closeouts
    set status=v_to,closed_by=p_actor_user_id,closed_at=now(),updated_at=now()
    where id=v_closeout.id;

  elsif p_action='cancel' then
    if not khpos_private.ops_assurance_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only Academic Inspector or School Guardian can cancel a draft close-out.';
    end if;
    if v_closeout.status not in ('draft','in_review') then
      raise exception 'Only draft/in-review close-out can be cancelled.';
    end if;
    if v_note is null then raise exception 'Close-out cancellation reason is required.'; end if;

    v_to := 'cancelled';
    update public.khpos_ops_academic_closeouts
    set status=v_to,updated_at=now()
    where id=v_closeout.id;

  else
    raise exception 'Unsupported academic close-out action.';
  end if;

  insert into public.khpos_ops_academic_assurance_events(
    organisation_id,term_id,closeout_id,actor_user_id,event_type,
    from_state,to_state,note
  ) values (
    p_organisation_id,v_closeout.term_id,v_closeout.id,p_actor_user_id,
    'academic_closeout_'||p_action,v_closeout.status,v_to,left(v_note,4000)
  );
end;
$$;

revoke execute on function khpos_private.ops_assurance_actor_has_role(uuid,uuid,text[])
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_assurance_can_manage(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_assurance_can_coordinate(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_assurance_is_school_guardian(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_assurance_cycle_visible(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_assurance_stream_teacher(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_assurance_case_visible(uuid,uuid,uuid)
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_academic_assurance_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_assessment_cycle_server(uuid,uuid,uuid,uuid,text,text,text,date,date,date,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_assessment_cycle_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_assessment_package_server(uuid,uuid,uuid,uuid,text,text,text,boolean)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_assessment_package_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_exam_readiness_item_server(uuid,uuid,uuid,uuid,text,text,text,uuid,date,boolean)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_exam_readiness_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_report_integrity_case_server(uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_record_integrity_representation_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_integrity_evidence_server(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_decide_integrity_case_server(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_integrity_case_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_request_result_correction_server(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_result_correction_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_academic_closeout_server(uuid,uuid,uuid,text,text,text,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_academic_closeout_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_assurance_actor_has_role(uuid,uuid,text[]) to service_role;
grant execute on function khpos_private.ops_assurance_can_manage(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_assurance_can_coordinate(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_assurance_is_school_guardian(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_assurance_cycle_visible(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_assurance_stream_teacher(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_assurance_case_visible(uuid,uuid,uuid) to service_role;

grant execute on function public.khpos_ops_get_academic_assurance_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_assessment_cycle_server(uuid,uuid,uuid,uuid,text,text,text,date,date,date,text,text) to service_role;
grant execute on function public.khpos_ops_assessment_cycle_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_create_assessment_package_server(uuid,uuid,uuid,uuid,text,text,text,boolean) to service_role;
grant execute on function public.khpos_ops_assessment_package_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_create_exam_readiness_item_server(uuid,uuid,uuid,uuid,text,text,text,uuid,date,boolean) to service_role;
grant execute on function public.khpos_ops_exam_readiness_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_report_integrity_case_server(uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_record_integrity_representation_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_add_integrity_evidence_server(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_decide_integrity_case_server(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_integrity_case_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_request_result_correction_server(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_result_correction_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_academic_closeout_server(uuid,uuid,uuid,text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_academic_closeout_action_server(uuid,uuid,uuid,text,text) to service_role;
