create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_worldready_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete restrict,
  record_reference text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  transition_pathway text
    check (transition_pathway is null or transition_pathway in (
      'higher_education','entrepreneurship','employment',
      'apprenticeship_vocational','service_gap_year','undecided'
    )),
  pathway_summary text,
  pathway_reference text,
  portfolio_reference text,
  human_potential_record_reference text,
  status text not null default 'draft'
    check (status in ('draft','in_review','ready','ready_with_actions','not_ready','closed','cancelled')),
  readiness_outcome text
    check (readiness_outcome is null or readiness_outcome in ('ready','ready_with_actions','not_ready')),
  readiness_summary text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,record_reference)
);

create unique index if not exists uq_khpos_ops_worldready_open_learner
  on public.khpos_ops_worldready_records(learner_id)
  where status in ('draft','in_review','ready','ready_with_actions','not_ready');
create index if not exists idx_khpos_ops_worldready_org_status
  on public.khpos_ops_worldready_records(organisation_id,status,term_id);
create index if not exists idx_khpos_ops_worldready_owner
  on public.khpos_ops_worldready_records(owner_assignment_id,status);

create table if not exists public.khpos_ops_worldready_domains (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  worldready_record_id uuid not null references public.khpos_ops_worldready_records(id) on delete cascade,
  domain_code text not null check (domain_code in (
    'self_understanding','independent_learning','problem_solving_building',
    'communication','collaboration','leadership_service','financial_capability',
    'digital_responsibility','portfolio_capstone','transition_planning'
  )),
  status text not null default 'not_evidenced'
    check (status in ('not_evidenced','emerging','demonstrated')),
  review_note text,
  evidence_summary text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worldready_record_id,domain_code)
);

create index if not exists idx_khpos_ops_worldready_domains_status
  on public.khpos_ops_worldready_domains(organisation_id,status,domain_code);

create table if not exists public.khpos_ops_worldready_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  worldready_record_id uuid not null references public.khpos_ops_worldready_records(id) on delete cascade,
  domain_id uuid not null references public.khpos_ops_worldready_domains(id) on delete cascade,
  evidence_type text not null check (evidence_type in (
    'potential_evidence','potential_review','personal_project','portfolio',
    'leadership','financial_capability','skills','academic','external','other'
  )),
  title text not null,
  evidence_note text not null,
  evidence_reference text not null,
  source_potential_evidence_id uuid references public.khpos_ops_potential_evidence(id) on delete set null,
  source_potential_review_id uuid references public.khpos_ops_potential_reviews(id) on delete set null,
  source_project_id uuid references public.khpos_ops_projects(id) on delete set null,
  source_portfolio_link_id uuid references public.khpos_ops_project_portfolio_links(id) on delete set null,
  status text not null default 'submitted'
    check (status in ('submitted','verified','returned','withdrawn')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  verification_note text,
  returned_by uuid references auth.users(id) on delete set null,
  returned_at timestamptz,
  return_note text,
  withdrawn_by uuid references auth.users(id) on delete set null,
  withdrawn_at timestamptz,
  withdrawal_note text
);

create index if not exists idx_khpos_ops_worldready_evidence_record
  on public.khpos_ops_worldready_evidence(worldready_record_id,status);
create index if not exists idx_khpos_ops_worldready_evidence_domain
  on public.khpos_ops_worldready_evidence(domain_id,status);

create table if not exists public.khpos_ops_worldready_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  worldready_record_id uuid not null references public.khpos_ops_worldready_records(id) on delete cascade,
  domain_id uuid references public.khpos_ops_worldready_domains(id) on delete set null,
  action_reference text not null,
  title text not null,
  expected_change text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  due_date date not null,
  status text not null default 'open'
    check (status in ('open','in_progress','evidence_submitted','verified','waived','cancelled')),
  completion_note text,
  evidence_reference text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  waived_by uuid references auth.users(id) on delete set null,
  waived_at timestamptz,
  waiver_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,action_reference)
);

create index if not exists idx_khpos_ops_worldready_actions_record
  on public.khpos_ops_worldready_actions(worldready_record_id,status,due_date);
create index if not exists idx_khpos_ops_worldready_actions_owner
  on public.khpos_ops_worldready_actions(owner_assignment_id,status,due_date);

