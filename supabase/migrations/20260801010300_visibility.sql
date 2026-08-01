-- 01-arquitectura-datos.md § 2.4b.
-- Nota de reordenamiento respecto al plan: el plan (docs/plan-de-trabajo.md
-- § 5.1) ubica visibility_grants en la migración "fx" (MIG-07), después de
-- accounts/categories. Eso es irresoluble: can_see() se usa en las policies
-- de SELECT de accounts y categories, así que visibility_grants y can_see()
-- tienen que existir ANTES de esas tablas. Se corrige acá.
CREATE TABLE public.visibility_grants (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  subject_type text NOT NULL CHECK (subject_type IN ('account', 'category')),
  subject_id uuid NOT NULL, -- uuid suelto sin FK: apunta a accounts o categories según subject_type
  member_id uuid NOT NULL REFERENCES public.profiles (id), -- profile_id del miembro que SÍ ve
  granted_by uuid NOT NULL REFERENCES public.profiles (id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz, -- J9 audita altas y bajas
  UNIQUE (subject_type, subject_id, member_id)
);

CREATE INDEX visibility_grants_member_idx ON public.visibility_grants (member_id, subject_type, subject_id)
WHERE revoked_at IS NULL;

CREATE INDEX visibility_grants_household_idx ON public.visibility_grants (household_id, subject_type, subject_id);

CREATE FUNCTION public.can_see(p_type text, p_id uuid, p_visibility text, p_owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_visibility
    WHEN 'household' THEN true
    WHEN 'private' THEN p_owner = (SELECT auth.uid())
    WHEN 'custom' THEN p_owner = (SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.visibility_grants g
      WHERE g.subject_type = p_type AND g.subject_id = p_id
        AND g.member_id = (SELECT auth.uid())
        AND g.revoked_at IS NULL
    )
    ELSE false
  END;
$$;

ALTER TABLE public.visibility_grants ENABLE ROW LEVEL SECURITY;

-- La policy de escritura (grants_all) necesita validar subject_id contra
-- accounts Y categories, que todavía no existen en este punto del schema
-- (dependencia circular: accounts/categories usan can_see(), que vive acá,
-- pero visibility_grants necesita validar contra ellas). Se crea en
-- 20260801010600_classification.sql, una vez que ambas tablas existen.
-- Sin policy todavía, RLS habilitado deniega todo acceso — correcto para
-- este punto intermedio del conjunto de migraciones.
