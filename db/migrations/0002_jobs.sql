-- Sooosh · ofertas de empleo (tarjetas del buscador). Solo Supabase (usa extensiones que no están en las pruebas locales).
create extension if not exists vector with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent no es IMMUTABLE por defecto; este envoltorio permite usarlo en columnas generadas e índices.
create or replace function public.f_unaccent(text) returns text
  language sql immutable parallel safe strict
  set search_path = ''
  as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create or replace function public.set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
  as $$ begin new.updated_at = now(); return new; end $$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  /** enlace de la oferta original (clave única: la misma oferta no se carga dos veces) */
  source_url text not null,
  source_name text not null default 'manual',
  title text not null,
  company text,
  location_text text,
  /** país de la oferta (ISO 3166-1 alfa-2: CO, MX, AR, US, ES…); null si es remota sin país */
  country text,
  /** regiones en las que se puede postular: LATAM, CO, MX, AR, US, ES… */
  regions text[] not null default '{}',
  work_mode text check (work_mode in ('remoto', 'hibrido', 'presencial')),
  /** restricción de un puesto remoto, tal como la dice la oferta («solo Colombia», «GMT-5»…) */
  remote_scope text,
  employment_type text,
  seniority text,
  language text check (language in ('es', 'en', 'otro')),
  /** oferta estructurada (mismo esquema Offer que usa el análisis de coincidencia) */
  offer jsonb not null,
  skills text[] not null default '{}',
  posted_at timestamptz,
  valid_through timestamptz,
  status text not null default 'activa' check (status in ('activa', 'cerrada', 'oculta')),
  /** embedding de bge-m3 (1024 dimensiones) para la búsqueda semántica */
  embedding extensions.vector(1024),
  search tsvector generated always as (
    to_tsvector('spanish', public.f_unaccent(coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(location_text, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists jobs_source_url_key on public.jobs (source_url);
create index if not exists jobs_status_created_idx on public.jobs (status, created_at desc);
create index if not exists jobs_regions_idx on public.jobs using gin (regions);
create index if not exists jobs_skills_idx on public.jobs using gin (skills);
create index if not exists jobs_search_idx on public.jobs using gin (search);
create index if not exists jobs_embedding_idx on public.jobs using hnsw (embedding extensions.vector_cosine_ops);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at before update on public.jobs for each row execute function public.set_updated_at();

-- Lectura pública de ofertas activas; escribir solo desde el servidor (sin políticas de insert/update/delete).
alter table public.jobs enable row level security;
drop policy if exists "ofertas activas: lectura pública" on public.jobs;
create policy "ofertas activas: lectura pública" on public.jobs for select to anon, authenticated using (status = 'activa');
revoke insert, update, delete, truncate on public.jobs from anon, authenticated;
