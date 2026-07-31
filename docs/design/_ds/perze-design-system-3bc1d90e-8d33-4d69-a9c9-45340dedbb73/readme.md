# PERZE — Design System

Sistema de diseño de **PERZE**, una app de finanzas personales: PWA mobile-first para gestionar gastos, cuentas, presupuestos e inversiones, con soporte multi-cuenta, multi-moneda y multi-país, y modo de grupo familiar.

La acción más frecuente del producto es **cargar un gasto**, y tiene que costar **menos de 5 segundos y 3 taps**. Todo el sistema está calibrado para eso: keypad propio a pantalla completa, chips de gastos frecuentes, cero diálogos de confirmación.

El nombre viene de **PER**sonal financ**E** y se pronuncia *PER-se*. Verificado: no colisiona con ninguna fintech y no significa nada adverso en italiano, portugués ni inglés.

Estética: **minimalista y dark-first**. Neutros cálidos en ~90% de la interfaz; el color aparece solo cuando porta significado.

## Fuentes

Este sistema se construyó a partir de dos documentos de marca provistos por el equipo (no había codebase ni archivo de Figma):

- `uploads/02-design-system.md` — especificación completa de color, tipografía, geometría, motion, componentes propios, reglas de gráficos, navegación y estados obligatorios. Es la fuente de verdad numérica.
- `uploads/style-tile.html` — style tile ejecutable con superficies, paletas, escala tipográfica, radios, botones, chips, badges, keypad, categorías, editor de FX, KPIs y gráficos.

No se proveyó: repositorio de código, links de Figma, símbolo de marca, archivos de fuente, ni deck. Nada de eso se inventó — ver **Caveats**.

## Índice del repositorio

| Ruta | Qué hay |
|---|---|
| `styles.css` | Único punto de entrada para consumidores: sólo `@import`s |
| `tokens/` | `fonts.css`, `palette.css` (valores crudos), `colors.css` (alias semánticos por modo), `charts.css`, `typography.css`, `spacing.css`, `motion.css`, `base.css` |
| `components/core/` | Button, Card, Chip, Icon, Input, ListRow, SegmentedControl, Sheet, StatusBadge, Switch |
| `components/money/` | Amount (+ `formatAmount`), AmountScrubber, CurrencyChip, FxEditor, Keypad, PrivacyBlur |
| `components/finance/` | AccountCarousel, BudgetRing, CategoryBubble, DateStrip, InsightCard, ScopeSwitcher, SplitBar, StatTile, TransactionRow |
| `components/nav/` | AppHeader, SyncDot, TabBar |
| `components/feedback/` | EmptyState, ErrorState, OfflineBanner, Skeleton, SkeletonRow, UndoToast |
| `components/charts/` | BarChart, SeriesLegend, Sparkline |
| `ui_kits/app/` | Recreación click-through de la PWA (5 pantallas) — ver su `README.md` |
| `guidelines/` | Fichas de fundamentos (color, tinta, datos, tipografía, espaciado, motion, marca) |
| `thumbnail.html` | Tile del sistema |
| `SKILL.md` | Envoltorio para usar este sistema como Agent Skill |

Cada componente tiene su `.d.ts` (contrato de props) y su `.prompt.md` (qué es, cuándo usarlo, ejemplo).

## Componentes

Button · Card · Chip · Icon · Input · ListRow · SegmentedControl · Sheet · StatusBadge · Switch · Amount · AmountScrubber · CurrencyChip · FxEditor · Keypad · PrivacyBlur · AccountCarousel · BudgetRing · CategoryBubble · DateStrip · InsightCard · ScopeSwitcher · SplitBar · StatTile · TransactionRow · AppHeader · SyncDot · TabBar · EmptyState · ErrorState · OfflineBanner · Skeleton · SkeletonRow · UndoToast · BarChart · SeriesLegend · Sparkline

