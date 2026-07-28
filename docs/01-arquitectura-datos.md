# 01 — Arquitectura, stack y modelo de datos

---

## 1. Stack

### Confirmado por vos

| Capa | Elección | Notas para Next.js 16 |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Turbopack por defecto; `middleware.ts` → **`proxy.ts`**; `params`/`searchParams`/`cookies()`/`headers()` son **async**; `next lint` fue removido; `revalidateTag(tag, profile)` ahora pide perfil de `cacheLife`; `updateTag()` para read-your-writes en Server Actions |
| Lenguaje | **TypeScript strict** | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Estilos | **Tailwind CSS v4** | Config en CSS (`@theme`), tokens como CSS vars |
| Animación | **Motion** (`motion` — ex framer-motion) | + **React 19.2 View Transitions** para transiciones de ruta |
| Backend | **Supabase** | Postgres + Auth + Storage + Realtime + Edge Functions + pg_cron |
| UI base | **shadcn/ui** customizado | Con registry propio para tus componentes derivados |
| Distribución | **PWA** | Serwist |

### Recomendaciones adicionales

#### Estado y datos

- **TanStack Query v5** — server state, cache, mutaciones optimistas, reintentos. Es el corazón del comportamiento offline.
- **Zustand** — estado de UI efímero (scope activo, borrador de la transacción en curso, estado del keypad). Nada de Context para esto.
- **Dexie.js** (IndexedDB) — cola de mutaciones offline + cache local de las últimas N transacciones para arranque instantáneo.
  - Alternativa más ambiciosa si querés sync local-first de verdad: **PowerSync** o **ElectricSQL** (ambos con integración Supabase). Más potente, más complejidad. Sugerencia: arrancá con Dexie + TanStack Query; migrás si te duele.

#### Dinero y fechas

- **Dinero.js v2** o implementación propia con `bigint`. Nunca `number` para montos.
- **date-fns v4** (soporte de timezone) + **`@internationalized/date`** para los pickers.
- `Intl.NumberFormat` para formateo, siempre con la locale del usuario.

#### Formularios y validación

- **Zod v4** como fuente de verdad de los tipos (schema → tipo TS → validación cliente y servidor).
- **react-hook-form** solo donde haya formularios reales (ajustes, cuentas, instrumentos). La captura rápida no es un formulario, es una máquina de estados.
- **next-safe-action** para Server Actions tipadas con validación y manejo de errores uniforme.

#### Interacción

- **@use-gesture/react** — drag, swipe, scrub, pinch. Es lo que hace posible el input sin teclado.
- **Vaul** — bottom sheets con drag-to-dismiss (ya viene en shadcn como `Drawer`).
- **cmdk** — command palette (⌘K en desktop, búsqueda global en mobile).
- **Sonner** — toasts con acción de deshacer.
- **Lucide** — iconos. **Rive** o **Lottie** para las 3–4 micro-animaciones celebratorias (Rive pesa menos y es interactivo).
- **virtua** o **@tanstack/react-virtual** — listas largas de transacciones.

#### Gráficos

- **shadcn charts (Recharts)** para barras, líneas, áreas, donuts.
- **@visx/\*** o **nivo** para Sankey, treemap y calendar heatmap.
- Ver `02-design-system.md` para la paleta y reglas de color de datos.

#### Infra y calidad

- **Serwist** — service worker, precaching, runtime caching, offline fallback.
- **Vercel** para hosting + **Vercel Cron** o **Supabase pg_cron + Edge Functions** para snapshots diarios de FX y precios.
- **Biome** en vez de ESLint + Prettier (Next 16 sacó `next lint`; Biome es un solo binario y es rápido).
- **T3 Env** (`@t3-oss/env-nextjs`) — variables de entorno tipadas y validadas en build.
- **Vitest** (unit: motor de FX, cálculo de saldos, XIRR) + **Playwright** (e2e: flujo de captura, offline).
- **Sentry** o **PostHog self-hosted** — opt-in, apagado por defecto.
- **Supabase CLI** — migraciones versionadas en el repo, tipos generados (`supabase gen types typescript`).

