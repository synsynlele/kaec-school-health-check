-- School Reports: service-only API, explicit owners/reviewers, immutable revision trail.
create table public.khpos_report_types (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.organisations(id),
 campus_id uuid references public.khpos_ops_campuses(id), unit_id uuid references public.khpos_ops_units(id),
 title text not null check(length(title) between 3 and 160), instructions text not null default '',
 owner_role_id uuid not null references public.khpos_ops_roles(id), reviewer_role_id uuid not null references public.khpos_ops_roles(id),
 cadence text not null check(cadence in ('one_off','daily','weekly','monthly','quarterly','termly','yearly','custom_days')),
 interval_days integer not null default 14 check(interval_days between 1 and 365),
 start_date date not null, next_date date not null, end_date date,
 due_days integer not null default 1 check(due_days between 0 and 90), due_time time not null default '17:00',
 fields jsonb not null, version integer not null default 1,
 status text not null default 'active' check(status in ('active','paused','archived')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(end_date is null or end_date>=start_date)
);
create table public.khpos_reports (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.organisations(id),
 type_id uuid not null references public.khpos_report_types(id), owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id),
 owner_user_id uuid not null references auth.users(id),
 campus_id uuid references public.khpos_ops_campuses(id), unit_id uuid references public.khpos_ops_units(id),
 reviewer_role_id uuid not null references public.khpos_ops_roles(id), title text not null, instructions text not null,
 fields jsonb not null, type_version integer not null,
 occurrence_key text not null, period_start date not null, period_end date not null, due_at timestamptz not null,
 payload jsonb not null default '{}'::jsonb, status text not null default 'draft' check(status in ('draft','submitted','returned','accepted','withdrawn')),
 revision integer not null default 0, lock_version integer not null default 1,
 submitted_at timestamptz, reviewed_at timestamptz, review_note text, reviewed_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(type_id,owner_assignment_id,occurrence_key), check(period_end>=period_start)
);
create table public.khpos_report_events (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.organisations(id),
 report_id uuid references public.khpos_reports(id), type_id uuid references public.khpos_report_types(id),
 actor_id uuid references auth.users(id), action text not null, revision integer, snapshot jsonb not null default '{}'::jsonb,
 note text, created_at timestamptz not null default now()
);
create index on public.khpos_report_types(school_id,status,next_date);
create index on public.khpos_report_types(campus_id); create index on public.khpos_report_types(unit_id);
create index on public.khpos_report_types(owner_role_id); create index on public.khpos_report_types(reviewer_role_id); create index on public.khpos_report_types(created_by);
create index on public.khpos_reports(school_id,status,due_at); create index on public.khpos_reports(owner_assignment_id,status);
create index on public.khpos_reports(owner_user_id); create index on public.khpos_reports(campus_id); create index on public.khpos_reports(unit_id); create index on public.khpos_reports(reviewer_role_id); create index on public.khpos_reports(reviewed_by);
create index on public.khpos_report_events(report_id,created_at); create index on public.khpos_report_events(type_id); create index on public.khpos_report_events(school_id); create index on public.khpos_report_events(actor_id);
alter table public.khpos_report_types enable row level security;
alter table public.khpos_reports enable row level security;
alter table public.khpos_report_events enable row level security;
revoke all on public.khpos_report_types,public.khpos_reports,public.khpos_report_events from public,anon,authenticated;
grant all on public.khpos_report_types,public.khpos_reports,public.khpos_report_events to service_role;

create function khpos_private.report_assignment_active(p_id uuid,p_school uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
 where a.id=p_id and a.status='active' and r.status='active' and r.organisation_id=p_school
 and (a.start_date is null or a.start_date<=current_date) and (a.end_date is null or a.end_date>=current_date)
 and khpos_private.ops_hpd_has_membership(a.user_id,p_school)
 and (exists(select 1 from public.khpos_ops_staff st where st.user_id=a.user_id and st.organisation_id=p_school and st.status='active')
 or (r.code='SCHOOL_CUSTODIAN' and not exists(select 1 from public.khpos_ops_staff st where st.user_id=a.user_id and st.organisation_id=p_school))))
