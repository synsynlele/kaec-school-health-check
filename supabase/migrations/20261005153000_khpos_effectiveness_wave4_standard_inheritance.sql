
create table if not exists public.khpos_standard_releases (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  version integer not null unique check (version > 0),
  name text not null,
  description text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  snapshot_sha256 text not null,
  source_organisation_id uuid references public.organisations(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','active','superseded','archived')),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_khpos_standard_release_active
  on public.khpos_standard_releases((status))
  where status='active';
create index if not exists idx_khpos_standard_releases_source
  on public.khpos_standard_releases(source_organisation_id)
  where source_organisation_id is not null;

create table if not exists public.khpos_standard_installations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  release_id uuid not null references public.khpos_standard_releases(id) on delete restrict,
  status text not null default 'pending_adoption'
    check (status in ('pending_adoption','active','superseded')),
  installed_by uuid references auth.users(id) on delete set null,
  installed_at timestamptz not null default now(),
  adopted_by uuid references auth.users(id) on delete set null,
  adopted_at timestamptz,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, release_id)
);

create unique index if not exists uq_khpos_standard_installation_active
  on public.khpos_standard_installations(organisation_id)
  where status='active';
create index if not exists idx_khpos_standard_installations_release
  on public.khpos_standard_installations(release_id,status);

alter table public.khpos_ops_policy_versions
  add column if not exists standard_release_id uuid references public.khpos_standard_releases(id) on delete set null;
alter table public.khpos_ops_process_versions
  add column if not exists standard_release_id uuid references public.khpos_standard_releases(id) on delete set null;

create index if not exists idx_khpos_ops_policy_versions_standard_release
  on public.khpos_ops_policy_versions(standard_release_id)
  where standard_release_id is not null;
create index if not exists idx_khpos_ops_process_versions_standard_release
  on public.khpos_ops_process_versions(standard_release_id)
  where standard_release_id is not null;

alter table public.khpos_standard_releases enable row level security;
alter table public.khpos_standard_installations enable row level security;

revoke all privileges on table public.khpos_standard_releases
  from public,anon,authenticated;
revoke all privileges on table public.khpos_standard_installations
  from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_standard_releases
  to service_role;
grant select,insert,update,delete on table public.khpos_standard_installations
  to service_role;

