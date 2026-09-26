-- Preserve founder and partner owner authority within their own institution.
-- Owner seats remain protected from internal staff recruitment, conduct and exit flows.

-- khpos_private.ops_can_govern_performance
create or replace function khpos_private.ops_can_govern_performance(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN')
  );
$$;

-- public.khpos_ops_create_availability_case_server
create or replace function public.khpos_ops_create_availability_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff_id uuid;
  v_staff public.khpos_ops_staff%rowtype;
  v_role_code text;
  v_case_type text := lower(nullif(btrim(p_input->>'caseType'),''));
  v_source_type text := lower(coalesce(nullif(btrim(p_input->>'sourceType'),''),'self_report'));
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_reason_category text := lower(coalesce(nullif(btrim(p_input->>'reasonCategory'),''),'not_disclosed'));
  v_reason_note text := nullif(btrim(coalesce(p_input->>'reasonNote','')),'');
  v_source_reference text := nullif(btrim(coalesce(p_input->>'sourceReference','')),'');
  v_coverage_required boolean := coalesce((p_input->>'coverageRequired')::boolean,false);
  v_is_self boolean := false;
  v_can_review boolean := false;
  v_status text;
  v_case_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_availability_has_membership(p_actor_user_id,p_organisation_id) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  begin v_staff_id := (p_input->>'staffId')::uuid;
  exception when others then raise exception 'A valid active staff record is required.'; end;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_staff_id
    and organisation_id=p_organisation_id
    and status='active'
    and role_assignment_id is not null
  for update;

  if v_staff.id is null then
    raise exception 'Only active deployed staff can use the availability workflow.';
  end if;

  select code into v_role_code
  from public.khpos_ops_roles
  where id=v_staff.desired_role_id
    and organisation_id=p_organisation_id
    and status='active';

  v_is_self := v_staff.user_id=p_actor_user_id;
  v_can_review := khpos_private.ops_availability_can_review_staff(
    p_actor_user_id,p_organisation_id,v_staff.id
  );

  if not v_is_self and not v_can_review then
    raise exception 'This staff availability record is outside your reporting authority.';
  end if;

  if v_case_type not in ('planned_leave','unplanned_absence','late_arrival','early_departure','other_availability') then
    raise exception 'Unsupported availability case type.';
  end if;

  if v_source_type not in ('self_report','leader_record','third_party_exception') then
    raise exception 'Unsupported availability source type.';
  end if;

  if v_is_self and v_source_type<>'self_report' then
    raise exception 'Staff self-reporting must use the self-report source.';
  end if;

  if not v_is_self and v_source_type='self_report' then
    raise exception 'Leaders cannot submit another staff member as a self-report.';
  end if;

  begin v_start_at := (p_input->>'startAt')::timestamptz;
  exception when others then raise exception 'Availability start time is invalid.'; end;
  begin v_end_at := (p_input->>'endAt')::timestamptz;
  exception when others then raise exception 'Availability end time is invalid.'; end;

  if v_end_at<=v_start_at then
    raise exception 'Availability end time must be after the start time.';
  end if;

  if v_reason_category not in ('not_disclosed','personal','family','emergency','transport','official_duty','other') then
    raise exception 'Unsupported reason category.';
  end if;

  if length(coalesce(v_reason_note,''))>2000 then
    raise exception 'Availability note is too long.';
  end if;

  if length(coalesce(v_source_reference,''))>500 then
    raise exception 'Source reference is too long.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff_availability_cases existing
    where existing.staff_id=v_staff.id
      and existing.status not in ('declined','cancelled','closed')
      and tstzrange(existing.start_at,existing.end_at,'[)')
          && tstzrange(v_start_at,v_end_at,'[)')
  ) then
    raise exception 'This staff member already has an overlapping open availability case.';
  end if;

  if v_case_type='planned_leave' then
    if v_is_self and v_role_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
      v_status := case when v_coverage_required then 'coverage_required' else 'approved' end;
    else
      v_status := 'pending_approval';
    end if;
  else
    v_status := case when v_coverage_required then 'coverage_required' else 'active' end;
  end if;

  v_reference := 'AVL-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_availability_cases(
    organisation_id,staff_id,affected_assignment_id,case_reference,case_type,
    source_type,start_at,end_at,reason_category,reason_note,source_reference,
    coverage_required,status,requested_by,recorded_by
  ) values (
    p_organisation_id,v_staff.id,v_staff.role_assignment_id,v_reference,v_case_type,
    v_source_type,v_start_at,v_end_at,v_reason_category,left(v_reason_note,2000),
    left(v_source_reference,500),v_coverage_required,v_status,
    case when v_is_self then p_actor_user_id else null end,p_actor_user_id
  ) returning id into v_case_id;

  insert into public.khpos_ops_staff_availability_events(
    organisation_id,availability_case_id,actor_user_id,event_type,to_status,note,metadata
  ) values (
    p_organisation_id,v_case_id,p_actor_user_id,'availability_created',v_status,
    left(v_reason_note,2000),
    jsonb_build_object(
      'caseType',v_case_type,
      'sourceType',v_source_type,
      'coverageRequired',v_coverage_required,
      'roleCode',v_role_code
    )
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_availability_created',
    'staff_availability',v_case_id,
    jsonb_build_object(
      'reference',v_reference,
      'staffId',v_staff.id,
      'caseType',v_case_type,
      'status',v_status
    )
  );

  return v_case_id;
end;
$$;

