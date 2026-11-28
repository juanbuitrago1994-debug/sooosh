-- Gallito Trabajo (Uruguay) en el catálogo de fuentes: portal sin API; sitemap + JSON-LD con el lector de portales (robots.txt respetado).
insert into public.sources (key, name, kind, home_url, description, attribution, terms_reviewed_on) values
  ('portal:gallito', 'Gallito Trabajo', 'Portal', 'https://trabajo.gallito.com.uy',
   'Portal uruguayo de empleo. Traemos solo cargos de tecnología.',
   'Datos públicos de cada oferta en Gallito Trabajo. El botón de postular lleva al portal.', '2026-11-28')
on conflict (key) do nothing;
