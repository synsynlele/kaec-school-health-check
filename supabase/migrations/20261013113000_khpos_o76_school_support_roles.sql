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

-- Dedicated campus-scoped care permission. This intentionally does not change
-- generic culture permissions, finance approvals or restricted safeguarding case access.
create or replace function khpos_private.ops_school_care_campus(p_actor uuid,p_org uuid,p_campus uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.khpos_ops_role_assignments a
   join public.khpos_ops_roles r on r.id=a.role_id
   join public.organisation_memberships m on m.user_id=a.user_id and m.organisation_id=r.organisation_id and m.status='active'
   join public.organisations o on o.id=r.organisation_id and o.status='active' and o.partner_status='active'
   where a.user_id=p_actor and a.status='active' and r.status='active'
     and r.organisation_id=p_org and r.code='SCHOOL_CARE_OPERATIONS_OFFICER'
     and a.campus_id=p_campus
 );
$$;
revoke all on function khpos_private.ops_school_care_campus(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function khpos_private.ops_school_care_campus(uuid,uuid,uuid) to service_role;

-- Reuse the existing independent-appointment workflow; do not create appointments by migration.

-- O76 adjustment: khpos_ops_role_position_action_server
CREATE OR REPLACE FUNCTION public.khpos_ops_role_position_action_server(p_actor uuid, p_org uuid, p_mode text, p_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare staff public.khpos_ops_staff%rowtype; pos public.khpos_ops_staff_role_positions%rowtype;
 role public.khpos_ops_roles%rowtype; charter public.khpos_ops_role_charters%rowtype;
 staff_id uuid; role_id uuid; campus uuid; unit uuid; assignment uuid;
 note text:=nullif(btrim(p_input->>'note'),''); result uuid;
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_org) then raise exception 'Active school membership and partnership are required.'; end if;
 if p_mode='propose' then
   staff_id:=(p_input->>'staffId')::uuid;
 else
   select * into pos from public.khpos_ops_staff_role_positions where id=(p_input->>'positionId')::uuid and organisation_id=p_org for update;
   if pos.id is null then raise exception 'Position not found in this school.'; end if;
   staff_id:=pos.staff_id;
 end if;
 -- One staff lock serialises overlapping proposals/activation for this person.
 select * into staff from public.khpos_ops_staff where id=staff_id and organisation_id=p_org for update;
 if staff.id is null or staff.user_id is null or (p_mode<>'end' and staff.status<>'active') then raise exception 'Use the existing active, account-linked staff record.'; end if;
 if p_mode<>'end' and not khpos_private.ops_hpd_has_membership(staff.user_id,p_org) then raise exception 'Staff school access must be active.'; end if;
 if p_mode='propose' then
   role_id:=(p_input->>'roleId')::uuid; campus:=(p_input->>'campusId')::uuid; unit:=nullif(p_input->>'unitId','')::uuid;
 else role_id:=pos.role_id; campus:=pos.campus_id; unit:=pos.unit_id;
 end if;
 select * into role from public.khpos_ops_roles where id=role_id and organisation_id=p_org and (p_mode='end' or status='active');
 if role.id is null or role.code not in ('SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR') then
   raise exception 'This position requires a separate governed appointment route.';
 end if;
 if p_mode<>'end' and not exists(select 1 from public.khpos_ops_campuses where id=campus and organisation_id=p_org and status='active') then raise exception 'Choose an active campus in this school.'; end if;
 if p_mode<>'end' and unit is not null and not exists(select 1 from public.khpos_ops_units where id=unit and organisation_id=p_org and status='active' and (campus_id is null or campus_id=campus)) then
   raise exception 'The section or programme does not belong to this campus/school.';
 end if;
 if p_mode='acknowledge' then
   if staff.user_id<>p_actor or pos.status<>'pending' then raise exception 'Only the appointed person acknowledges their pending position.'; end if;
   if length(coalesce(note,''))<20 or length(note)>2000 then raise exception 'Explain the responsibility you accept in 20 to 2000 characters.'; end if;
   select * into charter from public.khpos_ops_role_charters rc where rc.role_id=role.id and rc.status='active';
   if charter.id is null then raise exception 'An active role charter is required.'; end if;
   update public.khpos_ops_staff_role_positions set charter_id=charter.id,acknowledged_at=now(),acknowledgement_note=note,updated_at=now() where id=pos.id;
   result:=pos.id;
 else
   if staff.user_id=p_actor then raise exception 'A different authorised school leader must appoint, activate or end your position.'; end if;
   if not khpos_private.ops_positions_can_manage(p_actor,p_org,campus,role.code) then raise exception 'Your school/campus authority cannot manage this position.'; end if;
   if p_mode in ('propose','activate') then
     if exists(select 1 from public.khpos_ops_role_assignments a where a.user_id=staff.user_id and a.role_id=role.id and a.status='active'
       and (a.campus_id is null or a.campus_id=campus) and (a.unit_id is null or unit is null or a.unit_id=unit)) then
       raise exception 'An existing active assignment already covers this role and scope.';
     end if;
   end if;
   if p_mode='propose' then
     if exists(select 1 from public.khpos_ops_staff_role_positions other where other.staff_id=staff.id and other.role_id=role.id and other.status='pending'
       and other.campus_id=campus and (other.unit_id is null or unit is null or other.unit_id=unit)) then raise exception 'An overlapping position is already awaiting onboarding.'; end if;
     insert into public.khpos_ops_staff_role_positions(organisation_id,staff_id,role_id,campus_id,unit_id,proposed_by)
       values(p_org,staff.id,role.id,campus,unit,p_actor) returning id into result;
   elsif p_mode='activate' then
     if pos.status<>'pending' then raise exception 'Only a pending position can be activated.'; end if;
     if cardinality(khpos_private.ops_position_blockers(pos.id))>0 then raise exception 'Complete role acknowledgement, required policies and guided practice before activation.'; end if;
     if length(coalesce(note,''))<20 or length(note)>2000 then raise exception 'Record an independent readiness review in 20 to 2000 characters.'; end if;
     insert into public.khpos_ops_role_assignments(role_id,user_id,campus_id,unit_id,primary_assignment,status,appointed_by)
       values(role.id,staff.user_id,campus,unit,false,'active',p_actor) returning id into assignment;
     update public.khpos_ops_staff_role_positions set status='active',role_assignment_id=assignment,activated_by=p_actor,activated_at=now(),updated_at=now() where id=pos.id;
     result:=pos.id;
   elsif p_mode='end' then
     if pos.status='ended' then raise exception 'This position has already ended.'; end if;
     if length(coalesce(note,''))<10 or length(note)>2000 then raise exception 'Record the handover or withdrawal reason in 10 to 2000 characters.'; end if;
     if pos.role_assignment_id=staff.role_assignment_id or exists(select 1 from public.khpos_ops_role_assignments where id=pos.role_assignment_id and primary_assignment) then
       raise exception 'Use the primary staff progression/exit route for the main appointment.';
     end if;
     if exists(select 1 from public.khpos_ops_work_items where owner_assignment_id=pos.role_assignment_id and status not in ('completed','cancelled'))
       or exists(select 1 from public.khpos_ops_issues where owner_assignment_id=pos.role_assignment_id and status not in ('closed','cancelled'))
       or exists(select 1 from public.khpos_ops_decisions where (authority_assignment_id=pos.role_assignment_id or implementation_owner_assignment_id=pos.role_assignment_id or requester_assignment_id=pos.role_assignment_id)
         and status not in ('closed','cancelled','declined')) then raise exception 'Complete or hand over open work, issues and decisions before ending this position.'; end if;
     update public.khpos_ops_role_assignments set status='ended',end_date=current_date,updated_at=now() where id=pos.role_assignment_id;
     update public.khpos_ops_staff_role_positions set status='ended',ended_by=p_actor,ended_at=now(),updated_at=now() where id=pos.id;
     result:=pos.id;
   else raise exception 'Unsupported position action.';
   end if;
 end if;
 insert into public.khpos_ops_staff_events(organisation_id,staff_id,actor_user_id,event_type,note,metadata)
   values(p_org,staff.id,p_actor,'position_'||p_mode,note,jsonb_build_object('positionId',result,'roleId',role.id,'campusId',campus,'unitId',unit));
 return result;
end;
$function$;

-- O76 adjustment: khpos_ops_get_parent_cases_server
CREATE OR REPLACE FUNCTION public.khpos_ops_get_parent_cases_server(p_actor uuid, p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org)
    or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SCHOOL_CARE_OPERATIONS_OFFICER']::text[])
  then raise exception 'Active school role and KHP-OS membership required.'; end if;
  return jsonb_build_object(
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active' and (khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,false) or khpos_private.ops_school_care_campus(p_actor,p_org,c.id))),'[]'::jsonb),
    'learners',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.display_name,'classLabel',l.class_label,'campusId',l.campus_id) order by l.display_name) from public.khpos_ops_learner_anchors l where l.organisation_id=p_org and l.status='active' and (khpos_private.ops_culture_campus_access(p_actor,p_org,l.campus_id,false) or khpos_private.ops_school_care_campus(p_actor,p_org,l.campus_id))),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',r.title,'campusId',a.campus_id,'isMine',a.user_id=p_actor)) from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where r.organisation_id=p_org and a.status='active' and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','SCHOOL_CARE_OPERATIONS_OFFICER') and (a.campus_id is null and r.code='SCHOOL_GUARDIAN' or exists(select 1 from public.khpos_ops_campuses c where c.id=a.campus_id and (khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,false) or khpos_private.ops_school_care_campus(p_actor,p_org,c.id))))),'[]'::jsonb),
    'cases',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'campusId',c.campus_id,'learnerId',c.learner_id,'parentReference',c.parent_reference,'category',c.category,'channel',c.channel,'summary',c.summary,'ownerAssignmentId',c.owner_assignment_id,'dueDate',c.due_date,'status',c.status,'responseSummary',c.response_summary,'responseEvidence',c.response_evidence,'responseBy',c.response_by,'escalationReason',c.escalation_reason,'closureNote',c.closure_note,'isOwner',exists(select 1 from public.khpos_ops_role_assignments a where a.id=c.owner_assignment_id and a.user_id=p_actor and a.status='active'),'canManage',(khpos_private.ops_culture_campus_access(p_actor,p_org,c.campus_id,true) or khpos_private.ops_school_care_campus(p_actor,p_org,c.campus_id)),'isGuardian',khpos_private.ops_safeguarding_campus_role(p_actor,p_org,c.campus_id,array['SCHOOL_GUARDIAN']::text[]),'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'channel',e.channel,'note',e.note,'evidenceReference',e.evidence_reference,'createdAt',e.created_at) order by e.created_at) from public.khpos_ops_parent_events e where e.case_id=c.id),'[]'::jsonb)) order by c.created_at desc) from public.khpos_ops_parent_cases c where c.organisation_id=p_org and ((khpos_private.ops_culture_campus_access(p_actor,p_org,c.campus_id,true) or khpos_private.ops_school_care_campus(p_actor,p_org,c.campus_id)) or c.recorded_by=p_actor or exists(select 1 from public.khpos_ops_role_assignments a where a.id=c.owner_assignment_id and a.user_id=p_actor and a.status='active'))),'[]'::jsonb)
  );
