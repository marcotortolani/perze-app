# 03 — Prompts de wireframe (mapa completo)

## Cómo usar este archivo

1. **Pegá siempre el `PROMPT 0` primero** en cada sesión nueva de diseño. Es el contexto maestro. Si la herramienta soporta "conocimiento del proyecto" o instrucciones persistentes, ponelo ahí una sola vez.
2. Corré **`PROMPT W0`** (mapa y flujos) antes que cualquier pantalla. Su salida es el contrato que van a respetar los demás.
3. Después, los bloques **W1 → W10** en orden. Cada uno es independiente pero asume el contexto del `PROMPT 0` y el mapa de `W0`.
4. Cerrá con **`PROMPT WV`** (auditoría) antes de pasar a alta fidelidad.

La app se llama **PERZE**. El wordmark es tipográfico: Geist Sans 600 con tracking −2%, sin símbolo dibujado.

Los wireframes son de **baja fidelidad a propósito**: grises, sin color de marca, sin ilustraciones, sin sombras. El objetivo de esta fase es resolver *estructura, jerarquía, flujo y estados*, no estética. Si en esta fase discutís colores, perdiste el foco.

---

## PROMPT 0 — Contexto maestro (pegar siempre primero)

```text
Vas a ayudarme a diseñar PERZE, una app de finanzas personales.

## Qué es
PWA mobile-first de control de gastos, cuentas, presupuestos e inversiones, con
soporte multi-cuenta, multi-moneda y multi-país, y modo de grupo familiar. Es un
proyecto personal que después se va a liberar como open source, así que tiene que
servir tanto a alguien con una sola cuenta y una sola moneda como a alguien con
cuentas en tres países y un portfolio de inversiones.

## Stack (para que el diseño sea implementable)
Next.js 16 (App Router), TypeScript strict, Tailwind CSS v4, componentes shadcn/ui
customizados, Motion (ex Framer Motion) para animación, Supabase (Postgres + Auth +
Storage), PWA offline-first.

## Los tres perfiles de usuario que hay que servir
1. SIMPLE — 1 país, 1 moneda, 1-2 cuentas. Después del onboarding nunca debe ver
   las palabras "tipo de cambio", "moneda base", "conversión", "portfolio" ni
   "miembros". En el onboarding la moneda se pregunta una vez y se llama "tu
   moneda", no "moneda base": el concepto de moneda base solo aparece cuando hay
   más de una moneda en juego.
2. MULTI-MONEDA — 2-3 países, 3-4 monedas, cuentas bancarias + billeteras +
   efectivo + broker, comparte finanzas con su pareja.
3. INVERSOR — todo lo anterior más un portfolio con acciones, CEDEARs, bonos, ONs,
   crypto y clases de activo que define él mismo.

Regla derivada: el modelo de datos es siempre completo, la UI es progresiva. Los
módulos pesados (presupuestos, metas, recurrentes, deudas, inversiones, grupo
familiar) son ACTIVABLES desde ajustes y, cuando están apagados, desaparecen por
completo de la navegación.

## La restricción número uno
Registrar un gasto tiene que costar MENOS DE 5 SEGUNDOS y 3 DECISIONES. Es la acción
que más sucede, por lejos. Todo el resto del diseño se subordina a eso.
Cuidado con la métrica: "3 taps" es el proxy del camino feliz (FAB, monto, chip de
frecuente), no la meta. Escribir 1.250 son cuatro taps más que no se pueden evitar
en ninguna app. Lo que se diseña es cuánto tiene que PENSAR el usuario y cuánto
tarda el reloj. Cuando midas un flujo, contá también el tiempo de escritura.

## La restricción número dos: MINIMALISMO
La app es minimalista. Eso significa, concretamente:
- MÁS PANTALLAS, MENOS POR PANTALLA. Si una pantalla tiene dos trabajos, son dos
  pantallas. Prefiero un flujo de 4 pasos limpios a una pantalla con 4 secciones
  apretadas. No tengas miedo de multiplicar pantallas.
- REGLA DE LOS 3 SEGUNDOS. Cualquier pantalla se entiende en 3 segundos: una cifra
  protagonista, un contexto, una acción. Todo lo demás está a un tap, no en pantalla.
- PRESUPUESTO DE RUIDO VISUAL por pantalla, como máximo:
    1 cifra héroe
    1 color de marca visible fuera de los gráficos
    1 acción primaria
    3 niveles tipográficos
    5 elementos interactivos por encima del pliegue
    0 bordes de caja donde alcance el espaciado
    0 iconos decorativos (todo ícono debe ser tocable o portar significado)
  Si algo se pasa del presupuesto, NO SE COMPRIME: se mueve a otra pantalla o a un
  drawer. Comprimir es la respuesta incorrecta.
- NEUTRO POR DEFECTO, COLOR POR EXCEPCIÓN. Aproximadamente el 90% de los píxeles son
  neutros (blancos, negros y grises). El color aparece solo cuando SIGNIFICA algo.
  En wireframe esto se traduce en: si algo no puede distinguirse por tamaño,
  posición o espaciado, recién ahí es candidato a llevar color.
- SIN SOMBRAS, SIN DEGRADADOS DECORATIVOS, SIN SEPARADORES ENTRE FILAS. La jerarquía
  se construye con espaciado, tamaño y alineación.
- Cuando dudes entre "mostrar el dato acá" y "mostrarlo a un tap de distancia",
  elegí siempre lo segundo.

## Reglas de interacción NO NEGOCIABLES
- Prohibido `<select>` nativo.
- Prohibido `<input type="number">` con el teclado del sistema para montos. Los
  montos se ingresan con un keypad propio de pantalla completa, teclas de 64px y
  dígitos de 32px.
- Ningún target táctil menor a 44x44px. El botón primario mide 56-64px de alto,
  ancho completo, y vive en los últimos 200px de la pantalla (zona del pulgar).
- Prohibidas las pantallas sobrecargadas: máximo 3 niveles de información por
  pantalla.
- Prohibidos los diálogos de confirmación para acciones reversibles. Se ejecuta y
  se ofrece deshacer en un toast por 5 segundos.
- Ajuste fino de valores por arrastre (scrubbing horizontal sobre la cifra), no
  escribiendo y borrando.
- Fechas con tira horizontal de días con snap, no con un date picker modal.
- Categorías con grid de burbujas con ícono, no con una lista.
- Cuentas con carrusel de tarjetas con snap, no con un dropdown.

## Navegación
Tab bar de 5 slots con el FAB al centro:
  Inicio · Movimientos · [ + ] · Análisis · Más
El FAB abre la captura rápida. "Más" es una pantalla índice (cuentas, presupuestos,
metas, inversiones, household, ajustes), nunca un menú hamburguesa.
En el header hay un ScopeSwitcher: Personal / Compartido / Todo.

## Formato de entrega que espero
- Mobile-first, viewport de 390x844 (iPhone 14/15). Si una pantalla necesita
  desktop, lo indicás aparte; no lo diseñás todavía.
- Wireframes de BAJA FIDELIDAD: escala de grises, cajas, texto placeholder realista
  (montos, comercios y fechas verosímiles en español rioplatense), sin color de
  marca, sin ilustraciones, sin sombras.
- Para CADA pantalla: nombre, ruta, objetivo en una línea, jerarquía de bloques de
  arriba a abajo, todos los estados (vacío / cargando / error / offline / con
  datos), y de dónde se llega y adónde se va.
- Anotaciones numeradas al costado explicando las interacciones no obvias.
- Señalá explícitamente qué elementos se ocultan para el perfil SIMPLE.
- Al final de cada pantalla, una línea de CHEQUEO DE RUIDO: cuántos elementos
  interactivos hay sobre el pliegue, cuántos niveles tipográficos y si cumple el
  presupuesto. Si no cumple, decime qué moverías a otra pantalla.

Confirmá que entendiste y esperá mi primer bloque de pantallas. No diseñes nada
todavía.
```

