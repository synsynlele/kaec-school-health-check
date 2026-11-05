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
  elsif p_mode in ('period_add','period_edit') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('khpos-weekly-timetable:' || p_org::text, 0));
    if p_mode='period_edit' then
      select * into v_period from public.khpos_ops_class_periods
        where id=(p_input->>'periodId')::uuid and organisation_id=p_org and is_active for update;
      if not found then raise exception 'Active scheduled lesson not found.'; end if;
      v_id:=v_period.stream_id;
    else
      v_id:=(p_input->>'streamId')::uuid;
    end if;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_id and s.organisation_id=p_org;
    if v_stream.id is null or v_stream.campus_id is null then raise exception 'Select a campus-scoped Academic Delivery stream.'; end if;
    if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
    then raise exception 'Only an authorised Guardian or Academic Inspector can schedule classes.'; end if;
    if v_stream.status not in ('approved','active') then raise exception 'Approve the Academic Delivery stream first.'; end if;
    if p_mode='period_edit' and exists (
      select 1 from public.khpos_ops_class_sessions x
      where x.period_id=v_period.id and (x.checked_out_at is null or x.local_day=v_day)
    ) then raise exception 'This lesson already has attendance today or an open session. Edit it after the session is closed and the school day ends.'; end if;
    v_school_time:=(p_input->>'start')::time;
    if (p_input->>'end')::time <= v_school_time then raise exception 'Class end must be after its start.'; end if;
    if exists(
      select 1 from public.khpos_ops_class_periods p
      join public.khpos_ops_academic_delivery_streams s on s.id=p.stream_id
      where p.organisation_id=p_org and p.is_active
        and p.id is distinct from v_period.id
        and p.weekday=(p_input->>'weekday')::int
        and exists(select 1 from public.khpos_ops_role_assignments aa join public.khpos_ops_role_assignments ab on ab.id=v_stream.teacher_assignment_id where aa.id=s.teacher_assignment_id and aa.user_id=ab.user_id)
        and p.starts_at < (p_input->>'end')::time and p.ends_at > v_school_time
    ) then raise exception 'This teacher already has an overlapping scheduled class.'; end if;
    if p_mode='period_edit' then
      update public.khpos_ops_class_periods set weekday=(p_input->>'weekday')::int,
        starts_at=v_school_time, ends_at=(p_input->>'end')::time,
        room_label=nullif(left(trim(coalesce(p_input->>'room','')),100),'')
        where id=v_period.id;
      v_id:=v_period.id;
    else
      insert into public.khpos_ops_class_periods(organisation_id,stream_id,weekday,starts_at,ends_at,room_label,created_by)
        values(p_org,v_id,(p_input->>'weekday')::int,v_school_time,(p_input->>'end')::time,
          nullif(left(trim(coalesce(p_input->>'room','')),100),''),p_actor)
      returning id into v_id;
    end if;
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
    select * into v_period from public.khpos_ops_class_periods p where p.id=v_id and p.organisation_id=p_org and p.is_active for update;
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

create or replace function public.khpos_assessment_timetable_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  slot public.khpos_assessment_slots;
  stream public.khpos_ops_academic_delivery_streams;
  teacher uuid;
  now_at timestamptz := clock_timestamp();
  from_at timestamptz := (p_input->>'from')::date::timestamp at time zone 'Africa/Lagos';
  leader_roles text[] := array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'];
