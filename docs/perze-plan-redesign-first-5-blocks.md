# PERZE — Rediseño desde cero: bloques A a E

## Contexto

El repo tiene hoy un MVP (v0.1.1) construido antes de que existiera el diseño: fuente Outfit,
acento esmeralda, montos en `number`, stores Zustand con `localStorage`, auth mock. Ese código
quedó archivado en `src/app-old/`.

En paralelo se completó un paquete de producto y diseño (`perze-design/`) que define otra app:
**PERZE**, PWA de finanzas personales multi-cuenta / multi-moneda / multi-país, minimalista y
dark-first, con captura de gasto en menos de 5 segundos y 3 decisiones. El paquete incluye
6 documentos de producto/arquitectura/design system, el mapa estructural del sistema (82 vistas
navegables en 12 bloques), un design system empaquetado con 36 componentes ya escritos, y los
entregables de alta fidelidad de los bloques A, B, C, D y E.

El objetivo es reconstruir la app desde cero contra ese diseño, empezando por esos 5 bloques
(onboarding, home, captura, movimientos, cuentas y monedas). `src/app-old/` no se toca ni se
migra: es referencia histórica y se borra al cerrar el bloque E.

### Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Persistencia | **Local-first ahora**: Dexie/IndexedDB como única fuente, detrás de una capa de repositorios que después se enchufa a Supabase. Bloque A con auth simulada. |
| Design system | **Portar el zip a TSX**. Ya está descomprimido en `perze-design/PERZE-Design-System/`. |
| Stack | Alinear todo al doc `01-arquitectura-datos.md`, **excepto**: seguimos con **ESLint** (no Biome) y con **Next.js 16**. |
| i18n | **next-intl con ES / EN / PT** desde la primera pantalla. Cero strings hardcodeadas. |

### Fuentes de verdad (jerarquía, en caso de conflicto)

1. Los `.dc.html` de cada bloque — inventario real de pantallas y layout final. Cada uno cierra
   con una sección "dónde me alejé de la especificación" que **gana** sobre los prompts.
2. `perze-design/PERZE-Design-System/readme.md` — reglas visuales y de contenido vigentes.
3. `perze-design/inicial-docs-design/02-design-system.md` — valores numéricos.
4. `03-prompts-wireframes.md` — intención de cada pantalla.

---

## Orden de bloques (no es A→E)

Recomiendo **C → B → D → E → A**, con las fundaciones antes:

- **C primero** porque el `Keypad`, `CategoryBubble`, `AccountCarousel`, `DateStrip`, `Amount` y
  la máquina de estados del borrador los consumen todos los demás bloques, y A los necesita
  (A7 es el keypad).
- **A último** porque es la única pantalla que se puede saltear con un seed de household demo
  mientras se construye el resto, y porque su rediseño (paso 1 del bloque: OAuth pasa a camino
  principal, A7 sale del camino crítico) depende de saber cómo quedó C1.

---

## Fase 0 — Documentación y limpieza

Sin código de app. Deja el repo describiendo lo que se va a construir.

### Archivos

- `README.md` — reescribir: PERZE, qué es, stack real, estructura, cómo levantar, estado por
  bloque, link a `docs/`. Hoy describe el scaffold de `create-next-app`.
- `CLAUDE.md` — reemplazar el `@AGENTS.md` de una línea por el `PROMPT C0` de
  `perze-design/inicial-docs-design/05-prompts-desarrollo.md` § C0, **adaptado**: Dexie como
  backend actual (Supabase como destino), ESLint en vez de Biome, `next-intl` ES/EN/PT.
  Mantener el bloque "Gotchas de Next.js 16" tal cual.
- `AGENTS.md` — conservar la regla de leer `node_modules/next/dist/docs/` antes de escribir código.
- `docs/00-producto.md` … `docs/05-prompts-desarrollo.md` — copiar los 6 docs desde
  `perze-design/inicial-docs-design/`. `CLAUDE.md` y los prompts los referencian por esa ruta.
- `docs/perze-plan-redesign-first-5-blocks.md` — este plan, versionado en el repo.
- `docs/plan-next-steps.md` — marcar como histórico (plan del MVP v0.1.x, superado).
- `.markdownlint.json` — `MD013: false`, `MD024: { siblings_only: true }`.

