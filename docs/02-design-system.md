# 02 — Design system, interacción y motion

> Input obligatorio de los prompts de diseño de alta fidelidad (`04-prompts-ui.md`).
> La paleta de datos está **validada con el validador de paletas** (banda de luminosidad, croma, separación CVD, piso de visión normal y contraste) contra las superficies reales de esta app, en modo claro y oscuro. Todos los checks pasan.

---

## 1. Principios

1. **Minimalismo estructural: más pantallas, menos por pantalla.** Si una pantalla tiene dos trabajos, son dos pantallas. Preferimos un flujo de 4 pasos limpios a una pantalla de 4 secciones apretadas.
2. **Regla del 3 segundos.** Cualquier pantalla se entiende en 3 segundos: una cifra protagonista, un contexto, una acción. Todo lo demás está a un tap de distancia, no en pantalla.
3. **Neutro por defecto, color por excepción.** ~90% de los píxeles son neutros. El color aparece solo cuando *significa* algo: identidad de marca, polaridad del dinero, estado, o una serie de datos.
4. **Dark-first.** Se diseña primero en oscuro; el claro es de primera clase pero deriva.
5. **La cifra es el héroe.** El número más importante de la pantalla es el objeto más grande, y por bastante margen.
6. **Nada que requiera precisión.** Ningún target menor a 44×44. El primario mide 56–64px de alto, ancho completo, en los últimos 200px de la pantalla.
7. **Reversible, no confirmable.** Se ejecuta y se ofrece deshacer.
8. **El "juicy" viene del movimiento, no del ornamento.** Springs bien calibrados, transiciones de elemento compartido y háptica. Cero sombras dramáticas, cero degradados decorativos, cero glassmorphism gratuito.
   Única excepción, acotada a propósito: el **fondo de puntos** (`page-backdrop` en
   `globals.css`, `src/lib/backdrop/`) es una textura de fondo global, neutra y recesiva —
   nunca un degradado de marca. Es **opt-in y apagada por default** en Ajustes; el usuario
   solo puede elegir entre tres pasos de separación y cuatro de intensidad, ambos acotados por
   diseño en `globals.css` para que ningún valor quede fuera del estándar visual. No aparece
   en encabezado, tab bar, sidebar, modales ni sheets. Esta excepción **no habilita** ningún
   otro ornamento decorativo.

### Presupuesto de ruido visual (regla dura, verificable)

Por pantalla, como máximo:

- **1** cifra héroe
- **1** color de marca visible fuera de los datos
- **1** acción primaria
- **3** niveles tipográficos
- **5** elementos interactivos por encima del pliegue
- **0** bordes de caja donde alcance el espaciado
- **0** iconos decorativos (todo ícono debe ser tocable o portar significado)

Si algo se pasa, no se comprime: se mueve a otra pantalla o a un drawer.

---

## 2. Color

### 2.1 Estructura

| Rol | Función | Cuánto de la pantalla |
|---|---|---|
| **Neutros** | Superficies, texto, bordes, íconos, gráficos sin identidad | ~90% |
| **Primario (marca)** | Identidad, acción primaria, estado activo, selección | ~5% |
| **Secundario** | Polaridad positiva: ingresos, progreso, confirmación | ~3% |
| **Acento** | Polaridad negativa y atención: gastos, alertas suaves | ~2% |
| **Estado** | good / warning / serious / critical — reservados | puntual |
| **Datos** | Series de gráficos | solo dentro de gráficos |

### 2.2 Neutros (la base)

Gris **ligeramente cálido** — más agradable y menos clínico que el gris puro, y hace que el violeta primario se vea más limpio por contraste.

