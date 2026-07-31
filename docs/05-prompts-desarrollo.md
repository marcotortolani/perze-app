# 05 — Prompts de desarrollo

Prompts para Claude Code, en orden. Cada uno asume que los anteriores están hechos y mergeados.

**Antes de empezar**: creá un `CLAUDE.md` en la raíz del repo con el contenido del `PROMPT C0`. Es memoria de proyecto — se lee en cada sesión y evita repetir contexto.

---

## PROMPT C0 — `CLAUDE.md` del proyecto

```md
# PERZE — Contexto del proyecto

App PWA de finanzas personales: gastos, cuentas, presupuestos e inversiones, con
soporte multi-cuenta, multi-moneda y multi-país, y modo de grupo familiar.
Proyecto personal que se va a liberar como open source.

## Stack
- Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4
- shadcn/ui customizado · Motion (`motion`) · Lucide
- Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- TanStack Query v5 · Zustand · Dexie (offline queue) · Zod v4
- Serwist (PWA) · Biome (lint+format) · Vitest + Playwright

## Reglas de código no negociables
- **Dinero**: `bigint` en unidades mínimas. NUNCA `number`, `float` ni `parseFloat`
  para montos. Todo cálculo de dinero pasa por `lib/money`.
- **Formateo**: ningún componente formatea plata a mano. Solo `<Amount>`.
- **IDs**: se generan en el cliente (UUID v7) antes de la mutación. Idempotencia.
- **Mutaciones**: siempre optimistas, siempre pasan por el outbox de Dexie.
- **FX**: el cliente NUNCA llama a una API de cotización. Solo a `/api/fx`.
- **RLS**: toda tabla nueva nace con RLS habilitado y sus políticas en la misma
  migración. Ninguna consulta confía en filtrar por `household_id` del lado cliente.
- **`service_role`**: solo en Edge Functions y cron. Jamás en el bundle.
- **i18n**: cero strings hardcodeadas. Todo por `next-intl`.
- **Módulos opcionales**: antes de renderizar cualquier cosa de un módulo, chequear
  `household.enabled_modules`. Si está apagado, no se importa ni el código.

## Gotchas de Next.js 16
- `middleware.ts` → `proxy.ts` (runtime Node)
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` son **async**
- `revalidateTag(tag, profile)` requiere perfil de `cacheLife`; `updateTag()` en
  Server Actions para read-your-writes
- Turbopack es el bundler por defecto
- Todo slot de ruta paralela necesita su `default.js` explícito
- No existe `next lint` — usamos Biome

## Reglas de diseño (ver `docs/02-design-system.md`)
- Minimalista: ~90% neutros. Color solo cuando significa algo.
- Presupuesto por pantalla: 1 cifra héroe · 1 color de marca fuera de los gráficos ·
  1 acción primaria · 3 niveles tipográficos · 5 elementos interactivos sobre el
  pliegue · 0 bordes de caja evitables · 0 iconos decorativos.
- Sin `<select>` nativo. Sin `<input type="number">` para montos.
- Ningún target < 44x44. Primario de 56-64px en los últimos 200px de la pantalla.
- Ninguna transición de interfaz > 320ms. Cuatro excepciones no bloqueantes:
  count-up 400ms, secuencia de guardado ≤700ms, celebración 900ms, dibujado de
  línea en gráficos 600ms.
- `prefers-reduced-motion` respetado + ajuste propio de intensidad.
- Gastos en texto neutro; solo los ingresos se destacan en aqua. Nunca verde/rojo
  como polaridad de dinero.

## Estructura
Ver `docs/01-arquitectura-datos.md` § 5.

## Comandos
`pnpm dev` · `pnpm build` · `pnpm test` · `pnpm e2e` · `pnpm check` (Biome) ·
`pnpm db:types` (regenerar tipos de Supabase) · `pnpm db:push`
```

---

## PROMPT C1 — Setup del proyecto

```
Inicializá el proyecto PERZE.

