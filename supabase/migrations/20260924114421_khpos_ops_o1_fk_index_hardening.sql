create index if not exists idx_khpos_ops_campuses_created_by
  on public.khpos_ops_campuses(created_by) where created_by is not null;

create index if not exists idx_khpos_ops_units_campus
  on public.khpos_ops_units(campus_id) where campus_id is not null;
create index if not exists idx_khpos_ops_units_parent
  on public.khpos_ops_units(parent_unit_id) where parent_unit_id is not null;
create index if not exists idx_khpos_ops_units_created_by
  on public.khpos_ops_units(created_by) where created_by is not null;

create index if not exists idx_khpos_ops_roles_reports_to
  on public.khpos_ops_roles(reports_to_role_id) where reports_to_role_id is not null;
create index if not exists idx_khpos_ops_roles_created_by
  on public.khpos_ops_roles(created_by) where created_by is not null;

create index if not exists idx_khpos_ops_role_assignments_campus
  on public.khpos_ops_role_assignments(campus_id) where campus_id is not null;
create index if not exists idx_khpos_ops_role_assignments_unit
  on public.khpos_ops_role_assignments(unit_id) where unit_id is not null;
create index if not exists idx_khpos_ops_role_assignments_appointed_by
  on public.khpos_ops_role_assignments(appointed_by) where appointed_by is not null;

create index if not exists idx_khpos_ops_role_charters_approved_by
  on public.khpos_ops_role_charters(approved_by) where approved_by is not null;

create index if not exists idx_khpos_ops_reporting_supervisor
  on public.khpos_ops_reporting_lines(supervisor_assignment_id);

create index if not exists idx_khpos_ops_backup_backup
  on public.khpos_ops_backup_assignments(backup_assignment_id);
create index if not exists idx_khpos_ops_backup_created_by
  on public.khpos_ops_backup_assignments(created_by) where created_by is not null;

create index if not exists idx_khpos_ops_audit_actor
  on public.khpos_ops_audit_events(actor_user_id, created_at desc) where actor_user_id is not null;
