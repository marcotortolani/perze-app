-- A5 (auditoría técnica) — el idioma `household_id = (SELECT
-- <tabla>.household_id)` dentro de un `WITH CHECK` no compara contra la
-- fila VIEJA (no hay `OLD` en RLS): ambas referencias son a la fila NUEVA,
-- así que la expresión es siempre `TRUE`. Presente en ~18 policies de
-- UPDATE en 12 archivos — verificado con
-- `grep "= (SELECT [a-z_]*\.\(household_id\|created_by\)"`. Un usuario
-- miembro de dos households puede hoy reasignar cuentas, transacciones,
-- presupuestos, deudas, trades y overrides entre ellos, y falsificar
-- `created_by` en cualquier fila — el test pgTAP `10_accounts_rls.sql`
-- pasaba por la razón equivocada (lo rechaza la policy de SELECT al no
-- encontrar la fila en el household de destino, nunca el WITH CHECK).
--
-- Fix: trigger genérico `BEFORE UPDATE` que compara `OLD`/`NEW` de verdad
-- — lo único que un `WITH CHECK` no puede hacer. Se deja el WITH CHECK
-- tautológico existente tal cual (es inofensivo, siempre true) para no
-- tener que tocar 18 `ALTER POLICY` más en esta pasada; el trigger es la
-- capa que de verdad protege.
CREATE FUNCTION public.enforce_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW) ->> col) IS DISTINCT FROM (to_jsonb(OLD) ->> col) THEN
      RAISE EXCEPTION 'La columna % es inmutable en %', col, TG_TABLE_NAME
        USING ERRCODE = '23514'; -- check_violation, mismo código que un CHECK real
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- household_id + created_by: entidades raíz con ambas columnas.
CREATE TRIGGER accounts_immutable BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

CREATE TRIGGER categories_immutable BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

CREATE TRIGGER transactions_immutable BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

CREATE TRIGGER budgets_immutable BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

CREATE TRIGGER goals_immutable BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

CREATE TRIGGER recurring_rules_immutable BEFORE UPDATE ON public.recurring_rules
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

CREATE TRIGGER debts_immutable BEFORE UPDATE ON public.debts
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

CREATE TRIGGER portfolios_immutable BEFORE UPDATE ON public.portfolios
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

CREATE TRIGGER settlements_immutable BEFORE UPDATE ON public.settlements
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

CREATE TRIGGER rules_immutable BEFORE UPDATE ON public.rules
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'created_by');

-- Solo household_id: sin created_by (tags/payees/institutions/asset_classes/
-- instruments son Patrón C con clonado, o no llevan autor) o generadas por
-- el sistema (insights).
CREATE TRIGGER fx_overrides_immutable BEFORE UPDATE ON public.fx_overrides
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

CREATE TRIGGER household_invites_immutable BEFORE UPDATE ON public.household_invites
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

CREATE TRIGGER household_fx_preferences_immutable BEFORE UPDATE ON public.household_fx_preferences
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

CREATE TRIGGER tags_immutable BEFORE UPDATE ON public.tags
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

CREATE TRIGGER payees_immutable BEFORE UPDATE ON public.payees
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

-- institutions/asset_classes/instruments: household_id IS NOT NULL en el
-- INSERT del clon (Patrón C), pero una vez clonado nunca cambia — el
-- trigger solo corre en UPDATE, así que el INSERT del clon no lo pisa.
CREATE TRIGGER institutions_immutable BEFORE UPDATE ON public.institutions
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

CREATE TRIGGER asset_classes_immutable BEFORE UPDATE ON public.asset_classes
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

CREATE TRIGGER instruments_immutable BEFORE UPDATE ON public.instruments
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

CREATE TRIGGER insights_immutable BEFORE UPDATE ON public.insights
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

CREATE TRIGGER import_batches_immutable BEFORE UPDATE ON public.import_batches
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id');

CREATE TRIGGER household_members_immutable BEFORE UPDATE ON public.household_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_columns('household_id', 'profile_id');

-- A13 — `household_members_update` no restringía `role` ni `profile_id`
-- (su WITH CHECK es la misma tautología de arriba): un `admin` podía
-- `SET role='owner'` sobre sí mismo, o degradar al owner real sin que
-- nada lo impida. Trigger dedicado, más específico que la inmutabilidad
-- genérica: solo un `owner` puede tocar `role` hacia o desde `'owner'`, y
-- nunca se puede degradar al último owner del household (dejaría el
-- household sin nadie que pueda re-promover a nadie).
CREATE FUNCTION public.enforce_household_role_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_is_owner boolean;
  v_owner_count int;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.household_members m
    WHERE m.household_id = OLD.household_id
      AND m.profile_id = (SELECT auth.uid())
      AND m.role = 'owner'
  ) INTO v_caller_is_owner;

  IF (OLD.role = 'owner' OR NEW.role = 'owner') AND NOT v_caller_is_owner THEN
    RAISE EXCEPTION 'Solo un owner puede otorgar o quitar el rol de owner'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.household_members
    WHERE household_id = OLD.household_id AND role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'No se puede degradar al último owner del household'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER household_members_role_change BEFORE UPDATE ON public.household_members
FOR EACH ROW
WHEN (NEW.role IS DISTINCT FROM OLD.role)
EXECUTE FUNCTION public.enforce_household_role_changes();

REVOKE EXECUTE ON FUNCTION public.enforce_household_role_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_immutable_columns() FROM PUBLIC, anon, authenticated;
