create table public.khpos_ksi_roster_shares (
  school_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null,
  workspace_id uuid not null,
  enabled boolean not null,
  primary key (school_id,campus_id,workspace_id)
);
alter table public.khpos_ksi_roster_shares enable row level security;
revoke all on public.khpos_ksi_roster_shares from public,anon,authenticated,service_role;

create function public.khpos_manage_ksi_roster_share(p_actor uuid,p_school uuid,p_campus uuid,p_workspace uuid,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform khpos_private.finance_scope(p_actor,p_school,p_campus);
  if not exists(select 1 from public.khpos_integrations i where i.organisation_id=p_school
    and i.provider='ksi' and i.status='active' and i.external_tenant_id=p_workspace::text) then
    raise exception 'Pair this school with KSI first.' using errcode='42501';
  end if;
  if p_enabled is not null then
    insert into public.khpos_ksi_roster_shares(school_id,campus_id,workspace_id,enabled)
    values(p_school,p_campus,p_workspace,p_enabled)
    on conflict(school_id,campus_id,workspace_id) do update set enabled=excluded.enabled;
  end if;
  return coalesce((select s.enabled from public.khpos_ksi_roster_shares s
    where s.school_id=p_school and s.campus_id=p_campus and s.workspace_id=p_workspace),false);
end
$$;

create function public.khpos_export_roster_to_ksi(p_school uuid,p_workspace uuid,p_campus uuid,p_class uuid,p_term uuid,p_after uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  selected_class public.khpos_class_subject_catalog;
  session_name text;
begin
  if not exists(select 1 from public.khpos_integrations i where i.organisation_id=p_school
    and i.provider='ksi' and i.status='active' and i.external_tenant_id=p_workspace::text)
    or not exists(select 1 from public.khpos_ksi_roster_shares s
      where s.school_id=p_school and s.workspace_id=p_workspace and s.enabled
      and (p_campus is null or s.campus_id=p_campus)) then
    raise exception 'Roster sharing is unavailable.' using errcode='42501';
  end if;

  if p_class is null then
    return coalesce((select jsonb_agg(to_jsonb(choice)) from (
      select c.id,c.campus_id as campus,concat_ws(' · ',c.label,nullif(c.section,'')) as name,
        t.id as term,t.session_label as session, coalesce(to_jsonb(t)->>'name',to_jsonb(t)->>'term_label',left(t.id::text,8)) as "termName"
      from public.khpos_ksi_roster_shares s
      join public.khpos_class_subject_catalog c on c.organisation_id=s.school_id and c.campus_id=s.campus_id
      join public.khpos_ops_academic_terms t on t.organisation_id=s.school_id and (t.campus_id is null or t.campus_id=s.campus_id)
      where s.school_id=p_school and s.workspace_id=p_workspace and s.enabled and c.available and t.status<>'cancelled'
      order by t.session_label desc,c.label,c.section,c.id,t.id limit 500
    ) choice),'[]'::jsonb);
  end if;

  select * into selected_class from public.khpos_class_subject_catalog c
    where c.id=p_class and c.organisation_id=p_school and c.campus_id=p_campus and c.available;
  select t.session_label into session_name from public.khpos_ops_academic_terms t
    where t.id=p_term and t.organisation_id=p_school and (t.campus_id is null or t.campus_id=p_campus) and t.status<>'cancelled';
  if selected_class.id is null or session_name is null then
    raise exception 'Choose a campus, class and term.' using errcode='22023';
  end if;

  return jsonb_build_object('session',session_name,'learners',coalesce((
    select jsonb_agg(to_jsonb(learner) order by learner.id) from (
      select a.id,a.display_name as name,f.admission_number as admission,l.ksi_learner_id as linked
      from public.khpos_ops_learner_anchors a
      join public.khpos_finance_learners f on f.learner_id=a.id and f.school_id=p_school
      left join public.khpos_ksi_learner_links l on l.learner_id=a.id and l.school_id=p_school and l.workspace_id=p_workspace
      where a.organisation_id=p_school and a.campus_id=p_campus and a.class_label=selected_class.label
        and coalesce(a.section_label,'')=selected_class.section and a.status='active' and f.enrolment_status='active'
        and f.academic_term_id=p_term and (p_after is null or a.id>p_after)
      order by a.id limit 50
    ) learner),'[]'::jsonb));
end
$$;

revoke all on function public.khpos_manage_ksi_roster_share(uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.khpos_manage_ksi_roster_share(uuid,uuid,uuid,uuid,boolean) to service_role;
revoke all on function public.khpos_export_roster_to_ksi(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.khpos_export_roster_to_ksi(uuid,uuid,uuid,uuid,uuid,uuid) to service_role;
