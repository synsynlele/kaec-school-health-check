-- Explicit report recipients; existing types retain their role-based audience.
alter table public.khpos_report_types add column audience_mode text not null default 'all_role' check(audience_mode in ('all_role','selected')),
 add column audience_assignment_ids uuid[] not null default '{}';

create function khpos_private.report_audience(p_type uuid,p_assignment uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.khpos_report_types t join public.khpos_ops_role_assignments a on a.id=p_assignment
 where t.id=p_type and a.role_id=t.owner_role_id and khpos_private.report_assignment_active(a.id,t.school_id)
 and (t.campus_id is null or a.campus_id=t.campus_id) and (t.unit_id is null or a.unit_id=t.unit_id)
 and (t.audience_mode='all_role' or a.id=any(t.audience_assignment_ids)));
$$;
revoke all on function khpos_private.report_audience(uuid,uuid) from public,anon,authenticated;

-- Authors retain their submitted history after being removed from a future audience.
create function khpos_private.report_read_owner(p_actor uuid,p_report uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.khpos_reports n join public.khpos_ops_role_assignments a on a.id=n.owner_assignment_id
 where n.id=p_report and a.user_id=p_actor and n.owner_user_id=p_actor and khpos_private.report_assignment_active(a.id,n.school_id)
 and a.campus_id is not distinct from n.campus_id and a.unit_id is not distinct from n.unit_id
 and (n.submitted_at is not null or khpos_private.report_audience(n.type_id,a.id)));
$$;
revoke all on function khpos_private.report_read_owner(uuid,uuid) from public,anon,authenticated;

-- Keep scope-based withdrawal authority separate from permission to read answers.
create function khpos_private.report_review_route(p_actor uuid,p_report uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.khpos_reports n join public.khpos_ops_role_assignments a on a.role_id=n.reviewer_role_id
 where n.id=p_report and a.user_id=p_actor and n.owner_user_id<>p_actor and khpos_private.report_assignment_active(a.id,n.school_id)
 and (a.campus_id is null or a.campus_id=n.campus_id) and (a.unit_id is null or a.unit_id=n.unit_id));
$$;
revoke all on function khpos_private.report_review_route(uuid,uuid) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION khpos_private.report_reviewer(p_actor uuid, p_report uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.khpos_reports n join public.khpos_ops_role_assignments owner_a on owner_a.id=n.owner_assignment_id
 join public.khpos_ops_role_assignments a on a.role_id=n.reviewer_role_id
 where n.id=p_report and n.submitted_at is not null and n.status in ('submitted','accepted','withdrawn') and a.user_id=p_actor and n.owner_user_id<>p_actor
 and khpos_private.report_assignment_active(a.id,n.school_id)
 and (a.campus_id is null or a.campus_id=n.campus_id) and (a.unit_id is null or a.unit_id=n.unit_id))
$function$;

