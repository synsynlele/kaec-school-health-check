create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_staff_succession_plans (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  current_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  target_role_id uuid not null references public.khpos_ops_roles(id) on delete restrict,
  succession_reference text not null,
  readiness_state text not null
    check (readiness_state in (
      'exploring','developing','ready_with_support','ready_now','not_ready'
    )),
  readiness_summary text not null,
  development_priorities text,
  target_horizon date,
  external_governance_required boolean not null default false,
  status text not null default 'active'
    check (status in ('active','achieved','withdrawn','archived')),
  sponsor_user_id uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  achieved_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,succession_reference)
);

create unique index if not exists uq_khpos_ops_succession_active_target
  on public.khpos_ops_staff_succession_plans(staff_id,target_role_id)
  where status='active';
create index if not exists idx_khpos_ops_succession_org_state
  on public.khpos_ops_staff_succession_plans(organisation_id,status,readiness_state);
create index if not exists idx_khpos_ops_succession_target
  on public.khpos_ops_staff_succession_plans(target_role_id,status,readiness_state);
create index if not exists idx_khpos_ops_succession_sponsor
  on public.khpos_ops_staff_succession_plans(sponsor_user_id,status);

create table if not exists public.khpos_ops_staff_promotion_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  promotion_reference text not null,
  source_succession_plan_id uuid references public.khpos_ops_staff_succession_plans(id) on delete set null,
  from_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  from_role_id uuid not null references public.khpos_ops_roles(id) on delete restrict,
  target_role_id uuid not null references public.khpos_ops_roles(id) on delete restrict,
  target_campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  target_unit_id uuid references public.khpos_ops_units(id) on delete set null,
  proposed_effective_date date not null,
  justification text not null,
  readiness_summary text not null,
  staff_acceptance_state text not null default 'pending'
    check (staff_acceptance_state in ('pending','accepted','declined')),
  staff_response_note text,
  staff_responded_at timestamptz,
  continuity_recipient_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  target_supervisor_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  status text not null
    check (status in (
      'awaiting_acceptance','under_review','approved',
      'external_governance_required','executed','declined','cancelled'
    )),
  external_governance_required boolean not null default false,
  authority_review_reference text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  approval_note text,
  executed_by uuid references auth.users(id) on delete set null,
  executed_at timestamptz,
  new_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,promotion_reference)
);

create unique index if not exists uq_khpos_ops_promotion_open_staff
  on public.khpos_ops_staff_promotion_cases(staff_id)
  where status in ('awaiting_acceptance','under_review','approved','external_governance_required');
create index if not exists idx_khpos_ops_promotion_org_status
  on public.khpos_ops_staff_promotion_cases(organisation_id,status,proposed_effective_date);
create index if not exists idx_khpos_ops_promotion_target
  on public.khpos_ops_staff_promotion_cases(target_role_id,status);
create index if not exists idx_khpos_ops_promotion_created_by
  on public.khpos_ops_staff_promotion_cases(created_by,created_at desc);

create table if not exists public.khpos_ops_staff_progression_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  succession_plan_id uuid references public.khpos_ops_staff_succession_plans(id) on delete cascade,
  promotion_case_id uuid references public.khpos_ops_staff_promotion_cases(id) on delete cascade,
  evidence_type text not null
    check (evidence_type in (
      'performance_review','role_outcome','observation','recognition',
      'development','acting_responsibility','project','other'
    )),
  title text not null,
  note text not null,
  evidence_reference text,
  source_performance_review_id uuid references public.khpos_ops_staff_performance_reviews(id) on delete set null,
  source_recognition_id uuid references public.khpos_ops_staff_recognition(id) on delete set null,
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (num_nonnulls(succession_plan_id,promotion_case_id)=1)
);

create index if not exists idx_khpos_ops_progression_evidence_succession
  on public.khpos_ops_staff_progression_evidence(succession_plan_id,created_at desc)
  where succession_plan_id is not null;
create index if not exists idx_khpos_ops_progression_evidence_promotion
  on public.khpos_ops_staff_progression_evidence(promotion_case_id,created_at desc)
  where promotion_case_id is not null;
create index if not exists idx_khpos_ops_progression_evidence_added_by
  on public.khpos_ops_staff_progression_evidence(added_by,created_at desc);

create table if not exists public.khpos_ops_staff_exit_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  affected_assignment_id uuid not null references public.khpos_ops_role_assignments(id) on delete restrict,
  exit_reference text not null,
  exit_type text not null
    check (exit_type in (
      'resignation','retirement','contract_end','mutual_agreement',
      'redundancy','termination','dismissal','other'
    )),
  proposed_last_day date not null,
  basis_reference text not null,
  authority_review_reference text,
  source_accountability_case_id uuid references public.khpos_ops_staff_accountability_cases(id) on delete set null,
  reason_note text,
  initiated_by_staff boolean not null default false,
  continuity_recipient_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  replacement_required boolean not null default true,
  status text not null default 'open'
    check (status in (
      'open','clearance_in_progress','ended','cancelled','closed'
    )),
  initiated_by uuid not null references auth.users(id) on delete restrict,
  initiated_at timestamptz not null default now(),
  clearance_started_by uuid references auth.users(id) on delete set null,
  clearance_started_at timestamptz,
  actual_last_day date,
  ended_by uuid references auth.users(id) on delete set null,
  ended_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_note text,
  cancellation_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,exit_reference)
);

create unique index if not exists uq_khpos_ops_exit_open_staff
  on public.khpos_ops_staff_exit_cases(staff_id)
  where status in ('open','clearance_in_progress');
create index if not exists idx_khpos_ops_exit_org_status
  on public.khpos_ops_staff_exit_cases(organisation_id,status,proposed_last_day);
create index if not exists idx_khpos_ops_exit_initiator
  on public.khpos_ops_staff_exit_cases(initiated_by,initiated_at desc);
create index if not exists idx_khpos_ops_exit_source_accountability
  on public.khpos_ops_staff_exit_cases(source_accountability_case_id)
  where source_accountability_case_id is not null;

create table if not exists public.khpos_ops_staff_transition_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  promotion_case_id uuid references public.khpos_ops_staff_promotion_cases(id) on delete cascade,
  exit_case_id uuid references public.khpos_ops_staff_exit_cases(id) on delete cascade,
  item_code text not null,
  item_type text not null
    check (item_type in (
      'responsibility_handover','target_role_readiness','records_transfer',
      'asset_clearance','finance_admin_clearance','knowledge_capture',
      'document_control','access_revocation','other'
    )),
  title text not null,
  description text not null,
  completion_phase text not null default 'pre_execute'
    check (completion_phase in ('pre_execute','at_execute')),
  mandatory boolean not null default true,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  recipient_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending','in_progress','evidence_submitted','verified','waived')),
  completion_note text,
  evidence_reference text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  waived_by uuid references auth.users(id) on delete set null,
  waived_at timestamptz,
  waiver_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(promotion_case_id,exit_case_id)=1),
  unique (promotion_case_id,item_code),
  unique (exit_case_id,item_code)
);

create index if not exists idx_khpos_ops_transition_item_promotion
  on public.khpos_ops_staff_transition_items(promotion_case_id,status,due_date)
  where promotion_case_id is not null;
create index if not exists idx_khpos_ops_transition_item_exit
  on public.khpos_ops_staff_transition_items(exit_case_id,status,due_date)
  where exit_case_id is not null;
create index if not exists idx_khpos_ops_transition_item_owner
  on public.khpos_ops_staff_transition_items(owner_user_id,status,due_date);
create index if not exists idx_khpos_ops_transition_item_recipient
  on public.khpos_ops_staff_transition_items(recipient_assignment_id)
  where recipient_assignment_id is not null;

create table if not exists public.khpos_ops_staff_transition_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  succession_plan_id uuid references public.khpos_ops_staff_succession_plans(id) on delete cascade,
  promotion_case_id uuid references public.khpos_ops_staff_promotion_cases(id) on delete cascade,
  exit_case_id uuid references public.khpos_ops_staff_exit_cases(id) on delete cascade,
  transition_item_id uuid references public.khpos_ops_staff_transition_items(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(succession_plan_id,promotion_case_id,exit_case_id,transition_item_id)>=1)
);

create index if not exists idx_khpos_ops_transition_events_succession
  on public.khpos_ops_staff_transition_events(succession_plan_id,created_at desc)
  where succession_plan_id is not null;
create index if not exists idx_khpos_ops_transition_events_promotion
  on public.khpos_ops_staff_transition_events(promotion_case_id,created_at desc)
  where promotion_case_id is not null;
create index if not exists idx_khpos_ops_transition_events_exit
  on public.khpos_ops_staff_transition_events(exit_case_id,created_at desc)
  where exit_case_id is not null;
create index if not exists idx_khpos_ops_transition_events_item
  on public.khpos_ops_staff_transition_events(transition_item_id,created_at desc)
  where transition_item_id is not null;

alter table public.khpos_ops_staff_succession_plans enable row level security;
alter table public.khpos_ops_staff_promotion_cases enable row level security;
alter table public.khpos_ops_staff_progression_evidence enable row level security;
alter table public.khpos_ops_staff_exit_cases enable row level security;
alter table public.khpos_ops_staff_transition_items enable row level security;
alter table public.khpos_ops_staff_transition_events enable row level security;

revoke all privileges on table public.khpos_ops_staff_succession_plans from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_promotion_cases from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_progression_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_exit_cases from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_transition_items from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_transition_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_staff_succession_plans to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_promotion_cases to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_progression_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_exit_cases to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_transition_items to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_transition_events to service_role;

create or replace function khpos_private.ops_transition_has_membership(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  );
$$;

