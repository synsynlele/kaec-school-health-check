alter table public.khpos_ops_decisions
  add column if not exists outcome_status text
    check (outcome_status in ('achieved','partially_achieved','not_achieved')),
  add column if not exists outcome_note text,
  add column if not exists outcome_verified_by uuid references auth.users(id) on delete set null,
  add column if not exists outcome_verified_at timestamptz;

create index if not exists idx_khpos_ops_decisions_outcome_verified_by
  on public.khpos_ops_decisions(outcome_verified_by)
  where outcome_verified_by is not null;

create or replace function khpos_private.ops_require_decision_outcome_before_close()
returns trigger
language plpgsql
set search_path=public,khpos_private,pg_temp
as $$
begin
  if old.status='implemented'
     and new.status='closed'
     and old.action_required
     and new.outcome_status is null then
    raise exception 'Record whether the expected outcome was achieved before closing this implemented decision.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_khpos_ops_require_decision_outcome_before_close
  on public.khpos_ops_decisions;
create trigger trg_khpos_ops_require_decision_outcome_before_close
before update of status on public.khpos_ops_decisions
for each row execute function khpos_private.ops_require_decision_outcome_before_close();

create or replace function public.khpos_ops_close_decision_outcome_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_decision_id uuid,
  p_outcome_status text,
  p_outcome_note text
)
returns void
language plpgsql
security definer
set search_path=public,auth,khpos_private,pg_temp
as $$
declare
  v_decision public.khpos_ops_decisions%rowtype;
  v_is_requester boolean := false;
  v_is_authority boolean := false;
begin
  if p_outcome_status not in ('achieved','partially_achieved','not_achieved') then
    raise exception 'Choose whether the expected outcome was achieved, partially achieved or not achieved.';
  end if;

  if nullif(btrim(coalesce(p_outcome_note,'')),'') is null then
    raise exception 'Record the observed outcome before closing this decision.';
  end if;

  if not exists(
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

  select * into v_decision
  from public.khpos_ops_decisions
  where id=p_decision_id
    and organisation_id=p_organisation_id
    and sensitivity='standard'
  for update;

  if v_decision.id is null then
    raise exception 'Decision not found.';
  end if;

  if v_decision.status<>'implemented' or not v_decision.action_required then
    raise exception 'Only an implemented decision with a linked action uses outcome verification.';
  end if;

  v_is_requester := v_decision.requested_by=p_actor_user_id;
  v_is_authority := exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.role_id=v_decision.authority_role_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (a.campus_id is null or v_decision.campus_id is null or a.campus_id=v_decision.campus_id)
      and (a.unit_id is null or v_decision.unit_id is null or a.unit_id=v_decision.unit_id)
  );

  if not (v_is_requester or v_is_authority) then
    raise exception 'Only the requester or decision authority can verify the decision outcome.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_work_items w
    where w.source_decision_id=v_decision.id
      and w.status='completed'
      and w.verification_required=true
      and w.verified_at is not null
  ) then
    raise exception 'The implementation work must be independently verified before outcome closure.';
  end if;

  update public.khpos_ops_decisions
  set outcome_status=p_outcome_status,
      outcome_note=left(btrim(p_outcome_note),6000),
      outcome_verified_by=p_actor_user_id,
      outcome_verified_at=now(),
      status='closed',
      closed_at=now(),
      updated_at=now()
  where id=v_decision.id;

  insert into public.khpos_ops_decision_events(
    organisation_id,decision_id,actor_user_id,event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_decision.id,p_actor_user_id,'outcome_verified',
    'implemented','closed',left(btrim(p_outcome_note),6000),
    jsonb_build_object(
      'outcomeStatus',p_outcome_status,
      'expectedOutcome',v_decision.implementation_expected_outcome
    )
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_decision_outcome_verified',
    'decision',v_decision.id,
    jsonb_build_object('outcomeStatus',p_outcome_status)
  );
end;
$$;

revoke execute on function khpos_private.ops_require_decision_outcome_before_close()
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_close_decision_outcome_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_close_decision_outcome_server(uuid,uuid,uuid,text,text)
  to service_role;
