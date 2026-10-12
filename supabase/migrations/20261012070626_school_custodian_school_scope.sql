-- Canonical school leadership identity. Company governance remains in platform
-- administration; it is not an operating role inside a partner school.
-- Existing role IDs, assignments, reporting lines and workflow references stay intact.
-- Deploy the compatible UI first, then apply this migration as one transaction.
-- Function definitions are explicit snapshots of the verified production baseline.
-- Preflight fails on drift rather than overwriting an unrelated later correction.

lock table public.khpos_ops_roles in share row exclusive mode;
lock table public.khpos_ops_role_charters in share row exclusive mode;

do $preflight$
begin
  if exists (
    select 1 from public.khpos_ops_roles legacy
    join public.khpos_ops_roles canonical on canonical.organisation_id=legacy.organisation_id
      and canonical.code='SCHOOL_CUSTODIAN'
    where legacy.code='VISION_CUSTODIAN'
  ) then
    raise exception 'Both custodian role records exist in one school. Resolve the identity collision without merging assignments automatically.';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_academic_actor_has_role(uuid, uuid, text[])'))),'missing') not in ('6d46b645f8a7c462e08211c70239d8c5','233c941a065be8bb82909b16b65e5339') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_academic_actor_has_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_academic_stream_visible(uuid, uuid, uuid)'))),'missing') not in ('4eb8316b795aa04380206ea9665aef45','2a7c4f3b4d9c524ca388043ceda2d2b2') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_academic_stream_visible';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_accountability_can_record_external_review(uuid, uuid, uuid)'))),'missing') not in ('4fa390dc632ea2df1c6597fe2978a383','2eb59b9f7f400bf511181a91c175e5c6') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_accountability_can_record_external_review';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_assurance_actor_has_role(uuid, uuid, text[])'))),'missing') not in ('bc412731278322d91f100aeddebea120','6a5522b584e677d0125184f49c3cc27a') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_assurance_actor_has_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_can_govern_performance(uuid, uuid)'))),'missing') not in ('2485a282e42790028821c0a2b2eb2940','fb41a5774800a23dda9620ba448bfb54') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_can_govern_performance';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_can_manage_people(uuid, uuid)'))),'missing') not in ('e566240a47b2187c0c429b78d2ac082a','b58e55ab0bb347bcf6fb9040d6904a06') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_can_manage_people';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_culture_campus_access(uuid, uuid, uuid, boolean)'))),'missing') not in ('4d4c90212f7510b526f91f40e978e8d6','79644221c229fa91b7bbba80d3d41b6a') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_culture_campus_access';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_guard_leadership_assignment()'))),'missing') not in ('e35605238c10f9dcc2d78c8a1adfc54b','b54a4e6b578a3a7f8110bf341c1e0ea0') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_guard_leadership_assignment';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_hpd_actor_has_role(uuid, uuid, text[])'))),'missing') not in ('17d8d86dcd5e76dc3371bfbd09e26bea','cf5daae532fef44dc674a9c1f3dc8a42') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_hpd_actor_has_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_lpi_actor_has_role(uuid, uuid, text[])'))),'missing') not in ('c9705f45715edce903c36b831e4039f8','a601c5679250b96e12c2de007f9b6804') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_lpi_actor_has_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_project_actor_has_role(uuid, uuid, text[])'))),'missing') not in ('34e1c017339e1dd67cd867f760708230','fce7b148f805889aeb74715354edd79b') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_project_actor_has_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_recruitment_actor_has_role(uuid, uuid, text)'))),'missing') not in ('2c70a23adbfd097133030b7e3f897181','c843f0707aa071d084371a015ca19b7a') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_recruitment_actor_has_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_recruitment_can_approve_role(uuid, uuid, uuid)'))),'missing') not in ('d5cefb6bb3a492755d48c4eb466a9288','e22f5b4d332cda3a14abd5d541d881b9') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_recruitment_can_approve_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_safeguarding_campus_role(uuid, uuid, uuid, text[])'))),'missing') not in ('9985d6cd863cd9c526c0d258b2e5a571','8d9d640be89738c41846b2cea37ad3d5') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_safeguarding_campus_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_standard_target_role(uuid, text)'))),'missing') not in ('121a5edcfebdc8433f351dd88d47b0d8','ae2bfd7a48b4e55c311c6525ef19dadd') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_standard_target_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_transition_actor_has_role(uuid, uuid, text)'))),'missing') not in ('9a59f4fc3f79ef1facb11f0f43255210','a56fe8170c8cdfa444b398268d84c33d') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_transition_actor_has_role';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_transition_can_approve_target(uuid, uuid, uuid)'))),'missing') not in ('6914b911adf61c21041f104080cc5298','9ae49a1923d1d62e12a9bf15a1be177a') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_transition_can_approve_target';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('khpos_private.ops_transition_can_manage_exit(uuid, uuid, uuid)'))),'missing') not in ('29d3648650ed835deceb3da3e1369ff3','020fa1bf25fcf4c7815de1ea9fedd7cd') then
    raise exception 'School custodian migration baseline drift: khpos_private.ops_transition_can_manage_exit';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_adopt_core_scorecard_server(uuid, uuid)'))),'missing') not in ('692e4b8080941ce038ec4c6a930a4502','823b6d89906a879ea926a076936f5ec5') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_adopt_core_scorecard_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_adopt_standard_release_server(uuid, uuid, uuid)'))),'missing') not in ('1058cf7a4d0d7e7e90df2527f5da80d9','f4359185e2cc713651ce03f242c6d43e') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_adopt_standard_release_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_apply_safe_execution_mappings_server(uuid, uuid)'))),'missing') not in ('611d40396b68ce5ea7050be6639cff73','969152fbbe62c240e80fc3a1fab4b85a') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_apply_safe_execution_mappings_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_bootstrap_partner_server(uuid)'))),'missing') not in ('0bad1b69d1bcdbff1d85ccea0ad2ec9c','369949d3e19c867ef295961dd33195c6') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_bootstrap_partner_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_create_academic_observation_server(uuid, uuid, uuid, uuid, text, timestamp with time zone, text, text, text, date)'))),'missing') not in ('66d4839df9a57a9699852f4846bca599','999647b7d4870c52f307fbfa82ba5305') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_create_academic_observation_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_create_accountability_case_server(uuid, uuid, jsonb)'))),'missing') not in ('16975bc1a1e969fff5949772d51c5635','04062862f9ee9472fb638d5d01377bcb') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_create_accountability_case_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_create_availability_case_server(uuid, uuid, jsonb)'))),'missing') not in ('852fa892ed5c435d6bf411ede435279f','ed88d4f917cc9d27efd3d1272bca1e03') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_create_availability_case_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_create_exit_case_server(uuid, uuid, uuid, text, date, text, text, text, uuid, boolean)'))),'missing') not in ('3afa7bf1c8d0551f6ffa6aa88b452f3b','51c28763fe8d87fff9b7370e77c01df5') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_create_exit_case_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_create_promotion_case_server(uuid, uuid, uuid, uuid, uuid, uuid, date, text, text, uuid)'))),'missing') not in ('9694f7d864ad28d33215ffd161f378b7','d9308c17b64182c9cbf0a0df6d61e36e') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_create_promotion_case_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_create_staff_server(uuid, uuid, jsonb)'))),'missing') not in ('40fcb786f2ecb6934cf8819e17f83a60','6676c498becbf8b46240b932714a25cf') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_create_staff_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_create_succession_plan_server(uuid, uuid, uuid, uuid, text, text, text, date)'))),'missing') not in ('037c90e92bda4edbb413bd8a7b0fb313','aadc965602a552735487c1d3f44b3711') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_create_succession_plan_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_create_workforce_request_server(uuid, uuid, jsonb)'))),'missing') not in ('2a2b4ebfc3cf6c10df159efe68054135','0002cc87d561b59c91ce0b03f6acfa94') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_create_workforce_request_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_execute_promotion_server(uuid, uuid, uuid)'))),'missing') not in ('b58c29feafe156b7deeb57214ff9be7f','370e8b877a01ec803b17b78bf9a2d2f0') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_execute_promotion_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_finalize_staff_exit_server(uuid, uuid, uuid)'))),'missing') not in ('2da0ae2deb65ed3c58a445ec05323b87','8c46f8deca6ea46235db5bda73027152') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_finalize_staff_exit_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_govern_policy_server(uuid, uuid, uuid, text, jsonb)'))),'missing') not in ('d79fc14dccc0efbdf594ad49b99c6b13','7c617d43ee0b4b5be304757eef43b249') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_govern_policy_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_govern_process_server(uuid, uuid, uuid, text, jsonb)'))),'missing') not in ('a7c58992e1419d2b6fdc73e207575523','eb2655653c1a7523782087a72b3bd322') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_govern_process_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_issue_staff_access_server(uuid, uuid, uuid)'))),'missing') not in ('f3be39d44b36f44bf7871eabb7e470ad','eaf0fad922846b7b06d11a20f93f33a8') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_issue_staff_access_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_network_pulse_server(uuid, uuid)'))),'missing') not in ('5fd3a165d4f747b2d3caf13f7addfa5b','4e531b9e4893aadfd85a823413b2a4d1') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_network_pulse_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_start_manual_process_server(uuid, uuid, uuid, uuid, uuid)'))),'missing') not in ('ecc7e3da8681fa01a635bc659e8d57e4','dc8b281e91cbd41144109a22465940bd') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_start_manual_process_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_succession_plan_action_server(uuid, uuid, uuid, text, text)'))),'missing') not in ('b8111213ba303e84361a149b3d400ba6','1f333a6ff4f69213a06dadde5fa1b2b7') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_succession_plan_action_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_update_succession_plan_server(uuid, uuid, uuid, text, text, text, date, text)'))),'missing') not in ('08b9af1cd58ef0512a6552b5f74f5505','da4edba8cf7ae34a47aa86218e77b12d') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_update_succession_plan_server';
  end if;
  if coalesce(md5(pg_get_functiondef(to_regprocedure('public.khpos_ops_verify_work_server(uuid, uuid, uuid, text, text)'))),'missing') not in ('d56bdf23ff7f67ec851defbe2d4fe681','e0184849869bc5e31547dd6c77f23716') then
    raise exception 'School custodian migration baseline drift: public.khpos_ops_verify_work_server';
  end if;
end;
$preflight$;

