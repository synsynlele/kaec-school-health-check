-- Host-authorised deletion of closed, cancelled or time-ended meeting history.
-- Preserve assigned school/HQ work and the deletion audit trail.
create or replace function public.khpos_meetings_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,khpos_private,pg_temp as $$
declare v_result jsonb; v_parts jsonb:=coalesce(p_input->'callParts','[]'::jsonb); v_id uuid;
 v_meeting public.khpos_meetings%rowtype; v_part integer; v_count integer; v_minutes numeric;
begin
 if p_mode='delete' then
  v_id:=nullif(p_input->>'meetingId','')::uuid;
  select * into v_meeting from public.khpos_meetings
   where id=v_id and organisation_id is not distinct from p_org for update;
  if p_actor is null or v_meeting.id is null
   or not khpos_private.meeting_access(p_actor,v_id)
   or v_meeting.created_by<>p_actor
   or not khpos_private.meeting_can_host(p_actor,p_org) then
   raise exception 'Only the active meeting host can delete its history.' using errcode='42501';
  end if;
  if v_meeting.status not in ('closed','cancelled') and v_meeting.ends_at>clock_timestamp() then
   raise exception 'Close or cancel the meeting before deleting it.' using errcode='22023';
  end if;
  if p_input->'confirmed' is distinct from 'true'::jsonb then
   raise exception 'Confirm that you want to delete this meeting.' using errcode='22023';
  end if;
  -- Outcomes belong to the room; assigned work belongs to Today/HQ Work.
  -- Only the room-to-task links cascade, never the underlying work records.
  if p_org is null then
   insert into public.kaec_hq_audit_events(actor_user_id,action,summary,after_state)
   values(p_actor,'meeting_deleted','Private HQ meeting deleted',jsonb_build_object('meetingId',v_id));
  else
   insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
   values(p_org,p_actor,'meeting_deleted','meeting',v_id,jsonb_build_object('operation','delete'));
  end if;
  delete from public.khpos_meetings where id=v_id;
  v_result:=public.khpos_meetings_base_server(p_actor,p_org,'list',jsonb_build_object('omitRoster',true));
 elsif p_mode='create' then
  if jsonb_typeof(v_parts) is distinct from 'array' then raise exception 'Choose valid call parts.' using errcode='22023'; end if;
  if jsonb_array_length(v_parts)=0 and nullif(p_input->>'callUrl','') is not null then v_parts:=jsonb_build_array(p_input->>'callUrl'); end if;
  v_minutes:=extract(epoch from ((p_input->>'endsAt')::timestamptz-(p_input->>'startsAt')::timestamptz))/60;
  if v_minutes is null or v_minutes<=0 or v_minutes>360 then raise exception 'Choose a meeting length of up to six hours.' using errcode='22023'; end if;
  v_count:=ceil(v_minutes/60)::integer;
  if jsonb_array_length(v_parts)>0 then
   if jsonb_array_length(v_parts)<>v_count or exists(select 1 from jsonb_array_elements_text(v_parts) x(url)
   where url is null or url !~ '^https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}$')
   or (select count(distinct url) from jsonb_array_elements_text(v_parts) x(url))<>v_count then
    raise exception 'Prepare one different Google Meet joining link for each hour.' using errcode='22023'; end if;
  end if;
  v_result:=public.khpos_meetings_base_server(p_actor,p_org,p_mode,p_input||jsonb_build_object('callUrl',v_parts->>0));
  v_id:=(v_result#>>'{room,meeting,id}')::uuid;
  update public.khpos_meetings set call_parts=v_parts where id=v_id;
  v_result:=public.khpos_meetings_base_server(p_actor,p_org,'list',jsonb_build_object('meetingId',v_id));
 elsif p_mode='start_call' then
  v_id:=(p_input->>'meetingId')::uuid; v_part:=(p_input->>'part')::integer;
  select * into v_meeting from public.khpos_meetings where id=v_id and organisation_id=p_org for update;
  if v_meeting.id is null or not khpos_private.meeting_access(p_actor,v_id) or v_meeting.created_by<>p_actor
  or not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_can_manage_people(p_actor,p_org) then
   raise exception 'Only the active meeting host can start a call part.' using errcode='42501'; end if;
  if v_meeting.status in ('closed','cancelled') then raise exception 'This meeting is read-only.' using errcode='22023'; end if;
  if v_part is null or v_part<1 or v_part>jsonb_array_length(v_meeting.call_parts) then raise exception 'Prepare the call links first.' using errcode='22023'; end if;
  if v_part<>v_meeting.active_call_part then
   if v_part<>v_meeting.active_call_part+1 then raise exception 'Start the next call part in order. Refresh if another host tab moved it.' using errcode='22023'; end if;
   update public.khpos_meetings set active_call_part=v_part,call_part_started_at=clock_timestamp(),status='live' where id=v_id;
   insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
   values(p_org,p_actor,'meeting_call_started','meeting',v_id,jsonb_build_object('part',v_part));
  end if;
  v_result:=public.khpos_meetings_base_server(p_actor,p_org,'list',jsonb_build_object('meetingId',v_id));
 else
  v_result:=public.khpos_meetings_base_server(p_actor,p_org,p_mode,p_input);
 end if;
 return v_result||jsonb_build_object('serverNow',clock_timestamp());
end $$;
revoke all on function public.khpos_meetings_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_meetings_server(uuid,uuid,text,jsonb) to service_role;

