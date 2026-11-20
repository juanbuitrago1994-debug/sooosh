-- Registro de la sincronización automática: una fila por fuente y por corrida (sirve para no repetir una fuente dentro de las 20 h
-- y para ver qué pasó). No guarda datos personales.
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  fetched integer not null default 0,
  created integer not null default 0,
  updated integer not null default 0,
  closed integer not null default 0,
  error text
);
create index if not exists sync_runs_target_idx on public.sync_runs (target, started_at desc);
alter table public.sync_runs enable row level security;
revoke all on public.sync_runs from anon, authenticated;
