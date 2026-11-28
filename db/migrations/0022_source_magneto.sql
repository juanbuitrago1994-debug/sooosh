-- Magneto365 (Colombia) en el catálogo de fuentes: portal sin API; se lee su sitemap y el JSON-LD de cada oferta con el lector de portales
-- (robots.txt respetado, identificación SoooshBot). Medido el 28-nov-2026 (docs/FUENTES-DE-EMPLEO.md).
insert into public.sources (key, name, kind, home_url, description, attribution, terms_reviewed_on) values
  ('portal:magneto', 'Magneto365', 'Portal', 'https://www.magneto365.com',
   'Portal colombiano de empleo. Traemos solo cargos de tecnología.',
   'Datos públicos de cada oferta en Magneto365. El botón de postular lleva al portal.', '2026-11-28')
on conflict (key) do nothing;
