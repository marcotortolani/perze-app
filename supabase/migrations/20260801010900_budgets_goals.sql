-- 01-arquitectura-datos.md § 2.7. Entidades raíz (Patrón A), budget_lines
-- es hija (Patrón B).
--
-- NOTA — gap de documentación: docs/plan-de-trabajo.md § 5.1 (MIG-08) menciona
-- además `budget_periods`, `goal_contributions` y `goal_accounts`, pero
-- ninguna de las tres tiene schema escrito en docs/01-arquitectura-datos.md
-- § 2.7 (que solo define budgets, budget_lines y goals). No se inventan acá:
-- falta decisión de producto sobre su forma antes de escribir la migración
-- (¿budget_periods es snapshot por período con carry-over ya resuelto, o se
-- computa on-the-fly? ¿goal_contributions es un ledger de aportes o un
-- agregado? ¿goal_accounts vincula 1:N o N:N metas↔cuentas?). Bloquea CON-F05
-- y CON-F06 hasta que se resuelva.
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  name text NOT NULL,
  period text NOT NULL CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  start_date date NOT NULL,
  end_date date,
  currency_code text NOT NULL REFERENCES public.currencies (code),
  rollover boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'household' CHECK (scope IN ('household', 'personal')),
  owner_id uuid REFERENCES public.profiles (id),
  is_active boolean NOT NULL DEFAULT true,

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY budgets_select ON public.budgets FOR SELECT
USING (
  deleted_at IS NULL
  AND household_id IN (SELECT public.current_households())
  AND (scope = 'household' OR owner_id = (SELECT auth.uid()))
);

CREATE POLICY budgets_insert ON public.budgets FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY budgets_update ON public.budgets FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (
  household_id = (SELECT budgets.household_id) -- inmutable, ver nota en accounts_update
  AND created_by = (SELECT budgets.created_by)
);

CREATE TABLE public.budget_lines (
  id uuid PRIMARY KEY,
  budget_id uuid NOT NULL REFERENCES public.budgets (id),
  category_id uuid REFERENCES public.categories (id),
  tag_id uuid REFERENCES public.tags (id),
  amount bigint NOT NULL,
  rollover_balance bigint NOT NULL DEFAULT 0
);

CREATE INDEX budget_lines_budget_idx ON public.budget_lines (budget_id);

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY budget_lines_select ON public.budget_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_lines.budget_id
      AND b.deleted_at IS NULL
      AND b.household_id IN (SELECT public.current_households())
      AND (b.scope = 'household' OR b.owner_id = (SELECT auth.uid()))
  )
);

CREATE POLICY budget_lines_write ON public.budget_lines FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_lines.budget_id AND public.can_write(b.household_id)
  )
)
WITH CHECK (
  budget_id = (SELECT budget_lines.budget_id) -- inmutable, ver nota en accounts_update
  AND EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_lines.budget_id AND public.can_write(b.household_id)
  )
);

CREATE TABLE public.goals (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  name text NOT NULL,
  icon text,
  color text,
  target_amount bigint NOT NULL,
  currency_code text NOT NULL REFERENCES public.currencies (code),
  target_date date,
  current_amount bigint NOT NULL DEFAULT 0,
  linked_account_ids uuid[],
  contribution_strategy jsonb,
  archived_at timestamptz,

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_select ON public.goals FOR SELECT
USING (deleted_at IS NULL AND household_id IN (SELECT public.current_households()));

CREATE POLICY goals_insert ON public.goals FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY goals_update ON public.goals FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (
  household_id = (SELECT goals.household_id) -- inmutable, ver nota en accounts_update
  AND created_by = (SELECT goals.created_by)
);
