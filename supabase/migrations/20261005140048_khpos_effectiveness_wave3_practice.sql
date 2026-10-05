create table if not exists public.khpos_ops_practice_runs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid references public.khpos_ops_staff(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_code text not null default 'KHPOS_CORE_V1',
  completed_steps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completed_steps)='array'),
  status text not null default 'in_progress'
    check (status in ('in_progress','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organisation_id,user_id,scenario_code)
);

create index if not exists idx_khpos_ops_practice_runs_org_status
  on public.khpos_ops_practice_runs(organisation_id,status);
create index if not exists idx_khpos_ops_practice_runs_staff
  on public.khpos_ops_practice_runs(staff_id)
  where staff_id is not null;

alter table public.khpos_ops_practice_runs enable row level security;
revoke all privileges on table public.khpos_ops_practice_runs from public,anon,authenticated;
grant select,insert,update,delete on table public.khpos_ops_practice_runs to service_role;

create or replace function public.khpos_ops_save_practice_run_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_completed_steps jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,khpos_private,pg_temp
as $$
declare
  v_allowed text[] := array[
    'find_process',
    'start_work',
    'complete_checklist',
    'attach_evidence',
    'handle_return'
  ];
  v_steps text[];
  v_complete boolean := false;
  v_staff_id uuid;
  v_run public.khpos_ops_practice_runs%rowtype;
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

  if jsonb_typeof(p_completed_steps)<>'array' then
    raise exception 'Practice steps must be an array.';
  end if;

  select coalesce(array_agg(distinct value order by value),'{}'::text[])
  into v_steps
  from jsonb_array_elements_text(p_completed_steps);

  if exists (
    select 1
    from unnest(v_steps) step
    where not (step=any(v_allowed))
  ) then
    raise exception 'Unsupported practice step.';
  end if;

  v_complete := v_allowed <@ v_steps;

  select id into v_staff_id
  from public.khpos_ops_staff
  where organisation_id=p_organisation_id
    and user_id=p_actor_user_id
    and status not in ('ended')
  order by created_at desc
  limit 1;

  insert into public.khpos_ops_practice_runs(
    organisation_id,staff_id,user_id,scenario_code,completed_steps,status,completed_at
  ) values (
    p_organisation_id,v_staff_id,p_actor_user_id,'KHPOS_CORE_V1',
    to_jsonb(v_steps),
    case when v_complete then 'completed' else 'in_progress' end,
    case when v_complete then now() else null end
  )
  on conflict (organisation_id,user_id,scenario_code) do update
  set staff_id=excluded.staff_id,
      completed_steps=excluded.completed_steps,
      status=excluded.status,
      completed_at=case
        when excluded.status='completed'
        then coalesce(public.khpos_ops_practice_runs.completed_at,now())
        else null
      end,
      updated_at=now()
  returning * into v_run;

  if v_complete and v_staff_id is not null then
    update public.khpos_ops_staff_onboarding_items
    set status='completed',
        submission_note='Completed the system-verified KHP-OS guided practice.',
        evidence_reference='system://khpos/practice/KHPOS_CORE_V1',
        submitted_by=p_actor_user_id,
        submitted_at=coalesce(submitted_at,now()),
        reviewed_by=null,
        reviewed_at=now(),
        review_note='System-verified guided simulation: process → work → checklist → evidence → return/recovery.',
        updated_at=now()
    where organisation_id=p_organisation_id
      and staff_id=v_staff_id
      and requirement_code='PEO-ONB-007'
      and status in ('pending','submitted');

    if found then
      insert into public.khpos_ops_staff_events(
        organisation_id,staff_id,actor_user_id,event_type,note,metadata
      ) values (
        p_organisation_id,v_staff_id,p_actor_user_id,
        'onboarding_system_practice_completed',
        'KHP-OS guided operating simulation completed.',
        jsonb_build_object('scenarioCode','KHPOS_CORE_V1')
      );
    end if;

    perform khpos_private.ops_refresh_staff_readiness(v_staff_id);
  end if;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,
    case when v_complete then 'ops_practice_completed' else 'ops_practice_progress' end,
    'practice_run',v_run.id,
    jsonb_build_object(
      'scenarioCode','KHPOS_CORE_V1',
      'completedSteps',v_steps,
      'complete',v_complete
    )
  );

  return jsonb_build_object(
    'id',v_run.id,
    'scenarioCode',v_run.scenario_code,
    'completedSteps',v_run.completed_steps,
    'status',v_run.status,
    'completedAt',v_run.completed_at
  );
end;
$$;

revoke execute on function public.khpos_ops_save_practice_run_server(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_save_practice_run_server(uuid,uuid,jsonb)
  to service_role;
