create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_workforce_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  request_reference text not null,
  role_id uuid not null references public.khpos_ops_roles(id) on delete restrict,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  unit_id uuid references public.khpos_ops_units(id) on delete set null,
  employment_type text not null
    check (employment_type in ('employee','facilitator','contractor','volunteer','intern','temporary')),
  need_type text not null
    check (need_type in ('replacement','expansion','workload','specialist','temporary_cover','other')),
  rationale text not null,
  alternatives_considered text,
  desired_start_date date not null,
  budget_reference text,
  status text not null default 'submitted'
    check (status in ('submitted','approved','declined','vacancy_open','filled','cancelled')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,request_reference)
);

create index if not exists idx_khpos_ops_workforce_org_status
  on public.khpos_ops_workforce_requests(organisation_id,status,desired_start_date);
create index if not exists idx_khpos_ops_workforce_role
  on public.khpos_ops_workforce_requests(role_id,status);
create index if not exists idx_khpos_ops_workforce_requested_by
  on public.khpos_ops_workforce_requests(requested_by,requested_at desc);

create table if not exists public.khpos_ops_recruitment_vacancies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  workforce_request_id uuid not null references public.khpos_ops_workforce_requests(id) on delete restrict,
  vacancy_reference text not null,
  role_id uuid not null references public.khpos_ops_roles(id) on delete restrict,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  unit_id uuid references public.khpos_ops_units(id) on delete set null,
  employment_type text not null
    check (employment_type in ('employee','facilitator','contractor','volunteer','intern','temporary')),
  title text not null,
  role_outcomes text not null,
  minimum_requirements text,
  safeguarding_statement text not null,
  opening_date date not null default current_date,
  closing_date date,
  status text not null default 'draft'
    check (status in ('draft','open','on_hold','closed','filled','cancelled')),
  opened_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  closure_note text,
  appointed_staff_id uuid references public.khpos_ops_staff(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closing_date is null or closing_date>=opening_date),
  unique (organisation_id,vacancy_reference),
  unique (workforce_request_id)
);

create index if not exists idx_khpos_ops_vacancy_org_status
  on public.khpos_ops_recruitment_vacancies(organisation_id,status,opening_date desc);
create index if not exists idx_khpos_ops_vacancy_role
  on public.khpos_ops_recruitment_vacancies(role_id,status);

create table if not exists public.khpos_ops_recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  candidate_reference text not null,
  full_name text not null,
  email text not null,
  phone text,
  source text,
  status text not null default 'active'
    check (status in ('active','withdrawn','declined','appointed','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,candidate_reference)
);

create unique index if not exists uq_khpos_ops_candidate_email_current
  on public.khpos_ops_recruitment_candidates(organisation_id,lower(email))
  where status in ('active','appointed');
create index if not exists idx_khpos_ops_candidate_org_status
  on public.khpos_ops_recruitment_candidates(organisation_id,status,created_at desc);

create table if not exists public.khpos_ops_candidate_applications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vacancy_id uuid not null references public.khpos_ops_recruitment_vacancies(id) on delete cascade,
  candidate_id uuid not null references public.khpos_ops_recruitment_candidates(id) on delete cascade,
  application_reference text not null,
  stage text not null default 'applied'
    check (stage in (
      'applied','screening','interview','conditional_selection',
      'clearance','cleared','declined','withdrawn','appointed'
    )),
  application_note text,
  applied_at timestamptz not null default now(),
  last_stage_changed_by uuid references auth.users(id) on delete set null,
  last_stage_changed_at timestamptz not null default now(),
  decision_note text,
  appointed_staff_id uuid references public.khpos_ops_staff(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,application_reference),
  unique (vacancy_id,candidate_id)
);

create index if not exists idx_khpos_ops_application_vacancy_stage
  on public.khpos_ops_candidate_applications(vacancy_id,stage,applied_at desc);
create index if not exists idx_khpos_ops_application_candidate
  on public.khpos_ops_candidate_applications(candidate_id,stage);

create table if not exists public.khpos_ops_candidate_evaluations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  application_id uuid not null references public.khpos_ops_candidate_applications(id) on delete cascade,
  evaluation_type text not null
    check (evaluation_type in ('screening','interview','demonstration','reference_review','other')),
  competence_evidence text not null,
  role_fit_evidence text not null,
  builder_philosophy_evidence text,
  concern_or_gap text,
  recommendation text not null
    check (recommendation in ('progress','needs_more_evidence','do_not_progress')),
  evaluator_user_id uuid not null references auth.users(id) on delete restrict,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_candidate_eval_application
  on public.khpos_ops_candidate_evaluations(application_id,evaluated_at desc);
create index if not exists idx_khpos_ops_candidate_eval_evaluator
  on public.khpos_ops_candidate_evaluations(evaluator_user_id,evaluated_at desc);

create table if not exists public.khpos_ops_recruitment_clearance_requirements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  title text not null,
  description text not null,
  category text not null
    check (category in ('identity','qualification','reference','safeguarding','external_check','conflict','other')),
  mandatory boolean not null default true,
  waivable boolean not null default false,
  evidence_required boolean not null default true,
  applicable_role_codes text[] not null default '{}'::text[],
  sort_order integer not null default 100,
  status text not null default 'active'
    check (status in ('active','inactive','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,code)
);

create index if not exists idx_khpos_ops_recruitment_clearance_req
  on public.khpos_ops_recruitment_clearance_requirements(organisation_id,status,sort_order);

create table if not exists public.khpos_ops_candidate_clearance_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  application_id uuid not null references public.khpos_ops_candidate_applications(id) on delete cascade,
  source_requirement_id uuid references public.khpos_ops_recruitment_clearance_requirements(id) on delete set null,
  requirement_code text not null,
  title text not null,
  description text not null,
  category text not null,
  mandatory boolean not null,
  waivable boolean not null,
  evidence_required boolean not null,
  status text not null default 'pending'
    check (status in ('pending','verified','needs_review','not_clear','waived')),
  outcome_note text,
  evidence_reference text,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id,requirement_code)
);