end $function$;

-- O76 adjustment: khpos_ops_parent_case_action_server
CREATE OR REPLACE FUNCTION public.khpos_ops_parent_case_action_server(p_actor uuid, p_org uuid, p_mode text, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare v_case public.khpos_ops_parent_cases%rowtype; v_campus uuid; v_learner uuid; v_owner uuid; v_note text; v_event text; v_channel text; v_evidence text;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SCHOOL_CARE_OPERATIONS_OFFICER']::text[]) then raise exception 'Active school role and KHP-OS membership required.'; end if;
  if p_mode='record' then
    v_campus:=(p_input->>'campusId')::uuid; v_learner:=nullif(p_input->>'learnerId','')::uuid; v_owner:=(p_input->>'ownerAssignmentId')::uuid;
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_org and status='active') or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,false) or khpos_private.ops_school_care_campus(p_actor,p_org,v_campus)) then raise exception 'Reporter must serve this active campus.'; end if;
    if v_learner is not null and not exists(select 1 from public.khpos_ops_learner_anchors where id=v_learner and organisation_id=p_org and campus_id=v_campus and status='active') then raise exception 'Learner does not belong to this campus.'; end if;
    if not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.id=v_owner and a.status='active' and r.organisation_id=p_org and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','SCHOOL_CARE_OPERATIONS_OFFICER') and (a.campus_id=v_campus or a.campus_id is null and r.code='SCHOOL_GUARDIAN')) then raise exception 'A campus leader must own the case.'; end if;
    if p_input->>'category' not in ('academic','culture','fees','admission','general') or p_input->>'channel' not in ('in_person','phone','whatsapp','email','other') or nullif(btrim(p_input->>'parentReference'),'') is null or nullif(btrim(p_input->>'summary'),'') is null or (p_input->>'dueDate')::date<current_date then raise exception 'Parent reference, category, channel, summary and due date are required.'; end if;
    insert into public.khpos_ops_parent_cases(organisation_id,campus_id,learner_id,parent_reference,category,channel,summary,owner_assignment_id,due_date,recorded_by) values(p_org,v_campus,v_learner,btrim(p_input->>'parentReference'),p_input->>'category',p_input->>'channel',btrim(p_input->>'summary'),v_owner,(p_input->>'dueDate')::date,p_actor) returning * into v_case;
    v_event:='recorded'; v_note:=v_case.summary; v_channel:=v_case.channel;
  else
    select * into v_case from public.khpos_ops_parent_cases where id=(p_input->>'caseId')::uuid and organisation_id=p_org for update;
    if v_case.id is null or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_case.campus_id,false) or khpos_private.ops_school_care_campus(p_actor,p_org,v_case.campus_id)) then raise exception 'Parent case unavailable.'; end if;
    v_campus:=v_case.campus_id;
    v_note:=nullif(btrim(p_input->>'note'),''); v_channel:=nullif(p_input->>'channel',''); v_evidence:=nullif(btrim(p_input->>'evidenceReference'),'');
    if v_note is null then raise exception 'A meaningful note is required.'; end if;
    if p_mode='acknowledge' then
      if v_case.status<>'new' or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_campus)) or v_channel not in ('in_person','phone','whatsapp','email','other') or v_evidence is null then raise exception 'Campus leader must record how the parent received the acknowledgement.'; end if;
      update public.khpos_ops_parent_cases set status='acknowledged',updated_at=now() where id=v_case.id; v_event:='acknowledged';
    elsif p_mode='action' then
      if v_case.status not in ('acknowledged','in_action','escalated') or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_campus)) then raise exception 'Campus leader must own the action.'; end if;
      update public.khpos_ops_parent_cases set status=case when status='escalated' then status else 'in_action' end,updated_at=now() where id=v_case.id; v_event:='action';
    elsif p_mode='communication' then
      if v_case.status in ('closed','new') or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_campus)) or v_channel not in ('in_person','phone','whatsapp','email','other') or v_evidence is null then raise exception 'Campus leader must record communication channel and evidence.'; end if;
      v_event:='communication';
    elsif p_mode='escalate' then
      if v_case.status in ('closed','responded') or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_campus)) then raise exception 'Only open cases can be escalated by campus leadership.'; end if;
      if not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.status='active' and r.organisation_id=p_org and r.code='SCHOOL_GUARDIAN' and (a.campus_id=v_campus or a.campus_id is null)) then raise exception 'An active School Guardian must be assigned before escalation.'; end if;
      update public.khpos_ops_parent_cases set status='escalated',escalation_reason=v_note,escalated_at=now(),updated_at=now() where id=v_case.id; v_event:='escalated';
    elsif p_mode='respond' then
      if v_case.status not in ('acknowledged','in_action','escalated') or not exists(select 1 from public.khpos_ops_role_assignments where id=v_case.owner_assignment_id and user_id=p_actor and status='active') or v_channel not in ('in_person','phone','whatsapp','email','other') or v_evidence is null then raise exception 'Case owner must document the response channel and delivery evidence.'; end if;
      update public.khpos_ops_parent_cases set status='responded',response_summary=v_note,response_evidence=v_evidence,response_by=p_actor,response_at=now(),updated_at=now() where id=v_case.id; v_event:='responded';
    elsif p_mode='return' then
      if v_case.status<>'responded' or p_actor=v_case.response_by or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_campus)) then raise exception 'An independent campus leader must review the response.'; end if;
      update public.khpos_ops_parent_cases set status='in_action',updated_at=now() where id=v_case.id; v_event:='returned';
    elsif p_mode='close' then
      if v_case.status<>'responded' or p_actor=v_case.response_by or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_campus)) or (v_case.escalated_at is not null and not khpos_private.ops_safeguarding_campus_role(p_actor,p_org,v_campus,array['SCHOOL_GUARDIAN']::text[])) then raise exception 'A different campus leader must verify closure; escalated cases require School Guardian review.'; end if;
      update public.khpos_ops_parent_cases set status='closed',closure_note=v_note,closed_by=p_actor,closed_at=now(),updated_at=now() where id=v_case.id; v_event:='closed';
    else raise exception 'Unsupported parent case action.';
    end if;
  end if;
  insert into public.khpos_ops_parent_events(organisation_id,case_id,event_type,channel,note,evidence_reference,actor_id) values(p_org,v_case.id,v_event,v_channel,v_note,v_evidence,p_actor);
  return public.khpos_ops_get_parent_cases_server(p_actor,p_org);