1. `create-next-app` con Next.js 16, TypeScript, Tailwind v4, App Router, pnpm.
2. `tsconfig.json` en strict real: `strict`, `noUncheckedIndexedAccess`,
   `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`.
3. Biome configurado como lint + format (no ESLint, no Prettier). Hook de pre-commit
   con lefthook.
4. shadcn/ui inicializado, con el theme apuntando a nuestros tokens (no a los
   defaults de shadcn).
5. Supabase **SIN Docker**: se trabaja contra un proyecto remoto de desarrollo.
   `supabase link` al proyecto, `supabase/migrations/` versionado, y los scripts
   `db:push` (`supabase db push --linked`) y `db:types`
   (`supabase gen types typescript --linked`). NO uses `supabase start`,
   `supabase db reset` ni `supabase db diff` sin `--linked`: los tres necesitan
   Docker. Las migraciones se escriben a mano desde `docs/01-arquitectura-datos.md`,
   que ya tiene el schema completo — no hace falta generarlas por diff.
6. Variables de entorno tipadas con `@t3-oss/env-nextjs` + `.env.example` completo.
7. Vitest (unit) y Playwright (e2e, con el Chromium ya instalado del sistema).
8. La estructura de carpetas de `docs/01-arquitectura-datos.md` § 5, con un
   `index.ts` de barril donde tenga sentido.
9. `next.config.ts`:
    - `cacheComponents: true` (nivel raíz)
    - `experimental.turbopackFileSystemCacheForDev: true`
    - `experimental.viewTransition: true` — lo necesita `<ViewTransition>` de
      React 19.2, que usamos para las transiciones de ruta
    - `images.remotePatterns` (no `images.domains`, está deprecado)
10. `proxy.ts` (no `middleware.ts`) con el refresh de sesión de Supabase.
11. Tailwind v4: recordá que `darkMode: 'class'` ya no existe en config JS. El
    modo oscuro se declara en CSS con
    `@custom-variant dark (&:where(.dark, .dark *));`

Al terminar: `pnpm build` tiene que pasar limpio y `pnpm check` sin warnings.
```

---

## PROMPT C2 — Schema y RLS

```
Implementá el schema completo de `docs/01-arquitectura-datos.md` § 2 como migraciones
de Supabase.

**Cada migración incluye su propio `ENABLE ROW LEVEL SECURITY` y sus políticas.** No hay una migración de RLS al final: una tabla sin políticas nunca existe, ni por un commit.

Orden de migraciones (una por archivo, en este orden):
1. `extensions` — uuid-ossp, pgcrypto, pg_cron
2. `reference` — currencies, countries, institutions + seed de LatAm (AR, UY, CL,
   BR, MX, ES, US) con sus monedas y bancos/billeteras principales
3. `identity` — profiles, households, household_members, household_invites + el
   trigger que crea el profile y un household al registrarse
4. `accounts` — accounts, account_balance_snapshots + trigger de `current_balance`
5. `classification` — categories, tags, payees + seed de las plantillas de
   categorías (Básica de 8, Completa de 20) en ES/EN/PT
6. `transactions` — transactions, transaction_tags, transaction_splits,
   transaction_shares, settlements + índices
7. `fx` — fx_rates, household_fx_preferences
8. `budgets_goals` — budgets, budget_lines, goals
9. `recurring_debts` — recurring_rules, debts, debt_schedule
10. `investments` — asset_classes, instruments, portfolios, trades, price_snapshots,
    target_allocations, portfolio_snapshots + seed de clases de activo
11. `system` — rules, insights, audit_log, import_batches

La migración 0 (antes de `reference`) crea los helpers `current_households()` y
`can_write()` de `docs/01-arquitectura-datos.md` § 3, porque todas las políticas
posteriores dependen de ellos.

Requisitos:
- Cada tabla nace con RLS habilitado y sus políticas en la misma migración.
- Toda función `SECURITY DEFINER` lleva `SET search_path = ''` y objetos calificados
  por esquema.
