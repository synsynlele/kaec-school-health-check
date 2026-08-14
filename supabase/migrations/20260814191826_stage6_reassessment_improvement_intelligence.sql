alter table public.assessments
  add column if not exists assessment_kind text not null default 'baseline',
  add column if not exists baseline_assessment_id uuid references public.assessments(id) on delete set null,
  add column if not exists previous_assessment_id uuid references public.assessments(id) on delete set null,
  add column if not exists reassessment_sequence integer,
  add column if not exists initiated_by uuid references auth.users(id) on delete set null;

alter table public.assessments
  drop constraint if exists assessments_assessment_kind_check;
alter table public.assessments
  add constraint assessments_assessment_kind_check
  check (assessment_kind in ('baseline','reassessment'));

create index if not exists idx_assessments_org_kind_completed
  on public.assessments (organisation_id, assessment_kind, completed_at desc)
  where organisation_id is not null;
create index if not exists idx_assessments_baseline
  on public.assessments (baseline_assessment_id)
  where baseline_assessment_id is not null;

create table if not exists public.khpos_indicator_system_mappings (
  indicator_id text not null,
  system_id text not null check (system_id in (
    'identity_direction','learning_mastery','capability_development',
    'value_creation_application','human_development_ecosystem',
    'institutional_excellence','intelligence_continuous_improvement'
  )),
  mapping_role text not null check (mapping_role in ('primary','secondary')),
  weight numeric(3,2) not null check (weight > 0 and weight <= 1),
  foundation_version text not null default '1.0',
  created_at timestamptz not null default now(),
  primary key (indicator_id, system_id, mapping_role)
);

insert into public.khpos_indicator_system_mappings (
  indicator_id, system_id, mapping_role, weight, foundation_version
)
select iim.indicator_id, i.primary_system_id, 'primary', 1.00, '1.0'
from public.khpos_indicator_intervention_map iim
join public.khpos_interventions i on i.id=iim.intervention_id
on conflict (indicator_id, system_id, mapping_role) do update set
  weight=excluded.weight,
  foundation_version=excluded.foundation_version;

with secondary(indicator_id,system_id) as (
  values
    ('leadership_1','intelligence_continuous_improvement'),
    ('leadership_2','learning_mastery'),
    ('leadership_3','institutional_excellence'),
    ('leadership_4','human_development_ecosystem'),
    ('leadership_5','institutional_excellence'),
    ('teaching_1','institutional_excellence'),
    ('teaching_2','capability_development'),
    ('teaching_3','intelligence_continuous_improvement'),
    ('teaching_4','learning_mastery'),
    ('teaching_5','human_development_ecosystem'),
    ('student_dev_1','learning_mastery'),
    ('student_dev_2','value_creation_application'),
    ('student_dev_3','institutional_excellence'),
    ('student_dev_4','human_development_ecosystem'),
    ('student_dev_5','human_development_ecosystem'),
    ('finance_1','intelligence_continuous_improvement'),
    ('finance_2','intelligence_continuous_improvement'),
    ('finance_3','intelligence_continuous_improvement'),
    ('finance_4','intelligence_continuous_improvement'),
    ('finance_5','intelligence_continuous_improvement'),
    ('infrastructure_1','learning_mastery'),
    ('infrastructure_2','institutional_excellence'),
    ('infrastructure_3','human_development_ecosystem'),
    ('infrastructure_4','human_development_ecosystem'),
    ('infrastructure_5','intelligence_continuous_improvement'),
    ('parents_1','institutional_excellence'),
    ('parents_2','institutional_excellence'),
    ('parents_3','value_creation_application'),
    ('parents_4','human_development_ecosystem'),
    ('parents_5','intelligence_continuous_improvement'),
    ('technology_1','institutional_excellence'),
    ('technology_2','learning_mastery'),
    ('technology_3','learning_mastery'),
    ('technology_4','human_development_ecosystem'),
    ('technology_5','intelligence_continuous_improvement'),
    ('governance_1','intelligence_continuous_improvement'),
    ('governance_2','intelligence_continuous_improvement'),
    ('governance_3','human_development_ecosystem'),
    ('governance_4','human_development_ecosystem'),
    ('governance_5','intelligence_continuous_improvement'),
    ('culture_1','institutional_excellence'),
    ('culture_2','institutional_excellence'),
    ('culture_3','learning_mastery'),
    ('culture_4','capability_development'),
    ('culture_5','institutional_excellence'),
    ('safety_1','institutional_excellence'),
    ('safety_2','human_development_ecosystem'),
    ('safety_3','human_development_ecosystem'),
    ('safety_4','institutional_excellence'),
    ('safety_5','institutional_excellence'),
    ('innovation_1','institutional_excellence'),
    ('innovation_2','intelligence_continuous_improvement'),
    ('innovation_3','intelligence_continuous_improvement'),
    ('innovation_4','institutional_excellence'),
    ('innovation_5','intelligence_continuous_improvement')
)
insert into public.khpos_indicator_system_mappings (
  indicator_id, system_id, mapping_role, weight, foundation_version
)
select indicator_id,system_id,'secondary',0.50,'1.0'
from secondary
on conflict (indicator_id, system_id, mapping_role) do update set
  weight=excluded.weight,
  foundation_version=excluded.foundation_version;