$$;
create function khpos_private.report_owner(p_actor uuid,p_report uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.khpos_reports n join public.khpos_ops_role_assignments a on a.id=n.owner_assignment_id
 where n.id=p_report and a.user_id=p_actor and n.owner_user_id=p_actor and khpos_private.report_assignment_active(a.id,n.school_id)
 and a.campus_id is not distinct from n.campus_id and a.unit_id is not distinct from n.unit_id)
$$;
create function khpos_private.report_reviewer(p_actor uuid,p_report uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.khpos_reports n join public.khpos_ops_role_assignments owner_a on owner_a.id=n.owner_assignment_id
 join public.khpos_ops_role_assignments a on a.role_id=n.reviewer_role_id
 where n.id=p_report and a.user_id=p_actor and n.owner_user_id<>p_actor
 and khpos_private.report_assignment_active(a.id,n.school_id)
 and (a.campus_id is null or a.campus_id=n.campus_id) and (a.unit_id is null or a.unit_id=n.unit_id))
$$;
create function khpos_private.report_validate_fields(p_fields jsonb,p_payload jsonb default null) returns void language plpgsql set search_path='' as $$
declare f jsonb; k text; v jsonb; seen text[]:='{}';
begin
 if jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields) not between 1 and 30 then raise exception 'Use 1 to 30 report fields.'; end if;
 if p_payload is not null and (jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>100000) then raise exception 'Report answers must be an object under 100 KB.'; end if;
 for f in select value from jsonb_array_elements(p_fields) loop
  k:=f->>'key';
  if k is null or k!~'^[a-zA-Z][a-zA-Z0-9_]{0,49}$' or k=any(seen) or length(btrim(coalesce(f->>'label',''))) not between 1 and 160 or coalesce(f->>'type','') not in ('text','textarea','number','date','boolean','select','url') then raise exception 'Every report field needs a unique key, label and supported type.'; end if;
  seen:=array_append(seen,k);
  if f->>'type'='select' and (jsonb_typeof(f->'options') is distinct from 'array' or jsonb_array_length(f->'options') not between 1 and 30) then raise exception 'Choice fields need 1 to 30 options.'; end if;
  if f->>'type'='select' and (exists(select 1 from jsonb_array_elements(f->'options') opt where jsonb_typeof(opt)<>'string' or length(btrim(opt#>>'{}')) not between 1 and 160) or (select count(*)<>count(distinct opt) from jsonb_array_elements(f->'options') opt)) then raise exception 'Choice options must be unique non-empty text of up to 160 characters.'; end if;
  if p_payload is not null then
   v:=p_payload->k;
   if coalesce((f->>'required')::boolean,false) and (v is null or v='null'::jsonb or (jsonb_typeof(v)='string' and btrim(v#>>'{}')='')) then raise exception 'Complete the required field: %',f->>'label'; end if;
   if v is not null and v<>'null'::jsonb and v<>'""'::jsonb then
    if f->>'type'='number' and jsonb_typeof(v)<>'number' then raise exception '% must be a number.',f->>'label'; end if;
    if f->>'type'='boolean' and jsonb_typeof(v)<>'boolean' then raise exception '% must be Yes or No.',f->>'label'; end if;
    if f->>'type' not in ('number','boolean') and jsonb_typeof(v)<>'string' then raise exception '% must be text.',f->>'label'; end if;
    if length(v#>>'{}')>12000 then raise exception 'An answer exceeds 12,000 characters.'; end if;
    if f->>'type'='select' and not ((f->'options') @> jsonb_build_array(v)) then raise exception 'Choose an available option for %.',f->>'label'; end if;
    if f->>'type'='date' then perform (v#>>'{}')::date; end if;
    if f->>'type'='url' and (v#>>'{}')!~'^https://[^[:space:]@]+$' then raise exception 'Evidence links must use HTTPS without credentials.'; end if;
   end if;
  end if;
 end loop;
 if p_payload is not null and exists(select 1 from jsonb_object_keys(p_payload) x where not x=any(seen)) then raise exception 'Report contains fields outside its saved form.'; end if;
end $$;

-- Lazy materialisation is also called by the existing scheduled notification feed.
-- Period keys make retries idempotent. Termly reports use actual school term dates.
create function public.khpos_reports_sync_server(p_school uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.khpos_report_types%rowtype; d date; e date; last_start date; term_row record; steps integer; today date:=(now() at time zone 'Africa/Lagos')::date;
begin
 for t in select * from public.khpos_report_types where school_id=p_school and status='active' and cadence<>'one_off' and next_date<=today for update loop
  d:=t.next_date; last_start:=d; steps:=0;
  if t.cadence='termly' then
   for term_row in select * from public.khpos_ops_academic_terms at where at.organisation_id=p_school and at.status in ('active','closed') and at.start_date<=today and at.end_date>=t.next_date and (t.end_date is null or at.start_date<=t.end_date) and (at.campus_id is null or at.campus_id=t.campus_id) loop
    insert into public.khpos_reports(school_id,type_id,owner_assignment_id,owner_user_id,campus_id,unit_id,reviewer_role_id,title,instructions,fields,type_version,occurrence_key,period_start,period_end,due_at)
    select t.school_id,t.id,a.id,a.user_id,a.campus_id,a.unit_id,t.reviewer_role_id,t.title,t.instructions,t.fields,t.version,'term:'||term_row.id,term_row.start_date,term_row.end_date,((term_row.end_date+t.due_days)+t.due_time) at time zone 'Africa/Lagos'
    from public.khpos_ops_role_assignments a where a.role_id=t.owner_role_id and khpos_private.report_assignment_active(a.id,p_school)
    and (t.campus_id is null or a.campus_id=t.campus_id) and (t.unit_id is null or a.unit_id=t.unit_id)
    and (a.start_date is null or a.start_date<=term_row.end_date)
    on conflict(type_id,owner_assignment_id,occurrence_key) do nothing;
   end loop;
   continue;
  end if;
  while d<=today and (t.end_date is null or d<=t.end_date) and steps<400 loop
   e:=case t.cadence when 'daily' then d when 'weekly' then d+6 when 'monthly' then (date_trunc('month',d)+interval '1 month - 1 day')::date when 'quarterly' then (date_trunc('quarter',d)+interval '3 months - 1 day')::date when 'yearly' then (date_trunc('year',d)+interval '1 year - 1 day')::date else d+t.interval_days-1 end;
   e:=least(e,coalesce(t.end_date,e));
   insert into public.khpos_reports(school_id,type_id,owner_assignment_id,owner_user_id,campus_id,unit_id,reviewer_role_id,title,instructions,fields,type_version,occurrence_key,period_start,period_end,due_at)
   select t.school_id,t.id,a.id,a.user_id,a.campus_id,a.unit_id,t.reviewer_role_id,t.title,t.instructions,t.fields,t.version,d::text,d,e,((e+t.due_days)+t.due_time) at time zone 'Africa/Lagos'
   from public.khpos_ops_role_assignments a where a.role_id=t.owner_role_id and khpos_private.report_assignment_active(a.id,p_school)
   and (t.campus_id is null or a.campus_id=t.campus_id) and (t.unit_id is null or a.unit_id=t.unit_id) and (a.start_date is null or a.start_date<=e)
   on conflict(type_id,owner_assignment_id,occurrence_key) do nothing;
   last_start:=d; d:=e+1; steps:=steps+1;
  end loop;
  update public.khpos_report_types set next_date=case when d>today then last_start else d end where id=t.id;
 end loop;
end $$;

create function public.khpos_report_action_server(p_actor uuid,p_school uuid,p_mode text,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.khpos_report_types%rowtype; n public.khpos_reports%rowtype; a public.khpos_ops_role_assignments%rowtype;
 v_id uuid:=nullif(p_input->>'id','')::uuid; c uuid:=nullif(p_input->>'campusId','')::uuid; u uuid:=nullif(p_input->>'unitId','')::uuid;
 v_note text:=btrim(coalesce(p_input->>'note','')); today date:=(now() at time zone 'Africa/Lagos')::date;
begin
 if p_school is null or not khpos_private.ops_hpd_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.'; end if;
 if p_mode in ('type_save','type_status') then
  if v_id is not null then
   select * into t from public.khpos_report_types where id=v_id and school_id=p_school for update;
   if not found or not khpos_private.announcements_publish_scope(p_actor,p_school,t.campus_id,t.unit_id) then raise exception 'Report type is outside your management authority.'; end if;
   if nullif(p_input->>'version','')::integer is distinct from t.version then raise exception 'Report type changed. Refresh before editing.'; end if;
  end if;
  if p_mode='type_status' then
   if t.id is null or p_input->>'status' not in ('active','paused','archived') or length(v_note)<5 then raise exception 'Choose a status and explain the change.'; end if;
   update public.khpos_report_types set status=p_input->>'status',version=version+1,updated_at=now(),next_date=case when p_input->>'status'='active' and t.status<>'active' and today>t.start_date then case t.cadence when 'daily' then today when 'weekly' then t.start_date+((today-t.start_date)/7)*7 when 'monthly' then greatest(t.start_date,date_trunc('month',today)::date) when 'quarterly' then greatest(t.start_date,date_trunc('quarter',today)::date) when 'yearly' then greatest(t.start_date,date_trunc('year',today)::date) when 'custom_days' then t.start_date+((today-t.start_date)/t.interval_days)*t.interval_days else today end else next_date end where id=t.id returning * into t;
  else
   if not khpos_private.announcements_publish_scope(p_actor,p_school,c,u) then raise exception 'Your active role cannot manage this school/campus/section.'; end if;
   if c is not null and not exists(select 1 from public.khpos_ops_campuses where id=c and organisation_id=p_school and status='active') then raise exception 'Select an active campus in this school.'; end if;
   if u is not null and not exists(select 1 from public.khpos_ops_units where id=u and organisation_id=p_school and campus_id=c and status='active') then raise exception 'Select a section within this campus.'; end if;
   if length(btrim(coalesce(p_input->>'title',''))) not between 3 and 160 or length(coalesce(p_input->>'instructions',''))>6000 then raise exception 'Use a title of 3–160 characters and instructions under 6,000 characters.'; end if;
   if not exists(select 1 from public.khpos_ops_roles where id=(p_input->>'ownerRoleId')::uuid and organisation_id=p_school and status='active') or not exists(select 1 from public.khpos_ops_roles where id=(p_input->>'reviewerRoleId')::uuid and organisation_id=p_school and status='active') then raise exception 'Select active school roles for the owner and reviewer.'; end if;
   perform khpos_private.report_validate_fields(p_input->'fields');
   if t.id is not null then
    if length(v_note)<5 then raise exception 'Explain the report type change.'; end if;
    -- Cadence/scope changes are new types: keeps existing deadlines/ownership intelligible.
    if t.cadence is distinct from p_input->>'cadence' or t.campus_id is distinct from c or t.unit_id is distinct from u or t.owner_role_id is distinct from (p_input->>'ownerRoleId')::uuid or t.reviewer_role_id is distinct from (p_input->>'reviewerRoleId')::uuid or t.start_date is distinct from (p_input->>'startDate')::date or t.interval_days is distinct from coalesce((p_input->>'intervalDays')::integer,14) then raise exception 'Create a new report type to change its schedule, audience or reviewer. Pause the old type first.'; end if;
    update public.khpos_report_types set title=btrim(p_input->>'title'),instructions=coalesce(p_input->>'instructions',''),fields=p_input->'fields',due_days=(p_input->>'dueDays')::integer,due_time=(p_input->>'dueTime')::time,end_date=nullif(p_input->>'endDate','')::date,version=version+1,updated_at=now() where id=t.id returning * into t;
   else
    if (p_input->>'startDate')::date not between today-31 and today+366 then raise exception 'Start within the last 31 days or the next year.'; end if;
    insert into public.khpos_report_types(school_id,campus_id,unit_id,title,instructions,owner_role_id,reviewer_role_id,cadence,interval_days,start_date,next_date,end_date,due_days,due_time,fields,created_by)
    values(p_school,c,u,btrim(p_input->>'title'),coalesce(p_input->>'instructions',''),(p_input->>'ownerRoleId')::uuid,(p_input->>'reviewerRoleId')::uuid,p_input->>'cadence',coalesce((p_input->>'intervalDays')::integer,14),(p_input->>'startDate')::date,(p_input->>'startDate')::date,nullif(p_input->>'endDate','')::date,(p_input->>'dueDays')::integer,(p_input->>'dueTime')::time,p_input->'fields',p_actor) returning * into t;
   end if;
  end if;
  insert into public.khpos_report_events(school_id,type_id,actor_id,action,snapshot,note) values(p_school,t.id,p_actor,p_mode,to_jsonb(t),v_note);
  perform public.khpos_reports_sync_server(p_school); return t.id;
 elsif p_mode='create' then
  select * into t from public.khpos_report_types where id=(p_input->>'typeId')::uuid and school_id=p_school and status='active';
  select * into a from public.khpos_ops_role_assignments where id=(p_input->>'assignmentId')::uuid and user_id=p_actor;
  if t.id is null or a.id is null or a.role_id<>t.owner_role_id or not khpos_private.report_assignment_active(a.id,p_school) or (t.campus_id is not null and a.campus_id is distinct from t.campus_id) or (t.unit_id is not null and a.unit_id is distinct from t.unit_id) then raise exception 'This report type is not available to your active position.'; end if;
  if t.cadence<>'one_off' then raise exception 'Recurring reports are generated automatically. Open your assigned period report.'; end if;
  if (p_input->>'periodEnd')::date<(p_input->>'periodStart')::date then raise exception 'Period end cannot precede period start.'; end if;
  insert into public.khpos_reports(school_id,type_id,owner_assignment_id,owner_user_id,campus_id,unit_id,reviewer_role_id,title,instructions,fields,type_version,occurrence_key,period_start,period_end,due_at)
  values(p_school,t.id,a.id,a.user_id,a.campus_id,a.unit_id,t.reviewer_role_id,t.title,t.instructions,t.fields,t.version,'log:'||gen_random_uuid(),(p_input->>'periodStart')::date,(p_input->>'periodEnd')::date,(((p_input->>'periodEnd')::date+t.due_days)+t.due_time) at time zone 'Africa/Lagos') returning * into n;
 else
  select * into n from public.khpos_reports where id=v_id and school_id=p_school for update;
  if not found then raise exception 'Report not found.'; end if;
  if nullif(p_input->>'lockVersion','')::integer is distinct from n.lock_version then raise exception 'Report changed. Refresh to avoid overwriting another action.'; end if;
  if p_mode='withdraw' then
   if not (khpos_private.report_reviewer(p_actor,n.id) or (n.occurrence_key like 'log:%' and khpos_private.report_owner(p_actor,n.id))) then raise exception 'A recurring report can only be waived by its designated reviewer.'; end if;
   if n.status not in ('draft','returned','submitted') or length(v_note)<5 then raise exception 'Explain why this open report is being withdrawn.'; end if;
   update public.khpos_reports set status='withdrawn',review_note=v_note,lock_version=lock_version+1,updated_at=now() where id=n.id returning * into n;
  elsif p_mode in ('save','submit') then
   if not khpos_private.report_owner(p_actor,n.id) then raise exception 'Only the current report owner can change this report.'; end if;
    if n.status not in ('draft','returned') then raise exception 'Only a draft or returned report can be edited. Ask its reviewer to return a submitted report.'; end if;
    if jsonb_typeof(p_input->'payload') is distinct from 'object' or length((p_input->'payload')::text)>100000 then raise exception 'Report must be an object under 100 KB.'; end if;
    if p_mode='submit' then perform khpos_private.report_validate_fields(n.fields,p_input->'payload'); end if;
    update public.khpos_reports set payload=p_input->'payload',status=case when p_mode='submit' then 'submitted' else n.status end,revision=revision+case when p_mode='submit' then 1 else 0 end,submitted_at=case when p_mode='submit' then now() else submitted_at end,review_note=case when p_mode='submit' then null else review_note end,reviewed_at=case when p_mode='submit' then null else reviewed_at end,reviewed_by=case when p_mode='submit' then null else reviewed_by end,lock_version=lock_version+1,updated_at=now() where id=n.id returning * into n;
  elsif p_mode in ('accept','return') then
   if not khpos_private.report_reviewer(p_actor,n.id) then raise exception 'Only the designated reviewer can review this report; self-review is not permitted.'; end if;
   if n.status<>'submitted' and not (p_mode='return' and n.status='accepted') then raise exception 'Only a submitted report can be reviewed; accepted reports can be returned for correction.'; end if;
   if p_mode='return' and length(v_note)<5 then raise exception 'Explain the correction required.'; end if;
   update public.khpos_reports set status=case when p_mode='accept' then 'accepted' else 'returned' end,review_note=nullif(v_note,''),reviewed_by=p_actor,reviewed_at=now(),lock_version=lock_version+1,updated_at=now() where id=n.id returning * into n;
  else raise exception 'Unsupported report action.';
  end if;
 end if;
 insert into public.khpos_report_events(school_id,report_id,type_id,actor_id,action,revision,snapshot,note) values(p_school,n.id,n.type_id,p_actor,p_mode,n.revision,to_jsonb(n),v_note);
 return n.id;
end $$;

create function public.khpos_reports_workspace_server(p_actor uuid,p_school uuid,p_query text default '',p_status text default '',p_offset integer default 0,p_report uuid default null,p_type uuid default null,p_from date default null,p_to date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.'; end if;
 perform public.khpos_reports_sync_server(p_school);
 with visible as (
  select n.*,khpos_private.report_owner(p_actor,n.id) as "canEdit",khpos_private.report_reviewer(p_actor,n.id) as "canReview",
   (n.status in ('draft','returned') and n.due_at<now()) as overdue,
   coalesce((select min(st.display_name) from public.khpos_ops_staff st where st.user_id=n.owner_user_id and st.organisation_id=p_school),'School leader') as "ownerName",
   (select r.title from public.khpos_ops_roles r where r.id=n.reviewer_role_id) as "reviewerTitle",
   (select c.name from public.khpos_ops_campuses c where c.id=n.campus_id) as "campusName",
   exists(select 1 from public.khpos_ops_role_assignments ra where ra.role_id=n.reviewer_role_id and ra.user_id<>n.owner_user_id and khpos_private.report_assignment_active(ra.id,p_school) and (ra.campus_id is null or ra.campus_id=n.campus_id) and (ra.unit_id is null or ra.unit_id=n.unit_id)) as "reviewerAvailable"
  from public.khpos_reports n where n.school_id=p_school and (khpos_private.report_owner(p_actor,n.id) or khpos_private.report_reviewer(p_actor,n.id))
 ), filtered as (
  select * from visible n where (p_status='' or (p_status='reminder' and n.status in ('draft','returned') and (n.status='returned' or n.due_at<=now()+interval '1 day')) or (p_status='overdue' and n.overdue) or (p_status='review' and n."canReview" and n.status='submitted') or n.status=p_status)
  and (p_report is null or n.id=p_report) and (p_type is null or n.type_id=p_type) and (p_from is null or n.period_end>=p_from) and (p_to is null or n.period_start<=p_to) and (coalesce(p_query,'')='' or n.title ilike '%'||left(p_query,160)||'%' or n."ownerName" ilike '%'||left(p_query,160)||'%')
 ), page as (select * from filtered order by case when status='returned' then 0 when status='submitted' and "canReview" then 1 when overdue then 2 when status='draft' then 3 else 4 end,case when status in ('draft','returned','submitted') then due_at end asc,due_at desc,id limit 50 offset greatest(0,least(coalesce(p_offset,0),100000)))
 select jsonb_build_object(
 'items',coalesce((select jsonb_agg(to_jsonb(page)-'reviewed_by') from page),'[]'::jsonb),
 'total',(select count(*) from filtered),
 'summary',jsonb_build_object('open',(select count(*) from visible where "canEdit" and status in ('draft','returned')),'overdue',(select count(*) from visible where "canEdit" and overdue),'review',(select count(*) from visible where "canReview" and status='submitted')),
 'types',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('scopeLabel',coalesce((select c.name from public.khpos_ops_campuses c where c.id=t.campus_id),'Whole school')||coalesce(' · '||(select u.name from public.khpos_ops_units u where u.id=t.unit_id),''),'canManage',khpos_private.announcements_publish_scope(p_actor,p_school,t.campus_id,t.unit_id),'stats',case when khpos_private.announcements_publish_scope(p_actor,p_school,t.campus_id,t.unit_id) then (select jsonb_build_object('open',count(*) filter(where status in ('draft','returned')),'overdue',count(*) filter(where status in ('draft','returned') and due_at<now()),'submitted',count(*) filter(where status='submitted'),'accepted',count(*) filter(where status='accepted'),'withdrawn',count(*) filter(where status='withdrawn')) from public.khpos_reports where type_id=t.id) else null end,'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',r.title||coalesce(' · '||c.name,''))) from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id left join public.khpos_ops_campuses c on c.id=a.campus_id where a.user_id=p_actor and a.role_id=t.owner_role_id and khpos_private.report_assignment_active(a.id,p_school) and (t.campus_id is null or a.campus_id=t.campus_id) and (t.unit_id is null or a.unit_id=t.unit_id)),'[]'::jsonb))) from public.khpos_report_types t where t.school_id=p_school and (khpos_private.announcements_publish_scope(p_actor,p_school,t.campus_id,t.unit_id) or (exists(select 1 from public.khpos_ops_role_assignments a where a.user_id=p_actor and a.role_id=t.owner_role_id and khpos_private.report_assignment_active(a.id,p_school) and (t.campus_id is null or a.campus_id=t.campus_id) and (t.unit_id is null or a.unit_id=t.unit_id))))),'[]'::jsonb),
 'scopes',coalesce((select jsonb_agg(x) from (
 select null::uuid as "campusId",null::uuid as "unitId",'Whole school' as label where khpos_private.announcements_publish_scope(p_actor,p_school,null,null)
 union all select c.id,null,c.name from public.khpos_ops_campuses c where c.organisation_id=p_school and c.status='active' and khpos_private.announcements_publish_scope(p_actor,p_school,c.id,null)
 union all select u.campus_id,u.id,c.name||' · '||u.name from public.khpos_ops_units u join public.khpos_ops_campuses c on c.id=u.campus_id where u.organisation_id=p_school and u.status='active' and c.status='active' and khpos_private.announcements_publish_scope(p_actor,p_school,u.campus_id,u.id)) x),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title)) from public.khpos_ops_roles r where r.organisation_id=p_school and r.status='active'),'[]'::jsonb),
 'history',case when p_report is not null and exists(select 1 from visible where id=p_report) then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'revision',e.revision,'note',e.note,'at',e.created_at,'payload',e.snapshot->'payload')) from public.khpos_report_events e where e.report_id=p_report and e.action<>'save'),'[]'::jsonb) else '[]'::jsonb end
 ) into result;
 return result;
