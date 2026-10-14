-- KHP-OS safe, non-destructive academic record lifecycle.
-- Only ADD columns and CREATE functions. No dropping constraints, no row deletion.
-- "Remove" hides an UNUSED record but leaves it restorable and fully audited.
-- Existing O12 status CHECK constraints remain unchanged.

alter table public.khpos_ops_academic_terms
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists status_before_archive text,
  add column if not exists removed_at timestamptz,
  add column if not exists revision_number integer not null default 1;

alter table public.khpos_ops_academic_delivery_streams
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists status_before_archive text,
  add column if not exists removed_at timestamptz,
  add column if not exists revision_number integer not null default 1;

create table if not exists public.khpos_ops_academic_record_audit (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  record_kind text not null check (record_kind in ('term','stream')),
  record_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('edit','archive','restore','remove')),
  reason text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_khpos_academic_record_audit_record
  on public.khpos_ops_academic_record_audit(organisation_id,record_kind,record_id,created_at desc);
alter table public.khpos_ops_academic_record_audit enable row level security;
revoke all on public.khpos_ops_academic_record_audit from public,anon,authenticated;
grant select,insert on public.khpos_ops_academic_record_audit to service_role;

create or replace function khpos_private.ops_academic_manage_authority(
  p_actor_user_id uuid,p_organisation_id uuid
) returns boolean language sql stable security definer
set search_path=public,auth,khpos_private,pg_temp as $$
  select khpos_private.ops_academic_has_membership(p_actor_user_id,p_organisation_id)
    and (
      khpos_private.ops_academic_can_plan(p_actor_user_id,p_organisation_id)
      or khpos_private.ops_academic_actor_has_role(
        p_actor_user_id,p_organisation_id,array['SCHOOL_CUSTODIAN']
      )
    );
$$;

-- Include school-level custodian in academic leadership permission without
-- granting cross-school authority.
create or replace function khpos_private.ops_academic_can_plan(
  p_actor_user_id uuid,p_organisation_id uuid
) returns boolean language sql stable security definer
set search_path=public,auth,khpos_private,pg_temp as $$
  select khpos_private.ops_academic_member_role(p_actor_user_id,p_organisation_id)='executive'
    or khpos_private.ops_academic_actor_has_role(
      p_actor_user_id,p_organisation_id,
      array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR']
    );
$$;

create or replace function public.khpos_ops_manage_academic_term_server(
  p_actor_user_id uuid,p_organisation_id uuid,p_term_id uuid,
  p_action text,p_reason text,p_input jsonb default '{}'::jsonb
) returns void language plpgsql security definer
set search_path=public,auth,khpos_private,pg_temp as $$
declare
  v_term public.khpos_ops_academic_terms%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_reason text := left(btrim(coalesce(p_reason,'')),2000);
  v_campus uuid;
  v_session text;
  v_code text;
  v_name text;
  v_start date;
  v_end date;
  v_undo_status text;
