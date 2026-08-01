-- Bloque F+G (docs/plan-de-trabajo.md § 6.9). Decisiones de schema tomadas
-- en su momento para no bloquear el bloque en una pregunta abierta:
--
-- 1. Presupuestos NO llevan un `budget_periods` separado: el gastado real
--    de cada período se calcula on-the-fly desde `transactions` (mismo
--    patrón que el patrimonio neto o el estado del mes de Home), no se
--    persiste. Sin eso, no hay tabla que mantener sincronizada ni
--    reconciliar — el período del household (`period_start_day`) ya es la
--    única fuente de verdad para "qué período es ahora".
-- 2. Metas NO llevan `goal_contributions` ni `goal_accounts`: una meta
--    apunta a UNA cuenta (`account_id`), y el progreso es el saldo de esa
--    cuenta. Igual que arriba: menos estado que reconciliar, cero tablas
--    nuevas de las que CLAUDE.md marcaba como huecos sin resolver.
-- 3. Recurrentes: `recurring_rules` es la plantilla; `transactions.recurring_id`
--    (ya existe en el schema) es el vínculo hacia adelante cuando una
--    transacción real corresponde a la regla.
--
-- A2 (auditoría técnica) — `budgets`/`goals`/`recurring_rules` (v2, lo que
-- describen los tres puntos de arriba) vivían acá con un `CREATE TABLE`
-- que colisionaba con la v1 de `20260801010900_budgets_goals.sql`/
-- `20260801011000_recurring_debts.sql` (ninguna cadena desde cero podía
-- terminar de aplicar). Las tres tablas se movieron a esas dos migraciones
-- directamente como v2 — este archivo queda solo con el `ALTER TABLE`
-- que de verdad era nuevo acá.

-- `transactions.recurring_id` ya existe (01-arquitectura-datos.md § 7) pero
-- nunca tuvo FK real porque `recurring_rules` no existía todavía.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_recurring_id_fkey FOREIGN KEY (recurring_id) REFERENCES public.recurring_rules (id);
