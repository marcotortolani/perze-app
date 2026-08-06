-- Excepción puntual y documentada al Patrón C puro de `currencies`
-- (`20260801010100_reference.sql`: "nadie edita una moneda... escritura
-- solo por seeds y cron"). El catálogo sembrado cubre el Cono Sur + USD/
-- EUR + la cobertura de Frankfurter, pero no tiene ninguna fila
-- `kind='crypto'` — y no hay forma de que un usuario agregue una moneda
-- que necesita (cripto, o cualquier fiat fuera de la cobertura) sin pasar
-- por una migración nueva. Mismo motivo por el que existe `purge_household`
-- como excepción a "nunca DELETE por RLS": acá el permiso real se valida
-- adentro de la función `SECURITY DEFINER`, no con una policy de INSERT
-- abierta — cualquier autenticado puede agregar una fila al catálogo
-- global, pero solo con datos que pasan validación de forma, y nunca
-- puede pisar una fila existente (`ON CONFLICT DO NOTHING` + devolver la
-- que ya había, para que el caller no necesite distinguir "la creé" de
-- "ya existía").

CREATE OR REPLACE FUNCTION public.add_currency(p_code text, p_name text, p_symbol text, p_decimals smallint, p_kind text)
RETURNS public.currencies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.currencies;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa';
  END IF;
  IF p_code IS NULL OR p_code !~ '^[A-Z0-9]{2,10}$' THEN
    RAISE EXCEPTION 'Código de moneda inválido';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Falta el nombre de la moneda';
  END IF;
  IF p_symbol IS NULL OR length(trim(p_symbol)) = 0 THEN
    RAISE EXCEPTION 'Falta el símbolo de la moneda';
  END IF;
  IF p_kind NOT IN ('fiat', 'crypto') THEN
    RAISE EXCEPTION 'kind inválido';
  END IF;
  IF p_decimals IS NULL OR p_decimals < 0 OR p_decimals > 18 THEN
    RAISE EXCEPTION 'decimals inválido';
  END IF;

  INSERT INTO public.currencies (code, name, symbol, decimals, kind, is_active)
  VALUES (p_code, trim(p_name), trim(p_symbol), p_decimals, p_kind, true)
  ON CONFLICT (code) DO NOTHING;

  SELECT * INTO v_row FROM public.currencies WHERE code = p_code;
  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_currency(text, text, text, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_currency(text, text, text, smallint, text) TO authenticated;
