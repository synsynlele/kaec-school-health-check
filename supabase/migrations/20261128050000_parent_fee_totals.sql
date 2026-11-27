create function public.khpos_parent_fee_totals(p_workspace uuid,p_learners jsonb)
returns jsonb language sql stable security definer set search_path='' as $$
  with requested as (
    select * from jsonb_to_recordset(case when jsonb_typeof(p_learners)='array' then
      case when jsonb_array_length(p_learners)<=30 then p_learners else '[]'::jsonb end else '[]'::jsonb end)
      as r(id uuid, school uuid, learner uuid)
  ), candidates as (
    select distinct r.id, i.organisation_id as school_id, a.id as learner_id
    from requested r
    join public.khpos_integrations i on i.external_tenant_id=p_workspace::text and i.provider='ksi' and i.status='active'
    left join public.khpos_ksi_learner_links l on l.school_id=i.organisation_id
      and l.workspace_id=p_workspace and l.ksi_learner_id=r.id
    join public.khpos_ops_learner_anchors a on a.organisation_id=i.organisation_id
      and (a.id=l.learner_id or (i.organisation_id=r.school and a.id=r.learner))
  ), matched as (
    select c.* from candidates c where not exists (
      select 1 from candidates other where other.id=c.id
      and (other.school_id,other.learner_id)<>(c.school_id,c.learner_id)
    )
  ), totals as (
    select m.id, sum(inv.amount) as billed
      from matched m join public.khpos_finance_invoices inv on inv.school_id=m.school_id and inv.learner_id=m.learner_id
      where inv.issued<=(now() at time zone 'Africa/Lagos')::date group by m.id
  ), allocations as (
    select m.id,
      sum(a.amount) filter (where coalesce(o.kind,e.kind) in ('payment','apply','refund')) as paid,
      sum(a.amount) filter (where coalesce(o.kind,e.kind) in ('discount','scholarship','waiver')) as relief,
      sum(a.amount) as applied
    from matched m join public.khpos_finance_invoices inv on inv.school_id=m.school_id and inv.learner_id=m.learner_id
    join public.khpos_finance_allocations a on a.invoice_id=inv.id
    join public.khpos_finance_entries e on e.id=a.entry_id
    left join public.khpos_finance_entries o on o.id=e.original_id and e.kind='reverse'
    where inv.issued<=(now() at time zone 'Africa/Lagos')::date and e.posted<=(now() at time zone 'Africa/Lagos')::date group by m.id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'total',t.billed-coalesce(a.relief,0),
    'paid',coalesce(a.paid,0),'outstanding',greatest(t.billed-coalesce(a.applied,0),0))), '[]'::jsonb)
  from totals t left join allocations a on a.id=t.id;
$$;
revoke all on function public.khpos_parent_fee_totals(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_parent_fee_totals(uuid,jsonb) to service_role;
