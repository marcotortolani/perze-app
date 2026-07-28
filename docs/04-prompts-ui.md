# 04 — Prompts de diseño de alta fidelidad

## Cómo usar este archivo

Se corre **después** de tener los wireframes aprobados y auditados (`03-prompts-wireframes.md`).

1. `PROMPT D0` — establece el design system visual. Se corre **una sola vez** y su salida se guarda como referencia permanente.
2. `PROMPT D1` — biblioteca de componentes. También una sola vez.
3. `PROMPT D2` — motion spec en movimiento.
4. `PROMPT D3 → D12` — pantallas de alta fidelidad por bloque. Cada uno referencia D0 y D1.
5. `PROMPT DV` — auditoría visual final.

**Antes de arrancar**, pegá como contexto de cada sesión nueva:

1. El `PROMPT 0` de `03-prompts-wireframes.md` **sin su última sección** ("Formato de entrega que espero"). Esa sección pide wireframes en escala de grises: si la pegás acá, el modelo te va a devolver wireframes en fase de alta fidelidad. Lo que sí querés de ese prompt es el contexto de producto, los tres perfiles, el minimalismo y las reglas de interacción.
2. El contenido completo de `02-design-system.md`.

### Mapeo de bloques entre fases

Los números **no** coinciden entre archivos. Esta es la tabla:

| Bloque                                         | Wireframe (03) | Alta fidelidad (04) |
| ---------------------------------------------- | -------------- | ------------------- |
| A — Onboarding y auth                          | W1             | D3                  |
| B — Home y navegación                          | W2             | D4                  |
| C — Captura rápida                             | W3             | D5                  |
| D — Transacciones                              | W4             | D6                  |
| E — Cuentas y monedas                          | W5             | D7                  |
| F+G — Presupuestos, metas, recurrentes, deudas | W6             | D8                  |
| H — Análisis                                   | W7             | D9                  |
| I — Inversiones                                | W8             | D10                 |
| J — Grupo familiar                             | W9             | D11                 |
| K+L — Ajustes y estados                        | W10            | D12                 |

---

## PROMPT D0 — Design system visual (correr una vez)

```text
Pasamos de wireframe a diseño de alta fidelidad para PERZE.

Adjunto el design system completo (documento 02). No lo reinterpretes ni lo
"mejores": tu trabajo es materializarlo en píxeles y detectar dónde el documento se
queda corto.

Producí una GUÍA VISUAL DE ESTILO en una sola página, mobile 390px de ancho,
mostrando en modo OSCURO (y una segunda versión en claro):

1. SUPERFICIES — las tres superficies apiladas sobre el plano de página, con sus
   hex, demostrando que la jerarquía se lee sin sombras ni bordes.

2. COLOR — la estructura completa:
   - Neutros (plano, superficies 1/2/3, borde, texto primario/secundario/muted)
   - Primario violeta índigo: texto/ícono #8B7CF6 dark · #5D45E8 light,
     relleno #6D55F0 en ambos modos
   - Secundario aqua #199E70 dark · #12916A light
   - Acento naranja #E06A35 dark · #D95926 light
   - Estado: good #0CA30C · warning #FAB219 · serious #EC835A · critical #D03B3B
   - Datos: 5 slots en orden fijo. Dark: #8B7CF6 · #199E70 · #E06A35 · #3987E5 ·
     #D55181. Light: #5D45E8 · #12916A · #D95926 · #2A78D6 · #C9457A.
     "Otros" = #6E6E76 dark / #8A8A90 light.
     La paleta de datos NO cambia con el preset de marca elegido por el household.
   - Rampa secuencial violeta (13 pasos) y divergente aqua↔naranja con punto medio
     en el token de borde — los hexes están en el documento 02 § 2.7
   Para cada color, indicá su ratio de contraste contra la superficie donde vive y
   una frase de "cuándo se usa / cuándo NO se usa".

3. LA REGLA DEL 90% — una demostración visual: la misma card de transacción
   dibujada tres veces, mostrando cuánto color es correcto, cuánto es de más, y el
   resultado con cero color. Quiero ver por qué el minimalismo cromático funciona
   acá.

4. TIPOGRAFÍA — la escala completa (hero-xl 64, hero 40, title 22, body 16,
   label 13, caption 11) con un ejemplo real de contenido financiero en cada nivel.
   Tres pesos: 400, 500, 600. Mostrá la diferencia entre figuras proporcionales
   (cifra héroe) y tabulares (columnas).

5. ESPACIADO Y RADIOS — el grid de 4px aplicado, los radios por componente
   (card 20, sheet 28, chip 999, button 16, input 14, keypad-key 20).

6. ICONOGRAFÍA — set de Lucide, grosor de trazo 1.5px, tamaños 16/20/24.
   Los 20 íconos de categoría por defecto, en neutro.

7. ELEVACIÓN — cómo se separa un sheet del contenido sin usar sombra dramática.
   La única sombra permitida, aplicada.

Restricciones que quiero ver respetadas en la muestra:
- Sin degradados decorativos. Sin glassmorphism. Sin sombras de color.
- Máximo 3 niveles tipográficos coexistiendo en cualquier composición.
- El violeta aparece solo donde significa "accionable", "seleccionado" o "marca".

Al final, decime en qué 3 puntos el documento 02 es ambiguo o insuficiente y qué
proponés.
```

