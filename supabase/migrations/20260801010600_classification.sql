-- 01-arquitectura-datos.md § 2.4. Entidades raíz (Patrón A).
CREATE TABLE public.categories (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  parent_id uuid REFERENCES public.categories (id),
  name text NOT NULL,
  icon text,
  color text,
  kind text NOT NULL CHECK (kind IN ('expense', 'income')),
  nature text NOT NULL DEFAULT 'variable' CHECK (nature IN ('fixed', 'variable', 'discretionary')),
  is_system boolean NOT NULL DEFAULT false,
  sort_order int,
  archived_at timestamptz,
  -- J4 muestra visibilidad por categoría, no solo por cuenta
  visibility text NOT NULL DEFAULT 'household' CHECK (visibility IN ('private', 'household', 'custom')),
  owner_id uuid REFERENCES public.profiles (id), -- requerido cuando visibility = 'private'
  CONSTRAINT categories_private_owner CHECK (visibility != 'private' OR owner_id IS NOT NULL),

  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX categories_household_idx ON public.categories (household_id) WHERE archived_at IS NULL;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_select ON public.categories FOR SELECT
USING (
  deleted_at IS NULL
  AND household_id IN (SELECT public.current_households())
  AND public.can_see('category', id, visibility, owner_id)
);

CREATE POLICY categories_insert ON public.categories FOR INSERT
WITH CHECK (public.can_write(household_id) AND created_by = (SELECT auth.uid()));

CREATE POLICY categories_update ON public.categories FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (
  household_id = (SELECT categories.household_id) -- inmutable, ver nota en accounts_update
  AND created_by = (SELECT categories.created_by)
);

CREATE TABLE public.tags (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  name text NOT NULL,
  color text
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tags_select ON public.tags FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY tags_write ON public.tags FOR ALL
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id IN (SELECT public.current_households()) AND public.can_write(household_id));

CREATE TABLE public.payees (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  name text NOT NULL,
  default_category_id uuid REFERENCES public.categories (id),
  default_account_id uuid REFERENCES public.accounts (id),
  logo_url text,
  aliases text[]
);

ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;

CREATE POLICY payees_select ON public.payees FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY payees_write ON public.payees FOR ALL
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id IN (SELECT public.current_households()) AND public.can_write(household_id));

-- Ahora que accounts (20260801010500) y categories (arriba) existen, se
-- completa la policy de escritura de visibility_grants que quedó pendiente
-- en 20260801010300_visibility.sql.
CREATE POLICY grants_all ON public.visibility_grants FOR ALL
USING (household_id IN (SELECT public.current_households()))
WITH CHECK (
  public.can_write(household_id)
  AND CASE subject_type
    WHEN 'account' THEN EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = subject_id AND a.household_id = visibility_grants.household_id
    )
    WHEN 'category' THEN EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = subject_id AND c.household_id = visibility_grants.household_id
    )
    ELSE false
  END
);