create or replace function khpos_private.ops_transition_actor_has_role(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_role_code text
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code=p_role_code
  );
$$;

create or replace function khpos_private.ops_transition_staff_for_user(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select s.id
  from public.khpos_ops_staff s
  where s.organisation_id=p_organisation_id
    and s.user_id=p_actor_user_id
    and s.status in ('active','exiting')
  order by s.created_at
  limit 1;
$$;

create or replace function khpos_private.ops_transition_can_manage_people(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select khpos_private.ops_can_manage_people(
    p_actor_user_id,p_organisation_id
  );
$$;

create or replace function khpos_private.ops_transition_can_manage_exit(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $
declare
  v_staff_user_id uuid;
  v_role_code text;
begin
  select s.user_id,r.code into v_staff_user_id,v_role_code
  from public.khpos_ops_staff s
  join public.khpos_ops_roles r on r.id=s.desired_role_id
  where s.id=p_staff_id
    and s.organisation_id=p_organisation_id;

  if v_staff_user_id is null or v_role_code is null then
    return false;
  end if;

  if v_staff_user_id=p_actor_user_id then
    return false;
  end if;

  if v_role_code='VISION_CUSTODIAN' then
    return false;
  end if;

  if v_role_code='SCHOOL_GUARDIAN' then
    return khpos_private.ops_transition_actor_has_role(
      p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
    );
  end if;

  return khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  );
end;
$;

create or replace function khpos_private.ops_transition_valid_target(
  p_organisation_id uuid,
  p_current_role_id uuid,
  p_target_role_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_roles cr
    join public.khpos_ops_roles tr
      on tr.id=p_target_role_id
      and tr.organisation_id=p_organisation_id
      and tr.status='active'
    where cr.id=p_current_role_id
      and cr.organisation_id=p_organisation_id
      and cr.status='active'
      and tr.role_level<cr.role_level
      and khpos_private.ops_role_is_ancestor(
        p_organisation_id,p_current_role_id,p_target_role_id
      )
  );
$$;

create or replace function khpos_private.ops_transition_can_approve_target(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_target_role_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_code text;
begin
  select code into v_code
  from public.khpos_ops_roles
  where id=p_target_role_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_code is null or v_code='VISION_CUSTODIAN' then
    return false;
  end if;

  if v_code='SCHOOL_GUARDIAN' then
    return khpos_private.ops_transition_actor_has_role(
      p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
    );
  end if;

  return khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  );
end;
$$;

create or replace function khpos_private.ops_transition_case_visible(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select
    khpos_private.ops_transition_can_manage_people(
      p_actor_user_id,p_organisation_id
    )
    or exists(
      select 1
      from public.khpos_ops_staff s
      where s.id=p_staff_id
        and s.organisation_id=p_organisation_id
        and s.user_id=p_actor_user_id
    );
$$;

create or replace function public.khpos_ops_get_staff_transition_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_org_name text;
  v_member_role text;
  v_actor_staff_id uuid;
  v_can_manage boolean;
  v_roles jsonb := '[]'::jsonb;
  v_staff jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_succession jsonb := '[]'::jsonb;
  v_promotions jsonb := '[]'::jsonb;
  v_exits jsonb := '[]'::jsonb;
begin
  if not khpos_private.ops_transition_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select o.name,m.role into v_org_name,v_member_role
  from public.organisations o
  join public.organisation_memberships m on m.organisation_id=o.id
  where o.id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
  limit 1;

  v_actor_staff_id := khpos_private.ops_transition_staff_for_user(
    p_actor_user_id,p_organisation_id
  );
  v_can_manage := khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'code',r.code,'title',r.title,'level',r.role_level,
    'reportsToRoleId',r.reports_to_role_id,
    'charterActive',exists(
      select 1 from public.khpos_ops_role_charters rc
      where rc.role_id=r.id and rc.status='active'
    )
  ) order by r.role_level,r.title),'[]'::jsonb)
  into v_roles
  from public.khpos_ops_roles r
  where r.organisation_id=p_organisation_id
    and r.status='active'
    and r.category<>'student';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'reference',s.staff_reference,
    'displayName',s.display_name,
    'userId',s.user_id,
    'status',s.status,
    'roleId',r.id,
    'roleCode',r.code,
    'roleTitle',r.title,
    'roleLevel',r.role_level,
    'roleAssignmentId',s.role_assignment_id,
    'campusId',s.campus_id,
    'unitId',s.unit_id,
    'isSelf',s.user_id=p_actor_user_id,
    'canManage',v_can_manage and s.user_id is distinct from p_actor_user_id
  ) order by r.role_level,s.display_name),'[]'::jsonb)
  into v_staff
  from public.khpos_ops_staff s
  join public.khpos_ops_roles r on r.id=s.desired_role_id
  where s.organisation_id=p_organisation_id
    and s.status in ('active','exiting')
    and (
      v_can_manage
      or s.user_id=p_actor_user_id
    );

  if v_can_manage then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,
      'userId',a.user_id,
      'roleId',r.id,
      'roleCode',r.code,
      'roleTitle',r.title,
      'roleLevel',r.role_level,
      'campusId',a.campus_id,
      'unitId',a.unit_id,
      'primary',a.primary_assignment
    ) order by r.role_level,r.title),'[]'::jsonb)
    into v_assignments
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where r.organisation_id=p_organisation_id
      and r.status='active'
      and a.status='active';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',sp.id,
    'reference',sp.succession_reference,
    'staffId',sp.staff_id,
    'staffName',s.display_name,
    'currentRoleTitle',cr.title,
    'targetRoleId',tr.id,
    'targetRoleCode',tr.code,
    'targetRoleTitle',tr.title,
    'targetRoleLevel',tr.role_level,
    'readinessState',sp.readiness_state,
    'readinessSummary',sp.readiness_summary,
    'developmentPriorities',sp.development_priorities,
    'targetHorizon',sp.target_horizon,
    'externalGovernanceRequired',sp.external_governance_required,
    'status',sp.status,
    'isSelf',s.user_id=p_actor_user_id,
    'canManage',v_can_manage,
    'evidence',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'evidenceType',e.evidence_type,'title',e.title,
        'note',e.note,'evidenceReference',e.evidence_reference,
        'createdAt',e.created_at
      ) order by e.created_at desc)
      from public.khpos_ops_staff_progression_evidence e
      where e.succession_plan_id=sp.id
    ),'[]'::jsonb)
  ) order by sp.created_at desc),'[]'::jsonb)
  into v_succession
  from public.khpos_ops_staff_succession_plans sp
  join public.khpos_ops_staff s on s.id=sp.staff_id
  join public.khpos_ops_roles cr on cr.id=(
    select a.role_id from public.khpos_ops_role_assignments a
    where a.id=sp.current_assignment_id
  )
  join public.khpos_ops_roles tr on tr.id=sp.target_role_id
  where sp.organisation_id=p_organisation_id
    and khpos_private.ops_transition_case_visible(
      p_actor_user_id,p_organisation_id,sp.staff_id
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',pc.id,
    'reference',pc.promotion_reference,
    'staffId',pc.staff_id,
    'staffName',s.display_name,
    'fromRoleTitle',fr.title,
    'targetRoleId',tr.id,
    'targetRoleCode',tr.code,
    'targetRoleTitle',tr.title,
    'targetCampusId',pc.target_campus_id,
    'targetUnitId',pc.target_unit_id,
    'proposedEffectiveDate',pc.proposed_effective_date,
    'justification',pc.justification,
    'readinessSummary',pc.readiness_summary,
    'staffAcceptanceState',pc.staff_acceptance_state,
    'staffResponseNote',pc.staff_response_note,
    'continuityRecipientAssignmentId',pc.continuity_recipient_assignment_id,
    'targetSupervisorAssignmentId',pc.target_supervisor_assignment_id,
    'status',pc.status,
    'externalGovernanceRequired',pc.external_governance_required,
    'authorityReviewReference',case when v_can_manage then pc.authority_review_reference else null end,
    'approvalNote',pc.approval_note,
    'approvedAt',pc.approved_at,
    'executedAt',pc.executed_at,
    'newAssignmentId',pc.new_assignment_id,
    'isSelf',s.user_id=p_actor_user_id,
    'canManage',v_can_manage,
    'evidence',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'evidenceType',e.evidence_type,'title',e.title,
        'note',e.note,'evidenceReference',e.evidence_reference,
        'createdAt',e.created_at
      ) order by e.created_at desc)
      from public.khpos_ops_staff_progression_evidence e
      where e.promotion_case_id=pc.id
    ),'[]'::jsonb),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ti.id,'itemCode',ti.item_code,'itemType',ti.item_type,
        'title',ti.title,'description',ti.description,
        'completionPhase',ti.completion_phase,'mandatory',ti.mandatory,
        'ownerUserId',ti.owner_user_id,
        'recipientAssignmentId',ti.recipient_assignment_id,
        'dueDate',ti.due_date,'status',ti.status,
        'completionNote',ti.completion_note,
        'evidenceReference',ti.evidence_reference,
        'isOwner',ti.owner_user_id=p_actor_user_id,
        'canVerify',v_can_manage
      ) order by ti.created_at)
      from public.khpos_ops_staff_transition_items ti
      where ti.promotion_case_id=pc.id
    ),'[]'::jsonb)
  ) order by pc.created_at desc),'[]'::jsonb)
  into v_promotions
  from public.khpos_ops_staff_promotion_cases pc
  join public.khpos_ops_staff s on s.id=pc.staff_id
  join public.khpos_ops_roles fr on fr.id=pc.from_role_id
  join public.khpos_ops_roles tr on tr.id=pc.target_role_id
  where pc.organisation_id=p_organisation_id
    and khpos_private.ops_transition_case_visible(
      p_actor_user_id,p_organisation_id,pc.staff_id
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ec.id,
    'reference',ec.exit_reference,
    'staffId',ec.staff_id,
    'staffName',s.display_name,
    'roleTitle',r.title,
    'roleCode',r.code,
    'exitType',ec.exit_type,
    'proposedLastDay',ec.proposed_last_day,
    'basisReference',ec.basis_reference,
    'authorityReviewReference',case when v_can_manage then ec.authority_review_reference else null end,
    'reasonNote',ec.reason_note,
    'initiatedByStaff',ec.initiated_by_staff,
    'continuityRecipientAssignmentId',ec.continuity_recipient_assignment_id,
    'replacementRequired',ec.replacement_required,
    'status',ec.status,
    'actualLastDay',ec.actual_last_day,
    'endedAt',ec.ended_at,
    'isSelf',s.user_id=p_actor_user_id,
    'canManage',khpos_private.ops_transition_can_manage_exit(
      p_actor_user_id,p_organisation_id,ec.staff_id
    ),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ti.id,'itemCode',ti.item_code,'itemType',ti.item_type,
        'title',ti.title,'description',ti.description,
        'completionPhase',ti.completion_phase,'mandatory',ti.mandatory,
        'ownerUserId',ti.owner_user_id,
        'recipientAssignmentId',ti.recipient_assignment_id,
        'dueDate',ti.due_date,'status',ti.status,
        'completionNote',ti.completion_note,
        'evidenceReference',ti.evidence_reference,
        'isOwner',ti.owner_user_id=p_actor_user_id,
        'canVerify',khpos_private.ops_transition_can_manage_exit(
          p_actor_user_id,p_organisation_id,ec.staff_id
        )
      ) order by ti.created_at)
      from public.khpos_ops_staff_transition_items ti
      where ti.exit_case_id=ec.id
    ),'[]'::jsonb)
  ) order by ec.created_at desc),'[]'::jsonb)
  into v_exits
  from public.khpos_ops_staff_exit_cases ec
  join public.khpos_ops_staff s on s.id=ec.staff_id
  join public.khpos_ops_roles r on r.id=(
    select a.role_id from public.khpos_ops_role_assignments a
    where a.id=ec.affected_assignment_id
  )
  where ec.organisation_id=p_organisation_id
    and khpos_private.ops_transition_case_visible(
      p_actor_user_id,p_organisation_id,ec.staff_id
    );

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'actorStaffId',v_actor_staff_id,
    'canManagePeople',v_can_manage,
    'principle','Responsibility must always have an owner: progression changes who carries responsibility; exit must transfer it before access and assignments are closed.',
    'legalBoundary','KHP-OS records the institutional transition, evidence, handover and access closure. It does not calculate notice, final pay, benefits, redundancy entitlement or determine whether a termination is legally valid; the applicable contract, Finance/Admin and qualified legal/HR review remain authoritative.',
    'roles',v_roles,
    'staff',v_staff,
    'assignments',v_assignments,
    'successionPlans',v_succession,
    'promotionCases',v_promotions,
    'exitCases',v_exits,
    'summary',jsonb_build_object(
      'activeSuccession',(
        select count(*) from public.khpos_ops_staff_succession_plans sp
        where sp.organisation_id=p_organisation_id and sp.status='active'
          and khpos_private.ops_transition_case_visible(
            p_actor_user_id,p_organisation_id,sp.staff_id
          )
      ),
      'readyNow',(
        select count(*) from public.khpos_ops_staff_succession_plans sp
        where sp.organisation_id=p_organisation_id
          and sp.status='active' and sp.readiness_state='ready_now'
          and khpos_private.ops_transition_case_visible(
            p_actor_user_id,p_organisation_id,sp.staff_id
          )
      ),
      'openPromotions',(
        select count(*) from public.khpos_ops_staff_promotion_cases pc
        where pc.organisation_id=p_organisation_id
          and pc.status not in ('executed','declined','cancelled')
          and khpos_private.ops_transition_case_visible(
            p_actor_user_id,p_organisation_id,pc.staff_id
          )
      ),
      'openExits',(
        select count(*) from public.khpos_ops_staff_exit_cases ec
        where ec.organisation_id=p_organisation_id
          and ec.status not in ('ended','cancelled','closed')
          and khpos_private.ops_transition_case_visible(
            p_actor_user_id,p_organisation_id,ec.staff_id
          )
      )
    )
  );
