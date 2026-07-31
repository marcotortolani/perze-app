# PERZE — Auditoría visual antes de programar

## Alcance de esta auditoría, y qué no cubre

Auditado **mirando el archivo**: F+G (18 frames), H (15 + wrapped), I (14), J (14), L (5 sistemas)
y K1–K2. Son las vistas que viven en este proyecto y las que pude medir.

Auditado **por contrato, no por píxel**: A, B, C, D, E y K3–K13. Cada bloque fijó su copia del
bundle en su propio proyecto y desde acá no se abren, así que sobre ellos sólo puedo cruzar lo
que declaran los prompts, el documento 02 y los reportes de deuda que cada bloque dejó. Los
defectos que involucran a esos bloques están marcados **[cruzado]**: son contradicciones entre
lo que un bloque declara y lo que otro hizo, no observaciones visuales. Si alguien necesita las
82 vistas auditadas a ojo, hay que consolidarlas en un proyecto y volver a correr esto; decir
que las conté sería mentirte.

Total de defectos: **41**. Ordenados por costo de arreglarlos después, no por gravedad estética.

---

## Las cinco cosas que arreglaría antes de escribir una línea más de código

**1 · `EmptyState` dibuja un ícono de línea y el sistema de marca pide la grilla de la Z.**
No es un detalle cosmético: hay **68 estados vacíos** ya diseñados usando el componente del
bundle (los cuatro estados por vista de F+G, H, I y J salen todos de `StateFrame`, que usa
`EmptyState`), y L1 declara que el patrón es `ZMark` al 20%. Hoy la app tiene dos sistemas de
vacío conviviendo. Arreglado en el componente: una tarde. Arreglado después de programar: 68
pantallas revisadas de a una, y la garantía de que van a quedar tres o cuatro con el ícono
viejo. → *D01*

**2 · La selección por superficie es casi invisible en modo claro.**
Toda la app muestra selección con `--surface-3` sobre `--surface-2`. En oscuro son `#26262A`
sobre `#1B1B1E`: se ve. En claro son `#EEEEEC` sobre `#F5F5F4`: 1,5% de diferencia de
luminancia, por debajo de lo perceptible en un teléfono al sol. El mecanismo central de
selección del sistema —segmentados, chips de período, burbujas de categoría, tira de días,
carrusel de cuentas, pills de frecuencia, clases de activo— **no funciona en uno de los dos
modos**, y los dos son de primera clase. Es un ajuste de token ahora; después es re-auditar
catorce componentes y todas sus pantallas. → *D02*

**3 · Trece agregados muestran un número sin declarar los movimientos sin cotización.**
La regla dice que todo agregado excluye `needs_fx` y muestra el conteo con acceso a resolverlo.
Cumplen F0, F1, F5, F0m, H1, H2, H4, H5, H6, H7. **No cumplen: H3, H8, H9, H11, F2, G1, G4, I2,
I3, I11, J2, J7 y el patrimonio de K1.** Cada una de esas pantallas muestra un número que puede
estar mal y no lo dice. Un `NeedsFxBanner` compartido más una regla de "todo componente que
sume declara su exclusión" cuesta una tarde; trece parches después de QA cuestan una semana y
van a quedar inconsistentes entre sí. → *D03*

**4 · `SplitBar` es un control pintado con la paleta de datos, y `charts.css` prohíbe
exactamente eso.** El archivo de tokens dice, textual, que la paleta de datos nunca se usa para
pintar un control. `SplitBar` colorea sus partes con `--data-1..5` por índice, así que en I9 el
riel de allocation aparece con violeta de marca (slot 1) dentro de un control arrastrable, y en
J2/J6 los tramos usan colores de miembro que en otras pantallas significan identidad de
persona. Es la única contradicción directa entre un token y un componente del sistema. → *D04*