-- public.khpos_ops_create_accountability_case_server
create or replace function public.khpos_ops_create_accountability_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case_type text := lower(nullif(btrim(p_input->>'caseType'),''));
  v_subject_staff_id uuid;
  v_reporter_staff_id uuid;
  v_grievance_target text := lower(nullif(btrim(p_input->>'grievanceTarget'),''));
  v_title text := nullif(btrim(p_input->>'title'),'');
  v_statement text := nullif(btrim(p_input->>'statement'),'');
  v_standard text := nullif(btrim(p_input->>'relevantStandard'),'');
  v_desired_resolution text := nullif(btrim(p_input->>'desiredResolution'),'');
  v_classification_note text := nullif(btrim(p_input->>'classificationNote'),'');
  v_incident_at timestamptz;
  v_response_due_at timestamptz;
  v_hearing_required boolean := coalesce((p_input->>'hearingRequired')::boolean,false);
  v_source_case_id uuid;
  v_subject_role_code text;
  v_status text;
  v_response_state text;
  v_case_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_accountability_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  if v_case_type not in ('corrective','grievance','formal_discipline') then
    raise exception 'Unsupported accountability case type.';
  end if;

  if v_title is null or v_statement is null then
    raise exception 'Case title and specific statement are required.';
  end if;

  if nullif(p_input->>'incidentAt','') is not null then
    begin v_incident_at := (p_input->>'incidentAt')::timestamptz;
    exception when others then raise exception 'Incident date/time is invalid.'; end;
  end if;

  if nullif(p_input->>'sourceCaseId','') is not null then
    begin v_source_case_id := (p_input->>'sourceCaseId')::uuid;
    exception when others then raise exception 'Source case identifier is invalid.'; end;

    if not exists(
      select 1
      from public.khpos_ops_staff_accountability_cases
      where id=v_source_case_id and organisation_id=p_organisation_id
    ) then
      raise exception 'Source accountability case was not found.';
    end if;
  end if;

  if v_case_type='grievance' then
    v_reporter_staff_id := khpos_private.ops_accountability_staff_for_user(
      p_actor_user_id,p_organisation_id
    );

    if v_reporter_staff_id is null then
      raise exception 'Only an active deployed staff member can raise a staff grievance.';
    end if;

    if v_grievance_target not in (
      'staff_member','decision','working_condition','process','other'
    ) then
      raise exception 'Choose what the grievance concerns.';
    end if;

    if v_grievance_target='staff_member' then
      begin v_subject_staff_id := (p_input->>'subjectStaffId')::uuid;
      exception when others then raise exception 'A staff grievance against a person requires the subject staff member.'; end;

      if not exists(
        select 1 from public.khpos_ops_staff
        where id=v_subject_staff_id
          and organisation_id=p_organisation_id
          and status='active'
      ) then
        raise exception 'Grievance subject must be an active staff member.';
      end if;

      if v_subject_staff_id=v_reporter_staff_id then
        raise exception 'A staff member cannot raise a grievance against themselves.';
      end if;
    end if;

    if v_desired_resolution is null then
      raise exception 'State the resolution or change you are seeking.';
    end if;

    v_status := case
      when not exists(
        select 1
        from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles ar on ar.id=a.role_id
        where a.status='active'
          and ar.organisation_id=p_organisation_id
          and ar.status='active'
          and khpos_private.ops_role_is_ancestor(
            p_organisation_id,
            (select desired_role_id from public.khpos_ops_staff where id=v_reporter_staff_id),
            ar.id
          )
          and (
            v_subject_staff_id is null
            or (
              a.user_id is distinct from
                (select user_id from public.khpos_ops_staff where id=v_subject_staff_id)
              and khpos_private.ops_role_is_ancestor(
                p_organisation_id,
                (select desired_role_id from public.khpos_ops_staff where id=v_subject_staff_id),
                ar.id
              )
            )
          )
      ) then 'external_review_required'
      else 'open'
    end;
    v_response_state := 'not_requested';

  else
    begin v_subject_staff_id := (p_input->>'subjectStaffId')::uuid;
    exception when others then raise exception 'Corrective and formal disciplinary cases require the subject staff member.'; end;

    if not exists(
      select 1 from public.khpos_ops_staff
      where id=v_subject_staff_id
        and organisation_id=p_organisation_id
        and status='active'
    ) then
      raise exception 'Accountability subject must be an active staff member.';
    end if;

    if not khpos_private.ops_accountability_can_manage_subject(
      p_actor_user_id,p_organisation_id,v_subject_staff_id
    ) then
      raise exception 'Only the appropriate reporting leader can open this accountability case.';
    end if;

    select r.code into v_subject_role_code
    from public.khpos_ops_staff s
    join public.khpos_ops_roles r on r.id=s.desired_role_id
    where s.id=v_subject_staff_id;

    if v_subject_role_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
      raise exception 'A Vision Custodian conduct case requires independent external governance; the subject cannot be managed through the internal reporting line.';
    end if;

    if v_standard is null then
      raise exception 'State the policy, standard, commitment or known expectation relevant to this case.';
    end if;

    if v_classification_note is null then
      raise exception 'Explain why this is a conduct/accountability matter rather than an unresolved capability gap for O9.';
    end if;

    begin v_response_due_at := (p_input->>'responseDueAt')::timestamptz;
    exception when others then raise exception 'A valid response deadline is required.'; end;

    if v_response_due_at<=now() then
      raise exception 'Response deadline must be in the future when the case is issued.';
    end if;

    v_status := 'awaiting_response';
    v_response_state := 'requested';
  end if;

  v_reference := case v_case_type
    when 'corrective' then 'COR-'
    when 'grievance' then 'GRV-'
    else 'DIS-'
  end || upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_accountability_cases(
    organisation_id,case_reference,case_type,source_case_id,raised_by_user_id,
    reporter_staff_id,subject_staff_id,grievance_target,title,statement,
    relevant_standard,incident_at,desired_resolution,classification_note,
    response_due_at,response_state,response_requested_at,response_requested_by,
    hearing_required,status
  ) values (
    p_organisation_id,v_reference,v_case_type,v_source_case_id,p_actor_user_id,
    v_reporter_staff_id,v_subject_staff_id,
    case when v_case_type='grievance' then v_grievance_target else null end,
    left(v_title,240),left(v_statement,6000),left(v_standard,3000),
    v_incident_at,left(v_desired_resolution,4000),left(v_classification_note,4000),
    v_response_due_at,v_response_state,
    case when v_response_state='requested' then now() else null end,
    case when v_response_state='requested' then p_actor_user_id else null end,
    case when v_case_type='formal_discipline' then v_hearing_required else false end,
    v_status
  ) returning id into v_case_id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,to_status,note,metadata
  ) values (
    p_organisation_id,v_case_id,p_actor_user_id,'case_created',v_status,
    left(v_title,240),
    jsonb_build_object(
      'caseType',v_case_type,
      'subjectStaffId',v_subject_staff_id,
      'reporterStaffId',v_reporter_staff_id,
      'responseDueAt',v_response_due_at,
      'hearingRequired',v_hearing_required
    )
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_accountability_case_created',
    'staff_accountability_case',v_case_id,
    jsonb_build_object('reference',v_reference,'caseType',v_case_type)
  );

  return v_case_id;
