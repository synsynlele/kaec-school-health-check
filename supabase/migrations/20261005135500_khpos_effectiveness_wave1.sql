-- KHP-OS effectiveness wave 1:
-- explicit process execution profiles + event/condition trigger engine.

create table if not exists public.khpos_ops_process_execution_profiles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  process_id uuid not null references public.khpos_ops_processes(id) on delete cascade,
  activation_mode text not null default 'manual_on_demand'
    check (activation_mode in (
      'recurring','event','condition','manual_on_demand','continuous_control','external_system'
    )),
  owner_role_id uuid references public.khpos_ops_roles(id) on delete restrict,
  event_type text,
  condition_key text check (
    condition_key is null or condition_key in (
      'work_overdue','issue_overdue','decision_overdue','kpi_failing','process_unmapped'
    )
  ),
  trigger_summary text,
  due_offset_minutes integer check (
    due_offset_minutes is null or due_offset_minutes between 0 and 525600
  ),
  evidence_required boolean not null default false,
  verification_required boolean not null default false,
  escalation_minutes integer check (
    escalation_minutes is null or escalation_minutes between 1 and 525600
  ),
  kpi_codes text[] not null default '{}'::text[],
  status text not null default 'needs_mapping'
    check (status in ('needs_mapping','configured','not_applicable')),
  configured_by uuid references auth.users(id) on delete set null,
  configured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(process_id),
  check (
    status <> 'configured'
    or activation_mode not in ('event','condition')
    or owner_role_id is not null
  ),
  check (
    activation_mode <> 'event'
    or status <> 'configured'
    or nullif(btrim(coalesce(event_type,'')),'') is not null
  ),
  check (
    activation_mode <> 'condition'
    or status <> 'configured'
    or condition_key is not null
  )
);

create table if not exists public.khpos_ops_trigger_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  execution_profile_id uuid not null references public.khpos_ops_process_execution_profiles(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  subject_type text,
  subject_id text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  status text not null default 'pending'
    check (status in ('pending','materialized','skipped','failed')),
  work_item_id uuid,
  error_message text,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organisation_id,execution_profile_id,event_key)
);

alter table public.khpos_ops_work_items
  add column if not exists source_trigger_event_id uuid
    references public.khpos_ops_trigger_events(id) on delete set null;

alter table public.khpos_ops_trigger_events
  drop constraint if exists khpos_ops_trigger_events_work_item_id_fkey;
alter table public.khpos_ops_trigger_events
  add constraint khpos_ops_trigger_events_work_item_id_fkey
  foreign key (work_item_id) references public.khpos_ops_work_items(id) on delete set null;

create index if not exists idx_khpos_ops_execution_profiles_org_status
  on public.khpos_ops_process_execution_profiles(organisation_id,status);
create index if not exists idx_khpos_ops_execution_profiles_owner
  on public.khpos_ops_process_execution_profiles(owner_role_id)
  where owner_role_id is not null;
create index if not exists idx_khpos_ops_execution_profiles_mode
  on public.khpos_ops_process_execution_profiles(organisation_id,activation_mode,status);
create index if not exists idx_khpos_ops_trigger_events_org_status
  on public.khpos_ops_trigger_events(organisation_id,status,occurred_at desc);
create index if not exists idx_khpos_ops_trigger_events_profile
  on public.khpos_ops_trigger_events(execution_profile_id,occurred_at desc);
create index if not exists idx_khpos_ops_trigger_events_work
  on public.khpos_ops_trigger_events(work_item_id)
  where work_item_id is not null;
create index if not exists idx_khpos_ops_work_source_trigger
  on public.khpos_ops_work_items(source_trigger_event_id)
  where source_trigger_event_id is not null;

alter table public.khpos_ops_process_execution_profiles enable row level security;
alter table public.khpos_ops_trigger_events enable row level security;

revoke all privileges on table public.khpos_ops_process_execution_profiles from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_trigger_events from public,anon,authenticated;
grant select,insert,update,delete on table public.khpos_ops_process_execution_profiles to service_role;
grant select,insert,update,delete on table public.khpos_ops_trigger_events to service_role;

insert into public.khpos_ops_process_execution_profiles(
  organisation_id,process_id,activation_mode,owner_role_id,trigger_summary,
  due_offset_minutes,evidence_required,verification_required,status
)
select
  p.organisation_id,
  p.id,
  case when rr.id is not null then 'recurring' else 'manual_on_demand' end,
  rr.owner_role_id,
  case
    when rr.id is not null then
      'Scheduled by recurring rule ' || rr.code || ' (' || rr.cadence || ').'
    else pv.trigger
  end,
  null,
  coalesce(rr.evidence_required,false),
  coalesce(rr.verification_required,false),
  case when rr.id is not null then 'configured' else 'needs_mapping' end
