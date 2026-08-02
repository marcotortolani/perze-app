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

**Dinero y cantidades son dos dominios distintos, con dos funciones distintas.** La v2 de este
contrato los confundió en una sola `formatNumber(value: number, decimals)` — y esa firma recibe
un `number`, que es exactamente lo que las reglas de dinero prohíben para un monto. Corregido:

- **Plata** → `formatAmount(money: Money, opts)` sobre `bigint` en unidades mínimas. **Nunca**
  toma `number`. Es el único camino de formateo de dinero y lo consume `Amount`.
- **Cantidades de instrumento** → `formatNumber(value: number, decimals: number)`, sin default
  en `decimals`. Son `numeric(38,12)` y no `bigint`, así que acá sí hay un `number`: es donde
  bitcoin necesita sus 8 decimales y un plazo fijo cero.

`decimalsFor()` tiene que aceptar `instrument` además de `currency`, porque un instrumento
declara su propia `quantityDecimals` y gana sobre el default de la moneda.

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

### FxEditor
- **Existe para:** el rate sugerido como cifra héroe, editable con un slider fino de ±5% alrededor de la sugerencia. Único punto de la app donde un tipo de cambio se ajusta a mano.
- **Props:** `from?: CurrencyCode` (default "USD") · `to?: CurrencyCode` (default "UYU") · `rate: ScaledRate` · `suggested?: ScaledRate` (centro del slider; si falta, es `rate`) · `source?: string` (default `ds.fxEditor.source`) · `ageHours?: number` · `stale?: boolean` · `onChange?: (rate: ScaledRate) => void` · `onOpenKeypad?: () => void`.
- **Estados:** normal · con badge de antigüedad (`stale`) · slider en el límite ±5% (clamp, no rebota).
- **Tokens:** `--text-hero-size/line/track --text-muted --text-primary --surface-3` (accent-color del `<input type="range">`, nunca relleno de marca — la corrección que motivó el componente, ver comentario en el código).
- **A11y:** la cifra es un `button` real (abre el keypad); el slider es un `<input type="range">` nativo, foco y flechas de teclado gratis. El badge de antigüedad usa `StatusBadge` y por lo tanto ya trae su propio `role="status"`.
- **Reconciliación con `Rate`/`PriceStatus` (§ 4, § 6):** `FxEditor` **es** la implementación editable de ese mismo territorio — no un cuarto componente separado. `Rate` (spec) es la variante de solo lectura para listas (E6, E7, H6, I2); cuando `PriceStatus` (spec, LIB-01) exista, el par `source`/`ageHours`/`stale` de `FxEditor` debería consumirlo en vez de reimplementar el badge, igual que se anota para `Rate` en § 6.
- **Bloques:** C4, E6, E7.

### AmountScrubber
- **Existe para:** una cifra héroe arrastrable — el drag horizontal ajusta el monto con aceleración por velocidad, y un tap corto (sin drag, <180ms) le pasa la posta al keypad.
- **Props:** `value: Money` · `step?: bigint` (incremento mínimo en unidades mínimas, default 1000n) · `onChange?: (next: bigint) => void` · `onOpenKeypad?: () => void`.
- **Estados:** normal · activo (arrastrando, `scale(1.02)`).
- **Tokens:** `--duration-fast --ease-spring-snappy` (más los que `Amount` ya trae con `size="hero-xl"`).
- **A11y:** el gesto de arrastre no tiene equivalente de teclado propio — el tap corto abre el `Keypad`, que sí es completamente navegable, así que ese es el camino accesible declarado, no una alternativa de segunda clase.
- **Bloques:** C1, C5.

### StatusBadge
- **Existe para:** el nivel de un estado, con ícono y label, y el único escalamiento por edad del sistema.
- **Props:** `status: 'neutral'|'good'|'warning'|'serious'|'critical'` (default `good`) · `ageDays?: number` · `icon?: IconName` · `children: ReactNode` (el label, obligatorio).
- **Estados:** los cinco niveles · escalado (`neutral` + `ageDays >= 7` → `warning`).
- **Tokens:** `--good --warning --serious --critical --text-secondary --surface-2 --radius-chip`; tintado con `color-mix(... 15%, transparent)`, nunca opacidad.
- **A11y:** `role="status"`. El label es obligatorio: un badge sin texto es una violación de la regla 6, no un caso de uso.
- **Bloques:** F1, F4, G1, G2, H1–H12, I2–I4, I12, L3, L4.

### ListRow
- **Existe para:** la fila de lista de todo el producto.
- **Props:** `label: string` · `meta?: ReactNode` · `value?: ReactNode` · `secondaryValue?: ReactNode` · `icon?: IconName` · `iconBackground?: string` (fondo de la baldosa del ícono, default `--surface-2`; con uno propio el glifo pasa a blanco — ver `accountColorVar()`) · `variant?: 'navigation'|'action'|'static'` · `chevron?: boolean` · `right?: ReactNode` · `destructive?: boolean` · `disabled?: boolean` · `onClick?: () => void`.
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

### CategoryBubble
- **Existe para:** el target de categoría de 64px en la captura y los filtros — ícono neutro y label debajo.
- **Props:** `icon?: IconName` (default "cart") · `label: string` · `selected?: boolean` · `onClick?: () => void`.
- **Estados:** sin seleccionar (`--surface-2`) · seleccionada (`--selection-surface` + anillo + `scale(1.04)`) · presionada.
- **Tokens:** `--selection-surface --selection-ring --surface-2 --text-primary --text-secondary --press-scale --duration-fast --ease-spring-snappy`.
- **A11y:** es un `button` real; el ícono es puramente decorativo porque el `label` ya describe la categoría en texto — no lleva `aria-label` propio ni duplica el texto.
- **Bloques:** C1, C2.

