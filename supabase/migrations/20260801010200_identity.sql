-- 01-arquitectura-datos.md § 2.1, § 3.
-- `profiles` está fuera del patrón household: ancla en id = auth.uid(), no
-- hay padre que le aplique.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  locale text NOT NULL DEFAULT 'es',
  timezone text,
  default_household_id uuid, -- FK diferida: households todavía no existe en este punto del archivo
  settings jsonb NOT NULL DEFAULT '{}'::jsonb -- tema, acento, intensidad de animación, modo privacidad
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT
USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_update ON public.profiles FOR UPDATE
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

-- El household existe siempre, incluso para un usuario solo — así el
-- módulo "familiar" se enciende sin migrar nada.
CREATE TABLE public.households (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  base_currency text NOT NULL REFERENCES public.currencies (code),
  base_country char(2) REFERENCES public.countries (code),
  period_start_day smallint NOT NULL DEFAULT 1, -- día de cierre del mes, no todos cierran el 1
  week_start smallint NOT NULL DEFAULT 1,
  enabled_modules text[] NOT NULL DEFAULT '{}',
  -- la lista canónica es SEIS y vive acá, no en un comentario (CON-06 del schema, § 7 #6)
  CONSTRAINT enabled_modules_valid CHECK (
    enabled_modules <@ ARRAY['budgets', 'goals', 'recurring', 'debts', 'investments', 'family']::text[]
  ),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id)
);

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_default_household_fkey
FOREIGN KEY (default_household_id) REFERENCES public.households (id);

CREATE TABLE public.household_members (
  household_id uuid NOT NULL REFERENCES public.households (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  display_name text,
  color text,
  -- J10 muestra "miembro que se va" y J3 la invitación pendiente: las dos
  -- necesitan un estado, no solo la ausencia de la fila.
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'former')),
  joined_at timestamptz,
  left_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, profile_id)
);

-- Usado por current_households() en cada policy de todo el esquema.
CREATE INDEX household_members_profile_idx ON public.household_members (profile_id);

-- search_path = '' obligatorio: sin esto, un search_path manipulado puede
-- redirigir la consulta a una tabla falsa. Por eso todo va calificado con
-- `public.`. SECURITY DEFINER: corre como dueño de la función, así lee
-- household_members sin quedar sujeta a la RLS de household_members (que
-- de otro modo sería una referencia circular).
CREATE FUNCTION public.current_households()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hm.household_id
  FROM public.household_members hm
  WHERE hm.profile_id = (SELECT auth.uid());
$$;

CREATE FUNCTION public.can_write(h uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = h
      AND hm.profile_id = (SELECT auth.uid())
      AND hm.role IN ('owner', 'admin', 'member') -- viewer queda afuera
  );
$$;

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY households_select ON public.households FOR SELECT
USING (id IN (SELECT public.current_households()));

CREATE POLICY households_update ON public.households FOR UPDATE
USING (id IN (SELECT public.current_households()) AND public.can_write(id))
WITH CHECK (id IN (SELECT public.current_households()) AND public.can_write(id));

-- households se crea desde un flujo de servidor (A7: household + primera
-- cuenta + categorías en una transacción, vía Server Action) — sin policy
-- de INSERT para authenticated; la crea el service role o una función
-- SECURITY DEFINER dedicada al flujo de onboarding.

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY household_members_select ON public.household_members FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY household_members_update ON public.household_members FOR UPDATE
USING (
  household_id IN (SELECT public.current_households())
  AND EXISTS (
    SELECT 1 FROM public.household_members m
    WHERE m.household_id = household_members.household_id
      AND m.profile_id = (SELECT auth.uid())
      AND m.role IN ('owner', 'admin')
  )
)
WITH CHECK (household_id = (SELECT household_members.household_id));

CREATE TABLE public.household_invites (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  code text NOT NULL UNIQUE,
  email text,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz, -- cancelar una invitación, distinto de esperar a que venza
  accepted_by uuid REFERENCES public.profiles (id)
);

ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY household_invites_select ON public.household_invites FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY household_invites_write ON public.household_invites FOR ALL
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id = (SELECT household_invites.household_id) AND public.can_write(household_id));

CREATE TABLE public.household_fx_preferences (
  household_id uuid NOT NULL REFERENCES public.households (id),
  currency_pair text NOT NULL, -- 'ARS/USD'
  preferred_provider text,
  preferred_quote_kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, currency_pair)
);

ALTER TABLE public.household_fx_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY household_fx_preferences_select ON public.household_fx_preferences FOR SELECT
USING (household_id IN (SELECT public.current_households()));

CREATE POLICY household_fx_preferences_write ON public.household_fx_preferences FOR ALL
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id = (SELECT household_fx_preferences.household_id) AND public.can_write(household_id));