**Usar la skill `markdown-documentation`** en todo `.md` de esta fase.

---

## Fase 1 — Tooling y fundaciones visuales

### Dependencias a sumar

`motion` · `@tanstack/react-query` + `@tanstack/react-query-devtools` · `@tanstack/react-virtual`
· `dexie` + `dexie-react-hooks` · `@use-gesture/react` · `vaul` · `next-intl` ·
`@t3-oss/env-nextjs` · `uuidv7` · `geist` · `vitest` + `@vitejs/plugin-react` +
`@testing-library/react` · `@playwright/test`

**A quitar del `package.json`**: `@ai-sdk/google`, `ai` (el escaneo de tickets es C10, fase futura),
`react-day-picker` (las fechas son `DateStrip`), `recharts` (no lo usa ningún bloque A–E;
vuelve en H), `next-themes` (el tema es una clase en `<html>` + script inline, sin flash).

### Archivos

- `tsconfig.json` — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `verbatimModuleSyntax`.
- `next.config.ts` — `cacheComponents: true`, `experimental.viewTransition: true`,
  `experimental.turbopackFileSystemCacheForDev: true`. Sacar `--webpack` de `build`.
- `src/env.ts` — T3 Env.
- `src/app/globals.css` — **el archivo central de la fase**. Portar
  `perze-design/PERZE-Design-System/tokens/{palette,colors,typography,spacing,motion,charts,base}.css`
  y exponerlos a Tailwind v4 con `@theme inline`. Ojo con dos cosas:
  - el DS es **dark-first** (`:root` *es* oscuro, `.light` invierte); Tailwind espera lo inverso.
    Declarar `@custom-variant dark (&:where(.dark, .dark *));` y mantener la semántica del DS —
    no reescribir los tokens al revés.
  - `@theme` emite un único bloque en `:root` y no admite variantes; los valores crudos van en
    `:root` / `.light` y `@theme inline` solo los aliasea.
- `src/app/layout.tsx` — Geist Sans + Geist Mono con `next/font`, script inline anti-flash,
  providers (React Query, next-intl, Dexie).
- `src/lib/motion/springs.ts` — las 4 curvas y las 4 duraciones exactas de
  `02-design-system.md` § 5.1.
- `src/i18n/{request.ts,routing.ts}` + `messages/{es,en,pt}.json` — ES rioplatense es el idioma
  fuente; EN y PT se traducen desde ahí.
- `src/app/dev/tokens/page.tsx` — referencia visual viva (solo en dev).

**Verificación de la fase**: un test de Vitest que compara los tokens emitidos por el CSS contra
una tabla declarada desde `02-design-system.md` § 2, para que no diverjan en silencio.

---

## Fase 2 — Núcleo de dominio (sin React)

Lógica pura, testeable, sin la que nada más es correcto.

- `src/lib/money/` — `Money = { amount: bigint; currency: CurrencyCode }`. Constructores desde
  string por locale (`1.250,50` / `1,250.50`), operaciones que fallan si las monedas no coinciden,
  redondeo bancario explícito, formateo con `Intl.NumberFormat`, y el **parser de expresiones del
  keypad** (`1200+350*2`). Cero `number`, cero `parseFloat`, cero `toFixed` sobre montos.
- `src/lib/fx/` — `convert()` que devuelve resultado **y** rate usado. Resolución en orden
  estricto: override manual > cotización del día > último valor conocido (`isStale`) >
  **`pending`**. Nunca cae a rate = 1. Implementar `needs_fx` completo según
  `docs/01-arquitectura-datos.md` § 2.5, incluido el ascenso `neutral → warning` a los 7 días
  (única excepción del sistema que escala por tiempo). Proveedores como módulos intercambiables
  (`dolarapi`, `frankfurter`), consumidos solo desde `src/app/api/fx/route.ts` — el cliente
  nunca llama a una API de cotización.