**5 · Faltan pasos entre bloques y hay siete vistas a las que no se llega desde ningún lado.**
Sin diseñar: el importador de CSV completo (K9, uno de los diez flujos críticos), el selector de
transacción con tarjeta que alimenta G6, el formulario de "crear instrumento a mano" que promete
I7, y el modo espejo que promete J4. Huérfanas: I9, I10, I11, H12 y J8 no tienen entrada desde
ninguna pantalla diseñada. Encontrar esto ahora son dos días de wireframe; encontrarlo con las
rutas programadas es replumbing de navegación. → *D05, D06*

---

## 1 · Consistencia — el mismo problema resuelto de dos maneras

| # | Defecto | Vista · bloque | Costo si se programa |
|---|---|---|---|
| D01 | **Dos sistemas de estado vacío**: `EmptyState` con ícono de línea de 32 px (68 usos, todos los `StateFrame` de F+G, H, I, J) contra la grilla de la Z al 20% que declara L1. | L1 vs. todos los estados | Alto |
| D07 | **Cinco formas de entrar a editar.** Chip "Editar" (K2, I12), fila con chevron (K1, K3, E3), tap en la fila que alterna estado sin chevron (J4), botón primario que edita el objeto de la pantalla (F2 "Ajustar a $ 10.000"), y long-press en el centro del dial para abrir el keypad (F3). Nadie va a descubrir la cuarta y la quinta. | J4, F2, F3 vs. K1–K3 | Alto |
| D08 | **Dos formas de pedir confirmación, y una contradice el principio.** L4 fija tres diálogos y dice explícitamente que apagar un módulo **no** califica porque es reversible; F+G e I1b muestran un `Sheet` de confirmación para apagar un módulo. O el sheet no es una confirmación y hay que sacarle el botón de cancelar, o L4 tiene cuatro casos y no tres. | F0-apagar, I1b vs. L4 | Alto |
| D09 | **Tres formas de presentar dinero en una lista.** Con símbolo y `Amount` (D1, F1, G1, G4, J5), sin símbolo en mono porque "está declarado arriba" (I3, decidido y anotado), y con símbolo dentro del texto de la línea inferior (I3 línea 2, H4). La misma app tiene dos convenciones de cuándo se repite el `$`. | I3 vs. resto | Medio |
| D10 | **Dos tratamientos de "número malo" en contextos vecinos.** Presupuesto excedido en `critical` (F1) y rendimiento negativo en naranja `money-negative-emphasis` (I3). Los dos son "esto está para peor" y usan colores distintos. Está justificado —uno es estado, otro es polaridad— pero no está escrito en ningún lado, así que el primero que programe va a elegir uno. | F1 vs. I3 | Medio |
| D11 | **Dos escalas para la cifra más grande de la app.** `hero-xl` 64 aparece en J7 (liquidar) y en H11 (resumen semanal) para cosas de peso muy distinto, y en el resto de la app el máximo es `hero` 40. No hay regla escrita de cuándo se gana el 64. | J7, H11, H12 | Bajo |
| D12 | **Selección por superficie vs. relleno de marca sin regla de borde clara.** `Chip selected` y `Switch` usan marca; segmentados, burbujas y pills usan superficie. En I1 las clases de activo son pills de superficie y en D2 los filtros activos son chips de marca: dos multi-selecciones con tratamientos opuestos, y la diferencia real (filtro activo vs. elección de configuración) no está declarada en el contrato. | I1 vs. D2 **[cruzado]** | Medio |
| D13 | **Dos formas de mostrar progreso.** Barra de 8 px (F5, F6, G4, G5, I9) y `BudgetRing` de 88 px (existe en el bundle, se usa en F1 según el bloque F original). En mi F1 no usé el anillo justamente porque fuerza violeta: el resultado es que el sistema tiene un componente de progreso que la app no usa. | F1, F5 vs. bundle | Bajo |

## 2 · El violeta — pantallas que se pasan de uno

Contadas las 47 vistas que puedo medir. Fuera de gráficos.