create or replace function khpos_private.ops_build_standard_snapshot(
  p_source_org uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth,khpos_private,pg_temp
as $func$
declare
  v_policies jsonb := '[]'::jsonb;
  v_processes jsonb := '[]'::jsonb;
  v_tools jsonb := '[]'::jsonb;
  v_execution jsonb := '[]'::jsonb;
  v_checklists jsonb := '[]'::jsonb;
  v_tool_requirements jsonb := '[]'::jsonb;
  v_recurring jsonb := '[]'::jsonb;
begin
  if not exists (
    select 1 from public.organisations
    where id=p_source_org
      and status='active'
      and partner_status='active'
      and 'khpos_core'=any(coalesce(partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'A live KHP-OS reference institution is required.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'code',p.code,
      'name',p.name,
      'operatingSystem',p.operating_system,
      'ownerLabel',p.owner_label,
      'priority',p.priority,
      'version',jsonb_build_object(
        'purpose',pv.purpose,
        'scope',pv.scope,
        'principles',pv.principles,
        'policyStatements',pv.policy_statements,
        'rolesResponsibilities',pv.roles_responsibilities,
        'rules',pv.rules,
        'exceptions',pv.exceptions,
        'escalation',pv.escalation,
        'recordsEvidence',pv.records_evidence,
        'reviewDate',pv.review_date
      ),
      'roles',coalesce((
        select jsonb_agg(jsonb_build_object(
          'roleCode',r.code,
          'requirementType',pr.requirement_type
        ) order by r.role_level,r.code)
        from public.khpos_ops_policy_roles pr
        join public.khpos_ops_roles r on r.id=pr.role_id
        where pr.policy_id=p.id
      ),'[]'::jsonb)
    ) order by p.code
  ),'[]'::jsonb)
  into v_policies
  from public.khpos_ops_policies p
  join lateral (
    select x.*
    from public.khpos_ops_policy_versions x
    where x.policy_id=p.id and x.status='active'
    order by x.version desc
    limit 1
  ) pv on true
  where p.organisation_id=p_source_org
    and p.status<>'retired';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'code',p.code,
      'title',p.title,
      'operatingSystem',p.operating_system,
      'ownerLabel',p.owner_label,
      'criticality',p.criticality,
      'governingPolicyCodes',to_jsonb(p.governing_policy_codes),
      'technology',to_jsonb(p.technology),
      'version',jsonb_build_object(
        'purpose',pv.purpose,
        'trigger',pv.trigger,
        'inputs',pv.inputs,
        'steps',pv.steps,
        'sla',pv.sla,
        'evidence',pv.evidence,
        'expectedOutcome',pv.expected_outcome,
        'exceptionConditions',pv.exception_conditions,
        'escalation',pv.escalation,
        'kpis',pv.kpis
      ),
      'roles',coalesce((
        select jsonb_agg(jsonb_build_object(
          'roleCode',r.code,
          'participation',pr.participation
        ) order by r.role_level,r.code,pr.participation)
        from public.khpos_ops_process_roles pr
        join public.khpos_ops_roles r on r.id=pr.role_id
        where pr.process_id=p.id
      ),'[]'::jsonb)
    ) order by p.code
  ),'[]'::jsonb)
  into v_processes
  from public.khpos_ops_processes p
  join lateral (
    select x.*
    from public.khpos_ops_process_versions x
    where x.process_id=p.id and x.status='active'
    order by x.version desc
    limit 1
  ) pv on true
  where p.organisation_id=p_source_org
    and p.status<>'retired';

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',t.code,
    'name',t.name,
    'toolType',t.tool_type,
    'purpose',t.purpose,
    'schemaDefinition',t.schema_definition
  ) order by t.code),'[]'::jsonb)
  into v_tools
  from public.khpos_ops_tool_templates t
  where t.organisation_id=p_source_org
    and t.status='active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'processCode',p.code,
    'activationMode',e.activation_mode,
    'ownerRoleCode',r.code,
    'eventType',e.event_type,
    'conditionKey',e.condition_key,
    'triggerSummary',e.trigger_summary,
    'dueOffsetMinutes',e.due_offset_minutes,
    'evidenceRequired',e.evidence_required,
    'verificationRequired',e.verification_required,
    'escalationMinutes',e.escalation_minutes,
    'kpiCodes',to_jsonb(e.kpi_codes),
    'status',e.status
  ) order by p.code),'[]'::jsonb)
  into v_execution
  from public.khpos_ops_process_execution_profiles e
  join public.khpos_ops_processes p on p.id=e.process_id
  left join public.khpos_ops_roles r on r.id=e.owner_role_id
  where e.organisation_id=p_source_org;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',c.code,
    'name',c.name,
    'version',c.version,
    'processCode',p.code,
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'position',i.position,
        'label',i.label,
        'guidance',i.guidance,
        'responseType',i.response_type,
        'required',i.required,
        'options',i.options,
        'exceptionOnResponse',i.exception_on_response
      ) order by i.position)
      from public.khpos_ops_checklist_template_items i
      where i.template_id=c.id
    ),'[]'::jsonb)
  ) order by c.code,c.version),'[]'::jsonb)
  into v_checklists
  from public.khpos_ops_checklist_templates c
  left join public.khpos_ops_processes p on p.id=c.process_id
  where c.organisation_id=p_source_org
    and c.status='active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'processCode',p.code,
    'toolCode',t.code,
    'label',r.label,
    'required',r.required,
    'minimumEntries',r.minimum_entries,
    'verificationRequired',r.verification_required
  ) order by p.code,t.code,r.label),'[]'::jsonb)
  into v_tool_requirements
  from public.khpos_ops_process_tool_requirements r
  join public.khpos_ops_processes p on p.id=r.process_id
  join public.khpos_ops_tool_templates t on t.id=r.tool_template_id
  where r.organisation_id=p_source_org
    and r.status='active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',rr.code,
    'title',rr.title,
    'description',rr.description,
    'processCode',p.code,
    'ownerRoleCode',r.code,
    'campusCode',c.code,
    'unitCode',u.code,
    'checklistCode',ct.code,
    'cadence',rr.cadence,
    'weekdays',to_jsonb(rr.weekdays),
    'weekday',rr.weekday,
    'dayOfMonth',rr.day_of_month,
    'dueTime',rr.due_time::text,
    'timezone',rr.timezone,
    'evidenceRequired',rr.evidence_required,
    'verificationRequired',rr.verification_required,
    'priority',rr.priority
  ) order by rr.code),'[]'::jsonb)
  into v_recurring
  from public.khpos_ops_recurring_rules rr
  join public.khpos_ops_processes p on p.id=rr.process_id
  join public.khpos_ops_roles r on r.id=rr.owner_role_id
  left join public.khpos_ops_campuses c on c.id=rr.campus_id
  left join public.khpos_ops_units u on u.id=rr.unit_id
  left join public.khpos_ops_checklist_templates ct on ct.id=rr.checklist_template_id
  where rr.organisation_id=p_source_org
    and rr.status='active';

  return jsonb_build_object(
    'schemaVersion','KAEC-STANDARD-SNAPSHOT-v1',
    'capturedAt',now(),
    'policies',v_policies,
    'processes',v_processes,
    'tools',v_tools,
    'executionProfiles',v_execution,
    'checklists',v_checklists,
    'toolRequirements',v_tool_requirements,
    'recurringRules',v_recurring,
    'summary',jsonb_build_object(
      'policies',jsonb_array_length(v_policies),
      'processes',jsonb_array_length(v_processes),
      'tools',jsonb_array_length(v_tools),
      'executionProfiles',jsonb_array_length(v_execution),
      'checklists',jsonb_array_length(v_checklists),
      'toolRequirements',jsonb_array_length(v_tool_requirements),
      'recurringRules',jsonb_array_length(v_recurring)
    )
  );
