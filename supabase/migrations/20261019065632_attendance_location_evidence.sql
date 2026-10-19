-- Point-in-time attendance evidence only. Existing records remain NULL (not captured).
alter table public.khpos_ops_campuses add column attendance_location jsonb;
alter table public.khpos_ops_staff_day_presence add column check_in_location jsonb, add column check_out_location jsonb;
alter table public.kaec_hq_pathfinder_sessions add column campus_id uuid references public.khpos_ops_campuses(id), add column check_in_location jsonb, add column check_out_location jsonb;
create index kaec_pathfinder_sessions_campus_idx on public.kaec_hq_pathfinder_sessions(campus_id) where campus_id is not null;

create function khpos_private.attendance_location(p_input jsonb,p_campus uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 cfg jsonb; v jsonb; st text; lat double precision; lon double precision; acc double precision;
 captured timestamptz; received timestamptz:=clock_timestamp(); distance_m double precision;
 radius_m double precision; a double precision; reason text;
begin
 if p_input is null or p_input='null'::jsonb then return jsonb_build_object('status','not_recorded','receivedAt',received); end if;
 if jsonb_typeof(p_input)<>'object' then raise exception 'Invalid attendance location.'; end if;
 st:=p_input->>'status'; reason:=btrim(coalesce(p_input->>'reason',''));
 if length(reason)>500 then raise exception 'Location explanation must be at most 500 characters.'; end if;
 if st in ('denied','unavailable','timeout','unsupported') then
  if length(reason)<5 then raise exception 'Explain the unavailable location in at least 5 characters.'; end if;
  return jsonb_build_object('status',st,'reason',reason,'receivedAt',received);
 end if;
 if st is distinct from 'captured' or jsonb_typeof(p_input->'latitude') is distinct from 'number'
 or jsonb_typeof(p_input->'longitude') is distinct from 'number' or jsonb_typeof(p_input->'accuracy') is distinct from 'number'
 then raise exception 'Provide valid location coordinates and accuracy.'; end if;
 lat:=(p_input->>'latitude')::double precision; lon:=(p_input->>'longitude')::double precision; acc:=(p_input->>'accuracy')::double precision;
 if not (lat between -90 and 90 and lon between -180 and 180 and acc between 0 and 100000) then raise exception 'Location coordinates or accuracy are outside the allowed range.'; end if;
 captured:=(p_input->>'capturedAt')::timestamptz;
 if captured is null then raise exception 'Location capture time is required.'; end if;
 select attendance_location into cfg from public.khpos_ops_campuses where id=p_campus;
 v:=jsonb_build_object('latitude',lat,'longitude',lon,'accuracy',acc,'capturedAt',captured,'receivedAt',received,'reason',reason);
 if cfg is not null then
  radius_m:=(cfg->>'radius')::double precision;
  a:=power(sin(radians(lat-(cfg->>'latitude')::double precision)/2),2)
    +cos(radians(lat))*cos(radians((cfg->>'latitude')::double precision))*power(sin(radians(lon-(cfg->>'longitude')::double precision)/2),2);
  distance_m:=6371000*2*asin(sqrt(least(1,greatest(0,a))));
  v:=v||jsonb_build_object('campus',cfg-'updatedBy','distance',round(distance_m::numeric,1),'radius',radius_m);
 end if;
 st:=case when captured<received-interval '2 minutes' or captured>received+interval '30 seconds' then 'stale'
 when acc>100 then 'poor_accuracy' when cfg is null then 'campus_unset'
 when distance_m+acc<=radius_m then 'within_boundary'
 when distance_m-acc>radius_m then 'outside_boundary' else 'boundary_uncertain' end;
 return v||jsonb_build_object('status',st);
end $$;
revoke all on function khpos_private.attendance_location(jsonb,uuid) from public,anon,authenticated;

-- Callable only from server code after the existing Pathfinder scope check.
create function public.khpos_attendance_location_evaluate_server(p_input jsonb,p_campus uuid) returns jsonb
language sql security definer set search_path='' as $$ select khpos_private.attendance_location(p_input,p_campus); $$;
revoke all on function public.khpos_attendance_location_evaluate_server(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.khpos_attendance_location_evaluate_server(jsonb,uuid) to service_role;

create function khpos_private.attendance_hq_scope(p_actor uuid,p_school uuid,p_manage boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.kaec_hq_members m join public.kaec_hq_school_engagements e on e.organisation_id=p_school
 join public.organisations o on o.id=p_school
 where m.user_id=p_actor and m.status='active' and e.engagement_status='active'
 and o.status='active' and o.partner_status='active' and 'khpos_core'=any(o.partner_entitlements)
 and (m.role in ('vision_custodian','alliance_catalyst') or (not p_manage and
 (m.role='system_steward' or (m.role='school_pathfinder' and e.representative_user_id=p_actor)))));
$$;
revoke all on function khpos_private.attendance_hq_scope(uuid,uuid,boolean) from public,anon,authenticated;

create function public.khpos_attendance_campuses_server(p_actor uuid,p_school uuid,p_hq boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_hq then
  if not khpos_private.attendance_hq_scope(p_actor,p_school,false) then raise exception 'School is outside your authorised HQ scope.'; end if;
 elsif not khpos_private.ops_academic_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.';
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'location',c.attendance_location-'updatedBy',
 'canManage',case when p_hq then khpos_private.attendance_hq_scope(p_actor,p_school,true)
 else khpos_private.announcements_publish_scope(p_actor,p_school,c.id,null) end) order by c.name)
 from public.khpos_ops_campuses c where c.organisation_id=p_school and c.status='active' and (p_hq or
 exists(select 1 from public.khpos_ops_staff s where s.organisation_id=p_school and s.user_id=p_actor and s.status='active' and s.campus_id=c.id)
 or exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
 where a.user_id=p_actor and a.status='active' and r.status='active' and r.organisation_id=p_school and (a.campus_id is null or a.campus_id=c.id)))), '[]'::jsonb);
