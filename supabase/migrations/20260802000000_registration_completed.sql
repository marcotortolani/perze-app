-- C7 — señal de "ya completó el registro" (nombre + contraseña, pantalla
-- nueva `/onboarding/register`). Sin esto no hay forma de distinguir, del
-- lado servidor, entre un usuario que verificó el mail por primera vez y
-- uno que ya pasó por el registro alguna vez — el proxy la usa para elegir
-- entre `/onboarding` (alta nueva) y `/login` (reingreso) cuando no hay
-- sesión viva pero sí la cookie `perze_registered` (ver `registered-cookie.ts`).
--
-- `profiles_select`/`profiles_update` (self-only, `20260801010200_identity.sql`)
-- ya cubren lectura y escritura de la fila propia — no hace falta policy
-- nueva. `protect_access_columns()` (`20260801180000_access_control.sql`)
-- solo protege `is_app_admin`/`access_status`/sus metadatos de revisión;
-- esta columna queda libre de escribir por el propio usuario, como
-- `display_name` o `country`.
ALTER TABLE public.profiles
  ADD COLUMN registration_completed_at timestamptz;