| Rol | Dark | Light |
|---|---|---|
| Plano de página | `#0A0A0B` | `#FAFAF9` |
| Superficie 1 — cards, gráficos | `#131315` | `#FFFFFF` |
| Superficie 2 — sheets, elevado | `#1B1B1E` | `#F5F5F4` |
| Superficie 3 — inputs, keypad | `#26262A` | `#EEEEEC` |
| Borde / divisor | `#2E2E33` | `#E4E4E1` |
| Texto primario | `#FAFAF9` | `#131315` |
| Texto secundario | `#A1A1A6` (7.2:1) | `#5A5A60` (6.9:1) |
| Texto muted — ejes, captions | `#8E8E96` (5.7:1 vs. sup. 1) | `#6B6B71` (5.3:1 vs. sup. 1) |
| Gridline hairline | `#232326` | `#EFEFED` |
| Superficie de selección | `#2C2C31` (1,24:1 vs. sup. 2) | `#DEDEDA` (1,24:1 vs. sup. 2) |
| Anillo de selección | `#37373A` (1,45:1 vs. sup. 2) | `#C9C9C4` (1,52:1 vs. sup. 2) |

**D5 (auditoría técnica, cerrado):** texto muted era `#6E6E76`/`#8A8A90` — 3,7:1/3,4:1, por debajo de AA (4,5:1) en el peor caso (contra Superficie 3, la más parecida al propio ink3). Los valores de arriba ya son los corregidos.

**No hay más de 3 superficies apiladas nunca.** Si necesitás una cuarta, el layout está mal.

**Selección por superficie (auditoría D02, corregido).** `--surface-3` contra `--surface-2`
daba 1,065:1 en claro y 1,14:1 en oscuro — indistinguible. Token propio (`--selection-surface`
+ `--selection-ring`), nunca compartido con `--surface-3` (que sigue siendo inputs/keypad):
`SegmentedControl` (opción no-marca), `Chip` de identidad neutra, `CategoryBubble`,
`DateStrip`, `AccountCarousel`, `SelectableRow`, `OptionCard`, `InstitutionTile`. Contraste
verificado con la fórmula de luminancia relativa WCAG, no a ojo — mismo orden de magnitud en
los dos modos para que el mecanismo se sienta igual de firme.

**Tinta de `ZMark` (CON-19, auditoría D44).** El 20% de tinta que documentaba el sistema de
marca se pierde en oscuro. Token propio `--zmark-ink` (`color-mix(in srgb, var(--text-primary)
N%, transparent)`): **28% en oscuro, 20% en claro** — la app arranca en oscuro por defecto, así
que el valor de `:root` es el de 28% y `.light`/`[data-theme="light"]` lo baja a 20%. Ningún
componente calcula el porcentaje a mano.

### 2.3 Primario, secundario y acento

| Rol | Nombre | Dark | Light | Uso |
|---|---|---|---|---|
| **Primario** | Violeta índigo | texto/ícono `#8B7CF6` · relleno `#6D55F0` | texto/ícono `#5D45E8` · relleno `#6D55F0` | Marca, botón primario, tab activo, selección, foco, serie 1 de datos |
| | | *(solo dos hexes de violeta por modo: uno de tinta, uno de relleno. No hay un tercero.)* | | |
| **Secundario** | Aqua profundo | `#199E70` | `#0D7A58` | Ingresos, progreso completado, confirmación, serie 2 |
| **Acento** | Naranja quemado | `#E06A35` | `#B8451A` | Gastos, atención, serie 3 |

Contrastes verificados: relleno primario `#6D55F0` + texto blanco = **4.99:1** (AA texto normal) y **3.72:1** contra la superficie oscura. Texto violeta `#8B7CF6` sobre dark = **5.58:1**; `#5D45E8` sobre light = **6.03:1**.

**El violeta es el único color de marca.** No hay degradados de marca, no hay segundo violeta, no hay violeta decorativo. Si el violeta no está diciendo "esto es accionable / esto está seleccionado / esto es PERZE", no va.

El **color primario** es personalizable por household (`households.settings.primary`). Los roles secundario (aqua) y acento (naranja) **no** se personalizan: portan significado.

