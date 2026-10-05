-- Run against a KHPOS database with an active school and Vision Custodian.
-- Every fixture, mapping and generated record is rolled back.
begin;
do $test$
declare
  org uuid; actor uuid; role_id uuid; assignment uuid; campus uuid;
  profile uuid; process uuid; checklist uuid; staff uuid; source_id uuid;
  term uuid; stream uuid; target uuid; learner uuid; asset uuid; issue uuid;
  suffix text := gen_random_uuid()::text;
  ambiguous_role uuid;
  work_count integer;
begin
  select r.organisation_id,a.user_id,r.id,a.id into org,actor,role_id,assignment
  from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
  where r.code='VISION_CUSTODIAN' and r.status='active' and a.status='active'
    and khpos_private.ops_hpd_has_membership(a.user_id,r.organisation_id) limit 1;
  if org is null then raise exception 'An active school fixture is required'; end if;
  select c.id into campus from public.khpos_ops_campuses c where c.organisation_id=org and c.status='active' limit 1;
  select ep.id,ep.process_id into profile,process from public.khpos_ops_process_execution_profiles ep
    where ep.organisation_id=org and exists(select 1 from public.khpos_ops_process_versions pv where pv.process_id=ep.process_id and pv.status='active') limit 1;
  if profile is null or campus is null then raise exception 'An active campus/process fixture is required'; end if;
  insert into public.khpos_ops_checklist_templates(organisation_id,process_id,code,name,status)
    values(org,process,'W6-'||suffix,'Wave 6 test checklist','active') returning id into checklist;
  update public.khpos_ops_process_execution_profiles set activation_mode='event',owner_role_id=role_id,event_type='staff_coverage_required',status='configured',evidence_required=true,verification_required=true where id=profile;
  insert into public.khpos_ops_staff(organisation_id,staff_reference,display_name,account_email,desired_role_id,start_date,onboarding_due_date,created_by)
    values(org,'W6-'||suffix,'Rollback fixture','fixture@example.invalid',role_id,current_date,current_date,actor) returning id into staff;
  insert into public.khpos_ops_staff_availability_cases(organisation_id,staff_id,affected_assignment_id,case_reference,case_type,start_at,end_at,coverage_required,status,recorded_by)
    values(org,staff,assignment,'W6-'||suffix,'unplanned_absence',now(),now()+interval '1 hour',true,'coverage_required',actor) returning id into source_id;
  update public.khpos_ops_staff_availability_cases set status='active' where id=source_id;
  select count(*) into work_count from public.khpos_ops_trigger_events where execution_profile_id=profile and subject_id=source_id::text and status='materialized';
  if work_count<>1 then raise exception 'Coverage must create exactly one work item, got %',work_count; end if;
  if not exists(select 1 from public.khpos_ops_trigger_events e join public.khpos_ops_work_items w on w.id=e.work_item_id where e.execution_profile_id=profile and e.subject_id=source_id::text and w.checklist_template_id=checklist and w.evidence_required and w.verification_required) then raise exception 'Triggered work lost checklist/evidence/verification'; end if;

  update public.khpos_ops_process_execution_profiles set event_type='academic_recovery_required' where id=profile;
  insert into public.khpos_ops_academic_terms(organisation_id,campus_id,session_label,term_code,term_name,start_date,end_date,created_by)
    values(org,campus,suffix,'W6','Rollback test',current_date,current_date+7,actor) returning id into term;
  insert into public.khpos_ops_academic_delivery_streams(organisation_id,term_id,campus_id,class_label,subject_label,teacher_assignment_id,scheme_source,scheme_reference,timetable_reference,created_by)
    values(org,term,campus,'Fixture','Fixture',assignment,'manual','fixture','fixture',actor) returning id into stream;
  insert into public.khpos_ops_academic_weekly_targets(organisation_id,stream_id,week_number,target_reference,target_label,created_by)
    values(org,stream,1,'fixture','Fixture',actor) returning id into target;
  insert into public.khpos_ops_academic_debt(organisation_id,target_id,stream_id,debt_type,cause_category,cause_note,recovery_owner_assignment_id,created_by)
    values(org,target,stream,'missed_delivery','other','Rollback fixture',assignment,actor) returning id into source_id;
  if not exists(select 1 from public.khpos_ops_trigger_events where execution_profile_id=profile and subject_id=source_id::text and status='materialized') then raise exception 'Academic debt did not create recovery work'; end if;

  update public.khpos_ops_process_execution_profiles set event_type='learner_support_required' where id=profile;
  insert into public.khpos_ops_learner_anchors(organisation_id,campus_id,external_system,external_learner_reference,display_name,class_label,created_by)
    values(org,campus,'manual',suffix,'Rollback fixture','Fixture',actor) returning id into learner;
  insert into public.khpos_ops_learner_risk_signals(organisation_id,learner_id,signal_reference,signal_type,severity,source_system,signal_note,observed_at,reported_by)
    values(org,learner,suffix,'sharp_decline','red','manual','PRIVATE FIXTURE TEXT',now(),actor) returning id into source_id;
  update public.khpos_ops_learner_risk_signals set severity='critical' where id=source_id;
  select count(*) into work_count from public.khpos_ops_trigger_events where execution_profile_id=profile and subject_id=source_id::text and status='materialized';
  if work_count<>1 then raise exception 'Risk updates duplicated support work'; end if;
  if exists(select 1 from public.khpos_ops_trigger_events where execution_profile_id=profile and subject_id=source_id::text and payload::text like '%PRIVATE FIXTURE TEXT%') then raise exception 'Risk narrative leaked into event'; end if;

  update public.khpos_ops_process_execution_profiles set event_type='asset_fault_reported' where id=profile;
  insert into public.khpos_ops_assets(organisation_id,campus_id,asset_code,label,category,location,owner_role_id,service_interval_days,next_service_date,created_by)
    values(org,campus,suffix,'Fixture','equipment','Fixture',role_id,30,current_date,actor) returning id into asset;
  insert into public.khpos_ops_issues(organisation_id,campus_id,category,severity,title,description,reported_by)
    values(org,campus,'asset','P3','Fixture','Fixture',actor) returning id into issue;
  insert into public.khpos_ops_asset_issues(organisation_id,asset_id,issue_id) values(org,asset,issue) returning id into source_id;
  if not exists(select 1 from public.khpos_ops_trigger_events where execution_profile_id=profile and subject_id=source_id::text and status='materialized') then raise exception 'Asset fault did not create maintenance work'; end if;

  -- Ambiguous routing must create a visible failure, never select an arbitrary person.
  insert into public.khpos_ops_roles(organisation_id,code,title,role_level)
    values(org,'W6-'||suffix,'Rollback owner',20) returning id into ambiguous_role;
  insert into public.khpos_ops_role_assignments(role_id,user_id,status) values(ambiguous_role,actor,'active');
  insert into public.khpos_ops_role_assignments(role_id,user_id,campus_id,status) values(ambiguous_role,actor,campus,'active');
  update public.khpos_ops_process_execution_profiles set owner_role_id=ambiguous_role where id=profile;
  perform khpos_private.ops_emit_system_event(org,'asset_fault_reported','ambiguous:'||suffix,'test',suffix,jsonb_build_object('campusId',campus));
  if not exists(select 1 from public.khpos_ops_trigger_events where execution_profile_id=profile and event_key='ambiguous:'||suffix and status='failed' and work_item_id is null) then raise exception 'Ambiguous routing was not blocked'; end if;
end;
$test$;
rollback;
select 'Wave 6: four domain events, deduplication, controls, privacy and ambiguous ownership passed; fixtures rolled back' as result;