create table if not exists public.khpos_reassessments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  baseline_assessment_id uuid not null references public.assessments(id) on delete restrict,
  previous_assessment_id uuid not null references public.assessments(id) on delete restrict,
  reassessment_assessment_id uuid not null unique references public.assessments(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  status text not null default 'in_progress' check (status in ('in_progress','complete','invalid')),
  baseline_overall_score numeric(5,2),
  previous_overall_score numeric(5,2),
  reassessment_overall_score numeric(5,2),
  delta_from_baseline numeric(6,2),
  delta_from_previous numeric(6,2),
  improved_indicator_count integer not null default 0 check (improved_indicator_count >= 0),
  stable_indicator_count integer not null default 0 check (stable_indicator_count >= 0),
  regressed_indicator_count integer not null default 0 check (regressed_indicator_count >= 0),
  improvement_classification text check (improvement_classification is null or improvement_classification in ('strong_improvement','improved','mixed','stable','regressed')),
  verified_improvement boolean not null default false,
  rules_version text not null default '1.0',
  initiated_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organisation_id, sequence_no)
);

create table if not exists public.khpos_indicator_changes (
  id uuid primary key default gen_random_uuid(),
  reassessment_id uuid not null references public.khpos_reassessments(id) on delete cascade,
  indicator_id text not null,
  chapter text,
  baseline_score smallint not null check (baseline_score between 1 and 5),
  previous_score smallint not null check (previous_score between 1 and 5),
  reassessment_score smallint not null check (reassessment_score between 1 and 5),
  delta_from_baseline smallint not null,
  delta_from_previous smallint not null,
  change_classification text not null check (change_classification in ('improved','stable','regressed')),
  created_at timestamptz not null default now(),
  unique (reassessment_id, indicator_id)
);

create table if not exists public.khpos_area_changes (
  id uuid primary key default gen_random_uuid(),
  reassessment_id uuid not null references public.khpos_reassessments(id) on delete cascade,
  chapter text not null,
  baseline_score numeric(5,2) not null,
  previous_score numeric(5,2) not null,
  reassessment_score numeric(5,2) not null,
  delta_from_baseline numeric(6,2) not null,
  delta_from_previous numeric(6,2) not null,
  change_classification text not null check (change_classification in ('improved','stable','regressed')),
  created_at timestamptz not null default now(),
  unique (reassessment_id, chapter)
);