| # | Pantallas | Motivo | Veredicto |
|---|---|---|---|
| D14 | F0, F0m, G0r, G0d, I1, J1, J3, K2, K11 (spec) | Switch encendido + botón primario | **Excepción del sistema, aceptada**: el estado de un binario necesita relleno. Pero son 9 pantallas y el documento 02 la declara para *una* (Apariencia). Hay que reescribir la excepción como regla general o bajar el switch a superficie. |
| D15 | H1a, H1b, J2 | ScopeSwitcher con relleno de marca + FAB | Aceptada (identidad de dato), pero son **dos** violetas antes de contar cualquier acción primaria: en H1 el FAB queda como el segundo y no hay tercero disponible. |
| D16 | K13 (spec), L4 en contexto | `UndoToast` con "Deshacer" en violeta + FAB visible | Excepción acotada a 5 segundos, declarada en L4. Aceptable. |
| D17 | **I9** | El riel del `SplitBar` pinta el slot 1 —violeta de marca— dentro de un control, y además hay botón primario | **Violación real.** Es D04. |
| D18 | **H9** | La fila "Ver los 27 comercios" usa `variant="action"` (tinta violeta) y es la única acción: correcto. Pero H9 no tiene botón primario, así que la app tiene dos convenciones de "acción primaria": botón relleno y fila en tinta. | Menor, pero hay que elegir una. |

Sin violeta y correctas: F1 (después del arreglo), H2–H8, H10–H12, I10, J8, J8b, J9, K1, L1, L2.

## 3 · Cifra héroe — pantallas con dos peleándose

| # | Vista · bloque | Qué pasa |
|---|---|---|
| D19 | **H1a / H1b** | Cuatro `StatTile` de 30 px. Son cuatro cifras del mismo tamaño: no hay héroe, hay un empate. `StatTile size="compact"` (title 22) lo resuelve y además devuelve la pantalla a tres niveles tipográficos. |
| D20 | **I2** | `hero` 40 del valor del portfolio + cuatro tiles de 30. Cinco cifras grandes. Mismo arreglo. |
| D21 | **I5** | Dos cifras mono de 22 (cantidad y precio) más el total de 22 en la card de preview. Tres cifras del mismo peso y ninguna manda. Es la peor de las tres. |
| D22 | F3 | Total asignado 40 + monto del dial 40. Declarada como excepción con motivo (el dial es el objeto que se crea). La dejo, pero es la única excepción que quiero ver escrita en el contrato. |
| D23 | J6 | Total 40 + dos resultados de 22. Correcto: 22 no compite con 40. Sin acción. |

## 4 · Densidad — se pasan de 5 interactivos o 3 niveles

| # | Vista | Interactivos sobre el pliegue | Niveles | Nota |
|---|---|---|---|---|
| D24 | **I5** | 6 | 3 | Se pasa. Partición ya propuesta: comisiones y fecha al paso 2. |
| D25 | H1a, H1b | 5 | **4** | El cuarto lo aporta el tile de 30. Se arregla con D19. |
| D26 | I2 | 5 | **4** | Ídem D20. |
| D27 | G4 | 4 | **4** | El cuarto es el `title` de "me deben". Deliberado: es lo que separa las dos plata. Se queda declarado. |
| D28 | F2 | 3 | **4** | El cuarto es el título de card en 15/600. Se arregla bajándolo a caption 11: cero costo. |
| D29 | F7, G3, H10, I12, J3, K2 | 5 | 3 | Al límite. Cualquier campo nuevo las pasa. Hay que anotarlas como congeladas. |
| D30 | Cualquier pantalla con `DismissibleNotice` | +3 | — | El tooltip de L5 suma tres interactivos, así que sólo puede aparecer en pantallas que estén en 2 o menos. **No está mapeado pantalla por pantalla** y hoy L5 lo pone en Cuentas, que ya tiene 4. |

## 5 · Progresividad con todos los flags en el mínimo

Una moneda, un miembro, cero módulos.