- **Toda política de UPDATE lleva `USING` Y `WITH CHECK`.** Sin `WITH CHECK`, un
  miembro puede mover una fila a otro household.
- `auth.uid()` siempre envuelto en `(SELECT auth.uid())`.
- Respetá `visibility` (private/household) en el SELECT de accounts y transactions:
  una cuenta privada oculta sus transacciones.
- Las tablas hijas (sin `household_id`) usan el patrón B de § 3: `EXISTS` contra el
  padre, con índice en la FK.
- El rol `viewer` no puede escribir nada.
- Importes en `bigint`; cantidades y precios en `numeric(38,12)`; rates en
  `numeric(24,12)`; códigos de moneda en `text` (nunca `char(3)`).
- Entidades raíz: `created_at`, `updated_at`, `deleted_at`, `created_by`,
  `household_id`. `archived_at` es distinto de `deleted_at`.
- Trigger de `updated_at` en toda entidad raíz.
- Trigger de `audit_log` en transactions, accounts y household_members.
- Soft delete: `deleted_at`, y las políticas de SELECT lo filtran. `DELETE` no se
  expone al cliente.

Escribí también tests de RLS con Vitest: un usuario de un household NO puede leer ni
escribir datos de otro, y una transacción privada no la ve el otro miembro. Estos
tests son obligatorios: sin ellos la migración no se mergea.

Al final, generá los tipos TypeScript y verificá que compilen.
```

---

## PROMPT C3 — Capa de dinero y FX

```
Implementá `lib/money` y `lib/fx`. Es el núcleo del que depende toda la corrección
de la app, así que va con cobertura de tests alta.

`lib/money`:
- Tipo `Money = { amount: bigint; currency: CurrencyCode }`
- Constructores desde string del usuario ("1.250,50" y "1,250.50" según locale),
  desde bigint, desde la base de datos
- Operaciones: add, subtract, multiply por escalar, divide, negate, abs, compare.
  Todas fallan en compilación o en runtime si las monedas no coinciden.
- Redondeo bancario explícito donde haga falta, nunca implícito
- Formateo con `Intl.NumberFormat`, respetando decimales por moneda (2 para fiat,
  hasta 8 para crypto), con variantes: completo, compacto (1,2 M), sin símbolo
- Parseo de expresiones aritméticas del keypad ("1200+350*2")

`lib/fx`:
- `convert(money, toCurrency, rate)` que devuelve el resultado Y el rate usado
- Resolución de rate en orden estricto: override manual del household > cotización
  del día > último valor conocido (`isStale: true`) > **`pending`**.
  NUNCA cae a rate = 1: `amount_base` se congela y no se recalcula, así que un
  ARS→USD guardado a 1 corrompe el patrimonio para siempre. Y un `1` inventado es
  indistinguible de un `1` legítimo.
  Cuando no hay ningún valor conocido, la función devuelve `pending` y el movimiento
  se guarda **sin conversión** (`fx_rate` y `amount_base` en `NULL`). Implementá el
  estado `needs_fx` completo según `docs/01-arquitectura-datos.md` § 2.5: exclusión
  de los agregados en moneda base, badge propio en la fila, resolución automática al
  reconectar, y pantalla de resolución en lote. El saldo de la cuenta NO se afecta.
- Inmutabilidad del rate: una vez resuelto no se recalcula nunca. Única excepción:
  un rate `inherited` puede reemplazarse por el real **una sola vez**, en la ventana
  de sincronización, y con confirmación del usuario. Fuera de eso no existe camino
  para reescribir un rate — ni siquiera administrativo.
- Proveedores como módulos intercambiables que implementan una interfaz común:
  `dolarapi`, `frankfurter`, `argentinadatos`, `coingecko`
- Route Handler `/api/fx` con: cache en la tabla `fx_rates`, revalidación,
  rate limiting, y respuesta que SIEMPRE incluye `{ rate, provider, quoteKind,
  asOf, isStale }`
