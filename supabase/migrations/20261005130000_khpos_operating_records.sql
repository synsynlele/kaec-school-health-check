-- KHP-OS: governed operational reports, logs, checklist-linked records and independent verification.

create table if not exists public.khpos_ops_process_tool_requirements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  process_id uuid not null references public.khpos_ops_processes(id) on delete cascade,
  tool_template_id uuid not null references public.khpos_ops_tool_templates(id) on delete restrict,
  label text not null,
  required boolean not null default true,
  minimum_entries integer not null default 1 check (minimum_entries between 1 and 100),
  verification_required boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(process_id,label)
);

create table if not exists public.khpos_ops_work_record_requirements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_item_id uuid not null references public.khpos_ops_work_items(id) on delete cascade,
  tool_template_id uuid not null references public.khpos_ops_tool_templates(id) on delete restrict,
  label text not null,
  required boolean not null default true,
  minimum_entries integer not null default 1 check (minimum_entries between 1 and 100),
  verification_required boolean not null default false,
  tool_code_snapshot text not null,
  tool_name_snapshot text not null,
  tool_type_snapshot text not null,
  schema_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(schema_snapshot)='object'),
  created_at timestamptz not null default now(),
  unique(work_item_id,label)
);

create table if not exists public.khpos_ops_work_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_item_id uuid not null references public.khpos_ops_work_items(id) on delete cascade,
  requirement_id uuid not null references public.khpos_ops_work_record_requirements(id) on delete cascade,
  tool_template_id uuid not null references public.khpos_ops_tool_templates(id) on delete restrict,
  tool_code_snapshot text not null,
  tool_name_snapshot text not null,
  tool_type_snapshot text not null,
  schema_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(schema_snapshot)='object'),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  status text not null default 'submitted' check (status in ('submitted','returned','verified')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.khpos_ops_work_items
  add column if not exists submitted_for_verification_at timestamptz;

create index if not exists idx_khpos_ops_process_tool_req_process
  on public.khpos_ops_process_tool_requirements(process_id,status);
create index if not exists idx_khpos_ops_process_tool_req_tool
  on public.khpos_ops_process_tool_requirements(tool_template_id);
create index if not exists idx_khpos_ops_work_record_req_work
  on public.khpos_ops_work_record_requirements(work_item_id);
create index if not exists idx_khpos_ops_work_record_req_tool
  on public.khpos_ops_work_record_requirements(tool_template_id);
create index if not exists idx_khpos_ops_work_records_work
  on public.khpos_ops_work_records(work_item_id,submitted_at desc);
create index if not exists idx_khpos_ops_work_records_org
  on public.khpos_ops_work_records(organisation_id,submitted_at desc);
create index if not exists idx_khpos_ops_work_records_submitter
  on public.khpos_ops_work_records(submitted_by,submitted_at desc);
create index if not exists idx_khpos_ops_work_records_requirement
  on public.khpos_ops_work_records(requirement_id,status);

alter table public.khpos_ops_process_tool_requirements enable row level security;
alter table public.khpos_ops_work_record_requirements enable row level security;
alter table public.khpos_ops_work_records enable row level security;

revoke all privileges on table public.khpos_ops_process_tool_requirements from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_work_record_requirements from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_work_records from public,anon,authenticated;
grant select,insert,update,delete on table public.khpos_ops_process_tool_requirements to service_role;
grant select,insert,update,delete on table public.khpos_ops_work_record_requirements to service_role;
grant select,insert,update,delete on table public.khpos_ops_work_records to service_role;

insert into public.khpos_ops_tool_templates(
  organisation_id,code,name,tool_type,purpose,schema_definition,status
)
select distinct
  p.organisation_id,
  'UTL-031',
  'Operating Log',
  'operating_log',
  'Captures a dated operational entry, observation, action and follow-up against controlled work.',
  jsonb_build_object(
    'formatVersion',1,
    'fields',jsonb_build_array(
      jsonb_build_object('key','entryDate','label','Entry date','type','date','required',true),
      jsonb_build_object('key','activity','label','Activity / event','type','text','required',true),
      jsonb_build_object('key','observation','label','What was observed','type','textarea','required',true),
      jsonb_build_object('key','actionTaken','label','Action taken','type','textarea','required',true),
      jsonb_build_object('key','outcome','label','Outcome','type','textarea','required',true),
      jsonb_build_object('key','followUp','label','Follow-up required','type','textarea','required',false)
    )
  ),
  'active'
from public.khpos_ops_processes p
on conflict (organisation_id,code) do update
set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,
    schema_definition=excluded.schema_definition,status='active',updated_at=now();

insert into public.khpos_ops_tool_templates(
  organisation_id,code,name,tool_type,purpose,schema_definition,status
)
select distinct
  p.organisation_id,
  'UTL-032',
  'Operating Report',
  'operating_report',
  'Captures a controlled period report with results, exceptions, evidence references and next actions.',
  jsonb_build_object(
    'formatVersion',1,
    'fields',jsonb_build_array(
      jsonb_build_object('key','periodStart','label','Period start','type','date','required',true),
      jsonb_build_object('key','periodEnd','label','Period end','type','date','required',true),
      jsonb_build_object('key','summary','label','Executive summary','type','textarea','required',true),
      jsonb_build_object('key','keyResults','label','Key results / what happened','type','textarea','required',true),
      jsonb_build_object('key','exceptions','label','Exceptions, gaps or risks','type','textarea','required',true),
      jsonb_build_object('key','evidenceReferences','label','Evidence / source references','type','textarea','required',false),
      jsonb_build_object('key','nextActions','label','Next actions','type','textarea','required',true),
      jsonb_build_object('key','decisionNeeded','label','Decision or support needed','type','textarea','required',false)
    )
  ),
  'active'
from public.khpos_ops_processes p
on conflict (organisation_id,code) do update
set name=excluded.name,tool_type=excluded.tool_type,purpose=excluded.purpose,
    schema_definition=excluded.schema_definition,status='active',updated_at=now();

insert into public.khpos_ops_process_tool_requirements(
  organisation_id,process_id,tool_template_id,label,required,minimum_entries,verification_required,status
)
select
  p.organisation_id,p.id,t.id,
  case p.code
    when 'ACD-007' then 'Missed Lesson Recovery Log'
    when 'ACD-009' then 'Weekly Academic Execution Report'
    when 'HPD-004' then 'Weekly Skills Execution Report'
    when 'IPA-007' then 'Weekly School Performance Report'
    when 'IPA-008' then 'Monthly Institutional Review Report'
  end,
  true,1,
  case when p.code in ('ACD-007','ACD-009','HPD-004','IPA-007') then true else false end,
  'active'
from public.khpos_ops_processes p
join public.khpos_ops_tool_templates t
  on t.organisation_id=p.organisation_id
 and t.code=case when p.code='ACD-007' then 'UTL-031' else 'UTL-032' end
where p.code in ('ACD-007','ACD-009','HPD-004','IPA-007','IPA-008')
on conflict (process_id,label) do update
set tool_template_id=excluded.tool_template_id,
    required=excluded.required,
    minimum_entries=excluded.minimum_entries,
    verification_required=excluded.verification_required,
    status='active',
    updated_at=now();

create or replace function khpos_private.ops_attach_work_record_requirements()
returns trigger
language plpgsql
set search_path = public,khpos_private,pg_temp
as $$
begin
  if new.process_id is null then
    return new;
  end if;

  insert into public.khpos_ops_work_record_requirements(
    organisation_id,work_item_id,tool_template_id,label,required,minimum_entries,
    verification_required,tool_code_snapshot,tool_name_snapshot,tool_type_snapshot,
    schema_snapshot
  )
  select
    new.organisation_id,new.id,r.tool_template_id,r.label,r.required,r.minimum_entries,
    r.verification_required,t.code,t.name,t.tool_type,t.schema_definition
  from public.khpos_ops_process_tool_requirements r
  join public.khpos_ops_tool_templates t on t.id=r.tool_template_id
  where r.process_id=new.process_id
    and r.organisation_id=new.organisation_id
    and r.status='active'
    and t.organisation_id=new.organisation_id
    and t.status='active'
  on conflict (work_item_id,label) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_khpos_ops_attach_work_record_requirements on public.khpos_ops_work_items;
create trigger trg_khpos_ops_attach_work_record_requirements
after insert on public.khpos_ops_work_items
for each row execute function khpos_private.ops_attach_work_record_requirements();

insert into public.khpos_ops_work_record_requirements(
  organisation_id,work_item_id,tool_template_id,label,required,minimum_entries,
  verification_required,tool_code_snapshot,tool_name_snapshot,tool_type_snapshot,
  schema_snapshot
)
select
  w.organisation_id,w.id,r.tool_template_id,r.label,r.required,r.minimum_entries,
  r.verification_required,t.code,t.name,t.tool_type,t.schema_definition
from public.khpos_ops_work_items w
join public.khpos_ops_process_tool_requirements r
  on r.process_id=w.process_id and r.organisation_id=w.organisation_id and r.status='active'
join public.khpos_ops_tool_templates t
  on t.id=r.tool_template_id and t.organisation_id=w.organisation_id and t.status='active'
on conflict (work_item_id,label) do nothing;

create or replace function public.khpos_ops_submit_work_record_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_work_item_id uuid,
  p_requirement_id uuid,
  p_payload jsonb,
  p_record_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_requirement public.khpos_ops_work_record_requirements%rowtype;
  v_record_id uuid;
  v_field jsonb;
  v_key text;
  v_value jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Operating record payload must be an object.';
  end if;

  if not exists (
    select 1
    from public.khpos_ops_work_items w
    join public.khpos_ops_role_assignments a on a.id=w.owner_assignment_id
    join public.organisation_memberships m
      on m.organisation_id=w.organisation_id and m.user_id=p_actor_user_id and m.status='active'
    join public.organisations o on o.id=w.organisation_id
    where w.id=p_work_item_id
      and w.organisation_id=p_organisation_id
      and a.user_id=p_actor_user_id
      and a.status='active'
      and w.status='in_progress'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Start this work before submitting its report or log.';
  end if;

  select * into v_requirement
  from public.khpos_ops_work_record_requirements r
  where r.id=p_requirement_id
    and r.work_item_id=p_work_item_id
    and r.organisation_id=p_organisation_id;

  if v_requirement.id is null then
    raise exception 'The required operating record was not found.';
  end if;

  if jsonb_typeof(v_requirement.schema_snapshot->'fields')='array' then
    for v_field in
      select value
      from jsonb_array_elements(v_requirement.schema_snapshot->'fields')
    loop
      if coalesce((v_field->>'required')::boolean,false) then
        v_key := v_field->>'key';
        if v_key is null or not (p_payload ? v_key) then
          raise exception 'Complete all required report or log fields.';
        end if;
        v_value := p_payload->v_key;
        if v_value is null
          or v_value='null'::jsonb
          or (jsonb_typeof(v_value)='string' and btrim(v_value #>> '{}')='')
        then
          raise exception 'Complete all required report or log fields.';
        end if;
      end if;
    end loop;
  end if;

  if p_record_id is not null then
    update public.khpos_ops_work_records
    set payload=p_payload,
        status='submitted',
        submitted_by=p_actor_user_id,
        submitted_at=now(),
        review_note=null,
        reviewed_by=null,
        reviewed_at=null,
        updated_at=now()
    where id=p_record_id
      and organisation_id=p_organisation_id
      and work_item_id=p_work_item_id
      and requirement_id=p_requirement_id
      and status='returned'
      and submitted_by=p_actor_user_id
    returning id into v_record_id;

    if v_record_id is null then
      raise exception 'Only a returned operating record can be resubmitted.';
    end if;
  else
    insert into public.khpos_ops_work_records(
      organisation_id,work_item_id,requirement_id,tool_template_id,
      tool_code_snapshot,tool_name_snapshot,tool_type_snapshot,schema_snapshot,
      payload,status,submitted_by,submitted_at
    ) values (
      p_organisation_id,p_work_item_id,v_requirement.id,v_requirement.tool_template_id,
      v_requirement.tool_code_snapshot,v_requirement.tool_name_snapshot,
      v_requirement.tool_type_snapshot,v_requirement.schema_snapshot,
      p_payload,'submitted',p_actor_user_id,now()
    )
    returning id into v_record_id;
  end if;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_work_record_submitted','work_record',v_record_id,
    jsonb_build_object('workItemId',p_work_item_id,'requirementId',p_requirement_id)
  );

  return v_record_id;
end;
$$;

create or replace function public.khpos_ops_update_work_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_work_item_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, khpos_private, pg_temp
as $$
declare
  v_work public.khpos_ops_work_items%rowtype;
  v_missing_checklist integer := 0;
  v_failed_checklist integer := 0;
  v_evidence_count integer := 0;
  v_missing_records integer := 0;
  v_record_verification boolean := false;
  v_issue_id uuid;
begin
  select w.* into v_work
  from public.khpos_ops_work_items w
  join public.khpos_ops_role_assignments a on a.id=w.owner_assignment_id
  join public.organisation_memberships m
    on m.organisation_id=w.organisation_id and m.user_id=p_actor_user_id and m.status='active'
  join public.organisations o on o.id=w.organisation_id
  where w.id=p_work_item_id
    and w.organisation_id=p_organisation_id
    and a.user_id=p_actor_user_id
    and a.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_work.id is null then raise exception 'Owned work item not found.'; end if;

  if p_action='start' then
    if v_work.status not in ('pending','blocked') then raise exception 'This work item cannot be started from its current status.'; end if;
    update public.khpos_ops_work_items
      set status='in_progress',started_at=coalesce(started_at,now()),blocked_reason=null,updated_at=now()
      where id=v_work.id;
  elsif p_action='block' then
    if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'A blockage reason is required.'; end if;
    if v_work.status in ('completed','cancelled','awaiting_verification') then raise exception 'This work item cannot be blocked from its current status.'; end if;
    update public.khpos_ops_work_items
      set status='blocked',blocked_reason=btrim(p_note),updated_at=now()
      where id=v_work.id;

    v_issue_id := khpos_private.ops_ensure_work_issue(
      p_actor_user_id,p_organisation_id,v_work.id,null,'work_blocker',
      'Blocked work: '||v_work.title,btrim(p_note)
    );
  elsif p_action='complete' then
    if v_work.status <> 'in_progress' then
      raise exception 'Start this work before completing it; blocked or closed work cannot be completed.';
    end if;

    if v_work.checklist_template_id is not null then
      select count(*)::integer into v_missing_checklist
      from public.khpos_ops_checklist_template_items i
      where i.template_id=v_work.checklist_template_id
        and i.required=true
        and not exists (
          select 1 from public.khpos_ops_checklist_responses cr
          where cr.work_item_id=v_work.id and cr.template_item_id=i.id
        );
      if v_missing_checklist > 0 then
        raise exception 'Complete all required checklist items before closing this work.';
      end if;

      select count(*)::integer into v_failed_checklist
      from public.khpos_ops_checklist_template_items i
      join public.khpos_ops_checklist_responses cr
        on cr.template_item_id=i.id and cr.work_item_id=v_work.id
      where i.template_id=v_work.checklist_template_id
        and i.exception_on_response is not null
        and cr.response=i.exception_on_response;

      if v_failed_checklist > 0 then
        raise exception 'This checklist contains an unresolved exception and cannot be closed as normal work.';
      end if;
    end if;

    select count(*)::integer into v_missing_records
    from public.khpos_ops_work_record_requirements req
    where req.work_item_id=v_work.id
      and req.required=true
      and (
        select count(*)
        from public.khpos_ops_work_records rec
        where rec.requirement_id=req.id
          and rec.status in ('submitted','verified')
      ) < req.minimum_entries;

    if v_missing_records > 0 then
      raise exception 'Submit all required reports or logs before completing this work.';
    end if;

    if v_work.evidence_required then
      select
        (select count(*) from public.khpos_ops_evidence e where e.work_item_id=v_work.id)
        +
        (select count(*) from public.khpos_ops_work_records r
          where r.work_item_id=v_work.id and r.status in ('submitted','verified'))
      into v_evidence_count;
      if v_evidence_count=0 then
        raise exception 'Required evidence must be added before closing this work.';
      end if;
    end if;

    select exists(
      select 1
      from public.khpos_ops_work_record_requirements req
      where req.work_item_id=v_work.id
        and req.verification_required=true
    ) into v_record_verification;

    update public.khpos_ops_work_items
      set status=case when verification_required or v_record_verification then 'awaiting_verification' else 'completed' end,
          submitted_for_verification_at=case when verification_required or v_record_verification then now() else null end,
          completed_at=case when verification_required or v_record_verification then null else now() end,
          blocked_reason=null,
          updated_at=now()
      where id=v_work.id;
  else
    raise exception 'Unsupported work action.';
  end if;

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_work_'||p_action,'work_item',v_work.id,
    jsonb_build_object('note',nullif(btrim(coalesce(p_note,'')),''),'issueId',v_issue_id)
  );
end;
$$;

create or replace function public.khpos_ops_verify_work_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_work_item_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
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
        or r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN')
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
$$;

revoke execute on function public.khpos_ops_submit_work_record_server(uuid,uuid,uuid,uuid,jsonb,uuid) from public,anon,authenticated;
revoke execute on function public.khpos_ops_verify_work_server(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function khpos_private.ops_attach_work_record_requirements() from public,anon,authenticated;

grant execute on function public.khpos_ops_submit_work_record_server(uuid,uuid,uuid,uuid,jsonb,uuid) to service_role;
grant execute on function public.khpos_ops_verify_work_server(uuid,uuid,uuid,text,text) to service_role;
