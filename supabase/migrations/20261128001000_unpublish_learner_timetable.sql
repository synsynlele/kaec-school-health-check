create function public.khpos_unpublish_learner_timetable_batch(
  p_actor uuid,p_school uuid,p_kind text,p_campus uuid,p_from date,p_to date
) returns integer language plpgsql security definer set search_path='' as $$
declare
  removed integer;
begin
  if not coalesce(khpos_private.ops_hpd_has_membership(p_actor,p_school),false) then
    raise exception 'Active school membership is required.' using errcode='42501';
  end if;
  if p_kind is null or p_kind not in ('lesson','assessment')
    or (p_kind='assessment' and (p_from is null or p_to is null or p_to-p_from not between 0 and 41)) then
    raise exception 'Choose a valid timetable and date range.' using errcode='22023';
  end if;

  delete from public.khpos_learner_timetable_publications pub
  using public.khpos_ops_academic_terms term, public.khpos_ops_academic_delivery_streams stream
  where pub.school_id=p_school and pub.kind=p_kind and (p_campus is null or pub.campus_id=p_campus)
    and term.id=pub.term_id and term.organisation_id=p_school
    and stream.organisation_id=p_school and stream.id=case p_kind
      when 'lesson' then (select l.stream_id from public.khpos_ops_class_periods l where l.id=pub.source_id and l.organisation_id=p_school)
      else (select a.stream_id from public.khpos_assessment_slots a where a.id=pub.source_id and a.organisation_id=p_school)
    end
    and ((p_kind='lesson' and term.status='active' and (now() at time zone 'Africa/Lagos')::date between term.start_date and term.end_date)
      or (p_kind='assessment'
        and (pub.details->>'startsAt')::timestamptz >= (p_from::timestamp at time zone 'Africa/Lagos')
        and (pub.details->>'startsAt')::timestamptz < ((p_to+1)::timestamp at time zone 'Africa/Lagos')))
    and (khpos_private.ops_presence_leader(p_actor,p_school,pub.campus_id,stream.unit_id,
      array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
      or khpos_private.sectional_can_schedule(p_actor,p_school,pub.campus_id,stream.unit_id));

  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.khpos_unpublish_learner_timetable_batch(uuid,uuid,text,uuid,date,date) from public,anon,authenticated;
grant execute on function public.khpos_unpublish_learner_timetable_batch(uuid,uuid,text,uuid,date,date) to service_role;
