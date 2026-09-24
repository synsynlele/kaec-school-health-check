-- KNS O4 controlled escalation process.
do $$
declare
  v_org uuid;
  v_actor uuid;
  v_process uuid;
  v_sg uuid;
  v_vc uuid;
begin
  select id into v_org
  from public.organisations
  where name='KAEC Nigerian Schools' and status='active'
  order by created_at limit 1;

  if v_org is null then raise exception 'KAEC Nigerian Schools organisation not found.'; end if;

  select user_id into v_actor
  from public.organisation_memberships
  where organisation_id=v_org and role='executive' and status='active'
  order by created_at limit 1;

  if v_actor is null then raise exception 'KAEC Nigerian Schools executive membership not found.'; end if;

  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='GOV-003';

  select id into v_sg
  from public.khpos_ops_roles
  where organisation_id=v_org and code='SCHOOL_GUARDIAN';

  select id into v_vc
  from public.khpos_ops_roles
  where organisation_id=v_org and code='VISION_CUSTODIAN';

  if v_process is null or v_sg is null or v_vc is null then
    raise exception 'Required O4 governance records are missing.';
  end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Ensure deviations that exceed an owner’s authority, deadline or risk tolerance gain the right leadership visibility without removing ownership from the person responsible for resolution.',
    'An issue exceeds role authority, reaches material severity, becomes overdue, remains unresolved, or the owner requires a decision/support from the reporting line.',
    '["Issue record","Severity and impact","Current owner","Existing evidence/actions","Role and reporting structure","Current deadline or SLA"]'::jsonb,
    '["Owner records the issue and takes the immediate action within their authority","Determine whether escalation is required by severity, authority, deadline or unresolved dependency","Record the escalation reason and current state","Escalate to the immediate reporting role; ownership remains with the current owner unless deliberately reassigned","Escalated leader provides decision, support or further escalation","Repeat through the reporting line only when the next level cannot resolve the exception","Resolve with evidence","Independent reporter/leader verifies where required","Close and capture learning if the issue reveals a repeated system defect"]'::jsonb,
    'P1 critical issues receive immediate leadership visibility. Other issues escalate before an existing deadline is missed or as soon as the owner knows the matter exceeds their authority.',
    '["Issue record","Escalation history","Leadership decision/support where required","Resolution evidence","Verification and closure record"]'::jsonb,
    'The right level of leadership sees the exception at the right time while routine responsibility remains with the operating owner.',
    '["Safeguarding or other restricted matters use the designated restricted case route","An emergency may require immediate protective action before ordinary approval","An issue already at the highest available authority cannot be escalated further inside the reporting chain"]'::jsonb,
    '["Teacher → Sectional Promoter → Academic Inspector → School Guardian → Vision Custodian for academic/section matters","Skills Facilitator → Skill Inspector → School Guardian → Vision Custodian for skills matters","Escalation transfers visibility and authority support, not automatic ownership"]'::jsonb,
    '["Open issues beyond deadline","P1/P2 issues without appropriate visibility","Escalated issues unresolved","Repeated issues indicating a process defect","Issues escalated unnecessarily because authority was unclear"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes
  set status='active',updated_at=now()
  where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'owner'),
    (v_process,v_vc,'approver')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select v_org,v_actor,'ops_o4_issue_engine_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'publishedProcess','GOV-003',
      'architectureVersion','O4-v1.0'
    )
  where not exists (
    select 1 from public.khpos_ops_audit_events
    where organisation_id=v_org and event_type='ops_o4_issue_engine_bootstrapped'
  );
end;
$$;