---

## PROMPT D1 — Biblioteca de componentes (correr una vez)

```text
Con el design system de D0 establecido, diseñá la BIBLIOTECA DE COMPONENTES de
PERZE. Modo oscuro primero, versión clara al lado. Mobile 390px.

Para cada componente: todos sus estados (default, hover/press, activo, deshabilitado,
error, cargando, vacío) y todas sus variantes.

BASE (shadcn customizado)
1. Botones — primario (relleno #6D55F0 + texto blanco, 56px de alto, ancho completo),
   secundario (borde), fantasma, destructivo, ícono. Tamaños sm/md/lg.
2. Chips y pills — seleccionable, con ícono, con contador, removible.
3. Inputs — texto, búsqueda, textarea. Con label flotante. (Recordá: NO hay input
   numérico; los montos van por keypad.)
4. Switch, checkbox, radio, segmented control.
5. Bottom sheet — con handle de arrastre, 3 tamaños de snap.
6. Toast — éxito con acción de deshacer, advertencia, error, en progreso.
7. Tabs y tab bar.
8. Avatar, badge, separador, tooltip.
9. Skeletons — uno por cada patrón de layout.

PROPIOS DE PERZE
10. `<Amount>` — todas las variantes: hero-xl, hero, inline, en fila de lista.
    Con signo, con moneda distinta a la base (equivalente en línea inferior), en
    modo privacidad (blur). Decisión crítica a respetar: LOS GASTOS VAN EN TEXTO
    NEUTRO, solo los ingresos se destacan en aqua.
11. `<Keypad>` — pantalla completa. Teclas de 64px, dígitos de 32px, columna de
    operaciones + − × ÷, backspace. Estado de tecla presionada.
12. `<CategoryBubble>` — 64px, ícono neutro, seleccionado con anillo violeta.
    Mostrá una grilla de 12.
13. `<AccountCard>` — para el carrusel. Institución, nombre, moneda, país, saldo.
    Variantes: cuenta normal, tarjeta de crédito (con consumo y límite), efectivo,
    broker, cuenta archivada.
14. `<TransactionRow>` — default, con moneda extranjera, pendiente de sincronizar,
    compartida, con adjunto, en cuotas. Y los estados de swipe izquierda/derecha.
15. `<DateStrip>` — tira de días con snap.
16. `<StatTile>` — KPI con label, cifra y delta.
17. `<BudgetRing>` — 0%, 60%, 100%, excedido.
18. `<InsightCard>` — los 4 niveles de estado.
19. `<FxEditor>` — rate sugerido, fuente, antigüedad, slider fino, badge de dato viejo.
20. `<SyncDot>`, `<ScopeSwitcher>`, `<SplitBar>`, `<PrivacyBlur>`.

GRÁFICOS (aplicando las reglas de datos del documento 02)
21. Barra, barra apilada, línea, área, donut, sparkline, bullet, anillo de progreso,
    calendar heatmap, sankey. Cada uno con: leyenda, labels directos selectivos,
    grilla hairline, tooltip táctil, y su toggle de "ver como tabla".

Entregá esto como una hoja de componentes organizada, con el nombre del componente,
sus props conceptuales y una nota de cuándo usarlo y cuándo no.
```

