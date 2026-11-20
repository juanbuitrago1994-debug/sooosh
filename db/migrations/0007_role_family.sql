-- Sooosh · familia de cargo y marca de tecnología (para el filtro «Tecnología» del buscador).
alter table public.jobs add column if not exists role_family text;
alter table public.jobs add column if not exists is_tech boolean not null default false;
create index if not exists jobs_is_tech_idx on public.jobs (is_tech) where status = 'activa';
create index if not exists jobs_role_family_idx on public.jobs (role_family) where status = 'activa';