create index if not exists idx_khpos_ops_candidate_clearance_app
  on public.khpos_ops_candidate_clearance_items(application_id,status,mandatory);
create index if not exists idx_khpos_ops_candidate_clearance_checker
  on public.khpos_ops_candidate_clearance_items(checked_by,checked_at desc)
  where checked_by is not null;

create table if not exists public.khpos_ops_recruitment_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  workforce_request_id uuid references public.khpos_ops_workforce_requests(id) on delete cascade,
  vacancy_id uuid references public.khpos_ops_recruitment_vacancies(id) on delete cascade,
  application_id uuid references public.khpos_ops_candidate_applications(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(workforce_request_id,vacancy_id,application_id)>=1)
);

create index if not exists idx_khpos_ops_recruitment_event_request
  on public.khpos_ops_recruitment_events(workforce_request_id,created_at desc)
  where workforce_request_id is not null;
create index if not exists idx_khpos_ops_recruitment_event_vacancy
  on public.khpos_ops_recruitment_events(vacancy_id,created_at desc)
  where vacancy_id is not null;
create index if not exists idx_khpos_ops_recruitment_event_application
  on public.khpos_ops_recruitment_events(application_id,created_at desc)
  where application_id is not null;

alter table public.khpos_ops_workforce_requests enable row level security;
alter table public.khpos_ops_recruitment_vacancies enable row level security;
alter table public.khpos_ops_recruitment_candidates enable row level security;
alter table public.khpos_ops_candidate_applications enable row level security;
alter table public.khpos_ops_candidate_evaluations enable row level security;
alter table public.khpos_ops_recruitment_clearance_requirements enable row level security;
alter table public.khpos_ops_candidate_clearance_items enable row level security;
alter table public.khpos_ops_recruitment_events enable row level security;

revoke all privileges on table public.khpos_ops_workforce_requests from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_recruitment_vacancies from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_recruitment_candidates from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_candidate_applications from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_candidate_evaluations from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_recruitment_clearance_requirements from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_candidate_clearance_items from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_recruitment_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_workforce_requests to service_role;
grant select,insert,update,delete on table public.khpos_ops_recruitment_vacancies to service_role;
grant select,insert,update,delete on table public.khpos_ops_recruitment_candidates to service_role;
grant select,insert,update,delete on table public.khpos_ops_candidate_applications to service_role;
grant select,insert,update,delete on table public.khpos_ops_candidate_evaluations to service_role;
grant select,insert,update,delete on table public.khpos_ops_recruitment_clearance_requirements to service_role;
grant select,insert,update,delete on table public.khpos_ops_candidate_clearance_items to service_role;
grant select,insert,update,delete on table public.khpos_ops_recruitment_events to service_role;

