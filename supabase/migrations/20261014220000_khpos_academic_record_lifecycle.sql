-- KHP-OS controlled academic-record lifecycle.
-- Never cascade-delete school work: delete is restricted to records with zero
-- referencing business records. The independent audit log survives deletion.

alter table public.khpos_ops_academic_terms
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists status_before_archive text,
  add column if not exists revision_number integer not null default 1;

alter table public.khpos_ops_academic_delivery_streams
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists status_before_archive text,
  add column if not exists revision_number integer not null default 1;

alter table public.khpos_ops_academic_terms
  drop constraint if exists khpos_ops_academic_terms_status_check;
alter table public.khpos_ops_academic_terms
  add constraint khpos_ops_academic_terms_status_check
  check (status in ('draft','active','closed','cancelled','archived'));

alter table public.khpos_ops_academic_delivery_streams
  drop constraint if exists khpos_ops_academic_delivery_streams_status_check;
alter table public.khpos_ops_academic_delivery_streams
  add constraint khpos_ops_academic_delivery_streams_status_check
  check (status in ('draft','approved','active','closed','cancelled','archived'));

create table if not exists public.khpos_ops_academic_record_audit (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  record_kind text not null check (record_kind in ('term','stream')),
  record_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('edit','archive','restore','delete')),
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

-- Inspect the ACTUAL FK graph, rather than hardcoding one subset of
-- academic dependents. This protects skills, assessments, portfolios etc.
create or replace function khpos_private.ops_academic_record_dependencies(
  p_parent regclass, p_record_id uuid, p_skip_tables text[] default '{}'::text[]
) returns text[] language plpgsql security definer
set search_path=pg_catalog,public,khpos_private,pg_temp as $$
declare
  v_fk record;
  v_found boolean;
  v_blocking text[] := '{}'::text[];
begin
  for v_fk in
    select ns.nspname as schema_name, cls.relname as table_name,
      att.attname as column_name, cardinality(fk.conkey) as key_size
    from pg_catalog.pg_constraint fk
    join pg_catalog.pg_class cls on cls.oid=fk.conrelid
    join pg_catalog.pg_namespace ns on ns.oid=cls.relnamespace
    left join pg_catalog.pg_attribute att
      on att.attrelid=cls.oid and att.attnum=fk.conkey[1]
    where fk.contype='f' and fk.confrelid=p_parent
      and ns.nspname='public'
  loop
    if v_fk.key_size<>1 or v_fk.column_name is null then
      raise exception 'A compound relationship prevents safe deletion. Contact system administration.';
    end if;
    if v_fk.table_name=any(p_skip_tables) then continue; end if;
    execute format('select exists (select 1 from %I.%I where %I=$1)',
      v_fk.schema_name,v_fk.table_name,v_fk.column_name)
      into v_found using p_record_id;
    if v_found then v_blocking := array_append(v_blocking,v_fk.table_name); end if;
  end loop;
  return v_blocking;
end;
$$;

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
  v_dep text[];
  v_campus uuid;
  v_session text;
  v_code text;
  v_name text;
  v_start date;
  v_end date;
  v_undo_status text;
