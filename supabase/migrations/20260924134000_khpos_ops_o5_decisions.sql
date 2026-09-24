create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_decisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  unit_id uuid references public.khpos_ops_units(id) on delete set null,
  process_id uuid references public.khpos_ops_processes(id) on delete set null,
  source_issue_id uuid references public.khpos_ops_issues(id) on delete set null,
  mode text not null default 'request' check (mode in ('request','record')),
  category text not null,
  priority text not null default 'P3' check (priority in ('P1','P2','P3','P4')),
  sensitivity text not null default 'standard' check (sensitivity in ('standard','restricted')),
  title text not null,
  context text not null,
  recommendation text,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requester_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  authority_role_id uuid not null references public.khpos_ops_roles(id) on delete restrict,
  authority_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  status text not null default 'submitted'
    check (status in ('submitted','under_review','returned','approved','rejected','withdrawn','implemented','closed')),
  decision_due_at timestamptz,
  decision_text text,
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  action_required boolean not null default false,
  implementation_owner_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  implementation_title text,
  implementation_expected_outcome text,
  implementation_due_at timestamptz,
  implemented_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.khpos_ops_decision_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  decision_id uuid not null references public.khpos_ops_decisions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.khpos_ops_work_items
  add column if not exists source_decision_id uuid references public.khpos_ops_decisions(id) on delete set null;

create index if not exists idx_khpos_ops_decisions_org_status
  on public.khpos_ops_decisions(organisation_id,status,created_at desc);
create index if not exists idx_khpos_ops_decisions_requester
  on public.khpos_ops_decisions(requested_by,created_at desc);
create index if not exists idx_khpos_ops_decisions_authority
  on public.khpos_ops_decisions(authority_role_id,status,decision_due_at);
create index if not exists idx_khpos_ops_decisions_requester_assignment
  on public.khpos_ops_decisions(requester_assignment_id) where requester_assignment_id is not null;
create index if not exists idx_khpos_ops_decisions_authority_assignment
  on public.khpos_ops_decisions(authority_assignment_id) where authority_assignment_id is not null;
create index if not exists idx_khpos_ops_decisions_implementation_owner
  on public.khpos_ops_decisions(implementation_owner_assignment_id) where implementation_owner_assignment_id is not null;
create index if not exists idx_khpos_ops_decisions_source_issue
  on public.khpos_ops_decisions(source_issue_id) where source_issue_id is not null;
create index if not exists idx_khpos_ops_decisions_process
  on public.khpos_ops_decisions(process_id) where process_id is not null;
create index if not exists idx_khpos_ops_decisions_due
  on public.khpos_ops_decisions(organisation_id,decision_due_at)
  where status in ('submitted','under_review','returned') and decision_due_at is not null;
create index if not exists idx_khpos_ops_decision_events_decision
  on public.khpos_ops_decision_events(decision_id,created_at desc);
create index if not exists idx_khpos_ops_decision_events_actor
  on public.khpos_ops_decision_events(actor_user_id,created_at desc) where actor_user_id is not null;
create index if not exists idx_khpos_ops_work_source_decision
  on public.khpos_ops_work_items(source_decision_id) where source_decision_id is not null;

alter table public.khpos_ops_decisions enable row level security;
alter table public.khpos_ops_decision_events enable row level security;

revoke all privileges on table public.khpos_ops_decisions from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_decision_events from public,anon,authenticated;
grant select,insert,update,delete on table public.khpos_ops_decisions to service_role;
grant select,insert,update,delete on table public.khpos_ops_decision_events to service_role;