begin
  if not khpos_private.ops_academic_manage_authority(p_actor_user_id,p_organisation_id) then
    raise exception 'Only authorised school academic leadership can manage academic records.';
  end if;
  if p_action not in ('edit','archive','restore','remove') then
    raise exception 'Unsupported academic term management action.';
  end if;
  select * into v_term from public.khpos_ops_academic_terms
    where id=p_term_id and organisation_id=p_organisation_id for update;
  if v_term.id is null then raise exception 'Academic term not found in this school.'; end if;
  if p_action='edit' and v_term.status='draft' and v_reason='' then
    v_reason := 'Routine academic term draft correction';
  end if;
  if length(v_reason)<10 then raise exception 'Explain the change in at least 10 characters.'; end if;
  v_before := to_jsonb(v_term);
  if p_action='edit' then
    if v_term.status in ('closed','cancelled') or v_term.archived_at is not null then
      raise exception 'This term is archived or finalised. Restore an archived term, or create a controlled new term.';
    end if;
    v_campus := nullif(p_input->>'campusId','')::uuid;
    v_session := nullif(btrim(p_input->>'sessionLabel'),'');
    v_code := nullif(btrim(p_input->>'termCode'),'');
    v_name := nullif(btrim(p_input->>'termName'),'');
    v_start := (p_input->>'startDate')::date;
    v_end := (p_input->>'endDate')::date;
    if v_session is null or v_code is null or v_name is null or
       v_start is null or v_end is null or v_end<v_start then
      raise exception 'Academic term needs session, code, name and valid dates.';
    end if;
    if v_campus is not null and not exists (
      select 1 from public.khpos_ops_campuses
      where id=v_campus and organisation_id=p_organisation_id and status='active'
    ) then raise exception 'Selected campus is not active in this school.'; end if;
    if v_campus is distinct from v_term.campus_id and exists (
      select 1 from public.khpos_ops_academic_delivery_streams where term_id=p_term_id
    ) then raise exception 'Campus cannot change after teaching streams have been created.'; end if;
    if (v_start is distinct from v_term.start_date or v_end is distinct from v_term.end_date) then
      if exists (
        select 1 from public.khpos_ops_academic_weekly_targets wt
        join public.khpos_ops_academic_delivery_streams s on s.id=wt.stream_id
        where s.term_id=p_term_id and (
          wt.state<>'planned'
          or (wt.planned_start_date is not null and (wt.planned_start_date<v_start or wt.planned_start_date>v_end))
          or (wt.planned_end_date is not null and (wt.planned_end_date<v_start or wt.planned_end_date>v_end))
        )
      ) or exists (
        select 1 from public.khpos_ops_assessment_cycles ac where ac.term_id=p_term_id
      ) then
        raise exception 'Term dates cannot move beyond planned teaching dates or after delivery/assessment activity. Use a formal exception process.';
      end if;
    end if;
    update public.khpos_ops_academic_terms
      set campus_id=v_campus,session_label=left(v_session,120),
        term_code=left(v_code,60),term_name=left(v_name,120),
        start_date=v_start,end_date=v_end,
        revision_number=revision_number+1,updated_at=now()
      where id=p_term_id;

  elsif p_action='archive' then
    if v_term.archived_at is not null then raise exception 'Term is already archived.'; end if;
    if exists (
      select 1 from public.khpos_ops_academic_delivery_streams
      where term_id=p_term_id and status in ('draft','approved','active')
        and archived_at is null and removed_at is null
    ) then raise exception 'Archive, remove or complete its active curriculum streams first.'; end if;
    if exists (
      select 1 from public.khpos_ops_assessment_cycles
      where term_id=p_term_id and status not in ('closed','cancelled')
    ) then raise exception 'Finish outstanding assessment cycles before archiving this term.'; end if;
    if v_term.status='active' and exists (
      select 1 from public.khpos_ops_project_cycles where term_id=p_term_id
    ) then raise exception 'An active project cycle belongs to this term. Complete it before archiving.'; end if;
    update public.khpos_ops_academic_terms
      set status_before_archive=v_term.status,status='cancelled',
        archived_at=now(),archived_by=p_actor_user_id,
        archive_reason=v_reason,updated_at=now() where id=p_term_id;

  elsif p_action='restore' then
    if v_term.archived_at is null then raise exception 'Only archived or removed terms can be restored.'; end if;
    v_undo_status := v_term.status_before_archive;
    if v_undo_status not in ('draft','active','closed','cancelled') then
      raise exception 'Original term state is not available for restoration.'; end if;
    if v_undo_status='active' and exists (
      select 1 from public.khpos_ops_academic_terms
      where organisation_id=p_organisation_id and id<>p_term_id and status='active'
        and campus_id is not distinct from v_term.campus_id
    ) then raise exception 'Another term is already active for this campus.'; end if;
    update public.khpos_ops_academic_terms
      set status=v_undo_status,archived_at=null,archived_by=null,removed_at=null,
        archive_reason=null,status_before_archive=null,updated_at=now()
      where id=p_term_id;

  elsif p_action='remove' then
    if v_term.status not in ('draft','cancelled') or v_term.archived_at is not null then
      raise exception 'Only unused drafts or cancelled terms can be removed. Archive completed terms.';
    end if;
    if exists (select 1 from public.khpos_ops_academic_delivery_streams where term_id=p_term_id)
      or exists (select 1 from public.khpos_ops_assessment_cycles where term_id=p_term_id)
      or exists (select 1 from public.khpos_ops_project_cycles where term_id=p_term_id)
      or exists (select 1 from public.khpos_ops_skill_offerings where term_id=p_term_id)
      or exists (select 1 from public.khpos_ops_learner_term_reviews where term_id=p_term_id)
    then raise exception 'Linked school work exists. Archive the term instead of removing it.'; end if;
    update public.khpos_ops_academic_terms
      set status_before_archive=v_term.status,status='cancelled',
        archived_at=now(),removed_at=now(),archived_by=p_actor_user_id,
        archive_reason=v_reason,updated_at=now() where id=p_term_id;
  end if;

  select to_jsonb(t) into v_after
    from public.khpos_ops_academic_terms t where t.id=p_term_id;
  insert into public.khpos_ops_academic_record_audit (
    organisation_id,record_kind,record_id,actor_user_id,action,reason,before_state,after_state
  ) values (p_organisation_id,'term',p_term_id,p_actor_user_id,p_action,v_reason,v_before,v_after);