---

## PROMPT W0 — Mapa de navegación, flujos y datos

```text
Antes de dibujar ninguna pantalla, necesito el mapa del sistema. Producí:

1. MAPA DE PANTALLAS
   Un diagrama jerárquico de las vistas de PERZE, agrupadas por bloque.
   Ojo con el conteo: los ~112 items de la lista de abajo NO son 112 pantallas.
   CRITERIO, aplicalo literal: es VISTA NAVEGABLE la que tiene ruta propia y se
   puede alcanzar por deep link. Todo lo demás es estado de una vista (vacío,
   cargando, error, offline, una variante de contenido) o sistema transversal.
   El bloque L completo son sistemas, nunca fue pantallas.
   Separá en tres columnas y recontá BLOQUE POR BLOQUE con ese criterio — los
   tamaños A=11…L=6 son de la lista vieja y ya no describen nada:
     - VISTAS NAVEGABLES (ruta propia): ~82
     - ESTADOS de esas vistas
     - SISTEMAS transversales
   El número grande del encabezado es el de vistas navegables.
   Bloques (A=11, B=8, C=11, D=7, E=7, F=7, G=6, H=14, I=12, J=10, K=13, L=6):
   A. Onboarding y auth        G. Recurrentes y deudas
   B. Home                     H. Análisis
   C. Captura                  I. Inversiones (módulo)
   D. Transacciones            J. Grupo familiar (módulo)
   E. Cuentas y monedas        K. Ajustes
   F. Presupuestos y metas     L. Estados transversales
   Marcá con un ícono cuáles pertenecen a un módulo opcional y cuál módulo.

2. FLUJOS CRÍTICOS (diagrama de flujo, con decisiones y estados de error)
   a. Primer ingreso: signup → onboarding → primera cuenta → primer gasto.
      Objetivo declarado: menos de 90 segundos hasta el primer gasto cargado.
   b. Cargar un gasto en la moneda de la cuenta (el camino feliz de 3 taps).
   c. Cargar un gasto en OTRA moneda, con tipo de cambio sugerido por API que el
      usuario puede editar.
   d. Transferencia entre dos cuentas de distinta moneda y distinto país.
   e. Cargar un gasto estando SIN CONEXIÓN, y qué pasa al reconectar.
   f. Un gasto compartido con la pareja: se carga, se divide, y después se liquida.
   g. Activar el módulo de inversiones y registrar la primera compra.
   h. Un presupuesto que se excede a mitad de mes: dónde y cómo se entera el usuario.
   i. Importar desde otra app: subir CSV, mapear columnas, detectar duplicados,
      resolver categorías que no existen. Es el único flujo que trae DATOS SUCIOS y
      el que decide si alguien adopta la app o la abandona el primer día.
   j. Conflicto de sincronización: dos miembros editan el mismo movimiento, uno de
      ellos sin conexión. Es el único flujo con dos personas actuando a la vez.

3. MODELO MENTAL DE DATOS
   Un diagrama de entidades y relaciones, en lenguaje de producto (no SQL), que
   muestre: Household → Miembros → Cuentas (país, moneda, institución) →
   Transacciones (categoría, tags, comercio, adjuntos, tipo de cambio congelado) y
   sus derivados: Presupuestos, Metas, Recurrentes, Deudas, Portfolios →
   Instrumentos → Operaciones.
   Marcá dónde vive la conversión de moneda y por qué el tipo de cambio se congela
   por transacción.

4. MATRIZ PANTALLA x CONDICIÓN DE ACTIVACIÓN
   OJO: los "tres perfiles" son lenguaje de documento, no existen en el producto.
   No hay ningún campo "perfil". La progresividad depende de flags ortogonales:
     - monedas_en_uso > 1
     - miembros_del_household > 1
     - cada módulo activable, por separado
   Armá la matriz con las pantallas en filas y esas CONDICIONES en columnas,
   marcando visible / oculta / simplificada. Después, y solo como resumen de
   lectura, mostrá qué ve cada uno de los tres perfiles arquetípicos — pero la
   matriz que manda es la de condiciones, porque es la que se implementa.

5. LAS 5 DECISIONES DE DISEÑO MÁS RIESGOSAS
   Con las alternativas que descartás y por qué.

Entregá esto como diagramas + tablas, sin dibujar pantallas todavía.
```

