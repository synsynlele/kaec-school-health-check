create table public.khpos_finance_reconciliations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organisations(id),
  campus_id uuid not null references public.khpos_ops_campuses(id),
  period_id uuid not null references public.khpos_finance_periods(id),
  account_id uuid not null references public.khpos_finance_accounts(id),
  through_date date not null,
  statement_balance bigint not null,
  reference text not null check(length(btrim(reference)) between 1 and 160),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(account_id,through_date)
);
alter table public.khpos_finance_reconciliations enable row level security;
revoke all on public.khpos_finance_reconciliations from public,anon,authenticated,service_role;

create table public.khpos_finance_controls (
  school_id uuid primary key references public.organisations(id),
  expense_review_at bigint not null check(expense_review_at between 0 and 100000000000000),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.khpos_finance_controls enable row level security;
revoke all on public.khpos_finance_controls from public,anon,authenticated,service_role;

create unique index khpos_finance_pending_reference on public.khpos_finance_requests(school_id,lower(payload->>'reference'))
  where status='pending' and payload->>'reference' is not null;
create index khpos_finance_source_account on public.khpos_finance_entries(account_id,posted) where account_id is not null;
create index khpos_finance_destination_account on public.khpos_finance_entries(to_account_id,posted) where to_account_id is not null;

-- One history drives the cash ledger and reports. Transfers have two equal
-- and opposite cash effects, and neither side belongs to income or expenses.
create view khpos_private.finance_cash_movements as
select e.*,
  case coalesce(o.kind,e.kind) when 'payment' then 'fees' when 'refund' then 'fees'
    when 'expense' then 'expense' when 'income' then 'income' else 'transfer' end as cash_category,
  (case coalesce(o.kind,e.kind) when 'expense' then -1 when 'transfer' then -1 when 'refund' then -1 else 1 end)
    *(case when e.kind='reverse' then -e.amount else e.amount end) as cash_delta
from public.khpos_finance_entries e left join public.khpos_finance_entries o on o.id=e.original_id and e.kind='reverse'
where e.account_id is not null;
revoke all on khpos_private.finance_cash_movements from public,anon,authenticated,service_role;

create function khpos_private.finance_account_balance(account uuid, as_of date default 'infinity')
returns bigint language sql stable set search_path='' as $$
  select a.opening+coalesce((select sum(x.cash_delta) from khpos_private.finance_cash_movements x
    where x.account_id=a.id and x.posted<=as_of),0)
    -coalesce((select sum(x.cash_delta) from khpos_private.finance_cash_movements x
    where x.to_account_id=a.id and x.posted<=as_of),0)
  from public.khpos_finance_accounts a where a.id=account and a.opened<=as_of
$$;

create function khpos_private.finance_guard_post()
returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.khpos_finance_reconciliations r
    where r.account_id in (new.account_id,new.to_account_id) and r.through_date>=new.posted) then
    raise exception 'That date is already reconciled. Use a later correction date.' using errcode='22023';
  end if;
  return new;
end
$$;
create trigger khpos_finance_reconciled_history before insert on public.khpos_finance_entries
for each row execute function khpos_private.finance_guard_post();

