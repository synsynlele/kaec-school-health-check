create extension if not exists pgcrypto;

-- O17: Skills Pathways & Competency.
-- Reuses O14 learner anchors, O12 academic terms, O4 Issues and O16 potential evidence.
-- No private PipuPath profile, mission or reflection data is copied into this module.

create table if not exists public.khpos_ops_skill_pathways (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active','inactive','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,code),
  unique (organisation_id,name)
);

create table if not exists public.khpos_ops_skill_offerings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  pathway_id uuid not null references public.khpos_ops_skill_pathways(id) on delete restrict,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete restrict,
  campus_id uuid not null references public.khpos_ops_campuses(id) on delete restrict,
  facilitator_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  offering_reference text not null,
  weekly_session_target smallint not null default 1
    check (weekly_session_target between 1 and 12),
  capacity integer check (capacity is null or capacity > 0),
  safety_readiness text not null default 'not_reviewed'
    check (safety_readiness in ('not_reviewed','ready','blocked')),
  resource_readiness text not null default 'not_reviewed'
    check (resource_readiness in ('not_reviewed','ready','partial','blocked')),
  readiness_note text,
  readiness_evidence_reference text,
  status text not null default 'planned'
    check (status in ('planned','ready','active','closed','cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,offering_reference),
  unique (pathway_id,term_id,campus_id)
);

create table if not exists public.khpos_ops_skill_selections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  offering_id uuid not null references public.khpos_ops_skill_offerings(id) on delete restrict,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete restrict,
  selection_reference text not null,
  selection_basis text not null
    check (selection_basis in ('learner_choice','discovery_alignment','continuation','other')),
  selection_note text not null,
  selected_by uuid not null references auth.users(id) on delete restrict,
  selected_at timestamptz not null default now(),
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'active'
    check (status in ('active','changed','withdrawn','completed')),
  changed_by_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,selection_reference)
);

create unique index if not exists uq_khpos_ops_skill_selection_active_term
  on public.khpos_ops_skill_selections(learner_id,term_id)
  where status='active';
create index if not exists idx_khpos_ops_skill_selection_offering
  on public.khpos_ops_skill_selections(offering_id,status);
create index if not exists idx_khpos_ops_skill_selection_learner
  on public.khpos_ops_skill_selections(learner_id,term_id,status);

create table if not exists public.khpos_ops_skill_change_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  current_selection_id uuid not null references public.khpos_ops_skill_selections(id) on delete restrict,
  target_offering_id uuid not null references public.khpos_ops_skill_offerings(id) on delete restrict,
  change_reference text not null,
  reason text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  requested_effective_date date not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled','executed')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  executed_by uuid references auth.users(id) on delete set null,
  executed_at timestamptz,
  new_selection_id uuid references public.khpos_ops_skill_selections(id) on delete set null,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,change_reference)
);

alter table public.khpos_ops_skill_selections
  drop constraint if exists khpos_ops_skill_selections_changed_by_request_id_fkey;
alter table public.khpos_ops_skill_selections
  add constraint khpos_ops_skill_selections_changed_by_request_id_fkey
  foreign key (changed_by_request_id)
  references public.khpos_ops_skill_change_requests(id)
  on delete set null;

create unique index if not exists uq_khpos_ops_skill_change_open_selection
  on public.khpos_ops_skill_change_requests(current_selection_id)
  where status in ('pending','approved');
create index if not exists idx_khpos_ops_skill_change_org_status
  on public.khpos_ops_skill_change_requests(organisation_id,status,requested_at desc);
create index if not exists idx_khpos_ops_skill_change_learner
  on public.khpos_ops_skill_change_requests(learner_id,status,requested_at desc);

create table if not exists public.khpos_ops_skill_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  offering_id uuid not null references public.khpos_ops_skill_offerings(id) on delete cascade,
  session_reference text not null,
  session_date date not null,
  focus text not null,
  status text not null default 'planned'
    check (status in ('planned','delivered','missed','cancelled')),
  safety_state text not null default 'not_checked'
    check (safety_state in ('not_checked','safe','concern')),
  resource_state text not null default 'not_checked'
    check (resource_state in ('not_checked','ready','partial','blocked')),
  delivery_note text,
  evidence_reference text,
  recovery_due_date date,
  recovery_status text not null default 'not_required'
    check (recovery_status in ('not_required','required','planned','recovered','waived')),
  recovery_for_session_id uuid references public.khpos_ops_skill_sessions(id) on delete set null,
  issue_id uuid references public.khpos_ops_issues(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  delivered_by uuid references auth.users(id) on delete set null,
  delivered_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,session_reference)
);

create unique index if not exists uq_khpos_ops_skill_session_offering_date_focus
  on public.khpos_ops_skill_sessions(offering_id,session_date,lower(focus));
create index if not exists idx_khpos_ops_skill_session_offering
  on public.khpos_ops_skill_sessions(offering_id,session_date,status);
create index if not exists idx_khpos_ops_skill_session_recovery
  on public.khpos_ops_skill_sessions(offering_id,recovery_status,recovery_due_date)
  where recovery_status in ('required','planned');
create index if not exists idx_khpos_ops_skill_session_issue
  on public.khpos_ops_skill_sessions(issue_id)
  where issue_id is not null;

create table if not exists public.khpos_ops_skill_competency_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  selection_id uuid not null references public.khpos_ops_skill_selections(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete restrict,
  pathway_id uuid not null references public.khpos_ops_skill_pathways(id) on delete restrict,
  evidence_reference_code text not null,
  competency_level text not null
    check (competency_level in ('exposure','foundation','independent','applied','value_creation')),
  competency_area text not null,
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
  unique (organisation_id,evidence_reference_code)
);

create index if not exists idx_khpos_ops_skill_competency_selection
  on public.khpos_ops_skill_competency_evidence(selection_id,status,observed_at desc);
create index if not exists idx_khpos_ops_skill_competency_learner
  on public.khpos_ops_skill_competency_evidence(learner_id,term_id,status,observed_at desc);
create index if not exists idx_khpos_ops_skill_competency_pathway
  on public.khpos_ops_skill_competency_evidence(pathway_id,status,competency_level);
create index if not exists idx_khpos_ops_skill_competency_potential
  on public.khpos_ops_skill_competency_evidence(potential_evidence_id)
  where potential_evidence_id is not null;

create table if not exists public.khpos_ops_skill_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  offering_id uuid not null references public.khpos_ops_skill_offerings(id) on delete cascade,
  week_start date not null,
  review_reference text not null,
  planned_sessions integer not null default 0,
  delivered_sessions integer not null default 0,
  missed_sessions integer not null default 0,
  verified_competency_evidence integer not null default 0,
  safety_resource_summary text,
  recovery_action_note text,
  value_creation_note text,
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','returned','cancelled')),
  prepared_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  approval_note text,
  returned_by uuid references auth.users(id) on delete set null,
  returned_at timestamptz,
  return_note text,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,review_reference),
  unique (offering_id,week_start)
);

