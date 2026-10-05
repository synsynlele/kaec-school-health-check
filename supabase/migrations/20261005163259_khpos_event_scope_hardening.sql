create or replace function khpos_private.ops_emit_system_event(
  p_organisation_id uuid,
  p_event_type text,
  p_event_key text,
  p_subject_type text default null,
  p_subject_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path=public,auth,khpos_private,pg_temp
as $$
declare
  v_profile public.khpos_ops_process_execution_profiles%rowtype;
  v_event_id uuid;
  v_assignment_id uuid;
  v_assignment_count integer;
  v_checklist_id uuid;
  v_campus uuid;
  v_unit uuid;
  v_work_id uuid;
  v_process public.khpos_ops_processes%rowtype;
  v_title text;
  v_count integer := 0;
begin
  if nullif(btrim(coalesce(p_event_type,'')),'') is null
     or nullif(btrim(coalesce(p_event_key,'')),'') is null then
    return 0;
  end if;

  if not exists (
    select 1 from public.organisations o
    where o.id=p_organisation_id and o.status='active' and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then return 0; end if;

  for v_profile in
    select ep.*
    from public.khpos_ops_process_execution_profiles ep
    where ep.organisation_id=p_organisation_id
      and ep.status='configured'
      and (
        (ep.activation_mode='event' and ep.event_type=p_event_type)
        or
        (ep.activation_mode='condition' and ep.condition_key=p_event_type)
      )
  loop
    insert into public.khpos_ops_trigger_events(
      organisation_id,execution_profile_id,event_key,event_type,
      subject_type,subject_id,payload,status
    ) values (
      p_organisation_id,v_profile.id,p_event_key,p_event_type,
      p_subject_type,p_subject_id,coalesce(p_payload,'{}'::jsonb),'pending'
    )
    on conflict (organisation_id,execution_profile_id,event_key) do nothing
    returning id into v_event_id;

    if v_event_id is null then
      continue;
    end if;

    begin
      v_campus := nullif(p_payload->>'campusId','')::uuid;
      v_unit := nullif(p_payload->>'unitId','')::uuid;
    exception when invalid_text_representation then
      update public.khpos_ops_trigger_events set status='failed',
        error_message='Event scope identifiers are invalid.',processed_at=now() where id=v_event_id;
      continue;
    end;
    if (v_campus is not null and not exists (
      select 1 from public.khpos_ops_campuses c where c.id=v_campus
        and c.organisation_id=p_organisation_id and c.status='active'
    )) or (v_unit is not null and not exists (
      select 1 from public.khpos_ops_units u where u.id=v_unit
        and u.organisation_id=p_organisation_id and u.status='active'
        and (u.campus_id is null or u.campus_id=v_campus)
    )) then
      update public.khpos_ops_trigger_events set status='failed',
        error_message='Event campus or unit is outside the active school scope.',processed_at=now() where id=v_event_id;
      continue;
    end if;

    select p.* into v_process
    from public.khpos_ops_processes p
    where p.id=v_profile.process_id
      and p.organisation_id=p_organisation_id
      and p.status <> 'retired'
      and exists (
        select 1 from public.khpos_ops_process_versions pv
        where pv.process_id=p.id and pv.status='active'
      );

    if v_process.id is null then
      update public.khpos_ops_trigger_events
      set status='skipped',
          error_message='The controlled process is not active.',
          processed_at=now()
      where id=v_event_id;
      continue;
    end if;

    select count(*)::integer,(array_agg(a.id))[1]
    into v_assignment_count,v_assignment_id
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles ar on ar.id=a.role_id
    where ar.organisation_id=p_organisation_id and ar.status='active'
      and a.role_id=v_profile.owner_role_id and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
      and (nullif(p_payload->>'campusId','') is null
        or a.campus_id is null or a.campus_id::text=p_payload->>'campusId')
      and (nullif(p_payload->>'unitId','') is null
        or a.unit_id is null or a.unit_id::text=p_payload->>'unitId');

    if v_assignment_count<>1 then
      update public.khpos_ops_trigger_events
      set status='failed',
          error_message=case when v_assignment_count=0
            then 'No active school member holds the configured owner role in this scope.'
            else 'Multiple active owner assignments match this scope; leadership must resolve routing.' end,
          processed_at=now()
      where id=v_event_id;
      continue;
    end if;

    select ct.id into v_checklist_id from public.khpos_ops_checklist_templates ct
    where ct.organisation_id=p_organisation_id and ct.process_id=v_process.id
      and ct.status='active' order by ct.version desc,ct.created_at desc limit 1;

    begin
    v_title := coalesce(
      nullif(btrim(v_profile.trigger_summary),''),
      v_process.title
    );

    insert into public.khpos_ops_work_items(
      organisation_id,campus_id,unit_id,process_id,owner_assignment_id,
      checklist_template_id,occurrence_key,title,description,status,priority,due_at,
      evidence_required,verification_required,source_trigger_event_id
    ) values (
      p_organisation_id,
      nullif(p_payload->>'campusId','')::uuid,
      nullif(p_payload->>'unitId','')::uuid,
      v_process.id,
      v_assignment_id,
      v_checklist_id,
      'trigger:' || v_event_id::text,
      v_process.title,
      v_title,
      'pending',
      case v_process.criticality when 'P0' then 'critical' when 'P1' then 'high' else 'standard' end,
      case when v_profile.due_offset_minutes is null then null
        else now() + make_interval(mins => v_profile.due_offset_minutes) end,
      v_profile.evidence_required,
      v_profile.verification_required,
      v_event_id
    )
    returning id into v_work_id;

    update public.khpos_ops_trigger_events
    set status='materialized',work_item_id=v_work_id,processed_at=now()
    where id=v_event_id;

    insert into public.khpos_ops_audit_events(
      organisation_id,event_type,object_type,object_id,metadata
    ) values (
      p_organisation_id,'ops_trigger_materialized','work_item',v_work_id,
      jsonb_build_object(
        'eventType',p_event_type,
        'eventKey',p_event_key,
        'executionProfileId',v_profile.id,
        'subjectType',p_subject_type,
        'subjectId',p_subject_id
      )
    );

    v_count := v_count + 1;
    exception when others then
      update public.khpos_ops_trigger_events
      set status='failed',error_message='Work materialisation failed ('||SQLSTATE||').',processed_at=now()
      where id=v_event_id;
    end;
  end loop;

  return v_count;
end;
$$;


