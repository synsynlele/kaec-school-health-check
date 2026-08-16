alter table public.khpos_organisation_interventions
  add column if not exists intelligence_summary text,
  add column if not exists problem_interpretation text,
  add column if not exists why_now text,
  add column if not exists risks_and_guardrails jsonb not null default '[]'::jsonb,
  add column if not exists intelligence_source text not null default 'system',
  add column if not exists intelligence_model text,
  add column if not exists intelligence_version text not null default '1.0',
  add column if not exists intelligence_generated_at timestamptz,
  add column if not exists intelligence_attempted_at timestamptz,
  add column if not exists intelligence_error text;

alter table public.khpos_organisation_interventions
  drop constraint if exists khpos_organisation_interventions_intelligence_source_check;
alter table public.khpos_organisation_interventions
  add constraint khpos_organisation_interventions_intelligence_source_check
  check (intelligence_source in ('system','openai','fallback'));

alter table public.khpos_implementation_plans
  add column if not exists model text,
  add column if not exists intelligence_generated_at timestamptz;

create table if not exists public.khpos_transformation_contexts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  baseline_assessment_id uuid not null references public.assessments(id) on delete cascade,
  context_version integer not null default 1 check (context_version > 0),
  context_summary text not null,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  source text not null default 'system' check (source in ('system','openai')),
  model text,
  generation_version text not null default '2.0',
  generated_at timestamptz not null default now(),
  unique (organisation_id, baseline_assessment_id, context_version)
);

create index if not exists idx_khpos_transformation_contexts_org
  on public.khpos_transformation_contexts (organisation_id, generated_at desc);

create table if not exists public.khpos_outcome_contracts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  organisation_intervention_id uuid not null references public.khpos_organisation_interventions(id) on delete cascade,
  contract_version integer not null default 1 check (contract_version > 0),
  status text not null default 'active' check (status in ('active','superseded')),
  baseline_condition text not null,
  desired_condition text not null,
  leading_indicators jsonb not null default '[]'::jsonb,
  outcome_indicators jsonb not null default '[]'::jsonb,
  success_threshold text not null,
  evidence_standard jsonb not null default '[]'::jsonb,
  review_date date not null,
  source text not null default 'system' check (source in ('system','openai')),
  model text,
  generation_version text not null default '2.0',
  generated_at timestamptz not null default now(),
  unique (organisation_intervention_id, contract_version)
);

create unique index if not exists uq_khpos_active_outcome_contract
  on public.khpos_outcome_contracts (organisation_intervention_id)
  where status='active';
create index if not exists idx_khpos_outcome_contracts_org
  on public.khpos_outcome_contracts (organisation_id, status, generated_at desc);

alter table public.khpos_transformation_reviews
  add column if not exists outcome_contract_id uuid references public.khpos_outcome_contracts(id) on delete set null,
  add column if not exists what_changed text,
  add column if not exists what_not_changed text,
  add column if not exists execution_assessment text,
  add column if not exists adaptation_advice text,
  add column if not exists missing_evidence jsonb not null default '[]'::jsonb,
  add column if not exists narrative_attempted_at timestamptz,
  add column if not exists narrative_error text;

alter table public.khpos_transformation_contexts enable row level security;
alter table public.khpos_outcome_contracts enable row level security;
revoke all privileges on table public.khpos_transformation_contexts from public, anon, authenticated;
revoke all privileges on table public.khpos_outcome_contracts from public, anon, authenticated;
grant select, insert, update, delete on table public.khpos_transformation_contexts to service_role;
grant select, insert, update, delete on table public.khpos_outcome_contracts to service_role;

