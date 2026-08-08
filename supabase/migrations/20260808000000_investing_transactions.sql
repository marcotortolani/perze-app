-- Bloque I — comprar/vender un instrumento no generaba ningún movimiento
-- real: `trades.settlement_account_id` era puramente informativo, nunca
-- tocaba `accounts.current_balance` ni aparecía en `transactions`. El
-- usuario lo reportó: vendía/compraba y la cuenta de liquidación seguía
-- mostrando el saldo de antes.
--
-- Se resuelve con un quinto `kind`, no con una categoría: `categories.kind`
-- solo admite 'expense'/'income' (`docs/01-arquitectura-datos.md` § 2.4),
-- así que una "categoría Investing" contaminaría presupuestos y "gasto por
-- categoría" con compras de activos, que no son consumo. `transfer` y
-- `adjustment` YA se excluyen de esos agregados (`period-summary.ts`,
-- `budget-progress.ts`) — 'investing' se suma a esa misma lista.
--
-- Signo: igual que 'adjustment' (`amount_sign` ya lo permite negativo),
-- el signo viaja en el propio `amount` — negativo para compra, positivo
-- para venta — en vez de inferirlo con un join a `trades` en cada cálculo
-- de saldo.

ALTER TABLE public.transactions DROP CONSTRAINT transactions_kind_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_kind_check
  CHECK (kind = ANY (ARRAY['expense', 'income', 'transfer', 'adjustment', 'investing']));

ALTER TABLE public.transactions DROP CONSTRAINT amount_sign;
ALTER TABLE public.transactions ADD CONSTRAINT amount_sign
  CHECK (kind = ANY (ARRAY['adjustment', 'investing']) OR amount > 0);

-- Traza qué trade originó esta fila — para poder borrarla/reconciliarla
-- junto con su trade, y para que un trade nunca se pueda re-facturar dos
-- veces por error. NULL para el 99% de las transacciones (todo lo que no
-- viene de Inversiones).
ALTER TABLE public.transactions ADD COLUMN trade_id uuid REFERENCES public.trades (id);
CREATE INDEX transactions_trade_idx ON public.transactions (trade_id) WHERE trade_id IS NOT NULL;

-- `recompute_account_balance` (`20260801010700_transactions.sql`) es la
-- ÚNICA fuente de verdad del saldo — el cálculo optimista de Dexie
-- (`balance-effects.ts`) es solo para no esperar el round-trip, pero el
-- servidor manda apenas sincroniza. Sin este `WHEN`, una compra/venta se
-- vería bien un instante en el cliente y se revertiría sola al sincronizar.
CREATE OR REPLACE FUNCTION public.recompute_account_balance(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_opening bigint;
  v_delta bigint;
BEGIN
  SELECT opening_balance INTO v_opening FROM public.accounts WHERE id = p_account_id;

  SELECT COALESCE(SUM(
    CASE
      WHEN t.deleted_at IS NOT NULL OR t.status IN ('void', 'scheduled') THEN 0
      WHEN t.kind = 'expense' THEN -t.amount
      WHEN t.kind = 'income' THEN t.amount
      WHEN t.kind = 'adjustment' THEN t.amount
      WHEN t.kind = 'investing' THEN t.amount -- signo ya incluido, ver comentario de arriba
      WHEN t.kind = 'transfer' AND t.account_id = p_account_id THEN -t.amount
      WHEN t.kind = 'transfer' AND t.counter_account_id = p_account_id THEN COALESCE(t.counter_amount, t.amount)
      ELSE 0
    END
  ), 0) INTO v_delta
  FROM public.transactions t
  WHERE t.account_id = p_account_id OR t.counter_account_id = p_account_id;

  UPDATE public.accounts SET current_balance = v_opening + v_delta WHERE id = p_account_id;
END;
$$;
