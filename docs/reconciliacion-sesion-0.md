# Sesión 0 — Reporte de reconciliación

## Contexto

`docs/07-handoff-a-claude-code.md` § 6 pide correr una sesión de reconciliación **antes** del
primer prompt de `05-prompts-desarrollo.md`: cruzar diseño, prompts, contrato de componentes y
schema para encontrar las contradicciones mientras todavía valen una tarde y no una migración.

El paso 1 del handoff —llevar el diseño al repo— ya está hecho: `docs/design/` tiene los once
bloques, `docs/library/perze-v2.jsx` y `docs/marca/` existen (sin commitear todavía).

Este documento es la entrega del reporte. **No propone escribir código.** Es el inventario de
contradicciones, las decisiones ya tomadas y las que faltan antes de la primera migración.

> [!NOTE]
> El bloque K se corrigió durante esta sesión: `bloque-k-ajustes.html` pasó de 17 KB a 108 KB y
> ahora tiene K1–K13 completas. El hallazgo original sobre K queda anulado y está registrado en
> § 1.2 como resuelto.

---

## Resumen ejecutivo

Cuatro hallazgos abiertos. Tres decisiones ya tomadas al pie, en § 5.3.

1. **El contrato de componentes cubre la mitad de la biblioteca.** Documenta el delta v2 (27
   piezas). Las pantallas usan **34 componentes** y **20 no tienen ficha**, incluidos `Button`,
   `AppHeader`, `Amount` e `Icon`. Cuatro no se mencionan en ninguna parte. Y `perze-v2.jsx`
   importa un `./core` que no está en el repo.
2. **El modo espejo y la visibilidad por miembro no están modelados.** `accounts.visibility` es
   binario y `categories` no tiene columna de visibilidad. J4 dibuja visibilidad por persona y
   por categoría. La política RLS de ejemplo no puede expresarlo.
3. **`trades` viola la regla de `needs_fx` desde la primera fila.** Tiene `fx_rate` y
   `amount_base` pero **no tiene `fx_source` ni el `CHECK` pareado** que sí tiene `transactions`.
4. **El schema declara cinco índices, todos sobre `transactions`.** Ninguna otra tabla tiene
   índice — ni siquiera las FK que § 3 dice que son obligatorias para que RLS no escanee entero.

La conclusión operativa del handoff **se sostiene**: C1, C2, C3 y C5 no están bloqueadas por la
auditoría visual. Pero C2 sigue bloqueada por cinco decisiones de producto (§ 5.1).

---

## 1 · Inventario de vistas: diseño contra prompts

Fuente canónica: `docs/design/Mapa-del-sistema.dc.html` (103 IDs). Verificado bloque por bloque
contra los once `bloque-*.html`.

### 1.1 Conteo

| Bloque | Prometen 03 y 04 | Diseñadas | Parciales | Ausentes | Extra sin prompt |
|--------|-----------------:|----------:|----------:|---------:|-----------------:|
| A      | 11 | 11 | 0 | 0 | 0 |
| B      | 8  | 7  | 1 | 0 | 0 |
| C      | 11 | 10 | 1 | 0 | 0 |
| D      | 7  | 7  | 0 | 0 | 0 |
| E      | 7  | 8  | 0 | 0 | 1 |
| F      | 7  | 7  | 0 | 0 | 2 |
| G      | 6  | 6  | 0 | 0 | 2 |
| H      | 14 | 14 | 0 | 0 | 0 |
| I      | 12 | 12 | 0 | 0 | 0 |
| J      | 10 | 10 | 0 | 0 | 0 |
| K      | 13 | 13 | 0 | 0 | 0 |
| L      | 6  | 6  | 0 | 0 | 0 |
| Total  | 102 | 111 | 2 | 0 | 5 |

**Cero pantallas prometidas sin diseñar.** El inventario cierra.

### 1.2 Bloque K — resuelto en esta sesión

`bloque-k-ajustes.html` tenía comentarios `<!--SLOT-K3-->` literales y solo K1 y K2 dibujadas.
Ya está completo: K1–K13, con K9 partido en `K9a · Archivo`, `K9b · Columnas` y
`K9c · Duplicados`, más sus estados de archivo ilegible, importando y vacío. Eso **cierra D05a**
de la auditoría, que era uno de los diez flujos críticos.

