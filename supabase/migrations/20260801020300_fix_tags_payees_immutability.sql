-- Encontrado escribiendo el test de GATE-1 para tags/payees: estas dos
-- policies quedaron fuera de la pasada de endurecimiento de
-- docs/plan-de-trabajo.md § 5.1 (household_id inmutable en WITH CHECK).
-- Con el patrón viejo (`household_id IN current_households()`), un usuario
-- miembro de dos households podía mover un tag o un payee de uno a otro.
ALTER POLICY tags_write ON public.tags
WITH CHECK (household_id = (SELECT tags.household_id) AND public.can_write(household_id));

ALTER POLICY payees_write ON public.payees
WITH CHECK (household_id = (SELECT payees.household_id) AND public.can_write(household_id));

-- Mismo problema en el Patrón C con clonado: un clon propio (household_id
-- IS NOT NULL) podía reasignarse a otro household del que el usuario
-- también fuera miembro. `household_id IS NOT NULL` sigue siendo necesario
-- para permitir el INSERT inicial del clon (donde no hay fila vieja que
-- comparar); `OR` con la condición de inmutabilidad cubre ambos casos.
ALTER POLICY institutions_write ON public.institutions
WITH CHECK (
  household_id IS NOT NULL
  AND (household_id = (SELECT institutions.household_id))
  AND public.can_write(household_id)
);

ALTER POLICY asset_classes_write ON public.asset_classes
WITH CHECK (
  household_id IS NOT NULL
  AND (household_id = (SELECT asset_classes.household_id))
  AND public.can_write(household_id)
);

ALTER POLICY instruments_write ON public.instruments
WITH CHECK (
  household_id IS NOT NULL
  AND (household_id = (SELECT instruments.household_id))
  AND public.can_write(household_id)
);
