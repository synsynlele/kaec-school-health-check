-- Assessment handoffs and policy-review work reuse the governed execution engine.
-- No new cron job or Vercel invocation is required.
alter table public.khpos_ops_process_execution_profiles
  drop constraint khpos_ops_process_execution_profiles_condition_key_check;
alter table public.khpos_ops_process_execution_profiles
  add constraint khpos_ops_process_execution_profiles_condition_key_check
  check (condition_key is null or condition_key in (
    'work_overdue','issue_overdue','decision_overdue','kpi_failing',
    'process_unmapped','policy_review_due'
  ));

create or replace function khpos_private.ops_capture_assessment_handoff()
returns trigger
language plpgsql
set search_path=public,khpos_private,pg_temp
as $$
begin
  -- Delivery has ended; results still require follow-up. This does not approve results.
  if new.status <> 'results_pending' then return new; end if;
  if TG_OP='UPDATE' and old.status='results_pending' then return new; end if;
  perform khpos_private.ops_emit_system_event(
    new.organisation_id,'assessment_results_followup_required',
    'assessment_results_followup_required:'||new.id::text,
    'assessment_cycle',new.id::text,
    jsonb_build_object('campusId',new.campus_id)
  );
  return new;
end;
$$;
revoke all on function khpos_private.ops_capture_assessment_handoff()
  from public,anon,authenticated;
create trigger trg_khpos_ops_assessment_handoff
  after insert or update of status on public.khpos_ops_assessment_cycles
  for each row execute function khpos_private.ops_capture_assessment_handoff();

create or replace function khpos_private.ops_evaluate_condition_triggers()
returns integer
language plpgsql
security definer
set search_path=public,khpos_private,pg_temp
as $$
declare
  v_profile public.khpos_ops_process_execution_profiles%rowtype;
  v_row record;
  v_count integer := 0;
  v_day text := to_char(current_date,'YYYY-MM-DD');
begin
  for v_profile in
    select *
    from public.khpos_ops_process_execution_profiles
    where status='configured' and activation_mode='condition'
  loop
    if v_profile.condition_key='work_overdue' then
      for v_row in
        select w.id,w.campus_id,w.unit_id,w.title
        from public.khpos_ops_work_items w
        where w.organisation_id=v_profile.organisation_id
          and w.status not in ('completed','cancelled')
          and w.due_at < now()
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'work_overdue',
          'work_overdue:'||v_row.id::text||':'||v_day,
          'work_item',v_row.id::text,
          jsonb_build_object('campusId',v_row.campus_id,'unitId',v_row.unit_id,'title',v_row.title)
        );
      end loop;
    elsif v_profile.condition_key='issue_overdue' then
      for v_row in
        select i.id,i.campus_id,i.unit_id,i.title
        from public.khpos_ops_issues i
        where i.organisation_id=v_profile.organisation_id
          and i.status not in ('resolved','verified','closed')
          and i.due_at < now()
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'issue_overdue',
          'issue_overdue:'||v_row.id::text||':'||v_day,
          'issue',v_row.id::text,
          jsonb_build_object('campusId',v_row.campus_id,'unitId',v_row.unit_id,'title',v_row.title)
        );
      end loop;
    elsif v_profile.condition_key='decision_overdue' then
      for v_row in
        select d.id,d.campus_id,d.unit_id,d.title
        from public.khpos_ops_decisions d
        where d.organisation_id=v_profile.organisation_id
          and d.status in ('submitted','under_review','approved')
          and coalesce(
            case when d.status='approved' and d.action_required then d.implementation_due_at end,
            d.decision_due_at
          ) < now()
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'decision_overdue',
          'decision_overdue:'||v_row.id::text||':'||v_day,
          'decision',v_row.id::text,
          jsonb_build_object('campusId',v_row.campus_id,'unitId',v_row.unit_id,'title',v_row.title)
        );
      end loop;
    elsif v_profile.condition_key='kpi_failing' then
      for v_row in
        select latest.* from (
        select distinct on (m.kpi_id)
          m.kpi_id,m.performance_status,k.name
        from public.khpos_ops_kpi_measurements m
        join public.khpos_ops_kpis k on k.id=m.kpi_id
        where m.organisation_id=v_profile.organisation_id
          and k.status='active'
        order by m.kpi_id,m.period_end desc,m.recorded_at desc,m.id desc
        ) latest where latest.performance_status in ('red','critical')
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'kpi_failing',
          'kpi_failing:'||v_row.kpi_id::text||':'||v_day,
          'kpi',v_row.kpi_id::text,
          jsonb_build_object('name',v_row.name,'performanceStatus',v_row.performance_status)
        );
      end loop;
    elsif v_profile.condition_key='policy_review_due' then
      for v_row in
        select pv.id,pv.review_date
        from public.khpos_ops_policy_versions pv
        join public.khpos_ops_policies p on p.id=pv.policy_id
        where p.organisation_id=v_profile.organisation_id
          and p.status='active' and pv.status='active'
          and pv.review_date <= (now() at time zone 'Africa/Lagos')::date
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'policy_review_due',
          'policy_review_due:'||v_row.id::text||':'||v_row.review_date::text,
          'policy_version',v_row.id::text,'{}'::jsonb
        );
      end loop;
    elsif v_profile.condition_key='process_unmapped' then
      for v_row in
        select ep.id,p.code,p.title
        from public.khpos_ops_process_execution_profiles ep
        join public.khpos_ops_processes p on p.id=ep.process_id
        where ep.organisation_id=v_profile.organisation_id
          and ep.status='needs_mapping'
          and p.status <> 'retired'
          and exists (
            select 1 from public.khpos_ops_process_versions pv
            where pv.process_id=p.id and pv.status='active'
          )
      loop
        v_count := v_count + khpos_private.ops_emit_system_event(
          v_profile.organisation_id,'process_unmapped',
          'process_unmapped:'||v_row.id::text||':'||v_day,
          'process_execution_profile',v_row.id::text,
          jsonb_build_object('code',v_row.code,'title',v_row.title)
        );
      end loop;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function khpos_private.ops_evaluate_condition_triggers() from public,anon,authenticated;
grant execute on function khpos_private.ops_evaluate_condition_triggers() to service_role;
