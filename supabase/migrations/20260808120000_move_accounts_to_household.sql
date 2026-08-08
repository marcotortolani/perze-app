-- "Sumar una cuenta al grupo" — PR 5 del plan de multi-household. Decisión
-- de producto: cuando dos personas con historial propio arman un grupo
-- familiar, no se migra nada solo por invitar/aceptar. Cada quien decide
-- qué cuenta suma al hogar familiar, y esa cuenta se mueve CON su
-- historial — lo que no se suma queda intacto en el household personal.
--
-- Alcance real: solo hay que tocar household_id en las filas que lo
-- tienen. Todo Patrón B hereda por EXISTS sobre el padre y no cambia una
-- columna (account_balance_snapshots, card_statements,
-- transaction_splits/shares/tags, debt_schedule). El UPDATE real es sobre
-- accounts, transactions, y los satélites que referencian una cuenta:
-- recurring_rules, goals, debts.
--
-- Fuera de alcance a propósito: portfolios/trades. portfolios.base_currency
-- es un campo propio, independiente del household (20260801011010:17), y
-- mover una cuenta de broker arrastraría instruments/price_snapshots/
-- target_allocations/transactions.trade_id — se rechaza en el preflight en
-- vez de romper en silencio ese vínculo.

-- ---------------------------------------------------------------------
-- 1. Saltar `household_id` inmutable, sin abrir un agujero.
-- ---------------------------------------------------------------------
-- `enforce_immutable_columns()` (20260801130000) hace household_id
-- inmutable en accounts/transactions/goals/recurring_rules/debts (entre
-- otras), y SECURITY DEFINER no saltea triggers. La escapatoria es una
-- variable de sesión TRANSACCIONAL (is_local = true, se limpia sola en
-- COMMIT/ROLLBACK) que lleva el PAR exacto (source, target) autorizado —
-- no un booleano suelto: un flag "true" sin el par no alcanzaría para que
-- el trigger permita el cambio, así que un flag filtrado no sirve para
-- mover una fila arbitraria a un household distinto del autorizado. Solo
-- `move_accounts_to_household()` la setea, y esa función está revocada de
-- PUBLIC/anon. Se descartó `ALTER TABLE ... DISABLE TRIGGER` (DDL global,
-- ACCESS EXCLUSIVE sobre accounts/transactions — bloquea la app entera a
-- mitad de un sync de otra sesión) y una columna "en migración" (esa sí
-- abre el agujero: accounts_update dejaría a cualquier can_write escribirla).
CREATE OR REPLACE FUNCTION public.enforce_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  col text;
  v_move_authorized boolean;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF col = 'household_id'
      AND (to_jsonb(NEW) ->> 'household_id') IS DISTINCT FROM (to_jsonb(OLD) ->> 'household_id')
    THEN
      v_move_authorized := (
        current_setting('perze.move_source_household', true) = (to_jsonb(OLD) ->> 'household_id')
        AND current_setting('perze.move_target_household', true) = (to_jsonb(NEW) ->> 'household_id')
      );
      IF v_move_authorized THEN
        CONTINUE; -- household_id autorizado por move_accounts_to_household() para este par exacto
      END IF;
    END IF;
    IF (to_jsonb(NEW) ->> col) IS DISTINCT FROM (to_jsonb(OLD) ->> col) THEN
      RAISE EXCEPTION 'La columna % es inmutable en %', col, TG_TABLE_NAME
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
-- Los 21 CREATE TRIGGER de 20260801130000 no cambian: apuntan a esta misma
-- función por nombre, así que el CREATE OR REPLACE de arriba alcanza.

