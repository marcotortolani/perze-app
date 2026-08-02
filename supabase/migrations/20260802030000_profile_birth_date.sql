-- K2 (perfil) — fecha de nacimiento, opcional, solo para estadística
-- agregada del panel de operador. Nunca obligatoria, nunca usada para
-- decisiones de producto ni mostrada a otros miembros del household.
ALTER TABLE public.profiles ADD COLUMN birth_date date;
