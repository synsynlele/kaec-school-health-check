create table public.khpos_learner_attendance_settings (
  campus_id uuid primary key references public.khpos_ops_campuses(id) on delete cascade,
  closes_at time not null
);

create table public.khpos_learner_attendance_events (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  learner_id uuid not null references public.khpos_ops_learner_anchors(id),
  school_day date not null,
  phase text not null check (phase in ('morning','closing','release')),
  mark text not null check (
    (phase='morning' and mark in ('present','late','absent')) or
    (phase='closing' and mark in ('present','unaccounted')) or
    (phase='release' and mark in ('released','left_early'))
  ),
  note text,
  actor uuid not null references auth.users(id),
  recorded_at timestamptz not null default clock_timestamp()
);

create index khpos_learner_attendance_daily
  on public.khpos_learner_attendance_events(organisation_id,school_day,campus_id,learner_id,phase,id desc);

alter table public.khpos_learner_attendance_settings enable row level security;
alter table public.khpos_learner_attendance_events enable row level security;
revoke all on public.khpos_learner_attendance_settings,public.khpos_learner_attendance_events from public,anon,authenticated,service_role;

create function khpos_private.learner_register_role(actor uuid, school uuid, campus uuid, roles text[])
returns boolean language sql stable set search_path='' as $$
  select exists (
    select 1 from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    join public.khpos_ops_roles r on r.organisation_id=o.id
    join public.khpos_ops_role_assignments a on a.role_id=r.id and a.user_id=m.user_id
    where o.id=school and o.status='active' and o.partner_status='active'
      and 'khpos_core'=any(o.partner_entitlements)
      and m.user_id=actor and m.status='active' and r.status='active' and a.status='active'
      and a.start_date <= (now() at time zone 'Africa/Lagos')::date
      and (a.end_date is null or a.end_date >= (now() at time zone 'Africa/Lagos')::date)
      and r.code=any(roles)
      and (a.campus_id=campus or (a.campus_id is null and r.code='SCHOOL_GUARDIAN'))
  )
$$;

create function khpos_private.learner_register_class(actor uuid, learner public.khpos_ops_learner_anchors)
returns boolean language sql stable set search_path='' as $$
  select exists (
    select 1 from public.khpos_ops_academic_delivery_streams s
    join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
    join public.khpos_ops_roles r on r.id=a.role_id
    join public.khpos_ops_academic_terms t on t.id=s.term_id
    join public.organisation_memberships m on m.organisation_id=s.organisation_id and m.user_id=a.user_id
    join public.organisations o on o.id=m.organisation_id
    where s.organisation_id=learner.organisation_id and s.campus_id=learner.campus_id
      and lower(s.class_label)=lower(learner.class_label)
      and lower(coalesce(s.section_label,''))=lower(coalesce(learner.section_label,''))
      and s.status in ('approved','active') and t.status='active'
      and (now() at time zone 'Africa/Lagos')::date between t.start_date and t.end_date
      and r.organisation_id=s.organisation_id and (a.campus_id is null or a.campus_id=s.campus_id)
      and a.user_id=actor and a.status='active' and r.status='active' and m.status='active'
      and a.start_date <= (now() at time zone 'Africa/Lagos')::date
      and (a.end_date is null or a.end_date >= (now() at time zone 'Africa/Lagos')::date)
      and o.status='active' and o.partner_status='active' and 'khpos_core'=any(o.partner_entitlements)
  )
$$;

