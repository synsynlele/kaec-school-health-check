-- Additional appointments belong to the existing staff identity. Pending appointments
-- never grant access; only independently reviewed activation creates an assignment.
create table public.khpos_ops_staff_role_positions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  staff_id uuid not null references public.khpos_ops_staff(id),
  role_id uuid not null references public.khpos_ops_roles(id),
  campus_id uuid not null references public.khpos_ops_campuses(id),
  unit_id uuid references public.khpos_ops_units(id),
  status text not null default 'pending' check(status in ('pending','active','ended')),
  role_assignment_id uuid unique references public.khpos_ops_role_assignments(id),
  charter_id uuid references public.khpos_ops_role_charters(id),
  acknowledged_at timestamptz,
  acknowledgement_note text,
  proposed_by uuid not null references auth.users(id),
  activated_by uuid references auth.users(id),
  activated_at timestamptz,
  ended_by uuid references auth.users(id),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((status='active' and role_assignment_id is not null) or status<>'active')
);
create index idx_staff_role_positions_staff on public.khpos_ops_staff_role_positions(staff_id);
create index idx_staff_role_positions_campus on public.khpos_ops_staff_role_positions(campus_id);
create index idx_staff_role_positions_unit on public.khpos_ops_staff_role_positions(unit_id);
create index idx_staff_role_positions_scope on public.khpos_ops_staff_role_positions(organisation_id,staff_id,status);
create index idx_staff_role_positions_role on public.khpos_ops_staff_role_positions(role_id,campus_id,unit_id);
create index idx_staff_role_positions_charter on public.khpos_ops_staff_role_positions(charter_id);
create index idx_staff_role_positions_proposer on public.khpos_ops_staff_role_positions(proposed_by);
create index idx_staff_role_positions_activator on public.khpos_ops_staff_role_positions(activated_by);
create index idx_staff_role_positions_ender on public.khpos_ops_staff_role_positions(ended_by);
alter table public.khpos_ops_staff_role_positions enable row level security;
revoke all on public.khpos_ops_staff_role_positions from public,anon,authenticated;
grant select,insert,update on public.khpos_ops_staff_role_positions to service_role;

create or replace function khpos_private.ops_positions_can_manage(p_actor uuid,p_org uuid,p_campus uuid,p_target_code text default null)
returns boolean language sql stable security definer set search_path='' as $$
  select khpos_private.ops_hpd_has_membership(p_actor,p_org) and exists(
    select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor and a.status='active' and r.status='active' and r.organisation_id=p_org
      and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN')
      and (a.campus_id is null or a.campus_id=p_campus)
      and a.unit_id is null
      and (p_target_code is distinct from 'SCHOOL_GUARDIAN' or r.code='SCHOOL_CUSTODIAN')
  );
$$;

create or replace function khpos_private.ops_position_blockers(p_position uuid)
returns text[] language plpgsql stable security definer set search_path='' as $$
declare pos public.khpos_ops_staff_role_positions%rowtype; staff public.khpos_ops_staff%rowtype;
  charter public.khpos_ops_role_charters%rowtype; blockers text[] := '{}'::text[];
