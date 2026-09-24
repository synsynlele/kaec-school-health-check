-- KNS O17 Skills Pathways & Competency.
-- Activates HPD-P02, publishes HPD-003, preserves existing HPD-004 v1,
-- and seeds only the current pathway catalogue. No learner selections are fabricated.

do $$
declare
  v_org uuid;
  v_actor uuid;
  v_policy uuid;
  v_process uuid;
  v_sg uuid;
  v_si uuid;
  v_sf uuid;
  v_teacher uuid;
  v_sp uuid;
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

  select id into v_sg from public.khpos_ops_roles where organisation_id=v_org and code='SCHOOL_GUARDIAN';
  select id into v_si from public.khpos_ops_roles where organisation_id=v_org and code='SKILL_INSPECTOR';
  select id into v_sf from public.khpos_ops_roles where organisation_id=v_org and code='SKILLS_FACILITATOR';
  select id into v_teacher from public.khpos_ops_roles where organisation_id=v_org and code='TEACHER';
  select id into v_sp from public.khpos_ops_roles where organisation_id=v_org and code='SECTIONAL_PROMOTER';

  if v_sg is null or v_si is null or v_sf is null or v_teacher is null or v_sp is null then
    raise exception 'Required KNS skills operating roles are missing.';
  end if;

  select id into v_policy
  from public.khpos_ops_policies
  where organisation_id=v_org and code='HPD-P02';

  if v_policy is null then
    raise exception 'HPD-P02 policy registration is missing.';
  end if;

  insert into public.khpos_ops_policy_versions(
    policy_id,version,purpose,scope,principles,policy_statements,
    roles_responsibilities,rules,exceptions,escalation,records_evidence,
    effective_date,review_date,approved_by,approved_at,status
  ) values (
    v_policy,1,
    'Ensure every KNS learner can enter a practical skills pathway by informed choice, develop progressively through demonstrated competence, change pathway without stigma where justified, and receive safe, evidence-based skills delivery.',
    'All KNS school-owned practical skills pathways, term offerings, learner pathway selection/change, skills delivery, competency evidence, recovery and weekly programme review. Private PipuPath profiles, missions and reflections remain outside this policy unless the learner deliberately shares an evidence reference with the school.',
    '["A skills pathway is a development choice, not a permanent label of what a learner can or cannot become.","Learner choice matters: discovery evidence can inform selection but must not lock a learner into a pathway.","One primary KNS skills pathway per learner per term keeps ownership clear; approved changes preserve history rather than rewriting it.","Attendance is exposure, not competence. Progression requires specific practical evidence and human verification.","The KNS competency ladder is Exposure → Foundation → Independent → Applied → Value Creation.","Competency levels are verified progressively; the system does not skip levels or auto-promote from attendance, popularity or time served.","The person who records competency evidence cannot verify that same evidence.","Unsafe practical conditions stop delivery. Safety/resource failures and missed sessions become visible operational exceptions, not hidden explanations.","Verified school-owned skills evidence may feed O16 Potential Development as evidence, but it does not automatically change a potential hypothesis.","PipuPath remains learner-facing/private; O17 stores only school-owned operational records and deliberately shared evidence references."]'::jsonb,
    '["KNS maintains a configurable skills catalogue and term/campus offerings rather than hard-coding permanent programmes into the product.","An offering cannot activate until it has a named Skills Facilitator, safety readiness and usable resources.","Pathway selection records the learner, offering, basis and reason; capacity is checked before confirmation.","A learner may request or be supported to request a pathway change when interest, fit, opportunity, safety, accessibility or development evidence warrants review.","Skill Inspector or School Guardian decides pathway changes; an approved future-dated change executes only on/after its effective date.","Each practical competency evidence item names the competency area, level, observation, evidence reference and observer.","Skill Inspector or School Guardian independently verifies competency evidence; verified levels cannot skip the five-level sequence.","Verification creates a linked school-owned O16 skills-application evidence record so staff do not re-enter the same proof in two modules.","Skills sessions record planned focus and outcome. Delivered sessions require safe conditions and evidence; missed sessions require a recovery date and an O4 Issue.","Safety concern creates at least a P1 O4 Issue; blocked resources create at least P2; ordinary missed delivery creates an O4 issue and recovery obligation.","Weekly skills review compares planned/delivered/missed sessions, verified competency evidence, safety/resource exceptions, recovery and value-creation progress.","A weekly review with missed sessions cannot submit without a recovery action note, and material delivery exceptions must already be linked to O4.","The weekly review preparer cannot approve their own review."]'::jsonb,
    '["School Guardian: owns whole-school skills governance, approves major exceptions, can manage offerings/selection/change and independently verify where appropriate.","Skill Inspector: primary owner of pathway selection/change, offering readiness, programme quality, competency verification and weekly review approval.","Skills Facilitator: plans/delivers assigned sessions, records evidence, identifies exceptions, supports learner change requests and prepares weekly reviews; cannot verify own competency evidence or self-approve weekly review.","Sectional Promoter/Teacher: may contribute discovery/context through O16 and learner support routes, but do not independently confirm a skill pathway unless holding the designated skills authority.","Learner: participates in pathway choice/change conversations and demonstrates practical competence; learner voice is evidence, not a permanent label.","O4 issue owner: resolves the safety/resource/missed-delivery exception through the universal Issue Engine.","O16: receives verified school-owned skills evidence as potential-development evidence without importing private PipuPath data."]'::jsonb,
    '["Never assign or retain a learner in a pathway solely because an adult has labelled them talented or untalented.","Never treat attendance, age, term length or session count as proof of competence.","Never activate a practical offering with blocked safety readiness, blocked resources or no assigned Skills Facilitator.","Never exceed recorded offering capacity without a separately governed capacity/placement decision.","Never silently move a learner between pathways; use the change request/decision/execution trail.","Never skip competency ladder levels during verification.","Never allow the evidence recorder to verify the same competency evidence.","Never mark a practical session delivered when a safety concern or blocked resource prevented safe delivery.","Never hide a missed session or material delivery exception outside O4.","Never copy private PipuPath profile, mission or reflection content into O17 as routine operating data."]'::jsonb,
    '["A learner may remain Not Assessed on the competency ladder while participating; no forced progress label is required.","A pathway change may be approved because of development fit, learner choice, accessibility, capacity, safety or programme availability; change is not a punishment.","Resource readiness may be Partial where safe delivery remains genuinely possible; Blocked resources prevent normal activation/delivery.","A cancelled session caused by an approved whole-school calendar change does not automatically imply staff failure, but programme impact still appears in weekly review.","Where a learner requires reasonable support or safeguarding consideration, the appropriate learner-support/safeguarding process governs that need; O17 records only the skills-operational consequence."]'::jsonb,
    '["Facilitator delivery/safety/resource issue → Skill Inspector.","Institutional resource/capacity constraint → School Guardian.","P1 safety issue → O4 automatic escalation and safeguarding/operations route where relevant.","Repeated missed skills delivery or unresolved recovery → Skill Inspector then School Guardian through O4.","Pathway change exception or unresolved learner-placement dispute → School Guardian.","Safeguarding concern discovered during skills activity → safeguarding route immediately; do not investigate inside O17."]'::jsonb,
    '["Skills pathway catalogue and status.","Term/campus offering, facilitator, capacity and readiness evidence.","Learner selection and pathway-change decision history.","Session plan/delivery evidence, safety/resource state, recovery date and linked O4 issue.","Competency evidence, verifier, verification note and linked O16 evidence ID.","Weekly review counts, exception/recovery notes, approval/return record.","O17 event/audit trail."]'::jsonb,
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
    (v_policy,v_si,'mandatory'),
    (v_policy,v_sf,'mandatory'),
    (v_policy,v_sp,'awareness'),
    (v_policy,v_teacher,'awareness')
  on conflict do nothing;

  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=v_org and code='HPD-003';

  if v_process is null then
    raise exception 'HPD-003 process registration is missing.';
  end if;

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,
    expected_outcome,exception_conditions,escalation,kpis,
    effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Place each learner into a clear primary skills pathway through informed choice and evidence, while allowing governed changes without stigma or loss of history.',
    'Before a learner begins the term skills cycle, when a new learner enters, when an offering becomes unavailable, or when learner choice/development evidence suggests a pathway change should be reviewed.',
    '["Active learner anchor and campus","Active term and ready/active skill offering","Learner choice and discussion","Relevant O16 discovery/potential evidence where useful","Offering capacity/safety/resource readiness","Current active skill selection where a change is requested"]'::jsonb,
    '["Present available ready/active pathways and explain what participation involves","Use learner choice as a primary input; use O16 discovery/evidence as supporting context rather than a fixed label","Skill Inspector/School Guardian confirms one primary offering for the learner and records the selection basis/note","When change is requested, record the current selection, target offering, reason and requested effective date","Skill Inspector/School Guardian reviews capacity, safety, fit and continuity; approve or reject with a reasoned note","Approved future changes wait until the effective date","Execute the change by closing the former active selection as Changed and creating a new active selection while preserving history","Review repeated pathway changes or capacity patterns as programme-design signals rather than blaming the learner"]'::jsonb,
    'Initial pathway selection should be completed before the learner enters the practical skills cycle. Change requests should be decided before the next feasible skills cycle unless safety/accessibility requires faster action.',
    '["Learner selection record","Selection basis and note","Offering readiness/capacity","Change request, decision and effective date","Old/new selection history","Relevant learner-shared or school-owned evidence reference where used"]'::jsonb,
    'Every learner has one clearly owned primary KNS skills pathway for the term, learner voice is respected, and changes are transparent, reversible in principle and historically traceable.',
    '["No ready offering/capacity → Skill Inspector/School Guardian resolves placement or capacity before selection","Safety/accessibility concern → pause placement and route the concern appropriately","Learner changes mind → use governed change request; do not treat as misconduct","Programme cancelled → move affected learners through explicit change decisions","Safeguarding concern → safeguarding route immediately"]'::jsonb,
    '["Placement/capacity issue → Skill Inspector","Institutional capacity/resource exception → School Guardian","Safeguarding/accessibility risk → appropriate safeguarding/learner-support route","Unresolved parent/learner dispute → School Guardian through the Parent/Learner concern route when applicable"]'::jsonb,
    '["Learners with active skill selection","Learners awaiting placement","Pathway capacity utilisation","Pending pathway changes","Average pathway-change decision time","Repeated change patterns requiring programme review"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes
  set status='active',updated_at=now()
  where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values
    (v_process,v_si,'owner'),
    (v_process,v_sg,'approver'),
    (v_process,v_sf,'participant')
  on conflict do nothing;

  -- Preserve the already-published HPD-004 v1; simply ensure its registry row remains active.
  update public.khpos_ops_processes
  set status='active',updated_at=now()
  where organisation_id=v_org and code='HPD-004';

  insert into public.khpos_ops_skill_pathways(
    organisation_id,code,name,description,status,created_by
  )
  values
    (v_org,'TAILORING','Tailoring','Garment construction, design, measurement, production and progressively independent practical application.','active',v_actor),
    (v_org,'CULINARY','Culinary','Food preparation, kitchen practice, hygiene, costing and progressively independent value creation.','active',v_actor),
    (v_org,'FOOTBALL','Football','Technical, tactical, physical and teamwork development through structured football practice.','active',v_actor),
    (v_org,'MUSIC','Music','Performance, musicianship, practice discipline and creative application.','active',v_actor),
    (v_org,'COMPUTER','Computer','Digital skills, computing practice, creation and progressively independent technology application.','active',v_actor),
    (v_org,'HAIRDRESSING','Hairdressing','Hair care, styling, hygiene, client practice and progressively independent value creation.','active',v_actor)
  on conflict (organisation_id,code) do update
    set name=excluded.name,
        description=excluded.description,
        status='active',
        updated_at=now();

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select
    v_org,v_actor,'ops_o17_skills_pathways_bootstrapped',
    'organisation',v_org,
    jsonb_build_object(
      'activePolicy','HPD-P02',
      'publishedProcesses',jsonb_build_array('HPD-003'),
      'preservedProcesses',jsonb_build_array('HPD-004'),
      'architectureVersion','O17-v1.0',
      'seededPathways',6,
      'seededOfferings',0,
      'seededSelections',0,
      'seededCompetencyEvidence',0,
      'guardrails',jsonb_build_array(
        'Learner choice is not a permanent label',
        'Attendance is not competence',
        'Five-level competency ladder cannot be skipped',
        'Evidence recorder cannot self-verify',
        'Unsafe or blocked sessions are not delivered',
        'Material delivery exceptions link to O4',
        'Verified skills evidence links to O16',
        'Private PipuPath content is not copied'
      )
    )
  where not exists(
    select 1 from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o17_skills_pathways_bootstrapped'
  );
end;
$$;