---

## PROMPT W1 — Onboarding y autenticación

```text
Bloque A. Wireframes de baja fidelidad, 390x844.

Meta del bloque: del signup al primer gasto cargado en menos de 90 segundos, sin
que el usuario sienta que está configurando un ERP.

Pantallas:
A1. Welcome / valor en 3 slides deslizables (skippeable desde el primer frame)
A2. Auth — magic link por email como opción principal, Google y Apple como
    secundarias, y "usar passkey" si ya existe una. Sin password en ningún caso.
A3. Verificación de magic link (estado de espera + reenviar + cambiar email)
A4. Setup 1 — País y moneda. País pre-detectado. Un solo tap para confirmar.
    Se llama "tu moneda", no "moneda base": el término técnico solo aparece cuando
    el usuario suma una segunda moneda.
A5. Setup 2 — "¿Cómo vas a usar la app?": Solo / Con mi pareja / Con mi familia.
    Esta respuesta decide si el módulo de grupo familiar arranca encendido.
A6. Setup 3 — Primera cuenta. Presets visuales por país (bancos y billeteras
    conocidas + Efectivo + Otro). Máximo 6 opciones visibles + buscar.
A7. Setup 4 — Saldo inicial de esa cuenta, con el KEYPAD de pantalla completa.
    Es el primer contacto con el keypad: tiene que sentirse bien acá.
A8. Setup 5 — Plantilla de categorías: 3 opciones (Básica 8 categorías /
    Completa 20 / Empezar de cero), con preview de los íconos.
A9. Setup 6 — Módulos opcionales, como switches con una línea de explicación cada
    uno. Son SEIS, la lista canónica completa: Presupuestos, Metas, Recurrentes,
    Deudas y cuotas, Inversiones, Grupo familiar (este último ya viene decidido
    por A5, se muestra marcado pero editable).
    TODOS APAGADOS POR DEFECTO menos lo que se dedujo de A5.
A10. Instalar como app — prompt de instalación PWA, con detección de plataforma
     (Android nativo vs. instrucciones para iOS Safari).
     VA DESPUÉS DEL PRIMER GASTO, no antes: pedir instalar antes de haber dado
     ningún valor es la peor conversión posible. Se ofrece al volver de A11 → C1.
A11. Éxito + CTA gigante "Cargar mi primer gasto" que va directo al keypad.

OBJETIVO DURO DEL BLOQUE: menos de 90 segundos reales del signup al primer gasto.
Contá el tiempo de ESCRITURA, no solo los taps: tipear un email son unos 15
segundos. Si el flujo no cierra, tu trabajo es decirme qué pasos eliminar o
fusionar, no maquillar el presupuesto.

Requisitos:
- Barra de progreso persistente en A4-A9, con "Saltear" siempre disponible. Todo lo
  del onboarding es editable después en Ajustes; hay que decirlo.
- Ningún paso puede tener más de una decisión.
- Mostrá los estados de error de A2/A3 (email inválido, link vencido, sin conexión).
- Indicá qué pasos se saltean automáticamente para el perfil SIMPLE.

Anotá numeradamente las decisiones de interacción.
```

---

## PROMPT W2 — Home, navegación y scope

```text
Bloque B. Wireframes de baja fidelidad, 390x844.

B1. HOME / Dashboard. Estructura de arriba a abajo:
    1. Header 56px: avatar + ScopeSwitcher (Personal/Compartido/Todo) + búsqueda +
       SyncDot. Colapsa al hacer scroll.
    2. Hero: una sola cifra grande. El usuario elige cuál en ajustes, con default
       "Patrimonio neto". Alternativas: "Disponible para gastar hoy", "Balance del
       mes". Debajo, delta vs. período anterior con signo y flecha, y sparkline.
    3. Tira horizontal de cuentas: cards con snap, saldo, institución y moneda. Si
       hay varias monedas, un chip de total convertido al final de la tira.
    4. Fila de estado del mes: gastado vs. presupuesto (bullet chart si el módulo
       está activo; si no, gastos vs. ingresos del mes).
    5. Insight card del momento (descartable con swipe). Solo una, nunca un stack.
    6. "Últimos movimientos" — 5 filas + "Ver todos".
    7. Espacio inferior libre para que el FAB no tape contenido.

    Diseñá tres variantes del mismo home:
    - Perfil SIMPLE (una cuenta, una moneda, sin módulos)
    - Perfil MULTI-MONEDA (4 cuentas, 3 monedas, presupuestos activos)
    - Perfil INVERSOR (lo anterior + una fila de portfolio)

B2. Estado VACÍO del home — usuario recién onboardeado, sin transacciones. Tiene
    que empujar a una sola acción.
B3. Estado CARGANDO — skeleton que respeta la forma real, sin spinners.
B4. Estado OFFLINE — banner discreto + contador de cambios pendientes de sincronizar.
B5. ScopeSwitcher abierto — cómo se ve el cambio Personal/Compartido/Todo y qué
    cifras cambian.
B6. Tab bar en detalle — 5 slots, el FAB al centro superpuesto, estados activo/
    inactivo, y la variante cuando el módulo de Inversiones está encendido.
B7. Pantalla "MÁS" — índice de secciones en cards grandes, agrupadas: Dinero
    (Cuentas, Presupuestos, Metas, Recurrentes, Deudas), Personas (Grupo familiar),
    Sistema (Ajustes, Importar/Exportar, Acerca de). Los módulos apagados no
    aparecen, pero hay una entrada "Activar más funciones".
    Dos variantes, porque el tab bar cambia:
    - Inversiones APAGADO → tabs: Inicio · Movimientos · [+] · Análisis · Más.
      "Inversiones" no existe en ningún lado.
    - Inversiones ENCENDIDO → tabs: Inicio · Movimientos · [+] · Inversiones · Más,
      y ANÁLISIS baja a esta pantalla como una card más del grupo Dinero.
B8. Búsqueda global / command palette — resultados agrupados por tipo
    (transacciones, cuentas, categorías, comercios, acciones).

Anotá qué se oculta en cada perfil y cómo se comporta el header al scrollear.
```