---

## PROMPT D2 — Motion en movimiento

```text
Diseñá la especificación de MOVIMIENTO de PERZE, mostrada como secuencias de
frames (mínimo 4 frames por animación, con el timing anotado).

Curvas del sistema:
  snappy  spring(500, 32, 0.7)   chips, toggles, keypad
  default spring(400, 30, 1)     cards, listas
  soft    spring(260, 26, 1.1)   sheets, pantallas
  bouncy  spring(420, 18, 0.9)   solo celebraciones
Techo: ninguna TRANSICIÓN DE INTERFAZ (la que el usuario tiene que esperar para
seguir operando) supera 320ms. Cuatro excepciones documentadas, todas no bloqueantes:
count-up de cifra 400ms · secuencia de guardado ≤700ms · celebración de hito 900ms ·
dibujado de línea en gráficos 600ms (solo en la carga inicial de analytics).

Animaciones a especificar:
1. Press de botón — scale 0.96, haptic 8ms.
2. Tap en el keypad — cómo entra el dígito nuevo y cómo se desplazan los anteriores.
3. Guardar una transacción — la secuencia completa: botón → círculo → check dibujado
   → la card vuela a la lista → toast con Deshacer. Es LA animación de la app;
   dedicale 8 frames.
4. Lista → detalle de transacción — shared element. Qué elemento se comparte
   exactamente y qué hace el resto.
5. Apertura del bottom sheet de filtros — con el backdrop.
6. Cifra que cambia (odómetro) — al cambiar de período o de scope.
7. Entrada de la lista de movimientos — stagger.
8. Swipe en una fila — resistencia, snap a 96px, ejecución a 160px.
9. Pull to refresh.
10. Anillo de presupuesto llenándose, incluido el caso de sobre-consumo.
11. Entrada de un gráfico de barras y de uno de línea.
12. Celebración de meta alcanzada — 12 partículas, 900ms. Es la única celebración de
    toda la app.
13. Transición entre tabs.
14. Skeleton → contenido real.

Para cada una: propiedades animadas, curva, duración, delay, stagger, y el haptic
que dispara.

Además: mostrá cómo se degrada cada animación en los modos "Reducida" y "Mínima" del
ajuste de intensidad.

Recordatorio de criterio: el "juicy" tiene que venir del movimiento, no del
ornamento. Si una animación necesita un degradado o un brillo para funcionar, está
mal resuelta.
```

---

## PROMPT D3 → D12 — Pantallas de alta fidelidad

> Cada uno de estos prompts se corre después de D0/D1/D2. Estructura común, cambia el bloque.

### Plantilla común (pegar arriba de cada bloque)

```text
Alta fidelidad para el bloque [X] de PERZE. Modo oscuro (y variante clara de las
2 pantallas más importantes del bloque). Mobile 390x844.

Usá EXACTAMENTE los tokens de D0 y los componentes de D1. Si necesitás algo que no
existe en la biblioteca, decímelo antes de inventarlo.

Contenido: datos realistas rioplatenses. Comercios reales (Disco, Devoto, Tienda
Inglesa, Pedidos Ya, Mercado Pago, Abitab, UTE, Antel), montos verosímiles en UYU,
ARS y USD, fechas recientes, nombres de cuenta creíbles (Itaú Caja de Ahorro,
Brou Débito, Mercado Pago, Efectivo, Balanz).

Para cada pantalla entregá:
- La pantalla completa a 390x844
- Sus estados: vacío, cargando (skeleton), error, offline
- Anotaciones numeradas de las decisiones no obvias
- CHEQUEO DE RUIDO: elementos interactivos sobre el pliegue, niveles tipográficos,
  colores no neutros visibles, y si aparece el violeta de marca más de una vez fuera
  de los gráficos. Si viola el presupuesto, decime qué moverías a otra pantalla.
```

