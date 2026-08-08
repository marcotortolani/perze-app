# 00 — Producto: análisis, alcance y features

> Documento base. Todo lo demás (schema, design system, prompts) deriva de acá.
> Nombre de trabajo: **PERZE** — reemplazalo antes de usar los prompts.
> Sugerencias de nombre: *Ledger*, *Kaja*, *Neto*, *Contable*, *Saldo*, *Pesos*, *Bolsillo*, *Arca*.

---

## 1. Tesis del producto

Una app de finanzas personales **multi-cuenta / multi-moneda / multi-país**, PWA, offline-first, donde:

1. **Registrar un gasto cuesta menos de 5 segundos y 3 taps.** Todo lo demás es secundario. Si la captura falla, la app muere: nadie mantiene una app de gastos que se siente como llenar un formulario.
2. **La configuración escala con el usuario, no al revés.** El que tiene una cuenta y una moneda no ve nunca la palabra "tipo de cambio". El que tiene cuentas en 3 países con 4 monedas tiene todas las herramientas.
3. **Los módulos pesados son opcionales.** Son exactamente seis — presupuestos, metas, recurrentes, deudas, inversiones y grupo familiar — y esa lista es canónica: es la que vive en `households.enabled_modules`. Se activan desde ajustes y desaparecen por completo de la navegación si están apagados.
4. **La interfaz es física, no burocrática.** Nada de `<input type="number">` + teclado del sistema. Keypads propios, scrubbing, carruseles con snap, springs, haptics.

### Los tres perfiles que tiene que servir sin fricción

| Perfil | Configuración | Qué NO debe ver nunca |
|---|---|---|
| **Simple** | 1 país, 1 moneda, 1–2 cuentas | FX, monedas, países, inversiones, miembros |
| **Multi-moneda** (vos) | 2–3 países, 3–4 monedas, cuentas bancarias + billeteras + efectivo + broker, pareja | — |
| **Inversor** | Todo lo anterior + portfolio con acciones, CEDEARs, bonos, ONs, crypto, clases de activo propias | — |

**Regla de diseño derivada:** el modelo de datos es siempre completo; la UI es progresiva. Con una sola moneda en uso, la transacción igual guarda `currency`, `amount_base` y `fx_rate = 1` **con `fx_source = 'identity'`** — que es un 1 legítimo porque la moneda del movimiento es la moneda base, y por eso lleva su propio `fx_source`. Es lo contrario del 1 inventado que la regla de `needs_fx` prohíbe: cuando no hay cotización disponible, `fx_rate` y `amount_base` van en `NULL` con `fx_source = 'pending'`, nunca en 1. Distinguir los dos casos es exactamente para lo que existe `fx_source`. El día que el usuario agrega una segunda moneda, el histórico ya es consistente.

---

## 2. Decisiones de arquitectura de producto que dan robustez

Estas son las que separan una app de gastos de juguete de una que aguanta 5 años de datos.

### 2.1 El dinero se guarda en tres capas, siempre

Cada movimiento guarda:

```
amount_original   +   currency_original   +   fx_rate (congelado)   =   amount_base
```

- `amount_base` es en la **moneda base del household** y se **congela al momento de la transacción**. Nunca se recalcula.
- `fx_rate` guarda además su **origen** (`api` / `manual` / `heredado`) y **qué cotización** (oficial, blue, MEP, CCL, custom). En Argentina esto no es un detalle: el mismo gasto vale dos cosas distintas según qué dólar uses.
- El usuario ve el rate **sugerido por API** y puede pisarlo. Si lo pisa, queda marcado como `manual` y no se toca nunca más.

**Por qué importa:** sin esto, un cambio de cotización te reescribe la historia y todos tus gráficos mienten retroactivamente.

### 2.1.b El movimiento se guarda aunque no haya tipo de cambio

Si cargás un gasto en una moneda que nunca cotizaste y estás sin conexión, no hay rate posible. Las dos salidas obvias son malas: bloquear el guardado hace que el usuario pierda lo que cargó —lo único que la app no puede hacer nunca—, y guardar con rate 1 corrompe el patrimonio de forma permanente y silenciosa.