### DateStrip
- **Existe para:** fechar un movimiento con una tira horizontal de días con snap, sin abrir un date picker del sistema.
- **Props:** `days: (string | { date: string; label?: string })[]` (ISO; `label` reemplaza la letra del día para "Hoy"/"Ayer") · `value?: string` · `onChange?: (date: string) => void` · `onLongPress?: (date: string) => void` (abre el calendario completo).
- **Estados:** normal · seleccionado (`--selection-surface` + anillo, cifra en tinta primaria peso 600) · nombrado ("Hoy"/"Ayer", tinta primaria aunque no esté seleccionado).
- **Tokens:** `--selection-surface --selection-ring --surface-2 --radius-input --text-primary --text-secondary --text-muted --font-mono`.
- **A11y:** cada día es un `button` con snap-scroll nativo (foco y flechas del sistema operativo funcionan solos). El long-press no tiene equivalente de teclado propio todavía — pendiente para cuando se programe el calendario completo (`onLongPress`) contra un flujo real.
- **Bloques:** C1, C5.

### SectionGroup
- **Existe para:** el header de grupo — label, contador y "ver todos" — con los hijos debajo. Es el patrón genérico "caption + hijos", renombrado desde `ResultGroup` (LIB-16).
- **Props:** `label: string` · `count?: number` · `onSeeAll?: () => void` · `seeAllLabel?: string` (requerido con `onSeeAll`) · `children: ReactNode`.
- **Estados:** con contador · con "ver todos" · ambos · ninguno.
- **Tokens:** `--text-muted --primary-ink --font-sans`.
- **A11y:** el botón "ver todos" es un `button` real de 44px de alto efectivo (padding del layout, no del componente).
- **Bloques:** B8 (búsqueda), D1 (secciones de lista de movimientos).
- **Nota LIB-16 — por qué no se unificó con los otros cuatro:** el ítem original de deuda (§ 4.22) asumía que `AccountRow`, `RateRow`, `GroupCard`, `ResultGroup` y `ResolutionChain` eran "el mismo patrón". Una vez escritos, no lo son: `AccountRow` es `ListRow` + `Amount` compuestos; `RateRow` es una fila de par+fuente+antigüedad+cifra; `ResolutionChain` es una lista de pasos con uno activo; `GroupCard` es caption+resumen+cifra editable+acción (la composición específica de E8, no un contenedor de hijos). Solo `ResultGroup` era genuinamente "header de caption + hijos" — es la única que se renombra a `SectionGroup`. Forzar los otros cuatro dentro del mismo componente habría sido la abstracción prematura que el proyecto pide evitar; quedan como están, cada uno documentado por separado.

### KeypadKey
- **Existe para:** ser la tecla de los dos keypads.
- **Props:** `label: ReactNode` · `ariaLabel?: string` · `onPress: () => void` · `onLongPress?: () => void` · `size?: number` (tamaño de fuente, default 32).
- **Estados:** normal · presionada · con long-press.
- **Tokens:** `--keypad-key-height --radius-keypad-key --surface-2 --press-scale --duration-micro --ease-spring-snappy`.
- **A11y:** `button` real con `aria-label` (obligatorio cuando el label es un ícono). Alto 64, mínimo 44 de ancho.
- **Bloques:** A7, C1, C4, F3, I5, K11, L6.

### Keypad (captura)
- **Existe para:** ingresar montos sin el teclado del sistema.
- **Props:** `onKey: (k: string) => void` · `onClear?: () => void` · `operators?: boolean` (default `true`; en `false` no dibuja la columna de operadores — `/currencies`, donde eran botones muertos) · `equals?: boolean` (default `false`; en `true` suma una tecla "=" que ocupa toda la fila — solo la captura de gasto la usa) · `announceValue?: string` · `gap?: number`.
- **Estados:** normal · tecla presionada · con expresión pendiente (el consumidor muestra el resultado, y con `equals` congela el héroe hasta que se confirma).
- **Tokens:** los de `KeypadKey` más `--space-2`.
- **A11y:** la cifra que el keypad alimenta lleva `aria-live="polite"`; el backspace tiene `aria-label="Borrar"` y long-press `"Limpiar"`; "=" tiene `aria-label` propio (`ds.keypad.equals`).
- **Bloques:** A7, C1, C4, C5, C6, F3, F7, I5, I6.

### PinKeypad
- **Existe para:** ingresar un secreto de largo fijo — solo los dígitos y el progreso, nunca el valor.
- **Props:** `length: number` (dígitos ya tipeados) · `maxLength?: number` (default 6) · `onKey: (key: string) => void` · `style?`.
- **Estados:** vacío · parcial · completo. El error y el bloqueo (30s tras 3 intentos) **no viven acá** — son estado de `LockScreen`, que envuelve este teclado; `PinKeypad` solo sabe cuántos dígitos van y a dónde van las teclas.
- **Tokens:** `--primary-fill --surface-3` más los de `KeypadKey`.
- **A11y:** los puntos de progreso son `aria-live="polite"` vía `role="status"` visualmente oculto anunciando "{current} de {total} dígitos" (i18n `pinKeypad.progress`) — nunca exponen el dígito. Sin operadores, sin coma.
- **Bloques:** L6, K11 (seguridad).

### LockScreen
- **Existe para:** el gate de PIN al abrir la app — opcional, apagado por defecto.
- **Props:** `onSubmit: (pin: string) => boolean | Promise<boolean>` · `onBiometric?: () => void` · `pinLength?: number` (default 6) · `lockoutSeconds?: number` (default 0 — mientras es > 0, el keypad no se dibuja: nunca se borran datos, solo se espera).
- **Estados:** normal · error (PIN incorrecto, mensaje + puntos vuelven a cero) · bloqueado (30s tras 3 intentos, copy explícito de que los datos están intactos, `ds.lockScreen.lockedOut`).
- **Tokens:** `--text-secondary --text-primary --critical --primary-ink`.
- **A11y:** ícono de candado decorativo; el mensaje de error/bloqueo es texto real, no solo color.
- **Bloques:** L6. **Nunca se interpone entre el usuario y C1/C2** (regla de producto, no del componente): el shortcut de la PWA, el share target y el widget van directo al keypad de captura.