---

## PROMPT W3 — Captura rápida (la pantalla más importante)

```text
Bloque C. Wireframes de baja fidelidad, 390x844.

Este es EL bloque. Diseñalo como si el resto de la app no existiera. Objetivo
declarado: menos de 5 segundos y 3 taps para el 80% de los gastos.

C1. QUICK ADD — Paso monto (pantalla completa)
    - Arriba: selector de tipo como segmented control de 3 estados
      Gasto | Ingreso | Transferencia. Default: Gasto.
    - Centro: el monto en tipografía gigante (64px). A su izquierda el símbolo de
      moneda, tocable, que abre el selector de moneda. Debajo, en pequeño, la cuenta
      activa, tocable.
    - Abajo: KEYPAD propio. Teclas de 64px. Layout 4x4: dígitos 0-9, coma decimal,
      backspace (long-press = limpiar), y una columna de operaciones + − × ÷ para
      sumar varios tickets sin salir.
    - Botón primario de ancho completo: "Siguiente".
    - Las operaciones son: + − × ÷ (no "=", el resultado se resuelve al confirmar).
    - Anotá: la cifra debe ser arrastrable horizontalmente para ajuste fino
      (scrubbing). Cada dígito entra desde abajo con animación.

C2. QUICK ADD — Paso categoría
    - Fila superior de CHIPS DE FRECUENTES ordenados por hora del día (a las 13:00
      aparece "Almuerzo" primero). Un tap acá guarda directamente: ese es el camino
      de 3 taps.
    - Debajo, grid de burbujas de categoría (3 columnas, círculos de 64px con ícono
      y label). Scroll vertical.
    - Buscador que aparece al empezar a escribir (única concesión al teclado del
      sistema, y es opcional).
    - Botón primario "Guardar" de ancho completo, siempre visible.

C3. QUICK ADD — Detalles (sección colapsada, se abre con swipe-up o con el chevron)
    Filas: Cuenta (carrusel de tarjetas) · Fecha (tira de días con snap) · Comercio
    (autocompletado) · Nota · Tags · Adjuntar foto · Dividir (entre categorías o
    entre miembros) · Marcar como recurrente.
    Todo tiene default; ninguna fila es obligatoria.

C4. QUICK ADD — Moneda distinta a la de la cuenta
    Cuando la moneda elegida ≠ moneda de la cuenta, aparece un bloque de conversión:
    - Monto original grande, monto convertido debajo en secundario
    - Tipo de cambio SUGERIDO por API, con la fuente y la fecha del dato
    - Selector de qué cotización usar (oficial / blue / MEP / CCL / personalizada)
      cuando el país lo amerita
    - El rate es editable: tap abre keypad, o slider fino de ±5%
    - Badge de advertencia si el dato tiene más de 24h o si viene del cache offline
    Esta pantalla NO EXISTE para el perfil SIMPLE.

C5. QUICK ADD — Ingreso
    Igual que gasto pero: categorías de ingreso, y una fila explícita
    "¿A qué cuenta entra?" con el carrusel de cuentas destacado.

C6. QUICK ADD — Transferencia
    Dos tarjetas de cuenta, origen y destino, con un botón de invertir al medio.
    Si las monedas difieren: dos montos independientes (sale X, entra Y) con el rate
    implícito calculado y editable. Una transferencia nunca cuenta como gasto ni
    como ingreso: decilo en la interfaz.

C7. Confirmación y deshacer — no es una pantalla: el botón se contrae a un círculo,
    dibuja un check, la card vuela a la lista, y aparece un toast con "Deshacer" por
    5 segundos. Dibujá los 4 frames.

C8. Modo RÁFAGA — switch "seguir cargando" que resetea el monto y la categoría pero
    mantiene cuenta y fecha, con un contador de "3 cargados".

C9. Captura por VOZ — botón de micrófono, estado escuchando, transcripción en vivo,
    y la interpretación en campos editables ("$1.200 · Supermercado · Efectivo ·
    hoy") antes de confirmar.

C10. Captura por FOTO de ticket — cámara, preview, campos extraídos editables.
     Marcalo como fase futura pero dejá el punto de entrada previsto.

C11. Estado ERROR / SIN CONEXIÓN al guardar — la transacción se guarda igual, local,
     con un badge de "pendiente de sincronizar". El usuario NUNCA pierde lo cargado.

Anotá con números: cuántos taps cuesta cada camino, dónde está cada default
inteligente, y qué haptic dispara cada interacción.
```

