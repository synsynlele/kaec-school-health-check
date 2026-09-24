create extension if not exists pgcrypto;

-- O14: Learner Progress & Intervention.
-- The SIS remains the authoritative learner/student record.
-- KHP-OS stores only the minimum learner anchor required to govern support work.

create table if not exists public.khpos_ops_learner_anchors (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id) on delete restrict,
  external_system text not null
    check (external_system in ('SIS','external','manual')),
  external_learner_reference text not null,
  display_name text not null,
  class_label text not null,
  section_label text,
  status text not null default 'active'
    check (status in ('active','inactive','left')),
  last_synced_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,external_system,external_learner_reference)
);

create index if not exists idx_khpos_ops_learner_anchor_context
  on public.khpos_ops_learner_anchors(
    organisation_id,status,lower(class_label),lower(coalesce(section_label,''))
  );
create index if not exists idx_khpos_ops_learner_anchor_campus
  on public.khpos_ops_learner_anchors(campus_id,status)
  where campus_id is not null;

create table if not exists public.khpos_ops_learner_baselines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid references public.khpos_ops_academic_terms(id) on delete set null,
  baseline_reference text not null,
  baseline_source text not null
    check (baseline_source in ('SIS','KSI','external','manual')),
  starting_point_summary text not null,
  strengths_summary text,
  priority_gaps_summary text,
  evidence_reference text not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active','superseded')),
  created_at timestamptz not null default now(),
  unique (organisation_id,baseline_reference)
);

create unique index if not exists uq_khpos_ops_learner_current_baseline
  on public.khpos_ops_learner_baselines(
    learner_id,coalesce(term_id,'00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status='active';
create index if not exists idx_khpos_ops_learner_baseline_learner
  on public.khpos_ops_learner_baselines(learner_id,recorded_at desc);

create table if not exists public.khpos_ops_learner_risk_signals (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid references public.khpos_ops_academic_terms(id) on delete set null,
  stream_id uuid references public.khpos_ops_academic_delivery_streams(id) on delete set null,
  academic_debt_id uuid references public.khpos_ops_academic_debt(id) on delete set null,
  signal_reference text not null,
  signal_type text not null
    check (signal_type in (
      'low_formative_performance','sharp_decline','incomplete_work',
      'absence_pattern','prerequisite_gap','academic_debt',
      'teacher_concern','behaviour_interference','external_diagnostic','other'
    )),
  severity text not null
    check (severity in ('amber','red','critical')),
  source_system text not null
    check (source_system in ('SIS','KSI','KHP','external','manual')),
  source_reference text,
  signal_note text not null,
  observed_at timestamptz not null,
  reported_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'open'
    check (status in ('open','linked','resolved','dismissed')),
  quick_response_note text,
  quick_response_reference text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,signal_reference)
);

create index if not exists idx_khpos_ops_learner_signal_learner
  on public.khpos_ops_learner_risk_signals(learner_id,status,observed_at desc);
create index if not exists idx_khpos_ops_learner_signal_severity
  on public.khpos_ops_learner_risk_signals(organisation_id,status,severity,observed_at desc);
create index if not exists idx_khpos_ops_learner_signal_reporter
  on public.khpos_ops_learner_risk_signals(reported_by,status,observed_at desc);
create index if not exists idx_khpos_ops_learner_signal_academic_debt
  on public.khpos_ops_learner_risk_signals(academic_debt_id)
  where academic_debt_id is not null;

create table if not exists public.khpos_ops_learner_support_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid references public.khpos_ops_academic_terms(id) on delete set null,
  case_reference text not null,
  primary_signal_id uuid references public.khpos_ops_learner_risk_signals(id) on delete set null,
  severity text not null
    check (severity in ('amber','red','critical')),
  concern_summary text not null,
  case_owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  review_due_date date not null,
  status text not null default 'open'
    check (status in (
      'open','diagnosis','intervention_active','reassessment',
      'escalated','recovered','redirected','closed'
    )),
  linked_issue_id uuid references public.khpos_ops_issues(id) on delete set null,
  escalation_note text,
  closure_outcome text
    check (closure_outcome is null or closure_outcome in ('recovered','redirected')),
  closure_note text,
  opened_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,case_reference)
);

create unique index if not exists uq_khpos_ops_learner_one_open_case
  on public.khpos_ops_learner_support_cases(learner_id)
  where status not in ('closed','redirected');
create index if not exists idx_khpos_ops_learner_case_owner
  on public.khpos_ops_learner_support_cases(case_owner_assignment_id,status,review_due_date);
create index if not exists idx_khpos_ops_learner_case_org
  on public.khpos_ops_learner_support_cases(organisation_id,status,severity,review_due_date);
create index if not exists idx_khpos_ops_learner_case_issue
  on public.khpos_ops_learner_support_cases(linked_issue_id)
  where linked_issue_id is not null;

alter table public.khpos_ops_learner_risk_signals
  add column if not exists linked_case_id uuid
  references public.khpos_ops_learner_support_cases(id) on delete set null;

create index if not exists idx_khpos_ops_learner_signal_case
  on public.khpos_ops_learner_risk_signals(linked_case_id)
  where linked_case_id is not null;

create table if not exists public.khpos_ops_learner_diagnoses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_learner_support_cases(id) on delete cascade,
  diagnosis_version integer not null check (diagnosis_version>=1),
  barrier_categories text[] not null default '{}'::text[],
  diagnosis_summary text not null,
  evidence_note text not null,
  evidence_reference text not null,
  diagnosis_source text not null
    check (diagnosis_source in ('KSI','SIS','external','manual')),
  diagnosed_by uuid not null references auth.users(id) on delete restrict,
  diagnosed_at timestamptz not null default now(),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (case_id,diagnosis_version)
);

create unique index if not exists uq_khpos_ops_learner_current_diagnosis
  on public.khpos_ops_learner_diagnoses(case_id)
  where is_current;
create index if not exists idx_khpos_ops_learner_diagnosis_case
  on public.khpos_ops_learner_diagnoses(case_id,diagnosed_at desc);

create table if not exists public.khpos_ops_learner_interventions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_learner_support_cases(id) on delete cascade,
  intervention_reference text not null,
  tier integer not null check (tier between 1 and 4),
  target_outcome text not null,
  response_plan text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  start_date date not null,
  review_date date not null,
  success_criteria text not null,
  status text not null default 'planned'
    check (status in (
      'planned','active','review_due','completed','changed','cancelled'
    )),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organisation_id,intervention_reference),
  check (review_date>=start_date)
);

create index if not exists idx_khpos_ops_learner_intervention_case
  on public.khpos_ops_learner_interventions(case_id,status,review_date);
create index if not exists idx_khpos_ops_learner_intervention_owner
  on public.khpos_ops_learner_interventions(owner_assignment_id,status,review_date);

create table if not exists public.khpos_ops_learner_intervention_activities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  intervention_id uuid not null references public.khpos_ops_learner_interventions(id) on delete cascade,
  activity_date date not null,
  activity_note text not null,
  evidence_reference text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_learner_activity_intervention
  on public.khpos_ops_learner_intervention_activities(intervention_id,activity_date desc);

create table if not exists public.khpos_ops_learner_parent_partnership (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_learner_support_cases(id) on delete cascade,
  contact_date date not null,
  channel text not null
    check (channel in ('meeting','phone','message','email','letter','other')),
  summary text not null,
  agreed_action text,
  parent_action_due_date date,
  staff_action_due_date date,
  evidence_reference text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_learner_parent_case
  on public.khpos_ops_learner_parent_partnership(case_id,contact_date desc);

create table if not exists public.khpos_ops_learner_reassessments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_learner_support_cases(id) on delete cascade,
  intervention_id uuid references public.khpos_ops_learner_interventions(id) on delete set null,
  outcome text not null
    check (outcome in ('recovered','improving','no_improvement','redirect')),
  evidence_note text not null,
  evidence_reference text not null,
  next_action text,
  assessed_by uuid not null references auth.users(id) on delete restrict,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_learner_reassessment_case
  on public.khpos_ops_learner_reassessments(case_id,assessed_at desc);

create table if not exists public.khpos_ops_learner_progression_decisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  academic_year text not null,
  from_class_label text not null,
  proposed_next_class_label text,
  decision text not null
    check (decision in (
      'progress','progress_with_support','retain_reteach',
      'defer_pending_review','external_review_required','graduate_transition'
    )),
  attainment_reference text not null,
  foundational_gap_summary text,
  trajectory_summary text not null,
  intervention_summary text,
  attendance_reference text,
  exam_requirement_summary text,
  decision_rationale text not null,
  required_support text,
  parent_meeting_reference text,
  status text not null default 'proposed'
    check (status in ('proposed','confirmed','cancelled')),
  proposed_by uuid not null references auth.users(id) on delete restrict,
  proposed_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  confirmation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id,academic_year)
);

