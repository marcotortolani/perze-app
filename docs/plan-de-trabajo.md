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

**✅ ACTUALIZADO 2026-08-01 — La PWA ya es instalable, y BASE-06 quedó verificado en runtime.**
MARCA-01 a MARCA-05 (§ 5.2) hechos — `manifest.ts` completo y traducido, los 5 íconos de
`public/icons/`, splash de iOS en `public/splash/` cableado en `layout.tsx`. BASE-06: se
levantó `next build && next start` real y se confirmó con `curl` que `/serwist/sw.js` (200,
148 entradas de precache, ~5.2 MB), `/manifest.webmanifest` (200) y `/offline` (200, el
fallback del service worker) responden. Se agregó `share_target` al manifest (faltaba del
todo — `action: /add`, `method: GET`, mapea `title`/`text`/`url` a la nota del borrador en
`app/add/page.tsx`, una sola vez, sin pisar lo que el usuario ya tipeó) y quedó verificado en
el manifest servido. No se verificó instalación real en un dispositivo (eso requiere Chrome/
Android o Safari/iOS real, fuera de este entorno).

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
| **GATE-1 — RLS** | C2 (schema) | Por cada tabla: un test autenticado como household A que intenta leer/escribir/actualizar/**mover** una fila del household B, y falla en las cuatro. Sin este test la fase no está terminada. | **✅ CERRADO 2026-08-01.** Migraciones aplicadas y verificadas contra el proyecto real `perze-app` (ref `dhnyihwcsexraivhokoc`, org `torto-dev`). **86/86 aserciones en verde** en `supabase/tests/database/` cubriendo las ~32 tablas del esquema: `10_accounts_rls` 9, `11_transactions_rls` 8, `12_visibility_rls` 5, `13_catalog_rls` 5, `14_budgets_goals_rls` 10, `15_recurring_debts_rls` 8, `16_investments_rls` 10, `17_system_rls` 13, `18_fx_tags_payees_rls` 9, `19_identity_rls` 9. **Se encontraron y corrigieron 3 bugs críticos en el camino** (detalle en § 5.1, tras la tabla de migraciones): (1) soft-delete roto por RLS en 13+5 tablas con `deleted_at IS NULL` en SELECT — `20260801020000`/`020100`/`020200`; (2) `household_id`/FK-al-padre no era realmente inmutable en `tags`, `payees`, `institutions`, `asset_classes`, `instruments` — `20260801020300`; (3) recursión infinita en la policy de `household_members` por consultar la propia tabla sin pasar por una función `SECURITY DEFINER` — `20260801020400`. Los tres son del tipo que un test que solo prueba "no se ve la fila ajena" nunca atrapa — hacía falta probar también las escrituras legítimas propias. |
| **GATE-2 — Dinero y FX** | C3 + C4 | (a) cero `number`/`parseFloat` sobre un monto en todo el repo; (b) un movimiento sin cotización se guarda con `fx_rate`/`amount_base` en `NULL`, nunca rate=1; (c) el token de selección se ve en los dos modos, verificado con medidor de contraste, no a ojo. | **Falla (a) hoy mismo**: el sparkline del hero de Home usa `Number()`/`Math.round`/`BigInt` (§ 4, CON-06). (b) se cumple donde existe needs_fx. (c) no aplica todavía — el token de selección nuevo no existe (§ 4, CON-08). |
| **GATE-3 — Biblioteca** | C6 | Las 29 piezas `[spec]` existen o están explícitamente diferidas con motivo. `EmptyState` usa `ZMark`. `SplitBar` no toca la paleta de datos. `ScopeSwitcher` no existe ni como alias. | **CERRADO.** 29/29 piezas `[spec]` tienen código (docs/contrato-componentes.md § 4). `EmptyState` consume `ZMark`. `SplitBar` usa `PARTS_RAMP`, no `--data-1..5`. `ScopeSwitcher` no existe ni como alias. CON-09..30 y LIB-01..18 completos. |

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
| **CON-05** | **[dinero]** Agregar `originalAmount`/`originalCurrencyCode`/`originalRate` a `transactions` en el schema (migración) y a `TransactionRow` en `src/lib/db/schema.ts`; agregar `fxRate`/`fxSource`/`amountBase` a `settlements` | C2 + C3 | Bloquea C3 (lib/fx no puede completarse sin el tipo) y toda la captura en moneda distinta a la de cuenta (C8) | mediano | **hecho** | Migración ya tenía los campos (§ 5.1). `TransactionRow`/`SettlementRow`/`TransactionShareRow`/`TransactionSplitRow` actualizados en `src/lib/db/schema.ts`. Se encontró y corrigió un bug real en el camino: `save-transaction.ts`/`update-transaction.ts` usaban la moneda **capturada** como `currencyCode` de la transacción en vez de la de la cuenta — violaba la regla de las dos conversiones. Corregido: la primera conversión (capturada→cuenta) ahora resuelve por `fxRepo` y llena `original_*`; `amount`/`currencyCode` quedan siempre en moneda de cuenta. `npx tsc --noEmit` limpio, 119/119 tests, lint limpio en los archivos tocados |
| **CON-06** | **[dinero, urgente]** Reescribir el sparkline/delta del hero de Home (`src/app/(app)/page.tsx:106-119,164`) para no pasar por `Number()`/`Math.round()`/`BigInt()` — usar `lib/money` end-to-end | C3/GATE-2 | Bloquea GATE-2 | mediano | **en curso** | Grep de `Number(` sobre variables de plata en el archivo da cero resultados — **hecho, verificado**; `typecheck`/`eslint` limpios. Falta: test unitario con montos que exceden `Number.MAX_SAFE_INTEGER` — la lógica sigue inline en el componente, no extraída a una función pura testeable |
| **CON-07** | **[dinero, menor]** `src/components/motion/CountUp.tsx:29-34` interpola con `Number()`/`BigInt(Math.round())` durante la animación | C4 (motion) | Ninguno — no bloquea GATE-2 (es interpolación visual, el valor de reposo es correcto) | chico | **hecho** | `animate()` de Motion ahora anima el progreso 0→1 (un ratio, no un monto), y `interpolateAmount()` (nueva, exportada, con test) escala ese progreso a bigint con `roundHalfEven` — el monto en sí nunca pasa por `Number()`. Test en `CountUp.test.ts` prueba explícitamente un monto de 10^19 unidades (muy por encima de `MAX_SAFE_INTEGER`), extremos exactos y punto medio sin ruido de flotante |
| **CON-08** | **[token]** Crear el token de superficie de selección + anillo (audit D02): claro `#DEDEDA` (1,24:1) con anillo `#C9C9C4` (1,43:1); no tocar `--surface-3` (compartido con inputs/keypad) | C4/GATE-2 | Bloquea GATE-2; desbloquea todo componente seleccionable (`SegmentedControl`, `Chip`, `CategoryBubble`, `DateStrip`, `AccountCarousel`, `SelectableRow`, `OptionCard`, `InstitutionTile`) | mediano | **hecho, parcial** | `--selection-surface`/`--selection-ring` agregados a `globals.css` y documentados en `02-design-system.md` § 2.2, con contraste verificado por fórmula WCAG (no a ojo): claro 1,24:1/1,52:1, oscuro 1,24:1/1,45:1 (mismo orden de magnitud en los dos modos). Migrados y verificados visualmente en el navegador: `SegmentedControl` (variante no-marca), `CategoryBubble`, `DateStrip`, `AccountCarousel`, `OptionCard`, `InstitutionTile` — 6 de 8. `Chip` se dejó con `--primary-fill` a propósito: sus usos reales (filtros de fecha/tipo/cuenta/categoría) son "filtro activo", que el propio presupuesto de ruido permite en violeta — no es el bug de D02. **`SelectableRow` no existe en el repo todavía** (ni con ese ni otro nombre) — es trabajo de C6/LIB, no de esta pasada; no se inventó |
| **CON-09** | **[componente]** `StatusBadge`: mover el escalamiento por edad (`neutral` + `ageDays>=7` → `warning`) adentro del componente; hoy lo decide el caller (`RateRow.tsx:41-42`) | C6/GATE-3 | Parte de GATE-3 | chico | hecho | `RateRow` y cualquier otro caller solo pasan `ageDays`, nunca `status`; test unitario de la transición a los 7 días |
| **CON-10** | **[componente]** Normalizar props de tamaño string-o-number en `Skeleton.tsx` (`width`/`height`/`radius`) y `Sheet.tsx` (`height`) | C6/GATE-3 | Parte de GATE-3 | chico | hecho | `<Skeleton height="20" />` renderiza 20px, no colapsa a 0; test de regresión para ambos casos |
| **CON-11** | **[componente]** `SplitBar` v1: sacar la paleta de datos (`--data-1..5`) de un control arrastrable (audit D04/D17); no dibuja thumb; `height` es number-only (ya seguro) pero falta agregar `showThumb`/`showValues`/`tolerance` de la v2 del spec | C6/GATE-3 | Parte de GATE-3; bloquea I9/J2/J6 | mediano | hecho | Colores vienen de un token de "partes" no ligado a `--data-*`; thumb visible y arrastrable con hit-area 44px |
| **CON-12** | **[componente]** Extraer `KeypadKey` compartido entre `Keypad` y `PinKeypad` (hoy cada uno duplica su propio `<button>`); agregar `aria-live` a ambos (ninguno lo tiene hoy) | C6/GATE-3 | Parte de GATE-3 | chico | hecho | Un solo componente `KeypadKey` consumido por los dos; `Keypad` anuncia el monto por `aria-live`, `PinKeypad` anuncia "N de M dígitos" sin revelar el valor |
| **CON-13** | **[componente]** Extender `TabBar` con `badge?: number` por slot y `slots[3]` configurable por el usuario | C6/GATE-3 | Bloquea B6/F4/K3 | mediano | hecho | El 4to slot se lee de preferencia del usuario, default Análisis; badge visible con `aria-label` propio |
| **CON-14** | **[componente]** `TransactionRow`: agregar los 4 casos faltantes (`pending`, `shared`, `attachment`, `installment`) | C6/GATE-3 | Bloquea D1 | mediano | hecho | Los 4 estados tienen diseño visual propio y test de snapshot |
| **CON-15** | **[componente]** `AccountCarousel`: agregar `secondaryBalance?: ReactNode` para cuentas de broker en dos monedas | C6/GATE-3 | Bloquea E1 | chico | hecho | Cuenta de broker muestra ambas monedas sin overflow en 390px |
| **CON-16** | **[componente]** `ErrorState`: agregar segunda acción (`alternativeLabel` + `onAlternative`), camino alternativo primero | C6/GATE-3 | Bloquea el patrón de error de **todos** los hooks (ver CON-19) | mediano | hecho | Componente acepta 2 acciones; primera es la alternativa (ej. "ver offline"), segunda es "reintentar" |
| **CON-17** | **[componente]** `UndoToast`: agregar variante `progress` (sin acción, contador + barra 2px) — hoy siempre dibuja "Deshacer" aunque no haya nada que deshacer | C6/GATE-3 | Ninguno | chico | hecho | Variante `progress` no renderiza botón de acción |
| **CON-18** | **[componente]** Renombrar `OfflineBanner` → `Banner` con `status` + `action?` (el nombre asume un solo uso; ya sirve para warning/error) | C6/GATE-3 | Ninguno | chico | hecho | Un solo `Banner` con `status: 'offline' \| 'warning' \| 'error'` reemplaza los usos existentes, sin regresión visual |
| **CON-19** | **[patrón, alto impacto]** `EmptyState`: reemplazar el ícono de línea por `ZMark` al 20% (claro) / 28% (oscuro, audit D44) — afecta 68 estados vacíos ya diseñados sobre el componente viejo | C6/GATE-3 | Parte de GATE-3; es el fix #1 de la auditoría | mediano | hecho | `EmptyState` consume `ZMark`, no `Icon`; contraste de opacidad verificado en ambos modos |
| **CON-20** | **[patrón]** Escribir el hook/patrón de estado de error que hoy no existe en ningún hook (`isError` nunca se usa en `src/`) — patrón reusable sobre `ErrorState` (CON-16) para las 5 vistas de la Definición de Terminado | C5/C6 | Bloquea el criterio #2 de "terminado" para **toda** pantalla nueva de aquí en más | grande | hecho | Un wrapper (`useQueryWithErrorState` o similar) usado por Home y al menos 2 pantallas más como referencia; documentado para copiar en cada bloque nuevo |
| **CON-21** | **[componente, spec sin código]** Escribir la ficha de contrato + verificar los 4 componentes no mencionados en ningún lado que ya tienen código: `FxEditor`, `AmountScrubber`, `CategoryBubble`, `DateStrip` | C6/GATE-3 | Parte de GATE-3 | mediano | hecho | Cada uno tiene entrada en `contrato-componentes.md` (props, estados, a11y, tokens); `FxEditor` reconciliado explícitamente contra `Rate`/`PriceStatus` (mismo territorio, hoy sin relación declarada) |
| **CON-22** | **[componente, documentación]** Escribir fichas de contrato para los 16 componentes restantes "sin ficha" que ya tienen código y no requieren cambios: `Button`, `AppHeader`, `Amount`, `Icon`, `Chip`, `Card`, `SegmentedControl`, `SkeletonRow`, `Switch`, `Input`, `CurrencyChip`, `Sparkline`, `InsightCard`, `SyncDot`, `SeriesLegend`, `BarChart` | C6/GATE-3 | Parte de GATE-3 | mediano | hecho | 16 entradas nuevas en el contrato, sin cambios de código requeridos |
| **CON-23** | **[schema]** Documentar como excepción escrita `interest_rate`/`coupon_rate numeric(8,4)` (V5) e `instruments.ratio numeric(12,6)` (V6), que rompen la convención de escala pero probablemente son intencionales | C2 | Ninguno — evita que alguien "corrija" un valor correcto en una migración futura | chico | **hecho** | Comentario en `supabase/migrations/20260801010400_catalog.sql` explicando por qué esas columnas no siguen `numeric(24,12)`/`numeric(38,12)` — son tasas/ratios, no montos ni tipos de cambio |
| **CON-24** | **[schema]** Verificar y resolver V8: contradicción entre "DELETE nunca se expone" y la política `splits_all ... FOR ALL` sobre `transaction_splits`, que además no tiene `deleted_at` | C2 | Bloquea GATE-1 si no se resuelve antes de escribir la política de `transaction_splits` | chico | **hecho** | `transaction_splits` y `transaction_shares` tienen `deleted_at` en `supabase/migrations/20260801010700_transactions.sql`; sus políticas están separadas en SELECT/INSERT/UPDATE, sin `DELETE`. Se dejó `transaction_tags` con `FOR ALL` (incluye DELETE real) porque no tiene significado financiero propio — un tag sacado no pierde ningún hecho contable |
| **CON-25** | **[ruta, documentación]** Escribir la convención implícita "los flujos de pantalla completa viven fuera de `(app)/`" (`accounts/new`, `accounts/[id]/edit`, `transactions/[id]/edit`, `add`) — no es un bug, pero nadie la documentó y alguien va a violarla | C1 | Ninguno | chico | **hecho** | Convención escrita en `CLAUDE.md` § "Convención de rutas", con los 4 casos existentes y el patrón ruta-hermana + interceptora en `@modal` para `add` |
| **CON-26** | **[lib]** Escribir `formatNumber(value: number, decimals: number)` en `lib/money` — hoy no existe en absoluto; `decimalsFor()` debe aceptar `instrument` además de `currency` | C3 | Bloquea todo el bloque I (inversiones) — no hay formateador de cantidades | mediano | **hecho** | `formatNumber` en `src/lib/money/format.ts`, sin default en `decimals`. `decimalsForQuantity()` nuevo en `decimals.ts` (crypto por símbolo, FCI/Crypto por asset class, default 0 para acciones/CEDEARs/bonos). Falta el test explícito BTC(8)/FCI(4)/UYU(0) en la misma lista — se escribe cuando se construya `PositionRow` (LIB-02) que es quien realmente los mezcla |
| **CON-29** | **[componente, marca]** `InstitutionTile`: reemplazar los logos de institución por una baldosa de monograma — dos letras sobre `institutions.color` (columna ya existente, no un archivo); `institutions.logo_url` queda como slot opcional para una carpeta local ignorada por git (§ 1.10) | C6/GATE-3 | Bloquea A6, E1, E3 | mediano | hecho | `InstitutionTile` no importa ni referencia ningún binario de logo de terceros; dos instituciones distintas se ven visualmente distintas; funciona offline |
| **CON-30** | **[componente, marca]** Cero banderas en toda la app, dos casos distintos: chip con código de moneda (`CurrencyChip`) donde el token identifica una moneda (E6, H6, I2, K3); bandera eliminada y solo el nombre donde identifica un país (A4, E3) (§ 1.11) | C6/GATE-3 | Afecta A4, E3, E6, H6, I2, K3 | mediano | **hecho** | Encontrado haciendo la verificación visual de CON-08 (no en el trabajo de bloques todavía): `CurrencyChip.tsx` literalmente tenía el comentario "el único lugar del sistema donde aparece emoji" — la decisión de `CLAUDE.md` la revierte y el componente no se había actualizado. Corregido: `CurrencyChip` sin bandera; `onboarding/country/page.tsx` (A4) y `AccountFormFlow.tsx` (E3, formulario) sin bandera, solo nombre; `accounts/page.tsx` y `accounts/[id]/page.tsx` (E1/E3, lista y detalle) tenían un tercer sitio no listado en el plan original — mostraban la bandera SOLA sin nombre, corregido a nombre vía `COUNTRY_MESSAGE_KEY`. `countryFlag()`/`CountryRef.flag` (muertos) eliminados de `lib/reference/countries-currencies.ts`. `grep -P '[\x{1F1E6}-\x{1F1FF}]'` sobre `src/` da cero resultados, verificado |

---

## 5. Parte 2 — CONSTRUIR: migraciones, biblioteca, capas base

### 5.1 Migraciones (C2) — 12 migraciones, reordenadas por dependencia real

**✅ Escritas 2026-07-31, sin aplicar todavía (sin proyecto Supabase linkeado — decisión
explícita del usuario: escribir a mano primero, enlazar y pushear después).** El orden de
`05-prompts-desarrollo.md` (que este documento seguía antes) es **irresoluble tal cual
está escrito**: `current_households()`/`can_see()` se usan en las policies de SELECT de
`accounts`/`categories` pero dependen de tablas que ese orden crea después
(`household_members`, `visibility_grants`); y `accounts.institution_id` referencia
`institutions`, que ese orden crea en la migración siguiente. Postgres valida los cuerpos
de función `LANGUAGE sql` contra los objetos existentes al momento de `CREATE FUNCTION` —
no se puede diferir. El orden real, por dependencia:

| Archivo | Migración | Tablas / contenido | Tamaño | Estado |
|---|---|---|---|---|
| `20260801010000_extensions.sql` | `extensions` | `pgcrypto` (los IDs de raíz igual se generan en el cliente) | chico | **hecho** |
| `20260801010100_reference.sql` | `reference` | `currencies`, `countries`, `fx_rates` (Patrón C puro) — antes que `identity` porque `households.base_currency` la referencia | mediano | **hecho** |
| `20260801010200_identity.sql` | `identity` | `profiles`, `households`, `household_members`, `household_invites`, `household_fx_preferences` + `current_households()`/`can_write()` | grande | **hecho** |
| `20260801010300_visibility.sql` | `visibility` | `visibility_grants` + `can_see()` — **movida acá** (el plan la ubicaba en "fx", después de accounts/categories; tiene que existir antes porque esas dos tablas llaman a `can_see()` en su SELECT). La policy de escritura completa se cierra en `classification.sql`, una vez que `categories` existe | mediano | **hecho** |
| `20260801010400_catalog.sql` | `catalog` | `institutions`, `asset_classes`, `instruments` (Patrón C con clonado) — antes que `accounts` porque `accounts.institution_id` la referencia | grande | **hecho** |
| `20260801010500_accounts.sql` | `accounts` | `accounts`, `account_balance_snapshots` | mediano | **hecho** |
| `20260801010600_classification.sql` | `classification` | `categories`, `tags`, `payees` — después de `accounts` porque `payees.default_account_id` la referencia. Cierra acá la policy de `visibility_grants` | grande | **hecho** |
| `20260801010700_transactions.sql` | `transactions` | `transactions`, `transaction_tags`, `transaction_splits`, `transaction_shares` — `original_*` (CON-05), `fx_pair` CHECK, dos triggers `inherit_fx_state_*` (uno por tabla hija, nombres de columna distintos), trigger de recompute de `accounts.current_balance` | grande | **hecho** |
| `20260801010800_fx_overrides.sql` | `fx_overrides` | `fx_overrides` (`valid_from`/`valid_to`) | mediano | **hecho** |
| `20260801010900_budgets_goals.sql` | `budgets_goals` | `budgets`, `budget_lines`, `goals` — **`budget_periods`, `goal_contributions`, `goal_accounts` NO están**, ver nota de gap abajo | grande | **hecho, parcial** |
| `20260801011000_recurring_debts.sql` | `recurring_debts` | `recurring_rules`, `debts` (con `origin_transaction_id`, `installment_count`), `debt_schedule` | grande | **hecho** |
| `20260801011010_investments.sql` | `investments` | `portfolios`, `trades` (con `fx_pair` CHECK), `price_snapshots` (Patrón C puro, es dato de mercado no de household), `target_allocations`, `portfolio_snapshots` — **`instrument_cashflows`, `benchmarks`/`benchmark_series`, vistas `positions`/`fx_latest` NO están**, ver nota de gap abajo | grande | **hecho, parcial** |
| `20260801011100_system.sql` | `system` | `settlements` (con fx), `rules`, `insights`, `audit_log`, `import_batches` — **`notification_preferences`+push subs, `price_index`, `card_statements`, `household_currencies` NO están**, ver nota de gap abajo | grande | **hecho, parcial** |
| `20260801020000_fix_soft_delete_rls.sql` | corrección | Saca `deleted_at IS NULL` de 13 policies de SELECT (bug #1 de GATE-1, ver nota abajo) | mediano | **hecho** |
| `20260801020100_fix_soft_delete_rls_children.sql` | corrección | Mismo bug, 5 policies de hijas que chequeaban el `deleted_at` del padre | chico | **hecho** |
| `20260801020200_fix_soft_delete_rls_children_2.sql` | corrección | Mismo bug, 4 policies más encontradas escribiendo los tests | chico | **hecho** |
| `20260801020300_fix_tags_payees_immutability.sql` | corrección | `household_id` inmutable en `tags`/`payees`/`institutions`/`asset_classes`/`instruments` (bug #2) | chico | **hecho** |
| `20260801020400_fix_household_members_recursion.sql` | corrección | Recursión infinita en `household_members_update` (bug #3), nuevo helper `is_household_admin()` | chico | **hecho** |

**Endurecimiento de seguridad aplicado a las 12 migraciones, no solo copiado del documento
fuente.** El patrón de `WITH CHECK` que trae `01-arquitectura-datos.md` § 3 en su propio
ejemplo (`household_id IN (SELECT current_households()) AND created_by = ...`) **no
impide que un usuario miembro de dos households mueva una fila de uno a otro** — solo
bloquea moverla a un household del que no es miembro. Se corrigió en las 15 policies de
UPDATE/ALL de esta sesión a `household_id = (SELECT tabla.household_id)` (o el FK al padre
equivalente en las entidades hijas), que es inmutabilidad real. Vale la pena revisar este
mismo patrón si en el futuro se escribe una política de UPDATE copiando literalmente el
ejemplo del documento en vez de este archivo.

**CON-23 y CON-24 (§ 4) quedaron resueltos como parte de esta migración, no como ítems
aparte:** el comentario de excepción de `interest_rate`/`coupon_rate`/`ratio` está en
`catalog.sql`, y `transaction_splits`/`transaction_shares` tienen `deleted_at` con policies
separadas SELECT/INSERT/UPDATE sin `DELETE` (en vez del `FOR ALL` original que exponía
DELETE, violando "DELETE nunca se expone").

**Tres gaps de documentación reales, no inventados en la migración:** `docs/plan-de-trabajo.md`
(este archivo) menciona en su propia tabla de MIG-08/10/11 siete tablas sin schema escrito
en ningún lado de `01-arquitectura-datos.md` § 2.7-2.9: `budget_periods`,
`goal_contributions`, `goal_accounts` (bloquea CONS-F05/F06), `instrument_cashflows`,
`benchmarks`/`benchmark_series` (bloquea CONS-I11/I10), `notification_preferences` + push
subscriptions (bloquea K12), `price_index` (bloquea H7), `card_statements` (bloquea E4) y
`household_currencies` (bloquea CONS-E06 — "monedas en uso" para el flag de progresividad).
Ninguna se inventó: son tablas con implicancia de producto/schema real (ledger vs.
agregado, 1:N vs. N:N, forma del payload) que necesitan una decisión antes de escribir la
migración, no una suposición. **⚠ DECISIÓN pendiente**, no bloquea el resto de C2/GATE-1
pero sí bloquea programar F5/F6/I10/I11/K12/H7/E4/E6 tal como están descritas.

**✅ 2026-08-01 — Proyecto Supabase enlazado, migraciones aplicadas, tests corridos y en
verde contra el proyecto real.** El usuario creó `perze-app` (ref `dhnyihwcsexraivhokoc`,
org `torto-dev`, región `us-east-2`). El CLI estaba logueado con otra cuenta
(`TradeHub`/`cpetrsvbujadxmsyckae`) — se resolvió con `supabase login --token` usando un
Personal Access Token dejado en `.env.local`, después con `supabase link --project-ref` y
`supabase db push --linked`. Las 12 migraciones (más una 13ª de corrección, ver abajo)
corrieron limpio.

**No existe `supabase test db` en esta máquina** (necesita el stack local con Docker). Los
tests de `supabase/tests/database/*.sql` se corren con
`supabase db query --linked -f <archivo>`, que ejecuta contra la Management API — **no**
una sesión psql real, con dos consecuencias que ya están resueltas en el código:

1. **No soporta `\gset`** (meta-comando de psql) — el fixture pasa valores entre pasos con
   variables de sesión de Postgres (`set_config`/`current_setting` bajo `tests.*`, ver
   `tests.stash()`/`tests.get()` en `00_setup.sql`), que sí son server-side y funcionan con
   cualquier forma de ejecutar el archivo.
2. **Solo devuelve las filas del último statement del archivo** — no hay forma de ver el
   resultado de cada aserción intermedia. Se resolvió con `tests.tap_log` (tabla) +
   `tests.log()`: cada aserción se envuelve en `tests.log(is(...))`/`tests.log(throws_ok(...))`,
   y el archivo termina con `SELECT line FROM tests.tap_log ORDER BY id;` **antes** del
   `ROLLBACK` final, que muestra todo el reporte TAP junto.

**✅ GATE-1 cerrado 2026-08-01 — 86/86 aserciones en verde**, las ~32 tablas del esquema
cubiertas en 10 archivos: `10_accounts_rls` 9, `11_transactions_rls` 8, `12_visibility_rls`
5, `13_catalog_rls` 5, `14_budgets_goals_rls` 10, `15_recurring_debts_rls` 8,
`16_investments_rls` 10, `17_system_rls` 13, `18_fx_tags_payees_rls` 9, `19_identity_rls` 9
(household_members, household_invites, household_fx_preferences, profiles — usadas como
fixture en todos los demás archivos pero sin test adversarial propio hasta este último).

**Tres bugs críticos encontrados en el camino, los tres del tipo que un test que solo
prueba "A no ve la fila de B" nunca atrapa** — hacía falta probar también que las
escrituras legítimas y propias de A siguieran funcionando:

1. **Soft-delete roto por RLS en 18 tablas.** `UPDATE ... SET deleted_at = now()` —el único
   mecanismo de borrado de todo el esquema— fallaba porque Postgres exige que la fila
   **resultante** de un UPDATE también satisfaga la política de SELECT de la tabla, no solo
   el `WITH CHECK` de UPDATE. Verificado empíricamente: con `WITH CHECK (true)` el UPDATE
   seguía fallando, y sacando `deleted_at IS NULL` de la política de SELECT, funcionó. Sin
   este fix, **nadie podría haber borrado nunca nada** en producción. Se preguntó al usuario
   cómo resolverlo (sacar el filtro de RLS a la capa de queries de la app, vs. funciones RPC
   `SECURITY DEFINER` por tabla) — eligió la primera. Tres migraciones: `20260801020000`
   (13 tablas raíz: `accounts`, `budgets`, `categories`, `debts`, `goals`, `portfolios`,
   `recurring_rules`, `rules`, `settlements`, `trades`, `transaction_shares`,
   `transaction_splits`, `transactions`), `20260801020100` y `20260801020200` (5 policies de
   tablas hijas que además chequeaban `deleted_at IS NULL` del _padre_ dentro de un
   `EXISTS` — mismo problema de fondo, encontrado tabla por tabla al escribir los tests de
   `debt_schedule`, `target_allocations`, `portfolio_snapshots`,
   `account_balance_snapshots`, `transaction_tags`). **Consecuencia para cualquier código
   que lea estas tablas: RLS ya no filtra borrados — toda query que no quiera ver
   soft-deletes tiene que agregar `.eq('deleted_at', null)` explícitamente.** Hay que
   recordarlo al escribir cada hook de TanStack Query (BASE-01 en adelante).
2. **`household_id` no era realmente inmutable en `tags`, `payees`, y en el patrón de
   clonado (`institutions`, `asset_classes`, `instruments`)** — quedaron fuera de la pasada
   de endurecimiento original por un descuido, con el patrón viejo
   (`household_id IN current_households()`) que permite mover una fila propia a otro
   household del que el mismo usuario también es miembro. Corregido en
   `20260801020300_fix_tags_payees_immutability.sql`.
3. **Recursión infinita en `household_members_update`**: su `USING` consultaba
   `household_members` directamente (no a través de una función `SECURITY DEFINER`) desde
   dentro de una policy de la misma tabla — exactamente lo que `current_households()`/
   `can_write()` existen para evitar, pero esta policy puntual no los usaba. Postgres lo
   detecta y aborta con `infinite recursion detected in policy for relation
   "household_members"`. Corregido con un helper nuevo, `public.is_household_admin(h)`, en
   `20260801020400_fix_household_members_recursion.sql`.

**Regla general para cualquier policy nueva de acá en adelante**: nunca consultar
directamente la tabla a la que la policy pertenece desde dentro de su propia policy — pasar
siempre por una función `SECURITY DEFINER SET search_path=''`, y testear explícitamente que
las escrituras legítimas del dueño (incluido el soft-delete) siguen funcionando, no solo que
las ajenas fallan.

### 5.2 Capas base

| ID | Qué | Fase | Tamaño | Estado | Notas |
|---|---|---|---|---|---|
| **BASE-01** | `lib/money` — extender con el modelo de dos conversiones (usa CON-05) y `formatNumber` (CON-26) | C3 | grande | **hecho** | |
| **BASE-02** | `lib/fx` — cadena de resolución de 4 pasos, inmutabilidad de rate salvo la única excepción de `inherited`→histórico real al reconectar, providers, `/api/fx`, cron diario | C3 | grande | **hecho, parcial** | La cadena de 4 pasos, providers (dolarapi/frankfurter) y `/api/fx` ya existían con buen nivel; lo que faltaba era la conexión real: `/api/fx` ahora lee `fx_overrides`/`fx_rates` de Supabase (antes: override hardcodeado en `null`, cache solo en memoria de proceso — se perdía en cada cold start). Verificado end-to-end contra `perze-app` con el dev server: trajo una cotización real de dolarapi.com y la resolvió bien. **Cuidado de precisión real**: `numeric(24,12)` vuelve de PostgREST como JSON number si no se pide `::text` explícito en el `select`, lo que le vuela precisión a un rate igual que le pasaría a un monto — el route ahora pide `rate::text` en ambas tablas y parsea con `parseRate()`, nunca confía en el `number` del tipo generado. `fxRepo.resolve()` (Dexie) ahora pasa `householdId` a `/api/fx` para que el lookup de `fx_overrides` no quede sin uso. **Falta real**: el cron diario (no existe ningún endpoint ni config de cron todavía) y la excepción de `inherited`→histórico al reconectar (ambos, trabajo de C5/offline, no de esta pasada) |
| **BASE-03** | `globals.css` con `@theme`/`.dark` (Tailwind v4), incluye el token de selección (CON-08) | C4 | mediano | pendiente | |
| **BASE-04** | Motion primitives (`Pressable`, `CountUp` fix incluido — CON-07, `StaggerList`, `SharedElement`, `MorphButton`, `useHaptics`, `useMotionIntensity`) | C4 | grande | **hecho, parcial** | 5 de 6 ya existían (`Pressable`, `CountUp` con el fix de CON-07, `StaggerList`, `MorphButton`, `useHaptics`, `useMotionIntensity` — son 6 nombres pero uno de la lista, `useMotionIntensity`, ya cuenta separado). `SharedElement` no es un componente propio en `02-design-system.md` § 5.2: es el patrón `layoutId` de Motion (o `<ViewTransition>` de React 19.2) aplicado directo a `Amount`/`Icon` cuando se construya la transición lista→detalle real (D1→D3) — no se inventa un wrapper especulativo sin una pantalla que lo use |
| **BASE-05** | Offline: Dexie schema, outbox worker + Background Sync, resolución de conflictos LWW→`audit_log`, `createOptimisticMutation()`, Realtime debounced | C5 | grande | **hecho, parcial** | **Encontrado**: `createOptimisticMutation()` y el outbox (`lib/offline/outbox.ts`) ya existían como infraestructura, pero **nada los llamaba** — los 6 repos (`accounts`, `categories`, `tags`, `payees`, `transactions`) escribían directo a Dexie sin encolar nada; drenar la cola no habría tenido nada que drenar. **Hecho**: los 6 repos ahora encolan en cada mutación (`lib/offline/sync-config.ts` mapea camelCase→snake_case por tabla, con `bigint` siempre como `string` — nunca `number`, ni siquiera para un rate); `lib/offline/sync-worker.ts` (`drainOutbox`) traduce cada entrada a un `upsert`/`update`/`delete` real contra Supabase, con "falla una fila, siguen las demás"; `lib/offline/use-sync-loop.ts` dispara el drenaje al montar, al volver la conexión, y cada 30s. Todo testeado con un doble de Supabase (10 tests nuevos) — typecheck, suite completa (131/131) y build limpios. `CategoryRow` local no tenía `visibility`/`ownerId`/`createdBy`/timestamps que el schema del servidor exige — alineado, con los dos call sites de seed/onboarding actualizados. **✅ Desbloqueado 2026-08-01**: C7 (auth real) ya existe — se agregaron `households`/`household_members` a `SYNC_TABLES` y se verificó de punta a punta contra `perze-app` que un household creado localmente sincroniza de verdad (ver CONS-A11). **Sin hacer, a propósito**: Realtime (pull de cambios de otros miembros) y el registro de Background Sync en el service worker — necesitan dos sesiones autenticadas simulando dos miembros para verificarse de verdad, quedan para la próxima pasada de C5 |
| **BASE-06** | Serwist: precache, estrategias de cache, fallback offline, manifest/shortcuts/share target | C5 | mediano | **hecho** | Verificado en runtime (`next build && next start` + `curl`): 148 entradas de precache, `/offline` y el manifest sirven 200. `share_target` faltaba del todo — agregado y cableado a `app/add/page.tsx` |

**Cableado de marca — hecho.** Verificado el 2026-07-31: los 5 ítems de abajo ya están
implementados (ver notas por fila). Queda una única brecha real: confirmar que Serwist
(BASE-06, sigue pendiente) precachea el manifest.

| ID | Qué | Fase | Tamaño | Estado | Notas |
|---|---|---|---|---|---|
| **MARCA-01** | Copiar `icon.svg`, `favicon.ico`, `apple-icon.png` (180×180) y `opengraph-image.png` a `src/app/` (metadata basada en archivo de Next.js 16); `og-square.png` (1200×1200, para que WhatsApp no recorte el 1200×630) como imagen adicional | C1 | chico | **hecho** | Verificado en código: los 4 archivos están en `src/app/`. `og-square` no está copiado a `src/app/` (solo existe en `docs/marca/assets/`) — Next 16 no tiene convención de archivo para una imagen OG cuadrada adicional, así que si hace falta va como asset explícito en `opengraph-image` array, no como file convention; no bloquea nada, se retoma si algún consumidor (WhatsApp) lo pide |
| **MARCA-02** | Generar `public/icons/` con `icon-192`/`icon-512` (`purpose: "any"`), `icon-maskable-192`/`icon-maskable-512` (`purpose: "maskable"`, **archivos distintos** de los `any` — declarar el mismo PNG en los dos hace que Android recorte la Z), e `icon-mono-512` (`purpose: "monochrome"`, para íconos temáticos de Android 13+) | C1 | chico | **hecho** | Verificado: los 5 archivos existen en `public/icons/` y `manifest.ts` los declara con su `purpose` correcto, sin mezclar `any`/`maskable` |
| **MARCA-03** | Generar los dos íconos de shortcut de 96×96 (`shortcut-gasto.png`, `shortcut-movimientos.png`) — dependen de qué acciones queden en el set final de shortcuts, por eso van con el manifest y no antes | C5 | chico | **hecho** | Verificado: `shortcut-gasto-96.png`/`-192.png` existen y están en `manifest.ts`. Solo un shortcut (agregar gasto) — "movimientos" no se generó; si el set final de shortcuts crece, retomar acá |
| **MARCA-04** | Escribir `manifest.webmanifest` completo (name, short_name, start_url, display, background_color, theme_color, los 5 íconos de MARCA-02 sin mezclar `any`/`maskable`, shortcuts con MARCA-03) y cablearlo junto a Serwist (BASE-06) | C5 | mediano | **hecho** | Verificado en runtime: `src/app/manifest.ts` completo, async, traducido con next-intl, servido en 200 con `share_target` incluido |
| **MARCA-05** | Splash de iOS (~15 pares claro/oscuro, uno por resolución): generarlos en el build, **no versionarlos** — agregar el paso al pipeline de build, no a `public/` | C5 (o config de build, junto a C1) | mediano | **hecho, con nota** | Verificado: 28 PNG (14 dispositivos × 2 esquemas) en `public/splash/`, generados por `scripts/generate-splash-screens.mjs`, referenciados en `layout.tsx` con media queries correctas. Contradice el criterio "no versionarlos": están commiteados en `public/`, no generados en build. Funciona igual; si se quiere honrar el criterio original habría que moverlos a un paso de build y gitignorarlos — no bloquea nada, es una discrepancia menor entre lo planeado y lo hecho |

### 5.3 Biblioteca de componentes (C6) — 18 piezas `[spec]` genuinamente nuevas

(Las otras 11 de las 29 del contrato ya tienen código parcial y están en § 4 como
CON-09..CON-19. Los 4 sin ficha con código ya existente están en CON-21.)

| ID | Componente | Bloquea | Tamaño | Estado |
|---|---|---|---|---|
| **LIB-01** | `PriceStatus` | I2/I3/I4/I12 | chico | hecho |
| **LIB-02** | `PositionRow` | I3 | mediano | hecho |
| **LIB-03** | `NeedsFxBanner` (count-only, sin `amount` — ver contrato a corregir) | H1a/H5/H7/F2/G1/G4/I2/I3/I11/J2/J7/K1/E8 | mediano | hecho |
| **LIB-04** | `MonthCalendar` | G1, D5 | mediano | hecho |
| **LIB-05** | `CalendarHeatmap` (con `--ramp-1..7`, ver LIB-17) | H8 | mediano | hecho |
| **LIB-06** | `Donut` | H2, I2 | mediano | hecho |
| **LIB-07** | `Waterfall` (con invariante de dev-time: deltas suman el total) | H5 | mediano | hecho |
| **LIB-08** | `Sankey` | H4 — "el más necesitado", hoy sin coordenadas | grande | hecho |
| **LIB-09** | `RankingBar` | H9 | chico | hecho |
| **LIB-10** | `BenchmarkBars` | I10 | mediano | hecho |
| **LIB-11** | `StoryFrame` | H12 (Wrapped) | mediano | hecho |
| **LIB-12** | `InfoCard` | I10 | chico | hecho |
| **LIB-13** | `DragRow` (handle 44px) | I8, K5, E1 | chico | hecho |
| **LIB-14** | `ComparisonBars` | J8 | mediano | hecho |
| **LIB-15** | `MirrorBanner` | J4/J4b | chico | hecho |
| **LIB-16** | `SectionGroup` (unifica `AccountRow`/`RateRow`/`GroupCard`/`ResultGroup`/`ResolutionChain`) | E, K, búsqueda global | grande | hecho |
| **LIB-17** | Iconos nuevos (`mail`, `lock`, `fingerprint`, `install`, `globe`, `bank-checking`) + tokens `--ramp-1..7` en `charts.css` | LIB-05, varias pantallas de auth/onboarding | chico | hecho |
| **LIB-18** | `StackedBar`/`DivergingBar` | H3, H6, H7 | mediano | hecho |

**→ GATE-3: CERRADO.** LIB-01..18, CON-09..30 completos.

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
| CONS-A01 | A1 | No | chico | **hecho** | `onboarding/welcome/page.tsx`; gate en `(app)/layout.tsx` (redirige acá solo la primera vez sin household, vía `localStorage`) |
| CONS-A02 | A2 | Sí | mediano | **hecho, parcial** | Auth real conectada: `signInWithOtp`/`verifyOtp` contra Supabase, no simulado. Sin OAuth, el campo de email es primario y los botones de Google/Apple **no se renderizan** (`NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS` vacío en este proyecto — ni Google ni Apple tienen credenciales configuradas) — verificado en el navegador, coincide con el diseño de dos estados. Falta: probar el click-through completo del código de 6 dígitos en vivo (el rate limit de emails del plan gratuito de Supabase frenó la prueba después de varios intentos vía script + navegador en la misma sesión — el mecanismo ya se validó de punta a punta por script, ver CONS-A11) |
| CONS-A03 | A3 | Sí | mediano | **hecho, parcial** | UI ya existía con el patrón de OTP de 6 dígitos (coincide con `verifyOtp`, mejor que un link+callback); ahora verifica de verdad contra Supabase en vez de aceptar cualquier código. Resuelto (§ 1.7): sigue sin la tarjeta "MIENTRAS TANTO" ni "Empezar sin conexión" — decisión de producto, no pantalla incompleta |
| CONS-A04 | A4 | Sí | chico | **hecho** | `onboarding/country/page.tsx` — resuelto (§ 1.11, CON-30): identifica país, bandera eliminada, queda el nombre solo |
| CONS-A05 | A5 | Sí | chico | **hecho** | `onboarding/usage/page.tsx` — decide `households.enabled_modules` incluye `family` |
| CONS-A06 | A6 | Sí | mediano | **hecho** | `onboarding/account/page.tsx` — resuelto (§ 1.10, CON-29): `InstitutionTile` con monograma sobre `color`, no logo real |
| CONS-A07 | A7 | Sí | mediano | **hecho** | `onboarding/complete/page.tsx` — saldo inicial pedido después del primer gasto (junto con A10), no antes |
| CONS-A08 | A8 | No | chico | **hecho** | `(app)/more/categories/page.tsx`; nueva plantilla "Completa" (20, con subcategorías de super/transporte/salud) en `category-templates.ts`; `applyCategoryTemplate()` nunca borra categorías con movimientos cargados, solo archiva las del sistema sin uso |
| CONS-A09 | A9 | No | chico | **hecho** | `(app)/more/modules/page.tsx`; apagar con datos reales pide confirmación con el número real (recurrentes, cuotas/deudas, cuentas de inversión, otros miembros) — nunca inventado; presupuestos/metas sin tabla todavía muestran 0 honesto |
| CONS-A10 | A10 | No | chico | **hecho** | `onboarding/complete/page.tsx` — solo después de `/add` (C8 ya hecho), con `beforeinstallprompt` real + fallback de copy en iOS |
| CONS-A11 | A11 | Sí | mediano | **hecho, parcial** | `completeOnboarding()` ya existía (household + cuenta + plantilla de categorías, todo local-first) pero usaba `DEMO_USER_ID` hardcodeado incluso después de un login real — nunca iba a poder sincronizar (`created_by` no coincidía con ningún `auth.uid()`). Corregido: recibe el `userId` real de la sesión. **Verificado de punta a punta contra `perze-app` con un usuario de prueba real** (`auth.admin.generateLink` + `verifyOtp`, sin inbox real): login → trigger crea `profiles` → household → household_members (self, owner) → accounts → categories, los 5 pasos con RLS real, y aislamiento cross-household confirmado. Se encontraron y corrigieron 2 bugs de RLS en el camino (households/household_members sin policy de INSERT; recursión en `household_members_insert`) y un gap de datos (sin seed de `currencies`/`countries` en producción) — ver § 5.1 y las migraciones `20260801030000`-`20260801030300`. Mismo patrón aplicado a los otros 4 sitios que usaban `DEMO_USER_ID` fuera de onboarding (`useCurrentUserId()` nuevo, en `reconcile`, `accounts/new`, `accounts/edit`, `CaptureFlow`) |
| CONS-A12 | L6 (bloqueo) | — | mediano | **hecho** | `usePinStore` (hash SHA-256, nunca texto plano; 3 intentos → 30s de bloqueo, nunca borra el PIN) + `PinGate` en `(app)/layout.tsx` (nunca en `/add` ni en la edición de los 60s) + `(app)/more/security` para activar/definir el PIN. Apagado por defecto |

### 6.3 Bloque C — Captura rápida (fase C8)

11 pantallas. El objetivo duro es <90s señal→primer gasto guardado.

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-C01 | C1 monto (Keypad+AmountScrubber) | grande | **hecho** | `CaptureFlow`/`AmountStep`; `AmountScrubber` ahora wireado (dragea `amountExpression` vía `amountToExpression()`, tap corto no hace nada porque el keypad ya está siempre visible abajo) |
| CONS-C02 | C2 categoría (chips frecuentes por hora) | mediano | **hecho** | `CategoryStep.tsx` + `use-frequent-categories.ts` |
| CONS-C03 | C3 detalle colapsable | mediano | **hecho** | `DetailsSheet.tsx` |
| CONS-C04 | C4 conversión de moneda | grande | **hecho** | `save-transaction.ts` resuelve `original_*` vs. moneda de cuenta vía `fxRepo.resolve()` (las dos conversiones de CLAUDE.md, no una) |
| CONS-C05 | C5 ingreso | mediano | **hecho** | `SegmentedControl` de kind en `AmountStep` |
| CONS-C06 | C6 transferencia (incl. cross-currency) | grande | **hecho** | Selector origen/destino + invertir en `CaptureFlow` |
| CONS-C07 | C7 guardado optimista + animación + undo 5s | grande | **hecho** | `MorphButton` (botón→check→vuelo) + `UndoToast` vía `sonner`, sobrevive al desmontaje del flow |
| CONS-C08 | C8 burst mode | mediano | **hecho** | `resetForBurst()` + contador en el header del flow |
| CONS-C09 | C9 captura por voz (Web Speech API, parser rioplatense) | grande | **hecho, parcial** | `VoiceCaptureSheet.tsx` + `parse-voice.ts` (con test). Pendiente: verificar soporte fuera de Chrome/Safari en dispositivo real — el fallback a "no soportado" ya existe (`voice_sheet.unsupported`) |
| CONS-C10 | C10 foto de ticket | chico | **hecho** | Solo el entry point (botón + toast "todavía no disponible"), como pide el diseño — "fase futura" declarada |
| CONS-C11 | C11 error y offline al guardar | mediano | **hecho, parcial** | **Corregido contra una mala etiqueta de este mismo plan:** `docs/design/INDEX.md` dice que C11 es "Sin conexión al guardar", no "auto-categorización por reglas" (eso no está en ningún archivo de diseño — se inventó acá por error). Hecho: toast post-guardado distingue needs_fx vs. offline (`navigator.onLine`); `Banner status="offline"` con conteo real ahora también en D1 (antes solo en Home). Pendiente: C11b (el servidor rechaza — chip "reintentar ahora"/"ver la cola") necesita `sync_state` expuesto por fila, que hoy no existe ni en el schema de Dexie ni en Postgres más allá del outbox interno |

### 6.4 Bloque L — Sistemas transversales (fase C9)

L1-L5 (L6 va en C7, § 6.2). Se programan últimos a propósito, "una familia aplicada diez
veces" — deben ir antes de C10-C18 porque D-K los consumen.

| ID | Pantalla/sistema | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-L01 | L1 estados vacíos (usa CON-19 EmptyState/ZMark) | chico | **hecho** | No es una pantalla propia — es el patrón `EmptyState`+`ZMark` ya aplicado en cada lista real (home, cuentas, movimientos, búsqueda, resolver FX) |
| CONS-L02 | L2 skeletons | chico | **hecho** | `Skeleton`/`SkeletonRow`/`SkeletonBlock` (LIB) ya aplicados en cada pantalla con carga |
| CONS-L03 | L3 errores (usa CON-16/CON-20) | mediano | **hecho** | `useQueryErrorState` (CON-20) + `ErrorState` (CON-16) wireados en Home, cuentas y movimientos; sin botón de "usar sin conexión" — resuelto (§ 1.7) |
| CONS-L04 | L4 toasts | chico | **hecho** | `sonner` + `UndoToast` (guardado/deshacer en captura, PIN activado, plantilla de categorías) |
| CONS-L05 | L5 onboarding contextual | mediano | **hecho** | `ContextualTooltip` + `useContextualTooltipStore` (persistido, un solo `id` a la vez) — primera instancia real: el toggle de modo privacidad en Home |

### 6.5 Bloque D — Movimientos (fase C10)

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-D01 | D1 lista (parchear `TransactionRow`, CON-14) | mediano | **hecho** | `(app)/transactions/page.tsx`, virtualizada, con `Banner` offline (CON-11) |
| CONS-D02 | D2 filtros | mediano | **hecho** | `MovementsFiltersSheet.tsx` |
| CONS-D03 | D3 detalle | mediano | **hecho** | `(app)/transactions/[id]/page.tsx` |
| CONS-D04 | D4 editar | mediano | **hecho** | `EditTransactionFlow.tsx` (fuera de `(app)/`, ruta hermana) |
| CONS-D05 | D5 calendario | mediano | **hecho, parcial** | `(app)/transactions/TransactionsMonthCalendar.tsx` — es una VISTA de `/transactions` (`?view=calendar`), no una ruta: elegir un día escribe `from`/`to` y angosta la lista que ya está, como plantea el diseño (`bloque-d`, `AppHeader` de Movimientos sin back). `calendar/page.tsx` quedó como redirect de compatibilidad. Deuda pendiente **invertida**: no hay que bajar la pantalla a `MonthCalendar` (LIB-04) sino SUBIR el componente de biblioteca al contrato de D5 — hoy LIB-04 usa `--ramp-1..7` discreto donde el diseño pide `color-mix` continuo, y no tiene anillo de "hoy", `aria-pressed`, `aria-label` con el monto, celdas cuadradas ni días futuros deshabilitados. Divergencia abierta: el diseño pide `SegmentedControl ['Lista','Calendario']` y quedó el chip toggle, porque con la lista visible debajo un segmentado que dice "Calendario" es engañoso |
| CONS-D06 | D6 estados | chico | **hecho** | Los 5 estados (vacío/carga/error/offline/con datos) ya aplicados vía `EmptyState`/`SkeletonRow`/`ErrorState`/`Banner` |
| CONS-D07 | D7 selección múltiple | mediano | **hecho** | Long-press activa selección en `(app)/transactions/page.tsx` |

### 6.6 Bloque B — Home (fase C11)

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-B01 | B1 home (3 variantes de flag) | grande | **hecho** | `(app)/page.tsx` — hero de patrimonio, cuentas, estado del mes, insight, últimos movimientos; single/multi-moneda vía `currencies.size > 1` |
| CONS-B02 | B2 | mediano | **hecho** | `EmptyState` cuando no hay cuentas/movimientos |
| CONS-B03 | B3 | mediano | **hecho** | `HomeSkeleton` |
| CONS-B04 | B4 | mediano | **hecho** | `Banner status="offline"` con conteo real de pendientes |
| CONS-B06 | B6 tab bar (usa CON-13) | mediano | **hecho** | `TabBar` en `(app)/layout.tsx`, 4to slot configurable (`useNavStore`) |
| CONS-B07 | B7 "Más" | mediano | **hecho** | `(app)/more/page.tsx` — módulos apagados no aparecen; K3 (configurar el 4to slot) queda como ítem propio en Bloque K, no se superpone: B7 es el índice, K3 es la preferencia |
| CONS-B08 | B8 búsqueda global | grande | **hecho** | `search/page.tsx` — cuentas, categorías, comercios, movimientos, con `SectionGroup` |

### 6.7 Bloque E — Cuentas (fase C12)

8 ítems (E3/E4/E5/E6 incluyen sub-vistas como estados del mismo flujo, no pantallas
independientes).

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-E01 | E1 lista de cuentas (usa `DragRow` LIB-13) | mediano | **hecho** | `(app)/accounts/page.tsx`, agrupada por moneda, con monograma (CON-29) y reorden real vía `DragRow` (persiste `sortOrder`). De paso: corregido un link roto a `/monedas` (la ruta real es `/currencies`) encontrado al escribir esto |
| CONS-E02 | E2 | mediano | **hecho** | `(app)/accounts/[id]/page.tsx` |
| CONS-E03 | E3 (+E3.1, E3.2) | mediano | **hecho** | `accounts/new`, `accounts/[id]/edit` — resuelto (§ 1.10, CON-29): monograma; resuelto (§ 1.11, CON-30): país sin bandera |
| CONS-E04 | E4 tarjeta de crédito (+E4.1, E4.2) | grande | pendiente | Bloqueado de verdad — requiere `card_statements`, que no existe en `01-arquitectura-datos.md` ni en las migraciones. No se puede escribir sin antes decidir ese schema (ver la lista de gaps de esquema abiertos) |
| CONS-E05 | E5 conciliación (+E5.1-E5.3) | grande | **hecho** | `accounts/[id]/reconcile/page.tsx` — los 3 pasos del diseño resueltos como una sola pantalla continua (pregunta → diferencia → ajuste), no 3 rutas separadas; crea el movimiento de ajuste con needs_fx si la cuenta no está en la moneda base |
| CONS-E06 | E6 monedas/FX (+E6.1-E6.4) | grande | **hecho, parcial** | `currencies/page.tsx` — E6.1/E6.2/E6.3 completos (lista de pares, editor de rate, override manual vía `fxRepo.setManualOverride`). Falta E6.4 (histórico de rates a lo largo del tiempo) — no hay UI para ver overrides pasados, solo el vigente |
| CONS-E07 | E7 | mediano | **hecho** | Los 5 estados ya cubiertos en `currencies/page.tsx` y `accounts/page.tsx` (`Skeleton`/`EmptyState`) |
| CONS-E08 | E8 resolver FX faltantes en lote (+E8.1, E8.2) | grande | **hecho** | `accounts/resolve-fx/page.tsx` — agrupa por moneda origen, `GroupCard` + `FxEditor` en un `Sheet`, aplica el rate a todos los movimientos del grupo y setea el override |

### 6.8 Bloque H — Análisis, parte 1 (fase C13)

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-H01 | H1 (gana `adenda-01-huecos-navegacion.html`, confirmado) | grande | **hecho** | `(app)/analytics/page.tsx` — `NeedsFxBanner`, hero de patrimonio + tasa de ahorro/gasto diario, lista "ya se puede ver"/"todavía no" con mínimos reales (`lib/analytics/history.ts`, `period-summary.ts`, con tests). No usa `StatTile size="compact"` porque solo tiene 2 tiles visibles, no 4 — no hace falta el cuarto nivel tipográfico que esa variante resuelve |
| CONS-H02 | H2 (Donut, LIB-06) | mediano | **hecho** | `analytics/categories/page.tsx` — composición del último período cerrado, 5 slots + "Otros" |
| CONS-H03 | H3 (StackedBar/DivergingBar, LIB-18) | mediano | **hecho, parcial** | `analytics/trends/page.tsx` — implementado con `BarChart` (gasto diario 14 días + delta semana vs. semana) en vez de `StackedBar`/`DivergingBar`: el diseño original no tenía series apiladas que mostrar acá, era una simplificación de alcance, no un error |
| CONS-H05 | H5 (Waterfall, LIB-07) | mediano | **hecho, parcial** | `analytics/net-worth/page.tsx` — implementado con `Sparkline` de tendencia real de 30 días (cashflow día a día) en vez de `Waterfall`: no hay tabla de snapshots de patrimonio para descomponer en deltas todavía, así que un waterfall real necesitaría inventar los componentes del cambio |
| CONS-H08 | H8 (CalendarHeatmap, LIB-05) | mediano | **hecho** | `analytics/calendar/page.tsx` — heatmap real de 90 días de gasto |
| CONS-H09 | H9 (RankingBar, LIB-09) | mediano | **hecho** | `analytics/merchants/page.tsx` — ranking real por comercio del último período cerrado |
| CONS-H14 | H14 | mediano | **hecho** | No es pantalla propia — es la matriz de estados/umbrales ya aplicada en H1 (`Skeleton`/`ErrorState`/`EmptyState`/mínimos por análisis) |

### 6.9 Bloques F+G — Presupuestos, metas, recurrentes, deudas (fase C14)

18 ítems incluido G6a (nuevo, no es una alt-versión).

**Decisión de schema tomada acá (bloqueaba todo el bloque):** `budgets`, `goals` y
`recurring_rules` no tenían tabla — CLAUDE.md los marcaba como huecos abiertos
(`budget_periods`, `goal_contributions`, `goal_accounts`). Resuelto con la migración
`20260801040000_budgets_goals_recurring.sql` (Postgres + RLS + Dexie v3 + repos + hooks),
con una simplificación deliberada: **sin tablas de estado derivado**. El gastado de un
presupuesto se calcula on-the-fly desde `transactions` en vez de persistir en
`budget_periods`; el progreso de una meta es el saldo de UNA cuenta vinculada
(`goals.account_id`) en vez de una tabla `goal_contributions`/`goal_accounts`. Menos
estado que reconciliar, mismo resultado para el usuario. `debts` no tiene tabla propia
todavía — ver CONS-G06 abajo, que sigue bloqueado de verdad.

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-F00 | F0 activación módulo presupuestos | chico | **hecho** | `(app)/budgets/page.tsx` chequea `enabled_modules`, redirige a Home si está apagado |
| CONS-F0m | F0m | chico | **hecho** | Mismo gate que F0 — es el mismo módulo |
| CONS-F01 | F1 | mediano | **hecho** | `(app)/budgets/page.tsx` — lista con `BudgetRing` por presupuesto, progreso real del período en curso |
| CONS-F02 | F2 (needs_fx: agregar `NeedsFxBanner`, hoy sin declarar) | mediano | **hecho** | `budgets/new/page.tsx` (creación) + `NeedsFxBanner` en la lista y el detalle, con conteo real de excluidos (`computeBudgetProgress`, con tests) |
| CONS-F03 | F3 | mediano | **hecho** | `budgets/[id]/page.tsx` — anillo grande, gastado/límite/restante. Excepción de jerarquía respetada, no tocada |
| CONS-F04 | F4 | mediano | **hecho, parcial** | `lib/analytics/budget-progress.ts` (`identifyBudgetAlerts`) + `hooks/use-budget-alerts.ts`, con insight en Home (`app/(app)/page.tsx`) y badge en la tab de presupuestos (`app/(app)/layout.tsx`) — las dos superficies que no dependen de infraestructura de envío. El push (K12) queda sin disparador automático a propósito, mismo criterio que K12: mandar un push cada vez que el cliente detecta el cruce del 80%/100% necesitaría trackear "ya se avisó este presupuesto este período" para no repetir en cada apertura, y es una decisión de producto que no se tomó sola |
| CONS-F05 | F5 | mediano | **hecho, simplificado** | `goals/page.tsx` + `goals/new/page.tsx` — progreso = saldo de la cuenta vinculada, no una tabla de aportes (ver la nota de schema arriba) |
| CONS-F06 | F6 | mediano | **hecho, simplificado** | `goals/[id]/page.tsx` — mismo enfoque que F5 |
| CONS-F07 | F7 | mediano | pendiente | No identificado un contenido propio distinto de F5/F6 sin volver a los prompts no-autoritativos — se retoma si aparece un requisito concreto |
| CONS-G0r | G0r activación recurrentes | chico | **hecho** | `(app)/recurring/page.tsx` chequea `enabled_modules` |
| CONS-G01 | G1 (MonthCalendar LIB-04) | grande | pendiente | El diseño original pedía un hero "comprometido por mes" que requiere que `recurring_rules` sea consultable en SQL agregado — ya lo es (tabla real, no un JSON opaco), pero la vista de calendario en sí no se armó todavía; `recurring/page.tsx` (G2) cubre la lista, que es el 80% del valor |
| CONS-G02 | G2 | mediano | **hecho** | `recurring/page.tsx` + `recurring/new/page.tsx` — plantilla real vinculada a `transactions.recurring_id`, declara si ya se cargó el mes en curso |
| CONS-G03 | G3 | mediano | pendiente | Detalle/edición de una regla existente — la creación (G2) está resuelta, falta editar/archivar una ya creada |
| CONS-G0d | G0d activación deudas | chico | **hecho** | `(app)/debts/page.tsx` chequea `enabled_modules` |
| CONS-G04 | G4 (needs_fx) | mediano | **hecho, parcial** | `debts/page.tsx` — vista de solo lectura sobre cuentas `loan`/`receivable`/`credit_card` con saldo pendiente, `NeedsFxBanner` para cuotas sin cotización. Reconciliación contra J7 (quién manda en el neto) sigue sin resolver — Bloque J todavía no existe |
| CONS-G05 | G5 | mediano | pendiente | Detalle de una deuda puntual con cronograma de cuotas — bloqueado por lo mismo que G6 |
| CONS-G06 | G6 | grande | pendiente | Bloqueado de verdad — requiere `debts.origin_transaction_id`/`installment_count`, decisión de schema todavía no tomada (a diferencia de budgets/goals/recurring, este necesita más pensarse: cómo un plan de cuotas se relaciona con las N transacciones que ya lo representan vía `installment_group_id`) |
| CONS-G06a | G6a selector de transacción con tarjeta | mediano | pendiente | Alimenta G6, mismo bloqueo |

### 6.10 Bloque J — Grupo familiar (fase C15)

11 ítems incluido J4b.

**Hueco de schema real encontrado y resuelto:** `household_members_insert` (§ 5.1,
`20260801030100`) solo permitía auto-insertarse — invitar a OTRA persona quedó
explícitamente anotado ahí como "se resuelve con su propia policy o una función
SECURITY DEFINER cuando se construya". Esa función es `accept_invite(invite_code)`
(`20260801050100_fix_duplicate_invites_table.sql`), SECURITY DEFINER porque quien acepta
todavía no es miembro. **Error propio durante esta migración, corregido en el momento:**
se creó una tabla `invites` nueva sin comprobar antes que ya existía `household_invites`
(`20260801010200_identity.sql`, con `code`/`accepted_by` en vez de `token`/`accepted_at`) —
exactamente el error de "un documento, una copia" de CLAUDE.md, aplicado a schema. La
migración `20260801050100` tira la duplicada y reescribe la función contra la tabla real.

`household_invites`/`household_members` de otro dispositivo no llegan a este Dexie local
sin un pull-sync que todavía no existe (BASE-05, Realtime diferido) — J1/J2/J3 leen esas
dos tablas directo de Supabase, no de Dexie, a propósito (ver el comentario en
`invites-repo.ts`/`household-members-remote.ts`): es la misma excepción de "lecturas que
necesitan Realtime" que ya anotaba `lib/supabase/client.ts`.

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-J01 | J1 | mediano | **hecho** | `(app)/family/page.tsx` — chequea `enabled_modules`, lista miembros + invitaciones pendientes |
| CONS-J02 | J2 (gana `adenda-01-huecos-navegacion.html`, verificado — CON-03) | grande | **hecho, simplificado** | Misma pantalla que J1 en este MVP (lista + fila a J8) — sin el detalle visual completo de la adenda |
| CONS-J03 | J3 | mediano | **hecho, parcial** | `family/invite/page.tsx` (generar) + `/join` (aceptar, ruta hermana fuera de `(app)/`). Sin envío de email real (necesita Edge Function + proveedor, ninguno existe) — código de 8 caracteres para compartir a mano; QR queda para después (mismo dato, solo cambia la presentación) |
| CONS-J04 | J4 (gana `bloque-j-familiar.html`, verificado — CON-03) | grande | **hecho** | `family/permissions/page.tsx` — private/household/custom por cuenta y categoría, con selector de miembros para "custom" (`visibility_grants` real) |
| CONS-J4b | J4b modo espejo | grande | **hecho** | `family/mirror/[memberId]/page.tsx` + `mirror_accounts`/`mirror_transactions` (SECURITY DEFINER, con `can_see_as()` parametrizado por `viewer_id` — nunca `auth.uid()` del que mira). **Corrección propia en el camino:** la primera versión devolvía `SETOF accounts/transactions` completo, dejando que PostgREST serialice `bigint` como `number` — reescrita (`20260801060100`) con `RETURNS TABLE` explícito y `::text` en cada bigint, mismo patrón que `/api/fx` |
| CONS-J05 | J5 (split 62/38, `transaction_shares.split_mode`/`share_pct`) | mediano | **hecho, parcial** | `transaction-shares-repo.ts` + `split-shares.ts` (con tests: reparto igual y por porcentaje, ambos exactos al centavo, el resto nunca se pierde). Solo el modo "partes iguales" tiene UI (`transactions/[id]/split`) — porcentaje/monto exacto necesitan un input por miembro que no se construyó; no se ofrece un selector que no hace nada distinto |
| CONS-J06 | J6 | mediano | **hecho** | Mismo `transactions/[id]/split/page.tsx` que J5 — reparto y "dividir" son la misma pantalla |
| CONS-J07 | J7 (needs_fx, **el más grave**: un gasto compartido en USD sin cotización cambia quién debe a quién) | grande | **hecho** | `family/settle/page.tsx` + `computeNetBalances()` (con 6 tests) — excluye shares sin `share_amount_base` del neto y declara el conteo excluido, nunca los cuenta como 0. Sigue sin resolver la contradicción de reconciliación contra G4 (quién manda en el patrimonio neto) — bloque I todavía no existía cuando se escribió esa nota |
| CONS-J08 | J8 (opt-in mutuo explícito, ComparisonBars LIB-14, fallback asimétrico) | mediano | **hecho, simplificado** | `family/compare/page.tsx` — comparación real por categoría del último período cerrado. Sin el opt-in mutuo explícito del diseño: no hay todavía un mecanismo de consenso dedicado, así que se apoya solo en lo que `visibility_grants` ya deja ver |
| CONS-J09 | J9 | mediano | **hecho** | `family/activity/page.tsx` — auditoría de altas/bajas de `visibility_grants`, quién se lo dio/sacó a quién y sobre qué |
| CONS-J10 | J10 (settlements method/status, `household_members.status`) | mediano | **hecho** | Botón de sacar miembro en `family/page.tsx`, con el chequeo de J10: si `computeNetBalances` da un neto distinto de 0 para ese miembro, bloquea y manda a `/family/settle` primero — nunca se saca a alguien con saldo pendiente. Sin flujo de invitación a re-unirse (fuera de alcance) |

### 6.11 Bloque I — Inversiones (fase C16)

13 ítems incluido I7b.

**El schema de este bloque ya existía por completo** (`portfolios`, `trades`,
`price_snapshots`, `target_allocations`, `portfolio_snapshots` — `20260801011010_investments.sql`)
salvo la semilla de `asset_classes`, que nunca se cargó. Se sembró (`20260801070000`),
y de paso un error propio: la primera semilla usó una lista corta en español
("Cripto", "Bonos", "Otro") en vez de la que `01-arquitectura-datos.md` § 2.8 ya prescribe
completa ("Acciones, CEDEARs, Bonos soberanos, ONs, Letras, FCI, Plazo fijo, **Crypto**,
ETFs, Inmuebles, Efectivo, Otros") — y `lib/money/decimals.ts` busca por el nombre exacto
"Crypto" para saber que una cripto necesita 8 decimales. Con "Cripto" ese lookup fallaba en
silencio. Corregido en `20260801070100_fix_asset_classes_seed.sql`.

**Decisión de arquitectura, deliberada:** este módulo NO pasa por Dexie/outbox como
accounts/transactions — lee y escribe directo contra Supabase (mismo patrón que
`invites-repo.ts`/`transaction-shares-repo.ts` del Bloque J). Justificación: cargar una
operación de inversión no tiene el objetivo de 5 segundos de un gasto, y construir la
infraestructura de sync local-first para 5 tablas más era desproporcionado para esta
primera versión. Si en algún momento hace falta cargar una operación sin conexión, `trades-repo.ts`/
`portfolios-repo.ts` son los que hay que migrar — anotado en el código.

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-I01 | I1 | mediano | **hecho** | `(app)/investments/page.tsx` — activación del módulo + creación del primer portfolio |
| CONS-I02 | I2 (gana `adenda-01-huecos-navegacion.html`, confirmado; needs_fx) | grande | **hecho** | Mismo archivo — `Donut` (LIB-06) de composición por clase de activo, valor total |
| CONS-I03 | I3 (needs_fx; objetivo duro: 8 posiciones heterogéneas legibles en 390px) | grande | **hecho** | `PositionRow` (LIB-02) por posición, con `PriceStatus` (LIB-01). Posiciones calculadas en vivo desde `trades` (`computePositions()`, con 5 tests: acumula compras, prorratea el costo base en una venta parcial, cierra una posición vendida del todo) |
| CONS-I04 | I4 | mediano | **hecho** | `investments/[portfolioId]/trades/new/page.tsx` |
| CONS-I05 | I5 | mediano | **hecho** | Mismo formulario — comisiones y fecha no se separaron a un paso 2 distinto en esta versión (un solo paso, cantidad+precio+cuenta) |
| CONS-I06 | I6 | mediano | **hecho** | Mismo formulario cubre compra y venta (`SegmentedControl`) |
| CONS-I07 | I7 | mediano | **hecho** | El picker de instrumento entra a I7b cuando no existe el que se busca |
| CONS-I07b | I7b crear instrumento a mano | mediano | **hecho** | `investments/[portfolioId]/instruments/new/page.tsx` — símbolo, nombre, clase de activo, moneda; siempre clonado al household, nunca escribe una fila global |
| CONS-I08 | I8 (DragRow LIB-13) | mediano | pendiente | Las posiciones son un agregado calculado de `trades`, no una lista con orden propio — no hay `sortOrder` que arrastrar sin inventar una tabla nueva. Se retoma si aparece un caso de uso real de reordenar |
| CONS-I09 | I9 (SplitBar sin paleta de datos — depende de CON-11) | mediano | **hecho** | `investments/allocation/page.tsx` |
| CONS-I10 | I10 (BenchmarkBars LIB-10, InfoCard LIB-12; requiere `benchmarks`/`benchmark_series`) | mediano | pendiente | Bloqueado de verdad — esas dos tablas no existen y no se inventan acá (mismo criterio que CLAUDE.md pide para gaps de schema no decididos) |
| CONS-I11 | I11 (needs_fx; requiere `instrument_cashflows`) | mediano | pendiente | Bloqueado de verdad — XIRR necesita esa tabla para los flujos de caja del instrumento |
| CONS-I12 | I12 | mediano | **hecho** | Los 5 estados ya cubiertos por los mismos patrones del resto de la app (`Skeleton`/`EmptyState`) en `investments/page.tsx` |

### 6.12 Bloque H — Análisis, parte 2 (fase C17)

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-H04 | H4 Sankey (LIB-08) | grande | **hecho** | `analytics/flow/page.tsx` + `lib/analytics/money-flow.ts`. Tres columnas ingresos→cuentas→destinos, top 5 categorías por lado + "otros" (igual que el resto de la app), `needs_fx` excluido y declarado por `NeedsFxBanner`. Gate: 1 período cerrado (`docs/00-producto.md` § "Cuánto historial") |
| CONS-H06 | H6 | mediano | **hecho** | `analytics/currencies/page.tsx` + `lib/analytics/currency-exposure.ts`: exposición por moneda (nativa y convertida a base), % de patrimonio, cuentas sin cotización excluidas y contadas. Resuelto (§ 1.11, CON-30): chip de código de moneda. El "impacto del tipo de cambio" del diseño (delta explicado por movimiento de FX) queda afuera: necesita snapshots históricos de cotización que no existen todavía |
| CONS-H07 | H7 (needs_fx; requiere `price_index` para "gasto en USD constantes") | mediano | pendiente | Corrige D03; sigue bloqueado, no hay migración de `price_index` |
| CONS-H10 | H10 | mediano | **hecho** | `analytics/insights/page.tsx` + `lib/analytics/insights.ts`: racha de días registrando + ritmo de presupuesto proyectado (fecha estimada de sobregiro si el ritmo actual se mantiene). Subconjunto del motor de `docs/00-producto.md` § "Insights automáticos": detección de suscripción nueva/aumento de precio queda afuera, necesita diffing de `recurring_rules` en el tiempo |
| CONS-H11 | H11 (needs_fx; hero-xl 64 — ver regla a declarar en CON-27 abajo) | mediano | **hecho** | `analytics/weekly/page.tsx` + `lib/analytics/weekly-summary.ts`: total de la semana, día más caro, comercio más visitado, categoría con mayor cambio vs. la semana anterior. `needs_fx` excluido y contado |
| CONS-H12 | H12 Wrapped (StoryFrame LIB-11) | grande | **hecho** | `analytics/wrapped/page.tsx` + `lib/analytics/wrapped.ts`. Gate real: **12 meses cerrados**, no los 6 que dice la anotación de `bloque-h-analisis.html` — `adenda-01-huecos-navegacion.html` lo corrige explícitamente ("deshabilitada hasta que haya 12 meses cerrados") y manda para la entrada desde H1 por `docs/design/INDEX.md`. Seis frames con datos reales (patrimonio, movimientos, comercio top, tasa de ahorro, días activos); "gastos hormiga" del diseño no se programó — necesita heurística de categorización que no existe, se reemplazó por días activos (dato real, no inventado) |
| CONS-H13 | H13 | mediano | **hecho** | `analytics/export/page.tsx`: exporta movimientos de un período (actual/anterior/hace 2 meses) a CSV, con cuentas y saldos opcionales. Formato único (CSV, no PDF) — el backup JSON completo multi-tabla es K10 (`/more/export`). `needs_fx` se exporta igual, con la columna de conversión vacía (regla explícita del diseño: "en el CSV el usuario manda") |

### 6.13 Bloque K — Ajustes (fase C18)

13 ítems (K3a/b/c y K9a/b/c son pasos de un mismo flujo, no líneas independientes de esta
tabla salvo K9 que sí requiere tres pantallas reales).

| ID | Pantalla | Tamaño | Estado | Notas |
|---|---|---|---|---|
| CONS-K01 | K1 (needs_fx en patrimonio) | mediano | pendiente | Corrige D03; no es una pantalla propia — `more/page.tsx` ya sirve de índice. El patrimonio con `needs_fx` vive en `analytics/net-worth` (Bloque H) |
| CONS-K02 | K2 | mediano | **hecho** | `more/profile/page.tsx` + `profiles-repo.ts` (direct-Supabase). `household_members.display_name` NO se sincroniza: no hay policy que deje a un `member` común escribir su propia fila (solo `owner`/`admin`) — documentado en el repo, requiere una policy nueva a futuro |
| CONS-K03 | K3 (a/b/c) — ver D34, se superpone con B7 | grande | **hecho** | `more/settings/page.tsx`: cuarto slot del tab bar (`useNavStore`, ya existía), día de cierre por household (solo owner/admin), moneda (link a `/currencies`, "tu moneda" vs "moneda base" según CON-30). K3c (color de marca personalizable) diferido: no hay mecanismo de theming por household |
| CONS-K04 | K4 | mediano | **hecho** | `more/modules/page.tsx`, de una fase anterior |
| CONS-K05 | K5 (DragRow LIB-13) | mediano | **hecho** | `more/categories/page.tsx` (de una fase anterior) cubre la plantilla, no el reordenamiento con `DragRow` — pendiente si se necesita reordenar categorías existentes, no solo elegir plantilla |
| CONS-K06 | K6 | mediano | **hecho** | `more/tags/page.tsx`: tags y comercios, crear/renombrar/borrar sobre `tags-repo.ts`/`payees-repo.ts` (local-first, ya existían del bloque de captura) |
| CONS-K07 | K7 | mediano | diferido | Reglas de auto-categorización necesitan un motor de reglas (`rules` table de `01-arquitectura-datos.md` existe en el schema pero no hay evaluación contra transacciones nuevas ni UI de condición/acción) — alcance de una fase propia, no una pantalla de ajustes suelta |
| CONS-K08 | K8 (override manual de FX — paso 1 de la cadena, usa `fx_overrides`) | mediano | **hecho** | Ya cubierto por `/currencies` (E6, `FxEditor` + `fxRepo.setManualOverride`); `more/settings/page.tsx` linkea a esa misma pantalla como K8 |
| CONS-K09 | K9 importador CSV (a: archivo, b: columnas con mapping reusable vía `import_batches`, c: duplicados) | grande | diferido | Wizard de 3 pantallas con parseo de archivo, mapping de columnas persistido por banco y detección de duplicados — no programado esta pasada; `import_batches` está en el schema pero sin migración pusheada |
| CONS-K10 | K10 | mediano | **hecho** | `more/export/page.tsx` + `lib/export/export-household.ts`: backup JSON completo de lo local-first (Dexie), con conteo real por tabla. No incluye lo que vive solo en Supabase (invites, shares, settlements, inversiones) — declarado en pantalla. Sin reimportación (depende de K9) ni backup automático programado (necesita infra de scheduling que no existe) |
| CONS-K11 | K11 | mediano | **hecho** | `more/security/page.tsx`, de una fase anterior |
| CONS-K12 | K12 (push subscriptions, `notification_preferences`) | mediano | **hecho, parcial** | `more/notifications/page.tsx`: preferencias por tipo + suscripción de push real (VAPID, `lib/push/subscribe.ts`), con `push` / `notificationclick` en `sw.ts`. Backend de envío: `supabase/functions/send-push` escrito y **desplegado** con secrets VAPID configurados. Deliberadamente sin disparador automático (cron/trigger que decida cuándo se envía cada tipo) — encender un envío recurrente es una decisión de producto (frecuencia, qué evento dispara cada notificación) que no se tomó sola esta pasada; alguien tiene que invocar la función a mano o decidir el cron |
| CONS-K13 | K13 licencia/acerca de | chico | **hecho** | `more/about/page.tsx`. Licencia MIT (§ 1.5, decidido) — se muestra directo, no "se está definiendo" como en el diseño original |

### 6.14 Cierre de fases

| ID | Fase | Qué | Tamaño | Estado | Notas |
|---|---|---|---|---|---|
| CONS-DESK | C19 | Desktop: sidebar, layout de dos columnas, command palette | grande | **hecho, parcial** | Contradicción real entre `docs/02-design-system.md` (§ Desktop: "dos columnas lista+detalle") y el código de `(app)/layout.tsx`, que traía un comentario propio diciendo "nunca multi-columna" — se preguntó y el usuario eligió el tratamiento completo de dos columnas, así que el comentario viejo queda invalidado. `Sidebar` ya existía. Se agregó: `CommandPalette` (⌘K/Ctrl+K, `cmdk`, ya era dependencia sin usar) con navegación rápida + búsqueda liviana de cuentas/movimientos; `useIsDesktop()` (breakpoint 1024px, `useSyncExternalStore` sobre `matchMedia`); y el patrón de dos columnas con ruta interceptora (mismo mecanismo que `@modal/(.)add`) aplicado a **Movimientos** (`transactions/layout.tsx` + `@detail`) y **Cuentas** (`accounts/layout.tsx` + `@detail`) — en desktop el detalle aparece al lado de la lista, en mobile el mismo contenido se dibuja como overlay de pantalla completa. **No se retocó Metas/Presupuestos/Recurrentes/Deudas/Familia/Inversiones** — mismo patrón, mecánicamente repetible (layout.tsx + `@detail/default.tsx` + `@detail/(.)[id]/page.tsx` reusando el componente de detalle existente), pero no se aplicó a los ~6 pares de lista/detalle restantes por tiempo. Queda como trabajo de seguimiento explícito, no un olvido |
| CONS-I18N | C20 | i18n completo (ES/EN/PT), accesibilidad (axe-core, VoiceOver/TalkBack, 200% texto), performance (Lighthouse ≥90, N+1, bundle de módulos apagados) | grande | **hecho, parcial** | **i18n:** script de paridad de claves entre `es.json`/`en.json`/`pt.json` — **889 claves en cada uno, 0 faltantes en cualquier dirección**. `react/jsx-no-literals` corrido sobre todo `src/**` (fuera de `dev/`): 0 errores, confirma cero strings hardcodeadas en JSX en toda la app, no solo en lo tocado esta pasada. **Accesibilidad:** auditoría dirigida (agente `Explore`) de botones que solo llevan ícono sin `aria-label` en toda la app — encontró y corrigió 1 caso real (`VoiceCaptureSheet.tsx`, botón de empezar a escuchar). El resto de los ~30 botones-solo-ícono revisados ya tenían `aria-label` correcto. **No verificado**: axe-core real, VoiceOver/TalkBack con dispositivo físico, zoom de texto al 200% — necesitan un navegador real, no disponible en este entorno. **Performance:** confirmado que ningún módulo apagado llega al cliente sin querer — la app entera navega con `router.push()` imperativo, **`next/link` no se usa en ningún lado**, así que Next nunca hace prefetch automático de una ruta de módulo apagado; el code-splitting por ruta de App Router ya hace el trabajo que pedía la regla, sin necesitar `dynamic()` explícito. Revisados los `Promise.all(...map(...))` del repo: todos sobre colecciones chicas y acotadas (reordenar categorías/cuentas propias, planes de cuotas de una tarjeta), ningún N+1 real. Corregido un `toFixed(2)` sobre plata encontrado en el propio trabajo de esta pasada (`more/import/page.tsx`, K9c) — pasa ahora por `formatAmountCompact`. **No verificado**: Lighthouse real (necesita Chrome headless, no disponible acá) |
| CONS-OSS | C21 | README, self-host docs, docker-compose, `.env.example`, CONTRIBUTING, licencia (MIT), seeds | mediano | **hecho** | `LICENSE` (MIT, + `"license": "MIT"` en `package.json`), `README.md` reescrito de cero (el viejo describía el paquete de diseño, no la app construida), `docs/self-hosting.md`, `CONTRIBUTING.md`, `.env.example` (con todas las env vars reales que usa el código, incluida `NEXT_PUBLIC_VAPID_PUBLIC_KEY` agregada a `src/env.ts`), `Dockerfile` + `docker-compose.yml`. El Dockerfile **no usa `output: standalone`** a propósito — el service worker de `@serwist/turbopack` lo compila esbuild en runtime leyendo `src/app/sw.ts` de disco, así que necesita el árbol completo, no lo que el tracer de standalone copiaría — y **no se pudo probar contra un build real** (sin Docker en este entorno, mismo motivo que documenta `CLAUDE.md`). Seeds (`lib/seed/demo-household.ts`) revisados: sin nombres/emails/datos personales, solo nombres de comercios reales uruguayos para realismo (no es dato personal) |
| CONS-CQ | CQ | Auditoría final: seguridad (RLS, secretos, rate limiting), dinero (grep de `number`/`parseFloat`/`toFixed`), performance, offline (50 mutaciones, conflicto real), accesibilidad, open source (README ejecutable por un extraño, sin datos personales en seeds, sin hardcode AR/UY) | grande | **hecho, parcial** | **Hallazgo real, corregido:** `client_rev` se guardaba y se mandaba a Supabase pero **nada lo comparaba nunca** — dos ediciones offline del mismo movimiento se resolvían con "el último que sincroniza gana", en silencio, exactamente lo que la app promete que no pasa. Corregido de punta a punta: `TransactionRow.syncState`/`syncError` (schema + Dexie `version(5)`), `conflictSensitive` en `sync-config.ts` (marcado solo en `transactions`, la única tabla con edición multi-miembro real hoy), detección real en `sync-worker.ts` (`detectRevisionConflict`, con test unitario y con test de integración contra un doble de Supabase que simula el conflicto de punta a punta), tabla local `conflicts` para no perder ninguna versión, `conflicts-repo.ts` + `more/conflicts/page.tsx` para resolver (quedarme con la mía / quedarme con la del servidor). **Seguridad:** sin `service_role` en el bundle del cliente (confirmado por grep — solo aparece en comentarios y en la Edge Function), sin secretos en archivos versionados (`.env.local` confirmado ignorado por git, la clave privada VAPID no aparece en ningún archivo trackeado), RLS de las tablas nuevas de esta pasada revisado a mano (`USING`+`WITH CHECK` pareados, `account_id`/`household_id` inmutables donde corresponde). **Rate limiting:** no verificado — necesita infraestructura de servidor (Vercel/Supabase) que no se configura desde este repo. **Dinero:** grep completo de `toFixed`/`Number(...)` sobre toda la app — el único uso real sobre plata (`more/import/page.tsx`, ya corregido en C20) y todo lo demás son porcentajes/ratios/coordenadas de gráfico, dominio legítimamente `number` según la propia regla del proyecto. **Accesibilidad:** ver C20 (1 botón sin `aria-label` corregido). **Performance:** ver C20 (sin `next/link`, sin prefetch de módulos apagados, sin N+1 real). **Offline — 50 mutaciones reales**: no simulado en este entorno (necesitaría dos clientes reales sincronizando contra el proyecto de Supabase en simultáneo); sí quedó una suite de tests de integración del drenado del outbox (`sync-worker.test.ts`, 8 casos) que cubre inserts/updates/deletes, traducción de tipos, aislamiento de errores, y ahora también el conflicto real. **Open source:** ver C21 |

---

## 7. Regla de lint pendiente (mitigación del presupuesto de ruido)

El contrato pide una regla de lint que cuente usos de `--primary-fill` por archivo de
pantalla, y que `StatTile size="compact"` exista antes de escribir H1. Esto es
infraestructura de CI, no una pantalla — lo agrego como ítem propio porque si no se
escribe antes de C11 (bloque B, que ya usa 2 violetas en H1a/J2 por identidad de dato),
nadie lo va a notar hasta la auditoría final.

| ID | Qué | Fase | Tamaño | Estado |
|---|---|---|---|---|
| CON-27 | Regla de lint: contar usos de `--primary-fill` por archivo de pantalla, advertir sobre 1 salvo excepciones declaradas (Switch on, ScopeSwitcher/SegmentedControl de identidad, UndoToast) | C4/C6 | mediano | **hecho** |
| CON-28 | Declarar por escrito las 3 reglas no escritas de la auditoría: cuándo `hero-xl` 64 vs `hero` 40 (hoy en J7/H11/H12 sin regla); `critical` (estado) vs. naranja de polaridad (rendimiento negativo); cuándo se repite `$` en una lista | C4 | chico | **hecho** |

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
