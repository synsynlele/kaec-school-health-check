-- KNS O15 Assessment, Examination & Academic Assurance.
-- Governance layer only: no duplicate scorebook, CBT engine or result store.

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
    raise exception 'Required KNS academic-assurance roles are missing.';
  end if;

  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='ACD-P02';

  if v_policy is null then raise exception 'ACD-P02 policy registration is missing.'; end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Ensure every KNS assessment and examination is valid, moderated, operationally ready, fairly administered, traceable, protected from hidden manipulation and cleanly reconciled at academic close-out.',
    'Internal continuous assessment, mid-term/terminal/mock/practical assessment, external examinations, assessment moderation, examination readiness, academic-integrity concerns, result-correction governance and term academic close-out. SIS/CBT remains the authoritative marks/results record.',
    '["Assessment should measure the intended learning, not surprise learners with unrelated content.","Assessment generation and assessment approval are different responsibilities; KSI/AI may assist creation but cannot self-authorise use.","The person who submits an assessment package cannot moderate/approve that same package.","Exam readiness is proven through owned controls and evidence, not verbal assurance.","An integrity allegation is not a finding; evidence and the learner/staff explanation are considered before an academic-integrity decision.","Academic consequences and staff/behavioural sanctions are separate governed decisions; serious staff integrity matters route to O10/People or another competent process.","A result correction is never a silent edit: request, approval, external SIS/CBT implementation reference and independent verification are preserved.","KHP-OS never becomes the mark book, CBT engine or result database.","External examination-body rules remain authoritative where they apply.","A term is not academically closed merely because report cards were printed; delivery, assessment, learner support, integrity exceptions and carry-over must be reconciled."]'::jsonb,
    '["Assessment packages reference an approved source and blueprint/specification; question/mark content remains in KSI/SIS/CBT/external systems.","Internal assessment cycles require moderated approved package(s), no unresolved created package and at least one mandatory readiness control before Ready status.","External examination cycles require a resolved mandatory external-registration control before Ready status.","Readiness owners submit evidence; Academic Inspector/School Guardian independently verifies, while only School Guardian may accept a documented readiness exception.","Learner/staff integrity cases require specific evidence and a recorded representation/explanation before decision; critical cases require School Guardian decision.","Substantiated high/critical staff integrity cases require a separate People/O10/external-process reference when employment/conduct action may follow.","Result-correction requester cannot approve their own request; implementation occurs in SIS/CBT/external system; verification is independent of requester, approver and implementer.","Academic Inspector prepares term close-out; School Guardian independently approves and closes the term.","Open P2 academic debt requires an institutional issue/escalation reference before close-out; any remaining debt or learner-support case requires an explicit carry-over reference."]'::jsonb,
    '["Teacher: prepares/submits assessment package for assigned stream, owns assigned readiness work, may report integrity concern and request result correction; cannot self-moderate or unilaterally change official results.","Sectional Promoter: coordinates readiness/integrity evidence and supports moderation/administration within section authority.","Academic Inspector: owns assessment governance, moderation, readiness verification, integrity review, result-correction approval and academic close-out preparation.","School Guardian: accepts readiness exceptions, decides critical integrity matters, independently approves term close-out and closes the academic term.","Vision Custodian: receives strategic/aggregate academic-assurance visibility; routine marks/results and learner integrity details are not a default executive working surface.","SIS/CBT/KSI/external exam platform owners: remain authoritative for question/score/result content according to their system purpose."]'::jsonb,
    '["Never store duplicate learner marks/result values in the O15 governance tables.","Never use a KSI/AI-generated assessment merely because it was generated; it still requires the governed moderation route.","Never allow an assessment submitter to approve their own package.","Never mark an exam cycle Ready with no mandatory readiness control or with unresolved mandatory controls.","Never treat a reported integrity incident as proven before evidence and subject representation are recorded.","Never use academic-integrity workflow as a shortcut around O10/People accountability for staff conduct.","Never silently edit a result or call a correction complete before the SIS/CBT implementation reference is independently verified.","Never allow the same person to request, approve/implement and verify a result correction.","Never close the term with unresolved high/critical integrity cases or result-correction workflows.","Never use fees/payment status to alter academic scores/results or integrity decisions."]'::jsonb,
    '["External examination-body procedures may replace internal package moderation where KNS does not author/control the examination; readiness/registration/invigilation obligations still remain governed.","A School Guardian may accept a readiness exception only with reason and authority/mitigation reference; this does not waive external regulatory requirements.","Where an integrity matter includes safeguarding, criminal, data-security or employment dimensions, preserve the academic evidence and route the other dimension to its competent process without attempting to adjudicate it here.","A term may carry unresolved academic debt/support only with the explicit carry-over/escalation reference required by close-out controls."]'::jsonb,
    '["Assessment validity/moderation problem → Academic Inspector.","Unresolved examination readiness or accepted exception → School Guardian.","Critical academic-integrity matter → School Guardian; serious staff conduct/employment implication → O10/People/external competent route.","Suspected external-exam malpractice/regulatory breach → applicable examination authority and School Guardian.","Result-correction dispute or control failure → Academic Inspector then School Guardian; system implementation issue → SIS/CBT owner.","Open P2 academic debt/systemic delivery blocker → O4 Issue Engine/School Guardian.","Repeated integrity/readiness/correction patterns → Institutional Performance review."]'::jsonb,
    '["Assessment-cycle and package references, source/blueprint references and moderation audit.","Exam-readiness controls, ownership, evidence, verification and accepted-exception reference.","Integrity case, evidence, subject representation, academic decision and linked competent-process reference.","Result-correction request, approval/rejection, external result reference, SIS/CBT implementation reference and independent verification.","Academic close-out summaries, carry-over/escalation reference, evidence and approval history.","Assessment/assurance event audit trail."]'::jsonb,
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
    (v_policy,v_teacher,'mandatory'),
    (v_policy,v_vc,'reference')
  on conflict do nothing;

  for v_row in
    select *
    from (
      values
      (
        'ACD-012',
        'Govern assessment design, submission and moderation so every KNS-controlled assessment is aligned, traceable and independently approved before use.',
        'An internal assessment/examination cycle is planned and one or more subject/class assessment packages are required.',
        '["Active/draft academic term and O12 stream","Assessment cycle","KSI/SIS/CBT/external/manual source reference","Assessment blueprint/specification reference","Integrity declaration","Independent moderator authority"]'::jsonb,
        '["Create the governed assessment cycle without copying scores/questions into KHP-OS","Assigned teacher/academic authority creates a package reference for the stream","Require the assessment integrity declaration before submission","Independent Academic Inspector/School Guardian moderates the submitted package","Approve or return changes with reason","Resolve every created package through approval/withdrawal before cycle readiness","Preserve source/blueprint/moderation references while question/mark content remains in the source system"]'::jsonb,
        'Complete moderation before the cycle readiness decision and early enough for secure administration.',
        '["Assessment cycle/package references","Source and blueprint references","Integrity declaration","Submitter/moderator","Moderation note/state/time"]'::jsonb,
        'KNS-controlled assessments enter use only after traceable independent moderation.',
        '["External exam not authored by KNS → external source governs paper content; O15 still governs readiness/integrity interface","Material package defect after approval → stop/reopen through a new governed package/cycle decision rather than silent replacement"]'::jsonb,
        '["Unresolved moderation issue → Academic Inspector","Assessment validity/authority dispute → School Guardian","Suspected leakage/tampering → ACD-014"]'::jsonb,
        '["Packages awaiting moderation","Changes-required packages","Approved packages before readiness","Self-approval attempts (target: zero successful)"]'::jsonb
      ),
      (
        'ACD-013',
        'Make every internal/external examination operationally ready before learners enter the assessment, with explicit ownership, evidence and governed exceptions.',
        'An approved/planned assessment cycle requires candidate, timetable, venue, invigilation, materials, CBT, power, security, registration, practical or communication readiness.',
        '["Assessment cycle","Applicable external examination requirement","Named active owner assignment","Mandatory readiness controls","Due dates","Evidence/mitigation references"]'::jsonb,
        '["Academic Inspector/School Guardian creates the readiness controls appropriate to the cycle","Assign each control to an active role owner","Owner executes and submits concise evidence","Independent academic authority verifies evidence","School Guardian alone may accept a documented internal readiness exception where lawful/appropriate","External examination cycle must have a resolved mandatory registration control","Do not mark the cycle Ready while mandatory controls are unresolved","Start/end/results-pending transitions follow approved dates and status gates"]'::jsonb,
        'Readiness controls should be completed before the assessment start date; critical external registration and security controls follow the applicable authority deadlines.',
        '["Readiness item/category","Owner/due date","Completion evidence","Verifier","Exception reason/reference where used","Cycle status trail"]'::jsonb,
        'Assessment begins only when operational readiness is evidenced or a competent exception is explicitly accepted.',
        '["External authority deadline/rule supersedes internal timing","Emergency disruption → School Guardian records controlled response and appropriate external notification/reference","No lawful mitigation for mandatory external rule → cycle cannot be marked Ready"]'::jsonb,
        '["Overdue readiness → Academic Inspector","Readiness exception/security/external-registration risk → School Guardian","External exam authority requirement → competent external examination authority"]'::jsonb,
        '["Mandatory readiness resolved before Ready","Overdue readiness controls","Accepted exceptions by category","Assessment cycles started without Ready status (target: zero)"]'::jsonb
      ),
      (
        'ACD-014',
        'Protect academic integrity and official result accuracy through evidence, fair representation, governed academic decisions and auditable result corrections.',
        'Possible cheating/plagiarism/collusion/impersonation/leakage/tampering/result manipulation/administrative irregularity is reported, or an official SIS/CBT result requires correction.',
        '["Academic term/cycle/stream context","Learner or staff/process/system subject as applicable","Specific incident/correction evidence","Subject representation for learner/staff integrity cases","External result reference for correction","Separate O10/People/external reference when required"]'::jsonb,
        '["Record allegation/incident as an open integrity case; allegation is not a finding","Add specific evidence and record learner/staff representation through a non-reporter academic leader","Academic Inspector/School Guardian records reasoned outcome; critical case requires School Guardian","Route serious substantiated staff conduct separately to O10/People/external competent process rather than imposing employment sanction here","Where correction is required, open a result-correction request referencing the authoritative external result record","Independent authority approves/rejects the correction","Implement approved change in SIS/CBT/external system and record implementation reference","A different competent verifier confirms implementation; KHP-OS stores no before/after score","Close integrity case only after required linked correction is verified"]'::jsonb,
        'Act promptly enough to protect evidence, assessment fairness and result publication while allowing reasonable representation/review.',
        '["Integrity case/evidence/representation","Outcome and academic action","Linked competent-process reference","Correction request/decision","SIS/CBT implementation reference","Independent verification"]'::jsonb,
        'Academic-integrity concerns are handled fairly and official corrections are visible, authorised and independently verified.',
        '["Safeguarding/criminal/data-security dimension → competent restricted/external route in parallel","External exam malpractice → applicable examination-body procedure","Inconclusive evidence → record inconclusive rather than manufacture certainty"]'::jsonb,
        '["Critical integrity → School Guardian","High/critical staff integrity → O10/People/external competent route","External examination breach → external authority","Repeated integrity/correction pattern → Institutional Performance"]'::jsonb,
        '["Open integrity cases by severity","Cases with evidence and representation before decision","Correction requests by status","Verified corrections","Self-review/self-verification attempts (target: zero successful)"]'::jsonb
      ),
      (
        'ACD-015',
        'Close each academic term only after teaching delivery, assessment, learner-support, integrity exceptions, result corrections and carry-over obligations are reconciled.',
        'Assessment cycles are complete/cancelled and the active academic term is ready for institutional close-out.',
        '["Active academic term","O12 delivery/debt status","O14 learner-support status","Closed/cancelled assessment cycles","Integrity/correction status","External-exam summary where applicable","Carry-over/escalation references"]'::jsonb,
        '["Academic Inspector prepares the close-out summaries and evidence","Require at least one governed assessment cycle for the term","Block submission while any assessment cycle remains open, high/critical integrity case remains unresolved or result correction remains unresolved","Require open P2 academic debt to have an institutional issue/escalation reference","Require any remaining academic debt/learner-support case to have explicit carry-over reference","School Guardian independently reviews/approves the close-out","Only after approval, School Guardian closes the term and active O12 streams","Preserve lessons learned and carry-over for next-term planning"]'::jsonb,
        'Complete during the formal term close-out window before the next term is treated as operationally ready.',
        '["Academic close-out record","Curriculum/assessment/learner-support/integrity/external-exam summaries","Carry-over/escalation reference","Approval note","Closed term/stream records"]'::jsonb,
        'The academic cycle closes with unresolved obligations visible and owned rather than disappearing behind result publication.',
        '["Term cancelled for exceptional reason → separate governed cancellation/recovery decision","Required external result not yet available → remain open/results-pending or document competent carry-over; do not fabricate completion"]'::jsonb,
        '["Close-out preparation → Academic Inspector","Close-out approval/term closure → School Guardian","P2 debt/systemic blocker → O4 Issue Engine","Repeated cross-term pattern → Institutional Performance"]'::jsonb,
        '["Terms with approved close-out","Assessment cycles unresolved at close-out","P2 debt with escalation reference","Carry-over obligations","Repeated lessons/systemic patterns"]'::jsonb
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

  for v_row in
    select id,code
    from public.khpos_ops_processes
    where organisation_id=v_org
      and code in ('ACD-012','ACD-013','ACD-014','ACD-015')
  loop
    if v_row.code='ACD-012' then
      insert into public.khpos_ops_process_roles(process_id,role_id,participation)
      values
        (v_row.id,v_ai,'owner'),
        (v_row.id,v_sg,'approver'),
        (v_row.id,v_sp,'participant'),
        (v_row.id,v_teacher,'participant'),
        (v_row.id,v_vc,'informed')
      on conflict do nothing;
    elsif v_row.code='ACD-013' then
      insert into public.khpos_ops_process_roles(process_id,role_id,participation)
      values
        (v_row.id,v_ai,'owner'),
        (v_row.id,v_sg,'approver'),
        (v_row.id,v_sp,'participant'),
        (v_row.id,v_teacher,'participant'),
        (v_row.id,v_vc,'informed')
      on conflict do nothing;
    elsif v_row.code='ACD-014' then
      insert into public.khpos_ops_process_roles(process_id,role_id,participation)
      values
        (v_row.id,v_ai,'owner'),
        (v_row.id,v_sg,'approver'),
        (v_row.id,v_sp,'participant'),
        (v_row.id,v_teacher,'participant'),
        (v_row.id,v_vc,'informed')
      on conflict do nothing;
    else
      insert into public.khpos_ops_process_roles(process_id,role_id,participation)
      values
        (v_row.id,v_ai,'owner'),
        (v_row.id,v_sg,'approver'),
        (v_row.id,v_sp,'consulted'),
        (v_row.id,v_teacher,'consulted'),
        (v_row.id,v_vc,'informed')
      on conflict do nothing;
    end if;
  end loop;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o15_academic_assurance_bootstrapped',
    'organisation',v_org,
    jsonb_build_object(
      'activePolicy','ACD-P02',
      'publishedProcesses',jsonb_build_array('ACD-012','ACD-013','ACD-014','ACD-015'),
      'architectureVersion','O15-v1.0',
      'seededAssessmentCycles',0,
      'seededAssessmentPackages',0,
      'seededReadinessItems',0,
      'seededIntegrityCases',0,
      'seededResultCorrections',0,
      'seededCloseouts',0,
      'guardrails',jsonb_build_array(
        'No duplicate scorebook',
        'No assessment self-approval',
        'No empty/unresolved Ready cycle',
        'Evidence plus subject representation before integrity decision',
        'No staff sanction shortcut through academic-integrity workflow',
        'No silent result correction',
        'Independent correction verification',
        'Independent School Guardian term close-out approval'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o15_academic_assurance_bootstrapped'
  );
end;
$$;
