# Changelog

Todos los cambios notables de este proyecto están documentados en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [0.3.0] — 2026-07-28

### Corregido

#### Botones de Google/Apple en el onboarding con logo real

- `design-system/core/Icon.tsx`: sumados `google` (`GoogleLogoIcon`) y `apple`
  (`AppleLogoIcon`) de Phosphor — antes ambos botones de OAuth en
  `onboarding/page.tsx` usaban el ícono genérico de `mail`, sin distinguir un
  proveedor del otro

### Agregado

#### Versión de la app visible en el front

- `src/lib/version.ts` — única fuente de verdad, lee `version` directo de `package.json`
  (nada hardcodeado en un segundo lugar que se pueda desincronizar en el próximo bump)
- Expuesta en la metadata de `src/app/layout.tsx` (`generator`, `other["app-version"]`)
- Visible para el usuario como footer en "Más" (`(app)/mas/page.tsx` → ahora
  `(app)/more/page.tsx`), formato `PERZE v{version}`, se actualiza sola en cada bump

### Cambiado

#### Rutas de navegación traducidas al inglés

Todos los segmentos de URL bajo `src/app/` pasan de español a inglés — cambia el path, no
las pantallas ni los textos de la interfaz (que siguen en `next-intl`, ES/EN/PT):

| Antes                                   | Ahora                      |
| --------------------------------------- | -------------------------- |
| `/agregar`, `(.)agregar` (interceptada) | `/add`, `(.)add`           |
| `/cuentas`                              | `/accounts`                |
| `/cuentas/nueva`                        | `/accounts/new`            |
| `/cuentas/[id]/editar`                  | `/accounts/[id]/edit`      |
| `/cuentas/[id]/conciliar`               | `/accounts/[id]/reconcile` |
| `/cuentas/resolver-fx`                  | `/accounts/resolve-fx`     |
| `/movimientos`                          | `/transactions`            |
| `/movimientos/[id]/editar`              | `/transactions/[id]/edit`  |
| `/movimientos/calendario`               | `/transactions/calendar`   |
| `/mas`                                  | `/more`                    |
| `/monedas`                              | `/currencies`              |
| `/analisis`                             | `/analytics`               |
| `/buscar`                               | `/search`                  |
| `/onboarding/pais`                      | `/onboarding/country`      |
| `/onboarding/uso`                       | `/onboarding/usage`        |
| `/onboarding/cuenta`                    | `/onboarding/account`      |
| `/onboarding/exito`                     | `/onboarding/success`      |
| `/onboarding/completar`                 | `/onboarding/complete`     |
| `/onboarding/verificar`                 | `/onboarding/verify`       |

- También traducidos, aunque las pantallas todavía no existen: `/inversiones` →
  `/investments`, `/presupuestos` → `/budgets` (`FOURTH_TAB_ROUTE` en `(app)/layout.tsx`)
- Actualizados todos los `router.push`/`router.back` de las pantallas afectadas, el shortcut
  de la PWA en `manifest.webmanifest`, y los cuatro tests E2E (`page.goto`/`waitForURL`)

### Técnico

- `package.json` `0.2.0` → `0.3.0`
- Build, lint, suite de Vitest (116 tests) y los 4 E2E de Playwright verificados en verde
  después del rename de rutas

---

## [0.2.0] — 2026-07-28

Rediseño completo de la app contra `perze-design/` — nueva base de código, nuevo modelo de
datos, nuevo sistema de diseño. El MVP anterior (`[0.1.0]`/`[0.1.1]`) queda archivado en
`src/app-old/` (ignorado por git, no se toca ni se migra) y este changelog documenta la app
que lo reemplaza: PERZE, PWA de finanzas personales multi-cuenta, multi-moneda y multi-país.
Plan completo en [`docs/perze-plan-redesign-first-5-blocks.md`](docs/perze-plan-redesign-first-5-blocks.md).

Cubre las Fases 0 a 9 del plan — fundaciones, y los Bloques C, B, D, E y A en ese orden de
construcción (C primero porque sus componentes los consume todo el resto; A último porque es
el único bloque que se podía saltear con un household de demo mientras se construía todo lo
demás) — más el trabajo posterior de responsive, auditoría PWA, migración de íconos y tests E2E.

