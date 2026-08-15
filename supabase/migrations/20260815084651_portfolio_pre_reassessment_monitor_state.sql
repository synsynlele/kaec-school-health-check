do $$
declare
  v_def text;
  v_old text := 'when ir.improvement_classification is null then ''baseline_ready''';
  v_new text := 'when ir.improvement_classification is null then ''monitor''';
begin
  select pg_get_functiondef('public.khpos_get_portfolio_intelligence_server(uuid)'::regprocedure)
    into v_def;
  if position(v_old in v_def) = 0 then
    raise exception 'Expected baseline_ready attention clause was not found.';
  end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end;
$$;

revoke execute on function public.khpos_get_portfolio_intelligence_server(uuid) from public, anon, authenticated;
grant execute on function public.khpos_get_portfolio_intelligence_server(uuid) to service_role;