create or replace function khpos_private.ops_role_is_ancestor(
  p_organisation_id uuid,
  p_descendant_role_id uuid,
  p_ancestor_role_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, khpos_private, pg_temp
as $$
  with recursive chain as (
    select r.id,r.reports_to_role_id,0 as depth
    from public.khpos_ops_roles r
    where r.id=p_descendant_role_id
      and r.organisation_id=p_organisation_id
      and r.status='active'
    union all
    select parent.id,parent.reports_to_role_id,chain.depth+1
    from public.khpos_ops_roles parent
    join chain on parent.id=chain.reports_to_role_id
    where parent.organisation_id=p_organisation_id
      and parent.status='active'
      and chain.depth<20
  )
  select exists(
    select 1 from chain
    where id=p_ancestor_role_id and depth>0
  );
$$;

create or replace function khpos_private.ops_create_decision_work(
  p_actor_user_id uuid,
  p_decision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, khpos_private, pg_temp
as $$
declare
  v_decision public.khpos_ops_decisions%rowtype;
  v_process_id uuid;
  v_work_id uuid;
  v_priority text;
begin
  select * into v_decision
  from public.khpos_ops_decisions
  where id=p_decision_id
  for update;

  if v_decision.id is null then raise exception 'Decision not found.'; end if;
  if not v_decision.action_required then return null; end if;
  if v_decision.implementation_owner_assignment_id is null
     or nullif(btrim(coalesce(v_decision.implementation_title,'')),'') is null
     or nullif(btrim(coalesce(v_decision.implementation_expected_outcome,'')),'') is null
     or v_decision.implementation_due_at is null then
    raise exception 'Approved decisions requiring action must have an owner, action, expected outcome and deadline.';
  end if;

  select p.id into v_process_id
  from public.khpos_ops_processes p
  where p.organisation_id=v_decision.organisation_id
    and p.code='GOV-005'
  limit 1;

  if v_process_id is null then
    raise exception 'GOV-005 Decision & Action Tracking is not registered.';
  end if;

  if exists(
    select 1 from public.khpos_ops_work_items
    where source_decision_id=v_decision.id
      and status <> 'cancelled'
  ) then
    select id into v_work_id
    from public.khpos_ops_work_items
    where source_decision_id=v_decision.id
      and status <> 'cancelled'
    order by created_at
    limit 1;
    return v_work_id;
  end if;

  v_priority := case v_decision.priority
    when 'P1' then 'critical'
    when 'P2' then 'high'
    when 'P4' then 'planned'
    else 'standard'
  end;

  insert into public.khpos_ops_work_items(
    organisation_id,campus_id,unit_id,process_id,owner_assignment_id,source_decision_id,
    title,description,status,priority,due_at,evidence_required,verification_required,created_by
  ) values (
    v_decision.organisation_id,v_decision.campus_id,v_decision.unit_id,v_process_id,
    v_decision.implementation_owner_assignment_id,v_decision.id,
    left(v_decision.implementation_title,180),
    left(v_decision.implementation_expected_outcome,4000),
    'pending',v_priority,v_decision.implementation_due_at,
    true,false,p_actor_user_id
  ) returning id into v_work_id;

  insert into public.khpos_ops_decision_events(
    organisation_id,decision_id,actor_user_id,event_type,note,metadata
  ) values (
    v_decision.organisation_id,v_decision.id,p_actor_user_id,'implementation_work_created',
    v_decision.implementation_title,
    jsonb_build_object(
      'workItemId',v_work_id,
      'ownerAssignmentId',v_decision.implementation_owner_assignment_id,
      'dueAt',v_decision.implementation_due_at
    )
  );

  return v_work_id;
end;
$$;

create or replace function khpos_private.ops_sync_decision_from_work()
returns trigger
language plpgsql
security definer
set search_path = public, auth, khpos_private, pg_temp
as $$
declare
  v_decision public.khpos_ops_decisions%rowtype;
  v_completed_by uuid;
begin
  if new.source_decision_id is null then return new; end if;

  if new.status='completed' and old.status is distinct from 'completed' then
    select * into v_decision
    from public.khpos_ops_decisions
    where id=new.source_decision_id
    for update;

    if v_decision.id is not null and v_decision.status='approved' then
      select a.user_id into v_completed_by
      from public.khpos_ops_role_assignments a
      where a.id=new.owner_assignment_id;

      update public.khpos_ops_decisions
      set status='implemented',implemented_at=now(),updated_at=now()
      where id=v_decision.id;

      insert into public.khpos_ops_decision_events(
        organisation_id,decision_id,actor_user_id,event_type,from_status,to_status,note,metadata
      ) values (
        v_decision.organisation_id,v_decision.id,v_completed_by,'implementation_completed',
        'approved','implemented','The approved action was completed in My Work.',
        jsonb_build_object('workItemId',new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_khpos_ops_sync_decision_from_work on public.khpos_ops_work_items;
create trigger trg_khpos_ops_sync_decision_from_work
after update of status on public.khpos_ops_work_items
for each row execute function khpos_private.ops_sync_decision_from_work();

create or replace function public.khpos_ops_get_decisions_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, khpos_private, pg_temp
as $$
declare
  v_member_role text;
  v_org_name text;
  v_items jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_authorities jsonb := '[]'::jsonb;
  v_action_owners jsonb := '[]'::jsonb;
  v_pending integer := 0;
  v_waiting_me integer := 0;
  v_overdue integer := 0;
  v_implemented integer := 0;
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,
    'roleId',r.id,
    'roleCode',r.code,
    'roleTitle',r.title,
    'roleLevel',r.role_level,
    'campusId',a.campus_id,
    'campusName',c.name,
    'unitId',a.unit_id,
    'unitName',u.name,
    'primaryAssignment',a.primary_assignment,
    'canRecordDecision',r.role_level<=4
  ) order by a.primary_assignment desc,r.role_level,r.title),'[]'::jsonb)
  into v_assignments
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  left join public.khpos_ops_campuses c on c.id=a.campus_id
  left join public.khpos_ops_units u on u.id=a.unit_id
  where a.user_id=p_actor_user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.status='active';

  with recursive actor_roles as (
    select a.id as assignment_id,a.role_id,a.campus_id,a.unit_id,r.reports_to_role_id,0 as depth
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  ),
  chain as (
    select assignment_id,role_id,campus_id,unit_id,reports_to_role_id,depth from actor_roles
    union all
    select chain.assignment_id,parent.id,chain.campus_id,chain.unit_id,parent.reports_to_role_id,chain.depth+1
    from chain
    join public.khpos_ops_roles parent on parent.id=chain.reports_to_role_id
    where parent.organisation_id=p_organisation_id
      and parent.status='active'
      and chain.depth<20
  )
  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'requesterAssignmentId',chain.assignment_id,
    'roleId',r.id,
    'roleCode',r.code,
    'roleTitle',r.title,
    'depth',chain.depth
  )),'[]'::jsonb)
  into v_authorities
  from chain
  join public.khpos_ops_roles r on r.id=chain.role_id
  where chain.depth>0;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',a.id,
    'roleId',r.id,
    'roleCode',r.code,
    'roleTitle',r.title,
    'displayName',coalesce(
      nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
      nullif(btrim(u.raw_user_meta_data->>'name'),''),
      u.email,
      'Assigned user'
    ),
    'email',u.email,
    'campusName',c.name,
    'unitName',un.name
  ) order by r.role_level,r.title,lower(coalesce(u.email,''))),'[]'::jsonb)
  into v_action_owners
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  join auth.users u on u.id=a.user_id
  left join public.khpos_ops_campuses c on c.id=a.campus_id
  left join public.khpos_ops_units un on un.id=a.unit_id
  where a.status='active'
    and r.organisation_id=p_organisation_id
    and r.status='active';

  with actor_assignments as (
    select a.*,r.role_level,r.code as role_code
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  ),
  visible as (
    select distinct
      d.*,
      rr.title as requester_role_title,
      ar.title as authority_role_title,
      req_user.email as requester_email,
      coalesce(req_user.raw_user_meta_data->>'full_name',req_user.raw_user_meta_data->>'name',req_user.email) as requester_display,
      auth_user.email as authority_email,
      coalesce(auth_user.raw_user_meta_data->>'full_name',auth_user.raw_user_meta_data->>'name',auth_user.email) as authority_display,
      impl_role.title as implementation_role_title,
      impl_user.email as implementation_email,
      coalesce(impl_user.raw_user_meta_data->>'full_name',impl_user.raw_user_meta_data->>'name',impl_user.email) as implementation_display,
      p.code as process_code,
      p.title as process_title,
      i.title as source_issue_title,
      w.id as work_item_id,
      w.status as work_status,
      w.title as work_title,
      w.due_at as work_due_at,
      w.completed_at as work_completed_at,
      (d.requested_by=p_actor_user_id) as is_requester,
      exists(select 1 from actor_assignments aa where aa.role_id=d.authority_role_id) as is_authority,
      exists(select 1 from actor_assignments aa where aa.id=d.implementation_owner_assignment_id) as is_implementation_owner
    from public.khpos_ops_decisions d
    left join public.khpos_ops_role_assignments ra on ra.id=d.requester_assignment_id
    left join public.khpos_ops_roles rr on rr.id=ra.role_id
    left join public.khpos_ops_roles ar on ar.id=d.authority_role_id
    left join auth.users req_user on req_user.id=d.requested_by
    left join public.khpos_ops_role_assignments aa on aa.id=d.authority_assignment_id
    left join auth.users auth_user on auth_user.id=aa.user_id
    left join public.khpos_ops_role_assignments ia on ia.id=d.implementation_owner_assignment_id
    left join public.khpos_ops_roles impl_role on impl_role.id=ia.role_id
    left join auth.users impl_user on impl_user.id=ia.user_id
    left join public.khpos_ops_processes p on p.id=d.process_id
    left join public.khpos_ops_issues i on i.id=d.source_issue_id
    left join public.khpos_ops_work_items w on w.source_decision_id=d.id and w.status<>'cancelled'
    where d.organisation_id=p_organisation_id
      and d.sensitivity='standard'
      and (
        d.requested_by=p_actor_user_id
        or exists(select 1 from actor_assignments actor_a where actor_a.role_id=d.authority_role_id)
        or exists(select 1 from actor_assignments actor_a where actor_a.id=d.implementation_owner_assignment_id)
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,
    'reference','DEC-'||upper(substr(v.id::text,1,8)),
    'mode',v.mode,
    'category',v.category,
    'priority',v.priority,
    'title',v.title,
    'context',v.context,
    'recommendation',v.recommendation,
    'status',v.status,
    'decisionDueAt',v.decision_due_at,
    'decisionText',v.decision_text,
    'decisionNote',v.decision_note,
    'decidedAt',v.decided_at,
    'actionRequired',v.action_required,
    'implementationTitle',v.implementation_title,
    'implementationExpectedOutcome',v.implementation_expected_outcome,
    'implementationDueAt',v.implementation_due_at,
    'implementedAt',v.implemented_at,
    'createdAt',v.created_at,
    'requester',jsonb_build_object(
      'roleTitle',v.requester_role_title,
      'displayName',v.requester_display,
      'email',v.requester_email
    ),
    'authority',jsonb_build_object(
      'roleId',v.authority_role_id,
      'roleTitle',v.authority_role_title,
      'displayName',v.authority_display,
      'email',v.authority_email
    ),
    'implementationOwner',case when v.implementation_owner_assignment_id is null then null else jsonb_build_object(
      'roleTitle',v.implementation_role_title,
      'displayName',v.implementation_display,
      'email',v.implementation_email
    ) end,
    'process',case when v.process_id is null then null else jsonb_build_object(
      'code',v.process_code,'title',v.process_title
    ) end,
    'sourceIssueTitle',v.source_issue_title,
    'work',case when v.work_item_id is null then null else jsonb_build_object(
      'id',v.work_item_id,
      'title',v.work_title,
      'status',v.work_status,
      'dueAt',v.work_due_at,
      'completedAt',v.work_completed_at
    ) end,
    'isRequester',v.is_requester,
    'isAuthority',v.is_authority,
    'isImplementationOwner',v.is_implementation_owner,
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
        from public.khpos_ops_decision_events e
        where e.decision_id=v.id
        order by e.created_at desc
        limit 12
      ) h
    ),'[]'::jsonb)
  ) order by
    case v.priority when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 else 4 end,
    case when v.status='closed' then 1 else 0 end,
    v.decision_due_at nulls last,
    v.created_at desc),'[]'::jsonb)
  into v_items
  from visible v
  where v.status<>'closed' or v.closed_at>=now()-interval '30 days';

  with actor_assignments as (
    select a.*
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  ),
  relevant as (
    select distinct d.*
    from public.khpos_ops_decisions d
    where d.organisation_id=p_organisation_id
      and d.sensitivity='standard'
      and (
        d.requested_by=p_actor_user_id
        or exists(select 1 from actor_assignments aa where aa.role_id=d.authority_role_id)
        or exists(select 1 from actor_assignments aa where aa.id=d.implementation_owner_assignment_id)
      )
  )
  select
    count(*) filter (where status in ('submitted','under_review','returned'))::integer,
    count(*) filter (
      where status in ('submitted','under_review')
      and exists(select 1 from actor_assignments aa where aa.role_id=relevant.authority_role_id)
    )::integer,
    count(*) filter (
      where status in ('submitted','under_review','returned')
      and decision_due_at is not null and decision_due_at<now()
    )::integer,
    count(*) filter (where status='implemented')::integer
  into v_pending,v_waiting_me,v_overdue,v_implemented
  from relevant;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'actorAssignments',v_assignments,
    'authorityOptions',v_authorities,
    'actionOwnerOptions',v_action_owners,
    'summary',jsonb_build_object(
      'pending',v_pending,
      'waitingForMe',v_waiting_me,
      'overdue',v_overdue,
      'implemented',v_implemented
    ),
    'items',v_items
  );
