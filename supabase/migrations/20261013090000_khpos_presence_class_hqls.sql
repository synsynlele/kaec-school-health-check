-- O74: isolated attendance, scheduled class delivery and KAEC HQLS fidelity.
-- No existing tables, roles, navigation or application behaviour are modified.
create table public.khpos_ops_staff_day_presence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  staff_id uuid not null references public.khpos_ops_staff(id),
  local_day date not null,
  checked_in_at timestamptz not null default clock_timestamp(),
  checked_out_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint khpos_presence_day_unique unique(organisation_id,staff_id,local_day),
  constraint khpos_presence_clock_order check(checked_out_at is null or checked_out_at>=checked_in_at)
);
create index khpos_presence_campus_day on public.khpos_ops_staff_day_presence(organisation_id,campus_id,local_day);
create index khpos_presence_staff_day on public.khpos_ops_staff_day_presence(staff_id,local_day desc);
alter table public.khpos_ops_staff_day_presence enable row level security;
revoke all on public.khpos_ops_staff_day_presence from public,anon,authenticated;
grant select,insert,update on public.khpos_ops_staff_day_presence to service_role;

create table public.khpos_ops_class_periods (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  stream_id uuid not null references public.khpos_ops_academic_delivery_streams(id),
  weekday integer not null check(weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  room_label text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  constraint khpos_period_times check(starts_at < ends_at),
  constraint khpos_period_unique unique(stream_id,weekday,starts_at)
);
create index khpos_periods_stream on public.khpos_ops_class_periods(stream_id,is_active);
create index khpos_periods_school on public.khpos_ops_class_periods(organisation_id,weekday,is_active);
alter table public.khpos_ops_class_periods enable row level security;
revoke all on public.khpos_ops_class_periods from public,anon,authenticated;
grant select,insert,update on public.khpos_ops_class_periods to service_role;

create table public.khpos_ops_class_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  period_id uuid not null references public.khpos_ops_class_periods(id),
  stream_id uuid not null references public.khpos_ops_academic_delivery_streams(id),
  teacher_user_id uuid not null references auth.users(id),
  local_day date not null,
  checked_in_at timestamptz not null default clock_timestamp(),
  checked_out_at timestamptz,
  outcome text check(outcome in ('completed','partial','not_held')),
  topic_taught text,
  follow_up text,
  created_at timestamptz not null default clock_timestamp(),
  constraint khpos_class_session_once unique(period_id,local_day),
  constraint khpos_class_clock_order check(checked_out_at is null or checked_out_at>=checked_in_at),
  constraint khpos_class_outcome_required check(checked_out_at is null or outcome is not null)
);
create index khpos_class_sessions_teacher_day on public.khpos_ops_class_sessions(teacher_user_id,local_day desc);
create index khpos_class_sessions_school_day on public.khpos_ops_class_sessions(organisation_id,local_day desc);
create unique index khpos_one_open_class_per_teacher on public.khpos_ops_class_sessions(teacher_user_id) where checked_out_at is null;
alter table public.khpos_ops_class_sessions enable row level security;
revoke all on public.khpos_ops_class_sessions from public,anon,authenticated;
grant select,insert,update on public.khpos_ops_class_sessions to service_role;

