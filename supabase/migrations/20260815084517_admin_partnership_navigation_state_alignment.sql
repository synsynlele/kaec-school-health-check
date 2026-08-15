do $$
declare
  v_def text;
  v_active_orgs_old text := 'where o.status=''active'' and o.organisation_type=''school''';
  v_active_orgs_new text := 'where o.status=''active'' and o.organisation_type=''school'' and o.partner_status=''active''';
  v_attention_old text := 'when ir.improvement_classification is null then ''reassessment_required''';
  v_attention_new text := 'when ir.improvement_classification is null then ''baseline_ready''';
begin
  select pg_get_functiondef('public.khpos_get_portfolio_intelligence_server(uuid)'::regprocedure)
    into v_def;

  if position(v_active_orgs_old in v_def) = 0 then
    raise exception 'Expected active_orgs clause was not found in portfolio intelligence function.';
  end if;
  if position(v_attention_old in v_def) = 0 then
    raise exception 'Expected reassessment attention clause was not found in portfolio intelligence function.';
  end if;

  v_def := replace(v_def, v_active_orgs_old, v_active_orgs_new);
  v_def := replace(v_def, v_attention_old, v_attention_new);
  execute v_def;
end;
$$;

revoke execute on function public.khpos_get_portfolio_intelligence_server(uuid) from public, anon, authenticated;
grant execute on function public.khpos_get_portfolio_intelligence_server(uuid) to service_role;
