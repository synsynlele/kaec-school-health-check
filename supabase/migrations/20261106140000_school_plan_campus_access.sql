create or replace function public.khpos_school_plan_server(p_actor uuid,p_org uuid,p_from date,p_to date,p_input jsonb default null,p_today boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  manage boolean;
  whole_school boolean;
  managed_campuses uuid[];
  entry public.khpos_school_plan_entries;
  slot public.khpos_assessment_slots;
  action text := p_input->>'action';
  entry_id uuid := (p_input->>'id')::uuid;
  campus uuid := (p_input->>'campusId')::uuid;
  staff uuid := (p_input->>'staffId')::uuid;
  assessment uuid := (p_input->>'assessmentId')::uuid;
  first_day date := (p_input->>'startDay')::date;
  last_day date := (p_input->>'endDay')::date;
  entry_kind text := p_input->>'kind';
  today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not coalesce(khpos_private.ops_academic_has_membership(p_actor,p_org),false) then
    raise exception 'Active school membership required.' using errcode='42501';
  end if;
  whole_school := khpos_private.ops_presence_leader(p_actor,p_org,null,null,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN']);
  select array(select c.id from public.khpos_ops_campuses c
    where c.organisation_id=p_org and c.status='active'
      and khpos_private.ops_presence_leader(p_actor,p_org,c.id,null,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR']))
    into managed_campuses;
  manage := whole_school or cardinality(managed_campuses)>0;
  if p_input is not null then
    if not manage then raise exception 'Only an authorised school or campus leader can edit the calendar.' using errcode='42501'; end if;
    if action='rule' then
      if not whole_school then raise exception 'Only a school-wide leader can change recurring duty rules.' using errcode='42501'; end if;
      update public.khpos_ops_recurring_rules set calendar_day_mode=p_input->>'dayMode'
        where id=entry_id and organisation_id=p_org and status='active';
      if not found then raise exception 'Active recurring rule not found.' using errcode='22023'; end if;
      insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
        values(p_org,p_actor,'school_calendar_rule','recurring_rule',entry_id,jsonb_build_object('dayMode',p_input->>'dayMode'));
    else
    if entry_id is not null then
      select * into entry from public.khpos_school_plan_entries e where e.organisation_id=p_org and e.id=entry_id for update;
      if not found then raise exception 'Calendar entry not found.' using errcode='22023'; end if;
      if not whole_school and not coalesce(entry.campus_id=any(managed_campuses),false) then
        raise exception 'You can only change entries for your assigned campus.' using errcode='42501';
      end if;
    end if;
    if action='remove' and entry.id is not null then
      update public.khpos_school_plan_entries set published=false where id=entry.id;
    elsif action='save' then
      if entry_kind='invigilation' then
        select a.* into slot from public.khpos_assessment_slots a join public.khpos_ops_academic_delivery_streams st on st.id=a.stream_id
      where a.organisation_id=p_org and (whole_school or st.campus_id=any(managed_campuses)) and a.id=assessment;
        if not found then raise exception 'Choose an exam or test in this school.' using errcode='22023'; end if;
        select s.campus_id into campus from public.khpos_ops_academic_delivery_streams s where s.id=slot.stream_id and s.organisation_id=p_org;
        first_day := (slot.starts_at at time zone 'Africa/Lagos')::date;
        last_day := (slot.ends_at at time zone 'Africa/Lagos')::date;
      end if;
      if not whole_school and not coalesce(campus=any(managed_campuses),false) then
        raise exception 'Choose a campus you manage.' using errcode='42501';
      end if;
      if first_day is null or last_day is null or last_day<first_day or last_day-first_day>366
        or (entry_kind in ('weekly_theme','weekly_duty') and (extract(isodow from first_day)<>1 or last_day<>first_day+6))
        or (entry_kind='daily_topic' and first_day<>last_day) then
        raise exception 'Check the dates. Weekly entries run Monday to Sunday, and daily topics use one date.' using errcode='22023';
      end if;
      if campus is not null and not exists(select 1 from public.khpos_ops_campuses c where c.id=campus and c.organisation_id=p_org and c.status='active') then
        raise exception 'Choose an active campus in this school.' using errcode='22023';
      end if;
      if staff is not null and not exists(select 1 from public.khpos_ops_staff s
        where s.id=staff and s.organisation_id=p_org and s.status='active'
          and (campus is null or s.campus_id is null or s.campus_id=campus)) then
        raise exception 'Choose active staff from the selected campus.' using errcode='22023';
      end if;
      if entry.id is null then
        insert into public.khpos_school_plan_entries(organisation_id,campus_id,kind,title,start_day,end_day,staff_id,assessment_id,published)
          values(p_org,campus,entry_kind,btrim(p_input->>'title'),first_day,last_day,staff,assessment,(p_input->>'published')::boolean)
          returning id into entry_id;
      else
        update public.khpos_school_plan_entries set campus_id=campus,kind=entry_kind,title=btrim(p_input->>'title'),
          start_day=first_day,end_day=last_day,staff_id=staff,assessment_id=assessment,published=(p_input->>'published')::boolean
          where id=entry_id;
      end if;
    else raise exception 'Unknown calendar action.' using errcode='22023';
    end if;
    insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
      values(p_org,p_actor,'school_calendar_' || action,'calendar_entry',entry_id,
        jsonb_build_object('previous',to_jsonb(entry),'current',(select to_jsonb(e) from public.khpos_school_plan_entries e where e.id=entry_id)));
    end if;
  end if;
  return jsonb_build_object(
    'canManage',manage and not p_today,
    'canManageWholeSchool',whole_school and not p_today,
    'entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.start_day,x.title) from (
      select e.id,e.kind,e.title,e.campus_id,e.staff_id,e.assessment_id,e.published,
        (not p_today and (whole_school or coalesce(e.campus_id=any(managed_campuses),false))) as can_edit,
        coalesce((a.starts_at at time zone 'Africa/Lagos')::date,e.start_day) as start_day,
        coalesce((a.ends_at at time zone 'Africa/Lagos')::date,e.end_day) as end_day,
        s.display_name as staff_name,c.name as campus_name,a.starts_at as assessment_start,a.title as assessment_title
      from public.khpos_school_plan_entries e
      left join public.khpos_assessment_slots a on a.id=e.assessment_id and a.organisation_id=p_org
      left join public.khpos_ops_staff s on s.id=e.staff_id and s.organisation_id=p_org
      left join public.khpos_ops_campuses c on c.id=e.campus_id and c.organisation_id=p_org
      where e.organisation_id=p_org and (e.published or (not p_today and (whole_school or e.campus_id=any(managed_campuses))))
        and coalesce((a.starts_at at time zone 'Africa/Lagos')::date,e.start_day)<=p_to
        and coalesce((a.ends_at at time zone 'Africa/Lagos')::date,e.end_day)>=p_from
        and (not p_today or ((e.staff_id is null or s.user_id=p_actor)
          and (e.campus_id is null or exists(select 1 from public.khpos_ops_staff self
            where self.organisation_id=p_org and self.user_id=p_actor and self.campus_id=e.campus_id and self.status='active'))))
        and (not p_today or e.kind<>'weekly_duty' or not khpos_private.school_plan_blocks(p_org,coalesce(e.campus_id,s.campus_id),today,false))
      order by e.start_day,e.title limit 250
    ) x),'[]'::jsonb),
    'campuses',case when manage and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)
      from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active' and (whole_school or c.id=any(managed_campuses))),'[]'::jsonb) else '[]'::jsonb end,
    'staff',case when manage and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.display_name) order by s.display_name)
      from public.khpos_ops_staff s where s.organisation_id=p_org and s.status='active' and (whole_school or s.campus_id is null or s.campus_id=any(managed_campuses))),'[]'::jsonb) else '[]'::jsonb end,
    'assessments',case when manage and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.title,'start',a.starts_at) order by a.starts_at)
      from public.khpos_assessment_slots a join public.khpos_ops_academic_delivery_streams st on st.id=a.stream_id
      where a.organisation_id=p_org and (whole_school or st.campus_id=any(managed_campuses))
        and (a.starts_at at time zone 'Africa/Lagos')::date between p_from and p_to),'[]'::jsonb) else '[]'::jsonb end,
    'rules',case when whole_school and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.title,'mode',r.calendar_day_mode) order by r.title)
      from public.khpos_ops_recurring_rules r where r.organisation_id=p_org and r.status='active'),'[]'::jsonb) else '[]'::jsonb end,
    'terms',case when p_today then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.term_name,'session',t.session_label,'start',t.start_date,'end',t.end_date) order by t.start_date)
      from public.khpos_ops_academic_terms t where t.organisation_id=p_org and t.status='active' and t.start_date<=p_to and t.end_date>=p_from),'[]'::jsonb) end
  );
end;
$$;
