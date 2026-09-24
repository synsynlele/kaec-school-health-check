create extension if not exists pgcrypto;

-- O16: Human Potential Discovery & Progress foundation.
-- PipuPath remains learner-facing/private. KHP-OS stores school-owned execution,
-- observations, evidence references and governed reviews only.

create table if not exists public.khpos_ops_potential_discovery_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  discovery_reference text not null,
  interests_summary text,
  curiosity_summary text,
  meaningful_problems_summary text,
  recurring_strengths_summary text,
  repeated_choices_summary text,
  discovery_note text not null,
  evidence_reference text not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,discovery_reference)
);

create unique index if not exists uq_khpos_ops_potential_discovery_current
  on public.khpos_ops_potential_discovery_records(learner_id,term_id)
  where status='active';
create index if not exists idx_khpos_ops_potential_discovery_learner
  on public.khpos_ops_potential_discovery_records(learner_id,term_id,recorded_at desc);
create index if not exists idx_khpos_ops_potential_discovery_org
  on public.khpos_ops_potential_discovery_records(organisation_id,term_id,status);
create index if not exists idx_khpos_ops_potential_discovery_recorded_by
  on public.khpos_ops_potential_discovery_records(recorded_by,recorded_at desc);

create table if not exists public.khpos_ops_potential_hypotheses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  origin_term_id uuid references public.khpos_ops_academic_terms(id) on delete set null,
  hypothesis_reference text not null,
  theme_label text not null,
  hypothesis_summary text not null,
  development_state text not null default 'exploring'
    check (development_state in ('exploring','emerging','developing','demonstrated')),
  current_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active','retired')),
  retired_by uuid references auth.users(id) on delete set null,
  retired_at timestamptz,
  retirement_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,hypothesis_reference)
);

create unique index if not exists uq_khpos_ops_potential_hypothesis_theme_active
  on public.khpos_ops_potential_hypotheses(
    learner_id,lower(theme_label)
  ) where status='active';
create index if not exists idx_khpos_ops_potential_hypothesis_learner
  on public.khpos_ops_potential_hypotheses(learner_id,status,development_state);
create index if not exists idx_khpos_ops_potential_hypothesis_org
  on public.khpos_ops_potential_hypotheses(organisation_id,status,development_state);
create index if not exists idx_khpos_ops_potential_hypothesis_created_by
  on public.khpos_ops_potential_hypotheses(created_by,created_at desc);

create table if not exists public.khpos_ops_potential_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  hypothesis_id uuid references public.khpos_ops_potential_hypotheses(id) on delete set null,
  evidence_reference_code text not null,
  evidence_type text not null
    check (evidence_type in (
      'teacher_observation','skills_application','project','leadership',
      'financial_capability','value_creation','school_reflection',
      'learner_shared_portfolio','external','other'
    )),
  evidence_origin text not null
    check (evidence_origin in ('school','learner_shared','external','manual')),
  title text not null,
  evidence_note text not null,
  evidence_reference text not null,
  observed_at timestamptz not null,
  added_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active','withdrawn')),
  withdrawn_by uuid references auth.users(id) on delete set null,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  created_at timestamptz not null default now(),
  unique (organisation_id,evidence_reference_code)
);

create index if not exists idx_khpos_ops_potential_evidence_learner
  on public.khpos_ops_potential_evidence(learner_id,term_id,status,observed_at desc);
create index if not exists idx_khpos_ops_potential_evidence_hypothesis
  on public.khpos_ops_potential_evidence(hypothesis_id,status,observed_at desc)
  where hypothesis_id is not null;
create index if not exists idx_khpos_ops_potential_evidence_org
  on public.khpos_ops_potential_evidence(organisation_id,term_id,status);
create index if not exists idx_khpos_ops_potential_evidence_added_by
  on public.khpos_ops_potential_evidence(added_by,created_at desc);

create table if not exists public.khpos_ops_potential_explorations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  hypothesis_id uuid references public.khpos_ops_potential_hypotheses(id) on delete set null,
  exploration_reference text not null,
  exploration_type text not null
    check (exploration_type in (
      'exposure','practice','challenge','project','conversation',
      'shadowing','service','other'
    )),
  area_label text not null,
  purpose text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  planned_date date not null,
  review_date date not null,
  status text not null default 'planned'
    check (status in ('planned','active','completed','cancelled')),
  outcome_note text,
  evidence_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (review_date >= planned_date),
  unique (organisation_id,exploration_reference)
);

create index if not exists idx_khpos_ops_potential_exploration_learner
  on public.khpos_ops_potential_explorations(learner_id,term_id,status,review_date);
create index if not exists idx_khpos_ops_potential_exploration_owner
  on public.khpos_ops_potential_explorations(owner_assignment_id,status,review_date);
create index if not exists idx_khpos_ops_potential_exploration_hypothesis
  on public.khpos_ops_potential_explorations(hypothesis_id,status)
  where hypothesis_id is not null;
create index if not exists idx_khpos_ops_potential_exploration_created_by
  on public.khpos_ops_potential_explorations(created_by,created_at desc);

create table if not exists public.khpos_ops_potential_reflections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  reflection_reference text not null,
  reflection_type text not null
    check (reflection_type in (
      'school_conversation','project_debrief','skills_debrief',
      'leadership_debrief','value_creation_debrief','learner_shared_summary','other'
    )),
  learning_summary text not null,
  next_step text,
  evidence_reference text not null,
  reflected_at timestamptz not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organisation_id,reflection_reference)
);

create index if not exists idx_khpos_ops_potential_reflection_learner
  on public.khpos_ops_potential_reflections(learner_id,term_id,reflected_at desc);