---

## PROMPT W4 — Transacciones

```text
Bloque D. Wireframes de baja fidelidad, 390x844.

D1. LISTA DE MOVIMIENTOS
    - Header con búsqueda, botón de filtros (con badge de filtros activos) y
      selector de período.
    - Resumen sticky del período: ingresos / gastos / balance, en una sola fila.
    - Agrupado por día, con headers sticky que muestran la fecha y el total del día.
    - Cada fila: ícono de categoría, comercio, cuenta+moneda en secundario, monto
      alineado a la derecha con signo. Si la moneda no es la base, el equivalente
      convertido en línea inferior pequeña.
    - Swipe izquierda = borrar (con undo), swipe derecha = editar.
    - Scroll infinito con virtualización. Indicá dónde va el separador de mes.

D2. FILTROS (bottom sheet, arrastrable)
    Rango de fechas (presets + custom) · Cuentas · Categorías · Monedas · Países ·
    Miembros · Tags · Rango de monto (doble slider) · Tipo (gasto/ingreso/
    transferencia) · Solo pendientes · Con adjunto.
    Chips de filtros activos arriba, con "Limpiar todo". Contador de resultados en
    vivo en el botón de aplicar.

D3. DETALLE DE TRANSACCIÓN
    Monto grande arriba con su conversión, categoría, cuenta, fecha, comercio, nota,
    tags, adjuntos (galería), quién la cargó y cuándo, historial de ediciones,
    y el tipo de cambio usado con su fuente. Acciones: editar, duplicar,
    convertir en recurrente, dividir, borrar.

D4. EDITAR TRANSACCIÓN — mismo flujo que la carga pero con los valores cargados.
    Advertencia visible si se cambia el tipo de cambio de una transacción vieja.

D5. VISTA DE CALENDARIO de transacciones — mes en grilla, con el monto total por día
    y un heatmap de intensidad. Tap en un día abre la lista de ese día.

D6. Estados: lista vacía sin transacciones · lista vacía por filtros demasiado
    estrictos (con "Limpiar filtros") · cargando · offline con pendientes.

D7. SELECCIÓN MÚLTIPLE — long-press activa el modo selección: categorizar en lote,
    etiquetar, borrar, exportar.
```

---

## PROMPT W5 — Cuentas, monedas y tipos de cambio

```text
Bloque E. Wireframes de baja fidelidad, 390x844.

E1. LISTA DE CUENTAS
    - Total de patrimonio arriba, en la moneda base, con desglose activos/pasivos.
    - Cuentas agrupadas por moneda (o por país, según preferencia). Cada grupo tiene
      su subtotal en moneda propia y su equivalente en moneda base.
    - Cards con: institución, nombre, últimos dígitos, moneda, bandera del país,
      saldo. Las tarjetas de crédito muestran el consumo del período y el límite.
    - Reordenables con drag. Archivadas colapsadas al final.
    - Para el perfil SIMPLE: sin agrupación por moneda, sin banderas, sin conversión.

E2. DETALLE DE CUENTA
    Saldo grande + gráfico de evolución del saldo (línea, 90 días) + transacciones de
    esa cuenta + acciones (editar, conciliar, transferir, archivar).

E3. CREAR / EDITAR CUENTA
    Tipo como grid de íconos — los nueve: efectivo, caja de ahorro, cuenta corriente,
    tarjeta de crédito, billetera, broker, préstamo (debo), por cobrar (me deben),
    otro · Institución (buscador con presets del
    país) · País · Moneda · Nombre · Color e ícono · Saldo inicial (keypad) ·
    Incluir en patrimonio neto (switch) · Visibilidad (privada / compartida).
    Campos condicionales: límite y días de cierre/vencimiento para tarjeta; tasa y
    plazo para préstamo.

E4. TARJETA DE CRÉDITO — resumen del período: consumos del ciclo, fecha de cierre,
    fecha de vencimiento, cuotas pendientes de períodos anteriores, y proyección de
    lo que se va a debitar.

E5. CONCILIACIÓN — "¿Cuánto dice tu banco que tenés?" → keypad → muestra la
    diferencia y ofrece crear un ajuste con una categoría de conciliación.

E6. MONEDAS Y TIPOS DE CAMBIO
    - Lista de monedas en uso, con la cotización actual contra la moneda base, la
      fuente, la antigüedad del dato y la variación del día.
    - Por par de monedas: elegir proveedor y qué cotización (oficial / blue / MEP /
      CCL) usar como sugerencia por defecto.
    - Botón de refrescar, con estado de última actualización.
    - Override manual con vigencia (fija un rate hasta que lo cambies).
    - Histórico del par en un gráfico de línea.
    Esta pantalla NO EXISTE para el perfil SIMPLE.

E7. Estados: sin cuentas · cotización desactualizada · API caída (mostrar el último
    valor conocido y el input manual, nunca bloquear).
```

---

## PROMPT W6 — Presupuestos, metas, recurrentes y deudas