### D3 — Onboarding y auth (bloque A)

```text
[plantilla común]

Bloque A: A1 Welcome · A2 Auth · A3 Verificación · A4 País y moneda ·
A5 Solo/pareja/familia · A6 Primera cuenta · A7 Saldo inicial (keypad) ·
A8 Plantilla de categorías · A9 Módulos opcionales · A10 Instalar PWA ·
A11 Éxito + primer gasto.

Foco de este bloque: que el onboarding no se sienta como configurar un ERP. Cada
paso, una sola decisión. La primera vez que el usuario ve el keypad (A7) tiene que
ser un momento agradable: es la promesa de toda la app.

Diseñá también la transición entre pasos: qué se mantiene fijo y qué se mueve.
```

### D4 — Home y navegación (bloque B)

```text
[plantilla común]

Bloque B: B1 Home (3 variantes: perfil Simple / Multi-moneda / Inversor) ·
B2 Home vacío · B3 Skeleton · B4 Offline · B5 ScopeSwitcher abierto ·
B6 Tab bar en detalle · B7 Pantalla "Más" · B8 Búsqueda global.

Foco: el home es la carta de presentación. UNA cifra héroe, un contexto, una acción.
Quiero ver que la versión del perfil Simple es dramáticamente más limpia que la del
Inversor, y que ninguna de las dos se siente incompleta.

Dedicale atención especial al FAB: es el objeto más usado de la app.
```

### D5 — Captura rápida (bloque C) — el bloque más importante

```text
[plantilla común]

Bloque C: C1 Monto (keypad) · C2 Categoría · C3 Detalles · C4 Moneda distinta con FX ·
C5 Ingreso · C6 Transferencia · C7 Confirmación y deshacer (4 frames) ·
C8 Modo ráfaga · C9 Voz · C10 Foto de ticket · C11 Error/offline al guardar.

Este es el bloque que define si la app se usa o se abandona. Diseñalo como si fuera
un producto en sí mismo.

Requisitos duros:
- La cifra en C1 tiene que ser el objeto más impactante de toda la app.
- El keypad tiene que verse y sentirse mejor que el del sistema operativo. Es el
  punto donde el diseño gana o pierde.
- El camino de 3 taps tiene que ser VISIBLE en el diseño: señalá con anotaciones
  exactamente cuáles son esos 3 taps.
- C4 (tipo de cambio) es la pantalla más compleja del bloque. Tiene que sentirse
  simple igual. Si no lo lográs en una pantalla, partila en dos: más pantallas,
  menos por pantalla.

Mostrá C1 en tres momentos: vacío, con "1", y con "1.250,50".
```

### D6 — Transacciones (bloque D)

```text
[plantilla común]

Bloque D: D1 Lista de movimientos · D2 Filtros (sheet) · D3 Detalle ·
D4 Editar · D5 Vista de calendario · D6 Estados vacíos · D7 Selección múltiple.

Foco: la lista se scrollea mucho y tiene mucha densidad potencial. Resolvela con
espaciado y alineación, sin separadores y sin bordes. Los gastos en texto neutro,
solo los ingresos en aqua.

Mostrá una lista con 15 filas reales que incluya: gastos en la moneda de la cuenta,
un gasto en moneda extranjera con su equivalente, un ingreso, una transferencia, una
cuota (4 de 12), una transacción pendiente de sincronizar, y una compartida.
```

### D7 — Cuentas, monedas y FX (bloque E)

```text
[plantilla común]

Bloque E: E1 Lista de cuentas (variante Simple y variante Multi-moneda) ·
E2 Detalle de cuenta · E3 Crear/editar cuenta · E4 Tarjeta de crédito ·
E5 Conciliación · E6 Monedas y tipos de cambio · E7 Estados.

Foco: E6 es donde vive la complejidad del producto. Que se sienta como una pantalla
de consulta clara, no como un panel de configuración. Y E1 en su variante Simple
tiene que verse casi vacía y estar perfecta así.
```

