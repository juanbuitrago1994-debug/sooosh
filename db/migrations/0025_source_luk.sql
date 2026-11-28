-- Luk (Buk) en el catálogo de fuentes: portal de empleos para CO, MX, CL, PE y BR; sitemap + JSON-LD con el lector de portales (robots.txt respetado).
insert into public.sources (key, name, kind, home_url, description, attribution, terms_reviewed_on) values
  ('portal:luk', 'Luk (Buk)', 'Portal', 'https://www.takealuk.com',
   'Portal de empleos de Buk para Colombia, México, Chile, Perú y Brasil. Traemos solo cargos de tecnología.',
   'Ofertas de Luk (takealuk.com), con la autorización de Buk. El botón de postular lleva al portal.', '2026-11-28')
on conflict (key) do nothing;
