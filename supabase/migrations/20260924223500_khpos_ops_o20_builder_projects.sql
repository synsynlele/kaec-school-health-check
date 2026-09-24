create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_project_cycles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete restrict,
  campus_id uuid not null references public.khpos_ops_campuses(id) on delete restrict,
  cycle_reference text not null,
  title text not null,
  purpose text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  milestone_schedule jsonb not null,
  status text not null default 'planned'
    check (status in ('planned','active','completed','cancelled')),
  completion_note text,
  evidence_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (organisation_id,cycle_reference)
);

create index if not exists idx_khpos_ops_project_cycles_org
  on public.khpos_ops_project_cycles(organisation_id,term_id,campus_id,status);
create index if not exists idx_khpos_ops_project_cycles_owner
  on public.khpos_ops_project_cycles(owner_assignment_id,status,end_date);

create table if not exists public.khpos_ops_projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  cycle_id uuid not null references public.khpos_ops_project_cycles(id) on delete cascade,
  project_reference text not null,
  project_type text not null
    check (project_type in ('builder_team','personal')),
  title text not null,
  problem_statement text not null,
  intended_beneficiary text,
  solution_hypothesis text,
  mentor_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  learner_shared_pipupath_reference text,
  status text not null default 'idea'
    check (status in (
      'idea','investigating','designing','building','testing',
      'reflecting','defence_ready','defended','completed','withdrawn'
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
  unique (organisation_id,project_reference)
);

create index if not exists idx_khpos_ops_projects_cycle
  on public.khpos_ops_projects(cycle_id,status,created_at desc);
create index if not exists idx_khpos_ops_projects_mentor
  on public.khpos_ops_projects(mentor_assignment_id,status,updated_at desc);

create table if not exists public.khpos_ops_project_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.khpos_ops_projects(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  member_role text not null
    check (member_role in ('owner','lead','member')),
  status text not null default 'active'
    check (status in ('active','completed','left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  left_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  unique (project_id,learner_id)
);

create unique index if not exists uq_khpos_ops_project_active_lead
  on public.khpos_ops_project_members(project_id)
  where member_role='lead' and status='active';
create unique index if not exists uq_khpos_ops_project_active_owner
  on public.khpos_ops_project_members(project_id)
  where member_role='owner' and status='active';
create index if not exists idx_khpos_ops_project_members_learner
  on public.khpos_ops_project_members(learner_id,status,joined_at desc);

create table if not exists public.khpos_ops_project_milestones (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.khpos_ops_projects(id) on delete cascade,
  milestone_code text not null
    check (milestone_code in (
      'problem','investigation','solution_design','build',
      'test','reflection','defence_preparation'
    )),
  sequence_no smallint not null check (sequence_no between 1 and 7),
  title text not null,
  expected_evidence text not null,
  due_date date not null,
  status text not null default 'not_started'
    check (status in (
      'not_started','in_progress','evidence_submitted',
      'verified','returned','missed'
    )),
  evidence_note text,
  evidence_reference text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  verification_note text,
  return_note text,
  recovery_due_date date,
  recovery_status text not null default 'not_required'
    check (recovery_status in ('not_required','required','recovered')),
  issue_id uuid references public.khpos_ops_issues(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (project_id,milestone_code),
  unique (project_id,sequence_no)
);

create index if not exists idx_khpos_ops_project_milestones_project
  on public.khpos_ops_project_milestones(project_id,status,due_date);
create index if not exists idx_khpos_ops_project_milestones_issue
  on public.khpos_ops_project_milestones(issue_id)
  where issue_id is not null;

create table if not exists public.khpos_ops_project_member_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.khpos_ops_projects(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  evidence_reference_code text not null,
  dimension text not null
    check (dimension in (
      'problem_framing','investigation','solution_design','building',
      'testing','collaboration','communication','initiative',
      'resilience','reflection','ownership','other'
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
  return_note text,
  withdrawn_by uuid references auth.users(id) on delete set null,
  withdrawn_at timestamptz,
  withdrawal_note text,
  potential_evidence_id uuid references public.khpos_ops_potential_evidence(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organisation_id,evidence_reference_code)
);

create index if not exists idx_khpos_ops_project_member_evidence_project
  on public.khpos_ops_project_member_evidence(project_id,learner_id,status,observed_at desc);
create index if not exists idx_khpos_ops_project_member_evidence_recorder
  on public.khpos_ops_project_member_evidence(recorded_by,status,created_at desc);
create index if not exists idx_khpos_ops_project_member_evidence_potential
  on public.khpos_ops_project_member_evidence(potential_evidence_id)
  where potential_evidence_id is not null;

create table if not exists public.khpos_ops_project_defences (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.khpos_ops_projects(id) on delete cascade,
  defence_reference text not null,
  attempt_no smallint not null check (attempt_no>=1),
  scheduled_at timestamptz not null,
  location_label text not null,
  panel_reference text not null,
  status text not null default 'planned'
    check (status in ('planned','completed','cancelled')),
  outcome text
    check (outcome is null or outcome in ('completed','showcase_ready','revision_required')),
  panel_feedback text,
  learner_response_summary text,
  evidence_reference text,
  revision_due_date date,
  issue_id uuid references public.khpos_ops_issues(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  unique (organisation_id,defence_reference),
  unique (project_id,attempt_no)
);

create index if not exists idx_khpos_ops_project_defences_project
  on public.khpos_ops_project_defences(project_id,status,scheduled_at);
create index if not exists idx_khpos_ops_project_defences_issue
  on public.khpos_ops_project_defences(issue_id)
  where issue_id is not null;

create table if not exists public.khpos_ops_project_portfolio_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.khpos_ops_projects(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  portfolio_reference_code text not null,
  portfolio_reference text not null,
  share_note text not null,
  share_confirmed boolean not null default false,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted'
    check (status in ('submitted','verified','returned','withdrawn')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  verification_note text,
  return_note text,
  withdrawn_by uuid references auth.users(id) on delete set null,
  withdrawn_at timestamptz,
  withdrawal_note text,
  potential_evidence_id uuid references public.khpos_ops_potential_evidence(id) on delete set null,
  unique (organisation_id,portfolio_reference_code)
);

create index if not exists idx_khpos_ops_project_portfolio_project
  on public.khpos_ops_project_portfolio_links(project_id,learner_id,status,submitted_at desc);
create index if not exists idx_khpos_ops_project_portfolio_potential
  on public.khpos_ops_project_portfolio_links(potential_evidence_id)
  where potential_evidence_id is not null;

create table if not exists public.khpos_ops_project_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  cycle_id uuid references public.khpos_ops_project_cycles(id) on delete cascade,
  project_id uuid references public.khpos_ops_projects(id) on delete cascade,
  milestone_id uuid references public.khpos_ops_project_milestones(id) on delete cascade,
  member_evidence_id uuid references public.khpos_ops_project_member_evidence(id) on delete cascade,
  defence_id uuid references public.khpos_ops_project_defences(id) on delete cascade,
  portfolio_link_id uuid references public.khpos_ops_project_portfolio_links(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    num_nonnulls(
      cycle_id,project_id,milestone_id,member_evidence_id,defence_id,portfolio_link_id
    )>=1
  )
);

create index if not exists idx_khpos_ops_project_events_cycle
  on public.khpos_ops_project_events(cycle_id,created_at desc)
  where cycle_id is not null;
create index if not exists idx_khpos_ops_project_events_project
  on public.khpos_ops_project_events(project_id,created_at desc)
  where project_id is not null;
create index if not exists idx_khpos_ops_project_events_milestone
  on public.khpos_ops_project_events(milestone_id,created_at desc)
  where milestone_id is not null;
create index if not exists idx_khpos_ops_project_events_evidence
  on public.khpos_ops_project_events(member_evidence_id,created_at desc)
  where member_evidence_id is not null;
create index if not exists idx_khpos_ops_project_events_defence
  on public.khpos_ops_project_events(defence_id,created_at desc)
  where defence_id is not null;
create index if not exists idx_khpos_ops_project_events_portfolio
  on public.khpos_ops_project_events(portfolio_link_id,created_at desc)
  where portfolio_link_id is not null;

alter table public.khpos_ops_project_cycles enable row level security;
alter table public.khpos_ops_projects enable row level security;
alter table public.khpos_ops_project_members enable row level security;
alter table public.khpos_ops_project_milestones enable row level security;
alter table public.khpos_ops_project_member_evidence enable row level security;
alter table public.khpos_ops_project_defences enable row level security;
alter table public.khpos_ops_project_portfolio_links enable row level security;
alter table public.khpos_ops_project_events enable row level security;

revoke all privileges on table public.khpos_ops_project_cycles from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_projects from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_project_members from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_project_milestones from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_project_member_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_project_defences from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_project_portfolio_links from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_project_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_project_cycles to service_role;
grant select,insert,update,delete on table public.khpos_ops_projects to service_role;
grant select,insert,update,delete on table public.khpos_ops_project_members to service_role;
grant select,insert,update,delete on table public.khpos_ops_project_milestones to service_role;
grant select,insert,update,delete on table public.khpos_ops_project_member_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_project_defences to service_role;
grant select,insert,update,delete on table public.khpos_ops_project_portfolio_links to service_role;
grant select,insert,update,delete on table public.khpos_ops_project_events to service_role;

create or replace function khpos_private.ops_project_actor_has_role(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_role_codes text[]
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
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
$function$;

create or replace function khpos_private.ops_project_can_manage(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
  select khpos_private.ops_project_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR']::text[]
  );
$function$;

create or replace function khpos_private.ops_project_can_verify(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
  select khpos_private.ops_project_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SECTIONAL_PROMOTER']::text[]
  );
$function$;

create or replace function khpos_private.ops_project_can_facilitate(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
  select khpos_private.ops_project_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array[
      'SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR',
      'SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR'
    ]::text[]
  );
$function$;

create or replace function khpos_private.ops_project_actor_assignment(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
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
$function$;

create or replace function khpos_private.ops_project_schedule_valid(
  p_schedule jsonb,
  p_start_date date,
  p_end_date date
)
returns boolean
language plpgsql
immutable
as $function$
declare
  v_codes text[] := array[
    'problem','investigation','solution_design','build',
    'test','reflection','defence_preparation'
  ];
  v_code text;
  v_prev date := p_start_date;
  v_date date;
begin
  if p_schedule is null or jsonb_typeof(p_schedule)<>'object' then
    return false;
  end if;

  foreach v_code in array v_codes loop
    begin
      v_date := (p_schedule->>v_code)::date;
    exception when others then
      return false;
    end;

    if v_date is null or v_date<p_start_date or v_date>p_end_date or v_date<v_prev then
      return false;
    end if;

    v_prev := v_date;
  end loop;

  return true;
end;
$function$;

create or replace function khpos_private.ops_project_visible(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
  select exists(
    select 1
    from public.khpos_ops_projects p
    join public.khpos_ops_project_cycles c on c.id=p.cycle_id
    where p.id=p_project_id
      and p.organisation_id=p_organisation_id
      and (
        khpos_private.ops_project_can_manage(
          p_actor_user_id,p_organisation_id
        )
        or khpos_private.ops_project_actor_assignment(
          p_actor_user_id,p_organisation_id,p.mentor_assignment_id
        )
        or exists(
          select 1
          from public.khpos_ops_role_assignments a
          join public.khpos_ops_roles r on r.id=a.role_id
          where a.user_id=p_actor_user_id
            and a.status='active'
            and r.organisation_id=p_organisation_id
            and r.status='active'
            and r.code in ('SECTIONAL_PROMOTER','TEACHER','SKILL_INSPECTOR','SKILLS_FACILITATOR')
            and (a.campus_id is null or a.campus_id=c.campus_id)
        )
      )
  );
$function$;

create or replace function public.khpos_ops_get_builder_projects_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_org_name text;
  v_member_role text;
  v_can_manage boolean;
  v_can_verify boolean;
  v_can_facilitate boolean;
  v_is_executive boolean;
  v_terms jsonb := '[]'::jsonb;
  v_campuses jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
  v_cycles jsonb := '[]'::jsonb;
  v_projects jsonb := '[]'::jsonb;
begin
  if not khpos_private.ops_hpd_has_membership(
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

  v_can_manage := khpos_private.ops_project_can_manage(
    p_actor_user_id,p_organisation_id
  );
  v_can_verify := khpos_private.ops_project_can_verify(
    p_actor_user_id,p_organisation_id
  );
  v_can_facilitate := khpos_private.ops_project_can_facilitate(
    p_actor_user_id,p_organisation_id
  );
  v_is_executive := exists(
    select 1
    from public.organisation_memberships m
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and m.role='executive'
  ) and not v_can_facilitate;

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
  where c.organisation_id=p_organisation_id
    and c.status='active';

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
        'SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR',
        'SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR'
      );
  end if;

  if not v_is_executive and (v_can_facilitate or v_can_manage) then
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
      'endDate',c.end_date,'milestoneSchedule',c.milestone_schedule,
      'status',c.status,'completionNote',c.completion_note,
      'evidenceReference',c.evidence_reference,
      'isOwner',khpos_private.ops_project_actor_assignment(
        p_actor_user_id,p_organisation_id,c.owner_assignment_id
      ),
      'canManage',v_can_manage
    ) order by c.start_date desc,c.created_at desc),'[]'::jsonb)
    into v_cycles
    from public.khpos_ops_project_cycles c
    where c.organisation_id=p_organisation_id
      and (
        v_can_manage
        or khpos_private.ops_project_actor_assignment(
          p_actor_user_id,p_organisation_id,c.owner_assignment_id
        )
        or exists(
          select 1
          from public.khpos_ops_role_assignments a
          join public.khpos_ops_roles r on r.id=a.role_id
          where a.user_id=p_actor_user_id
            and a.status='active'
            and r.organisation_id=p_organisation_id
            and (a.campus_id is null or a.campus_id=c.campus_id)
            and r.code in ('SECTIONAL_PROMOTER','TEACHER','SKILL_INSPECTOR','SKILLS_FACILITATOR')
        )
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'reference',p.project_reference,'cycleId',p.cycle_id,
      'projectType',p.project_type,'title',p.title,
      'problemStatement',p.problem_statement,
      'intendedBeneficiary',p.intended_beneficiary,
      'solutionHypothesis',p.solution_hypothesis,
      'mentorAssignmentId',p.mentor_assignment_id,
      'learnerSharedPipupathReference',p.learner_shared_pipupath_reference,
      'status',p.status,'completionNote',p.completion_note,
      'completionEvidenceReference',p.completion_evidence_reference,
      'canManage',v_can_manage,
      'canVerify',v_can_verify,
      'isMentor',khpos_private.ops_project_actor_assignment(
        p_actor_user_id,p_organisation_id,p.mentor_assignment_id
      ),
      'members',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',m.id,'learnerId',m.learner_id,'learnerName',l.display_name,
          'memberRole',m.member_role,'status',m.status,
          'joinedAt',m.joined_at,'leftAt',m.left_at
        ) order by l.display_name)
        from public.khpos_ops_project_members m
        join public.khpos_ops_learner_anchors l on l.id=m.learner_id
        where m.project_id=p.id
      ),'[]'::jsonb),
      'milestones',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',ms.id,'milestoneCode',ms.milestone_code,'sequenceNo',ms.sequence_no,
          'title',ms.title,'expectedEvidence',ms.expected_evidence,
          'dueDate',ms.due_date,'status',ms.status,
          'evidenceNote',ms.evidence_note,'evidenceReference',ms.evidence_reference,
          'submittedBy',ms.submitted_by,'verifiedBy',ms.verified_by,
          'verifiedAt',ms.verified_at,'verificationNote',ms.verification_note,
          'returnNote',ms.return_note,'recoveryDueDate',ms.recovery_due_date,
          'recoveryStatus',ms.recovery_status,'issueId',ms.issue_id,
          'canVerify',v_can_verify and ms.submitted_by is distinct from p_actor_user_id
        ) order by ms.sequence_no)
        from public.khpos_ops_project_milestones ms
        where ms.project_id=p.id
      ),'[]'::jsonb),
      'memberEvidence',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',e.id,'learnerId',e.learner_id,'learnerName',l.display_name,
          'referenceCode',e.evidence_reference_code,'dimension',e.dimension,
          'contributionNote',e.contribution_note,
          'evidenceReference',e.evidence_reference,'observedAt',e.observed_at,
          'status',e.status,'potentialEvidenceId',e.potential_evidence_id,
          'isRecorder',e.recorded_by=p_actor_user_id,
          'canVerify',v_can_verify and e.recorded_by is distinct from p_actor_user_id
        ) order by e.observed_at desc)
        from public.khpos_ops_project_member_evidence e
        join public.khpos_ops_learner_anchors l on l.id=e.learner_id
        where e.project_id=p.id
      ),'[]'::jsonb),
      'defences',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',d.id,'reference',d.defence_reference,'attemptNo',d.attempt_no,
          'scheduledAt',d.scheduled_at,'locationLabel',d.location_label,
          'panelReference',d.panel_reference,'status',d.status,
          'outcome',d.outcome,'panelFeedback',d.panel_feedback,
          'learnerResponseSummary',d.learner_response_summary,
          'evidenceReference',d.evidence_reference,
          'revisionDueDate',d.revision_due_date,'issueId',d.issue_id
        ) order by d.attempt_no desc)
        from public.khpos_ops_project_defences d
        where d.project_id=p.id
      ),'[]'::jsonb),
      'portfolioLinks',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',pl.id,'learnerId',pl.learner_id,'learnerName',l.display_name,
          'referenceCode',pl.portfolio_reference_code,
          'portfolioReference',pl.portfolio_reference,
          'shareNote',pl.share_note,'shareConfirmed',pl.share_confirmed,
          'status',pl.status,'potentialEvidenceId',pl.potential_evidence_id,
          'isSubmitter',pl.submitted_by=p_actor_user_id,
          'canVerify',v_can_verify and pl.submitted_by is distinct from p_actor_user_id
        ) order by pl.submitted_at desc)
        from public.khpos_ops_project_portfolio_links pl
        join public.khpos_ops_learner_anchors l on l.id=pl.learner_id
        where pl.project_id=p.id
      ),'[]'::jsonb)
    ) order by p.created_at desc),'[]'::jsonb)
    into v_projects
    from public.khpos_ops_projects p
    where p.organisation_id=p_organisation_id
      and khpos_private.ops_project_visible(
        p_actor_user_id,p_organisation_id,p.id
      );
  end if;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canManage',v_can_manage,
    'canVerify',v_can_verify,
    'canFacilitate',v_can_facilitate,
    'executiveAggregateOnly',v_is_executive,
    'principle','Builder Projects turn meaningful problems into investigated, built, tested and defended solutions. Personal Projects give one learner end-to-end ownership. Team success never becomes automatic evidence for every member.',
    'pipupathBoundary','PipuPath remains the learner-facing project, reflection and portfolio space. KHP-OS never pulls private PipuPath content; it stores only institutional execution and deliberately shared references.',
    'defenceBoundary','Builder Defence verifies the problem, investigation, reasoning, build/test evidence and reflection. It is not a popularity contest, beauty pageant or single numerical score.',
    'terms',v_terms,
    'campuses',v_campuses,
    'assignments',v_assignments,
    'learners',v_learners,
    'cycles',v_cycles,
    'projects',v_projects,
    'summary',jsonb_build_object(
      'activeCycles',(
        select count(*) from public.khpos_ops_project_cycles c
        where c.organisation_id=p_organisation_id and c.status='active'
      ),
      'activeProjects',(
        select count(*) from public.khpos_ops_projects p
        where p.organisation_id=p_organisation_id
          and p.status not in ('completed','withdrawn')
      ),
      'defenceReady',(
        select count(*) from public.khpos_ops_projects p
        where p.organisation_id=p_organisation_id and p.status='defence_ready'
      ),
      'missedMilestones',(
        select count(*)
        from public.khpos_ops_project_milestones ms
        join public.khpos_ops_projects p on p.id=ms.project_id
        where p.organisation_id=p_organisation_id
          and ms.status='missed' and ms.recovery_status='required'
      ),
      'submittedIndividualEvidence',(
        select count(*) from public.khpos_ops_project_member_evidence e
        where e.organisation_id=p_organisation_id and e.status='submitted'
      ),
      'verifiedIndividualEvidence',(
        select count(*) from public.khpos_ops_project_member_evidence e
        where e.organisation_id=p_organisation_id and e.status='verified'
      )
    )
  );
