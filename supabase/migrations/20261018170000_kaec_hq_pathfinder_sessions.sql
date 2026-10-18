-- KAEC HQ: scheduled supervision, on-site check-in/out, virtual sessions, reviewed outcomes.
-- Private corporate execution metadata only: no GPS tracking or student/school-private data.
create table if not exists public.kaec_hq_pathfinder_sessions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.kaec_hq_school_engagements(id) on delete restrict,
  representative_user_id uuid not null references public.kaec_hq_members(user_id) on delete restrict,
  mode text not null check (mode in ('virtual','onsite')),
  title text not null check(char_length(btrim(title)) between 4 and 180),
  objective text not null check(char_length(btrim(objective)) between 15 and 2000),
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz,
  status text not null default 'scheduled' check(status in ('scheduled','checked_in','completed','cancelled')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  outcome_note text not null default '' check(char_length(outcome_note)<=3000),
  issues_note text not null default '' check(char_length(issues_note)<=2000),
  resolution_note text not null default '' check(char_length(resolution_note)<=2000),
  evidence_reference text not null default '' check(char_length(evidence_reference)<=700),
  next_action text not null default '' check(char_length(next_action)<=1500),
  cancellation_reason text not null default '' check(char_length(cancellation_reason)<=1000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text not null default '' check(char_length(review_note)<=1500),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kaec_pathfinder_time_range check (scheduled_end_at is null or scheduled_end_at > scheduled_start_at),
  constraint kaec_pathfinder_attendance_consistency check (
    (mode='onsite' and (
      (status='scheduled' and check_in_at is null and check_out_at is null)
      or (status='checked_in' and check_in_at is not null and check_out_at is null)
      or (status='completed' and check_in_at is not null and check_out_at is not null and check_out_at>=check_in_at)
      or (status='cancelled' and check_out_at is null)))
    or (mode='virtual' and check_in_at is null and check_out_at is null and
      status in ('scheduled','completed','cancelled'))
  ),
  constraint kaec_pathfinder_completed_outcome check (
    status <> 'completed' or char_length(btrim(outcome_note))>=20
  ),
  constraint kaec_pathfinder_cancel_reason check (
    status <> 'cancelled' or char_length(btrim(cancellation_reason))>=15
  ),
  constraint kaec_pathfinder_review_consistency check (
    (reviewed_by is null and reviewed_at is null and review_note='') or
    (reviewed_by is not null and reviewed_at is not null and char_length(btrim(review_note))>=15
      and status='completed')
  )
);
create index if not exists kaec_pathfinder_sessions_rep_schedule_idx
  on public.kaec_hq_pathfinder_sessions(representative_user_id,scheduled_start_at desc);
create index if not exists kaec_pathfinder_sessions_engagement_schedule_idx
  on public.kaec_hq_pathfinder_sessions(engagement_id,scheduled_start_at desc);
create index if not exists kaec_pathfinder_sessions_status_schedule_idx
  on public.kaec_hq_pathfinder_sessions(status,scheduled_start_at);

alter table public.kaec_hq_pathfinder_sessions enable row level security;
revoke all on public.kaec_hq_pathfinder_sessions from public,anon,authenticated;
grant select,insert,update on public.kaec_hq_pathfinder_sessions to service_role;

create or replace function public.kaec_hq_audit_pathfinder_session()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  insert into public.kaec_hq_school_events
     (entity_kind,entity_id,actor_user_id,action,before_state,after_state)
  values
     ('kaec_hq_pathfinder_sessions',new.id,new.updated_by,lower(tg_op),
      case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
  return new;
end;
$$;
drop trigger if exists kaec_hq_pathfinder_session_audit on public.kaec_hq_pathfinder_sessions;
create trigger kaec_hq_pathfinder_session_audit
after insert or update on public.kaec_hq_pathfinder_sessions
for each row execute function public.kaec_hq_audit_pathfinder_session();
revoke all on function public.kaec_hq_audit_pathfinder_session() from public,anon,authenticated;
comment on table public.kaec_hq_pathfinder_sessions is
 'Scheduled KAEC corporate supervision, server-timestamped self-attested onsite check-in/out and independent review. Never infer GPS presence; do not hold child PII.';
