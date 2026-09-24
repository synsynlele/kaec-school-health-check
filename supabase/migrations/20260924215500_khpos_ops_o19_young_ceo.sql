create extension if not exists pgcrypto;

-- O19: Young CEO Hub / Value Creation.
-- KHP-OS governs programme delivery, venture milestones and individual evidence.
-- It does not become a cash ledger, payment processor, marketplace or private PipuPath store.

create table if not exists public.khpos_ops_young_ceo_cycles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id) on delete restrict,
  cycle_reference text not null,
  title text not null,
  purpose text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned'
    check (status in ('planned','active','completed','cancelled')),
  completion_note text,
  evidence_reference text,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,cycle_reference),
  check (end_date>=start_date)
);

create index if not exists idx_khpos_ops_young_ceo_cycles_term
  on public.khpos_ops_young_ceo_cycles(organisation_id,term_id,status,start_date);
create index if not exists idx_khpos_ops_young_ceo_cycles_campus
  on public.khpos_ops_young_ceo_cycles(campus_id,status,start_date);
create index if not exists idx_khpos_ops_young_ceo_cycles_owner
  on public.khpos_ops_young_ceo_cycles(owner_assignment_id,status);
create index if not exists idx_khpos_ops_young_ceo_cycles_created_by
  on public.khpos_ops_young_ceo_cycles(created_by,created_at desc);

create table if not exists public.khpos_ops_young_ceo_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  cycle_id uuid not null references public.khpos_ops_young_ceo_cycles(id) on delete cascade,
  session_reference text not null,
  session_date date not null,
  theme text not null,
  purpose text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  status text not null default 'planned'
    check (status in ('planned','delivered','missed','cancelled')),
  delivery_note text,
  evidence_reference text,
  recovery_due_date date,
  recovery_status text not null default 'not_required'
    check (recovery_status in ('not_required','required','recovered','waived')),
  issue_id uuid references public.khpos_ops_issues(id) on delete set null,
  delivered_by uuid references auth.users(id) on delete set null,
  delivered_at timestamptz,
  missed_by uuid references auth.users(id) on delete set null,
  missed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,session_reference),
  unique (cycle_id,session_date)
);

create index if not exists idx_khpos_ops_young_ceo_sessions_cycle
  on public.khpos_ops_young_ceo_sessions(cycle_id,status,session_date);
create index if not exists idx_khpos_ops_young_ceo_sessions_owner
  on public.khpos_ops_young_ceo_sessions(owner_assignment_id,status,session_date);
create index if not exists idx_khpos_ops_young_ceo_sessions_issue
  on public.khpos_ops_young_ceo_sessions(issue_id)
  where issue_id is not null;
create index if not exists idx_khpos_ops_young_ceo_sessions_created_by
  on public.khpos_ops_young_ceo_sessions(created_by,created_at desc);

create table if not exists public.khpos_ops_young_ceo_ventures (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  cycle_id uuid not null references public.khpos_ops_young_ceo_cycles(id) on delete cascade,
  venture_reference text not null,
  name text not null,
  venture_mode text not null
    check (venture_mode in ('individual','team')),
  problem_statement text not null,
  target_customer text,
  solution_summary text,
  value_proposition text,
  sales_mode text not null default 'simulation'
    check (sales_mode in ('simulation','internal_school','external_approved')),
  sales_approval_reference text,
  finance_reference text,
  status text not null default 'idea'
    check (status in (
      'idea','validating','building','testing','selling','iterating',
      'completed','withdrawn'
    )),
  completion_note text,
  completion_evidence_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  withdrawn_by uuid references auth.users(id) on delete set null,
  withdrawn_at timestamptz,
  withdrawal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,venture_reference)
);

create unique index if not exists uq_khpos_ops_young_ceo_venture_name
  on public.khpos_ops_young_ceo_ventures(cycle_id,lower(name))
  where status<>'withdrawn';
create index if not exists idx_khpos_ops_young_ceo_ventures_cycle
  on public.khpos_ops_young_ceo_ventures(cycle_id,status,created_at desc);
create index if not exists idx_khpos_ops_young_ceo_ventures_created_by
  on public.khpos_ops_young_ceo_ventures(created_by,created_at desc);

create table if not exists public.khpos_ops_young_ceo_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  venture_id uuid not null references public.khpos_ops_young_ceo_ventures(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  member_role text not null default 'member'
    check (member_role in ('lead','member')),
  status text not null default 'active'
    check (status in ('active','completed','left')),
  joined_by uuid not null references auth.users(id) on delete restrict,
  joined_at timestamptz not null default now(),
  left_by uuid references auth.users(id) on delete set null,
  left_at timestamptz,
  leave_note text,
  updated_at timestamptz not null default now(),
  unique (venture_id,learner_id)
);

create index if not exists idx_khpos_ops_young_ceo_members_venture
  on public.khpos_ops_young_ceo_members(venture_id,status,member_role);
create index if not exists idx_khpos_ops_young_ceo_members_learner
  on public.khpos_ops_young_ceo_members(learner_id,status);
create index if not exists idx_khpos_ops_young_ceo_members_joined_by
  on public.khpos_ops_young_ceo_members(joined_by,joined_at desc);

create table if not exists public.khpos_ops_young_ceo_milestones (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  venture_id uuid not null references public.khpos_ops_young_ceo_ventures(id) on delete cascade,
  milestone_code text not null
    check (milestone_code in (
      'problem','customer','solution','value_proposition','costing','pricing',
      'communication_pitch','selling_test','money_management','iteration'
    )),
  sequence_no integer not null check (sequence_no between 1 and 10),
  title text not null,
  expected_evidence text not null,
  due_date date,
  status text not null default 'not_started'
    check (status in (
      'not_started','in_progress','evidence_submitted','verified','returned'
    )),
  evidence_note text,
  evidence_reference text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  verification_note text,
  returned_by uuid references auth.users(id) on delete set null,
  returned_at timestamptz,
  return_note text,
  updated_at timestamptz not null default now(),
  unique (venture_id,milestone_code),
  unique (venture_id,sequence_no)
);

create index if not exists idx_khpos_ops_young_ceo_milestones_venture
  on public.khpos_ops_young_ceo_milestones(venture_id,status,sequence_no);
create index if not exists idx_khpos_ops_young_ceo_milestones_submitted
  on public.khpos_ops_young_ceo_milestones(submitted_by,status)
  where submitted_by is not null;
create index if not exists idx_khpos_ops_young_ceo_milestones_verified
  on public.khpos_ops_young_ceo_milestones(verified_by,verified_at)
  where verified_by is not null;

create table if not exists public.khpos_ops_young_ceo_member_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  venture_id uuid not null references public.khpos_ops_young_ceo_ventures(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  evidence_reference_code text not null,
  dimension text not null
    check (dimension in (
      'problem_discovery','customer_understanding','solution_design',
      'value_proposition','costing','pricing','communication','selling',
      'money_management','iteration','collaboration','initiative',
      'resilience','other'
    )),
  contribution_note text not null,
  evidence_reference text not null,
  observed_at timestamptz not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'submitted'
    check (status in ('submitted','verified','returned','withdrawn')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  verification_note text,
  returned_by uuid references auth.users(id) on delete set null,
  returned_at timestamptz,
  return_note text,
  withdrawn_by uuid references auth.users(id) on delete set null,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  potential_evidence_id uuid references public.khpos_ops_potential_evidence(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,evidence_reference_code)
);

create index if not exists idx_khpos_ops_young_ceo_member_evidence_venture
  on public.khpos_ops_young_ceo_member_evidence(venture_id,status,observed_at desc);
create index if not exists idx_khpos_ops_young_ceo_member_evidence_learner
  on public.khpos_ops_young_ceo_member_evidence(learner_id,status,observed_at desc);
create index if not exists idx_khpos_ops_young_ceo_member_evidence_recorded
  on public.khpos_ops_young_ceo_member_evidence(recorded_by,status,created_at desc);
create index if not exists idx_khpos_ops_young_ceo_member_evidence_potential
  on public.khpos_ops_young_ceo_member_evidence(potential_evidence_id)
  where potential_evidence_id is not null;

create table if not exists public.khpos_ops_young_ceo_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  cycle_id uuid references public.khpos_ops_young_ceo_cycles(id) on delete cascade,
  session_id uuid references public.khpos_ops_young_ceo_sessions(id) on delete cascade,
  venture_id uuid references public.khpos_ops_young_ceo_ventures(id) on delete cascade,
  milestone_id uuid references public.khpos_ops_young_ceo_milestones(id) on delete cascade,
  member_evidence_id uuid references public.khpos_ops_young_ceo_member_evidence(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(cycle_id,session_id,venture_id,milestone_id,member_evidence_id)>=1)
);

