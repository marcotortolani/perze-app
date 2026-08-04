# PERZE — Contexto del proyecto

App PWA de finanzas personales: gastos, cuentas, presupuestos e inversiones, con soporte multi-cuenta, multi-moneda y multi-país, y modo de grupo familiar. Proyecto personal que se va a liberar como open source.

**La app se juzga por una sola métrica: cargar un gasto en menos de 5 segundos y 3 decisiones.** Todo lo demás se subordina a eso.

---

## Cuándo dos fuentes se contradicen

Vas a encontrar contradicciones. Son inevitables: el diseño se hizo en once bloques a lo largo de semanas y los documentos de prompts son anteriores al diseño. **No elijas al azar y no promedies.** Este es el orden de autoridad, de mayor a menor:

1. **Este archivo.** Las decisiones cerradas de acá no se rediscuten.
2. **`docs/auditoria-visual.md`** — corrige a todo lo de abajo. Si la auditoría dice que algo está mal, está mal, incluido el contrato.
3. **`docs/contrato-componentes.md`** — para cualquier cosa sobre la API de un componente: props, tipos, estados, accesibilidad. Su § 0 son seis reglas que **se verifican en revisión de código, no de diseño**.
4. **`docs/design/<bloque>.html`** — el diseño real. Es la verdad de píxel, copy y estados. **Cuando dos archivos definen la misma vista, manda el que indica `docs/design/INDEX.md`**: los prompts de cierre modificaron pantallas existentes desde otro proyecto, así que hay vistas con dos versiones y la vieja no falla ruidosamente.
5. **`docs/02-design-system.md`** — tokens, paleta, tipografía, motion, reglas de gráficos.
6. **`docs/01-arquitectura-datos.md`** — schema, RLS, estrategia FX y offline.
7. **`docs/00-producto.md`** — intención de producto.

**`docs/03-prompts-wireframes.md` y `docs/04-prompts-ui.md` NO son especificación.** Son los prompts que se usaron para *generar* el diseño y quedaron versionados como historia. Contienen listas de pantallas que después se recortaron: el bloque A figura ahí con once pantallas y **entregó once**, pero solo ocho están en el camino crítico (A2→A3→A4→A5→A6→A7→A11→C1); A1, A8, A9 y A10 están diseñadas y fuera del camino, y hay que programarlas igual. **Si alguno de esos dos contradice a `docs/design/`, gana `docs/design/`.** Úsalos solo para entender la intención detrás de una pantalla, nunca para decidir qué pantallas existen.

Cuando encuentres una contradicción que este orden no resuelva, **paralo y preguntá**. No la resuelvas en silencio.

**Un documento, una copia.** El fallo más repetido de este proyecto no es una contradicción entre dos documentos: es **el mismo documento en dos rutas con contenido distinto**, donde la copia vieja no falla ruidosamente. Ya pasó con las vistas de diseño, con el contrato de componentes y con este mismo archivo. Las reglas:

- **`CLAUDE.md` vive solo en la raíz del repo.** Si aparece uno en `docs/`, es un residuo de haber descomprimido el paquete ahí: se borra, no se concilia.
- **`docs/` es la única ruta de autoridad** para `contrato-componentes.md`, `auditoria-visual.md` y los documentos numerados. Una segunda copia bajo `docs/design/` o donde sea es residuo.
- **`docs/design/INDEX.md`** es la excepción que confirma la regla: ahí sí hay varios archivos que definen la misma vista a propósito, y por eso existe un índice que dice cuál manda.

Antes de escribir código contra un documento, verificá que no haya otra copia: `find . -name "<archivo>" -not -path "./node_modules/*"`. Si hay dos, resolvelo antes de seguir.

**Dos cosas que no están donde uno las busca.** `L6`, la pantalla de bloqueo, vive en `docs/design/bloque-a-onboarding.html`, no en el archivo del bloque L. Y `E8` —resolver cotizaciones faltantes en lote, con sus dos vistas E8.1 y E8.2— está diseñada y en el mapa maestro pero **no figura en `03` ni en `04`**: es parte del inventario oficial y cierra la cadena de resolución de FX.

---

## Stack

- Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4
- shadcn/ui customizado · Motion (`motion`) · Phosphor Icons
- Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- TanStack Query v5 · Zustand · Dexie (outbox offline) · Zod v4
- Serwist (PWA) · ESLint (lint) · Vitest + Playwright

**No hay Docker en esta máquina, y no lo va a haber.** Supabase se usa contra un **proyecto remoto de desarrollo**, enlazado con `supabase link`. Funcionan sin Docker: `db push --linked`, `gen types typescript --linked`, `migration new`. **No funcionan y no hay que proponerlos:** `supabase start`, `supabase status`, `supabase db reset`, `supabase db pull` y `supabase db diff` sin `--linked`.

Dos consecuencias prácticas. Las migraciones **se escriben a mano** desde `docs/01-arquitectura-datos.md`, que ya tiene el schema completo: no se generan por diff. Y no existe el ciclo `db reset`: mientras no haya datos que conservar, el equivalente es un script que limpia el esquema y re-aplica todo — y si lo escribís, verificá los `GRANT` de los roles de Supabase después de recrear el esquema, que es donde eso se rompe.

El proyecto remoto del plan gratuito **se pausa a la semana sin actividad**. Cuando `db push` falle por conexión después de unos días sin tocar el proyecto, el problema casi seguro es ese y se despausa desde el panel — no persigas un bug de red.

---

## Corrección: las reglas que si se rompen cuestan una migración

**Dinero.** `bigint` en unidades mínimas. Nunca `number`, `float`, `parseFloat` ni `toFixed` sobre un monto. Todo cálculo pasa por `lib/money`. Cantidades y precios son `numeric(38,12)`, tasas `numeric(24,12)`.

**Códigos de moneda: `text`, nunca `char(3)`.** `USDT` no entra en tres caracteres y `char` rellena con espacios.

**El rate se congela.** `fx_rate` se guarda con la transacción y **nunca se recalcula**, ni en un backfill, ni al corregir la cotización del día. Un movimiento del pasado vale lo que valía.

**`needs_fx` — la regla más fácil de romper y la más cara.** Si no hay cotización disponible, el movimiento **se guarda igual, sin conversión**: `fx_rate` y `amount_base` quedan en `NULL` y `fx_source = 'pending'`. **Nunca rate = 1** — un 1 inventado es indistinguible de un 1 legítimo. Nunca se bloquea el guardado. Y la consecuencia que hay que propagar a todo el código: **todo agregado excluye los movimientos sin cotización y muestra el conteo excluido de forma visible**, con acceso a resolverlos. Aplica a saldos consolidados, presupuestos, patrimonio neto, portfolio y todos los análisis. Un agregado que los incluya como si valieran cero está mostrando un número falso.

La cadena de resolución tiene exactamente cuatro pasos y no hay un quinto: override manual → cotización del día → última conocida (`inherited`) → `pending`.

**`needs_fx` alcanza a cuatro tablas, no a una.** `transactions`, `trades`, `settlements` y los hijos (`transaction_splits`, `transaction_shares`). Las cuatro llevan `fx_source` y su `CHECK` pareado; los hijos heredan el estado del padre por trigger, porque un `CHECK` no puede consultar otra tabla. Está todo resuelto en `01` § 7.

**La única escritura legítima de un `amount_base` después de la inserción** es cuando un movimiento `pending` se resuelve: antes era `NULL`, no un valor congelado. Ahí también hay que recalcular el de sus hijos. Fuera de ese caso, un `amount_base` no se toca nunca.

**Hay DOS conversiones, no una, y confundirlas es V9.** `amount` y `currency_code` están **siempre en la moneda de la cuenta**: mueven `current_balance` y no necesitan FX jamás. Si el usuario cargó en otra moneda, eso va en `original_amount` / `original_currency` / `original_rate`, y esa conversión ocurre en la captura. `fx_rate` / `amount_base` van de moneda de cuenta a moneda base, y **`needs_fx` vive ahí y solo ahí**.

**Plata y cantidades son dos dominios.** `formatAmount(money, opts)` sobre `bigint` es el único camino para dinero y nunca toma `number`. `formatNumber(value, decimals)` es solo para cantidades de instrumento, que son `numeric(38,12)`: ahí sí hay un `number` y `decimals` no tiene default.

