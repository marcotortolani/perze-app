# PERZE — Contrato de componentes

Versión 2 de la biblioteca. Este documento es la entrada para el código: cada componente
declara para qué existe, sus props con tipos, sus estados, los tokens que consume, sus
reglas de accesibilidad y en qué bloques de diseño aparece.

Implementación de referencia: `library/perze-v2.jsx`. Lo que está especificado pero
todavía no implementado se marca **[spec]** y lleva la misma ficha: el contrato es
igual de vinculante.

---

## 0 · Reglas que ningún componente puede violar

Estas seis reglas se verifican en revisión de código, no en revisión de diseño.

1. **La selección se muestra por superficie.** Seleccionado = `--surface-3` sobre
   `--surface-2` o `--surface-1`. El relleno violeta (`--primary-fill`) se reserva para
   **identidad de dato** (scope de datos, tab activo) y **filtro activo**. Un componente
   que reciba `selected` y pinte marca está mal.
2. **Un solo violeta visible por pantalla, y es la acción primaria.** Ningún componente
   usa `--primary-fill` ni `--primary-ink` por decoración. `Switch` encendido es la única
   excepción declarada del sistema, y por eso una pantalla con switches no lleva otra
   acción primaria compitiendo.
3. **Cero sombras.** `--shadow-sheet` sólo en `Sheet` y en el FAB de `TabBar`. Ninguna
   sombra interior, ninguna sombra de color.
4. **Cero degradados.** La única rampa admisible es de datos (`--ramp-*` en un heatmap o
   en una escala secuencial). `conic-gradient` en `RadialDial` es un indicador de valor,
   no un degradado decorativo: dos paradas duras, sin interpolación.
5. **Ningún target por debajo de 44×44.** Si el elemento visible es más chico (celda de
   heatmap de 8 px, thumb de 28 px, punto de PIN de 12 px), el área tocable se agranda
   con padding o con un contenedor, y el componente lo garantiza.
6. **El color nunca porta significado solo.** Todo estado va con ícono + label; toda
   polaridad va con signo y flecha; todo miembro va con inicial o nombre. Aqua es
   ingreso o progreso, naranja es gasto en gráficos o negativo enfatizado, y nunca se usa
   verde/rojo como polaridad de dinero.

**Precisión decimal.** No es fija y no se asume: se deriva del par de monedas o del
instrumento y se pasa como prop. `formatNumber(value, decimals)` exige `decimals`.
`PRECISION` es sólo el default por moneda (UYU 0, USD 2, BTC 8); un instrumento puede
declarar `quantityDecimals` y gana. Ningún componente de dinero llama a `toFixed(2)`.

**Escalamiento por edad.** Existe uno solo en todo el sistema y vive dentro de
`StatusBadge`: un badge `neutral` con `ageDays >= 7` se renderiza `warning`. Ninguna
pantalla implementa este cálculo.

---

## 1 · Decisión: Keypad y PinKeypad son dos componentes

Son dos, con un primitivo compartido (`KeypadKey`). No es una variante:

- **El valor es de otro tipo.** El de captura produce una expresión editable con coma
  decimal y operadores (`+ − × ÷`) que se resuelve al confirmar; el de PIN produce un
  secreto de largo fijo que nunca se muestra.
- **La accesibilidad es distinta.** El de captura anuncia el monto en vivo
  (`aria-live` sobre la cifra); el de PIN anuncia progreso (`3 de 4 dígitos`) y jamás el
  contenido. Un mismo componente tendría que anunciar y no anunciar a la vez.
- **El modelo de error es distinto.** El de PIN tiene bloqueo por intentos y estado de
  espera; el de captura no puede fallar.
- **Lo compartido es el teclado, no la pantalla.** `KeypadKey` unifica alto de 64 px,
  radio 20, press `scale(.96)` y haptic de 8 ms. Eso es lo que había que compartir.

Una sola prop `variant="pin"` habría metido cuatro condicionales en el componente más
usado de la app, y el keypad de captura es la pieza donde el producto se gana o se pierde.

---

## 2 · Funcionales