#### Auth (fácil, rápida, segura)

- Supabase Auth con: **magic link** (sin password), **OAuth Google/Apple**, y **passkeys/WebAuthn** para reingreso instantáneo.
- **Bloqueo local de la app** con biometría del dispositivo (WebAuthn) o PIN de 4–6 dígitos usando el mismo keypad de la app. Sesión de Supabase larga + gate local.
- **Modo privacidad**: blur de todos los montos con un tap, para abrir la app en público.

---

## 2. Modelo de datos (Postgres / Supabase)

Convenciones:

- `id uuid` generado en el **cliente** (UUID v7) para idempotencia offline.
- **Montos**: `bigint` en unidades mínimas, sin excepción. **Cantidades y precios** de instrumentos: `numeric(38,12)`. **Rates**: `numeric(24,12)`. Un importe nunca es `numeric`; una cantidad nunca es `bigint`.
- **Códigos de moneda**: `text` en todas las tablas (nunca `char(3)` — no entra `USDT` y `char` padea con espacios). FK contra `currencies(code)`.
- **Entidades raíz** (las que cuelgan directo del household: `accounts`, `categories`, `tags`, `payees`, `transactions`, `budgets`, `goals`, `recurring_rules`, `debts`, `portfolios`, `instruments`, `settlements`): llevan `household_id`, `created_by`, `created_at`, `updated_at`, `deleted_at`. `archived_at` es distinto de `deleted_at`: archivar es del usuario, borrar es soft delete.
- **Entidades hijas** (`account_balance_snapshots`, `transaction_tags`, `transaction_splits`, `transaction_shares`, `budget_lines`, `debt_schedule`, `trades`, `price_snapshots`, `target_allocations`, `portfolio_snapshots`): **no** llevan `household_id`. Heredan el acceso vía la clave foránea al padre, con el patrón de RLS de § 3.
- RLS en **todas** las tablas, sin excepción. Las políticas van en la misma migración que la tabla.

### 2.1 Identidad y household

```sql
profiles (
  id uuid PK REFERENCES auth.users,
  display_name text, avatar_url text,
  locale text default 'es', timezone text,
  default_household_id uuid,
  settings jsonb default '{}'   -- tema, acento, intensidad de animación, modo privacidad
)

households (
  id uuid PK, name text,
  base_currency text NOT NULL,      -- moneda de reporte
  base_country char(2),
  period_start_day smallint default 1, -- día de cierre del mes (no todos cierran el 1)
  week_start smallint default 1,
  enabled_modules text[] default '{}', -- 'budgets','goals','recurring','debts','investments','family'
  settings jsonb default '{}',
  created_by uuid
)

household_members (
  household_id uuid, profile_id uuid,
  role text CHECK (role IN ('owner','admin','member','viewer')),
  display_name text, color text,
  joined_at timestamptz,
  PRIMARY KEY (household_id, profile_id)
)

household_invites (
  id uuid PK, household_id uuid, code text UNIQUE,
  email text, role text, expires_at timestamptz, accepted_by uuid
)
```

> El household existe **siempre**, incluso para un usuario solo. Así el módulo "familiar" se enciende sin migrar nada.

### 2.2 Referencias

```sql
currencies (
  code text PK,             -- 'USD','ARS','UYU','BTC','USDT'
  name text, symbol text,
  decimals smallint default 2,
  kind text CHECK (kind IN ('fiat','crypto')),
  is_active boolean
)

countries (code char(2) PK, name text, default_currency text, flag_emoji text)

institutions (            -- bancos, billeteras, brokers. Globales o del household.
  id uuid PK, household_id uuid NULL,   -- NULL = catálogo global sembrado
  name text, country_code char(2), kind text, logo_url text, color text
)
```

### 2.3 Cuentas

