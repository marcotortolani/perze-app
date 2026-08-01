-- Bloque J (docs/plan-de-trabajo.md § 6.10, J3). `household_members_insert`
-- solo permite auto-insertarse (el creador del household, en A7) — invitar
-- a OTRA persona quedó explícitamente pendiente en
-- `20260801030100_household_insert_policies.sql` ("se resuelve con su
-- propia policy o una función SECURITY DEFINER cuando se construya"). Esta
-- migración es esa función.

CREATE TABLE public.invites (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households (id),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX invites_household_idx ON public.invites (household_id);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Solo miembros del household ven sus invitaciones (J1/J2/J3: quién está invitado).
CREATE POLICY invites_select ON public.invites FOR SELECT
USING (household_id IN (SELECT public.current_households()));

-- Solo un admin/owner puede invitar — `is_household_admin` ya existe
-- (20260801020400), pensada justo para este caso.
CREATE POLICY invites_insert ON public.invites FOR INSERT
WITH CHECK (public.is_household_admin(household_id) AND invited_by = (SELECT auth.uid()));

CREATE POLICY invites_update ON public.invites FOR UPDATE
USING (public.is_household_admin(household_id))
WITH CHECK (household_id = (SELECT invites.household_id));

-- SECURITY DEFINER porque quien acepta TODAVÍA no es miembro del
-- household — no puede pasar la policy normal de household_members_insert
-- (que solo permite auto-insertarse durante la creación del household en
-- A7). La función es el único lugar donde ese salto de confianza ocurre,
-- y valida todo a mano en vez de confiar en RLS.
CREATE FUNCTION public.accept_invite(invite_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.invites;
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa';
  END IF;

  SELECT * INTO v_invite FROM public.invites
  WHERE token = invite_token
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invitación inválida o vencida';
  END IF;

  INSERT INTO public.household_members (household_id, profile_id, role, status, joined_at)
  VALUES (v_invite.household_id, v_uid, v_invite.role, 'active', now())
  ON CONFLICT (household_id, profile_id) DO NOTHING;

  UPDATE public.invites SET accepted_at = now() WHERE id = v_invite.id;

  RETURN v_invite.household_id;
END;
$$;
