-- AC-14 (`docs/plan-sync-incremental.md` § 6) — F3, opcional: Realtime para
-- latencia sub-segundo en `transactions`, con el pull incremental (F1/F2)
-- como red de seguridad para reconexiones y mensajes perdidos. Solo
-- `transactions` — es la única tabla sincronizada donde 30s de espera
-- importa (el resto son refresh completo, decenas-a-cientos de filas, y ya
-- se refrescan enteras en cada pull).
--
-- RLS: no hace falta una policy nueva. `postgres_changes` evalúa la policy
-- de SELECT de la tabla contra el rol que abrió el canal — `tx_select`
-- (`20260801020000_fix_soft_delete_rls.sql`) ya filtra por
-- `current_households()`, visibilidad y `can_see` de la cuenta, así que un
-- evento de una transacción fuera de alcance del suscriptor no le llega.
--
-- `REPLICA IDENTITY FULL`: por defecto Postgres solo manda la primary key
-- en el `old record` de un UPDATE/DELETE replicado — no alcanza para que
-- Realtime evalúe la policy de SELECT (que mira `household_id`,
-- `visibility`, `account_id`) contra la fila anterior. Sin esto, un
-- UPDATE que saca una transacción del alcance de un suscriptor (cambia de
-- household o de visibilidad) no dispara el evento de baja.
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
