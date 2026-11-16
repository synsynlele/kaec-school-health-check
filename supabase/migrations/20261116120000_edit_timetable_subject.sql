-- Relink the weekly period to an approved subject stream. Class attendance
-- records retain their own stream IDs and the existing attendance lock applies.
do $migration$
declare source text; updated text;
begin
  source := pg_get_functiondef('public.khpos_ops_presence_action_server(uuid,uuid,text,jsonb)'::regprocedure);
  updated := replace(source,
    $old$      v_id:=v_period.stream_id;$old$,
    $new$      select * into v_stream from public.khpos_ops_academic_delivery_streams s
        where s.id=v_period.stream_id and s.organisation_id=p_org;
      if not found or not (
        khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
        or khpos_private.sectional_can_schedule(p_actor,p_org,v_stream.campus_id,v_stream.unit_id)
      ) then raise exception 'Only an authorised academic leader can edit this period.'; end if;
      v_id:=coalesce(nullif(p_input->>'streamId','')::uuid,v_period.stream_id);
      if v_id<>v_period.stream_id and not exists (
        select 1 from public.khpos_ops_academic_delivery_streams replacement
        where replacement.id=v_id and replacement.organisation_id=p_org
          and replacement.campus_id=v_stream.campus_id and replacement.term_id=v_stream.term_id
      ) then raise exception 'Choose a subject stream for the same campus and term.'; end if;$new$);
  if updated=source then raise exception 'Period stream selection hook not found'; end if;
  source:=updated;

  updated := replace(source,
    $old$update public.khpos_ops_class_periods set weekday=(p_input->>'weekday')::int,$old$,
    $new$update public.khpos_ops_class_periods set stream_id=v_stream.id, weekday=(p_input->>'weekday')::int,$new$);
  if updated=source then raise exception 'Period update hook not found'; end if;
  execute updated;
end;
$migration$;
