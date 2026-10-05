create or replace function public.khpos_ops_start_manual_process_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_process_id uuid,
  p_campus_id uuid default null,
  p_unit_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $func$
declare
  v_profile public.khpos_ops_process_execution_profiles%rowtype;
  v_process public.khpos_ops_processes%rowtype;
  v_process_trigger text;
  v_assignment public.khpos_ops_role_assignments%rowtype;
  v_assignment_count integer := 0;
  v_actor_assignment_count integer := 0;
  v_is_leader boolean := false;
  v_checklist_id uuid;
  v_work_id uuid;
  v_due_at timestamptz;
  v_owner_role_title text;
  v_target_campus uuid;
  v_target_unit uuid;
begin
  if not khpos_private.ops_hpd_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active KHP-OS school membership is required.';
  end if;

  select p.* into v_process
  from public.khpos_ops_processes p
  where p.id=p_process_id
    and p.organisation_id=p_organisation_id
    and p.status<>'retired'
    and exists (
      select 1
      from public.khpos_ops_process_versions pv
      where pv.process_id=p.id and pv.status='active'
    );

  if v_process.id is null then
    raise exception 'Controlled process not found or not active.';
  end if;

  select ep.* into v_profile
  from public.khpos_ops_process_execution_profiles ep
  where ep.organisation_id=p_organisation_id
    and ep.process_id=p_process_id
    and ep.status='configured'
    and ep.activation_mode='manual_on_demand';

  if v_profile.id is null then
    raise exception 'This process is not configured for manual/on-demand execution.';
  end if;

  if v_profile.owner_role_id is null or not exists (
    select 1 from public.khpos_ops_roles r
    where r.id=v_profile.owner_role_id
      and r.organisation_id=p_organisation_id and r.status='active'
  ) then
    raise exception 'This manual process has no active accountable role.';
  end if;

  if p_campus_id is not null and not exists (
    select 1
    from public.khpos_ops_campuses c
    where c.id=p_campus_id
      and c.organisation_id=p_organisation_id
      and c.status='active'
  ) then
    raise exception 'The selected campus is not active in this school.';
  end if;

  if p_unit_id is not null and not exists (
    select 1
    from public.khpos_ops_units u
    where u.id=p_unit_id
      and u.organisation_id=p_organisation_id
      and u.status='active'
      and (
        p_campus_id is null
        or u.campus_id is null
        or u.campus_id=p_campus_id
      )
  ) then
    raise exception 'The selected unit is not active in this school or campus.';
  end if;

  v_is_leader := khpos_private.ops_hpd_actor_has_role(
    p_actor_user_id,
    p_organisation_id,
    array[
      'VISION_CUSTODIAN',
      'SCHOOL_CUSTODIAN',
      'SCHOOL_GUARDIAN',
      'ACADEMIC_INSPECTOR',
      'SKILL_INSPECTOR'
    ]::text[]
  );

  select count(*)::integer into v_actor_assignment_count
  from public.khpos_ops_role_assignments a
  where a.role_id=v_profile.owner_role_id
    and a.user_id=p_actor_user_id
    and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
    and (
      p_campus_id is null
      or a.campus_id is null
      or a.campus_id=p_campus_id
    )
    and (
      p_unit_id is null
      or a.unit_id is null
      or a.unit_id=p_unit_id
    );

  if v_actor_assignment_count=1 then
    select a.* into v_assignment
    from public.khpos_ops_role_assignments a
    where a.role_id=v_profile.owner_role_id
      and a.user_id=p_actor_user_id
      and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
      and (
        p_campus_id is null
        or a.campus_id is null
        or a.campus_id=p_campus_id
      )
      and (
        p_unit_id is null
        or a.unit_id is null
        or a.unit_id=p_unit_id
      )
    order by
      case
        when p_campus_id is not null and a.campus_id=p_campus_id then 0
        else 1
      end,
      case
        when p_unit_id is not null and a.unit_id=p_unit_id then 0
        else 1
      end,
      a.primary_assignment desc,
      a.created_at
    limit 1;
  elsif v_actor_assignment_count>1 then
    raise exception 'Choose a campus or unit before starting this process because you hold this role in more than one operating scope.';
  elsif not v_is_leader then
    raise exception 'Only the accountable role holder or an authorised school leader can start this process.';
  else
    select count(*)::integer into v_assignment_count
    from public.khpos_ops_role_assignments a
    where a.role_id=v_profile.owner_role_id
      and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
      and (
        p_campus_id is null
        or a.campus_id is null
        or a.campus_id=p_campus_id
      )
      and (
        p_unit_id is null
        or a.unit_id is null
        or a.unit_id=p_unit_id
      );

    if v_assignment_count=0 then
      raise exception 'No active person is assigned to the accountable role for this process.';
    elsif v_assignment_count>1 then
      raise exception 'More than one active person can own this process. Choose the campus or unit that identifies the intended operating owner.';
    end if;

    select a.* into v_assignment
    from public.khpos_ops_role_assignments a
    where a.role_id=v_profile.owner_role_id
      and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
      and (
        p_campus_id is null
        or a.campus_id is null
        or a.campus_id=p_campus_id
      )
      and (
        p_unit_id is null
        or a.unit_id is null
        or a.unit_id=p_unit_id
      )
    order by a.primary_assignment desc,a.created_at
    limit 1;
  end if;

  select r.title into v_owner_role_title
  from public.khpos_ops_roles r
  where r.id=v_profile.owner_role_id
    and r.organisation_id=p_organisation_id
    and r.status='active';

  select pv.trigger into v_process_trigger
  from public.khpos_ops_process_versions pv
  where pv.process_id=p_process_id
    and pv.status='active'
  order by pv.version desc
  limit 1;

  select ct.id into v_checklist_id
  from public.khpos_ops_checklist_templates ct
  where ct.organisation_id=p_organisation_id
    and ct.process_id=p_process_id
    and ct.status='active'
  order by ct.version desc,ct.created_at desc
  limit 1;

  v_target_campus := coalesce(p_campus_id,v_assignment.campus_id);
  v_target_unit := coalesce(p_unit_id,v_assignment.unit_id);

  if v_target_campus is not null and not exists (
    select 1 from public.khpos_ops_campuses c
    where c.id=v_target_campus and c.organisation_id=p_organisation_id
      and c.status='active'
  ) then
    raise exception 'The accountable assignment campus is not active in this school.';
  end if;
  if v_target_unit is not null and not exists (
    select 1 from public.khpos_ops_units u
    where u.id=v_target_unit and u.organisation_id=p_organisation_id
      and u.status='active'
      and (u.campus_id is null or u.campus_id=v_target_campus)
  ) then
    raise exception 'The accountable assignment unit does not match the target campus.';
  end if;

  if v_profile.due_offset_minutes is not null then
    v_due_at := now() + make_interval(mins => v_profile.due_offset_minutes);
  end if;

  insert into public.khpos_ops_work_items(
    organisation_id,
    campus_id,
    unit_id,
    process_id,
    owner_assignment_id,
    checklist_template_id,
    occurrence_key,
    title,
    description,
    status,
    priority,
    due_at,
    evidence_required,
    verification_required,
    created_by
  ) values (
    p_organisation_id,
    v_target_campus,
    v_target_unit,
    p_process_id,
    v_assignment.id,
    v_checklist_id,
    'manual:'||gen_random_uuid()::text,
    v_process.title,
    coalesce(
      nullif(btrim(v_profile.trigger_summary),''),
      nullif(btrim(v_process_trigger),''),
      v_process.title
    ),
    'pending',
    case v_process.criticality
      when 'P0' then 'critical'
      when 'P1' then 'high'
      else 'standard'
    end,
    v_due_at,
    v_profile.evidence_required,
    v_profile.verification_required,
    p_actor_user_id
  )
  returning id into v_work_id;

  insert into public.khpos_ops_audit_events(
    organisation_id,
    actor_user_id,
    event_type,
    object_type,
    object_id,
    metadata
  ) values (
    p_organisation_id,
    p_actor_user_id,
    'ops_manual_process_started',
    'work_item',
    v_work_id,
    jsonb_build_object(
      'processId',p_process_id,
      'processCode',v_process.code,
      'executionProfileId',v_profile.id,
      'ownerRoleId',v_profile.owner_role_id,
      'ownerAssignmentId',v_assignment.id,
      'campusId',v_target_campus,
      'unitId',v_target_unit,
      'dueAt',v_due_at
    )
  );

  return jsonb_build_object(
    'workId',v_work_id,
    'processId',p_process_id,
    'processCode',v_process.code,
    'processTitle',v_process.title,
    'ownerRoleId',v_profile.owner_role_id,
    'ownerRoleTitle',v_owner_role_title,
    'ownerIsActor',v_assignment.user_id=p_actor_user_id,
    'campusId',v_target_campus,
    'unitId',v_target_unit,
    'dueAt',v_due_at
  );
