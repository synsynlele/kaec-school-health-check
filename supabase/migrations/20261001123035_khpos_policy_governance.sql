-- Govern future policy versions without changing previously published documents.
alter table public.khpos_ops_policy_versions
  add column if not exists author_id uuid references auth.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

alter table public.khpos_ops_policy_versions drop constraint if exists khpos_ops_policy_versions_status_check;
alter table public.khpos_ops_policy_versions add constraint khpos_ops_policy_versions_status_check
  check (status in ('draft','in_review','active','superseded','archived'));

create table if not exists public.khpos_ops_policy_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  policy_version_id uuid not null references public.khpos_ops_policy_versions(id),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('drafted','edited','submitted','returned','approved')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_khpos_ops_policy_events_version
  on public.khpos_ops_policy_events(policy_version_id,created_at desc);
alter table public.khpos_ops_policy_events enable row level security;
revoke all on public.khpos_ops_policy_events from public,anon,authenticated;
grant select,insert on public.khpos_ops_policy_events to service_role;

-- Drafts may be edited; submitted drafts are frozen until returned by a reviewer.
create or replace function public.khpos_ops_guard_policy_version_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then raise exception 'Submitted policy versions cannot be deleted.'; end if;
    return old;
  end if;
  if old.status='draft' and new.status='draft'
    and new.policy_id=old.policy_id and new.version=old.version then
    return new;
  end if;
  if old.status='draft' and new.status='in_review'
    and (to_jsonb(new) - 'status' - 'submitted_at')
      = (to_jsonb(old) - 'status' - 'submitted_at') then
    return new;
  end if;
  if old.status='in_review' and new.status in ('draft','active')
    and (to_jsonb(new) - 'status' - 'reviewed_by' - 'reviewed_at' - 'review_note' - 'approved_by' - 'approved_at')
      = (to_jsonb(old) - 'status' - 'reviewed_by' - 'reviewed_at' - 'review_note' - 'approved_by' - 'approved_at') then
    return new;
  end if;
  if old.status='active' and new.status='superseded'
    and (to_jsonb(new) - 'status')=(to_jsonb(old) - 'status') then return new; end if;
  raise exception 'Submitted and approved policy content is immutable.';
end;
$$;

