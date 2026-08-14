create table if not exists public.khpos_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.khpos_platform_admins enable row level security;
revoke all privileges on table public.khpos_platform_admins from public, anon, authenticated;
grant select, insert, update, delete on table public.khpos_platform_admins to service_role;

create or replace function khpos_private.assessment_system_scores(p_assessment_id uuid)
returns table(system_id text, score numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest_answers as (
    select distinct on (a.question_id)
      a.question_id,
      a.score
    from public.answers a
    where a.assessment_id = p_assessment_id
      and a.score between 1 and 5
    order by a.question_id, a.created_at desc nulls last, a.id desc
  )
  select
    m.system_id,
    round(sum(la.score::numeric * m.weight) / nullif(sum(m.weight), 0), 2) as score
  from latest_answers la
  join public.khpos_indicator_system_mappings m
    on m.indicator_id = la.question_id
   and m.foundation_version = '1.0'
  group by m.system_id
  order by m.system_id;
$$;

create or replace function public.khpos_get_school_benchmark_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organisations%rowtype;
  v_assessment public.assessments%rowtype;
  v_role text;
  v_scope text := 'global';
  v_scope_label text := 'All eligible KHP-OS schools';
  v_peer_count integer := 0;
  v_portfolio_access boolean := false;
  v_result jsonb;
begin
  select om.role into v_role
  from public.organisation_memberships om
  where om.organisation_id = p_organisation_id
    and om.user_id = p_actor_user_id
    and om.status = 'active'
  limit 1;

  if v_role is null then
    raise exception 'Active school membership is required to view benchmarking.';
  end if;

  select * into v_org
  from public.organisations o
  where o.id = p_organisation_id
    and o.status = 'active';

  if v_org.id is null then
    raise exception 'School workspace not found.';
  end if;

  select exists(
    select 1 from public.khpos_platform_admins pa
    where pa.user_id = p_actor_user_id and pa.status = 'active'
  ) into v_portfolio_access;

  select * into v_assessment
  from public.assessments a
  where a.organisation_id = p_organisation_id
    and a.status = 'completed'
    and a.overall_score is not null
  order by a.completed_at desc nulls last, a.created_at desc
  limit 1;

  if v_assessment.id is null then
    return jsonb_build_object(
      'status','awaiting_baseline',
      'generatedAt',now(),
      'organisation',jsonb_build_object('id',v_org.id,'name',v_org.name),
      'policy',jsonb_build_object('minimumPeers',5,'rankingDisabled',true,'namedPeersExposed',false),
      'portfolioAccess',v_portfolio_access
    );
  end if;

  if v_org.country is not null and v_org.school_level is not null then
    with latest as (
      select distinct on (a.organisation_id)
        a.organisation_id, a.id as assessment_id
      from public.assessments a
      join public.organisations o on o.id=a.organisation_id and o.status='active' and o.organisation_type='school'
      where a.status='completed'
        and a.overall_score is not null
        and a.framework_id=v_assessment.framework_id
        and a.framework_version=v_assessment.framework_version
        and a.scoring_version=v_assessment.scoring_version
      order by a.organisation_id, a.completed_at desc nulls last, a.created_at desc
    )
    select count(*)::integer into v_peer_count
    from latest l join public.organisations o on o.id=l.organisation_id
    where l.organisation_id<>p_organisation_id
      and lower(coalesce(o.country,''))=lower(v_org.country)
      and lower(coalesce(o.school_level,''))=lower(v_org.school_level);
    if v_peer_count >= 5 then
      v_scope := 'country_school_level';
      v_scope_label := coalesce(v_org.school_level,'School') || ' peers in ' || coalesce(v_org.country,'the same country');
    end if;
  end if;

  if v_peer_count < 5 and v_org.country is not null then
    with latest as (
      select distinct on (a.organisation_id)
        a.organisation_id, a.id as assessment_id
      from public.assessments a
      join public.organisations o on o.id=a.organisation_id and o.status='active' and o.organisation_type='school'
      where a.status='completed'
        and a.overall_score is not null
        and a.framework_id=v_assessment.framework_id
        and a.framework_version=v_assessment.framework_version
        and a.scoring_version=v_assessment.scoring_version
      order by a.organisation_id, a.completed_at desc nulls last, a.created_at desc
    )
    select count(*)::integer into v_peer_count
    from latest l join public.organisations o on o.id=l.organisation_id
    where l.organisation_id<>p_organisation_id
      and lower(coalesce(o.country,''))=lower(v_org.country);
    if v_peer_count >= 5 then
      v_scope := 'country';
      v_scope_label := 'Eligible school peers in ' || v_org.country;
    end if;
  end if;

  if v_peer_count < 5 then
    with latest as (
      select distinct on (a.organisation_id)
        a.organisation_id, a.id as assessment_id
      from public.assessments a
      join public.organisations o on o.id=a.organisation_id and o.status='active' and o.organisation_type='school'
      where a.status='completed'
        and a.overall_score is not null
        and a.framework_id=v_assessment.framework_id
        and a.framework_version=v_assessment.framework_version
        and a.scoring_version=v_assessment.scoring_version
      order by a.organisation_id, a.completed_at desc nulls last, a.created_at desc
    )
    select count(*)::integer into v_peer_count
    from latest l
    where l.organisation_id<>p_organisation_id;
    v_scope := 'global';
    v_scope_label := 'All eligible KHP-OS schools';
  end if;

  if v_peer_count < 5 then
    return jsonb_build_object(
      'status','insufficient_peers',
      'generatedAt',now(),
      'organisation',jsonb_build_object('id',v_org.id,'name',v_org.name),
      'latestAssessment',jsonb_build_object('id',v_assessment.id,'overallScore',v_assessment.overall_score,'completedAt',v_assessment.completed_at),
      'policy',jsonb_build_object('minimumPeers',5,'availablePeers',v_peer_count,'rankingDisabled',true,'namedPeersExposed',false),
      'portfolioAccess',v_portfolio_access
    );
  end if;

  with latest as (
    select distinct on (a.organisation_id)
      a.organisation_id,
      a.id as assessment_id,
      a.overall_score::numeric as overall_score,
      a.completed_at
    from public.assessments a
    join public.organisations o on o.id=a.organisation_id and o.status='active' and o.organisation_type='school'
    where a.status='completed'
      and a.overall_score is not null
      and a.framework_id=v_assessment.framework_id
      and a.framework_version=v_assessment.framework_version
      and a.scoring_version=v_assessment.scoring_version
    order by a.organisation_id, a.completed_at desc nulls last, a.created_at desc
  ),
  peers as (
    select l.*
    from latest l
    join public.organisations o on o.id=l.organisation_id
    where l.organisation_id<>p_organisation_id
      and (
        (v_scope='country_school_level' and lower(coalesce(o.country,''))=lower(coalesce(v_org.country,'')) and lower(coalesce(o.school_level,''))=lower(coalesce(v_org.school_level,'')))
        or (v_scope='country' and lower(coalesce(o.country,''))=lower(coalesce(v_org.country,'')))
        or (v_scope='global')
      )
  ),
  overall_stats as (
    select
      count(*)::integer as peer_count,
      round(percentile_cont(0.25) within group (order by overall_score)::numeric,2) as p25,
      round(percentile_cont(0.50) within group (order by overall_score)::numeric,2) as median,
      round(percentile_cont(0.75) within group (order by overall_score)::numeric,2) as p75
    from peers
  ),
  target_system as (
    select * from khpos_private.assessment_system_scores(v_assessment.id)
  ),
  peer_system as (
    select p.organisation_id, s.system_id, s.score
    from peers p
    cross join lateral khpos_private.assessment_system_scores(p.assessment_id) s
  ),
  system_stats as (
    select
      ps.system_id,
      count(*)::integer as peer_count,
      round(percentile_cont(0.25) within group (order by ps.score)::numeric,2) as p25,
      round(percentile_cont(0.50) within group (order by ps.score)::numeric,2) as median,
      round(percentile_cont(0.75) within group (order by ps.score)::numeric,2) as p75
    from peer_system ps
    group by ps.system_id
  ),
  system_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'systemId',ts.system_id,
        'ownScore',ts.score,
        'peerCount',ss.peer_count,
        'peerP25',ss.p25,
        'peerMedian',ss.median,
        'peerP75',ss.p75,
        'position',case
          when ss.peer_count < 5 then 'insufficient'
          when ts.score > ss.p75 then 'above_peer_band'
          when ts.score < ss.p25 then 'below_peer_band'
          else 'within_peer_band'
        end
      ) order by ts.system_id
    ),'[]'::jsonb) as value
    from target_system ts
    left join system_stats ss on ss.system_id=ts.system_id
  ),
  peer_reassess as (
    select distinct on (r.organisation_id)
      r.organisation_id,
      r.delta_from_baseline,
      r.verified_improvement
    from public.khpos_reassessments r
    join peers p on p.organisation_id=r.organisation_id
    where r.status='complete'
      and r.delta_from_baseline is not null
    order by r.organisation_id, r.completed_at desc nulls last, r.sequence_no desc
  ),
  target_reassess as (
    select r.delta_from_baseline, r.verified_improvement, r.improvement_classification
    from public.khpos_reassessments r
    where r.organisation_id=p_organisation_id and r.status='complete'
    order by r.completed_at desc nulls last, r.sequence_no desc
    limit 1
  ),
  improvement_stats as (
    select
      count(*)::integer as peer_count,
      round(percentile_cont(0.25) within group (order by delta_from_baseline)::numeric,2) as p25,
      round(percentile_cont(0.50) within group (order by delta_from_baseline)::numeric,2) as median,
      round(percentile_cont(0.75) within group (order by delta_from_baseline)::numeric,2) as p75,
      round(100.0 * avg(case when verified_improvement then 1 else 0 end),1) as verified_rate
    from peer_reassess
  )
  select jsonb_build_object(
    'status','ready',
    'generatedAt',now(),
    'organisation',jsonb_build_object('id',v_org.id,'name',v_org.name),
    'latestAssessment',jsonb_build_object('id',v_assessment.id,'overallScore',v_assessment.overall_score,'completedAt',v_assessment.completed_at),
    'policy',jsonb_build_object('minimumPeers',5,'scope',v_scope,'scopeLabel',v_scope_label,'rankingDisabled',true,'namedPeersExposed',false),
    'overall',jsonb_build_object(
      'ownScore',v_assessment.overall_score,
      'peerCount',os.peer_count,
      'peerP25',os.p25,
      'peerMedian',os.median,
      'peerP75',os.p75,
      'position',case when v_assessment.overall_score>os.p75 then 'above_peer_band' when v_assessment.overall_score<os.p25 then 'below_peer_band' else 'within_peer_band' end
    ),
    'systems',sj.value,
    'improvement',jsonb_build_object(
      'eligible',ims.peer_count>=5,
      'peerCount',ims.peer_count,
      'ownDeltaFromBaseline',(select delta_from_baseline from target_reassess),
      'ownVerifiedImprovement',(select verified_improvement from target_reassess),
      'ownClassification',(select improvement_classification from target_reassess),
      'peerP25',case when ims.peer_count>=5 then ims.p25 else null end,
      'peerMedian',case when ims.peer_count>=5 then ims.median else null end,
      'peerP75',case when ims.peer_count>=5 then ims.p75 else null end,
      'peerVerifiedImprovementRate',case when ims.peer_count>=5 then ims.verified_rate else null end
    ),
    'portfolioAccess',v_portfolio_access
  ) into v_result
  from overall_stats os cross join system_json sj cross join improvement_stats ims;

  return v_result;
