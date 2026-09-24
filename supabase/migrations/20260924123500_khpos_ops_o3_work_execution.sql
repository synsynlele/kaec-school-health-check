create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  process_id uuid references public.khpos_ops_processes(id) on delete set null,
  code text not null,
  name text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','active','superseded','archived')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code, version)
);

create table if not exists public.khpos_ops_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.khpos_ops_checklist_templates(id) on delete cascade,
  position integer not null check (position > 0),
  label text not null,
  guidance text,
  response_type text not null default 'boolean'
    check (response_type in ('boolean','text','number','choice')),
  required boolean not null default true,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options)='array'),
  created_at timestamptz not null default now(),
  unique (template_id, position)
);

create table if not exists public.khpos_ops_recurring_rules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  process_id uuid not null references public.khpos_ops_processes(id) on delete cascade,
  owner_role_id uuid not null references public.khpos_ops_roles(id) on delete cascade,
  campus_id uuid references public.khpos_ops_campuses(id) on delete cascade,
  unit_id uuid references public.khpos_ops_units(id) on delete cascade,
  checklist_template_id uuid references public.khpos_ops_checklist_templates(id) on delete set null,
  title text not null,
  description text,
  cadence text not null check (cadence in ('daily','weekly','monthly','manual')),
  weekday integer check (weekday between 1 and 7),
  day_of_month integer check (day_of_month between 1 and 31),
  due_time time,
  timezone text not null default 'Africa/Lagos',
  start_date date not null default current_date,
  end_date date,
  evidence_required boolean not null default false,
  verification_required boolean not null default false,
  priority text not null default 'standard'
    check (priority in ('critical','high','standard','planned')),
  status text not null default 'draft'
    check (status in ('draft','active','paused','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (
    (cadence='daily')
    or (cadence='weekly' and weekday is not null)
    or (cadence='monthly' and day_of_month is not null)
    or (cadence='manual')
  )
);

create table if not exists public.khpos_ops_work_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  unit_id uuid references public.khpos_ops_units(id) on delete set null,
  process_id uuid references public.khpos_ops_processes(id) on delete set null,
  recurring_rule_id uuid references public.khpos_ops_recurring_rules(id) on delete set null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete cascade,
  checklist_template_id uuid references public.khpos_ops_checklist_templates(id) on delete set null,
  occurrence_key text,
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending','in_progress','blocked','awaiting_verification','completed','cancelled')),
  priority text not null default 'standard'
    check (priority in ('critical','high','standard','planned')),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  blocked_reason text,
  evidence_required boolean not null default false,
  verification_required boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_khpos_ops_work_occurrence
  on public.khpos_ops_work_items(recurring_rule_id, owner_assignment_id, occurrence_key)
  where recurring_rule_id is not null and occurrence_key is not null;

create table if not exists public.khpos_ops_checklist_responses (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.khpos_ops_work_items(id) on delete cascade,
  template_item_id uuid not null references public.khpos_ops_checklist_template_items(id) on delete cascade,
  response jsonb not null,
  note text,
  completed_by uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_item_id, template_item_id)
);

create table if not exists public.khpos_ops_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_item_id uuid not null references public.khpos_ops_work_items(id) on delete cascade,
  evidence_type text not null default 'note'
    check (evidence_type in ('note','link','file_reference','system_record')),
  note text,
  external_url text,
  storage_reference text,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','rejected')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    nullif(btrim(coalesce(note,'')),'') is not null
    or nullif(btrim(coalesce(external_url,'')),'') is not null
    or nullif(btrim(coalesce(storage_reference,'')),'') is not null
  )
);

create index if not exists idx_khpos_ops_checklist_templates_org
  on public.khpos_ops_checklist_templates(organisation_id,status);
create index if not exists idx_khpos_ops_checklist_templates_process
  on public.khpos_ops_checklist_templates(process_id) where process_id is not null;
create index if not exists idx_khpos_ops_checklist_templates_created_by
  on public.khpos_ops_checklist_templates(created_by) where created_by is not null;
create index if not exists idx_khpos_ops_checklist_templates_approved_by
  on public.khpos_ops_checklist_templates(approved_by) where approved_by is not null;
create index if not exists idx_khpos_ops_checklist_items_template
  on public.khpos_ops_checklist_template_items(template_id,position);

create index if not exists idx_khpos_ops_recurring_org_status
  on public.khpos_ops_recurring_rules(organisation_id,status);
