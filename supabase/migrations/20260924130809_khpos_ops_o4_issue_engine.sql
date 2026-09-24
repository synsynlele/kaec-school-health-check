create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_issues (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  unit_id uuid references public.khpos_ops_units(id) on delete set null,
  process_id uuid references public.khpos_ops_processes(id) on delete set null,
  source_work_item_id uuid references public.khpos_ops_work_items(id) on delete set null,
  source_checklist_item_id uuid references public.khpos_ops_checklist_template_items(id) on delete set null,
  issue_type text not null default 'manual'
    check (issue_type in ('manual','work_blocker','checklist_exception','system_exception')),
  category text not null,
  severity text not null check (severity in ('P1','P2','P3','P4')),
  sensitivity text not null default 'standard'
    check (sensitivity in ('standard','restricted')),
  title text not null,
  description text not null,
  status text not null default 'open'
    check (status in ('open','assigned','in_action','awaiting','resolved','verified','closed')),
  owner_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  reported_by uuid not null references auth.users(id) on delete restrict,
  due_at timestamptz,
  immediate_action text,
  root_cause text,
  resolution text,
  preventive_action text,
  resolved_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.khpos_ops_issue_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  issue_id uuid not null references public.khpos_ops_issues(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.khpos_ops_issue_escalations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  issue_id uuid not null references public.khpos_ops_issues(id) on delete cascade,
  from_role_id uuid references public.khpos_ops_roles(id) on delete set null,
  target_role_id uuid not null references public.khpos_ops_roles(id) on delete cascade,
  escalated_by uuid references auth.users(id) on delete set null,
  reason text not null,
  escalated_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  cleared_at timestamptz
);

create index if not exists idx_khpos_ops_issues_org_status
  on public.khpos_ops_issues(organisation_id,status,created_at desc);
create index if not exists idx_khpos_ops_issues_owner_status
  on public.khpos_ops_issues(owner_assignment_id,status,due_at);
create index if not exists idx_khpos_ops_issues_reported_by
  on public.khpos_ops_issues(reported_by,created_at desc);
create index if not exists idx_khpos_ops_issues_source_work
  on public.khpos_ops_issues(source_work_item_id) where source_work_item_id is not null;
create index if not exists idx_khpos_ops_issues_source_check
  on public.khpos_ops_issues(source_checklist_item_id) where source_checklist_item_id is not null;
create index if not exists idx_khpos_ops_issues_process
  on public.khpos_ops_issues(process_id) where process_id is not null;
create index if not exists idx_khpos_ops_issues_due
  on public.khpos_ops_issues(organisation_id,due_at)
  where status not in ('verified','closed') and due_at is not null;
create index if not exists idx_khpos_ops_issues_verified_by
  on public.khpos_ops_issues(verified_by) where verified_by is not null;

create index if not exists idx_khpos_ops_issue_events_issue
  on public.khpos_ops_issue_events(issue_id,created_at desc);
create index if not exists idx_khpos_ops_issue_events_actor
  on public.khpos_ops_issue_events(actor_user_id,created_at desc) where actor_user_id is not null;
create index if not exists idx_khpos_ops_issue_events_org
  on public.khpos_ops_issue_events(organisation_id,created_at desc);

create index if not exists idx_khpos_ops_escalations_issue
  on public.khpos_ops_issue_escalations(issue_id,escalated_at desc);
create index if not exists idx_khpos_ops_escalations_target
  on public.khpos_ops_issue_escalations(target_role_id,cleared_at,escalated_at desc);
create index if not exists idx_khpos_ops_escalations_from
  on public.khpos_ops_issue_escalations(from_role_id) where from_role_id is not null;
create index if not exists idx_khpos_ops_escalations_actor
  on public.khpos_ops_issue_escalations(escalated_by) where escalated_by is not null;
create index if not exists idx_khpos_ops_escalations_ack
  on public.khpos_ops_issue_escalations(acknowledged_by) where acknowledged_by is not null;

alter table public.khpos_ops_issues enable row level security;
alter table public.khpos_ops_issue_events enable row level security;
alter table public.khpos_ops_issue_escalations enable row level security;

revoke all privileges on table public.khpos_ops_issues from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_issue_events from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_issue_escalations from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_issues to service_role;
grant select,insert,update,delete on table public.khpos_ops_issue_events to service_role;
grant select,insert,update,delete on table public.khpos_ops_issue_escalations to service_role;

create or replace function khpos_private.ops_ensure_work_issue(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_work_item_id uuid,
  p_source_checklist_item_id uuid,
  p_issue_type text,
  p_title text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, khpos_private, pg_temp
as $$
declare
  v_work public.khpos_ops_work_items%rowtype;
  v_process public.khpos_ops_processes%rowtype;
  v_issue_id uuid;
  v_severity text;
  v_parent_role uuid;
begin
  select * into v_work
  from public.khpos_ops_work_items
  where id=p_work_item_id and organisation_id=p_organisation_id;

  if v_work.id is null then
    raise exception 'Source work item not found.';
  end if;

  select * into v_process
  from public.khpos_ops_processes
  where id=v_work.process_id;

  select i.id into v_issue_id
  from public.khpos_ops_issues i
  where i.organisation_id=p_organisation_id
    and i.source_work_item_id=p_work_item_id
    and i.issue_type=p_issue_type
    and i.source_checklist_item_id is not distinct from p_source_checklist_item_id
    and i.status <> 'closed'
  order by i.created_at desc
  limit 1;

  if v_issue_id is not null then
    return v_issue_id;
  end if;

  v_severity := case v_work.priority
    when 'critical' then 'P1'
    when 'high' then 'P2'
    when 'planned' then 'P4'
    else 'P3'
  end;

  insert into public.khpos_ops_issues(
    organisation_id,campus_id,unit_id,process_id,source_work_item_id,source_checklist_item_id,
    issue_type,category,severity,sensitivity,title,description,status,owner_assignment_id,
    reported_by,due_at,immediate_action
  ) values (
    p_organisation_id,v_work.campus_id,v_work.unit_id,v_work.process_id,p_work_item_id,
    p_source_checklist_item_id,p_issue_type,
    coalesce(v_process.operating_system,'operational'),v_severity,'standard',
    left(btrim(p_title),180),left(btrim(p_description),4000),'assigned',
    v_work.owner_assignment_id,p_actor_user_id,v_work.due_at,
    case when p_issue_type='work_blocker' then 'Remove or work around the blocker before normal execution resumes.'
         else 'Resolve the failed control and record the corrective action.' end
  )
  returning id into v_issue_id;

  insert into public.khpos_ops_issue_events(
    organisation_id,issue_id,actor_user_id,event_type,to_status,note,metadata
  ) values (
    p_organisation_id,v_issue_id,p_actor_user_id,'auto_reported','assigned',
    left(btrim(p_description),4000),
    jsonb_build_object('sourceWorkItemId',p_work_item_id,'sourceType',p_issue_type)
  );

  if v_severity='P1' then
    select r.reports_to_role_id into v_parent_role
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.id=v_work.owner_assignment_id;

    if v_parent_role is not null then
      insert into public.khpos_ops_issue_escalations(
        organisation_id,issue_id,from_role_id,target_role_id,escalated_by,reason
      )
      select p_organisation_id,v_issue_id,a.role_id,v_parent_role,p_actor_user_id,
        'P1 critical issue requires immediate leadership visibility.'
      from public.khpos_ops_role_assignments a
      where a.id=v_work.owner_assignment_id;

      insert into public.khpos_ops_issue_events(
        organisation_id,issue_id,actor_user_id,event_type,note,metadata
      ) values (
        p_organisation_id,v_issue_id,p_actor_user_id,'escalated',
        'P1 critical issue automatically escalated to the immediate reporting role.',
        jsonb_build_object('targetRoleId',v_parent_role,'automatic',true)
      );
    end if;
  end if;

  return v_issue_id;
end;
$$;

revoke execute on function khpos_private.ops_ensure_work_issue(uuid,uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function khpos_private.ops_ensure_work_issue(uuid,uuid,uuid,uuid,text,text,text)
  to service_role;

create or replace function public.khpos_ops_create_issue_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_severity text,
  p_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_member_role text;
  v_assignment uuid;
  v_role uuid;
  v_parent_role uuid;
  v_issue_id uuid;
  v_status text;
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

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_description,'')),'') is null then
    raise exception 'Issue title and description are required.';
  end if;

  if p_severity not in ('P1','P2','P3','P4') then
    raise exception 'Issue severity must be P1, P2, P3 or P4.';
  end if;

  select a.id,a.role_id into v_assignment,v_role
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.user_id=p_actor_user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.status='active'
  order by a.primary_assignment desc,r.role_level,a.created_at
  limit 1;

  v_status := case when v_assignment is null then 'open' else 'assigned' end;

  insert into public.khpos_ops_issues(
    organisation_id,issue_type,category,severity,sensitivity,title,description,status,
    owner_assignment_id,reported_by,due_at
  ) values (
    p_organisation_id,'manual',lower(left(btrim(coalesce(p_category,'other')),80)),
    p_severity,'standard',left(btrim(p_title),180),left(btrim(p_description),4000),
    v_status,v_assignment,p_actor_user_id,p_due_at
  ) returning id into v_issue_id;

  insert into public.khpos_ops_issue_events(
    organisation_id,issue_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_issue_id,p_actor_user_id,'reported',v_status,
    left(btrim(p_description),4000)
  );

  if p_severity='P1' and v_role is not null then
    select reports_to_role_id into v_parent_role
    from public.khpos_ops_roles where id=v_role;

    if v_parent_role is not null then
      insert into public.khpos_ops_issue_escalations(
        organisation_id,issue_id,from_role_id,target_role_id,escalated_by,reason
      ) values (
        p_organisation_id,v_issue_id,v_role,v_parent_role,p_actor_user_id,
        'P1 critical issue requires immediate leadership visibility.'
      );

      insert into public.khpos_ops_issue_events(
        organisation_id,issue_id,actor_user_id,event_type,note,metadata
      ) values (
        p_organisation_id,v_issue_id,p_actor_user_id,'escalated',
        'P1 critical issue automatically escalated to the immediate reporting role.',
        jsonb_build_object('targetRoleId',v_parent_role,'automatic',true)
      );
    end if;
  end if;

  return v_issue_id;