begin
  if not khpos_private.ops_academic_manage_authority(p_actor_user_id,p_organisation_id) then
    raise exception 'Only authorised academic leadership or the School Custodian can manage academic records.';
  end if;
  if p_action not in ('edit','archive','restore','delete') then
    raise exception 'Unsupported academic term management action.';
  end if;
  select * into v_term from public.khpos_ops_academic_terms
    where id=p_term_id and organisation_id=p_organisation_id for update;
  if v_term.id is null then raise exception 'Academic term not found in this school.'; end if;
  if p_action='edit' and v_term.status='draft' and v_reason='' then v_reason := 'Routine draft correction'; end if;
  if length(v_reason)<10 then raise exception 'Explain the change in at least 10 characters for the audit record.'; end if;
  v_before := to_jsonb(v_term);
  if p_action='edit' then
    if v_term.status in ('archived','closed','cancelled') then
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
    if v_term.status='archived' then raise exception 'Academic term is already archived.'; end if;
    if exists (
      select 1 from public.khpos_ops_academic_delivery_streams
      where term_id=p_term_id and status not in ('archived','cancelled','closed')
    ) then
      raise exception 'Archive or complete the linked curriculum streams before archiving this term.';
    end if;
    v_dep := khpos_private.ops_academic_record_dependencies(
      'public.khpos_ops_academic_terms'::regclass,p_term_id,
      array['khpos_ops_academic_events','khpos_ops_academic_delivery_streams']
    );
    if cardinality(v_dep)>0 then
      raise exception 'This term has linked school records (%). Keep it active until those workflows are completed and retained.',array_to_string(v_dep,', ');
    end if;
    update public.khpos_ops_academic_terms
      set status_before_archive=v_term.status,status='archived',
        archived_at=now(),archived_by=p_actor_user_id,
        archive_reason=v_reason,updated_at=now() where id=p_term_id;

  elsif p_action='restore' then
    if v_term.status<>'archived' then raise exception 'Only archived terms can be restored.'; end if;
    v_undo_status := v_term.status_before_archive;
    if v_undo_status is null or v_undo_status='archived' then
      raise exception 'This term has no safe restoration status.';
    end if;
    if v_undo_status='active' and exists (
      select 1 from public.khpos_ops_academic_terms t
      where t.organisation_id=p_organisation_id and t.id<>p_term_id
        and t.status='active' and t.campus_id is not distinct from v_term.campus_id
    ) then raise exception 'Another academic term is already active for this school campus. Close it before restoring this term.'; end if;
    update public.khpos_ops_academic_terms
      set status=v_undo_status,archived_at=null,archived_by=null,
        archive_reason=null,status_before_archive=null,updated_at=now()
      where id=p_term_id;

  elsif p_action='delete' then
    -- No delete through indirect cascades, including fully archived children.
    v_dep := khpos_private.ops_academic_record_dependencies(
      'public.khpos_ops_academic_terms'::regclass,p_term_id,
      array['khpos_ops_academic_events']
    );
    if cardinality(v_dep)>0 then
      raise exception 'Cannot delete: linked records exist (%). Archive instead.',array_to_string(v_dep,', ');
    end if;
    if v_term.status in ('active','closed') or
       (v_term.status='archived' and v_term.status_before_archive in ('active','closed')) then
      raise exception 'Active or historically completed terms cannot be permanently deleted. Archive instead.';
    end if;
    delete from public.khpos_ops_academic_terms where id=p_term_id;
  end if;

  if p_action='delete' then
    v_after := null;
  else
    select to_jsonb(t) into v_after
      from public.khpos_ops_academic_terms t where t.id=p_term_id;
  end if;
  insert into public.khpos_ops_academic_record_audit (
    organisation_id,record_kind,record_id,actor_user_id,action,reason,before_state,after_state
  ) values (
    p_organisation_id,'term',p_term_id,p_actor_user_id,p_action,v_reason,v_before,v_after
  );
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
  v_dep text[];
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
    raise exception 'Only authorised academic leadership or the School Custodian can manage teaching streams.';
  end if;
  if p_action not in ('edit','archive','restore','delete') then
    raise exception 'Unsupported teaching stream management action.';
  end if;
  select * into v_stream from public.khpos_ops_academic_delivery_streams
    where id=p_stream_id and organisation_id=p_organisation_id for update;
  if v_stream.id is null then raise exception 'Teaching stream not found in this school.'; end if;
  if p_action='edit' and v_stream.status='draft' and v_reason='' then v_reason := 'Routine draft correction'; end if;
  if length(v_reason)<10 then raise exception 'Explain the change in at least 10 characters for the audit record.'; end if;
  v_before := to_jsonb(v_stream);
  select status into v_term_status from public.khpos_ops_academic_terms
    where id=v_stream.term_id and organisation_id=p_organisation_id;
  if p_action='edit' then
    if v_stream.status in ('archived','closed','cancelled') then
      raise exception 'Closed, cancelled or archived curriculum streams cannot be edited. Restore an archived stream first.';
    end if;
    if v_term_status='archived' then raise exception 'Restore the academic term before editing its curriculum stream.'; end if;
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
    if v_identity_change then
      v_dep := khpos_private.ops_academic_record_dependencies(
        'public.khpos_ops_academic_delivery_streams'::regclass,p_stream_id,
        array['khpos_ops_academic_events','khpos_ops_academic_weekly_targets']
      );
      if cardinality(v_dep)>0 then
        raise exception 'Changing stream identity would affect linked records (%). Use controlled correction.',array_to_string(v_dep,', ');
      end if;
    end if;
    update public.khpos_ops_academic_delivery_streams
      set campus_id=v_campus,unit_id=v_unit,class_label=left(v_class,120),
        section_label=left(v_section,120),subject_label=left(v_subject,160),
        teacher_assignment_id=v_teacher,scheme_source=v_scheme_source,
        scheme_reference=left(v_scheme_ref,1000),timetable_reference=left(v_timetable_ref,1000),
        expected_weeks=v_weeks,revision_number=revision_number+1,updated_at=now()
      where id=p_stream_id;

  elsif p_action='archive' then
    if v_stream.status='archived' then raise exception 'Teaching stream is already archived.'; end if;
    if exists (
      select 1 from public.khpos_ops_academic_weekly_targets wt
      where wt.stream_id=p_stream_id and (
        wt.state<>'planned' or wt.readiness_note is not null or
        wt.delivery_note is not null or wt.delivered_at is not null or
        wt.verification_state<>'unverified'
      )
    ) then raise exception 'This stream has teaching or verification activity. Complete the operational close-out before archiving.'; end if;
    v_dep := khpos_private.ops_academic_record_dependencies(
      'public.khpos_ops_academic_delivery_streams'::regclass,p_stream_id,
      array['khpos_ops_academic_events','khpos_ops_academic_weekly_targets']
    );
    if cardinality(v_dep)>0 then
      raise exception 'Cannot archive while linked operational records exist (%). Complete those workflows first.',array_to_string(v_dep,', ');
    end if;
    update public.khpos_ops_academic_delivery_streams
      set status_before_archive=v_stream.status,status='archived',
        archived_at=now(),archived_by=p_actor_user_id,
        archive_reason=v_reason,updated_at=now() where id=p_stream_id;

  elsif p_action='restore' then
    if v_stream.status<>'archived' then raise exception 'Only archived teaching streams can be restored.'; end if;
    if v_term_status='archived' then raise exception 'Restore the academic term first.'; end if;
    v_undo_status := v_stream.status_before_archive;
    if v_undo_status not in ('draft','approved','active','closed','cancelled') then
      raise exception 'This stream has no valid restoration state.';
    end if;
    if v_undo_status in ('draft','approved','active') and v_term_status not in ('draft','active') then
      raise exception 'Restore an active or draft academic term before restoring this curriculum stream.';
    end if;
    if v_undo_status='approved' and v_term_status='active' then v_undo_status:='active'; end if;
    if v_undo_status='active' and v_term_status<>'active' then
      raise exception 'An active teaching stream needs an active academic term before restoration.';
    end if;
    update public.khpos_ops_academic_delivery_streams
      set status=v_undo_status,archived_at=null,archived_by=null,
        archive_reason=null,status_before_archive=null,updated_at=now()
      where id=p_stream_id;

  elsif p_action='delete' then
    v_dep := khpos_private.ops_academic_record_dependencies(
      'public.khpos_ops_academic_delivery_streams'::regclass,p_stream_id,
      array['khpos_ops_academic_events']
    );
    if cardinality(v_dep)>0 then
      raise exception 'Cannot permanently delete: linked records exist (%). Archive instead.',array_to_string(v_dep,', ');
    end if;
    if v_stream.status in ('active','closed') or
       (v_stream.status='archived' and v_stream.status_before_archive in ('active','closed')) then
      raise exception 'Activated or completed curriculum streams cannot be permanently deleted. Archive instead.';
    end if;
    delete from public.khpos_ops_academic_delivery_streams where id=p_stream_id;
  end if;

  if p_action='delete' then
    v_after := null;
  else
    select to_jsonb(s) into v_after
      from public.khpos_ops_academic_delivery_streams s where s.id=p_stream_id;
  end if;
  insert into public.khpos_ops_academic_record_audit (
    organisation_id,record_kind,record_id,actor_user_id,action,reason,before_state,after_state
  ) values (
    p_organisation_id,'stream',p_stream_id,p_actor_user_id,p_action,v_reason,v_before,v_after
  );