### PinGate (`src/components/pin-gate.tsx`)
- **Existe para:** aplicar `LockScreen` en el único punto correcto — el shell de `(app)/layout.tsx`, que cubre home/cuentas/movimientos/análisis/más. **Nunca envuelve `/add` ni `/transactions/[id]/edit`**, que viven fuera de ese árbol de rutas a propósito (convención de rutas de `CLAUDE.md`): la captura y la edición de los 60s posteriores al guardado quedan pre-auth sin ningún caso especial adicional.
- **Estado:** `usePinStore` (Zustand + `persist`, solo `enabled`/`pinHash` persistidos) para el PIN en sí; el desbloqueo de la pestaña actual vive en `sessionStorage` (`perze:pinUnlocked`), independiente de cuándo termina de hidratarse el store persistido — piden dos fuentes distintas a propósito para no acoplar un bug de timing de hidratación con el gate de seguridad.
- **Bloques:** L6.

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
- **Nota:** el panel nunca pasa el 80% del alto útil (`max-height: 80dvh` en `Overlay`), sea cual sea el `height` que se le pase — con `height="auto"` (preferible para contenido nuevo) crece con su contenido hasta ese tope y recién ahí scrollea; un `height` fijo sigue pudiendo dejar aire de más si el contenido es corto, el tope no resuelve eso.

### ScopeSwitcher — **eliminado**
- El bloque B lo resolvió con `SegmentedControl emphasis="brand"` dentro de `AppHeader`.
  Mantener un alias es garantizar que aparezca un segundo control que hace lo mismo.
- **Migración:** `<ScopeSwitcher value onChange />` → `<SegmentedControl options={['Personal','Compartido','Todo']} value onChange emphasis="brand" />`. `AppHeader` ya lo hace internamente cuando recibe `scope`.
- **Único caso con relleno de marca en un segmentado**, porque el scope es identidad de dato.

---

## 2.5 · Sin ficha, ya en código (CON-22)

Los 16 restantes de la reconciliación (§ intro): tienen código, se usan en pantallas reales
y no requieren ningún cambio — esta sección es la ficha que faltaba, no una revisión.

### Button
- **Existe para:** el botón de acción de todo el sistema, 56-64px de alto.
- **Props:** `variant?: 'primary'|'secondary'|'ghost'|'danger'` (default `primary`) · `size?: 'md'|'lg'|'sm'` (56/64/44px) · `icon?: IconName` · `children?: ReactNode` · `disabled?: boolean` · `fullWidth?: boolean` (default `true`) · `onClick?: () => void` · el resto de `ButtonHTMLAttributes` (`type`, `aria-*`, etc.).
- **Estados:** los 4 `variant` · presionado (`scale(var(--press-scale))`) · deshabilitado (opacidad .4, sin eventos).
- **Tokens:** `--primary-fill --primary-on-fill --text-primary --critical --border --radius-button --primary-button-height --primary-button-height-lg --press-scale --duration-fast --ease-spring-snappy`.
- **A11y:** `button` real; `disabled` real (no solo visual) bloquea el click y el foco de teclado.
- **Bloques:** todos.

### AppHeader
- **Existe para:** el header de 56px de toda pantalla: volver/scope, título, buscar, `SyncDot`.
- **Props:** `title?: string` · `scope?: string` · `onScopeChange?: (scope: string) => void` · `scopeOptions?: string[]` · `onSearch?: () => void` · `onBack?: () => void` · `backLabel?: string` (requerido con `onBack`) · `searchLabel?: string` (requerido con `onSearch`) · `syncState?: 'synced'|'syncing'|'offline'` · `pending?: number` · `showScope?: boolean` (default `true`) · `right?: ReactNode`.
- **Estados:** dashboard (scope switcher visible) · pantalla empujada (`onBack` presente, oculta el scope switcher) · con buscador · con `right` custom.
- **Tokens:** `--header-height --screen-padding --text-primary --text-secondary --page`.
- **A11y:** el botón de volver y el de buscar son de 44×44 con `aria-label` obligatorio (`backLabel`/`searchLabel`, resueltos por el caller vía `useTranslations` — el componente no trae copy propia). El scope switcher es un `SegmentedControl emphasis="brand"`, no un componente separado (`ScopeSwitcher` está eliminado, ver § 2).
- **Bloques:** todos.

### Amount
- **Existe para:** ser el ÚNICO lugar donde se formatea plata en JSX — signo, símbolo, decimales por moneda, color por polaridad, modo privacidad.
- **Props:** `value: Money` · `size?: 'hero-xl'|'hero'|'title'|'body'|'label'` (default `body`) · `polarity?: 'positive'|'negative'|'negative-emphasis'|'neutral'` (default derivado del signo, `neutral` si `showSign=false`) · `showSign?: boolean` (default `true`) · `showArrow?: boolean` · `tabular?: boolean` (mono + `tabular-nums`, solo en columnas) · `mutedDecimals?: boolean` · `privacy?: boolean` · `fit?: boolean` (default `false`) · `fitFloor?: number` (default `FIT_FLOOR` = 0.55).
- **Estados:** positivo/negativo/negativo-énfasis/neutro · con flecha · con decimales atenuados (keypad) · privacidad activa (`blur(8px)`, `userSelect: none`) · `fit` (encogido).
- **`fit`:** encoge el `font-size` hasta `fitFloor` (55% del tamaño nominal por default) cuando el contenedor no alcanza — un patrimonio de varios millones no entra a `hero` 40px en un teléfono angosto, ni un monto de muchos dígitos entra a `hero-xl` 64px en el keypad de captura. Mide con `ResizeObserver` sobre un `<span>` interno `display: inline-block` (una caja `inline` da `scrollWidth` 0 en Blink/WebKit y deja `fit` sin efecto en silencio) y escala `font-size`/`line-height` en vez de `transform: scale()`, para que la caja de layout y la nitidez del texto sigan correctas. El contenedor tiene que darle un ancho definido (bloque con `width` fija bajo un padre acotado, nunca `inline-flex`/ancho intrínseco) — si no, no hay nada contra qué encoger. `AmountScrubber` (C1) lo usa con `style={{ width: "100%" }}` y `fitFloor={0.35}`: es la única cifra sin cota superior (el usuario la construye tecla a tecla), así que necesita un piso más bajo que el resto para no cortarse ni scrollear nunca.
- **Tokens:** `--money-positive --money-negative --money-negative-emphasis --text-hero-xl/hero/title/body/label-* --font-mono --font-sans --text-muted`.
- **A11y:** el signo y la flecha son glifos de texto, no color solo — la polaridad nunca se comunica solo por tinta (regla del sistema de marca). Los decimales van en un `span` separado solo para el atenuado, no rompen la lectura del lector de pantalla.
- **Bloques:** todos los que muestran dinero. Fuera de JSX, el equivalente es `formatAmount`/`formatAmountCompact` de `lib/money` — nunca `toFixed`.

