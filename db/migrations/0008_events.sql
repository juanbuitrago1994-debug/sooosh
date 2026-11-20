-- Sooosh · medición de uso con consentimiento (docs/CONSENTIMIENTO.md). Solo el servidor las toca: RLS activo y sin políticas.
create table if not exists public.consent_log (
  id bigint generated always as identity primary key,
  anon_id uuid not null,
  version text not null,
  personal boolean not null,
  aggregate boolean not null,
  at timestamptz not null default now()
);
create index if not exists consent_log_anon_idx on public.consent_log (anon_id, at desc);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  anon_id uuid not null,
  at timestamptz not null default now(),
  kind text not null check (kind in ('search', 'impressions', 'open', 'apply_click', 'adapt_cv', 'save', 'dismiss')),
  payload jsonb not null default '{}'::jsonb,
  -- para qué se puede usar, según el consentimiento vigente al registrarlo
  personal boolean not null default false,
  aggregate boolean not null default false
);
create index if not exists events_anon_at_idx on public.events (anon_id, at desc);
create index if not exists events_kind_at_idx on public.events (kind, at desc);
create index if not exists events_at_idx on public.events (at);

alter table public.consent_log enable row level security;
alter table public.events enable row level security;
revoke all on public.consent_log, public.events from anon, authenticated;
