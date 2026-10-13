-- O76: two school operating seats and expanded Inspector people coordination.
-- Idempotent across partner schools; no staff appointments or sensitive case data are modified.
create or replace function khpos_private.ops_ensure_school_support_roles(p_org uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid;
  v_guardian uuid;
  v_role uuid;
  v_inspector record;
  v_charter public.khpos_ops_role_charters%rowtype;
  v_add jsonb;
  v_rights jsonb;
  v_kpis jsonb;
  v_mission text;
  v_code text;
  v_title text;
  v_scopes text[];
  v_required text[];
begin
  select m.user_id into v_actor from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_org and m.status='active' and m.role='executive'
    and o.status='active' and o.partner_status='active'
  order by m.created_at limit 1;
  if v_actor is null then return; end if;
  select id into v_guardian from public.khpos_ops_roles
    where organisation_id=p_org and code='SCHOOL_GUARDIAN' and status='active';
  if v_guardian is null then return; end if;

  for v_code in select unnest(array['FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER'])
  loop
    if v_code='FINANCE_ADMIN_OFFICER' then
      v_title:='Finance & Administration Officer';
      v_scopes:=array['finance_commercial_control','campus_daily_operations','governance_decision'];
      v_mission:='Keep school money, administration and procurement accurately recorded, timely and accountable without authorising personal expenditure.';
      v_required:=array['FIN-P01'];
      v_add:=jsonb_build_array(
        'Maintain fee registers, receipts, debtor follow-up and payment reconciliations',
        'Prepare expense requests, budgets, purchasing records and supporting evidence',
        'Coordinate approved procurement, inventories and administrative correspondence',
        'Track financial exceptions and report reliable management information to the School Guardian',
        'Keep confidential staff and financial records within their approved access boundaries');
      v_rights:=jsonb_build_array(
        'Record and prepare finance/administration work within delegated authority',
        'Recommend purchases and escalate overdue fees or financial anomalies',
        'Request approvals; never approve or verify own expenses or override financial controls');
      v_kpis:=jsonb_build_array('Fee ledger reconciliation','Overdue accounts followed up','Procurement evidence completeness','Expense-approval turnaround','Administrative record accuracy');
    else
      v_title:='School Care & Operations Officer';
      v_scopes:=array['safeguarding_welfare_emergency','parent_experience_partnership','campus_daily_operations','student_culture_leadership'];
      v_mission:='Ensure learners and families are cared for and school facilities remain safe, functional and responsive; safeguard confidential case records through formal designation.';
      v_required:=array['SAF-P01','PAR-P02'];
      v_add:=jsonb_build_array(
        'Coordinate learner welfare, attendance-related concerns and appropriate referrals',
        'Receive and route safeguarding disclosures immediately through the designated safeguarding pathway',
        'Track campus cleanliness, maintenance, equipment readiness and safety hazards',
        'Manage parent enquiries, communication, complaints, follow-ups and service recovery',
        'Keep welfare and parent communication records accurate without exposing restricted safeguarding case narratives');
      v_rights:=jsonb_build_array(
        'Coordinate routine parent, welfare and facilities follow-up within school policy',
        'Raise urgent safety concerns and request maintenance or welfare interventions',
        'Read or manage confidential safeguarding cases ONLY if separately appointed as campus safeguarding lead or deputy',
        'Escalate serious safeguarding, unresolved parent or facilities risks through authorised routes');
      v_kpis:=jsonb_build_array('Welfare support follow-up','Parent response turnaround','Unresolved hazards','Maintenance completion','Safeguarding referrals made promptly');
    end if;
    insert into public.khpos_ops_roles(
      organisation_id,code,title,category,role_level,reports_to_role_id,
      system_scope,status,created_by
    ) values(p_org,v_code,v_title,'leadership',3,v_guardian,v_scopes,'active',v_actor)
    on conflict(organisation_id,code) do nothing;
    select id into v_role from public.khpos_ops_roles
      where organisation_id=p_org and code=v_code and status='active';
    if v_role is not null and not exists(
      select 1 from public.khpos_ops_role_charters
      where role_id=v_role and status='active'
    ) then
      insert into public.khpos_ops_role_charters(
        role_id,version,mission,owned_outcomes,responsibilities,decision_rights,
        escalation_rules,kpis,required_policy_codes,effective_date,
        approved_by,approved_at,status
      ) values (
        v_role,1,v_mission,
        case when v_code='FINANCE_ADMIN_OFFICER'
          then jsonb_build_array('Reliable financial administration','Documented school expenditure','Timely fees and procurement reports')
          else jsonb_build_array('Safe learning environment','Supported learner welfare','Responsive parent relationships','Maintained facilities') end,
        v_add,v_rights,
        case when v_code='FINANCE_ADMIN_OFFICER'
          then jsonb_build_array('Escalate suspected fraud, critical cash-flow and procurement conflicts to the School Guardian','Escalate decisions beyond delegated financial limits','Route allegations of safeguarding harm through designated safeguarding staff')
          else jsonb_build_array('Immediately protect learners and contact designated safeguarding staff when concerns arise','Escalate critical hazards and unresolved welfare cases to the School Guardian','Refer unresolved parent disputes to the School Guardian','Never independently investigate safeguarding allegations') end,
        v_kpis,v_required,current_date,v_actor,clock_timestamp(),'active'
      );
    end if;
  end loop;

  -- A material charter revision is versioned: staff must accept new duties,
  -- without changing existing assignments, salaries, or privileged controls.
  for v_inspector in
    select r.id,r.code from public.khpos_ops_roles r
    where r.organisation_id=p_org and r.code in ('ACADEMIC_INSPECTOR','SKILL_INSPECTOR')
      and r.status='active'
  loop
    update public.khpos_ops_roles
      set system_scope=array_append(system_scope,'people_staff'),updated_at=clock_timestamp()
    where id=v_inspector.id and not ('people_staff'=any(system_scope));

    select * into v_charter from public.khpos_ops_role_charters
      where role_id=v_inspector.id and status='active' order by version desc limit 1;
    if v_charter.id is null then continue; end if;
    if v_inspector.code='ACADEMIC_INSPECTOR' then
      v_add:=jsonb_build_array('Coordinate teacher readiness, onboarding, attendance exceptions, professional development and coaching with the School Guardian','Guide Sectional Promoters in staff coordination, classroom performance and evidence-led appraisal','Flag staff welfare and unresolved conduct concerns without handling confidential disciplinary investigations');
      v_rights:=jsonb_build_array('Recommend staff support, coaching, timetable coverage and training actions to the School Guardian','Coordinate teaching-staff follow-ups without independently appointing, dismissing or altering payroll');
      v_kpis:=jsonb_build_array('Teacher onboarding and training completion','Instructional staff coverage','Performance coaching follow-through');
    else
      v_add:=jsonb_build_array('Coordinate skills facilitator readiness, onboarding, attendance exceptions, training, wellbeing and performance coaching with the School Guardian','Review skills instructors’ delivery and staffing gaps using practical evidence','Escalate employee welfare, misconduct or people risks to the School Guardian through approved channels');
      v_rights:=jsonb_build_array('Recommend skills facilitator deployment, coaching, training and work-plan adjustments within delegated authority','Coordinate facilitator people follow-up without independently appointing, dismissing or altering payroll');
      v_kpis:=jsonb_build_array('Facilitator onboarding and training completion','Skills staff coverage','Performance coaching follow-through');
    end if;
    if coalesce(v_charter.responsibilities,'[]'::jsonb) @> jsonb_build_array(v_add->>0) then continue; end if;
    update public.khpos_ops_role_charters set status='superseded'
      where role_id=v_inspector.id and status='active';
    insert into public.khpos_ops_role_charters(
      role_id,version,mission,owned_outcomes,responsibilities,decision_rights,
      escalation_rules,kpis,required_policy_codes,effective_date,
      approved_by,approved_at,status
    ) values (
      v_inspector.id,
      (select coalesce(max(version),0)+1 from public.khpos_ops_role_charters where role_id=v_inspector.id),
      v_charter.mission,v_charter.owned_outcomes,
      coalesce(v_charter.responsibilities,'[]'::jsonb)||v_add,
      coalesce(v_charter.decision_rights,'[]'::jsonb)||v_rights,
      v_charter.escalation_rules,
      coalesce(v_charter.kpis,'[]'::jsonb)||v_kpis,
      v_charter.required_policy_codes,current_date,v_actor,clock_timestamp(),'active'
    );
  end loop;
  if not exists (select 1 from public.khpos_ops_audit_events
    where organisation_id=p_org and event_type='support_roles_o76_adopted') then
    insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
    values(p_org,v_actor,'support_roles_o76_adopted','organisation',p_org,
      jsonb_build_object('roles',array['FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER'],'inspectorsPeopleCoordination',true));
  end if;
end;
$$;
revoke all on function khpos_private.ops_ensure_school_support_roles(uuid) from public,anon,authenticated;
grant execute on function khpos_private.ops_ensure_school_support_roles(uuid) to service_role;
