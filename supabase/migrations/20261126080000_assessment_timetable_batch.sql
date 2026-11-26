create function public.khpos_assessment_timetable_add_batch_server(p_actor uuid, p_org uuid, p_input jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare
  paper jsonb;
  schedule jsonb := p_input - 'papers';
begin
  if jsonb_typeof(p_input->'papers') is distinct from 'array' then
    raise exception 'Choose at least one class and subject.' using errcode='22023';
  end if;
  if jsonb_array_length(p_input->'papers') not between 1 and 30 then
    raise exception 'Choose between 1 and 30 class and subject assignments.' using errcode='22023';
  end if;
  for paper in select value from jsonb_array_elements(p_input->'papers') loop
    perform public.khpos_assessment_timetable_server(p_actor,p_org,'add',schedule ||
      jsonb_build_object('streamId',paper->>'streamId','title',paper->>'title'));
  end loop;
  return public.khpos_assessment_timetable_server(p_actor,p_org,'list',schedule);
end
$$;

revoke all on function public.khpos_assessment_timetable_add_batch_server(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_assessment_timetable_add_batch_server(uuid,uuid,jsonb) to service_role;