create table public.khpos_ops_hqls_fidelity_observations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  stream_id uuid not null references public.khpos_ops_academic_delivery_streams(id),
  class_session_id uuid references public.khpos_ops_class_sessions(id),
  observer_user_id uuid not null references auth.users(id),
  teacher_user_id uuid not null references auth.users(id),
  observation_mode text not null check(observation_mode in ('full','walk')),
  rubric_version text not null default 'KAEC-HQLS-CLASSROOM-v1',
  domains jsonb not null,
  total_score integer check(total_score between 8 and 24),
  fidelity_band text check(fidelity_band in ('model','developing','violation')),
  automatic_failure boolean not null default false,
  strengths text not null,
  improvement_area text,
  coaching_action text,
  coaching_due_date date,
  coaching_work_id uuid references public.khpos_ops_work_items(id),
  teacher_response text,
  teacher_acknowledged_at timestamptz,
  observed_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint khpos_hqls_walk_unscored check((observation_mode='walk' and total_score is null and fidelity_band is null) or (observation_mode='full' and total_score is not null and fidelity_band is not null))
);
create index khpos_hqls_school_time on public.khpos_ops_hqls_fidelity_observations(organisation_id,observed_at desc);
create index khpos_hqls_teacher_time on public.khpos_ops_hqls_fidelity_observations(teacher_user_id,observed_at desc);
alter table public.khpos_ops_hqls_fidelity_observations enable row level security;
revoke all on public.khpos_ops_hqls_fidelity_observations from public,anon,authenticated;
grant select,insert,update on public.khpos_ops_hqls_fidelity_observations to service_role;

create or replace function khpos_private.ops_presence_leader(p_actor uuid,p_org uuid,p_campus uuid,p_unit uuid,p_codes text[])
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor and a.status='active' and r.status='active'
      and r.organisation_id=p_org and r.code=any(p_codes)
      and (a.campus_id is null or a.campus_id=p_campus)
      and (a.unit_id is null or (p_unit is not null and a.unit_id=p_unit))
  );
$$;
revoke all on function khpos_private.ops_presence_leader(uuid,uuid,uuid,uuid,text[]) from public,anon,authenticated;

