-- Idempotent operating structure for an approved school. An executive member starts as Vision Custodian.
create or replace function public.khpos_ops_bootstrap_partner_server(p_organisation_id uuid)
returns void language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare
  v_org uuid := p_organisation_id;
  v_actor uuid;
  v_campus uuid;
  v_vc uuid;
  v_sg uuid;
  v_ai uuid;
  v_si uuid;
  v_sp uuid;
  v_teacher uuid;
  v_facilitator uuid;
begin
  select m.user_id into v_actor from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=v_org and m.status='active' and m.role='executive'
    and o.partner_status='active' and 'khpos_core'=any(o.partner_entitlements)
  order by m.created_at limit 1;
  if v_actor is null then raise exception 'An active approved school with an executive is required.'; end if;
  if exists(select 1 from public.khpos_ops_roles where organisation_id=v_org and code='VISION_CUSTODIAN') then return; end if;
  perform set_config('khpos.bootstrap_partner',v_org::text,true);
  insert into public.khpos_ops_campuses(
    organisation_id,code,name,status,created_by
  ) values (
    v_org,'MAIN','Main Campus','active',v_actor
  )
  on conflict (organisation_id,code) do update
  set name=excluded.name,status='active',updated_at=now()
  returning id into v_campus;

  insert into public.khpos_ops_units(
    organisation_id,campus_id,code,name,unit_type,status,created_by
  ) values
    (v_org,v_campus,'ACADEMICS','Academic Function','academic_function','active',v_actor),
    (v_org,v_campus,'SECTION_1','Learning Section 1','academic_section','active',v_actor),
    (v_org,v_campus,'SECTION_2','Learning Section 2','academic_section','active',v_actor),
    (v_org,v_campus,'SKILLS','Skills & Young CEO Hub','skills_function','active',v_actor)
  on conflict (organisation_id,code) do update
  set campus_id=excluded.campus_id,
      name=excluded.name,
      unit_type=excluded.unit_type,
      status='active',
      updated_at=now();

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'VISION_CUSTODIAN','Vision Custodian','leadership',1,null,
    array[
      'governance_decision','people_staff','academic_execution','learner_progress_intervention',
      'human_potential_development','student_culture_leadership','safeguarding_welfare_emergency',
      'parent_experience_partnership','finance_commercial_control','campus_daily_operations',
      'events_special_programmes','institutional_performance_accountability'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=null,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_vc;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'SCHOOL_GUARDIAN','School Guardian','leadership',2,v_vc,
    array[
      'governance_decision','people_staff','academic_execution','learner_progress_intervention',
      'human_potential_development','student_culture_leadership','safeguarding_welfare_emergency',
      'parent_experience_partnership','finance_commercial_control','campus_daily_operations',
      'events_special_programmes','institutional_performance_accountability'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_sg;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'ACADEMIC_INSPECTOR','Academic Inspector','academic_leadership',3,v_sg,
    array['academic_execution','learner_progress_intervention','institutional_performance_accountability'],
    'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_ai;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'SKILL_INSPECTOR','Skill Inspector','skills_leadership',3,v_sg,
    array['human_potential_development','events_special_programmes','institutional_performance_accountability'],
    'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_si;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'SECTIONAL_PROMOTER','Sectional Promoter','section_leadership',4,v_ai,
    array[
      'academic_execution','learner_progress_intervention','student_culture_leadership',
      'parent_experience_partnership','institutional_performance_accountability'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_sp;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'TEACHER','Teacher','learner_facing',5,v_sp,
    array[
      'academic_execution','learner_progress_intervention','human_potential_development',
      'student_culture_leadership','safeguarding_welfare_emergency','parent_experience_partnership'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_teacher;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'SKILLS_FACILITATOR','Skills Facilitator','learner_facing',5,v_si,
    array[
      'human_potential_development','student_culture_leadership',
      'safeguarding_welfare_emergency','events_special_programmes'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_facilitator;

  insert into public.khpos_ops_role_charters(
    role_id,version,mission,owned_outcomes,responsibilities,decision_rights,
    escalation_rules,kpis,required_policy_codes,effective_date,approved_by,approved_at,status
  ) values
  (
    v_vc,1,
    'Protect the school purpose, philosophy and long-term direction while keeping routine school execution out of the Vision Custodian seat.',
    '["Institutional purpose remains clear","Strategic direction is coherent","Major institutional risks receive appropriate authority","the school can scale without founder-dependent daily operations"]'::jsonb,
    '["Set and guard institutional vision and philosophy","Approve foundational strategic policies and major structural changes","Review strategic risks and campus/network health","Build external relationships and expansion direction"]'::jsonb,
    '["Decide institutional strategy and philosophy","Approve major capital or structural commitments","Approve matters explicitly reserved for Vision Custodian authority","Delegate routine operational authority to the School Guardian"]'::jsonb,
    '["Receive only strategic, institutional, critical or repeatedly unresolved exceptions","Return routine matters to the delegated operating authority","Require system correction where the same dependency repeatedly reaches this seat"]'::jsonb,
    '["Strategic milestones on track","Critical institutional risks unresolved","Decisions unnecessarily waiting for Vision Custodian","Founder-dependency defects identified and removed"]'::jsonb,
    array['GOV-P01','GOV-P02','IPA-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_sg,1,
    'Own whole-school execution so the campus consistently delivers the school standards without requiring routine Vision Custodian intervention.',
    '["School operates safely and predictably","Operating systems execute at required standard","Leaders and staff own their responsibilities","Exceptions are resolved at the lowest appropriate level"]'::jsonb,
    '["Coordinate whole-school execution","Lead operating and performance rhythms","Ensure cross-functional problems receive owners and deadlines","Hold Inspectors and designated operational owners accountable","Escalate only matters beyond delegated authority"]'::jsonb,
    '["Make whole-school operational decisions within delegated authority","Approve routine campus actions and designated requests","Assign owners and require recovery actions","Escalate strategic or reserved decisions"]'::jsonb,
    '["Escalate critical safeguarding/security/financial or institutional risks immediately through the appropriate route","Escalate persistent cross-system failure when delegated authority cannot resolve it","Do not escalate routine work simply because it is difficult"]'::jsonb,
    '["Campus readiness","Critical exceptions unresolved","Overdue leadership actions","Operating-system health","Strategic escalations requiring Vision Custodian"]'::jsonb,
    array['GOV-P01','PEO-P05','SAF-P01','IPA-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_ai,1,
    'Ensure intended learning is taught, verified and recovered while teachers and sections continuously improve instructional execution.',
    '["Curriculum delivery remains on track","Academic debt is visible and recovered","Teaching quality improves through evidence","Learners at academic risk receive timely support"]'::jsonb,
    '["Own academic planning and teaching-quality execution","Lead Sectional Promoters on academic delivery","Monitor scheme progress, missed lessons and recovery","Coordinate assessment and examination readiness","Drive academic intervention with evidence"]'::jsonb,
    '["Set academic execution standards within approved policy","Require recovery for missed or weak delivery","Approve academic operating adjustments within authority","Escalate whole-school academic risks to School Guardian"]'::jsonb,
    '["Escalate persistent section failure or uncovered learning to School Guardian","Escalate safeguarding or welfare concerns through the safeguarding route","Do not bypass Sectional Promoters for routine teacher execution"]'::jsonb,
    '["Curriculum delivery vs plan","Academic debt","Teaching-quality follow-up","Learner-risk intervention closure","Exam readiness"]'::jsonb,
    array['ACD-P01','ACD-P02','ACD-P03','LPI-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_si,1,
    'Ensure the school skills and Young CEO experiences develop real capability, value creation and evidence of learner growth.',
    '["Skills pathways run consistently","Learners progress through practical competence","Young CEO Hub produces real value-creation practice","Skills facilitators execute safely and effectively"]'::jsonb,
    '["Own skills-programme execution","Lead skills facilitators","Monitor competency progression and pathway delivery","Coordinate Young CEO Hub","Connect skills evidence to Human Potential development"]'::jsonb,
    '["Set skills execution expectations within approved policy","Adjust skills delivery and facilitator deployment within authority","Require recovery where programme delivery fails","Escalate resource or institutional constraints to School Guardian"]'::jsonb,
    '["Escalate safeguarding concerns immediately through the safeguarding route","Escalate persistent facilitator or resource failures to School Guardian","Escalate major programme commitments requiring broader authority"]'::jsonb,
    '["Skills participation","Competency progression","Young CEO execution","Facilitator exceptions","Programme milestones completed"]'::jsonb,
    array['HPD-P01','HPD-P02','HPD-P04','SAF-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_sp,1,
    'Own the health of an assigned school section by connecting teacher execution, learner progress, culture and parent issues before they become whole-school problems.',
    '["Section learning remains on track","Learner risks are detected early","Teacher execution exceptions are resolved","Section culture and parent concerns are handled promptly"]'::jsonb,
    '["Monitor daily and weekly section execution","Support and hold teachers accountable","Coordinate learner interventions","Resolve section-level behaviour and parent issues","Report meaningful section exceptions to Academic Inspector"]'::jsonb,
    '["Make routine section decisions within policy","Assign recovery actions to teachers","Coordinate section interventions and meetings","Escalate matters beyond section authority"]'::jsonb,
    '["Escalate persistent academic failure to Academic Inspector","Escalate safeguarding through the safeguarding route","Escalate whole-school operational issues to the appropriate leader rather than absorbing them"]'::jsonb,
    '["Section curriculum execution","Academic debt","Learner-risk cases","Teacher exceptions","Behaviour/parent issues overdue"]'::jsonb,
    array['ACD-P01','LPI-P01','CUL-P01','PAR-P02'],current_date,v_actor,now(),'active'
  ),
  (
    v_teacher,1,
    'Deliver high-quality learning, notice learner needs early and execute assigned responsibilities with evidence and professional care.',
    '["Planned learning is delivered","Learners receive timely feedback and support","Classroom culture supports responsibility and growth","Required evidence and follow-up are completed"]'::jsonb,
    '["Prepare and execute HQLS learning","Monitor learner understanding and progress","Raise and act on learner-risk signals","Maintain professional classroom culture","Communicate through approved parent and reporting channels"]'::jsonb,
    '["Make day-to-day instructional decisions within curriculum and policy","Take immediate classroom recovery action","Raise issues when barriers exceed teacher authority","Never independently investigate safeguarding concerns"]'::jsonb,
    '["Escalate academic execution barriers to Sectional Promoter","Escalate safeguarding concerns immediately through designated safeguarding process","Escalate repeated learner concerns when classroom intervention is insufficient"]'::jsonb,
    '["Required lessons delivered","Missed learning recovered","Learner-risk actions completed","Teaching-quality development","Assigned responsibilities completed on time"]'::jsonb,
    array['PEO-P02','ACD-P01','LPI-P01','CUL-P01','SAF-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_facilitator,1,
    'Develop practical learner capability through safe, purposeful skills practice that progresses from exposure to independent application and value creation.',
    '["Skills sessions are consistently delivered","Learner competence progresses","Practice produces verifiable outputs","Learners apply skills responsibly and safely"]'::jsonb,
    '["Prepare and facilitate practical skills sessions","Track competency evidence","Maintain safe use of tools/materials","Support projects and value creation","Report learner or programme concerns to Skill Inspector"]'::jsonb,
    '["Make routine facilitation decisions within approved programme standards","Adapt practice tasks to learner readiness","Stop unsafe activity immediately","Escalate resource/programme constraints"]'::jsonb,
    '["Escalate safeguarding concerns immediately through designated process","Escalate repeated programme/resource failure to Skill Inspector","Escalate safety hazards before continuing practical activity"]'::jsonb,
    '["Skills sessions delivered","Competency progression","Evidence quality","Safety exceptions","Assigned programme actions completed"]'::jsonb,
    array['PEO-P02','HPD-P01','HPD-P02','SAF-P01'],current_date,v_actor,now(),'active'
  )
  on conflict (role_id,version) do update
  set mission=excluded.mission,
      owned_outcomes=excluded.owned_outcomes,
      responsibilities=excluded.responsibilities,
      decision_rights=excluded.decision_rights,
      escalation_rules=excluded.escalation_rules,
      kpis=excluded.kpis,
      required_policy_codes=excluded.required_policy_codes,
      effective_date=excluded.effective_date,
      approved_by=excluded.approved_by,
      approved_at=excluded.approved_at,
      status='active';

  if not exists (
    select 1
    from public.khpos_ops_role_assignments
    where role_id=v_vc and user_id=v_actor and status='active'
  ) then
    insert into public.khpos_ops_role_assignments(
      role_id,user_id,primary_assignment,status,start_date,appointed_by
    ) values (
      v_vc,v_actor,true,'active',current_date,v_actor
    );
  end if;

  if not exists (
    select 1 from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o1_structure_bootstrapped'
  ) then
    insert into public.khpos_ops_audit_events(
      organisation_id,actor_user_id,event_type,object_type,object_id,metadata
    ) values (
      v_org,v_actor,'ops_o1_structure_bootstrapped','organisation',v_org,
      jsonb_build_object(
        'campus','MAIN',
        'roles',7,
        'units',4,
        'architectureVersion','O1-multischool-v1.0'
      )
    );
  end if;
end;
$$;
revoke all on function public.khpos_ops_bootstrap_partner_server(uuid) from public,anon,authenticated;
grant execute on function public.khpos_ops_bootstrap_partner_server(uuid) to service_role;

-- The founding seat is created only inside a verified approved-partner bootstrap.
create or replace function khpos_private.ops_guard_leadership_assignment()
returns trigger language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_code text; v_org uuid;
begin
  select code,organisation_id into v_code,v_org from public.khpos_ops_roles where id=new.role_id;
  if v_code='VISION_CUSTODIAN' then
    if tg_op='INSERT' then
      if current_setting('khpos.bootstrap_partner',true) is distinct from v_org::text
         or new.appointed_by is distinct from new.user_id
         or exists(select 1 from public.khpos_ops_role_assignments where role_id=new.role_id and status='active') then
        raise exception 'Vision Custodian seats require separate governance approval.';
      end if;
    elsif old.status<>'active' or new.user_id<>old.user_id or new.role_id<>old.role_id then
      raise exception 'Vision Custodian seats require separate governance approval.';
    end if;
  elsif v_code='SCHOOL_GUARDIAN' and new.status='active' then
    if new.campus_id is null then raise exception 'School Guardian assignment requires a campus.'; end if;
    if tg_op='INSERT' or old.status<>'active' or new.user_id<>old.user_id or new.role_id<>old.role_id or new.campus_id is distinct from old.campus_id then
      if new.appointed_by is null or not khpos_private.ops_hpd_has_membership(new.appointed_by,v_org) or not khpos_private.ops_hpd_actor_has_role(new.appointed_by,v_org,array['VISION_CUSTODIAN']::text[]) then
        raise exception 'Only an active Vision Custodian can appoint a campus School Guardian.';
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.khpos_ops_bootstrap_approved_partner_trigger()
returns trigger language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
begin
  if new.status='active' and new.role='executive' and (tg_op='INSERT' or old.status is distinct from new.status) then
    if exists(select 1 from public.organisations where id=new.organisation_id and partner_status='active') then
      perform public.khpos_ops_bootstrap_partner_server(new.organisation_id);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists khpos_ops_bootstrap_approved_partner on public.organisation_memberships;
create trigger khpos_ops_bootstrap_approved_partner
after insert or update of status on public.organisation_memberships
for each row execute function public.khpos_ops_bootstrap_approved_partner_trigger();
revoke all on function public.khpos_ops_bootstrap_approved_partner_trigger() from public,anon,authenticated;

-- Cancel an appointment before activation without removing its audit history.
create or replace function public.khpos_ops_cancel_staff_appointment_server(p_actor uuid,p_org uuid,p_staff uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_staff public.khpos_ops_staff%rowtype;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_can_manage_people(p_actor,p_org) then
    raise exception 'School leadership membership is required.';
  end if;
  if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Give a reason of at least 10 characters.'; end if;
  select * into v_staff from public.khpos_ops_staff where id=p_staff and organisation_id=p_org for update;
  if v_staff.id is null or v_staff.status not in ('onboarding','ready') or v_staff.role_assignment_id is not null then
    raise exception 'Only an appointment that has not been activated can be cancelled. Use Progression & Exit for active staff.';
  end if;
  delete from public.khpos_ops_staff_access_invites where staff_id=p_staff;
  if v_staff.user_id is not null and not exists(
    select 1 from public.khpos_ops_staff s where s.organisation_id=p_org and s.user_id=v_staff.user_id and s.id<>p_staff and s.status in ('active','ready','onboarding','exiting')
  ) then
    update public.organisation_memberships set status='ended',updated_at=now()
    where organisation_id=p_org and user_id=v_staff.user_id and status='active' and role='contributor';
  end if;
  update public.khpos_ops_staff set status='ended',updated_at=now() where id=p_staff;
  insert into public.khpos_ops_staff_events(organisation_id,staff_id,actor_user_id,event_type,note)
  values(p_org,p_staff,p_actor,'appointment_cancelled',btrim(p_reason));
  insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
  values(p_org,p_actor,'ops_staff_appointment_cancelled','staff',p_staff,jsonb_build_object('reason',btrim(p_reason)));
end $$;
revoke all on function public.khpos_ops_cancel_staff_appointment_server(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.khpos_ops_cancel_staff_appointment_server(uuid,uuid,uuid,text) to service_role;