El inventario sale de la sección 6 del documento de origen (`Amount`, `Keypad`, `AmountScrubber`, `CurrencyChip`, `FxEditor`, `CategoryBubble`, `AccountCarousel`, `DateStrip`, `TransactionRow`, `BudgetRing`, `SplitBar`, `SyncDot`, `PrivacyBlur`, `InsightCard`, `ScopeSwitcher`, `StatTile`) más los primitivos que el style tile define visualmente (botones, chips, badges de estado, cards, inputs, keypad).

### Adiciones intencionales

Cada una está especificada en el documento de origen aunque no figure en la tabla de componentes:

- **Icon** — envoltorio para el set de glifos de línea; sin él cada pantalla dibujaría sus propios SVG.
- **AppHeader**, **TabBar** — la sección 8 define exactamente el header de 56px y la tab bar de 5 slots con FAB central.
- **EmptyState**, **Skeleton** / **SkeletonRow**, **ErrorState**, **OfflineBanner** — la sección 9 los declara obligatorios en toda pantalla.
- **UndoToast** — materializa "reversible, no confirmable" (sección 1.7).
- **Sheet** — superficie modal del sistema (patrón "Bottom sheet", sección 5.2).
- **BarChart**, **Sparkline**, **SeriesLegend** — las reglas de gráficos de la sección 7 necesitan un lugar donde vivir; `SeriesLegend` es también la "vista de tabla" que todo gráfico de analytics debe ofrecer.
- **Input** — el documento define `radius 14` y superficie 3 para inputs; el componente existe para que nadie use `<input type="number">` para montos.
- **Switch**, **SegmentedControl**, **ListRow** — huecos detectados al diseñar el bloque C (captura de gastos, 11 vistas): un ajuste binario se estaba resolviendo con un `Chip selected`, una elección de 2-4 opciones se estaba degradando a chip + sheet, y la fila de lista se estaba rearmando a mano con divs en tres vistas distintas.

### Selección: superficie vs. marca

El sistema tiene **dos** tratamientos de selección y no son intercambiables:

- **Por superficie** (superficie 3 sobre superficie 1) — `SegmentedControl`, selección de cuenta en `AccountCarousel`, toggle gráfico/tabla, día seleccionado de `DateStrip`, burbuja activa de `CategoryBubble`. Es el default: no consume el único violeta que permite el presupuesto de ruido.
- **Por relleno de marca** — `Chip selected` (filtro activo), `ScopeSwitcher` (`SegmentedControl` con `emphasis="brand"`), tab activo, `Switch` encendido. Reservado para identidad de datos, filtro activo y estado de un control binario.

La regla es **posterior** a la especificación original y gana sobre ella: la spec pedía un "anillo violeta animado" para la categoría seleccionada, escrito antes de que la regla existiera. Se conserva la animación del anillo; cambia el color.

Un segmentado **no** necesita degradarse a "chip que abre un sheet" para no gastar violeta: ese conflicto era falso, lo resuelve el tratamiento por superficie.

## CONTENT FUNDAMENTALS

**Idioma:** español rioplatense (voseo). "Cargá un gasto", "Probá de nuevo", "Todavía no cargaste gastos". Nunca español neutro con tuteo ("carga", "prueba") ni traducciones literales del inglés.

**Persona:** se le habla al usuario en segunda persona; el producto habla de sí mismo en primera del plural sólo cuando falla algo que es suyo: *"No pudimos sincronizar con Itaú."* Nunca "el sistema", nunca "usted".

**Casing:** sentence case en todo — títulos, botones, filas. **UPPERCASE sólo en el nivel `caption`** (11px), y siempre para headers de sección y labels de KPI: `PATRIMONIO NETO`, `TASA DE AHORRO`. Nada de Title Case.

**Longitud:** los textos son cortos porque la pantalla es chica y la regla son 3 segundos. Un insight = una oración. Un empty state = una oración más una acción.

**Números:** formato es-UY — punto de miles, coma de decimales, símbolo antes con espacio fino: `$ 63.740`, `US$ 2.340`, `39,85`. Los montos siempre llevan signo explícito `+`/`−` y, cuando comparan, flecha `↑`/`↓`. Los porcentajes con coma: `4,2%`. Fechas nombradas cuando se puede: "Hoy", "Ayer", "Martes 21".