### PRECISION · decimalsFor(opts) · formatNumber(value, decimals)
- **Existe para:** que la precisión decimal viaje como dato y no como supuesto.
- **Firmas:** `PRECISION: Record<CurrencyCode, number>` · `decimalsFor({ currency?: CurrencyCode, instrument?: { currency?: CurrencyCode, quantityDecimals?: number } }): number` · `formatNumber(value: number, decimals: number): string` (es-UY: punto de miles, coma decimal).
- **Tokens:** ninguno (utilidades).
- **A11y:** los números formateados van siempre dentro de un elemento con `font-variant-numeric: tabular-nums` cuando están en columna.
- **Bloques:** todos. Crítico en C, E, H, I.

### Rate
- **Existe para:** mostrar y editar un tipo de cambio con la precisión del par.
- **Props:** `from: CurrencyCode` · `to: CurrencyCode` · `value: number` · `decimals?: number` (si falta, `max(PRECISION[from], PRECISION[to])`) · `source?: string` · `ageHours?: number` · `onEdit?: () => void`.
- **Estados:** normal · editable (con `onEdit`) · viejo (`ageHours >= 24` muestra badge warning) · sin dato (no se renderiza: la pantalla usa el estado vacío, nunca un guion).
- **Tokens:** `--font-mono`, `--text-primary`, `--text-muted`, `--radius-chip`, `--warning`.
- **A11y:** el texto completo (`1 USD = 40,30 UYU`) es el label; el chip de editar tiene `aria-label="Cambiar el tipo de cambio"`. La antigüedad nunca se comunica sólo por color.
- **Bloques:** C4, E6, E7, H6, I2.

### Quantity
- **Existe para:** una cantidad de instrumento, con la precisión del instrumento.
- **Props:** `value: number` · `instrument?: { quantityDecimals?: number, currency?: CurrencyCode }` · `decimals?: number` · `suffix?: string`.
- **Estados:** normal · cero (se renderiza `0`, nunca vacío).
- **Tokens:** `--font-mono`, `--text-secondary`.
- **A11y:** no va en columna alineada; si el contexto la alinea, el contenedor fija `min-width` para que 8 decimales no muevan la columna vecina.
- **Bloques:** I3, I4, I5.

### StatusBadge
- **Existe para:** el nivel de un estado, con ícono y label, y el único escalamiento por edad del sistema.
- **Props:** `status: 'neutral'|'good'|'warning'|'serious'|'critical'` (default `good`) · `ageDays?: number` · `icon?: IconName` · `children: ReactNode` (el label, obligatorio).
- **Estados:** los cinco niveles · escalado (`neutral` + `ageDays >= 7` → `warning`).
- **Tokens:** `--good --warning --serious --critical --text-secondary --surface-2 --radius-chip`; tintado con `color-mix(... 15%, transparent)`, nunca opacidad.
- **A11y:** `role="status"`. El label es obligatorio: un badge sin texto es una violación de la regla 6, no un caso de uso.
- **Bloques:** F1, F4, G1, G2, H1–H12, I2–I4, I12, L3, L4.

### ListRow
- **Existe para:** la fila de lista de todo el producto.
- **Props:** `label: string` · `meta?: ReactNode` · `value?: ReactNode` · `secondaryValue?: ReactNode` · `icon?: IconName` · `variant?: 'navigation'|'action'|'static'` · `chevron?: boolean` · `right?: ReactNode` · `destructive?: boolean` · `disabled?: boolean` · `onClick?: () => void`.
- **Estados:** navegación · acción (label en `--primary-ink`, y entonces es la acción primaria de la pantalla) · estática · destructiva · deshabilitada · presionada (`scale(.96)`).
- **Tokens:** `--text-primary --text-muted --text-secondary --primary-ink --critical --surface-2 --press-scale`.
- **A11y:** con `right` la fila es `div` y el control anidado porta el rol (un `button` no puede contener contenido interactivo). Sin `right` e interactiva, es `button`. `meta` acepta ReactNode: si lleva un `StatusBadge`, el badge aporta su propio `role="status"`.
- **Bloques:** todos.

