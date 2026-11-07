-- Sincronización del censo cada 15 minutos desde la propia base de datos.
-- GitHub Actions no sirve como reloj principal: sus cron se retrasan horas (corridas cada 3-6 h,
-- no cada hora) y GitHub los desactiva tras 60 días sin actividad en el repositorio.
-- REQUIERE tener desplegada la versión de censo-sync que acepta el encabezado x-cron-token.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Token generado dentro de la base y guardado en Vault: no pasa por el código ni por el repositorio.
select vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'censo_cron_token', 'Autoriza a pg_cron a invocar censo-sync');

create or replace function public.censo_cron_token_ok(t text) returns boolean
language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'censo_cron_token' and decrypted_secret = t)
$$;
revoke all on function public.censo_cron_token_ok(text) from public, anon, authenticated;
grant execute on function public.censo_cron_token_ok(text) to service_role;

-- El Authorization lleva la anon key (pública, ya está en el bundle de la app); la autorización real es x-cron-token.
select cron.schedule('censo-sync-15min', '*/15 * * * *', $job$
  select net.http_post(
    url := 'https://unukkkyvbkfhpvtkjuxd.supabase.co/functions/v1/censo-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'censo_anon_key'),
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'censo_cron_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$job$);
-- Antes de aplicar: select vault.create_secret('<anon key>', 'censo_anon_key');
