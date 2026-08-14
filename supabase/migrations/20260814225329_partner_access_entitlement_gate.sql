alter table public.organisation_memberships
  drop constraint if exists organisation_memberships_status_check;

alter table public.organisation_memberships
  add constraint organisation_memberships_status_check
  check (status = any (array['active'::text,'invited'::text,'pending'::text,'suspended'::text,'ended'::text]));

alter table public.organisations
  add column if not exists partner_status text not null default 'pending',
  add column if not exists partner_requested_at timestamptz,
  add column if not exists partner_approved_at timestamptz,
  add column if not exists partner_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists partner_status_reason text,
  add column if not exists partner_entitlements text[] not null default array['khpos_core']::text[];

alter table public.organisations
  drop constraint if exists organisations_partner_status_check;
alter table public.organisations
  add constraint organisations_partner_status_check
  check (partner_status = any (array['pending'::text,'active'::text,'suspended'::text,'ended'::text]));

alter table public.organisations
  drop constraint if exists organisations_partner_entitlements_check;
alter table public.organisations
  add constraint organisations_partner_entitlements_check
  check (partner_entitlements <@ array['khpos_core'::text,'ksi_integration'::text,'pipupath_intelligence'::text,'benchmarking'::text]);

update public.organisations
set partner_requested_at = coalesce(partner_requested_at, created_at, now())
where partner_requested_at is null;

create index if not exists organisations_partner_status_requested_idx
  on public.organisations(partner_status, partner_requested_at desc);

create or replace function public.khpos_guard_active_membership_by_partner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner_status text;
begin
  if new.status = 'active' then
    select o.partner_status into v_partner_status
    from public.organisations o
    where o.id = new.organisation_id;

    if v_partner_status is distinct from 'active' then
      raise exception 'KHP-OS membership cannot be active until the institution partnership is active.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.khpos_guard_active_membership_by_partner() from public, anon, authenticated;

DROP TRIGGER IF EXISTS khpos_guard_active_membership_by_partner_trigger ON public.organisation_memberships;
create trigger khpos_guard_active_membership_by_partner_trigger
before insert or update of organisation_id, status on public.organisation_memberships
for each row execute function public.khpos_guard_active_membership_by_partner();

create or replace function public.khpos_sync_memberships_for_partner_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.partner_status is not distinct from old.partner_status then
    return new;
  end if;

  if new.partner_status = 'pending' then
    update public.organisation_memberships
    set status = 'pending', updated_at = now()
    where organisation_id = new.id and status = 'active';
  elsif new.partner_status = 'suspended' then
    update public.organisation_memberships
    set status = 'suspended', updated_at = now()
    where organisation_id = new.id and status = 'active';
  elsif new.partner_status = 'ended' then
    update public.organisation_memberships
    set status = 'ended', updated_at = now()
    where organisation_id = new.id and status <> 'ended';
  end if;

  return new;
end;
$$;

revoke execute on function public.khpos_sync_memberships_for_partner_status() from public, anon, authenticated;

DROP TRIGGER IF EXISTS khpos_sync_memberships_for_partner_status_trigger ON public.organisations;
create trigger khpos_sync_memberships_for_partner_status_trigger
after update of partner_status on public.organisations
for each row execute function public.khpos_sync_memberships_for_partner_status();

