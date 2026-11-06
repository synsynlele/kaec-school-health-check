alter table public.khpos_ops_roles add column custom_title text;

-- School setup can refresh the role template. Keep the school's title when it does.
create function khpos_private.keep_school_role_title()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.custom_title is not null then new.title := new.custom_title; end if;
  return new;
end;
$$;
revoke all on function khpos_private.keep_school_role_title() from public,anon,authenticated;
create trigger keep_school_role_title before update of title, custom_title on public.khpos_ops_roles
for each row execute function khpos_private.keep_school_role_title();

create function public.khpos_ops_school_role_title(
  p_actor uuid, p_org uuid, p_role uuid default null, p_title text default null, p_previous text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  allowed boolean;
  previous text;
begin
  allowed := coalesce(khpos_private.ops_academic_has_membership(p_actor,p_org),false)
    and khpos_private.ops_presence_leader(p_actor,p_org,null,null,array['SCHOOL_CUSTODIAN','SCHOOL_GUARDIAN']);
  if p_role is null then return allowed; end if;
  if not allowed then raise exception 'Only an authorised school-wide leader can rename roles.' using errcode='42501'; end if;
  p_title := btrim(p_title);
  if p_title is null or char_length(p_title) not between 1 and 80 then
    raise exception 'Enter a role title between 1 and 80 characters.' using errcode='22023';
  end if;
  select r.title into previous from public.khpos_ops_roles r
    where r.id=p_role and r.organisation_id=p_org and r.status='active' for update;
  if not found then raise exception 'Active role not found in this school.' using errcode='22023'; end if;
  if previous=p_title then return true; end if;
  if previous is distinct from p_previous then
    raise exception 'This title has changed. Refresh and try again.' using errcode='40001';
  end if;
  update public.khpos_ops_roles set title=p_title, custom_title=p_title, updated_at=now() where id=p_role;
  insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
    values(p_org,p_actor,'role_title_changed','role',p_role,jsonb_build_object('previousTitle',previous,'title',p_title));
  return true;
end;
$$;
revoke all on function public.khpos_ops_school_role_title(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.khpos_ops_school_role_title(uuid,uuid,uuid,text,text) to service_role;