create index if not exists idx_khpos_ops_young_ceo_events_cycle
  on public.khpos_ops_young_ceo_events(cycle_id,created_at desc)
  where cycle_id is not null;
create index if not exists idx_khpos_ops_young_ceo_events_session
  on public.khpos_ops_young_ceo_events(session_id,created_at desc)
  where session_id is not null;
create index if not exists idx_khpos_ops_young_ceo_events_venture
  on public.khpos_ops_young_ceo_events(venture_id,created_at desc)
  where venture_id is not null;
create index if not exists idx_khpos_ops_young_ceo_events_milestone
  on public.khpos_ops_young_ceo_events(milestone_id,created_at desc)
  where milestone_id is not null;
create index if not exists idx_khpos_ops_young_ceo_events_member_evidence
  on public.khpos_ops_young_ceo_events(member_evidence_id,created_at desc)
  where member_evidence_id is not null;
create index if not exists idx_khpos_ops_young_ceo_events_actor
  on public.khpos_ops_young_ceo_events(actor_user_id,created_at desc)
  where actor_user_id is not null;

alter table public.khpos_ops_young_ceo_cycles enable row level security;
alter table public.khpos_ops_young_ceo_sessions enable row level security;
alter table public.khpos_ops_young_ceo_ventures enable row level security;
alter table public.khpos_ops_young_ceo_members enable row level security;
alter table public.khpos_ops_young_ceo_milestones enable row level security;
alter table public.khpos_ops_young_ceo_member_evidence enable row level security;
alter table public.khpos_ops_young_ceo_events enable row level security;

revoke all privileges on table public.khpos_ops_young_ceo_cycles from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_young_ceo_sessions from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_young_ceo_ventures from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_young_ceo_members from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_young_ceo_milestones from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_young_ceo_member_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_young_ceo_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_young_ceo_cycles to service_role;
grant select,insert,update,delete on table public.khpos_ops_young_ceo_sessions to service_role;
grant select,insert,update,delete on table public.khpos_ops_young_ceo_ventures to service_role;
grant select,insert,update,delete on table public.khpos_ops_young_ceo_members to service_role;
grant select,insert,update,delete on table public.khpos_ops_young_ceo_milestones to service_role;
grant select,insert,update,delete on table public.khpos_ops_young_ceo_member_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_young_ceo_events to service_role;

create or replace function khpos_private.ops_yceo_can_manage(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select khpos_private.ops_hpd_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array['SCHOOL_GUARDIAN','SKILL_INSPECTOR']
  );
$$;

create or replace function khpos_private.ops_yceo_can_facilitate(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select khpos_private.ops_hpd_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array[
      'SCHOOL_GUARDIAN','SKILL_INSPECTOR','SECTIONAL_PROMOTER',
      'TEACHER','SKILLS_FACILITATOR'
    ]
  );
$$;

create or replace function khpos_private.ops_yceo_valid_owner_assignment(
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
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in (
        'SCHOOL_GUARDIAN','SKILL_INSPECTOR','SECTIONAL_PROMOTER',
        'TEACHER','SKILLS_FACILITATOR'
      )
  );
$$;

