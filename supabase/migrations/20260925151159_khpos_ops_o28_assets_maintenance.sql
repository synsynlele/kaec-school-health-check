-- O28: campus asset register and preventive service, with faults owned by O4 Issues.
create table public.khpos_ops_assets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  asset_code text not null,
  label text not null,
  category text not null check(category in ('facility','equipment','technology','transport','safety','other')),
  location text not null,
  owner_role_id uuid not null references public.khpos_ops_roles(id),
  service_interval_days integer not null check(service_interval_days between 1 and 730),
  next_service_date date not null,
  status text not null default 'active' check(status in ('active','retired')),
  created_by uuid not null references auth.users(id),
  retired_by uuid references auth.users(id),
  retired_at timestamptz,
  retirement_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organisation_id,campus_id,asset_code)
);
create index idx_khpos_ops_assets_due on public.khpos_ops_assets(organisation_id,campus_id,status,next_service_date);
create index idx_khpos_ops_assets_owner_role on public.khpos_ops_assets(owner_role_id);
create table public.khpos_ops_asset_services (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  asset_id uuid not null references public.khpos_ops_assets(id),
  status text not null default 'submitted' check(status in ('submitted','returned','verified')),
  service_note text not null,
  evidence_reference text not null,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  review_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  next_due_date date,
  created_at timestamptz not null default now()
);
create index idx_khpos_ops_asset_services_asset on public.khpos_ops_asset_services(asset_id,created_at desc);
create unique index uq_khpos_ops_asset_service_pending on public.khpos_ops_asset_services(asset_id) where status in ('submitted','returned');
create table public.khpos_ops_asset_service_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  service_id uuid not null references public.khpos_ops_asset_services(id),
  event_type text not null check(event_type in ('submitted','returned','resubmitted','verified')),
  note text not null,
  evidence_reference text,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_khpos_ops_asset_service_events_service on public.khpos_ops_asset_service_events(service_id,created_at);
create table public.khpos_ops_asset_issues (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  asset_id uuid not null references public.khpos_ops_assets(id),
  issue_id uuid not null unique references public.khpos_ops_issues(id),
  created_at timestamptz not null default now()
);
create index idx_khpos_ops_asset_issues_asset on public.khpos_ops_asset_issues(asset_id,created_at desc);
alter table public.khpos_ops_assets enable row level security;
alter table public.khpos_ops_asset_services enable row level security;
alter table public.khpos_ops_asset_issues enable row level security;
alter table public.khpos_ops_asset_service_events enable row level security;
revoke all on public.khpos_ops_assets from public,anon,authenticated;
revoke all on public.khpos_ops_asset_services from public,anon,authenticated;
revoke all on public.khpos_ops_asset_issues from public,anon,authenticated;
revoke all on public.khpos_ops_asset_service_events from public,anon,authenticated;

create function public.khpos_ops_get_assets_server(p_actor uuid,p_org uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[]) then raise exception 'Active campus role and membership required.'; end if;
  return jsonb_build_object(
    'today',(now() at time zone 'Africa/Lagos')::date,
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'canManage',khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,true)) order by c.name) from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active' and khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,false)),'[]'::jsonb),
    'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'campusId',a.campus_id,'code',a.asset_code,'label',a.label,'category',a.category,'location',a.location,'ownerRoleTitle',(select r.title from public.khpos_ops_roles r where r.id=a.owner_role_id),'intervalDays',a.service_interval_days,'nextServiceDate',a.next_service_date,'status',a.status,'retirementNote',a.retirement_note,
      'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'note',s.service_note,'evidenceReference',s.evidence_reference,'submittedBy',s.submitted_by,'submittedAt',s.submitted_at,'reviewNote',s.review_note,'nextDueDate',s.next_due_date,'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'note',e.note,'evidenceReference',e.evidence_reference,'createdAt',e.created_at) order by e.created_at) from public.khpos_ops_asset_service_events e where e.service_id=s.id),'[]'::jsonb)) order by s.created_at desc) from public.khpos_ops_asset_services s where s.asset_id=a.id),'[]'::jsonb),
      'issues',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'status',i.status,'severity',i.severity,'title',i.title,'dueAt',i.due_at,'createdAt',i.created_at) order by i.created_at desc) from public.khpos_ops_asset_issues x join public.khpos_ops_issues i on i.id=x.issue_id where x.asset_id=a.id),'[]'::jsonb)) order by a.status,a.next_service_date,a.label) from public.khpos_ops_assets a where a.organisation_id=p_org and khpos_private.ops_culture_campus_access(p_actor,p_org,a.campus_id,false)),'[]'::jsonb)
  );