Pendiente menor de limpieza: quedaron siete comentarios `<!--SLOT-*-->` vestigiales en las líneas
850–856 del archivo. No afectan al render pero conviene borrarlos para que nadie los lea como
pantallas faltantes.

### 1.3 Lo que sigue sin diseñar

Los otros tres puntos de D05 siguen abiertos. Verificado: `bloque-i-inversiones.html`,
`bloque-j-familiar.html` y `bloque-fg-presupuestos.html` no se tocaron.

| Falta | Evidencia |
|-------|-----------|
| Selector de transacción con tarjeta que alimenta **G6** | G6 arranca con "Compra de origen" ya elegida; el paso del medio no existe en D ni en G |
| Formulario de crear instrumento a mano de **I7** | "Crear a mano" aparece como botón; el formulario de cuatro campos no está dibujado |
| Modo espejo de **J4** | "Ver la app como Ana" y `MirrorBanner` se nombran; la vista no existe |

Más las cinco vistas huérfanas de D06a (I9, I10, I11, H12, J8), sin verificar en esta sesión.

### 1.4 Parciales, declaradas

- **B5 · ScopeSwitcher abierto** — reclasificada a "estados de B1". Decisión escrita en el
  archivo, no omisión.
- **C10 · Foto de ticket** — solo punto de entrada y flujo previsto; el mapa ya lo etiquetaba
  "fase futura".

### 1.5 Huérfanas de prompt — diseñadas y sin prompt

- **E8 · Resolver FX faltantes en lote** (E8.1, E8.2). Está en el mapa maestro y no en 03 ni 04.
  Es la única vista canónica que los dos prompts no mencionan, y resuelve el paso 1 de la cadena
  de FX. Hay que agregarla al inventario oficial.
- **F0, F0m, G0r, G0d** — las cuatro pantallas de activación de módulo. El 04 las cubre con la
  frase genérica "más la pantalla de activación de cada módulo", sin ID.

### 1.6 Nota sobre el bloque A

El handoff dice que A "terminó con ocho pantallas". Es impreciso: A entregó **once**. Lo que se
recortó a ocho es el **camino crítico** (A2→A3→A4→A5→A6→A7→A11→C1). A1, A8, A9 y A10 están
diseñadas completas en la sección "Diseñadas, pero no en el medio". Conviene corregir la frase en
`CLAUDE.md` porque hoy induce a no programarlas.

Además **L6 (bloqueo por PIN) vive en `bloque-a-onboarding.html`**, no en el archivo del bloque L.

---

## 2 · Contrato de componentes contra uso real

Extracción del uso real con el patrón de instanciación del sistema de diseño:

```bash
grep -ohE 'APPFinanzasDesignSystem_3bc1d9\.[A-Za-z0-9_]+' docs/design/*.html \
  | sed 's/.*\.//' | sort | uniq -c | sort -rn
```

**34 componentes distintos.** Los cinco más usados: `ListRow`, `Button`, `AppHeader`, `Amount`,
`Icon`. El K nuevo no incorpora ningún componente que no estuviera ya en el censo.

### 2.1 El problema estructural

`docs/contrato-componentes.md` documenta **solo el delta v2**. `docs/library/perze-v2.jsx` tiene
27 exports y su línea 12 dice:

```jsx
import { Icon, Button, Chip, Card, Switch } from './core'
```

**`./core` no está en el repo.** `docs/library/` contiene un solo archivo. Entonces la
instrucción de `CLAUDE.md` —"la implementación de referencia está en `perze-v2.jsx`: portala, no
la reescribas"— cubre menos de la mitad de lo que las pantallas usan.

### 2.2 Huérfanos de contrato (20)

Usados por las pantallas, sin ficha en el contrato:

`Button` · `AppHeader` · `Amount` · `Icon` · `Chip` · `Card` · `SegmentedControl` ·
`SkeletonRow` · `Switch` · `Input` · `CurrencyChip` · `Sparkline` · `CategoryBubble` ·
`InsightCard` · `SyncDot` · `SeriesLegend` · `BarChart` · `DateStrip` · `FxEditor` ·
`AmountScrubber`

