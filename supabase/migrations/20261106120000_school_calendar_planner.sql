alter table public.khpos_ops_recurring_rules add column calendar_day_mode text not null default 'scheduled'
  check (calendar_day_mode in ('scheduled','teaching','staff'));

create table public.khpos_school_plan_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  campus_id uuid references public.khpos_ops_campuses(id),
  kind text not null check (kind in ('closure','no_lessons','exam_period','event','weekly_theme','daily_topic','weekly_duty','invigilation')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  start_day date not null,
  end_day date not null check (end_day >= start_day),
  staff_id uuid references public.khpos_ops_staff(id),
  assessment_id uuid references public.khpos_assessment_slots(id),
  published boolean not null default false,
  check ((kind in ('weekly_duty','invigilation')) = (staff_id is not null)),
  check ((kind = 'invigilation') = (assessment_id is not null)),
  unique (organisation_id, id)
);
create index khpos_school_plan_dates on public.khpos_school_plan_entries (organisation_id,start_day,end_day) where published;
alter table public.khpos_school_plan_entries enable row level security;
revoke all on public.khpos_school_plan_entries from public,anon,authenticated;

create function khpos_private.school_plan_blocks(p_org uuid,p_campus uuid,p_day date,p_lessons boolean)
returns boolean language sql stable set search_path='' as $$
  select exists (
    select 1 from public.khpos_school_plan_entries e
    where e.organisation_id=p_org and e.published and p_day between e.start_day and e.end_day
      and (e.campus_id is null or e.campus_id=p_campus)
      and (e.kind='closure' or (p_lessons and e.kind='no_lessons'))
  );
$$;
revoke all on function khpos_private.school_plan_blocks(uuid,uuid,date,boolean) from public,anon,authenticated;

create function public.khpos_school_plan_server(p_actor uuid,p_org uuid,p_from date,p_to date,p_input jsonb default null,p_today boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  manage boolean;
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
  manage := khpos_private.ops_presence_leader(p_actor,p_org,null,null,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN']);
  if p_input is not null then
    if not manage then raise exception 'Only an authorised school-wide leader can edit the calendar.' using errcode='42501'; end if;
    if action='rule' then
      update public.khpos_ops_recurring_rules set calendar_day_mode=p_input->>'dayMode'
        where id=entry_id and organisation_id=p_org and status='active';
      if not found then raise exception 'Active recurring rule not found.' using errcode='22023'; end if;
      insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
        values(p_org,p_actor,'school_calendar_rule','recurring_rule',entry_id,jsonb_build_object('dayMode',p_input->>'dayMode'));
    else
    if entry_id is not null then
      select * into entry from public.khpos_school_plan_entries e where e.organisation_id=p_org and e.id=entry_id for update;
      if not found then raise exception 'Calendar entry not found.' using errcode='22023'; end if;
    end if;
    if action='remove' and entry.id is not null then
      update public.khpos_school_plan_entries set published=false where id=entry.id;
    elsif action='save' then
      if entry_kind='invigilation' then
        select a.* into slot from public.khpos_assessment_slots a where a.organisation_id=p_org and a.id=assessment;
        if not found then raise exception 'Choose an exam or test in this school.' using errcode='22023'; end if;
        select s.campus_id into campus from public.khpos_ops_academic_delivery_streams s where s.id=slot.stream_id and s.organisation_id=p_org;
        first_day := (slot.starts_at at time zone 'Africa/Lagos')::date;
        last_day := (slot.ends_at at time zone 'Africa/Lagos')::date;
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
    'entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.start_day,x.title) from (
      select e.id,e.kind,e.title,e.campus_id,e.staff_id,e.assessment_id,e.published,
        coalesce((a.starts_at at time zone 'Africa/Lagos')::date,e.start_day) as start_day,
        coalesce((a.ends_at at time zone 'Africa/Lagos')::date,e.end_day) as end_day,
        s.display_name as staff_name,c.name as campus_name,a.starts_at as assessment_start,a.title as assessment_title
      from public.khpos_school_plan_entries e
      left join public.khpos_assessment_slots a on a.id=e.assessment_id and a.organisation_id=p_org
      left join public.khpos_ops_staff s on s.id=e.staff_id and s.organisation_id=p_org
      left join public.khpos_ops_campuses c on c.id=e.campus_id and c.organisation_id=p_org
      where e.organisation_id=p_org and (e.published or (manage and not p_today))
        and coalesce((a.starts_at at time zone 'Africa/Lagos')::date,e.start_day)<=p_to
        and coalesce((a.ends_at at time zone 'Africa/Lagos')::date,e.end_day)>=p_from
        and (not p_today or ((e.staff_id is null or s.user_id=p_actor)
          and (e.campus_id is null or exists(select 1 from public.khpos_ops_staff self
            where self.organisation_id=p_org and self.user_id=p_actor and self.campus_id=e.campus_id and self.status='active'))))
        and (not p_today or e.kind<>'weekly_duty' or not khpos_private.school_plan_blocks(p_org,coalesce(e.campus_id,s.campus_id),today,false))
      order by e.start_day,e.title limit 250
    ) x),'[]'::jsonb),
    'campuses',case when manage and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)
      from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active'),'[]'::jsonb) else '[]'::jsonb end,
    'staff',case when manage and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.display_name) order by s.display_name)
      from public.khpos_ops_staff s where s.organisation_id=p_org and s.status='active'),'[]'::jsonb) else '[]'::jsonb end,
    'assessments',case when manage and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.title,'start',a.starts_at) order by a.starts_at)
      from public.khpos_assessment_slots a where a.organisation_id=p_org
        and (a.starts_at at time zone 'Africa/Lagos')::date between p_from and p_to),'[]'::jsonb) else '[]'::jsonb end,
    'rules',case when manage and not p_today then coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.title,'mode',r.calendar_day_mode) order by r.title)
      from public.khpos_ops_recurring_rules r where r.organisation_id=p_org and r.status='active'),'[]'::jsonb) else '[]'::jsonb end,
    'terms',case when p_today then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.term_name,'session',t.session_label,'start',t.start_date,'end',t.end_date) order by t.start_date)
      from public.khpos_ops_academic_terms t where t.organisation_id=p_org and t.status='active' and t.start_date<=p_to and t.end_date>=p_from),'[]'::jsonb) end
  );