create index if not exists idx_khpos_ops_skill_weekly_review_offering
  on public.khpos_ops_skill_weekly_reviews(offering_id,week_start desc,status);
create index if not exists idx_khpos_ops_skill_weekly_review_status
  on public.khpos_ops_skill_weekly_reviews(organisation_id,status,week_start desc);

create table if not exists public.khpos_ops_skill_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  pathway_id uuid references public.khpos_ops_skill_pathways(id) on delete cascade,
  offering_id uuid references public.khpos_ops_skill_offerings(id) on delete cascade,
  selection_id uuid references public.khpos_ops_skill_selections(id) on delete cascade,
  change_request_id uuid references public.khpos_ops_skill_change_requests(id) on delete cascade,
  session_id uuid references public.khpos_ops_skill_sessions(id) on delete cascade,
  competency_evidence_id uuid references public.khpos_ops_skill_competency_evidence(id) on delete cascade,
  weekly_review_id uuid references public.khpos_ops_skill_weekly_reviews(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    num_nonnulls(
      pathway_id,offering_id,selection_id,change_request_id,
      session_id,competency_evidence_id,weekly_review_id
    )>=1
  )
);

create index if not exists idx_khpos_ops_skill_events_offering
  on public.khpos_ops_skill_events(offering_id,created_at desc)
  where offering_id is not null;
create index if not exists idx_khpos_ops_skill_events_selection
  on public.khpos_ops_skill_events(selection_id,created_at desc)
  where selection_id is not null;
create index if not exists idx_khpos_ops_skill_events_review
  on public.khpos_ops_skill_events(weekly_review_id,created_at desc)
  where weekly_review_id is not null;
create index if not exists idx_khpos_ops_skill_events_actor
  on public.khpos_ops_skill_events(actor_user_id,created_at desc)
  where actor_user_id is not null;

alter table public.khpos_ops_skill_pathways enable row level security;
alter table public.khpos_ops_skill_offerings enable row level security;
alter table public.khpos_ops_skill_selections enable row level security;
alter table public.khpos_ops_skill_change_requests enable row level security;
alter table public.khpos_ops_skill_sessions enable row level security;
alter table public.khpos_ops_skill_competency_evidence enable row level security;
alter table public.khpos_ops_skill_weekly_reviews enable row level security;
alter table public.khpos_ops_skill_events enable row level security;

revoke all privileges on table public.khpos_ops_skill_pathways from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_skill_offerings from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_skill_selections from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_skill_change_requests from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_skill_sessions from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_skill_competency_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_skill_weekly_reviews from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_skill_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_skill_pathways to service_role;
grant select,insert,update,delete on table public.khpos_ops_skill_offerings to service_role;
grant select,insert,update,delete on table public.khpos_ops_skill_selections to service_role;
grant select,insert,update,delete on table public.khpos_ops_skill_change_requests to service_role;
grant select,insert,update,delete on table public.khpos_ops_skill_sessions to service_role;
grant select,insert,update,delete on table public.khpos_ops_skill_competency_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_skill_weekly_reviews to service_role;
grant select,insert,update,delete on table public.khpos_ops_skill_events to service_role;