begin
 select * into pos from public.khpos_ops_staff_role_positions where id=p_position;
 select * into staff from public.khpos_ops_staff where id=pos.staff_id;
 if staff.status<>'active' or staff.user_id is null or not khpos_private.ops_hpd_has_membership(staff.user_id,pos.organisation_id) then
   blockers:=array_append(blockers,'The existing staff identity must be active with active school access.');
 end if;
 select * into charter from public.khpos_ops_role_charters where role_id=pos.role_id and status='active';
 if charter.id is null then blockers:=array_append(blockers,'Publish the role charter first.');
 elsif pos.charter_id is distinct from charter.id or pos.acknowledged_at is null then
   blockers:=array_append(blockers,'Read and acknowledge the current role charter.');
 end if;
 if exists(select 1 from unnest(coalesce(charter.required_policy_codes,'{}'::text[])) required(code)
   where not exists(select 1 from public.khpos_ops_policies p
     join public.khpos_ops_policy_versions v on v.policy_id=p.id and v.status='active'
     join public.khpos_ops_policy_acknowledgements ack on ack.policy_version_id=v.id
       and ack.organisation_id=pos.organisation_id and ack.user_id=staff.user_id
     where p.organisation_id=pos.organisation_id and p.code=required.code and p.status='active')) then
   blockers:=array_append(blockers,'A required policy is unpublished or its current version has not been acknowledged.');
 end if;
 if not exists(select 1 from public.khpos_ops_practice_runs where organisation_id=pos.organisation_id
    and user_id=staff.user_id and scenario_code='KHPOS_CORE_V1' and status='completed') then
   blockers:=array_append(blockers,'Complete the shared guided practice in My Onboarding.');
 end if;
 return blockers;
end;
$$;

create or replace function public.khpos_ops_role_position_action_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
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
 if role.id is null or role.code not in ('SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR') then
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
$$;

create or replace function public.khpos_ops_get_role_positions_server(p_actor uuid,p_org uuid,p_staff_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare staff public.khpos_ops_staff%rowtype; subject uuid:=p_actor; manageable boolean:=false; result jsonb;
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_org) then raise exception 'Active school membership and partnership are required.'; end if;
 if p_staff_id is not null then
   select * into staff from public.khpos_ops_staff where id=p_staff_id and organisation_id=p_org and status<>'ended';
   if staff.id is null then raise exception 'Staff record not found in this school.'; end if;
 else
   if (select count(*) from public.khpos_ops_staff where organisation_id=p_org and user_id=p_actor and status<>'ended')>1 then
     raise exception 'Multiple staff records use this account. Reconcile the staff identity before managing positions.';
   end if;
   select * into staff from public.khpos_ops_staff where organisation_id=p_org and user_id=p_actor and status<>'ended' limit 1;
 end if;
 if staff.id is not null then
   subject:=staff.user_id;
   manageable:=staff.user_id is distinct from p_actor and khpos_private.ops_positions_can_manage(p_actor,p_org,staff.campus_id);
   if staff.user_id is distinct from p_actor and not manageable then raise exception 'This staff member is outside your school/campus authority.'; end if;
 end if;
 select jsonb_build_object(
   'staffId',staff.id,'canManage',manageable,'canAppointGuardian',manageable and khpos_private.ops_positions_can_manage(p_actor,p_org,staff.campus_id,'SCHOOL_GUARDIAN'),
   'activePositions',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',a.id,'roleId',r.id,'roleCode',r.code,'title',r.title,'primary',a.primary_assignment,
      'campusName',c.name,'unitName',u.name,'reportsTo',parent.title) order by a.primary_assignment desc,r.role_level,r.title)
     from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
     left join public.khpos_ops_roles parent on parent.id=r.reports_to_role_id
     left join public.khpos_ops_campuses c on c.id=a.campus_id left join public.khpos_ops_units u on u.id=a.unit_id
     where a.user_id=subject and a.status='active' and r.status='active' and r.organisation_id=p_org),'[]'::jsonb),
   'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',pos.id,'roleId',r.id,'title',r.title,'status',case when pos.status='active' and a.status is distinct from 'active' then 'ended' else pos.status end,
      'campusName',c.name,'unitName',u.name,'acknowledged',pos.charter_id=charter.id and pos.acknowledged_at is not null,
      'canAcknowledge',staff.user_id=p_actor and pos.status='pending','canManage',staff.user_id is distinct from p_actor and khpos_private.ops_positions_can_manage(p_actor,p_org,pos.campus_id,r.code),
      'blockers',to_jsonb(khpos_private.ops_position_blockers(pos.id)),
      'charter',jsonb_build_object('mission',charter.mission,'responsibilities',charter.responsibilities,'decisionRights',charter.decision_rights,'escalation',charter.escalation_rules),
      'requiredPolicies',coalesce((select jsonb_agg(jsonb_build_object('code',required.code,'name',p.name,'versionId',v.id,'published',v.id is not null,'acknowledged',exists(select 1 from public.khpos_ops_policy_acknowledgements ack where ack.policy_version_id=v.id and ack.user_id=subject and ack.organisation_id=p_org)))
         from unnest(coalesce(charter.required_policy_codes,'{}'::text[])) required(code)
         left join public.khpos_ops_policies p on p.code=required.code and p.organisation_id=p_org and p.status='active'
         left join public.khpos_ops_policy_versions v on v.policy_id=p.id and v.status='active'),'[]'::jsonb)) order by pos.created_at desc)
     from public.khpos_ops_staff_role_positions pos join public.khpos_ops_roles r on r.id=pos.role_id
     join public.khpos_ops_campuses c on c.id=pos.campus_id left join public.khpos_ops_units u on u.id=pos.unit_id
     left join public.khpos_ops_role_charters charter on charter.role_id=r.id and charter.status='active'
     left join public.khpos_ops_role_assignments a on a.id=pos.role_assignment_id
     where pos.staff_id=staff.id and pos.organisation_id=p_org),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;

