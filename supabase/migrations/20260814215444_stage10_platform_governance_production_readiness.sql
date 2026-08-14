alter table public.khpos_platform_admins
  add column if not exists platform_role text not null default 'portfolio_admin',
  add column if not exists grant_reason text,
  add column if not exists last_reviewed_at timestamptz;

alter table public.khpos_platform_admins
  drop constraint if exists khpos_platform_admins_platform_role_check;
alter table public.khpos_platform_admins
  add constraint khpos_platform_admins_platform_role_check
  check (platform_role in ('super_admin','portfolio_admin','support_reviewer'));

create index if not exists idx_khpos_platform_admins_granted_by
  on public.khpos_platform_admins(granted_by)
  where granted_by is not null;
create index if not exists idx_khpos_platform_admins_status_role
  on public.khpos_platform_admins(status, platform_role);

create table if not exists public.khpos_platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_platform_audit_events_created
  on public.khpos_platform_audit_events(created_at desc);
create index if not exists idx_khpos_platform_audit_events_actor
  on public.khpos_platform_audit_events(actor_user_id, created_at desc)
  where actor_user_id is not null;

alter table public.khpos_platform_audit_events enable row level security;
revoke all privileges on table public.khpos_platform_audit_events from public, anon, authenticated;
grant select, insert, update, delete on table public.khpos_platform_audit_events to service_role;

create or replace function public.khpos_get_admin_console_server(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_admin public.khpos_platform_admins%rowtype;
  v_email text;
  v_mfa_enrolled boolean := false;
  v_admins jsonb;
  v_events jsonb;
begin
  select * into v_admin
  from public.khpos_platform_admins
  where user_id=p_actor_user_id and status='active'
  limit 1;

  if v_admin.user_id is null then
    raise exception 'Active KHP-OS Platform Administrator access is required.';
  end if;

  select email into v_email from auth.users where id=p_actor_user_id;
  select exists(
    select 1 from auth.mfa_factors
    where user_id=p_actor_user_id and status='verified'
  ) into v_mfa_enrolled;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', a.user_id,
    'email', u.email,
    'role', a.platform_role,
    'status', a.status,
    'mfaEnrolled', exists(
      select 1 from auth.mfa_factors mf
      where mf.user_id=a.user_id and mf.status='verified'
    ),
    'grantedAt', a.granted_at,
    'lastReviewedAt', a.last_reviewed_at
  ) order by case a.status when 'active' then 0 else 1 end, a.platform_role, lower(u.email)), '[]'::jsonb)
  into v_admins
  from public.khpos_platform_admins a
  join auth.users u on u.id=a.user_id;

  select coalesce(jsonb_agg(x.event order by x.created_at desc), '[]'::jsonb)
  into v_events
  from (
    select e.created_at,
      jsonb_build_object(
        'id',e.id,
        'eventType',e.event_type,
        'actorEmail',au.email,
        'targetEmail',tu.email,
        'metadata',e.metadata,
        'createdAt',e.created_at
      ) as event
    from public.khpos_platform_audit_events e
    left join auth.users au on au.id=e.actor_user_id
    left join auth.users tu on tu.id=e.target_user_id
    order by e.created_at desc
    limit 20
  ) x;

  return jsonb_build_object(
    'generatedAt', now(),
    'admin', jsonb_build_object(
      'userId', v_admin.user_id,
      'email', v_email,
      'role', v_admin.platform_role,
      'status', v_admin.status,
      'mfaEnrolled', v_mfa_enrolled,
      'canManageAdmins', v_admin.platform_role='super_admin'
    ),
    'summary', jsonb_build_object(
      'activeInstitutions', (select count(*) from public.organisations where status='active'),
      'institutionsWithBaseline', (select count(distinct organisation_id) from public.assessments where organisation_id is not null and status='completed' and assessment_kind='baseline'),
      'institutionsWithReassessment', (select count(distinct organisation_id) from public.khpos_reassessments where status='complete'),
      'verifiedImprovementInstitutions', (select count(distinct organisation_id) from public.khpos_reassessments where status='complete' and verified_improvement=true),
      'activePriorities', (select count(*) from public.khpos_priorities where status='active'),
      'criticalPriorities', (select count(*) from public.khpos_priorities where status in ('approved','active','under_review') and indicator_score=1),
      'reviewsAwaitingDecision', (select count(*) from public.khpos_transformation_reviews where status='awaiting_decision'),
      'reviewsDue', (select count(*) from public.khpos_review_schedules where status='due' or (status='pending' and scheduled_for <= current_date)),
      'evidenceNeedsAttention', (select count(*) from public.khpos_evidence_submissions where status in ('awaiting_upload','uploaded','analyzing','needs_clarification')),
      'reassessmentsInProgress', (select count(*) from public.khpos_reassessments where status='in_progress'),
      'integrationsActive', (select count(*) from public.khpos_integrations where status='active'),
      'integrationsNeedAttention', (select count(*) from public.khpos_integrations where status='error' or (status='active' and coalesce(last_synced_at,created_at) < now()-interval '7 days')),
      'activePlatformAdmins', (select count(*) from public.khpos_platform_admins where status='active'),
      'mfaEnrolledPlatformAdmins', (select count(*) from public.khpos_platform_admins a where a.status='active' and exists (select 1 from auth.mfa_factors mf where mf.user_id=a.user_id and mf.status='verified'))
    ),
    'governance', jsonb_build_object(
      'platformRolesVersion','1.0',
      'namedPortfolioPrivate',true,
      'schoolMembershipSeparate',true,
      'adminChangesRequireMfaAal2',true,
      'publicRankingEnabled',false
    ),
    'admins', v_admins,
    'recentEvents', v_events
  );
