-- KNS O6 performance and scorecard process publication.
do $$
declare
  v_org uuid;
  v_actor uuid;
  v_sg uuid;
  v_vc uuid;
  v_ai uuid;
  v_si uuid;
  v_sp uuid;
  v_process uuid;
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

  select id into v_sg from public.khpos_ops_roles where organisation_id=v_org and code='SCHOOL_GUARDIAN';
  select id into v_vc from public.khpos_ops_roles where organisation_id=v_org and code='VISION_CUSTODIAN';
  select id into v_ai from public.khpos_ops_roles where organisation_id=v_org and code='ACADEMIC_INSPECTOR';
  select id into v_si from public.khpos_ops_roles where organisation_id=v_org and code='SKILL_INSPECTOR';
  select id into v_sp from public.khpos_ops_roles where organisation_id=v_org and code='SECTIONAL_PROMOTER';

  -- IPA-001 KPI Definition & Governance
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='IPA-001';
  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Create a small, stable KPI dictionary that measures owned outcomes without vanity metrics or arbitrary target-setting.',
    'A role, team, operating system or campus needs an explicit measure of performance, or an existing KPI is no longer valid.',
    '["Owned outcome","Reliable data source","Measurement definition","Baseline evidence where available","Review cadence","Responsible role"]'::jsonb,
    '["Define what the KPI actually measures","Classify it as outcome, process or risk","Choose scope, owner, unit and source","Where reliable baseline evidence does not yet exist, activate the KPI as baseline-only","Configure thresholds only when evidence and institutional judgement justify them","Mark critical controls explicitly rather than hiding them in an average","Use the same definition consistently across review periods"]'::jsonb,
    'A KPI definition must be settled before it is used for formal performance judgement. Baseline collection precedes arbitrary target locking.',
    '["KPI definition and code","Owner and scope","Source and cadence","Target configuration or baseline-only status","Measurement history"]'::jsonb,
    'KNS leaders compare reality against stable definitions and evidence instead of changing measures to fit the result.',
    '["A KPI may be redefined where the source or definition is materially invalid; the change must be governed as a new definition/version","A new campus may remain unbaselined while reliable operating data accumulates"]'::jsonb,
    '["Unclear or disputed definitions → School Guardian","Strategic or network-level KPI conflict → Vision Custodian","Critical control failure → relevant Issue/Escalation route"]'::jsonb,
    '["Active KPI definitions","Unbaselined KPIs","KPI definition changes","KPIs without current measurement"]'::jsonb,
    current_date,v_actor,now(),'active'
  ) on conflict (process_id,version) do nothing;
  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_sg,'owner'),(v_process,v_vc,'approver')
  on conflict do nothing;

  -- IPA-002 Individual Role Scorecard
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='IPA-002';
  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Translate each significant role charter into a concise view of the outcomes that role owns.',
    'A significant role is assigned, reviewed or requires performance discussion.',
    '["Active role charter","Owned outcomes","Governed KPI definitions","Current measurements","Relevant work/issues/decisions"]'::jsonb,
    '["Select only measures that reflect outcomes genuinely owned or strongly influenced by the role","Review current value, status and trend","Separate data gap from poor performance","Discuss red/persistent amber evidence with context","Create action or issue only where response is required","Do not substitute one score for professional judgement"]'::jsonb,
    'Review at the cadence defined for the role/KPI and during formal performance discussions.',
    '["Role scorecard","Measurement history","Performance discussion/action evidence where triggered"]'::jsonb,
    'Role holders know what success means and leaders coach/account for evidence rather than impressions.',
    '["New roles may begin with baseline-only indicators","A critical safeguarding/safety matter bypasses ordinary scorecard discussion and follows its protected route"]'::jsonb,
    '["Persistent red or inability to execute due to system constraint → direct leader","Cross-functional constraint → School Guardian"]'::jsonb,
    '["Role-owned KPIs current","Persistent red/amber indicators","Overdue response actions"]'::jsonb,
    current_date,v_actor,now(),'active'
  ) on conflict (process_id,version) do nothing;
  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_sg,'owner')
  on conflict do nothing;

  -- IPA-003 Section/Team Scorecard
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='IPA-003';
  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Make section and functional-team performance visible without forcing leaders to rebuild reports manually.',
    'Weekly/termly functional review or a material change in team performance.',
    '["Team-owned KPI measurements","Role-level exceptions","Open issues","Overdue work","Relevant learner/programme evidence"]'::jsonb,
    '["Review the small set of team-owned outcome/process/risk indicators","Identify negative trend, red or persistent amber evidence","Check whether the cause is role execution, process design, resource constraint or external dependency","Assign response through My Work/Issues/Decisions as appropriate","Carry only material exceptions into whole-school review"]'::jsonb,
    'At the team cadence and before the relevant whole-school performance review.',
    '["Team scorecard","Exception notes","Linked actions/issues/decisions where triggered"]'::jsonb,
    'Inspectors and Sectional Promoters manage their functions by evidence and send only material exceptions upward.',
    '["A new or materially changed team may remain in baseline mode while evidence accumulates"]'::jsonb,
    '["Section issue → Sectional Promoter","Functional/persistent issue → Inspector","Cross-functional/whole-school issue → School Guardian"]'::jsonb,
    '["Team KPIs current","Red/persistent amber indicators","Unresolved team exceptions"]'::jsonb,
    current_date,v_actor,now(),'active'
  ) on conflict (process_id,version) do nothing;
  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_ai,'owner'),(v_process,v_si,'owner'),(v_process,v_sp,'owner')
  on conflict do nothing;

  -- IPA-004 Operating-System Health Review
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='IPA-004';
  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Assess whether each KNS operating system is healthy as a system, not merely whether individual people are busy.',
    'Weekly/monthly institutional review, repeated failure pattern, or evidence that a process is not producing its intended outcome.',
    '["System-scoped KPIs","Open/repeated issues","Overdue work","Decision bottlenecks","Process/control coverage","Improvement actions"]'::jsonb,
    '["Review current system indicators and trends","Review repeated issue categories and overdue work","Distinguish individual performance from process/system failure","Identify process, policy, tool, capability or resource defect","Assign corrective action or improvement plan","Verify whether the change improves the system"]'::jsonb,
    'Material system-health exceptions are reviewed in the next relevant performance rhythm; critical risks are handled immediately.',
    '["System scorecard","Root-cause evidence where required","Linked issues/decisions/improvement actions"]'::jsonb,
    'KNS improves the operating system instead of repeatedly nagging people for the same failure.',
    '["Insufficient data may keep a new system unbaselined; lack of data is itself made visible"]'::jsonb,
    '["System owner → School Guardian","Strategic architecture defect → Vision Custodian"]'::jsonb,
    '["System KPIs current","Repeated issue patterns","Overdue system actions","Process/control coverage"]'::jsonb,
    current_date,v_actor,now(),'active'
  ) on conflict (process_id,version) do nothing;
  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_sg,'owner')
  on conflict do nothing;

  -- IPA-005 Campus Health Dashboard
  select id into v_process from public.khpos_ops_processes
  where organisation_id=v_org and code='IPA-005';
  insert into public.khpos_ops_process_versions(
    process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
    exception_conditions,escalation,kpis,effective_date,approved_by,approved_at,status
  ) values (
    v_process,1,
    'Give leadership a concise whole-campus health view across learner progress, human potential, culture, people, parents, safety, operations and finance without hiding critical failure in a composite score.',
    'Weekly/monthly whole-school review and strategic campus review.',
    '["Campus/institution KPIs","Operational pulse","Critical-control indicators","Open P1/P2 issues","Overdue work/decisions","Trend history"]'::jsonb,
    '["Review critical controls and P1 risks first","Review red/amber indicators and negative trends by domain","Do not average critical failure away with green performance elsewhere","Identify cross-system patterns","Create only the actions/issues/decisions that require intervention","Carry strategic exceptions to the Vision Custodian"]'::jsonb,
    'Current before the weekly/monthly leadership review.',
    '["Campus dashboard","Exception actions/issues/decisions","Strategic escalation where required"]'::jsonb,
    'School Guardian can manage whole-school performance by exception; Vision Custodian sees institutional health and reserved strategic risks.',
    '["Unbaselined domains remain visibly unbaselined rather than receiving a guessed score"]'::jsonb,
    '["Whole-school exception → School Guardian","Reserved strategic/structural risk → Vision Custodian"]'::jsonb,
    '["Critical controls failing","Red/amber indicators","Overdue work/issues/decisions","Role coverage","Controlled process coverage"]'::jsonb,
    current_date,v_actor,now(),'active'
  ) on conflict (process_id,version) do nothing;
  update public.khpos_ops_processes set status='active',updated_at=now() where id=v_process;
  insert into public.khpos_ops_process_roles(process_id,role_id,participation)
  values(v_process,v_sg,'owner'),(v_process,v_vc,'approver')
  on conflict do nothing;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  )
  select v_org,v_actor,'ops_o6_performance_engine_bootstrapped','organisation',v_org,
    jsonb_build_object(
      'publishedProcesses',jsonb_build_array('IPA-001','IPA-002','IPA-003','IPA-004','IPA-005'),
      'architectureVersion','O6-v1.0',
      'seededKpis',0,
      'reason','KPI targets must be evidence-based; O6 intentionally does not seed arbitrary targets.'
    )
  where not exists (
    select 1 from public.khpos_ops_audit_events
    where organisation_id=v_org and event_type='ops_o6_performance_engine_bootstrapped'
  );
end;
$$;
