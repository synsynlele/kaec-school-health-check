create index if not exists idx_khpos_platform_audit_events_target
  on public.khpos_platform_audit_events(target_user_id, created_at desc)
  where target_user_id is not null;
