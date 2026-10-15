-- Admission metadata only. Operating records retain their existing school boundaries.
create table public.khpos_ops_campus_requests (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id),
 name text not null check(length(btrim(name)) between 2 and 140),
 address text not null check(length(btrim(address)) between 5 and 600),
 rationale text not null check(length(btrim(rationale)) between 12 and 2000),
 readiness_reference text,
 status text not null default 'submitted' check(status in ('submitted','approved','rejected','withdrawn','activated')),
 requested_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),
 review_note text,
 campus_id uuid unique references public.khpos_ops_campuses(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index on public.khpos_ops_campus_requests(organisation_id,created_at desc);
create unique index khpos_campus_request_open_name on public.khpos_ops_campus_requests(organisation_id,lower(btrim(name))) where status in ('submitted','approved');
alter table public.khpos_ops_campus_requests enable row level security;
revoke all on public.khpos_ops_campus_requests from public,anon,authenticated;
grant select,insert,update on public.khpos_ops_campus_requests to service_role;

create function public.khpos_ops_schools_campuses_server(p_actor uuid,p_org uuid default null)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_admin boolean; v_can_request boolean;
begin
 select exists(select 1 from public.khpos_platform_admins where user_id=p_actor and status='active' and platform_role in ('super_admin','portfolio_admin')) into v_admin;
 if p_org is null and not v_admin then raise exception 'Authorised KAEC administration required.'; end if;
 if p_org is not null and not khpos_private.ops_hpd_has_membership(p_actor,p_org) then raise exception 'Active school membership required.'; end if;
 v_can_request:=p_org is not null and khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_CUSTODIAN','VISION_CUSTODIAN']);
 return jsonb_build_object('canReview',v_admin and p_org is null,'canRequest',v_can_request,
 'switchableSchools',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name) from public.organisations o join public.organisation_memberships m on m.organisation_id=o.id where m.user_id=p_actor and m.status='active' and o.status='active' and o.partner_status='active' and 'khpos_core'=any(o.partner_entitlements)),'[]'::jsonb),
 'schools',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'status',o.partner_status) order by o.name) from public.organisations o where (p_org is null or o.id=p_org) and (p_org is null or exists(select 1 from public.organisation_memberships m where m.organisation_id=o.id and m.user_id=p_actor and m.status='active'))),'[]'::jsonb),
 'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'organisationId',c.organisation_id,'name',c.name,'status',c.status) order by c.name) from public.khpos_ops_campuses c where (p_org is null or c.organisation_id=p_org) and (p_org is null or khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,false))),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.khpos_ops_campus_requests r where (p_org is null or r.organisation_id=p_org) and (p_org is null or v_can_request)),'[]'::jsonb));
end $$;

create function public.khpos_ops_campus_request_action_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb)
returns void language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_request public.khpos_ops_campus_requests%rowtype; v_id uuid; v_campus uuid; v_note text:=btrim(coalesce(p_input->>'note','')); v_admin boolean;
begin
 select exists(select 1 from public.khpos_platform_admins where user_id=p_actor and status='active' and platform_role in ('super_admin','portfolio_admin')) into v_admin;
 if p_mode='submit' then
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_CUSTODIAN','VISION_CUSTODIAN']) then raise exception 'Only the active School Custodian may request a campus.'; end if;
  perform 1 from public.organisations where id=p_org and status='active' and partner_status='active' and 'khpos_core'=any(partner_entitlements) for share;
  if not found then raise exception 'An approved active school is required.'; end if;
  if exists(select 1 from public.khpos_ops_campuses where organisation_id=p_org and lower(btrim(name))=lower(btrim(p_input->>'name')) and status<>'archived') then raise exception 'A campus with this name already exists in this school.'; end if;
  insert into public.khpos_ops_campus_requests(organisation_id,name,address,rationale,requested_by) values(p_org,btrim(p_input->>'name'),btrim(p_input->>'address'),btrim(p_input->>'rationale'),p_actor) returning id into v_id;
 else
  select * into v_request from public.khpos_ops_campus_requests where id=(p_input->>'requestId')::uuid and organisation_id=p_org for update;
  if not found then raise exception 'Campus request not found in this school.'; end if;
  v_id:=v_request.id;
  if p_mode='withdraw' then
   if v_request.status<>'submitted' or not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_CUSTODIAN','VISION_CUSTODIAN']) then raise exception 'Only a School Custodian may withdraw a submitted request.'; end if;
   update public.khpos_ops_campus_requests set status='withdrawn',updated_at=now() where id=v_id;
  elsif p_mode in ('approve','reject','activate') then
   if not v_admin then raise exception 'Authorised KAEC administration required.'; end if;
   if length(v_note)<12 or length(v_note)>2000 then raise exception 'Record a governance note between 12 and 2000 characters.'; end if;
   perform 1 from public.organisations where id=p_org and status='active' and partner_status='active' and 'khpos_core'=any(partner_entitlements) for share;
   if not found then raise exception 'An approved active school is required.'; end if;
   if p_mode='activate' then
    if v_request.status<>'approved' then raise exception 'Only an approved request can be activated.'; end if;
    v_campus:=gen_random_uuid();
    insert into public.khpos_ops_campuses(id,organisation_id,code,name,status,created_by) values(v_campus,p_org,'CAMPUS_'||replace(v_campus::text,'-',''),v_request.name,'active',p_actor);
    update public.khpos_ops_campus_requests set status='activated',campus_id=v_campus,updated_at=now() where id=v_id;
   else
    if v_request.status<>'submitted' then raise exception 'Only a submitted request can be reviewed.'; end if;
    if p_mode='approve' and length(btrim(coalesce(p_input->>'readinessReference','')))<5 then raise exception 'Campus readiness review evidence is required.'; end if;
    update public.khpos_ops_campus_requests set status=case when p_mode='approve' then 'approved' else 'rejected' end,reviewed_by=p_actor,review_note=v_note,readiness_reference=nullif(btrim(p_input->>'readinessReference'),''),updated_at=now() where id=v_id;
   end if;
  else raise exception 'Unsupported campus request action.';
  end if;
 end if;
 insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata) values(p_org,p_actor,'campus_request_'||p_mode,'campus_request',v_id,jsonb_build_object('note',v_note,'campusId',v_campus));
end $$;
revoke all on function public.khpos_ops_schools_campuses_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_campus_request_action_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_schools_campuses_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_campus_request_action_server(uuid,uuid,text,jsonb) to service_role;
