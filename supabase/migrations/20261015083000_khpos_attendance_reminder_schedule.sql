-- Attendance reminders need to arrive near a scheduled class, not only
-- once at 07:00 Nigeria time. Reuse the existing KHP-OS push endpoint and
-- its existing per-device/day delivery de-duplication (no new queue).
-- Run every 30 minutes from 06:00 to 17:30 WAT, Monday to Saturday.
-- The public notification service checks due actions and completion before
-- attempting delivery. No Sunday alerts, no off-hours alerts.
--
-- Preserve the existing job id, bearer token, web endpoint and Vercel project.
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job
  where jobname='khpos-daily-push-reminders' and active
  limit 1;
  if v_job_id is null then
    raise exception 'Existing KHP-OS push scheduler is missing; do not install an unverified duplicate job.';
  end if;
  perform cron.alter_job(v_job_id, schedule => '*/30 5-16 * * 1-6');
end;
$$;
