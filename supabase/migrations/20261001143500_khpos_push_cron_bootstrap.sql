-- Guarantee the scheduler bearer token exists before the first cron invocation.
do $$
declare
  v_secret text;
begin
  if not exists (
    select 1 from vault.secrets where name='khpos_push_cron_secret'
  ) then
    v_secret := translate(
      rtrim(encode(extensions.gen_random_bytes(48), 'base64'), '='),
      '+/',
      '-_'
    );

    perform vault.create_secret(
      v_secret,
      'khpos_push_cron_secret',
      'KHP-OS scheduled push delivery bearer secret'
    );
  end if;
end $$;