- `src/lib/db/` — Dexie: `households`, `accounts`, `transactions`, `categories`, `payees`,
  `tags`, `fx_rates`, `outbox`, `meta`. Versionada. IDs UUID v7 generados en el cliente antes de
  la mutación. Los campos del schema salen de `docs/01-arquitectura-datos.md` § 2 — el modelo se
  implementa **completo** aunque la UI sea progresiva, incluidos `visibility`, `deleted_at`,
  `client_rev`, `fx_rate` + origen + `quote_kind`, `amount_base` nullable.
- `src/lib/repos/` — la costura que hace posible cambiar a Supabase después: una interfaz por
  agregado (`AccountsRepo`, `TransactionsRepo`, …) con implementación Dexie. **Ninguna pantalla
  toca Dexie directo.**
- `src/lib/offline/outbox.ts` — cola de mutaciones + `createOptimisticMutation()`. Con
  local-first el "servidor" es un no-op hoy, pero la forma queda armada y C11 (los tres badges:
  pendiente / sin conversión / rechazado) necesita la cola para existir de verdad.
- `src/lib/validation/` — Zod v4 como fuente de tipos.
- `src/lib/analytics/balances.ts` — saldo de cuenta y patrimonio neto multi-moneda (los dos
  cálculos que B1 y E1 necesitan; el resto de `01 § 6` es de bloques posteriores).
- `src/stores/` — Zustand solo para UI efímera: scope activo, borrador de la captura, estado del
  keypad, intensidad de animación. Nada de datos de dominio.
- `src/lib/seed/` — household demo (cuentas Itaú / Brou / Mercado Pago / Efectivo, categorías
  plantilla Básica, ~40 movimientos verosímiles en UYU/USD/ARS). Es lo que permite construir
  B, D y E antes de tener el bloque A.

**Tests obligatorios (Vitest)**: precisión en cadenas de operaciones · bordes de redondeo ·
parseo en es-UY / es-AR / en-US · el rate congelado no cambia al cambiar la cotización actual ·
todos los fallbacks de `lib/fx` · crypto con 8 decimales.

---

## Fase 3 — Design system portado + bloque L

Origen: `perze-design/PERZE-Design-System/components/` (36 componentes `.jsx` + `.d.ts` +
`.prompt.md` cada uno). Destino: `src/design-system/{core,money,finance,nav,feedback,charts}/`.

### Cómo portar

- `.jsx` → `.tsx` tipado con su `.d.ts` como contrato de props. Conservar el `.prompt.md` al lado.
- Mantener el enfoque de **inline styles sobre CSS vars** que ya usan los componentes. Es lo que
  garantiza fidelidad 1:1 y evita traducir 36 componentes a clases. Tailwind se usa para el
  layout de pantalla, no dentro del DS.
- **Una desviación deliberada**: `Amount` recibe hoy `value: number`. Portarlo a
  `value: Money` (bigint + moneda) delegando el formateo en `lib/money`. Es el único lugar donde
  se formatea plata en toda la app, y el doc 00 § 2.3 prohíbe floats. `formatAmount()` del DS
  queda como helper interno.

**Correcciones al bundle que los propios bloques declararon** (aplicarlas al portar, no después):

- `ScopeSwitcher` → borrarlo. Con la selección por superficie quedó como alias trivial de
  `SegmentedControl`; las pantallas usan `SegmentedControl` directo (declarado en E y B).
- `SegmentedControl`, `CategoryBubble` (anillo), `DateStrip` (día activo), `AccountCarousel`
  (cuenta activa) → **selección por superficie**, no por relleno de marca. El relleno violeta
  queda solo para `Chip selected`, tab activo y `Switch` encendido.
- `FxEditor` → el slider pasa a superficie (hoy gasta el violeta de la pantalla sin ser la
  acción primaria).
- `SegmentedControl` → `aria-checked` en el árbol de accesibilidad (hoy falta; B lo marcó como
  problema real, no cosmético).
- `Icon` → sumar los glifos que faltan y que hacen indistinguibles dos cosas distintas:
  `mail`, `lock`, `fingerprint`, `install`, `flag`, `piggy-bank`, `credit-card`, `smartphone`,
  `banknote`, `handshake`, `receipt`, `mic`, `camera`, `pharmacy`, `tag`.

**Componentes nuevos que los bloques declararon como deuda** (sin ellos hay markup repetido):