| # | Defecto | Vista · bloque |
|---|---|---|
| D31 | **K1 muestra filas que no deberían existir**: "Grupo familiar · 2 personas" y "Tipos de cambio · 2 pares" están escritas fijas. Con un miembro y una moneda, las dos tienen que desaparecer, no quedar en cero. | K1 |
| D32 | **El chip "Resolver" de needs_fx aparece en H1 sin condición.** Con una sola moneda no puede haber movimientos sin cotización: la fila entera se oculta, no muestra "0 sin cotización". | H1 |
| D33 | **H1 con todo apagado queda con dos KPI y tres cards de "todavía no".** Funciona y es honesto, pero es la única pantalla de la app que en su estado mínimo tiene más "todavía no" que contenido. Vale revisar si con cero módulos conviene que Análisis muestre directamente el estado de L1 hasta los 30 días. | H1a |
| D34 | **La tab bar cambia de contenido según un módulo**, y eso está bien resuelto (K3 lo elige el usuario, default Análisis), pero **B7 y K3 son dos lugares donde se configura lo mismo**: "Activar más funciones" en Más y el cuarto slot en Preferencias. Hay que decidir cuál manda. **[cruzado]** | B7 vs. K3 |
| D35 | Todo lo demás pasa: F, G, I, J no existen; H1 no lista lo que depende de módulos apagados; K3 dice "tu moneda"; J4/J8 no existen sin segundo miembro. | — |

## 6 · Polaridad y daltonismo

| # | Defecto | Vista · bloque |
|---|---|---|
| D36 | **Verde sobre una comparación de dinero.** H11 usa `StatusBadge status="good"` (verde `#0CA30C`) para "12% menos" y J7 lo hereda en su estado vacío. El sistema prohíbe verde/rojo como polaridad de dinero; que lleve ícono y label no lo salva, porque el significado es exactamente monetario. Cambiar a neutro con flecha. | H11, J7 |
| D37 | Ingresos en aqua y gastos en tinta: **cumple** en D1, F1, H, I3, J5. `Amount` lo garantiza cuando `showSign` es false. Sin hallazgos. | — |
| D38 | Rampa de datos y estados: ningún color de estado se usó como color de serie; ninguna serie usa `--good`. **Cumple.** | — |
| D39 | Todos los estados llevan ícono + label; todos los miembros llevan inicial. **Cumple.** Único punto frágil: J4 depende de "hay cara o no hay cara", que en escala de grises se sostiene por el ojo tachado + "Solo vos". Verificado. | J4 |

## 7 · needs_fx en agregados

Detalle de D03. Cumplen: F0, F0m, F1, F5, H1, H2, H4, H5, H6, H7.

| # | Vista · bloque | Agregado que muestra sin declarar exclusión |
|---|---|---|
| D03a | F2 | Gastado del mes por categoría ($ 9.440) |
| D03b | G1 | Comprometido por mes ($ 7.940) |
| D03c | G4 | Debo ($ 198.000) y compromiso de 12 meses |
| D03d | H3 | Serie de 6 períodos y comparación año contra año |
| D03e | H8 | Gasto diario promedio y heatmap del año |
| D03f | H9 | Top 5 de comercios ($ 37.830) |
| D03g | H11 | Total de la semana ($ 14.280) |
| D03h | I2 | Valor del portfolio en pesos — convierte USD con una cotización que puede faltar |
| D03i | I3 | Total de 8 posiciones ($ 958.220) |
| D03j | I11 | Renta futura de 12 meses ($ 56.200), toda en dólares |
| D03k | J2 | Patrimonio del grupo ($ 1.812.400) y aportes por miembro |
| D03l | J7 | **El más grave**: el neto a liquidar. Un gasto compartido en dólares sin cotización cambia quién le debe a quién. |
| D03m | K1 | El valor "UYU · cierra el 25" no, pero el patrimonio que K1 no muestra sí lo haría si se agrega |

## 8 · Los diez flujos críticos

