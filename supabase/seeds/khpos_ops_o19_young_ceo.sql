-- KNS O19 Young CEO Hub / Value Creation.
-- Publishes HPD-P04 and HPD-007 without fabricating cycles, sessions,
-- ventures, learners, milestones or value-creation evidence.

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
  where organisation_id=v_org and code='HPD-P04';

  if v_policy is null then
    raise exception 'HPD-P04 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Develop learners who can create responsible value: identify a real problem, understand a user/customer, build a useful response, understand cost and price, communicate value, test responsibly, manage money records and improve from evidence.',
    'KNS Young CEO Hub cycles, sessions, learner ventures, value/sales tests and individual value-creation evidence for enrolled KNS learners. External Young CEO Challenge participants/events use the Events & Special Programmes architecture and are not silently enrolled into the internal school Hub.',
    '["Young CEO means value creator, not child cash-chaser: solving a meaningful problem and learning how value works comes before profit.","Simulation is a valid learning route; no learner is required to sell for real money to prove entrepreneurship or value-creation capability.","A successful team result is not automatic evidence for every member; individual contribution must be observed and verified separately.","Profit, revenue, popularity or pitch charisma cannot become a single Young CEO ranking or automatic potential label.","The venture journey is Problem → Customer/User → Solution → Value Proposition → Costing → Pricing → Communication/Pitch → Selling/Value Test → Money Management → Iteration.","Real-money activity must remain age-appropriate, approved, safeguarded and referenced to Finance/Admin records; KHP-OS is not a cash ledger or marketplace.","Learners must not be placed into debt, speculative investment, gambling-like activity, unsafe work, deceptive selling or age-restricted/illegal goods/services in the name of entrepreneurship.","PipuPath may guide missions/reflection/portfolio privately; KHP-OS stores school-owned execution and deliberately shared evidence references only.","Failure of an idea, test or sale is learning evidence when reflected upon responsibly; it is not automatic learner failure."]'::jsonb,
    '["Every Young CEO Hub cycle has a term, campus, accountable owner, dates and delivery record.","Required Hub sessions are planned and evidenced; missed required sessions create an O4 Human Potential Development recovery issue rather than disappearing.","A venture may be individual or team-based. Each learner may have only one active venture in the same Hub cycle so responsibility is clear.","Every venture begins with a real problem statement and receives ten required milestones: Problem, Customer/User, Solution, Value Proposition, Costing, Pricing, Communication/Pitch, Selling/Value Test, Money Management and Iteration.","Milestone evidence is submitted by a facilitator/owner and independently verified by School Guardian or Skill Inspector; the submitter cannot verify their own milestone evidence.","Venture stages cannot advance simply because time passed: core milestones gate Building, financial/communication milestones gate Selling, and all ten milestones must be independently verified before venture completion.","Simulation is the default sales mode. Internal-school real-money selling requires an appropriate Finance/Admin record reference before the selling stage. External selling additionally requires the applicable school/safeguarding/parent-consent approval reference.","KHP-OS records only approval/Finance references for real transactions; payment collection, refunds, custody and accounting remain in Finance/Admin/approved transaction systems.","Individual value-creation evidence requires an active venture member, specific contribution note, evidence reference and observed time. Only independently verified evidence links into O16 as value_creation evidence.","Venture completion does not auto-create evidence for team members. A learner receives only the individual evidence actually demonstrated and verified.","Private PipuPath journals, profile inference or private network content must not be copied into KHP-OS as institutional evidence without deliberate learner-sharing and an appropriate school purpose.","Young CEO Hub does not replace HPD-006 Financial Capability: O18 develops foundational financial judgement; O19 applies value creation in a venture context.","Young CEO Hub does not replace Builder Project/Personal Project: O19 focuses value creation; HPD-P03 later governs formal Builder Projects, Defence, Showcase and Portfolio."]'::jsonb,
    '["Skill Inspector: primary Young CEO Hub operating owner; plans cycles, maintains standards, verifies milestone/member evidence where independent, and escalates commercial/safety exceptions.","School Guardian: approves/oversees material Young CEO commercial exposure, may verify independently, and owns whole-school compliance and exceptions.","Teachers/Skills Facilitators/Sectional Promoters: may facilitate assigned cycles/ventures/sessions, coach teams, submit milestone evidence and record individual contribution evidence within governed learner visibility.","Learner: chooses/participates in a venture, contributes to problem/customer/solution/value work, reflects on results and is accountable for their own contribution; learner is not personally liable for school-controlled commercial obligations.","Finance/Admin: owns real-money transaction/custody/accounting records and provides the reference used by O19.","Safeguarding/Parent Experience owners: provide applicable approval/consent/safety controls for external or higher-exposure activities.","Vision Custodian: sees aggregate strategic health/risks and does not routinely receive learner-level O19 evidence merely by being executive."]'::jsonb,
    '["Do not describe a learner as an entrepreneur/CEO merely because they attended Hub sessions.","Do not rank Young CEO learners primarily by money made, revenue, profit, likes, votes or popularity.","Do not require a learner to invest personal money, borrow, enter debt or guarantee school-controlled venture obligations.","Do not permit gambling, betting, speculative schemes, deceptive claims, unsafe work, age-restricted products/services, unlawful trade or exploitation.","Do not begin external real-money selling without the applicable institutional/safeguarding/parent-consent approval reference.","Do not enter real-money selling stage without the Finance/Admin transaction-record reference.","Do not record team success as individual evidence for inactive/non-contributing members.","Do not let the person who submitted milestone/member evidence verify that same evidence.","Do not waive any of the ten core venture milestones merely to make a venture appear complete.","Do not copy private PipuPath reflection/profile/network data into the institutional record by default.","Do not use O19 as a payment processor, sales ledger, inventory ledger or substitute for Finance/Admin controls."]'::jsonb,
    '["A simulation-only venture may complete all value-creation learning without real sales.","An idea or venture may be withdrawn with a recorded reason; withdrawal is not adverse academic/behaviour evidence by itself.","A missed Hub session may be recovered with evidence; School Guardian/Skill Inspector may waive a recovery obligation only with a documented operational reason, while the original miss remains in history.","External Young CEO Challenge or public-facing competition participants may include non-KNS learners only through the appropriate Events/Special Programmes registration, safeguarding, consent and commercial controls rather than internal learner anchors.","Where safeguarding/security requires immediate stopping of a venture or sales activity, safety controls override normal venture progression and the operational record is reconciled afterward."]'::jsonb,
    '["Missed required Hub delivery → O4 issue to session owner, then Skill Inspector/School Guardian if overdue.","Unsafe, exploitative, coercive or inappropriate learner/customer interaction → Safeguarding route immediately.","Real-money discrepancy/refund/cash-custody concern → Finance Governance route; O19 retains only the reference.","External selling/marketing exposure without required approvals → School Guardian and Safeguarding/Parent Experience owners before continuation.","Repeated inability to complete milestones → facilitator/Skill Inspector coaching and review, not fabricated verification.","Material Young CEO programme failure across a term → School Guardian then Institutional Performance review.","External Young CEO Challenge/event exception → Events & Special Programmes system."]'::jsonb,
    '["Young CEO Hub cycle and session records","Session delivery evidence and O4 recovery issue/reference where missed","Venture canvas: problem, user/customer, solution and value proposition","Sales mode and applicable approval/Finance references","Ten venture milestone evidence/verification records","Venture membership history","Individual value-creation contribution evidence and independent verification","Linked O16 value_creation evidence ID for verified individual contribution","Venture completion/withdrawal record","Programme audit events and close-out evidence"]'::jsonb,
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
  where organisation_id=v_org and code='HPD-007';

  if v_process is null then
    raise exception 'HPD-007 process registration is missing.';
  end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Give learners a repeatable value-creation journey from problem discovery to responsible testing, money understanding and iteration, with individual evidence rather than profit-only competition.',
    'A new academic-term Young CEO Hub cycle is planned, a Hub session is scheduled, learners form an individual/team venture, or a venture is ready to submit/verify milestone or individual contribution evidence.',
    '["Active academic term and campus","Young CEO Hub cycle owner","Planned Hub sessions","Active enrolled learner anchors","Venture problem statement and individual/team mode","Ten milestone evidence requirements","Applicable external-selling approvals and Finance/Admin reference where real money is used","Individual learner contribution evidence","PipuPath references only where deliberately shared"]'::jsonb,
    '["Create the term/campus Young CEO Hub cycle with accountable owner and dates","Plan recurring Hub sessions with theme, purpose and owner; deliver with evidence or record miss/recovery through O4","Create individual/team ventures from a clearly stated real problem","Add active learner members; one learner may hold only one active venture in the same cycle","Progress the venture through the ten core milestones; staff submits specific evidence and School Guardian/Skill Inspector independently verifies or returns it","Keep venture canvas current: problem, target user/customer, solution, value proposition and sales mode","Before real-money selling, establish the applicable approval and Finance/Admin transaction references; simulation requires neither real-money exposure nor personal learner funds","Advance venture stages only when the required verified milestones are complete","Record individual member evidence separately from team milestone success; verify independently and link only verified contribution into O16 as value_creation evidence","Complete a venture only after all ten milestones are verified; venture completion creates no automatic evidence for members","Close the Hub cycle only after planned/missed session obligations are resolved and retain programme close-out evidence","Feed programme delivery/value-creation patterns into HPD-012 term review and Institutional Performance without creating learner league tables"]'::jsonb,
    'Plan Hub sessions before delivery and record delivered/missed status close to the scheduled date. Missed required sessions receive a recovery due date. Venture milestone/member evidence should be recorded while the activity and contribution remain verifiable.',
    '["Cycle/session plan and owner","Session delivery/missed/recovery evidence","Venture/member records","Problem/customer/solution/value canvas","Ten milestone evidence and independent verification","Sales mode plus approval/Finance references where applicable","Individual contribution evidence and independent verification","Linked O16 value_creation evidence","Venture and cycle close-out evidence"]'::jsonb,
    'Learners repeatedly practise creating useful value, understand customers/users and money, communicate and test ideas responsibly, learn from failure/feedback, and leave with verified individual evidence rather than a superficial CEO title.',
    '["Simulation-only venture → fully valid pathway; real sale is not required","Venture does not work commercially → analyse evidence, iterate or close responsibly; do not punish the learner for market response","Learner changes/withdraws from venture → preserve membership history and contribution evidence; learner may join another venture after active membership ends","External/public Young CEO Challenge → Events & Special Programmes controls, not internal Hub membership","Safeguarding/commercial exposure concern → stop/restrict activity and route to the appropriate system before continuation","Private PipuPath evidence unavailable → not a blocker; school-owned evidence remains sufficient"]'::jsonb,
    '["Missed Hub session → O4 issue → session owner → Skill Inspector/School Guardian","Milestone/evidence quality dispute → Skill Inspector/School Guardian","Real-money/cash/refund issue → Finance Governance","External sales approval/parent/safeguarding concern → School Guardian + appropriate Safeguarding/Parent route","Persistent Young CEO programme execution failure → School Guardian/Institutional Performance","External Young CEO Challenge exception → Events & Special Programmes"]'::jsonb,
    '["Active Young CEO cycles","Planned/delivered/missed/recovered sessions","Active ventures by stage","Ventures with all ten milestones independently verified","Milestones awaiting verification","Real-money ventures with required approval/Finance references","Submitted individual evidence awaiting verification","Verified individual value_creation evidence linked to O16","Self-verified milestone/member evidence (target: zero)","Profit-only learner ranking records (target: zero)","Learners with verified evidence across multiple value-creation dimensions"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes
  set status='active',updated_at=now()
  where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_vc,'participant'),
    (v_process,v_sg,'approver'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'owner'),
    (v_process,v_sp,'participant'),
    (v_process,v_teacher,'participant'),
    (v_process,v_sf,'owner')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o19_young_ceo_bootstrapped',
    'organisation',v_org,
    jsonb_build_object(
      'activePolicy','HPD-P04',
      'publishedProcesses',jsonb_build_array('HPD-007'),
      'architectureVersion','O19-v1.0',
      'seededCycles',0,
      'seededSessions',0,
      'seededVentures',0,
      'seededMembers',0,
      'seededMilestoneEvidence',0,
      'seededMemberEvidence',0,
      'guardrails',jsonb_build_array(
        'Value creation before profit',
        'Simulation is a valid pathway',
        'No learner debt/speculation/age-restricted trade',
        'No profit-only ranking',
        'No team-result auto-credit',
        'Independent milestone/member-evidence verification',
        'Real-money activity references Finance/Admin',
        'External selling requires institutional/safeguarding/parent approval reference',
        'Private PipuPath content is not copied',
        'External Young CEO Challenge remains Events/Special Programmes'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o19_young_ceo_bootstrapped'
  );
end;
$$;
