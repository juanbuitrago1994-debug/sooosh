-- Catálogo de fuentes de ofertas: datos fijos para mostrar (nombre, sitio, descripción, atribución) y dos mandos de operación
-- (interruptor «activa» y cadencia propia) sin tener que publicar código. El adaptador de cada fuente sigue en el código; la clave
-- (`key`) es el id de la fuente de la sincronización: getonboard, companies, portal:<x>, remote:<x>.
create table if not exists public.sources (
  key text primary key,
  name text not null,
  kind text not null check (kind in ('Plataforma', 'Empresas', 'Portal', 'Remotas')),
  home_url text,
  description text not null default '',
  -- Texto de atribución que piden los términos de la fuente (se muestra junto a sus ofertas).
  attribution text not null default '',
  -- null = la cadencia por defecto del código (3, 6 o 12 h).
  cadence_hours integer check (cadence_hours is null or cadence_hours between 1 and 168),
  active boolean not null default true,
  -- Cuándo se revisaron por última vez los términos de uso de la fuente.
  terms_reviewed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sources enable row level security;
revoke all on public.sources from anon, authenticated;

insert into public.sources (key, name, kind, home_url, description, attribution, terms_reviewed_on) values
  ('getonboard', 'Get on Board', 'Plataforma', 'https://www.getonbrd.com',
   'Plataforma de empleo tech de Latinoamérica: cada oferta trae requisitos, modalidad y salario cuando la empresa los publica.',
   'Ofertas de Get on Board (getonbrd.com). Cada oferta enlaza a su publicación original.', '2026-11-20'),
  ('companies', 'Empresas con tablero público', 'Empresas', null,
   'Tableros de empleo que las propias empresas publican (Greenhouse, Lever, Ashby y otros): la oferta original, tal como la escribió la empresa.',
   'Ofertas publicadas por cada empresa en su tablero. El botón de postular lleva a su página.', '2026-11-20'),
  ('portal:chiletrabajos', 'Chiletrabajos', 'Portal', 'https://www.chiletrabajos.cl',
   'Portal chileno de empleo. Traemos solo cargos de tecnología.',
   'Datos públicos de cada oferta en Chiletrabajos. El botón de postular lleva al portal.', '2026-11-20'),
  ('portal:trabajando', 'Trabajando.cl', 'Portal', 'https://www.trabajando.cl',
   'Portal chileno de empleo. Traemos solo cargos de tecnología.',
   'Datos públicos de cada oferta en Trabajando.cl. El botón de postular lleva al portal.', '2026-11-20'),
  ('remote:remotive', 'Remotive', 'Remotas', 'https://remotive.com',
   'Ofertas remotas de empresas de todo el mundo; solo las abiertas a Latinoamérica.',
   'Ofertas de Remotive (remotive.com). El botón de postular lleva a su publicación, como piden sus términos.', '2026-11-20'),
  ('remote:jobicy', 'Jobicy', 'Remotas', 'https://jobicy.com',
   'Ofertas remotas de todo el mundo; solo las abiertas a Latinoamérica.',
   'Ofertas de Jobicy (jobicy.com). El botón de postular lleva a su publicación, como piden sus términos.', '2026-11-20'),
  ('remote:himalayas', 'Himalayas', 'Remotas', 'https://himalayas.app',
   'Ofertas remotas de todo el mundo; solo las abiertas a Latinoamérica.',
   'Ofertas de Himalayas (himalayas.app). El botón de postular lleva a su publicación, como piden sus términos.', '2026-11-20')
on conflict (key) do nothing;
