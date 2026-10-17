-- A campus can serve any combination of learning stages; no sections are seeded automatically.
alter table public.khpos_ops_units add column learning_stage text check(learning_stage in ('preschool','lower_primary','upper_primary','junior_secondary','senior_secondary','other'));

create function public.khpos_learning_sections_server(p_actor uuid,p_school uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.'; end if;
 return jsonb_build_object(
 'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'canManage',khpos_private.announcements_publish_scope(p_actor,p_school,c.id,null)) order by c.name) from public.khpos_ops_campuses c where c.organisation_id=p_school and c.status='active'),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'campusId',u.campus_id,'name',u.name,'stage',coalesce(u.learning_stage,'other'),'status',u.status,'updatedAt',u.updated_at,'canManage',u.campus_id is not null and khpos_private.announcements_publish_scope(p_actor,p_school,u.campus_id,null)) order by u.name) from public.khpos_ops_units u where u.organisation_id=p_school and u.unit_type='academic_section'),'[]'::jsonb));
end $$;
create function public.khpos_learning_section_action_server(p_actor uuid,p_school uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u public.khpos_ops_units%rowtype; c uuid:=nullif(p_input->>'campusId','')::uuid; v_id uuid:=nullif(p_input->>'id','')::uuid; title text:=btrim(coalesce(p_input->>'name','')); v_stage text:=p_input->>'stage'; v_status text:=coalesce(p_input->>'status','active'); v_note text:=btrim(coalesce(p_input->>'note',''));
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.'; end if;
 if v_id is not null then
  select * into u from public.khpos_ops_units where id=v_id and organisation_id=p_school and unit_type='academic_section' for update;
  if not found then raise exception 'Learning section not found.'; end if;
  if c is distinct from u.campus_id then raise exception 'A section cannot move campus. Create a new section and reassign current work through its normal controls.'; end if;
  if (p_input->>'updatedAt')::timestamptz is distinct from u.updated_at then raise exception 'Section changed. Refresh before editing.'; end if;
  if length(v_note) not between 5 and 2000 then raise exception 'Explain this section change in 5–2,000 characters.'; end if;
 end if;
 if c is null or not exists(select 1 from public.khpos_ops_campuses where id=c and organisation_id=p_school and status='active') or not khpos_private.announcements_publish_scope(p_actor,p_school,c,null) then raise exception 'Your current role cannot manage sections in this campus.'; end if;
 if length(title) not between 3 and 100 or v_stage is null or v_stage not in ('preschool','lower_primary','upper_primary','junior_secondary','senior_secondary','other') or v_status not in ('active','inactive') then raise exception 'Choose a valid section name, learning stage and status.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_school::text||c::text,0));
 if exists(select 1 from public.khpos_ops_units existing where existing.organisation_id=p_school and existing.campus_id=c and existing.unit_type='academic_section' and lower(btrim(existing.name))=lower(title) and (v_id is null or existing.id<>v_id)) then raise exception 'This section name already exists in this campus. Edit or reactivate it instead.'; end if;
 if v_status='inactive' and v_id is not null and (
 exists(select 1 from public.khpos_ops_role_assignments where unit_id=v_id and status='active')
 or exists(select 1 from public.khpos_ops_staff where unit_id=v_id and status in ('active','onboarding'))
 or exists(select 1 from public.khpos_ops_academic_delivery_streams where unit_id=v_id and status in ('draft','approved','active'))
 ) then raise exception 'Reassign active staff, positions and teaching streams before disabling this section.'; end if;
 if v_id is null then
  insert into public.khpos_ops_units(organisation_id,campus_id,code,name,unit_type,learning_stage,status,created_by)
  values(p_school,c,'SEC_'||replace(gen_random_uuid()::text,'-',''),title,'academic_section',v_stage,v_status,p_actor) returning id into v_id;
 else
  update public.khpos_ops_units set name=title,learning_stage=v_stage,status=v_status,updated_at=clock_timestamp() where id=v_id;
 end if;
 insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
 values(p_school,p_actor,'learning_section_saved','unit',v_id,jsonb_build_object('before',case when u.id is null then null else to_jsonb(u) end,'name',title,'stage',v_stage,'status',v_status,'reason',v_note));
 return v_id;
end $$;
revoke execute on function public.khpos_learning_sections_server(uuid,uuid),public.khpos_learning_section_action_server(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_learning_sections_server(uuid,uuid),public.khpos_learning_section_action_server(uuid,uuid,jsonb) to service_role;
