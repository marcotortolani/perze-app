-- 01-arquitectura-datos.md § 2.5. El corazón del schema.
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY, -- generado en el cliente (UUIDv7)
  household_id uuid NOT NULL REFERENCES public.households (id),
  created_by uuid NOT NULL REFERENCES public.profiles (id),

  kind text NOT NULL CHECK (kind IN ('expense', 'income', 'transfer', 'adjustment')),
  occurred_at timestamptz NOT NULL,

  account_id uuid NOT NULL REFERENCES public.accounts (id),
  counter_account_id uuid REFERENCES public.accounts (id), -- solo transfer

  -- SON DOS CONVERSIONES, NO UNA. Esta es la capa que mueve el saldo.
  -- amount y currency_code están SIEMPRE en la moneda de la cuenta: por
  -- eso current_balance nunca necesita FX y un movimiento sin cotización
  -- no lo afecta.
  amount bigint NOT NULL, -- unidades mínimas, en moneda de la cuenta
  currency_code text NOT NULL REFERENCES public.currencies (code), -- = accounts.currency_code, siempre
  CONSTRAINT amount_sign CHECK (kind = 'adjustment' OR amount > 0),

  -- Lo que el usuario gastó de verdad, cuando difiere de la moneda de la
  -- cuenta (ej. pagás USD con tarjeta en pesos: sale de la cuenta en
  -- pesos al cambio del banco -amount-, y esto guarda el dato original).
  original_amount bigint,
  original_currency text REFERENCES public.currencies (code),
  original_rate numeric(24, 12), -- original_currency → currency_code
  CONSTRAINT original_triple CHECK (
    (original_amount IS NULL) = (original_currency IS NULL)
    AND (original_amount IS NULL) = (original_rate IS NULL)
  ),

  -- Segunda conversión: moneda de la cuenta → moneda base del household.
  -- ACÁ vive needs_fx, y solo acá. NULLABLE a propósito. Nunca se cae a 1.
  fx_rate numeric(24, 12),
  fx_source text NOT NULL DEFAULT 'identity' CHECK (
    fx_source IN ('identity', 'api', 'manual', 'inherited', 'pending')
  ),
  fx_provider text,
  fx_quote_kind text,
  fx_resolved_at timestamptz,
  amount_base bigint,
  -- invariante: o están los dos, o no está ninguno
  CONSTRAINT fx_pair CHECK ((fx_rate IS NULL) = (amount_base IS NULL)),

  -- lado destino de una transferencia entre monedas distintas
  counter_amount bigint,
  counter_currency_code text REFERENCES public.currencies (code),
  counter_fx_rate numeric(24, 12),

  category_id uuid REFERENCES public.categories (id),
  payee_id uuid REFERENCES public.payees (id),
  note text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{path, mime, size, thumb}]
  location jsonb, -- {lat, lng, label}

  status text NOT NULL DEFAULT 'cleared' CHECK (status IN ('cleared', 'pending', 'scheduled', 'void')),
  visibility text NOT NULL DEFAULT 'household' CHECK (visibility IN ('private', 'household')),

  recurring_id uuid,
  installment_group_id uuid,
  installment_number int,
  installment_total int,

  -- Lo que NUNCA llegó al servidor vive solo en el outbox de Dexie y no
  -- tiene fila acá. Esta columna es para lo que llegó y salió mal: D2
  -- filtra por ella y L3 escala a warning a los 7 días.
  sync_state text NOT NULL DEFAULT 'ok' CHECK (sync_state IN ('ok', 'rejected', 'conflict')),
  sync_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  client_rev int NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'voice', 'import', 'recurring', 'rule'))
);