```sql
accounts (
  id uuid PK, household_id uuid, owner_id uuid,
  name text, kind text CHECK (kind IN (
    'cash','checking','savings','credit_card','wallet','broker','loan','receivable','other')),
  institution_id uuid NULL,
  country_code char(2), currency_code text,

  opening_balance bigint default 0, opening_date date,
  current_balance bigint default 0,       -- mantenido por trigger

  -- tarjetas de crédito
  credit_limit bigint NULL, statement_day smallint NULL, due_day smallint NULL,

  -- préstamos
  interest_rate numeric(8,4) NULL, term_months int NULL,

  include_in_net_worth boolean default true,
  visibility text CHECK (visibility IN ('private','household')) default 'household',
  color text, icon text, sort_order int, archived_at timestamptz
)

account_balance_snapshots (
  account_id uuid, as_of date, balance bigint,
  PRIMARY KEY (account_id, as_of)
)
```

### 2.4 Clasificación

```sql
categories (
  id uuid PK, household_id uuid, parent_id uuid NULL,
  name text, icon text, color text,
  kind text CHECK (kind IN ('expense','income')),
  nature text CHECK (nature IN ('fixed','variable','discretionary')) default 'variable',
  is_system boolean default false, sort_order int, archived_at timestamptz
)

tags (id uuid PK, household_id uuid, name text, color text)

payees (
  id uuid PK, household_id uuid, name text,
  default_category_id uuid, default_account_id uuid,
  logo_url text, aliases text[]
)
```

### 2.5 Transacciones — el corazón

```sql
transactions (
  id uuid PK,                               -- generado en el cliente (UUIDv7)
  household_id uuid, created_by uuid,

  kind text CHECK (kind IN ('expense','income','transfer','adjustment')),
  occurred_at timestamptz NOT NULL,

  account_id uuid NOT NULL,
  counter_account_id uuid NULL,             -- solo transfer

  amount bigint NOT NULL,                   -- unidades mínimas
  -- Signo: para expense/income/transfer, `amount` es SIEMPRE POSITIVO y el signo lo
  -- da `kind`. Para `adjustment` puede ser negativo (la conciliación baja el saldo).
  -- CHECK (kind = 'adjustment' OR amount > 0)
  currency_code text NOT NULL,

  -- conversión congelada a la moneda base del household.
  -- NULLABLE a propósito: ver "El estado needs_fx" más abajo. Nunca se cae a 1.
  fx_rate numeric(24,12) NULL,
  fx_source text CHECK (fx_source IN
    ('identity','api','manual','inherited','pending')) default 'identity',
  fx_provider text NULL,                    -- 'dolarapi','frankfurter','coingecko',...
  fx_quote_kind text NULL,                  -- 'oficial','blue','mep','ccl','custom'
  fx_resolved_at timestamptz NULL,          -- cuándo se congeló el rate
  amount_base bigint NULL,
  -- invariante: o están los dos, o no está ninguno
  CONSTRAINT fx_pair CHECK ((fx_rate IS NULL) = (amount_base IS NULL)),

  -- lado destino de una transferencia entre monedas distintas
  counter_amount bigint NULL,
  counter_currency_code text NULL,
  counter_fx_rate numeric(24,12) NULL,

  category_id uuid NULL, payee_id uuid NULL,
  note text, 
  attachments jsonb default '[]',           -- [{path, mime, size, thumb}]
  location jsonb NULL,                      -- {lat, lng, label}

  status text CHECK (status IN ('cleared','pending','scheduled','void')) default 'cleared',
  visibility text CHECK (visibility IN ('private','household')) default 'household',

  recurring_id uuid NULL,
  installment_group_id uuid NULL, installment_number int NULL, installment_total int NULL,

  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz NULL,
  client_rev int default 1,
  source text default 'manual'              -- 'manual','voice','import','recurring','rule'
)

transaction_tags (transaction_id uuid, tag_id uuid, PRIMARY KEY (transaction_id, tag_id))

transaction_splits (                        -- un gasto repartido entre varias categorías
  id uuid PK, transaction_id uuid,
  category_id uuid, amount bigint, amount_base bigint, note text
)

transaction_shares (                        -- reparto entre miembros del household
  id uuid PK, transaction_id uuid, member_id uuid,
  share_amount bigint, share_amount_base bigint,
  settled_at timestamptz NULL, settlement_id uuid NULL
)

settlements (                               -- liquidaciones entre personas
  id uuid PK, household_id uuid,
  from_member uuid, to_member uuid,
  amount bigint, currency_code text, settled_at timestamptz, transaction_id uuid NULL
)
```

