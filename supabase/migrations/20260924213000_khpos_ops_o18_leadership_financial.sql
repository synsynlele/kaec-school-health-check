create extension if not exists pgcrypto;

-- O18: Leadership Development & Financial Capability.
-- KHP-OS governs school-owned opportunities, delivery and verified evidence.
-- PipuPath remains learner-facing/private; only deliberately shared references enter O18.

create table if not exists public.khpos_ops_leadership_opportunities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id) on delete restrict,
  opportunity_reference text not null,
  opportunity_type text not null
    check (opportunity_type in (
      'leadership_lab','service','initiative','team_leadership','representation',
      'problem_solving','peer_support','event_role','council_service',
      'community_contribution','other'
    )),
  title text not null,
  purpose text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  planned_start_date date not null,
  planned_end_date date,
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
  unique (organisation_id,opportunity_reference),
  check (planned_end_date is null or planned_end_date>=planned_start_date)
);

create index if not exists idx_khpos_ops_leadership_opportunity_term
  on public.khpos_ops_leadership_opportunities(organisation_id,term_id,status,planned_start_date);
create index if not exists idx_khpos_ops_leadership_opportunity_campus
  on public.khpos_ops_leadership_opportunities(campus_id,status,planned_start_date);
create index if not exists idx_khpos_ops_leadership_opportunity_owner
  on public.khpos_ops_leadership_opportunities(owner_assignment_id,status);

create table if not exists public.khpos_ops_financial_capability_activities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id) on delete restrict,
  activity_reference text not null,
  activity_type text not null
    check (activity_type in (
      'financial_literacy_lab','budget_challenge','saving_plan','costing_practice',
      'pricing_practice','profit_loss_practice','opportunity_cost',
      'responsible_spending','value_creation','investment_concepts','other'
    )),
  title text not null,
  purpose text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  activity_date date not null,
  status text not null default 'planned'
    check (status in ('planned','delivered','missed','cancelled')),
  delivery_note text,
  evidence_reference text,
  recovery_due_date date,
  recovery_status text not null default 'not_required'
    check (recovery_status in ('not_required','required','planned','recovered','waived')),
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
  unique (organisation_id,activity_reference)
);

create index if not exists idx_khpos_ops_financial_activity_term
  on public.khpos_ops_financial_capability_activities(
    organisation_id,term_id,status,activity_date
  );
create index if not exists idx_khpos_ops_financial_activity_campus
  on public.khpos_ops_financial_capability_activities(campus_id,status,activity_date);
create index if not exists idx_khpos_ops_financial_activity_owner
  on public.khpos_ops_financial_capability_activities(owner_assignment_id,status,activity_date);
create index if not exists idx_khpos_ops_financial_activity_issue
  on public.khpos_ops_financial_capability_activities(issue_id)
  where issue_id is not null;

create table if not exists public.khpos_ops_hpd_capability_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  domain text not null check (domain in ('leadership','financial_capability')),
  leadership_opportunity_id uuid references public.khpos_ops_leadership_opportunities(id) on delete set null,
  financial_activity_id uuid references public.khpos_ops_financial_capability_activities(id) on delete set null,
  evidence_reference_code text not null,
  dimension text not null,
  evidence_note text not null,
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
  unique (organisation_id,evidence_reference_code),
  check (
    (domain='leadership' and financial_activity_id is null)
    or
    (domain='financial_capability' and leadership_opportunity_id is null)
  )
);

create index if not exists idx_khpos_ops_hpd_capability_evidence_learner
  on public.khpos_ops_hpd_capability_evidence(learner_id,term_id,domain,status,observed_at desc);
create index if not exists idx_khpos_ops_hpd_capability_evidence_leadership
  on public.khpos_ops_hpd_capability_evidence(leadership_opportunity_id,status)
  where leadership_opportunity_id is not null;
create index if not exists idx_khpos_ops_hpd_capability_evidence_financial
  on public.khpos_ops_hpd_capability_evidence(financial_activity_id,status)
  where financial_activity_id is not null;
create index if not exists idx_khpos_ops_hpd_capability_evidence_recorder
  on public.khpos_ops_hpd_capability_evidence(recorded_by,status,created_at desc);
