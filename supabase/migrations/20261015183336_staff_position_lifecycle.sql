-- Position-level lifecycle never deletes the staff identity or changes school membership.
create table public.khpos_ops_assignment_controls (
 assignment_id uuid primary key references public.khpos_ops_role_assignments(id),
 organisation_id uuid not null references public.organisations(id),
 staff_id uuid not null references public.khpos_ops_staff(id),
 last_action text not null check(last_action in ('disable','restore','end','make_primary')),
 reason text not null,
 handover text,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
create index on public.khpos_ops_assignment_controls(organisation_id,staff_id);
create index on public.khpos_ops_assignment_controls(staff_id);
create index on public.khpos_ops_assignment_controls(updated_by);
alter table public.khpos_ops_assignment_controls enable row level security;
revoke all on public.khpos_ops_assignment_controls from public,anon,authenticated;
grant select,insert,update on public.khpos_ops_assignment_controls to service_role;

create function khpos_private.ops_assignment_handover_blockers(p_org uuid,p_assignment uuid)
returns text[] language plpgsql stable security definer set search_path='' as $$
declare spec record; found_open boolean; result text[]:='{}';
begin
 for spec in select * from (values
 ('khpos_ops_staff_coverage_assignments','cover_assignment_id',array['declined','completed','cancelled'],'Staff coverage'),
 ('khpos_ops_academic_delivery_streams','teacher_assignment_id',array['closed','cancelled'],'Academic delivery'),
 ('khpos_ops_academic_debt','recovery_owner_assignment_id',array['closed'],'Learning recovery'),
 ('khpos_ops_learner_support_cases','case_owner_assignment_id',array['recovered','redirected','closed'],'Learner support'),
 ('khpos_ops_learner_interventions','owner_assignment_id',array['completed','changed','cancelled'],'Learner interventions'),
 ('khpos_ops_exam_readiness_items','owner_assignment_id',array['verified','exception_accepted'],'Exam readiness'),
 ('khpos_ops_potential_explorations','owner_assignment_id',array['completed','cancelled'],'Potential development'),
 ('khpos_ops_skill_offerings','facilitator_assignment_id',array['closed','cancelled'],'Skills offerings'),
 ('khpos_ops_leadership_opportunities','owner_assignment_id',array['completed','cancelled'],'Leadership opportunities'),
 ('khpos_ops_financial_capability_activities','owner_assignment_id',array['delivered','missed','cancelled'],'Financial learning'),
 ('khpos_ops_young_ceo_cycles','owner_assignment_id',array['completed','cancelled'],'Young CEO cycles'),
 ('khpos_ops_young_ceo_sessions','owner_assignment_id',array['delivered','missed','cancelled'],'Young CEO sessions'),
 ('khpos_ops_project_cycles','owner_assignment_id',array['completed','cancelled'],'Project cycles'),
 ('khpos_ops_projects','mentor_assignment_id',array['completed','withdrawn'],'Learner projects'),
 ('khpos_ops_worldready_records','owner_assignment_id',array['ready','closed','cancelled'],'WorldReady records'),
 ('khpos_ops_worldready_actions','owner_assignment_id',array['verified','waived','cancelled'],'WorldReady actions'),
 ('khpos_ops_culture_cases','owner_assignment_id',array['verified','referred_safeguarding'],'Student culture'),
 ('khpos_ops_culture_actions','owner_assignment_id',array['verified'],'Culture actions'),
 ('khpos_ops_safeguarding_designations','lead_assignment_id',array['superseded'],'Designated safeguarding responsibilities'),
 ('khpos_ops_safeguarding_designations','deputy_assignment_id',array['superseded'],'Designated safeguarding responsibilities'),
 ('khpos_ops_parent_cases','owner_assignment_id',array['closed'],'Parent cases'),
 ('khpos_ops_events','owner_assignment_id',array['completed','reviewed','cancelled'],'Events'),
 ('khpos_ops_parent_journeys','owner_assignment_id',array['completed','lost'],'Parent journeys')
 ) as x(table_name,column_name,terminal_states,label) loop
  -- Fixed identifiers only; a school controls no query text or identifiers.
  if pg_catalog.to_regclass('public.'||spec.table_name) is not null then
   execute pg_catalog.format('select exists(select 1 from public.%I where organisation_id=$1 and %I=$2 and not(status=any($3)))',spec.table_name,spec.column_name) into found_open using p_org,p_assignment,spec.terminal_states;
   if found_open and not spec.label=any(result) then result:=array_append(result,spec.label); end if;
  end if;
 end loop;
 for spec in select * from (values ('khpos_ops_young_ceo_sessions'),('khpos_ops_financial_capability_activities')) x(table_name) loop
  if pg_catalog.to_regclass('public.'||spec.table_name) is not null then
   execute pg_catalog.format('select exists(select 1 from public.%I where organisation_id=$1 and owner_assignment_id=$2 and recovery_status in (''required'',''planned''))',spec.table_name) into found_open using p_org,p_assignment;
   if found_open then result:=array_append(result,'Outstanding session recovery'); end if;
  end if;
 end loop;
 if pg_catalog.to_regclass('public.khpos_ops_reporting_lines') is not null then
  execute 'select exists(select 1 from public.khpos_ops_reporting_lines where (subordinate_assignment_id=$1 or supervisor_assignment_id=$1) and (effective_to is null or effective_to>current_date))' into found_open using p_assignment;
  if found_open then result:=array_append(result,'Reporting lines'); end if;
 end if;
 if pg_catalog.to_regclass('public.khpos_ops_backup_assignments') is not null then
  execute 'select exists(select 1 from public.khpos_ops_backup_assignments where (primary_assignment_id=$1 or backup_assignment_id=$1) and status=''active'' and (effective_to is null or effective_to>current_date))' into found_open using p_assignment;
  if found_open then result:=array_append(result,'Backup responsibilities'); end if;
 end if;
 return result;
end $$;
revoke all on function khpos_private.ops_assignment_handover_blockers(uuid,uuid) from public,anon,authenticated;
grant execute on function khpos_private.ops_assignment_handover_blockers(uuid,uuid) to service_role;

create function public.khpos_ops_get_assignment_controls_server(p_actor uuid,p_org uuid,p_staff uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare st public.khpos_ops_staff%rowtype;
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_org) then raise exception 'Active school membership required.'; end if;
 select * into st from public.khpos_ops_staff where id=p_staff and organisation_id=p_org;
 if not found then raise exception 'Staff record not found in this school.'; end if;
 if st.user_id is distinct from p_actor and not khpos_private.ops_positions_can_manage(p_actor,p_org,st.campus_id) then raise exception 'Staff member outside your school/campus authority.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'assignmentId',a.id,'roleCode',r.code,'title',r.title,'primary',a.id=st.role_assignment_id,
 'status',case when a.status='inactive' and ctl.last_action='disable' then 'disabled' else a.status end,
 'campusName',c.name,'unitName',u.name,'positionId',pos.id,
 'remainingActiveCount',(select count(*) from public.khpos_ops_role_assignments rest join public.khpos_ops_roles rr on rr.id=rest.role_id where rest.user_id=st.user_id and rr.organisation_id=p_org and rr.status='active' and rest.status='active' and rest.id<>a.id),
 'canManage',st.status='active' and st.user_id is distinct from p_actor and r.code in ('SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR','FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER') and khpos_private.ops_positions_can_manage(p_actor,p_org,a.campus_id,r.code),
 'handoverBlockers',to_jsonb(khpos_private.ops_assignment_handover_blockers(p_org,a.id)),
 'reason',ctl.reason,'handover',ctl.handover,'updatedAt',ctl.updated_at
 ) order by (a.id=st.role_assignment_id) desc,r.title,a.created_at desc)
 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
 left join public.khpos_ops_campuses c on c.id=a.campus_id left join public.khpos_ops_units u on u.id=a.unit_id
 left join public.khpos_ops_assignment_controls ctl on ctl.assignment_id=a.id
 left join public.khpos_ops_staff_role_positions pos on pos.role_assignment_id=a.id and pos.staff_id=st.id
 where a.user_id=st.user_id and r.organisation_id=p_org
 and (st.user_id=p_actor or khpos_private.ops_positions_can_manage(p_actor,p_org,a.campus_id,r.code))),'[]'::jsonb);