create or replace function public.claim_kshc_assessment_server(
  p_assessment_id uuid,
  p_user_id uuid,
  p_verified_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_email text;
  v_assessment public.assessments%rowtype;
  v_school public.schools%rowtype;
  v_organisation_id uuid;
  v_membership_existed boolean := false;
  v_partner_status text;
  v_membership_status text;
begin
  select lower(trim(u.email))
    into v_auth_email
  from auth.users u
  where u.id = p_user_id
    and u.email_confirmed_at is not null;

  if v_auth_email is null or v_auth_email = '' then
    raise exception 'A verified user is required.';
  end if;

  if v_auth_email <> lower(trim(coalesce(p_verified_email, ''))) then
    raise exception 'Verified user email mismatch.';
  end if;

  select * into v_assessment
  from public.assessments
  where id = p_assessment_id
  for update;

  if not found then
    raise exception 'Assessment not found.';
  end if;

  if not exists (select 1 from public.reports r where r.assessment_id = p_assessment_id) then
    raise exception 'Assessment must have a completed report before partnership request.';
  end if;

  select * into v_school
  from public.schools s
  where s.id::text = v_assessment.school_id;

  if not found then
    raise exception 'School snapshot not found.';
  end if;

  if lower(trim(v_school.email)) <> v_auth_email then
    raise exception 'The verified email does not match the email used for this assessment.';
  end if;

  if v_assessment.organisation_id is not null then
    v_organisation_id := v_assessment.organisation_id;
  else
    select o.id into v_organisation_id
    from public.organisations o
    join public.organisation_memberships m on m.organisation_id = o.id
    where m.user_id = p_user_id
      and lower(trim(o.name)) = lower(trim(v_school.school_name))
    order by o.created_at asc
    limit 1;

    if v_organisation_id is null then
      insert into public.organisations (
        name, organisation_type, country, state, school_type, school_level,
        source_school_snapshot_id, created_by, partner_status, partner_requested_at
      ) values (
        v_school.school_name, 'school', v_school.country, v_school.state,
        v_school.school_type, v_school.school_level, v_school.id, p_user_id,
        'pending', now()
      ) returning id into v_organisation_id;
    end if;

    update public.assessments
    set organisation_id = v_organisation_id,
        claimed_at = now(),
        claimed_by = p_user_id
    where id = p_assessment_id;
  end if;

  select o.partner_status into v_partner_status
  from public.organisations o
  where o.id = v_organisation_id;

  v_membership_status := case v_partner_status
    when 'active' then 'active'
    when 'suspended' then 'suspended'
    when 'ended' then 'ended'
    else 'pending'
  end;

  select exists (
    select 1 from public.organisation_memberships m
    where m.organisation_id = v_organisation_id
      and m.user_id = p_user_id
  ) into v_membership_existed;

  insert into public.organisation_memberships (organisation_id, user_id, role, status)
  values (v_organisation_id, p_user_id, 'executive', v_membership_status)
  on conflict (organisation_id, user_id)
  do update set updated_at = now();

  if not v_membership_existed or v_assessment.organisation_id is null then
    insert into public.khpos_audit_events (
      organisation_id, actor_user_id, event_type, object_type, object_id, metadata
    ) values (
      v_organisation_id, p_user_id, 'partnership_requested', 'assessment', p_assessment_id,
      jsonb_build_object(
        'source','kshc',
        'framework_version',v_assessment.framework_version,
        'auth','server_verified',
        'partner_status',v_partner_status,
        'khpos_access',case when v_partner_status='active' then 'granted' else 'not_granted' end
      )
    );
  end if;

  return v_organisation_id;
end;
$$;

revoke execute on function public.claim_kshc_assessment_server(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_kshc_assessment_server(uuid,uuid,text) to service_role;

create or replace function public.khpos_get_partner_registry_server(p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_role text;
  v_partners jsonb;
begin
  select a.platform_role into v_role
  from public.khpos_platform_admins a
  where a.user_id = p_actor_user_id and a.status = 'active';

  if v_role is null then
    raise exception 'Platform administrator access is required.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'organisationId', q.id,
      'name', q.name,
      'country', q.country,
      'state', q.state,
      'schoolType', q.school_type,
      'schoolLevel', q.school_level,
      'partnerStatus', q.partner_status,
      'requestedAt', q.partner_requested_at,
      'approvedAt', q.partner_approved_at,
      'statusReason', q.partner_status_reason,
      'entitlements', q.partner_entitlements,
      'memberCount', q.member_count,
      'latestAssessmentAt', q.latest_assessment_at,
      'latestOverallScore', q.latest_overall_score
    ) order by
      case q.partner_status when 'pending' then 0 when 'suspended' then 1 when 'active' then 2 else 3 end,
      q.partner_requested_at desc nulls last,
      q.name
  ), '[]'::jsonb)
  into v_partners
  from (
    select
      o.id, o.name, o.country, o.state, o.school_type, o.school_level,
      o.partner_status, o.partner_requested_at, o.partner_approved_at,
      o.partner_status_reason, o.partner_entitlements,
      (select count(*)::int from public.organisation_memberships m where m.organisation_id=o.id) as member_count,
      la.completed_at as latest_assessment_at,
      la.overall_score as latest_overall_score
    from public.organisations o
    left join lateral (
      select a.completed_at, a.overall_score
      from public.assessments a
      where a.organisation_id=o.id and a.status='completed'
      order by a.completed_at desc nulls last, a.created_at desc
      limit 1
    ) la on true
  ) q;

  return jsonb_build_object(
    'viewerRole', v_role,
    'summary', jsonb_build_object(
      'pending', (select count(*) from public.organisations where partner_status='pending'),
      'active', (select count(*) from public.organisations where partner_status='active'),
      'suspended', (select count(*) from public.organisations where partner_status='suspended'),
      'ended', (select count(*) from public.organisations where partner_status='ended')
    ),
    'partners', v_partners
  );