create index if not exists idx_khpos_ops_hpd_capability_evidence_potential
  on public.khpos_ops_hpd_capability_evidence(potential_evidence_id)
  where potential_evidence_id is not null;

create table if not exists public.khpos_ops_hpd_capability_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  leadership_opportunity_id uuid references public.khpos_ops_leadership_opportunities(id) on delete cascade,
  financial_activity_id uuid references public.khpos_ops_financial_capability_activities(id) on delete cascade,
  evidence_id uuid references public.khpos_ops_hpd_capability_evidence(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(leadership_opportunity_id,financial_activity_id,evidence_id)>=1)
);

create index if not exists idx_khpos_ops_hpd_capability_events_leadership
  on public.khpos_ops_hpd_capability_events(leadership_opportunity_id,created_at desc)
  where leadership_opportunity_id is not null;
create index if not exists idx_khpos_ops_hpd_capability_events_financial
  on public.khpos_ops_hpd_capability_events(financial_activity_id,created_at desc)
  where financial_activity_id is not null;
create index if not exists idx_khpos_ops_hpd_capability_events_evidence
  on public.khpos_ops_hpd_capability_events(evidence_id,created_at desc)
  where evidence_id is not null;

alter table public.khpos_ops_leadership_opportunities enable row level security;
alter table public.khpos_ops_financial_capability_activities enable row level security;
alter table public.khpos_ops_hpd_capability_evidence enable row level security;
alter table public.khpos_ops_hpd_capability_events enable row level security;

revoke all privileges on table public.khpos_ops_leadership_opportunities from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_financial_capability_activities from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_hpd_capability_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_hpd_capability_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_leadership_opportunities to service_role;
grant select,insert,update,delete on table public.khpos_ops_financial_capability_activities to service_role;
grant select,insert,update,delete on table public.khpos_ops_hpd_capability_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_hpd_capability_events to service_role;

create or replace function khpos_private.ops_capability_is_pure_executive(
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
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and m.role='executive'
  )
  and not khpos_private.ops_hpd_can_record(
    p_actor_user_id,p_organisation_id
  );
$$;