end;
$$;

-- khpos_private.ops_transition_can_manage_exit
create or replace function khpos_private.ops_transition_can_manage_exit(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_staff_user_id uuid;
  v_role_code text;
begin
  select s.user_id,r.code into v_staff_user_id,v_role_code
  from public.khpos_ops_staff s
  join public.khpos_ops_roles r on r.id=s.desired_role_id
  where s.id=p_staff_id
    and s.organisation_id=p_organisation_id;

  if v_staff_user_id is null or v_role_code is null then
    return false;
  end if;

  if v_staff_user_id=p_actor_user_id then
    return false;
  end if;

  if v_role_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
    return false;
  end if;

  if v_role_code='SCHOOL_GUARDIAN' then
    return khpos_private.ops_transition_actor_has_role(
      p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
    );
  end if;

  return khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  );
end;
$function$;

-- khpos_private.ops_transition_can_approve_target
create or replace function khpos_private.ops_transition_can_approve_target(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_target_role_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_code text;
begin
  select code into v_code
  from public.khpos_ops_roles
  where id=p_target_role_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_code is null or v_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
    return false;
  end if;

  if v_code='SCHOOL_GUARDIAN' then
    return khpos_private.ops_transition_actor_has_role(
      p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
    );
  end if;

  return khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  );
end;
$$;

-- public.khpos_ops_create_succession_plan_server
create or replace function public.khpos_ops_create_succession_plan_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid,
  p_target_role_id uuid,
  p_readiness_state text,
  p_readiness_summary text,
  p_development_priorities text default null,
  p_target_horizon date default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff public.khpos_ops_staff%rowtype;
  v_target_code text;
  v_reference text;
  v_id uuid;
begin
  if not khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the School Guardian or School Custodian can create succession plans.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_staff.id is null or v_staff.role_assignment_id is null then
    raise exception 'Succession planning requires an active deployed staff member.';
  end if;

  if v_staff.user_id=p_actor_user_id then
    raise exception 'A staff member cannot sponsor their own succession plan.';
  end if;

  if not khpos_private.ops_transition_valid_target(
    p_organisation_id,v_staff.desired_role_id,p_target_role_id
  ) then
    raise exception 'Succession target must be a higher role in the staff member''s actual reporting path.';
  end if;

  if p_readiness_state not in (
    'exploring','developing','ready_with_support','ready_now','not_ready'
  ) then
    raise exception 'Unsupported succession readiness state.';
  end if;

  if nullif(btrim(coalesce(p_readiness_summary,'')),'') is null then
    raise exception 'Succession readiness summary is required.';
  end if;

  select code into v_target_code
  from public.khpos_ops_roles
  where id=p_target_role_id and organisation_id=p_organisation_id;

  if v_target_code in ('SCHOOL_GUARDIAN','VISION_CUSTODIAN','SCHOOL_CUSTODIAN')
     and not khpos_private.ops_transition_actor_has_role(
       p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
     ) then
    raise exception 'School Guardian or School Custodian succession planning is reserved to the Vision Custodian.';
  end if;

  v_reference := 'SUC-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_succession_plans(
    organisation_id,staff_id,current_assignment_id,target_role_id,
    succession_reference,readiness_state,readiness_summary,
    development_priorities,target_horizon,external_governance_required,
    status,sponsor_user_id
  ) values (
    p_organisation_id,v_staff.id,v_staff.role_assignment_id,p_target_role_id,
    v_reference,p_readiness_state,left(btrim(p_readiness_summary),6000),
    left(nullif(btrim(coalesce(p_development_priorities,'')),''),6000),
    p_target_horizon,v_target_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN'),
    'active',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,succession_plan_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'succession_plan_created',
    p_readiness_state,left(btrim(p_readiness_summary),4000)
  );

  return v_id;
end;
$$;