| # | Flujo | Hallazgo |
|---|---|---|
| D05a | Importar CSV | **Sin diseñar.** K9 quedó fuera cuando K se cortó. Es uno de los diez y el único que trae datos sucios. |
| D05b | Crear plan de cuotas desde una transacción con tarjeta | **Falta el paso del medio**: G6 arranca con la compra ya elegida y el selector de transacciones con tarjeta no existe en D ni en G. |
| D05c | Agregar instrumento a mano | I7 termina en el botón: el formulario de cuatro campos que promete no está dibujado. |
| D05d | Ver la app como la ve el otro miembro | J4 promete el modo espejo y no existe. Es lo que convierte J4 de promesa en prueba. |
| D06a | Vistas huérfanas | **I9, I10, I11, H12, J8** no tienen entrada desde ninguna pantalla diseñada. I2 tiene dos tiles que deberían llevar a I10 y no son filas; J2 tiene filas a J4 y J9 pero no a J8. |
| D40 | Conflicto de sincronización | Bien: J10 y L3 son la misma pantalla y quedó unificada. Único pendiente: el conflicto de **cuenta** y de **presupuesto** usa la misma plantilla pero nadie definió qué campos compara. |
| D41 | Primer gasto en menos de 90 s, gasto en otra moneda, transferencia, gasto offline, gasto compartido, presupuesto excedido | Cerrados de punta a punta según los contratos de A–E y F4/J6. **[cruzado]** |

## 9 · Modo claro

| # | Defecto | Por qué |
|---|---|---|
| D02 | Selección por superficie (ver top 5) | `#F5F5F4` vs `#EEEEEC`: 1,5% de luminancia. Afecta a `SegmentedControl`, `Chip` no seleccionado, `CategoryBubble`, `DateStrip`, `AccountCarousel`, pills de F3/F7/G3/G6/I1, `SelectableRow`, `OptionCard`, `InstitutionTile`. |
| D42 | **Heatmap invertido.** H8 usa `--violet-700` (casi negro) como intensidad baja y `--violet-300` como alta. En claro, la rampa tiene que invertirse o el día sin gasto va a ser el más oscuro de la grilla. | H8 |
| D43 | **Cintas del Sankey.** H4 mezcla el color de destino al 30% con `--surface-1`; en claro eso es mezclar con blanco: las tres bandas quedan casi del mismo pastel y el cruce deja de leerse. Hay que subir la mezcla en claro o usar los tokens de divergente. | H4 |
| D44 | **La marca de la Z al 20%** sobre página clara queda en un gris muy liviano; sobre `--surface-2` (los vacíos dentro de una card) casi desaparece. Necesita 28% en claro. | L1 |
| D45 | **Avatares con `--primary-on-fill` blanco** sobre `--data-2` aqua claro (`#12916A`) pasa AA justo; sobre `--data-3` naranja claro (`#D95926`) también, pero sobre cualquier slot más liviano no. Fijar que la inicial use blanco o tinta según luminancia del slot. | J1–J10 |

## 10 · Motion — dos transiciones para el mismo cambio

| # | Defecto | Detalle |
|---|---|---|
| D46 | **Lista → detalle tiene dos tratamientos.** D2 especifica shared element (la fila se convierte en el header del detalle); F1→F2, G1→G2, I3→I4 y J5→J6 quedaron descritos como push lateral. Es el cambio de pantalla más frecuente de la app después del tab. | D vs. F, G, I, J |
| D47 | **Deshacer tiene dos animaciones.** En C7 la card vuelve volando a la lista; en el swipe de D1 la fila simplemente reaparece. Mismo evento, dos lecturas. | C7 vs. D1 **[cruzado]** |
| D48 | **Activar un módulo** entra a su overview con un push de pantalla, pero **prender inversiones** además reconfigura la tab bar: eso necesita una transición propia y no está definida. Hoy la tab bar cambiaría de golpe. | I1 → I2 |
| D49 | Sheets, tabs, keypad, listas y gráficos: una sola curva por tipo, techo de 320 ms respetado, cuatro excepciones documentadas. **Cumple.** | — |

---

## Cierre

Lo que más me preocupa no es ninguno de los 49 puntos sueltos: es que **tres de los cinco
primeros son contradicciones entre la biblioteca y el sistema de marca** (vacío, selección en
claro, paleta de datos pintando controles). Eso quiere decir que el problema no está en las
pantallas, está en que el contrato de componentes se escribió después de las pantallas. Con el
contrato ya publicado, el orden correcto para lo que queda es: arreglar los cinco de arriba en
la biblioteca, diseñar K9 y los cuatro pasos faltantes, y recién entonces empezar a programar.
