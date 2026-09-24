-- KNS O8 Staff Availability, Leave & Coverage.
-- Raw attendance remains in the designated school/HR system.
-- KHP-OS governs exceptions, approval, temporary coverage and return visibility.

do $$
declare
  v_org uuid;
  v_actor uuid;
  v_vc uuid;
  v_sg uuid;
  v_ai uuid;
  v_si uuid;
  v_sp uuid;
  v_teacher uuid;
  v_facilitator uuid;
  v_policy uuid;
  v_process uuid;
begin
  select id into v_org
  from public.organisations
  where name='KAEC Nigerian Schools' and status='active'
  order by created_at
  limit 1;

  if v_org is null then
    raise exception 'KAEC Nigerian Schools organisation not found.';
  end if;

  select user_id into v_actor
  from public.organisation_memberships
  where organisation_id=v_org
    and role='executive'
    and status='active'
  order by created_at
  limit 1;

  if v_actor is null then
    raise exception 'KAEC Nigerian Schools executive membership not found.';
  end if;

  select id into v_vc from public.khpos_ops_roles where organisation_id=v_org and code='VISION_CUSTODIAN';
  select id into v_sg from public.khpos_ops_roles where organisation_id=v_org and code='SCHOOL_GUARDIAN';
  select id into v_ai from public.khpos_ops_roles where organisation_id=v_org and code='ACADEMIC_INSPECTOR';
  select id into v_si from public.khpos_ops_roles where organisation_id=v_org and code='SKILL_INSPECTOR';
  select id into v_sp from public.khpos_ops_roles where organisation_id=v_org and code='SECTIONAL_PROMOTER';
  select id into v_teacher from public.khpos_ops_roles where organisation_id=v_org and code='TEACHER';
  select id into v_facilitator from public.khpos_ops_roles where organisation_id=v_org and code='SKILLS_FACILITATOR';

  if v_vc is null or v_sg is null or v_ai is null or v_si is null
     or v_sp is null or v_teacher is null or v_facilitator is null then
    raise exception 'Required KNS operating roles are missing.';
  end if;

  -- PEO-P04 Staff Attendance, Leave & Availability Policy
  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='PEO-P04';

  if v_policy is null then
    raise exception 'PEO-P04 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Ensure staff availability exceptions are visible early enough for the school to protect continuity without rebuilding transactional attendance or exposing unnecessary private information.',
    'All active deployed KNS staff, facilitators and leaders whose temporary unavailability may affect school operations.',
    '["Attendance transactions and payroll attendance calculations belong in the designated school/HR system.","KHP-OS governs the exceptions that require approval, coverage, escalation or return confirmation.","Operational continuity matters, but staff privacy still applies.","A covering colleague needs the time and scope of coverage, not the unavailable staff member''s private reason.","Leave rights, statutory entitlements and contractual terms are not invented by KHP-OS and must be applied according to the governing appointment terms and applicable requirements."]'::jsonb,
    '["Planned leave should be requested early enough for the appropriate reporting leader to decide and arrange continuity.","Unplanned absence, late arrival, early departure or other availability exceptions should be recorded promptly when they affect execution.","Where coverage is required, the case remains visibly unresolved until an appropriate covering staff member accepts the assignment and the reporting leader confirms the plan is sufficient.","The unavailable staff member or authorised leader confirms return; the reporting leader closes the case after continuity/handback is complete.","No diagnosis, medical detail or unnecessary sensitive reason is required in the standard availability record."]'::jsonb,
    '["Staff: report/request their own availability exceptions accurately and confirm return.","Direct/reporting leaders: decide planned leave within authority, determine whether coverage is required, arrange coverage and close returned cases.","Covering staff: accept or decline assigned coverage promptly and record handback/completion.","School Guardian: owns whole-school availability continuity and cross-functional exceptions.","Vision Custodian: handles reserved institutional exceptions and records own planned unavailability without routing routine approval to self."]'::jsonb,
    '["Do not duplicate daily clock-in/attendance records inside KHP-OS.","Do not store diagnoses, medical certificates, family details or other unnecessary sensitive information in the standard availability note.","A staff member cannot approve their own leave.","A staff member cannot cover their own unavailable assignment.","Coverage cannot be marked sufficient until at least one assigned colleague has accepted an appropriate coverage assignment.","Overlapping open availability cases for the same staff member are rejected to prevent contradictory operational state."]'::jsonb,
    '["The Vision Custodian may record their own planned institutional unavailability without self-approval; continuity/coverage remains visible and auditable.","Emergency operational action may precede ordinary planning where delay would disrupt learner safety or school continuity; the exception and resulting coverage must still be recorded."]'::jsonb,
    '["Pending leave outside the reporting leader''s authority → next authorised leadership level.","Coverage gap threatening learning/safety/critical operations → School Guardian and, if material, Issue Engine escalation.","Repeated attendance/availability pattern requiring performance intervention → People performance process, not repeated informal reminders.","Any safeguarding concern discovered through an absence report → restricted safeguarding process."]'::jsonb,
    '["Availability/leave case record.","Decision and approval history.","Coverage assignments and acceptance/decline.","Return confirmation.","Closure history.","External attendance/source reference where relevant."]'::jsonb,
    current_date,(current_date+interval '12 months')::date,
    v_actor,now(),'active'
  )
  on conflict (policy_id,version) do nothing;

  update public.khpos_ops_policies
  set status='active',updated_at=now()
  where id=v_policy;

  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  values
    (v_policy,v_sg,'mandatory'),
    (v_policy,v_ai,'mandatory'),
    (v_policy,v_si,'mandatory'),
    (v_policy,v_sp,'mandatory'),
    (v_policy,v_teacher,'mandatory'),
    (v_policy,v_facilitator,'mandatory'),
    (v_policy,v_vc,'reference')
  on conflict do nothing;

  -- PEO-008 Attendance & Availability Exception
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-008';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Turn a meaningful staff attendance/availability deviation into visible action without duplicating the transactional attendance system.',
    'A staff member reports, a leader observes, or the designated attendance system surfaces an absence, lateness, early departure or other availability exception that affects execution.',
    '["Active deployed staff record","Affected operating-role assignment","Exception type and period","Minimum necessary reason category/note","External attendance/source reference where available","Initial continuity impact"]'::jsonb,
    '["Record the exception in KHP-OS rather than copying the full attendance ledger","Determine whether the exception is planned or unplanned and whether temporary coverage is required","Protect private reasons from colleagues who only need coverage information","If coverage is required, keep the case in Coverage Required until a covering staff member accepts and the reporting leader confirms the plan","Track the case through active period, return confirmation and closure","Move repeated or materially disruptive patterns into the appropriate performance/Issue process rather than normalising repeated reminders"]'::jsonb,
    'Record operationally significant unplanned exceptions as soon as reasonably possible after they are known; planned leave follows the leave/coverage process before the absence begins where practicable.',
    '["Availability case/reference","Affected role assignment","Decision/coverage state","External source reference where relevant","Return and closure timestamps"]'::jsonb,
    'School continuity is protected while the external attendance source remains authoritative for raw attendance transactions.',
    '["No active O7 staff/deployment record","Conflicting overlapping case","Coverage gap","Return overdue","Repeated pattern requiring performance intervention","Sensitive safeguarding information embedded in ordinary availability notes"]'::jsonb,
    '["Coverage gap affecting critical operations → School Guardian","Repeated pattern → PEO-010 Performance Management","Safeguarding concern → System 07","Attendance-data disagreement → reconcile with designated source system rather than editing KHP-OS into a shadow attendance ledger"]'::jsonb,
    '["Operational exceptions recorded","Coverage-required cases unresolved","Return overdue","Repeated availability exceptions referred to performance process","External-source reconciliation issues"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'participant'),
    (v_process,v_teacher,'participant'),
    (v_process,v_facilitator,'participant'),
    (v_process,v_vc,'informed')
  on conflict do nothing;

  -- PEO-009 Leave, Absence & Coverage
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-009';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Approve planned staff unavailability and arrange explicit temporary coverage so no role silently becomes ownerless.',
    'An active staff member requests planned leave or an unplanned absence creates a temporary operating-role gap.',
    '["Availability case","Affected role and period","Current workload/critical responsibilities","Coverage requirement","Eligible active staff for temporary coverage","Minimum necessary handover scope"]'::jsonb,
    '["Staff submits planned leave or leader records an unplanned exception","Appropriate reporting leader reviews the request and continuity impact without requiring unnecessary sensitive details","Leader approves/declines planned leave and decides whether coverage is required","Where coverage is required, assign one or more active staff members with explicit period and scope","Covering staff accepts or declines the assignment; declined coverage remains unresolved","Reporting leader confirms the coverage plan only after accepted coverage exists","During/after the absence, covering staff records completion/handback where applicable","Unavailable staff or authorised leader confirms return","Reporting leader closes the case after operational handback is complete"]'::jsonb,
    'Decide planned leave and establish required coverage before the absence begins where practicable; emergency/unplanned absence is handled immediately using the same visible coverage controls.',
    '["Leave/availability decision","Coverage assignments","Acceptance/decline records","Coverage confirmation","Return confirmation","Closure/handback evidence"]'::jsonb,
    'Temporary unavailability never creates invisible ownership gaps, while leave approval remains separate from raw attendance recording.',
    '["No authorised reviewer","Proposed coverer also unavailable","Coverage assignment declined","Coverage period does not match the operational gap","Return not confirmed after expected end","Coverage scope insufficient"]'::jsonb,
    '["Unresolved local coverage → next reporting leader","Cross-section/cross-function coverage → School Guardian","Critical continuity/safety risk → Issue Engine and School Guardian","Reserved institutional continuity → Vision Custodian"]'::jsonb,
    '["Planned leave decided before start","Coverage-required cases confirmed before start","Coverage declines/reassignments","Return confirmed on time","Cases closed after handback","Critical coverage gaps"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'participant'),
    (v_process,v_teacher,'participant'),
    (v_process,v_facilitator,'participant'),
    (v_process,v_vc,'approver')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o8_availability_engine_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'activePolicy','PEO-P04',
      'publishedProcesses',jsonb_build_array('PEO-008','PEO-009'),
      'architectureVersion','O8-v1.0',
      'attendanceBoundary','third_party_transaction_source',
      'seededAvailabilityCases',0,
      'seededCoverageAssignments',0
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o8_availability_engine_bootstrapped'
  );
end;
$$;
