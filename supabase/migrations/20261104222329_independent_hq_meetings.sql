-- NULL school scope denotes the existing KAEC corporate tenant, never a school.
alter table public.khpos_meetings alter column organisation_id drop not null;
alter table public.khpos_meeting_actions alter column work_item_id drop not null;
alter table public.khpos_meeting_actions add column hq_record_id uuid unique references public.kaec_hq_records(id);
alter table public.khpos_meeting_actions add constraint meeting_action_one_owner_record check(num_nonnulls(work_item_id,hq_record_id)=1);
-- Meeting authority is independent of staff-management authority.
create or replace function khpos_private.meeting_can_host(p_actor uuid,p_org uuid) returns boolean
language sql stable security definer set search_path=public,khpos_private,pg_temp as $$
 select (p_org is null and exists(select 1 from public.kaec_hq_members h where h.user_id=p_actor and h.status='active')) or (exists(select 1 from public.organisations o where o.id=p_org and o.status='active'
 and o.partner_status='active' and 'khpos_core'=any(o.partner_entitlements)) and (
 exists(select 1 from public.kaec_hq_members h where h.user_id=p_actor and h.status='active') or (
 khpos_private.ops_hpd_has_membership(p_actor,p_org) and exists(
 select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
 where a.user_id=p_actor and a.status='active' and r.status='active' and r.organisation_id=p_org
 and a.start_date<=current_date and (a.end_date is null or a.end_date>=current_date)
 and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER')))))
$$;
revoke all on function khpos_private.meeting_can_host(uuid,uuid) from public,anon,authenticated;
grant execute on function khpos_private.meeting_can_host(uuid,uuid) to service_role;

create or replace function khpos_private.hq_meeting_invitee(p_actor uuid) returns boolean
language sql stable security definer set search_path=public,khpos_private,pg_temp as $$
 select exists(select 1 from public.kaec_hq_members h where h.user_id=p_actor and h.status='active')
 or exists(select 1 from public.organisation_memberships om where om.user_id=p_actor and om.status='active'
 and khpos_private.meeting_can_host(p_actor,om.organisation_id))
$$;
revoke all on function khpos_private.hq_meeting_invitee(uuid) from public,anon,authenticated;
grant execute on function khpos_private.hq_meeting_invitee(uuid) to service_role;
create or replace function khpos_private.meeting_access(p_actor uuid,p_meeting uuid) returns boolean
language sql stable security definer set search_path=public,khpos_private,pg_temp as $$
 select exists(select 1 from public.khpos_meetings m join public.khpos_meeting_participants p on p.meeting_id=m.id
 where m.id=p_meeting and p.user_id=p_actor and (
 (m.organisation_id is null and khpos_private.hq_meeting_invitee(p_actor)) or
 (m.organisation_id is not null and exists(select 1 from public.organisations o where o.id=m.organisation_id and o.status='active' and o.partner_status='active' and 'khpos_core'=any(o.partner_entitlements))
 and (khpos_private.ops_hpd_has_membership(p_actor,m.organisation_id) or exists(select 1 from public.kaec_hq_members h where h.user_id=p_actor and h.status='active')))))
$$;
revoke all on function khpos_private.meeting_access(uuid,uuid) from public,anon,authenticated;
grant execute on function khpos_private.meeting_access(uuid,uuid) to service_role;
create or replace function public.khpos_meetings_base_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,khpos_private,pg_temp as $$
declare v_id uuid := nullif(p_input->>'meetingId','')::uuid; v_meeting public.khpos_meetings%rowtype;
 v_create boolean; v_person uuid; v_assignment uuid; v_work uuid; v_room jsonb := null;
begin
 v_create := khpos_private.meeting_can_host(p_actor,p_org);
 if not v_create and not khpos_private.ops_hpd_has_membership(p_actor,p_org) and not exists(
 select 1 from public.khpos_meetings m where m.organisation_id is not distinct from p_org and khpos_private.meeting_access(p_actor,m.id)) then
 raise exception 'Meeting access required.' using errcode='42501'; end if;
 if p_mode='create' then
  if not v_create then raise exception 'An active leadership or KAEC HQ appointment is required.' using errcode='42501'; end if;
  if jsonb_typeof(p_input->'participants') is distinct from 'array' or jsonb_array_length(p_input->'participants') not between 1 and 50
  or length(btrim(coalesce(p_input->>'title',''))) not between 1 and 160
  or length(btrim(coalesce(p_input->>'agenda',''))) not between 1 and 4000
  or (p_input->>'startsAt')::timestamptz >= (p_input->>'endsAt')::timestamptz then
  raise exception 'Check the title, agenda, participants and meeting times.' using errcode='22023'; end if;
  insert into public.khpos_meetings(organisation_id,title,agenda,starts_at,ends_at,call_url,created_by)
  values(p_org,btrim(p_input->>'title'),btrim(p_input->>'agenda'),(p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz,nullif(p_input->>'callUrl',''),p_actor) returning id into v_id;
  insert into public.khpos_meeting_participants values(v_id,p_actor);
  for v_person in select distinct value::uuid from jsonb_array_elements_text(p_input->'participants') loop
   if (p_org is null and not khpos_private.hq_meeting_invitee(v_person)) or (p_org is not null and not khpos_private.ops_hpd_has_membership(v_person,p_org) and not exists(select 1 from public.kaec_hq_members where user_id=v_person and status='active')) then
    raise exception 'Choose active school or KAEC HQ participants.' using errcode='22023'; end if;
   insert into public.khpos_meeting_participants values(v_id,v_person) on conflict do nothing;
  end loop;
 elsif p_mode not in ('list','message','decision','action','status') then
  raise exception 'Unknown meeting operation.' using errcode='22023';
 end if;
 if v_id is not null then
  select * into v_meeting from public.khpos_meetings where id=v_id and organisation_id is not distinct from p_org for update;
  if v_meeting.id is null or not khpos_private.meeting_access(p_actor,v_id) then raise exception 'Meeting access required.' using errcode='42501'; end if;
  if p_mode not in ('list','create') then
   if v_meeting.status in ('closed','cancelled') then raise exception 'This meeting is read-only.' using errcode='22023'; end if;
   if p_mode<>'message' and (v_meeting.created_by<>p_actor or not v_create) then raise exception 'Only the active meeting host can record outcomes.' using errcode='42501'; end if;
   if p_mode='message' then
    insert into public.khpos_meeting_messages(id,meeting_id,author_id,body) values((p_input->>'id')::uuid,v_id,p_actor,btrim(p_input->>'body')) on conflict(id) do nothing;
   elsif p_mode='decision' then
    insert into public.khpos_meeting_decisions(id,meeting_id,created_by,body) values((p_input->>'id')::uuid,v_id,p_actor,btrim(p_input->>'body')) on conflict(id) do nothing;
   elsif p_mode='action' then
    -- Locking the room and using the caller's action ID makes retries atomic and idempotent.
    if not exists(select 1 from public.khpos_meeting_actions where id=(p_input->>'id')::uuid) then
     v_person := (p_input->>'ownerId')::uuid;
     if p_org is null then
      if not exists(select 1 from public.khpos_meeting_participants p join public.kaec_hq_members h on h.user_id=p.user_id and h.status='active' where p.meeting_id=v_id and p.user_id=v_person) then
       raise exception 'Choose an invited active HQ task owner.' using errcode='22023'; end if;
      if length(btrim(coalesce(p_input->>'title',''))) not between 4 and 160 or (p_input->>'dueAt')::timestamptz is null then
       raise exception 'Give the action a title of at least four characters and a deadline.' using errcode='22023'; end if;
      insert into public.kaec_hq_records(module,record_type,title,description,status,owner_user_id,due_on,created_by,updated_by)
      values('work','meeting_action',btrim(p_input->>'title'),'Agreed in a private KAEC HQ meeting. Record evidence in HQ Work.','active',v_person,((p_input->>'dueAt')::timestamptz at time zone 'Africa/Lagos')::date,p_actor,p_actor) returning id into v_work;
      insert into public.khpos_meeting_actions(id,meeting_id,hq_record_id) values((p_input->>'id')::uuid,v_id,v_work);
     else
     if not exists(select 1 from public.khpos_meeting_participants where meeting_id=v_id and user_id=v_person)
     or not khpos_private.ops_hpd_has_membership(v_person,p_org) then raise exception 'Choose an invited active school task owner.' using errcode='22023'; end if;
     select a.id into v_assignment from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
     where r.organisation_id is not distinct from p_org and r.status='active' and a.user_id=v_person and a.status='active'
     and a.start_date<=current_date and (a.end_date is null or a.end_date>=current_date)
     order by a.primary_assignment desc,a.id limit 1;
     if v_assignment is null then raise exception 'The task owner needs an active school role.' using errcode='22023'; end if;
     if length(btrim(coalesce(p_input->>'title',''))) not between 1 and 160 or (p_input->>'dueAt')::timestamptz is null then raise exception 'Give an action and deadline.' using errcode='22023'; end if;
     insert into public.khpos_ops_work_items(organisation_id,owner_assignment_id,title,description,due_at,created_by,evidence_required)
     values(p_org,v_assignment,btrim(p_input->>'title'),'Agreed in a private KHP-OS meeting. Submit completion evidence through Today.',(p_input->>'dueAt')::timestamptz,p_actor,true) returning id into v_work;
     insert into public.khpos_meeting_actions(id,meeting_id,work_item_id) values((p_input->>'id')::uuid,v_id,v_work);
     end if;
    end if;
   elsif p_mode='status' then
    if p_input->>'status' not in ('live','closed','cancelled') then raise exception 'Invalid meeting status.' using errcode='22023'; end if;
    update public.khpos_meetings set status=p_input->>'status' where id=v_id;
   end if;
  end if;
  select jsonb_build_object('meeting',to_jsonb(m),'participants',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'name',coalesce(h.display_name,u.email),'is_hq',coalesce(h.status='active',false))) from public.khpos_meeting_participants p join auth.users u on u.id=p.user_id left join public.kaec_hq_members h on h.user_id=p.user_id where p.meeting_id=v_id),'[]'::jsonb),
   'messages',coalesce((select jsonb_agg(x order by x.created_at,x.id) from (select msg.*,coalesce(h.display_name,u.email) author_name from public.khpos_meeting_messages msg join auth.users u on u.id=msg.author_id left join public.kaec_hq_members h on h.user_id=msg.author_id where msg.meeting_id=v_id order by msg.created_at desc,msg.id desc limit 100) x),'[]'::jsonb),
   'decisions',coalesce((select jsonb_agg(x order by x.created_at) from (select id,body,created_at from public.khpos_meeting_decisions where meeting_id=v_id order by created_at desc limit 100) x),'[]'::jsonb),
   'actions',coalesce((select jsonb_agg(x order by x.due_at) from (select a.id,w.title,w.due_at,w.id work_item_id,w.status,u.email owner_name from public.khpos_meeting_actions a join public.khpos_ops_work_items w on w.id=a.work_item_id join public.khpos_ops_role_assignments ra on ra.id=w.owner_assignment_id join auth.users u on u.id=ra.user_id where a.meeting_id=v_id
    union all select a.id,w.title,(w.due_on::timestamp at time zone 'Africa/Lagos') due_at,w.id work_item_id,w.status,h.display_name owner_name
    from public.khpos_meeting_actions a join public.kaec_hq_records w on w.id=a.hq_record_id join public.kaec_hq_members h on h.user_id=w.owner_user_id where a.meeting_id=v_id order by due_at limit 100) x),'[]'::jsonb)) into v_room
   from public.khpos_meetings m where m.id=v_id;
 end if;
 if p_mode<>'list' then
  if p_org is null then
   insert into public.kaec_hq_audit_events(actor_user_id,action,summary,after_state)
   values(p_actor,'meeting_'||p_mode,'Private HQ meeting',jsonb_build_object('meetingId',v_id,'operation',p_mode));
  else
   insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
   values(p_org,p_actor,'meeting_'||p_mode,'meeting',v_id,jsonb_build_object('operation',p_mode));
  end if;
 end if;
 return jsonb_build_object('userId',p_actor,'canCreate',v_create,'room',v_room,
 'people',case when v_create and v_id is null and not coalesce((p_input->>'omitRoster')::boolean,false) then coalesce((select jsonb_agg(x order by x.name) from (
 select u.id,coalesce(h.display_name,u.email)||case when h.status='active' then ' · KAEC HQ' when p_org is null then ' · School leadership' else '' end name from auth.users u left join public.kaec_hq_members h on h.user_id=u.id
 where (p_org is null and khpos_private.hq_meeting_invitee(u.id)) or (p_org is not null and exists(select 1 from public.organisation_memberships om where om.user_id=u.id and om.organisation_id is not distinct from p_org and om.status='active')) or h.status='active' order by u.id limit 500) x),'[]'::jsonb) else '[]'::jsonb end,
 'meetings',coalesce((select jsonb_agg(x order by x.starts_at desc) from (select m.* from public.khpos_meetings m where organisation_id is not distinct from p_org and khpos_private.meeting_access(p_actor,m.id) order by starts_at desc limit 100) x),'[]'::jsonb));
end $$;
revoke all on function public.khpos_meetings_base_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_meetings_base_server(uuid,uuid,text,jsonb) to service_role;