**Índices críticos:**

```sql
CREATE INDEX ON transactions (household_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ON transactions (account_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ON transactions (household_id, category_id, occurred_at DESC) WHERE deleted_at IS NULL;
-- 'simple' y no 'spanish': la app es multi-idioma y un stemmer español rompe la
-- búsqueda de notas en inglés o portugués. Para acentos, unaccent en la query.
CREATE INDEX ON transactions USING gin (to_tsvector('simple', coalesce(note,'')));

-- los movimientos que esperan tipo de cambio: pocos, consultados seguido
CREATE INDEX ON transactions (household_id, occurred_at)
  WHERE fx_rate IS NULL AND deleted_at IS NULL;
```

### El estado `needs_fx`

El caso: cargás un gasto en una moneda que nunca cotizaste, **sin conexión**. No hay rate en cache, no hay forma de obtenerlo, y el usuario no tiene por qué saber cuál poner.

Las dos salidas malas son bloquear el guardado (el usuario pierde lo que cargó, que es la única cosa que la app no puede hacer nunca) y guardar con `fx_rate = 1` (corrompe el patrimonio de forma permanente, porque `amount_base` se congela y no se recalcula).

La salida correcta es **guardar el movimiento sin conversión**: `fx_rate` y `amount_base` en `NULL`, `fx_source = 'pending'`. La transacción existe, tiene su monto y su moneda originales —que es el dato verdadero—, y lo único que le falta es la traducción a moneda base.

Consecuencias que atraviesan toda la app y hay que implementar:

| Dónde | Qué tiene que pasar |
|---|---|
| Saldo de la cuenta | **No se afecta**: el saldo está en la moneda de la cuenta y no necesita conversión. Funciona normal. |
| Patrimonio neto y KPIs | Excluyen los pendientes y muestran un aviso con el conteo: "1 movimiento sin convertir". Nunca los cuentan como 0 ni como monto original. |
| Presupuestos | Igual: excluidos del consumido, con aviso en la pantalla del presupuesto afectado. |
| Analytics | Excluidos de todo agregado en moneda base, listados aparte. |
| Lista de movimientos | Badge propio en la fila, distinto del de "pendiente de sincronizar". Son dos cosas distintas y se confunden fácil. |
| Resolución | Al recuperar conexión se intenta automático. Si falla, entrada en el home: "Falta el tipo de cambio de N movimientos" → pantalla de resolución en lote. |

**Inmutabilidad del rate — la regla y su única excepción.** Un `fx_rate` ya resuelto no se recalcula nunca: es el que estaba vigente cuando ocurrió el movimiento. La única excepción es el rate `inherited` —el que se tomó de un cache viejo estando sin conexión—: al sincronizar, la app ofrece **una sola vez** reemplazarlo por el real del día del movimiento. Si el usuario dice que no, o si ya pasó esa ventana, queda congelado como cualquier otro. Fuera de esa ventana no hay ninguna vía para reescribir un rate.

### 2.6 Tipos de cambio

```sql
fx_rates (
  base text, quote text,
  as_of date,
  provider text, quote_kind text default 'default',
  rate numeric(24,12),
  bid numeric(24,12) NULL, ask numeric(24,12) NULL,
  fetched_at timestamptz,
  PRIMARY KEY (base, quote, as_of, provider, quote_kind)
)

household_fx_preferences (
  household_id uuid, currency_pair text,     -- 'ARS/USD'
  preferred_provider text, preferred_quote_kind text,
  PRIMARY KEY (household_id, currency_pair)
)
```