### Icon
- **Existe para:** el set de íconos de línea del sistema (Phosphor, no Lucide — mandato del usuario).
- **Props:** `name: IconName` · `size?: number` (default 20; 24 en nav, 26 en category bubbles) · `strokeWidth?: number` (default 1.5 "regular"; ≥2 pasa a peso "bold") · `color?: string` (default `currentColor`).
- **Estados:** regular · bold (según `strokeWidth`).
- **Tokens:** ninguno propio — `color` hereda del contexto (`currentColor`) salvo que el caller fije un token.
- **A11y:** `aria-hidden="true"` siempre — la regla dura del sistema es que todo ícono tiene que ser tocable (dentro de un control con su propio label) o portar significado ya declarado en texto al lado; nunca es la única fuente de significado.
- **Bloques:** todos. **Nota de inventario:** el sistema de marca pide un ícono `bank-checking` propio para distinguir cuenta corriente de caja de ahorro; hoy ambas comparten glifo (`hand-coins` es el workaround documentado en el código, ver CON-28/29 sobre íconos nuevos).

### Chip
- **Existe para:** la píldora de 36px de filtros, atajos de gasto frecuente y opciones de scope.
- **Props:** `children?: ReactNode` · `selected?: boolean` · `icon?: IconName` · `onClick?: () => void` · el resto de `ButtonHTMLAttributes`.
- **Estados:** normal · seleccionado (relleno de marca — único lugar donde una lista de chips lo gasta) · presionado · no interactivo (sin `onClick`, `cursor: default`).
- **Tokens:** `--primary-fill --primary-on-fill --surface-2 --text-secondary --border --radius-chip --press-scale --duration-fast --ease-spring-snappy`.
- **A11y:** `button` real; sin `onClick` sigue siendo un `button` mudo — un chip puramente decorativo (ej. mostrar la categoría en un resumen) debería resolverse con otro elemento, no con `Chip` sin handler.
- **Bloques:** C1 (categorías frecuentes), filtros de D, K3.

### Card
- **Existe para:** el contenedor de contenido genérico — radio 20, sin sombra, jerarquía por superficie + espaciado.
- **Props:** `surface?: 1|2|3` (default `1`) · `bordered?: boolean` · `padding?: number|string` (default `20`) · `radius?: number|string` · `children?: ReactNode` · el resto de `HTMLAttributes<HTMLDivElement>`.
- **Estados:** las 3 superficies · con/sin borde.
- **Tokens:** `--surface-1/2/3 --radius-card --border`.
- **A11y:** ninguna propia — es un contenedor semánticamente neutro (`div`); el contenido interno aporta sus propios roles.
- **Nota:** `padding`/`radius` aceptan `number|string` pero, a diferencia de `Skeleton`/`Sheet` (que ya pasan por `normalizeSize()`, CON-C6), este componente no normaliza — un string tipo `"20"` sin unidad se pasaría crudo a `style`. No es parte de este relevamiento arreglarlo (CON-22 es solo ficha), pero queda anotado para no repetir el bug de `SplitBar height="20"`/`Skeleton height="40"` que motivó `normalizeSize`.
- **Bloques:** todos.

### SegmentedControl
- **Existe para:** 2-4 opciones mutuamente excluyentes, seleccionadas por superficie (nunca relleno de marca, salvo `emphasis="brand"` para identidad de dato — el scope del household).
- **Props:** `options: (string | { id, label, icon? })[]` · `value?: string` · `onChange?: (id: string) => void` · `size?: 'md'|'sm'` (44/36px) · `emphasis?: 'surface'|'brand'` (default `surface`).
- **Estados:** activo por superficie · activo por marca (`emphasis="brand"`) · inactivo.
- **Tokens:** `--surface-2 --selection-surface --selection-ring --primary-fill --primary-on-fill --text-primary --text-muted --radius-chip --duration-fast --ease-spring-snappy`.
- **A11y:** `role="radiogroup"` en el contenedor, `role="radio"` + `aria-checked` por opción — deliberadamente no `tablist`/`tab`, porque es una elección, no un panel de contenido.
- **Bloques:** todos los que necesitan una elección de 2-4 (kind de captura, scope, tipo de cuenta…).

### SkeletonRow
- **Existe para:** el placeholder de carga pre-armado que calza con `TransactionRow` — respeta la forma real, cero spinners de pantalla completa.
- **Props:** `style?: CSSProperties`. (Es una composición fija de 3 `Skeleton`; no expone sub-props — para otras formas se compone `Skeleton` directamente.)
- **Estados:** único — su forma no varía.
- **Tokens:** hereda los de `Skeleton` (`--surface-2`, animación `ds-skel`).
- **A11y:** ninguna propia — no es contenido, es placeholder; el contenedor de la lista es responsabilidad del caller anunciar como cargando si corresponde.
- **Bloques:** D1, B, cualquier lista de movimientos mientras carga.

### Switch
- **Existe para:** el toggle de 46×28 de un ajuste binario de aplicación inmediata.
- **Props:** `checked?: boolean` · `onChange?: (checked: boolean) => void` · `disabled?: boolean` · `label?: string` (se omite si ya vive dentro de un `ListRow` que etiqueta) · `id?: string` (para `aria-labelledby`).
- **Estados:** on (relleno de marca) · off (`--surface-3`) · deshabilitado · con foco (anillo `--primary-ink`).
- **Tokens:** `--primary-fill --primary-on-fill --surface-3 --text-muted --primary-ink --duration-fast --ease-spring-snappy`.
- **A11y:** `role="switch"` + `aria-checked` + `aria-labelledby`; vibración táctil de 12ms al togglear (`navigator.vibrate`, best-effort, no bloquea si no existe).
- **Bloques:** K (ajustes), cualquier toggle binario.