end;
$$;

create or replace function public.khpos_ops_create_succession_plan_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid,
  p_target_role_id uuid,
  p_readiness_state text,
  p_readiness_summary text,
  p_development_priorities text default null,
  p_target_horizon date default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff public.khpos_ops_staff%rowtype;
  v_target_code text;
  v_reference text;
  v_id uuid;
begin
  if not khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the School Guardian or Vision Custodian can create succession plans.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_staff.id is null or v_staff.role_assignment_id is null then
    raise exception 'Succession planning requires an active deployed staff member.';
  end if;

  if v_staff.user_id=p_actor_user_id then
    raise exception 'A staff member cannot sponsor their own succession plan.';
  end if;

  if not khpos_private.ops_transition_valid_target(
    p_organisation_id,v_staff.desired_role_id,p_target_role_id
  ) then
    raise exception 'Succession target must be a higher role in the staff member''s actual reporting path.';
  end if;

  if p_readiness_state not in (
    'exploring','developing','ready_with_support','ready_now','not_ready'
  ) then
    raise exception 'Unsupported succession readiness state.';
  end if;

  if nullif(btrim(coalesce(p_readiness_summary,'')),'') is null then
    raise exception 'Succession readiness summary is required.';
  end if;

  select code into v_target_code
  from public.khpos_ops_roles
  where id=p_target_role_id and organisation_id=p_organisation_id;

  if v_target_code in ('SCHOOL_GUARDIAN','VISION_CUSTODIAN')
     and not khpos_private.ops_transition_actor_has_role(
       p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
     ) then
    raise exception 'School Guardian or Vision Custodian succession planning is reserved to the Vision Custodian.';
  end if;

  v_reference := 'SUC-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_succession_plans(
    organisation_id,staff_id,current_assignment_id,target_role_id,
    succession_reference,readiness_state,readiness_summary,
    development_priorities,target_horizon,external_governance_required,
    status,sponsor_user_id
  ) values (
    p_organisation_id,v_staff.id,v_staff.role_assignment_id,p_target_role_id,
    v_reference,p_readiness_state,left(btrim(p_readiness_summary),6000),
    left(nullif(btrim(coalesce(p_development_priorities,'')),''),6000),
    p_target_horizon,v_target_code='VISION_CUSTODIAN',
    'active',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,succession_plan_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'succession_plan_created',
    p_readiness_state,left(btrim(p_readiness_summary),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_update_succession_plan_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_plan_id uuid,
  p_readiness_state text,
  p_readiness_summary text,
  p_development_priorities text default null,
  p_target_horizon date default null,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_plan public.khpos_ops_staff_succession_plans%rowtype;
  v_from text;
begin
  select * into v_plan
  from public.khpos_ops_staff_succession_plans
  where id=p_plan_id and organisation_id=p_organisation_id
  for update;

  if v_plan.id is null then raise exception 'Succession plan not found.'; end if;

  if not khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the School Guardian or Vision Custodian can review succession readiness.';
  end if;

  if v_plan.status<>'active' then
    raise exception 'Only an active succession plan can be reviewed.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff s
    where s.id=v_plan.staff_id and s.user_id=p_actor_user_id
  ) then
    raise exception 'A staff member cannot review their own succession plan.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_roles r
    where r.id=v_plan.target_role_id
      and r.code in ('SCHOOL_GUARDIAN','VISION_CUSTODIAN')
  ) and not khpos_private.ops_transition_actor_has_role(
    p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
  ) then
    raise exception 'School Guardian or Vision Custodian succession review is reserved to the Vision Custodian.';
  end if;


  if p_readiness_state not in (
    'exploring','developing','ready_with_support','ready_now','not_ready'
  ) then
    raise exception 'Unsupported succession readiness state.';
  end if;

  if nullif(btrim(coalesce(p_readiness_summary,'')),'') is null then
    raise exception 'Succession readiness summary is required.';
  end if;

  v_from := v_plan.readiness_state;

  update public.khpos_ops_staff_succession_plans
  set readiness_state=p_readiness_state,
      readiness_summary=left(btrim(p_readiness_summary),6000),
      development_priorities=left(nullif(btrim(coalesce(p_development_priorities,'')),''),6000),
      target_horizon=p_target_horizon,
      reviewed_by=p_actor_user_id,
      reviewed_at=now(),
      review_note=left(nullif(btrim(coalesce(p_review_note,'')),''),4000),
      updated_at=now()
  where id=v_plan.id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,succession_plan_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_plan.id,p_actor_user_id,'succession_reviewed',
    v_from,p_readiness_state,left(nullif(btrim(coalesce(p_review_note,'')),''),4000)
  );
end;
$$;


