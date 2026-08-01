-- C10/C11 (auditoría técnica) — `client_rev` solo existía en `transactions`;
-- el resto de las tablas editables por más de un miembro del household
-- (accounts, categories, tags, payees, budgets, goals, recurring_rules,
-- rules, households) no tenían columna donde comparar la revisión del
-- cliente contra la del servidor, así que `conflictSensitive` nunca podía
-- activarse ahí — dos miembros editando la misma cuenta se pisaban en
-- silencio con "el último que sincroniza gana".
ALTER TABLE public.accounts ADD COLUMN client_rev integer NOT NULL DEFAULT 1;
ALTER TABLE public.categories ADD COLUMN client_rev integer NOT NULL DEFAULT 1;
ALTER TABLE public.tags ADD COLUMN client_rev integer NOT NULL DEFAULT 1;
ALTER TABLE public.payees ADD COLUMN client_rev integer NOT NULL DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN client_rev integer NOT NULL DEFAULT 1;
ALTER TABLE public.goals ADD COLUMN client_rev integer NOT NULL DEFAULT 1;
ALTER TABLE public.recurring_rules ADD COLUMN client_rev integer NOT NULL DEFAULT 1;
ALTER TABLE public.rules ADD COLUMN client_rev integer NOT NULL DEFAULT 1;
ALTER TABLE public.households ADD COLUMN client_rev integer NOT NULL DEFAULT 1;