### Input
- **Existe para:** el campo de texto genérico — superficie 3, radio 14, 48px de alto. **Nunca para montos** (eso es `Keypad`).
- **Props:** `label?: string` · `hint?: string` · `invalid?: boolean` · `multiline?: boolean` · `placeholder?: string` · `value?: string` · `onChange?: (e) => void` · `name?/id?/maxLength?/autoFocus?`.
- **Estados:** normal · con hint · inválido (borde + hint en `--critical`) · multilínea (textarea, 88px mín).
- **Tokens:** `--surface-3 --text-primary --text-secondary --text-muted --critical --border --radius-input`.
- **A11y:** `label` real envolvente (asocia el control sin `htmlFor` manual); el hint inválido debería anunciar la corrección, no solo "campo inválido" (regla general de errores del sistema — este componente no la aplica solo, depende del texto que le pase el caller).
- **Bloques:** formularios de cuentas, notas, comercio en captura.

### CurrencyChip
- **Existe para:** el chip de código ISO que abre el selector de moneda. **Cero banderas** — decisión cerrada (`CLAUDE.md` § "Las dos decisiones de imagen"): la bandera es del país, no de la moneda.
- **Props:** `currency?: string` (default `"UYU"`) · `selected?: boolean` · `onClick?: () => void` · `showChevron?: boolean` (default `true`).
- **Estados:** normal · seleccionado (relleno de marca) · presionado.
- **Tokens:** `--primary-fill --primary-on-fill --surface-2 --text-primary --border --radius-chip --font-mono --press-scale --duration-fast --ease-spring-snappy`.
- **A11y:** `button` real; el código de 3 letras es el label visible y suficiente (no requiere `aria-label` adicional, a diferencia de un ícono solo).
- **Bloques:** E6, H6, I2, K3.

### Sparkline
- **Existe para:** la línea de tendencia de 2px sin ejes, embebida en insight cards y filas de lista.
- **Props:** `values: number[]` · `width?: number` (default 96) · `height?: number` (default 28) · `color?: string` (default `--data-1`).
- **Estados:** único — no tiene interacción ni estado vacío propio (un `values` vacío dibuja un path vacío; el caller decide si mostrar el componente).
- **Tokens:** `--data-1 --line-width`.
- **A11y:** SVG puramente decorativo dentro de un contexto que ya tiene su propio texto (insight, fila) — no lleva `role`/`aria-label` porque no porta información que no esté ya en texto al lado.
- **Bloques:** B (home), H (analytics).

### InsightCard
- **Existe para:** un insight de una línea con ícono de estado, sparkline opcional y exactamente una acción — descartable.
- **Props:** `status?: 'good'|'warning'|'serious'|'critical'|'neutral'` (default `neutral`) · `icon?: IconName` (default por `status`) · `text: ReactNode` (una línea) · `actionLabel?/onAction?` · `sparkline?: ReactNode` · `onDismiss?: () => void` · `dismissLabel?: string` (requerido con `onDismiss`).
- **Estados:** los 5 `status` · con sparkline · con acción · descartable.
- **Tokens:** `--surface-1 --radius-card --good --warning --serious --critical --text-secondary --text-primary --primary-ink --text-muted`.
- **A11y:** el botón de descartar es 44×44 con `aria-label` obligatorio (`dismissLabel`, resuelto por el caller). El color de `status` nunca es la única señal — siempre acompaña un ícono distinto por nivel.
- **Bloques:** B (home). **Pendiente declarado (CON-20, no de esta ficha):** agregar estado de error propio cuando el insight dependa de una query que puede fallar.

### SyncDot
- **Existe para:** el indicador de sync de 6px en el header. **Los errores de sync NO se muestran acá** — llevan `Banner status="error"` (CON-18).
- **Props:** `state?: 'synced'|'syncing'|'offline'` (default `synced`) · `pending?: number` (cambios locales encolados, solo se muestra con `state="offline"`).
- **Estados:** synced (tinta muted, el caso normal no merece color) · syncing (pulso de opacidad) · offline con contador.
- **Tokens:** `--text-muted --warning --font-mono`.
- **A11y:** ninguna propia hoy — es un punto de 6px sin `role`; el estado real y accionable (offline con pendientes) ya se comunica en detalle vía `Banner`, que sí es `role="status"`.
- **Bloques:** `AppHeader` (todos).

### SeriesLegend
- **Existe para:** la leyenda / vista de tabla de un gráfico — máximo 5 series + "Otros", colores de los slots de datos fijos por índice.
- **Props:** `series: { label: string; value?: string; color?: string }[]` · `layout?: 'table'|'inline'` (default `table`) · `dividers?: boolean` (default `false`).
- **Estados:** layout tabla (con valores alineados a la derecha en mono) · layout inline (chips en una fila) · con/sin separadores.
- **Tokens:** `--data-1..5 --data-other --text-primary --text-secondary --border`.
- **A11y:** en layout `table` es una `<table>` real — el lector de pantalla la navega como tabla; en `inline` es texto plano con un chip de color decorativo al lado (el texto ya nombra la serie, el color no es la única fuente).
- **Bloques:** todo gráfico con ≥2 series (regla del sistema: leyenda obligatoria a partir de 2).

