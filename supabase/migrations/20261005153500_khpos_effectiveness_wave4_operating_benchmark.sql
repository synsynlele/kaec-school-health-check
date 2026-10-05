
create or replace function public.khpos_get_school_operating_benchmark_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $func$
declare
  v_org public.organisations%rowtype;
  v_release_id uuid;
  v_release_code text;
  v_scope text := 'global';
  v_scope_label text := 'All eligible KHP-OS schools on the same KAEC Standard';
  v_base_peer_count integer := 0;
  v_since timestamptz := now() - interval '30 days';
  v_result jsonb;
begin
  if not exists (
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
    raise exception 'Active school membership and KHP-OS partnership are required.';
  end if;

  select * into v_org
  from public.organisations
  where id=p_organisation_id
    and status='active'
    and partner_status='active';

  select si.release_id,sr.code
  into v_release_id,v_release_code
  from public.khpos_standard_installations si
  join public.khpos_standard_releases sr on sr.id=si.release_id
  where si.organisation_id=p_organisation_id
    and si.status='active'
  order by si.adopted_at desc nulls last,si.installed_at desc
  limit 1;

  if v_release_id is null then
    return jsonb_build_object(
      'status','standard_required',
      'generatedAt',now(),
      'windowDays',30,
      'policy',jsonb_build_object(
        'minimumPeers',5,
        'minimumObservationsPerMetric',5,
        'rankingDisabled',true,
        'namedPeersExposed',false,
        'sameStandardRequired',true
      ),
      'metrics','[]'::jsonb
    );
  end if;

  if v_org.country is not null and v_org.school_level is not null then
    select count(*)::integer into v_base_peer_count
    from public.organisations o
    join public.khpos_standard_installations si
      on si.organisation_id=o.id
     and si.release_id=v_release_id
     and si.status='active'
    where o.id<>p_organisation_id
      and o.status='active'
      and o.partner_status='active'
      and o.organisation_type='school'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
      and lower(coalesce(o.country,''))=lower(v_org.country)
      and lower(coalesce(o.school_level,''))=lower(v_org.school_level);

    if v_base_peer_count>=5 then
      v_scope:='country_school_level';
      v_scope_label:=coalesce(v_org.school_level,'School')
        ||' operating peers in '||coalesce(v_org.country,'the same country');
    end if;
  end if;

  if v_base_peer_count<5 and v_org.country is not null then
    select count(*)::integer into v_base_peer_count
    from public.organisations o
    join public.khpos_standard_installations si
      on si.organisation_id=o.id
     and si.release_id=v_release_id
     and si.status='active'
    where o.id<>p_organisation_id
      and o.status='active'
      and o.partner_status='active'
      and o.organisation_type='school'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
      and lower(coalesce(o.country,''))=lower(v_org.country);

    if v_base_peer_count>=5 then
      v_scope:='country';
      v_scope_label:='Operating peers in '||v_org.country;
    end if;
  end if;

  if v_base_peer_count<5 then
    select count(*)::integer into v_base_peer_count
    from public.organisations o
    join public.khpos_standard_installations si
      on si.organisation_id=o.id
     and si.release_id=v_release_id
     and si.status='active'
    where o.id<>p_organisation_id
      and o.status='active'
      and o.partner_status='active'
      and o.organisation_type='school'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]));

    v_scope:='global';
    v_scope_label:='All eligible KHP-OS schools on '||v_release_code;
  end if;

  if v_base_peer_count<5 then
    return jsonb_build_object(
      'status','insufficient_peers',
      'generatedAt',now(),
      'windowDays',30,
      'standardCode',v_release_code,
      'policy',jsonb_build_object(
        'minimumPeers',5,
        'availablePeers',v_base_peer_count,
        'minimumObservationsPerMetric',5,
        'scope',v_scope,
        'scopeLabel',v_scope_label,
        'rankingDisabled',true,
        'namedPeersExposed',false,
        'sameStandardRequired',true
      ),
      'metrics','[]'::jsonb
    );
  end if;

  with eligible_orgs as (
    select o.id
    from public.organisations o
    join public.khpos_standard_installations si
      on si.organisation_id=o.id
     and si.release_id=v_release_id
     and si.status='active'
    where o.status='active'
      and o.partner_status='active'
      and o.organisation_type='school'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
      and (
        o.id=p_organisation_id
        or (
          o.id<>p_organisation_id
          and (
            (v_scope='country_school_level'
             and lower(coalesce(o.country,''))=lower(coalesce(v_org.country,''))
             and lower(coalesce(o.school_level,''))=lower(coalesce(v_org.school_level,'')))
            or
            (v_scope='country'
             and lower(coalesce(o.country,''))=lower(coalesce(v_org.country,'')))
            or v_scope='global'
          )
        )
      )
  ),
  profile_stats as (
    select
      eo.id as organisation_id,
      count(ep.id) filter (where ep.status<>'not_applicable')::integer as denominator,
      count(ep.id) filter (where ep.status='configured')::integer as numerator
    from eligible_orgs eo
    left join public.khpos_ops_process_execution_profiles ep
      on ep.organisation_id=eo.id
    group by eo.id
  ),
  due_work_stats as (
    select
      eo.id as organisation_id,
      count(w.id)::integer as denominator,
      count(w.id) filter (where w.status='completed')::integer as numerator
    from eligible_orgs eo
    left join public.khpos_ops_work_items w
      on w.organisation_id=eo.id
     and w.status<>'cancelled'
     and w.due_at>=v_since
     and w.due_at<=now()
    group by eo.id
  ),
  on_time_stats as (
    select
      eo.id as organisation_id,
      count(w.id) filter (where w.status='completed')::integer as denominator,
      count(w.id) filter (
        where w.status='completed'
          and w.completed_at is not null
          and w.due_at is not null
          and w.completed_at<=w.due_at
      )::integer as numerator
    from eligible_orgs eo
    left join public.khpos_ops_work_items w
      on w.organisation_id=eo.id
     and w.status<>'cancelled'
     and w.due_at>=v_since
     and w.due_at<=now()
    group by eo.id
  ),
  verified_work as (
    select w.organisation_id,w.id
    from public.khpos_ops_work_items w
    join eligible_orgs eo on eo.id=w.organisation_id
    where w.verified_at is not null
      and w.verified_at>=v_since
  ),
  returned_work as (
    select distinct ae.organisation_id,ae.object_id
    from public.khpos_ops_audit_events ae
    join verified_work vw
      on vw.organisation_id=ae.organisation_id
     and vw.id=ae.object_id
    where ae.object_type='work_item'
      and ae.event_type='ops_work_return'
  ),
  verification_stats as (
    select
      eo.id as organisation_id,
      count(vw.id)::integer as denominator,
      count(vw.id) filter (where rw.object_id is null)::integer as numerator
    from eligible_orgs eo
    left join verified_work vw on vw.organisation_id=eo.id
    left join returned_work rw
      on rw.organisation_id=vw.organisation_id
     and rw.object_id=vw.id
    group by eo.id
  ),
  issue_stats as (
    select
      eo.id as organisation_id,
      count(i.id)::integer as denominator,
      count(i.id) filter (
        where i.status in ('resolved','verified','closed')
      )::integer as numerator
    from eligible_orgs eo
    left join public.khpos_ops_issues i
      on i.organisation_id=eo.id
     and i.created_at>=v_since
    group by eo.id
  ),
  decision_stats as (
    select
      eo.id as organisation_id,
      count(d.id)::integer as denominator,
      count(d.id) filter (
        where d.status in ('implemented','closed')
      )::integer as numerator
    from eligible_orgs eo
    left join public.khpos_ops_decisions d
      on d.organisation_id=eo.id
     and d.action_required=true
     and d.decided_at is not null
     and d.decided_at>=v_since
    group by eo.id
  ),
  metrics as (
    select 'execution_coverage'::text as metric_id,
           'Execution coverage'::text as label,
           organisation_id,numerator,denominator,
           case when denominator>0
             then round(100.0*numerator/denominator,1)
             else null end as percent
    from profile_stats
    union all
    select 'work_completion_reliability','Work completion reliability',
           organisation_id,numerator,denominator,
           case when denominator>0
             then round(100.0*numerator/denominator,1)
             else null end
    from due_work_stats
    union all
    select 'on_time_completion','On-time completion',
           organisation_id,numerator,denominator,
           case when denominator>0
             then round(100.0*numerator/denominator,1)
             else null end
    from on_time_stats
    union all
    select 'verification_first_pass','First-pass verification',
           organisation_id,numerator,denominator,
           case when denominator>0
             then round(100.0*numerator/denominator,1)
             else null end
    from verification_stats
    union all
    select 'issue_closure','Issue closure',
           organisation_id,numerator,denominator,
           case when denominator>0
             then round(100.0*numerator/denominator,1)
             else null end
    from issue_stats
    union all
    select 'decision_action_closure','Decision action closure',
           organisation_id,numerator,denominator,
           case when denominator>0
             then round(100.0*numerator/denominator,1)
             else null end
    from decision_stats
  ),
  metric_policy as (
    select * from (values
      ('execution_coverage'::text,1),
      ('work_completion_reliability',5),
      ('on_time_completion',5),
      ('verification_first_pass',5),
      ('issue_closure',5),
      ('decision_action_closure',5)
    ) as x(metric_id,min_observations)
  ),
  peer_metric_stats as (
    select
      m.metric_id,
      max(m.label) as label,
      count(*) filter (
        where m.organisation_id<>p_organisation_id
          and m.denominator>=mp.min_observations
          and m.percent is not null
      )::integer as peer_count,
      round(percentile_cont(0.25) within group (order by m.percent)
        filter (
          where m.organisation_id<>p_organisation_id
            and m.denominator>=mp.min_observations
            and m.percent is not null
        )::numeric,1) as p25,
      round(percentile_cont(0.50) within group (order by m.percent)
        filter (
          where m.organisation_id<>p_organisation_id
            and m.denominator>=mp.min_observations
            and m.percent is not null
        )::numeric,1) as median,
      round(percentile_cont(0.75) within group (order by m.percent)
        filter (
          where m.organisation_id<>p_organisation_id
            and m.denominator>=mp.min_observations
            and m.percent is not null
        )::numeric,1) as p75,
      mp.min_observations
    from metrics m
    join metric_policy mp on mp.metric_id=m.metric_id
    group by m.metric_id,mp.min_observations
  ),
  own_metric as (
    select m.*,mp.min_observations
    from metrics m
    join metric_policy mp on mp.metric_id=m.metric_id
    where m.organisation_id=p_organisation_id
  ),
  metric_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',om.metric_id,
        'label',om.label,
        'ownPercent',om.percent,
        'ownNumerator',om.numerator,
        'ownDenominator',om.denominator,
        'minimumObservations',om.min_observations,
        'ownEligible',om.denominator>=om.min_observations and om.percent is not null,
        'peerCount',pms.peer_count,
        'peerP25',case when pms.peer_count>=5 then pms.p25 else null end,
        'peerMedian',case when pms.peer_count>=5 then pms.median else null end,
        'peerP75',case when pms.peer_count>=5 then pms.p75 else null end,
        'position',case
          when om.denominator<om.min_observations or om.percent is null
            then 'insufficient_own_data'
          when pms.peer_count<5
            then 'insufficient_peers'
          when om.percent>pms.p75 then 'above_peer_band'
          when om.percent<pms.p25 then 'below_peer_band'
          else 'within_peer_band'
        end
      )
      order by case om.metric_id
        when 'execution_coverage' then 1
        when 'work_completion_reliability' then 2
        when 'on_time_completion' then 3
        when 'verification_first_pass' then 4
        when 'issue_closure' then 5
        when 'decision_action_closure' then 6
        else 99 end
    ),'[]'::jsonb) as value
    from own_metric om
    join peer_metric_stats pms on pms.metric_id=om.metric_id
  )
  select jsonb_build_object(
    'status','ready',
    'generatedAt',now(),
    'windowDays',30,
    'standardCode',v_release_code,
    'policy',jsonb_build_object(
      'minimumPeers',5,
      'availablePeers',v_base_peer_count,
      'minimumObservationsPerMetric',5,
      'scope',v_scope,
      'scopeLabel',v_scope_label,
      'rankingDisabled',true,
      'namedPeersExposed',false,
      'sameStandardRequired',true
    ),
    'metrics',mj.value
  )
  into v_result
  from metric_json mj;

  return v_result;
end;
$func$;

revoke all on function public.khpos_get_school_operating_benchmark_server(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.khpos_get_school_operating_benchmark_server(uuid,uuid)
  to service_role;

comment on function public.khpos_get_school_operating_benchmark_server(uuid,uuid) is
  'Returns privacy-safe 30-day operating peer bands only among schools that adopted the same KAEC Standard release. Each metric is suppressed unless five peers meet its minimum observation threshold; no peer identity or rank is returned.';
