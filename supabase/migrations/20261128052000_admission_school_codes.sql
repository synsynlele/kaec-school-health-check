create table khpos_private.admission_school_codes (
  school_id uuid primary key references public.organisations(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{2,12}$')
);
alter table khpos_private.admission_school_codes enable row level security;
revoke all on khpos_private.admission_school_codes from public,anon,authenticated,service_role;

insert into khpos_private.admission_school_codes(school_id,code)
select id,'KNS' from public.organisations where id='08f3a10a-94c5-4c2f-937c-9d28d8334d7b';

create or replace function khpos_private.next_admission_number(school uuid, code text, minimum bigint default 0)
returns text language plpgsql security definer set search_path='' as $$
declare
  prefix text := 'KSI//'||code||'/';
  suffix text := coalesce((select '/'||c.code from khpos_private.admission_school_codes c where c.school_id=school),'');
  highest bigint;
  allocated bigint;
begin
  if code is null or code !~ '^[js][123]$' or minimum not between 0 and 999999999999 then
    raise exception 'Choose a supported JSS or SS class.' using errcode='22023';
  end if;
  select coalesce(max((split_part(substring(ref from length(prefix)+1),'/',1))::bigint),0) into highest
    from (select admission_number as ref from public.khpos_finance_learners where school_id=school union all select external_learner_reference from public.khpos_ops_learner_anchors where organisation_id=school) records
    where ref ~* ('^'||prefix||'[0-9]{1,12}('||suffix||')?);
  highest := greatest(highest,minimum);
  insert into khpos_private.admission_sequences as seq(school_id,class_code,allocation)
    values(school,code,highest+1)
    on conflict(school_id,class_code) do update
      set allocation=greatest(seq.allocation,excluded.allocation-1)+1
    returning allocation into allocated;
  return prefix||lpad(allocated::text,greatest(4,length(allocated::text)),'0')||suffix;
end
$$;);
  highest := greatest(highest,minimum);
  insert into khpos_private.admission_sequences as seq(school_id,class_code,allocation)
    values(school,code,highest+1)
    on conflict(school_id,class_code) do update
      set allocation=greatest(seq.allocation,excluded.allocation-1)+1
    returning allocation into allocated;
  return prefix||lpad(allocated::text,greatest(4,length(allocated::text)),'0');
end
$$;

create or replace function public.khpos_prepare_learner_admission(p_actor uuid,p_school uuid,p_campus uuid,p_class uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  code text;
  workspace uuid;
  prefix text;
  suffix text := coalesce((select '/'||c.code from khpos_private.admission_school_codes c where c.school_id=p_school),'');
  floor bigint;
begin
  perform khpos_private.finance_scope(p_actor,p_school,p_campus);
  select khpos_private.admission_class_code(c.label) into code
    from public.khpos_class_subject_catalog c where c.id=p_class and c.organisation_id=p_school and c.campus_id=p_campus and c.available;
  if code is null then raise exception 'Enter an admission number for this class.' using errcode='22023'; end if;
  select external_tenant_id::uuid into workspace from public.khpos_integrations
    where organisation_id=p_school and provider='ksi' and status='active';
  if workspace is null then return jsonb_build_object('number',khpos_private.next_admission_number(p_school,code)); end if;
  prefix := 'KSI//'||code||'/';
  select coalesce(max(split_part(substring(ref from length(prefix)+1),'/',1)::bigint),0) into floor from (
    select admission_number as ref from public.khpos_finance_learners where school_id=p_school
    union all select external_learner_reference from public.khpos_ops_learner_anchors where organisation_id=p_school
  ) refs where ref ~* ('^'||prefix||'[0-9]{1,12}('||suffix||')?);
  return jsonb_build_object('workspace',workspace,'code',code,'minimum',floor);
end
$$;);
  return jsonb_build_object('workspace',workspace,'code',code,'minimum',floor);
end
$$;
