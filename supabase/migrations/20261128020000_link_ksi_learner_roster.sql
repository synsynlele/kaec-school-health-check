create table public.khpos_ksi_learner_links (
  school_id uuid not null references public.organisations(id) on delete cascade,
  workspace_id uuid not null,
  ksi_learner_id uuid not null,
  learner_id uuid not null unique references public.khpos_ops_learner_anchors(id),
  linked_at timestamptz not null default now(),
  primary key(school_id,workspace_id,ksi_learner_id)
);
alter table public.khpos_ksi_learner_links enable row level security;
revoke all on public.khpos_ksi_learner_links from public,anon,authenticated,service_role;

create function public.khpos_import_ksi_roster(p_actor uuid,p_school uuid,p_campus uuid,p_workspace uuid,p_class uuid,p_term uuid,p_session text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  item jsonb;
  source_id uuid;
  admission text;
  learner_name text;
  local_id uuid;
  class_row public.khpos_class_subject_catalog;
  anchor public.khpos_ops_learner_anchors;
  finance public.khpos_finance_learners;
  result jsonb := '[]'::jsonb;
  saved jsonb;
begin
  perform khpos_private.finance_scope(p_actor,p_school,p_campus);
  if not exists(select 1 from public.khpos_integrations i where i.organisation_id=p_school
    and i.provider='ksi' and i.status='active' and i.external_tenant_id=p_workspace::text) then
    raise exception 'Connect this school to KSI first.' using errcode='42501';
  end if;
  select * into class_row from public.khpos_class_subject_catalog c
    where c.id=p_class and c.organisation_id=p_school and c.campus_id=p_campus and c.available;
  if not found or not exists(select 1 from public.khpos_ops_academic_terms t
    where t.id=p_term and t.organisation_id=p_school and (t.campus_id is null or t.campus_id=p_campus) and t.status<>'cancelled'
    and regexp_replace(t.session_label,'^([0-9]{4})[/-](?:[0-9]{2})?([0-9]{2})$','\1/\2')
      =regexp_replace(p_session,'^([0-9]{4})[/-](?:[0-9]{2})?([0-9]{2})$','\1/\2'))
    or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>50 then
    raise exception 'Choose a class, campus and term in this school.' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('finance:'||p_school::text,0));
  for item in select value from jsonb_array_elements(p_rows)
  loop
    begin
      source_id := (item->>'id')::uuid;
      admission := btrim(item->>'admission');
      learner_name := btrim(item->>'name');
      if source_id is null or coalesce(length(admission),0) not between 1 and 120
        or coalesce(length(learner_name),0) not between 1 and 240 then
        raise exception 'Add a valid name and admission number in KSI.' using errcode='22023';
      end if;

      select link.learner_id into local_id from public.khpos_ksi_learner_links link
        where link.school_id=p_school and link.workspace_id=p_workspace and link.ksi_learner_id=source_id;
      if local_id is null then
        saved := khpos_private.finance_learner(p_actor,p_school,p_campus,jsonb_build_object(
          'name',learner_name,'admission',admission,'class',p_class,'term',p_term,'status','active'));
        local_id := (saved->>'id')::uuid;
      end if;

      select * into anchor from public.khpos_ops_learner_anchors a where a.id=local_id and a.organisation_id=p_school;
      select * into finance from public.khpos_finance_learners f where f.learner_id=local_id and f.school_id=p_school;
      if anchor.campus_id is distinct from p_campus or anchor.class_label is distinct from class_row.label
        or coalesce(anchor.section_label,'') is distinct from class_row.section
        or lower(finance.admission_number) is distinct from lower(admission)
        or anchor.status is distinct from 'active' or finance.enrolment_status is distinct from 'active' then
        raise exception 'The existing KHP-OS record has a different class, campus, admission number or status. Review it before syncing.' using errcode='22023';
      end if;

      insert into public.khpos_ksi_learner_links(school_id,workspace_id,ksi_learner_id,learner_id)
        values(p_school,p_workspace,source_id,local_id) on conflict(school_id,workspace_id,ksi_learner_id) do nothing;

      update public.khpos_ops_learner_anchors set display_name=learner_name,last_synced_at=now(),
        updated_at=case when display_name is distinct from learner_name then now() else updated_at end
        where id=local_id;
      update public.khpos_finance_learners set academic_term_id=p_term,updated_at=now()
        where learner_id=local_id and academic_term_id is distinct from p_term;
      result := result || jsonb_build_array(jsonb_build_object('admission',admission,'result','synced'));
    exception when sqlstate '22023' or unique_violation or invalid_text_representation then
      result := result || jsonb_build_array(jsonb_build_object('admission',admission,'name',learner_name,'result','review',
        'message',case when sqlstate='23505' then 'An existing learner may match. Review the admission number and linked account.' else sqlerrm end));
    end;
  end loop;
  return result;
end
$$;
revoke all on function public.khpos_import_ksi_roster(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_import_ksi_roster(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;