from public.khpos_ops_processes p
join public.khpos_ops_process_versions pv
  on pv.process_id=p.id and pv.status='active'
left join lateral (
  select r.*
  from public.khpos_ops_recurring_rules r
  where r.process_id=p.id and r.status='active'
  order by r.created_at
  limit 1
) rr on true
where p.status <> 'retired'
on conflict (process_id) do nothing;

create or replace function khpos_private.ops_ensure_execution_profile()
returns trigger
language plpgsql
set search_path=public,khpos_private,pg_temp
as $$
declare
  v_process public.khpos_ops_processes%rowtype;
  v_rule public.khpos_ops_recurring_rules%rowtype;
begin
  if new.status <> 'active' then return new; end if;

  select * into v_process
  from public.khpos_ops_processes
  where id=new.process_id;

  if v_process.id is null then return new; end if;

  select * into v_rule
  from public.khpos_ops_recurring_rules
  where process_id=new.process_id and status='active'
  order by created_at
  limit 1;

  insert into public.khpos_ops_process_execution_profiles(
    organisation_id,process_id,activation_mode,owner_role_id,trigger_summary,
    evidence_required,verification_required,status
  ) values (
    v_process.organisation_id,
    v_process.id,
    case when v_rule.id is not null then 'recurring' else 'manual_on_demand' end,
    v_rule.owner_role_id,
    case when v_rule.id is not null
      then 'Scheduled by recurring rule ' || v_rule.code || ' (' || v_rule.cadence || ').'
      else new.trigger
    end,
    coalesce(v_rule.evidence_required,false),
    coalesce(v_rule.verification_required,false),
    case when v_rule.id is not null then 'configured' else 'needs_mapping' end
  )
  on conflict (process_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_khpos_ops_ensure_execution_profile
  on public.khpos_ops_process_versions;
create trigger trg_khpos_ops_ensure_execution_profile
after insert or update of status on public.khpos_ops_process_versions
for each row execute function khpos_private.ops_ensure_execution_profile();

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
  v_work_id uuid;
  v_process public.khpos_ops_processes%rowtype;
  v_title text;
  v_count integer := 0;
begin
  if nullif(btrim(coalesce(p_event_type,'')),'') is null
     or nullif(btrim(coalesce(p_event_key,'')),'') is null then
    return 0;
  end if;

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

    select a.id into v_assignment_id
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles ar on ar.id=a.role_id
    where ar.organisation_id=p_organisation_id
      and a.role_id=v_profile.owner_role_id
      and a.status='active'
      and (
        (p_payload->>'campusId') is null
        or a.campus_id is null
        or a.campus_id::text=p_payload->>'campusId'
      )
      and (
        (p_payload->>'unitId') is null
        or a.unit_id is null
        or a.unit_id::text=p_payload->>'unitId'
      )
    order by
      case when a.campus_id::text=coalesce(p_payload->>'campusId','') then 0 else 1 end,
      case when a.unit_id::text=coalesce(p_payload->>'unitId','') then 0 else 1 end,
      a.primary_assignment desc,
      a.created_at
    limit 1;

    if v_assignment_id is null then
      update public.khpos_ops_trigger_events
      set status='failed',
          error_message='No active assignment exists for the configured owner role.',
          processed_at=now()
      where id=v_event_id;
      continue;
    end if;

    v_title := coalesce(
      nullif(btrim(v_profile.trigger_summary),''),
      v_process.title
    );

    insert into public.khpos_ops_work_items(
      organisation_id,campus_id,unit_id,process_id,owner_assignment_id,
      occurrence_key,title,description,status,priority,due_at,
      evidence_required,verification_required,source_trigger_event_id
    ) values (
      p_organisation_id,
      nullif(p_payload->>'campusId','')::uuid,
      nullif(p_payload->>'unitId','')::uuid,
      v_process.id,
      v_assignment_id,
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
  end loop;

  return v_count;
end;
$$;

create or replace function public.khpos_ops_emit_trigger_event_server(
  p_actor_user_id uuid,
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

  return khpos_private.ops_emit_system_event(
    p_organisation_id,p_event_type,p_event_key,p_subject_type,p_subject_id,p_payload
  );
end;
$$;

create or replace function khpos_private.ops_evaluate_condition_triggers()
returns integer
language plpgsql
security definer
set search_path=public,khpos_private,pg_temp
as $$
declare
  v_profile public.khpos_ops_process_execution_profiles%rowtype;
  v_row record;
  v_count integer := 0;
  v_day text := to_char(current_date,'YYYY-MM-DD');
begin
  for v_profile in
    select *
    from public.khpos_ops_process_execution_profiles
    where status='configured' and activation_mode='condition'
  loop
    if v_profile.condition_key='work_overdue' then
      for v_row in
        select w.id,w.campus_id,w.unit_id,w.title
        from public.khpos_ops_work_items w
        where w.organisation_id=v_profile.organisation_id
          and w.status not in ('completed','cancelled')
          and w.due_at < now()
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'work_overdue',
          'work_overdue:'||v_row.id::text||':'||v_day,
          'work_item',v_row.id::text,
          jsonb_build_object('campusId',v_row.campus_id,'unitId',v_row.unit_id,'title',v_row.title)
        );
      end loop;
    elsif v_profile.condition_key='issue_overdue' then
      for v_row in
        select i.id,i.campus_id,i.unit_id,i.title
        from public.khpos_ops_issues i
        where i.organisation_id=v_profile.organisation_id
          and i.status not in ('resolved','verified','closed')
          and i.due_at < now()
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'issue_overdue',
          'issue_overdue:'||v_row.id::text||':'||v_day,
          'issue',v_row.id::text,
          jsonb_build_object('campusId',v_row.campus_id,'unitId',v_row.unit_id,'title',v_row.title)
        );
      end loop;
    elsif v_profile.condition_key='decision_overdue' then
      for v_row in
        select d.id,d.campus_id,d.unit_id,d.title
        from public.khpos_ops_decisions d
        where d.organisation_id=v_profile.organisation_id
          and d.status in ('submitted','under_review','approved')
          and coalesce(
            case when d.status='approved' and d.action_required then d.implementation_due_at end,
            d.decision_due_at
          ) < now()
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'decision_overdue',
          'decision_overdue:'||v_row.id::text||':'||v_day,
          'decision',v_row.id::text,
          jsonb_build_object('campusId',v_row.campus_id,'unitId',v_row.unit_id,'title',v_row.title)
        );
      end loop;
    elsif v_profile.condition_key='kpi_failing' then
      for v_row in
        select distinct on (m.kpi_id)
          m.kpi_id,m.performance_status,k.name
        from public.khpos_ops_kpi_measurements m
        join public.khpos_ops_kpis k on k.id=m.kpi_id
        where m.organisation_id=v_profile.organisation_id
          and m.performance_status in ('red','critical')
        order by m.kpi_id,m.period_end desc,m.recorded_at desc
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'kpi_failing',
          'kpi_failing:'||v_row.kpi_id::text||':'||v_day,
          'kpi',v_row.kpi_id::text,
          jsonb_build_object('name',v_row.name,'performanceStatus',v_row.performance_status)
        );
      end loop;
    elsif v_profile.condition_key='process_unmapped' then
      for v_row in
        select ep.id,p.code,p.title
        from public.khpos_ops_process_execution_profiles ep
        join public.khpos_ops_processes p on p.id=ep.process_id
        where ep.organisation_id=v_profile.organisation_id
          and ep.status='needs_mapping'
          and p.status <> 'retired'
          and exists (
            select 1 from public.khpos_ops_process_versions pv
            where pv.process_id=p.id and pv.status='active'
          )
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'process_unmapped',
          'process_unmapped:'||v_row.id::text||':'||v_day,
          'process_execution_profile',v_row.id::text,
          jsonb_build_object('code',v_row.code,'title',v_row.title)
        );
      end loop;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function khpos_private.ops_emit_domain_event_trigger()
