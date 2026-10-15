-- Retain daily attendance history for authorised school leaders.
-- Additive read-only RPC; no attendance rows, existing RPCs or policies change.
create or replace function public.khpos_ops_presence_history_server(
  p_actor uuid, p_org uuid, p_from date, p_to date, p_page integer default 0,
  p_page_size integer default 50
) returns jsonb language plpgsql security definer
set search_path='' as $$
declare
  v_day date := (clock_timestamp() at time zone 'Africa/Lagos')::date;
  v_from date := coalesce(p_from,v_day-29);
  v_to date := coalesce(p_to,v_day);
  v_offset integer;
  v_school jsonb;
  v_class jsonb;
  v_school_count integer;
  v_class_count integer;
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
  if v_from>v_to or v_to>v_day or v_to-v_from>365 then
    raise exception 'Select a valid historical period of no more than 366 days, ending no later than today.';
  end if;
  if p_page is null or p_page<0 or p_page>10000 or p_page_size not between 1 and 100 then
    raise exception 'Invalid attendance history page.';
  end if;
  v_offset := p_page*p_page_size;

  select count(*) into v_school_count
  from public.khpos_ops_staff_day_presence d
  where d.organisation_id=p_org and d.local_day between v_from and v_to
    and khpos_private.ops_presence_leader(p_actor,p_org,d.campus_id,null,v_scope);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'name',x.name,'campusId',x.campus_id,'date',x.local_day,
    'in',x.checked_in_at,'out',x.checked_out_at,
    'administrativelyClosed',x.closed_by is not null
  ) order by x.local_day desc,x.checked_in_at desc,x.id),'[]'::jsonb)
  into v_school from (
    select d.id,d.campus_id,d.local_day,d.checked_in_at,d.checked_out_at,d.closed_by,
      coalesce(st.display_name,'Staff') as name
    from public.khpos_ops_staff_day_presence d
    join public.khpos_ops_staff st on st.id=d.staff_id and st.organisation_id=p_org
    where d.organisation_id=p_org and d.local_day between v_from and v_to
      and khpos_private.ops_presence_leader(p_actor,p_org,d.campus_id,null,v_scope)
    order by d.local_day desc,d.checked_in_at desc,d.id
    limit p_page_size offset v_offset
  ) x;

  select count(*) into v_class_count
  from public.khpos_ops_class_sessions c
  join public.khpos_ops_academic_delivery_streams s on s.id=c.stream_id
    and s.organisation_id=p_org
  where c.organisation_id=p_org and c.local_day between v_from and v_to
    and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_scope);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'date',x.local_day,'teacher',x.teacher,'class',x.class_label,
    'subject',x.subject_label,'in',x.checked_in_at,'out',x.checked_out_at,
    'outcome',x.outcome,'topic',x.topic_taught,
    'administrativelyClosed',x.closed_by is not null
  ) order by x.local_day desc,x.checked_in_at desc,x.id),'[]'::jsonb)
  into v_class from (
    select c.id,c.local_day,c.checked_in_at,c.checked_out_at,c.outcome,c.topic_taught,
      c.closed_by,s.class_label,s.subject_label,
      coalesce(st.display_name,'Assigned teacher') as teacher
    from public.khpos_ops_class_sessions c
    join public.khpos_ops_academic_delivery_streams s on s.id=c.stream_id
      and s.organisation_id=p_org
    left join public.khpos_ops_staff st on st.organisation_id=p_org
      and st.user_id=c.teacher_user_id and st.status='active'
    where c.organisation_id=p_org and c.local_day between v_from and v_to
      and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_scope)
    order by c.local_day desc,c.checked_in_at desc,c.id
    limit p_page_size offset v_offset
  ) x;

  return jsonb_build_object(
    'from',v_from,'to',v_to,'page',p_page,'pageSize',p_page_size,
    'schoolTotal',v_school_count,'classTotal',v_class_count,
    'schoolRecords',v_school,'classRecords',v_class
  );
end;
$$;
revoke all on function public.khpos_ops_presence_history_server(uuid,uuid,date,date,integer,integer)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_presence_history_server(uuid,uuid,date,date,integer,integer)
  to service_role;