end;
$func$;

revoke all on function public.khpos_ops_start_manual_process_server(
  uuid,uuid,uuid,uuid,uuid
) from public,anon,authenticated;
grant execute on function public.khpos_ops_start_manual_process_server(
  uuid,uuid,uuid,uuid,uuid
) to service_role;


create or replace function public.khpos_ops_apply_safe_execution_mappings_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $func$
declare
  v_mapped integer := 0;
  v_mapped_p0 integer := 0;
  v_blocked_missing_assignment integer := 0;
  v_multiple_owner integer := 0;
  v_no_owner integer := 0;
begin
  if not khpos_private.ops_hpd_has_membership(
    p_actor_user_id,p_organisation_id
  ) or not khpos_private.ops_hpd_actor_has_role(
    p_actor_user_id,
    p_organisation_id,
    array[
      'VISION_CUSTODIAN',
      'SCHOOL_CUSTODIAN',
      'SCHOOL_GUARDIAN',
      'ACADEMIC_INSPECTOR',
      'SKILL_INSPECTOR'
    ]::text[]
  ) then
    raise exception 'An active school leadership role is required to apply safe execution mappings.';
  end if;

  with candidates as (
    select
      ep.id as profile_id,
      ep.process_id,
      p.code,
      p.criticality,
      pv.trigger,
      pv.evidence,
      (array_agg(pr.role_id))[1] as owner_role_id,
      count(pr.role_id)::integer as owner_count
    from public.khpos_ops_process_execution_profiles ep
    join public.khpos_ops_processes p
      on p.id=ep.process_id
     and p.organisation_id=ep.organisation_id
     and p.status<>'retired'
    join lateral (
      select x.trigger,x.evidence
      from public.khpos_ops_process_versions x
      where x.process_id=p.id
        and x.status='active'
      order by x.version desc
      limit 1
    ) pv on true
    left join public.khpos_ops_process_roles pr
      on pr.process_id=p.id
     and pr.participation='owner'
    where ep.organisation_id=p_organisation_id
      and ep.status='needs_mapping'
      and ep.activation_mode='manual_on_demand'
    group by
      ep.id,ep.process_id,p.code,p.criticality,pv.trigger,pv.evidence
  ),
  eligible as (
    select c.*
    from candidates c
    where c.owner_count=1
      and c.owner_role_id is not null
      and exists (
        select 1 from public.khpos_ops_roles r
        where r.id=c.owner_role_id
          and r.organisation_id=p_organisation_id and r.status='active'
      )
      and exists (
        select 1
        from public.khpos_ops_role_assignments a
        where a.role_id=c.owner_role_id
          and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
      )
  ),
  updated as (
    update public.khpos_ops_process_execution_profiles ep
    set
      owner_role_id=e.owner_role_id,
      trigger_summary=coalesce(
        nullif(btrim(ep.trigger_summary),''),
        nullif(btrim(e.trigger),'')
      ),
      evidence_required=case
        when jsonb_typeof(e.evidence)='array'
          then jsonb_array_length(e.evidence)>0
        when e.evidence is null or e.evidence='null'::jsonb
          then false
        else true
      end,
      status='configured',
      configured_by=p_actor_user_id,
      configured_at=now(),
      updated_at=now()
    from eligible e
    where ep.id=e.profile_id
    returning
      ep.id,
      ep.process_id,
      e.code,
      e.criticality,
      e.owner_role_id
  ),
  audit_rows as (
    insert into public.khpos_ops_audit_events(
      organisation_id,
      actor_user_id,
      event_type,
      object_type,
      object_id,
      metadata
    )
    select
      p_organisation_id,
      p_actor_user_id,
      'ops_execution_safe_mapped',
      'process_execution_profile',
      u.id,
      jsonb_build_object(
        'processId',u.process_id,
        'processCode',u.code,
        'ownerRoleId',u.owner_role_id,
        'mode','manual_on_demand',
        'method','single_governed_owner_with_active_assignment'
      )
    from updated u
    returning id
  )
  select
    count(*)::integer,
    count(*) filter (where criticality='P0')::integer
  into v_mapped,v_mapped_p0
  from updated;

  with candidates as (
    select
      ep.process_id,
      count(pr.role_id)::integer as owner_count,
      (array_agg(pr.role_id))[1] as owner_role_id
    from public.khpos_ops_process_execution_profiles ep
    join public.khpos_ops_processes p
      on p.id=ep.process_id
     and p.organisation_id=ep.organisation_id
     and p.status<>'retired'
    left join public.khpos_ops_process_roles pr
      on pr.process_id=p.id
     and pr.participation='owner'
    where ep.organisation_id=p_organisation_id
      and ep.status='needs_mapping'
      and ep.activation_mode='manual_on_demand'
      and exists (
        select 1
        from public.khpos_ops_process_versions pv
        where pv.process_id=p.id
          and pv.status='active'
      )
    group by ep.process_id
  )
  select
    count(*) filter (
      where owner_count=1
        and owner_role_id is not null
        and not exists (
          select 1
          from public.khpos_ops_role_assignments a
          where a.role_id=c.owner_role_id
            and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
        )
    )::integer,
    count(*) filter (where owner_count>1)::integer,
    count(*) filter (where owner_count=0)::integer
  into
    v_blocked_missing_assignment,
    v_multiple_owner,
    v_no_owner
  from candidates c;

  insert into public.khpos_ops_audit_events(
    organisation_id,
    actor_user_id,
    event_type,
    object_type,
    object_id,
    metadata
  ) values (
    p_organisation_id,
    p_actor_user_id,
    'ops_execution_safe_mapping_batch',
    'organisation',
    p_organisation_id,
    jsonb_build_object(
      'mapped',v_mapped,
      'mappedP0',v_mapped_p0,
      'blockedMissingAssignment',v_blocked_missing_assignment,
      'multipleOwner',v_multiple_owner,
      'noOwner',v_no_owner
    )
  );

  return jsonb_build_object(
    'mapped',v_mapped,
    'mappedP0',v_mapped_p0,
    'blockedMissingAssignment',v_blocked_missing_assignment,
    'multipleOwner',v_multiple_owner,
    'noOwner',v_no_owner
  );
end;
$func$;

revoke all on function public.khpos_ops_apply_safe_execution_mappings_server(
  uuid,uuid
) from public,anon,authenticated;
grant execute on function public.khpos_ops_apply_safe_execution_mappings_server(
  uuid,uuid
) to service_role;

comment on function public.khpos_ops_start_manual_process_server(
  uuid,uuid,uuid,uuid,uuid
) is
  'Creates governed KHP-OS work from a configured manual/on-demand process, routing it to the accountable active role assignment and preserving normal checklist/report/evidence controls.';

comment on function public.khpos_ops_apply_safe_execution_mappings_server(
  uuid,uuid
) is
  'Configures only unmapped manual processes with exactly one governed owner role and at least one active assignment. Ambiguous or unstaffed ownership remains unmapped for human resolution.';