end;
$$;

revoke execute on function public.khpos_get_admin_console_server(uuid) from public, anon, authenticated;
grant execute on function public.khpos_get_admin_console_server(uuid) to service_role;

create or replace function public.khpos_manage_platform_admin_server(
  p_actor_user_id uuid,
  p_target_email text,
  p_action text,
  p_platform_role text default 'portfolio_admin',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor public.khpos_platform_admins%rowtype;
  v_target_user_id uuid;
  v_target_email text;
  v_target_existing public.khpos_platform_admins%rowtype;
  v_reason text := btrim(coalesce(p_reason,''));
  v_role text := coalesce(nullif(btrim(p_platform_role),''),'portfolio_admin');
begin
  select * into v_actor
  from public.khpos_platform_admins
  where user_id=p_actor_user_id and status='active'
  limit 1;

  if v_actor.user_id is null or v_actor.platform_role <> 'super_admin' then
    raise exception 'Super Admin approval is required for platform-access changes.';
  end if;
  if p_action not in ('grant','reactivate','suspend') then
    raise exception 'Unsupported platform-admin action.';
  end if;
  if v_role not in ('super_admin','portfolio_admin','support_reviewer') then
    raise exception 'Unsupported platform role.';
  end if;
  if char_length(v_reason) < 12 then
    raise exception 'A short governance reason of at least 12 characters is required.';
  end if;

  select id,email into v_target_user_id,v_target_email
  from auth.users
  where lower(email)=lower(btrim(p_target_email))
  limit 1;

  if v_target_user_id is null then
    raise exception 'The target email must already belong to a verified KHP-OS identity.';
  end if;

  select * into v_target_existing
  from public.khpos_platform_admins
  where user_id=v_target_user_id;

  if p_action='suspend' then
    if v_target_existing.user_id is null or v_target_existing.status <> 'active' then
      raise exception 'That Platform Administrator is not active.';
    end if;
    if v_target_user_id=p_actor_user_id then
      raise exception 'A Super Admin cannot suspend their own active session.';
    end if;
    if v_target_existing.platform_role='super_admin' and
       (select count(*) from public.khpos_platform_admins where status='active' and platform_role='super_admin') <= 1 then
      raise exception 'KHP-OS must retain at least one active Super Admin.';
    end if;

    update public.khpos_platform_admins
    set status='suspended', grant_reason=v_reason, last_reviewed_at=now(), updated_at=now()
    where user_id=v_target_user_id;
  else
    insert into public.khpos_platform_admins(
      user_id,status,platform_role,granted_by,granted_at,updated_at,grant_reason,last_reviewed_at
    ) values (
      v_target_user_id,'active',v_role,p_actor_user_id,now(),now(),v_reason,now()
    )
    on conflict (user_id) do update set
      status='active',
      platform_role=excluded.platform_role,
      granted_by=p_actor_user_id,
      grant_reason=v_reason,
      last_reviewed_at=now(),
      updated_at=now();
  end if;

  insert into public.khpos_platform_audit_events(actor_user_id,event_type,target_user_id,metadata)
  values (
    p_actor_user_id,
    case p_action when 'suspend' then 'platform_admin_suspended' when 'reactivate' then 'platform_admin_reactivated' else 'platform_admin_granted' end,
    v_target_user_id,
    jsonb_build_object('role',case when p_action='suspend' then v_target_existing.platform_role else v_role end,'reason',v_reason)
  );

  return jsonb_build_object(
    'ok',true,
    'targetUserId',v_target_user_id,
    'targetEmail',v_target_email,
    'action',p_action,
    'role',case when p_action='suspend' then v_target_existing.platform_role else v_role end
  );
end;
$$;

revoke execute on function public.khpos_manage_platform_admin_server(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.khpos_manage_platform_admin_server(uuid,text,text,text,text) to service_role;
