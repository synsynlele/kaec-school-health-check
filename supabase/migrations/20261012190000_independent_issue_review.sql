-- Add an independent school Guardian path to verify/close School Custodian-owned
-- standard issues. No data update, no automatic approval or self-verification.
-- Guardian fall-back only for standard issues belonging to the School Custodian.
-- Holding two titles never permits reviewing one's own issue.
create or replace function khpos_private.ops_issue_can_independent_guardian(
  p_actor uuid, p_org uuid, p_issue uuid
) returns boolean language sql stable security definer set search_path='' as $check$
  select exists(
    select 1
    from public.khpos_ops_issues i
    join public.khpos_ops_role_assignments owner_a on owner_a.id=i.owner_assignment_id
    join public.khpos_ops_roles owner_role on owner_role.id=owner_a.role_id
    join public.khpos_ops_role_assignments reviewer_a on reviewer_a.user_id=p_actor and reviewer_a.status='active'
    join public.khpos_ops_roles reviewer_role on reviewer_role.id=reviewer_a.role_id
    where i.id=p_issue and i.organisation_id=p_org
      and i.sensitivity='standard'
      and i.status in ('resolved','verified')
      and owner_role.organisation_id=p_org
      and owner_role.code='SCHOOL_CUSTODIAN'
      and reviewer_role.organisation_id=p_org
      and reviewer_role.status='active'
      and reviewer_role.code='SCHOOL_GUARDIAN'
      and owner_a.user_id is distinct from p_actor
      and khpos_private.ops_hpd_has_membership(p_actor,p_org)
      and (reviewer_a.campus_id is null or reviewer_a.campus_id=i.campus_id)
      and (reviewer_a.unit_id is null or reviewer_a.unit_id=i.unit_id)
  );
$check$;

