-- KNS O16 Potential Discovery & Progress foundation.
-- HPD-P01 already governs the domain. This seed operationalises the missing
-- discovery/exploration/reflection/review processes without copying private PipuPath content.

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
  select id into v_si from public.khpos_ops_roles where organisation_id=v_org and code='SKILL_INSPECTOR';
  select id into v_sp from public.khpos_ops_roles where organisation_id=v_org and code='SECTIONAL_PROMOTER';
  select id into v_teacher from public.khpos_ops_roles where organisation_id=v_org and code='TEACHER';
  select id into v_facilitator from public.khpos_ops_roles where organisation_id=v_org and code='SKILLS_FACILITATOR';

  if v_vc is null or v_sg is null or v_ai is null or v_si is null
     or v_sp is null or v_teacher is null or v_facilitator is null then
    raise exception 'Required KNS Human Potential roles are missing.';
  end if;

  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='HPD-P01';

  if v_policy is null then raise exception 'HPD-P01 policy registration is missing.'; end if;

  if not exists(
    select 1 from public.khpos_ops_policy_versions
    where policy_id=v_policy and status='active'
  ) then
    raise exception 'HPD-P01 must have an active governed version before O16.';
  end if;

  for v_row in
    select *
    from (
      values
      (
        'HPD-001',
        'Build an evidence-based discovery record from learner interests, curiosity, meaningful problems, repeated choices and recurring strengths without fixing the learner into a permanent talent label.',
        'An active learner enters a term, new evidence changes understanding, or the learner has no current discovery record for the term.',
        '["Active O14 learner anchor","Active academic term","School-owned observations/conversations","Evidence reference","Existing discovery history where applicable"]'::jsonb,
        '["Observe and discuss interests, curiosity, meaningful problems, repeated choices and recurring strengths","Record only evidence-supported observations; do not diagnose personality or permanently label potential","Attach a concise evidence reference","Where the term discovery record changes, supersede the previous active version rather than silently editing history","Use discovery as input to open potential hypotheses and exploration—not as proof of mastery"]'::jsonb,
        'Keep discovery current enough to support term planning and the Potential Progress Review; update when material new evidence changes the picture.',
        '["Discovery record/reference","Observation/conversation note","Evidence reference","Version/supersession trail"]'::jsonb,
        'Each learner develops a living, revisable evidence-based discovery record that guides exploration without becoming a fixed identity label.',
        '["Sensitive safeguarding/welfare disclosure → safeguarding route, not ordinary discovery record","Private PipuPath profile/reflection → do not copy; only learner-shared evidence reference may be recorded","Insufficient evidence → keep the hypothesis open/exploratory rather than claiming certainty"]'::jsonb,
        '["Classroom discovery gap → Teacher/Sectional Promoter","Skills discovery gap → Skills Facilitator/Skill Inspector","Whole-school pattern/resource constraint → School Guardian"]'::jsonb,
        '["Active learners with current term discovery","Discovery records updated with evidence","Fixed-label/potential-score usage (target: zero)"]'::jsonb
      ),
      (
        'HPD-002',
        'Turn promising potential hypotheses into deliberate exposure, practice, challenge, project, conversation, shadowing or service opportunities that create new evidence.',
        'Discovery suggests an area worth testing, a hypothesis needs stronger evidence, or a prior exploration produces a new developmental question.',
        '["Visible learner","Active academic term","Optional active potential hypothesis","Exploration purpose","Named active owner assignment","Planned/review dates"]'::jsonb,
        '["Define the area to explore and why it matters","Link to an active hypothesis when relevant without making the hypothesis compulsory","Choose an appropriate exploration mode","Assign a competent active owner","Set planned and review dates","Execute the exploration","Complete with an outcome note and evidence reference","Use the outcome to update evidence/hypothesis state rather than awarding an automatic score"]'::jsonb,
        'Explorations should be reviewed within the same planned cycle/term and not remain indefinitely open.',
        '["Exploration reference/type/area/purpose","Owner and dates","Outcome note","Evidence reference","Status trail"]'::jsonb,
        'Learners test possibilities through real experiences so potential understanding becomes progressively more evidence-based.',
        '["Unsafe activity → safeguarding/safety route immediately","Unavailable resource/owner → reschedule or cancel transparently","Exploration produces no meaningful evidence → record the outcome honestly; do not manufacture progress"]'::jsonb,
        '["Owner issue → Sectional Promoter/Skill Inspector as appropriate","Cross-functional/resource constraint → School Guardian","Safety/welfare concern → safeguarding route"]'::jsonb,
        '["Open explorations","Overdue reviews","Completed explorations with evidence","Hypotheses receiving new evidence"]'::jsonb
      ),
      (
        'HPD-010',
        'Capture school-owned reflection summaries that convert experience into learning and next action without copying private learner journals or PipuPath private reflections.',
        'A meaningful skills, project, leadership, value-creation or discovery experience is debriefed, or a learner explicitly shares a summary/evidence for institutional use.',
        '["Visible learner","Active academic term","Reflection/debrief context","Learning summary","Next step where relevant","Evidence reference"]'::jsonb,
        '["Hold/receive the appropriate school reflection or debrief","Record the learning summary rather than a verbatim private journal","Record the next step where useful","Attach a school-owned or learner-shared evidence reference","Keep private PipuPath profile/missions/reflections outside O16","Use the reflection as evidence for exploration and termly potential review"]'::jsonb,
        'Capture reflection near enough to the experience that the learning and next step remain useful.',
        '["Reflection reference/type","Learning summary","Next step","Evidence reference","Recorded/reflected time"]'::jsonb,
        'Meaningful experiences produce institutional learning evidence without compromising learner privacy.',
        '["Safeguarding disclosure → restricted safeguarding record instead of ordinary reflection","Learner declines to share private PipuPath content → respect privacy; use school-owned evidence only","No meaningful learning yet → do not force a fabricated reflection"]'::jsonb,
        '["Routine reflection gap → Teacher/Facilitator","Repeated missing reflection evidence → Sectional Promoter/Skill Inspector","Privacy/safeguarding concern → designated safeguarding route"]'::jsonb,
        '["Learners with term reflection evidence","Experiences followed by meaningful reflection","Private PipuPath content copied into O16 (target: zero)"]'::jsonb
      ),
      (
        'HPD-012',
        'Produce a termly Human Potential Progress Review that synthesises discovery, open hypotheses, evidence, development, contribution and next priorities without reducing the learner to a score.',
        'A term has sufficient discovery/evidence/reflection for review, or a formal term potential review is due.',
        '["Learner and term","Active term discovery record","At least one active potential hypothesis","Active term evidence","At least one school-owned reflection summary","Development/contribution summary","Next priorities","Optional portfolio reference"]'::jsonb,
        '["Prepare the review from discovery, hypotheses, evidence, development and contribution","Keep hypotheses provisional and evidence-linked","Submit only after the required discovery/evidence/reflection gates are present","Sectional Promoter or School Guardian independently reviews","Return for correction where evidence is weak or claims exceed evidence","Approve only when the review accurately represents current development","Use next priorities to inform the following term; do not convert the review into a numerical potential ranking"]'::jsonb,
        'Complete once per governed term where sufficient learner-development activity exists and before next-term priorities are finalised.',
        '["Potential review/reference","Discovery/hypothesis/evidence/development/contribution summaries","Next priorities","Optional portfolio reference","Submission/return/approval trail"]'::jsonb,
        'KNS can show how each learner is progressively discovering and developing potential through evidence, while keeping identity open to new evidence.',
        '["Insufficient evidence → do not approve; return/continue exploration","Private PipuPath data unavailable → not a blocker; use school-owned/learner-shared evidence only","Serious welfare/safeguarding issue → appropriate restricted route"]'::jsonb,
        '["Preparation gap → Teacher/Facilitator/Sectional Promoter","Approval/evidence-quality issue → Sectional Promoter/School Guardian","Systemic weak discovery/evidence practice → School Guardian"]'::jsonb,
        '["Reviews submitted with all evidence gates","Returned reviews by reason","Approved reviews","Self-approved reviews (target: zero)","Numeric potential rankings (target: zero)"]'::jsonb
      )
    ) as x(code,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,exception_conditions,escalation,kpis)
  loop
    select id into v_process
    from public.khpos_ops_processes
    where organisation_id=v_org and code=v_row.code;

    if v_process is null then
      raise exception 'Required process % is not registered.',v_row.code;
    end if;

    insert into public.khpos_ops_process_versions(
      process_id,version,purpose,trigger,inputs,steps,sla,evidence,
      expected_outcome,exception_conditions,escalation,kpis,
      effective_date,approved_by,approved_at,status
    ) values (
      v_process,1,v_row.purpose,v_row.trigger,v_row.inputs,v_row.steps,v_row.sla,
      v_row.evidence,v_row.expected_outcome,v_row.exception_conditions,
      v_row.escalation,v_row.kpis,current_date,v_actor,now(),'active'
    )
    on conflict (process_id,version) do nothing;

    update public.khpos_ops_processes
    set status='active',updated_at=now()
    where id=v_process;
  end loop;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='HPD-001';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_teacher,'owner'),(v_process,v_facilitator,'owner'),
    (v_process,v_sp,'participant'),(v_process,v_si,'participant'),
    (v_process,v_sg,'approver'),(v_process,v_vc,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='HPD-002';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_teacher,'owner'),(v_process,v_facilitator,'owner'),
    (v_process,v_sp,'participant'),(v_process,v_si,'participant'),
    (v_process,v_sg,'approver'),(v_process,v_vc,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='HPD-010';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_teacher,'owner'),(v_process,v_facilitator,'owner'),
    (v_process,v_sp,'participant'),(v_process,v_si,'participant'),
    (v_process,v_sg,'approver'),(v_process,v_vc,'informed')
  on conflict do nothing;

  select id into v_process from public.khpos_ops_processes where organisation_id=v_org and code='HPD-012';
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_teacher,'participant'),(v_process,v_facilitator,'participant'),
    (v_process,v_sp,'owner'),(v_process,v_si,'participant'),
    (v_process,v_sg,'approver'),(v_process,v_vc,'informed')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select v_org,v_actor,'ops_o16_potential_discovery_bootstrapped',
    'organisation',v_org,
    jsonb_build_object(
      'governingPolicy','HPD-P01',
      'publishedProcesses',jsonb_build_array('HPD-001','HPD-002','HPD-010','HPD-012'),
      'architectureVersion','O16-v1.0',
      'seededDiscoveryRecords',0,
      'seededHypotheses',0,
      'seededEvidence',0,
      'seededExplorations',0,
      'seededReflections',0,
      'seededReviews',0,
      'guardrails',jsonb_build_array(
        'No permanent talent labels',
        'No numerical potential score',
        'No private PipuPath content copied into O16',
        'Participation is not mastery',
        'Potential review requires discovery + hypothesis + evidence + reflection',
        'Review preparer cannot self-approve'
      )
    )
  where not exists(
    select 1 from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o16_potential_discovery_bootstrapped'
  );
end;
$$;