end;
$function$;

create or replace function public.khpos_ops_create_project_cycle_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_campus_id uuid,
  p_title text,
  p_purpose text,
  p_owner_assignment_id uuid,
  p_start_date date,
  p_end_date date,
  p_milestone_schedule jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_id uuid;
  v_ref text := 'PJC-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_project_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only School Guardian or Academic Inspector can create Builder Project cycles.';
  end if;

  if not khpos_private.ops_hpd_active_term(
    p_organisation_id,p_term_id,false
  ) then
    raise exception 'Builder Project cycle requires an active academic term.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_campuses c
    where c.id=p_campus_id and c.organisation_id=p_organisation_id and c.status='active'
  ) then
    raise exception 'Builder Project cycle requires an active campus.';
  end if;

  if not khpos_private.ops_hpd_valid_owner_assignment(
    p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'Builder Project cycle owner assignment is invalid.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_purpose,'')),'') is null then
    raise exception 'Project-cycle title and purpose are required.';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then
    raise exception 'Project-cycle dates are invalid.';
  end if;

  if not khpos_private.ops_project_schedule_valid(
    p_milestone_schedule,p_start_date,p_end_date
  ) then
    raise exception 'Project milestone schedule must contain all seven ordered milestone dates within the cycle.';
  end if;

  insert into public.khpos_ops_project_cycles(
    organisation_id,term_id,campus_id,cycle_reference,title,purpose,
    owner_assignment_id,start_date,end_date,milestone_schedule,created_by
  ) values (
    p_organisation_id,p_term_id,p_campus_id,v_ref,left(btrim(p_title),200),
    left(btrim(p_purpose),5000),p_owner_assignment_id,p_start_date,p_end_date,
    p_milestone_schedule,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_project_events(
    organisation_id,cycle_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'project_cycle_created',
    'planned',left(btrim(p_purpose),4000)
  );

  return v_id;
end;
$function$;

create or replace function public.khpos_ops_project_cycle_action_server(
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
as $function$
declare
  v_c public.khpos_ops_project_cycles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_to text;
begin
  select * into v_c
  from public.khpos_ops_project_cycles
  where id=p_cycle_id and organisation_id=p_organisation_id
  for update;

  if v_c.id is null then raise exception 'Builder Project cycle not found.'; end if;

  if not khpos_private.ops_project_can_manage(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_project_actor_assignment(
    p_actor_user_id,p_organisation_id,v_c.owner_assignment_id
  ) then
    raise exception 'Only the cycle owner or project coordinating authority can change this cycle.';
  end if;

  if p_action='activate' then
    if v_c.status<>'planned' then raise exception 'Only a planned project cycle can be activated.'; end if;
    v_to := 'active';
    update public.khpos_ops_project_cycles
    set status=v_to,activated_by=p_actor_user_id,activated_at=now(),updated_at=now()
    where id=v_c.id;

  elsif p_action='complete' then
    if v_c.status<>'active' then raise exception 'Only an active project cycle can be completed.'; end if;
    if not khpos_private.ops_project_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian or Academic Inspector can complete a project cycle.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Project-cycle completion requires close-out note and evidence reference.';
    end if;
    if exists(
      select 1 from public.khpos_ops_projects p
      where p.cycle_id=v_c.id and p.status not in ('completed','withdrawn')
    ) then
      raise exception 'Complete or withdraw every active project before cycle close-out.';
    end if;
    if exists(
      select 1
      from public.khpos_ops_project_defences d
      join public.khpos_ops_projects p on p.id=d.project_id
      where p.cycle_id=v_c.id and d.status='planned'
    ) then
      raise exception 'Resolve planned Builder Defence attempts before cycle close-out.';
    end if;
    v_to := 'completed';
    update public.khpos_ops_project_cycles
    set status=v_to,completion_note=left(v_note,5000),
        evidence_reference=left(v_evidence,1000),
        completed_by=p_actor_user_id,completed_at=now(),updated_at=now()
    where id=v_c.id;

  elsif p_action='cancel' then
    if v_c.status not in ('planned','active') then
      raise exception 'Only a planned or active project cycle can be cancelled.';
    end if;
    if not khpos_private.ops_project_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian or Academic Inspector can cancel a project cycle.';
    end if;
    if v_note is null then raise exception 'Project-cycle cancellation reason is required.'; end if;
    if exists(
      select 1 from public.khpos_ops_projects p
      where p.cycle_id=v_c.id and p.status not in ('completed','withdrawn')
    ) then
      raise exception 'Withdraw active projects before cancelling their cycle.';
    end if;
    v_to := 'cancelled';
    update public.khpos_ops_project_cycles
    set status=v_to,cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_c.id;

  else
    raise exception 'Unsupported project-cycle action.';
  end if;

  insert into public.khpos_ops_project_events(
    organisation_id,cycle_id,actor_user_id,event_type,from_status,to_status,note,
    metadata
  ) values (
    p_organisation_id,v_c.id,p_actor_user_id,'project_cycle_'||p_action,
    v_c.status,v_to,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence)
  );
end;
$function$;

create or replace function public.khpos_ops_create_builder_project_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_cycle_id uuid,
  p_project_type text,
  p_title text,
  p_problem_statement text,
  p_intended_beneficiary text,
  p_mentor_assignment_id uuid,
  p_learner_shared_pipupath_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_c public.khpos_ops_project_cycles%rowtype;
  v_id uuid;
  v_ref text := 'PRJ-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  select * into v_c
  from public.khpos_ops_project_cycles
  where id=p_cycle_id and organisation_id=p_organisation_id;

  if v_c.id is null or v_c.status not in ('planned','active') then
    raise exception 'Project requires a planned or active Builder Project cycle.';
  end if;

  if not khpos_private.ops_project_can_manage(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_project_actor_assignment(
    p_actor_user_id,p_organisation_id,v_c.owner_assignment_id
  ) then
    raise exception 'Only the cycle owner or project coordinating authority can create projects.';
  end if;

  if p_project_type not in ('builder_team','personal') then
    raise exception 'Project type must be builder_team or personal.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_problem_statement,'')),'') is null then
    raise exception 'Project title and meaningful problem statement are required.';
  end if;

  if not khpos_private.ops_hpd_valid_owner_assignment(
    p_organisation_id,p_mentor_assignment_id
  ) then
    raise exception 'Project mentor assignment is invalid.';
  end if;

  insert into public.khpos_ops_projects(
    organisation_id,cycle_id,project_reference,project_type,title,
    problem_statement,intended_beneficiary,mentor_assignment_id,
    learner_shared_pipupath_reference,created_by
  ) values (
    p_organisation_id,p_cycle_id,v_ref,p_project_type,left(btrim(p_title),200),
    left(btrim(p_problem_statement),5000),
    left(nullif(btrim(coalesce(p_intended_beneficiary,'')),''),2000),
    p_mentor_assignment_id,
    left(nullif(btrim(coalesce(p_learner_shared_pipupath_reference,'')),''),1000),
    p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_project_milestones(
    organisation_id,project_id,milestone_code,sequence_no,title,
    expected_evidence,due_date
  ) values
    (p_organisation_id,v_id,'problem',1,'Problem','Evidence that learners investigated and clearly framed a meaningful problem before selecting a solution.',(v_c.milestone_schedule->>'problem')::date),
    (p_organisation_id,v_id,'investigation',2,'Investigation','Evidence of research, observation, interviews, data, examples or other appropriate investigation of the problem and context.',(v_c.milestone_schedule->>'investigation')::date),
    (p_organisation_id,v_id,'solution_design',3,'Solution Design','Evidence showing why the proposed response follows from the investigation, including intended beneficiary and design reasoning.',(v_c.milestone_schedule->>'solution_design')::date),
    (p_organisation_id,v_id,'build',4,'Build','Evidence of a real prototype, artefact, service, campaign, experiment, event, media output or other concrete project build.',(v_c.milestone_schedule->>'build')::date),
    (p_organisation_id,v_id,'test',5,'Test','Evidence that the build was tested, used, reviewed or challenged and that feedback/results were captured.',(v_c.milestone_schedule->>'test')::date),
    (p_organisation_id,v_id,'reflection',6,'Reflection','Evidence of what worked, what failed, what changed, individual learning and the project''s limitations.',(v_c.milestone_schedule->>'reflection')::date),
    (p_organisation_id,v_id,'defence_preparation',7,'Defence Preparation','Evidence that the project can explain the problem, investigation, reasoning, build/test results, contribution and reflection without relying on showmanship.',(v_c.milestone_schedule->>'defence_preparation')::date);

  insert into public.khpos_ops_project_events(
    organisation_id,cycle_id,project_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_c.id,v_id,p_actor_user_id,'project_created','idea',
    left(btrim(p_problem_statement),4000)
  );

  return v_id;
end;
$function$;

create or replace function public.khpos_ops_update_builder_project_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_project_id uuid,
  p_problem_statement text,
  p_intended_beneficiary text,
  p_solution_hypothesis text,
  p_learner_shared_pipupath_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_p public.khpos_ops_projects%rowtype;
begin
  select * into v_p
  from public.khpos_ops_projects
  where id=p_project_id and organisation_id=p_organisation_id
  for update;

  if v_p.id is null then raise exception 'Project not found.'; end if;

  if not khpos_private.ops_project_can_manage(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_project_actor_assignment(
    p_actor_user_id,p_organisation_id,v_p.mentor_assignment_id
  ) then
    raise exception 'Only the project mentor or coordinating authority can update this project.';
  end if;

  if v_p.status in ('completed','withdrawn') then
    raise exception 'Completed or withdrawn projects cannot be edited.';
  end if;

  if nullif(btrim(coalesce(p_problem_statement,'')),'') is null then
    raise exception 'Project problem statement is required.';
  end if;

  update public.khpos_ops_projects
  set problem_statement=left(btrim(p_problem_statement),5000),
      intended_beneficiary=left(nullif(btrim(coalesce(p_intended_beneficiary,'')),''),2000),
      solution_hypothesis=left(nullif(btrim(coalesce(p_solution_hypothesis,'')),''),5000),
      learner_shared_pipupath_reference=left(nullif(btrim(coalesce(p_learner_shared_pipupath_reference,'')),''),1000),
      updated_at=now()
  where id=v_p.id;

  insert into public.khpos_ops_project_events(
    organisation_id,project_id,actor_user_id,event_type,note
  ) values (
    p_organisation_id,v_p.id,p_actor_user_id,'project_updated',
    'Project problem/beneficiary/solution/shared-reference details updated.'
  );
end;
$function$;

create or replace function public.khpos_ops_project_member_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_project_id uuid,
  p_learner_id uuid,
  p_action text,
  p_member_role text default 'member',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_p public.khpos_ops_projects%rowtype;
  v_c public.khpos_ops_project_cycles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_p
  from public.khpos_ops_projects
  where id=p_project_id and organisation_id=p_organisation_id
  for update;

  if v_p.id is null then raise exception 'Project not found.'; end if;

  select * into v_c from public.khpos_ops_project_cycles where id=v_p.cycle_id;

  if not khpos_private.ops_project_can_manage(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_project_actor_assignment(
    p_actor_user_id,p_organisation_id,v_p.mentor_assignment_id
  ) then
    raise exception 'Only the project mentor or coordinating authority can manage project membership.';
  end if;

  if not khpos_private.ops_hpd_learner_visible(
    p_actor_user_id,p_organisation_id,p_learner_id
  ) then
    raise exception 'This learner is outside your governed visibility.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_learner_anchors l
    where l.id=p_learner_id and l.organisation_id=p_organisation_id
      and l.status='active' and l.campus_id=v_c.campus_id
  ) then
    raise exception 'Project member must be an active learner on the project campus.';
  end if;

  if p_action='add' then
    if v_p.status not in ('idea','investigating') then
      raise exception 'Project membership can only be added during idea/investigation stage.';
    end if;

    if v_p.project_type='personal' then
      if p_member_role<>'owner' then
        raise exception 'Personal Project member role must be owner.';
      end if;
      if exists(
        select 1 from public.khpos_ops_project_members m
        where m.project_id=v_p.id and m.status='active'
          and m.learner_id<>p_learner_id
      ) then
        raise exception 'Personal Project may have only one active learner owner.';
      end if;
    else
      if p_member_role not in ('lead','member') then
        raise exception 'Builder Project team member role must be lead or member.';
      end if;
    end if;

    insert into public.khpos_ops_project_members(
      organisation_id,project_id,learner_id,member_role,status,created_by
    ) values (
      p_organisation_id,v_p.id,p_learner_id,p_member_role,'active',p_actor_user_id
    )
    on conflict (project_id,learner_id) do update
      set member_role=excluded.member_role,status='active',left_at=null,left_note=null;

  elsif p_action='leave' then
    if v_p.status in ('defence_ready','defended','completed','withdrawn') then
      raise exception 'Project membership cannot change after defence readiness.';
    end if;
    if v_note is null then raise exception 'Member departure note is required.'; end if;

    update public.khpos_ops_project_members
    set status='left',left_at=now(),left_note=left(v_note,3000)
    where project_id=v_p.id and learner_id=p_learner_id and status='active';

    if not found then raise exception 'Active project member not found.'; end if;

  else
    raise exception 'Unsupported project-member action.';
  end if;

  insert into public.khpos_ops_project_events(
    organisation_id,project_id,actor_user_id,event_type,note,
    metadata
  ) values (
    p_organisation_id,v_p.id,p_actor_user_id,'project_member_'||p_action,
    left(v_note,3000),
    jsonb_build_object('learnerId',p_learner_id,'memberRole',p_member_role)
  );
end;
$function$;

create or replace function public.khpos_ops_project_milestone_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_milestone_id uuid,
  p_action text,
  p_note text default null,
  p_evidence_reference text default null,
  p_recovery_due_date date default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_m public.khpos_ops_project_milestones%rowtype;
  v_p public.khpos_ops_projects%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_issue uuid;
  v_to text;
begin
  select * into v_m
  from public.khpos_ops_project_milestones
  where id=p_milestone_id and organisation_id=p_organisation_id
  for update;

  if v_m.id is null then raise exception 'Project milestone not found.'; end if;

  select * into v_p
  from public.khpos_ops_projects
  where id=v_m.project_id and organisation_id=p_organisation_id;

  if not khpos_private.ops_project_visible(
    p_actor_user_id,p_organisation_id,v_p.id
  ) then
    raise exception 'This project is outside your governed visibility.';
  end if;

  if p_action='start' then
    if not khpos_private.ops_project_actor_assignment(
      p_actor_user_id,p_organisation_id,v_p.mentor_assignment_id
    ) and not khpos_private.ops_project_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only the mentor or coordinating authority can start project milestones.';
    end if;
    if v_m.status not in ('not_started','returned') then
      raise exception 'Only a not-started or returned milestone can be started.';
    end if;
    v_to := 'in_progress';
    update public.khpos_ops_project_milestones
    set status=v_to,updated_at=now()
    where id=v_m.id;

  elsif p_action='submit_evidence' then
    if not khpos_private.ops_project_actor_assignment(
      p_actor_user_id,p_organisation_id,v_p.mentor_assignment_id
    ) and not khpos_private.ops_project_can_manage(
      p_actor_user_id,p_organisation_id
    ) and not khpos_private.ops_project_can_facilitate(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Your operating role cannot submit project milestone evidence.';
    end if;
    if v_m.status not in ('not_started','in_progress','returned','missed') then
      raise exception 'This project milestone cannot accept evidence in its current state.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Project milestone evidence note and reference are required.';
    end if;
    v_to := 'evidence_submitted';
    update public.khpos_ops_project_milestones
    set status=v_to,evidence_note=left(v_note,5000),
        evidence_reference=left(v_evidence,1000),
        submitted_by=p_actor_user_id,submitted_at=now(),updated_at=now()
    where id=v_m.id;

  elsif p_action='verify' then
    if not khpos_private.ops_project_can_verify(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian, Academic Inspector or Sectional Promoter can verify project milestones.';
    end if;
    if v_m.status<>'evidence_submitted' then
      raise exception 'Only submitted project milestone evidence can be verified.';
    end if;
    if v_m.submitted_by=p_actor_user_id then
      raise exception 'Project milestone evidence submitter cannot verify their own evidence.';
    end if;
    if v_note is null then raise exception 'Project milestone verification note is required.'; end if;
    v_to := 'verified';
    update public.khpos_ops_project_milestones
    set status=v_to,verified_by=p_actor_user_id,verified_at=now(),
        verification_note=left(v_note,4000),
        recovery_status=case when recovery_status='required' then 'recovered' else recovery_status end,
        updated_at=now()
    where id=v_m.id;

  elsif p_action='return' then
    if not khpos_private.ops_project_can_verify(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only project verification authority can return evidence.';
    end if;
    if v_m.status<>'evidence_submitted' then
      raise exception 'Only submitted project milestone evidence can be returned.';
    end if;
    if v_note is null then raise exception 'Return reason is required.'; end if;
    v_to := 'returned';
    update public.khpos_ops_project_milestones
    set status=v_to,return_note=left(v_note,4000),updated_at=now()
    where id=v_m.id;

  elsif p_action='miss' then
    if not khpos_private.ops_project_actor_assignment(
      p_actor_user_id,p_organisation_id,v_p.mentor_assignment_id
    ) and not khpos_private.ops_project_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only the mentor or coordinating authority can mark a missed milestone.';
    end if;
    if v_m.status not in ('not_started','in_progress','returned') then
      raise exception 'Only an unresolved project milestone can be marked missed.';
    end if;
    if current_date<=v_m.due_date then
      raise exception 'Project milestone cannot be marked missed before its due date has passed.';
    end if;
    if p_recovery_due_date is null or p_recovery_due_date<current_date then
      raise exception 'Missed project milestone requires a recovery due date.';
    end if;
    if v_note is null then raise exception 'Missed milestone note is required.'; end if;

    v_issue := public.khpos_ops_create_issue_server(
      p_actor_user_id,p_organisation_id,
      'Missed Builder Project milestone · '||v_m.title,
      'Required project milestone was missed. Recovery due '
        ||p_recovery_due_date::text||'. '||v_note,
      'human_potential_development','P3',
      (p_recovery_due_date::timestamptz + interval '17 hours')
    );

    v_to := 'missed';
    update public.khpos_ops_project_milestones
    set status=v_to,recovery_due_date=p_recovery_due_date,
        recovery_status='required',issue_id=v_issue,updated_at=now()
    where id=v_m.id;

  else
    raise exception 'Unsupported project-milestone action.';
  end if;

  insert into public.khpos_ops_project_events(
    organisation_id,project_id,milestone_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_p.id,v_m.id,p_actor_user_id,
    'project_milestone_'||p_action,v_m.status,v_to,left(v_note,4000),
    jsonb_build_object(
      'evidenceReference',v_evidence,
      'recoveryDueDate',p_recovery_due_date,
      'issueId',v_issue
    )
  );
end;
$function$;

create or replace function public.khpos_ops_builder_project_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_project_id uuid,
  p_action text,
  p_note text default null,
  p_evidence_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_p public.khpos_ops_projects%rowtype;
  v_c public.khpos_ops_project_cycles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_count integer;
  v_to text;
begin
  select * into v_p
  from public.khpos_ops_projects
  where id=p_project_id and organisation_id=p_organisation_id
  for update;

  if v_p.id is null then raise exception 'Project not found.'; end if;
  select * into v_c from public.khpos_ops_project_cycles where id=v_p.cycle_id;

  if not khpos_private.ops_project_can_manage(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_project_actor_assignment(
    p_actor_user_id,p_organisation_id,v_p.mentor_assignment_id
  ) then
    raise exception 'Only project mentor or coordinating authority can move project stage.';
  end if;

  if p_action='activate' then
    if v_p.status<>'idea' then raise exception 'Only an idea-stage project can begin investigation.'; end if;
    if v_c.status<>'active' then raise exception 'Project cycle must be active before project work begins.'; end if;
    select count(*) into v_count
    from public.khpos_ops_project_members m
    where m.project_id=v_p.id and m.status='active';

    if v_p.project_type='personal' and v_count<>1 then
      raise exception 'Personal Project requires exactly one active learner owner before activation.';
    end if;
    if v_p.project_type='builder_team' and v_count<2 then
      raise exception 'Builder Project team requires at least two active learners before activation.';
    end if;
    if v_p.project_type='personal' and not exists(
      select 1 from public.khpos_ops_project_members m
      where m.project_id=v_p.id and m.status='active' and m.member_role='owner'
    ) then
      raise exception 'Personal Project requires an owner member.';
    end if;
    if v_p.project_type='builder_team' and not exists(
      select 1 from public.khpos_ops_project_members m
      where m.project_id=v_p.id and m.status='active' and m.member_role='lead'
    ) then
      raise exception 'Builder Project team requires a lead member for coordination.';
    end if;

    v_to := 'investigating';

  elsif p_action='design' then
    if v_p.status<>'investigating' then raise exception 'Project must be investigating before solution design.'; end if;
    if not exists(
      select 1 from public.khpos_ops_project_milestones ms
      where ms.project_id=v_p.id and ms.milestone_code='problem' and ms.status='verified'
    ) or not exists(
      select 1 from public.khpos_ops_project_milestones ms
      where ms.project_id=v_p.id and ms.milestone_code='investigation' and ms.status='verified'
    ) then
      raise exception 'Problem and Investigation milestones must be independently verified before solution design.';
    end if;
    v_to := 'designing';

  elsif p_action='build' then
    if v_p.status<>'designing' then raise exception 'Project must be in solution design before building.'; end if;
    if not exists(
      select 1 from public.khpos_ops_project_milestones ms
      where ms.project_id=v_p.id and ms.milestone_code='solution_design' and ms.status='verified'
    ) then
      raise exception 'Solution Design milestone must be independently verified before building.';
    end if;
    v_to := 'building';

  elsif p_action='test' then
    if v_p.status<>'building' then raise exception 'Project must be building before testing.'; end if;
    if not exists(
      select 1 from public.khpos_ops_project_milestones ms
      where ms.project_id=v_p.id and ms.milestone_code='build' and ms.status='verified'
    ) then
      raise exception 'Build milestone must be independently verified before testing.';
    end if;
    v_to := 'testing';

  elsif p_action='reflect' then
    if v_p.status<>'testing' then raise exception 'Project must be testing before reflection.'; end if;
    if not exists(
      select 1 from public.khpos_ops_project_milestones ms
      where ms.project_id=v_p.id and ms.milestone_code='test' and ms.status='verified'
    ) then
      raise exception 'Test milestone must be independently verified before reflection.';
    end if;
    v_to := 'reflecting';

  elsif p_action='ready_defence' then
    if v_p.status<>'reflecting' then raise exception 'Project must be reflecting before defence readiness.'; end if;
    if exists(
      select 1 from public.khpos_ops_project_milestones ms
      where ms.project_id=v_p.id and ms.status<>'verified'
    ) then
      raise exception 'All seven project milestones must be independently verified before Builder Defence readiness.';
    end if;
    v_to := 'defence_ready';

  elsif p_action='complete' then
    if v_p.status<>'defended' then raise exception 'Project must complete Builder Defence before project close-out.'; end if;
    if v_note is null or v_evidence is null then
      raise exception 'Project completion requires close-out note and evidence reference.';
    end if;
    if not exists(
      select 1
      from public.khpos_ops_project_defences d
      where d.project_id=v_p.id and d.status='completed'
        and d.outcome in ('completed','showcase_ready')
    ) then
      raise exception 'Project completion requires a completed defence outcome.';
    end if;
    v_to := 'completed';

  elsif p_action='withdraw' then
    if v_p.status in ('completed','withdrawn') then
      raise exception 'This project is already closed.';
    end if;
    if v_note is null then raise exception 'Project withdrawal reason is required.'; end if;
    if not khpos_private.ops_project_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only School Guardian or Academic Inspector can withdraw a project.';
    end if;
    v_to := 'withdrawn';

  else
    raise exception 'Unsupported project-stage action.';
  end if;

  update public.khpos_ops_projects
  set status=v_to,
      completion_note=case when v_to='completed' then left(v_note,5000) else completion_note end,
      completion_evidence_reference=case when v_to='completed' then left(v_evidence,1000) else completion_evidence_reference end,
      completed_by=case when v_to='completed' then p_actor_user_id else completed_by end,
      completed_at=case when v_to='completed' then now() else completed_at end,
      withdrawn_by=case when v_to='withdrawn' then p_actor_user_id else withdrawn_by end,
      withdrawn_at=case when v_to='withdrawn' then now() else withdrawn_at end,
      withdrawal_note=case when v_to='withdrawn' then left(v_note,4000) else withdrawal_note end,
      updated_at=now()
  where id=v_p.id;

  if v_to='completed' then
    update public.khpos_ops_project_members
    set status='completed'
    where project_id=v_p.id and status='active';
  end if;

  insert into public.khpos_ops_project_events(
    organisation_id,cycle_id,project_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_p.cycle_id,v_p.id,p_actor_user_id,
    'project_'||p_action,v_p.status,v_to,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence)
  );
end;
$function$;

create or replace function public.khpos_ops_create_project_defence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_project_id uuid,
  p_scheduled_at timestamptz,
  p_location_label text,
  p_panel_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_p public.khpos_ops_projects%rowtype;
  v_id uuid;
  v_attempt smallint;
  v_ref text := 'DEF-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_project_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only School Guardian or Academic Inspector can schedule Builder Defence.';
  end if;

  select * into v_p
  from public.khpos_ops_projects
  where id=p_project_id and organisation_id=p_organisation_id
  for update;

  if v_p.id is null then raise exception 'Project not found.'; end if;
  if v_p.status<>'defence_ready' then
    raise exception 'Project must be Defence Ready before a defence attempt is scheduled.';
  end if;
  if p_scheduled_at is null or p_scheduled_at<now()-interval '5 minutes' then
    raise exception 'Builder Defence schedule time is invalid.';
  end if;
  if nullif(btrim(coalesce(p_location_label,'')),'') is null
     or nullif(btrim(coalesce(p_panel_reference,'')),'') is null then
    raise exception 'Defence location and panel reference are required.';
  end if;
  if exists(
    select 1 from public.khpos_ops_project_defences d
    where d.project_id=v_p.id and d.status='planned'
  ) then
    raise exception 'Resolve the existing planned defence attempt before scheduling another.';
  end if;

  select coalesce(max(attempt_no),0)+1 into v_attempt
  from public.khpos_ops_project_defences
  where project_id=v_p.id;

  insert into public.khpos_ops_project_defences(
    organisation_id,project_id,defence_reference,attempt_no,scheduled_at,
    location_label,panel_reference,status,created_by
  ) values (
    p_organisation_id,v_p.id,v_ref,v_attempt,p_scheduled_at,
    left(btrim(p_location_label),300),left(btrim(p_panel_reference),1000),
    'planned',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_project_events(
    organisation_id,project_id,defence_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_p.id,v_id,p_actor_user_id,'project_defence_scheduled',
    'planned','Builder Defence attempt '||v_attempt||' scheduled.'
  );

  return v_id;
end;
$function$;

create or replace function public.khpos_ops_project_defence_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_defence_id uuid,
  p_action text,
  p_outcome text default null,
  p_panel_feedback text default null,
  p_learner_response_summary text default null,
  p_evidence_reference text default null,
  p_revision_due_date date default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_d public.khpos_ops_project_defences%rowtype;
  v_p public.khpos_ops_projects%rowtype;
  v_feedback text := nullif(btrim(coalesce(p_panel_feedback,'')),'');
  v_response text := nullif(btrim(coalesce(p_learner_response_summary,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_issue uuid;
  v_project_to text;
begin
  if not khpos_private.ops_project_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only School Guardian or Academic Inspector can record Builder Defence outcomes.';
  end if;

  select * into v_d
  from public.khpos_ops_project_defences
  where id=p_defence_id and organisation_id=p_organisation_id
  for update;

  if v_d.id is null then raise exception 'Builder Defence attempt not found.'; end if;
  if v_d.status<>'planned' then raise exception 'Only a planned defence attempt can be resolved.'; end if;

  select * into v_p
  from public.khpos_ops_projects
  where id=v_d.project_id and organisation_id=p_organisation_id
  for update;

  if p_action='complete' then
    if p_outcome not in ('completed','showcase_ready','revision_required') then
      raise exception 'Unsupported Builder Defence outcome.';
    end if;
    if v_feedback is null or v_response is null or v_evidence is null then
      raise exception 'Builder Defence requires panel feedback, learner response summary and evidence reference.';
    end if;

    if p_outcome='revision_required' then
      if p_revision_due_date is null or p_revision_due_date<current_date then
        raise exception 'Revision-required defence outcome needs a recovery due date.';
      end if;
      v_issue := public.khpos_ops_create_issue_server(
        p_actor_user_id,p_organisation_id,
        'Builder Defence revision required · '||v_p.title,
        'Project defence requires revision by '||p_revision_due_date::text||'. '
          ||v_feedback,
        'human_potential_development','P3',
        (p_revision_due_date::timestamptz + interval '17 hours')
      );
      v_project_to := 'reflecting';
    else
      v_project_to := 'defended';
    end if;

    update public.khpos_ops_project_defences
    set status='completed',outcome=p_outcome,
        panel_feedback=left(v_feedback,6000),
        learner_response_summary=left(v_response,6000),
        evidence_reference=left(v_evidence,1000),
        revision_due_date=p_revision_due_date,issue_id=v_issue,
        completed_by=p_actor_user_id,completed_at=now()
    where id=v_d.id;

    update public.khpos_ops_projects
    set status=v_project_to,updated_at=now()
    where id=v_p.id;

  elsif p_action='cancel' then
    if v_feedback is null then raise exception 'Defence cancellation reason is required.'; end if;
    update public.khpos_ops_project_defences
    set status='cancelled',cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_feedback,4000)
    where id=v_d.id;
    v_project_to := v_p.status;

  else
    raise exception 'Unsupported Builder Defence action.';
  end if;

  insert into public.khpos_ops_project_events(
    organisation_id,project_id,defence_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_p.id,v_d.id,p_actor_user_id,
    'project_defence_'||p_action,v_d.status,
    case when p_action='complete' then 'completed' else 'cancelled' end,
    left(v_feedback,4000),
    jsonb_build_object(
      'outcome',p_outcome,'projectStatus',v_project_to,
      'revisionDueDate',p_revision_due_date,'issueId',v_issue,
      'evidenceReference',v_evidence
    )
  );
end;
$function$;

create or replace function public.khpos_ops_add_project_member_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_project_id uuid,
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
as $function$
declare
  v_p public.khpos_ops_projects%rowtype;
  v_id uuid;
  v_ref text := 'PVE-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  select * into v_p
  from public.khpos_ops_projects
  where id=p_project_id and organisation_id=p_organisation_id;

  if v_p.id is null then raise exception 'Project not found.'; end if;

  if not khpos_private.ops_project_visible(
    p_actor_user_id,p_organisation_id,v_p.id
  ) then
    raise exception 'This project is outside your governed visibility.';
  end if;

  if not khpos_private.ops_project_can_facilitate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Your operating role cannot record project contribution evidence.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_project_members m
    where m.project_id=v_p.id and m.learner_id=p_learner_id
      and m.status in ('active','completed')
  ) then
    raise exception 'Individual project evidence requires an active/completed project member.';
  end if;

  if p_dimension not in (
    'problem_framing','investigation','solution_design','building',
    'testing','collaboration','communication','initiative',
    'resilience','reflection','ownership','other'
  ) then
    raise exception 'Unsupported project evidence dimension.';
  end if;

  if nullif(btrim(coalesce(p_contribution_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Individual project contribution note and evidence reference are required.';
  end if;

  if p_observed_at is null or p_observed_at>now()+interval '5 minutes' then
    raise exception 'Observed-at timestamp is invalid.';
  end if;

  insert into public.khpos_ops_project_member_evidence(
    organisation_id,project_id,learner_id,evidence_reference_code,
    dimension,contribution_note,evidence_reference,observed_at,recorded_by
  ) values (
    p_organisation_id,v_p.id,p_learner_id,v_ref,p_dimension,
    left(btrim(p_contribution_note),6000),
    left(btrim(p_evidence_reference),1000),p_observed_at,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_project_events(
    organisation_id,project_id,member_evidence_id,actor_user_id,event_type,
    to_status,note
  ) values (
    p_organisation_id,v_p.id,v_id,p_actor_user_id,
    'project_member_evidence_submitted','submitted',
    left(btrim(p_contribution_note),4000)
  );

  return v_id;
end;
$function$;

create or replace function public.khpos_ops_project_member_evidence_action_server(
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
as $function$
declare
  v_e public.khpos_ops_project_member_evidence%rowtype;
  v_p public.khpos_ops_projects%rowtype;
  v_c public.khpos_ops_project_cycles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_potential uuid;
begin
  select * into v_e
  from public.khpos_ops_project_member_evidence
  where id=p_evidence_id and organisation_id=p_organisation_id
  for update;

  if v_e.id is null then raise exception 'Project member evidence not found.'; end if;
  select * into v_p from public.khpos_ops_projects where id=v_e.project_id;
  select * into v_c from public.khpos_ops_project_cycles where id=v_p.cycle_id;

  if v_note is null then raise exception 'Evidence action note is required.'; end if;

  if p_action='verify' then
    if not khpos_private.ops_project_can_verify(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only project verification authority can verify individual project evidence.';
    end if;
    if v_e.status<>'submitted' then raise exception 'Only submitted individual project evidence can be verified.'; end if;
    if v_e.recorded_by=p_actor_user_id then
      raise exception 'Project evidence recorder cannot verify their own individual evidence.';
    end if;

    v_potential := public.khpos_ops_add_potential_evidence_server(
      p_actor_user_id,p_organisation_id,v_e.learner_id,v_c.term_id,null,
      'project','school',
      'Builder Project · '||v_p.title||' · '||replace(v_e.dimension,'_',' '),
      v_e.contribution_note,v_e.evidence_reference,v_e.observed_at
    );

    update public.khpos_ops_project_member_evidence
    set status='verified',verified_by=p_actor_user_id,verified_at=now(),
        verification_note=left(v_note,4000),potential_evidence_id=v_potential
    where id=v_e.id;

  elsif p_action='return' then
    if not khpos_private.ops_project_can_verify(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only project verification authority can return individual project evidence.';
    end if;
    if v_e.status<>'submitted' then raise exception 'Only submitted individual project evidence can be returned.'; end if;
    update public.khpos_ops_project_member_evidence
    set status='returned',return_note=left(v_note,4000)
    where id=v_e.id;

  elsif p_action='withdraw' then
    if v_e.recorded_by<>p_actor_user_id
       and not khpos_private.ops_project_can_manage(
         p_actor_user_id,p_organisation_id
       ) then
      raise exception 'Only the evidence recorder or project coordinating authority can withdraw unverified evidence.';
    end if;
    if v_e.status not in ('submitted','returned') then
      raise exception 'Only unverified project evidence can be withdrawn.';
    end if;
    update public.khpos_ops_project_member_evidence
    set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
        withdrawal_note=left(v_note,4000)
    where id=v_e.id;

  else
    raise exception 'Unsupported project member-evidence action.';
  end if;

  insert into public.khpos_ops_project_events(
    organisation_id,project_id,member_evidence_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_p.id,v_e.id,p_actor_user_id,
    'project_member_evidence_'||p_action,v_e.status,
    (select status from public.khpos_ops_project_member_evidence where id=v_e.id),
    left(v_note,4000),jsonb_build_object('potentialEvidenceId',v_potential)
  );
end;
$function$;

create or replace function public.khpos_ops_submit_project_portfolio_link_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_project_id uuid,
  p_learner_id uuid,
  p_portfolio_reference text,
  p_share_note text,
  p_share_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_p public.khpos_ops_projects%rowtype;
  v_id uuid;
  v_ref text := 'PFL-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  select * into v_p
  from public.khpos_ops_projects
  where id=p_project_id and organisation_id=p_organisation_id;

  if v_p.id is null then raise exception 'Project not found.'; end if;

  if not khpos_private.ops_project_visible(
    p_actor_user_id,p_organisation_id,v_p.id
  ) or not khpos_private.ops_project_can_facilitate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Your operating role cannot submit project portfolio references.';
  end if;

  if v_p.status not in ('defended','completed') then
    raise exception 'Portfolio handoff requires a defended or completed project.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_project_members m
    where m.project_id=v_p.id and m.learner_id=p_learner_id
      and m.status in ('active','completed')
  ) then
    raise exception 'Portfolio handoff requires a project member.';
  end if;

  if not coalesce(p_share_confirmed,false) then
    raise exception 'Record only a portfolio/project reference the learner deliberately shared for school evidence.';
  end if;

  if nullif(btrim(coalesce(p_portfolio_reference,'')),'') is null
     or nullif(btrim(coalesce(p_share_note,'')),'') is null then
    raise exception 'Portfolio reference and share note are required.';
  end if;

  insert into public.khpos_ops_project_portfolio_links(
    organisation_id,project_id,learner_id,portfolio_reference_code,
    portfolio_reference,share_note,share_confirmed,submitted_by
  ) values (
    p_organisation_id,v_p.id,p_learner_id,v_ref,
    left(btrim(p_portfolio_reference),1000),left(btrim(p_share_note),5000),
    true,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_project_events(
    organisation_id,project_id,portfolio_link_id,actor_user_id,event_type,
    to_status,note
  ) values (
    p_organisation_id,v_p.id,v_id,p_actor_user_id,
    'project_portfolio_link_submitted','submitted',
    left(btrim(p_share_note),4000)
  );

  return v_id;
end;
$function$;

create or replace function public.khpos_ops_project_portfolio_link_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_portfolio_link_id uuid,
  p_action text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_l public.khpos_ops_project_portfolio_links%rowtype;
  v_p public.khpos_ops_projects%rowtype;
  v_c public.khpos_ops_project_cycles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_potential uuid;
begin
  select * into v_l
  from public.khpos_ops_project_portfolio_links
  where id=p_portfolio_link_id and organisation_id=p_organisation_id
  for update;

  if v_l.id is null then raise exception 'Project portfolio link not found.'; end if;
  select * into v_p from public.khpos_ops_projects where id=v_l.project_id;
  select * into v_c from public.khpos_ops_project_cycles where id=v_p.cycle_id;

  if v_note is null then raise exception 'Portfolio-link action note is required.'; end if;

  if p_action='verify' then
    if not khpos_private.ops_project_can_verify(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only project verification authority can verify a learner-shared portfolio reference.';
    end if;
    if v_l.status<>'submitted' then raise exception 'Only submitted portfolio links can be verified.'; end if;
    if v_l.submitted_by=p_actor_user_id then
      raise exception 'Portfolio-link submitter cannot verify their own learner-shared reference.';
    end if;

    v_potential := public.khpos_ops_add_potential_evidence_server(
      p_actor_user_id,p_organisation_id,v_l.learner_id,v_c.term_id,null,
      'learner_shared_portfolio','learner_shared',
      'Learner-shared project portfolio · '||v_p.title,
      v_l.share_note,v_l.portfolio_reference,now()
    );

    update public.khpos_ops_project_portfolio_links
    set status='verified',verified_by=p_actor_user_id,verified_at=now(),
        verification_note=left(v_note,4000),potential_evidence_id=v_potential
    where id=v_l.id;

  elsif p_action='return' then
    if not khpos_private.ops_project_can_verify(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only project verification authority can return a portfolio reference.';
    end if;
    if v_l.status<>'submitted' then raise exception 'Only submitted portfolio links can be returned.'; end if;
    update public.khpos_ops_project_portfolio_links
    set status='returned',return_note=left(v_note,4000)
    where id=v_l.id;

  elsif p_action='withdraw' then
    if v_l.submitted_by<>p_actor_user_id
       and not khpos_private.ops_project_can_manage(
         p_actor_user_id,p_organisation_id
       ) then
      raise exception 'Only the submitter or project coordinating authority can withdraw an unverified portfolio link.';
    end if;
    if v_l.status not in ('submitted','returned') then
      raise exception 'Only unverified project portfolio links can be withdrawn.';
    end if;
    update public.khpos_ops_project_portfolio_links
    set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
        withdrawal_note=left(v_note,4000)
    where id=v_l.id;

  else
    raise exception 'Unsupported project portfolio-link action.';
  end if;

  insert into public.khpos_ops_project_events(
    organisation_id,project_id,portfolio_link_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_p.id,v_l.id,p_actor_user_id,
    'project_portfolio_link_'||p_action,v_l.status,
    (select status from public.khpos_ops_project_portfolio_links where id=v_l.id),
    left(v_note,4000),jsonb_build_object('potentialEvidenceId',v_potential)
  );
end;
$function$;

revoke execute on function khpos_private.ops_project_actor_has_role(uuid,uuid,text[])
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_project_can_manage(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_project_can_verify(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_project_can_facilitate(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_project_actor_assignment(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_project_schedule_valid(jsonb,date,date)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_project_visible(uuid,uuid,uuid)
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_builder_projects_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_project_cycle_server(uuid,uuid,uuid,uuid,text,text,uuid,date,date,jsonb)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_project_cycle_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_builder_project_server(uuid,uuid,uuid,text,text,text,text,uuid,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_update_builder_project_server(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_project_member_action_server(uuid,uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_project_milestone_action_server(uuid,uuid,uuid,text,text,text,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_builder_project_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_project_defence_server(uuid,uuid,uuid,timestamptz,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_project_defence_action_server(uuid,uuid,uuid,text,text,text,text,text,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_project_member_evidence_server(uuid,uuid,uuid,uuid,text,text,text,timestamptz)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_project_member_evidence_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_submit_project_portfolio_link_server(uuid,uuid,uuid,uuid,text,text,boolean)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_project_portfolio_link_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_project_actor_has_role(uuid,uuid,text[]) to service_role;
grant execute on function khpos_private.ops_project_can_manage(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_project_can_verify(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_project_can_facilitate(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_project_actor_assignment(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_project_schedule_valid(jsonb,date,date) to service_role;
grant execute on function khpos_private.ops_project_visible(uuid,uuid,uuid) to service_role;

grant execute on function public.khpos_ops_get_builder_projects_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_project_cycle_server(uuid,uuid,uuid,uuid,text,text,uuid,date,date,jsonb) to service_role;
grant execute on function public.khpos_ops_project_cycle_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_builder_project_server(uuid,uuid,uuid,text,text,text,text,uuid,text) to service_role;
grant execute on function public.khpos_ops_update_builder_project_server(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_project_member_action_server(uuid,uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_project_milestone_action_server(uuid,uuid,uuid,text,text,text,date) to service_role;
grant execute on function public.khpos_ops_builder_project_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_project_defence_server(uuid,uuid,uuid,timestamptz,text,text) to service_role;
grant execute on function public.khpos_ops_project_defence_action_server(uuid,uuid,uuid,text,text,text,text,text,date) to service_role;
grant execute on function public.khpos_ops_add_project_member_evidence_server(uuid,uuid,uuid,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.khpos_ops_project_member_evidence_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_submit_project_portfolio_link_server(uuid,uuid,uuid,uuid,text,text,boolean) to service_role;
grant execute on function public.khpos_ops_project_portfolio_link_action_server(uuid,uuid,uuid,text,text) to service_role;