El movimiento se guarda **sin conversión**. Existe, con su monto y su moneda reales; lo único que le falta es la traducción. El saldo de la cuenta funciona normal, porque está en la moneda de la cuenta. Lo que se excluye —con aviso y conteo visible, nunca en silencio— es el patrimonio, los presupuestos y los agregados de análisis. Al recuperar conexión se resuelve solo; si no puede, hay una pantalla de resolución en lote.

Detalle de implementación en `01-arquitectura-datos.md` § 2.5.

### 2.2 Dos lentes de conversión, explícitas

La app puede mostrar el mismo dato de dos formas y hay que dejar elegir:

- **Histórica** — "gasté el equivalente a USD 40 ese día". Es la verdad contable.
- **Actual** — "eso hoy serían USD 32". Sirve para comparar períodos con devaluación de por medio.

Un toggle en Analytics. Por defecto: histórica.

### 2.3 Montos como enteros, nunca floats

`bigint` en unidades mínimas (centavos) + `decimals` por moneda. Para crypto y cantidades de instrumentos, `numeric(38,12)`. Cero `float`. Cero `parseFloat` en el cliente.

### 2.4 Transferencias con dos lados, no dos transacciones

Una transferencia entre una cuenta en UYU y otra en USD es **una sola fila** con dos lados: monto y moneda de salida, monto y moneda de entrada, y el rate implícito entre ambos. No son dos transacciones enlazadas ni un ledger de doble entrada completo.

Por qué esta forma y no un ledger clásico:

- Con dos filas enlazadas, borrar una deja la otra huérfana y los totales mienten. Con una fila, es atómico.
- Las transferencias no ensucian los totales de gasto/ingreso: se excluyen por `kind`, no por convención.
- Un ledger de doble entrada real (tabla `entries` con débitos y créditos) es más correcto contablemente y bastante más caro de consultar en móvil. Para finanzas personales el costo no se paga.

Los repartos sí van en tablas aparte: `transaction_splits` (entre categorías) y `transaction_shares` (entre miembros), ambas colgando de la transacción.

### 2.5 Offline-first real

- IDs generados en el cliente (UUID v7) → idempotencia y cero conflictos de PK.
- Cola de mutaciones en IndexedDB, replay al reconectar.
- `updated_at` + `client_rev` para resolución de conflictos (last-write-wins por campo, con log).
- La UI es **optimista siempre**: la transacción aparece en la lista antes de que el servidor conteste.

### 2.6 Privacidad dentro del grupo familiar

Cada cuenta y cada transacción tiene `visibility`: `private` | `household`. Compartir finanzas con tu pareja no puede significar que todo sea público. Y un **scope switcher** global en el header: *Personal / Compartido / Todo*.

### 2.7 Saldos: snapshot + delta

Recalcular el saldo sumando 30.000 transacciones cada vez que abrís la app es inviable. `accounts.current_balance` mantenido por trigger + `account_balance_snapshots` diarios para los gráficos históricos.

### 2.8 Soft delete + audit log

En un household compartido, "¿quién borró esto?" es una pregunta que se hace tarde o temprano. Nada se borra duro; todo queda en `audit_log`.

---

## 3. Mapa de funcionalidades

### 3.1 Núcleo (v1, obligatorio)

- **Captura rápida** de gasto / ingreso / transferencia
- **Cuentas** — nueve tipos, lista canónica: efectivo, caja de ahorro, cuenta corriente, tarjeta de crédito, billetera virtual, broker, préstamo (debo), por cobrar (me deben), otro
- **Multi-moneda y multi-país** con FX sugerido + editable
- **Categorías y subcategorías** editables, con plantillas por defecto
- **Tags** transversales (independientes de la categoría)
- **Lista de transacciones** con búsqueda, filtros y agrupación por día
- **Adjuntos** (foto de ticket) en Supabase Storage
- **Dashboard** con patrimonio neto, cashflow del mes y últimos movimientos
- **PWA instalable**, offline-first
- **Import/export** CSV + backup JSON completo (requisito ético para algo open source: los datos son del usuario)

