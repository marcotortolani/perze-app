-- AC-14 (`docs/plan-sync-incremental.md`) — cursor del pull incremental de
-- `transactions`, la única tabla sincronizada sin cota de tamaño. Parcial:
-- las filas soft-deleted igual deben viajar (el delete de un dispositivo
-- tiene que llegar al resto), así que SIN filtro de `deleted_at` — la
-- policy `tx_select` (`20260801020000_fix_soft_delete_rls.sql`) ya no
-- filtra por `deleted_at`, así que RLS no bloquea el pull de una fila
-- borrada. Tercera columna `id` para paginar por keyset en vez de offset
-- (`pull.ts`): con filas entrando al conjunto mientras se pagina, un
-- offset puede saltear una fila que se corrió de página.
CREATE INDEX IF NOT EXISTS transactions_household_updated_idx
  ON public.transactions (household_id, updated_at, id);
