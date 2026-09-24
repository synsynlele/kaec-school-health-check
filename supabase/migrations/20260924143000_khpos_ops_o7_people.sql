create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_staff (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_reference text not null,
  display_name text not null,
  account_email text not null,
  user_id uuid references auth.users(id) on delete set null,
  employment_type text not null default 'employee'
    check (employment_type in ('employee','facilitator','contractor','volunteer','intern','temporary')),
  desired_role_id uuid not null references public.khpos_ops_roles(id) on delete restrict,
  campus_id uuid references public.khpos_ops_campuses(id) on delete set null,
  unit_id uuid references public.khpos_ops_units(id) on delete set null,
  start_date date not null,
  onboarding_due_date date not null,
  probation_review_date date,
  status text not null default 'onboarding'
    check (status in ('onboarding','ready','active','inactive','exiting','ended')),
  role_assignment_id uuid references public.khpos_ops_role_assignments(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (probation_review_date is null or probation_review_date >= start_date),
  unique (organisation_id,staff_reference)
);

create unique index if not exists uq_khpos_ops_staff_org_email_current
  on public.khpos_ops_staff(organisation_id,lower(account_email))
  where status <> 'ended';
create index if not exists idx_khpos_ops_staff_org_status
  on public.khpos_ops_staff(organisation_id,status,start_date);
create index if not exists idx_khpos_ops_staff_role
  on public.khpos_ops_staff(desired_role_id,status);
create index if not exists idx_khpos_ops_staff_user
  on public.khpos_ops_staff(user_id) where user_id is not null;
create index if not exists idx_khpos_ops_staff_campus
  on public.khpos_ops_staff(campus_id,status) where campus_id is not null;
create index if not exists idx_khpos_ops_staff_unit
  on public.khpos_ops_staff(unit_id,status) where unit_id is not null;
create index if not exists idx_khpos_ops_staff_role_assignment
  on public.khpos_ops_staff(role_assignment_id) where role_assignment_id is not null;

create table if not exists public.khpos_ops_onboarding_requirements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  title text not null,
  description text not null,
  category text not null,
  mandatory boolean not null default true,
  waivable boolean not null default false,
  evidence_required boolean not null default false,
  applicable_role_codes text[] not null default '{}'::text[],
  sort_order integer not null default 100,
  status text not null default 'active' check (status in ('active','inactive','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id,code)
);

create index if not exists idx_khpos_ops_onboarding_requirements_org
  on public.khpos_ops_onboarding_requirements(organisation_id,status,sort_order);
create index if not exists idx_khpos_ops_onboarding_requirements_created_by
  on public.khpos_ops_onboarding_requirements(created_by) where created_by is not null;

create table if not exists public.khpos_ops_staff_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  source_requirement_id uuid references public.khpos_ops_onboarding_requirements(id) on delete set null,
  requirement_code text not null,
  title text not null,
  description text not null,
  category text not null,
  mandatory boolean not null,
  waivable boolean not null,
  evidence_required boolean not null,
  status text not null default 'pending'
    check (status in ('pending','submitted','completed','waived')),
  submission_note text,
  evidence_reference text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id,requirement_code)
);

create index if not exists idx_khpos_ops_staff_onboarding_staff_status
  on public.khpos_ops_staff_onboarding_items(staff_id,status,mandatory);
create index if not exists idx_khpos_ops_staff_onboarding_org
  on public.khpos_ops_staff_onboarding_items(organisation_id,status);
create index if not exists idx_khpos_ops_staff_onboarding_source
  on public.khpos_ops_staff_onboarding_items(source_requirement_id)
  where source_requirement_id is not null;
create index if not exists idx_khpos_ops_staff_onboarding_submitter
  on public.khpos_ops_staff_onboarding_items(submitted_by) where submitted_by is not null;
create index if not exists idx_khpos_ops_staff_onboarding_reviewer
  on public.khpos_ops_staff_onboarding_items(reviewed_by) where reviewed_by is not null;