### 3.2 Módulos activables

| Módulo | Qué agrega |
|---|---|
| **Presupuestos** | Límites por categoría, período mensual/semanal/custom, rollover opcional, "safe to spend" diario |
| **Metas de ahorro** | Objetivos con monto, fecha, cuentas vinculadas, proyección de llegada |
| **Recurrentes y suscripciones** | Reglas RRULE, auto-post opcional, calendario de próximos, detección automática de suscripciones |
| **Deudas y cuotas** | Planes de cuotas (tarjeta), préstamos con amortización, calendario de vencimientos, deuda futura comprometida |
| **Inversiones** | Portfolios, clases de activo definidas por el usuario, operaciones, precios, rendimiento |
| **Grupo familiar** | Miembros, roles, gastos compartidos, liquidación entre personas |

Cada módulo apagado **no aparece en ningún lado**: ni en el tab bar, ni en los ajustes de la transacción, ni en analytics. Y su código no llega al bundle.

### Apagar un módulo que ya se usó

Apagar **oculta, nunca borra**. Es la promesa que hace que activar un módulo no dé miedo.

| Qué pasa con… | Regla |
|---|---|
| Los datos del módulo | Se quedan intactos. Al reactivar, todo vuelve como estaba |
| Presupuestos vigentes | Se congelan: no se evalúan, no notifican, no aparecen en el home |
| **Cuotas en curso** | **Siguen impactando el saldo.** Ya generaron movimientos reales, y los movimientos no pertenecen al módulo — pertenecen a la cuenta. Apagar "Deudas" oculta el plan de pagos, no hace desaparecer la plata que sale todos los meses |
| Metas con progreso | Congeladas, sin notificar |
| Posiciones de inversión | Salen del patrimonio neto, con aviso del monto excluido |
| Movimientos históricos | **Nunca se tocan.** Un gasto es un gasto, exista o no el módulo que lo categorizó |

La advertencia al apagar dice exactamente esto, en una línea por punto afectado y con los números reales del usuario: *"Se van a ocultar 3 presupuestos y 2 metas. Las 8 cuotas pendientes van a seguir descontándose de tus cuentas. Nada se borra."*

### Cuánto historial necesita cada análisis

Un gráfico vacío o con dos puntos es peor que no mostrarlo: enseña una tendencia que no existe. Cada análisis declara su mínimo y, hasta alcanzarlo, muestra cuánto falta en vez del gráfico.

| Análisis | Mínimo | Por qué |
|---|---|---|
| Patrimonio neto | 7 días | Necesita al menos una semana para que la línea signifique algo |
| Categorías, Flujo (Sankey), Comercios | 1 período cerrado | Sin un mes completo la distribución miente |
| Tendencias, Calendario | 30 días | Es el mínimo para hablar de tendencia |
| Presupuesto vs. real | 1 período cerrado | Comparar contra un mes en curso no es comparar |
| Inflación, multi-moneda | 2 meses | Necesita dos puntos de índice |
| Estacionalidad | 12 meses | Por definición |
| Año contra año | 13 meses | Para tener el mismo mes del año anterior |
| Anomalías | 20 movimientos en la categoría | Bajo eso no hay baseline, solo ruido |
| Rendimiento de inversiones (XIRR) | 2 flujos y 30 días | Sin dos flujos no hay tasa que calcular |

**Análisis no es un módulo.** Es un tab fijo. Lo que varía es su contenido: los análisis que dependen de un módulo apagado simplemente no se listan, y los que necesitan historial aparecen recién cuando hay datos suficientes.

### 3.3 Captura rápida — especificación

La acción más frecuente merece su propia ingeniería.

**Objetivo: < 5 segundos y 3 decisiones para el 80% de los gastos.**

