create table public.khpos_announcements (
 id uuid primary key default gen_random_uuid(), school_id uuid references public.organisations(id),
 all_schools boolean not null default false, school_ids uuid[] not null default '{}',
 campus_id uuid references public.khpos_ops_campuses(id), unit_id uuid references public.khpos_ops_units(id), role_codes text[] not null default '{}',
 title text not null check(length(btrim(title)) between 3 and 160), message text not null check(length(btrim(message)) between 10 and 10000),
 document_url text check(document_url is null or (length(document_url)<=2000 and document_url ~ '^https://[^[:space:]]+$')),
 task_url text check(task_url is null or (length(task_url)<=2000 and task_url ~ '^/khpos/')),
 priority text not null check(priority in ('normal','important','urgent')), requires_ack boolean not null default false,
 status text not null default 'draft' check(status in ('draft','published','withdrawn')), revision integer not null default 1,
 publish_at timestamptz not null default now(), expires_at timestamptz not null,
 created_by uuid not null references auth.users(id), publisher_name text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(expires_at>publish_at), check(unit_id is null or campus_id is not null),
 check((school_id is not null and not all_schools and cardinality(school_ids)=0) or (school_id is null and campus_id is null and unit_id is null and (all_schools or cardinality(school_ids)>0)))
);
create index on public.khpos_announcements(school_id,status,publish_at desc);
create index on public.khpos_announcements(status,publish_at,expires_at) where status='published';
create index on public.khpos_announcements(created_by);
create index on public.khpos_announcements(campus_id);
create index on public.khpos_announcements(unit_id);
create table public.khpos_announcement_versions (
 announcement_id uuid not null references public.khpos_announcements(id), revision integer not null,
 snapshot jsonb not null, change_note text not null, changed_by uuid not null references auth.users(id), changed_at timestamptz not null default now(),
 primary key(announcement_id,revision)
);
create index on public.khpos_announcement_versions(changed_by);
create table public.khpos_announcement_receipts (
 announcement_id uuid not null references public.khpos_announcements(id), revision integer not null, school_id uuid not null references public.organisations(id),
 user_id uuid not null references auth.users(id), first_available_at timestamptz not null default now(), read_at timestamptz, acknowledged_at timestamptz,
 primary key(announcement_id,revision,school_id,user_id)
);
create index on public.khpos_announcement_receipts(school_id,user_id);
create index on public.khpos_announcement_receipts(user_id);
alter table public.khpos_announcements enable row level security;
alter table public.khpos_announcement_versions enable row level security;
alter table public.khpos_announcement_receipts enable row level security;
revoke all on public.khpos_announcements,public.khpos_announcement_versions,public.khpos_announcement_receipts from public,anon,authenticated;
grant select,insert,update on public.khpos_announcements,public.khpos_announcement_receipts to service_role;
grant select,insert on public.khpos_announcement_versions to service_role;

