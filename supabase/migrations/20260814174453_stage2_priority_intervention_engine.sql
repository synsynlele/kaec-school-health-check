create extension if not exists pgcrypto;

create table if not exists public.khpos_interventions (
  id uuid primary key default gen_random_uuid(),
  intervention_code text not null unique,
  title text not null,
  primary_system_id text not null check (primary_system_id in (
    'identity_direction','learning_mastery','capability_development',
    'value_creation_application','human_development_ecosystem',
    'institutional_excellence','intelligence_continuous_improvement'
  )),
  category text not null,
  status text not null default 'active' check (status in ('active','retired')),
  foundation_version text not null default '1.0',
  created_at timestamptz not null default now()
);

create table if not exists public.khpos_intervention_versions (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.khpos_interventions(id) on delete cascade,
  version text not null,
  problem_addressed text not null,
  description text not null,
  expected_outcome text not null,
  implementation_guidance text not null,
  complexity text not null default 'medium' check (complexity in ('low','medium','high')),
  recommended_duration_days integer not null default 60 check (recommended_duration_days between 7 and 365),
  review_criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (intervention_id, version)
);

create table if not exists public.khpos_indicator_intervention_map (
  indicator_id text not null,
  intervention_id uuid not null references public.khpos_interventions(id) on delete cascade,
  relationship_strength numeric(3,2) not null default 1.00 check (relationship_strength > 0 and relationship_strength <= 1),
  rationale text not null,
  foundation_version text not null default '1.0',
  created_at timestamptz not null default now(),
  primary key (indicator_id, intervention_id)
);

