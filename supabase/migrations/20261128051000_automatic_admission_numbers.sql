
create table khpos_private.admission_sequences (
  school_id uuid not null,
  class_code text not null,
  allocation bigint not null,
  primary key(school_id,class_code)
);
alter table khpos_private.admission_sequences enable row level security;
revoke all on khpos_private.admission_sequences from public,anon,authenticated;

create function khpos_private.admission_class_code(class_name text)
returns text language sql immutable set search_path='' as $$
  select regexp_replace(regexp_replace(raw, '[[:space:]]', '', 'g'), '^(jss|sss|ss)', left(raw,1))
  from (  select replace(substring(lower(btrim(class_name)) from '^(jss[[:space:]]*[123]|sss?[[:space:]]*[123]|[js][123])(?:[^0-9]|$)'), ' ', '')
) as matched(raw);
$$;

create function khpos_private.next_admission_number(school uuid, code text, minimum bigint default 0)
returns text language plpgsql security definer set search_path='' as $$
declare
  prefix text := 'KSI//'||code||'/';
  highest bigint;
  allocated bigint;
begin
  if code is null or code !~ '^[js][123]$' or minimum not between 0 and 999999999999 then
    raise exception 'Choose a supported JSS or SS class.' using errcode='22023';
  end if;
  select coalesce(max((right(ref,length(ref)-length(prefix)))::bigint),0) into highest
    from (select admission_number as ref from public.khpos_finance_learners where school_id=school union all select external_learner_reference from public.khpos_ops_learner_anchors where organisation_id=school) records
    where ref ~* ('^'||prefix||'[0-9]{1,12}$');
  highest := greatest(highest,minimum);
  insert into khpos_private.admission_sequences as seq(school_id,class_code,allocation)
    values(school,code,highest+1)
    on conflict(school_id,class_code) do update
      set allocation=greatest(seq.allocation,excluded.allocation-1)+1
    returning allocation into allocated;
  return prefix||lpad(allocated::text,greatest(4,length(allocated::text)),'0');
end
$$;
revoke all on function khpos_private.next_admission_number(uuid,text,bigint) from public,anon,authenticated,service_role;

create function public.khpos_prepare_learner_admission(p_actor uuid,p_school uuid,p_campus uuid,p_class uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  code text;
  workspace uuid;
  prefix text;
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
  select coalesce(max(right(ref,length(ref)-length(prefix))::bigint),0) into floor from (
    select admission_number as ref from public.khpos_finance_learners where school_id=p_school
    union all select external_learner_reference from public.khpos_ops_learner_anchors where organisation_id=p_school
  ) refs where ref ~* ('^'||prefix||'[0-9]{1,12}$');
  return jsonb_build_object('workspace',workspace,'code',code,'minimum',floor);
end
$$;
revoke all on function public.khpos_prepare_learner_admission(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.khpos_prepare_learner_admission(uuid,uuid,uuid,uuid) to service_role;