create or replace function public.khpos_ops_succession_plan_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_plan_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_plan public.khpos_ops_staff_succession_plans%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_to text;
begin
  select * into v_plan
  from public.khpos_ops_staff_succession_plans
  where id=p_plan_id and organisation_id=p_organisation_id
  for update;

  if v_plan.id is null then raise exception 'Succession plan not found.'; end if;

  if not khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the School Guardian or Vision Custodian can change succession-plan status.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff s
    where s.id=v_plan.staff_id and s.user_id=p_actor_user_id
  ) then
    raise exception 'A staff member cannot change status on their own succession plan.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_roles r
    where r.id=v_plan.target_role_id
      and r.code in ('SCHOOL_GUARDIAN','VISION_CUSTODIAN')
  ) and not khpos_private.ops_transition_actor_has_role(
    p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
  ) then
    raise exception 'School Guardian or Vision Custodian succession status is reserved to the Vision Custodian.';
  end if;

  if p_action='withdraw' then
    if v_plan.status<>'active' then
      raise exception 'Only an active succession plan can be withdrawn.';
    end if;
    if v_note is null then raise exception 'Record why the succession plan is being withdrawn.'; end if;
    v_to := 'withdrawn';

    update public.khpos_ops_staff_succession_plans
    set status=v_to,withdrawn_at=now(),withdrawal_note=left(v_note,4000),updated_at=now()
    where id=v_plan.id;

  elsif p_action='archive' then
    if v_plan.status not in ('achieved','withdrawn') then
      raise exception 'Only achieved or withdrawn succession plans can be archived.';
    end if;
    v_to := 'archived';

    update public.khpos_ops_staff_succession_plans
    set status=v_to,updated_at=now()
    where id=v_plan.id;

  else
    raise exception 'Unsupported succession-plan action.';
  end if;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,succession_plan_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_plan.id,p_actor_user_id,
    'succession_plan_'||p_action,v_plan.status,v_to,left(v_note,4000)
  );
end;
$function$;
create or replace function public.khpos_ops_add_progression_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_parent_type text,
  p_parent_id uuid,
  p_evidence_type text,
  p_title text,
  p_note text,
  p_evidence_reference text default null,
  p_source_performance_review_id uuid default null,
  p_source_recognition_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff_id uuid;
  v_id uuid;
  v_plan_id uuid;
  v_promotion_id uuid;
begin
  if p_parent_type='succession' then
    select staff_id into v_staff_id
    from public.khpos_ops_staff_succession_plans
    where id=p_parent_id and organisation_id=p_organisation_id;
    v_plan_id := p_parent_id;
  elsif p_parent_type='promotion' then
    select staff_id into v_staff_id
    from public.khpos_ops_staff_promotion_cases
    where id=p_parent_id and organisation_id=p_organisation_id;
    v_promotion_id := p_parent_id;
  else
    raise exception 'Progression evidence parent must be succession or promotion.';
  end if;

  if v_staff_id is null then raise exception 'Progression record not found.'; end if;

  if not khpos_private.ops_transition_case_visible(
    p_actor_user_id,p_organisation_id,v_staff_id
  ) then
    raise exception 'This progression record is outside your visibility.';
  end if;

  if p_evidence_type not in (
    'performance_review','role_outcome','observation','recognition',
    'development','acting_responsibility','project','other'
  ) then
    raise exception 'Unsupported progression evidence type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'Progression evidence title and note are required.';
  end if;

  if p_source_performance_review_id is not null
     and not exists(
       select 1 from public.khpos_ops_staff_performance_reviews pr
       where pr.id=p_source_performance_review_id
         and pr.organisation_id=p_organisation_id
         and pr.staff_id=v_staff_id
         and pr.status='completed'
     ) then
    raise exception 'Linked performance review must be a completed review for this staff member.';
  end if;

  if p_source_recognition_id is not null
     and not exists(
       select 1 from public.khpos_ops_staff_recognition rec
       where rec.id=p_source_recognition_id
         and rec.organisation_id=p_organisation_id
         and rec.staff_id=v_staff_id
         and rec.withdrawn_at is null
     ) then
    raise exception 'Linked recognition must be an active recognition record for this staff member.';
  end if;

  insert into public.khpos_ops_staff_progression_evidence(
    organisation_id,succession_plan_id,promotion_case_id,evidence_type,
    title,note,evidence_reference,source_performance_review_id,
    source_recognition_id,added_by
  ) values (
    p_organisation_id,v_plan_id,v_promotion_id,p_evidence_type,
    left(btrim(p_title),240),left(btrim(p_note),6000),
    left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000),
    p_source_performance_review_id,p_source_recognition_id,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,succession_plan_id,promotion_case_id,
    actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_plan_id,v_promotion_id,p_actor_user_id,
    'progression_evidence_added',left(btrim(p_title),240),
    jsonb_build_object('evidenceId',v_id,'evidenceType',p_evidence_type)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_create_promotion_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid,
  p_target_role_id uuid,
  p_target_campus_id uuid,
  p_target_unit_id uuid,
  p_proposed_effective_date date,
  p_justification text,
  p_readiness_summary text,
  p_source_succession_plan_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff public.khpos_ops_staff%rowtype;
  v_target_code text;
  v_reference text;
  v_status text;
  v_external boolean := false;
  v_id uuid;
begin
  if not khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the School Guardian or Vision Custodian can open promotion cases.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_staff.id is null or v_staff.role_assignment_id is null or v_staff.user_id is null then
    raise exception 'Promotion requires an active deployed staff member with a linked account.';
  end if;

  if v_staff.user_id=p_actor_user_id then
    raise exception 'A staff member cannot open their own promotion case.';
  end if;

  if not khpos_private.ops_transition_valid_target(
    p_organisation_id,v_staff.desired_role_id,p_target_role_id
  ) then
    raise exception 'Promotion target must be a higher role in the staff member''s actual reporting path.';
  end if;

  if p_proposed_effective_date<current_date then
    raise exception 'Promotion effective date cannot be in the past.';
  end if;

  if nullif(btrim(coalesce(p_justification,'')),'') is null
     or nullif(btrim(coalesce(p_readiness_summary,'')),'') is null then
    raise exception 'Promotion justification and readiness summary are required.';
  end if;

  if p_target_campus_id is not null
     and not exists(
       select 1 from public.khpos_ops_campuses c
       where c.id=p_target_campus_id
         and c.organisation_id=p_organisation_id
         and c.status='active'
     ) then
    raise exception 'Target campus is not active in this organisation.';
  end if;

  if p_target_unit_id is not null
     and not exists(
       select 1 from public.khpos_ops_units u
       where u.id=p_target_unit_id
         and u.organisation_id=p_organisation_id
         and u.status='active'
     ) then
    raise exception 'Target unit is not active in this organisation.';
  end if;

  if p_source_succession_plan_id is not null
     and not exists(
       select 1
       from public.khpos_ops_staff_succession_plans sp
       where sp.id=p_source_succession_plan_id
         and sp.organisation_id=p_organisation_id
         and sp.staff_id=v_staff.id
         and sp.target_role_id=p_target_role_id
         and sp.status='active'
         and sp.readiness_state in ('ready_with_support','ready_now')
     ) then
    raise exception 'Linked succession plan must be active and at Ready With Support or Ready Now for the same target role.';
  end if;

  select code into v_target_code
  from public.khpos_ops_roles
  where id=p_target_role_id and organisation_id=p_organisation_id;

  if v_target_code in ('SCHOOL_GUARDIAN','VISION_CUSTODIAN')
     and not khpos_private.ops_transition_actor_has_role(
       p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
     ) then
    raise exception 'Only the Vision Custodian can open School Guardian or Vision Custodian progression cases.';
  end if;

  v_external := v_target_code='VISION_CUSTODIAN';
  v_status := case when v_external then 'external_governance_required' else 'awaiting_acceptance' end;
  v_reference := 'PRO-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_promotion_cases(
    organisation_id,staff_id,promotion_reference,source_succession_plan_id,
    from_assignment_id,from_role_id,target_role_id,target_campus_id,target_unit_id,
    proposed_effective_date,justification,readiness_summary,
    staff_acceptance_state,status,external_governance_required,created_by
  ) values (
    p_organisation_id,v_staff.id,v_reference,p_source_succession_plan_id,
    v_staff.role_assignment_id,v_staff.desired_role_id,p_target_role_id,
    p_target_campus_id,p_target_unit_id,p_proposed_effective_date,
    left(btrim(p_justification),6000),left(btrim(p_readiness_summary),6000),
    'pending',v_status,v_external,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,promotion_case_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'promotion_case_created',
    v_status,left(btrim(p_justification),4000)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_promotion_staff_response_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_promotion_case_id uuid,
  p_response text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_promotion_cases%rowtype;
  v_staff_user uuid;
  v_to_status text;
begin
  select * into v_case
  from public.khpos_ops_staff_promotion_cases
  where id=p_promotion_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Promotion case not found.'; end if;

  select user_id into v_staff_user
  from public.khpos_ops_staff
  where id=v_case.staff_id and organisation_id=p_organisation_id;

  if v_staff_user is distinct from p_actor_user_id then
    raise exception 'Only the staff member named in the promotion case can respond.';
  end if;

  if v_case.status not in ('awaiting_acceptance','external_governance_required') then
    raise exception 'This promotion case is not awaiting the staff member''s response.';
  end if;

  if p_response not in ('accept','decline') then
    raise exception 'Promotion response must be accept or decline.';
  end if;

  v_to_status := case
    when p_response='decline' then 'declined'
    when v_case.external_governance_required then 'external_governance_required'
    else 'under_review'
  end;

  update public.khpos_ops_staff_promotion_cases
  set staff_acceptance_state=case when p_response='accept' then 'accepted' else 'declined' end,
      staff_response_note=left(nullif(btrim(coalesce(p_note,'')),''),4000),
      staff_responded_at=now(),
      status=v_to_status,
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,promotion_case_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'promotion_staff_response',
    v_case.status,v_to_status,left(nullif(btrim(coalesce(p_note,'')),''),4000)
  );
end;
$$;