### SelectableRow
- **Existe para:** una fila que es una elección, no una navegación.
- **Props:** `label: string` · `meta?: ReactNode` · `selected: boolean` · `multiple?: boolean` · `onChange: (next: boolean) => void` · `disabled?: boolean`.
- **Estados:** sin seleccionar (`--surface-2`) · seleccionada (`--surface-3` + check en tinta) · deshabilitada · foco visible.
- **Tokens:** `--surface-2 --surface-3 --radius-input --text-primary --text-muted`.
- **A11y:** `role="radio"` o `role="checkbox"` según `multiple`, **`aria-checked` obligatorio**, `tabIndex=0`, Espacio y Enter alternan. El grupo contenedor pone `role="radiogroup"` y su label.
- **Bloques:** A6, A8, C2, K3, K5.

### OptionCard
- **Existe para:** una elección grande de un tap: título y una línea, selección por superficie.
- **Props:** `title: string` · `description?: string` · `selected: boolean` · `multiple?: boolean` · `onChange: (next: boolean) => void` · `disabled?: boolean`.
- **Estados:** los mismos que `SelectableRow`, con alto mínimo 72 y radio de card.
- **Tokens:** `--surface-1 --surface-3 --radius-card --text-primary --text-secondary`.
- **A11y:** idem `SelectableRow`. La descripción va dentro del elemento con rol, así que la lee el lector de pantalla sin `aria-describedby`.
- **Bloques:** A5, A8, A9 (tres usos sólo en A), I1, K4.

### KeypadKey
- **Existe para:** ser la tecla de los dos keypads.
- **Props:** `label: ReactNode` · `ariaLabel?: string` · `onPress: () => void` · `onLongPress?: () => void` · `size?: number` (tamaño de fuente, default 32).
- **Estados:** normal · presionada · con long-press.
- **Tokens:** `--keypad-key-height --radius-keypad-key --surface-2 --press-scale --duration-micro --ease-spring-snappy`.
- **A11y:** `button` real con `aria-label` (obligatorio cuando el label es un ícono). Alto 64, mínimo 44 de ancho.
- **Bloques:** A7, C1, C4, F3, I5, K11, L6.

### Keypad (captura)
- **Existe para:** ingresar montos sin el teclado del sistema.
- **Props:** `onKey: (k: string) => void` · `onClear?: () => void` · `operators?: boolean` (default true) · `decimalSeparator?: ','` · `gap?: number`.
- **Estados:** normal · tecla presionada · con expresión pendiente (el consumidor muestra el resultado).
- **Tokens:** los de `KeypadKey` más `--space-2`.
- **A11y:** la cifra que el keypad alimenta lleva `aria-live="polite"`; el backspace tiene `aria-label="Borrar"` y long-press `"Limpiar"`.
- **Bloques:** A7, C1, C4, C5, C6, F3, F7, I5, I6.

### PinKeypad
- **Existe para:** ingresar un secreto de largo fijo.
- **Props:** `length?: number` (default 4) · `filled: number` · `error?: boolean` · `lockedSeconds?: number` · `onKey: (d: string) => void` · `onBackspace: () => void`.
- **Estados:** vacío · parcial · completo · error (puntos en critical) · bloqueado (30 s tras 3 intentos, con copy que aclara que **no se borra nada**).
- **Tokens:** `--surface-3 --text-primary --critical` más los de `KeypadKey`.
- **A11y:** los puntos son `role="status"` con `aria-label="{filled} de {length} dígitos"` y **nunca** exponen el valor. Sin operadores, sin coma. El bloqueo se anuncia como texto, no sólo como estado visual.
- **Bloques:** K11, L6.

### OtpInput
- **Existe para:** el código de seis dígitos del magic link, con autofill del sistema.
- **Props:** `length?: number` (default 6) · `value: string` · `onChange: (v: string) => void` · `invalid?: boolean`.
- **Estados:** vacío · parcial · completo · inválido (outline critical) · autofill.
- **Tokens:** `--surface-3 --radius-input --font-mono --critical`.
- **A11y:** un `input` real por debajo con `autocomplete="one-time-code"`, `inputMode="numeric"`, `aria-label` y `aria-invalid`; las casillas son presentación. El error propone la corrección ("el código vence a los 10 minutos, pedí uno nuevo"), no dice "código inválido".
- **Bloques:** A3.