create or replace function khpos_private.ops_skill_can_manage(
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

create or replace function khpos_private.ops_skill_can_record(
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
    array['SCHOOL_GUARDIAN','SKILL_INSPECTOR','SKILLS_FACILITATOR']
  );
$$;

create or replace function khpos_private.ops_skill_is_pure_executive(
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
    select 1 from public.organisation_memberships m
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and m.role='executive'
  )
  and not khpos_private.ops_skill_can_record(
    p_actor_user_id,p_organisation_id
  );
$$;

create or replace function khpos_private.ops_skill_facilitator_for_offering(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_offering_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_skill_offerings o
    join public.khpos_ops_role_assignments a on a.id=o.facilitator_assignment_id
    join public.khpos_ops_roles r on r.id=a.role_id
    where o.id=p_offering_id
      and o.organisation_id=p_organisation_id
      and a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code='SKILLS_FACILITATOR'
  );
$$;

create or replace function khpos_private.ops_skill_offering_visible(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_offering_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select
    khpos_private.ops_skill_can_manage(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_skill_facilitator_for_offering(
      p_actor_user_id,p_organisation_id,p_offering_id
    );
$$;

create or replace function khpos_private.ops_skill_level_rank(
  p_level text
)
returns integer
language sql
immutable
as $$
  select case p_level
    when 'exposure' then 1
    when 'foundation' then 2
    when 'independent' then 3
    when 'applied' then 4
    when 'value_creation' then 5
    else 0
  end;
$$;

create or replace function public.khpos_ops_get_skills_workspace_server(
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
  v_can_manage boolean;
  v_pure_executive boolean;
  v_pathways jsonb := '[]'::jsonb;
  v_terms jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_offerings jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
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

  v_can_record := khpos_private.ops_skill_can_record(
    p_actor_user_id,p_organisation_id
  );
  v_can_manage := khpos_private.ops_skill_can_manage(
    p_actor_user_id,p_organisation_id
  );
  v_pure_executive := khpos_private.ops_skill_is_pure_executive(
    p_actor_user_id,p_organisation_id
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'code',p.code,'name',p.name,'description',p.description,'status',p.status
  ) order by p.name),'[]'::jsonb)
  into v_pathways
  from public.khpos_ops_skill_pathways p
  where p.organisation_id=p_organisation_id
    and p.status<>'archived';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'sessionLabel',t.session_label,'termCode',t.term_code,
    'termName',t.term_name,'status',t.status,'startDate',t.start_date,'endDate',t.end_date
  ) order by t.start_date desc),'[]'::jsonb)
  into v_terms
  from public.khpos_ops_academic_terms t
  where t.organisation_id=p_organisation_id
    and t.status in ('active','closed');

  if v_can_record then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'userId',a.user_id,'roleCode',r.code,'roleTitle',r.title,
      'campusId',a.campus_id,'unitId',a.unit_id
    ) order by r.role_level,r.title),'[]'::jsonb)
    into v_assignments
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('SCHOOL_GUARDIAN','SKILL_INSPECTOR','SKILLS_FACILITATOR');
  end if;

  if not v_pure_executive and v_can_record then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,'reference',o.offering_reference,'pathwayId',o.pathway_id,
      'pathwayName',p.name,'termId',o.term_id,'campusId',o.campus_id,
      'facilitatorAssignmentId',o.facilitator_assignment_id,
      'weeklySessionTarget',o.weekly_session_target,'capacity',o.capacity,
      'safetyReadiness',o.safety_readiness,'resourceReadiness',o.resource_readiness,
      'readinessNote',o.readiness_note,'readinessEvidenceReference',o.readiness_evidence_reference,
      'status',o.status,
      'sessions',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',s.id,'reference',s.session_reference,'sessionDate',s.session_date,
          'focus',s.focus,'status',s.status,'safetyState',s.safety_state,
          'resourceState',s.resource_state,'deliveryNote',s.delivery_note,
          'evidenceReference',s.evidence_reference,'recoveryDueDate',s.recovery_due_date,
          'recoveryStatus',s.recovery_status,'recoveryForSessionId',s.recovery_for_session_id,
          'issueId',s.issue_id
        ) order by s.session_date desc,s.created_at desc)
        from public.khpos_ops_skill_sessions s
        where s.offering_id=o.id
      ),'[]'::jsonb),
      'reviews',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',w.id,'reference',w.review_reference,'weekStart',w.week_start,
          'plannedSessions',w.planned_sessions,'deliveredSessions',w.delivered_sessions,
          'missedSessions',w.missed_sessions,
          'verifiedCompetencyEvidence',w.verified_competency_evidence,
          'safetyResourceSummary',w.safety_resource_summary,
          'recoveryActionNote',w.recovery_action_note,
          'valueCreationNote',w.value_creation_note,'status',w.status,
          'preparedBy',w.prepared_by,'submittedAt',w.submitted_at,
          'approvedAt',w.approved_at,'approvalNote',w.approval_note,'returnNote',w.return_note
        ) order by w.week_start desc)
        from public.khpos_ops_skill_weekly_reviews w
        where w.offering_id=o.id
      ),'[]'::jsonb)
    ) order by p.name),'[]'::jsonb)
    into v_offerings
    from public.khpos_ops_skill_offerings o
    join public.khpos_ops_skill_pathways p on p.id=o.pathway_id
    where o.organisation_id=p_organisation_id
      and khpos_private.ops_skill_offering_visible(
        p_actor_user_id,p_organisation_id,o.id
      );
  end if;

  if not v_pure_executive and v_can_record then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',l.id,'displayName',l.display_name,'classLabel',l.class_label,
      'sectionLabel',l.section_label,'campusId',l.campus_id,
      'selections',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',s.id,'reference',s.selection_reference,'offeringId',s.offering_id,
          'termId',s.term_id,'selectionBasis',s.selection_basis,
          'selectionNote',s.selection_note,'effectiveFrom',s.effective_from,
          'effectiveTo',s.effective_to,'status',s.status,
          'pathwayId',p.id,'pathwayName',p.name,
          'currentCompetencyLevel',coalesce((
            select case max(khpos_private.ops_skill_level_rank(e.competency_level))
              when 1 then 'exposure' when 2 then 'foundation' when 3 then 'independent'
              when 4 then 'applied' when 5 then 'value_creation' else null end
            from public.khpos_ops_skill_competency_evidence e
            where e.selection_id=s.id and e.status='verified'
          ),'not_assessed'),
          'competencyEvidence',coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',e.id,'referenceCode',e.evidence_reference_code,
              'competencyLevel',e.competency_level,'competencyArea',e.competency_area,
              'evidenceNote',e.evidence_note,'evidenceReference',e.evidence_reference,
              'observedAt',e.observed_at,'status',e.status,
              'verificationNote',e.verification_note,
              'potentialEvidenceId',e.potential_evidence_id
            ) order by e.observed_at desc)
            from public.khpos_ops_skill_competency_evidence e
            where e.selection_id=s.id
          ),'[]'::jsonb)
        ) order by s.created_at desc)
        from public.khpos_ops_skill_selections s
        join public.khpos_ops_skill_offerings o on o.id=s.offering_id
        join public.khpos_ops_skill_pathways p on p.id=o.pathway_id
        where s.learner_id=l.id
          and khpos_private.ops_skill_offering_visible(
            p_actor_user_id,p_organisation_id,s.offering_id
          )
      ),'[]'::jsonb),
      'changeRequests',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',c.id,'reference',c.change_reference,
          'currentSelectionId',c.current_selection_id,'targetOfferingId',c.target_offering_id,
          'reason',c.reason,'requestedEffectiveDate',c.requested_effective_date,
          'status',c.status,'decisionNote',c.decision_note,'newSelectionId',c.new_selection_id
        ) order by c.requested_at desc)
        from public.khpos_ops_skill_change_requests c
        where c.learner_id=l.id
      ),'[]'::jsonb)
    ) order by l.display_name),'[]'::jsonb)
    into v_learners
    from public.khpos_ops_learner_anchors l
    where l.organisation_id=p_organisation_id
      and l.status='active'
      and khpos_private.ops_hpd_learner_visible(
        p_actor_user_id,p_organisation_id,l.id
      );
  end if;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canRecord',v_can_record,
    'canManage',v_can_manage,
    'executiveAggregateOnly',v_pure_executive,
    'privacyBoundary','KHP-OS stores school-owned skill selections, delivery, competency evidence and reviews. It does not copy private PipuPath profiles, missions or reflections.',
    'principle','Skills progression is demonstrated and verified. Attendance alone never advances a learner on the competency ladder.',
    'competencyLadder',jsonb_build_array('exposure','foundation','independent','applied','value_creation'),
    'pathways',v_pathways,
    'terms',v_terms,
    'assignments',v_assignments,
    'offerings',v_offerings,
    'learners',v_learners,
    'summary',jsonb_build_object(
      'activeOfferings',(select count(*) from public.khpos_ops_skill_offerings o where o.organisation_id=p_organisation_id and o.status='active'),
      'activeSelections',(select count(*) from public.khpos_ops_skill_selections s where s.organisation_id=p_organisation_id and s.status='active'),
      'pendingChanges',(select count(*) from public.khpos_ops_skill_change_requests c where c.organisation_id=p_organisation_id and c.status in ('pending','approved')),
      'verifiedCompetencies',(select count(*) from public.khpos_ops_skill_competency_evidence e where e.organisation_id=p_organisation_id and e.status='verified'),
      'openRecoveries',(select count(*) from public.khpos_ops_skill_sessions s where s.organisation_id=p_organisation_id and s.recovery_status in ('required','planned')),
      'submittedReviews',(select count(*) from public.khpos_ops_skill_weekly_reviews w where w.organisation_id=p_organisation_id and w.status='submitted')
    )
  );
end;
$$;

