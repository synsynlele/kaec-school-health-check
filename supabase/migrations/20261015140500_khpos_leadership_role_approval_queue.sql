-- Add a scoped leadership queue for pending secondary role approvals.
-- Read-only. It does not grant roles, bypass readiness, or change staff records.
create or replace function public.khpos_ops_pending_role_approvals_server(
  p_actor uuid,p_org uuid
) returns jsonb language plpgsql stable security definer
set search_path='' as $$
declare
  v_items jsonb;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) then
    raise exception 'Active school membership and partnership are required.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'positionId',q.position_id,
    'staffId',q.staff_id,
    'staffName',q.staff_name,
    'roleTitle',q.role_title,
    'campusName',q.campus_name,
    'unitName',q.unit_name,
    'accepted',q.accepted,
    'blockers',to_jsonb(q.blockers),
    'ready',cardinality(q.blockers)=0,
    'createdAt',q.created_at
  ) order by q.created_at asc),'[]'::jsonb) into v_items
  from (
    select pos.id as position_id,st.id as staff_id,
      st.display_name as staff_name,r.title as role_title,
      c.name as campus_name,u.name as unit_name,
      pos.acknowledged_at is not null and pos.charter_id=charter.id as accepted,
      khpos_private.ops_position_blockers(pos.id) as blockers,
      pos.created_at
    from public.khpos_ops_staff_role_positions pos
    join public.khpos_ops_staff st on st.id=pos.staff_id
      and st.organisation_id=pos.organisation_id and st.status='active'
    join public.khpos_ops_roles r on r.id=pos.role_id
      and r.organisation_id=pos.organisation_id and r.status='active'
    join public.khpos_ops_campuses c on c.id=pos.campus_id
      and c.organisation_id=pos.organisation_id
    left join public.khpos_ops_units u on u.id=pos.unit_id
    left join public.khpos_ops_role_charters charter
      on charter.role_id=pos.role_id and charter.status='active'
    where pos.organisation_id=p_org and pos.status='pending'
      and st.user_id is distinct from p_actor
      and khpos_private.ops_positions_can_manage(
        p_actor,p_org,pos.campus_id,r.code
      )
  ) q;
  return jsonb_build_object(
    'items',v_items,'pendingCount',jsonb_array_length(v_items)
  );
end;
$$;
revoke all on function public.khpos_ops_pending_role_approvals_server(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_pending_role_approvals_server(uuid,uuid)
  to service_role;