-- The first independently staffed level in the owner's reporting chain reviews
-- their work. Whole-school leaders retain scoped oversight. Self-review is never allowed.
create or replace function khpos_private.ops_work_review_route(p_actor uuid,p_org uuid,p_work uuid)
returns uuid language sql stable security definer set search_path='' as $$
 with recursive target as (
   select w.id,w.campus_id,w.unit_id,a.user_id as owner_user,r.id as role_id,r.reports_to_role_id
   from public.khpos_ops_work_items w join public.khpos_ops_role_assignments a on a.id=w.owner_assignment_id
   join public.khpos_ops_roles r on r.id=a.role_id and r.organisation_id=w.organisation_id
   where w.id=p_work and w.organisation_id=p_org and w.status='awaiting_verification'
 ), chain as (
   select r.id,r.reports_to_role_id,1 as depth,array[t.role_id,r.id] as path
   from target t join public.khpos_ops_roles r on r.id=t.reports_to_role_id and r.organisation_id=p_org and r.status='active'
   union all
   select r.id,r.reports_to_role_id,ch.depth+1,ch.path||r.id from chain ch
   join public.khpos_ops_roles r on r.id=ch.reports_to_role_id and r.organisation_id=p_org and r.status='active'
   where not r.id=any(ch.path) and ch.depth<20
 ), eligible as (
   select a.user_id,r.id,r.code,coalesce(ch.depth,100) as depth
   from target t join public.khpos_ops_roles r on r.organisation_id=p_org and r.status='active'
   join public.khpos_ops_role_assignments a on a.role_id=r.id and a.status='active'
   join public.organisation_memberships m on m.user_id=a.user_id and m.organisation_id=p_org and m.status='active'
   left join chain ch on ch.id=r.id
   where a.user_id<>t.owner_user and (a.campus_id is null or a.campus_id=t.campus_id)
     and (a.unit_id is null or a.unit_id=t.unit_id)
     and (ch.id is not null or r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN'))
 )
 select e.id from eligible e
 where e.user_id=p_actor and khpos_private.ops_hpd_has_membership(p_actor,p_org)
   and (e.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN') or e.depth=(select min(depth) from eligible))
 order by e.depth,e.id limit 1;
$$;

create or replace function public.khpos_ops_get_verification_routes_server(p_actor uuid,p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_org) then raise exception 'Active school membership and partnership are required.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('workItemId',w.id,'reviewerRoleId',r.id,'reviewerRoleTitle',r.title))
   from public.khpos_ops_work_items w
   cross join lateral (select khpos_private.ops_work_review_route(p_actor,p_org,w.id) as role_id) route
   join public.khpos_ops_roles r on r.id=route.role_id
   where w.organisation_id=p_org and w.status='awaiting_verification'),'[]'::jsonb);
