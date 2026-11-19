-- Custodian-only institutional investor reporting.
-- This is a governed management document, NOT an investor-facing dashboard.
-- All reads and writes go through an authenticated, role-checked server route.
create table if not exists public.khpos_custodian_investor_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organisations(id) on delete cascade,
  term_label text not null check (length(trim(term_label)) between 4 and 120),
  period_start date not null,
  period_end date not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint khpos_investor_report_period_order check (period_start <= period_end),
  constraint khpos_investor_report_approval_consistent check (
    (status = 'draft' and approved_by is null and approved_at is null)
    or (status = 'approved' and approved_by is not null and approved_at is not null)
  ),
  constraint khpos_investor_report_period_unique unique (school_id, period_start, period_end)
);
create index if not exists khpos_investor_reports_school_period_idx
  on public.khpos_custodian_investor_reports (school_id, period_end desc);

alter table public.khpos_custodian_investor_reports enable row level security;
revoke all on table public.khpos_custodian_investor_reports from public, anon, authenticated;
grant select, insert, update on table public.khpos_custodian_investor_reports to service_role;
-- No anon/authenticated RLS policies: privileged server queries must verify
-- both active school membership and an active SCHOOL_CUSTODIAN assignment.
-- Do not create an investor login or expose this table through standard reports.
