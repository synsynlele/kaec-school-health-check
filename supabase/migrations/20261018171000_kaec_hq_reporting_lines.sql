-- KAEC-NG corporate reporting chain with five auditable cadences.
-- No actual assignments, report deadlines or approvals are assumed on installation.
create table if not exists public.kaec_hq_reporting_lines (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 4 and 160),
 purpose text not null check (char_length(btrim(purpose)) between 15 and 2000),
 reporter_user_id uuid not null references public.kaec_hq_members(user_id) on delete restrict,
 reviewer_user_id uuid not null references public.kaec_hq_members(user_id) on delete restrict,
 engagement_id uuid references public.kaec_hq_school_engagements(id) on delete restrict,
 cadence text not null check(cadence in ('daily','weekly','monthly','quarterly','yearly')),
 anchor_due_on date not null,
 next_cycle_index integer not null default 1 check(next_cycle_index >= 1),
 next_due_on date not null,
 status text not null default 'active' check(status in ('active','paused')),
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint hq_reporting_independent_recipient check(reporter_user_id<>reviewer_user_id),
 constraint hq_reporting_initial_date check(next_cycle_index<>1 or next_due_on=anchor_due_on)
);
create index if not exists hq_reporting_reporter_idx on public.kaec_hq_reporting_lines(reporter_user_id,status,next_due_on);
create index if not exists hq_reporting_reviewer_idx on public.kaec_hq_reporting_lines(reviewer_user_id,status,next_due_on);
create table if not exists public.kaec_hq_reporting_submissions (
 id uuid primary key default gen_random_uuid(),
 line_id uuid not null references public.kaec_hq_reporting_lines(id) on delete restrict,
 cycle_index integer not null check(cycle_index>=1),
 due_on date not null,
 status text not null default 'submitted' check(status in ('submitted','accepted','returned')),
 achievements text not null check(char_length(btrim(achievements)) between 20 and 3000),
 challenges text not null default '' check(char_length(challenges)<=2500),
 next_actions text not null check(char_length(btrim(next_actions)) between 10 and 2500),
 evidence_reference text not null default '' check(char_length(evidence_reference)<=700),
 submitted_by uuid not null references auth.users(id),
 submitted_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text not null default '' check(char_length(review_note)<=1500),
 updated_at timestamptz not null default now(),
 unique(line_id,cycle_index),
 constraint hq_reporting_review_consistent check(
 (status='submitted' and reviewed_by is null and reviewed_at is null and review_note='')
 or (status in ('accepted','returned') and reviewed_by is not null and reviewed_at is not null and char_length(btrim(review_note))>=15))
);
create index if not exists hq_reporting_submissions_line_idx on public.kaec_hq_reporting_submissions(line_id,cycle_index desc);
create index if not exists hq_reporting_submissions_status_idx on public.kaec_hq_reporting_submissions(status,submitted_at desc);
create table if not exists public.kaec_hq_reporting_events (
 id uuid primary key default gen_random_uuid(),
 entity_kind text not null,
 entity_id uuid not null,
 actor_user_id uuid not null references auth.users(id),
 action text not null,
 before_state jsonb,
 after_state jsonb,
 created_at timestamptz not null default now()
);
create index if not exists hq_reporting_events_record_idx on public.kaec_hq_reporting_events(entity_kind,entity_id,created_at);
alter table public.kaec_hq_reporting_lines enable row level security;
alter table public.kaec_hq_reporting_submissions enable row level security;
alter table public.kaec_hq_reporting_events enable row level security;
revoke all on public.kaec_hq_reporting_lines,public.kaec_hq_reporting_submissions,public.kaec_hq_reporting_events from public,anon,authenticated;
grant select,insert,update on public.kaec_hq_reporting_lines,public.kaec_hq_reporting_submissions to service_role;
grant select,insert on public.kaec_hq_reporting_events to service_role;

create or replace function public.kaec_hq_reporting_due(anchor date, frequency text, cycle_no integer)
returns date language plpgsql immutable set search_path=public,pg_temp as $$
begin
 if cycle_no < 1 or cycle_no > 100000 then raise exception 'Reporting cycle out of range';end if;
 case frequency
 when 'daily' then return anchor+(cycle_no-1);
 when 'weekly' then return anchor+7*(cycle_no-1);
 when 'monthly' then return (anchor+make_interval(months=>cycle_no-1))::date;
 when 'quarterly' then return (anchor+make_interval(months=>3*(cycle_no-1)))::date;
 when 'yearly' then return (anchor+make_interval(years=>cycle_no-1))::date;
 else raise exception 'Unsupported reporting cadence';
 end case;
end;
$$;
revoke all on function public.kaec_hq_reporting_due(date,text,integer) from public,anon,authenticated;
grant execute on function public.kaec_hq_reporting_due(date,text,integer) to service_role;

-- Atomic advance on submission: a report cannot silently skip a missing period.
-- A returned report is resubmitted by updating that same cycle, with audit history.
create or replace function public.kaec_hq_advance_report_line()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare updated_id uuid;
begin
 update public.kaec_hq_reporting_lines l
 set next_cycle_index=l.next_cycle_index+1,
     next_due_on=public.kaec_hq_reporting_due(l.anchor_due_on,l.cadence,l.next_cycle_index+1),
     updated_by=new.submitted_by, updated_at=now()
 where l.id=new.line_id and l.status='active'
   and l.next_cycle_index=new.cycle_index and l.next_due_on=new.due_on
   and l.reporter_user_id=new.submitted_by
 returning id into updated_id;
 if updated_id is null then raise exception 'Reporting line is not current or the period changed';end if;
 return new;
end;
$$;
drop trigger if exists kaec_hq_advance_report_line on public.kaec_hq_reporting_submissions;
create trigger kaec_hq_advance_report_line
 after insert on public.kaec_hq_reporting_submissions for each row
 execute function public.kaec_hq_advance_report_line();
revoke all on function public.kaec_hq_advance_report_line() from public,anon,authenticated;

create or replace function public.kaec_hq_audit_reporting()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare actor uuid;
begin
 actor:=case when tg_table_name='kaec_hq_reporting_submissions'
 then (to_jsonb(new)->>'submitted_by')::uuid
 else (to_jsonb(new)->>'updated_by')::uuid end;
 if tg_table_name='kaec_hq_reporting_submissions' and tg_op='UPDATE' then
 actor:=coalesce((to_jsonb(new)->>'reviewed_by')::uuid,(to_jsonb(new)->>'submitted_by')::uuid);
 end if;
 insert into public.kaec_hq_reporting_events(entity_kind,entity_id,actor_user_id,action,before_state,after_state)
 values(tg_table_name,new.id,actor,lower(tg_op),
 case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;
$$;
drop trigger if exists kaec_hq_audit_reporting_line on public.kaec_hq_reporting_lines;
create trigger kaec_hq_audit_reporting_line after insert or update on public.kaec_hq_reporting_lines
 for each row execute function public.kaec_hq_audit_reporting();
drop trigger if exists kaec_hq_audit_reporting_submission on public.kaec_hq_reporting_submissions;
create trigger kaec_hq_audit_reporting_submission after insert or update on public.kaec_hq_reporting_submissions
 for each row execute function public.kaec_hq_audit_reporting();
revoke all on function public.kaec_hq_audit_reporting() from public,anon,authenticated;
comment on table public.kaec_hq_reporting_lines is 'Explicit accountable reporter, different reviewer, due cadence and optional licensed school. Empty until activated.';
comment on table public.kaec_hq_reporting_submissions is 'One report per scheduled cycle; review requires recipient acceptance, never author self-approval.';