end $function$;

-- O76 adjustment: khpos_ops_get_assets_server
CREATE OR REPLACE FUNCTION public.khpos_ops_get_assets_server(p_actor uuid, p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR','SCHOOL_CARE_OPERATIONS_OFFICER']::text[]) then raise exception 'Active campus role and membership required.'; end if;
  return jsonb_build_object(
    'today',(now() at time zone 'Africa/Lagos')::date,
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'canManage',(khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,true) or khpos_private.ops_school_care_campus(p_actor,p_org,c.id))) order by c.name) from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active' and (khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,false) or khpos_private.ops_school_care_campus(p_actor,p_org,c.id))),'[]'::jsonb),
    'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'campusId',a.campus_id,'code',a.asset_code,'label',a.label,'category',a.category,'location',a.location,'ownerRoleTitle',(select r.title from public.khpos_ops_roles r where r.id=a.owner_role_id),'intervalDays',a.service_interval_days,'nextServiceDate',a.next_service_date,'status',a.status,'retirementNote',a.retirement_note,
      'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'note',s.service_note,'evidenceReference',s.evidence_reference,'submittedBy',s.submitted_by,'submittedAt',s.submitted_at,'reviewNote',s.review_note,'nextDueDate',s.next_due_date,'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'note',e.note,'evidenceReference',e.evidence_reference,'createdAt',e.created_at) order by e.created_at) from public.khpos_ops_asset_service_events e where e.service_id=s.id),'[]'::jsonb)) order by s.created_at desc) from public.khpos_ops_asset_services s where s.asset_id=a.id),'[]'::jsonb),
      'issues',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'status',i.status,'severity',i.severity,'title',i.title,'dueAt',i.due_at,'createdAt',i.created_at) order by i.created_at desc) from public.khpos_ops_asset_issues x join public.khpos_ops_issues i on i.id=x.issue_id where x.asset_id=a.id),'[]'::jsonb)) order by a.status,a.next_service_date,a.label) from public.khpos_ops_assets a where a.organisation_id=p_org and (khpos_private.ops_culture_campus_access(p_actor,p_org,a.campus_id,false) or khpos_private.ops_school_care_campus(p_actor,p_org,a.campus_id))),'[]'::jsonb)
  );
