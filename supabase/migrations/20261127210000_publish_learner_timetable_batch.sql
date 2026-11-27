-- Publish a timetable in one transaction with the same scope as single-entry publication.
create function public.khpos_publish_learner_timetable_batch(
  p_actor uuid,p_school uuid,p_kind text,p_campus uuid,p_from date,p_to date
) returns integer language plpgsql security definer set search_path='' as $$
declare
  entry_id uuid;
  published_count integer := 0;
begin
  if not coalesce(khpos_private.ops_hpd_has_membership(p_actor,p_school),false) then
    raise exception 'Active school membership is required.' using errcode='42501';
  end if;

  if p_kind is null or p_kind not in ('lesson','assessment')
    or (p_kind='assessment' and (p_from is null or p_to is null or p_to-p_from not between 0 and 41)) then
    raise exception 'Choose a valid timetable and date range.' using errcode='22023';
  end if;

  for entry_id in
    select schedules.id
    from (
      select l.id,l.stream_id
      from public.khpos_ops_class_periods l
      where p_kind='lesson' and l.organisation_id=p_school and l.is_active
        and l.teaching_group_kind is distinct from 'custom'
      union all
      select a.id,a.stream_id
      from public.khpos_assessment_slots a
      where p_kind='assessment' and a.organisation_id=p_school and a.cancelled_at is null
        and a.starts_at >= (p_from::timestamp at time zone 'Africa/Lagos')
        and a.starts_at < ((p_to+1)::timestamp at time zone 'Africa/Lagos')
    ) schedules
    join public.khpos_ops_academic_delivery_streams s on s.id=schedules.stream_id and s.organisation_id=p_school
    join public.khpos_ops_academic_terms t on t.id=s.term_id and t.organisation_id=p_school
    where s.status in ('active','approved') and s.campus_id is not null
      and (p_campus is null or s.campus_id=p_campus)
      and t.status<>'cancelled'
      and (p_kind='assessment' or (t.status='active' and s.status='active'
        and (now() at time zone 'Africa/Lagos')::date between t.start_date and t.end_date))
      and (khpos_private.ops_presence_leader(p_actor,p_school,s.campus_id,s.unit_id,
        array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
        or khpos_private.sectional_can_schedule(p_actor,p_school,s.campus_id,s.unit_id))
    order by schedules.id
  loop
    perform public.khpos_publish_learner_timetable(p_actor,p_school,p_kind,entry_id);
    published_count := published_count+1;
  end loop;

  if published_count=0 then
    raise exception 'There are no timetable entries you can publish in this selection.' using errcode='22023';
  end if;
  return published_count;
end
$$;

revoke all on function public.khpos_publish_learner_timetable_batch(uuid,uuid,text,uuid,date,date) from public,anon,authenticated;
grant execute on function public.khpos_publish_learner_timetable_batch(uuid,uuid,text,uuid,date,date) to service_role;