end $$;

create function public.khpos_attendance_campus_save_server(p_actor uuid,p_school uuid,p_hq boolean,p_input jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare c public.khpos_ops_campuses%rowtype; cfg jsonb; lat double precision; lon double precision; rad integer;
begin
 if p_hq then
  if not khpos_private.attendance_hq_scope(p_actor,p_school,true) then raise exception 'Only an authorised HQ supervisor may configure this school.'; end if;
 elsif not khpos_private.ops_academic_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.';
 end if;
 select * into c from public.khpos_ops_campuses where id=(p_input->>'campusId')::uuid and organisation_id=p_school and status='active' for update;
 if not found then raise exception 'Active campus not found in this school.'; end if;
 if not p_hq and not khpos_private.announcements_publish_scope(p_actor,p_school,c.id,null) then raise exception 'Only the authorised Custodian or campus Guardian may set a campus location.'; end if;
 if (p_input->>'updatedAt') is distinct from (c.attendance_location->>'updatedAt') then raise exception 'Campus location changed. Refresh before saving.'; end if;
 if length(btrim(coalesce(p_input->>'reason',''))) not between 5 and 500 then raise exception 'Explain this campus pin change in 5–500 characters.'; end if;
 if jsonb_typeof(p_input->'latitude') is distinct from 'number' or jsonb_typeof(p_input->'longitude') is distinct from 'number'
 or jsonb_typeof(p_input->'radius') is distinct from 'number' then raise exception 'Provide valid campus coordinates and radius.'; end if;
 lat:=(p_input->>'latitude')::double precision; lon:=(p_input->>'longitude')::double precision; rad:=(p_input->>'radius')::integer;
 if not (lat between -90 and 90 and lon between -180 and 180 and rad between 50 and 1000) then raise exception 'Use valid coordinates and a boundary of 50–1000 metres.'; end if;
 cfg:=jsonb_build_object('latitude',lat,'longitude',lon,'radius',rad,'updatedAt',clock_timestamp(),'updatedBy',p_actor);
 update public.khpos_ops_campuses set attendance_location=cfg where id=c.id;
 -- Campus pin audit contains no staff GPS evidence.
 insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
 values(p_school,p_actor,'attendance_campus_location_saved','campus',c.id,jsonb_build_object('before',c.attendance_location,'after',cfg,'reason',p_input->>'reason'));
end $$;
revoke all on function public.khpos_attendance_campuses_server(uuid,uuid,boolean),public.khpos_attendance_campus_save_server(uuid,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_attendance_campuses_server(uuid,uuid,boolean),public.khpos_attendance_campus_save_server(uuid,uuid,boolean,jsonb) to service_role;

create function khpos_private.pathfinder_campus_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.campus_id is not null and not exists(select 1 from public.khpos_ops_campuses c join public.kaec_hq_school_engagements e on e.organisation_id=c.organisation_id
 where c.id=new.campus_id and e.id=new.engagement_id and c.status='active') then raise exception 'Pathfinder campus must belong to the scheduled school.'; end if;
 if tg_op='UPDATE' and old.check_in_at is not null and new.campus_id is distinct from old.campus_id then raise exception 'An arrived visit cannot change campus.'; end if;
 return new;
end $$;
revoke all on function khpos_private.pathfinder_campus_guard() from public,anon,authenticated;
create trigger kaec_pathfinder_campus_guard before insert or update of campus_id on public.kaec_hq_pathfinder_sessions for each row execute function khpos_private.pathfinder_campus_guard();

-- Preserve the existing attendance authority and lifecycle; attach scoped evidence.
CREATE OR REPLACE FUNCTION public.khpos_ops_presence_action_server(p_actor uuid, p_org uuid, p_mode text, p_input jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_staff public.khpos_ops_staff%rowtype;
  v_campus uuid; v_day date:=(clock_timestamp() at time zone 'Africa/Lagos')::date;
  v_now timestamptz:=clock_timestamp(); v_presence public.khpos_ops_staff_day_presence%rowtype;
  v_period public.khpos_ops_class_periods%rowtype; v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_term public.khpos_ops_academic_terms%rowtype; v_session public.khpos_ops_class_sessions%rowtype;
  v_teacher uuid; v_id uuid; v_domains jsonb; v_domain jsonb; v_code text;
  v_score integer; v_total integer:=0; v_count integer:=0; v_failure boolean:=false;
  v_codes text[]:=array['awakening','exploration','micro_illumination','first_trial','full_illumination','second_trial','integration','teacher_role_fidelity'];
  v_seen text[]:='{}'::text[]; v_mode text; v_band text; v_action text; v_observation uuid; v_assignment uuid; v_school_time time;
begin
  if not khpos_private.ops_academic_has_membership(p_actor,p_org) then
    raise exception 'Active school membership and KHP-OS partnership are required.';
  end if;
  select * into v_staff from public.khpos_ops_staff st where st.organisation_id=p_org and st.user_id=p_actor and st.status='active' limit 1;

  -- Production pilot must be deliberately enabled by the school's custodian.
  if p_mode='pilot_enable' then
    if not exists(select 1 from public.khpos_ops_role_assignments a
      join public.khpos_ops_roles r on r.id=a.role_id
      where a.user_id=p_actor and a.status='active' and r.status='active'
        and r.organisation_id=p_org and r.code='SCHOOL_CUSTODIAN' and a.campus_id is null)
    then raise exception 'Only the school-level Custodian may activate this pilot.'; end if;
    if jsonb_typeof(p_input->'enabled')<>'boolean' then raise exception 'Pilot activation requires explicit confirmation.'; end if;
    insert into public.khpos_ops_teaching_pilot_settings(organisation_id,enabled,updated_by)
      values(p_org,(p_input->>'enabled')::boolean,p_actor)
    on conflict(organisation_id) do update
      set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=clock_timestamp();
    return jsonb_build_object('ok',true);
  end if;
  if not coalesce((select enabled from public.khpos_ops_teaching_pilot_settings where organisation_id=p_org),false)
  then raise exception 'School Attendance pilot is disabled. Your School Custodian must activate it.'; end if;

  if p_mode='school_in' then
    if v_staff.id is null then raise exception 'An active staff identity is required.'; end if;
    v_campus:=(p_input->>'campusId')::uuid;
    if not exists(select 1 from public.khpos_ops_campuses c where c.id=v_campus and c.organisation_id=p_org and c.status='active')
       or not (v_staff.campus_id=v_campus or exists(
          select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
          where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.status='active'
            and (a.campus_id=v_campus or a.campus_id is null)))
    then raise exception 'Select your authorised active school campus.'; end if;
    if exists(select 1 from public.khpos_ops_staff_day_presence d
      where d.organisation_id=p_org and d.staff_id=v_staff.id and d.local_day=v_day)
    then raise exception 'School check-in is already recorded for today.'; end if;
    insert into public.khpos_ops_staff_day_presence(organisation_id,campus_id,staff_id,local_day,checked_in_at,check_in_location)
    values(p_org,v_campus,v_staff.id,v_day,v_now,khpos_private.attendance_location(p_input->'location',v_campus));
  elsif p_mode='school_out' then
    if v_staff.id is null then raise exception 'An active staff identity is required.'; end if;
    if exists(select 1 from public.khpos_ops_class_sessions x where x.teacher_user_id=p_actor and x.checked_out_at is null and x.local_day=v_day)
    then raise exception 'Finish the active class before leaving school.'; end if;
    update public.khpos_ops_staff_day_presence d set checked_out_at=v_now,check_out_location=khpos_private.attendance_location(p_input->'location',d.campus_id)
    where d.organisation_id=p_org and d.staff_id=v_staff.id and d.local_day=v_day and d.checked_out_at is null;
    if not found then raise exception 'There is no open school attendance today.'; end if;
  elsif p_mode='period_add' then
    v_id:=(p_input->>'streamId')::uuid;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_id and s.organisation_id=p_org;
    if v_stream.id is null or v_stream.campus_id is null then raise exception 'Select a campus-scoped Academic Delivery stream.'; end if;
    if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
    then raise exception 'Only an authorised Guardian or Academic Inspector can schedule classes.'; end if;
    if v_stream.status not in ('approved','active') then raise exception 'Approve the Academic Delivery stream first.'; end if;
    v_school_time:=(p_input->>'start')::time;
    if (p_input->>'end')::time <= v_school_time then raise exception 'Class end must be after its start.'; end if;
    if exists(
      select 1 from public.khpos_ops_class_periods p
      join public.khpos_ops_academic_delivery_streams s on s.id=p.stream_id
      where p.organisation_id=p_org and p.is_active
        and p.weekday=(p_input->>'weekday')::int
        and exists(select 1 from public.khpos_ops_role_assignments aa join public.khpos_ops_role_assignments ab on ab.id=v_stream.teacher_assignment_id where aa.id=s.teacher_assignment_id and aa.user_id=ab.user_id)
        and p.starts_at < (p_input->>'end')::time and p.ends_at > v_school_time
    ) then raise exception 'This teacher already has an overlapping scheduled class.'; end if;
    insert into public.khpos_ops_class_periods(organisation_id,stream_id,weekday,starts_at,ends_at,room_label,created_by)
      values(p_org,v_id,(p_input->>'weekday')::int,v_school_time,(p_input->>'end')::time,
        nullif(left(trim(coalesce(p_input->>'room','')),100),''),p_actor)
    returning id into v_id;
  elsif p_mode='period_disable' then
    v_id:=(p_input->>'periodId')::uuid;
    select * into v_period from public.khpos_ops_class_periods p where p.id=v_id and p.organisation_id=p_org;
    if v_period.id is null then raise exception 'Scheduled lesson not found.'; end if;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_period.stream_id;
    if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
    then raise exception 'Not permitted to alter this timetable.'; end if;
    if exists(select 1 from public.khpos_ops_class_sessions x where x.period_id=v_id and x.checked_out_at is null)
    then raise exception 'Reconcile the open class session before disabling this period.'; end if;
    update public.khpos_ops_class_periods set is_active=false where id=v_id;
  elsif p_mode in ('class_in','class_out') then
    v_id:=(p_input->>'periodId')::uuid;
    select * into v_period from public.khpos_ops_class_periods p where p.id=v_id and p.organisation_id=p_org and p.is_active;
    if v_period.id is null then raise exception 'Active scheduled lesson not found.'; end if;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_period.stream_id and s.organisation_id=p_org;
    select * into v_term from public.khpos_ops_academic_terms t where t.id=v_stream.term_id;
    select a.user_id into v_teacher from public.khpos_ops_role_assignments a
      where a.id=v_stream.teacher_assignment_id and a.status='active';
    if v_teacher is distinct from p_actor then raise exception 'Only the assigned active subject teacher can check into this class.'; end if;
    if v_term.status<>'active' or v_stream.status<>'active' or v_day not between v_term.start_date and v_term.end_date
      then raise exception 'The Academic Delivery stream and term must be active today.'; end if;
    if extract(isodow from (v_now at time zone 'Africa/Lagos'))::integer<>v_period.weekday
      then raise exception 'This class is not scheduled for today.'; end if;
    select * into v_presence from public.khpos_ops_staff_day_presence d
      where d.organisation_id=p_org and d.staff_id=v_staff.id and d.local_day=v_day and d.checked_out_at is null;
    if v_presence.id is null or v_presence.campus_id is distinct from v_stream.campus_id then
      raise exception 'Check into the correct school campus before teaching.'; end if;
    if p_mode='class_in' then
      if v_now < ((v_day+v_period.starts_at) at time zone 'Africa/Lagos')-interval '30 minutes'
        or v_now > ((v_day+v_period.ends_at) at time zone 'Africa/Lagos')+interval '30 minutes'
      then raise exception 'Class check-in opens 30 minutes before its start and closes 30 minutes after its end.'; end if;
      insert into public.khpos_ops_class_sessions(organisation_id,period_id,stream_id,teacher_user_id,local_day,checked_in_at)
        values(p_org,v_period.id,v_stream.id,p_actor,v_day,v_now);
    else
      select * into v_session from public.khpos_ops_class_sessions x
        where x.period_id=v_period.id and x.local_day=v_day and x.teacher_user_id=p_actor and x.checked_out_at is null;
      if v_session.id is null then raise exception 'You do not have an open class session for this period.'; end if;
      if p_input->>'outcome' not in ('completed','partial','not_held') then raise exception 'Select the lesson outcome.'; end if;
      if p_input->>'outcome' in ('completed','partial') and length(trim(coalesce(p_input->>'topic','')))<3
      then raise exception 'Record the topic actually taught.'; end if;
      update public.khpos_ops_class_sessions set checked_out_at=v_now,outcome=p_input->>'outcome',
        topic_taught=nullif(left(trim(coalesce(p_input->>'topic','')),200),''),
        follow_up=nullif(left(trim(coalesce(p_input->>'followUp','')),1000),'')
      where id=v_session.id;
    end if;
  elsif p_mode='hqls_enable' then
    if not khpos_private.ops_presence_leader(p_actor,p_org,null,null,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN'])
      and not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
       where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.status='active'
       and r.code=any(array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN']))
    then raise exception 'Only the School Custodian or Guardian may activate HQLS fidelity observations.'; end if;
    if jsonb_typeof(p_input->'enabled')<>'boolean' then raise exception 'HQLS activation must be explicit.'; end if;
    insert into public.khpos_ops_hqls_school_settings(organisation_id,enabled,updated_by)
      values(p_org,(p_input->>'enabled')::boolean,p_actor)
    on conflict(organisation_id) do update
      set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=clock_timestamp();
  elsif p_mode='hqls_create' then
    if not coalesce((select enabled from public.khpos_ops_hqls_school_settings where organisation_id=p_org),false)
    then raise exception 'HQLS fidelity observations have not been activated for this school.'; end if;
    v_id:=(p_input->>'streamId')::uuid;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_id and s.organisation_id=p_org;
    if v_stream.id is null or v_stream.status<>'active' then raise exception 'An active Academic Delivery stream is required for observation.'; end if;
    if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER'])
      then raise exception 'Only an authorised instructional leader may observe this class.'; end if;
    select a.user_id,a.id into v_teacher,v_assignment from public.khpos_ops_role_assignments a where a.id=v_stream.teacher_assignment_id and a.status='active';
    if v_teacher is null or v_teacher=p_actor then raise exception 'Observations require an active teacher and independent observer.'; end if;
    v_mode:=p_input->>'observationMode';
    if v_mode not in ('full','walk') then raise exception 'Choose full observation or quick learning walk.'; end if;
    if exists(select 1 from public.khpos_ops_hqls_fidelity_observations x
      where x.organisation_id=p_org and x.request_key=(p_input->>'requestKey')::uuid
        and x.observer_user_id=p_actor and x.stream_id=v_stream.id)
    then return jsonb_build_object('ok',true,'duplicate',true); end if;
    v_domains:=p_input->'domains';
    if jsonb_typeof(v_domains)<>'array' or jsonb_array_length(v_domains)<1 or jsonb_array_length(v_domains)>8
    then raise exception 'Provide valid HQLS stage evidence.'; end if;
    for v_domain in select value from jsonb_array_elements(v_domains) loop
      v_code:=v_domain->>'code';
      if v_code is null or not (v_code=any(v_codes)) or (v_code=any(v_seen)) then raise exception 'Invalid or repeated HQLS domain.'; end if;
      v_seen:=array_append(v_seen,v_code);
      if jsonb_typeof(v_domain->'score')<>'number' or v_domain->>'score' not in ('1','2','3')
        then raise exception 'Each observed domain needs a Strong (3), Partial (2), or Weak (1) score.'; end if;
      if length(trim(coalesce(v_domain->>'evidence','')))<12 then raise exception 'Each scored domain requires specific observed evidence (at least 12 characters).'; end if;
      v_score:=(v_domain->>'score')::integer;
      v_total:=v_total+v_score; v_count:=v_count+1;
      if coalesce((v_domain->>'automaticFailure')::boolean,false) then
        if v_score=3 then raise exception 'Strong (3) conflicts with an automatic failure in the same domain.'; end if;
        if not v_code=any(array['awakening','exploration','micro_illumination','first_trial','full_illumination','integration'])
        then raise exception 'The original rubric defines no automatic failure for this stage.'; end if;
        v_failure:=true;
      end if;
    end loop;
    if v_mode='full' and (v_count<>8 or not (v_seen @> v_codes))
    then raise exception 'Full fidelity scoring requires evidence for all eight HQLS domains.'; end if;
    if length(trim(coalesce(p_input->>'strengths','')))<8 then raise exception 'Record the observed instructional strengths.'; end if;
    if v_mode='full' then
      v_band:=case when v_total>=22 then 'model' when v_total>=17 then 'developing' else 'violation' end;
    else v_total:=null;v_band:=null;end if;
    v_action:=nullif(left(trim(coalesce(p_input->>'coachingAction','')),800),'');
    if (v_failure or v_band in ('developing','violation')) and v_action is null
    then v_action:='HQLS developmental coaching and repeat observation required'; end if;
    if p_input ? 'classSessionId' and nullif(p_input->>'classSessionId','') is not null
    then
      if not exists(select 1 from public.khpos_ops_class_sessions x
          where x.id=(p_input->>'classSessionId')::uuid and x.stream_id=v_stream.id and x.organisation_id=p_org)
      then raise exception 'The class session does not belong to this stream.'; end if;
    end if;
    insert into public.khpos_ops_hqls_fidelity_observations(
      organisation_id,stream_id,class_session_id,observer_user_id,teacher_user_id,
      observation_mode,request_key,domains,total_score,fidelity_band,automatic_failure,
      strengths,improvement_area,coaching_action,coaching_due_date
    ) values(p_org,v_stream.id,nullif(p_input->>'classSessionId','')::uuid,p_actor,v_teacher,
      v_mode,(p_input->>'requestKey')::uuid,v_domains,v_total,v_band,v_failure,left(trim(p_input->>'strengths'),1000),
      nullif(left(trim(coalesce(p_input->>'improvement','')),1000),''),
      v_action,coalesce(nullif(p_input->>'coachingDue','')::date, case when v_action is not null then v_day+7 else null end))
    returning id into v_observation;
    if v_action is not null then
      insert into public.khpos_ops_work_items(organisation_id,campus_id,unit_id,owner_assignment_id,
         occurrence_key,title,description,status,priority,due_at,evidence_required,verification_required,created_by)
      values(p_org,v_stream.campus_id,v_stream.unit_id,v_assignment,'hqls:'||v_observation::text,
        case when v_band='violation' then 'HQLS retraining and coaching' else 'HQLS coaching follow-up' end,
        v_action,'pending',case when v_band='violation' or v_failure then 'high' else 'standard' end,
        (coalesce(nullif(p_input->>'coachingDue','')::date,v_day+7)::timestamp at time zone 'Africa/Lagos') + interval '17 hours',
        false,true,p_actor)
      returning id into v_id;
      update public.khpos_ops_hqls_fidelity_observations set coaching_work_id=v_id where id=v_observation;
    end if;
  elsif p_mode='school_reconcile' then
    v_id:=(p_input->>'presenceId')::uuid;
    if length(trim(coalesce(p_input->>'reason','')))<15 then raise exception 'Record the reason and evidence for administrative school closure.'; end if;
    select * into v_presence from public.khpos_ops_staff_day_presence d where d.id=v_id and d.organisation_id=p_org and d.checked_out_at is null;
    if v_presence.id is null then raise exception 'Open school attendance not found.'; end if;
    if not khpos_private.ops_presence_leader(p_actor,p_org,v_presence.campus_id,null,array['SCHOOL_GUARDIAN'])
    then raise exception 'Only the authorised School Guardian may reconcile school check-outs.'; end if;
    if exists(select 1 from public.khpos_ops_class_sessions x
      join public.khpos_ops_staff st on st.user_id=x.teacher_user_id and st.organisation_id=p_org
      where st.id=v_presence.staff_id and x.local_day=v_presence.local_day and x.checked_out_at is null)
    then raise exception 'Reconcile the open subject lesson before closing school attendance.'; end if;
    update public.khpos_ops_staff_day_presence
      set checked_out_at=v_now,closed_by=p_actor,close_reason=left(trim(p_input->>'reason'),1000)
      where id=v_id;
  elsif p_mode='class_reconcile' then
    v_id:=(p_input->>'classSessionId')::uuid;
    if length(trim(coalesce(p_input->>'reason','')))<15 then raise exception 'Record the reason and evidence for administrative lesson closure.'; end if;
    select * into v_session from public.khpos_ops_class_sessions x where x.id=v_id and x.organisation_id=p_org and x.checked_out_at is null;
    if v_session.id is null then raise exception 'Open class session not found.'; end if;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_session.stream_id and s.organisation_id=p_org;
    if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
    then raise exception 'Only an authorised Guardian or Academic Inspector may reconcile a class session.'; end if;
    update public.khpos_ops_class_sessions set checked_out_at=v_now,outcome='unverified',
      follow_up='Administratively closed. Actual teaching outcome requires separate verification.',
      closed_by=p_actor,close_reason=left(trim(p_input->>'reason'),1000)
      where id=v_id;
  elsif p_mode='hqls_acknowledge' then
    v_id:=(p_input->>'observationId')::uuid;
    if length(trim(coalesce(p_input->>'teacherResponse','')))<5 then raise exception 'Please record your professional reflection.'; end if;
    update public.khpos_ops_hqls_fidelity_observations x set teacher_response=left(trim(p_input->>'teacherResponse'),1500),
      teacher_acknowledged_at=v_now
      where x.id=v_id and x.organisation_id=p_org and x.teacher_user_id=p_actor and x.teacher_acknowledged_at is null;
    if not found then raise exception 'Only the observed teacher may acknowledge an unacknowledged observation.'; end if;
  else raise exception 'Unsupported school attendance or observation action.';
  end if;
  return jsonb_build_object('ok',true);
end;
$function$;


-- Preserve the existing attendance authority and lifecycle; attach scoped evidence.
CREATE OR REPLACE FUNCTION public.khpos_ops_presence_history_server(p_actor uuid, p_org uuid, p_from date, p_to date, p_page integer DEFAULT 0, p_page_size integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_day date := (clock_timestamp() at time zone 'Africa/Lagos')::date;
  v_from date := coalesce(p_from,v_day-29);
  v_to date := coalesce(p_to,v_day);
  v_offset integer;
  v_school jsonb;
  v_class jsonb;
  v_school_count integer;
  v_class_count integer;
  v_scope text[] := array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'];
begin
  if not khpos_private.ops_academic_has_membership(p_actor,p_org) then
    raise exception 'Active school membership and partnership are required.';
  end if;
  if not exists (
    select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor and a.status='active' and r.status='active'
      and r.organisation_id=p_org and r.code=any(v_scope)
  ) then
    raise exception 'Only authorised school leaders can view attendance history.';
  end if;
  if v_from>v_to or v_to>v_day or v_to-v_from>365 then
    raise exception 'Select a valid historical period of no more than 366 days, ending no later than today.';
  end if;
  if p_page is null or p_page<0 or p_page>10000 or p_page_size not between 1 and 100 then
    raise exception 'Invalid attendance history page.';
  end if;
  v_offset := p_page*p_page_size;

  select count(*) into v_school_count
  from public.khpos_ops_staff_day_presence d
  where d.organisation_id=p_org and d.local_day between v_from and v_to
    and khpos_private.ops_presence_leader(p_actor,p_org,d.campus_id,null,v_scope);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'name',x.name,'campusId',x.campus_id,'date',x.local_day,
    'in',x.checked_in_at,'out',x.checked_out_at,'checkInLocation',x.check_in_location,'checkOutLocation',x.check_out_location,
    'administrativelyClosed',x.closed_by is not null
  ) order by x.local_day desc,x.checked_in_at desc,x.id),'[]'::jsonb)
  into v_school from (
    select d.id,d.campus_id,d.local_day,d.checked_in_at,d.checked_out_at,d.closed_by,d.check_in_location,d.check_out_location,
      coalesce(st.display_name,'Staff') as name
    from public.khpos_ops_staff_day_presence d
    join public.khpos_ops_staff st on st.id=d.staff_id and st.organisation_id=p_org
    where d.organisation_id=p_org and d.local_day between v_from and v_to
      and khpos_private.ops_presence_leader(p_actor,p_org,d.campus_id,null,v_scope)
    order by d.local_day desc,d.checked_in_at desc,d.id
    limit p_page_size offset v_offset
  ) x;

  select count(*) into v_class_count
  from public.khpos_ops_class_sessions c
  join public.khpos_ops_academic_delivery_streams s on s.id=c.stream_id
    and s.organisation_id=p_org
  where c.organisation_id=p_org and c.local_day between v_from and v_to
    and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_scope);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'date',x.local_day,'teacher',x.teacher,'class',x.class_label,
    'subject',x.subject_label,'in',x.checked_in_at,'out',x.checked_out_at,
    'outcome',x.outcome,'topic',x.topic_taught,
    'administrativelyClosed',x.closed_by is not null
  ) order by x.local_day desc,x.checked_in_at desc,x.id),'[]'::jsonb)
  into v_class from (
    select c.id,c.local_day,c.checked_in_at,c.checked_out_at,c.outcome,c.topic_taught,
      c.closed_by,s.class_label,s.subject_label,
      coalesce(st.display_name,'Assigned teacher') as teacher
    from public.khpos_ops_class_sessions c
    join public.khpos_ops_academic_delivery_streams s on s.id=c.stream_id
      and s.organisation_id=p_org
    left join public.khpos_ops_staff st on st.organisation_id=p_org
      and st.user_id=c.teacher_user_id and st.status='active'
    where c.organisation_id=p_org and c.local_day between v_from and v_to
      and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_scope)
    order by c.local_day desc,c.checked_in_at desc,c.id
    limit p_page_size offset v_offset
  ) x;

  return jsonb_build_object(
    'from',v_from,'to',v_to,'page',p_page,'pageSize',p_page_size,
    'schoolTotal',v_school_count,'classTotal',v_class_count,
    'schoolRecords',v_school,'classRecords',v_class
  );