-- Keep legacy approved charter versions as history. Only the role title is
-- mechanically normalised in the successor; approved decision rights stay identical.
do $charters$
declare
  previous public.khpos_ops_role_charters%rowtype;
  next_version integer;
begin
  for previous in
    select c.* from public.khpos_ops_role_charters c
    where c.status='active'
      and (c.mission like '%Vision Custodian%' or c.owned_outcomes::text like '%Vision Custodian%'
        or c.responsibilities::text like '%Vision Custodian%' or c.decision_rights::text like '%Vision Custodian%'
        or c.escalation_rules::text like '%Vision Custodian%' or c.kpis::text like '%Vision Custodian%')
  loop
    select coalesce(max(version),0)+1 into next_version
      from public.khpos_ops_role_charters where role_id=previous.role_id;
    update public.khpos_ops_role_charters set status='superseded' where id=previous.id;
    insert into public.khpos_ops_role_charters (
      role_id,version,mission,owned_outcomes,responsibilities,decision_rights,
      escalation_rules,kpis,required_policy_codes,effective_date,approved_by,approved_at,status
    ) values (
      previous.role_id,next_version,replace(previous.mission,'Vision Custodian','School Custodian'),
      replace(previous.owned_outcomes::text,'Vision Custodian','School Custodian')::jsonb,
      replace(previous.responsibilities::text,'Vision Custodian','School Custodian')::jsonb,
      replace(previous.decision_rights::text,'Vision Custodian','School Custodian')::jsonb,
      replace(previous.escalation_rules::text,'Vision Custodian','School Custodian')::jsonb,
      replace(previous.kpis::text,'Vision Custodian','School Custodian')::jsonb,
      previous.required_policy_codes,previous.effective_date,previous.approved_by,previous.approved_at,'active'
    );
  end loop;
end;
$charters$;

update public.khpos_ops_roles
set code='SCHOOL_CUSTODIAN',title='School Custodian',updated_at=now()
where code='VISION_CUSTODIAN';

