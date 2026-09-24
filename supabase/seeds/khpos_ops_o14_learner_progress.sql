-- KNS O14 Learner Progress & Intervention.
-- Activates the learner-risk/intervention processes and the progression policy.
-- No learner records, scores, fees or report cards are duplicated from the SIS.

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
  v_row record;
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
  select id into v_sp from public.khpos_ops_roles where organisation_id=v_org and code='SECTIONAL_PROMOTER';
  select id into v_teacher from public.khpos_ops_roles where organisation_id=v_org and code='TEACHER';

  if v_vc is null or v_sg is null or v_ai is null or v_sp is null or v_teacher is null then
    raise exception 'Required KNS learner-support roles are missing.';
  end if;

  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='LPI-P02';

  if v_policy is null then raise exception 'LPI-P02 policy registration is missing.'; end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Make learner progression decisions from multiple relevant evidence sources, with documented human judgment and required support, rather than from one score or an automatic algorithm.',
    'End-of-term/end-of-year progression, progression with support, retain/reteach, deferred decision, external review and graduation/transition decisions. The SIS remains the authoritative student/result record.',
    '["Progression is a human educational decision supported by evidence, not an automatic score threshold.","A learner is considered through attainment, foundational gaps, trajectory, intervention evidence, attendance implications, readiness and applicable examination requirements.","A difficult term or intervention history does not become a permanent label on the learner.","High-impact decisions require stronger review and parent partnership.","Support obligations travel with the learner when progression is confirmed with unresolved needs.","Financial/fee status is governed separately and is not an academic readiness criterion."]'::jsonb,
    '["Academic Inspector or School Guardian may propose a formal progression decision with the required evidence fields.","Retain/reteach, defer-pending-review and external-review decisions require a recorded parent meeting/partnership reference and School Guardian confirmation.","Progress and progress-with-support decisions must state the learner trajectory and any continuing support required.","KHP-OS records the rationale, decision authority and support implications; the SIS remains the system that records the formal class/result progression.","No AI, KSI diagnosis, single examination result, attendance signal or intervention status automatically changes a learner class or progression outcome."]'::jsonb,
    '["Teacher: supplies current learning evidence and intervention history but does not unilaterally determine progression.","Sectional Promoter: coordinates learner support evidence and term review.","Academic Inspector: owns academic progression review and may propose/confirm standard decisions.","School Guardian: confirms high-impact retain/reteach, defer or external-review decisions and resolves institutional constraints.","Parent/guardian: is engaged on high-impact progression decisions through the parent partnership process; parent opinion is recorded but does not replace the school''s professional duty.","Vision Custodian: sees strategic patterns, not routine individual progression files, unless a separate strategic/institutional escalation requires involvement."]'::jsonb,
    '["Never progress or retain a learner solely from one score/average.","Never let KSI/AI automatically make or confirm a learner-progression decision.","Never use fee/payment status as an academic-readiness criterion.","Never confirm retain/reteach, defer-pending-review or external-review without the required parent-partnership reference and School Guardian confirmation.","Never hide open support needs when confirming progress; record the required support explicitly.","Never treat a progression decision as a medical, psychological or safeguarding diagnosis.","Never overwrite the SIS as the authoritative student/result/class record from KHP-OS."]'::jsonb,
    '["Where an external examination/regulatory rule controls eligibility or transition, record that requirement and follow the applicable authority.","Where a learner has an unresolved safeguarding/welfare matter affecting attendance/readiness, keep sensitive details in the safeguarding route and use only the minimum academic implication here.","Where evidence is materially incomplete, use defer-pending-review instead of inventing certainty."]'::jsonb,
    '["Standard academic progression uncertainty → Academic Inspector.","Retain/reteach/defer/external-review decision → School Guardian confirmation.","Systemic curriculum/teaching pattern affecting multiple learners → Academic Execution/Institutional Performance review.","Safeguarding/welfare concern → protected Safeguarding/Welfare route.","External examination/regulatory uncertainty → competent examination/regulatory authority."]'::jsonb,
    '["Attainment evidence/reference from SIS/approved assessment source.","Foundational-gap and trajectory summary.","Intervention/reassessment record where applicable.","Attendance implication reference where relevant.","Applicable examination requirement summary.","Parent meeting/partnership reference for high-impact decisions.","Decision rationale, confirmer and continuing-support record.","SIS progression/update reference outside KHP-OS where applicable."]'::jsonb,
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
    (v_policy,v_sp,'mandatory'),
    (v_policy,v_teacher,'reference'),
    (v_policy,v_vc,'reference')
  on conflict do nothing;

  for v_row in
    select *
    from (
      values
      (
        'ACD-010',
        'Detect learner-specific academic risk from approved evidence and hand significant concerns into the governed learner-support pathway.',
        'A teacher/leader sees repeated low formative performance, sharp decline, incomplete work, prerequisite gap, academic debt impact, attendance-related academic risk, behaviour interference or another credible learning signal.',
        '["Minimal KHP learner anchor linked to the SIS/external learner ID","Approved signal evidence/reference","Current class/section context","Academic term/stream where relevant","O12 academic-debt record where relevant"]'::jsonb,
        '["Select the learner anchor rather than creating a duplicate student record","Record one specific signal, evidence source, observation date and amber/red/critical severity","Amber may receive an immediate teacher-level response and evidence","Red/critical or unresolved significant concern is handed to ACD-011/LPI structured support","Do not classify safeguarding/welfare disclosures as ordinary academic risk"]'::jsonb,
        'Record the signal promptly after reliable evidence is available; do not wait for end-of-term results when an actionable pattern is already visible.',
        '["Risk signal reference","Source/evidence reference","Severity","Reporter","Quick response evidence for resolved amber signal","Linked structured case for red/critical or escalated concern"]'::jsonb,
        'Academic risk becomes visible early and enters the correct response level without turning one signal into a permanent learner label.',
        '["Single weak result without a meaningful pattern → continue ordinary teaching/monitoring","Safeguarding/welfare concern → protected safeguarding route","Class-wide delivery problem → O12 academic delivery/debt response as well as any learner-specific signal"]'::jsonb,
        '["Amber unresolved/repeated → Sectional Promoter","Red → Sectional Promoter/Academic Inspector","Critical learning-support case → Academic Inspector/School Guardian","Systemic pattern → Institutional Performance/Academic Execution"]'::jsonb,
        '["Open learner-risk signals","Signals linked to structured cases","Amber signals resolved with evidence","Red/critical signals without case ownership","Time from signal to structured response"]'::jsonb
      ),
      (
        'ACD-011',
        'Connect Academic Execution evidence to the learner-support system without duplicating SIS/KSI functionality.',
        'A learner-specific academic risk signal requires diagnosis/intervention, or an O12 academic-delivery/debt problem has a documented learner impact.',
        '["Open learner-risk signal","Minimal learner anchor","Relevant O12 academic stream/debt reference","Available SIS/KSI evidence","Named learner-support case owner"]'::jsonb,
        '["Review whether the concern is learner-specific, teaching/systemic or both","Open one structured learner-support case for the learner where needed","Link the primary risk signal and relevant academic-debt/source references","Assign Sectional Promoter/Academic leadership ownership and review date","Move into LPI diagnosis/intervention workflow","Keep O12 academic-delivery debt open until its own recovery evidence is verified"]'::jsonb,
        'Red/critical signals should enter structured support promptly; exact timing follows evidence and risk, not an arbitrary automatic threshold.',
        '["Linked signal/case","O12 source/debt reference","Case owner","Review date","Diagnosis/intervention evidence"]'::jsonb,
        'Academic execution and learner intervention remain connected without merging or duplicating their responsibilities.',
        '["Concern is actually safeguarding/welfare → protected route","No reliable evidence yet → remain signal/monitoring until evidence is sufficient","Systemic teaching issue affecting multiple learners → keep/raise O12/O4 institutional response in parallel"]'::jsonb,
        '["Blocked learner intervention due to teaching/system issue → Academic Inspector","Institutional resource/authority blocker → School Guardian/O4 Issue Engine","Safeguarding dimension → safeguarding route"]'::jsonb,
        '["Risk signals converted to cases where appropriate","Cases linked to source academic evidence","Learner cases delayed by unresolved academic-delivery blockers"]'::jsonb
      ),
      (
        'LPI-001',
        'Record the learner starting point at entry or a meaningful transition so expected progress can be compared with an evidenced baseline.',
        'New learner entry, major class/phase transition, or another approved point where a new baseline is needed.',
        '["SIS learner reference","Current class/section","Approved baseline evidence from SIS/KSI/external/manual source","Starting-point summary","Known strengths and priority learning gaps"]'::jsonb,
        '["Create/update only the minimal learner anchor needed by KHP-OS","Record the baseline source and evidence reference","Summarise starting point, strengths and priority gaps","Do not copy the full SIS student record or full result history","Supersede the previous baseline for the same learner/term rather than deleting history"]'::jsonb,
        'Baseline should be completed early enough to guide teaching/intervention at entry or transition.',
        '["Learner external reference","Baseline reference","Evidence source","Starting-point summary","Strengths/gaps","Recorder/date"]'::jsonb,
        'The school knows where the learner is starting without turning KHP-OS into the master student-information system.',
        '["No reliable baseline evidence → record/obtain evidence before formal baseline","Sensitive health/safeguarding information → keep in protected system and record only academic implication here"]'::jsonb,
        '["Baseline unavailable/contradictory → Sectional Promoter/Academic Inspector","SIS identity mismatch → Admin/SIS owner"]'::jsonb,
        '["Active learners with current baseline","Baseline completion at entry/transition","Learners with baseline priority gaps entering monitoring"]'::jsonb
      ),
      (
        'LPI-002',
        'Monitor learner progress against baseline and expected learning trajectory using approved evidence without reducing progress to one score.',
        'Normal teaching/assessment cycle, intervention review or term review produces evidence about learner progress.',
        '["Current learner baseline","SIS/approved assessment evidence","Teacher observations","Existing risk/intervention history where applicable"]'::jsonb,
        '["Compare current evidence with the learner starting point and expected progress","Record significant signals rather than copying every mark into KHP-OS","Continue ordinary teaching when evidence is green/stable","Create amber/red/critical risk signal when a meaningful concern emerges","Use term review to summarise the trajectory"]'::jsonb,
        'Continuous through the term; significant changes should not wait for formal end-of-term review.',
        '["Baseline/evidence references","Risk signals where needed","Term learner review"]'::jsonb,
        'Meaningful changes in learner trajectory become visible early while normal progress remains low-bureaucracy.',
        '["Ordinary variation with no meaningful concern → no case documentation","Class-wide pattern → Academic Execution/teaching-quality review"]'::jsonb,
        '["Repeated/meaningful concern → LPI-003","Systemic pattern → Academic Inspector/Institutional Performance"]'::jsonb,
        '["Learners with unresolved risk","New risk signals by type","Term status trend","Recovery trend"]'::jsonb
      ),
      (
        'LPI-003',
        'Convert repeated/significant progress concerns into an explicit early-risk response before the learner quietly falls behind.',
        'A credible learner-risk signal is recorded or repeated evidence indicates the learner is off the expected trajectory.',
        '["Open risk signal","Learner baseline","Relevant academic/SIS/KSI evidence","Teacher context"]'::jsonb,
        '["Validate the signal and severity","Resolve unsupported signal with documented reason rather than deleting it","Use quick teacher response for suitable amber concern","Open structured case for significant/repeated concern","Assign case owner and review date","Move to diagnosis before structured intervention"]'::jsonb,
        'Prompt response appropriate to severity; red/critical concerns should not sit unowned.',
        '["Validated/dismissed risk signal","Quick-response evidence or structured case","Owner/review date"]'::jsonb,
        'Each meaningful learner risk has an explicit response pathway and owner.',
        '["Safeguarding/welfare dimension → protected route","Evidence proves concern was erroneous → coordinator may dismiss with reason"]'::jsonb,
        '["Amber unresolved → Sectional Promoter","Red → Academic Inspector as needed","Critical → Academic Inspector/School Guardian"]'::jsonb,
        '["Open signals without response","Red/critical signals without case","Signal-to-case response time"]'::jsonb
      ),
      (
        'LPI-004',
        'Identify the most likely learning barrier using evidence before committing the learner to a structured intervention.',
        'A structured learner-support case is opened or an existing diagnosis needs revision after new evidence.',
        '["Support case","Baseline/risk evidence","Teacher evidence","KSI/SIS/external evidence where available","Previous intervention/reassessment history where applicable"]'::jsonb,
        '["Review evidence and distinguish foundational, concept, literacy/language, attendance, study-habit, teaching-fit, incomplete-work, engagement, behaviour, resource or other relevant barriers","Record barrier categories and reasoned diagnosis summary","Record evidence note/reference and source","Replace the current diagnosis only by creating a new version; preserve history","Do not make medical/psychological/safeguarding diagnoses here"]'::jsonb,
        'Diagnosis should precede structured intervention and be revisited when evidence contradicts the current hypothesis.',
        '["Versioned diagnosis","Barrier categories","Diagnosis/evidence source","Diagnoser/date"]'::jsonb,
        'The intervention responds to an evidenced barrier rather than a guess or generic extra lesson.',
        '["Evidence is insufficient → gather/monitor more evidence","Concern exceeds academic scope → protected/external qualified route"]'::jsonb,
        '["Persistent uncertainty → Academic Inspector","Safeguarding/welfare/clinical concern → appropriate protected/qualified route"]'::jsonb,
        '["Structured cases with current diagnosis","Diagnosis revisions after failed intervention","Cases blocked awaiting evidence"]'::jsonb
      ),
      (
        'LPI-005',
        'Create a time-bound intervention plan with a defined owner, target, response, review date and success evidence.',
        'Current diagnosis shows a learning barrier that requires structured support.',
        '["Current diagnosis","Target learner-support case","Intervention tier","Named active owner assignment","Target outcome","Response plan","Review date","Success criteria"]'::jsonb,
        '["Select intervention intensity proportionate to evidence","Define the target outcome and concrete response plan","Assign an active Teacher/Sectional Promoter/Academic leadership owner","Set start/review dates and success criteria","Make parent partnership explicit where useful/necessary","Activate the intervention without closing the originating risk merely because work has started"]'::jsonb,
        'Plan immediately after diagnosis when structured intervention is warranted; review date is mandatory.',
        '["Intervention plan/reference","Owner","Tier","Start/review dates","Success criteria"]'::jsonb,
        'Every structured intervention is owned, time-bound and testable.',
        '["Barrier is systemic teaching/curriculum issue → parallel Academic Execution response","Need exceeds school capability → escalate/redirect through LPI-009"]'::jsonb,
        '["Owner/resource gap → Sectional Promoter/Academic Inspector","Tier 3/4 or significant blocker → Academic Inspector/School Guardian"]'::jsonb,
        '["Active interventions with owner","Review dates due/overdue","Interventions without activity evidence","Intervention tier distribution"]'::jsonb
      ),
      (
        'LPI-006',
        'Execute the agreed learner intervention and preserve concise evidence of what was actually done.',
        'Structured intervention reaches its start date and the assigned owner begins the agreed response.',
        '["Active/planned intervention","Assigned owner","Response plan","Success criteria","Required resources"]'::jsonb,
        '["Owner carries out the agreed support","Record meaningful activity evidence rather than every routine interaction","Coordinator removes institutional blockers where required","Do not mark success because activities happened; success is assessed in LPI-008","Keep review date visible and update evidence before review"]'::jsonb,
        'Execute according to the intervention cadence and complete evidence before the review date.',
        '["Intervention activities","Evidence references","Owner/date","Blockers/escalations where relevant"]'::jsonb,
        'The agreed support occurs consistently and produces evidence for reassessment.',
        '["Owner absence/resource breakdown → coverage/escalation","Safeguarding/welfare concern emerges → protected route"]'::jsonb,
        '["Execution blocker → Sectional Promoter","Repeated/resource blocker → Academic Inspector/School Guardian"]'::jsonb,
        '["Interventions with recent activity","Overdue interventions","Execution blockers","Evidence completeness before review"]'::jsonb
      ),
      (
        'LPI-007',
        'Use parent partnership to strengthen learner support without transferring the school''s professional responsibility to the parent.',
        'A structured intervention benefits from parent context/action, a high-impact progression decision is being considered, or leadership requires a parent meeting.',
        '["Learner-support case","Relevant evidence","Communication purpose","Agreed school/parent actions","Due dates where applicable"]'::jsonb,
        '["Contact the parent through the approved channel","Share appropriate learner-support evidence and listen to relevant context","Record the summary and agreed actions without storing unnecessary private contact data","Track school and parent commitments where appropriate","For retain/reteach/defer/external-review progression decisions, preserve the parent meeting/reference"]'::jsonb,
        'Engage early enough to influence the intervention or decision; do not wait until the outcome is already fixed.',
        '["Contact date/channel","Summary","Agreed actions","Due dates","Evidence/reference"]'::jsonb,
        'Parent partnership contributes useful context/action while KNS retains professional ownership of learner support.',
        '["Safeguarding concern makes ordinary parent-first contact unsafe → follow safeguarding route","Parent unavailable/refuses meeting → record attempts/context and continue professional duty"]'::jsonb,
        '["Repeated parent-action dependency blocking support → Sectional Promoter/School Guardian","Safeguarding risk → protected route"]'::jsonb,
        '["Structured cases with appropriate parent partnership","High-impact progression decisions with parent reference","Overdue agreed staff actions"]'::jsonb
      ),
      (
        'LPI-008',
        'Reassess whether the learner has recovered, is improving, has not improved or needs redirection using evidence against the intervention success criteria.',
        'Intervention review date arrives, sufficient new evidence exists, or leadership orders an earlier reassessment.',
        '["Intervention plan/success criteria","Activity evidence","Current academic evidence","Parent context where relevant","Current diagnosis"]'::jsonb,
        '["Compare current evidence with success criteria and baseline/trajectory","Record recovered, improving, no-improvement or redirect outcome","Require evidence reference and next action for no-improvement/redirect","Complete/change the intervention as appropriate","Do not close the case yet; closure follows governed LPI-010"]'::jsonb,
        'At the intervention review date or earlier when decisive evidence becomes available.',
        '["Reassessment outcome","Evidence note/reference","Next action","Updated case/intervention state"]'::jsonb,
        'The school knows whether support worked and what happens next; interventions do not remain indefinitely open.',
        '["Insufficient evidence at review → gather evidence promptly rather than inventing outcome","New safeguarding/welfare concern → protected route"]'::jsonb,
        '["No improvement → LPI-009 escalation/rediagnosis","Redirect → competent internal/external support route"]'::jsonb,
        '["Reassessments completed on time","Recovery rate","No-improvement rate","Cases awaiting reassessment"]'::jsonb
      ),
      (
        'LPI-009',
        'Escalate persistent/complex learner-support cases to the authority/resources required without turning escalation into abandonment of ownership.',
        'No improvement despite appropriate support, case severity increases, school-level authority/resources are insufficient, or the learner requires a governed redirect.',
        '["Current support case","Reassessment/diagnosis evidence","Current owner","Required higher owner","Institutional blocker/issue reference where relevant"]'::jsonb,
        '["State why the current response is insufficient","Raise severity only with evidence","Assign the appropriate active Sectional Promoter/Academic Inspector/School Guardian owner","Link an O4 institutional issue when the blocker is operational/systemic","Define next action and maintain visibility until recovery/redirection"]'::jsonb,
        'Escalate when evidence shows current authority/support is insufficient; do not wait for repeated failure with no new action.',
        '["Escalation note","New severity/owner","Linked O4 issue where applicable","Next action"]'::jsonb,
        'Complex learner need gains the authority/resources required while the case remains traceable.',
        '["Safeguarding/welfare need → protected route","External qualified support required → redirect with minimum necessary academic record"]'::jsonb,
        '["Red persistent → Academic Inspector","Critical/resource/system blocker → School Guardian","Institutional repeated pattern → Institutional Performance"]'::jsonb,
        '["Escalated cases","Time in escalated state","Cases blocked by institutional issue","Recovery/redirect after escalation"]'::jsonb
      ),
      (
        'LPI-010',
        'Close learner-support work only after evidence shows recovery or the learner has been formally redirected to the correct governed pathway.',
        'Latest reassessment outcome is recovered or redirect and the case is ready for administrative closure.',
        '["Structured support case","Latest reassessment","Closure note","Any redirect reference/next action"]'::jsonb,
        '["Confirm latest reassessment is recovered or redirect","For critical cases require Academic Inspector/School Guardian closure authority","Record closure outcome/note","Resolve linked learner-risk signals","Preserve diagnosis/intervention/reassessment history","Do not delete the case or label the learner permanently"]'::jsonb,
        'Close promptly after recovery/redirection is evidenced; activity completion alone is not closure evidence.',
        '["Latest reassessment","Closure outcome/note","Closer/date","Resolved signal history"]'::jsonb,
        'Closed cases reflect evidenced recovery or governed redirection, not administrative tidiness.',
        '["Improving/no-improvement case → remains active/escalated","Safeguarding redirect → keep sensitive details in safeguarding system"]'::jsonb,
        '["Critical closure → Academic Inspector/School Guardian","Repeated reopen/recovery failure → Academic Inspector systemic review"]'::jsonb,
        '["Recovered closures","Redirected closures","Cases closed without recovery/redirect (target: zero)","Case duration"]'::jsonb
      ),
      (
        'LPI-011',
        'Make and confirm formal learner progression decisions from multiple evidence dimensions and carry any required support into the next stage.',
        'End-of-year/phase progression review or another formal progression decision point.',
        '["SIS attainment reference","Foundational-gap summary","Learner trajectory","Intervention/reassessment history","Attendance implication reference where relevant","Exam requirement summary where relevant","Parent meeting reference for high-impact decision"]'::jsonb,
        '["Academic Inspector/School Guardian proposes the decision with reasoned evidence","Do not use one score, AI output, attendance alone or fee status as automatic decision","State required support for progress-with-support","Require parent meeting/reference for retain/reteach, defer or external-review","Require School Guardian confirmation for high-impact decisions","Record final decision/rationale in KHP-OS and update formal class/result only in the SIS"]'::jsonb,
        'Complete at the defined progression decision point after required evidence/review is available.',
        '["Proposed decision","Evidence references/summaries","Parent reference where required","Confirmation authority/note","Required support"]'::jsonb,
        'Progression decisions are defensible, human, multi-evidence and connected to continuing learner support.',
        '["Evidence materially incomplete → defer-pending-review","External exam/regulatory rule controls outcome → follow competent authority"]'::jsonb,
        '["High-impact decision → School Guardian","Regulatory/exam uncertainty → competent authority","Disputed/complex support evidence → Academic Inspector/School Guardian review"]'::jsonb,
        '["Progression decisions by type","Progress-with-support cases with carried support","High-impact decisions with parent reference","Proposed decisions awaiting confirmation"]'::jsonb
      ),
      (
        'LPI-012',
        'Close each term with a concise learner trajectory review that exposes unresolved risk and sets the next actions.',
        'Term close-out/review cycle reaches learner-progress review.',
        '["Active learner anchor","Term","Baseline/current evidence","Open risk/case/intervention history","Current progress evidence reference"]'::jsonb,
        '["Summarise overall learner status as green/amber/red/critical without turning status into a permanent label","Record progress summary and unresolved risks","Summarise active/recent intervention outcome","Define next-term actions","Keep open cases open across term boundary until recovered/redirected","Use aggregate patterns in Academic/Institutional Performance review"]'::jsonb,
        'Complete during term close-out early enough to inform next-term planning and learner handover.',
        '["Term learner review","Overall status","Progress/evidence reference","Open-risk/intervention summary","Next-term actions"]'::jsonb,
        'No learner enters the next term with unresolved support needs hidden by report-card closure.',
        '["Learner leaves school → parent/learner exit process","Sensitive safeguarding issue → only academic implication recorded here"]'::jsonb,
        '["Critical/open red cases → Academic Inspector/School Guardian","Repeated class/subject pattern → Academic Execution/Institutional Performance"]'::jsonb,
        '["Term reviews completed","Green/amber/red/critical distribution","Open cases carried forward","Recovery trend","Repeated class/subject risk patterns"]'::jsonb
      )
    ) as x(
      code,purpose,trigger,inputs,steps,sla,evidence,
      expected_outcome,exception_conditions,escalation,kpis
    )
  loop
    select id into v_process
    from public.khpos_ops_processes
    where organisation_id=v_org and code=v_row.code;

    if v_process is null then
      raise exception 'Process % registration is missing.',v_row.code;
    end if;

    insert into public.khpos_ops_process_versions(
      process_id,version,purpose,trigger,inputs,steps,sla,evidence,
      expected_outcome,exception_conditions,escalation,kpis,
      effective_date,approved_by,approved_at,status
    ) values (
      v_process,1,v_row.purpose,v_row.trigger,v_row.inputs,v_row.steps,
      v_row.sla,v_row.evidence,v_row.expected_outcome,
      v_row.exception_conditions,v_row.escalation,v_row.kpis,
      current_date,v_actor,now(),'active'
    )
    on conflict (process_id,version) do nothing;

    update public.khpos_ops_processes
    set status='active',updated_at=now()
    where id=v_process;
  end loop;

  -- Role participation: broad enough for discovery, while execution authority
  -- remains enforced by the O14 database functions.
  for v_row in
    select id,code
    from public.khpos_ops_processes
    where organisation_id=v_org
      and code in (
        'ACD-010','ACD-011',
        'LPI-001','LPI-002','LPI-003','LPI-004','LPI-005','LPI-006',
        'LPI-007','LPI-008','LPI-009','LPI-010','LPI-011','LPI-012'
      )
  loop
    if v_row.code in ('LPI-011') then
      insert into public.khpos_ops_process_roles(process_id,role_id,participation)
      values
        (v_row.id,v_ai,'owner'),
        (v_row.id,v_sg,'approver'),
        (v_row.id,v_sp,'participant'),
        (v_row.id,v_teacher,'consulted'),
        (v_row.id,v_vc,'informed')
      on conflict do nothing;
    elsif v_row.code in ('LPI-009','LPI-010','LPI-012') then
      insert into public.khpos_ops_process_roles(process_id,role_id,participation)
      values
        (v_row.id,v_ai,'owner'),
        (v_row.id,v_sg,'approver'),
        (v_row.id,v_sp,'participant'),
        (v_row.id,v_teacher,'participant'),
        (v_row.id,v_vc,'informed')
      on conflict do nothing;
    elsif v_row.code in ('ACD-010','LPI-002','LPI-003','LPI-006','LPI-008') then
      insert into public.khpos_ops_process_roles(process_id,role_id,participation)
      values
        (v_row.id,v_teacher,'owner'),
        (v_row.id,v_sp,'owner'),
        (v_row.id,v_ai,'consulted'),
        (v_row.id,v_sg,'informed')
      on conflict do nothing;
    else
      insert into public.khpos_ops_process_roles(process_id,role_id,participation)
      values
        (v_row.id,v_sp,'owner'),
        (v_row.id,v_ai,'participant'),
        (v_row.id,v_teacher,'participant'),
        (v_row.id,v_sg,'informed')
      on conflict do nothing;
    end if;
  end loop;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o14_learner_progress_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'activePolicy','LPI-P02',
      'publishedProcesses',jsonb_build_array(
        'ACD-010','ACD-011',
        'LPI-001','LPI-002','LPI-003','LPI-004','LPI-005','LPI-006',
        'LPI-007','LPI-008','LPI-009','LPI-010','LPI-011','LPI-012'
      ),
      'architectureVersion','O14-v1.0',
      'seededLearners',0,
      'seededSignals',0,
      'seededCases',0,
      'guardrails',jsonb_build_array(
        'SIS remains authoritative learner record',
        'Diagnosis before structured intervention',
        'No automatic learner progression decision',
        'No single-score progression decision',
        'No fee-status academic progression criterion',
        'Vision Custodian sees aggregate patterns by default',
        'Case closes only after recovery or governed redirection'
      )
    )
  where not exists(
    select 1 from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o14_learner_progress_bootstrapped'
  );
end;
$$;