### D8 — Presupuestos, metas, recurrentes, deudas (bloques F+G)

```text
[plantilla común]

Bloques F+G: F1 Presupuestos overview · F2 Detalle · F3 Crear (con dial radial) ·
F4 Alerta de excedido · F5 Metas · F6 Detalle de meta · F7 Crear meta ·
G1 Recurrentes · G2 Detalle · G3 Crear · G4 Deudas y cuotas · G5 Detalle ·
G6 Crear plan de cuotas.
Más la pantalla de activación de cada módulo.

Foco: son módulos que pueden sentirse pesados. Que cada uno tenga UNA pantalla
principal muy clara y el resto en profundidad. El dial radial de F3 es la
oportunidad de mostrar el input físico funcionando fuera del keypad.
```

### D9 — Análisis (bloque H)

```text
[plantilla común]

Bloque H: H1 Analytics home · H2 Categorías · H3 Tendencias · H4 Flujo (Sankey) ·
H5 Patrimonio neto (waterfall) · H6 Multi-moneda · H7 Inflación · H8 Calendario ·
H9 Comercios · H10 Insights · H11 Resumen semanal · H12 Wrapped (6-8 pantallas) ·
H13 Exportar · H14 Estados.

Aplicá estrictamente las reglas de gráficos del documento 02:
- Paleta de datos de 5 slots en orden fijo, gris para "Otros"
- Barras finas con extremo redondeado de 4px anclado a la baseline
- Líneas de 2px, markers ≥8px
- Separador de 2px del color de superficie entre segmentos apilados
- Grilla hairline solo horizontal, sin bordes de caja
- Leyenda siempre con ≥2 series; labels directos selectivos, nunca uno por punto
- El texto en tokens de tinta, nunca en el color de la serie
- Nunca eje dual
- Toggle "ver como tabla" en cada card de gráfico
- Tooltip táctil con offset vertical de 48px

Una card = un gráfico = una pregunta. Si una card responde dos preguntas, son dos
cards.

H12 (Wrapped) es la excepción estética de toda la app: ahí sí puede haber más
expresión visual, porque es contenido para compartir. Pero sigue siendo minimalista:
una cifra gigante por pantalla y nada más.
```

### D10 — Inversiones (bloque I)

```text
[plantilla común]

Bloque I: I1 Activación · I2 Portfolio overview · I3 Posiciones · I4 Detalle de
instrumento · I5 Registrar operación · I6 Registrar renta · I7 Buscar/agregar
instrumento · I8 Clases de activo · I9 Allocation y rebalanceo · I10 Rendimiento ·
I11 Calendario de renta futura · I12 Estados.

Foco: es el módulo con más riesgo de convertirse en una planilla. La lista de
posiciones (I3) es la prueba: mostrala con 8 posiciones reales (una acción USA, dos
CEDEARs, un bono soberano, una ON, un FCI, BTC, un plazo fijo) sin que parezca una
tabla de Excel. Si en mobile no entra la información sin comprimir, decidí qué NO va
en la fila y va en el detalle.

Datos realistas: AAPL, MELI, YPFD, AL30, ON YPF 2029, BTC, plazo fijo UYU.
```

### D11 — Grupo familiar (bloque J)

```text
[plantilla común]

Bloque J: J1 Activación e invitación · J2 Household overview · J3 Invitar miembro ·
J4 Permisos y visibilidad · J5 Gastos compartidos · J6 Dividir un gasto ·
J7 Liquidar · J8 Comparativa entre miembros · J9 Actividad · J10 Estados.

Foco delicado: la app comparte finanzas de una pareja. J8 (comparativa) no puede
sentirse como vigilancia y J4 (visibilidad) tiene que ser comprensible en 5 segundos
sin leer documentación. Diseñá J4 como algo que se entiende mirando, no leyendo.

J6 (dividir con barra arrastrable) es otro momento de input físico: mostralo en 3
frames de arrastre.
```