**RLS.** Toda tabla nace con RLS habilitado y sus políticas en la misma migración. Cada política de `UPDATE` necesita **`USING` y `WITH CHECK`**, las dos: sin `WITH CHECK` se puede mover una fila al household de otro. `auth.uid()` siempre envuelto en `(SELECT auth.uid())`. Las funciones helper van `SECURITY DEFINER` + `SET search_path = ''`. Las entidades hijas heredan acceso con `EXISTS` sobre el padre, nunca con un `household_id` duplicado que puede quedar desincronizado.

**`service_role`** solo en Edge Functions y cron. Jamás en el bundle.

**IDs** generados en el cliente (UUID v7) antes de la mutación, para idempotencia.

**Mutaciones** siempre optimistas y siempre por el outbox de Dexie.

**FX**: el cliente nunca llama a una API de cotización. Solo a `/api/fx`.

---

## Producto: decisiones cerradas

**Progresividad por flags ortogonales**, no por perfil. Los flags son: cantidad de monedas en uso, cantidad de miembros, módulos activos. **No existe un campo `perfil` en el modelo de datos** y no hay que crearlo. Si encontrás "perfil Simple" o "perfil Inversor" en `03` o `04`, es lenguaje viejo: traducilo a flags.

**Los módulos opcionales son seis** y esta es la lista que vive en `households.enabled_modules`: `budgets` · `goals` · `recurring` · `debts` · `investments` · `family`. **Análisis no es un módulo**: es un tab fijo cuyo contenido varía.

**Apagar un módulo oculta, nunca borra.** Las cuotas en curso **siguen descontando** porque ya son movimientos reales y pertenecen a la cuenta, no al módulo. Las posiciones de inversión salen del patrimonio neto con aviso del monto excluido. Los movimientos históricos no se tocan jamás. La advertencia al apagar lleva los números reales del usuario.

**Antes de renderizar cualquier cosa de un módulo, chequear `enabled_modules`.** Y si está apagado, **el código del módulo no debe llegar al cliente** — carga diferida, no un `if` en el render.

**El bloqueo por PIN es opcional y apagado por defecto.** Encendido, la captura queda **pre-auth**: el shortcut de la PWA, el share target, el widget y la notificación persistente entran directo al keypad sin pedir nada. El gate aparece recién al querer ver saldos, movimientos o análisis. Escribir no revela nada, leer sí. Tres PIN errados = 30 s de espera, nunca borrado de datos. La transacción recién guardada se edita durante 60 s sin desbloquear.

**El cuarto slot del tab bar lo elige el usuario** (default Análisis). La app nunca reconfigura la navegación sola.

**Instalar la PWA se ofrece después del primer gasto**, nunca antes. Una sola vez; si dice que no, vuelve recién al décimo gasto.

**El día de cierre del mes se configura por household**, no por usuario (`households.period_start_day`). Un solo período para todo el grupo: presupuestos compartidos, J2 y J7 cierran juntos sin reconciliar dos calendarios. No todos cierran el 1. "El mes" de cualquier análisis o presupuesto es el período del usuario, no el calendario.

**Mínimos de historial.** Un gráfico con dos puntos enseña una tendencia que no existe. Cada análisis declara su mínimo y, hasta alcanzarlo, muestra cuánto falta en vez del gráfico. La tabla completa está en `docs/00-producto.md`; los que más aparecen: patrimonio neto 7 días · categorías, flujo y comercios 1 período cerrado · tendencias y calendario 30 días · inflación y multi-moneda 2 meses · anomalías 20 movimientos en la categoría · XIRR 2 flujos y 30 días.

---

## Interfaz: las reglas que el diseño ya resolvió

**Presupuesto de ruido por pantalla:** 1 cifra héroe · 1 color de marca visible fuera de los gráficos · 1 acción primaria · 3 niveles tipográficos · 5 elementos interactivos sobre el pliegue · 0 bordes de caja evitables · 0 íconos decorativos. Si algo se pasa, se mueve a otra pantalla — no se comprime.

**La selección se muestra por superficie.** El relleno violeta se reserva para identidad de dato y filtro activo. En cada pantalla hay **un solo violeta visible y es la acción primaria**.