create or replace function khpos_private.ops_yceo_actor_assignment(
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

create or replace function khpos_private.ops_yceo_cycle_visible(
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
    from public.khpos_ops_young_ceo_cycles c
    where c.id=p_cycle_id
      and c.organisation_id=p_organisation_id
      and (
        khpos_private.ops_yceo_can_manage(
          p_actor_user_id,p_organisation_id
        )
        or khpos_private.ops_yceo_actor_assignment(
          p_actor_user_id,p_organisation_id,c.owner_assignment_id
        )
      )
  );
$$;

create or replace function khpos_private.ops_yceo_milestone_ready(
  p_venture_id uuid,
  p_codes text[]
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select not exists(
    select 1
    from unnest(p_codes) code
    where not exists(
      select 1
      from public.khpos_ops_young_ceo_milestones m
      where m.venture_id=p_venture_id
        and m.milestone_code=code
        and m.status='verified'
    )
  );
$$;

create or replace function public.khpos_ops_get_young_ceo_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_name text;
  v_member_role text;
  v_can_manage boolean;
  v_can_facilitate boolean;
  v_is_executive boolean;
  v_terms jsonb := '[]'::jsonb;
  v_campuses jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
  v_cycles jsonb := '[]'::jsonb;
  v_sessions jsonb := '[]'::jsonb;
  v_ventures jsonb := '[]'::jsonb;
  v_members jsonb := '[]'::jsonb;
  v_milestones jsonb := '[]'::jsonb;
  v_evidence jsonb := '[]'::jsonb;
begin
  if not khpos_private.ops_hpd_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select o.name,m.role into v_name,v_member_role
  from public.organisations o
  join public.organisation_memberships m on m.organisation_id=o.id
  where o.id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
  limit 1;

  v_can_manage := khpos_private.ops_yceo_can_manage(
    p_actor_user_id,p_organisation_id
  );
  v_can_facilitate := khpos_private.ops_yceo_can_facilitate(
    p_actor_user_id,p_organisation_id
  );
  v_is_executive := khpos_private.ops_capability_is_pure_executive(
    p_actor_user_id,p_organisation_id
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'sessionLabel',t.session_label,'termCode',t.term_code,
    'termName',t.term_name,'status',t.status,'startDate',t.start_date,'endDate',t.end_date
  ) order by t.start_date desc),'[]'::jsonb)
  into v_terms
  from public.khpos_ops_academic_terms t
  where t.organisation_id=p_organisation_id
    and t.status in ('active','closed');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'code',c.code,'name',c.name
  ) order by c.name),'[]'::jsonb)
  into v_campuses
  from public.khpos_ops_campuses c
  where c.organisation_id=p_organisation_id and c.status='active';

  if v_can_facilitate or v_can_manage then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'userId',a.user_id,'roleCode',r.code,'roleTitle',r.title,
      'campusId',a.campus_id,'unitId',a.unit_id,
      'isMine',a.user_id=p_actor_user_id
    ) order by r.role_level,r.title),'[]'::jsonb)
    into v_assignments
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where r.organisation_id=p_organisation_id
      and r.status='active'
      and a.status='active'
      and r.code in (
        'SCHOOL_GUARDIAN','SKILL_INSPECTOR','SECTIONAL_PROMOTER',
        'TEACHER','SKILLS_FACILITATOR'
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',l.id,'displayName',l.display_name,'classLabel',l.class_label,
      'sectionLabel',l.section_label,'campusId',l.campus_id
    ) order by l.class_label,l.display_name),'[]'::jsonb)
    into v_learners
    from public.khpos_ops_learner_anchors l
    where l.organisation_id=p_organisation_id
      and l.status='active'
      and khpos_private.ops_hpd_learner_visible(
        p_actor_user_id,p_organisation_id,l.id
      );
  end if;

  if not v_is_executive then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',c.id,'reference',c.cycle_reference,'termId',c.term_id,
      'campusId',c.campus_id,'title',c.title,'purpose',c.purpose,
      'ownerAssignmentId',c.owner_assignment_id,'startDate',c.start_date,
      'endDate',c.end_date,'status',c.status,
      'completionNote',c.completion_note,'evidenceReference',c.evidence_reference,
      'isOwner',khpos_private.ops_yceo_actor_assignment(
        p_actor_user_id,p_organisation_id,c.owner_assignment_id
      ),
      'canManage',v_can_manage
    ) order by c.start_date desc,c.created_at desc),'[]'::jsonb)
    into v_cycles
    from public.khpos_ops_young_ceo_cycles c
    where c.organisation_id=p_organisation_id
      and khpos_private.ops_yceo_cycle_visible(
        p_actor_user_id,p_organisation_id,c.id
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'reference',s.session_reference,'cycleId',s.cycle_id,
      'sessionDate',s.session_date,'theme',s.theme,'purpose',s.purpose,
      'ownerAssignmentId',s.owner_assignment_id,'status',s.status,
      'deliveryNote',s.delivery_note,'evidenceReference',s.evidence_reference,
      'recoveryDueDate',s.recovery_due_date,'recoveryStatus',s.recovery_status,
      'issueId',s.issue_id,
      'isOwner',khpos_private.ops_yceo_actor_assignment(
        p_actor_user_id,p_organisation_id,s.owner_assignment_id
      ),
      'canManage',v_can_manage
    ) order by s.session_date desc,s.created_at desc),'[]'::jsonb)
    into v_sessions
    from public.khpos_ops_young_ceo_sessions s
    where s.organisation_id=p_organisation_id
      and khpos_private.ops_yceo_cycle_visible(
        p_actor_user_id,p_organisation_id,s.cycle_id
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',v.id,'reference',v.venture_reference,'cycleId',v.cycle_id,
      'name',v.name,'ventureMode',v.venture_mode,
      'problemStatement',v.problem_statement,'targetCustomer',v.target_customer,
      'solutionSummary',v.solution_summary,'valueProposition',v.value_proposition,
      'salesMode',v.sales_mode,
      'salesApprovalReference',case when v_can_manage then v.sales_approval_reference else null end,
      'financeReference',case when v_can_manage then v.finance_reference else null end,
      'status',v.status,'completionNote',v.completion_note,
      'completionEvidenceReference',v.completion_evidence_reference,
      'canManage',v_can_manage,
      'canFacilitate',v_can_facilitate and khpos_private.ops_yceo_cycle_visible(
        p_actor_user_id,p_organisation_id,v.cycle_id
      )
    ) order by v.created_at desc),'[]'::jsonb)
    into v_ventures
    from public.khpos_ops_young_ceo_ventures v
    where v.organisation_id=p_organisation_id
      and khpos_private.ops_yceo_cycle_visible(
        p_actor_user_id,p_organisation_id,v.cycle_id
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'ventureId',m.venture_id,'learnerId',m.learner_id,
      'learnerName',l.display_name,'memberRole',m.member_role,
      'status',m.status,'joinedAt',m.joined_at,'leftAt',m.left_at
    ) order by l.display_name),'[]'::jsonb)
    into v_members
    from public.khpos_ops_young_ceo_members m
    join public.khpos_ops_young_ceo_ventures v on v.id=m.venture_id
    join public.khpos_ops_learner_anchors l on l.id=m.learner_id
    where m.organisation_id=p_organisation_id
      and khpos_private.ops_yceo_cycle_visible(
        p_actor_user_id,p_organisation_id,v.cycle_id
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'ventureId',m.venture_id,'milestoneCode',m.milestone_code,
      'sequenceNo',m.sequence_no,'title',m.title,
      'expectedEvidence',m.expected_evidence,'dueDate',m.due_date,
      'status',m.status,'evidenceNote',m.evidence_note,
      'evidenceReference',m.evidence_reference,'submittedBy',m.submitted_by,
      'verifiedBy',m.verified_by,'verifiedAt',m.verified_at,
      'verificationNote',m.verification_note,'returnNote',m.return_note,
      'canVerify',v_can_manage and m.submitted_by is distinct from p_actor_user_id
    ) order by m.venture_id,m.sequence_no),'[]'::jsonb)
    into v_milestones
    from public.khpos_ops_young_ceo_milestones m
    join public.khpos_ops_young_ceo_ventures v on v.id=m.venture_id
    where m.organisation_id=p_organisation_id
      and khpos_private.ops_yceo_cycle_visible(
        p_actor_user_id,p_organisation_id,v.cycle_id
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'ventureId',e.venture_id,'learnerId',e.learner_id,
      'learnerName',l.display_name,'reference',e.evidence_reference_code,
      'dimension',e.dimension,'contributionNote',e.contribution_note,
      'evidenceReference',e.evidence_reference,'observedAt',e.observed_at,
      'recordedBy',e.recorded_by,'status',e.status,
      'verifiedBy',e.verified_by,'verifiedAt',e.verified_at,
      'verificationNote',e.verification_note,'returnNote',e.return_note,
      'potentialEvidenceId',e.potential_evidence_id,
      'isRecorder',e.recorded_by=p_actor_user_id,
      'canVerify',v_can_manage and e.recorded_by<>p_actor_user_id
    ) order by e.observed_at desc,e.created_at desc),'[]'::jsonb)
    into v_evidence
    from public.khpos_ops_young_ceo_member_evidence e
    join public.khpos_ops_young_ceo_ventures v on v.id=e.venture_id
    join public.khpos_ops_learner_anchors l on l.id=e.learner_id
    where e.organisation_id=p_organisation_id
      and khpos_private.ops_yceo_cycle_visible(
        p_actor_user_id,p_organisation_id,v.cycle_id
      );
  end if;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canManage',v_can_manage,
    'canFacilitate',v_can_facilitate,
    'executiveAggregateOnly',v_is_executive,
    'principle','Young CEO Hub develops value creation: find a real problem, understand a user, build a useful response, understand cost/price/money, communicate value, test responsibly and iterate. Profit alone is not the score.',
    'commercialBoundary','KHP-OS is not a cash ledger or marketplace. Simulation is valid learning. Any real-money selling uses the applicable school approval, safeguarding/parent-consent controls where required, and Finance/Admin transaction records; O19 stores only the approval/finance reference.',
    'privacyBoundary','PipuPath remains learner-facing/private. O19 stores school-owned venture execution and deliberately shared evidence references only.',
    'terms',v_terms,
    'campuses',v_campuses,
    'assignments',v_assignments,
    'learners',case when v_is_executive then '[]'::jsonb else v_learners end,
    'cycles',v_cycles,
    'sessions',v_sessions,
    'ventures',v_ventures,
    'members',v_members,
    'milestones',v_milestones,
    'memberEvidence',v_evidence,
    'summary',jsonb_build_object(
      'activeCycles',(
        select count(*) from public.khpos_ops_young_ceo_cycles c
        where c.organisation_id=p_organisation_id and c.status='active'
      ),
      'plannedSessions',(
        select count(*) from public.khpos_ops_young_ceo_sessions s
        where s.organisation_id=p_organisation_id and s.status='planned'
      ),
      'missedSessions',(
        select count(*) from public.khpos_ops_young_ceo_sessions s
        where s.organisation_id=p_organisation_id and s.status='missed'
      ),
      'activeVentures',(
        select count(*) from public.khpos_ops_young_ceo_ventures v
        where v.organisation_id=p_organisation_id
          and v.status not in ('completed','withdrawn')
      ),
      'venturesReadyToComplete',(
        select count(*)
        from public.khpos_ops_young_ceo_ventures v
        where v.organisation_id=p_organisation_id
          and v.status not in ('completed','withdrawn')
          and khpos_private.ops_yceo_milestone_ready(
            v.id,array[
              'problem','customer','solution','value_proposition','costing',
              'pricing','communication_pitch','selling_test',
              'money_management','iteration'
            ]
          )
      ),
      'submittedMemberEvidence',(
        select count(*) from public.khpos_ops_young_ceo_member_evidence e
        where e.organisation_id=p_organisation_id and e.status='submitted'
      ),
      'verifiedMemberEvidence',(
        select count(*) from public.khpos_ops_young_ceo_member_evidence e
        where e.organisation_id=p_organisation_id and e.status='verified'
      )
    )
  );
