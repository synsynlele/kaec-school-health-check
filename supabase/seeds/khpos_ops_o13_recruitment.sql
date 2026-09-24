-- KNS O13 Workforce Planning, Recruitment, Selection & Safer Recruitment.
-- The recruitment engine turns an approved institutional need into an evidence-based,
-- safeguarding-aware appointment that hands off into the existing O7 onboarding engine.

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

  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='PEO-P01';

  if v_policy is null then
    raise exception 'PEO-P01 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Ensure KNS recruits only when a real institutional need exists, selects people using relevant evidence, protects children and candidate dignity, and appoints only candidates who complete the governed safer-recruitment pathway.',
    'Workforce requests, vacancy approval, recruitment advertising/briefs, candidate applications, screening, interview/demonstration, conditional selection, safer-recruitment clearance and handoff into PEO-005 Appointment & Documentation. Vision Custodian appointment remains outside internal school recruitment.',
    '["Recruitment begins with an approved institutional need, not merely because a manager likes a candidate.","The active Role Charter defines the outcomes, authority and accountability of the role being recruited.","Selection is evidence-based and job-relevant; no hidden numerical score, popularity vote, personal relationship or founder preference may substitute for evidence.","Candidate dignity, equal opportunity and data minimisation apply throughout recruitment; irrelevant personal characteristics must not be used to decide suitability.","Working with children creates a higher duty of care: conditional selection is not appointment and safer-recruitment clearance must finish first.","A candidate declaration never substitutes for independent verification where an external check or reference is required.","Recruitment information is restricted operational data. Store outcomes and evidence references in KHP-OS; do not copy unnecessary sensitive source documents into the workspace.","If KNS uses a third-party recruiter or labour contractor, the provider must meet applicable licensing/authorisation requirements and KNS remains responsible for its own safeguarding clearance.","Appointment is the handoff into the existing O7 staff/onboarding engine; recruitment does not bypass onboarding, Role Charter, account linkage or deployment controls."]'::jsonb,
    '["Every workforce request states the role, reason, need type, desired start date and alternatives considered; budget reference is recorded where applicable.","School Guardian may plan/recruit ordinary school roles. School Guardian recruitment decisions are reserved to the Vision Custodian. Vision Custodian appointment requires external/company governance.","An approved workforce request creates one governed vacancy. The vacancy may not open until its title, role outcomes, minimum requirements and safeguarding statement are complete.","Applications move through explicit stages: Applied → Screening → Interview → Conditional Selection → Clearance → Cleared → Appointed, or a documented Declined/Withdrawn route.","Screening and interview decisions require specific evidence. Interview/demonstration evidence recommending progression is required before conditional selection.","Conflicting adverse evidence cannot be silently ignored; the competent decision-maker records the reason for progression or stops the application.","Conditional selection means the candidate appears suitable subject to safer-recruitment clearance. It is not an unconditional appointment promise.","Clearance uses the current controlled requirement register. Mandatory non-waivable checks must be verified; Needs Review or Not Clear blocks clearance completion.","External background/character/safeguarding checks must use the lawful, appropriate source available for the role and current regulatory context. KHP-OS records the check type/outcome/evidence reference rather than inventing legal validity.","Only a Cleared candidate may be converted into an O7 staff appointment record. The staff record then follows normal onboarding, account-linkage, readiness and activation controls.","Candidate rejection/withdrawal reasons are recorded professionally and should avoid unnecessary sensitive detail.","Recruitment records must be retained/accessed according to GOV-P03 Records, Data & Confidentiality controls when activated; until then, service-role restriction and data minimisation are mandatory interim controls."]'::jsonb,
    '["Vision Custodian: approves School Guardian workforce/recruitment decisions, governs senior appointments and routes Vision Custodian appointment to company governance.","School Guardian: owns workforce planning and recruitment execution, verifies need, vacancy readiness, evidence-based selection, safer-recruitment clearance and appointment authority for roles within scope.","Academic Inspector / Skill Inspector / Sectional Promoter: participate as functional evaluators when relevant, providing role-specific competence evidence rather than making unsupported final appointments.","Candidate: provides accurate application information, participates in role-relevant selection and supplies lawful evidence/consents required for verification.","Admin/designated recruitment support: coordinates scheduling, records and evidence references without becoming the final suitability authority unless separately authorised.","Safeguarding function: defines/assures child-protection clearance requirements and escalates concerns through the specialised safeguarding route where required.","Third-party recruiter/provider: may source candidates where lawfully engaged, but cannot waive KNS selection or safeguarding requirements."]'::jsonb,
    '["Do not recruit without an approved workforce request and active Role Charter.","Do not write a vacancy around a preferred individual after the fact.","Do not request or record personal data that is irrelevant to the role or required lawful checks.","Do not use protected/irrelevant personal characteristics as selection criteria.","Do not move a candidate to interview without recorded screening evidence.","Do not conditionally select without interview or demonstration evidence recommending progression.","Do not treat Conditional Selection as Appointment.","Do not complete clearance while any mandatory item is unresolved, Not Clear or Needs Review.","Do not waive a non-waivable safer-recruitment control.","Do not appoint a candidate who has not reached Cleared.","Do not let a third-party recruiter substitute its screening for KNS safeguarding clearance.","Do not create a Vision Custodian appointment through internal school recruitment.","Do not copy highly sensitive external-source documents into KHP-OS when an authorised reference/outcome is sufficient."]'::jsonb,
    '["Urgent temporary coverage may change sourcing speed but does not remove mandatory safeguarding/clearance before unsupervised child-facing deployment.","Where a particular external check is unavailable or legally uncertain, mark the check Needs Review and obtain the appropriate safeguarding/legal/regulatory decision; do not silently convert absence of evidence into Verified.","Where a role legitimately has no formal qualification requirement, verify the role-relevant experience/competence claims instead of fabricating a certificate requirement.","A candidate may withdraw at any stage before appointment; record withdrawal without adverse inference.","An approved workforce request can be closed without hire if the need disappears; the decision remains auditable."]'::jsonb,
    '["School Guardian role recruitment → Vision Custodian.","Vision Custodian appointment → external/company governance.","Safeguarding concern or adverse child-protection information → designated safeguarding route; recruitment decision pauses as appropriate.","Uncertain legal permissibility of a background check or candidate-data use → qualified legal/data-protection review.","Budget/financial authority exception → FIN governance when activated; record the reference rather than bypassing workforce approval.","Repeated inability to fill a critical role → Workforce Planning + succession/development review, not lowered safeguarding standards."]'::jsonb,
    '["Workforce request and approval/decline rationale.","Active Role Charter reference and vacancy brief.","Candidate identity/contact/application record with minimal necessary personal data.","Screening, interview, demonstration and reference-review evidence.","Conditional-selection decision trail.","Safer-recruitment clearance items, outcomes and evidence references.","External check/reference identifiers where appropriate, without unnecessary sensitive document copies.","Cleared/declined/withdrawn/appointed stage history.","O7 staff appointment ID created from the cleared application.","Recruitment event/audit trail."]'::jsonb,
    current_date,(current_date+interval '12 months')::date,
    v_actor,now(),'active'
  )
  on conflict (policy_id,version) do nothing;

  update public.khpos_ops_policies
  set status='active',updated_at=now()
  where id=v_policy;

  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  values
    (v_policy,v_vc,'mandatory'),
    (v_policy,v_sg,'mandatory'),
    (v_policy,v_ai,'mandatory'),
    (v_policy,v_si,'mandatory'),
    (v_policy,v_sp,'mandatory'),
    (v_policy,v_teacher,'reference'),
    (v_policy,v_facilitator,'reference')
  on conflict do nothing;

  -- Safer-recruitment clearance controls.
  insert into public.khpos_ops_recruitment_clearance_requirements(
    organisation_id,code,title,description,category,
    mandatory,waivable,evidence_required,applicable_role_codes,
    sort_order,status,created_by
  ) values
    (
      v_org,'SRC-001','Identity & Contact Verification',
      'Verify the candidate identity/contact details using an appropriate reliable source. Record only the evidence reference/outcome needed for recruitment.',
      'identity',true,false,true,'{}'::text[],10,'active',v_actor
    ),
    (
      v_org,'SRC-002','Role Qualification / Experience Verification',
      'Verify the qualifications, licences, portfolio evidence or prior experience actually relied on for this role. Where no formal certificate is required, verify the material experience/competence claim instead.',
      'qualification',true,false,true,'{}'::text[],20,'active',v_actor
    ),
    (
      v_org,'SRC-003','Independent Reference Verification',
      'Obtain and verify an independent reference appropriate to the candidate history and role. Record the source relationship, verification outcome and evidence reference without unnecessary sensitive detail.',
      'reference',true,false,true,'{}'::text[],30,'active',v_actor
    ),
    (
      v_org,'SRC-004','Safeguarding & Professional Conduct Declaration',
      'Record the candidate declaration about relevant safeguarding/professional-conduct concerns, prior restrictions or material disciplinary history, using only lawful and role-relevant questions.',
      'safeguarding',true,false,true,'{}'::text[],40,'active',v_actor
    ),
    (
      v_org,'SRC-005','Safeguarding Scenario / Boundary Evidence',
      'Confirm interview or demonstration evidence that the candidate understands child safety, reporting duties, professional boundaries and the expectation to escalate concerns rather than investigate them personally.',
      'safeguarding',true,false,true,'{}'::text[],50,'active',v_actor
    ),
    (
      v_org,'SRC-006','External Background / Character / Safeguarding Check',
      'Complete the lawful external background, character, registry or equivalent safeguarding check appropriate and available for the role/current regulatory context. If the required route is unavailable or uncertain, mark Needs Review and escalate rather than treating the absence of a check as clear.',
      'external_check',true,false,true,'{}'::text[],60,'active',v_actor
    ),
    (
      v_org,'SRC-007','Conflict of Interest / Relationship Declaration',
      'Identify relevant conflicts, close relationships or outside interests that could compromise role authority, procurement, supervision, assessment, safeguarding or confidentiality. A disclosed conflict is managed; disclosure alone is not automatic rejection.',
      'conflict',true,false,true,'{}'::text[],70,'active',v_actor
    ),
    (
      v_org,'SRC-008','Candidate Data & Verification Notice',
      'Confirm the candidate has been informed that KNS will process the minimum recruitment data and verification evidence needed for selection, safeguarding and appointment, subject to applicable data-protection requirements.',
      'other',true,false,true,'{}'::text[],80,'active',v_actor
    )
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

  -- PEO-001 Workforce Planning
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-001';

  if v_process is null then raise exception 'PEO-001 registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Convert a real capacity, replacement or capability need into an approved staffing decision before recruitment activity begins.',
    'A vacancy exists or is forecast, enrolment/workload changes, a new campus/function expands, a specialist capability is required, temporary cover is needed, or recurring work is not sustainably owned.',
    '["Active organisation/campus/role structure","Active Role Charter for the proposed role","Current staffing/workload evidence","Need type and rationale","Alternatives considered: redesign, redistribution, development, temporary coverage, technology/process change","Desired start date","Budget/financial reference where applicable"]'::jsonb,
    '["Identify the institutional outcome/work that needs an owner","Check whether the need can be solved by workload redesign, clearer ownership, staff development, temporary coverage or process/technology improvement before adding headcount","Select the actual operating role and location/unit; do not invent a title outside the role architecture","Submit a workforce request with need type, rationale, alternatives and desired date","Competent authority reviews need and Role Charter; School Guardian requests are reserved to Vision Custodian","Approve only when a real need remains; approval creates a governed Draft vacancy","Decline with reason when hiring is not justified","Feed repeated hard-to-fill/critical-role gaps into succession and strategic workforce review"]'::jsonb,
    'Requests should be raised early enough to complete evidence-based selection and safer recruitment before the desired start date. Emergency coverage does not waive safeguarding.',
    '["Workforce request reference","Role/Role Charter","Need rationale","Alternatives considered","Desired start date","Budget/reference if applicable","Approval/decline decision and note"]'::jsonb,
    'KNS hires because responsibility needs a competent owner, not because recruitment became an unplanned reaction or founder-dependent memory task.',
    '["Vision Custodian role → external/company governance","School Guardian need → Vision Custodian decision","Budget authority unresolved → financial governance reference required before commitment","Temporary urgent coverage → controlled interim arrangement but no unsafeguarded child-facing deployment","Need disappears after approval → close vacancy with reason"]'::jsonb,
    '["School Guardian request/role → Vision Custodian","Expansion/network staffing → Vision Custodian","Recurring capacity failure across teams → Institutional Performance review","Budget/financial exception → Finance governance when active"]'::jsonb,
    '["Workforce requests by need type","Approved vs declined requests","Requests with alternatives considered","Time from identified need to approved vacancy","Roles repeatedly reopened","Critical roles with no succession/coverage plan"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_vc,'approver'),
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'participant')
  on conflict do nothing;

  -- PEO-002 Recruitment & Vacancy
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-002';

  if v_process is null then raise exception 'PEO-002 registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Open and manage recruitment only from an approved workforce need, using a vacancy brief tied to the active Role Charter and child-safety expectations.',
    'A PEO-001 workforce request is approved.',
    '["Approved workforce request","Active Role Charter","Role outcomes","Minimum role requirements","Safeguarding statement","Opening/closing dates where used","Lawful sourcing channels/provider references"]'::jsonb,
    '["System creates one Draft vacancy from the approved request","Complete the vacancy brief: clear role title, outcomes, relevant requirements and safeguarding statement","Confirm requirements are necessary and job-relevant; remove irrelevant/discriminatory criteria","If a third-party recruiter is used, verify applicable provider authorisation/licensing and preserve KNS screening/clearance responsibility","Open the vacancy only after the governed brief is complete","Capture candidate applications using minimal necessary contact/application data","Place vacancy On Hold when the underlying need/authority changes rather than continuing uncontrolled recruitment","Close with reason if the role is no longer needed; fill only through a Cleared candidate appointment"]'::jsonb,
    'Vacancy timing is set per staffing need; closing dates cannot precede opening and should allow adequate evidence-based selection unless a justified urgent route is used.',
    '["Workforce request","Vacancy reference and final brief","Role Charter reference","Opening/closing dates","Sourcing/provider reference where applicable","Vacancy hold/close/fill audit events"]'::jsonb,
    'Every open vacancy describes a real KNS role accurately and makes safeguarding expectations visible before candidate selection.',
    '["Role Charter missing → recruitment cannot open","Need/budget withdrawn → vacancy on hold/closed","Third-party recruiter cannot evidence applicable authorisation → do not rely on that provider","Urgent temporary sourcing → selection/clearance controls still apply before unsupervised child-facing work"]'::jsonb,
    '["School Guardian vacancy → Vision Custodian","Provider/licensing uncertainty → qualified Labour/legal review","Safeguarding wording/role risk concern → safeguarding function","Budget change → Finance governance when active"]'::jsonb,
    '["Approved requests converted to governed vacancies","Open vacancies with complete brief","Vacancies put on hold/closed for changed need","Applications per vacancy","Time vacancy remains open","Third-party sourcing exceptions"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_vc,'approver'),
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'participant')
  on conflict do nothing;

  -- PEO-003 Selection & Interview
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-003';

  if v_process is null then raise exception 'PEO-003 registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Determine role suitability from relevant evidence rather than intuition, popularity, hidden scoring or a single interview impression.',
    'A candidate application is captured against an Open/On-Hold governed vacancy.',
    '["Candidate application","Vacancy brief and Role Charter","Screening evidence","Interview evidence","Demonstration evidence where role-appropriate","Builder philosophy / values evidence","Concerns/gaps and evaluator recommendation"]'::jsonb,
    '["Screen application against job-relevant minimum requirements and record competence/fit evidence","Only progress to Interview after evidence-based screening is recorded","Use structured role-relevant questions/scenarios; learner-facing roles should include practical demonstration where useful","Record competence evidence, role-fit evidence, Builder philosophy evidence, concerns/gaps and one of: Progress / Needs More Evidence / Do Not Progress","Do not convert a numerical score into an automatic hiring decision","If evidence supports progression, record Conditional Selection; if evidence conflicts, competent authority records the reasoned decision","Candidate may be Declined or Withdrawn with a professional note","Conditional Selection is explicitly subject to PEO-004 safer-recruitment clearance"]'::jsonb,
    'Selection steps should progress promptly enough to meet the approved staffing need while preserving adequate evidence and candidate communication.',
    '["Screening evaluation","Interview/demonstration evaluation","Evaluator identity/date","Evidence references where applicable","Conditional selection/decline/withdrawal decision note","Stage audit trail"]'::jsonb,
    'KNS can explain why a candidate progressed or did not progress using relevant evidence tied to the role, without relying on hidden scoring or irrelevant personal characteristics.',
    '["Insufficient evidence → Needs More Evidence and gather another relevant assessment","Conflicting evidence → reasoned competent-authority decision","Safeguarding concern disclosed during selection → pause ordinary progression and route appropriately","Candidate withdraws → close application without adverse inference","Reasonable accommodation/access need → adjust assessment method without lowering essential role outcomes"]'::jsonb,
    '["School Guardian candidate/role → Vision Custodian","Safeguarding concern → specialised safeguarding route","Potential discrimination/data-protection concern → qualified legal/data-protection review","Evaluator conflict of interest → replace/independently review evaluation"]'::jsonb,
    '["Applications with completed screening evidence","Interview progression rate","Conditional selections supported by interview/demonstration evidence","Needs More Evidence cases","Declines with reasoned note","Selection cycle time","Repeated evaluation conflicts by role/source"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_vc,'approver'),
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'participant')
  on conflict do nothing;

  -- PEO-004 Safer Recruitment Clearance
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-004';

  if v_process is null then raise exception 'PEO-004 registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Prevent conditional selection from becoming appointment until identity, role claims, references, child-safety/professional-conduct information and appropriate external checks have been reviewed.',
    'A candidate is recorded as Conditionally Selected after PEO-003.',
    '["Conditional-selection record","Current safer-recruitment requirement register","Candidate verification evidence/references","Role risk/context","External check/reference outcomes where applicable","Safeguarding escalation outcome if triggered"]'::jsonb,
    '["Move the conditionally selected application into Clearance; system generates the current controlled clearance requirements for the role","Verify identity/contact information using an appropriate reliable source","Verify the material qualifications/experience claims relied on for selection","Verify an independent reference appropriate to candidate history","Review the candidate safeguarding/professional-conduct declaration and safeguarding scenario/boundary evidence","Complete the lawful external background/character/registry or equivalent safeguarding check appropriate/available for the current role/context","Review relevant conflicts of interest/relationships and candidate data/verification notice","Mark each item Verified, Needs Review, Not Clear or lawfully Waived only when the requirement itself permits waiver","Do not complete clearance while any mandatory control is unresolved or any item is Needs Review/Not Clear","After all controls clear, mark application Cleared","Only then may competent authority convert the candidate into PEO-005/O7 appointment and onboarding"]'::jsonb,
    'Clearance should begin immediately after conditional selection and finish before appointment/unsupervised child-facing deployment. External-check timing follows the issuing authority/provider.',
    '["Generated clearance checklist","Outcome/evidence reference for each item","Reviewer identity/date","Needs Review/Not Clear escalation evidence","Final clearance decision","Cleared application → O7 staff appointment reference"]'::jsonb,
    'No candidate becomes KNS staff through the recruitment pathway until mandatory safer-recruitment controls are resolved and auditable.',
    '["Required external check unavailable/uncertain → Needs Review and safeguarding/legal/regulatory escalation; do not silently Verify","Candidate disputes inaccurate external information → pause final decision and review evidence fairly","Safeguarding information requires restricted handling → preserve minimal recruitment outcome/reference and use specialised restricted case route","Role has no formal certificate requirement → verify relevant experience/competence claims instead","Immediate emergency coverage → supervision/alternative coverage until clearance; no safeguarding waiver by urgency alone"]'::jsonb,
    '["Any Not Clear or unresolved safeguarding concern → School Guardian/designated safeguarding authority","School Guardian candidate → Vision Custodian","Vision Custodian candidate → external/company governance","External check legality/data handling uncertainty → qualified legal/data-protection review","Possible criminal/safeguarding matter → appropriate specialised/external authority route; recruitment staff do not investigate beyond their role"]'::jsonb,
    '["Conditional selections entering clearance","Clearance completion time","Mandatory controls verified","Needs Review / Not Clear counts","Appointments attempted before clearance (target zero)","External-check exceptions","Cleared candidates converted to O7 appointment"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_vc,'approver'),
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'participant')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o13_recruitment_bootstrapped',
    'organisation',v_org,
    jsonb_build_object(
      'activePolicy','PEO-P01',
      'publishedProcesses',jsonb_build_array('PEO-001','PEO-002','PEO-003','PEO-004'),
      'architectureVersion','O13-v1.0',
      'seededWorkforceRequests',0,
      'seededCandidates',0,
      'seededApplications',0,
      'clearanceControls',8,
      'guardrails',jsonb_build_array(
        'Approved need before recruitment',
        'Active Role Charter before vacancy',
        'Evidence-based non-numerical selection',
        'Conditional selection is not appointment',
        'Mandatory safer recruitment clearance',
        'Minimal candidate data and evidence references',
        'No Vision Custodian internal appointment'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o13_recruitment_bootstrapped'
  );
end;
$$;