create or replace function public.khpos_ops_approve_promotion_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_promotion_case_id uuid,
  p_continuity_recipient_assignment_id uuid,
  p_target_supervisor_assignment_id uuid,
  p_approval_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_promotion_cases%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_target public.khpos_ops_roles%rowtype;
  v_continuity_user uuid;
  v_supervisor_role_id uuid;
begin
  select * into v_case
  from public.khpos_ops_staff_promotion_cases
  where id=p_promotion_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Promotion case not found.'; end if;

  if v_case.status<>'under_review'
     or v_case.staff_acceptance_state<>'accepted' then
    raise exception 'Promotion approval requires staff acceptance and an Under Review case.';
  end if;

  if not khpos_private.ops_transition_can_approve_target(
    p_actor_user_id,p_organisation_id,v_case.target_role_id
  ) then
    raise exception 'You are not the competent authority for this promotion target.';
  end if;

  if nullif(btrim(coalesce(p_approval_note,'')),'') is null then
    raise exception 'Promotion approval note is required.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_staff_progression_evidence e
    where e.promotion_case_id=v_case.id
  ) then
    raise exception 'Add at least one specific readiness evidence item before promotion approval.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_case.staff_id and organisation_id=p_organisation_id;

  select * into v_target
  from public.khpos_ops_roles
  where id=v_case.target_role_id
    and organisation_id=p_organisation_id
    and status='active';

  if not exists(
    select 1 from public.khpos_ops_role_charters rc
    where rc.role_id=v_target.id and rc.status='active'
  ) then
    raise exception 'Target role must have an active Role Charter before promotion approval.';
  end if;

  select a.user_id into v_continuity_user
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.id=p_continuity_recipient_assignment_id
    and a.status='active'
    and r.organisation_id=p_organisation_id;

  if v_continuity_user is null or v_continuity_user=v_staff.user_id then
    raise exception 'Choose an active continuity recipient other than the promoted staff member.';
  end if;

  v_supervisor_role_id := v_target.reports_to_role_id;
  if v_supervisor_role_id is null then
    raise exception 'Vision Custodian appointments require external governance and cannot be approved here.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.id=p_target_supervisor_assignment_id
      and a.role_id=v_supervisor_role_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
  ) then
    raise exception 'Target supervisor assignment must be an active assignment for the target role''s reporting line.';
  end if;

  update public.khpos_ops_staff_promotion_cases
  set continuity_recipient_assignment_id=p_continuity_recipient_assignment_id,
      target_supervisor_assignment_id=p_target_supervisor_assignment_id,
      status='approved',
      approved_by=p_actor_user_id,
      approved_at=now(),
      approval_note=left(btrim(p_approval_note),6000),
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_transition_items(
    organisation_id,promotion_case_id,item_code,item_type,title,description,
    completion_phase,mandatory,owner_user_id,recipient_assignment_id,
    due_date,status,created_by
  ) values
    (
      p_organisation_id,v_case.id,'PRO-HANDOVER','responsibility_handover',
      'Current-role responsibility handover',
      'Transfer active responsibilities, open commitments, records and known risks to the named continuity recipient before the role changes.',
      'pre_execute',true,v_staff.user_id,p_continuity_recipient_assignment_id,
      v_case.proposed_effective_date,'pending',p_actor_user_id
    ),
    (
      p_organisation_id,v_case.id,'PRO-TARGET-READY','target_role_readiness',
      'Target-role readiness confirmation',
      'Confirm the active target Role Charter, reporting line, authority boundaries, priority outcomes and first-cycle expectations have been reviewed.',
      'pre_execute',true,v_staff.user_id,p_target_supervisor_assignment_id,
      v_case.proposed_effective_date,'pending',p_actor_user_id
    )
  on conflict do nothing;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,promotion_case_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'promotion_approved',
    v_case.status,'approved',left(btrim(p_approval_note),4000)
  );
end;
$$;

create or replace function public.khpos_ops_add_transition_item_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_parent_type text,
  p_parent_id uuid,
  p_item_type text,
  p_title text,
  p_description text,
  p_owner_user_id uuid,
  p_recipient_assignment_id uuid,
  p_due_date date,
  p_mandatory boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff_id uuid;
  v_promotion_id uuid;
  v_exit_id uuid;
  v_id uuid;
  v_code text;
begin
  if not khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only People management authority can add transition requirements.';
  end if;

  if p_parent_type='promotion' then
    select staff_id into v_staff_id
    from public.khpos_ops_staff_promotion_cases
    where id=p_parent_id and organisation_id=p_organisation_id
      and status='approved';
    v_promotion_id := p_parent_id;
  elsif p_parent_type='exit' then
    select staff_id into v_staff_id
    from public.khpos_ops_staff_exit_cases
    where id=p_parent_id and organisation_id=p_organisation_id
      and status='clearance_in_progress';
    v_exit_id := p_parent_id;
  else
    raise exception 'Transition item parent must be promotion or exit.';
  end if;

  if v_staff_id is null then
    raise exception 'Transition case is not in a state that accepts new requirements.';
  end if;

  if p_item_type not in (
    'responsibility_handover','target_role_readiness','records_transfer',
    'asset_clearance','finance_admin_clearance','knowledge_capture',
    'document_control','other'
  ) then
    raise exception 'Unsupported transition item type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_description,'')),'') is null then
    raise exception 'Transition requirement title and description are required.';
  end if;

  if p_due_date<current_date then
    raise exception 'Transition requirement due date cannot be in the past.';
  end if;

  if not exists(
    select 1 from public.organisation_memberships m
    where m.organisation_id=p_organisation_id
      and m.user_id=p_owner_user_id
      and m.status='active'
  ) then
    raise exception 'Transition requirement owner must have active organisation access.';
  end if;

  if p_recipient_assignment_id is not null
     and not exists(
       select 1
       from public.khpos_ops_role_assignments a
       join public.khpos_ops_roles r on r.id=a.role_id
       where a.id=p_recipient_assignment_id
         and a.status='active'
         and r.organisation_id=p_organisation_id
     ) then
    raise exception 'Transition recipient assignment must be active in this organisation.';
  end if;

  v_code := 'TRN-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_transition_items(
    organisation_id,promotion_case_id,exit_case_id,item_code,item_type,
    title,description,completion_phase,mandatory,owner_user_id,
    recipient_assignment_id,due_date,status,created_by
  ) values (
    p_organisation_id,v_promotion_id,v_exit_id,v_code,p_item_type,
    left(btrim(p_title),240),left(btrim(p_description),6000),
    'pre_execute',coalesce(p_mandatory,true),p_owner_user_id,
    p_recipient_assignment_id,p_due_date,'pending',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,promotion_case_id,exit_case_id,transition_item_id,
    actor_user_id,event_type,note
  ) values (
    p_organisation_id,v_promotion_id,v_exit_id,v_id,p_actor_user_id,
    'transition_item_added',left(btrim(p_title),240)
  );

  return v_id;
end;
$$;

create or replace function public.khpos_ops_transition_item_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_item_id uuid,
  p_action text,
  p_note text default null,
  p_evidence_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_item public.khpos_ops_staff_transition_items%rowtype;
  v_staff_id uuid;
  v_can_manage boolean;
  v_is_owner boolean;
  v_from text;
  v_to text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
begin
  select * into v_item
  from public.khpos_ops_staff_transition_items
  where id=p_item_id and organisation_id=p_organisation_id
  for update;

  if v_item.id is null then raise exception 'Transition requirement not found.'; end if;

  if v_item.promotion_case_id is not null then
    select staff_id into v_staff_id
    from public.khpos_ops_staff_promotion_cases
    where id=v_item.promotion_case_id;
  else
    select staff_id into v_staff_id
    from public.khpos_ops_staff_exit_cases
    where id=v_item.exit_case_id;
  end if;

  if v_item.exit_case_id is not null then
    v_can_manage := khpos_private.ops_transition_can_manage_exit(
      p_actor_user_id,p_organisation_id,v_staff_id
    );
  else
    v_can_manage := khpos_private.ops_transition_can_manage_people(
      p_actor_user_id,p_organisation_id
    );
  end if;
  v_is_owner := v_item.owner_user_id=p_actor_user_id;
  v_from := v_item.status;

  if v_item.completion_phase='at_execute' then
    raise exception 'This transition requirement is completed automatically by the execution step.';
  end if;

  if p_action='start' then
    if not v_is_owner then raise exception 'Only the requirement owner can start this work.'; end if;
    if v_item.status<>'pending' then raise exception 'Only a pending transition requirement can be started.'; end if;
    v_to := 'in_progress';
    update public.khpos_ops_staff_transition_items
    set status=v_to,updated_at=now()
    where id=v_item.id;

  elsif p_action='submit_evidence' then
    if not v_is_owner then raise exception 'Only the requirement owner can submit transition evidence.'; end if;
    if v_item.status not in ('pending','in_progress') then
      raise exception 'Only pending or in-progress transition work can submit evidence.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Completion note and evidence reference are required.';
    end if;
    v_to := 'evidence_submitted';
    update public.khpos_ops_staff_transition_items
    set status=v_to,completion_note=left(v_note,6000),
        evidence_reference=left(v_evidence,1000),
        submitted_by=p_actor_user_id,submitted_at=now(),updated_at=now()
    where id=v_item.id;

  elsif p_action='verify' then
    if not v_can_manage then raise exception 'Only People management authority can verify transition work.'; end if;
    if v_item.status<>'evidence_submitted' then raise exception 'Only submitted transition evidence can be verified.'; end if;
    if v_item.owner_user_id=p_actor_user_id then
      raise exception 'The transition item owner cannot verify their own completion.';
    end if;
    v_to := 'verified';
    update public.khpos_ops_staff_transition_items
    set status=v_to,verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
    where id=v_item.id;

  elsif p_action='reopen' then
    if not v_can_manage then raise exception 'Only People management authority can reopen transition work.'; end if;
    if v_item.status not in ('evidence_submitted','verified','waived') then
      raise exception 'Only submitted, verified or waived transition work can be reopened.';
    end if;
    if v_note is null then raise exception 'Explain why the transition requirement is being reopened.'; end if;
    v_to := 'in_progress';
    update public.khpos_ops_staff_transition_items
    set status=v_to,verified_by=null,verified_at=null,
        waived_by=null,waived_at=null,waiver_reason=null,updated_at=now()
    where id=v_item.id;

  elsif p_action='waive' then
    if not v_can_manage then raise exception 'Only People management authority can waive a transition requirement.'; end if;
    if v_item.item_type in ('responsibility_handover','access_revocation') then
      raise exception 'Responsibility handover and access closure are non-waivable continuity controls.';
    end if;
    if not v_item.mandatory then
      raise exception 'Optional requirements can be removed operationally rather than formally waived.';
    end if;
    if v_note is null then raise exception 'A documented waiver reason is required.'; end if;
    v_to := 'waived';
    update public.khpos_ops_staff_transition_items
    set status=v_to,waived_by=p_actor_user_id,waived_at=now(),
        waiver_reason=left(v_note,6000),updated_at=now()
    where id=v_item.id;

  else
    raise exception 'Unsupported transition requirement action.';
  end if;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,promotion_case_id,exit_case_id,transition_item_id,
    actor_user_id,event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_item.promotion_case_id,v_item.exit_case_id,
    v_item.id,p_actor_user_id,'transition_item_'||p_action,
    v_from,v_to,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence)
  );