### Infraestructura y stack (Fase 0-1)

- Next.js 16 (App Router, Turbopack como bundler por defecto), TypeScript estricto
  (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `verbatimModuleSyntax`), Tailwind CSS v4 con `@theme inline`
- **Dexie.js** (IndexedDB) como persistencia local-first, detrás de una capa de repositorios
  (`lib/repos/*`) pensada para enchufar Supabase más adelante sin rediseñar pantallas
- TanStack Query v5 para estado de servidor/Dexie; Zustand solo para estado de UI efímera
  (scope activo, borrador de captura, estado del keypad, intensidad de animación) — nunca
  datos de dominio
- `next-intl` con ES rioplatense como idioma fuente, EN y PT (`messages/{es,en,pt}.json`);
  cero strings hardcodeadas en toda la app
- Zod v4 como fuente de tipos de validación; Serwist para el service worker; ESLint (no Biome)
  como único linter/formateador
- Vitest + Testing Library para unitarios, Playwright para E2E
- `src/app/globals.css`: tokens portados de `perze-design/PERZE-Design-System/tokens/`; DS
  dark-first (`:root` es oscuro, `.light` invierte) con `@custom-variant dark` para no pelear
  contra la convención por defecto de Tailwind
- `src/lib/motion/springs.ts`: las 4 curvas y 4 duraciones exactas del design system

### Núcleo de dominio (Fase 2)

- `lib/money/` — `Money = { amount: bigint; currency: CurrencyCode }`. Cero `number`, cero
  `parseFloat`, cero `toFixed` sobre montos; parser de expresiones del keypad
  (`1200+350*2`), redondeo bancario explícito, formateo vía `Intl.NumberFormat`
- `lib/fx/` — `convert()` con resolución en orden estricto: override manual > cotización del
  día > último valor conocido (`isStale`) > `pending`. Nunca cae a rate = 1. `needs_fx`
  completo, con ascenso `neutral → warning` a los 7 días sin resolver
- `lib/db/` — schema completo de Dexie (households, accounts, transactions, categories,
  payees, tags, fx_rates, outbox, meta), versionado, con IDs UUID v7 generados en el cliente
  antes de la mutación (idempotencia)
- `lib/repos/` — una interfaz por agregado (`AccountsRepo`, `TransactionsRepo`, …); ninguna
  pantalla toca Dexie directo
- `lib/offline/outbox.ts` — cola de mutaciones + `createOptimisticMutation()`, lista para
  cuando exista un backend real que la drene
- `lib/seed/demo-household.ts` — household de demo (5 cuentas, incluida una en USD distinta a
  la moneda base, ~40 movimientos verosímiles en UYU/USD/ARS) accesible desde "Probar con
  datos de ejemplo" en el onboarding

### Sistema de diseño (Fase 3)

Portado desde `perze-design/PERZE-Design-System/` a `src/design-system/{core,money,finance,
nav,feedback,charts}/` con inline styles sobre CSS vars (fidelidad 1:1, sin traducir a clases
de Tailwind dentro del DS). Componentes: `Button`, `Card`, `Chip`, `Input`, `ListRow`,
`OtpInput`, `ProgressSteps`, `ResultGroup`, `SegmentedControl`, `Sheet`, `StatusBadge`,
`Switch`, `DismissibleNotice`; `Amount`, `AmountScrubber`, `CurrencyChip`, `FxEditor`,
`Keypad`, `PinKeypad`, `PrivacyBlur`; `AccountCarousel`, `AccountRow`, `BudgetRing`,
`CategoryBubble`, `DateStrip`, `GroupCard`, `InsightCard`, `InstitutionTile`, `OptionCard`,
`ProgressBar`, `RateRow`, `ResolutionChain`, `SplitBar`, `StatTile`, `TransactionRow`;
`EmptyState`, `ErrorState`, `OfflineBanner`, `Skeleton`/`SkeletonRow`, `UndoToast`;
`BarChart`, `LineChart`, `SeriesLegend`, `Sparkline`.

