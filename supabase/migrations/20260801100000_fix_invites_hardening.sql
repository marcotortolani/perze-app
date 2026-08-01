-- E5/A14 (auditoría técnica) — `accept_invite` era débil en tres frentes:
-- (1) ignoraba `household_invites.email`: cualquiera con el código entraba
-- aunque la invitación fuera nominal; (2) `expires_at IS NULL` se aceptaba
-- como "no vence" — la tabla `invites` descartada
-- (`20260801050100_fix_duplicate_invites_table.sql`) tenía
-- `DEFAULT now() + 7 days` y se perdió al migrar a `household_invites`;
-- (3) el `CHECK` de `role` permitía `'owner'` y la policy `FOR ALL` con
-- `can_write` (que incluye `role = 'member'`) dejaba que cualquier miembro,
-- no solo un admin, generara invitaciones.

-- (3a) — nunca se invita como owner.
ALTER TABLE public.household_invites
  DROP CONSTRAINT household_invites_role_check,
  ADD CONSTRAINT household_invites_role_check CHECK (role IN ('admin', 'member', 'viewer'));

-- (2) — vigencia real. Backfill de filas existentes antes del NOT NULL:
-- las invitaciones ya emitidas sin `expires_at` se consideran vencidas
-- desde ya (no se puede saber cuánto tiempo llevan circulando), no se les
-- regala otros 7 días desde hoy.
UPDATE public.household_invites SET expires_at = created_at WHERE expires_at IS NULL;
ALTER TABLE public.household_invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days'),
  ALTER COLUMN expires_at SET NOT NULL;

-- (3b) — insert restringido a admin/owner. La policy `FOR ALL` original
-- combinaba INSERT/UPDATE/DELETE bajo `can_write` (member incluido); se
-- separa así el INSERT puede pedir un rol más alto sin tocar el UPDATE
-- (revocar sigue siendo cualquiera con `can_write`, sin cambios de alcance
-- acá — eso es tarea de F4 si hace falta).
DROP POLICY household_invites_write ON public.household_invites;

CREATE POLICY household_invites_insert ON public.household_invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = household_invites.household_id
      AND hm.profile_id = (SELECT auth.uid())
      AND hm.role IN ('owner', 'admin')
  )
);

CREATE POLICY household_invites_update ON public.household_invites FOR UPDATE
USING (household_id IN (SELECT public.current_households()) AND public.can_write(household_id))
WITH CHECK (household_id = (SELECT household_invites.household_id) AND public.can_write(household_id));

-- (1) — email nominal + vigencia real chequeados en la función, no solo en el WHERE del SELECT.
CREATE OR REPLACE FUNCTION public.accept_invite(invite_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.household_invites;
  v_uid uuid := (SELECT auth.uid());
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa';
  END IF;

  SELECT * INTO v_invite FROM public.household_invites
  WHERE code = invite_code
    AND accepted_by IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invitación inválida o vencida';
  END IF;

  IF v_invite.email IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    IF v_email IS NULL OR lower(v_email) <> lower(v_invite.email) THEN
      RAISE EXCEPTION 'Esta invitación es para otra cuenta';
    END IF;
  END IF;

  INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
  VALUES (v_invite.household_id, v_uid, v_invite.role, 'active', now())
  ON CONFLICT (household_id, profile_id) DO NOTHING;

  UPDATE public.household_invites SET accepted_by = v_uid WHERE id = v_invite.id;

  RETURN v_invite.household_id;
END;
$$;