end $function$;

-- O76 adjustment: khpos_ops_asset_action_server
CREATE OR REPLACE FUNCTION public.khpos_ops_asset_action_server(p_actor uuid, p_org uuid, p_mode text, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare v_asset public.khpos_ops_assets%rowtype; v_service public.khpos_ops_asset_services%rowtype; v_campus uuid; v_code text; v_note text; v_evidence text; v_owner uuid; v_owner_role uuid; v_issue uuid; v_due date; v_interval integer; v_event text; v_service_id uuid; v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR','SCHOOL_CARE_OPERATIONS_OFFICER']::text[]) then raise exception 'Active campus role and membership required.'; end if;
  v_note:=nullif(btrim(p_input->>'note'),''); v_evidence:=nullif(btrim(p_input->>'evidenceReference'),'');
  if p_mode='create' then
    v_campus:=(p_input->>'campusId')::uuid; v_code:=upper(nullif(btrim(p_input->>'code'),''));
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_org and status='active') or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_campus)) then raise exception 'Campus leader must register assets for an active campus.'; end if;
    v_interval:=(p_input->>'intervalDays')::integer; v_due:=(p_input->>'nextServiceDate')::date;
    if v_code is null or length(v_code)>40 or nullif(btrim(p_input->>'label'),'') is null or nullif(btrim(p_input->>'location'),'') is null or p_input->>'category' not in ('facility','equipment','technology','transport','safety','other') or v_interval not between 1 and 730 or v_due not between v_today and v_today+v_interval then raise exception 'Asset code, label, location, category, interval and future service date are required.'; end if;
    select r.id into v_owner_role from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.campus_id=v_campus and a.status='active' and r.organisation_id=p_org and r.status='active' and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','SCHOOL_CARE_OPERATIONS_OFFICER') order by case when r.code='SCHOOL_GUARDIAN' then 0 else 1 end,a.created_at limit 1;
    if v_owner_role is null then raise exception 'Assign a campus Guardian or Sectional Promoter to own assets.'; end if;
    insert into public.khpos_ops_assets(organisation_id,campus_id,asset_code,label,category,location,owner_role_id,service_interval_days,next_service_date,created_by) values(p_org,v_campus,v_code,left(btrim(p_input->>'label'),180),p_input->>'category',left(btrim(p_input->>'location'),180),v_owner_role,v_interval,v_due,p_actor) returning * into v_asset;
    insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata) values(p_org,p_actor,'ops_asset_registered','asset',v_asset.id,jsonb_build_object('campusId',v_campus,'code',v_code));
  else
    select * into v_asset from public.khpos_ops_assets where id=(p_input->>'assetId')::uuid and organisation_id=p_org for update;
    if v_asset.id is null or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_asset.campus_id,false) or khpos_private.ops_school_care_campus(p_actor,p_org,v_asset.campus_id)) then raise exception 'Asset unavailable on your campus.'; end if;
    if v_asset.status<>'active' then raise exception 'Retired assets cannot receive new work.'; end if;
    if p_mode='report_fault' then
      if v_note is null or p_input->>'severity' not in ('P2','P3','P4') or nullif(btrim(p_input->>'immediateAction'),'') is null then raise exception 'Describe the fault, severity and immediate action. Use the protected pathway for safety disclosures.'; end if;
      v_due:=(p_input->>'dueDate')::date;
      if v_due<v_today or v_due>v_today+(case p_input->>'severity' when 'P2' then 7 when 'P3' then 14 else 30 end) then raise exception 'Set a resolution date within 7 days for P2, 14 for P3 or 30 for P4.'; end if;
      if exists(select 1 from public.khpos_ops_asset_issues x join public.khpos_ops_issues i on i.id=x.issue_id where x.asset_id=v_asset.id and i.status<>'closed') then raise exception 'An unresolved issue already tracks this asset. Continue in Issues.'; end if;
      select a.id into v_owner from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where r.organisation_id=p_org and a.status='active' and r.status='active' and a.campus_id=v_asset.campus_id and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','SCHOOL_CARE_OPERATIONS_OFFICER') order by case when r.id=v_asset.owner_role_id then 0 when r.code='SCHOOL_GUARDIAN' then 1 else 2 end,a.created_at limit 1;
      if v_owner is null then raise exception 'Assign a campus Guardian or Sectional Promoter before reporting asset faults.'; end if;
      insert into public.khpos_ops_issues(organisation_id,campus_id,issue_type,category,severity,sensitivity,title,description,status,owner_assignment_id,reported_by,due_at,immediate_action) values(p_org,v_asset.campus_id,'system_exception','campus_asset',p_input->>'severity','standard',left(v_asset.asset_code||' · '||v_asset.label||' fault',180),left(v_note,4000),'assigned',v_owner,p_actor,(v_due+interval '1 day') at time zone 'Africa/Lagos',left(btrim(p_input->>'immediateAction'),4000)) returning id into v_issue;
      insert into public.khpos_ops_asset_issues(organisation_id,asset_id,issue_id) values(p_org,v_asset.id,v_issue);
      insert into public.khpos_ops_issue_events(organisation_id,issue_id,actor_user_id,event_type,to_status,note,metadata) values(p_org,v_issue,p_actor,'auto_reported','assigned',left(v_note,4000),jsonb_build_object('assetId',v_asset.id,'assetCode',v_asset.asset_code));
    elsif p_mode='submit_service' then
      if v_note is null or v_evidence is null then raise exception 'Service note and evidence reference are required.'; end if;
      if exists(select 1 from public.khpos_ops_asset_services where asset_id=v_asset.id and status in ('submitted','returned')) then raise exception 'An existing service awaits review or correction.'; end if;
      insert into public.khpos_ops_asset_services(organisation_id,asset_id,service_note,evidence_reference,submitted_by) values(p_org,v_asset.id,left(v_note,4000),left(v_evidence,400),p_actor) returning id into v_service_id;
      insert into public.khpos_ops_asset_service_events(organisation_id,service_id,event_type,note,evidence_reference,actor_id) values(p_org,v_service_id,'submitted',left(v_note,4000),left(v_evidence,400),p_actor);
    elsif p_mode in ('resubmit_service','return_service','verify_service') then
      select * into v_service from public.khpos_ops_asset_services where id=(p_input->>'serviceId')::uuid and asset_id=v_asset.id and organisation_id=p_org for update;
      if v_service.id is null then raise exception 'Service record unavailable.'; end if;
      if p_mode='resubmit_service' then
        if v_service.status<>'returned' or v_service.submitted_by<>p_actor or v_note is null or v_evidence is null then raise exception 'Original reporter must correct the returned service with evidence.'; end if;
        update public.khpos_ops_asset_services set status='submitted',service_note=left(v_note,4000),evidence_reference=left(v_evidence,400),submitted_at=now(),review_note=null,reviewed_by=null,reviewed_at=null where id=v_service.id;
        v_event:='resubmitted';
      elsif p_mode='return_service' then
        if v_service.status<>'submitted' or v_service.submitted_by=p_actor or v_note is null or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_asset.campus_id,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_asset.campus_id)) then raise exception 'Another campus leader must review and explain the return.'; end if;
        update public.khpos_ops_asset_services set status='returned',review_note=left(v_note,4000),reviewed_by=p_actor,reviewed_at=now() where id=v_service.id;
        v_event:='returned';
      else
        if v_service.status<>'submitted' or v_service.submitted_by=p_actor or v_note is null or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_asset.campus_id,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_asset.campus_id)) then raise exception 'A different campus leader must verify the service.'; end if;
        v_due:=v_today+v_asset.service_interval_days;
        update public.khpos_ops_asset_services set status='verified',review_note=left(v_note,4000),reviewed_by=p_actor,reviewed_at=now(),next_due_date=v_due where id=v_service.id;
        update public.khpos_ops_assets set next_service_date=v_due,updated_at=now() where id=v_asset.id;
        v_event:='verified';
      end if;
      insert into public.khpos_ops_asset_service_events(organisation_id,service_id,event_type,note,evidence_reference,actor_id) values(p_org,v_service.id,v_event,left(v_note,4000),case when p_mode='resubmit_service' then left(v_evidence,400) else null end,p_actor);
    elsif p_mode='retire' then
      if v_note is null or not (khpos_private.ops_culture_campus_access(p_actor,p_org,v_asset.campus_id,true) or khpos_private.ops_school_care_campus(p_actor,p_org,v_asset.campus_id)) then raise exception 'Campus leader must explain asset retirement.'; end if;
      if exists(select 1 from public.khpos_ops_asset_services where asset_id=v_asset.id and status in ('submitted','returned')) or exists(select 1 from public.khpos_ops_asset_issues x join public.khpos_ops_issues i on i.id=x.issue_id where x.asset_id=v_asset.id and i.status<>'closed') then raise exception 'Complete open service and issues before retirement.'; end if;
      update public.khpos_ops_assets set status='retired',retirement_note=left(v_note,4000),retired_by=p_actor,retired_at=now(),updated_at=now() where id=v_asset.id;
      insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata) values(p_org,p_actor,'ops_asset_retired','asset',v_asset.id,jsonb_build_object('reason',v_note));
    else raise exception 'Unsupported asset action.';
    end if;
  end if;
  return public.khpos_ops_get_assets_server(p_actor,p_org);