-- public.khpos_ops_update_succession_plan_server
create or replace function public.khpos_ops_update_succession_plan_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_plan_id uuid,
  p_readiness_state text,
  p_readiness_summary text,
  p_development_priorities text default null,
  p_target_horizon date default null,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_plan public.khpos_ops_staff_succession_plans%rowtype;
  v_from text;
begin
  select * into v_plan
  from public.khpos_ops_staff_succession_plans
  where id=p_plan_id and organisation_id=p_organisation_id
  for update;

  if v_plan.id is null then raise exception 'Succession plan not found.'; end if;

  if not khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the School Guardian or School Custodian can review succession readiness.';
  end if;

  if v_plan.status<>'active' then
    raise exception 'Only an active succession plan can be reviewed.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff s
    where s.id=v_plan.staff_id and s.user_id=p_actor_user_id
  ) then
    raise exception 'A staff member cannot review their own succession plan.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_roles r
    where r.id=v_plan.target_role_id
      and r.code in ('SCHOOL_GUARDIAN','VISION_CUSTODIAN','SCHOOL_CUSTODIAN')
  ) and not khpos_private.ops_transition_actor_has_role(
    p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
  ) then
    raise exception 'School Guardian or School Custodian succession review is reserved to the Vision Custodian.';
  end if;


  if p_readiness_state not in (
    'exploring','developing','ready_with_support','ready_now','not_ready'
  ) then
    raise exception 'Unsupported succession readiness state.';
  end if;

  if nullif(btrim(coalesce(p_readiness_summary,'')),'') is null then
    raise exception 'Succession readiness summary is required.';
  end if;

  v_from := v_plan.readiness_state;

  update public.khpos_ops_staff_succession_plans
  set readiness_state=p_readiness_state,
      readiness_summary=left(btrim(p_readiness_summary),6000),
      development_priorities=left(nullif(btrim(coalesce(p_development_priorities,'')),''),6000),
      target_horizon=p_target_horizon,
      reviewed_by=p_actor_user_id,
      reviewed_at=now(),
      review_note=left(nullif(btrim(coalesce(p_review_note,'')),''),4000),
      updated_at=now()
  where id=v_plan.id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,succession_plan_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_plan.id,p_actor_user_id,'succession_reviewed',
    v_from,p_readiness_state,left(nullif(btrim(coalesce(p_review_note,'')),''),4000)
  );
end;
$$;

-- public.khpos_ops_succession_plan_action_server
create or replace function public.khpos_ops_succession_plan_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_plan_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $function$
declare
  v_plan public.khpos_ops_staff_succession_plans%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_to text;
begin
  select * into v_plan
  from public.khpos_ops_staff_succession_plans
  where id=p_plan_id and organisation_id=p_organisation_id
  for update;

  if v_plan.id is null then raise exception 'Succession plan not found.'; end if;

  if not khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the School Guardian or School Custodian can change succession-plan status.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff s
    where s.id=v_plan.staff_id and s.user_id=p_actor_user_id
  ) then
    raise exception 'A staff member cannot change status on their own succession plan.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_roles r
    where r.id=v_plan.target_role_id
      and r.code in ('SCHOOL_GUARDIAN','VISION_CUSTODIAN','SCHOOL_CUSTODIAN')
  ) and not khpos_private.ops_transition_actor_has_role(
    p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
  ) then
    raise exception 'School Guardian or School Custodian succession status is reserved to the Vision Custodian.';
  end if;

  if p_action='withdraw' then
    if v_plan.status<>'active' then
      raise exception 'Only an active succession plan can be withdrawn.';
    end if;
    if v_note is null then raise exception 'Record why the succession plan is being withdrawn.'; end if;
    v_to := 'withdrawn';

    update public.khpos_ops_staff_succession_plans
    set status=v_to,withdrawn_at=now(),withdrawal_note=left(v_note,4000),updated_at=now()
    where id=v_plan.id;

  elsif p_action='archive' then
    if v_plan.status not in ('achieved','withdrawn') then
      raise exception 'Only achieved or withdrawn succession plans can be archived.';
    end if;
    v_to := 'archived';

    update public.khpos_ops_staff_succession_plans
    set status=v_to,updated_at=now()
    where id=v_plan.id;

  else
    raise exception 'Unsupported succession-plan action.';
  end if;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,succession_plan_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_plan.id,p_actor_user_id,
    'succession_plan_'||p_action,v_plan.status,v_to,left(v_note,4000)
  );
end;
$function$;

-- public.khpos_ops_create_promotion_case_server
create or replace function public.khpos_ops_create_promotion_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid,
  p_target_role_id uuid,
  p_target_campus_id uuid,
  p_target_unit_id uuid,
  p_proposed_effective_date date,
  p_justification text,
  p_readiness_summary text,
  p_source_succession_plan_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff public.khpos_ops_staff%rowtype;
  v_target_code text;
  v_reference text;
  v_status text;
  v_external boolean := false;
  v_id uuid;
