-- KHP-OS School Financial Health: auditable period statements, not a second accounting system.
-- Finance/Admin records monthly or term-aligned periods; Custodians approve before
-- amounts can be used as management-approved source records in investor reporting.
create extension if not exists btree_gist with schema extensions;

create table if not exists public.khpos_school_financial_periods (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.organisations(id) on delete cascade,
 period_start date not null,
 period_end date not null,
 fee_income bigint not null default 0 check(fee_income >= 0),
 other_income bigint not null default 0 check(other_income >= 0),
 operating_expenses bigint not null default 0 check(operating_expenses >= 0),
 cash_available bigint not null default 0 check(cash_available >= 0),
 outstanding_fees bigint not null default 0 check(outstanding_fees >= 0),
 learner_count integer not null default 0 check(learner_count >= 0),
 school_capacity integer not null default 0 check(school_capacity >= 0),
 break_even_target integer check(break_even_target >= 0),
 source_note text not null check(length(trim(source_note)) between 10 and 2500),
 management_note text not null default '',
 status text not null default 'draft' check(status in ('draft','submitted','returned','approved')),
 review_note text not null default '',
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint khpos_financial_period_order check(period_end >= period_start),
 constraint khpos_financial_period_span check (period_end <= period_start + 366),
 constraint khpos_financial_approved_pair check(
   (status = 'approved' and approved_by is not null and approved_at is not null)
   or (status <> 'approved' and approved_by is null and approved_at is null)
 )
);

-- Prevent two overlapping snapshots being summed into duplicate financial results.
alter table public.khpos_school_financial_periods
 add constraint khpos_financial_no_overlapping_periods
 exclude using gist(school_id with =, daterange(period_start,period_end,'[]') with &&);

create index if not exists khpos_financial_school_period_idx
 on public.khpos_school_financial_periods(school_id,period_end desc);
create index if not exists khpos_financial_school_approved_idx
 on public.khpos_school_financial_periods(school_id,period_start) where status='approved';

create table if not exists public.khpos_school_financial_events (
 id uuid primary key default gen_random_uuid(),
 record_id uuid not null references public.khpos_school_financial_periods(id) on delete cascade,
 school_id uuid not null references public.organisations(id) on delete cascade,
 actor_id uuid references auth.users(id),
 event_type text not null check(event_type in ('created','updated','submitted','returned','approved')),
 snapshot jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists khpos_school_financial_events_record_idx
 on public.khpos_school_financial_events(record_id,created_at desc);

create or replace function public.khpos_school_financial_audit_server()
 returns trigger
 language plpgsql
 security invoker
 set search_path=public,pg_temp
 as $function$
begin
 if TG_OP = 'UPDATE' and OLD.status = 'approved' then
   raise exception 'Approved financial periods are locked. Record corrections in a new, non-overlapping period.';
 end if;
 if TG_OP = 'UPDATE' and NEW.school_id is distinct from OLD.school_id then
   raise exception 'School financial records cannot change school.';
 end if;
 insert into public.khpos_school_financial_events(record_id,school_id,actor_id,event_type,snapshot)
 values(NEW.id,NEW.school_id,NEW.updated_by,
   case when TG_OP='INSERT' then 'created'
        when NEW.status = 'approved' and OLD.status is distinct from 'approved' then 'approved'
        when NEW.status = 'submitted' and OLD.status is distinct from 'submitted' then 'submitted'
        when NEW.status = 'returned' and OLD.status is distinct from 'returned' then 'returned'
        else 'updated' end,
   to_jsonb(NEW));
 return NEW;
end;
$function$;
revoke all on function public.khpos_school_financial_audit_server() from public, anon, authenticated;
drop trigger if exists khpos_school_financial_audit on public.khpos_school_financial_periods;
create trigger khpos_school_financial_audit
 after insert or update on public.khpos_school_financial_periods
 for each row execute function public.khpos_school_financial_audit_server();

alter table public.khpos_school_financial_periods enable row level security;
alter table public.khpos_school_financial_events enable row level security;
revoke all on public.khpos_school_financial_periods from public,anon,authenticated;
revoke all on public.khpos_school_financial_events from public,anon,authenticated;
-- Only the backend (service role) is granted access. All Next.js routes perform
-- school membership and active role assignment checks before every operation.
grant select,insert,update on public.khpos_school_financial_periods to service_role;
grant select,insert on public.khpos_school_financial_events to service_role;
