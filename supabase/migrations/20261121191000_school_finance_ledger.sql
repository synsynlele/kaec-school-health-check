create table public.khpos_finance_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organisations(id),
  campus_id uuid not null references public.khpos_ops_campuses(id),
  term_id uuid not null references public.khpos_ops_academic_terms(id),
  starts date not null,
  ends date not null check(ends>=starts),
  closed boolean not null default false,
  unique(school_id,campus_id,term_id)
);
create table public.khpos_finance_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organisations(id),
  campus_id uuid not null references public.khpos_ops_campuses(id),
  name text not null check(length(btrim(name)) between 1 and 100),
  kind text not null check(kind in ('cash','bank')),
  opened date not null,
  opening bigint not null check(opening between -100000000000000 and 100000000000000)
);
create unique index khpos_finance_account_name on public.khpos_finance_accounts(school_id,campus_id,lower(name));

create table public.khpos_finance_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organisations(id),
  campus_id uuid not null references public.khpos_ops_campuses(id),
  period_id uuid not null references public.khpos_finance_periods(id),
  class_id uuid not null,
  class_label text not null,
  arm text not null,
  label text not null check(length(btrim(label)) between 1 and 140),
  fee_category text not null default '',
  annual boolean not null default false,
  version int not null,
  amount bigint not null check(amount between 1 and 100000000000000),
  due date not null,
  instalments jsonb not null default '[]',
  unique(period_id,class_id,label,fee_category,version)
);
create table public.khpos_finance_invoices (
  id uuid primary key default gen_random_uuid(),
  number bigint not null,
  school_id uuid not null references public.organisations(id),
  campus_id uuid not null references public.khpos_ops_campuses(id),
  period_id uuid not null references public.khpos_finance_periods(id),
  learner_id uuid not null references public.khpos_ops_learner_anchors(id),
  schedule_id uuid references public.khpos_finance_schedules(id),
  billing_key text not null,
  label text not null,
  learner_name text not null,
  admission_number text not null,
  issued date not null,
  due date not null,
  amount bigint not null check(amount between 1 and 100000000000000),
  opening boolean not null default false,
  unique(school_id,number),
  unique(school_id,campus_id,learner_id,billing_key)
);
create index khpos_finance_invoice_scope on public.khpos_finance_invoices(school_id,campus_id,period_id,number desc);
create unique index khpos_finance_opening_debt on public.khpos_finance_invoices(school_id,learner_id) where opening;
create index khpos_finance_invoice_learner on public.khpos_finance_invoices(learner_id,issued);

create table public.khpos_finance_entries (
  id uuid primary key default gen_random_uuid(),
  number bigint not null,
  school_id uuid not null references public.organisations(id),
  campus_id uuid not null references public.khpos_ops_campuses(id),
  period_id uuid not null references public.khpos_finance_periods(id),
  learner_id uuid references public.khpos_ops_learner_anchors(id),
  learner_name text,
  admission_number text,
  account_id uuid references public.khpos_finance_accounts(id),
  to_account_id uuid references public.khpos_finance_accounts(id),
  original_id uuid references public.khpos_finance_entries(id),
  kind text not null check(kind in ('payment','income','expense','transfer','credit','refund','reverse','discount','scholarship','waiver','apply')),
  posted date not null,
  amount bigint not null check(amount between 1 and 100000000000000),
  reference text not null check(length(reference) between 1 and 160),
  category text not null default '',
  department text not null default '',
  note text not null default '',
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(school_id,number),
  check(account_id is distinct from to_account_id or account_id is null)
);
create unique index khpos_finance_entry_reference on public.khpos_finance_entries(school_id,lower(reference));
create index khpos_finance_entry_scope on public.khpos_finance_entries(school_id,campus_id,period_id,number desc);
create index khpos_finance_entry_learner on public.khpos_finance_entries(learner_id,posted);
create index khpos_finance_entry_original on public.khpos_finance_entries(original_id);

create table public.khpos_finance_allocations (
  entry_id uuid primary key references public.khpos_finance_entries(id),
  invoice_id uuid not null references public.khpos_finance_invoices(id),
  amount bigint not null check(amount<>0)
);
create index khpos_finance_allocations_invoice on public.khpos_finance_allocations(invoice_id);