create or replace function khpos_private.ops_capability_actor_assignment(
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

create or replace function khpos_private.ops_capability_valid_dimension(
  p_domain text,
  p_dimension text
)
returns boolean
language sql
immutable
as $$
  select case
    when p_domain='leadership' then p_dimension in (
      'initiative','responsibility','service','communication','conflict_handling',
      'reliability','decision_making','team_contribution','mobilisation',
      'problem_solving','other'
    )
    when p_domain='financial_capability' then p_dimension in (
      'budgeting','saving','costing','pricing','revenue_profit',
      'opportunity_cost','responsible_spending','record_keeping',
      'value_creation','investment_concepts','other'
    )
    else false
  end;
$$;

create or replace function public.khpos_ops_get_leadership_financial_server(
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
  v_can_record boolean;
  v_can_coordinate boolean;
  v_is_executive boolean;
  v_terms jsonb := '[]'::jsonb;
  v_campuses jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
  v_leadership jsonb := '[]'::jsonb;
  v_financial jsonb := '[]'::jsonb;
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

  v_can_record := khpos_private.ops_hpd_can_record(
    p_actor_user_id,p_organisation_id
  );
  v_can_coordinate := khpos_private.ops_hpd_can_coordinate(
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
  where c.organisation_id=p_organisation_id
    and c.status='active';

  if v_can_record or v_can_coordinate then
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
      'id',o.id,'reference',o.opportunity_reference,'termId',o.term_id,
      'campusId',o.campus_id,'opportunityType',o.opportunity_type,
      'title',o.title,'purpose',o.purpose,
      'ownerAssignmentId',o.owner_assignment_id,
      'plannedStartDate',o.planned_start_date,'plannedEndDate',o.planned_end_date,
      'status',o.status,'completionNote',o.completion_note,
      'evidenceReference',o.evidence_reference,
      'isOwner',exists(
        select 1 from public.khpos_ops_role_assignments a
        where a.id=o.owner_assignment_id and a.user_id=p_actor_user_id and a.status='active'
      ),
      'canManage',v_can_coordinate
    ) order by o.planned_start_date desc,o.created_at desc),'[]'::jsonb)
    into v_leadership
    from public.khpos_ops_leadership_opportunities o
    where o.organisation_id=p_organisation_id
      and (
        v_can_coordinate
        or exists(
          select 1
          from public.khpos_ops_role_assignments a
          where a.id=o.owner_assignment_id
            and a.user_id=p_actor_user_id
            and a.status='active'
        )
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',f.id,'reference',f.activity_reference,'termId',f.term_id,
      'campusId',f.campus_id,'activityType',f.activity_type,
      'title',f.title,'purpose',f.purpose,
      'ownerAssignmentId',f.owner_assignment_id,'activityDate',f.activity_date,
      'status',f.status,'deliveryNote',f.delivery_note,
      'evidenceReference',f.evidence_reference,
      'recoveryDueDate',f.recovery_due_date,'recoveryStatus',f.recovery_status,
      'issueId',f.issue_id,
      'isOwner',exists(
        select 1 from public.khpos_ops_role_assignments a
        where a.id=f.owner_assignment_id and a.user_id=p_actor_user_id and a.status='active'
      ),
      'canManage',v_can_coordinate
    ) order by f.activity_date desc,f.created_at desc),'[]'::jsonb)
    into v_financial
    from public.khpos_ops_financial_capability_activities f
    where f.organisation_id=p_organisation_id
      and (
        v_can_coordinate
        or exists(
          select 1
          from public.khpos_ops_role_assignments a
          where a.id=f.owner_assignment_id
            and a.user_id=p_actor_user_id
            and a.status='active'
        )
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'learnerId',e.learner_id,'learnerName',l.display_name,
      'termId',e.term_id,'domain',e.domain,'dimension',e.dimension,
      'leadershipOpportunityId',e.leadership_opportunity_id,
      'financialActivityId',e.financial_activity_id,
      'reference',e.evidence_reference_code,
      'evidenceNote',e.evidence_note,'evidenceReference',e.evidence_reference,
      'observedAt',e.observed_at,'recordedBy',e.recorded_by,
      'status',e.status,'verifiedBy',e.verified_by,
      'verifiedAt',e.verified_at,'verificationNote',e.verification_note,
      'returnNote',e.return_note,'potentialEvidenceId',e.potential_evidence_id,
      'isRecorder',e.recorded_by=p_actor_user_id,
      'canVerify',v_can_coordinate and e.recorded_by<>p_actor_user_id
    ) order by e.observed_at desc,e.created_at desc),'[]'::jsonb)
    into v_evidence
    from public.khpos_ops_hpd_capability_evidence e
    join public.khpos_ops_learner_anchors l on l.id=e.learner_id
    where e.organisation_id=p_organisation_id
      and (
        v_can_coordinate
        or e.recorded_by=p_actor_user_id
      )
      and (
        v_can_coordinate
        or khpos_private.ops_hpd_learner_visible(
          p_actor_user_id,p_organisation_id,e.learner_id
        )
      );
  end if;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canRecord',v_can_record,
    'canCoordinate',v_can_coordinate,
    'executiveAggregateOnly',v_is_executive,
    'principle','Leadership and financial capability are demonstrated through responsibility, decisions, application and evidence—not attendance, titles, popularity or numeric ranking.',
    'privacyBoundary','PipuPath remains learner-facing/private. O18 stores only school-owned operational records and learner-shared references deliberately provided for institutional use.',
    'terms',v_terms,
    'campuses',v_campuses,
    'assignments',v_assignments,
    'learners',case when v_is_executive then '[]'::jsonb else v_learners end,
    'leadershipOpportunities',v_leadership,
    'financialActivities',v_financial,
    'evidence',v_evidence,
    'summary',jsonb_build_object(
      'leadershipOpportunities',(
        select count(*) from public.khpos_ops_leadership_opportunities o
        where o.organisation_id=p_organisation_id and o.status in ('planned','active')
      ),
      'financialActivitiesPlanned',(
        select count(*) from public.khpos_ops_financial_capability_activities f
        where f.organisation_id=p_organisation_id and f.status='planned'
      ),
      'financialActivitiesMissed',(
        select count(*) from public.khpos_ops_financial_capability_activities f
        where f.organisation_id=p_organisation_id and f.status='missed'
      ),
      'submittedEvidence',(
        select count(*) from public.khpos_ops_hpd_capability_evidence e
        where e.organisation_id=p_organisation_id and e.status='submitted'
      ),
      'verifiedLeadershipEvidence',(
        select count(*) from public.khpos_ops_hpd_capability_evidence e
        where e.organisation_id=p_organisation_id
          and e.domain='leadership' and e.status='verified'
      ),
      'verifiedFinancialEvidence',(
        select count(*) from public.khpos_ops_hpd_capability_evidence e
        where e.organisation_id=p_organisation_id
          and e.domain='financial_capability' and e.status='verified'
      )
    )
  );
