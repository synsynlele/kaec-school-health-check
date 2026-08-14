create or replace function public.khpos_pair_ksi_with_signal_server(
  p_pairing_token text,
  p_external_workspace_id text,
  p_external_workspace_name text,
  p_external_actor text,
  p_contract_version text,
  p_source_generated_at timestamptz,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_lesson_count integer,
  p_validated_lesson_count integer,
  p_fidelity_check_count integer,
  p_fidelity_pass_count integer,
  p_fidelity_average_score numeric,
  p_assessment_count integer,
  p_validated_assessment_count integer,
  p_assessment_from_lesson_count integer,
  p_diagnosis_count integer,
  p_final_diagnosis_count integer,
  p_confirmed_intervention_count integer,
  p_linked_next_lesson_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_pair jsonb;
  v_ingest jsonb;
  v_connector text;
begin
  v_pair := public.khpos_accept_ksi_pairing_server(
    p_pairing_token,
    p_external_workspace_id,
    p_external_workspace_name,
    p_external_actor,
    p_contract_version
  );
  v_connector := v_pair->>'connectorToken';
  if v_connector is null then
    raise exception 'KSI connector token was not created.';
  end if;

  v_ingest := public.khpos_ingest_ksi_signal_server(
    v_connector,
    p_external_workspace_id,
    p_contract_version,
    p_source_generated_at,
    p_window_start,
    p_window_end,
    p_lesson_count,
    p_validated_lesson_count,
    p_fidelity_check_count,
    p_fidelity_pass_count,
    p_fidelity_average_score,
    p_assessment_count,
    p_validated_assessment_count,
    p_assessment_from_lesson_count,
    p_diagnosis_count,
    p_final_diagnosis_count,
    p_confirmed_intervention_count,
    p_linked_next_lesson_count
  );

  return jsonb_build_object(
    'integrationId',v_pair->>'integrationId',
    'organisationId',v_pair->>'organisationId',
    'connectorToken',v_connector,
    'contractVersion','1.0',
    'snapshotId',v_ingest->>'snapshotId',
    'accepted',true
  );
end;
$$;

revoke all on function public.khpos_pair_ksi_with_signal_server(text,text,text,text,text,timestamptz,timestamptz,timestamptz,integer,integer,integer,integer,numeric,integer,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.khpos_pair_ksi_with_signal_server(text,text,text,text,text,timestamptz,timestamptz,timestamptz,integer,integer,integer,integer,numeric,integer,integer,integer,integer,integer,integer,integer) to service_role;

comment on function public.khpos_pair_ksi_with_signal_server(text,text,text,text,text,timestamptz,timestamptz,timestamptz,integer,integer,integer,integer,numeric,integer,integer,integer,integer,integer,integer,integer) is
  'Atomic Stage 7 trust establishment: validates a one-time KHP pairing token, binds the exact KSI workspace, stores the first bounded aggregate snapshot and returns the connector token only if the full transaction succeeds.';