**Niveles de estado:** `neutral` = falta algo que se resuelve solo · `warning` = prestá atención · `serious` = algo cambió y te conviene mirarlo · `critical` = algo está mal ahora. Un dato pendiente (`needs_fx`, "sin conversión") va en **neutro**, nunca en naranja: el naranja mentiría sobre su gravedad.

**Estados y errores:** tres partes, en este orden — qué pasó, qué implica, qué hacer. *"No pudimos sincronizar con Itaú. Tus gastos locales están guardados. Reintentar."* Prohibido: "No hay datos", "Error inesperado", códigos de error en el titular, stack traces.

**Vocabulario del dominio:** *movimiento* (no "transacción" en la UI), *cuenta*, *presupuesto*, *categoría*, *scope* se muestra como **Personal / Compartido / Todo**, *grupo familiar* (no "household", que es interno), *tipo de cambio* (no "FX", que es interno).

**Tono:** seco y preciso, nunca festivo. El producto no felicita por cargar un gasto; celebra solamente meta alcanzada, mes cerrado bajo presupuesto y primera transacción. Cero signos de exclamación en la UI operativa.

**Emoji:** no se usan como decoración ni en copy. La única excepción son las **banderas** en `CurrencyChip`, donde el glifo es identidad de país.

## VISUAL FOUNDATIONS

**Modos.** Dark-first: `:root` **es** el tema oscuro; el claro se activa con `class="light"` en `<html>`. Ambos son de primera clase, pero se diseña primero en oscuro.

**Color.** Neutros grises **ligeramente cálidos** en ~90% de los píxeles. Marca: violeta índigo, **exactamente dos hexes por modo** (tinta `#8B7CF6`/`#5D45E8`, relleno `#6D55F0` en ambos). El violeta aparece sólo donde significa *accionable*, *seleccionado* o *marca* — nunca decorativo, nunca en degradado, nunca dentro del área de ploteo de un gráfico. Secundario aqua (`#199E70`/`#12916A`) = ingresos y progreso. Acento naranja (`#E06A35`/`#D95926`) = atención y gastos en gráficos. Estados (`good #0CA30C`, `warning #FAB219`, `serious #EC835A`, `critical #D03B3B`) son fijos en los dos modos y siempre van con ícono + label.

**Polaridad del dinero.** Nunca verde/rojo (ΔE 6.5 en la banda de advertencia de daltonismo). Ingresos en aqua; **gastos en tinta neutra**, con signo y flecha.

> **Regla del saldo (más estricta que la especificación original, y es la correcta).** El aqua marca la polaridad de un **movimiento**, nunca la de un **saldo**. Patrimonio neto, saldos de cuenta y cifras de KPI van **siempre en tinta primaria**, sin signo. En código: `Amount` devuelve tinta neutra automáticamente cuando `showSign={false}`; para saldos se puede además ser explícito con `polarity="neutral"`. En una lista donde el 90% son gastos, colorearlos todos es ruido.

**Datos.** Cinco slots de orden fijo (violeta, aqua, naranja, azul, magenta) más "Otros" en gris; nunca ciclados, el color sigue a la entidad y no al ranking. Rampa secuencial de un solo hue violeta (100→700); divergente aqua↔naranja con punto medio en el token de borde. Nunca eje dual, nunca arcoíris, nunca un número sobre cada punto: labels directos selectivos (primero, último, máximo, mínimo). El texto de un gráfico usa tokens de tinta, nunca el color de la serie.

**Tipografía.** Una sola familia, **Geist Sans**; **Geist Mono** con `tabular-nums` sólo en columnas que tienen que alinear (filas de lista, ticks, tablas). Tres pesos: 400 / 500 / 600, nada de 700+. Escala: hero-xl 64/60, hero 40/44, title 22/28, body 16/24, label 13/18, caption 11/16 en mayúsculas. Máximo **3 niveles coexistiendo por pantalla**; una sola cifra héroe.

