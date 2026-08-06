-- Corrección de la migración anterior (20260806050000): al escribirla no
-- se buscó si ya existía una guarda de "owner mínimo" — sí existía,
-- `household_members_role_change` / `enforce_household_role_changes()`
-- (trigger `WHEN (new.role IS DISTINCT FROM old.role)`), y ya cubre bien
-- tanto "solo un owner puede otorgar/quitar el rol de owner" como
-- "no se puede degradar al último owner". `guard_household_owner_change()`
-- duplicaba esa mitad innecesariamente.
--
-- Lo que la guarda existente NO cubre —y es el hueco real que motivó el
-- trigger nuevo— es marcar al último owner activo `status: 'former'` SIN
-- tocar `role` (`markHouseholdMemberFormer`, el camino real de "sacar del
-- hogar"): esa guarda dispara solo con cambio de `role`, así que un
-- household podía quedarse sin ningún owner activo por esa vía. Se achica
-- la función nueva para cubrir SOLO ese caso, sin repetir la otra mitad.

CREATE OR REPLACE FUNCTION public.guard_household_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_remaining_owners integer;
BEGIN
  IF OLD.role = 'owner' AND OLD.status = 'active'
     AND (TG_OP = 'DELETE' OR NEW.status <> 'active') THEN
    SELECT count(*) INTO v_remaining_owners
    FROM public.household_members
    WHERE household_id = OLD.household_id
      AND role = 'owner'
      AND status = 'active'
      AND profile_id <> OLD.profile_id;
    IF v_remaining_owners = 0 THEN
      RAISE EXCEPTION 'El hogar necesita al menos un owner activo' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