end $function$;

-- O76 adjustment: khpos_ops_get_safeguarding_server
CREATE OR REPLACE FUNCTION public.khpos_ops_get_safeguarding_server(p_actor_user_id uuid, p_organisation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare v_result jsonb;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor_user_id,p_organisation_id)
    or not khpos_private.ops_hpd_actor_has_role(p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR','SCHOOL_CARE_OPERATIONS_OFFICER']::text[])
  then raise exception 'Active school role and KHP-OS membership required.'; end if;
  select jsonb_build_object(
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'canConfigure',khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,c.id,array['SCHOOL_GUARDIAN']::text[]),'isDesignated',khpos_private.ops_safeguarding_designated(p_actor_user_id,p_organisation_id,c.id),'configured',exists(select 1 from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id where d.campus_id=c.id and d.status='active' and lead.status='active' and deputy.status='active'))) from public.khpos_ops_campuses c where c.organisation_id=p_organisation_id and c.status='active' and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,c.id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR','SCHOOL_CARE_OPERATIONS_OFFICER']::text[])),'[]'::jsonb),
    'learners',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.display_name,'campusId',l.campus_id) order by l.display_name) from public.khpos_ops_learner_anchors l where l.organisation_id=p_organisation_id and l.status='active' and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,l.campus_id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR','SCHOOL_CARE_OPERATIONS_OFFICER']::text[])),'[]'::jsonb),
    'eligibleAssignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'role',r.title,'campusId',a.campus_id,'userId',a.user_id,'name',s.display_name)) from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id join public.khpos_ops_staff s on s.user_id=a.user_id and s.organisation_id=p_organisation_id and s.status in ('ready','active') where r.organisation_id=p_organisation_id and a.status='active' and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SCHOOL_CARE_OPERATIONS_OFFICER') and exists(select 1 from public.khpos_ops_campuses c where c.organisation_id=p_organisation_id and (c.id=a.campus_id or a.campus_id is null and r.code='SCHOOL_GUARDIAN') and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,c.id,array['SCHOOL_GUARDIAN']::text[]))),'[]'::jsonb),
    'contacts',coalesce((select jsonb_agg(jsonb_build_object('campusId',d.campus_id,'leadName',lead_staff.display_name,'leadEmail',lead_staff.account_email,'deputyName',deputy_staff.display_name,'deputyEmail',deputy_staff.account_email)) from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id and lead.status='active' join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id and deputy.status='active' join public.khpos_ops_staff lead_staff on lead_staff.user_id=lead.user_id and lead_staff.organisation_id=p_organisation_id and lead_staff.status in ('ready','active') join public.khpos_ops_staff deputy_staff on deputy_staff.user_id=deputy.user_id and deputy_staff.organisation_id=p_organisation_id and deputy_staff.status in ('ready','active') where d.organisation_id=p_organisation_id and d.status='active' and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,d.campus_id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR','SCHOOL_CARE_OPERATIONS_OFFICER']::text[])),'[]'::jsonb),
    'designations',coalesce((select jsonb_agg(jsonb_build_object('campusId',d.campus_id,'leadAssignmentId',d.lead_assignment_id,'deputyAssignmentId',d.deputy_assignment_id)) from public.khpos_ops_safeguarding_designations d where d.organisation_id=p_organisation_id and d.status='active' and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,d.campus_id,array['SCHOOL_GUARDIAN']::text[])),'[]'::jsonb),
    'cases',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'campusId',c.campus_id,'learnerId',c.learner_id,'category',c.category,'urgency',c.urgency,'reportedFacts',c.reported_facts,'immediateProtection',c.immediate_protection,'status',c.status,'reportedAt',c.reported_at,'triageProtection',c.triage_protection,'referralDecision',c.referral_decision,'reviewDueAt',c.review_due_at,'closureNote',c.closure_note,'steps',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'type',s.step_type,'actionTaken',s.action_taken,'evidenceReference',s.evidence_reference,'occurredAt',s.occurred_at) order by s.occurred_at) from public.khpos_ops_safeguarding_steps s where s.case_id=c.id),'[]'::jsonb)) order by c.reported_at desc) from public.khpos_ops_safeguarding_cases c where c.organisation_id=p_organisation_id and khpos_private.ops_safeguarding_case_access(p_actor_user_id,p_organisation_id,c.id)),'[]'::jsonb)
  ) into v_result;
  insert into public.khpos_ops_safeguarding_audit(organisation_id,campus_id,actor_id,event_type)
  select p_organisation_id,c.id,p_actor_user_id,'workspace_read' from public.khpos_ops_campuses c
  where c.organisation_id=p_organisation_id and khpos_private.ops_safeguarding_designated(p_actor_user_id,p_organisation_id,c.id);
  return v_result;
