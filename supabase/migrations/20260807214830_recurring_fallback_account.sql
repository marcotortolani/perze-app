-- Cuenta de respaldo para recurrentes manuales: si la cuenta principal no
-- tiene fondos el día que se hace "Cargar ahora", el movimiento se registra
-- acá en vez de dejar la principal en negativo. Solo lo consume el cliente
-- (`chargeRecurringNow`) — el motor automático (`materialize_recurring_transactions()`)
-- no la mira, porque sin usuario presente no hay a quién avisarle que la
-- plata salió de otro lado.

ALTER TABLE public.recurring_rules
  ADD COLUMN fallback_account_id uuid REFERENCES public.accounts(id);

ALTER TABLE public.recurring_rules
  ADD CONSTRAINT recurring_rules_fallback_differs
    CHECK (fallback_account_id IS NULL OR fallback_account_id <> account_id);
