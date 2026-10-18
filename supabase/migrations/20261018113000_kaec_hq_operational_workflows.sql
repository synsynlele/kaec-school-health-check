-- KAEC HQ operational workflow extension. Additive; existing school tables untouched.
alter table public.kaec_hq_records
  add column if not exists evidence_note text not null default '',
  add column if not exists review_note text not null default '',
  add column if not exists series_root_id uuid references public.kaec_hq_records(id) on delete restrict,
  add column if not exists previous_cycle_id uuid references public.kaec_hq_records(id) on delete restrict,
  add column if not exists series_anchor_on date,
  add column if not exists cycle_index integer not null default 1;

alter table public.kaec_hq_records
  add constraint kaec_hq_evidence_length check (char_length(evidence_note) <= 5000),
  add constraint kaec_hq_review_length check (char_length(review_note) <= 2000),
  add constraint kaec_hq_cycle_positive check (cycle_index >= 1),
  add constraint kaec_hq_work_recurrence_due check (module <> 'work' or cadence = 'once' or due_on is not null);

create unique index if not exists kaec_hq_cycle_unique_idx
  on public.kaec_hq_records(series_root_id,cycle_index)
  where series_root_id is not null;
create index if not exists kaec_hq_records_review_queue_idx
  on public.kaec_hq_records(status,module,updated_at desc)
  where status='in_review';

-- A recurring *work* cycle advances only when the previous occurrence is
-- explicitly completed by an authorised user through the server API.
-- This is not clock-based execution, email delivery or a payments scheduler.
-- No recursive trigger: the generated item is active, not completed.
create or replace function public.kaec_hq_roll_forward_work()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  anchor date;
  next_due date;
  next_status text;
begin
  if old.status = 'completed' or new.status <> 'completed'
     or new.module <> 'work'
     or new.cadence not in ('daily','weekly','monthly','quarterly','yearly')
     or new.due_on is null then
    return new;
  end if;

  anchor := coalesce(new.series_anchor_on,new.due_on);
  case new.cadence
    when 'daily' then next_due := anchor + new.cycle_index;
    when 'weekly' then next_due := anchor + (7 * new.cycle_index);
    when 'monthly' then next_due := (anchor + make_interval(months => new.cycle_index))::date;
    when 'quarterly' then next_due := (anchor + make_interval(months => 3 * new.cycle_index))::date;
    when 'yearly' then next_due := (anchor + make_interval(years => new.cycle_index))::date;
  end case;

  -- Suspension or loss of the accountable person never silently creates
  -- an active obligation with an invalid owner. It needs reassignment.
  select case when exists (
    select 1 from public.kaec_hq_members m
    where m.user_id = new.owner_user_id and m.status = 'active'
  ) and (
    new.priority <> 'critical' or (
      new.backup_user_id is not null and exists (
        select 1 from public.kaec_hq_members m
        where m.user_id = new.backup_user_id and m.status='active'
      )
    )
  ) then 'active' else 'draft' end into next_status;

  insert into public.kaec_hq_records (
    module,record_type,title,description,status,priority,
    owner_user_id,backup_user_id,due_on,cadence,amount,currency,
    created_by,updated_by,series_root_id,previous_cycle_id,
    series_anchor_on,cycle_index
  ) values (
    new.module,new.record_type,new.title,new.description,next_status,new.priority,
    case when next_status='draft' then null else new.owner_user_id end,
    case when next_status='draft' then null else (
      select m.user_id from public.kaec_hq_members m
      where m.user_id=new.backup_user_id and m.status='active'
    ) end,
    next_due,new.cadence,new.amount,new.currency,
    new.created_by,new.updated_by,coalesce(new.series_root_id,new.id),new.id,
    anchor,new.cycle_index+1
  )
  on conflict (series_root_id,cycle_index) where series_root_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists kaec_hq_work_roll_forward on public.kaec_hq_records;
create trigger kaec_hq_work_roll_forward
after update of status on public.kaec_hq_records
for each row execute function public.kaec_hq_roll_forward_work();
revoke all on function public.kaec_hq_roll_forward_work() from public, anon, authenticated;

comment on column public.kaec_hq_records.evidence_note is
  'Submission or self-completion evidence; no attachments or secrets.';
comment on column public.kaec_hq_records.review_note is
  'Immutable after final independent review; author cannot self-approve controlled work.';
comment on column public.kaec_hq_records.series_anchor_on is
  'Original due date; prevents month-end recurrence drift.';