end;
$$;

create or replace function public.khpos_ops_manage_academic_stream_server(
  p_actor_user_id uuid,p_organisation_id uuid,p_stream_id uuid,
  p_action text,p_reason text,p_input jsonb default '{}'::jsonb
) returns void language plpgsql security definer
set search_path=public,auth,khpos_private,pg_temp as $$
declare
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_reason text := left(btrim(coalesce(p_reason,'')),2000);
  v_campus uuid;
  v_unit uuid;
  v_teacher uuid;
  v_class text;
  v_section text;
  v_subject text;
  v_scheme_source text;
  v_scheme_ref text;
  v_timetable_ref text;
  v_weeks integer;
  v_progressed boolean;
  v_identity_change boolean;
  v_undo_status text;
  v_term_status text;
begin
  if not khpos_private.ops_academic_manage_authority(p_actor_user_id,p_organisation_id) then
    raise exception 'Only authorised school academic leadership can manage curriculum records.';
  end if;
  if p_action not in ('edit','archive','restore','remove') then
    raise exception 'Unsupported curriculum management action.';
  end if;
  select * into v_stream from public.khpos_ops_academic_delivery_streams
    where id=p_stream_id and organisation_id=p_organisation_id for update;
  if v_stream.id is null then raise exception 'Teaching stream not found in this school.'; end if;
  if p_action='edit' and v_stream.status='draft' and v_reason='' then
    v_reason := 'Routine teaching stream draft correction';
  end if;
  if length(v_reason)<10 then raise exception 'Explain the change in at least 10 characters.'; end if;
  v_before := to_jsonb(v_stream);
  select status into v_term_status from public.khpos_ops_academic_terms
    where id=v_stream.term_id and organisation_id=p_organisation_id;
  if p_action='edit' then
    if v_stream.status in ('closed','cancelled') or v_stream.archived_at is not null then
      raise exception 'Closed, cancelled or archived curriculum streams cannot be edited. Restore an archived stream first.';
    end if;
    if exists (select 1 from public.khpos_ops_academic_terms t where t.id=v_stream.term_id and t.archived_at is not null) then raise exception 'Restore the academic term before editing its curriculum stream.'; end if;
    v_campus := nullif(p_input->>'campusId','')::uuid;
    v_unit := nullif(p_input->>'unitId','')::uuid;
    v_teacher := nullif(p_input->>'teacherAssignmentId','')::uuid;
    v_class := nullif(btrim(p_input->>'classLabel'),'');
    v_section := nullif(btrim(p_input->>'sectionLabel'),'');
    v_subject := nullif(btrim(p_input->>'subjectLabel'),'');
    v_scheme_source := nullif(btrim(p_input->>'schemeSource'),'');
    v_scheme_ref := nullif(btrim(p_input->>'schemeReference'),'');
    v_timetable_ref := nullif(btrim(p_input->>'timetableReference'),'');
    v_weeks := (p_input->>'expectedWeeks')::integer;
    if v_class is null or v_subject is null or v_scheme_ref is null or
       v_timetable_ref is null or v_teacher is null then
      raise exception 'Class, subject, teacher, scheme and timetable are required.';
    end if;
    if v_scheme_source not in ('KSI','SIS','external','manual') or
       v_weeks is null or v_weeks not between 1 and 24 then
      raise exception 'Choose a valid scheme and between 1 and 24 teaching weeks.';
    end if;
    if v_campus is not null and not exists (
      select 1 from public.khpos_ops_campuses where id=v_campus
        and organisation_id=p_organisation_id and status='active'
    ) then raise exception 'Teaching stream campus is not active in this school.'; end if;
    if v_unit is not null and not exists (
      select 1 from public.khpos_ops_units
      where id=v_unit and organisation_id=p_organisation_id and status='active'
        and (campus_id is null or campus_id is not distinct from v_campus)
    ) then raise exception 'Selected unit does not belong to the campus.'; end if;
    if not exists (
      select 1 from public.khpos_ops_role_assignments a
      join public.khpos_ops_roles r on r.id=a.role_id
      where a.id=v_teacher and a.status='active' and r.organisation_id=p_organisation_id
        and r.status='active' and r.code='TEACHER'
    ) then raise exception 'Choose an active teacher assignment in this school.'; end if;
    if exists (
      select 1 from public.khpos_ops_academic_weekly_targets wt
      where wt.stream_id=p_stream_id and wt.week_number>v_weeks
    ) then raise exception 'Teaching weeks cannot be less than the highest existing weekly target.'; end if;
    v_identity_change :=
      v_campus is distinct from v_stream.campus_id or
      v_unit is distinct from v_stream.unit_id or
      v_class is distinct from v_stream.class_label or
      v_section is distinct from v_stream.section_label or
      v_subject is distinct from v_stream.subject_label or
      v_teacher is distinct from v_stream.teacher_assignment_id;
    v_progressed := exists (
      select 1 from public.khpos_ops_academic_weekly_targets wt
      where wt.stream_id=p_stream_id and (
        wt.state<>'planned' or wt.readiness_note is not null or
        wt.delivery_note is not null or wt.delivered_at is not null or
        wt.verification_state<>'unverified'
      )
    );
    if v_identity_change and v_progressed then
      raise exception 'Recorded teaching activity prevents changing class, campus, subject or teacher identity here. Use controlled redeployment/correction.';
    end if;
    if v_identity_change and (
      exists (select 1 from public.khpos_ops_assessment_packages where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_academic_integrity_cases where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_class_sessions where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_class_periods where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_hqls_fidelity_observations where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_academic_observations where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_academic_debt where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_result_corrections where stream_id=p_stream_id)
    ) then
      raise exception 'Linked academic records prevent changing stream identity. Use controlled correction or redeployment.';
    end if;
    update public.khpos_ops_academic_delivery_streams
      set campus_id=v_campus,unit_id=v_unit,class_label=left(v_class,120),
        section_label=left(v_section,120),subject_label=left(v_subject,160),
        teacher_assignment_id=v_teacher,scheme_source=v_scheme_source,
        scheme_reference=left(v_scheme_ref,1000),timetable_reference=left(v_timetable_ref,1000),
        expected_weeks=v_weeks,revision_number=revision_number+1,updated_at=now()
      where id=p_stream_id;

  elsif p_action='archive' then
    if v_stream.archived_at is not null then raise exception 'Curriculum stream is already archived.'; end if;
    if v_stream.status in ('draft','approved','active') and exists (
      select 1 from public.khpos_ops_academic_weekly_targets
      where stream_id=p_stream_id and (
        state not in ('planned','closed')
        or (state='planned' and (delivery_note is not null or delivered_at is not null
          or verification_state<>'unverified'))
      )
    ) then raise exception 'Complete delivery, verification and recovery before archiving.'; end if;
    if exists (select 1 from public.khpos_ops_academic_debt
      where stream_id=p_stream_id and status<>'closed')
    then raise exception 'An unresolved recovery debt must be closed first.'; end if;
    if exists (select 1 from public.khpos_ops_academic_observations
      where stream_id=p_stream_id and follow_up_status in ('open','evidence_submitted'))
    then raise exception 'A teaching observation follow-up is still open.'; end if;
    update public.khpos_ops_academic_delivery_streams
      set status_before_archive=v_stream.status,status='cancelled',
        archived_at=now(),archived_by=p_actor_user_id,
        archive_reason=v_reason,updated_at=now() where id=p_stream_id;

  elsif p_action='restore' then
    if v_stream.archived_at is null then raise exception 'Only archived or removed streams can be restored.'; end if;
    v_undo_status := v_stream.status_before_archive;
    if v_undo_status not in ('draft','approved','active','closed','cancelled') then
      raise exception 'Original curriculum status cannot be restored.'; end if;
    if v_undo_status='active' and v_term_status<>'active' then
      raise exception 'Restore the active academic term before restoring this stream.';
    end if;
    if v_undo_status in ('draft','approved') and v_term_status not in ('draft','active') then
      raise exception 'Restore the parent academic term before the curriculum stream.';
    end if;
    update public.khpos_ops_academic_delivery_streams
      set status=v_undo_status,archived_at=null,archived_by=null,removed_at=null,
        archive_reason=null,status_before_archive=null,updated_at=now()
      where id=p_stream_id;

  elsif p_action='remove' then
    if v_stream.status not in ('draft','approved','cancelled') or v_stream.archived_at is not null then
      raise exception 'Only unused draft, approved or cancelled streams can be removed. Archive the rest.';
    end if;
    if exists (select 1 from public.khpos_ops_academic_weekly_targets where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_assessment_packages where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_academic_observations where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_academic_debt where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_class_sessions where stream_id=p_stream_id)
      or exists (select 1 from public.khpos_ops_class_periods where stream_id=p_stream_id)
    then raise exception 'Linked academic work exists. Archive this stream instead.'; end if;
    update public.khpos_ops_academic_delivery_streams
      set status_before_archive=v_stream.status,status='cancelled',
        archived_at=now(),removed_at=now(),archived_by=p_actor_user_id,
        archive_reason=v_reason,updated_at=now() where id=p_stream_id;
  end if;

  select to_jsonb(s) into v_after
    from public.khpos_ops_academic_delivery_streams s where s.id=p_stream_id;
  insert into public.khpos_ops_academic_record_audit (
    organisation_id,record_kind,record_id,actor_user_id,action,reason,before_state,after_state
  ) values (p_organisation_id,'stream',p_stream_id,p_actor_user_id,p_action,v_reason,v_before,v_after);
