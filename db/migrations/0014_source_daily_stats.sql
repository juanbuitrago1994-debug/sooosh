-- Foto diaria por fuente (una fila por día y fuente; se sobrescribe a lo largo del día con la última lectura). Sirve para ver tendencias
-- (cuántas ofertas trae cada fuente, cuánto duran, qué tan completas llegan) y, más adelante, comparar la calidad de las fuentes.
-- No guarda datos personales. El día es UTC.
create table if not exists public.source_daily_stats (
  day date not null,
  source_key text not null,
  active_offers integer not null default 0,
  tech_offers integer not null default 0,
  salary_offers integer not null default 0,
  remote_offers integer not null default 0,
  -- ofertas con al menos 2 elementos entre requisitos, deseables y tareas (completas para calcular el encaje)
  structured_offers integer not null default 0,
  -- edad media de las ofertas activas, en días
  avg_age_days numeric(7, 1),
  -- lecturas de ese día: cuántas, cuántas con éxito, ofertas leídas, nuevas y cerradas
  runs integer not null default 0,
  runs_ok integer not null default 0,
  fetched integer not null default 0,
  added integer not null default 0,
  closed integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, source_key)
);
alter table public.source_daily_stats enable row level security;
revoke all on public.source_daily_stats from anon, authenticated;
