-- Self-provisioned KHP-OS push secrets and scheduler.
-- Private VAPID material and the scheduler bearer token live in Supabase Vault.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.khpos_get_push_config_server()
returns jsonb
language sql
security definer
set search_path='public','vault','pg_temp'
as $$
  select coalesce(
    jsonb_object_agg(name, decrypted_secret),
    '{}'::jsonb
  )
  from vault.decrypted_secrets
  where name in (
    'khpos_vapid_public_key',
    'khpos_vapid_private_key',
    'khpos_vapid_subject',
    'khpos_push_cron_secret'
  );
$$;

revoke all on function public.khpos_get_push_config_server()
  from public, anon, authenticated;
grant execute on function public.khpos_get_push_config_server()
  to service_role;

create or replace function public.khpos_save_push_config_server(
  p_public_key text,
  p_private_key text,
  p_cron_secret text,
  p_subject text
) returns jsonb
language plpgsql
security definer
set search_path='public','vault','pg_temp'
as $$
begin
  if p_public_key !~ '^[A-Za-z0-9_-]{80,120}$'
     or p_private_key !~ '^[A-Za-z0-9_-]{40,80}$'
     or length(p_cron_secret) < 40
     or length(p_cron_secret) > 200
     or p_subject !~ '^(https://|mailto:)' then
    raise exception 'Invalid KHP-OS push configuration.';
  end if;

  if not exists(select 1 from vault.secrets where name='khpos_vapid_public_key') then
    perform vault.create_secret(
      p_public_key,
      'khpos_vapid_public_key',
      'KHP-OS Web Push VAPID public key'
    );
  end if;

  if not exists(select 1 from vault.secrets where name='khpos_vapid_private_key') then
    perform vault.create_secret(
      p_private_key,
      'khpos_vapid_private_key',
      'KHP-OS Web Push VAPID private key'
    );
  end if;

  if not exists(select 1 from vault.secrets where name='khpos_vapid_subject') then
    perform vault.create_secret(
      p_subject,
      'khpos_vapid_subject',
      'KHP-OS Web Push VAPID subject'
    );
  end if;

  if not exists(select 1 from vault.secrets where name='khpos_push_cron_secret') then
    perform vault.create_secret(
      p_cron_secret,
      'khpos_push_cron_secret',
      'KHP-OS scheduled push delivery bearer secret'
    );
  end if;

  return public.khpos_get_push_config_server();
exception
  when unique_violation then
    return public.khpos_get_push_config_server();
end;
$$;

revoke all on function public.khpos_save_push_config_server(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.khpos_save_push_config_server(text,text,text,text)
  to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname='khpos-daily-push-reminders'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end $$;

select cron.schedule(
  'khpos-daily-push-reminders',
  '0 6 * * *',
  $cron$
    select net.http_get(
      url := 'https://www.kshc.name.ng/api/khpos/push/deliver',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || coalesce(
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name='khpos_push_cron_secret'
            limit 1
          ),
          ''
        ),
        'User-Agent',
        'KHPOS-Supabase-Cron/1.0'
      ),
      timeout_milliseconds := 60000
    ) as request_id;
  $cron$
);
