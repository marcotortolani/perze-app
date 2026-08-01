-- 01-arquitectura-datos.md § 2.7. recurring_rules y debts son raíz (Patrón A);
-- debt_schedule es hija (Patrón B).
--
-- A2 (auditoría técnica) — `recurring_rules` reescrita a v2 (mismo motivo
-- que `20260801010900_budgets_goals.sql`: colisionaba con la v2 de
-- `20260801040000_budgets_goals_recurring.sql`). `debts`/`debt_schedule`
-- no tienen v2 en ningún lado — quedan sin tocar.
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

CREATE TABLE public.debts (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  account_id uuid REFERENCES public.accounts (id),
  kind text NOT NULL CHECK (kind IN ('installment_plan', 'loan', 'credit_line', 'personal')),
  name text NOT NULL,
  principal bigint NOT NULL,
  currency_code text NOT NULL REFERENCES public.currencies (code),
  interest_rate numeric(8, 4), -- tasa, no monto — ver nota CON-23 en catalog.sql
  term_months int,
  start_date date NOT NULL,
  counterpart text,
  direction text NOT NULL CHECK (direction IN ('owe', 'owed')),
  -- G6: origen de la deuda cuando nace de una compra en cuotas con tarjeta
  origin_transaction_id uuid REFERENCES public.transactions (id),
  installment_count int,

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY debts_select ON public.debts FOR SELECT
USING (deleted_at IS NULL AND household_id IN (SELECT public.current_households()));

CREATE POLICY debts_insert ON public.debts FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY debts_update ON public.debts FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (
  household_id = (SELECT debts.household_id) -- inmutable, ver nota en accounts_update
  AND created_by = (SELECT debts.created_by)
);

CREATE TABLE public.debt_schedule (
  id uuid PRIMARY KEY,
  debt_id uuid NOT NULL REFERENCES public.debts (id),
  due_date date NOT NULL,
  number int NOT NULL,
  principal_amount bigint NOT NULL,
  interest_amount bigint NOT NULL DEFAULT 0,
  paid_at timestamptz,
  transaction_id uuid REFERENCES public.transactions (id)
);

CREATE INDEX debt_schedule_debt_idx ON public.debt_schedule (debt_id);

ALTER TABLE public.debt_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY debt_schedule_all ON public.debt_schedule FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.debts d
    WHERE d.id = debt_schedule.debt_id
      AND d.deleted_at IS NULL
      AND d.household_id IN (SELECT public.current_households())
  )
)
WITH CHECK (
  debt_id = (SELECT debt_schedule.debt_id) -- inmutable, ver nota en accounts_update
  AND EXISTS (
    SELECT 1 FROM public.debts d
    WHERE d.id = debt_schedule.debt_id AND public.can_write(d.household_id)
  )
);
