-- F1 — saneo del remoto tras desplegar el fix de serialización de rates (A1).
--
-- IMPORTANTE: correr esto DESPUÉS de que el fix de sync-config.ts (formatRate
-- en vez de bigintToString) esté desplegado, nunca antes — si se corre antes,
-- las filas se vuelven a corromper apenas el próximo enqueue viejo sincronice.
--
-- Ejecutar con service_role (nunca desde el cliente/anon key), vía
-- `supabase db execute` o el SQL Editor del dashboard, contra el proyecto
-- perze-app (ref dhnyihwcsexraivhokoc). No se corre solo — es una acción
-- manual sobre datos reales.

-- ============================================================
-- 1. A1 — rates que subieron multiplicados por 10^12
-- ============================================================

-- Diagnóstico primero: ningún rate legítimo supera 10^6 (ver CLAUDE.md,
-- ningún par de monedas del mundo tiene una cotización de ese orden).
SELECT id, fx_rate, original_rate, counter_fx_rate
FROM public.transactions
WHERE fx_rate > 1000000 OR original_rate > 1000000 OR counter_fx_rate > 1000000;

-- Si la query anterior devuelve filas, corregir dividiendo por 10^12 SOLO
-- las columnas afectadas de esas filas puntuales — esto es saneo de un
-- valor corrupto, no un recálculo de un rate legítimo, así que no viola la
-- regla de congelamiento (`CLAUDE.md`, "el rate se congela").
BEGIN;

UPDATE public.transactions
SET fx_rate = fx_rate / 1000000000000
WHERE fx_rate > 1000000;

UPDATE public.transactions
SET original_rate = original_rate / 1000000000000
WHERE original_rate > 1000000;

UPDATE public.transactions
SET counter_fx_rate = counter_fx_rate / 1000000000000
WHERE counter_fx_rate > 1000000;

-- Verificar antes de COMMIT: no debería quedar ninguna fila por encima de 10^6.
SELECT count(*) AS remaining_corrupt
FROM public.transactions
WHERE fx_rate > 1000000 OR original_rate > 1000000 OR counter_fx_rate > 1000000;

-- Revisar el resultado de la query de arriba (debe ser 0) antes de:
-- COMMIT;
-- Si algo se ve mal, ROLLBACK; y avisar antes de reintentar.

-- ============================================================
-- 2. B3 — escrituras con el usuario demo (diagnóstico, no destructivo)
-- ============================================================

-- Si RLS funcionó, esto debería devolver 0 en ambos casos — el daño real
-- está en los outbox LOCALES de cada dispositivo (fuera del alcance de
-- este script; se resuelve en F2 con signOut()/limpieza del outbox).
SELECT count(*) AS demo_transactions
FROM public.transactions
WHERE created_by = '018f2f7a-0000-7000-8000-000000000001';

SELECT count(*) AS demo_households
FROM public.households
WHERE created_by = '018f2f7a-0000-7000-8000-000000000001';

-- ============================================================
-- 3. B6/B7 — households duplicados o sin owner (diagnóstico)
-- ============================================================

SELECT h.id, h.name, h.created_by, h.created_at
FROM public.households h
LEFT JOIN public.household_members m ON m.household_id = h.id AND m.role = 'owner'
WHERE m.household_id IS NULL;

SELECT created_by, count(*) AS household_count
FROM public.households
GROUP BY created_by
HAVING count(*) > 1;
