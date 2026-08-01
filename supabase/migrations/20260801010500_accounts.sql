-- 01-arquitectura-datos.md § 2.3. Entidad raíz (Patrón A).
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  owner_id uuid NOT NULL REFERENCES public.profiles (id),
  name text NOT NULL,
  kind text NOT NULL CHECK (
    kind IN ('cash', 'checking', 'savings', 'credit_card', 'wallet', 'broker', 'loan', 'receivable', 'other')
  ),
  institution_id uuid REFERENCES public.institutions (id),
  country_code char(2) REFERENCES public.countries (code),
  currency_code text NOT NULL REFERENCES public.currencies (code),

  opening_balance bigint NOT NULL DEFAULT 0,
  opening_date date,
  current_balance bigint NOT NULL DEFAULT 0, -- mantenido por trigger, ver 20260801010600_transactions.sql

  -- tarjetas de crédito
  credit_limit bigint,
  statement_day smallint,
  due_day smallint,

  -- préstamos. numeric(8,4): tasa porcentual, no un monto — ver nota CON-23 en catalog.sql
  interest_rate numeric(8, 4),
  term_months int,

  include_in_net_worth boolean NOT NULL DEFAULT true,
  -- 'private' = solo owner_id · 'household' = todos los miembros · 'custom' = ver visibility_grants
  visibility text NOT NULL DEFAULT 'household' CHECK (visibility IN ('private', 'household', 'custom')),
  color text,
  icon text,
  sort_order int,
  archived_at timestamptz,

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX accounts_household_idx ON public.accounts (household_id) WHERE archived_at IS NULL;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_select ON public.accounts FOR SELECT
USING (
  deleted_at IS NULL
  AND household_id IN (SELECT public.current_households())
  AND public.can_see('account', id, visibility, owner_id)
);

CREATE POLICY accounts_insert ON public.accounts FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY accounts_update ON public.accounts FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (
  household_id = (SELECT accounts.household_id) -- inmutable: nunca IN current_households(), o un miembro de dos households podría mover la fila entre ellos
  AND created_by = (SELECT accounts.created_by) -- created_by es inmutable
);
-- DELETE no se expone: el borrado es un UPDATE que setea deleted_at.

CREATE TABLE public.account_balance_snapshots (
  account_id uuid NOT NULL REFERENCES public.accounts (id),
  as_of date NOT NULL,
  balance bigint NOT NULL,
  PRIMARY KEY (account_id, as_of)
);

ALTER TABLE public.account_balance_snapshots ENABLE ROW LEVEL SECURITY;

-- Entidad hija (Patrón B): hereda el acceso de accounts, nunca duplica household_id.
CREATE POLICY account_balance_snapshots_all ON public.account_balance_snapshots FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_balance_snapshots.account_id
      AND a.household_id IN (SELECT public.current_households())
      AND a.deleted_at IS NULL
      AND public.can_see('account', a.id, a.visibility, a.owner_id)
  )
)
WITH CHECK (
  account_id = (SELECT account_balance_snapshots.account_id) -- inmutable, ver nota en accounts_update
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_balance_snapshots.account_id
      AND public.can_write(a.household_id)
  )
);