CREATE INDEX transactions_household_occurred_idx ON public.transactions (household_id, occurred_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX transactions_account_occurred_idx ON public.transactions (account_id, occurred_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX transactions_household_category_occurred_idx
ON public.transactions (household_id, category_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX transactions_household_payee_occurred_idx
ON public.transactions (household_id, payee_id, occurred_at DESC) WHERE deleted_at IS NULL; -- H9, B8, K6
-- 'simple' y no 'spanish': la app es multi-idioma y un stemmer español rompe
-- la búsqueda de notas en inglés o portugués. Para acentos, unaccent en la query.
CREATE INDEX transactions_note_search_idx ON public.transactions
USING gin (to_tsvector('simple', coalesce(note, '')));
-- los movimientos que esperan tipo de cambio: pocos, consultados seguido
CREATE INDEX transactions_needs_fx_idx ON public.transactions (household_id, occurred_at)
WHERE fx_rate IS NULL AND deleted_at IS NULL;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tx_select ON public.transactions FOR SELECT USING (
  deleted_at IS NULL
  AND household_id IN (SELECT public.current_households())
  AND (visibility = 'household' OR created_by = (SELECT auth.uid()))
  -- una cuenta privada oculta sus transacciones aunque la transacción sea household
  AND EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = transactions.account_id
      AND public.can_see('account', a.id, a.visibility, a.owner_id)
  )
);

CREATE POLICY tx_insert ON public.transactions FOR INSERT WITH CHECK (
  public.can_write(household_id) AND created_by = (SELECT auth.uid())
);

-- USING filtra qué filas se pueden tocar; WITH CHECK valida la fila
-- RESULTANTE. Sin WITH CHECK, un miembro puede mover una fila a otro
-- household o reescribir created_by. Sin excepción.
CREATE POLICY tx_update ON public.transactions FOR UPDATE
USING (
  household_id IN (SELECT public.current_households())
  AND public.can_write(household_id)
  AND (created_by = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.household_members m
    WHERE m.household_id = transactions.household_id
      AND m.profile_id = (SELECT auth.uid()) AND m.role IN ('owner', 'admin')))
)
WITH CHECK (
  household_id = (SELECT transactions.household_id) -- inmutable; ver nota en accounts_update de 20260801010500
  AND created_by = (SELECT transactions.created_by) -- created_by es inmutable
);
-- DELETE no se expone: el borrado es un UPDATE que setea deleted_at.

CREATE TABLE public.transaction_tags (
  transaction_id uuid NOT NULL REFERENCES public.transactions (id),
  tag_id uuid NOT NULL REFERENCES public.tags (id),
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE INDEX transaction_tags_transaction_idx ON public.transaction_tags (transaction_id);

ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

-- Join tag↔transacción, sin significado financiero propio — a diferencia
-- de splits/shares, un DELETE real acá (sacar un tag) no pierde ningún
-- hecho contable, así que sí se expone.
CREATE POLICY transaction_tags_all ON public.transaction_tags FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_tags.transaction_id
      AND t.household_id IN (SELECT public.current_households())
      AND t.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_tags.transaction_id
      AND public.can_write(t.household_id)
  )
);

-- CON-24 (docs/plan-de-trabajo.md § 4, V8): transaction_splits y
-- transaction_shares SÍ llevan significado financiero (reparto de un gasto,
-- deuda entre miembros), así que siguen la misma regla que transactions:
-- "DELETE nunca se expone". Se agrega deleted_at y la policy se separa en
-- SELECT/INSERT/UPDATE, sin FOR ALL y sin DELETE — a diferencia de la forma
-- `splits_all FOR ALL` que traía el documento original.
CREATE TABLE public.transaction_splits ( -- un gasto repartido entre varias categorías
  id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.transactions (id),
  category_id uuid REFERENCES public.categories (id),
  amount bigint NOT NULL,
  amount_base bigint,
  note text,
  deleted_at timestamptz -- CON-24: agregado para permitir soft-delete en vez de DELETE real
);

CREATE INDEX transaction_splits_transaction_idx ON public.transaction_splits (transaction_id);

CREATE TABLE public.transaction_shares ( -- reparto entre miembros del household
  id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.transactions (id),
  member_id uuid NOT NULL REFERENCES public.profiles (id),
  share_amount bigint NOT NULL,
  share_amount_base bigint,
  share_pct numeric(6, 3), -- J5 muestra "62 y 38"
  split_mode text CHECK (split_mode IN ('equal', 'income_pro_rata', 'exact', 'percent')),
  settled_at timestamptz,
  settlement_id uuid, -- FK a settlements se agrega en 20260801011100_system.sql (todavía no existe)
  deleted_at timestamptz -- CON-24: mismo motivo que transaction_splits
);

CREATE INDEX transaction_shares_transaction_idx ON public.transaction_shares (transaction_id);
CREATE INDEX transaction_shares_member_settled_idx ON public.transaction_shares (member_id, settled_at); -- J7

