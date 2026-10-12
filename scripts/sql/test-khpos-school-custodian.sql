-- Run AFTER the migration inside an outer BEGIN ... ROLLBACK transaction.
-- Synthetic records only. Requires an independent Guardian in one school and a second school for boundary denial.
do $test$
declare
  school record;
  org uuid; custodian uuid; guardian uuid; other_school_actor uuid;
  policy uuid; policy_version uuid; process uuid; process_version uuid;
  input jsonb; denied boolean; school_count integer := 0;
  suffix text := gen_random_uuid()::text;
begin
  if not khpos_private.ops_capability_valid_dimension('leadership','initiative')
    or khpos_private.ops_capability_valid_dimension('leadership','budgeting')
    or khpos_private.ops_skill_level_rank('independent')<>3
    or khpos_private.ops_project_schedule_valid('{}'::jsonb,current_date,current_date+10) then
    raise exception 'Search path hardening changed pure validator results';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','khpos_private') and p.prokind='f'
      and pg_get_functiondef(p.oid) like '%VISION_CUSTODIAN%'
      and p.proname<>'ops_standard_target_role'
  ) then raise exception 'A school operating function still requires company role identity'; end if;
  if exists(select 1 from public.khpos_ops_roles where code='VISION_CUSTODIAN') then
    raise exception 'A company role remains inside a school';
  end if;

  if exists (
    (select id,role_id,user_id,status from public.khpos_ops_role_assignments
     except select id,role_id,user_id,status from custodian_assignments_before)
    union all
    (select id,role_id,user_id,status from custodian_assignments_before
     except select id,role_id,user_id,status from public.khpos_ops_role_assignments)
  ) then raise exception 'Role migration changed school appointments'; end if;

  if exists (
    select 1 from custodian_roles_before b
    left join public.khpos_ops_roles r on r.id=b.id
    where r.id is null or r.reports_to_role_id is distinct from b.reports_to_role_id
      or r.code is distinct from case when b.code='VISION_CUSTODIAN' then 'SCHOOL_CUSTODIAN' else b.code end
  ) then raise exception 'Role identities or reporting references changed'; end if;

  if exists (
    select 1 from custodian_function_access_before b join pg_proc p on p.oid=b.oid
    where p.proowner is distinct from b.proowner or p.proacl is distinct from b.proacl
      or p.prosecdef is distinct from b.prosecdef or p.proconfig is distinct from b.proconfig
  ) then raise exception 'Function ownership, security or execute permissions changed'; end if;

  if exists (
    select 1 from custodian_charters_before b
    left join public.khpos_ops_role_charters c on c.id=b.id
    where c.id is null or c.mission is distinct from b.mission
      or c.decision_rights is distinct from b.decision_rights
  ) then raise exception 'Historic charter content was rewritten or removed'; end if;

  for school in
    select r.organisation_id,a.user_id,r.id
    from public.khpos_ops_roles r
    join public.khpos_ops_role_assignments a on a.role_id=r.id and a.status='active'
    where r.code='SCHOOL_CUSTODIAN' and r.status='active'
      and khpos_private.ops_hpd_has_membership(a.user_id,r.organisation_id)
  loop
    org:=school.organisation_id; custodian:=school.user_id;
    select a.user_id into guardian from public.khpos_ops_roles r
      join public.khpos_ops_role_assignments a on a.role_id=r.id and a.status='active'
      where r.organisation_id=org and r.code='SCHOOL_GUARDIAN' and r.status='active'
        and a.user_id<>custodian and khpos_private.ops_hpd_has_membership(a.user_id,org)
      limit 1;
    if guardian is null then
      raise notice 'School has no independent Guardian: real activation remains blocked';
      continue;
    end if;
    school_count:=school_count+1;

    if not khpos_private.ops_academic_actor_has_role(custodian,org,array['SCHOOL_GUARDIAN']) then
      raise exception 'Custodian lost authorised school management oversight';
    end if;
    if khpos_private.ops_academic_actor_has_role(guardian,org,array['SCHOOL_CUSTODIAN']) then
      raise exception 'Guardian was promoted to reserved Custodian authority';
    end if;
    if khpos_private.ops_standard_target_role(org,'VISION_CUSTODIAN') is distinct from school.id
      or khpos_private.ops_standard_target_role(org,'SCHOOL_CUSTODIAN') is distinct from school.id then
      raise exception 'Versioned standard compatibility lost the school owner';
    end if;

    select a.user_id into other_school_actor from public.khpos_ops_roles r
      join public.khpos_ops_role_assignments a on a.role_id=r.id and a.status='active'
      where r.organisation_id<>org and r.code='SCHOOL_CUSTODIAN' and r.status='active'
        and khpos_private.ops_hpd_has_membership(a.user_id,r.organisation_id)
        and not exists(select 1 from public.organisation_memberships m
          where m.organisation_id=org and m.user_id=a.user_id and m.status='active')
      limit 1;
    if other_school_actor is null then raise exception 'Other-school denial fixture missing'; end if;
    if khpos_private.ops_academic_actor_has_role(other_school_actor,org,array['SCHOOL_GUARDIAN','SCHOOL_CUSTODIAN']) then
      raise exception 'Custodian authority crossed a school boundary';
    end if;

    insert into public.khpos_ops_policies(organisation_id,code,name,operating_system,owner_label,priority)
      values(org,'TST-'||suffix,'Rollback policy','governance','School Custodian','C0') returning id into policy;
    input:=jsonb_build_object('purpose','Verify independent school governance in rollback only',
      'scope','Synthetic rollback fixture only','principles',jsonb_build_array('Keep independent review'),
      'policyStatements',jsonb_build_array('Use the authorised reviewer'),
      'rolesResponsibilities',jsonb_build_array('School Custodian and Guardian'),
      'rules',jsonb_build_array('The author cannot self approve'),
      'exceptions',jsonb_build_array('Return incomplete draft'),
      'escalation',jsonb_build_array('Escalate to school authority'),
      'recordsEvidence',jsonb_build_array('Retain independent review evidence'),
      'effectiveDate',current_date,'reviewDate',current_date+365);
    policy_version:=public.khpos_ops_govern_policy_server(custodian,org,policy,'save',input);
    perform public.khpos_ops_govern_policy_server(custodian,org,policy,'submit',jsonb_build_object('versionId',policy_version));
    denied:=false;
    begin
      perform public.khpos_ops_govern_policy_server(custodian,org,policy,'approve',jsonb_build_object('versionId',policy_version));
    exception when others then
      if sqlerrm='The author cannot review their own policy.' then denied:=true; else raise; end if;
    end;
    if not denied then raise exception 'Policy self-approval succeeded'; end if;
    denied:=false;
    begin
      perform public.khpos_ops_govern_policy_server(other_school_actor,org,policy,'approve',jsonb_build_object('versionId',policy_version));
    exception when others then
      if sqlerrm='Active school membership and partnership are required.' then denied:=true; else raise; end if;
    end;
    if not denied then raise exception 'Other school approved this policy'; end if;
    perform public.khpos_ops_govern_policy_server(guardian,org,policy,'return',jsonb_build_object('versionId',policy_version,'note','Clarify the synthetic fixture before approval'));
    if not exists(select 1 from public.khpos_ops_policy_versions where id=policy_version and status='draft') then
      raise exception 'Guardian return did not recover the Custodian draft';
    end if;
    perform public.khpos_ops_govern_policy_server(custodian,org,policy,'save',input||jsonb_build_object('versionId',policy_version));
    perform public.khpos_ops_govern_policy_server(custodian,org,policy,'submit',jsonb_build_object('versionId',policy_version));
    perform public.khpos_ops_govern_policy_server(guardian,org,policy,'approve',jsonb_build_object('versionId',policy_version));
    if not exists(select 1 from public.khpos_ops_policy_versions where id=policy_version and status='active' and approved_by=guardian) then
      raise exception 'Guardian did not independently approve Custodian policy';
    end if;
    policy_version:=public.khpos_ops_govern_policy_server(guardian,org,policy,'save',input);
    perform public.khpos_ops_govern_policy_server(guardian,org,policy,'submit',jsonb_build_object('versionId',policy_version));
    perform public.khpos_ops_govern_policy_server(custodian,org,policy,'approve',jsonb_build_object('versionId',policy_version));
    if not exists(select 1 from public.khpos_ops_policy_versions where id=policy_version and status='active' and approved_by=custodian) then
      raise exception 'Custodian did not approve Guardian critical policy';
    end if;

    insert into public.khpos_ops_processes(organisation_id,code,title,operating_system,owner_label,criticality,governing_policy_codes)
      select org,'TST-'||suffix,'Rollback process','governance','School Custodian','P0',array[p.code]
      from public.khpos_ops_policies p where p.id=policy returning id into process;
    input:=jsonb_build_object('purpose','Verify independent operating process governance only',
      'trigger','Synthetic rollback event occurs','expectedOutcome','Independently verified synthetic process',
      'inputs',jsonb_build_array('Approved synthetic policy'),
      'steps',jsonb_build_array('Record synthetic completion evidence'),
      'evidence',jsonb_build_array('Synthetic completion evidence'),
      'exceptionConditions',jsonb_build_array('Missing synthetic input'),
      'escalation',jsonb_build_array('School Guardian reviews exception'),
      'kpis',jsonb_build_array('Synthetic completion verified'),
      'effectiveDate',current_date);
    process_version:=public.khpos_ops_govern_process_server(custodian,org,process,'save',input);
    perform public.khpos_ops_govern_process_server(custodian,org,process,'submit',jsonb_build_object('versionId',process_version));
    denied:=false;
    begin
      perform public.khpos_ops_govern_process_server(custodian,org,process,'approve',jsonb_build_object('versionId',process_version));
    exception when others then
      if sqlerrm='The author cannot review their own process.' then denied:=true; else raise; end if;
    end;
    if not denied then raise exception 'Process self-approval succeeded'; end if;
    denied:=false;
    begin
      perform public.khpos_ops_govern_process_server(other_school_actor,org,process,'approve',jsonb_build_object('versionId',process_version));
    exception when others then
      if sqlerrm='Active school membership and partnership are required.' then denied:=true; else raise; end if;
    end;
    if not denied then raise exception 'Other school approved this process'; end if;
    perform public.khpos_ops_govern_process_server(guardian,org,process,'approve',jsonb_build_object('versionId',process_version));
    if not exists(select 1 from public.khpos_ops_process_versions where id=process_version and status='active' and approved_by=guardian) then
      raise exception 'Guardian did not independently approve Custodian process';
    end if;
    process_version:=public.khpos_ops_govern_process_server(guardian,org,process,'save',input);
    perform public.khpos_ops_govern_process_server(guardian,org,process,'submit',jsonb_build_object('versionId',process_version));
    perform public.khpos_ops_govern_process_server(custodian,org,process,'approve',jsonb_build_object('versionId',process_version));
    if not exists(select 1 from public.khpos_ops_process_versions where id=process_version and status='active' and approved_by=custodian) then
      raise exception 'Custodian did not approve Guardian critical process';
    end if;
  end loop;
  if school_count<1 then raise exception 'A school with an independent Guardian is required for the workflow test'; end if;
end;
$test$;
