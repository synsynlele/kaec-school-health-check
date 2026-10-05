create index if not exists idx_khpos_ops_execution_profiles_configured_by
  on public.khpos_ops_process_execution_profiles(configured_by)
  where configured_by is not null;