create table if not exists public.khpos_ops_staff_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_staff_events_staff
  on public.khpos_ops_staff_events(staff_id,created_at desc);
create index if not exists idx_khpos_ops_staff_events_actor
  on public.khpos_ops_staff_events(actor_user_id,created_at desc)
  where actor_user_id is not null;

alter table public.khpos_ops_staff enable row level security;
alter table public.khpos_ops_onboarding_requirements enable row level security;
alter table public.khpos_ops_staff_onboarding_items enable row level security;
alter table public.khpos_ops_staff_events enable row level security;

revoke all privileges on table public.khpos_ops_staff from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_onboarding_requirements from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_onboarding_items from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_staff to service_role;
grant select,insert,update,delete on table public.khpos_ops_onboarding_requirements to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_onboarding_items to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_events to service_role;

create or replace function khpos_private.ops_can_manage_people(
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
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('VISION_CUSTODIAN','SCHOOL_GUARDIAN')
  );
$$;

create or replace function khpos_private.ops_can_review_staff(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_role_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select
    khpos_private.ops_can_manage_people(p_actor_user_id,p_organisation_id)
    or exists(
      select 1
      from public.khpos_ops_role_assignments a
      join public.khpos_ops_roles r on r.id=a.role_id
      where a.user_id=p_actor_user_id
        and a.status='active'
        and r.organisation_id=p_organisation_id
        and r.status='active'
        and khpos_private.ops_role_is_ancestor(
          p_organisation_id,p_staff_role_id,r.id
        )
    );
$$;

create or replace function khpos_private.ops_refresh_staff_readiness(
  p_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff public.khpos_ops_staff%rowtype;
  v_onboarding_complete boolean := false;
  v_membership_active boolean := false;
  v_charter_active boolean := false;
begin
  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id
  for update;

  if v_staff.id is null or v_staff.status in ('active','inactive','exiting','ended') then
    return;
  end if;

  select not exists(
    select 1
    from public.khpos_ops_staff_onboarding_items i
    where i.staff_id=v_staff.id
      and i.mandatory
      and i.status not in ('completed','waived')
  ) into v_onboarding_complete;

  if v_staff.user_id is not null then
    select exists(
      select 1
      from public.organisation_memberships m
      where m.organisation_id=v_staff.organisation_id
        and m.user_id=v_staff.user_id
        and m.status='active'
    ) into v_membership_active;
  end if;

  select exists(
    select 1
    from public.khpos_ops_role_charters c
    where c.role_id=v_staff.desired_role_id
      and c.status='active'
  ) into v_charter_active;

  update public.khpos_ops_staff
  set status=case
      when v_onboarding_complete
        and v_staff.user_id is not null
        and v_membership_active
        and v_charter_active
      then 'ready'
      else 'onboarding'
    end,
    updated_at=now()
  where id=v_staff.id;
end;
$$;

create or replace function public.khpos_ops_get_people_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_member_role text;
  v_org_name text;
  v_can_manage boolean := false;
  v_roles jsonb := '[]'::jsonb;
  v_campuses jsonb := '[]'::jsonb;
  v_units jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_onboarding integer := 0;
  v_ready integer := 0;
  v_active integer := 0;
  v_unlinked integer := 0;
  v_overdue integer := 0;
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

  v_can_manage := khpos_private.ops_can_manage_people(
    p_actor_user_id,p_organisation_id
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'code',r.code,'title',r.title,'level',r.role_level,
    'reportsToRoleId',r.reports_to_role_id
  ) order by r.role_level,r.title),'[]'::jsonb)
  into v_roles
  from public.khpos_ops_roles r
  where r.organisation_id=p_organisation_id
    and r.status='active'
    and r.category<>'student';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'code',c.code,'name',c.name
  ) order by c.name),'[]'::jsonb)
  into v_campuses
  from public.khpos_ops_campuses c
  where c.organisation_id=p_organisation_id and c.status='active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,'code',u.code,'name',u.name,'campusId',u.campus_id
  ) order by u.name),'[]'::jsonb)
  into v_units
  from public.khpos_ops_units u
  where u.organisation_id=p_organisation_id and u.status='active';

  with actor_roles as (
    select r.id as role_id
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  ),
  visible_staff as (
    select s.*
    from public.khpos_ops_staff s
    where s.organisation_id=p_organisation_id
      and (
        v_can_manage
        or s.user_id=p_actor_user_id
        or exists(
          select 1 from actor_roles ar
          where khpos_private.ops_role_is_ancestor(
            p_organisation_id,s.desired_role_id,ar.role_id
          )
        )
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'reference',s.staff_reference,
    'displayName',s.display_name,
    'accountEmail',s.account_email,
    'accountLinked',s.user_id is not null,
    'employmentType',s.employment_type,
    'status',s.status,
    'startDate',s.start_date,
    'onboardingDueDate',s.onboarding_due_date,
    'probationReviewDate',s.probation_review_date,
    'role',jsonb_build_object(
      'id',r.id,'code',r.code,'title',r.title,'level',r.role_level
    ),
    'campus',case when c.id is null then null else jsonb_build_object(
      'id',c.id,'name',c.name
    ) end,
    'unit',case when u.id is null then null else jsonb_build_object(
      'id',u.id,'name',u.name
    ) end,
    'roleAssignmentId',s.role_assignment_id,
    'accessMembershipActive',case when s.user_id is null then false else exists(
      select 1 from public.organisation_memberships m
      where m.organisation_id=s.organisation_id
        and m.user_id=s.user_id and m.status='active'
    ) end,
    'roleCharterActive',exists(
      select 1 from public.khpos_ops_role_charters rc
      where rc.role_id=s.desired_role_id and rc.status='active'
    ),
    'mandatoryOutstanding',(
      select count(*)::integer
      from public.khpos_ops_staff_onboarding_items i
      where i.staff_id=s.id
        and i.mandatory
        and i.status not in ('completed','waived')
    ),
    'onboarding',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,
        'code',i.requirement_code,
        'title',i.title,
        'description',i.description,
        'category',i.category,
        'mandatory',i.mandatory,
        'waivable',i.waivable,
        'evidenceRequired',i.evidence_required,
        'status',i.status,
        'submissionNote',i.submission_note,
        'evidenceReference',i.evidence_reference,
        'submittedAt',i.submitted_at,
        'reviewNote',i.review_note,
        'reviewedAt',i.reviewed_at
      ) order by req.sort_order nulls last,i.created_at)
      from public.khpos_ops_staff_onboarding_items i
      left join public.khpos_ops_onboarding_requirements req
        on req.id=i.source_requirement_id
      where i.staff_id=s.id
    ),'[]'::jsonb),
    'canSelfSubmit',s.user_id=p_actor_user_id,
    'canReview',khpos_private.ops_can_review_staff(
      p_actor_user_id,p_organisation_id,s.desired_role_id
    ),
    'canManage',v_can_manage,
    'history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventType',e.event_type,
        'note',e.note,
        'metadata',e.metadata,
        'createdAt',e.created_at
      ) order by e.created_at desc)
      from (
        select event_type,note,metadata,created_at
        from public.khpos_ops_staff_events
        where staff_id=s.id
        order by created_at desc
        limit 15
      ) e
    ),'[]'::jsonb)
  ) order by
    case s.status
      when 'onboarding' then 1
      when 'ready' then 2
      when 'active' then 3
      when 'inactive' then 4
      when 'exiting' then 5
      else 6
    end,
    s.onboarding_due_date,
    lower(s.display_name)
  ),'[]'::jsonb)
  into v_items
  from visible_staff s
  join public.khpos_ops_roles r on r.id=s.desired_role_id
  left join public.khpos_ops_campuses c on c.id=s.campus_id
  left join public.khpos_ops_units u on u.id=s.unit_id;

  with visible_staff as (
    select s.*
    from public.khpos_ops_staff s
    where s.organisation_id=p_organisation_id
      and (
        v_can_manage
        or s.user_id=p_actor_user_id
        or exists(
          select 1
          from public.khpos_ops_role_assignments a
          join public.khpos_ops_roles ar on ar.id=a.role_id
          where a.user_id=p_actor_user_id
            and a.status='active'
            and ar.organisation_id=p_organisation_id
            and ar.status='active'
            and khpos_private.ops_role_is_ancestor(
              p_organisation_id,s.desired_role_id,ar.id
            )
        )
      )
  )
  select
    count(*)::integer,
    count(*) filter (where status='onboarding')::integer,
    count(*) filter (where status='ready')::integer,
    count(*) filter (where status='active')::integer,
    count(*) filter (where user_id is null and status not in ('ended'))::integer,
    count(*) filter (
      where status='onboarding'
        and onboarding_due_date<current_date
    )::integer
  into v_total,v_onboarding,v_ready,v_active,v_unlinked,v_overdue
  from visible_staff;

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'canManagePeople',v_can_manage,
    'roles',v_roles,
    'campuses',v_campuses,
    'units',v_units,
    'summary',jsonb_build_object(
      'total',v_total,
      'onboarding',v_onboarding,
      'ready',v_ready,
      'active',v_active,
      'unlinkedAccounts',v_unlinked,
      'overdueOnboarding',v_overdue
    ),
    'items',v_items
  );
