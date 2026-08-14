do $$
declare
  t text;
begin
  foreach t in array array[
    'ai_reports','analytics','answers','assessments','benchmarks','contact_requests',
    'domain_scores','improvement_plan','recommendations','reports','schools','users'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
  end loop;
end $$;

comment on schema public is 'KSHC/KHP-OS application schema. Legacy diagnostic tables are server-only unless an explicit RLS policy grants access.';