create or replace function public.khpos_apply_intervention_intelligence_v2_server(
  p_organisation_intervention_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_oi public.khpos_organisation_interventions%rowtype;
  v_priority public.khpos_priorities%rowtype;
  v_plan public.khpos_implementation_plans%rowtype;
  v_plan_id uuid;
  v_contract_id uuid;
  v_context_id uuid;
  v_plan_version integer;
  v_contract_version integer;
  v_start date;
  v_target date;
  v_duration integer;
  v_midpoint date;
  v_action_count integer;
  v_milestone_count integer;
  v_actor uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'A validated intelligence payload is required.';
  end if;

  select * into v_oi
  from public.khpos_organisation_interventions
  where id=p_organisation_intervention_id
  for update;

  if v_oi.id is null then
    raise exception 'Organisation intervention not found.';
  end if;

  if v_oi.status not in ('planned','active') then
    return jsonb_build_object('upgraded',false,'reason','intervention_not_active');
  end if;

  select * into v_priority
  from public.khpos_priorities
  where id=v_oi.priority_id;

  if v_priority.id is null then
    raise exception 'Priority context is missing.';
  end if;

  select * into v_plan
  from public.khpos_implementation_plans
  where organisation_intervention_id=v_oi.id
    and status in ('generated','active','under_review')
  order by plan_version desc
  limit 1
  for update;

  if v_plan.id is null then
    return jsonb_build_object('upgraded',false,'reason','active_plan_missing');
  end if;

  if v_plan.source <> 'system' then
    return jsonb_build_object('upgraded',false,'reason','already_intelligent');
  end if;

  if exists (
    select 1 from public.khpos_implementation_actions
    where implementation_plan_id=v_plan.id and status <> 'not_started'
  ) or exists (
    select 1 from public.khpos_evidence_submissions
    where implementation_plan_id=v_plan.id
  ) or exists (
    select 1 from public.khpos_transformation_reviews
    where implementation_plan_id=v_plan.id
  ) then
    return jsonb_build_object('upgraded',false,'reason','execution_started');
  end if;

  v_start := coalesce(v_oi.start_date,current_date);
  v_target := coalesce(v_oi.target_date,v_start+60);
  v_duration := greatest(7,v_target-v_start);
  v_midpoint := v_start + greatest(3,round(v_duration*0.5)::integer);
  v_actor := coalesce(v_oi.approved_by,v_oi.created_by,v_oi.owner_id);

  insert into public.khpos_transformation_contexts (
    organisation_id,baseline_assessment_id,context_version,context_summary,
    evidence_snapshot,source,model,generation_version,generated_at
  ) values (
    v_oi.organisation_id,v_priority.source_assessment_id,1,
    p_payload->>'contextSummary',coalesce(p_payload->'contextSnapshot','{}'::jsonb),
    'openai',p_payload->>'model',coalesce(p_payload->>'generationVersion','2.0'),now()
  )
  on conflict (organisation_id,baseline_assessment_id,context_version) do update set
    context_summary=excluded.context_summary,
    evidence_snapshot=excluded.evidence_snapshot,
    source=excluded.source,
    model=excluded.model,
    generation_version=excluded.generation_version,
    generated_at=excluded.generated_at
  returning id into v_context_id;

  update public.khpos_organisation_interventions
  set contextualised_description=p_payload->>'contextualisedDescription',
      intelligence_summary=p_payload->>'contextSummary',
      problem_interpretation=p_payload->>'problemInterpretation',
      why_now=p_payload->>'whyNow',
      risks_and_guardrails=coalesce(p_payload->'risksAndGuardrails','[]'::jsonb),
      intelligence_source='openai',
      intelligence_model=p_payload->>'model',
      intelligence_version=coalesce(p_payload->>'generationVersion','2.0'),
      intelligence_generated_at=now(),
      intelligence_error=null,
      updated_at=now()
  where id=v_oi.id;

  update public.khpos_implementation_plans
  set status='superseded'
  where id=v_plan.id;

  update public.khpos_implementation_actions
  set status='cancelled'
  where implementation_plan_id=v_plan.id and status='not_started';
  update public.khpos_milestones
  set status='cancelled'
  where implementation_plan_id=v_plan.id and status='pending';
  update public.khpos_evidence_requirements
  set status='superseded'
  where implementation_plan_id=v_plan.id and status='required';
  update public.khpos_review_schedules
  set status='cancelled'
  where implementation_plan_id=v_plan.id and status in ('pending','due');

  select coalesce(max(plan_version),0)+1 into v_plan_version
  from public.khpos_implementation_plans
  where organisation_intervention_id=v_oi.id;

  insert into public.khpos_implementation_plans (
    organisation_id,organisation_intervention_id,plan_version,generation_version,
    source,model,objective,status,generated_at,activated_at,intelligence_generated_at
  ) values (
    v_oi.organisation_id,v_oi.id,v_plan_version,coalesce(p_payload->>'generationVersion','2.0'),
    'ai_assisted',p_payload->>'model',p_payload->>'planObjective','active',now(),now(),now()
  ) returning id into v_plan_id;

  v_action_count := greatest(1,jsonb_array_length(coalesce(p_payload->'actions','[]'::jsonb)));
  insert into public.khpos_implementation_actions (
    implementation_plan_id,sequence_no,title,description,owner_id,due_date,evidence_required
  )
  select
    v_plan_id,a.ordinality::integer,a.item->>'title',a.item->>'description',v_oi.owner_id,
    v_start + greatest(1,round(v_duration*(a.ordinality::numeric/(v_action_count+1)))::integer),
    coalesce((a.item->>'evidenceRequired')::boolean,true)
  from jsonb_array_elements(coalesce(p_payload->'actions','[]'::jsonb)) with ordinality as a(item,ordinality);

  v_milestone_count := greatest(1,jsonb_array_length(coalesce(p_payload->'milestones','[]'::jsonb)));
  insert into public.khpos_milestones (
    implementation_plan_id,sequence_no,title,success_signal,target_date
  )
  select
    v_plan_id,m.ordinality::integer,m.item->>'title',m.item->>'successSignal',
    v_start + greatest(2,round(v_duration*(m.ordinality::numeric/(v_milestone_count+1)))::integer)
  from jsonb_array_elements(coalesce(p_payload->'milestones','[]'::jsonb)) with ordinality as m(item,ordinality);

  insert into public.khpos_evidence_requirements (
    implementation_plan_id,sequence_no,title,description,evidence_type,due_date,required,status
  )
  select
    v_plan_id,e.ordinality::integer,e.item->>'title',e.item->>'description',e.item->>'evidenceType',
    case when e.ordinality=jsonb_array_length(coalesce(p_payload->'evidenceRequirements','[]'::jsonb))
      then v_target else v_start+greatest(4,round(v_duration*0.8)::integer) end,
    true,'required'
  from jsonb_array_elements(coalesce(p_payload->'evidenceRequirements','[]'::jsonb)) with ordinality as e(item,ordinality);

  insert into public.khpos_review_schedules (
    implementation_plan_id,review_type,scheduled_for,status
  ) values
    (v_plan_id,'midpoint',v_midpoint,'pending'),
    (v_plan_id,'outcome',v_target,'pending');

  update public.khpos_outcome_contracts
  set status='superseded'
  where organisation_intervention_id=v_oi.id and status='active';

  select coalesce(max(contract_version),0)+1 into v_contract_version
  from public.khpos_outcome_contracts
  where organisation_intervention_id=v_oi.id;

  insert into public.khpos_outcome_contracts (
    organisation_id,organisation_intervention_id,contract_version,status,
    baseline_condition,desired_condition,leading_indicators,outcome_indicators,
    success_threshold,evidence_standard,review_date,source,model,generation_version,generated_at
  ) values (
    v_oi.organisation_id,v_oi.id,v_contract_version,'active',
    p_payload#>>'{outcomeContract,baselineCondition}',
    p_payload#>>'{outcomeContract,desiredCondition}',
    coalesce(p_payload#>'{outcomeContract,leadingIndicators}','[]'::jsonb),
    coalesce(p_payload#>'{outcomeContract,outcomeIndicators}','[]'::jsonb),
    p_payload#>>'{outcomeContract,successThreshold}',
    coalesce(p_payload#>'{outcomeContract,evidenceStandard}','[]'::jsonb),
    v_target,'openai',p_payload->>'model',coalesce(p_payload->>'generationVersion','2.0'),now()
  ) returning id into v_contract_id;

  insert into public.khpos_audit_events (
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    v_oi.organisation_id,v_actor,'intervention_intelligence_generated','organisation_intervention',v_oi.id,
    jsonb_build_object(
      'previousPlanId',v_plan.id,
      'implementationPlanId',v_plan_id,
      'outcomeContractId',v_contract_id,
      'transformationContextId',v_context_id,
      'model',p_payload->>'model',
      'generationVersion',coalesce(p_payload->>'generationVersion','2.0'),
      'sourceAssessmentId',v_priority.source_assessment_id
    )
  );

  return jsonb_build_object(
    'upgraded',true,
    'implementationPlanId',v_plan_id,
    'outcomeContractId',v_contract_id,
    'transformationContextId',v_context_id
  );
end;
$$;

revoke all on function public.khpos_apply_intervention_intelligence_v2_server(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.khpos_apply_intervention_intelligence_v2_server(uuid,jsonb)
  to service_role;

create or replace function khpos_private.attach_outcome_contract_to_review()
returns trigger
language plpgsql
security invoker
set search_path=public,khpos_private,pg_temp
as $$
begin
  if new.outcome_contract_id is null then
    select id into new.outcome_contract_id
    from public.khpos_outcome_contracts
    where organisation_intervention_id=new.organisation_intervention_id
      and status='active'
    order by contract_version desc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_khpos_attach_outcome_contract_to_review on public.khpos_transformation_reviews;
create trigger trg_khpos_attach_outcome_contract_to_review
before insert or update of organisation_intervention_id
on public.khpos_transformation_reviews
for each row execute function khpos_private.attach_outcome_contract_to_review();

update public.khpos_transformation_reviews r
set outcome_contract_id=c.id
from public.khpos_outcome_contracts c
where r.outcome_contract_id is null
  and c.organisation_intervention_id=r.organisation_intervention_id
  and c.status='active';

comment on table public.khpos_transformation_contexts is
  'Versioned, evidence-grounded institutional context used to contextualise KHP-OS transformation intelligence without becoming an ERP profile.';
comment on table public.khpos_outcome_contracts is
  'Intervention outcome contracts that distinguish activity completion from observable institutional change.';
comment on function public.khpos_apply_intervention_intelligence_v2_server(uuid,jsonb) is
  'Atomic server-only upgrade from the canonical deterministic intervention to a validated AI-contextualised implementation plan and outcome contract. It refuses to rewrite a cycle once execution has started.';