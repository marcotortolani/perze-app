-- Orden, columna y visibilidad de los bloques del dashboard, por perfil (no
-- por household: es una preferencia de la persona, y el requisito de
-- producto es que lo elegido en desktop se vea igual en mobile). `NULL` =
-- nunca personalizó, y es distinto de `'{}'`: "Restablecer" vuelve a `NULL`
-- en vez de congelar una copia de los defaults de hoy, así que un default
-- que cambie en una versión futura alcanza igual a quien nunca tocó nada.
ALTER TABLE public.profiles ADD COLUMN home_layout jsonb;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_home_layout_object
  CHECK (home_layout IS NULL OR jsonb_typeof(home_layout) = 'object');

COMMENT ON COLUMN public.profiles.home_layout IS
  '{ v, left[], right[], hidden[] } — ver src/features/home/layout/types.ts. Ids desconocidos se preservan a propósito (compat hacia adelante).';

-- Sin policy nueva: `profiles_update` (20260801010200_identity.sql) ya
-- cubre esta columna con USING + WITH CHECK sobre `id = (SELECT auth.uid())`,
-- y `protect_access_columns()` (20260801180000_access_control.sql) solo
-- vigila las columnas de acceso (is_app_admin/access_status/...), no esta.
