-- Reloj propio de la sincronización: cada 3 h (minuto 17, UTC) la base de datos le pide a GitHub que lance el workflow «Sincronizar ofertas»
-- (workflow_dispatch). Existe porque el cron de GitHub no disparó en este repositorio (diagnóstico del 20-nov-2026); si GitHub vuelve a disparar
-- el suyo, no pasa nada: cada fuente tiene su cadencia y un candado impide corridas simultáneas.
-- El token de GitHub (fine-grained, solo «Actions: Read and write» sobre este repositorio) vive en Supabase Vault con el nombre
-- `github_dispatch_token`; NUNCA en el repositorio. Sin el secreto, la función no hace nada.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_sync_workflow() returns bigint
language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  tok text;
  req bigint;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_dispatch_token' limit 1;
  if tok is null then
    raise notice 'trigger_sync_workflow: falta el secreto github_dispatch_token en Vault';
    return null;
  end if;
  select net.http_post(
    url := 'https://api.github.com/repos/juanbuitrago1994-debug/sooosh/actions/workflows/sync.yml/dispatches',
    headers := jsonb_build_object('Authorization', 'Bearer ' || tok, 'Accept', 'application/vnd.github+json', 'X-GitHub-Api-Version', '2022-11-28', 'User-Agent', 'SoooshCron/0.1'),
    body := jsonb_build_object('ref', 'main')
  ) into req;
  return req;
end $$;
revoke all on function public.trigger_sync_workflow() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'sooosh-sync-dispatch';
select cron.schedule('sooosh-sync-dispatch', '17 */3 * * *', 'select public.trigger_sync_workflow()');