**Cuatro no se mencionan en ninguna parte del contrato**: `FxEditor`, `AmountScrubber`,
`CategoryBubble`, `DateStrip`. `FxEditor` es el más grave — en `bloque-c-captura.html` se lo
instancia con `source="DolarApi · oficial" age-hours="6" stale="{{ yes }}"`, exactamente el
territorio que el contrato asigna a `Rate` y a `[spec] PriceStatus`, sin decir cómo se relacionan.

`Sparkline` es un caso aparte: el contrato lo declara placeholder a reemplazar por `LineChart`,
pero el diseño lo usa 9 veces y nadie decidió si se porta o se migra.

### 2.3 Las 29 piezas `[spec]`

**Cero de 29 existen en `perze-v2.jsx`.** Confirmado. El handoff acierta en que las cuatro
primeras son `SkeletonBlock`, `PriceStatus`, `PositionRow` y `NeedsFxBanner`.

La pieza 29 (`--ramp-1..7` en `charts.css`) tampoco existe:

```bash
$ grep -oE '\-\-(ramp|data)-[a-z0-9-]+' docs/design/_ds/*/tokens/charts.css | sort -u
--data-1 --data-2 --data-3 --data-4 --data-5
--data-blue-dark --data-blue-light --data-magenta-dark --data-magenta-light --data-other
```

### 2.4 Verificaciones puntuales

| Verificación | Resultado |
|--------------|-----------|
| `ScopeSwitcher` eliminado sin alias | **No.** El contrato lo elimina y `perze-v2.jsx` no lo tiene, pero `_ds_bundle.js` lo implementa como alias literal de `SegmentedControl`. Ninguna pantalla lo instancia. Queda residuo en prosa de `bloque-j-familiar.html`. |
| `Keypad` / `PinKeypad` separados | **Sí.** Dos artefactos distintos, sin prop `variant`. A `Keypad` del bundle le faltan `operators` y `decimalSeparator` que el contrato exige. |
| `StatTile size="compact"` | **No existe.** Sin prop `size`; valor hardcodeado a 30 px. H1 ya usa 6 `StatTile` sin la variante. |
| `EmptyState` con `ZMark` | **No.** Usa `Icon` con `strokeWidth: 1.25`, default `'wallet'`. `ZMark` existe en el JSX pero `EmptyState` no lo consume. Confirma D01. |
| `SplitBar` con paleta de datos | **Sí la usa.** `SLOTS = ['var(--data-1)'…'var(--data-5)']`. Confirma D04. Además no dibuja tirador y pasa `height` crudo a CSS. |
| `NeedsFxBanner` · `MirrorBanner` | Solo como spec en prosa. Cero código, cero diseño. El par "badge neutro + chip Resolver" está copiado a mano en diez pantallas. |

### 2.5 Alcance real de C6

- **31 componentes a portar** desde el bundle (no desde `perze-v2.jsx`, que no los tiene).
- De esos, **11 no son puerto limpio**: el contrato pide cambiarlos al portarlos (`Skeleton`,
  `TabBar`, `TransactionRow`, `AccountCarousel`, `ErrorState`, `UndoToast`, `OfflineBanner`,
  `EmptyState`, `SplitBar`, `StatTile`, `Keypad`).
- **4 hay que especificar antes de escribir** (los sin contrato de § 2.2).
- **23 piezas `[spec]` nuevas** desde cero.

---

## 3 · Schema contra lo que las pantallas muestran

### 3.1 Violaciones de reglas cerradas dentro de `01-arquitectura-datos.md`

Lo que está **bien**, para que no quede duda: cero `char(3)` para moneda; cero campo `perfil`;
`enabled_modules` con los seis exactos; `transactions` con `fx_rate` NULL protegido por
`CONSTRAINT fx_pair CHECK ((fx_rate IS NULL) = (amount_base IS NULL))` e índice parcial.

