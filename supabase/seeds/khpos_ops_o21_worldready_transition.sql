-- KNS O21 WorldReady Transition.
-- Publishes HPD-P05 + HPD-014 without fabricating learner readiness data.

do $$
declare
  v_org uuid;
  v_actor uuid;
  v_policy uuid;
  v_process uuid;
  v_vc uuid;
  v_sg uuid;
  v_ai uuid;
  v_si uuid;
  v_sp uuid;
  v_teacher uuid;
  v_sf uuid;
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
  select id into v_sf from public.khpos_ops_roles where organisation_id=v_org and code='SKILLS_FACILITATOR';

  if v_vc is null or v_sg is null or v_ai is null or v_si is null
     or v_sp is null or v_teacher is null or v_sf is null then
    raise exception 'Required KNS Human Potential roles are missing.';
  end if;

  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='HPD-P05';

  if v_policy is null then
    raise exception 'HPD-P05 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Ensure every final-year KNS learner leaves with a verified picture of their readiness for life after secondary school, a meaningful next-step pathway, evidence of what they can do, and owned actions for any remaining gaps.',
    'Active SS3 learners preparing to transition from KNS. WorldReady covers Human Potential transition readiness, personal capstone/portfolio evidence and next-step planning. WAEC/NECO preparation, examination administration, formal admission into tertiary institutions, employment contracts and external opportunity execution remain governed elsewhere.',
    '["WorldReady is a developmental transition profile, not a single score, ranking, pass mark or substitute for WAEC/NECO.","The final-year learner remains responsible for their choices and evidence; KNS guides, verifies and prepares rather than deciding the learner''s life for them.","A learner may be strong in some readiness domains and still have genuine gaps in others; the record must preserve that nuance instead of averaging it away.","Ready means all ten WorldReady domains are demonstrated with independently verified evidence, the SS3 Personal Project/capstone is completed, and a verified learner-shared portfolio reference exists.","Ready With Actions is a valid developmental outcome when unresolved domains have named, dated transition actions; it is not a hidden failure label.","Not Ready identifies material unresolved readiness gaps at the review point; it is not a permanent identity judgment about the learner.","WorldReady uses evidence already generated through Human Potential, leadership, financial capability, skills, projects, academic work and deliberately shared portfolio artefacts; it should not create a second parallel learner-development system.","Private PipuPath content remains private unless the learner deliberately shares a reference for institutional use.","Transition planning may include higher education, entrepreneurship, employment, apprenticeship/vocational development, service/gap-year pathways or an honestly undecided pathway.","A learner''s pathway may change. The purpose is to build informed next-step agency, not lock the learner into an early choice."]'::jsonb,
    '["Every active SS3 learner should have one active WorldReady record in the relevant final-year term/cycle.","The WorldReady profile uses ten domains: Self Understanding, Independent Learning, Problem Solving & Building, Communication, Collaboration, Leadership & Service, Financial Capability, Digital Responsibility, Portfolio & Capstone, and Transition Planning.","Each domain is reviewed as Not Evidenced, Emerging or Demonstrated and requires a written evidence summary.","A domain cannot be marked Demonstrated without independently verified WorldReady evidence.","Evidence may reference approved O16 Potential Progress Reviews, active O16 potential evidence, completed learner projects, verified learner-shared portfolio links or other controlled evidence appropriate to the domain.","The evidence submitter cannot verify their own WorldReady evidence.","The WorldReady owner records the learner''s current next-step pathway, pathway summary and relevant reference(s).","A final Ready outcome requires all ten domains Demonstrated, a completed personal SS3 project/capstone, a verified learner-shared portfolio reference, and no unresolved transition actions.","A Ready With Actions outcome requires at least one unresolved domain and an owned transition action for every unresolved domain.","Transition actions have an owner, due date, expected change, completion evidence and independent verification.","Not Ready requires at least one domain that remains Emerging or Not Evidenced and a reasoned review summary.","WorldReady readiness outcomes do not automatically change examination eligibility, graduation status, admission status, fees, employment eligibility or other external decisions.","Closed WorldReady records preserve the evidence and decision trail; they are not deleted when a learner graduates or leaves KNS."]'::jsonb,
    '["School Guardian: owns whole-school WorldReady completion and unresolved transition risk.","Academic Inspector: co-owns independent-learning, academic-transition and capstone readiness and may verify evidence/reviews.","Skill Inspector: co-owns skills, value-creation, financial capability and practical transition readiness and may verify evidence/reviews.","Sectional Promoter: coordinates SS3 completion, gathers evidence and tracks transition actions but does not unilaterally declare final readiness.","Teachers/Skills Facilitators: contribute specific evidence, mentor transition actions and help learners prepare artefacts without inflating readiness.","Learner: owns their pathway choices, Personal Project, portfolio sharing and transition preparation; institutional evidence should reflect what the learner has actually demonstrated.","Vision Custodian: sees aggregate readiness and strategic transition gaps; routine learner-level evidence remains with the operating roles unless intervention is required.","PipuPath: remains the learner-facing environment for reflection/portfolio where applicable; only deliberately shared references enter KHP-OS."]'::jsonb,
    '["Do not reduce WorldReady to one percentage, grade, badge or league table.","Do not mark a domain Demonstrated without verified evidence.","Do not let the evidence submitter verify the same evidence.","Do not mark a learner Ready because they passed WAEC/NECO or because they are academically strong.","Do not mark a learner Ready without the completed SS3 Personal Project/capstone and verified learner-shared portfolio reference.","Do not use the WorldReady record to force a learner into university, entrepreneurship, employment or any other pathway.","Do not treat Undecided as misconduct; it requires honest transition planning and exploration, not punishment.","Do not copy private PipuPath journal/reflection content into KHP-OS without deliberate sharing.","Do not let unresolved readiness gaps disappear at graduation; keep them as named transition actions until verified, waived with reason, cancelled or handed over appropriately.","Do not use WorldReady as an automatic gate for graduation, exam entry, school fees or external admission."]'::jsonb,
    '["A learner who changes pathway may update the pathway plan and supporting references before final close.","A transition action may be waived only by WorldReady coordinating authority with a documented reason; waiver is exceptional and remains auditable.","If a learner cannot complete an action before leaving KNS, the record may close only after a deliberate handover/waiver/cancellation decision appropriate to the action; unresolved risk must remain visible.","Where a learner has legitimate accessibility/support needs, evidence should judge the intended capability fairly rather than demand one presentation style."]'::jsonb,
    '["Repeated SS3 readiness gaps → Sectional Promoter then Academic/Skill Inspector depending domain.","Cross-domain or material transition risk → School Guardian.","Strategic pattern across cohorts → Vision Custodian and Institutional Performance review.","Safeguarding/welfare concern discovered through transition work → System 07 immediately; WorldReady does not investigate safeguarding.","External opportunity/admission/mentor risk → future HPD-015/016 and relevant Parent/Safeguarding controls.","Academic examination readiness problem → Academic Execution; do not hide it inside WorldReady."]'::jsonb,
    '["WorldReady record and learner/term anchor.","Ten domain reviews with status, evidence summary and reviewer.","Verified WorldReady evidence and source references.","Completed SS3 Personal Project/capstone evidence where applicable.","Verified learner-shared portfolio reference.","Transition pathway, summary and supporting reference.","Transition actions, owners, due dates, evidence and verification.","Final readiness outcome and reasoned review note.","WorldReady event/audit trail."]'::jsonb,
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
    (v_policy,v_sf,'mandatory')
  on conflict do nothing;

  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='HPD-014';

  if v_process is null then
    raise exception 'HPD-014 process registration is missing.';
  end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Move each SS3 learner from final-year development into an evidence-based transition profile, clear next-step pathway and owned recovery actions for any remaining readiness gaps.',
    'An active learner enters SS3/final-year transition planning or a final-year WorldReady cycle begins.',
    '["Active SS3 learner anchor","Active final-year academic term","WorldReady owner assignment","O16 potential evidence/reviews","O18 leadership/financial evidence where applicable","O20 Personal Project/capstone and portfolio evidence","Learner next-step pathway choice and supporting references","Any relevant academic/skills/transition evidence deliberately shared for review"]'::jsonb,
    '["Open one WorldReady record for the active SS3 learner and create the ten readiness domains","Set/update the learner''s current transition pathway and pathway summary","Gather controlled evidence from existing KNS systems and deliberately shared learner references rather than recreating evidence","Independently verify submitted WorldReady evidence","Review each of the ten readiness domains as Not Evidenced, Emerging or Demonstrated with a written evidence summary","Create an owned transition action for every unresolved domain where a Ready With Actions outcome may be appropriate","Submit the completed domain profile for final WorldReady review","Record the final outcome as Ready, Ready With Actions or Not Ready using the policy gates","For Ready With Actions, continue action follow-through and independent verification until resolved","Close the WorldReady record when the final transition state and outstanding actions are appropriately resolved/handed over","Use cohort-level patterns to improve KNS Human Potential and SS3 preparation without ranking learners"]'::jsonb,
    'WorldReady should begin early enough in SS3 to allow evidence/recovery before the learner leaves KNS. Domain reviews are updated as evidence changes; final review occurs before transition/close-out rather than being reconstructed after graduation.',
    '["WorldReady reference","Ten domain records","Verified evidence references","Transition pathway","Personal Project/capstone completion evidence","Verified portfolio reference","Transition actions and evidence","Final readiness outcome","Review note and close-out history"]'::jsonb,
    'Each SS3 learner leaves KNS with a truthful transition profile, evidence of demonstrated capability, a clear next step or honest exploration plan, and no important readiness gap that has silently disappeared.',
    '["Learner not yet SS3 → continue earlier Human Potential systems rather than opening WorldReady","WAEC/NECO preparation issue → Academic Execution","Safeguarding/welfare concern → System 07","External opportunity/admission execution → HPD-015/Parent Experience when active","Mentorship requirement → HPD-016 when active","No completed Personal Project/verified portfolio → learner cannot receive Ready outcome but may continue recovery/review"]'::jsonb,
    '["Domain-specific gap → Sectional Promoter / relevant Inspector","Cross-domain/material transition risk → School Guardian","Cohort pattern → Vision Custodian + Institutional Performance","Safeguarding concern → designated safeguarding route immediately","External opportunity/mentor risk → relevant future controlled process"]'::jsonb,
    '["SS3 learners with open WorldReady records","Ten-domain review completion rate","Verified-evidence coverage","Learners Ready / Ready With Actions / Not Ready","Unresolved transition actions by domain and due date","Completed Personal Project/capstone coverage","Verified learner-shared portfolio coverage","Transition pathway distribution without ranking","Cohort readiness gaps requiring programme improvement"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes
  set status='active',updated_at=now()
  where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'owner'),
    (v_process,v_si,'owner'),
    (v_process,v_sp,'participant'),
    (v_process,v_teacher,'participant'),
    (v_process,v_sf,'participant'),
    (v_process,v_vc,'approver')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o21_worldready_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'activePolicy','HPD-P05',
      'publishedProcesses',jsonb_build_array('HPD-014'),
      'architectureVersion','O21-v1.0',
      'seededWorldReadyRecords',0,
      'guardrails',jsonb_build_array(
        'No WorldReady score or ranking',
        'No automatic graduation or exam gate',
        'Verified evidence before Demonstrated',
        'Completed Personal Project plus verified portfolio before Ready',
        'Owned action for every unresolved Ready With Actions domain',
        'Private PipuPath content stays private unless deliberately shared'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o21_worldready_bootstrapped'
  );
end;
$$;