- Selección por **superficie** como default (segmentados, día activo, cuenta activa,
  categoría activa); el relleno violeta reservado para chip activo, tab activo y switch
  encendido — corregido en `SegmentedControl`, `CategoryBubble`, `DateStrip`,
  `AccountCarousel` y el slider de `FxEditor`, que originalmente gastaban el violeta sin ser
  la acción primaria de la pantalla
- `Amount` recibe `Money` (bigint + moneda), no `number` — único lugar de la app que formatea
  plata
- `aria-checked` agregado a `SegmentedControl` (accesibilidad real, no cosmética)
- `ScopeSwitcher` eliminado (quedó como alias trivial de `SegmentedControl`)
- Primitivas de motion en `components/motion/`: `Pressable` (scale 0.96 + haptic 8 ms),
  `CountUp` (odómetro 400 ms), `StaggerList`, `MorphButton` (botón → círculo → check),
  `useHaptics()`, `useMotionIntensity()` (completa/reducida/mínima + `prefers-reduced-motion`)
- Referencia viva en `/dev/components` (todos los estados de cada componente) y `/dev/tokens`

### Bloque C — Captura rápida (Fase 5)

- Ruta interceptada `/(app)/@modal/(.)agregar` con URL propia y back nativo; acceso directo
  por `/agregar` también funciona (shortcut de la PWA, share target)
- C1: monto con `Keypad` de pantalla completa + fila de categorías frecuentes **sobre** el
  keypad — el camino feliz baja a 2 taps (monto + categoría frecuente guarda directo, sin
  pasar por la grilla de categorías ni un botón "Guardar")
- C2: grid de burbujas de categoría como fallback, no camino principal
- C3: detalles en sheet (cuenta, fecha, comercio, nota, tags, modo ráfaga) — todo con default,
  nada obligatorio
- C5/C6: ingreso y transferencia (entre monedas partida en dos pasos: salida en pantalla,
  entrada confirmada en sheet; nunca cuenta como gasto ni ingreso)
- C7: guardado y deshacer en 4 frames, ≤700 ms, interactivo desde el frame 1
- C8: modo ráfaga con `Switch` real y contador, para cargar varios gastos sin volver a home
- C9: captura por voz (Web Speech API, parser rioplatense, todo editable antes de confirmar)
- C11: los tres badges — pendiente de sincronizar, sin conversión (`needs_fx`), rechazado —
  ninguno cancela el guardado
- **Invariante duro**: guardar no puede fallar. Sin red o sin tipo de cambio disponible, el
  movimiento se guarda igual (`needs_fx`); no existe el estado "no se guardó", solo "no se subió"
- Defaults inteligentes: cuenta más usada en la categoría con fallback a la última,
  frecuentes ponderadas por hora/día, comercio autocompletado desde `payees`

### Bloque B — Home y navegación (Fase 6)

- Home (B1) en sus variantes por flags ortogonales (monedas > 1, miembros > 1, módulos
  activos): hero de una cifra (patrimonio neto, con delta y sparkline) → tira de cuentas con
  snap → estado del mes → una insight card → últimos 5 movimientos
- Estados vacío, skeleton, offline con contador, scope abierto
- Tab bar con FAB central y regla del cuarto slot elegible (Análisis por default) — la
  navegación nunca se reconfigura sola
- Búsqueda global (`/buscar`, B8) agrupada por movimientos, cuentas, categorías y comercios

### Bloque D — Movimientos (Fase 7)

- Lista agrupada por día, headers sticky, resumen del período, virtualizada
  (`@tanstack/react-virtual`)
- Swipe para editar/borrar con deshacer de 5 s (equivalente por tap en el detalle)
- Filtros en bottom sheet con contador de resultados en vivo; calendario del mes con total
  por día; selección múltiple
- Sin un solo separador de fila ni borde de caja: densidad resuelta con espaciado y
  tipografía. Gastos en tinta neutra; el aqua reservado solo para ingresos; transferencias
  marcadas "no suma al total"
- Detalle de movimiento con el rate de cambio usado, su fuente y badge `needs_fx` cuando
  corresponde

