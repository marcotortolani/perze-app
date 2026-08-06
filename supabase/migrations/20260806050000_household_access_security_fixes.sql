-- Auditoría del bloque J (grupo familiar) tras el primer invitado real de
-- producción. Tres brechas reales, no cosméticas:
--
-- 1. `current_households()` y `can_write()` nunca filtraban `status`:
--    `markHouseholdMemberFormer()` (remover a alguien) marcaba la fila
--    `'former'` pero la RLS de TODO el esquema (cuentas, movimientos,
--    presupuestos, invitaciones, todo lo que cuelga de estas dos
--    funciones) seguía tratando a ese usuario como miembro activo para
--    siempre. Remover a alguien era cosmético: seguía leyendo y
--    escribiendo el household completo desde su sesión.
-- 2. `household_invites_select` no filtraba por rol: cualquier miembro,
--    incluido `viewer`, podía leer el `code` de CUALQUIER invitación
--    pendiente del household (la UI de hecho lo pinta en pantalla), y
--    `accept_invite()` deja que ese código actualice el propio rol de
--    quien lo canjea — una vía de escalada de privilegios si alguna vez
--    se invita como `admin`.
-- 3. Nada impedía que un `admin` se autopromoviera a `owner`, degradara
--    al `owner` real, o que un household se quedara sin ningún `owner`
--    activo — la UI no ofrece el botón, pero no había ninguna guarda del
--    lado del servidor.

CREATE OR REPLACE FUNCTION public.current_households()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hm.household_id
  FROM public.household_members hm
  WHERE hm.profile_id = (SELECT auth.uid())
    AND hm.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.can_write(h uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = h
      AND hm.profile_id = (SELECT auth.uid())
      AND hm.status = 'active'
      AND hm.role IN ('owner', 'admin', 'member') -- viewer queda afuera
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_admin(h uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members m
    WHERE m.household_id = h
      AND m.profile_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin')
  );
$$;

-- (2) — el código de invitación es una credencial (otorga acceso de
-- lectura completa al household que la acepta), no un dato de lista. Solo
-- quien administra el household puede verlo.
DROP POLICY IF EXISTS household_invites_select ON public.household_invites;
CREATE POLICY household_invites_select ON public.household_invites FOR SELECT
USING (public.is_household_admin(household_id));

-- (3) — guarda de owner mínimo + quién puede otorgar el rol de owner.
-- Vive en un trigger y no en un CHECK porque "¿queda al menos un owner
-- activo después de este cambio?" es una agregación sobre las OTRAS
-- filas, que un CHECK de columna no puede expresar.
CREATE OR REPLACE FUNCTION public.guard_household_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_remaining_owners integer;
  v_actor_role text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role = 'owner' AND OLD.role IS DISTINCT FROM 'owner' THEN
    SELECT role INTO v_actor_role FROM public.household_members
    WHERE household_id = NEW.household_id AND profile_id = (SELECT auth.uid());
    IF v_actor_role IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Solo un owner puede otorgar el rol de owner' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF OLD.role = 'owner' AND OLD.status = 'active'
     AND (TG_OP = 'DELETE' OR NEW.role <> 'owner' OR NEW.status <> 'active') THEN
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

DROP TRIGGER IF EXISTS household_members_guard_owner ON public.household_members;
CREATE TRIGGER household_members_guard_owner
BEFORE UPDATE OR DELETE ON public.household_members
FOR EACH ROW
EXECUTE FUNCTION public.guard_household_owner_change();