end;
$func$;

revoke all on function khpos_private.ops_build_standard_snapshot(uuid)
  from public,anon,authenticated;

create or replace function public.khpos_ops_install_standard_release_server(
  p_organisation_id uuid,
  p_actor_user_id uuid,
  p_release_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public,auth,khpos_private,pg_temp
as $func$
declare
  v_release public.khpos_standard_releases%rowtype;
  v_installation_id uuid;
  v_item jsonb;
  v_role jsonb;
  v_policy_id uuid;
  v_process_id uuid;
  v_role_id uuid;
  v_version integer;
begin
  if not exists (
    select 1
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and m.role='executive'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'An active approved school executive is required to install the KAEC Standard.';
  end if;

  if p_release_id is null then
    select * into v_release
    from public.khpos_standard_releases
    where status='active'
    order by version desc
    limit 1;
  else
    select * into v_release
    from public.khpos_standard_releases
    where id=p_release_id
      and status in ('active','superseded');
  end if;

  if v_release.id is null then
    raise exception 'No installable KAEC Standard release is available.';
  end if;

  select id into v_installation_id
  from public.khpos_standard_installations
  where organisation_id=p_organisation_id
    and release_id=v_release.id;

  if v_installation_id is not null then
    return v_installation_id;
  end if;

  perform public.khpos_ops_bootstrap_partner_server(p_organisation_id);
  perform public.khpos_ops_seed_partner_onboarding_server(
    p_organisation_id,p_actor_user_id
  );

  for v_item in
    select value from jsonb_array_elements(v_release.snapshot->'tools')
  loop
    insert into public.khpos_ops_tool_templates(
      organisation_id,code,name,tool_type,purpose,schema_definition,status,created_by
    ) values (
      p_organisation_id,
      v_item->>'code',
      v_item->>'name',
      v_item->>'toolType',
      v_item->>'purpose',
      coalesce(v_item->'schemaDefinition','{}'::jsonb),
      'active',
      p_actor_user_id
    )
    on conflict (organisation_id,code) do nothing;
  end loop;

  for v_item in
    select value from jsonb_array_elements(v_release.snapshot->'policies')
  loop
    insert into public.khpos_ops_policies(
      organisation_id,code,name,operating_system,owner_label,priority,status,created_by
    ) values (
      p_organisation_id,
      v_item->>'code',
      v_item->>'name',
      v_item->>'operatingSystem',
      v_item->>'ownerLabel',
      v_item->>'priority',
      'registered',
      p_actor_user_id
    )
    on conflict (organisation_id,code) do nothing;

    select id into v_policy_id
    from public.khpos_ops_policies
    where organisation_id=p_organisation_id
      and code=v_item->>'code';

    if not exists (
      select 1 from public.khpos_ops_policy_versions
      where policy_id=v_policy_id
        and status in ('draft','in_review','active')
    ) then
      select coalesce(max(version),0)+1 into v_version
      from public.khpos_ops_policy_versions
      where policy_id=v_policy_id;

      insert into public.khpos_ops_policy_versions(
        policy_id,version,purpose,scope,principles,policy_statements,
        roles_responsibilities,rules,exceptions,escalation,records_evidence,
        review_date,status,author_id,draft_source,draft_model,standard_release_id
      ) values (
        v_policy_id,
        v_version,
        v_item->'version'->>'purpose',
        v_item->'version'->>'scope',
        coalesce(v_item->'version'->'principles','[]'::jsonb),
        coalesce(v_item->'version'->'policyStatements','[]'::jsonb),
        coalesce(v_item->'version'->'rolesResponsibilities','[]'::jsonb),
        coalesce(v_item->'version'->'rules','[]'::jsonb),
        coalesce(v_item->'version'->'exceptions','[]'::jsonb),
        coalesce(v_item->'version'->'escalation','[]'::jsonb),
        coalesce(v_item->'version'->'recordsEvidence','[]'::jsonb),
        case
          when nullif(v_item->'version'->>'reviewDate','') is null then null
          else (v_item->'version'->>'reviewDate')::date
        end,
        'draft',
        p_actor_user_id,
        'kaec_baseline',
        v_release.code,
        v_release.id
      );
    end if;

    for v_role in
      select value from jsonb_array_elements(coalesce(v_item->'roles','[]'::jsonb))
    loop
      select id into v_role_id
      from public.khpos_ops_roles
      where organisation_id=p_organisation_id
        and code=v_role->>'roleCode'
        and status='active';

      if v_role_id is not null then
        insert into public.khpos_ops_policy_roles(
          policy_id,role_id,requirement_type
        ) values (
          v_policy_id,v_role_id,v_role->>'requirementType'
        )
        on conflict (policy_id,role_id) do nothing;
      end if;
    end loop;
  end loop;

  for v_item in
    select value from jsonb_array_elements(v_release.snapshot->'processes')
  loop
    insert into public.khpos_ops_processes(
      organisation_id,code,title,operating_system,owner_label,criticality,
      governing_policy_codes,technology,status,created_by
    ) values (
      p_organisation_id,
      v_item->>'code',
      v_item->>'title',
      v_item->>'operatingSystem',
      v_item->>'ownerLabel',
      v_item->>'criticality',
      coalesce(array(select jsonb_array_elements_text(v_item->'governingPolicyCodes')),'{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(v_item->'technology')),'{}'::text[]),
      'registered',
      p_actor_user_id
    )
    on conflict (organisation_id,code) do nothing;

    select id into v_process_id
    from public.khpos_ops_processes
    where organisation_id=p_organisation_id
      and code=v_item->>'code';

    if not exists (
      select 1 from public.khpos_ops_process_versions
      where process_id=v_process_id
        and status in ('draft','in_review','active')
    ) then
      select coalesce(max(version),0)+1 into v_version
      from public.khpos_ops_process_versions
      where process_id=v_process_id;

      insert into public.khpos_ops_process_versions(
        process_id,version,purpose,trigger,inputs,steps,sla,evidence,
        expected_outcome,exception_conditions,escalation,kpis,status,
        author_id,draft_source,draft_model,standard_release_id
      ) values (
        v_process_id,
        v_version,
        v_item->'version'->>'purpose',
        v_item->'version'->>'trigger',
        coalesce(v_item->'version'->'inputs','[]'::jsonb),
        coalesce(v_item->'version'->'steps','[]'::jsonb),
        nullif(v_item->'version'->>'sla',''),
        coalesce(v_item->'version'->'evidence','[]'::jsonb),
        v_item->'version'->>'expectedOutcome',
        coalesce(v_item->'version'->'exceptionConditions','[]'::jsonb),
        coalesce(v_item->'version'->'escalation','[]'::jsonb),
        coalesce(v_item->'version'->'kpis','[]'::jsonb),
        'draft',
        p_actor_user_id,
        'kaec_baseline',
        v_release.code,
        v_release.id
      );
    end if;

    for v_role in
      select value from jsonb_array_elements(coalesce(v_item->'roles','[]'::jsonb))
    loop
      select id into v_role_id
      from public.khpos_ops_roles
      where organisation_id=p_organisation_id
        and code=v_role->>'roleCode'
        and status='active';

      if v_role_id is not null then
        insert into public.khpos_ops_process_roles(
          process_id,role_id,participation
        ) values (
          v_process_id,v_role_id,v_role->>'participation'
        )
        on conflict (process_id,role_id,participation) do nothing;
      end if;
    end loop;
  end loop;

  insert into public.khpos_standard_installations(
    organisation_id,release_id,status,installed_by,installed_at,summary
  ) values (
    p_organisation_id,
    v_release.id,
    'pending_adoption',
    p_actor_user_id,
    now(),
    jsonb_build_object(
      'expected',v_release.snapshot->'summary',
      'installedAs','controlled_draft',
      'runtimeAssets','deferred_until_adoption'
    )
  )
  returning id into v_installation_id;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,
    'ops_standard_installed','standard_installation',v_installation_id,
    jsonb_build_object(
      'releaseId',v_release.id,
      'releaseCode',v_release.code,
      'status','pending_adoption'
    )
  );

  return v_installation_id;
end;
$func$;

revoke all on function public.khpos_ops_install_standard_release_server(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_install_standard_release_server(uuid,uuid,uuid)
  to service_role;

create or replace function public.khpos_ops_adopt_standard_release_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_installation_id uuid
)
returns void
language plpgsql
security definer
set search_path=public,auth,khpos_private,pg_temp
as $func$
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
    p_actor_user_id,p_organisation_id,array['VISION_CUSTODIAN']::text[]
  ) then
    raise exception 'Only the active Vision Custodian can adopt a KAEC Standard release for the school.';
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
      select id into v_role_id
      from public.khpos_ops_roles
      where organisation_id=p_organisation_id
        and code=v_item->>'ownerRoleCode'
        and status='active';
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

    select id into v_role_id
    from public.khpos_ops_roles
    where organisation_id=p_organisation_id
      and code=v_item->>'ownerRoleCode'
      and status='active';

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
$func$;

revoke all on function public.khpos_ops_adopt_standard_release_server(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_adopt_standard_release_server(uuid,uuid,uuid)
  to service_role;

-- Promote the current tested KAEC reference installation into the first
-- platform-level standard release. KNS is the proving ground, not the runtime
-- template: after this snapshot every school installs from the release object.
do $seed$
declare
  v_source uuid;
  v_actor uuid;
  v_snapshot jsonb;
  v_release uuid;
begin
  select id into v_source
  from public.organisations
  where name='KAEC Nigerian Schools'
    and status='active'
    and partner_status='active'
    and 'khpos_core'=any(coalesce(partner_entitlements,'{}'::text[]))
  order by created_at
  limit 1;

  if v_source is null then
    raise exception 'KAEC Nigerian Schools reference installation was not found.';
  end if;

  select a.user_id into v_actor
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles r on r.id=a.role_id
  where r.organisation_id=v_source
    and r.code='VISION_CUSTODIAN'
    and r.status='active'
    and a.status='active'
  order by a.primary_assignment desc,a.created_at
  limit 1;

  if v_actor is null then
    raise exception 'The reference installation needs an active Vision Custodian.';
  end if;

  v_snapshot := khpos_private.ops_build_standard_snapshot(v_source);

  insert into public.khpos_standard_releases(
    code,version,name,description,snapshot,snapshot_sha256,
    source_organisation_id,status,published_by,published_at
  ) values (
    'KAEC-STD-1',
    1,
    'KAEC Human Potential School Operating Standard v1',
    'The tested KAEC operating standard promoted from the reference implementation into a platform-level, versioned release for controlled school adoption.',
    v_snapshot,
    encode(digest(v_snapshot::text,'sha256'),'hex'),
    v_source,
    'active',
    v_actor,
    now()
  )
  on conflict (code) do update
  set snapshot=excluded.snapshot,
      snapshot_sha256=excluded.snapshot_sha256,
      source_organisation_id=excluded.source_organisation_id,
      status='active',
      published_by=excluded.published_by,
      published_at=excluded.published_at,
      updated_at=now()
  returning id into v_release;

  insert into public.khpos_standard_installations(
    organisation_id,release_id,status,installed_by,installed_at,
    adopted_by,adopted_at,summary
  ) values (
    v_source,v_release,'active',v_actor,now(),v_actor,now(),
    jsonb_build_object(
      'referenceInstallation',true,
      'expected',v_snapshot->'summary',
      'promotedToPlatformStandard',true
    )
  )
  on conflict (organisation_id,release_id) do update
  set status='active',
      adopted_by=excluded.adopted_by,
      adopted_at=excluded.adopted_at,
      summary=excluded.summary,
      updated_at=now();
end;
$seed$;

create or replace function public.khpos_ops_bootstrap_approved_partner_trigger()
returns trigger
language plpgsql
security definer
set search_path=public,auth,khpos_private,pg_temp
as $func$
begin
  if new.status='active'
     and new.role='executive'
     and (tg_op='INSERT' or old.status is distinct from new.status)
  then
    if exists(
      select 1 from public.organisations
      where id=new.organisation_id
        and partner_status='active'
        and 'khpos_core'=any(coalesce(partner_entitlements,'{}'::text[]))
    ) then
      perform public.khpos_ops_bootstrap_partner_server(new.organisation_id);
      perform public.khpos_ops_seed_partner_onboarding_server(
        new.organisation_id,new.user_id
      );

      if not exists(
        select 1 from public.khpos_standard_installations
        where organisation_id=new.organisation_id
          and status in ('pending_adoption','active')
      ) then
        perform public.khpos_ops_install_standard_release_server(
          new.organisation_id,new.user_id,null
        );
      end if;
    end if;
  end if;
  return new;
end;
$func$;

revoke all on function public.khpos_ops_bootstrap_approved_partner_trigger()
  from public,anon,authenticated;

comment on table public.khpos_standard_releases is
  'Versioned platform-level KAEC operating standards. Schools install from releases rather than copying another school.';
comment on table public.khpos_standard_installations is
  'Per-school installation/adoption history for KAEC Standard releases. Local governance can later supersede individual controls without destroying lineage.';
comment on function public.khpos_ops_adopt_standard_release_server(uuid,uuid,uuid) is
  'One explicit Vision Custodian adoption decision activates missing inherited controls and installs runtime defaults while preserving any existing active local control.';
