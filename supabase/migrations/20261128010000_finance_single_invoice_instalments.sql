-- New schedules issue one invoice. Existing issued invoices and receipts keep their IDs.
alter table public.khpos_finance_invoices
  add column payment_limit smallint check (payment_limit between 1 and 4);

create unique index khpos_finance_single_new_invoice_per_period
  on public.khpos_finance_invoices(school_id,campus_id,period_id,learner_id)
  where payment_limit is not null and not opening;

do $migration$
declare source text; updated text;
begin
  source := pg_get_functiondef('khpos_private.finance_billing(uuid,uuid,uuid,public.khpos_finance_periods,jsonb,text)'::regprocedure);
  updated := replace(source,
    $old$  charge jsonb;$old$,
    $new$  payment_limit smallint;
  instalment_count integer := nullif(item->>'paymentLimit','')::integer;$new$);
  if updated=source then raise exception 'Billing declaration missing'; end if;
  source := updated;
  updated := replace(source,
    $old$    due_on := (item->>'due')::date;$old$,
    $new$    due_on := (item->>'due')::date;
    if instalment_count is not null then
      if instalment_count not between 1 and 4 or amt<instalment_count then
        raise exception 'Choose one to four payments for this invoice.' using errcode='22023';
      end if;
      select case when instalment_count=1 then '[]'::jsonb else jsonb_agg(
        jsonb_build_object('amount',amt/instalment_count + case when i<=amt%instalment_count then 1 else 0 end,'due',due_on)
        order by i) end into plan
      from generate_series(1,instalment_count) i;
    end if;$new$);
  if updated=source then raise exception 'Schedule plan missing'; end if;
  source := updated;
  updated := replace(source,
    $old$    plan := case when schedule.instalments='[]' then jsonb_build_array(jsonb_build_object('amount',schedule.amount,'due',schedule.due))
      else schedule.instalments end;$old$,
    $new$    payment_limit := greatest(1,least(4,jsonb_array_length(schedule.instalments)));
    amt := schedule.amount;
    due_on := schedule.due;$new$);
  if updated=source then raise exception 'Schedule invoice plan missing'; end if;
  source := updated;
  updated := replace(source,
    $old$    plan := jsonb_build_array(jsonb_build_object('amount',amt,'due',due_on));
    if action<>'openingDebt' and nullif(btrim(item->>'reference'),'') is null then
      raise exception 'Enter a unique charge reference.' using errcode='22023';
    end if;
    bill_key := case when action='openingDebt' then 'opening balance' else 'individual:'||lower(btrim(item->>'reference')) end;$old$,
    $new$    if instalment_count is not null and (instalment_count not between 1 and 4 or amt<instalment_count) then
      raise exception 'Choose one to four payments for this invoice.' using errcode='22023';
    end if;
    payment_limit := case when action='openingDebt' then null else coalesce(instalment_count,1) end;
    bill_key := case when action='openingDebt' then 'opening balance'
      else 'individual:'||coalesce(nullif(lower(btrim(item->>'reference')),''),item->>'key') end;$new$);
  if updated=source then raise exception 'Individual invoice plan missing'; end if;
  source := updated;
  updated := regexp_replace(source,$pattern$      for charge in select value[\s\S]+?      end loop;$pattern$,
    $new$      if action<>'openingDebt' and exists (
        select 1 from public.khpos_finance_invoices existing where existing.school_id=school
          and existing.campus_id=campus and existing.period_id=period.id
          and existing.learner_id=student.id and not existing.opening
      ) then
        if action='billLearner' then
          raise exception 'This learner already has an invoice for the accounting period.' using errcode='22023';
        end if;
        continue;
      end if;
      insert into public.khpos_finance_invoices(number,school_id,campus_id,period_id,learner_id,schedule_id,billing_key,label,
        learner_name,admission_number,issued,due,amount,opening,payment_limit)
      values((select coalesce(max(i.number),0)+1 from public.khpos_finance_invoices i where i.school_id=school),
        school,campus,period.id,student.id,schedule.id,bill_key||'#1',label,
        student.display_name,student.admission_number,issue_on,due_on,amt,action='openingDebt',payment_limit)
      on conflict do nothing;
      get diagnostics saved=row_count;
      count_saved := count_saved+saved;$new$);
  if updated=source then raise exception 'Invoice issuance loop missing'; end if;
  execute updated;

  source := pg_get_functiondef('khpos_private.finance_post(uuid,uuid,uuid,public.khpos_finance_periods,jsonb,text)'::regprocedure);
  updated := replace(source, $old$  ref text := nullif(btrim(item->>'reference'),'');$old$,
    $new$  ref text := coalesce(nullif(btrim(item->>'reference'),''),
    case when kind in ('payment','apply') then 'AUTO-FEE-'||(item->>'key') end);
  payment_count integer;$new$);
  if updated=source then raise exception 'Payment reference hook missing'; end if;
  source := updated;
  updated := replace(source,$old$    if kind='payment' then
      allocation := least($old$,$new$    if kind='payment' then
      if invoice.payment_limit is not null then
        select count(*) into payment_count
        from public.khpos_finance_allocations b
        join public.khpos_finance_entries e on e.id=b.entry_id and e.kind='payment'
        where b.invoice_id=invoice.id and b.amount>0
          and not exists(select 1 from public.khpos_finance_entries correction
            where correction.kind='reverse' and correction.original_id=e.id);
        if payment_count>=invoice.payment_limit then
          raise exception 'The payment limit for this invoice has been reached.' using errcode='22023';
        elsif payment_count=invoice.payment_limit-1 and amt<khpos_private.finance_invoice_balance(invoice_id,booked) then
          raise exception 'The final instalment must cover the remaining invoice balance.' using errcode='22023';
        end if;
      end if;
      allocation := least($new$);
  if updated=source then raise exception 'Payment limit hook missing'; end if;
  execute updated;

  source := pg_get_functiondef('public.khpos_finance_ledger_server(uuid,uuid,uuid,text,jsonb)'::regprocedure);
  updated := replace(source,
    $old$i.issued,i.due,i.amount,i.opening,$old$,
    $new$i.issued,i.due,i.amount,i.opening,i.payment_limit,
            (select count(*) from public.khpos_finance_allocations allocation
              join public.khpos_finance_entries e on e.id=allocation.entry_id and e.kind='payment'
              where allocation.invoice_id=i.id and allocation.amount>0
                and not exists(select 1 from public.khpos_finance_entries correction
                  where correction.kind='reverse' and correction.original_id=e.id)) as payments_used,$new$);
  if updated=source then raise exception 'Invoice payment plan display hook missing'; end if;
  execute updated;
end;
$migration$;