**Polaridad del dinero: nunca verde/rojo** — falla en daltonismo (ΔE 6.5). Ingresos en aqua, gastos en **texto neutro primario**. El naranja solo para destacar un gasto puntual o dentro de un gráfico. Siempre con codificación secundaria: signo, flecha y posición. El color nunca porta el significado solo.

**El logotipo no aparece dentro de la app.** Vive en el splash, el README y "acerca de". Adentro, el único violeta lo ocupa la acción primaria.

**Sin `<select>` nativo. Sin `<input type="number">` para montos.** Ningún target menor a 44×44. El botón primario mide 56–64 px, ancho completo, en los últimos 200 px de la pantalla.

**Reversible, no confirmable.** Se ejecuta y se ofrece deshacer. El toast con deshacer es el patrón por defecto; un diálogo de confirmación es la excepción que hay que justificar.

**Los errores proponen la corrección, no la nombran.** "Falta el final del dominio: probá vale.mendez@gmail.com", nunca "email inválido".

**Motion:** ninguna transición de interfaz supera 320 ms. Cuatro excepciones no bloqueantes: count-up 400 ms, secuencia de guardado ≤700 ms, celebración 900 ms, dibujado de línea en gráficos 600 ms. `prefers-reduced-motion` respetado, más el ajuste propio de intensidad (completa / reducida / mínima).

**Gráficos:** paleta de datos de 5 slots en orden fijo con gris para "Otros" · barras finas con extremo redondeado de 4 px anclado a la baseline · líneas de 2 px con markers ≥8 px · separador de 2 px entre segmentos apilados · grilla hairline solo horizontal · leyenda siempre que haya ≥2 series · el texto en tokens de tinta, nunca en el color de la serie · **nunca eje dual** · toggle "ver como tabla" en cada card · tooltip táctil con offset vertical de 48 px.

**Ningún componente formatea plata a mano.** Solo `<Amount>`. La precisión decimal se **deriva** del par de monedas o del instrumento — 8 decimales para bitcoin, 0 para pesos — nunca se asume.

**Toda fecha, hora o número decimal se muestra con el formato que vive en Ajustes → Formato, nunca hardcodeado.** `useDateFormatPreference()` + `formatNumericDate()` para fechas, `decimalSeparatorForLocale()` para el separador — nunca un `Intl.DateTimeFormat` o un `.toFixed()` sueltos que decidan el formato por su cuenta. La razón es doble: si el usuario cambia el ajuste, **todas** las pantallas que muestran ese dato tienen que reflejarlo solas, sin ir pantalla por pantalla; y un `${y}-${m}-${d}` armado a mano en JSX es exactamente el bug que ya pasó una vez (recurrentes mostrando ISO crudo en vez del formato elegido). Las fechas "narrativas" (nombre de mes/día — `formatDateShort`/`formatDateLong`, la mayoría de la app) son la excepción declarada: esa elección de diseño no depende del ajuste numérico, pero tampoco se hardcodea un string de fecha — sigue saliendo de `Intl` vía locale.

**Huso horario: se guarda en UTC, se muestra en el huso del dispositivo, nunca en un huso guardado como preferencia.** `transactions.occurred_at` y toda fecha-hora son `timestamptz` UTC de punta a punta. La conversión al huso del usuario pasa siempre por `Intl`/`Date` sin `timeZone` explícito — eso lee el reloj del sistema operativo en el momento de renderizar, así que si el usuario viaja y cambia de país, ve la hora correcta sin tener que tocar un ajuste (guardar el huso como preferencia sería pedirle un paso extra que casi nadie hace, y muestra la hora vieja hasta que lo hace). Consecuencia para cualquier fecha-sin-hora que se sintetice en el cliente (un "día calendario" que no vino de una columna `timestamptz`, como una ocurrencia futura de un recurrente): se construye a **mediodía UTC**, nunca a medianoche — medianoche UTC cae en el día anterior en cualquier huso negativo (Uruguay, Argentina: UTC-3) apenas se formatea en hora local, que es exactamente el bug que hizo que "1 de septiembre" se mostrara como "31 de agosto". Mismo criterio para "hoy": `todayIso()` (`src/lib/dates/today.ts`, D10), nunca `new Date().toISOString().slice(0, 10)` — ese slice toma el día en UTC y adelanta la fecha entre las 21:00 y las 00:00 locales en cualquier huso negativo.