-- ---------------------------------------------------------------------
-- 2. Helper compartido: validación de permiso + precondiciones. Las dos
--    RPCs (preflight de solo lectura, y la que ejecuta) tienen que fallar
--    exactamente igual ante los mismos datos — separado para no duplicar
--    la lógica y arriesgar que diverjan.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.check_move_accounts_preconditions(p_account_ids uuid[], p_target_household_id uuid, OUT source_household_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_distinct_households int;
  v_owns_all boolean;
  v_blocked_broker int;
  v_missing_transfer_accounts text[];
  v_blocked_settlements int;
BEGIN
  -- `uuid` no tiene agregado min()/max() en Postgres base — se resuelve
  -- con array_agg(DISTINCT ...) y se toma el primero.
  SELECT count(*), (array_agg(household_id))[1] INTO v_distinct_households, source_household_id
  FROM (SELECT DISTINCT household_id FROM public.accounts WHERE id = ANY(p_account_ids) AND deleted_at IS NULL) d;
  IF source_household_id IS NULL THEN
    RAISE EXCEPTION 'Ninguna de las cuentas existe' USING ERRCODE = '02000';
  END IF;
  IF v_distinct_households > 1 THEN
    RAISE EXCEPTION 'Las cuentas a mover tienen que ser todas del mismo household' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) = array_length(p_account_ids, 1) INTO v_owns_all
  FROM public.accounts WHERE id = ANY(p_account_ids) AND owner_id = (SELECT auth.uid());
  IF NOT (public.is_household_admin(source_household_id) OR v_owns_all) THEN
    RAISE EXCEPTION 'Solo el dueño de las cuentas o un admin del household puede moverlas' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_write(p_target_household_id) THEN
    RAISE EXCEPTION 'No podés escribir en el household destino' USING ERRCODE = '42501';
  END IF;
  IF source_household_id = p_target_household_id THEN
    RAISE EXCEPTION 'El household de origen y destino son el mismo' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_blocked_broker
  FROM public.accounts a
  WHERE a.id = ANY(p_account_ids)
    AND (
      a.kind = 'broker'
      OR EXISTS (SELECT 1 FROM public.portfolios p WHERE p.broker_account_id = a.id AND p.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.trades tr WHERE tr.settlement_account_id = a.id AND tr.deleted_at IS NULL)
    );
  IF v_blocked_broker > 0 THEN
    RAISE EXCEPTION 'No se pueden mover cuentas de inversión ni las que financian trades' USING ERRCODE = '22023';
  END IF;

  -- Cierre de transferencias: toda transacción que toque el set por
  -- account_id tiene que tocarlo también por counter_account_id, y
  -- viceversa — si no, la transferencia queda apuntando a una cuenta que
  -- el household destino no puede ver (tx_select solo valida account_id).
  SELECT array_agg(DISTINCT other.name) INTO v_missing_transfer_accounts
  FROM public.transactions t
  JOIN public.accounts other ON other.id = CASE WHEN t.account_id = ANY(p_account_ids) THEN t.counter_account_id ELSE t.account_id END
  WHERE t.household_id = source_household_id AND t.deleted_at IS NULL AND t.kind = 'transfer'
    AND (t.account_id = ANY(p_account_ids) OR t.counter_account_id = ANY(p_account_ids))
    AND NOT (t.account_id = ANY(p_account_ids) AND t.counter_account_id = ANY(p_account_ids));
  IF v_missing_transfer_accounts IS NOT NULL THEN
    RAISE EXCEPTION 'Hay transferencias con % — sumalas juntas', array_to_string(v_missing_transfer_accounts, ', ')
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_blocked_settlements
  FROM public.transactions t
  WHERE t.household_id = source_household_id AND t.deleted_at IS NULL
    AND (t.account_id = ANY(p_account_ids) OR t.counter_account_id = ANY(p_account_ids))
    AND (
      EXISTS (SELECT 1 FROM public.settlements s WHERE s.transaction_id = t.id AND s.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.transaction_shares sh WHERE sh.transaction_id = t.id AND sh.settlement_id IS NOT NULL AND sh.deleted_at IS NULL)
    );
  IF v_blocked_settlements > 0 THEN
    RAISE EXCEPTION 'Hay movimientos ya liquidados entre miembros — liquidá o revertí antes de mover la cuenta' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_move_accounts_preconditions(uuid[], uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Preflight — de solo lectura, alimenta la confirmación de la UI.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.preflight_move_accounts(p_account_ids uuid[], p_target_household_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source_household_id uuid;
  v_source_base text;
  v_target_base text;
  v_tx_count int;
  v_new_categories int;
  v_new_payees int;
  v_new_tags int;
BEGIN
  -- Un solo parámetro OUT: la función devuelve el escalar directo, no una
  -- fila — sin punto, `.source_household_id` fallaría contra un uuid.
  v_source_household_id := public.check_move_accounts_preconditions(p_account_ids, p_target_household_id);

  SELECT base_currency INTO v_source_base FROM public.households WHERE id = v_source_household_id;
  SELECT base_currency INTO v_target_base FROM public.households WHERE id = p_target_household_id;

  SELECT count(*) INTO v_tx_count
  FROM public.transactions t
  WHERE t.household_id = v_source_household_id AND t.deleted_at IS NULL
    AND (t.account_id = ANY(p_account_ids) OR t.counter_account_id = ANY(p_account_ids));

  SELECT count(DISTINCT t.category_id) INTO v_new_categories
  FROM public.transactions t
  WHERE t.household_id = v_source_household_id AND t.deleted_at IS NULL AND t.category_id IS NOT NULL
    AND (t.account_id = ANY(p_account_ids) OR t.counter_account_id = ANY(p_account_ids))
    AND NOT EXISTS (
      SELECT 1 FROM public.categories src
      JOIN public.categories tgt ON tgt.household_id = p_target_household_id AND tgt.deleted_at IS NULL
        AND lower(tgt.name) = lower(src.name) AND tgt.kind = src.kind
      WHERE src.id = t.category_id
    );

  SELECT count(DISTINCT t.payee_id) INTO v_new_payees
  FROM public.transactions t
  WHERE t.household_id = v_source_household_id AND t.deleted_at IS NULL AND t.payee_id IS NOT NULL
    AND (t.account_id = ANY(p_account_ids) OR t.counter_account_id = ANY(p_account_ids))
    AND NOT EXISTS (
      SELECT 1 FROM public.payees src
      JOIN public.payees tgt ON tgt.household_id = p_target_household_id AND lower(tgt.name) = lower(src.name)
      WHERE src.id = t.payee_id
    );

  SELECT count(DISTINCT tt.tag_id) INTO v_new_tags
  FROM public.transaction_tags tt
  JOIN public.transactions t ON t.id = tt.transaction_id
  WHERE t.household_id = v_source_household_id AND t.deleted_at IS NULL
    AND (t.account_id = ANY(p_account_ids) OR t.counter_account_id = ANY(p_account_ids))
    AND NOT EXISTS (
      SELECT 1 FROM public.tags src
      JOIN public.tags tgt ON tgt.household_id = p_target_household_id AND lower(tgt.name) = lower(src.name)
      WHERE src.id = tt.tag_id
    );

  RETURN jsonb_build_object(
    'transactionCount', v_tx_count,
    'newCategories', coalesce(v_new_categories, 0),
    'newPayees', coalesce(v_new_payees, 0),
    'newTags', coalesce(v_new_tags, 0),
    'baseCurrencyMismatch', v_source_base <> v_target_base,
    'sourceBaseCurrency', v_source_base,
    'targetBaseCurrency', v_target_base
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preflight_move_accounts(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preflight_move_accounts(uuid[], uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. La ejecución.
-- ---------------------------------------------------------------------
-- Orden del cuerpo: mapas (categorías → payees → tags → instituciones) →
-- accounts → transactions → transaction_tags/splits → satélites
-- (recurring_rules, goals, debts) → borrar grants + nullear
-- payees.default_account_id en origen → re-resolución de FX si cambia la
-- base → audit_log en cada household → recompute_account_balance por
-- cuenta (defensivo, prueba la invariante).
CREATE FUNCTION public.move_accounts_to_household(p_account_ids uuid[], p_target_household_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source_household_id uuid;
  v_source_base text;
  v_target_base text;
  v_tx_ids uuid[];
  v_new_categories int := 0;
  v_new_payees int := 0;
  v_new_tags int := 0;
  v_identity_count int := 0;
  v_reset_count int := 0;
  v_account_id uuid;
  v_cat record;
  v_payee record;
  v_tag record;
  v_inst record;
  v_target_id uuid;
BEGIN
  v_source_household_id := public.check_move_accounts_preconditions(p_account_ids, p_target_household_id);

  SELECT base_currency INTO v_source_base FROM public.households WHERE id = v_source_household_id;
  SELECT base_currency INTO v_target_base FROM public.households WHERE id = p_target_household_id;

  SELECT array_agg(t.id) INTO v_tx_ids
  FROM public.transactions t
  WHERE t.household_id = v_source_household_id AND t.deleted_at IS NULL
    AND (t.account_id = ANY(p_account_ids) OR t.counter_account_id = ANY(p_account_ids));
  v_tx_ids := coalesce(v_tx_ids, ARRAY[]::uuid[]);

  -- ---- Mapas: categorías (con su cadena de ancestros), payees, tags.
  -- Todos vía match-por-nombre en destino, y si no hay match, clon (nunca
  -- se mueve la fila original — categories_immutable/tags_immutable/
  -- payees_immutable siguen protegiendo household_id ahí). `target_id`
  -- nace NULL y se completa fila por fila: con NOT NULL de entrada el
  -- primer INSERT (antes de resolver ningún mapeo) fallaría.
  CREATE TEMP TABLE category_map (source_id uuid PRIMARY KEY, target_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE payee_map (source_id uuid PRIMARY KEY, target_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE tag_map (source_id uuid PRIMARY KEY, target_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE institution_map (source_id uuid PRIMARY KEY, target_id uuid) ON COMMIT DROP;

  -- Cierre de categorías: las referenciadas por las transacciones movidas
  -- Y sus splits, más TODA la cadena de ancestros (se recorre padre antes
  -- que hijo más abajo — si no, un clon queda con parent_id colgando
  -- cross-household).
  INSERT INTO category_map (source_id)
  WITH RECURSIVE touched AS (
    SELECT DISTINCT category_id AS id FROM public.transactions
      WHERE id = ANY(v_tx_ids) AND category_id IS NOT NULL
    UNION
    SELECT DISTINCT category_id FROM public.transaction_splits
      WHERE transaction_id = ANY(v_tx_ids) AND category_id IS NOT NULL AND deleted_at IS NULL
    UNION
    SELECT DISTINCT category_id FROM public.recurring_rules
      WHERE household_id = v_source_household_id AND category_id IS NOT NULL
        AND (account_id = ANY(p_account_ids) OR fallback_account_id = ANY(p_account_ids))
  ), closure AS (
    SELECT id FROM touched
    UNION
    SELECT c.parent_id
    FROM public.categories c JOIN closure cl ON c.id = cl.id
    WHERE c.parent_id IS NOT NULL
  )
  SELECT DISTINCT id FROM closure;

  -- Padres antes que hijos: se recorre por profundidad real desde la raíz
  -- de CADA categoría del cierre, no de todo `categories`.
  FOR v_cat IN
    WITH RECURSIVE depth AS (
      SELECT c.id, c.parent_id, c.name, c.kind, c.nature, c.icon, c.color, 0 AS lvl
      FROM public.categories c
      WHERE c.id IN (SELECT source_id FROM category_map) AND c.parent_id IS NULL
      UNION ALL
      SELECT c.id, c.parent_id, c.name, c.kind, c.nature, c.icon, c.color, d.lvl + 1
      FROM public.categories c JOIN depth d ON c.parent_id = d.id
      WHERE c.id IN (SELECT source_id FROM category_map)
    )
    SELECT * FROM depth ORDER BY lvl
  LOOP
    SELECT tgt.id INTO v_target_id
    FROM public.categories tgt
    WHERE tgt.household_id = p_target_household_id AND tgt.deleted_at IS NULL
      AND lower(tgt.name) = lower(v_cat.name) AND tgt.kind = v_cat.kind
      AND tgt.parent_id IS NOT DISTINCT FROM (
        CASE WHEN v_cat.parent_id IS NULL THEN NULL ELSE (SELECT target_id FROM category_map WHERE source_id = v_cat.parent_id) END
      )
    LIMIT 1;

    IF v_target_id IS NULL THEN
      v_target_id := gen_random_uuid();
      v_new_categories := v_new_categories + 1;
      INSERT INTO public.categories (id, household_id, parent_id, name, icon, color, kind, nature, is_system, visibility, owner_id, created_by)
      VALUES (
        v_target_id, p_target_household_id,
        CASE WHEN v_cat.parent_id IS NULL THEN NULL ELSE (SELECT target_id FROM category_map WHERE source_id = v_cat.parent_id) END,
        v_cat.name, v_cat.icon, v_cat.color, v_cat.kind, v_cat.nature, false, 'household', NULL, (SELECT auth.uid())
      );
    END IF;

    UPDATE category_map SET target_id = v_target_id WHERE source_id = v_cat.id;
  END LOOP;

  -- Payees: sin jerarquía, match/clon directo por nombre.
  FOR v_payee IN
    SELECT DISTINCT src.id, src.name, src.default_category_id, src.aliases
    FROM public.payees src
    WHERE src.id IN (SELECT DISTINCT payee_id FROM public.transactions WHERE id = ANY(v_tx_ids) AND payee_id IS NOT NULL)
  LOOP
    SELECT tgt.id INTO v_target_id
    FROM public.payees tgt
    WHERE tgt.household_id = p_target_household_id AND lower(tgt.name) = lower(v_payee.name)
    LIMIT 1;

    IF v_target_id IS NULL THEN
      v_target_id := gen_random_uuid();
      v_new_payees := v_new_payees + 1;
      INSERT INTO public.payees (id, household_id, name, default_category_id, aliases)
      VALUES (
        v_target_id, p_target_household_id, v_payee.name,
        (SELECT target_id FROM category_map WHERE source_id = v_payee.default_category_id),
        v_payee.aliases
      );
    END IF;

    INSERT INTO payee_map (source_id, target_id) VALUES (v_payee.id, v_target_id);
  END LOOP;

  -- Tags: sin jerarquía, match/clon directo por nombre.
  FOR v_tag IN
    SELECT DISTINCT src.id, src.name, src.color
    FROM public.tags src
    WHERE src.id IN (SELECT DISTINCT tag_id FROM public.transaction_tags WHERE transaction_id = ANY(v_tx_ids))
  LOOP
    SELECT tgt.id INTO v_target_id
    FROM public.tags tgt
    WHERE tgt.household_id = p_target_household_id AND lower(tgt.name) = lower(v_tag.name)
    LIMIT 1;

    IF v_target_id IS NULL THEN
      v_target_id := gen_random_uuid();
      v_new_tags := v_new_tags + 1;
      INSERT INTO public.tags (id, household_id, name, color) VALUES (v_target_id, p_target_household_id, v_tag.name, v_tag.color);
    END IF;

    INSERT INTO tag_map (source_id, target_id) VALUES (v_tag.id, v_target_id);
  END LOOP;

  -- Instituciones: solo las que son un clon DEL HOUSEHOLD DE ORIGEN
  -- (household_id no nulo) necesitan mapeo — una global (household_id
  -- NULL, Patrón C) sigue siendo visible en cualquier household tal cual.
  -- Sin este paso, accounts.institution_id quedaría apuntando a una fila
  -- que institutions_select oculta a todo el household destino.
  FOR v_inst IN
    SELECT DISTINCT i.id, i.name, i.country_code, i.kind, i.color, i.source_id
    FROM public.institutions i
    WHERE i.id IN (SELECT institution_id FROM public.accounts WHERE id = ANY(p_account_ids) AND institution_id IS NOT NULL)
      AND i.household_id = v_source_household_id
  LOOP
    v_target_id := NULL;
    IF v_inst.source_id IS NOT NULL THEN
      SELECT tgt.id INTO v_target_id FROM public.institutions tgt
      WHERE tgt.household_id = p_target_household_id AND tgt.source_id = v_inst.source_id LIMIT 1;
    END IF;
    IF v_target_id IS NULL THEN
      SELECT tgt.id INTO v_target_id FROM public.institutions tgt
      WHERE tgt.household_id = p_target_household_id AND lower(tgt.name) = lower(v_inst.name) LIMIT 1;
    END IF;
    IF v_target_id IS NULL THEN
      v_target_id := gen_random_uuid();
      INSERT INTO public.institutions (id, household_id, name, country_code, kind, color, source_id)
      VALUES (v_target_id, p_target_household_id, v_inst.name, v_inst.country_code, v_inst.kind, v_inst.color, coalesce(v_inst.source_id, v_inst.id));
    END IF;
    INSERT INTO institution_map (source_id, target_id) VALUES (v_inst.id, v_target_id);
  END LOOP;

  -- ---- accounts
  PERFORM set_config('perze.move_source_household', v_source_household_id::text, true);
  PERFORM set_config('perze.move_target_household', p_target_household_id::text, true);

  UPDATE public.accounts a
  SET household_id = p_target_household_id, visibility = 'household',
      institution_id = coalesce((SELECT target_id FROM institution_map WHERE source_id = a.institution_id), a.institution_id)
  WHERE a.id = ANY(p_account_ids);

  -- ---- transactions (+ remapeo de category_id/payee_id)
  UPDATE public.transactions t
  SET household_id = p_target_household_id,
      category_id = coalesce((SELECT target_id FROM category_map WHERE source_id = t.category_id), t.category_id),
      payee_id = coalesce((SELECT target_id FROM payee_map WHERE source_id = t.payee_id), t.payee_id),
      updated_at = now(), client_rev = client_rev + 1
  WHERE t.id = ANY(v_tx_ids);

  -- ---- transaction_splits: solo remapeo de category_id, el household lo
  -- hereda del padre por EXISTS (Patrón B, no tiene columna propia).
  UPDATE public.transaction_splits s
  SET category_id = coalesce((SELECT target_id FROM category_map WHERE source_id = s.category_id), s.category_id)
  WHERE s.transaction_id = ANY(v_tx_ids) AND s.category_id IS NOT NULL AND s.deleted_at IS NULL;

  -- ---- transaction_tags: PK (transaction_id, tag_id) — remapear el
  -- tag_id es DELETE+INSERT, no un UPDATE en el lugar.
  CREATE TEMP TABLE moved_tags ON COMMIT DROP AS
    SELECT transaction_id, tag_id FROM public.transaction_tags WHERE transaction_id = ANY(v_tx_ids);
  DELETE FROM public.transaction_tags WHERE transaction_id = ANY(v_tx_ids);
  INSERT INTO public.transaction_tags (transaction_id, tag_id)
  SELECT DISTINCT mt.transaction_id, tm.target_id
  FROM moved_tags mt JOIN tag_map tm ON tm.source_id = mt.tag_id
  ON CONFLICT DO NOTHING;

  -- ---- satélites que referencian una cuenta movida
  UPDATE public.recurring_rules r
  SET household_id = p_target_household_id,
      category_id = coalesce((SELECT target_id FROM category_map WHERE source_id = r.category_id), r.category_id),
      updated_at = now()
  WHERE r.household_id = v_source_household_id
    AND (r.account_id = ANY(p_account_ids) OR r.fallback_account_id = ANY(p_account_ids));

  UPDATE public.goals g
  SET household_id = p_target_household_id, updated_at = now()
  WHERE g.household_id = v_source_household_id AND g.account_id = ANY(p_account_ids);

  UPDATE public.debts d
  SET household_id = p_target_household_id, updated_at = now()
  WHERE d.household_id = v_source_household_id AND d.account_id = ANY(p_account_ids);

  -- ---- limpieza en origen: grants de las cuentas movidas (quedan
  -- inválidos: su household_id ya no coincide con el de la cuenta,
  -- grants_all WITH CHECK los rechazaría) y default_account_id de payees
  -- que se quedaron en origen apuntando a una cuenta que ya no está ahí.
  DELETE FROM public.visibility_grants WHERE subject_type = 'account' AND subject_id = ANY(p_account_ids);
  UPDATE public.payees SET default_account_id = NULL
  WHERE household_id = v_source_household_id AND default_account_id = ANY(p_account_ids);

  -- ---- re-resolución de FX si las bases difieren — mismo criterio que
  -- change_household_base_currency() (20260808110000): nunca se recalcula
  -- un fx_rate ya resuelto, se descarta a pending; identidad exacta si la
  -- moneda de la transacción ya es la base destino. Acá escrito aparte
  -- (no se llama a esa función) porque necesita estar SCOPEADO al set de
  -- transacciones movidas, no al household entero.
  IF v_source_base <> v_target_base THEN
    WITH touched AS (
      UPDATE public.transactions
      SET fx_rate = 1, fx_source = 'identity', fx_provider = NULL, fx_quote_kind = NULL,
          fx_resolved_at = now(), amount_base = amount, updated_at = now(), client_rev = client_rev + 1
      WHERE id = ANY(v_tx_ids) AND currency_code = v_target_base
        AND (fx_rate IS DISTINCT FROM 1 OR fx_source <> 'identity' OR amount_base IS DISTINCT FROM amount)
      RETURNING id
    )
    SELECT count(*) INTO v_identity_count FROM touched;

    UPDATE public.transaction_splits s
    SET amount_base = s.amount
    FROM public.transactions t
    WHERE s.transaction_id = t.id AND s.deleted_at IS NULL AND t.id = ANY(v_tx_ids)
      AND t.currency_code = v_target_base AND t.fx_rate = 1 AND t.fx_source = 'identity'
      AND (s.amount_base IS DISTINCT FROM s.amount OR s.fx_source <> 'identity');

    WITH touched AS (
      UPDATE public.transactions
      SET fx_rate = NULL, fx_source = 'pending', fx_provider = NULL, fx_quote_kind = NULL,
          fx_resolved_at = NULL, amount_base = NULL, updated_at = now(), client_rev = client_rev + 1
      WHERE id = ANY(v_tx_ids) AND currency_code <> v_target_base AND fx_rate IS NOT NULL
      RETURNING id
    )
    SELECT count(*) INTO v_reset_count FROM touched;

    UPDATE public.transaction_splits s
    SET amount_base = NULL
    FROM public.transactions t
    WHERE s.transaction_id = t.id AND s.deleted_at IS NULL AND t.id = ANY(v_tx_ids)
      AND t.fx_rate IS NULL
      AND (s.amount_base IS NOT NULL OR s.fx_source <> 'pending');
  END IF;

  -- Una fila en CADA household — la fuente pierde las cuentas, el destino
  -- las gana, y J9/K9 auditan desde el lado de su propio household.
  INSERT INTO public.audit_log (household_id, actor_id, entity, entity_id, action, diff)
  VALUES
    (v_source_household_id, (SELECT auth.uid()), 'households', v_source_household_id, 'accounts_moved_out',
      jsonb_build_object('to', p_target_household_id, 'accountIds', to_jsonb(p_account_ids), 'transactionCount', coalesce(array_length(v_tx_ids, 1), 0))),
    (p_target_household_id, (SELECT auth.uid()), 'households', p_target_household_id, 'accounts_moved_in',
      jsonb_build_object('from', v_source_household_id, 'accountIds', to_jsonb(p_account_ids), 'transactionCount', coalesce(array_length(v_tx_ids, 1), 0)));

  FOREACH v_account_id IN ARRAY p_account_ids LOOP
    PERFORM public.recompute_account_balance(v_account_id);
  END LOOP;

  RETURN jsonb_build_object(
    'transactionCount', coalesce(array_length(v_tx_ids, 1), 0),
    'newCategories', v_new_categories,
    'newPayees', v_new_payees,
    'newTags', v_new_tags,
    'identityCount', v_identity_count,
    'resetCount', v_reset_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.move_accounts_to_household(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_accounts_to_household(uuid[], uuid) TO authenticated;