create or replace function public.khpos_ops_presence_workspace_server(p_actor uuid,p_org uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff public.khpos_ops_staff%rowtype;
  v_day date:= (clock_timestamp() at time zone 'Africa/Lagos')::date;
  v_role_codes text[]:=array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER'];
begin
  if not khpos_private.ops_academic_has_membership(p_actor,p_org) then
    raise exception 'Active school membership and KHP-OS partnership are required.';
  end if;
  select * into v_staff from public.khpos_ops_staff st
   where st.organisation_id=p_org and st.user_id=p_actor and st.status='active' limit 1;
  return jsonb_build_object(
    'localDay',v_day,
    'staff',case when v_staff.id is null then null else jsonb_build_object('id',v_staff.id,'name',v_staff.display_name,'campusId',v_staff.campus_id) end,
    'canManage',exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.status='active' and r.code=any(array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])),
    'userId',p_actor,
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)
      from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active'
      and (c.id=v_staff.campus_id or exists(
        select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
        where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.status='active'
          and (a.campus_id=c.id or a.campus_id is null)
      ))),'[]'::jsonb),
    'todayPresence',(select jsonb_build_object('id',d.id,'campusId',d.campus_id,'in',d.checked_in_at,'out',d.checked_out_at)
      from public.khpos_ops_staff_day_presence d where d.organisation_id=p_org and d.staff_id=v_staff.id and d.local_day=v_day),
    'periods',coalesce((select jsonb_agg(jsonb_build_object(
       'id',p.id,'streamId',s.id,'weekday',p.weekday,'start',to_char(p.starts_at,'HH24:MI'),'end',to_char(p.ends_at,'HH24:MI'),
       'room',p.room_label,'campusId',s.campus_id,'class',s.class_label,'subject',s.subject_label,
       'teacher',coalesce(st.display_name,'Assigned teacher'),'teacherUserId',a.user_id,
       'termActive',t.status='active' and s.status='active',
       'session', (select jsonb_build_object('id',ses.id,'in',ses.checked_in_at,'out',ses.checked_out_at,'outcome',ses.outcome,'topic',ses.topic_taught)
          from public.khpos_ops_class_sessions ses where ses.period_id=p.id and ses.local_day=v_day)
      ) order by p.weekday,p.starts_at,s.class_label)
      from public.khpos_ops_class_periods p
      join public.khpos_ops_academic_delivery_streams s on s.id=p.stream_id and s.organisation_id=p_org
      join public.khpos_ops_academic_terms t on t.id=s.term_id
      join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
      left join public.khpos_ops_staff st on st.organisation_id=p_org and st.user_id=a.user_id and st.status='active'
      where p.organisation_id=p_org and p.is_active and t.start_date<=v_day and t.end_date>=v_day
      and (a.user_id=p_actor or khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_role_codes))
    ),'[]'::jsonb),
    'observations',coalesce((select jsonb_agg(jsonb_build_object(
       'id',o.id,'streamId',o.stream_id,'teacherUserId',o.teacher_user_id,'mode',o.observation_mode,
       'domains',o.domains,'total',o.total_score,'band',o.fidelity_band,'automaticFailure',o.automatic_failure,
       'strengths',o.strengths,'improvement',o.improvement_area,'coaching',o.coaching_action,'due',o.coaching_due_date,
       'teacherResponse',o.teacher_response,'acknowledgedAt',o.teacher_acknowledged_at,'observedAt',o.observed_at,
       'coachingWorkId',o.coaching_work_id
     ) order by o.observed_at desc)
     from (select * from public.khpos_ops_hqls_fidelity_observations x
       where x.organisation_id=p_org and (x.teacher_user_id=p_actor or x.observer_user_id=p_actor
         or exists(select 1 from public.khpos_ops_academic_delivery_streams s where s.id=x.stream_id
           and khpos_private.ops_presence_leader(p_actor,p_org,s.campus_id,s.unit_id,v_role_codes)))
       order by x.observed_at desc limit 35) o),'[]'::jsonb),
    'teamPresence',coalesce((select jsonb_agg(jsonb_build_object(
       'name',st.display_name,'campusId',d.campus_id,'in',d.checked_in_at,'out',d.checked_out_at
     ) order by d.checked_in_at desc)
     from public.khpos_ops_staff_day_presence d
     join public.khpos_ops_staff st on st.id=d.staff_id and st.organisation_id=p_org
     where d.organisation_id=p_org and d.local_day=v_day
       and khpos_private.ops_presence_leader(p_actor,p_org,d.campus_id,null,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
     ),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.khpos_ops_presence_workspace_server(uuid,uuid) from public,anon,authenticated;
grant execute on function public.khpos_ops_presence_workspace_server(uuid,uuid) to service_role;

create or replace function public.khpos_ops_presence_action_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff public.khpos_ops_staff%rowtype;
  v_campus uuid; v_day date:=(clock_timestamp() at time zone 'Africa/Lagos')::date;
  v_now timestamptz:=clock_timestamp(); v_presence public.khpos_ops_staff_day_presence%rowtype;
  v_period public.khpos_ops_class_periods%rowtype; v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_term public.khpos_ops_academic_terms%rowtype; v_session public.khpos_ops_class_sessions%rowtype;
  v_teacher uuid; v_id uuid; v_domains jsonb; v_domain jsonb; v_code text;
  v_score integer; v_total integer:=0; v_count integer:=0; v_failure boolean:=false;
  v_codes text[]:=array['awakening','exploration','micro_illumination','first_trial','full_illumination','second_trial','integration','teacher_role_fidelity'];
  v_seen text[]:='{}'::text[]; v_mode text; v_band text; v_action text; v_observation uuid; v_assignment uuid; v_school_time time;
begin
  if not khpos_private.ops_academic_has_membership(p_actor,p_org) then
    raise exception 'Active school membership and KHP-OS partnership are required.';
  end if;
  select * into v_staff from public.khpos_ops_staff st where st.organisation_id=p_org and st.user_id=p_actor and st.status='active' limit 1;

  if p_mode='school_in' then
    if v_staff.id is null then raise exception 'An active staff identity is required.'; end if;
    v_campus:=(p_input->>'campusId')::uuid;
    if not exists(select 1 from public.khpos_ops_campuses c where c.id=v_campus and c.organisation_id=p_org and c.status='active')
       or not (v_staff.campus_id=v_campus or exists(
          select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
          where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.status='active'
            and (a.campus_id=v_campus or a.campus_id is null)))
    then raise exception 'Select your authorised active school campus.'; end if;
    if exists(select 1 from public.khpos_ops_staff_day_presence d
      where d.organisation_id=p_org and d.staff_id=v_staff.id and d.local_day=v_day)
    then raise exception 'School check-in is already recorded for today.'; end if;
    insert into public.khpos_ops_staff_day_presence(organisation_id,campus_id,staff_id,local_day,checked_in_at)
    values(p_org,v_campus,v_staff.id,v_day,v_now);
  elsif p_mode='school_out' then
    if v_staff.id is null then raise exception 'An active staff identity is required.'; end if;
    if exists(select 1 from public.khpos_ops_class_sessions x where x.teacher_user_id=p_actor and x.checked_out_at is null and x.local_day=v_day)
    then raise exception 'Finish the active class before leaving school.'; end if;
    update public.khpos_ops_staff_day_presence d set checked_out_at=v_now
    where d.organisation_id=p_org and d.staff_id=v_staff.id and d.local_day=v_day and d.checked_out_at is null;
    if not found then raise exception 'There is no open school attendance today.'; end if;
  elsif p_mode='period_add' then
    v_id:=(p_input->>'streamId')::uuid;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_id and s.organisation_id=p_org;
    if v_stream.id is null or v_stream.campus_id is null then raise exception 'Select a campus-scoped Academic Delivery stream.'; end if;
    if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
    then raise exception 'Only an authorised Guardian or Academic Inspector can schedule classes.'; end if;
    if v_stream.status not in ('approved','active') then raise exception 'Approve the Academic Delivery stream first.'; end if;
    v_school_time:=(p_input->>'start')::time;
    if (p_input->>'end')::time <= v_school_time then raise exception 'Class end must be after its start.'; end if;
    if exists(
      select 1 from public.khpos_ops_class_periods p
      join public.khpos_ops_academic_delivery_streams s on s.id=p.stream_id
      where p.organisation_id=p_org and p.is_active
        and p.weekday=(p_input->>'weekday')::int
        and exists(select 1 from public.khpos_ops_role_assignments aa join public.khpos_ops_role_assignments ab on ab.id=v_stream.teacher_assignment_id where aa.id=s.teacher_assignment_id and aa.user_id=ab.user_id)
        and p.starts_at < (p_input->>'end')::time and p.ends_at > v_school_time
    ) then raise exception 'This teacher already has an overlapping scheduled class.'; end if;
    insert into public.khpos_ops_class_periods(organisation_id,stream_id,weekday,starts_at,ends_at,room_label,created_by)
      values(p_org,v_id,(p_input->>'weekday')::int,v_school_time,(p_input->>'end')::time,
        nullif(left(trim(coalesce(p_input->>'room','')),100),''),p_actor)
    returning id into v_id;
  elsif p_mode='period_disable' then
    v_id:=(p_input->>'periodId')::uuid;
    select * into v_period from public.khpos_ops_class_periods p where p.id=v_id and p.organisation_id=p_org;
    if v_period.id is null then raise exception 'Scheduled lesson not found.'; end if;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_period.stream_id;
    if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
    then raise exception 'Not permitted to alter this timetable.'; end if;
    update public.khpos_ops_class_periods set is_active=false where id=v_id;
  elsif p_mode in ('class_in','class_out') then
    v_id:=(p_input->>'periodId')::uuid;
    select * into v_period from public.khpos_ops_class_periods p where p.id=v_id and p.organisation_id=p_org and p.is_active;
    if v_period.id is null then raise exception 'Active scheduled lesson not found.'; end if;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_period.stream_id and s.organisation_id=p_org;
    select * into v_term from public.khpos_ops_academic_terms t where t.id=v_stream.term_id;
    select a.user_id into v_teacher from public.khpos_ops_role_assignments a
      where a.id=v_stream.teacher_assignment_id and a.status='active';
    if v_teacher is distinct from p_actor then raise exception 'Only the assigned active subject teacher can check into this class.'; end if;
    if v_term.status<>'active' or v_stream.status<>'active' or v_day not between v_term.start_date and v_term.end_date
      then raise exception 'The Academic Delivery stream and term must be active today.'; end if;
    if extract(isodow from (v_now at time zone 'Africa/Lagos'))::integer<>v_period.weekday
      then raise exception 'This class is not scheduled for today.'; end if;
    select * into v_presence from public.khpos_ops_staff_day_presence d
      where d.organisation_id=p_org and d.staff_id=v_staff.id and d.local_day=v_day and d.checked_out_at is null;
    if v_presence.id is null or v_presence.campus_id is distinct from v_stream.campus_id then
      raise exception 'Check into the correct school campus before teaching.'; end if;
    if p_mode='class_in' then
      if (v_now at time zone 'Africa/Lagos')::time < v_period.starts_at-interval '30 minutes'
        or (v_now at time zone 'Africa/Lagos')::time > v_period.ends_at+interval '30 minutes'
      then raise exception 'Class check-in opens 30 minutes before its start and closes 30 minutes after its end.'; end if;
      insert into public.khpos_ops_class_sessions(organisation_id,period_id,stream_id,teacher_user_id,local_day,checked_in_at)
        values(p_org,v_period.id,v_stream.id,p_actor,v_day,v_now);
    else
      select * into v_session from public.khpos_ops_class_sessions x
        where x.period_id=v_period.id and x.local_day=v_day and x.teacher_user_id=p_actor and x.checked_out_at is null;
      if v_session.id is null then raise exception 'You do not have an open class session for this period.'; end if;
      if p_input->>'outcome' not in ('completed','partial','not_held') then raise exception 'Select the lesson outcome.'; end if;
      if p_input->>'outcome' in ('completed','partial') and length(trim(coalesce(p_input->>'topic','')))<3
      then raise exception 'Record the topic actually taught.'; end if;
      update public.khpos_ops_class_sessions set checked_out_at=v_now,outcome=p_input->>'outcome',
        topic_taught=nullif(left(trim(coalesce(p_input->>'topic','')),200),''),
        follow_up=nullif(left(trim(coalesce(p_input->>'followUp','')),1000),'')
      where id=v_session.id;
    end if;
  elsif p_mode='hqls_create' then
    v_id:=(p_input->>'streamId')::uuid;
    select * into v_stream from public.khpos_ops_academic_delivery_streams s where s.id=v_id and s.organisation_id=p_org;
    if v_stream.id is null then raise exception 'Academic Delivery stream not found.'; end if;
    if not khpos_private.ops_presence_leader(p_actor,p_org,v_stream.campus_id,v_stream.unit_id,array['SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER'])
      then raise exception 'Only an authorised instructional leader may observe this class.'; end if;
    select a.user_id,a.id into v_teacher,v_assignment from public.khpos_ops_role_assignments a where a.id=v_stream.teacher_assignment_id and a.status='active';
    if v_teacher is null or v_teacher=p_actor then raise exception 'Observations require an active teacher and independent observer.'; end if;
    v_mode:=p_input->>'observationMode';
    if v_mode not in ('full','walk') then raise exception 'Choose full observation or quick learning walk.'; end if;
    v_domains:=p_input->'domains';
    if jsonb_typeof(v_domains)<>'array' or jsonb_array_length(v_domains)<1 or jsonb_array_length(v_domains)>8
    then raise exception 'Provide valid HQLS stage evidence.'; end if;
    for v_domain in select value from jsonb_array_elements(v_domains) loop
      v_code:=v_domain->>'code';
      if not v_code=any(v_codes) or v_code=any(v_seen) then raise exception 'Invalid or repeated HQLS domain.'; end if;
      v_seen:=array_append(v_seen,v_code);
      if jsonb_typeof(v_domain->'score')<>'number' or (v_domain->>'score')::integer not between 1 and 3
        then raise exception 'Each observed domain needs a Strong (3), Partial (2), or Weak (1) score.'; end if;
      if length(trim(coalesce(v_domain->>'evidence','')))<12 then raise exception 'Each scored domain requires specific observed evidence (at least 12 characters).'; end if;
      v_score:=(v_domain->>'score')::integer;
      v_total:=v_total+v_score; v_count:=v_count+1;
      if coalesce((v_domain->>'automaticFailure')::boolean,false) then
        if not v_code=any(array['awakening','exploration','micro_illumination','first_trial','full_illumination','integration'])
        then raise exception 'The original rubric defines no automatic failure for this stage.'; end if;
        v_failure:=true;
      end if;
    end loop;
    if v_mode='full' and (v_count<>8 or not (v_seen @> v_codes))
    then raise exception 'Full fidelity scoring requires evidence for all eight HQLS domains.'; end if;
    if length(trim(coalesce(p_input->>'strengths','')))<8 then raise exception 'Record the observed instructional strengths.'; end if;
    if v_mode='full' then
      v_band:=case when v_total>=22 then 'model' when v_total>=17 then 'developing' else 'violation' end;
    else v_total:=null;v_band:=null;end if;
    v_action:=nullif(left(trim(coalesce(p_input->>'coachingAction','')),800),'');
    if (v_failure or v_band in ('developing','violation')) and v_action is null
    then v_action:='HQLS developmental coaching and repeat observation required'; end if;
    if p_input ? 'classSessionId' and nullif(p_input->>'classSessionId','') is not null
    then
      if not exists(select 1 from public.khpos_ops_class_sessions x
          where x.id=(p_input->>'classSessionId')::uuid and x.stream_id=v_stream.id and x.organisation_id=p_org)
      then raise exception 'The class session does not belong to this stream.'; end if;
    end if;
    insert into public.khpos_ops_hqls_fidelity_observations(
      organisation_id,stream_id,class_session_id,observer_user_id,teacher_user_id,
      observation_mode,domains,total_score,fidelity_band,automatic_failure,
      strengths,improvement_area,coaching_action,coaching_due_date
    ) values(p_org,v_stream.id,nullif(p_input->>'classSessionId','')::uuid,p_actor,v_teacher,
      v_mode,v_domains,v_total,v_band,v_failure,left(trim(p_input->>'strengths'),1000),
      nullif(left(trim(coalesce(p_input->>'improvement','')),1000),''),
      v_action,coalesce(nullif(p_input->>'coachingDue','')::date, case when v_action is not null then v_day+7 else null end))
    returning id into v_observation;
    if v_action is not null then
      insert into public.khpos_ops_work_items(organisation_id,campus_id,unit_id,owner_assignment_id,
         occurrence_key,title,description,status,priority,due_at,evidence_required,verification_required,created_by)
      values(p_org,v_stream.campus_id,v_stream.unit_id,v_assignment,'hqls:'||v_observation::text,
        case when v_band='violation' then 'HQLS retraining and coaching' else 'HQLS coaching follow-up' end,
        v_action,'pending',case when v_band='violation' or v_failure then 'high' else 'standard' end,
        (coalesce(nullif(p_input->>'coachingDue','')::date,v_day+7)::timestamp at time zone 'Africa/Lagos') + interval '17 hours',
        false,true,p_actor)
      returning id into v_id;
      update public.khpos_ops_hqls_fidelity_observations set coaching_work_id=v_id where id=v_observation;
    end if;
  elsif p_mode='hqls_acknowledge' then
    v_id:=(p_input->>'observationId')::uuid;
    if length(trim(coalesce(p_input->>'teacherResponse','')))<5 then raise exception 'Please record your professional reflection.'; end if;
    update public.khpos_ops_hqls_fidelity_observations x set teacher_response=left(trim(p_input->>'teacherResponse'),1500),
      teacher_acknowledged_at=v_now
      where x.id=v_id and x.organisation_id=p_org and x.teacher_user_id=p_actor and x.teacher_acknowledged_at is null;
    if not found then raise exception 'Only the observed teacher may acknowledge an unacknowledged observation.'; end if;
  else raise exception 'Unsupported school attendance or observation action.';
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.khpos_ops_presence_action_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_presence_action_server(uuid,uuid,text,jsonb) to service_role;