create index if not exists idx_khpos_ops_recurring_process
  on public.khpos_ops_recurring_rules(process_id);
create index if not exists idx_khpos_ops_recurring_owner_role
  on public.khpos_ops_recurring_rules(owner_role_id,status);
create index if not exists idx_khpos_ops_recurring_campus
  on public.khpos_ops_recurring_rules(campus_id) where campus_id is not null;
create index if not exists idx_khpos_ops_recurring_unit
  on public.khpos_ops_recurring_rules(unit_id) where unit_id is not null;
create index if not exists idx_khpos_ops_recurring_checklist
  on public.khpos_ops_recurring_rules(checklist_template_id) where checklist_template_id is not null;
create index if not exists idx_khpos_ops_recurring_created_by
  on public.khpos_ops_recurring_rules(created_by) where created_by is not null;

create index if not exists idx_khpos_ops_work_owner_status_due
  on public.khpos_ops_work_items(owner_assignment_id,status,due_at);
create index if not exists idx_khpos_ops_work_org_status_due
  on public.khpos_ops_work_items(organisation_id,status,due_at);
create index if not exists idx_khpos_ops_work_process
  on public.khpos_ops_work_items(process_id) where process_id is not null;
create index if not exists idx_khpos_ops_work_campus
  on public.khpos_ops_work_items(campus_id) where campus_id is not null;
create index if not exists idx_khpos_ops_work_unit
  on public.khpos_ops_work_items(unit_id) where unit_id is not null;
create index if not exists idx_khpos_ops_work_checklist
  on public.khpos_ops_work_items(checklist_template_id) where checklist_template_id is not null;
create index if not exists idx_khpos_ops_work_verified_by
  on public.khpos_ops_work_items(verified_by) where verified_by is not null;
create index if not exists idx_khpos_ops_work_created_by
  on public.khpos_ops_work_items(created_by) where created_by is not null;

create index if not exists idx_khpos_ops_checklist_response_work
  on public.khpos_ops_checklist_responses(work_item_id);
create index if not exists idx_khpos_ops_checklist_response_item
  on public.khpos_ops_checklist_responses(template_item_id);
create index if not exists idx_khpos_ops_checklist_response_user
  on public.khpos_ops_checklist_responses(completed_by);

create index if not exists idx_khpos_ops_evidence_work
  on public.khpos_ops_evidence(work_item_id,submitted_at desc);
create index if not exists idx_khpos_ops_evidence_org
  on public.khpos_ops_evidence(organisation_id,submitted_at desc);
create index if not exists idx_khpos_ops_evidence_submitted_by
  on public.khpos_ops_evidence(submitted_by,submitted_at desc);
create index if not exists idx_khpos_ops_evidence_verified_by
  on public.khpos_ops_evidence(verified_by) where verified_by is not null;

alter table public.khpos_ops_checklist_templates enable row level security;
alter table public.khpos_ops_checklist_template_items enable row level security;
alter table public.khpos_ops_recurring_rules enable row level security;
alter table public.khpos_ops_work_items enable row level security;
alter table public.khpos_ops_checklist_responses enable row level security;
alter table public.khpos_ops_evidence enable row level security;

revoke all privileges on table public.khpos_ops_checklist_templates from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_checklist_template_items from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_recurring_rules from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_work_items from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_checklist_responses from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_evidence from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_checklist_templates to service_role;
grant select,insert,update,delete on table public.khpos_ops_checklist_template_items to service_role;
grant select,insert,update,delete on table public.khpos_ops_recurring_rules to service_role;
grant select,insert,update,delete on table public.khpos_ops_work_items to service_role;
grant select,insert,update,delete on table public.khpos_ops_checklist_responses to service_role;
grant select,insert,update,delete on table public.khpos_ops_evidence to service_role;

create or replace function public.khpos_ops_materialize_due_work_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_member_role text;
  v_created integer := 0;
  r record;
  a record;
  v_local_date date;
  v_occurrence_date date;
  v_occurrence_key text;
  v_due_at timestamptz;
  v_last_day integer;