### BarChart
- **Existe para:** el gráfico de barras del sistema — extremos redondeados de 4px anclados a la baseline, grilla recesiva, sin fondo de gráfico.
- **Props:** `data: { label: string; value: number; color?: string; display?: string }[]` · `height?: number` (default 130) · `color?: string` (default `--data-1`) · `gridLines?: number` (default 3) · `labelExtremes?: boolean` (default `true`, dibuja el valor solo sobre la barra máxima — nunca un número sobre cada barra).
- **Estados:** único — sin interacción propia; el toggle "ver como tabla" (regla del sistema para todo gráfico) vive en el `ChartCard` que lo envuelve, no acá.
- **Tokens:** `--data-1 --gridline --border --text-muted --text-secondary --bar-radius --font-mono --font-sans`.
- **A11y:** SVG puro sin `role`; el valor accesible en texto vive en el `display` de la barra máxima y en el `SeriesLegend`/tabla que lo acompaña — este componente por sí solo no es la fuente accesible de los datos.
- **Bloques:** F (presupuestos), H (analytics).

---

## 3 · Cosméticas incorporadas

### ZMark
- **Existe para:** ser el único dibujo del sistema: grilla 3×3 con la Z, en tinta atenuada en los estados vacíos y animada en secuencia como loader.
- **Props:** `size?: number` (default 20) · `gap?: number` · `animated?: boolean` · `variant?: "pulse" | "sweep"` (default `"pulse"`) · `aria-label?: string` (default `"PERZE"`; las pantallas pasan `t("app.name")`).
- **Estados:** estática · animada `pulse` (7 celdas, 120 ms de stagger, 1,4 s de ciclo, opacidad) · animada `sweep` (un solo bloque encendido en `--primary-ink` recorre la Z: 400 ms por celda, ciclo de 2,8 s, keyframe `zsweep`) · reducida (con `Movimiento: reducida` no hay stagger ni violeta: el conjunto pulsa entero con `zpulse`; con `mínima` la animación se apaga y queda estática, ver `useMotionIntensity`).
- **Tokens:** `--zmark-ink` (`color-mix(... N%, transparent)` sobre `--text-primary`) — **28% en oscuro, 20% en claro** (CON-19, auditoría D44: el 20% original se pierde en oscuro); en `sweep`, el bloque activo usa `--primary-ink`. Los keyframes `zpulse` y `zsweep` van en la hoja base del sistema, no en cada pantalla.
- **A11y:** `role="img"` con `aria-label` (default `"PERZE"`). Como loader, el contenedor lleva `aria-busy="true"`.
- **Bloques:** L1, L2, A1, y el splash. Ya en código: reemplaza el ícono de línea de `EmptyState`; `sweep` es el hero de A2 y el loader de A3 y A11.

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
- **Existe para:** elegir banco o billetera — CON-29: baldosa de monograma, nunca el logo real de un tercero.
- **Props:** `name: string` · `color: string` (obligatorio — `institutions.color`, el monograma se pinta sobre este) · `logoUrl?: string | null` (slot opcional para un override **local** del usuario, nunca un preset del catálogo) · `selected?: boolean` · `onClick?: () => void`.
- **Estados:** monograma (dos iniciales sobre `color`, caso normal — nunca un ícono genérico) · con `logoUrl` (override local, renderiza `<img>`) · seleccionado (`--selection-ring` + `--selection-surface`) · presionado.
- **Tokens:** `--selection-surface --selection-ring --surface-2 --text-primary --press-scale --duration-fast --ease-spring-snappy`.
- **A11y:** `button` real; el logo de terceros (`logoUrl`) lleva `alt=""` porque es decorativo — el nombre visible ya identifica la institución en texto.
- **Bloques:** A6, E1, E3.

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

## 4 · Especificadas, ya en código (GATE-3 cerrado)

Las 29 piezas de esta lista **tienen código** — GATE-3 (`docs/plan-de-trabajo.md` LIB-01..18
+ CON-09..30) está cerrado. Se conserva el número original de cada ítem para poder
rastrearlo contra el historial del proyecto; las fichas completas (props, estados, tokens,
a11y) de los 18 componentes genuinamente nuevos están en **§ 4.1** más abajo. Los ítems que
resultaron ser ajustes sobre componentes ya fichados (21, 23–27) están documentados en la
ficha de ese componente en § 2/§ 2.5, no acá dos veces.

1. **SkeletonBlock** — hecho, ficha en § 4.1. `Skeleton` ya normaliza `width`/`height`/`radius` (`normalizeSize`, CON-10).
2. **PriceStatus** — hecho, ficha en § 4.1.
3. **PositionRow** — hecho, ficha en § 4.1.
4. **NeedsFxBanner** — hecho, ficha en § 4.1. **Corregido contra la especificación original:** sin `amount` — solo `count` (CLAUDE.md § needs_fx, ver la ficha).
5. **MonthCalendar** — hecho, ficha en § 4.1.
6. **CalendarHeatmap** — hecho, ficha en § 4.1.
7. **StackedBar / DivergingBar** — hecho, ficha en § 4.1.
8. **Donut** — hecho, ficha en § 4.1.
9. **Waterfall** — hecho, ficha en § 4.1. Invariante `sum(deltas) === total` verificada con un `throw` en desarrollo (`NODE_ENV !== 'production'`), silenciosa en producción.
10. **Sankey** — hecho, ficha en § 4.1.
11. **RankingBar** — hecho, ficha en § 4.1.
12. **BenchmarkBars** — hecho, ficha en § 4.1.
13. **SplitBar v2** — hecho (CON-11, § 2 `SplitBar`).
14. **StoryFrame** — hecho, ficha en § 4.1.
15. **StatTile compact** — hecho. `size?: 'md'|'compact'` en `StatTile` (§ 2), title 22 en vez de 30.
16. **InfoCard** — hecho, ficha en § 4.1.
17. **DragRow** — hecho, ficha en § 4.1.
18. **ComparisonBars** — hecho, ficha en § 4.1.
19. **MirrorBanner** — hecho, ficha en § 4.1.
20. **TabBar** — hecho (CON-13, § 2 `TabBar`).
21. **TransactionRow** — hecho (CON-14, § 2 `TransactionRow`).
22. **AccountRow / RateRow / GroupCard / ResultGroup / ResolutionChain** — hecho (LIB-16). Solo `ResultGroup` era genuinamente "header de caption + hijos" — se renombró a `SectionGroup` (§ 2). Los otros cuatro, ya escritos, resultaron ser composiciones distintas entre sí y quedan separados — ver la nota completa en la ficha de `SectionGroup`.
23. **AccountCarousel** — hecho (CON-15, § 2 `AccountCarousel`).
24. **ErrorState** — hecho (CON-16, § 2 `ErrorState`).
25. **UndoToast** — hecho (CON-17, § 2 `UndoToast`).
26. **Banner** — hecho (CON-18, § 2 `Banner`).
27. **EmptyState** — hecho (CON-19, § 2 `EmptyState`).
28. **Íconos nuevos** — hecho (LIB-17). `mail`, `lock`, `fingerprint`, `install`, `globe` ya estaban en `Icon.tsx`; se agregó `bank-checking` (glifo `Cardholder`, distinto de `bank`) y se reasignó `checking` en `ACCOUNT_KIND_ICON`.
29. **Tokens nuevos** — hecho (LIB-17). `--ramp-1..7` en `globals.css`, 7 pasos por modo respetando el piso de contraste 2:1 de § 2.7 del sistema de diseño (100→550 en oscuro, 250→700 en claro) — nunca `--violet-300..700` directo.

