-- KNS O2 reusable institutional tools registry.

do $$
declare
  v_org uuid;
  v_actor uuid;
begin
  select id into v_org from public.organisations where name='KAEC Nigerian Schools' and status='active' order by created_at limit 1;
  if v_org is null then raise exception 'KAEC Nigerian Schools organisation not found.'; end if;
  select user_id into v_actor from public.organisation_memberships where organisation_id=v_org and role='executive' and status='active' order by created_at limit 1;
  if v_actor is null then raise exception 'KAEC Nigerian Schools executive membership not found.'; end if;
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-001','Role Charter','role_charter','Defines role mission, outcomes, authority and KPIs.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-002','Responsibility Matrix','matrix','Maps ownership and accountability.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-003','Process Card','process_guide','Shows how a process works.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-004','Task Record','task','Assigns and tracks work.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-005','Recurring Task Template','recurring_rule','Automatically creates repeated work.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-006','Evidence Record','evidence','Proves completion.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-007','Issue Record','issue','Captures deviation from expected operation.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-008','Escalation Record','escalation','Routes exceptions upward.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-009','Approval Record','approval','Captures request and decision.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-010','Decision Record','decision','Preserves institutional decisions.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-011','Action Tracker','action','Tracks decisions and actions to closure.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-012','Checklist','checklist','Standardises repeated verification.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-013','Handover Record','handover','Transfers responsibility temporarily or permanently.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-014','Meeting Record','meeting','Converts meetings into decisions and actions.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-015','Risk Assessment','risk_assessment','Identifies and controls risk.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-016','Incident Record','incident','Captures a significant occurrence.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-017','Case Record','case','Manages multi-step institutional cases.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-018','Improvement Plan','improvement_plan','Corrects persistent underperformance or system failure.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-019','Root-Cause Analysis','root_cause','Investigates repeated or significant failure.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-020','Review Record','review','Captures a formal review of a process, person or case.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-021','Policy Acknowledgement','acknowledgement','Confirms required policy reading.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-022','Consent Record','consent','Captures valid consent.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-023','Communication Record','communication','Records material institutional communication.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-024','Document Record','document_control','Controls official documents and versions.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-025','KPI Definition Card','kpi_definition','Defines measurement rules.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-026','Scorecard','scorecard','Shows role, team or system performance.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-027','Audit Trail','audit','Records who changed or did what.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-028','Learning Record','learning','Preserves institutional learning.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-029','Calendar/Milestone Record','calendar','Controls deadlines and milestones.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_tool_templates(organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by)
  values(v_org,'UTL-030','Notification/Reminder Rule','notification_rule','Creates actionable reminders and alerts.','{}'::jsonb,'active',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,status='active',updated_at=now();
  insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
  select v_org,v_actor,'ops_o2_tools_registry_bootstrapped','organisation',v_org,jsonb_build_object('toolCount',30,'architectureVersion','O2-v1.0')
  where not exists(select 1 from public.khpos_ops_audit_events where organisation_id=v_org and event_type='ops_o2_tools_registry_bootstrapped');
end;
$$;
