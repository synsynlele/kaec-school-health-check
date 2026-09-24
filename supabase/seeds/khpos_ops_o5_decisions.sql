-- KNS O5 controlled authority and decision/action processes.
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

  select id into v_sg from public.khpos_ops_roles where organisation_id=v_org and code='SCHOOL_GUARDIAN';
  select id into v_vc from public.khpos_ops_roles where organisation_id=v_org and code='VISION_CUSTODIAN';

  if v_sg is null or v_vc is null then raise exception 'Required governance roles are missing.'; end if;

  -- GOV-001 Authority & Decision Rights
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='GOV-001';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Ensure decisions are made at the lowest competent level with clear reserved authority, so routine work does not drift upward to the Vision Custodian.',
    'A role holder faces a decision, approval, exception or commitment that may exceed the authority of their current role.',
    '["Role charter and decision rights","Reporting line","Decision context and evidence","Relevant policy/process","Risk, cost or institutional impact where applicable"]'::jsonb,
    '["Confirm whether the decision is within the current role’s documented authority","If within authority, decide and record only when the matter is material enough to require an institutional record","If outside authority, request a decision from the immediate reporting role","Provide context, options/recommendation and deadline","Authority reviews and decides or returns for clarification","If the authority cannot decide, the matter moves further upward through the reporting chain","Reserved strategic matters reach the Vision Custodian; routine matters do not"]'::jsonb,
    'Decision requests should be raised before the dependent work becomes overdue. P1/critical matters require immediate visibility through the relevant escalation route.',
    '["Decision request or recorded decision","Authority role","Decision statement/reason","Related implementation action where required","Audit history"]'::jsonb,
    'Decisions are made by the correct authority, are visible and auditable, and founder dependency decreases rather than increases.',
    '["Emergency protective action may precede ordinary approval","Safeguarding/restricted matters follow their restricted route","Legal/regulatory matters may require external professional or statutory authority"]'::jsonb,
    '["Role owner → immediate reporting role","Continue upward only when the current authority cannot decide","Vision Custodian receives reserved strategic/institutional decisions rather than routine operations"]'::jsonb,
    '["Decision requests sent to wrong authority","Routine decisions unnecessarily escalated to Vision Custodian","Overdue pending decisions","Decisions lacking implementation ownership"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'owner'),
    (v_process,v_vc,'approver')
  on conflict do nothing;

  -- GOV-005 Decision & Action Tracking
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='GOV-005';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Convert material decisions into explicit, owned implementation and preserve the complete decision-to-action trail.',
    'A material decision is requested, recorded or approved and may require implementation by a role holder.',
    '["Decision context","Authority role","Decision statement","Implementation requirement","Implementation owner","Deadline","Expected outcome"]'::jsonb,
    '["Record or request the decision","Authority reviews the request","Approve, reject or return with a reason","Where implementation is required, assign one accountable role holder, clear expected outcome and deadline","KHP-OS creates the implementation item in My Work","Owner executes and attaches required evidence","Blocked implementation becomes an Issue through the universal Issue Engine","Completed implementation moves the decision to Implemented","Requester/authority closes the decision only after the required implementation is complete"]'::jsonb,
    'Every approved action carries a deadline. A pending decision must be made before its dependent work or institutional deadline is compromised.',
    '["Decision record and history","Approved/rejected/returned decision","Linked My Work item where action is required","Operational evidence","Issue/escalation record where execution is blocked","Closure record"]'::jsonb,
    'No material decision disappears in a meeting, chat or verbal instruction; its outcome, owner, deadline and execution status remain visible.',
    '["No-action decisions may close after communication/acknowledgement","Rejected or withdrawn requests do not create implementation work","Restricted/safeguarding decisions remain outside the standard register"]'::jsonb,
    '["Implementation blocker follows GOV-003 Issue/Escalation route","Decision authority escalates upward when the decision exceeds their authority","Execution ownership remains with the assigned implementation owner"]'::jsonb,
    '["Pending decisions overdue","Approved decisions without implementation owner/deadline","Implementation actions overdue","Decisions closed before required action completed","Repeated decision bottlenecks by authority level"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'owner'),
    (v_process,v_vc,'approver')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select v_org,v_actor,'ops_o5_decision_engine_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'publishedProcesses',jsonb_build_array('GOV-001','GOV-005'),
      'architectureVersion','O5-v1.0'
    )
  where not exists (
    select 1 from public.khpos_ops_audit_events
    where organisation_id=v_org and event_type='ops_o5_decision_engine_bootstrapped'
  );
end;
$$;