### Bloque E — Cuentas y monedas (Fase 8)

- Lista de cuentas agrupada por moneda con subtotales; detalle con evolución del saldo a 90
  días; nueve tipos de cuenta con campos condicionales (incluye tarjeta de crédito: ciclo,
  cierre, vencimiento, proyección)
- Conciliación de saldo; monedas y tipos de cambio por par (proveedor, cotización preferida,
  override manual con vigencia, histórico)
- Resolución en lote de tipos de cambio pendientes (`/cuentas/resolver-fx`), la vista que
  cierra el estado `needs_fx`
- Estados: sin cuentas, rate viejo, API caída — nunca bloquean la pantalla

### Bloque A — Onboarding y auth (Fase 9)

- Camino crítico recortado: auth → país → uso (define si el grupo familiar arranca
  encendido) → primera cuenta → éxito → primer gasto. Google/Apple como camino visualmente
  principal (simulados, sin backend real todavía), magic link como alternativa
- Saldo inicial de la cuenta e instalación de la PWA se piden **después** del primer gasto,
  nunca antes — el primer contacto real con el keypad es el gasto, no un formulario
- Abandono a mitad de camino: al volver, entra directo a un home vacío con cuenta "Efectivo"
  por default; el onboarding no se repite
- Al terminar: household + primera cuenta con saldo inicial + plantilla de categorías Básica,
  todo en una sola transacción de Dexie
- Atajo "Probar con datos de ejemplo" para construir B/D/E antes de tener el flujo completo

### Responsive — tablet y desktop

- Navegación: `Sidebar` fijo a partir de `md`, reemplaza la `TabBar` inferior (mismos tabs,
  mismo handler)
- Contenido en una sola columna centrada (`--content-max-width`) en cualquier tamaño de
  pantalla — nunca multi-columna
- `ScreenShell` para las rutas standalone (onboarding, `/agregar` sin modal); `Sheet` capado a
  `position: relative` de su contenedor para no desbordar en pantallas grandes

### PWA — auditoría de instalación

- Service worker migrado de `@serwist/next` (nunca generaba `sw.js` real bajo Turbopack) a
  `@serwist/turbopack` (`createSerwistRoute` en `src/app/serwist/[path]/route.ts`), con
  `defaultCache` + fallback de navegación a `/offline`
- Registro manual del service worker (`ServiceWorkerRegister`, Serwist no lo inyecta solo a
  diferencia de `next-pwa`)
- Assets de marca completos desde `perze-brand/`: íconos `any`/`maskable`/`monochrome`,
  splash screens de iOS generados por dispositivo (`scripts/generate-splash-screens.mjs`,
  cubre el catálogo vigente de iPhone/iPad), `apple-touch-startup-image` vía Metadata API
- `manifest.webmanifest`: sin lock de orientación portrait, shortcut "Cargar un gasto" con
  ícono propio (`scripts/generate-shortcut-icon.mjs`, ícono de la app + insignia violeta con
  "+"), `metadataBase` configurado para que las URLs de `og:image` resuelvan en producción

### Migración de íconos: Lucide → Phosphor

- `design-system/core/Icon.tsx` migrado íntegro de `lucide-react` a `@phosphor-icons/react`
  (variante `/dist/ssr` para no forzar `"use client"` en las pantallas que lo consumen desde
  Server Components), preservando la API pública (`IconName`, props de `Icon`)
- Ícono propio para cuenta corriente (`bank`), distinto de caja de ahorro (`piggy-bank`) —
  antes ambos compartían el mismo glifo genérico y se veían igual en la lista de cuentas y en
  el picker de cuenta de la captura
- `lucide-react` eliminado por completo del `package.json`; los toasts de `sonner.tsx`
  migrados a sus equivalentes Phosphor; borrados los componentes de `shadcn/ui` que quedaron
  sin uso (`sheet`, `command`, `select`, `dialog`, `dropdown-menu`) por ser la única otra
  fuente de imports de Lucide en el repo

### Testing

