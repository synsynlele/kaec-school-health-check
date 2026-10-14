-- Controlled editing of manually created academic term and teaching-stream drafts.
-- Published/approved records remain immutable here; use the existing deployment action
-- or a governed revision instead. Both functions are service-role-only.

create or replace function public.khpos_ops_update_academic_draft_term_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_term_id uuid,
  p_input jsonb
) returns void language plpgsql security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_term public.khpos_ops_academic_terms%rowtype;
  v_campus uuid;
  v_session text := nullif(btrim(p_input->>'sessionLabel'),'');
  v_code text := nullif(btrim(p_input->>'termCode'),'');
  v_name text := nullif(btrim(p_input->>'termName'),'');
  v_start date;
  v_end date;
  v_before jsonb;
begin
  if not khpos_private.ops_academic_has_membership(p_actor_user_id,p_organisation_id)
     or not khpos_private.ops_academic_can_plan(p_actor_user_id,p_organisation_id) then
    raise exception 'Academic planning authority is required to edit a term.';
  end if;
  select * into v_term from public.khpos_ops_academic_terms
   where id=p_term_id and organisation_id=p_organisation_id for update;
  if v_term.id is null then raise exception 'Academic term not found in this school.'; end if;
  if v_term.status<>'draft' then
    raise exception 'Only draft academic terms can be edited. Active terms require controlled change.';
  end if;
  if v_session is null or v_code is null or v_name is null then
    raise exception 'Session, term code and name are required.';
  end if;
  v_campus := nullif(p_input->>'campusId','')::uuid;
  v_start := (p_input->>'startDate')::date;
  v_end := (p_input->>'endDate')::date;
  if v_start is null or v_end is null or v_end<v_start then
    raise exception 'Valid academic start and end dates are required.';
  end if;
  if v_campus is not null and not exists (
    select 1 from public.khpos_ops_campuses
    where id=v_campus and organisation_id=p_organisation_id and status='active'
  ) then raise exception 'Selected campus is not active in this school.'; end if;
  if v_campus is distinct from v_term.campus_id and exists (
    select 1 from public.khpos_ops_academic_delivery_streams where term_id=p_term_id
  ) then raise exception 'The campus cannot change after teaching streams have been created.'; end if;
  v_before := jsonb_build_object('campusId',v_term.campus_id,
    'sessionLabel',v_term.session_label,'termCode',v_term.term_code,
    'termName',v_term.term_name,'startDate',v_term.start_date,
    'endDate',v_term.end_date);
  update public.khpos_ops_academic_terms
  set campus_id=v_campus, session_label=left(v_session,120),
      term_code=left(v_code,60), term_name=left(v_name,120),
      start_date=v_start,end_date=v_end,updated_at=now()
  where id=p_term_id;
  insert into public.khpos_ops_academic_events
    (organisation_id,term_id,actor_user_id,event_type,from_state,to_state,note,metadata)
  values (p_organisation_id,p_term_id,p_actor_user_id,'term_draft_edited',
    'draft','draft','Academic term draft amended before activation.',
    jsonb_build_object('before',v_before,'after',jsonb_build_object(
    'campusId',v_campus,'sessionLabel',left(v_session,120),
    'termCode',left(v_code,60),'termName',left(v_name,120),
    'startDate',v_start,'endDate',v_end)));
end;
$$;

create or replace function public.khpos_ops_update_academic_draft_stream_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_stream_id uuid,
  p_input jsonb
) returns void language plpgsql security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_campus uuid;
  v_unit uuid;
  v_teacher uuid;
  v_class text := nullif(btrim(p_input->>'classLabel'),'');
  v_section text := nullif(btrim(p_input->>'sectionLabel'),'');
  v_subject text := nullif(btrim(p_input->>'subjectLabel'),'');
  v_scheme_source text := nullif(btrim(p_input->>'schemeSource'),'');
  v_scheme_ref text := nullif(btrim(p_input->>'schemeReference'),'');
  v_timetable_ref text := nullif(btrim(p_input->>'timetableReference'),'');
  v_weeks integer;
  v_before jsonb;