begin
  if not coalesce(khpos_private.ops_hpd_has_membership(p_actor,p_org),false) then
    raise exception 'School membership required.' using errcode='42501';
  end if;
  if from_at is null then raise exception 'Select a timetable week.' using errcode='22023'; end if;
  if p_mode in ('add','edit') then
    if p_mode='edit' then
      select a.* into slot from public.khpos_assessment_slots a
        join public.khpos_ops_academic_delivery_streams old on old.id=a.stream_id
        where a.id=(p_input->>'id')::uuid and a.organisation_id=p_org
          and khpos_private.ops_presence_leader(p_actor,p_org,old.campus_id,old.unit_id,leader_roles)
        for update of a;
      if not found then raise exception 'Only academic leaders for this campus can edit this assessment.' using errcode='42501'; end if;
      if slot.checked_in_at is not null then
        raise exception 'This assessment already has attendance and its schedule is locked.' using errcode='22023';
      end if;
    end if;
    select * into stream from public.khpos_ops_academic_delivery_streams
      where id=(p_input->>'streamId')::uuid and organisation_id=p_org and status in ('approved','active');
    if not found or not khpos_private.ops_presence_leader(p_actor,p_org,stream.campus_id,stream.unit_id,leader_roles) then
      raise exception 'Only academic leaders for this campus can schedule assessments.' using errcode='42501';
    end if;
    select user_id into teacher from public.khpos_ops_role_assignments
      where id=stream.teacher_assignment_id and status='active';
    if teacher is null or not khpos_private.ops_hpd_has_membership(teacher,p_org) then
      raise exception 'Choose an active teaching assignment.' using errcode='22023';
    end if;
    if (p_input->>'endsAt')::timestamptz <= (p_input->>'startsAt')::timestamptz then
      raise exception 'Choose an end time after the start.' using errcode='22023';
    end if;
    if p_mode='edit' then
      update public.khpos_assessment_slots set stream_id=stream.id,teacher_user_id=teacher,
        kind=p_input->>'kind',title=btrim(p_input->>'title'),
        starts_at=(p_input->>'startsAt')::timestamptz,ends_at=(p_input->>'endsAt')::timestamptz
        where id=slot.id;
    else
      insert into public.khpos_assessment_slots(organisation_id,stream_id,teacher_user_id,kind,title,starts_at,ends_at)
      values(p_org,stream.id,teacher,p_input->>'kind',btrim(p_input->>'title'),
        (p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz);
    end if;
  elsif p_mode <> 'list' then
    select * into slot from public.khpos_assessment_slots
      where id=(p_input->>'id')::uuid and organisation_id=p_org and teacher_user_id=p_actor for update;
    if not found then raise exception 'Only the assigned teacher can record this assessment.' using errcode='42501'; end if;
    if p_mode='start' and slot.checked_in_at is null
      and now_at between slot.starts_at - interval '30 minutes' and slot.ends_at + interval '30 minutes' then
      update public.khpos_assessment_slots set checked_in_at=now_at where id=slot.id;
    elsif p_mode='finish' and slot.checked_in_at is not null and slot.checked_out_at is null then
      update public.khpos_assessment_slots set checked_out_at=now_at where id=slot.id;
    elsif p_mode='mark' and slot.checked_out_at is not null and slot.marked_at is null then
      update public.khpos_assessment_slots set marked_at=now_at where id=slot.id;
    elsif p_mode='submit' and slot.marked_at is not null and slot.submitted_at is null
      and length(btrim(coalesce(p_input->>'recipient',''))) between 1 and 120 then
      update public.khpos_assessment_slots set submitted_at=now_at, submitted_to=btrim(p_input->>'recipient') where id=slot.id;
    else
      raise exception 'This step is unavailable. Check the time and complete earlier steps first.' using errcode='22023';
    end if;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.starts_at)
    from (
      select a.id,a.stream_id,a.kind,a.title,a.starts_at,a.ends_at,a.checked_in_at,a.checked_out_at,a.marked_at,a.submitted_at,a.submitted_to,
        a.teacher_user_id=p_actor as mine,
        (a.checked_in_at is null and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles)) as can_edit, s.class_label,s.subject_label,
        coalesce((select st.display_name from public.khpos_ops_staff st
          where st.organisation_id=p_org and st.user_id=a.teacher_user_id and st.status='active' limit 1),'Assigned teacher') as teacher
      from public.khpos_assessment_slots a
      join public.khpos_ops_academic_delivery_streams s on s.id=a.stream_id and s.organisation_id=p_org
      where a.organisation_id=p_org and a.starts_at >= from_at and a.starts_at < from_at + interval '7 days'
        and (a.teacher_user_id=p_actor or khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles))
      order by a.starts_at limit 500
    ) x
  ),'[]'::jsonb);
end;
$$;
