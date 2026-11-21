-- KHP-OS Custodian succession: separate request, verified successor acceptance,
-- and independent MFA-confirmed KAEC platform-administration approval.
-- Historical KSHC assessments, reports and staff records are never deleted.
create table public.khpos_custodian_transfers (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 outgoing_user_id uuid references auth.users(id),
 outgoing_assignment_id uuid references public.khpos_ops_role_assignments(id),
 incoming_email text not null check (length(btrim(incoming_email)) between 5 and 254),
 incoming_user_id uuid references auth.users(id),
 keep_outgoing_as_guardian boolean not null default true,
 guardian_campus_id uuid references public.khpos_ops_campuses(id),
 reason text not null check (length(btrim(reason)) between 20 and 3000),
 status text not null default 'awaiting_acceptance'
   check (status in ('awaiting_acceptance','awaiting_approval','executing','completed','rejected','cancelled')),
 initiated_by uuid not null references auth.users(id),
 is_recovery boolean not null default false,
 accepted_at timestamptz,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint khpos_custodian_transfer_incoming_distinct check (outgoing_user_id is distinct from incoming_user_id)
);
create unique index khpos_custodian_one_pending_transfer_per_school
 on public.khpos_custodian_transfers(organisation_id)
 where status in ('awaiting_acceptance','awaiting_approval','executing');
create index khpos_custodian_transfer_candidate_idx
 on public.khpos_custodian_transfers(lower(incoming_email),status,created_at desc);

