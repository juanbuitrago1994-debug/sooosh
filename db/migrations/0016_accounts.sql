-- Sooosh · cuentas (fase 1). Entrada solo con Google (Supabase Auth). Perfil de la persona y dispositivos desde los que entró.
-- El servidor entra con el rol postgres (ignora RLS) y siempre filtra por el usuario verificado; las políticas protegen
-- además cualquier acceso directo con la clave pública: cada persona solo LEE sus propias filas y no escribe nada por esa vía.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- código ISO 3166-1 de dos letras (CO, MX, ES…)
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- nombres de cargo que quiere buscar; se editan en Ajustes
  role_interests text[] not null default '{}' check (cardinality(role_interests) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un dispositivo = una sesión de navegador. La cookie de dispositivo (firmada con AUTH_DEVICE_SECRET) trae este id.
create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- true: la persona marcó «Mantener sesión iniciada»; false: la sesión muere al cerrar el navegador
  remember boolean not null default false,
  label text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists trusted_devices_user_idx on public.trusted_devices (user_id, last_seen_at desc);

alter table public.profiles enable row level security;
alter table public.trusted_devices enable row level security;

revoke all on public.profiles, public.trusted_devices from anon, authenticated;
grant select on public.profiles, public.trusted_devices to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);

drop policy if exists trusted_devices_select_own on public.trusted_devices;
create policy trusted_devices_select_own on public.trusted_devices for select to authenticated using ((select auth.uid()) = user_id);
