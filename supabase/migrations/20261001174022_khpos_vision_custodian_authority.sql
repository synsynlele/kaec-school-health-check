-- Vision Custodian authority inheritance and independent governance review.
-- The level-1 Vision Custodian inherits School Guardian-level management/oversight
-- without inheriting lower operational identities such as Teacher.
-- Vision-authored C0/P0 controls require an independent School Guardian/School Custodian review.

CREATE OR REPLACE FUNCTION khpos_private.ops_academic_actor_has_role(p_actor_user_id uuid, p_organisation_id uuid, p_role_codes text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (
        r.code=any(p_role_codes)
        or (r.code='VISION_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_role_codes))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_accountability_can_record_external_review(p_actor_user_id uuid, p_organisation_id uuid, p_case_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_staff_accountability_cases c
    join public.khpos_ops_staff subject on subject.id=c.subject_staff_id
    join public.khpos_ops_role_assignments a
      on a.user_id=p_actor_user_id and a.status='active'
    join public.khpos_ops_roles r on r.id=a.role_id
    where c.id=p_case_id
      and c.organisation_id=p_organisation_id
      and c.case_type='grievance'
      and (
        c.status='external_review_required'
        or (c.status='resolved' and c.decision_source='external')
      )
      and subject.user_id is distinct from p_actor_user_id
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN')
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_assurance_actor_has_role(p_actor_user_id uuid, p_organisation_id uuid, p_role_codes text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (
        r.code=any(p_role_codes)
        or (r.code='VISION_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_role_codes))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_culture_campus_access(p_actor uuid, p_org uuid, p_campus uuid, p_manage boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor
      and a.status='active'
      and r.organisation_id=p_org
      and r.status='active'
      and (
        (r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN') and a.campus_id is null)
        or (r.code='SCHOOL_GUARDIAN' and (a.campus_id=p_campus or a.campus_id is null))
        or (a.campus_id=p_campus and r.code in ('SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR'))
      )
      and (
        (p_manage and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','SECTIONAL_PROMOTER'))
        or (
          not p_manage
          and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR')
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_hpd_actor_has_role(p_actor_user_id uuid, p_organisation_id uuid, p_role_codes text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (
        r.code=any(p_role_codes)
        or (r.code='VISION_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_role_codes))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_lpi_actor_has_role(p_actor_user_id uuid, p_organisation_id uuid, p_role_codes text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (
        r.code=any(p_role_codes)
        or (r.code='VISION_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_role_codes))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_project_actor_has_role(p_actor_user_id uuid, p_organisation_id uuid, p_role_codes text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (
        r.code=any(p_role_codes)
        or (r.code='VISION_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_role_codes))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_recruitment_actor_has_role(p_actor_user_id uuid, p_organisation_id uuid, p_role_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (
        r.code=p_role_code
        or (p_role_code='SCHOOL_GUARDIAN' and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN'))
        or (p_role_code='SCHOOL_CUSTODIAN' and r.code='VISION_CUSTODIAN')
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_safeguarding_campus_role(p_actor uuid, p_org uuid, p_campus uuid, p_codes text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor
      and a.status='active'
      and r.organisation_id=p_org
      and r.status='active'
      and (
        r.code=any(p_codes)
        or (r.code='VISION_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_codes))
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_codes))
      )
      and (
        a.campus_id=p_campus
        or (a.campus_id is null and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN'))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_transition_actor_has_role(p_actor_user_id uuid, p_organisation_id uuid, p_role_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (
        r.code=p_role_code
        or (p_role_code='SCHOOL_GUARDIAN' and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN'))
        or (p_role_code='SCHOOL_CUSTODIAN' and r.code='VISION_CUSTODIAN')
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_govern_policy_server(p_actor_user_id uuid, p_organisation_id uuid, p_policy_id uuid, p_action text, p_input jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_policy public.khpos_ops_policies%rowtype;
  v_version public.khpos_ops_policy_versions%rowtype;
  v_id uuid;
  v_owner boolean;
  v_guardian boolean;
  v_editor boolean;
  v_author_is_vision boolean;
  v_note text := nullif(btrim(coalesce(p_input->>'note','')),'');
  v_review_date date;
  v_effective_date date;
  v_fields text[] := array['principles','policyStatements','rolesResponsibilities','rules','exceptions','escalation','recordsEvidence'];
  v_field text;
begin
  if not exists (
    select 1
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.user_id=p_actor_user_id
      and m.organisation_id=p_organisation_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Active school membership and partnership are required.';
  end if;

  select * into v_policy
  from public.khpos_ops_policies
  where id=p_policy_id
    and organisation_id=p_organisation_id
    and status<>'retired'
  for update;
  if not found then raise exception 'Policy is not in this school.'; end if;

  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN')
  ) into v_owner;

  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code='SCHOOL_GUARDIAN'
  ) into v_guardian;

  select v_owner or v_guardian or exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER')
  ) into v_editor;

  if not v_editor then
    raise exception 'An active school leadership assignment is required.';
  end if;

  if p_action='save' then
    if length(btrim(coalesce(p_input->>'purpose','')))<20
      or length(btrim(coalesce(p_input->>'scope','')))<10 then
      raise exception 'Purpose and scope need substantive text.';
    end if;

    foreach v_field in array v_fields loop
      if jsonb_typeof(p_input->v_field)<>'array'
        or jsonb_array_length(p_input->v_field)>30
        or exists(
          select 1
          from jsonb_array_elements(p_input->v_field) e
          where jsonb_typeof(e)<>'string'
            or length(btrim(e#>>'{}'))<5
            or length(e#>>'{}')>1000
        )
      then
        raise exception 'Every policy section must be an array of substantive statements.';
      end if;
    end loop;

    if jsonb_array_length(p_input->'policyStatements')=0
      or jsonb_array_length(p_input->'rules')=0 then
      raise exception 'Policy statements and rules are required.';
    end if;

    begin
      v_effective_date := (p_input->>'effectiveDate')::date;
      v_review_date := (p_input->>'reviewDate')::date;
    exception when others then
      raise exception 'Use valid effective and review dates.';
    end;

    if v_effective_date is null or v_review_date is null or v_review_date<=v_effective_date then
      raise exception 'Review date must be later than effective date.';
    end if;

    if p_input ? 'versionId' then
      select * into v_version
      from public.khpos_ops_policy_versions
      where id=(p_input->>'versionId')::uuid
        and policy_id=p_policy_id
      for update;

      if v_version.id is null
        or v_version.status<>'draft'
        or v_version.author_id<>p_actor_user_id then
        raise exception 'Only the author can edit an open draft.';
      end if;

      v_id := v_version.id;
      update public.khpos_ops_policy_versions
      set purpose=btrim(p_input->>'purpose'),
          scope=btrim(p_input->>'scope'),
          principles=p_input->'principles',
          policy_statements=p_input->'policyStatements',
          roles_responsibilities=p_input->'rolesResponsibilities',
          rules=p_input->'rules',
          exceptions=p_input->'exceptions',
          escalation=p_input->'escalation',
          records_evidence=p_input->'recordsEvidence',
          effective_date=v_effective_date,
          review_date=v_review_date
      where id=v_id;
    else
      if exists(
        select 1 from public.khpos_ops_policy_versions
        where policy_id=p_policy_id and status in ('draft','in_review')
      ) then
        raise exception 'Finish the open revision before starting another.';
      end if;

      insert into public.khpos_ops_policy_versions(
        policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,
        rules,exceptions,escalation,records_evidence,effective_date,review_date,author_id,status
      )
      select p_policy_id,coalesce(max(version),0)+1,
        btrim(p_input->>'purpose'),btrim(p_input->>'scope'),
        p_input->'principles',p_input->'policyStatements',p_input->'rolesResponsibilities',
        p_input->'rules',p_input->'exceptions',p_input->'escalation',p_input->'recordsEvidence',
        v_effective_date,v_review_date,p_actor_user_id,'draft'
      from public.khpos_ops_policy_versions
      where policy_id=p_policy_id
      returning id into v_id;
    end if;

    insert into public.khpos_ops_policy_events(
      organisation_id,policy_version_id,actor_id,action
    ) values(
      p_organisation_id,v_id,p_actor_user_id,
      case when p_input ? 'versionId' then 'edited' else 'drafted' end
    );
  else
    begin
      v_id:=(p_input->>'versionId')::uuid;
    exception when others then
      raise exception 'A valid version is required.';
    end;

    select * into v_version
    from public.khpos_ops_policy_versions
    where id=v_id and policy_id=p_policy_id
    for update;
    if v_version.id is null then raise exception 'Policy revision not found.'; end if;

    if p_action='submit'
      and v_version.status='draft'
      and v_version.author_id=p_actor_user_id then
      update public.khpos_ops_policy_versions
      set status='in_review',submitted_at=now()
      where id=v_id;

      insert into public.khpos_ops_policy_events(
        organisation_id,policy_version_id,actor_id,action
      ) values(p_organisation_id,v_id,p_actor_user_id,'submitted');

    elsif p_action in ('return','approve') and v_version.status='in_review' then
      if v_version.author_id=p_actor_user_id then
        raise exception 'The author cannot review their own policy.';
      end if;

      select exists(
        select 1
        from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles r on r.id=a.role_id
        where a.user_id=v_version.author_id
          and a.status='active'
          and r.organisation_id=p_organisation_id
          and r.status='active'
          and r.code='VISION_CUSTODIAN'
      ) into v_author_is_vision;

      if v_policy.priority='C0' then
        if v_author_is_vision then
          if not (v_guardian or exists(
            select 1
            from public.khpos_ops_role_assignments a
            join public.khpos_ops_roles r on r.id=a.role_id
            where a.user_id=p_actor_user_id
              and a.status='active'
              and r.organisation_id=p_organisation_id
              and r.status='active'
              and r.code='SCHOOL_CUSTODIAN'
          )) then
            raise exception 'A Vision Custodian-authored critical policy requires independent School Guardian or School Custodian review.';
          end if;
        elsif not v_owner then
          raise exception 'Critical policy approval requires the Vision Custodian or School Custodian.';
        end if;
      elsif not (v_owner or v_guardian) then
        raise exception 'Policy review requires the Vision Custodian, School Custodian or School Guardian.';
      end if;

      if p_action='return' and v_note is null then
        raise exception 'Give the author a reason for return.';
      end if;

      if p_action='approve' then
        update public.khpos_ops_policy_versions
        set status='superseded'
        where policy_id=p_policy_id and status='active';
      end if;

      update public.khpos_ops_policy_versions
      set status=case when p_action='approve' then 'active' else 'draft' end,
          reviewed_by=p_actor_user_id,
          reviewed_at=now(),
          review_note=v_note,
          approved_by=case when p_action='approve' then p_actor_user_id else null end,
          approved_at=case when p_action='approve' then now() else null end
      where id=v_id;

      if p_action='approve' then
        update public.khpos_ops_policies
        set status='active',updated_at=now()
        where id=p_policy_id;
      end if;

      insert into public.khpos_ops_policy_events(
        organisation_id,policy_version_id,actor_id,action,note
      ) values(
        p_organisation_id,v_id,p_actor_user_id,
        case when p_action='approve' then 'approved' else 'returned' end,
        v_note
      );
    else
      raise exception 'This transition is not allowed.';
    end if;
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_govern_process_server(p_actor_user_id uuid, p_organisation_id uuid, p_process_id uuid, p_action text, p_input jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_process public.khpos_ops_processes%rowtype;
  v_version public.khpos_ops_process_versions%rowtype;
  v_owner boolean;
  v_guardian boolean;
  v_editor boolean;
  v_author_is_vision boolean;
  v_id uuid;
  v_note text:=nullif(btrim(coalesce(p_input->>'note','')),'');
  v_effective date;
  v_field text;
  v_fields text[]:=array['inputs','steps','evidence','exceptionConditions','escalation','kpis'];
begin
  if not exists(
    select 1
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.user_id=p_actor_user_id
      and m.organisation_id=p_organisation_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Active school membership and partnership are required.';
  end if;

  select * into v_process
  from public.khpos_ops_processes
  where id=p_process_id
    and organisation_id=p_organisation_id
    and status<>'retired'
  for update;
  if not found then raise exception 'Process is not in this school.'; end if;

  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN')
  ) into v_owner;

  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code='SCHOOL_GUARDIAN'
  ) into v_guardian;

  select v_owner or v_guardian or exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER')
  ) into v_editor;

  if not v_editor then
    raise exception 'An active school leadership assignment is required.';
  end if;

  if p_action='save' then
    if length(btrim(coalesce(p_input->>'purpose','')))<20
      or length(btrim(coalesce(p_input->>'trigger','')))<10
      or length(btrim(coalesce(p_input->>'expectedOutcome','')))<10 then
      raise exception 'Purpose, trigger and expected outcome need substantive text.';
    end if;

    foreach v_field in array v_fields loop
      if jsonb_typeof(p_input->v_field) is distinct from 'array'
        or jsonb_array_length(p_input->v_field)>50
        or exists(
          select 1 from jsonb_array_elements(p_input->v_field) e
          where jsonb_typeof(e)<>'string'
            or length(btrim(e#>>'{}'))<5
            or length(e#>>'{}')>1000
        ) then
        raise exception 'Process sections must contain clear statements.';
      end if;
    end loop;

    if jsonb_array_length(p_input->'steps')=0 then
      raise exception 'At least one step is required.';
    end if;

    begin
      v_effective:=(p_input->>'effectiveDate')::date;
    exception when others then
      raise exception 'Use a valid effective date.';
    end;
    if v_effective is null then raise exception 'Effective date is required.'; end if;

    if p_input ? 'versionId' then
      select * into v_version
      from public.khpos_ops_process_versions
      where id=(p_input->>'versionId')::uuid and process_id=p_process_id
      for update;

      if v_version.id is null
        or v_version.status<>'draft'
        or v_version.author_id<>p_actor_user_id then
        raise exception 'Only the author can edit an open draft.';
      end if;

      v_id:=v_version.id;
      update public.khpos_ops_process_versions
      set purpose=btrim(p_input->>'purpose'),
          trigger=btrim(p_input->>'trigger'),
          inputs=p_input->'inputs',
          steps=p_input->'steps',
          sla=nullif(btrim(p_input->>'sla'),''),
          evidence=p_input->'evidence',
          expected_outcome=btrim(p_input->>'expectedOutcome'),
          exception_conditions=p_input->'exceptionConditions',
          escalation=p_input->'escalation',
          kpis=p_input->'kpis',
          effective_date=v_effective
      where id=v_id;
    else
      if exists(
        select 1
        from public.khpos_ops_process_versions
        where process_id=p_process_id and status in ('draft','in_review')
      ) then
        raise exception 'Finish the open revision before starting another.';
      end if;

      insert into public.khpos_ops_process_versions(
        process_id,version,purpose,trigger,inputs,steps,sla,evidence,expected_outcome,
        exception_conditions,escalation,kpis,effective_date,author_id,status
      )
      select p_process_id,coalesce(max(version),0)+1,
        btrim(p_input->>'purpose'),btrim(p_input->>'trigger'),
        p_input->'inputs',p_input->'steps',nullif(btrim(p_input->>'sla'),''),
        p_input->'evidence',btrim(p_input->>'expectedOutcome'),
        p_input->'exceptionConditions',p_input->'escalation',p_input->'kpis',
        v_effective,p_actor_user_id,'draft'
      from public.khpos_ops_process_versions
      where process_id=p_process_id
      returning id into v_id;
    end if;

    insert into public.khpos_ops_process_events(
      organisation_id,process_version_id,actor_id,action
    ) values(
      p_organisation_id,v_id,p_actor_user_id,
      case when p_input ? 'versionId' then 'edited' else 'drafted' end
    );
  else
    begin
      v_id:=(p_input->>'versionId')::uuid;
    exception when others then
      raise exception 'A valid process version is required.';
    end;

    select * into v_version
    from public.khpos_ops_process_versions
    where id=v_id and process_id=p_process_id
    for update;
    if v_version.id is null then raise exception 'Process revision not found.'; end if;

    if p_action='submit'
      and v_version.status='draft'
      and v_version.author_id=p_actor_user_id then
      update public.khpos_ops_process_versions
      set status='in_review',submitted_at=now()
      where id=v_id;

      insert into public.khpos_ops_process_events(
        organisation_id,process_version_id,actor_id,action
      ) values(p_organisation_id,v_id,p_actor_user_id,'submitted');

    elsif p_action in ('return','approve') and v_version.status='in_review' then
      if v_version.author_id=p_actor_user_id then
        raise exception 'The author cannot review their own process.';
      end if;

      select exists(
        select 1
        from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles r on r.id=a.role_id
        where a.user_id=v_version.author_id
          and a.status='active'
          and r.organisation_id=p_organisation_id
          and r.status='active'
          and r.code='VISION_CUSTODIAN'
      ) into v_author_is_vision;

      if v_process.criticality='P0' then
        if v_author_is_vision then
          if not (v_guardian or exists(
            select 1
            from public.khpos_ops_role_assignments a
            join public.khpos_ops_roles r on r.id=a.role_id
            where a.user_id=p_actor_user_id
              and a.status='active'
              and r.organisation_id=p_organisation_id
              and r.status='active'
              and r.code='SCHOOL_CUSTODIAN'
          )) then
            raise exception 'A Vision Custodian-authored critical process requires independent School Guardian or School Custodian review.';
          end if;
        elsif not v_owner then
          raise exception 'Critical process approval requires the Vision Custodian or School Custodian.';
        end if;
      elsif not (v_owner or v_guardian) then
        raise exception 'Process review requires the Vision Custodian, School Custodian or School Guardian.';
      end if;

      if p_action='return' and v_note is null then
        raise exception 'Give the author a reason for return.';
      end if;

      if p_action='approve' then
        if v_version.effective_date>current_date then
          raise exception 'A future effective date cannot be published yet.';
        end if;

        if exists(
          select 1
          from unnest(v_process.governing_policy_codes) as required(policy_code)
          where not exists(
            select 1
            from public.khpos_ops_policies p
            join public.khpos_ops_policy_versions pv
              on pv.policy_id=p.id and pv.status='active'
            where p.organisation_id=p_organisation_id
              and p.code=required.policy_code
              and p.status='active'
          )
        ) then
          raise exception 'Publish all governing school policies before this process.';
        end if;

        update public.khpos_ops_process_versions
        set status='superseded'
        where process_id=p_process_id and status='active';
      end if;

      update public.khpos_ops_process_versions
      set status=case when p_action='approve' then 'active' else 'draft' end,
          reviewed_by=p_actor_user_id,
          reviewed_at=now(),
          review_note=v_note,
          approved_by=case when p_action='approve' then p_actor_user_id else null end,
          approved_at=case when p_action='approve' then now() else null end
      where id=v_id;

      if p_action='approve' then
        update public.khpos_ops_processes
        set status='active',updated_at=now()
        where id=p_process_id;
      end if;

      insert into public.khpos_ops_process_events(
        organisation_id,process_version_id,actor_id,action,note
      ) values(
        p_organisation_id,v_id,p_actor_user_id,
        case when p_action='approve' then 'approved' else 'returned' end,
        v_note
      );
    else
      raise exception 'This transition is not allowed.';
    end if;
  end if;

  return v_id;
end;
$function$;

revoke all on function public.khpos_ops_govern_policy_server(uuid,uuid,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_govern_policy_server(uuid,uuid,uuid,text,jsonb)
  to service_role;

revoke all on function public.khpos_ops_govern_process_server(uuid,uuid,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_govern_process_server(uuid,uuid,uuid,text,jsonb)
  to service_role;
