-- Filtered, category-specific attendance history for a compact leadership overview.
-- Read-only; attendance capture, historical rows, role policies and original RPC stay unchanged.
create function public.khpos_ops_presence_history_filtered_server(
  p_actor uuid, p_org uuid, p_from date, p_to date,
  p_category text, p_query text, p_sort text, p_page integer, p_page_size integer
) returns jsonb language plpgsql security definer
set search_path='' as $$
declare
  v_day date := (clock_timestamp() at time zone 'Africa/Lagos')::date;
  v_search text := lower(trim(coalesce(p_query,'')));
  v_offset integer;
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_scope text[] := array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'];
begin
  if not khpos_private.ops_academic_has_membership(p_actor,p_org) then
    raise exception 'Active school membership and partnership are required.';
  end if;
  if not exists (
    select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor and a.status='active' and r.status='active'
      and r.organisation_id=p_org and r.code=any(v_scope)
  ) then
    raise exception 'Only authorised school leaders can view attendance history.';
  end if;
  if p_from is null or p_to is null or p_from>p_to or p_to>v_day or p_to-p_from>365 then
    raise exception 'Select a valid historical period of no more than 366 days, ending no later than today.';
  end if;
  if p_category not in ('school','class') or p_category is null
    or p_sort not in ('newest','oldest','name') or p_sort is null
    or p_page is null or p_page<0 or p_page>10000 or p_page_size not in (20,50)
    or length(v_search)>120 then
    raise exception 'Invalid attendance history filter or page.';
  end if;
  v_offset := p_page*p_page_size;

  if p_category='school' then
    select count(*) into v_total
    from public.khpos_ops_staff_day_presence d
    join public.khpos_ops_staff st on st.id=d.staff_id and st.organisation_id=p_org
    where d.organisation_id=p_org and d.local_day between p_from and p_to
      and khpos_private.ops_presence_leader(p_actor,p_org,d.campus_id,null,v_scope)
      and (v_search='' or position(v_search in lower(concat_ws(' ',
        coalesce(st.display_name,'Staff'), d.local_day::text, d.checked_in_at::text,
        d.checked_out_at::text)))>0);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'name',x.name,'campusId',x.campus_id,'date',x.local_day,
      'in',x.checked_in_at,'out',x.checked_out_at,
      'checkInLocation',x.check_in_location,'checkOutLocation',x.check_out_location,
      'administrativelyClosed',x.closed_by is not null
    ) order by x.ordinal),'[]'::jsonb) into v_rows
    from (
      select d.id,d.campus_id,d.local_day,d.checked_in_at,d.checked_out_at,
        d.check_in_location,d.check_out_location,d.closed_by,
        coalesce(st.display_name,'Staff') as name,
        row_number() over (
          order by
            case when p_sort='name' then lower(coalesce(st.display_name,'Staff')) end asc nulls last,
            case when p_sort='oldest' then d.checked_in_at end asc nulls last,
            case when p_sort='newest' then d.checked_in_at end desc nulls last,
            d.id
        ) as ordinal
      from public.khpos_ops_staff_day_presence d
      join public.khpos_ops_staff st on st.id=d.staff_id and st.organisation_id=p_org
      where d.organisation_id=p_org and d.local_day between p_from and p_to
        and khpos_private.ops_presence_leader(p_actor,p_org,d.campus_id,null,v_scope)
        and (v_search='' or position(v_search in lower(concat_ws(' ',
          coalesce(st.display_name,'Staff'),d.local_day::text,d.checked_in_at::text,
          d.checked_out_at::text)))>0)
      order by
        case when p_sort='name' then lower(coalesce(st.display_name,'Staff')) end asc nulls last,
        case when p_sort='oldest' then d.checked_in_at end asc nulls last,
        case when p_sort='newest' then d.checked_in_at end desc nulls last,
        d.id
      limit p_page_size offset v_offset
    ) x;
  else
    select count(*) into v_total
    from public.khpos_ops_class_sessions c
    join public.khpos_ops_academic_delivery_streams s on s.id=c.stream_id
      and s.organisation_id=p_org
    left join public.khpos_ops_staff st on st.organisation_id=p_org
      and st.user_id=c.teacher_user_id and st.status='active'
    where c.organisation_id=p_org and c.local_day between p_from and p_to
      and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_scope)
      and (v_search='' or position(v_search in lower(concat_ws(' ',
        coalesce(st.display_name,'Assigned teacher'),s.class_label,s.subject_label,
        c.local_day::text,c.topic_taught,c.outcome,c.checked_in_at::text,
        c.checked_out_at::text)))>0);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'date',x.local_day,'teacher',x.teacher,'class',x.class_label,
      'subject',x.subject_label,'in',x.checked_in_at,'out',x.checked_out_at,
      'outcome',x.outcome,'topic',x.topic_taught,
      'administrativelyClosed',x.closed_by is not null
    ) order by x.ordinal),'[]'::jsonb) into v_rows
    from (
      select c.id,c.local_day,c.checked_in_at,c.checked_out_at,c.outcome,c.topic_taught,
        c.closed_by,s.class_label,s.subject_label,
        coalesce(st.display_name,'Assigned teacher') as teacher,
        row_number() over (
          order by
            case when p_sort='name' then lower(coalesce(st.display_name,'Assigned teacher')) end asc nulls last,
            case when p_sort='oldest' then c.checked_in_at end asc nulls last,
            case when p_sort='newest' then c.checked_in_at end desc nulls last,
            c.id
        ) as ordinal
      from public.khpos_ops_class_sessions c
      join public.khpos_ops_academic_delivery_streams s on s.id=c.stream_id
        and s.organisation_id=p_org
      left join public.khpos_ops_staff st on st.organisation_id=p_org
        and st.user_id=c.teacher_user_id and st.status='active'
      where c.organisation_id=p_org and c.local_day between p_from and p_to
        and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_scope)
        and (v_search='' or position(v_search in lower(concat_ws(' ',
          coalesce(st.display_name,'Assigned teacher'),s.class_label,s.subject_label,
          c.local_day::text,c.topic_taught,c.outcome,c.checked_in_at::text,
          c.checked_out_at::text)))>0)
      order by
        case when p_sort='name' then lower(coalesce(st.display_name,'Assigned teacher')) end asc nulls last,
        case when p_sort='oldest' then c.checked_in_at end asc nulls last,
        case when p_sort='newest' then c.checked_in_at end desc nulls last,
        c.id
      limit p_page_size offset v_offset
    ) x;
  end if;

  return jsonb_build_object(
    'from',p_from,'to',p_to,'category',p_category,'search',v_search,'sort',p_sort,
    'page',p_page,'pageSize',p_page_size,'total',v_total,
    'schoolTotal',case when p_category='school' then v_total else 0 end,
    'classTotal',case when p_category='class' then v_total else 0 end,
    'schoolRecords',case when p_category='school' then v_rows else '[]'::jsonb end,
    'classRecords',case when p_category='class' then v_rows else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.khpos_ops_presence_history_filtered_server(uuid,uuid,date,date,text,text,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_presence_history_filtered_server(uuid,uuid,date,date,text,text,text,integer,integer)
  to service_role;
