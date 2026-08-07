-- El operador podía aprobar/rechazar una solicitud nueva, pero no había
-- forma de cortarle el acceso a alguien YA aprobado — ni de revertirlo
-- después. `disabled` es un cuarto estado, distinto de `rejected`
-- (rechazo de una solicitud que nunca llegó a entrar) y de `pending`
-- (todavía nadie lo revisó): alguien que SÍ tenía acceso y se le corta a
-- propósito, reversible en cualquier momento por el mismo operador.
--
-- `protect_access_columns()` y el GUC `perze.access_admin_write` de
-- `20260801180000_access_control.sql` ya cubren esto sin cambios: siguen
-- siendo las únicas columnas protegidas, `admin_set_access_status()` sigue
-- siendo el único camino de escritura. `src/proxy.ts` ya redirige a
-- `/pending` para cualquier `access_status !== 'approved'`, así que
-- `disabled` cae ahí solo — el cambio de UI vive en `/pending`, no acá.
ALTER TABLE public.profiles DROP CONSTRAINT profiles_access_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_access_status_check
  CHECK (access_status IN ('pending', 'approved', 'rejected', 'disabled'));

CREATE OR REPLACE FUNCTION public.admin_set_access_status(target_id uuid, new_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Solo el operador de la instancia puede aprobar o rechazar accesos'
      USING ERRCODE = '42501';
  END IF;

  IF new_status NOT IN ('pending', 'approved', 'rejected', 'disabled') THEN
    RAISE EXCEPTION 'Estado de acceso inválido: %', new_status
      USING ERRCODE = '22023'; -- invalid_parameter_value
  END IF;

  IF target_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'El operador no puede cambiar su propio estado de acceso'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('perze.access_admin_write', 'true', true);
  UPDATE public.profiles
  SET access_status = new_status,
      access_reviewed_at = now(),
      access_reviewed_by = (SELECT auth.uid())
  WHERE id = target_id;
  PERFORM set_config('perze.access_admin_write', 'false', true);
END;
$$;