create table if not exists public.khpos_system_changes (
  id uuid primary key default gen_random_uuid(),
  reassessment_id uuid not null references public.khpos_reassessments(id) on delete cascade,
  system_id text not null check (system_id in (
    'identity_direction','learning_mastery','capability_development',
    'value_creation_application','human_development_ecosystem',
    'institutional_excellence','intelligence_continuous_improvement'
  )),
  baseline_score numeric(5,2) not null,
  previous_score numeric(5,2) not null,
  reassessment_score numeric(5,2) not null,
  delta_from_baseline numeric(6,2) not null,
  delta_from_previous numeric(6,2) not null,
  change_classification text not null check (change_classification in ('improved','stable','regressed')),
  created_at timestamptz not null default now(),
  unique (reassessment_id, system_id)
);

create table if not exists public.khpos_priority_reassessment_outcomes (
  id uuid primary key default gen_random_uuid(),
  reassessment_id uuid not null references public.khpos_reassessments(id) on delete cascade,
  priority_id uuid not null references public.khpos_priorities(id) on delete cascade,
  source_indicator_id text not null,
  source_score smallint not null check (source_score between 1 and 5),
  reassessment_score smallint not null check (reassessment_score between 1 and 5),
  score_delta smallint not null,
  outcome text not null check (outcome in ('resolved','improving','unchanged','regressed')),
  next_state text not null,
  created_at timestamptz not null default now(),
  unique (reassessment_id, priority_id)
);

create index if not exists idx_khpos_reassessments_org_completed
  on public.khpos_reassessments (organisation_id, completed_at desc);
create index if not exists idx_khpos_indicator_changes_reassessment
  on public.khpos_indicator_changes (reassessment_id, change_classification);
create index if not exists idx_khpos_area_changes_reassessment
  on public.khpos_area_changes (reassessment_id);
create index if not exists idx_khpos_system_changes_reassessment
  on public.khpos_system_changes (reassessment_id);
create index if not exists idx_khpos_priority_outcomes_reassessment
  on public.khpos_priority_reassessment_outcomes (reassessment_id, outcome);

alter table public.khpos_indicator_system_mappings enable row level security;
alter table public.khpos_reassessments enable row level security;
alter table public.khpos_indicator_changes enable row level security;
alter table public.khpos_area_changes enable row level security;
alter table public.khpos_system_changes enable row level security;
alter table public.khpos_priority_reassessment_outcomes enable row level security;

revoke all privileges on table public.khpos_indicator_system_mappings from public, anon, authenticated;
revoke all privileges on table public.khpos_reassessments from public, anon, authenticated;
revoke all privileges on table public.khpos_indicator_changes from public, anon, authenticated;
revoke all privileges on table public.khpos_area_changes from public, anon, authenticated;
revoke all privileges on table public.khpos_system_changes from public, anon, authenticated;
revoke all privileges on table public.khpos_priority_reassessment_outcomes from public, anon, authenticated;

grant select, insert, update, delete on table public.khpos_indicator_system_mappings to service_role;
grant select, insert, update, delete on table public.khpos_reassessments to service_role;
grant select, insert, update, delete on table public.khpos_indicator_changes to service_role;
grant select, insert, update, delete on table public.khpos_area_changes to service_role;
grant select, insert, update, delete on table public.khpos_system_changes to service_role;
grant select, insert, update, delete on table public.khpos_priority_reassessment_outcomes to service_role;