end;
$$;

revoke all on function khpos_private.ops_positions_can_manage(uuid,uuid,uuid,text),khpos_private.ops_position_blockers(uuid),khpos_private.ops_work_review_route(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_role_position_action_server(uuid,uuid,text,jsonb),public.khpos_ops_get_role_positions_server(uuid,uuid,uuid),public.khpos_ops_get_verification_routes_server(uuid,uuid) from public,anon,authenticated;
grant execute on function khpos_private.ops_positions_can_manage(uuid,uuid,uuid,text),khpos_private.ops_position_blockers(uuid),khpos_private.ops_work_review_route(uuid,uuid,uuid),public.khpos_ops_role_position_action_server(uuid,uuid,text,jsonb),public.khpos_ops_get_role_positions_server(uuid,uuid,uuid),public.khpos_ops_get_verification_routes_server(uuid,uuid) to service_role;
CREATE OR REPLACE FUNCTION public.khpos_ops_verify_work_server(p_actor_user_id uuid, p_organisation_id uuid, p_work_item_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare
  v_work public.khpos_ops_work_items%rowtype;
  v_owner_user_id uuid;
  v_owner_reports_to_role_id uuid;
  v_allowed boolean := false;
begin
  if p_action not in ('verify','return') then
    raise exception 'Unsupported verification action.';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select w.* into v_work
  from public.khpos_ops_work_items w
  where w.id=p_work_item_id
    and w.organisation_id=p_organisation_id
    and w.status='awaiting_verification'
  for update;

  if v_work.id is null then
    raise exception 'Work awaiting verification was not found.';
  end if;

  select a.user_id,r.reports_to_role_id
  into v_owner_user_id,v_owner_reports_to_role_id
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.id=v_work.owner_assignment_id;

  if v_owner_user_id=p_actor_user_id then
    raise exception 'The work owner cannot verify their own submission.';
  end if;

  v_allowed := khpos_private.ops_work_review_route(p_actor_user_id,p_organisation_id,p_work_item_id) is not null;

  if not v_allowed then
    raise exception 'Your operating role is not authorised to verify this work.';
  end if;

  if p_action='return' then
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'Explain what must be corrected before returning the work.';
    end if;

    update public.khpos_ops_work_records
      set status='returned',
          review_note=btrim(p_note),
          reviewed_by=p_actor_user_id,
          reviewed_at=now(),
          updated_at=now()
    where work_item_id=v_work.id and status='submitted';

    update public.khpos_ops_work_items
      set status='in_progress',
          submitted_for_verification_at=null,
          verified_by=null,
          verified_at=null,
          completed_at=null,
          updated_at=now()
    where id=v_work.id;
  else
    update public.khpos_ops_work_records
      set status='verified',
          review_note=nullif(btrim(coalesce(p_note,'')),''),
          reviewed_by=p_actor_user_id,
          reviewed_at=now(),
          updated_at=now()
    where work_item_id=v_work.id and status='submitted';

    update public.khpos_ops_evidence
      set verification_status='verified',
          verified_by=p_actor_user_id,
          verified_at=now()
    where work_item_id=v_work.id
      and verification_status='unverified';

    update public.khpos_ops_work_items
      set status='completed',
          verified_by=p_actor_user_id,
          verified_at=now(),
          completed_at=now(),
          updated_at=now()
    where id=v_work.id;
  end if;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_work_'||p_action,'work_item',v_work.id,
    jsonb_build_object('note',nullif(btrim(coalesce(p_note,'')),''))
  );
end;
$function$;


revoke all on function public.khpos_ops_verify_work_server(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.khpos_ops_verify_work_server(uuid,uuid,uuid,text,text) to service_role;