```text
Bloque F+G. Wireframes de baja fidelidad, 390x844. Todos estos son MÓDULOS
OPCIONALES: diseñá también la pantalla de activación de cada uno.

F1. PRESUPUESTOS — overview
    - Arriba: "Disponible para gastar hoy" como cifra héroe, y el ritmo (¿vas
      adelantado o atrasado respecto de los días transcurridos?).
    - Lista de categorías con bullet chart: gastado / presupuesto / proyección a fin
      de mes. Las excedidas primero, marcadas con ícono + label (nunca solo color).
    - Días restantes del período y monto sin asignar.
F2. DETALLE DE PRESUPUESTO por categoría — evolución diaria acumulada vs. la línea
    ideal, transacciones que lo componen, histórico de los últimos 6 meses.
F3. CREAR / EDITAR PRESUPUESTO — período, moneda, categorías con monto asignado
    mediante DIAL RADIAL arrastrable (no input), switch de rollover, y un total que
    se actualiza en vivo. Sugerencia automática basada en el promedio histórico.
F4. Alerta de presupuesto excedido — cómo y dónde se entera el usuario (insight card
    en el home, notificación push, badge en el tab).

F5. METAS DE AHORRO — lista con anillo de progreso, monto faltante y fecha estimada
    de llegada calculada según el ritmo real.
F6. DETALLE DE META — progreso, aportes históricos, proyección, cuentas vinculadas,
    y un simulador "si aporto X por mes, llego el...".
F7. CREAR META — nombre, ícono, monto objetivo (keypad), fecha objetivo (opcional),
    cuentas vinculadas.

G1. RECURRENTES Y SUSCRIPCIONES
    - Vista calendario del mes con los vencimientos marcados.
    - Lista de próximos 30 días con monto y cuenta de débito.
    - Total mensual comprometido, destacado.
    - Sección "Detectadas automáticamente" con las que el sistema encontró y el
      usuario todavía no confirmó.
    - Marca de aumento de precio: "Netflix pasó de $2.400 a $3.100".
G2. DETALLE DE RECURRENTE — frecuencia, historial de montos con gráfico, próximas
    ocurrencias, switch de auto-registro, y "cancelar suscripción" como recordatorio.
G3. CREAR RECURRENTE — a partir de una transacción existente o desde cero.
    Frecuencia como chips (semanal / quincenal / mensual / bimestral / anual /
    personalizada), no como un constructor de RRULE.

G4. DEUDAS Y CUOTAS
    - Total adeudado y calendario de vencimientos.
    - Lista de planes de cuotas activos: "Heladera — cuota 4 de 12 — $18.500/mes".
    - Compromiso futuro: barra de los próximos 12 meses mostrando cuánto de cada mes
      ya está comprometido.
    - Separación entre "debo" y "me deben".
G5. DETALLE DE DEUDA — tabla de amortización, cuotas pagas y pendientes, total de
    intereses, y opción de pago anticipado con recálculo.
G6. CREAR PLAN DE CUOTAS — desde una transacción con tarjeta: monto, cantidad de
    cuotas, primera fecha, y preview del calendario generado.
```

---

## PROMPT W7 — Análisis

```text
Bloque H. Wireframes de baja fidelidad, 390x844.

Regla para todo este bloque: los gráficos se dibujan como cajas etiquetadas con el
tipo de gráfico y qué representan los ejes. Todavía no importa cómo se ven; importa
qué pregunta responde cada uno y en qué orden aparecen. Todo gráfico tiene un toggle
de "ver como tabla".

H1. ANALYTICS HOME
    - Selector de período pegajoso arriba (Mes / 3M / 6M / Año / Todo / Custom).
    - Toggle de conversión: "valores históricos" vs. "valores de hoy" — decidí cómo
      explicarlo en una línea sin jerga.
    - Fila de KPIs (tiles, no gráficos): tasa de ahorro, cashflow, gasto promedio
      diario, patrimonio neto, meses de colchón. Cada uno con delta vs. período
      anterior.
    - Cards de acceso a cada análisis, cada una con un preview del gráfico.

H2. CATEGORÍAS — donut o treemap con drill-down a subcategorías y de ahí a
    transacciones. Lista ordenada al costado con monto, % y delta vs. período previo.
H3. TENDENCIAS — barras apiladas por mes (ingresos arriba, gastos abajo de la
    baseline), con línea de balance. Comparador mes vs. mes y vs. mismo mes del año
    anterior.
H4. FLUJO DE DINERO — diagrama Sankey: ingresos → cuentas → categorías. Es el
    gráfico que la gente comparte; dale pantalla completa y modo apaisado.
H5. PATRIMONIO NETO — línea de evolución + waterfall que descompone el cambio del
    período en: flujo neto de caja + retorno de inversiones + efecto del tipo de
    cambio. Que los tres sumen exacto al delta.
H6. MULTI-MONEDA — área apilada de exposición por moneda en el tiempo, tarjeta de
    "impacto FX" (cuánto ganaste o perdiste sin hacer nada), y comparación de gastos
    en moneda local vs. en USD constantes.
H7. INFLACIÓN — gastos nominales vs. reales ajustados por IPC del país. Explicá el
    concepto en una línea dentro de la pantalla.
H8. CALENDARIO — heatmap de gasto diario del año, tap en un día abre el detalle.
H9. COMERCIOS — ranking de dónde se te va la plata, con frecuencia y ticket promedio.
H10. INSIGHTS — feed de tarjetas generadas automáticamente (anomalías, aumentos de
     suscripciones, cambios de hábito), con acción y opción de descartar.
H11. RESUMEN SEMANAL — card animada de una semana, con 3 datos y una comparación.
H12. WRAPPED mensual/anual — secuencia de 6 a 8 pantallas completas tipo historia,
     navegable con tap, exportable como imagen. Diseñá la secuencia y qué dato va en
     cada una.
H13. EXPORTAR / REPORTES — selección de período y secciones, formato CSV o PDF,
     preview.
H14. Estados: sin datos suficientes ("necesitás al menos 30 días de movimientos
     para ver tendencias") · período sin transacciones · cargando.
```