- 4 tests E2E (Playwright, viewport mobile 390×844): gasto en 2 taps con cronómetro, gasto en
  moneda extranjera sin cotización disponible (`needs_fx`), 3 gastos con la red cortada y
  reconexión sin duplicados, onboarding completo → primer gasto en menos de 90 s
- Suite de Vitest existente (dominio, repos, componentes) manteniendo cobertura sobre
  `lib/money`, `lib/fx` y sus fallbacks, y la máquina de estados del borrador de captura

### Pendiente

- Backend real (Supabase: Postgres, Auth, Storage, Realtime, Edge Functions) — hoy todo es
  local-first sobre Dexie
- Bloques F en adelante (Presupuestos, Metas, Recurrentes, Deudas, Inversiones, Grupo
  familiar) y features diferidas de captura (C4 completo, C10 foto de ticket)
- Ajustes / Importar-Exportar / Acerca de siguen como stubs
- `src/app-old/` (MVP `[0.1.0]`/`[0.1.1]`) sigue en el repo, ignorado por git, pendiente de
  borrado definitivo al cerrar el bloque A original del plan

---

## [0.1.1] — 2026-05-30

Resuelve los cuatro ítems pendientes de la Fase 0 identificados en la revisión de código.

### Corregido

**PWA — íconos PNG generados correctamente**

- Generados `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png` a partir del SVG existente con `sharp`
- El ícono maskable incluye fondo esmeralda con 10 % de safe-zone (contenido al 80 %) según la especificación W3C
- `manifest.webmanifest` actualizado: 4 entradas separadas con `purpose` correcto (`"any"` y `"maskable"` como entradas distintas)
- El PWA ahora puede instalarse correctamente en Android/Chrome

**Auth — contraseñas hasheadas en lugar de texto plano**

- Introducido `src/lib/hash.ts` con hash FNV-1a 32-bit + salt de aplicación, sincrónico y sin dependencias externas
- `auth-store` actualizado: el campo `_passwordHash` reemplaza a `_password`; ninguna contraseña en texto plano se persiste en localStorage
- Login, registro y reset de contraseña actualizados para comparar/guardar el hash
- `partialize` explícito en el persist documenta qué se almacena; los hashes de contraseña se almacenan (para permitir login tras recarga) pero nunca el texto plano
- Nota: sigue siendo mock — la autenticación real con Supabase Auth se implementa en Fase 6

**`formatMoney` — negativos con signo correcto**

- `src/lib/money.ts`: separa el signo antes de formatear con `Math.abs(amount)`, produciendo `-$1.200` en lugar de `$-1.200`
- Comportamiento ahora consistente con `formatCompact` que ya lo manejaba correctamente

**Validación en mutaciones del store de transacciones**

- Creado `src/lib/schemas.ts` con `TransactionSchema` (Zod) como única fuente de verdad para la estructura de una transacción
- `transactions-store` actualizado: `addTransaction` y `updateTransaction` validan con Zod antes de persistir; retornan `{ success, error? }` en lugar de `void`/`Transaction`
- `transaction-sheet.tsx` actualizado para manejar los nuevos tipos de retorno
- También corregido el bug BUG-M2: `getRecentTransactions` ahora ordena por `t.date` (fecha real de la transacción) en lugar de `createdAt`

### Técnico

- Instalado `sharp@0.34.5` como devDependency para generación de íconos
- Script de generación de íconos en `/tmp/gen-icons.mjs` (puede incorporarse a `postinstall` en el futuro)

---

## [0.1.0] — 2026-05-30

Primera versión funcional de la app. MVP completo con todas las secciones principales, diseño fintech premium, soporte multi-moneda/multi-país e integración con IA de Gemini.

### Infraestructura y stack

- Scaffold con **Next.js 16.2** (App Router, Turbopack en dev, webpack en build)
- **Tailwind v4** con sistema `@theme inline` y variables OKLCH
- **shadcn/ui** inicializado y customizado: button, card, input, select, sheet, dialog, tabs, switch, dropdown, badge, avatar, calendar, command, popover, skeleton, sonner, progress, scroll-area, tooltip
- **Zustand 5** con `persist` middleware a localStorage para todos los stores
- **TypeScript** estricto en todo el proyecto
- **pnpm** como package manager
- **PWA** via Serwist (service worker, manifest, soporte offline)
- Fuente **Outfit** (Google Fonts) para toda la UI; Geist Mono para código

