-- Guardians can review campus totals through the oversight RPC.
-- Existing finance_scope checks remain the authority for ledger actions.
create function khpos_private.finance_guardian_access(actor uuid, school uuid, campus uuid)
returns boolean language sql stable set search_path='' as $$
  select exists (
    select 1 from public.organisations o
    join public.organisation_memberships m on m.organisation_id=o.id
    join public.khpos_ops_roles r on r.organisation_id=o.id
    join public.khpos_ops_role_assignments a on a.role_id=r.id and a.user_id=m.user_id
    join public.khpos_ops_campuses c on c.organisation_id=o.id and c.id=campus and c.status='active'
    where o.id=school and o.status='active' and o.partner_status='active'
      and 'khpos_core'=any(o.partner_entitlements)
      and m.user_id=actor and m.status='active' and r.status='active' and a.status='active'
      and r.code='SCHOOL_GUARDIAN' and a.unit_id is null
      and (a.campus_id is null or a.campus_id=c.id)
      and a.start_date <= (now() at time zone 'Africa/Lagos')::date
      and (a.end_date is null or a.end_date >= (now() at time zone 'Africa/Lagos')::date)
  )
$$;
revoke all on function khpos_private.finance_guardian_access(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.khpos_finance_register_server(p_actor uuid,p_school uuid,p_campus uuid,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  item jsonb;
  result jsonb := '[]';
  search text := lower(btrim(coalesce(p_input->>'search','')));
  page_offset integer := greatest(0,least(coalesce((p_input->>'offset')::integer,0),250000));
begin
  if p_action='context' then
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,
      'canApprove',khpos_private.finance_access(p_actor,p_school,c.id,true),
      'canManage',khpos_private.finance_access(p_actor,p_school,c.id)) order by c.name),'[]')
      into result from public.khpos_ops_campuses c where c.organisation_id=p_school and c.status='active'
        and (khpos_private.finance_access(p_actor,p_school,c.id)
          or khpos_private.finance_guardian_access(p_actor,p_school,c.id));
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

create function public.khpos_finance_oversight_server(p_actor uuid,p_school uuid,p_campus uuid,p_action text,p_input jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  period public.khpos_finance_periods;
  summary jsonb;
  through_date date;
begin
  if not khpos_private.finance_guardian_access(p_actor,p_school,p_campus) then
    raise exception 'An active School Guardian appointment for this campus is required.' using errcode='42501';
  end if;

  if p_action='periods' then
    return coalesce((select jsonb_agg(jsonb_build_object(
      'id',f.id,'name',t.term_name,'session',t.session_label,'starts',f.starts,'ends',f.ends,
      'closed',f.closed,'status',t.status) order by f.starts desc,f.id)
      from public.khpos_finance_periods f
      join public.khpos_ops_academic_terms t on t.id=f.term_id
      where f.school_id=p_school and f.campus_id=p_campus),'[]'::jsonb);
  end if;

  if p_action is distinct from 'summary' then
    raise exception 'Choose a finance oversight report.' using errcode='22023';
  end if;
  select * into period from public.khpos_finance_periods f
    where f.id=(p_input->>'period')::uuid and f.school_id=p_school and f.campus_id=p_campus;
  if period.id is null then
    raise exception 'Choose a configured accounting period for this campus.' using errcode='22023';
  end if;

  through_date := least(period.ends,(now() at time zone 'Africa/Lagos')::date);
  if through_date<period.starts then return jsonb_build_object('future',true); end if;
  summary := khpos_private.finance_summary(p_school,p_campus,period.starts,through_date);
  return jsonb_build_object(
    'from',period.starts,'through',through_date,
    'invoiced',summary->'invoiced','feeReceipts',summary->'feeReceipts',
    'balance',summary->'balance','overdue',summary->'overdue',
    'otherIncome',summary->'otherIncome','expenses',summary->'expenses',
    'budget',(select coalesce(sum(b.amount),0) from public.khpos_finance_budgets b where b.period_id=period.id)
  );
end
$$;
revoke all on function public.khpos_finance_oversight_server(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_finance_oversight_server(uuid,uuid,uuid,text,jsonb) to service_role;