| Preset | Tinta dark | Tinta light | Relleno (ambos) |
|---|---|---|---|
| Violeta (default) | `#8B7CF6` | `#5D45E8` | `#6D55F0` |
| Azul | `#5FA3F0` | `#1C63BE` | `#2A78D6` |
| Ámbar | `#D9A21F` | `#8A6200` | `#A87400` |
| Magenta | `#E68BAE` | `#B33566` | `#C9457A` |

Los presets **evitan deliberadamente el aqua y el naranja**: colisionarían con la polaridad del dinero, que sí porta significado.

**La paleta de datos es fija: no cambia con el preset.** El slot 1 es siempre violeta, elija el household lo que elija. Así el color de una serie nunca cambia de significado por un ajuste de apariencia.

Consecuencia aceptada: con el preset por defecto el color de marca y el slot 1 de datos son el mismo violeta, y con el preset azul el color de marca coincide con el slot 4. No es un problema porque **el color de marca no aparece nunca dentro de un gráfico** (los botones, tabs y estados activos viven fuera del área de ploteo) y todo gráfico con dos o más series lleva leyenda. Lo que sí está prohibido es lo inverso: usar un color de datos para pintar un control.

### 2.4 Polaridad del dinero: ingreso vs. gasto

**No usar verde/rojo.** Es la elección más común y la peor: el par verde↔rojo cae en la banda de advertencia de daltonismo (ΔE 6.5).

| Rol | Dark | Light |
|---|---|---|
| Ingreso / positivo | aqua `#199E70` | `#0D7A58` |
| Gasto / negativo | **neutro** por defecto; naranja `#E06A35` solo cuando hay que destacar | neutro; `#B8451A` |

Verificado (dark, sin cambios): el par aqua↔naranja pasa todos los checks all-pairs (CVD ΔE **8.7**, visión normal 25.5, contraste ≥3:1).

**D6 (auditoría técnica, cerrado):** en claro, `#12916A`/`#D95926` daban 3,42:1/3,34:1 contra `--page` — es el único caso donde el color de esta tabla porta significado (polaridad), así que tenía que llegar a AA de texto (4,5:1), no solo al 3:1 de un ícono/swatch. Los valores de arriba (`#0D7A58`/`#B8451A`) ya son los corregidos — ambos ≥5,1:1 contra `--page` claro. Los números de ΔE/CVD del par en claro quedan para re-validar contra el nuevo par (no invalidan el fix: oscurecer un color solo puede separarlo más de su complementario, nunca menos).

Y siempre con **codificación secundaria**: signo `+`/`−`, flecha ↑↓ y posición. El color nunca porta el significado solo.

**Decisión minimalista importante:** en la lista de movimientos, los gastos van en **texto neutro primario**, no en naranja. Si el 90% de las filas son gastos, colorearlas todas es ruido puro. Solo los ingresos se destacan en aqua, porque son la excepción. El naranja se reserva para gráficos y para llamar la atención sobre un gasto puntual.

### 2.5 Estado (fijo en ambos modos, salvo `critical` — ver D7 abajo)

| Rol | Hex | Uso |
|---|---|---|
| good | `#0CA30C` | meta cumplida, dentro de presupuesto, sync ok |
| warning | `#FAB219` | 80% del presupuesto, cotización desactualizada — **solo ícono/tinte de fondo, nunca texto** (ver D4) |
| serious | `#EC835A` | recurrente que aumentó, anomalía detectada |
| critical | `#D03B3B` (claro) / `#E8615F` (oscuro) | presupuesto excedido, saldo proyectado negativo, error de sync |

Siempre con **ícono + label**. Nunca color solo. Nunca reutilizados como color de serie. El rojo **no** significa "gasto"; significa "problema".

