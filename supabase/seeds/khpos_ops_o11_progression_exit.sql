-- KNS O11 Staff Progression, Succession, Exit & Handover.
-- O11 transfers responsibility without creating automatic promotion, automatic separation
-- or a duplicate payroll/legal entitlement engine.

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
  where organisation_id=v_org and code='PEO-P07';

  if v_policy is null then
    raise exception 'PEO-P07 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Build a leadership pipeline, move capable people into greater responsibility without abandoning their previous work, and ensure every staff exit transfers responsibility, knowledge, records and controlled access cleanly.',
    'All active deployed KNS staff, succession planning, promotion into KNS operating roles, resignation/retirement notices, contract completion and other institutionally authorised exits. Contract, payroll, statutory entitlement and company-governance determinations remain outside the authority of this workflow.',
    '["Succession is institutional risk management and staff development, not a promise or entitlement to promotion.","Promotion is an evidence-based human decision about readiness for a defined role; tenure, popularity, one exam result, one KPI or one numerical score cannot promote a person automatically.","A staff member must knowingly accept a proposed promotion before it is internally approved or executed.","Every promotion has two responsibilities: prepare the person for the new role and prevent the old role from becoming ownerless.","The active target Role Charter and reporting line define the job being accepted; title alone does not.","Exit is a responsibility-transfer process, not just removal from payroll or a goodbye message.","Notice periods, final pay, benefits, redundancy entitlement, payment in lieu and the legal validity of a termination come from the applicable contract/law/qualified review, not from KHP-OS calculations.","Organisation access closes at the governed exit execution point; the underlying user account is not deleted by O11.","Vision Custodian appointment, succession or exit is a company-governance matter and cannot be internally executed by the school workflow."]'::jsonb,
    '["Succession candidates may be tracked as Exploring, Developing, Ready With Support, Ready Now or Not Ready; readiness must be explained with evidence and development priorities.","Standard promotion follows the actual reporting path to a higher role. Cross-functional movement is a deployment/reassignment decision and must not be disguised as promotion.","A School Guardian promotion is reserved to the Vision Custodian. A Vision Custodian appointment may be tracked for succession risk but requires external/company governance for appointment.","Promotion requires staff acceptance, at least one specific readiness evidence item, an active target Role Charter, a valid target supervisor and a named continuity recipient for the previous responsibility.","Promotion does not execute before the approved effective date or while mandatory handover/readiness requirements remain unverified/unwaived.","O9 performance/development and O10 recognition/accountability may supply evidence, but neither automatically promotes or removes a person.","Staff may submit their own resignation or retirement notice into O11. Recording the notice is not an app-generated ruling on legal validity, notice adequacy or whether withdrawal must be accepted.","Institution-led exits require the applicable contract/agreement/authority reference. Dismissal exit requires a formal O10 separation-review outcome for the same staff member plus the applicable authority/legal review reference.","Exit clearance covers responsibility handover, institutional records, assets/property, Finance/Admin clearance reference, knowledge capture, controlled documents and access closure.","Final exit execution ends active KNS operating-role assignments and the organisation membership only after mandatory pre-exit clearance is verified/waived and the recorded last day has arrived.","Any cancelled acknowledged exit requires a documented authority/agreement reference; the audit history remains intact."]'::jsonb,
    '["Vision Custodian: sponsors leadership pipeline, approves School Guardian progression, receives strategic succession risk, and escalates Vision Custodian succession/exit to company governance.","School Guardian: owns succession bench for campus roles, promotion readiness/approval below School Guardian, exit continuity, clearance and replacement visibility.","Inspectors and Sectional Promoters: provide role-readiness evidence, handover context and continuity support through their reporting line; they do not unilaterally promote staff.","Staff member: responds to promotion proposals, completes agreed transition requirements, submits valid evidence, and provides accurate exit/handover information when leaving.","Finance/Admin: provides the external clearance/reference for financial and administrative obligations; KHP-OS does not calculate amounts.","Receiving/continuity owner: receives responsibilities, records, risks and context and confirms the handover through the governed evidence trail.","Qualified legal/HR/company governance: determines contract/statutory/high-severity or Vision Custodian matters that exceed the school workflow."]'::jsonb,
    '["Do not promise promotion merely because a staff member appears on a succession bench.","Do not promote a staff member without their recorded acceptance.","Do not promote from a fake KPI, hidden score, popularity vote or founder preference without specific role-readiness evidence.","Do not execute promotion if the target role lacks an active Role Charter or reporting-line owner.","Do not execute promotion until the former responsibility has a named continuity recipient and mandatory transition work is verified/waived.","Do not use O11 to calculate notice periods, final pay, benefits, pension, redundancy or statutory entitlements.","Do not mark a resignation as rejected merely because management dislikes the timing; record the notice and route contract/legal questions appropriately.","Do not execute dismissal exit without the formal O10 separation-review trail and required authority/legal reference.","Do not delete an auth user account as an exit shortcut.","Do not allow Vision Custodian appointment or exit to be self-approved through internal O11."]'::jsonb,
    '["Emergency safeguarding/security action may require immediate access suspension through the appropriate safeguarding/security/admin route before ordinary exit clearance finishes; the later employment/exit record must still be reconciled correctly.","A transition requirement may be formally waived only by competent People authority with a documented reason; system access closure at exit is not manually waivable because it is executed by the finalisation control.","A staff-submitted exit request may be withdrawn before institutional clearance begins; after acknowledgement, cancellation requires documented authority/agreement rather than an informal delete.","A succession plan may be withdrawn or archived without adverse employment meaning; it records planning status, not a right or disciplinary conclusion."]'::jsonb,
    '["Promotion to School Guardian → Vision Custodian.","Promotion/appointment to Vision Custodian → external/company governance.","Unresolved continuity or handover gap → School Guardian; strategic leadership vacancy → Vision Custodian.","Contract, notice, final-pay, redundancy, dismissal or entitlement uncertainty → qualified HR/legal/Finance/Admin review as applicable.","Urgent security/safeguarding access risk → designated security/safeguarding/platform-admin route immediately; do not wait for normal exit workflow.","Repeated inability to produce successors for critical roles → Institutional Performance/strategic review because this is a system risk, not only a staffing issue."]'::jsonb,
    '["Succession plan, readiness state, evidence and development priorities.","Promotion case, staff acceptance, approval, target Role Charter/reporting-line evidence, continuity recipient and transition requirements.","Historical old/new role assignments and reporting-line audit trail.","Exit notice/agreement/contract/authority reference and recorded last day.","Handover, records, asset, Finance/Admin, knowledge and document-control clearance evidence.","System-generated access/assignment closure evidence.","Cancellation/withdrawal reasons and references where applicable.","Staff transition events and audit history."]'::jsonb,
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
    (v_policy,v_teacher,'mandatory'),
    (v_policy,v_facilitator,'mandatory')
  on conflict do nothing;

  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-014';

  if v_process is null then
    raise exception 'PEO-014 process registration is missing.';
  end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Develop successors for critical responsibility and execute promotion only when role readiness, authority, staff acceptance, reporting line and continuity handover are all explicit.',
    'A role has succession risk, a staff member demonstrates potential for greater responsibility, a campus expansion creates a leadership need, or management is considering promotion into a higher role.',
    '["Active deployed staff record and current operating-role assignment","Target higher role in the actual reporting path","Active target Role Charter","Readiness evidence and development priorities","Staff acceptance","Competent promotion authority","Target supervisor assignment","Named continuity recipient for the current responsibility","Approved effective date"]'::jsonb,
    '["Maintain a succession bench for material/critical roles with evidence-based readiness states and development priorities","Add specific evidence rather than a single promotion score; completed O9 reviews or active O10 recognition may be referenced but do not decide the outcome automatically","Open a promotion case only for a genuine higher role in the staff member''s reporting path","Give the staff member the proposed role, readiness rationale and effective date; record acceptance or decline","Competent authority reviews evidence; School Guardian progression is reserved to Vision Custodian and Vision Custodian appointment remains external governance","Before approval, confirm an active target Role Charter, valid target supervisor and named continuity recipient for the current responsibility","Create and complete the current-role handover plus target-role readiness requirements","Execute the promotion on/after the approved effective date; end the old primary role assignment, preserve its history, create the new assignment/reporting line and update the staff record","Mark a linked succession plan achieved only when the role transition is actually executed","Review succession coverage after the move so the pipeline does not create a new uncovered role"]'::jsonb,
    'Succession is reviewed at least termly for critical roles and before planned expansion. Promotion effective dates are explicit; execution occurs only on/after that date when all mandatory transition gates are complete.',
    '["Succession plan and readiness review","Progression evidence","Staff acceptance/decline","Promotion approval and authority","Target Role Charter/reporting line","Continuity recipient","Verified/waived transition items","Old and new role-assignment IDs","Promotion audit event"]'::jsonb,
    'KNS develops leaders before vacancies become crises, promotions are defensible and accepted, and greater responsibility never leaves the former responsibility silently ownerless.',
    '["Cross-functional move rather than higher role → separate deployment/reassignment decision","Target Vision Custodian → external/company governance","Target Role Charter or supervisor missing → block execution and correct Governance/People structure","Staff declines promotion → case closes as declined without adverse performance meaning","Continuity recipient unavailable before effective date → delay execution or establish a valid alternative; do not abandon the old responsibility"]'::jsonb,
    '["School Guardian progression → Vision Custodian","Vision Custodian succession/appointment → external/company governance","Critical-role succession gap → School Guardian then Vision Custodian strategic review","Repeated lack of internal candidates → workforce planning/recruitment and development response rather than forced promotion"]'::jsonb,
    '["Critical roles with active succession coverage","Ready Now / Ready With Support candidates","Succession plans overdue for review","Promotion cases awaiting staff response","Approved promotions blocked by incomplete handover","Executed promotions with verified continuity handover","Leadership roles filled internally over time without weakening quality standards"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes
  set status='active',updated_at=now()
  where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_vc,'approver'),
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'participant'),
    (v_process,v_teacher,'participant'),
    (v_process,v_facilitator,'participant')
  on conflict do nothing;

  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-015';

  if v_process is null then
    raise exception 'PEO-015 process registration is missing.';
  end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'End a staff member''s KNS operating relationship without losing responsibilities, records, assets, institutional knowledge or access control.',
    'A staff member submits resignation/retirement notice, a contract reaches its planned end, a documented mutual/redundancy/termination decision is made, or a formal disciplinary separation recommendation reaches the applicable authority/legal decision.',
    '["Active staff record and operating-role assignment","Exit type and proposed last day","Notice/agreement/contract/authority basis reference","For high-severity institution-led exit: required legal/contract/authority review reference","For dismissal: formal O10 separation-review case for the same staff member","Named continuity recipient","Applicable external Finance/Admin clearance evidence","Any role-specific safeguarding/confidential-record handover requirements"]'::jsonb,
    '["Record the exit basis and last day without inventing notice/pay calculations","Staff may submit resignation/retirement notice directly; People authority acknowledges the notice/basis and starts clearance rather than treating ordinary workflow as permission to resign","Name an active continuity recipient before clearance begins","Move staff status to Exiting and create the mandatory transition requirements","Complete responsibility/open-commitment handover, institutional records transfer, asset/property clearance, Finance/Admin reference, knowledge capture and controlled exit documentation","Add any extra role-specific requirement needed for safeguarding, exams, finance, data or other sensitive responsibility","Staff submits evidence for owned transition requirements; People authority independently verifies or formally waives with reason","Do not finalize before the recorded last day or while mandatory pre-exit requirements remain unresolved","At finalization, end active KNS operating-role assignments/reporting links/backups for the staff member, end organisation membership, preserve the auth user account and automatically verify the access-closure control","Close the administrative exit record after execution; use the captured knowledge/replacement signal in workforce and succession planning"]'::jsonb,
    'The recorded last day follows the applicable contract/agreement/qualified decision, not a universal KHP-OS formula. Handover/clearance milestones should finish before that day whenever reasonably possible.',
    '["Exit case and basis reference","Authority/legal review reference where required","O10 separation-review link for dismissal","Continuity recipient assignment","Verified/waived clearance items and evidence","External Finance/Admin clearance reference","Ended role assignments/reporting/backups","Ended organisation membership","System access-closure evidence","Knowledge capture and exit audit history"]'::jsonb,
    'A staff departure does not create hidden work, missing records, unreturned assets, lingering KNS access or founder-dependent recovery.',
    '["Urgent safeguarding/security risk → immediate restricted security/safeguarding access action may precede normal exit completion","Vision Custodian exit → external/company governance","Contract/notice/final-pay/entitlement dispute → qualified HR/legal/Finance review; KHP-OS records the reference but does not adjudicate","Exit request withdrawn before clearance starts → staff may withdraw with reason; after acknowledgement → documented cancellation authority/agreement required","Continuity recipient becomes unavailable → replace the recipient and re-verify affected handover before finalization"]'::jsonb,
    '["Ordinary staff exit continuity gap → School Guardian","School Guardian exit → Vision Custodian","Vision Custodian exit → external/company governance","Legal/contract/entitlement uncertainty → qualified HR/legal/Finance/Admin","Unresolved safeguarding/confidential records → Safeguarding Lead/School Guardian through restricted route","Access closure failure → platform/security administrator immediately"]'::jsonb,
    '["Open exit cases by stage","Exit cases with named continuity recipient","Mandatory clearance completed before last day","Overdue handover/clearance items","Departures finalized with no active KNS operating assignment/membership left behind","Roles requiring replacement after exit","Exit learning/knowledge records captured","Access-closure exceptions"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes
  set status='active',updated_at=now()
  where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_vc,'approver'),
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'participant'),
    (v_process,v_teacher,'participant'),
    (v_process,v_facilitator,'participant')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o11_progression_exit_bootstrapped',
    'organisation',v_org,
    jsonb_build_object(
      'activePolicy','PEO-P07',
      'publishedProcesses',jsonb_build_array('PEO-014','PEO-015'),
      'architectureVersion','O11-v1.0',
      'seededSuccessionPlans',0,
      'seededPromotionCases',0,
      'seededExitCases',0,
      'guardrails',jsonb_build_array(
        'Succession is not a promotion promise',
        'No automatic promotion from scores',
        'Staff acceptance before promotion',
        'Continuity handover before role change or exit',
        'No KHP-OS notice/final-pay calculation',
        'No auth-user deletion on exit',
        'Vision Custodian succession/exit requires external governance'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o11_progression_exit_bootstrapped'
  );
end;
$$;
