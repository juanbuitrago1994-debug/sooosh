-- Sooosh · categorías propias y notas sobre las ofertas guardadas (fase 5). La persona crea categorías con el nombre que quiera y agrupa ahí
-- sus ofertas; cada oferta tiene una nota libre. Además, las ofertas del buscador se guardan en la cuenta (`origin = 'buscador'`, `job_id`).
-- Escribe solo el servidor (rol postgres); con la clave pública cada persona solo LEE lo suyo.

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
-- un nombre por persona, sin distinguir mayúsculas
create unique index if not exists collections_user_name_idx on public.collections (user_id, lower(btrim(name)));

alter table public.tracked_offers
  -- al borrar una categoría, sus ofertas NO se borran: quedan «sin categoría»
  add column if not exists collection_id uuid references public.collections (id) on delete set null,
  add column if not exists note text check (note is null or char_length(note) <= 2000),
  add column if not exists origin text not null default 'enlace' check (origin in ('enlace', 'buscador', 'texto')),
  -- la oferta del buscador de la que salió la copia
  add column if not exists job_id uuid;
create unique index if not exists tracked_offers_user_job_idx on public.tracked_offers (user_id, job_id) where job_id is not null;
create index if not exists tracked_offers_collection_idx on public.tracked_offers (collection_id);

alter table public.collections enable row level security;
revoke all on public.collections from anon, authenticated;
grant select on public.collections to authenticated;
drop policy if exists collections_select_own on public.collections;
create policy collections_select_own on public.collections for select to authenticated using ((select auth.uid()) = user_id);
