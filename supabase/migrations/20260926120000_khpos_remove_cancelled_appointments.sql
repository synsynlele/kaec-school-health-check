-- Remove never activated cancelled appointments, preserving a minimal audit event.
create or replace function public.khpos_ops_cancel_staff_appointment_server(p_actor uuid,p_org uuid,p_staff uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_staff public.khpos_ops_staff%rowtype;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_can_manage_people(p_actor,p_org) then
    raise exception 'School leadership membership is required.';
  end if;
  if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Give a reason of at least 10 characters.'; end if;
  select * into v_staff from public.khpos_ops_staff where id=p_staff and organisation_id=p_org for update;
  if v_staff.id is null or v_staff.status not in ('onboarding','ready') or v_staff.role_assignment_id is not null then
    raise exception 'Only an appointment that has not been activated can be cancelled. Use Progression & Exit for active staff.';
  end if;
  delete from public.khpos_ops_staff_access_invites where staff_id=p_staff;
  if v_staff.user_id is not null and not exists(
    select 1 from public.khpos_ops_staff s where s.organisation_id=p_org and s.user_id=v_staff.user_id and s.id<>p_staff and s.status in ('active','ready','onboarding','exiting')
  ) then
    update public.organisation_memberships set status='ended',updated_at=now()
    where organisation_id=p_org and user_id=v_staff.user_id and status='active' and role='contributor';
  end if;
  -- Keep a minimal governance event without retaining a cancelled person's staff profile.
  insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
  values(p_org,p_actor,'ops_staff_appointment_cancelled','staff',p_staff,jsonb_build_object('reason',btrim(p_reason),'recordRemoved',true));
  delete from public.khpos_ops_staff where id=p_staff and organisation_id=p_org;
end $$;

-- Older cancelled, never activated appointments were previously marked ended.
-- Delete only records carrying an explicit cancellation event; completed staff exits remain intact.
delete from public.khpos_ops_staff s
where s.status='ended' and s.role_assignment_id is null
  and exists(select 1 from public.khpos_ops_staff_events e where e.staff_id=s.id and e.event_type='appointment_cancelled');