end;
$function$;


-- Preserve the existing attendance authority and lifecycle; attach scoped evidence.
CREATE OR REPLACE FUNCTION public.khpos_ops_presence_workspace_server(p_actor uuid, p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_staff public.khpos_ops_staff%rowtype;
  v_day date:= (clock_timestamp() at time zone 'Africa/Lagos')::date;
  v_role_codes text[]:=array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER'];
begin
  if not khpos_private.ops_academic_has_membership(p_actor,p_org) then
    raise exception 'Active school membership and KHP-OS partnership are required.';
  end if;
  select * into v_staff from public.khpos_ops_staff st
   where st.organisation_id=p_org and st.user_id=p_actor and st.status='active' limit 1;
  return jsonb_build_object(
    'localDay',v_day,
    'staff',case when v_staff.id is null then null else jsonb_build_object('id',v_staff.id,'name',v_staff.display_name,'campusId',v_staff.campus_id) end,
    'canManage',exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.status='active' and r.code=any(array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])),
    'userId',p_actor,
    'pilotEnabled',coalesce((select enabled from public.khpos_ops_teaching_pilot_settings where organisation_id=p_org),false),
    'canEnablePilot',exists(select 1 from public.khpos_ops_role_assignments a
      join public.khpos_ops_roles r on r.id=a.role_id
      where a.user_id=p_actor and a.status='active' and r.status='active'
      and r.organisation_id=p_org and r.code='SCHOOL_CUSTODIAN' and a.campus_id is null),
    'hqlsEnabled',coalesce((select enabled from public.khpos_ops_hqls_school_settings where organisation_id=p_org),false),
    'canEnableHqls',exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.status='active' and r.code=any(array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN'])),
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)
      from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active'
      and (c.id=v_staff.campus_id or exists(
        select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
        where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.status='active'
          and (a.campus_id=c.id or a.campus_id is null)
      ))),'[]'::jsonb),
    'todayPresence',(select jsonb_build_object('id',d.id,'campusId',d.campus_id,'in',d.checked_in_at,'out',d.checked_out_at,'checkInLocation',d.check_in_location,'checkOutLocation',d.check_out_location,'administrativelyClosed',d.closed_by is not null)
      from public.khpos_ops_staff_day_presence d where d.organisation_id=p_org and d.staff_id=v_staff.id and d.local_day=v_day),
    'periods',coalesce((select jsonb_agg(jsonb_build_object(
       'id',p.id,'streamId',s.id,'weekday',p.weekday,'start',to_char(p.starts_at,'HH24:MI'),'end',to_char(p.ends_at,'HH24:MI'),
       'room',p.room_label,'campusId',s.campus_id,'class',s.class_label,'subject',s.subject_label,
       'teacher',coalesce(st.display_name,'Assigned teacher'),'teacherUserId',a.user_id,
       'termActive',t.status='active' and s.status='active',
       'session', (select jsonb_build_object('id',ses.id,'in',ses.checked_in_at,'out',ses.checked_out_at,'outcome',ses.outcome,'topic',ses.topic_taught,'administrativelyClosed',ses.closed_by is not null)
          from public.khpos_ops_class_sessions ses where ses.period_id=p.id and ses.local_day=v_day)
      ) order by p.weekday,p.starts_at,s.class_label)
      from public.khpos_ops_class_periods p
      join public.khpos_ops_academic_delivery_streams s on s.id=p.stream_id and s.organisation_id=p_org
      join public.khpos_ops_academic_terms t on t.id=s.term_id
      join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
      left join public.khpos_ops_staff st on st.organisation_id=p_org and st.user_id=a.user_id and st.status='active'
      where p.organisation_id=p_org and p.is_active and t.end_date>=v_day and t.status<>'cancelled'
      and (a.user_id=p_actor or khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_role_codes))
    ),'[]'::jsonb),
    'observations',coalesce((select jsonb_agg(jsonb_build_object(
       'id',o.id,'streamId',o.stream_id,'teacherUserId',o.teacher_user_id,'mode',o.observation_mode,
       'domains',o.domains,'total',o.total_score,'band',o.fidelity_band,'automaticFailure',o.automatic_failure,
       'strengths',o.strengths,'improvement',o.improvement_area,'coaching',o.coaching_action,'due',o.coaching_due_date,
       'teacherResponse',o.teacher_response,'acknowledgedAt',o.teacher_acknowledged_at,'observedAt',o.observed_at,
       'coachingWorkId',o.coaching_work_id
     ) order by o.observed_at desc)
     from (select * from public.khpos_ops_hqls_fidelity_observations x
       where x.organisation_id=p_org and (x.teacher_user_id=p_actor or x.observer_user_id=p_actor
         or exists(select 1 from public.khpos_ops_academic_delivery_streams s where s.id=x.stream_id
           and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_role_codes)))
       order by x.observed_at desc limit 35) o),'[]'::jsonb),
    'openClassSessions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',x.id,'date',x.local_day,'class',s.class_label,'subject',s.subject_label,'teacher',coalesce(st.display_name,'Teacher'),
      'in',x.checked_in_at
    ) order by x.local_day desc,x.checked_in_at desc)
    from public.khpos_ops_class_sessions x
    join public.khpos_ops_academic_delivery_streams s on s.id=x.stream_id and s.organisation_id=p_org
    left join public.khpos_ops_staff st on st.user_id=x.teacher_user_id and st.organisation_id=p_org
    where x.organisation_id=p_org and x.checked_out_at is null
      and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
    ),'[]'::jsonb),
    'openSchoolAttendance',coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'date',d.local_day,'teacher',st.display_name,'in',d.checked_in_at,'campusId',d.campus_id
    ) order by d.local_day desc,d.checked_in_at desc)
    from public.khpos_ops_staff_day_presence d join public.khpos_ops_staff st on st.id=d.staff_id
    where d.organisation_id=p_org and d.checked_out_at is null and d.local_day>=v_day-14
      and khpos_private.ops_presence_leader(p_actor,p_org,d.campus_id,null,array['SCHOOL_GUARDIAN'])
    ),'[]'::jsonb),
    'teamPresence',coalesce((select jsonb_agg(jsonb_build_object(
       'name',st.display_name,'campusId',d.campus_id,'in',d.checked_in_at,'out',d.checked_out_at,'checkInLocation',d.check_in_location,'checkOutLocation',d.check_out_location,'administrativelyClosed',d.closed_by is not null
     ) order by d.checked_in_at desc)
     from public.khpos_ops_staff_day_presence d
     join public.khpos_ops_staff st on st.id=d.staff_id and st.organisation_id=p_org
     where d.organisation_id=p_org and d.local_day=v_day
       and khpos_private.ops_presence_leader(p_actor,p_org,d.campus_id,null,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
     ),'[]'::jsonb)
  );
end;
$function$;


revoke execute on function public.khpos_ops_presence_action_server(uuid,uuid,text,jsonb),public.khpos_ops_presence_workspace_server(uuid,uuid),public.khpos_ops_presence_history_server(uuid,uuid,date,date,integer,integer) from public,anon,authenticated;
grant execute on function public.khpos_ops_presence_action_server(uuid,uuid,text,jsonb),public.khpos_ops_presence_workspace_server(uuid,uuid),public.khpos_ops_presence_history_server(uuid,uuid,date,date,integer,integer) to service_role;
