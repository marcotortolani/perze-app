-- Infraestructura compartida de los tests de RLS (GATE-1,
-- docs/plan-de-trabajo.md § 2). Corridos contra el proyecto real
-- `perze-app` (dhnyihwcsexraivhokoc) vía `supabase db query --linked -f`,
-- no vía `supabase test db` (que necesita el stack local con Docker, que
-- esta máquina no tiene).
--
-- Patrón: cada archivo de test crea DOS households (A y B) con un miembro
-- cada uno vía tests.create_household(), simula "estar logueado como" con
-- tests.authenticate_as(), y prueba que household A no puede leer/escribir/
-- actualizar/mover una fila de household B. Todo corre dentro de una
-- transacción que se revierte al final (pgTAP estándar), así que no hace
-- falta limpiar entre archivos.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS tests;

-- `supabase db query -f` corre contra la Management API, no una sesión
-- psql real: solo devuelve las filas del ÚLTIMO statement del archivo, no
-- la salida de cada `is()`/`throws_ok()` intermedio. tests.log() acumula
-- cada línea TAP en esta tabla; el archivo de test termina con un SELECT
-- que las lee todas juntas, antes del ROLLBACK final.
CREATE TABLE IF NOT EXISTS tests.tap_log (id bigserial PRIMARY KEY, line text);

CREATE OR REPLACE FUNCTION tests.log(p_line text)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO tests.tap_log (line) VALUES (p_line);
$$;

CREATE OR REPLACE FUNCTION tests.reset_log()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM tests.tap_log;
$$;

-- Los tests llaman a tests.get()/tests.stash()/tests.authenticate_as()
-- DESPUÉS de `SET LOCAL ROLE authenticated` (para simular al usuario
-- logueado) — sin este GRANT, authenticated no tiene ni USAGE sobre el
-- esquema y las llamadas fallan con "permission denied for schema tests",
-- antes incluso de llegar a evaluar RLS.
GRANT USAGE ON SCHEMA tests TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA tests GRANT EXECUTE ON FUNCTIONS TO authenticated;
-- ALTER DEFAULT PRIVILEGES solo alcanza a funciones creadas DESPUÉS de esta
-- línea; este archivo se corre repetidas veces con CREATE OR REPLACE, que
-- no resetea privilegios de una función ya existente. El GRANT explícito de
-- abajo (al final del archivo) cubre las funciones que ya existían antes de
-- este cambio.

-- Datos de referencia mínimos: no hay seed de producción todavía
-- (docs/01-arquitectura-datos.md § 5 prevé supabase/seed/, sin escribir aún),
-- y varias tablas de fixture necesitan un currency_code válido por FK.
INSERT INTO public.currencies (code, name, symbol, decimals, kind, is_active)
VALUES
  ('ARS', 'Peso argentino', '$', 2, 'fiat', true),
  ('USD', 'Dólar estadounidense', 'US$', 2, 'fiat', true)
ON CONFLICT (code) DO NOTHING;

