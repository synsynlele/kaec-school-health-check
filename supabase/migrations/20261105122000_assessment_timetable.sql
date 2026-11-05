create table public.khpos_assessment_slots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  stream_id uuid not null references public.khpos_ops_academic_delivery_streams(id),
  teacher_user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('test','assessment','exam')),
  title text not null check (length(btrim(title)) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  marked_at timestamptz,
  submitted_at timestamptz,
  submitted_to text,
  unique (stream_id, starts_at)
);
alter table public.khpos_assessment_slots enable row level security;
revoke all on public.khpos_assessment_slots from public, anon, authenticated;
grant select, insert, update on public.khpos_assessment_slots to service_role;
create index khpos_assessment_slots_school_start_idx on public.khpos_assessment_slots (organisation_id, starts_at);

create function public.khpos_assessment_timetable_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb)
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
  if p_mode='add' then
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
    insert into public.khpos_assessment_slots(organisation_id,stream_id,teacher_user_id,kind,title,starts_at,ends_at)
    values(p_org,stream.id,teacher,p_input->>'kind',btrim(p_input->>'title'),
      (p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz);
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
      select a.id,a.kind,a.title,a.starts_at,a.ends_at,a.checked_in_at,a.checked_out_at,a.marked_at,a.submitted_at,a.submitted_to,
        a.teacher_user_id=p_actor as mine, s.class_label,s.subject_label,
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
revoke all on function public.khpos_assessment_timetable_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_assessment_timetable_server(uuid,uuid,text,jsonb) to service_role;