### Sistema de diseño

- Tema **claro/oscuro** con toggle y soporte de preferencia del sistema
- **5 colores de acento** configurables: esmeralda (default), violeta, azul, rosa, ámbar
- Acento aplicado vía clases CSS en el `<html>` por el `Providers` component
- Fondo dark: azul-gris profundo `oklch(0.095 0.018 265)` (no negro puro)
- Fuente Outfit cargada correctamente vía variable CSS `--font-outfit` (corrige bug de referencia circular del scaffold)
- Colores semánticos por tipo de transacción: `--income` (esmeralda), `--expense` (rojo), `--investment` (azul)
- `suppressHydrationWarning` en `<html>` y `<body>` para compatibilidad con extensiones de browser
- `dark accent-emerald` como clases SSR por defecto en el `<html>` para evitar flash de tema incorrecto

### Modelo de datos (`src/lib/types.ts`)

- `Currency` — código, nombre, símbolo, decimales. Defaults: USD, ARS, UYU, EUR
- `Country` — código, nombre, emoji bandera, monedas habilitadas. Defaults: Argentina (AR), Uruguay (UY)
- `ExchangeRate` — cotización relativa a USD como pivote (carga manual, arquitectura lista para API)
- `Category` — id, nombre, ícono (lucide), tipo, color. 22 categorías default (ingresos, gastos, inversiones)
- `Transaction` — id, tipo (income/expense/investment), monto, moneda, país, categoría, fecha, descripción, notas, source (manual/ai-receipt), createdAt
- `User` (mock) — id, nombre, email, createdAt
- `AccentColor` — union type de 5 acentos
- `Theme` — "light" | "dark" | "system"

### Stores Zustand (`src/stores/`)

- **`auth-store`** — autenticación mock local: register, login, logout, requestPasswordReset, resetPassword, updateProfile. Usuarios y sesión persistidos en localStorage (mock únicamente, no para producción)
- **`settings-store`** — moneda de visualización, tema, acento, lista de monedas y países configurados
- **`rates-store`** — tasas de cambio manuales con upsert por código de moneda
- **`categories-store`** — CRUD de categorías con seed de las 22 categorías default
- **`transactions-store`** — CRUD de movimientos con `crypto.randomUUID()` para IDs y `getRecentTransactions`
- **`analysis-store`** — análisis IA persistido: análisis actual + historial de hasta 10 análisis anteriores con fecha y snapshot de datos

### Utilidades (`src/lib/`)

- **`money.ts`** — `formatMoney` (Intl.NumberFormat por locale), `convertAmount` (conversión via pivote USD, retorna null si falta la tasa), `formatCompact` (sufijos K/M/B), `getCurrencyDisplay`
- **`aggregations.ts`** — `filterTransactions` (7 criterios), `computeTotals` (net = income - expenses - investments), `groupByMonth`, `groupByCategory`, `groupByCountry`

### Autenticación (`src/app/(auth)/`)

Layout con panel split en desktop: izquierda con branding/gradiente, derecha con el formulario.

- **`/login`** — email + contraseña, link a recuperar, redirección post-login
- **`/registro`** — nombre, email, contraseña, confirmación, redirección post-registro
- **`/recuperar`** — ingreso de email, mensaje neutral de confirmación
- **`/restablecer`** — nueva contraseña + confirmación, email prellenado por query param

Todas las páginas usan react-hook-form + Zod para validación. El logo se oculta en desktop donde ya aparece en el panel izquierdo.

### App layout (`src/app/(app)/layout.tsx`)

- Guard de autenticación con `useEffect` post-hidratación (evita redirect race con Zustand persist)
- Spinner de carga durante la ventana de hidratación (nav siempre visible)
- `<BottomNav />` renderizado incondicionalmente para que aparezca en todas las rutas

### Bottom navigation (`src/components/bottom-nav.tsx`)