### Sheet
- **Existe para:** la superficie modal del sistema.
- **Props:** `open?: boolean` · `title?: ReactNode` · `children: ReactNode` · `onClose?: () => void` · `height?: string|number` · `container?: 'parent'|'viewport'` (default `parent`).
- **Estados:** abierto · cerrado (no renderiza) · tres alturas de snap (el consumidor pasa `height`).
- **Tokens:** `--surface-2 --radius-sheet --shadow-sheet --scrim --screen-padding`.
- **A11y:** `role="dialog"`, `aria-modal="true"`, label desde `title`; foco atrapado adentro y Escape cierra; el scrim es `aria-hidden`. El scrim oscurece al 60% y **no** blurea.
- **Bloques:** D2, F0, G0d, I1b, J7, K4.
- **Nota:** `container="parent"` es el default porque el sheet tiene que poder vivir dentro de un frame de 390×844 (documentación, previews, desktop de dos columnas). El `position: fixed` anterior lo hacía inservible ahí.

### ScopeSwitcher — **eliminado**
- El bloque B lo resolvió con `SegmentedControl emphasis="brand"` dentro de `AppHeader`.
  Mantener un alias es garantizar que aparezca un segundo control que hace lo mismo.
- **Migración:** `<ScopeSwitcher value onChange />` → `<SegmentedControl options={['Personal','Compartido','Todo']} value onChange emphasis="brand" />`. `AppHeader` ya lo hace internamente cuando recibe `scope`.
- **Único caso con relleno de marca en un segmentado**, porque el scope es identidad de dato.

---

## 3 · Cosméticas incorporadas

### ZMark
- **Existe para:** ser el único dibujo del sistema: grilla 3×3 con la Z, al 20% de tinta en los estados vacíos y animada en secuencia como loader.
- **Props:** `size?: number` (default 20) · `gap?: number` · `animated?: boolean`.
- **Estados:** estática · animada (7 celdas, 120 ms de stagger, 1,4 s de ciclo) · reducida (con `Movimiento: mínima` la animación se apaga y queda estática).
- **Tokens:** `--text-primary` vía `color-mix(... 20%, transparent)`; el keyframe `zpulse` va en la hoja base del sistema, no en cada pantalla.
- **A11y:** `role="img"` con `aria-label="PERZE"`. Como loader, el contenedor lleva `aria-busy="true"`.
- **Bloques:** L1, L2, A1, y el splash.

### Avatar
- **Existe para:** identificar a un miembro. Es el único lugar donde el relleno de color es identidad de dato.
- **Props:** `name: string` · `color?: string` (un slot de datos, nunca violeta) · `size?: 28|32|36|44|56` · `pending?: boolean`.
- **Estados:** normal · pendiente (superficie 3 + inicial en muted, para el invitado que no aceptó) · sin nombre (`?`).
- **Tokens:** `--data-1..5`, `--surface-3`, `--text-muted`, `--primary-on-fill`.
- **A11y:** `aria-label` y `title` con el nombre completo. **La inicial siempre se renderiza:** un miembro no puede quedar identificado sólo por color.
- **Bloques:** J1–J10, K2, L3.

### AvatarCluster
- **Existe para:** mostrar varios miembros en el ancho de una fila.
- **Props:** `members: Array<{id?, name, color}>` · `max?: number` (default 3) · `size?: number`.
- **Estados:** 1 a 3 caras · con `+N` · vacío (no renderiza).
- **Tokens:** los de `Avatar` más `--page` para el outline de superposición.
- **A11y:** el contenedor expone la lista completa de nombres como label; el `+N` no es tocable por separado.
- **Bloques:** J4, J5 (obligatorio con más de dos personas).

### VisibilityRow
- **Existe para:** que se entienda de un vistazo qué ve otra persona sobre vos.
- **Props:** `label: string` · `meta?: ReactNode` · `viewers: Array<Member>` · `onToggle: (next: boolean) => void`.
- **Estados:** compartido (cluster de caras) · privado (ojo tachado + "Solo vos") · en cambio pendiente de sincronizar.
- **Tokens:** `--text-primary --text-muted` y los de `Avatar`.
- **A11y:** `role="switch"` con `aria-checked` y un `aria-label` que dice el estado en palabras (`"Itaú Caja de Ahorro: solo vos"`). Es lo que hace que la pantalla también funcione a ciegas, donde la presencia de la cara no sirve.
- **Bloques:** J4.

