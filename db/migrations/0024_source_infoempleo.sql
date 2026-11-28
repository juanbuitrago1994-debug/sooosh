-- Infoempleo (España) en el catálogo de fuentes: portal sin API; sitemap + JSON-LD con el lector de portales (robots.txt respetado).
-- Su aviso legal exige autorización para reproducir contenidos; Juan la obtuvo el 28-nov-2026.
insert into public.sources (key, name, kind, home_url, description, attribution, terms_reviewed_on) values
  ('portal:infoempleo', 'Infoempleo', 'Portal', 'https://www.infoempleo.com',
   'Portal español de empleo. Traemos solo cargos de tecnología.',
   'Ofertas de Infoempleo (infoempleo.com), con su autorización. El botón de postular lleva al portal.', '2026-11-28')
on conflict (key) do nothing;