**Cero strings hardcodeadas.** Todo por `next-intl`, en ES/EN/PT.

---

## Componentes

`docs/contrato-componentes.md` es la fuente de verdad **del delta v2**, no de la biblioteca entera. La reconciliación midió el uso real: las pantallas instancian **34 componentes y 20 no tienen ficha**, incluidos `Button`, `AppHeader`, `Amount` e `Icon`. Cuatro no se mencionan en ninguna parte: `FxEditor`, `AmountScrubber`, `CategoryBubble` y `DateStrip`.

`docs/library/perze-v2.jsx` tiene 27 exports y su línea 12 importa `./core`, **que no está en el repo**. Portalo igual, pero sabiendo que cubre menos de la mitad: los otros 31 componentes se portan desde el bundle del diseño. Lo que el contrato marca `[spec]` no tiene código en ningún lado —cero de 29— y es igual de vinculante.

**No inventes componentes.** Si necesitás uno que no está en el contrato, paralo y decímelo antes de escribirlo.

Cinco cosas del contrato que se rompen si no se leen:

- **`Keypad` y `PinKeypad` son dos componentes, no una variante.** Comparten `KeypadKey` y nada más: producen valores de distinto tipo, anuncian cosas opuestas por `aria-live` y tienen modelos de error distintos. No los unifiques con una prop.
- **`formatNumber(value, decimals)` exige `decimals` y no tiene default.** La precisión se deriva con `decimalsFor()` del par de monedas o del instrumento. `PRECISION` es solo el default por moneda. **Ningún componente de dinero llama a `toFixed(2)`** — es la forma en que bitcoin se redondea a dos decimales sin que nada falle visiblemente.
- **El escalamiento por edad vive adentro de `StatusBadge`** (`neutral` + `ageDays >= 7` → `warning`). Ninguna pantalla lo calcula.
- **`ScopeSwitcher` está eliminado, sin alias.** El contrato lo elimina y `perze-v2.jsx` no lo tiene, pero **el bundle del diseño todavía lo exporta como alias de `SegmentedControl`**. El Gate 3 se evalúa contra el código de la app, nunca contra el bundle.
- **`NeedsFxBanner` muestra conteo, nunca monto.** Un movimiento sin rate no tiene `amount_base`: sumar montos de tres monedas distintas da un número sin significado. El `[spec]` del contrato lleva `amount` y hay que sacarlo; H1a, H5 y H7 hoy muestran "3 sin cotización · $ 4.180 afuera" y hay que corregirlas. E8, F1 y F5 ya lo hacen bien.
- **Toda prop de tamaño se normaliza adentro del componente.** `typeof v === 'number' ? v : parseFloat(v)`. Ya rompió dos veces: `SplitBar height="20"` y `Skeleton height="40"` renderizaron en cero porque React no le agrega `px` a un string.

---

## Lo que la auditoría visual dejó pendiente

`docs/auditoria-visual.md` tiene 49 IDs, de los cuales **siete dicen "cumple"** (D23, D35, D37, D38, D39, D41, D49): son ~41 defectos reales. El propio archivo se contradice —dice 41 arriba y 49 en el cierre—, así que **citá el ID, no el número**. Además su sección de alcance ya no aplica: A, B, C, D, E y K se auditaron "por contrato, no por píxel" porque desde ese proyecto no se abrían los archivos, y ahora sí se abren. Los defectos marcados `[cruzado]` (D12, D34, D41, D47) están sin verificar contra el diseño real. **Cinco hay que resolverlos antes de programar pantallas**, y cuatro de los cinco son de token o de componente, así que caen en las fases de tokens y de biblioteca, no en rediseño:

1. **`EmptyState` usa un ícono de línea y el sistema de marca pide `ZMark` al 20%.** Hay 68 estados vacíos ya diseñados sobre el componente viejo. Se arregla en el componente, una vez.
2. **La selección por superficie es invisible en modo claro.** `#F5F5F4` contra `#EEEEEC` da **1,065:1** de contraste — indistinguible. En oscuro da 1,14:1, apenas. Afecta al mecanismo central de selección de toda la app: segmentados, chips, burbujas de categoría, tira de días, carrusel de cuentas, pills, `SelectableRow`, `OptionCard`, `InstitutionTile`. **No se arregla oscureciendo `--surface-3`**, que también es inputs y keypad: hace falta un token propio de selección más un anillo con contraste real. Referencia medida: superficie de selección clara en `#DEDEDA` (1,24:1 contra surface-2) y anillo en `#C9C9C4` (1,43:1). Es una decisión de la fase de tokens y hay que tomarla antes de escribir un solo componente seleccionable.
3. **Trece agregados muestran un número sin declarar los `needs_fx` excluidos**: H3, H8, H9, H11, F2, G1, G4, I2, I3, I11, J2, J7 y el patrimonio de K1. El más grave es J7, donde un gasto compartido en dólares sin cotización cambia quién le debe a quién. Se resuelve con `NeedsFxBanner` más la regla de que todo componente que sume declara su exclusión.
4. **`SplitBar` pinta sus partes con la paleta de datos y `charts.css` lo prohíbe textualmente.** En I9 el riel de allocation queda con violeta de marca dentro de un control arrastrable.
5. **Cerrado.** K9 se diseñó completo (K9a archivo · K9b columnas · K9c duplicados), G6a y I7b llenaron los dos pasos que faltaban, las cinco vistas huérfanas —I9, I10, I11, H12, J8— tienen entrada, y el modo espejo de J4 existe. **No queda ninguna pantalla sin diseñar.** Lo que sí queda es la consecuencia: varias vistas tienen dos versiones en archivos distintos, y **`docs/design/INDEX.md` es el que dice cuál manda**. Programar contra la versión vieja no falla ruidosamente.

Además, tres reglas que la auditoría pide escribir porque hoy no están en ningún lado y el primero que programe va a elegir al azar:

- **Cuándo se gana `hero-xl` 64** en vez de `hero` 40. Hoy aparece en J7 y H11 sin regla.
- **`critical` contra naranja de polaridad.** Presupuesto excedido es estado; rendimiento negativo es polaridad. Está bien que sean colores distintos, pero hay que declararlo.
- **Cuándo se repite el símbolo `$` en una lista.** Hay dos convenciones conviviendo.

Y una invariante que ningún componente puede verificar solo: **el presupuesto de ruido**. La primera pantalla con `Switch` encendido + botón primario + chip seleccionado lo viola sin que nadie lo note. Mitigación pedida por el contrato: **una regla de lint que cuente usos de `--primary-fill` por archivo de pantalla**, y `StatTile size="compact"` disponible antes de que se escriba H1.

---

## Gotchas de Next.js 16 y Tailwind v4