create index if not exists idx_khpos_ops_learner_progression_org
  on public.khpos_ops_learner_progression_decisions(organisation_id,status,academic_year);
create index if not exists idx_khpos_ops_learner_progression_learner
  on public.khpos_ops_learner_progression_decisions(learner_id,academic_year desc);

create table if not exists public.khpos_ops_learner_term_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  term_id uuid not null references public.khpos_ops_academic_terms(id) on delete cascade,
  overall_status text not null
    check (overall_status in ('green','amber','red','critical')),
  progress_summary text not null,
  open_risks_summary text,
  intervention_summary text,
  next_term_actions text,
  evidence_reference text not null,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id,term_id)
);

create index if not exists idx_khpos_ops_learner_term_review_term
  on public.khpos_ops_learner_term_reviews(term_id,overall_status);

create table if not exists public.khpos_ops_learner_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  learner_id uuid not null references public.khpos_ops_learner_anchors(id) on delete cascade,
  risk_signal_id uuid references public.khpos_ops_learner_risk_signals(id) on delete cascade,
  case_id uuid references public.khpos_ops_learner_support_cases(id) on delete cascade,
  diagnosis_id uuid references public.khpos_ops_learner_diagnoses(id) on delete cascade,
  intervention_id uuid references public.khpos_ops_learner_interventions(id) on delete cascade,
  reassessment_id uuid references public.khpos_ops_learner_reassessments(id) on delete cascade,
  progression_decision_id uuid references public.khpos_ops_learner_progression_decisions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    num_nonnulls(
      risk_signal_id,case_id,diagnosis_id,intervention_id,
      reassessment_id,progression_decision_id
    )>=1
  )
);

create index if not exists idx_khpos_ops_learner_events_learner
  on public.khpos_ops_learner_events(learner_id,created_at desc);
create index if not exists idx_khpos_ops_learner_events_case
  on public.khpos_ops_learner_events(case_id,created_at desc)
  where case_id is not null;

alter table public.khpos_ops_learner_anchors enable row level security;
alter table public.khpos_ops_learner_baselines enable row level security;
alter table public.khpos_ops_learner_risk_signals enable row level security;
alter table public.khpos_ops_learner_support_cases enable row level security;
alter table public.khpos_ops_learner_diagnoses enable row level security;
alter table public.khpos_ops_learner_interventions enable row level security;
alter table public.khpos_ops_learner_intervention_activities enable row level security;
alter table public.khpos_ops_learner_parent_partnership enable row level security;
alter table public.khpos_ops_learner_reassessments enable row level security;
alter table public.khpos_ops_learner_progression_decisions enable row level security;
alter table public.khpos_ops_learner_term_reviews enable row level security;
alter table public.khpos_ops_learner_events enable row level security;

revoke all privileges on table public.khpos_ops_learner_anchors from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_baselines from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_risk_signals from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_support_cases from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_diagnoses from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_interventions from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_intervention_activities from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_parent_partnership from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_reassessments from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_progression_decisions from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_term_reviews from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_learner_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_learner_anchors to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_baselines to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_risk_signals to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_support_cases to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_diagnoses to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_interventions to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_intervention_activities to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_parent_partnership to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_reassessments to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_progression_decisions to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_term_reviews to service_role;
grant select,insert,update,delete on table public.khpos_ops_learner_events to service_role;

