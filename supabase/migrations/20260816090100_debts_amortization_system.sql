-- Auditoría de amortización de deudas — hoy toda deuda se reparte en
-- cuotas iguales de capital con interés siempre cero, sin importar la
-- tasa cargada en `interest_rate` (el propio comentario de
-- `installment-schedule.ts` lo admitía). `debt_schedule` ya separa
-- `principal_amount`/`interest_amount` por cuota — lo que faltaba era
-- una columna que diga con qué sistema se generó el cronograma, para
-- poder regenerarlo igual al editar.
--
-- El default es `'none'` — una deuda nace igual que hoy (cuotas parejas,
-- sin interés) porque es el caso más común y no hay que pedirle
-- tecnicismos a un usuario amateur.
ALTER TABLE public.debts
  ADD COLUMN amortization_system text NOT NULL DEFAULT 'none';

ALTER TABLE public.debts
  ADD CONSTRAINT debts_amortization_system_check
  CHECK (amortization_system IN ('none', 'french', 'german'));