**Espaciado y layout.** Grid de 4px, padding lateral de pantalla 20px, separación entre bloques 24px. Tab bar 64px + safe area, header 56px colapsable, FAB 64px superpuesto y centrado. Elementos fijos: header arriba, tab bar + FAB abajo; **toda acción primaria vive en los últimos 200px** (zona del pulgar). El carrusel de cuentas sangra fuera del padding para que se vea cortada la card siguiente. Desktop (≥1024px) no se rediseña: sidebar de 240px, dos columnas, ⌘K.

**Radios.** input 14 · button 16 · card 20 · keypad-key 20 · sheet 28 (sólo arriba) · chip 999.

**Cards.** Superficie 1, radio 20, padding 20, **sin sombra y sin borde**. Un card sobre superficie 1 no necesita borde; un input sí. Nunca más de 3 superficies apiladas. Sin separadores entre filas de lista.

**Sombras.** El sistema no tiene sistema de sombras. Única excepción: sheets y FAB, una capa suave — `0 8px 32px rgba(0,0,0,.32)` en oscuro, `rgba(11,11,11,.10)` en claro. Cero sombras internas.

**Transparencia y blur.** Sólo dos usos: el scrim del sheet (oscurecer al 60%, **no** blurear) y `blur(8px)` en modo privacidad sobre montos. Nada de glassmorphism, nada de barras translúcidas. Los estados tintados (badges, banners) usan `color-mix(... 15%, transparent)` sobre la superficie, no opacidad del elemento.

**Fondos.** Planos y sólidos: color de página, nada más. Sin imágenes full-bleed, sin patrones, sin texturas, sin grano, sin degradados decorativos (el único degradado admisible del sistema es una rampa de datos). No hay ilustraciones ni imagery de marca en las fuentes — ver Caveats.

**Movimiento.** Springs, no easings: `snappy 500/32/0.7` (chips, toggles, keypad), `default 400/30/1` (cards, listas), `soft 260/26/1.1` (sheets, pantallas), `bouncy 420/18/0.9` (sólo celebraciones). **Ninguna transición de interfaz supera 320ms**; cuatro excepciones no bloqueantes: count-up 400ms, secuencia de guardado ≤700ms, celebración 900ms, dibujado de línea 600ms. Entrada de lista con stagger de 24ms (`y: 12→0`, opacity 0→1), sólo los primeros 8 items. Lista→detalle con shared element. `prefers-reduced-motion` más un ajuste propio de intensidad (Completa / Reducida / Mínima).

**Press, hover, foco.** Press = `scale(0.96)` con `snappy` + haptic de 8ms, en **todo** lo tocable. Como el producto es táctil, no hay sistema de hover: en escritorio el hover se limita a cambiar el borde a violeta o el color de tinta — nunca a mover, agrandar o levantar. Foco visible: outline de 2px en tinta violeta con 2px de offset. Selección: violeta al 32%.

**Imagery.** No hay fotografía ni ilustración en el sistema. Si algún día entra, la especificación de color pide neutros cálidos: temperatura cálida y baja saturación, nada de imágenes frías o de alto contraste que compitan con el violeta.

**Cómo se cuenta el presupuesto de ruido.** Un grupo homogéneo de controles cuenta como **un** elemento interactivo (el scope switcher de 3 segmentos = 1; el carrusel de cuentas = 1; la lista de movimientos = 1). Los niveles tipográficos se cuentan por tamaño distinto visible, y caption y label cuentan por separado. El header y la tab bar son chrome del sistema y no entran en el conteo; el FAB sí cuenta como la acción primaria y como el único violeta admitido.

**Reglas verificables (presupuesto de ruido por pantalla).** Máximo: 1 cifra héroe · 1 color de marca visible fuera de los gráficos · 1 acción primaria · 3 niveles tipográficos · 5 elementos interactivos sobre el pliegue · 0 bordes de caja evitables · 0 iconos decorativos. Si algo se pasa, no se comprime: se mueve a otra pantalla o a un drawer.

### Excepciones declaradas