create table if not exists public.khpos_ops_worldready_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  worldready_record_id uuid not null references public.khpos_ops_worldready_records(id) on delete cascade,
  domain_id uuid references public.khpos_ops_worldready_domains(id) on delete set null,
  evidence_id uuid references public.khpos_ops_worldready_evidence(id) on delete set null,
  action_id uuid references public.khpos_ops_worldready_actions(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_worldready_events_record
  on public.khpos_ops_worldready_events(worldready_record_id,created_at desc);

alter table public.khpos_ops_worldready_records enable row level security;
alter table public.khpos_ops_worldready_domains enable row level security;
alter table public.khpos_ops_worldready_evidence enable row level security;
alter table public.khpos_ops_worldready_actions enable row level security;
alter table public.khpos_ops_worldready_events enable row level security;

revoke all privileges on table public.khpos_ops_worldready_records from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_worldready_domains from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_worldready_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_worldready_actions from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_worldready_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_worldready_records to service_role;
grant select,insert,update,delete on table public.khpos_ops_worldready_domains to service_role;
grant select,insert,update,delete on table public.khpos_ops_worldready_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_worldready_actions to service_role;
grant select,insert,update,delete on table public.khpos_ops_worldready_events to service_role;

create or replace function khpos_private.ops_worldready_can_manage(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
  select khpos_private.ops_hpd_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR']::text[]
  );
$function$;

create or replace function khpos_private.ops_worldready_can_record(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
  select khpos_private.ops_hpd_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array[
      'SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR',
      'SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR'
    ]::text[]
  );
$function$;

create or replace function khpos_private.ops_worldready_actor_assignment(
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

create or replace function khpos_private.ops_worldready_valid_owner_assignment(
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
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in (
        'SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR',
        'SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR'
      )
  );
$function$;

create or replace function khpos_private.ops_worldready_is_ss3(
  p_organisation_id uuid,
  p_learner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
  select exists(
    select 1
    from public.khpos_ops_learner_anchors l
    where l.id=p_learner_id
      and l.organisation_id=p_organisation_id
      and l.status='active'
      and regexp_replace(upper(l.class_label),'[^A-Z0-9]','','g') like 'SS3%'
  );
$function$;

create or replace function khpos_private.ops_worldready_has_completed_personal_project(
  p_organisation_id uuid,
  p_learner_id uuid
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
    join public.khpos_ops_project_members pm on pm.project_id=p.id
    where p.organisation_id=p_organisation_id
      and p.project_type='personal'
      and p.status='completed'
      and pm.learner_id=p_learner_id
      and pm.status in ('active','completed')
  );
$function$;

create or replace function khpos_private.ops_worldready_has_verified_portfolio(
  p_organisation_id uuid,
  p_learner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
  select exists(
    select 1
    from public.khpos_ops_project_portfolio_links pl
    join public.khpos_ops_projects p on p.id=pl.project_id
    where pl.organisation_id=p_organisation_id
      and pl.learner_id=p_learner_id
      and pl.status='verified'
      and p.project_type='personal'
      and p.status='completed'
  );
$function$;

create or replace function public.khpos_ops_get_worldready_server(
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
  v_can_record boolean;
  v_is_executive boolean;
  v_terms jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
  v_records jsonb := '[]'::jsonb;
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

  v_can_manage := khpos_private.ops_worldready_can_manage(
    p_actor_user_id,p_organisation_id
  );
  v_can_record := khpos_private.ops_worldready_can_record(
    p_actor_user_id,p_organisation_id
  );
  v_is_executive := v_member_role='executive' and not v_can_record;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'sessionLabel',t.session_label,'termCode',t.term_code,
    'termName',t.term_name,'status',t.status,'startDate',t.start_date,'endDate',t.end_date
  ) order by t.start_date desc),'[]'::jsonb)
  into v_terms
  from public.khpos_ops_academic_terms t
  where t.organisation_id=p_organisation_id
    and t.status in ('active','closed');

  if not v_is_executive and v_can_record then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'userId',a.user_id,'roleCode',r.code,'roleTitle',r.title,
      'campusId',a.campus_id,'unitId',a.unit_id,'isMine',a.user_id=p_actor_user_id
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

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',l.id,'displayName',l.display_name,'classLabel',l.class_label,
      'sectionLabel',l.section_label,'campusId',l.campus_id
    ) order by l.display_name),'[]'::jsonb)
    into v_learners
    from public.khpos_ops_learner_anchors l
    where l.organisation_id=p_organisation_id
      and l.status='active'
      and khpos_private.ops_worldready_is_ss3(p_organisation_id,l.id)
      and khpos_private.ops_hpd_learner_visible(
        p_actor_user_id,p_organisation_id,l.id
      );
  end if;

  if not v_is_executive then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',wr.id,'reference',wr.record_reference,'learnerId',wr.learner_id,
      'learnerName',l.display_name,'classLabel',l.class_label,'termId',wr.term_id,
      'ownerAssignmentId',wr.owner_assignment_id,'transitionPathway',wr.transition_pathway,
      'pathwaySummary',wr.pathway_summary,'pathwayReference',wr.pathway_reference,
      'portfolioReference',wr.portfolio_reference,
      'humanPotentialRecordReference',wr.human_potential_record_reference,
      'status',wr.status,'readinessOutcome',wr.readiness_outcome,
      'readinessSummary',wr.readiness_summary,'reviewNote',wr.review_note,
      'submittedAt',wr.submitted_at,'reviewedAt',wr.reviewed_at,
      'isOwner',khpos_private.ops_worldready_actor_assignment(
        p_actor_user_id,p_organisation_id,wr.owner_assignment_id
      ),
      'canManage',v_can_manage,
      'hasCompletedPersonalProject',khpos_private.ops_worldready_has_completed_personal_project(
        p_organisation_id,wr.learner_id
      ),
      'hasVerifiedPortfolio',khpos_private.ops_worldready_has_verified_portfolio(
        p_organisation_id,wr.learner_id
      ),
      'domains',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',d.id,'domainCode',d.domain_code,'status',d.status,
          'reviewNote',d.review_note,'evidenceSummary',d.evidence_summary,
          'evidence',coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',e.id,'evidenceType',e.evidence_type,'title',e.title,
              'evidenceNote',e.evidence_note,'evidenceReference',e.evidence_reference,
              'status',e.status,'verificationNote',e.verification_note
            ) order by e.submitted_at desc)
            from public.khpos_ops_worldready_evidence e
            where e.domain_id=d.id
          ),'[]'::jsonb)
        ) order by d.domain_code)
        from public.khpos_ops_worldready_domains d
        where d.worldready_record_id=wr.id
      ),'[]'::jsonb),
      'actions',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',a.id,'reference',a.action_reference,'domainId',a.domain_id,
          'title',a.title,'expectedChange',a.expected_change,
          'ownerAssignmentId',a.owner_assignment_id,'dueDate',a.due_date,
          'status',a.status,'completionNote',a.completion_note,
          'evidenceReference',a.evidence_reference,
          'isOwner',khpos_private.ops_worldready_actor_assignment(
            p_actor_user_id,p_organisation_id,a.owner_assignment_id
          ),
          'canVerify',v_can_manage
        ) order by a.due_date,a.created_at)
        from public.khpos_ops_worldready_actions a
        where a.worldready_record_id=wr.id
      ),'[]'::jsonb)
    ) order by wr.created_at desc),'[]'::jsonb)
    into v_records
    from public.khpos_ops_worldready_records wr
    join public.khpos_ops_learner_anchors l on l.id=wr.learner_id
    where wr.organisation_id=p_organisation_id
      and khpos_private.ops_hpd_learner_visible(
        p_actor_user_id,p_organisation_id,wr.learner_id
      );
  end if;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canManage',v_can_manage,
    'canRecord',v_can_record,
    'principle','WorldReady is a verified transition profile, not a single score and not a substitute for WAEC/NECO preparation.',
    'terms',v_terms,
    'assignments',v_assignments,
    'learners',v_learners,
    'records',v_records,
    'summary',jsonb_build_object(
      'openRecords',(
        select count(*) from public.khpos_ops_worldready_records
        where organisation_id=p_organisation_id
          and status in ('draft','in_review','ready','ready_with_actions','not_ready')
      ),
      'ready',(
        select count(*) from public.khpos_ops_worldready_records
        where organisation_id=p_organisation_id and readiness_outcome='ready'
      ),
      'readyWithActions',(
        select count(*) from public.khpos_ops_worldready_records
        where organisation_id=p_organisation_id and readiness_outcome='ready_with_actions'
      ),
      'notReady',(
        select count(*) from public.khpos_ops_worldready_records
        where organisation_id=p_organisation_id and readiness_outcome='not_ready'
      )
    )
  );