create or replace function khpos_private.ops_lpi_has_membership(
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

create or replace function khpos_private.ops_lpi_actor_has_role(
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

create or replace function khpos_private.ops_lpi_is_executive(
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
  );
$$;

create or replace function khpos_private.ops_lpi_can_manage(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select khpos_private.ops_lpi_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR']
  );
$$;

create or replace function khpos_private.ops_lpi_can_coordinate(
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
    khpos_private.ops_lpi_can_manage(p_actor_user_id,p_organisation_id)
    or khpos_private.ops_lpi_actor_has_role(
      p_actor_user_id,p_organisation_id,array['SECTIONAL_PROMOTER']
    );
$$;

create or replace function khpos_private.ops_lpi_can_report(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select khpos_private.ops_lpi_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SECTIONAL_PROMOTER','TEACHER']
  );
$$;

create or replace function khpos_private.ops_lpi_assignment_owned_by(
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

create or replace function khpos_private.ops_lpi_learner_visible(
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
        khpos_private.ops_lpi_can_coordinate(
          p_actor_user_id,p_organisation_id
        )
        or exists(
          select 1
          from public.khpos_ops_academic_delivery_streams s
          join public.khpos_ops_role_assignments a
            on a.id=s.teacher_assignment_id
          where s.organisation_id=p_organisation_id
            and s.status in ('approved','active')
            and a.user_id=p_actor_user_id
            and a.status='active'
            and coalesce(s.campus_id,a.campus_id) is not distinct from l.campus_id
            and lower(s.class_label)=lower(l.class_label)
            and lower(coalesce(s.section_label,''))=lower(coalesce(l.section_label,''))
        )
      )
  );
$$;

create or replace function khpos_private.ops_lpi_case_visible(
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
    from public.khpos_ops_learner_support_cases c
    where c.id=p_case_id
      and c.organisation_id=p_organisation_id
      and (
        khpos_private.ops_lpi_can_coordinate(
          p_actor_user_id,p_organisation_id
        )
        or c.opened_by=p_actor_user_id
        or khpos_private.ops_lpi_assignment_owned_by(
          p_actor_user_id,p_organisation_id,c.case_owner_assignment_id
        )
        or exists(
          select 1
          from public.khpos_ops_learner_interventions i
          where i.case_id=c.id
            and khpos_private.ops_lpi_assignment_owned_by(
              p_actor_user_id,p_organisation_id,i.owner_assignment_id
            )
        )
      )
  );
$$;

create or replace function khpos_private.ops_lpi_valid_case_owner(
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
      and r.code in ('SECTIONAL_PROMOTER','ACADEMIC_INSPECTOR','SCHOOL_GUARDIAN')
  );
$$;

create or replace function khpos_private.ops_lpi_valid_intervention_owner(
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
        'TEACHER','SECTIONAL_PROMOTER','ACADEMIC_INSPECTOR','SCHOOL_GUARDIAN'
      )
  );
$$;

create or replace function public.khpos_ops_get_learner_progress_server(
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
  v_can_coordinate boolean;
  v_can_report boolean;
  v_is_executive boolean;
  v_anchors jsonb := '[]'::jsonb;
  v_cases jsonb := '[]'::jsonb;
  v_signals jsonb := '[]'::jsonb;
  v_progression jsonb := '[]'::jsonb;
  v_terms jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_campuses jsonb := '[]'::jsonb;
begin
  if not khpos_private.ops_lpi_has_membership(
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

  v_can_manage := khpos_private.ops_lpi_can_manage(
    p_actor_user_id,p_organisation_id
  );
  v_can_coordinate := khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  );
  v_can_report := khpos_private.ops_lpi_can_report(
    p_actor_user_id,p_organisation_id
  );
  v_is_executive := khpos_private.ops_lpi_is_executive(
    p_actor_user_id,p_organisation_id
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'code',c.code,'name',c.name
  ) order by c.name),'[]'::jsonb)
  into v_campuses
  from public.khpos_ops_campuses c
  where c.organisation_id=p_organisation_id
    and c.status='active';

  if v_can_report or v_can_coordinate then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',l.id,
      'externalSystem',l.external_system,
      'externalReference',l.external_learner_reference,
      'displayName',l.display_name,
      'classLabel',l.class_label,
      'sectionLabel',l.section_label,
      'campusId',l.campus_id,
      'status',l.status,
      'baseline',(
        select jsonb_build_object(
          'id',b.id,
          'reference',b.baseline_reference,
          'source',b.baseline_source,
          'startingPointSummary',b.starting_point_summary,
          'strengthsSummary',b.strengths_summary,
          'priorityGapsSummary',b.priority_gaps_summary,
          'evidenceReference',b.evidence_reference,
          'recordedAt',b.recorded_at
        )
        from public.khpos_ops_learner_baselines b
        where b.learner_id=l.id and b.status='active'
        order by b.recorded_at desc
        limit 1
      )
    ) order by l.class_label,l.section_label,l.display_name),'[]'::jsonb)
    into v_anchors
    from public.khpos_ops_learner_anchors l
    where l.organisation_id=p_organisation_id
      and l.status='active'
      and khpos_private.ops_lpi_learner_visible(
        p_actor_user_id,p_organisation_id,l.id
      );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'reference',s.signal_reference,
    'learnerId',s.learner_id,
    'learnerName',l.display_name,
    'classLabel',l.class_label,
    'sectionLabel',l.section_label,
    'signalType',s.signal_type,
    'severity',s.severity,
    'sourceSystem',s.source_system,
    'sourceReference',s.source_reference,
    'signalNote',s.signal_note,
    'observedAt',s.observed_at,
    'status',s.status,
    'linkedCaseId',s.linked_case_id,
    'quickResponseNote',s.quick_response_note,
    'quickResponseReference',s.quick_response_reference,
    'isReporter',s.reported_by=p_actor_user_id,
    'canResolveQuickly',
      s.reported_by=p_actor_user_id
      and s.severity='amber'
      and s.status='open'
  ) order by s.observed_at desc),'[]'::jsonb)
  into v_signals
  from public.khpos_ops_learner_risk_signals s
  join public.khpos_ops_learner_anchors l on l.id=s.learner_id
  where s.organisation_id=p_organisation_id
    and (
      v_can_coordinate
      or s.reported_by=p_actor_user_id
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,
    'reference',c.case_reference,
    'learnerId',c.learner_id,
    'learnerName',l.display_name,
    'classLabel',l.class_label,
    'sectionLabel',l.section_label,
    'severity',c.severity,
    'concernSummary',c.concern_summary,
    'caseOwnerAssignmentId',c.case_owner_assignment_id,
    'reviewDueDate',c.review_due_date,
    'status',c.status,
    'linkedIssueId',c.linked_issue_id,
    'escalationNote',c.escalation_note,
    'closureOutcome',c.closure_outcome,
    'closureNote',c.closure_note,
    'canCoordinate',v_can_coordinate,
    'canManage',v_can_manage,
    'diagnosis',(
      select jsonb_build_object(
        'id',d.id,
        'version',d.diagnosis_version,
        'barrierCategories',d.barrier_categories,
        'diagnosisSummary',d.diagnosis_summary,
        'evidenceNote',d.evidence_note,
        'evidenceReference',d.evidence_reference,
        'source',d.diagnosis_source,
        'diagnosedAt',d.diagnosed_at
      )
      from public.khpos_ops_learner_diagnoses d
      where d.case_id=c.id and d.is_current
      limit 1
    ),
    'interventions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,
        'reference',i.intervention_reference,
        'tier',i.tier,
        'targetOutcome',i.target_outcome,
        'responsePlan',i.response_plan,
        'ownerAssignmentId',i.owner_assignment_id,
        'startDate',i.start_date,
        'reviewDate',i.review_date,
        'successCriteria',i.success_criteria,
        'status',i.status,
        'isOwner',khpos_private.ops_lpi_assignment_owned_by(
          p_actor_user_id,p_organisation_id,i.owner_assignment_id
        ),
        'activities',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',a.id,
            'activityDate',a.activity_date,
            'activityNote',a.activity_note,
            'evidenceReference',a.evidence_reference
          ) order by a.activity_date desc,a.created_at desc)
          from public.khpos_ops_learner_intervention_activities a
          where a.intervention_id=i.id
        ),'[]'::jsonb)
      ) order by i.created_at desc)
      from public.khpos_ops_learner_interventions i
      where i.case_id=c.id
    ),'[]'::jsonb),
    'parentPartnership',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,
        'contactDate',p.contact_date,
        'channel',p.channel,
        'summary',p.summary,
        'agreedAction',p.agreed_action,
        'parentActionDueDate',p.parent_action_due_date,
        'staffActionDueDate',p.staff_action_due_date,
        'evidenceReference',p.evidence_reference
      ) order by p.contact_date desc,p.created_at desc)
      from public.khpos_ops_learner_parent_partnership p
      where p.case_id=c.id
    ),'[]'::jsonb),
    'reassessments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,
        'interventionId',r.intervention_id,
        'outcome',r.outcome,
        'evidenceNote',r.evidence_note,
        'evidenceReference',r.evidence_reference,
        'nextAction',r.next_action,
        'assessedAt',r.assessed_at
      ) order by r.assessed_at desc)
      from public.khpos_ops_learner_reassessments r
      where r.case_id=c.id
    ),'[]'::jsonb)
  ) order by c.updated_at desc),'[]'::jsonb)
  into v_cases
  from public.khpos_ops_learner_support_cases c
  join public.khpos_ops_learner_anchors l on l.id=c.learner_id
  where c.organisation_id=p_organisation_id
    and khpos_private.ops_lpi_case_visible(
      p_actor_user_id,p_organisation_id,c.id
    );

  if v_can_manage then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',d.id,
      'learnerId',d.learner_id,
      'learnerName',l.display_name,
      'academicYear',d.academic_year,
      'fromClassLabel',d.from_class_label,
      'proposedNextClassLabel',d.proposed_next_class_label,
      'decision',d.decision,
      'decisionRationale',d.decision_rationale,
      'requiredSupport',d.required_support,
      'parentMeetingReference',d.parent_meeting_reference,
      'status',d.status,
      'proposedAt',d.proposed_at,
      'confirmedAt',d.confirmed_at
    ) order by d.proposed_at desc),'[]'::jsonb)
    into v_progression
    from public.khpos_ops_learner_progression_decisions d
    join public.khpos_ops_learner_anchors l on l.id=d.learner_id
    where d.organisation_id=p_organisation_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,
    'sessionLabel',t.session_label,
    'termCode',t.term_code,
    'termName',t.term_name,
    'startDate',t.start_date,
    'endDate',t.end_date,
    'status',t.status
  ) order by t.start_date desc),'[]'::jsonb)
  into v_terms
  from public.khpos_ops_academic_terms t
  where t.organisation_id=p_organisation_id
    and t.status in ('draft','active','closed');

  if v_can_coordinate then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,
      'userId',a.user_id,
      'roleCode',r.code,
      'roleTitle',r.title,
      'campusId',a.campus_id,
      'unitId',a.unit_id
    ) order by r.role_level,r.title),'[]'::jsonb)
    into v_assignments
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where r.organisation_id=p_organisation_id
      and a.status='active'
      and r.status='active'
      and r.code in (
        'TEACHER','SECTIONAL_PROMOTER','ACADEMIC_INSPECTOR','SCHOOL_GUARDIAN'
      );
  end if;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canManage',v_can_manage,
    'canCoordinate',v_can_coordinate,
    'canReport',v_can_report,
    'executiveSummaryOnly',v_is_executive and not v_can_coordinate,
    'principle','No learner should quietly fall through the cracks: detect early, diagnose before structured intervention, review evidence and close only after recovery or governed redirection.',
    'systemBoundary','The SIS remains the authoritative student record and source of attendance/results. KSI may provide diagnosis intelligence. KHP-OS stores only the minimum learner reference and governs responsibility, intervention, evidence, review, escalation and closure.',
    'learners',v_anchors,
    'signals',v_signals,
    'cases',v_cases,
    'progressionDecisions',v_progression,
    'terms',v_terms,
    'assignments',v_assignments,
    'campuses',v_campuses,
    'summary',jsonb_build_object(
      'activeLearners',(
        select count(*) from public.khpos_ops_learner_anchors l
        where l.organisation_id=p_organisation_id and l.status='active'
      ),
      'openSignals',(
        select count(*) from public.khpos_ops_learner_risk_signals s
        where s.organisation_id=p_organisation_id and s.status='open'
      ),
      'openCases',(
        select count(*) from public.khpos_ops_learner_support_cases c
        where c.organisation_id=p_organisation_id and c.status<>'closed'
      ),
      'criticalCases',(
        select count(*) from public.khpos_ops_learner_support_cases c
        where c.organisation_id=p_organisation_id
          and c.status<>'closed'
          and c.severity='critical'
      ),
      'reviewsDue',(
        select count(*) from public.khpos_ops_learner_support_cases c
        where c.organisation_id=p_organisation_id
          and c.status not in ('closed','redirected')
          and c.review_due_date<=current_date
      ),
      'recoveredThisTerm',(
        select count(distinct c.id)
        from public.khpos_ops_learner_support_cases c
        join public.khpos_ops_learner_reassessments r on r.case_id=c.id
        where c.organisation_id=p_organisation_id
          and r.outcome='recovered'
          and exists(
            select 1 from public.khpos_ops_academic_terms t
            where t.organisation_id=p_organisation_id
              and t.status='active'
              and r.assessed_at::date between t.start_date and t.end_date
          )
      )
    )
  );
