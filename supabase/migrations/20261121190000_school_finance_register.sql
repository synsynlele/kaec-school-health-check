-- Finance uses the existing learner anchor as the permanent learner identity.
create table public.khpos_finance_learners (
  learner_id uuid primary key references public.khpos_ops_learner_anchors(id),
  school_id uuid not null references public.organisations(id),
  admission_number text not null check (length(admission_number) between 1 and 120),
  academic_term_id uuid not null references public.khpos_ops_academic_terms(id),
  admitted_on date,
  enrolment_status text not null check(enrolment_status in ('active','graduated','transferred','withdrawn')),
  guardian_name text not null default '',
  guardian_contact text not null default '',
  household text not null default '',
  fee_category text not null default '',
  assistance text not null default '',
  updated_at timestamptz not null default now()
);
create unique index khpos_finance_admission_number
  on public.khpos_finance_learners(school_id, lower(admission_number));

create table public.khpos_finance_audit (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.organisations(id),
  campus_id uuid not null references public.khpos_ops_campuses(id),
  actor_id uuid not null references auth.users(id),
  action text not null,
  record_id uuid,
  detail jsonb not null default '{}',
  happened_at timestamptz not null default now()
);
create index khpos_finance_audit_scope on public.khpos_finance_audit(school_id,campus_id,id desc);

alter table public.khpos_finance_learners enable row level security;
alter table public.khpos_finance_audit enable row level security;
revoke all on public.khpos_finance_learners,public.khpos_finance_audit from public,anon,authenticated,service_role;

create function khpos_private.finance_access(actor uuid, school uuid, campus uuid, custodian boolean default false)
returns boolean language sql stable set search_path='' as $$
  select exists (
    select 1 from public.organisations o
    join public.organisation_memberships m on m.organisation_id=o.id
    join public.khpos_ops_roles r on r.organisation_id=o.id
    join public.khpos_ops_role_assignments a on a.role_id=r.id and a.user_id=m.user_id
    where o.id=school and o.status='active' and o.partner_status='active'
      and 'khpos_core'=any(o.partner_entitlements)
      and m.user_id=actor and m.status='active' and r.status='active' and a.status='active'
      and a.unit_id is null
      and a.start_date <= (now() at time zone 'Africa/Lagos')::date
      and (a.end_date is null or a.end_date >= (now() at time zone 'Africa/Lagos')::date)
      and (r.code in ('SCHOOL_CUSTODIAN','VISION_CUSTODIAN') or (not custodian and r.code='FINANCE_ADMIN_OFFICER'))
      and (a.campus_id is null or a.campus_id=campus)
      and (campus is null or exists(
        select 1 from public.khpos_ops_campuses c where c.id=campus and c.organisation_id=school and c.status='active'
      ))
  )
$$;

create function khpos_private.finance_scope(actor uuid, school uuid, campus uuid, custodian boolean default false)
returns void language plpgsql stable set search_path='' as $$
begin
  if not khpos_private.finance_access(actor,school,campus,custodian) then
    raise exception 'Your school or campus appointment does not permit this finance action.' using errcode='42501';
  end if;
end
$$;

create function khpos_private.finance_learner(actor uuid, school uuid, campus uuid, item jsonb, preview boolean default false)
returns jsonb language plpgsql set search_path='' as $$
declare
  admission text := btrim(item->>'admission');
  full_name text := btrim(item->>'name');
  enrolment text := coalesce(nullif(item->>'status',''),'active');
  term uuid := (item->>'term')::uuid;
  class_row public.khpos_class_subject_catalog;
  anchor public.khpos_ops_learner_anchors;
  learner uuid;
  destination uuid := coalesce(nullif(item->>'destinationCampus','')::uuid,campus);
  requested uuid := nullif(item->>'id','')::uuid;
  matched uuid[];
  admitted date := nullif(item->>'admittedOn','')::date;
