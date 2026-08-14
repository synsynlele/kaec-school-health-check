insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'khpos-evidence',
  'khpos-evidence',
  false,
  8388608,
  array['application/pdf','image/jpeg','image/png','image/webp','text/plain']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.khpos_evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  implementation_plan_id uuid not null references public.khpos_implementation_plans(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  source_type text not null default 'file' check (source_type in ('file','note')),
  title text not null,
  note text,
  storage_bucket text not null default 'khpos-evidence',
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or (size_bytes > 0 and size_bytes <= 8388608)),
  status text not null default 'awaiting_upload' check (status in ('awaiting_upload','uploaded','analyzing','assessed','needs_clarification','rejected','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_khpos_evidence_storage_path
  on public.khpos_evidence_submissions(storage_path)
  where storage_path is not null;
create index if not exists idx_khpos_evidence_submission_plan
  on public.khpos_evidence_submissions(implementation_plan_id, status, created_at desc);

create table if not exists public.khpos_evidence_assessments (
  id uuid primary key default gen_random_uuid(),
  evidence_submission_id uuid not null unique references public.khpos_evidence_submissions(id) on delete cascade,
  assessment_state text not null check (assessment_state in ('accepted','needs_clarification','rejected')),
  summary text not null,
  provider text not null default 'system',
  model text,
  prompt_version text not null default '1.0',
  created_at timestamptz not null default now()
);

create table if not exists public.khpos_evidence_links (
  id uuid primary key default gen_random_uuid(),
  evidence_submission_id uuid not null references public.khpos_evidence_submissions(id) on delete cascade,
  evidence_requirement_id uuid not null references public.khpos_evidence_requirements(id) on delete cascade,
  link_role text not null default 'primary' check (link_role in ('primary','supporting')),
  match_confidence numeric(5,2) not null check (match_confidence between 0 and 100),
  sufficiency_score numeric(5,2) not null check (sufficiency_score between 0 and 100),
  what_it_proves text not null,
  gaps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (evidence_submission_id, evidence_requirement_id)
);

create index if not exists idx_khpos_evidence_links_requirement
  on public.khpos_evidence_links(evidence_requirement_id, sufficiency_score desc, match_confidence desc);

create table if not exists public.khpos_review_preparations (
  id uuid primary key default gen_random_uuid(),
  review_schedule_id uuid not null unique references public.khpos_review_schedules(id) on delete cascade,
  implementation_plan_id uuid not null references public.khpos_implementation_plans(id) on delete cascade,
  required_count integer not null default 0 check (required_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  coverage_percent numeric(5,2) not null default 0 check (coverage_percent between 0 and 100),
  readiness text not null default 'not_ready' check (readiness in ('not_ready','partial','ready')),
  evidence_summary text not null default 'No sufficient evidence has been accepted yet.',
  evidence_gaps jsonb not null default '[]'::jsonb,
  prepared_at timestamptz not null default now()
);

alter table public.khpos_evidence_submissions enable row level security;
alter table public.khpos_evidence_assessments enable row level security;
alter table public.khpos_evidence_links enable row level security;
alter table public.khpos_review_preparations enable row level security;

revoke all privileges on table public.khpos_evidence_submissions from public, anon, authenticated;
revoke all privileges on table public.khpos_evidence_assessments from public, anon, authenticated;
revoke all privileges on table public.khpos_evidence_links from public, anon, authenticated;
revoke all privileges on table public.khpos_review_preparations from public, anon, authenticated;

grant select, insert, update, delete on table public.khpos_evidence_submissions to service_role;
grant select, insert, update, delete on table public.khpos_evidence_assessments to service_role;
grant select, insert, update, delete on table public.khpos_evidence_links to service_role;
grant select, insert, update, delete on table public.khpos_review_preparations to service_role;

create or replace function khpos_private.refresh_evidence_progress(p_plan_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, khpos_private, auth, pg_temp
as $$
declare
  v_required integer;
  v_accepted integer;
  v_coverage numeric(5,2);
  v_summary text;
  v_gaps jsonb;
begin
  update public.khpos_evidence_requirements er
  set status = case
    when er.status = 'superseded' then 'superseded'
    when exists (
      select 1
      from public.khpos_evidence_links l
      join public.khpos_evidence_submissions s on s.id = l.evidence_submission_id
      join public.khpos_evidence_assessments a on a.evidence_submission_id = s.id
      where l.evidence_requirement_id = er.id
        and a.assessment_state = 'accepted'
        and l.match_confidence >= 70
        and l.sufficiency_score >= 80
    ) then 'accepted'
    when exists (
      select 1 from public.khpos_evidence_links l
      where l.evidence_requirement_id = er.id
    ) then 'needs_clarification'
    else 'required'
  end
  where er.implementation_plan_id = p_plan_id;

  select
    count(*) filter (where required),
    count(*) filter (where required and status = 'accepted')
  into v_required, v_accepted
  from public.khpos_evidence_requirements
  where implementation_plan_id = p_plan_id
    and status <> 'superseded';

  v_required := coalesce(v_required, 0);
  v_accepted := coalesce(v_accepted, 0);
  v_coverage := case
    when v_required = 0 then 0
    else round((v_accepted::numeric / v_required::numeric) * 100, 2)
  end;

  select coalesce(
    string_agg(distinct nullif(trim(l.what_it_proves), ''), ' '),
    'No sufficient evidence has been accepted yet.'
  )
  into v_summary
  from public.khpos_evidence_links l
  join public.khpos_evidence_requirements er on er.id = l.evidence_requirement_id
  join public.khpos_evidence_assessments a on a.evidence_submission_id = l.evidence_submission_id
  where er.implementation_plan_id = p_plan_id
    and a.assessment_state = 'accepted'
    and l.match_confidence >= 70
    and l.sufficiency_score >= 80;

  select coalesce(jsonb_agg(x.gaps), '[]'::jsonb)
  into v_gaps
  from (
    select distinct l.gaps
    from public.khpos_evidence_links l
    join public.khpos_evidence_requirements er on er.id = l.evidence_requirement_id
    where er.implementation_plan_id = p_plan_id
      and jsonb_array_length(l.gaps) > 0
  ) x;

  update public.khpos_implementation_actions a
  set status = case
      when a.status = 'cancelled' then a.status
      when a.sequence_no = 1 and exists (
        select 1 from public.khpos_evidence_requirements er
        where er.implementation_plan_id=p_plan_id and er.sequence_no=1 and er.status='accepted'
      ) then 'completed'
      when a.sequence_no = 2 and exists (
        select 1 from public.khpos_evidence_requirements er
        where er.implementation_plan_id=p_plan_id and er.sequence_no=2 and er.status='accepted'
      ) then 'completed'
      when a.sequence_no = 3 and exists (
        select 1 from public.khpos_evidence_requirements er
        where er.implementation_plan_id=p_plan_id and er.sequence_no=3 and er.status='accepted'
      ) then 'completed'
      when a.sequence_no = 4 and v_required > 0 and v_accepted = v_required then 'completed'
      when a.sequence_no = 4 and exists (
        select 1 from public.khpos_evidence_requirements er
        where er.implementation_plan_id=p_plan_id and er.status='needs_clarification'
      ) then 'in_progress'
      when a.sequence_no = 5 and v_required > 0 and v_accepted = v_required then 'completed'
      when a.sequence_no = 5 and exists (
        select 1 from public.khpos_evidence_submissions s
        where s.implementation_plan_id=p_plan_id and s.status in ('assessed','needs_clarification')
      ) then 'in_progress'
      when a.sequence_no = 6 and v_required > 0 and v_accepted = v_required then 'in_progress'
      when a.sequence_no <= 3 and exists (
        select 1 from public.khpos_evidence_requirements er
        where er.implementation_plan_id=p_plan_id
          and er.sequence_no=a.sequence_no
          and er.status='needs_clarification'
      ) then 'in_progress'
      else a.status
    end,
    completed_at = case
      when (
        (a.sequence_no in (1,2,3) and exists (
          select 1 from public.khpos_evidence_requirements er
          where er.implementation_plan_id=p_plan_id and er.sequence_no=a.sequence_no and er.status='accepted'
        ))
        or (a.sequence_no in (4,5) and v_required > 0 and v_accepted = v_required)
      ) then coalesce(a.completed_at, now())
      else a.completed_at
    end
  where a.implementation_plan_id = p_plan_id;

  update public.khpos_milestones m
  set status = case
      when m.status = 'cancelled' then m.status
      when m.sequence_no = 1 and (
        select count(*) from public.khpos_evidence_requirements er
        where er.implementation_plan_id=p_plan_id and er.sequence_no <= 2 and er.status='accepted'
      ) >= least(2, greatest(1, v_required)) then 'achieved'
      when m.sequence_no = 2 and (
        exists (
          select 1 from public.khpos_evidence_requirements er
          where er.implementation_plan_id=p_plan_id and er.sequence_no=3 and er.status='accepted'
        ) or v_coverage >= 50
      ) then 'achieved'
      when m.sequence_no = 3 and v_coverage >= 75 then 'achieved'
      when m.sequence_no = 4 and v_required > 0 and v_accepted = v_required then 'achieved'
      else m.status
    end,
    achieved_at = case
      when (
        (m.sequence_no = 1 and (
          select count(*) from public.khpos_evidence_requirements er
          where er.implementation_plan_id=p_plan_id and er.sequence_no <= 2 and er.status='accepted'
        ) >= least(2, greatest(1, v_required)))
        or (m.sequence_no = 2 and (
          exists (
            select 1 from public.khpos_evidence_requirements er
            where er.implementation_plan_id=p_plan_id and er.sequence_no=3 and er.status='accepted'
          ) or v_coverage >= 50
        ))
        or (m.sequence_no = 3 and v_coverage >= 75)
        or (m.sequence_no = 4 and v_required > 0 and v_accepted = v_required)
      ) then coalesce(m.achieved_at, now())
      else m.achieved_at
    end
  where m.implementation_plan_id = p_plan_id;

  update public.khpos_review_schedules r
  set status = case
    when r.status in ('completed','cancelled') then r.status
    when r.review_type='midpoint' and (v_coverage >= 50 or current_date >= r.scheduled_for) then 'due'
    when r.review_type='outcome' and ((v_required > 0 and v_accepted = v_required) or current_date >= r.scheduled_for) then 'due'
    else 'pending'
  end
  where r.implementation_plan_id = p_plan_id;

  update public.khpos_implementation_plans
  set status = case
    when v_required > 0 and v_accepted = v_required then 'under_review'
    else 'active'
  end
  where id = p_plan_id and status in ('generated','active','under_review');

  update public.khpos_organisation_interventions oi
  set status = case
      when v_required > 0 and v_accepted = v_required then 'under_review'
      else 'active'
    end,
    updated_at = now()
  where oi.id = (
    select p.organisation_intervention_id
    from public.khpos_implementation_plans p
    where p.id=p_plan_id
  ) and oi.status in ('planned','active','under_review');

  update public.khpos_priorities pr
  set status='active', updated_at=now()
  where pr.id = (
    select oi.priority_id
    from public.khpos_implementation_plans p
    join public.khpos_organisation_interventions oi on oi.id=p.organisation_intervention_id
    where p.id=p_plan_id
  ) and pr.status='approved';

  insert into public.khpos_review_preparations (
    review_schedule_id, implementation_plan_id, required_count, accepted_count,
    coverage_percent, readiness, evidence_summary, evidence_gaps, prepared_at
  )
  select
    r.id,
    p_plan_id,
    v_required,
    v_accepted,
    v_coverage,
    case
      when r.review_type='outcome' and v_required > 0 and v_accepted = v_required then 'ready'
      when r.review_type='midpoint' and v_coverage >= 50 then 'ready'
      when v_accepted > 0 then 'partial'
      else 'not_ready'
    end,
    v_summary,
    v_gaps,
    now()
  from public.khpos_review_schedules r
  where r.implementation_plan_id=p_plan_id
  on conflict (review_schedule_id) do update set
    required_count=excluded.required_count,
    accepted_count=excluded.accepted_count,
    coverage_percent=excluded.coverage_percent,
    readiness=excluded.readiness,
    evidence_summary=excluded.evidence_summary,
    evidence_gaps=excluded.evidence_gaps,
    prepared_at=excluded.prepared_at;
end;
$$;

create or replace function public.khpos_record_evidence_assessment_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_submission_id uuid,
  p_summary text,
  p_matches jsonb,
  p_provider text default 'system',
  p_model text default null,
  p_prompt_version text default '1.0'
)
returns jsonb
language plpgsql
security definer
set search_path = public, khpos_private, auth, pg_temp
as $$
declare
  v_plan_id uuid;
  v_state text;
  v_best_conf numeric := 0;
  v_best_suff numeric := 0;
  v_match jsonb;
  v_requirement_id uuid;
  v_role text;
  v_valid_matches integer := 0;
begin
  select m.role into v_role
  from public.organisation_memberships m
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
  limit 1;

  if v_role is null then
    raise exception 'Active organisation membership is required.';
  end if;

  select s.implementation_plan_id into v_plan_id
  from public.khpos_evidence_submissions s
  join public.khpos_implementation_plans p on p.id=s.implementation_plan_id
  where s.id=p_submission_id
    and s.organisation_id=p_organisation_id
    and p.organisation_id=p_organisation_id
    and p.status in ('generated','active','under_review');

  if v_plan_id is null then
    raise exception 'Evidence submission or active implementation plan not found.';
  end if;

  delete from public.khpos_evidence_links
  where evidence_submission_id=p_submission_id;

  for v_match in
    select value from jsonb_array_elements(coalesce(p_matches,'[]'::jsonb))
  loop
    begin
      v_requirement_id := (v_match->>'requirementId')::uuid;
    exception when others then
      continue;
    end;

    if not exists (
      select 1 from public.khpos_evidence_requirements er
      where er.id=v_requirement_id
        and er.implementation_plan_id=v_plan_id
        and er.status<>'superseded'
    ) then
      continue;
    end if;

    insert into public.khpos_evidence_links (
      evidence_submission_id, evidence_requirement_id, link_role,
      match_confidence, sufficiency_score, what_it_proves, gaps
    ) values (
      p_submission_id,
      v_requirement_id,
      case when v_valid_matches=0 then 'primary' else 'supporting' end,
      least(100,greatest(0,coalesce((v_match->>'confidence')::numeric,0))),
      least(100,greatest(0,coalesce((v_match->>'sufficiencyScore')::numeric,0))),
      coalesce(nullif(trim(v_match->>'whatItProves'),''),'Evidence is relevant to this requirement.'),
      case
        when jsonb_typeof(v_match->'gaps')='array' then v_match->'gaps'
        else '[]'::jsonb
      end
    )
    on conflict (evidence_submission_id,evidence_requirement_id) do update set
      link_role=excluded.link_role,
      match_confidence=excluded.match_confidence,
      sufficiency_score=excluded.sufficiency_score,
      what_it_proves=excluded.what_it_proves,
      gaps=excluded.gaps;

    v_valid_matches := v_valid_matches + 1;
    v_best_conf := greatest(
      v_best_conf,
      least(100,greatest(0,coalesce((v_match->>'confidence')::numeric,0)))
    );
    v_best_suff := greatest(
      v_best_suff,
      least(100,greatest(0,coalesce((v_match->>'sufficiencyScore')::numeric,0)))
    );
  end loop;

  v_state := case
    when v_valid_matches = 0 then 'rejected'
    when v_best_conf >= 70 and v_best_suff >= 80 then 'accepted'
    else 'needs_clarification'
  end;

  insert into public.khpos_evidence_assessments (
    evidence_submission_id, assessment_state, summary, provider, model, prompt_version
  ) values (
    p_submission_id,
    v_state,
    coalesce(nullif(trim(p_summary),''),'Evidence assessed by KHP-OS.'),
    coalesce(nullif(trim(p_provider),''),'system'),
    p_model,
    coalesce(nullif(trim(p_prompt_version),''),'1.0')
  )
  on conflict (evidence_submission_id) do update set
    assessment_state=excluded.assessment_state,
    summary=excluded.summary,
    provider=excluded.provider,
    model=excluded.model,
    prompt_version=excluded.prompt_version,
    created_at=now();

  update public.khpos_evidence_submissions
  set status=case
      when v_state='accepted' then 'assessed'
      when v_state='rejected' then 'rejected'
      else 'needs_clarification'
    end,
    updated_at=now()
  where id=p_submission_id;

  perform khpos_private.refresh_evidence_progress(v_plan_id);

  insert into public.khpos_audit_events (
    organisation_id, actor_user_id, event_type, object_type, object_id, metadata
  ) values (
    p_organisation_id,
    p_actor_user_id,
    'evidence_assessed',
    'evidence_submission',
    p_submission_id,
    jsonb_build_object(
      'implementationPlanId',v_plan_id,
      'assessmentState',v_state,
      'validMatchCount',v_valid_matches,
      'bestConfidence',v_best_conf,
      'bestSufficiency',v_best_suff,
      'provider',coalesce(p_provider,'system'),
      'model',p_model,
      'promptVersion',coalesce(p_prompt_version,'1.0')
    )
  );

  return jsonb_build_object(
    'submissionId',p_submission_id,
    'implementationPlanId',v_plan_id,
    'assessmentState',v_state,
    'matchCount',v_valid_matches,
    'bestConfidence',v_best_conf,
    'bestSufficiency',v_best_suff
  );
end;
$$;

revoke all on function public.khpos_record_evidence_assessment_server(
  uuid,uuid,uuid,text,jsonb,text,text,text
) from public, anon, authenticated;
grant execute on function public.khpos_record_evidence_assessment_server(
  uuid,uuid,uuid,text,jsonb,text,text,text
) to service_role;
revoke all on function khpos_private.refresh_evidence_progress(uuid)
  from public, anon, authenticated;
grant execute on function khpos_private.refresh_evidence_progress(uuid)
  to service_role;

comment on table public.khpos_evidence_submissions is
  'Evidence supplied by the institution. Users provide reality; KHP-OS performs classification and sufficiency assessment.';
comment on table public.khpos_evidence_assessments is
  'System assessment of evidence relevance and sufficiency. Accepted means sufficient for transformation progress, not proof of authenticity.';
comment on table public.khpos_evidence_links is
  'System-generated links showing which implementation evidence requirements a submission supports and with what confidence.';
comment on table public.khpos_review_preparations is
  'Automatically refreshed review readiness derived from accepted evidence coverage.';
comment on function public.khpos_record_evidence_assessment_server(
  uuid,uuid,uuid,text,jsonb,text,text,text
) is
  'Server-only evidence assessment recorder. Validates organisation context, records system matches, updates evidence coverage, progress and review readiness.';