end;
$function$;

create or replace function public.khpos_ops_create_worldready_record_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_owner_assignment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_id uuid;
  v_reference text := 'WRD-'||upper(substr(gen_random_uuid()::text,1,8));
  v_domain text;
begin
  if not khpos_private.ops_worldready_can_record(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Your operating role cannot open WorldReady records.';
  end if;

  if not khpos_private.ops_hpd_learner_visible(
    p_actor_user_id,p_organisation_id,p_learner_id
  ) then
    raise exception 'This learner is outside your governed visibility.';
  end if;

  if not khpos_private.ops_worldready_is_ss3(
    p_organisation_id,p_learner_id
  ) then
    raise exception 'WorldReady transition is currently reserved to active SS3 learners.';
  end if;

  if not khpos_private.ops_hpd_active_term(
    p_organisation_id,p_term_id,false
  ) then
    raise exception 'WorldReady records must open in an active academic term.';
  end if;

  if not khpos_private.ops_worldready_valid_owner_assignment(
    p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'WorldReady owner assignment is invalid.';
  end if;

  if not khpos_private.ops_worldready_actor_assignment(
    p_actor_user_id,p_organisation_id,p_owner_assignment_id
  ) and not khpos_private.ops_worldready_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the selected owner or WorldReady management can open this record.';
  end if;

  insert into public.khpos_ops_worldready_records(
    organisation_id,learner_id,term_id,record_reference,owner_assignment_id,created_by
  ) values (
    p_organisation_id,p_learner_id,p_term_id,v_reference,p_owner_assignment_id,p_actor_user_id
  ) returning id into v_id;

  foreach v_domain in array array[
    'self_understanding','independent_learning','problem_solving_building',
    'communication','collaboration','leadership_service','financial_capability',
    'digital_responsibility','portfolio_capstone','transition_planning'
  ]::text[] loop
    insert into public.khpos_ops_worldready_domains(
      organisation_id,worldready_record_id,domain_code
    ) values (
      p_organisation_id,v_id,v_domain
    );
  end loop;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,actor_user_id,event_type,to_status
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'worldready_record_created','draft'
  );

  return v_id;
end;
$function$;

create or replace function public.khpos_ops_set_worldready_pathway_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_record_id uuid,
  p_transition_pathway text,
  p_pathway_summary text,
  p_pathway_reference text default null,
  p_portfolio_reference text default null,
  p_human_potential_record_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_record public.khpos_ops_worldready_records%rowtype;
begin
  select * into v_record
  from public.khpos_ops_worldready_records
  where id=p_record_id and organisation_id=p_organisation_id
  for update;

  if v_record.id is null then raise exception 'WorldReady record not found.'; end if;

  if not (
    khpos_private.ops_worldready_actor_assignment(
      p_actor_user_id,p_organisation_id,v_record.owner_assignment_id
    ) or khpos_private.ops_worldready_can_manage(
      p_actor_user_id,p_organisation_id
    )
  ) then
    raise exception 'Only the WorldReady owner or coordinating authority can set transition planning.';
  end if;

  if v_record.status not in ('draft','in_review','ready_with_actions','not_ready') then
    raise exception 'This WorldReady record is not editable.';
  end if;

  if p_transition_pathway not in (
    'higher_education','entrepreneurship','employment',
    'apprenticeship_vocational','service_gap_year','undecided'
  ) then
    raise exception 'Unsupported transition pathway.';
  end if;

  if nullif(btrim(coalesce(p_pathway_summary,'')),'') is null then
    raise exception 'Transition pathway summary is required.';
  end if;

  update public.khpos_ops_worldready_records
  set transition_pathway=p_transition_pathway,
      pathway_summary=left(btrim(p_pathway_summary),5000),
      pathway_reference=left(nullif(btrim(coalesce(p_pathway_reference,'')),''),1000),
      portfolio_reference=left(nullif(btrim(coalesce(p_portfolio_reference,'')),''),1000),
      human_potential_record_reference=left(nullif(btrim(coalesce(p_human_potential_record_reference,'')),''),1000),
      updated_at=now()
  where id=v_record.id;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,actor_user_id,event_type,note
  ) values (
    p_organisation_id,v_record.id,p_actor_user_id,'worldready_pathway_updated',
    left(btrim(p_pathway_summary),3000)
  );
