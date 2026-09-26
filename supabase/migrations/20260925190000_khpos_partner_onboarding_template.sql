-- The KAEC leadership framework is shared; each school keeps its own records and staff.
create or replace function public.khpos_ops_seed_partner_onboarding_server(p_org uuid,p_actor uuid)
returns void language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_org uuid:=p_org; v_actor uuid:=p_actor;
begin
  if not exists(select 1 from public.organisation_memberships m join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_org and m.user_id=p_actor and m.role='executive' and m.status='active'
      and o.partner_status='active' and 'khpos_core'=any(o.partner_entitlements)) then
    raise exception 'An active approved school executive is required.';
  end if;
  insert into public.khpos_ops_onboarding_requirements(
    organisation_id,code,title,description,category,mandatory,waivable,
    evidence_required,applicable_role_codes,sort_order,status,created_by
  ) values
    (v_org,'PEO-ONB-001','KAEC Builder purpose & philosophy',
      'Understand KAEC purpose, the school identity and the responsibility to raise builders rather than merely deliver certificates.',
      'identity',true,false,false,'{}'::text[],10,'active',v_actor),
    (v_org,'PEO-ONB-002','Role Charter & reporting line',
      'Review the active Role Charter, owned outcomes, decision rights, responsibilities, reporting line and escalation rules.',
      'role_clarity',true,false,false,'{}'::text[],20,'active',v_actor),
    (v_org,'PEO-ONB-003','Staff Code & professional standards',
      'Understand the active Staff Code of Conduct, professional standards and institutional expectations.',
      'professional_standards',true,false,false,'{}'::text[],30,'active',v_actor),
    (v_org,'PEO-ONB-004','Safeguarding & professional boundaries',
      'Complete the required safeguarding induction and staff-student professional-boundary training. Sensitive case information is not stored in this onboarding record.',
      'safeguarding',true,false,true,'{}'::text[],40,'active',v_actor),
    (v_org,'PEO-ONB-005','Reporting, escalation & Issue Engine',
      'Know what to handle, what to report, how issues are recorded and when escalation increases visibility without abandoning ownership.',
      'accountability',true,false,false,'{}'::text[],50,'active',v_actor),
    (v_org,'PEO-ONB-006','Confidentiality & responsible data handling',
      'Understand confidentiality, minimum-necessary access and approved handling of learner, parent, staff and institutional information.',
      'data_responsibility',true,false,false,'{}'::text[],60,'active',v_actor),
    (v_org,'PEO-ONB-007','KHP-OS operating workflow',
      'Know how My Work, evidence, Issues, Decisions and role-owned scorecards are used for daily execution.',
      'systems',true,false,false,'{}'::text[],70,'active',v_actor),
    (v_org,'PEO-ONB-008','HQLS & academic execution',
      'Demonstrate readiness to work with the KAEC HQLS academic execution model and its verification/recovery expectations.',
      'academic',true,false,true,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SECTIONAL_PROMOTER','TEACHER']::text[],
      80,'active',v_actor),
    (v_org,'PEO-ONB-009','Learner progress & intervention',
      'Understand early risk detection, diagnosis-before-intervention, review dates and evidence-based recovery.',
      'learner_support',true,false,false,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SECTIONAL_PROMOTER','TEACHER']::text[],
      90,'active',v_actor),
    (v_org,'PEO-ONB-010','Human Potential, PipuPath & Builder Projects',
      'Understand how the school helps learners discover, develop and deploy potential and how PipuPath/Builder Projects support that journey.',
      'human_potential',true,false,false,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[],
      100,'active',v_actor),
    (v_org,'PEO-ONB-011','Skills & Young CEO operating model',
      'Understand the competency pathway, safe skills delivery and Young CEO value-creation model.',
      'skills',true,false,false,
      array['SCHOOL_GUARDIAN','SKILL_INSPECTOR','SKILLS_FACILITATOR']::text[],
      110,'active',v_actor),
    (v_org,'PEO-ONB-012','Parent communication boundaries',
      'Understand approved parent channels, escalation, confidentiality and the boundary that staff are not 24/7 personal support lines.',
      'parent_partnership',true,false,false,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[],
      120,'active',v_actor),
    (v_org,'PEO-ONB-013','Initial workload & deployment confirmed',
      'Confirm initial timetable, section/programme allocation or other workload is clear enough for the role to begin without hidden ownership gaps.',
      'deployment',true,false,true,
      array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[],
      130,'active',v_actor)
  on conflict (organisation_id,code) do nothing;
end $$;
revoke all on function public.khpos_ops_seed_partner_onboarding_server(uuid,uuid) from public,anon,authenticated;
grant execute on function public.khpos_ops_seed_partner_onboarding_server(uuid,uuid) to service_role;

create or replace function public.khpos_ops_bootstrap_approved_partner_trigger()
returns trigger language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
begin
  if new.status='active' and new.role='executive' and (tg_op='INSERT' or old.status is distinct from new.status) then
    if exists(select 1 from public.organisations where id=new.organisation_id and partner_status='active') then
      perform public.khpos_ops_bootstrap_partner_server(new.organisation_id);
      perform public.khpos_ops_seed_partner_onboarding_server(new.organisation_id,new.user_id);
    end if;
  end if;
  return new;
end $$;
