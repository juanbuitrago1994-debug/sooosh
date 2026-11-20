-- Sooosh · puerto de fuentes: de dónde viene cada oferta y qué empresas se sincronizan.
alter table public.jobs add column if not exists source_key text;      -- 'getonboard', 'greenhouse:cabify'… (null = cargada a mano)
alter table public.jobs add column if not exists external_id text;     -- id de la oferta en la fuente
alter table public.jobs add column if not exists last_seen_at timestamptz; -- última sincronización en la que la fuente la devolvió
alter table public.jobs add column if not exists dedupe_key text;      -- título|empresa|país normalizados: evita la misma oferta de dos fuentes
alter table public.jobs add column if not exists origin text not null default 'manual' check (origin in ('manual', 'feed'));
create index if not exists jobs_source_key_idx on public.jobs (source_key) where source_key is not null;
create index if not exists jobs_dedupe_key_idx on public.jobs (dedupe_key) where dedupe_key is not null;

-- Directorio de empresas cuyo tablero de empleo (Greenhouse, Lever, Ashby) se sincroniza. Solo el servidor lo toca.
create table if not exists public.source_companies (
  id uuid primary key default gen_random_uuid(),
  ats text not null check (ats in ('greenhouse', 'lever', 'ashby')),
  token text not null,
  name text,
  active boolean not null default true,
  note text,
  last_synced_at timestamptz,
  last_status text,
  last_count integer,
  created_at timestamptz not null default now(),
  unique (ats, token)
);
alter table public.source_companies enable row level security;
revoke all on public.source_companies from anon, authenticated;
