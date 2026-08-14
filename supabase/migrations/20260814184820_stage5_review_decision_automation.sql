alter table public.khpos_implementation_plans
  drop constraint if exists khpos_implementation_plans_status_check;
alter table public.khpos_implementation_plans
  add constraint khpos_implementation_plans_status_check
  check (status in ('generated','active','under_review','paused','completed','superseded'));

alter table public.khpos_organisation_interventions
  drop constraint if exists khpos_organisation_interventions_status_check;
alter table public.khpos_organisation_interventions
  add constraint khpos_organisation_interventions_status_check
  check (status in ('proposed','approved','planned','active','under_review','paused','completed','adjusted','escalated','abandoned'));

create table if not exists public.khpos_transformation_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  review_schedule_id uuid not null unique references public.khpos_review_schedules(id) on delete cascade,
  implementation_plan_id uuid not null references public.khpos_implementation_plans(id) on delete cascade,
  organisation_intervention_id uuid not null references public.khpos_organisation_interventions(id) on delete restrict,
  review_type text not null check (review_type in ('midpoint','outcome')),
  scheduled_for date not null,
  status text not null default 'awaiting_decision' check (status in ('awaiting_decision','decided','superseded')),
  action_count integer not null default 0 check (action_count >= 0),
  completed_action_count integer not null default 0 check (completed_action_count >= 0),
  blocked_action_count integer not null default 0 check (blocked_action_count >= 0),
  overdue_action_count integer not null default 0 check (overdue_action_count >= 0),
  milestone_count integer not null default 0 check (milestone_count >= 0),
  achieved_milestone_count integer not null default 0 check (achieved_milestone_count >= 0),
  overdue_milestone_count integer not null default 0 check (overdue_milestone_count >= 0),
  evidence_required_count integer not null default 0 check (evidence_required_count >= 0),
  evidence_accepted_count integer not null default 0 check (evidence_accepted_count >= 0),
  evidence_clarification_count integer not null default 0 check (evidence_clarification_count >= 0),
  evidence_rejected_count integer not null default 0 check (evidence_rejected_count >= 0),
  evidence_coverage_percent numeric(5,2) not null default 0 check (evidence_coverage_percent between 0 and 100),
  evidence_summary text not null default 'No sufficient evidence has been accepted yet.',
  evidence_gaps jsonb not null default '[]'::jsonb,
  plan_vs_actual text not null,
  progress_summary text not null,
  lessons jsonb not null default '[]'::jsonb,
  recommended_decision text not null check (recommended_decision in ('continue','adjust','escalate','complete','pause','stop')),
  recommendation_reason text not null,
  recommendation_confidence numeric(5,2) not null check (recommendation_confidence between 0 and 100),
  recommendation_rules_version text not null default '1.0',
  operating_directive text not null,
  narrative_provider text not null default 'system',
  narrative_model text,
  narrative_prompt_version text not null default '1.0',
  narrative_generated_at timestamptz,
  approved_decision text check (approved_decision is null or approved_decision in ('continue','adjust','escalate','complete','pause','stop')),
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  next_step text,
  next_implementation_plan_id uuid references public.khpos_implementation_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.khpos_implementation_plans
  add column if not exists cycle_mode text not null default 'standard';
alter table public.khpos_implementation_plans
  add column if not exists source_review_id uuid references public.khpos_transformation_reviews(id) on delete set null;
alter table public.khpos_implementation_plans
  add column if not exists operating_directive text;

alter table public.khpos_implementation_plans
  drop constraint if exists khpos_implementation_plans_cycle_mode_check;
alter table public.khpos_implementation_plans
  add constraint khpos_implementation_plans_cycle_mode_check
  check (cycle_mode in ('standard','continued','adjusted'));

create index if not exists idx_khpos_reviews_org_status
  on public.khpos_transformation_reviews (organisation_id, status, scheduled_for desc);
create index if not exists idx_khpos_reviews_plan
  on public.khpos_transformation_reviews (implementation_plan_id, created_at desc);
create index if not exists idx_khpos_plans_source_review
  on public.khpos_implementation_plans (source_review_id)
  where source_review_id is not null;