end;
$function$;

create or replace function public.khpos_ops_add_worldready_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_record_id uuid,
  p_domain_code text,
  p_evidence_type text,
  p_title text,
  p_evidence_note text,
  p_evidence_reference text,
  p_source_potential_evidence_id uuid default null,
  p_source_potential_review_id uuid default null,
  p_source_project_id uuid default null,
  p_source_portfolio_link_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_record public.khpos_ops_worldready_records%rowtype;
  v_domain uuid;
  v_id uuid;
begin
  select * into v_record
  from public.khpos_ops_worldready_records
  where id=p_record_id and organisation_id=p_organisation_id;

  if v_record.id is null then raise exception 'WorldReady record not found.'; end if;
  if not khpos_private.ops_worldready_can_record(p_actor_user_id,p_organisation_id) then
    raise exception 'Your operating role cannot record WorldReady evidence.';
  end if;
  if not khpos_private.ops_hpd_learner_visible(
    p_actor_user_id,p_organisation_id,v_record.learner_id
  ) then
    raise exception 'This learner is outside your governed visibility.';
  end if;
  if v_record.status not in ('draft','in_review','ready_with_actions','not_ready') then
    raise exception 'This WorldReady record is not accepting evidence.';
  end if;

  select id into v_domain
  from public.khpos_ops_worldready_domains
  where worldready_record_id=v_record.id
    and domain_code=p_domain_code;

  if v_domain is null then raise exception 'WorldReady domain not found.'; end if;

  if p_evidence_type not in (
    'potential_evidence','potential_review','personal_project','portfolio',
    'leadership','financial_capability','skills','academic','external','other'
  ) then
    raise exception 'Unsupported WorldReady evidence type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'WorldReady evidence title, note and reference are required.';
  end if;

  if p_source_potential_evidence_id is not null
     and not exists(
       select 1 from public.khpos_ops_potential_evidence e
       where e.id=p_source_potential_evidence_id
         and e.organisation_id=p_organisation_id
         and e.learner_id=v_record.learner_id
         and e.status='active'
     ) then
    raise exception 'Linked potential evidence is invalid for this learner.';
  end if;

  if p_source_potential_review_id is not null
     and not exists(
       select 1 from public.khpos_ops_potential_reviews r
       where r.id=p_source_potential_review_id
         and r.organisation_id=p_organisation_id
         and r.learner_id=v_record.learner_id
         and r.status='approved'
     ) then
    raise exception 'Linked Potential Progress Review must be approved for this learner.';
  end if;

  if p_source_project_id is not null
     and not exists(
       select 1
       from public.khpos_ops_projects p
       join public.khpos_ops_project_members pm on pm.project_id=p.id
       where p.id=p_source_project_id
         and p.organisation_id=p_organisation_id
         and p.status='completed'
         and pm.learner_id=v_record.learner_id
         and pm.status in ('active','completed')
     ) then
    raise exception 'Linked project must be a completed project for this learner.';
  end if;

  if p_source_portfolio_link_id is not null
     and not exists(
       select 1 from public.khpos_ops_project_portfolio_links pl
       where pl.id=p_source_portfolio_link_id
         and pl.organisation_id=p_organisation_id
         and pl.learner_id=v_record.learner_id
         and pl.status='verified'
     ) then
    raise exception 'Linked portfolio reference must be verified for this learner.';
  end if;

  insert into public.khpos_ops_worldready_evidence(
    organisation_id,worldready_record_id,domain_id,evidence_type,title,
    evidence_note,evidence_reference,source_potential_evidence_id,
    source_potential_review_id,source_project_id,source_portfolio_link_id,
    submitted_by
  ) values (
    p_organisation_id,v_record.id,v_domain,p_evidence_type,left(btrim(p_title),240),
    left(btrim(p_evidence_note),5000),left(btrim(p_evidence_reference),1000),
    p_source_potential_evidence_id,p_source_potential_review_id,
    p_source_project_id,p_source_portfolio_link_id,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,domain_id,evidence_id,
    actor_user_id,event_type,note
  ) values (
    p_organisation_id,v_record.id,v_domain,v_id,p_actor_user_id,
    'worldready_evidence_submitted',left(btrim(p_title),240)
  );

  return v_id;