end;
$$;

create or replace function public.khpos_ops_create_young_ceo_cycle_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_campus_id uuid,
  p_title text,
  p_purpose text,
  p_owner_assignment_id uuid,
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
  v_ref text := 'YCH-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_yceo_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the School Guardian or Skill Inspector can create a Young CEO Hub cycle.';
  end if;

  if not khpos_private.ops_hpd_active_term(
    p_organisation_id,p_term_id,false
  ) then
    raise exception 'Young CEO Hub cycle must belong to the active academic term.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_campuses c
    where c.id=p_campus_id
      and c.organisation_id=p_organisation_id
      and c.status='active'
  ) then
    raise exception 'Young CEO Hub campus must be active in this organisation.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_purpose,'')),'') is null
     or p_start_date is null or p_end_date is null or p_end_date<p_start_date then
    raise exception 'Young CEO Hub title, purpose and valid cycle dates are required.';
  end if;

  if not khpos_private.ops_yceo_valid_owner_assignment(
    p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'Young CEO Hub owner must hold an active eligible KNS operating assignment.';
  end if;

  insert into public.khpos_ops_young_ceo_cycles(
    organisation_id,term_id,campus_id,cycle_reference,title,purpose,
    owner_assignment_id,start_date,end_date,created_by
  ) values (
    p_organisation_id,p_term_id,p_campus_id,v_ref,left(btrim(p_title),240),
    left(btrim(p_purpose),5000),p_owner_assignment_id,p_start_date,p_end_date,
    p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'cycle_created','planned',
    left(btrim(p_title),240)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_young_ceo_cycle_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_cycle_id uuid,
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
  v_c public.khpos_ops_young_ceo_cycles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_to text;
begin
  select * into v_c
  from public.khpos_ops_young_ceo_cycles
  where id=p_cycle_id and organisation_id=p_organisation_id
  for update;

  if v_c.id is null then raise exception 'Young CEO Hub cycle not found.'; end if;

  if not khpos_private.ops_yceo_can_manage(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_yceo_actor_assignment(
    p_actor_user_id,p_organisation_id,v_c.owner_assignment_id
  ) then
    raise exception 'Only the cycle owner or Young CEO Hub coordinating authority can change this cycle.';
  end if;

  if p_action='activate' then
    if v_c.status<>'planned' then raise exception 'Only a planned cycle can be activated.'; end if;
    v_to := 'active';
    update public.khpos_ops_young_ceo_cycles
    set status=v_to,activated_by=p_actor_user_id,activated_at=now(),updated_at=now()
    where id=v_c.id;

  elsif p_action='complete' then
    if v_c.status<>'active' then raise exception 'Only an active cycle can be completed.'; end if;
    if v_note is null or v_evidence is null then
      raise exception 'Cycle completion requires a close-out note and evidence reference.';
    end if;
    if exists(
      select 1 from public.khpos_ops_young_ceo_sessions s
      where s.cycle_id=v_c.id
        and (
          s.status='planned'
          or (s.status='missed' and s.recovery_status='required')
        )
    ) then
      raise exception 'Resolve planned/missed Young CEO Hub session obligations before cycle close-out.';
    end if;
    v_to := 'completed';
    update public.khpos_ops_young_ceo_cycles
    set status=v_to,completion_note=left(v_note,5000),
        evidence_reference=left(v_evidence,1000),
        completed_by=p_actor_user_id,completed_at=now(),updated_at=now()
    where id=v_c.id;

  elsif p_action='cancel' then
    if v_c.status in ('completed','cancelled') then
      raise exception 'Completed or cancelled cycle cannot be cancelled.';
    end if;
    if v_note is null then raise exception 'Cycle cancellation reason is required.'; end if;
    if exists(
      select 1 from public.khpos_ops_young_ceo_ventures v
      where v.cycle_id=v_c.id and v.status not in ('completed','withdrawn')
    ) then
      raise exception 'Withdraw or complete active ventures before cancelling the Young CEO Hub cycle.';
    end if;
    v_to := 'cancelled';
    update public.khpos_ops_young_ceo_cycles
    set status=v_to,cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_c.id;

  else
    raise exception 'Unsupported Young CEO Hub cycle action.';
  end if;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,actor_user_id,event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_c.id,p_actor_user_id,'cycle_'||p_action,
    v_c.status,v_to,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence)
  );
end;
$$;

create or replace function public.khpos_ops_create_young_ceo_session_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_cycle_id uuid,
  p_session_date date,
  p_theme text,
  p_purpose text,
  p_owner_assignment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_c public.khpos_ops_young_ceo_cycles%rowtype;
  v_id uuid;
  v_ref text := 'YCS-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  select * into v_c
  from public.khpos_ops_young_ceo_cycles
  where id=p_cycle_id and organisation_id=p_organisation_id;

  if v_c.id is null or v_c.status not in ('planned','active') then
    raise exception 'Session requires a planned or active Young CEO Hub cycle.';
  end if;

  if not khpos_private.ops_yceo_can_manage(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_yceo_actor_assignment(
    p_actor_user_id,p_organisation_id,v_c.owner_assignment_id
  ) then
    raise exception 'Only the cycle owner or Young CEO Hub coordinating authority can schedule sessions.';
  end if;

  if p_session_date<v_c.start_date or p_session_date>v_c.end_date then
    raise exception 'Young CEO Hub session date must fall within the cycle dates.';
  end if;

  if nullif(btrim(coalesce(p_theme,'')),'') is null
     or nullif(btrim(coalesce(p_purpose,'')),'') is null then
    raise exception 'Young CEO Hub session theme and purpose are required.';
  end if;

  if not khpos_private.ops_yceo_valid_owner_assignment(
    p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'Session owner must hold an active eligible KNS operating assignment.';
  end if;

  insert into public.khpos_ops_young_ceo_sessions(
    organisation_id,cycle_id,session_reference,session_date,theme,purpose,
    owner_assignment_id,created_by
  ) values (
    p_organisation_id,p_cycle_id,v_ref,p_session_date,left(btrim(p_theme),240),
    left(btrim(p_purpose),5000),p_owner_assignment_id,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,session_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,p_cycle_id,v_id,p_actor_user_id,
    'session_created','planned',left(btrim(p_theme),240)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_young_ceo_session_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_session_id uuid,
  p_action text,
  p_note text,
  p_evidence_reference text default null,
  p_recovery_due_date date default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_s public.khpos_ops_young_ceo_sessions%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_issue uuid;
  v_to text;
begin
  select * into v_s
  from public.khpos_ops_young_ceo_sessions
  where id=p_session_id and organisation_id=p_organisation_id
  for update;

  if v_s.id is null then raise exception 'Young CEO Hub session not found.'; end if;

  if not khpos_private.ops_yceo_can_manage(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_yceo_actor_assignment(
    p_actor_user_id,p_organisation_id,v_s.owner_assignment_id
  ) then
    raise exception 'Only the session owner or Young CEO Hub coordinating authority can change this session.';
  end if;

  if v_note is null then raise exception 'Session outcome note is required.'; end if;

  if p_action='deliver' then
    if v_s.status<>'planned' then raise exception 'Only a planned session can be delivered.'; end if;
    if v_s.session_date>current_date then
      raise exception 'Young CEO Hub session cannot be marked delivered before its planned date.';
    end if;
    if v_evidence is null then
      raise exception 'Delivered Young CEO Hub session requires an evidence reference.';
    end if;
    v_to := 'delivered';
    update public.khpos_ops_young_ceo_sessions
    set status=v_to,delivery_note=left(v_note,5000),
        evidence_reference=left(v_evidence,1000),
        delivered_by=p_actor_user_id,delivered_at=now(),updated_at=now()
    where id=v_s.id;

  elsif p_action='miss' then
    if v_s.status<>'planned' then raise exception 'Only a planned session can be marked missed.'; end if;
    if p_recovery_due_date is null or p_recovery_due_date<current_date then
      raise exception 'Missed Young CEO Hub session requires a recovery due date.';
    end if;

    v_issue := public.khpos_ops_create_issue_server(
      p_actor_user_id,p_organisation_id,
      'Missed Young CEO Hub session · '||v_s.theme,
      'Required Young CEO Hub delivery was missed. Recovery due '
        ||p_recovery_due_date::text||'. '||v_note,
      'human_potential_development','P3',
      (p_recovery_due_date::timestamptz + interval '17 hours')
    );

    v_to := 'missed';
    update public.khpos_ops_young_ceo_sessions
    set status=v_to,delivery_note=left(v_note,5000),
        recovery_due_date=p_recovery_due_date,recovery_status='required',
        issue_id=v_issue,missed_by=p_actor_user_id,missed_at=now(),updated_at=now()
    where id=v_s.id;

  elsif p_action='recover' then
    if v_s.status<>'missed' or v_s.recovery_status<>'required' then
      raise exception 'Only a missed session with an open recovery obligation can be recovered.';
    end if;
    if v_evidence is null then
      raise exception 'Recovered Young CEO Hub session requires an evidence reference.';
    end if;
    v_to := 'recovered';
    update public.khpos_ops_young_ceo_sessions
    set recovery_status='recovered',
        delivery_note=left(coalesce(delivery_note,'')||case when delivery_note is null then '' else E'\n' end||'Recovery: '||v_note,5000),
        evidence_reference=left(v_evidence,1000),updated_at=now()
    where id=v_s.id;

  elsif p_action='waive_recovery' then
    if not khpos_private.ops_yceo_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian or Skill Inspector can waive a Young CEO Hub recovery obligation.';
    end if;
    if v_s.status<>'missed' or v_s.recovery_status<>'required' then
      raise exception 'Only an open missed-session recovery obligation can be waived.';
    end if;
    v_to := 'recovery_waived';
    update public.khpos_ops_young_ceo_sessions
    set recovery_status='waived',
        delivery_note=left(coalesce(delivery_note,'')||case when delivery_note is null then '' else E'\n' end||'Recovery waived: '||v_note,5000),
        updated_at=now()
    where id=v_s.id;

  elsif p_action='cancel' then
    if v_s.status<>'planned' then raise exception 'Only a planned session can be cancelled.'; end if;
    v_to := 'cancelled';
    update public.khpos_ops_young_ceo_sessions
    set status=v_to,cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_s.id;

  else
    raise exception 'Unsupported Young CEO Hub session action.';
  end if;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,session_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_s.cycle_id,v_s.id,p_actor_user_id,
    'session_'||p_action,v_s.status,v_to,left(v_note,4000),
    jsonb_build_object(
      'evidenceReference',v_evidence,
      'recoveryDueDate',p_recovery_due_date,
      'issueId',v_issue
    )
  );
end;
$$;

create or replace function public.khpos_ops_create_young_ceo_venture_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_cycle_id uuid,
  p_name text,
  p_venture_mode text,
  p_problem_statement text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_c public.khpos_ops_young_ceo_cycles%rowtype;
  v_id uuid;
  v_ref text := 'YCV-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  select * into v_c
  from public.khpos_ops_young_ceo_cycles
  where id=p_cycle_id and organisation_id=p_organisation_id;

  if v_c.id is null or v_c.status not in ('planned','active') then
    raise exception 'Venture requires a planned or active Young CEO Hub cycle.';
  end if;

  if not khpos_private.ops_yceo_can_manage(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_yceo_actor_assignment(
    p_actor_user_id,p_organisation_id,v_c.owner_assignment_id
  ) then
    raise exception 'Only the cycle owner or Young CEO Hub coordinating authority can create ventures.';
  end if;

  if p_venture_mode not in ('individual','team') then
    raise exception 'Venture mode must be individual or team.';
  end if;

  if nullif(btrim(coalesce(p_name,'')),'') is null
     or nullif(btrim(coalesce(p_problem_statement,'')),'') is null then
    raise exception 'Venture name and real problem statement are required.';
  end if;

  insert into public.khpos_ops_young_ceo_ventures(
    organisation_id,cycle_id,venture_reference,name,venture_mode,
    problem_statement,created_by
  ) values (
    p_organisation_id,p_cycle_id,v_ref,left(btrim(p_name),180),p_venture_mode,
    left(btrim(p_problem_statement),5000),p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_young_ceo_milestones(
    organisation_id,venture_id,milestone_code,sequence_no,title,expected_evidence
  ) values
    (p_organisation_id,v_id,'problem',1,'Problem','Evidence that the team investigated and clearly defined a real problem rather than starting with a product idea.'),
    (p_organisation_id,v_id,'customer',2,'Customer / User','Evidence that a specific user/customer group was understood through observation, conversation, testing or another appropriate method.'),
    (p_organisation_id,v_id,'solution',3,'Solution','Evidence of a useful proposed response to the validated problem.'),
    (p_organisation_id,v_id,'value_proposition',4,'Value Proposition','Evidence explaining who the solution helps, what value it creates and why the user/customer would care.'),
    (p_organisation_id,v_id,'costing',5,'Costing','Age-appropriate evidence of the resources/costs needed to create or deliver the solution.'),
    (p_organisation_id,v_id,'pricing',6,'Pricing','Evidence that price or exchange value was reasoned from cost, value, affordability and context rather than guessed.'),
    (p_organisation_id,v_id,'communication_pitch',7,'Communication & Pitch','Evidence that the venture can explain the problem, solution and value clearly to another person.'),
    (p_organisation_id,v_id,'selling_test',8,'Selling / Value Test','Evidence of a responsible simulated or approved real-world value/sales test and what was learned.'),
    (p_organisation_id,v_id,'money_management',9,'Money Management','Evidence of responsible record-keeping and understanding of money/value movement. Real transactions remain in Finance/Admin records.'),
    (p_organisation_id,v_id,'iteration',10,'Iteration','Evidence showing what feedback/results changed and how the solution, message, cost, price or approach improved.');

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,venture_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,p_cycle_id,v_id,p_actor_user_id,
    'venture_created','idea',left(btrim(p_name),180)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_update_young_ceo_venture_canvas_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_venture_id uuid,
  p_problem_statement text,
  p_target_customer text,
  p_solution_summary text,
  p_value_proposition text,
  p_sales_mode text,
  p_sales_approval_reference text default null,
  p_finance_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_v public.khpos_ops_young_ceo_ventures%rowtype;
  v_approval text := nullif(btrim(coalesce(p_sales_approval_reference,'')),'');
  v_finance text := nullif(btrim(coalesce(p_finance_reference,'')),'');
begin
  select * into v_v
  from public.khpos_ops_young_ceo_ventures
  where id=p_venture_id and organisation_id=p_organisation_id
  for update;

  if v_v.id is null then raise exception 'Young CEO venture not found.'; end if;
  if v_v.status in ('completed','withdrawn') then
    raise exception 'Completed or withdrawn venture canvas cannot be changed.';
  end if;

  if not khpos_private.ops_yceo_cycle_visible(
    p_actor_user_id,p_organisation_id,v_v.cycle_id
  ) then
    raise exception 'This venture is outside your Young CEO Hub responsibility.';
  end if;

  if p_sales_mode not in ('simulation','internal_school','external_approved') then
    raise exception 'Unsupported Young CEO sales mode.';
  end if;

  if nullif(btrim(coalesce(p_problem_statement,'')),'') is null then
    raise exception 'Venture problem statement is required.';
  end if;

  if p_sales_mode='external_approved' then
    if not khpos_private.ops_yceo_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian or Skill Inspector can approve external Young CEO selling mode.';
    end if;
    if v_approval is null then
      raise exception 'External selling mode requires the applicable school/safeguarding/parent-consent approval reference.';
    end if;
  end if;

  update public.khpos_ops_young_ceo_ventures
  set problem_statement=left(btrim(p_problem_statement),5000),
      target_customer=left(nullif(btrim(coalesce(p_target_customer,'')),''),4000),
      solution_summary=left(nullif(btrim(coalesce(p_solution_summary,'')),''),5000),
      value_proposition=left(nullif(btrim(coalesce(p_value_proposition,'')),''),5000),
      sales_mode=p_sales_mode,
      sales_approval_reference=case
        when p_sales_mode='external_approved' then left(v_approval,1000)
        else null
      end,
      finance_reference=left(v_finance,1000),
      updated_at=now()
  where id=v_v.id;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,venture_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_v.cycle_id,v_v.id,p_actor_user_id,
    'venture_canvas_updated','Venture canvas updated.',
    jsonb_build_object(
      'salesMode',p_sales_mode,
      'salesApprovalReference',case when p_sales_mode='external_approved' then v_approval else null end,
      'financeReference',v_finance
    )
  );
end;
$$;

create or replace function public.khpos_ops_young_ceo_member_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_venture_id uuid,
  p_learner_id uuid,
  p_action text,
  p_member_role text default 'member',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_v public.khpos_ops_young_ceo_ventures%rowtype;
  v_c public.khpos_ops_young_ceo_cycles%rowtype;
  v_member public.khpos_ops_young_ceo_members%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_v
  from public.khpos_ops_young_ceo_ventures
  where id=p_venture_id and organisation_id=p_organisation_id;

  if v_v.id is null or v_v.status in ('completed','withdrawn') then
    raise exception 'Young CEO venture is not open for membership changes.';
  end if;

  select * into v_c
  from public.khpos_ops_young_ceo_cycles where id=v_v.cycle_id;

  if not khpos_private.ops_yceo_cycle_visible(
    p_actor_user_id,p_organisation_id,v_v.cycle_id
  ) then
    raise exception 'This venture is outside your Young CEO Hub responsibility.';
  end if;

  if not khpos_private.ops_hpd_learner_visible(
    p_actor_user_id,p_organisation_id,p_learner_id
  ) then
    raise exception 'This learner is outside your governed visibility.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_learner_anchors l
    where l.id=p_learner_id
      and l.organisation_id=p_organisation_id
      and l.status='active'
      and l.campus_id=v_c.campus_id
  ) then
    raise exception 'Young CEO venture learner must be active in the same campus.';
  end if;

  if p_member_role not in ('lead','member') then
    raise exception 'Young CEO member role must be lead or member.';
  end if;

  select * into v_member
  from public.khpos_ops_young_ceo_members
  where venture_id=p_venture_id and learner_id=p_learner_id
  for update;

  if p_action='add' then
    if exists(
      select 1
      from public.khpos_ops_young_ceo_members other_member
      join public.khpos_ops_young_ceo_ventures other_venture
        on other_venture.id=other_member.venture_id
      where other_member.learner_id=p_learner_id
        and other_member.status='active'
        and other_venture.cycle_id=v_v.cycle_id
        and other_venture.status not in ('completed','withdrawn')
        and other_venture.id<>v_v.id
    ) then
      raise exception 'Learner already has an active venture in this Young CEO Hub cycle.';
    end if;

    if v_v.venture_mode='individual' and exists(
      select 1 from public.khpos_ops_young_ceo_members m
      where m.venture_id=v_v.id and m.status='active'
        and m.learner_id<>p_learner_id
    ) then
      raise exception 'Individual venture can only have one active learner member.';
    end if;

    if v_member.id is null then
      insert into public.khpos_ops_young_ceo_members(
        organisation_id,venture_id,learner_id,member_role,status,joined_by
      ) values (
        p_organisation_id,p_venture_id,p_learner_id,p_member_role,'active',p_actor_user_id
      );
    elsif v_member.status in ('left','completed') then
      update public.khpos_ops_young_ceo_members
      set status='active',member_role=p_member_role,
          joined_by=p_actor_user_id,joined_at=now(),
          left_by=null,left_at=null,leave_note=null,updated_at=now()
      where id=v_member.id;
    else
      update public.khpos_ops_young_ceo_members
      set member_role=p_member_role,updated_at=now()
      where id=v_member.id;
    end if;

  elsif p_action='leave' then
    if v_member.id is null or v_member.status<>'active' then
      raise exception 'Learner is not an active member of this venture.';
    end if;
    if v_note is null then raise exception 'Membership exit reason is required.'; end if;

    update public.khpos_ops_young_ceo_members
    set status='left',left_by=p_actor_user_id,left_at=now(),
        leave_note=left(v_note,4000),updated_at=now()
    where id=v_member.id;

  else
    raise exception 'Unsupported Young CEO venture membership action.';
  end if;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,venture_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_v.cycle_id,v_v.id,p_actor_user_id,
    'member_'||p_action,left(v_note,4000),
    jsonb_build_object('learnerId',p_learner_id,'memberRole',p_member_role)
  );
end;
$$;

create or replace function public.khpos_ops_young_ceo_milestone_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_milestone_id uuid,
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
  v_m public.khpos_ops_young_ceo_milestones%rowtype;
  v_v public.khpos_ops_young_ceo_ventures%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_to text;
begin
  select * into v_m
  from public.khpos_ops_young_ceo_milestones
  where id=p_milestone_id and organisation_id=p_organisation_id
  for update;

  if v_m.id is null then raise exception 'Young CEO venture milestone not found.'; end if;

  select * into v_v
  from public.khpos_ops_young_ceo_ventures where id=v_m.venture_id;

  if v_v.status in ('completed','withdrawn') then
    raise exception 'Completed or withdrawn venture milestones cannot be changed.';
  end if;

  if not khpos_private.ops_yceo_cycle_visible(
    p_actor_user_id,p_organisation_id,v_v.cycle_id
  ) then
    raise exception 'This milestone is outside your Young CEO Hub responsibility.';
  end if;

  if p_action='start' then
    if v_m.status not in ('not_started','returned') then
      raise exception 'Only not-started or returned milestone can be started.';
    end if;
    v_to := 'in_progress';
    update public.khpos_ops_young_ceo_milestones
    set status=v_to,updated_at=now()
    where id=v_m.id;

  elsif p_action='submit_evidence' then
    if v_m.status not in ('not_started','in_progress','returned') then
      raise exception 'Milestone is not ready for evidence submission.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Milestone evidence note and evidence reference are required.';
    end if;
    v_to := 'evidence_submitted';
    update public.khpos_ops_young_ceo_milestones
    set status=v_to,evidence_note=left(v_note,6000),
        evidence_reference=left(v_evidence,1000),
        submitted_by=p_actor_user_id,submitted_at=now(),
        returned_by=null,returned_at=null,return_note=null,updated_at=now()
    where id=v_m.id;

  elsif p_action='verify' then
    if not khpos_private.ops_yceo_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian or Skill Inspector can verify Young CEO venture milestones.';
    end if;
    if v_m.status<>'evidence_submitted' then
      raise exception 'Only submitted milestone evidence can be verified.';
    end if;
    if v_m.submitted_by=p_actor_user_id then
      raise exception 'Milestone evidence submitter cannot verify their own evidence.';
    end if;
    if v_note is null then raise exception 'Milestone verification note is required.'; end if;
    v_to := 'verified';
    update public.khpos_ops_young_ceo_milestones
    set status=v_to,verified_by=p_actor_user_id,verified_at=now(),
        verification_note=left(v_note,4000),updated_at=now()
    where id=v_m.id;

  elsif p_action='return' then
    if not khpos_private.ops_yceo_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian or Skill Inspector can return Young CEO venture milestones.';
    end if;
    if v_m.status<>'evidence_submitted' then
      raise exception 'Only submitted milestone evidence can be returned.';
    end if;
    if v_note is null then raise exception 'Milestone return note is required.'; end if;
    v_to := 'returned';
    update public.khpos_ops_young_ceo_milestones
    set status=v_to,returned_by=p_actor_user_id,returned_at=now(),
        return_note=left(v_note,4000),updated_at=now()
    where id=v_m.id;

  else
    raise exception 'Unsupported Young CEO venture milestone action.';
  end if;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,venture_id,milestone_id,actor_user_id,
    event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_v.cycle_id,v_v.id,v_m.id,p_actor_user_id,
    'milestone_'||p_action,v_m.status,v_to,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence,'milestoneCode',v_m.milestone_code)
  );
end;
$$;

create or replace function public.khpos_ops_young_ceo_venture_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_venture_id uuid,
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
  v_v public.khpos_ops_young_ceo_ventures%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_to text;
begin
  select * into v_v
  from public.khpos_ops_young_ceo_ventures
  where id=p_venture_id and organisation_id=p_organisation_id
  for update;

  if v_v.id is null then raise exception 'Young CEO venture not found.'; end if;

  if not khpos_private.ops_yceo_cycle_visible(
    p_actor_user_id,p_organisation_id,v_v.cycle_id
  ) then
    raise exception 'This venture is outside your Young CEO Hub responsibility.';
  end if;

  if p_action='activate' then
    if v_v.status<>'idea' then raise exception 'Only an idea-stage venture can begin validation.'; end if;
    if not exists(
      select 1 from public.khpos_ops_young_ceo_members m
      where m.venture_id=v_v.id and m.status='active'
    ) then
      raise exception 'Venture needs at least one active learner member before validation begins.';
    end if;
    v_to := 'validating';

  elsif p_action='build' then
    if v_v.status<>'validating' then raise exception 'Only a validating venture can move to building.'; end if;
    if not khpos_private.ops_yceo_milestone_ready(
      v_v.id,array['problem','customer','solution','value_proposition']
    ) then
      raise exception 'Verify Problem, Customer/User, Solution and Value Proposition milestones before building.';
    end if;
    v_to := 'building';

  elsif p_action='test' then
    if v_v.status not in ('building','iterating') then
      raise exception 'Only building or iterating venture can move to testing.';
    end if;
    if not khpos_private.ops_yceo_milestone_ready(
      v_v.id,array['problem','customer','solution','value_proposition']
    ) then
      raise exception 'Core problem/customer/solution/value milestones must remain verified before testing.';
    end if;
    v_to := 'testing';

  elsif p_action='sell' then
    if v_v.status not in ('testing','iterating') then
      raise exception 'Only testing or iterating venture can move to selling/value test.';
    end if;
    if not khpos_private.ops_yceo_milestone_ready(
      v_v.id,array['costing','pricing','communication_pitch','money_management']
    ) then
      raise exception 'Verify Costing, Pricing, Communication/Pitch and Money Management milestones before selling/value test.';
    end if;
    if v_v.sales_mode<>'simulation' and nullif(btrim(coalesce(v_v.finance_reference,'')),'') is null then
      raise exception 'Real-money Young CEO selling requires a Finance/Admin record reference before the selling stage.';
    end if;
    if v_v.sales_mode='external_approved'
       and nullif(btrim(coalesce(v_v.sales_approval_reference,'')),'') is null then
      raise exception 'External selling requires the applicable school/safeguarding/parent-consent approval reference.';
    end if;
    v_to := 'selling';

  elsif p_action='iterate' then
    if v_v.status not in ('testing','selling') then
      raise exception 'Only testing or selling venture can move to iteration.';
    end if;
    v_to := 'iterating';

  elsif p_action='complete' then
    if v_v.status not in ('testing','selling','iterating') then
      raise exception 'Venture must reach testing, selling or iteration before completion.';
    end if;
    if not khpos_private.ops_yceo_milestone_ready(
      v_v.id,array[
        'problem','customer','solution','value_proposition','costing','pricing',
        'communication_pitch','selling_test','money_management','iteration'
      ]
    ) then
      raise exception 'All ten Young CEO venture milestones must be independently verified before completion.';
    end if;
    if v_v.sales_mode<>'simulation'
       and nullif(btrim(coalesce(v_v.finance_reference,'')),'') is null then
      raise exception 'Real-money venture completion requires a Finance/Admin reference.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Venture completion requires a close-out note and evidence reference.';
    end if;
    v_to := 'completed';

  elsif p_action='withdraw' then
    if v_v.status in ('completed','withdrawn') then
      raise exception 'Completed or withdrawn venture cannot be withdrawn.';
    end if;
    if v_note is null then raise exception 'Venture withdrawal reason is required.'; end if;
    v_to := 'withdrawn';

  else
    raise exception 'Unsupported Young CEO venture action.';
  end if;

  if p_action='complete' then
    update public.khpos_ops_young_ceo_ventures
    set status=v_to,completion_note=left(v_note,5000),
        completion_evidence_reference=left(v_evidence,1000),
        completed_by=p_actor_user_id,completed_at=now(),updated_at=now()
    where id=v_v.id;

    update public.khpos_ops_young_ceo_members
    set status='completed',updated_at=now()
    where venture_id=v_v.id and status='active';

  elsif p_action='withdraw' then
    update public.khpos_ops_young_ceo_ventures
    set status=v_to,withdrawn_by=p_actor_user_id,withdrawn_at=now(),
        withdrawal_note=left(v_note,4000),updated_at=now()
    where id=v_v.id;

    update public.khpos_ops_young_ceo_members
    set status='left',left_by=p_actor_user_id,left_at=now(),
        leave_note='Venture withdrawn: '||left(v_note,3000),updated_at=now()
    where venture_id=v_v.id and status='active';
  else
    update public.khpos_ops_young_ceo_ventures
    set status=v_to,updated_at=now()
    where id=v_v.id;
  end if;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,venture_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_v.cycle_id,v_v.id,p_actor_user_id,
    'venture_'||p_action,v_v.status,v_to,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence,'salesMode',v_v.sales_mode)
  );