create or replace function khpos_private.ops_recruitment_has_membership(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
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
$o13$;

create or replace function khpos_private.ops_recruitment_can_manage(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
  select khpos_private.ops_can_manage_people(
    p_actor_user_id,p_organisation_id
  );
$o13$;

create or replace function khpos_private.ops_recruitment_actor_has_role(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_role_code text
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
  select exists(
    select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code=p_role_code
  );
$o13$;

create or replace function khpos_private.ops_recruitment_can_approve_role(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_role_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_code text;
begin
  select code into v_code
  from public.khpos_ops_roles
  where id=p_role_id and organisation_id=p_organisation_id and status='active';

  if v_code is null or v_code='VISION_CUSTODIAN' then
    return false;
  end if;

  if v_code='SCHOOL_GUARDIAN' then
    return khpos_private.ops_recruitment_actor_has_role(
      p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
    );
  end if;

  return khpos_private.ops_recruitment_can_manage(
    p_actor_user_id,p_organisation_id
  );
end;
$o13$;

create or replace function public.khpos_ops_get_recruitment_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_org_name text;
  v_member_role text;
  v_can_manage boolean;
  v_roles jsonb := '[]'::jsonb;
  v_campuses jsonb := '[]'::jsonb;
  v_units jsonb := '[]'::jsonb;
  v_requests jsonb := '[]'::jsonb;
  v_vacancies jsonb := '[]'::jsonb;
  v_applications jsonb := '[]'::jsonb;
begin
  if not khpos_private.ops_recruitment_has_membership(
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

  v_can_manage := khpos_private.ops_recruitment_can_manage(
    p_actor_user_id,p_organisation_id
  );

  if not v_can_manage then
    raise exception 'Recruitment workspace is restricted to School Guardian and Vision Custodian.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'code',r.code,'title',r.title,'level',r.role_level,
    'reportsToRoleId',r.reports_to_role_id,
    'charterActive',exists(
      select 1 from public.khpos_ops_role_charters rc
      where rc.role_id=r.id and rc.status='active'
    )
  ) order by r.role_level,r.title),'[]'::jsonb)
  into v_roles
  from public.khpos_ops_roles r
  where r.organisation_id=p_organisation_id
    and r.status='active'
    and r.category<>'student';

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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',wr.id,'reference',wr.request_reference,
    'roleId',wr.role_id,'roleCode',r.code,'roleTitle',r.title,
    'campusId',wr.campus_id,'unitId',wr.unit_id,
    'employmentType',wr.employment_type,'needType',wr.need_type,
    'rationale',wr.rationale,'alternativesConsidered',wr.alternatives_considered,
    'desiredStartDate',wr.desired_start_date,'budgetReference',wr.budget_reference,
    'status',wr.status,'decisionNote',wr.decision_note,
    'requestedAt',wr.requested_at
  ) order by wr.created_at desc),'[]'::jsonb)
  into v_requests
  from public.khpos_ops_workforce_requests wr
  join public.khpos_ops_roles r on r.id=wr.role_id
  where wr.organisation_id=p_organisation_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,'reference',v.vacancy_reference,
    'workforceRequestId',v.workforce_request_id,
    'roleId',v.role_id,'roleCode',r.code,'roleTitle',r.title,
    'campusId',v.campus_id,'unitId',v.unit_id,
    'employmentType',v.employment_type,'title',v.title,
    'roleOutcomes',v.role_outcomes,'minimumRequirements',v.minimum_requirements,
    'safeguardingStatement',v.safeguarding_statement,
    'openingDate',v.opening_date,'closingDate',v.closing_date,
    'status',v.status,'appointedStaffId',v.appointed_staff_id
  ) order by v.created_at desc),'[]'::jsonb)
  into v_vacancies
  from public.khpos_ops_recruitment_vacancies v
  join public.khpos_ops_roles r on r.id=v.role_id
  where v.organisation_id=p_organisation_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'reference',a.application_reference,
    'vacancyId',a.vacancy_id,'candidateId',a.candidate_id,
    'candidateName',c.full_name,'candidateEmail',c.email,'candidatePhone',c.phone,
    'candidateSource',c.source,'candidateStatus',c.status,
    'stage',a.stage,'applicationNote',a.application_note,
    'decisionNote',a.decision_note,'appointedStaffId',a.appointed_staff_id,
    'roleId',v.role_id,'roleTitle',r.title,
    'evaluations',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'evaluationType',e.evaluation_type,
        'competenceEvidence',e.competence_evidence,
        'roleFitEvidence',e.role_fit_evidence,
        'builderPhilosophyEvidence',e.builder_philosophy_evidence,
        'concernOrGap',e.concern_or_gap,
        'recommendation',e.recommendation,
        'evaluatedAt',e.evaluated_at
      ) order by e.evaluated_at desc)
      from public.khpos_ops_candidate_evaluations e
      where e.application_id=a.id
    ),'[]'::jsonb),
    'clearance',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ci.id,'code',ci.requirement_code,'title',ci.title,
        'description',ci.description,'category',ci.category,
        'mandatory',ci.mandatory,'waivable',ci.waivable,
        'evidenceRequired',ci.evidence_required,'status',ci.status,
        'outcomeNote',ci.outcome_note,'evidenceReference',ci.evidence_reference,
        'reviewNote',ci.review_note
      ) order by req.sort_order nulls last,ci.created_at)
      from public.khpos_ops_candidate_clearance_items ci
      left join public.khpos_ops_recruitment_clearance_requirements req
        on req.id=ci.source_requirement_id
      where ci.application_id=a.id
    ),'[]'::jsonb)
  ) order by a.created_at desc),'[]'::jsonb)
  into v_applications
  from public.khpos_ops_candidate_applications a
  join public.khpos_ops_recruitment_candidates c on c.id=a.candidate_id
  join public.khpos_ops_recruitment_vacancies v on v.id=a.vacancy_id
  join public.khpos_ops_roles r on r.id=v.role_id
  where a.organisation_id=p_organisation_id;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'canManageRecruitment',v_can_manage,
    'generatedAt',now(),
    'principle','Recruit because an approved institutional need exists; select with evidence; appoint only after safer-recruitment clearance.',
    'privacyBoundary','Recruitment stores only the candidate information, evidence references and clearance outcomes needed for the process. Sensitive-source records should remain with the authorised issuing/verification channel rather than being copied into KHP-OS.',
    'roles',v_roles,'campuses',v_campuses,'units',v_units,
    'workforceRequests',v_requests,'vacancies',v_vacancies,'applications',v_applications,
    'summary',jsonb_build_object(
      'openRequests',(select count(*) from public.khpos_ops_workforce_requests where organisation_id=p_organisation_id and status in ('submitted','approved','vacancy_open')),
      'openVacancies',(select count(*) from public.khpos_ops_recruitment_vacancies where organisation_id=p_organisation_id and status='open'),
      'activeApplications',(select count(*) from public.khpos_ops_candidate_applications where organisation_id=p_organisation_id and stage not in ('declined','withdrawn','appointed')),
      'clearancePending',(select count(*) from public.khpos_ops_candidate_applications where organisation_id=p_organisation_id and stage='clearance')
    )
  );
end;
$o13$;

create or replace function public.khpos_ops_create_workforce_request_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_role_id uuid;
  v_role_code text;
  v_campus_id uuid;
  v_unit_id uuid;
  v_employment_type text := lower(coalesce(nullif(btrim(p_input->>'employmentType'),''),'employee'));
  v_need_type text := lower(nullif(btrim(p_input->>'needType'),''));
  v_rationale text := nullif(btrim(p_input->>'rationale'),'');
  v_alternatives text := nullif(btrim(p_input->>'alternativesConsidered'),'');
  v_budget text := nullif(btrim(p_input->>'budgetReference'),'');
  v_desired date;
  v_reference text;
  v_id uuid;
begin
  if not khpos_private.ops_recruitment_can_manage(p_actor_user_id,p_organisation_id) then
    raise exception 'Only School Guardian or Vision Custodian can submit workforce requests.';
  end if;

  begin v_role_id := (p_input->>'roleId')::uuid;
  exception when others then raise exception 'A valid role is required.'; end;

  select code into v_role_code
  from public.khpos_ops_roles
  where id=v_role_id and organisation_id=p_organisation_id
    and status='active' and category<>'student';

  if v_role_code is null then raise exception 'Operating role not found.'; end if;
  if v_role_code='VISION_CUSTODIAN' then
    raise exception 'Vision Custodian workforce decisions require external company governance.';
  end if;
  if v_role_code='SCHOOL_GUARDIAN'
     and not khpos_private.ops_recruitment_actor_has_role(
       p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
     ) then
    raise exception 'School Guardian workforce planning is reserved to the Vision Custodian.';
  end if;

  if v_employment_type not in ('employee','facilitator','contractor','volunteer','intern','temporary') then
    raise exception 'Unsupported employment type.';
  end if;
  if v_need_type not in ('replacement','expansion','workload','specialist','temporary_cover','other') then
    raise exception 'Unsupported workforce need type.';
  end if;
  if v_rationale is null then raise exception 'Workforce request rationale is required.'; end if;

  begin v_desired := (p_input->>'desiredStartDate')::date;
  exception when others then raise exception 'Desired start date is invalid.'; end;
  if v_desired<current_date then raise exception 'Desired start date cannot be in the past.'; end if;

  if nullif(p_input->>'campusId','') is not null then
    begin v_campus_id := (p_input->>'campusId')::uuid;
    exception when others then raise exception 'Campus is invalid.'; end;
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus_id and organisation_id=p_organisation_id and status='active')
    then raise exception 'Campus is not active.'; end if;
  end if;

  if nullif(p_input->>'unitId','') is not null then
    begin v_unit_id := (p_input->>'unitId')::uuid;
    exception when others then raise exception 'Unit is invalid.'; end;
    if not exists(select 1 from public.khpos_ops_units where id=v_unit_id and organisation_id=p_organisation_id and status='active')
    then raise exception 'Unit is not active.'; end if;
  end if;

  v_reference := 'WRF-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_workforce_requests(
    organisation_id,request_reference,role_id,campus_id,unit_id,
    employment_type,need_type,rationale,alternatives_considered,
    desired_start_date,budget_reference,status,requested_by
  ) values (
    p_organisation_id,v_reference,v_role_id,v_campus_id,v_unit_id,
    v_employment_type,v_need_type,left(v_rationale,6000),left(v_alternatives,6000),
    v_desired,left(v_budget,1000),'submitted',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,workforce_request_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'workforce_request_submitted',
    'submitted',left(v_rationale,4000)
  );

  return v_id;
