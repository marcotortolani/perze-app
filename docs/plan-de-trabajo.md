# Plan de trabajo — PERZE

Estado de referencia: **2026-07-31**. Este documento es el mapa de todo lo que falta para
llevar PERZE de "diseño cerrado + Bloques A-E parcialmente programados contra un schema
viejo" a producto completo. Se relee al empezar cada sesión: cada ítem lleva un estado
propio y no hay que reconstruir el contexto desde cero.

No hay estimaciones en horas. El tamaño (`chico` / `mediano` / `grande`) es relativo entre
ítems de este documento, no una promesa de tiempo.

Convenciones de estado: `pendiente` · `en curso` · `hecho` · `bloqueado`.
Los ítems marcados **⚠ DECISIÓN** necesitan una respuesta del usuario antes de poder
ejecutarse — la pregunta exacta está en su propia fila.

---

## 0. Resumen ejecutivo

**Diseño**: cerrado. Once bloques, contrato de componentes publicado, auditoría visual
corrida, marca resuelta. La verificación de qué archivo manda para J2/J4 ya se corrió
(§ 1.8) — ninguno quedó pisado por la adenda del modo espejo.

**Schema**: escrito de cero en `01-arquitectura-datos.md` con sus siete decisiones
cerradas, pero **cero migraciones aplicadas**. No hay base de datos.

**Código**: Bloques A-E tienen implementación parcial (80 componentes, 28 rutas, 7 hooks)
hecha **antes** de que el schema actual y el contrato v2 existieran. Esa base:

- Ya tiene bien lo estructural: `lib/money` y `lib/fx` son limpiamente `bigint`/fixed-point,
  sin `parseFloat` sobre plata en ningún lado.
- Tiene un bug de plata real y localizado: el delta/sparkline del hero de Home usa
  aritmética flotante (CON-06).
- Le falta por completo el modelo de dos conversiones: `TransactionRow` no tiene
  `originalAmount`/`originalCurrency`/`originalRate`, y `SettlementRow` no tiene ningún
  campo de FX.
- No tiene manejo de estado de error en ningún hook ni pantalla — el estado "error" de
  la Definición de Terminado está ausente en el 100% de lo programado hoy.
- Tiene 4 defectos de componente puntuales y una brecha de biblioteca grande: de los
  34 componentes que las pantallas instancian, 20 no tienen ficha en el contrato, y de
  las 29 piezas `[spec]` del contrato, 0 tienen código.

**Tamaño de lo que falta** (contado en § 5 y § 6): **119 pantallas/vistas** por programar
o reprogramar contra la biblioteca nueva, **18 componentes `[spec]` genuinamente nuevos**
(los otros 11 de las 29 piezas `[spec]` ya tienen una versión parcial en el código y se
resuelven en CONCILIAR), **12 migraciones** de schema con sus políticas y tests de RLS, y
**3 gates duros** que hoy están en cero (en particular Gate 1: cero tests de RLS pese a
ser bloqueante declarado).

**La PWA hoy no es instalable.** Los assets de marca están generados en `docs/marca/assets/`
con su propio README, pero nada de eso está cableado en `src/app/` ni en un
`manifest.webmanifest` real — sin eso no hay ícono, no hay splash y el navegador no ofrece
instalar. Es trabajo de C1 y C5, ver § 5.2.

