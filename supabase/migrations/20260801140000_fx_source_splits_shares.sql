-- A6 (auditoría técnica) — `docs/01-arquitectura-datos.md` § 7 declara
-- `transaction_splits`/`transaction_shares` resueltos para `needs_fx`, pero
-- solo tienen `amount_base`/`share_amount_base`: sin `fx_source` no hay
-- forma de distinguir "pending" de "identity" (ambos con amount_base NULL
-- momentáneamente en un split recién creado) ni de mostrar el mismo badge
-- que `transactions`/`trades`/`settlements` ya muestran.
--
-- Además: los triggers `inherit_fx_state_*` (BEFORE INSERT/UPDATE en las
-- hijas) solo miran el estado del padre EN ESE MOMENTO — si el padre
-- resuelve su `pending` DESPUÉS de que el hijo ya existe (el camino normal
-- de `resolvePendingFx`), nada dispara sobre las hijas y quedan en NULL
-- para siempre. Se agrega un trigger `AFTER UPDATE ON transactions` que
-- propaga hacia abajo cuando el padre cambia de estado de FX.

ALTER TABLE public.transaction_splits
  ADD COLUMN fx_source text NOT NULL DEFAULT 'pending' CHECK (
    fx_source IN ('identity', 'api', 'manual', 'inherited', 'pending')
  ),
  ADD CONSTRAINT transaction_splits_fx_pair CHECK ((fx_source = 'pending') = (amount_base IS NULL));

ALTER TABLE public.transaction_shares
  ADD COLUMN fx_source text NOT NULL DEFAULT 'pending' CHECK (
    fx_source IN ('identity', 'api', 'manual', 'inherited', 'pending')
  ),
  ADD CONSTRAINT transaction_shares_fx_pair CHECK ((fx_source = 'pending') = (share_amount_base IS NULL));

-- Los triggers existentes solo ajustaban amount_base/share_amount_base —
-- ahora también copian fx_source del padre, así el hijo refleja el mismo
-- estado (identity/api/manual/inherited/pending), no solo NULL-o-no.
CREATE OR REPLACE FUNCTION public.inherit_fx_state_splits()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parent_fx_rate bigint;
  v_parent_fx_source text;
BEGIN
  SELECT t.fx_rate, t.fx_source INTO v_parent_fx_rate, v_parent_fx_source
  FROM public.transactions t WHERE t.id = NEW.transaction_id;

  IF v_parent_fx_rate IS NULL THEN
    NEW.amount_base := NULL;
    NEW.fx_source := 'pending';
  ELSE
    IF NEW.amount_base IS NULL THEN
      RAISE EXCEPTION 'el padre tiene fx_rate: el split necesita amount_base';
    END IF;
    NEW.fx_source := v_parent_fx_source;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.inherit_fx_state_shares()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parent_fx_rate bigint;
  v_parent_fx_source text;
BEGIN
  SELECT t.fx_rate, t.fx_source INTO v_parent_fx_rate, v_parent_fx_source
  FROM public.transactions t WHERE t.id = NEW.transaction_id;

  IF v_parent_fx_rate IS NULL THEN
    NEW.share_amount_base := NULL;
    NEW.fx_source := 'pending';
  ELSE
    IF NEW.share_amount_base IS NULL THEN
      RAISE EXCEPTION 'el padre tiene fx_rate: el share necesita share_amount_base';
    END IF;
    NEW.fx_source := v_parent_fx_source;
  END IF;
  RETURN NEW;
END;
$$;

-- Propagación hacia abajo: cuando `transactions.fx_rate` cambia (típico:
-- pending -> resuelto, vía `resolvePendingFx`), recalcula amount_base y
-- fx_source de los hijos vivos a partir del NUEVO rate del padre. No
-- recalcula si el hijo YA tenía su propio amount_base resuelto con un
-- rate distinto — eso violaría el congelamiento (CLAUDE.md § "el rate se
-- congela"); solo actúa sobre hijos que siguen en `pending`.
-- `fx_rate` acá ya es el decimal plano (`numeric(24,12)`, ver A1 —
-- `formatRate()`/`parseRate()` en el cliente son solo la representación
-- bigint escalada de ESTE mismo valor, no una unidad distinta), así que
-- `amount * fx_rate` es la conversión directa sin dividir por 10^12 de
-- nuevo — dividir acá sería reintroducir el bug de A1 del lado servidor.
-- Falta ajustar por la diferencia de decimales entre la moneda de la
-- cuenta (`transactions.currency_code`) y la moneda base del household,
-- igual que hace `convert()` del lado cliente (`lib/fx/rate.ts`).
--
-- Nota de alcance: `round()` de Postgres redondea half-away-from-zero, no
-- half-to-even como `roundHalfEven()` del cliente — para los montos
-- reales del dominio (centavos) la diferencia solo puede aparecer en un
-- empate exacto en la última posición decimal, un caso de borde raro. El
-- camino primario de escritura (`transactionsRepo.create/update`) sigue
-- siendo el cliente con `roundHalfEven`; este trigger es la reconciliación
-- de un padre que resuelve su `pending` DESPUÉS de que el hijo ya existía,
-- no la fuente principal de verdad.
CREATE FUNCTION public.propagate_fx_resolution_to_children()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from_decimals smallint;
  v_to_decimals smallint;
  v_factor numeric;
BEGIN
  IF NEW.fx_rate IS NULL THEN
    RETURN NEW; -- el padre sigue (o volvió a quedar) pending: nada que propagar
  END IF;

  SELECT c.decimals INTO v_from_decimals FROM public.currencies c WHERE c.code = NEW.currency_code;
  SELECT c.decimals INTO v_to_decimals
  FROM public.currencies c
  JOIN public.households h ON h.base_currency = c.code
  WHERE h.id = NEW.household_id;
  v_factor := power(10, coalesce(v_to_decimals, 2) - coalesce(v_from_decimals, 2));

  UPDATE public.transaction_splits
  SET amount_base = round(amount * NEW.fx_rate * v_factor)::bigint,
      fx_source = NEW.fx_source
  WHERE transaction_id = NEW.id AND fx_source = 'pending' AND deleted_at IS NULL;

  UPDATE public.transaction_shares
  SET share_amount_base = round(share_amount * NEW.fx_rate * v_factor)::bigint,
      fx_source = NEW.fx_source
  WHERE transaction_id = NEW.id AND fx_source = 'pending' AND deleted_at IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_propagate_fx_resolution
AFTER UPDATE ON public.transactions
FOR EACH ROW
WHEN (OLD.fx_rate IS DISTINCT FROM NEW.fx_rate)
EXECUTE FUNCTION public.propagate_fx_resolution_to_children();

REVOKE EXECUTE ON FUNCTION public.propagate_fx_resolution_to_children() FROM PUBLIC, anon, authenticated;
