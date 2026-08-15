create table if not exists public.kshc_report_versions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  version_number integer not null,
  engine text not null default 'engine',
  full_report jsonb not null,
  archived_at timestamptz not null default now(),
  unique (assessment_id, version_number)
);

alter table public.kshc_report_versions enable row level security;
revoke all privileges on table public.kshc_report_versions from anon, authenticated;
create index if not exists idx_kshc_report_versions_assessment
  on public.kshc_report_versions (assessment_id, version_number desc);

create or replace function public.kshc_replace_report_narrative_server(
  p_assessment_id uuid,
  p_full_report jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current jsonb;
  v_version integer;
begin
  select r.full_report
    into v_current
  from public.reports r
  where r.assessment_id = p_assessment_id
  for update;

  if v_current is null then
    raise exception 'KSHC report not found.';
  end if;

  if coalesce(v_current->>'overallScore','') <> coalesce(p_full_report->>'overallScore','')
     or coalesce(v_current->'departmentScores','[]'::jsonb) <> coalesce(p_full_report->'departmentScores','[]'::jsonb) then
    raise exception 'KSHC report narrative replacement cannot change authoritative scores.';
  end if;

  select coalesce(max(v.version_number),0) + 1
    into v_version
  from public.kshc_report_versions v
  where v.assessment_id = p_assessment_id;

  insert into public.kshc_report_versions (
    assessment_id,
    version_number,
    engine,
    full_report
  ) values (
    p_assessment_id,
    v_version,
    coalesce(v_current->>'engine','engine'),
    v_current
  );

  update public.reports
  set executive_summary = coalesce(p_full_report->>'executiveSummary',''),
      strengths = coalesce(p_full_report->'strengths','[]'::jsonb),
      weaknesses = coalesce(p_full_report->'weaknesses','[]'::jsonb),
      recommendations = coalesce(p_full_report->'recommendations','[]'::jsonb),
      ninety_day_plan = jsonb_build_object(
        'plan30',coalesce(p_full_report->'plan30','[]'::jsonb),
        'plan60',coalesce(p_full_report->'plan60','[]'::jsonb),
        'plan90',coalesce(p_full_report->'plan90','[]'::jsonb)
      ),
      full_report = p_full_report
  where assessment_id = p_assessment_id;

  return v_version;
end;
$$;

revoke all on function public.kshc_replace_report_narrative_server(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.kshc_replace_report_narrative_server(uuid,jsonb) to service_role;

comment on table public.kshc_report_versions is
  'Immutable archive of prior KSHC report narratives. Reassessment is not required for AI narrative upgrades; authoritative scores remain unchanged.';
comment on function public.kshc_replace_report_narrative_server(uuid,jsonb) is
  'Service-role-only atomic narrative replacement. Archives the previous report and rejects score changes.';
