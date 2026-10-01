-- Add school-owned draft/review/approval governance for registered operating processes.
alter table public.khpos_ops_process_versions
  add column if not exists author_id uuid references auth.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

alter table public.khpos_ops_process_versions
  drop constraint if exists khpos_ops_process_versions_status_check;
alter table public.khpos_ops_process_versions
  add constraint khpos_ops_process_versions_status_check
  check (status in ('draft','in_review','active','superseded','archived'));

create table if not exists public.khpos_ops_process_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  process_version_id uuid not null references public.khpos_ops_process_versions(id),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('drafted','edited','submitted','returned','approved')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_process_events_version
  on public.khpos_ops_process_events(process_version_id,created_at desc);

alter table public.khpos_ops_process_events enable row level security;
revoke all on public.khpos_ops_process_events from public,anon,authenticated;
grant select,insert on public.khpos_ops_process_events to service_role;

create or replace function public.khpos_ops_guard_process_version_mutation()
returns trigger language plpgsql
set search_path='public','pg_temp' as $$
begin
  if tg_op='DELETE' then
    if old.status<>'draft' then
      raise exception 'Submitted process versions cannot be deleted.';
    end if;
    return old;
  end if;

  if old.status='draft' and new.status='draft'
    and new.process_id=old.process_id and new.version=old.version then
    return new;
  end if;

  if old.status='draft' and new.status='in_review'
    and (to_jsonb(new)-'status'-'submitted_at')=(to_jsonb(old)-'status'-'submitted_at') then
    return new;
  end if;

  if old.status='in_review' and new.status in ('draft','active')
    and (to_jsonb(new)-'status'-'reviewed_by'-'reviewed_at'-'review_note'-'approved_by'-'approved_at')
      =(to_jsonb(old)-'status'-'reviewed_by'-'reviewed_at'-'review_note'-'approved_by'-'approved_at') then
    return new;
  end if;

  if old.status='active' and new.status='superseded'
    and (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then
    return new;
  end if;

  raise exception 'Submitted and approved process content is immutable.';
end;
$$;

drop trigger if exists trg_khpos_ops_guard_process_version_mutation
  on public.khpos_ops_process_versions;
create trigger trg_khpos_ops_guard_process_version_mutation
before delete or update on public.khpos_ops_process_versions
for each row execute function public.khpos_ops_guard_process_version_mutation();

create or replace function public.khpos_ops_govern_process_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_process_id uuid,
  p_action text,
  p_input jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer
set search_path='public','auth','pg_temp' as $$
declare
  v_process public.khpos_ops_processes%rowtype;
  v_version public.khpos_ops_process_versions%rowtype;
  v_owner boolean;
  v_editor boolean;
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
  where id=p_process_id and organisation_id=p_organisation_id and status<>'retired'
  for update;

  if not found then raise exception 'Process is not in this school.'; end if;

  select exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id and a.status='active'
      and r.organisation_id=p_organisation_id and r.status='active'
      and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN')
  ) into v_owner;

  select v_owner or exists(
    select 1
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id and a.status='active'
      and r.organisation_id=p_organisation_id and r.status='active'
      and r.code in ('SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER')
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
          select 1
          from jsonb_array_elements(p_input->v_field) e
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

      if v_version.id is null or v_version.status<>'draft'
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
        select 1 from public.khpos_ops_process_versions
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

      if not v_owner and (
        v_process.criticality='P0'
        or not exists(
          select 1
          from public.khpos_ops_role_assignments a
          join public.khpos_ops_roles r on r.id=a.role_id
          where a.user_id=p_actor_user_id and a.status='active'
            and r.organisation_id=p_organisation_id and r.status='active'
            and r.code='SCHOOL_GUARDIAN'
        )
      ) then
        raise exception 'This process requires School Custodian or School Guardian approval.';
      end if;

      if p_action='return' and v_note is null then
        raise exception 'Give the author a reason for return.';
      end if;

      if p_action='approve' then
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
$$;

revoke all on function public.khpos_ops_govern_process_server(uuid,uuid,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_govern_process_server(uuid,uuid,uuid,text,jsonb)
  to service_role;
