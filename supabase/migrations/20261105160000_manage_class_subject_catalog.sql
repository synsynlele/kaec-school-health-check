alter table public.khpos_class_subject_catalog add column available boolean not null default true;

create or replace function public.khpos_class_subject_catalog_server(p_actor uuid,p_org uuid,p_input jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  campus uuid := (p_input->>'campusId')::uuid;
  entry_label text := btrim(p_input->>'label');
  entry_section text := btrim(coalesce(p_input->>'section',''));
  action text := coalesce(p_input->>'action','add');
  entry public.khpos_class_subject_catalog;
  roles text[] := array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'];
begin
  if not coalesce(khpos_private.ops_academic_has_membership(p_actor,p_org),false) then
    raise exception 'Active school membership is required.' using errcode='42501';
  end if;
  if p_input is not null then
    if action <> 'add' then
      select * into entry from public.khpos_class_subject_catalog c
        where c.id=(p_input->>'id')::uuid and c.organisation_id=p_org for update;
      if not found then raise exception 'Class or subject not found.' using errcode='22023'; end if;
      campus := entry.campus_id;
    end if;
    if not coalesce(khpos_private.ops_academic_can_plan(p_actor,p_org),false)
      or (campus is not null and not khpos_private.ops_presence_leader(p_actor,p_org,campus,null,roles)) then
      raise exception 'You cannot manage this school or campus list.' using errcode='42501';
    end if;
    if action = 'add' and campus is not null and not exists (
      select 1 from public.khpos_ops_campuses c where c.id=campus and c.organisation_id=p_org and c.status='active'
    ) then raise exception 'Choose an active campus in this school.' using errcode='22023'; end if;
    case action
      when 'add' then
        insert into public.khpos_class_subject_catalog(organisation_id,campus_id,label,section)
          values(p_org,campus,entry_label,entry_section) on conflict do nothing;
      when 'edit' then
        update public.khpos_class_subject_catalog set label=entry_label, section=entry_section where id=entry.id;
      when 'availability' then
        update public.khpos_class_subject_catalog set available=(p_input->>'available')::boolean where id=entry.id;
      when 'delete' then
        delete from public.khpos_class_subject_catalog where id=entry.id;
      else raise exception 'Unknown catalog action.' using errcode='22023';
    end case;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',c.id,'campusId',c.campus_id,'label',c.label,'section',c.section,'available',c.available)
      order by lower(c.label),lower(c.section))
    from public.khpos_class_subject_catalog c
    where c.organisation_id=p_org
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.khpos_class_subject_catalog_server(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.khpos_class_subject_catalog_server(uuid,uuid,jsonb) to service_role;
