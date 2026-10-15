-- Fix child-safeguarding acknowledgement for staff with multiple active/pending school positions.
-- Do not grant any access to restricted safeguarding CASES.
-- Only apply mandatory safeguarding mapping where the school has already published an active policy.

insert into public.khpos_ops_policy_roles(policy_id, role_id, requirement_type)
select p.id, r.id, 'mandatory'
from public.khpos_ops_policies p
join public.khpos_ops_policy_versions v on v.policy_id=p.id and v.status='active'
join public.khpos_ops_roles r on r.organisation_id=p.organisation_id and r.status='active'
where p.code='SAF-P01' and p.status='active'
  and r.code=any(array[
    'SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR',
    'SKILL_INSPECTOR','SECTIONAL_PROMOTER','TEACHER',
    'SKILLS_FACILITATOR','FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER'
  ])
  and not exists (
    select 1 from public.khpos_ops_policy_roles pr
    where pr.policy_id=p.id and pr.role_id=r.id
  );

-- A policy explicitly required by an active charter for a formally proposed
-- pending additional position must also be acknowledgeable BEFORE activation.
-- It must be scoped to the same organisation, the same staff identity and
-- the exact policy code. This does not activate the pending role.
create or replace function public.khpos_ops_acknowledge_policy_server(
  p_actor_user_id uuid,p_organisation_id uuid,p_policy_version_id uuid
) returns void language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare
  v_membership_role text;
  v_policy_id uuid;
  v_policy_code text;
  v_allowed boolean := false;
begin
  select m.role into v_membership_role
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id and m.status='active'
    and o.status='active' and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;
  if v_membership_role is null then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select p.id,p.code into v_policy_id,v_policy_code
  from public.khpos_ops_policy_versions pv
  join public.khpos_ops_policies p on p.id=pv.policy_id
  where pv.id=p_policy_version_id and pv.status='active'
    and p.organisation_id=p_organisation_id and p.status<>'retired';
  if v_policy_id is null then
    raise exception 'Active policy version not found in this school.';
  end if;

  if v_membership_role in ('executive','transformation_lead') then
    v_allowed := true;
  else
    select exists(
      select 1 from public.khpos_ops_policy_roles pr
      join public.khpos_ops_role_assignments a on a.role_id=pr.role_id
      join public.khpos_ops_roles r on r.id=a.role_id
      where pr.policy_id=v_policy_id
        and a.user_id=p_actor_user_id and a.status='active'
        and r.organisation_id=p_organisation_id and r.status='active'
    ) or exists (
      select 1 from public.khpos_ops_staff_role_positions pos
      join public.khpos_ops_staff st on st.id=pos.staff_id
        and st.organisation_id=pos.organisation_id and st.status='active'
      join public.khpos_ops_roles r on r.id=pos.role_id
        and r.organisation_id=pos.organisation_id and r.status='active'
      join public.khpos_ops_role_charters charter
        on charter.role_id=r.id and charter.status='active'
      where pos.organisation_id=p_organisation_id and pos.status='pending'
        and st.user_id=p_actor_user_id
        and v_policy_code=any(coalesce(charter.required_policy_codes,'{}'::text[]))
    ) into v_allowed;
  end if;
  if not v_allowed then
    raise exception 'This policy is not assigned to any of your active roles or pending position requirements.';
  end if;

  insert into public.khpos_ops_policy_acknowledgements(
    organisation_id,policy_version_id,user_id,acknowledged_at
  ) values (
    p_organisation_id,p_policy_version_id,p_actor_user_id,now()
  )
  on conflict (policy_version_id,user_id) do update
  set acknowledged_at=excluded.acknowledged_at;
end;
$$;
revoke all on function public.khpos_ops_acknowledge_policy_server(uuid,uuid,uuid)
from public,anon,authenticated;
grant execute on function public.khpos_ops_acknowledge_policy_server(uuid,uuid,uuid)
to service_role;