end;
$$;

create or replace function public.khpos_ops_get_issues_server(
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
  v_open integer := 0;
  v_p1 integer := 0;
  v_overdue integer := 0;
  v_resolved integer := 0;
  v_restricted integer := 0;
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

  with actor_assignments as (
    select a.*,r.code as role_code,r.title as role_title,r.role_level
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  ),
  visible as (
    select distinct
      i.*,
      oa.user_id as owner_user_id,
      orole.id as owner_role_id,
      orole.title as owner_role_title,
      u.email as owner_email,
      coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.email) as owner_display,
      p.code as process_code,
      p.title as process_title,
      w.title as source_work_title,
      exists(select 1 from actor_assignments aa where aa.id=i.owner_assignment_id) as is_owner,
      (i.reported_by=p_actor_user_id) as is_reporter,
      exists(
        select 1
        from actor_assignments aa
        where aa.role_id=orole.reports_to_role_id
          and (aa.campus_id is null or oa.campus_id is null or aa.campus_id=oa.campus_id)
          and (aa.unit_id is null or oa.unit_id is null or aa.unit_id=oa.unit_id)
      ) as is_direct_manager,
      exists(
        select 1
        from public.khpos_ops_issue_escalations e
        join actor_assignments aa on aa.role_id=e.target_role_id
        where e.issue_id=i.id and e.cleared_at is null
      ) as is_escalation_recipient,
      (
        select tr.title
        from public.khpos_ops_issue_escalations e
        join public.khpos_ops_roles tr on tr.id=e.target_role_id
        where e.issue_id=i.id and e.cleared_at is null
        order by e.escalated_at desc
        limit 1
      ) as escalated_to_title
    from public.khpos_ops_issues i
    left join public.khpos_ops_role_assignments oa on oa.id=i.owner_assignment_id
    left join public.khpos_ops_roles orole on orole.id=oa.role_id
    left join auth.users u on u.id=oa.user_id
    left join public.khpos_ops_processes p on p.id=i.process_id
    left join public.khpos_ops_work_items w on w.id=i.source_work_item_id
    where i.organisation_id=p_organisation_id
      and i.sensitivity='standard'
      and (
        i.reported_by=p_actor_user_id
        or exists(select 1 from actor_assignments aa where aa.id=i.owner_assignment_id)
        or exists(
          select 1
          from actor_assignments aa
          where aa.role_id=orole.reports_to_role_id
            and (aa.campus_id is null or oa.campus_id is null or aa.campus_id=oa.campus_id)
            and (aa.unit_id is null or oa.unit_id is null or aa.unit_id=oa.unit_id)
        )
        or exists(
          select 1
          from public.khpos_ops_issue_escalations e
          join actor_assignments aa on aa.role_id=e.target_role_id
          where e.issue_id=i.id and e.cleared_at is null
        )
      )
  ),
  item_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',v.id,
        'reference','ISS-'||upper(substr(v.id::text,1,8)),
        'type',v.issue_type,
        'category',v.category,
        'severity',v.severity,
        'title',v.title,
        'description',v.description,
        'status',v.status,
        'dueAt',v.due_at,
        'immediateAction',v.immediate_action,
        'rootCause',v.root_cause,
        'resolution',v.resolution,
        'preventiveAction',v.preventive_action,
        'createdAt',v.created_at,
        'resolvedAt',v.resolved_at,
        'verifiedAt',v.verified_at,
        'owner',case when v.owner_assignment_id is null then null else jsonb_build_object(
          'roleTitle',v.owner_role_title,
          'displayName',v.owner_display,
          'email',v.owner_email
        ) end,
        'process',case when v.process_id is null then null else jsonb_build_object(
          'code',v.process_code,'title',v.process_title
        ) end,
        'sourceWorkTitle',v.source_work_title,
        'escalatedToTitle',v.escalated_to_title,
        'isOwner',v.is_owner,
        'isReporter',v.is_reporter,
        'isDirectManager',v.is_direct_manager,
        'isEscalationRecipient',v.is_escalation_recipient,
        'history',coalesce((
          select jsonb_agg(jsonb_build_object(
            'eventType',h.event_type,
            'fromStatus',h.from_status,
            'toStatus',h.to_status,
            'note',h.note,
            'createdAt',h.created_at
          ) order by h.created_at desc)
          from (
            select e.event_type,e.from_status,e.to_status,e.note,e.created_at
            from public.khpos_ops_issue_events e
            where e.issue_id=v.id
            order by e.created_at desc
            limit 12
          ) h
        ),'[]'::jsonb)
      )
      order by
        case v.severity when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 else 4 end,
        case when v.status in ('closed','verified') then 1 else 0 end,
        v.due_at nulls last,
        v.created_at desc
    ),'[]'::jsonb) as value
    from visible v
    where v.status <> 'closed' or v.closed_at >= now()-interval '30 days'
  )
  select value into v_items from item_json;

  with actor_assignments as (
    select a.*
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id and a.status='active'
      and r.organisation_id=p_organisation_id and r.status='active'
  ),
  relevant as (
    select distinct i.*
    from public.khpos_ops_issues i
    left join public.khpos_ops_role_assignments oa on oa.id=i.owner_assignment_id
    left join public.khpos_ops_roles orole on orole.id=oa.role_id
    where i.organisation_id=p_organisation_id
      and i.sensitivity='standard'
      and (
        i.reported_by=p_actor_user_id
        or exists(select 1 from actor_assignments aa where aa.id=i.owner_assignment_id)
        or exists(
          select 1 from actor_assignments aa
          where aa.role_id=orole.reports_to_role_id
            and (aa.campus_id is null or oa.campus_id is null or aa.campus_id=oa.campus_id)
            and (aa.unit_id is null or oa.unit_id is null or aa.unit_id=oa.unit_id)
        )
        or exists(
          select 1 from public.khpos_ops_issue_escalations e
          join actor_assignments aa on aa.role_id=e.target_role_id
          where e.issue_id=i.id and e.cleared_at is null
        )
      )
  )
  select
    count(*) filter (where status not in ('verified','closed'))::integer,
    count(*) filter (where severity='P1' and status not in ('verified','closed'))::integer,
    count(*) filter (where due_at<now() and status not in ('verified','closed'))::integer,
    count(*) filter (where status in ('resolved','verified'))::integer
  into v_open,v_p1,v_overdue,v_resolved
  from relevant;

  select count(*)::integer into v_restricted
  from public.khpos_ops_issues i
  where i.organisation_id=p_organisation_id
    and i.sensitivity='restricted'
    and i.reported_by=p_actor_user_id
    and i.status <> 'closed';

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'summary',jsonb_build_object(
      'open',v_open,
      'critical',v_p1,
      'overdue',v_overdue,
      'resolvedAwaitingClosure',v_resolved,
      'restrictedOwnedOrReported',v_restricted
    ),
    'items',v_items
  );
