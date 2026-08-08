-- move_accounts_to_household() / preflight_move_accounts() — PR 5 del plan
-- de multi-household. Escenario: A tiene su household personal con dos
-- cuentas relacionadas por una transferencia, una categoría/payee/tag
-- propios, y decide sumar las dos cuentas al household familiar F (creado
-- por otra persona, F en USD vs A en ARS) donde A es miembro 'member'.
BEGIN;
SELECT tests.reset_log();
SELECT tests.log(plan(24));

SELECT tests.clear_authentication();
SELECT tests.setup_household('a', 'mv-household-a'); -- base_currency ARS (default)
SELECT tests.setup_household('f', 'mv-household-f', 'owner'); -- F la crea otra persona

-- A se suma a F como member (el escenario real: aceptó una invitación).
INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
VALUES (tests.get('f_household_id'), tests.get('a_profile_id'), 'member', 'active', now());
UPDATE public.households SET base_currency = 'USD' WHERE id = tests.get('f_household_id');

-- Household ajeno (C), para probar el permiso.
SELECT tests.setup_household('c', 'mv-household-c');

-- Dos cuentas de A relacionadas por una transferencia.
SELECT tests.stash('a_acc1_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_acc1_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Efectivo', 'cash', 'ARS', tests.get('a_profile_id'));

SELECT tests.stash('a_acc2_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_acc2_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Banco', 'checking', 'ARS', tests.get('a_profile_id'));

-- Cuenta suelta, sin transferencias — para el caso de éxito simple y para
-- el bloqueo por broker.
SELECT tests.stash('a_acc3_id', gen_random_uuid());
INSERT INTO public.accounts (id, household_id, owner_id, name, kind, currency_code, created_by)
VALUES (tests.get('a_acc3_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'Broker', 'broker', 'USD', tests.get('a_profile_id'));

SELECT tests.stash('a_portfolio_id', gen_random_uuid());
INSERT INTO public.portfolios (id, household_id, name, base_currency, broker_account_id, created_by)
VALUES (tests.get('a_portfolio_id'), tests.get('a_household_id'), 'Cartera', 'USD', tests.get('a_acc3_id'), tests.get('a_profile_id'));

-- Categoría, payee y tag propios de A, usados en la transacción que se mueve.
SELECT tests.stash('a_cat_id', gen_random_uuid());
INSERT INTO public.categories (id, household_id, name, kind, is_system, created_by)
VALUES (tests.get('a_cat_id'), tests.get('a_household_id'), 'Supermercado', 'expense', false, tests.get('a_profile_id'));

SELECT tests.stash('a_payee_id', gen_random_uuid());
INSERT INTO public.payees (id, household_id, name) VALUES (tests.get('a_payee_id'), tests.get('a_household_id'), 'Disco');

SELECT tests.stash('a_tag_id', gen_random_uuid());
INSERT INTO public.tags (id, household_id, name) VALUES (tests.get('a_tag_id'), tests.get('a_household_id'), 'compras');

-- F YA tiene una categoría con el mismo nombre — tiene que MATCHEAR, no clonar de nuevo.
SELECT tests.stash('f_cat_id', gen_random_uuid());
INSERT INTO public.categories (id, household_id, name, kind, is_system, created_by)
VALUES (tests.get('f_cat_id'), tests.get('f_household_id'), 'Supermercado', 'expense', false, tests.get('f_profile_id'));

-- Movimiento de gasto en acc1: categoría + payee + tag, ya resuelto en ARS (fx identity).
SELECT tests.stash('a_tx_expense_id', gen_random_uuid());
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code, category_id, payee_id, fx_rate, fx_source, amount_base)
VALUES (tests.get('a_tx_expense_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', now(), tests.get('a_acc1_id'), 50000, 'ARS', tests.get('a_cat_id'), tests.get('a_payee_id'), 1, 'identity', 50000);

INSERT INTO public.transaction_tags (transaction_id, tag_id) VALUES (tests.get('a_tx_expense_id'), tests.get('a_tag_id'));

-- Transferencia acc1 -> acc2.
SELECT tests.stash('a_tx_transfer_id', gen_random_uuid());
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, counter_account_id, amount, currency_code, fx_rate, fx_source, amount_base)
VALUES (tests.get('a_tx_transfer_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'transfer', now(), tests.get('a_acc1_id'), tests.get('a_acc2_id'), 20000, 'ARS', 1, 'identity', 20000);

-- Movimiento en acc3 (broker) para probar el rechazo.
SELECT tests.stash('a_tx_broker_id', gen_random_uuid());
INSERT INTO public.transactions (id, household_id, created_by, kind, occurred_at, account_id, amount, currency_code)
VALUES (tests.get('a_tx_broker_id'), tests.get('a_household_id'), tests.get('a_profile_id'), 'expense', now(), tests.get('a_acc3_id'), 1000, 'USD');

SELECT tests.authenticate_as(tests.get('a_profile_id'));

-- Permiso: C no puede mover cuentas de A.
SELECT tests.log(throws_ok(
  format($$SELECT public.preflight_move_accounts(ARRAY[%L]::uuid[], %L)$$, tests.get('a_acc1_id'), tests.get('c_household_id')),
  'No podés escribir en el household destino',
  'A no puede mover sus cuentas a un household del que no es miembro'
));

-- Broker: rechazado.
SELECT tests.log(throws_ok(
  format($$SELECT public.preflight_move_accounts(ARRAY[%L]::uuid[], %L)$$, tests.get('a_acc3_id'), tests.get('f_household_id')),
  'No se pueden mover cuentas de inversión ni las que financian trades',
  'no se puede mover una cuenta de broker'
));

-- Transferencia sin cerrar: mover solo acc1 sin acc2, rechazado.
SELECT tests.log(throws_ok(
  format($$SELECT public.preflight_move_accounts(ARRAY[%L]::uuid[], %L)$$, tests.get('a_acc1_id'), tests.get('f_household_id')),
  'Hay transferencias con Banco — sumalas juntas',
  'no se puede mover una cuenta sin su contraparte de transferencia'
));

-- Camino feliz: acc1 + acc2 juntas.
SELECT public.move_accounts_to_household(ARRAY[tests.get('a_acc1_id'), tests.get('a_acc2_id')]::uuid[], tests.get('f_household_id'));

SELECT tests.log(is(
  (SELECT household_id FROM public.accounts WHERE id = tests.get('a_acc1_id')),
  tests.get('f_household_id'),
  'acc1 queda en el household familiar'
));
SELECT tests.log(is(
  (SELECT household_id FROM public.accounts WHERE id = tests.get('a_acc2_id')),
  tests.get('f_household_id'),
  'acc2 (la contraparte de la transferencia) también se movió'
));
SELECT tests.log(is(
  (SELECT visibility FROM public.accounts WHERE id = tests.get('a_acc1_id')),
  'household',
  'la cuenta movida queda visibility=household (sumarla al grupo es el consentimiento)'
));
SELECT tests.log(is(
  (SELECT household_id FROM public.transactions WHERE id = tests.get('a_tx_expense_id')),
  tests.get('f_household_id'),
  'el movimiento de gasto se mueve con la cuenta'
));
SELECT tests.log(is(
  (SELECT household_id FROM public.transactions WHERE id = tests.get('a_tx_transfer_id')),
  tests.get('f_household_id'),
  'la transferencia se mueve completa'
));
SELECT tests.log(is(
  (SELECT category_id FROM public.transactions WHERE id = tests.get('a_tx_expense_id')),
  tests.get('f_cat_id'),
  'category_id se remapea a la categoría YA existente en F (mismo nombre) — no clona una segunda'
));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.categories WHERE household_id = tests.get('f_household_id') AND name = 'Supermercado'),
  1,
  'sigue habiendo una sola categoría "Supermercado" en F'
));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.payees WHERE household_id = tests.get('f_household_id') AND name = 'Disco'),
  1,
  'el payee "Disco" se clona en F (no existía)'
));
SELECT tests.log(isnt(
  (SELECT payee_id FROM public.transactions WHERE id = tests.get('a_tx_expense_id')),
  tests.get('a_payee_id'),
  'payee_id de la transacción apunta al CLON en F, no al original de A'
));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.tags WHERE household_id = tests.get('f_household_id') AND name = 'compras'),
  1,
  'el tag "compras" se clona en F'
));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.transaction_tags tt JOIN public.tags t ON t.id = tt.tag_id
   WHERE tt.transaction_id = tests.get('a_tx_expense_id') AND t.household_id = tests.get('f_household_id')),
  1,
  'transaction_tags remapeado al tag clonado, no al original'
));