create or replace function public.khpos_start_reassessment_server(
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
  v_baseline public.assessments%rowtype;
  v_previous public.assessments%rowtype;
  v_existing public.assessments%rowtype;
  v_assessment_id uuid;
  v_sequence integer;
  v_school_id text;
begin
  select role into v_role
  from public.organisation_memberships
  where organisation_id=p_organisation_id
    and user_id=p_actor_user_id
    and status='active'
  limit 1;

  if v_role not in ('executive','transformation_lead') then
    raise exception 'Executive or Transformation Lead approval is required to start reassessment.';
  end if;

  select * into v_existing
  from public.assessments
  where organisation_id=p_organisation_id
    and assessment_kind='reassessment'
    and status='in_progress'
  order by created_at desc
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'assessmentId',v_existing.id,
      'resumed',true,
      'sequence',v_existing.reassessment_sequence
    );
  end if;

  select * into v_baseline
  from public.assessments
  where organisation_id=p_organisation_id
    and status='completed'
  order by completed_at asc nulls last, created_at asc
  limit 1;

  if v_baseline.id is null then
    raise exception 'A completed KSHC baseline is required before reassessment.';
  end if;

  select * into v_previous
  from public.assessments
  where organisation_id=p_organisation_id
    and status='completed'
  order by completed_at desc nulls last, created_at desc
  limit 1;

  select coalesce(max(reassessment_sequence),0)+1 into v_sequence
  from public.assessments
  where organisation_id=p_organisation_id
    and assessment_kind='reassessment';

  v_school_id := coalesce(
    v_previous.school_id,
    (select source_school_snapshot_id::text from public.organisations where id=p_organisation_id)
  );

  if v_school_id is null then
    raise exception 'The school snapshot required for reassessment could not be found.';
  end if;

  insert into public.assessments (
    school_id, organisation_id, framework_id, framework_version, scoring_version,
    status, assessment_kind, baseline_assessment_id, previous_assessment_id,
    reassessment_sequence, initiated_by, created_at
  ) values (
    v_school_id, p_organisation_id, v_previous.framework_id,
    v_previous.framework_version, v_previous.scoring_version,
    'in_progress','reassessment',v_baseline.id,v_previous.id,
    v_sequence,p_actor_user_id,now()
  ) returning id into v_assessment_id;

  insert into public.khpos_reassessments (
    organisation_id, baseline_assessment_id, previous_assessment_id,
    reassessment_assessment_id, sequence_no, status, initiated_by
  ) values (
    p_organisation_id,v_baseline.id,v_previous.id,
    v_assessment_id,v_sequence,'in_progress',p_actor_user_id
  );

  insert into public.khpos_audit_events (
    organisation_id, actor_user_id, event_type, object_type, object_id, metadata
  ) values (
    p_organisation_id,p_actor_user_id,'reassessment_started','assessment',v_assessment_id,
    jsonb_build_object(
      'baselineAssessmentId',v_baseline.id,
      'previousAssessmentId',v_previous.id,
      'sequence',v_sequence,
      'frameworkVersion',v_previous.framework_version,
      'scoringVersion',v_previous.scoring_version
    )
  );

  return jsonb_build_object(
    'assessmentId',v_assessment_id,
    'resumed',false,
    'sequence',v_sequence,
    'baselineAssessmentId',v_baseline.id,
    'previousAssessmentId',v_previous.id
  );
end;
$$;

