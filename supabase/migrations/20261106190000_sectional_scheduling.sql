create function khpos_private.sectional_can_schedule(p_actor uuid,p_org uuid,p_campus uuid,p_unit uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor and a.status='active' and r.status='active'
      and r.organisation_id=p_org and r.code='SECTIONAL_PROMOTER'
      and a.unit_id=p_unit and (a.campus_id is null or a.campus_id=p_campus)
  );
$$;
revoke all on function khpos_private.sectional_can_schedule(uuid,uuid,uuid,uuid) from public,anon,authenticated;

do $migration$
declare
  source text;
  updated text;
begin
  source := pg_get_functiondef('public.khpos_ops_presence_action_server(uuid,uuid,text,jsonb)'::regprocedure);
  updated := replace(source,
    $old$if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
    then raise exception 'Only an authorised Guardian or Academic Inspector can schedule classes.';$old$,
    $new$if not (khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
      or khpos_private.sectional_can_schedule(p_actor,p_org,v_stream.campus_id,v_stream.unit_id))
    then raise exception 'Only an authorised academic leader can schedule classes for this section.';$new$);
  if updated=source then raise exception 'Weekly timetable permission check not found'; end if;
  execute updated;

  source := pg_get_functiondef('public.khpos_ops_presence_workspace_server(uuid,uuid)'::regprocedure);
  updated := replace(source, $old$'localDay',v_day,$old$, $new$'localDay',v_day,
    'sectionalScheduleStreamIds',coalesce((select jsonb_agg(s.id) from public.khpos_ops_academic_delivery_streams s
      where s.organisation_id=p_org and s.status in ('approved','active')
        and khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id)),'[]'::jsonb),$new$);
  if updated=source then raise exception 'Presence workspace response not found'; end if;
  execute updated;
end;
$migration$;

create or replace function public.khpos_assessment_timetable_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  slot public.khpos_assessment_slots;
  stream public.khpos_ops_academic_delivery_streams;
  teacher uuid;
  duty_id uuid;
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
          and (khpos_private.ops_presence_leader(p_actor,p_org,old.campus_id,old.unit_id,leader_roles) or khpos_private.sectional_can_schedule(p_actor,p_org,old.campus_id,old.unit_id))
        for update of a;
      if not found then raise exception 'Only academic leaders for this campus can edit this assessment.' using errcode='42501'; end if;
      if slot.checked_in_at is not null or exists (select 1 from public.khpos_school_plan_entries e where e.organisation_id=p_org and e.assessment_id=slot.id and e.invigilator_checked_in_at is not null) then
        raise exception 'This assessment already has attendance and its schedule is locked.' using errcode='22023';
      end if;
    end if;
    select * into stream from public.khpos_ops_academic_delivery_streams
      where id=(p_input->>'streamId')::uuid and organisation_id=p_org and status in ('approved','active');
    if not found or not (khpos_private.ops_presence_leader(p_actor,p_org,stream.campus_id,stream.unit_id,leader_roles) or khpos_private.sectional_can_schedule(p_actor,p_org,stream.campus_id,stream.unit_id)) then
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
  elsif p_mode in ('invigilator_start','invigilator_finish') then
    select a.* into slot from public.khpos_assessment_slots a
      where a.id=(p_input->>'id')::uuid and a.organisation_id=p_org for update;
    if not found then raise exception 'Assessment not found.' using errcode='42501'; end if;
    select e.id into duty_id from public.khpos_school_plan_entries e
      join public.khpos_ops_staff st on st.id=e.staff_id and st.organisation_id=p_org
      where e.organisation_id=p_org and e.assessment_id=slot.id and e.kind='invigilation'
        and st.user_id=p_actor and st.status='active'
        and ((p_mode='invigilator_start' and e.published and e.invigilator_checked_in_at is null)
          or (p_mode='invigilator_finish' and e.invigilator_checked_in_at is not null and e.invigilator_checked_out_at is null))
      order by e.id limit 1 for update of e;
    if duty_id is null then raise exception 'No eligible invigilation assignment was found.' using errcode='42501'; end if;
    if p_mode='invigilator_start' then
      if now_at not between slot.starts_at - interval '30 minutes' and slot.ends_at + interval '30 minutes' then
        raise exception 'Invigilator check-in opens 30 minutes before the assessment and closes 30 minutes after it ends.' using errcode='22023';
      end if;
      update public.khpos_school_plan_entries set invigilator_checked_in_at=now_at where id=duty_id;
    else
      if length(btrim(coalesce(p_input->>'note',''))) not between 1 and 2000 then
        raise exception 'Enter a short exam report or comment before checking out.' using errcode='22023';
      end if;
      update public.khpos_school_plan_entries set invigilator_checked_out_at=now_at, invigilator_report=btrim(p_input->>'note') where id=duty_id;
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
      select a.id,a.stream_id,a.kind,a.title,a.starts_at,a.ends_at,a.checked_in_at,a.checked_out_at,a.marked_at,a.submitted_at,
        case when a.teacher_user_id=p_actor or (khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles) or khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id)) then a.submitted_to end as submitted_to,
        a.teacher_user_id=p_actor as mine,
        (a.checked_in_at is null and (khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles) or khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id))) as can_edit, s.class_label,s.subject_label,
        coverage.names as invigilators,
        coverage.mine as my_invigilation,
        coverage.attendance as invigilation_attendance,
        (khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles) or khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id)) as can_manage_coverage,
        coalesce((select st.display_name from public.khpos_ops_staff st
          where st.organisation_id=p_org and st.user_id=a.teacher_user_id and st.status='active' limit 1),'Assigned teacher') as teacher
      from public.khpos_assessment_slots a
      join public.khpos_ops_academic_delivery_streams s on s.id=a.stream_id and s.organisation_id=p_org
      cross join lateral (
        select coalesce(jsonb_agg(distinct staff.display_name order by staff.display_name) filter (where e.published and staff.status='active'),'[]'::jsonb) as names,
          coalesce(bool_or(staff.user_id=p_actor),false) as mine,
          coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',staff.display_name,'mine',coalesce(staff.user_id=p_actor,false),
            'published',e.published,'in',e.invigilator_checked_in_at,'out',e.invigilator_checked_out_at,'note',e.invigilator_report) order by staff.display_name)
            filter (where staff.user_id=p_actor or (khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles) or khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id))),'[]'::jsonb) as attendance
        from public.khpos_school_plan_entries e
        join public.khpos_ops_staff staff on staff.id=e.staff_id and staff.organisation_id=p_org
        where e.organisation_id=p_org and e.assessment_id=a.id and e.kind='invigilation' and (e.published or e.invigilator_checked_in_at is not null)
      ) coverage
      where a.organisation_id=p_org and a.starts_at >= from_at and a.starts_at < from_at + interval '7 days'
        and (a.teacher_user_id=p_actor or coverage.mine or (khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles) or khpos_private.sectional_can_schedule(p_actor,p_org,s.campus_id,s.unit_id)))
      order by a.starts_at limit 500
    ) x
  ),'[]'::jsonb);