create table if not exists public.khpos_priorities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  source_assessment_id uuid not null references public.assessments(id) on delete restrict,
  source_indicator_id text not null,
  title text not null,
  problem_statement text not null,
  khp_system_id text not null check (khp_system_id in (
    'identity_direction','learning_mastery','capability_development',
    'value_creation_application','human_development_ecosystem',
    'institutional_excellence','intelligence_continuous_improvement'
  )),
  indicator_score smallint not null check (indicator_score between 1 and 5),
  severity smallint not null check (severity between 1 and 5),
  urgency smallint not null check (urgency between 1 and 5),
  strategic_importance smallint not null check (strategic_importance between 1 and 5),
  readiness smallint not null default 3 check (readiness between 1 and 5),
  priority_score numeric(5,2) not null check (priority_score >= 0 and priority_score <= 100),
  status text not null default 'approved' check (status in ('proposed','under_review','approved','active','resolved','archived')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_khpos_priority_assessment_indicator
  on public.khpos_priorities (organisation_id, source_assessment_id, source_indicator_id);

create table if not exists public.khpos_organisation_interventions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  priority_id uuid not null references public.khpos_priorities(id) on delete restrict,
  intervention_version_id uuid not null references public.khpos_intervention_versions(id) on delete restrict,
  title text not null,
  contextualised_description text not null,
  owner_id uuid references auth.users(id) on delete set null,
  start_date date,
  target_date date,
  status text not null default 'planned' check (status in ('proposed','approved','planned','active','under_review','completed','adjusted','escalated','abandoned')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (priority_id)
);

create index if not exists idx_khpos_priorities_org_status
  on public.khpos_priorities (organisation_id, status, created_at desc);
create index if not exists idx_khpos_priorities_assessment
  on public.khpos_priorities (source_assessment_id, status);
create index if not exists idx_khpos_org_interventions_org_status
  on public.khpos_organisation_interventions (organisation_id, status, created_at desc);
create index if not exists idx_khpos_indicator_intervention_indicator
  on public.khpos_indicator_intervention_map (indicator_id);
create index if not exists idx_khpos_intervention_versions_intervention
  on public.khpos_intervention_versions (intervention_id, version);

alter table public.khpos_interventions enable row level security;
alter table public.khpos_intervention_versions enable row level security;
alter table public.khpos_indicator_intervention_map enable row level security;
alter table public.khpos_priorities enable row level security;
alter table public.khpos_organisation_interventions enable row level security;

revoke all privileges on table public.khpos_interventions from public, anon, authenticated;
revoke all privileges on table public.khpos_intervention_versions from public, anon, authenticated;
revoke all privileges on table public.khpos_indicator_intervention_map from public, anon, authenticated;
revoke all privileges on table public.khpos_priorities from public, anon, authenticated;
revoke all privileges on table public.khpos_organisation_interventions from public, anon, authenticated;

grant select, insert, update, delete on table public.khpos_interventions to service_role;
grant select, insert, update, delete on table public.khpos_intervention_versions to service_role;
grant select, insert, update, delete on table public.khpos_indicator_intervention_map to service_role;
grant select, insert, update, delete on table public.khpos_priorities to service_role;
grant select, insert, update, delete on table public.khpos_organisation_interventions to service_role;

with intervention_seed(indicator_id, intervention_code, title, primary_system_id, category) as (
  values
    ('leadership_1','KHP-INT-LEADERSHIP-1','Strategic Direction & Improvement Planning','institutional_excellence','leadership'),
    ('leadership_2','KHP-INT-LEADERSHIP-2','Instructional Leadership & Coaching','human_development_ecosystem','leadership'),
    ('leadership_3','KHP-INT-LEADERSHIP-3','Evidence-Based Leadership','intelligence_continuous_improvement','leadership'),
    ('leadership_4','KHP-INT-LEADERSHIP-4','Organisation & Accountability System','institutional_excellence','leadership'),
    ('leadership_5','KHP-INT-LEADERSHIP-5','Leadership Standards & Culture','human_development_ecosystem','leadership'),
    ('teaching_1','KHP-INT-TEACHING-1','HQLS Lesson Planning System','learning_mastery','teaching'),
    ('teaching_2','KHP-INT-TEACHING-2','Active Learning & Inquiry','learning_mastery','teaching'),
    ('teaching_3','KHP-INT-TEACHING-3','Formative Assessment & Adaptive Teaching','learning_mastery','teaching'),
    ('teaching_4','KHP-INT-TEACHING-4','Teacher Development & Coaching','human_development_ecosystem','teaching'),
    ('teaching_5','KHP-INT-TEACHING-5','Teacher Continuity & Performance Support','institutional_excellence','teaching'),
    ('student_dev_1','KHP-INT-STUDENT-DEV-1','Learner Progress & Early Intervention','intelligence_continuous_improvement','student_dev'),
    ('student_dev_2','KHP-INT-STUDENT-DEV-2','Whole-Person Capability Programme','capability_development','student_dev'),
    ('student_dev_3','KHP-INT-STUDENT-DEV-3','Positive Behaviour & Discipline System','human_development_ecosystem','student_dev'),
    ('student_dev_4','KHP-INT-STUDENT-DEV-4','Transition & Pathway Support','identity_direction','student_dev'),
    ('student_dev_5','KHP-INT-STUDENT-DEV-5','Student Voice & Leadership','capability_development','student_dev'),
    ('finance_1','KHP-INT-FINANCE-1','Budgeting & Management Accounts','institutional_excellence','finance'),
    ('finance_2','KHP-INT-FINANCE-2','Financial Sustainability & Unit Economics','institutional_excellence','finance'),
    ('finance_3','KHP-INT-FINANCE-3','Fee Collection & Receivables System','institutional_excellence','finance'),
    ('finance_4','KHP-INT-FINANCE-4','Reserve & Financial Risk Management','institutional_excellence','finance'),
    ('finance_5','KHP-INT-FINANCE-5','Financial Records & Independent Review','institutional_excellence','finance'),
    ('infrastructure_1','KHP-INT-INFRASTRUCTURE-1','Learning Environment Standards','institutional_excellence','infrastructure'),
    ('infrastructure_2','KHP-INT-INFRASTRUCTURE-2','Learning Resources Utilisation','learning_mastery','infrastructure'),
    ('infrastructure_3','KHP-INT-INFRASTRUCTURE-3','Water, Sanitation & Hygiene System','institutional_excellence','infrastructure'),
    ('infrastructure_4','KHP-INT-INFRASTRUCTURE-4','Safe Shared Spaces','institutional_excellence','infrastructure'),
    ('infrastructure_5','KHP-INT-INFRASTRUCTURE-5','Preventive Maintenance System','institutional_excellence','infrastructure'),
    ('parents_1','KHP-INT-PARENTS-1','Parent Communication System','human_development_ecosystem','parents'),
    ('parents_2','KHP-INT-PARENTS-2','Parent Concern & Resolution System','human_development_ecosystem','parents'),
    ('parents_3','KHP-INT-PARENTS-3','Parent & Community Partnership','human_development_ecosystem','parents'),
    ('parents_4','KHP-INT-PARENTS-4','Parent Voice & Feedback Loop','intelligence_continuous_improvement','parents'),
    ('parents_5','KHP-INT-PARENTS-5','Reputation & Referral Engine','institutional_excellence','parents'),
    ('technology_1','KHP-INT-TECHNOLOGY-1','Digital School Records / MIS','intelligence_continuous_improvement','technology'),
    ('technology_2','KHP-INT-TECHNOLOGY-2','Teacher Digital Capability','human_development_ecosystem','technology'),
    ('technology_3','KHP-INT-TECHNOLOGY-3','Learner Digital Access & Fluency','capability_development','technology'),
    ('technology_4','KHP-INT-TECHNOLOGY-4','Digital Communication Infrastructure','institutional_excellence','technology'),
    ('technology_5','KHP-INT-TECHNOLOGY-5','Data Governance, Security & Backup','institutional_excellence','technology'),
    ('governance_1','KHP-INT-GOVERNANCE-1','Regulatory Compliance System','institutional_excellence','governance'),
    ('governance_2','KHP-INT-GOVERNANCE-2','Governance Oversight System','institutional_excellence','governance'),
    ('governance_3','KHP-INT-GOVERNANCE-3','Policy Architecture & Compliance','institutional_excellence','governance'),
    ('governance_4','KHP-INT-GOVERNANCE-4','Continuity & Succession System','institutional_excellence','governance'),
    ('governance_5','KHP-INT-GOVERNANCE-5','Meeting & Decision Accountability','institutional_excellence','governance'),
    ('culture_1','KHP-INT-CULTURE-1','Values-to-Behaviour Culture System','human_development_ecosystem','culture'),
    ('culture_2','KHP-INT-CULTURE-2','Staff Experience & Morale','human_development_ecosystem','culture'),
    ('culture_3','KHP-INT-CULTURE-3','Respectful Learning Relationships','human_development_ecosystem','culture'),
    ('culture_4','KHP-INT-CULTURE-4','Recognition & Achievement System','human_development_ecosystem','culture'),
    ('culture_5','KHP-INT-CULTURE-5','Induction & Cultural Onboarding','human_development_ecosystem','culture'),
    ('safety_1','KHP-INT-SAFETY-1','Safeguarding Policy & Training','human_development_ecosystem','safety'),
    ('safety_2','KHP-INT-SAFETY-2','Access Control & Student Accountability','institutional_excellence','safety'),
    ('safety_3','KHP-INT-SAFETY-3','Emergency Preparedness System','institutional_excellence','safety'),
    ('safety_4','KHP-INT-SAFETY-4','Incident Learning System','intelligence_continuous_improvement','safety'),
    ('safety_5','KHP-INT-SAFETY-5','Anti-Bullying & Speak-Up System','human_development_ecosystem','safety'),
    ('innovation_1','KHP-INT-INNOVATION-1','Continuous Improvement Cycle','intelligence_continuous_improvement','innovation'),
    ('innovation_2','KHP-INT-INNOVATION-2','Enrolment Growth & Marketing System','institutional_excellence','innovation'),
    ('innovation_3','KHP-INT-INNOVATION-3','Innovation & Practice-Sharing System','human_development_ecosystem','innovation'),
    ('innovation_4','KHP-INT-INNOVATION-4','Benchmarking & Standards System','intelligence_continuous_improvement','innovation'),
    ('innovation_5','KHP-INT-INNOVATION-5','Strategic Development & Capital Plan','institutional_excellence','innovation')
)
insert into public.khpos_interventions (
  intervention_code, title, primary_system_id, category, status, foundation_version
)
select intervention_code, title, primary_system_id, category, 'active', '1.0'
from intervention_seed
on conflict (intervention_code) do update set
  title = excluded.title,
  primary_system_id = excluded.primary_system_id,
  category = excluded.category,
  status = 'active',
  foundation_version = '1.0';

insert into public.khpos_intervention_versions (
  intervention_id, version, problem_addressed, description, expected_outcome,
  implementation_guidance, complexity, recommended_duration_days, review_criteria
)
select
  i.id,
  '1.0',
  'Weak or inconsistent performance in the institutional practice measured by KSHC indicator ' || lower(replace(i.intervention_code, 'KHP-INT-', '')) || '.',
  'A structured institutional intervention to establish and embed ' || i.title || '.',
  i.title || ' operates as a repeatable school system with clear ownership, evidence and review.',
  'Define the minimum standard, assign a named owner, establish the routine and tools, implement for at least one cycle, capture evidence, and review the change against the linked KSHC indicator.',
  'medium',
  60,
  jsonb_build_array(
    'A defined standard, policy, routine or tool is in place.',
    'A named owner is accountable for implementation.',
    'Implementation evidence has been captured.',
    'A scheduled review tests whether the linked KSHC condition is improving.'
  )
from public.khpos_interventions i
where i.foundation_version = '1.0'
on conflict (intervention_id, version) do nothing;

with mapping_seed(indicator_id, intervention_code) as (
  values
    ('leadership_1','KHP-INT-LEADERSHIP-1'),
    ('leadership_2','KHP-INT-LEADERSHIP-2'),
    ('leadership_3','KHP-INT-LEADERSHIP-3'),
    ('leadership_4','KHP-INT-LEADERSHIP-4'),
    ('leadership_5','KHP-INT-LEADERSHIP-5'),
    ('teaching_1','KHP-INT-TEACHING-1'),
    ('teaching_2','KHP-INT-TEACHING-2'),
    ('teaching_3','KHP-INT-TEACHING-3'),
    ('teaching_4','KHP-INT-TEACHING-4'),
    ('teaching_5','KHP-INT-TEACHING-5'),
    ('student_dev_1','KHP-INT-STUDENT-DEV-1'),
    ('student_dev_2','KHP-INT-STUDENT-DEV-2'),
    ('student_dev_3','KHP-INT-STUDENT-DEV-3'),
    ('student_dev_4','KHP-INT-STUDENT-DEV-4'),
    ('student_dev_5','KHP-INT-STUDENT-DEV-5'),
    ('finance_1','KHP-INT-FINANCE-1'),
    ('finance_2','KHP-INT-FINANCE-2'),
    ('finance_3','KHP-INT-FINANCE-3'),
    ('finance_4','KHP-INT-FINANCE-4'),
    ('finance_5','KHP-INT-FINANCE-5'),
    ('infrastructure_1','KHP-INT-INFRASTRUCTURE-1'),
    ('infrastructure_2','KHP-INT-INFRASTRUCTURE-2'),
    ('infrastructure_3','KHP-INT-INFRASTRUCTURE-3'),
    ('infrastructure_4','KHP-INT-INFRASTRUCTURE-4'),
    ('infrastructure_5','KHP-INT-INFRASTRUCTURE-5'),
    ('parents_1','KHP-INT-PARENTS-1'),
    ('parents_2','KHP-INT-PARENTS-2'),
    ('parents_3','KHP-INT-PARENTS-3'),
    ('parents_4','KHP-INT-PARENTS-4'),
    ('parents_5','KHP-INT-PARENTS-5'),
    ('technology_1','KHP-INT-TECHNOLOGY-1'),
    ('technology_2','KHP-INT-TECHNOLOGY-2'),
    ('technology_3','KHP-INT-TECHNOLOGY-3'),
    ('technology_4','KHP-INT-TECHNOLOGY-4'),
    ('technology_5','KHP-INT-TECHNOLOGY-5'),
    ('governance_1','KHP-INT-GOVERNANCE-1'),
    ('governance_2','KHP-INT-GOVERNANCE-2'),
    ('governance_3','KHP-INT-GOVERNANCE-3'),
    ('governance_4','KHP-INT-GOVERNANCE-4'),
    ('governance_5','KHP-INT-GOVERNANCE-5'),
    ('culture_1','KHP-INT-CULTURE-1'),
    ('culture_2','KHP-INT-CULTURE-2'),
    ('culture_3','KHP-INT-CULTURE-3'),
    ('culture_4','KHP-INT-CULTURE-4'),
    ('culture_5','KHP-INT-CULTURE-5'),
    ('safety_1','KHP-INT-SAFETY-1'),
    ('safety_2','KHP-INT-SAFETY-2'),
    ('safety_3','KHP-INT-SAFETY-3'),
    ('safety_4','KHP-INT-SAFETY-4'),
    ('safety_5','KHP-INT-SAFETY-5'),
    ('innovation_1','KHP-INT-INNOVATION-1'),
    ('innovation_2','KHP-INT-INNOVATION-2'),
    ('innovation_3','KHP-INT-INNOVATION-3'),
    ('innovation_4','KHP-INT-INNOVATION-4'),
    ('innovation_5','KHP-INT-INNOVATION-5')
)
insert into public.khpos_indicator_intervention_map (
  indicator_id, intervention_id, relationship_strength, rationale, foundation_version
)
select
  m.indicator_id,
  i.id,
  1.00,
  'Primary KHP-OS Intervention Library v1.0 route for KSHC indicator ' || m.indicator_id || '.',
  '1.0'
from mapping_seed m
join public.khpos_interventions i on i.intervention_code = m.intervention_code
on conflict (indicator_id, intervention_id) do update set
  relationship_strength = excluded.relationship_strength,
  rationale = excluded.rationale,
  foundation_version = excluded.foundation_version;

create or replace function public.khpos_approve_priority_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_assessment_id uuid,
  p_indicator_id text,
  p_title text,
  p_problem_statement text,
  p_khp_system_id text,
  p_indicator_score integer,
  p_priority_score numeric,
  p_owner_id uuid default null,
  p_target_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_role text;
  v_score integer;
  v_priority_id uuid;
  v_existing_priority_id uuid;
  v_active_count integer;
  v_intervention_id uuid;
  v_intervention_title text;
  v_intervention_version_id uuid;
  v_duration integer;
  v_org_intervention_id uuid;
  v_urgency integer;
  v_importance integer;
begin
  if p_actor_user_id is null then
    raise exception 'A verified actor is required.';
  end if;

  select m.role into v_role
  from public.organisation_memberships m
  where m.organisation_id = p_organisation_id
    and m.user_id = p_actor_user_id
    and m.status = 'active'
  limit 1;

  if v_role is null or v_role not in ('executive','transformation_lead') then
    raise exception 'Only an executive or transformation lead can approve transformation priorities.';
  end if;

  if not exists (
    select 1 from public.assessments a
    where a.id = p_assessment_id
      and a.organisation_id = p_organisation_id
      and a.status = 'completed'
  ) then
    raise exception 'A completed KSHC baseline for this organisation is required.';
  end if;

  select ans.score into v_score
  from public.answers ans
  where ans.assessment_id = p_assessment_id
    and ans.question_id = p_indicator_id
  order by ans.created_at desc nulls last, ans.id desc
  limit 1;

  if v_score is null then
    raise exception 'The selected KSHC indicator was not found in the baseline.';
  end if;

  if v_score <> p_indicator_score then
    raise exception 'The selected indicator score no longer matches the recorded KSHC baseline.';
  end if;

  if v_score > 3 then
    raise exception 'Only material KSHC gaps scoring 1 to 3 can enter the Stage 2 priority agenda.';
  end if;

  if p_khp_system_id not in (
    'identity_direction','learning_mastery','capability_development',
    'value_creation_application','human_development_ecosystem',
    'institutional_excellence','intelligence_continuous_improvement'
  ) then
    raise exception 'Unknown KHP-OS institutional system.';
  end if;

  select p.id into v_existing_priority_id
  from public.khpos_priorities p
  where p.organisation_id = p_organisation_id
    and p.source_assessment_id = p_assessment_id
    and p.source_indicator_id = p_indicator_id
  limit 1;

  if v_existing_priority_id is not null then
    if exists (
      select 1 from public.khpos_priorities p
      where p.id = v_existing_priority_id
        and p.status <> 'archived'
    ) then
      return jsonb_build_object(
        'priorityId', v_existing_priority_id,
        'alreadyApproved', true
      );
    end if;
  end if;

  select count(*) into v_active_count
  from public.khpos_priorities p
  where p.organisation_id = p_organisation_id
    and p.source_assessment_id = p_assessment_id
    and p.status in ('approved','active');

  if v_active_count >= 3 then
    raise exception 'This transformation agenda already has three active priorities. Archive one before approving another.';
  end if;

  select
    i.id,
    i.title,
    iv.id,
    iv.recommended_duration_days
  into
    v_intervention_id,
    v_intervention_title,
    v_intervention_version_id,
    v_duration
  from public.khpos_indicator_intervention_map m
  join public.khpos_interventions i
    on i.id = m.intervention_id
   and i.status = 'active'
  join public.khpos_intervention_versions iv
    on iv.intervention_id = i.id
   and iv.version = '1.0'
  where m.indicator_id = p_indicator_id
  order by m.relationship_strength desc, i.created_at asc
  limit 1;

  if v_intervention_id is null or v_intervention_version_id is null then
    raise exception 'No active KHP-OS intervention is mapped to this indicator.';
  end if;

  v_urgency := case v_score when 1 then 5 when 2 then 4 else 3 end;
  v_importance := case
    when p_indicator_id like 'safety_%' or p_indicator_id like 'governance_%' then 5
    when p_khp_system_id in ('institutional_excellence','learning_mastery','human_development_ecosystem') then 4
    else 3
  end;

  if v_existing_priority_id is not null then
    update public.khpos_priorities
    set title = p_title,
        problem_statement = p_problem_statement,
        khp_system_id = p_khp_system_id,
        indicator_score = v_score,
        severity = 6 - v_score,
        urgency = v_urgency,
        strategic_importance = v_importance,
        readiness = 3,
        priority_score = least(100, greatest(0, p_priority_score)),
        status = 'approved',
        approved_by = p_actor_user_id,
        approved_at = now(),
        created_by = coalesce(created_by, p_actor_user_id),
        updated_at = now()
    where id = v_existing_priority_id
    returning id into v_priority_id;
  else
    insert into public.khpos_priorities (
      organisation_id, source_assessment_id, source_indicator_id, title, problem_statement,
      khp_system_id, indicator_score, severity, urgency, strategic_importance, readiness,
      priority_score, status, approved_by, approved_at, created_by
    ) values (
      p_organisation_id, p_assessment_id, p_indicator_id, p_title, p_problem_statement,
      p_khp_system_id, v_score, 6 - v_score, v_urgency, v_importance, 3,
      least(100, greatest(0, p_priority_score)), 'approved', p_actor_user_id, now(), p_actor_user_id
    )
    returning id into v_priority_id;
  end if;

  insert into public.khpos_organisation_interventions (
    organisation_id, priority_id, intervention_version_id, title, contextualised_description,
    owner_id, start_date, target_date, status, created_by, approved_by
  ) values (
    p_organisation_id,
    v_priority_id,
    v_intervention_version_id,
    v_intervention_title,
    'Selected from KHP-OS Intervention Library v1.0 to address the approved priority: ' || p_title || '.',
    coalesce(p_owner_id, p_actor_user_id),
    current_date,
    coalesce(p_target_date, current_date + coalesce(v_duration, 60)),
    'planned',
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (priority_id) do update set
    intervention_version_id = excluded.intervention_version_id,
    title = excluded.title,
    contextualised_description = excluded.contextualised_description,
    owner_id = excluded.owner_id,
    start_date = excluded.start_date,
    target_date = excluded.target_date,
    status = 'planned',
    approved_by = excluded.approved_by,
    updated_at = now()
  returning id into v_org_intervention_id;

  insert into public.khpos_audit_events (
    organisation_id, actor_user_id, event_type, object_type, object_id, metadata
  ) values (
    p_organisation_id,
    p_actor_user_id,
    'priority_approved',
    'priority',
    v_priority_id,
    jsonb_build_object(
      'assessmentId', p_assessment_id,
      'indicatorId', p_indicator_id,
      'indicatorScore', v_score,
      'priorityScore', least(100, greatest(0, p_priority_score)),
      'interventionId', v_intervention_id,
      'organisationInterventionId', v_org_intervention_id,
      'libraryVersion', '1.0'
    )
  );

  return jsonb_build_object(
    'priorityId', v_priority_id,
    'organisationInterventionId', v_org_intervention_id,
    'alreadyApproved', false
  );
end;
$$;

revoke all on function public.khpos_approve_priority_server(
  uuid, uuid, uuid, text, text, text, text, integer, numeric, uuid, date
) from public, anon, authenticated;
grant execute on function public.khpos_approve_priority_server(
  uuid, uuid, uuid, text, text, text, text, integer, numeric, uuid, date
) to service_role;

create or replace function public.khpos_archive_priority_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_priority_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_role text;
begin
  select m.role into v_role
  from public.organisation_memberships m
  where m.organisation_id = p_organisation_id
    and m.user_id = p_actor_user_id
    and m.status = 'active'
  limit 1;

  if v_role is null or v_role not in ('executive','transformation_lead') then
    raise exception 'Only an executive or transformation lead can change the transformation agenda.';
  end if;

  if not exists (
    select 1 from public.khpos_priorities p
    where p.id = p_priority_id
      and p.organisation_id = p_organisation_id
      and p.status <> 'archived'
  ) then
    raise exception 'Active priority not found.';
  end if;

  update public.khpos_priorities
  set status = 'archived',
      updated_at = now()
  where id = p_priority_id
    and organisation_id = p_organisation_id;

  update public.khpos_organisation_interventions
  set status = case when status = 'completed' then status else 'abandoned' end,
      updated_at = now()
  where priority_id = p_priority_id
    and organisation_id = p_organisation_id;

  insert into public.khpos_audit_events (
    organisation_id, actor_user_id, event_type, object_type, object_id, metadata
  ) values (
    p_organisation_id,
    p_actor_user_id,
    'priority_archived',
    'priority',
    p_priority_id,
    jsonb_build_object('reason','leadership agenda adjustment')
  );

  return jsonb_build_object('priorityId', p_priority_id, 'archived', true);
end;
$$;

revoke all on function public.khpos_archive_priority_server(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.khpos_archive_priority_server(uuid, uuid, uuid)
  to service_role;

comment on table public.khpos_interventions is
  'KAEC-NG reusable KHP-OS intervention catalogue. Institution-neutral intellectual property.';
comment on table public.khpos_intervention_versions is
  'Versioned KHP-OS intervention playbooks. Historical selections remain traceable to the chosen version.';
comment on table public.khpos_priorities is
  'Human-approved institution transformation priorities derived from diagnostic evidence.';
comment on table public.khpos_organisation_interventions is
  'Contextualised intervention selections attached to approved priorities. Not a generic project-management table.';
comment on function public.khpos_approve_priority_server(
  uuid, uuid, uuid, text, text, text, text, integer, numeric, uuid, date
) is
  'Server-only atomic approval: verifies role and diagnostic evidence, limits agenda to three priorities, selects the mapped intervention and records audit history.';