end;
$$;

create or replace function public.khpos_ops_create_decision_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, khpos_private, pg_temp
as $$
declare
  v_mode text := coalesce(nullif(btrim(p_input->>'mode'),''),'request');
  v_title text := nullif(btrim(p_input->>'title'),'');
  v_context text := nullif(btrim(p_input->>'context'),'');
  v_category text := lower(coalesce(nullif(btrim(p_input->>'category'),''),'other'));
  v_priority text := upper(coalesce(nullif(btrim(p_input->>'priority'),''),'P3'));
  v_recommendation text := nullif(btrim(p_input->>'recommendation'),'');
  v_requester_assignment uuid;
  v_requester_role uuid;
  v_requester_level integer;
  v_campus uuid;
  v_unit uuid;
  v_authority_role uuid;
  v_decision_due timestamptz;
  v_decision_text text := nullif(btrim(p_input->>'decisionText'),'');
  v_action_required boolean := coalesce((p_input->>'actionRequired')::boolean,false);
  v_impl_owner uuid;
  v_impl_title text := nullif(btrim(p_input->>'implementationTitle'),'');
  v_impl_outcome text := nullif(btrim(p_input->>'implementationExpectedOutcome'),'');
  v_impl_due timestamptz;
  v_process uuid;
  v_source_issue uuid;
  v_id uuid;
  v_status text;
  v_authority_assignment uuid;
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

  if v_mode not in ('request','record') then raise exception 'Unsupported decision mode.'; end if;
  if v_title is null or v_context is null then raise exception 'Decision title and context are required.'; end if;
  if v_priority not in ('P1','P2','P3','P4') then raise exception 'Decision priority must be P1, P2, P3 or P4.'; end if;
  if v_category='safeguarding' then
    raise exception 'Sensitive safeguarding decisions must use the restricted safeguarding route, not the standard decision register.';
  end if;

  begin
    v_requester_assignment := (p_input->>'requesterAssignmentId')::uuid;
  exception when others then
    raise exception 'A valid operating-role assignment is required.';
  end;

  select a.role_id,r.role_level,a.campus_id,a.unit_id
  into v_requester_role,v_requester_level,v_campus,v_unit
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.id=v_requester_assignment
    and a.user_id=p_actor_user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.status='active'
  limit 1;

  if v_requester_role is null then raise exception 'The selected operating-role assignment is not active for you.'; end if;

  begin
    v_authority_role := (p_input->>'authorityRoleId')::uuid;
  exception when others then
    raise exception 'A valid decision authority role is required.';
  end;

  if not exists(
    select 1 from public.khpos_ops_roles
    where id=v_authority_role and organisation_id=p_organisation_id and status='active'
  ) then
    raise exception 'Decision authority role not found.';
  end if;

  if nullif(p_input->>'decisionDueAt','') is not null then
    begin v_decision_due := (p_input->>'decisionDueAt')::timestamptz;
    exception when others then raise exception 'Decision deadline is invalid.'; end;
  end if;

  if nullif(p_input->>'sourceIssueId','') is not null then
    begin v_source_issue := (p_input->>'sourceIssueId')::uuid;
    exception when others then raise exception 'Source issue identifier is invalid.'; end;
    if not exists(
      select 1 from public.khpos_ops_issues
      where id=v_source_issue and organisation_id=p_organisation_id and sensitivity='standard'
    ) then
      raise exception 'Source issue not found in this standard workspace.';
    end if;
  end if;

  select id into v_process
  from public.khpos_ops_processes
  where organisation_id=p_organisation_id and code='GOV-005'
  limit 1;

  if v_process is null then raise exception 'GOV-005 Decision & Action Tracking is not registered.'; end if;

  if v_mode='request' then
    if not khpos_private.ops_role_is_ancestor(
      p_organisation_id,v_requester_role,v_authority_role
    ) then
      raise exception 'Decision requests can only move upward through the active reporting chain.';
    end if;
    v_status := 'submitted';
  else
    if v_authority_role<>v_requester_role or v_requester_level>4 then
      raise exception 'Direct decision recording is limited to active KNS leadership roles acting within their own role.';
    end if;
    if v_decision_text is null then raise exception 'A recorded decision requires the decision made.'; end if;
    v_status := 'approved';

    if v_action_required then
      begin
        v_impl_owner := (p_input->>'implementationOwnerAssignmentId')::uuid;
      exception when others then
        raise exception 'An implementation owner is required when the decision creates action.';
      end;
      if not exists(
        select 1
        from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles r on r.id=a.role_id
        where a.id=v_impl_owner and a.status='active'
          and r.organisation_id=p_organisation_id and r.status='active'
      ) then
        raise exception 'Implementation owner assignment is not active in this organisation.';
      end if;
      if v_impl_title is null or v_impl_outcome is null or nullif(p_input->>'implementationDueAt','') is null then
        raise exception 'Action title, expected outcome and deadline are required when implementation action is needed.';
      end if;
      begin v_impl_due := (p_input->>'implementationDueAt')::timestamptz;
      exception when others then raise exception 'Implementation deadline is invalid.'; end;
    end if;
  end if;

  select a.id into v_authority_assignment
  from public.khpos_ops_role_assignments a
  where a.role_id=v_authority_role
    and a.status='active'
    and (a.campus_id is null or v_campus is null or a.campus_id=v_campus)
    and (a.unit_id is null or v_unit is null or a.unit_id=v_unit)
  order by a.primary_assignment desc,a.created_at
  limit 1;

  insert into public.khpos_ops_decisions(
    organisation_id,campus_id,unit_id,process_id,source_issue_id,mode,category,priority,
    title,context,recommendation,requested_by,requester_assignment_id,authority_role_id,
    authority_assignment_id,status,decision_due_at,decision_text,decision_note,decided_by,
    decided_at,action_required,implementation_owner_assignment_id,implementation_title,
    implementation_expected_outcome,implementation_due_at
  ) values (
    p_organisation_id,v_campus,v_unit,v_process,v_source_issue,v_mode,left(v_category,80),v_priority,
    left(v_title,180),left(v_context,6000),left(v_recommendation,4000),p_actor_user_id,
    v_requester_assignment,v_authority_role,v_authority_assignment,v_status,v_decision_due,
    left(v_decision_text,6000),
    case when v_mode='record' then 'Decision recorded directly by the active authority.' else null end,
    case when v_mode='record' then p_actor_user_id else null end,
    case when v_mode='record' then now() else null end,
    v_action_required,v_impl_owner,left(v_impl_title,180),left(v_impl_outcome,4000),v_impl_due
  ) returning id into v_id;

  insert into public.khpos_ops_decision_events(
    organisation_id,decision_id,actor_user_id,event_type,to_status,note,metadata
  ) values (
    p_organisation_id,v_id,p_actor_user_id,
    case when v_mode='record' then 'recorded' else 'submitted' end,
    v_status,
    case when v_mode='record' then v_decision_text else v_context end,
    jsonb_build_object(
      'requesterAssignmentId',v_requester_assignment,
      'authorityRoleId',v_authority_role,
      'priority',v_priority,
      'mode',v_mode
    )
  );

  if v_mode='record' and v_action_required then
    perform khpos_private.ops_create_decision_work(p_actor_user_id,v_id);
  end if;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,
    case when v_mode='record' then 'ops_decision_recorded' else 'ops_decision_requested' end,
    'decision',v_id,
    jsonb_build_object('priority',v_priority,'category',v_category,'authorityRoleId',v_authority_role)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_decision_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_decision_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, khpos_private, pg_temp
