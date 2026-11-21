create table public.khpos_finance_budgets (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.khpos_finance_periods(id),
  category text not null check(length(btrim(category)) between 1 and 120),
  department text not null default '',
  amount bigint not null check(amount between 1 and 100000000000000),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create unique index khpos_finance_budget_identity on public.khpos_finance_budgets(period_id,lower(category),lower(department));

create table public.khpos_finance_obligations (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.khpos_finance_periods(id),
  description text not null check(length(description) between 1 and 160),
  due date not null,
  amount bigint not null check(amount between 1 and 100000000000000),
  expense_id uuid unique references public.khpos_finance_entries(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index khpos_finance_obligation_identity
  on public.khpos_finance_obligations(period_id,lower(description),due,amount);
alter table public.khpos_finance_obligations enable row level security;
revoke all on public.khpos_finance_obligations from public,anon,authenticated,service_role;

create table public.khpos_finance_statement_sources (
  statement_id uuid primary key references public.khpos_school_financial_periods(id),
  school_id uuid not null references public.organisations(id),
  source_periods uuid[] not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.khpos_finance_budgets enable row level security;
alter table public.khpos_finance_statement_sources enable row level security;
revoke all on public.khpos_finance_budgets,public.khpos_finance_statement_sources from public,anon,authenticated,service_role;

create function khpos_private.finance_summary(school uuid,campus uuid,from_date date,to_date date)
returns jsonb language sql stable set search_path='' as $$
with entries as materialized (
  select e.*, coalesce(o.kind,e.kind) as origin_kind
  from khpos_private.finance_cash_movements e
  left join public.khpos_finance_entries o on o.id=e.original_id
  where e.school_id=school and (campus is null or e.campus_id=campus) and e.posted between from_date and to_date
), accounts as materialized (
  select a.id,a.name,a.kind,a.opening,a.opened,khpos_private.finance_account_balance(a.id,to_date) as balance,
    (select max(r.through_date) from public.khpos_finance_reconciliations r where r.account_id=a.id) as reconciled
  from public.khpos_finance_accounts a where a.school_id=school and (campus is null or a.campus_id=campus) and a.opened<=to_date
), invoice_balances as materialized (
  select i.*, i.amount-coalesce(sum(b.amount) filter(where e.posted<=to_date),0) as balance,
    coalesce(sum(b.amount) filter(where e.posted<=to_date and coalesce(o.kind,e.kind) in ('payment','apply','refund')),0) as paid,
    coalesce(sum(b.amount) filter(where e.posted<=to_date and coalesce(o.kind,e.kind) in ('discount','scholarship','waiver')),0) as assistance
  from public.khpos_finance_invoices i left join public.khpos_finance_allocations b on b.invoice_id=i.id
  left join public.khpos_finance_entries e on e.id=b.entry_id
  left join public.khpos_finance_entries o on o.id=e.original_id and e.kind='reverse'
  where i.school_id=school and (campus is null or i.campus_id=campus) and i.issued<=to_date
  group by i.id
), totals as (
  select coalesce(sum(e.cash_delta) filter(where e.cash_category='fees'),0) as fees,
    coalesce(sum(e.cash_delta) filter(where e.cash_category='income'),0) as income,
    coalesce(-sum(e.cash_delta) filter(where e.cash_category='expense'),0) as expenses,
    count(*) filter(where a.reconciled is null or a.reconciled<e.posted or
      (e.to_account_id is not null and (b.reconciled is null or b.reconciled<e.posted))) as unreconciled,
    count(*) as number
  from entries e join accounts a on a.id=e.account_id left join accounts b on b.id=e.to_account_id
), billing as (
  select coalesce(sum(i.amount) filter(where i.issued>=from_date and not i.opening),0) as invoiced,
    coalesce(sum(i.amount-i.assistance) filter(where i.issued>=from_date and i.due<=to_date and not i.opening),0) as due,
    coalesce(sum(i.paid) filter(where i.issued>=from_date and i.due<=to_date and not i.opening),0) as collected,
    coalesce(sum(i.balance),0) as outstanding,
    coalesce(sum(i.balance) filter(where i.due<to_date),0) as overdue,
    count(distinct i.learner_id) filter(where i.due<to_date and i.balance>0) as overdue_learners,
    coalesce(sum(i.balance) filter(where to_date-i.due between 1 and 30),0) as aged30,
    coalesce(sum(i.balance) filter(where to_date-i.due between 31 and 60),0) as aged60,
    coalesce(sum(i.balance) filter(where to_date-i.due between 61 and 90),0) as aged90,
    coalesce(sum(i.balance) filter(where to_date-i.due>90),0) as agedOlder,
    count(*) as invoices
  from invoice_balances i
)
select jsonb_build_object(
  'from',from_date,'to',to_date,'feeReceipts',t.fees,'otherIncome',t.income,'expenses',t.expenses,
  'received',t.fees+t.income,'netCashFlow',t.fees+t.income-t.expenses,'entries',t.number,'invoices',b.invoices,
  'unreconciled',t.unreconciled,'invoiced',b.invoiced,'due',b.due,'collected',b.collected,
  'balance',b.outstanding,'overdue',b.overdue,'overdueLearners',b.overdue_learners,
  'aged30',b.aged30,'aged60',b.aged60,'aged90',b.aged90,'agedOlder',b.agedOlder,
  'cash',coalesce((select sum(balance) from accounts),0),
  'accounts',coalesce((select jsonb_agg(to_jsonb(a) order by a.name) from accounts a),'[]'),
  'reconciliationComplete',exists(select 1 from accounts) and not exists(select 1 from accounts where reconciled is null or reconciled<to_date),
  'categories',coalesce((select jsonb_agg(to_jsonb(d)) from (
    select e.category,e.cash_category as kind,sum(case when e.cash_category='expense' then -e.cash_delta else e.cash_delta end) as amount
    from entries e where e.cash_category in ('income','expense','fees') group by e.category,e.cash_category order by e.cash_category,e.category
  ) d),'[]'),
  'timeline',coalesce((select jsonb_agg(to_jsonb(d)) from (
    select to_char(e.posted,'YYYY-MM') as month,
      coalesce(sum(e.cash_delta) filter(where e.cash_category='fees'),0) as fees,
      coalesce(sum(e.cash_delta) filter(where e.cash_category='income'),0) as income,
      coalesce(-sum(e.cash_delta) filter(where e.cash_category='expense'),0) as expenses
    from entries e where e.cash_category<>'transfer' group by 1 order by 1
  ) d),'[]')
) from totals t cross join billing b
$$;

create function khpos_private.finance_protect_statement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.khpos_finance_statement_sources s where s.statement_id=old.id)
    and (new.period_start,new.period_end,new.fee_income,new.other_income,new.operating_expenses,new.cash_available,new.outstanding_fees,new.source_note)
    is distinct from (old.period_start,old.period_end,old.fee_income,old.other_income,old.operating_expenses,old.cash_available,old.outstanding_fees,old.source_note) then
    raise exception 'These figures come from a reconciled ledger snapshot.' using errcode='22023';
  end if;
  return new;
end
$$;
create trigger khpos_finance_protect_linked_statement before update on public.khpos_school_financial_periods
for each row execute function khpos_private.finance_protect_statement();

create function khpos_private.finance_lock_linked_period()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.closed and not new.closed and exists(
    select 1 from public.khpos_finance_statement_sources s where s.school_id=old.school_id and old.id=any(s.source_periods)
  ) then raise exception 'This period supplies a frozen Financial Health statement. Record corrections in a later period.' using errcode='22023'; end if;
  return new;
end
$$;
create trigger khpos_finance_lock_linked_period before update on public.khpos_finance_periods
for each row execute function khpos_private.finance_lock_linked_period();

create function public.khpos_finance_report_server(p_actor uuid,p_school uuid,p_campus uuid,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  p public.khpos_finance_periods;
  prior public.khpos_finance_periods;
  from_date date;
  to_date date;
  report jsonb;
  grades jsonb;
  old_report jsonb;
  planned bigint;
  actual bigint;
  row_id uuid;
  linked_periods uuid[];
  key uuid := nullif(p_input->>'key','')::uuid;
  previous public.khpos_finance_commands;
  label text := left(btrim(coalesce(p_input->>'category','')),120);
  area text := left(btrim(coalesce(p_input->>'department','')),120);
  report_status text;
  session_name text;
  obligation public.khpos_finance_obligations;
  due_date date;
  offset_rows int := greatest(0,least(coalesce((p_input->>'offset')::int,0),250000));
begin
  if p_action='attention' then
    return jsonb_build_object(
      'adjustments',(select count(*) from public.khpos_finance_requests r where r.school_id=p_school and r.status='pending'
        and khpos_private.finance_access(p_actor,p_school,r.campus_id,true)),
      'statements',case when khpos_private.finance_access(p_actor,p_school,null,true) then (
        select count(*) from public.khpos_school_financial_periods f where f.school_id=p_school and f.status='submitted'
      ) else 0 end
    );
  end if;
  if p_campus is null then raise exception 'Choose a campus.' using errcode='22023'; end if;
  perform khpos_private.finance_scope(p_actor,p_school,p_campus);
  select * into p from public.khpos_finance_periods f where f.id=(p_input->>'period')::uuid
    and f.school_id=p_school and f.campus_id=p_campus;
  if p.id is null then raise exception 'Choose a configured accounting period.' using errcode='22023'; end if;
  from_date := p.starts;
  to_date := least(p.ends,(now() at time zone 'Africa/Lagos')::date);
  select t.session_label into session_name from public.khpos_ops_academic_terms t where t.id=p.term_id;

  if p_action in ('overview','annual','aged','budget','source','obligations') then
    case p_action
      when 'source' then
        perform khpos_private.finance_scope(p_actor,p_school,null);
        return (select jsonb_build_object('id',f.id,'status',f.status,'snapshot',s.snapshot)
          from public.khpos_finance_statement_sources s join public.khpos_school_financial_periods f on f.id=s.statement_id
          where s.school_id=p_school and p.id=any(s.source_periods) limit 1);
      when 'aged' then
        return coalesce((select jsonb_agg(to_jsonb(v)) from (
          select i.id,i.number,i.learner_name,i.admission_number,i.label,i.due,
            to_date-i.due as days, b.balance
          from public.khpos_finance_invoices i cross join lateral (
            select khpos_private.finance_invoice_balance(i.id,to_date) as balance
          ) b where i.school_id=p_school and i.campus_id=p_campus and i.issued<=to_date and i.due<to_date and b.balance>0
          order by i.due,i.number offset offset_rows limit 51
        ) v),'[]');
      when 'obligations' then
        return coalesce((select jsonb_agg(to_jsonb(v)) from (
          select x.id,x.description,x.due,x.amount,case when e.id is null then 'open' else 'paid' end as status,e.reference
          from public.khpos_finance_obligations x join public.khpos_finance_periods f on f.id=x.period_id
          left join public.khpos_finance_entries e on e.id=x.expense_id and not exists(
            select 1 from public.khpos_finance_entries r where r.original_id=e.id and r.kind='reverse')
          where f.school_id=p_school and f.campus_id=p_campus and f.starts<=p.ends
            and (f.id=p.id or e.id is null) order by (e.id is not null),x.due,x.id offset offset_rows limit 51
        ) v),'[]');
      when 'budget' then
        return coalesce((select jsonb_agg(to_jsonb(v)) from (
          select b.id,b.category,b.department,b.amount,coalesce((select -sum(e.cash_delta)
            from khpos_private.finance_cash_movements e where e.period_id=p.id and e.cash_category='expense'
              and lower(e.category)=lower(b.category) and lower(e.department)=lower(b.department)),0) as spent
          from public.khpos_finance_budgets b where b.period_id=p.id order by b.category,b.department
        ) v),'[]');
      when 'annual' then
        select min(t.start_date),least(max(t.end_date),(now() at time zone 'Africa/Lagos')::date)
          into from_date,to_date from public.khpos_ops_academic_terms t
          where t.organisation_id=p_school and (t.campus_id is null or t.campus_id=p_campus)
          and t.session_label=session_name and t.status<>'cancelled';
        return khpos_private.finance_summary(p_school,p_campus,from_date,to_date)
          ||jsonb_build_object('session',session_name,'status','recorded','missingTerms',(
            select count(*) from public.khpos_ops_academic_terms t where t.organisation_id=p_school
              and (t.campus_id is null or t.campus_id=p_campus) and t.session_label=session_name and t.status<>'cancelled'
              and not exists(select 1 from public.khpos_finance_periods f where f.campus_id=p_campus and f.term_id=t.id)
          ));
      else
        report := khpos_private.finance_summary(p_school,p_campus,from_date,to_date);
        select * into prior from public.khpos_finance_periods f where f.campus_id=p_campus and f.ends<p.starts order by f.ends desc limit 1;
        if prior.id is not null then
          old_report := khpos_private.finance_summary(p_school,p_campus,prior.starts,prior.ends);
        end if;
        select coalesce(sum(b.amount),0) into planned from public.khpos_finance_budgets b where b.period_id=p.id;
        select coalesce(-sum(e.cash_delta),0) into actual from khpos_private.finance_cash_movements e where e.period_id=p.id and e.cash_category='expense';
        select coalesce(jsonb_agg(to_jsonb(x)),'[]') into grades from (
          select b.category,b.department,b.amount,coalesce((select -sum(e.cash_delta)
            from khpos_private.finance_cash_movements e where e.period_id=p.id and e.cash_category='expense'
              and lower(e.category)=lower(b.category) and lower(e.department)=lower(b.department)),0) as spent
          from public.khpos_finance_budgets b where b.period_id=p.id
        ) x;
        select f.status into report_status from public.khpos_finance_statement_sources s
          join public.khpos_school_financial_periods f on f.id=s.statement_id
          where s.school_id=p_school and p.id=any(s.source_periods) limit 1;
        return report||jsonb_build_object('prior',old_report,'budget',planned,'spent',actual,'byBudget',grades,
          'payables',(select count(*) from public.khpos_finance_obligations x join public.khpos_finance_periods fp on fp.id=x.period_id
            where fp.school_id=p_school and fp.campus_id=p_campus and x.due<=to_date+14
              and (x.expense_id is null or exists(select 1 from public.khpos_finance_entries r
                where r.original_id=x.expense_id and r.kind='reverse'))),
          'pending',(select count(*) from public.khpos_finance_requests r where r.period_id=p.id and r.status='pending'),
          'statementStatus',report_status,
          'potentialDuplicates',(select count(*) from (
            select e.posted,e.account_id,e.kind,e.learner_id,e.amount from public.khpos_finance_entries e
            where e.period_id=p.id and e.kind in ('payment','income','expense')
            group by e.posted,e.account_id,e.kind,e.learner_id,e.amount having count(*)>1
          ) d),
          'upcoming',(select count(*) from public.khpos_finance_invoices i where i.school_id=p_school and i.campus_id=p_campus
            and i.due between to_date and to_date+14 and khpos_private.finance_invoice_balance(i.id,to_date)>0));
    end case;
  end if;

  if key is null then raise exception 'A request identifier is required.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('finance:'||p_school::text,0));
  select * into previous from public.khpos_finance_commands c where c.school_id=p_school and c.request_key=key;
  if found then
    if previous.actor_id<>p_actor or previous.campus_id<>p_campus or previous.action<>p_action or previous.input<>p_input then
      raise exception 'This request identifier is already in use.' using errcode='22023';
    end if;
    return previous.result;
  end if;
  select * into p from public.khpos_finance_periods f where f.id=p.id;
  case p_action
    when 'saveBudget' then
      if p.closed or label='' then raise exception 'Choose an expense category in an open accounting period.' using errcode='22023'; end if;
      planned := khpos_private.finance_amount(p_input->>'amount');
      insert into public.khpos_finance_budgets(period_id,category,department,amount,updated_by)
      values(p.id,label,area,planned,p_actor)
      on conflict(period_id,lower(category),lower(department)) do update
        set amount=excluded.amount,updated_by=excluded.updated_by,updated_at=now()
      returning id into row_id;
    when 'addObligation' then
      if p.closed then raise exception 'Choose an open accounting period.' using errcode='22023'; end if;
      due_date := (p_input->>'due')::date;
      planned := khpos_private.finance_amount(p_input->>'amount');
      if coalesce(length(btrim(p_input->>'description')),0) not between 1 and 160 or due_date is null then
        raise exception 'Enter an obligation description, amount and due date.' using errcode='22023';
      end if;
      insert into public.khpos_finance_obligations(period_id,description,due,amount,created_by)
        values(p.id,btrim(p_input->>'description'),due_date,planned,p_actor) returning id into row_id;
    when 'settleObligation' then
      if p.closed then raise exception 'Choose an open accounting period.' using errcode='22023'; end if;
      select x.* into obligation from public.khpos_finance_obligations x join public.khpos_finance_periods f on f.id=x.period_id
        where x.id=(p_input->>'id')::uuid and f.school_id=p_school and f.campus_id=p_campus;
      if not found or (obligation.expense_id is not null and not exists(select 1 from public.khpos_finance_entries e
        where e.original_id=obligation.expense_id and e.kind='reverse')) then
        raise exception 'Choose an open obligation in this campus.' using errcode='22023';
      end if;
      select e.id into row_id from public.khpos_finance_entries e where e.school_id=p_school and e.campus_id=p_campus
        and e.kind='expense' and e.amount=obligation.amount and lower(e.reference)=lower(btrim(p_input->>'reference'))
        and not exists(select 1 from public.khpos_finance_entries r where r.original_id=e.id and r.kind='reverse');
      if not found then raise exception 'Enter the reference of a recorded expense for this exact amount.' using errcode='22023'; end if;
      update public.khpos_finance_obligations x set expense_id=row_id where x.id=obligation.id;
      row_id := obligation.id;
    when 'prepareStatement' then
      perform khpos_private.finance_scope(p_actor,p_school,null);
      if p.ends>(now() at time zone 'Africa/Lagos')::date then
        raise exception 'Prepare official figures after the period ends.' using errcode='22023';
      end if;
      if exists(select 1 from public.khpos_ops_campuses c where c.organisation_id=p_school and c.status='active'
        and not exists(select 1 from public.khpos_finance_periods f where f.campus_id=c.id
          and f.school_id=p_school and f.starts=p.starts and f.ends=p.ends and f.closed)) then
        raise exception 'Close the same accounting dates at every active campus before preparing the school statement.' using errcode='22023';
      end if;
      select array_agg(f.id) into linked_periods from public.khpos_finance_periods f where f.school_id=p_school
        and f.starts=p.starts and f.ends=p.ends and f.closed;
      if coalesce(cardinality(linked_periods),0)=0 then
        raise exception 'Close the accounting period before preparing the school statement.' using errcode='22023';
      end if;
      report := khpos_private.finance_summary(p_school,null,p.starts,p.ends);
      if report->>'reconciliationComplete' is distinct from 'true' then
        raise exception 'Reconcile each school account through the statement end date first.' using errcode='22023';
      end if;
      if least((report->>'feeReceipts')::bigint,(report->>'otherIncome')::bigint,
        (report->>'expenses')::bigint,(report->>'cash')::bigint)<0 then
        raise exception 'Financial Health cannot represent the negative net figure in this period. Keep the exact ledger report for review.' using errcode='22023';
      end if;
      insert into public.khpos_school_financial_periods(school_id,period_start,period_end,fee_income,other_income,
        operating_expenses,cash_available,outstanding_fees,source_note,created_by,updated_by)
      values(p_school,p.starts,p.ends,round((report->>'feeReceipts')::numeric/100),round((report->>'otherIncome')::numeric/100),
        round((report->>'expenses')::numeric/100),round((report->>'cash')::numeric/100),round((report->>'balance')::numeric/100),
        'Prepared from reconciled School Finance records. Exact kobo values are retained in the source snapshot.',p_actor,p_actor)
      returning id into row_id;
      insert into public.khpos_finance_statement_sources(statement_id,school_id,source_periods,snapshot)
      values(row_id,p_school,linked_periods,report);
    else raise exception 'Choose a supported reporting action.' using errcode='22023';
  end case;
  report := jsonb_build_object('id',row_id);
  insert into public.khpos_finance_audit(school_id,campus_id,actor_id,action,record_id,detail)
    values(p_school,p_campus,p_actor,p_action,row_id,jsonb_build_object('period',p.id,'category',label,'department',area,'amount',planned));
  insert into public.khpos_finance_commands values(p_school,key,p_campus,p_actor,p_action,p_input,report);
  return report;
end
$$;

revoke all on function khpos_private.finance_summary(uuid,uuid,date,date),
  khpos_private.finance_protect_statement(), khpos_private.finance_lock_linked_period() from public,anon,authenticated,service_role;
revoke all on function public.khpos_finance_report_server(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_finance_report_server(uuid,uuid,uuid,text,jsonb) to service_role;
