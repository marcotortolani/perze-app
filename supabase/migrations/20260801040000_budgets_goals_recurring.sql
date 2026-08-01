-- Bloque F+G (docs/plan-de-trabajo.md § 6.9). Estas tres tablas no estaban
-- en 01-arquitectura-datos.md — son la decisión de schema que faltaba para
-- programar presupuestos/metas/recurrentes. Decisiones tomadas acá, para
-- no bloquear el bloque en una pregunta abierta:
--
-- 1. Presupuestos NO llevan un `budget_periods` separado: el gastado real
--    de cada período se calcula on-the-fly desde `transactions` (mismo
--    patrón que el patrimonio neto o el estado del mes de Home), no se
--    persiste. Sin eso, no hay tabla que mantener sincronizada ni
--    reconciliar — el período del household (`period_start_day`) ya es la
--    única fuente de verdad para "qué período es ahora".
-- 2. Metas NO llevan `goal_contributions` ni `goal_accounts`: una meta
--    apunta a UNA cuenta (`account_id`), y el progreso es el saldo de esa
--    cuenta. Igual que arriba: menos estado que reconciliar, cero tablas
--    nuevas de las que CLAUDE.md marcaba como huecos sin resolver.
-- 3. Recurrentes: `recurring_rules` es la plantilla; `transactions.recurring_id`
--    (ya existe en el schema) es el vínculo hacia adelante cuando una
--    transacción real corresponde a la regla.

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  -- NULL = presupuesto del household entero, no de una categoría.
  category_id uuid REFERENCES public.categories (id),
  name text NOT NULL,
  amount_limit bigint NOT NULL CHECK (amount_limit > 0),
  currency_code text NOT NULL REFERENCES public.currencies (code),
  archived_at timestamptz,

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX budgets_household_idx ON public.budgets (household_id) WHERE archived_at IS NULL;

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY budgets_select ON public.budgets FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY budgets_insert ON public.budgets FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY budgets_update ON public.budgets FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id = (SELECT budgets.household_id) AND created_by = (SELECT budgets.created_by));

CREATE TABLE public.goals (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  name text NOT NULL,
  icon text,
  color text,
  target_amount bigint NOT NULL CHECK (target_amount > 0),
  currency_code text NOT NULL REFERENCES public.currencies (code),
  target_date date,
  -- Progreso = saldo de esta cuenta. NULL mientras no se elige ninguna
  -- (la meta existe, pero todavía no tiene dónde acumular).
  account_id uuid REFERENCES public.accounts (id),
  archived_at timestamptz,

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX goals_household_idx ON public.goals (household_id) WHERE archived_at IS NULL;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_select ON public.goals FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY goals_insert ON public.goals FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY goals_update ON public.goals FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id = (SELECT goals.household_id) AND created_by = (SELECT goals.created_by));

CREATE TABLE public.recurring_rules (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('expense', 'income')),
  category_id uuid REFERENCES public.categories (id),
  account_id uuid NOT NULL REFERENCES public.accounts (id),
  expected_amount bigint NOT NULL CHECK (expected_amount > 0),
  currency_code text NOT NULL REFERENCES public.currencies (code),
  -- 1-31; los meses más cortos caen al último día (resuelto en el cliente).
  day_of_month int NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  archived_at timestamptz,

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recurring_rules_household_idx ON public.recurring_rules (household_id) WHERE archived_at IS NULL;

ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY recurring_rules_select ON public.recurring_rules FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY recurring_rules_insert ON public.recurring_rules FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY recurring_rules_update ON public.recurring_rules FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id = (SELECT recurring_rules.household_id) AND created_by = (SELECT recurring_rules.created_by));

-- `transactions.recurring_id` ya existe (01-arquitectura-datos.md § 7) pero
-- nunca tuvo FK real porque `recurring_rules` no existía todavía.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_recurring_id_fkey FOREIGN KEY (recurring_id) REFERENCES public.recurring_rules (id);