begin
  if not khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only the School Guardian or School Custodian can open promotion cases.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_staff.id is null or v_staff.role_assignment_id is null or v_staff.user_id is null then
    raise exception 'Promotion requires an active deployed staff member with a linked account.';
  end if;

  if v_staff.user_id=p_actor_user_id then
    raise exception 'A staff member cannot open their own promotion case.';
  end if;

  if not khpos_private.ops_transition_valid_target(
    p_organisation_id,v_staff.desired_role_id,p_target_role_id
  ) then
    raise exception 'Promotion target must be a higher role in the staff member''s actual reporting path.';
  end if;

  if p_proposed_effective_date<current_date then
    raise exception 'Promotion effective date cannot be in the past.';
  end if;

  if nullif(btrim(coalesce(p_justification,'')),'') is null
     or nullif(btrim(coalesce(p_readiness_summary,'')),'') is null then
    raise exception 'Promotion justification and readiness summary are required.';
  end if;

  if p_target_campus_id is not null
     and not exists(
       select 1 from public.khpos_ops_campuses c
       where c.id=p_target_campus_id
         and c.organisation_id=p_organisation_id
         and c.status='active'
     ) then
    raise exception 'Target campus is not active in this organisation.';
  end if;

  if p_target_unit_id is not null
     and not exists(
       select 1 from public.khpos_ops_units u
       where u.id=p_target_unit_id
         and u.organisation_id=p_organisation_id
         and u.status='active'
     ) then
    raise exception 'Target unit is not active in this organisation.';
  end if;

  if p_source_succession_plan_id is not null
     and not exists(
       select 1
       from public.khpos_ops_staff_succession_plans sp
       where sp.id=p_source_succession_plan_id
         and sp.organisation_id=p_organisation_id
         and sp.staff_id=v_staff.id
         and sp.target_role_id=p_target_role_id
         and sp.status='active'
         and sp.readiness_state in ('ready_with_support','ready_now')
     ) then
    raise exception 'Linked succession plan must be active and at Ready With Support or Ready Now for the same target role.';
  end if;

  select code into v_target_code
  from public.khpos_ops_roles
  where id=p_target_role_id and organisation_id=p_organisation_id;

  if v_target_code in ('SCHOOL_GUARDIAN','VISION_CUSTODIAN','SCHOOL_CUSTODIAN')
     and not khpos_private.ops_transition_actor_has_role(
       p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
     ) then
    raise exception 'Only the Vision Custodian can open School Guardian or School Custodian progression cases.';
  end if;

  v_external := v_target_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN');
  v_status := case when v_external then 'external_governance_required' else 'awaiting_acceptance' end;
  v_reference := 'PRO-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_promotion_cases(
    organisation_id,staff_id,promotion_reference,source_succession_plan_id,
    from_assignment_id,from_role_id,target_role_id,target_campus_id,target_unit_id,
    proposed_effective_date,justification,readiness_summary,
    staff_acceptance_state,status,external_governance_required,created_by
  ) values (
    p_organisation_id,v_staff.id,v_reference,p_source_succession_plan_id,
    v_staff.role_assignment_id,v_staff.desired_role_id,p_target_role_id,
    p_target_campus_id,p_target_unit_id,p_proposed_effective_date,
    left(btrim(p_justification),6000),left(btrim(p_readiness_summary),6000),
    'pending',v_status,v_external,p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,promotion_case_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'promotion_case_created',
    v_status,left(btrim(p_justification),4000)
  );

  return v_id;
end;
$$;

-- public.khpos_ops_execute_promotion_server
create or replace function public.khpos_ops_execute_promotion_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_promotion_case_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_promotion_cases%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_old_assignment public.khpos_ops_role_assignments%rowtype;
  v_target public.khpos_ops_roles%rowtype;
  v_new_assignment uuid;
  v_effective date;
  v_old_end date;