end;
$$;

create or replace function public.khpos_ops_create_leadership_opportunity_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_campus_id uuid,
  p_opportunity_type text,
  p_title text,
  p_purpose text,
  p_owner_assignment_id uuid,
  p_planned_start_date date,
  p_planned_end_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
  v_ref text := 'LDR-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_hpd_can_record(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Your operating role cannot create Leadership Development opportunities.';
  end if;

  if not khpos_private.ops_hpd_active_term(
    p_organisation_id,p_term_id,false
  ) then
    raise exception 'Leadership opportunity must belong to the active academic term.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_campuses c
    where c.id=p_campus_id
      and c.organisation_id=p_organisation_id
      and c.status='active'
  ) then
    raise exception 'Leadership opportunity campus must be active in this organisation.';
  end if;

  if p_opportunity_type not in (
    'leadership_lab','service','initiative','team_leadership','representation',
    'problem_solving','peer_support','event_role','council_service',
    'community_contribution','other'
  ) then
    raise exception 'Unsupported leadership opportunity type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_purpose,'')),'') is null then
    raise exception 'Leadership opportunity title and purpose are required.';
  end if;

  if p_planned_start_date is null
     or (p_planned_end_date is not null and p_planned_end_date<p_planned_start_date) then
    raise exception 'Leadership opportunity dates are invalid.';
  end if;

  if not khpos_private.ops_hpd_valid_owner_assignment(
    p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'Leadership opportunity owner must hold an active KNS operating assignment.';
  end if;

  if not khpos_private.ops_hpd_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_capability_actor_assignment(
    p_actor_user_id,p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'Non-coordinating staff can only create leadership opportunities they personally own.';
  end if;

  insert into public.khpos_ops_leadership_opportunities(
    organisation_id,term_id,campus_id,opportunity_reference,opportunity_type,
    title,purpose,owner_assignment_id,planned_start_date,planned_end_date,created_by
  ) values (
    p_organisation_id,p_term_id,p_campus_id,v_ref,p_opportunity_type,
    left(btrim(p_title),240),left(btrim(p_purpose),5000),
    p_owner_assignment_id,p_planned_start_date,p_planned_end_date,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_hpd_capability_events(
    organisation_id,leadership_opportunity_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'leadership_opportunity_created',
    'planned',left(btrim(p_title),240)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_leadership_opportunity_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_opportunity_id uuid,
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
  v_o public.khpos_ops_leadership_opportunities%rowtype;
  v_is_owner boolean;
  v_can_manage boolean;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_to text;
begin
  select * into v_o
  from public.khpos_ops_leadership_opportunities
  where id=p_opportunity_id and organisation_id=p_organisation_id
  for update;

  if v_o.id is null then raise exception 'Leadership opportunity not found.'; end if;

  v_is_owner := khpos_private.ops_capability_actor_assignment(
    p_actor_user_id,p_organisation_id,v_o.owner_assignment_id
  );
  v_can_manage := khpos_private.ops_hpd_can_coordinate(
    p_actor_user_id,p_organisation_id
  );

  if not v_is_owner and not v_can_manage then
    raise exception 'Only the opportunity owner or Human Potential coordinating authority can change this opportunity.';
  end if;

  if p_action='activate' then
    if v_o.status<>'planned' then
      raise exception 'Only a planned leadership opportunity can be activated.';
    end if;
    v_to := 'active';
    update public.khpos_ops_leadership_opportunities
    set status=v_to,activated_by=p_actor_user_id,activated_at=now(),updated_at=now()
    where id=v_o.id;

  elsif p_action='complete' then
    if v_o.status not in ('planned','active') then
      raise exception 'Only planned or active leadership opportunity can be completed.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Completion note and evidence reference are required.';
    end if;
    v_to := 'completed';
    update public.khpos_ops_leadership_opportunities
    set status=v_to,completion_note=left(v_note,5000),
        evidence_reference=left(v_evidence,1000),
        completed_by=p_actor_user_id,completed_at=now(),updated_at=now()
    where id=v_o.id;

  elsif p_action='cancel' then
    if v_o.status in ('completed','cancelled') then
      raise exception 'Completed or cancelled leadership opportunity cannot be cancelled.';
    end if;
    if v_note is null then raise exception 'Cancellation reason is required.'; end if;
    v_to := 'cancelled';
    update public.khpos_ops_leadership_opportunities
    set status=v_to,cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_o.id;

  else
    raise exception 'Unsupported leadership opportunity action.';
  end if;

  insert into public.khpos_ops_hpd_capability_events(
    organisation_id,leadership_opportunity_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_o.id,p_actor_user_id,'leadership_opportunity_'||p_action,
    v_o.status,v_to,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence)
  );
end;
$$;

create or replace function public.khpos_ops_create_financial_activity_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_campus_id uuid,
  p_activity_type text,
  p_title text,
  p_purpose text,
  p_owner_assignment_id uuid,
  p_activity_date date
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
  v_ref text := 'FIN-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_hpd_can_record(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Your operating role cannot create Financial Capability activities.';
  end if;

  if not khpos_private.ops_hpd_active_term(
    p_organisation_id,p_term_id,false
  ) then
    raise exception 'Financial Capability activity must belong to the active academic term.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_campuses c
    where c.id=p_campus_id
      and c.organisation_id=p_organisation_id
      and c.status='active'
  ) then
    raise exception 'Financial Capability activity campus must be active in this organisation.';
  end if;

  if p_activity_type not in (
    'financial_literacy_lab','budget_challenge','saving_plan','costing_practice',
    'pricing_practice','profit_loss_practice','opportunity_cost',
    'responsible_spending','value_creation','investment_concepts','other'
  ) then
    raise exception 'Unsupported Financial Capability activity type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_purpose,'')),'') is null
     or p_activity_date is null then
    raise exception 'Financial Capability activity title, purpose and date are required.';
  end if;

  if not khpos_private.ops_hpd_valid_owner_assignment(
    p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'Financial Capability owner must hold an active KNS operating assignment.';
  end if;

  if not khpos_private.ops_hpd_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) and not khpos_private.ops_capability_actor_assignment(
    p_actor_user_id,p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'Non-coordinating staff can only create Financial Capability activities they personally own.';
  end if;

  insert into public.khpos_ops_financial_capability_activities(
    organisation_id,term_id,campus_id,activity_reference,activity_type,
    title,purpose,owner_assignment_id,activity_date,created_by
  ) values (
    p_organisation_id,p_term_id,p_campus_id,v_ref,p_activity_type,
    left(btrim(p_title),240),left(btrim(p_purpose),5000),
    p_owner_assignment_id,p_activity_date,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_hpd_capability_events(
    organisation_id,financial_activity_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'financial_activity_created',
    'planned',left(btrim(p_title),240)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_financial_activity_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_activity_id uuid,
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
  v_f public.khpos_ops_financial_capability_activities%rowtype;
  v_is_owner boolean;
  v_can_manage boolean;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_issue uuid;
  v_to text;
begin
  select * into v_f
  from public.khpos_ops_financial_capability_activities
  where id=p_activity_id and organisation_id=p_organisation_id
  for update;

  if v_f.id is null then raise exception 'Financial Capability activity not found.'; end if;

  v_is_owner := khpos_private.ops_capability_actor_assignment(
    p_actor_user_id,p_organisation_id,v_f.owner_assignment_id
  );
  v_can_manage := khpos_private.ops_hpd_can_coordinate(
    p_actor_user_id,p_organisation_id
  );

  if not v_is_owner and not v_can_manage then
    raise exception 'Only the activity owner or Human Potential coordinating authority can change this activity.';
  end if;

  if v_note is null then
    raise exception 'Activity outcome note is required.';
  end if;

  if p_action='deliver' then
    if v_f.status<>'planned' then
      raise exception 'Only a planned Financial Capability activity can be delivered.';
    end if;
    if v_f.activity_date>current_date then
      raise exception 'Financial Capability activity cannot be marked delivered before its planned date.';
    end if;
    if v_evidence is null then
      raise exception 'Delivered Financial Capability activity requires a school-owned evidence reference.';
    end if;
    v_to := 'delivered';
    update public.khpos_ops_financial_capability_activities
    set status=v_to,delivery_note=left(v_note,5000),
        evidence_reference=left(v_evidence,1000),
        delivered_by=p_actor_user_id,delivered_at=now(),updated_at=now()
    where id=v_f.id;

  elsif p_action='miss' then
    if v_f.status<>'planned' then
      raise exception 'Only a planned Financial Capability activity can be marked missed.';
    end if;
    if p_recovery_due_date is null or p_recovery_due_date<current_date then
      raise exception 'Missed Financial Capability activity requires a recovery due date.';
    end if;

    v_issue := public.khpos_ops_create_issue_server(
      p_actor_user_id,p_organisation_id,
      'Missed Financial Capability activity · '||v_f.title,
      'Required Financial Capability activity was missed. Recovery due '
        ||p_recovery_due_date::text||'. '||v_note,
      'human_potential_development','P3',
      (p_recovery_due_date::timestamptz + interval '17 hours')
    );

    v_to := 'missed';
    update public.khpos_ops_financial_capability_activities
    set status=v_to,delivery_note=left(v_note,5000),
        recovery_due_date=p_recovery_due_date,recovery_status='required',
        issue_id=v_issue,missed_by=p_actor_user_id,missed_at=now(),updated_at=now()
    where id=v_f.id;

  elsif p_action='cancel' then
    if v_f.status<>'planned' then
      raise exception 'Only a planned Financial Capability activity can be cancelled.';
    end if;
    v_to := 'cancelled';
    update public.khpos_ops_financial_capability_activities
    set status=v_to,cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_f.id;

  else
    raise exception 'Unsupported Financial Capability activity action.';
  end if;

  insert into public.khpos_ops_hpd_capability_events(
    organisation_id,financial_activity_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_f.id,p_actor_user_id,'financial_activity_'||p_action,
    v_f.status,v_to,left(v_note,4000),
    jsonb_build_object(
      'evidenceReference',v_evidence,
      'recoveryDueDate',p_recovery_due_date,
      'issueId',v_issue
    )
  );
end;
$$;

create or replace function public.khpos_ops_add_capability_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_domain text,
  p_dimension text,
  p_leadership_opportunity_id uuid,
  p_financial_activity_id uuid,
  p_evidence_note text,
  p_evidence_reference text,
  p_observed_at timestamptz
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
  if not khpos_private.ops_hpd_can_record(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Your operating role cannot record Leadership/Financial Capability evidence.';
  end if;

  if not khpos_private.ops_hpd_learner_visible(
    p_actor_user_id,p_organisation_id,p_learner_id
  ) then
    raise exception 'This learner is outside your governed visibility.';
  end if;

  if not khpos_private.ops_hpd_active_term(
    p_organisation_id,p_term_id,false
  ) then
    raise exception 'Capability evidence must belong to the active academic term.';
  end if;

  if not khpos_private.ops_capability_valid_dimension(
    p_domain,p_dimension
  ) then
    raise exception 'Unsupported evidence dimension for this capability domain.';
  end if;

  if nullif(btrim(coalesce(p_evidence_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Capability evidence note and evidence reference are required.';
  end if;

  if p_observed_at is null or p_observed_at>now()+interval '5 minutes' then
    raise exception 'Observed-at timestamp is invalid.';
  end if;

  if p_domain='leadership' then
    if p_financial_activity_id is not null then
      raise exception 'Leadership evidence cannot reference a Financial Capability activity.';
    end if;
    if p_leadership_opportunity_id is not null and not exists(
      select 1
      from public.khpos_ops_leadership_opportunities o
      where o.id=p_leadership_opportunity_id
        and o.organisation_id=p_organisation_id
        and o.term_id=p_term_id
        and o.status in ('active','completed')
    ) then
      raise exception 'Leadership evidence must reference an active/completed opportunity in the same term.';
    end if;
    v_ref := 'LDE-'||upper(substr(gen_random_uuid()::text,1,8));

  elsif p_domain='financial_capability' then
    if p_leadership_opportunity_id is not null then
      raise exception 'Financial Capability evidence cannot reference a Leadership opportunity.';
    end if;
    if p_financial_activity_id is not null and not exists(
      select 1
      from public.khpos_ops_financial_capability_activities f
      where f.id=p_financial_activity_id
        and f.organisation_id=p_organisation_id
        and f.term_id=p_term_id
        and f.status='delivered'
    ) then
      raise exception 'Financial Capability evidence must reference a delivered activity in the same term.';
    end if;
    v_ref := 'FCE-'||upper(substr(gen_random_uuid()::text,1,8));
  else
    raise exception 'Capability evidence domain must be leadership or financial_capability.';
  end if;

  insert into public.khpos_ops_hpd_capability_evidence(
    organisation_id,learner_id,term_id,domain,
    leadership_opportunity_id,financial_activity_id,
    evidence_reference_code,dimension,evidence_note,evidence_reference,
    observed_at,recorded_by
  ) values (
    p_organisation_id,p_learner_id,p_term_id,p_domain,
    p_leadership_opportunity_id,p_financial_activity_id,
    v_ref,p_dimension,left(btrim(p_evidence_note),6000),
    left(btrim(p_evidence_reference),1000),p_observed_at,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_hpd_capability_events(
    organisation_id,leadership_opportunity_id,financial_activity_id,
    evidence_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,p_leadership_opportunity_id,p_financial_activity_id,
    v_id,p_actor_user_id,'capability_evidence_submitted','submitted',
    left(btrim(p_evidence_note),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_capability_evidence_action_server(
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
  v_e public.khpos_ops_hpd_capability_evidence%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_potential_id uuid;
  v_potential_code text;
  v_title text;
begin
  select * into v_e
  from public.khpos_ops_hpd_capability_evidence
  where id=p_evidence_id and organisation_id=p_organisation_id
  for update;

  if v_e.id is null then raise exception 'Capability evidence not found.'; end if;
  if v_note is null then raise exception 'Capability evidence action note is required.'; end if;

  if p_action='verify' then
    if not khpos_private.ops_hpd_can_coordinate(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only Human Potential coordinating roles can verify capability evidence.';
    end if;
    if v_e.status<>'submitted' then
      raise exception 'Only submitted capability evidence can be verified.';
    end if;
    if v_e.recorded_by=p_actor_user_id then
      raise exception 'The evidence recorder cannot verify their own capability evidence.';
    end if;

    v_potential_code := case
      when v_e.domain='leadership' then 'LDR-EVD-'||upper(substr(v_e.id::text,1,8))
      else 'FIN-EVD-'||upper(substr(v_e.id::text,1,8))
    end;
    v_title := case
      when v_e.domain='leadership'
        then 'Leadership · '||replace(initcap(v_e.dimension),'_',' ')
      else 'Financial Capability · '||replace(initcap(v_e.dimension),'_',' ')
    end;

    insert into public.khpos_ops_potential_evidence(
      organisation_id,learner_id,term_id,hypothesis_id,evidence_reference_code,
      evidence_type,evidence_origin,title,evidence_note,evidence_reference,
      observed_at,added_by,status
    ) values (
      p_organisation_id,v_e.learner_id,v_e.term_id,null,v_potential_code,
      case when v_e.domain='leadership' then 'leadership' else 'financial_capability' end,
      'school',left(v_title,240),left(v_e.evidence_note,5000),
      'khpos://capability/evidence/'||v_e.id::text,
      v_e.observed_at,p_actor_user_id,'active'
    )
    on conflict (organisation_id,evidence_reference_code) do update
      set evidence_note=excluded.evidence_note,
          observed_at=excluded.observed_at,
          added_by=excluded.added_by,
          status='active'
    returning id into v_potential_id;

    update public.khpos_ops_hpd_capability_evidence
    set status='verified',verified_by=p_actor_user_id,verified_at=now(),
        verification_note=left(v_note,4000),potential_evidence_id=v_potential_id,
        updated_at=now()
    where id=v_e.id;

    insert into public.khpos_ops_potential_events(
      organisation_id,learner_id,term_id,evidence_id,actor_user_id,
      event_type,to_status,note,metadata
    ) values (
      p_organisation_id,v_e.learner_id,v_e.term_id,v_potential_id,p_actor_user_id,
      'capability_evidence_linked','active',left(v_note,4000),
      jsonb_build_object(
        'capabilityEvidenceId',v_e.id,
        'domain',v_e.domain,
        'dimension',v_e.dimension
      )
    );

  elsif p_action='return' then
    if not khpos_private.ops_hpd_can_coordinate(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only Human Potential coordinating roles can return capability evidence.';
    end if;
    if v_e.status<>'submitted' then
      raise exception 'Only submitted capability evidence can be returned.';
    end if;

    update public.khpos_ops_hpd_capability_evidence
    set status='returned',returned_by=p_actor_user_id,returned_at=now(),
        return_note=left(v_note,4000),updated_at=now()
    where id=v_e.id;

  elsif p_action='withdraw' then
    if v_e.recorded_by<>p_actor_user_id
       and not khpos_private.ops_hpd_can_coordinate(
         p_actor_user_id,p_organisation_id
       ) then
      raise exception 'Only the recorder or Human Potential coordinating authority can withdraw capability evidence.';
    end if;
    if v_e.status='withdrawn' then
      raise exception 'Capability evidence is already withdrawn.';
    end if;

    update public.khpos_ops_hpd_capability_evidence
    set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
        withdrawal_reason=left(v_note,4000),updated_at=now()
    where id=v_e.id;

    if v_e.potential_evidence_id is not null then
      update public.khpos_ops_potential_evidence
      set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
          withdrawal_reason='Linked O18 capability evidence withdrawn: '||left(v_note,3400)
      where id=v_e.potential_evidence_id
        and status='active';
    end if;

  else
    raise exception 'Unsupported capability evidence action.';
  end if;

  insert into public.khpos_ops_hpd_capability_events(
    organisation_id,leadership_opportunity_id,financial_activity_id,
    evidence_id,actor_user_id,event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_e.leadership_opportunity_id,v_e.financial_activity_id,
    v_e.id,p_actor_user_id,'capability_evidence_'||p_action,
    v_e.status,
    (select status from public.khpos_ops_hpd_capability_evidence where id=v_e.id),
    left(v_note,4000)
  );
end;
$$;

revoke execute on function khpos_private.ops_capability_is_pure_executive(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_capability_actor_assignment(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_capability_valid_dimension(text,text)
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_leadership_financial_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_leadership_opportunity_server(uuid,uuid,uuid,uuid,text,text,text,uuid,date,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_leadership_opportunity_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_financial_activity_server(uuid,uuid,uuid,uuid,text,text,text,uuid,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_financial_activity_action_server(uuid,uuid,uuid,text,text,text,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_capability_evidence_server(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,timestamptz)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_capability_evidence_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_capability_is_pure_executive(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_capability_actor_assignment(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_capability_valid_dimension(text,text) to service_role;

grant execute on function public.khpos_ops_get_leadership_financial_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_leadership_opportunity_server(uuid,uuid,uuid,uuid,text,text,text,uuid,date,date) to service_role;
grant execute on function public.khpos_ops_leadership_opportunity_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_financial_activity_server(uuid,uuid,uuid,uuid,text,text,text,uuid,date) to service_role;
grant execute on function public.khpos_ops_financial_activity_action_server(uuid,uuid,uuid,text,text,text,date) to service_role;
grant execute on function public.khpos_ops_add_capability_evidence_server(uuid,uuid,uuid,uuid,text,text,uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.khpos_ops_capability_evidence_action_server(uuid,uuid,uuid,text,text) to service_role;
