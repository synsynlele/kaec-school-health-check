-- Disabled slots keep their identity and attendance history but no longer
-- reserve a start time on the active weekly timetable.
create unique index if not exists khpos_active_period_unique
  on public.khpos_ops_class_periods (stream_id, weekday, starts_at)
  where is_active;

alter table public.khpos_ops_class_periods
  drop constraint if exists khpos_period_unique;