- Cron diario (Edge Function) que precarga los pares que cada household usa

Tests obligatorios:
- Sin pérdida de precisión en cadenas de operaciones
- Redondeo correcto en los bordes
- Parseo de montos en las tres locales (es-UY, es-AR, en-US)
- La conversión con rate congelado nunca cambia al cambiar la cotización actual
- Todos los fallbacks de `lib/fx` cuando el proveedor falla
- Monedas crypto con 8 decimales

Nada de esto toca React. Es lógica pura y testeable.
```

---

## PROMPT C4 — Tokens, tema y primitivas de motion

```
Implementá el sistema visual de `docs/02-design-system.md`.

1. `app/globals.css` con Tailwind v4. Ojo con la mecánica: `@theme` emite un único
   bloque en `:root` y NO admite variantes claro/oscuro. El patrón correcto es:
   - definir los valores crudos en `:root` y sobrescribirlos en `.dark`
   - exponerlos a Tailwind con `@theme inline { --color-surface-1: var(--surface-1); … }`
   - declarar `@custom-variant dark (&:where(.dark, .dark *));`
   Los valores exactos están en el documento 02 § 2 — copialos, no los inventes.
   Nombres de token: `--color-page`, `--color-surface-{1,2,3}`,
   `--color-text-{primary,secondary,muted}`, `--color-border`, `--color-gridline`,
   `--color-primary-{text,fill}`, `--color-secondary`, `--color-accent`,
   `--color-status-{good,warning,serious,critical}`, `--color-data-{1..5}`,
   `--color-data-other`, `--color-seq-{100..700}`.
2. Estrategia de tema: `class` en `<html>` (light/dark/system) + el preset de marca
   del household inyectado sobre `--color-primary-{text,fill}`. Sin flash al cargar
   (script inline bloqueante en el `<head>`).
   La paleta de datos NO depende del preset: es fija.
3. Escala tipográfica y de espaciado como tokens de Tailwind. Geist Sans y Geist Mono
   con `next/font`.
4. `lib/motion/springs.ts` con las 4 curvas exactas y las 4 duraciones.
5. Primitivas de motion en `components/motion/`:
   - `<Pressable>` — scale 0.96 + haptic, respeta reduced motion
   - `<CountUp>` — cifra con odómetro, ancho estable
   - `<StaggerList>` — entrada escalonada, solo los primeros 8
   - `<SharedElement>` — wrapper sobre `layoutId` de Motion
   - `<MorphButton>` — el botón que se contrae a círculo y dibuja un check
   - `useHaptics()` — con feature detect
   - `useMotionIntensity()` — lee el ajuste del usuario (completa/reducida/mínima) y
     lo combina con `prefers-reduced-motion`
6. Una página `/dev/tokens` (solo en desarrollo) que renderiza toda la paleta, la
   escala tipográfica, los espaciados y las animaciones. Es la referencia visual viva.

Verificación: escribí un test que compare los tokens del CSS contra una tabla
declarada en el documento 02, para que no puedan divergir en silencio.
```

---

## PROMPT C5 — Capa offline y datos

```
Implementá la infraestructura de datos y offline.

1. Clientes de Supabase: browser, server (con cookies async de Next 16), y
   admin (solo para Edge Functions).
2. TanStack Query: `QueryClient` configurado, keys tipadas y centralizadas en
   `lib/queries/keys.ts`, y las opciones por defecto (staleTime, retry con backoff,
   refetch en reconexión).
3. Dexie: base local con las tablas `outbox`, `transactions_cache`,
   `accounts_cache`, `meta`. Versionada y migrable.
4. El outbox:
   - `enqueue(mutation)` — persiste antes de intentar la red
   - Worker que drena la cola en orden, con reintentos exponenciales
   - Registro de Background Sync API donde esté disponible
   - Resolución de conflictos: last-write-wins por campo comparando `updated_at`,
     con el conflicto registrado en `audit_log`
   - Hook `usePendingMutations()` para el `<SyncDot>` y el banner de offline