**D4 (auditoría técnica, cerrado):** `--warning` (`#FAB219`) da 1,76:1 contra `--page` en modo claro — muy por debajo de AA (4,5:1) para texto. El componente (`Banner`, `NeedsFxBanner`) lo usa solo en el ícono y el tinte de fondo (`color-mix` al 12%); el texto del mensaje y del botón de acción van en `--text-primary`, que sí pasa AA en los dos modos.

**D7 (auditoría técnica, cerrado):** `#D03B3B` pasa AA en claro pero daba 3,58:1 contra Superficie 2 en oscuro (el modo por defecto de la app) — es el color de los mensajes de error de formulario a 12px. A diferencia de good/warning/serious, `critical` deja de ser "fijo en ambos modos": en oscuro usa `#E8615F` (5,2:1 contra Superficie 2), en claro sigue siendo `#D03B3B` sin cambios.

**Criterio para elegir el nivel** — es la pregunta "¿qué tiene que hacer el usuario?", no "¿qué tan grave suena?":

| Nivel | Significa | Ejemplo |
|---|---|---|
| **neutral** | Falta algo que se resuelve solo | "Sin sincronizar", "Falta tipo de cambio" |
| **warning** | Prestá atención | 80% del presupuesto consumido |
| **serious** | Algo cambió y te conviene mirarlo | Una suscripción aumentó de precio |
| **critical** | Algo está mal ahora | Presupuesto excedido, error de sync |

Falta un quinto nivel que no existe: **el neutro no lleva color**. Usa tinta secundaria sobre superficie 2, con ícono. Un dato pendiente en ámbar o naranja mentiría sobre su gravedad, y el ruido de un color que grita más de lo que pasa es el que hace que el usuario deje de mirar los colores.

**`critical` (estado) contra el naranja de polaridad — CON-28.** Son dos escalas distintas
que comparten familia de color por casualidad, no por relación semántica, y hay que
declararlo para que nadie las funda en una. `critical` (`#D03B3B`, rojo) es **estado**:
algo está mal *ahora* y requiere acción — presupuesto excedido, error de sync. El naranja de
polaridad (`--money-negative-emphasis`, § 2.3) es **polaridad**: un gasto puntual que se
quiere destacar dentro de la lectura neutra de "gasto = tinta neutra". Un gasto grande no es
un problema por ser grande — sigue siendo naranja de polaridad, nunca `critical`. Un
presupuesto excedido sí es un problema — es `critical`, con ícono y label, nunca solo un
monto en naranja. La pregunta que separa los dos casos: "¿esto es información sobre un
monto, o es una alerta sobre el estado del sistema?".

**Ascenso por antigüedad — la única excepción, y es una sola.** Si un movimiento lleva más de **7 días** con `needs_fx`, el badge sube de `neutral` a `warning`. El razonamiento: a esa altura ya dejó de ser "un dato que llega solo" y pasa a requerir que el usuario cargue el rate a mano. Ningún otro estado del sistema escala por tiempo — un movimiento sin sincronizar de hace un mes sigue siendo neutro, porque la app no puede hacer nada distinto y avisarlo no ayudaría.

### 2.6 Paleta de datos (validada)

Cinco slots, **orden fijo, nunca ciclado**. Cinco, no ocho: es una app minimalista y más de cinco series en un gráfico de móvil es ilegible igual.

| Slot | Hue | Dark | Light |
|---|---|---|---|
| 1 | violeta | `#8B7CF6` | `#5D45E8` |
| 2 | aqua (secundario) | `#199E70` | `#0D7A58` |
| 3 | naranja (acento) | `#E06A35` | `#B8451A` |
| 4 | azul | `#3987E5` | `#2A78D6` |
| 5 | magenta | `#D55181` | `#C9457A` |
| — | "Otros" | `#8E8E96` (D5) | `#6B6B71` (D5) |

