-- A11/A12 (auditoría técnica) — cero GRANT y cero REVOKE en las 30
-- migraciones hasta acá. Funcionaba porque las tablas se crearon antes del
-- cambio de default de la plataforma (`auto_expose_new_tables` pasó a
-- estar desactivado por default, ver `supabase/config.toml:24`); un
-- proyecto nuevo (self-host, CI, staging) da "permission denied for table
-- accounts" a `authenticated` con RLS perfecto, porque RLS filtra FILAS,
-- no reemplaza el GRANT de la tabla — hacen falta las dos capas.
--
-- Sin `DELETE` a propósito: coherente con el patrón soft-delete de todo
-- el esquema (`deleted_at`/`archived_at` vía UPDATE, nunca un DELETE real
-- desde el cliente salvo las excepciones ya documentadas — tags/payees/
-- transaction_tags, que tienen su propia policy y no dependen de este
-- GRANT genérico para el DELETE real).
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Igual para tablas/secuencias que se creen en migraciones futuras, sin
-- que cada una necesite acordarse de repetir el GRANT — corre como el
-- rol que aplica las migraciones (`postgres`), que es quien las crea.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- `anon` no necesita nada de esto: toda la app real exige sesión (B1/B5);
-- lo poco que hoy corre sin sesión (onboarding, /api/fx) ya valida su
-- propia auth adentro del route handler o no toca estas tablas.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- A12 — las funciones SECURITY DEFINER estaban bien construidas (todas con
-- `SET search_path = ''`, auditadas una por una) pero con el default de
-- Postgres de EXECUTE a PUBLIC: `recompute_account_balance(uuid)` hace un
-- UPDATE a accounts bypasseando RLS con cualquier `account_id` (UUID v7,
-- parcialmente adivinable por timestamp) llamado directo por cualquier rol
-- con sesión, y `can_see_as()` es un oráculo de `visibility_grants` sin
-- chequeo de membresía propio. Ninguna de las dos se llama nunca desde el
-- cliente (grep sobre src/): son helpers internos de un trigger
-- (`recompute_account_balance`) o de otra función SECURITY DEFINER
-- (`assert_can_mirror`, desde `mirror_accounts`/`mirror_transactions`) —
-- revocarles EXECUTE no rompe nada porque esas llamadas corren ya con el
-- privilegio del dueño de la función, no del rol que originó la request.
REVOKE EXECUTE ON FUNCTION public.recompute_account_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_can_mirror(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- `household_created_by_caller` — helper de la policy de INSERT de
-- `households` (evita la recursión de mirar `household_members` antes de
-- que exista la fila); mismo trato que los de abajo.
REVOKE EXECUTE ON FUNCTION public.household_created_by_caller(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.household_created_by_caller(uuid) TO authenticated;

-- Los helpers que sí evalúan RLS en el contexto de `authenticated` (se
-- llaman DESDE una policy mientras PostgREST corre como ese rol) necesitan
-- seguir siendo ejecutables por `authenticated` — revocarles EXECUTE
-- rompería toda policy que los usa, no es lo que pide A12.
REVOKE EXECUTE ON FUNCTION public.can_see(text, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_see_as(text, uuid, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_households() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_household_admin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_see(text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_as(text, uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_households() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_admin(uuid) TO authenticated;

-- Las 3 RPC reales que el cliente sí invoca directo (`grep -rn '.rpc(' src/`).
REVOKE EXECUTE ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_accounts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mirror_accounts(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_transactions(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mirror_transactions(uuid, uuid) TO authenticated;