create or replace function khpos_private.analyze_reassessment(p_assessment_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, khpos_private, auth, pg_temp
as $$
declare
  v_assessment public.assessments%rowtype;
  v_reassessment_id uuid;
  v_baseline_overall numeric(5,2);
  v_previous_overall numeric(5,2);
  v_current_overall numeric(5,2);
  v_delta_baseline numeric(6,2);
  v_delta_previous numeric(6,2);
  v_improved integer;
  v_stable integer;
  v_regressed integer;
  v_classification text;
  v_verified boolean;
  v_count integer;
begin
  select * into v_assessment
  from public.assessments
  where id=p_assessment_id
    and assessment_kind='reassessment'
    and status='completed';

  if v_assessment.id is null then
    return null;
  end if;

  select count(*) into v_count
  from public.answers
  where assessment_id=v_assessment.id and score between 1 and 5;
  if v_count <> 55 then
    update public.khpos_reassessments
    set status='invalid', completed_at=now()
    where reassessment_assessment_id=v_assessment.id;
    return null;
  end if;

  select count(*) into v_count
  from public.answers
  where assessment_id=v_assessment.baseline_assessment_id and score between 1 and 5;
  if v_count <> 55 then
    update public.khpos_reassessments
    set status='invalid', completed_at=now()
    where reassessment_assessment_id=v_assessment.id;
    return null;
  end if;

  select round(avg(score::numeric)*20,2) into v_baseline_overall
  from public.answers where assessment_id=v_assessment.baseline_assessment_id;
  select round(avg(score::numeric)*20,2) into v_previous_overall
  from public.answers where assessment_id=v_assessment.previous_assessment_id;
  select round(avg(score::numeric)*20,2) into v_current_overall
  from public.answers where assessment_id=v_assessment.id;

  v_delta_baseline := round(v_current_overall-v_baseline_overall,2);
  v_delta_previous := round(v_current_overall-v_previous_overall,2);

  select
    count(*) filter (where c.score > b.score),
    count(*) filter (where c.score = b.score),
    count(*) filter (where c.score < b.score)
  into v_improved,v_stable,v_regressed
  from public.answers b
  join public.answers c on c.question_id=b.question_id
  where b.assessment_id=v_assessment.baseline_assessment_id
    and c.assessment_id=v_assessment.id;

  v_verified := v_delta_baseline >= 5 and v_improved > v_regressed;
  v_classification := case
    when v_delta_baseline >= 10 and v_improved >= greatest(1,v_regressed*2) then 'strong_improvement'
    when v_verified then 'improved'
    when v_delta_baseline <= -5 or v_regressed > v_improved then 'regressed'
    when abs(v_delta_baseline) < 2 and v_improved=v_regressed then 'stable'
    else 'mixed'
  end;

  insert into public.khpos_reassessments (
    organisation_id, baseline_assessment_id, previous_assessment_id,
    reassessment_assessment_id, sequence_no, status,
    baseline_overall_score, previous_overall_score, reassessment_overall_score,
    delta_from_baseline, delta_from_previous,
    improved_indicator_count, stable_indicator_count, regressed_indicator_count,
    improvement_classification, verified_improvement, rules_version,
    initiated_by, completed_at
  ) values (
    v_assessment.organisation_id,v_assessment.baseline_assessment_id,v_assessment.previous_assessment_id,
    v_assessment.id,v_assessment.reassessment_sequence,'complete',
    v_baseline_overall,v_previous_overall,v_current_overall,
    v_delta_baseline,v_delta_previous,
    v_improved,v_stable,v_regressed,
    v_classification,v_verified,'1.0',v_assessment.initiated_by,now()
  )
  on conflict (reassessment_assessment_id) do update set
    status='complete',
    baseline_overall_score=excluded.baseline_overall_score,
    previous_overall_score=excluded.previous_overall_score,
    reassessment_overall_score=excluded.reassessment_overall_score,
    delta_from_baseline=excluded.delta_from_baseline,
    delta_from_previous=excluded.delta_from_previous,
    improved_indicator_count=excluded.improved_indicator_count,
    stable_indicator_count=excluded.stable_indicator_count,
    regressed_indicator_count=excluded.regressed_indicator_count,
    improvement_classification=excluded.improvement_classification,
    verified_improvement=excluded.verified_improvement,
    completed_at=excluded.completed_at
  returning id into v_reassessment_id;

  delete from public.khpos_indicator_changes where reassessment_id=v_reassessment_id;
  insert into public.khpos_indicator_changes (
    reassessment_id,indicator_id,chapter,
    baseline_score,previous_score,reassessment_score,
    delta_from_baseline,delta_from_previous,change_classification
  )
  select
    v_reassessment_id,
    c.question_id,
    coalesce(c.chapter,b.chapter,p.chapter),
    b.score::smallint,
    p.score::smallint,
    c.score::smallint,
    (c.score-b.score)::smallint,
    (c.score-p.score)::smallint,
    case when c.score>b.score then 'improved' when c.score<b.score then 'regressed' else 'stable' end
  from public.answers b
  join public.answers c on c.question_id=b.question_id and c.assessment_id=v_assessment.id
  join public.answers p on p.question_id=b.question_id and p.assessment_id=v_assessment.previous_assessment_id
  where b.assessment_id=v_assessment.baseline_assessment_id;

  delete from public.khpos_area_changes where reassessment_id=v_reassessment_id;
  insert into public.khpos_area_changes (
    reassessment_id,chapter,baseline_score,previous_score,reassessment_score,
    delta_from_baseline,delta_from_previous,change_classification
  )
  with scores as (
    select
      coalesce(c.chapter,b.chapter,p.chapter) chapter,
      avg(b.score::numeric)*20 baseline_score,
      avg(p.score::numeric)*20 previous_score,
      avg(c.score::numeric)*20 reassessment_score
    from public.answers b
    join public.answers c on c.question_id=b.question_id and c.assessment_id=v_assessment.id
    join public.answers p on p.question_id=b.question_id and p.assessment_id=v_assessment.previous_assessment_id
    where b.assessment_id=v_assessment.baseline_assessment_id
    group by coalesce(c.chapter,b.chapter,p.chapter)
  )
  select
    v_reassessment_id,chapter,
    round(baseline_score,2),round(previous_score,2),round(reassessment_score,2),
    round(reassessment_score-baseline_score,2),round(reassessment_score-previous_score,2),
    case
      when reassessment_score-baseline_score >= 5 then 'improved'
      when reassessment_score-baseline_score <= -5 then 'regressed'
      else 'stable'
    end
  from scores;

  delete from public.khpos_system_changes where reassessment_id=v_reassessment_id;
  insert into public.khpos_system_changes (
    reassessment_id,system_id,baseline_score,previous_score,reassessment_score,
    delta_from_baseline,delta_from_previous,change_classification
  )
  with joined as (
    select
      m.system_id,m.weight,b.score baseline_score,p.score previous_score,c.score current_score
    from public.khpos_indicator_system_mappings m
    join public.answers b on b.question_id=m.indicator_id and b.assessment_id=v_assessment.baseline_assessment_id
    join public.answers p on p.question_id=m.indicator_id and p.assessment_id=v_assessment.previous_assessment_id
    join public.answers c on c.question_id=m.indicator_id and c.assessment_id=v_assessment.id
  ), scores as (
    select
      system_id,
      sum(baseline_score*20*weight)/sum(weight) baseline_score,
      sum(previous_score*20*weight)/sum(weight) previous_score,
      sum(current_score*20*weight)/sum(weight) current_score
    from joined group by system_id
  )
  select
    v_reassessment_id,system_id,
    round(baseline_score,2),round(previous_score,2),round(current_score,2),
    round(current_score-baseline_score,2),round(current_score-previous_score,2),
    case
      when current_score-baseline_score >= 5 then 'improved'
      when current_score-baseline_score <= -5 then 'regressed'
      else 'stable'
    end
  from scores;

  delete from public.khpos_priority_reassessment_outcomes where reassessment_id=v_reassessment_id;
  insert into public.khpos_priority_reassessment_outcomes (
    reassessment_id,priority_id,source_indicator_id,source_score,
    reassessment_score,score_delta,outcome,next_state
  )
  select
    v_reassessment_id,
    pr.id,
    pr.source_indicator_id,
    src.score::smallint,
    cur.score::smallint,
    (cur.score-src.score)::smallint,
    case
      when cur.score >= 4 and cur.score > src.score then 'resolved'
      when cur.score > src.score then 'improving'
      when cur.score < src.score then 'regressed'
      else 'unchanged'
    end,
    case
      when cur.score >= 4 and cur.score > src.score then 'priority_resolved'
      when cur.score < src.score then 'executive_review_required'
      else 'continue_transformation'
    end
  from public.khpos_priorities pr
  join public.answers src on src.assessment_id=pr.source_assessment_id and src.question_id=pr.source_indicator_id
  join public.answers cur on cur.assessment_id=v_assessment.id and cur.question_id=pr.source_indicator_id
  where pr.organisation_id=v_assessment.organisation_id
    and pr.status in ('approved','active','under_review');

  update public.khpos_priorities pr
  set status=case o.outcome
      when 'resolved' then 'resolved'
      when 'regressed' then 'under_review'
      else 'active'
    end,
    updated_at=now()
  from public.khpos_priority_reassessment_outcomes o
  where o.reassessment_id=v_reassessment_id and o.priority_id=pr.id;

  update public.khpos_organisation_interventions oi
  set status=case o.outcome
      when 'resolved' then 'completed'
      when 'regressed' then 'escalated'
      else case when oi.status='completed' then 'active' else oi.status end
    end,
    start_date=case when o.outcome in ('improving','unchanged') and oi.status='completed' then current_date else oi.start_date end,
    target_date=case when o.outcome in ('improving','unchanged') and oi.status='completed' then current_date + 60 else oi.target_date end,
    updated_at=now()
  from public.khpos_priority_reassessment_outcomes o
  where o.reassessment_id=v_reassessment_id and o.priority_id=oi.priority_id;

  insert into public.khpos_audit_events (
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    v_assessment.organisation_id,v_assessment.initiated_by,
    'reassessment_analyzed','reassessment',v_reassessment_id,
    jsonb_build_object(
      'assessmentId',v_assessment.id,
      'baselineAssessmentId',v_assessment.baseline_assessment_id,
      'previousAssessmentId',v_assessment.previous_assessment_id,
      'sequence',v_assessment.reassessment_sequence,
      'baselineOverall',v_baseline_overall,
      'reassessmentOverall',v_current_overall,
      'deltaFromBaseline',v_delta_baseline,
      'classification',v_classification,
      'verifiedImprovement',v_verified,
      'improvedIndicators',v_improved,
      'stableIndicators',v_stable,
      'regressedIndicators',v_regressed,
      'rulesVersion','1.0'
    )
  );

  return v_reassessment_id;
end;
$$;

create or replace function khpos_private.sync_reassessment_analysis()
returns trigger
language plpgsql
security invoker
set search_path = public, khpos_private, auth, pg_temp
as $$
begin
  if new.assessment_kind='reassessment'
     and new.status='completed'
     and (old.status is distinct from new.status or old.completed_at is distinct from new.completed_at) then
    perform khpos_private.analyze_reassessment(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_khpos_analyze_reassessment on public.assessments;
create trigger trg_khpos_analyze_reassessment
after update of status,completed_at on public.assessments
for each row execute function khpos_private.sync_reassessment_analysis();

create or replace function public.khpos_refresh_reassessment_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_assessment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, khpos_private, auth, pg_temp
as $$
declare
  v_role text;
  v_reassessment_id uuid;
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

  if not exists (
    select 1 from public.assessments
    where id=p_assessment_id and organisation_id=p_organisation_id and assessment_kind='reassessment'
  ) then
    raise exception 'Reassessment not found.';
  end if;

  v_reassessment_id := khpos_private.analyze_reassessment(p_assessment_id);
  return jsonb_build_object('reassessmentId',v_reassessment_id);
end;
$$;

revoke all on function public.khpos_start_reassessment_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_refresh_reassessment_server(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function khpos_private.analyze_reassessment(uuid) from public,anon,authenticated;
revoke all on function khpos_private.sync_reassessment_analysis() from public,anon,authenticated;

grant execute on function public.khpos_start_reassessment_server(uuid,uuid) to service_role;
grant execute on function public.khpos_refresh_reassessment_server(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.analyze_reassessment(uuid) to service_role;

comment on table public.khpos_reassessments is
  'Versioned KHP-OS reassessment comparisons. Verified improvement is determined from fresh KSHC evidence, not implementation completion.';
comment on function public.khpos_start_reassessment_server(uuid,uuid) is
  'Server-only creation/resume of a KSHC reassessment linked to the organisation baseline and previous completed assessment.';
comment on function khpos_private.analyze_reassessment(uuid) is
  'Deterministically compares a completed KSHC reassessment against baseline/previous results, computes 55-indicator, 11-area and 7-system change, and updates priority outcomes.';