### ProgressSteps
- **Existe para:** el progreso del onboarding.
- **Props:** `total: number` · `current: number`.
- **Estados:** cualquier paso · completo.
- **Tokens:** `--text-primary --surface-3`.
- **A11y:** `role="progressbar"` con `aria-valuemin/max/now` y label `"Paso 3 de 6"`.
- **Bloques:** A4–A9.

### ProgressBar
- **Existe para:** una razón simple, con el tono elegido por significado.
- **Props:** `value: number` · `max?: number` · `tone?: 'neutral'|'progress'|'budget'` · `height?: number` · `label: string`.
- **Estados:** 0 · parcial · completo · `budget` escala a warning en 80% y a critical arriba de 100%.
- **Tokens:** `--surface-3 --text-secondary --secondary --warning --critical --duration-slow`.
- **A11y:** `role="progressbar"` + `aria-valuenow`; `label` es obligatorio porque una barra sin texto no dice qué mide.
- **Bloques:** F5, F6, G4, G5, H14, I9.

### BulletBar
- **Existe para:** el bullet de presupuesto con escala común entre categorías.
- **Props:** `spent: number` · `cap: number` · `projected?: number` · `height?: number`.
- **Estados:** en rango · 80% (warning) · excedido (critical) · sin movimientos (sólo el tic del techo).
- **Tokens:** `--surface-3 --text-secondary --text-primary --text-muted --warning --critical`.
- **A11y:** `role="img"` con label que dice gastado, techo y proyección en números. El estado nunca se lee sólo del color: la fila que lo contiene lleva `StatusBadge`.
- **Bloques:** F1, F2.

### RadialDial
- **Existe para:** ingresar un monto con un pulgar, fuera del keypad.
- **Props:** `value: number` · `min?: number` · `max: number` · `step?: number` · `size?: number` · `onChange: (v: number) => void` · `children?: ReactNode` (el centro).
- **Estados:** normal · arrastrando · en el mínimo o el máximo (el arco no pasa) · con teclado.
- **Tokens:** `--text-primary --surface-3 --page`. Arco en tinta neutra, **nunca violeta**: el violeta es del botón primario.
- **A11y:** `role="slider"` con `aria-valuemin/max/now`, flechas del teclado moviendo un `step`, thumb de 56 px. Haptic de 8 ms cada 5 pasos y uno más marcado al pasar por el promedio histórico.
- **Bloques:** F3.

### LineChart
- **Existe para:** ser la línea real del sistema (hoy `Sparkline` es un placeholder sin ejes ni tooltip).
- **Props:** `series: Array<{label, values: number[], color?, dashed?}>` · `height?: number` · `gridLines?: number` · `labelPoints?: 'extremes'|'none'` · `discrete?: boolean` · `onPoint?: (serie: number, index: number) => void`.
- **Estados:** una serie · dos o más (leyenda obligatoria) · discreta (precios cargados a mano: marker por punto y línea escalonada) · vacía (no renderiza: la card muestra cuánto falta).
- **Tokens:** `--data-1..5 --gridline --line-width --marker-size`.
- **A11y:** `role="img"` con un resumen en texto; el toggle de tabla de `ChartCard` es la alternativa accesible obligatoria. Tooltip táctil con offset vertical de 48 px. Nunca un número sobre cada punto, nunca eje dual, texto en tokens de tinta y nunca en el color de la serie.
- **Bloques:** F2, H3, H5, I2, I4, I10.

### DataList
- **Existe para:** una tabla sin bordes, y para que "ver como tabla" sea siempre lo mismo.
- **Props:** `columns: Array<{key, label, width?}>` · `rows: Array<Record<string, ReactNode> & {emphasis?: boolean}>`.
- **Estados:** 2 a 4 columnas · fila enfatizada (la próxima cuota, el total) · vacía.
- **Tokens:** `--font-mono --text-secondary --text-primary --text-muted`.
- **A11y:** `role="table"/"row"/"columnheader"/"cell"`. Primera columna a la izquierda en sans; el resto a la derecha en mono con `tabular-nums`.
- **Bloques:** G5, G6, H2–H9 (vista de tabla), I3.

