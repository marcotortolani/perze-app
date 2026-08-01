-- Bug encontrado escribiendo el test de GATE-1 para household_members:
-- "infinite recursion detected in policy for relation household_members".
-- La policy household_members_update consultaba household_members
-- DIRECTAMENTE (no a través de una función SECURITY DEFINER) desde dentro
-- de una policy de la MISMA tabla — exactamente el problema que
-- current_households()/can_write() existen para evitar. Se corrige con el
-- mismo patrón: un helper SECURITY DEFINER.
CREATE FUNCTION public.is_household_admin(h uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members m
    WHERE m.household_id = h
      AND m.profile_id = (SELECT auth.uid())
      AND m.role IN ('owner', 'admin')
  );
$$;

ALTER POLICY household_members_update ON public.household_members
USING (
  household_id IN (SELECT public.current_households())
  AND public.is_household_admin(household_id)
);
