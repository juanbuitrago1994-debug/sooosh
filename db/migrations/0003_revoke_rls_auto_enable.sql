-- Aplicada al proyecto Sooosh el 19-nov-2026: el asesor de seguridad marcó que anon/authenticated podían ejecutar esta función SECURITY DEFINER.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
