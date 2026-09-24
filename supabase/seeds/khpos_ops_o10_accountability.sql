-- KNS O10 Recognition, Corrective Accountability, Grievance & Formal Discipline.
-- This stage keeps positive recognition separate from corrective/formal cases.
-- It does not terminate employment directly and does not convert O4/O8/O9 evidence into automatic punishment.

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
  order by created_at limit 1;

  if v_org is null then raise exception 'KAEC Nigerian Schools organisation not found.'; end if;

  select user_id into v_actor
  from public.organisation_memberships
  where organisation_id=v_org and role='executive' and status='active'
  order by created_at limit 1;

  if v_actor is null then raise exception 'KAEC Nigerian Schools executive membership not found.'; end if;

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
  where organisation_id=v_org and code='PEO-P06';

  if v_policy is null then
    raise exception 'PEO-P06 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Recognise conduct KNS wants repeated and handle accountability, staff grievances and formal discipline through evidence, proportionality, fair opportunity to respond and the actual reporting hierarchy.',
    'All active deployed KNS staff and leaders. Sensitive safeguarding, fraud, criminal reporting, health, whistleblowing or other specialised matters continue through their appropriate restricted processes.',
    '["Recognition and correction serve different purposes and must not be mixed into one score.","Capability gap is not misconduct: where a person does not yet know how, O9 coaching/development remains the first route.","Conduct/accountability concerns are stated specifically against a known policy, standard, commitment or expectation.","No adverse conduct decision is made before the staff member has been told the specific concern/allegation and given a genuine opportunity to respond.","A grievance is a request for institutional review, not proof that the person complained about committed misconduct.","No fixed three-strikes algorithm substitutes for evidence, context, proportionality, contract/policy terms or competent judgment.","O4 issues, O8 availability patterns and O9 performance evidence may inform review but never create automatic disciplinary sanctions.","People should not decide cases in which they are the subject; a matter involving the highest internal authority must use independent external governance."]'::jsonb,
    '["Leaders recognise specific contribution with evidence rather than popularity or vague praise.","Informal corrective accountability may address known conduct/accountability expectations after the staff member has had an opportunity to respond.","Formal disciplinary cases require a clearly stated allegation, applicable standard, response opportunity, evidence and any hearing step required by the applicable contract/policy before a reasoned decision.","Where a grievance names another staff member, that person is not exposed to the complaint as a concluded fact; the competent manager decides when a formal response is required.","A grievance finding does not itself impose discipline; substantiated conduct concerns move to a separate formal disciplinary case with a new notice/response trail.","Outcome acknowledgement records receipt, not agreement.","KHP-OS may record warnings, corrective commitments and a recommendation for separation review; it does not directly terminate employment.","Any recommendation that may lead to suspension affecting pay, dismissal, termination or another high-severity employment consequence requires the applicable contract/legal/authority review outside O10 before execution.","Recognition, corrective cases and formal cases remain auditable and cannot be silently deleted."]'::jsonb,
    '["Direct reporting leader: may recognise staff and open/handle proportionate corrective concerns within their reporting line.","School Guardian: owns whole-school staff accountability, grievance management and formal discipline except cases where the Guardian is the subject.","Vision Custodian: handles material/senior internal cases where competent and is final internal strategic authority, but cannot adjudicate a case about themself.","Staff member subject to a concern: receives the specific concern/allegation, can respond and submit evidence before decision.","Staff member raising grievance: states facts/evidence and desired resolution honestly; may withdraw before final resolution.","Case manager: protects confidentiality, separates allegation from finding, records evidence, follows the configured response/hearing process and gives a reasoned outcome.","Qualified legal/HR/contract reviewer: consulted for high-severity employment consequences or where contract/statutory interpretation is required."]'::jsonb,
    '["Never classify a capability/training gap as misconduct merely because performance is below expectation.","Never decide a corrective/formal case before response is submitted or the recorded response deadline has passed and non-response is documented.","Never use hidden numerical disciplinary scores or automatic sanctions.","Never let a case manager be the staff subject of the case they decide.","Never expose grievance/case information beyond the reporting party, subject when formally notified, competent case manager and other authorised need-to-know participants.","Never use the grievance decision itself as a shortcut to punish a named subject; open a separate disciplinary case where formal conduct action is justified.","Never execute employment separation directly from O10.","Where a formal process or employment contract requires a hearing/panel step, record that step before decision."]'::jsonb,
    '["Immediate safety/safeguarding concern → restricted Safeguarding/Welfare process rather than ordinary O10 case handling.","Suspected fraud/financial impropriety → Finance/Fraud exception route plus competent governance/legal review.","Potential criminal conduct may require external authority/legal handling; O10 does not determine criminal guilt.","Case involving Vision Custodian as subject → independent external governance; no internal self-decision.","Contract/statutory entitlement uncertainty or proposed high-severity employment consequence → qualified legal/HR/contract review before execution.","A staff member declining to acknowledge an outcome does not erase delivery; record delivery and the absence of acknowledgement rather than fabricating consent."]'::jsonb,
    '["Recognition record and specific evidence.","Corrective/formal case reference and stated standard/allegation.","Response request, deadline and staff response/non-response record.","Case evidence and hearing record where required.","Corrective commitment and independent verification.","Grievance evidence and reasoned resolution.","Decision/outcome record and delivery/acknowledgement trail.","Contract/legal/authority review reference for separation recommendation or other high-severity action where required.","Audit history."]'::jsonb,
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

  -- PEO-012 Recognition & Corrective Action
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-012';

  if v_process is null then raise exception 'PEO-012 process registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Reinforce excellent contribution and correct known conduct/accountability deviations early, fairly and proportionately before they become repeated institutional failure.',
    'A reporting leader observes contribution worth reinforcing, or identifies a conduct/accountability deviation that is not primarily a capability gap and does not yet require formal discipline.',
    '["Active staff record and reporting relationship","Specific contribution or concern","Applicable value/policy/standard/known expectation","Concrete evidence/reference","For corrective cases: explanation of why the issue is conduct/accountability rather than unresolved capability","Reasonable response deadline for the concern"]'::jsonb,
    '["For recognition: record the specific contribution, category and evidence; recognition remains separate from numerical staff rating","For corrective concern: state the exact conduct/accountability concern and known expectation","Give the staff member the recorded concern and a genuine opportunity to respond before deciding action","Review the response and specific evidence; if evidence does not support the concern, record no action and close appropriately","Where proportionate correction is needed, define an expectation reset, documented reminder, conduct commitment or monitoring action with owner, due date and evidence of change","Staff member executes and submits evidence; reporting leader independently verifies or reopens the action","Resolve/close only when active corrective commitments are verified/cancelled","If evidence indicates formal discipline is required, refer the case but start a separate formal disciplinary case with a fresh specific allegation/response trail"]'::jsonb,
    'Recognition should be timely. Material corrective concerns should be stated promptly after reliable facts are available; response deadlines are set deliberately for the circumstances rather than hard-coded as a universal statutory period.',
    '["Recognition reference/evidence","Corrective case notice and standard","Staff response/non-response record","Case evidence","Corrective commitment and verification","Resolution/closure history"]'::jsonb,
    'Strong conduct is visibly reinforced; ordinary accountability deviations are corrected without humiliation, arbitrary punishment or founder intervention.',
    '["Capability/training gap → O9 Staff Performance & Development","Serious misconduct/formal sanction may be warranted → PEO-013","Safeguarding/fraud/criminal/safety concern → specialised route","No competent internal manager because highest authority is the subject → external governance"]'::jsonb,
    '["Corrective cases awaiting response","Open corrective commitments","Overdue corrective commitments","Corrective actions independently verified","Cases referred to formal discipline","Evidence-based recognitions issued/withdrawn"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'owner'),
    (v_process,v_si,'owner'),
    (v_process,v_sp,'owner'),
    (v_process,v_teacher,'participant'),
    (v_process,v_facilitator,'participant'),
    (v_process,v_vc,'approver')
  on conflict do nothing;

  -- PEO-013 Staff Grievance & Formal Discipline
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-013';

  if v_process is null then raise exception 'PEO-013 process registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Give staff a safe institutional grievance route and ensure formal disciplinary decisions use specific notice, evidence, response opportunity, competent authority and proportionate outcome.',
    'A staff member raises a grievance, or evidence justifies moving a conduct concern into formal discipline.',
    '["For grievance: reporting staff member, facts, evidence and desired resolution; named subject only where relevant","For discipline: active subject staff, specific allegation, applicable policy/standard/expectation, evidence, response deadline, source case/reference where applicable","Applicable contract/policy requirements including whether a hearing/panel step is required","Authority/legal review reference where a proposed outcome may lead to high-severity employment consequences"]'::jsonb,
    '["GRIEVANCE: staff member records facts and desired resolution; competent manager acknowledges and reviews evidence","Where a grievance formally names another staff member and their response is needed, issue the specific concern and response deadline before resolution","Record grievance outcome as upheld, partially upheld, not upheld, resolved by agreement or referred to another process; a grievance outcome does not itself discipline the subject","If grievance evidence justifies conduct proceedings, start a separate formal disciplinary case","FORMAL DISCIPLINE: issue the specific allegation and relevant standard to the subject with a deliberate response deadline","Receive the staff response, or only after deadline passes record non-response and prior notice/reminder","Collect/review specific evidence; do not substitute O4/O8/O9 status for proof of misconduct","Where the applicable policy/contract requires a hearing or panel, record the hearing after the response opportunity","Competent manager records a reasoned outcome: no action, proportionate corrective action, written/final warning, other proportionate action, or recommendation for separation review","A separation recommendation requires a contract/legal/authority review reference and does not terminate employment in O10","Deliver the outcome; staff may acknowledge receipt without being treated as agreeing","Close the case only when linked corrective commitments are verified/cancelled or the matter has been cleanly referred to its next governed process"]'::jsonb,
    'Grievances are acknowledged promptly. Formal response/hearing/decision dates follow the applicable contract/policy and case circumstances; KHP-OS does not invent a universal statutory deadline.',
    '["Case record and restricted audit trail","Specific allegation/statement and relevant standard","Response request/deadline and response/non-response record","Evidence relied upon","Hearing record where configured","Reasoned grievance/disciplinary outcome","Outcome delivery/acknowledgement","Corrective commitments and verification","Authority/legal review reference for separation recommendation"]'::jsonb,
    'Staff can raise concerns without informal suppression; formal discipline is defensible, auditable and separated from personality, rumour, retaliation or automatic scoring.',
    '["Vision Custodian is the grievance/discipline subject → independent external governance","Safeguarding/fraud/criminal/safety issue → specialised restricted/external route","High-severity employment consequence → qualified contract/legal/authority review before execution","No active staff record or reporting authority → People/Governance structure must be corrected first"]'::jsonb,
    '["Open grievances by stage","Cases awaiting staff response","Formal cases with hearing step overdue where configured","Formal outcomes by category","Cases referred to specialised/external process","Separation recommendations with required authority review reference","Cases closed without outstanding corrective commitments"]'::jsonb,
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
    v_org,v_actor,'ops_o10_accountability_engine_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'activePolicy','PEO-P06',
      'publishedProcesses',jsonb_build_array('PEO-012','PEO-013'),
      'architectureVersion','O10-v1.0',
      'seededRecognitions',0,
      'seededCases',0,
      'guardrails',jsonb_build_array(
        'No automatic sanctions from O4/O8/O9',
        'Capability remains O9',
        'Specific notice and response before adverse conduct decision',
        'Grievance decision is not automatic discipline',
        'No direct employment termination in O10',
        'Vision Custodian self-case requires external governance'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o10_accountability_engine_bootstrapped'
  );
end;
$$;