returns trigger
language plpgsql
set search_path=public,khpos_private,pg_temp
as $$
declare
  v_event_type text;
  v_event_key text;
  v_subject_type text := TG_TABLE_NAME;
  v_subject_id text;
  v_org uuid;
  v_payload jsonb := '{}'::jsonb;
begin
  if TG_TABLE_NAME='khpos_ops_role_assignments' then
    if new.status <> 'active' or (TG_OP='UPDATE' and old.status='active') then return new; end if;
    v_event_type := 'role_assignment_activated';
    v_event_key := 'role_assignment_activated:'||new.id::text;
    v_subject_id := new.id::text;
    select organisation_id into v_org
    from public.khpos_ops_roles
    where id=new.role_id;
    if v_org is null then return new; end if;
    v_payload := jsonb_build_object(
      'roleId',new.role_id,'userId',new.user_id,'campusId',new.campus_id,'unitId',new.unit_id
    );
  elsif TG_TABLE_NAME='khpos_ops_decisions' then
    if new.status <> 'approved' or (TG_OP='UPDATE' and old.status='approved') then return new; end if;
    v_event_type := 'decision_approved';
    v_event_key := 'decision_approved:'||new.id::text;
    v_subject_id := new.id::text;
    v_org := new.organisation_id;
    v_payload := jsonb_build_object(
      'campusId',new.campus_id,'unitId',new.unit_id,'title',new.title
    );
  elsif TG_TABLE_NAME='khpos_ops_issues' then
    if TG_OP<>'INSERT' or new.severity not in ('P1','P2') then return new; end if;
    v_event_type := 'critical_issue_created';
    v_event_key := 'critical_issue_created:'||new.id::text;
    v_subject_id := new.id::text;
    v_org := new.organisation_id;
    v_payload := jsonb_build_object(
      'campusId',new.campus_id,'unitId',new.unit_id,'title',new.title,'severity',new.severity
    );
  elsif TG_TABLE_NAME='khpos_ops_work_items' then
    if new.status <> 'blocked' or (TG_OP='UPDATE' and old.status='blocked') then return new; end if;
    v_event_type := 'work_blocked';
    v_event_key := 'work_blocked:'||new.id::text||':'||to_char(now(),'YYYYMMDDHH24MI');
    v_subject_id := new.id::text;
    v_org := new.organisation_id;
    v_payload := jsonb_build_object(
      'campusId',new.campus_id,'unitId',new.unit_id,'title',new.title,'reason',new.blocked_reason
    );
  elsif TG_TABLE_NAME='khpos_ops_kpi_measurements' then
    if TG_OP<>'INSERT' or new.performance_status not in ('red','critical') then return new; end if;
    v_event_type := 'kpi_failing';
    v_event_key := 'kpi_failing:'||new.id::text;
    v_subject_id := new.kpi_id::text;
    v_org := new.organisation_id;
    v_payload := jsonb_build_object('performanceStatus',new.performance_status);
  else
    return new;
  end if;

  perform khpos_private.ops_emit_system_event(
    v_org,v_event_type,v_event_key,v_subject_type,v_subject_id,v_payload
  );

  return new;