begin
  select * into v_case
  from public.khpos_ops_staff_promotion_cases
  where id=p_promotion_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Promotion case not found.'; end if;

  if v_case.status<>'approved' then
    raise exception 'Only an approved promotion case can be executed.';
  end if;

  if not khpos_private.ops_transition_can_approve_target(
    p_actor_user_id,p_organisation_id,v_case.target_role_id
  ) then
    raise exception 'You are not the competent authority to execute this promotion.';
  end if;

  v_effective := v_case.proposed_effective_date;
  if current_date<v_effective then
    raise exception 'Promotion cannot execute before its approved effective date.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff_transition_items ti
    where ti.promotion_case_id=v_case.id
      and ti.mandatory
      and ti.completion_phase='pre_execute'
      and ti.status not in ('verified','waived')
  ) then
    raise exception 'Verify or formally waive every mandatory pre-promotion transition requirement first.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_staff_transition_items ti
    where ti.promotion_case_id=v_case.id
      and ti.item_type='responsibility_handover'
      and ti.recipient_assignment_id is not null
      and ti.status='verified'
  ) then
    raise exception 'Promotion requires a completed responsibility handover to a named continuity recipient.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_case.staff_id and organisation_id=p_organisation_id
  for update;

  if v_staff.id is null or v_staff.status<>'active'
     or v_staff.role_assignment_id is distinct from v_case.from_assignment_id then
    raise exception 'Staff role state changed after the promotion case opened; re-review the transition.';
  end if;

  select * into v_old_assignment
  from public.khpos_ops_role_assignments
  where id=v_case.from_assignment_id and status='active'
  for update;

  if v_old_assignment.id is null then
    raise exception 'Current role assignment is no longer active.';
  end if;

  select * into v_target
  from public.khpos_ops_roles
  where id=v_case.target_role_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_target.id is null or v_target.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
    raise exception 'Vision Custodian appointment requires external governance and cannot execute through internal O11.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_role_assignments a
    where a.id=v_case.target_supervisor_assignment_id
      and a.role_id=v_target.reports_to_role_id
      and a.status='active'
  ) then
    raise exception 'Approved target reporting line is no longer active.';
  end if;

  update public.khpos_ops_role_assignments a
  set primary_assignment=false,updated_at=now()
  from public.khpos_ops_roles r
  where a.role_id=r.id
    and r.organisation_id=p_organisation_id
    and a.user_id=v_staff.user_id
    and a.status='active'
    and a.primary_assignment;

  v_old_end := greatest(v_old_assignment.start_date,v_effective-1);

  update public.khpos_ops_role_assignments
  set status='ended',
      primary_assignment=false,
      end_date=v_old_end,
      updated_at=now()
  where id=v_old_assignment.id;

  update public.khpos_ops_reporting_lines
  set effective_to=v_old_end
  where effective_to is null
    and (
      subordinate_assignment_id=v_old_assignment.id
      or supervisor_assignment_id=v_old_assignment.id
    );

  update public.khpos_ops_backup_assignments
  set status='ended',
      effective_to=v_old_end
  where status='active'
    and (
      primary_assignment_id=v_old_assignment.id
      or backup_assignment_id=v_old_assignment.id
    );

  insert into public.khpos_ops_role_assignments(
    role_id,user_id,campus_id,unit_id,primary_assignment,status,
    start_date,appointed_by
  ) values (
    v_case.target_role_id,v_staff.user_id,
    v_case.target_campus_id,v_case.target_unit_id,
    true,'active',v_effective,p_actor_user_id
  ) returning id into v_new_assignment;

  insert into public.khpos_ops_reporting_lines(
    subordinate_assignment_id,supervisor_assignment_id,
    relationship_type,effective_from
  ) values (
    v_new_assignment,v_case.target_supervisor_assignment_id,
    'primary',v_effective
  );

  update public.khpos_ops_staff
  set desired_role_id=v_case.target_role_id,
      campus_id=v_case.target_campus_id,
      unit_id=v_case.target_unit_id,
      role_assignment_id=v_new_assignment,
      updated_at=now()
  where id=v_staff.id;

  update public.khpos_ops_staff_promotion_cases
  set status='executed',
      executed_by=p_actor_user_id,
      executed_at=now(),
      new_assignment_id=v_new_assignment,
      updated_at=now()
  where id=v_case.id;

  if v_case.source_succession_plan_id is not null then
    update public.khpos_ops_staff_succession_plans
    set status='achieved',achieved_at=now(),updated_at=now()
    where id=v_case.source_succession_plan_id
      and status='active';
  end if;

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff.id,p_actor_user_id,'staff_promoted',
    'Approved role progression executed after verified transition handover.',
    jsonb_build_object(
      'fromAssignmentId',v_old_assignment.id,
      'newAssignmentId',v_new_assignment,
      'targetRoleId',v_case.target_role_id,
      'effectiveDate',v_effective
    )
  );

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,promotion_case_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'promotion_executed',
    v_case.status,'executed','Role assignment changed after verified handover.',
    jsonb_build_object('newAssignmentId',v_new_assignment)
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_promotion_executed',
    'staff',v_staff.id,
    jsonb_build_object(
      'promotionCaseId',v_case.id,
      'oldAssignmentId',v_old_assignment.id,
      'newAssignmentId',v_new_assignment
    )
  );

  return v_new_assignment;
end;
$$;

-- public.khpos_ops_create_exit_case_server
create or replace function public.khpos_ops_create_exit_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid,
  p_exit_type text,
  p_proposed_last_day date,
  p_basis_reference text,
  p_reason_note text default null,
  p_authority_review_reference text default null,
  p_source_accountability_case_id uuid default null,
  p_replacement_required boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_staff public.khpos_ops_staff%rowtype;
  v_role_code text;
  v_is_self boolean;
  v_reference text;
  v_id uuid;
begin
  if not khpos_private.ops_transition_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=p_staff_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_staff.id is null or v_staff.role_assignment_id is null or v_staff.user_id is null then
    raise exception 'Exit requires an active deployed staff member with a linked account.';
  end if;

  v_is_self := v_staff.user_id=p_actor_user_id;

  if v_is_self then
    if p_exit_type not in ('resignation','retirement') then
      raise exception 'Staff self-service can only submit resignation or retirement notice.';
    end if;
  elsif not khpos_private.ops_transition_can_manage_exit(
    p_actor_user_id,p_organisation_id,v_staff.id
  ) then
    raise exception 'You are not the competent authority to initiate this staff exit.';
  end if;

  if p_exit_type not in (
    'resignation','retirement','contract_end','mutual_agreement',
    'redundancy','termination','dismissal','other'
  ) then
    raise exception 'Unsupported exit type.';
  end if;

  if p_proposed_last_day<current_date then
    raise exception 'Proposed last day cannot be in the past.';
  end if;

  if nullif(btrim(coalesce(p_basis_reference,'')),'') is null then
    raise exception 'Notice, agreement, contract or other exit basis reference is required.';
  end if;

  select r.code into v_role_code
  from public.khpos_ops_roles r
  where r.id=v_staff.desired_role_id and r.organisation_id=p_organisation_id;

  if v_role_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
    raise exception 'Vision Custodian exit requires external company governance and cannot be initiated through internal school O11.';
  end if;

  if p_exit_type in ('mutual_agreement','redundancy','termination','dismissal','other')
     and nullif(btrim(coalesce(p_authority_review_reference,'')),'') is null then
    raise exception 'This exit type requires a contract/legal/authority review or agreement reference.';
  end if;

  if p_exit_type='dismissal' then
    if p_source_accountability_case_id is null
       or not exists(
         select 1
         from public.khpos_ops_staff_accountability_cases ac
         where ac.id=p_source_accountability_case_id
           and ac.organisation_id=p_organisation_id
           and ac.subject_staff_id=v_staff.id
           and ac.case_type='formal_discipline'
           and ac.outcome='refer_separation_review'
           and ac.status in ('decision_recorded','closed')
       ) then
      raise exception 'Dismissal exit requires a formal O10 separation-review case for the same staff member.';
    end if;
  end if;

  v_reference := 'EXT-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_exit_cases(
    organisation_id,staff_id,affected_assignment_id,exit_reference,exit_type,
    proposed_last_day,basis_reference,authority_review_reference,
    source_accountability_case_id,reason_note,initiated_by_staff,
    replacement_required,status,initiated_by
  ) values (
    p_organisation_id,v_staff.id,v_staff.role_assignment_id,v_reference,p_exit_type,
    p_proposed_last_day,left(btrim(p_basis_reference),1000),
    left(nullif(btrim(coalesce(p_authority_review_reference,'')),''),1000),
    p_source_accountability_case_id,
    left(nullif(btrim(coalesce(p_reason_note,'')),''),4000),
    v_is_self,coalesce(p_replacement_required,true),'open',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,exit_case_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'exit_case_created',
    'open',left(nullif(btrim(coalesce(p_reason_note,'')),''),4000)
  );

  return v_id;