end;
$o13$;

create or replace function public.khpos_ops_decide_workforce_request_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_request_id uuid,
  p_decision text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_req public.khpos_ops_workforce_requests%rowtype;
  v_role public.khpos_ops_roles%rowtype;
  v_vacancy_id uuid;
  v_vacancy_ref text;
begin
  select * into v_req
  from public.khpos_ops_workforce_requests
  where id=p_request_id and organisation_id=p_organisation_id
  for update;

  if v_req.id is null then raise exception 'Workforce request not found.'; end if;
  if v_req.status<>'submitted' then raise exception 'Only submitted workforce requests can be decided.'; end if;
  if p_decision not in ('approve','decline') then raise exception 'Decision must be approve or decline.'; end if;
  if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'Decision note is required.'; end if;

  if not khpos_private.ops_recruitment_can_approve_role(
    p_actor_user_id,p_organisation_id,v_req.role_id
  ) then
    raise exception 'You are not the competent authority for this workforce decision.';
  end if;

  if p_decision='decline' then
    update public.khpos_ops_workforce_requests
    set status='declined',decided_by=p_actor_user_id,decided_at=now(),
        decision_note=left(btrim(p_note),6000),updated_at=now()
    where id=v_req.id;

    insert into public.khpos_ops_recruitment_events(
      organisation_id,workforce_request_id,actor_user_id,event_type,
      from_status,to_status,note
    ) values (
      p_organisation_id,v_req.id,p_actor_user_id,'workforce_request_declined',
      v_req.status,'declined',left(btrim(p_note),4000)
    );
    return null;
  end if;

  select * into v_role from public.khpos_ops_roles where id=v_req.role_id;
  if not exists(
    select 1 from public.khpos_ops_role_charters
    where role_id=v_req.role_id and status='active'
  ) then
    raise exception 'The requested role needs an active Role Charter before recruitment can open.';
  end if;

  update public.khpos_ops_workforce_requests
  set status='approved',decided_by=p_actor_user_id,decided_at=now(),
      decision_note=left(btrim(p_note),6000),updated_at=now()
  where id=v_req.id;

  v_vacancy_ref := 'VAC-'||upper(substr(gen_random_uuid()::text,1,8));
  insert into public.khpos_ops_recruitment_vacancies(
    organisation_id,workforce_request_id,vacancy_reference,role_id,campus_id,unit_id,
    employment_type,title,role_outcomes,minimum_requirements,safeguarding_statement,
    opening_date,status,created_by
  ) values (
    p_organisation_id,v_req.id,v_vacancy_ref,v_req.role_id,v_req.campus_id,v_req.unit_id,
    v_req.employment_type,v_role.title,
    'See the active Role Charter for owned outcomes, responsibilities, authority and KPIs.',
    null,
    'Appointment is conditional on the KNS safer-recruitment and safeguarding clearance process.',
    current_date,'draft',p_actor_user_id
  ) returning id into v_vacancy_id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,workforce_request_id,vacancy_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_req.id,v_vacancy_id,p_actor_user_id,'workforce_request_approved',
    v_req.status,'approved',left(btrim(p_note),4000)
  );

  return v_vacancy_id;
end;
$o13$;

create or replace function public.khpos_ops_update_vacancy_brief_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_vacancy_id uuid,
  p_title text,
  p_role_outcomes text,
  p_minimum_requirements text,
  p_safeguarding_statement text,
  p_closing_date date default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_vac public.khpos_ops_recruitment_vacancies%rowtype;
begin
  select * into v_vac
  from public.khpos_ops_recruitment_vacancies
  where id=p_vacancy_id and organisation_id=p_organisation_id
  for update;

  if v_vac.id is null then raise exception 'Vacancy not found.'; end if;

  if not khpos_private.ops_recruitment_can_approve_role(
    p_actor_user_id,p_organisation_id,v_vac.role_id
  ) then
    raise exception 'You are not the competent authority for this vacancy.';
  end if;

  if v_vac.status not in ('draft','on_hold') then
    raise exception 'Vacancy brief can only be edited while Draft or On Hold.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_role_outcomes,'')),'') is null
     or nullif(btrim(coalesce(p_minimum_requirements,'')),'') is null
     or nullif(btrim(coalesce(p_safeguarding_statement,'')),'') is null then
    raise exception 'Vacancy title, role outcomes, minimum requirements and safeguarding statement are required.';
  end if;

  if p_closing_date is not null and p_closing_date<current_date then
    raise exception 'Vacancy closing date cannot be in the past.';
  end if;

  update public.khpos_ops_recruitment_vacancies
  set title=left(btrim(p_title),240),
      role_outcomes=left(btrim(p_role_outcomes),6000),
      minimum_requirements=left(btrim(p_minimum_requirements),6000),
      safeguarding_statement=left(btrim(p_safeguarding_statement),4000),
      closing_date=p_closing_date,
      updated_at=now()
  where id=v_vac.id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,vacancy_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_vac.id,p_actor_user_id,'vacancy_brief_updated',
    'Vacancy brief updated before publication/opening.',
    jsonb_build_object('closingDate',p_closing_date)
  );
