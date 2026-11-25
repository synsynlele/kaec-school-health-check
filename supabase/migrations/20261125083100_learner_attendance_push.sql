-- Reuse the authenticated push endpoint and its per-subscription alert deduplication.
select cron.schedule(
  'khpos-learner-attendance-push',
  '0,30 11-22 * * *',
  $cron$
    select net.http_get(
      url := 'https://www.kshc.name.ng/api/khpos/push/deliver?category=learner_attendance',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || coalesce(
          (select decrypted_secret from vault.decrypted_secrets where name='khpos_push_cron_secret' limit 1),
          ''
        ),
        'User-Agent',
        'KHPOS-Supabase-Cron/1.0'
      ),
      timeout_milliseconds := 60000
    ) as request_id;
  $cron$
);
