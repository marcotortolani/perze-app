-- F2 — saneo de saldos duplicados por el bug de saldo inicial en 0.
--
-- Causa: `accounts` nunca tuvo un trigger que corriera
-- `recompute_account_balance` al insertar la cuenta (fix en
-- `20260811090000_accounts_recompute_on_insert.sql`), así que toda cuenta
-- creada con saldo inicial quedaba en 0 en el servidor hasta el primer
-- movimiento. Si en el medio se conciliaba esa cuenta, la app calculaba la
-- diferencia contra ese 0 y creaba un ajuste por el monto real completo —
-- el servidor terminó con `opening_balance + adjustment` = el doble del
-- saldo real.
--
-- IMPORTANTE: correr esto DESPUÉS de aplicar
-- `20260811090000_accounts_recompute_on_insert.sql` (que ya trae su propio
-- backfill de `current_balance`), nunca antes. Apenas se aplique esa
-- migración, las cuentas afectadas van a mostrar el saldo correcto
-- recalculado — lo que este script identifica es el `adjustment` de más
-- que quedó como movimiento real y hay que borrar.
--
-- Ejecutar con service_role (nunca desde el cliente/anon key), vía
-- `supabase db execute` o el SQL Editor del dashboard. Es SOLO
-- DIAGNÓSTICO: no borra nada. La eliminación se hace desde la app (abrir
-- el movimiento de conciliación sospechoso y borrarlo con el flujo normal
-- de "deshacer"/borrar), nunca con un DELETE/UPDATE directo acá — un
-- DELETE directo no propaga al outbox de Dexie de los dispositivos que ya
-- sincronizaron esa fila y los deja divergidos para siempre.

-- ============================================================
-- 1. Candidatos: ajustes cuyo monto coincide con el opening_balance de su
--    cuenta. No es prueba definitiva (una conciliación real podría dar la
--    misma casualidad), pero es la firma exacta del bug — revisar fecha de
--    creación de la cuenta vs. fecha del ajuste antes de tocar nada.
-- ============================================================

SELECT
  t.id AS transaction_id,
  t.account_id,
  a.name AS account_name,
  a.opening_balance,
  a.opening_date,
  t.amount AS adjustment_amount,
  t.occurred_at AS adjustment_date,
  t.created_at AS adjustment_created_at,
  a.current_balance
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.kind = 'adjustment'
  AND t.deleted_at IS NULL
  AND a.opening_balance <> 0
  AND t.amount = a.opening_balance
ORDER BY t.created_at;

-- ============================================================
-- 2. Contexto por cuenta: cuántos ajustes tiene cada una y el total
--    acumulado, para distinguir "un solo ajuste que duplica" de una
--    cuenta con conciliaciones legítimas recurrentes.
-- ============================================================

SELECT
  a.id AS account_id,
  a.name,
  a.opening_balance,
  count(*) FILTER (WHERE t.kind = 'adjustment' AND t.deleted_at IS NULL) AS adjustment_count,
  coalesce(sum(t.amount) FILTER (WHERE t.kind = 'adjustment' AND t.deleted_at IS NULL), 0) AS adjustment_total,
  a.current_balance
FROM public.accounts a
LEFT JOIN public.transactions t ON t.account_id = a.id
WHERE a.opening_balance <> 0
GROUP BY a.id, a.name, a.opening_balance, a.current_balance
HAVING count(*) FILTER (WHERE t.kind = 'adjustment' AND t.deleted_at IS NULL) > 0
ORDER BY a.name;