end;
$o13$;

create or replace function public.khpos_ops_vacancy_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_vacancy_id uuid,
  p_action text,
  p_note text default null,
  p_closing_date date default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_vac public.khpos_ops_recruitment_vacancies%rowtype;
  v_to text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_vac
  from public.khpos_ops_recruitment_vacancies
  where id=p_vacancy_id and organisation_id=p_organisation_id
  for update;
  if v_vac.id is null then raise exception 'Vacancy not found.'; end if;

  if not khpos_private.ops_recruitment_can_approve_role(
    p_actor_user_id,p_organisation_id,v_vac.role_id
  ) then raise exception 'You are not the competent authority for this vacancy.'; end if;

  if p_action='open' then
    if v_vac.status not in ('draft','on_hold') then raise exception 'Only draft or on-hold vacancies can open.'; end if;
    if nullif(btrim(coalesce(v_vac.title,'')),'') is null
       or nullif(btrim(coalesce(v_vac.role_outcomes,'')),'') is null
       or nullif(btrim(coalesce(v_vac.minimum_requirements,'')),'') is null
       or nullif(btrim(coalesce(v_vac.safeguarding_statement,'')),'') is null then
      raise exception 'Complete the governed vacancy brief before opening recruitment.';
    end if;
    if coalesce(p_closing_date,v_vac.closing_date) is not null
       and coalesce(p_closing_date,v_vac.closing_date)<current_date then
      raise exception 'Vacancy closing date cannot be in the past.';
    end if;
    v_to:='open';
    update public.khpos_ops_recruitment_vacancies
    set status=v_to,opened_by=p_actor_user_id,opened_at=now(),
        closing_date=coalesce(p_closing_date,closing_date),updated_at=now()
    where id=v_vac.id;
    update public.khpos_ops_workforce_requests set status='vacancy_open',updated_at=now()
    where id=v_vac.workforce_request_id and status='approved';

  elsif p_action='hold' then
    if v_vac.status<>'open' then raise exception 'Only an open vacancy can be put on hold.'; end if;
    if v_note is null then raise exception 'Hold reason is required.'; end if;
    v_to:='on_hold';
    update public.khpos_ops_recruitment_vacancies set status=v_to,updated_at=now() where id=v_vac.id;

  elsif p_action='close' then
    if v_vac.status not in ('open','on_hold','draft') then raise exception 'This vacancy cannot be closed.'; end if;
    if v_note is null then raise exception 'Closure reason is required.'; end if;
    v_to:='closed';
    update public.khpos_ops_recruitment_vacancies
    set status=v_to,closed_by=p_actor_user_id,closed_at=now(),
        closure_note=left(v_note,4000),updated_at=now()
    where id=v_vac.id;

  else
    raise exception 'Unsupported vacancy action.';
  end if;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,vacancy_id,actor_user_id,event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_vac.id,p_actor_user_id,'vacancy_'||p_action,
    v_vac.status,v_to,left(v_note,4000)
  );
end;
$o13$;

create or replace function public.khpos_ops_add_candidate_application_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_vacancy_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_source text default null,
  p_application_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_vac public.khpos_ops_recruitment_vacancies%rowtype;
  v_candidate_id uuid;
  v_candidate_ref text;
  v_app_ref text;
  v_app_id uuid;
  v_email text := lower(nullif(btrim(coalesce(p_email,'')),''));
  v_name text := nullif(btrim(coalesce(p_full_name,'')),'');
begin
  if not khpos_private.ops_recruitment_can_manage(p_actor_user_id,p_organisation_id) then
    raise exception 'Recruitment records are restricted to School Guardian or Vision Custodian.';
  end if;

  select * into v_vac from public.khpos_ops_recruitment_vacancies
  where id=p_vacancy_id and organisation_id=p_organisation_id;
  if v_vac.id is null or v_vac.status<>'open' then
    raise exception 'Applications can only be added to an open vacancy.';
  end if;
  if v_name is null or v_email is null or position('@' in v_email)<2 then
    raise exception 'Candidate name and valid email are required.';
  end if;
  if exists(
    select 1 from public.khpos_ops_staff
    where organisation_id=p_organisation_id and lower(account_email)=v_email and status<>'ended'
  ) then
    raise exception 'This email already belongs to a current staff record.';
  end if;

  select id into v_candidate_id
  from public.khpos_ops_recruitment_candidates
  where organisation_id=p_organisation_id and lower(email)=v_email and status='active'
  limit 1;

  if v_candidate_id is null then
    v_candidate_ref := 'CAN-'||upper(substr(gen_random_uuid()::text,1,8));
    insert into public.khpos_ops_recruitment_candidates(
      organisation_id,candidate_reference,full_name,email,phone,source,status,created_by
    ) values (
      p_organisation_id,v_candidate_ref,left(v_name,180),left(v_email,320),
      left(nullif(btrim(coalesce(p_phone,'')),''),80),
      left(nullif(btrim(coalesce(p_source,'')),''),240),'active',p_actor_user_id
    ) returning id into v_candidate_id;
  end if;

  v_app_ref := 'APP-'||upper(substr(gen_random_uuid()::text,1,8));
  insert into public.khpos_ops_candidate_applications(
    organisation_id,vacancy_id,candidate_id,application_reference,stage,
    application_note,last_stage_changed_by,created_by
  ) values (
    p_organisation_id,v_vac.id,v_candidate_id,v_app_ref,'applied',
    left(nullif(btrim(coalesce(p_application_note,'')),''),4000),
    p_actor_user_id,p_actor_user_id
  ) returning id into v_app_id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,vacancy_id,application_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_vac.id,v_app_id,p_actor_user_id,'candidate_application_added',
    'applied','Candidate application recorded with data minimisation.'
  );

  return v_app_id;