create function khpos_private.announcements_admin(p_actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.khpos_platform_admins where user_id=p_actor and status='active' and platform_role in ('super_admin','portfolio_admin'));
$$;
create function khpos_private.announcements_publish_scope(p_actor uuid,p_school uuid,p_campus uuid,p_unit uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when p_school is null then khpos_private.announcements_admin(p_actor)
 else khpos_private.ops_hpd_has_membership(p_actor,p_school) and exists(
 select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.user_id=p_actor and a.status='active' and r.status='active' and r.organisation_id=p_school and (
 (r.code='SCHOOL_CUSTODIAN' and a.campus_id is null and a.unit_id is null)
 or (r.code='SCHOOL_GUARDIAN' and a.unit_id is null and (a.campus_id is null or a.campus_id=p_campus))
 or (r.code in ('SECTIONAL_PROMOTER','ACADEMIC_INSPECTOR','SKILL_INSPECTOR') and p_unit is not null and a.unit_id=p_unit and a.campus_id=p_campus)
 )) end;
$$;
create function khpos_private.announcement_recipient(p_user uuid,p_school uuid,p_notice uuid) returns boolean language sql stable security definer set search_path='' as $$
 select khpos_private.ops_hpd_has_membership(p_user,p_school) and exists(
 select 1 from public.khpos_announcements n
 join public.khpos_ops_role_assignments a on a.user_id=p_user and a.status='active'
 join public.khpos_ops_roles r on r.id=a.role_id and r.organisation_id=p_school and r.status='active'
 where (exists(select 1 from public.khpos_ops_staff st where st.organisation_id=p_school and st.user_id=p_user and st.status='active') or (r.code='SCHOOL_CUSTODIAN' and not exists(select 1 from public.khpos_ops_staff st where st.organisation_id=p_school and st.user_id=p_user)))
 and n.id=p_notice and (n.school_id=p_school or (n.school_id is null and (n.all_schools or p_school=any(n.school_ids))))
 and (n.campus_id is null or a.campus_id=n.campus_id or a.campus_id is null)
 and (n.unit_id is null or a.unit_id=n.unit_id or (a.unit_id is null and r.code in ('SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN')))
 and (cardinality(n.role_codes)=0 or r.code=any(n.role_codes))
 );
$$;
-- Scheduled notices become available through the existing feed/push scheduler.
-- No email, SMS or device transmission occurs in this function.
create function public.khpos_announcements_sync_server(p_school uuid default null) returns void language sql security definer set search_path='' as $$
 insert into public.khpos_announcement_receipts(announcement_id,revision,school_id,user_id)
 select distinct n.id,n.revision,st.organisation_id,st.user_id from public.khpos_announcements n
 join public.organisation_memberships st on st.status='active' and st.user_id is not null
 where n.status='published' and n.publish_at<=now() and n.expires_at>now()
 and (p_school is null or st.organisation_id=p_school)
 and (n.school_id=st.organisation_id or (n.school_id is null and (n.all_schools or st.organisation_id=any(n.school_ids))))
 and not exists(select 1 from public.khpos_announcement_receipts old where old.announcement_id=n.id and old.revision=n.revision and old.school_id=st.organisation_id and old.user_id=st.user_id)
 and khpos_private.announcement_recipient(st.user_id,st.organisation_id,n.id)
 on conflict do nothing;
$$;

create function public.khpos_announcement_action_server(p_actor uuid,p_school uuid,p_mode text,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare n public.khpos_announcements%rowtype; old_n public.khpos_announcements%rowtype; v_id uuid:=nullif(p_input->>'id','')::uuid;
 v_note text:=btrim(coalesce(p_input->>'changeNote','')); v_campus uuid:=nullif(p_input->>'campusId','')::uuid; v_unit uuid:=nullif(p_input->>'unitId','')::uuid;
 v_schools uuid[]; v_roles text[]; v_document text:=nullif(btrim(p_input->>'documentUrl'),''); v_task text:=nullif(btrim(p_input->>'taskUrl'),'');
begin
 if p_mode in ('read','acknowledge') then
  if p_school is null or not khpos_private.announcement_recipient(p_actor,p_school,v_id) then raise exception 'This announcement is not assigned to your current school role.'; end if;
  perform public.khpos_announcements_sync_server(p_school);
  select * into n from public.khpos_announcements where id=v_id and status='published' and publish_at<=now() for share;
  if not found then raise exception 'Announcement unavailable.'; end if;
  if nullif(p_input->>'revision','')::integer is distinct from n.revision then raise exception 'This announcement changed. Refresh and read the current revision first.'; end if;
  if p_mode='acknowledge' and (not n.requires_ack or n.expires_at<=now()) then raise exception 'This announcement is expired or does not require acknowledgement.'; end if;
  update public.khpos_announcement_receipts set read_at=coalesce(read_at,now()),acknowledged_at=case when p_mode='acknowledge' then coalesce(acknowledged_at,now()) else acknowledged_at end where announcement_id=n.id and revision=n.revision and school_id=p_school and user_id=p_actor;
  if not found then raise exception 'Announcement was not available to this staff account.'; end if;
  return n.id;
 end if;
 if v_id is not null then
  select * into old_n from public.khpos_announcements where id=v_id and school_id is not distinct from p_school for update;
  if not found or not khpos_private.announcements_publish_scope(p_actor,old_n.school_id,old_n.campus_id,old_n.unit_id) then raise exception 'Announcement is outside your publishing authority.'; end if;
  if old_n.status='withdrawn' then raise exception 'Withdrawn notices remain in history; create a new notice to publish again.'; end if;
 end if;
 if p_mode='withdraw' then
  if old_n.id is null or length(v_note)<10 then raise exception 'Select a notice and explain the withdrawal in at least 10 characters.'; end if;
  update public.khpos_announcements set status='withdrawn',revision=revision+1,updated_at=now() where id=v_id returning * into n;
 elsif p_mode in ('save','publish') then
  if not khpos_private.announcements_publish_scope(p_actor,p_school,v_campus,v_unit) then raise exception 'Your active school/campus/section role cannot publish to this audience.'; end if;
  if v_campus is not null and not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_school and status='active') then raise exception 'Choose an active campus in this school.'; end if;
  if v_unit is not null and not exists(select 1 from public.khpos_ops_units where id=v_unit and organisation_id=p_school and campus_id=v_campus and status='active') then raise exception 'Choose a section within the selected campus.'; end if;
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_schools from jsonb_array_elements_text(coalesce(p_input->'schoolIds','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_roles from jsonb_array_elements_text(coalesce(p_input->'roleCodes','[]'::jsonb));
  if p_school is null and not coalesce((p_input->>'allSchools')::boolean,false) and cardinality(v_schools)=0 then raise exception 'Select at least one school or choose all active approved schools.'; end if;
  if length(btrim(coalesce(p_input->>'title','')))<3 or length(btrim(p_input->>'title'))>160 then raise exception 'Enter a title between 3 and 160 characters.'; end if;
  if length(btrim(coalesce(p_input->>'message','')))<10 or length(btrim(p_input->>'message'))>10000 then raise exception 'Enter a message between 10 and 10000 characters.'; end if;
  if nullif(p_input->>'expiresAt','') is null or (p_input->>'expiresAt')::timestamptz<=coalesce(nullif(p_input->>'publishAt','')::timestamptz,now()) then raise exception 'Choose an expiry time after the publication time.'; end if;
  if length(v_note)>2000 then raise exception 'Keep the change note within 2000 characters.'; end if;
  if p_school is not null and cardinality(v_schools)>0 then raise exception 'School notices cannot target other institutions.'; end if;
  if exists(select 1 from unnest(v_schools) x(id) where not exists(select 1 from public.organisations o where o.id=x.id and o.status='active' and o.partner_status='active' and 'khpos_core'=any(o.partner_entitlements))) then raise exception 'Select only active approved schools.'; end if;
  if exists(select 1 from unnest(v_roles) x(code) where not exists(select 1 from public.khpos_ops_roles r where r.code=x.code and r.status='active' and (p_school is null or r.organisation_id=p_school))) then raise exception 'Choose existing active role codes.'; end if;
  if v_document is not null and (v_document !~ '^https://[^[:space:]]+$' or length(v_document)>2000) then raise exception 'Use a valid HTTPS document link.'; end if;
  if v_task is not null and (p_school is null or v_task not like '/khpos/'||p_school::text||'/work%' or length(v_task)>2000) then raise exception 'Use a task link from this school Today workspace.'; end if;
  if old_n.status='published' and length(v_note)<12 then raise exception 'Describe the published revision in at least 12 characters. Readers must acknowledge the new revision again.'; end if;
  if old_n.id is null then
   insert into public.khpos_announcements(school_id,all_schools,school_ids,campus_id,unit_id,role_codes,title,message,document_url,task_url,priority,requires_ack,status,publish_at,expires_at,created_by,publisher_name)
   values(p_school,coalesce((p_input->>'allSchools')::boolean,false),v_schools,v_campus,v_unit,v_roles,btrim(p_input->>'title'),btrim(p_input->>'message'),v_document,v_task,p_input->>'priority',coalesce((p_input->>'requiresAck')::boolean,false),case when p_mode='publish' then 'published' else 'draft' end,coalesce(nullif(p_input->>'publishAt','')::timestamptz,now()),(p_input->>'expiresAt')::timestamptz,p_actor,case when p_school is null then 'KAEC-NG administration' else coalesce((select display_name from public.khpos_ops_staff where user_id=p_actor and organisation_id=p_school and status='active' limit 1),'School leadership') end) returning * into n;
  else
   update public.khpos_announcements set all_schools=coalesce((p_input->>'allSchools')::boolean,false),school_ids=v_schools,campus_id=v_campus,unit_id=v_unit,role_codes=v_roles,title=btrim(p_input->>'title'),message=btrim(p_input->>'message'),document_url=v_document,task_url=v_task,priority=p_input->>'priority',requires_ack=coalesce((p_input->>'requiresAck')::boolean,false),status=case when p_mode='publish' or old_n.status='published' then 'published' else 'draft' end,publish_at=coalesce(nullif(p_input->>'publishAt','')::timestamptz,now()),expires_at=(p_input->>'expiresAt')::timestamptz,revision=revision+1,updated_at=now() where id=v_id returning * into n;
  end if;
  if n.status='published' and n.expires_at<=now() then raise exception 'Expiry must be in the future.'; end if;
 else raise exception 'Unsupported announcement action.';
 end if;
 insert into public.khpos_announcement_versions(announcement_id,revision,snapshot,change_note,changed_by) values(n.id,n.revision,to_jsonb(n),coalesce(nullif(v_note,''),case when p_mode='publish' then 'Published announcement' else 'Saved draft' end),p_actor);
 perform public.khpos_announcements_sync_server(p_school);
 return n.id;
end $$;

create function public.khpos_get_announcements_server(p_actor uuid,p_school uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_school is null then
  if not khpos_private.announcements_admin(p_actor) then raise exception 'Authorised KAEC administration required.'; end if;
 elsif not khpos_private.ops_hpd_has_membership(p_actor,p_school) then raise exception 'Active school membership required.'; end if;
 perform public.khpos_announcements_sync_server(p_school);
 return jsonb_build_object(
 'scopes',case when p_school is null then '[{"campusId":null,"unitId":null,"label":"KAEC network"}]'::jsonb else coalesce((select jsonb_agg(x) from (
 select null::uuid as "campusId",null::uuid as "unitId",'Whole school' as label where khpos_private.announcements_publish_scope(p_actor,p_school,null,null)
 union all select c.id,null::uuid,c.name from public.khpos_ops_campuses c where c.organisation_id=p_school and c.status='active' and khpos_private.announcements_publish_scope(p_actor,p_school,c.id,null)
 union all select u.campus_id,u.id,c.name||' · '||u.name from public.khpos_ops_units u join public.khpos_ops_campuses c on c.id=u.campus_id where u.organisation_id=p_school and u.status='active' and c.status='active' and khpos_private.announcements_publish_scope(p_actor,p_school,u.campus_id,u.id)
 ) x),'[]'::jsonb) end,
 'schools',case when p_school is null then coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.organisations where status='active' and partner_status='active' and 'khpos_core'=any(partner_entitlements)),'[]'::jsonb) else '[]'::jsonb end,
 'roles',coalesce((select jsonb_agg(x) from (select code,min(title) as title from public.khpos_ops_roles where status='active' and (p_school is null or organisation_id=p_school) group by code) x),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(x.payload order by x.sort_priority,x.publish_at desc) from (select
 (to_jsonb(n)-'created_by'-'school_ids')||jsonb_build_object('school_ids',case when khpos_private.announcements_publish_scope(p_actor,n.school_id,n.campus_id,n.unit_id) then to_jsonb(n.school_ids) else '[]'::jsonb end,
 'canManage',khpos_private.announcements_publish_scope(p_actor,n.school_id,n.campus_id,n.unit_id) and n.school_id is not distinct from p_school,
 'canRespond',rc.user_id is not null and khpos_private.announcement_recipient(p_actor,p_school,n.id),'readAt',rc.read_at,'acknowledgedAt',rc.acknowledged_at,
 'phase',case when n.status<>'published' then n.status when n.publish_at>now() then 'scheduled' when n.expires_at<=now() then 'expired' else 'active' end,
 'available',n.status='published' and n.publish_at<=now() and n.expires_at>now(),
 'audienceLabel',case when n.school_id is null then 'KAEC network' else coalesce(c.name,'Whole school')||case when u.id is not null then ' · '||u.name else '' end end) as payload,
 n.publish_at,case when n.priority='urgent' and n.status='published' and n.expires_at>now() then 0 else 1 end as sort_priority
 from public.khpos_announcements n left join public.khpos_ops_campuses c on c.id=n.campus_id left join public.khpos_ops_units u on u.id=n.unit_id
 left join public.khpos_announcement_receipts rc on rc.announcement_id=n.id and rc.revision=n.revision and rc.school_id=p_school and rc.user_id=p_actor
 where (n.school_id is not distinct from p_school and khpos_private.announcements_publish_scope(p_actor,n.school_id,n.campus_id,n.unit_id))
 or (p_school is not null and n.status='published' and n.publish_at<=now() and rc.user_id is not null and khpos_private.announcement_recipient(p_actor,p_school,n.id))
 order by case when n.priority='urgent' and n.status='published' and n.publish_at<=now() and n.expires_at>now() then 0 else 1 end,n.created_at desc limit 200) x),'[]'::jsonb));
end $$;

create function public.khpos_announcement_tracking_server(p_actor uuid,p_notice uuid,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.khpos_announcements%rowtype; v_revision integer;
begin
 select * into n from public.khpos_announcements where id=p_notice;
 if not found or not khpos_private.announcements_publish_scope(p_actor,n.school_id,n.campus_id,n.unit_id) then raise exception 'Announcement tracking is outside your publishing authority.'; end if;
 v_revision:=case when n.status='withdrawn' then n.revision-1 else n.revision end;
 perform public.khpos_announcements_sync_server(n.school_id);
 return jsonb_build_object('revision',v_revision,'total',(select count(*) from public.khpos_announcement_receipts r where r.announcement_id=n.id and r.revision=v_revision and khpos_private.announcement_recipient(r.user_id,r.school_id,n.id)),
 'read',(select count(*) from public.khpos_announcement_receipts r where r.announcement_id=n.id and r.revision=v_revision and r.read_at is not null and khpos_private.announcement_recipient(r.user_id,r.school_id,n.id)),
 'acknowledged',(select count(*) from public.khpos_announcement_receipts r where r.announcement_id=n.id and r.revision=v_revision and r.acknowledged_at is not null and khpos_private.announcement_recipient(r.user_id,r.school_id,n.id)),
 'recipients',coalesce((select jsonb_agg(x) from (select distinct r.user_id as "userId",r.school_id as "schoolId",coalesce(st.display_name,'School leadership') as name,o.name as school,r.read_at as "readAt",r.acknowledged_at as "acknowledgedAt" from public.khpos_announcement_receipts r left join lateral (select display_name from public.khpos_ops_staff st where st.user_id=r.user_id and st.organisation_id=r.school_id and st.status='active' limit 1) st on true join public.organisations o on o.id=r.school_id where r.announcement_id=n.id and r.revision=v_revision and khpos_private.announcement_recipient(r.user_id,r.school_id,n.id) order by school,name limit 100 offset greatest(0,least(p_offset,100000))) x),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(jsonb_build_object('revision',revision,'note',change_note,'at',changed_at) order by revision desc) from public.khpos_announcement_versions where announcement_id=n.id),'[]'::jsonb));
end $$;
revoke all on function khpos_private.announcements_admin(uuid),khpos_private.announcements_publish_scope(uuid,uuid,uuid,uuid),khpos_private.announcement_recipient(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function khpos_private.announcements_admin(uuid),khpos_private.announcements_publish_scope(uuid,uuid,uuid,uuid),khpos_private.announcement_recipient(uuid,uuid,uuid) to service_role;
revoke all on function public.khpos_announcements_sync_server(uuid),public.khpos_announcement_action_server(uuid,uuid,text,jsonb),public.khpos_get_announcements_server(uuid,uuid),public.khpos_announcement_tracking_server(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.khpos_announcements_sync_server(uuid),public.khpos_announcement_action_server(uuid,uuid,text,jsonb),public.khpos_get_announcements_server(uuid,uuid),public.khpos_announcement_tracking_server(uuid,uuid,integer) to service_role;
