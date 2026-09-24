-- KNS O3 execution bootstrap: controlled process versions, checklists and recurring responsibilities.
-- Rules activate only for real active operating-role assignments; this seed does not invent staff assignments.

do $$
declare
  v_org uuid;
  v_actor uuid;
  v_vc uuid;
  v_sg uuid;
  v_ai uuid;
  v_si uuid;
  v_teacher uuid;

  v_process uuid;
  v_checklist uuid;
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
  select id into v_teacher from public.khpos_ops_roles where organisation_id=v_org and code='TEACHER';

  if v_vc is null or v_sg is null or v_ai is null or v_si is null or v_teacher is null then
    raise exception 'Required KNS operating roles are missing.';
  end if;

  -- ACD-004 Lesson Preparation & Readiness
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='ACD-004';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Ensure each scheduled lesson begins with clear learning intent, adequate preparation and readiness to respond to known learner needs.',
    'Before each teaching day and before delivery of the assigned planned learning.',
    '["Approved scheme/weekly target","Learner evidence from prior learning","Required teaching resources","Relevant recovery actions"]'::jsonb,
    '["Review the planned learning target","Prepare the lesson sequence and required resources","Consider known learner gaps or recovery needs","Confirm readiness before delivery","Raise any barrier that prevents safe or effective delivery"]'::jsonb,
    'Before the affected lesson is due to begin.',
    '["Daily readiness checklist","Lesson/learning evidence in the designated academic system","Any logged exception or recovery action"]'::jsonb,
    'The teacher begins planned learning prepared, with known barriers visible before they become missed or weak delivery.',
    '["Required resources unavailable","Teacher cannot deliver the scheduled lesson","Known learner recovery need cannot be accommodated","Safety or safeguarding concern affects delivery"]'::jsonb,
    '["Routine barriers → Sectional Promoter","Persistent academic constraint → Academic Inspector","Safeguarding concern → safeguarding route immediately"]'::jsonb,
    '["Planned learning delivered","Readiness exceptions resolved","Missed learning requiring recovery"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;

  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_teacher,'owner') on conflict do nothing;

  -- ACD-009 Curriculum Progress Tracking
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='ACD-009';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Keep curriculum execution visible against plan so academic debt and delivery risk are identified early and recovered.',
    'Weekly academic execution review and whenever delivery materially falls behind plan.',
    '["Approved schemes","Section progress records","Missed/partial lesson records","Academic debt","Learner-risk signals"]'::jsonb,
    '["Compare planned vs delivered learning","Identify unverified or missed learning","Review academic debt and recovery ownership","Review uncovered lessons and high-risk learner implications","Assign or escalate recovery actions","Record material exceptions for leadership review"]'::jsonb,
    'Complete the weekly review before the leadership performance review.',
    '["Curriculum progress record","Academic debt register","Recovery actions","Escalated academic exceptions"]'::jsonb,
    'Academic leadership knows where learning is on track, where debt exists, who owns recovery and what requires whole-school support.',
    '["Repeated scheme slippage","Uncovered lessons","Recovery actions overdue","Exam-readiness risk","Systemic teacher/section delivery weakness"]'::jsonb,
    '["Section issue → Sectional Promoter","Cross-section/persistent academic risk → Academic Inspector","Whole-school constraint → School Guardian"]'::jsonb,
    '["Curriculum delivery vs plan","Academic debt outstanding","Recovery actions overdue","Uncovered learning"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_ai,'owner') on conflict do nothing;

  -- HPD-004 Skills Development
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='HPD-004';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Ensure practical skills programmes produce progressive competence, safe practice and verifiable learner evidence rather than attendance alone.',
    'Weekly skills execution review and whenever programme delivery, safety or resource readiness falls below expectation.',
    '["Skills timetable","Facilitator delivery records","Competency evidence","Resource/safety exceptions","Young CEO linkage where relevant"]'::jsonb,
    '["Review sessions delivered vs plan","Review learner competency evidence","Identify safety/resource/programme exceptions","Check recovery for missed sessions","Review relevant Young CEO/value-creation milestones","Assign and track corrective actions"]'::jsonb,
    'Complete the weekly review before the next skills cycle begins.',
    '["Skills execution record","Competency evidence","Exception/recovery actions","Programme milestone record"]'::jsonb,
    'Skills delivery remains safe, progressive and evidence-based, with exceptions owned before they compound.',
    '["Unsafe practical condition","Repeated missed skills sessions","Materials/resources unavailable","Competency evidence not being captured","Programme milestone materially off track"]'::jsonb,
    '["Facilitator issue → Skill Inspector","Institutional/resource constraint → School Guardian","Safeguarding concern → safeguarding route immediately"]'::jsonb,
    '["Skills sessions delivered","Competency progression","Open safety/resource exceptions","Recovery actions overdue"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_si,'owner') on conflict do nothing;

  -- IPA-007 Weekly Performance Review
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='IPA-007';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Run a concise whole-school review that focuses leadership on red/amber performance, overdue actions, blockers and decisions.',
    'Every school week after functional owners have updated their execution evidence.',
    '["Role/section/system scorecards","Open issues","Overdue actions","Critical risks","Decisions awaiting authority"]'::jsonb,
    '["Review critical risks first","Review red/amber indicators and negative trends","Review overdue actions and blocked work","Assign recovery actions with owner and deadline","Separate decisions that truly require higher authority","Record decisions and close only verified actions"]'::jsonb,
    'Once each school week at the agreed leadership review point.',
    '["Weekly review record","Decisions","Assigned actions","Escalations","Improvement plans where triggered"]'::jsonb,
    'Leadership leaves the review with a small set of owned actions and no material exception hidden in narrative reporting.',
    '["Critical safeguarding/safety/financial risk","Repeated unresolved cross-system failure","Material performance deterioration","Decision exceeds School Guardian authority"]'::jsonb,
    '["Functional owner resolves within scope","School Guardian resolves cross-functional school issues","Vision Custodian receives only reserved/strategic/critical escalation"]'::jsonb,
    '["Overdue leadership actions","Critical unresolved issues","Red/amber trends without action","Decisions waiting beyond SLA"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_sg,'owner') on conflict do nothing;

  -- IPA-008 Monthly Institutional Review
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='IPA-008';

  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Review whole-institution health, strategic risks and founder-dependency patterns at a level above weekly operations.',
    'Monthly institutional governance rhythm and whenever a major systemic pattern requires strategic attention.',
    '["Campus health view","Operating-system trends","Strategic risks","Major improvement plans","Founder-dependency observations","Reserved decisions"]'::jsonb,
    '["Review critical institutional risks","Review cross-system trends and repeated failure patterns","Identify decisions requiring reserved authority","Review founder-dependency defects and delegation gaps","Review strategic milestones","Record decisions and system changes required"]'::jsonb,
    'Once each calendar month.',
    '["Monthly institutional review record","Reserved decisions","Strategic actions","System-design corrections"]'::jsonb,
    'Strategic attention remains focused on institutional health and system design rather than routine school administration.',
    '["Repeated operational dependency on Vision Custodian","Major strategic risk","Systemic failure across multiple functions","Material expansion/structural decision"]'::jsonb,
    '["School Guardian owns operational recovery","Vision Custodian decides reserved strategic matters","External authority/adviser engaged when legally or professionally required"]'::jsonb,
    '["Founder-dependency defects","Strategic risks unresolved","Major improvement plans off track","Reserved decisions overdue"]'::jsonb,
    current_date,v_actor,now(),'active'
  )
  on conflict (process_id,version) do nothing;

  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_vc,'owner') on conflict do nothing;

  -- Teacher Daily Learning Readiness checklist
  insert into public.khpos_ops_checklist_templates(
    organisation_id,process_id,code,name,version,status,created_by,approved_by,approved_at
  )
  select v_org,p.id,'CHK-ACD-004','Daily Learning Readiness',1,'active',v_actor,v_actor,now()
  from public.khpos_ops_processes p
  where p.organisation_id=v_org and p.code='ACD-004'
  on conflict (organisation_id,code,version) do update
    set process_id=excluded.process_id,name=excluded.name,status='active',
        approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=now()
  returning id into v_checklist;

  insert into public.khpos_ops_checklist_template_items(
    template_id,position,label,guidance,response_type,required,options,exception_on_response
  ) values
    (v_checklist,1,'Today’s planned learning target is clear.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,2,'Lesson sequence and activities are prepared.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,3,'Required teaching resources are ready.','If not, raise the barrier before the lesson is affected.','boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,4,'Known learner gaps or recovery needs have been considered.',null,'boolean',true,'[]'::jsonb,'false'::jsonb)
  on conflict (template_id,position) do update
    set label=excluded.label,guidance=excluded.guidance,response_type=excluded.response_type,
        required=excluded.required,options=excluded.options,exception_on_response=excluded.exception_on_response;

  insert into public.khpos_ops_recurring_rules(
    organisation_id,process_id,owner_role_id,checklist_template_id,code,title,description,
    cadence,weekdays,due_time,timezone,start_date,evidence_required,verification_required,
    priority,status,created_by
  )
  select v_org,p.id,v_teacher,v_checklist,'RCR-ACD-004-TEACHER',
    'Daily Learning Readiness',
    'Confirm readiness for the day’s planned teaching before lessons begin.',
    'daily',array[1,2,3,4,5],time '07:45','Africa/Lagos',current_date,
    false,false,'standard','active',v_actor
  from public.khpos_ops_processes p where p.organisation_id=v_org and p.code='ACD-004'
  on conflict (organisation_id,code) do update
    set process_id=excluded.process_id,owner_role_id=excluded.owner_role_id,
        checklist_template_id=excluded.checklist_template_id,title=excluded.title,
        description=excluded.description,cadence=excluded.cadence,weekdays=excluded.weekdays,
        due_time=excluded.due_time,timezone=excluded.timezone,evidence_required=excluded.evidence_required,
        verification_required=excluded.verification_required,priority=excluded.priority,status='active',updated_at=now();

  -- Academic Inspector weekly review checklist
  insert into public.khpos_ops_checklist_templates(
    organisation_id,process_id,code,name,version,status,created_by,approved_by,approved_at
  )
  select v_org,p.id,'CHK-ACD-009','Weekly Academic Execution Review',1,'active',v_actor,v_actor,now()
  from public.khpos_ops_processes p where p.organisation_id=v_org and p.code='ACD-009'
  on conflict (organisation_id,code,version) do update
    set process_id=excluded.process_id,name=excluded.name,status='active',
        approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=now()
  returning id into v_checklist;

  insert into public.khpos_ops_checklist_template_items(
    template_id,position,label,guidance,response_type,required,options,exception_on_response
  ) values
    (v_checklist,1,'Scheme progress has been reviewed against plan.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,2,'Academic debt and missed/unverified learning are visible.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,3,'Recovery actions have named owners and deadlines.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,4,'High-risk learner implications have been reviewed.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,5,'Material exam-readiness or delivery exceptions have been escalated.',null,'boolean',true,'[]'::jsonb,'false'::jsonb)
  on conflict (template_id,position) do update
    set label=excluded.label,guidance=excluded.guidance,response_type=excluded.response_type,
        required=excluded.required,options=excluded.options,exception_on_response=excluded.exception_on_response;

  insert into public.khpos_ops_recurring_rules(
    organisation_id,process_id,owner_role_id,checklist_template_id,code,title,description,
    cadence,weekday,due_time,timezone,start_date,evidence_required,verification_required,
    priority,status,created_by
  )
  select v_org,p.id,v_ai,v_checklist,'RCR-ACD-009-AI',
    'Weekly Academic Execution Review',
    'Review curriculum progress, academic debt and recovery before leadership review.',
    'weekly',5,time '14:30','Africa/Lagos',current_date,
    true,false,'high','active',v_actor
  from public.khpos_ops_processes p where p.organisation_id=v_org and p.code='ACD-009'
  on conflict (organisation_id,code) do update
    set process_id=excluded.process_id,owner_role_id=excluded.owner_role_id,
        checklist_template_id=excluded.checklist_template_id,title=excluded.title,
        description=excluded.description,cadence=excluded.cadence,weekday=excluded.weekday,
        due_time=excluded.due_time,timezone=excluded.timezone,evidence_required=excluded.evidence_required,
        verification_required=excluded.verification_required,priority=excluded.priority,status='active',updated_at=now();

  -- Skill Inspector weekly review
  insert into public.khpos_ops_checklist_templates(
    organisation_id,process_id,code,name,version,status,created_by,approved_by,approved_at
  )
  select v_org,p.id,'CHK-HPD-004','Weekly Skills Execution Review',1,'active',v_actor,v_actor,now()
  from public.khpos_ops_processes p where p.organisation_id=v_org and p.code='HPD-004'
  on conflict (organisation_id,code,version) do update
    set process_id=excluded.process_id,name=excluded.name,status='active',
        approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=now()
  returning id into v_checklist;

  insert into public.khpos_ops_checklist_template_items(
    template_id,position,label,guidance,response_type,required,options,exception_on_response
  ) values
    (v_checklist,1,'Planned skills sessions were delivered or recovery is assigned.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,2,'Learner competency evidence is being captured.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,3,'Safety and resource exceptions are logged and owned.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,4,'Young CEO/value-creation milestones are on track where applicable.',null,'boolean',true,'[]'::jsonb,'false'::jsonb)
  on conflict (template_id,position) do update
    set label=excluded.label,guidance=excluded.guidance,response_type=excluded.response_type,
        required=excluded.required,options=excluded.options,exception_on_response=excluded.exception_on_response;

  insert into public.khpos_ops_recurring_rules(
    organisation_id,process_id,owner_role_id,checklist_template_id,code,title,description,
    cadence,weekday,due_time,timezone,start_date,evidence_required,verification_required,
    priority,status,created_by
  )
  select v_org,p.id,v_si,v_checklist,'RCR-HPD-004-SI',
    'Weekly Skills Execution Review',
    'Review skills delivery, competency evidence, safety/resources and Young CEO milestones.',
    'weekly',4,time '16:30','Africa/Lagos',current_date,
    true,false,'high','active',v_actor
  from public.khpos_ops_processes p where p.organisation_id=v_org and p.code='HPD-004'
  on conflict (organisation_id,code) do update
    set process_id=excluded.process_id,owner_role_id=excluded.owner_role_id,
        checklist_template_id=excluded.checklist_template_id,title=excluded.title,
        description=excluded.description,cadence=excluded.cadence,weekday=excluded.weekday,
        due_time=excluded.due_time,timezone=excluded.timezone,evidence_required=excluded.evidence_required,
        verification_required=excluded.verification_required,priority=excluded.priority,status='active',updated_at=now();

  -- School Guardian weekly performance review
  insert into public.khpos_ops_checklist_templates(
    organisation_id,process_id,code,name,version,status,created_by,approved_by,approved_at
  )
  select v_org,p.id,'CHK-IPA-007','Weekly School Performance Review',1,'active',v_actor,v_actor,now()
  from public.khpos_ops_processes p where p.organisation_id=v_org and p.code='IPA-007'
  on conflict (organisation_id,code,version) do update
    set process_id=excluded.process_id,name=excluded.name,status='active',
        approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=now()
  returning id into v_checklist;

  insert into public.khpos_ops_checklist_template_items(
    template_id,position,label,guidance,response_type,required,options,exception_on_response
  ) values
    (v_checklist,1,'Critical safeguarding, safety and financial risks have been checked first.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,2,'Red/amber indicators and negative trends have owners.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,3,'Overdue and blocked actions have been reviewed.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,4,'Cross-system blockers have clear recovery actions.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,5,'Only decisions requiring reserved authority are being escalated to the Vision Custodian.',null,'boolean',true,'[]'::jsonb,'false'::jsonb)
  on conflict (template_id,position) do update
    set label=excluded.label,guidance=excluded.guidance,response_type=excluded.response_type,
        required=excluded.required,options=excluded.options,exception_on_response=excluded.exception_on_response;

  insert into public.khpos_ops_recurring_rules(
    organisation_id,process_id,owner_role_id,checklist_template_id,code,title,description,
    cadence,weekday,due_time,timezone,start_date,evidence_required,verification_required,
    priority,status,created_by
  )
  select v_org,p.id,v_sg,v_checklist,'RCR-IPA-007-SG',
    'Weekly School Performance Review',
    'Review exceptions, overdue actions, blockers and decisions before the school week closes.',
    'weekly',5,time '16:30','Africa/Lagos',current_date,
    true,false,'high','active',v_actor
  from public.khpos_ops_processes p where p.organisation_id=v_org and p.code='IPA-007'
  on conflict (organisation_id,code) do update
    set process_id=excluded.process_id,owner_role_id=excluded.owner_role_id,
        checklist_template_id=excluded.checklist_template_id,title=excluded.title,
        description=excluded.description,cadence=excluded.cadence,weekday=excluded.weekday,
        due_time=excluded.due_time,timezone=excluded.timezone,evidence_required=excluded.evidence_required,
        verification_required=excluded.verification_required,priority=excluded.priority,status='active',updated_at=now();

  -- Vision Custodian monthly institutional review
  insert into public.khpos_ops_checklist_templates(
    organisation_id,process_id,code,name,version,status,created_by,approved_by,approved_at
  )
  select v_org,p.id,'CHK-IPA-008','Monthly Institutional Review',1,'active',v_actor,v_actor,now()
  from public.khpos_ops_processes p where p.organisation_id=v_org and p.code='IPA-008'
  on conflict (organisation_id,code,version) do update
    set process_id=excluded.process_id,name=excluded.name,status='active',
        approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=now()
  returning id into v_checklist;

  insert into public.khpos_ops_checklist_template_items(
    template_id,position,label,guidance,response_type,required,options,exception_on_response
  ) values
    (v_checklist,1,'Critical institutional risks and cross-system patterns have been reviewed.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,2,'Reserved strategic decisions requiring Vision Custodian authority are clear.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,3,'Recurring founder-dependency defects have been identified for system correction.',null,'boolean',true,'[]'::jsonb,'false'::jsonb),
    (v_checklist,4,'Major improvement and strategic milestones have been reviewed.',null,'boolean',true,'[]'::jsonb,'false'::jsonb)
  on conflict (template_id,position) do update
    set label=excluded.label,guidance=excluded.guidance,response_type=excluded.response_type,
        required=excluded.required,options=excluded.options,exception_on_response=excluded.exception_on_response;

  insert into public.khpos_ops_recurring_rules(
    organisation_id,process_id,owner_role_id,checklist_template_id,code,title,description,
    cadence,day_of_month,due_time,timezone,start_date,evidence_required,verification_required,
    priority,status,created_by
  )
  select v_org,p.id,v_vc,v_checklist,'RCR-IPA-008-VC',
    'Monthly Institutional Review',
    'Review institutional health, strategic risk, reserved decisions and founder-dependency patterns.',
    'monthly',1,time '10:00','Africa/Lagos',current_date,
    true,false,'high','active',v_actor
  from public.khpos_ops_processes p where p.organisation_id=v_org and p.code='IPA-008'
  on conflict (organisation_id,code) do update
    set process_id=excluded.process_id,owner_role_id=excluded.owner_role_id,
        checklist_template_id=excluded.checklist_template_id,title=excluded.title,
        description=excluded.description,cadence=excluded.cadence,day_of_month=excluded.day_of_month,
        due_time=excluded.due_time,timezone=excluded.timezone,evidence_required=excluded.evidence_required,
        verification_required=excluded.verification_required,priority=excluded.priority,status='active',updated_at=now();

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select v_org,v_actor,'ops_o3_execution_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'publishedProcesses',5,
      'activeChecklists',5,
      'activeRecurringRules',5,
      'architectureVersion','O3-v1.0'
    )
  where not exists (
    select 1 from public.khpos_ops_audit_events
    where organisation_id=v_org and event_type='ops_o3_execution_bootstrapped'
  );
end;
$$;
