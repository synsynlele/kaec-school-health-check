-- KNS O12 Academic Planning & Delivery Control.
-- KSI/SIS remain source systems for lesson intelligence and timetable/transaction records.
-- KHP-OS governs the execution chain: planned -> delivered -> verified -> recovered.

do $$
declare
  v_org uuid;
  v_actor uuid;
  v_vc uuid;
  v_sg uuid;
  v_ai uuid;
  v_sp uuid;
  v_teacher uuid;
  v_policy uuid;
  v_process uuid;
  rec record;
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
  where organisation_id=v_org and role='executive' and status='active'
  order by created_at
  limit 1;

  if v_actor is null then
    raise exception 'KNS executive membership not found.';
  end if;

  select id into v_vc from public.khpos_ops_roles where organisation_id=v_org and code='VISION_CUSTODIAN';
  select id into v_sg from public.khpos_ops_roles where organisation_id=v_org and code='SCHOOL_GUARDIAN';
  select id into v_ai from public.khpos_ops_roles where organisation_id=v_org and code='ACADEMIC_INSPECTOR';
  select id into v_sp from public.khpos_ops_roles where organisation_id=v_org and code='SECTIONAL_PROMOTER';
  select id into v_teacher from public.khpos_ops_roles where organisation_id=v_org and code='TEACHER';

  if v_vc is null or v_sg is null or v_ai is null or v_sp is null or v_teacher is null then
    raise exception 'Required KNS academic operating roles are missing.';
  end if;

  -- ACD-P01 v2: richer source-system and execution boundary.
  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='ACD-P01';

  if v_policy is null then raise exception 'ACD-P01 registration missing.'; end if;

  update public.khpos_ops_policy_versions
  set status='superseded'
  where policy_id=v_policy and status='active' and version<2;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,2,
    'Ensure the approved curriculum becomes visible, prepared, delivered and independently verified learning activity, with any lost or weak delivery converted into owned academic debt until recovered.',
    'Term academic planning, curriculum/scheme references, teacher deployment reference, weekly curriculum targets, lesson readiness, HQLS delivery, verification and recovery across KNS. KSI remains the lesson/scheme intelligence source and SIS remains the timetable/transaction system where used.',
    '["Planned is not Delivered; Delivered is not Verified.","KHP-OS records execution references and outcomes, not duplicate KSI lesson content or a second timetable.","Every delivery stream must point to an approved scheme source and timetable/deployment reference.","The assigned teacher owns preparation and honest delivery status; academic leaders own independent monitoring and verification.","Partial, missed or rejected delivery becomes academic debt and stays visible until recovery evidence is independently verified.","Academic leadership manages exceptions and recovery, not paperwork completion alone."]'::jsonb,
    '["Each term has a governed execution baseline before routine delivery begins.","Every class/subject delivery stream identifies the active Teacher assignment, approved scheme reference, timetable reference and expected teaching weeks.","Weekly targets are concise execution references to the approved scheme; KHP-OS does not copy full lesson plans or scheme content from KSI.","A lesson target is marked Ready only with an approved preparation reference such as a KSI lesson or other approved lesson record.","Teachers record full, partial or missed delivery truthfully with evidence/reference where applicable.","Full delivery remains Unverified until reviewed by Sectional Promoter, Academic Inspector, School Guardian or authorised executive authority; a delivering teacher cannot verify their own delivery.","Partial/missed delivery or rejected verification creates academic debt with cause, severity, owner and recovery workflow.","Academic debt closes only after recovery evidence is submitted by the owner and independently verified.","KSI aggregate fidelity may inform monitoring but cannot replace the target-level KHP-OS execution record or independently verify a delivery target."]'::jsonb,
    '["Vision Custodian: sees strategic academic health and material exceptions; does not become the routine lesson checker.","School Guardian: accountable for whole-school academic execution, approves/oversees the academic operating baseline and resolves major blockers.","Academic Inspector: owns curriculum/scheme governance, term academic planning, teacher deployment control, quality monitoring and academic-debt visibility.","Sectional Promoter: monitors section delivery, independently verifies delivery/recovery, records teaching observations and escalates unresolved debt.","Teacher: prepares the assigned target, records actual delivery accurately, owns assigned recovery work and provides evidence.","KSI: source of lesson/scheme/diagnostic intelligence within its own governed product.","SIS/third-party school software: source of timetable/transactional records where applicable; KHP-OS stores the governing reference and execution exception only."]'::jsonb,
    '["Do not mark a target delivered merely because the week ended or a scheme box was ticked.","Do not let a teacher verify their own delivery or recovery evidence.","Do not copy full KSI lesson content into KHP-OS as a shadow lesson system.","Do not rebuild the school timetable in KHP-OS; store the approved timetable/deployment reference and manage exceptions.","Do not delete or hide academic debt because the term is uncomfortable or behind schedule.","Do not treat a recovery plan as recovery completion; evidence and independent verification are required.","Do not convert KSI aggregate fidelity into an automatic teacher score, sanction or promotion decision."]'::jsonb,
    '["If KSI is unavailable, use another approved lesson/scheme reference and record the source; KHP-OS execution controls still apply.","If SIS/timetable software is unavailable, a controlled timetable/deployment reference may be recorded manually until the source system is restored.","Emergency closure, security event or approved whole-school disruption may create bulk academic debt; recovery ownership and dates must still be established instead of silently rewriting the plan.","A teacher reassignment during term requires the delivery stream to be formally updated in a later governed deployment workflow; historical delivery evidence must remain attributable to the original actor."]'::jsonb,
    '["Unprepared/blocked lesson → Teacher to Sectional Promoter.","Repeated or material curriculum debt → Sectional Promoter to Academic Inspector.","Cross-section, staffing or timetable blocker → Academic Inspector to School Guardian.","Whole-school/strategic academic delivery risk → School Guardian to Vision Custodian.","Critical operating exception → Universal Issue Engine using the required severity and reporting route."]'::jsonb,
    '["Academic term baseline","Delivery-stream record with scheme/timetable references","Weekly target record","Lesson readiness reference","Delivery note/evidence reference","Independent verification record","Academic debt and recovery record","Linked issue/escalation where used","Teaching observation/follow-up record","Academic event audit trail"]'::jsonb,
    current_date,(current_date+interval '12 months')::date,
    v_actor,now(),'active'
  )
  on conflict (policy_id,version) do nothing;

  update public.khpos_ops_policies set status='active',updated_at=now()
  where id=v_policy;

  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  values
    (v_policy,v_vc,'mandatory'),
    (v_policy,v_sg,'mandatory'),
    (v_policy,v_ai,'mandatory'),
    (v_policy,v_sp,'mandatory'),
    (v_policy,v_teacher,'mandatory')
  on conflict do nothing;

  -- ACD-P03 v1: teaching quality and monitoring.
  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='ACD-P03';

  if v_policy is null then raise exception 'ACD-P03 registration missing.'; end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Make teaching quality, curriculum progress and recovery visible through proportionate observation and evidence without turning academic monitoring into surveillance or a hidden ranking system.',
    'Lesson/programme monitoring, teaching-quality observation, curriculum progress review, missed-learning recovery and academic exceptions.',
    '["Monitoring exists to protect learner experience and strengthen teaching, not to manufacture a league table of teachers.","Observation is evidence about a specific lesson/practice at a point in time; it is not a diagnosis of character or competence by itself.","Micro, Development and QA observations have different purposes and should be proportionate.","Strengths are recorded alongside improvement areas.","Required improvement action has an owner/date and closes only after follow-up evidence is verified.","Repeated patterns may inform O9 performance/development, but no observation creates automatic discipline."]'::jsonb,
    '["Sectional Promoters and Academic Inspector monitor delivery exceptions and sample teaching quality.","Observation records identify concrete evidence, strengths, improvement area and required follow-up where needed.","Observed teachers can see and respond to assigned follow-up through evidence.","The observed teacher cannot verify their own follow-up.","Academic debt is reviewed by age, cause, section/subject pattern and recovery status rather than only by total count.","KHP-OS may escalate a material academic-debt record into the Universal Issue Engine; this does not create a disciplinary case automatically.","Any conduct concern requiring accountability must use the separate O10 process with its notice/response/evidence safeguards."]'::jsonb,
    '["School Guardian: oversees whole-school quality trends and material academic exceptions.","Academic Inspector: owns teaching-quality framework, monitoring rhythm and systemic improvement.","Sectional Promoter: conducts proportionate monitoring/observations, verifies recovery and supports teachers.","Teacher: participates in observation, submits required follow-up evidence and uses feedback for improvement.","Vision Custodian: reviews strategic patterns and institutional risks, not routine observation notes."]'::jsonb,
    '["Never publish teacher rankings from observation records.","Never use a single observation, KSI aggregate or curriculum-debt count as an automatic disciplinary trigger.","Never let an observer fabricate delivery evidence on behalf of the teacher.","Never close academic debt without recovery evidence and independent verification.","Never confuse learner misunderstanding with teacher misconduct; diagnose the operational/teaching issue before routing to People accountability."]'::jsonb,
    '["Safeguarding/professional-boundary concern observed during teaching → stop ordinary quality workflow and use restricted safeguarding route.","Immediate safety/facility blocker → Universal Issue Engine/campus-safety route first; academic recovery follows after safety is stabilised.","Where no follow-up action is required, observation may close as an evidence record without manufacturing a task."]'::jsonb,
    '["Repeated teaching-quality gap → Academic Inspector and O9 coaching/development where appropriate.","Persistent academic debt → Academic Inspector then School Guardian.","Strategic/systemic curriculum-delivery failure → School Guardian to Vision Custodian.","Safeguarding or serious conduct concern → specialised restricted process, not academic observation workflow."]'::jsonb,
    '["Observation record and evidence","Follow-up action/evidence where required","Curriculum progress dashboard","Academic debt/recovery register","Linked operational issue/escalation where used","Term/section monitoring review"]'::jsonb,
    current_date,(current_date+interval '12 months')::date,
    v_actor,now(),'active'
  )
  on conflict (policy_id,version) do nothing;

  update public.khpos_ops_policies set status='active',updated_at=now()
  where id=v_policy;

  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  values
    (v_policy,v_vc,'mandatory'),
    (v_policy,v_sg,'mandatory'),
    (v_policy,v_ai,'mandatory'),
    (v_policy,v_sp,'mandatory'),
    (v_policy,v_teacher,'mandatory')
  on conflict do nothing;

  -- Academic execution tools.
  insert into public.khpos_ops_tool_templates(
    organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by
  ) values
    (
      v_org,'ACD-T01','Academic Term & Delivery Stream Register','register',
      'Record the governed academic term plus each class/subject execution stream without duplicating the source scheme or timetable.',
      '{"fields":["session","term","campus","class","section","subject","teacherAssignment","schemeSource","schemeReference","timetableReference","expectedWeeks","status"]}'::jsonb,
      'active',v_actor
    ),
    (
      v_org,'ACD-T02','Weekly Curriculum Target & Delivery Record','record',
      'Track planned weekly learning through readiness, actual delivery and independent verification.',
      '{"states":["planned","ready","in_progress","delivered","recovery_required","recovered"],"evidence":["readinessReference","deliveryReference","verificationReference"]}'::jsonb,
      'active',v_actor
    ),
    (
      v_org,'ACD-T03','Academic Debt & Recovery Register','register',
      'Keep missed, partial or rejected learning visible until recovery is independently verified.',
      '{"fields":["debtType","causeCategory","causeNote","severity","owner","recoveryPlan","dueDate","status","evidenceReference","linkedIssue"]}'::jsonb,
      'active',v_actor
    ),
    (
      v_org,'ACD-T04','Teaching Quality Observation Record','record',
      'Capture proportionate Micro, Development or QA observation evidence and any verified follow-up.',
      '{"types":["micro","development","qa"],"fields":["strengths","improvementArea","requiredAction","actionDueDate","followUpStatus","evidenceReference"]}'::jsonb,
      'active',v_actor
    ),
    (
      v_org,'ACD-T05','Academic Delivery Monitoring Dashboard','dashboard',
      'Show planned/verified delivery, academic debt, overdue recovery and open teaching-observation follow-up without creating a teacher ranking.',
      '{"indicators":["plannedTargets","verifiedTargets","openDebt","overdueDebt","openObservationFollowUp"]}'::jsonb,
      'active',v_actor
    )
  on conflict (organisation_id,code) do update
    set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,
        schema_definition=excluded.schema_definition,status='active',updated_at=now();

  -- Publish ACD-001..009. Existing ACD-004 and ACD-009 move to v2.
  for rec in
    select *
    from (
      values
      (
        'ACD-001',1,
        'Govern the approved curriculum/scheme baseline as a source reference before delivery begins.',
        'New session/term, curriculum revision, subject/class change or approved scheme update.',
        '["Approved curriculum/scheme source","Class/subject scope","Scheme reference/version","Academic authority"]'::jsonb,
        '["Confirm the authoritative curriculum/scheme source","Record only the governing reference/version in KHP-OS","Confirm class/subject scope and responsible academic owner","Reject obsolete/unapproved references","Preserve historical version/reference when the baseline changes"]'::jsonb,
        'Before the relevant delivery stream is approved.',
        '["Approved scheme/source reference","Version/date where applicable","Approval/audit record"]'::jsonb,
        'Every delivery stream can prove which approved curriculum/scheme it is executing without duplicating the source content.',
        '["Scheme source unavailable → temporary controlled manual/external reference","Conflicting scheme versions → Academic Inspector resolves before delivery","Material curriculum change mid-term → publish/record the new reference without rewriting historical delivery"]'::jsonb,
        '["Unresolved source/version conflict → Academic Inspector","Whole-school curriculum change → School Guardian/Vision Custodian as applicable"]'::jsonb,
        '["Streams with approved scheme reference","Obsolete/conflicting references unresolved"]'::jsonb
      ),
      (
        'ACD-002',1,
        'Create the term academic execution baseline before routine teaching begins.',
        'Before a new academic term or material reopening/replan.',
        '["Term dates","Teaching weeks","Classes/subjects","Approved scheme references","Teacher deployment references","Timetable references"]'::jsonb,
        '["Open the academic term record","Create class/subject delivery streams","Confirm assigned Teacher role","Reference approved scheme and timetable","Add weekly execution targets","Approve each ready stream","Activate the term only after at least one approved stream exists"]'::jsonb,
        'Baseline prepared before routine term delivery; unresolved streams remain visible exceptions.',
        '["Academic term record","Delivery-stream register","Weekly targets","Approval events"]'::jsonb,
        'Academic leaders can see what is expected to be delivered, by whom, and from which approved source before execution starts.',
        '["Uncovered subject/class → staffing/deployment exception","Missing scheme/timetable source → stream cannot be approved","Late change → update prospectively and preserve prior audit"]'::jsonb,
        '["Section-level gap → Academic Inspector","Cross-school readiness gap → School Guardian"]'::jsonb,
        '["Streams approved before term activation","Uncovered/unapproved streams","Targets loaded against expected weeks"]'::jsonb
      ),
      (
        'ACD-003',1,
        'Control teacher deployment against the approved timetable without rebuilding the timetable engine.',
        'Term planning, teacher change, uncovered lesson or timetable/deployment change.',
        '["Active Teacher role assignment","SIS/approved timetable reference","Class/subject delivery stream"]'::jsonb,
        '["Verify the Teacher assignment is active","Record the timetable/deployment reference","Confirm the assignment matches the class/subject stream","Use availability/coverage controls for absence exceptions","Preserve historical assignment evidence when deployment changes"]'::jsonb,
        'Before stream approval and whenever deployment materially changes.',
        '["Teacher assignment ID","Timetable/deployment reference","Exception/coverage record where applicable"]'::jsonb,
        'KHP-OS knows who owns academic delivery and which approved timetable reference governs it without becoming a scheduler.',
        '["Teacher unavailable → O8 coverage/availability route","No qualified owner → People/workforce escalation","SIS unavailable → controlled manual reference until restored"]'::jsonb,
        '["Uncovered class/subject → Academic Inspector","Persistent staffing gap → School Guardian/People planning"]'::jsonb,
        '["Streams with active teacher owner","Uncovered delivery streams","Deployment exceptions unresolved"]'::jsonb
      ),
      (
        'ACD-004',2,
        'Ensure each planned lesson/weekly target is genuinely ready before delivery, with preparation evidence/reference and known blockers visible.',
        'Before starting delivery of an assigned weekly curriculum target.',
        '["Approved delivery stream","Weekly target","Approved preparation/lesson reference","Known learner/recovery context"]'::jsonb,
        '["Review the target and approved scheme reference","Prepare using KSI or another approved lesson record","Consider known learner/recovery needs","Record the preparation reference","Mark Ready only when execution can begin","Raise blocker rather than pretending readiness"]'::jsonb,
        'Before the target is started.',
        '["Readiness reference","Optional readiness note","Blocked-work/issue evidence where required"]'::jsonb,
        'Teachers enter delivery with a clear target and preparation evidence; barriers are visible before they become silent missed learning.',
        '["KSI unavailable → use approved alternative preparation reference","Resource/facility/coverage blocker → route operational issue and preserve the academic target"]'::jsonb,
        '["Teacher blocker → Sectional Promoter","Repeated readiness failure → Academic Inspector/O9 development where evidence supports it"]'::jsonb,
        '["Targets marked Ready before start","Readiness blockers resolved","Targets started without readiness"]'::jsonb
      ),
      (
        'ACD-005',1,
        'Record actual HQLS/lesson execution truthfully and distinguish full, partial and missed delivery.',
        'Teacher begins or completes an approved weekly curriculum target.',
        '["Ready target","Assigned Teacher","Delivery evidence/reference","Actual delivery outcome"]'::jsonb,
        '["Start only from Ready state","Deliver the planned learning using the approved teaching standard","Record full delivery with evidence/reference","If partially delivered, record cause and create academic debt","If missed, record cause and create academic debt","Do not self-verify completion"]'::jsonb,
        'Delivery status recorded promptly after the planned learning window.',
        '["Teacher delivery note","Delivery evidence/reference","Partial/missed cause","Academic debt record where applicable"]'::jsonb,
        'The institution sees what really happened—not only what was scheduled.',
        '["Unexpected disruption → record partial/missed honestly","Teacher absence → O8 coverage plus academic debt/recovery","Material safety event → safety route first, academic recovery afterward"]'::jsonb,
        '["Repeated missed delivery → Sectional Promoter/Academic Inspector","Systemic disruption → School Guardian"]'::jsonb,
        '["Full delivery recorded","Partial/missed targets","Academic debt generated from execution exceptions"]'::jsonb
      ),
      (
        'ACD-006',1,
        'Independently monitor delivery against plan and verify evidence without turning monitoring into teacher surveillance.',
        'Delivered target, weekly review or material delivery exception.',
        '["Delivery target/status","Teacher evidence/reference","Approved scheme/timetable reference","Academic debt where present"]'::jsonb,
        '["Review delivered evidence against the target","Verify only when evidence supports full delivery","Reject weak/unsupported delivery and create academic debt","Review partial/missed delivery causes and recovery ownership","Escalate material debt into the Issue Engine where necessary"]'::jsonb,
        'Weekly monitoring rhythm; material exceptions reviewed sooner.',
        '["Verification note/reference","Academic debt record","Linked Issue where escalated"]'::jsonb,
        'Delivered learning is independently validated; unsupported delivery cannot disappear as completed.',
        '["Verifier is the delivering teacher → verification blocked","Evidence unclear → reject/seek recovery rather than guessing","Systemic pattern → Academic Inspector review"]'::jsonb,
        '["Sectional Promoter → Academic Inspector for persistent debt","Academic Inspector → School Guardian for systemic delivery failure"]'::jsonb,
        '["Verified delivered targets","Rejected verification","Open/overdue academic debt"]'::jsonb
      ),
      (
        'ACD-007',1,
        'Recover missed, partial or rejected learning through an owned, dated and independently verified recovery plan.',
        'Partial delivery, missed delivery or rejected delivery verification.',
        '["Academic debt record","Cause/severity","Recovery owner","Target context"]'::jsonb,
        '["Diagnose the operational cause","Set recovery plan and due date","Owner starts recovery","Owner submits completion evidence","Academic monitoring authority independently verifies","Close debt only after verified recovery","Escalate material/overdue debt to the Issue Engine when required"]'::jsonb,
        'Recovery due date set promptly; completion timing follows learner need and term constraints.',
        '["Debt cause","Recovery plan/date","Completion evidence","Independent verification","Linked issue/escalation where used"]'::jsonb,
        'Lost learning remains visible until the institution can prove it has been recovered.',
        '["Recovery owner unavailable → reassign through academic leadership","Whole-school disruption → coordinated recovery plan","Evidence rejected → reopen debt"]'::jsonb,
        '["Overdue debt → Sectional Promoter/Academic Inspector","High/critical debt → Universal Issue Engine","Strategic accumulation → School Guardian"]'::jsonb,
        '["Open academic debt","Overdue debt","Verified recovery","Average recovery age","Repeated cause patterns"]'::jsonb
      ),
      (
        'ACD-008',1,
        'Use proportionate teaching observation to strengthen HQLS/teaching quality with concrete evidence and verified follow-up where needed.',
        'Planned monitoring sample, development need, QA review or follow-up.',
        '["Active delivery stream","Observed Teacher assignment","Observation purpose/type","Specific observed evidence"]'::jsonb,
        '["Choose Micro, Development or QA purpose","Observe specific practice","Record strengths","Record improvement area only where evidenced","Set required action/date only when needed","Teacher submits follow-up evidence","Independent academic authority verifies follow-up","Route performance or conduct concerns to O9/O10 only through their separate safeguards"]'::jsonb,
        'Feedback recorded promptly; any required action has an explicit due date.',
        '["Observation record","Strengths/improvement evidence","Follow-up evidence/reference where required","Verification"]'::jsonb,
        'Teaching quality improves through specific feedback without hidden rankings or automatic discipline.',
        '["Safeguarding concern → restricted safeguarding route","Conduct concern → O10 after evidence/notice safeguards","Capability gap → O9 coaching/development"]'::jsonb,
        '["Repeated instructional gap → Academic Inspector/O9","Serious professional-boundary concern → safeguarding/O10 as applicable"]'::jsonb,
        '["Observation coverage","Open follow-up","Verified follow-up","Repeated systemic teaching-practice themes"]'::jsonb
      ),
      (
        'ACD-009',2,
        'Keep curriculum execution visible against the approved term baseline so debt, delay and recovery ownership are known early.',
        'Continuous execution plus weekly academic review.',
        '["Academic term","Delivery streams","Weekly targets","Verification states","Academic debt/recovery","Observation follow-up"]'::jsonb,
        '["Compare planned targets with delivered/verified states","Review unverified delivery","Review open/overdue academic debt by cause and owner","Review recovery evidence/closure","Review stream/class/subject patterns","Escalate systemic issues rather than nagging individual teachers","Use KSI aggregate signals as context, not as target-level proof"]'::jsonb,
        'Weekly dashboard review and material exception review as needed.',
        '["Academic monitoring dashboard","Debt register","Verification records","Linked issues/escalations","KSI aggregate context where connected"]'::jsonb,
        'Academic leadership knows where learning is on track, where debt exists, who owns recovery and what needs intervention.',
        '["No reliable source data → state limitation explicitly","Repeated debt cluster → root-cause/system review","Observation pattern → O9 development where appropriate"]'::jsonb,
        '["Open debt → Sectional Promoter/Academic Inspector","Systemic trend → School Guardian","Strategic academic risk → Vision Custodian"]'::jsonb,
        '["Planned targets","Verified targets","Open debt","Overdue debt","Recovered targets","Open observation follow-up"]'::jsonb
      )
    ) as x(
      code,version,purpose,trigger,inputs,steps,sla,evidence,
      expected_outcome,exception_conditions,escalation,kpis
    )
  loop
    select id into v_process
    from public.khpos_ops_processes
    where organisation_id=v_org and code=rec.code;

    if v_process is null then
      raise exception 'Academic process registration missing: %',rec.code;
    end if;

    update public.khpos_ops_process_versions
    set status='superseded'
    where process_id=v_process
      and status='active'
      and version<rec.version;

    insert into public.khpos_ops_process_versions(
      process_id,version,purpose,trigger,inputs,steps,sla,evidence,
      expected_outcome,exception_conditions,escalation,kpis,
      effective_date,approved_by,approved_at,status
    ) values (
      v_process,rec.version,rec.purpose,rec.trigger,rec.inputs,rec.steps,
      rec.sla,rec.evidence,rec.expected_outcome,rec.exception_conditions,
      rec.escalation,rec.kpis,current_date,v_actor,now(),'active'
    )
    on conflict (process_id,version) do nothing;

    update public.khpos_ops_processes
    set status='active',updated_at=now()
    where id=v_process;
  end loop;

  -- Process participation.
  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='ACD-001';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values (v_process,v_ai,'owner'),(v_process,v_sg,'approver'),(v_process,v_sp,'participant'),(v_process,v_teacher,'informed'),(v_process,v_vc,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='ACD-002';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values (v_process,v_ai,'owner'),(v_process,v_sg,'approver'),(v_process,v_sp,'participant'),(v_process,v_teacher,'informed'),(v_process,v_vc,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='ACD-003';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values (v_process,v_ai,'owner'),(v_process,v_sg,'approver'),(v_process,v_sp,'participant'),(v_process,v_teacher,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='ACD-004';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values (v_process,v_teacher,'owner'),(v_process,v_sp,'participant'),(v_process,v_ai,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='ACD-005';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values (v_process,v_teacher,'owner'),(v_process,v_sp,'participant'),(v_process,v_ai,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='ACD-006';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values (v_process,v_sp,'owner'),(v_process,v_ai,'approver'),(v_process,v_sg,'informed'),(v_process,v_teacher,'participant')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='ACD-007';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values (v_process,v_teacher,'owner'),(v_process,v_sp,'participant'),(v_process,v_ai,'approver'),(v_process,v_sg,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='ACD-008';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values (v_process,v_sp,'owner'),(v_process,v_ai,'owner'),(v_process,v_teacher,'participant'),(v_process,v_sg,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='ACD-009';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values (v_process,v_ai,'owner'),(v_process,v_sp,'participant'),(v_process,v_sg,'approver'),(v_process,v_vc,'informed')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o12_academic_delivery_bootstrapped',
    'organisation',v_org,
    jsonb_build_object(
      'activePolicies',jsonb_build_array('ACD-P01','ACD-P03'),
      'publishedProcesses',jsonb_build_array(
        'ACD-001','ACD-002','ACD-003','ACD-004','ACD-005',
        'ACD-006','ACD-007','ACD-008','ACD-009'
      ),
      'registeredTools',jsonb_build_array(
        'ACD-T01','ACD-T02','ACD-T03','ACD-T04','ACD-T05'
      ),
      'architectureVersion','O12-v1.0',
      'seededTerms',0,
      'seededStreams',0,
      'seededTargets',0,
      'seededDebt',0,
      'guardrails',jsonb_build_array(
        'Planned is not Delivered',
        'Delivered is not Verified',
        'No duplicate KSI lesson content',
        'No timetable rebuild',
        'Academic debt stays visible until verified recovery',
        'No teacher self-verification',
        'No hidden teacher ranking from observations'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o12_academic_delivery_bootstrapped'
  );
end;
$$;
