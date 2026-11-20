-- Sooosh · cómo se aplica a una oferta y su salario (cuando la fuente lo dice). Ambos son jsonb opcionales:
--   apply  = { method: 'plataforma'|'formulario'|'correo'|'sitio'|'desconocido', platform?, url?, email? }
--   salary = { min?, max?, currency, period: 'mes'|'año'|'hora' }
alter table public.jobs add column if not exists apply jsonb;
alter table public.jobs add column if not exists salary jsonb;