end;
$$;

create or replace function public.khpos_ops_issue_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_issue_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_issue public.khpos_ops_issues%rowtype;
  v_owner_user uuid;
  v_owner_role uuid;
  v_parent_role uuid;
  v_actor_assignment uuid;
  v_actor_role uuid;
  v_is_reporter boolean := false;
  v_is_owner boolean := false;
  v_is_manager boolean := false;
  v_is_escalation_recipient boolean := false;
  v_from_status text;
begin
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

  select i.* into v_issue
  from public.khpos_ops_issues i
  where i.id=p_issue_id
    and i.organisation_id=p_organisation_id
    and i.sensitivity='standard'
  limit 1;

  if v_issue.id is null then raise exception 'Issue not found.'; end if;

  if v_issue.owner_assignment_id is not null then
    select oa.user_id,oa.role_id into v_owner_user,v_owner_role
    from public.khpos_ops_role_assignments oa
    where oa.id=v_issue.owner_assignment_id;
  end if;

  v_is_reporter := v_issue.reported_by=p_actor_user_id;
  v_is_owner := v_owner_user=p_actor_user_id;

  select a.id,a.role_id into v_actor_assignment,v_actor_role
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles ar on ar.id=a.role_id
  left join public.khpos_ops_role_assignments oa on oa.id=v_issue.owner_assignment_id
  left join public.khpos_ops_roles orole on orole.id=oa.role_id
  where a.user_id=p_actor_user_id
    and a.status='active'
    and ar.organisation_id=p_organisation_id
    and ar.status='active'
    and (
      v_issue.owner_assignment_id is null
      or (
        a.role_id=orole.reports_to_role_id
        and (a.campus_id is null or oa.campus_id is null or a.campus_id=oa.campus_id)
        and (a.unit_id is null or oa.unit_id is null or a.unit_id=oa.unit_id)
      )
    )
  order by a.primary_assignment desc,ar.role_level,a.created_at
  limit 1;

  v_is_manager := v_actor_assignment is not null and v_issue.owner_assignment_id is not null
                  and not v_is_owner;

  select exists(
    select 1
    from public.khpos_ops_issue_escalations e
    join public.khpos_ops_role_assignments a on a.role_id=e.target_role_id
    join public.khpos_ops_roles r on r.id=a.role_id
    where e.issue_id=v_issue.id and e.cleared_at is null
      and a.user_id=p_actor_user_id and a.status='active'
      and r.organisation_id=p_organisation_id and r.status='active'
  ) into v_is_escalation_recipient;

  if v_is_escalation_recipient then
    select e.target_role_id into v_actor_role
    from public.khpos_ops_issue_escalations e
    join public.khpos_ops_role_assignments a on a.role_id=e.target_role_id
    where e.issue_id=v_issue.id and e.cleared_at is null
      and a.user_id=p_actor_user_id and a.status='active'
    order by e.escalated_at desc
    limit 1;
  end if;

  if not (v_is_reporter or v_is_owner or v_is_manager or v_is_escalation_recipient) then
    raise exception 'This issue is not visible to your active role.';
  end if;

  v_from_status := v_issue.status;

  if p_action='claim' then
    if v_issue.owner_assignment_id is not null or v_issue.status<>'open' then
      raise exception 'Only an open unassigned issue can be claimed.';
    end if;
    if v_actor_assignment is null then
      select a.id,a.role_id into v_actor_assignment,v_actor_role
      from public.khpos_ops_role_assignments a
      join public.khpos_ops_roles r on r.id=a.role_id
      where a.user_id=p_actor_user_id and a.status='active'
        and r.organisation_id=p_organisation_id and r.status='active'
      order by a.primary_assignment desc,r.role_level,a.created_at limit 1;
    end if;
    if v_actor_assignment is null then raise exception 'An active operating role is required to claim an issue.'; end if;

    update public.khpos_ops_issues
      set owner_assignment_id=v_actor_assignment,status='assigned',updated_at=now()
      where id=v_issue.id;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (
      p_organisation_id,v_issue.id,p_actor_user_id,'claimed',v_from_status,'assigned',
      nullif(btrim(coalesce(p_note,'')),'')
    );

  elsif p_action='start' then
    if not v_is_owner or v_issue.status not in ('assigned','awaiting') then
      raise exception 'Only the issue owner can start or resume assigned/awaiting work.';
    end if;

    update public.khpos_ops_issues set status='in_action',updated_at=now() where id=v_issue.id;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'started',v_from_status,'in_action',nullif(btrim(coalesce(p_note,'')),''));

  elsif p_action='await' then
    if not v_is_owner or v_issue.status<>'in_action' then
      raise exception 'Only the issue owner can move active work to awaiting.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'Explain what the issue is waiting for.';
    end if;

    update public.khpos_ops_issues set status='awaiting',updated_at=now() where id=v_issue.id;
    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'awaiting',v_from_status,'awaiting',left(btrim(p_note),4000));

  elsif p_action='resolve' then
    if not v_is_owner or v_issue.status not in ('in_action','awaiting') then
      raise exception 'Only the issue owner can resolve an active issue.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'Resolution evidence or explanation is required.';
    end if;

    update public.khpos_ops_issues
      set status='resolved',resolution=left(btrim(p_note),4000),resolved_at=now(),updated_at=now()
      where id=v_issue.id;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'resolved',v_from_status,'resolved',left(btrim(p_note),4000));

  elsif p_action='verify' then
    if v_issue.status<>'resolved' then raise exception 'Only a resolved issue can be verified.'; end if;
    if v_is_owner then raise exception 'The issue owner cannot verify their own resolution.'; end if;
    if not (v_is_reporter or v_is_manager or v_is_escalation_recipient) then
      raise exception 'Verification requires the reporter or appropriate leadership visibility.';
    end if;

    update public.khpos_ops_issues
      set status='verified',verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
      where id=v_issue.id;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'verified',v_from_status,'verified',nullif(btrim(coalesce(p_note,'')),''));

  elsif p_action='close' then
    if v_issue.status<>'verified' then raise exception 'Only a verified issue can be closed.'; end if;
    if not (v_issue.verified_by=p_actor_user_id or v_is_reporter or v_is_manager or v_is_escalation_recipient) then
      raise exception 'Issue closure requires the verifier, reporter or appropriate leadership visibility.';
    end if;

    update public.khpos_ops_issues
      set status='closed',closed_at=now(),updated_at=now()
      where id=v_issue.id;

    update public.khpos_ops_issue_escalations
      set cleared_at=coalesce(cleared_at,now())
      where issue_id=v_issue.id and cleared_at is null;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'closed',v_from_status,'closed',nullif(btrim(coalesce(p_note,'')),''));

  elsif p_action='escalate' then
    if not (v_is_owner or v_is_reporter or v_is_manager or v_is_escalation_recipient) then
      raise exception 'Escalation requires issue ownership, reporting responsibility or leadership visibility.';
    end if;
    if v_issue.status in ('verified','closed') then
      raise exception 'Verified or closed issues cannot be escalated.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'An escalation reason is required.';
    end if;

    if v_is_manager or v_is_escalation_recipient then
      v_owner_role := v_actor_role;
    elsif v_owner_role is null then
      if v_actor_role is null then
        select a.role_id into v_actor_role
        from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles r on r.id=a.role_id
        where a.user_id=p_actor_user_id and a.status='active'
          and r.organisation_id=p_organisation_id and r.status='active'
        order by a.primary_assignment desc,r.role_level,a.created_at limit 1;
      end if;
      v_owner_role := v_actor_role;
    end if;

    select reports_to_role_id into v_parent_role from public.khpos_ops_roles where id=v_owner_role;
    if v_parent_role is null then
      raise exception 'This issue has reached the highest reporting authority available in KHP-OS.';
    end if;

    if exists(
      select 1 from public.khpos_ops_issue_escalations
      where issue_id=v_issue.id and target_role_id=v_parent_role and cleared_at is null
    ) then
      raise exception 'This issue is already escalated to the immediate reporting role.';
    end if;

    insert into public.khpos_ops_issue_escalations(
      organisation_id,issue_id,from_role_id,target_role_id,escalated_by,reason
    ) values (
      p_organisation_id,v_issue.id,v_owner_role,v_parent_role,p_actor_user_id,left(btrim(p_note),4000)
    );

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,note,metadata
    ) values (
      p_organisation_id,v_issue.id,p_actor_user_id,'escalated',left(btrim(p_note),4000),
      jsonb_build_object('targetRoleId',v_parent_role,'automatic',false)
    );

  elsif p_action='comment' then
    if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'A note is required.'; end if;
    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'comment',left(btrim(p_note),4000));

  else
    raise exception 'Unsupported issue action.';
  end if;