end $$;
-- Compact Today/notification feed: never sends report answers or form definitions.
create function public.khpos_report_attention_server(p_actor uuid,p_school uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.'; end if;
 perform public.khpos_reports_sync_server(p_school);
 with visible as (
  select n.id,n.status,n.lock_version,n.due_at,n.submitted_at,khpos_private.report_owner(p_actor,n.id) as owned,khpos_private.report_reviewer(p_actor,n.id) as review
  from public.khpos_reports n where n.school_id=p_school and n.status in ('draft','returned','submitted')
 ), actions as (
 select id,status,lock_version,due_at,submitted_at,owned as "canEdit",review as "canReview",due_at<now() as overdue from visible
 where (owned and status in ('draft','returned') and (due_at<=now()+interval '1 day' or status='returned')) or (review and status='submitted')
 order by due_at,id limit 100
 ) select jsonb_build_object('summary',jsonb_build_object('open',(select count(*) from visible where owned and status in ('draft','returned')),'overdue',(select count(*) from visible where owned and status in ('draft','returned') and due_at<now()),'review',(select count(*) from visible where review and status='submitted')),'items',coalesce((select jsonb_agg(actions) from actions),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.khpos_report_attention_server(uuid,uuid) from public,anon,authenticated;
grant execute on function public.khpos_report_attention_server(uuid,uuid) to service_role;

revoke all on function khpos_private.report_assignment_active(uuid,uuid),khpos_private.report_owner(uuid,uuid),khpos_private.report_reviewer(uuid,uuid),khpos_private.report_validate_fields(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.khpos_reports_sync_server(uuid),public.khpos_report_action_server(uuid,uuid,text,jsonb),public.khpos_reports_workspace_server(uuid,uuid,text,text,integer,uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function public.khpos_reports_sync_server(uuid),public.khpos_report_action_server(uuid,uuid,text,jsonb),public.khpos_reports_workspace_server(uuid,uuid,text,text,integer,uuid,uuid,date,date) to service_role;
