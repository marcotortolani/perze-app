-- 01-arquitectura-datos.md § 2.5 (settlements), § 2.9. Todas raíz (Patrón A).
--
-- NOTA — gap de documentación: docs/plan-de-trabajo.md § 5.1 (MIG-11) menciona
-- además `notification_preferences` + push subscriptions, `price_index` y
-- `card_statements`, ninguna con schema escrito en docs/01-arquitectura-datos.md.
-- Tampoco `household_currencies` (usada por CONS-E06, "monedas en uso" para
-- el flag de progresividad). Ninguna se inventa acá: bloquean K12
-- (notificaciones), H7 (ajuste por inflación, price_index) y E4
-- (resumen de tarjeta, card_statements) hasta que se definan.

CREATE TABLE public.settlements ( -- liquidaciones entre personas
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  from_member uuid NOT NULL REFERENCES public.profiles (id),
  to_member uuid NOT NULL REFERENCES public.profiles (id),
  amount bigint NOT NULL,
  currency_code text NOT NULL REFERENCES public.currencies (code),
  -- una liquidación en moneda distinta de la base es un agregado como cualquier otro
  fx_rate numeric(24, 12),
  fx_source text NOT NULL DEFAULT 'identity' CHECK (
    fx_source IN ('identity', 'api', 'manual', 'inherited', 'pending')
  ),
  amount_base bigint,
  CONSTRAINT settlements_fx_pair CHECK ((fx_rate IS NULL) = (amount_base IS NULL)),
  method text CHECK (method IN ('cash', 'transfer', 'forgiven', 'other')),
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('pending', 'done', 'forgiven')),
  settled_at timestamptz,
  transaction_id uuid REFERENCES public.transactions (id),

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX settlements_household_settled_idx ON public.settlements (household_id, settled_at DESC);

-- transaction_shares.settlement_id se declaró sin FK en 20260801010700
-- porque settlements no existía todavía; se completa acá.
ALTER TABLE public.transaction_shares
ADD CONSTRAINT transaction_shares_settlement_fkey
FOREIGN KEY (settlement_id) REFERENCES public.settlements (id);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- DELETE no se expone, mismo criterio que el resto de las tablas con
-- significado financiero (CON-24).
CREATE POLICY settlements_select ON public.settlements FOR SELECT
USING (deleted_at IS NULL AND household_id IN (SELECT public.current_households()));

CREATE POLICY settlements_insert ON public.settlements FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY settlements_update ON public.settlements FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (
  household_id = (SELECT settlements.household_id) -- inmutable, ver nota en accounts_update
  AND created_by = (SELECT settlements.created_by)
);

CREATE TABLE public.rules ( -- auto-categorización
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  name text NOT NULL,
  priority int NOT NULL DEFAULT 0,
  match jsonb NOT NULL, -- {field:'note', op:'contains', value:'uber'}
  actions jsonb NOT NULL, -- {category_id, tags, payee_id}
  is_active boolean NOT NULL DEFAULT true,
  hit_count int NOT NULL DEFAULT 0,
  -- las crea y edita el usuario: entidad raíz como cualquier otra
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY rules_select ON public.rules FOR SELECT
USING (deleted_at IS NULL AND household_id IN (SELECT public.current_households()));

CREATE POLICY rules_insert ON public.rules FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY rules_update ON public.rules FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (
  household_id = (SELECT rules.household_id) -- inmutable, ver nota en accounts_update
  AND created_by = (SELECT rules.created_by)
);

CREATE TABLE public.insights (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  kind text NOT NULL,
  severity text NOT NULL,
  payload jsonb NOT NULL,
  period_start date,
  period_end date,
  dismissed_at timestamptz, -- hace de archived_at
  created_at timestamptz NOT NULL DEFAULT now()
  -- sin created_by a propósito: las genera el sistema, no el usuario
);

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY insights_select ON public.insights FOR SELECT
USING (household_id IN (SELECT public.current_households()));

-- Solo dismiss (updated vía dismissed_at) — las genera el sistema
-- (service_role/Edge Function), el cliente nunca inserta una fila nueva.
CREATE POLICY insights_dismiss ON public.insights FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id = (SELECT insights.household_id));

CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  actor_id uuid REFERENCES public.profiles (id), -- created_by con otro nombre
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  diff jsonb,
  at timestamptz NOT NULL DEFAULT now() -- created_at con otro nombre
  -- Append-only por diseño: sin updated_at ni deleted_at. Una bitácora que
  -- se puede editar o borrar no es una bitácora.
  -- Retención: purga por pg_cron según AUDIT_RETENTION_MONTHS (default 12,
  -- variable de entorno en self-host). Nunca se purgan las entradas de
  -- borrado ni de cambio de permisos.
);

CREATE INDEX audit_log_household_idx ON public.audit_log (household_id, at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON public.audit_log FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT
WITH CHECK (public.can_write(household_id) AND actor_id = (SELECT auth.uid()));
-- Sin policy de UPDATE ni DELETE: append-only, sin excepción.

CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  filename text NOT NULL,
  mapping jsonb, -- K9b guarda el mapeo de columnas para reutilizarlo
  row_count int,
  status text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id), -- quién corrió el import
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now() -- el estado cambia mientras dura el flujo de K9
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_batches_select ON public.import_batches FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY import_batches_insert ON public.import_batches FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY import_batches_update ON public.import_batches FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id = (SELECT import_batches.household_id));