5. Un `createOptimisticMutation()` que envuelve el patrón completo: genera el UUID,
   actualiza el cache de TanStack, encola en el outbox, y hace rollback si falla de
   forma no recuperable.
6. Realtime: suscripción a los cambios del household que invalida las queries
   correspondientes. Con debounce, para no invalidar 40 veces durante un import.
7. Serwist: precache del app shell, `NetworkFirst` para datos, `CacheFirst` para
   assets, página de fallback offline, y el manifest con los shortcuts de la PWA
   ("Nuevo gasto", "Nuevo ingreso") y el share target.

Tests e2e con Playwright:
- Cargar 3 gastos con la red cortada, reconectar, verificar que los 3 llegaron una
  sola vez
- Cargar el mismo gasto dos veces por reintento y verificar que no se duplica
```

---

## PROMPT C6 — Componentes propios

```
Implementá la biblioteca de componentes de `docs/02-design-system.md` § 6, en el
orden en que los necesita la captura rápida.

Prioridad 1 (bloquean todo lo demás):
1. `<Amount>` — el ÚNICO lugar donde se formatea plata. Variantes de tamaño, signo,
   moneda extranjera con equivalente, modo privacidad. Regla: gastos en texto
   neutro, solo ingresos en aqua, siempre con signo.
2. `<Keypad>` — pantalla completa, teclas de 64px, dígitos de 32px, operaciones
   + − × ÷, backspace con long-press. Haptic por tecla. Máquina de estados propia
   (no un input controlado).
3. `<CategoryBubble>` y su grilla.
4. `<AccountCarousel>` con snap — `@use-gesture` + Motion.
5. `<DateStrip>` con snap.

Prioridad 2:
6. `<TransactionRow>` con sus swipes.
7. `<AmountScrubber>` — drag horizontal con aceleración por velocidad.
8. `<FxEditor>`.
9. `<StatTile>`, `<BudgetRing>`, `<SplitBar>`, `<InsightCard>`.
10. `<SyncDot>`, `<ScopeSwitcher>`, `<PrivacyBlur>`, `<CurrencyChip>`.

Para cada componente:
- Props tipadas, sin `any`
- Todos los estados del diseño
- Accesible: rol y label correctos, navegable por teclado, foco visible
- Respeta `useMotionIntensity()`
- Una entrada en `/dev/components` (la página de referencia viva)
- Un test de render + interacción

Restricciones: cero `<select>` nativo, cero `<input type="number">`, ningún target
menor a 44x44. Si un componente necesita romper esto, paralo y consultame.
```

---

## PROMPT C7 — Auth y onboarding

```
Implementá el bloque A (auth + onboarding), rutas `(auth)` y `(onboarding)`.

1. Supabase Auth: magic link, OAuth con Google y Apple, y registro de passkey
   después del primer login exitoso.
2. `proxy.ts` con el refresh de sesión y la protección de rutas.
3. Server Actions con `next-safe-action` + Zod para cada paso del onboarding.
4. Las 11 pantallas del bloque A, con la transición entre pasos.
5. El estado del onboarding persiste: si el usuario cierra la app en el paso 4,
   vuelve al paso 4.
6. Al terminar: se crean el household, la primera cuenta con su saldo inicial, y las
   categorías de la plantilla elegida. Todo en una sola transacción de base.
7. Los módulos elegidos se guardan en `households.enabled_modules`.
8. Prompt de instalación de PWA con detección de plataforma.
9. Pantalla de bloqueo (PIN con el mismo keypad, o biometría vía WebAuthn) con su
   timeout configurable.

E2E: signup → onboarding completo → primer gasto cargado. El test tiene que pasar en
menos de 90 segundos de interacciones simuladas.
```

---

## PROMPT C8 — Captura rápida

```
Implementá el bloque C. Es la funcionalidad más importante de la app.