create function public.khpos_finance_ledger_server(p_actor uuid,p_school uuid,p_campus uuid,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  p public.khpos_finance_periods;
  term public.khpos_ops_academic_terms;
  account_row public.khpos_finance_accounts;
  request_row public.khpos_finance_requests;
  previous public.khpos_finance_commands;
  found_id uuid;
  period_id uuid := nullif(p_input->>'period','')::uuid;
  record_key uuid := nullif(p_input->>'key','')::uuid;
  source uuid := nullif(p_input->>'id','')::uuid;
  result jsonb;
  date_value date;
  action_kind text := p_input->>'kind';
  opening bigint;
  page_offset int := greatest(0,least(coalesce((p_input->>'offset')::int,0),250000));
  audit_desc text;
  approval_note text;
  search text := lower(btrim(coalesce(p_input->>'search','')));
  student uuid := nullif(p_input->>'learner','')::uuid;
  item jsonb;
  batch jsonb := '[]';
  row_result jsonb;
  amount_value bigint;
  review_threshold bigint;
begin
  if p_campus is null then raise exception 'Choose a campus.' using errcode='22023'; end if;
  perform khpos_private.finance_scope(p_actor,p_school,p_campus);
  if p_action='controls' then
    return jsonb_build_object('expenseThreshold',coalesce((select c.expense_review_at from public.khpos_finance_controls c where c.school_id=p_school),0));
  end if;
  if p_action='periods' then
    return coalesce((select jsonb_agg(to_jsonb(v)) from (
      select t.id as term,t.term_name as name,t.session_label as session,t.status,t.start_date as starts,t.end_date as ends,
        f.id,f.closed
      from public.khpos_ops_academic_terms t left join public.khpos_finance_periods f on f.term_id=t.id and f.campus_id=p_campus
      where t.organisation_id=p_school and (t.campus_id is null or t.campus_id=p_campus) and t.status<>'cancelled'
      order by t.start_date desc,t.id
    ) v),'[]');
  end if;
  if p_action='accounts' then
    return coalesce((select jsonb_agg(to_jsonb(v)) from (
      select a.id,a.name,a.kind,a.opened,a.opening,khpos_private.finance_account_balance(a.id) as balance,
        (select max(r.through_date) from public.khpos_finance_reconciliations r where r.account_id=a.id) as reconciled
      from public.khpos_finance_accounts a where a.school_id=p_school and a.campus_id=p_campus order by a.name
    ) v),'[]');
  end if;
  select * into p from public.khpos_finance_periods f where f.id=period_id and f.school_id=p_school and f.campus_id=p_campus;
  if p_action in ('invoices','entries','schedules','requests','reconciliations','audit','invoice','receipt','statement') then
    if p.id is null then raise exception 'Choose a configured accounting period.' using errcode='22023'; end if;
    case p_action
      when 'invoices','invoice' then
        result := coalesce((select jsonb_agg(to_jsonb(v)) from (
          select i.id,i.number,i.label,i.learner_id,i.learner_name,i.admission_number,i.issued,i.due,i.amount,i.opening,
            khpos_private.finance_invoice_balance(i.id) as balance
          from public.khpos_finance_invoices i where i.school_id=p_school and i.campus_id=p_campus
            and (p_action='invoice' or i.period_id=p.id)
            and (p_action<>'invoice' or i.id=source)
            and (student is null or i.learner_id=student)
            and (search='' or strpos(lower(i.learner_name||' '||i.admission_number||' '||i.label),search)>0)
          order by i.number desc offset page_offset limit 51
        ) v),'[]');
      when 'entries','receipt' then
        result := coalesce((select jsonb_agg(to_jsonb(v)) from (
          select e.id,e.number,e.kind,e.posted,e.amount,e.reference,e.note,e.category,e.actor_id,a.name as account,
            d.name as destination,e.learner_name as learner,e.admission_number,i.number as invoice,b.amount as allocated,
            e.original_id,EXISTS(select 1 from public.khpos_finance_reconciliations r
              where r.account_id=e.account_id and r.through_date>=e.posted)
              and (e.to_account_id is null or EXISTS(select 1 from public.khpos_finance_reconciliations r
                where r.account_id=e.to_account_id and r.through_date>=e.posted)) as reconciled
          from public.khpos_finance_entries e left join public.khpos_finance_accounts a on a.id=e.account_id
          left join public.khpos_finance_accounts d on d.id=e.to_account_id
          left join public.khpos_finance_allocations b on b.entry_id=e.id
          left join public.khpos_finance_invoices i on i.id=b.invoice_id
          where e.school_id=p_school and e.campus_id=p_campus and (p_action='receipt' or e.period_id=p.id or (p_input->>'includeHistory'='true' and e.posted<=p.ends))
            and (p_action<>'receipt' or (e.id=source and e.kind in ('payment','refund')))
            and (student is null or e.learner_id=student)
            and (search='' or strpos(lower(e.reference||' '||coalesce(e.learner_name,'')||' '||coalesce(e.admission_number,'')||' '||e.category),search)>0)
          order by e.number desc offset page_offset limit 51
        ) v),'[]');
      when 'schedules' then
        result := coalesce((select jsonb_agg(to_jsonb(v)) from (
          select distinct on (s.class_id,s.label,s.fee_category) s.* from public.khpos_finance_schedules s
          where s.period_id=p.id order by s.class_id,s.label,s.fee_category,s.version desc offset page_offset limit 51
        ) v),'[]');
      when 'requests' then
        result := coalesce((select jsonb_agg(to_jsonb(v)) from (
          select r.* from public.khpos_finance_requests r where r.period_id=p.id order by r.submitted_at desc,r.id offset page_offset limit 51
        ) v),'[]');
      when 'reconciliations' then
        result := coalesce((select jsonb_agg(to_jsonb(v)) from (
          select r.*,a.name as account from public.khpos_finance_reconciliations r
          join public.khpos_finance_accounts a on a.id=r.account_id where r.period_id=p.id
          order by r.through_date desc,r.id offset page_offset limit 51
        ) v),'[]');
      when 'audit' then
        result := coalesce((select jsonb_agg(to_jsonb(v)) from (
          select x.id,x.actor_id,x.action,x.record_id,x.detail,x.happened_at
          from public.khpos_finance_audit x where x.school_id=p_school and x.campus_id=p_campus order by x.id desc offset page_offset limit 51
        ) v),'[]');
      when 'statement' then
        if student is null or not exists(select 1 from public.khpos_ops_learner_anchors l where l.id=student
          and l.organisation_id=p_school and (l.campus_id=p_campus or exists(select 1 from public.khpos_finance_invoices i
            where i.learner_id=student and i.school_id=p_school and i.campus_id=p_campus))) then
          raise exception 'Choose a learner with records in this campus.' using errcode='22023';
        end if;
        result := jsonb_build_object('credit',khpos_private.finance_learner_credit(p_school,p_campus,student,p.ends),'invoices',
          coalesce((select jsonb_agg(to_jsonb(v)) from (
            select i.number,i.label,i.learner_name,i.admission_number,i.due,i.amount,khpos_private.finance_invoice_balance(i.id,p.ends) as balance
            from public.khpos_finance_invoices i where i.learner_id=student and i.school_id=p_school and i.campus_id=p_campus and i.issued<=p.ends
            order by i.issued,i.number offset page_offset limit 51
          ) v),'[]'),'transactions',coalesce((select jsonb_agg(to_jsonb(v)) from (
            select e.number,e.kind,e.posted,e.amount,e.reference from public.khpos_finance_entries e
            where e.learner_id=student and e.school_id=p_school and e.campus_id=p_campus and e.posted<=p.ends
            order by e.posted,e.number offset page_offset limit 51
          ) v),'[]'));
    end case;
    return result;
  end if;

  if p_action in ('previewOpening','importOpening') then
    if p.id is null or p.closed or jsonb_typeof(p_input->'rows') is distinct from 'array'
      or jsonb_array_length(p_input->'rows') not between 1 and 50 then
      raise exception 'Choose an open period and send between 1 and 50 opening balances.' using errcode='22023';
    end if;
    if p_action='importOpening' then
      perform pg_advisory_xact_lock(hashtextextended('finance:'||p_school::text,0));
      select * into p from public.khpos_finance_periods f where f.id=p.id and not f.closed;
      if not found then raise exception 'Choose an open period.' using errcode='22023'; end if;
    end if;
    for item in select value from jsonb_array_elements(p_input->'rows') loop
      begin
        select f.learner_id into student from public.khpos_finance_learners f
          join public.khpos_ops_learner_anchors l on l.id=f.learner_id
          where f.school_id=p_school and l.organisation_id=p_school and l.campus_id=p_campus
            and lower(f.admission_number)=lower(btrim(item->>'admission'));
        if not found then raise exception 'Admission number is not registered in this campus.' using errcode='22023'; end if;
        action_kind := item->>'kind';
        amount_value := khpos_private.finance_amount(item->>'amount');
        date_value := (p_input->>'date')::date;
        if action_kind is null or action_kind not in ('openingDebt','credit') or date_value is null or date_value not between p.starts and p.ends
          or date_value>(now() at time zone 'Africa/Lagos')::date then
          raise exception 'Choose a balance type and effective date in the open period.' using errcode='22023';
        end if;
        if exists(select 1 from public.khpos_finance_requests r where r.school_id=p_school and r.kind=action_kind
          and r.payload->>'learner'=student::text and r.status in ('pending','approved'))
          or exists(select 1 from public.khpos_finance_invoices i where i.school_id=p_school and i.learner_id=student and i.opening and action_kind='openingDebt')
          or exists(select 1 from public.khpos_finance_entries e where e.school_id=p_school and e.learner_id=student and e.kind='credit' and action_kind='credit') then
          row_result := jsonb_build_object('result','already recorded or awaiting review');
        elsif p_action='importOpening' then
          row_result := public.khpos_finance_ledger_server(p_actor,p_school,p_campus,'post',
            jsonb_build_object('period',p.id,'key',gen_random_uuid(),'learner',student,'kind',action_kind,'amount',amount_value,'date',date_value,
              'reference','OPENING-'||student::text||'-'||gen_random_uuid()::text,'note','Historical learner balance imported for review.'))
            || jsonb_build_object('result','awaiting review');
        else
          row_result := jsonb_build_object('result','ready');
        end if;
      exception when sqlstate '22023' or invalid_datetime_format or datetime_field_overflow or invalid_text_representation then
        row_result := jsonb_build_object('result','error','message',case when sqlstate='22023' then sqlerrm else 'Check the entered date and balance.' end);
      end;
      batch := batch || jsonb_build_array(row_result);
    end loop;
    return batch;
  end if;

  if record_key is null then raise exception 'A request identifier is required. Reload and try again.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('finance:'||p_school::text,0));
  select * into previous from public.khpos_finance_commands c where c.school_id=p_school and c.request_key=record_key;
  if found then
    if previous.actor_id<>p_actor or previous.campus_id<>p_campus or previous.action<>p_action or previous.input<>p_input then
      raise exception 'This request identifier is already in use. Reload and try again.' using errcode='22023';
    end if;
    return previous.result;
  end if;
  -- Re-read the open period under the same lock used for posting and approval.
  select * into p from public.khpos_finance_periods f where f.id=period_id and f.school_id=p_school and f.campus_id=p_campus;
  if p_action not in ('openPeriod','addAccount','reopenPeriod','setThreshold') and (p.id is null or p.closed) then
    raise exception 'Select an open accounting period.' using errcode='22023';
  end if;
  case p_action
    when 'setThreshold' then
      perform khpos_private.finance_scope(p_actor,p_school,null,true);
      review_threshold := case when p_input->>'amount'='0' then 0 else khpos_private.finance_amount(p_input->>'amount') end;
      insert into public.khpos_finance_controls(school_id,expense_review_at,updated_by)
        values(p_school,review_threshold,p_actor) on conflict(school_id)
        do update set expense_review_at=excluded.expense_review_at,updated_by=excluded.updated_by,updated_at=now();
      result := jsonb_build_object('expenseThreshold',review_threshold);
    when 'openPeriod' then
      select * into term from public.khpos_ops_academic_terms t where t.id=(p_input->>'term')::uuid
        and t.organisation_id=p_school and (t.campus_id is null or t.campus_id=p_campus) and t.status<>'cancelled';
      if not found then raise exception 'Choose a term for this campus.' using errcode='22023'; end if;
      select f.id into found_id from public.khpos_finance_periods f where f.campus_id=p_campus and f.term_id=term.id;
      if found_id is null then
        if exists(select 1 from public.khpos_finance_periods f where f.campus_id=p_campus and f.starts<=term.end_date and f.ends>=term.start_date) then
          raise exception 'The dates overlap another accounting period for this campus.' using errcode='22023';
        end if;
        insert into public.khpos_finance_periods(school_id,campus_id,term_id,starts,ends)
          values(p_school,p_campus,term.id,term.start_date,term.end_date) returning id into found_id;
      end if;
    when 'addAccount' then
      opening := coalesce((p_input->>'opening')::bigint,0);
      date_value := (p_input->>'date')::date;
      if action_kind is null or action_kind not in ('cash','bank') or date_value is null
        or date_value>(now() at time zone 'Africa/Lagos')::date or coalesce(length(btrim(p_input->>'name')),0) not between 1 and 100 then
        raise exception 'Enter an account name, type and opening date.' using errcode='22023';
      end if;
      if exists(select 1 from public.khpos_finance_periods f where f.campus_id=p_campus and f.closed and f.ends>=date_value) then
        raise exception 'The account opening date would change a closed accounting period.' using errcode='22023';
      end if;
      insert into public.khpos_finance_accounts(school_id,campus_id,name,kind,opened,opening)
      values(p_school,p_campus,btrim(p_input->>'name'),action_kind,date_value,opening) returning id into found_id;
    when 'closePeriod','reopenPeriod' then
      perform khpos_private.finance_scope(p_actor,p_school,p_campus,true);
      if p.id is null or length(btrim(coalesce(p_input->>'note','')))<10 then
        raise exception 'Choose an accounting period and add a reason of at least 10 characters.' using errcode='22023';
      end if;
      if p_action='closePeriod' and (p.ends>(now() at time zone 'Africa/Lagos')::date or exists(
          select 1 from public.khpos_finance_requests r where r.period_id=p.id and r.status='pending')) then
        raise exception 'Wait until the period ends and resolve pending approvals before closing it.' using errcode='22023';
      end if;
      update public.khpos_finance_periods f set closed=(p_action='closePeriod') where f.id=p.id returning f.id into found_id;
      audit_desc := left(btrim(p_input->>'note'),1000);
    when 'saveSchedule','billSchedule','billLearner' then
      result := khpos_private.finance_billing(p_actor,p_school,p_campus,p,p_input,p_action);
      found_id := (result->>'id')::uuid;
    when 'post' then
      if action_kind='expense' then
        amount_value := khpos_private.finance_amount(p_input->>'amount');
        select c.expense_review_at into review_threshold from public.khpos_finance_controls c where c.school_id=p_school;
      end if;
      if action_kind in ('payment','income','expense','transfer','apply')
        and not (action_kind='expense' and coalesce(review_threshold,0)>0 and amount_value>=review_threshold) then
        result := khpos_private.finance_post(p_actor,p_school,p_campus,p,p_input,action_kind);
        found_id := (result->>'id')::uuid;
      elsif action_kind in ('credit','openingDebt','refund','reverse','discount','scholarship','waiver','expense') then
        perform khpos_private.finance_amount(p_input->>'amount');
        if length(btrim(coalesce(p_input->>'note','')))<10 then
          raise exception 'Explain this adjustment in at least 10 characters.' using errcode='22023';
        end if;
        -- Validate the complete accounting action before queueing it. The
        -- subtransaction rolls back the simulated writes before review.
        begin
          if action_kind='openingDebt' then
            result := khpos_private.finance_billing(p_actor,p_school,p_campus,p,
              p_input||jsonb_build_object('label','Opening fee balance'),'openingDebt');
            if (result->>'created')::integer=0 then
              raise exception 'This learner already has an opening fee balance.' using errcode='22023';
            end if;
          else
            perform khpos_private.finance_post(p_actor,p_school,p_campus,p,p_input,action_kind);
          end if;
          raise exception 'Finance approval preflight complete.' using errcode='PF001';
        exception when sqlstate 'PF001' then null;
        end;
        insert into public.khpos_finance_requests(school_id,campus_id,period_id,request_key,kind,payload,submitted_by)
          values(p_school,p_campus,p.id,record_key,action_kind,p_input-'key',p_actor) returning id into found_id;
        result := jsonb_build_object('id',found_id,'pending',true);
      else raise exception 'Choose a supported transaction type.' using errcode='22023';
      end if;
    when 'approveRequest','returnRequest' then
      perform khpos_private.finance_scope(p_actor,p_school,p_campus,true);
      approval_note := left(btrim(coalesce(p_input->>'note','')),1000);
      select * into request_row from public.khpos_finance_requests r where r.id=source and r.period_id=p.id and r.status='pending';
      if not found or length(approval_note)<10 then
        raise exception 'Choose a pending request and write a review note of at least 10 characters.' using errcode='22023';
      end if;
      if p_action='approveRequest' then
        if request_row.kind='openingDebt' then
          result := khpos_private.finance_billing(p_actor,p_school,p_campus,p,
            request_row.payload||jsonb_build_object('label','Opening fee balance'),'openingDebt');
          if (result->>'created')::integer=0 then
            raise exception 'This learner already has an opening fee balance.' using errcode='22023';
          end if;
        else
          result := khpos_private.finance_post(p_actor,p_school,p_campus,p,request_row.payload,request_row.kind);
        end if;
      end if;
      update public.khpos_finance_requests r set status=case when p_action='approveRequest' then 'approved' else 'returned' end,
        reviewed_by=p_actor,reviewed_at=now(),review_note=approval_note where r.id=request_row.id returning r.id into found_id;
      audit_desc := approval_note;
    when 'reconcile' then
      select * into account_row from public.khpos_finance_accounts x where x.id=(p_input->>'account')::uuid
        and x.school_id=p_school and x.campus_id=p_campus;
      date_value := (p_input->>'date')::date;
      opening := (p_input->>'balance')::bigint;
      if account_row.id is null or date_value is null or date_value not between greatest(p.starts,account_row.opened) and p.ends
        or date_value>(now() at time zone 'Africa/Lagos')::date or opening is null
        or coalesce(length(btrim(p_input->>'reference')),0) not between 1 and 160 then
        raise exception 'Choose the account, statement date, balance and statement reference.' using errcode='22023';
      end if;
      if exists(select 1 from public.khpos_finance_reconciliations r where r.account_id=account_row.id and r.through_date>=date_value) then
        raise exception 'The account is already reconciled through this date.' using errcode='22023';
      end if;
      if khpos_private.finance_account_balance(account_row.id,date_value)<>opening then
        raise exception 'The statement balance differs from your records. Check missing, duplicate or incorrect entries first.' using errcode='22023';
      end if;
      if p_input->>'confirmed' is distinct from 'true' then
        raise exception 'Confirm that you checked each cash or bank entry against the statement or cash count.' using errcode='22023';
      end if;
      insert into public.khpos_finance_reconciliations(school_id,campus_id,period_id,account_id,through_date,statement_balance,reference,created_by)
        values(p_school,p_campus,p.id,account_row.id,date_value,opening,btrim(p_input->>'reference'),p_actor) returning id into found_id;
    else raise exception 'Choose a supported finance action.' using errcode='22023';
  end case;
  result := coalesce(result,jsonb_build_object('id',found_id));
  insert into public.khpos_finance_audit(school_id,campus_id,actor_id,action,record_id,detail)
    values(p_school,p_campus,p_actor,p_action||coalesce(' '||action_kind,''),found_id,
      jsonb_strip_nulls(jsonb_build_object('period',period_id,'result',result,'note',audit_desc)));
  insert into public.khpos_finance_commands values(p_school,record_key,p_campus,p_actor,p_action,p_input,result);
  return result;
end
$$;
revoke all on function khpos_private.finance_account_balance(uuid,date),khpos_private.finance_guard_post()
  from public,anon,authenticated,service_role;
revoke all on function public.khpos_finance_ledger_server(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_finance_ledger_server(uuid,uuid,uuid,text,jsonb) to service_role;