end;
$$;

create or replace function public.khpos_ops_execute_promotion_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_promotion_case_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_promotion_cases%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_old_assignment public.khpos_ops_role_assignments%rowtype;
  v_target public.khpos_ops_roles%rowtype;
  v_new_assignment uuid;
  v_effective date;
  v_old_end date;
begin
  select * into v_case
  from public.khpos_ops_staff_promotion_cases
  where id=p_promotion_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Promotion case not found.'; end if;

  if v_case.status<>'approved' then
    raise exception 'Only an approved promotion case can be executed.';
  end if;

  if not khpos_private.ops_transition_can_approve_target(
    p_actor_user_id,p_organisation_id,v_case.target_role_id
  ) then
    raise exception 'You are not the competent authority to execute this promotion.';
  end if;

  v_effective := v_case.proposed_effective_date;
  if current_date<v_effective then
    raise exception 'Promotion cannot execute before its approved effective date.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff_transition_items ti
    where ti.promotion_case_id=v_case.id
      and ti.mandatory
      and ti.completion_phase='pre_execute'
      and ti.status not in ('verified','waived')
  ) then
    raise exception 'Verify or formally waive every mandatory pre-promotion transition requirement first.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_staff_transition_items ti
    where ti.promotion_case_id=v_case.id
      and ti.item_type='responsibility_handover'
      and ti.recipient_assignment_id is not null
      and ti.status='verified'
  ) then
    raise exception 'Promotion requires a completed responsibility handover to a named continuity recipient.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_case.staff_id and organisation_id=p_organisation_id
  for update;

  if v_staff.id is null or v_staff.status<>'active'
     or v_staff.role_assignment_id is distinct from v_case.from_assignment_id then
    raise exception 'Staff role state changed after the promotion case opened; re-review the transition.';
  end if;

  select * into v_old_assignment
  from public.khpos_ops_role_assignments
  where id=v_case.from_assignment_id and status='active'
  for update;

  if v_old_assignment.id is null then
    raise exception 'Current role assignment is no longer active.';
  end if;

  select * into v_target
  from public.khpos_ops_roles
  where id=v_case.target_role_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_target.id is null or v_target.code='VISION_CUSTODIAN' then
    raise exception 'Vision Custodian appointment requires external governance and cannot execute through internal O11.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_role_assignments a
    where a.id=v_case.target_supervisor_assignment_id
      and a.role_id=v_target.reports_to_role_id
      and a.status='active'
  ) then
    raise exception 'Approved target reporting line is no longer active.';
  end if;

  update public.khpos_ops_role_assignments a
  set primary_assignment=false,updated_at=now()
  from public.khpos_ops_roles r
  where a.role_id=r.id
    and r.organisation_id=p_organisation_id
    and a.user_id=v_staff.user_id
    and a.status='active'
    and a.primary_assignment;

  v_old_end := greatest(v_old_assignment.start_date,v_effective-1);

  update public.khpos_ops_role_assignments
  set status='ended',
      primary_assignment=false,
      end_date=v_old_end,
      updated_at=now()
  where id=v_old_assignment.id;

  update public.khpos_ops_reporting_lines
  set effective_to=v_old_end
  where effective_to is null
    and (
      subordinate_assignment_id=v_old_assignment.id
      or supervisor_assignment_id=v_old_assignment.id
    );

  update public.khpos_ops_backup_assignments
  set status='ended',
      effective_to=v_old_end
  where status='active'
    and (
      primary_assignment_id=v_old_assignment.id
      or backup_assignment_id=v_old_assignment.id
    );

  insert into public.khpos_ops_role_assignments(
    role_id,user_id,campus_id,unit_id,primary_assignment,status,
    start_date,appointed_by
  ) values (
    v_case.target_role_id,v_staff.user_id,
    v_case.target_campus_id,v_case.target_unit_id,
    true,'active',v_effective,p_actor_user_id
  ) returning id into v_new_assignment;

  insert into public.khpos_ops_reporting_lines(
    subordinate_assignment_id,supervisor_assignment_id,
    relationship_type,effective_from
  ) values (
    v_new_assignment,v_case.target_supervisor_assignment_id,
    'primary',v_effective
  );

  update public.khpos_ops_staff
  set desired_role_id=v_case.target_role_id,
      campus_id=v_case.target_campus_id,
      unit_id=v_case.target_unit_id,
      role_assignment_id=v_new_assignment,
      updated_at=now()
  where id=v_staff.id;

  update public.khpos_ops_staff_promotion_cases
  set status='executed',
      executed_by=p_actor_user_id,
      executed_at=now(),
      new_assignment_id=v_new_assignment,
      updated_at=now()
  where id=v_case.id;

  if v_case.source_succession_plan_id is not null then
    update public.khpos_ops_staff_succession_plans
    set status='achieved',achieved_at=now(),updated_at=now()
    where id=v_case.source_succession_plan_id
      and status='active';
  end if;

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff.id,p_actor_user_id,'staff_promoted',
    'Approved role progression executed after verified transition handover.',
    jsonb_build_object(
      'fromAssignmentId',v_old_assignment.id,
      'newAssignmentId',v_new_assignment,
      'targetRoleId',v_case.target_role_id,
      'effectiveDate',v_effective
    )
  );

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,promotion_case_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'promotion_executed',
    v_case.status,'executed','Role assignment changed after verified handover.',
    jsonb_build_object('newAssignmentId',v_new_assignment)
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_promotion_executed',
    'staff',v_staff.id,
    jsonb_build_object(
      'promotionCaseId',v_case.id,
      'oldAssignmentId',v_old_assignment.id,
      'newAssignmentId',v_new_assignment
    )
  );

  return v_new_assignment;
end;
$$;

create or replace function public.khpos_ops_create_exit_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid,
  p_exit_type text,
  p_proposed_last_day date,
  p_basis_reference text,
  p_reason_note text default null,
  p_authority_review_reference text default null,
  p_source_accountability_case_id uuid default null,
  p_replacement_required boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff public.khpos_ops_staff%rowtype;
  v_role_code text;
  v_is_self boolean;
  v_reference text;
  v_id uuid;
begin
  if not khpos_private.ops_transition_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_staff.id is null or v_staff.role_assignment_id is null or v_staff.user_id is null then
    raise exception 'Exit requires an active deployed staff member with a linked account.';
  end if;

  v_is_self := v_staff.user_id=p_actor_user_id;

  if v_is_self then
    if p_exit_type not in ('resignation','retirement') then
      raise exception 'Staff self-service can only submit resignation or retirement notice.';
    end if;
  elsif not khpos_private.ops_transition_can_manage_exit(
    p_actor_user_id,p_organisation_id,v_staff.id
  ) then
    raise exception 'You are not the competent authority to initiate this staff exit.';
  end if;

  if p_exit_type not in (
    'resignation','retirement','contract_end','mutual_agreement',
    'redundancy','termination','dismissal','other'
  ) then
    raise exception 'Unsupported exit type.';
  end if;

  if p_proposed_last_day<current_date then
    raise exception 'Proposed last day cannot be in the past.';
  end if;

  if nullif(btrim(coalesce(p_basis_reference,'')),'') is null then
    raise exception 'Notice, agreement, contract or other exit basis reference is required.';
  end if;

  select r.code into v_role_code
  from public.khpos_ops_roles r
  where r.id=v_staff.desired_role_id and r.organisation_id=p_organisation_id;

  if v_role_code='VISION_CUSTODIAN' then
    raise exception 'Vision Custodian exit requires external company governance and cannot be initiated through internal school O11.';
  end if;

  if p_exit_type in ('mutual_agreement','redundancy','termination','dismissal','other')
     and nullif(btrim(coalesce(p_authority_review_reference,'')),'') is null then
    raise exception 'This exit type requires a contract/legal/authority review or agreement reference.';
  end if;

  if p_exit_type='dismissal' then
    if p_source_accountability_case_id is null
       or not exists(
         select 1
         from public.khpos_ops_staff_accountability_cases ac
         where ac.id=p_source_accountability_case_id
           and ac.organisation_id=p_organisation_id
           and ac.subject_staff_id=v_staff.id
           and ac.case_type='formal_discipline'
           and ac.outcome='refer_separation_review'
           and ac.status in ('decision_recorded','closed')
       ) then
      raise exception 'Dismissal exit requires a formal O10 separation-review case for the same staff member.';
    end if;
  end if;

  v_reference := 'EXT-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_exit_cases(
    organisation_id,staff_id,affected_assignment_id,exit_reference,exit_type,
    proposed_last_day,basis_reference,authority_review_reference,
    source_accountability_case_id,reason_note,initiated_by_staff,
    replacement_required,status,initiated_by
  ) values (
    p_organisation_id,v_staff.id,v_staff.role_assignment_id,v_reference,p_exit_type,
    p_proposed_last_day,left(btrim(p_basis_reference),1000),
    left(nullif(btrim(coalesce(p_authority_review_reference,'')),''),1000),
    p_source_accountability_case_id,
    left(nullif(btrim(coalesce(p_reason_note,'')),''),4000),
    v_is_self,coalesce(p_replacement_required,true),'open',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,exit_case_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'exit_case_created',
    'open',left(nullif(btrim(coalesce(p_reason_note,'')),''),4000)
  );

  return v_id;