begin
  select m.role into v_member_role
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_member_role is null then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  for a in
    select ra.*
    from public.khpos_ops_role_assignments ra
    join public.khpos_ops_roles role on role.id=ra.role_id
    where ra.user_id=p_actor_user_id
      and ra.status='active'
      and role.organisation_id=p_organisation_id
      and role.status='active'
  loop
    for r in
      select rr.*
      from public.khpos_ops_recurring_rules rr
      where rr.organisation_id=p_organisation_id
        and rr.owner_role_id=a.role_id
        and rr.status='active'
        and rr.cadence <> 'manual'
        and (rr.campus_id is null or rr.campus_id=a.campus_id)
        and (rr.unit_id is null or rr.unit_id=a.unit_id)
    loop
      v_local_date := (now() at time zone r.timezone)::date;
      if v_local_date < r.start_date or (r.end_date is not null and v_local_date > r.end_date) then
        continue;
      end if;

      if r.cadence='daily' then
        v_occurrence_date := v_local_date;
        v_occurrence_key := 'D:' || to_char(v_occurrence_date,'YYYY-MM-DD');
      elsif r.cadence='weekly' then
        v_occurrence_date := (date_trunc('week',v_local_date::timestamp)::date + (r.weekday-1));
        if v_occurrence_date > v_local_date then
          continue;
        end if;
        v_occurrence_key := 'W:' || to_char(v_occurrence_date,'IYYY-IW');
      elsif r.cadence='monthly' then
        v_last_day := extract(day from (date_trunc('month',v_local_date::timestamp) + interval '1 month - 1 day'))::integer;
        v_occurrence_date := make_date(
          extract(year from v_local_date)::integer,
          extract(month from v_local_date)::integer,
          least(r.day_of_month,v_last_day)
        );
        if v_occurrence_date > v_local_date then
          continue;
        end if;
        v_occurrence_key := 'M:' || to_char(v_occurrence_date,'YYYY-MM');
      else
        continue;
      end if;

      if v_occurrence_date < r.start_date or (r.end_date is not null and v_occurrence_date > r.end_date) then
        continue;
      end if;

      v_due_at := case
        when r.due_time is null then (v_occurrence_date::timestamp + time '23:59') at time zone r.timezone
        else (v_occurrence_date::timestamp + r.due_time) at time zone r.timezone
      end;

      insert into public.khpos_ops_work_items(
        organisation_id,campus_id,unit_id,process_id,recurring_rule_id,
        owner_assignment_id,checklist_template_id,occurrence_key,title,description,
        status,priority,due_at,evidence_required,verification_required,created_by
      ) values (
        p_organisation_id,coalesce(r.campus_id,a.campus_id),coalesce(r.unit_id,a.unit_id),
        r.process_id,r.id,a.id,r.checklist_template_id,v_occurrence_key,r.title,r.description,
        'pending',r.priority,v_due_at,r.evidence_required,r.verification_required,p_actor_user_id
      )
      on conflict (recurring_rule_id,owner_assignment_id,occurrence_key)
        where recurring_rule_id is not null and occurrence_key is not null
      do nothing;

      if found then v_created := v_created + 1; end if;
    end loop;
  end loop;

  return v_created;
end;
$$;

create or replace function public.khpos_ops_get_my_work_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_member_role text;
  v_org_name text;
  v_items jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_due_today integer := 0;
  v_overdue integer := 0;
  v_blocked integer := 0;
  v_completed integer := 0;