end;
$$;

create or replace function public.khpos_ops_create_staff_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_name text := nullif(btrim(p_input->>'displayName'),'');
  v_email text := lower(nullif(btrim(p_input->>'accountEmail'),''));
  v_employment_type text := lower(coalesce(nullif(btrim(p_input->>'employmentType'),''),'employee'));
  v_role_id uuid;
  v_role_code text;
  v_campus_id uuid;
  v_unit_id uuid;
  v_start_date date;
  v_onboarding_due date;
  v_probation_date date;
  v_user_id uuid;
  v_staff_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_can_manage_people(p_actor_user_id,p_organisation_id) then
    raise exception 'Staff appointment records require an active School Guardian or Vision Custodian role.';
  end if;

  if v_name is null or v_email is null then
    raise exception 'Staff name and account email are required.';
  end if;
  if position('@' in v_email)<2 then
    raise exception 'Enter a valid staff account email.';
  end if;
  if v_employment_type not in ('employee','facilitator','contractor','volunteer','intern','temporary') then
    raise exception 'Unsupported employment type.';
  end if;

  begin
    v_role_id := (p_input->>'roleId')::uuid;
  exception when others then
    raise exception 'A valid operating role is required.';
  end;

  select code into v_role_code
  from public.khpos_ops_roles
  where id=v_role_id
    and organisation_id=p_organisation_id
    and status='active'
    and category<>'student';

  if v_role_code is null then raise exception 'Operating staff role not found.'; end if;

  if nullif(p_input->>'campusId','') is not null then
    begin v_campus_id := (p_input->>'campusId')::uuid;
    exception when others then raise exception 'Campus is invalid.'; end;
    if not exists(
      select 1 from public.khpos_ops_campuses
      where id=v_campus_id and organisation_id=p_organisation_id and status='active'
    ) then raise exception 'Campus is not active in this organisation.'; end if;
  end if;

  if nullif(p_input->>'unitId','') is not null then
    begin v_unit_id := (p_input->>'unitId')::uuid;
    exception when others then raise exception 'Unit is invalid.'; end;
    if not exists(
      select 1 from public.khpos_ops_units
      where id=v_unit_id and organisation_id=p_organisation_id and status='active'
    ) then raise exception 'Unit is not active in this organisation.'; end if;
  end if;

  begin v_start_date := (p_input->>'startDate')::date;
  exception when others then raise exception 'Start date is invalid.'; end;

  if nullif(p_input->>'onboardingDueDate','') is null then
    v_onboarding_due := v_start_date;
  else
    begin v_onboarding_due := (p_input->>'onboardingDueDate')::date;
    exception when others then raise exception 'Onboarding due date is invalid.'; end;
  end if;

  if nullif(p_input->>'probationReviewDate','') is not null then
    begin v_probation_date := (p_input->>'probationReviewDate')::date;
    exception when others then raise exception 'Probation review date is invalid.'; end;
    if v_probation_date<v_start_date then
      raise exception 'Probation review date cannot precede the staff start date.';
    end if;
  end if;

  select id into v_user_id
  from auth.users
  where lower(email)=v_email
  order by created_at
  limit 1;

  v_reference := 'STF-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff(
    organisation_id,staff_reference,display_name,account_email,user_id,
    employment_type,desired_role_id,campus_id,unit_id,start_date,
    onboarding_due_date,probation_review_date,status,created_by
  ) values (
    p_organisation_id,v_reference,left(v_name,180),left(v_email,320),v_user_id,
    v_employment_type,v_role_id,v_campus_id,v_unit_id,v_start_date,
    v_onboarding_due,v_probation_date,'onboarding',p_actor_user_id
  ) returning id into v_staff_id;

  insert into public.khpos_ops_staff_onboarding_items(
    organisation_id,staff_id,source_requirement_id,requirement_code,title,
    description,category,mandatory,waivable,evidence_required
  )
  select
    p_organisation_id,v_staff_id,req.id,req.code,req.title,
    req.description,req.category,req.mandatory,req.waivable,req.evidence_required
  from public.khpos_ops_onboarding_requirements req
  where req.organisation_id=p_organisation_id
    and req.status='active'
    and (
      cardinality(req.applicable_role_codes)=0
      or v_role_code=any(req.applicable_role_codes)
    )
  order by req.sort_order,req.code;

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff_id,p_actor_user_id,'appointment_recorded',
    'Staff appointment and onboarding record created.',
    jsonb_build_object(
      'reference',v_reference,
      'roleCode',v_role_code,
      'accountMatched',v_user_id is not null,
      'startDate',v_start_date,
      'employmentType',v_employment_type
    )
  );

  perform khpos_private.ops_refresh_staff_readiness(v_staff_id);

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_created','staff',v_staff_id,
    jsonb_build_object('reference',v_reference,'roleCode',v_role_code)
  );

  return v_staff_id;
