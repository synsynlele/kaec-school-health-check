create function public.khpos_learner_register_history_server(actor uuid, school uuid, input jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  campus uuid := (input->>'campus')::uuid;
  from_day date := (input->>'from')::date;
  to_day date := (input->>'to')::date;
  today date := (now() at time zone 'Africa/Lagos')::date;
  page_size integer := coalesce((input->>'size')::integer,20);
  requested_page integer := coalesce((input->>'page')::integer,1);
  search_text text := lower(btrim(coalesce(input->>'search','')));
  sort_order text := coalesce(input->>'sort','name');
  guardian boolean;
  office boolean;
begin
  if from_day is null or to_day is null or from_day>to_day or to_day>today or to_day-from_day>92
    or page_size not in (10,20,50) or requested_page<1 or requested_page>100000 or length(search_text)>120
    or coalesce(length(input->>'class'),0) not between 1 and 200
    or sort_order not in ('name','name_desc','absent','late','attended') then
    raise exception 'Choose a valid class and a date range of up to 93 days.' using errcode='22023';
  end if;
  if not exists (select 1 from public.khpos_ops_campuses c where c.id=campus and c.organisation_id=school and c.status='active') then
    raise exception 'Access denied.' using errcode='42501';
  end if;
  guardian := khpos_private.learner_register_role(actor,school,campus,array['SCHOOL_GUARDIAN']);
  office := khpos_private.learner_register_role(actor,school,campus,array['SCHOOL_CARE_OPERATIONS_OFFICER','FINANCE_ADMIN_OFFICER']);

  return (
    with learners as materialized (
      select a.id,a.display_name name from public.khpos_ops_learner_anchors a
      where a.organisation_id=school and a.campus_id=campus and a.status='active'
        and lower(a.class_label)=lower(input->>'class')
        and lower(coalesce(a.section_label,''))=lower(coalesce(input->>'section',''))
        and (guardian or office or khpos_private.learner_register_class(actor,a))
        and strpos(lower(a.display_name),search_text)>0
    ), latest as (
      select distinct on (e.learner_id,e.school_day,e.phase) e.learner_id,e.school_day,e.phase,e.mark
      from public.khpos_learner_attendance_events e join learners l on l.id=e.learner_id
      where e.organisation_id=school and e.campus_id=campus and e.school_day between from_day and to_day
      order by e.learner_id,e.school_day,e.phase,e.id desc
    ), daily as (
      select learner_id,school_day,
        max(mark) filter (where phase='morning') morning,
        max(mark) filter (where phase='closing') closing,
        max(mark) filter (where phase='release') release
      from latest group by learner_id,school_day
    ), classified as (
      select *,case
        when morning='late' then 'late'
        when morning='present' or closing='present' or release is not null then 'present'
        when morning='absent' then 'absent'
      end mark from daily
    ), summary as (
      select l.id,l.name,
        count(*) filter (where d.mark in ('present','late')) attended,
        count(*) filter (where d.mark='late') late,
        count(*) filter (where d.mark='absent') absent,
        count(*) filter (where d.release='left_early') left_early,
        count(*) filter (where d.closing='unaccounted' and d.release is null) unaccounted,
        coalesce(jsonb_object_agg(d.school_day::text,jsonb_build_object(
          'mark',d.mark,'closing',d.closing,'release',d.release))
          filter (where d.school_day is not null),'{}'::jsonb) days
      from learners l left join classified d on d.learner_id=l.id group by l.id,l.name
    ), ranked as (
      select *,row_number() over (order by
        case when sort_order='absent' then absent end desc,
        case when sort_order='late' then late end desc,
        case when sort_order='attended' then attended end desc,
        case when sort_order='name_desc' then lower(name) end desc,
        lower(name),id) sequence
      from summary
    )
    select jsonb_build_object('total',(select count(*) from ranked),'rows',coalesce((
      select jsonb_agg(to_jsonb(r)-'sequence' order by r.sequence) from ranked r
      where r.sequence between ((requested_page-1)*page_size+1) and requested_page*page_size
    ),'[]'::jsonb))
  );
end
$$;

revoke all on function public.khpos_learner_register_history_server(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_learner_register_history_server(uuid,uuid,jsonb) to service_role;
