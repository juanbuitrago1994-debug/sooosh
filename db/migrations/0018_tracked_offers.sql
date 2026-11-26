-- Sooosh · ofertas guardadas con seguimiento automático (fase 3). La persona pega el enlace, el análisis extrae la oferta y se guarda COMPLETA
-- (copia: si la fuente la cierra, no se pierde). Una tarea automática revisa cada enlace y marca «finalizada» cuando ya no responde.
-- Solo escribe el servidor (rol postgres); con la clave pública cada persona solo LEE sus propias filas.
-- La revisión (`lib/tracking/check.ts`) lee únicamente `source_url`; no necesita saber de quién es la oferta.

create table if not exists public.tracked_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- dirección canónica (la misma oferta no se guarda dos veces aunque el enlace traiga rastreadores) y la que pegó la persona
  source_url text not null check (char_length(source_url) <= 600),
  original_url text not null check (char_length(original_url) <= 1200),
  source_name text not null default 'web',
  title text not null,
  company text,
  -- empresa en minúsculas y sin tildes: agrupa «Nubank» y «NUBANK»
  company_key text not null default '',
  offer jsonb not null,
  text text not null check (char_length(text) <= 24000),
  -- lo que dice la propia página (JSON-LD), si lo trae
  posted_at timestamptz,
  valid_through timestamptz,
  -- vigente: la última revisión la encontró abierta · finalizada: dos revisiones seguidas dijeron que cerró (o venció su vigencia)
  -- sin_verificar: el sitio no deja revisarla sin iniciar sesión o aún no se ha podido
  status text not null default 'sin_verificar' check (status in ('vigente', 'finalizada', 'sin_verificar')),
  dead_streak int not null default 0,
  last_checked_at timestamptz,
  last_alive_at timestamptz,
  closed_detected_at timestamptz,
  check_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_url)
);
create index if not exists tracked_offers_user_idx on public.tracked_offers (user_id, created_at desc);
create index if not exists tracked_offers_due_idx on public.tracked_offers (last_checked_at nulls first);

alter table public.tracked_offers enable row level security;
revoke all on public.tracked_offers from anon, authenticated;
grant select on public.tracked_offers to authenticated;
drop policy if exists tracked_offers_select_own on public.tracked_offers;
create policy tracked_offers_select_own on public.tracked_offers for select to authenticated using ((select auth.uid()) = user_id);