### ChartCard
- **Existe para:** envolver todo gráfico, porque es lo que garantiza que exista el toggle de tabla.
- **Props:** `title: string` · `controls?: ReactNode` · `legend?: ReactNode` · `footnote?: ReactNode` · `view?: 'chart'|'table'` · `onViewChange?: (v) => void` · `children: ReactNode`.
- **Estados:** gráfico · tabla · con control de dimensión · con nota al pie.
- **Tokens:** los de `Card` (superficie 1, radio 20, padding, sin borde ni sombra).
- **A11y:** el chip de tabla lleva `aria-pressed`. Título en caption 11 en mayúsculas: es el cuarto nivel tipográfico si se usa en 16, así que en pantallas al límite va en caption.
- **Bloques:** H1–H13, I2, I4, I10, I11.

### DismissibleNotice
- **Existe para:** el onboarding contextual de un solo paso.
- **Props:** `featureKey: string` · `text: string` · `actionLabel?: string` · `onAction?: () => void` · `onDismiss: () => void`.
- **Estados:** visible · descartado (no vuelve, ni en otro dispositivo: el visto viaja con la cuenta) · postergado (otro tooltip se ganó la sesión).
- **Tokens:** `--surface-2 --radius-card --text-primary --text-muted`.
- **A11y:** vive en el flujo y empuja el contenido, no flota ni tapa; la cruz es un `button` de 44×44 con `aria-label="Cerrar"`. Cero violeta: los chips van por superficie.
- **Bloques:** L5 (uno por sección, diez en total).

### InstitutionTile
- **Existe para:** elegir banco o billetera con logo.
- **Props:** `name: string` · `logo?: ReactNode` · `selected: boolean` · `onChange: (name) => void`.
- **Estados:** con logo · sin logo (iniciales, nunca un ícono genérico) · seleccionado (superficie 3) · foco.
- **Tokens:** `--surface-1 --surface-2 --surface-3 --radius-card --text-primary --text-secondary`.
- **A11y:** `role="radio"` + `aria-checked`; el contenedor es `radiogroup` con label "Institución".
- **Bloques:** A6, E3.

### ActivityRow
- **Existe para:** quién hizo qué y cuándo.
- **Props:** `member: Member` · `text: ReactNode` · `meta?: ReactNode`.
- **Estados:** normal · sistema (sin miembro: `Avatar pending`).
- **Tokens:** `--text-primary --text-muted` y los de `Avatar`.
- **A11y:** una sola oración por fila; la hora va en `meta` y no en el label principal.
- **Bloques:** J9, D3 (historial de ediciones), K9 (log de importación).

### ConflictCards
- **Existe para:** resolver dos versiones del mismo objeto sin destruir ninguna.
- **Props:** `subject: string` · `versions: Array<{id, member, title, shortLabel, when, fields}>` · `diffFields: Array<{key, label}>` · `onPick: (id) => void` · `onPickNewest: () => void`.
- **Estados:** dos versiones · sólo campos que difieren · resuelto (la descartada queda en el historial).
- **Tokens:** los de `Card`, `Avatar` y `Button`.
- **A11y:** nivel `serious`, no `critical`: nadie hizo nada mal. Cada botón dice con qué versión se queda, no "aceptar" ni "descartar".
- **Bloques:** J10, L3 (plantilla del sistema de errores).

---

## 4 · Especificadas, no implementadas **[spec]**

Mismo contrato, sin código todavía. Orden de implementación sugerido: las cuatro
primeras desbloquean pantallas enteras.