end;
$$;

revoke all on function khpos_private.ops_academic_record_dependencies(regclass,uuid,text[]) from public,anon,authenticated;
revoke all on function khpos_private.ops_academic_manage_authority(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_manage_academic_term_server(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.khpos_ops_manage_academic_stream_server(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_manage_academic_term_server(uuid,uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.khpos_ops_manage_academic_stream_server(uuid,uuid,uuid,text,text,jsonb) to service_role;


-- School Custodian is the accountable school-level authority above the Guardian.
-- Restore its planning visibility in legacy O12 academic delivery without
-- removing existing Guardian or Academic Inspector access.
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


-- Stop new evidence or delivery operations against archived streams.
-- The existing record and its historical children remain untouched.
create or replace function khpos_private.ops_academic_reject_archived_stream_work()
returns trigger language plpgsql security definer
set search_path=public,auth,khpos_private,pg_temp as $$
begin
  if exists (
    select 1 from public.khpos_ops_academic_delivery_streams s
    where s.id=NEW.stream_id and s.status='archived'
  ) then
    raise exception 'This curriculum stream is archived. Restore it before creating or changing teaching work.';
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_khpos_archived_target_guard on public.khpos_ops_academic_weekly_targets;
create trigger trg_khpos_archived_target_guard
before insert or update on public.khpos_ops_academic_weekly_targets
for each row execute function khpos_private.ops_academic_reject_archived_stream_work();
drop trigger if exists trg_khpos_archived_debt_guard on public.khpos_ops_academic_debt;
create trigger trg_khpos_archived_debt_guard
before insert or update on public.khpos_ops_academic_debt
for each row execute function khpos_private.ops_academic_reject_archived_stream_work();
drop trigger if exists trg_khpos_archived_observation_guard on public.khpos_ops_academic_observations;
create trigger trg_khpos_archived_observation_guard
before insert or update on public.khpos_ops_academic_observations
for each row execute function khpos_private.ops_academic_reject_archived_stream_work();
drop trigger if exists trg_khpos_archived_assessment_package_guard on public.khpos_ops_assessment_packages;
create trigger trg_khpos_archived_assessment_package_guard
before insert or update on public.khpos_ops_assessment_packages
for each row execute function khpos_private.ops_academic_reject_archived_stream_work();

revoke all on function khpos_private.ops_academic_reject_archived_stream_work() from public,anon,authenticated;