end;
$$;

drop trigger if exists trg_khpos_ops_event_role_assignment on public.khpos_ops_role_assignments;
create trigger trg_khpos_ops_event_role_assignment
after insert or update of status on public.khpos_ops_role_assignments
for each row execute function khpos_private.ops_emit_domain_event_trigger();

drop trigger if exists trg_khpos_ops_event_decision_approved on public.khpos_ops_decisions;
create trigger trg_khpos_ops_event_decision_approved
after update of status on public.khpos_ops_decisions
for each row execute function khpos_private.ops_emit_domain_event_trigger();

drop trigger if exists trg_khpos_ops_event_critical_issue on public.khpos_ops_issues;
create trigger trg_khpos_ops_event_critical_issue
after insert on public.khpos_ops_issues
for each row execute function khpos_private.ops_emit_domain_event_trigger();

drop trigger if exists trg_khpos_ops_event_work_blocked on public.khpos_ops_work_items;
create trigger trg_khpos_ops_event_work_blocked
after update of status on public.khpos_ops_work_items
for each row execute function khpos_private.ops_emit_domain_event_trigger();

drop trigger if exists trg_khpos_ops_event_kpi_failing on public.khpos_ops_kpi_measurements;
create trigger trg_khpos_ops_event_kpi_failing
after insert on public.khpos_ops_kpi_measurements
for each row execute function khpos_private.ops_emit_domain_event_trigger();

revoke execute on function public.khpos_ops_emit_trigger_event_server(uuid,uuid,text,text,text,text,jsonb)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_emit_system_event(uuid,text,text,text,text,jsonb)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_evaluate_condition_triggers()
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_ensure_execution_profile()
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_emit_domain_event_trigger()
  from public,anon,authenticated;

grant execute on function public.khpos_ops_emit_trigger_event_server(uuid,uuid,text,text,text,text,jsonb)
  to service_role;
grant execute on function khpos_private.ops_emit_system_event(uuid,text,text,text,text,jsonb)
  to service_role;
grant execute on function khpos_private.ops_evaluate_condition_triggers()
  to service_role;

do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname='khpos-ops-condition-triggers-hourly';

    perform cron.schedule(
      'khpos-ops-condition-triggers-hourly',
      '17 * * * *',
      'select khpos_private.ops_evaluate_condition_triggers();'
    );
  end if;
exception when others then
  raise notice 'KHP-OS condition trigger cron could not be scheduled: %', sqlerrm;
end
$$;