- 4 items + botón central: Inicio · Movimientos · **+** · Análisis · Ajustes
- Indicador de ítem activo: barra de 3px sobre el ícono en color acento
- Botón central (+): círculo con glow de acento, navega a `/movimientos?new=true`
- Fondo con `backdropFilter: blur` y sombra ascendente para distinguirse del contenido
- `safe-area-inset-bottom` para iOS

### Dashboard (`/`)

- Saludo con hora del día + nombre del usuario; fecha en español
- Selector de período: Este mes / 3 meses / Este año
- **Hero card**: balance neto en grande (text-5xl), mini-stats (ingresos/gastos/inversiones), selector de moneda de visualización, patrón de puntos decorativo
- Breakdown **Por país**: tarjetas scrollables con bandera, nombre y balance neto por país (net = income - expenses - investments)
- **Gráfico de últimos 6 meses**: BarChart de Recharts con 3 barras por mes (ingresos/gastos/inversiones), leyenda, tooltip customizado
- **Movimientos recientes**: últimos 5 ordenados por fecha, con ícono de categoría, descripción, fecha en español y monto con signo/color por tipo
- **Acciones rápidas**: 3 cards (Nuevo gasto / Nuevo ingreso / Nueva inversión) con colores semánticos
- Estado vacío con CTA cuando no hay transacciones

### Movimientos (`/movimientos`)

- Lista agrupada por fecha con headers ("Hoy", "Ayer", nombre del día, fecha completa)
- **Pills de filtro rápido por tipo** sobre el listado: Todos / Gastos / Ingresos / Inversiones (con colores semánticos en activo)
- **Filter sheet** (desliza desde abajo): búsqueda por texto, país (con bandera), moneda (con símbolo), categoría, rango de fechas
- Selects del filtro con triggers customizados que muestran el valor legible ("Todos" cuando no hay selección, bandera+nombre para países, símbolo+código para monedas)
- **Chips de filtros activos** debajo del header, cada uno eliminable individualmente
- Contador de movimientos filtrados en el header
- Cada item: ícono de categoría en círculo coloreado, descripción + categoría, monto con signo y color, código de moneda y bandera del país
- Menú contextual por item: editar o eliminar con confirmación
- **Transaction Sheet** para alta/edición:
  - Tabs de tipo (Gasto/Ingreso/Inversión) con colores
  - Selector de moneda con símbolo en acento + código
  - Selector de país con emoji bandera + código
  - Input de monto en grande con símbolo de moneda
  - Grid visual de selección de categoría (4 columnas, íconos coloreados)
  - Date picker via Calendar + Popover
  - Campo de descripción y notas opcionales
  - Confirmación antes de eliminar en modo edición
  - Source `"ai-receipt"` para movimientos cargados desde análisis de ticket

### Inversiones (`/inversiones`)

- Hero card con total invertido en moneda de visualización
- Barra de distribución horizontal por categoría (segmentos proporcionales)
- Lista de categorías con barra de progreso individual y porcentaje
- Últimos 5 movimientos de tipo inversión
- Estado vacío con link a agregar inversión
- FAB en esquina inferior derecha para nuevo movimiento de tipo inversión

### Análisis IA (`/analisis`)

- Selector de período: Este mes / 3 meses / Todo
- Mini stats del período (ingresos/gastos/inversiones) en el header
- Botón "Generar análisis" / "Regenerar análisis"
- **Health score ring**: SVG circular con color según puntuación (≥81 verde, ≥61 teal, ≥41 ámbar, <41 rojo)
- Resumen ejecutivo del análisis
- Cards de oportunidad de ahorro
- **Alertas** con severity (high=rojo, medium=ámbar, low=verde)
- **Observaciones** por categoría con tipo (positive/warning/critical/info)
- **Sugerencias** con prioridad y acción concreta, borde de color por prioridad
- Timestamp del análisis generado
- **Historial** colapsable: hasta 10 análisis anteriores, cada uno expandible con score, resumen y primeras 2 sugerencias. Eliminación individual o total.
- Card feature "Escanear ticket" con link a `/escanear`
- Manejo de errores específico por tipo: quota agotada, API key inválida, modelo no disponible

### Escanear ticket (`/escanear`)

