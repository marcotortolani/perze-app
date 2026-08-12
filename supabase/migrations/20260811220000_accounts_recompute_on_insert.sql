-- Bug reportado: una cuenta creada con saldo inicial se muestra en 0 hasta
-- el primer movimiento. Causa: `recompute_account_balance` (definida en
-- `20260801010700_transactions.sql`, redefinida en
-- `20260808000000_investing_transactions.sql`) es la única fuente de verdad
-- del saldo, pero solo la dispara un trigger sobre `transactions`
-- (`transactions_recompute_balance`). Nunca hubo un trigger sobre el INSERT
-- de `accounts`, así que el servidor queda con `current_balance = 0`
-- (su DEFAULT) aunque `opening_balance` sea distinto de cero.
--
-- `sync-config.ts` (`toRow` de `accounts`) omite `current_balance` a
-- propósito porque "lo mantiene el trigger de Postgres" — ese comentario
-- daba por sentado un trigger que nunca se escribió. El pull de
-- `offline/pull.ts` trae el 0 del servidor y pisa el valor local correcto
-- (salvo que la cuenta tenga transacciones bloqueando el pull), así que el
-- usuario ve 0 hasta el primer movimiento. Y como el saldo mostrado ya
-- estaba mal, conciliar contra ese 0 genera un ajuste por el monto real, y
-- el servidor termina sumando `opening_balance + adjustment` = el doble.
--
-- Fix: la misma función que ya usan los triggers de `transactions`,
-- disparada también al insertar la cuenta (y al editar `opening_balance`,
-- por si alguna vez se habilita esa edición). `pg_trigger_depth() < 2`
-- es un cinturón contra recursión — no debería dispararse nunca porque
-- `recompute_account_balance` solo hace UPDATE de `current_balance`, no de
-- `opening_balance`, pero es gratis y documenta la intención.
CREATE OR REPLACE FUNCTION public.accounts_recompute_balance_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF pg_trigger_depth() < 2 THEN
    PERFORM public.recompute_account_balance(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER accounts_recompute_balance
  AFTER INSERT OR UPDATE OF opening_balance ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.accounts_recompute_balance_trigger();

-- Backfill idempotente: corrige las cuentas que ya existían en el remoto
-- antes de este trigger y quedaron con `current_balance` desalineado de
-- `opening_balance + Σ(transactions)`. `recompute_account_balance` es
-- exactamente el cálculo correcto, así que recorrer todas las cuentas y
-- volver a aplicarlo es seguro de repetir.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.accounts LOOP
    PERFORM public.recompute_account_balance(r.id);
  END LOOP;
END;
$$;