exception when unique_violation then
  raise exception 'A current staff record already uses this account email.';
end;
$$;

create or replace function public.khpos_ops_link_staff_account_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff public.khpos_ops_staff%rowtype;
  v_user_id uuid;
begin
  if not khpos_private.ops_can_manage_people(p_actor_user_id,p_organisation_id) then
    raise exception 'Staff account linkage requires an active School Guardian or Vision Custodian role.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id and organisation_id=p_organisation_id
  for update;

  if v_staff.id is null then raise exception 'Staff record not found.'; end if;
  if v_staff.status='ended' then raise exception 'Ended staff records cannot be linked to a new account.'; end if;

  select id into v_user_id
  from auth.users
  where lower(email)=lower(v_staff.account_email)
  order by created_at
  limit 1;

  if v_user_id is null then
    raise exception 'No KHP-OS account currently matches this staff email.';
  end if;

  if exists(
    select 1 from public.khpos_ops_staff
    where organisation_id=p_organisation_id
      and user_id=v_user_id
      and id<>v_staff.id
      and status<>'ended'
  ) then
    raise exception 'This KHP-OS account is already linked to another current staff record.';
  end if;

  update public.khpos_ops_staff
  set user_id=v_user_id,updated_at=now()
  where id=v_staff.id;

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff.id,p_actor_user_id,'account_linked',
    'KHP-OS user account linked by exact email match.',
    jsonb_build_object('accountEmail',v_staff.account_email)
  );

  perform khpos_private.ops_refresh_staff_readiness(v_staff.id);
