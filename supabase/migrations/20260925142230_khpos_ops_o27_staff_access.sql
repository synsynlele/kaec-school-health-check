-- O27: one-use, email-bound access for an already appointed staff member.
-- Joining grants organisation membership; O7 onboarding independently certifies the operating role.
create table public.khpos_ops_staff_access_invites (
  staff_id uuid primary key references public.khpos_ops_staff(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz not null default now(),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz
);
create index idx_khpos_ops_staff_access_invites_org on public.khpos_ops_staff_access_invites(organisation_id,expires_at);
alter table public.khpos_ops_staff_access_invites enable row level security;
revoke all on public.khpos_ops_staff_access_invites from public,anon,authenticated;

create function public.khpos_ops_issue_staff_access_server(p_actor uuid,p_org uuid,p_staff uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_staff public.khpos_ops_staff%rowtype; v_code text; v_token text; v_expiry timestamptz;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_can_manage_people(p_actor,p_org) then raise exception 'Campus leadership membership required.'; end if;
  select * into v_staff from public.khpos_ops_staff where id=p_staff and organisation_id=p_org for update;
  if v_staff.id is null or v_staff.status not in ('onboarding','ready') then raise exception 'An appointed staff member awaiting activation is required.'; end if;
  select code into v_code from public.khpos_ops_roles where id=v_staff.desired_role_id and organisation_id=p_org and status='active';
  if v_code is null or v_code='VISION_CUSTODIAN' then raise exception 'This role requires separate governance approval.'; end if;
  if v_code='SCHOOL_GUARDIAN' and v_staff.campus_id is null then raise exception 'Choose the School Guardian campus first.'; end if;
  if not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.code='VISION_CUSTODIAN') then
    if v_code='SCHOOL_GUARDIAN' or v_staff.campus_id is null or not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.code='SCHOOL_GUARDIAN' and (a.campus_id=v_staff.campus_id or a.campus_id is null)) then raise exception 'Only the Vision Custodian can appoint a School Guardian; other staff require their campus Guardian.'; end if;
  end if;
  if v_staff.user_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=p_org and m.user_id=v_staff.user_id and m.status='active') then raise exception 'This staff member already has active organisation access.'; end if;
  v_token:=encode(extensions.gen_random_bytes(32),'hex'); v_expiry:=now()+interval '7 days';
  insert into public.khpos_ops_staff_access_invites(staff_id,organisation_id,token_hash,expires_at,issued_by)
  values(p_staff,p_org,extensions.digest(v_token,'sha256'),v_expiry,p_actor)
  on conflict (staff_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,issued_by=excluded.issued_by,issued_at=now(),redeemed_by=null,redeemed_at=null;
  insert into public.khpos_ops_staff_events(organisation_id,staff_id,actor_user_id,event_type,note) values(p_org,p_staff,p_actor,'access_link_issued','A one-use staff access link was issued; no operating role was activated.');
  return jsonb_build_object('token',v_token,'expiresAt',v_expiry);
end $$;

create function public.khpos_ops_redeem_staff_access_server(p_actor uuid,p_token text)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_invite public.khpos_ops_staff_access_invites%rowtype; v_staff public.khpos_ops_staff%rowtype; v_email text; v_org public.organisations%rowtype; v_member public.organisation_memberships%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Access link is invalid.'; end if;
  select * into v_invite from public.khpos_ops_staff_access_invites where token_hash=extensions.digest(p_token,'sha256') for update;
  if v_invite.staff_id is null or v_invite.redeemed_at is not null or v_invite.expires_at<=now() then raise exception 'Access link has expired or was already used. Ask campus leadership for a new link.'; end if;
  select * into v_staff from public.khpos_ops_staff where id=v_invite.staff_id for update;
  select * into v_org from public.organisations where id=v_invite.organisation_id;
  if v_staff.id is null or v_staff.organisation_id<>v_invite.organisation_id or v_staff.status not in ('onboarding','ready') or v_org.status<>'active' or v_org.partner_status<>'active' or not 'khpos_core'=any(coalesce(v_org.partner_entitlements,'{}'::text[])) then raise exception 'The school or staff appointment is not active for joining.'; end if;
  select lower(email) into v_email from auth.users where id=p_actor and email_confirmed_at is not null;
  if v_email is null or v_email<>lower(v_staff.account_email) then raise exception 'Sign in with the verified email on your staff appointment.'; end if;
  if v_staff.user_id is not null and v_staff.user_id<>p_actor then raise exception 'This staff appointment is linked to another account.'; end if;
  select * into v_member from public.organisation_memberships where organisation_id=v_staff.organisation_id and user_id=p_actor for update;
  if v_member.id is not null and v_member.status<>'active' then raise exception 'Existing organisation access needs administrator review.'; end if;
  if v_member.id is null then
    insert into public.organisation_memberships(organisation_id,user_id,role,status,invited_by) values(v_staff.organisation_id,p_actor,'contributor','active',v_invite.issued_by);
  end if;
  update public.khpos_ops_staff set user_id=p_actor,updated_at=now() where id=v_staff.id;
  update public.khpos_ops_staff_access_invites set redeemed_by=p_actor,redeemed_at=now() where staff_id=v_staff.id;
  perform khpos_private.ops_refresh_staff_readiness(v_staff.id);
  insert into public.khpos_ops_staff_events(organisation_id,staff_id,actor_user_id,event_type,note) values(v_staff.organisation_id,v_staff.id,p_actor,'access_joined','Verified staff account joined the organisation; operating role remains gated by onboarding.');
  return jsonb_build_object('organisationId',v_staff.organisation_id,'staffId',v_staff.id);
end $$;
revoke all on function public.khpos_ops_issue_staff_access_server(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_redeem_staff_access_server(uuid,text) from public,anon,authenticated;
grant execute on function public.khpos_ops_issue_staff_access_server(uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_redeem_staff_access_server(uuid,text) to service_role;

-- Enforce leadership appointment authority even when O7 activates a prepared staff record.
create function khpos_private.ops_guard_leadership_assignment()
returns trigger language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_code text; v_org uuid;
begin
  select code,organisation_id into v_code,v_org from public.khpos_ops_roles where id=new.role_id;
  if v_code='VISION_CUSTODIAN' then
    if tg_op='INSERT' or old.status<>'active' or new.user_id<>old.user_id or new.role_id<>old.role_id then
      raise exception 'Vision Custodian seats require separate governance approval.';
    end if;
  elsif v_code='SCHOOL_GUARDIAN' and new.status='active' then
    if new.campus_id is null then raise exception 'School Guardian assignment requires a campus.'; end if;
    if tg_op='INSERT' or old.status<>'active' or new.user_id<>old.user_id or new.role_id<>old.role_id or new.campus_id is distinct from old.campus_id then
      if new.appointed_by is null or not khpos_private.ops_hpd_has_membership(new.appointed_by,v_org) or not khpos_private.ops_hpd_actor_has_role(new.appointed_by,v_org,array['VISION_CUSTODIAN']::text[]) then
        raise exception 'Only an active Vision Custodian can appoint a campus School Guardian.';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger trg_khpos_ops_guard_leadership_assignment
before insert or update of role_id,user_id,campus_id,status on public.khpos_ops_role_assignments
for each row execute function khpos_private.ops_guard_leadership_assignment();
revoke all on function khpos_private.ops_guard_leadership_assignment() from public,anon,authenticated;
