-- Sooosh · ciudad en el perfil (27-nov-2026, pedido de Juan). Opcional; se puede rellenar con «Usar mi ubicación».
alter table public.profiles add column if not exists city text check (city is null or char_length(btrim(city)) between 1 and 80);