Una aclaración sobre la métrica, porque "3 taps" se presta a engaño: escribir *1.250* son cuatro taps más que nadie va a evitar, en esta app ni en ninguna. Lo que sí se puede diseñar es la cantidad de **decisiones** —cuánto tiene que pensar el usuario— y el **tiempo total**. Los tres taps del camino feliz (FAB → monto → chip de frecuente) son el proxy, no la meta. La meta es el reloj.

**El caso del viaje.** Si el dispositivo detecta que estás en otro país, aparece un chip para cambiar la moneda del movimiento —un chip, nunca un modal—. Para alguien que cruza a Buenos Aires seguido esto no es un borde: es el caso de uso. Ver también `2.1.b`: si no hay cotización disponible, el gasto se guarda igual.

Entradas posibles:

1. FAB en el home (thumb zone, 64px)
2. **Shortcut de la PWA** (long-press en el ícono → "Nuevo gasto")
3. **Share target**: compartir un monto/texto desde otra app
4. **Widget de notificación persistente** (Android) con acción directa
5. Command palette (⌘K en desktop)
6. **Voz**: "gasté mil doscientos en el súper" → parseo con Web Speech API

Orden de captura, invariante: **monto → categoría → guardar**. Todo lo demás tiene default inteligente y vive en una sección "Detalles" colapsada.

Defaults inteligentes:

- Cuenta: la más usada en esa categoría, o la última usada
- Moneda: la de la cuenta (y si el dispositivo detecta otro país, se ofrece cambiar con un chip, no con un modal)
- Fecha: hoy
- Categoría: fila de chips de **frecuentes ponderadas por hora del día** (a las 13:00 aparece primero "Almuerzo", a las 21:00 "Delivery")
- Comercio: autocompletado con los últimos, y cada comercio recuerda su categoría

Interacciones clave:

- **Keypad propio**: dígitos de 32px en botones de 64px, `tabular-nums`, haptic de 8ms por tap, animación de entrada por dígito desde abajo
- **Operaciones inline**: `+` `−` `×` `÷` en el keypad para sumar varios tickets sin salir
- **Guardar** = botón de ancho completo, 60px de alto, en la zona del pulgar. Alternativa: swipe-up sobre el monto.
- **Modo ráfaga**: switch "seguir cargando" que resetea el form y mantiene cuenta/fecha
- **Undo**, no confirmación: se guarda, aparece un toast con "Deshacer" por 5 s. Cero diálogos de "¿estás seguro?"

### 3.4 Inputs sin teclado tradicional — catálogo

| Dato | Control |
|---|---|
| Monto | Keypad propio de pantalla completa, cifra gigante arriba |
| Ajuste fino de monto | **Scrub horizontal** sobre la cifra (drag = ±) |
| Cantidad / porcentaje | Stepper con drag continuo + aceleración |
| Fecha | Carrusel horizontal de días con snap (Hoy / Ayer / …) + calendario solo si te vas lejos |
| Categoría | Grid de burbujas con ícono y color, 3 columnas, con búsqueda por escritura opcional |
| Cuenta | Carrusel de tarjetas tipo wallet, snap, con saldo visible |
| Moneda | Chips con bandera + código |
| Tipo de cambio | Valor sugerido grande + slider fino de ±5% + tap para keypad |
| Monto de presupuesto | Dial radial / arco arrastrable |
| Rango de fechas en analytics | Pills de período (Mes / 3M / Año / Todo) + brush sobre el gráfico |
| Split entre miembros | Barra dividida arrastrable (como partir una torta) |
| Allocation objetivo | Barras apiladas arrastrables que suman 100% |

**Prohibido en toda la app:** `<select>` nativo, botones < 44px, tablas densas en mobile, diálogos de confirmación para acciones reversibles, spinners centrados a pantalla completa.

---

## 4. Analítica: indicadores, gráficos y estadística

Esto es lo que le da profundidad al producto. Ordenado por nivel de sofisticación.

### Nivel 1 — Salud financiera básica