end;
$$;

revoke execute on function public.khpos_get_partner_registry_server(uuid) from public, anon, authenticated;
grant execute on function public.khpos_get_partner_registry_server(uuid) to service_role;

create or replace function public.khpos_manage_partner_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_role text;
  v_current text;
  v_next text;
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
begin
  select a.platform_role into v_role
  from public.khpos_platform_admins a
  where a.user_id = p_actor_user_id and a.status='active';

  if v_role not in ('super_admin','portfolio_admin') then
    raise exception 'Super Admin or Portfolio Admin authority is required.';
  end if;

  if v_reason is null or length(v_reason) < 12 then
    raise exception 'A partnership governance reason of at least 12 characters is required.';
  end if;

  select o.partner_status into v_current
  from public.organisations o
  where o.id=p_organisation_id
  for update;

  if v_current is null then
    raise exception 'Institution not found.';
  end if;

  if p_action='approve' then
    if v_current <> 'pending' then raise exception 'Only pending partnerships can be approved.'; end if;
    v_next := 'active';
    update public.organisations
    set partner_status='active', partner_approved_at=now(), partner_approved_by=p_actor_user_id,
        partner_status_reason=v_reason, updated_at=now()
    where id=p_organisation_id;
    update public.organisation_memberships
    set status='active', updated_at=now()
    where organisation_id=p_organisation_id and status='pending';
  elsif p_action='suspend' then
    if v_current <> 'active' then raise exception 'Only active partnerships can be suspended.'; end if;
    v_next := 'suspended';
    update public.organisations
    set partner_status='suspended', partner_status_reason=v_reason, updated_at=now()
    where id=p_organisation_id;
  elsif p_action='reactivate' then
    if v_current <> 'suspended' then raise exception 'Only suspended partnerships can be reactivated.'; end if;
    v_next := 'active';
    update public.organisations
    set partner_status='active', partner_status_reason=v_reason, updated_at=now()
    where id=p_organisation_id;
    update public.organisation_memberships
    set status='active', updated_at=now()
    where organisation_id=p_organisation_id and status='suspended';
  elsif p_action='end' then
    if v_current='ended' then raise exception 'This partnership has already ended.'; end if;
    v_next := 'ended';
    update public.organisations
    set partner_status='ended', partner_status_reason=v_reason, updated_at=now()
    where id=p_organisation_id;
  else
    raise exception 'Unsupported partnership action.';
  end if;

  insert into public.khpos_platform_audit_events(actor_user_id,event_type,metadata)
  values (p_actor_user_id,'partner_status_changed',jsonb_build_object(
    'organisation_id',p_organisation_id,'action',p_action,'from',v_current,'to',v_next,'reason',v_reason
  ));

  insert into public.khpos_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
  values (p_organisation_id,p_actor_user_id,'partner_status_changed','organisation',p_organisation_id,
    jsonb_build_object('action',p_action,'from',v_current,'to',v_next,'reason',v_reason,'source','kaec_admin'));

  return jsonb_build_object('organisationId',p_organisation_id,'partnerStatus',v_next,'action',p_action);
end;
$$;

revoke execute on function public.khpos_manage_partner_server(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.khpos_manage_partner_server(uuid,uuid,text,text) to service_role;

comment on column public.organisations.partner_status is 'KAEC-NG partnership entitlement gate. Only active institutions may have active KHP-OS memberships.';
comment on column public.organisations.partner_entitlements is 'Product entitlements granted under the KAEC-NG partnership. Core access still requires partner_status=active.';
