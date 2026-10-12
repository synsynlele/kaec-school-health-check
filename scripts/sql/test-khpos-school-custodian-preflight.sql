begin;
set local lock_timeout='2s';
set local statement_timeout='20s';
create temp table custodian_roles_before on commit drop as select id,code,title,reports_to_role_id from public.khpos_ops_roles;
create temp table custodian_assignments_before on commit drop as select id,role_id,user_id,status from public.khpos_ops_role_assignments;
create temp table custodian_charters_before on commit drop as select id,mission,decision_rights from public.khpos_ops_role_charters;
create temp table custodian_function_access_before on commit drop as select p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','khpos_private') and p.prokind='f' and pg_get_functiondef(p.oid) like '%VISION_CUSTODIAN%';
