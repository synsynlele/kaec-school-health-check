-- KNS O18 Leadership Development & Financial Capability.
-- HPD-P01 already governs both processes. This seed publishes HPD-005 and HPD-006
-- without fabricating learner evidence or participation records.

do $$
declare
  v_org uuid;
  v_actor uuid;
  v_policy uuid;
  v_process uuid;
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

  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='HPD-P01';

  if v_policy is null then
    raise exception 'HPD-P01 policy registration is missing.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_policy_versions
    where policy_id=v_policy and status='active'
  ) then
    raise exception 'HPD-P01 must have an active governed policy version before O18.';
  end if;

  select id into v_sg from public.khpos_ops_roles where organisation_id=v_org and code='SCHOOL_GUARDIAN';
  select id into v_ai from public.khpos_ops_roles where organisation_id=v_org and code='ACADEMIC_INSPECTOR';
  select id into v_si from public.khpos_ops_roles where organisation_id=v_org and code='SKILL_INSPECTOR';
  select id into v_sp from public.khpos_ops_roles where organisation_id=v_org and code='SECTIONAL_PROMOTER';
  select id into v_teacher from public.khpos_ops_roles where organisation_id=v_org and code='TEACHER';
  select id into v_sf from public.khpos_ops_roles where organisation_id=v_org and code='SKILLS_FACILITATOR';

  if v_sg is null or v_ai is null or v_si is null
     or v_sp is null or v_teacher is null or v_sf is null then
    raise exception 'Required KNS Human Potential roles are missing.';
  end if;

  update public.khpos_ops_policies
  set status='active',updated_at=now()
  where id=v_policy;

  -- HPD-005 Leadership Development
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='HPD-005';

  if v_process is null then
    raise exception 'HPD-005 process registration is missing.';
  end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Develop leadership as demonstrated responsibility, service, initiative, communication, decision-making and contribution rather than title, popularity or a permanent label.',
    'A learner receives a school-owned leadership/service opportunity, demonstrates leadership behaviour during ordinary school life, or a structured Leadership Lab/activity is planned.',
    '["Active learner anchor and active term","School-owned leadership opportunity or observable leadership context","Applicable adult owner/observer","Specific behaviour or contribution evidence","School-owned or learner-shared evidence reference","Optional school reflection/debrief reference"]'::jsonb,
    '["Plan meaningful leadership opportunities such as Leadership Lab, service, initiative, team responsibility, representation, problem-solving, peer support, event roles, council service or community contribution","Keep Builders Council seat selection/recall in the Student Culture system; O18 records only leadership-development evidence arising from service/responsibility","Give learners increasing responsibility appropriate to context rather than treating a title as proof of leadership","Observe specific dimensions such as initiative, responsibility, service, communication, conflict handling, reliability, decision-making, team contribution, mobilisation or problem-solving","Record specific evidence with date/context/reference; do not create a numeric leadership score","A different authorised coordinating leader independently verifies or returns submitted evidence","Verified evidence creates linked school-owned O16 Leadership evidence; verification does not automatically promote a potential hypothesis","Use HPD-010 for a school-owned reflection summary where meaningful; never copy private PipuPath journals routinely","Use HPD-012 term review to synthesise patterns across evidence rather than declaring a fixed leadership identity"]'::jsonb,
    'Record material leadership evidence close enough to the experience that the observed behaviour, context and contribution remain verifiable. Leadership opportunities should be reviewed during the term rather than only at term end.',
    '["Leadership opportunity/reference and owner","Opportunity purpose/status/completion evidence","Learner leadership evidence dimension","Specific observation/evidence note","Evidence reference and observed time","Independent verification/return/withdrawal trail","Linked O16 potential evidence ID where verified","Optional HPD-010 reflection reference"]'::jsonb,
    'Learners progressively practise leadership through real responsibility and service, while KNS can show evidence of growth without reducing leadership to badges, titles, popularity or numerical ranking.',
    '["Learner holds a Builders Council seat → seat governance stays in Student Culture; O18 records only development evidence","Safeguarding or welfare concern arises → safeguarding route immediately, not ordinary leadership evidence","No meaningful behaviour demonstrated → do not fabricate evidence because learner attended an activity","Adult disagreement about interpretation → return evidence for clarification or gather further observation","Private PipuPath reflection unavailable → not a blocker; use school-owned evidence only"]'::jsonb,
    '["Routine evidence-quality gap → opportunity owner/Sectional Promoter","Repeated weak leadership-opportunity execution → Sectional Promoter/School Guardian","Whole-school lack of meaningful leadership opportunities → School Guardian","Safeguarding/welfare concern → designated safeguarding route","Student Council governance/recall matter → Student Culture system rather than O18"]'::jsonb,
    '["Active leadership opportunities","Completed leadership opportunities with evidence","Submitted leadership evidence awaiting independent verification","Verified leadership evidence by dimension","Self-verified leadership evidence (target: zero)","Numeric leadership ranking/score records (target: zero)","Learners with repeated evidence of responsibility/service across the term"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes
  set status='active',updated_at=now()
  where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'owner'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'owner'),
    (v_process,v_teacher,'participant'),
    (v_process,v_sf,'participant')
  on conflict do nothing;

  -- HPD-006 Financial Capability
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='HPD-006';

  if v_process is null then
    raise exception 'HPD-006 process registration is missing.';
  end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Build practical financial capability through age-appropriate budgeting, saving, costing, pricing, revenue/profit thinking, opportunity cost, responsible spending, record-keeping, value creation and investment concepts.',
    'A Friday Financial Literacy/Lab activity is planned, a learner applies money/value-creation thinking in a project or skill, or a school-owned financial-capability challenge produces observable evidence.',
    '["Active learner anchor and active term","Planned Financial Capability activity/context","Assigned facilitator/owner","Practical task, decision or application opportunity","School-owned evidence reference","Recovery plan where planned delivery is missed"]'::jsonb,
    '["Plan practical Financial Capability activities rather than relying only on lectures","Use age-appropriate examples and distinguish learning simulations from real financial advice or promises of returns","Expose and practise budgeting, saving, costing, pricing, revenue/profit, opportunity cost, responsible spending, record-keeping, value creation and basic investment concepts","Record delivery outcome and school-owned evidence; attendance alone never proves financial capability","If a required activity is missed, record a recovery date and create an O4 Human Potential Development issue rather than silently losing the learning","Record learner evidence only when the learner makes or explains a relevant decision, calculation, plan, comparison or value-creation application","A different authorised coordinating leader independently verifies or returns evidence","Verified evidence creates linked school-owned O16 Financial Capability evidence; verification does not automatically infer entrepreneurship readiness","Young CEO commercial/value-creation workflow remains HPD-007/O19; O18 supplies foundational capability evidence without duplicating that programme","Use HPD-010 reflection and HPD-012 term review where useful; do not copy private PipuPath reflections"]'::jsonb,
    'Required Financial Capability activities should be delivered in the scheduled cycle. Missed required delivery receives an explicit recovery due date and O4 issue. Evidence should be recorded close to the practical application.',
    '["Financial Capability activity/reference, type, owner and planned date","Delivery/missed/cancelled outcome","Recovery due date and O4 issue where missed","Learner capability dimension and practical evidence","Evidence reference and observed time","Independent verification/return/withdrawal trail","Linked O16 financial-capability evidence ID where verified"]'::jsonb,
    'Learners increasingly make sound age-appropriate financial decisions and understand how value, cost, price, money and trade-offs work in practical contexts—not merely recall financial vocabulary.',
    '["Approved calendar change cancels an activity → record cancellation; do not automatically label facilitator failure","Missed required delivery → recovery + O4 issue","Real-money investment or regulated financial product decision → outside O18; age-appropriate education only","Safeguarding/exploitation concern involving money → safeguarding route immediately","Young CEO enterprise activity → O19 governs the commercial challenge; O18 may verify foundational financial evidence arising from it","No practical evidence → do not fabricate competence from attendance or test score alone"]'::jsonb,
    '["Missed Financial Capability delivery → activity owner then Sectional Promoter/School Guardian through O4","Repeated programme-delivery failure → School Guardian","Resource constraint preventing required learning → School Guardian/O4","Safeguarding/exploitation concern → designated safeguarding route","Young CEO/value-creation programme issue → HPD-007/O19"]'::jsonb,
    '["Planned vs delivered Financial Capability activities","Missed activities with recovery/O4 issue","Recovery completion","Submitted financial-capability evidence awaiting verification","Verified evidence by capability dimension","Self-verified financial evidence (target: zero)","Attendance-only capability claims (target: zero)","Learners with applied budgeting/costing/pricing/value evidence across the term"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes
  set status='active',updated_at=now()
  where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_sg,'approver'),
    (v_process,v_ai,'participant'),
    (v_process,v_si,'participant'),
    (v_process,v_sp,'owner'),
    (v_process,v_teacher,'owner'),
    (v_process,v_sf,'owner')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o18_leadership_financial_bootstrapped',
    'organisation',v_org,
    jsonb_build_object(
      'governingPolicy','HPD-P01',
      'publishedProcesses',jsonb_build_array('HPD-005','HPD-006'),
      'architectureVersion','O18-v1.0',
      'seededLeadershipOpportunities',0,
      'seededFinancialActivities',0,
      'seededCapabilityEvidence',0,
      'guardrails',jsonb_build_array(
        'Leadership is demonstrated, not awarded by title',
        'No numeric leadership ranking',
        'Attendance is not financial capability',
        'Evidence recorder cannot self-verify',
        'Verified evidence links to O16',
        'Missed required Financial Capability delivery creates O4 recovery issue',
        'Builders Council governance remains in Student Culture',
        'Private PipuPath content is not copied'
      )
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o18_leadership_financial_bootstrapped'
  );
end;
$$;