end $function$;

-- O76 adjustment: khpos_ops_safeguarding_action_server
CREATE OR REPLACE FUNCTION public.khpos_ops_safeguarding_action_server(p_actor_user_id uuid, p_organisation_id uuid, p_mode text, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare v_campus uuid; v_case public.khpos_ops_safeguarding_cases%rowtype; v_lead public.khpos_ops_role_assignments%rowtype; v_deputy public.khpos_ops_role_assignments%rowtype; v_id uuid; v_learner uuid; v_implicated uuid;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor_user_id,p_organisation_id) then raise exception 'Active KHP-OS membership required.'; end if;
  if p_mode='designate' then
    v_campus:=(p_input->>'campusId')::uuid;
    if not khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,v_campus,array['SCHOOL_GUARDIAN']::text[]) then raise exception 'School Guardian must appoint the safeguarding lead and deputy.'; end if;
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_organisation_id and status='active') then raise exception 'Active campus required.'; end if;
    select a.* into v_lead from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.id=(p_input->>'leadAssignmentId')::uuid and a.status='active' and r.organisation_id=p_organisation_id and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SCHOOL_CARE_OPERATIONS_OFFICER') and (a.campus_id=v_campus or a.campus_id is null and r.code='SCHOOL_GUARDIAN');
    select a.* into v_deputy from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.id=(p_input->>'deputyAssignmentId')::uuid and a.status='active' and r.organisation_id=p_organisation_id and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SCHOOL_CARE_OPERATIONS_OFFICER') and (a.campus_id=v_campus or a.campus_id is null and r.code='SCHOOL_GUARDIAN');
    if v_lead.id is null or v_deputy.id is null or v_lead.user_id=v_deputy.user_id then raise exception 'Lead and deputy must be two different active people assigned to the campus.'; end if;
    if not exists(select 1 from public.khpos_ops_staff where user_id=v_lead.user_id and organisation_id=p_organisation_id and status in ('ready','active')) or not exists(select 1 from public.khpos_ops_staff where user_id=v_deputy.user_id and organisation_id=p_organisation_id and status in ('ready','active')) then raise exception 'Lead and deputy must have ready or active staff records.'; end if;
    update public.khpos_ops_safeguarding_designations set status='superseded',superseded_at=now() where campus_id=v_campus and status='active';
    insert into public.khpos_ops_safeguarding_designations(organisation_id,campus_id,lead_assignment_id,deputy_assignment_id,appointed_by) values(p_organisation_id,v_campus,v_lead.id,v_deputy.id,p_actor_user_id);
    insert into public.khpos_ops_safeguarding_audit(organisation_id,campus_id,actor_id,event_type) values(p_organisation_id,v_campus,p_actor_user_id,'designation_changed');
    return jsonb_build_object('ok',true);
  elsif p_mode='report' then
    v_campus:=(p_input->>'campusId')::uuid; v_learner:=nullif(p_input->>'learnerId','')::uuid;
    if not khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,v_campus,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR','SCHOOL_CARE_OPERATIONS_OFFICER']::text[]) then raise exception 'Only assigned school staff may report on this campus.'; end if;
    if not exists(select 1 from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id where d.organisation_id=p_organisation_id and d.campus_id=v_campus and d.status='active' and lead.status='active' and deputy.status='active' and exists(select 1 from public.khpos_ops_staff where user_id=lead.user_id and organisation_id=p_organisation_id and status in ('ready','active')) and exists(select 1 from public.khpos_ops_staff where user_id=deputy.user_id and organisation_id=p_organisation_id and status in ('ready','active'))) then raise exception 'Safeguarding lead and deputy must be active before digital intake. Contact the School Guardian directly.'; end if;
    if v_learner is not null and not exists(select 1 from public.khpos_ops_learner_anchors where id=v_learner and organisation_id=p_organisation_id and campus_id=v_campus and status='active') then raise exception 'Learner does not belong to the campus.'; end if;
    if p_input->>'category' not in ('disclosure','suspected_harm','peer_harm','staff_allegation','injury','missing_learner','other') or p_input->>'urgency' not in ('urgent','standard') or nullif(btrim(p_input->>'reportedFacts'),'') is null or nullif(btrim(p_input->>'immediateProtection'),'') is null then raise exception 'Category, urgency, factual account and immediate protection are required.'; end if;
    if p_input->>'contactedPerson' not in ('lead','deputy') or p_input->>'directContactConfirmed'<>'true' then raise exception 'Direct contact with the designated lead or deputy must be confirmed before digital intake.'; end if;
    if p_input->>'implicatedRole' not in ('none','lead','deputy','other') then raise exception 'Select whether a designated person is implicated.'; end if;
    if p_input->>'implicatedRole'=p_input->>'contactedPerson' then raise exception 'Contact the other designated person when the first is implicated.'; end if;
    select case p_input->>'implicatedRole' when 'lead' then lead.user_id when 'deputy' then deputy.user_id else null end into v_implicated
      from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id
      where d.campus_id=v_campus and d.status='active';
    insert into public.khpos_ops_safeguarding_cases(organisation_id,campus_id,learner_id,category,urgency,reported_facts,immediate_protection,implicated_user_id,contacted_person,direct_contact_at,reporter_id)
      values(p_organisation_id,v_campus,v_learner,p_input->>'category',p_input->>'urgency',btrim(p_input->>'reportedFacts'),btrim(p_input->>'immediateProtection'),v_implicated,p_input->>'contactedPerson',now(),p_actor_user_id) returning id into v_id;
    insert into public.khpos_ops_safeguarding_audit(organisation_id,campus_id,case_id,actor_id,event_type) values(p_organisation_id,v_campus,v_id,p_actor_user_id,'report_submitted');
    return jsonb_build_object('receiptId',v_id,'accepted',true);
  end if;
  select * into v_case from public.khpos_ops_safeguarding_cases where id=(p_input->>'caseId')::uuid and organisation_id=p_organisation_id for update;
  if v_case.id is null or not khpos_private.ops_safeguarding_case_access(p_actor_user_id,p_organisation_id,v_case.id) then raise exception 'Restricted safeguarding case unavailable.'; end if;
  v_campus:=v_case.campus_id;
  if p_mode='triage' then
    if v_case.status<>'submitted' or nullif(btrim(p_input->>'protection'),'') is null or nullif(btrim(p_input->>'referralDecision'),'') is null or (p_input->>'reviewDueAt')::timestamptz<=now() then raise exception 'Protection, referral decision and next review are required.'; end if;
    update public.khpos_ops_safeguarding_cases set status='triaged',triage_protection=btrim(p_input->>'protection'),referral_decision=btrim(p_input->>'referralDecision'),review_due_at=(p_input->>'reviewDueAt')::timestamptz,triaged_by=p_actor_user_id,triaged_at=now(),updated_at=now() where id=v_case.id;
  elsif p_mode='record_step' then
    if v_case.status not in ('triaged','monitoring') or p_input->>'stepType' not in ('protection','referral','family_contact','follow_up','support','other') or nullif(btrim(p_input->>'actionTaken'),'') is null then raise exception 'Triage first, then record a valid safeguarding step.'; end if;
    insert into public.khpos_ops_safeguarding_steps(organisation_id,case_id,step_type,action_taken,evidence_reference,actor_id) values(p_organisation_id,v_case.id,p_input->>'stepType',btrim(p_input->>'actionTaken'),nullif(btrim(p_input->>'evidenceReference'),''),p_actor_user_id);
    update public.khpos_ops_safeguarding_cases set status='monitoring',updated_at=now() where id=v_case.id;
  elsif p_mode='close' then
    if v_case.status<>'monitoring' or nullif(btrim(p_input->>'note'),'') is null or not exists(select 1 from public.khpos_ops_safeguarding_steps where case_id=v_case.id and step_type='follow_up') then raise exception 'Follow-up and a documented closure review are required.'; end if;
    if p_actor_user_id=v_case.triaged_by and (
      v_case.implicated_user_id is null
      or not exists(select 1 from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id where d.campus_id=v_case.campus_id and d.status='active' and ((lead.user_id=p_actor_user_id and deputy.user_id=v_case.implicated_user_id) or (deputy.user_id=p_actor_user_id and lead.user_id=v_case.implicated_user_id)))
      or nullif(btrim(p_input->>'externalReviewReference'),'') is null
      or not exists(select 1 from public.khpos_ops_safeguarding_steps where case_id=v_case.id and step_type='referral')
    ) then raise exception 'Independent designated closure is required; when the other designated person is implicated, record external referral and review evidence.'; end if;
    update public.khpos_ops_safeguarding_cases set status='closed',closure_note=btrim(p_input->>'note'),external_closure_review_reference=nullif(btrim(p_input->>'externalReviewReference'),''),closed_by=p_actor_user_id,closed_at=now(),updated_at=now() where id=v_case.id;
  else raise exception 'Unsupported safeguarding action.';
  end if;
  insert into public.khpos_ops_safeguarding_audit(organisation_id,campus_id,case_id,actor_id,event_type) values(p_organisation_id,v_campus,v_case.id,p_actor_user_id,p_mode);
  return jsonb_build_object('ok',true);