end $$;

create function public.khpos_ops_asset_action_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_asset public.khpos_ops_assets%rowtype; v_service public.khpos_ops_asset_services%rowtype; v_campus uuid; v_code text; v_note text; v_evidence text; v_owner uuid; v_owner_role uuid; v_issue uuid; v_due date; v_interval integer; v_event text; v_service_id uuid; v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[]) then raise exception 'Active campus role and membership required.'; end if;
  v_note:=nullif(btrim(p_input->>'note'),''); v_evidence:=nullif(btrim(p_input->>'evidenceReference'),'');
  if p_mode='create' then
    v_campus:=(p_input->>'campusId')::uuid; v_code:=upper(nullif(btrim(p_input->>'code'),''));
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_org and status='active') or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) then raise exception 'Campus leader must register assets for an active campus.'; end if;
    v_interval:=(p_input->>'intervalDays')::integer; v_due:=(p_input->>'nextServiceDate')::date;
    if v_code is null or length(v_code)>40 or nullif(btrim(p_input->>'label'),'') is null or nullif(btrim(p_input->>'location'),'') is null or p_input->>'category' not in ('facility','equipment','technology','transport','safety','other') or v_interval not between 1 and 730 or v_due not between v_today and v_today+v_interval then raise exception 'Asset code, label, location, category, interval and future service date are required.'; end if;
    select r.id into v_owner_role from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.campus_id=v_campus and a.status='active' and r.organisation_id=p_org and r.status='active' and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER') order by case when r.code='SCHOOL_GUARDIAN' then 0 else 1 end,a.created_at limit 1;
    if v_owner_role is null then raise exception 'Assign a campus Guardian or Sectional Promoter to own assets.'; end if;
    insert into public.khpos_ops_assets(organisation_id,campus_id,asset_code,label,category,location,owner_role_id,service_interval_days,next_service_date,created_by) values(p_org,v_campus,v_code,left(btrim(p_input->>'label'),180),p_input->>'category',left(btrim(p_input->>'location'),180),v_owner_role,v_interval,v_due,p_actor) returning * into v_asset;
    insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata) values(p_org,p_actor,'ops_asset_registered','asset',v_asset.id,jsonb_build_object('campusId',v_campus,'code',v_code));
  else
    select * into v_asset from public.khpos_ops_assets where id=(p_input->>'assetId')::uuid and organisation_id=p_org for update;
    if v_asset.id is null or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_asset.campus_id,false) then raise exception 'Asset unavailable on your campus.'; end if;
    if v_asset.status<>'active' then raise exception 'Retired assets cannot receive new work.'; end if;
    if p_mode='report_fault' then
      if v_note is null or p_input->>'severity' not in ('P2','P3','P4') or nullif(btrim(p_input->>'immediateAction'),'') is null then raise exception 'Describe the fault, severity and immediate action. Use the protected pathway for safety disclosures.'; end if;
      v_due:=(p_input->>'dueDate')::date;
      if v_due<v_today or v_due>v_today+(case p_input->>'severity' when 'P2' then 7 when 'P3' then 14 else 30 end) then raise exception 'Set a resolution date within 7 days for P2, 14 for P3 or 30 for P4.'; end if;
      if exists(select 1 from public.khpos_ops_asset_issues x join public.khpos_ops_issues i on i.id=x.issue_id where x.asset_id=v_asset.id and i.status<>'closed') then raise exception 'An unresolved issue already tracks this asset. Continue in Issues.'; end if;
      select a.id into v_owner from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where r.organisation_id=p_org and a.status='active' and r.status='active' and a.campus_id=v_asset.campus_id and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER') order by case when r.id=v_asset.owner_role_id then 0 when r.code='SCHOOL_GUARDIAN' then 1 else 2 end,a.created_at limit 1;
      if v_owner is null then raise exception 'Assign a campus Guardian or Sectional Promoter before reporting asset faults.'; end if;
      insert into public.khpos_ops_issues(organisation_id,campus_id,issue_type,category,severity,sensitivity,title,description,status,owner_assignment_id,reported_by,due_at,immediate_action) values(p_org,v_asset.campus_id,'system_exception','campus_asset',p_input->>'severity','standard',left(v_asset.asset_code||' · '||v_asset.label||' fault',180),left(v_note,4000),'assigned',v_owner,p_actor,(v_due+interval '1 day') at time zone 'Africa/Lagos',left(btrim(p_input->>'immediateAction'),4000)) returning id into v_issue;
      insert into public.khpos_ops_asset_issues(organisation_id,asset_id,issue_id) values(p_org,v_asset.id,v_issue);
      insert into public.khpos_ops_issue_events(organisation_id,issue_id,actor_user_id,event_type,to_status,note,metadata) values(p_org,v_issue,p_actor,'auto_reported','assigned',left(v_note,4000),jsonb_build_object('assetId',v_asset.id,'assetCode',v_asset.asset_code));
    elsif p_mode='submit_service' then
      if v_note is null or v_evidence is null then raise exception 'Service note and evidence reference are required.'; end if;
      if exists(select 1 from public.khpos_ops_asset_services where asset_id=v_asset.id and status in ('submitted','returned')) then raise exception 'An existing service awaits review or correction.'; end if;
      insert into public.khpos_ops_asset_services(organisation_id,asset_id,service_note,evidence_reference,submitted_by) values(p_org,v_asset.id,left(v_note,4000),left(v_evidence,400),p_actor) returning id into v_service_id;
      insert into public.khpos_ops_asset_service_events(organisation_id,service_id,event_type,note,evidence_reference,actor_id) values(p_org,v_service_id,'submitted',left(v_note,4000),left(v_evidence,400),p_actor);
    elsif p_mode in ('resubmit_service','return_service','verify_service') then
      select * into v_service from public.khpos_ops_asset_services where id=(p_input->>'serviceId')::uuid and asset_id=v_asset.id and organisation_id=p_org for update;
      if v_service.id is null then raise exception 'Service record unavailable.'; end if;
      if p_mode='resubmit_service' then
        if v_service.status<>'returned' or v_service.submitted_by<>p_actor or v_note is null or v_evidence is null then raise exception 'Original reporter must correct the returned service with evidence.'; end if;
        update public.khpos_ops_asset_services set status='submitted',service_note=left(v_note,4000),evidence_reference=left(v_evidence,400),submitted_at=now(),review_note=null,reviewed_by=null,reviewed_at=null where id=v_service.id;
        v_event:='resubmitted';
      elsif p_mode='return_service' then
        if v_service.status<>'submitted' or v_service.submitted_by=p_actor or v_note is null or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_asset.campus_id,true) then raise exception 'Another campus leader must review and explain the return.'; end if;
        update public.khpos_ops_asset_services set status='returned',review_note=left(v_note,4000),reviewed_by=p_actor,reviewed_at=now() where id=v_service.id;
        v_event:='returned';
      else
        if v_service.status<>'submitted' or v_service.submitted_by=p_actor or v_note is null or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_asset.campus_id,true) then raise exception 'A different campus leader must verify the service.'; end if;
        v_due:=v_today+v_asset.service_interval_days;
        update public.khpos_ops_asset_services set status='verified',review_note=left(v_note,4000),reviewed_by=p_actor,reviewed_at=now(),next_due_date=v_due where id=v_service.id;
        update public.khpos_ops_assets set next_service_date=v_due,updated_at=now() where id=v_asset.id;
        v_event:='verified';
      end if;
      insert into public.khpos_ops_asset_service_events(organisation_id,service_id,event_type,note,evidence_reference,actor_id) values(p_org,v_service.id,v_event,left(v_note,4000),case when p_mode='resubmit_service' then left(v_evidence,400) else null end,p_actor);
    elsif p_mode='retire' then
      if v_note is null or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_asset.campus_id,true) then raise exception 'Campus leader must explain asset retirement.'; end if;
      if exists(select 1 from public.khpos_ops_asset_services where asset_id=v_asset.id and status in ('submitted','returned')) or exists(select 1 from public.khpos_ops_asset_issues x join public.khpos_ops_issues i on i.id=x.issue_id where x.asset_id=v_asset.id and i.status<>'closed') then raise exception 'Complete open service and issues before retirement.'; end if;
      update public.khpos_ops_assets set status='retired',retirement_note=left(v_note,4000),retired_by=p_actor,retired_at=now(),updated_at=now() where id=v_asset.id;
      insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata) values(p_org,p_actor,'ops_asset_retired','asset',v_asset.id,jsonb_build_object('reason',v_note));
    else raise exception 'Unsupported asset action.';
    end if;
  end if;
  return public.khpos_ops_get_assets_server(p_actor,p_org);
end $$;
revoke all on function public.khpos_ops_get_assets_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_asset_action_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_get_assets_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_asset_action_server(uuid,uuid,text,jsonb) to service_role;