begin
  select m.role,o.name into v_member_role,v_org_name
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_member_role is null then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  perform public.khpos_ops_materialize_due_work_server(p_actor_user_id,p_organisation_id);

  with mine as (
    select
      w.*,
      p.code as process_code,
      p.title as process_title,
      role.title as owner_role_title,
      campus.name as campus_name,
      unit.name as unit_name,
      ct.code as checklist_code,
      ct.name as checklist_name
    from public.khpos_ops_work_items w
    join public.khpos_ops_role_assignments a on a.id=w.owner_assignment_id
    join public.khpos_ops_roles role on role.id=a.role_id
    left join public.khpos_ops_processes p on p.id=w.process_id
    left join public.khpos_ops_campuses campus on campus.id=w.campus_id
    left join public.khpos_ops_units unit on unit.id=w.unit_id
    left join public.khpos_ops_checklist_templates ct on ct.id=w.checklist_template_id
    where w.organisation_id=p_organisation_id
      and a.user_id=p_actor_user_id
      and a.status='active'
      and w.status <> 'cancelled'
  ),
  item_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',m.id,
        'title',m.title,
        'description',m.description,
        'status',m.status,
        'priority',m.priority,
        'dueAt',m.due_at,
        'startedAt',m.started_at,
        'completedAt',m.completed_at,
        'blockedReason',m.blocked_reason,
        'evidenceRequired',m.evidence_required,
        'verificationRequired',m.verification_required,
        'processCode',m.process_code,
        'processTitle',m.process_title,
        'roleTitle',m.owner_role_title,
        'campusName',m.campus_name,
        'unitName',m.unit_name,
        'checklist',case when m.checklist_template_id is null then null else jsonb_build_object(
          'code',m.checklist_code,
          'name',m.checklist_name,
          'items',coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',i.id,
              'position',i.position,
              'label',i.label,
              'guidance',i.guidance,
              'responseType',i.response_type,
              'required',i.required,
              'options',i.options,
              'response',cr.response,
              'note',cr.note,
              'completedAt',cr.completed_at
            ) order by i.position)
            from public.khpos_ops_checklist_template_items i
            left join public.khpos_ops_checklist_responses cr
              on cr.template_item_id=i.id and cr.work_item_id=m.id
            where i.template_id=m.checklist_template_id
          ),'[]'::jsonb)
        ) end,
        'evidenceCount',(select count(*) from public.khpos_ops_evidence e where e.work_item_id=m.id)
      )
      order by
        case m.status when 'blocked' then 0 when 'pending' then 1 when 'in_progress' then 2 when 'awaiting_verification' then 3 else 4 end,
        m.due_at nulls last,
        m.created_at
    ),'[]'::jsonb) as value
    from mine m
  )
  select value into v_items from item_json;

  with mine as (
    select w.*
    from public.khpos_ops_work_items w
    join public.khpos_ops_role_assignments a on a.id=w.owner_assignment_id
    where w.organisation_id=p_organisation_id
      and a.user_id=p_actor_user_id
      and a.status='active'
      and w.status <> 'cancelled'
  )
  select
    count(*)::integer,
    count(*) filter (
      where due_at is not null
        and (due_at at time zone 'Africa/Lagos')::date=current_date
        and status not in ('completed')
    )::integer,
    count(*) filter (where due_at < now() and status not in ('completed'))::integer,
    count(*) filter (where status='blocked')::integer,
    count(*) filter (where status='completed')::integer
  into v_total,v_due_today,v_overdue,v_blocked,v_completed
  from mine;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'summary',jsonb_build_object(
      'total',v_total,
      'dueToday',v_due_today,
      'overdue',v_overdue,
      'blocked',v_blocked,
      'completed',v_completed
    ),
    'items',v_items
  );
end;
$$;

create or replace function public.khpos_ops_update_work_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_work_item_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_work public.khpos_ops_work_items%rowtype;
  v_missing_checklist integer := 0;
  v_evidence_count integer := 0;
begin
  select w.* into v_work
  from public.khpos_ops_work_items w
  join public.khpos_ops_role_assignments a on a.id=w.owner_assignment_id
  join public.organisation_memberships m
    on m.organisation_id=w.organisation_id and m.user_id=p_actor_user_id and m.status='active'
  join public.organisations o on o.id=w.organisation_id
  where w.id=p_work_item_id
    and w.organisation_id=p_organisation_id
    and a.user_id=p_actor_user_id
    and a.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_work.id is null then raise exception 'Owned work item not found.'; end if;

  if p_action='start' then
    if v_work.status not in ('pending','blocked') then raise exception 'This work item cannot be started from its current status.'; end if;
    update public.khpos_ops_work_items
      set status='in_progress',started_at=coalesce(started_at,now()),blocked_reason=null,updated_at=now()
      where id=v_work.id;
  elsif p_action='block' then
    if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'A blockage reason is required.'; end if;
    if v_work.status in ('completed','cancelled','awaiting_verification') then raise exception 'This work item cannot be blocked from its current status.'; end if;
    update public.khpos_ops_work_items
      set status='blocked',blocked_reason=btrim(p_note),updated_at=now()
      where id=v_work.id;
  elsif p_action='complete' then
    if v_work.status in ('completed','cancelled') then raise exception 'This work item is already closed.'; end if;

    if v_work.checklist_template_id is not null then
      select count(*)::integer into v_missing_checklist
      from public.khpos_ops_checklist_template_items i
      where i.template_id=v_work.checklist_template_id
        and i.required=true
        and not exists (
          select 1 from public.khpos_ops_checklist_responses cr
          where cr.work_item_id=v_work.id and cr.template_item_id=i.id
        );
      if v_missing_checklist > 0 then
        raise exception 'Complete all required checklist items before closing this work.';
      end if;
    end if;

    if v_work.evidence_required then
      select count(*)::integer into v_evidence_count
      from public.khpos_ops_evidence e where e.work_item_id=v_work.id;
      if v_evidence_count=0 then raise exception 'Required evidence must be added before closing this work.'; end if;
    end if;

    update public.khpos_ops_work_items
      set status=case when verification_required then 'awaiting_verification' else 'completed' end,
          completed_at=now(),blocked_reason=null,updated_at=now()
      where id=v_work.id;
  else
    raise exception 'Unsupported work action.';
  end if;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_work_'||p_action,'work_item',v_work.id,
    jsonb_build_object('note',nullif(btrim(coalesce(p_note,'')),''))
  );