create or replace function public.khpos_ops_govern_policy_server(
  p_actor_user_id uuid, p_organisation_id uuid, p_policy_id uuid,
  p_action text, p_input jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer
set search_path='' as $$
declare
  v_policy public.khpos_ops_policies%rowtype;
  v_version public.khpos_ops_policy_versions%rowtype;
  v_id uuid;
  v_owner boolean;
  v_editor boolean;
  v_note text := nullif(btrim(coalesce(p_input->>'note','')),'');
  v_review_date date;
  v_effective_date date;
  v_fields text[] := array['principles','policyStatements','rolesResponsibilities','rules','exceptions','escalation','recordsEvidence'];
  v_field text;
begin
  if not exists (
    select 1 from public.organisation_memberships m join public.organisations o on o.id=m.organisation_id
    where m.user_id=p_actor_user_id and m.organisation_id=p_organisation_id and m.status='active'
      and o.status='active' and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then raise exception 'Active school membership and partnership are required.'; end if;

  select * into v_policy from public.khpos_ops_policies
    where id=p_policy_id and organisation_id=p_organisation_id and status<>'retired' for update;
  if not found then raise exception 'Policy is not in this school.'; end if;

  select exists(select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id and a.status='active'
      and r.organisation_id=p_organisation_id and r.status='active'
      and r.code in ('VISION_CUSTODIAN','SCHOOL_CUSTODIAN')) into v_owner;
  select v_owner or exists(select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id and a.status='active'
      and r.organisation_id=p_organisation_id and r.status='active'
      and r.code in ('SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER')) into v_editor;
  if not v_editor then raise exception 'An active school leadership assignment is required.'; end if;

  if p_action='save' then
    if length(btrim(coalesce(p_input->>'purpose','')))<20 or length(btrim(coalesce(p_input->>'scope','')))<10 then
      raise exception 'Purpose and scope need substantive text.'; end if;
    foreach v_field in array v_fields loop
      if jsonb_typeof(p_input->v_field)<>'array' or jsonb_array_length(p_input->v_field)>30
        or exists(select 1 from jsonb_array_elements(p_input->v_field) e
          where jsonb_typeof(e)<>'string' or length(btrim(e#>>'{}'))<5 or length(e#>>'{}')>1000)
      then raise exception 'Every policy section must be an array of substantive statements.'; end if;
    end loop;
    if jsonb_array_length(p_input->'policyStatements')=0 or jsonb_array_length(p_input->'rules')=0 then
      raise exception 'Policy statements and rules are required.'; end if;
    begin
      v_effective_date := (p_input->>'effectiveDate')::date;
      v_review_date := (p_input->>'reviewDate')::date;
    exception when others then raise exception 'Use valid effective and review dates.'; end;
    if v_effective_date is null or v_review_date is null or v_review_date<=v_effective_date then
      raise exception 'Review date must be later than effective date.'; end if;
    if p_input ? 'versionId' then
      select * into v_version from public.khpos_ops_policy_versions
        where id=(p_input->>'versionId')::uuid and policy_id=p_policy_id for update;
      if v_version.id is null or v_version.status<>'draft' or v_version.author_id<>p_actor_user_id then
        raise exception 'Only the author can edit an open draft.'; end if;
      v_id := v_version.id;
      update public.khpos_ops_policy_versions set
        purpose=btrim(p_input->>'purpose'),scope=btrim(p_input->>'scope'),
        principles=p_input->'principles',policy_statements=p_input->'policyStatements',
        roles_responsibilities=p_input->'rolesResponsibilities',rules=p_input->'rules',
        exceptions=p_input->'exceptions',escalation=p_input->'escalation',
        records_evidence=p_input->'recordsEvidence',effective_date=v_effective_date,
        review_date=v_review_date where id=v_id;
    else
      if exists(select 1 from public.khpos_ops_policy_versions where policy_id=p_policy_id and status in ('draft','in_review'))
      then raise exception 'Finish the open revision before starting another.'; end if;
      insert into public.khpos_ops_policy_versions(
        policy_id,version,purpose,scope,principles,policy_statements,roles_responsibilities,
        rules,exceptions,escalation,records_evidence,effective_date,review_date,author_id,status)
      select p_policy_id,coalesce(max(version),0)+1,btrim(p_input->>'purpose'),btrim(p_input->>'scope'),
        p_input->'principles',p_input->'policyStatements',p_input->'rolesResponsibilities',
        p_input->'rules',p_input->'exceptions',p_input->'escalation',p_input->'recordsEvidence',
        v_effective_date,v_review_date,p_actor_user_id,'draft'
      from public.khpos_ops_policy_versions where policy_id=p_policy_id returning id into v_id;
    end if;
    insert into public.khpos_ops_policy_events(organisation_id,policy_version_id,actor_id,action)
      values(p_organisation_id,v_id,p_actor_user_id,case when p_input ? 'versionId' then 'edited' else 'drafted' end);
  else
    begin v_id:=(p_input->>'versionId')::uuid;
    exception when others then raise exception 'A valid version is required.'; end;
    select * into v_version from public.khpos_ops_policy_versions
      where id=v_id and policy_id=p_policy_id for update;
    if v_version.id is null then raise exception 'Policy revision not found.'; end if;
    if p_action='submit' and v_version.status='draft' and v_version.author_id=p_actor_user_id then
      update public.khpos_ops_policy_versions set status='in_review',submitted_at=now() where id=v_id;
      insert into public.khpos_ops_policy_events(organisation_id,policy_version_id,actor_id,action)
        values(p_organisation_id,v_id,p_actor_user_id,'submitted');
    elsif p_action in ('return','approve') and v_version.status='in_review' then
      if v_version.author_id=p_actor_user_id then raise exception 'The author cannot review their own policy.'; end if;
      if not v_owner and (v_policy.priority='C0' or not exists (
        select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
        where a.user_id=p_actor_user_id and a.status='active' and r.organisation_id=p_organisation_id
          and r.status='active' and r.code='SCHOOL_GUARDIAN'))
      then raise exception 'This policy requires School Custodian or School Guardian approval.'; end if;
      if p_action='return' and v_note is null then raise exception 'Give the author a reason for return.'; end if;
      if p_action='approve' then
        update public.khpos_ops_policy_versions set status='superseded'
          where policy_id=p_policy_id and status='active';
      end if;
      update public.khpos_ops_policy_versions set
        status=case when p_action='approve' then 'active' else 'draft' end,
        reviewed_by=p_actor_user_id,reviewed_at=now(),review_note=v_note,
        approved_by=case when p_action='approve' then p_actor_user_id else null end,
        approved_at=case when p_action='approve' then now() else null end
        where id=v_id;
      if p_action='approve' then
        update public.khpos_ops_policies set status='active',updated_at=now() where id=p_policy_id;
      end if;
      insert into public.khpos_ops_policy_events(organisation_id,policy_version_id,actor_id,action,note)
        values(p_organisation_id,v_id,p_actor_user_id,case when p_action='approve' then 'approved' else 'returned' end,v_note);
    else raise exception 'This transition is not allowed.'; end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.khpos_ops_govern_policy_server(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_govern_policy_server(uuid,uuid,uuid,text,jsonb) to service_role;