exception when unique_violation then
  raise exception 'This candidate already has an application for this vacancy.';
end;
$o13$;

create or replace function public.khpos_ops_add_candidate_evaluation_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_application_id uuid,
  p_evaluation_type text,
  p_competence_evidence text,
  p_role_fit_evidence text,
  p_builder_philosophy_evidence text,
  p_concern_or_gap text,
  p_recommendation text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_app public.khpos_ops_candidate_applications%rowtype;
  v_vac public.khpos_ops_recruitment_vacancies%rowtype;
  v_id uuid;
begin
  select * into v_app from public.khpos_ops_candidate_applications
  where id=p_application_id and organisation_id=p_organisation_id;
  if v_app.id is null or v_app.stage in ('declined','withdrawn','appointed') then
    raise exception 'Candidate application is not open for evaluation.';
  end if;

  select * into v_vac from public.khpos_ops_recruitment_vacancies where id=v_app.vacancy_id;
  if not khpos_private.ops_recruitment_can_approve_role(
    p_actor_user_id,p_organisation_id,v_vac.role_id
  ) and not khpos_private.ops_can_review_staff(
    p_actor_user_id,p_organisation_id,v_vac.role_id
  ) then
    raise exception 'You are not authorised to evaluate this candidate.';
  end if;

  if p_evaluation_type not in ('screening','interview','demonstration','reference_review','other') then
    raise exception 'Unsupported evaluation type.';
  end if;
  if p_recommendation not in ('progress','needs_more_evidence','do_not_progress') then
    raise exception 'Unsupported candidate recommendation.';
  end if;
  if nullif(btrim(coalesce(p_competence_evidence,'')),'') is null
     or nullif(btrim(coalesce(p_role_fit_evidence,'')),'') is null then
    raise exception 'Competence evidence and role-fit evidence are required.';
  end if;

  insert into public.khpos_ops_candidate_evaluations(
    organisation_id,application_id,evaluation_type,competence_evidence,
    role_fit_evidence,builder_philosophy_evidence,concern_or_gap,
    recommendation,evaluator_user_id
  ) values (
    p_organisation_id,v_app.id,p_evaluation_type,
    left(btrim(p_competence_evidence),6000),left(btrim(p_role_fit_evidence),6000),
    left(nullif(btrim(coalesce(p_builder_philosophy_evidence,'')),''),6000),
    left(nullif(btrim(coalesce(p_concern_or_gap,'')),''),6000),
    p_recommendation,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,vacancy_id,application_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_app.vacancy_id,v_app.id,p_actor_user_id,
    'candidate_evaluation_added',
    'Evidence-based evaluation recorded; no automatic aggregate score is used.',
    jsonb_build_object('evaluationId',v_id,'recommendation',p_recommendation)
  );

  return v_id;
end;
$o13$;

create or replace function public.khpos_ops_application_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_application_id uuid,
  p_action text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_app public.khpos_ops_candidate_applications%rowtype;
  v_vac public.khpos_ops_recruitment_vacancies%rowtype;
  v_candidate public.khpos_ops_recruitment_candidates%rowtype;
  v_role_code text;
  v_to text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_app from public.khpos_ops_candidate_applications
  where id=p_application_id and organisation_id=p_organisation_id
  for update;
  if v_app.id is null then raise exception 'Application not found.'; end if;

  select * into v_vac from public.khpos_ops_recruitment_vacancies where id=v_app.vacancy_id;
  select * into v_candidate from public.khpos_ops_recruitment_candidates where id=v_app.candidate_id;
  select code into v_role_code from public.khpos_ops_roles where id=v_vac.role_id;

  if not khpos_private.ops_recruitment_can_approve_role(
    p_actor_user_id,p_organisation_id,v_vac.role_id
  ) then raise exception 'You are not the competent authority for this candidate decision.'; end if;

  if p_action='start_screening' then
    if v_app.stage<>'applied' then raise exception 'Only an applied candidate can enter screening.'; end if;
    v_to:='screening';

  elsif p_action='invite_interview' then
    if v_app.stage not in ('applied','screening') then raise exception 'Candidate is not ready for interview.'; end if;
    if not exists(
      select 1 from public.khpos_ops_candidate_evaluations
      where application_id=v_app.id and recommendation in ('progress','needs_more_evidence')
    ) then raise exception 'Record evidence-based screening before interview.'; end if;
    v_to:='interview';

  elsif p_action='conditional_select' then
    if v_app.stage<>'interview' then raise exception 'Conditional selection follows interview.'; end if;
    if not exists(
      select 1 from public.khpos_ops_candidate_evaluations
      where application_id=v_app.id
        and evaluation_type in ('interview','demonstration')
        and recommendation='progress'
    ) then
      raise exception 'Conditional selection requires specific interview or demonstration evidence recommending progression.';
    end if;
    if exists(
      select 1 from public.khpos_ops_candidate_evaluations
      where application_id=v_app.id and recommendation='do_not_progress'
    ) and v_note is null then
      raise exception 'Conflicting selection evidence requires a reasoned decision note.';
    end if;
    v_to:='conditional_selection';

  elsif p_action='start_clearance' then
    if v_app.stage<>'conditional_selection' then
      raise exception 'Safer-recruitment clearance begins only after conditional selection.';
    end if;
    v_to:='clearance';

    insert into public.khpos_ops_candidate_clearance_items(
      organisation_id,application_id,source_requirement_id,requirement_code,
      title,description,category,mandatory,waivable,evidence_required
    )
    select p_organisation_id,v_app.id,req.id,req.code,req.title,req.description,
      req.category,req.mandatory,req.waivable,req.evidence_required
    from public.khpos_ops_recruitment_clearance_requirements req
    where req.organisation_id=p_organisation_id
      and req.status='active'
      and (
        cardinality(req.applicable_role_codes)=0
        or v_role_code=any(req.applicable_role_codes)
      )
    on conflict (application_id,requirement_code) do nothing;

    if not exists(
      select 1 from public.khpos_ops_candidate_clearance_items
      where application_id=v_app.id
    ) then
      raise exception 'No active safer-recruitment clearance controls exist for this role.';
    end if;

  elsif p_action='decline' then
    if v_app.stage in ('declined','withdrawn','appointed') then raise exception 'Application is already closed.'; end if;
    if v_note is null then raise exception 'Decline decision note is required.'; end if;
    v_to:='declined';
    update public.khpos_ops_recruitment_candidates set status='declined',updated_at=now()
    where id=v_candidate.id
      and not exists(
        select 1 from public.khpos_ops_candidate_applications x
        where x.candidate_id=v_candidate.id and x.id<>v_app.id
          and x.stage not in ('declined','withdrawn','appointed')
      );

  elsif p_action='withdraw' then
    if v_app.stage in ('declined','withdrawn','appointed') then raise exception 'Application is already closed.'; end if;
    if v_note is null then raise exception 'Withdrawal note/reference is required.'; end if;
    v_to:='withdrawn';
    update public.khpos_ops_recruitment_candidates set status='withdrawn',updated_at=now()
    where id=v_candidate.id
      and not exists(
        select 1 from public.khpos_ops_candidate_applications x
        where x.candidate_id=v_candidate.id and x.id<>v_app.id
          and x.stage not in ('declined','withdrawn','appointed')
      );

  else
    raise exception 'Unsupported application action.';
  end if;

  update public.khpos_ops_candidate_applications
  set stage=v_to,last_stage_changed_by=p_actor_user_id,last_stage_changed_at=now(),
      decision_note=coalesce(left(v_note,6000),decision_note),updated_at=now()
  where id=v_app.id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,vacancy_id,application_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_app.vacancy_id,v_app.id,p_actor_user_id,
    'application_'||p_action,v_app.stage,v_to,left(v_note,4000)
  );