- **Patrimonio neto** (activos − pasivos) y su serie temporal
- **Cashflow mensual**: ingresos − egresos − transferencias internas. **"Egresos" incluye compras
  de instrumentos, "Gastos" no** (`src/lib/analytics/cash-flow.ts`): comprar acciones es plata real
  que sale de la misma cuenta que financia el resto del mes, así que cuenta en el cashflow y en la
  tira de período — pero no es consumo, así que no cuenta en presupuestos, gasto por categoría ni
  en el mapa de calor del calendario, que siguen midiendo "Gastos" en el sentido estricto.
- **Tasa de ahorro** (%) mensual y promedio móvil 3/6/12 meses
- **Safe to spend**: cuánto te queda por día hasta fin de período, considerando recurrentes pendientes
- **Runway / colchón**: meses que sobrevivís con el efectivo actual al gasto promedio
- **Burn rate del mes** vs. ritmo proyectado (¿vas adelantado o atrasado respecto del presupuesto?)

### Nivel 2 — Comportamiento

- **Fijo vs. variable vs. discrecional** (clasificación por categoría, editable)
- **Top comercios y categorías**, con delta vs. período anterior
- **Mes vs. mes** y **mismo mes del año anterior**
- **Gastos hormiga**: transacciones bajo un umbral, agregadas — "142 cafés = USD 380 este año"
- **Goteo de suscripciones**: recurrentes detectados automáticamente, con alerta de aumentos de precio y de servicios que dejaste de usar
- **Estacionalidad**: qué meses históricamente te salen más caros
- **Heatmap día × hora**: cuándo gastás
- **Anomalías**: transacción > 2σ del baseline de su categoría → insight card
- **Cuotas comprometidas**: cuánto de tus próximos 12 meses ya está gastado

### Nivel 3 — Multi-moneda y multi-país (diferencial)

- **Exposición por moneda**: % del patrimonio en cada una, con gráfico de área apilada en el tiempo
- **Impacto FX**: cuánto ganaste o perdiste en moneda base **sin hacer nada**, solo por movimiento del tipo de cambio. Se descompone: `Δ patrimonio = flujo neto + retorno de inversiones + efecto FX`
- **Gasto en USD constantes**: la única forma honesta de comparar 2024 vs. 2026 en Argentina
- **Gasto real vs. nominal** (ajustado por IPC del país de la cuenta)
- **Distribución por país** de activos y gastos
- **Comparador de cotizaciones**: qué te habría convenido usar (oficial vs. MEP vs. blue) en cada operación

### Nivel 4 — Inversiones

- **Valor de portfolio**, P&L realizado y no realizado, por posición y total
- **TWR** (time-weighted return, mide al instrumento) y **MWR / XIRR** (money-weighted, mide tus decisiones de timing). Mostrar los dos y explicar la diferencia en un tooltip — casi ninguna app lo hace bien.
- **Asset allocation** por clase, moneda, país, sector, emisor
- **Benchmarks**: vs. S&P 500, vs. dólar (blue/MEP), vs. plazo fijo, vs. inflación. La comparación contra inflación local es la que realmente importa en la región.
- **Yield on cost** y **dividendos/cupones cobrados** por año
- **Calendario de renta futura**: cupones y amortizaciones proyectadas de bonos y ONs — muy relevante para ONs argentinas
- **Concentración**: peso de las top 5 posiciones, índice Herfindahl
- **Drawdown** máximo e histórico
- **Rebalanceo**: allocation objetivo vs. real, con las operaciones sugeridas para cerrar la brecha
- **Costo total**: comisiones + impuestos acumulados como % del portfolio

### Nivel 5 — Proyección y simulación

- **Proyección de saldo** a 30/60/90 días con recurrentes y cuotas conocidas
- **Alerta de saldo insuficiente** antes de que pase
- **Simulador what-if**: "si dejo de gastar X en Y, ¿cuándo llego a la meta?"
- **Progreso de metas** con fecha estimada de llegada y ritmo requerido
- **Proyección de patrimonio** con supuestos de retorno y aporte (Monte Carlo simple)

