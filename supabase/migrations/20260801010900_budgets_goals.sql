-- A2 (auditoría técnica) — reescrita a v2. La v1 original de este archivo
-- (period/start_date/rollover/scope/owner_id + budget_lines hija) y la v2
-- de `20260801040000_budgets_goals_recurring.sql` (category_id/amount_limit,
-- sin budget_lines) colisionaban: ambas hacían `CREATE TABLE public.budgets`
-- sin `DROP`/`IF NOT EXISTS`, así que ninguna cadena de migraciones desde
-- cero podía terminar de aplicar. El cliente (`sync-config.ts`, schema de
-- Dexie) siempre sincronizó contra la v2 — la v1 era schema muerto que
-- nunca se escribió desde la app. Repo joven sin datos que conservar
-- (`CLAUDE.md`): se reescribe acá en vez de layering una reconciliación
-- eterna. El remoto que ya tenía la v1 aplicada se corrige en
-- `20260801110000_reconcile_budgets_goals_recurring_v2.sql`.
--
-- Decisiones de producto que quedan (no se inventan acá, ver v1 original
-- para el detalle): `budget_periods`/`goal_contributions`/`goal_accounts`
-- no existen — presupuestos calculan el gastado on-the-fly desde
-- `transactions`, y una meta apunta a UNA cuenta (`account_id`), el
-- progreso es el saldo de esa cuenta.
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