end;
$$;

-- public.khpos_ops_finalize_staff_exit_server
create or replace function public.khpos_ops_finalize_staff_exit_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_exit_case_id uuid
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_exit_cases%rowtype;
  v_staff public.khpos_ops_staff%rowtype;
  v_role_code text;
  v_assignment_ids uuid[];
begin
  select * into v_case
  from public.khpos_ops_staff_exit_cases
  where id=p_exit_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Exit case not found.'; end if;

  if v_case.status<>'clearance_in_progress' then
    raise exception 'Exit must be in clearance before it can be finalized.';
  end if;

  if not khpos_private.ops_transition_can_manage_exit(
    p_actor_user_id,p_organisation_id,v_case.staff_id
  ) then
    raise exception 'You are not the competent authority to finalize this staff exit.';
  end if;

  if current_date<v_case.proposed_last_day then
    raise exception 'Staff exit cannot be finalized before the recorded last day.';
  end if;

  if exists(
    select 1
    from public.khpos_ops_staff_transition_items ti
    where ti.exit_case_id=v_case.id
      and ti.mandatory
      and ti.completion_phase='pre_execute'
      and ti.status not in ('verified','waived')
  ) then
    raise exception 'Verify or formally waive every mandatory pre-exit clearance requirement first.';
  end if;

  if not exists(
    select 1
    from public.khpos_ops_staff_transition_items ti
    where ti.exit_case_id=v_case.id
      and ti.item_type='responsibility_handover'
      and ti.recipient_assignment_id is not null
      and ti.status='verified'
  ) then
    raise exception 'Exit requires a verified responsibility handover to the named continuity recipient.';
  end if;

  select * into v_staff
  from public.khpos_ops_staff
  where id=v_case.staff_id and organisation_id=p_organisation_id
  for update;

  if v_staff.id is null or v_staff.status<>'exiting' then
    raise exception 'Staff state changed after clearance started.';
  end if;

  select r.code into v_role_code
  from public.khpos_ops_roles r
  where r.id=v_staff.desired_role_id and r.organisation_id=p_organisation_id;

  if v_role_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
    raise exception 'Vision Custodian exit requires external company governance and cannot execute through internal school O11.';
  end if;

  select coalesce(array_agg(a.id),'{}'::uuid[]) into v_assignment_ids
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.user_id=v_staff.user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id;

  update public.khpos_ops_reporting_lines
  set effective_to=current_date
  where effective_to is null
    and (
      subordinate_assignment_id=any(v_assignment_ids)
      or supervisor_assignment_id=any(v_assignment_ids)
    );

  update public.khpos_ops_backup_assignments
  set status='ended',effective_to=current_date
  where status='active'
    and (
      primary_assignment_id=any(v_assignment_ids)
      or backup_assignment_id=any(v_assignment_ids)
    );

  update public.khpos_ops_role_assignments a
  set status='ended',
      primary_assignment=false,
      end_date=greatest(a.start_date,current_date),
      updated_at=now()
  from public.khpos_ops_roles r
  where a.role_id=r.id
    and r.organisation_id=p_organisation_id
    and a.user_id=v_staff.user_id
    and a.status='active';

  update public.organisation_memberships
  set status='ended',updated_at=now()
  where organisation_id=p_organisation_id
    and user_id=v_staff.user_id
    and status='active';

  update public.khpos_ops_staff
  set status='ended',updated_at=now()
  where id=v_staff.id;

  update public.khpos_ops_staff_transition_items
  set status='verified',
      completion_note='Organisation operating access and active KNS role assignments were closed by the O11 exit execution.',
      evidence_reference='system://khpos/o11/access-closed',
      submitted_by=p_actor_user_id,
      submitted_at=now(),
      verified_by=p_actor_user_id,
      verified_at=now(),
      updated_at=now()
  where exit_case_id=v_case.id
    and item_type='access_revocation'
    and completion_phase='at_execute';

  update public.khpos_ops_staff_exit_cases
  set status='ended',
      actual_last_day=current_date,
      ended_by=p_actor_user_id,
      ended_at=now(),
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_transition_events(
    organisation_id,exit_case_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'staff_exit_finalized',
    v_case.status,'ended',
    'Mandatory pre-exit clearance verified; operating assignments and organisation access ended.',
    jsonb_build_object('endedAssignmentIds',v_assignment_ids)
  );

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff.id,p_actor_user_id,'staff_ended',
    'Staff exit finalized after verified clearance and handover.',
    jsonb_build_object('exitCaseId',v_case.id,'actualLastDay',current_date)
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_exit_finalized',
    'staff',v_staff.id,
    jsonb_build_object('exitCaseId',v_case.id,'endedAssignmentIds',v_assignment_ids)
  );