**Validación completa** (superficies `#131315` dark / `#FFFFFF` light): `PASS` en los cinco checks, en ambos modos. Peor par adyacente CVD ΔE **8.7** dark / **9.6** light; visión normal **25.5** / **26.2**; los cinco superan 3:1 contra su superficie. Los tres primeros slots también pasan **all-pairs**, así que son los únicos habilitados para scatter, treemap y small multiples.

Reglas duras:

- **El color sigue a la entidad, nunca al ranking.** "Supermercado" es siempre el mismo slot, aunque un filtro la deje sola.
- **La sexta serie no existe**: se pliega a "Otros" en gris, o se factea.
- **Nunca eje dual.** Dos medidas de escalas distintas = dos gráficos o indexado a base común.
- **Un gráfico de una sola serie va en neutro o en el primario**, nunca en un color elegido "porque queda lindo".

### 2.7 Rampa secuencial y divergente

**Secuencial** (heatmap de calendario, treemap por magnitud): un solo hue, violeta, claro → oscuro. Nunca arcoíris.

| paso | hex | paso | hex | paso | hex |
|---|---|---|---|---|---|
| 100 | `#E1E3FF` | 300 | `#9C92FF` | 550 | `#4A30B4` |
| 150 | `#D2D3FF` | 350 | `#8A7BFF` | 600 | `#3B2395` |
| 200 | `#C4C3FF` | 400 | `#7964FF` | 650 | `#2D1975` |
| 250 | `#AFABFF` | 450 | `#6950EB` | 700 | `#21125B` |
| | | 500 | `#5A3FD0` | | |

El rango completo 100→700 es para codificación **secuencial continua** (el paso más claro significa "cerca de cero" y puede acercarse a la superficie). Para rampas **ordinales** discretas, el paso más cercano a la superficie debe superar 2:1: en claro no arrancar más claro que el **250** (2.08:1); en oscuro no ir más oscuro que el **550** (2.10:1).

**Divergente** (variación % mes a mes, efecto FX): **aqua ↔ naranja**, punto medio gris neutro. El punto medio usa el token de **borde/divisor** en ambos modos (`#2E2E33` dark / `#E4E4E1` light). Nunca un hue en el punto medio.

---

## 3. Tipografía

Una sola familia. El minimalismo tipográfico es la mitad del minimalismo visual.

| Rol | Fuente | Uso |
|---|---|---|
| Todo | **Geist Sans** (alternativa: Inter) | Interfaz, labels, cifras héroe |
| Columnas alineadas | **Geist Mono** con `tabular-nums` | Solo donde tenga que alinear verticalmente: filas de lista, ticks de eje, tablas |

**Tres pesos, no más:** 400 (cuerpo), 500 (labels y énfasis), 600 (cifras y títulos). Nada de 700+.

Escala (mobile) — **máximo 3 niveles visibles por pantalla**:

```
hero-xl   64 / 60   -2%    monto en el keypad
hero      40 / 44   -1.5%  cifra protagonista
title     22 / 28   -1%    título de pantalla
body      16 / 24    0     texto y filas
label     13 / 18   +1%    secundario
caption   11 / 16   +2%    uppercase, headers de sección
```

Las cifras héroe usan figuras proporcionales; `tabular-nums` se reserva para columnas.

**Cuándo `hero-xl` (64) en vez de `hero` (40) — CON-28.** La auditoría marcó J7 y H11
usándolo sin que ninguna regla lo explicara. La regla: `hero-xl` es solo para la cifra que
el usuario está **construyendo activamente en el momento** — el monto en el keypad de
captura (C1/C4/C5) y el rate en edición de `FxEditor`. `hero` es para toda cifra
**protagonista pero ya resuelta**: un saldo, un total, un patrimonio, el "cuánto me deben"
de J7. J7 y H11 muestran un cálculo ya hecho, no algo que el usuario está tipeando ahora
— van en `hero`, no en `hero-xl`; si aparecen en `hero-xl` hoy es una desviación a corregir
cuando se programen esas pantallas, no una segunda regla válida.