-- FX: A está en ARS, F en USD — el gasto en ARS (ya resuelto) tiene que
-- descartarse a pending, NUNCA recalcularse con un rate inventado.
SELECT tests.log(is((SELECT fx_rate FROM public.transactions WHERE id = tests.get('a_tx_expense_id')), NULL::numeric, 'el gasto en ARS se descarta a pending al cruzar a un household en USD'));
SELECT tests.log(is((SELECT fx_source FROM public.transactions WHERE id = tests.get('a_tx_expense_id')), 'pending', 'fx_source pasa a pending'));
SELECT tests.log(is((SELECT amount_base FROM public.transactions WHERE id = tests.get('a_tx_expense_id')), NULL::bigint, 'amount_base vuelve a NULL'));

-- El household de origen (A) queda intacto salvo lo movido explícitamente.
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE household_id = tests.get('a_household_id') AND deleted_at IS NULL),
  1,
  'a A le queda solo la cuenta de broker — acc1/acc2 se fueron, acc3 nunca se movió'
));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.categories WHERE id = tests.get('a_cat_id')),
  1,
  'la categoría ORIGINAL de A sigue existiendo — nunca se mueve, solo se clona o matchea'
));

-- visibility_grants de las cuentas movidas se limpian (quedarían
-- inválidos: su household_id ya no es el de la cuenta).
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.visibility_grants WHERE subject_type = 'account' AND subject_id = ANY(ARRAY[tests.get('a_acc1_id'), tests.get('a_acc2_id')])),
  0,
  'no quedan visibility_grants apuntando a las cuentas movidas'
));

-- audit_log: una fila en cada household.
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.audit_log WHERE household_id = tests.get('a_household_id') AND action = 'accounts_moved_out'),
  1,
  'audit_log en el household de origen'
));
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.audit_log WHERE household_id = tests.get('f_household_id') AND action = 'accounts_moved_in'),
  1,
  'audit_log en el household destino'
));

-- Cross-household: nada de esto tocó al household C.
SELECT tests.log(is(
  (SELECT count(*)::int FROM public.accounts WHERE household_id = tests.get('c_household_id')),
  0,
  'el household C, ajeno a todo esto, sigue sin cuentas'
));

-- El trigger de inmutabilidad sigue protegiendo household_id fuera de este
-- camino: un UPDATE directo, sin pasar por move_accounts_to_household,
-- sigue rechazado.
SELECT tests.log(throws_ok(
  format($$UPDATE public.accounts SET household_id = %L WHERE id = %L$$, tests.get('c_household_id'), tests.get('a_acc1_id')),
  'La columna household_id es inmutable en accounts',
  'un UPDATE directo (fuera de la RPC) sigue sin poder mover una cuenta'
));

INSERT INTO tests.tap_log (line) SELECT * FROM finish();
SELECT line FROM tests.tap_log ORDER BY id;
ROLLBACK;