- Input de imagen con `capture="environment"` para cámara del dispositivo
- Preview de la imagen seleccionada con opción de cambiar
- Botón "Analizar con IA" deshabilitado hasta seleccionar imagen, con spinner durante análisis
- Resultado: comercio, confianza (badge verde/amarillo/rojo), fecha, moneda, tabla de items, subtotal/IVA/total
- Botón "Guardar como gasto" → abre TransactionSheet prellenado con datos del ticket
- Manejo de error cuando no hay API key (con link a Configuración)

### Configuración (`/configuracion`)

- **Perfil**: avatar con iniciales, edición de nombre inline, email, botón de logout
- **Apariencia**: selector de tema (3 botones), 5 círculos de color de acento, selector de moneda de visualización
- **Tipos de cambio**: lista de monedas con input de tasa por USD, timestamp de última actualización, tip específico para ARS (dólar blue)
- **Monedas configuradas**: lista con símbolo, badge "en uso", eliminar (con validación de uso activo), dialog para agregar nueva moneda
- **Países configurados**: lista con bandera, nombre, badges de monedas habilitadas, eliminar, dialog para agregar nuevo país

### API routes (`src/app/api/ai/`)

- **`/api/ai/insights`** (POST) — agrega summary financiero → Gemini 2.5 Flash → schema Zod `InsightsSchema` → respuesta estructurada (healthScore, observations, suggestions, alerts, savingsOpportunity)
- **`/api/ai/scan-receipt`** (POST, multipart) — imagen en base64 → Gemini 2.5 Flash Vision → schema Zod `ReceiptSchema` → merchant, date, currency, total, items[], category, confidence
- Manejo de errores diferenciado: quota (429), API key inválida (401), modelo no disponible (503)
- API key solo en servidor (`GEMINI_API_KEY` en `.env.local`)

### PWA

- `public/manifest.webmanifest` — nombre, short_name, start_url, display standalone, orientación portrait
- Service worker generado por Serwist en build (`pnpm build --webpack`)
- SW deshabilitado en desarrollo (evita conflicto con Turbopack)
- `turbopack: {}` en next.config.ts para silenciar advertencia en dev
- Meta `appleWebApp` para instalación en iOS
- Viewport `viewportFit: "cover"` para soporte de notch

### Fixes y ajustes iterativos (post-MVP)

- Corregido bug de referencia circular de fuente (`--font-sans: var(--font-sans)` → `var(--font-outfit)`)
- Corregido enrutamiento: eliminado `src/app/page.tsx` que impedía que `(app)/layout.tsx` aplicara al root `/` y ocultaba el BottomNav en el dashboard
- Corregido bug de hidratación Zustand: guard de auth con estado `hydrated` antes de redirigir
- Corregida inconsistencia en neto por país: `income - expenses - investments` (inversiones también son salida de efectivo)
- Eliminado FAB redundante de la página de movimientos (el botón + del BottomNav cumple la misma función)
- Corregido modelo de Gemini: `gemini-2.0-flash-exp` (deprecado) → `gemini-2.5-flash` (disponible con la API key configurada)
- Corregido `__all__` visible en selects de filtros: triggers customizados con display legible
- Agregadas pills de filtro rápido por tipo directamente sobre el listado de movimientos
- Análisis IA persistido en `analysis-store` con historial de hasta 10 análisis anteriores
- Inversiones incluidas en el gráfico de 6 meses del dashboard (tercera barra)

### Conocido y pendiente (ver `docs/plan-next-steps.md`)

- Contraseñas en texto plano en localStorage (mock — no usar en producción)
- Íconos PNG del PWA no generados (solo existe SVG; falla la instalación en Android)
- Rutas de IA sin autenticación (cualquiera puede consumir la cuota de Gemini)
- `formatMoney` produce `$-1.200` en negativos en lugar de `-$1.200`
- `useMemo` con `Date` inestables en el dashboard (memoización se invalida en cada render)
- Pérdida de datos al cerrar el sheet sin guardar (sin confirmación de descarte)

---

_Para el plan completo de próximas versiones ver [`docs/plan-next-steps.md`](docs/plan-next-steps.md)._
