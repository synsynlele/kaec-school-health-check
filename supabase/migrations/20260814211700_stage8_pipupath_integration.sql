alter table public.khpos_integrations drop constraint if exists khpos_integrations_provider_check;
alter table public.khpos_integrations add constraint khpos_integrations_provider_check check (provider in ('ksi','pipupath'));
alter table public.khpos_integrations add column if not exists external_invite_url text;

create table if not exists public.khpos_pipupath_signal_snapshots (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.khpos_integrations(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  external_cohort_id text not null,
  contract_version text not null default '1.0',
  window_start timestamptz not null,
  window_end timestamptz not null,
  source_generated_at timestamptz not null,
  reporting_eligible boolean not null,
  cohort_member_count integer not null check (cohort_member_count >= 0),
  active_profile_count integer not null check (active_profile_count >= 0),
  path_selected_count integer not null check (path_selected_count >= 0),
  quest_participant_count integer not null check (quest_participant_count >= 0),
  evidence_backed_quest_participant_count integer not null check (evidence_backed_quest_participant_count >= 0),
  project_participant_count integer not null check (project_participant_count >= 0),
  project_completion_participant_count integer not null check (project_completion_participant_count >= 0),
  continuation_eligible_count integer not null check (continuation_eligible_count >= 0),
  continuing_cycle_participant_count integer not null check (continuing_cycle_participant_count >= 0),
  received_at timestamptz not null default now(),
  unique (integration_id, source_generated_at),
  check (window_end > window_start),
  check (window_end - window_start <= interval '180 days'),
  check (
    (not reporting_eligible and cohort_member_count = 0 and active_profile_count = 0 and path_selected_count = 0 and quest_participant_count = 0 and evidence_backed_quest_participant_count = 0 and project_participant_count = 0 and project_completion_participant_count = 0 and continuation_eligible_count = 0 and continuing_cycle_participant_count = 0)
    or
    (reporting_eligible and cohort_member_count >= 5 and active_profile_count <= cohort_member_count and path_selected_count <= active_profile_count and quest_participant_count <= cohort_member_count and evidence_backed_quest_participant_count <= quest_participant_count and project_participant_count <= cohort_member_count and project_completion_participant_count <= project_participant_count and continuation_eligible_count <= cohort_member_count and continuing_cycle_participant_count <= continuation_eligible_count)
  )
);

create index if not exists idx_khpos_pipupath_signals_org_generated on public.khpos_pipupath_signal_snapshots (organisation_id, source_generated_at desc);
alter table public.khpos_pipupath_signal_snapshots enable row level security;
revoke all privileges on table public.khpos_pipupath_signal_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.khpos_pipupath_signal_snapshots to service_role;

create or replace function public.khpos_create_pipupath_pairing_server(p_actor_user_id uuid,p_organisation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_token text; v_hash text; v_integration_id uuid;
begin
  select role into v_role from public.organisation_memberships where organisation_id=p_organisation_id and user_id=p_actor_user_id and status='active' limit 1;
  if v_role not in ('executive','transformation_lead') then raise exception 'Executive or Transformation Lead approval is required to connect PipuPath.'; end if;
  v_token := encode(extensions.gen_random_bytes(24),'hex');
  v_hash := encode(extensions.digest(v_token,'sha256'),'hex');
  insert into public.khpos_integrations(organisation_id,provider,status,pairing_token_hash,pairing_expires_at,connector_token_hash,source_contract_version,created_by,external_invite_url,updated_at)
  values(p_organisation_id,'pipupath','pending',v_hash,now()+interval '15 minutes',null,'1.0',p_actor_user_id,null,now())
  on conflict (organisation_id,provider) do update set status='pending',external_tenant_id=null,external_tenant_name=null,pairing_token_hash=excluded.pairing_token_hash,pairing_expires_at=excluded.pairing_expires_at,connector_token_hash=null,source_contract_version='1.0',last_synced_at=null,last_source_generated_at=null,created_by=p_actor_user_id,connected_by_external=null,external_invite_url=null,updated_at=now()
  returning id into v_integration_id;
  insert into public.khpos_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
  values(p_organisation_id,p_actor_user_id,'pipupath_pairing_created','integration',v_integration_id,jsonb_build_object('provider','pipupath','contractVersion','1.0','expiresInMinutes',15));
  return jsonb_build_object('integrationId',v_integration_id,'pairingToken',v_token,'expiresAt',now()+interval '15 minutes','contractVersion','1.0');
end; $$;

create or replace function public.khpos_pair_pipupath_with_signal_server(
  p_pairing_token text,p_external_cohort_id text,p_external_cohort_name text,p_external_invite_url text,p_contract_version text,
  p_source_generated_at timestamptz,p_window_start timestamptz,p_window_end timestamptz,p_reporting_eligible boolean,
  p_cohort_member_count integer,p_active_profile_count integer,p_path_selected_count integer,p_quest_participant_count integer,p_evidence_backed_quest_participant_count integer,
  p_project_participant_count integer,p_project_completion_participant_count integer,p_continuation_eligible_count integer,p_continuing_cycle_participant_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_integration public.khpos_integrations%rowtype; v_snapshot_id uuid;
begin
  if p_contract_version <> '1.0' then raise exception 'Unsupported PipuPath integration contract version.'; end if;
  if length(trim(coalesce(p_pairing_token,''))) < 32 then raise exception 'Invalid or expired PipuPath pairing token.'; end if;
  if length(trim(coalesce(p_external_cohort_id,''))) < 8 or length(trim(coalesce(p_external_cohort_id,''))) > 160 then raise exception 'A valid PipuPath cohort identifier is required.'; end if;
  if length(trim(coalesce(p_external_invite_url,''))) < 12 or length(trim(coalesce(p_external_invite_url,''))) > 500 or lower(trim(p_external_invite_url)) not like 'https://%' then raise exception 'A valid secure PipuPath cohort invitation is required.'; end if;
  select * into v_integration from public.khpos_integrations where provider='pipupath' and status='pending' and pairing_token_hash=encode(extensions.digest(trim(p_pairing_token),'sha256'),'hex') and pairing_expires_at>now() for update;
  if v_integration.id is null then raise exception 'Invalid or expired PipuPath pairing token.'; end if;
  if p_source_generated_at > now()+interval '10 minutes' then raise exception 'PipuPath source timestamp is invalid.'; end if;
  if p_window_end <= p_window_start or p_window_end-p_window_start > interval '180 days' or p_window_end > p_source_generated_at+interval '10 minutes' then raise exception 'PipuPath signal window is invalid.'; end if;
  if (not p_reporting_eligible and (p_cohort_member_count<>0 or p_active_profile_count<>0 or p_path_selected_count<>0 or p_quest_participant_count<>0 or p_evidence_backed_quest_participant_count<>0 or p_project_participant_count<>0 or p_project_completion_participant_count<>0 or p_continuation_eligible_count<>0 or p_continuing_cycle_participant_count<>0)) or
     (p_reporting_eligible and (p_cohort_member_count<5 or p_active_profile_count<0 or p_active_profile_count>p_cohort_member_count or p_path_selected_count<0 or p_path_selected_count>p_active_profile_count or p_quest_participant_count<0 or p_quest_participant_count>p_cohort_member_count or p_evidence_backed_quest_participant_count<0 or p_evidence_backed_quest_participant_count>p_quest_participant_count or p_project_participant_count<0 or p_project_participant_count>p_cohort_member_count or p_project_completion_participant_count<0 or p_project_completion_participant_count>p_project_participant_count or p_continuation_eligible_count<0 or p_continuation_eligible_count>p_cohort_member_count or p_continuing_cycle_participant_count<0 or p_continuing_cycle_participant_count>p_continuation_eligible_count)) then raise exception 'PipuPath aggregate counters are inconsistent.'; end if;
  update public.khpos_integrations set status='active',external_tenant_id=trim(p_external_cohort_id),external_tenant_name=nullif(left(trim(coalesce(p_external_cohort_name,'')),160),''),external_invite_url=trim(p_external_invite_url),pairing_token_hash=null,pairing_expires_at=null,connector_token_hash=null,source_contract_version='1.0',connected_by_external='pipupath_server',last_synced_at=now(),last_source_generated_at=p_source_generated_at,updated_at=now() where id=v_integration.id;
  insert into public.khpos_pipupath_signal_snapshots(integration_id,organisation_id,external_cohort_id,contract_version,window_start,window_end,source_generated_at,reporting_eligible,cohort_member_count,active_profile_count,path_selected_count,quest_participant_count,evidence_backed_quest_participant_count,project_participant_count,project_completion_participant_count,continuation_eligible_count,continuing_cycle_participant_count)
  values(v_integration.id,v_integration.organisation_id,trim(p_external_cohort_id),'1.0',p_window_start,p_window_end,p_source_generated_at,p_reporting_eligible,p_cohort_member_count,p_active_profile_count,p_path_selected_count,p_quest_participant_count,p_evidence_backed_quest_participant_count,p_project_participant_count,p_project_completion_participant_count,p_continuation_eligible_count,p_continuing_cycle_participant_count)
  returning id into v_snapshot_id;
  insert into public.khpos_audit_events(organisation_id,event_type,object_type,object_id,metadata)
  values(v_integration.organisation_id,'pipupath_integration_activated','integration',v_integration.id,jsonb_build_object('provider','pipupath','externalCohortId',trim(p_external_cohort_id),'contractVersion','1.0','reportingEligible',p_reporting_eligible,'snapshotId',v_snapshot_id));
  return jsonb_build_object('integrationId',v_integration.id,'organisationId',v_integration.organisation_id,'snapshotId',v_snapshot_id,'contractVersion','1.0');
end; $$;

create or replace function public.khpos_create_pipupath_sync_token_server(p_actor_user_id uuid,p_organisation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_token text; v_hash text; v_integration public.khpos_integrations%rowtype;
begin
  select role into v_role from public.organisation_memberships where organisation_id=p_organisation_id and user_id=p_actor_user_id and status='active' limit 1;
  if v_role not in ('executive','transformation_lead') then raise exception 'Executive or Transformation Lead approval is required to refresh PipuPath intelligence.'; end if;
  select * into v_integration from public.khpos_integrations where organisation_id=p_organisation_id and provider='pipupath' and status='active' for update;
  if v_integration.id is null or v_integration.external_tenant_id is null then raise exception 'PipuPath is not connected to this school.'; end if;
  v_token := encode(extensions.gen_random_bytes(24),'hex');
  v_hash := encode(extensions.digest(v_token,'sha256'),'hex');
  update public.khpos_integrations set pairing_token_hash=v_hash,pairing_expires_at=now()+interval '15 minutes',updated_at=now() where id=v_integration.id;
  insert into public.khpos_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
  values(p_organisation_id,p_actor_user_id,'pipupath_sync_requested','integration',v_integration.id,jsonb_build_object('provider','pipupath','expiresInMinutes',15));
  return jsonb_build_object('integrationId',v_integration.id,'externalCohortId',v_integration.external_tenant_id,'syncToken',v_token,'expiresAt',now()+interval '15 minutes','contractVersion','1.0');
end; $$;

create or replace function public.khpos_ingest_pipupath_signal_server(
  p_sync_token text,p_external_cohort_id text,p_contract_version text,p_source_generated_at timestamptz,p_window_start timestamptz,p_window_end timestamptz,p_reporting_eligible boolean,
  p_cohort_member_count integer,p_active_profile_count integer,p_path_selected_count integer,p_quest_participant_count integer,p_evidence_backed_quest_participant_count integer,
  p_project_participant_count integer,p_project_completion_participant_count integer,p_continuation_eligible_count integer,p_continuing_cycle_participant_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_integration public.khpos_integrations%rowtype; v_snapshot_id uuid;
begin
  if p_contract_version <> '1.0' then raise exception 'Unsupported PipuPath integration contract version.'; end if;
  if length(trim(coalesce(p_sync_token,''))) < 32 then raise exception 'Invalid or expired PipuPath sync token.'; end if;
  select * into v_integration from public.khpos_integrations where provider='pipupath' and status='active' and pairing_token_hash=encode(extensions.digest(trim(p_sync_token),'sha256'),'hex') and pairing_expires_at>now() for update;
  if v_integration.id is null then raise exception 'Invalid or expired PipuPath sync token.'; end if;
  if trim(coalesce(p_external_cohort_id,'')) <> v_integration.external_tenant_id then raise exception 'PipuPath cohort does not match the paired integration.'; end if;
  if p_source_generated_at > now()+interval '10 minutes' then raise exception 'PipuPath source timestamp is invalid.'; end if;
  if p_window_end <= p_window_start or p_window_end-p_window_start > interval '180 days' or p_window_end > p_source_generated_at+interval '10 minutes' then raise exception 'PipuPath signal window is invalid.'; end if;
  if (not p_reporting_eligible and (p_cohort_member_count<>0 or p_active_profile_count<>0 or p_path_selected_count<>0 or p_quest_participant_count<>0 or p_evidence_backed_quest_participant_count<>0 or p_project_participant_count<>0 or p_project_completion_participant_count<>0 or p_continuation_eligible_count<>0 or p_continuing_cycle_participant_count<>0)) or
     (p_reporting_eligible and (p_cohort_member_count<5 or p_active_profile_count<0 or p_active_profile_count>p_cohort_member_count or p_path_selected_count<0 or p_path_selected_count>p_active_profile_count or p_quest_participant_count<0 or p_quest_participant_count>p_cohort_member_count or p_evidence_backed_quest_participant_count<0 or p_evidence_backed_quest_participant_count>p_quest_participant_count or p_project_participant_count<0 or p_project_participant_count>p_cohort_member_count or p_project_completion_participant_count<0 or p_project_completion_participant_count>p_project_participant_count or p_continuation_eligible_count<0 or p_continuation_eligible_count>p_cohort_member_count or p_continuing_cycle_participant_count<0 or p_continuing_cycle_participant_count>p_continuation_eligible_count)) then raise exception 'PipuPath aggregate counters are inconsistent.'; end if;
  insert into public.khpos_pipupath_signal_snapshots(integration_id,organisation_id,external_cohort_id,contract_version,window_start,window_end,source_generated_at,reporting_eligible,cohort_member_count,active_profile_count,path_selected_count,quest_participant_count,evidence_backed_quest_participant_count,project_participant_count,project_completion_participant_count,continuation_eligible_count,continuing_cycle_participant_count)
  values(v_integration.id,v_integration.organisation_id,v_integration.external_tenant_id,'1.0',p_window_start,p_window_end,p_source_generated_at,p_reporting_eligible,p_cohort_member_count,p_active_profile_count,p_path_selected_count,p_quest_participant_count,p_evidence_backed_quest_participant_count,p_project_participant_count,p_project_completion_participant_count,p_continuation_eligible_count,p_continuing_cycle_participant_count)
  on conflict(integration_id,source_generated_at) do update set window_start=excluded.window_start,window_end=excluded.window_end,reporting_eligible=excluded.reporting_eligible,cohort_member_count=excluded.cohort_member_count,active_profile_count=excluded.active_profile_count,path_selected_count=excluded.path_selected_count,quest_participant_count=excluded.quest_participant_count,evidence_backed_quest_participant_count=excluded.evidence_backed_quest_participant_count,project_participant_count=excluded.project_participant_count,project_completion_participant_count=excluded.project_completion_participant_count,continuation_eligible_count=excluded.continuation_eligible_count,continuing_cycle_participant_count=excluded.continuing_cycle_participant_count,received_at=now()
  returning id into v_snapshot_id;
  update public.khpos_integrations set pairing_token_hash=null,pairing_expires_at=null,last_synced_at=now(),last_source_generated_at=greatest(coalesce(last_source_generated_at,p_source_generated_at),p_source_generated_at),updated_at=now() where id=v_integration.id;
  insert into public.khpos_audit_events(organisation_id,event_type,object_type,object_id,metadata)
  values(v_integration.organisation_id,'pipupath_signal_ingested','integration',v_integration.id,jsonb_build_object('snapshotId',v_snapshot_id,'externalCohortId',v_integration.external_tenant_id,'contractVersion','1.0','reportingEligible',p_reporting_eligible,'sourceGeneratedAt',p_source_generated_at,'windowStart',p_window_start,'windowEnd',p_window_end));
  return jsonb_build_object('snapshotId',v_snapshot_id,'integrationId',v_integration.id,'organisationId',v_integration.organisation_id,'accepted',true);
end; $$;

revoke all on function public.khpos_create_pipupath_pairing_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_pair_pipupath_with_signal_server(text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer,integer,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.khpos_create_pipupath_sync_token_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ingest_pipupath_signal_server(text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer,integer,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.khpos_create_pipupath_pairing_server(uuid,uuid) to service_role;
grant execute on function public.khpos_pair_pipupath_with_signal_server(text,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer,integer,integer,integer,integer,integer,integer,integer) to service_role;
grant execute on function public.khpos_create_pipupath_sync_token_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ingest_pipupath_signal_server(text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer,integer,integer,integer,integer,integer,integer,integer) to service_role;

comment on table public.khpos_pipupath_signal_snapshots is 'Privacy-thresholded school-cohort human-potential signals received from PipuPath. No learner identities, profile content, mission/reflection prose, project content or contact/network data are stored.';
comment on function public.khpos_ingest_pipupath_signal_server(text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer,integer,integer,integer,integer,integer,integer,integer) is 'Server-only PipuPath cohort signal receiver. PipuPath context cannot resolve KSHC priorities or verified institutional improvement.';