end;
$function$;

create or replace function public.khpos_ops_worldready_evidence_action_server(
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
  v_e public.khpos_ops_worldready_evidence%rowtype;
  v_domain public.khpos_ops_worldready_domains%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_e
  from public.khpos_ops_worldready_evidence
  where id=p_evidence_id and organisation_id=p_organisation_id
  for update;

  if v_e.id is null then raise exception 'WorldReady evidence not found.'; end if;

  select * into v_domain
  from public.khpos_ops_worldready_domains
  where id=v_e.domain_id;

  if p_action='verify' then
    if not khpos_private.ops_worldready_can_manage(p_actor_user_id,p_organisation_id) then
      raise exception 'Only WorldReady coordinating roles can verify evidence.';
    end if;
    if v_e.submitted_by=p_actor_user_id then
      raise exception 'The WorldReady evidence submitter cannot verify their own evidence.';
    end if;
    if v_e.status not in ('submitted','returned') then
      raise exception 'Only submitted or returned evidence can be verified.';
    end if;

    update public.khpos_ops_worldready_evidence
    set status='verified',verified_by=p_actor_user_id,verified_at=now(),
        verification_note=left(v_note,4000)
    where id=v_e.id;

  elsif p_action='return' then
    if not khpos_private.ops_worldready_can_manage(p_actor_user_id,p_organisation_id) then
      raise exception 'Only WorldReady coordinating roles can return evidence.';
    end if;
    if v_e.status<>'submitted' then raise exception 'Only submitted evidence can be returned.'; end if;
    if v_note is null then raise exception 'Return note is required.'; end if;

    update public.khpos_ops_worldready_evidence
    set status='returned',returned_by=p_actor_user_id,returned_at=now(),
        return_note=left(v_note,4000)
    where id=v_e.id;

  elsif p_action='withdraw' then
    if v_e.submitted_by<>p_actor_user_id
       and not khpos_private.ops_worldready_can_manage(p_actor_user_id,p_organisation_id) then
      raise exception 'Only the evidence submitter or coordinating authority can withdraw evidence.';
    end if;
    if v_e.status='withdrawn' then raise exception 'Evidence is already withdrawn.'; end if;
    if v_note is null then raise exception 'Withdrawal reason is required.'; end if;

    update public.khpos_ops_worldready_evidence
    set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
        withdrawal_note=left(v_note,4000)
    where id=v_e.id;
  else
    raise exception 'Unsupported WorldReady evidence action.';
  end if;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,domain_id,evidence_id,
    actor_user_id,event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_e.worldready_record_id,v_e.domain_id,v_e.id,
    p_actor_user_id,'worldready_evidence_'||p_action,v_e.status,
    (select status from public.khpos_ops_worldready_evidence where id=v_e.id),
    left(v_note,3000)
  );
end;
$function$;

create or replace function public.khpos_ops_review_worldready_domain_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_record_id uuid,
  p_domain_code text,
  p_status text,
  p_review_note text,
  p_evidence_summary text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_record public.khpos_ops_worldready_records%rowtype;
  v_domain public.khpos_ops_worldready_domains%rowtype;
begin
  if not khpos_private.ops_worldready_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only WorldReady coordinating roles can review readiness domains.';
  end if;

  select * into v_record
  from public.khpos_ops_worldready_records
  where id=p_record_id and organisation_id=p_organisation_id
  for update;

  if v_record.id is null then raise exception 'WorldReady record not found.'; end if;
  if v_record.status not in ('draft','in_review','ready_with_actions','not_ready') then
    raise exception 'This WorldReady record is not reviewable.';
  end if;

  select * into v_domain
  from public.khpos_ops_worldready_domains
  where worldready_record_id=v_record.id and domain_code=p_domain_code
  for update;

  if v_domain.id is null then raise exception 'WorldReady domain not found.'; end if;
  if p_status not in ('not_evidenced','emerging','demonstrated') then
    raise exception 'Unsupported readiness-domain status.';
  end if;
  if nullif(btrim(coalesce(p_review_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_summary,'')),'') is null then
    raise exception 'Domain review note and evidence summary are required.';
  end if;

  if p_status='demonstrated'
     and not exists(
       select 1
       from public.khpos_ops_worldready_evidence e
       where e.domain_id=v_domain.id
         and e.status='verified'
     ) then
    raise exception 'A domain cannot be Demonstrated without independently verified evidence.';
  end if;

  update public.khpos_ops_worldready_domains
  set status=p_status,review_note=left(btrim(p_review_note),4000),
      evidence_summary=left(btrim(p_evidence_summary),5000),
      reviewed_by=p_actor_user_id,reviewed_at=now(),updated_at=now()
  where id=v_domain.id;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,domain_id,actor_user_id,
    event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_record.id,v_domain.id,p_actor_user_id,
    'worldready_domain_reviewed',v_domain.status,p_status,
    left(btrim(p_review_note),3000)
  );