-- Existing canonical roles also receive the consistent public title.
update public.khpos_ops_roles set title='School Custodian',updated_at=now()
where code='SCHOOL_CUSTODIAN' and title is distinct from 'School Custodian';

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
        or (r.code='SCHOOL_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_role_codes))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_academic_stream_visible(p_actor_user_id uuid, p_organisation_id uuid, p_stream_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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
          p_actor_user_id,p_organisation_id,array['SCHOOL_CUSTODIAN']
        )
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
      and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN')
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
        or (r.code='SCHOOL_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_role_codes))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_can_govern_performance(p_actor_user_id uuid, p_organisation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN')
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_can_manage_people(p_actor_user_id uuid, p_organisation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN')
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
        (r.code in ('SCHOOL_CUSTODIAN') and a.campus_id is null)
        or (r.code='SCHOOL_GUARDIAN' and (a.campus_id=p_campus or a.campus_id is null))
        or (a.campus_id=p_campus and r.code in ('SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR'))
      )
      and (
        (p_manage and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','SECTIONAL_PROMOTER'))
        or (
          not p_manage
          and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR')
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_guard_leadership_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare v_code text; v_org uuid;
begin
  select code,organisation_id into v_code,v_org from public.khpos_ops_roles where id=new.role_id;
  if v_code in ('SCHOOL_CUSTODIAN') then
    if tg_op='INSERT' then
      if current_setting('khpos.bootstrap_partner',true) is distinct from v_org::text
         or new.appointed_by is distinct from new.user_id
         or exists(select 1 from public.khpos_ops_role_assignments where role_id=new.role_id and status='active') then
        raise exception 'Custodian seats require separate governance approval.';
      end if;
    elsif old.status<>'active' or new.user_id<>old.user_id or new.role_id<>old.role_id then
      raise exception 'Custodian seats require separate governance approval.';
    end if;
  elsif v_code='SCHOOL_GUARDIAN' and new.status='active' then
    if new.campus_id is null then raise exception 'School Guardian assignment requires a campus.'; end if;
    if tg_op='INSERT' or old.status<>'active' or new.user_id<>old.user_id or new.role_id<>old.role_id or new.campus_id is distinct from old.campus_id then
      if new.appointed_by is null or not khpos_private.ops_hpd_has_membership(new.appointed_by,v_org) or not khpos_private.ops_hpd_actor_has_role(new.appointed_by,v_org,array['SCHOOL_CUSTODIAN']::text[]) then
        raise exception 'Only an active school owner can appoint a campus School Guardian.';
      end if;
    end if;
  end if;
  return new;
end $function$;

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
        or (r.code='SCHOOL_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
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
        or (r.code='SCHOOL_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
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
        or (r.code='SCHOOL_CUSTODIAN' and ('SCHOOL_GUARDIAN'=any(p_role_codes) or 'SCHOOL_CUSTODIAN'=any(p_role_codes)))
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
        or (p_role_code='SCHOOL_GUARDIAN' and r.code in ('SCHOOL_CUSTODIAN'))
        or (p_role_code='SCHOOL_CUSTODIAN' and r.code='SCHOOL_CUSTODIAN')
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_recruitment_can_approve_role(p_actor_user_id uuid, p_organisation_id uuid, p_role_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare
  v_code text;
begin
  select code into v_code
  from public.khpos_ops_roles
  where id=p_role_id and organisation_id=p_organisation_id and status='active';

  if v_code is null or v_code in ('SCHOOL_CUSTODIAN') then
    return false;
  end if;

  if v_code='SCHOOL_GUARDIAN' then
    return khpos_private.ops_recruitment_actor_has_role(
      p_actor_user_id,p_organisation_id,'SCHOOL_CUSTODIAN'
    );
  end if;

  return khpos_private.ops_recruitment_can_manage(
    p_actor_user_id,p_organisation_id
  );
end;
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
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_codes))
        or (r.code='SCHOOL_CUSTODIAN' and 'SCHOOL_GUARDIAN'=any(p_codes))
      )
      and (
        a.campus_id=p_campus
        or (a.campus_id is null and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN'))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_standard_target_role(p_organisation_id uuid, p_source_role_code text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.id
  from public.khpos_ops_roles r
  where r.organisation_id=p_organisation_id and r.status='active'
    and r.code=case when p_source_role_code='VISION_CUSTODIAN' then 'SCHOOL_CUSTODIAN' else p_source_role_code end
  order by r.role_level,r.code
  limit 1;
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
        or (p_role_code='SCHOOL_GUARDIAN' and r.code in ('SCHOOL_CUSTODIAN'))
        or (p_role_code='SCHOOL_CUSTODIAN' and r.code='SCHOOL_CUSTODIAN')
      )
  );
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_transition_can_approve_target(p_actor_user_id uuid, p_organisation_id uuid, p_target_role_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare
  v_code text;
begin
  select code into v_code
  from public.khpos_ops_roles
  where id=p_target_role_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_code is null or v_code in ('SCHOOL_CUSTODIAN') then
    return false;
  end if;

  if v_code='SCHOOL_GUARDIAN' then
    return khpos_private.ops_transition_actor_has_role(
      p_actor_user_id,p_organisation_id,'SCHOOL_CUSTODIAN'
    );
  end if;

  return khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION khpos_private.ops_transition_can_manage_exit(p_actor_user_id uuid, p_organisation_id uuid, p_staff_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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

  if v_role_code in ('SCHOOL_CUSTODIAN') then
    return false;
  end if;

  if v_role_code='SCHOOL_GUARDIAN' then
    return khpos_private.ops_transition_actor_has_role(
      p_actor_user_id,p_organisation_id,'SCHOOL_CUSTODIAN'
    );
  end if;

  return khpos_private.ops_transition_can_manage_people(
    p_actor_user_id,p_organisation_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_adopt_core_scorecard_server(p_actor_user_id uuid, p_organisation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owner_role_id uuid;
  v_created integer := 0;
  v_existing integer := 0;
  v_conflicts integer := 0;
  v_kpi_id uuid;
  v_item record;
begin
  if not khpos_private.ops_can_govern_performance(
    p_actor_user_id,
    p_organisation_id
  ) then
    raise exception 'Core scorecard adoption requires an active School Guardian or School Custodian role.';
  end if;

  select r.id into v_owner_role_id
  from public.khpos_ops_roles r
  where r.organisation_id=p_organisation_id
    and r.status='active'
    and r.code in ('SCHOOL_GUARDIAN','SCHOOL_CUSTODIAN')
    and exists (
      select 1
      from public.khpos_ops_role_assignments a
      where a.role_id=r.id
        and a.status='active'
        and khpos_private.ops_hpd_has_membership(
          a.user_id,
          p_organisation_id
        )
    )
  order by
    case r.code
      when 'SCHOOL_GUARDIAN' then 0
      when 'SCHOOL_CUSTODIAN' then 1
      else 2
    end,
    r.role_level
  limit 1;

  if v_owner_role_id is null then
    raise exception 'A staffed School Guardian or School Custodian role is required before the core scorecard can be adopted.';
  end if;

  for v_item in
    select *
    from (
      values
        (
          'KHP-CORE-EXEC-COVERAGE',
          'Execution coverage',
          'operations',
          'Percentage of approved operating processes that currently have a configured execution profile. This is a control-coverage measure, not a judgment of school quality.',
          'process',
          'execution_coverage'
        ),
        (
          'KHP-CORE-WORK-RELIABILITY',
          'Work completion reliability',
          'operations',
          'Percentage of governed work due in the rolling 30-day operating window that has been completed.',
          'process',
          'work_completion_reliability'
        ),
        (
          'KHP-CORE-ONTIME',
          'On-time completion',
          'operations',
          'Percentage of completed governed work with a deadline that was completed by its due time in the rolling 30-day operating window.',
          'process',
          'on_time_completion'
        ),
        (
          'KHP-CORE-FIRST-PASS',
          'First-pass verification',
          'governance',
          'Percentage of governed work verified in the rolling 30-day operating window without first being returned for correction.',
          'process',
          'verification_first_pass'
        ),
        (
          'KHP-CORE-ISSUE-CLOSURE',
          'Issue closure',
          'governance',
          'Percentage of institutional issues opened in the rolling 30-day operating window that are now resolved, verified or closed.',
          'process',
          'issue_closure'
        ),
        (
          'KHP-CORE-DECISION-CLOSURE',
          'Decision action closure',
          'governance',
          'Percentage of action-required decisions made in the rolling 30-day operating window whose required action is implemented or closed.',
          'process',
          'decision_action_closure'
        )
    ) as starter(
      code,
      name,
      domain,
      definition,
      indicator_type,
      source_key
    )
  loop
    select k.id into v_kpi_id
    from public.khpos_ops_kpis k
    where k.organisation_id=p_organisation_id
      and k.code=v_item.code
    limit 1;

    if v_kpi_id is not null then
      if exists (
        select 1
        from public.khpos_ops_kpi_versions v
        join public.khpos_ops_kpis k on k.id=v.kpi_id
        where k.id=v_kpi_id
          and k.status='active'
          and v.status='active'
          and v.source_type='operational_engine'
          and v.source_key=v_item.source_key
      ) then
        v_existing := v_existing + 1;
      else
        v_conflicts := v_conflicts + 1;
      end if;
      v_kpi_id := null;
      continue;
    end if;

    insert into public.khpos_ops_kpis(
      organisation_id,
      code,
      name,
      domain,
      status,
      created_by
    ) values (
      p_organisation_id,
      v_item.code,
      v_item.name,
      v_item.domain,
      'active',
      p_actor_user_id
    )
    returning id into v_kpi_id;

    insert into public.khpos_ops_kpi_versions(
      kpi_id,
      version,
      definition,
      owner_role_id,
      scope_type,
      scope_role_id,
      campus_id,
      unit_id,
      system_code,
      indicator_type,
      unit,
      direction,
      cadence,
      source_type,
      source_key,
      target_config,
      critical_control,
      effective_date,
      approved_by,
      approved_at,
      status
    ) values (
      v_kpi_id,
      1,
      v_item.definition,
      v_owner_role_id,
      'institution',
      null,
      null,
      null,
      null,
      v_item.indicator_type,
      'percent',
      'baseline_only',
      'weekly',
      'operational_engine',
      v_item.source_key,
      '{}'::jsonb,
      false,
      current_date,
      p_actor_user_id,
      now(),
      'active'
    );

    insert into public.khpos_ops_audit_events(
      organisation_id,
      actor_user_id,
      event_type,
      object_type,
      object_id,
      metadata
    ) values (
      p_organisation_id,
      p_actor_user_id,
      'ops_core_kpi_adopted',
      'kpi',
      v_kpi_id,
      jsonb_build_object(
        'code',v_item.code,
        'sourceKey',v_item.source_key,
        'direction','baseline_only',
        'cadence','weekly'
      )
    );

    v_created := v_created + 1;
    v_kpi_id := null;
  end loop;

  insert into public.khpos_ops_audit_events(
    organisation_id,
    actor_user_id,
    event_type,
    object_type,
    object_id,
    metadata
  ) values (
    p_organisation_id,
    p_actor_user_id,
    'ops_core_scorecard_adopted',
    'organisation',
    p_organisation_id,
    jsonb_build_object(
      'created',v_created,
      'existing',v_existing,
      'conflicts',v_conflicts
    )
  );

  return jsonb_build_object(
    'total',6,
    'created',v_created,
    'existing',v_existing,
    'conflicts',v_conflicts
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_adopt_standard_release_server(p_actor_user_id uuid, p_organisation_id uuid, p_installation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_installation public.khpos_standard_installations%rowtype;
  v_release public.khpos_standard_releases%rowtype;
  v_item jsonb;
  v_policy_id uuid;
  v_process_id uuid;
  v_role_id uuid;
  v_tool_id uuid;
  v_checklist_id uuid;
  v_campus_id uuid;
  v_unit_id uuid;
  v_policy_activated integer := 0;
  v_process_activated integer := 0;
  v_runtime_profiles integer := 0;
  v_checklists integer := 0;
  v_recurring integer := 0;
begin
  if not khpos_private.ops_hpd_has_membership(
    p_actor_user_id,p_organisation_id
  ) or not khpos_private.ops_hpd_actor_has_role(
    p_actor_user_id,p_organisation_id,
    array['SCHOOL_CUSTODIAN']::text[]
  ) then
    raise exception 'Only the active institutional Custodian can adopt a KAEC Standard release for the school.';
  end if;

  select * into v_installation
  from public.khpos_standard_installations
  where id=p_installation_id
    and organisation_id=p_organisation_id
  for update;

  if v_installation.id is null then
    raise exception 'Standard installation not found.';
  end if;
  if v_installation.status='active' then
    return;
  end if;
  if v_installation.status<>'pending_adoption' then
    raise exception 'Only a pending KAEC Standard installation can be adopted.';
  end if;

  select * into v_release
  from public.khpos_standard_releases
  where id=v_installation.release_id;

  if v_release.id is null then
    raise exception 'KAEC Standard release not found.';
  end if;

  if exists (
    select 1
    from public.khpos_ops_policies p
    where p.organisation_id=p_organisation_id
      and exists (
        select 1
        from jsonb_array_elements(v_release.snapshot->'policies') item
        where item->>'code'=p.code
      )
      and not exists (
        select 1 from public.khpos_ops_policy_versions pv
        where pv.policy_id=p.id and pv.status='active'
      )
      and not exists (
        select 1 from public.khpos_ops_policy_versions pv
        where pv.policy_id=p.id
          and pv.status='draft'
          and pv.standard_release_id=v_release.id
      )
  ) then
    raise exception 'A locally customised policy must complete independent governance before the KAEC Standard can be adopted.';
  end if;

  if exists (
    select 1
    from public.khpos_ops_processes p
    where p.organisation_id=p_organisation_id
      and exists (
        select 1
        from jsonb_array_elements(v_release.snapshot->'processes') item
        where item->>'code'=p.code
      )
      and not exists (
        select 1 from public.khpos_ops_process_versions pv
        where pv.process_id=p.id and pv.status='active'
      )
      and not exists (
        select 1 from public.khpos_ops_process_versions pv
        where pv.process_id=p.id
          and pv.status='draft'
          and pv.standard_release_id=v_release.id
      )
  ) then
    raise exception 'A locally customised process must complete independent governance before the KAEC Standard can be adopted.';
  end if;

  perform set_config('khpos.standard_adoption',v_release.id::text,true);

  for v_item in
    select value from jsonb_array_elements(v_release.snapshot->'policies')
  loop
    select id into v_policy_id
    from public.khpos_ops_policies
    where organisation_id=p_organisation_id
      and code=v_item->>'code';

    if v_policy_id is null then
      raise exception 'Installed policy % is missing.',v_item->>'code';
    end if;

    if not exists (
      select 1 from public.khpos_ops_policy_versions
      where policy_id=v_policy_id and status='active'
    ) then
      update public.khpos_ops_policy_versions
      set status='active',
          effective_date=coalesce(effective_date,current_date),
          approved_by=p_actor_user_id,
          approved_at=now(),
          reviewed_by=p_actor_user_id,
          reviewed_at=now(),
          review_note='Adopted as part of '||v_release.code||' institutional standard.'
      where id=(
        select id
        from public.khpos_ops_policy_versions
        where policy_id=v_policy_id
          and status='draft'
          and standard_release_id=v_release.id
        order by version desc
        limit 1
      );

      if found then
        v_policy_activated := v_policy_activated+1;
      end if;
    end if;

    if exists (
      select 1 from public.khpos_ops_policy_versions
      where policy_id=v_policy_id and status='active'
    ) then
      update public.khpos_ops_policies
      set status='active',updated_at=now()
      where id=v_policy_id and status<>'active';
    end if;
  end loop;

  for v_item in
    select value from jsonb_array_elements(v_release.snapshot->'processes')
  loop
    select id into v_process_id
    from public.khpos_ops_processes
    where organisation_id=p_organisation_id
      and code=v_item->>'code';

    if v_process_id is null then
      raise exception 'Installed process % is missing.',v_item->>'code';
    end if;

    if not exists (
      select 1 from public.khpos_ops_process_versions
      where process_id=v_process_id and status='active'
    ) then
      update public.khpos_ops_process_versions
      set status='active',
          effective_date=coalesce(effective_date,current_date),
          approved_by=p_actor_user_id,
          approved_at=now(),
          reviewed_by=p_actor_user_id,
          reviewed_at=now(),
          review_note='Adopted as part of '||v_release.code||' institutional standard.'
      where id=(
        select id
        from public.khpos_ops_process_versions
        where process_id=v_process_id
          and status='draft'
          and standard_release_id=v_release.id
        order by version desc
        limit 1
      );

      if found then
        v_process_activated := v_process_activated+1;
      end if;
    end if;

    if exists (
      select 1 from public.khpos_ops_process_versions
      where process_id=v_process_id and status='active'
    ) then
      update public.khpos_ops_processes
      set status='active',updated_at=now()
      where id=v_process_id and status<>'active';
    end if;
  end loop;

  for v_item in
    select value from jsonb_array_elements(v_release.snapshot->'checklists')
  loop
    select id into v_process_id
    from public.khpos_ops_processes
    where organisation_id=p_organisation_id
      and code=v_item->>'processCode';

    insert into public.khpos_ops_checklist_templates(
      organisation_id,process_id,code,name,version,status,
      created_by,approved_by,approved_at
    ) values (
      p_organisation_id,
      v_process_id,
      v_item->>'code',
      v_item->>'name',
      (v_item->>'version')::integer,
      'active',
      p_actor_user_id,
      p_actor_user_id,
      now()
    )
    on conflict (organisation_id,code,version) do nothing;

    select id into v_checklist_id
    from public.khpos_ops_checklist_templates
    where organisation_id=p_organisation_id
      and code=v_item->>'code'
      and version=(v_item->>'version')::integer;

    for v_item in
      select value from jsonb_array_elements(coalesce(v_item->'items','[]'::jsonb))
    loop
      insert into public.khpos_ops_checklist_template_items(
        template_id,position,label,guidance,response_type,required,
        options,exception_on_response
      )
      select
        v_checklist_id,
        (v_item->>'position')::integer,
        v_item->>'label',
        nullif(v_item->>'guidance',''),
        v_item->>'responseType',
        coalesce((v_item->>'required')::boolean,true),
        coalesce(v_item->'options','[]'::jsonb),
        v_item->'exceptionOnResponse'
      where not exists (
        select 1 from public.khpos_ops_checklist_template_items
        where template_id=v_checklist_id
          and position=(v_item->>'position')::integer
      );
    end loop;

    v_checklists := v_checklists+1;
  end loop;

  for v_item in
    select value from jsonb_array_elements(v_release.snapshot->'toolRequirements')
  loop
    select id into v_process_id
    from public.khpos_ops_processes
    where organisation_id=p_organisation_id
      and code=v_item->>'processCode';

    select id into v_tool_id
    from public.khpos_ops_tool_templates
    where organisation_id=p_organisation_id
      and code=v_item->>'toolCode';

    if v_process_id is not null and v_tool_id is not null then
      insert into public.khpos_ops_process_tool_requirements(
        organisation_id,process_id,tool_template_id,label,required,
        minimum_entries,verification_required,status
      ) values (
        p_organisation_id,
        v_process_id,
        v_tool_id,
        v_item->>'label',
        coalesce((v_item->>'required')::boolean,true),
        coalesce((v_item->>'minimumEntries')::integer,1),
        coalesce((v_item->>'verificationRequired')::boolean,false),
        'active'
      )
      on conflict (process_id,label) do nothing;
    end if;
  end loop;

  for v_item in
    select value from jsonb_array_elements(v_release.snapshot->'executionProfiles')
  loop
    select id into v_process_id
    from public.khpos_ops_processes
    where organisation_id=p_organisation_id
      and code=v_item->>'processCode';

    v_role_id := null;
    if nullif(v_item->>'ownerRoleCode','') is not null then
      v_role_id := khpos_private.ops_standard_target_role(
        p_organisation_id,v_item->>'ownerRoleCode'
      );
    end if;

    if v_process_id is not null then
      insert into public.khpos_ops_process_execution_profiles(
        organisation_id,process_id,activation_mode,owner_role_id,event_type,
        condition_key,trigger_summary,due_offset_minutes,evidence_required,
        verification_required,escalation_minutes,kpi_codes,status,
        configured_by,configured_at
      ) values (
        p_organisation_id,
        v_process_id,
        v_item->>'activationMode',
        v_role_id,
        nullif(v_item->>'eventType',''),
        nullif(v_item->>'conditionKey',''),
        nullif(v_item->>'triggerSummary',''),
        case when nullif(v_item->>'dueOffsetMinutes','') is null then null
             else (v_item->>'dueOffsetMinutes')::integer end,
        coalesce((v_item->>'evidenceRequired')::boolean,false),
        coalesce((v_item->>'verificationRequired')::boolean,false),
        case when nullif(v_item->>'escalationMinutes','') is null then null
             else (v_item->>'escalationMinutes')::integer end,
        coalesce(array(select jsonb_array_elements_text(v_item->'kpiCodes')),'{}'::text[]),
        v_item->>'status',
        p_actor_user_id,
        case when v_item->>'status'='configured' then now() else null end
      )
      on conflict (process_id) do nothing;

      if found then
        v_runtime_profiles := v_runtime_profiles+1;
      end if;
    end if;
  end loop;

  for v_item in
    select value from jsonb_array_elements(v_release.snapshot->'recurringRules')
  loop
    select id into v_process_id
    from public.khpos_ops_processes
    where organisation_id=p_organisation_id
      and code=v_item->>'processCode';

    v_role_id := khpos_private.ops_standard_target_role(
      p_organisation_id,v_item->>'ownerRoleCode'
    );

    v_campus_id := null;
    if nullif(v_item->>'campusCode','') is not null then
      select id into v_campus_id
      from public.khpos_ops_campuses
      where organisation_id=p_organisation_id
        and code=v_item->>'campusCode'
        and status='active';
    end if;

    v_unit_id := null;
    if nullif(v_item->>'unitCode','') is not null then
      select id into v_unit_id
      from public.khpos_ops_units
      where organisation_id=p_organisation_id
        and code=v_item->>'unitCode'
        and status='active';
    end if;

    v_checklist_id := null;
    if nullif(v_item->>'checklistCode','') is not null then
      select id into v_checklist_id
      from public.khpos_ops_checklist_templates
      where organisation_id=p_organisation_id
        and code=v_item->>'checklistCode'
        and status='active'
      order by version desc
      limit 1;
    end if;

    if v_process_id is not null and v_role_id is not null then
      insert into public.khpos_ops_recurring_rules(
        organisation_id,process_id,owner_role_id,campus_id,unit_id,
        checklist_template_id,code,title,description,cadence,weekdays,
        weekday,day_of_month,due_time,timezone,start_date,end_date,
        evidence_required,verification_required,priority,status,created_by
      ) values (
        p_organisation_id,
        v_process_id,
        v_role_id,
        v_campus_id,
        v_unit_id,
        v_checklist_id,
        v_item->>'code',
        v_item->>'title',
        v_item->>'description',
        v_item->>'cadence',
        coalesce(array(select (jsonb_array_elements_text(v_item->'weekdays'))::integer),array[1,2,3,4,5,6,7]),
        case when nullif(v_item->>'weekday','') is null then null
             else (v_item->>'weekday')::integer end,
        case when nullif(v_item->>'dayOfMonth','') is null then null
             else (v_item->>'dayOfMonth')::integer end,
        (v_item->>'dueTime')::time,
        coalesce(nullif(v_item->>'timezone',''),'Africa/Lagos'),
        current_date,
        null,
        coalesce((v_item->>'evidenceRequired')::boolean,false),
        coalesce((v_item->>'verificationRequired')::boolean,false),
        v_item->>'priority',
        'paused',
        p_actor_user_id
      )
      on conflict (organisation_id,code) do nothing;

      if found then
        v_recurring := v_recurring+1;
      end if;
    end if;
  end loop;

  update public.khpos_standard_installations
  set status='active',
      adopted_by=p_actor_user_id,
      adopted_at=now(),
      updated_at=now(),
      summary=summary||jsonb_build_object(
        'adoptedAt',now(),
        'policyVersionsActivated',v_policy_activated,
        'processVersionsActivated',v_process_activated,
        'executionProfilesInstalled',v_runtime_profiles,
        'checklistsInstalled',v_checklists,
        'recurringRulesInstalledPaused',v_recurring
      )
  where id=v_installation.id;

  update public.khpos_standard_installations
  set status='superseded',updated_at=now()
  where organisation_id=p_organisation_id
    and id<>v_installation.id
    and status='active';

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,
    'ops_standard_adopted','standard_installation',v_installation.id,
    jsonb_build_object(
      'releaseId',v_release.id,
      'releaseCode',v_release.code,
      'policyVersionsActivated',v_policy_activated,
      'processVersionsActivated',v_process_activated,
      'recurringRulesInstalledPaused',v_recurring
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_apply_safe_execution_mappings_server(p_actor_user_id uuid, p_organisation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_mapped integer := 0;
  v_mapped_p0 integer := 0;
  v_blocked_missing_assignment integer := 0;
  v_multiple_owner integer := 0;
  v_no_owner integer := 0;
begin
  if not khpos_private.ops_hpd_has_membership(
    p_actor_user_id,p_organisation_id
  ) or not khpos_private.ops_hpd_actor_has_role(
    p_actor_user_id,
    p_organisation_id,
    array[
      'SCHOOL_CUSTODIAN',
      'SCHOOL_GUARDIAN',
      'ACADEMIC_INSPECTOR',
      'SKILL_INSPECTOR'
    ]::text[]
  ) then
    raise exception 'An active school leadership role is required to apply safe execution mappings.';
  end if;

  with candidates as (
    select
      ep.id as profile_id,
      ep.process_id,
      p.code,
      p.criticality,
      pv.trigger,
      pv.evidence,
      (array_agg(pr.role_id))[1] as owner_role_id,
      count(pr.role_id)::integer as owner_count
    from public.khpos_ops_process_execution_profiles ep
    join public.khpos_ops_processes p
      on p.id=ep.process_id
     and p.organisation_id=ep.organisation_id
     and p.status<>'retired'
    join lateral (
      select x.trigger,x.evidence
      from public.khpos_ops_process_versions x
      where x.process_id=p.id
        and x.status='active'
      order by x.version desc
      limit 1
    ) pv on true
    left join public.khpos_ops_process_roles pr
      on pr.process_id=p.id
     and pr.participation='owner'
    where ep.organisation_id=p_organisation_id
      and ep.status='needs_mapping'
      and ep.activation_mode='manual_on_demand'
    group by
      ep.id,ep.process_id,p.code,p.criticality,pv.trigger,pv.evidence
  ),
  eligible as (
    select c.*
    from candidates c
    where c.owner_count=1
      and c.owner_role_id is not null
      and exists (
        select 1 from public.khpos_ops_roles r
        where r.id=c.owner_role_id
          and r.organisation_id=p_organisation_id and r.status='active'
      )
      and exists (
        select 1
        from public.khpos_ops_role_assignments a
        where a.role_id=c.owner_role_id
          and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
      )
  ),
  updated as (
    update public.khpos_ops_process_execution_profiles ep
    set
      owner_role_id=e.owner_role_id,
      trigger_summary=coalesce(
        nullif(btrim(ep.trigger_summary),''),
        nullif(btrim(e.trigger),'')
      ),
      evidence_required=case
        when jsonb_typeof(e.evidence)='array'
          then jsonb_array_length(e.evidence)>0
        when e.evidence is null or e.evidence='null'::jsonb
          then false
        else true
      end,
      status='configured',
      configured_by=p_actor_user_id,
      configured_at=now(),
      updated_at=now()
    from eligible e
    where ep.id=e.profile_id
    returning
      ep.id,
      ep.process_id,
      e.code,
      e.criticality,
      e.owner_role_id
  ),
  audit_rows as (
    insert into public.khpos_ops_audit_events(
      organisation_id,
      actor_user_id,
      event_type,
      object_type,
      object_id,
      metadata
    )
    select
      p_organisation_id,
      p_actor_user_id,
      'ops_execution_safe_mapped',
      'process_execution_profile',
      u.id,
      jsonb_build_object(
        'processId',u.process_id,
        'processCode',u.code,
        'ownerRoleId',u.owner_role_id,
        'mode','manual_on_demand',
        'method','single_governed_owner_with_active_assignment'
      )
    from updated u
    returning id
  )
  select
    count(*)::integer,
    count(*) filter (where criticality='P0')::integer
  into v_mapped,v_mapped_p0
  from updated;

  with candidates as (
    select
      ep.process_id,
      count(pr.role_id)::integer as owner_count,
      (array_agg(pr.role_id))[1] as owner_role_id
    from public.khpos_ops_process_execution_profiles ep
    join public.khpos_ops_processes p
      on p.id=ep.process_id
     and p.organisation_id=ep.organisation_id
     and p.status<>'retired'
    left join public.khpos_ops_process_roles pr
      on pr.process_id=p.id
     and pr.participation='owner'
    where ep.organisation_id=p_organisation_id
      and ep.status='needs_mapping'
      and ep.activation_mode='manual_on_demand'
      and exists (
        select 1
        from public.khpos_ops_process_versions pv
        where pv.process_id=p.id
          and pv.status='active'
      )
    group by ep.process_id
  )
  select
    count(*) filter (
      where owner_count=1
        and owner_role_id is not null
        and not exists (
          select 1
          from public.khpos_ops_role_assignments a
          where a.role_id=c.owner_role_id
            and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
        )
    )::integer,
    count(*) filter (where owner_count>1)::integer,
    count(*) filter (where owner_count=0)::integer
  into
    v_blocked_missing_assignment,
    v_multiple_owner,
    v_no_owner
  from candidates c;

  insert into public.khpos_ops_audit_events(
    organisation_id,
    actor_user_id,
    event_type,
    object_type,
    object_id,
    metadata
  ) values (
    p_organisation_id,
    p_actor_user_id,
    'ops_execution_safe_mapping_batch',
    'organisation',
    p_organisation_id,
    jsonb_build_object(
      'mapped',v_mapped,
      'mappedP0',v_mapped_p0,
      'blockedMissingAssignment',v_blocked_missing_assignment,
      'multipleOwner',v_multiple_owner,
      'noOwner',v_no_owner
    )
  );

  return jsonb_build_object(
    'mapped',v_mapped,
    'mappedP0',v_mapped_p0,
    'blockedMissingAssignment',v_blocked_missing_assignment,
    'multipleOwner',v_multiple_owner,
    'noOwner',v_no_owner
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_bootstrap_partner_server(p_organisation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare
  v_org uuid := p_organisation_id;
  v_actor uuid;
  v_campus uuid;
  v_vc uuid;
  v_sg uuid;
  v_ai uuid;
  v_si uuid;
  v_sp uuid;
  v_teacher uuid;
  v_facilitator uuid;
begin
  select m.user_id into v_actor from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=v_org and m.status='active' and m.role='executive'
    and o.partner_status='active' and 'khpos_core'=any(o.partner_entitlements)
  order by m.created_at limit 1;
  if v_actor is null then raise exception 'An active approved school with an executive is required.'; end if;
  if exists(select 1 from public.khpos_ops_roles where organisation_id=v_org and code in ('SCHOOL_CUSTODIAN')) then return; end if;
  perform set_config('khpos.bootstrap_partner',v_org::text,true);
  insert into public.khpos_ops_campuses(
    organisation_id,code,name,status,created_by
  ) values (
    v_org,'MAIN',(select name from public.organisations where id=v_org),'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set name=excluded.name,status='active',updated_at=now()
  returning id into v_campus;

  insert into public.khpos_ops_units(
    organisation_id,campus_id,code,name,unit_type,status,created_by
  ) values
    (v_org,v_campus,'ACADEMICS','Academic Function','academic_function','active',v_actor),
    (v_org,v_campus,'SECTION_1','Learning Section 1','academic_section','active',v_actor),
    (v_org,v_campus,'SECTION_2','Learning Section 2','academic_section','active',v_actor),
    (v_org,v_campus,'SKILLS','Skills & Young CEO Hub','skills_function','active',v_actor)
  on conflict (organisation_id,code) do update
  set campus_id=excluded.campus_id,
      name=excluded.name,
      unit_type=excluded.unit_type,
      status='active',
      updated_at=now();

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'SCHOOL_CUSTODIAN','School Custodian','leadership',1,null,
    array[
      'governance_decision','people_staff','academic_execution','learner_progress_intervention',
      'human_potential_development','student_culture_leadership','safeguarding_welfare_emergency',
      'parent_experience_partnership','finance_commercial_control','campus_daily_operations',
      'events_special_programmes','institutional_performance_accountability'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=null,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_vc;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'SCHOOL_GUARDIAN','School Guardian','leadership',2,v_vc,
    array[
      'governance_decision','people_staff','academic_execution','learner_progress_intervention',
      'human_potential_development','student_culture_leadership','safeguarding_welfare_emergency',
      'parent_experience_partnership','finance_commercial_control','campus_daily_operations',
      'events_special_programmes','institutional_performance_accountability'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_sg;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'ACADEMIC_INSPECTOR','Academic Inspector','academic_leadership',3,v_sg,
    array['academic_execution','learner_progress_intervention','institutional_performance_accountability'],
    'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_ai;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'SKILL_INSPECTOR','Skill Inspector','skills_leadership',3,v_sg,
    array['human_potential_development','events_special_programmes','institutional_performance_accountability'],
    'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_si;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'SECTIONAL_PROMOTER','Sectional Promoter','section_leadership',4,v_ai,
    array[
      'academic_execution','learner_progress_intervention','student_culture_leadership',
      'parent_experience_partnership','institutional_performance_accountability'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_sp;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'TEACHER','Teacher','learner_facing',5,v_sp,
    array[
      'academic_execution','learner_progress_intervention','human_potential_development',
      'student_culture_leadership','safeguarding_welfare_emergency','parent_experience_partnership'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_teacher;

  insert into public.khpos_ops_roles(
    organisation_id,code,title,category,role_level,reports_to_role_id,system_scope,status,created_by
  ) values (
    v_org,'SKILLS_FACILITATOR','Skills Facilitator','learner_facing',5,v_si,
    array[
      'human_potential_development','student_culture_leadership',
      'safeguarding_welfare_emergency','events_special_programmes'
    ],'active',v_actor
  )
  on conflict (organisation_id,code) do update
  set title=excluded.title,category=excluded.category,role_level=excluded.role_level,
      reports_to_role_id=excluded.reports_to_role_id,system_scope=excluded.system_scope,status='active',updated_at=now()
  returning id into v_facilitator;

  insert into public.khpos_ops_role_charters(
    role_id,version,mission,owned_outcomes,responsibilities,decision_rights,
    escalation_rules,kpis,required_policy_codes,effective_date,approved_by,approved_at,status
  ) values
  (
    v_vc,1,
    'Protect the school purpose, philosophy and long-term direction while keeping routine school execution out of the School Custodian seat.',
    '["Institutional purpose remains clear","Strategic direction is coherent","Major institutional risks receive appropriate authority","the school can scale without owner-dependent daily operations"]'::jsonb,
    '["Set and guard institutional vision and philosophy","Approve foundational strategic policies and major structural changes","Review strategic risks and campus/network health","Build external relationships and expansion direction"]'::jsonb,
    '["Decide institutional strategy and philosophy","Approve major capital or structural commitments","Approve matters explicitly reserved for School Custodian authority","Delegate routine operational authority to the School Guardian"]'::jsonb,
    '["Receive only strategic, institutional, critical or repeatedly unresolved exceptions","Return routine matters to the delegated operating authority","Require system correction where the same dependency repeatedly reaches this seat"]'::jsonb,
    '["Strategic milestones on track","Critical institutional risks unresolved","Decisions unnecessarily waiting for School Custodian","Owner-dependency defects identified and removed"]'::jsonb,
    array['GOV-P01','GOV-P02','IPA-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_sg,1,
    'Own whole-school execution so the campus consistently delivers the school standards without requiring routine School Custodian intervention.',
    '["School operates safely and predictably","Operating systems execute at required standard","Leaders and staff own their responsibilities","Exceptions are resolved at the lowest appropriate level"]'::jsonb,
    '["Coordinate whole-school execution","Lead operating and performance rhythms","Ensure cross-functional problems receive owners and deadlines","Hold Inspectors and designated operational owners accountable","Escalate only matters beyond delegated authority"]'::jsonb,
    '["Make whole-school operational decisions within delegated authority","Approve routine campus actions and designated requests","Assign owners and require recovery actions","Escalate strategic or reserved decisions"]'::jsonb,
    '["Escalate critical safeguarding/security/financial or institutional risks immediately through the appropriate route","Escalate persistent cross-system failure when delegated authority cannot resolve it","Do not escalate routine work simply because it is difficult"]'::jsonb,
    '["Campus readiness","Critical exceptions unresolved","Overdue leadership actions","Operating-system health","Strategic escalations requiring School Custodian"]'::jsonb,
    array['GOV-P01','PEO-P05','SAF-P01','IPA-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_ai,1,
    'Ensure intended learning is taught, verified and recovered while teachers and sections continuously improve instructional execution.',
    '["Curriculum delivery remains on track","Academic debt is visible and recovered","Teaching quality improves through evidence","Learners at academic risk receive timely support"]'::jsonb,
    '["Own academic planning and teaching-quality execution","Lead Sectional Promoters on academic delivery","Monitor scheme progress, missed lessons and recovery","Coordinate assessment and examination readiness","Drive academic intervention with evidence"]'::jsonb,
    '["Set academic execution standards within approved policy","Require recovery for missed or weak delivery","Approve academic operating adjustments within authority","Escalate whole-school academic risks to School Guardian"]'::jsonb,
    '["Escalate persistent section failure or uncovered learning to School Guardian","Escalate safeguarding or welfare concerns through the safeguarding route","Do not bypass Sectional Promoters for routine teacher execution"]'::jsonb,
    '["Curriculum delivery vs plan","Academic debt","Teaching-quality follow-up","Learner-risk intervention closure","Exam readiness"]'::jsonb,
    array['ACD-P01','ACD-P02','ACD-P03','LPI-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_si,1,
    'Ensure the school skills and Young CEO experiences develop real capability, value creation and evidence of learner growth.',
    '["Skills pathways run consistently","Learners progress through practical competence","Young CEO Hub produces real value-creation practice","Skills facilitators execute safely and effectively"]'::jsonb,
    '["Own skills-programme execution","Lead skills facilitators","Monitor competency progression and pathway delivery","Coordinate Young CEO Hub","Connect skills evidence to Human Potential development"]'::jsonb,
    '["Set skills execution expectations within approved policy","Adjust skills delivery and facilitator deployment within authority","Require recovery where programme delivery fails","Escalate resource or institutional constraints to School Guardian"]'::jsonb,
    '["Escalate safeguarding concerns immediately through the safeguarding route","Escalate persistent facilitator or resource failures to School Guardian","Escalate major programme commitments requiring broader authority"]'::jsonb,
    '["Skills participation","Competency progression","Young CEO execution","Facilitator exceptions","Programme milestones completed"]'::jsonb,
    array['HPD-P01','HPD-P02','HPD-P04','SAF-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_sp,1,
    'Own the health of an assigned school section by connecting teacher execution, learner progress, culture and parent issues before they become whole-school problems.',
    '["Section learning remains on track","Learner risks are detected early","Teacher execution exceptions are resolved","Section culture and parent concerns are handled promptly"]'::jsonb,
    '["Monitor daily and weekly section execution","Support and hold teachers accountable","Coordinate learner interventions","Resolve section-level behaviour and parent issues","Report meaningful section exceptions to Academic Inspector"]'::jsonb,
    '["Make routine section decisions within policy","Assign recovery actions to teachers","Coordinate section interventions and meetings","Escalate matters beyond section authority"]'::jsonb,
    '["Escalate persistent academic failure to Academic Inspector","Escalate safeguarding through the safeguarding route","Escalate whole-school operational issues to the appropriate leader rather than absorbing them"]'::jsonb,
    '["Section curriculum execution","Academic debt","Learner-risk cases","Teacher exceptions","Behaviour/parent issues overdue"]'::jsonb,
    array['ACD-P01','LPI-P01','CUL-P01','PAR-P02'],current_date,v_actor,now(),'active'
  ),
  (
    v_teacher,1,
    'Deliver high-quality learning, notice learner needs early and execute assigned responsibilities with evidence and professional care.',
    '["Planned learning is delivered","Learners receive timely feedback and support","Classroom culture supports responsibility and growth","Required evidence and follow-up are completed"]'::jsonb,
    '["Prepare and execute HQLS learning","Monitor learner understanding and progress","Raise and act on learner-risk signals","Maintain professional classroom culture","Communicate through approved parent and reporting channels"]'::jsonb,
    '["Make day-to-day instructional decisions within curriculum and policy","Take immediate classroom recovery action","Raise issues when barriers exceed teacher authority","Never independently investigate safeguarding concerns"]'::jsonb,
    '["Escalate academic execution barriers to Sectional Promoter","Escalate safeguarding concerns immediately through designated safeguarding process","Escalate repeated learner concerns when classroom intervention is insufficient"]'::jsonb,
    '["Required lessons delivered","Missed learning recovered","Learner-risk actions completed","Teaching-quality development","Assigned responsibilities completed on time"]'::jsonb,
    array['PEO-P02','ACD-P01','LPI-P01','CUL-P01','SAF-P01'],current_date,v_actor,now(),'active'
  ),
  (
    v_facilitator,1,
    'Develop practical learner capability through safe, purposeful skills practice that progresses from exposure to independent application and value creation.',
    '["Skills sessions are consistently delivered","Learner competence progresses","Practice produces verifiable outputs","Learners apply skills responsibly and safely"]'::jsonb,
    '["Prepare and facilitate practical skills sessions","Track competency evidence","Maintain safe use of tools/materials","Support projects and value creation","Report learner or programme concerns to Skill Inspector"]'::jsonb,
    '["Make routine facilitation decisions within approved programme standards","Adapt practice tasks to learner readiness","Stop unsafe activity immediately","Escalate resource/programme constraints"]'::jsonb,
    '["Escalate safeguarding concerns immediately through designated process","Escalate repeated programme/resource failure to Skill Inspector","Escalate safety hazards before continuing practical activity"]'::jsonb,
    '["Skills sessions delivered","Competency progression","Evidence quality","Safety exceptions","Assigned programme actions completed"]'::jsonb,
    array['PEO-P02','HPD-P01','HPD-P02','SAF-P01'],current_date,v_actor,now(),'active'
  )
  on conflict (role_id,version) do update
  set mission=excluded.mission,
      owned_outcomes=excluded.owned_outcomes,
      responsibilities=excluded.responsibilities,
      decision_rights=excluded.decision_rights,
      escalation_rules=excluded.escalation_rules,
      kpis=excluded.kpis,
      required_policy_codes=excluded.required_policy_codes,
      effective_date=excluded.effective_date,
      approved_by=excluded.approved_by,
      approved_at=excluded.approved_at,
      status='active';

  if not exists (
    select 1
    from public.khpos_ops_role_assignments
    where role_id=v_vc and user_id=v_actor and status='active'
  ) then
    insert into public.khpos_ops_role_assignments(
      role_id,user_id,primary_assignment,status,start_date,appointed_by
    ) values (
      v_vc,v_actor,true,'active',current_date,v_actor
    );
  end if;

  if not exists (
    select 1 from public.khpos_ops_audit_events
    where organisation_id=v_org
      and event_type='ops_o1_structure_bootstrapped'
  ) then
    insert into public.khpos_ops_audit_events(
      organisation_id,actor_user_id,event_type,object_type,object_id,metadata
    ) values (
      v_org,v_actor,'ops_o1_structure_bootstrapped','organisation',v_org,
      jsonb_build_object(
        'campus','MAIN',
        'roles',7,
        'units',4,
        'architectureVersion','O1-school-custodian-v1.1'
      )
    );
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_create_academic_observation_server(p_actor_user_id uuid, p_organisation_id uuid, p_stream_id uuid, p_target_id uuid, p_observation_type text, p_observed_at timestamp with time zone, p_strengths text, p_improvement_area text DEFAULT NULL::text, p_required_action text DEFAULT NULL::text, p_action_due_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare
  v_stream public.khpos_ops_academic_delivery_streams%rowtype;
  v_observer_assignment uuid;
  v_teacher_user uuid;
  v_id uuid;
  v_followup text;
begin
  if not khpos_private.ops_academic_can_monitor(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Only academic monitoring authority can record teaching observations.';
  end if;

  select * into v_stream
  from public.khpos_ops_academic_delivery_streams
  where id=p_stream_id and organisation_id=p_organisation_id;

  if v_stream.id is null then raise exception 'Academic delivery stream not found.'; end if;

  select user_id into v_teacher_user
  from public.khpos_ops_role_assignments
  where id=v_stream.teacher_assignment_id;

  if v_teacher_user=p_actor_user_id then
    raise exception 'A teacher cannot record an institutional observation of their own teaching.';
  end if;

  if p_observation_type not in ('micro','development','qa') then
    raise exception 'Observation type must be micro, development or qa.';
  end if;

  if nullif(btrim(coalesce(p_strengths,'')),'') is null then
    raise exception 'Teaching observation requires specific observed strengths/evidence.';
  end if;

  if nullif(btrim(coalesce(p_required_action,'')),'') is not null
     and p_action_due_date is null then
    raise exception 'Required observation action must have a due date.';
  end if;

  if p_target_id is not null
     and not exists(
       select 1 from public.khpos_ops_academic_weekly_targets wt
       where wt.id=p_target_id and wt.stream_id=v_stream.id
     ) then
    raise exception 'Observation target does not belong to this delivery stream.';
  end if;

  select a.id into v_observer_assignment
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.user_id=p_actor_user_id
    and a.status='active'
    and r.organisation_id=p_organisation_id
    and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SECTIONAL_PROMOTER')
  order by r.role_level,a.primary_assignment desc,a.created_at
  limit 1;

  v_followup := case
    when nullif(btrim(coalesce(p_required_action,'')),'') is null
    then 'none' else 'open' end;

  insert into public.khpos_ops_academic_observations(
    organisation_id,stream_id,target_id,observed_teacher_assignment_id,
    observer_assignment_id,observer_user_id,observation_type,observed_at,
    strengths,improvement_area,required_action,action_due_date,
    follow_up_status
  ) values (
    p_organisation_id,v_stream.id,p_target_id,v_stream.teacher_assignment_id,
    v_observer_assignment,p_actor_user_id,p_observation_type,
    coalesce(p_observed_at,now()),left(btrim(p_strengths),6000),
    left(nullif(btrim(coalesce(p_improvement_area,'')),''),6000),
    left(nullif(btrim(coalesce(p_required_action,'')),''),6000),
    p_action_due_date,v_followup
  )
  returning id into v_id;

  insert into public.khpos_ops_academic_events(
    organisation_id,stream_id,target_id,observation_id,
    actor_user_id,event_type,to_state,note
  ) values (
    p_organisation_id,v_stream.id,p_target_id,v_id,p_actor_user_id,
    'teaching_observation_recorded',v_followup,left(btrim(p_strengths),4000)
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_create_accountability_case_server(p_actor_user_id uuid, p_organisation_id uuid, p_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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

    if v_subject_role_code in ('SCHOOL_CUSTODIAN') then
      raise exception 'A School Custodian conduct case requires independent external governance; the subject cannot be managed through the internal reporting line.';
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
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_create_availability_case_server(p_actor_user_id uuid, p_organisation_id uuid, p_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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
    if v_is_self and v_role_code in ('SCHOOL_CUSTODIAN') then
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
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_create_exit_case_server(p_actor_user_id uuid, p_organisation_id uuid, p_staff_id uuid, p_exit_type text, p_proposed_last_day date, p_basis_reference text, p_reason_note text DEFAULT NULL::text, p_authority_review_reference text DEFAULT NULL::text, p_source_accountability_case_id uuid DEFAULT NULL::uuid, p_replacement_required boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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

  if v_role_code in ('SCHOOL_CUSTODIAN') then
    raise exception 'School Custodian exit requires external company governance and cannot be initiated through internal school O11.';
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
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_create_promotion_case_server(p_actor_user_id uuid, p_organisation_id uuid, p_staff_id uuid, p_target_role_id uuid, p_target_campus_id uuid, p_target_unit_id uuid, p_proposed_effective_date date, p_justification text, p_readiness_summary text, p_source_succession_plan_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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

  if v_target_code in ('SCHOOL_GUARDIAN','SCHOOL_CUSTODIAN')
     and not khpos_private.ops_transition_actor_has_role(
       p_actor_user_id,p_organisation_id,'SCHOOL_CUSTODIAN'
     ) then
    raise exception 'Only the School Custodian can open School Guardian or School Custodian progression cases.';
  end if;

  v_external := v_target_code in ('SCHOOL_CUSTODIAN');
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
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_create_staff_server(p_actor_user_id uuid, p_organisation_id uuid, p_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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
    raise exception 'Staff appointment records require an active School Guardian or School Custodian role.';
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
  if v_role_code in ('SCHOOL_CUSTODIAN') then
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
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_create_succession_plan_server(p_actor_user_id uuid, p_organisation_id uuid, p_staff_id uuid, p_target_role_id uuid, p_readiness_state text, p_readiness_summary text, p_development_priorities text DEFAULT NULL::text, p_target_horizon date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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

  if v_target_code in ('SCHOOL_GUARDIAN','SCHOOL_CUSTODIAN')
     and not khpos_private.ops_transition_actor_has_role(
       p_actor_user_id,p_organisation_id,'SCHOOL_CUSTODIAN'
     ) then
    raise exception 'School Guardian or School Custodian succession planning is reserved to the School Custodian.';
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
    p_target_horizon,v_target_code in ('SCHOOL_CUSTODIAN'),
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
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_create_workforce_request_server(p_actor_user_id uuid, p_organisation_id uuid, p_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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
  if v_role_code in ('SCHOOL_CUSTODIAN') then
    raise exception 'School Custodian workforce decisions require external company governance.';
  end if;
  if v_role_code='SCHOOL_GUARDIAN'
     and not khpos_private.ops_recruitment_actor_has_role(
       p_actor_user_id,p_organisation_id,'SCHOOL_CUSTODIAN'
     ) then
    raise exception 'School Guardian workforce planning is reserved to the School Custodian.';
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
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_execute_promotion_server(p_actor_user_id uuid, p_organisation_id uuid, p_promotion_case_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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

  if v_target.id is null or v_target.code in ('SCHOOL_CUSTODIAN') then
    raise exception 'School Custodian appointment requires external governance and cannot execute through internal O11.';
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
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_finalize_staff_exit_server(p_actor_user_id uuid, p_organisation_id uuid, p_exit_case_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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

  if v_role_code in ('SCHOOL_CUSTODIAN') then
    raise exception 'School Custodian exit requires external company governance and cannot execute through internal school O11.';
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
  v_author_is_custodian boolean;
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
      and r.code in ('SCHOOL_CUSTODIAN')
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
          and r.code='SCHOOL_CUSTODIAN'
      ) into v_author_is_custodian;

      if v_policy.priority='C0' then
        if v_author_is_custodian then
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
            raise exception 'A School Custodian-authored critical policy requires independent School Guardian or School Custodian review.';
          end if;
        elsif not v_owner then
          raise exception 'Critical policy approval requires the School Custodian or School Custodian.';
        end if;
      elsif not (v_owner or v_guardian) then
        raise exception 'Policy review requires the School Custodian, School Custodian or School Guardian.';
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
  v_author_is_custodian boolean;
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
      and r.code in ('SCHOOL_CUSTODIAN')
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
          and r.code='SCHOOL_CUSTODIAN'
      ) into v_author_is_custodian;

      if v_process.criticality='P0' then
        if v_author_is_custodian then
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
            raise exception 'A School Custodian-authored critical process requires independent School Guardian or School Custodian review.';
          end if;
        elsif not v_owner then
          raise exception 'Critical process approval requires the School Custodian or School Custodian.';
        end if;
      elsif not (v_owner or v_guardian) then
        raise exception 'Process review requires the School Custodian, School Custodian or School Guardian.';
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

CREATE OR REPLACE FUNCTION public.khpos_ops_issue_staff_access_server(p_actor uuid, p_org uuid, p_staff uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare v_staff public.khpos_ops_staff%rowtype; v_code text; v_token text; v_expiry timestamptz;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_can_manage_people(p_actor,p_org) then raise exception 'Campus leadership membership required.'; end if;
  select * into v_staff from public.khpos_ops_staff where id=p_staff and organisation_id=p_org for update;
  if v_staff.id is null or v_staff.status not in ('onboarding','ready') then raise exception 'An appointed staff member awaiting activation is required.'; end if;
  select code into v_code from public.khpos_ops_roles where id=v_staff.desired_role_id and organisation_id=p_org and status='active';
  if v_code is null or v_code in ('SCHOOL_CUSTODIAN') then raise exception 'This role requires separate governance approval.'; end if;
  if v_code='SCHOOL_GUARDIAN' and v_staff.campus_id is null then raise exception 'Choose the School Guardian campus first.'; end if;
  if not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.code in ('SCHOOL_CUSTODIAN')) then
    if v_code='SCHOOL_GUARDIAN' or v_staff.campus_id is null or not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.code='SCHOOL_GUARDIAN' and (a.campus_id=v_staff.campus_id or a.campus_id is null)) then raise exception 'Only the school owner can appoint a School Guardian; other staff require their campus Guardian.'; end if;
  end if;
  if v_staff.user_id is not null and exists(select 1 from public.organisation_memberships m where m.organisation_id=p_org and m.user_id=v_staff.user_id and m.status='active') then raise exception 'This staff member already has active organisation access.'; end if;
  v_token:=encode(extensions.gen_random_bytes(32),'hex'); v_expiry:=now()+interval '7 days';
  insert into public.khpos_ops_staff_access_invites(staff_id,organisation_id,token_hash,expires_at,issued_by)
  values(p_staff,p_org,extensions.digest(v_token,'sha256'),v_expiry,p_actor)
  on conflict (staff_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,issued_by=excluded.issued_by,issued_at=now(),redeemed_by=null,redeemed_at=null;
  insert into public.khpos_ops_staff_events(organisation_id,staff_id,actor_user_id,event_type,note) values(p_org,p_staff,p_actor,'access_link_issued','A one-use staff access link was issued; no operating role was activated.');
  return jsonb_build_object('token',v_token,'expiresAt',v_expiry);
end $function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_network_pulse_server(p_actor uuid, p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org)
     or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN','SECTIONAL_PROMOTER']::text[])
  then raise exception 'Active leadership role and membership required.'; end if;
  return jsonb_build_object(
    'operatingDate',v_today,
    'campuses',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'name',c.name,
        'guardianAssigned',(select count(*) from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where r.organisation_id=p_org and r.code='SCHOOL_GUARDIAN' and a.status='active' and (a.campus_id=c.id or a.campus_id is null)) > 0,
        'readinessRecorded',(select count(*) from public.khpos_ops_campus_checks x where x.organisation_id=p_org and x.campus_id=c.id and x.operating_date=v_today),
        'readinessExceptions',(select count(*) from public.khpos_ops_campus_checks x where x.organisation_id=p_org and x.campus_id=c.id and x.operating_date=v_today and x.status in ('exception','resolved')),
        'workOverdue',(select count(*) from public.khpos_ops_work_items w where w.organisation_id=p_org and w.campus_id=c.id and w.status not in ('completed','cancelled') and w.due_at < now()),
        'issuesOpen',(select count(*) from public.khpos_ops_issues i where i.organisation_id=p_org and i.campus_id=c.id and i.sensitivity='standard' and i.status not in ('closed','verified')),
        'issuesCritical',(select count(*) from public.khpos_ops_issues i where i.organisation_id=p_org and i.campus_id=c.id and i.sensitivity='standard' and i.severity='P1' and i.status not in ('closed','verified')),
        'parentsOverdue',(select count(*) from public.khpos_ops_parent_cases p where p.organisation_id=p_org and p.campus_id=c.id and p.status<>'closed' and p.due_date<v_today),
        'journeysOverdue',(select count(*) from public.khpos_ops_parent_journeys j where j.organisation_id=p_org and j.campus_id=c.id and j.status='open' and j.due_date<v_today),
        'assetsDue',(select count(*) from public.khpos_ops_assets a where a.organisation_id=p_org and a.campus_id=c.id and a.status='active' and a.next_service_date<=v_today),
        'eventsAwaitingApproval',(select count(*) from public.khpos_ops_events e where e.organisation_id=p_org and e.campus_id=c.id and e.status='submitted')
      ) order by c.name)
      from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active'
        and (khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_CUSTODIAN']::text[])
          or khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,false))
    ),'[]'::jsonb)
  );
end $function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_start_manual_process_server(p_actor_user_id uuid, p_organisation_id uuid, p_process_id uuid, p_campus_id uuid DEFAULT NULL::uuid, p_unit_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile public.khpos_ops_process_execution_profiles%rowtype;
  v_process public.khpos_ops_processes%rowtype;
  v_process_trigger text;
  v_assignment public.khpos_ops_role_assignments%rowtype;
  v_assignment_count integer := 0;
  v_actor_assignment_count integer := 0;
  v_is_leader boolean := false;
  v_checklist_id uuid;
  v_work_id uuid;
  v_due_at timestamptz;
  v_owner_role_title text;
  v_target_campus uuid;
  v_target_unit uuid;
begin
  if not khpos_private.ops_hpd_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active KHP-OS school membership is required.';
  end if;

  select p.* into v_process
  from public.khpos_ops_processes p
  where p.id=p_process_id
    and p.organisation_id=p_organisation_id
    and p.status<>'retired'
    and exists (
      select 1
      from public.khpos_ops_process_versions pv
      where pv.process_id=p.id and pv.status='active'
    );

  if v_process.id is null then
    raise exception 'Controlled process not found or not active.';
  end if;

  select ep.* into v_profile
  from public.khpos_ops_process_execution_profiles ep
  where ep.organisation_id=p_organisation_id
    and ep.process_id=p_process_id
    and ep.status='configured'
    and ep.activation_mode='manual_on_demand';

  if v_profile.id is null then
    raise exception 'This process is not configured for manual/on-demand execution.';
  end if;

  if v_profile.owner_role_id is null or not exists (
    select 1 from public.khpos_ops_roles r
    where r.id=v_profile.owner_role_id
      and r.organisation_id=p_organisation_id and r.status='active'
  ) then
    raise exception 'This manual process has no active accountable role.';
  end if;

  if p_campus_id is not null and not exists (
    select 1
    from public.khpos_ops_campuses c
    where c.id=p_campus_id
      and c.organisation_id=p_organisation_id
      and c.status='active'
  ) then
    raise exception 'The selected campus is not active in this school.';
  end if;

  if p_unit_id is not null and not exists (
    select 1
    from public.khpos_ops_units u
    where u.id=p_unit_id
      and u.organisation_id=p_organisation_id
      and u.status='active'
      and (
        p_campus_id is null
        or u.campus_id is null
        or u.campus_id=p_campus_id
      )
  ) then
    raise exception 'The selected unit is not active in this school or campus.';
  end if;

  v_is_leader := khpos_private.ops_hpd_actor_has_role(
    p_actor_user_id,
    p_organisation_id,
    array[
      'SCHOOL_CUSTODIAN',
      'SCHOOL_GUARDIAN',
      'ACADEMIC_INSPECTOR',
      'SKILL_INSPECTOR'
    ]::text[]
  );

  select count(*)::integer into v_actor_assignment_count
  from public.khpos_ops_role_assignments a
  where a.role_id=v_profile.owner_role_id
    and a.user_id=p_actor_user_id
    and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
    and (
      p_campus_id is null
      or a.campus_id is null
      or a.campus_id=p_campus_id
    )
    and (
      p_unit_id is null
      or a.unit_id is null
      or a.unit_id=p_unit_id
    );

  if v_actor_assignment_count=1 then
    select a.* into v_assignment
    from public.khpos_ops_role_assignments a
    where a.role_id=v_profile.owner_role_id
      and a.user_id=p_actor_user_id
      and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
      and (
        p_campus_id is null
        or a.campus_id is null
        or a.campus_id=p_campus_id
      )
      and (
        p_unit_id is null
        or a.unit_id is null
        or a.unit_id=p_unit_id
      )
    order by
      case
        when p_campus_id is not null and a.campus_id=p_campus_id then 0
        else 1
      end,
      case
        when p_unit_id is not null and a.unit_id=p_unit_id then 0
        else 1
      end,
      a.primary_assignment desc,
      a.created_at
    limit 1;
  elsif v_actor_assignment_count>1 then
    raise exception 'Choose a campus or unit before starting this process because you hold this role in more than one operating scope.';
  elsif not v_is_leader then
    raise exception 'Only the accountable role holder or an authorised school leader can start this process.';
  else
    select count(*)::integer into v_assignment_count
    from public.khpos_ops_role_assignments a
    where a.role_id=v_profile.owner_role_id
      and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
      and (
        p_campus_id is null
        or a.campus_id is null
        or a.campus_id=p_campus_id
      )
      and (
        p_unit_id is null
        or a.unit_id is null
        or a.unit_id=p_unit_id
      );

    if v_assignment_count=0 then
      raise exception 'No active person is assigned to the accountable role for this process.';
    elsif v_assignment_count>1 then
      raise exception 'More than one active person can own this process. Choose the campus or unit that identifies the intended operating owner.';
    end if;

    select a.* into v_assignment
    from public.khpos_ops_role_assignments a
    where a.role_id=v_profile.owner_role_id
      and a.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,p_organisation_id)
      and (
        p_campus_id is null
        or a.campus_id is null
        or a.campus_id=p_campus_id
      )
      and (
        p_unit_id is null
        or a.unit_id is null
        or a.unit_id=p_unit_id
      )
    order by a.primary_assignment desc,a.created_at
    limit 1;
  end if;

  select r.title into v_owner_role_title
  from public.khpos_ops_roles r
  where r.id=v_profile.owner_role_id
    and r.organisation_id=p_organisation_id
    and r.status='active';

  select pv.trigger into v_process_trigger
  from public.khpos_ops_process_versions pv
  where pv.process_id=p_process_id
    and pv.status='active'
  order by pv.version desc
  limit 1;

  select ct.id into v_checklist_id
  from public.khpos_ops_checklist_templates ct
  where ct.organisation_id=p_organisation_id
    and ct.process_id=p_process_id
    and ct.status='active'
  order by ct.version desc,ct.created_at desc
  limit 1;

  v_target_campus := coalesce(p_campus_id,v_assignment.campus_id);
  v_target_unit := coalesce(p_unit_id,v_assignment.unit_id);

  if v_target_campus is not null and not exists (
    select 1 from public.khpos_ops_campuses c
    where c.id=v_target_campus and c.organisation_id=p_organisation_id
      and c.status='active'
  ) then
    raise exception 'The accountable assignment campus is not active in this school.';
  end if;
  if v_target_unit is not null and not exists (
    select 1 from public.khpos_ops_units u
    where u.id=v_target_unit and u.organisation_id=p_organisation_id
      and u.status='active'
      and (u.campus_id is null or u.campus_id=v_target_campus)
  ) then
    raise exception 'The accountable assignment unit does not match the target campus.';
  end if;

  if v_profile.due_offset_minutes is not null then
    v_due_at := now() + make_interval(mins => v_profile.due_offset_minutes);
  end if;

  insert into public.khpos_ops_work_items(
    organisation_id,
    campus_id,
    unit_id,
    process_id,
    owner_assignment_id,
    checklist_template_id,
    occurrence_key,
    title,
    description,
    status,
    priority,
    due_at,
    evidence_required,
    verification_required,
    created_by
  ) values (
    p_organisation_id,
    v_target_campus,
    v_target_unit,
    p_process_id,
    v_assignment.id,
    v_checklist_id,
    'manual:'||gen_random_uuid()::text,
    v_process.title,
    coalesce(
      nullif(btrim(v_profile.trigger_summary),''),
      nullif(btrim(v_process_trigger),''),
      v_process.title
    ),
    'pending',
    case v_process.criticality
      when 'P0' then 'critical'
      when 'P1' then 'high'
      else 'standard'
    end,
    v_due_at,
    v_profile.evidence_required,
    v_profile.verification_required,
    p_actor_user_id
  )
  returning id into v_work_id;

  insert into public.khpos_ops_audit_events(
    organisation_id,
    actor_user_id,
    event_type,
    object_type,
    object_id,
    metadata
  ) values (
    p_organisation_id,
    p_actor_user_id,
    'ops_manual_process_started',
    'work_item',
    v_work_id,
    jsonb_build_object(
      'processId',p_process_id,
      'processCode',v_process.code,
      'executionProfileId',v_profile.id,
      'ownerRoleId',v_profile.owner_role_id,
      'ownerAssignmentId',v_assignment.id,
      'campusId',v_target_campus,
      'unitId',v_target_unit,
      'dueAt',v_due_at
    )
  );

  return jsonb_build_object(
    'workId',v_work_id,
    'processId',p_process_id,
    'processCode',v_process.code,
    'processTitle',v_process.title,
    'ownerRoleId',v_profile.owner_role_id,
    'ownerRoleTitle',v_owner_role_title,
    'ownerIsActor',v_assignment.user_id=p_actor_user_id,
    'campusId',v_target_campus,
    'unitId',v_target_unit,
    'dueAt',v_due_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_succession_plan_action_server(p_actor_user_id uuid, p_organisation_id uuid, p_plan_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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
      and r.code in ('SCHOOL_GUARDIAN','SCHOOL_CUSTODIAN')
  ) and not khpos_private.ops_transition_actor_has_role(
    p_actor_user_id,p_organisation_id,'SCHOOL_CUSTODIAN'
  ) then
    raise exception 'School Guardian or School Custodian succession status is reserved to the School Custodian.';
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

CREATE OR REPLACE FUNCTION public.khpos_ops_update_succession_plan_server(p_actor_user_id uuid, p_organisation_id uuid, p_plan_id uuid, p_readiness_state text, p_readiness_summary text, p_development_priorities text DEFAULT NULL::text, p_target_horizon date DEFAULT NULL::date, p_review_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
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
      and r.code in ('SCHOOL_GUARDIAN','SCHOOL_CUSTODIAN')
  ) and not khpos_private.ops_transition_actor_has_role(
    p_actor_user_id,p_organisation_id,'SCHOOL_CUSTODIAN'
  ) then
    raise exception 'School Guardian or School Custodian succession review is reserved to the School Custodian.';
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
$function$;

CREATE OR REPLACE FUNCTION public.khpos_ops_verify_work_server(p_actor_user_id uuid, p_organisation_id uuid, p_work_item_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'khpos_private', 'pg_temp'
AS $function$
declare
  v_work public.khpos_ops_work_items%rowtype;
  v_owner_user_id uuid;
  v_owner_reports_to_role_id uuid;
  v_allowed boolean := false;
begin
  if p_action not in ('verify','return') then
    raise exception 'Unsupported verification action.';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select w.* into v_work
  from public.khpos_ops_work_items w
  where w.id=p_work_item_id
    and w.organisation_id=p_organisation_id
    and w.status='awaiting_verification';

  if v_work.id is null then
    raise exception 'Work awaiting verification was not found.';
  end if;

  select a.user_id,r.reports_to_role_id
  into v_owner_user_id,v_owner_reports_to_role_id
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where a.id=v_work.owner_assignment_id;

  if v_owner_user_id=p_actor_user_id then
    raise exception 'The work owner cannot verify their own submission.';
  end if;

  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
      and (
        r.id=v_owner_reports_to_role_id
        or r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN')
      )
      and (a.campus_id is null or v_work.campus_id is null or a.campus_id=v_work.campus_id)
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Your operating role is not authorised to verify this work.';
  end if;

  if p_action='return' then
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'Explain what must be corrected before returning the work.';
    end if;

    update public.khpos_ops_work_records
      set status='returned',
          review_note=btrim(p_note),
          reviewed_by=p_actor_user_id,
          reviewed_at=now(),
          updated_at=now()
    where work_item_id=v_work.id and status='submitted';

    update public.khpos_ops_work_items
      set status='in_progress',
          submitted_for_verification_at=null,
          verified_by=null,
          verified_at=null,
          completed_at=null,
          updated_at=now()
    where id=v_work.id;
  else
    update public.khpos_ops_work_records
      set status='verified',
          review_note=nullif(btrim(coalesce(p_note,'')),''),
          reviewed_by=p_actor_user_id,
          reviewed_at=now(),
          updated_at=now()
    where work_item_id=v_work.id and status='submitted';

    update public.khpos_ops_evidence
      set verification_status='verified',
          verified_by=p_actor_user_id,
          verified_at=now()
    where work_item_id=v_work.id
      and verification_status='unverified';

    update public.khpos_ops_work_items
      set status='completed',
          verified_by=p_actor_user_id,
          verified_at=now(),
          completed_at=now(),
          updated_at=now()
    where id=v_work.id;
  end if;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_work_'||p_action,'work_item',v_work.id,
    jsonb_build_object('note',nullif(btrim(coalesce(p_note,'')),''))
  );
end;
$function$;

-- CREATE OR REPLACE preserves existing function ownership and execute ACLs.
-- No privilege grants, membership changes or safeguarding designation changes.
notify pgrst, 'reload schema';

-- Pure validators use only built-ins. Pin their resolution without changing
-- caller permissions or the validation rules identified by the security advisor.
alter function khpos_private.ops_capability_valid_dimension(text,text) set search_path='';
alter function khpos_private.ops_skill_level_rank(text) set search_path='';
alter function khpos_private.ops_project_schedule_valid(jsonb,date,date) set search_path='';
