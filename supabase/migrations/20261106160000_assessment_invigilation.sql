create index khpos_school_plan_published_invigilation_idx
  on public.khpos_school_plan_entries (organisation_id, assessment_id, staff_id)
  where kind='invigilation' and published;

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
      select a.id,a.stream_id,a.kind,a.title,a.starts_at,a.ends_at,a.checked_in_at,a.checked_out_at,a.marked_at,a.submitted_at,
        case when a.teacher_user_id=p_actor or khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles) then a.submitted_to end as submitted_to,
        a.teacher_user_id=p_actor as mine,
        (a.checked_in_at is null and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles)) as can_edit, s.class_label,s.subject_label,
        coverage.names as invigilators,
        coverage.mine as my_invigilation,
        khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles) as can_manage_coverage,
        coalesce((select st.display_name from public.khpos_ops_staff st
          where st.organisation_id=p_org and st.user_id=a.teacher_user_id and st.status='active' limit 1),'Assigned teacher') as teacher
      from public.khpos_assessment_slots a
      join public.khpos_ops_academic_delivery_streams s on s.id=a.stream_id and s.organisation_id=p_org
      cross join lateral (
        select coalesce(jsonb_agg(distinct staff.display_name order by staff.display_name),'[]'::jsonb) as names,
          coalesce(bool_or(staff.user_id=p_actor),false) as mine
        from public.khpos_school_plan_entries e
        join public.khpos_ops_staff staff on staff.id=e.staff_id and staff.organisation_id=p_org and staff.status='active'
        where e.organisation_id=p_org and e.assessment_id=a.id and e.kind='invigilation' and e.published
      ) coverage
      where a.organisation_id=p_org and a.starts_at >= from_at and a.starts_at < from_at + interval '7 days'
        and (a.teacher_user_id=p_actor or coverage.mine or khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,leader_roles))
      order by a.starts_at limit 500
    ) x
  ),'[]'::jsonb);
end;
$$;


create function khpos_private.check_invigilation_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare scheduled public.khpos_assessment_slots;
begin
  if new.kind<>'invigilation' or not new.published then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('khpos-invigilation:' || new.organisation_id::text,0));
  select * into scheduled from public.khpos_assessment_slots a where a.id=new.assessment_id and a.organisation_id=new.organisation_id;
  if exists (
    select 1 from public.khpos_school_plan_entries other
    join public.khpos_assessment_slots a on a.id=other.assessment_id
    where other.organisation_id=new.organisation_id and other.kind='invigilation' and other.published
      and other.staff_id=new.staff_id and other.id<>new.id
      and a.starts_at<scheduled.ends_at and scheduled.starts_at<a.ends_at
  ) then
    raise exception 'This invigilator already has an assignment during this time.' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function khpos_private.check_invigilation_assignment() from public,anon,authenticated;
create trigger khpos_check_invigilation_assignment before insert or update of published,kind,staff_id,assessment_id
  on public.khpos_school_plan_entries for each row execute function khpos_private.check_invigilation_assignment();

create function khpos_private.check_invigilation_reschedule()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (new.starts_at,new.ends_at,new.stream_id) is not distinct from (old.starts_at,old.ends_at,old.stream_id) then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('khpos-invigilation:' || new.organisation_id::text,0));
  if new.stream_id<>old.stream_id and exists (
    select 1 from public.khpos_school_plan_entries assignment
    join public.khpos_ops_academic_delivery_streams destination on destination.id=new.stream_id
    where assignment.organisation_id=new.organisation_id and assignment.assessment_id=new.id and assignment.kind='invigilation' and assignment.published
      and assignment.campus_id is distinct from destination.campus_id
  ) then
    raise exception 'Remove the published invigilation assignments before moving this assessment to another campus.' using errcode='22023';
  end if;
  if exists (
    select 1 from public.khpos_school_plan_entries assignment
    join public.khpos_school_plan_entries other on other.organisation_id=assignment.organisation_id and other.staff_id=assignment.staff_id
    join public.khpos_assessment_slots a on a.id=other.assessment_id
    where assignment.organisation_id=new.organisation_id and assignment.assessment_id=new.id and assignment.kind='invigilation' and assignment.published
      and other.kind='invigilation' and other.published and other.assessment_id<>new.id
      and a.starts_at<new.ends_at and new.starts_at<a.ends_at
  ) then
    raise exception 'This time overlaps another assignment for an invigilator. Change the assignment or choose another time.' using errcode='22023';
  end if;
  if exists (
    select 1 from public.khpos_school_plan_entries assignment
    join public.khpos_school_plan_entries period on period.organisation_id=assignment.organisation_id
      and period.document_id=assignment.document_id and period.kind='exam_period' and period.published
    where assignment.organisation_id=new.organisation_id and assignment.assessment_id=new.id and assignment.kind='invigilation' and assignment.published
      and ((new.starts_at at time zone 'Africa/Lagos')::date<period.start_day or (new.ends_at at time zone 'Africa/Lagos')::date>period.end_day)
  ) then
    raise exception 'This time is outside the linked exam period. Update the exam period first.' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function khpos_private.check_invigilation_reschedule() from public,anon,authenticated;
create trigger khpos_check_invigilation_reschedule before update of starts_at,ends_at,stream_id
  on public.khpos_assessment_slots for each row execute function khpos_private.check_invigilation_reschedule();
