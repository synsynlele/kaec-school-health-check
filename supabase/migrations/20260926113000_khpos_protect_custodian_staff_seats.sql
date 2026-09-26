-- Owner seats cannot be created as ordinary staff appointments.
create or replace function public.khpos_ops_create_staff_server(
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
  v_name text := nullif(btrim(p_input->>'displayName'),'');
  v_email text := lower(nullif(btrim(p_input->>'accountEmail'),''));
  v_employment_type text := lower(coalesce(nullif(btrim(p_input->>'employmentType'),''),'employee'));
  v_role_id uuid;
  v_role_code text;
  v_campus_id uuid;
  v_unit_id uuid;
  v_start_date date;
  v_onboarding_due date;
  v_probation_date date;
  v_user_id uuid;
  v_staff_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_can_manage_people(p_actor_user_id,p_organisation_id) then
    raise exception 'Staff appointment records require an active School Guardian or Vision Custodian role.';
  end if;

  if v_name is null or v_email is null then
    raise exception 'Staff name and account email are required.';
  end if;
  if position('@' in v_email)<2 then
    raise exception 'Enter a valid staff account email.';
  end if;
  if v_employment_type not in ('employee','facilitator','contractor','volunteer','intern','temporary') then
    raise exception 'Unsupported employment type.';
  end if;

  begin
    v_role_id := (p_input->>'roleId')::uuid;
  exception when others then
    raise exception 'A valid operating role is required.';
  end;

  select code into v_role_code
  from public.khpos_ops_roles
  where id=v_role_id
    and organisation_id=p_organisation_id
    and status='active'
    and category<>'student';

  if v_role_code is null then raise exception 'Operating staff role not found.'; end if;
  if v_role_code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') then
    raise exception 'Custodian seats require separate KAEC governance and cannot be created through staff onboarding.';
  end if;

  if nullif(p_input->>'campusId','') is not null then
    begin v_campus_id := (p_input->>'campusId')::uuid;
    exception when others then raise exception 'Campus is invalid.'; end;
    if not exists(
      select 1 from public.khpos_ops_campuses
      where id=v_campus_id and organisation_id=p_organisation_id and status='active'
    ) then raise exception 'Campus is not active in this organisation.'; end if;
  end if;

  if nullif(p_input->>'unitId','') is not null then
    begin v_unit_id := (p_input->>'unitId')::uuid;
    exception when others then raise exception 'Unit is invalid.'; end;
    if not exists(
      select 1 from public.khpos_ops_units
      where id=v_unit_id and organisation_id=p_organisation_id and status='active'
    ) then raise exception 'Unit is not active in this organisation.'; end if;
  end if;

  begin v_start_date := (p_input->>'startDate')::date;
  exception when others then raise exception 'Start date is invalid.'; end;

  if nullif(p_input->>'onboardingDueDate','') is null then
    v_onboarding_due := v_start_date;
  else
    begin v_onboarding_due := (p_input->>'onboardingDueDate')::date;
    exception when others then raise exception 'Onboarding due date is invalid.'; end;
  end if;

  if nullif(p_input->>'probationReviewDate','') is not null then
    begin v_probation_date := (p_input->>'probationReviewDate')::date;
    exception when others then raise exception 'Probation review date is invalid.'; end;
    if v_probation_date<v_start_date then
      raise exception 'Probation review date cannot precede the staff start date.';
    end if;
  end if;

  select id into v_user_id
  from auth.users
  where lower(email)=v_email
  order by created_at
  limit 1;

  v_reference := 'STF-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff(
    organisation_id,staff_reference,display_name,account_email,user_id,
    employment_type,desired_role_id,campus_id,unit_id,start_date,
    onboarding_due_date,probation_review_date,status,created_by
  ) values (
    p_organisation_id,v_reference,left(v_name,180),left(v_email,320),v_user_id,
    v_employment_type,v_role_id,v_campus_id,v_unit_id,v_start_date,
    v_onboarding_due,v_probation_date,'onboarding',p_actor_user_id
  ) returning id into v_staff_id;

  insert into public.khpos_ops_staff_onboarding_items(
    organisation_id,staff_id,source_requirement_id,requirement_code,title,
    description,category,mandatory,waivable,evidence_required
  )
  select
    p_organisation_id,v_staff_id,req.id,req.code,req.title,
    req.description,req.category,req.mandatory,req.waivable,req.evidence_required
  from public.khpos_ops_onboarding_requirements req
  where req.organisation_id=p_organisation_id
    and req.status='active'
    and (
      cardinality(req.applicable_role_codes)=0
      or v_role_code=any(req.applicable_role_codes)
    )
  order by req.sort_order,req.code;

  insert into public.khpos_ops_staff_events(
    organisation_id,staff_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,v_staff_id,p_actor_user_id,'appointment_recorded',
    'Staff appointment and onboarding record created.',
    jsonb_build_object(
      'reference',v_reference,
      'roleCode',v_role_code,
      'accountMatched',v_user_id is not null,
      'startDate',v_start_date,
      'employmentType',v_employment_type
    )
  );

  perform khpos_private.ops_refresh_staff_readiness(v_staff_id);

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_created','staff',v_staff_id,
    jsonb_build_object('reference',v_reference,'roleCode',v_role_code)
  );

  return v_staff_id;
exception when unique_violation then
  raise exception 'A current staff record already uses this account email.';
end;
$$;

