-- Proyectos nuevos de Supabase ya no dan permisos por defecto a anon/authenticated: la política RLS sola no basta, hace falta el GRANT (solo lectura).
grant select on public.jobs to anon, authenticated;