end;
$function$;

create or replace function public.khpos_ops_create_worldready_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_record_id uuid,
  p_domain_code text,
  p_title text,
  p_expected_change text,
  p_owner_assignment_id uuid,
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_record public.khpos_ops_worldready_records%rowtype;
  v_domain uuid;
  v_id uuid;
  v_reference text := 'WRA-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_worldready_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only WorldReady coordinating roles can create transition actions.';
  end if;

  select * into v_record
  from public.khpos_ops_worldready_records
  where id=p_record_id and organisation_id=p_organisation_id;

  if v_record.id is null then raise exception 'WorldReady record not found.'; end if;

  select id into v_domain
  from public.khpos_ops_worldready_domains
  where worldready_record_id=v_record.id and domain_code=p_domain_code;

  if v_domain is null then raise exception 'WorldReady domain not found.'; end if;
  if not khpos_private.ops_worldready_valid_owner_assignment(
    p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'Transition-action owner assignment is invalid.';
  end if;
  if p_due_date<current_date then raise exception 'Transition-action due date cannot be in the past.'; end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_expected_change,'')),'') is null then
    raise exception 'Transition-action title and expected change are required.';
  end if;

  insert into public.khpos_ops_worldready_actions(
    organisation_id,worldready_record_id,domain_id,action_reference,
    title,expected_change,owner_assignment_id,due_date,created_by
  ) values (
    p_organisation_id,v_record.id,v_domain,v_reference,
    left(btrim(p_title),240),left(btrim(p_expected_change),5000),
    p_owner_assignment_id,p_due_date,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,domain_id,action_id,
    actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_record.id,v_domain,v_id,p_actor_user_id,
    'worldready_action_created','open',left(btrim(p_title),240)
  );

  return v_id;
end;
$function$;

create or replace function public.khpos_ops_worldready_action_server(
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
as $function$
declare
  v_action public.khpos_ops_worldready_actions%rowtype;
  v_from text;
  v_to text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_reference text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
begin
  select * into v_action
  from public.khpos_ops_worldready_actions
  where id=p_action_id and organisation_id=p_organisation_id
  for update;

  if v_action.id is null then raise exception 'WorldReady transition action not found.'; end if;
  v_from := v_action.status;

  if p_action='start' then
    if not khpos_private.ops_worldready_actor_assignment(
      p_actor_user_id,p_organisation_id,v_action.owner_assignment_id
    ) then
      raise exception 'Only the transition-action owner can start this action.';
    end if;
    if v_action.status<>'open' then raise exception 'Only an open action can be started.'; end if;
    v_to := 'in_progress';
    update public.khpos_ops_worldready_actions
    set status=v_to,updated_at=now()
    where id=v_action.id;

  elsif p_action='submit_evidence' then
    if not khpos_private.ops_worldready_actor_assignment(
      p_actor_user_id,p_organisation_id,v_action.owner_assignment_id
    ) then
      raise exception 'Only the transition-action owner can submit evidence.';
    end if;
    if v_action.status not in ('open','in_progress') then
      raise exception 'Only open or in-progress actions can submit evidence.';
    end if;
    if v_note is null or v_reference is null then
      raise exception 'Completion note and evidence reference are required.';
    end if;
    v_to := 'evidence_submitted';
    update public.khpos_ops_worldready_actions
    set status=v_to,completion_note=left(v_note,5000),
        evidence_reference=left(v_reference,1000),
        submitted_by=p_actor_user_id,submitted_at=now(),updated_at=now()
    where id=v_action.id;

  elsif p_action='verify' then
    if not khpos_private.ops_worldready_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only WorldReady coordinating roles can verify transition actions.';
    end if;
    if v_action.status<>'evidence_submitted' then
      raise exception 'Only submitted transition evidence can be verified.';
    end if;
    if khpos_private.ops_worldready_actor_assignment(
      p_actor_user_id,p_organisation_id,v_action.owner_assignment_id
    ) then
      raise exception 'The transition-action owner cannot verify their own completion.';
    end if;
    v_to := 'verified';
    update public.khpos_ops_worldready_actions
    set status=v_to,verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
    where id=v_action.id;

  elsif p_action='reopen' then
    if not khpos_private.ops_worldready_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only WorldReady coordinating roles can reopen transition actions.';
    end if;
    if v_action.status not in ('evidence_submitted','verified','waived') then
      raise exception 'Only submitted, verified or waived actions can be reopened.';
    end if;
    if v_note is null then raise exception 'Reopen reason is required.'; end if;
    v_to := 'in_progress';
    update public.khpos_ops_worldready_actions
    set status=v_to,verified_by=null,verified_at=null,
        waived_by=null,waived_at=null,waiver_reason=null,updated_at=now()
    where id=v_action.id;

  elsif p_action='waive' then
    if not khpos_private.ops_worldready_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only WorldReady coordinating roles can waive transition actions.';
    end if;
    if v_note is null then raise exception 'Waiver reason is required.'; end if;
    v_to := 'waived';
    update public.khpos_ops_worldready_actions
    set status=v_to,waived_by=p_actor_user_id,waived_at=now(),
        waiver_reason=left(v_note,5000),updated_at=now()
    where id=v_action.id;

  else
    raise exception 'Unsupported WorldReady transition-action operation.';
  end if;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,domain_id,action_id,
    actor_user_id,event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_action.worldready_record_id,v_action.domain_id,v_action.id,
    p_actor_user_id,'worldready_action_'||p_action,v_from,v_to,left(v_note,3000),
    jsonb_build_object('evidenceReference',v_reference)
  );