create function public.khpos_learner_register_server(actor uuid, school uuid, action text, input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  local_now timestamp := clock_timestamp() at time zone 'Africa/Lagos';
  register_day date := local_now::date;
  view_day date := coalesce(nullif(input->>'date','')::date,register_day);
  campus uuid := nullif(input->>'campus','')::uuid;
  selected public.khpos_ops_learner_anchors;
  guardian boolean;
  office boolean;
  closing time;
  phase_name text := input->>'phase';
  mark_name text := input->>'mark';
  release_note text := nullif(btrim(input->>'note'),'');
  last_event public.khpos_learner_attendance_events;
  result jsonb;
begin
  if action='alerts' then
    select coalesce(jsonb_agg(to_jsonb(summary)),'[]'::jsonb) into result
    from (
      select c.id, c.name,
        ((register_day+s.closes_at) at time zone 'Africa/Lagos') as due,
        count(*) filter (where m.mark='absent' and co.mark is distinct from 'present' and re.mark is null) as absent,
        count(*) filter (where co.mark='unaccounted' and re.mark is null) as unaccounted
      from public.khpos_ops_campuses c
      left join public.khpos_learner_attendance_settings s on s.campus_id=c.id
      join public.khpos_ops_learner_anchors a on a.campus_id=c.id and a.organisation_id=school
      left join lateral (select e.mark from public.khpos_learner_attendance_events e
        where e.organisation_id=school and e.school_day=local_now::date and e.campus_id=c.id
          and e.learner_id=a.id and e.phase='morning' order by e.id desc limit 1) m on true
      left join lateral (select e.mark from public.khpos_learner_attendance_events e
        where e.organisation_id=school and e.school_day=local_now::date and e.campus_id=c.id
          and e.learner_id=a.id and e.phase='closing' order by e.id desc limit 1) co on true
      left join lateral (select e.mark from public.khpos_learner_attendance_events e
        where e.organisation_id=school and e.school_day=local_now::date and e.campus_id=c.id
          and e.learner_id=a.id and e.phase='release' order by e.id desc limit 1) re on true
      where c.organisation_id=school and c.status='active'
        and khpos_private.learner_register_role(actor,school,c.id,array['SCHOOL_GUARDIAN'])
        and (co.mark='unaccounted' or (local_now::time >= s.closes_at and m.mark='absent'))
      group by c.id,c.name,s.closes_at
    ) summary;
    return result;
  end if;

  if action='roster' then
    if view_day > register_day then raise exception 'Choose today or an earlier date.' using errcode='22023'; end if;
    return jsonb_build_object('day',view_day,'today',register_day,'campuses',(
      select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'closesAt',s.closes_at,
        'guardian',permissions.guardian,'office',permissions.office,'learners',roster.learners) order by c.name),'[]'::jsonb)
      from public.khpos_ops_campuses c
      left join public.khpos_learner_attendance_settings s on s.campus_id=c.id
      cross join lateral (select
        khpos_private.learner_register_role(actor,school,c.id,array['SCHOOL_GUARDIAN']) guardian,
        khpos_private.learner_register_role(actor,school,c.id,array['SCHOOL_CARE_OPERATIONS_OFFICER','FINANCE_ADMIN_OFFICER']) office
      ) permissions
      cross join lateral (
        select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.display_name,'class',a.class_label,
          'section',a.section_label,'marks',(
            select coalesce(jsonb_object_agg(e.phase,jsonb_build_object('mark',e.mark,'id',e.id,'at',e.recorded_at,'note',e.note)),'{}'::jsonb)
            from (select distinct on (v.phase) v.* from public.khpos_learner_attendance_events v
              where v.organisation_id=school and v.campus_id=c.id and v.learner_id=a.id
                and v.school_day=view_day order by v.phase,v.id desc) e
          )) order by a.class_label,a.section_label,a.display_name),'[]'::jsonb) learners
        from public.khpos_ops_learner_anchors a
        where a.organisation_id=school and a.campus_id=c.id and a.status='active'
          and (permissions.guardian or permissions.office or khpos_private.learner_register_class(actor,a))
      ) roster
      where c.organisation_id=school and c.status='active'
        and (permissions.guardian or permissions.office or jsonb_array_length(roster.learners)>0)
    ));
  end if;

  if not exists (select 1 from public.khpos_ops_campuses c where c.id=campus and c.organisation_id=school and c.status='active') then
    raise exception 'Choose an active campus.' using errcode='22023';
  end if;
  guardian := khpos_private.learner_register_role(actor,school,campus,array['SCHOOL_GUARDIAN']);
  office := khpos_private.learner_register_role(actor,school,campus,array['SCHOOL_CARE_OPERATIONS_OFFICER','FINANCE_ADMIN_OFFICER']);
  if action='schedule' and guardian then
    insert into public.khpos_learner_attendance_settings(campus_id,closes_at)
      values(campus,(input->>'closesAt')::time)
      on conflict (campus_id) do update set closes_at=excluded.closes_at;
    return '{}'::jsonb;
  end if;
  if action<>'mark' then raise exception 'Access denied.' using errcode='42501'; end if;
  if input->>'day' is distinct from register_day::text then
    raise exception 'The school day changed. Refresh the register.' using errcode='22023';
  end if;
  select * into selected from public.khpos_ops_learner_anchors a
    where a.id=(input->>'learner')::uuid and a.organisation_id=school and a.campus_id=campus and a.status='active'
    for update;
  if not found or not (guardian or office or khpos_private.learner_register_class(actor,selected)) or
      (mark_name='left_early' and not (guardian or office)) then
    raise exception 'Access denied.' using errcode='42501';
  end if;

  select s.closes_at into closing from public.khpos_learner_attendance_settings s where s.campus_id=campus;
  if phase_name in ('closing','release') and mark_name<>'left_early'
     and (closing is null or local_now::time < closing) then
    raise exception 'Closing marks open at the campus closing time.' using errcode='22023';
  end if;
  if mark_name in ('released','left_early') and (release_note is null or length(release_note)>300) then
    raise exception 'Record the release method and any required approval or pickup details.' using errcode='22023';
  end if;

  select * into last_event from public.khpos_learner_attendance_events e
    where e.organisation_id=school and e.campus_id=campus and e.learner_id=selected.id
      and e.school_day=local_now::date and e.phase=phase_name order by e.id desc limit 1;
  if last_event.mark=mark_name and last_event.note is not distinct from release_note then return '{}'::jsonb; end if;
  if last_event.id is distinct from (input->>'previous')::bigint then
    raise exception 'Someone updated this learner. Refresh before saving.' using errcode='22023';
  end if;
  if phase_name='release' and last_event.id is not null then
    raise exception 'This release is already recorded.' using errcode='22023';
  end if;
  if mark_name='released' and 'present' is distinct from (
    select e.mark from public.khpos_learner_attendance_events e
    where e.organisation_id=school and e.campus_id=campus and e.learner_id=selected.id
      and e.school_day=local_now::date and e.phase='closing' order by e.id desc limit 1
  ) then
    raise exception 'Confirm the closing roll before recording release.' using errcode='22023';
  end if;
  if mark_name='unaccounted' and coalesce((
    select e.mark from public.khpos_learner_attendance_events e
    where e.organisation_id=school and e.campus_id=campus and e.learner_id=selected.id
      and e.school_day=register_day and e.phase='morning' order by e.id desc limit 1
  ),'') not in ('present','late') and last_event.mark is distinct from 'present' then
    raise exception 'Confirm earlier attendance before reporting the learner unaccounted for.' using errcode='22023';
  end if;
  if phase_name='closing' and exists (
    select 1 from public.khpos_learner_attendance_events e
    where e.organisation_id=school and e.campus_id=campus and e.learner_id=selected.id
      and e.school_day=register_day and e.phase='release'
  ) then
    raise exception 'This learner has already been released.' using errcode='22023';
  end if;
  insert into public.khpos_learner_attendance_events(organisation_id,campus_id,learner_id,school_day,phase,mark,note,actor)
    values(school,campus,selected.id,register_day,phase_name,mark_name,release_note,actor);
  return '{}'::jsonb;
end
$$;

revoke all on function khpos_private.learner_register_role(uuid,uuid,uuid,text[]),
  khpos_private.learner_register_class(uuid,public.khpos_ops_learner_anchors),
  public.khpos_learner_register_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_learner_register_server(uuid,uuid,text,jsonb) to service_role;
