-- Encontrado probando C7 de punta a punta con un usuario real: household
-- creation (A7 — household + primera cuenta + categorías) no tenía
-- policy de INSERT en absoluto, ni en households ni en household_members
-- (el documento original solo daba SELECT/UPDATE, asumiendo un flujo de
-- servidor sin especificar la policy). Un usuario recién logueado no podía
-- crear su propio household — se verificó el error real contra la base:
-- "new row violates row-level security policy for table households".
--
-- households: cualquier autenticado puede crear un household nuevo — no
-- hay membresía previa que validar (todavía no existe la fila), así que
-- el único chequeo posible y correcto es que `created_by` sea quien lo crea.
CREATE POLICY households_insert ON public.households FOR INSERT
WITH CHECK (created_by = (SELECT auth.uid()));

-- household_members: alcanza con permitir que el creador de un household
-- se agregue a sí mismo (como owner, al cerrar A7). Agregar a OTRO miembro
-- es el flujo de invitación (J3, todavía sin construir) — se resuelve con
-- su propia policy o una función SECURITY DEFINER cuando se construya,
-- no ensanchando esta.
CREATE POLICY household_members_insert ON public.household_members FOR INSERT
WITH CHECK (
  profile_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = household_members.household_id AND h.created_by = (SELECT auth.uid())
  )
);