### Catálogo de gráficos

| Gráfico | Dónde | Por qué |
|---|---|---|
| **Sparkline** de patrimonio | Header del home | Contexto sin ocupar espacio |
| **Donut / treemap** de categorías | Analytics → Categorías | Treemap escala mejor con muchas categorías |
| **Barras apiladas** ingresos/gastos por mes | Tendencias | Lectura instantánea de meses en rojo |
| **Sankey** de flujo de dinero | Analytics → Flujo | *La* visualización que la gente comparte. Ingreso → cuentas → categorías |
| **Calendar heatmap** de gasto diario | Analytics → Calendario | Patrones de hábito |
| **Waterfall** de cambio de patrimonio | Patrimonio neto | Descompone el Δ en flujo / retorno / FX |
| **Área apilada** de allocation | Inversiones y Monedas | Deriva de composición en el tiempo |
| **Anillos de progreso** | Presupuestos, metas | Legibles, animables, "juicy" |
| **Bullet chart** | Presupuesto vs. real | Más denso y honesto que una barra sola |
| **Línea con banda** | Rendimiento vs. benchmark | Banda = rango de escenarios |

Base: **shadcn/ui charts (Recharts)** para el 80%. **visx** o **nivo** para Sankey, treemap y heatmap. Todos los gráficos con animación de entrada y touch tooltip (no hover).

### Insights automáticos (motor de reglas)

Cards generadas periódicamente, mostradas en el home y en el resumen semanal:

- "Gastaste 34% más en Restaurantes que tu promedio de 6 meses"
- "Detectamos una suscripción nueva: Spotify, USD 6/mes"
- "Netflix aumentó de $2.400 a $3.100"
- "Tu exposición a pesos subió del 20% al 41% este trimestre"
- "A este ritmo, superás el presupuesto de Supermercado el día 22"
- "Llevás 14 días seguidos registrando"

### Momentos de recompensa

- **Racha** de días registrando (sutil, sin culpa: nunca "perdiste tu racha")
- **Resumen semanal** — card animada los domingos
- **Wrapped mensual y anual** — pantalla completa, animada, exportable como imagen. Es la feature que hace que alguien recomiende la app.
- **Micro-celebraciones** al cerrar un mes bajo presupuesto o alcanzar una meta. Confetti sutil, solo en hitos reales.

---

## 5. Consideraciones para que sirva a cualquiera (open source)

Como en algún momento lo vas a liberar:

- **i18n desde el día 1** (ES / EN / PT). Ninguna string hardcodeada.
- **Localización real**: separador decimal, formato de fecha, primer día de la semana, primer día del período (hay quien cierra el mes el día que cobra, no el 1).
- **Sin dependencia de un país**: los presets de bancos/billeteras y las fuentes de FX vienen de una tabla de datos, no del código. Sumar Colombia = un JSON, no un PR al core.
- **Sin lock-in**: export completo en un formato documentado. Import desde CSV genérico + mapeo de columnas guiado.
- **Self-hostable**: migraciones de Supabase versionadas, `.env.example` completo, docker-compose para desarrollo local.
- **Accesibilidad**: contraste AA, `prefers-reduced-motion`, navegación por teclado en desktop, screen readers en los flujos críticos. Verde/rojo **nunca** como único portador de significado — siempre acompañado de signo o ícono.
- **Privacidad**: cero analytics de terceros por defecto. Modo privacidad que difumina los montos (para abrir la app en el colectivo).
- **Bloqueo por PIN o biometría: opcional y apagado por defecto.** Cuando está encendido, la **captura queda en zona pre-auth**: podés cargar un gasto desde el shortcut de la PWA, el share target o el widget sin desbloquear, pero ver saldos, movimientos o análisis lo pide. El criterio es que escribir no revela nada y leer sí. Sin esta separación, el bloqueo mata los 5 segundos y con ellos el hábito, que es lo único que sostiene una app de gastos.
- **Licencia**: MIT o AGPL según cuánto te importe que alguien lo cierre y lo venda.