CREATE OR REPLACE FUNCTION public.khpos_reports_sync_server(p_school uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.khpos_report_types%rowtype; d date; e date; last_start date; term_row record; steps integer; today date:=(now() at time zone 'Africa/Lagos')::date;
begin
 for t in select * from public.khpos_report_types where school_id=p_school and status='active' and cadence<>'one_off' and next_date<=today for update loop
  d:=t.next_date; last_start:=d; steps:=0;
  if t.cadence='termly' then
   for term_row in select * from public.khpos_ops_academic_terms at where at.organisation_id=p_school and at.status in ('active','closed') and at.start_date<=today and at.end_date>=t.next_date and (t.end_date is null or at.start_date<=t.end_date) and (at.campus_id is null or at.campus_id=t.campus_id) loop
    insert into public.khpos_reports(school_id,type_id,owner_assignment_id,owner_user_id,campus_id,unit_id,reviewer_role_id,title,instructions,fields,type_version,occurrence_key,period_start,period_end,due_at)
    select t.school_id,t.id,a.id,a.user_id,a.campus_id,a.unit_id,t.reviewer_role_id,t.title,t.instructions,t.fields,t.version,'term:'||term_row.id,term_row.start_date,term_row.end_date,((term_row.end_date+t.due_days)+t.due_time) at time zone 'Africa/Lagos'
    from public.khpos_ops_role_assignments a where a.role_id=t.owner_role_id and khpos_private.report_assignment_active(a.id,p_school) and khpos_private.report_audience(t.id,a.id)
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
   from public.khpos_ops_role_assignments a where a.role_id=t.owner_role_id and khpos_private.report_assignment_active(a.id,p_school) and khpos_private.report_audience(t.id,a.id)
   and (t.campus_id is null or a.campus_id=t.campus_id) and (t.unit_id is null or a.unit_id=t.unit_id) and (a.start_date is null or a.start_date<=e)
   on conflict(type_id,owner_assignment_id,occurrence_key) do nothing;
   last_start:=d; d:=e+1; steps:=steps+1;
  end loop;
  update public.khpos_report_types set next_date=case when d>today then last_start else d end where id=t.id;
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.khpos_reports_workspace_server(p_actor uuid, p_school uuid, p_query text DEFAULT ''::text, p_status text DEFAULT ''::text, p_offset integer DEFAULT 0, p_report uuid DEFAULT NULL::uuid, p_type uuid DEFAULT NULL::uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; v_view text:='mine'; v_status text:=coalesce(p_status,'');
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.'; end if;
 if v_status like 'mine:%' then v_status:=substr(v_status,6); elsif v_status like 'reviewer:%' then v_view:='reviewer'; v_status:=substr(v_status,10); elsif v_status='review' then v_view:='reviewer'; end if;
 perform public.khpos_reports_sync_server(p_school);
 with visible as (
  select n.*,khpos_private.report_read_owner(p_actor,n.id) as "isMine",khpos_private.report_owner(p_actor,n.id) as "canEdit",khpos_private.report_reviewer(p_actor,n.id) as "canReview",
   (n.status in ('draft','returned') and n.due_at<now()) as overdue,
   coalesce((select min(st.display_name) from public.khpos_ops_staff st where st.user_id=n.owner_user_id and st.organisation_id=p_school),'School leader') as "ownerName",
   (select r.title from public.khpos_ops_roles r where r.id=n.reviewer_role_id) as "reviewerTitle",
   (select c.name from public.khpos_ops_campuses c where c.id=n.campus_id) as "campusName",
   exists(select 1 from public.khpos_ops_role_assignments ra where ra.role_id=n.reviewer_role_id and ra.user_id<>n.owner_user_id and khpos_private.report_assignment_active(ra.id,p_school) and (ra.campus_id is null or ra.campus_id=n.campus_id) and (ra.unit_id is null or ra.unit_id=n.unit_id)) as "reviewerAvailable"
  from public.khpos_reports n where n.school_id=p_school and (khpos_private.report_read_owner(p_actor,n.id) or khpos_private.report_reviewer(p_actor,n.id))
 ), filtered as (
  select * from visible n where (p_report is not null or (v_view='mine' and n."isMine") or (v_view='reviewer' and n."canReview")) and (v_status='' or (v_status='reminder' and n.status in ('draft','returned') and (n.status='returned' or n.due_at<=now()+interval '1 day')) or (v_status='overdue' and n.overdue) or (v_status='review' and n."canReview" and n.status='submitted') or n.status=v_status)
  and (p_report is null or n.id=p_report) and (p_type is null or n.type_id=p_type) and (p_from is null or n.period_end>=p_from) and (p_to is null or n.period_start<=p_to) and (coalesce(p_query,'')='' or n.title ilike '%'||left(p_query,160)||'%' or n."ownerName" ilike '%'||left(p_query,160)||'%')
 ), page as (select * from filtered order by case when status='returned' then 0 when status='submitted' and "canReview" then 1 when overdue then 2 when status='draft' then 3 else 4 end,case when status in ('draft','returned','submitted') then due_at end asc,due_at desc,id limit 50 offset greatest(0,least(coalesce(p_offset,0),100000)))
 select jsonb_build_object(
 'items',coalesce((select jsonb_agg(to_jsonb(page)-'reviewed_by') from page),'[]'::jsonb),
 'total',(select count(*) from filtered),
 'summary',jsonb_build_object('open',(select count(*) from visible where "canEdit" and status in ('draft','returned')),'overdue',(select count(*) from visible where "canEdit" and overdue),'review',(select count(*) from visible where "canReview" and status='submitted')),
 'types',coalesce((select jsonb_agg((case when khpos_private.announcements_publish_scope(p_actor,p_school,t.campus_id,t.unit_id) then to_jsonb(t) else to_jsonb(t)-'audience_assignment_ids' end)||jsonb_build_object('scopeLabel',coalesce((select c.name from public.khpos_ops_campuses c where c.id=t.campus_id),'Whole school')||coalesce(' · '||(select u.name from public.khpos_ops_units u where u.id=t.unit_id),''),'canManage',khpos_private.announcements_publish_scope(p_actor,p_school,t.campus_id,t.unit_id),'stats',case when khpos_private.announcements_publish_scope(p_actor,p_school,t.campus_id,t.unit_id) then (select jsonb_build_object('open',count(*) filter(where status in ('draft','returned')),'overdue',count(*) filter(where status in ('draft','returned') and due_at<now()),'submitted',count(*) filter(where status='submitted'),'accepted',count(*) filter(where status='accepted'),'withdrawn',count(*) filter(where status='withdrawn')) from public.khpos_reports where type_id=t.id and (submitted_at is not null or khpos_private.report_audience(t.id,owner_assignment_id))) else null end,'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',r.title||coalesce(' · '||c.name,''))) from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id left join public.khpos_ops_campuses c on c.id=a.campus_id where a.user_id=p_actor and a.role_id=t.owner_role_id and khpos_private.report_assignment_active(a.id,p_school) and khpos_private.report_audience(t.id,a.id) and (t.campus_id is null or a.campus_id=t.campus_id) and (t.unit_id is null or a.unit_id=t.unit_id)),'[]'::jsonb))) from public.khpos_report_types t where t.school_id=p_school and (khpos_private.announcements_publish_scope(p_actor,p_school,t.campus_id,t.unit_id) or (exists(select 1 from public.khpos_ops_role_assignments a where a.user_id=p_actor and a.role_id=t.owner_role_id and khpos_private.report_assignment_active(a.id,p_school) and khpos_private.report_audience(t.id,a.id) and (t.campus_id is null or a.campus_id=t.campus_id) and (t.unit_id is null or a.unit_id=t.unit_id))))),'[]'::jsonb),
 'scopes',coalesce((select jsonb_agg(x) from (
 select null::uuid as "campusId",null::uuid as "unitId",'Whole school' as label where khpos_private.announcements_publish_scope(p_actor,p_school,null,null)
 union all select c.id,null,c.name from public.khpos_ops_campuses c where c.organisation_id=p_school and c.status='active' and khpos_private.announcements_publish_scope(p_actor,p_school,c.id,null)
 union all select u.campus_id,u.id,c.name||' · '||u.name from public.khpos_ops_units u join public.khpos_ops_campuses c on c.id=u.campus_id where u.organisation_id=p_school and u.status='active' and c.status='active' and khpos_private.announcements_publish_scope(p_actor,p_school,u.campus_id,u.id)) x),'[]'::jsonb),
 'recipients',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'roleId',r.id,'campusId',a.campus_id,'unitId',a.unit_id,'label',coalesce(st.display_name,'School leader')||' — '||r.title||coalesce(' · '||c.name,'')))
 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
 left join public.khpos_ops_staff st on st.user_id=a.user_id and st.organisation_id=p_school and st.status='active'
 left join public.khpos_ops_campuses c on c.id=a.campus_id
 where r.organisation_id=p_school and khpos_private.report_assignment_active(a.id,p_school)
 and khpos_private.announcements_publish_scope(p_actor,p_school,a.campus_id,a.unit_id)), '[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title)) from public.khpos_ops_roles r where r.organisation_id=p_school and r.status='active'),'[]'::jsonb),
 'history',case when p_report is not null and exists(select 1 from visible where id=p_report) then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'revision',e.revision,'note',e.note,'at',e.created_at,'payload',e.snapshot->'payload')) from public.khpos_report_events e where e.report_id=p_report and e.action<>'save'),'[]'::jsonb) else '[]'::jsonb end
 ) into result;
 return result;