begin
  perform khpos_private.finance_scope(actor,school,campus);
  if destination<>campus then
    if requested is null then raise exception 'Select an existing learner before changing campus.' using errcode='22023'; end if;
    perform khpos_private.finance_scope(actor,school,destination);
  end if;
  if not preview then perform pg_advisory_xact_lock(hashtextextended('finance:'||school::text,0)); end if;
  if coalesce(length(admission),0) not between 1 and 120 or coalesce(length(full_name),0) not between 1 and 240 then
    raise exception 'Enter an admission number and learner name.' using errcode='22023';
  end if;
  if enrolment not in ('active','graduated','transferred','withdrawn') then
    raise exception 'Choose a valid enrolment status.' using errcode='22023';
  end if;
  select * into class_row from public.khpos_class_subject_catalog c
   where c.organisation_id=school and c.campus_id=destination and c.available and
     (c.id::text=item->>'class' or (
       lower(c.label)=lower(btrim(item->>'class')) and lower(c.section)=lower(btrim(coalesce(item->>'arm','')))
     ));
  if not found then raise exception 'Choose an available class and arm for this campus.' using errcode='22023'; end if;
  if not exists(select 1 from public.khpos_ops_academic_terms t where t.id=term
    and t.organisation_id=school and (t.campus_id is null or t.campus_id=destination) and t.status<>'cancelled') then
    raise exception 'Choose an academic term for this campus.' using errcode='22023';
  end if;

  select l.learner_id into learner from public.khpos_finance_learners l
   where l.school_id=school and lower(l.admission_number)=lower(admission);
  if requested is not null then
    if learner is not null and learner<>requested then
      raise exception 'This admission number is already in use.' using errcode='23505';
    end if;
    learner := requested;
  elsif learner is null then
    select array_agg(a.id) into matched from public.khpos_ops_learner_anchors a where a.organisation_id=school
      and lower(btrim(a.external_learner_reference))=lower(admission);
    if cardinality(matched)>1 then
      raise exception 'Several existing learner records match this admission number. Review their records first.' using errcode='23505';
    end if;
    learner := matched[1];
  end if;

  if learner is not null then
    select * into anchor from public.khpos_ops_learner_anchors a where a.organisation_id=school and a.id=learner;
    if not found then raise exception 'Learner could not be found in this school.' using errcode='22023'; end if;
    perform khpos_private.finance_scope(actor,school,anchor.campus_id);
    if requested is null and lower(btrim(anchor.display_name))<>lower(full_name) then
      raise exception 'This admission number already belongs to a learner with a different name. Review the existing record.' using errcode='23505';
    end if;
    if requested is null and anchor.campus_id<>campus then
      raise exception 'Use the learner editor for a campus transfer.' using errcode='22023';
    end if;
    if requested is null and exists(select 1 from public.khpos_finance_learners l where l.learner_id=learner) then
      return jsonb_build_object('id',learner,'result','already registered');
    end if;
  elsif exists(select 1 from public.khpos_ops_learner_anchors a
    where a.organisation_id=school and a.campus_id=campus and a.status='active'
      and lower(btrim(a.display_name))=lower(full_name)
      and lower(a.class_label)=lower(class_row.label)
      and lower(coalesce(a.section_label,''))=lower(class_row.section))
    and coalesce(item->>'confirmDistinct','false')<>'true' then
    raise exception 'A learner with this name and class already exists. Check their admission number or confirm a separate identity.' using errcode='23505';
  end if;
  if preview then return jsonb_build_object('id',learner,'result',case when learner is null then 'new' else 'link existing' end); end if;

  if learner is null then
    insert into public.khpos_ops_learner_anchors(
      organisation_id,campus_id,external_system,external_learner_reference,display_name,class_label,section_label,status,created_by
    ) values(school,campus,'manual',admission,full_name,class_row.label,nullif(class_row.section,''),
      case when enrolment='active' then 'active' else 'left' end,actor)
    returning id into learner;
  elsif requested is not null then
    update public.khpos_ops_learner_anchors a set campus_id=destination,display_name=full_name,class_label=class_row.label,
      section_label=nullif(class_row.section,''),status=case when enrolment='active' then 'active' else 'left' end,updated_at=now()
    where a.id=learner;
  elsif anchor.class_label<>class_row.label or coalesce(anchor.section_label,'')<>class_row.section
    or ((anchor.status='active')<>(enrolment='active')) then
    raise exception 'Review the existing learner’s class and status in the learner editor before linking this record.' using errcode='22023';
  end if;

  insert into public.khpos_finance_learners(learner_id,school_id,admission_number,academic_term_id,admitted_on,enrolment_status,
    guardian_name,guardian_contact,household,fee_category,assistance)
  values(learner,school,admission,term,admitted,enrolment,left(coalesce(item->>'guardian',''),160),
    left(coalesce(item->>'contact',''),160),left(coalesce(item->>'household',''),120),
    left(coalesce(item->>'feeCategory',''),100),left(coalesce(item->>'assistance',''),160))
  on conflict(learner_id) do update set admission_number=excluded.admission_number,academic_term_id=excluded.academic_term_id,
    admitted_on=excluded.admitted_on,enrolment_status=excluded.enrolment_status,guardian_name=excluded.guardian_name,
    guardian_contact=excluded.guardian_contact,household=excluded.household,fee_category=excluded.fee_category,
    assistance=excluded.assistance,updated_at=now();
  insert into public.khpos_finance_audit(school_id,campus_id,actor_id,action,record_id,detail)
  values(school,destination,actor,case when requested is null then 'register learner' when destination<>anchor.campus_id then 'transfer learner' else 'edit learner' end,learner,
    jsonb_build_object('previousCampus',anchor.campus_id,'class',class_row.id,'term',term,'status',enrolment));
  if destination<>campus then
    insert into public.khpos_finance_audit(school_id,campus_id,actor_id,action,record_id,detail)
    values(school,campus,actor,'transfer learner to another campus',learner,jsonb_build_object('destinationCampus',destination));
  end if;
  return jsonb_build_object('id',learner,'result','saved');
end
$$;