revoke all on function khpos_private.ops_issue_can_independent_guardian(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function khpos_private.ops_issue_can_independent_guardian(uuid,uuid,uuid)
  to service_role;


CREATE OR REPLACE FUNCTION public.khpos_ops_get_issues_server(p_actor_user_id uuid, p_organisation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_member_role text;
  v_org_name text;
  v_items jsonb := '[]'::jsonb;
  v_open integer := 0;
  v_p1 integer := 0;
  v_overdue integer := 0;
  v_resolved integer := 0;
  v_restricted integer := 0;
begin
  select m.role,o.name into v_member_role,v_org_name
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
    and o.status='active'
    and o.partner_status='active'
    and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  limit 1;

  if v_member_role is null then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  with actor_assignments as (
    select a.*,r.code as role_code,r.title as role_title,r.role_level
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  ),
  visible as (
    select distinct
      i.*,
      oa.user_id as owner_user_id,
      orole.id as owner_role_id,
      orole.title as owner_role_title,
      u.email as owner_email,
      coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',u.email) as owner_display,
      p.code as process_code,
      p.title as process_title,
      w.title as source_work_title,
      exists(select 1 from actor_assignments aa where aa.id=i.owner_assignment_id) as is_owner,
      khpos_private.ops_issue_can_independent_guardian(p_actor_user_id,p_organisation_id,i.id) as is_guardian_reviewer,
      (i.reported_by=p_actor_user_id) as is_reporter,
      exists(
        select 1
        from actor_assignments aa
        where aa.role_id=orole.reports_to_role_id
          and (aa.campus_id is null or oa.campus_id is null or aa.campus_id=oa.campus_id)
          and (aa.unit_id is null or oa.unit_id is null or aa.unit_id=oa.unit_id)
      ) as is_direct_manager,
      exists(
        select 1
        from public.khpos_ops_issue_escalations e
        join actor_assignments aa on aa.role_id=e.target_role_id
        where e.issue_id=i.id and e.cleared_at is null
      ) as is_escalation_recipient,
      (
        select tr.title
        from public.khpos_ops_issue_escalations e
        join public.khpos_ops_roles tr on tr.id=e.target_role_id
        where e.issue_id=i.id and e.cleared_at is null
        order by e.escalated_at desc
        limit 1
      ) as escalated_to_title
    from public.khpos_ops_issues i
    left join public.khpos_ops_role_assignments oa on oa.id=i.owner_assignment_id
    left join public.khpos_ops_roles orole on orole.id=oa.role_id
    left join auth.users u on u.id=oa.user_id
    left join public.khpos_ops_processes p on p.id=i.process_id
    left join public.khpos_ops_work_items w on w.id=i.source_work_item_id
    where i.organisation_id=p_organisation_id
      and i.sensitivity='standard'
      and (
        khpos_private.ops_issue_can_independent_guardian(p_actor_user_id,p_organisation_id,i.id)
        or i.reported_by=p_actor_user_id
        or exists(select 1 from actor_assignments aa where aa.id=i.owner_assignment_id)
        or exists(
          select 1
          from actor_assignments aa
          where aa.role_id=orole.reports_to_role_id
            and (aa.campus_id is null or oa.campus_id is null or aa.campus_id=oa.campus_id)
            and (aa.unit_id is null or oa.unit_id is null or aa.unit_id=oa.unit_id)
        )
        or exists(
          select 1
          from public.khpos_ops_issue_escalations e
          join actor_assignments aa on aa.role_id=e.target_role_id
          where e.issue_id=i.id and e.cleared_at is null
        )
      )
  ),
  item_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',v.id,
        'reference','ISS-'||upper(substr(v.id::text,1,8)),
        'type',v.issue_type,
        'category',v.category,
        'severity',v.severity,
        'title',v.title,
        'description',v.description,
        'status',v.status,
        'dueAt',v.due_at,
        'immediateAction',v.immediate_action,
        'rootCause',v.root_cause,
        'resolution',v.resolution,
        'preventiveAction',v.preventive_action,
        'createdAt',v.created_at,
        'resolvedAt',v.resolved_at,
        'verifiedAt',v.verified_at,
        'owner',case when v.owner_assignment_id is null then null else jsonb_build_object(
          'roleTitle',v.owner_role_title,
          'displayName',v.owner_display,
          'email',v.owner_email
        ) end,
        'process',case when v.process_id is null then null else jsonb_build_object(
          'code',v.process_code,'title',v.process_title
        ) end,
        'sourceWorkTitle',v.source_work_title,
        'escalatedToTitle',v.escalated_to_title,
        'isOwner',v.is_owner,
        'isGuardianReviewer',v.is_guardian_reviewer,
        'isReporter',v.is_reporter,
        'isDirectManager',v.is_direct_manager,
        'isEscalationRecipient',v.is_escalation_recipient,
        'history',coalesce((
          select jsonb_agg(jsonb_build_object(
            'eventType',h.event_type,
            'fromStatus',h.from_status,
            'toStatus',h.to_status,
            'note',h.note,
            'createdAt',h.created_at
          ) order by h.created_at desc)
          from (
            select e.event_type,e.from_status,e.to_status,e.note,e.created_at
            from public.khpos_ops_issue_events e
            where e.issue_id=v.id
            order by e.created_at desc
            limit 12
          ) h
        ),'[]'::jsonb)
      )
      order by
        case v.severity when 'P1' then 1 when 'P2' then 2 when 'P3' then 3 else 4 end,
        case when v.status in ('closed','verified') then 1 else 0 end,
        v.due_at nulls last,
        v.created_at desc
    ),'[]'::jsonb) as value
    from visible v
    where v.status <> 'closed' or v.closed_at >= now()-interval '30 days'
  )
  select value into v_items from item_json;

  with actor_assignments as (
    select a.*
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id and a.status='active'
      and r.organisation_id=p_organisation_id and r.status='active'
  ),
  relevant as (
    select distinct i.*
    from public.khpos_ops_issues i
    left join public.khpos_ops_role_assignments oa on oa.id=i.owner_assignment_id
    left join public.khpos_ops_roles orole on orole.id=oa.role_id
    where i.organisation_id=p_organisation_id
      and i.sensitivity='standard'
      and (
        khpos_private.ops_issue_can_independent_guardian(p_actor_user_id,p_organisation_id,i.id)
        or i.reported_by=p_actor_user_id
        or exists(select 1 from actor_assignments aa where aa.id=i.owner_assignment_id)
        or exists(
          select 1 from actor_assignments aa
          where aa.role_id=orole.reports_to_role_id
            and (aa.campus_id is null or oa.campus_id is null or aa.campus_id=oa.campus_id)
            and (aa.unit_id is null or oa.unit_id is null or aa.unit_id=oa.unit_id)
        )
        or exists(
          select 1 from public.khpos_ops_issue_escalations e
          join actor_assignments aa on aa.role_id=e.target_role_id
          where e.issue_id=i.id and e.cleared_at is null
        )
      )
  )
  select
    count(*) filter (where status not in ('verified','closed'))::integer,
    count(*) filter (where severity='P1' and status not in ('verified','closed'))::integer,
    count(*) filter (where due_at<now() and status not in ('verified','closed'))::integer,
    count(*) filter (where status in ('resolved','verified'))::integer
  into v_open,v_p1,v_overdue,v_resolved
  from relevant;

  select count(*)::integer into v_restricted
  from public.khpos_ops_issues i
  where i.organisation_id=p_organisation_id
    and i.sensitivity='restricted'
    and i.reported_by=p_actor_user_id
    and i.status <> 'closed';

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'summary',jsonb_build_object(
      'open',v_open,
      'critical',v_p1,
      'overdue',v_overdue,
      'resolvedAwaitingClosure',v_resolved,
      'restrictedOwnedOrReported',v_restricted
    ),
    'items',v_items
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.khpos_ops_issue_action_server(p_actor_user_id uuid, p_organisation_id uuid, p_issue_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_issue public.khpos_ops_issues%rowtype;
  v_owner_user uuid;
  v_owner_role uuid;
  v_parent_role uuid;
  v_actor_assignment uuid;
  v_actor_role uuid;
  v_is_reporter boolean := false;
  v_is_owner boolean := false;
  v_is_manager boolean := false;
  v_is_escalation_recipient boolean := false;
  v_is_guardian_reviewer boolean := false;
  v_from_status text;
begin
  if not exists(
    select 1
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select i.* into v_issue
  from public.khpos_ops_issues i
  where i.id=p_issue_id
    and i.organisation_id=p_organisation_id
    and i.sensitivity='standard'
  limit 1;

  if v_issue.id is null then raise exception 'Issue not found.'; end if;

  if v_issue.owner_assignment_id is not null then
    select oa.user_id,oa.role_id into v_owner_user,v_owner_role
    from public.khpos_ops_role_assignments oa
    where oa.id=v_issue.owner_assignment_id;
  end if;

  v_is_reporter := v_issue.reported_by=p_actor_user_id;
  v_is_owner := v_owner_user=p_actor_user_id;
  v_is_guardian_reviewer := khpos_private.ops_issue_can_independent_guardian(
    p_actor_user_id,p_organisation_id,v_issue.id
  );

  select a.id,a.role_id into v_actor_assignment,v_actor_role
  from public.khpos_ops_role_assignments a
  join public.khpos_ops_roles ar on ar.id=a.role_id
  left join public.khpos_ops_role_assignments oa on oa.id=v_issue.owner_assignment_id
  left join public.khpos_ops_roles orole on orole.id=oa.role_id
  where a.user_id=p_actor_user_id
    and a.status='active'
    and ar.organisation_id=p_organisation_id
    and ar.status='active'
    and (
      v_issue.owner_assignment_id is null
      or (
        a.role_id=orole.reports_to_role_id
        and (a.campus_id is null or oa.campus_id is null or a.campus_id=oa.campus_id)
        and (a.unit_id is null or oa.unit_id is null or a.unit_id=oa.unit_id)
      )
    )
  order by a.primary_assignment desc,ar.role_level,a.created_at
  limit 1;

  v_is_manager := v_actor_assignment is not null and v_issue.owner_assignment_id is not null
                  and not v_is_owner;

  select exists(
    select 1
    from public.khpos_ops_issue_escalations e
    join public.khpos_ops_role_assignments a on a.role_id=e.target_role_id
    join public.khpos_ops_roles r on r.id=a.role_id
    where e.issue_id=v_issue.id and e.cleared_at is null
      and a.user_id=p_actor_user_id and a.status='active'
      and r.organisation_id=p_organisation_id and r.status='active'
  ) into v_is_escalation_recipient;

  if v_is_escalation_recipient then
    select e.target_role_id into v_actor_role
    from public.khpos_ops_issue_escalations e
    join public.khpos_ops_role_assignments a on a.role_id=e.target_role_id
    where e.issue_id=v_issue.id and e.cleared_at is null
      and a.user_id=p_actor_user_id and a.status='active'
    order by e.escalated_at desc
    limit 1;
  end if;

  if not (v_is_reporter or v_is_owner or v_is_manager or v_is_escalation_recipient or v_is_guardian_reviewer) then
    raise exception 'This issue is not visible to your active role.';
  end if;

  v_from_status := v_issue.status;

  if p_action='claim' then
    if v_issue.owner_assignment_id is not null or v_issue.status<>'open' then
      raise exception 'Only an open unassigned issue can be claimed.';
    end if;
    if v_actor_assignment is null then
      select a.id,a.role_id into v_actor_assignment,v_actor_role
      from public.khpos_ops_role_assignments a
      join public.khpos_ops_roles r on r.id=a.role_id
      where a.user_id=p_actor_user_id and a.status='active'
        and r.organisation_id=p_organisation_id and r.status='active'
      order by a.primary_assignment desc,r.role_level,a.created_at limit 1;
    end if;
    if v_actor_assignment is null then raise exception 'An active operating role is required to claim an issue.'; end if;

    update public.khpos_ops_issues
      set owner_assignment_id=v_actor_assignment,status='assigned',updated_at=now()
      where id=v_issue.id;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (
      p_organisation_id,v_issue.id,p_actor_user_id,'claimed',v_from_status,'assigned',
      nullif(btrim(coalesce(p_note,'')),'')
    );

  elsif p_action='start' then
    if not v_is_owner or v_issue.status not in ('assigned','awaiting') then
      raise exception 'Only the issue owner can start or resume assigned/awaiting work.';
    end if;

    update public.khpos_ops_issues set status='in_action',updated_at=now() where id=v_issue.id;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'started',v_from_status,'in_action',nullif(btrim(coalesce(p_note,'')),''));

  elsif p_action='await' then
    if not v_is_owner or v_issue.status<>'in_action' then
      raise exception 'Only the issue owner can move active work to awaiting.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'Explain what the issue is waiting for.';
    end if;

    update public.khpos_ops_issues set status='awaiting',updated_at=now() where id=v_issue.id;
    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'awaiting',v_from_status,'awaiting',left(btrim(p_note),4000));

  elsif p_action='resolve' then
    if not v_is_owner or v_issue.status not in ('in_action','awaiting') then
      raise exception 'Only the issue owner can resolve an active issue.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'Resolution evidence or explanation is required.';
    end if;

    update public.khpos_ops_issues
      set status='resolved',resolution=left(btrim(p_note),4000),resolved_at=now(),updated_at=now()
      where id=v_issue.id;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'resolved',v_from_status,'resolved',left(btrim(p_note),4000));

  elsif p_action='verify' then
    if v_issue.status<>'resolved' then raise exception 'Only a resolved issue can be verified.'; end if;
    if v_is_owner then raise exception 'The issue owner cannot verify their own resolution.'; end if;
    if not (v_is_reporter or v_is_manager or v_is_escalation_recipient or v_is_guardian_reviewer) then
      raise exception 'Verification requires the reporter or appropriate leadership visibility.';
    end if;

    update public.khpos_ops_issues
      set status='verified',verified_by=p_actor_user_id,verified_at=now(),updated_at=now()
      where id=v_issue.id;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'verified',v_from_status,'verified',nullif(btrim(coalesce(p_note,'')),''));

  elsif p_action='close' then
    if v_issue.status<>'verified' then raise exception 'Only a verified issue can be closed.'; end if;
    if not (v_issue.verified_by=p_actor_user_id or v_is_reporter or v_is_manager or v_is_escalation_recipient or v_is_guardian_reviewer) then
      raise exception 'Issue closure requires the verifier, reporter or appropriate leadership visibility.';
    end if;

    update public.khpos_ops_issues
      set status='closed',closed_at=now(),updated_at=now()
      where id=v_issue.id;

    update public.khpos_ops_issue_escalations
      set cleared_at=coalesce(cleared_at,now())
      where issue_id=v_issue.id and cleared_at is null;

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,from_status,to_status,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'closed',v_from_status,'closed',nullif(btrim(coalesce(p_note,'')),''));

  elsif p_action='escalate' then
    if not (v_is_owner or v_is_reporter or v_is_manager or v_is_escalation_recipient) then
      raise exception 'Escalation requires issue ownership, reporting responsibility or leadership visibility.';
    end if;
    if v_issue.status in ('verified','closed') then
      raise exception 'Verified or closed issues cannot be escalated.';
    end if;
    if nullif(btrim(coalesce(p_note,'')),'') is null then
      raise exception 'An escalation reason is required.';
    end if;

    if v_is_manager or v_is_escalation_recipient then
      v_owner_role := v_actor_role;
    elsif v_owner_role is null then
      if v_actor_role is null then
        select a.role_id into v_actor_role
        from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles r on r.id=a.role_id
        where a.user_id=p_actor_user_id and a.status='active'
          and r.organisation_id=p_organisation_id and r.status='active'
        order by a.primary_assignment desc,r.role_level,a.created_at limit 1;
      end if;
      v_owner_role := v_actor_role;
    end if;

    select reports_to_role_id into v_parent_role from public.khpos_ops_roles where id=v_owner_role;
    if v_parent_role is null then
      raise exception 'This issue has reached the highest reporting authority available in KHP-OS.';
    end if;

    if exists(
      select 1 from public.khpos_ops_issue_escalations
      where issue_id=v_issue.id and target_role_id=v_parent_role and cleared_at is null
    ) then
      raise exception 'This issue is already escalated to the immediate reporting role.';
    end if;

    insert into public.khpos_ops_issue_escalations(
      organisation_id,issue_id,from_role_id,target_role_id,escalated_by,reason
    ) values (
      p_organisation_id,v_issue.id,v_owner_role,v_parent_role,p_actor_user_id,left(btrim(p_note),4000)
    );

    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,note,metadata
    ) values (
      p_organisation_id,v_issue.id,p_actor_user_id,'escalated',left(btrim(p_note),4000),
      jsonb_build_object('targetRoleId',v_parent_role,'automatic',false)
    );

  elsif p_action='comment' then
    if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'A note is required.'; end if;
    insert into public.khpos_ops_issue_events(
      organisation_id,issue_id,actor_user_id,event_type,note
    ) values (p_organisation_id,v_issue.id,p_actor_user_id,'comment',left(btrim(p_note),4000));

  else
    raise exception 'Unsupported issue action.';
  end if;
end;
$function$


-- Preserve the existing service-only boundary on the two public RPCs.
revoke all on function public.khpos_ops_get_issues_server(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_get_issues_server(uuid,uuid) to service_role;
revoke all on function public.khpos_ops_issue_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.khpos_ops_issue_action_server(uuid,uuid,uuid,text,text) to service_role;