end $function$;

-- O76 adjustment: khpos_ops_bootstrap_partner_server
CREATE OR REPLACE FUNCTION public.khpos_ops_bootstrap_partner_server(p_organisation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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
  if exists(select 1 from public.khpos_ops_roles where organisation_id=v_org and code in ('SCHOOL_CUSTODIAN')) then return; end if;
  perform set_config('khpos.bootstrap_partner',v_org::text,true);
  insert into public.khpos_ops_campuses(
    organisation_id,code,name,status,created_by
  ) values (
    v_org,'MAIN',(select name from public.organisations where id=v_org),'active',v_actor
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
    v_org,'SCHOOL_CUSTODIAN','School Custodian','leadership',1,null,
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
    'Protect the school purpose, philosophy and long-term direction while keeping routine school execution out of the School Custodian seat.',
    '["Institutional purpose remains clear","Strategic direction is coherent","Major institutional risks receive appropriate authority","the school can scale without owner-dependent daily operations"]'::jsonb,
    '["Set and guard institutional vision and philosophy","Approve foundational strategic policies and major structural changes","Review strategic risks and campus/network health","Build external relationships and expansion direction"]'::jsonb,
    '["Decide institutional strategy and philosophy","Approve major capital or structural commitments","Approve matters explicitly reserved for School Custodian authority","Delegate routine operational authority to the School Guardian"]'::jsonb,
    '["Receive only strategic, institutional, critical or repeatedly unresolved exceptions","Return routine matters to the delegated operating authority","Require system correction where the same dependency repeatedly reaches this seat"]'::jsonb,
    '["Strategic milestones on track","Critical institutional risks unresolved","Decisions unnecessarily waiting for School Custodian","Owner-dependency defects identified and removed"]'::jsonb,
    array['GOV-P01','GOV-P02','IPA-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_sg,1,
    'Own whole-school execution so the campus consistently delivers the school standards without requiring routine School Custodian intervention.',
    '["School operates safely and predictably","Operating systems execute at required standard","Leaders and staff own their responsibilities","Exceptions are resolved at the lowest appropriate level"]'::jsonb,
    '["Coordinate whole-school execution","Lead operating and performance rhythms","Ensure cross-functional problems receive owners and deadlines","Hold Inspectors and designated operational owners accountable","Escalate only matters beyond delegated authority"]'::jsonb,
    '["Make whole-school operational decisions within delegated authority","Approve routine campus actions and designated requests","Assign owners and require recovery actions","Escalate strategic or reserved decisions"]'::jsonb,
    '["Escalate critical safeguarding/security/financial or institutional risks immediately through the appropriate route","Escalate persistent cross-system failure when delegated authority cannot resolve it","Do not escalate routine work simply because it is difficult"]'::jsonb,
    '["Campus readiness","Critical exceptions unresolved","Overdue leadership actions","Operating-system health","Strategic escalations requiring School Custodian"]'::jsonb,
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
        'architectureVersion','O1-school-custodian-v1.1'
      )
    );
  end if;
  -- O76 extensions execute after the core school roles and charters exist.
  perform khpos_private.ops_ensure_school_support_roles(v_org);
end;
$function$;

-- Existing approved schools receive the roles immediately; staff appointment
-- and formal safeguarding designation remain opt-in leadership decisions.
do $$
declare v_school record;
begin
  for v_school in
    select o.id from public.organisations o
    where o.status='active' and o.partner_status='active'
  loop
    perform khpos_private.ops_ensure_school_support_roles(v_school.id);
  end loop;
end;
$$;
