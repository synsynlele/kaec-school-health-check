create or replace function public.khpos_ops_adopt_core_scorecard_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $func$
declare
  v_owner_role_id uuid;
  v_created integer := 0;
  v_existing integer := 0;
  v_conflicts integer := 0;
  v_kpi_id uuid;
  v_item record;
begin
  if not khpos_private.ops_can_govern_performance(
    p_actor_user_id,
    p_organisation_id
  ) then
    raise exception 'Core scorecard adoption requires an active School Guardian or Vision Custodian role.';
  end if;

  select r.id into v_owner_role_id
  from public.khpos_ops_roles r
  where r.organisation_id=p_organisation_id
    and r.status='active'
    and r.code in ('SCHOOL_GUARDIAN','VISION_CUSTODIAN','SCHOOL_CUSTODIAN')
    and exists (
      select 1
      from public.khpos_ops_role_assignments a
      where a.role_id=r.id
        and a.status='active'
        and khpos_private.ops_hpd_has_membership(
          a.user_id,
          p_organisation_id
        )
    )
  order by
    case r.code
      when 'SCHOOL_GUARDIAN' then 0
      when 'VISION_CUSTODIAN' then 1
      else 2
    end,
    r.role_level
  limit 1;

  if v_owner_role_id is null then
    raise exception 'A staffed School Guardian or Vision Custodian role is required before the core scorecard can be adopted.';
  end if;

  for v_item in
    select *
    from (
      values
        (
          'KHP-CORE-EXEC-COVERAGE',
          'Execution coverage',
          'operations',
          'Percentage of approved operating processes that currently have a configured execution profile. This is a control-coverage measure, not a judgment of school quality.',
          'process',
          'execution_coverage'
        ),
        (
          'KHP-CORE-WORK-RELIABILITY',
          'Work completion reliability',
          'operations',
          'Percentage of governed work due in the rolling 30-day operating window that has been completed.',
          'process',
          'work_completion_reliability'
        ),
        (
          'KHP-CORE-ONTIME',
          'On-time completion',
          'operations',
          'Percentage of completed governed work with a deadline that was completed by its due time in the rolling 30-day operating window.',
          'process',
          'on_time_completion'
        ),
        (
          'KHP-CORE-FIRST-PASS',
          'First-pass verification',
          'governance',
          'Percentage of governed work verified in the rolling 30-day operating window without first being returned for correction.',
          'process',
          'verification_first_pass'
        ),
        (
          'KHP-CORE-ISSUE-CLOSURE',
          'Issue closure',
          'governance',
          'Percentage of institutional issues opened in the rolling 30-day operating window that are now resolved, verified or closed.',
          'process',
          'issue_closure'
        ),
        (
          'KHP-CORE-DECISION-CLOSURE',
          'Decision action closure',
          'governance',
          'Percentage of action-required decisions made in the rolling 30-day operating window whose required action is implemented or closed.',
          'process',
          'decision_action_closure'
        )
    ) as starter(
      code,
      name,
      domain,
      definition,
      indicator_type,
      source_key
    )
  loop
    select k.id into v_kpi_id
    from public.khpos_ops_kpis k
    where k.organisation_id=p_organisation_id
      and k.code=v_item.code
    limit 1;

    if v_kpi_id is not null then
      if exists (
        select 1
        from public.khpos_ops_kpi_versions v
        join public.khpos_ops_kpis k on k.id=v.kpi_id
        where k.id=v_kpi_id
          and k.status='active'
          and v.status='active'
          and v.source_type='operational_engine'
          and v.source_key=v_item.source_key
      ) then
        v_existing := v_existing + 1;
      else
        v_conflicts := v_conflicts + 1;
      end if;
      v_kpi_id := null;
      continue;
    end if;

    insert into public.khpos_ops_kpis(
      organisation_id,
      code,
      name,
      domain,
      status,
      created_by
    ) values (
      p_organisation_id,
      v_item.code,
      v_item.name,
      v_item.domain,
      'active',
      p_actor_user_id
    )
    returning id into v_kpi_id;

    insert into public.khpos_ops_kpi_versions(
      kpi_id,
      version,
      definition,
      owner_role_id,
      scope_type,
      scope_role_id,
      campus_id,
      unit_id,
      system_code,
      indicator_type,
      unit,
      direction,
      cadence,
      source_type,
      source_key,
      target_config,
      critical_control,
      effective_date,
      approved_by,
      approved_at,
      status
    ) values (
      v_kpi_id,
      1,
      v_item.definition,
      v_owner_role_id,
      'institution',
      null,
      null,
      null,
      null,
      v_item.indicator_type,
      'percent',
      'baseline_only',
      'weekly',
      'operational_engine',
      v_item.source_key,
      '{}'::jsonb,
      false,
      current_date,
      p_actor_user_id,
      now(),
      'active'
    );

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
      'ops_core_kpi_adopted',
      'kpi',
      v_kpi_id,
      jsonb_build_object(
        'code',v_item.code,
        'sourceKey',v_item.source_key,
        'direction','baseline_only',
        'cadence','weekly'
      )
    );

    v_created := v_created + 1;
    v_kpi_id := null;
  end loop;

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
    'ops_core_scorecard_adopted',
    'organisation',
    p_organisation_id,
    jsonb_build_object(
      'created',v_created,
      'existing',v_existing,
      'conflicts',v_conflicts
    )
  );

  return jsonb_build_object(
    'total',6,
    'created',v_created,
    'existing',v_existing,
    'conflicts',v_conflicts
  );