create table public.khpos_finance_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organisations(id),
  campus_id uuid not null references public.khpos_ops_campuses(id),
  period_id uuid not null references public.khpos_finance_periods(id),
  request_key uuid not null,
  kind text not null,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','approved','returned')),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  unique(school_id,request_key)
);
create index khpos_finance_request_scope on public.khpos_finance_requests(school_id,campus_id,period_id,status);
create table public.khpos_finance_commands (
  school_id uuid not null references public.organisations(id),
  request_key uuid not null,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  actor_id uuid not null references auth.users(id),
  action text not null,
  input jsonb not null,
  result jsonb not null,
  primary key(school_id,request_key)
);

do $$
declare t text;
begin
  foreach t in array array['periods','accounts','schedules','invoices','entries','allocations','requests','commands'] loop
    execute format('alter table public.%I enable row level security','khpos_finance_'||t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role','khpos_finance_'||t);
  end loop;
end
$$;

create function khpos_private.finance_amount(raw text)
returns bigint language plpgsql immutable set search_path='' as $$
begin
  if raw is null or raw !~ '^[0-9]{1,15}$' or raw::bigint not between 1 and 100000000000000 then
    raise exception 'Enter a positive amount in naira and kobo.' using errcode='22023';
  end if;
  return raw::bigint;
end
$$;

create function khpos_private.finance_invoice_balance(invoice uuid, as_of date default 'infinity')
returns bigint language sql stable set search_path='' as $$
  select i.amount-coalesce((select sum(a.amount) from public.khpos_finance_allocations a
    join public.khpos_finance_entries e on e.id=a.entry_id where a.invoice_id=i.id and e.posted<=as_of),0)
  from public.khpos_finance_invoices i where i.id=invoice
$$;

create function khpos_private.finance_learner_credit(school uuid,campus uuid,learner uuid,as_of date default 'infinity')
returns bigint language sql stable set search_path='' as $$
  select coalesce(sum(case e.kind
    when 'payment' then e.amount-coalesce(a.amount,0)
    when 'credit' then e.amount
    when 'apply' then -e.amount
    when 'refund' then -e.amount-coalesce(a.amount,0)
    when 'reverse' then case when o.kind='apply' then e.amount else 0 end
    else 0 end),0)
  from public.khpos_finance_entries e left join public.khpos_finance_allocations a on a.entry_id=e.id
  left join public.khpos_finance_entries o on o.id=e.original_id
  where e.school_id=school and e.campus_id=campus and e.learner_id=learner and e.posted<=as_of
$$;

create function khpos_private.finance_post(actor uuid,school uuid,campus uuid,period public.khpos_finance_periods,
  item jsonb,kind text)
returns jsonb language plpgsql set search_path='' as $$
declare
  amt bigint := khpos_private.finance_amount(item->>'amount');
  booked date := coalesce(nullif(item->>'date','')::date,(now() at time zone 'Africa/Lagos')::date);
  account uuid := nullif(item->>'account','')::uuid;
  destination uuid := nullif(item->>'destination','')::uuid;
  invoice_id uuid := nullif(item->>'invoice','')::uuid;
  learner uuid := nullif(item->>'learner','')::uuid;
  original public.khpos_finance_entries;
  invoice public.khpos_finance_invoices;
  entry public.khpos_finance_entries;
  allocation bigint := 0;
  receipt_name text;
  receipt_admission text;
  earlier bigint;
  original_allocation bigint;
  ref text := nullif(btrim(item->>'reference'),'');
  category text := left(btrim(coalesce(item->>'category','')),120);
begin
  if booked not between period.starts and period.ends or booked>(now() at time zone 'Africa/Lagos')::date then
    raise exception 'Choose a transaction date in the open accounting period, up to today.' using errcode='22023';
  end if;
  if kind in ('refund','reverse') then
    select * into original from public.khpos_finance_entries e
    where e.id=(item->>'original')::uuid and e.school_id=school and e.campus_id=campus;
    if not found or booked<original.posted or (kind='refund' and original.kind<>'payment')
      or (kind='reverse' and original.kind not in ('income','expense','transfer','discount','scholarship','waiver','apply')) then
      raise exception 'Choose a valid original transaction and correction date.' using errcode='22023';
    end if;
    select coalesce(sum(e.amount),0) into earlier from public.khpos_finance_entries e where e.original_id=original.id;
    if amt>original.amount-earlier or (kind='reverse' and amt<>original.amount) then
      raise exception 'The correction exceeds the remaining amount or is already recorded.' using errcode='22023';
    end if;
    account := original.account_id;
    destination := original.to_account_id;
    learner := original.learner_id;
    category := original.category;
    if kind='refund' then
      select a.invoice_id,a.amount into invoice_id,original_allocation from public.khpos_finance_allocations a where a.entry_id=original.id;
      original_allocation := coalesce(original_allocation,0);
      allocation := -greatest(0,amt-greatest(0,original.amount-original_allocation-earlier));
      if khpos_private.finance_learner_credit(school,campus,learner,booked)<amt+allocation
        or khpos_private.finance_learner_credit(school,campus,learner)<amt+allocation then
        raise exception 'Part of this credit was already applied to another invoice.' using errcode='22023';
      end if;
    elsif original.kind in ('discount','scholarship','waiver','apply') then
      select a.invoice_id,-a.amount into invoice_id,allocation from public.khpos_finance_allocations a where a.entry_id=original.id;
    end if;
  end if;
  if kind in ('payment','income','expense','transfer','refund') or (kind='reverse' and original.account_id is not null) then
    if account is null or not exists(select 1 from public.khpos_finance_accounts a where a.id=account
      and a.school_id=school and a.campus_id=campus and a.opened<=booked) then
      raise exception 'Choose a cash or bank account for this campus and date.' using errcode='22023';
    end if;
  else
    account := null;
  end if;
  if kind='transfer' or (kind='reverse' and original.kind='transfer') then
    if destination is null or destination=account or not exists(select 1 from public.khpos_finance_accounts a
      where a.id=destination and a.school_id=school and a.campus_id=campus and a.opened<=booked) then
      raise exception 'Choose a different destination account in the same campus.' using errcode='22023';
    end if;
  else
    destination := null;
  end if;
  if kind in ('income','expense','transfer') or (kind='reverse' and original.learner_id is null) then
    learner := null;
    invoice_id := null;
  end if;
  if kind in ('income','expense') and category='' then
    raise exception 'Choose an income or expense category.' using errcode='22023';
  end if;
  if kind in ('payment','income','expense','transfer','credit','refund','reverse','discount','scholarship','waiver','apply') and ref is null then
    raise exception 'Enter a unique reference, such as the deposit slip or payment record number.' using errcode='22023';
  end if;
  if kind='credit' then invoice_id := null; end if;
  if invoice_id is not null then
    select * into invoice from public.khpos_finance_invoices i where i.id=invoice_id and i.school_id=school and i.campus_id=campus;
    if not found or booked<invoice.issued or (learner is not null and learner<>invoice.learner_id) then
      raise exception 'Choose a valid learner invoice issued on or before the transaction date.' using errcode='22023';
    end if;
    learner := invoice.learner_id;
    if kind='payment' then
      allocation := least(amt,khpos_private.finance_invoice_balance(invoice_id),khpos_private.finance_invoice_balance(invoice_id,booked));
    elsif kind in ('apply','discount','scholarship','waiver') then
      if amt>least(khpos_private.finance_invoice_balance(invoice_id),khpos_private.finance_invoice_balance(invoice_id,booked)) then
        raise exception 'The adjustment exceeds the unpaid invoice balance.' using errcode='22023';
      end if;
      allocation := amt;
    end if;
  elsif kind in ('apply','discount','scholarship','waiver') then
    raise exception 'Choose an invoice for this adjustment.' using errcode='22023';
  end if;
  if kind='credit' or (kind='payment' and invoice_id is null) then
    if learner is null or not exists(select 1 from public.khpos_ops_learner_anchors l where l.id=learner
      and l.organisation_id=school and l.campus_id=campus) then
      raise exception 'Choose a learner from this campus.' using errcode='22023';
    end if;
  end if;
  if kind='apply' and amt>least(khpos_private.finance_learner_credit(school,campus,learner),
    khpos_private.finance_learner_credit(school,campus,learner,booked)) then
    raise exception 'The learner does not have enough available credit.' using errcode='22023';
  end if;
  if learner is not null and exists(select 1 from public.khpos_finance_entries e where e.school_id=school
    and e.campus_id=campus and e.learner_id=learner and e.posted>booked) then
    raise exception 'This learner already has a later ledger entry. Use that date or a later date to protect the fee history.' using errcode='22023';
  end if;
  if kind='credit' and exists(select 1 from public.khpos_finance_entries e where e.school_id=school
    and e.learner_id=learner and e.kind='credit') then
    raise exception 'This learner already has an opening credit.' using errcode='22023';
  end if;
  if original.learner_id is not null then
    receipt_name := original.learner_name;
    receipt_admission := original.admission_number;
  elsif invoice.id is not null then
    receipt_name := invoice.learner_name;
    receipt_admission := invoice.admission_number;
  elsif learner is not null then
    select a.display_name,coalesce(f.admission_number,a.external_learner_reference) into receipt_name,receipt_admission
    from public.khpos_ops_learner_anchors a left join public.khpos_finance_learners f on f.learner_id=a.id where a.id=learner;
  end if;
  insert into public.khpos_finance_entries(number,school_id,campus_id,period_id,learner_id,learner_name,admission_number,account_id,to_account_id,
    original_id,kind,posted,amount,reference,category,department,note,actor_id)
  values((select coalesce(max(e.number),0)+1 from public.khpos_finance_entries e where e.school_id=school),
    school,campus,period.id,learner,receipt_name,receipt_admission,account,destination,original.id,kind,booked,amt,ref,category,
    case when kind='reverse' then original.department else left(btrim(coalesce(item->>'department','')),120) end,
    left(btrim(coalesce(item->>'note','')),1000),actor) returning * into entry;
  if allocation<>0 then
    insert into public.khpos_finance_allocations values(entry.id,invoice_id,allocation);
  end if;
  return jsonb_build_object('id',entry.id,'number',entry.number,'allocated',allocation);
end
$$;

create function khpos_private.finance_billing(actor uuid,school uuid,campus uuid,period public.khpos_finance_periods,
  item jsonb,action text)
returns jsonb language plpgsql set search_path='' as $$
<<billing>>
declare
  schedule public.khpos_finance_schedules;
  class_row public.khpos_class_subject_catalog;
  label text := btrim(item->>'label');
  fee_category text := left(btrim(coalesce(item->>'feeCategory','')),100);
  amt bigint;
  due_on date;
  issue_on date := coalesce(nullif(item->>'date','')::date,(now() at time zone 'Africa/Lagos')::date);
  plan jsonb := coalesce(item->'instalments','[]');
  charge jsonb;
  count_saved int := 0;
  saved int;
  student record;
  campus_term text;
  bill_key text;
  target uuid := nullif(item->>'learner','')::uuid;
  cursor_id uuid := coalesce(nullif(item->>'cursor','')::uuid,'00000000-0000-0000-0000-000000000000');
  next_cursor uuid;
begin
  if action='saveSchedule' then
    select * into class_row from public.khpos_class_subject_catalog c where c.id=(item->>'class')::uuid
      and c.organisation_id=school and c.campus_id=campus and c.available;
    if not found then raise exception 'Choose an available class in this campus.' using errcode='22023'; end if;
    amt := khpos_private.finance_amount(item->>'amount');
    due_on := (item->>'due')::date;
    if coalesce(length(label),0) not between 1 and 140 or due_on is null or due_on<period.starts
      or jsonb_typeof(plan)<>'array' or jsonb_array_length(plan)>12 then
      raise exception 'Enter a charge name, valid due date and up to 12 instalments.' using errcode='22023';
    end if;
    if plan<>'[]' and ((select sum(khpos_private.finance_amount(p->>'amount')) from jsonb_array_elements(plan) p)<>amt
      or exists(select 1 from jsonb_array_elements(plan) p where (p->>'due') is null or (p->>'due')::date<period.starts)) then
      raise exception 'Instalment amounts must add up to the fee, and each needs a valid due date.' using errcode='22023';
    end if;
    insert into public.khpos_finance_schedules(school_id,campus_id,period_id,class_id,class_label,arm,label,fee_category,annual,version,amount,due,instalments)
    values(school,campus,period.id,class_row.id,class_row.label,class_row.section,label,fee_category,coalesce((item->>'annual')::boolean,false),
      1+(select coalesce(max(s.version),0) from public.khpos_finance_schedules s
        where s.period_id=period.id and s.class_id=class_row.id and s.label=billing.label and s.fee_category=billing.fee_category),amt,due_on,plan)
    returning * into schedule;
    return jsonb_build_object('id',schedule.id,'version',schedule.version);
  end if;

  if issue_on not between period.starts and period.ends or issue_on>(now() at time zone 'Africa/Lagos')::date then
    raise exception 'Enter an invoice date within the open accounting period, up to today.' using errcode='22023';
  end if;
  if action='billSchedule' then
    select * into schedule from public.khpos_finance_schedules s where s.id=(item->>'schedule')::uuid and s.period_id=period.id;
    if not found then raise exception 'Choose a fee schedule from this period.' using errcode='22023'; end if;
    if exists(select 1 from public.khpos_finance_schedules s where s.period_id=period.id and s.class_id=schedule.class_id
      and s.label=schedule.label and s.fee_category=schedule.fee_category and s.version>schedule.version) then
      raise exception 'Choose the latest version of this fee schedule.' using errcode='22023';
    end if;
    label := schedule.label;
    plan := case when schedule.instalments='[]' then jsonb_build_array(jsonb_build_object('amount',schedule.amount,'due',schedule.due))
      else schedule.instalments end;
    select t.session_label into campus_term from public.khpos_ops_academic_terms t where t.id=period.term_id;
    bill_key := (case when schedule.annual then 'annual:'||campus_term else period.id::text end)
      ||':'||jsonb_build_array(lower(schedule.label))::text;
  else
    amt := khpos_private.finance_amount(item->>'amount');
    due_on := coalesce(nullif(item->>'due','')::date,issue_on);
    if target is null or coalesce(length(label),0) not between 1 and 140 or due_on<issue_on then
      raise exception 'Choose a learner, charge name and due date.' using errcode='22023';
    end if;
    plan := jsonb_build_array(jsonb_build_object('amount',amt,'due',due_on));
    if action<>'openingDebt' and nullif(btrim(item->>'reference'),'') is null then
      raise exception 'Enter a unique charge reference.' using errcode='22023';
    end if;
    bill_key := case when action='openingDebt' then 'opening balance' else 'individual:'||lower(btrim(item->>'reference')) end;
  end if;
  for student in
    select a.id,a.display_name,f.admission_number from public.khpos_ops_learner_anchors a
    join public.khpos_finance_learners f on f.learner_id=a.id and f.school_id=school
    where a.organisation_id=school and a.campus_id=campus and a.id>cursor_id
      and (target is null or a.id=target)
      and (action<>'billSchedule' or (f.enrolment_status='active' and a.status='active'
        and f.academic_term_id=period.term_id and a.class_label=schedule.class_label and coalesce(a.section_label,'')=schedule.arm
        and (lower(f.fee_category)=lower(schedule.fee_category) or (schedule.fee_category='' and not exists(
          select 1 from public.khpos_finance_schedules s where s.period_id=period.id and s.class_id=schedule.class_id
            and lower(s.label)=lower(schedule.label) and s.fee_category<>'' and lower(s.fee_category)=lower(f.fee_category)
        )))))
    order by a.id limit 100
  loop
    next_cursor := student.id;
    -- The entire instalment plan is issued together. A newer schedule never
    -- modifies an already-issued plan, including when its instalment count changes.
    if not exists(select 1 from public.khpos_finance_invoices i where i.school_id=school and i.campus_id=campus
      and i.learner_id=student.id and left(i.billing_key,length(bill_key)+1)=bill_key||'#') then
      for charge in select value||jsonb_build_object('installment',ordinality) from jsonb_array_elements(plan) with ordinality loop
        insert into public.khpos_finance_invoices(number,school_id,campus_id,period_id,learner_id,schedule_id,billing_key,label,
          learner_name,admission_number,issued,due,amount,opening)
        values((select coalesce(max(i.number),0)+1 from public.khpos_finance_invoices i where i.school_id=school),
          school,campus,period.id,student.id,schedule.id,bill_key||'#'||(charge->>'installment'),
          label||case when jsonb_array_length(plan)>1 then ' · instalment '||(charge->>'installment') else '' end,
          student.display_name,student.admission_number,issue_on,(charge->>'due')::date,(charge->>'amount')::bigint,action='openingDebt')
        on conflict do nothing;
        get diagnostics saved=row_count;
        count_saved := count_saved+saved;
      end loop;
    end if;
  end loop;
  if target is not null and next_cursor is null then raise exception 'The selected learner does not match this charge.' using errcode='22023'; end if;
  return jsonb_build_object('created',count_saved,'cursor',next_cursor);
end
$$;
revoke all on function khpos_private.finance_amount(text),khpos_private.finance_invoice_balance(uuid,date),
  khpos_private.finance_learner_credit(uuid,uuid,uuid,date),
  khpos_private.finance_post(uuid,uuid,uuid,public.khpos_finance_periods,jsonb,text),
  khpos_private.finance_billing(uuid,uuid,uuid,public.khpos_finance_periods,jsonb,text)
  from public,anon,authenticated,service_role;