- `middleware.ts` → `proxy.ts` (runtime Node)
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` son **async**
- `revalidateTag(tag, profile)` requiere perfil de `cacheLife`; `updateTag()` en Server Actions para read-your-writes
- Turbopack es el bundler por defecto
- Todo slot de ruta paralela necesita su `default.js` explícito
- No existe `next lint` — usamos ESLint directo (`pnpm lint`)
- **Tailwind v4:** `darkMode: 'class'` ya no existe en config JS. El modo oscuro se declara en CSS con `@custom-variant dark (&:where(.dark, .dark *));`
- **`@theme` emite un solo bloque `:root` y no soporta variantes claro/oscuro.** El patrón correcto es valores crudos en `:root` más overrides en `.dark`, expuestos con `@theme inline`

**Tailwind por defecto, `style={{}}` solo para lo que Tailwind no resuelve.** Los tokens de
diseño ya están expuestos como utilities vía `@theme inline` en `globals.css` (`bg-surface-2`,
`text-text-muted`, `rounded-card`, `rounded-chip`, `rounded-input`, etc. — la escala de espaciado
de Tailwind v4 es de 0.25rem, así que `gap-4`/`p-4`/`px-3.5` calzan exacto con los `--space-*` y
paddings de 16/16/14px que se venían escribiendo a mano). Para código nuevo o que se esté
tocando: `display/flexDirection/gap/padding/margin/alignItems/justifyContent` fijos y colores de
token sobre un nodo DOM plano van por `className`. `style={{}}` queda para tres casos, y solo
esos: la prop `style` de un componente del design system (`Button`, `Input`, `ListRow`, etc. —
**no aceptan `className`**, no hay otra vía), un valor dinámico/calculado en runtime (`flex:
condición ? 2 : 1`, una animación de `motion`), o una custom property que se está *asignando*.
Las clases `t-caption`/`t-body`/`t-label`/etc. (tipografía con token) no compiten con esto, son
el mecanismo correcto y siguen igual. **Esto no dispara una migración retroactiva** del
`style={{}}` que ya existe en el resto de la app — aplica hacia adelante.

---

## Convención de rutas: qué vive dentro de `(app)/` y qué no

**El grupo `(app)/` es solo para las pantallas con tab bar persistente** (home, cuentas,
movimientos, análisis, más). Un flujo de pantalla completa —sin tab bar, sin el chrome del
shell— vive **fuera** de `(app)/`, como hermano del grupo. Ejemplos ya en el repo:
`src/app/accounts/new`, `src/app/accounts/[id]/edit`, `src/app/transactions/[id]/edit` y
`src/app/add`. No es un descuido: mezclar un flujo full-screen adentro de `(app)/` le hereda
el layout con tab bar, que ninguna de esas pantallas quiere.

**El caso `add` tiene además el patrón de ruta interceptora.** `src/app/add/page.tsx` es la
ruta real, full-screen, para navegación dura (shortcut de la PWA, share target, deep link).
`src/app/(app)/@modal/(.)add` la intercepta cuando la navegación es blanda (tap en el botón
primario estando ya adentro de la app): mismo destino, pero se dibuja como modal sobre el
tab bar en vez de reemplazar la pantalla. Replicar este mismo patrón —ruta hermana +
interceptora en `@modal`— para cualquier otro flujo que deba abrirse tanto por deep link
como por modal desde adentro.

---

## Definición de "terminado" para una pantalla

Antes de decir que una pantalla está lista, las ocho tienen que ser ciertas:

1. Coincide con `docs/design/<bloque>.html` en estructura, copy y jerarquía
2. Los cinco estados existen: vacío, cargando (skeleton), error, offline, con datos
3. Lecturas por TanStack Query con keys tipadas; escrituras por `createOptimisticMutation()`
4. Chequeo de `enabled_modules` si pertenece a un módulo, con carga diferida del código
5. Cero strings hardcodeadas; listas de más de 50 items virtualizadas
6. Si muestra un agregado, excluye los `needs_fx` y muestra el conteo excluido
7. Test unitario de la lógica y e2e del camino feliz
8. `pnpm lint` y `pnpm build` pasan limpios

---

## Cómo trabajar

- **Un bloque, una rama, un PR.** No mezclar bloques.
- Las migraciones son **append-only** una vez pusheadas. Corregir con una nueva, nunca editando la anterior.
- Los tipos de Supabase se regeneran con `pnpm db:types`. **Nunca editarlos a mano.**
- Toda pantalla que aporte un patrón nuevo entra en `/dev/components`.
- Si el diseño y lo que se puede programar no coinciden, **decilo** en vez de desviarte en silencio.

## Comandos

`pnpm dev` · `pnpm build` · `pnpm test` · `pnpm e2e` · `pnpm lint` (ESLint) · `pnpm db:types` · `pnpm db:push`

---

## Schema: las seis decisiones cerradas

Están implementadas en `01-arquitectura-datos.md` y registradas en su § 7. No se rediscuten.

1. **Visibilidad por miembro.** `visibility` suma el valor `'custom'` y `visibility_grants` guarda **solo las excepciones**. El caso frecuente —todo compartido o todo privado— se resuelve con una comparación de columna, no con un join. El helper es `can_see()`. **El modo espejo no se implementa en RLS**: es una consulta del lado servidor que aplica `can_see` con el `member_id` del otro, y nunca amplía el acceso de quien mira.
2. **Catálogos globales: Patrón C.** Lectura para todo autenticado, escritura solo por seeds y Edge Functions, y **clonado al editar** con `source_id`. Una fila global no se muta nunca desde el cliente.
3. **`fx_source` y `CHECK` pareado** en `trades`, `settlements`, `transaction_splits` y `transaction_shares`.
4. **`sync_state`** en `transactions` con `'ok' | 'rejected' | 'conflict'` más `sync_error`. Lo que nunca llegó al servidor vive solo en el outbox de Dexie y no tiene fila.
5. **`fx_overrides`** como tabla con `valid_from` / `valid_to`. Es el paso 1 de la cadena de resolución y se consulta **por la fecha del movimiento**.
6. **Clasificación raíz/hija**: la propone Claude Code en una pasada. Raíz lleva `household_id` y ancla la política; hija se alcanza con `EXISTS` sobre el padre y nunca duplica `household_id`.

---

## Las tres últimas decisiones, ya cerradas

**Licencia: MIT.** Para un proyecto personal que se libera por gusto, es la que deja que alguien lo tome y haga lo que quiera. Desbloquea K13 y C21.

**Orden de A2: lo decide la configuración, y lo que no está configurado no se renderiza.** Con OAuth registrado, Google y Apple son los botones primarios y el campo de email colapsa bajo "usar mi email" — ese camino mide unos 35 segundos y es el único que arregla el p90 de los 90 segundos. Sin OAuth, el campo de email es primario y los botones de Google y Apple **no se dibujan**: no van deshabilitados en gris, van ausentes. Un botón muerto en un self-host sin credenciales se lee como una app rota. Es una pantalla con dos estados, no dos diseños.

**Arranque sin conexión: se descarta.** El estado offline de A3 ofrecía "Empezar sin conexión" con una tarjeta de "mientras tanto podés cargar gastos". **Eso no se programa.** Sostenerlo exige una identidad local sin sesión, `household_id` colgando de nada, un reclamo transaccional contra el primer login, y una historia de conflicto para el caso en que el usuario entre a una cuenta que ya tiene datos. Todo eso para un usuario que **todavía no cargó nada**: la regla de que la app nunca puede perder un gasto protege a quien ya tiene cuenta, y acá no hay nada que perder. El que se quedó sin señal en el medio del signup espera un minuto.

Consecuencia concreta, y hay que respetarla al programar A3: **el diseño muestra una tarjeta "MIENTRAS TANTO" y un botón primario "Empezar sin conexión" que el código NO implementa.** La pantalla queda con el estado de error, la línea de que el email quedó guardado y se manda solo al volver la señal, y "Probar de nuevo". No es un olvido ni una pantalla a medias: es esta decisión. Si alguien la "restaura" mirando el archivo de diseño, está reabriendo esto.

Se puede sumar en una versión futura sin migración: la maquinaria de outbox ya existe y lo único que falta es la identidad previa a la cuenta.

---

## Las dos decisiones de imagen, cerradas

**Logos de instituciones: baldosa de monograma, no el logo real.** A6 muestra presets de bancos y billeteras. Esos logos son marcas registradas de terceros: en un repo privado no pasa nada, el día que se libera se está distribuyendo propiedad intelectual ajena. Y hoy además todas se ven iguales, porque comparten un ícono genérico.

La solución son **dos letras sobre el color de la institución**, que es un dato de la tabla `institutions` —ya tiene la columna `color`— y no un archivo. Se distinguen entre sí, no hay un solo binario de terceros en el repo, y funciona sin conexión porque no hay nada que descargar. `institutions.logo_url` queda como slot opcional para quien quiera poner los logos reales en una carpeta local ignorada por git. Toca **A6, E1 y E3**.

**Banderas: no van en ningún lado.** Y esto es más simple que "usar un chip", que era mi propuesta anterior.

Los emoji de bandera **no se renderizan en Chrome sobre Windows**: aparecen las dos letras del código regional en un recuadro. Eso solo ya los descarta. Pero mirándolo de cerca hay dos casos distintos y se resuelven distinto:

- Donde el token identifica una **moneda** —los pares de E6, H6, I2, las listas de K3— la bandera es directamente el símbolo equivocado: es del país, no de la moneda, y se rompe sola apenas entran el dólar o el euro. Va un **chip con el código**: `UYU`, `USD`, `ARS`.
- Donde identifica un **país** —A4 y el país de una cuenta— la bandera es semánticamente correcta, pero **al lado ya está el nombre del país escrito**. O sea que es un ícono decorativo, y el presupuesto de ruido los prohíbe. Se va, queda el nombre.

Resultado: **cero banderas en toda la app**, chip de código donde hace falta identificar una moneda, nombre del país donde hace falta identificar un país. Sin set de SVG que mantener. Toca **A4, E6, H6, I2 y K3**.