end;
$$;

create or replace function public.khpos_ops_staff_onboarding_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid,
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
  v_staff public.khpos_ops_staff%rowtype;
  v_item public.khpos_ops_staff_onboarding_items%rowtype;
  v_can_manage boolean := false;
  v_can_review boolean := false;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
begin
  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id and organisation_id=p_organisation_id
  for update;

  if v_staff.id is null then raise exception 'Staff record not found.'; end if;
  if v_staff.status in ('ended','exiting') then
    raise exception 'Onboarding cannot be changed after the staff exit process has begun.';
  end if;

  select * into v_item
  from public.khpos_ops_staff_onboarding_items
  where id=p_item_id and staff_id=v_staff.id and organisation_id=p_organisation_id
  for update;

  if v_item.id is null then raise exception 'Onboarding requirement not found.'; end if;

  v_can_manage := khpos_private.ops_can_manage_people(
    p_actor_user_id,p_organisation_id
  );
  v_can_review := khpos_private.ops_can_review_staff(
    p_actor_user_id,p_organisation_id,v_staff.desired_role_id
  );

  if p_action='submit' then
    if v_staff.user_id is null or v_staff.user_id<>p_actor_user_id then
      raise exception 'Only the linked staff member can submit their own onboarding evidence.';
    end if;
    if v_item.status not in ('pending','submitted') then
      raise exception 'Only pending or returned-to-submission onboarding items can be submitted.';
    end if;
    if v_item.evidence_required and v_evidence is null then
      raise exception 'This onboarding requirement needs an evidence reference.';
    end if;

    update public.khpos_ops_staff_onboarding_items
    set status='submitted',
        submission_note=v_note,
        evidence_reference=v_evidence,
        submitted_by=p_actor_user_id,
        submitted_at=now(),
        reviewed_by=null,
        reviewed_at=null,
        review_note=null,
        updated_at=now()
    where id=v_item.id;

  elsif p_action='verify' then
    if not v_can_review then
      raise exception 'Only the relevant reporting leader, School Guardian or Vision Custodian can verify this onboarding item.';
    end if;
    if v_item.status not in ('pending','submitted') then
      raise exception 'This onboarding item is already resolved.';
    end if;
    if v_item.evidence_required
       and coalesce(v_evidence,v_item.evidence_reference) is null then
      raise exception 'This onboarding requirement needs an evidence reference before verification.';
    end if;

    update public.khpos_ops_staff_onboarding_items
    set status='completed',
        submission_note=coalesce(v_item.submission_note,v_note),
        evidence_reference=coalesce(v_evidence,v_item.evidence_reference),
        reviewed_by=p_actor_user_id,
        reviewed_at=now(),
        review_note=v_note,
        updated_at=now()
    where id=v_item.id;

  elsif p_action='waive' then
    if not v_can_manage then
      raise exception 'Only School Guardian or Vision Custodian can waive an onboarding requirement.';
    end if;
    if not v_item.waivable then
      raise exception 'This mandatory onboarding requirement cannot be waived.';
    end if;
    if v_note is null then raise exception 'A waiver reason is required.'; end if;

    update public.khpos_ops_staff_onboarding_items
    set status='waived',
        reviewed_by=p_actor_user_id,
        reviewed_at=now(),
        review_note=v_note,
        updated_at=now()
    where id=v_item.id;

  elsif p_action='reopen' then
    if not v_can_review then
      raise exception 'Only the relevant reporting leader, School Guardian or Vision Custodian can reopen this onboarding item.';
    end if;
    if v_item.status not in ('submitted','completed','waived') then
      raise exception 'Only a submitted, completed or waived item can be reopened.';
    end if;
    if v_note is null then raise exception 'Explain why this onboarding item is being reopened.'; end if;

    update public.khpos_ops_staff_onboarding_items
    set status='pending',
        reviewed_by=p_actor_user_id,
        reviewed_at=now(),
        review_note=v_note,
        updated_at=now()
    where id=v_item.id;

  else
    raise exception 'Unsupported onboarding action.';
  end if;

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff.id,p_actor_user_id,'onboarding_'||p_action,
    v_note,
    jsonb_build_object(
      'itemId',v_item.id,
      'requirementCode',v_item.requirement_code,
      'evidenceReference',v_evidence
    )
  );

  perform khpos_private.ops_refresh_staff_readiness(v_staff.id);

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_onboarding_'||p_action,
    'staff',v_staff.id,
    jsonb_build_object('itemId',v_item.id,'requirementCode',v_item.requirement_code)
  );