---

## 4.1 · Fichas de los 18 componentes de LIB-01..18

### PriceStatus (LIB-01)
- **Existe para:** el par badge + "actualizar a mano" de I2/I3/I4/I12.
- **Props:** `state: 'fresh'|'stale'|'manual'|'market-closed'` · `ageHours?: number` · `onUpdate?: () => void`.
- **Estados:** `fresh` (`StatusBadge status="good"`) · `stale` (`warning` + antigüedad) · `manual`/`market-closed` (`neutral` — **no es un error**, es un dato sin proveedor o fuera de horario de mercado).
- **Tokens:** los de `StatusBadge` (`--good --warning --text-secondary --surface-2`).
- **A11y:** el botón de actualizar es 28px visual dentro de un target táctil equivalente, con `aria-label="Actualizar precio"` (i18n `ds.priceStatus.update`).
- **Bloques:** I2, I3, I4, I12.

### PositionRow (LIB-02)
- **Existe para:** la fila de una posición de inversión — dos líneas, dos columnas de precisión fija, tercera línea condicional.
- **Props:** `symbol: string` · `assetClass: string` · `quantity?: ReactNode` · `price?: ReactNode` · `value: ReactNode` · `changePct: ReactNode` · `alt?: ReactNode` (reemplaza cantidad/precio para el plazo fijo) · `status?: ReactNode` (típicamente un `PriceStatus`) · `onClick?: () => void`.
- **Estados:** con cantidad/precio · con `alt` (plazo fijo) · con `status` · clickeable.
- **Tokens:** `--text-primary --text-secondary --text-muted --font-mono`.
- **A11y:** `button` real cuando tiene `onClick`; `div` estático si no.
- **Bloques:** I3.

### NeedsFxBanner (LIB-03)
- **Existe para:** declarar cuántos movimientos quedaron afuera de un agregado por `needs_fx` — la regla de producto más cara de romper del proyecto (CLAUDE.md § needs_fx).
- **Props:** `count: number` (si `count <= 0`, no renderiza nada) · `onResolve?: () => void`.
- **Corrección deliberada contra el `[spec]` original:** **nunca `amount`** — un movimiento sin `fx_rate` no tiene `amount_base`, sumar montos de monedas distintas da un número sin significado.
- **Estados:** con acción de resolver · sin acción (solo informativo).
- **Tokens:** `--warning --font-sans`.
- **A11y:** `role="status"`.
- **Bloques:** H1a, H5, H7, F2, G1, G4, I2, I3, I11, J2, J7, K1, E8.

### MonthCalendar (LIB-04)
- **Existe para:** la grilla de mes de presupuestos (G1) y el calendario de movimientos (D5) — celdas de 44px.
- **Props:** `month: string` (ISO "YYYY-MM") · `marks?: { date: string; level: number }[]` (level 0-7, mapea a `--ramp-N`) · `value?: string` · `onSelect?: (date: string) => void`.
- **Estados:** celda sin marca · con nivel (1-7) · seleccionada (anillo `--selection-ring`).
- **Tokens:** `--ramp-1..7 --selection-ring --text-muted --text-primary --font-mono`.
- **A11y:** cada día es un `button` de 44px real; los encabezados de día de semana usan `formatWeekdayNarrow` del locale activo.
- **Bloques:** G1, D5.

### CalendarHeatmap (LIB-05)
- **Existe para:** el heatmap de calendario de H8 — celdas de 8px con target de 44px por zona.
- **Props:** `days: { date: string; value: number }[]` (el componente normaliza a 7 niveles — no recibe el nivel ya resuelto) · `rows?: 'month'|'year'` · `onSelect?: (date: string) => void`.
- **Estados:** celda vacía (sin actividad) · 7 niveles de `--ramp-1..7`.
- **Tokens:** `--ramp-1..7 --surface-2`.
- **A11y:** cada celda es un `button` con `aria-label` de la fecha ISO; el hit-area real es 44px aunque el cuadrado visual sea 8px (padding, no tamaño de celda).
- **Bloques:** H8.

### Donut (LIB-06)
- **Existe para:** el gráfico de composición de H2/I2 — 5 slots + "Otros", separadores de 2px, total en el centro.
- **Props:** `slices: { label: string; value: number; color?: string }[]` · `dimension?: ReactNode` (texto en el centro, típicamente el total) · `onDrill?: (label: string) => void` · `size?: number` (default 180).
- **Estados:** con drill-down (`onClick` por slice) · sin él.
- **Tokens:** `--data-1..5 --data-other --text-title-size --text-primary`.
- **A11y:** el SVG no lleva `role` propio — el total en el centro y el `SeriesLegend`/tabla que lo acompaña son la fuente accesible.
- **Bloques:** H2, I2.

