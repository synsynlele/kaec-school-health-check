-- KNS O2 Master Policy Register and first approved policy documents.
-- Safeguarding, regulatory, finance and other legally sensitive policies remain registered until specifically reviewed and approved.

do $$
declare
  v_org uuid;
  v_actor uuid;
begin
  select id into v_org from public.organisations where name='KAEC Nigerian Schools' and status='active' order by created_at limit 1;
  if v_org is null then raise exception 'KAEC Nigerian Schools organisation not found.'; end if;
  select user_id into v_actor from public.organisation_memberships where organisation_id=v_org and role='executive' and status='active' order by created_at limit 1;
  if v_actor is null then raise exception 'KAEC Nigerian Schools executive membership not found.'; end if;

  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'GOV-P01','Governance, Authority & Delegation Policy','governance_decision','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'GOV-P02','Policy, Process & Document Governance Policy','governance_decision','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'GOV-P03','Records, Data & Confidentiality Policy','governance_decision','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'GOV-P04','Regulatory Compliance Policy','governance_decision','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'GOV-P05','Contracts & External Commitments Policy','governance_decision','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'GOV-P06','Partnership & External Relationship Policy','governance_decision','School Guardian','C2','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'GOV-P07','Business Continuity Policy','governance_decision','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'GOV-P08','Institutional Change Management Policy','governance_decision','School Guardian','C2','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PEO-P01','Recruitment & Appointment Policy','people_staff','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PEO-P02','Staff Code of Conduct & Professional Standards','people_staff','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PEO-P03','Staff Onboarding, Probation & Deployment Policy','people_staff','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PEO-P04','Staff Attendance, Leave & Availability Policy','people_staff','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PEO-P05','Staff Performance & Development Policy','people_staff','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PEO-P06','Staff Grievance & Corrective/Disciplinary Policy','people_staff','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PEO-P07','Staff Progression, Succession & Exit Policy','people_staff','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'ACD-P01','Curriculum & Academic Delivery Policy','academic_execution','Academic Inspector','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'ACD-P02','Assessment, Examination & Academic Integrity Policy','academic_execution','Academic Inspector','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'ACD-P03','Teaching Quality & Academic Monitoring Policy','academic_execution','Academic Inspector','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'LPI-P01','Learner Progress, Support & Intervention Policy','learner_progress_intervention','Academic Inspector','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'LPI-P02','Learner Progression & Promotion Policy','learner_progress_intervention','Academic Inspector','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'HPD-P01','Human Potential Development Policy','human_potential_development','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'HPD-P02','Skills Development Policy','human_potential_development','Skill Inspector','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'HPD-P03','Builder Projects, Portfolio & Showcase Policy','human_potential_development','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'HPD-P04','Young CEO & Value Creation Policy','human_potential_development','Skill Inspector','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'HPD-P05','WorldReady & Learner Transition Policy','human_potential_development','School Guardian','C2','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'CUL-P01','Student Culture & Restorative Behaviour Policy','student_culture_leadership','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'CUL-P02','Student Leadership & Builders Council Policy','student_culture_leadership','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'CUL-P03','Student Voice, Recognition & Participation Policy','student_culture_leadership','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'SAF-P01','Child Safeguarding & Protection Policy','safeguarding_welfare_emergency','Safeguarding Lead','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'SAF-P02','Staff–Student Professional Boundaries Policy','safeguarding_welfare_emergency','Safeguarding Lead','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'SAF-P03','Student Welfare, Health & Emergency Policy','safeguarding_welfare_emergency','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'SAF-P04','Digital Safeguarding & Responsible Technology Policy','safeguarding_welfare_emergency','Safeguarding Lead','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'SAF-P05','Arrival, Dismissal, Collection & Student Movement Policy','safeguarding_welfare_emergency','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'SAF-P06','Educational Visits & Off-Campus Activities Policy','safeguarding_welfare_emergency','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PAR-P01','Admissions & Placement Policy','parent_experience_partnership','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PAR-P02','Parent Partnership & Communication Policy','parent_experience_partnership','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PAR-P03','Parent Complaints & Resolution Policy','parent_experience_partnership','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PAR-P04','Parent Consent, Student Information & Media Permission Policy','parent_experience_partnership','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'PAR-P05','Re-enrolment, Withdrawal & Learner Exit Policy','parent_experience_partnership','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'FIN-P01','Financial Governance & Authority Policy','finance_commercial_control','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'FIN-P02','School Fees, Payment & Receivables Policy','finance_commercial_control','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'FIN-P03','Scholarships, Discounts & Concessions Policy','finance_commercial_control','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'FIN-P04','Procurement, Expenses & Vendor Policy','finance_commercial_control','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'FIN-P05','Cash, Reconciliation & Financial Records Policy','finance_commercial_control','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'FIN-P06','Revenue, Sponsorship & Donations Policy','finance_commercial_control','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'OPS-P01','Campus Operations & Readiness Policy','campus_daily_operations','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'OPS-P02','Health, Safety & Facility Management Policy','campus_daily_operations','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'OPS-P03','Asset, Inventory & Equipment Policy','campus_daily_operations','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'OPS-P04','Access, Visitor & Contractor Policy','campus_daily_operations','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'OPS-P05','Technology Operations & Access Policy','campus_daily_operations','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'OPS-P06','School Transport Operations Policy','campus_daily_operations','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'EVT-P01','Events & Special Programmes Policy','events_special_programmes','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'EVT-P02','Event Safety, Participation & External Participant Policy','events_special_programmes','School Guardian','C0','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'IPA-P01','Institutional Performance & Accountability Policy','institutional_performance_accountability','School Guardian','C1','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'IPA-P02','Institutional Improvement & Learning Policy','institutional_performance_accountability','School Guardian','C2','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();
  insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority,status,created_by)
  values(v_org,'IPA-P03','Research, Evidence & Programme Evaluation Policy','institutional_performance_accountability','School Guardian','C2','registered',v_actor)
  on conflict (organisation_id,code) do update set name=excluded.name,operating_system=excluded.operating_system,owner_label=excluded.owner_label,priority=excluded.priority,updated_at=now();

  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,approved_by,approved_at,status)
  select p.id,1,'Define how authority, delegation and escalation work so routine execution does not depend on the Vision Custodian.','All KNS staff, leaders, campuses, operating systems and delegated institutional decisions.','["Authority follows role and documented delegation, not personality.","Decisions should be made at the lowest competent level.","Escalation increases visibility but does not automatically remove ownership.","Reserved strategic authority remains with the Vision Custodian."]'::jsonb,'["Every recurring responsibility must have a named role owner.","Decision rights must be explicit enough that staff know what they may decide, what needs approval and what must be escalated.","The School Guardian owns whole-school execution within delegated authority.","Routine operational matters should not be escalated to the Vision Custodian when an authorised role can resolve them."]'::jsonb,'["Vision Custodian: protects purpose, strategy and reserved institutional authority.","School Guardian: owns whole-school execution and delegated operational decisions.","Inspectors and Sectional Promoters: decide and escalate within their functional scope.","All staff: act within role authority and escalate material exceptions through the defined route."]'::jsonb,'["No person may approve a matter explicitly reserved for a higher authority.","Delegation must identify scope, duration and limits where those are material.","Critical safeguarding, safety, legal or institutional-risk routes override ordinary reporting convenience.","A recurring matter that repeatedly reaches the Vision Custodian unnecessarily must be treated as a system-design defect."]'::jsonb,'["Emergency action may be taken to protect people or prevent material harm where waiting for ordinary approval would increase risk; the action must be documented and reviewed promptly."]'::jsonb,'["Escalate when a matter exceeds role authority, crosses material risk thresholds, remains unresolved beyond its SLA, or requires reserved institutional authority.","Repeated unnecessary escalation triggers review of role clarity, capability or process design."]'::jsonb,'["Role Charters and authority matrix.","Delegation and handover records.","Escalation records.","Decision and action records."]'::jsonb,current_date,(current_date + interval '12 months')::date,v_actor,now(),'active'
  from public.khpos_ops_policies p where p.organisation_id=v_org and p.code='GOV-P01'
  on conflict (policy_id,version) do nothing;
  update public.khpos_ops_policies set status='active',updated_at=now() where organisation_id=v_org and code='GOV-P01';

  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,approved_by,approved_at,status)
  select p.id,1,'Control how KNS policies, processes, playbooks and institutional documents are created, approved, versioned, communicated and retired.','All controlled KNS institutional documents and all roles that create, approve, use or maintain them.','["KHP-OS is the authoritative source for controlled operating documents.","Approved versions are immutable; changes create new versions.","A document is not institutional policy merely because somebody wrote or shared it.","Staff should see the current version relevant to their role."]'::jsonb,'["Every controlled policy and process must have a code, owner, status and version history.","Only an approved active version is authoritative.","Superseded versions remain historically traceable.","Material policy changes require communication and, where designated, fresh acknowledgement or training."]'::jsonb,'["Vision Custodian: approves foundational strategic policy where reserved.","School Guardian: stewards the institutional control library and approves within delegated authority.","Functional owners: draft and maintain documents within their domains.","Staff: follow active versions and complete required acknowledgements."]'::jsonb,'["Do not overwrite an approved policy or process version.","Do not use exported copies as the master when KHP-OS contains a later active version.","Draft or registered items must be visibly distinguished from adopted documents.","Review dates must trigger review, not automatic renewal or expiry unless policy states otherwise."]'::jsonb,'["An emergency temporary instruction may operate before formal documentation where immediate institutional protection requires it; it must be recorded, time-bounded and regularised promptly."]'::jsonb,'["Conflicting active documents or unclear authority are escalated to the School Guardian.","Foundational policy conflicts are escalated to the Vision Custodian."]'::jsonb,'["Policy Register.","Process Register.","Version history.","Approval records.","Acknowledgements and training records.","Document change log."]'::jsonb,current_date,(current_date + interval '12 months')::date,v_actor,now(),'active'
  from public.khpos_ops_policies p where p.organisation_id=v_org and p.code='GOV-P02'
  on conflict (policy_id,version) do nothing;
  update public.khpos_ops_policies set status='active',updated_at=now() where organisation_id=v_org and code='GOV-P02';

  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,approved_by,approved_at,status)
  select p.id,1,'Set the professional conduct standard expected from every KNS staff member and facilitator.','All employees, facilitators, temporary staff, leaders and adults acting in an official KNS capacity.','["Professional authority is exercised for learner and institutional benefit.","Dignity, fairness, reliability and appropriate boundaries are non-negotiable.","Staff behaviour must support KNS values and safeguarding responsibilities.","Accountability applies to leaders and staff alike."]'::jsonb,'["Staff must act respectfully, fulfil assigned responsibilities and protect confidential information.","Staff must maintain appropriate professional boundaries with learners and families.","Staff must report safeguarding, safety, fraud or serious institutional concerns through the appropriate route.","Staff must not misuse authority, institutional resources or confidential access."]'::jsonb,'["School Guardian: owns whole-school professional standards.","Direct leaders: model standards, coach early and address breaches fairly.","Staff: understand and comply with applicable standards and policies."]'::jsonb,'["No harassment, humiliation, discrimination, exploitation, retaliation, fraud or deliberate falsification of institutional records.","No unauthorised disclosure of learner, staff or institutional confidential information.","No deliberate bypass of safeguarding or financial controls.","Conflicts of interest must be disclosed where relevant."]'::jsonb,'["Professional judgement may require context-specific action, but never an exception to safeguarding, lawful obligations or basic dignity."]'::jsonb,'["Serious misconduct, repeated refusal to comply, safeguarding concerns or alleged abuse of authority move into the appropriate formal process."]'::jsonb,'["Policy acknowledgement.","Performance/coaching records where relevant.","Formal grievance or disciplinary records where triggered."]'::jsonb,current_date,(current_date + interval '12 months')::date,v_actor,now(),'active'
  from public.khpos_ops_policies p where p.organisation_id=v_org and p.code='PEO-P02'
  on conflict (policy_id,version) do nothing;
  update public.khpos_ops_policies set status='active',updated_at=now() where organisation_id=v_org and code='PEO-P02';

  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,approved_by,approved_at,status)
  select p.id,1,'Ensure every learner receives the intended academic programme at the required quality and that lost learning is visible and recovered.','Academic planning, scheme delivery, HQLS lesson execution, curriculum progress and academic recovery across KNS.','["Planned learning must become verified learning activity, not merely completed paperwork.","Delivered and verified are different states.","Missed or weakly delivered learning creates academic debt until recovered.","Academic leadership manages exceptions using evidence."]'::jsonb,'["Approved curriculum and scheme baselines guide term delivery.","Teachers prepare and execute learning according to KNS academic standards, including HQLS where applicable.","Sectional Promoters and Academic Inspector monitor progress and recovery.","Material missed or partial delivery must have a recovery action."]'::jsonb,'["Academic Inspector: owns academic execution and teaching quality.","Sectional Promoter: owns section-level monitoring and recovery.","Teacher: owns lesson preparation, delivery, learner evidence and immediate recovery actions.","School Guardian: resolves whole-school constraints and persistent execution failure."]'::jsonb,'["Do not mark planned learning delivered when it was not delivered.","Do not close academic debt without evidence of recovery.","Academic monitoring should focus leadership attention on exceptions, patterns and support needs.","Assessment and learner intervention link to their separate controlled processes."]'::jsonb,'["Approved calendar disruption or emergency may change delivery timing but does not erase the responsibility to reconcile affected learning."]'::jsonb,'["Persistent delivery failure, uncovered lessons, serious exam-readiness risk or repeated weak teaching escalates through the academic hierarchy."]'::jsonb,'["Academic readiness records.","Scheme progress.","Lesson monitoring.","Academic debt and recovery records.","Teaching observation evidence."]'::jsonb,current_date,(current_date + interval '12 months')::date,v_actor,now(),'active'
  from public.khpos_ops_policies p where p.organisation_id=v_org and p.code='ACD-P01'
  on conflict (policy_id,version) do nothing;
  update public.khpos_ops_policies set status='active',updated_at=now() where organisation_id=v_org and code='ACD-P01';

  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,approved_by,approved_at,status)
  select p.id,1,'Ensure learner difficulty is detected, diagnosed and supported early so no learner quietly falls through the cracks.','Learner baseline, progress monitoring, risk detection, diagnosis, intervention, reassessment and recovery.','["A concern is a signal to investigate, not a permanent label on a learner.","Diagnosis should precede structured intervention.","Interventions require an owner, review date and success evidence.","Support intensity should match need and evidence."]'::jsonb,'["Learners receive a baseline at entry or meaningful transition points.","Repeated or significant risk signals must trigger structured review.","Intervention plans specify the gap, response, owner, review date and evidence.","Intervention closes only when success criteria are evidenced or the case is formally redirected."]'::jsonb,'["Teacher: notices and responds to early learning signals.","Sectional Promoter: coordinates structured intervention.","Academic Inspector: oversees significant/persistent academic support.","School Guardian: handles complex cross-system constraints and institutional support."]'::jsonb,'["Do not equate a single score with a learner''s full capability.","Do not keep interventions open indefinitely without review.","Do not close an intervention solely because activities were performed.","Parent partnership is used where appropriate without transferring the school''s professional responsibility to the parent."]'::jsonb,'["Immediate welfare or safeguarding concerns leave the ordinary academic intervention pathway and follow the relevant protected route."]'::jsonb,'["Escalate when progress stalls despite appropriate support, needs exceed available authority/resources, or the concern has safeguarding/welfare dimensions."]'::jsonb,'["Baseline profile.","Risk flag.","Diagnosis record.","Intervention plan and activity evidence.","Reassessment and closure record."]'::jsonb,current_date,(current_date + interval '12 months')::date,v_actor,now(),'active'
  from public.khpos_ops_policies p where p.organisation_id=v_org and p.code='LPI-P01'
  on conflict (policy_id,version) do nothing;
  update public.khpos_ops_policies set status='active',updated_at=now() where organisation_id=v_org and code='LPI-P01';

  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,approved_by,approved_at,status)
  select p.id,1,'Govern how KNS helps learners discover, develop and deploy potential through evidence, practice, reflection and contribution.','Learner discovery, skills, leadership, financial capability, Young CEO activity, projects, reflection, portfolio and transition.','["Potential is progressively discovered and demonstrated; KNS does not permanently label a child.","Development requires exposure, practice, feedback, application and reflection.","Academic achievement is important but is not the whole definition of human potential.","Learners should increasingly create value and contribute, not merely consume instruction."]'::jsonb,'["KNS provides structured opportunities for learners to explore interests, capabilities and meaningful problems.","Potential hypotheses must remain open to new evidence.","Skills and project progression should produce observable competence and portfolio evidence.","PipuPath supports learner-facing reflection and portfolio activity while KHP-OS governs institutional execution."]'::jsonb,'["School Guardian: owns whole-school Human Potential outcomes.","Academic Inspector and Sectional Promoters: integrate projects and learner development with academic life.","Skill Inspector: owns skills and Young CEO execution.","Teachers/facilitators: provide evidence, coaching and opportunities without fixed labels.","Learners: increasingly own choices, practice, reflection and contribution."]'::jsonb,'["Do not reduce Human Potential Development to talent shows or personality labels.","Do not claim competence without evidence.","Do not confuse participation with mastery.","Learner-facing digital activity must follow safeguarding and privacy controls."]'::jsonb,'["A learner may change pathway when evidence and developmental need support the change; changes should be intentional rather than impulsive or punitive."]'::jsonb,'["Escalate persistent programme failure, serious learner welfare concerns, unsafe activity, or resource constraints preventing required development."]'::jsonb,'["Discovery evidence.","Skills progression.","Project and leadership evidence.","Reflections.","Human Potential Record and portfolio."]'::jsonb,current_date,(current_date + interval '12 months')::date,v_actor,now(),'active'
  from public.khpos_ops_policies p where p.organisation_id=v_org and p.code='HPD-P01'
  on conflict (policy_id,version) do nothing;
  update public.khpos_ops_policies set status='active',updated_at=now() where organisation_id=v_org and code='HPD-P01';

  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,approved_by,approved_at,status)
  select p.id,1,'Create a student culture in which responsibility, dignity, restoration and contribution replace fear-based discipline.','Student expectations, everyday correction, behaviour incidents, restorative response and repeated/serious misconduct.','["Builders take responsibility for impact and repair.","Correction should protect learning, dignity and community.","Consequences may exist without humiliation.","Behaviour systems should help learners grow in self-governance."]'::jsonb,'["KNS clearly teaches its culture expectations.","Minor behaviour is corrected at the lowest appropriate level.","Significant or repeated behaviour is documented and receives structured response.","Restorative action asks what happened, who or what was affected, what responsibility exists and what repairs/prevents recurrence."]'::jsonb,'["Teacher: manages everyday classroom expectations and immediate correction.","Sectional Promoter: handles repeated/significant section concerns.","School Guardian: handles serious or persistent school-level behaviour.","Safeguarding Lead/pathway takes precedence where a concern becomes safeguarding."]'::jsonb,'["No humiliating, degrading or retaliatory discipline.","Do not treat every conflict as bullying or safeguarding; classify evidence carefully.","Do not use student leaders as disciplinary authorities over peers.","Repeated patterns require support and accountability, not repeated identical punishment."]'::jsonb,'["Immediate protective action may be taken during serious risk; subsequent review must still preserve fairness and documentation."]'::jsonb,'["Serious misconduct, persistent patterns, safety risk or safeguarding indicators move to the appropriate higher process."]'::jsonb,'["Behaviour incident record.","Restorative response.","Behaviour support plan where required.","Resolution/closure evidence."]'::jsonb,current_date,(current_date + interval '12 months')::date,v_actor,now(),'active'
  from public.khpos_ops_policies p where p.organisation_id=v_org and p.code='CUL-P01'
  on conflict (policy_id,version) do nothing;
  update public.khpos_ops_policies set status='active',updated_at=now() where organisation_id=v_org and code='CUL-P01';

  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,approved_by,approved_at,status)
  select p.id,1,'Define a clear, respectful partnership between KNS and families so communication supports learner progress and institutional trust.','Routine parent communication, parent responsibilities, meetings, forums, education, feedback and learner-related partnership.','["Parents deserve clarity, dignity and truthful information.","Communication should use approved channels and preserve institutional memory.","Teachers are professionals, not 24/7 personal support lines.","Parents and school have different but complementary responsibilities."]'::jsonb,'["KNS communicates significant learner, programme and institutional information through defined channels.","Important communication requiring action or acknowledgement should be recorded in KHP-OS or the designated source of truth.","Parents receive explanation of KNS philosophy and distinctive programmes during onboarding and continuing education.","Concerns are routed to the lowest appropriate owner and escalated when necessary."]'::jsonb,'["School Guardian: owns whole-school parent experience.","Sectional Promoters: own most learner/section parent issues.","Teachers/facilitators: provide appropriate classroom/programme information within boundaries.","Parents: provide accurate information, support agreed actions and use respectful approved channels."]'::jsonb,'["WhatsApp may deliver communication but must not become the only institutional record for material matters.","Do not disclose another learner''s confidential information while resolving a concern.","Do not bypass safeguarding procedures through ordinary parent communication.","Boundaries on timing and channels should be communicated clearly."]'::jsonb,'["Emergency or safeguarding communication may use the fastest safe channel and follow the specialised process."]'::jsonb,'["Unresolved academic concerns follow Teacher → Sectional Promoter → Academic Inspector → School Guardian.","Skills concerns follow Facilitator → Skill Inspector → School Guardian.","Institutional matters reach the Vision Custodian only when delegated school authority cannot resolve them."]'::jsonb,'["Communication record.","Parent meeting record.","Parent education/forum record.","Feedback and action record."]'::jsonb,current_date,(current_date + interval '12 months')::date,v_actor,now(),'active'
  from public.khpos_ops_policies p where p.organisation_id=v_org and p.code='PAR-P02'
  on conflict (policy_id,version) do nothing;
  update public.khpos_ops_policies set status='active',updated_at=now() where organisation_id=v_org and code='PAR-P02';

  insert into public.khpos_ops_policy_versions(policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,rules,exceptions,escalation,records_evidence,effective_date,review_date,approved_by,approved_at,status)
  select p.id,1,'Create a consistent performance and accountability system that shows expected outcomes, current reality, exceptions and required action.','Individual, team, operating-system, campus and future network performance management.','["Accountability is ownership plus evidence, not blame.","A small number of meaningful KPIs is better than large volumes of vanity metrics.","Outcome, process and risk indicators should be distinguished.","Critical safeguarding or safety failure cannot be averaged away by good performance elsewhere."]'::jsonb,'["Every significant role should have a concise scorecard linked to owned outcomes.","Leadership reviews trends, exceptions and overdue improvement actions rather than asking staff to manually recreate information already in systems.","Red or persistent amber performance requires diagnosis and action.","Improvement is verified before closure."]'::jsonb,'["Vision Custodian: reviews strategic/campus-level health and reserved decisions.","School Guardian: owns whole-school performance rhythm.","Inspectors/Promoters: own functional and section scorecards.","Role holders: own their defined outcomes and improvement actions."]'::jsonb,'["Do not create composite scores that hide critical control failure.","Do not change KPI definitions casually to improve reported performance.","Use baseline evidence before locking arbitrary targets where reliable historical data is absent.","Meetings must produce accountable actions where action is required."]'::jsonb,'["A KPI may be temporarily suspended or redefined only through documented governance when the underlying data/definition is materially invalid."]'::jsonb,'["Persistent red performance, systemic repeated failure or major strategic risk escalates according to authority and severity."]'::jsonb,'["KPI dictionary.","Role/team/system scorecards.","Performance review actions.","Improvement plans.","Institutional learning records."]'::jsonb,current_date,(current_date + interval '12 months')::date,v_actor,now(),'active'
  from public.khpos_ops_policies p where p.organisation_id=v_org and p.code='IPA-P01'
  on conflict (policy_id,version) do nothing;
  update public.khpos_ops_policies set status='active',updated_at=now() where organisation_id=v_org and code='IPA-P01';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='VISION_CUSTODIAN' where p.organisation_id=v_org and p.code='GOV-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SCHOOL_GUARDIAN' where p.organisation_id=v_org and p.code='GOV-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='ACADEMIC_INSPECTOR' where p.organisation_id=v_org and p.code='GOV-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILL_INSPECTOR' where p.organisation_id=v_org and p.code='GOV-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SECTIONAL_PROMOTER' where p.organisation_id=v_org and p.code='GOV-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='TEACHER' where p.organisation_id=v_org and p.code='GOV-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILLS_FACILITATOR' where p.organisation_id=v_org and p.code='GOV-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='VISION_CUSTODIAN' where p.organisation_id=v_org and p.code='GOV-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SCHOOL_GUARDIAN' where p.organisation_id=v_org and p.code='GOV-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='ACADEMIC_INSPECTOR' where p.organisation_id=v_org and p.code='GOV-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILL_INSPECTOR' where p.organisation_id=v_org and p.code='GOV-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SCHOOL_GUARDIAN' where p.organisation_id=v_org and p.code='PEO-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='ACADEMIC_INSPECTOR' where p.organisation_id=v_org and p.code='PEO-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILL_INSPECTOR' where p.organisation_id=v_org and p.code='PEO-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SECTIONAL_PROMOTER' where p.organisation_id=v_org and p.code='PEO-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='TEACHER' where p.organisation_id=v_org and p.code='PEO-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILLS_FACILITATOR' where p.organisation_id=v_org and p.code='PEO-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SCHOOL_GUARDIAN' where p.organisation_id=v_org and p.code='ACD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='ACADEMIC_INSPECTOR' where p.organisation_id=v_org and p.code='ACD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SECTIONAL_PROMOTER' where p.organisation_id=v_org and p.code='ACD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='TEACHER' where p.organisation_id=v_org and p.code='ACD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SCHOOL_GUARDIAN' where p.organisation_id=v_org and p.code='LPI-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='ACADEMIC_INSPECTOR' where p.organisation_id=v_org and p.code='LPI-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SECTIONAL_PROMOTER' where p.organisation_id=v_org and p.code='LPI-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='TEACHER' where p.organisation_id=v_org and p.code='LPI-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='VISION_CUSTODIAN' where p.organisation_id=v_org and p.code='HPD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SCHOOL_GUARDIAN' where p.organisation_id=v_org and p.code='HPD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='ACADEMIC_INSPECTOR' where p.organisation_id=v_org and p.code='HPD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILL_INSPECTOR' where p.organisation_id=v_org and p.code='HPD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SECTIONAL_PROMOTER' where p.organisation_id=v_org and p.code='HPD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='TEACHER' where p.organisation_id=v_org and p.code='HPD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILLS_FACILITATOR' where p.organisation_id=v_org and p.code='HPD-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SCHOOL_GUARDIAN' where p.organisation_id=v_org and p.code='CUL-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SECTIONAL_PROMOTER' where p.organisation_id=v_org and p.code='CUL-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='TEACHER' where p.organisation_id=v_org and p.code='CUL-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILLS_FACILITATOR' where p.organisation_id=v_org and p.code='CUL-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SCHOOL_GUARDIAN' where p.organisation_id=v_org and p.code='PAR-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='ACADEMIC_INSPECTOR' where p.organisation_id=v_org and p.code='PAR-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILL_INSPECTOR' where p.organisation_id=v_org and p.code='PAR-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SECTIONAL_PROMOTER' where p.organisation_id=v_org and p.code='PAR-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='TEACHER' where p.organisation_id=v_org and p.code='PAR-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILLS_FACILITATOR' where p.organisation_id=v_org and p.code='PAR-P02'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='VISION_CUSTODIAN' where p.organisation_id=v_org and p.code='IPA-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SCHOOL_GUARDIAN' where p.organisation_id=v_org and p.code='IPA-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='ACADEMIC_INSPECTOR' where p.organisation_id=v_org and p.code='IPA-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SKILL_INSPECTOR' where p.organisation_id=v_org and p.code='IPA-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';
  insert into public.khpos_ops_policy_roles(policy_id,role_id,requirement_type)
  select p.id,r.id,'mandatory' from public.khpos_ops_policies p join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.code='SECTIONAL_PROMOTER' where p.organisation_id=v_org and p.code='IPA-P01'
  on conflict (policy_id,role_id) do update set requirement_type='mandatory';

  insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
  select v_org,v_actor,'ops_o2_policy_register_bootstrapped','organisation',v_org,jsonb_build_object('policyCount',56,'approvedPolicyDocuments',9,'architectureVersion','O2-v1.0')
  where not exists(select 1 from public.khpos_ops_audit_events where organisation_id=v_org and event_type='ops_o2_policy_register_bootstrapped');
end;
$$;
