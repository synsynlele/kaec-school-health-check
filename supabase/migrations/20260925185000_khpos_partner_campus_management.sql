-- Partner schools manage their own campus names and additional locations.
create or replace function public.khpos_ops_manage_campus_server(
  p_actor uuid, p_org uuid, p_mode text, p_campus uuid, p_name text
)
returns uuid language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_id uuid; v_name text := btrim(coalesce(p_name,''));
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org)
     or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['VISION_CUSTODIAN']::text[]) then
    raise exception 'Only the active Vision Custodian may change school campuses.';
  end if;
  if length(v_name)<2 or length(v_name)>140 then raise exception 'Enter a campus name between 2 and 140 characters.'; end if;
  if p_mode='create' then
    v_id:=gen_random_uuid();
    insert into public.khpos_ops_campuses(id,organisation_id,code,name,status,created_by)
    values(v_id,p_org,'CAMPUS_'||upper(substr(replace(v_id::text,'-',''),1,12)),v_name,'active',p_actor);
  elsif p_mode='rename' then
    update public.khpos_ops_campuses set name=v_name,updated_at=now()
    where id=p_campus and organisation_id=p_org and status='active' returning id into v_id;
    if v_id is null then raise exception 'Active campus not found in this school.'; end if;
  else
    raise exception 'Unsupported campus change.';
  end if;
  insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
  values(p_org,p_actor,'ops_campus_'||p_mode,'campus',v_id,jsonb_build_object('name',v_name));
  return v_id;
end $$;
revoke all on function public.khpos_ops_manage_campus_server(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.khpos_ops_manage_campus_server(uuid,uuid,text,uuid,text) to service_role;