end;
$$;

create or replace function public.khpos_ops_activate_staff_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff public.khpos_ops_staff%rowtype;
  v_assignment_id uuid;
  v_primary boolean := false;
begin
  if not khpos_private.ops_can_manage_people(p_actor_user_id,p_organisation_id) then
    raise exception 'Staff activation requires an active School Guardian or Vision Custodian role.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id and organisation_id=p_organisation_id
  for update;

  if v_staff.id is null then raise exception 'Staff record not found.'; end if;

  perform khpos_private.ops_refresh_staff_readiness(v_staff.id);

  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id and organisation_id=p_organisation_id
  for update;
  if v_staff.status='active' and v_staff.role_assignment_id is not null then
    return v_staff.role_assignment_id;
  end if;
  if v_staff.status<>'ready' then
    raise exception 'Staff cannot be activated until onboarding, account access and the active Role Charter are all ready.';
  end if;
  if v_staff.user_id is null then raise exception 'Linked KHP-OS account is required before activation.'; end if;

  if not exists(
    select 1 from public.organisation_memberships m
    where m.organisation_id=p_organisation_id
      and m.user_id=v_staff.user_id
      and m.status='active'
  ) then
    raise exception 'Active organisation access is required before operational role activation.';
  end if;

  v_primary := not exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=v_staff.user_id
      and a.status='active'
      and a.primary_assignment
      and r.organisation_id=p_organisation_id
  );

  select id into v_assignment_id
  from public.khpos_ops_role_assignments
  where role_id=v_staff.desired_role_id
    and user_id=v_staff.user_id
    and coalesce(campus_id,'00000000-0000-0000-0000-000000000000'::uuid)
      =coalesce(v_staff.campus_id,'00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(unit_id,'00000000-0000-0000-0000-000000000000'::uuid)
      =coalesce(v_staff.unit_id,'00000000-0000-0000-0000-000000000000'::uuid)
    and status='active'
  limit 1;

  if v_assignment_id is null then
    insert into public.khpos_ops_role_assignments(
      role_id,user_id,campus_id,unit_id,primary_assignment,status,
      start_date,appointed_by
    ) values (
      v_staff.desired_role_id,v_staff.user_id,v_staff.campus_id,v_staff.unit_id,
      v_primary,'active',v_staff.start_date,p_actor_user_id
    ) returning id into v_assignment_id;
  end if;

  update public.khpos_ops_staff
  set status='active',
      role_assignment_id=v_assignment_id,
      updated_at=now()
  where id=v_staff.id;

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff.id,p_actor_user_id,'staff_activated',
    'Staff onboarding was certified and the operating-role assignment became active.',
    jsonb_build_object(
      'roleAssignmentId',v_assignment_id,
      'primaryAssignment',v_primary,
      'startDate',v_staff.start_date
    )
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_activated','staff',v_staff.id,
    jsonb_build_object('roleAssignmentId',v_assignment_id)
  );

  return v_assignment_id;
end;
$$;

revoke execute on function khpos_private.ops_can_manage_people(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_can_review_staff(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_refresh_staff_readiness(uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_get_people_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_staff_server(uuid,uuid,jsonb)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_link_staff_account_server(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_staff_onboarding_action_server(uuid,uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_activate_staff_server(uuid,uuid,uuid)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_can_manage_people(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_can_review_staff(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_refresh_staff_readiness(uuid) to service_role;
grant execute on function public.khpos_ops_get_people_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_create_staff_server(uuid,uuid,jsonb) to service_role;
grant execute on function public.khpos_ops_link_staff_account_server(uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_staff_onboarding_action_server(uuid,uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_activate_staff_server(uuid,uuid,uuid) to service_role;