---

## PROMPT W8 — Inversiones (módulo opcional)

```text
Bloque I. Wireframes de baja fidelidad, 390x844.

Contexto: el usuario define sus propias clases de activo. Las plantillas incluyen
acciones, CEDEARs, bonos soberanos, ONs, letras, FCI, plazo fijo, crypto, ETFs e
inmuebles, pero puede crear las que quiera. Los precios vienen de API cuando existe
proveedor, y SIEMPRE se pueden cargar a mano (imprescindible para ONs poco líquidas,
FCI, plazos fijos e inmuebles).

I1. ACTIVACIÓN DEL MÓDULO — pantalla que explica qué agrega, con la opción de elegir
    qué clases de activo va a usar. Sin esto, el módulo no aparece en ningún lado.
I2. PORTFOLIO OVERVIEW
    - Valor total y P&L (no realizado + realizado) con signo y flecha.
    - Selector de moneda de visualización.
    - Gráfico de evolución del valor con selector de período.
    - Donut de allocation con selector de dimensión: por clase / moneda / país /
      sector.
    - Fila de KPIs: rendimiento TWR, rendimiento propio (XIRR), vs. inflación,
      vs. dólar.
I3. POSICIONES — lista agrupable (por clase, moneda, país, portfolio). Cada fila:
    símbolo, nombre, cantidad, precio actual, valor, P&L absoluto y %, peso en el
    portfolio. Ordenable. Buscable.
I4. DETALLE DE INSTRUMENTO — gráfico de precio, tu posición (cantidad, precio
    promedio de compra, valor actual, P&L), historial de operaciones, dividendos o
    cupones cobrados, y datos del instrumento (para renta fija: vencimiento, tasa,
    calendario de pagos).
I5. REGISTRAR OPERACIÓN — tipo (compra / venta) como segmented, buscador de
    instrumento, cantidad y precio con keypad, comisiones e impuestos colapsados,
    "¿de qué cuenta salió la plata?", y un preview en vivo del monto total y del
    impacto en la posición.
I6. REGISTRAR RENTA — dividendo, cupón, amortización o interés. Instrumento, monto,
    fecha, cuenta de acreditación, retenciones.
I7. BUSCAR / AGREGAR INSTRUMENTO — buscador con resultados de las APIs disponibles,
    y siempre la opción "crear manual" con los campos mínimos (nombre, clase,
    moneda, precio inicial).
I8. GESTIONAR CLASES DE ACTIVO — CRUD con ícono, color, orden. Totalmente editable.
I9. ALLOCATION OBJETIVO Y REBALANCEO — barras arrastrables que suman 100%, comparación
    objetivo vs. real con bandas de tolerancia, y las operaciones sugeridas para
    cerrar la brecha.
I10. RENDIMIENTO — línea del portfolio vs. benchmarks seleccionables (S&P 500, dólar
     blue/MEP, plazo fijo, inflación local). Explicá TWR vs. XIRR en un tooltip de
     una línea cada uno.
I11. CALENDARIO DE RENTA FUTURA — línea de tiempo de cupones y amortizaciones
     proyectadas de bonos y ONs, con el total esperado por mes.
I12. Estados: portfolio vacío · precio desactualizado (badge + "actualizar a mano") ·
     instrumento sin proveedor de precio · mercado cerrado.
```

---

## PROMPT W9 — Grupo familiar (módulo opcional)

```text
Bloque J. Wireframes de baja fidelidad, 390x844.

Premisa: compartir finanzas con tu pareja no puede significar que TODO sea público.
Cada cuenta y cada transacción tiene visibilidad privada o compartida, y hay un
ScopeSwitcher global (Personal / Compartido / Todo).

J1. ACTIVACIÓN DEL MÓDULO + invitación del primer miembro.
J2. HOUSEHOLD OVERVIEW — miembros con avatar y color, patrimonio conjunto,
    contribución de cada uno al gasto del mes, y el saldo entre personas
    ("Ana te debe $4.200").
J3. INVITAR MIEMBRO — por email o por código/QR, con selector de rol
    (admin / miembro / solo lectura) explicado en una línea cada uno.
J4. PERMISOS Y VISIBILIDAD — matriz clara de qué ve cada rol. Y el control global de
    "qué comparto por defecto": cuentas y categorías con switch individual.
J5. GASTOS COMPARTIDOS — lista de transacciones con reparto, mostrando quién pagó y
    cómo se dividió.
J6. DIVIDIR UN GASTO — sobre una transacción existente: barra arrastrable entre
    miembros, con presets (50/50, por ingreso proporcional, montos exactos,
    porcentajes). Preview del resultado en vivo.
J7. LIQUIDAR (settle up) — quién le debe a quién, monto neto simplificado, y el
    registro del pago que cancela las deudas.
J8. COMPARATIVA ENTRE MIEMBROS — opt-in explícito de ambos. Gastos por categoría
    lado a lado. Diseñá esto con cuidado: no puede sentirse como vigilancia.
J9. ACTIVIDAD DEL HOUSEHOLD — feed de quién cargó, editó o borró qué.
J10. Estados: household de una sola persona · invitación pendiente · miembro que se va.
```

---

## PROMPT W10 — Ajustes y estados transversales