end;
$function$;

create or replace function public.khpos_ops_submit_worldready_review_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_record_id uuid
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_record public.khpos_ops_worldready_records%rowtype;
begin
  select * into v_record
  from public.khpos_ops_worldready_records
  where id=p_record_id and organisation_id=p_organisation_id
  for update;

  if v_record.id is null then raise exception 'WorldReady record not found.'; end if;
  if not (
    khpos_private.ops_worldready_actor_assignment(
      p_actor_user_id,p_organisation_id,v_record.owner_assignment_id
    ) or khpos_private.ops_worldready_can_manage(
      p_actor_user_id,p_organisation_id
    )
  ) then
    raise exception 'Only the WorldReady owner or coordinating authority can submit this record.';
  end if;
  if v_record.status not in ('draft','ready_with_actions','not_ready') then
    raise exception 'This WorldReady record cannot be submitted from its current state.';
  end if;

  if v_record.transition_pathway is null
     or nullif(btrim(coalesce(v_record.pathway_summary,'')),'') is null then
    raise exception 'Set the learner transition pathway and plan before review.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_worldready_domains d
    where d.worldready_record_id=v_record.id
      and d.reviewed_at is null
  ) then
    raise exception 'Every WorldReady domain must be reviewed before submission.';
  end if;

  update public.khpos_ops_worldready_records
  set status='in_review',submitted_by=p_actor_user_id,submitted_at=now(),updated_at=now()
  where id=v_record.id;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,actor_user_id,event_type,
    from_status,to_status
  ) values (
    p_organisation_id,v_record.id,p_actor_user_id,
    'worldready_submitted',v_record.status,'in_review'
  );
end;
$function$;

create or replace function public.khpos_ops_decide_worldready_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_record_id uuid,
  p_outcome text,
  p_readiness_summary text,
  p_review_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_record public.khpos_ops_worldready_records%rowtype;
begin
  if not khpos_private.ops_worldready_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only WorldReady coordinating roles can record the final readiness review.';
  end if;

  select * into v_record
  from public.khpos_ops_worldready_records
  where id=p_record_id and organisation_id=p_organisation_id
  for update;

  if v_record.id is null then raise exception 'WorldReady record not found.'; end if;
  if v_record.status<>'in_review' then
    raise exception 'WorldReady readiness decision requires an In Review record.';
  end if;
  if p_outcome not in ('ready','ready_with_actions','not_ready') then
    raise exception 'Unsupported WorldReady readiness outcome.';
  end if;
  if nullif(btrim(coalesce(p_readiness_summary,'')),'') is null
     or nullif(btrim(coalesce(p_review_note,'')),'') is null then
    raise exception 'Readiness summary and review note are required.';
  end if;

  if p_outcome='ready' then
    if exists(
      select 1
      from public.khpos_ops_worldready_domains d
      where d.worldready_record_id=v_record.id
        and d.status<>'demonstrated'
    ) then
      raise exception 'Ready requires all ten WorldReady domains to be Demonstrated.';
    end if;

    if not khpos_private.ops_worldready_has_completed_personal_project(
      p_organisation_id,v_record.learner_id
    ) then
      raise exception 'Ready requires a completed SS3 Personal Project/capstone.';
    end if;

    if not khpos_private.ops_worldready_has_verified_portfolio(
      p_organisation_id,v_record.learner_id
    ) then
      raise exception 'Ready requires a verified learner-shared Personal Project portfolio reference.';
    end if;

    if exists(
      select 1
      from public.khpos_ops_worldready_actions a
      where a.worldready_record_id=v_record.id
        and a.status not in ('verified','waived','cancelled')
    ) then
      raise exception 'Ready cannot be recorded while transition actions remain unresolved.';
    end if;

  elsif p_outcome='ready_with_actions' then
    if not exists(
      select 1
      from public.khpos_ops_worldready_domains d
      where d.worldready_record_id=v_record.id
        and d.status<>'demonstrated'
    ) then
      raise exception 'Ready With Actions is for a learner with one or more unresolved readiness domains.';
    end if;

    if exists(
      select 1
      from public.khpos_ops_worldready_domains d
      where d.worldready_record_id=v_record.id
        and d.status<>'demonstrated'
        and not exists(
          select 1
          from public.khpos_ops_worldready_actions a
          where a.domain_id=d.id
            and a.status in ('open','in_progress','evidence_submitted','verified')
        )
    ) then
      raise exception 'Every unresolved readiness domain needs an owned transition action.';
    end if;

  else
    if not exists(
      select 1
      from public.khpos_ops_worldready_domains d
      where d.worldready_record_id=v_record.id
        and d.status in ('not_evidenced','emerging')
    ) then
      raise exception 'Not Ready requires at least one readiness domain that is not yet Demonstrated.';
    end if;
  end if;

  update public.khpos_ops_worldready_records
  set status=p_outcome,readiness_outcome=p_outcome,
      readiness_summary=left(btrim(p_readiness_summary),6000),
      reviewed_by=p_actor_user_id,reviewed_at=now(),
      review_note=left(btrim(p_review_note),6000),updated_at=now()
  where id=v_record.id;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_record.id,p_actor_user_id,'worldready_decided',
    v_record.status,p_outcome,left(btrim(p_review_note),3000)
  );