begin
  if not khpos_private.ops_academic_has_membership(p_actor_user_id,p_organisation_id)
    or not khpos_private.ops_academic_can_plan(p_actor_user_id,p_organisation_id) then
    raise exception 'Academic planning authority is required to edit teaching streams.';
  end if;
  select * into v_stream from public.khpos_ops_academic_delivery_streams
    where id=p_stream_id and organisation_id=p_organisation_id for update;
  if v_stream.id is null then raise exception 'Teaching stream not found in this school.'; end if;
  if v_stream.status<>'draft' then
    raise exception 'Only draft teaching streams can be edited. Approved streams require controlled change.';
  end if;
  v_campus := nullif(p_input->>'campusId','')::uuid;
  v_unit := nullif(p_input->>'unitId','')::uuid;
  v_teacher := nullif(p_input->>'teacherAssignmentId','')::uuid;
  v_weeks := (p_input->>'expectedWeeks')::integer;
  if v_class is null or v_subject is null or v_scheme_ref is null
    or v_timetable_ref is null or v_teacher is null then
    raise exception 'Class, subject, teacher, scheme and timetable are required.';
  end if;
  if v_scheme_source not in ('KSI','SIS','external','manual') or v_weeks is null or v_weeks not between 1 and 24 then
    raise exception 'Choose an approved scheme source and between 1 and 24 teaching weeks.';
  end if;
  if v_campus is not null and not exists (
    select 1 from public.khpos_ops_campuses
    where id=v_campus and organisation_id=p_organisation_id and status='active'
  ) then raise exception 'Teaching-stream campus is not active in this school.'; end if;
  if v_unit is not null and not exists (
    select 1 from public.khpos_ops_units
    where id=v_unit and organisation_id=p_organisation_id and status='active'
      and (campus_id is null or campus_id is not distinct from v_campus)
  ) then raise exception 'Teaching-stream unit does not belong to the selected school campus.'; end if;
  if not exists (
    select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.id=v_teacher and a.status='active' and r.organisation_id=p_organisation_id
      and r.status='active' and r.code='TEACHER'
  ) then raise exception 'Choose an active Teacher assignment in this school.'; end if;
  if exists (select 1 from public.khpos_ops_academic_weekly_targets wt
    where wt.stream_id=p_stream_id and wt.week_number>v_weeks) then
    raise exception 'Teaching weeks cannot be reduced below the existing weekly targets.';
  end if;
  v_before := jsonb_build_object('campusId',v_stream.campus_id,'unitId',v_stream.unit_id,
    'classLabel',v_stream.class_label,'sectionLabel',v_stream.section_label,
    'subjectLabel',v_stream.subject_label,'teacherAssignmentId',v_stream.teacher_assignment_id,
    'schemeSource',v_stream.scheme_source,'schemeReference',v_stream.scheme_reference,
    'timetableReference',v_stream.timetable_reference,'expectedWeeks',v_stream.expected_weeks);
  update public.khpos_ops_academic_delivery_streams
  set campus_id=v_campus,unit_id=v_unit,class_label=left(v_class,120),
    section_label=left(v_section,120),subject_label=left(v_subject,160),
    teacher_assignment_id=v_teacher,scheme_source=v_scheme_source,
    scheme_reference=left(v_scheme_ref,1000),timetable_reference=left(v_timetable_ref,1000),
    expected_weeks=v_weeks,updated_at=now()
  where id=p_stream_id;
  insert into public.khpos_ops_academic_events
    (organisation_id,term_id,stream_id,actor_user_id,event_type,from_state,to_state,note,metadata)
  values (p_organisation_id,v_stream.term_id,p_stream_id,p_actor_user_id,
    'teaching_stream_draft_edited','draft','draft',
    'Teaching delivery stream draft updated before approval.',
    jsonb_build_object('before',v_before,'after',jsonb_build_object(
      'campusId',v_campus,'unitId',v_unit,'classLabel',left(v_class,120),
      'sectionLabel',left(v_section,120),'subjectLabel',left(v_subject,160),
      'teacherAssignmentId',v_teacher,'schemeSource',v_scheme_source,
      'schemeReference',left(v_scheme_ref,1000),
      'timetableReference',left(v_timetable_ref,1000),'expectedWeeks',v_weeks)));
end;
$$;

revoke all on function public.khpos_ops_update_academic_draft_term_server(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.khpos_ops_update_academic_draft_stream_server(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_update_academic_draft_term_server(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.khpos_ops_update_academic_draft_stream_server(uuid,uuid,uuid,jsonb) to service_role;