end;
$$;

-- O4 integration: blocking owned work creates a traceable issue while the work remains owned by the same person.
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
set search_path = public, auth, khpos_private, pg_temp
as $$
declare
  v_work public.khpos_ops_work_items%rowtype;
  v_missing_checklist integer := 0;
  v_failed_checklist integer := 0;
  v_evidence_count integer := 0;
  v_issue_id uuid;
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

    v_issue_id := khpos_private.ops_ensure_work_issue(
      p_actor_user_id,p_organisation_id,v_work.id,null,'work_blocker',
      'Blocked work: '||v_work.title,btrim(p_note)
    );
  elsif p_action='complete' then
    if v_work.status <> 'in_progress' then
      raise exception 'Start this work before completing it; blocked or closed work cannot be completed.';
    end if;

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

      select count(*)::integer into v_failed_checklist
      from public.khpos_ops_checklist_template_items i
      join public.khpos_ops_checklist_responses cr
        on cr.template_item_id=i.id and cr.work_item_id=v_work.id
      where i.template_id=v_work.checklist_template_id
        and i.exception_on_response is not null
        and cr.response=i.exception_on_response;

      if v_failed_checklist > 0 then
        raise exception 'This checklist contains an unresolved exception and cannot be closed as normal work.';
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
    jsonb_build_object('note',nullif(btrim(coalesce(p_note,'')),''),'issueId',v_issue_id)
  );