create function public.khpos_finance_register_server(p_actor uuid,p_school uuid,p_campus uuid,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  item jsonb;
  result jsonb := '[]';
  search text := lower(btrim(coalesce(p_input->>'search','')));
  page_offset integer := greatest(0,least(coalesce((p_input->>'offset')::integer,0),250000));
begin
  if p_action='context' then
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,
      'canApprove',khpos_private.finance_access(p_actor,p_school,c.id,true)) order by c.name),'[]')
      into result from public.khpos_ops_campuses c where c.organisation_id=p_school and c.status='active'
        and khpos_private.finance_access(p_actor,p_school,c.id);
    if result='[]' then
      raise exception 'No active school finance appointment was found.' using errcode='42501';
    end if;
    return jsonb_build_object('campuses',result,'school',(select o.name from public.organisations o where o.id=p_school),
      'schoolWide',khpos_private.finance_access(p_actor,p_school,null));
  end if;
  if p_campus is null then raise exception 'Choose a campus.' using errcode='22023'; end if;
  perform khpos_private.finance_scope(p_actor,p_school,p_campus);
  case p_action
    when 'catalog' then
      return jsonb_build_object('classes',coalesce((
        select jsonb_agg(jsonb_build_object('id',c.id,'name',c.label,'arm',c.section) order by c.label,c.section)
        from public.khpos_class_subject_catalog c where c.organisation_id=p_school and c.campus_id=p_campus and c.available
      ),'[]'),'terms',coalesce((
        select jsonb_agg(jsonb_build_object('id',t.id,'name',t.term_name,'session',t.session_label,
          'start',t.start_date,'end',t.end_date,'status',t.status) order by t.start_date desc)
        from public.khpos_ops_academic_terms t where t.organisation_id=p_school
          and (t.campus_id is null or t.campus_id=p_campus) and t.status<>'cancelled'
      ),'[]'));
    when 'learners' then
      return coalesce((select jsonb_agg(to_jsonb(rows)) from (
        select a.id,a.display_name as name,a.class_label as class,coalesce(a.section_label,'') as arm,
          coalesce(f.admission_number,a.external_learner_reference) as admission,f.academic_term_id as term,
          f.admitted_on as "admittedOn",f.enrolment_status as status,f.guardian_name as guardian,f.guardian_contact as contact,
          f.household,f.fee_category as "feeCategory",f.assistance
        from public.khpos_ops_learner_anchors a left join public.khpos_finance_learners f
          on f.learner_id=a.id and f.school_id=p_school
        where a.organisation_id=p_school and a.campus_id=p_campus
          and (search='' or strpos(lower(a.display_name),search)>0
            or strpos(lower(coalesce(f.admission_number,a.external_learner_reference)),search)>0)
          and (nullif(p_input->>'class','') is null or a.class_label=p_input->>'class')
          and (nullif(p_input->>'session','') is null or exists(
            select 1 from public.khpos_ops_academic_terms t where t.id=f.academic_term_id and t.session_label=p_input->>'session'
          ))
          and (nullif(p_input->>'status','') is null or f.enrolment_status=p_input->>'status')
        order by case when p_input->>'sort'='admission' then lower(coalesce(f.admission_number,a.external_learner_reference)) end,
          case when p_input->>'sort'='recent' then f.updated_at end desc nulls last,lower(a.display_name),a.id offset page_offset limit 51
      ) rows),'[]');
    when 'saveLearner' then return khpos_private.finance_learner(p_actor,p_school,p_campus,p_input);
    when 'previewLearners','importLearners' then
      if jsonb_typeof(p_input->'rows') is distinct from 'array' or jsonb_array_length(p_input->'rows') not between 1 and 50 then
        raise exception 'Send between 1 and 50 learner rows.' using errcode='22023';
      end if;
      if p_action='importLearners' then
        perform pg_advisory_xact_lock(hashtextextended('finance:'||p_school::text,0));
      end if;
      for item in select value from jsonb_array_elements(p_input->'rows') loop
        begin
          result := result || jsonb_build_array(khpos_private.finance_learner(p_actor,p_school,p_campus,item-'id',p_action='previewLearners'));
        exception when sqlstate '22023' or unique_violation or invalid_text_representation
          or invalid_datetime_format or datetime_field_overflow or insufficient_privilege then
          result := result || jsonb_build_array(jsonb_build_object('result','error','message',
            case when sqlstate in ('22023','42501') then sqlerrm when sqlstate='23505' then
              'A matching learner already exists. Check the admission number and name.' else 'Check dates and identifiers.' end));
        end;
      end loop;
      return result;
    else raise exception 'Choose a supported register action.' using errcode='22023';
  end case;
end
$$;

revoke all on function khpos_private.finance_access(uuid,uuid,uuid,boolean),
  khpos_private.finance_scope(uuid,uuid,uuid,boolean),khpos_private.finance_learner(uuid,uuid,uuid,jsonb,boolean)
  from public,anon,authenticated,service_role;
revoke all on function public.khpos_finance_register_server(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_finance_register_server(uuid,uuid,uuid,text,jsonb) to service_role;