end $function$;

CREATE OR REPLACE FUNCTION public.khpos_report_action_server(p_actor uuid, p_school uuid, p_mode text, p_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.khpos_report_types%rowtype; n public.khpos_reports%rowtype; a public.khpos_ops_role_assignments%rowtype;
 v_id uuid:=nullif(p_input->>'id','')::uuid; c uuid:=nullif(p_input->>'campusId','')::uuid; u uuid:=nullif(p_input->>'unitId','')::uuid;
 v_note text:=btrim(coalesce(p_input->>'note','')); today date:=(now() at time zone 'Africa/Lagos')::date; v_audience text; v_ids uuid[];
begin
 if p_school is null or not khpos_private.ops_hpd_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.'; end if;
 if p_mode in ('type_save','type_status') then
  if v_id is not null then
   select * into t from public.khpos_report_types where id=v_id and school_id=p_school for update;
   if not found or not khpos_private.announcements_publish_scope(p_actor,p_school,t.campus_id,t.unit_id) then raise exception 'Report type is outside your management authority.'; end if;
   if nullif(p_input->>'version','')::integer is distinct from t.version then raise exception 'Report type changed. Refresh before editing.'; end if;
  end if;
  if p_mode='type_status' then
   if p_input->>'status'='active' and t.audience_mode='selected' and cardinality(t.audience_assignment_ids)=0 then raise exception 'Select the intended staff in Edit form and audience before activating this report.'; end if;
   if t.id is null or p_input->>'status' not in ('active','paused','archived') or length(v_note)<5 then raise exception 'Choose a status and explain the change.'; end if;
   update public.khpos_report_types set status=p_input->>'status',version=version+1,updated_at=now(),next_date=case when p_input->>'status'='active' and t.status<>'active' and today>t.start_date then case t.cadence when 'daily' then today when 'weekly' then t.start_date+((today-t.start_date)/7)*7 when 'monthly' then greatest(t.start_date,date_trunc('month',today)::date) when 'quarterly' then greatest(t.start_date,date_trunc('quarter',today)::date) when 'yearly' then greatest(t.start_date,date_trunc('year',today)::date) when 'custom_days' then t.start_date+((today-t.start_date)/t.interval_days)*t.interval_days else today end else next_date end where id=t.id returning * into t;
  else
   if not khpos_private.announcements_publish_scope(p_actor,p_school,c,u) then raise exception 'Your active role cannot manage this school/campus/section.'; end if;
   if c is not null and not exists(select 1 from public.khpos_ops_campuses where id=c and organisation_id=p_school and status='active') then raise exception 'Select an active campus in this school.'; end if;
   if u is not null and not exists(select 1 from public.khpos_ops_units where id=u and organisation_id=p_school and campus_id=c and status='active') then raise exception 'Select a section within this campus.'; end if;
   if length(btrim(coalesce(p_input->>'title',''))) not between 3 and 160 or length(coalesce(p_input->>'instructions',''))>6000 then raise exception 'Use a title of 3–160 characters and instructions under 6,000 characters.'; end if;
   if not exists(select 1 from public.khpos_ops_roles where id=(p_input->>'ownerRoleId')::uuid and organisation_id=p_school and status='active') or not exists(select 1 from public.khpos_ops_roles where id=(p_input->>'reviewerRoleId')::uuid and organisation_id=p_school and status='active') then raise exception 'Select active school roles for the owner and reviewer.'; end if;
   v_audience:=coalesce(p_input->>'audienceMode',t.audience_mode,'all_role');
   if v_audience not in ('all_role','selected') then raise exception 'Choose all matching positions or selected staff.'; end if;
   if p_input ? 'audienceAssignmentIds' then
    if jsonb_typeof(p_input->'audienceAssignmentIds') is distinct from 'array' or jsonb_array_length(p_input->'audienceAssignmentIds')>500 then raise exception 'Choose up to 500 valid staff positions.'; end if;
    select coalesce(array_agg(distinct x::uuid),'{}'::uuid[]) into v_ids from jsonb_array_elements_text(p_input->'audienceAssignmentIds') x;
   else v_ids:=coalesce(t.audience_assignment_ids,'{}'::uuid[]); end if;
   if v_audience='selected' then
    if cardinality(v_ids)=0 then raise exception 'Select at least one intended staff position.'; end if;
    if exists(select 1 from unnest(v_ids) chosen where chosen is null or not exists(select 1 from public.khpos_ops_role_assignments aa where aa.id=chosen and aa.role_id=(p_input->>'ownerRoleId')::uuid and khpos_private.report_assignment_active(aa.id,p_school) and (c is null or aa.campus_id=c) and (u is null or aa.unit_id=u))) then raise exception 'Selected staff must hold an active submitter position within this school and report scope.'; end if;
   else v_ids:='{}'::uuid[]; end if;
   perform khpos_private.report_validate_fields(p_input->'fields');
   if t.id is not null then
    if length(v_note)<5 then raise exception 'Explain the report type change.'; end if;
    -- Cadence/scope changes are new types: keeps existing deadlines/ownership intelligible.
    if t.cadence is distinct from p_input->>'cadence' or t.campus_id is distinct from c or t.unit_id is distinct from u or t.owner_role_id is distinct from (p_input->>'ownerRoleId')::uuid or t.reviewer_role_id is distinct from (p_input->>'reviewerRoleId')::uuid or t.start_date is distinct from (p_input->>'startDate')::date or t.interval_days is distinct from coalesce((p_input->>'intervalDays')::integer,14) then raise exception 'Create a new report type to change its schedule, role, scope or reviewer. Pause the old type first.'; end if;
    update public.khpos_report_types set audience_mode=v_audience,audience_assignment_ids=v_ids,title=btrim(p_input->>'title'),instructions=coalesce(p_input->>'instructions',''),fields=p_input->'fields',due_days=(p_input->>'dueDays')::integer,due_time=(p_input->>'dueTime')::time,end_date=nullif(p_input->>'endDate','')::date,version=version+1,updated_at=now() where id=t.id returning * into t;
   else
    if (p_input->>'startDate')::date not between today-31 and today+366 then raise exception 'Start within the last 31 days or the next year.'; end if;
    insert into public.khpos_report_types(school_id,campus_id,unit_id,title,instructions,owner_role_id,reviewer_role_id,cadence,interval_days,start_date,next_date,end_date,due_days,due_time,fields,created_by,audience_mode,audience_assignment_ids)
    values(p_school,c,u,btrim(p_input->>'title'),coalesce(p_input->>'instructions',''),(p_input->>'ownerRoleId')::uuid,(p_input->>'reviewerRoleId')::uuid,p_input->>'cadence',coalesce((p_input->>'intervalDays')::integer,14),(p_input->>'startDate')::date,(p_input->>'startDate')::date,nullif(p_input->>'endDate','')::date,(p_input->>'dueDays')::integer,(p_input->>'dueTime')::time,p_input->'fields',p_actor,v_audience,v_ids) returning * into t;
   end if;
  end if;
  insert into public.khpos_report_events(school_id,type_id,actor_id,action,snapshot,note) values(p_school,t.id,p_actor,p_mode,to_jsonb(t),v_note);
  perform public.khpos_reports_sync_server(p_school); return t.id;
 elsif p_mode='create' then
  select * into t from public.khpos_report_types where id=(p_input->>'typeId')::uuid and school_id=p_school and status='active';
  select * into a from public.khpos_ops_role_assignments where id=(p_input->>'assignmentId')::uuid and user_id=p_actor;
  if t.id is null or a.id is null or a.role_id<>t.owner_role_id or not khpos_private.report_audience(t.id,a.id) or not khpos_private.report_assignment_active(a.id,p_school) or (t.campus_id is not null and a.campus_id is distinct from t.campus_id) or (t.unit_id is not null and a.unit_id is distinct from t.unit_id) then raise exception 'This report type is not available to your active position.'; end if;
  if t.cadence<>'one_off' then raise exception 'Recurring reports are generated automatically. Open your assigned period report.'; end if;
  if (p_input->>'periodEnd')::date<(p_input->>'periodStart')::date then raise exception 'Period end cannot precede period start.'; end if;
  insert into public.khpos_reports(school_id,type_id,owner_assignment_id,owner_user_id,campus_id,unit_id,reviewer_role_id,title,instructions,fields,type_version,occurrence_key,period_start,period_end,due_at)
  values(p_school,t.id,a.id,a.user_id,a.campus_id,a.unit_id,t.reviewer_role_id,t.title,t.instructions,t.fields,t.version,'log:'||gen_random_uuid(),(p_input->>'periodStart')::date,(p_input->>'periodEnd')::date,(((p_input->>'periodEnd')::date+t.due_days)+t.due_time) at time zone 'Africa/Lagos') returning * into n;
 else
  select * into n from public.khpos_reports where id=v_id and school_id=p_school for update;
  if not found then raise exception 'Report not found.'; end if;
  if nullif(p_input->>'lockVersion','')::integer is distinct from n.lock_version then raise exception 'Report changed. Refresh to avoid overwriting another action.'; end if;
  if p_mode='withdraw' then
   if not (khpos_private.report_review_route(p_actor,n.id) or (n.occurrence_key like 'log:%' and khpos_private.report_owner(p_actor,n.id))) then raise exception 'A recurring report can only be waived by its designated reviewer.'; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.khpos_report_attention_server(p_actor uuid, p_school uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION khpos_private.report_owner(p_actor uuid, p_report uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.khpos_reports n join public.khpos_ops_role_assignments a on a.id=n.owner_assignment_id
 where n.id=p_report and a.user_id=p_actor and n.owner_user_id=p_actor and khpos_private.report_assignment_active(a.id,n.school_id)
 and khpos_private.report_audience(n.type_id,a.id) and a.campus_id is not distinct from n.campus_id and a.unit_id is not distinct from n.unit_id)
$function$;

revoke all on function public.khpos_reports_sync_server(uuid),public.khpos_report_action_server(uuid,uuid,text,jsonb),public.khpos_reports_workspace_server(uuid,uuid,text,text,integer,uuid,uuid,date,date),public.khpos_report_attention_server(uuid,uuid) from public,anon,authenticated;
grant execute on function public.khpos_reports_sync_server(uuid),public.khpos_report_action_server(uuid,uuid,text,jsonb),public.khpos_reports_workspace_server(uuid,uuid,text,text,integer,uuid,uuid,date,date),public.khpos_report_attention_server(uuid,uuid) to service_role;
