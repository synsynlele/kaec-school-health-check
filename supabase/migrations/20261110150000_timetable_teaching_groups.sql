-- Real timetable conflicts vs deliberately parallel departmental/elective lessons.
-- Existing lessons remain unclassified; none are rewritten or exempted automatically.
alter table public.khpos_ops_class_periods
  add column if not exists teaching_group_kind text,
  add column if not exists teaching_group_label text,
  add column if not exists parallel_block_label text,
  add column if not exists parallel_verified boolean not null default false,
  add column if not exists parallel_verified_by uuid references auth.users(id),
  add column if not exists parallel_verified_at timestamptz;

alter table public.khpos_ops_class_periods
  add constraint khpos_period_teaching_group_valid check (
    (teaching_group_kind is null and teaching_group_label is null
      and parallel_block_label is null and parallel_verified = false
      and parallel_verified_by is null and parallel_verified_at is null)
    or
    (teaching_group_kind = 'whole_class' and teaching_group_label is null
      and parallel_block_label is null and parallel_verified = false
      and parallel_verified_by is null and parallel_verified_at is null)
    or
    (teaching_group_kind in ('department','elective','custom')
      and teaching_group_label is not null
      and length(teaching_group_label) between 2 and 80
      and (parallel_block_label is null or length(parallel_block_label) between 2 and 60)
      and (parallel_verified = false or parallel_block_label is not null)
      and (parallel_verified = (parallel_verified_by is not null))
      and (parallel_verified = (parallel_verified_at is not null)))
  );

-- Extend the established authenticated RPC without replacing its permission,
-- tenancy, attendance-lock, same-teacher or audit rules. Each replacement must
-- find its precise hook; otherwise the whole migration rolls back.
do $migration$
declare source text; updated text;
begin
  source := pg_get_functiondef('public.khpos_ops_presence_action_server(uuid,uuid,text,jsonb)'::regprocedure);
  updated := replace(source,
    $old$v_school_time time;$old$,
    $new$v_school_time time;
  v_group_kind text; v_group_label text; v_parallel_block text; v_parallel_verified boolean;$new$);
  if updated=source then raise exception 'Timetable action declaration changed; aborting migration'; end if;
  source:=updated;

  updated := replace(source,
    $old$    v_school_time:=(p_input->>'start')::time;$old$,
    $new$    -- Legacy callers may omit these fields; on edits retain existing
    -- classifications, and on adds leave unclassified until explicitly set.
    v_group_kind:=case when p_input ? 'teachingGroupKind'
      then nullif(btrim(p_input->>'teachingGroupKind'),'')
      else v_period.teaching_group_kind end;
    if p_input ? 'teachingGroupKind' and v_group_kind is null then
      raise exception 'Choose a teaching group for this lesson.';
    end if;
    if v_group_kind is not null and v_group_kind not in ('whole_class','department','elective','custom') then
      raise exception 'Select a recognised teaching group type.';
    end if;
    v_group_label:=case when p_input ? 'teachingGroupLabel'
      then nullif(btrim(p_input->>'teachingGroupLabel'),'')
      else v_period.teaching_group_label end;
    v_parallel_block:=case when p_input ? 'parallelBlockLabel'
      then nullif(btrim(p_input->>'parallelBlockLabel'),'')
      else v_period.parallel_block_label end;
    v_parallel_verified:=case when p_input ? 'parallelVerified'
      then coalesce((p_input->>'parallelVerified')::boolean,false)
      else coalesce(v_period.parallel_verified,false) end;
    if v_group_kind = 'whole_class' or v_group_kind is null then
      v_group_label:=null; v_parallel_block:=null; v_parallel_verified:=false;
    else
      if v_group_label is null or length(v_group_label) not between 2 and 80 then
        raise exception 'Name the teaching group (2 to 80 characters).';
      end if;
      if v_parallel_block is not null and length(v_parallel_block) not between 2 and 60 then
        raise exception 'Parallel block reference must contain 2 to 60 characters.';
      end if;
      if v_parallel_verified and v_parallel_block is null then
        raise exception 'Enter the common parallel block before confirming different learners.';
      end if;
    end if;
    v_school_time:=(p_input->>'start')::time;$new$);
  if updated=source then raise exception 'Timetable action group validation hook changed; aborting migration'; end if;
  source:=updated;

  updated := replace(source,
    $old$room_label=nullif(left(trim(coalesce(p_input->>'room','')),100),'')
        where id=v_period.id;$old$,
    $new$room_label=nullif(left(trim(coalesce(p_input->>'room','')),100),''),
        teaching_group_kind=v_group_kind, teaching_group_label=v_group_label,
        parallel_block_label=v_parallel_block, parallel_verified=v_parallel_verified,
        parallel_verified_by=case when v_parallel_verified then p_actor else null end,
        parallel_verified_at=case when v_parallel_verified then clock_timestamp() else null end
        where id=v_period.id;$new$);
  if updated=source then raise exception 'Timetable edit hook changed; aborting migration'; end if;
  source:=updated;

  updated := replace(source,
    $old$insert into public.khpos_ops_class_periods(organisation_id,stream_id,weekday,starts_at,ends_at,room_label,created_by)
        values(p_org,v_id,(p_input->>'weekday')::int,v_school_time,(p_input->>'end')::time,
          nullif(left(trim(coalesce(p_input->>'room','')),100),''),p_actor)$old$,
    $new$insert into public.khpos_ops_class_periods(organisation_id,stream_id,weekday,starts_at,ends_at,room_label,created_by,
        teaching_group_kind,teaching_group_label,parallel_block_label,parallel_verified,parallel_verified_by,parallel_verified_at)
        values(p_org,v_id,(p_input->>'weekday')::int,v_school_time,(p_input->>'end')::time,
          nullif(left(trim(coalesce(p_input->>'room','')),100),''),p_actor,
          v_group_kind,v_group_label,v_parallel_block,v_parallel_verified,
          case when v_parallel_verified then p_actor else null end,
          case when v_parallel_verified then clock_timestamp() else null end)$new$);
  if updated=source then raise exception 'Timetable add hook changed; aborting migration'; end if;
  execute updated;

  source := pg_get_functiondef('public.khpos_ops_presence_workspace_server(uuid,uuid)'::regprocedure);
  updated := replace(source,
    $old$'room',p.room_label,'campusId',s.campus_id$old$,
    $new$'room',p.room_label,
        'teachingGroupKind',p.teaching_group_kind,
        'teachingGroupLabel',p.teaching_group_label,
        'parallelBlockLabel',p.parallel_block_label,
        'parallelVerified',p.parallel_verified,
        'parallelVerifiedBy',p.parallel_verified_by,
        'campusId',s.campus_id$new$);
  if updated=source then raise exception 'Presence workspace response hook changed; aborting migration'; end if;
  execute updated;
end;
$migration$;

-- RLS and table privileges are unchanged. Only service_role can access
-- the new columns; only the pre-existing authorised scheduling RPC writes them.
