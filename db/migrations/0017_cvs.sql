-- Sooosh · CV validados en la cuenta (fase 2). Solo se guarda el CV ya leído y validado por la persona (JSON): NUNCA el archivo original ni su texto.
-- Escribe solo el servidor (rol postgres, filtrando por el usuario verificado); con la clave pública cada persona solo LEE sus propias filas.

create table if not exists public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- el CV validado (mismo formato que `lib/schemas/cv.ts`)
  cv jsonb not null,
  label text not null default '',
  -- datos del archivo del que salió: nombre, tipo, peso y lo que tardó la lectura (no el archivo)
  file jsonb,
  original_ats jsonb,
  -- id local del archivo: reconoce «el mismo CV» cuando la persona lo corrige y lo vuelve a validar
  file_id text,
  -- el CV con el que se busca y se adapta; los anteriores quedan como historial
  is_active boolean not null default true,
  validated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pg_column_size(cv) <= 200000)
);
-- un solo CV activo por persona
create unique index if not exists cvs_one_active_idx on public.cvs (user_id) where is_active;
create index if not exists cvs_user_idx on public.cvs (user_id, updated_at desc);

alter table public.cvs enable row level security;
revoke all on public.cvs from anon, authenticated;
grant select on public.cvs to authenticated;
drop policy if exists cvs_select_own on public.cvs;
create policy cvs_select_own on public.cvs for select to authenticated using ((select auth.uid()) = user_id);
