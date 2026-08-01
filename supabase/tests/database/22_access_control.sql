-- Acceso controlado (20260801180000_access_control.sql): un no-operador no
-- puede auto-aprobarse ni auto-ascenderse, las tres RPC del operador
-- rechazan a cualquiera que no sea `is_app_admin`, y el operador aprueba/
-- rechaza correctamente a otro perfil.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(9));

SELECT tests.clear_authentication();
SELECT tests.setup_user('op', 'access-operator@test.perze.local');
SELECT tests.setup_user('u', 'access-user@test.perze.local');

-- op es el operador de la instancia — se asigna directo, como lo haría el
-- bootstrap de la migración (bypassea el trigger con el mismo GUC).
SELECT set_config('perze.access_admin_write', 'true', true);
UPDATE public.profiles SET is_app_admin = true, access_status = 'approved' WHERE id = tests.get('op_profile_id');
SELECT set_config('perze.access_admin_write', 'false', true);

SELECT tests.authenticate_as(tests.get('u_profile_id'));

SELECT tests.log(is(
  (SELECT access_status FROM public.profiles WHERE id = tests.get('u_profile_id')),
  'pending',
  'todo perfil nuevo nace pending'
));

SELECT tests.log(throws_ok(
  format($$UPDATE public.profiles SET access_status = 'approved' WHERE id = %L$$, tests.get('u_profile_id')),
  'Solo el operador de la instancia puede cambiar el estado de acceso',
  'un usuario no puede auto-aprobarse con un UPDATE directo'
));

SELECT tests.log(throws_ok(
  format($$UPDATE public.profiles SET is_app_admin = true WHERE id = %L$$, tests.get('u_profile_id')),
  'Solo el operador de la instancia puede cambiar el estado de acceso',
  'un usuario no puede auto-ascenderse a operador con un UPDATE directo'
));

-- display_name (columna no protegida) sigue editable — el trigger es
-- específico de las columnas de acceso, no un bloqueo general del self-update.
UPDATE public.profiles SET display_name = 'Nuevo nombre' WHERE id = tests.get('u_profile_id');
SELECT tests.log(is(
  (SELECT display_name FROM public.profiles WHERE id = tests.get('u_profile_id')),
  'Nuevo nombre',
  'el resto de la propia fila sigue siendo editable'
));

SELECT tests.log(throws_ok(
  $$SELECT public.admin_metrics()$$,
  'Solo el operador de la instancia puede ver esto',
  'un no-operador no puede llamar admin_metrics()'
));

SELECT tests.log(throws_ok(
  $$SELECT public.admin_list_access_requests()$$,
  'Solo el operador de la instancia puede ver esto',
  'un no-operador no puede llamar admin_list_access_requests()'
));

SELECT tests.log(throws_ok(
  format($$SELECT public.admin_set_access_status(%L, 'approved')$$, tests.get('u_profile_id')),
  'Solo el operador de la instancia puede aprobar o rechazar accesos',
  'un no-operador no puede aprobar ni su propio acceso'
));

-- El operador aprueba a u.
SELECT tests.authenticate_as(tests.get('op_profile_id'));
SELECT public.admin_set_access_status(tests.get('u_profile_id'), 'approved');

-- `profiles_select` es self-only: op no puede leer la fila de u por SELECT
-- directo (a propósito — el panel del operador lee por las RPC de arriba,
-- nunca por acceso ancho a `profiles`). Se verifica el efecto de la RPC
-- con `clear_authentication()`, no porque haga falta una policy nueva.
SELECT tests.clear_authentication();
SELECT tests.log(is(
  (SELECT access_status FROM public.profiles WHERE id = tests.get('u_profile_id')),
  'approved',
  'el operador aprueba a u correctamente'
));
SELECT tests.authenticate_as(tests.get('op_profile_id'));

SELECT tests.log(throws_ok(
  format($$SELECT public.admin_set_access_status(%L, 'approved')$$, tests.get('op_profile_id')),
  'El operador no puede cambiar su propio estado de acceso',
  'el operador no puede aplicarse la RPC a sí mismo'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