Ruta interceptada: `/add` abre como modal sobre la ruta actual, con URL propia y
back nativo. Acceso directo por URL también tiene que funcionar (para el shortcut de
la PWA y el share target).

1. Máquina de estados del borrador en Zustand, persistida en Dexie: si la app se
   cierra a mitad de carga, se recupera.
2. Paso monto (C1) con `<Keypad>` y `<AmountScrubber>`.
3. Paso categoría (C2) con chips de frecuentes ordenados por hora del día. Este es
   el camino de 3 taps: FAB → monto → chip de frecuente. Instrumentalo con una
   métrica de desarrollo que cuente los taps reales.
4. Detalles colapsables (C3).
5. Conversión de moneda (C4) usando `lib/fx`: rate sugerido, fuente, antigüedad,
   editable. El rate elegido se congela en la transacción.
6. Ingreso (C5) y transferencia (C6), incluida la transferencia entre monedas
   distintas con dos montos.
7. Guardado optimista con `createOptimisticMutation()` + la animación de C7 +
   toast con Deshacer de 5 segundos.
8. Modo ráfaga (C8).
9. Captura por voz (C9) con Web Speech API y un parser de español rioplatense
   ("gasté mil doscientos en el súper"). Todo lo interpretado es editable antes de
   confirmar. Degrada limpio si el navegador no la soporta.
10. Reglas de auto-categorización: al guardar, se aplican las reglas activas y se
    recuerda la categoría del comercio.

Defaults inteligentes a implementar:
- Cuenta: la más usada en esa categoría, con fallback a la última usada
- Categorías frecuentes ponderadas por hora del día y por día de la semana
- Comercio con autocompletado desde `payees`

Tests:
- Unit: la máquina de estados del borrador, el parser de voz, la ponderación de
  frecuentes
- E2E: cargar un gasto en 3 taps; cargar en moneda extranjera; cargar sin conexión;
  deshacer
```

---

## PROMPT C9 en adelante — Resto de los bloques

> Mismo patrón para cada bloque. Plantilla:

Referencias por bloque (los números **no** coinciden entre archivos):

| Bloque | Wireframe | Alta fidelidad |
|---|---|---|
| A Onboarding | `03` § W1 | `04` § D3 |
| B Home | `03` § W2 | `04` § D4 |
| C Captura | `03` § W3 | `04` § D5 |
| D Transacciones | `03` § W4 | `04` § D6 |
| E Cuentas y monedas | `03` § W5 | `04` § D7 |
| F+G Presupuestos, metas, recurrentes, deudas | `03` § W6 | `04` § D8 |
| H Análisis | `03` § W7 | `04` § D9 |
| I Inversiones | `03` § W8 | `04` § D10 |
| J Grupo familiar | `03` § W9 | `04` § D11 |
| K+L Ajustes y estados | `03` § W10 | `04` § D12 |

```
Implementá el bloque [letra] — pantallas [lista explícita de IDs].
Wireframe en `docs/03-prompts-wireframes.md`, alta fidelidad en
`docs/04-prompts-ui.md` (ver la tabla de mapeo arriba).

Requisitos transversales para todo bloque:
- Todas las lecturas por TanStack Query con keys tipadas; todas las escrituras por
  `createOptimisticMutation()`
- Los 5 estados de cada pantalla (vacío, cargando, error, offline, con datos)
- Chequeo de `enabled_modules` antes de renderizar cualquier cosa del módulo, y
  carga diferida del código del módulo
- Cero strings hardcodeadas: todo por `next-intl` en ES/EN/PT
- Listas de más de 50 items virtualizadas
- Toda pantalla nueva entra en `/dev/components` si aporta un patrón nuevo
- Tests: unit de la lógica, e2e del camino feliz

Orden completo. Toda pantalla del mapa aparece exactamente una vez:

C9  — Bloque L (sistemas transversales, PRIMERO porque todo lo demás los consume):
      L1 estados vacíos · L2 skeletons · L3 errores · L4 toasts ·
      L5 onboarding contextual · L6 pantalla de bloqueo
C10 — Bloque D: D1 lista · D2 filtros · D3 detalle · D4 editar · D5 calendario ·
      D6 estados · D7 selección múltiple
C11 — Bloque B: B1-B8 (home en sus 3 variantes de FLAGS —una moneda / varias
      monedas / inversiones encendido—, tab bar, pantalla "Más", búsqueda
      global). NO existe un campo perfil en el modelo de datos. El control de
      alcance NO es ScopeSwitcher: ese componente está eliminado sin alias.
C12 — Bloque E: E1-E7 (cuentas, tarjeta de crédito, conciliación, monedas y FX)
C13 — Bloque H parte 1: H1 analytics home · H2 categorías · H3 tendencias ·
      H5 patrimonio neto · H8 calendario · H9 comercios · H14 estados
C14 — Bloques F+G: F1-F7 (presupuestos y metas) · G1-G6 (recurrentes y deudas)
C15 — Bloque J: J1-J10 (grupo familiar, visibilidad, splits, liquidación)
C16 — Bloque I: I1-I12 (inversiones)
C17 — Bloque H parte 2: H4 Sankey · H6 multi-moneda · H7 inflación ·
      H10 insights · H11 resumen semanal · H12 Wrapped · H13 exportar
C18 — Bloque K: K1-K13 (ajustes, categorías, reglas, FX, import/export, seguridad)
C19 — Desktop: sidebar, layout de dos columnas, command palette
C20 — i18n completo (ES/EN/PT), accesibilidad, performance
C21 — Preparación para open source: README, docs de self-host, docker-compose,
      `.env.example`, CONTRIBUTING, licencia, seeds de ejemplo
```

Los bloques A y C ya están cubiertos por C7 y C8.

---

## PROMPT CQ — Auditoría de código antes de liberar

```
Auditá PERZE antes de publicar el repositorio.

1. SEGURIDAD
   - Tests de RLS: ¿toda tabla tiene política y test? Intentá acceder a datos de otro
     household de todas las formas posibles.
   - ¿Se filtró alguna `service_role` key, secreto o URL privada al bundle o al
     historial de git?
   - Rate limiting en `/api/fx` y `/api/prices`.
   - Validación de entrada en cada Server Action.
   - Política de subida de archivos: tipos permitidos, tamaño, storage con RLS.

2. CORRECCIÓN DEL DINERO
   - Buscá todo uso de `number`, `parseFloat` o `toFixed` sobre montos. No debería
     haber ninguno.
   - Verificá que ningún componente formatee plata fuera de `<Amount>`.
   - Verificá que el rate congelado nunca se recalcule.

3. PERFORMANCE
   - Bundle: ¿el código de los módulos apagados llega al cliente? No debería.
   - Lighthouse en mobile: objetivo ≥ 90 en performance y 100 en accesibilidad.
   - Con 10.000 transacciones: tiempo de carga de la lista, del home y de analytics.
   - Consultas N+1 en Supabase.

4. OFFLINE
   - Cortar la red en cada pantalla: ¿alguna se rompe?
   - Cola con 50 mutaciones pendientes: ¿drena bien?
   - Conflicto real entre dos dispositivos.

5. ACCESIBILIDAD
   - axe-core sin violaciones críticas.
   - Navegación completa por teclado en desktop.
   - VoiceOver/TalkBack en el flujo de carga de un gasto.
   - Texto al 200%.

6. OPEN SOURCE
   - ¿Alguien que no seas vos puede levantarlo siguiendo el README?
   - ¿Hay datos personales tuyos en seeds, tests o migraciones?
   - ¿Hay algo hardcodeado a Uruguay o Argentina que debería ser configuración?

Entregá los hallazgos ordenados por severidad, con el archivo y la línea.
```
