-- KNS O20 Builder Projects, Personal Projects, Defence & Portfolio.
-- Publishes HPD-P03 + HPD-008/009/011/013 without fabricating project data.

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
  where organisation_id=v_org and code='HPD-P03';

  if v_policy is null then
    raise exception 'HPD-P03 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Make problem solving, project ownership, reflection, defence and portfolio evidence a repeatable KNS learner-development system rather than an occasional exhibition exercise.',
    'KNS Builder Projects, individual Personal Projects/capstones, Builder Defence, showcase readiness and learner-shared portfolio references. Event logistics for Builder Summit remain in Events & Special Programmes; private PipuPath project/reflection content remains in PipuPath unless deliberately shared.',
    '["Projects begin with a meaningful problem, not with a decoration, product or presentation idea.","Builder Projects develop collaboration and shared problem solving; Personal Projects develop end-to-end individual ownership.","For KNS normal design, JSS1–SS2 learners primarily participate in collaborative Builder Projects while SS3 completes an individual Personal Project/capstone; approved developmental exceptions may be made without turning the rule into punishment.","PipuPath remains the learner-facing project/reflection/portfolio environment; KHP-OS governs institutional execution, deadlines, ownership, evidence, exceptions and defence.","Team success never becomes automatic Human Potential evidence for every member. Individual contribution must be observed and independently verified.","A project is not complete because slides look attractive. Investigation, reasoning, a real build, testing and reflection must be evidenced.","Builder Defence is an evidence-based learning defence, not a popularity contest, beauty pageant, public vote or one-number project score.","Showcase readiness is different from project completion: a project can be educationally complete without being selected/ready for a public showcase.","Learner portfolios remain learner-owned. KHP-OS records only a deliberately shared project/portfolio reference and the institutional reason for using it.","Failure, revision and weak first attempts are legitimate project evidence when learners investigate, test, reflect and improve responsibly."]'::jsonb,
    '["Each active-term Project Cycle has a campus, accountable owner, dates and a seven-milestone calendar: Problem, Investigation, Solution Design, Build, Test, Reflection and Defence Preparation.","Every project is either builder_team or personal, has a mentor, meaningful problem statement and governed learner membership.","A builder_team project requires at least two active learners and a lead before work begins; a personal project requires exactly one learner owner.","Project membership is set early and normally freezes after defence readiness so evidence/ownership cannot be rewritten at the end.","Milestones progress only through evidence. A submitter cannot verify their own milestone evidence.","Missed milestone deadlines become Human Potential Development recovery issues rather than disappearing; recovery remains required until valid evidence is independently verified.","Project stages are gated by verified milestones: Problem+Investigation before Solution Design; Solution Design before Build; Build before Test; Test before Reflection; all seven before Defence Ready.","Builder Defence is scheduled only after all milestones are independently verified. Panel outcome is narrative: completed, showcase_ready or revision_required; no popularity or compulsory numeric ranking.","Revision-required defence returns the project to reflection and creates a recovery issue with a due date.","Project close-out requires a completed defence outcome; project completion itself creates no automatic individual evidence.","Individual contribution evidence is separately recorded for project members and independently verified before linking into O16 as project evidence.","A learner-shared PipuPath/project portfolio reference may be recorded only after deliberate sharing is confirmed and only after the project is defended/completed; independent verification links it into O16 as learner_shared_portfolio evidence.","Private PipuPath journals, project text, profile data, mission history and reflections are never pulled into KHP-OS through the existing aggregate-only PipuPath bridge.","Builder Summit/showcase event registration, audience, venue, payments, vendors, safety and run-of-show remain in Events & Special Programmes, not O20.","If a project uses real money, off-site work, public/external participants or higher-risk activity, the relevant Finance, Safeguarding, Parent Consent and/or Events controls apply in addition to HPD-P03."]'::jsonb,
    '["School Guardian: owns whole-school compliance, approves material exceptions and oversees defence/showcase readiness.","Academic Inspector: primary institutional owner of Builder Project quality, milestone verification standards and Builder Defence.","Sectional Promoters: coordinate sections, verify evidence independently where appropriate, detect missed milestones and support mentors.","Teachers: mentor Builder Project teams, guide investigation/build/test/reflection, submit evidence and record individual contribution without inflating credit.","Skill Inspector/Skills Facilitators: may mentor cross-disciplinary/personal projects where their expertise is relevant; they do not bypass Academic/Defence governance.","Learners: own the problem-solving work, evidence, reflection and contribution appropriate to their project role; project membership does not guarantee evidence credit.","Vision Custodian: receives aggregate programme health/strategic exceptions and does not routinely inspect learner-level project evidence merely by executive status.","PipuPath: learner-facing project/reflection/portfolio product; KHP-OS receives only school-owned records and deliberately shared references, not private learner content."]'::jsonb,
    '["Do not create projects solely for exhibition, marks, social media or decoration without a meaningful problem/inquiry.","Do not let a team begin as an active Builder Project without a clear member set and lead, or a Personal Project without one owner.","Do not advance project stages merely because a week ended; use verified milestone evidence.","Do not let the evidence submitter verify the same milestone, individual contribution or learner-shared portfolio reference.","Do not award every team member the same Human Potential evidence automatically.","Do not make project revenue, aesthetics, expensive materials, public applause, votes or presentation charisma the primary definition of project quality.","Do not make SS3 Personal Project a substitute for WAEC/NECO preparation; capstone and external-exam preparation remain separate responsibilities.","Do not copy private PipuPath content into KHP-OS by default or treat PipuPath aggregate signals as individual evidence.","Do not expose project work to unsafe/off-site/public activity without the applicable safeguards/consents.","Do not turn O20 into event management, finance accounting or a duplicate learner social/project platform."]'::jsonb,
    '["A learner may move out of a project before defence readiness with a documented reason; their previously verified individual evidence remains historically attributable.","A project may be withdrawn for safety, feasibility, resource or developmental reasons by coordinating authority; withdrawal is not automatic academic/behaviour failure.","A project may complete after a defence outcome of completed even when it is not showcase_ready.","A revision-required defence may be re-presented after corrective work; the earlier defence record remains in history.","Where learner-specific need makes group participation inappropriate, School Guardian/Academic Inspector may approve a Personal Project or modified participation without stigmatising the learner."]'::jsonb,
    '["Missed project milestone → O4 Human Potential Development issue → mentor/Sectional Promoter → Academic Inspector if overdue/repeated.","Unsafe, abusive, off-site or consent concern → Safeguarding/Parent controls immediately.","Real-money project activity → Finance/Young CEO/approved transaction controls as applicable.","Public showcase/event execution → Events & Special Programmes.","Persistent inability to execute Builder Projects across a section/term → Academic Inspector → School Guardian → Institutional Performance review.","Project evidence/dispute or defence revision → Sectional Promoter/Academic Inspector; strategic exception only rises to School Guardian/Vision Custodian where threshold is met."]'::jsonb,
    '["Project cycle and milestone calendar","Project type, problem statement, beneficiary, mentor and membership history","Seven milestone evidence/verification records and missed-milestone recovery issue references","Individual contribution evidence and linked O16 project evidence IDs","Builder Defence schedule, panel reference, narrative feedback, learner response, outcome and evidence","Revision issue/reference where applicable","Project close-out evidence","Deliberately shared portfolio/project references and linked O16 learner_shared_portfolio evidence IDs","PipuPath reference only where deliberately shared; no private PipuPath content","Audit events and term close-out evidence"]'::jsonb,
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

  -- HPD-008 Builder Project
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='HPD-008';
  if v_process is null then raise exception 'HPD-008 process registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Run collaborative term projects in which learners identify a meaningful problem, investigate it, design/build/test a response, reflect and become ready to defend their reasoning and evidence.',
    'An active term Project Cycle opens and learners are grouped for collaborative Builder Project work.',
    '["Active academic term/campus Project Cycle and seven-milestone calendar","Builder Project problem statement","Mentor assignment","At least two active learners and one lead","PipuPath reference only if deliberately shared","Required resources/safety constraints","Milestone evidence references"]'::jsonb,
    '["Create the term/campus Project Cycle and standard milestone calendar","Create each builder_team project around a meaningful problem and assign a mentor","Add team members and a lead before activation","Begin investigation only when the cycle is active and membership is valid","Progress Problem → Investigation → Solution Design → Build → Test → Reflection → Defence Preparation using submitted and independently verified evidence","When a milestone deadline is missed, record the miss and recovery date through O4; verify recovered evidence rather than hiding the miss","Record individual learner contribution evidence separately from team milestone evidence; verify independently before O16 linkage","Move to Defence Ready only when all seven milestones are verified","Hand the Defence Ready project to HPD-011; after a valid defence, complete/close the project with evidence","Complete/withdraw all projects before closing the Project Cycle"]'::jsonb,
    'Project milestone due dates are set when the cycle is created. Evidence should be submitted/verified while work remains observable; missed dates create recovery obligations rather than silent deadline changes.',
    '["Cycle/project/member record","Seven milestone schedule","Milestone evidence and independent verification","Missed milestone/recovery issue references","Individual contribution evidence and O16 project evidence links","Project stage/audit history","Project completion/withdrawal evidence"]'::jsonb,
    'Learners repeatedly practise collaborative problem solving with real investigation, building, testing, reflection and defensible individual contribution rather than completing decorative group assignments.',
    '["Team becomes infeasible → coordinating authority may reconstitute membership before Defence Ready with reason","Project unsafe/unworkable → withdraw with reason and retain learning history","Learner needs individual pathway → approved Personal Project through HPD-009","Public/off-site/money activity → relevant Safeguarding/Parent/Finance/Event controls also apply"]'::jsonb,
    '["Missed milestone → mentor/Sectional Promoter → Academic Inspector","Repeated section-wide project failure → Academic Inspector → School Guardian","Safety/consent concern → Safeguarding/Parent system","Finance/commercial concern → Finance/Young CEO controls","Public showcase need → HPD-011 then Events system"]'::jsonb,
    '["Active Builder Projects by stage","Teams with valid membership/lead","Milestones due/overdue/missed/recovered","Milestone evidence awaiting independent verification","Projects Defence Ready","Verified individual project evidence linked to O16","Projects completed/withdrawn with close-out evidence","Team-result automatic learner evidence (target: zero)"]'::jsonb,
    current_date,v_actor,now(),'active'
  ) on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'approver'),
    (v_process,v_ai,'owner'),
    (v_process,v_sp,'owner'),
    (v_process,v_teacher,'owner'),
    (v_process,v_si,'participant'),
    (v_process,v_sf,'participant'),
    (v_process,v_vc,'participant')
  on conflict do nothing;

  -- HPD-009 Personal Project
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='HPD-009';
  if v_process is null then raise exception 'HPD-009 process registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Give one learner end-to-end ownership of a meaningful project/capstone, especially the SS3 final-year Personal Project, without merging the capstone into WAEC/NECO preparation.',
    'A learner is assigned/approved for an individual Personal Project, including the standard SS3 capstone pathway.',
    '["Active Project Cycle","One active learner owner","Assigned mentor","Meaningful problem/inquiry","Seven milestone calendar","Required resources/safety constraints","Deliberately shared PipuPath project reference where applicable"]'::jsonb,
    '["Create the project as personal and add exactly one learner owner","Clarify the problem, intended beneficiary/inquiry purpose and mentor expectations","Progress the same evidence gates used for Builder Projects while preserving individual ownership","Mentor coaches but does not become the builder; learner produces the investigation, build/test/reflection evidence","Record specific individual evidence and independently verify it before O16 linkage","Move to Defence Ready only after all seven milestones are verified","Complete Builder Defence through HPD-011 and close project separately from exam preparation","Where learner deliberately shares a PipuPath/portfolio reference after defence, use HPD-013 rather than copying private project content"]'::jsonb,
    'Personal Project milestones follow the Project Cycle calendar. SS3 capstone timing must coexist with the external-exam preparation calendar rather than displacing required WAEC/NECO readiness.',
    '["Personal project/owner/mentor record","Seven milestone evidence/verification records","Missed milestone/recovery records","Individual project evidence linked to O16","Defence record/outcome","Project completion evidence","Learner-shared portfolio reference where applicable"]'::jsonb,
    'Learner demonstrates independent ownership from problem/inquiry through evidence, build/test, reflection and defence, leaving school with a defensible capstone rather than a teacher-built project.',
    '["Individual project becomes unsafe/infeasible → redesign/withdraw with evidence","Learner needs additional structure → mentor support may increase without transferring ownership","SS3 exam conflict → re-plan workload within approved cycle; do not abandon external-exam responsibilities","Non-SS3 learner has developmental need for personal rather than team project → Academic Inspector/School Guardian may approve"]'::jsonb,
    '["Missed milestone → mentor → Sectional Promoter/Academic Inspector","Persistent capstone risk → Academic Inspector → School Guardian","Safety/consent/off-site issue → Safeguarding/Parent controls","Exam-readiness conflict → Academic Execution leadership","Public showcase → HPD-011/Events"]'::jsonb,
    '["Active Personal Projects","SS3 capstones on track by milestone","Missed/recovered milestones","Verified individual project evidence","Defence Ready/completed personal projects","Personal projects with mentor over-dependence concerns","Projects closed without automatic exam substitution"]'::jsonb,
    current_date,v_actor,now(),'active'
  ) on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'approver'),
    (v_process,v_ai,'owner'),
    (v_process,v_sp,'participant'),
    (v_process,v_teacher,'owner'),
    (v_process,v_si,'participant'),
    (v_process,v_sf,'owner'),
    (v_process,v_vc,'participant')
  on conflict do nothing;

  -- HPD-011 Builder Defence/Showcase
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='HPD-011';
  if v_process is null then raise exception 'HPD-011 process registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Verify that a project can defend its problem, investigation, reasoning, build/test evidence, contribution and reflection, then determine whether it is complete, showcase-ready or requires revision.',
    'A Builder Team or Personal Project reaches Defence Ready with all seven milestones independently verified.',
    '["Defence Ready project","Verified seven-milestone record","Active/completed project membership","Scheduled date/location","Panel reference","Project/build/test/reflection evidence","Defence evidence capture"]'::jsonb,
    '["Academic Inspector/School Guardian schedules a defence attempt only for a Defence Ready project","Panel reviews evidence and questions learners about the problem, investigation, design reasoning, build/test result, limitations and learning","Record narrative panel feedback, learner response summary and defence evidence reference; do not create a popularity vote or compulsory composite project score","Choose one governed outcome: completed, showcase_ready or revision_required","If revision_required, return project to Reflection, set a revision due date and create an O4 Human Potential recovery issue","After revision, complete any necessary work/evidence and return the project to Defence Ready before scheduling another attempt","If completed/showcase_ready, project moves to Defended and may close through HPD-008/009","If showcase_ready, pass only the readiness/outcome into Event planning; Builder Summit/event logistics remain outside O20"]'::jsonb,
    'Defence is scheduled only after evidence readiness. Revision due dates are explicit. Event/showcase timing must not pressure panels into approving incomplete evidence.',
    '["Defence schedule/attempt number","Panel reference","Narrative feedback","Learner response summary","Defence evidence reference","Outcome","Revision issue/due date where applicable","Project status transition","Showcase readiness"]'::jsonb,
    'Projects can explain and defend the quality of their thinking/work; revision is treated as learning; public showcase selection does not replace institutional evidence standards.',
    '["Panel conflict/independence concern → reschedule or change panel","Project cannot safely/publicly demonstrate artefact → defend from appropriate evidence rather than forcing unsafe display","Revision required → recovery path, not humiliation","Project educationally complete but not showcase-ready → close as completed without penalty"]'::jsonb,
    '["Evidence dispute → Academic Inspector","Safety/consent issue → Safeguarding/Parent system","Showcase logistics → Events system","Repeated weak defence readiness across cohorts → Academic Inspector → School Guardian/Institutional Performance"]'::jsonb,
    '["Defence Ready projects","Defence attempts scheduled/completed","Revision-required defences and recovery status","Projects defended/completed","Showcase-ready projects","Numeric/popularity-based defence ranking records (target: zero)"]'::jsonb,
    current_date,v_actor,now(),'active'
  ) on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'approver'),
    (v_process,v_ai,'owner'),
    (v_process,v_sp,'participant'),
    (v_process,v_teacher,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sf,'participant'),
    (v_process,v_vc,'participant')
  on conflict do nothing;

  -- HPD-013 Portfolio & Builder Record
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='HPD-013';
  if v_process is null then raise exception 'HPD-013 process registration is missing.'; end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Preserve verified project evidence in the Human Potential Record while keeping the learner portfolio learner-owned and PipuPath-facing.',
    'A project member demonstrates an individual contribution, or a learner deliberately shares a defended/completed project/portfolio reference for school evidence.',
    '["Project/member record","Specific individual contribution observation and evidence reference","Independent verifier","Defended/completed project for portfolio handoff","Learner-deliberate sharing confirmation","PipuPath/project/portfolio reference only, not private content"]'::jsonb,
    '["Record individual project contribution against a real project member with dimension, note, evidence reference and observed time","Independent project verifier accepts/returns the evidence; verified contribution links to O16 as project evidence","Never infer individual contribution solely from team project completion","After project defence/completion, record a learner-shared portfolio/project reference only when deliberate sharing is explicitly confirmed","Independent verifier confirms the shared reference and institutional purpose; verified reference links to O16 as learner_shared_portfolio evidence","Do not ingest private PipuPath project/reflection/profile/network content; retain the reference rather than copying the learner workspace","Use O16 Potential Progress Review/Human Potential Record to interpret evidence over time; O20 itself does not permanently label the learner","Keep PipuPath cohort integration aggregate-only and separate from individual project evidence"]'::jsonb,
    'Contribution evidence should be recorded close to the observed work. Portfolio references are recorded only after defence/completion and deliberate learner sharing.',
    '["Individual project contribution record","Independent verification/return","Linked O16 project evidence ID","Learner sharing confirmation","Portfolio/project reference and share note","Independent portfolio-link verification","Linked O16 learner_shared_portfolio evidence ID","Withdrawal history for unverified evidence/references"]'::jsonb,
    'Each learner can leave with a credible evidence trail of what they personally built/contributed while retaining ownership/privacy of their full PipuPath portfolio.',
    '["Learner does not wish to share portfolio reference → no institutional portfolio link; school-owned project evidence remains valid","Team project has strong result but learner contribution cannot be evidenced → do not create individual evidence","Shared reference later becomes inaccessible → historical verification remains auditable; do not scrape private content","Learner requests correction of an unverified shared reference → return/withdraw through the governed record"]'::jsonb,
    '["Evidence quality dispute → Sectional Promoter/Academic Inspector","Privacy/consent concern → Parent/Safeguarding/Data policy route","PipuPath integration issue → PipuPath connector/system owner without bypassing privacy boundary","Systemic lack of individual evidence → Academic Inspector/School Guardian programme review"]'::jsonb,
    '["Submitted/verified individual project evidence","Verified O16 project evidence links","Learner-shared portfolio references submitted/verified","Verified O16 learner_shared_portfolio links","Team-result auto-credit (target: zero)","Private PipuPath content ingested into KHP-OS (target: zero)"]'::jsonb,
    current_date,v_actor,now(),'active'
  ) on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'approver'),
    (v_process,v_ai,'owner'),
    (v_process,v_sp,'owner'),
    (v_process,v_teacher,'owner'),
    (v_process,v_si,'participant'),
    (v_process,v_sf,'participant'),
    (v_process,v_vc,'participant')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o20_builder_projects_bootstrapped',
    'organisation',v_org,
    jsonb_build_object(
      'activePolicy','HPD-P03',
      'publishedProcesses',jsonb_build_array('HPD-008','HPD-009','HPD-011','HPD-013'),
      'architectureVersion','O20-v1.0',
      'seededCycles',0,
      'seededProjects',0,
      'seededMembers',0,
      'seededMilestoneEvidence',0,
      'seededDefences',0,
      'seededIndividualEvidence',0,
      'seededPortfolioLinks',0,
      'guardrails',jsonb_build_array(
        'PipuPath remains learner-facing/private',
        'KHP-OS governs execution not private project content',
        'Meaningful problem before solution/showcase',
        'No team-result automatic learner credit',
        'Independent milestone/member/portfolio verification',
        'All seven milestones before Defence Ready',
        'Defence uses narrative evidence not popularity/composite score',
        'SS3 Personal Project remains separate from WAEC/NECO',
        'Public showcase logistics remain Events/Special Programmes'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o20_builder_projects_bootstrapped'
  );
end;
$$;