end;
$$;

create or replace function public.khpos_get_portfolio_intelligence_server(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean := false;
  v_result jsonb;
begin
  select exists(
    select 1 from public.khpos_platform_admins pa
    where pa.user_id=p_actor_user_id and pa.status='active'
  ) into v_allowed;

  if not v_allowed then
    raise exception 'KHP-OS Platform Administrator access is required.';
  end if;

  with active_orgs as (
    select o.* from public.organisations o where o.status='active' and o.organisation_type='school'
  ),
  latest_assessments as (
    select distinct on (a.organisation_id)
      a.organisation_id,a.id,a.overall_score,a.completed_at
    from public.assessments a
    join active_orgs o on o.id=a.organisation_id
    where a.status='completed' and a.overall_score is not null
    order by a.organisation_id,a.completed_at desc nulls last,a.created_at desc
  ),
  latest_reassessments as (
    select distinct on (r.organisation_id)
      r.organisation_id,r.delta_from_baseline,r.improvement_classification,r.verified_improvement,r.completed_at
    from public.khpos_reassessments r
    join active_orgs o on o.id=r.organisation_id
    where r.status='complete'
    order by r.organisation_id,r.completed_at desc nulls last,r.sequence_no desc
  ),
  priority_counts as (
    select p.organisation_id,
      count(*) filter (where p.status in ('approved','active','under_review'))::integer as active_count,
      count(*) filter (where p.status in ('approved','active','under_review') and p.indicator_score<=2)::integer as critical_count
    from public.khpos_priorities p
    group by p.organisation_id
  ),
  institution_rows as (
    select
      o.id,o.name,o.country,o.state,o.city,o.school_level,o.school_type,
      la.overall_score,la.completed_at as latest_assessment_at,
      lr.delta_from_baseline,lr.improvement_classification,coalesce(lr.verified_improvement,false) as verified_improvement,
      coalesce(pc.active_count,0) as active_priority_count,
      coalesce(pc.critical_count,0) as critical_priority_count
    from active_orgs o
    left join latest_assessments la on la.organisation_id=o.id
    left join latest_reassessments lr on lr.organisation_id=o.id
    left join priority_counts pc on pc.organisation_id=o.id
  ),
  portfolio_system_scores as (
    select la.organisation_id,s.system_id,s.score
    from latest_assessments la
    cross join lateral khpos_private.assessment_system_scores(la.id) s
  ),
  portfolio_system_stats as (
    select system_id,count(*)::integer as institution_count,
      round(percentile_cont(0.25) within group (order by score)::numeric,2) as p25,
      round(percentile_cont(0.50) within group (order by score)::numeric,2) as median,
      round(percentile_cont(0.75) within group (order by score)::numeric,2) as p75
    from portfolio_system_scores group by system_id
  ),
  summary as (
    select
      count(*)::integer as active_institutions,
      count(*) filter (where overall_score is not null)::integer as institutions_with_baseline,
      count(*) filter (where improvement_classification is not null)::integer as institutions_with_reassessment,
      count(*) filter (where verified_improvement)::integer as verified_improvement_institutions,
      sum(active_priority_count)::integer as active_priorities,
      sum(critical_priority_count)::integer as critical_priorities
    from institution_rows
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'summary',jsonb_build_object(
      'activeInstitutions',s.active_institutions,
      'institutionsWithBaseline',s.institutions_with_baseline,
      'institutionsWithReassessment',s.institutions_with_reassessment,
      'verifiedImprovementInstitutions',s.verified_improvement_institutions,
      'activePriorities',coalesce(s.active_priorities,0),
      'criticalPriorities',coalesce(s.critical_priorities,0)
    ),
    'systems',coalesce((select jsonb_agg(jsonb_build_object(
      'systemId',ps.system_id,'institutionCount',ps.institution_count,'p25',ps.p25,'median',ps.median,'p75',ps.p75
    ) order by ps.system_id) from portfolio_system_stats ps),'[]'::jsonb),
    'institutions',coalesce((select jsonb_agg(jsonb_build_object(
      'organisationId',ir.id,
      'name',ir.name,
      'country',ir.country,
      'state',ir.state,
      'city',ir.city,
      'schoolLevel',ir.school_level,
      'schoolType',ir.school_type,
      'currentOverallScore',ir.overall_score,
      'latestAssessmentAt',ir.latest_assessment_at,
      'deltaFromBaseline',ir.delta_from_baseline,
      'improvementClassification',ir.improvement_classification,
      'verifiedImprovement',ir.verified_improvement,
      'activePriorityCount',ir.active_priority_count,
      'criticalPriorityCount',ir.critical_priority_count,
      'attention',case
        when ir.overall_score is null then 'baseline_required'
        when ir.improvement_classification='regressed' then 'regression'
        when ir.critical_priority_count>0 then 'critical_priorities'
        when ir.improvement_classification is null then 'reassessment_required'
        else 'monitor'
      end
    ) order by ir.name) from institution_rows ir),'[]'::jsonb),
    'privacy',jsonb_build_object('learnerDataIncluded',false,'evidenceContentIncluded',false,'publicRankingEnabled',false)
  ) into v_result
  from summary s;

  return v_result;
end;
$$;

revoke all on function public.khpos_get_school_benchmark_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_get_portfolio_intelligence_server(uuid) from public,anon,authenticated;
grant execute on function public.khpos_get_school_benchmark_server(uuid,uuid) to service_role;
grant execute on function public.khpos_get_portfolio_intelligence_server(uuid) to service_role;

comment on table public.khpos_platform_admins is 'Explicit KHP-OS platform-custodian access. No school membership grants cross-institution portfolio access.';
comment on function public.khpos_get_school_benchmark_server(uuid,uuid) is 'Returns only anonymised peer medians and interquartile bands when at least five other institutions qualify; never returns peer identities or exact ranks.';
comment on function public.khpos_get_portfolio_intelligence_server(uuid) is 'Privileged KAEC-NG portfolio oversight across institutions; excludes learner-level data, evidence content and public rankings.';
