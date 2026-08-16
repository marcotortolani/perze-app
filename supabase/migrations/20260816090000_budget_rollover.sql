-- Auditoría de rollover de presupuesto — hoy `budgets` se resetea cada
-- período: lo que sobra o lo que se excede no se lleva al siguiente. Es la
-- razón número uno por la que alguien abandona un presupuesto tipo YNAB
-- (subgastar un mes no da ningún beneficio). Se resuelve opt-in, por
-- presupuesto, con DOS flags independientes — un household puede querer
-- arrastrar el sobrante de "salidas" pero no el exceso de "supermercado".
--
-- `rollover_since` ancla la fecha desde la que el arrastre empieza a
-- contar: activar cualquiera de los dos flags NO es retroactivo, así que
-- un presupuesto viejo que se prende hoy no hereda meses de historial que
-- el usuario nunca vio acumularse. Se pisa a `now()` (fecha local del
-- cliente, vía `todayIso()`) la primera vez que cualquiera de los dos
-- flags pasa de `false` a `true` — si ya tenía una, no se vuelve a tocar
-- (apagar y prender de nuevo no reinicia el ancla).
--
-- Sin `budget_periods` (ver el comentario de `20260801010900_budgets_goals.sql`):
-- el arrastre, igual que el gastado, se calcula on-the-fly desde
-- `transactions` en el cliente (`src/lib/analytics/budget-rollover.ts`),
-- iterando los períodos cerrados entre `rollover_since` y el actual. No
-- hace falta una policy RLS nueva: las políticas de `budgets` ya cubren la
-- fila entera (`budgets_select`/`budgets_insert`/`budgets_update`), no
-- columna por columna, y el trigger `budgets_immutable` solo protege
-- `household_id`/`created_by` — estas tres columnas quedan editables por
-- la misma vía que `amount_limit` o `category_id`.
ALTER TABLE public.budgets
  ADD COLUMN rollover_surplus boolean NOT NULL DEFAULT false,
  ADD COLUMN rollover_deficit boolean NOT NULL DEFAULT false,
  ADD COLUMN rollover_since date;