end;
$o13$;

create or replace function public.khpos_ops_candidate_clearance_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_item_id uuid,
  p_action text,
  p_note text,
  p_evidence_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_item public.khpos_ops_candidate_clearance_items%rowtype;
  v_app public.khpos_ops_candidate_applications%rowtype;
  v_vac public.khpos_ops_recruitment_vacancies%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_to text;
begin
  select * into v_item from public.khpos_ops_candidate_clearance_items
  where id=p_item_id and organisation_id=p_organisation_id
  for update;
  if v_item.id is null then raise exception 'Clearance item not found.'; end if;

  select * into v_app from public.khpos_ops_candidate_applications where id=v_item.application_id;
  select * into v_vac from public.khpos_ops_recruitment_vacancies where id=v_app.vacancy_id;

  if not khpos_private.ops_recruitment_can_approve_role(
    p_actor_user_id,p_organisation_id,v_vac.role_id
  ) then raise exception 'You are not authorised to decide this safer-recruitment clearance.'; end if;

  if v_app.stage<>'clearance' then raise exception 'Candidate is not in safer-recruitment clearance.'; end if;

  if p_action='verify' then
    if v_note is null then raise exception 'Clearance outcome note is required.'; end if;
    if v_item.evidence_required and v_evidence is null then
      raise exception 'This clearance requirement needs an evidence reference.';
    end if;
    v_to:='verified';

  elsif p_action='needs_review' then
    if v_note is null then raise exception 'Explain what needs further review.'; end if;
    v_to:='needs_review';

  elsif p_action='not_clear' then
    if v_note is null then raise exception 'Reasoned not-clear outcome is required.'; end if;
    v_to:='not_clear';

  elsif p_action='waive' then
    if not v_item.waivable then raise exception 'This safer-recruitment requirement cannot be waived.'; end if;
    if v_note is null then raise exception 'Waiver reason is required.'; end if;
    v_to:='waived';

  else
    raise exception 'Unsupported clearance action.';
  end if;

  update public.khpos_ops_candidate_clearance_items
  set status=v_to,outcome_note=left(v_note,6000),
      evidence_reference=left(v_evidence,1000),
      checked_by=p_actor_user_id,checked_at=now(),
      reviewed_by=case when p_action in ('verify','not_clear','waive') then p_actor_user_id else null end,
      reviewed_at=case when p_action in ('verify','not_clear','waive') then now() else null end,
      review_note=left(v_note,6000),updated_at=now()
  where id=v_item.id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,vacancy_id,application_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_app.vacancy_id,v_app.id,p_actor_user_id,
    'clearance_'||p_action,left(v_note,4000),
    jsonb_build_object('clearanceItemId',v_item.id,'requirementCode',v_item.requirement_code)
  );
end;
$o13$;

create or replace function public.khpos_ops_complete_candidate_clearance_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_application_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_app public.khpos_ops_candidate_applications%rowtype;
  v_vac public.khpos_ops_recruitment_vacancies%rowtype;
begin
  select * into v_app from public.khpos_ops_candidate_applications
  where id=p_application_id and organisation_id=p_organisation_id
  for update;
  if v_app.id is null or v_app.stage<>'clearance' then
    raise exception 'Candidate is not in clearance.';
  end if;

  select * into v_vac from public.khpos_ops_recruitment_vacancies where id=v_app.vacancy_id;
  if not khpos_private.ops_recruitment_can_approve_role(
    p_actor_user_id,p_organisation_id,v_vac.role_id
  ) then raise exception 'You are not authorised to complete this clearance.'; end if;

  if not exists(
    select 1 from public.khpos_ops_candidate_clearance_items
    where application_id=v_app.id
  ) then raise exception 'Safer-recruitment clearance requirements have not been generated.'; end if;

  if exists(
    select 1 from public.khpos_ops_candidate_clearance_items
    where application_id=v_app.id
      and mandatory
      and status not in ('verified','waived')
  ) then raise exception 'Every mandatory safer-recruitment requirement must be verified or lawfully waived first.'; end if;

  if exists(
    select 1 from public.khpos_ops_candidate_clearance_items
    where application_id=v_app.id and status in ('not_clear','needs_review')
  ) then raise exception 'Unresolved or not-clear safeguarding/recruitment checks block appointment.';
  end if;

  update public.khpos_ops_candidate_applications
  set stage='cleared',last_stage_changed_by=p_actor_user_id,
      last_stage_changed_at=now(),decision_note=left(nullif(btrim(coalesce(p_note,'')),''),6000),
      updated_at=now()
  where id=v_app.id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,vacancy_id,application_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_app.vacancy_id,v_app.id,p_actor_user_id,
    'candidate_clearance_completed','clearance','cleared',
    left(nullif(btrim(coalesce(p_note,'')),''),4000)
  );