as $$
declare
  v_decision public.khpos_ops_decisions%rowtype;
  v_note text := nullif(btrim(p_payload->>'note'),'');
  v_is_requester boolean := false;
  v_is_authority boolean := false;
  v_authority_assignment uuid;
  v_from_status text;
  v_action_required boolean := coalesce((p_payload->>'actionRequired')::boolean,false);
  v_impl_owner uuid;
  v_impl_title text := nullif(btrim(p_payload->>'implementationTitle'),'');
  v_impl_outcome text := nullif(btrim(p_payload->>'implementationExpectedOutcome'),'');
  v_impl_due timestamptz;
  v_work_id uuid;
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

  select * into v_decision
  from public.khpos_ops_decisions
  where id=p_decision_id
    and organisation_id=p_organisation_id
    and sensitivity='standard'
  for update;

  if v_decision.id is null then raise exception 'Decision not found.'; end if;

  v_is_requester := v_decision.requested_by=p_actor_user_id;

  select a.id into v_authority_assignment
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.user_id=p_actor_user_id
    and a.role_id=v_decision.authority_role_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.status='active'
    and (a.campus_id is null or v_decision.campus_id is null or a.campus_id=v_decision.campus_id)
    and (a.unit_id is null or v_decision.unit_id is null or a.unit_id=v_decision.unit_id)
  order by a.primary_assignment desc,a.created_at
  limit 1;

  v_is_authority := v_authority_assignment is not null;

  if not (v_is_requester or v_is_authority or exists(
    select 1 from public.khpos_ops_role_assignments a
    where a.id=v_decision.implementation_owner_assignment_id
      and a.user_id=p_actor_user_id and a.status='active'
  )) then
    raise exception 'This decision is not visible to your active role.';
  end if;

  v_from_status := v_decision.status;

  if p_action='review' then
    if not v_is_authority or v_decision.status<>'submitted' then
      raise exception 'Only the assigned decision authority can start review of a submitted request.';
    end if;

    update public.khpos_ops_decisions
    set status='under_review',authority_assignment_id=v_authority_assignment,updated_at=now()
    where id=v_decision.id;

    insert into public.khpos_ops_decision_events(
      organisation_id,decision_id,actor_user_id,event_type,from_status,to_status,note
    ) values (
      p_organisation_id,v_decision.id,p_actor_user_id,'review_started',v_from_status,'under_review',v_note
    );

  elsif p_action='return' then
    if not v_is_authority or v_decision.status not in ('submitted','under_review') then
      raise exception 'Only the decision authority can return an active request.';
    end if;
    if v_note is null then raise exception 'Explain what information or change is required.'; end if;

    update public.khpos_ops_decisions
    set status='returned',authority_assignment_id=v_authority_assignment,decision_note=left(v_note,4000),updated_at=now()
    where id=v_decision.id;

    insert into public.khpos_ops_decision_events(
      organisation_id,decision_id,actor_user_id,event_type,from_status,to_status,note
    ) values (
      p_organisation_id,v_decision.id,p_actor_user_id,'returned',v_from_status,'returned',left(v_note,4000)
    );

  elsif p_action='resubmit' then
    if not v_is_requester or v_decision.status<>'returned' then
      raise exception 'Only the requester can resubmit a returned decision.';
    end if;
    if v_note is null then raise exception 'Add the requested clarification before resubmitting.'; end if;

    update public.khpos_ops_decisions
    set status='submitted',recommendation=coalesce(recommendation,'') || E'\n\nResubmission note: ' || left(v_note,3500),
        decision_note=null,updated_at=now()
    where id=v_decision.id;

    insert into public.khpos_ops_decision_events(
      organisation_id,decision_id,actor_user_id,event_type,from_status,to_status,note
    ) values (
      p_organisation_id,v_decision.id,p_actor_user_id,'resubmitted',v_from_status,'submitted',left(v_note,4000)
    );

  elsif p_action='approve' then
    if not v_is_authority or v_decision.status not in ('submitted','under_review') then
      raise exception 'Only the decision authority can approve an active request.';
    end if;
    if v_note is null then raise exception 'Record the decision made before approval.'; end if;

    if v_action_required then
      begin v_impl_owner := (p_payload->>'implementationOwnerAssignmentId')::uuid;
      exception when others then raise exception 'An implementation owner is required.'; end;

      if not exists(
        select 1
        from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles r on r.id=a.role_id
        where a.id=v_impl_owner and a.status='active'
          and r.organisation_id=p_organisation_id and r.status='active'
      ) then
        raise exception 'Implementation owner assignment is not active in this organisation.';
      end if;

      if v_impl_title is null or v_impl_outcome is null or nullif(p_payload->>'implementationDueAt','') is null then
        raise exception 'Action title, expected outcome and deadline are required when implementation is needed.';
      end if;

      begin v_impl_due := (p_payload->>'implementationDueAt')::timestamptz;
      exception when others then raise exception 'Implementation deadline is invalid.'; end;
    end if;

    update public.khpos_ops_decisions
    set status='approved',
        authority_assignment_id=v_authority_assignment,
        decision_text=left(v_note,6000),
        decision_note=null,
        decided_by=p_actor_user_id,
        decided_at=now(),
        action_required=v_action_required,
        implementation_owner_assignment_id=case when v_action_required then v_impl_owner else null end,
        implementation_title=case when v_action_required then left(v_impl_title,180) else null end,
        implementation_expected_outcome=case when v_action_required then left(v_impl_outcome,4000) else null end,
        implementation_due_at=case when v_action_required then v_impl_due else null end,
        updated_at=now()
    where id=v_decision.id;

    insert into public.khpos_ops_decision_events(
      organisation_id,decision_id,actor_user_id,event_type,from_status,to_status,note,metadata
    ) values (
      p_organisation_id,v_decision.id,p_actor_user_id,'approved',v_from_status,'approved',left(v_note,6000),
      jsonb_build_object('actionRequired',v_action_required)
    );

    if v_action_required then
      v_work_id := khpos_private.ops_create_decision_work(p_actor_user_id,v_decision.id);
    end if;

  elsif p_action='reject' then
    if not v_is_authority or v_decision.status not in ('submitted','under_review') then
      raise exception 'Only the decision authority can reject an active request.';
    end if;
    if v_note is null then raise exception 'Record the reason for rejection.'; end if;

    update public.khpos_ops_decisions
    set status='rejected',authority_assignment_id=v_authority_assignment,
        decision_text=left(v_note,6000),decided_by=p_actor_user_id,decided_at=now(),updated_at=now()
    where id=v_decision.id;

    insert into public.khpos_ops_decision_events(
      organisation_id,decision_id,actor_user_id,event_type,from_status,to_status,note
    ) values (
      p_organisation_id,v_decision.id,p_actor_user_id,'rejected',v_from_status,'rejected',left(v_note,6000)
    );

  elsif p_action='withdraw' then
    if not v_is_requester or v_decision.mode<>'request'
       or v_decision.status not in ('submitted','under_review','returned') then
      raise exception 'Only the requester can withdraw an active decision request.';
    end if;
    if v_note is null then raise exception 'Record why this request is being withdrawn.'; end if;

    update public.khpos_ops_decisions
    set status='withdrawn',decision_note=left(v_note,4000),updated_at=now()
    where id=v_decision.id;

    insert into public.khpos_ops_decision_events(
      organisation_id,decision_id,actor_user_id,event_type,from_status,to_status,note
    ) values (
      p_organisation_id,v_decision.id,p_actor_user_id,'withdrawn',v_from_status,'withdrawn',left(v_note,4000)
    );

  elsif p_action='close' then
    if not (v_is_authority or v_is_requester) then
      raise exception 'Only the requester or decision authority can close this decision.';
    end if;
    if v_decision.status not in ('approved','rejected','withdrawn','implemented') then
      raise exception 'Only a decided, withdrawn or implemented decision can be closed.';
    end if;
    if v_decision.status='approved' and v_decision.action_required then
      raise exception 'The linked implementation action must be completed before this decision can close.';
    end if;

    update public.khpos_ops_decisions
    set status='closed',closed_at=now(),updated_at=now()
    where id=v_decision.id;

    insert into public.khpos_ops_decision_events(
      organisation_id,decision_id,actor_user_id,event_type,from_status,to_status,note
    ) values (
      p_organisation_id,v_decision.id,p_actor_user_id,'closed',v_from_status,'closed',v_note
    );

  elsif p_action='comment' then
    if v_note is null then raise exception 'A decision note is required.'; end if;
    insert into public.khpos_ops_decision_events(
      organisation_id,decision_id,actor_user_id,event_type,note
    ) values (
      p_organisation_id,v_decision.id,p_actor_user_id,'comment',left(v_note,4000)
    );

  else
    raise exception 'Unsupported decision action.';
  end if;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_decision_'||p_action,'decision',v_decision.id,
    jsonb_build_object('fromStatus',v_from_status,'note',v_note,'workItemId',v_work_id)
  );
end;
$$;

revoke execute on function khpos_private.ops_role_is_ancestor(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_create_decision_work(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_sync_decision_from_work()
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_get_decisions_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_decision_server(uuid,uuid,jsonb)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_decision_action_server(uuid,uuid,uuid,text,jsonb)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_role_is_ancestor(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_create_decision_work(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_sync_decision_from_work() to service_role;
grant execute on function public.khpos_ops_get_decisions_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_decision_server(uuid,uuid,jsonb) to service_role;
grant execute on function public.khpos_ops_decision_action_server(uuid,uuid,uuid,text,jsonb) to service_role;