end;
$function$;

create or replace function public.khpos_ops_worldready_record_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_record_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_record public.khpos_ops_worldready_records%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_record
  from public.khpos_ops_worldready_records
  where id=p_record_id and organisation_id=p_organisation_id
  for update;

  if v_record.id is null then raise exception 'WorldReady record not found.'; end if;

  if p_action='reopen' then
    if not khpos_private.ops_worldready_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only WorldReady coordinating roles can reopen records.';
    end if;
    if v_record.status not in ('ready_with_actions','not_ready') then
      raise exception 'Only Ready With Actions or Not Ready records can be reopened.';
    end if;
    if v_note is null then raise exception 'Reopen reason is required.'; end if;

    update public.khpos_ops_worldready_records
    set status='draft',readiness_outcome=null,readiness_summary=null,
        reviewed_by=null,reviewed_at=null,review_note=null,updated_at=now()
    where id=v_record.id;

  elsif p_action='close' then
    if not khpos_private.ops_worldready_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only WorldReady coordinating roles can close records.';
    end if;
    if v_record.status not in ('ready','ready_with_actions','not_ready') then
      raise exception 'Only a decided WorldReady record can be closed.';
    end if;
    if v_record.status='ready_with_actions'
       and exists(
         select 1
         from public.khpos_ops_worldready_actions a
         where a.worldready_record_id=v_record.id
           and a.status not in ('verified','waived','cancelled')
       ) then
      raise exception 'Ready With Actions cannot close until transition actions are resolved.';
    end if;

    update public.khpos_ops_worldready_records
    set status='closed',closed_by=p_actor_user_id,closed_at=now(),updated_at=now()
    where id=v_record.id;

  elsif p_action='cancel' then
    if not khpos_private.ops_worldready_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only WorldReady coordinating roles can cancel records.';
    end if;
    if v_record.status='closed' then raise exception 'Closed WorldReady records cannot be cancelled.'; end if;
    if v_note is null then raise exception 'Cancellation reason is required.'; end if;

    update public.khpos_ops_worldready_records
    set status='cancelled',cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,5000),updated_at=now()
    where id=v_record.id;
  else
    raise exception 'Unsupported WorldReady record action.';
  end if;

  insert into public.khpos_ops_worldready_events(
    organisation_id,worldready_record_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_record.id,p_actor_user_id,'worldready_record_'||p_action,
    v_record.status,
    (select status from public.khpos_ops_worldready_records where id=v_record.id),
    left(v_note,3000)
  );
end;
$function$;

revoke execute on function khpos_private.ops_worldready_can_manage(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_worldready_can_record(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_worldready_actor_assignment(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_worldready_valid_owner_assignment(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_worldready_is_ss3(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_worldready_has_completed_personal_project(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_worldready_has_verified_portfolio(uuid,uuid)
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_worldready_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_worldready_record_server(uuid,uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_set_worldready_pathway_server(uuid,uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_worldready_evidence_server(uuid,uuid,uuid,text,text,text,text,text,uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_worldready_evidence_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_review_worldready_domain_server(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_worldready_action_server(uuid,uuid,uuid,text,text,text,uuid,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_worldready_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_submit_worldready_review_server(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_decide_worldready_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_worldready_record_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_worldready_can_manage(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_worldready_can_record(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_worldready_actor_assignment(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_worldready_valid_owner_assignment(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_worldready_is_ss3(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_worldready_has_completed_personal_project(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_worldready_has_verified_portfolio(uuid,uuid) to service_role;

grant execute on function public.khpos_ops_get_worldready_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_worldready_record_server(uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_set_worldready_pathway_server(uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_add_worldready_evidence_server(uuid,uuid,uuid,text,text,text,text,text,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_worldready_evidence_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_review_worldready_domain_server(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_worldready_action_server(uuid,uuid,uuid,text,text,text,uuid,date) to service_role;
grant execute on function public.khpos_ops_worldready_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_submit_worldready_review_server(uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_decide_worldready_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_worldready_record_action_server(uuid,uuid,uuid,text,text) to service_role;