end;
$$;

create or replace function public.khpos_ops_add_young_ceo_member_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_venture_id uuid,
  p_learner_id uuid,
  p_dimension text,
  p_contribution_note text,
  p_evidence_reference text,
  p_observed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_v public.khpos_ops_young_ceo_ventures%rowtype;
  v_id uuid;
  v_ref text := 'YCE-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  select * into v_v
  from public.khpos_ops_young_ceo_ventures
  where id=p_venture_id and organisation_id=p_organisation_id;

  if v_v.id is null or v_v.status='withdrawn' then
    raise exception 'Young CEO venture is not available for member evidence.';
  end if;

  if not khpos_private.ops_yceo_cycle_visible(
    p_actor_user_id,p_organisation_id,v_v.cycle_id
  ) then
    raise exception 'This venture is outside your Young CEO Hub responsibility.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_young_ceo_members m
    where m.venture_id=v_v.id
      and m.learner_id=p_learner_id
      and m.status in ('active','completed')
  ) then
    raise exception 'Individual value-creation evidence requires an active venture member.';
  end if;

  if p_dimension not in (
    'problem_discovery','customer_understanding','solution_design',
    'value_proposition','costing','pricing','communication','selling',
    'money_management','iteration','collaboration','initiative','resilience','other'
  ) then
    raise exception 'Unsupported Young CEO member-evidence dimension.';
  end if;

  if nullif(btrim(coalesce(p_contribution_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null
     or p_observed_at is null
     or p_observed_at>now()+interval '5 minutes' then
    raise exception 'Individual contribution note, evidence reference and valid observed time are required.';
  end if;

  insert into public.khpos_ops_young_ceo_member_evidence(
    organisation_id,venture_id,learner_id,evidence_reference_code,
    dimension,contribution_note,evidence_reference,observed_at,recorded_by
  ) values (
    p_organisation_id,p_venture_id,p_learner_id,v_ref,p_dimension,
    left(btrim(p_contribution_note),6000),left(btrim(p_evidence_reference),1000),
    p_observed_at,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,venture_id,member_evidence_id,
    actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_v.cycle_id,v_v.id,v_id,p_actor_user_id,
    'member_evidence_submitted','submitted',left(btrim(p_contribution_note),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_young_ceo_member_evidence_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_evidence_id uuid,
  p_action text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_e public.khpos_ops_young_ceo_member_evidence%rowtype;
  v_v public.khpos_ops_young_ceo_ventures%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_potential uuid;
  v_code text;
begin
  select * into v_e
  from public.khpos_ops_young_ceo_member_evidence
  where id=p_evidence_id and organisation_id=p_organisation_id
  for update;

  if v_e.id is null then raise exception 'Young CEO member evidence not found.'; end if;

  select * into v_v
  from public.khpos_ops_young_ceo_ventures where id=v_e.venture_id;

  if v_note is null then raise exception 'Young CEO evidence action note is required.'; end if;

  if p_action='verify' then
    if not khpos_private.ops_yceo_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian or Skill Inspector can verify individual Young CEO evidence.';
    end if;
    if v_e.status<>'submitted' then
      raise exception 'Only submitted individual Young CEO evidence can be verified.';
    end if;
    if v_e.recorded_by=p_actor_user_id then
      raise exception 'Young CEO evidence recorder cannot verify their own evidence.';
    end if;

    v_code := 'YCE-VALUE-'||upper(substr(v_e.id::text,1,8));

    insert into public.khpos_ops_potential_evidence(
      organisation_id,learner_id,term_id,hypothesis_id,evidence_reference_code,
      evidence_type,evidence_origin,title,evidence_note,evidence_reference,
      observed_at,added_by,status
    )
    select
      p_organisation_id,v_e.learner_id,c.term_id,null,v_code,
      'value_creation','school',
      left('Young CEO · '||replace(initcap(v_e.dimension),'_',' '),240),
      left(v_e.contribution_note,5000),
      'khpos://young-ceo/member-evidence/'||v_e.id::text,
      v_e.observed_at,p_actor_user_id,'active'
    from public.khpos_ops_young_ceo_cycles c
    where c.id=v_v.cycle_id
    on conflict (organisation_id,evidence_reference_code) do update
      set evidence_note=excluded.evidence_note,
          observed_at=excluded.observed_at,
          added_by=excluded.added_by,
          status='active'
    returning id into v_potential;

    update public.khpos_ops_young_ceo_member_evidence
    set status='verified',verified_by=p_actor_user_id,verified_at=now(),
        verification_note=left(v_note,4000),potential_evidence_id=v_potential,
        updated_at=now()
    where id=v_e.id;

    insert into public.khpos_ops_potential_events(
      organisation_id,learner_id,term_id,evidence_id,actor_user_id,
      event_type,to_status,note,metadata
    )
    select
      p_organisation_id,v_e.learner_id,c.term_id,v_potential,p_actor_user_id,
      'young_ceo_value_evidence_linked','active',left(v_note,4000),
      jsonb_build_object(
        'youngCeoMemberEvidenceId',v_e.id,
        'ventureId',v_e.venture_id,
        'dimension',v_e.dimension
      )
    from public.khpos_ops_young_ceo_cycles c
    where c.id=v_v.cycle_id;

  elsif p_action='return' then
    if not khpos_private.ops_yceo_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian or Skill Inspector can return individual Young CEO evidence.';
    end if;
    if v_e.status<>'submitted' then
      raise exception 'Only submitted individual Young CEO evidence can be returned.';
    end if;

    update public.khpos_ops_young_ceo_member_evidence
    set status='returned',returned_by=p_actor_user_id,returned_at=now(),
        return_note=left(v_note,4000),updated_at=now()
    where id=v_e.id;

  elsif p_action='withdraw' then
    if v_e.recorded_by<>p_actor_user_id
       and not khpos_private.ops_yceo_can_manage(
         p_actor_user_id,p_organisation_id
       ) then
      raise exception 'Only the recorder or Young CEO Hub coordinating authority can withdraw individual evidence.';
    end if;
    if v_e.status='withdrawn' then
      raise exception 'Young CEO member evidence is already withdrawn.';
    end if;

    update public.khpos_ops_young_ceo_member_evidence
    set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
        withdrawal_reason=left(v_note,4000),updated_at=now()
    where id=v_e.id;

    if v_e.potential_evidence_id is not null then
      update public.khpos_ops_potential_evidence
      set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
          withdrawal_reason='Linked O19 Young CEO evidence withdrawn: '||left(v_note,3400)
      where id=v_e.potential_evidence_id and status='active';
    end if;

  else
    raise exception 'Unsupported Young CEO member-evidence action.';
  end if;

  insert into public.khpos_ops_young_ceo_events(
    organisation_id,cycle_id,venture_id,member_evidence_id,
    actor_user_id,event_type,from_status,to_status,note
  )
  select
    p_organisation_id,v_v.cycle_id,v_v.id,v_e.id,p_actor_user_id,
    'member_evidence_'||p_action,v_e.status,
    (select status from public.khpos_ops_young_ceo_member_evidence where id=v_e.id),
    left(v_note,4000);
end;
$$;

revoke execute on function khpos_private.ops_yceo_can_manage(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_yceo_can_facilitate(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_yceo_valid_owner_assignment(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_yceo_actor_assignment(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_yceo_cycle_visible(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_yceo_milestone_ready(uuid,text[])
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_young_ceo_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_young_ceo_cycle_server(uuid,uuid,uuid,uuid,text,text,uuid,date,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_young_ceo_cycle_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_young_ceo_session_server(uuid,uuid,uuid,date,text,text,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_young_ceo_session_action_server(uuid,uuid,uuid,text,text,text,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_young_ceo_venture_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_update_young_ceo_venture_canvas_server(uuid,uuid,uuid,text,text,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_young_ceo_member_action_server(uuid,uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_young_ceo_milestone_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_young_ceo_venture_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_young_ceo_member_evidence_server(uuid,uuid,uuid,uuid,text,text,text,timestamptz)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_young_ceo_member_evidence_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_yceo_can_manage(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_yceo_can_facilitate(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_yceo_valid_owner_assignment(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_yceo_actor_assignment(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_yceo_cycle_visible(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_yceo_milestone_ready(uuid,text[]) to service_role;

grant execute on function public.khpos_ops_get_young_ceo_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_young_ceo_cycle_server(uuid,uuid,uuid,uuid,text,text,uuid,date,date) to service_role;
grant execute on function public.khpos_ops_young_ceo_cycle_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_young_ceo_session_server(uuid,uuid,uuid,date,text,text,uuid) to service_role;
grant execute on function public.khpos_ops_young_ceo_session_action_server(uuid,uuid,uuid,text,text,text,date) to service_role;
grant execute on function public.khpos_ops_create_young_ceo_venture_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_update_young_ceo_venture_canvas_server(uuid,uuid,uuid,text,text,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_young_ceo_member_action_server(uuid,uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_young_ceo_milestone_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_young_ceo_venture_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_add_young_ceo_member_evidence_server(uuid,uuid,uuid,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.khpos_ops_young_ceo_member_evidence_action_server(uuid,uuid,uuid,text,text) to service_role;