end;
$$;

create or replace function public.khpos_ops_upsert_learner_anchor_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_external_system text,
  p_external_learner_reference text,
  p_display_name text,
  p_class_label text,
  p_section_label text default null,
  p_campus_id uuid default null,
  p_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
begin
  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the Sectional Promoter, Academic Inspector or School Guardian can maintain learner anchors.';
  end if;

  if p_external_system not in ('SIS','external','manual') then
    raise exception 'Learner identity source must be SIS, external or manual.';
  end if;

  if nullif(btrim(coalesce(p_external_learner_reference,'')),'') is null
     or nullif(btrim(coalesce(p_display_name,'')),'') is null
     or nullif(btrim(coalesce(p_class_label,'')),'') is null then
    raise exception 'External learner reference, display name and class are required.';
  end if;

  if p_status not in ('active','inactive','left') then
    raise exception 'Unsupported learner-anchor status.';
  end if;

  if p_campus_id is null or not exists(
    select 1 from public.khpos_ops_campuses c
    where c.id=p_campus_id
      and c.organisation_id=p_organisation_id
      and c.status='active'
  ) then
    raise exception 'Learner anchor requires an active campus in this organisation.';
  end if;

  insert into public.khpos_ops_learner_anchors(
    organisation_id,campus_id,external_system,external_learner_reference,
    display_name,class_label,section_label,status,last_synced_at,created_by
  ) values (
    p_organisation_id,p_campus_id,p_external_system,
    left(btrim(p_external_learner_reference),240),
    left(btrim(p_display_name),240),
    left(btrim(p_class_label),120),
    left(nullif(btrim(coalesce(p_section_label,'')),''),120),
    p_status,
    case when p_external_system='SIS' then now() else null end,
    p_actor_user_id
  )
  on conflict (organisation_id,external_system,external_learner_reference)
  do update set
    campus_id=excluded.campus_id,
    display_name=excluded.display_name,
    class_label=excluded.class_label,
    section_label=excluded.section_label,
    status=excluded.status,
    last_synced_at=case
      when excluded.external_system='SIS' then now()
      else public.khpos_ops_learner_anchors.last_synced_at
    end,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.khpos_ops_record_learner_baseline_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_baseline_source text,
  p_starting_point_summary text,
  p_strengths_summary text,
  p_priority_gaps_summary text,
  p_evidence_reference text
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
  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only a learner-support coordinator can record the formal baseline.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_learner_anchors l
    where l.id=p_learner_id and l.organisation_id=p_organisation_id and l.status='active'
  ) then
    raise exception 'Active learner anchor not found.';
  end if;

  if p_term_id is not null and not exists(
    select 1 from public.khpos_ops_academic_terms t
    where t.id=p_term_id and t.organisation_id=p_organisation_id
  ) then
    raise exception 'Academic term not found in this organisation.';
  end if;

  if p_baseline_source not in ('SIS','KSI','external','manual') then
    raise exception 'Unsupported baseline source.';
  end if;

  if nullif(btrim(coalesce(p_starting_point_summary,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Starting-point summary and evidence reference are required.';
  end if;

  update public.khpos_ops_learner_baselines
  set status='superseded'
  where learner_id=p_learner_id
    and status='active'
    and term_id is not distinct from p_term_id;

  v_reference := 'BL-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_learner_baselines(
    organisation_id,learner_id,term_id,baseline_reference,baseline_source,
    starting_point_summary,strengths_summary,priority_gaps_summary,
    evidence_reference,recorded_by,status
  ) values (
    p_organisation_id,p_learner_id,p_term_id,v_reference,p_baseline_source,
    left(btrim(p_starting_point_summary),6000),
    left(nullif(btrim(coalesce(p_strengths_summary,'')),''),4000),
    left(nullif(btrim(coalesce(p_priority_gaps_summary,'')),''),4000),
    left(btrim(p_evidence_reference),1000),
    p_actor_user_id,'active'
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.khpos_ops_create_learner_risk_signal_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_stream_id uuid,
  p_academic_debt_id uuid,
  p_signal_type text,
  p_severity text,
  p_source_system text,
  p_source_reference text,
  p_signal_note text,
  p_observed_at timestamptz
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
  if not khpos_private.ops_lpi_can_report(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only learner-facing academic staff or leaders can report learner risk.';
  end if;

  if not khpos_private.ops_lpi_learner_visible(
    p_actor_user_id,p_organisation_id,p_learner_id
  ) then
    raise exception 'This learner is outside your current academic/section visibility.';
  end if;

  if p_signal_type not in (
    'low_formative_performance','sharp_decline','incomplete_work',
    'absence_pattern','prerequisite_gap','academic_debt',
    'teacher_concern','behaviour_interference','external_diagnostic','other'
  ) then
    raise exception 'Unsupported learner-risk signal type.';
  end if;

  if p_severity not in ('amber','red','critical') then
    raise exception 'Risk severity must be amber, red or critical.';
  end if;

  if p_source_system not in ('SIS','KSI','KHP','external','manual') then
    raise exception 'Unsupported learner-risk source.';
  end if;

  if nullif(btrim(coalesce(p_signal_note,'')),'') is null then
    raise exception 'Risk signal note is required.';
  end if;

  if p_term_id is not null and not exists(
    select 1 from public.khpos_ops_academic_terms t
    where t.id=p_term_id and t.organisation_id=p_organisation_id
  ) then
    raise exception 'Academic term not found in this organisation.';
  end if;

  if p_stream_id is not null and not exists(
    select 1 from public.khpos_ops_academic_delivery_streams s
    where s.id=p_stream_id and s.organisation_id=p_organisation_id
  ) then
    raise exception 'Academic stream not found in this organisation.';
  end if;

  if p_academic_debt_id is not null and not exists(
    select 1
    from public.khpos_ops_academic_debt d
    where d.id=p_academic_debt_id
      and d.organisation_id=p_organisation_id
      and (p_stream_id is null or d.stream_id=p_stream_id)
  ) then
    raise exception 'Academic-debt reference is invalid for this organisation/stream.';
  end if;

  if p_signal_type='academic_debt' and p_academic_debt_id is null then
    raise exception 'Academic-debt signal requires the linked O12 academic-debt record.';
  end if;

  v_reference := 'RSK-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_learner_risk_signals(
    organisation_id,learner_id,term_id,stream_id,academic_debt_id,
    signal_reference,signal_type,severity,source_system,source_reference,
    signal_note,observed_at,reported_by,status
  ) values (
    p_organisation_id,p_learner_id,p_term_id,p_stream_id,p_academic_debt_id,
    v_reference,p_signal_type,p_severity,p_source_system,
    left(nullif(btrim(coalesce(p_source_reference,'')),''),1000),
    left(btrim(p_signal_note),6000),
    coalesce(p_observed_at,now()),
    p_actor_user_id,'open'
  ) returning id into v_id;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,risk_signal_id,actor_user_id,
    event_type,to_status,note
  ) values (
    p_organisation_id,p_learner_id,v_id,p_actor_user_id,
    'risk_signal_created','open',left(btrim(p_signal_note),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_resolve_learner_risk_signal_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_signal_id uuid,
  p_action text,
  p_response_note text,
  p_evidence_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_signal public.khpos_ops_learner_risk_signals%rowtype;
  v_to text;
begin
  select * into v_signal
  from public.khpos_ops_learner_risk_signals
  where id=p_signal_id and organisation_id=p_organisation_id
  for update;

  if v_signal.id is null then raise exception 'Learner-risk signal not found.'; end if;

  if v_signal.reported_by<>p_actor_user_id
     and not khpos_private.ops_lpi_can_coordinate(
       p_actor_user_id,p_organisation_id
     ) then
    raise exception 'Only the reporter or learner-support coordinator can resolve this signal.';
  end if;

  if v_signal.status<>'open' then
    raise exception 'Only an open learner-risk signal can be resolved or dismissed.';
  end if;

  if p_action not in ('resolve','dismiss') then
    raise exception 'Risk-signal action must be resolve or dismiss.';
  end if;

  if nullif(btrim(coalesce(p_response_note,'')),'') is null then
    raise exception 'Record the response/reason before closing the signal.';
  end if;

  if p_action='resolve' and v_signal.severity<>'amber' then
    raise exception 'Red or critical signals require a structured learner-support case rather than quick closure.';
  end if;

  if p_action='dismiss'
     and not khpos_private.ops_lpi_can_coordinate(
       p_actor_user_id,p_organisation_id
     ) then
    raise exception 'Only a learner-support coordinator can dismiss an unsupported risk signal.';
  end if;

  v_to := case when p_action='resolve' then 'resolved' else 'dismissed' end;

  update public.khpos_ops_learner_risk_signals
  set status=v_to,
      quick_response_note=left(btrim(p_response_note),6000),
      quick_response_reference=left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000),
      resolved_by=p_actor_user_id,
      resolved_at=now(),
      updated_at=now()
  where id=v_signal.id;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,risk_signal_id,actor_user_id,
    event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_signal.learner_id,v_signal.id,p_actor_user_id,
    'risk_signal_'||p_action,v_signal.status,v_to,left(btrim(p_response_note),4000)
  );
end;
$$;

create or replace function public.khpos_ops_create_learner_support_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_primary_signal_id uuid,
  p_term_id uuid,
  p_severity text,
  p_concern_summary text,
  p_case_owner_assignment_id uuid,
  p_review_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_signal public.khpos_ops_learner_risk_signals%rowtype;
  v_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the Sectional Promoter, Academic Inspector or School Guardian can open a structured learner-support case.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_learner_anchors l
    where l.id=p_learner_id and l.organisation_id=p_organisation_id and l.status='active'
  ) then
    raise exception 'Active learner anchor not found.';
  end if;

  if p_severity not in ('amber','red','critical') then
    raise exception 'Case severity must be amber, red or critical.';
  end if;

  if nullif(btrim(coalesce(p_concern_summary,'')),'') is null then
    raise exception 'Structured learner concern summary is required.';
  end if;

  if p_review_due_date<current_date then
    raise exception 'Learner-support review date cannot be in the past.';
  end if;

  if not khpos_private.ops_lpi_valid_case_owner(
    p_organisation_id,p_case_owner_assignment_id
  ) then
    raise exception 'Case owner must be an active Sectional Promoter, Academic Inspector or School Guardian assignment.';
  end if;

  if p_primary_signal_id is not null then
    select * into v_signal
    from public.khpos_ops_learner_risk_signals
    where id=p_primary_signal_id
      and organisation_id=p_organisation_id
      and learner_id=p_learner_id
    for update;

    if v_signal.id is null or v_signal.status<>'open' then
      raise exception 'Primary risk signal must be an open signal for this learner.';
    end if;
  end if;

  if p_term_id is not null and not exists(
    select 1 from public.khpos_ops_academic_terms t
    where t.id=p_term_id and t.organisation_id=p_organisation_id
  ) then
    raise exception 'Academic term not found in this organisation.';
  end if;

  v_reference := 'LPI-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_learner_support_cases(
    organisation_id,learner_id,term_id,case_reference,primary_signal_id,
    severity,concern_summary,case_owner_assignment_id,review_due_date,
    status,opened_by
  ) values (
    p_organisation_id,p_learner_id,p_term_id,v_reference,p_primary_signal_id,
    p_severity,left(btrim(p_concern_summary),6000),
    p_case_owner_assignment_id,p_review_due_date,'open',p_actor_user_id
  ) returning id into v_id;

  if p_primary_signal_id is not null then
    update public.khpos_ops_learner_risk_signals
    set status='linked',linked_case_id=v_id,updated_at=now()
    where id=p_primary_signal_id;
  end if;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,case_id,actor_user_id,
    event_type,to_status,note,metadata
  ) values (
    p_organisation_id,p_learner_id,v_id,p_actor_user_id,
    'support_case_opened','open',left(btrim(p_concern_summary),4000),
    jsonb_build_object('primarySignalId',p_primary_signal_id,'severity',p_severity)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_record_learner_diagnosis_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_barrier_categories text[],
  p_diagnosis_summary text,
  p_evidence_note text,
  p_evidence_reference text,
  p_diagnosis_source text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_learner_support_cases%rowtype;
  v_version integer;
  v_id uuid;
begin
  select * into v_case
  from public.khpos_ops_learner_support_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Learner-support case not found.'; end if;

  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the learner-support coordinator can record the formal diagnosis.';
  end if;

  if v_case.status in ('closed','redirected') then
    raise exception 'Closed or redirected learner-support case cannot receive a new diagnosis.';
  end if;

  if nullif(btrim(coalesce(p_diagnosis_summary,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Diagnosis summary, evidence note and evidence reference are required.';
  end if;

  if p_diagnosis_source not in ('KSI','SIS','external','manual') then
    raise exception 'Unsupported diagnosis source.';
  end if;

  update public.khpos_ops_learner_diagnoses
  set is_current=false
  where case_id=v_case.id and is_current;

  select coalesce(max(diagnosis_version),0)+1 into v_version
  from public.khpos_ops_learner_diagnoses
  where case_id=v_case.id;

  insert into public.khpos_ops_learner_diagnoses(
    organisation_id,case_id,diagnosis_version,barrier_categories,
    diagnosis_summary,evidence_note,evidence_reference,
    diagnosis_source,diagnosed_by,is_current
  ) values (
    p_organisation_id,v_case.id,v_version,
    coalesce(p_barrier_categories,'{}'::text[]),
    left(btrim(p_diagnosis_summary),6000),
    left(btrim(p_evidence_note),6000),
    left(btrim(p_evidence_reference),1000),
    p_diagnosis_source,p_actor_user_id,true
  ) returning id into v_id;

  update public.khpos_ops_learner_support_cases
  set status='diagnosis',updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,case_id,diagnosis_id,actor_user_id,
    event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_case.learner_id,v_case.id,v_id,p_actor_user_id,
    'diagnosis_recorded',v_case.status,'diagnosis',
    left(btrim(p_diagnosis_summary),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_create_learner_intervention_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_tier integer,
  p_target_outcome text,
  p_response_plan text,
  p_owner_assignment_id uuid,
  p_start_date date,
  p_review_date date,
  p_success_criteria text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_learner_support_cases%rowtype;
  v_id uuid;
  v_reference text;
begin
  select * into v_case
  from public.khpos_ops_learner_support_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Learner-support case not found.'; end if;

  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the learner-support coordinator can create a structured intervention plan.';
  end if;

  if v_case.status in ('closed','redirected') then
    raise exception 'Closed or redirected case cannot receive a new intervention.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_learner_diagnoses d
    where d.case_id=v_case.id and d.is_current
  ) then
    raise exception 'Record the learning-gap diagnosis before creating a structured intervention.';
  end if;

  if p_tier not between 1 and 4 then
    raise exception 'Intervention tier must be between 1 and 4.';
  end if;

  if nullif(btrim(coalesce(p_target_outcome,'')),'') is null
     or nullif(btrim(coalesce(p_response_plan,'')),'') is null
     or nullif(btrim(coalesce(p_success_criteria,'')),'') is null then
    raise exception 'Intervention target, response plan and success criteria are required.';
  end if;

  if p_start_date<current_date-30 then
    raise exception 'Intervention start date is outside the supported retrospective window.';
  end if;

  if p_review_date<p_start_date then
    raise exception 'Intervention review date must be on or after the start date.';
  end if;

  if not khpos_private.ops_lpi_valid_intervention_owner(
    p_organisation_id,p_owner_assignment_id
  ) then
    raise exception 'Intervention owner must be an active Teacher or learner-support leadership assignment.';
  end if;

  v_reference := 'INT-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_learner_interventions(
    organisation_id,case_id,intervention_reference,tier,target_outcome,
    response_plan,owner_assignment_id,start_date,review_date,
    success_criteria,status,created_by
  ) values (
    p_organisation_id,v_case.id,v_reference,p_tier,
    left(btrim(p_target_outcome),4000),
    left(btrim(p_response_plan),6000),
    p_owner_assignment_id,p_start_date,p_review_date,
    left(btrim(p_success_criteria),4000),
    case when p_start_date<=current_date then 'active' else 'planned' end,
    p_actor_user_id
  ) returning id into v_id;

  update public.khpos_ops_learner_support_cases
  set status='intervention_active',review_due_date=p_review_date,updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,case_id,intervention_id,actor_user_id,
    event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_case.learner_id,v_case.id,v_id,p_actor_user_id,
    'intervention_created',v_case.status,'intervention_active',
    left(btrim(p_target_outcome),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_add_learner_intervention_activity_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_intervention_id uuid,
  p_activity_date date,
  p_activity_note text,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_intervention public.khpos_ops_learner_interventions%rowtype;
  v_case public.khpos_ops_learner_support_cases%rowtype;
  v_id uuid;
begin
  select * into v_intervention
  from public.khpos_ops_learner_interventions
  where id=p_intervention_id and organisation_id=p_organisation_id
  for update;

  if v_intervention.id is null then raise exception 'Learner intervention not found.'; end if;

  if not khpos_private.ops_lpi_assignment_owned_by(
    p_actor_user_id,p_organisation_id,v_intervention.owner_assignment_id
  ) and not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the intervention owner or learner-support coordinator can record intervention activity.';
  end if;

  if v_intervention.status not in ('planned','active','review_due') then
    raise exception 'This intervention is no longer active for new activity evidence.';
  end if;

  if nullif(btrim(coalesce(p_activity_note,'')),'') is null then
    raise exception 'Intervention activity note is required.';
  end if;

  insert into public.khpos_ops_learner_intervention_activities(
    organisation_id,intervention_id,activity_date,activity_note,
    evidence_reference,recorded_by
  ) values (
    p_organisation_id,v_intervention.id,coalesce(p_activity_date,current_date),
    left(btrim(p_activity_note),6000),
    left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000),
    p_actor_user_id
  ) returning id into v_id;

  if v_intervention.status='planned' and coalesce(p_activity_date,current_date)>=v_intervention.start_date then
    update public.khpos_ops_learner_interventions
    set status='active',updated_at=now()
    where id=v_intervention.id;
  end if;

  select * into v_case
  from public.khpos_ops_learner_support_cases
  where id=v_intervention.case_id;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,case_id,intervention_id,actor_user_id,
    event_type,note,metadata
  ) values (
    p_organisation_id,v_case.learner_id,v_case.id,v_intervention.id,
    p_actor_user_id,'intervention_activity_recorded',
    left(btrim(p_activity_note),4000),
    jsonb_build_object('activityId',v_id,'activityDate',coalesce(p_activity_date,current_date))
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_record_learner_parent_partnership_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_contact_date date,
  p_channel text,
  p_summary text,
  p_agreed_action text default null,
  p_parent_action_due_date date default null,
  p_staff_action_due_date date default null,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_learner_support_cases%rowtype;
  v_id uuid;
begin
  select * into v_case
  from public.khpos_ops_learner_support_cases
  where id=p_case_id and organisation_id=p_organisation_id;

  if v_case.id is null then raise exception 'Learner-support case not found.'; end if;

  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Parent intervention partnership is coordinated by Sectional Promoter/Academic leadership.';
  end if;

  if v_case.status in ('closed','redirected') then
    raise exception 'Closed or redirected case cannot receive a new parent-intervention record.';
  end if;

  if p_channel not in ('meeting','phone','message','email','letter','other') then
    raise exception 'Unsupported parent-partnership channel.';
  end if;

  if nullif(btrim(coalesce(p_summary,'')),'') is null then
    raise exception 'Parent-partnership summary is required.';
  end if;

  insert into public.khpos_ops_learner_parent_partnership(
    organisation_id,case_id,contact_date,channel,summary,agreed_action,
    parent_action_due_date,staff_action_due_date,evidence_reference,recorded_by
  ) values (
    p_organisation_id,v_case.id,coalesce(p_contact_date,current_date),p_channel,
    left(btrim(p_summary),6000),
    left(nullif(btrim(coalesce(p_agreed_action,'')),''),4000),
    p_parent_action_due_date,p_staff_action_due_date,
    left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000),
    p_actor_user_id
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.khpos_ops_reassess_learner_support_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_intervention_id uuid,
  p_outcome text,
  p_evidence_note text,
  p_evidence_reference text,
  p_next_action text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_learner_support_cases%rowtype;
  v_intervention public.khpos_ops_learner_interventions%rowtype;
  v_id uuid;
  v_to text;
begin
  select * into v_case
  from public.khpos_ops_learner_support_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Learner-support case not found.'; end if;

  if v_case.status in ('closed','redirected') then
    raise exception 'Closed or redirected case cannot be reassessed.';
  end if;

  if p_intervention_id is not null then
    select * into v_intervention
    from public.khpos_ops_learner_interventions
    where id=p_intervention_id
      and case_id=v_case.id
      and organisation_id=p_organisation_id;

    if v_intervention.id is null then
      raise exception 'Intervention does not belong to this learner-support case.';
    end if;
  end if;

  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) and (
    v_intervention.id is null
    or not khpos_private.ops_lpi_assignment_owned_by(
      p_actor_user_id,p_organisation_id,v_intervention.owner_assignment_id
    )
  ) then
    raise exception 'Only the intervention owner or learner-support coordinator can reassess this case.';
  end if;

  if p_outcome not in ('recovered','improving','no_improvement','redirect') then
    raise exception 'Unsupported learner reassessment outcome.';
  end if;

  if nullif(btrim(coalesce(p_evidence_note,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Reassessment evidence note and reference are required.';
  end if;

  if p_outcome in ('no_improvement','redirect')
     and nullif(btrim(coalesce(p_next_action,'')),'') is null then
    raise exception 'No-improvement or redirect outcome requires the next action.';
  end if;

  insert into public.khpos_ops_learner_reassessments(
    organisation_id,case_id,intervention_id,outcome,
    evidence_note,evidence_reference,next_action,assessed_by
  ) values (
    p_organisation_id,v_case.id,p_intervention_id,p_outcome,
    left(btrim(p_evidence_note),6000),
    left(btrim(p_evidence_reference),1000),
    left(nullif(btrim(coalesce(p_next_action,'')),''),4000),
    p_actor_user_id
  ) returning id into v_id;

  v_to := case p_outcome
    when 'recovered' then 'recovered'
    when 'improving' then 'intervention_active'
    when 'no_improvement' then 'escalated'
    when 'redirect' then 'redirected'
  end;

  update public.khpos_ops_learner_support_cases
  set status=v_to,
      escalation_note=case
        when p_outcome in ('no_improvement','redirect')
          then left(btrim(p_next_action),4000)
        else escalation_note
      end,
      updated_at=now()
  where id=v_case.id;

  if v_intervention.id is not null and p_outcome in ('recovered','redirect') then
    update public.khpos_ops_learner_interventions
    set status='completed',completed_at=now(),updated_at=now()
    where id=v_intervention.id;
  elsif v_intervention.id is not null and p_outcome='no_improvement' then
    update public.khpos_ops_learner_interventions
    set status='changed',updated_at=now()
    where id=v_intervention.id;
  end if;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,case_id,intervention_id,
    reassessment_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_case.learner_id,v_case.id,p_intervention_id,
    v_id,p_actor_user_id,'learner_reassessed',
    v_case.status,v_to,left(btrim(p_evidence_note),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_escalate_learner_support_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_new_severity text,
  p_new_owner_assignment_id uuid,
  p_escalation_note text,
  p_linked_issue_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_learner_support_cases%rowtype;
begin
  select * into v_case
  from public.khpos_ops_learner_support_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Learner-support case not found.'; end if;

  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only learner-support leadership can escalate a learner case.';
  end if;

  if v_case.status in ('closed','redirected') then
    raise exception 'Closed or redirected learner-support case cannot be escalated.';
  end if;

  if p_new_severity not in ('red','critical') then
    raise exception 'Escalated learner-support case must be red or critical.';
  end if;

  if v_case.severity='critical' and p_new_severity<>'critical' then
    raise exception 'Use reassessment/recovery rather than reducing a critical case through escalation.';
  end if;

  if not khpos_private.ops_lpi_valid_case_owner(
    p_organisation_id,p_new_owner_assignment_id
  ) then
    raise exception 'Escalation owner must be an active Sectional Promoter, Academic Inspector or School Guardian.';
  end if;

  if nullif(btrim(coalesce(p_escalation_note,'')),'') is null then
    raise exception 'Escalation note is required.';
  end if;

  if p_linked_issue_id is not null and not exists(
    select 1 from public.khpos_ops_issues i
    where i.id=p_linked_issue_id and i.organisation_id=p_organisation_id
  ) then
    raise exception 'Linked institutional issue does not belong to this organisation.';
  end if;

  update public.khpos_ops_learner_support_cases
  set severity=p_new_severity,
      case_owner_assignment_id=p_new_owner_assignment_id,
      status='escalated',
      escalation_note=left(btrim(p_escalation_note),6000),
      linked_issue_id=p_linked_issue_id,
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,case_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.learner_id,v_case.id,p_actor_user_id,
    'support_case_escalated',v_case.status,'escalated',
    left(btrim(p_escalation_note),4000),
    jsonb_build_object(
      'fromSeverity',v_case.severity,
      'toSeverity',p_new_severity,
      'linkedIssueId',p_linked_issue_id
    )
  );
end;
$$;

create or replace function public.khpos_ops_close_learner_support_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_closure_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_learner_support_cases%rowtype;
  v_last public.khpos_ops_learner_reassessments%rowtype;
begin
  select * into v_case
  from public.khpos_ops_learner_support_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Learner-support case not found.'; end if;

  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only learner-support leadership can close a structured learner-support case.';
  end if;

  if v_case.severity='critical'
     and not khpos_private.ops_lpi_can_manage(
       p_actor_user_id,p_organisation_id
     ) then
    raise exception 'Critical learner-support cases require Academic Inspector or School Guardian closure.';
  end if;

  if v_case.status='closed' then
    raise exception 'Learner-support case is already closed.';
  end if;

  select * into v_last
  from public.khpos_ops_learner_reassessments r
  where r.case_id=v_case.id
  order by r.assessed_at desc
  limit 1;

  if v_last.id is null or v_last.outcome not in ('recovered','redirect') then
    raise exception 'A learner-support case closes only after evidenced recovery or governed redirection.';
  end if;

  if nullif(btrim(coalesce(p_closure_note,'')),'') is null then
    raise exception 'Closure note is required.';
  end if;

  update public.khpos_ops_learner_support_cases
  set status='closed',
      closure_outcome=case when v_last.outcome='redirect' then 'redirected' else 'recovered' end,
      closure_note=left(btrim(p_closure_note),6000),
      closed_by=p_actor_user_id,
      closed_at=now(),
      updated_at=now()
  where id=v_case.id;

  update public.khpos_ops_learner_risk_signals
  set status='resolved',resolved_by=p_actor_user_id,resolved_at=now(),updated_at=now()
  where linked_case_id=v_case.id and status in ('open','linked');

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,case_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.learner_id,v_case.id,p_actor_user_id,
    'support_case_closed',v_case.status,'closed',
    left(btrim(p_closure_note),4000),
    jsonb_build_object('closureOutcome',v_last.outcome)
  );
end;
$$;

create or replace function public.khpos_ops_create_learner_progression_decision_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_academic_year text,
  p_from_class_label text,
  p_proposed_next_class_label text,
  p_decision text,
  p_attainment_reference text,
  p_foundational_gap_summary text,
  p_trajectory_summary text,
  p_intervention_summary text,
  p_attendance_reference text,
  p_exam_requirement_summary text,
  p_decision_rationale text,
  p_required_support text,
  p_parent_meeting_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
begin
  if not khpos_private.ops_lpi_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the Academic Inspector or School Guardian can propose a formal learner-progression decision.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_learner_anchors l
    where l.id=p_learner_id and l.organisation_id=p_organisation_id
  ) then
    raise exception 'Learner anchor not found.';
  end if;

  if p_decision not in (
    'progress','progress_with_support','retain_reteach',
    'defer_pending_review','external_review_required','graduate_transition'
  ) then
    raise exception 'Unsupported learner-progression decision.';
  end if;

  if nullif(btrim(coalesce(p_academic_year,'')),'') is null
     or nullif(btrim(coalesce(p_from_class_label,'')),'') is null
     or nullif(btrim(coalesce(p_attainment_reference,'')),'') is null
     or nullif(btrim(coalesce(p_trajectory_summary,'')),'') is null
     or nullif(btrim(coalesce(p_decision_rationale,'')),'') is null then
    raise exception 'Progression decision requires academic year, current class, attainment evidence, trajectory and reasoned decision.';
  end if;

  if p_decision in ('retain_reteach','defer_pending_review','external_review_required')
     and nullif(btrim(coalesce(p_parent_meeting_reference,'')),'') is null then
    raise exception 'High-impact progression decision requires the parent meeting/partnership reference.';
  end if;

  insert into public.khpos_ops_learner_progression_decisions(
    organisation_id,learner_id,academic_year,from_class_label,
    proposed_next_class_label,decision,attainment_reference,
    foundational_gap_summary,trajectory_summary,intervention_summary,
    attendance_reference,exam_requirement_summary,decision_rationale,
    required_support,parent_meeting_reference,status,proposed_by
  ) values (
    p_organisation_id,p_learner_id,left(btrim(p_academic_year),40),
    left(btrim(p_from_class_label),120),
    left(nullif(btrim(coalesce(p_proposed_next_class_label,'')),''),120),
    p_decision,left(btrim(p_attainment_reference),1000),
    left(nullif(btrim(coalesce(p_foundational_gap_summary,'')),''),4000),
    left(btrim(p_trajectory_summary),4000),
    left(nullif(btrim(coalesce(p_intervention_summary,'')),''),4000),
    left(nullif(btrim(coalesce(p_attendance_reference,'')),''),1000),
    left(nullif(btrim(coalesce(p_exam_requirement_summary,'')),''),4000),
    left(btrim(p_decision_rationale),6000),
    left(nullif(btrim(coalesce(p_required_support,'')),''),4000),
    left(nullif(btrim(coalesce(p_parent_meeting_reference,'')),''),1000),
    'proposed',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,progression_decision_id,actor_user_id,
    event_type,to_status,note,metadata
  ) values (
    p_organisation_id,p_learner_id,v_id,p_actor_user_id,
    'progression_decision_proposed','proposed',
    left(btrim(p_decision_rationale),4000),
    jsonb_build_object('decision',p_decision,'academicYear',p_academic_year)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_confirm_learner_progression_decision_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_decision_id uuid,
  p_action text,
  p_confirmation_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_decision public.khpos_ops_learner_progression_decisions%rowtype;
  v_requires_guardian boolean;
  v_is_guardian boolean;
  v_to text;
begin
  select * into v_decision
  from public.khpos_ops_learner_progression_decisions
  where id=p_decision_id and organisation_id=p_organisation_id
  for update;

  if v_decision.id is null then raise exception 'Learner-progression decision not found.'; end if;

  if not khpos_private.ops_lpi_can_manage(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the Academic Inspector or School Guardian can confirm/cancel learner progression.';
  end if;

  if v_decision.status<>'proposed' then
    raise exception 'Only a proposed learner-progression decision can be confirmed or cancelled.';
  end if;

  if p_action not in ('confirm','cancel') then
    raise exception 'Progression decision action must be confirm or cancel.';
  end if;

  if nullif(btrim(coalesce(p_confirmation_note,'')),'') is null then
    raise exception 'Progression confirmation/cancellation note is required.';
  end if;

  v_requires_guardian := v_decision.decision in (
    'retain_reteach','defer_pending_review','external_review_required'
  );
  v_is_guardian := khpos_private.ops_lpi_actor_has_role(
    p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN']
  );

  if p_action='confirm' and v_requires_guardian and not v_is_guardian then
    raise exception 'Retain/reteach, deferred or external-review progression decisions require School Guardian confirmation.';
  end if;

  v_to := case when p_action='confirm' then 'confirmed' else 'cancelled' end;

  update public.khpos_ops_learner_progression_decisions
  set status=v_to,
      confirmed_by=p_actor_user_id,
      confirmed_at=now(),
      confirmation_note=left(btrim(p_confirmation_note),6000),
      updated_at=now()
  where id=v_decision.id;

  insert into public.khpos_ops_learner_events(
    organisation_id,learner_id,progression_decision_id,actor_user_id,
    event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_decision.learner_id,v_decision.id,p_actor_user_id,
    'progression_decision_'||p_action,v_decision.status,v_to,
    left(btrim(p_confirmation_note),4000)
  );
end;
$$;

create or replace function public.khpos_ops_upsert_learner_term_review_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_learner_id uuid,
  p_term_id uuid,
  p_overall_status text,
  p_progress_summary text,
  p_open_risks_summary text,
  p_intervention_summary text,
  p_next_term_actions text,
  p_evidence_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_id uuid;
begin
  if not khpos_private.ops_lpi_can_coordinate(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only learner-support leadership can record the term learner review.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_learner_anchors l
    where l.id=p_learner_id and l.organisation_id=p_organisation_id
  ) then
    raise exception 'Learner anchor not found.';
  end if;

  if not exists(
    select 1 from public.khpos_ops_academic_terms t
    where t.id=p_term_id and t.organisation_id=p_organisation_id
  ) then
    raise exception 'Academic term not found.';
  end if;

  if p_overall_status not in ('green','amber','red','critical') then
    raise exception 'Term learner status must be green, amber, red or critical.';
  end if;

  if nullif(btrim(coalesce(p_progress_summary,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_reference,'')),'') is null then
    raise exception 'Term progress summary and evidence reference are required.';
  end if;

  insert into public.khpos_ops_learner_term_reviews(
    organisation_id,learner_id,term_id,overall_status,
    progress_summary,open_risks_summary,intervention_summary,
    next_term_actions,evidence_reference,reviewed_by
  ) values (
    p_organisation_id,p_learner_id,p_term_id,p_overall_status,
    left(btrim(p_progress_summary),6000),
    left(nullif(btrim(coalesce(p_open_risks_summary,'')),''),4000),
    left(nullif(btrim(coalesce(p_intervention_summary,'')),''),4000),
    left(nullif(btrim(coalesce(p_next_term_actions,'')),''),4000),
    left(btrim(p_evidence_reference),1000),
    p_actor_user_id
  )
  on conflict (learner_id,term_id)
  do update set
    overall_status=excluded.overall_status,
    progress_summary=excluded.progress_summary,
    open_risks_summary=excluded.open_risks_summary,
    intervention_summary=excluded.intervention_summary,
    next_term_actions=excluded.next_term_actions,
    evidence_reference=excluded.evidence_reference,
    reviewed_by=excluded.reviewed_by,
    reviewed_at=now(),
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function khpos_private.ops_lpi_has_membership(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_actor_has_role(uuid,uuid,text[])
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_is_executive(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_can_manage(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_can_coordinate(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_can_report(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_assignment_owned_by(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_learner_visible(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_case_visible(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_valid_case_owner(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_lpi_valid_intervention_owner(uuid,uuid)
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_learner_progress_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_upsert_learner_anchor_server(uuid,uuid,text,text,text,text,text,uuid,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_record_learner_baseline_server(uuid,uuid,uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_learner_risk_signal_server(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,timestamptz)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_resolve_learner_risk_signal_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_learner_support_case_server(uuid,uuid,uuid,uuid,uuid,text,text,uuid,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_record_learner_diagnosis_server(uuid,uuid,uuid,text[],text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_learner_intervention_server(uuid,uuid,uuid,integer,text,text,uuid,date,date,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_learner_intervention_activity_server(uuid,uuid,uuid,date,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_record_learner_parent_partnership_server(uuid,uuid,uuid,date,text,text,text,date,date,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_reassess_learner_support_case_server(uuid,uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_escalate_learner_support_case_server(uuid,uuid,uuid,text,uuid,text,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_close_learner_support_case_server(uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_learner_progression_decision_server(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_confirm_learner_progression_decision_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_upsert_learner_term_review_server(uuid,uuid,uuid,uuid,text,text,text,text,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_lpi_has_membership(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_lpi_actor_has_role(uuid,uuid,text[]) to service_role;
grant execute on function khpos_private.ops_lpi_is_executive(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_lpi_can_manage(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_lpi_can_coordinate(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_lpi_can_report(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_lpi_assignment_owned_by(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_lpi_learner_visible(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_lpi_case_visible(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_lpi_valid_case_owner(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_lpi_valid_intervention_owner(uuid,uuid) to service_role;

grant execute on function public.khpos_ops_get_learner_progress_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_upsert_learner_anchor_server(uuid,uuid,text,text,text,text,text,uuid,text) to service_role;
grant execute on function public.khpos_ops_record_learner_baseline_server(uuid,uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_learner_risk_signal_server(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.khpos_ops_resolve_learner_risk_signal_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_learner_support_case_server(uuid,uuid,uuid,uuid,uuid,text,text,uuid,date) to service_role;
grant execute on function public.khpos_ops_record_learner_diagnosis_server(uuid,uuid,uuid,text[],text,text,text,text) to service_role;
grant execute on function public.khpos_ops_create_learner_intervention_server(uuid,uuid,uuid,integer,text,text,uuid,date,date,text) to service_role;
grant execute on function public.khpos_ops_add_learner_intervention_activity_server(uuid,uuid,uuid,date,text,text) to service_role;
grant execute on function public.khpos_ops_record_learner_parent_partnership_server(uuid,uuid,uuid,date,text,text,text,date,date,text) to service_role;
grant execute on function public.khpos_ops_reassess_learner_support_case_server(uuid,uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_escalate_learner_support_case_server(uuid,uuid,uuid,text,uuid,text,uuid) to service_role;
grant execute on function public.khpos_ops_close_learner_support_case_server(uuid,uuid,uuid,text) to service_role;
grant execute on function public.khpos_ops_create_learner_progression_decision_server(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_confirm_learner_progression_decision_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_upsert_learner_term_review_server(uuid,uuid,uuid,uuid,text,text,text,text,text,text) to service_role;
