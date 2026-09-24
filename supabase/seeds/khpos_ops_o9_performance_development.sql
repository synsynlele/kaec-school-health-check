-- KNS O9 Staff Performance & Development.
-- O6 owns governed KPI definitions/measurements.
-- O9 owns evidence-based dialogue, coaching and verified development.
-- No staff ratings, rankings or disciplinary conclusions are seeded.

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

  -- PEO-P05 Staff Performance & Development Policy
  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='PEO-P05';

  if v_policy is null then
    raise exception 'PEO-P05 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Create a continuous evidence-based performance and development system that helps KNS staff understand expectations, strengthen capability and correct meaningful gaps without reducing people to one score.',
    'All active deployed KNS staff and leaders participating in probation, check-in, term, annual or support reviews.',
    '["Accountability is ownership plus evidence, not blame.","Performance judgment follows evidence and dialogue; it is not inferred automatically from one incident, one absence, one complaint or one examination result.","A small number of meaningful role outcomes is more useful than a large volume of vanity metrics.","O6 governed role KPIs may inform a review when they exist, but KHP-OS must never invent a KPI, threshold or score for the purpose of judging a staff member.","Development follows the loop: observe → identify gap → train/support → practise → re-observe → verify improvement.","Staff should be able to see the evidence used in their own performance review."]'::jsonb,
    '["Every formal performance review includes a staff self-reflection before the leader judgment is recorded.","Leader judgment must cite at least one evidence item and use qualitative states only: On Track, Support Required or Improvement Required.","Teacher performance is not judged only by learner examination scores; evidence may include planning, execution quality, learner progress, intervention, professional conduct, collaboration, role outcomes and verified development.","Attendance/availability exceptions from O8 are operational evidence only and do not automatically become negative performance judgments.","Development actions must identify an owner, due date and evidence of completion; completion is verified by the appropriate reporting leader.","Persistent or serious performance concerns may later enter the corrective/disciplinary process with due process, but O9 itself is not a disciplinary engine."]'::jsonb,
    '["Staff: reflect honestly, contribute evidence and own agreed development commitments.","Direct/reporting leaders: gather balanced evidence, discuss performance, distinguish capability gaps from conduct/refusal, create proportionate support and verify improvement.","School Guardian: owns whole-school performance rhythm and systemic capability response.","Vision Custodian: reviews institutional patterns and reserved senior-role matters rather than becoming routine reviewer for every staff member."]'::jsonb,
    '["No numerical staff rating, forced ranking or league table is created by O9.","No leader may review their own performance record.","A leader performance judgment cannot be recorded before staff self-reflection and at least one evidence item exist.","KPI evidence must reference a governed O6 measurement that belongs to the reviewed role; role-level KPI context must not be misrepresented as an individual-only metric.","Do not use safeguarding case detail, medical/private information or irrelevant personal information as ordinary performance evidence.","A development action owner cannot verify their own completion."]'::jsonb,
    '["Where the Vision Custodian requires personal governance or review, an appropriate board/advisory/external accountability arrangement should be used rather than fake self-approval inside the school reporting hierarchy.","Urgent capability support may begin before a scheduled review; it should still be documented through an appropriate support review when formal follow-up is required."]'::jsonb,
    '["Support Required → direct leader owns coaching/support and review date.","Improvement Required → structured improvement/development action with closer review; persistent non-improvement may trigger PEO-012/PEO-013 according to policy and due process.","Systemic repeated gaps across multiple staff → School Guardian treats as process/training/system problem, not individual nagging.","Safeguarding, fraud or serious misconduct concerns leave O9 and follow the specialised process immediately."]'::jsonb,
    '["Performance review record and self-reflection.","Evidence items visible to staff and reviewer.","Relevant governed O6 KPI measurement references where used.","Development actions, ownership, due dates and completion evidence.","Leader review summary, strengths and growth areas.","Review and development audit history."]'::jsonb,
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
    (v_policy,v_si,'mandatory'),
    (v_policy,v_sp,'mandatory'),
    (v_policy,v_teacher,'mandatory'),
    (v_policy,v_facilitator,'mandatory'),
    (v_policy,v_vc,'reference')
  on conflict do nothing;

  -- PEO-010 Performance Management
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-010';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Create a repeatable staff performance conversation that compares role expectations with evidence, preserves staff voice and produces clear development decisions.',
    'A probation, periodic, term, annual or support review becomes due, or meaningful evidence indicates a structured review is required.',
    '["Active deployed O7 staff record","Active O1 Role Charter","Applicable O6 role KPI context where governed measurements actually exist","Work/evidence records relevant to the role","Observation/feedback evidence","Prior development actions where applicable","Staff self-reflection"]'::jsonb,
    '["Appropriate reporting leader opens the review and review period","Staff submits reflection, strengths and support needed","Staff and leader add relevant evidence; evidence must be specific enough to discuss rather than rely on memory or personality","Where a governed O6 role KPI measurement is relevant, reference the exact measurement; do not invent missing KPIs or targets","Leader reviews the evidence with the staff member and records strengths, growth areas and one qualitative state: On Track, Support Required or Improvement Required","Agree development actions proportionate to the evidence","Complete the review after the leader judgment is recorded; development actions may continue beyond review completion and remain visible until verified","If persistent or serious concern later requires formal corrective action, hand off to the appropriate People process rather than using O9 as discipline"]'::jsonb,
    'Complete scheduled reviews within the agreed institutional review window; support reviews should be opened promptly when a meaningful capability gap needs structured follow-up.',
    '["Staff self-reflection","Evidence register","Exact KPI measurement reference where used","Leader summary","Strengths and growth areas","Qualitative performance state","Development commitments","Review audit trail"]'::jsonb,
    'Staff knows what is going well, what must improve, what support is available and what evidence will show progress.',
    '["Staff self-reflection missing","Leader judgment attempted without evidence","No active role/deployment","KPI data absent or only baseline-level","Evidence conflict requiring clarification","Potential misconduct/safeguarding issue that does not belong in performance coaching"]'::jsonb,
    '["Missing reflection/evidence → reviewing leader follows up","Support Required → coaching/development action","Improvement Required → structured improvement and closer review","Persistent non-improvement or conduct concern → PEO-012/PEO-013 as appropriate","Systemic repeated gap → School Guardian/institutional improvement loop"]'::jsonb,
    '["Scheduled reviews completed","Reviews with evidence before judgment","Development actions created where needed","Development actions verified","Repeated capability gaps by role/system","Reviews overdue"]'::jsonb,
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
    (v_process,v_vc,'informed')
  on conflict do nothing;

  -- PEO-011 Coaching & Development
  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='PEO-011';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Turn an identified capability or role-execution gap into owned development work and verified improvement rather than repeated verbal reminders.',
    'A performance review, observation, role transition or other evidence identifies a capability/development need.',
    '["Specific evidence of the gap or growth opportunity","Expected role outcome/standard","Staff perspective","Available coaching/training/practice/support options","Named action owner","Due date","Evidence needed to verify progress"]'::jsonb,
    '["Distinguish a capability gap from a conduct/refusal issue before choosing development","Create a development commitment with a specific action type, owner and due date","Provide the agreed coaching, training, practice, observation, process or resource support","Action owner completes the work and submits a short completion note plus evidence reference","Appropriate reporting leader verifies the evidence; the owner cannot verify their own work","If evidence is insufficient, reopen the action with a reason and continue support/practice","Use the next relevant observation/review to confirm whether the underlying capability has improved","Escalate persistent non-improvement through the appropriate performance/corrective route rather than indefinitely repeating the same intervention"]'::jsonb,
    'Set a due date proportionate to the capability gap and operational need; overdue development actions remain visible until verified or formally cancelled.',
    '["Development action record","Owner and due date","Support/training/coaching record where applicable","Completion note","Evidence reference","Verification or reopen history"]'::jsonb,
    'Development is a closed evidence loop: the identified need receives support, practice and independent verification of improvement.',
    '["Action owner lacks organisation access","Evidence cannot be verified","Development need is actually a conduct/refusal matter","Underlying system/process prevents improvement","Repeated action is overdue or ineffective"]'::jsonb,
    '["Blocked support/resource → reporting leader/School Guardian","Repeated capability gap → Support/Improvement review","Conduct/refusal → PEO-012/PEO-013","System/process cause → institutional improvement process"]'::jsonb,
    '["Development actions completed by due date","Actions verified","Actions reopened after insufficient evidence","Repeated development themes by role","Support/resource blockers"]'::jsonb,
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
    (v_process,v_vc,'informed')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o9_performance_development_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'activePolicy','PEO-P05',
      'publishedProcesses',jsonb_build_array('PEO-010','PEO-011'),
      'architectureVersion','O9-v1.0',
      'seededReviews',0,
      'seededDevelopmentActions',0,
      'seededStaffRatings',0,
      'o6Boundary','governed_kpi_context_only'
    )
  where not exists(
    select 1
    from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o9_performance_development_bootstrapped'
  );
end;
$$;