create index if not exists idx_khpos_ops_potential_reflection_recorded_by
  on public.khpos_ops_potential_reflections(recorded_by,created_at desc);
create index if not exists idx_khpos_ops_potential_reflection_org
  on public.khpos_ops_potential_reflections(organisation_id,term_id);

create table if not exists public.khpos_ops_potential_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  review_reference text not null,
  discovery_summary text not null,
  hypothesis_summary text not null,
  evidence_summary text not null,
  development_summary text not null,
  contribution_summary text,
  next_priorities text not null,
  portfolio_reference text,
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
  unique (learner_id,term_id)
);

create index if not exists idx_khpos_ops_potential_review_org
  on public.khpos_ops_potential_reviews(organisation_id,term_id,status);
create index if not exists idx_khpos_ops_potential_review_prepared_by
  on public.khpos_ops_potential_reviews(prepared_by,status,created_at desc);
create index if not exists idx_khpos_ops_potential_review_approved_by
  on public.khpos_ops_potential_reviews(approved_by,approved_at desc)
  where approved_by is not null;

create table if not exists public.khpos_ops_potential_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid references public.khpos_ops_academic_terms(id) on delete set null,
  discovery_id uuid references public.khpos_ops_potential_discovery_records(id) on delete cascade,
  hypothesis_id uuid references public.khpos_ops_potential_hypotheses(id) on delete cascade,
  evidence_id uuid references public.khpos_ops_potential_evidence(id) on delete cascade,
  exploration_id uuid references public.khpos_ops_potential_explorations(id) on delete cascade,
  reflection_id uuid references public.khpos_ops_potential_reflections(id) on delete cascade,
  review_id uuid references public.khpos_ops_potential_reviews(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    num_nonnulls(
      discovery_id,hypothesis_id,evidence_id,exploration_id,reflection_id,review_id
    )>=1
  )
);

create index if not exists idx_khpos_ops_potential_events_learner
  on public.khpos_ops_potential_events(learner_id,created_at desc);
create index if not exists idx_khpos_ops_potential_events_term
  on public.khpos_ops_potential_events(term_id,created_at desc)
  where term_id is not null;
create index if not exists idx_khpos_ops_potential_events_review
  on public.khpos_ops_potential_events(review_id,created_at desc)
  where review_id is not null;

alter table public.khpos_ops_potential_discovery_records enable row level security;
alter table public.khpos_ops_potential_hypotheses enable row level security;
alter table public.khpos_ops_potential_evidence enable row level security;
alter table public.khpos_ops_potential_explorations enable row level security;
alter table public.khpos_ops_potential_reflections enable row level security;
alter table public.khpos_ops_potential_reviews enable row level security;
alter table public.khpos_ops_potential_events enable row level security;

revoke all privileges on table public.khpos_ops_potential_discovery_records from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_potential_hypotheses from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_potential_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_potential_explorations from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_potential_reflections from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_potential_reviews from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_potential_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_potential_discovery_records to service_role;
grant select,insert,update,delete on table public.khpos_ops_potential_hypotheses to service_role;
grant select,insert,update,delete on table public.khpos_ops_potential_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_potential_explorations to service_role;
grant select,insert,update,delete on table public.khpos_ops_potential_reflections to service_role;
grant select,insert,update,delete on table public.khpos_ops_potential_reviews to service_role;
grant select,insert,update,delete on table public.khpos_ops_potential_events to service_role;

create or replace function khpos_private.ops_hpd_has_membership(
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

create or replace function khpos_private.ops_hpd_actor_has_role(
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

create or replace function khpos_private.ops_hpd_can_coordinate(
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
    array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER']
  );
$$;

create or replace function khpos_private.ops_hpd_can_record(
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
      'SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR',
      'SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR'
    ]
  );
$$;

create or replace function khpos_private.ops_hpd_can_approve_review(
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
    array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER']
  );
$$;

create or replace function khpos_private.ops_hpd_learner_visible(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_learner_anchors l
    where l.id=p_learner_id
      and l.organisation_id=p_organisation_id
      and l.status='active'
      and (
        khpos_private.ops_lpi_learner_visible(
          p_actor_user_id,p_organisation_id,p_learner_id
        )
        or exists(
          select 1
          from public.khpos_ops_role_assignments a
          join public.khpos_ops_roles r on r.id=a.role_id
          where a.user_id=p_actor_user_id
            and a.status='active'
            and r.organisation_id=p_organisation_id
            and r.status='active'
            and r.code in ('SKILL_INSPECTOR','SKILLS_FACILITATOR')
            and (a.campus_id is null or a.campus_id=l.campus_id)
        )
      )
  );
$$;

create or replace function khpos_private.ops_hpd_valid_owner_assignment(
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
        'SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR',
        'SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR'
      )
  );
$$;

create or replace function khpos_private.ops_hpd_active_term(
  p_organisation_id uuid,
  p_term_id uuid,
  p_allow_closed boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_academic_terms t
    where t.id=p_term_id
      and t.organisation_id=p_organisation_id
      and (
        t.status='active'
        or (p_allow_closed and t.status='closed')
      )
  );
$$;