end;
$$;

-- O4 integration: a configured failed checklist response creates an Issue immediately.
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
set search_path = public, auth, khpos_private, pg_temp
as $$
declare
  v_template uuid;
  v_item public.khpos_ops_checklist_template_items%rowtype;
  v_work_title text;
  v_issue_id uuid;
begin
  select w.checklist_template_id,w.title into v_template,v_work_title
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

  select * into v_item
  from public.khpos_ops_checklist_template_items
  where id=p_template_item_id and template_id=v_template;

  if v_item.id is null then
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

  if v_item.exception_on_response is not null and p_response=v_item.exception_on_response then
    v_issue_id := khpos_private.ops_ensure_work_issue(
      p_actor_user_id,p_organisation_id,p_work_item_id,p_template_item_id,'checklist_exception',
      'Failed control: '||v_item.label,
      coalesce(nullif(btrim(coalesce(p_note,'')),''),'Required control failed while completing "'||v_work_title||'".')
    );
  end if;
end;
$$;

revoke execute on function public.khpos_ops_create_issue_server(uuid,uuid,text,text,text,text,timestamptz)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_get_issues_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_issue_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_update_work_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_set_checklist_response_server(uuid,uuid,uuid,uuid,jsonb,text)
  from public,anon,authenticated;

grant execute on function public.khpos_ops_create_issue_server(uuid,uuid,text,text,text,text,timestamptz)
  to service_role;
grant execute on function public.khpos_ops_get_issues_server(uuid,uuid)
  to service_role;
grant execute on function public.khpos_ops_issue_action_server(uuid,uuid,uuid,text,text)
  to service_role;
grant execute on function public.khpos_ops_update_work_server(uuid,uuid,uuid,text,text)
  to service_role;
grant execute on function public.khpos_ops_set_checklist_response_server(uuid,uuid,uuid,uuid,jsonb,text)
  to service_role;