Tres pantallas del UI kit no cumplen el presupuesto de ruido. Están acá por escrito y con motivo: una regla que se incumple en silencio se degrada; una que se incumple por escrito y con motivo sigue siendo una regla. Ninguna se "corrige" comprimiendo.

- **Inicio — 4 niveles tipográficos en vez de 3.** El cuarto lo aporta `AccountCarousel`, que necesita tres pesos de texto para institución, saldo y tipo de cuenta. Es una excepción deliberada: el carrusel es la única vista multi-cuenta y multi-moneda de un vistazo, que es el diferencial del producto. No se corrige.
- **Quick Add paso 2 — 11 elementos interactivos contra un máximo de 5.** Son 6 burbujas de categoría y 5 días. En una pantalla de clasificación los targets **son** el contenido: cumplir la regla exigiría paginar las categorías, lo que rompe el camino rápido que el sistema existe para proteger. Excepción consciente, no cumplimiento.
- **Análisis — 4 niveles tipográficos en vez de 3.** El cuarto lo aportan los títulos de card. Cerrarlo exigiría una card por pantalla, que convertiría un hub de analytics en cinco pantallas sin ganancia de comprensión.
- **Apariencia — hasta 3 violetas simultáneos.** Son `Switch` encendidos. El estado de un control binario necesita relleno para leerse de un vistazo, y es la única pantalla donde el violeta no compite con una acción primaria, porque no hay ninguna.

**Prohibiciones tácticas.** Sin `<select>` nativo, sin `<input type="number">` para montos, sin diálogos de confirmación para acciones reversibles (se ejecuta y se ofrece **Deshacer** por 5 segundos), sin menú hamburguesa, sin targets menores a 44×44.

## ICONOGRAPHY

- **Set:** íconos de línea, viewBox 24×24, trazo **1.5px**, extremos y uniones redondeados, sin relleno, monocromos vía `currentColor`. Es la geometría de **Lucide**, que es también lo que usa el style tile provisto.
- **Origen y sustitución:** las fuentes no incluyeron ningún archivo de iconos ni un icon font. Los glifos que aparecen en el style tile se reprodujeron **verbatim** dentro de `components/core/Icon.jsx`; el resto son los equivalentes de Lucide para los flujos que el sistema cubre. **Sustitución a validar por el equipo**: si el producto ya usa otro set (o `lucide-react` con versión fija), reemplazar el mapa de paths.
- **Cómo se usan:** siempre a través de `<Icon name="…" />`. Nunca SVG inline en una pantalla. Tamaños canónicos: 13px (badge de estado, trazo 2.5), 19–20px (filas, header), 22px (tab bar), 26px (category bubble), 28px (FAB), 32px (empty state, trazo 1.25).
- **Color:** tinta neutra por defecto (`--text-secondary`); violeta sólo si el elemento está seleccionado o es la marca; color de estado sólo en badges y banners, donde va acompañado de label.
- **Regla dura:** cero iconos decorativos. Todo ícono debe ser tocable o portar significado; si no, se borra.
- **Emoji:** sólo banderas de país en `CurrencyChip`. Ningún otro emoji, en ninguna superficie.
- **Unicode como ícono:** permitido y usado para polaridad y dirección — `+`, `−`, `↑`, `↓`, y los operadores del keypad `+ − × ÷`. Nunca se sustituye un ícono real por un carácter unicode.

## Caveats

- **El wordmark es tipográfico por decisión, no por ausencia de marca:** **PERZE** en Geist Sans 600 con tracking −2% (ver `guidelines/wordmark.html`). El símbolo queda pendiente y lo provee el equipo; no se dibujó ninguno.
- **No hay archivos de fuente.** Geist Sans y Geist Mono se cargan desde Google Fonts en `tokens/fonts.css`. Si hay licencias/binarios propios, reemplazar el `@import` por `@font-face` locales apuntando a `assets/fonts/`.
- **Iconos:** set Lucide como sustituto documentado (arriba).
- **Sin imágenes ni ilustraciones** en `assets/`: no había ninguna en las fuentes y el sistema no las usa.