end;
$func$;


create or replace function public.khpos_ops_sync_core_scorecard_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_metrics jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $func$
declare
  v_item record;
  v_value numeric;
  v_status text;
  v_week_start date;
  v_week_end date;
  v_existing_measurement_id uuid;
  v_measurement_id uuid;
  v_synced integer := 0;
  v_created integer := 0;
begin
  if not exists (
    select 1
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  if jsonb_typeof(coalesce(p_metrics,'{}'::jsonb)) <> 'object' then
    raise exception 'Core scorecard metrics must be a JSON object.';
  end if;

  v_week_start :=
    current_date - (extract(isodow from current_date)::integer - 1);
  v_week_end := v_week_start + 6;

  for v_item in
    select
      k.id as kpi_id,
      v.id as version_id,
      v.direction,
      v.target_config,
      v.source_key
    from public.khpos_ops_kpis k
    join public.khpos_ops_kpi_versions v
      on v.kpi_id=k.id
     and v.status='active'
    where k.organisation_id=p_organisation_id
      and k.status='active'
      and k.code in (
        'KHP-CORE-EXEC-COVERAGE',
        'KHP-CORE-WORK-RELIABILITY',
        'KHP-CORE-ONTIME',
        'KHP-CORE-FIRST-PASS',
        'KHP-CORE-ISSUE-CLOSURE',
        'KHP-CORE-DECISION-CLOSURE'
      )
      and v.source_type='operational_engine'
      and v.source_key in (
        'execution_coverage',
        'work_completion_reliability',
        'on_time_completion',
        'verification_first_pass',
        'issue_closure',
        'decision_action_closure'
      )
  loop
    if not (coalesce(p_metrics,'{}'::jsonb) ? v_item.source_key) then
      continue;
    end if;

    begin
      v_value := nullif(p_metrics->>v_item.source_key,'')::numeric;
    exception when others then
      raise exception 'Core scorecard metric % is not numeric.',v_item.source_key;
    end;

    if v_value is null then
      continue;
    end if;

    if v_value < 0 or v_value > 100 then
      raise exception 'Core scorecard percentage % must be between 0 and 100.',v_item.source_key;
    end if;

    v_status := khpos_private.ops_kpi_status(
      v_item.direction,
      v_item.target_config,
      v_value
    );

    select m.id into v_existing_measurement_id
    from public.khpos_ops_kpi_measurements m
    where m.kpi_version_id=v_item.version_id
      and m.period_start=v_week_start
      and m.period_end=v_week_end
    limit 1;

    if v_existing_measurement_id is null then
      insert into public.khpos_ops_kpi_measurements(
        organisation_id,
        kpi_id,
        kpi_version_id,
        period_start,
        period_end,
        value_numeric,
        performance_status,
        note,
        evidence_reference,
        recorded_by,
        recorded_at,
        updated_at
      ) values (
        p_organisation_id,
        v_item.kpi_id,
        v_item.version_id,
        v_week_start,
        v_week_end,
        v_value,
        v_status,
        'System-derived from governed KHP-OS operating data.',
        'khpos://operational-engine/'||v_item.source_key,
        p_actor_user_id,
        now(),
        now()
      )
      returning id into v_measurement_id;

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
        'ops_core_kpi_measurement_started',
        'kpi',
        v_item.kpi_id,
        jsonb_build_object(
          'measurementId',v_measurement_id,
          'sourceKey',v_item.source_key,
          'periodStart',v_week_start,
          'periodEnd',v_week_end,
          'value',v_value
        )
      );

      v_created := v_created + 1;
    else
      update public.khpos_ops_kpi_measurements
      set
        value_numeric=v_value,
        performance_status=v_status,
        note='System-derived from governed KHP-OS operating data.',
        evidence_reference='khpos://operational-engine/'||v_item.source_key,
        recorded_by=p_actor_user_id,
        recorded_at=now(),
        updated_at=now()
      where id=v_existing_measurement_id;
    end if;

    v_synced := v_synced + 1;
    v_existing_measurement_id := null;
    v_measurement_id := null;
  end loop;

  return jsonb_build_object(
    'synced',v_synced,
    'newWeeklyMeasurements',v_created,
    'weekStart',v_week_start,
    'weekEnd',v_week_end
  );
end;
$func$;

revoke all on function public.khpos_ops_adopt_core_scorecard_server(
  uuid,uuid
) from public,anon,authenticated;
grant execute on function public.khpos_ops_adopt_core_scorecard_server(
  uuid,uuid
) to service_role;

revoke all on function public.khpos_ops_sync_core_scorecard_server(
  uuid,uuid,jsonb
) from public,anon,authenticated;
grant execute on function public.khpos_ops_sync_core_scorecard_server(
  uuid,uuid,jsonb
) to service_role;

comment on function public.khpos_ops_adopt_core_scorecard_server(
  uuid,uuid
) is
  'Idempotently adopts six baseline-only KHP-OS core operating KPIs. No thresholds or synthetic overall score are created.';

comment on function public.khpos_ops_sync_core_scorecard_server(
  uuid,uuid,jsonb
) is
  'Upserts the current weekly snapshot for adopted core operating KPIs using trusted system-derived percentage metrics supplied by the KHP-OS service layer.';