end;
$$;
revoke all on function public.khpos_school_plan_server(uuid,uuid,date,date,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.khpos_school_plan_server(uuid,uuid,date,date,jsonb,boolean) to service_role;

create function khpos_private.prevent_closed_day_lesson()
returns trigger language plpgsql security definer set search_path='' as $$
declare campus uuid;
begin
  select s.campus_id into campus from public.khpos_ops_academic_delivery_streams s
    where s.id=new.stream_id and s.organisation_id=new.organisation_id;
  if khpos_private.school_plan_blocks(new.organisation_id,campus,new.local_day,true) then
    raise exception 'The published school calendar pauses lessons on this date.';
  end if;
  return new;
end;
$$;
revoke all on function khpos_private.prevent_closed_day_lesson() from public,anon,authenticated;
create trigger khpos_prevent_closed_day_lesson before insert on public.khpos_ops_class_sessions
  for each row execute function khpos_private.prevent_closed_day_lesson();

grant select on public.khpos_school_plan_entries to service_role;


create or replace function public.khpos_ops_materialize_due_work_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_member_role text;
  v_created integer := 0;
  r record;
  a record;
  v_local_date date;
  v_occurrence_date date;
  v_occurrence_key text;
  v_due_at timestamptz;
  v_last_day integer;
begin
  select m.role into v_member_role
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_member_role is null then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  for a in
    select ra.*
    from public.khpos_ops_role_assignments ra
    join public.khpos_ops_roles role on role.id=ra.role_id
    where ra.user_id=p_actor_user_id
      and ra.status='active'
      and role.organisation_id=p_organisation_id
      and role.status='active'
  loop
    for r in
      select rr.*
      from public.khpos_ops_recurring_rules rr
      where rr.organisation_id=p_organisation_id
        and rr.owner_role_id=a.role_id
        and rr.status='active'
        and rr.cadence <> 'manual'
        and (rr.campus_id is null or rr.campus_id=a.campus_id)
        and (rr.unit_id is null or rr.unit_id=a.unit_id)
    loop
      v_local_date := (now() at time zone r.timezone)::date;
      if v_local_date < r.start_date or (r.end_date is not null and v_local_date > r.end_date) then
        continue;
      end if;

      if r.cadence='daily' then
        if extract(isodow from v_local_date)::integer <> all(r.weekdays) then
          continue;
        end if;
        v_occurrence_date := v_local_date;
        v_occurrence_key := 'D:' || to_char(v_occurrence_date,'YYYY-MM-DD');
      elsif r.cadence='weekly' then
        v_occurrence_date := (date_trunc('week',v_local_date::timestamp)::date + (r.weekday-1));
        if v_occurrence_date > v_local_date then
          continue;
        end if;
        v_occurrence_key := 'W:' || to_char(v_occurrence_date,'IYYY-IW');
      elsif r.cadence='monthly' then
        v_last_day := extract(day from (date_trunc('month',v_local_date::timestamp) + interval '1 month - 1 day'))::integer;
        v_occurrence_date := make_date(
          extract(year from v_local_date)::integer,
          extract(month from v_local_date)::integer,
          least(r.day_of_month,v_last_day)
        );
        if v_occurrence_date > v_local_date then
          continue;
        end if;
        v_occurrence_key := 'M:' || to_char(v_occurrence_date,'YYYY-MM');
      else
        continue;
      end if;

      if v_occurrence_date < r.start_date or (r.end_date is not null and v_occurrence_date > r.end_date) then
        continue;
      end if;

      if r.calendar_day_mode <> 'scheduled' and khpos_private.school_plan_blocks(
        p_organisation_id,coalesce(r.campus_id,a.campus_id),v_occurrence_date,r.calendar_day_mode='teaching'
      ) then continue; end if;

      v_due_at := case
        when r.due_time is null then (v_occurrence_date::timestamp + time '23:59') at time zone r.timezone
        else (v_occurrence_date::timestamp + r.due_time) at time zone r.timezone
      end;

      insert into public.khpos_ops_work_items(
        organisation_id,campus_id,unit_id,process_id,recurring_rule_id,
        owner_assignment_id,checklist_template_id,occurrence_key,title,description,
        status,priority,due_at,evidence_required,verification_required,created_by
      ) values (
        p_organisation_id,coalesce(r.campus_id,a.campus_id),coalesce(r.unit_id,a.unit_id),
        r.process_id,r.id,a.id,r.checklist_template_id,v_occurrence_key,r.title,r.description,
        'pending',r.priority,v_due_at,r.evidence_required,r.verification_required,p_actor_user_id
      )
      on conflict (recurring_rule_id,owner_assignment_id,occurrence_key)
        where recurring_rule_id is not null and occurrence_key is not null
      do nothing;

      if found then v_created := v_created + 1; end if;
    end loop;
  end loop;

  return v_created;
end;
$$;