**Repetición del símbolo `$` en una lista — CON-28.** Dos convenciones convivían sin
decisión escrita. La que queda: **el símbolo se repite en cada fila** cuando la lista puede
mezclar monedas (cuentas de distintas monedas, movimientos en H con `needs_fx`, cualquier
lista que agregue con `NeedsFxBanner`) — sin el símbolo por fila, un ARS y un USD son
indistinguibles a simple vista. El símbolo **se omite y aparece una sola vez como header**
(o no aparece, si el título de la sección ya lo deja claro) cuando toda la lista está
garantizada en una sola moneda — la cuenta ya elegida, el detalle de una transacción. La
pregunta operativa es "¿puede esta lista, alguna vez, mezclar monedas?", no el tipo de dato.

---

## 4. Geometría y espacio

- Grid de 4px. Padding lateral de pantalla: **20px**. Separación entre bloques: 24px.
- Radios: `card 20` · `sheet 28 (solo arriba)` · `chip 999` · `button 16` · `input 14` · `keypad-key 20`
- **Sin sombras.** La jerarquía se construye con superficie + espaciado. Única excepción: sheets y el FAB llevan una sombra suave de 1 capa (`0 8px 32px rgba(0,0,0,.32)` en dark) para despegarse del contenido.
- **Bordes solo donde el espaciado no alcanza.** Un card sobre superficie 1 no necesita borde; un input sí.
- Sin separadores entre filas de lista: alcanza con el espaciado y la alineación.
- Tab bar 64px + safe area. FAB 64px, centrado, superpuesto.
- Zona del pulgar: los últimos 200px contienen toda acción primaria.

---

## 5. Motion

### 5.1 Curvas

```ts
export const spring = {
  snappy:  { type: 'spring', stiffness: 500, damping: 32, mass: 0.7 },  // chips, toggles, keypad
  default: { type: 'spring', stiffness: 400, damping: 30, mass: 1 },    // cards, listas
  soft:    { type: 'spring', stiffness: 260, damping: 26, mass: 1.1 },  // sheets, pantallas
  bouncy:  { type: 'spring', stiffness: 420, damping: 18, mass: 0.9 },  // solo celebraciones
} as const;

export const ease = { micro: 120, fast: 180, base: 240, slow: 320 } as const;
```

**Ninguna transición de interfaz supera 320 ms.** Una transición de interfaz es la que el usuario tiene que *esperar* para seguir operando: abrir una pantalla, un sheet, un tab, un estado.

Hay exactamente **cuatro excepciones documentadas**, todas de tipo "celebración o lectura", ninguna bloqueante — la UI ya es interactiva mientras corren:

| Excepción | Duración | Por qué |
|---|---|---|
| Count-up de cifra (odómetro) | 400 ms | Es lectura, no espera. El valor final ya está en el DOM. |
| Secuencia de guardado (botón → check → vuelo a la lista) | ≤ 700 ms | La transacción ya está guardada en el frame 1. |
| Celebración de hito | 900 ms | Descartable con cualquier toque. |
| Dibujado de línea en gráficos | 600 ms | Solo en la carga inicial de analytics. |

Cualquier otra cosa por encima de 320 ms es un bug de diseño.

### 5.2 Patrones