**Contradicciones nuevas encontradas al armar este plan** (no estaban en
`reconciliacion-sesion-0.md`, se suman a las que ya trae): ver § 1. **Cero decisiones
abiertas en todo el proyecto.** Las dos que venían de `CLAUDE.md` (§ 1.6 orden de A2,
§ 1.7 arranque sin conexión) y las dos de marca que surgieron armando este plan (§ 1.10
logos de institución, § 1.11 banderas) están todas resueltas y ya escritas en `CLAUDE.md`.
Desbloquean **CONS-A02**, **CONS-A03** (pasan a `en curso`), y **CON-29**/**CON-30** en
§ 4, con la nota cruzada en las ocho pantallas que tocan (A4, A6, E1, E3, E6, H6, I2, K3).

---

## 1. Contradicciones y decisiones abiertas

Estas paran el trabajo correspondiente hasta que alguien responda. No se resuelven en
silencio — es la instrucción explícita de `CLAUDE.md`.

### 1.1 ✅ RESUELTO — Dos archivos de contrato de componentes con contenido distinto

`docs/contrato-componentes.md` (385 líneas, la ruta de autoridad) y
`docs/design/contrato-componentes.md` (398 líneas, sin trackear en git) diferían en un
bloque de 13 líneas: la distinción `formatAmount` (bigint, plata) vs. `formatNumber`
(number, cantidades). **Decisión**: la ruta de autoridad es `docs/contrato-componentes.md`
y el contenido correcto es el que tenía ese bloque. Ejecutado: el contenido se movió ahí y
la copia de `docs/design/contrato-componentes.md` se borró. Item de ejecución: **CON-00**
en § 4 — hecho.

### 1.2 ✅ RESUELTO — `docs/CLAUDE.md` era un residuo, no una segunda fuente

`docs/CLAUDE.md` (copia dentro de `docs/`) todavía decía que V9 (la confusión de las dos
conversiones de FX) "sigue abierta y no bloquea la migración", contra el `CLAUDE.md` raíz
que ya la trae resuelta vía el split `original_*`/`fx_rate`+`amount_base` (§ 4, CON-05).
**Decisión**: `CLAUDE.md` vive solo en la raíz; `docs/CLAUDE.md` era residuo de haber
descomprimido el paquete de diseño adentro de `docs/`, no una segunda fuente con contenido
propio — no se concilia, se borra. Ejecutado. Item de ejecución: **CON-01** en § 4 — hecho.

### 1.3 ✅ EJECUTADO — Auditoría visual: la sección "orphans/missing" no se actualizó

`docs/auditoria-visual.md` (idéntico a `docs/design/AUDITORIA-VISUAL.md`) todavía describía
D05/D06 como abiertos y decía explícitamente "esto es lo único de los cinco que vuelve a
diseño, no a código", contra el `CLAUDE.md` raíz que dice que este punto está "Cerrado".
Esto era ejecución, no decisión — actualicé las dos copias del archivo (siguen idénticas
entre sí) para que D05a-d y D06a digan "Cerrado" con referencia a G6a/I7b/J4b y a
`docs/design/INDEX.md` para el archivo que manda en cada caso. Item de ejecución: **CON-02**
en § 4 — hecho.

### 1.4 Nota — la cifra "diecisiete" no viene de ningún documento fuente

Era un número que yo mismo introduje al pedir este plan y estaba mal; ya se sacó del
prompt original. No hay ítem de ejecución ni cifra que perseguir — la lista de arreglos
que tocan código es la tabla completa de § 4, no un conteo aparte.

### 1.5 ✅ RESUELTO — Licencia

**MIT.** Desbloquea **CONS-K13** (pantalla de licencia/acerca de) y **CONS-OSS/C21** (prep
open source: README, `.env.example`, CONTRIBUTING) — ambos pasan de `bloqueado` a
`pendiente` en § 6.13 y § 6.14.

### 1.6 ✅ RESUELTO — Orden de A2

**Lo decide la configuración, no un diseño fijo.** Con OAuth registrado, Google y Apple
son los botones primarios y el campo de email colapsa bajo "usar mi email". Sin OAuth
registrado, el email es el campo primario y los botones de Google/Apple **no se
renderizan** — ausentes, no deshabilitados. Es una pantalla con dos estados según una
variable de entorno, no dos diseños que haya que elegir entre sí. Desbloquea **CONS-A02**.

### 1.7 ✅ RESUELTO — Arranque sin conexión

**Se descarta.** El estado offline de A3 **no implementa** la tarjeta "MIENTRAS TANTO" ni
el botón primario "Empezar sin conexión" que dibuja el archivo de diseño — ese flujo
necesitaría un almacén local pre-sesión que nada del schema soporta, y no se va a
construir. La pantalla queda con `ErrorState`, la línea de que el email quedó guardado y
se manda solo al volver la señal, y "Probar de nuevo". Es una decisión de producto, no una
pantalla incompleta: quien la programe no debe "completarla" mirando el archivo de diseño.
Aviso hecho a **L3** (§ 6.4), que hereda el mismo patrón de error y no debe reintroducir el
botón de arranque sin conexión en ningún otro punto donde aparezca `ErrorState`. Desbloquea
**CONS-A03**.

### 1.8 ✅ EJECUTADO — INDEX.md no había verificado su propia tabla de versiones ganadoras

`docs/design/INDEX.md` marcaba a **J2** (por segunda vez, si `adenda-02-modo-espejo.html`
volvió a tocarlo) y **J4** (¿gana `bloque-j-familiar.html` o `adenda-02-modo-espejo.html`?)
como sin verificar, con los comandos de grep ya escritos pero sin correr. Esto era
ejecución, no decisión — corrí los tres comandos de la § _Cómo se verifica_ de INDEX.md:

- **J2**: sigue mandando `adenda-01-huecos-navegacion.html`. La propia adenda 02 lo dice
  como texto de diseño: "J2 no se tocó".
- **J4**: manda `bloque-j-familiar.html`, sin cambios. El botón "Ver la app como Ana" que
  promete el modo espejo vive ahí; `adenda-02-modo-espejo.html` no rediseña esa pantalla,
  solo dibuja el destino nuevo (**J4b**).

`docs/design/INDEX.md` está actualizado con estas dos filas sin ⚠ pendiente. Item de
ejecución: **CON-03** en § 4 — hecho.

### 1.9 ✅ RESUELTO — Fase de L6

`docs/design/INDEX.md` confirma que L6 (pantalla de bloqueo) vive en
`bloque-a-onboarding.html`, pero `05-prompts-desarrollo.md` pone L1-L6 dentro de C9 sin
mencionar la excepción. **Decisión: L6 va en C7**, con el razonamiento ya escrito acá — es
la puerta de entrada pre-auth (shortcut PWA, share target, widget) y comparte
`KeypadKey`/`PinKeypad` con el resto de C7. Ítem **CONS-A12** en § 6.2, ya sin ⚠.

### 1.10 ✅ RESUELTO — Logos de institución en A6/E1/E3 son marca registrada de terceros

**Baldosa de monograma, no el logo real.** Dos letras sobre el color de la institución,
que sale de `institutions.color` (ya existe en la tabla) y no de un archivo. Distingue a
las instituciones entre sí (hoy todas comparten un ícono genérico), no mete un solo
binario de terceros en el repo, y funciona sin conexión porque no hay nada que descargar.
`institutions.logo_url` queda como slot **opcional** para quien quiera poner los logos
reales en una carpeta local ignorada por git — nunca en el repo público. Toca **A6, E1 y
E3** (`InstitutionTile`). Ya escrito en `CLAUDE.md`. Item de ejecución: **CON-29** en § 4
— resuelto.

### 1.11 ✅ RESUELTO — Banderas de país/moneda

**Cero banderas en toda la app — y son dos casos distintos, no uno.** Las emoji de
bandera no se renderizan en Chrome sobre Windows (muestran el código regional en un
recuadro), pero el problema de fondo es semántico, no solo de compatibilidad:

- Donde el token identifica una **moneda** — los pares de **E6**, **H6**, **I2**, las
  listas de **K3** — va un **chip con el código** (`UYU`, `USD`, `ARS`), porque la bandera
  es del país y no de la moneda, y se rompe apenas conviven dólar y euro.
- Donde identifica un **país** — **A4** y el país de una cuenta (**E3**) — la bandera se
  **elimina** y queda el nombre solo, porque al lado ya está escrito y un ícono decorativo
  viola el presupuesto de ruido.

Sin set de SVG que mantener. Ya escrito en `CLAUDE.md`. Item de ejecución: **CON-30** en
§ 4 — resuelto.

---

## 2. Los tres gates (barreras duras)

Van en el lugar exacto de `07-handoff-a-claude-code.md` § 5. Ningún ítem posterior al gate
puede pasar a `en curso` mientras el gate esté `pendiente`.

| Gate | Después de | Criterio de paso | Estado hoy |
|---|---|---|---|
| **GATE-1 — RLS** | C2 (schema) | Por cada tabla: un test autenticado como household A que intenta leer/escribir/actualizar/**mover** una fila del household B, y falla en las cuatro. Sin este test la fase no está terminada. | **Cero tests.** No hay ni schema ni RLS todavía — bloquea todo lo posterior a C2. |
| **GATE-2 — Dinero y FX** | C3 + C4 | (a) cero `number`/`parseFloat` sobre un monto en todo el repo; (b) un movimiento sin cotización se guarda con `fx_rate`/`amount_base` en `NULL`, nunca rate=1; (c) el token de selección se ve en los dos modos, verificado con medidor de contraste, no a ojo. | **Falla (a) hoy mismo**: el sparkline del hero de Home usa `Number()`/`Math.round`/`BigInt` (§ 4, CON-06). (b) se cumple donde existe needs_fx. (c) no aplica todavía — el token de selección nuevo no existe (§ 4, CON-08). |
| **GATE-3 — Biblioteca** | C6 | Las 29 piezas `[spec]` existen o están explícitamente diferidas con motivo. `EmptyState` usa `ZMark`. `SplitBar` no toca la paleta de datos. `ScopeSwitcher` no existe ni como alias. | **0/29** piezas `[spec]` tienen código. `EmptyState` sigue con ícono de línea. `SplitBar` sí usa la paleta de datos (viola charts.css). `ScopeSwitcher` — cumple, no existe ni como alias (verificado en código). |

---

## 3. Orden general (no por bloque, por dependencia y costo de postergar)

```text
Pre-C1: CON-00, CON-01, CON-02, CON-03, CON-04, CON-25 (documentación e higiene, ya hechos salvo CON-04/CON-25)
   ↓
C1 Setup (+ MARCA-01, MARCA-02: assets de marca en app/ y public/icons/)
   ↓
C2 Migraciones + políticas RLS (+ CON-05 schema, CON-23, CON-24) → GATE-1
   ↓
C3 lib/money + lib/fx (+ CON-05 tipos, CON-06, CON-26)     ─┐
C4 Tokens/tema/motion (+ CON-07, CON-08, CON-27, CON-28)    ├→ GATE-2
   ↓ (ambos)                                                ┘
C5 Offline/datos (Dexie, outbox, Realtime, Serwist + MARCA-03..05: manifest y shortcuts)
   ↓
C6 Biblioteca de componentes (18 [spec] nuevos + CON-09..CON-19, CON-21, CON-22, CON-29, CON-30) → GATE-3
   ↓
   ├─ C7 Auth + onboarding (bloque A, incl. L6) ─┐  camino crítico del producto,
   ├─ C8 Captura rápida (bloque C)               ┘  van antes que el resto
   ↓
C9 Bloque L (L1-L5, sistemas transversales)
   ↓
C10 D · C11 B · C12 E (usa CON-29, monograma) · C13 H(parte 1) · C14 F+G · C15 J (usa CON-30, chip de moneda) · C16 I · C17 H(parte 2) · C18 K
   ↓
C19 Desktop · C20 i18n/a11y/perf · C21 Open source (licencia: MIT, ya no bloquea)
   ↓
CQ Auditoría final de código
```

**CONCILIAR no va entero antes de C1.** Solo CON-00, CON-01, CON-02, CON-03, CON-04 y
CON-25 son arreglos de documentación/higiene puros que no dependen de que exista schema,
tokens o biblioteca — esos sí van antes de todo. El resto de CONCILIAR está entrelazado
con la fase que lo necesita (CON-05/06/26 con C2-C3, CON-07/08/27/28 con C4,
CON-09..CON-22/CON-29/CON-30 con C6): arreglar un componente antes de que la biblioteca
exista, o el token de dinero antes de que `lib/money` esté extendido, no tiene sentido. La
columna "Fase" de cada ítem en § 4 es la que manda, no este diagrama.

**Por qué C3+C4 antes que C5 y C5 antes que C6**: el offline layer serializa `Money`, y la
biblioteca de componentes consume tokens y `formatAmount`; invertir el orden reescribe
trabajo.

**Por qué C7/C8 antes que el resto de bloques**: es el camino crítico del producto
(cargar un gasto en <5s) y ahí aparece cualquier error de fundación de auth/captura antes
de construir 100 pantallas más encima.

---

## 4. Parte 1 — CONCILIAR

Todo lo que ya existe y está mal, desalineado o incompleto. No crea pantallas nuevas.

| ID | Qué es | Fase | Bloquea / desbloquea | Tamaño | Estado | Criterio de terminado |
|---|---|---|---|---|---|---|
| **CON-00** | Unificar los dos `contrato-componentes.md` en la ruta de autoridad (§ 1.1) | Pre-C1 | Bloqueaba C6 hasta resolverse | chico | **hecho** | Un solo archivo en `docs/contrato-componentes.md` con el bloque de `formatAmount`/`formatNumber`; `docs/design/contrato-componentes.md` borrado |
| **CON-01** | Borrar `docs/CLAUDE.md` (residuo, no segunda fuente) (§ 1.2) | Pre-C1 | Ninguno técnico | chico | **hecho** | `docs/CLAUDE.md` eliminado; `CLAUDE.md` vive solo en la raíz |
| **CON-02** | Actualizar `docs/auditoria-visual.md` (y su duplicado `docs/design/AUDITORIA-VISUAL.md`) §"missing/orphans" para reflejar el cierre que `CLAUDE.md` ya declara (§ 1.3) | Pre-C1 | Ninguno — higiene | chico | **hecho** | La sección D05/D06 dice "cerrado" con referencia a G6a/I7b/J4b, no "vuelve a diseño" |
| **CON-03** | Correr las verificaciones de `docs/design/INDEX.md` para J2 (segunda vez) y J4 contra `adenda-02-modo-espejo.html` (§ 1.8) | Pre-C1 | Desbloqueaba CONS-J04 y CONS-J02 (saber contra qué archivo programar) | chico | **hecho** | INDEX.md actualizado sin celdas ⚠: J2 sigue en adenda-01, J4 sigue en `bloque-j-familiar.html` |
| **CON-04** | Borrar los 7 comentarios `<!--SLOT-*-->` vestigiales en `bloque-k-ajustes.html` (líneas ~850-856) | Pre-C18 (bloque K) | Ninguno | chico | pendiente | Comentarios removidos, diff de una línea por comentario |
| **CON-05** | **[dinero]** Agregar `originalAmount`/`originalCurrencyCode`/`originalRate` a `transactions` en el schema (migración) y a `TransactionRow` en `src/lib/db/schema.ts`; agregar `fxRate`/`fxSource`/`amountBase` a `settlements` | C2 + C3 | Bloquea C3 (lib/fx no puede completarse sin el tipo) y toda la captura en moneda distinta a la de cuenta (C8) | mediano | pendiente | Las dos conversiones son estructuralmente distintas en el tipo; ningún campo mezcla las dos; `SettlementRow` tiene el mismo shape de needs_fx que `transactions`/`trades` |
| **CON-06** | **[dinero, urgente]** Reescribir el sparkline/delta del hero de Home (`src/app/(app)/page.tsx:106-119,164`) para no pasar por `Number()`/`Math.round()`/`BigInt()` — usar `lib/money` end-to-end | C3/GATE-2 | Bloquea GATE-2 | mediano | **en curso** | Grep de `Number(` sobre variables de plata en el archivo da cero resultados — **hecho, verificado**; `typecheck`/`eslint` limpios. Falta: test unitario con montos que exceden `Number.MAX_SAFE_INTEGER` — la lógica sigue inline en el componente, no extraída a una función pura testeable |
| **CON-07** | **[dinero, menor]** `src/components/motion/CountUp.tsx:29-34` interpola con `Number()`/`BigInt(Math.round())` durante la animación | C4 (motion) | Ninguno — no bloquea GATE-2 (es interpolación visual, el valor de reposo es correcto) | chico | pendiente | La interpolación usa una escala fija de bigint o limita explícitamente el rango seguro con comentario justificando por qué es aceptable |
| **CON-08** | **[token]** Crear el token de superficie de selección + anillo (audit D02): claro `#DEDEDA` (1,24:1) con anillo `#C9C9C4` (1,43:1); no tocar `--surface-3` (compartido con inputs/keypad) | C4/GATE-2 | Bloquea GATE-2; desbloquea todo componente seleccionable (`SegmentedControl`, `Chip`, `CategoryBubble`, `DateStrip`, `AccountCarousel`, `SelectableRow`, `OptionCard`, `InstitutionTile`) | mediano | pendiente | Contraste medido ≥1,24:1 claro y equivalente oscuro; los 9 componentes listados migrados al nuevo token, no a `--surface-3` |
| **CON-09** | **[componente]** `StatusBadge`: mover el escalamiento por edad (`neutral` + `ageDays>=7` → `warning`) adentro del componente; hoy lo decide el caller (`RateRow.tsx:41-42`) | C6/GATE-3 | Parte de GATE-3 | chico | pendiente | `RateRow` y cualquier otro caller solo pasan `ageDays`, nunca `status`; test unitario de la transición a los 7 días |
| **CON-10** | **[componente]** Normalizar props de tamaño string-o-number en `Skeleton.tsx` (`width`/`height`/`radius`) y `Sheet.tsx` (`height`) | C6/GATE-3 | Parte de GATE-3 | chico | pendiente | `<Skeleton height="20" />` renderiza 20px, no colapsa a 0; test de regresión para ambos casos |
| **CON-11** | **[componente]** `SplitBar` v1: sacar la paleta de datos (`--data-1..5`) de un control arrastrable (audit D04/D17); no dibuja thumb; `height` es number-only (ya seguro) pero falta agregar `showThumb`/`showValues`/`tolerance` de la v2 del spec | C6/GATE-3 | Parte de GATE-3; bloquea I9/J2/J6 | mediano | pendiente | Colores vienen de un token de "partes" no ligado a `--data-*`; thumb visible y arrastrable con hit-area 44px |
| **CON-12** | **[componente]** Extraer `KeypadKey` compartido entre `Keypad` y `PinKeypad` (hoy cada uno duplica su propio `<button>`); agregar `aria-live` a ambos (ninguno lo tiene hoy) | C6/GATE-3 | Parte de GATE-3 | chico | pendiente | Un solo componente `KeypadKey` consumido por los dos; `Keypad` anuncia el monto por `aria-live`, `PinKeypad` anuncia "N de M dígitos" sin revelar el valor |
| **CON-13** | **[componente]** Extender `TabBar` con `badge?: number` por slot y `slots[3]` configurable por el usuario | C6/GATE-3 | Bloquea B6/F4/K3 | mediano | pendiente | El 4to slot se lee de preferencia del usuario, default Análisis; badge visible con `aria-label` propio |
| **CON-14** | **[componente]** `TransactionRow`: agregar los 4 casos faltantes (`pending`, `shared`, `attachment`, `installment`) | C6/GATE-3 | Bloquea D1 | mediano | pendiente | Los 4 estados tienen diseño visual propio y test de snapshot |
| **CON-15** | **[componente]** `AccountCarousel`: agregar `secondaryBalance?: ReactNode` para cuentas de broker en dos monedas | C6/GATE-3 | Bloquea E1 | chico | pendiente | Cuenta de broker muestra ambas monedas sin overflow en 390px |
| **CON-16** | **[componente]** `ErrorState`: agregar segunda acción (`alternativeLabel` + `onAlternative`), camino alternativo primero | C6/GATE-3 | Bloquea el patrón de error de **todos** los hooks (ver CON-19) | mediano | pendiente | Componente acepta 2 acciones; primera es la alternativa (ej. "ver offline"), segunda es "reintentar" |
| **CON-17** | **[componente]** `UndoToast`: agregar variante `progress` (sin acción, contador + barra 2px) — hoy siempre dibuja "Deshacer" aunque no haya nada que deshacer | C6/GATE-3 | Ninguno | chico | pendiente | Variante `progress` no renderiza botón de acción |
| **CON-18** | **[componente]** Renombrar `OfflineBanner` → `Banner` con `status` + `action?` (el nombre asume un solo uso; ya sirve para warning/error) | C6/GATE-3 | Ninguno | chico | pendiente | Un solo `Banner` con `status: 'offline' \| 'warning' \| 'error'` reemplaza los usos existentes, sin regresión visual |
| **CON-19** | **[patrón, alto impacto]** `EmptyState`: reemplazar el ícono de línea por `ZMark` al 20% (claro) / 28% (oscuro, audit D44) — afecta 68 estados vacíos ya diseñados sobre el componente viejo | C6/GATE-3 | Parte de GATE-3; es el fix #1 de la auditoría | mediano | pendiente | `EmptyState` consume `ZMark`, no `Icon`; contraste de opacidad verificado en ambos modos |
| **CON-20** | **[patrón]** Escribir el hook/patrón de estado de error que hoy no existe en ningún hook (`isError` nunca se usa en `src/`) — patrón reusable sobre `ErrorState` (CON-16) para las 5 vistas de la Definición de Terminado | C5/C6 | Bloquea el criterio #2 de "terminado" para **toda** pantalla nueva de aquí en más | grande | pendiente | Un wrapper (`useQueryWithErrorState` o similar) usado por Home y al menos 2 pantallas más como referencia; documentado para copiar en cada bloque nuevo |
| **CON-21** | **[componente, spec sin código]** Escribir la ficha de contrato + verificar los 4 componentes no mencionados en ningún lado que ya tienen código: `FxEditor`, `AmountScrubber`, `CategoryBubble`, `DateStrip` | C6/GATE-3 | Parte de GATE-3 | mediano | pendiente | Cada uno tiene entrada en `contrato-componentes.md` (props, estados, a11y, tokens); `FxEditor` reconciliado explícitamente contra `Rate`/`PriceStatus` (mismo territorio, hoy sin relación declarada) |
| **CON-22** | **[componente, documentación]** Escribir fichas de contrato para los 16 componentes restantes "sin ficha" que ya tienen código y no requieren cambios: `Button`, `AppHeader`, `Amount`, `Icon`, `Chip`, `Card`, `SegmentedControl`, `SkeletonRow`, `Switch`, `Input`, `CurrencyChip`, `Sparkline`, `InsightCard`, `SyncDot`, `SeriesLegend`, `BarChart` | C6/GATE-3 | Parte de GATE-3 | mediano | pendiente | 16 entradas nuevas en el contrato, sin cambios de código requeridos |
| **CON-23** | **[schema]** Documentar como excepción escrita `interest_rate`/`coupon_rate numeric(8,4)` (V5) e `instruments.ratio numeric(12,6)` (V6), que rompen la convención de escala pero probablemente son intencionales | C2 | Ninguno — evita que alguien "corrija" un valor correcto en una migración futura | chico | pendiente | Comentario en la migración explicando por qué esas dos columnas no siguen `numeric(24,12)`/`numeric(38,12)` |
| **CON-24** | **[schema]** Verificar y resolver V8: contradicción entre "DELETE nunca se expone" y la política `splits_all ... FOR ALL` sobre `transaction_splits`, que además no tiene `deleted_at` | C2 | Bloquea GATE-1 si no se resuelve antes de escribir la política de `transaction_splits` | chico | pendiente | `transaction_splits` tiene `deleted_at` y su política no incluye `DELETE`, o hay una razón escrita de por qué esta tabla es la excepción |
| **CON-25** | **[ruta, documentación]** Escribir la convención implícita "los flujos de pantalla completa viven fuera de `(app)/`" (`accounts/new`, `accounts/[id]/edit`, `transactions/[id]/edit`, `add`) — no es un bug, pero nadie la documentó y alguien va a violarla | C1 | Ninguno | chico | pendiente | Convención escrita en `CLAUDE.md` o `docs/00-producto.md`, con los 4 casos existentes como ejemplo |
| **CON-26** | **[lib]** Escribir `formatNumber(value: number, decimals: number)` en `lib/money` — hoy no existe en absoluto; `decimalsFor()` debe aceptar `instrument` además de `currency` | C3 | Bloquea todo el bloque I (inversiones) — no hay formateador de cantidades | mediano | pendiente | `formatNumber` sin default en `decimals`; test con BTC(8)/FCI(4)/UYU(0) en la misma lista, ninguno se redondea mal |
| **CON-29** | **[componente, marca]** `InstitutionTile`: reemplazar los logos de institución por una baldosa de monograma — dos letras sobre `institutions.color` (columna ya existente, no un archivo); `institutions.logo_url` queda como slot opcional para una carpeta local ignorada por git (§ 1.10) | C6/GATE-3 | Bloquea A6, E1, E3 | mediano | pendiente | `InstitutionTile` no importa ni referencia ningún binario de logo de terceros; dos instituciones distintas se ven visualmente distintas; funciona offline |
| **CON-30** | **[componente, marca]** Cero banderas en toda la app, dos casos distintos: chip con código de moneda (`CurrencyChip`) donde el token identifica una moneda (E6, H6, I2, K3); bandera eliminada y solo el nombre donde identifica un país (A4, E3) (§ 1.11) | C6/GATE-3 | Afecta A4, E3, E6, H6, I2, K3 | mediano | pendiente | Grep de emoji de bandera (`grep -P '[\x{1F1E6}-\x{1F1FF}]'`) sobre `src/` da cero resultados; `CurrencyChip` documentado en el contrato (se resuelve junto con CON-22) |

---

## 5. Parte 2 — CONSTRUIR: migraciones, biblioteca, capas base

### 5.1 Migraciones (C2) — 12 migraciones, en el orden que fija `05-prompts-desarrollo.md`

Cada una lleva su propia RLS y sus tests (GATE-1 no pasa sin ellos).

| ID | Migración | Tablas / contenido | Tamaño | Estado |
|---|---|---|---|---|
| **MIG-00** | Helpers | `current_households()`, `can_write(h)`, `can_see(...)` — todas `SECURITY DEFINER SET search_path=''` | mediano | pendiente |
| **MIG-01** | `extensions` | `pgcrypto`/`uuid-ossp` según corresponda para UUID v7 en cliente | chico | pendiente |
| **MIG-02** | `reference` | `currencies`, `countries`, `fx_rates` (Pattern C puro) | mediano | pendiente |
| **MIG-03** | `identity` | `profiles`, `households`, `household_members`, `household_invites`, `household_fx_preferences` | grande | pendiente |
| **MIG-04** | `accounts` | `accounts` (root) | mediano | pendiente |
| **MIG-05** | `classification` | `categories`, `tags`, `payees`, `institutions`/`instruments`/`asset_classes` (Pattern C con clonado) | grande | pendiente |
| **MIG-06** | `transactions` | `transactions`, `transaction_tags`, `transaction_splits`, `transaction_shares` — incluye `original_*` (CON-05) y `fx_pair` CHECK + `inherit_fx_state()` trigger | grande | pendiente |
| **MIG-07** | `fx` | `fx_overrides` (`valid_from`/`valid_to`), `visibility_grants` | mediano | pendiente |
| **MIG-08** | `budgets_goals` | `budgets`, `budget_lines`, `budget_periods`, `goals`, `goal_contributions`, `goal_accounts` | grande | pendiente |
| **MIG-09** | `recurring_debts` | `recurring_rules`, `debts`, `debt_schedule` (con `origin_transaction_id`, `installment_count`) | grande | pendiente |
| **MIG-10** | `investments` | `portfolios`, `trades` (con `fx_pair` CHECK — CON-05 aplica acá también), `price_snapshots`, `target_allocations`, `portfolio_snapshots`, `instrument_cashflows`, `benchmarks`/`benchmark_series`, vistas `positions`/`fx_latest` | grande | pendiente |
| **MIG-11** | `system` | `settlements` (con fx — CON-05), `rules`, `insights`, `audit_log`, `import_batches`, `notification_preferences` + push subs, `price_index`, `card_statements`, `household_currencies` | grande | pendiente |

**→ GATE-1** al cierre de MIG-11.

### 5.2 Capas base

| ID | Qué | Fase | Tamaño | Estado |
|---|---|---|---|---|
| **BASE-01** | `lib/money` — extender con el modelo de dos conversiones (usa CON-05) y `formatNumber` (CON-26) | C3 | grande | pendiente |
| **BASE-02** | `lib/fx` — cadena de resolución de 4 pasos, inmutabilidad de rate salvo la única excepción de `inherited`→histórico real al reconectar, providers, `/api/fx`, cron diario | C3 | grande | pendiente |
| **BASE-03** | `globals.css` con `@theme`/`.dark` (Tailwind v4), incluye el token de selección (CON-08) | C4 | mediano | pendiente |
| **BASE-04** | Motion primitives (`Pressable`, `CountUp` fix incluido — CON-07, `StaggerList`, `SharedElement`, `MorphButton`, `useHaptics`, `useMotionIntensity`) | C4 | grande | pendiente |
| **BASE-05** | Offline: Dexie schema, outbox worker + Background Sync, resolución de conflictos LWW→`audit_log`, `createOptimisticMutation()`, Realtime debounced | C5 | grande | pendiente |
| **BASE-06** | Serwist: precache, estrategias de cache, fallback offline, manifest/shortcuts/share target | C5 | mediano | pendiente |

**Cableado de marca — sin esto la PWA no es instalable.** Los assets ya están generados en
`docs/marca/assets/` con su propio README; falta llevarlos a `src/app/`/`public/` y
escribir el manifest real.

| ID | Qué | Fase | Tamaño | Estado |
|---|---|---|---|---|
| **MARCA-01** | Copiar `icon.svg`, `favicon.ico`, `apple-icon.png` (180×180) y `opengraph-image.png` a `src/app/` (metadata basada en archivo de Next.js 16); `og-square.png` (1200×1200, para que WhatsApp no recorte el 1200×630) como imagen adicional | C1 | chico | pendiente |
| **MARCA-02** | Generar `public/icons/` con `icon-192`/`icon-512` (`purpose: "any"`), `icon-maskable-192`/`icon-maskable-512` (`purpose: "maskable"`, **archivos distintos** de los `any` — declarar el mismo PNG en los dos hace que Android recorte la Z), e `icon-mono-512` (`purpose: "monochrome"`, para íconos temáticos de Android 13+) | C1 | chico | pendiente |
| **MARCA-03** | Generar los dos íconos de shortcut de 96×96 (`shortcut-gasto.png`, `shortcut-movimientos.png`) — dependen de qué acciones queden en el set final de shortcuts, por eso van con el manifest y no antes | C5 | chico | pendiente |
| **MARCA-04** | Escribir `manifest.webmanifest` completo (name, short_name, start_url, display, background_color, theme_color, los 5 íconos de MARCA-02 sin mezclar `any`/`maskable`, shortcuts con MARCA-03) y cablearlo junto a Serwist (BASE-06) | C5 | mediano | pendiente |
| **MARCA-05** | Splash de iOS (~15 pares claro/oscuro, uno por resolución): generarlos en el build, **no versionarlos** — agregar el paso al pipeline de build, no a `public/` | C5 (o config de build, junto a C1) | mediano | pendiente |

### 5.3 Biblioteca de componentes (C6) — 18 piezas `[spec]` genuinamente nuevas

(Las otras 11 de las 29 del contrato ya tienen código parcial y están en § 4 como
CON-09..CON-19. Los 4 sin ficha con código ya existente están en CON-21.)

| ID | Componente | Bloquea | Tamaño | Estado |
|---|---|---|---|---|
| **LIB-01** | `PriceStatus` | I2/I3/I4/I12 | chico | pendiente |
| **LIB-02** | `PositionRow` | I3 | mediano | pendiente |
| **LIB-03** | `NeedsFxBanner` (count-only, sin `amount` — ver contrato a corregir) | H1a/H5/H7/F2/G1/G4/I2/I3/I11/J2/J7/K1/E8 | mediano | pendiente |
| **LIB-04** | `MonthCalendar` | G1, D5 | mediano | pendiente |
| **LIB-05** | `CalendarHeatmap` (con `--ramp-1..7`, ver LIB-17) | H8 | mediano | pendiente |
| **LIB-06** | `Donut` | H2, I2 | mediano | pendiente |
| **LIB-07** | `Waterfall` (con invariante de dev-time: deltas suman el total) | H5 | mediano | pendiente |
| **LIB-08** | `Sankey` | H4 — "el más necesitado", hoy sin coordenadas | grande | pendiente |
| **LIB-09** | `RankingBar` | H9 | chico | pendiente |
| **LIB-10** | `BenchmarkBars` | I10 | mediano | pendiente |
| **LIB-11** | `StoryFrame` | H12 (Wrapped) | mediano | pendiente |
| **LIB-12** | `InfoCard` | I10 | chico | pendiente |
| **LIB-13** | `DragRow` (handle 44px) | I8, K5, E1 | chico | pendiente |
| **LIB-14** | `ComparisonBars` | J8 | mediano | pendiente |
| **LIB-15** | `MirrorBanner` | J4/J4b | chico | pendiente |
| **LIB-16** | `SectionGroup` (unifica `AccountRow`/`RateRow`/`GroupCard`/`ResultGroup`/`ResolutionChain`) | E, K, búsqueda global | grande | pendiente |
| **LIB-17** | Iconos nuevos (`mail`, `lock`, `fingerprint`, `install`, `globe`, `bank-checking`) + tokens `--ramp-1..7` en `charts.css` | LIB-05, varias pantallas de auth/onboarding | chico | pendiente |
| **LIB-18** | `StackedBar`/`DivergingBar` | H3, H6, H7 | mediano | pendiente |

**→ GATE-3** al cierre de LIB-18 + CON-09..CON-19 + CON-21.

---

## 6. Parte 2 — CONSTRUIR: pantallas por bloque

**119 pantallas/vistas** en total. El archivo de diseño que manda para cada una (según
`docs/design/INDEX.md`, ya sin celdas sin verificar — CON-03) está anotado entre paréntesis
donde hay más de una versión. Los ⚠ que quedan en las notas de esta sección son
superposiciones sin decidir entre pantallas (p. ej. B7/K3, D34) — las decisiones de marca
(§ 1.10, § 1.11) ya están resueltas y anotadas sin ⚠.

### 6.1 Bloques A-E: qué se conserva, qué se parchea, qué se rehace

No hay una tabla pantalla-por-pantalla de esto en `reconciliacion-sesion-0.md` — ese
documento audita diseño-contra-prompts, no código-contra-diseño. El veredicto de abajo es
mi lectura del código real (§ 4, código auditado) cruzado con lo que cada pantalla nueva
va a requerir de la biblioteca (§ 5.3):

- **Bloque A (onboarding)**: no hay código de rutas `(auth)`/`(onboarding)` implementado
  todavía más allá de placeholders (`src/app/onboarding/*` existe pero antecede a C7 tal
  como está especificado ahora: Server Actions + next-safe-action, resumable state,
  household+cuenta+categorías en una transacción). **Veredicto: rehacer contra C7**, no
  parchear — la superficie de la lógica de negocio cambió más que la UI.
- **Bloque B (home)**: `src/app/(app)/page.tsx` existe y en general está bien
  estructurado (usa `computeNetWorth` correctamente), salvo el bug de CON-06. **Veredicto:
  parchear** — arreglar el sparkline, agregar needs_fx banner reusable (LIB-03) en vez del
  `InsightCard` genérico actual, agregar estado de error (CON-20), y extender a las 3
  variantes de flag que exige B1.
- **Bloque C (captura)**: `src/features/capture/*` existe con Keypad y hooks de
  categorías frecuentes. **Veredicto: parchear** — falta la máquina de estados completa en
  Zustand+Dexie persistida, C4-C10 (conversión de moneda, ingreso, transferencia,
  undo toast de 5s, burst mode, voz, auto-categorización), y el modelo de dos
  conversiones (CON-05) que hoy no existe en la captura.
- **Bloque D (movimientos)**: hay rutas (`src/app/(app)/transactions`,
  `src/app/transactions/[id]`) pero `TransactionRow` le faltan 4 estados (CON-14) y no
  hay filtros/calendario/selección múltiple construidos. **Veredicto: parchear** la lista
  existente, **construir** D3-D7 de cero.
- **Bloque E (cuentas)**: rutas de cuentas existen (`src/app/(app)/accounts`,
  `src/app/accounts/new`, `.../[id]/edit`) con la convención de ruta ya documentada
  (CON-25). Falta tarjeta de crédito, conciliación, multi-moneda/FX por cuenta, y **E8**
  completo (no estaba ni en el código ni en los prompts originales). **Veredicto:
  parchear** E1-E2, **construir** E3-E8 de cero.

### 6.2 Bloque A — Onboarding + L6 (fase C7)

11 pantallas + L6. Camino crítico: A2→A3→A4→A5→A6→A7→A11→C1. A1/A8/A9/A10 diseñadas,
fuera del camino crítico, **se programan igual** (instrucción explícita de `CLAUDE.md`).

| ID | Pantalla | Camino crítico | Tamaño | Estado | Notas |
|---|---|---|---|---|---|
| CONS-A01 | A1 | No | chico | pendiente | Fuera de camino crítico, igual se programa |
| CONS-A02 | A2 | Sí | mediano | **en curso** | Resuelto (§ 1.6): con OAuth registrado, Google/Apple son primarios y el email colapsa bajo "usar mi email"; sin OAuth, el email es primario y los botones de Google/Apple no se renderizan (ausentes, no deshabilitados). Es un solo diseño con dos estados por configuración, no dos diseños a elegir |
| CONS-A03 | A3 | Sí | mediano | **en curso** | Resuelto (§ 1.7): el arranque sin conexión se descarta. **No** se implementa la tarjeta "MIENTRAS TANTO" ni el botón "Empezar sin conexión" del archivo de diseño — es una decisión de producto, no una pantalla incompleta. El estado offline queda con `ErrorState`, la línea de que el email quedó guardado y se manda solo al volver la señal, y "Probar de nuevo" |
| CONS-A04 | A4 | Sí | chico | pendiente | Resuelto (§ 1.11, CON-30): identifica país — bandera eliminada, queda el nombre solo |
| CONS-A05 | A5 | Sí | chico | pendiente | |
| CONS-A06 | A6 | Sí | mediano | pendiente | Resuelto (§ 1.10, CON-29): monograma sobre `institutions.color`, no logo real |
| CONS-A07 | A7 | Sí | mediano | pendiente | Household + primera cuenta + categorías en una transacción |
| CONS-A08 | A8 | No | chico | pendiente | Destino de "activar/apagar módulos" desde I1 y el mapa |
| CONS-A09 | A9 | No | chico | pendiente | |
| CONS-A10 | A10 | No | chico | pendiente | Se ofrece después del primer gasto, no en onboarding — depende de C8 |
| CONS-A11 | A11 | Sí | mediano | pendiente | |
| CONS-A12 | L6 (bloqueo) | — | mediano | pendiente | Fase C7 decidida (§ 1.9); comparte `PinKeypad`/`KeypadKey` con CON-12 |

### 6.3 Bloque C — Captura rápida (fase C8)

11 pantallas. El objetivo duro es <90s señal→primer gasto guardado.

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-C01 | C1 monto (Keypad+AmountScrubber) | grande | pendiente | Existe parcial, falta AmountScrubber wireado |
| CONS-C02 | C2 categoría (chips frecuentes por hora) | mediano | pendiente | `use-frequent-categories.ts` ya existe |
| CONS-C03 | C3 detalle colapsable | mediano | pendiente | |
| CONS-C04 | C4 conversión de moneda | grande | pendiente | Depende de CON-05 (original_*) |
| CONS-C05 | C5 ingreso | mediano | pendiente | |
| CONS-C06 | C6 transferencia (incl. cross-currency) | grande | pendiente | |
| CONS-C07 | C7 guardado optimista + animación + undo 5s | grande | pendiente | Depende de LIB (UndoToast CON-17) |
| CONS-C08 | C8 burst mode | mediano | pendiente | |
| CONS-C09 | C9 captura por voz (Web Speech API, parser rioplatense) | grande | pendiente | ⚠ verificar soporte de Web Speech API fuera de Chrome/Safari antes de comprometer alcance |
| CONS-C10 | C10 foto de ticket | chico | pendiente | Diseño solo cubre entry point; declarado "fase futura" — implementar solo el entry point |
| CONS-C11 | C11 auto-categorización por reglas al guardar | mediano | pendiente | |

### 6.4 Bloque L — Sistemas transversales (fase C9)

L1-L5 (L6 va en C7, § 6.2). Se programan últimos a propósito, "una familia aplicada diez
veces" — deben ir antes de C10-C18 porque D-K los consumen.

| ID | Pantalla/sistema | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-L01 | L1 estados vacíos (usa CON-19 EmptyState/ZMark) | chico | pendiente | |
| CONS-L02 | L2 skeletons | chico | pendiente | |
| CONS-L03 | L3 errores (usa CON-16/CON-20) | mediano | pendiente | Hereda el patrón de error de A3 (§ 1.7, CONS-A03): el arranque sin conexión se descartó como decisión de producto, no como pantalla incompleta — `ErrorState` no debe ganar un botón de "usar sin conexión" acá tampoco |
| CONS-L04 | L4 toasts | chico | pendiente | |
| CONS-L05 | L5 onboarding contextual | mediano | pendiente | |

### 6.5 Bloque D — Movimientos (fase C10)

| ID | Pantalla | Tamaño | Estado |
|---|---|---|---|
| CONS-D01 | D1 lista (parchear `TransactionRow`, CON-14) | mediano | pendiente |
| CONS-D02 | D2 filtros | mediano | pendiente |
| CONS-D03 | D3 detalle | mediano | pendiente |
| CONS-D04 | D4 editar | mediano | pendiente |
| CONS-D05 | D5 calendario (usa `MonthCalendar` LIB-04) | mediano | pendiente |
| CONS-D06 | D6 estados | chico | pendiente |
| CONS-D07 | D7 selección múltiple | mediano | pendiente |

### 6.6 Bloque B — Home (fase C11)

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-B01 | B1 home (3 variantes de flag) | grande | pendiente | Parchear la base existente |
| CONS-B02 | B2 | mediano | pendiente | |
| CONS-B03 | B3 | mediano | pendiente | |
| CONS-B04 | B4 | mediano | pendiente | |
| CONS-B06 | B6 tab bar (usa CON-13) | mediano | pendiente | |
| CONS-B07 | B7 "Más" | mediano | pendiente | Ver D34 — se superpone con K3, decidir cuál configura qué antes de escribir ambas |
| CONS-B08 | B8 búsqueda global | grande | pendiente | |

### 6.7 Bloque E — Cuentas (fase C12)

8 ítems (E3/E4/E5/E6 incluyen sub-vistas como estados del mismo flujo, no pantallas
independientes).

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-E01 | E1 lista de cuentas (usa `DragRow` LIB-13) | mediano | pendiente | Parchear existente; resuelto (§ 1.10, CON-29): monograma de institución |
| CONS-E02 | E2 | mediano | pendiente | Parchear existente |
| CONS-E03 | E3 (+E3.1, E3.2) | mediano | pendiente | Resuelto (§ 1.10, CON-29): monograma de institución; resuelto (§ 1.11, CON-30): país de la cuenta sin bandera, nombre solo |
| CONS-E04 | E4 tarjeta de crédito (+E4.1, E4.2) | grande | pendiente | Requiere `card_statements` (MIG-11) |
| CONS-E05 | E5 conciliación (+E5.1-E5.3) | grande | pendiente | |
| CONS-E06 | E6 monedas/FX (+E6.1-E6.4) | grande | pendiente | Requiere `household_currencies` (MIG-11); resuelto (§ 1.11, CON-30): chip de código de moneda |
| CONS-E07 | E7 | mediano | pendiente | |
| CONS-E08 | E8 resolver FX faltantes en lote (+E8.1, E8.2) | grande | pendiente | No estaba en 03/04; usa `NeedsFxBanner` LIB-03; cierra la cadena de resolución |

### 6.8 Bloque H — Análisis, parte 1 (fase C13)

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-H01 | H1 (gana `adenda-01-huecos-navegacion.html`, confirmado) | grande | pendiente | Usa `StatTile size="compact"` (CON-catálogo LIB), `NeedsFxBanner` |
| CONS-H02 | H2 (Donut, LIB-06) | mediano | pendiente | |
| CONS-H03 | H3 (StackedBar/DivergingBar, LIB-18) | mediano | pendiente | Mínimo histórico: 1 período cerrado |
| CONS-H05 | H5 (Waterfall, LIB-07) | mediano | pendiente | |
| CONS-H08 | H8 (CalendarHeatmap, LIB-05) | mediano | pendiente | |
| CONS-H09 | H9 (RankingBar, LIB-09) | mediano | pendiente | |
| CONS-H14 | H14 | mediano | pendiente | |

### 6.9 Bloques F+G — Presupuestos, metas, recurrentes, deudas (fase C14)

18 ítems incluido G6a (nuevo, no es una alt-versión).

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-F00 | F0 activación módulo presupuestos | chico | pendiente | Chequeo `enabled_modules`, carga diferida |
| CONS-F0m | F0m | chico | pendiente | |
| CONS-F01 | F1 | mediano | pendiente | |
| CONS-F02 | F2 (needs_fx: agregar `NeedsFxBanner`, hoy sin declarar) | mediano | pendiente | Corrige D03 |
| CONS-F03 | F3 | mediano | pendiente | Hero+dial 40/40 es excepción declarada por auditoría — no "corregir" |
| CONS-F04 | F4 | mediano | pendiente | |
| CONS-F05 | F5 | mediano | pendiente | Requiere `goal_contributions`/`goal_accounts` (MIG-08) |
| CONS-F06 | F6 | mediano | pendiente | Requiere `goal_contributions` (MIG-08) |
| CONS-F07 | F7 | mediano | pendiente | |
| CONS-G0r | G0r activación recurrentes | chico | pendiente | |
| CONS-G01 | G1 (MonthCalendar LIB-04; hero "comprometido por mes" — requiere que `recurring_rules.template` deje de ser opaco a SQL) | grande | pendiente | |
| CONS-G02 | G2 | mediano | pendiente | |
| CONS-G03 | G3 | mediano | pendiente | |
| CONS-G0d | G0d activación deudas | chico | pendiente | |
| CONS-G04 | G4 (needs_fx) | mediano | pendiente | Corrige D03; reconciliar contra J7 quién manda en el neto (contradicción § 4 de reconciliación, sin resolver) |
| CONS-G05 | G5 | mediano | pendiente | |
| CONS-G06 | G6 | grande | pendiente | Requiere `debts.origin_transaction_id`/`installment_count` (MIG-09) |
| CONS-G06a | G6a selector de transacción con tarjeta | mediano | pendiente | Nueva, alimenta G6 |

### 6.10 Bloque J — Grupo familiar (fase C15)

11 ítems incluido J4b.

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-J01 | J1 | mediano | pendiente | |
| CONS-J02 | J2 (gana `adenda-01-huecos-navegacion.html`, verificado — CON-03) | grande | pendiente | needs_fx: corrige D03 |
| CONS-J03 | J3 | mediano | pendiente | |
| CONS-J04 | J4 (gana `bloque-j-familiar.html`, verificado — CON-03) | grande | pendiente | Objetivo duro: entendible en 5s sin leer |
| CONS-J4b | J4b modo espejo | grande | pendiente | Server-side, nunca amplía acceso del que mira; usa `MirrorBanner` LIB-15 |
| CONS-J05 | J5 (split 62/38, `transaction_shares.split_mode`/`share_pct`) | mediano | pendiente | |
| CONS-J06 | J6 | mediano | pendiente | |
| CONS-J07 | J7 (needs_fx, **el más grave**: un gasto compartido en USD sin cotización cambia quién debe a quién) | grande | pendiente | Corrige D03; resolver contradicción con G4 (§ 4) |
| CONS-J08 | J8 (opt-in mutuo explícito, ComparisonBars LIB-14, fallback asimétrico) | mediano | pendiente | Huérfano resuelto — entrada desde J2 |
| CONS-J09 | J9 | mediano | pendiente | |
| CONS-J10 | J10 (settlements method/status, `household_members.status`) | mediano | pendiente | Miembro que se va: liquidar/condonar antes de salir |

### 6.11 Bloque I — Inversiones (fase C16)

13 ítems incluido I7b.

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-I01 | I1 | mediano | pendiente | |
| CONS-I02 | I2 (gana `adenda-01-huecos-navegacion.html`, confirmado; needs_fx) | grande | pendiente | Corrige D03; usa `PriceStatus` LIB-01, `Donut` LIB-06; resuelto (§ 1.11, CON-30): chip de código de moneda |
| CONS-I03 | I3 (needs_fx; objetivo duro: 8 posiciones heterogéneas legibles en 390px) | grande | pendiente | `PositionRow` LIB-02; posiciones de prueba: AAPL, MELI, YPFD, AL30, ON YPF 2029, FCI, BTC, plazo fijo UYU |
| CONS-I04 | I4 | mediano | pendiente | |
| CONS-I05 | I5 | mediano | pendiente | Auditoría: "el peor de los tres" en cifras compitiendo — split fees+fecha a paso 2 (D24) |
| CONS-I06 | I6 | mediano | pendiente | |
| CONS-I07 | I7 | mediano | pendiente | |
| CONS-I07b | I7b crear instrumento a mano | mediano | pendiente | Nueva, formulario de 4 campos que I7 prometía |
| CONS-I08 | I8 (DragRow LIB-13) | mediano | pendiente | |
| CONS-I09 | I9 (SplitBar sin paleta de datos — depende de CON-11) | mediano | pendiente | Huérfano resuelto |
| CONS-I10 | I10 (BenchmarkBars LIB-10, InfoCard LIB-12; requiere `benchmarks`/`benchmark_series`) | mediano | pendiente | Huérfano resuelto — entrada desde I2 |
| CONS-I11 | I11 (needs_fx; requiere `instrument_cashflows`) | mediano | pendiente | Corrige D03; huérfano resuelto |
| CONS-I12 | I12 | mediano | pendiente | |

### 6.12 Bloque H — Análisis, parte 2 (fase C17)

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-H04 | H4 Sankey (LIB-08) | grande | pendiente | "El más necesitado" |
| CONS-H06 | H6 | mediano | pendiente | Resuelto (§ 1.11, CON-30): chip de código de moneda |
| CONS-H07 | H7 (needs_fx; requiere `price_index` para "gasto en USD constantes") | mediano | pendiente | Corrige D03 |
| CONS-H10 | H10 | mediano | pendiente | |
| CONS-H11 | H11 (needs_fx; hero-xl 64 — ver regla a declarar en CON-27 abajo) | mediano | pendiente | Corrige D03; corrige polaridad D36 (StatusBadge verde→neutro+flecha) |
| CONS-H12 | H12 Wrapped (StoryFrame LIB-11) | grande | pendiente | Huérfano resuelto — entrada desde H1; hero-xl 64 |
| CONS-H13 | H13 | mediano | pendiente | |

### 6.13 Bloque K — Ajustes (fase C18)

13 ítems (K3a/b/c y K9a/b/c son pasos de un mismo flujo, no líneas independientes de esta
tabla salvo K9 que sí requiere tres pantallas reales).

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-K01 | K1 (needs_fx en patrimonio) | mediano | pendiente | Corrige D03 |
| CONS-K02 | K2 | mediano | pendiente | |
| CONS-K03 | K3 (a/b/c) — ver D34, se superpone con B7 | grande | pendiente | ⚠ decidir con CONS-B07 cuál configura qué; resuelto (§ 1.11, CON-30): chip de código de moneda |
| CONS-K04 | K4 | mediano | pendiente | |
| CONS-K05 | K5 (DragRow LIB-13) | mediano | pendiente | |
| CONS-K06 | K6 | mediano | pendiente | |
| CONS-K07 | K7 | mediano | pendiente | |
| CONS-K08 | K8 (override manual de FX — paso 1 de la cadena, usa `fx_overrides`) | mediano | pendiente | |
| CONS-K09 | K9 importador CSV (a: archivo, b: columnas con mapping reusable vía `import_batches`, c: duplicados) | grande | pendiente | Elimina CON-04 (slots vestigiales) antes de programar |
| CONS-K10 | K10 | mediano | pendiente | |
| CONS-K11 | K11 | mediano | pendiente | |
| CONS-K12 | K12 (push subscriptions, `notification_preferences`) | mediano | pendiente | |
| CONS-K13 | K13 licencia/acerca de | chico | pendiente | Licencia: MIT (§ 1.5, decidido) |

### 6.14 Cierre de fases

| ID | Fase | Qué | Tamaño | Estado | Notas |
|---|---|---|---|---|---|
| CONS-DESK | C19 | Desktop: sidebar, layout de dos columnas, command palette | grande | pendiente | |
| CONS-I18N | C20 | i18n completo (ES/EN/PT), accesibilidad (axe-core, VoiceOver/TalkBack, 200% texto), performance (Lighthouse ≥90, N+1, bundle de módulos apagados) | grande | pendiente | |
| CONS-OSS | C21 | README, self-host docs, docker-compose, `.env.example`, CONTRIBUTING, licencia (MIT), seeds | mediano | pendiente | Licencia: MIT (§ 1.5, decidido) — ya no bloquea |
| CONS-CQ | CQ | Auditoría final: seguridad (RLS, secretos, rate limiting), dinero (grep de `number`/`parseFloat`/`toFixed`), performance, offline (50 mutaciones, conflicto real), accesibilidad, open source (README ejecutable por un extraño, sin datos personales en seeds, sin hardcode AR/UY) | grande | pendiente | |

---

## 7. Regla de lint pendiente (mitigación del presupuesto de ruido)

El contrato pide una regla de lint que cuente usos de `--primary-fill` por archivo de
pantalla, y que `StatTile size="compact"` exista antes de escribir H1. Esto es
infraestructura de CI, no una pantalla — lo agrego como ítem propio porque si no se
escribe antes de C11 (bloque B, que ya usa 2 violetas en H1a/J2 por identidad de dato),
nadie lo va a notar hasta la auditoría final.

| ID | Qué | Fase | Tamaño | Estado |
|---|---|---|---|---|
| CON-27 | Regla de lint: contar usos de `--primary-fill` por archivo de pantalla, advertir sobre 1 salvo excepciones declaradas (Switch on, ScopeSwitcher/SegmentedControl de identidad, UndoToast) | C4/C6 | mediano | pendiente |
| CON-28 | Declarar por escrito las 3 reglas no escritas de la auditoría: cuándo `hero-xl` 64 vs `hero` 40 (hoy en J7/H11/H12 sin regla); `critical` (estado) vs. naranja de polaridad (rendimiento negativo); cuándo se repite `$` en una lista | C4 | chico | pendiente |

---

## 8. Los cinco ítems que más se encarecen si se postergan

1. **CON-06 (sparkline de Home en float)** — es la cifra más visible del camino crítico.
   Cuanto más código nuevo se escriba sobre el patrón actual (otros deltas, otras
   pantallas que copien el mismo cálculo), más lugares hay que tocar después. Es
   literalmente el ejemplo que el propio `CLAUDE.md` usa para explicar la regla de
   dinero — dejarlo vivo mientras se construye el resto es la manera más rápida de
   normalizar el bug.
2. **CON-08 (token de selección)** — bloquea 9+ componentes que todas las pantallas
   nuevas van a usar (`SegmentedControl`, `Chip`, `CategoryBubble`, `DateStrip`,
   `AccountCarousel`, `SelectableRow`, `OptionCard`, `InstitutionTile`). Si se programa
   media biblioteca antes de fijar el token, es una migración de estilos sobre docenas de
   archivos en vez de un cambio en un solo lugar.
3. **GATE-1 (tests de RLS)** — el propio handoff dice que es "lo único que evita descubrir
   en el bloque J que la fundación estaba mal". J es multi-usuario con visibilidad
   granular; si la política de RLS tiene un agujero, se descubre con datos reales de dos
   personas mezclados, no con un test.
4. **CON-05 (dos conversiones de FX)** — cuanto más código de captura (C8) se escriba
   contra el modelo viejo de una sola conversión, más transacciones hay que migrar
   después con una regla de negocio ambigua (¿qué era `amount` antes: cuenta o base?).
   Bloquea directamente el bloque C, que es la funcionalidad más importante del producto.
5. **CON-19 (EmptyState/ZMark)** — 68 estados vacíos ya diseñados dependen de este
   componente. Es barato ahora (un componente) y caro después (revisar 68 pantallas
   instanciadas para ver si alguna sigue con el ícono viejo).

---

## 9. Qué asumí que podría estar mal

- **Que `reconciliacion-sesion-0.md` contiene un inventario de código — confirmado, y
  vale la pena que quede escrito acá para que nadie lo busque ahí de nuevo.** Nunca lo
  contuvo: es reconciliación de diseño/contrato/schema, sin un solo path de `src/`. El
  usuario confirmó que el inventario de código real lo hizo **otra sesión**, y que su
  reporte **no quedó escrito en el repo** — no es que falte encontrarlo, no existe como
  documento. El inventario de código de este plan (§ 4: bugs de dinero, ruta de accounts,
  defectos de componente, hooks sin estado de error) salió de una auditoría fresca del
  código real que hice específicamente para este plan.
- **El conteo de 119 pantallas** agrupa sub-vistas declaradas como estados del mismo flujo
  (p. ej. E3.1/E3.2, K3a/b/c salvo K9) en un solo ítem, salvo donde el diseño las trata
  como pantallas completamente distintas (K9a/b/c, que son tres pasos de un wizard con
  layouts propios). Si el criterio correcto es contar cada sub-vista como ítem
  independiente, el número real es más alto — la cifra "82 vistas navegables" de
  `06-prompts-diseno-restante.md` tampoco coincide exactamente con ninguna forma de sumar
  las tablas de INDEX.md que probé, así que ningún total en este proyecto es
  100% reconciliable sin abrir cada archivo HTML y contar `data-screen-id` a mano.
- **Que el "hero-xl 64" en H12 es del mismo tipo que en J7/H11** — la auditoría (D11) lo
  menciona como tercer caso pero `CLAUDE.md` solo cita J7 y H11; lo incluí en CONS-H12
  como nota, no como hecho verificado dos veces.
- **Que la convención de rutas fuera de `(app)/` (CON-25) es deliberada** y no un
  descuido — lo inferí por el patrón repetido en 4 rutas distintas, pero nadie lo escribió
  como decisión.
- **Que Web Speech API (C9 del bloque C, captura por voz) tiene soporte suficiente** para
  comprometerse como parte del camino de captura — no verifiqué compatibilidad de
  navegador/PWA instalada; lo marqué con una nota en CONS-C09 en vez de asumir alcance
  completo.
