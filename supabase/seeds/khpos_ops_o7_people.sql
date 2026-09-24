-- KNS O7 People & Staff Foundation.
-- This stage operationalises appointment, onboarding certification and initial role deployment.
-- Recruitment campaigns, sensitive safer-recruitment evidence, payroll and formal discipline remain outside O7.

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

  -- PEO-P03 Staff Onboarding, Probation & Deployment Policy
  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='PEO-P03';

  if v_policy is null then
    raise exception 'PEO-P03 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Ensure appointed KNS staff become genuinely ready to execute their role before full operational deployment.',
    'All appointed employees, facilitators, contractors, volunteers, interns and temporary staff who require an operating role in KNS.',
    '["Onboarding is certification, not a ceremonial orientation.","Role clarity must precede accountability.","Safeguarding and professional-boundary induction are non-waivable controls.","System access does not by itself make a person operationally ready.","Evidence of readiness matters more than attendance at an induction session."]'::jsonb,
    '["Every appointed staff member receives a staff record and role-specific onboarding requirements before operational activation.","Mandatory onboarding requirements must be completed or, only where explicitly waivable, formally waived by authorised leadership.","A staff member becomes Ready only when mandatory onboarding is complete, the required KHP-OS account/organisation access exists and the intended role has an active Role Charter.","Operational role activation is explicit and auditable; it is not inferred from possession of a login.","Probation/review dates may be recorded, but employment terms, statutory requirements and legal documentation remain governed by the applicable appointment/legal controls rather than invented by KHP-OS."]'::jsonb,
    '["School Guardian: owns whole-school onboarding and deployment readiness.","Vision Custodian: governs senior/exceptional appointments and may act where School Guardian authority is unavailable or insufficient.","Inspectors and other reporting leaders: verify onboarding within their reporting chain where authorised.","Appointed staff: complete required learning, acknowledgements and evidence honestly before deployment."]'::jsonb,
    '["Do not activate an operating-role assignment while mandatory onboarding remains incomplete.","Do not waive a requirement marked non-waivable.","Do not store salary, health information, identity-document images, background-check detail or other unnecessary sensitive personnel data in the standard People workspace.","The account email used for linkage must match an existing KHP-OS account before account linkage succeeds.","Active organisation access and an active Role Charter are required before operational activation."]'::jsonb,
    '["A requirement explicitly marked waivable may be waived only by School Guardian or Vision Custodian with a recorded reason.","Emergency temporary coverage is governed through delegation/backup arrangements and does not silently convert an unready appointee into a certified role holder."]'::jsonb,
    '["Overdue onboarding → relevant reporting leader and School Guardian.","Blocked account/access or missing Role Charter → responsible system owner/School Guardian.","Any safeguarding concern discovered during onboarding leaves the standard People route and follows the restricted safeguarding process.","Employment/legal uncertainty → appropriate qualified administrative/legal review before activation where required."]'::jsonb,
    '["Staff appointment record.","Role-specific onboarding checklist and evidence references.","Verification/waiver history.","Account-link record.","Role activation record.","Probation/review date where applicable."]'::jsonb,
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

  -- PEO-005 Appointment & Documentation
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-005';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Create one authoritative operational staff record after appointment so onboarding and deployment do not depend on chat messages, memory or a login account.',
    'An appointment/engagement has been approved and accepted, and the person is expected to take an operating role in KNS.',
    '["Confirmed appointee name and account email","Employment/engagement type","Intended operating role","Campus/unit where applicable","Start date","Onboarding deadline","Probation/review date where applicable under the appointment terms"]'::jsonb,
    '["Confirm that the appointment decision has been authorised through the applicable appointment process","Create the staff record without copying unnecessary sensitive personnel information into KHP-OS","Assign the intended operating role, campus and unit","Set the onboarding deadline and any applicable probation/review date","Generate the role-specific onboarding certification set","Link an existing KHP-OS account by exact email when one already exists","Move the appointee into onboarding; do not create an active operating-role assignment yet"]'::jsonb,
    'Create the operational staff record before the person is expected to execute unsupervised responsibilities.',
    '["Staff reference and appointment record","Intended role/campus/unit","Onboarding certification set","Account-link state","Audit trail"]'::jsonb,
    'Every appointee has one traceable operational identity and enters a controlled onboarding pathway before deployment.',
    '["Appointment terms or statutory/legal documentation unresolved","Duplicate current staff record for the same account email","Intended role/campus/unit not active in the institutional structure"]'::jsonb,
    '["Operational data defect → School Guardian","Appointment/legal uncertainty → appropriate appointment/legal review","Safeguarding clearance concern → restricted safeguarding/safer-recruitment route"]'::jsonb,
    '["Appointees with staff record before start","Duplicate staff records","Appointees without intended role","Onboarding started on time"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'owner'),
    (v_process,v_vc,'approver'),
    (v_process,v_ai,'consulted'),
    (v_process,v_si,'consulted')
  on conflict do nothing;

  -- PEO-006 Staff Onboarding
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-006';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Certify that appointed staff understand KNS purpose, safeguards, role expectations and operating methods before full deployment.',
    'A new staff appointment record is created or a role change requires fresh onboarding.',
    '["Staff record","Intended Role Charter","Applicable onboarding requirements","Required policies/processes","Training/acknowledgement evidence","KHP-OS account state"]'::jsonb,
    '["Review the assigned role-specific onboarding certification set","Staff member completes required learning/acknowledgement and submits evidence where required","Relevant reporting leader verifies completion against evidence rather than attendance alone","Only explicitly waivable items may be waived, and only by School Guardian/Vision Custodian with reason","Reopen any item that was incorrectly or prematurely completed","KHP-OS continuously checks mandatory completion, account linkage, active organisation access and active Role Charter","Mark the staff record Ready only when every readiness gate is satisfied"]'::jsonb,
    'Complete mandatory onboarding by the recorded onboarding deadline and before unsupervised operational activation.',
    '["Completed/waived onboarding items","Submission and verification history","Evidence references for designated controls","Readiness blockers","Account-link/access state"]'::jsonb,
    'Staff enters the role knowing what KNS stands for, what the role owns, how to escalate and how to operate safely.',
    '["Missing evidence","Overdue onboarding","No matching account","No active organisation access","No active Role Charter","Safeguarding/professional-boundary induction incomplete"]'::jsonb,
    '["Item-level gap → direct reporting leader","Overdue/blocked onboarding → School Guardian","Safeguarding concern → restricted safeguarding route","Institutional role/control gap → School Guardian/Vision Custodian as applicable"]'::jsonb,
    '["Onboarding completed by deadline","Mandatory items outstanding","Readiness blockers by type","Items reopened after verification","Waiver frequency"]'::jsonb,
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

  -- PEO-007 Role Deployment & Workload
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-007';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Convert a fully ready appointee into an active operating-role holder with clear deployment and an auditable start point.',
    'A staff record reaches Ready after mandatory onboarding, account/access and Role Charter checks are satisfied.',
    '["Ready staff record","Linked KHP-OS account","Active organisation access","Active Role Charter","Campus/unit placement","Initial workload/deployment evidence"]'::jsonb,
    '["Confirm the staff record is Ready rather than merely appointed","Confirm intended role, campus and unit remain correct","Confirm initial workload/timetable/deployment has been reviewed where applicable","Activate the operating-role assignment in the O1 institutional structure","Preserve any existing legitimate primary assignment rather than creating contradictory primary-role state","Record the role activation event and make the staff member visible to My Work, Issues, Decisions and role-owned performance flows"]'::jsonb,
    'Activate only when readiness gates are complete and before the staff member is expected to own unsupervised recurring work.',
    '["Active O1 role assignment","Staff activation event","Deployment/workload evidence reference","Start date and role placement"]'::jsonb,
    'The person becomes an active role holder through a controlled transition rather than through informal assumption or mere login access.',
    '["Mandatory onboarding incomplete","Account not linked","Organisation access inactive","Role Charter missing","Role/campus/unit changed","Workload/deployment unresolved"]'::jsonb,
    '["Deployment blocker → relevant functional leader/School Guardian","Structural role issue → School Guardian","Reserved senior-role matter → Vision Custodian"]'::jsonb,
    '["Ready staff awaiting activation","Role activations completed before independent work","Activation blocked by missing access/charter/onboarding","Initial workload/deployment exceptions"]'::jsonb,
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
    (v_process,v_vc,'approver')
  on conflict do nothing;

  -- Standard KNS onboarding certification requirements.
  insert into public.khpos_ops_onboarding_requirements(
    organisation_id,code,title,description,category,mandatory,waivable,
    evidence_required,applicable_role_codes,sort_order,status,created_by
  ) values
    (v_org,'PEO-ONB-001','KNS purpose & Builder philosophy',
      'Understand KAEC purpose, KNS identity and the responsibility to raise builders rather than merely deliver certificates.',
      'identity',true,false,false,'{}'::text[],10,'active',v_actor),
    (v_org,'PEO-ONB-002','Role Charter & reporting line',
      'Review the active Role Charter, owned outcomes, decision rights, responsibilities, reporting line and escalation rules.',
      'role_clarity',true,false,false,'{}'::text[],20,'active',v_actor),
    (v_org,'PEO-ONB-003','Staff Code & professional standards',
      'Understand the active Staff Code of Conduct, professional standards and institutional expectations.',
      'professional_standards',true,false,false,'{}'::text[],30,'active',v_actor),
    (v_org,'PEO-ONB-004','Safeguarding & professional boundaries',
      'Complete the required safeguarding induction and staff-student professional-boundary training. Sensitive case information is not stored in this onboarding record.',
      'safeguarding',true,false,true,'{}'::text[],40,'active',v_actor),
    (v_org,'PEO-ONB-005','Reporting, escalation & Issue Engine',
      'Know what to handle, what to report, how issues are recorded and when escalation increases visibility without abandoning ownership.',
      'accountability',true,false,false,'{}'::text[],50,'active',v_actor),
    (v_org,'PEO-ONB-006','Confidentiality & responsible data handling',
      'Understand confidentiality, minimum-necessary access and approved handling of learner, parent, staff and institutional information.',
      'data_responsibility',true,false,false,'{}'::text[],60,'active',v_actor),
    (v_org,'PEO-ONB-007','KHP-OS operating workflow',
      'Know how My Work, evidence, Issues, Decisions and role-owned scorecards are used for daily execution.',
      'systems',true,false,false,'{}'::text[],70,'active',v_actor),
    (v_org,'PEO-ONB-008','HQLS & academic execution',
      'Demonstrate readiness to work with the KNS HQLS academic execution model and its verification/recovery expectations.',
      'academic',true,false,true,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SECTIONAL_PROMOTER','TEACHER']::text[],
      80,'active',v_actor),
    (v_org,'PEO-ONB-009','Learner progress & intervention',
      'Understand early risk detection, diagnosis-before-intervention, review dates and evidence-based recovery.',
      'learner_support',true,false,false,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SECTIONAL_PROMOTER','TEACHER']::text[],
      90,'active',v_actor),
    (v_org,'PEO-ONB-010','Human Potential, PipuPath & Builder Projects',
      'Understand how KNS helps learners discover, develop and deploy potential and how PipuPath/Builder Projects support that journey.',
      'human_potential',true,false,false,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[],
      100,'active',v_actor),
    (v_org,'PEO-ONB-011','Skills & Young CEO operating model',
      'Understand the competency pathway, safe skills delivery and Young CEO value-creation model.',
      'skills',true,false,false,
      array['SCHOOL_GUARDIAN','SKILL_INSPECTOR','SKILLS_FACILITATOR']::text[],
      110,'active',v_actor),
    (v_org,'PEO-ONB-012','Parent communication boundaries',
      'Understand approved parent channels, escalation, confidentiality and the boundary that staff are not 24/7 personal support lines.',
      'parent_partnership',true,false,false,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[],
      120,'active',v_actor),
    (v_org,'PEO-ONB-013','Initial workload & deployment confirmed',
      'Confirm initial timetable, section/programme allocation or other workload is clear enough for the role to begin without hidden ownership gaps.',
      'deployment',true,false,true,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[],
      130,'active',v_actor)
  on conflict (organisation_id,code) do update
    set title=excluded.title,
        description=excluded.description,
        category=excluded.category,
        mandatory=excluded.mandatory,
        waivable=excluded.waivable,
        evidence_required=excluded.evidence_required,
        applicable_role_codes=excluded.applicable_role_codes,
        sort_order=excluded.sort_order,
        status='active',
        updated_at=now();

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o7_people_foundation_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'activePolicy','PEO-P03',
      'publishedProcesses',jsonb_build_array('PEO-005','PEO-006','PEO-007'),
      'onboardingRequirements',13,
      'architectureVersion','O7-v1.0',
      'excluded',jsonb_build_array(
        'recruitment campaigns',
        'sensitive safer-recruitment case detail',
        'payroll',
        'formal grievance/discipline',
        'exit/handover'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o7_people_foundation_bootstrapped'
  );
end;
$$;
