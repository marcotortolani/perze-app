-- Reversión de la solución de transición de contraseñas
-- (docs/mejora-auth-oauth-y-email.md § 0.1). `registration_completed_at`
-- (20260802000000_registration_completed.sql) marcaba si un usuario ya
-- había pasado por `/onboarding/register` (nombre + contraseña) — esa
-- pantalla ya no existe, así que nadie la lee ni la escribe.
--
-- Append-only: no se edita la migración original, se agrega esta. Se
-- aplica DESPUÉS de desplegar el código que dejó de leerla/escribirla
-- (si se aplicara antes, el código viejo en producción fallaría al
-- intentar leer una columna que ya no existe).
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS registration_completed_at;