create or replace function public.khpos_ops_get_potential_discovery_server(
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
  v_can_approve boolean;
  v_is_executive boolean;
  v_learners jsonb := '[]'::jsonb;
  v_terms jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
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
  v_can_approve := khpos_private.ops_hpd_can_approve_review(
    p_actor_user_id,p_organisation_id
  );
  v_is_executive := exists(
    select 1
    from public.organisation_memberships m
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and m.role='executive'
  ) and not v_can_record;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'sessionLabel',t.session_label,'termCode',t.term_code,
    'termName',t.term_name,'status',t.status,'startDate',t.start_date,'endDate',t.end_date
  ) order by t.start_date desc),'[]'::jsonb)
  into v_terms
  from public.khpos_ops_academic_terms t
  where t.organisation_id=p_organisation_id
    and t.status in ('active','closed');

  if v_can_record or v_can_coordinate then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'userId',a.user_id,'roleCode',r.code,'roleTitle',r.title,
      'campusId',a.campus_id,'unitId',a.unit_id
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

  if not v_is_executive and (v_can_record or v_can_coordinate) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',l.id,
      'displayName',l.display_name,
      'classLabel',l.class_label,
      'sectionLabel',l.section_label,
      'campusId',l.campus_id,
      'discovery',(
        select jsonb_build_object(
          'id',d.id,'reference',d.discovery_reference,'termId',d.term_id,
          'interestsSummary',d.interests_summary,'curiositySummary',d.curiosity_summary,
          'meaningfulProblemsSummary',d.meaningful_problems_summary,
          'recurringStrengthsSummary',d.recurring_strengths_summary,
          'repeatedChoicesSummary',d.repeated_choices_summary,
          'discoveryNote',d.discovery_note,'evidenceReference',d.evidence_reference,
          'recordedAt',d.recorded_at
        )
        from public.khpos_ops_potential_discovery_records d
        where d.learner_id=l.id and d.status='active'
        order by d.recorded_at desc
        limit 1
      ),
      'hypotheses',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',h.id,'reference',h.hypothesis_reference,'themeLabel',h.theme_label,
          'hypothesisSummary',h.hypothesis_summary,
          'developmentState',h.development_state,'currentNote',h.current_note,
          'status',h.status,'createdAt',h.created_at
        ) order by h.created_at desc)
        from public.khpos_ops_potential_hypotheses h
        where h.learner_id=l.id and h.status='active'
      ),'[]'::jsonb),
      'evidence',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',e.id,'referenceCode',e.evidence_reference_code,
          'termId',e.term_id,'hypothesisId',e.hypothesis_id,
          'evidenceType',e.evidence_type,'evidenceOrigin',e.evidence_origin,
          'title',e.title,'evidenceNote',e.evidence_note,
          'evidenceReference',e.evidence_reference,'observedAt',e.observed_at,
          'status',e.status
        ) order by e.observed_at desc)
        from public.khpos_ops_potential_evidence e
        where e.learner_id=l.id and e.status='active'
      ),'[]'::jsonb),
      'explorations',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'reference',x.exploration_reference,'termId',x.term_id,
          'hypothesisId',x.hypothesis_id,'explorationType',x.exploration_type,
          'areaLabel',x.area_label,'purpose',x.purpose,
          'ownerAssignmentId',x.owner_assignment_id,
          'plannedDate',x.planned_date,'reviewDate',x.review_date,
          'status',x.status,'outcomeNote',x.outcome_note,
          'evidenceReference',x.evidence_reference
        ) order by x.review_date desc)
        from public.khpos_ops_potential_explorations x
        where x.learner_id=l.id
      ),'[]'::jsonb),
      'reflections',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',rf.id,'reference',rf.reflection_reference,'termId',rf.term_id,
          'reflectionType',rf.reflection_type,'learningSummary',rf.learning_summary,
          'nextStep',rf.next_step,'evidenceReference',rf.evidence_reference,
          'reflectedAt',rf.reflected_at
        ) order by rf.reflected_at desc)
        from public.khpos_ops_potential_reflections rf
        where rf.learner_id=l.id
      ),'[]'::jsonb),
      'reviews',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',rv.id,'reference',rv.review_reference,'termId',rv.term_id,
          'discoverySummary',rv.discovery_summary,
          'hypothesisSummary',rv.hypothesis_summary,
          'evidenceSummary',rv.evidence_summary,
          'developmentSummary',rv.development_summary,
          'contributionSummary',rv.contribution_summary,
          'nextPriorities',rv.next_priorities,
          'portfolioReference',rv.portfolio_reference,
          'status',rv.status,'preparedBy',rv.prepared_by,
          'submittedAt',rv.submitted_at,'approvedAt',rv.approved_at,
          'approvalNote',rv.approval_note,'returnNote',rv.return_note
        ) order by rv.created_at desc)
        from public.khpos_ops_potential_reviews rv
        where rv.learner_id=l.id
      ),'[]'::jsonb)
    ) order by l.class_label,l.section_label,l.display_name),'[]'::jsonb)
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
    'canCoordinate',v_can_coordinate,
    'canApproveReview',v_can_approve,
    'executiveAggregateOnly',v_is_executive,
    'privacyBoundary','PipuPath learner profiles, missions and private reflections are not copied into O16. KHP-OS stores only school-owned observations, learner-shared evidence references, institutional exploration work and termly review records.',
    'principle','Potential remains a hypothesis until repeated evidence, practice and contribution demonstrate growth. O16 never assigns a permanent talent label or numerical potential score.',
    'terms',v_terms,
    'assignments',v_assignments,
    'learners',v_learners,
    'summary',jsonb_build_object(
      'activeLearners',(
        select count(*) from public.khpos_ops_learner_anchors l
        where l.organisation_id=p_organisation_id and l.status='active'
      ),
      'learnersWithDiscovery',(
        select count(distinct d.learner_id)
        from public.khpos_ops_potential_discovery_records d
        where d.organisation_id=p_organisation_id and d.status='active'
      ),
      'activeHypotheses',(
        select count(*) from public.khpos_ops_potential_hypotheses h
        where h.organisation_id=p_organisation_id and h.status='active'
      ),
      'openExplorations',(
        select count(*) from public.khpos_ops_potential_explorations x
        where x.organisation_id=p_organisation_id and x.status in ('planned','active')
      ),
      'submittedReviews',(
        select count(*) from public.khpos_ops_potential_reviews rv
        where rv.organisation_id=p_organisation_id and rv.status='submitted'
      ),
      'approvedReviews',(
        select count(*) from public.khpos_ops_potential_reviews rv
        where rv.organisation_id=p_organisation_id and rv.status='approved'
      )
    )
  );