| Patrón | Especificación |
|---|---|
| **Press** | `scale: 0.96`, `spring.snappy`, haptic 8 ms. En todo lo tocable. |
| **Cifra que cambia** | Count-up de 400 ms `easeOutExpo`, ancho estable. Los dígitos que cambian rotan verticalmente (odómetro). |
| **Entrada de lista** | Stagger de 24 ms, `y: 12 → 0`, `opacity: 0 → 1`. Solo los primeros 8 items. |
| **Lista → detalle** | Shared element con `layoutId` (Motion) o `<ViewTransition>` de React 19.2. El monto y el ícono son los elementos compartidos. |
| **Bottom sheet** | Vaul con drag-to-dismiss, descarte a 500 px/s, `spring.soft`, backdrop de 0 → 60% de opacidad (oscurecer, no blurear). |
| **Keypad** | Dígitos entran desde abajo, stagger 12 ms. Al tocar, el dígito nuevo entra desde abajo del display y los anteriores se desplazan a la izquierda. |
| **Guardar transacción** | Botón se contrae a círculo (240 ms) → check dibujado con `pathLength` (200 ms) → la card vuela a la lista → toast con Deshacer. Total ≤ 700 ms, interactivo desde el primer frame. |
| **Anillos de progreso** | `pathLength` 0 → valor con `spring.soft`, delay de 100 ms. |
| **Gráficos** | Barras: `scaleY` desde la baseline, stagger 30 ms. Líneas: `pathLength` 0 → 1 en 600 ms `easeOut` — única excepción al techo, y solo en la carga inicial de analytics. |
| **Cambio de scope** | Crossfade de 180 ms + count-up de todas las cifras. Nunca un salto seco. |
| **Pull to refresh** | Elástico con resistencia, haptic al cruzar el umbral. |
| **Swipe en fila** | Resistencia; a 96px snap + haptic; a 160px ejecución directa al soltar. |
| **Celebración** | Solo en meta alcanzada, mes cerrado bajo presupuesto y primera transacción. 12 partículas, 900 ms. Nunca en el guardado común. |

### 5.3 Háptica

```
tap 8ms · select [12] · success [10,40,20] · warning [20,60,20] · error [40,80,40]
```

`navigator.vibrate` con feature-detect. En iOS no existe: fallback a respuesta visual.

### 5.4 Reduced motion — obligatorio

`useReducedMotion()` + ajuste propio de intensidad: **Completa / Reducida / Mínima**.

- **Reducida**: sin stagger, sin count-up, sin celebraciones. Transiciones a 120 ms.
- **Mínima**: solo crossfades de opacidad de 100 ms. Cero transform.

Nada de la funcionalidad depende de una animación.

---

## 6. Componentes propios (más allá de shadcn)

| Componente | Descripción |
|---|---|
| `<Amount>` | Único lugar donde se formatea plata: signo, símbolo, decimales por moneda, color por polaridad, variante de tamaño, `tabular-nums` opcional, modo privacidad (blur). |
| `<Keypad>` | Teclado numérico de pantalla completa. Teclas 64px, dígitos 32px, `+ − × ÷`, backspace con long-press para limpiar, haptic por tecla. |
| `<AmountScrubber>` | La cifra es arrastrable horizontalmente: ± con aceleración por velocidad (`@use-gesture`). |
| `<CurrencyChip>` | Solo el código ISO — cero banderas (CON-30). Tap abre selector. |
| `<FxEditor>` | Rate sugerido grande, fuente y fecha, slider fino ±5%, tap para keypad, badge si el dato está viejo. |
| `<CategoryBubble>` | Círculo de 64px, ícono neutro, label debajo. Seleccionado = anillo violeta animado. |
| `<AccountCarousel>` | Carrusel horizontal con snap: saldo, institución, moneda, país. |
| `<DateStrip>` | Tira horizontal de días con snap. "Hoy"/"Ayer" nombrados. Long-press abre calendario. |
| `<TransactionRow>` | Ícono, comercio, cuenta, monto. Swipe izq = borrar, der = editar. |
| `<BudgetRing>` | Anillo de progreso; sobre-consumo con arco superpuesto en critical + ícono. |
| `<SplitBar>` | Barra dividida arrastrable para repartir entre miembros o categorías. |
| `<SyncDot>` | 6px en el header. Tres estados, canónicos: **sincronizado** = texto muted (no verde: "todo bien" es el caso normal y no merece color) · **sincronizando** = `warning` pulsante · **offline con pendientes** = `warning` fijo + contador. El error de sync no vive acá: es un banner con `critical`. |
| `<PrivacyBlur>` | Envuelve montos; con modo privacidad aplica `blur(8px)` y bloquea selección. |
| `<InsightCard>` | Ícono de estado, una línea de texto, sparkline opcional, una acción. Descartable con swipe. |
| `<ScopeSwitcher>` | Pill segmentado: Personal / Compartido / Todo. |
| `<StatTile>` | KPI: label en caption, cifra en hero, delta con signo y flecha. Sin borde, sin ícono. |