end;
$$;


create or replace function public.khpos_ops_update_exit_schedule_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_exit_case_id uuid,
  p_proposed_last_day date,
  p_basis_reference text,
  p_authority_review_reference text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_case public.khpos_ops_staff_exit_cases%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_authority text := nullif(btrim(coalesce(p_authority_review_reference,'')),'');
begin
  select * into v_case
  from public.khpos_ops_staff_exit_cases
  where id=p_exit_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Exit case not found.'; end if;

  if not khpos_private.ops_transition_can_manage_exit(
    p_actor_user_id,p_organisation_id,v_case.staff_id
  ) then
    raise exception 'You are not the competent authority to revise this acknowledged exit schedule.';
  end if;

  if v_case.status not in ('open','clearance_in_progress') then
    raise exception 'Only an open or in-clearance exit can revise its recorded schedule.';
  end if;

  if p_proposed_last_day<current_date then
    raise exception 'Revised last day cannot be in the past.';
  end if;

  if nullif(btrim(coalesce(p_basis_reference,'')),'') is null then
    raise exception 'Revised notice/agreement/contract basis reference is required.';
  end if;

  if v_case.exit_type in ('mutual_agreement','redundancy','termination','dismissal','other')
     and coalesce(v_authority,nullif(btrim(coalesce(v_case.authority_review_reference,'')),'')) is null then
    raise exception 'This exit type requires the applicable authority/legal/agreement reference.';
  end if;

  update public.khpos_ops_staff_exit_cases
  set proposed_last_day=p_proposed_last_day,
      basis_reference=left(btrim(p_basis_reference),1000),
      authority_review_reference=coalesce(left(v_authority,1000),authority_review_reference),
      updated_at=now()
  where id=v_case.id;

  update public.khpos_ops_staff_transition_items
  set due_date=p_proposed_last_day,updated_at=now()
  where exit_case_id=v_case.id
    and status in ('pending','in_progress','evidence_submitted');

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,exit_case_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'exit_schedule_updated',
    left(v_note,4000),
    jsonb_build_object(
      'fromLastDay',v_case.proposed_last_day,
      'toLastDay',p_proposed_last_day,
      'basisReference',left(btrim(p_basis_reference),1000)
    )
  );
end;
$function$;
create or replace function public.khpos_ops_start_exit_clearance_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_exit_case_id uuid,
  p_continuity_recipient_assignment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_exit_cases%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_recipient_user uuid;
begin
  select * into v_case
  from public.khpos_ops_staff_exit_cases
  where id=p_exit_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Exit case not found.'; end if;

  if v_case.status<>'open' then
    raise exception 'Only an open exit case can start clearance.';
  end if;

  if not khpos_private.ops_transition_can_manage_exit(
    p_actor_user_id,p_organisation_id,v_case.staff_id
  ) then
    raise exception 'You are not the competent authority to acknowledge this exit and start clearance.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_case.staff_id and organisation_id=p_organisation_id
  for update;

  if v_staff.status<>'active' then
    raise exception 'Staff state changed after the exit case opened.';
  end if;

  select a.user_id into v_recipient_user
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.id=p_continuity_recipient_assignment_id
    and a.status='active'
    and r.organisation_id=p_organisation_id;

  if v_recipient_user is null or v_recipient_user=v_staff.user_id then
    raise exception 'Choose an active continuity recipient other than the exiting staff member.';
  end if;

  update public.khpos_ops_staff_exit_cases
  set continuity_recipient_assignment_id=p_continuity_recipient_assignment_id,
      status='clearance_in_progress',
      clearance_started_by=p_actor_user_id,
      clearance_started_at=now(),
      updated_at=now()
  where id=v_case.id;

  update public.khpos_ops_staff
  set status='exiting',updated_at=now()
  where id=v_staff.id;

  insert into public.khpos_ops_staff_transition_items(
    organisation_id,exit_case_id,item_code,item_type,title,description,
    completion_phase,mandatory,owner_user_id,recipient_assignment_id,
    due_date,status,created_by
  ) values
    (
      p_organisation_id,v_case.id,'EXT-HANDOVER','responsibility_handover',
      'Responsibilities & open commitments handover',
      'Transfer current responsibilities, open commitments, deadlines, known risks and recurring obligations to the named continuity recipient.',
      'pre_execute',true,v_staff.user_id,p_continuity_recipient_assignment_id,
      v_case.proposed_last_day,'pending',p_actor_user_id
    ),
    (
      p_organisation_id,v_case.id,'EXT-RECORDS','records_transfer',
      'Institutional records transfer',
      'Transfer institutional records, files, working documents and controlled records required for continuity without copying private data unnecessarily.',
      'pre_execute',true,v_staff.user_id,p_continuity_recipient_assignment_id,
      v_case.proposed_last_day,'pending',p_actor_user_id
    ),
    (
      p_organisation_id,v_case.id,'EXT-ASSETS','asset_clearance',
      'Assets & property clearance',
      'Return or account for school assets, keys, devices, equipment, materials and other issued property through the applicable asset records.',
      'pre_execute',true,v_staff.user_id,null,
      v_case.proposed_last_day,'pending',p_actor_user_id
    ),
    (
      p_organisation_id,v_case.id,'EXT-FINANCE','finance_admin_clearance',
      'Finance/Admin clearance',
      'Record the external Finance/Admin clearance reference. KHP-OS does not calculate final pay, notice pay, benefits, deductions or entitlements.',
      'pre_execute',true,v_staff.user_id,null,
      v_case.proposed_last_day,'pending',p_actor_user_id
    ),
    (
      p_organisation_id,v_case.id,'EXT-KNOWLEDGE','knowledge_capture',
      'Knowledge capture',
      'Capture important institutional knowledge, lessons, stakeholder context and unresolved risks that the next owner needs.',
      'pre_execute',true,v_staff.user_id,p_continuity_recipient_assignment_id,
      v_case.proposed_last_day,'pending',p_actor_user_id
    ),
    (
      p_organisation_id,v_case.id,'EXT-DOCUMENT','document_control',
      'Exit documentation control',
      'Confirm required exit notices, agreements, acknowledgements or other controlled documents are filed under the correct institutional record.',
      'pre_execute',true,v_staff.user_id,null,
      v_case.proposed_last_day,'pending',p_actor_user_id
    ),
    (
      p_organisation_id,v_case.id,'EXT-ACCESS','access_revocation',
      'Operating access closure',
      'End active KNS operating-role assignments and organisation access at the execution step without deleting the underlying user account.',
      'at_execute',true,v_staff.user_id,null,
      v_case.proposed_last_day,'pending',p_actor_user_id
    )
  on conflict do nothing;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,exit_case_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'exit_clearance_started',
    v_case.status,'clearance_in_progress',
    'Exit notice/basis acknowledged and continuity clearance started.'
  );

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff.id,p_actor_user_id,'staff_exit_started',
    'Staff moved to exiting state after the exit basis was acknowledged.',
    jsonb_build_object('exitCaseId',v_case.id,'proposedLastDay',v_case.proposed_last_day)
  );
end;
$$;

create or replace function public.khpos_ops_finalize_staff_exit_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_exit_case_id uuid
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_exit_cases%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_role_code text;
  v_assignment_ids uuid[];
