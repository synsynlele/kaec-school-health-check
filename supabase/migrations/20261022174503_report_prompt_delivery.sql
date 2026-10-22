-- Available report periods enter Today and notifications immediately, regardless of deadline.
CREATE OR REPLACE FUNCTION public.khpos_report_attention_server(p_actor uuid, p_school uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not khpos_private.ops_hpd_has_membership(p_actor,p_school) then raise exception 'Active school membership is required.'; end if;
 perform public.khpos_reports_sync_server(p_school);
 with visible as (
  select n.id,n.title,n.period_start,n.period_end,n.status,n.lock_version,n.due_at,n.submitted_at,khpos_private.report_owner(p_actor,n.id) as owned,khpos_private.report_reviewer(p_actor,n.id) as review
  from public.khpos_reports n where n.school_id=p_school and n.status in ('draft','returned','submitted')
 ), actions as (
 select id,title,period_start,period_end,status,lock_version,due_at,submitted_at,owned as "canEdit",review as "canReview",due_at<now() as overdue from visible
 where (owned and status in ('draft','returned')) or (review and status='submitted')
 order by case when review and status='submitted' then 0 when status='returned' then 1 when period_end>=(now() at time zone 'Africa/Lagos')::date then 2 else 3 end,due_at,id limit 100
 ) select jsonb_build_object('summary',jsonb_build_object('open',(select count(*) from visible where owned and status in ('draft','returned')),'overdue',(select count(*) from visible where owned and status in ('draft','returned') and due_at<now()),'review',(select count(*) from visible where review and status='submitted')),'items',coalesce((select jsonb_agg(actions) from actions),'[]'::jsonb)) into result;
 return result;
end $function$;

revoke all on function public.khpos_report_attention_server(uuid,uuid) from public,anon,authenticated;
grant execute on function public.khpos_report_attention_server(uuid,uuid) to service_role;

-- Reuse the existing authenticated, de-duplicated delivery job and quiet hours.
-- This changes frequency only; no replacement endpoint or secret is introduced.
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job
  where jobname='khpos-daily-push-reminders' and active limit 1;
  if v_job_id is null then
    raise exception 'Existing KHP-OS push scheduler is missing.';
  end if;
  perform cron.alter_job(v_job_id, schedule => '*/5 5-16 * * 1-6');
end;
$$;