---

## 6. Roadmap sugerido por fases

| Fase | Contenido | Criterio de salida |
|---|---|---|
| **F0 — Fundaciones** | Auth, household, cuentas, monedas, schema, RLS, PWA shell | Podés crear una cuenta y ver saldo 0 |
| **F1 — Captura** | Quick Add completo, keypad, categorías, lista de transacciones, offline queue | Cargás 20 gastos sin abrir el teclado del sistema |
| **F2 — Multi-moneda** | FX API + override, transferencias entre monedas, conversión a base | El dashboard suma cuentas en 3 monedas correctamente |
| **F3 — Análisis v1** | Dashboard, categorías, tendencias, patrimonio neto | Ves de dónde vino y adónde fue la plata del mes |
| **F4 — Presupuestos y recurrentes** | Budgets, safe-to-spend, suscripciones, cuotas | Te avisa antes de pasarte |
| **F5 — Grupo familiar** | Miembros, visibilidad, splits, liquidación | Vos y tu pareja usan la misma instancia |
| **F6 — Inversiones** | Portfolios, operaciones, precios, rendimiento | Ves tu portfolio y su P&L |
| **F7 — Análisis avanzado** | Sankey, inflación, exposición FX, insights, Wrapped | La app te dice algo que no sabías |
| **F8 — Open source** | i18n, docs, self-host, import genérico, licencia | Alguien que no sos vos la instala |

---

## 7. Riesgos y decisiones abiertas

| Riesgo | Mitigación |
|---|---|
| Sobre-ingeniería del modelo antes de tener un usuario | F0–F2 con el schema completo pero UI mínima. El schema es caro de cambiar; la UI no. |
| Las APIs de cotización se caen o cambian | Nunca en el camino crítico. Cache en tabla `fx_rates` + último valor conocido + override manual siempre disponible. La app funciona sin internet. |
| Datos de mercado argentinos son frágiles/no oficiales | Precio manual siempre posible. El proveedor es una columna, no un supuesto. |
| Free tier de Supabase (proyectos pausados por inactividad, límites de storage) | Un cron de keep-alive; adjuntos comprimidos client-side; snapshots agregados en vez de guardar todo crudo. |
| Storage: adjuntos y audit log crecen sin techo, y en self-host el techo lo pone el dueño | Adjuntos comprimidos en el cliente antes de subir (~200 KB por foto de ticket), cuota por household con aviso al 80% y al 95%, y purga del audit log a los 12 meses salvo las entradas de borrado y de cambio de permisos, que son justamente las que se consultan tarde. Los tres son variables de entorno. |
| El módulo de inversiones se come el roadmap | Está en F6 a propósito. La app tiene que ser buena de gastos primero. |
| **La cuenta broker nace en cero y la primera compra la deja en negativo** | Al activar inversiones sin cuenta de tipo broker, se crea en el mismo paso y se pide saldo inicial ahí mismo. El estreno de un módulo no puede terminar con un número en rojo sin explicación. |
| **Transferir a la cuenta de tu pareja: ¿transferencia o liquidación?** | Con el grupo familiar activo los dos flujos existen y se pisan. Regla: si la cuenta destino pertenece a otro miembro y hay saldo pendiente entre ustedes, la app **ofrece** imputarlo como liquidación; si no, es una transferencia común. Nunca lo decide sola. |
| **Movimientos de un miembro que se fue del household** | Se quedan, con su autoría intacta — borrarlos falsearía el histórico. El miembro pasa a estado `former` y no puede volver a leer nada. Antes de salir, `J10` exige liquidar o condonar los saldos pendientes. |
| "Juicy" mal calibrado = lento y molesto a los 3 meses | Toda animación ≤ 320ms, `prefers-reduced-motion` respetado, y un ajuste de "intensidad de animación" (Completa / Reducida / Mínima). |
