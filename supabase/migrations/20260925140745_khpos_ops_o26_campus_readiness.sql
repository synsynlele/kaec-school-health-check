-- O26: daily campus readiness and independently verified exceptions.
create table public.khpos_ops_campus_checks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  operating_date date not null,
  check_code text not null check(check_code in ('opening','sanitation','utilities','learning','closing')),
  status text not null check(status in ('passed','exception','resolved','verified')),
  observation text not null,
  evidence_reference text not null,
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  resolution_note text,
  resolution_evidence text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  verification_note text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(organisation_id,campus_id,operating_date,check_code)
);
create index idx_khpos_ops_campus_checks_scope on public.khpos_ops_campus_checks(organisation_id,campus_id,operating_date desc,status);
create table public.khpos_ops_campus_check_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  check_id uuid not null references public.khpos_ops_campus_checks(id),
  event_type text not null check(event_type in ('recorded','resolved','returned','verified')),
  note text not null,
  evidence_reference text,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_khpos_ops_campus_check_events_check on public.khpos_ops_campus_check_events(check_id,created_at);
alter table public.khpos_ops_campus_checks enable row level security;
alter table public.khpos_ops_campus_check_events enable row level security;
revoke all on public.khpos_ops_campus_checks from public,anon,authenticated;
revoke all on public.khpos_ops_campus_check_events from public,anon,authenticated;

create function public.khpos_ops_get_campus_readiness_server(p_actor uuid,p_org uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER']::text[]) then raise exception 'Active school role and membership required.'; end if;
  return jsonb_build_object(
    'operatingDate',(now() at time zone 'Africa/Lagos')::date,
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'canManage',khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,true))) from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active' and khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,false)),'[]'::jsonb),
    'checks',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'campusId',x.campus_id,'operatingDate',x.operating_date,'code',x.check_code,'status',x.status,'observation',x.observation,'evidenceReference',x.evidence_reference,'resolutionNote',x.resolution_note,'resolutionEvidence',x.resolution_evidence,'verificationNote',x.verification_note,'resolvedBy',x.resolved_by,'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'note',e.note,'evidenceReference',e.evidence_reference,'createdAt',e.created_at) order by e.created_at) from public.khpos_ops_campus_check_events e where e.check_id=x.id),'[]'::jsonb)) order by x.operating_date desc,x.check_code) from public.khpos_ops_campus_checks x where x.organisation_id=p_org and khpos_private.ops_culture_campus_access(p_actor,p_org,x.campus_id,false) and (x.operating_date=(now() at time zone 'Africa/Lagos')::date or x.status in ('exception','resolved'))),'[]'::jsonb)
  );
end $$;

create function public.khpos_ops_campus_readiness_action_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_check public.khpos_ops_campus_checks%rowtype; v_campus uuid; v_note text; v_evidence text; v_event text;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER']::text[]) then raise exception 'Active school role and membership required.'; end if;
  v_note:=nullif(btrim(p_input->>'note'),''); v_evidence:=nullif(btrim(p_input->>'evidenceReference'),'');
  if v_note is null then raise exception 'A meaningful observation or note is required.'; end if;
  if p_mode='record' then
    v_campus:=(p_input->>'campusId')::uuid;
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_org and status='active') or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,false) then raise exception 'Reporter must serve an active campus.'; end if;
    if p_input->>'code' not in ('opening','sanitation','utilities','learning','closing') or p_input->>'result' not in ('passed','exception') or v_evidence is null then raise exception 'Check, result and evidence reference are required.'; end if;
    insert into public.khpos_ops_campus_checks(organisation_id,campus_id,operating_date,check_code,status,observation,evidence_reference,recorded_by)
    values(p_org,v_campus,(now() at time zone 'Africa/Lagos')::date,p_input->>'code',p_input->>'result',v_note,v_evidence,p_actor)
    returning * into v_check;
    v_event:='recorded';
  else
    select * into v_check from public.khpos_ops_campus_checks where id=(p_input->>'checkId')::uuid and organisation_id=p_org for update;
    if v_check.id is null or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_check.campus_id,true) then raise exception 'Campus leader must own this exception.'; end if;
    if p_mode='resolve' then
      if v_check.status<>'exception' or v_evidence is null then raise exception 'Open exception and resolution evidence required.'; end if;
      update public.khpos_ops_campus_checks set status='resolved',resolution_note=v_note,resolution_evidence=v_evidence,resolved_by=p_actor,resolved_at=now(),updated_at=now() where id=v_check.id; v_event:='resolved';
    elsif p_mode='return' then
      if v_check.status<>'resolved' or v_check.resolved_by=p_actor then raise exception 'A different campus leader must review the resolution.'; end if;
      update public.khpos_ops_campus_checks set status='exception',verification_note=v_note,verified_by=null,verified_at=null,updated_at=now() where id=v_check.id; v_event:='returned';
    elsif p_mode='verify' then
      if v_check.status<>'resolved' or v_check.resolved_by=p_actor then raise exception 'A different campus leader must verify the resolution.'; end if;
      update public.khpos_ops_campus_checks set status='verified',verification_note=v_note,verified_by=p_actor,verified_at=now(),updated_at=now() where id=v_check.id; v_event:='verified';
    else raise exception 'Unsupported campus readiness action.';
    end if;
  end if;
  insert into public.khpos_ops_campus_check_events(organisation_id,check_id,event_type,note,evidence_reference,actor_id) values(p_org,v_check.id,v_event,v_note,v_evidence,p_actor);
  return public.khpos_ops_get_campus_readiness_server(p_actor,p_org);
end $$;
revoke all on function public.khpos_ops_get_campus_readiness_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_campus_readiness_action_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_get_campus_readiness_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_campus_readiness_action_server(uuid,uuid,text,jsonb) to service_role;