### D12 — Ajustes y estados transversales (bloques K+L)

```text
[plantilla común]

Bloques K+L: K1 Índice de ajustes · K2 Perfil · K3 Preferencias · K4 Módulos ·
K5 Categorías · K6 Tags y comercios · K7 Reglas · K8 Fuentes de FX · K9 Importar ·
K10 Exportar/backup · K11 Seguridad · K12 Notificaciones · K13 Acerca de ·
L1 Sistema de estados vacíos (10 secciones) · L2 Skeletons · L3 Errores ·
L4 Toasts · L5 Onboarding contextual · L6 Pantalla de bloqueo.

Foco: los ajustes son donde las apps se vuelven feas. Que esta sea la excepción.
Agrupación clara, sin íconos decorativos, sin badges innecesarios.

L1 es importante: diseñá UN sistema consistente de estado vacío (un ícono de línea,
una frase, una acción) y aplicalo a las 10 secciones. Que se vean como familia.
```

---

## PROMPT DV — Auditoría visual final

```text
Terminamos el diseño de alta fidelidad de PERZE. Auditá el resultado completo.
Sé crítico: prefiero encontrar los problemas ahora.

1. CONSISTENCIA DE SISTEMA
   - ¿Hay valores que se salieron de los tokens? (colores fuera de paleta, tamaños
     fuera de la escala tipográfica, espaciados fuera del grid de 4px, radios
     inventados). Listalos todos con la pantalla donde aparecen.
   - ¿El mismo componente se ve distinto en dos pantallas?

2. PRESUPUESTO DE RUIDO
   - Recorré todas las pantallas y listá las que violan el presupuesto:
     1 cifra héroe · 1 color de marca visible fuera de los gráficos ·
     1 acción primaria · 3 niveles tipográficos ·
     5 elementos interactivos sobre el pliegue · 0 bordes de caja evitables ·
     0 iconos decorativos.
   - ¿Se respeta la regla del 90% neutro? Estimá el porcentaje de píxeles no neutros
     de las 10 pantallas más cargadas.

3. COLOR
   - ¿Aparece el violeta de marca en algún lugar donde no signifique accionable,
     seleccionado o marca?
   - ¿Hay verde/rojo usado como polaridad de dinero? (No debe haberlo.)
   - ¿Algún color de estado se usó como color de serie?
   - Verificá los contrastes: texto sobre cada superficie, relleno de botón contra su
     superficie, cada slot de datos contra el fondo del gráfico. Listá lo que no
     llegue a AA.

4. GRÁFICOS
   - Chequeá cada gráfico contra las reglas del documento 02: eje dual (prohibido),
     número sobre cada punto (prohibido), texto en color de serie (prohibido),
     leyenda faltante con ≥2 series, más de 5 series, ausencia del toggle de tabla,
     rampa arcoíris, hue en el punto medio de una divergente.

5. MOVIMIENTO
   - ¿Alguna TRANSICIÓN DE INTERFAZ pasa de 320ms? (Las cuatro excepciones
     documentadas —count-up, guardado, celebración, dibujado de línea— no cuentan.)
   - ¿Hay animaciones que bloquean la interacción?
   - ¿Todas degradan bien en modo reducido?

6. TÁCTIL
   - Listá todo target menor a 44x44.
   - ¿Alguna acción primaria queda fuera de los últimos 200px de la pantalla?
   - ¿Algún gesto no tiene alternativa por tap?

7. ACCESIBILIDAD
   - ¿Algún significado se comunica solo por color?
   - ¿Los estados de foco existen y se ven, para navegación por teclado en desktop?
   - ¿La app funciona con el texto al 200%?

8. VEREDICTO
   Las 10 cosas a arreglar antes de programar, ordenadas por costo de arreglarlas
   después. Y una: ¿qué pantalla es la mejor de la app y por qué? Quiero saber cuál
   es el estándar a igualar.
```