**Regla de oro:** el cliente **nunca** llama a la API externa. Un Route Handler `/api/fx` (o Edge Function) consulta la tabla; si no hay dato del día, va a la fuente, lo guarda y lo devuelve. Un cron diario precarga los pares que el household usa.

**Cadena de resolución, en orden estricto:**

1. Override manual del household para ese par → `fx_source = 'manual'`
2. Cotización del día en `fx_rates` → `'api'`
3. Último valor conocido, de cualquier fecha → `'inherited'`, con badge de antigüedad
4. Nada → **`'pending'`**: se guarda sin conversión (ver § 2.5, *El estado `needs_fx`*)

Nunca hay un paso 5 con `rate = 1`. Un `1` inventado es indistinguible de un `1` legítimo (una transacción en la propia moneda base) y contamina el patrimonio sin dejar rastro.

**Fuentes:**

| Fuente | Cubre | Key | Uso |
|---|---|---|---|
| [DolarApi](https://dolarapi.com/docs/) | AR, UY, CL, VE, MX, BO, BR, CO — oficial, blue, MEP, CCL, mayorista, paralelo | No | La clave para LatAm |
| [Frankfurter](https://frankfurter.dev/) | ~30 monedas del BCE, histórico | No | FX internacional y series históricas |
| [ArgentinaDatos](https://argentinadatos.com/) | Dólares, inflación, UVA, plazo fijo | No | Ajuste por inflación e IPC |
| CoinGecko | Crypto | Free tier | Crypto |
| open.er-api.com / exchangerate.host | Fallback general | Free tier | Respaldo |

### 2.7 Presupuestos, metas, recurrentes, deudas

```sql
budgets (
  id uuid PK, household_id uuid, name text,
  period text CHECK (period IN ('weekly','monthly','quarterly','yearly','custom')),
  start_date date, end_date date NULL,
  currency_code text, rollover boolean default false,
  scope text CHECK (scope IN ('household','personal')) default 'household',
  owner_id uuid NULL, is_active boolean default true
)
budget_lines (
  id uuid PK, budget_id uuid, category_id uuid NULL, tag_id uuid NULL,
  amount bigint, rollover_balance bigint default 0
)

goals (
  id uuid PK, household_id uuid, name text, icon text, color text,
  target_amount bigint, currency_code text, target_date date NULL,
  current_amount bigint default 0,
  linked_account_ids uuid[], contribution_strategy jsonb, archived_at timestamptz
)

recurring_rules (
  id uuid PK, household_id uuid, name text,
  template jsonb,                            -- transacción modelo
  rrule text,                                -- 'FREQ=MONTHLY;BYMONTHDAY=5'
  next_run_at timestamptz, last_run_at timestamptz, end_date date NULL,
  auto_post boolean default false,           -- crear sola o solo recordar
  detected boolean default false,            -- detectada automáticamente
  amount_history jsonb default '[]',         -- para avisar de aumentos
  is_active boolean default true
)

debts (
  id uuid PK, household_id uuid, account_id uuid NULL,
  kind text CHECK (kind IN ('installment_plan','loan','credit_line','personal')),
  name text, principal bigint, currency_code text,
  interest_rate numeric(8,4), term_months int,
  start_date date, counterpart text, direction text CHECK (direction IN ('owe','owed'))
)
debt_schedule (
  id uuid PK, debt_id uuid, due_date date, number int,
  principal_amount bigint, interest_amount bigint,
  paid_at timestamptz NULL, transaction_id uuid NULL
)
```

### 2.8 Inversiones (módulo opcional)

```sql
asset_classes (                              -- 100% editable por el usuario
  id uuid PK, household_id uuid NULL,        -- NULL = plantilla global
  name text, icon text, color text, sort_order int,
  default_risk text NULL
)
-- Semilla: Acciones, CEDEARs, Bonos soberanos, ONs, Letras, FCI,
--          Plazo fijo, Crypto, ETFs, Inmuebles, Efectivo, Otros

instruments (
  id uuid PK, household_id uuid NULL,        -- NULL = catálogo compartido
  symbol text, name text,
  asset_class_id uuid, currency_code text, country_code char(2),
  exchange text, isin text, cusip text,
  ratio numeric(12,6) NULL,                  -- CEDEAR: acciones subyacentes por CEDEAR
  underlying_symbol text NULL,
  price_provider text, provider_symbol text,
  -- renta fija
  maturity_date date NULL, coupon_rate numeric(8,4) NULL,
  coupon_frequency int NULL, amortization_schedule jsonb NULL, issuer text NULL,
  metadata jsonb default '{}', is_manual boolean default false
)

portfolios (
  id uuid PK, household_id uuid, name text,
  base_currency text, broker_account_id uuid NULL,
  visibility text default 'household'
)

trades (
  id uuid PK, portfolio_id uuid, instrument_id uuid, created_by uuid,
  kind text CHECK (kind IN (
    'buy','sell','dividend','coupon','amortization','interest',
    'split','merger','fee','tax','deposit','withdrawal','transfer_in','transfer_out','revaluation')),
  executed_at timestamptz,
  quantity numeric(38,12), price numeric(38,12), currency_code text,
  -- Importes en bigint (unidades mínimas), igual que en el resto del sistema.
  -- quantity y price son numeric porque son cantidades, no plata.
  fees bigint default 0, taxes bigint default 0,
  gross_amount bigint, net_amount bigint,
  settlement_account_id uuid NULL,           -- de qué cuenta salió/entró la plata
  fx_rate numeric(24,12), amount_base bigint,
  note text, created_at timestamptz, deleted_at timestamptz
)

price_snapshots (
  instrument_id uuid, as_of date, provider text,
  close numeric(38,12), currency_code text,
  open numeric(38,12) NULL, high numeric(38,12) NULL,
  low numeric(38,12) NULL, volume numeric(38,4) NULL,
  PRIMARY KEY (instrument_id, as_of, provider)
)

target_allocations (
  id uuid PK, portfolio_id uuid,
  dimension text CHECK (dimension IN ('asset_class','currency','country','instrument','sector')),
  key text, target_pct numeric(6,3), band_pct numeric(6,3) default 5
)

portfolio_snapshots (                        -- para TWR y gráficos históricos
  portfolio_id uuid, as_of date,
  market_value bigint, cost_basis bigint, cash_flow bigint,
  PRIMARY KEY (portfolio_id, as_of)
)
```

**Fuentes de precios:**

| Fuente | Cubre | Notas |
|---|---|---|
| [Data912](https://data912.apidocs.ar/) | Acciones AR, CEDEARs, bonos, ONs, letras | Comunitaria, gratuita, sin key. Buena para BYMA. |
| [BYMA APIs](https://www.byma.com.ar/en/byma-apis) | Mercado argentino oficial | Producto pago |
| CoinGecko | Crypto | Free tier generoso |
| Finnhub / Twelve Data / Alpha Vantage | Acciones y ETFs internacionales | Free tier con límite diario |
| **Manual** | Todo | Siempre disponible. Instrumentos ilíquidos, FCI, plazo fijo, inmuebles. |

El `price_provider` es una columna por instrumento, no un supuesto global. Y siempre se puede ingresar precio a mano — sin eso, no sirve para ONs poco líquidas ni para un departamento.

### 2.9 Sistema

```sql
rules (                                      -- auto-categorización
  id uuid PK, household_id uuid, name text, priority int,
  match jsonb,      -- {field:'note', op:'contains', value:'uber'}
  actions jsonb,    -- {category_id, tags, payee_id}
  is_active boolean, hit_count int default 0
)

insights (
  id uuid PK, household_id uuid, kind text, severity text,
  payload jsonb, period_start date, period_end date,
  dismissed_at timestamptz, created_at timestamptz
)

audit_log (
  id bigserial PK, household_id uuid, actor_id uuid,
  entity text, entity_id uuid, action text,
  diff jsonb, at timestamptz default now()
)
-- Retención: purga por pg_cron según AUDIT_RETENTION_MONTHS (default 12).
-- En self-host es variable de entorno: el que se auto-hospeda decide su storage.
-- Nunca se purgan las entradas de borrado ni de cambio de permisos: son
-- justamente las que se consultan tarde.

import_batches (
  id uuid PK, household_id uuid, filename text,
  mapping jsonb, row_count int, status text, created_at timestamptz
)
```

---

## 3. Row Level Security

### Helper

```sql
-- search_path = '' obligatorio: sin esto, un search_path manipulado puede
-- redirigir la consulta a una tabla falsa. Por eso todo va calificado.
CREATE OR REPLACE FUNCTION public.current_households()
RETURNS setof uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hm.household_id
  FROM public.household_members hm
  WHERE hm.profile_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_write(h uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = h
      AND hm.profile_id = (SELECT auth.uid())
      AND hm.role IN ('owner','admin','member')   -- viewer queda afuera
  );
$$;
```

### Patrón A — entidad raíz (tiene `household_id`)

```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tx_select ON transactions FOR SELECT USING (
  deleted_at IS NULL
  AND household_id IN (SELECT public.current_households())
  AND (visibility = 'household' OR created_by = (SELECT auth.uid()))
  -- una cuenta privada oculta sus transacciones aunque la transacción sea household
  AND EXISTS (
    SELECT 1 FROM accounts a WHERE a.id = transactions.account_id
      AND (a.visibility = 'household' OR a.owner_id = (SELECT auth.uid()))
  )
);

CREATE POLICY tx_insert ON transactions FOR INSERT WITH CHECK (
  public.can_write(household_id) AND created_by = (SELECT auth.uid())
);

-- USING filtra qué filas se pueden tocar; WITH CHECK valida la fila RESULTANTE.
-- Sin WITH CHECK, un miembro puede mover una fila a otro household o reescribir
-- created_by. Toda política de UPDATE lleva las dos cláusulas. Sin excepción.
CREATE POLICY tx_update ON transactions FOR UPDATE
USING (
  household_id IN (SELECT public.current_households())
  AND public.can_write(household_id)
  AND (created_by = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM household_members m
    WHERE m.household_id = transactions.household_id
      AND m.profile_id = (SELECT auth.uid()) AND m.role IN ('owner','admin')))
)
WITH CHECK (
  household_id IN (SELECT public.current_households())
  AND created_by = (SELECT transactions.created_by)   -- created_by es inmutable
);
```

`DELETE` no se expone: el borrado es un `UPDATE` que setea `deleted_at`.

### Patrón B — entidad hija (no tiene `household_id`)

Hereda el acceso del padre. Nunca duplica `household_id`.

```sql
ALTER TABLE transaction_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY splits_all ON transaction_splits FOR ALL
USING (EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.id = transaction_splits.transaction_id
    AND t.household_id IN (SELECT public.current_households())
    AND t.deleted_at IS NULL
))
WITH CHECK (EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.id = transaction_splits.transaction_id
    AND public.can_write(t.household_id)
));
```

Requiere índice en la FK al padre (`transaction_splits(transaction_id)`), si no la política escanea toda la tabla.

### Reglas transversales

- **Toda política de UPDATE lleva `USING` y `WITH CHECK`.** Es el error de RLS más común y el más caro.
- **Toda función es `SECURITY DEFINER` + `SET search_path = ''`** con los objetos calificados por esquema.
- `auth.uid()` siempre envuelto en `(SELECT auth.uid())`: el planner lo evalúa una vez en vez de por fila.
- El rol `viewer` no escribe nada, nunca.
- La `service_role` key **solo** en Edge Functions y cron. Jamás en el bundle del cliente.
- Cada política nace con su test. Sin test de RLS, la migración no se mergea.

---

## 4. Estrategia offline y sincronización

```text
UI (optimista)
  → TanStack Query mutation
     → Dexie: outbox (id, table, op, payload, client_rev, created_at, status)
        → si hay red: POST a Supabase
        → si no: queda encolada; Background Sync API reintenta
  ← Supabase Realtime empuja cambios de otros miembros → invalida queries
```

Reglas:

- **ID en el cliente**: reenviar la misma mutación no duplica (upsert por PK).
- **Resolución de conflictos**: last-write-wins por campo, comparando `updated_at`; si dos miembros tocan el mismo campo en un margen corto, se registra en `audit_log` y se muestra un aviso no bloqueante.
- **Precarga**: al abrir, se hidrata desde Dexie (arranque instantáneo) y se revalida en background.
- **Indicador de sync** siempre visible pero discreto: `<SyncDot>` en el header. Los tres estados canónicos están definidos en `02-design-system.md` § 6.
- **Serwist**: precache del app shell, `NetworkFirst` para datos, `CacheFirst` para assets, página de fallback offline.

---

## 5. Estructura de carpetas propuesta

```text
docs/                  ← estos 6 documentos, versionados con el código
  00-producto.md
  01-arquitectura-datos.md
  02-design-system.md
  03-prompts-wireframes.md
  04-prompts-ui.md
  05-prompts-desarrollo.md
CLAUDE.md              ← memoria de proyecto (ver 05 § PROMPT C0)
src/
  app/
    (auth)/            login, callback
    (onboarding)/      pasos del setup inicial
    (app)/
      layout.tsx       shell con tab bar + FAB + scope switcher
      page.tsx         home
      add/             captura rápida (route intercepted → modal)
      transactions/
      accounts/
      budgets/
      goals/
      analytics/
      investments/
      household/
      settings/
    api/
      fx/route.ts
      prices/route.ts
      cron/            snapshots diarios
  components/
    ui/                shadcn base
    money/             AmountDisplay, Keypad, CurrencyChip, FxEditor, AmountScrubber
    charts/            wrappers con los tokens del design system
    motion/            primitivas: SpringSheet, CountUp, MorphButton, SharedCard
    domain/            TransactionRow, AccountCard, CategoryBubble, BudgetRing
  lib/
    supabase/          client, server, types generados
    money/             bigint math, formateo, conversión FX
    fx/                providers + cache
    analytics/         cálculos: net worth, XIRR, TWR, presupuestos
    offline/           dexie, outbox, sync
    validation/        schemas Zod
  stores/              zustand
  hooks/
  i18n/                es, en, pt
supabase/
  migrations/
  functions/           edge functions
  seed/                monedas, países, categorías, instituciones, clases de activo
```

---

## 6. Cálculos que conviene aislar y testear

Estos son los que se rompen silenciosamente. Todos en `lib/analytics/`, todos con tests de Vitest:

| Cálculo | Cuidado con |
|---|---|
| Saldo de cuenta | Transferencias contadas dos veces; transacciones `pending`; redondeo |
| Patrimonio neto multi-moneda | Qué rate se usa (histórico vs. actual); pasivos con signo |
| Presupuesto consumido | Reembolsos, splits, rollover, período que no empieza el día 1 |
| Safe to spend | Recurrentes futuros del período aún no posteados |
| Efecto FX | Descomposición `Δ = flujo + retorno + FX` tiene que cerrar exacto |
| XIRR / MWR | Convergencia con flujos irregulares; casos sin solución |
| TWR | Sub-períodos entre cada flujo de caja |
| Ajuste por inflación | Índice base, meses faltantes, interpolación |
| Amortización de bonos | Cupones, amortizaciones parciales, precio limpio vs. sucio |
| Ratio de CEDEAR | Conversión a subyacente, splits corporativos |
