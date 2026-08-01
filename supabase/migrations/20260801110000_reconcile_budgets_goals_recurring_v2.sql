-- A2 (auditoría técnica) — saneo del remoto YA migrado. Diagnóstico
-- (`information_schema.columns` contra el proyecto real, 2026-08-01):
-- `budgets`/`goals`/`recurring_rules` estaban físicamente en v1
-- (period/start_date/scope/owner_id + budget_lines hija; template/rrule
-- para recurring_rules), aunque `20260801040000_budgets_goals_recurring.sql`
-- figura como aplicada en el historial — el `CREATE TABLE` de esa
-- migración chocó con la v1 ("already exists"), pero el `ALTER TABLE
-- transactions ADD CONSTRAINT transactions_recurring_id_fkey` al final del
-- archivo sí corrió (confirmado: la constraint existe hoy). Las tres
-- tablas confirmadas en 0 filas — sin datos que perder.
--
-- Esta migración transiciona el remoto a la v2 que ahora definen
-- `20260801010900_budgets_goals.sql`/`20260801011000_recurring_debts.sql`
-- directamente (para que un clon nuevo desde cero nunca pise este bug).
-- CASCADE al dropear `recurring_rules` se lleva puesta la FK de
-- `transactions.recurring_id` — se re-agrega al final.

DROP TABLE IF EXISTS public.budget_lines CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;
DROP TABLE IF EXISTS public.recurring_rules CASCADE;

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
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

-- CASCADE del DROP de arriba se llevó esta FK puesta — se re-agrega.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_recurring_id_fkey FOREIGN KEY (recurring_id) REFERENCES public.recurring_rules (id);