---

## 7. Reglas de gráficos

- **Marcas finas.** Barras con extremo redondeado de 4px anclado a la baseline. Líneas de 2px. Markers ≥ 8px.
- **Separador de 2px del color de superficie** entre segmentos apilados y barras adyacentes; anillo de 2px en marcas que se solapan.
- **Grilla recesiva**: hairline, solo horizontal, sin bordes de caja, sin fondo de gráfico distinto al card.
- **Leyenda siempre con ≥ 2 series**; con ≤ 4, además label directo. Una sola serie: sin leyenda, el título la nombra.
- **Nunca un número sobre cada punto.** Labels directos selectivos: primero, último, máximo, mínimo.
- **El texto usa tokens de tinta, nunca el color de la serie.** El chip de color al lado porta la identidad.
- **Interacción por defecto**: crosshair + tooltip en líneas y áreas; tooltip por marca en barras y celdas. En mobile el tooltip sigue el dedo con offset vertical de 48px.
- **Vista de tabla disponible** en todo gráfico de analytics (toggle en el header de la card).
- **Textura** (líneas a 45°/135°) desde el ajuste de accesibilidad, en impresión y en `forced-colors`. Nunca decorativa.

---

## 8. Navegación

```
Tab bar (5 slots, el central es el FAB)
┌──────────────────────────────────────────┐
│  Inicio   Movim.   [ + ]   Análisis   Más │
└──────────────────────────────────────────┘
```

- **Inicio** — dashboard
- **Movimientos** — lista con búsqueda y filtros
- **[+]** — FAB, abre Quick Add como route interceptada (URL propia, back nativo)
- **Cuarto slot** — configurable por el usuario (ver abajo). Default: **Análisis**
- **Más** — índice de secciones, nunca un menú hamburguesa

Los módulos apagados no aparecen en ningún lado, y su código no llega al bundle.

### El cuarto slot lo elige el usuario

Los tres primeros slots y "Más" son fijos. El cuarto es un ajuste: **Análisis** (default), **Inversiones**, **Cuentas** o **Presupuestos** — solo se ofrecen los que estén activos.

**La app nunca reconfigura la navegación sola.** Activar el módulo de inversiones no desplaza a Análisis: muestra un aviso, una sola vez y descartable, diciendo que se puede poner Inversiones en la barra desde Ajustes. Lo que no está en el cuarto slot vive en "Más" y cuesta un tap.

El razonamiento: una barra de navegación que cambia de forma según un ajuste que tocaste hace tres semanas es el peor tipo de sorpresa — el usuario busca algo donde estaba y no está. Que el cambio lo haga él elimina el problema sin quitarle el control.

**Header** compacto de 56px, colapsable con el scroll: `[scope switcher] — [título] — [búsqueda] [SyncDot]`. Sin sombra, sin borde: se separa por espaciado.

**Desktop** (≥1024px): sidebar fijo de 240px, dos columnas (lista + detalle), command palette con ⌘K. No se rediseña: se expande.

---

## 9. Estados obligatorios por pantalla

Los cinco, siempre:

1. **Vacío** — un ícono de línea, una frase, una acción. Nunca "No hay datos".
2. **Carga** — skeleton que respeta la forma real. Cero spinners de pantalla completa.
3. **Error** — qué pasó, qué hacer, reintentar. Nunca un stack trace.
4. **Offline** — banner discreto, la app sigue funcionando, contador de pendientes.
5. **Con datos** — el estado feliz.
