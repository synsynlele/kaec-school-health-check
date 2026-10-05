create index if not exists idx_khpos_ops_decisions_campus
  on public.khpos_ops_decisions(campus_id)
  where campus_id is not null;

create index if not exists idx_khpos_ops_decisions_decided_by
  on public.khpos_ops_decisions(decided_by)
  where decided_by is not null;

create index if not exists idx_khpos_ops_decisions_unit
  on public.khpos_ops_decisions(unit_id)
  where unit_id is not null;
