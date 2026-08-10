-- A4a — la fecha de nacimiento se puede dar exacta o solo como edad en
-- años. Con la edad, `birth_date` se guarda como el 1 de julio del año
-- calculado (punto medio del año: mínimo error para los rangos etarios de
-- `admin_metrics()`, que sigue leyendo `age(birth_date)` sin cambios) y
-- esta columna lo declara. Todo lo que dependa del DÍA —el banner de
-- cumpleaños del home, el recordatorio `birthdate`— tiene que ignorar las
-- filas con 'year': ese día no es un dato real.
ALTER TABLE public.profiles ADD COLUMN birth_date_precision text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_date_precision_check
  CHECK (birth_date_precision IN ('exact', 'year'));

-- Sin fecha no puede haber precisión: evita el estado imposible
-- ('year' sin `birth_date`) que haría creer que hay edad cargada.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_date_precision_pairing
  CHECK (birth_date_precision IS NULL OR birth_date IS NOT NULL);

COMMENT ON COLUMN public.profiles.birth_date_precision IS
  'exact = la persona dio el día real · year = solo dio su edad y birth_date es el 1 de julio sintético. NULL = sin fecha.';

-- Backfill: todo lo ya cargado vino del input type=date del perfil (exacto).
UPDATE public.profiles SET birth_date_precision = 'exact' WHERE birth_date IS NOT NULL;