| # | Dónde | Problema |
|---|-------|----------|
| V1 | `trades`, línea 432 | `fx_rate numeric(24,12), amount_base bigint` **sin `fx_source`, sin NULL declarado y sin el `CHECK` pareado.** Una operación en USD sin cotización o se guarda con rate inventado o no se guarda: las dos salidas que la regla prohíbe. **La violación más seria.** |
| V2 | `transaction_splits`, `transaction_shares` | `amount_base` y `share_amount_base` sin el `CHECK` pareado. J7 depende de `share_amount_base`. |
| V3 | `settlements` | Sin `fx_rate` ni `amount_base`. Una liquidación en moneda distinta de la base no es agregable ni excluible. |
| V4 | `households.enabled_modules` | `text[]` sin `CHECK`. La lista canónica vive solo en un comentario SQL. |
| V5 | `interest_rate`/`coupon_rate numeric(8,4)` | Contra la convención "rates: `numeric(24,12)`". Probablemente intencional (son tasas anuales, no de cambio) pero no está escrita la excepción. |
| V6 | `instruments.ratio numeric(12,6)` | Contra "cantidades y precios: `numeric(38,12)`". |
| V7 | § 3 | Solo hay Patrón A (raíz) y Patrón B (hija). **Ningún patrón cubre las filas de catálogo global** (`institutions`, `instruments`, `asset_classes` con `household_id IS NULL`), y sin embargo I7 crea instrumentos e I8 borra clases. |
| V8 | § 3, líneas 572 vs. 581 | "`DELETE` no se expone" contra `CREATE POLICY splits_all … FOR ALL`. Y `transaction_splits` no tiene `deleted_at`. |
| V9 | § 2.5 vs. E1/K1 | **El patrimonio no reconcilia.** La tabla de consecuencias dice que el saldo de la cuenta no se afecta pero el patrimonio excluye los pendientes. E1 y K1 construyen el patrimonio sumando `accounts.current_balance`, que ya los incluye. |

### 3.2 El hueco grande: visibilidad por miembro

J4 muestra, por cada **cuenta** y cada **categoría**, si un miembro concreto la ve. J2 lo resume
("3 de 5 cuentas · 12 de 18 categorías"), J3 lo preconfigura y J9 lo audita.

Contra el schema:

- `accounts.visibility CHECK IN ('private','household')` — binario y no por miembro.
- **`categories` no tiene ninguna columna de visibilidad.**
- La política `tx_select` solo sabe expresar `visibility='household' OR created_by = uid`.
  No puede decir "Ana sí, Sofía no", que es lo que J4 dibuja con tres miembros en pantalla.

El modo espejo (leer como otro miembro) tampoco tiene mecanismo: `current_households()` no lo
contempla. La auditoría lo marcó como no diseñado (D05d); además **no está modelado**.

### 3.3 Tablas nuevas que hay que aprobar o descartar

| Tabla | La exige |
|-------|----------|
| `visibility_grants` | J4, J2, J3, J9 |
| `goal_contributions` | F6 (serie de aportes), F5 (ritmo de 6 meses) |
| `goal_accounts` (reemplaza `linked_account_ids uuid[]`) | F5, F6 sin N+1 |
| `budget_periods` | F2 presupuesto vs. real, rollover histórico, F1 "sin asignar" |
| `notification_preferences` + push subscriptions | F4, H11, K12 |
| `price_index` | H7 completa, "gasto en USD constantes" |
| `benchmarks` + `benchmark_series` | I10 "Elegir benchmarks" |
| `instrument_cashflows` | I11 (hoy se expande `amortization_schedule jsonb` en código) |
| `card_statements` | E4.1 (ciclo, cierre, "Pagar la tarjeta") |
| `household_currencies` | E6.1 "Agregar una moneda", "Pares en uso" |
| `import_batches` con mapeo reutilizable | K9b, que guarda el mapeo de columnas |
| Vistas `positions` y `fx_latest` | I2, I3, I12, E1 — sin ellas todo es N+1 |

### 3.4 Campos faltantes de mayor impacto

- **Estado de sincronización.** D2 filtra por "Sin sincronizar" **dentro de la lista servida** y
  L3 lo escala a warning a los 7 días. Hoy el outbox vive solo en Dexie. Y **"Rechazado"** (C11c)
  no tiene lugar en ningún modelo.
