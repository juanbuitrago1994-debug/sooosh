-- Sooosh · memoria de preferencias (decisiones, reglas aprendidas y contadores).
-- Acceso SOLO desde el servidor (conexión directa o service_role): RLS activo y sin políticas = el navegador no ve nada.
create table if not exists public.decisions (
  id bigint generated always as identity primary key,
  ref text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null,
  section text not null,
  risk text not null,
  original text not null,
  proposal text not null,
  decision text not null,
  edited_text text,
  reason text,
  change_reason text,
  offer_title text,
  language text
);
create index if not exists decisions_kind_updated_idx on public.decisions (kind, updated_at desc);

create table if not exists public.rules (
  id bigint generated always as identity primary key,
  text text not null,
  source text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meta (
  key text primary key,
  value text not null
);

alter table public.decisions enable row level security;
alter table public.rules enable row level security;
alter table public.meta enable row level security;
revoke all on public.decisions, public.rules, public.meta from anon, authenticated;