| Componente | Lo pide | Para qué |
|---|---|---|
| `OptionCard` | A5, A8 | Opción grande seleccionable por superficie, título + una línea |
| `ProgressSteps` | A4–A9 | Barra de 4 segmentos de 3px con "Saltear" |
| `OtpInput` | A3 | Seis casillas con autofill |
| `PinKeypad` | L6 | Variante del `Keypad` sin operadores ni coma, con puntos de progreso |
| `InstitutionTile` | A6, E3 | Preset de banco/billetera con slot de logo |
| `ResultGroup` | B8, D1 | Header de grupo con label, contador y "ver todos" |
| `DismissibleNotice` | B1 | Aviso de una sola vez, sin nivel de estado ni acción primaria |
| `LineChart` | E2, E6.4 | Con eje temporal, labels directos min/máx y tooltip táctil |
| `ProgressBar` | E4.1, E6.1 | Una magnitud contra un techo |
| `AccountRow` | E (×5) | Consolida `ListRow variant="value"` + `Amount` |
| `RateRow` | E6 (×3) | Par + fuente + antigüedad + cifra mono + badge |
| `ResolutionChain` | E6.2 | Pasos numerados con uno activo |
| `GroupCard` | E8 (×3) | Caption + resumen + cifra editable + acción secundaria |

**Bloque L (sistemas transversales) — se hace acá porque todo lo demás lo consume**:
`EmptyState` · `Skeleton`/`SkeletonRow` por layout · `ErrorState` (qué pasó / qué implica /
qué hacer, en ese orden) · `OfflineBanner` · `UndoToast` · onboarding contextual de un paso ·
L6 pantalla de bloqueo (opcional, apagada por defecto, con **C1–C2 del lado de afuera del gate**).

**Primitivas de motion** en `src/components/motion/`: `Pressable` (scale 0.96 + haptic 8ms),
`CountUp` (odómetro 400ms, ancho estable), `StaggerList` (24ms, solo los primeros 8),
`MorphButton` (botón → círculo → check dibujado), `useHaptics()`, `useMotionIntensity()`
(completa / reducida / mínima, combinado con `prefers-reduced-motion`).

`src/app/dev/components/page.tsx` — cada componente con todos sus estados. Es la referencia viva
y el lugar donde se compara contra los `.dc.html`.

---

## Fase 4 — Shell de aplicación

`src/app/(app)/layout.tsx` con el chrome del sistema: `AppHeader` de 56px colapsable
(`[scope] — [título] — [búsqueda] [SyncDot]`), `TabBar` de 64px + safe area, FAB de 64px
superpuesto y centrado. Rutas base vacías con su estado vacío, para que la navegación exista
antes que el contenido.

Regla del cuarto slot: tres slots fijos + uno elegible entre módulos activos + "Más".
**La app nunca reconfigura la navegación sola.**

---

## Fase 5 — Bloque C · Captura rápida

**Referencia**: `perze-design/Bloque-C_Captura-rápida-de-transacciones/D5 Captura rapida.dc.html`
(11 vistas + sus estados) · `03-prompts-wireframes.md` § W3.

Ruta interceptada `/(app)/@modal/(.)add` con URL propia y back nativo; acceso directo por URL
también funciona (shortcut de la PWA y share target).

| Vista | Qué es |
|---|---|
| C1 a/b/c | Monto con keypad. **La fila de frecuentes vive acá, sobre el keypad** — el camino feliz baja a 2 taps y C2 pasa a fallback. Segmentado Gasto/Ingreso/Transferencia con selección por superficie. |
| C2 | Grid de burbujas de categoría, 3 columnas. Fallback, no camino principal. |
| C3 | Detalles en sheet sobre C1: cuenta, fecha, comercio, nota, tags, foto, dividir, recurrente. Todo con default. |
| C4 a/b/c/d | **Partido en tres**: chip de país → moneda aplicada → editor de rate en sheet. Badge `neutral` "sin conversión" si no hay rate. No existe con una sola moneda en uso. |
| C5 | Ingreso — "¿a qué cuenta entra?" |
| C6 a/b/c | Transferencia. **Entre monedas partida en dos pasos**: salida en pantalla, entrada confirmada en sheet. Nunca cuenta como gasto ni ingreso, y se dice en la interfaz. |
| C7 | Guardado y deshacer, 4 frames, ≤700ms, interactivo desde el frame 1. |
| C8 | Modo ráfaga con `Switch` real (no `Chip selected`) y contador. |
| C9 | Voz — Web Speech API, parser rioplatense, todo editable antes de confirmar, degrada limpio. |
| C10 | Foto de ticket — **entrada prevista, fase futura**. Se dibuja el punto de entrada, no el OCR. |
| C11 a/b/c | Los tres badges: *pendiente de sincronizar* (neutral) · *sin conversión* (neutral) · *rechazado* (critical). Ninguno cancela el guardado. |