create table public.khpos_custodian_transfer_events (
 id uuid primary key default gen_random_uuid(),
 transfer_id uuid not null references public.khpos_custodian_transfers(id) on delete cascade,
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 action text not null check (action in ('proposed','accepted','declined','cancelled','rejected','approved')),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index khpos_custodian_transfer_events_time
 on public.khpos_custodian_transfer_events(transfer_id,created_at);

alter table public.khpos_custodian_transfers enable row level security;
alter table public.khpos_custodian_transfer_events enable row level security;
revoke all on table public.khpos_custodian_transfers from PUBLIC,anon,authenticated;
revoke all on table public.khpos_custodian_transfer_events from PUBLIC,anon,authenticated;
grant select,insert,update on public.khpos_custodian_transfers to service_role;
grant select,insert on public.khpos_custodian_transfer_events to service_role;

-- The legacy guard prohibits ordinary code from granting Custodian authority.
-- Allow ONLY a transfer already being executed by the separate reviewed RPC.
create or replace function khpos_private.ops_guard_leadership_assignment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public','auth','khpos_private','pg_temp'
 as $function$
declare v_code text; v_org uuid; v_request uuid;
begin
 select code,organisation_id into v_code,v_org from public.khpos_ops_roles where id=new.role_id;
 if v_code='SCHOOL_CUSTODIAN' then
   if tg_op='INSERT' then
     if exists(select 1 from public.khpos_ops_role_assignments where role_id=new.role_id and status='active') then
       raise exception 'Custodian seats require separate governance approval.';
     end if;
     v_request := nullif(current_setting('khpos.custodian_transfer_request',true),'')::uuid;
     if not (
       (current_setting('khpos.bootstrap_partner',true)=v_org::text and new.appointed_by=new.user_id)
       or
       exists (
         select 1 from public.khpos_custodian_transfers tr
         where tr.id=v_request and tr.organisation_id=v_org
           and tr.incoming_user_id=new.user_id
           and tr.reviewed_by=new.appointed_by
           and tr.status='executing'
       )
     ) then
       raise exception 'Custodian seats require separate governance approval.';
     end if;
   elsif old.status<>'active' or new.user_id<>old.user_id or new.role_id<>old.role_id then
     raise exception 'Custodian seats require separate governance approval.';
   end if;
 elsif v_code='SCHOOL_GUARDIAN' and new.status='active' then
   if new.campus_id is null then raise exception 'School Guardian assignment requires a campus.'; end if;
   if tg_op='INSERT' or old.status<>'active' or new.user_id<>old.user_id or new.role_id<>old.role_id or new.campus_id is distinct from old.campus_id then
     if new.appointed_by is null or not khpos_private.ops_hpd_has_membership(new.appointed_by,v_org)
       or not khpos_private.ops_hpd_actor_has_role(new.appointed_by,v_org,array['SCHOOL_CUSTODIAN']::text[])
     then raise exception 'Only an active school owner can appoint a campus School Guardian.'; end if;
   end if;
 end if;
 return new;
end;
$function$;

create or replace function public.khpos_custodian_transfer_action_server(
 p_actor uuid,p_mode text,p_school uuid default null,p_transfer uuid default null,
 p_incoming_email text default null,p_reason text default null,
 p_keep_guardian boolean default true,p_guardian_campus uuid default null
) returns uuid
 language plpgsql security definer
 set search_path to 'public','auth','khpos_private','pg_temp'
 as $function$
declare
 v_id uuid; v_role uuid; v_guardian_role uuid;
 v_old_user uuid; v_old_assignment uuid; v_guardian_assignment uuid;
 v_target_user uuid; v_email text; v_current_email text;
 v_is_admin boolean; v_is_custodian boolean; v_recovery boolean;
 v_audit_note text; v_org public.organisations%rowtype;
 v_tr public.khpos_custodian_transfers%rowtype;
 v_active_count integer; v_campus uuid; v_count integer;
begin
 select exists(select 1 from public.khpos_platform_admins a
   where a.user_id=p_actor and a.status='active' and a.platform_role in ('super_admin','portfolio_admin'))
   into v_is_admin;
 select lower(email) into v_current_email from auth.users
 where id=p_actor and email_confirmed_at is not null;
 if v_current_email is null then raise exception 'A verified signed-in account is required.'; end if;

 if p_mode='propose' then
   if p_school is null then raise exception 'Choose a school.'; end if;
   select * into v_org from public.organisations where id=p_school and status='active' for update;
   if v_org.id is null or v_org.partner_status<>'active' or not ('khpos_core'=any(v_org.partner_entitlements)) then
     raise exception 'Only an active KHP-OS school can transfer its Custodian.'; end if;
   select id into v_role from public.khpos_ops_roles
    where organisation_id=p_school and code='SCHOOL_CUSTODIAN' and status='active';
   if v_role is null then raise exception 'The School Custodian role has not been configured.'; end if;
   select count(*),min(user_id),min(id)
     into v_active_count,v_old_user,v_old_assignment
     from public.khpos_ops_role_assignments
     where role_id=v_role and status='active' and campus_id is null;
   if v_active_count>1 then raise exception 'Multiple active Custodians need a governance review before succession.'; end if;
   select exists(
     select 1 from public.organisation_memberships m join public.khpos_ops_role_assignments a
       on a.user_id=m.user_id
     where m.organisation_id=p_school and m.user_id=p_actor and m.status='active'
       and a.role_id=v_role and a.status='active' and a.campus_id is null
       and a.start_date<=current_date and (a.end_date is null or a.end_date>=current_date)
   ) into v_is_custodian;
   if not v_is_custodian and not v_is_admin then
      raise exception 'Only the current School Custodian or an authorised platform administrator can request succession.'; end if;
   if v_active_count=0 and not v_is_admin then raise exception 'Custodian recovery requires KAEC administration.'; end if;
   v_email:=lower(btrim(coalesce(p_incoming_email,'')));
   if length(v_email)<5 or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
     raise exception 'Enter the successor’s verified account email.'; end if;
   select id into v_target_user from auth.users where lower(email)=v_email and email_confirmed_at is not null;
   if v_target_user is not null and v_target_user=v_old_user then
     raise exception 'Choose a different person as the incoming Custodian.'; end if;
   if length(btrim(coalesce(p_reason,'')))<20 or length(p_reason)>3000 then
     raise exception 'State why Custodian authority is being transferred (20–3,000 characters).'; end if;
   if p_keep_guardian and v_old_user is not null then
     if p_guardian_campus is not null then
       select id into v_campus from public.khpos_ops_campuses where id=p_guardian_campus and organisation_id=p_school and status='active';
       if v_campus is null then raise exception 'The Guardian campus must belong to this school.'; end if;
     else
       select count(*),min(id) into v_count,v_campus
       from public.khpos_ops_campuses where organisation_id=p_school and status='active';
       if v_count<>1 then
         raise exception 'Choose the campus where the outgoing Custodian will serve as School Guardian.'; end if;
     end if;
   end if;
   v_recovery:=not v_is_custodian;
   insert into public.khpos_custodian_transfers(
     organisation_id,outgoing_user_id,outgoing_assignment_id,
     incoming_email,reason,keep_outgoing_as_guardian,guardian_campus_id,
     initiated_by,is_recovery
   ) values(
     p_school,v_old_user,v_old_assignment,v_email,btrim(p_reason),
     coalesce(p_keep_guardian,true) and v_old_user is not null,v_campus,p_actor,v_recovery
   ) returning id into v_id;
   insert into public.khpos_custodian_transfer_events(transfer_id,organisation_id,actor_id,action,details)
     values(v_id,p_school,p_actor,'proposed',jsonb_build_object('recovery',v_recovery,'guardian',p_keep_guardian));
   return v_id;
 end if;

 select * into v_tr from public.khpos_custodian_transfers where id=p_transfer for update;
 if v_tr.id is null then raise exception 'Succession request not found.'; end if;
 v_id:=v_tr.id;
 if p_school is not null and p_school<>v_tr.organisation_id then
   raise exception 'Succession request belongs to another school.'; end if;
 if p_mode='accept' or p_mode='decline' then
   if v_current_email<>lower(v_tr.incoming_email) then raise exception 'Only the invited successor may respond.'; end if;
   if v_tr.status<>'awaiting_acceptance' then raise exception 'This invitation is no longer awaiting acceptance.'; end if;
   if v_tr.outgoing_user_id=p_actor then raise exception 'The outgoing Custodian cannot accept their own transfer.'; end if;
   if p_mode='accept' then
     update public.khpos_custodian_transfers
       set incoming_user_id=p_actor,status='awaiting_approval',accepted_at=now(),updated_at=now()
       where id=v_id;
     v_audit_note:='accepted';
   else
     update public.khpos_custodian_transfers
       set status='rejected',review_note='Invited successor declined.',updated_at=now()
       where id=v_id;
     v_audit_note:='declined';
   end if;
   insert into public.khpos_custodian_transfer_events(transfer_id,organisation_id,actor_id,action)
     values(v_id,v_tr.organisation_id,p_actor,v_audit_note);
   return v_id;
 end if;

 if p_mode='cancel' then
   if v_tr.status not in ('awaiting_acceptance','awaiting_approval') then
     raise exception 'Only a pending succession can be cancelled.'; end if;
   if p_actor<>v_tr.initiated_by and not v_is_admin then raise exception 'Only the requester or KAEC administration can cancel this succession.'; end if;
   if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Record why the succession was cancelled.'; end if;
   update public.khpos_custodian_transfers set status='cancelled',
     review_note=left(btrim(p_reason),1000),updated_at=now() where id=v_id;
   insert into public.khpos_custodian_transfer_events(transfer_id,organisation_id,actor_id,action,details)
     values(v_id,v_tr.organisation_id,p_actor,'cancelled',jsonb_build_object('reason',left(btrim(p_reason),1000)));
   return v_id;
 end if;

 if p_mode not in ('approve','reject') then raise exception 'Unsupported succession action.'; end if;
 if not v_is_admin then raise exception 'Only authorised KAEC platform administration can review Custodian transfers.'; end if;
 if p_actor=v_tr.initiated_by or p_actor=v_tr.incoming_user_id or p_actor=v_tr.outgoing_user_id then
   raise exception 'A different administrator must independently review this transfer.'; end if;
 if v_tr.status<>'awaiting_approval' then raise exception 'The incoming Custodian must accept before review.'; end if;
 if length(btrim(coalesce(p_reason,'')))<20 then raise exception 'Record the independent governance verification and decision.'; end if;
 if p_mode='reject' then
   update public.khpos_custodian_transfers set status='rejected',reviewed_by=p_actor,reviewed_at=now(),
     review_note=left(btrim(p_reason),3000),updated_at=now() where id=v_id;
   insert into public.khpos_custodian_transfer_events(transfer_id,organisation_id,actor_id,action,details)
     values(v_id,v_tr.organisation_id,p_actor,'rejected',jsonb_build_object('verification',left(btrim(p_reason),3000)));
   return v_id;
 end if;

 -- BEGIN atomic, serialised ownership change. All changes roll back if any
 -- membership / role / campus / staffing / safety constraint rejects a step.
 select * into v_org from public.organisations where id=v_tr.organisation_id and status='active' for update;
 if v_org.id is null or v_org.partner_status<>'active' or not ('khpos_core'=any(v_org.partner_entitlements)) then
   raise exception 'The school is not active for Custodian succession.'; end if;
 select id into v_role from public.khpos_ops_roles where organisation_id=v_org.id and code='SCHOOL_CUSTODIAN' and status='active';
 select id into v_guardian_role from public.khpos_ops_roles where organisation_id=v_org.id and code='SCHOOL_GUARDIAN' and status='active';
 if v_role is null or (v_tr.keep_outgoing_as_guardian and v_guardian_role is null) then
   raise exception 'Required school leadership roles have not been configured.'; end if;
 select count(*),min(user_id),min(id) into v_active_count,v_old_user,v_old_assignment
 from public.khpos_ops_role_assignments where role_id=v_role and status='active' and campus_id is null;
 if v_tr.outgoing_assignment_id is null then
   if v_active_count<>0 then raise exception 'The school appointed another Custodian. Refresh succession.'; end if;
 elsif v_active_count<>1 or v_old_user is distinct from v_tr.outgoing_user_id or v_old_assignment<>v_tr.outgoing_assignment_id then
   raise exception 'Custodian ownership changed during this request. Start a fresh review.'; end if;
 select id into v_target_user from auth.users
   where id=v_tr.incoming_user_id and lower(email)=v_tr.incoming_email and email_confirmed_at is not null;
 if v_target_user is null then raise exception 'The successor must still have a verified matching account.'; end if;
 if exists(select 1 from public.khpos_ops_role_assignments where role_id=v_role and user_id=v_target_user and status='active') then
   raise exception 'The successor already has an active Custodian assignment.'; end if;
 if v_tr.keep_outgoing_as_guardian then
   select id into v_campus from public.khpos_ops_campuses where organisation_id=v_org.id
    and id=v_tr.guardian_campus_id and status='active';
   if v_campus is null then raise exception 'The outgoing Guardian campus is no longer available.'; end if;
 end if;
 update public.khpos_custodian_transfers
  set status='executing',reviewed_by=p_actor,reviewed_at=now(),
    review_note=left(btrim(p_reason),3000),updated_at=now() where id=v_id;

 -- Membership is activated only AFTER verified acceptance and independent review.
 insert into public.organisation_memberships(organisation_id,user_id,role,status,invited_by)
 values(v_org.id,v_target_user,'executive','active',p_actor)
 on conflict (organisation_id,user_id) do update set status='active',role='executive',updated_at=now();

 -- Current assignment is ended (not deleted), preserving its original role ID
 -- in completed work, policy, attendance and report history.
 if v_old_assignment is not null then
   update public.khpos_ops_role_assignments
   set status='ended',end_date=current_date,updated_at=now()
   where id=v_old_assignment and status='active';
 end if;
 -- The incoming owner becomes the primary school-wide Custodian, not a campus-only staff position.
 update public.khpos_ops_role_assignments a set primary_assignment=false,updated_at=now()
  where a.user_id=v_target_user and a.status='active'
    and a.role_id in (select id from public.khpos_ops_roles where organisation_id=v_org.id);
 perform set_config('khpos.custodian_transfer_request',v_id::text,true);
 insert into public.khpos_ops_role_assignments(
   role_id,user_id,campus_id,unit_id,primary_assignment,status,start_date,appointed_by
 ) values(v_role,v_target_user,null,null,true,'active',current_date,p_actor)
 returning id into v_id;
 perform set_config('khpos.custodian_transfer_request','',true);

 if v_tr.outgoing_user_id is not null then
   -- Remove the executive membership inherited from an old School Health Check
   -- claimant. If Guardian is chosen, actual Guardian role authority is retained.
   update public.organisation_memberships
      set role='contributor',updated_at=now()
      where organisation_id=v_org.id and user_id=v_tr.outgoing_user_id and role='executive';
   if v_tr.keep_outgoing_as_guardian then
     select a.id into v_guardian_assignment
     from public.khpos_ops_role_assignments a
     where a.user_id=v_tr.outgoing_user_id and a.role_id=v_guardian_role
       and a.campus_id=v_campus and a.status='active' limit 1;
     if v_guardian_assignment is null then
       insert into public.khpos_ops_role_assignments(
         role_id,user_id,campus_id,unit_id,primary_assignment,status,start_date,appointed_by
       ) values(v_guardian_role,v_tr.outgoing_user_id,v_campus,null,true,'active',current_date,v_target_user)
       returning id into v_guardian_assignment;
     end if;
     update public.khpos_ops_staff
       set desired_role_id=v_guardian_role,role_assignment_id=v_guardian_assignment,
           campus_id=v_campus,updated_at=now()
       where organisation_id=v_org.id and user_id=v_tr.outgoing_user_id
         and role_assignment_id=v_tr.outgoing_assignment_id and status<>'ended';
   else
     if exists(select 1 from public.khpos_ops_staff
       where organisation_id=v_org.id and user_id=v_tr.outgoing_user_id
         and role_assignment_id=v_tr.outgoing_assignment_id and status='active') then
       raise exception 'Outgoing active staff must be reassigned in People or continued as School Guardian.';
     end if;
   end if;
 end if;

 update public.khpos_custodian_transfers
   set status='completed',completed_at=now(),updated_at=now() where id=v_tr.id;
 insert into public.khpos_custodian_transfer_events(transfer_id,organisation_id,actor_id,action,details)
 values(v_tr.id,v_org.id,p_actor,'approved',
   jsonb_build_object('incoming_assignment',v_id,'guardian_assignment',v_guardian_assignment,
      'outgoing_ended',v_tr.outgoing_assignment_id,'independent_verification',left(btrim(p_reason),2000)));
 return v_tr.id;
end;
$function$;

revoke all on function public.khpos_custodian_transfer_action_server(
 uuid,text,uuid,uuid,text,text,boolean,uuid) from PUBLIC,anon,authenticated;
grant execute on function public.khpos_custodian_transfer_action_server(
 uuid,text,uuid,uuid,text,text,boolean,uuid) to service_role;