alter table public.khpos_transformation_reviews enable row level security;
revoke all privileges on table public.khpos_transformation_reviews from public, anon, authenticated;
grant select, insert, update, delete on table public.khpos_transformation_reviews to service_role;

create or replace function khpos_private.prepare_review_snapshot(p_review_schedule_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, khpos_private, auth, pg_temp
as $$
declare
  v_schedule public.khpos_review_schedules%rowtype;
  v_plan public.khpos_implementation_plans%rowtype;
  v_intervention public.khpos_organisation_interventions%rowtype;
  v_priority public.khpos_priorities%rowtype;
  v_prep public.khpos_review_preparations%rowtype;
  v_review_id uuid;
  v_actions integer := 0;
  v_actions_completed integer := 0;
  v_actions_blocked integer := 0;
  v_actions_overdue integer := 0;
  v_milestones integer := 0;
  v_milestones_achieved integer := 0;
  v_milestones_overdue integer := 0;
  v_required integer := 0;
  v_accepted integer := 0;
  v_clarification integer := 0;
  v_rejected integer := 0;
  v_coverage numeric(5,2) := 0;
  v_summary text;
  v_gaps jsonb := '[]'::jsonb;
  v_lessons jsonb := '[]'::jsonb;
  v_recommended text;
  v_reason text;
  v_confidence numeric(5,2);
  v_directive text;
  v_plan_actual text;
  v_progress text;
begin
  select * into v_schedule
  from public.khpos_review_schedules
  where id=p_review_schedule_id;

  if v_schedule.id is null or v_schedule.status='cancelled' then
    return null;
  end if;

  select * into v_plan
  from public.khpos_implementation_plans
  where id=v_schedule.implementation_plan_id;

  if v_plan.id is null then
    return null;
  end if;

  select * into v_intervention
  from public.khpos_organisation_interventions
  where id=v_plan.organisation_intervention_id;

  select * into v_priority
  from public.khpos_priorities
  where id=v_intervention.priority_id;

  select * into v_prep
  from public.khpos_review_preparations
  where review_schedule_id=v_schedule.id;

  if v_schedule.status='completed' then
    select id into v_review_id
    from public.khpos_transformation_reviews
    where review_schedule_id=v_schedule.id;
    return v_review_id;
  end if;

  if v_schedule.status <> 'due'
     and v_schedule.scheduled_for > current_date
     and coalesce(v_prep.readiness,'not_ready') <> 'ready' then
    return null;
  end if;

  update public.khpos_review_schedules
  set status='due'
  where id=v_schedule.id and status='pending';

  select
    count(*),
    count(*) filter (where status='completed'),
    count(*) filter (where status='blocked'),
    count(*) filter (where due_date < current_date and status not in ('completed','cancelled'))
  into v_actions, v_actions_completed, v_actions_blocked, v_actions_overdue
  from public.khpos_implementation_actions
  where implementation_plan_id=v_plan.id;

  select
    count(*),
    count(*) filter (where status='achieved'),
    count(*) filter (where target_date < current_date and status not in ('achieved','cancelled'))
  into v_milestones, v_milestones_achieved, v_milestones_overdue
  from public.khpos_milestones
  where implementation_plan_id=v_plan.id;

  select
    count(*) filter (where required and status <> 'superseded'),
    count(*) filter (where required and status='accepted'),
    count(*) filter (where required and status='needs_clarification')
  into v_required, v_accepted, v_clarification
  from public.khpos_evidence_requirements
  where implementation_plan_id=v_plan.id;

  select count(*) into v_rejected
  from public.khpos_evidence_submissions
  where implementation_plan_id=v_plan.id and status='rejected';

  v_required := coalesce(v_required,0);
  v_accepted := coalesce(v_accepted,0);
  v_coverage := case
    when v_prep.id is not null then coalesce(v_prep.coverage_percent,0)
    when v_required=0 then 0
    else round((v_accepted::numeric / v_required::numeric) * 100,2)
  end;
  v_summary := coalesce(v_prep.evidence_summary,'No sufficient evidence has been accepted yet.');
  v_gaps := coalesce(v_prep.evidence_gaps,'[]'::jsonb);

  if v_coverage = 100 then
    v_lessons := v_lessons || jsonb_build_array('All required evidence has been accepted for this implementation cycle; verified improvement still requires reassessment.');
  elsif v_coverage > 0 then
    v_lessons := v_lessons || jsonb_build_array('Implementation evidence is accumulating, but the remaining evidence gaps still limit the strength of the institutional claim.');
  else
    v_lessons := v_lessons || jsonb_build_array('The institution has not yet supplied sufficient accepted evidence to support an implementation-progress claim.');
  end if;
  if v_clarification > 0 then
    v_lessons := v_lessons || jsonb_build_array('Some submitted evidence remains ambiguous and must be clarified before it can count toward progress.');
  end if;
  if v_actions_blocked > 0 then
    v_lessons := v_lessons || jsonb_build_array('Blocked actions are limiting execution and require leadership attention rather than additional reporting activity.');
  end if;
  if v_actions_overdue > 0 or v_milestones_overdue > 0 then
    v_lessons := v_lessons || jsonb_build_array('The implementation cadence has slipped against the system-generated timeline and should be corrected explicitly.');
  end if;

  if v_schedule.review_type='midpoint' then
    if v_coverage >= 75 and v_actions_blocked=0 and v_actions_overdue <= 1 then
      v_recommended := 'continue';
      v_confidence := 90;
      v_reason := 'Midpoint evidence coverage is strong enough to continue the approved intervention without changing its core operating design.';
      v_directive := 'Continue the current implementation cycle. Preserve the practices already supported by accepted evidence and close the remaining evidence gaps before the outcome review.';
    elsif v_coverage >= 25 then
      v_recommended := 'adjust';
      v_confidence := 85;
      v_reason := 'Some implementation is visible, but evidence gaps, blockers or timing variance indicate that execution needs correction before the outcome review.';
      v_directive := 'Keep the approved intervention active, but correct the review-identified execution and evidence gaps before the next review. Do not change the intended institutional outcome.';
    else
      v_recommended := 'escalate';
      v_confidence := 88;
      v_reason := 'Midpoint progress is too weak to justify passive continuation; leadership attention is required to remove the constraint or reconsider execution.';
      v_directive := 'Escalate this implementation cycle to the Transformation Lead or Executive. Resolve the blocking condition before further routine execution is treated as progress.';
    end if;
  else
    if v_required > 0 and v_accepted=v_required and v_coverage=100 and v_actions_blocked=0 and (v_milestones=0 or v_milestones_achieved=v_milestones) then
      v_recommended := 'complete';
      v_confidence := 95;
      v_reason := 'The implementation cycle has full accepted evidence coverage and no unresolved execution blocker. The next valid claim is reassessment, not automatic resolution.';
      v_directive := 'Close this implementation cycle and move to reassessment. Keep the underlying priority active until a new KSHC assessment verifies that the institutional condition actually improved.';
    elsif v_coverage >= 75 then
      v_recommended := 'adjust';
      v_confidence := 88;
      v_reason := 'Most required evidence exists, but the cycle still contains gaps or incomplete execution that make completion premature.';
      v_directive := 'Start an adjusted implementation cycle focused on the remaining review gaps while preserving the approved intervention outcome and accepted gains.';
    elsif v_coverage >= 50 and v_actions_blocked=0 then
      v_recommended := 'continue';
      v_confidence := 82;
      v_reason := 'The intervention shows material implementation progress but does not yet have enough evidence to close the cycle.';
      v_directive := 'Begin another implementation cycle using the same intervention, preserve accepted evidence practices and close the outstanding evidence requirements.';
    elsif v_coverage >= 35 then
      v_recommended := 'adjust';
      v_confidence := 84;
      v_reason := 'The cycle has partial traction but is not strong enough to repeat unchanged; the next cycle should directly address the identified gaps.';
      v_directive := 'Begin a corrected implementation cycle that targets the review gaps and blocked or overdue execution points before seeking completion.';
    else
      v_recommended := 'escalate';
      v_confidence := 90;
      v_reason := 'The outcome review has insufficient verified implementation progress to justify another routine cycle without executive intervention.';
      v_directive := 'Escalate the unresolved priority to executive transformation review. Do not treat repeated activity as progress until the blocking condition is resolved.';
    end if;
  end if;

  v_plan_actual := format(
    '%s of %s generated actions are complete; %s are blocked and %s are overdue. %s of %s milestones are achieved.',
    v_actions_completed, v_actions, v_actions_blocked, v_actions_overdue,
    v_milestones_achieved, v_milestones
  );
  v_progress := format(
    'Accepted evidence covers %s%% of required items (%s of %s). %s item(s) require clarification and %s submitted evidence item(s) were rejected.',
    trim(to_char(v_coverage,'FM990D00')), v_accepted, v_required, v_clarification, v_rejected
  );

  insert into public.khpos_transformation_reviews (
    organisation_id, review_schedule_id, implementation_plan_id, organisation_intervention_id,
    review_type, scheduled_for, status,
    action_count, completed_action_count, blocked_action_count, overdue_action_count,
    milestone_count, achieved_milestone_count, overdue_milestone_count,
    evidence_required_count, evidence_accepted_count, evidence_clarification_count,
    evidence_rejected_count, evidence_coverage_percent, evidence_summary, evidence_gaps,
    plan_vs_actual, progress_summary, lessons,
    recommended_decision, recommendation_reason, recommendation_confidence,
    recommendation_rules_version, operating_directive,
    narrative_provider, narrative_prompt_version, created_at, updated_at
  ) values (
    v_plan.organisation_id, v_schedule.id, v_plan.id, v_intervention.id,
    v_schedule.review_type, v_schedule.scheduled_for, 'awaiting_decision',
    v_actions, v_actions_completed, v_actions_blocked, v_actions_overdue,
    v_milestones, v_milestones_achieved, v_milestones_overdue,
    v_required, v_accepted, v_clarification,
    v_rejected, v_coverage, v_summary, v_gaps,
    v_plan_actual, v_progress, v_lessons,
    v_recommended, v_reason, v_confidence,
    '1.0', v_directive,
    'system', '1.0', now(), now()
  )
  on conflict (review_schedule_id) do update set
    action_count=excluded.action_count,
    completed_action_count=excluded.completed_action_count,
    blocked_action_count=excluded.blocked_action_count,
    overdue_action_count=excluded.overdue_action_count,
    milestone_count=excluded.milestone_count,
    achieved_milestone_count=excluded.achieved_milestone_count,
    overdue_milestone_count=excluded.overdue_milestone_count,
    evidence_required_count=excluded.evidence_required_count,
    evidence_accepted_count=excluded.evidence_accepted_count,
    evidence_clarification_count=excluded.evidence_clarification_count,
    evidence_rejected_count=excluded.evidence_rejected_count,
    evidence_coverage_percent=excluded.evidence_coverage_percent,
    evidence_summary=excluded.evidence_summary,
    evidence_gaps=excluded.evidence_gaps,
    plan_vs_actual=excluded.plan_vs_actual,
    progress_summary=excluded.progress_summary,
    lessons=excluded.lessons,
    recommended_decision=excluded.recommended_decision,
    recommendation_reason=excluded.recommendation_reason,
    recommendation_confidence=excluded.recommendation_confidence,
    recommendation_rules_version=excluded.recommendation_rules_version,
    operating_directive=excluded.operating_directive,
    narrative_provider='system',
    narrative_model=null,
    narrative_generated_at=null,
    updated_at=now()
  where public.khpos_transformation_reviews.status <> 'decided'
  returning id into v_review_id;

  if v_review_id is null then
    select id into v_review_id
    from public.khpos_transformation_reviews
    where review_schedule_id=v_schedule.id;
  end if;

  return v_review_id;
end;
$$;

create or replace function khpos_private.sync_review_preparation()
returns trigger
language plpgsql
security invoker
set search_path = public, khpos_private, auth, pg_temp
as $$
begin
  perform khpos_private.prepare_review_snapshot(new.review_schedule_id);
  return new;
end;
$$;

drop trigger if exists trg_khpos_prepare_transformation_review on public.khpos_review_preparations;
create trigger trg_khpos_prepare_transformation_review
after insert or update of readiness, coverage_percent, accepted_count, evidence_summary, evidence_gaps
on public.khpos_review_preparations
for each row execute function khpos_private.sync_review_preparation();

create or replace function public.khpos_prepare_reviews_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, khpos_private, auth, pg_temp
as $$
declare
  v_role text;
  v_schedule record;
  v_review_id uuid;
  v_prepared integer := 0;
begin
  select role into v_role
  from public.organisation_memberships
  where organisation_id=p_organisation_id
    and user_id=p_actor_user_id
    and status='active'
  limit 1;

  if v_role is null then
    raise exception 'Active organisation membership is required.';
  end if;

  update public.khpos_review_schedules r
  set status='due'
  where r.status='pending'
    and r.scheduled_for <= current_date
    and exists (
      select 1
      from public.khpos_implementation_plans p
      where p.id=r.implementation_plan_id and p.organisation_id=p_organisation_id
    );

  for v_schedule in
    select r.id
    from public.khpos_review_schedules r
    join public.khpos_implementation_plans p on p.id=r.implementation_plan_id
    left join public.khpos_review_preparations rp on rp.review_schedule_id=r.id
    where p.organisation_id=p_organisation_id
      and r.status not in ('completed','cancelled')
      and (r.status='due' or coalesce(rp.readiness,'not_ready')='ready')
  loop
    v_review_id := khpos_private.prepare_review_snapshot(v_schedule.id);
    if v_review_id is not null then
      v_prepared := v_prepared + 1;
    end if;
  end loop;

  return jsonb_build_object('preparedCount',v_prepared);
end;
$$;

create or replace function public.khpos_apply_review_decision_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_review_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, khpos_private, auth, pg_temp
as $$
declare
  v_role text;
  v_review public.khpos_transformation_reviews%rowtype;
  v_plan public.khpos_implementation_plans%rowtype;
  v_intervention public.khpos_organisation_interventions%rowtype;
  v_duration integer := 60;
  v_next_plan_id uuid;
  v_next_step text;
  v_note text := nullif(trim(coalesce(p_note,'')),'');
begin
  select role into v_role
  from public.organisation_memberships
  where organisation_id=p_organisation_id
    and user_id=p_actor_user_id
    and status='active'
  limit 1;

  if v_role not in ('executive','transformation_lead') then
    raise exception 'Executive or Transformation Lead approval is required.';
  end if;

  if p_decision not in ('continue','adjust','escalate','complete','pause','stop') then
    raise exception 'Invalid review decision.';
  end if;

  select * into v_review
  from public.khpos_transformation_reviews
  where id=p_review_id
    and organisation_id=p_organisation_id
  for update;

  if v_review.id is null then
    raise exception 'Transformation review not found.';
  end if;
  if v_review.status='decided' then
    raise exception 'This transformation review has already been decided.';
  end if;
  if p_decision <> v_review.recommended_decision and length(coalesce(v_note,'')) < 12 then
    raise exception 'A short reason is required when overriding the KHP-OS recommendation.';
  end if;
  if p_decision in ('pause','stop') and length(coalesce(v_note,'')) < 12 then
    raise exception 'A short reason is required to pause or stop an intervention.';
  end if;
  if p_decision='complete' and (
    v_review.review_type <> 'outcome'
    or v_review.evidence_required_count=0
    or v_review.evidence_accepted_count <> v_review.evidence_required_count
    or v_review.evidence_coverage_percent <> 100
  ) then
    raise exception 'Completion requires a fully evidenced outcome review. Reassessment will still be required afterward.';
  end if;

  select * into v_plan
  from public.khpos_implementation_plans
  where id=v_review.implementation_plan_id
  for update;

  select * into v_intervention
  from public.khpos_organisation_interventions
  where id=v_review.organisation_intervention_id
  for update;

  select coalesce(iv.recommended_duration_days,60) into v_duration
  from public.khpos_intervention_versions iv
  where iv.id=v_intervention.intervention_version_id;

  update public.khpos_review_schedules
  set status='completed', decision=p_decision, completed_at=coalesce(completed_at,now())
  where id=v_review.review_schedule_id;

  if v_review.review_type='outcome' then
    update public.khpos_implementation_actions
    set status='completed', completed_at=coalesce(completed_at,now())
    where implementation_plan_id=v_plan.id and sequence_no=6 and status <> 'cancelled';
  end if;

  if p_decision='continue' and v_review.review_type='midpoint' then
    update public.khpos_implementation_plans
    set status='active', operating_directive=v_review.operating_directive
    where id=v_plan.id and status in ('under_review','active','generated');
    update public.khpos_organisation_interventions
    set status='active', updated_at=now()
    where id=v_intervention.id;
    update public.khpos_priorities
    set status='active', updated_at=now()
    where id=v_intervention.priority_id;
    v_next_step := 'continue_current_cycle';

  elsif p_decision='adjust' and v_review.review_type='midpoint' then
    update public.khpos_implementation_plans
    set status='active', operating_directive=v_review.operating_directive
    where id=v_plan.id and status in ('under_review','active','generated');
    update public.khpos_organisation_interventions
    set status='active', updated_at=now()
    where id=v_intervention.id;
    update public.khpos_priorities
    set status='active', updated_at=now()
    where id=v_intervention.priority_id;
    v_next_step := 'adjust_current_cycle';

  elsif p_decision in ('continue','adjust') and v_review.review_type='outcome' then
    update public.khpos_implementation_plans
    set status='superseded', completed_at=coalesce(completed_at,now())
    where id=v_plan.id;

    update public.khpos_implementation_actions
    set status='cancelled'
    where implementation_plan_id=v_plan.id and status not in ('completed','cancelled');
    update public.khpos_milestones
    set status='cancelled'
    where implementation_plan_id=v_plan.id and status not in ('achieved','cancelled');
    update public.khpos_evidence_requirements
    set status='superseded'
    where implementation_plan_id=v_plan.id and status not in ('accepted','superseded');
    update public.khpos_review_schedules
    set status='cancelled'
    where implementation_plan_id=v_plan.id
      and id<>v_review.review_schedule_id
      and status not in ('completed','cancelled');

    update public.khpos_organisation_interventions
    set status='active', start_date=current_date,
        target_date=current_date + greatest(7,coalesce(v_duration,60)), updated_at=now()
    where id=v_intervention.id;

    select id into v_next_plan_id
    from public.khpos_implementation_plans
    where organisation_intervention_id=v_intervention.id
      and id<>v_plan.id
      and status in ('generated','active','under_review')
    order by plan_version desc
    limit 1;

    if v_next_plan_id is null then
      v_next_plan_id := khpos_private.generate_implementation_plan(v_intervention.id);
    end if;

    update public.khpos_implementation_plans
    set cycle_mode=case when p_decision='adjust' then 'adjusted' else 'continued' end,
        source_review_id=v_review.id,
        operating_directive=v_review.operating_directive
    where id=v_next_plan_id;

    update public.khpos_priorities
    set status='active', updated_at=now()
    where id=v_intervention.priority_id;

    v_next_step := case when p_decision='adjust' then 'adjusted_cycle_started' else 'continuation_cycle_started' end;

  elsif p_decision='escalate' then
    update public.khpos_implementation_plans
    set status='superseded', completed_at=coalesce(completed_at,now()), operating_directive=v_review.operating_directive
    where id=v_plan.id;
    update public.khpos_implementation_actions
    set status='cancelled'
    where implementation_plan_id=v_plan.id and status not in ('completed','cancelled');
    update public.khpos_milestones
    set status='cancelled'
    where implementation_plan_id=v_plan.id and status not in ('achieved','cancelled');
    update public.khpos_review_schedules
    set status='cancelled'
    where implementation_plan_id=v_plan.id
      and id<>v_review.review_schedule_id
      and status not in ('completed','cancelled');
    update public.khpos_evidence_requirements
    set status='superseded'
    where implementation_plan_id=v_plan.id and status not in ('accepted','superseded');
    update public.khpos_organisation_interventions
    set status='escalated', updated_at=now()
    where id=v_intervention.id;
    update public.khpos_priorities
    set status='under_review', updated_at=now()
    where id=v_intervention.priority_id;
    v_next_step := 'executive_escalation';

  elsif p_decision='pause' then
    update public.khpos_implementation_plans
    set status='paused', operating_directive=v_review.operating_directive
    where id=v_plan.id;
    update public.khpos_review_schedules
    set status='cancelled'
    where implementation_plan_id=v_plan.id
      and id<>v_review.review_schedule_id
      and status not in ('completed','cancelled');
    update public.khpos_organisation_interventions
    set status='paused', updated_at=now()
    where id=v_intervention.id;
    update public.khpos_priorities
    set status='active', updated_at=now()
    where id=v_intervention.priority_id;
    v_next_step := 'implementation_paused';

  elsif p_decision='stop' then
    update public.khpos_organisation_interventions
    set status='abandoned', updated_at=now()
    where id=v_intervention.id;
    update public.khpos_priorities
    set status='under_review', updated_at=now()
    where id=v_intervention.priority_id;
    v_next_step := 'intervention_stopped_reprioritise';

  elsif p_decision='complete' then
    update public.khpos_organisation_interventions
    set status='completed', updated_at=now()
    where id=v_intervention.id;
    update public.khpos_priorities
    set status='active', updated_at=now()
    where id=v_intervention.priority_id;
    v_next_step := 'reassessment_required';
  end if;

  update public.khpos_transformation_reviews
  set status='decided',
      approved_decision=p_decision,
      decision_note=v_note,
      decided_by=p_actor_user_id,
      decided_at=now(),
      next_step=v_next_step,
      next_implementation_plan_id=v_next_plan_id,
      updated_at=now()
  where id=v_review.id;

  insert into public.khpos_audit_events (
    organisation_id, actor_user_id, event_type, object_type, object_id, metadata
  ) values (
    p_organisation_id,
    p_actor_user_id,
    'transformation_review_decided',
    'transformation_review',
    v_review.id,
    jsonb_build_object(
      'implementationPlanId',v_plan.id,
      'organisationInterventionId',v_intervention.id,
      'reviewType',v_review.review_type,
      'recommendedDecision',v_review.recommended_decision,
      'approvedDecision',p_decision,
      'override',p_decision <> v_review.recommended_decision,
      'nextStep',v_next_step,
      'nextImplementationPlanId',v_next_plan_id,
      'evidenceCoveragePercent',v_review.evidence_coverage_percent,
      'recommendationRulesVersion',v_review.recommendation_rules_version
    )
  );

  return jsonb_build_object(
    'reviewId',v_review.id,
    'approvedDecision',p_decision,
    'nextStep',v_next_step,
    'nextImplementationPlanId',v_next_plan_id
  );
end;
$$;

revoke all on function khpos_private.prepare_review_snapshot(uuid) from public, anon, authenticated;
revoke all on function khpos_private.sync_review_preparation() from public, anon, authenticated;
revoke all on function public.khpos_prepare_reviews_server(uuid,uuid) from public, anon, authenticated;
revoke all on function public.khpos_apply_review_decision_server(uuid,uuid,uuid,text,text) from public, anon, authenticated;

grant execute on function khpos_private.prepare_review_snapshot(uuid) to service_role;
grant execute on function public.khpos_prepare_reviews_server(uuid,uuid) to service_role;
grant execute on function public.khpos_apply_review_decision_server(uuid,uuid,uuid,text,text) to service_role;

comment on table public.khpos_transformation_reviews is
  'System-prepared transformation reviews. Deterministic evidence/progress metrics produce a recommendation; humans retain final decision authority.';
comment on function public.khpos_apply_review_decision_server(uuid,uuid,uuid,text,text) is
  'Server-only governed review decision. Executive/Transformation Lead approval applies the next lifecycle state transactionally while preserving unresolved priorities until reassessment.';

-- Backfill any review that is already due or evidence-ready.
do $$
declare
  r record;
begin
  for r in
    select rs.id
    from public.khpos_review_schedules rs
    left join public.khpos_review_preparations rp on rp.review_schedule_id=rs.id
    where rs.status not in ('completed','cancelled')
      and (rs.scheduled_for <= current_date or coalesce(rp.readiness,'not_ready')='ready')
  loop
    perform khpos_private.prepare_review_snapshot(r.id);
  end loop;
end $$;
