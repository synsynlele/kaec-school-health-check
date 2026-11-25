alter table public.khpos_teacher_attendance_policies
  add column escalation_time time not null default '10:00';

create or replace function public.khpos_teacher_attendance_server(actor uuid, school uuid, action text, input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  campus uuid := nullif(input->>'campus','')::uuid;
  staff uuid := nullif(input->>'staff','')::uuid;
  attendance_day date := (now() at time zone 'Africa/Lagos')::date;
  workdays_input smallint[];
begin
  if action in ('list','alerts','self') then
    return coalesce((
      select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'policy',to_jsonb(p),'teachers',roster.teachers) order by c.name)
      from public.khpos_ops_campuses c
      left join public.khpos_teacher_attendance_policies p on p.campus_id=c.id
      cross join lateral (
        select coalesce(jsonb_agg(entry order by entry->>'name'),'[]'::jsonb) teachers
        from (
          select jsonb_build_object('id',s.id,'name',s.display_name,
            'workdays',o.workdays,'reportingTime',o.reporting_time,
            'arrival',presence.checked_in_at,'due',case when action='alerts' then cutoff.escalate_at else cutoff.due end,
            'lateMinutes',case when presence.checked_in_at > cutoff.due then
              ceil(extract(epoch from (presence.checked_in_at-cutoff.start_at))/60)::integer end,
            'status',case
              when presence.checked_in_at is not null then case when presence.checked_in_at>cutoff.due and expected.on_campus then 'late' else 'signed_in' end
              when review.outcome='present' then 'present'
              when not expected.on_campus then 'off_duty'
              when review.outcome='absent' then 'absent'
              when now()>=cutoff.due then 'missing'
              else 'expected' end) entry
          from public.khpos_ops_staff s
          left join public.khpos_teacher_attendance_overrides o on o.campus_id=c.id and o.staff_id=s.id
          left join public.khpos_teacher_attendance_reviews review on review.campus_id=c.id and review.staff_id=s.id and review.school_day=attendance_day
          left join public.khpos_ops_staff_day_presence presence on presence.organisation_id=school and presence.staff_id=s.id and presence.local_day=(now() at time zone 'Africa/Lagos')::date
          cross join lateral (select ((attendance_day+coalesce(o.reporting_time,p.reporting_time)) at time zone 'Africa/Lagos') start_at) report
          cross join lateral (select report.start_at,report.start_at+make_interval(mins=>p.grace_minutes) due,
            greatest(report.start_at+make_interval(mins=>p.grace_minutes),
              (attendance_day+p.escalation_time) at time zone 'Africa/Lagos') escalate_at) cutoff
          cross join lateral (select coalesce(extract(isodow from attendance_day)::smallint=any(coalesce(o.workdays,p.workdays)),false)
            and not exists (select 1 from public.khpos_school_plan_entries cal
              where cal.organisation_id=school and (cal.campus_id is null or cal.campus_id=c.id)
                and cal.kind='closure' and cal.published and cal.archived_at is null and cal.deleted_at is null
                and attendance_day between cal.start_day and cal.end_day)
            and not exists (select 1 from public.khpos_ops_staff_availability_cases absence_case
              where absence_case.organisation_id=school and absence_case.staff_id=s.id and absence_case.status in ('approved','active','returned','closed')
                and (absence_case.case_type='planned_leave' or absence_case.reason_category='official_duty')
                and absence_case.start_at<=cutoff.start_at and coalesce(least(absence_case.end_at,absence_case.actual_return_at),absence_case.end_at)>cutoff.start_at) on_campus) expected
          where s.organisation_id=school and s.campus_id=c.id and s.status in ('ready','active')
            and (action<>'self' or s.user_id=actor)
            and s.start_date<=attendance_day
            and khpos_private.learner_register_role(s.user_id,school,c.id,array['TEACHER'])
        ) evaluated
        where action='list' or (action='self' and entry->>'status'='late')
          or (action='alerts' and entry->>'status' in ('missing','absent') and now()>=(entry->>'due')::timestamptz)
      ) roster
      where c.organisation_id=school and c.status='active'
        and ((action='self' and c.id=campus) or
          (action<>'self' and khpos_private.learner_register_role(actor,school,c.id,array['SCHOOL_GUARDIAN'])))
        and (action='list' or jsonb_array_length(roster.teachers)>0)
    ),'[]'::jsonb);
  end if;

  if not exists (select 1 from public.khpos_ops_campuses c where c.id=campus and c.organisation_id=school and c.status='active')
     or not khpos_private.learner_register_role(actor,school,campus,array['SCHOOL_GUARDIAN']) then
    raise exception 'Access denied.' using errcode='42501';
  end if;

  if input ? 'workdays' and jsonb_typeof(input->'workdays')='array' then
    select array(select distinct value::smallint from jsonb_array_elements_text(input->'workdays')) into workdays_input;
  end if;
  if action='policy' then
    insert into public.khpos_teacher_attendance_policies(campus_id,workdays,reporting_time,grace_minutes,escalation_time)
      values(campus,workdays_input,(input->>'time')::time,(input->>'grace')::integer,coalesce(nullif(input->>'escalationTime','')::time,
        (select p.escalation_time from public.khpos_teacher_attendance_policies p where p.campus_id=campus),time '10:00'))
      on conflict(campus_id) do update set workdays=excluded.workdays,reporting_time=excluded.reporting_time,grace_minutes=excluded.grace_minutes,escalation_time=excluded.escalation_time;
    return '{}'::jsonb;
  end if;
  if not exists (select 1 from public.khpos_ops_staff s where s.id=staff and s.organisation_id=school and s.campus_id=campus
    and s.status in ('ready','active') and khpos_private.learner_register_role(s.user_id,school,campus,array['TEACHER'])) then
    raise exception 'Choose an active campus teacher.' using errcode='22023';
  end if;
  if action='override' then
    insert into public.khpos_teacher_attendance_overrides(campus_id,staff_id,workdays,reporting_time)
      values(campus,staff,workdays_input,nullif(input->>'time','')::time)
      on conflict(campus_id,staff_id) do update set workdays=excluded.workdays,reporting_time=excluded.reporting_time;
  elsif action='review' then
    if input->>'day' is distinct from attendance_day::text then
      raise exception 'Refresh the attendance review for today.' using errcode='22023';
    end if;
    if input->>'outcome' <> 'clear' and not exists (
      select 1 from jsonb_array_elements(public.khpos_teacher_attendance_server(actor,school,'list','{}')) c
      cross join lateral jsonb_array_elements(c->'teachers') t
      where c->>'id'=campus::text and t->>'id'=staff::text
        and t->>'status' in ('missing','absent','present')
    ) then raise exception 'Review a teacher with an unresolved sign-in.' using errcode='22023'; end if;
    insert into public.khpos_teacher_attendance_reviews(campus_id,staff_id,school_day,outcome,reason,recorded_by)
      values(campus,staff,attendance_day,input->>'outcome',btrim(input->>'reason'),actor)
      on conflict(campus_id,staff_id,school_day) do update
      set outcome=excluded.outcome,reason=excluded.reason,recorded_by=excluded.recorded_by,recorded_at=now();
  else
    raise exception 'Invalid action.' using errcode='22023';
  end if;
  return '{}'::jsonb;
end
$$;