### Waterfall (LIB-07)
- **Existe para:** el gráfico de cascada de H5 — cada barra parte de donde terminó la anterior.
- **Props:** `deltas: { label: string; value: number; color?: string }[]` · `total: number` · `height?: number`.
- **Invariante:** `sum(deltas.value) === total` (tolerancia 0.01) — si no se cumple, **tira una excepción en desarrollo** (`NODE_ENV !== 'production'`) y no rompe producción silenciosamente distinto de cómo se pidió; en producción no valida.
- **Estados:** delta positivo (`--money-positive`) · negativo (`--money-negative-emphasis`) · color override por delta.
- **Tokens:** `--money-positive --money-negative-emphasis --border --bar-radius`.
- **Bloques:** H5.

### Sankey (LIB-08)
- **Existe para:** el diagrama de flujo de H4 — el que más faltaba, hoy con coordenadas a mano.
- **Props:** `nodes: { id, label, column, color? }[]` · `links: { source, target, value }[]` · `orientation?: 'vertical'` · `width?/height?: number`.
- **Orden de nodos:** dentro de cada columna, ordenados por valor total descendente (heurística simple de minimización de cruces, no un solver de optimización completo).
- **Tokens:** `--data-1 --text-secondary --font-sans`.
- **A11y:** labels en texto SVG junto a cada nodo, nunca solo color.
- **Bloques:** H4.

### RankingBar (LIB-09)
- **Existe para:** el ranking horizontal de H9 — una sola serie, un solo color.
- **Props:** `items: { label, value, meta? }[]` · `display?: (value: number) => ReactNode`.
- **Tokens:** `--data-1 --surface-2 --text-primary --text-secondary --text-muted`.
- **Bloques:** H9.

### BenchmarkBars (LIB-10)
- **Existe para:** comparar una posición contra benchmarks (I10) — el sujeto en slot 1, las referencias en gris.
- **Props:** `subject: { label, value }` · `benchmarks: { label, value }[]` · `display?: (value: number) => ReactNode`.
- **Tokens:** `--data-1 --text-muted --surface-2`.
- **Bloques:** I10.

### StoryFrame (LIB-11)
- **Existe para:** un frame del "Wrapped" de H12 — progreso de N puntos, figura, una línea de lectura.
- **Props:** `index: number` · `total: number` · `figure: ReactNode` · `line: ReactNode` · `cover?: ReactNode`.
- **Tokens:** `--text-primary --surface-2`.
- **A11y:** `role="progressbar"` con `aria-valuenow/min/max` en el indicador superior.
- **Bloques:** H12.

### InfoCard (LIB-12)
- **Existe para:** el "tooltip" que el sistema no tiene — resuelto como card de una línea, sin scrim ni puntero.
- **Props:** `label: string` · `value: ReactNode` · `explanation: string`.
- **Tokens:** `--surface-1 --radius-card --text-muted --text-primary --text-secondary`.
- **Bloques:** I10.

### DragRow (LIB-13)
- **Existe para:** una fila reordenable con asa de 44px.
- **Props:** `id: string` · `children: ReactNode` · `index: number` · `onReorder?: (fromIndex, toIndex) => void` · `rowHeight?: number` (default 56) · `dragLabel: string` (requerido — `aria-label` del asa, resuelto por el caller vía `useTranslations`).
- **Mecánica:** el drag vertical mueve de a una posición por cada `rowHeight` de recorrido; el gesto reporta `(fromIndex, toIndex)`, no reordena la lista solo — el caller es dueño del array.
- **Tokens:** `--surface-1 --duration-fast --ease-spring-snappy`.
- **A11y:** el asa es un `button` de 44×44 con `aria-label` obligatorio.
- **Bloques:** I8, K5, E1.

### ComparisonBars (LIB-14)
- **Existe para:** comparar dos miembros por categoría (J8) — 6px de aire, sin separador.
- **Props:** `categories: { label: string; members: { label, value, color }[] }[]` · `display?: (value: number) => ReactNode`.
- **Regla:** el caller ordena las categorías por monto — **nunca por diferencia entre miembros**, eso exagera desacuerdos pequeños en montos chicos.
- **Tokens:** `--surface-2 --text-muted --text-secondary`.
- **Bloques:** J8.

### MirrorBanner (LIB-15)
- **Existe para:** la barra persistente de salida del modo espejo ("ver la app como Ana", J4).
- **Props:** `message: string` · `exitLabel: string` · `onExit: () => void`.
- **Nota de arquitectura:** el modo espejo en sí no vive en RLS — es una consulta de servidor con `can_see()` del `member_id` del otro (CLAUDE.md § schema, decisión 1); este componente es solo la salida visible, nunca amplía acceso.
- **Tokens:** `--surface-3 --text-primary --primary-ink`.
- **A11y:** `role="status"`.
- **Bloques:** J4.

### StackedBar / DivergingBar (LIB-18)
- **Existen para:** H3/H6/H7 — composición apilada y variación divergente, dos componentes con la misma familia de reglas visuales.
- **`StackedBar` props:** `groups: { label, values: number[] }[]` · `series: { label, color? }[]` (mismo orden que `values`) · `height?: number` · `inProgressIndex?: number` (el grupo en curso se pinta en `--text-muted`, nunca en color de serie).
- **`DivergingBar` props:** `data: { label, value }[]` · `baseline?: 'zero'|'center'` · `height?: number`.
- **Estados:** `StackedBar` — segmento normal · período en curso (gris) · separador de 2px entre segmentos. `DivergingBar` — positivo (`--diverge-aqua-2`) · negativo (`--diverge-orange-2`), nunca eje dual.
- **Tokens:** `--data-1..5 --data-other --diverge-aqua-2 --diverge-orange-2 --border --bar-radius`.
- **Bloques:** H3, H6, H7.

### SkeletonBlock
- **Existe para:** las cuatro plantillas de carga de L2 — antes rearmadas a mano en cada pantalla.
- **Props:** `variant: 'hero'|'list'|'cards'|'chart'` · `rows?: number` (default 3; ignorado en `hero`/`chart`, que tienen forma fija).
- **Estados:** los 4 `variant`.
- **Tokens:** `--surface-2` (vía `Skeleton`).
- **A11y:** contenedor con `aria-busy="true"`, sin texto.
- **Bloques:** todos los estados de carga.

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

