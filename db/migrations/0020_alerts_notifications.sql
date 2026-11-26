-- Sooosh · alertas y notificaciones (fase 6). La persona define QUÉ quiere ver (país, modalidad, contrato, nivel, familia de cargo, palabras del título) y una tarea
-- automática (fase `alerts` de `pnpm sync`, cada 3 h) avisa DENTRO de la app cuando aparecen ofertas nuevas del buscador que cumplen esas condiciones.
-- Escribe solo el servidor (rol postgres); con la clave pública cada persona solo LEE lo suyo.

-- la alerta inicial (con los cargos de interés y el país del registro) se crea una sola vez; si la persona la borra, no vuelve
alter table public.profiles add column if not exists alerts_seeded boolean not null default false;

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- {regions[], workModes[], employmentTypes[], seniority[], families[], keywords[]}: todas las condiciones a la vez; dentro de cada una, cualquiera de sus valores
  filters jsonb not null default '{}'::jsonb,
  frequency text not null default 'cada_pasada' check (frequency in ('cada_pasada', 'diaria', 'semanal')),
  enabled boolean not null default true,
  -- 'inactiva': se pausó sola porque la persona no abrió sus notificaciones en 30 días
  paused_reason text check (paused_reason in ('inactiva')),
  last_run_at timestamptz,
  last_notified_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alerts_user_idx on public.alerts (user_id, created_at);
create index if not exists alerts_enabled_idx on public.alerts (enabled) where enabled;

-- ofertas del buscador que una alerta ya encontró: una oferta se avisa UNA sola vez por alerta
create table if not exists public.alert_matches (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.alerts (id) on delete cascade,
  job_id uuid not null,
  found_at timestamptz not null default now(),
  notified_at timestamptz,
  -- vista por la persona al abrir los resultados de la alerta
  seen_at timestamptz,
  unique (alert_id, job_id)
);
create index if not exists alert_matches_alert_idx on public.alert_matches (alert_id, found_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- alerta: ofertas nuevas de una alerta · oferta_cerrada: una oferta guardada cerró
  kind text not null check (kind in ('alerta', 'oferta_cerrada')),
  -- evita repetir (p. ej. una sola notificación por oferta que cerró)
  ref text,
  title text not null,
  body text not null default '',
  href text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index if not exists notifications_ref_idx on public.notifications (user_id, kind, ref) where ref is not null;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.alerts enable row level security;
alter table public.alert_matches enable row level security;
alter table public.notifications enable row level security;
revoke all on public.alerts, public.alert_matches, public.notifications from anon, authenticated;
grant select on public.alerts, public.alert_matches, public.notifications to authenticated;
drop policy if exists alerts_select_own on public.alerts;
create policy alerts_select_own on public.alerts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists alert_matches_select_own on public.alert_matches;
create policy alert_matches_select_own on public.alert_matches for select to authenticated using (exists (select 1 from public.alerts a where a.id = alert_id and a.user_id = (select auth.uid())));
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
