create or replace function public.khpos_ops_get_process_connections_server(
  p_organisation_id uuid
)
returns jsonb
language sql
security definer
set search_path=public,auth,khpos_private,pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'processId',p.id,
        'execution',case when ep.id is null then null else jsonb_build_object(
          'status',ep.status,
          'activationMode',ep.activation_mode,
          'ownerRoleTitle',r.title,
          'triggerSummary',ep.trigger_summary,
          'evidenceRequired',ep.evidence_required,
          'verificationRequired',ep.verification_required,
          'escalationMinutes',ep.escalation_minutes,
          'kpiCodes',ep.kpi_codes
        ) end,
        'tools',coalesce(tool_rows.value,'[]'::jsonb),
        'currentWorkCount',coalesce(work_rows.current_count,0),
        'completedWorkCount',coalesce(work_rows.completed_count,0),
        'lastCompletedAt',work_rows.last_completed_at,
        'controlledRecordCount',coalesce(record_rows.record_count,0)
      )
      order by p.code
    ),
    '[]'::jsonb
  )
  from public.khpos_ops_processes p
  left join public.khpos_ops_process_execution_profiles ep
    on ep.process_id=p.id
   and ep.organisation_id=p_organisation_id
  left join public.khpos_ops_roles r
    on r.id=ep.owner_role_id
   and r.organisation_id=p_organisation_id
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'requirementId',ptr.id,
          'label',ptr.label,
          'required',ptr.required,
          'minimumEntries',ptr.minimum_entries,
          'verificationRequired',ptr.verification_required,
          'toolCode',tt.code,
          'toolName',tt.name,
          'toolType',tt.tool_type
        )
        order by tt.code,ptr.label
      ),
      '[]'::jsonb
    ) as value
    from public.khpos_ops_process_tool_requirements ptr
    join public.khpos_ops_tool_templates tt
      on tt.id=ptr.tool_template_id
     and tt.organisation_id=p_organisation_id
    where ptr.process_id=p.id
      and ptr.organisation_id=p_organisation_id
      and ptr.status='active'
      and tt.status='active'
  ) tool_rows on true
  left join lateral (
    select
      count(*) filter (where w.status not in ('completed','cancelled'))::integer as current_count,
      count(*) filter (where w.status='completed')::integer as completed_count,
      max(w.completed_at) filter (where w.status='completed') as last_completed_at
    from public.khpos_ops_work_items w
    where w.organisation_id=p_organisation_id
      and w.process_id=p.id
  ) work_rows on true
  left join lateral (
    select count(wr.id)::integer as record_count
    from public.khpos_ops_work_items w
    join public.khpos_ops_work_records wr
      on wr.work_item_id=w.id
     and wr.organisation_id=p_organisation_id
    where w.organisation_id=p_organisation_id
      and w.process_id=p.id
  ) record_rows on true
  where p.organisation_id=p_organisation_id
    and p.status<>'retired';
$$;

revoke execute on function public.khpos_ops_get_process_connections_server(uuid)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_get_process_connections_server(uuid)
  to service_role;