**Invariante**: guardar no puede fallar. El guardado es local; la red es un detalle. No existe el
estado "no se guardó", existe "no se subió".

**Defaults inteligentes**: cuenta más usada en esa categoría con fallback a la última;
frecuentes ponderadas por hora del día y día de la semana; comercio autocompletado desde `payees`,
y cada comercio recuerda su categoría.

**Presupuesto de tiempo a cumplir** (declarado en el bloque): 2,90 s y 2 decisiones en el camino
feliz; 4,60 s y 3 decisiones en el peor caso. Instrumentar un contador de taps en dev.

**Tests**: unit de la máquina de estados del borrador, del parser de voz y de la ponderación de
frecuentes. E2E: gasto en 2 taps · gasto en moneda extranjera · gasto sin conexión · deshacer.

---

## Fase 6 — Bloque B · Home y navegación

**Referencia**: `perze-design/Bloque-B_Home-y-navegación-profundizada/Bloque B - Home y navegación.dc.html`
· `03-prompts-wireframes.md` § W2.

B1 en sus 3 variantes por **flags ortogonales**, no por perfil (`monedas > 1`, `miembros > 1`,
módulos activos) · B2 vacío · B3 skeleton · B4 offline con contador · B5 scope abierto ·
B6 tab bar · B7 "Más" en sus 2 variantes · B8 búsqueda global agrupada por tipo.

Orden de B1: hero de una sola cifra (default patrimonio neto, elegible en K3) con delta y
sparkline → tira de cuentas con snap → estado del mes → una insight card, nunca un stack →
5 últimos movimientos → aire para el FAB.

Excepción declarada y aceptada: Inicio usa **4 niveles tipográficos** en vez de 3; el cuarto lo
aporta `AccountCarousel`. No se corrige.

---

## Fase 7 — Bloque D · Movimientos

**Referencia**: `perze-design/Bloque-D_Movimientos-diseño-de-alta-densidad/Movimientos.dc.html`
· `03-prompts-wireframes.md` § W4.

D1 lista agrupada por día con headers sticky y resumen del período, virtualizada
(`@tanstack/react-virtual`) · D1 swipe (4 frames: resistencia a 96px → editar, 160px → borrar,
deshacer 5s, con equivalente por tap en el detalle) · D2 filtros en bottom sheet con contador de
resultados en vivo · D3 detalle con el rate usado y su fuente, adjuntos, autoría e historial ·
D4 editar con advertencia si cambia el rate de un movimiento viejo · D5 calendario del mes con
total por día · D6 estados (vacío, vacío por filtros, cargando, offline) · D7 selección múltiple.

Sin un solo separador de fila y sin un solo borde de caja: la densidad se resuelve con espaciado,
alineación de columnas y tres niveles tipográficos. **Gastos en tinta neutra; el aqua solo para
ingresos.** Las transferencias se marcan "no suma al total".

---

## Fase 8 — Bloque E · Cuentas y monedas

**Referencia**: `perze-design/Bloque-E_Cuentas-y-monedas/Bloque E - Cuentas y monedas.dc.html`
· `03-prompts-wireframes.md` § W5.

E1 lista agrupada por moneda con subtotales · E2 detalle con evolución del saldo a 90 días ·
E3 crear/editar con los **nueve** tipos de cuenta y campos condicionales · E4 tarjeta de crédito
(ciclo, cierre, vencimiento, proyección) · E5 conciliación (diferencia y ajuste) ·
E6.1–6.4 monedas y tipos de cambio por par (proveedor, cotización preferida, override con
vigencia, histórico) · E7 estados (sin cuentas, rate viejo, API caída — **nunca bloquear**) ·
**E8 resolver tipos de cambio faltantes en lote** (vista nueva que sale del estado `needs_fx`).