end;
$o13$;

create or replace function public.khpos_ops_appoint_cleared_candidate_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_application_id uuid,
  p_start_date date,
  p_onboarding_due_date date default null,
  p_probation_review_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_app public.khpos_ops_candidate_applications%rowtype;
  v_vac public.khpos_ops_recruitment_vacancies%rowtype;
  v_candidate public.khpos_ops_recruitment_candidates%rowtype;
  v_staff_id uuid;
begin
  select * into v_app from public.khpos_ops_candidate_applications
  where id=p_application_id and organisation_id=p_organisation_id
  for update;
  if v_app.id is null or v_app.stage<>'cleared' then
    raise exception 'Only a cleared candidate can be appointed.';
  end if;

  select * into v_vac from public.khpos_ops_recruitment_vacancies
  where id=v_app.vacancy_id for update;
  select * into v_candidate from public.khpos_ops_recruitment_candidates
  where id=v_app.candidate_id for update;

  if v_vac.status not in ('open','on_hold') then
    raise exception 'Vacancy must remain open or on hold at appointment.';
  end if;

  if not khpos_private.ops_recruitment_can_approve_role(
    p_actor_user_id,p_organisation_id,v_vac.role_id
  ) then raise exception 'You are not the competent appointment authority for this role.'; end if;

  if p_start_date<current_date then raise exception 'Appointment start date cannot be in the past.'; end if;

  v_staff_id := public.khpos_ops_create_staff_server(
    p_actor_user_id,p_organisation_id,
    jsonb_build_object(
      'displayName',v_candidate.full_name,
      'accountEmail',v_candidate.email,
      'employmentType',v_vac.employment_type,
      'roleId',v_vac.role_id,
      'campusId',v_vac.campus_id,
      'unitId',v_vac.unit_id,
      'startDate',p_start_date,
      'onboardingDueDate',coalesce(p_onboarding_due_date,p_start_date),
      'probationReviewDate',p_probation_review_date
    )
  );

  update public.khpos_ops_candidate_applications
  set stage='appointed',appointed_staff_id=v_staff_id,
      last_stage_changed_by=p_actor_user_id,last_stage_changed_at=now(),updated_at=now()
  where id=v_app.id;

  update public.khpos_ops_recruitment_candidates
  set status='appointed',updated_at=now()
  where id=v_candidate.id;

  update public.khpos_ops_recruitment_vacancies
  set status='filled',appointed_staff_id=v_staff_id,closed_by=p_actor_user_id,
      closed_at=now(),closure_note='Vacancy filled by a cleared candidate.',updated_at=now()
  where id=v_vac.id;

  update public.khpos_ops_workforce_requests
  set status='filled',updated_at=now()
  where id=v_vac.workforce_request_id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,workforce_request_id,vacancy_id,application_id,
    actor_user_id,event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_vac.workforce_request_id,v_vac.id,v_app.id,
    p_actor_user_id,'cleared_candidate_appointed','cleared','appointed',
    'Cleared candidate converted into the existing O7 staff appointment/onboarding engine.',
    jsonb_build_object('staffId',v_staff_id,'startDate',p_start_date)
  );

  return v_staff_id;
end;
$o13$;

revoke execute on function khpos_private.ops_recruitment_has_membership(uuid,uuid) from public,anon,authenticated;
revoke execute on function khpos_private.ops_recruitment_can_manage(uuid,uuid) from public,anon,authenticated;
revoke execute on function khpos_private.ops_recruitment_actor_has_role(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function khpos_private.ops_recruitment_can_approve_role(uuid,uuid,uuid) from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_recruitment_server(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_workforce_request_server(uuid,uuid,jsonb) from public,anon,authenticated;
revoke execute on function public.khpos_ops_decide_workforce_request_server(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_update_vacancy_brief_server(uuid,uuid,uuid,text,text,text,text,date) from public,anon,authenticated;
revoke execute on function public.khpos_ops_vacancy_action_server(uuid,uuid,uuid,text,text,date) from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_candidate_application_server(uuid,uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_candidate_evaluation_server(uuid,uuid,uuid,text,text,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_application_action_server(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_candidate_clearance_action_server(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_complete_candidate_clearance_server(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_appoint_cleared_candidate_server(uuid,uuid,uuid,date,date,date) from public,anon,authenticated;

grant execute on function khpos_private.ops_recruitment_has_membership(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_recruitment_can_manage(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_recruitment_actor_has_role(uuid,uuid,text) to service_role;
grant execute on function khpos_private.ops_recruitment_can_approve_role(uuid,uuid,uuid) to service_role;

grant execute on function public.khpos_ops_get_recruitment_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_workforce_request_server(uuid,uuid,jsonb) to service_role;
grant execute on function public.khpos_ops_decide_workforce_request_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_update_vacancy_brief_server(uuid,uuid,uuid,text,text,text,text,date) to service_role;
grant execute on function public.khpos_ops_vacancy_action_server(uuid,uuid,uuid,text,text,date) to service_role;
grant execute on function public.khpos_ops_add_candidate_application_server(uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_add_candidate_evaluation_server(uuid,uuid,uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_application_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_candidate_clearance_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_complete_candidate_clearance_server(uuid,uuid,uuid,text) to service_role;
grant execute on function public.khpos_ops_appoint_cleared_candidate_server(uuid,uuid,uuid,date,date,date) to service_role;