begin
  select * into v_case
  from public.khpos_ops_staff_exit_cases
  where id=p_exit_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Exit case not found.'; end if;

  if v_case.status<>'clearance_in_progress' then
    raise exception 'Exit must be in clearance before it can be finalized.';
  end if;

  if not khpos_private.ops_transition_can_manage_exit(
    p_actor_user_id,p_organisation_id,v_case.staff_id
  ) then
    raise exception 'You are not the competent authority to finalize this staff exit.';
  end if;

  if current_date<v_case.proposed_last_day then
    raise exception 'Staff exit cannot be finalized before the recorded last day.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff_transition_items ti
    where ti.exit_case_id=v_case.id
      and ti.mandatory
      and ti.completion_phase='pre_execute'
      and ti.status not in ('verified','waived')
  ) then
    raise exception 'Verify or formally waive every mandatory pre-exit clearance requirement first.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_staff_transition_items ti
    where ti.exit_case_id=v_case.id
      and ti.item_type='responsibility_handover'
      and ti.recipient_assignment_id is not null
      and ti.status='verified'
  ) then
    raise exception 'Exit requires a verified responsibility handover to the named continuity recipient.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_case.staff_id and organisation_id=p_organisation_id
  for update;

  if v_staff.id is null or v_staff.status<>'exiting' then
    raise exception 'Staff state changed after clearance started.';
  end if;

  select r.code into v_role_code
  from public.khpos_ops_roles r
  where r.id=v_staff.desired_role_id and r.organisation_id=p_organisation_id;

  if v_role_code='VISION_CUSTODIAN' then
    raise exception 'Vision Custodian exit requires external company governance and cannot execute through internal school O11.';
  end if;

  select coalesce(array_agg(a.id),'{}'::uuid[]) into v_assignment_ids
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.user_id=v_staff.user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id;

  update public.khpos_ops_reporting_lines
  set effective_to=current_date
  where effective_to is null
    and (
      subordinate_assignment_id=any(v_assignment_ids)
      or supervisor_assignment_id=any(v_assignment_ids)
    );

  update public.khpos_ops_backup_assignments
  set status='ended',effective_to=current_date
  where status='active'
    and (
      primary_assignment_id=any(v_assignment_ids)
      or backup_assignment_id=any(v_assignment_ids)
    );

  update public.khpos_ops_role_assignments a
  set status='ended',
      primary_assignment=false,
      end_date=greatest(a.start_date,current_date),
      updated_at=now()
  from public.khpos_ops_roles r
  where a.role_id=r.id
    and r.organisation_id=p_organisation_id
    and a.user_id=v_staff.user_id
    and a.status='active';

  update public.organisation_memberships
  set status='ended',updated_at=now()
  where organisation_id=p_organisation_id
    and user_id=v_staff.user_id
    and status='active';

  update public.khpos_ops_staff
  set status='ended',updated_at=now()
  where id=v_staff.id;

  update public.khpos_ops_staff_transition_items
  set status='verified',
      completion_note='Organisation operating access and active KNS role assignments were closed by the O11 exit execution.',
      evidence_reference='system://khpos/o11/access-closed',
      submitted_by=p_actor_user_id,
      submitted_at=now(),
      verified_by=p_actor_user_id,
      verified_at=now(),
      updated_at=now()
  where exit_case_id=v_case.id
    and item_type='access_revocation'
    and completion_phase='at_execute';

  update public.khpos_ops_staff_exit_cases
  set status='ended',
      actual_last_day=current_date,
      ended_by=p_actor_user_id,
      ended_at=now(),
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,exit_case_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'staff_exit_finalized',
    v_case.status,'ended',
    'Mandatory pre-exit clearance verified; operating assignments and organisation access ended.',
    jsonb_build_object('endedAssignmentIds',v_assignment_ids)
  );

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff.id,p_actor_user_id,'staff_ended',
    'Staff exit finalized after verified clearance and handover.',
    jsonb_build_object('exitCaseId',v_case.id,'actualLastDay',current_date)
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_exit_finalized',
    'staff',v_staff.id,
    jsonb_build_object('exitCaseId',v_case.id,'endedAssignmentIds',v_assignment_ids)
  );
end;
$$;

create or replace function public.khpos_ops_exit_case_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_exit_case_id uuid,
  p_action text,
  p_note text default null,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_exit_cases%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_is_self boolean;
  v_can_manage boolean;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_reference text := nullif(btrim(coalesce(p_reference,'')),'');
begin
  select * into v_case
  from public.khpos_ops_staff_exit_cases
  where id=p_exit_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Exit case not found.'; end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_case.staff_id and organisation_id=p_organisation_id;

  v_is_self := v_staff.user_id=p_actor_user_id;
  v_can_manage := khpos_private.ops_transition_can_manage_exit(
    p_actor_user_id,p_organisation_id,v_case.staff_id
  );

  if p_action='withdraw_request' then
    if not v_is_self or not v_case.initiated_by_staff or v_case.status<>'open' then
      raise exception 'Only the staff member who submitted an unacknowledged exit request can withdraw it.';
    end if;
    if v_note is null then raise exception 'Record why the exit request is being withdrawn.'; end if;

    update public.khpos_ops_staff_exit_cases
    set status='cancelled',cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_case.id;

  elsif p_action='cancel' then
    if not v_can_manage then raise exception 'Only People management authority can cancel an exit case after acknowledgement.'; end if;
    if v_case.status not in ('open','clearance_in_progress') then
      raise exception 'Only an open or in-clearance exit case can be cancelled.';
    end if;
    if v_note is null or v_reference is null then
      raise exception 'Cancellation reason and authority/agreement reference are required.';
    end if;

    update public.khpos_ops_staff_exit_cases
    set status='cancelled',cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),
        cancellation_reference=left(v_reference,1000),
        updated_at=now()
    where id=v_case.id;

    update public.khpos_ops_staff
    set status='active',updated_at=now()
    where id=v_case.staff_id and status='exiting';

  elsif p_action='close' then
    if not v_can_manage then raise exception 'Only People management authority can close a completed exit case.'; end if;
    if v_case.status<>'ended' then raise exception 'Only an ended exit case can be closed.'; end if;

    update public.khpos_ops_staff_exit_cases
    set status='closed',closed_by=p_actor_user_id,closed_at=now(),updated_at=now()
    where id=v_case.id;

  else
    raise exception 'Unsupported exit case action.';
  end if;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,exit_case_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'exit_case_'||p_action,
    v_case.status,
    (select status from public.khpos_ops_staff_exit_cases where id=v_case.id),
    left(v_note,4000),jsonb_build_object('reference',v_reference)
  );
end;
$$;

create or replace function public.khpos_ops_promotion_case_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_promotion_case_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_promotion_cases%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_case
  from public.khpos_ops_staff_promotion_cases
  where id=p_promotion_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Promotion case not found.'; end if;

  if p_action='cancel' then
    if not khpos_private.ops_transition_can_manage_people(
      p_actor_user_id,p_organisation_id
    ) then
      raise exception 'Only People management authority can cancel a promotion case.';
    end if;
    if v_case.status in ('executed','declined','cancelled') then
      raise exception 'This promotion case can no longer be cancelled.';
    end if;
    if v_note is null then raise exception 'Promotion cancellation reason is required.'; end if;

    update public.khpos_ops_staff_promotion_cases
    set status='cancelled',cancelled_by=p_actor_user_id,cancelled_at=now(),
        cancellation_note=left(v_note,4000),updated_at=now()
    where id=v_case.id;
  else
    raise exception 'Unsupported promotion case action.';
  end if;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,promotion_case_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'promotion_case_'||p_action,
    v_case.status,
    (select status from public.khpos_ops_staff_promotion_cases where id=v_case.id),
    left(v_note,4000)
  );
end;
$$;

revoke execute on function khpos_private.ops_transition_has_membership(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_transition_actor_has_role(uuid,uuid,text)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_transition_staff_for_user(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_transition_can_manage_people(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_transition_can_manage_exit(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_transition_valid_target(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_transition_can_approve_target(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_transition_case_visible(uuid,uuid,uuid)
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_staff_transition_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_succession_plan_server(uuid,uuid,uuid,uuid,text,text,text,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_update_succession_plan_server(uuid,uuid,uuid,text,text,text,date,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_succession_plan_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_progression_evidence_server(uuid,uuid,text,uuid,text,text,text,text,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_promotion_case_server(uuid,uuid,uuid,uuid,uuid,uuid,date,text,text,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_promotion_staff_response_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_approve_promotion_server(uuid,uuid,uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_transition_item_server(uuid,uuid,text,uuid,text,text,text,uuid,uuid,date,boolean)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_transition_item_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_execute_promotion_server(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_exit_case_server(uuid,uuid,uuid,text,date,text,text,text,uuid,boolean)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_update_exit_schedule_server(uuid,uuid,uuid,date,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_start_exit_clearance_server(uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_finalize_staff_exit_server(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_exit_case_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_promotion_case_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_transition_has_membership(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_transition_actor_has_role(uuid,uuid,text) to service_role;
grant execute on function khpos_private.ops_transition_staff_for_user(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_transition_can_manage_people(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_transition_can_manage_exit(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_transition_valid_target(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_transition_can_approve_target(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_transition_case_visible(uuid,uuid,uuid) to service_role;

grant execute on function public.khpos_ops_get_staff_transition_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_succession_plan_server(uuid,uuid,uuid,uuid,text,text,text,date) to service_role;
grant execute on function public.khpos_ops_update_succession_plan_server(uuid,uuid,uuid,text,text,text,date,text) to service_role;
grant execute on function public.khpos_ops_succession_plan_action_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_add_progression_evidence_server(uuid,uuid,text,uuid,text,text,text,text,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_promotion_case_server(uuid,uuid,uuid,uuid,uuid,uuid,date,text,text,uuid) to service_role;
grant execute on function public.khpos_ops_promotion_staff_response_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_approve_promotion_server(uuid,uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.khpos_ops_add_transition_item_server(uuid,uuid,text,uuid,text,text,text,uuid,uuid,date,boolean) to service_role;
grant execute on function public.khpos_ops_transition_item_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_execute_promotion_server(uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_exit_case_server(uuid,uuid,uuid,text,date,text,text,text,uuid,boolean) to service_role;
grant execute on function public.khpos_ops_update_exit_schedule_server(uuid,uuid,uuid,date,text,text,text) to service_role;
grant execute on function public.khpos_ops_start_exit_clearance_server(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_finalize_staff_exit_server(uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_exit_case_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_promotion_case_action_server(uuid,uuid,uuid,text,text) to service_role;
