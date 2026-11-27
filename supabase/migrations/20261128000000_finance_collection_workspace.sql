-- Extend the scoped finance reads used by the collection workspace.
do $migration$
declare
  source text;
  updated text;
begin
  source := pg_get_functiondef('public.khpos_finance_register_server(uuid,uuid,uuid,text,jsonb)'::regprocedure);
  updated := replace(source,
    $old$or strpos(lower(coalesce(f.admission_number,a.external_learner_reference)),search)>0)$old$,
    $new$or strpos(lower(coalesce(f.admission_number,a.external_learner_reference)),search)>0
            or strpos(lower(f.guardian_name),search)>0)$new$);
  if updated=source then raise exception 'Finance learner search was not found'; end if;
  execute updated;

  source := pg_get_functiondef('public.khpos_finance_ledger_server(uuid,uuid,uuid,text,jsonb)'::regprocedure);
  updated := replace(source,
    $old$result := jsonb_build_object('credit',khpos_private.finance_learner_credit(p_school,p_campus,student,p.ends),'invoices',$old$,
    $new$result := (select jsonb_build_object(
          'name',l.display_name,'class',concat_ws(' · ',l.class_label,nullif(l.section_label,'')),
          'admission',coalesce(f.admission_number,l.external_learner_reference),
          'billed',totals.billed,'balance',totals.balance,
          'latestReceipt',(select e.id from public.khpos_finance_entries e
            where e.learner_id=student and e.school_id=p_school and e.campus_id=p_campus
              and e.kind='payment' and e.posted<=p.ends
              and not exists (select 1 from public.khpos_finance_entries reversal
                where reversal.original_id=e.id and reversal.kind='reverse' and reversal.posted<=p.ends)
            order by e.posted desc,e.number desc limit 1))
          from public.khpos_ops_learner_anchors l
          left join public.khpos_finance_learners f on f.learner_id=l.id and f.school_id=p_school
          cross join lateral (
            select coalesce(sum(i.amount) filter (where not i.opening),0) billed,
              coalesce(sum(khpos_private.finance_invoice_balance(i.id,p.ends)),0) balance
            from public.khpos_finance_invoices i where i.learner_id=student
              and i.school_id=p_school and i.campus_id=p_campus and i.issued<=p.ends
          ) totals
          where l.id=student and l.organisation_id=p_school)
          || jsonb_build_object('credit',khpos_private.finance_learner_credit(p_school,p_campus,student,p.ends),'invoices',$new$);
  if updated=source then raise exception 'Finance learner statement was not found'; end if;
  source := updated;
  updated := replace(source,
    $old$and (p_action='invoice' or i.period_id=p.id)$old$,
    $new$and (p_action='invoice' or i.period_id=p.id or (p_input->>'includeHistory'='true' and i.issued<=p.ends))
            and (p_input->>'outstandingOnly' is distinct from 'true' or khpos_private.finance_invoice_balance(i.id)>0)$new$);
  if updated=source then raise exception 'Finance invoice search was not found'; end if;
  execute updated;
end;
$migration$;
