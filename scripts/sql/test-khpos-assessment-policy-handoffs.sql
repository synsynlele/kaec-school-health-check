begin;
do $test$
declare
  org uuid; actor uuid; role_id uuid; profile uuid; campus uuid; term uuid;
  kpi uuid; kpi_version uuid; cycle uuid; policy uuid; due_version uuid; future_version uuid; draft_version uuid;
  future_policy uuid; retired_policy uuid; retired_version uuid; total integer; suffix text := gen_random_uuid()::text;
begin
  select r.organisation_id,a.user_id,r.id into org,actor,role_id
  from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
  where r.code='VISION_CUSTODIAN' and r.status='active' and a.status='active'
    and khpos_private.ops_hpd_has_membership(a.user_id,r.organisation_id) limit 1;
  select id into campus from public.khpos_ops_campuses where organisation_id=org and status='active' limit 1;
  select ep.id into profile from public.khpos_ops_process_execution_profiles ep
  where ep.organisation_id=org and exists(select 1 from public.khpos_ops_process_versions pv where pv.process_id=ep.process_id and pv.status='active') limit 1;
  if profile is null or campus is null then raise exception 'Active school/campus/process fixture required'; end if;
  update public.khpos_ops_process_execution_profiles set activation_mode='event',owner_role_id=role_id,event_type='assessment_results_followup_required',status='configured',evidence_required=true,verification_required=true where id=profile;
  insert into public.khpos_ops_academic_terms(organisation_id,campus_id,session_label,term_code,term_name,start_date,end_date,created_by)
    values(org,campus,suffix,'BATCH','Rollback',current_date-7,current_date+7,actor) returning id into term;
  insert into public.khpos_ops_assessment_cycles(organisation_id,term_id,campus_id,cycle_reference,title,cycle_type,starts_on,ends_on,status,created_by)
    values(org,term,campus,suffix,'PRIVATE ASSESSMENT TITLE','terminal',current_date-2,current_date-1,'in_progress',actor) returning id into cycle;
  if exists(select 1 from public.khpos_ops_trigger_events where execution_profile_id=profile and subject_id=cycle::text) then raise exception 'In-progress assessment incorrectly triggered follow-up'; end if;
  update public.khpos_ops_assessment_cycles set status='results_pending' where id=cycle;
  update public.khpos_ops_assessment_cycles set status='results_pending' where id=cycle;
  select count(*) into total from public.khpos_ops_trigger_events where execution_profile_id=profile and subject_id=cycle::text and status='materialized';
  if total<>1 then raise exception 'Assessment handoff must create one work item, got %',total; end if;
  if not exists(select 1 from public.khpos_ops_trigger_events e join public.khpos_ops_work_items w on w.id=e.work_item_id where e.execution_profile_id=profile and e.subject_id=cycle::text and w.evidence_required and w.verification_required) then raise exception 'Assessment controls missing'; end if;
  if exists(select 1 from public.khpos_ops_trigger_events where subject_id=cycle::text and payload::text like '%PRIVATE%') then raise exception 'Assessment narrative leaked'; end if;

  update public.khpos_ops_process_execution_profiles set activation_mode='condition',condition_key='policy_review_due',event_type=null where id=profile;
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status)
    values(org,'BATCH-'||suffix,'Rollback policy','governance','Leadership','C1','active') returning id into policy;
  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,review_date,status)
    values(policy,1,'PRIVATE PURPOSE','Fixture',(now() at time zone 'Africa/Lagos')::date,'active') returning id into due_version;
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status)
    values(org,'FUTURE-'||suffix,'Rollback future policy','governance','Leadership','C1','active') returning id into future_policy;
  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,review_date,status)
    values(future_policy,1,'Fixture','Fixture',current_date+10,'active') returning id into future_version;
  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,review_date,status)
    values(policy,3,'Fixture','Fixture',current_date-10,'draft') returning id into draft_version;
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status)
    values(org,'RETIRED-'||suffix,'Rollback retired policy','governance','Leadership','C1','retired') returning id into retired_policy;
  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,review_date,status)
    values(retired_policy,1,'Fixture','Fixture',current_date-10,'active') returning id into retired_version;
  perform khpos_private.ops_evaluate_condition_triggers();
  perform khpos_private.ops_evaluate_condition_triggers();
  select count(*) into total from public.khpos_ops_trigger_events where execution_profile_id=profile and subject_id=due_version::text and status='materialized';
  if total<>1 then raise exception 'Policy review duplicated or missing: %',total; end if;
  if exists(select 1 from public.khpos_ops_trigger_events where execution_profile_id=profile and subject_id in (future_version::text,draft_version::text,retired_version::text)) then raise exception 'Future/draft/retired policy triggered'; end if;
  if exists(select 1 from public.khpos_ops_trigger_events where subject_id=due_version::text and payload::text like '%PRIVATE%') then raise exception 'Policy narrative leaked'; end if;
  if not exists(select 1 from public.khpos_ops_policy_versions where id=due_version and status='active') then raise exception 'Review engine changed policy governance'; end if;
  -- Historical failure must not override the most recent healthy measurement.
  update public.khpos_ops_process_execution_profiles set condition_key='kpi_failing' where id=profile;
  insert into public.khpos_ops_kpis(organisation_id,code,name,domain,created_by)
    values(org,'BATCH-'||suffix,'Rollback KPI','execution',actor) returning id into kpi;
  insert into public.khpos_ops_kpi_versions(kpi_id,version,definition,owner_role_id,scope_type,indicator_type,unit,cadence)
    values(kpi,1,'Fixture',role_id,'institution','process','percent','weekly') returning id into kpi_version;
  insert into public.khpos_ops_kpi_measurements(organisation_id,kpi_id,kpi_version_id,period_start,period_end,value_numeric,performance_status,recorded_by)
    values(org,kpi,kpi_version,current_date-3,current_date-3,10,'red',actor),
      (org,kpi,kpi_version,current_date-2,current_date-2,90,'green',actor);
  perform khpos_private.ops_evaluate_condition_triggers();
  if exists(select 1 from public.khpos_ops_trigger_events where execution_profile_id=profile and event_key='kpi_failing:'||kpi::text||':'||to_char(current_date,'YYYY-MM-DD')) then raise exception 'Historical red KPI overrode latest green'; end if;
  insert into public.khpos_ops_kpi_measurements(organisation_id,kpi_id,kpi_version_id,period_start,period_end,value_numeric,performance_status,recorded_by)
    values(org,kpi,kpi_version,current_date-1,current_date-1,5,'red',actor);
  perform khpos_private.ops_evaluate_condition_triggers();
  if not exists(select 1 from public.khpos_ops_trigger_events where execution_profile_id=profile and event_key='kpi_failing:'||kpi::text||':'||to_char(current_date,'YYYY-MM-DD') and status='materialized') then raise exception 'Latest red KPI did not trigger'; end if;

end;
$test$;
rollback;
select 'Assessment transition, deduplication, controls, privacy due-only policy review and latest KPI state passed; fixtures rolled back' as result;