end;
$$;

revoke all on function khpos_private.ops_academic_manage_authority(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_manage_academic_term_server(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.khpos_ops_manage_academic_stream_server(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_manage_academic_term_server(uuid,uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.khpos_ops_manage_academic_stream_server(uuid,uuid,uuid,text,text,jsonb) to service_role;


-- Preserve records and block *new work* under an archived or removed
-- curriculum stream. This is additive: no existing triggers are dropped.
create or replace function khpos_private.ops_reject_inactive_academic_stream()
returns trigger language plpgsql security definer
set search_path=public,auth,khpos_private,pg_temp as $$
begin
  if new.stream_id is not null and exists (
    select 1 from public.khpos_ops_academic_delivery_streams s
    where s.id=new.stream_id and s.archived_at is not null
  ) then
    raise exception 'Restore this archived or removed curriculum stream before recording new academic work.';
  end if;
  return new;
end;
$$;
create trigger khpos_record_lifecycle_target_guard
before insert or update on public.khpos_ops_academic_weekly_targets
for each row execute function khpos_private.ops_reject_inactive_academic_stream();
create trigger khpos_record_lifecycle_debt_guard
before insert or update on public.khpos_ops_academic_debt
for each row execute function khpos_private.ops_reject_inactive_academic_stream();
create trigger khpos_record_lifecycle_observation_guard
before insert or update on public.khpos_ops_academic_observations
for each row execute function khpos_private.ops_reject_inactive_academic_stream();
create trigger khpos_record_lifecycle_assessment_guard
before insert or update on public.khpos_ops_assessment_packages
for each row execute function khpos_private.ops_reject_inactive_academic_stream();
create trigger khpos_record_lifecycle_class_session_guard
before insert or update on public.khpos_ops_class_sessions
for each row execute function khpos_private.ops_reject_inactive_academic_stream();
create trigger khpos_record_lifecycle_class_period_guard
before insert or update on public.khpos_ops_class_periods
for each row execute function khpos_private.ops_reject_inactive_academic_stream();
revoke all on function khpos_private.ops_reject_inactive_academic_stream()
from public,anon,authenticated;
