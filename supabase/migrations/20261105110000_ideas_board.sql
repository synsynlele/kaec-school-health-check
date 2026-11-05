create table public.khpos_ideas (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id),
  author_id uuid not null references auth.users(id),
  recipient_id uuid references auth.users(id),
  parent_id uuid references public.khpos_ideas(id),
  anonymous boolean not null default false,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.khpos_ideas enable row level security;
revoke all on public.khpos_ideas from public, anon, authenticated;
grant select, insert on public.khpos_ideas to service_role;
create index khpos_ideas_threads_idx on public.khpos_ideas (organisation_id, created_at desc) where parent_id is null;
create index khpos_ideas_replies_idx on public.khpos_ideas (parent_id, created_at);

create function public.khpos_ideas_server(
  p_actor uuid, p_org uuid, p_mode text, p_body text,
  p_anonymous boolean, p_recipient uuid, p_parent uuid
) returns jsonb
language plpgsql security definer set search_path = public, khpos_private, pg_temp
as $$
declare
  thread public.khpos_ideas;
  leaders jsonb;
begin
  if not coalesce(case when p_org is null then khpos_private.meeting_can_host(p_actor, null)
    else khpos_private.ops_hpd_has_membership(p_actor, p_org) end, false) then
    raise exception 'Board access required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'name', coalesce(h.display_name, s.display_name, u.email))
    order by coalesce(h.display_name, s.display_name, u.email)), '[]'::jsonb)
  into leaders
  from (
    select user_id from public.kaec_hq_members where p_org is null and status = 'active' and role <> 'team_member'
    union
    select user_id from public.organisation_memberships where organisation_id = p_org and status = 'active'
  ) candidates
  join auth.users u on u.id = candidates.user_id
  left join public.kaec_hq_members h on h.user_id = u.id and p_org is null
  left join lateral (
    select display_name from public.khpos_ops_staff
    where user_id = u.id and organisation_id = p_org and status = 'active'
    limit 1
  ) s on true
  where u.id <> p_actor and khpos_private.meeting_can_host(u.id, p_org)
    and (p_org is null or khpos_private.ops_hpd_has_membership(u.id, p_org));

  if p_mode = 'post' then
    if p_parent is not null then
      select * into thread from public.khpos_ideas
      where id = p_parent and parent_id is null
        and organisation_id is not distinct from p_org
        and (recipient_id is null or p_actor in (author_id, recipient_id));
      if not found then
        raise exception 'Discussion access required.' using errcode = '42501';
      end if;
      p_recipient := null;
      p_anonymous := p_anonymous or (thread.anonymous and thread.author_id = p_actor);
    elsif p_recipient is not null and not leaders @> jsonb_build_array(jsonb_build_object('id', p_recipient)) then
      raise exception 'Select an available leader.' using errcode = '22023';
    end if;
    insert into public.khpos_ideas (organisation_id, author_id, recipient_id, parent_id, anonymous, body)
    values (p_org, p_actor, p_recipient, p_parent, p_anonymous, btrim(p_body));
  elsif p_mode <> 'list' then
    raise exception 'Invalid board operation.' using errcode = '22023';
  end if;

  return jsonb_build_object('leaders', leaders, 'posts', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'body', t.body, 'createdAt', t.created_at,
      'private', t.recipient_id is not null,
      'author', case when t.anonymous then 'Anonymous'
        else coalesce(h.display_name, s.display_name, 'Staff member') end,
      'replies', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'body', r.body,
          'author', case when r.anonymous then 'Anonymous'
            else coalesce(rh.display_name, rs.display_name, 'Staff member') end) order by r.created_at)
        from (select * from public.khpos_ideas where parent_id = t.id order by created_at desc limit 30) r
        left join public.kaec_hq_members rh on rh.user_id = r.author_id and p_org is null
        left join lateral (select display_name from public.khpos_ops_staff
          where user_id = r.author_id and organisation_id = p_org and status = 'active' limit 1) rs on true
      ), '[]'::jsonb)
    ) order by t.created_at desc)
    from (
      select * from public.khpos_ideas where parent_id is null
        and organisation_id is not distinct from p_org
        and (recipient_id is null or p_actor in (author_id, recipient_id))
      order by created_at desc limit 40
    ) t
    left join public.kaec_hq_members h on h.user_id = t.author_id and p_org is null
    left join lateral (select display_name from public.khpos_ops_staff
      where user_id = t.author_id and organisation_id = p_org and status = 'active' limit 1) s on true
  ), '[]'::jsonb));
end;
$$;
revoke all on function public.khpos_ideas_server(uuid, uuid, text, text, boolean, uuid, uuid) from public, anon, authenticated;
grant execute on function public.khpos_ideas_server(uuid, uuid, text, text, boolean, uuid, uuid) to service_role;