-- El trigger que hereda el estado de needs_fx: los hijos de una transacción
-- no pueden tener conversión si el padre no la tiene. Dos funciones (no una
-- genérica) porque splits y shares nombran distinto la columna de destino.
CREATE FUNCTION public.inherit_fx_state_splits()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE parent_has_fx boolean;
BEGIN
  SELECT t.fx_rate IS NOT NULL INTO parent_has_fx
  FROM public.transactions t WHERE t.id = NEW.transaction_id;

  IF NOT parent_has_fx THEN
    NEW.amount_base := NULL;
  ELSIF NEW.amount_base IS NULL THEN
    RAISE EXCEPTION 'el padre tiene fx_rate: el split necesita amount_base';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.inherit_fx_state_shares()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE parent_has_fx boolean;
BEGIN
  SELECT t.fx_rate IS NOT NULL INTO parent_has_fx
  FROM public.transactions t WHERE t.id = NEW.transaction_id;

  IF NOT parent_has_fx THEN
    NEW.share_amount_base := NULL;
  ELSIF NEW.share_amount_base IS NULL THEN
    RAISE EXCEPTION 'el padre tiene fx_rate: el share necesita share_amount_base';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER transaction_splits_inherit_fx
BEFORE INSERT OR UPDATE ON public.transaction_splits
FOR EACH ROW EXECUTE FUNCTION public.inherit_fx_state_splits();

CREATE TRIGGER transaction_shares_inherit_fx
BEFORE INSERT OR UPDATE ON public.transaction_shares
FOR EACH ROW EXECUTE FUNCTION public.inherit_fx_state_shares();

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY transaction_splits_select ON public.transaction_splits FOR SELECT
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id
      AND t.household_id IN (SELECT public.current_households())
      AND t.deleted_at IS NULL
  )
);

CREATE POLICY transaction_splits_insert ON public.transaction_splits FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id AND public.can_write(t.household_id)
  )
);

CREATE POLICY transaction_splits_update ON public.transaction_splits FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id AND public.can_write(t.household_id)
  )
)
WITH CHECK (
  transaction_id = (SELECT transaction_splits.transaction_id) -- inmutable, ver nota en accounts_update
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id AND public.can_write(t.household_id)
  )
);

ALTER TABLE public.transaction_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY transaction_shares_select ON public.transaction_shares FOR SELECT
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_shares.transaction_id
      AND t.household_id IN (SELECT public.current_households())
      AND t.deleted_at IS NULL
  )
);

CREATE POLICY transaction_shares_insert ON public.transaction_shares FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_shares.transaction_id AND public.can_write(t.household_id)
  )
);

CREATE POLICY transaction_shares_update ON public.transaction_shares FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_shares.transaction_id AND public.can_write(t.household_id)
  )
)
WITH CHECK (
  transaction_id = (SELECT transaction_shares.transaction_id) -- inmutable, ver nota en accounts_update
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_shares.transaction_id AND public.can_write(t.household_id)
  )
);

-- Mantiene accounts.current_balance. Recompute completo (no incremental) por
-- simplicidad y para no arriesgar drift — es una fuente de bugs de plata
-- mucho más común que el costo de recalcular. Si el volumen de movimientos
-- por cuenta lo justifica, se puede optimizar a incremental más adelante.
--
-- Supuesto que puede estar mal (marcado como tal, ver docs/plan-de-trabajo.md
-- § 9): status 'cleared' y 'pending' cuentan para el saldo, 'scheduled' y
-- 'void' no. El documento fuente no especifica esta regla explícitamente.
CREATE FUNCTION public.recompute_account_balance(p_account_id uuid)
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

CREATE FUNCTION public.transactions_recompute_balance_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_account_balance(OLD.account_id);
    IF OLD.counter_account_id IS NOT NULL THEN
      PERFORM public.recompute_account_balance(OLD.counter_account_id);
    END IF;
    RETURN OLD;
  END IF;

  PERFORM public.recompute_account_balance(NEW.account_id);
  IF NEW.counter_account_id IS NOT NULL THEN
    PERFORM public.recompute_account_balance(NEW.counter_account_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.account_id IS DISTINCT FROM NEW.account_id THEN
    PERFORM public.recompute_account_balance(OLD.account_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.counter_account_id IS DISTINCT FROM NEW.counter_account_id
     AND OLD.counter_account_id IS NOT NULL THEN
    PERFORM public.recompute_account_balance(OLD.counter_account_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_recompute_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.transactions_recompute_balance_trigger();