end;
$$;

create or replace function public.khpos_ops_set_checklist_response_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_work_item_id uuid,
  p_template_item_id uuid,
  p_response jsonb,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_template uuid;
begin
  select w.checklist_template_id into v_template
  from public.khpos_ops_work_items w
  join public.khpos_ops_role_assignments a on a.id=w.owner_assignment_id
  join public.organisation_memberships m
    on m.organisation_id=w.organisation_id and m.user_id=p_actor_user_id and m.status='active'
  join public.organisations o on o.id=w.organisation_id
  where w.id=p_work_item_id
    and w.organisation_id=p_organisation_id
    and a.user_id=p_actor_user_id
    and a.status='active'
    and w.status not in ('completed','cancelled','awaiting_verification')
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_template is null then raise exception 'Active checklist work item not found.'; end if;

  if not exists (
    select 1 from public.khpos_ops_checklist_template_items
    where id=p_template_item_id and template_id=v_template
  ) then
    raise exception 'Checklist item does not belong to this work item.';
  end if;

  insert into public.khpos_ops_checklist_responses(
    work_item_id,template_item_id,response,note,completed_by,completed_at,updated_at
  ) values (
    p_work_item_id,p_template_item_id,p_response,nullif(btrim(coalesce(p_note,'')),''),
    p_actor_user_id,now(),now()
  )
  on conflict (work_item_id,template_item_id) do update
    set response=excluded.response,note=excluded.note,completed_by=excluded.completed_by,
        completed_at=now(),updated_at=now();
end;
$$;

create or replace function public.khpos_ops_add_work_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_work_item_id uuid,
  p_evidence_type text,
  p_note text default null,
  p_external_url text default null,
  p_storage_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_evidence_id uuid;
begin
  if p_evidence_type not in ('note','link','file_reference','system_record') then
    raise exception 'Unsupported evidence type.';
  end if;

  if not exists (
    select 1
    from public.khpos_ops_work_items w
    join public.khpos_ops_role_assignments a on a.id=w.owner_assignment_id
    join public.organisation_memberships m
      on m.organisation_id=w.organisation_id and m.user_id=p_actor_user_id and m.status='active'
    join public.organisations o on o.id=w.organisation_id
    where w.id=p_work_item_id
      and w.organisation_id=p_organisation_id
      and a.user_id=p_actor_user_id
      and a.status='active'
      and w.status not in ('cancelled')
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Owned work item not found.';
  end if;

  insert into public.khpos_ops_evidence(
    organisation_id,work_item_id,evidence_type,note,external_url,storage_reference,submitted_by
  ) values (
    p_organisation_id,p_work_item_id,p_evidence_type,
    nullif(btrim(coalesce(p_note,'')),''),
    nullif(btrim(coalesce(p_external_url,'')),''),
    nullif(btrim(coalesce(p_storage_reference,'')),''),
    p_actor_user_id
  ) returning id into v_evidence_id;

  return v_evidence_id;
end;
$$;

revoke execute on function public.khpos_ops_materialize_due_work_server(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.khpos_ops_get_my_work_server(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.khpos_ops_update_work_server(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_set_checklist_response_server(uuid,uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_work_evidence_server(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;

grant execute on function public.khpos_ops_materialize_due_work_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_get_my_work_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_update_work_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_set_checklist_response_server(uuid,uuid,uuid,uuid,jsonb,text) to service_role;
grant execute on function public.khpos_ops_add_work_evidence_server(uuid,uuid,uuid,text,text,text,text) to service_role;
