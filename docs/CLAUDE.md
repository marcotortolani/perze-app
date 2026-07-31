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

**Dos cosas que no están donde uno las busca.** `L6`, la pantalla de bloqueo, vive en `docs/design/bloque-a-onboarding.html`, no en el archivo del bloque L. Y `E8` —resolver cotizaciones faltantes en lote, con sus dos vistas E8.1 y E8.2— está diseñada y en el mapa maestro pero **no figura en `03` ni en `04`**: es parte del inventario oficial y cierra la cadena de resolución de FX.

---

## Stack

- Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4
- shadcn/ui customizado · Motion (`motion`) · Lucide
- Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- TanStack Query v5 · Zustand · Dexie (outbox offline) · Zod v4
- Serwist (PWA) · Biome (lint + format) · Vitest + Playwright

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

**V9 sigue abierta y no bloquea la migración: el patrimonio no reconcilia.** § 2.5 dice que el saldo de la cuenta no se afecta por un movimiento sin cotización, pero el patrimonio sí los excluye — y E1 y K1 lo construyen sumando `accounts.current_balance`, que ya los incluye. O el patrimonio se calcula desde los movimientos con `amount_base IS NOT NULL`, o `accounts` necesita un segundo saldo convertible. Es una decisión de cálculo y hay que tomarla antes de programar E1.

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
5. **Faltan tres pantallas y hay cinco vistas huérfanas.** K9, el importador de CSV, **ya está diseñado** (K9a archivo · K9b columnas · K9c duplicados) y D05a queda cerrado. Siguen sin diseñar: el selector de transacción con tarjeta que alimenta G6, el formulario de "crear instrumento a mano" de I7, y el modo espejo de J4. Sin entrada desde ningún lado: I9, I10, I11, H12, J8. **Esto es lo único de los cinco que vuelve a diseño, no a código.**

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
- No existe `next lint` — usamos Biome
- **Tailwind v4:** `darkMode: 'class'` ya no existe en config JS. El modo oscuro se declara en CSS con `@custom-variant dark (&:where(.dark, .dark *));`
- **`@theme` emite un solo bloque `:root` y no soporta variantes claro/oscuro.** El patrón correcto es valores crudos en `:root` más overrides en `.dark`, expuestos con `@theme inline`

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
8. `pnpm check` y `pnpm build` pasan limpios

---

## Cómo trabajar

- **Un bloque, una rama, un PR.** No mezclar bloques.
- Las migraciones son **append-only** una vez pusheadas. Corregir con una nueva, nunca editando la anterior.
- Los tipos de Supabase se regeneran con `pnpm db:types`. **Nunca editarlos a mano.**
- Toda pantalla que aporte un patrón nuevo entra en `/dev/components`.
- Si el diseño y lo que se puede programar no coinciden, **decilo** en vez de desviarte en silencio.

## Comandos

`pnpm dev` · `pnpm build` · `pnpm test` · `pnpm e2e` · `pnpm check` (Biome) · `pnpm db:types` · `pnpm db:push`

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

## Decisiones abiertas

> Borrá esta sección cuando estén cerradas. Mientras estén acá, **preguntá antes de asumir**.

1. **Arranque sin conexión.** El estado offline de A3 ofrece "Empezar sin conexión", pero en ese punto no hay sesión y todo el schema apoya en `auth.uid()`. Requiere un almacén local pre-sesión que se reclama contra el primer login exitoso. Sin esa decisión, ese estado de A3 no se puede programar.
2. **Orden de A2.** Magic link principal con Google y Apple secundarios, o al revés. La propuesta es: primario el que esté configurado — con OAuth registrado, Google y Apple arriba; sin OAuth, el link por email.
3. **Licencia.** MIT o AGPL. La necesita K13 y el README del repo.