end $$;

create function public.khpos_ops_assignment_action_server(p_actor uuid,p_org uuid,p_staff uuid,p_assignment uuid,p_mode text,p_input jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare st public.khpos_ops_staff%rowtype; a public.khpos_ops_role_assignments%rowtype; replacement public.khpos_ops_role_assignments%rowtype;
 r public.khpos_ops_roles%rowtype; next_role public.khpos_ops_roles%rowtype; pos_id uuid; v_primary boolean; remaining integer; v_blockers text[];
 v_note text:=btrim(coalesce(p_input->>'note','')); v_handover text:=btrim(coalesce(p_input->>'handover',''));
 v_replacement uuid:=nullif(p_input->>'replacementId','')::uuid;
begin
 if p_mode not in ('disable','restore','end','make_primary') then raise exception 'Unsupported assignment action.'; end if;
 if not khpos_private.ops_hpd_has_membership(p_actor,p_org) then raise exception 'Active school membership required.'; end if;
 -- Serialize all lifecycle actions for one person before locking their assignments.
 select * into st from public.khpos_ops_staff where id=p_staff and organisation_id=p_org for update;
 if not found or st.user_id is null or st.status<>'active' then raise exception 'An active account-linked staff record is required.'; end if;
 if st.user_id=p_actor then raise exception 'A different authorised leader must manage your positions.'; end if;
 select a0.* into a from public.khpos_ops_role_assignments a0 join public.khpos_ops_roles r0 on r0.id=a0.role_id where a0.id=p_assignment and a0.user_id=st.user_id and r0.organisation_id=p_org for update of a0;
 if not found then raise exception 'Assignment not found for this staff member and school.'; end if;
 select * into r from public.khpos_ops_roles where id=a.role_id;
 if r.code not in ('SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR','FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER') then raise exception 'Custodian and governance positions require the separate governance approval route.'; end if;
 if not khpos_private.ops_positions_can_manage(p_actor,p_org,a.campus_id,r.code) then raise exception 'Your school/campus authority cannot manage this position.'; end if;
 if length(v_note)<10 or length(v_note)>2000 then raise exception 'Record a reason between 10 and 2000 characters.'; end if;
 v_primary:=a.id=st.role_assignment_id or a.primary_assignment;
 if p_mode in ('disable','end') then
  if (p_mode='disable' and a.status<>'active') or (p_mode='end' and a.status not in ('active','inactive')) then raise exception 'This position is not available for that action.'; end if;
  if length(v_handover)<10 or length(v_handover)>2000 then raise exception 'Record the handover arrangements in 10 to 2000 characters.'; end if;
  if exists(select 1 from public.khpos_ops_work_items where owner_assignment_id=a.id and status not in ('completed','cancelled'))
   or exists(select 1 from public.khpos_ops_issues where owner_assignment_id=a.id and status not in ('closed','cancelled'))
   or exists(select 1 from public.khpos_ops_decisions where (authority_assignment_id=a.id or implementation_owner_assignment_id=a.id or requester_assignment_id=a.id) and status not in ('closed','cancelled','declined')) then
    raise exception 'Complete or reassign open work, issues and decisions before disabling or ending this position.';
  end if;
  v_blockers:=khpos_private.ops_assignment_handover_blockers(p_org,a.id);
  if cardinality(v_blockers)>0 then raise exception 'Complete or reassign these responsibilities first: %',array_to_string(v_blockers,', '); end if;
  select count(*) into remaining from public.khpos_ops_role_assignments x join public.khpos_ops_roles xr on xr.id=x.role_id where x.user_id=st.user_id and xr.organisation_id=p_org and x.id<>a.id and x.status='active' and xr.status='active';
  if remaining=0 and coalesce(p_input->'confirmLastPosition','false'::jsonb)<>'true'::jsonb then raise exception 'Confirm that this removes the last active operating position. The staff account and history will remain.'; end if;
  if p_mode='end' and v_primary and remaining>0 and v_replacement is null then raise exception 'Choose an active replacement primary position before ending the current primary.'; end if;
 elsif p_mode='restore' then
  if a.status<>'inactive' or not exists(select 1 from public.khpos_ops_assignment_controls where assignment_id=a.id and last_action='disable') then raise exception 'Only a position disabled through these controls can be restored. Ended positions require a new appointment.'; end if;
  if not khpos_private.ops_hpd_has_membership(st.user_id,p_org) or r.status<>'active' then raise exception 'Staff school membership and role must be active before restoration.'; end if;
  if a.campus_id is not null and not exists(select 1 from public.khpos_ops_campuses where id=a.campus_id and organisation_id=p_org and status='active') then raise exception 'The assigned campus must be active.'; end if;
  if a.unit_id is not null and not exists(select 1 from public.khpos_ops_units where id=a.unit_id and organisation_id=p_org and status='active' and (campus_id is null or campus_id=a.campus_id)) then raise exception 'The assigned section must be active and in this campus.'; end if;
  if exists(select 1 from public.khpos_ops_role_assignments x where x.user_id=st.user_id and x.role_id=a.role_id and x.id<>a.id and x.status='active' and (x.campus_id is null or a.campus_id is null or x.campus_id=a.campus_id) and (x.unit_id is null or a.unit_id is null or x.unit_id=a.unit_id)) then raise exception 'Another active assignment already covers this role and scope.'; end if;
  if not exists(select 1 from public.khpos_ops_role_charters where role_id=r.id and status='active') then raise exception 'Publish the current role charter before restoration.'; end if;
  if exists(select 1 from public.khpos_ops_role_charters ch cross join lateral unnest(coalesce(ch.required_policy_codes,'{}'::text[])) required(code) where ch.role_id=r.id and ch.status='active' and not exists(select 1 from public.khpos_ops_policies p join public.khpos_ops_policy_versions v on v.policy_id=p.id and v.status='active' join public.khpos_ops_policy_acknowledgements ack on ack.policy_version_id=v.id and ack.organisation_id=p_org and ack.user_id=st.user_id where p.organisation_id=p_org and p.code=required.code and p.status='active')) then raise exception 'Acknowledge current required policies before restoration.'; end if;
  select id into pos_id from public.khpos_ops_staff_role_positions where role_assignment_id=a.id and staff_id=st.id;
  if pos_id is not null and cardinality(khpos_private.ops_position_blockers(pos_id))>0 then raise exception 'Complete current role acknowledgement, policies and guided practice before restoration.'; end if;
 elsif p_mode='make_primary' then
  if a.status<>'active' or r.status<>'active' then raise exception 'Only an already active position can become primary.'; end if;
  if v_primary then raise exception 'This position is already primary.'; end if;
  -- A campus leader cannot alter a primary position outside their own authority.
  if exists(select 1 from public.khpos_ops_role_assignments old_a join public.khpos_ops_roles old_r on old_r.id=old_a.role_id where old_a.id=st.role_assignment_id and (old_r.code in ('SCHOOL_CUSTODIAN','VISION_CUSTODIAN') or not khpos_private.ops_positions_can_manage(p_actor,p_org,old_a.campus_id,old_r.code))) then raise exception 'Authority over the current primary position is also required.'; end if;
  v_replacement:=a.id;
 end if;
 if v_replacement is not null and (p_mode='make_primary' or (p_mode='end' and v_primary)) then
  select x.* into replacement from public.khpos_ops_role_assignments x join public.khpos_ops_roles xr on xr.id=x.role_id where x.id=v_replacement and x.user_id=st.user_id and xr.organisation_id=p_org and x.status='active' and xr.status='active' and (p_mode='make_primary' or x.id<>a.id) for update of x;
  if not found then raise exception 'Choose an existing active position for this person in this school.'; end if;
  select * into next_role from public.khpos_ops_roles where id=replacement.role_id;
  if next_role.code in ('SCHOOL_CUSTODIAN','VISION_CUSTODIAN') or not khpos_private.ops_positions_can_manage(p_actor,p_org,replacement.campus_id,next_role.code) then raise exception 'Your authority cannot appoint this replacement primary.'; end if;
  update public.khpos_ops_role_assignments x set primary_assignment=false,updated_at=now() from public.khpos_ops_roles xr where x.role_id=xr.id and xr.organisation_id=p_org and x.user_id=st.user_id and x.primary_assignment;
  update public.khpos_ops_role_assignments set primary_assignment=true,updated_at=now() where id=replacement.id;
  update public.khpos_ops_staff set role_assignment_id=replacement.id,desired_role_id=replacement.role_id,campus_id=replacement.campus_id,unit_id=replacement.unit_id,updated_at=now() where id=st.id;
 end if;
 if p_mode='disable' then
  update public.khpos_ops_role_assignments set status='inactive',updated_at=now() where id=a.id;
 elsif p_mode='restore' then
  update public.khpos_ops_role_assignments set status='active',appointed_by=p_actor,updated_at=now() where id=a.id;
 elsif p_mode='end' then
  update public.khpos_ops_role_assignments set status='ended',primary_assignment=false,end_date=current_date,updated_at=now() where id=a.id;
  update public.khpos_ops_staff_role_positions set status='ended',ended_by=p_actor,ended_at=now(),updated_at=now() where role_assignment_id=a.id and staff_id=st.id;
 end if;
 insert into public.khpos_ops_assignment_controls(assignment_id,organisation_id,staff_id,last_action,reason,handover,updated_by) values(a.id,p_org,st.id,p_mode,v_note,nullif(v_handover,''),p_actor)
 on conflict(assignment_id) do update set last_action=excluded.last_action,reason=excluded.reason,handover=excluded.handover,updated_by=p_actor,updated_at=now();
 insert into public.khpos_ops_staff_events(organisation_id,staff_id,actor_user_id,event_type,note,metadata) values(p_org,st.id,p_actor,'assignment_'||p_mode,v_note,jsonb_build_object('assignmentId',a.id,'handover',v_handover,'replacementId',v_replacement));
end $$;
revoke all on function public.khpos_ops_get_assignment_controls_server(uuid,uuid,uuid),public.khpos_ops_assignment_action_server(uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_get_assignment_controls_server(uuid,uuid,uuid),public.khpos_ops_assignment_action_server(uuid,uuid,uuid,uuid,text,jsonb) to service_role;
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
 -- Existing end callers must use the same audited handover and last-position gates.
 if p_mode='end' then
   select * into pos from public.khpos_ops_staff_role_positions where id=(p_input->>'positionId')::uuid and organisation_id=p_org;
   if pos.id is not null and pos.role_assignment_id is not null then
     perform public.khpos_ops_assignment_action_server(p_actor,p_org,pos.staff_id,pos.role_assignment_id,'end',p_input);
     return pos.id;
   end if;
 end if;
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