end;
$$;

-- khpos_private.ops_academic_stream_visible
create or replace function khpos_private.ops_academic_stream_visible(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_stream_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_academic_delivery_streams s
    join public.khpos_ops_role_assignments a on a.id=s.teacher_assignment_id
    where s.id=p_stream_id
      and s.organisation_id=p_organisation_id
      and (
        khpos_private.ops_academic_can_monitor(p_actor_user_id,p_organisation_id)
        or a.user_id=p_actor_user_id
        or khpos_private.ops_academic_actor_has_role(
          p_actor_user_id,p_organisation_id,array['VISION_CUSTODIAN','SCHOOL_CUSTODIAN']
        )
      )
  );
$$;

-- khpos_private.ops_recruitment_can_approve_role
create or replace function khpos_private.ops_recruitment_can_approve_role(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_role_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_code text;
begin
  select code into v_code
  from public.khpos_ops_roles
  where id=p_role_id and organisation_id=p_organisation_id and status='active';

  if v_code is null or v_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
    return false;
  end if;

  if v_code='SCHOOL_GUARDIAN' then
    return khpos_private.ops_recruitment_actor_has_role(
      p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
    );
  end if;

  return khpos_private.ops_recruitment_can_manage(
    p_actor_user_id,p_organisation_id
  );
end;
$o13$;

-- public.khpos_ops_create_workforce_request_server
create or replace function public.khpos_ops_create_workforce_request_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $o13$
declare
  v_role_id uuid;
  v_role_code text;
  v_campus_id uuid;
  v_unit_id uuid;
  v_employment_type text := lower(coalesce(nullif(btrim(p_input->>'employmentType'),''),'employee'));
  v_need_type text := lower(nullif(btrim(p_input->>'needType'),''));
  v_rationale text := nullif(btrim(p_input->>'rationale'),'');
  v_alternatives text := nullif(btrim(p_input->>'alternativesConsidered'),'');
  v_budget text := nullif(btrim(p_input->>'budgetReference'),'');
  v_desired date;
  v_reference text;
  v_id uuid;
begin
  if not khpos_private.ops_recruitment_can_manage(p_actor_user_id,p_organisation_id) then
    raise exception 'Only School Guardian or School Custodian can submit workforce requests.';
  end if;

  begin v_role_id := (p_input->>'roleId')::uuid;
  exception when others then raise exception 'A valid role is required.'; end;

  select code into v_role_code
  from public.khpos_ops_roles
  where id=v_role_id and organisation_id=p_organisation_id
    and status='active' and category<>'student';

  if v_role_code is null then raise exception 'Operating role not found.'; end if;
  if v_role_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
    raise exception 'Vision Custodian workforce decisions require external company governance.';
  end if;
  if v_role_code='SCHOOL_GUARDIAN'
     and not khpos_private.ops_recruitment_actor_has_role(
       p_actor_user_id,p_organisation_id,'VISION_CUSTODIAN'
     ) then
    raise exception 'School Guardian workforce planning is reserved to the Vision Custodian.';
  end if;

  if v_employment_type not in ('employee','facilitator','contractor','volunteer','intern','temporary') then
    raise exception 'Unsupported employment type.';
  end if;
  if v_need_type not in ('replacement','expansion','workload','specialist','temporary_cover','other') then
    raise exception 'Unsupported workforce need type.';
  end if;
  if v_rationale is null then raise exception 'Workforce request rationale is required.'; end if;

  begin v_desired := (p_input->>'desiredStartDate')::date;
  exception when others then raise exception 'Desired start date is invalid.'; end;
  if v_desired<current_date then raise exception 'Desired start date cannot be in the past.'; end if;

  if nullif(p_input->>'campusId','') is not null then
    begin v_campus_id := (p_input->>'campusId')::uuid;
    exception when others then raise exception 'Campus is invalid.'; end;
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus_id and organisation_id=p_organisation_id and status='active')
    then raise exception 'Campus is not active.'; end if;
  end if;

  if nullif(p_input->>'unitId','') is not null then
    begin v_unit_id := (p_input->>'unitId')::uuid;
    exception when others then raise exception 'Unit is invalid.'; end;
    if not exists(select 1 from public.khpos_ops_units where id=v_unit_id and organisation_id=p_organisation_id and status='active')
    then raise exception 'Unit is not active.'; end if;
  end if;

  v_reference := 'WRF-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_workforce_requests(
    organisation_id,request_reference,role_id,campus_id,unit_id,
    employment_type,need_type,rationale,alternatives_considered,
    desired_start_date,budget_reference,status,requested_by
  ) values (
    p_organisation_id,v_reference,v_role_id,v_campus_id,v_unit_id,
    v_employment_type,v_need_type,left(v_rationale,6000),left(v_alternatives,6000),
    v_desired,left(v_budget,1000),'submitted',p_actor_user_id
  ) returning id into v_id;

  insert into public.khpos_ops_recruitment_events(
    organisation_id,workforce_request_id,actor_user_id,event_type,to_status,note
  ) values (
    p_organisation_id,v_id,p_actor_user_id,'workforce_request_submitted',
    'submitted',left(v_rationale,4000)
  );

  return v_id;
end;
$o13$;