-- Crea un usuario real en auth.users + su profile, para que auth.uid()
-- tenga algo que devolver una vez autenticado. crypt/gen_salt vienen de
-- pgcrypto (20260801010000_extensions.sql).
CREATE OR REPLACE FUNCTION tests.create_user(p_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000', p_email,
    extensions.crypt('test-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    'authenticated', 'authenticated', now(), now()
  );

  -- El trigger `on_auth_user_created` (`20260801030000_auth_new_user_trigger.sql`,
  -- Bloque C, agregado DESPUÉS de escribirse este helper para GATE-1) ya
  -- inserta la fila de `profiles` apenas se crea el `auth.users` de arriba
  -- — sin el ON CONFLICT, este INSERT explícito choca con esa fila y
  -- ROMPE los 10 archivos de test de GATE-1 (encontrado corriendo F4 de
  -- la auditoría técnica: cualquier test que llame a `create_user`/
  -- `create_household`/`setup_household` fallaba con "duplicate key value
  -- violates ... profiles_pkey").
  INSERT INTO public.profiles (id, display_name)
  VALUES (v_user_id, p_email)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  RETURN v_user_id;
END;
$$;

-- Crea un household con un único miembro (role 'owner' salvo que se pase
-- otro) y devuelve (household_id, profile_id) como fila.
CREATE OR REPLACE FUNCTION tests.create_household(p_label text, p_role text DEFAULT 'owner')
RETURNS TABLE (household_id uuid, profile_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id uuid := gen_random_uuid();
  v_profile_id uuid;
BEGIN
  v_profile_id := tests.create_user(p_label || '@test.perze.local');

  INSERT INTO public.households (id, name, base_currency, created_by)
  VALUES (v_household_id, p_label, 'ARS', v_profile_id);

  INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
  VALUES (v_household_id, v_profile_id, p_role, 'active', now());

  RETURN QUERY SELECT v_household_id, v_profile_id;
END;
$$;

-- "Inicia sesión" como el profile dado: setea el claim que auth.uid() lee
-- y cambia al rol `authenticated`, el mismo con el que corre PostgREST. Sin
-- este cambio de rol las policies no se evalúan — el dueño de la conexión
-- (postgres/supabase_admin) no está sujeto a RLS salvo FORCE ROW LEVEL
-- SECURITY, que ninguna tabla de este esquema usa.
CREATE OR REPLACE FUNCTION tests.authenticate_as(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_profile_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END;
$$;

-- Vuelve al rol de la conexión de test (bypassea RLS) para armar fixtures
-- entre bloques de aserciones.
CREATE OR REPLACE FUNCTION tests.clear_authentication()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'RESET ROLE';
END;
$$;

-- Guarda un uuid en una variable de sesión de Postgres (GUC custom, sin
-- prefijo reservado), para pasar valores entre pasos de un mismo test sin
-- depender de `\gset` — ejecutar SQL vía `supabase db query -f` corre
-- contra la Management API, que no es una sesión psql real y no entiende
-- meta-comandos del cliente. set_config()/current_setting() sí son
-- server-side y funcionan con cualquier forma de ejecutar el archivo.
--
-- p_key NO puede tener puntos: un nombre de parámetro custom de Postgres es
-- exactamente "clase.parametro" (un solo punto). Todo lo que sigue usa
-- guion bajo dentro de p_key (ej. 'a_household_id'), nunca otro punto.
CREATE OR REPLACE FUNCTION tests.stash(p_key text, p_value uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('tests.' || p_key, p_value::text, false);
END;
$$;

CREATE OR REPLACE FUNCTION tests.get(p_key text)
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('tests.' || p_key, true), '')::uuid;
$$;

-- Crea un household (con create_household) y guarda household_id/profile_id
-- bajo el prefijo dado — ej. tests.setup_household('a', 'household-a')
-- deja disponibles tests.get('a_household_id') y tests.get('a_profile_id').
CREATE OR REPLACE FUNCTION tests.setup_household(p_prefix text, p_label text, p_role text DEFAULT 'owner')
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_household_id uuid;
  v_profile_id uuid;
BEGIN
  SELECT household_id, profile_id INTO v_household_id, v_profile_id
  FROM tests.create_household(p_label, p_role);
  PERFORM tests.stash(p_prefix || '_household_id', v_household_id);
  PERFORM tests.stash(p_prefix || '_profile_id', v_profile_id);
END;
$$;

-- Crea un usuario suelto (sin household propio, ej. segundo miembro de uno
-- existente) y lo guarda bajo <prefijo>_profile_id.
CREATE OR REPLACE FUNCTION tests.setup_user(p_prefix text, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  v_profile_id := tests.create_user(p_email);
  PERFORM tests.stash(p_prefix || '_profile_id', v_profile_id);
END;
$$;

-- Cubre las funciones creadas arriba en este mismo archivo, antes de que
-- existiera el ALTER DEFAULT PRIVILEGES del principio.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO authenticated;

-- tests.log() inserta en tap_log incluso corriendo como `authenticated`
-- (dentro del bloque autenticado de un test), así que la tabla y su
-- secuencia necesitan el mismo GRANT explícito que las funciones.
GRANT ALL ON tests.tap_log TO authenticated;
GRANT ALL ON SEQUENCE tests.tap_log_id_seq TO authenticated;