Para una sola moneda en uso: sin agrupación por moneda, sin banderas, sin conversión, y E6 no
existe.

---

## Fase 9 — Bloque A · Onboarding y auth

**Referencia**: `perze-design/Bloque-A_Onboarding-optimizado/Bloque A - Onboarding y auth.dc.html`
· `03-prompts-wireframes.md` § W1.

Con local-first la auth es simulada, pero **el flujo y las pantallas se construyen completos**
para que cambiar a Supabase Auth después sea reemplazar el adaptador, no rediseñar.

Camino crítico recortado, como lo dejó el bloque: **A2 → A3 → A4 → A5 → A6 → A11 → C1**.

- **A1, A8, A9 salen del camino.** La plantilla Básica se aplica en silencio (editable en K5);
  los módulos se activan después desde K4.
- **A10 (instalar la PWA) va después del primer gasto**, nunca antes.
- **Google y Apple pasan a ser el camino visualmente principal, y el magic link la alternativa.**
  Es el único cambio que hace cerrar el objetivo en p90 (35 s p50 / 48 s p90 contra 78 / 100).
- **A7 (saldo inicial) sale del camino crítico**: se pide después del primer gasto, en la misma
  pantalla donde se ofrece A10. El primer contacto con el keypad pasa a ser el gasto real.
- Abandono en A6–A9: al volver se entra directo al home vacío (B2) con una cuenta "Efectivo"
  creada por default. El onboarding no se repite.
- A5 decide si el módulo de grupo familiar arranca encendido.

Al terminar: household + primera cuenta con saldo inicial + categorías de la plantilla, todo en
una sola transacción de Dexie.

**Cierre**: borrar `src/app-old/` y las dependencias que quedaron sin uso.

---

## Reglas que no se negocian en ninguna fase

- Dinero en `bigint`, unidades mínimas. Todo cálculo por `lib/money`. Ningún componente formatea
  plata fuera de `<Amount>`.
- Sin `<select>` nativo. Sin `<input type="number">` para montos. Ningún target < 44×44.
  Acción primaria de 56–64px en los últimos 200px de la pantalla.
- Sin diálogos de confirmación para acciones reversibles: se ejecuta y se ofrece deshacer 5 s.
- Ninguna transición de interfaz > 320ms. Las cuatro excepciones documentadas (count-up 400,
  guardado ≤700, celebración 900, dibujado de línea 600) son no bloqueantes.
- Los 5 estados en cada pantalla: vacío, cargando, error, offline, con datos.
- Antes de renderizar algo de un módulo, chequear `enabled_modules`; si está apagado, el código
  no se importa.
- Cero strings hardcodeadas: todo por `next-intl`, en ES rioplatense (voseo) como idioma fuente.
- Presupuesto de ruido por pantalla, y si se excede se **declara con motivo** en el PR —
  no se comprime.

---

## Verificación

Por fase:

1. `pnpm build` limpio y `pnpm lint` sin warnings.
2. `pnpm test` (Vitest): tokens contra el doc 02 · `lib/money` · `lib/fx` y sus fallbacks ·
   máquina de estados del borrador.
3. `pnpm dev` y comparar a ojo contra el `.dc.html` del bloque, lado a lado. Los HTML se abren
   directo en el browser y están a 390×844, que es el mismo viewport del devtools.
4. `/dev/tokens` y `/dev/components` — toda pantalla que aporte un patrón nuevo entra ahí.
5. E2E (Playwright), los cuatro que importan: gasto en 2 taps con cronómetro · gasto en moneda
   extranjera sin cotización disponible (tiene que guardarse igual, con `needs_fx`) · 3 gastos
   con la red cortada y reconexión sin duplicados · signup → primer gasto por debajo de 90 s.
6. Lighthouse mobile: ≥ 90 performance, 100 accesibilidad. axe-core sin violaciones críticas.
7. Prueba manual con la red cortada en cada pantalla nueva: ninguna se rompe.