1. **SkeletonBlock** — `variant: 'hero'|'list'|'cards'|'chart'` · `rows?: number`. Las cuatro plantillas de layout de L2, hoy rearmadas a mano en cada pantalla. Tokens: `--surface-2`. A11y: contenedor `aria-busy="true"`, sin texto. Bloques: todos los estados de carga. **Además**: `Skeleton` tiene que normalizar `width`/`height` numéricos y string — hoy un `"40"` se descarta y el bloque colapsa a cero.
2. **PriceStatus** — `state: 'fresh'|'stale'|'manual'|'market-closed'` · `ageHours?` · `onUpdate?`. El par badge + "actualizar a mano" de I2, I3, I4 e I12. Un precio sin proveedor es `neutral`, no un error.
3. **PositionRow** — `symbol` · `assetClass` · `quantity?` · `price?` · `value` · `changePct` · `alt?: ReactNode` (para el plazo fijo, que no tiene cantidad) · `status?: ReactNode`. Dos líneas, dos columnas de precisión fija, tercera línea condicional. Bloques: I3.
4. **NeedsFxBanner** — `count: number` · `amount: number` · `onResolve`. Regla de producto, no composición: aparece en seis pantallas de H y cuatro de F+G.
5. **MonthCalendar** — `month` · `marks: Array<{date, level}>` · `onSelect`. Celdas de 44 px. Bloques: G1, D5.
6. **CalendarHeatmap** — `days: Array<{date, value}>` · `rows: 'month'|'year'` · `onSelect`. Celdas de 8 px con target de 44 por zona, rampa `--ramp-1..7`. Bloques: H8.
7. **StackedBar / DivergingBar** — `groups` · `series` · `baseline?: 'zero'|'center'` · `inProgressIndex?`. Separador de 2 px del color de superficie, radio 4 anclado a baseline, período en curso en gris. Bloques: H3, H6, H7.
8. **Donut** — `slices` · `dimension?` · `onDrill`. Cinco slots más "Otros" en gris, separadores de 2 px, total en el centro en title. Bloques: H2, I2.
9. **Waterfall** — `deltas: Array<{label, value, color}>` · `total`. Invariante del componente: la suma de `deltas` es `total`, y si no, tira en desarrollo. Bloques: H5.
10. **Sankey** — `nodes` · `links` · `orientation: 'vertical'`. Orden de nodos calculado para minimizar cruces, labels sobre banda. Bloques: H4. **Es el que más falta hace**: hoy las coordenadas están a mano.
11. **RankingBar** — `items: Array<{label, value, meta}>`. Una sola serie, un solo color. Bloques: H9.
12. **BenchmarkBars** — `subject: {label, value}` · `benchmarks: Array<{label, value}>`. El sujeto en slot 1, las referencias en gris. Bloques: I10.
13. **SplitBar v2** — `parts` (con `color` por parte) · `onChange` · `height: number` · `showThumb?` · `showValues?` · `tolerance?`. Hoy no dibuja tirador y exige `height` numérico. Bloques: J2, J6, I9.
14. **StoryFrame** — `index` · `total` · `figure` · `line` · `cover?`. Bloques: H12.
15. **StatTile compact** — `size?: 'md'|'compact'` (title 22 en vez de 30). Es lo que devuelve H1 e I2 a tres niveles tipográficos. Bloques: H1, I2.
16. **InfoCard** — `label` · `value` · `explanation`. El "tooltip" que el sistema no tiene, resuelto como card de una línea. Bloques: I10.
17. **DragRow** — `onReorder`, asa de 44 px. Bloques: I8, K5, E1.
18. **ComparisonBars** — dos miembros por categoría, 6 px de aire y sin separador, ordenado por monto y nunca por diferencia. Bloques: J8.
19. **MirrorBanner** — barra persistente de salida del modo "ver la app como Ana". Bloques: J4.
20. **TabBar** — sumar `badge?: number` por slot y `slots[3]` configurable por el usuario. Bloques: B6, F4, K3.
21. **TransactionRow** — los cuatro casos que faltan: `pending`, `shared`, `attachment`, `installment`. Bloques: D1.
22. **AccountRow / RateRow / GroupCard / ResultGroup / ResolutionChain** — filas y agrupadores de E, K y la búsqueda global. `GroupCard` y `ResultGroup` son el mismo patrón (header de caption + hijos) y deberían unificarse en **SectionGroup** antes de escribirlos dos veces.
23. **AccountCarousel** — `secondaryBalance?: ReactNode` para el broker en dos monedas.
24. **ErrorState** — segunda acción: `alternativeLabel` + `onAlternative`, con el camino alternativo primero.
25. **UndoToast** — variante `progress`: sin acción, con contador y barra de 2 px. Hoy siempre dibuja "Deshacer", incluso sobre algo que no se puede deshacer.
26. **Banner** — renombrar `OfflineBanner` a `Banner` con `status` y `action?`: ya se usa para advertencia y error, y el nombre miente.
27. **EmptyState** — reemplazar el ícono de línea por `ZMark`. Hoy la biblioteca y el sistema de marca dicen dos cosas distintas sobre el mismo estado.
28. **Íconos nuevos** — `mail`, `lock`, `fingerprint`, `install`, `globe` (bandera/mundo) y **`bank-checking`**, porque caja de ahorro y cuenta corriente comparten `bank` y se ven idénticas.
29. **Tokens nuevos** — `--ramp-1..7` en `charts.css` exponiendo la rampa secuencial violeta: hoy los heatmaps referencian `--violet-300..700` de `palette.css`, que el propio archivo dice no referenciar directo.

