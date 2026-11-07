-- Sincronización del censo cada 15 minutos desde la propia base de datos.
-- GitHub Actions no sirve como reloj principal: sus cron se retrasan horas (corridas cada 3-6 h,
-- no cada hora) y GitHub los desactiva tras 60 días sin actividad en el repositorio.
-- Requiere la versión de censo-sync que acepta el encabezado x-cron-token.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Token generado dentro de la base y guardado en Vault: no pasa por el código ni por el repositorio.
select vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'censo_cron_token', 'Autoriza a pg_cron a invocar censo-sync');
-- Anon key pública (ya está en el bundle de la app): el gateway de Edge Functions exige un JWT.
select vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVudWtra3l2YmtmaHB2dGtqdXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Njc2MjQsImV4cCI6MjA5NzU0MzYyNH0.EI2Q2XSp_gbuzfekg3ouAJ6xaIW1pD3Po-avWQ8G0A8', 'censo_anon_key', 'Anon key (pública) para el gateway de Edge Functions');

create or replace function public.censo_cron_token_ok(t text) returns boolean
language sql security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'censo_cron_token' and decrypted_secret = t)
$$;
revoke all on function public.censo_cron_token_ok(text) from public, anon, authenticated;
grant execute on function public.censo_cron_token_ok(text) to service_role;

-- La autorización real es x-cron-token.
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
