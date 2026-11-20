-- Candado de la sincronización: evita que dos corridas (GitHub Actions y el Mac) se pisen. Caduca solo (por si una corrida muere).
-- No se usa un candado de sesión de Postgres porque el «Transaction pooler» (puerto 6543) no lo conserva entre consultas.
create table if not exists public.sync_locks (
  name text primary key,
  holder text not null,
  locked_until timestamptz not null
);
alter table public.sync_locks enable row level security;
revoke all on public.sync_locks from anon, authenticated;