---

## 5 · Lo que no incorporé, y por qué

- **ScopeSwitcher: eliminado, no migrado a otro nombre.** Dejar un alias garantiza que
  alguien lo use y aparezca un segundo control de alcance. La migración es una línea.
- **Tooltip flotante con puntero.** La deuda pedía un tooltip y lo resolví como
  `DismissibleNotice` en flujo y como `InfoCard` para explicaciones. Un tooltip que flota
  necesita scrim o puntero, y las dos cosas están fuera del sistema.
- **ChartViewToggle como componente suelto.** Vive dentro de `ChartCard`: suelto, se puede
  omitir, y el punto era que no se pueda.
- **GroupCard y ResultGroup por separado.** Son el mismo patrón; van a entrar como un
  `SectionGroup` y por eso no los escribí dos veces.
- **Sistema de sombras y de opacidad.** No se agregó nada: los estados tintados siguen
  usando `color-mix`, no opacidad, y no hay más sombra que la del sheet y el FAB.
- **Nada de lo cosmético que dependa de una decisión de producto abierta.** La licencia de
  K13 y el logo de `InstitutionTile` quedan como slots, no como contenido inventado.

## 6 · Componentes con más de cinco props (candidatos a partirse)

- **ListRow (11).** Es el caso legítimo: es la fila de todo el producto y las props son
  ortogonales. Aun así, `right` + `value` + `secondaryValue` es la zona donde se va a
  romper: si aparece un cuarto slot a la derecha, hay que partir en `ListRow` y
  `ListRowWithControl`.
- **LineChart (6) y PositionRow (7).** `PositionRow` ya nació con dos variantes adentro
  (con cantidad y sin cantidad, para el plazo fijo). Es el primero que partiría.
- **Rate (7).** `source` + `ageHours` + `onEdit` son en realidad un `PriceStatus`
  embebido: cuando `PriceStatus` exista, `Rate` baja a cuatro props.
- **PinKeypad (6) y ConflictCards (6).** Son componentes de flujo, no primitivos: sus
  props son un estado de máquina y no se pueden reducir sin mover la lógica afuera.
- **ChartCard (7).** Cuatro de las siete son slots de ReactNode; es un layout, no un
  control. Se queda.

## 7 · Las tres piezas con más chance de romperse al programarse

1. **La precisión decimal.** Es la que más superficie toca —`Rate`, `Quantity`,
   `Amount`, `PositionRow`, importación, exportación, totales— y la que más fácil se
   arregla mal: alguien va a poner un `toFixed(2)` en un helper y el bitcoin va a
   redondear a dos decimales sin que nada falle visiblemente. Mitigación: `formatNumber`
   exige `decimals` y no tiene default, y hay que testear BTC (8), FCI (4) y UYU (0) en
   la misma lista.
2. **El paso de props numéricas a CSS.** Ya rompió dos veces en este proyecto:
   `SplitBar height="20"` y `Skeleton height="40"` renderizaron en cero porque React no
   agrega `px` a un string. Cualquier prop de tamaño tiene que normalizarse dentro del
   componente (`typeof v === 'number' ? v : parseFloat(v)`), no confiar en el consumidor.
3. **El presupuesto de ruido.** No es un componente, es una invariante entre
   componentes: un solo violeta por pantalla, tres niveles tipográficos, cinco
   interactivos. Ningún componente puede verificarlo solo, y la primera pantalla que se
   programe con `Switch` + botón primario + `Chip selected` lo va a violar sin que nadie
   lo note. Mitigación: una regla de lint que cuente usos de `--primary-fill` por archivo
   de pantalla, y `StatTile size="compact"` disponible antes de que se escriba H1.

