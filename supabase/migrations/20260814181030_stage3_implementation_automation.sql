create schema if not exists khpos_private;
revoke all on schema khpos_private from public, anon, authenticated;
grant usage on schema khpos_private to service_role;

create table if not exists public.khpos_implementation_plans (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  organisation_intervention_id uuid not null references public.khpos_organisation_interventions(id) on delete restrict,
  plan_version integer not null default 1 check (plan_version > 0),
  generation_version text not null default '1.0',
  source text not null default 'system' check (source in ('system','ai_assisted')),
  objective text not null,
  status text not null default 'active' check (status in ('generated','active','under_review','completed','superseded')),
  generated_at timestamptz not null default now(),
  activated_at timestamptz,
  completed_at timestamptz,
  unique (organisation_intervention_id, plan_version)
);

create unique index if not exists uq_khpos_active_implementation_plan
  on public.khpos_implementation_plans (organisation_intervention_id)
  where status in ('generated','active','under_review');

create index if not exists idx_khpos_implementation_plans_org_status
  on public.khpos_implementation_plans (organisation_id, status, generated_at desc);

create table if not exists public.khpos_implementation_actions (
  id uuid primary key default gen_random_uuid(),
  implementation_plan_id uuid not null references public.khpos_implementation_plans(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  title text not null,
  description text not null,
  owner_id uuid references auth.users(id) on delete set null,
  due_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','blocked','completed','cancelled')),
  evidence_required boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (implementation_plan_id, sequence_no)
);

create index if not exists idx_khpos_actions_plan_status
  on public.khpos_implementation_actions (implementation_plan_id, status, due_date);

create table if not exists public.khpos_milestones (
  id uuid primary key default gen_random_uuid(),
  implementation_plan_id uuid not null references public.khpos_implementation_plans(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  title text not null,
  success_signal text not null,
  target_date date,
  status text not null default 'pending' check (status in ('pending','achieved','missed','cancelled')),
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (implementation_plan_id, sequence_no)
);

create index if not exists idx_khpos_milestones_plan_status
  on public.khpos_milestones (implementation_plan_id, status, target_date);

create table if not exists public.khpos_evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  implementation_plan_id uuid not null references public.khpos_implementation_plans(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  title text not null,
  description text not null,
  evidence_type text not null,
  due_date date,
  required boolean not null default true,
  status text not null default 'required' check (status in ('required','submitted','accepted','needs_clarification','rejected','superseded')),
  created_at timestamptz not null default now(),
  unique (implementation_plan_id, sequence_no)
);

create index if not exists idx_khpos_evidence_requirements_plan_status
  on public.khpos_evidence_requirements (implementation_plan_id, status, due_date);

create table if not exists public.khpos_review_schedules (
  id uuid primary key default gen_random_uuid(),
  implementation_plan_id uuid not null references public.khpos_implementation_plans(id) on delete cascade,
  review_type text not null check (review_type in ('midpoint','outcome')),
  scheduled_for date not null,
  status text not null default 'pending' check (status in ('pending','due','completed','cancelled')),
  decision text check (decision is null or decision in ('continue','adjust','escalate','complete','pause','stop')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (implementation_plan_id, review_type)
);

create index if not exists idx_khpos_review_schedule_due
  on public.khpos_review_schedules (status, scheduled_for);

alter table public.khpos_implementation_plans enable row level security;
alter table public.khpos_implementation_actions enable row level security;
alter table public.khpos_milestones enable row level security;
alter table public.khpos_evidence_requirements enable row level security;
alter table public.khpos_review_schedules enable row level security;

revoke all privileges on table public.khpos_implementation_plans from public, anon, authenticated;
revoke all privileges on table public.khpos_implementation_actions from public, anon, authenticated;
revoke all privileges on table public.khpos_milestones from public, anon, authenticated;
revoke all privileges on table public.khpos_evidence_requirements from public, anon, authenticated;
revoke all privileges on table public.khpos_review_schedules from public, anon, authenticated;

grant select, insert, update, delete on table public.khpos_implementation_plans to service_role;
grant select, insert, update, delete on table public.khpos_implementation_actions to service_role;
grant select, insert, update, delete on table public.khpos_milestones to service_role;
grant select, insert, update, delete on table public.khpos_evidence_requirements to service_role;
grant select, insert, update, delete on table public.khpos_review_schedules to service_role;

create or replace function khpos_private.generate_implementation_plan(
  p_organisation_intervention_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, khpos_private, auth, pg_temp
as $$
declare
  v_oi public.khpos_organisation_interventions%rowtype;
  v_priority public.khpos_priorities%rowtype;
  v_version public.khpos_intervention_versions%rowtype;
  v_existing_plan_id uuid;
  v_plan_id uuid;
  v_plan_version integer;
  v_start date;
  v_target date;
  v_duration integer;
  v_midpoint date;
  v_actor uuid;
begin
  select * into v_oi
  from public.khpos_organisation_interventions
  where id = p_organisation_intervention_id;

  if v_oi.id is null then
    raise exception 'Organisation intervention not found.';
  end if;

  if v_oi.status not in ('planned','active') then
    return null;
  end if;

  select id into v_existing_plan_id
  from public.khpos_implementation_plans
  where organisation_intervention_id = v_oi.id
    and status in ('generated','active','under_review')
  order by plan_version desc
  limit 1;

  if v_existing_plan_id is not null then
    return v_existing_plan_id;
  end if;

  select * into v_priority
  from public.khpos_priorities
  where id = v_oi.priority_id;

  select * into v_version
  from public.khpos_intervention_versions
  where id = v_oi.intervention_version_id;

  if v_priority.id is null or v_version.id is null then
    raise exception 'Priority and intervention version are required to generate implementation.';
  end if;

  select coalesce(max(plan_version), 0) + 1 into v_plan_version
  from public.khpos_implementation_plans
  where organisation_intervention_id = v_oi.id;

  v_start := coalesce(v_oi.start_date, current_date);
  v_target := coalesce(
    v_oi.target_date,
    v_start + coalesce(v_version.recommended_duration_days, 60)
  );
  v_duration := greatest(7, v_target - v_start);
  v_midpoint := v_start + greatest(3, round(v_duration * 0.5)::integer);
  v_actor := coalesce(v_oi.approved_by, v_oi.created_by, v_oi.owner_id);

  insert into public.khpos_implementation_plans (
    organisation_id,
    organisation_intervention_id,
    plan_version,
    generation_version,
    source,
    objective,
    status,
    generated_at,
    activated_at
  ) values (
    v_oi.organisation_id,
    v_oi.id,
    v_plan_version,
    '1.0',
    'system',
    v_version.expected_outcome,
    'active',
    now(),
    now()
  )
  returning id into v_plan_id;

  insert into public.khpos_implementation_actions (
    implementation_plan_id, sequence_no, title, description, owner_id, due_date, evidence_required
  ) values
    (v_plan_id, 1,
      'Confirm the baseline and minimum standard for ' || v_oi.title,
      'KHP-OS converts the approved priority into an operating standard. Confirm the present condition, the minimum acceptable standard and the people affected before implementation begins.',
      v_oi.owner_id, v_start + greatest(1, round(v_duration * 0.10)::integer), true),
    (v_plan_id, 2,
      'Put ' || v_oi.title || ' into operation',
      'Activate the required policy, routine, tool or practice. KHP-OS has already selected this intervention from the approved library; the institution executes it in the real environment.',
      v_oi.owner_id, v_start + greatest(2, round(v_duration * 0.25)::integer), true),
    (v_plan_id, 3,
      'Run the first implementation cycle',
      'Operate the intervention long enough to observe real behaviour. Coach the responsible people, reinforce the standard and record obstacles rather than redesigning the intervention informally.',
      v_oi.owner_id, v_start + greatest(3, round(v_duration * 0.45)::integer), true),
    (v_plan_id, 4,
      'Correct implementation gaps and remove blockers',
      'Use the midpoint evidence to identify non-adoption, inconsistency or resource barriers. Correct execution while preserving the approved outcome and evidence standard.',
      v_oi.owner_id, v_start + greatest(4, round(v_duration * 0.65)::integer), true),
    (v_plan_id, 5,
      'Submit the required implementation evidence',
      'Provide the documents, records, observations or outputs required by the intervention review criteria. Evidence should demonstrate implementation, not merely activity.',
      v_oi.owner_id, v_start + greatest(5, round(v_duration * 0.82)::integer), true),
    (v_plan_id, 6,
      'Complete the outcome review against the linked KSHC condition',
      'Review whether the institutional condition behind the approved priority has improved, remained unchanged or regressed. The result will determine continue, adjust, escalate or complete.',
      v_oi.owner_id, v_target, true);

  insert into public.khpos_milestones (
    implementation_plan_id, sequence_no, title, success_signal, target_date
  ) values
    (v_plan_id, 1, 'Standard ready',
      'The minimum operating standard, responsible owner and implementation mechanism are clear and usable.',
      v_start + greatest(2, round(v_duration * 0.20)::integer)),
    (v_plan_id, 2, 'First operating cycle completed',
      'The intervention has moved from plan to repeated real-world use and initial implementation evidence exists.',
      v_start + greatest(3, round(v_duration * 0.50)::integer)),
    (v_plan_id, 3, 'Evidence checkpoint reached',
      'Required evidence is available to test implementation quality and identify remaining gaps.',
      v_start + greatest(4, round(v_duration * 0.80)::integer)),
    (v_plan_id, 4, 'Outcome review ready',
      'The institution has sufficient implementation and outcome evidence to judge whether the linked KSHC condition improved.',
      v_target);

  insert into public.khpos_evidence_requirements (
    implementation_plan_id, sequence_no, title, description, evidence_type, due_date
  )
  select
    v_plan_id,
    e.ordinality::integer,
    case e.ordinality
      when 1 then 'Operating standard / policy / routine'
      when 2 then 'Ownership and accountability record'
      when 3 then 'Implementation record'
      else 'Outcome / review evidence'
    end,
    e.criterion,
    case e.ordinality
      when 1 then 'standard_or_policy'
      when 2 then 'ownership_record'
      when 3 then 'implementation_record'
      else 'outcome_measurement'
    end,
    case when e.ordinality < 4 then v_start + greatest(4, round(v_duration * 0.82)::integer) else v_target end
  from jsonb_array_elements_text(v_version.review_criteria) with ordinality as e(criterion, ordinality);

  if not exists (
    select 1 from public.khpos_evidence_requirements where implementation_plan_id = v_plan_id
  ) then
    insert into public.khpos_evidence_requirements (
      implementation_plan_id, sequence_no, title, description, evidence_type, due_date
    ) values
      (v_plan_id, 1, 'Implementation evidence', 'Evidence that the approved intervention is operating in practice.', 'implementation_record', v_start + greatest(4, round(v_duration * 0.82)::integer)),
      (v_plan_id, 2, 'Outcome evidence', 'Evidence that the linked KSHC condition has improved or requires adjustment.', 'outcome_measurement', v_target);
  end if;

  insert into public.khpos_review_schedules (
    implementation_plan_id, review_type, scheduled_for, status
  ) values
    (v_plan_id, 'midpoint', v_midpoint, 'pending'),
    (v_plan_id, 'outcome', v_target, 'pending');

  insert into public.khpos_audit_events (
    organisation_id, actor_user_id, event_type, object_type, object_id, metadata
  ) values (
    v_oi.organisation_id,
    v_actor,
    'implementation_plan_generated',
    'implementation_plan',
    v_plan_id,
    jsonb_build_object(
      'organisationInterventionId', v_oi.id,
      'priorityId', v_oi.priority_id,
      'planVersion', v_plan_version,
      'generationVersion', '1.0',
      'actionCount', 6,
      'milestoneCount', 4,
      'reviewCount', 2,
      'targetDate', v_target
    )
  );

  return v_plan_id;
end;
$$;

create or replace function khpos_private.sync_implementation_plan()
returns trigger
language plpgsql
security invoker
set search_path = public, khpos_private, auth, pg_temp
as $$
begin
  if new.status in ('planned','active') then
    perform khpos_private.generate_implementation_plan(new.id);
  elsif new.status = 'abandoned' then
    update public.khpos_implementation_plans
    set status = 'superseded'
    where organisation_intervention_id = new.id
      and status in ('generated','active','under_review');

    update public.khpos_implementation_actions
    set status = 'cancelled'
    where implementation_plan_id in (
      select id from public.khpos_implementation_plans
      where organisation_intervention_id = new.id and status = 'superseded'
    ) and status <> 'completed';

    update public.khpos_milestones
    set status = 'cancelled'
    where implementation_plan_id in (
      select id from public.khpos_implementation_plans
      where organisation_intervention_id = new.id and status = 'superseded'
    ) and status <> 'achieved';

    update public.khpos_review_schedules
    set status = 'cancelled'
    where implementation_plan_id in (
      select id from public.khpos_implementation_plans
      where organisation_intervention_id = new.id and status = 'superseded'
    ) and status <> 'completed';

    update public.khpos_evidence_requirements
    set status = 'superseded'
    where implementation_plan_id in (
      select id from public.khpos_implementation_plans
      where organisation_intervention_id = new.id and status = 'superseded'
    ) and status not in ('accepted','superseded');
  elsif new.status = 'completed' then
    update public.khpos_implementation_plans
    set status = 'completed', completed_at = coalesce(completed_at, now())
    where organisation_intervention_id = new.id
      and status in ('generated','active','under_review');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_khpos_sync_implementation_plan on public.khpos_organisation_interventions;
create trigger trg_khpos_sync_implementation_plan
after insert or update of status, intervention_version_id, target_date, owner_id
on public.khpos_organisation_interventions
for each row execute function khpos_private.sync_implementation_plan();

revoke all on function khpos_private.generate_implementation_plan(uuid) from public, anon, authenticated;
revoke all on function khpos_private.sync_implementation_plan() from public, anon, authenticated;
grant execute on function khpos_private.generate_implementation_plan(uuid) to service_role;

comment on table public.khpos_implementation_plans is
  'System-generated execution plans created automatically from human-approved KHP-OS interventions.';
comment on table public.khpos_implementation_actions is
  'Automatically generated transformation actions. Humans execute them; they do not manually design the action list.';
comment on table public.khpos_milestones is
  'Automatically scheduled intervention milestones used to coordinate institutional transformation.';
comment on table public.khpos_evidence_requirements is
  'Evidence requirements generated from intervention review criteria. Evidence submission is handled in the next operating layer.';
comment on table public.khpos_review_schedules is
  'System-generated midpoint and outcome review schedule for each implementation plan.';

do $$
declare
  r record;
begin
  for r in
    select id from public.khpos_organisation_interventions
    where status in ('planned','active')
  loop
    perform khpos_private.generate_implementation_plan(r.id);
  end loop;
end $$;