end;
$$;

create or replace function public.khpos_ops_record_potential_discovery_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_interests_summary text,
  p_curiosity_summary text,
  p_meaningful_problems_summary text,
  p_recurring_strengths_summary text,
  p_repeated_choices_summary text,
  p_discovery_note text,
  p_evidence_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
  v_reference text := 'DIS-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_hpd_can_record(p_actor_user_id,p_organisation_id) then
    raise exception 'Your operating role cannot record learner discovery.';
  end if;
  if not khpos_private.ops_hpd_learner_visible(p_actor_user_id,p_organisation_id,p_learner_id) then
    raise exception 'This learner is outside your governed visibility.';
  end if;
  if not khpos_private.ops_hpd_active_term(p_organisation_id,p_term_id,false) then
    raise exception 'Discovery must be recorded against an active academic term.';
  end if;
  if nullif(btrim(coalesce(p_discovery_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Discovery note and evidence reference are required.';
  end if;

  update public.khpos_ops_potential_discovery_records
  set status='superseded',updated_at=now()
  where learner_id=p_learner_id and term_id=p_term_id and status='active';

  insert into public.khpos_ops_potential_discovery_records(
    organisation_id,learner_id,term_id,discovery_reference,
    interests_summary,curiosity_summary,meaningful_problems_summary,
    recurring_strengths_summary,repeated_choices_summary,discovery_note,
    evidence_reference,recorded_by
  ) values (
    p_organisation_id,p_learner_id,p_term_id,v_reference,
    left(nullif(btrim(coalesce(p_interests_summary,'')),''),3000),
    left(nullif(btrim(coalesce(p_curiosity_summary,'')),''),3000),
    left(nullif(btrim(coalesce(p_meaningful_problems_summary,'')),''),3000),
    left(nullif(btrim(coalesce(p_recurring_strengths_summary,'')),''),3000),
    left(nullif(btrim(coalesce(p_repeated_choices_summary,'')),''),3000),
    left(btrim(p_discovery_note),5000),left(btrim(p_evidence_reference),1000),
    p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,discovery_id,actor_user_id,event_type,note
  ) values (
    p_organisation_id,p_learner_id,p_term_id,v_id,p_actor_user_id,
    'discovery_recorded',left(btrim(p_discovery_note),3000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_create_potential_hypothesis_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_origin_term_id uuid,
  p_theme_label text,
  p_hypothesis_summary text,
  p_current_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
  v_reference text := 'HYP-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_hpd_can_record(p_actor_user_id,p_organisation_id) then
    raise exception 'Your operating role cannot create potential hypotheses.';
  end if;
  if not khpos_private.ops_hpd_learner_visible(p_actor_user_id,p_organisation_id,p_learner_id) then
    raise exception 'This learner is outside your governed visibility.';
  end if;
  if p_origin_term_id is not null
     and not khpos_private.ops_hpd_active_term(p_organisation_id,p_origin_term_id,true) then
    raise exception 'Hypothesis origin term must be active or closed in this organisation.';
  end if;
  if nullif(btrim(coalesce(p_theme_label,'')),'') is null
     or nullif(btrim(coalesce(p_hypothesis_summary,'')),'') is null then
    raise exception 'Potential hypothesis theme and evidence-based summary are required.';
  end if;

  insert into public.khpos_ops_potential_hypotheses(
    organisation_id,learner_id,origin_term_id,hypothesis_reference,
    theme_label,hypothesis_summary,development_state,current_note,created_by
  ) values (
    p_organisation_id,p_learner_id,p_origin_term_id,v_reference,
    left(btrim(p_theme_label),180),left(btrim(p_hypothesis_summary),5000),
    'exploring',left(nullif(btrim(coalesce(p_current_note,'')),''),4000),
    p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,hypothesis_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,p_learner_id,p_origin_term_id,v_id,p_actor_user_id,
    'hypothesis_created','exploring',left(btrim(p_hypothesis_summary),3000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_potential_hypothesis_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_hypothesis_id uuid,
  p_action text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_h public.khpos_ops_potential_hypotheses%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_to text;
begin
  select * into v_h
  from public.khpos_ops_potential_hypotheses
  where id=p_hypothesis_id and organisation_id=p_organisation_id
  for update;

  if v_h.id is null then raise exception 'Potential hypothesis not found.'; end if;
  if not khpos_private.ops_hpd_can_coordinate(p_actor_user_id,p_organisation_id) then
    raise exception 'Only Human Potential coordinating roles can change hypothesis state.';
  end if;
  if not khpos_private.ops_hpd_learner_visible(p_actor_user_id,p_organisation_id,v_h.learner_id) then
    raise exception 'This learner is outside your governed visibility.';
  end if;
  if v_note is null then raise exception 'Evidence-based review note is required.'; end if;

  if p_action in ('exploring','emerging','developing','demonstrated') then
    if v_h.status<>'active' then raise exception 'Only active hypotheses can change development state.'; end if;
    v_to := p_action;
    update public.khpos_ops_potential_hypotheses
    set development_state=v_to,current_note=left(v_note,4000),updated_at=now()
    where id=v_h.id;
  elsif p_action='retire' then
    if v_h.status<>'active' then raise exception 'Only active hypotheses can be retired.'; end if;
    v_to := 'retired';
    update public.khpos_ops_potential_hypotheses
    set status='retired',retired_by=p_actor_user_id,retired_at=now(),
        retirement_note=left(v_note,4000),updated_at=now()
    where id=v_h.id;
  else
    raise exception 'Unsupported potential hypothesis action.';
  end if;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,hypothesis_id,actor_user_id,
    event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_h.learner_id,v_h.origin_term_id,v_h.id,p_actor_user_id,
    case when p_action='retire' then 'hypothesis_retired' else 'hypothesis_state_changed' end,
    case when p_action='retire' then v_h.status else v_h.development_state end,
    v_to,left(v_note,3000)
  );
end;
$$;

create or replace function public.khpos_ops_add_potential_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_hypothesis_id uuid,
  p_evidence_type text,
  p_evidence_origin text,
  p_title text,
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
  v_reference text := 'EVD-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_hpd_can_record(p_actor_user_id,p_organisation_id) then
    raise exception 'Your operating role cannot add Human Potential evidence.';
  end if;
  if not khpos_private.ops_hpd_learner_visible(p_actor_user_id,p_organisation_id,p_learner_id) then
    raise exception 'This learner is outside your governed visibility.';
  end if;
  if not khpos_private.ops_hpd_active_term(p_organisation_id,p_term_id,false) then
    raise exception 'Potential evidence must be recorded against an active academic term.';
  end if;
  if p_hypothesis_id is not null
     and not exists(
       select 1 from public.khpos_ops_potential_hypotheses h
       where h.id=p_hypothesis_id and h.organisation_id=p_organisation_id
         and h.learner_id=p_learner_id and h.status='active'
     ) then
    raise exception 'Linked potential hypothesis must be active for this learner.';
  end if;
  if p_evidence_type not in (
    'teacher_observation','skills_application','project','leadership',
    'financial_capability','value_creation','school_reflection',
    'learner_shared_portfolio','external','other'
  ) then raise exception 'Unsupported potential evidence type.'; end if;
  if p_evidence_origin not in ('school','learner_shared','external','manual') then
    raise exception 'Unsupported potential evidence origin.';
  end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Potential evidence title, note and reference are required.';
  end if;
  if p_observed_at is null or p_observed_at>now()+interval '5 minutes' then
    raise exception 'Observed-at timestamp is invalid.';
  end if;

  insert into public.khpos_ops_potential_evidence(
    organisation_id,learner_id,term_id,hypothesis_id,evidence_reference_code,
    evidence_type,evidence_origin,title,evidence_note,evidence_reference,
    observed_at,added_by
  ) values (
    p_organisation_id,p_learner_id,p_term_id,p_hypothesis_id,v_reference,
    p_evidence_type,p_evidence_origin,left(btrim(p_title),240),
    left(btrim(p_evidence_note),5000),left(btrim(p_evidence_reference),1000),
    p_observed_at,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,hypothesis_id,evidence_id,
    actor_user_id,event_type,note
  ) values (
    p_organisation_id,p_learner_id,p_term_id,p_hypothesis_id,v_id,
    p_actor_user_id,'potential_evidence_added',left(btrim(p_title),240)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_potential_evidence_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_evidence_id uuid,
  p_action text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_e public.khpos_ops_potential_evidence%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
begin
  select * into v_e
  from public.khpos_ops_potential_evidence
  where id=p_evidence_id and organisation_id=p_organisation_id
  for update;

  if v_e.id is null then raise exception 'Potential evidence not found.'; end if;
  if not khpos_private.ops_hpd_can_coordinate(p_actor_user_id,p_organisation_id) then
    raise exception 'Only Human Potential coordinating roles can withdraw evidence.';
  end if;
  if p_action<>'withdraw' then raise exception 'Unsupported potential evidence action.'; end if;
  if v_e.status<>'active' then raise exception 'Only active evidence can be withdrawn.'; end if;
  if v_reason is null then raise exception 'Evidence withdrawal reason is required.'; end if;

  update public.khpos_ops_potential_evidence
  set status='withdrawn',withdrawn_by=p_actor_user_id,withdrawn_at=now(),
      withdrawal_reason=left(v_reason,4000)
  where id=v_e.id;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,hypothesis_id,evidence_id,
    actor_user_id,event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_e.learner_id,v_e.term_id,v_e.hypothesis_id,v_e.id,
    p_actor_user_id,'potential_evidence_withdrawn','active','withdrawn',
    left(v_reason,3000)
  );
end;
$$;

create or replace function public.khpos_ops_create_potential_exploration_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_hypothesis_id uuid,
  p_exploration_type text,
  p_area_label text,
  p_purpose text,
  p_owner_assignment_id uuid,
  p_planned_date date,
  p_review_date date
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
  v_reference text := 'EXP-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_hpd_can_record(p_actor_user_id,p_organisation_id) then
    raise exception 'Your operating role cannot create exploration actions.';
  end if;
  if not khpos_private.ops_hpd_learner_visible(p_actor_user_id,p_organisation_id,p_learner_id) then
    raise exception 'This learner is outside your governed visibility.';
  end if;
  if not khpos_private.ops_hpd_active_term(p_organisation_id,p_term_id,false) then
    raise exception 'Exploration must be planned within an active academic term.';
  end if;
  if not khpos_private.ops_hpd_valid_owner_assignment(p_organisation_id,p_owner_assignment_id) then
    raise exception 'Exploration owner assignment is not valid.';
  end if;
  if p_hypothesis_id is not null
     and not exists(
       select 1 from public.khpos_ops_potential_hypotheses h
       where h.id=p_hypothesis_id and h.organisation_id=p_organisation_id
         and h.learner_id=p_learner_id and h.status='active'
     ) then
    raise exception 'Linked potential hypothesis must be active for this learner.';
  end if;
  if p_exploration_type not in (
    'exposure','practice','challenge','project','conversation',
    'shadowing','service','other'
  ) then raise exception 'Unsupported exploration type.'; end if;
  if nullif(btrim(coalesce(p_area_label,'')),'') is null
     or nullif(btrim(coalesce(p_purpose,'')),'') is null then
    raise exception 'Exploration area and purpose are required.';
  end if;
  if p_planned_date is null or p_review_date is null or p_review_date<p_planned_date then
    raise exception 'Exploration planned/review dates are invalid.';
  end if;

  insert into public.khpos_ops_potential_explorations(
    organisation_id,learner_id,term_id,hypothesis_id,exploration_reference,
    exploration_type,area_label,purpose,owner_assignment_id,planned_date,
    review_date,status,created_by
  ) values (
    p_organisation_id,p_learner_id,p_term_id,p_hypothesis_id,v_reference,
    p_exploration_type,left(btrim(p_area_label),180),left(btrim(p_purpose),4000),
    p_owner_assignment_id,p_planned_date,p_review_date,'planned',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,hypothesis_id,exploration_id,
    actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,p_learner_id,p_term_id,p_hypothesis_id,v_id,
    p_actor_user_id,'exploration_created','planned',left(btrim(p_purpose),3000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_potential_exploration_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_exploration_id uuid,
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
  v_x public.khpos_ops_potential_explorations%rowtype;
  v_owner boolean;
  v_coordinate boolean;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_reference text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_to text;
begin
  select * into v_x
  from public.khpos_ops_potential_explorations
  where id=p_exploration_id and organisation_id=p_organisation_id
  for update;
  if v_x.id is null then raise exception 'Potential exploration not found.'; end if;

  v_owner := exists(
    select 1 from public.khpos_ops_role_assignments a
    where a.id=v_x.owner_assignment_id and a.user_id=p_actor_user_id and a.status='active'
  );
  v_coordinate := khpos_private.ops_hpd_can_coordinate(p_actor_user_id,p_organisation_id);

  if p_action='start' then
    if not (v_owner or v_coordinate) then raise exception 'Only the exploration owner or coordinator can start it.'; end if;
    if v_x.status<>'planned' then raise exception 'Only planned exploration can start.'; end if;
    v_to := 'active';
    update public.khpos_ops_potential_explorations set status=v_to,updated_at=now() where id=v_x.id;
  elsif p_action='complete' then
    if not (v_owner or v_coordinate) then raise exception 'Only the exploration owner or coordinator can complete it.'; end if;
    if v_x.status not in ('planned','active') then raise exception 'Only open exploration can complete.'; end if;
    if v_note is null or v_reference is null then
      raise exception 'Exploration completion requires outcome note and evidence reference.';
    end if;
    v_to := 'completed';
    update public.khpos_ops_potential_explorations
    set status=v_to,outcome_note=left(v_note,5000),
        evidence_reference=left(v_reference,1000),
        completed_by=p_actor_user_id,completed_at=now(),updated_at=now()
    where id=v_x.id;
  elsif p_action='cancel' then
    if not v_coordinate then raise exception 'Only a Human Potential coordinator can cancel exploration.'; end if;
    if v_x.status in ('completed','cancelled') then raise exception 'This exploration can no longer be cancelled.'; end if;
    if v_note is null then raise exception 'Exploration cancellation reason is required.'; end if;
    v_to := 'cancelled';
    update public.khpos_ops_potential_explorations
    set status=v_to,cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_x.id;
  else
    raise exception 'Unsupported exploration action.';
  end if;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,hypothesis_id,exploration_id,
    actor_user_id,event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_x.learner_id,v_x.term_id,v_x.hypothesis_id,v_x.id,
    p_actor_user_id,'exploration_'||p_action,v_x.status,v_to,left(v_note,3000),
    jsonb_build_object('evidenceReference',v_reference)
  );
end;
$$;

create or replace function public.khpos_ops_record_potential_reflection_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_reflection_type text,
  p_learning_summary text,
  p_next_step text,
  p_evidence_reference text,
  p_reflected_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
  v_reference text := 'REF-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_hpd_can_record(p_actor_user_id,p_organisation_id) then
    raise exception 'Your operating role cannot record school-owned reflection evidence.';
  end if;
  if not khpos_private.ops_hpd_learner_visible(p_actor_user_id,p_organisation_id,p_learner_id) then
    raise exception 'This learner is outside your governed visibility.';
  end if;
  if not khpos_private.ops_hpd_active_term(p_organisation_id,p_term_id,false) then
    raise exception 'Reflection must be recorded against an active academic term.';
  end if;
  if p_reflection_type not in (
    'school_conversation','project_debrief','skills_debrief',
    'leadership_debrief','value_creation_debrief','learner_shared_summary','other'
  ) then raise exception 'Unsupported reflection type.'; end if;
  if nullif(btrim(coalesce(p_learning_summary,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Institutional reflection summary and evidence reference are required.';
  end if;
  if p_reflected_at is null or p_reflected_at>now()+interval '5 minutes' then
    raise exception 'Reflected-at timestamp is invalid.';
  end if;

  insert into public.khpos_ops_potential_reflections(
    organisation_id,learner_id,term_id,reflection_reference,reflection_type,
    learning_summary,next_step,evidence_reference,reflected_at,recorded_by
  ) values (
    p_organisation_id,p_learner_id,p_term_id,v_reference,p_reflection_type,
    left(btrim(p_learning_summary),5000),
    left(nullif(btrim(coalesce(p_next_step,'')),''),3000),
    left(btrim(p_evidence_reference),1000),p_reflected_at,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,reflection_id,actor_user_id,event_type,note
  ) values (
    p_organisation_id,p_learner_id,p_term_id,v_id,p_actor_user_id,
    'potential_reflection_recorded',left(btrim(p_learning_summary),3000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_create_potential_review_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_discovery_summary text,
  p_hypothesis_summary text,
  p_evidence_summary text,
  p_development_summary text,
  p_contribution_summary text,
  p_next_priorities text,
  p_portfolio_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
  v_reference text := 'PRV-'||upper(substr(gen_random_uuid()::text,1,8));
begin
  if not khpos_private.ops_hpd_can_record(p_actor_user_id,p_organisation_id) then
    raise exception 'Your operating role cannot prepare Potential Progress Review.';
  end if;
  if not khpos_private.ops_hpd_learner_visible(p_actor_user_id,p_organisation_id,p_learner_id) then
    raise exception 'This learner is outside your governed visibility.';
  end if;
  if not khpos_private.ops_hpd_active_term(p_organisation_id,p_term_id,true) then
    raise exception 'Potential review term must be active or closed.';
  end if;
  if nullif(btrim(coalesce(p_discovery_summary,'')),'') is null
     or nullif(btrim(coalesce(p_hypothesis_summary,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_summary,'')),'') is null
     or nullif(btrim(coalesce(p_development_summary,'')),'') is null
     or nullif(btrim(coalesce(p_next_priorities,'')),'') is null then
    raise exception 'Potential review requires discovery, hypotheses, evidence, development and next-priority summaries.';
  end if;

  insert into public.khpos_ops_potential_reviews(
    organisation_id,learner_id,term_id,review_reference,
    discovery_summary,hypothesis_summary,evidence_summary,development_summary,
    contribution_summary,next_priorities,portfolio_reference,status,prepared_by
  ) values (
    p_organisation_id,p_learner_id,p_term_id,v_reference,
    left(btrim(p_discovery_summary),5000),left(btrim(p_hypothesis_summary),5000),
    left(btrim(p_evidence_summary),5000),left(btrim(p_development_summary),5000),
    left(nullif(btrim(coalesce(p_contribution_summary,'')),''),5000),
    left(btrim(p_next_priorities),5000),
    left(nullif(btrim(coalesce(p_portfolio_reference,'')),''),1000),
    'draft',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,review_id,actor_user_id,event_type,to_status
  ) values (
    p_organisation_id,p_learner_id,p_term_id,v_id,p_actor_user_id,
    'potential_review_created','draft'
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_update_potential_review_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_review_id uuid,
  p_discovery_summary text,
  p_hypothesis_summary text,
  p_evidence_summary text,
  p_development_summary text,
  p_contribution_summary text,
  p_next_priorities text,
  p_portfolio_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_r public.khpos_ops_potential_reviews%rowtype;
begin
  select * into v_r
  from public.khpos_ops_potential_reviews
  where id=p_review_id and organisation_id=p_organisation_id
  for update;

  if v_r.id is null then raise exception 'Potential review not found.'; end if;
  if v_r.prepared_by<>p_actor_user_id
     and not khpos_private.ops_hpd_can_coordinate(p_actor_user_id,p_organisation_id) then
    raise exception 'Only the preparer or Human Potential coordinator can edit this review.';
  end if;
  if v_r.status not in ('draft','returned') then
    raise exception 'Only draft or returned reviews can be edited.';
  end if;
  if nullif(btrim(coalesce(p_discovery_summary,'')),'') is null
     or nullif(btrim(coalesce(p_hypothesis_summary,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_summary,'')),'') is null
     or nullif(btrim(coalesce(p_development_summary,'')),'') is null
     or nullif(btrim(coalesce(p_next_priorities,'')),'') is null then
    raise exception 'Potential review requires all core summaries.';
  end if;

  update public.khpos_ops_potential_reviews
  set discovery_summary=left(btrim(p_discovery_summary),5000),
      hypothesis_summary=left(btrim(p_hypothesis_summary),5000),
      evidence_summary=left(btrim(p_evidence_summary),5000),
      development_summary=left(btrim(p_development_summary),5000),
      contribution_summary=left(nullif(btrim(coalesce(p_contribution_summary,'')),''),5000),
      next_priorities=left(btrim(p_next_priorities),5000),
      portfolio_reference=left(nullif(btrim(coalesce(p_portfolio_reference,'')),''),1000),
      status='draft',
      returned_by=null,returned_at=null,return_note=null,
      updated_at=now()
  where id=v_r.id;
end;
$$;

create or replace function public.khpos_ops_potential_review_action_server(
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
  v_r public.khpos_ops_potential_reviews%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_to text;
begin
  select * into v_r
  from public.khpos_ops_potential_reviews
  where id=p_review_id and organisation_id=p_organisation_id
  for update;

  if v_r.id is null then raise exception 'Potential review not found.'; end if;

  if p_action='submit' then
    if v_r.prepared_by<>p_actor_user_id
       and not khpos_private.ops_hpd_can_coordinate(p_actor_user_id,p_organisation_id) then
      raise exception 'Only the preparer or coordinator can submit this review.';
    end if;
    if v_r.status not in ('draft','returned') then
      raise exception 'Only draft or returned review can be submitted.';
    end if;
    if not exists(
      select 1 from public.khpos_ops_potential_discovery_records d
      where d.learner_id=v_r.learner_id and d.term_id=v_r.term_id and d.status='active'
    ) then
      raise exception 'Potential review cannot submit without an active discovery record for the term.';
    end if;
    if not exists(
      select 1 from public.khpos_ops_potential_hypotheses h
      where h.learner_id=v_r.learner_id and h.status='active'
    ) then
      raise exception 'Potential review cannot submit without at least one active potential hypothesis.';
    end if;
    if not exists(
      select 1 from public.khpos_ops_potential_evidence e
      where e.learner_id=v_r.learner_id and e.term_id=v_r.term_id and e.status='active'
    ) then
      raise exception 'Potential review cannot submit without term evidence.';
    end if;
    if not exists(
      select 1 from public.khpos_ops_potential_reflections rf
      where rf.learner_id=v_r.learner_id and rf.term_id=v_r.term_id
    ) then
      raise exception 'Potential review cannot submit without a school-owned reflection summary for the term.';
    end if;
    v_to := 'submitted';
    update public.khpos_ops_potential_reviews
    set status=v_to,submitted_at=now(),updated_at=now()
    where id=v_r.id;

  elsif p_action='approve' then
    if not khpos_private.ops_hpd_can_approve_review(p_actor_user_id,p_organisation_id) then
      raise exception 'Only Sectional Promoter or School Guardian can approve Potential Progress Review.';
    end if;
    if v_r.status<>'submitted' then raise exception 'Only submitted review can be approved.'; end if;
    if v_r.prepared_by=p_actor_user_id then
      raise exception 'Potential review preparer cannot approve their own review.';
    end if;
    if v_note is null then raise exception 'Approval note is required.'; end if;
    v_to := 'approved';
    update public.khpos_ops_potential_reviews
    set status=v_to,approved_by=p_actor_user_id,approved_at=now(),
        approval_note=left(v_note,4000),updated_at=now()
    where id=v_r.id;

  elsif p_action='return' then
    if not khpos_private.ops_hpd_can_approve_review(p_actor_user_id,p_organisation_id) then
      raise exception 'Only Sectional Promoter or School Guardian can return Potential Progress Review.';
    end if;
    if v_r.status<>'submitted' then raise exception 'Only submitted review can be returned.'; end if;
    if v_note is null then raise exception 'Return reason is required.'; end if;
    v_to := 'returned';
    update public.khpos_ops_potential_reviews
    set status=v_to,returned_by=p_actor_user_id,returned_at=now(),
        return_note=left(v_note,4000),updated_at=now()
    where id=v_r.id;

  elsif p_action='cancel' then
    if not khpos_private.ops_hpd_can_coordinate(p_actor_user_id,p_organisation_id) then
      raise exception 'Only Human Potential coordinator can cancel Potential Progress Review.';
    end if;
    if v_r.status='approved' then raise exception 'Approved Potential Progress Review cannot be cancelled.'; end if;
    if v_note is null then raise exception 'Cancellation reason is required.'; end if;
    v_to := 'cancelled';
    update public.khpos_ops_potential_reviews
    set status=v_to,cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_r.id;
  else
    raise exception 'Unsupported Potential Progress Review action.';
  end if;

  insert into public.khpos_ops_potential_events(
    organisation_id,learner_id,term_id,review_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_r.learner_id,v_r.term_id,v_r.id,p_actor_user_id,
    'potential_review_'||p_action,v_r.status,v_to,left(v_note,3000)
  );
end;
$$;

revoke execute on function khpos_private.ops_hpd_has_membership(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_hpd_actor_has_role(uuid,uuid,text[])
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_hpd_can_coordinate(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_hpd_can_record(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_hpd_can_approve_review(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_hpd_learner_visible(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_hpd_valid_owner_assignment(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_hpd_active_term(uuid,uuid,boolean)
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_potential_discovery_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_record_potential_discovery_server(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_potential_hypothesis_server(uuid,uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_potential_hypothesis_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_potential_evidence_server(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,timestamptz)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_potential_evidence_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_potential_exploration_server(uuid,uuid,uuid,uuid,uuid,text,text,text,uuid,date,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_potential_exploration_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_record_potential_reflection_server(uuid,uuid,uuid,uuid,text,text,text,text,timestamptz)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_potential_review_server(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_update_potential_review_server(uuid,uuid,uuid,text,text,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_potential_review_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_hpd_has_membership(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_hpd_actor_has_role(uuid,uuid,text[]) to service_role;
grant execute on function khpos_private.ops_hpd_can_coordinate(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_hpd_can_record(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_hpd_can_approve_review(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_hpd_learner_visible(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_hpd_valid_owner_assignment(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_hpd_active_term(uuid,uuid,boolean) to service_role;

grant execute on function public.khpos_ops_get_potential_discovery_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_record_potential_discovery_server(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_potential_hypothesis_server(uuid,uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_potential_hypothesis_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_add_potential_evidence_server(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.khpos_ops_potential_evidence_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_create_potential_exploration_server(uuid,uuid,uuid,uuid,uuid,text,text,text,uuid,date,date) to service_role;
grant execute on function public.khpos_ops_potential_exploration_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_record_potential_reflection_server(uuid,uuid,uuid,uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.khpos_ops_create_potential_review_server(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_update_potential_review_server(uuid,uuid,uuid,text,text,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_potential_review_action_server(uuid,uuid,uuid,text,text) to service_role;
