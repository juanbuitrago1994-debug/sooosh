-- Sooosh · cola de enriquecimiento con IA de ofertas pobres. El texto original de la oferta vive aquí SOLO mientras espera su turno:
-- al terminar se borra (`text = null`) y queda únicamente lo extraído en `jobs.offer`. Solo el servidor la toca (RLS sin políticas).
create table if not exists public.job_enrichment (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  content_hash text not null,
  text text,
  status text not null default 'pendiente' check (status in ('pendiente', 'hecho', 'omitido', 'fallido')),
  attempts integer not null default 0,
  error text,
  queued_at timestamptz not null default now(),
  processed_at timestamptz,
  ms integer
);
create index if not exists job_enrichment_status_idx on public.job_enrichment (status, queued_at);
alter table public.job_enrichment enable row level security;
revoke all on public.job_enrichment from anon, authenticated;