```text
Bloque K+L. Wireframes de baja fidelidad, 390x844.

K1. AJUSTES — índice agrupado: Cuenta · Preferencias · Datos · Seguridad ·
    Notificaciones · Acerca de.
K2. PERFIL — nombre, avatar, email, sesiones activas, cerrar sesión, borrar cuenta.
K3. PREFERENCIAS — moneda ("moneda base" solo si hay más de una en uso; si no,
    "tu moneda"), país, idioma (ES/EN/PT), formato de números, primer
    día de la semana, DÍA DE CIERRE DEL MES (no todos cierran el 1), tema
    (claro/oscuro/sistema), color de acento, intensidad de animación
    (completa/reducida/mínima), qué cifra va en el hero del home.
K4. MÓDULOS — switches de todos los módulos opcionales con una línea de explicación
    y una advertencia clara de qué pasa con los datos si se apaga uno.
K5. CATEGORÍAS — gestión completa: crear, editar, reordenar con drag, anidar
    subcategorías, fusionar dos categorías, archivar. Contador de transacciones por
    categoría.
K6. TAGS Y COMERCIOS — gestión, fusión de duplicados.
K7. REGLAS DE AUTO-CATEGORIZACIÓN — lista de reglas ("si la nota contiene 'uber' →
    categoría Transporte"), constructor simple, y contador de veces que se aplicó.
K8. FUENTES DE TIPO DE CAMBIO — proveedor y tipo de cotización preferida por par de
    monedas, frecuencia de actualización, override manual.
K9. IMPORTAR — subir CSV, mapeo guiado de columnas, preview de las primeras filas,
    detección de duplicados, y resumen del resultado.
K10. EXPORTAR / BACKUP — CSV por sección, backup JSON completo, y la promesa
     explícita de "tus datos son tuyos".
K11. SEGURIDAD — bloqueo de la app (PIN con el keypad propio, o biometría),
     tiempo de bloqueo automático, modo privacidad (blur de montos) con su gesto de
     activación rápida.
K12. NOTIFICACIONES — por tipo (presupuesto, recurrentes, insights, actividad del
     household), con horario preferido.
K13. ACERCA DE — versión, licencia open source, repositorio, changelog, agradecimientos.

L1. Sistema de ESTADOS VACÍOS — una plantilla consistente aplicada a las 10
    secciones principales. Ilustración simple, una frase, una acción.
L2. Sistema de SKELETONS — para cada patrón de layout (lista, cards, gráfico, hero).
L3. Sistema de ERRORES — sin conexión, error de servidor, permiso denegado, no
    encontrado, conflicto de sincronización entre dos miembros.
L4. Sistema de TOASTS Y CONFIRMACIONES — éxito con deshacer, advertencia, error,
    proceso en curso.
L5. Onboarding contextual — cómo se explica una feature nueva la primera vez sin
    hacer un tour completo (tooltips de un solo paso, dismissables).
L6. PANTALLA DE BLOQUEO — el gate de PIN/biometría al abrir la app.
    OPCIONAL Y APAGADO POR DEFECTO. Y cuando está encendido, la CAPTURA QUEDA EN
    ZONA PRE-AUTH: el shortcut de la PWA, el share target y el widget entran
    directo al keypad sin pedir nada. El gate aparece recién al intentar ver
    saldos, movimientos o análisis. Escribir no revela nada; leer sí. Diseñá los
    dos caminos y el momento exacto en que aparece el gate viniendo desde una
    captura ya guardada.
```

---

## PROMPT WV — Auditoría del sistema antes de pasar a alta fidelidad

```text
Ya tenemos el wireframe completo de PERZE. Antes de pasar a diseño de alta
fidelidad, hacé una auditoría crítica. Sé duro: es más barato encontrar un problema
acá que después de programarlo.

1. CONSISTENCIA
   - ¿Hay patrones que resuelven el mismo problema de dos maneras distintas?
   - ¿Los mismos datos se llaman igual en todas las pantallas?
   - ¿La jerarquía visual es coherente entre bloques?

2. CAMINOS
   - Contá los taps reales de los 8 flujos críticos del PROMPT W0. ¿Alguno se pasa
     del objetivo?
   - ¿Hay callejones sin salida (pantallas de las que no se sale bien)?
   - ¿Toda pantalla es alcanzable desde al menos dos lugares razonables?

3. PROGRESIVIDAD
   - Recorré la app COMPLETA con los ojos del perfil SIMPLE. ¿Ve algo que no debería?
   - ¿Alguna pantalla se rompe si un módulo está apagado?

4. DENSIDAD Y MINIMALISMO (la auditoría más importante)
   - Aplicá el PRESUPUESTO DE RUIDO VISUAL a TODAS las pantallas del mapa y listá
     las que lo violan, indicando qué límite rompen y por cuánto:
       1 cifra héroe · 1 color de marca fuera de los gráficos · 1 acción primaria ·
       3 niveles tipográficos · 5 elementos interactivos sobre el pliegue ·
       0 bordes de caja evitables · 0 iconos decorativos
   - Para cada violación, proponé el arreglo COMO PARTICIÓN (mover a otra pantalla,
     a un drawer, o a un segundo paso), nunca como compresión.
   - ¿Qué pantalla tiene más información de la que se puede procesar en 3 segundos?
     Proponé un recorte concreto para las 5 peores.
   - ¿Hay algún elemento que esté en pantalla "por las dudas"? Sacalo.

5. ESTADOS
   - Listá toda pantalla a la que le falte alguno de los 5 estados obligatorios
     (vacío, cargando, error, offline, con datos).

6. LO QUE FALTA
   - ¿Qué pantalla o estado necesario no está en el mapa?
   - ¿Qué error del mundo real no está contemplado? (transacción duplicada, cuenta
     archivada con movimientos, moneda descontinuada, miembro que se va del
     household con gastos sin liquidar, transacción en una cuenta que ya no existe)

7. VEREDICTO
   Las 10 cosas que hay que arreglar antes de pasar a alta fidelidad, ordenadas por
   costo de arreglarlas después.
```