create or replace function public.khpos_ops_create_skill_offering_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_pathway_id uuid,
  p_term_id uuid,
  p_campus_id uuid,
  p_facilitator_assignment_id uuid,
  p_weekly_session_target integer,
  p_capacity integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_skill_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the Skill Inspector or School Guardian can create skill offerings.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_skill_pathways p
    where p.id=p_pathway_id and p.organisation_id=p_organisation_id and p.status='active'
  ) then
    raise exception 'Active skill pathway not found.';
  end if;

  if not khpos_private.ops_hpd_active_term(
    p_organisation_id,p_term_id,false
  ) then
    raise exception 'Skill offering requires an active academic term.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_campuses c
    where c.id=p_campus_id and c.organisation_id=p_organisation_id and c.status='active'
  ) then
    raise exception 'Active campus not found.';
  end if;

  if p_facilitator_assignment_id is not null and not exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.id=p_facilitator_assignment_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code='SKILLS_FACILITATOR'
      and (a.campus_id is null or a.campus_id=p_campus_id)
  ) then
    raise exception 'Facilitator must be an active Skills Facilitator for the offering campus.';
  end if;

  if p_weekly_session_target is null or p_weekly_session_target<1 or p_weekly_session_target>12 then
    raise exception 'Weekly session target must be between 1 and 12.';
  end if;

  v_reference := 'SKO-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_skill_offerings(
    organisation_id,pathway_id,term_id,campus_id,facilitator_assignment_id,
    offering_reference,weekly_session_target,capacity,status,created_by
  ) values (
    p_organisation_id,p_pathway_id,p_term_id,p_campus_id,p_facilitator_assignment_id,
    v_reference,p_weekly_session_target,p_capacity,'planned',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_skill_events(
    organisation_id,offering_id,actor_user_id,event_type,to_status
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'offering_created','planned'
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_skill_offering_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_offering_id uuid,
  p_action text,
  p_safety_readiness text default null,
  p_resource_readiness text default null,
  p_note text default null,
  p_evidence_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_offering public.khpos_ops_skill_offerings%rowtype;
  v_from text;
  v_to text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
begin
  select * into v_offering
  from public.khpos_ops_skill_offerings
  where id=p_offering_id and organisation_id=p_organisation_id
  for update;

  if v_offering.id is null then raise exception 'Skill offering not found.'; end if;

  if not khpos_private.ops_skill_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the Skill Inspector or School Guardian can change skill offering state.';
  end if;

  v_from := v_offering.status;

  if p_action='mark_ready' then
    if v_offering.status not in ('planned','ready') then
      raise exception 'Only planned or ready offerings can update readiness.';
    end if;
    if p_safety_readiness not in ('ready','blocked')
       or p_resource_readiness not in ('ready','partial','blocked') then
      raise exception 'Record valid safety and resource readiness states.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Readiness note and evidence reference are required.';
    end if;

    v_to := case
      when p_safety_readiness='ready'
       and p_resource_readiness in ('ready','partial')
       and v_offering.facilitator_assignment_id is not null
      then 'ready' else 'planned' end;

    update public.khpos_ops_skill_offerings
    set safety_readiness=p_safety_readiness,
        resource_readiness=p_resource_readiness,
        readiness_note=left(v_note,4000),
        readiness_evidence_reference=left(v_evidence,1000),
        status=v_to,updated_at=now()
    where id=v_offering.id;

  elsif p_action='activate' then
    if v_offering.status<>'ready'
       or v_offering.safety_readiness<>'ready'
       or v_offering.resource_readiness not in ('ready','partial')
       or v_offering.facilitator_assignment_id is null then
      raise exception 'Offering must be ready, safely resourced and assigned to a facilitator before activation.';
    end if;
    v_to := 'active';
    update public.khpos_ops_skill_offerings
    set status=v_to,activated_by=p_actor_user_id,activated_at=now(),updated_at=now()
    where id=v_offering.id;

  elsif p_action='close' then
    if v_offering.status not in ('active','ready') then
      raise exception 'Only an active or ready offering can be closed.';
    end if;
    v_to := 'closed';
    update public.khpos_ops_skill_offerings
    set status=v_to,closed_by=p_actor_user_id,closed_at=now(),updated_at=now()
    where id=v_offering.id;

    update public.khpos_ops_skill_selections
    set status='completed',effective_to=current_date,updated_at=now()
    where offering_id=v_offering.id and status='active';

  elsif p_action='cancel' then
    if v_offering.status='active'
       and exists(select 1 from public.khpos_ops_skill_selections where offering_id=v_offering.id and status='active') then
      raise exception 'Move or complete active learner selections before cancelling an active offering.';
    end if;
    if v_note is null then raise exception 'Cancellation reason is required.'; end if;
    v_to := 'cancelled';
    update public.khpos_ops_skill_offerings
    set status=v_to,cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_offering.id;
  else
    raise exception 'Unsupported skill offering action.';
  end if;

  insert into public.khpos_ops_skill_events(
    organisation_id,offering_id,actor_user_id,event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_offering.id,p_actor_user_id,'offering_'||p_action,
    v_from,v_to,left(v_note,4000)
  );
end;
$$;

create or replace function public.khpos_ops_select_skill_pathway_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_offering_id uuid,
  p_selection_basis text,
  p_selection_note text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_offering public.khpos_ops_skill_offerings%rowtype;
  v_learner public.khpos_ops_learner_anchors%rowtype;
  v_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_skill_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the Skill Inspector or School Guardian can confirm a learner skill pathway.';
  end if;

  select * into v_offering
  from public.khpos_ops_skill_offerings
  where id=p_offering_id and organisation_id=p_organisation_id;

  if v_offering.id is null or v_offering.status not in ('ready','active') then
    raise exception 'Learner selection requires a ready or active skill offering.';
  end if;

  select * into v_learner
  from public.khpos_ops_learner_anchors
  where id=p_learner_id and organisation_id=p_organisation_id and status='active';

  if v_learner.id is null then raise exception 'Active learner not found.'; end if;
  if v_learner.campus_id is distinct from v_offering.campus_id then
    raise exception 'Learner and skill offering must belong to the same campus.';
  end if;

  if p_selection_basis not in ('learner_choice','discovery_alignment','continuation','other') then
    raise exception 'Unsupported skill selection basis.';
  end if;

  if nullif(btrim(coalesce(p_selection_note,'')),'') is null then
    raise exception 'Skill selection note is required.';
  end if;

  if v_offering.capacity is not null
     and (
       select count(*) from public.khpos_ops_skill_selections s
       where s.offering_id=v_offering.id and s.status='active'
     )>=v_offering.capacity then
    raise exception 'Skill offering is at capacity.';
  end if;

  v_reference := 'SKS-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_skill_selections(
    organisation_id,learner_id,offering_id,term_id,selection_reference,
    selection_basis,selection_note,selected_by,effective_from,status
  ) values (
    p_organisation_id,p_learner_id,v_offering.id,v_offering.term_id,v_reference,
    p_selection_basis,left(btrim(p_selection_note),4000),p_actor_user_id,current_date,'active'
  ) returning id into v_id;

  insert into public.khpos_ops_skill_events(
    organisation_id,offering_id,selection_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_offering.id,v_id,p_actor_user_id,
    'learner_pathway_selected','active',left(btrim(p_selection_note),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_request_skill_change_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_current_selection_id uuid,
  p_target_offering_id uuid,
  p_reason text,
  p_requested_effective_date date
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_selection public.khpos_ops_skill_selections%rowtype;
  v_current_offering public.khpos_ops_skill_offerings%rowtype;
  v_target public.khpos_ops_skill_offerings%rowtype;
  v_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_skill_can_record(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Skills operating role is required to record a pathway-change request.';
  end if;

  select * into v_selection
  from public.khpos_ops_skill_selections
  where id=p_current_selection_id and organisation_id=p_organisation_id and status='active';

  if v_selection.id is null then raise exception 'Active skill selection not found.'; end if;

  if not khpos_private.ops_hpd_learner_visible(
    p_actor_user_id,p_organisation_id,v_selection.learner_id
  ) then
    raise exception 'This learner is outside your KHP-OS visibility.';
  end if;

  select * into v_current_offering from public.khpos_ops_skill_offerings where id=v_selection.offering_id;
  select * into v_target
  from public.khpos_ops_skill_offerings
  where id=p_target_offering_id
    and organisation_id=p_organisation_id
    and status in ('ready','active');

  if v_target.id is null then raise exception 'Target skill offering is not ready or active.'; end if;
  if v_target.id=v_current_offering.id then raise exception 'Target offering must differ from the current offering.'; end if;
  if v_target.term_id is distinct from v_current_offering.term_id
     or v_target.campus_id is distinct from v_current_offering.campus_id then
    raise exception 'Pathway change must stay within the same term and campus.';
  end if;
  if p_requested_effective_date<current_date then
    raise exception 'Requested change date cannot be in the past.';
  end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'Pathway-change reason is required.';
  end if;

  v_reference := 'SKC-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_skill_change_requests(
    organisation_id,learner_id,current_selection_id,target_offering_id,
    change_reference,reason,requested_by,requested_effective_date,status
  ) values (
    p_organisation_id,v_selection.learner_id,v_selection.id,v_target.id,
    v_reference,left(btrim(p_reason),4000),p_actor_user_id,p_requested_effective_date,'pending'
  ) returning id into v_id;

  insert into public.khpos_ops_skill_events(
    organisation_id,selection_id,change_request_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_selection.id,v_id,p_actor_user_id,
    'pathway_change_requested','pending',left(btrim(p_reason),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_skill_change_decision_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_change_request_id uuid,
  p_action text,
  p_decision_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_change public.khpos_ops_skill_change_requests%rowtype;
  v_to text;
begin
  select * into v_change
  from public.khpos_ops_skill_change_requests
  where id=p_change_request_id and organisation_id=p_organisation_id
  for update;

  if v_change.id is null then raise exception 'Skill pathway-change request not found.'; end if;

  if not khpos_private.ops_skill_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the Skill Inspector or School Guardian can decide a pathway change.';
  end if;

  if v_change.status<>'pending' then
    raise exception 'Only a pending pathway-change request can be decided.';
  end if;

  if p_action not in ('approve','reject') then
    raise exception 'Pathway-change decision must be approve or reject.';
  end if;

  if nullif(btrim(coalesce(p_decision_note,'')),'') is null then
    raise exception 'Decision note is required.';
  end if;

  v_to := case when p_action='approve' then 'approved' else 'rejected' end;

  update public.khpos_ops_skill_change_requests
  set status=v_to,decided_by=p_actor_user_id,decided_at=now(),
      decision_note=left(btrim(p_decision_note),4000),updated_at=now()
  where id=v_change.id;

  insert into public.khpos_ops_skill_events(
    organisation_id,selection_id,change_request_id,actor_user_id,
    event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_change.current_selection_id,v_change.id,p_actor_user_id,
    'pathway_change_'||p_action,v_change.status,v_to,left(btrim(p_decision_note),4000)
  );
end;
$$;

create or replace function public.khpos_ops_execute_skill_change_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_change_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_change public.khpos_ops_skill_change_requests%rowtype;
  v_old public.khpos_ops_skill_selections%rowtype;
  v_target public.khpos_ops_skill_offerings%rowtype;
  v_new_id uuid;
  v_reference text;
begin
  select * into v_change
  from public.khpos_ops_skill_change_requests
  where id=p_change_request_id and organisation_id=p_organisation_id
  for update;

  if v_change.id is null then raise exception 'Skill pathway-change request not found.'; end if;
  if v_change.status<>'approved' then raise exception 'Only an approved pathway change can be executed.'; end if;
  if current_date<v_change.requested_effective_date then
    raise exception 'Pathway change cannot execute before its approved effective date.';
  end if;
  if not khpos_private.ops_skill_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the Skill Inspector or School Guardian can execute a pathway change.';
  end if;

  select * into v_old
  from public.khpos_ops_skill_selections
  where id=v_change.current_selection_id and status='active'
  for update;

  if v_old.id is null then raise exception 'Original skill selection is no longer active.'; end if;

  select * into v_target
  from public.khpos_ops_skill_offerings
  where id=v_change.target_offering_id and status in ('ready','active');

  if v_target.id is null then raise exception 'Target skill offering is no longer available.'; end if;

  if v_target.capacity is not null
     and (
       select count(*) from public.khpos_ops_skill_selections s
       where s.offering_id=v_target.id and s.status='active'
     )>=v_target.capacity then
    raise exception 'Target skill offering is at capacity.';
  end if;

  update public.khpos_ops_skill_selections
  set status='changed',
      effective_to=greatest(effective_from,current_date-1),
      changed_by_request_id=v_change.id,
      updated_at=now()
  where id=v_old.id;

  v_reference := 'SKS-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_skill_selections(
    organisation_id,learner_id,offering_id,term_id,selection_reference,
    selection_basis,selection_note,selected_by,effective_from,status,changed_by_request_id
  ) values (
    p_organisation_id,v_old.learner_id,v_target.id,v_target.term_id,v_reference,
    'other','Approved pathway change: '||left(v_change.reason,3800),
    p_actor_user_id,current_date,'active',v_change.id
  ) returning id into v_new_id;

  update public.khpos_ops_skill_change_requests
  set status='executed',executed_by=p_actor_user_id,executed_at=now(),
      new_selection_id=v_new_id,updated_at=now()
  where id=v_change.id;

  insert into public.khpos_ops_skill_events(
    organisation_id,selection_id,change_request_id,actor_user_id,
    event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_new_id,v_change.id,p_actor_user_id,
    'pathway_change_executed','approved','executed',
    left(v_change.decision_note,4000),
    jsonb_build_object('oldSelectionId',v_old.id,'newSelectionId',v_new_id)
  );

  return v_new_id;
end;
$$;

create or replace function public.khpos_ops_create_skill_session_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_offering_id uuid,
  p_session_date date,
  p_focus text,
  p_recovery_for_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_offering public.khpos_ops_skill_offerings%rowtype;
  v_id uuid;
  v_reference text;
begin
  select * into v_offering
  from public.khpos_ops_skill_offerings
  where id=p_offering_id and organisation_id=p_organisation_id;

  if v_offering.id is null or v_offering.status<>'active' then
    raise exception 'Sessions can only be planned for an active skill offering.';
  end if;

  if not (
    khpos_private.ops_skill_can_manage(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_skill_facilitator_for_offering(
      p_actor_user_id,p_organisation_id,p_offering_id
    )
  ) then
    raise exception 'Only the assigned Skills Facilitator, Skill Inspector or School Guardian can plan this session.';
  end if;

  if nullif(btrim(coalesce(p_focus,'')),'') is null then
    raise exception 'Skill session focus is required.';
  end if;

  if p_recovery_for_session_id is not null and not exists(
    select 1 from public.khpos_ops_skill_sessions s
    where s.id=p_recovery_for_session_id
      and s.offering_id=p_offering_id
      and s.status='missed'
      and s.recovery_status in ('required','planned')
  ) then
    raise exception 'Recovery session must reference a missed session awaiting recovery in the same offering.';
  end if;

  v_reference := 'KSS-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_skill_sessions(
    organisation_id,offering_id,session_reference,session_date,focus,
    status,recovery_for_session_id,created_by
  ) values (
    p_organisation_id,p_offering_id,v_reference,p_session_date,
    left(btrim(p_focus),300),'planned',p_recovery_for_session_id,p_actor_user_id
  ) returning id into v_id;

  if p_recovery_for_session_id is not null then
    update public.khpos_ops_skill_sessions
    set recovery_status='planned',updated_at=now()
    where id=p_recovery_for_session_id;
  end if;

  insert into public.khpos_ops_skill_events(
    organisation_id,offering_id,session_id,actor_user_id,event_type,to_status
  ) values (
    p_organisation_id,p_offering_id,v_id,p_actor_user_id,'session_planned','planned'
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_skill_session_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_session_id uuid,
  p_action text,
  p_safety_state text,
  p_resource_state text,
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
  v_session public.khpos_ops_skill_sessions%rowtype;
  v_offering public.khpos_ops_skill_offerings%rowtype;
  v_issue_id uuid;
  v_process_id uuid;
  v_to text;
  v_severity text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
begin
  select * into v_session
  from public.khpos_ops_skill_sessions
  where id=p_session_id and organisation_id=p_organisation_id
  for update;

  if v_session.id is null then raise exception 'Skill session not found.'; end if;

  select * into v_offering from public.khpos_ops_skill_offerings where id=v_session.offering_id;

  if not (
    khpos_private.ops_skill_can_manage(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_skill_facilitator_for_offering(
      p_actor_user_id,p_organisation_id,v_session.offering_id
    )
  ) then
    raise exception 'You are not authorised to update this skill session.';
  end if;

  if v_session.status<>'planned' then
    raise exception 'Only a planned skill session can be completed, missed or cancelled.';
  end if;

  if p_safety_state not in ('safe','concern')
     or p_resource_state not in ('ready','partial','blocked') then
    raise exception 'Record valid safety and resource states.';
  end if;

  if v_note is null then raise exception 'Skill session outcome note is required.'; end if;

  if p_action='deliver' then
    if p_safety_state<>'safe' then
      raise exception 'Do not mark a practical session delivered while a safety concern is present.';
    end if;
    if p_resource_state='blocked' then
      raise exception 'Do not mark a session delivered when resources are blocked.';
    end if;
    if v_evidence is null then raise exception 'Delivered skill session requires an evidence reference.'; end if;
    v_to := 'delivered';

    update public.khpos_ops_skill_sessions
    set status=v_to,safety_state=p_safety_state,resource_state=p_resource_state,
        delivery_note=left(v_note,4000),evidence_reference=left(v_evidence,1000),
        delivered_by=p_actor_user_id,delivered_at=now(),
        recovery_status='not_required',updated_at=now()
    where id=v_session.id;

    if v_session.recovery_for_session_id is not null then
      update public.khpos_ops_skill_sessions
      set recovery_status='recovered',updated_at=now()
      where id=v_session.recovery_for_session_id;
    end if;

  elsif p_action='miss' then
    if p_recovery_due_date is null or p_recovery_due_date<current_date then
      raise exception 'Missed skill session requires a current or future recovery due date.';
    end if;
    v_to := 'missed';
    v_severity := case
      when p_safety_state='concern' then 'P1'
      when p_resource_state='blocked' then 'P2'
      else 'P3'
    end;

    v_issue_id := public.khpos_ops_create_issue_server(
      p_actor_user_id,p_organisation_id,
      'Skills session not delivered: '||left(v_session.focus,120),
      left(v_note,4000),'skills_delivery',v_severity,
      (p_recovery_due_date::timestamp + interval '17 hours')
    );

    select id into v_process_id
    from public.khpos_ops_processes
    where organisation_id=p_organisation_id and code='HPD-004'
    limit 1;

    update public.khpos_ops_issues
    set process_id=v_process_id,campus_id=v_offering.campus_id,
        category='human_potential_development',updated_at=now()
    where id=v_issue_id;

    update public.khpos_ops_skill_sessions
    set status=v_to,safety_state=p_safety_state,resource_state=p_resource_state,
        delivery_note=left(v_note,4000),recovery_due_date=p_recovery_due_date,
        recovery_status='required',issue_id=v_issue_id,updated_at=now()
    where id=v_session.id;

  elsif p_action='cancel' then
    v_to := 'cancelled';
    update public.khpos_ops_skill_sessions
    set status=v_to,safety_state=p_safety_state,resource_state=p_resource_state,
        cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_session.id;
  else
    raise exception 'Unsupported skill session action.';
  end if;

  insert into public.khpos_ops_skill_events(
    organisation_id,offering_id,session_id,actor_user_id,
    event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_session.offering_id,v_session.id,p_actor_user_id,
    'session_'||p_action,v_session.status,v_to,left(v_note,4000),
    jsonb_build_object('issueId',v_issue_id,'safetyState',p_safety_state,'resourceState',p_resource_state)
  );
end;
$$;

create or replace function public.khpos_ops_add_skill_competency_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_selection_id uuid,
  p_competency_level text,
  p_competency_area text,
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
  v_selection public.khpos_ops_skill_selections%rowtype;
  v_offering public.khpos_ops_skill_offerings%rowtype;
  v_pathway_id uuid;
  v_id uuid;
  v_reference text;
begin
  select * into v_selection
  from public.khpos_ops_skill_selections
  where id=p_selection_id and organisation_id=p_organisation_id;

  if v_selection.id is null or v_selection.status<>'active' then
    raise exception 'Competency evidence requires an active skill selection.';
  end if;

  select * into v_offering from public.khpos_ops_skill_offerings where id=v_selection.offering_id;
  v_pathway_id := v_offering.pathway_id;

  if not (
    khpos_private.ops_skill_can_manage(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_skill_facilitator_for_offering(
      p_actor_user_id,p_organisation_id,v_selection.offering_id
    )
  ) then
    raise exception 'Only the assigned Skills Facilitator, Skill Inspector or School Guardian can record this competency evidence.';
  end if;

  if khpos_private.ops_skill_level_rank(p_competency_level)=0 then
    raise exception 'Unsupported competency level.';
  end if;

  if nullif(btrim(coalesce(p_competency_area,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Competency area, evidence note and evidence reference are required.';
  end if;

  v_reference := 'SKE-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_skill_competency_evidence(
    organisation_id,selection_id,learner_id,term_id,pathway_id,
    evidence_reference_code,competency_level,competency_area,evidence_note,
    evidence_reference,observed_at,recorded_by,status
  ) values (
    p_organisation_id,v_selection.id,v_selection.learner_id,v_selection.term_id,
    v_pathway_id,v_reference,p_competency_level,left(btrim(p_competency_area),240),
    left(btrim(p_evidence_note),6000),left(btrim(p_evidence_reference),1000),
    p_observed_at,p_actor_user_id,'submitted'
  ) returning id into v_id;

  insert into public.khpos_ops_skill_events(
    organisation_id,selection_id,competency_evidence_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_selection.id,v_id,p_actor_user_id,
    'competency_evidence_submitted','submitted',left(btrim(p_evidence_note),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_skill_competency_evidence_action_server(
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
  v_evidence public.khpos_ops_skill_competency_evidence%rowtype;
  v_pathway_name text;
  v_current_rank integer;
  v_target_rank integer;
  v_potential_id uuid;
  v_potential_code text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_evidence
  from public.khpos_ops_skill_competency_evidence
  where id=p_evidence_id and organisation_id=p_organisation_id
  for update;

  if v_evidence.id is null then raise exception 'Skill competency evidence not found.'; end if;
  if v_note is null then raise exception 'Competency evidence action note is required.'; end if;

  if p_action='verify' then
    if not khpos_private.ops_skill_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only the Skill Inspector or School Guardian can verify competency evidence.';
    end if;
    if v_evidence.status not in ('submitted','returned') then
      raise exception 'Only submitted or returned competency evidence can be verified.';
    end if;
    if v_evidence.recorded_by=p_actor_user_id then
      raise exception 'The evidence recorder cannot verify their own competency evidence.';
    end if;

    select coalesce(max(khpos_private.ops_skill_level_rank(e.competency_level)),0)
    into v_current_rank
    from public.khpos_ops_skill_competency_evidence e
    where e.selection_id=v_evidence.selection_id
      and e.status='verified'
      and e.id<>v_evidence.id;

    v_target_rank := khpos_private.ops_skill_level_rank(v_evidence.competency_level);

    if v_target_rank>v_current_rank+1 then
      raise exception 'Competency levels must be verified progressively without skipping the ladder.';
    end if;

    select p.name into v_pathway_name
    from public.khpos_ops_skill_pathways p
    where p.id=v_evidence.pathway_id;

    v_potential_code := 'SKL-'||upper(substr(v_evidence.id::text,1,8));

    insert into public.khpos_ops_potential_evidence(
      organisation_id,learner_id,term_id,hypothesis_id,evidence_reference_code,
      evidence_type,evidence_origin,title,evidence_note,evidence_reference,
      observed_at,added_by,status
    ) values (
      p_organisation_id,v_evidence.learner_id,v_evidence.term_id,null,
      v_potential_code,'skills_application','school',
      left(v_pathway_name||' · '||replace(initcap(v_evidence.competency_level),'_',' '),240),
      left(v_evidence.evidence_note,6000),
      'khpos://skills/competency/'||v_evidence.id::text,
      v_evidence.observed_at,p_actor_user_id,'active'
    )
    on conflict (organisation_id,evidence_reference_code) do update
      set evidence_note=excluded.evidence_note,
          observed_at=excluded.observed_at,
          added_by=excluded.added_by,
          status='active'
    returning id into v_potential_id;

    update public.khpos_ops_skill_competency_evidence
    set status='verified',verified_by=p_actor_user_id,verified_at=now(),
        verification_note=left(v_note,4000),potential_evidence_id=v_potential_id,
        updated_at=now()
    where id=v_evidence.id;

    insert into public.khpos_ops_potential_events(
      organisation_id,learner_id,term_id,evidence_id,actor_user_id,event_type,to_status,note,metadata
    ) values (
      p_organisation_id,v_evidence.learner_id,v_evidence.term_id,v_potential_id,
      p_actor_user_id,'skill_competency_evidence_linked','active',
      left(v_note,4000),
      jsonb_build_object(
        'skillCompetencyEvidenceId',v_evidence.id,
        'competencyLevel',v_evidence.competency_level,
        'pathwayId',v_evidence.pathway_id
      )
    );

  elsif p_action='return' then
    if not khpos_private.ops_skill_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only the Skill Inspector or School Guardian can return competency evidence.';
    end if;
    if v_evidence.status<>'submitted' then
      raise exception 'Only submitted competency evidence can be returned.';
    end if;

    update public.khpos_ops_skill_competency_evidence
    set status='returned',returned_by=p_actor_user_id,returned_at=now(),
        return_note=left(v_note,4000),updated_at=now()
    where id=v_evidence.id;

  elsif p_action='withdraw' then
    if v_evidence.recorded_by<>p_actor_user_id
       and not khpos_private.ops_skill_can_manage(p_actor_user_id,p_organisation_id) then
      raise exception 'Only the evidence recorder or Skill management authority can withdraw competency evidence.';
    end if;
    if v_evidence.status='withdrawn' then
      raise exception 'Competency evidence is already withdrawn.';
    end if;

    update public.khpos_ops_skill_competency_evidence
    set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
        withdrawal_reason=left(v_note,4000),updated_at=now()
    where id=v_evidence.id;

    if v_evidence.potential_evidence_id is not null then
      update public.khpos_ops_potential_evidence
      set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
          withdrawal_reason='Linked skill competency evidence withdrawn: '||left(v_note,3500)
      where id=v_evidence.potential_evidence_id and status='active';
    end if;
  else
    raise exception 'Unsupported competency evidence action.';
  end if;

  insert into public.khpos_ops_skill_events(
    organisation_id,selection_id,competency_evidence_id,actor_user_id,
    event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_evidence.selection_id,v_evidence.id,p_actor_user_id,
    'competency_evidence_'||p_action,v_evidence.status,
    (select status from public.khpos_ops_skill_competency_evidence where id=v_evidence.id),
    left(v_note,4000)
  );
end;
$$;

create or replace function public.khpos_ops_create_skill_weekly_review_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_offering_id uuid,
  p_week_start date,
  p_safety_resource_summary text default null,
  p_recovery_action_note text default null,
  p_value_creation_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_offering public.khpos_ops_skill_offerings%rowtype;
  v_id uuid;
  v_reference text;
  v_week_end date := p_week_start+6;
  v_planned integer;
  v_delivered integer;
  v_missed integer;
  v_evidence integer;
begin
  select * into v_offering
  from public.khpos_ops_skill_offerings
  where id=p_offering_id and organisation_id=p_organisation_id;

  if v_offering.id is null then raise exception 'Skill offering not found.'; end if;

  if not (
    khpos_private.ops_skill_can_manage(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_skill_facilitator_for_offering(
      p_actor_user_id,p_organisation_id,p_offering_id
    )
  ) then
    raise exception 'Only the assigned Skills Facilitator, Skill Inspector or School Guardian can prepare this weekly review.';
  end if;

  select
    count(*),
    count(*) filter (where status='delivered'),
    count(*) filter (where status='missed')
  into v_planned,v_delivered,v_missed
  from public.khpos_ops_skill_sessions
  where offering_id=p_offering_id
    and session_date between p_week_start and v_week_end;

  select count(*) into v_evidence
  from public.khpos_ops_skill_competency_evidence e
  join public.khpos_ops_skill_selections s on s.id=e.selection_id
  where s.offering_id=p_offering_id
    and e.status='verified'
    and e.observed_at::date between p_week_start and v_week_end;

  v_reference := 'SKW-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_skill_weekly_reviews(
    organisation_id,offering_id,week_start,review_reference,
    planned_sessions,delivered_sessions,missed_sessions,verified_competency_evidence,
    safety_resource_summary,recovery_action_note,value_creation_note,
    status,prepared_by
  ) values (
    p_organisation_id,p_offering_id,p_week_start,v_reference,
    v_planned,v_delivered,v_missed,v_evidence,
    left(nullif(btrim(coalesce(p_safety_resource_summary,'')),''),4000),
    left(nullif(btrim(coalesce(p_recovery_action_note,'')),''),4000),
    left(nullif(btrim(coalesce(p_value_creation_note,'')),''),4000),
    'draft',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_skill_events(
    organisation_id,offering_id,weekly_review_id,actor_user_id,event_type,to_status
  ) values (
    p_organisation_id,p_offering_id,v_id,p_actor_user_id,'weekly_review_created','draft'
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_skill_weekly_review_action_server(
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
  v_review public.khpos_ops_skill_weekly_reviews%rowtype;
  v_to text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_review
  from public.khpos_ops_skill_weekly_reviews
  where id=p_review_id and organisation_id=p_organisation_id
  for update;

  if v_review.id is null then raise exception 'Skills weekly review not found.'; end if;

  if p_action='submit' then
    if v_review.prepared_by<>p_actor_user_id then
      raise exception 'Only the review preparer can submit the weekly review.';
    end if;
    if v_review.status not in ('draft','returned') then
      raise exception 'Only a draft or returned weekly review can be submitted.';
    end if;
    if v_review.missed_sessions>0
       and nullif(btrim(coalesce(v_review.recovery_action_note,'')),'') is null then
      raise exception 'Weekly review with missed sessions requires a recovery action note.';
    end if;
    if exists(
      select 1 from public.khpos_ops_skill_sessions s
      where s.offering_id=v_review.offering_id
        and s.session_date between v_review.week_start and v_review.week_start+6
        and (s.safety_state='concern' or s.resource_state='blocked' or s.status='missed')
        and s.issue_id is null
    ) then
      raise exception 'Every material skills delivery exception must be linked to an O4 Issue before weekly review submission.';
    end if;
    v_to := 'submitted';
    update public.khpos_ops_skill_weekly_reviews
    set status=v_to,submitted_at=now(),updated_at=now()
    where id=v_review.id;

  elsif p_action='approve' then
    if not khpos_private.ops_skill_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only the Skill Inspector or School Guardian can approve a skills weekly review.';
    end if;
    if v_review.status<>'submitted' then
      raise exception 'Only a submitted skills weekly review can be approved.';
    end if;
    if v_review.prepared_by=p_actor_user_id then
      raise exception 'The weekly review preparer cannot approve their own review.';
    end if;
    if v_note is null then raise exception 'Approval note is required.'; end if;
    v_to := 'approved';
    update public.khpos_ops_skill_weekly_reviews
    set status=v_to,approved_by=p_actor_user_id,approved_at=now(),
        approval_note=left(v_note,4000),updated_at=now()
    where id=v_review.id;

  elsif p_action='return' then
    if not khpos_private.ops_skill_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only the Skill Inspector or School Guardian can return a skills weekly review.';
    end if;
    if v_review.status<>'submitted' then
      raise exception 'Only a submitted skills weekly review can be returned.';
    end if;
    if v_note is null then raise exception 'Return note is required.'; end if;
    v_to := 'returned';
    update public.khpos_ops_skill_weekly_reviews
    set status=v_to,returned_by=p_actor_user_id,returned_at=now(),
        return_note=left(v_note,4000),updated_at=now()
    where id=v_review.id;

  elsif p_action='cancel' then
    if not khpos_private.ops_skill_can_manage(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only the Skill Inspector or School Guardian can cancel a skills weekly review.';
    end if;
    if v_review.status in ('approved','cancelled') then
      raise exception 'Approved or cancelled weekly review cannot be cancelled again.';
    end if;
    if v_note is null then raise exception 'Cancellation reason is required.'; end if;
    v_to := 'cancelled';
    update public.khpos_ops_skill_weekly_reviews
    set status=v_to,cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_review.id;
  else
    raise exception 'Unsupported skills weekly review action.';
  end if;

  insert into public.khpos_ops_skill_events(
    organisation_id,offering_id,weekly_review_id,actor_user_id,
    event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_review.offering_id,v_review.id,p_actor_user_id,
    'weekly_review_'||p_action,v_review.status,v_to,left(v_note,4000)
  );
end;
$$;

revoke execute on function khpos_private.ops_skill_can_manage(uuid,uuid) from public,anon,authenticated;
revoke execute on function khpos_private.ops_skill_can_record(uuid,uuid) from public,anon,authenticated;
revoke execute on function khpos_private.ops_skill_is_pure_executive(uuid,uuid) from public,anon,authenticated;
revoke execute on function khpos_private.ops_skill_facilitator_for_offering(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function khpos_private.ops_skill_offering_visible(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function khpos_private.ops_skill_level_rank(text) from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_skills_workspace_server(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_skill_offering_server(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
revoke execute on function public.khpos_ops_skill_offering_action_server(uuid,uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_select_skill_pathway_server(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_request_skill_change_server(uuid,uuid,uuid,uuid,text,date) from public,anon,authenticated;
revoke execute on function public.khpos_ops_skill_change_decision_server(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_execute_skill_change_server(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_skill_session_server(uuid,uuid,uuid,date,text,uuid) from public,anon,authenticated;
revoke execute on function public.khpos_ops_skill_session_action_server(uuid,uuid,uuid,text,text,text,text,text,date) from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_skill_competency_evidence_server(uuid,uuid,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke execute on function public.khpos_ops_skill_competency_evidence_action_server(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_skill_weekly_review_server(uuid,uuid,uuid,date,text,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_skill_weekly_review_action_server(uuid,uuid,uuid,text,text) from public,anon,authenticated;

grant execute on function khpos_private.ops_skill_can_manage(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_skill_can_record(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_skill_is_pure_executive(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_skill_facilitator_for_offering(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_skill_offering_visible(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_skill_level_rank(text) to service_role;

grant execute on function public.khpos_ops_get_skills_workspace_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_skill_offering_server(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) to service_role;
grant execute on function public.khpos_ops_skill_offering_action_server(uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_select_skill_pathway_server(uuid,uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_request_skill_change_server(uuid,uuid,uuid,uuid,text,date) to service_role;
grant execute on function public.khpos_ops_skill_change_decision_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_execute_skill_change_server(uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_skill_session_server(uuid,uuid,uuid,date,text,uuid) to service_role;
grant execute on function public.khpos_ops_skill_session_action_server(uuid,uuid,uuid,text,text,text,text,text,date) to service_role;
grant execute on function public.khpos_ops_add_skill_competency_evidence_server(uuid,uuid,uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.khpos_ops_skill_competency_evidence_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_create_skill_weekly_review_server(uuid,uuid,uuid,date,text,text,text) to service_role;
grant execute on function public.khpos_ops_skill_weekly_review_action_server(uuid,uuid,uuid,text,text) to service_role;
