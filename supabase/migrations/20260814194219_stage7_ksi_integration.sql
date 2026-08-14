create extension if not exists pgcrypto;

create table if not exists public.khpos_integrations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  provider text not null check (provider in ('ksi')),
  status text not null default 'pending' check (status in ('pending','active','revoked','error')),
  external_tenant_id text,
  external_tenant_name text,
  pairing_token_hash text,
  pairing_expires_at timestamptz,
  connector_token_hash text,
  source_contract_version text not null default '1.0',
  last_synced_at timestamptz,
  last_source_generated_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  connected_by_external text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, provider)
);

create table if not exists public.khpos_ksi_signal_snapshots (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.khpos_integrations(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  external_workspace_id text not null,
  contract_version text not null default '1.0',
  window_start timestamptz not null,
  window_end timestamptz not null,
  source_generated_at timestamptz not null,
  lesson_count integer not null check (lesson_count >= 0),
  validated_lesson_count integer not null check (validated_lesson_count >= 0 and validated_lesson_count <= lesson_count),
  fidelity_check_count integer not null check (fidelity_check_count >= 0),
  fidelity_pass_count integer not null check (fidelity_pass_count >= 0 and fidelity_pass_count <= fidelity_check_count),
  fidelity_average_score numeric(5,2) check (fidelity_average_score is null or fidelity_average_score between 0 and 100),
  assessment_count integer not null check (assessment_count >= 0),
  validated_assessment_count integer not null check (validated_assessment_count >= 0 and validated_assessment_count <= assessment_count),
  assessment_from_lesson_count integer not null check (assessment_from_lesson_count >= 0 and assessment_from_lesson_count <= assessment_count),
  diagnosis_count integer not null check (diagnosis_count >= 0),
  final_diagnosis_count integer not null check (final_diagnosis_count >= 0 and final_diagnosis_count <= diagnosis_count),
  confirmed_intervention_count integer not null check (confirmed_intervention_count >= 0),
  linked_next_lesson_count integer not null check (linked_next_lesson_count >= 0 and linked_next_lesson_count <= confirmed_intervention_count),
  received_at timestamptz not null default now(),
  unique (integration_id, source_generated_at),
  check (window_end > window_start),
  check (window_end - window_start <= interval '180 days')
);

create index if not exists idx_khpos_integrations_org_provider on public.khpos_integrations (organisation_id, provider, status);
create index if not exists idx_khpos_ksi_signals_org_generated on public.khpos_ksi_signal_snapshots (organisation_id, source_generated_at desc);

alter table public.khpos_integrations enable row level security;
alter table public.khpos_ksi_signal_snapshots enable row level security;
revoke all privileges on table public.khpos_integrations from public, anon, authenticated;
revoke all privileges on table public.khpos_ksi_signal_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.khpos_integrations to service_role;
grant select, insert, update, delete on table public.khpos_ksi_signal_snapshots to service_role;

create or replace function public.khpos_create_ksi_pairing_server(p_actor_user_id uuid,p_organisation_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_role text; v_token text; v_hash text; v_integration_id uuid;
begin
  select role into v_role from public.organisation_memberships where organisation_id=p_organisation_id and user_id=p_actor_user_id and status='active' limit 1;
  if v_role not in ('executive','transformation_lead') then raise exception 'Executive or Transformation Lead approval is required to connect KSI.'; end if;
  v_token := encode(extensions.gen_random_bytes(24),'hex');
  v_hash := encode(extensions.digest(v_token,'sha256'),'hex');
  insert into public.khpos_integrations(organisation_id,provider,status,pairing_token_hash,pairing_expires_at,connector_token_hash,source_contract_version,created_by,updated_at)
  values(p_organisation_id,'ksi','pending',v_hash,now()+interval '15 minutes',null,'1.0',p_actor_user_id,now())
  on conflict (organisation_id,provider) do update set status='pending',external_tenant_id=null,external_tenant_name=null,pairing_token_hash=excluded.pairing_token_hash,pairing_expires_at=excluded.pairing_expires_at,connector_token_hash=null,source_contract_version='1.0',last_synced_at=null,last_source_generated_at=null,created_by=p_actor_user_id,connected_by_external=null,updated_at=now()
  returning id into v_integration_id;
  insert into public.khpos_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
  values(p_organisation_id,p_actor_user_id,'ksi_pairing_created','integration',v_integration_id,jsonb_build_object('provider','ksi','contractVersion','1.0','expiresInMinutes',15));
  return jsonb_build_object('integrationId',v_integration_id,'pairingToken',v_token,'expiresAt',now()+interval '15 minutes','contractVersion','1.0');
end; $$;

create or replace function public.khpos_accept_ksi_pairing_server(p_pairing_token text,p_external_workspace_id text,p_external_workspace_name text,p_external_actor text,p_contract_version text default '1.0')
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_integration public.khpos_integrations%rowtype; v_connector_token text; v_connector_hash text;
begin
  if p_contract_version <> '1.0' then raise exception 'Unsupported KSI integration contract version.'; end if;
  if length(trim(coalesce(p_pairing_token,''))) < 32 then raise exception 'Invalid or expired KSI pairing token.'; end if;
  if length(trim(coalesce(p_external_workspace_id,''))) < 8 or length(trim(coalesce(p_external_workspace_id,''))) > 160 then raise exception 'A valid KSI workspace identifier is required.'; end if;
  select * into v_integration from public.khpos_integrations where provider='ksi' and status='pending' and pairing_token_hash=encode(extensions.digest(trim(p_pairing_token),'sha256'),'hex') and pairing_expires_at>now() for update;
  if v_integration.id is null then raise exception 'Invalid or expired KSI pairing token.'; end if;
  v_connector_token := encode(extensions.gen_random_bytes(32),'hex');
  v_connector_hash := encode(extensions.digest(v_connector_token,'sha256'),'hex');
  update public.khpos_integrations set status='active',external_tenant_id=trim(p_external_workspace_id),external_tenant_name=nullif(left(trim(coalesce(p_external_workspace_name,'')),160),''),pairing_token_hash=null,pairing_expires_at=null,connector_token_hash=v_connector_hash,source_contract_version='1.0',connected_by_external=nullif(left(trim(coalesce(p_external_actor,'')),160),''),updated_at=now() where id=v_integration.id;
  insert into public.khpos_audit_events(organisation_id,event_type,object_type,object_id,metadata)
  values(v_integration.organisation_id,'ksi_integration_activated','integration',v_integration.id,jsonb_build_object('provider','ksi','externalWorkspaceId',trim(p_external_workspace_id),'contractVersion','1.0'));
  return jsonb_build_object('integrationId',v_integration.id,'organisationId',v_integration.organisation_id,'connectorToken',v_connector_token,'contractVersion','1.0');
end; $$;

create or replace function public.khpos_ingest_ksi_signal_server(
  p_connector_token text,p_external_workspace_id text,p_contract_version text,p_source_generated_at timestamptz,p_window_start timestamptz,p_window_end timestamptz,
  p_lesson_count integer,p_validated_lesson_count integer,p_fidelity_check_count integer,p_fidelity_pass_count integer,p_fidelity_average_score numeric,
  p_assessment_count integer,p_validated_assessment_count integer,p_assessment_from_lesson_count integer,p_diagnosis_count integer,p_final_diagnosis_count integer,p_confirmed_intervention_count integer,p_linked_next_lesson_count integer)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_integration public.khpos_integrations%rowtype; v_snapshot_id uuid;
begin
  if p_contract_version <> '1.0' then raise exception 'Unsupported KSI integration contract version.'; end if;
  if length(trim(coalesce(p_connector_token,''))) < 48 then raise exception 'Invalid KSI connector token.'; end if;
  select * into v_integration from public.khpos_integrations where provider='ksi' and status='active' and connector_token_hash=encode(extensions.digest(trim(p_connector_token),'sha256'),'hex') for update;
  if v_integration.id is null then raise exception 'Invalid KSI connector token.'; end if;
  if trim(coalesce(p_external_workspace_id,'')) <> v_integration.external_tenant_id then raise exception 'KSI workspace does not match the paired integration.'; end if;
  if p_source_generated_at > now()+interval '10 minutes' then raise exception 'KSI source timestamp is invalid.'; end if;
  if p_window_end <= p_window_start or p_window_end-p_window_start > interval '180 days' then raise exception 'KSI signal window is invalid.'; end if;
  if p_window_end > p_source_generated_at+interval '10 minutes' then raise exception 'KSI signal window cannot extend beyond source generation time.'; end if;
  if p_lesson_count<0 or p_validated_lesson_count<0 or p_validated_lesson_count>p_lesson_count or p_fidelity_check_count<0 or p_fidelity_pass_count<0 or p_fidelity_pass_count>p_fidelity_check_count or (p_fidelity_average_score is not null and (p_fidelity_average_score<0 or p_fidelity_average_score>100)) or p_assessment_count<0 or p_validated_assessment_count<0 or p_validated_assessment_count>p_assessment_count or p_assessment_from_lesson_count<0 or p_assessment_from_lesson_count>p_assessment_count or p_diagnosis_count<0 or p_final_diagnosis_count<0 or p_final_diagnosis_count>p_diagnosis_count or p_confirmed_intervention_count<0 or p_linked_next_lesson_count<0 or p_linked_next_lesson_count>p_confirmed_intervention_count then raise exception 'KSI aggregate counters are inconsistent.'; end if;
  insert into public.khpos_ksi_signal_snapshots(integration_id,organisation_id,external_workspace_id,contract_version,window_start,window_end,source_generated_at,lesson_count,validated_lesson_count,fidelity_check_count,fidelity_pass_count,fidelity_average_score,assessment_count,validated_assessment_count,assessment_from_lesson_count,diagnosis_count,final_diagnosis_count,confirmed_intervention_count,linked_next_lesson_count)
  values(v_integration.id,v_integration.organisation_id,v_integration.external_tenant_id,'1.0',p_window_start,p_window_end,p_source_generated_at,p_lesson_count,p_validated_lesson_count,p_fidelity_check_count,p_fidelity_pass_count,p_fidelity_average_score,p_assessment_count,p_validated_assessment_count,p_assessment_from_lesson_count,p_diagnosis_count,p_final_diagnosis_count,p_confirmed_intervention_count,p_linked_next_lesson_count)
  on conflict(integration_id,source_generated_at) do update set window_start=excluded.window_start,window_end=excluded.window_end,lesson_count=excluded.lesson_count,validated_lesson_count=excluded.validated_lesson_count,fidelity_check_count=excluded.fidelity_check_count,fidelity_pass_count=excluded.fidelity_pass_count,fidelity_average_score=excluded.fidelity_average_score,assessment_count=excluded.assessment_count,validated_assessment_count=excluded.validated_assessment_count,assessment_from_lesson_count=excluded.assessment_from_lesson_count,diagnosis_count=excluded.diagnosis_count,final_diagnosis_count=excluded.final_diagnosis_count,confirmed_intervention_count=excluded.confirmed_intervention_count,linked_next_lesson_count=excluded.linked_next_lesson_count,received_at=now()
  returning id into v_snapshot_id;
  update public.khpos_integrations set last_synced_at=now(),last_source_generated_at=greatest(coalesce(last_source_generated_at,p_source_generated_at),p_source_generated_at),updated_at=now() where id=v_integration.id;
  insert into public.khpos_audit_events(organisation_id,event_type,object_type,object_id,metadata) values(v_integration.organisation_id,'ksi_signal_ingested','integration',v_integration.id,jsonb_build_object('snapshotId',v_snapshot_id,'externalWorkspaceId',v_integration.external_tenant_id,'contractVersion','1.0','sourceGeneratedAt',p_source_generated_at,'windowStart',p_window_start,'windowEnd',p_window_end));
  return jsonb_build_object('snapshotId',v_snapshot_id,'integrationId',v_integration.id,'organisationId',v_integration.organisation_id,'accepted',true);
end; $$;

revoke all on function public.khpos_create_ksi_pairing_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_accept_ksi_pairing_server(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.khpos_ingest_ksi_signal_server(text,text,text,timestamptz,timestamptz,timestamptz,integer,integer,integer,integer,numeric,integer,integer,integer,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.khpos_create_ksi_pairing_server(uuid,uuid) to service_role;
grant execute on function public.khpos_accept_ksi_pairing_server(text,text,text,text,text) to service_role;
grant execute on function public.khpos_ingest_ksi_signal_server(text,text,text,timestamptz,timestamptz,timestamptz,integer,integer,integer,integer,numeric,integer,integer,integer,integer,integer,integer,integer) to service_role;

comment on table public.khpos_integrations is 'Server-mediated KHP-OS integration bindings. Secret pairing and connector tokens are stored only as SHA-256 hashes.';
comment on table public.khpos_ksi_signal_snapshots is 'Institution-level aggregate learning-quality signals received from KSI. No learner/teacher records or diagnostic prose are stored here.';
comment on function public.khpos_ingest_ksi_signal_server(text,text,text,timestamptz,timestamptz,timestamptz,integer,integer,integer,integer,numeric,integer,integer,integer,integer,integer,integer,integer) is 'Server-only KSI aggregate signal receiver. This function records learning context only and has no authority to resolve KSHC priorities or verified improvement.';
