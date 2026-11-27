create table public.khpos_learner_timetable_publications (
  school_id uuid not null references public.organisations(id) on delete cascade,
  kind text not null check (kind in ('lesson','assessment')),
  source_id uuid not null,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  class_label text not null,
  section_label text not null,
  subject_label text not null,
  term_id uuid not null references public.khpos_ops_academic_terms(id),
  published_by uuid not null,
  published_at timestamptz not null default now(),
  rescheduled boolean not null default false,
  details jsonb not null,
  primary key(school_id,kind,source_id)
);
create index khpos_learner_timetable_audience on public.khpos_learner_timetable_publications
  (school_id,campus_id,class_label,section_label,subject_label);
alter table public.khpos_learner_timetable_publications enable row level security;
revoke all on public.khpos_learner_timetable_publications from public,anon,authenticated,service_role;

create function public.khpos_publish_learner_timetable(p_actor uuid,p_school uuid,p_kind text,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  stream public.khpos_ops_academic_delivery_streams;
  source_stream uuid;
  payload jsonb;
  lesson public.khpos_ops_class_periods;
  paper public.khpos_assessment_slots;
begin
  if not coalesce(khpos_private.ops_hpd_has_membership(p_actor,p_school),false) then
    raise exception 'Active school membership is required.' using errcode='42501';
  end if;
  if p_kind='lesson' then
    select * into lesson from public.khpos_ops_class_periods
      where id=p_id and organisation_id=p_school and is_active for update;
    if lesson.teaching_group_kind='custom' then
      raise exception 'This lesson uses a custom group. Publish class or subject-enrolled groups only.' using errcode='22023';
    end if;
    source_stream := lesson.stream_id;
    payload := jsonb_build_object('weekday',lesson.weekday,'start',to_char(lesson.starts_at,'HH24:MI'),
      'end',to_char(lesson.ends_at,'HH24:MI'),'venue',lesson.room_label);
  elsif p_kind='assessment' then
    select * into paper from public.khpos_assessment_slots
      where id=p_id and organisation_id=p_school and cancelled_at is null for update;
    source_stream := paper.stream_id;
    payload := jsonb_build_object('title',paper.title,'type',paper.kind,'startsAt',paper.starts_at,'endsAt',paper.ends_at);
  end if;
  select * into stream from public.khpos_ops_academic_delivery_streams
    where id=source_stream and organisation_id=p_school and campus_id is not null and status in ('active','approved');
  if not found or not coalesce((
    khpos_private.ops_presence_leader(p_actor,p_school,stream.campus_id,stream.unit_id,
      array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'])
    or khpos_private.sectional_can_schedule(p_actor,p_school,stream.campus_id,stream.unit_id)
  ),false) then
    raise exception 'You can only publish active timetable entries for your campus or section.' using errcode='42501';
  end if;
  insert into public.khpos_learner_timetable_publications as previous
    (school_id,kind,source_id,campus_id,class_label,section_label,subject_label,term_id,published_by,details)
  values (p_school,p_kind,p_id,stream.campus_id,lower(btrim(stream.class_label)),
    lower(btrim(coalesce(stream.section_label,''))),lower(btrim(stream.subject_label)),stream.term_id,p_actor,
    payload || jsonb_build_object('subject',stream.subject_label))
  on conflict(school_id,kind,source_id) do update set
    campus_id=excluded.campus_id,class_label=excluded.class_label,section_label=excluded.section_label,
    subject_label=excluded.subject_label,term_id=excluded.term_id,published_by=excluded.published_by,
    published_at=now(),details=excluded.details,
    rescheduled=previous.rescheduled or (p_kind='assessment'
      and (previous.details->'startsAt',previous.details->'endsAt') is distinct from
          (excluded.details->'startsAt',excluded.details->'endsAt'));
end
$$;

create function public.khpos_read_learner_timetable(p_workspace uuid,p_campus uuid,p_class text,p_section text,p_subjects text[],p_session text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(x.record order by x.kind,x.day,x.start_time,x.id),'[]'::jsonb)
  from (
    select p.kind,p.source_id as id,coalesce((p.details->>'weekday')::int,0) as day,
      coalesce(p.details->>'startsAt',p.details->>'start') as start_time,
      p.details || jsonb_build_object('id',p.source_id,'kind',p.kind,
        'status',case when a.cancelled_at is not null then 'Cancelled' when p.rescheduled then 'Rescheduled' else 'Published' end) as record
    from public.khpos_learner_timetable_publications p
    join public.organisations o on o.id=p.school_id and o.status='active' and o.partner_status='active'
      and 'khpos_core'=any(o.partner_entitlements)
    join public.khpos_integrations i on i.organisation_id=p.school_id and i.provider='ksi' and i.status='active'
      and i.external_tenant_id=p_workspace::text
    join public.khpos_ops_campuses c on c.id=p.campus_id and c.organisation_id=p.school_id and c.status='active'
    join public.khpos_ops_academic_terms t on t.id=p.term_id and t.organisation_id=p.school_id
    left join public.khpos_ops_class_periods l on p.kind='lesson' and l.id=p.source_id and l.organisation_id=p.school_id
    left join public.khpos_assessment_slots a on p.kind='assessment' and a.id=p.source_id and a.organisation_id=p.school_id
    where p.campus_id=p_campus and p.class_label=lower(btrim(p_class)) and p.section_label=lower(btrim(p_section))
      and p.subject_label=any(p_subjects)
      and regexp_replace(t.session_label,'[^0-9]','','g') in (
        regexp_replace(p_session,'[^0-9]','','g'),
        split_part(p_session,'/',1)||right(split_part(p_session,'/',2),2))
      and t.status<>'cancelled'
      and ((l.is_active and t.status='active')
        or (a.id is not null and (p.details->>'startsAt')::timestamptz>=now()-interval '14 days'))
    order by p.kind,day,start_time,p.source_id limit 500
  ) x
$$;
revoke all on function public.khpos_publish_learner_timetable(uuid,uuid,text,uuid),public.khpos_read_learner_timetable(uuid,uuid,text,text,text[],text) from public,anon,authenticated;
grant execute on function public.khpos_publish_learner_timetable(uuid,uuid,text,uuid),public.khpos_read_learner_timetable(uuid,uuid,text,text,text[],text) to service_role;
