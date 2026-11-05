create table public.khpos_class_subject_catalog (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  campus_id uuid references public.khpos_ops_campuses(id),
  label text not null check (length(btrim(label)) between 1 and 120),
  section text not null default '' check (length(section) <= 120),
  check (campus_id is not null or section = '')
);
create unique index khpos_class_subject_catalog_identity on public.khpos_class_subject_catalog
  (organisation_id, campus_id, lower(label), lower(section)) nulls not distinct;
alter table public.khpos_class_subject_catalog enable row level security;
revoke all on public.khpos_class_subject_catalog from public, anon, authenticated;

create function public.khpos_class_subject_catalog_server(p_actor uuid,p_org uuid,p_input jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  campus uuid := (p_input->>'campusId')::uuid;
  entry_label text := btrim(p_input->>'label');
  entry_section text := btrim(coalesce(p_input->>'section',''));
  roles text[] := array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR'];
begin
  if not coalesce(khpos_private.ops_academic_has_membership(p_actor,p_org),false) then
    raise exception 'Active school membership is required.' using errcode='42501';
  end if;
  if p_input is not null then
    if not coalesce(khpos_private.ops_academic_can_plan(p_actor,p_org),false)
      or (campus is not null and not khpos_private.ops_presence_leader(p_actor,p_org,campus,null,roles)) then
      raise exception 'You cannot manage this school or campus list.' using errcode='42501';
    end if;
    if campus is not null and not exists (
      select 1 from public.khpos_ops_campuses c where c.id=campus and c.organisation_id=p_org and c.status='active'
    ) then raise exception 'Choose an active campus in this school.' using errcode='22023'; end if;
    insert into public.khpos_class_subject_catalog(organisation_id,campus_id,label,section)
      values(p_org,campus,entry_label,entry_section) on conflict do nothing;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',c.id,'campusId',c.campus_id,'label',c.label,'section',c.section)
      order by lower(c.label),lower(c.section))
    from public.khpos_class_subject_catalog c
    where c.organisation_id=p_org
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.khpos_class_subject_catalog_server(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.khpos_class_subject_catalog_server(uuid,uuid,jsonb) to service_role;
