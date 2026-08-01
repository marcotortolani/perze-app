-- Mismo patrón que 20260801020400 (household_members_update), encontrado
-- probando C7 de punta a punta: household_members_insert consultaba
-- `households` directamente en su WITH CHECK, pero households_select
-- exige `id IN current_households()` — y el usuario que recién creó su
-- household TODAVÍA no es miembro (esa es justamente la fila que está
-- intentando insertar), así que la subquery no ve nada bajo su propia RLS
-- y el INSERT se rechaza siempre, incluso siendo el creador real.
CREATE FUNCTION public.household_created_by_caller(h uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households
    WHERE id = h AND created_by = (SELECT auth.uid())
  );
$$;

ALTER POLICY household_members_insert ON public.household_members
WITH CHECK (
  profile_id = (SELECT auth.uid())
  AND public.household_created_by_caller(household_id)
);