end;
$$;

create or replace function public.khpos_school_plan_server(p_actor uuid,p_org uuid,p_from date,p_to date,p_input jsonb default null,p_today boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  manage boolean;
  sectional_streams uuid[];
  sectional_campuses uuid[];
  can_invigilate boolean;
  whole_school boolean;
  managed_campuses uuid[];
  entry public.khpos_school_plan_entries;
  slot public.khpos_assessment_slots;
  action text := p_input->>'action';
  entry_id uuid := (p_input->>'id')::uuid;
  campus uuid := (p_input->>'campusId')::uuid;
  staff uuid := (p_input->>'staffId')::uuid;
  assessment uuid := (p_input->>'assessmentId')::uuid;
  first_day date := (p_input->>'startDay')::date;
  last_day date := (p_input->>'endDay')::date;
  entry_kind text := p_input->>'kind';
  today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not coalesce(khpos_private.ops_academic_has_membership(p_actor,p_org),false) then
    raise exception 'Active school membership required.' using errcode='42501';
  end if;
  whole_school := khpos_private.ops_presence_leader(p_actor,p_org,null,null,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN']);
  select array(select c.id from public.khpos_ops_campuses c
    where c.organisation_id=p_org and c.status='active'
      and (khpos_private.ops_presence_leader(p_actor,p_org,c.id,null,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN'])
        or exists(select 1 from public.khpos_ops_role_assignments a
          join public.khpos_ops_roles r on r.id=a.role_id
          where a.user_id=p_actor and a.status='active' and a.campus_id=c.id
            and r.organisation_id=p_org and r.status='active' and r.code='ACADEMIC_INSPECTOR')))
    into managed_campuses;
  manage := whole_school or cardinality(managed_campuses)>0;
  select coalesce(array_agg(st.id),'{}'::uuid[]),coalesce(array_agg(distinct st.campus_id),'{}'::uuid[])
  into sectional_streams,sectional_campuses
  from public.khpos_ops_academic_delivery_streams st
  where st.organisation_id=p_org and khpos_private.sectional_can_schedule(p_actor,p_org,st.campus_id,st.unit_id);
  can_invigilate := cardinality(sectional_streams)>0;
  if p_input is not null then
    if not (manage or can_invigilate) then raise exception 'Only an authorised school or campus leader can edit the calendar.' using errcode='42501'; end if;
    if action='rule' then
      if not whole_school then raise exception 'Only a school-wide leader can change recurring duty rules.' using errcode='42501'; end if;
      update public.khpos_ops_recurring_rules set calendar_day_mode=p_input->>'dayMode'
        where id=entry_id and organisation_id=p_org and status='active';
      if not found then raise exception 'Active recurring rule not found.' using errcode='22023'; end if;
      insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
        values(p_org,p_actor,'school_calendar_rule','recurring_rule',entry_id,jsonb_build_object('dayMode',p_input->>'dayMode'));
    else
    if entry_id is not null then
      select * into entry from public.khpos_school_plan_entries e where e.organisation_id=p_org and e.id=entry_id and e.deleted_at is null for update;
      if not found then raise exception 'Calendar entry not found.' using errcode='22023'; end if;
      if not whole_school and not coalesce(entry.campus_id=any(managed_campuses),false)
        and not (entry.kind='invigilation' and exists(select 1 from public.khpos_assessment_slots a
          where a.id=entry.assessment_id and a.organisation_id=p_org and a.stream_id=any(sectional_streams))) then
        raise exception 'You can only change entries for your assigned campus.' using errcode='42501';
      end if;
    end if;
    if action='remove' and entry.id is not null then
      update public.khpos_school_plan_entries set published=false where id=entry.id;
    elsif action='archive' and entry.id is not null then
      update public.khpos_school_plan_entries set archived_at=coalesce(archived_at,now()),published=false where id=entry.id;
    elsif action='restore' and entry.id is not null then
      update public.khpos_school_plan_entries set archived_at=null where id=entry.id;
    elsif action='delete' and entry.id is not null then
      if entry.published then raise exception 'Archive or unpublish this entry before deleting it.' using errcode='22023'; end if;
      update public.khpos_school_plan_entries set deleted_at=now() where id=entry.id;
    elsif action='save' then
      if entry.archived_at is not null then raise exception 'Restore this entry before editing it.' using errcode='22023'; end if;
      if entry_kind='invigilation' then
        select a.* into slot from public.khpos_assessment_slots a join public.khpos_ops_academic_delivery_streams st on st.id=a.stream_id
      where a.organisation_id=p_org and (whole_school or st.campus_id=any(managed_campuses) or st.id=any(sectional_streams)) and a.id=assessment;
        if not found then raise exception 'Choose an exam or test in this school.' using errcode='22023'; end if;
        select s.campus_id into campus from public.khpos_ops_academic_delivery_streams s where s.id=slot.stream_id and s.organisation_id=p_org;
        first_day := (slot.starts_at at time zone 'Africa/Lagos')::date;
        last_day := (slot.ends_at at time zone 'Africa/Lagos')::date;
      end if;
      if not whole_school and not coalesce(campus=any(managed_campuses),false)
        and not (entry_kind='invigilation' and coalesce(slot.stream_id=any(sectional_streams),false)) then
        raise exception 'Choose a campus you manage.' using errcode='42501';
      end if;
      if first_day is null or last_day is null or last_day<first_day or last_day-first_day>366
        or (entry_kind in ('weekly_theme','weekly_duty') and (extract(isodow from first_day)<>1 or last_day<>first_day+6))
        or (entry_kind='daily_topic' and first_day<>last_day) then
        raise exception 'Check the dates. Weekly entries run Monday to Sunday, and daily topics use one date.' using errcode='22023';
      end if;
      if campus is not null and not exists(select 1 from public.khpos_ops_campuses c where c.id=campus and c.organisation_id=p_org and c.status='active') then
        raise exception 'Choose an active campus in this school.' using errcode='22023';
      end if;
      if staff is not null and not exists(select 1 from public.khpos_ops_staff s
        where s.id=staff and s.organisation_id=p_org and s.status='active'
          and (campus is null or s.campus_id is null or s.campus_id=campus)) then
        raise exception 'Choose active staff from the selected campus.' using errcode='22023';
      end if;
      if entry.id is null then
        insert into public.khpos_school_plan_entries(organisation_id,campus_id,kind,title,start_day,end_day,staff_id,assessment_id,published,document_id)
          values(p_org,campus,entry_kind,btrim(p_input->>'title'),first_day,last_day,staff,assessment,(p_input->>'published')::boolean,(p_input->>'documentId')::uuid)
          returning id into entry_id;
      else
        update public.khpos_school_plan_entries set campus_id=campus,kind=entry_kind,title=btrim(p_input->>'title'),
          start_day=first_day,end_day=last_day,staff_id=staff,assessment_id=assessment,published=(p_input->>'published')::boolean
          where id=entry_id;
      end if;
    else raise exception 'Unknown calendar action.' using errcode='22023';
    end if;
    insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
      values(p_org,p_actor,'school_calendar_' || action,'calendar_entry',entry_id,
        jsonb_build_object('previous',to_jsonb(entry),'current',(select to_jsonb(e) from public.khpos_school_plan_entries e where e.id=entry_id)));
    end if;
    if p_input ? 'documentId' or p_input ? 'skipResult' then return '{}'::jsonb; end if;
  end if;
  return jsonb_build_object(
    'canManage',manage and not p_today,
    'canManageInvigilation',(manage or can_invigilate) and not p_today,
    'canManageWholeSchool',whole_school and not p_today,
    'entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.start_day,x.title) from (
      select e.id,e.kind,e.title,e.campus_id,e.staff_id,e.assessment_id,e.published,e.document_id,e.archived_at,
        (not p_today and (whole_school or coalesce(e.campus_id=any(managed_campuses),false) or coalesce(e.kind='invigilation' and a.stream_id=any(sectional_streams),false))) as can_edit,
        coalesce((a.starts_at at time zone 'Africa/Lagos')::date,e.start_day) as start_day,
        coalesce((a.ends_at at time zone 'Africa/Lagos')::date,e.end_day) as end_day,
        s.display_name as staff_name,c.name as campus_name,a.starts_at as assessment_start,a.title as assessment_title
      from public.khpos_school_plan_entries e
      left join public.khpos_assessment_slots a on a.id=e.assessment_id and a.organisation_id=p_org
      left join public.khpos_ops_staff s on s.id=e.staff_id and s.organisation_id=p_org
      left join public.khpos_ops_campuses c on c.id=e.campus_id and c.organisation_id=p_org
      where e.organisation_id=p_org and e.deleted_at is null and (e.published or (not p_today and (whole_school or e.campus_id=any(managed_campuses) or (e.kind='invigilation' and a.stream_id=any(sectional_streams)))))
        and coalesce((a.starts_at at time zone 'Africa/Lagos')::date,e.start_day)<=p_to
        and coalesce((a.ends_at at time zone 'Africa/Lagos')::date,e.end_day)>=p_from
        and (not p_today or ((e.staff_id is null or s.user_id=p_actor)
          and (e.campus_id is null or exists(select 1 from public.khpos_ops_staff self
            where self.organisation_id=p_org and self.user_id=p_actor and self.campus_id=e.campus_id and self.status='active'))))
        and (not p_today or e.kind<>'weekly_duty' or not khpos_private.school_plan_blocks(p_org,coalesce(e.campus_id,s.campus_id),today,false))
      order by e.start_day,e.title limit 250
    ) x),'[]'::jsonb),
    'campuses',case when manage and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)
      from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active' and (whole_school or c.id=any(managed_campuses))),'[]'::jsonb) else '[]'::jsonb end,
    'staff',case when (manage or can_invigilate) and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.display_name) order by s.display_name)
      from public.khpos_ops_staff s where s.organisation_id=p_org and s.status='active' and (whole_school or s.campus_id is null or s.campus_id=any(managed_campuses) or s.campus_id=any(sectional_campuses))),'[]'::jsonb) else '[]'::jsonb end,
    'assessments',case when (manage or can_invigilate) and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.title,'start',a.starts_at) order by a.starts_at)
      from public.khpos_assessment_slots a join public.khpos_ops_academic_delivery_streams st on st.id=a.stream_id
      where a.organisation_id=p_org and (whole_school or st.campus_id=any(managed_campuses) or st.id=any(sectional_streams))
        and (a.starts_at at time zone 'Africa/Lagos')::date between p_from and p_to),'[]'::jsonb) else '[]'::jsonb end,
    'rules',case when whole_school and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.title,'mode',r.calendar_day_mode) order by r.title)
      from public.khpos_ops_recurring_rules r where r.organisation_id=p_org and r.status='active'),'[]'::jsonb) else '[]'::jsonb end,
    'terms',case when p_today then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.term_name,'session',t.session_label,'start',t.start_date,'end',t.end_date) order by t.start_date)
      from public.khpos_ops_academic_terms t where t.organisation_id=p_org and t.status='active' and t.start_date<=p_to and t.end_date>=p_from),'[]'::jsonb) end
  );
end;
$$;