- **Edad del precio.** `price_snapshots` tiene `as_of date`: con granularidad de día es imposible
  expresar "hace 26 horas", "hoy 09:41" o "viernes 17:00", que es lo que I12 muestra.
- **Override manual de FX.** `household_fx_preferences` solo tiene proveedor y tipo de cotización.
  **El paso 1 de la cadena de resolución no tiene dónde guardarse.** E6.3 y K8 no son
  implementables hoy.
- **Reparto de gastos.** Falta `transaction_shares.split_mode` y `share_pct` (J5 muestra "62 y
  38"), `settlements.method` y el estado `forgiven` (J7 y J10), y
  `household_members.status('active','invited','former')`.
- **Cuotas.** Falta `debts.origin_transaction_id` (G6 arranca de una compra concreta) e
  `installment_count`.
- **Recurrentes.** El monto vive dentro de `recurring_rules.template jsonb`: el hero de G1
  ("Comprometido por mes $7.940") no es sumable en SQL.

### 3.5 Índices

`01-arquitectura-datos.md` declara **cinco índices, todos sobre `transactions`**. Ninguna otra
tabla tiene índice declarado — ni siquiera las FK que § 3 dice que son obligatorias para que RLS
no escanee entero. El más obvio de los faltantes:
`transactions(household_id, payee_id, occurred_at DESC)`, del que dependen H9, B8 y K6.

---

## 4 · Contradicciones que el orden de autoridad no resuelve

1. **El alcance de la propia auditoría ya no aplica.** `auditoria-visual.md` § "Alcance" dice que
   A, B, C, D, E y K3–K13 se auditaron *"por contrato, no por píxel"* porque desde ese proyecto no
   se abrían los archivos. **Ahora sí se abren, y K está rediseñado entero.** Los defectos
   marcados `[cruzado]` (D12, D34, D41, D47) están sin verificar contra el diseño real.

2. **La auditoría se contradice en el conteo.** Línea 16 dice "Total de defectos: **41**"; el
   cierre habla de "los **49** puntos sueltos" y `CLAUDE.md` dice 49. Los IDs van D01–D49 pero
   cinco son "Cumple" (D37, D38, D39, D49 y parte de D41). El número correcto parece 41.

3. **La auditoría dice "siete vistas huérfanas" y lista cinco.** Línea 54 contra línea 57 y D06a
   (I9, I10, I11, H12, J8). `CLAUDE.md` copió el cinco. Faltan dos o sobra la palabra.

4. **Dos fuentes para el mismo número de deuda.** G4 "Me deben $12.400" sale de
   `debts(direction='owed')` y J7 del neto de `transaction_shares`. Nada dice cuál manda.

5. **Doble lugar para configurar lo mismo** (es D34). B7 "Activar más funciones" y K3/K4. Ahora
   que K está diseñado, se puede resolver mirando las dos pantallas.

---

## 5 · Decisiones

### 5.1 Bloqueantes de C2 — sin esto no se escribe la primera migración

1. **Modelo de visibilidad por miembro.** ¿Tabla `visibility_grants` o `accounts.shared_with
   uuid[]`? Define la forma de `accounts`, de `categories` y de la política `tx_select` entera.
2. **RLS de las filas de catálogo global.** ¿Lectura para todos y escritura solo por seeds? ¿Se
   clona al household al editarla, dado que I8 permite renombrar y borrar?
3. **`fx_source` en `trades`** más el `CHECK` pareado. Sin esto, inversiones nace violando la
   regla de `needs_fx`.
4. **Estado de sincronización**: ¿columna en `transactions` o solo Dexie? Y dónde vive
   "Rechazado".
5. **Override manual de FX con vigencia** en `household_fx_preferences`.
6. **Clasificación raíz/hija de las doce tablas sin clasificar** — determina sus columnas de
   auditoría.

### 5.2 Decisiones de alcance

1. **Las tres pantallas de § 1.3** (selector de G6, alta manual de I7, modo espejo de J4) más las
   cinco vistas huérfanas. Es lo único que vuelve a Claude Design.
2. **¿Se re-corre la auditoría visual sobre A–E y sobre el K nuevo?** Nunca se miraron a píxel.
3. **Las tres decisiones abiertas de `CLAUDE.md`** siguen abiertas: arranque sin conexión, orden
   de A2, licencia.

### 5.3 Decisiones tomadas en esta sesión

| Decisión | Resolución | Qué hay que cambiar |
|----------|-----------|---------------------|
| Formato del banner de `needs_fx` | **Conteo solo, sin monto.** Un movimiento sin rate no tiene `amount_base`; sumar montos de tres monedas distintas da un número sin significado, como ya argumenta E8.1 en pantalla. | Sacar `amount: number` del `[spec] 4` del contrato. Corregir H1a, H5 y H7, que hoy muestran "3 sin cotización · $ 4.180 afuera". E8, F1 y F5 ya lo hacen bien. |
| Día de cierre del mes | **Por household.** `households.period_start_day` se queda donde está. Un solo período para todo el grupo: presupuestos compartidos, J2 y J7 cierran juntos sin reconciliar dos calendarios. | Corregir `CLAUDE.md`, que dice "configurable por usuario". No se toca el schema. |
| Bloque K | **Diseñado.** K1–K13 completas, K9 incluida. | Actualizar la lista de pantallas faltantes de `CLAUDE.md` y de `07-handoff` § 2 (D05a queda cerrado). Borrar los `<!--SLOT-*-->` vestigiales. |

---

## 6 · Correcciones a `CLAUDE.md`

Para aplicar cuando arranque C1:

- **"Faltan cuatro pantallas"** → faltan **tres**: el selector de transacción de G6, el alta
  manual de instrumento de I7 y el modo espejo de J4. **K9 ya está diseñada.**
- **"El día de cierre del mes es configurable"** → **por household**, no por usuario.
- **"El bloque A figura con once pantallas y terminó con ocho"** → terminó con once; ocho es el
  camino crítico.
- **"`docs/contrato-componentes.md` es la fuente de verdad de la biblioteca"** → lo es del delta
  v2. Hay 20 componentes en uso sin ficha y `perze-v2.jsx` importa un `./core` que no existe.
- **"`ScopeSwitcher` está eliminado, sin alias"** → cierto en contrato y en JSX; el bundle del
  diseño todavía lo exporta. El Gate 3 hay que evaluarlo contra el código de la app, no contra el
  bundle.
- **`NeedsFxBanner` es conteo, nunca monto.** Agregarlo a la sección de reglas de corrección,
  porque es exactamente el tipo de regla que se rompe en silencio.
- **Agregar E8** al inventario de vistas y a la cadena de resolución de FX.
- **Agregar** que L6 vive en `bloque-a-onboarding.html`, no en el archivo del bloque L.
- **Sumar las violaciones de schema V1–V9** a la sección de reglas de corrección.
- **Corregir el conteo de defectos de la auditoría** (41, no 49) y el de vistas huérfanas.

---

## 7 · Verificación

Todo lo afirmado acá es verificable sin ejecutar la app:

```bash
# Censo real de componentes usados por el diseño
grep -ohE 'APPFinanzasDesignSystem_3bc1d9\.[A-Za-z0-9_]+' docs/design/*.html \
  | sed 's/.*\.//' | sort | uniq -c | sort -rn

# perze-v2.jsx importa un ./core inexistente
sed -n '12p' docs/library/perze-v2.jsx && ls docs/library/

# Las 29 piezas [spec] no existen en el JSX de referencia
grep -c 'SkeletonBlock\|PriceStatus\|PositionRow\|NeedsFxBanner' docs/library/perze-v2.jsx

# --ramp-* no existe en charts.css
grep -oE '\-\-(ramp|data)-[a-z0-9-]+' docs/design/_ds/*/tokens/charts.css | sort -u

# trades no tiene fx_source
grep -n 'fx_source' docs/01-arquitectura-datos.md

# K quedó completo, con SLOTs vestigiales al final
grep -oE '>K[0-9]{1,2}[a-z]? · [^<]{0,40}' docs/design/bloque-k-ajustes.html | sort -u
grep -n 'SLOT' docs/design/bloque-k-ajustes.html
```

No se modificó ningún archivo del repo.
