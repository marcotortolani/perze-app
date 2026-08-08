# Novedades de Perze

Este es el changelog que se muestra **dentro de la app** (Más → Acerca de → Novedades). Es
distinto de `CHANGELOG.md`: ese es técnico, para quien programa Perze; este es para quien la usa.

## Cómo escribir una entrada acá

Estas reglas son el contrato de este archivo — léelas antes de agregar una entrada, no las
inventes de memoria.

- **Para quién es**: la persona que usa la app, no quien la programa. Nunca nombres un archivo,
  una tabla, un componente, una librería o un patrón de código. Si la explicación necesita esas
  palabras para tener sentido, no está lista para acá — reescribila desde lo que la persona *ve* o
  *puede hacer ahora*, no desde lo que cambió por dentro.
- **Tono**: directo, en segunda persona ("podés", "ahora se ve", "arreglamos"), sin exclamaciones
  de marketing ni humor forzado. Una entrada de changelog no es un anuncio de producto — es un
  aviso útil.
- **Largo**: una línea por entrada, dos como máximo si de verdad hace falta contexto para que se
  entienda por qué importa. Si una entrada necesita un párrafo, es candidata a dividirse en dos
  entradas más chicas o a no estar acá.
- **Agrupar por versión**, con la fecha en español ("6 de agosto de 2026", nunca ISO ni numérico).
  Formato exacto del encabezado: `## {version} — {fecha en español}`.
- **Tres categorías posibles dentro de cada versión**, en este orden cuando aplican más de una:
  `### Nuevo`, `### Mejorado`, `### Arreglado`. Sin subcategoría si la versión trae una sola cosa.
- **Qué entra y qué no**: solo cambios que la persona usuaria puede notar o que le resuelven algo
  — una pantalla nueva, un bug visible, un flujo que ahora es más corto. Lo que **no** entra:
  refactors, cambios de infraestructura, fixes de tests, correcciones de tipos, trabajo interno de
  sincronización que no cambia lo que se ve. Si una versión técnica (`CHANGELOG.md`) no tiene
  ningún cambio user-facing, esa versión simplemente no aparece acá — no hay que forzar una
  entrada por cada bump de `package.json`.
- **Un bug arreglado se describe por el síntoma, no por la causa**: "el total de la cartera de
  inversión ahora suma bien cuando tenés posiciones en distintas monedas", nunca "corregido el
  cálculo de conversión FX en `OverviewContent.tsx`".
- **Solo español, a propósito.** Traducir cada entrada a los tres idiomas de la app en cada
  versión es un costo de mantenimiento recurrente que no se paga solo para un proyecto personal —
  la alternativa (dejar de escribir el changelog público, o escribirlo cada tanto en un idioma
  fijo) es peor que aceptar esta limitación y decirla en voz alta. Si esto cambia algún día, es una
  decisión de producto nueva, no algo para "arreglar" en silencio agregando next-intl acá.
- **Nunca se edita una entrada ya publicada** salvo error de tipeo — es un registro histórico, no
  un documento vivo. Una corrección de producto entra como una entrada nueva en la versión
  siguiente.

## 0.29.89 — 8 de agosto de 2026

### Nuevo

- En Más → Estado de sincronización ahora podés descartar una entrada atascada que no vale la
  pena reintentar — con unos segundos para deshacer si te arrepentís.

### Mejorado

- Las cotizaciones que elegís o cargás a mano ahora se actualizan solas entre tus dispositivos,
  sin tener que entrar a la pantalla de monedas en cada uno.

### Arreglado

- Los saldos de las cuentas ya no quedan distintos entre dispositivos cuando una sincronización
  se atasca — al resolver o descartar el problema, el saldo vuelve solo al valor real.
- Un movimiento que el servidor rechazó ahora queda marcado en la lista, en vez de verse como
  uno más.
- Una cotización cargada a mano sin conexión ya no se pierde al volver la señal.

## 0.29.88 — 8 de agosto de 2026

### Arreglado

- En las pantallas de bienvenida y "Sobre Perze", el botón de abajo ya no queda pegado al borde
  de la pantalla.

## 0.29.87 — 8 de agosto de 2026

### Nuevo

- Las tres pantallas de bienvenida ahora muestran una animación de lo que describen (cargar un
  gasto, tus cuentas en varias monedas, prender módulos) en vez de un espacio vacío.

### Mejorado

- La pantalla "Sobre Perze" tiene el mismo diseño que la de bienvenida ahora.

### Arreglado

- La pantalla de bienvenida pública a veces scrolleaba mal en el celular. Ya no.

## 0.29.86 — 8 de agosto de 2026

### Arreglado

- El indicador de filtros en Movimientos ya no se prendía solo por tener "Este mes" seleccionado
  (que es el filtro por defecto). Ahora solo se prende cuando elegís otro rango de fechas.

## 0.29.85 — 8 de agosto de 2026

### Mejorado

- Rediseñamos la página de bienvenida que ves antes de entrar a Perze — más clara y directa.

## 0.29.84 — 8 de agosto de 2026

### Nuevo

- Debajo de lo gastado e ingresado en el período, ahora ves de un vistazo si vas positivo o
  negativo: una flecha con el monto de la diferencia, sin tener que restar a ojo.

## 0.29.83 — 8 de agosto de 2026

### Nuevo

- El home ahora tiene una sección de Inversiones (si tenés el módulo activado y al menos una
  posición cargada): cuánto vale tu cartera hoy, cuánto cambió en la última semana y un gráfico
  de su evolución.

### Arreglado

- El gráfico de tendencia del patrimonio neto en el home ya no contaba las compras/ventas de
  inversión ni las conciliaciones de saldo como si fueran gastos.

## 0.29.82 — 8 de agosto de 2026

### Arreglado

- El menú lateral en escritorio ya no muestra una barra de scroll de mentira cuando todas las
  opciones entran cómodas en pantalla.

## 0.29.81 — 8 de agosto de 2026

### Arreglado

- Comprar o vender una inversión ahora sí descuenta o acredita la cuenta que usaste para
  pagar/cobrar, y el patrimonio neto suma el valor de tus posiciones — antes la plata quedaba sin
  reflejarse en ningún lado.
- Vender más cantidad de la que tenés de un instrumento ya no hace que la posición desaparezca:
  el teclado te avisa si te pasás.

## 0.29.80 — 8 de agosto de 2026

### Nuevo

- Movimientos ahora abre directo en el mes en curso, para que cargue más rápido a medida que se
  acumula historial. Para ver meses o años anteriores, hay un botón nuevo "Historial" que deja
  elegir año y mes.

## 0.29.79 — 8 de agosto de 2026

### Nuevo

- Un movimiento generado por un recurrente ahora muestra a qué recurrente pertenece, tanto en el
  detalle como en la lista (sin repetir la categoría dos veces), y podés filtrar y buscar
  movimientos por recurrente.

## 0.29.78 — 7 de agosto de 2026

### Nuevo

- Cuando "Cargar ahora" en un recurrente manual va a caer en la cuenta de respaldo en otra
  moneda, ahora se muestra antes una pantalla para revisar y corregir la cotización o el monto
  final — por si lo que descontó el banco fue distinto a lo que el sistema calculó.

## 0.29.77 — 7 de agosto de 2026

### Arreglado

- "Cargar ahora" en un recurrente manual ya no se puede disparar por error para meses que todavía
  no llegaron: ahora solo carga lo vencido o lo que vence hoy, para que tocar el botón varias veces
  no termine registrando pagos futuros sin querer.

## 0.29.76 — 7 de agosto de 2026

### Arreglado

- Al tocar "Cargar ahora" en un recurrente manual, la pantalla ahora refleja al instante que ese
  período ya quedó pagado — antes seguía apareciendo como pendiente hasta salir y volver a entrar,
  y hasta el resumen de arriba de la lista de recurrentes seguía anunciándolo como "próximo".

## 0.29.75 — 7 de agosto de 2026

### Nuevo

- Los recurrentes manuales (con auto-registro apagado) ahora pueden tener una cuenta de respaldo:
  si al tocar "Cargar ahora" la cuenta principal no tiene fondos suficientes, el gasto se registra
  en la de respaldo en vez de dejarla en negativo, convertido a su moneda si hace falta.

## 0.29.74 — 7 de agosto de 2026

### Arreglado

- Al resolver tipos de cambio pendientes en cuentas, ahora se ve la fuente real de la cotización
  en vez de un texto fijo, y podés escribir la tasa en cualquiera de las dos direcciones (por
  ejemplo "1 dólar = X pesos" o "1 peso = X dólares"), igual que en Monedas.

## 0.29.73 — 7 de agosto de 2026

### Arreglado

- "Nuevo recurrente" recupera la barra de navegación de abajo: la pantalla scrollea entera y al
  final queda espacio libre para que el botón "+" no tape el de guardar.

## 0.29.72 — 7 de agosto de 2026

### Arreglado

- "Nuevo recurrente" había quedado sin poder deslizarse hacia abajo en el celular después del
  cambio anterior — ya se puede scrollear normal.

## 0.29.71 — 7 de agosto de 2026

### Arreglado

- "Nuevo recurrente": encontramos la causa real de que el botón de guardar quedara tapado — la
  pantalla no debía tener la barra de navegación de abajo, y por eso se sacó del todo. Ahora es
  una pantalla de carga simple, sin nada que se le pueda superponer.

## 0.29.70 — 7 de agosto de 2026

### Arreglado

- "Nuevo recurrente" en el celular: más aire todavía al final de la pantalla para que el
  botón de guardar no se tape con el "+".

## 0.29.69 — 7 de agosto de 2026

### Nuevo

- Los recurrentes que cargás a mano (auto-registro apagado) ahora te avisan: un día antes, el
  día que vencen, y al día siguiente si todavía no lo cargaste.

## 0.29.68 — 7 de agosto de 2026

### Arreglado

- "Nuevo recurrente" en el celular: ahora la pantalla entera se desliza de forma normal, en
  vez de tener una zona chica separada que scrolleaba distinto al resto de la app.

## 0.29.67 — 7 de agosto de 2026

### Arreglado

- "Nuevo recurrente" en el celular: el botón de guardar de verdad ya no queda tapado — el
  arreglo anterior no era suficiente, ahora el formulario está reorganizado para que el monto,
  el teclado y "Guardar" siempre estén a la vista.

## 0.29.66 — 7 de agosto de 2026

### Arreglado

- El aire de despeje abajo de varias pantallas (Inicio, Ajustes, Más, Movimientos, Cuentas, y
  ahora también "Nuevo recurrente") no se estaba aplicando por un detalle técnico — ya se ve
  bien en todas.
- "Cargar ahora" en un recurrente manual ahora aparece siempre, no solo cuando ya venció —
  vos decidís cuándo pagarlo.
- Los recurrentes ahora se ven en dos grupos separados, automáticos y manuales, para
  distinguirlos de un vistazo.

## 0.29.65 — 7 de agosto de 2026

### Arreglado

- Un recurrente nuevo podía desaparecer solo, sin dejar rastro, poco después de crearlo.
- Al tocar "Cargar ahora" en un recurrente vencido a veces se disparaba un error que no paraba
  de repetirse.
- Los recurrentes pendientes de carga manual ahora se pueden tocar para ver el detalle y
  editarlos, en vez de solo tener el botón de cargar.
- Si cargás a mano un recurrente vencido varios días después de su fecha, ahora se registra con
  la fecha y la cotización del día en que realmente lo cargaste, no con las del día original.
- Más aire abajo en la pantalla de "Nuevo recurrente" en el celular, para que el botón de
  guardar no quede tapado.

## 0.29.64 — 7 de agosto de 2026

### Arreglado

- Ahora hace falta el PIN para desactivar el bloqueo por PIN — antes cualquiera con tu
  teléfono desbloqueado podía apagar la protección sin conocerlo.

## 0.29.62 — 7 de agosto de 2026

### Arreglado

- El selector Personal/Compartido/Todo ya no queda pegado al borde superior de la pantalla en
  el celular.

## 0.29.61 — 7 de agosto de 2026

### Mejorado

- Ajustes se reorganiza en dos secciones: Datos (moneda, cotizaciones, formatos, cierre de
  período) y Visual (idioma, tema, apariencia).

## 0.29.60 — 7 de agosto de 2026

### Nuevo

- Ajustes → Formato ahora tiene "Inicio de semana" (lunes o domingo), que se aplica a todos los
  calendarios de la app — antes el de Movimientos y el de Recurrentes ni siquiera arrancaban el
  mismo día entre sí.

## 0.29.59 — 7 de agosto de 2026

### Mejorado

- "Activar más funciones" e "Instalar app" se mudan de Ajustes al menú principal de Más, un
  paso más cerca.

## 0.29.58 — 7 de agosto de 2026

### Mejorado

- Más opciones de ícono en Perfil (alien, robot, fantasma, conejo, corona y otros) — se sacaron
  algunos que no decían mucho de vos (una taza de café, un moño de regalo) para sumar variedad
  que sí funciona como avatar.

## 0.29.55 — 7 de agosto de 2026

### Arreglado

- Cargar un gasto sin conexión ya no falla si cerraste la app del todo antes de reabrirla —
  antes solo funcionaba offline si la app había quedado abierta en segundo plano.

## 0.29.53 — 7 de agosto de 2026

### Nuevo

- Ahora podés elegir un ícono que te represente en tu Perfil, y ese ícono aparece junto a tu
  nombre en Grupo familiar — antes todos los miembros compartían el mismo ícono genérico.
- En el detalle de un movimiento (con más de una persona en tu grupo familiar) ahora se ve
  quién lo cargó.

## 0.29.52 — 6 de agosto de 2026

### Arreglado

- En el menú "Más" de mobile, cambiar qué función ocupa la cuarta posición de la barra de
  navegación (en Ajustes) ya no hace que esa función desaparezca del menú ni que la anterior
  quede duplicada.

## 0.29.51 — 6 de agosto de 2026

### Arreglado

- En el detalle de un gasto, el tipo de cambio usado ahora se muestra igual de claro que en
  Monedas y tipos de cambio (por ejemplo "1 USD = 1.976 ARS"), en vez de una tasa invertida
  con montones de decimales.

## 0.29.50 — 6 de agosto de 2026

### Mejorado

- En Asignación de Inversiones, cada bloque ahora se pinta más o menos intenso según su peso
  en la cartera — el mismo tipo de escala de color que ya usa el calendario de Movimientos.
- En el historial de operaciones de una posición, la fecha ahora aparece una sola vez por
  día en vez de repetirse en cada operación, para que la cantidad y el precio entren en una
  sola línea.

## 0.29.48 — 6 de agosto de 2026

### Mejorado

- La pantalla de asignación de Inversiones ahora llena la pantalla sin necesidad de hacer
  scroll, y el tamaño de cada bloque refleja de verdad el porcentaje que representa dentro
  de tu cartera.

## 0.29.47 — 6 de agosto de 2026

### Arreglado

- Un presupuesto en una categoría con subcategorías (por ejemplo "Supermercado") ahora suma
  también lo gastado en esas subcategorías, y podés elegirlas directamente al crear o editar
  un presupuesto.
- En Inversiones, al ver el detalle de una posición al lado de la lista, cada columna ahora
  scrollea por su cuenta.
- Eliminar una posición de inversión ya no da error ni deja el panel de detalle mostrando la
  posición vacía.

## 0.29.46 — 6 de agosto de 2026

### Arreglado

- En una cuenta que arrancó con un saldo inicial (no cero), el gráfico de evolución ya no
  muestra ese saldo como si hubiera existido siempre — ahora arranca desde el día real en
  que creaste la cuenta.
- En las tarjetas de crédito, el gráfico de evolución ahora sube cuando gastás más y baja
  cuando pagás, en vez de mostrarse al revés.

## 0.29.45 — 6 de agosto de 2026

### Nuevo

- Ahora podés buscar y seguir acciones y ETFs de Estados Unidos (NYSE/NASDAQ) en
  Inversiones, además de lo que ya cubría el mercado argentino.

## 0.29.44 — 6 de agosto de 2026

### Arreglado

- En Inversiones, al abrir el detalle de una posición al lado de la lista (en pantallas
  grandes), el título de arriba podía volver solo al nombre del portfolio aunque
  siguieras viendo la posición. También, si tenés más de un portfolio, algunas pantallas
  (asignación, rendimiento, ingresos futuros, instrumentos) podían mostrar datos del
  portfolio equivocado.

## 0.29.43 — 6 de agosto de 2026

### Mejorado

- La pantalla de asignación de Inversiones ahora se ve como un bento grid: cada posición
  es su propio bloque, y el tamaño refleja cuánto pesa dentro de tu cartera. De paso, se
  corrigió un cálculo que podía mezclar posiciones en distintas monedas sin convertir.

## 0.29.42 — 6 de agosto de 2026

### Nuevo

- En Inversiones, ya podés editar o eliminar una operación de compra/venta desde el
  detalle de un instrumento (deslizá la fila hacia la derecha para editar, hacia la
  izquierda para borrar). También podés eliminar una posición completa, con una
  advertencia previa porque borra todas sus operaciones y no se puede deshacer.

## 0.29.41 — 6 de agosto de 2026

### Nuevo

- Ahora podés editar un presupuesto después de creado, por si el estimado que pusiste
  cambió con el tiempo.

## 0.29.40 — 6 de agosto de 2026

### Nuevo

- El buscador ahora también encuentra tus movimientos recurrentes, no solo los cargos
  que ya se registraron.

## 0.29.39 — 6 de agosto de 2026

### Mejorado

- En Recurrentes, ahora los ingresos y los gastos se distinguen a simple vista: los
  ingresos van en aqua con "+" y los gastos con "−", igual que en Movimientos.
- El botón para crear un recurrente nuevo ahora tiene un poco más de aire respecto al
  botón "+" de abajo en el celular, y dice "Nuevo recurrente".

## 0.29.38 — 6 de agosto de 2026

### Arreglado

- En el inicio, en el celular, la primera cuenta del carrusel se veía con el texto más
  grande y marcado que las demás sin motivo. Ahora todas las cuentas se ven igual en
  mobile.

## 0.29.37 — 6 de agosto de 2026

### Arreglado

- El gráfico de evolución de saldo (90 días) del detalle de una cuenta podía mostrar
  valores inventados para fechas anteriores a tu primer movimiento real, y el saldo de
  "hoy" podía cambiar entre una recarga y otra. Ahora se calcula siempre desde tus
  movimientos reales y es consistente.

## 0.29.36 — 6 de agosto de 2026

### Arreglado

- Algunos porcentajes (tasa de ahorro, inflación, variación de inversiones) no respetaban
  el separador decimal elegido en Ajustes → Formato. Ya son consistentes con el resto de
  la app.

## 0.29.35 — 6 de agosto de 2026

### Arreglado

- El total de tu portfolio podía verse más bajo de lo real: una posición sin cotización
  todavía sumaba como si valiera $0. Ahora se excluye y te avisa cuántas quedaron afuera.

## 0.29.34 — 6 de agosto de 2026

### Arreglado

- El precio de cada operación en el historial de un instrumento ya no se redondea a "K"/"M"
  — se ve completo, con todos sus dígitos.

## 0.29.33 — 6 de agosto de 2026

### Arreglado

- Al buscar un instrumento para agregar, algunos resultados que en realidad cotizan en
  dólares se mostraban etiquetados como pesos argentinos. Ahora cada uno muestra su moneda
  real.

## 0.29.32 — 6 de agosto de 2026

### Nuevo

- El detalle de un instrumento ahora muestra cuándo se actualizó su precio por última vez,
  con un botón para forzar la actualización cuando quieras.

## 0.29.31 — 6 de agosto de 2026

### Mejorado

- Los precios de tu portfolio ahora se actualizan solos cada pocos minutos mientras estás
  viéndolo, y de a ratos aunque estés usando otra parte de la app.

## 0.29.30 — 6 de agosto de 2026

### Arreglado

- Una posición sin ninguna cotización todavía se mostraba como "$0,00" en vez de avisar
  que el dato no está disponible.

## 0.29.28 — 6 de agosto de 2026

### Arreglado

- Con ciertas combinaciones de idioma y formato de número (Ajustes → Formato), un monto
  podía mostrarse con el separador de miles y el decimal iguales, algo así como
  "1,500,00". Ya se ven siempre distintos y correctos.

## 0.29.27 — 6 de agosto de 2026

### Quitado

- El gráfico de fluctuación histórica en el detalle de un instrumento se sacó por ahora.

## 0.29.26 — 6 de agosto de 2026

### Arreglado

- "Registrar operación" a veces mostraba el ticket y precio del instrumento anterior en
  vez del que acababas de abrir. Ya arranca siempre limpio.

## 0.29.25 — 6 de agosto de 2026

### Mejorado

- El toggle de moneda en inversiones ahora dice "Original"/"USD" en vez de "Moneda
  original"/"En USD" — más corto y directo.

## 0.29.24 — 6 de agosto de 2026

### Arreglado

- Los precios de instrumentos de inversión se mostraban 100 veces más chicos que el valor
  real de mercado. Ya se ven correctos.

## 0.29.23 — 6 de agosto de 2026

### Nuevo

- Ya podés renombrar o eliminar un portfolio de inversiones desde su pantalla (ícono de
  lápiz arriba). Un portfolio con operaciones cargadas no se puede eliminar.

## 0.29.22 — 6 de agosto de 2026

### Mejorado

- "Instrumentos" ahora se ve como una lista simple de cotizaciones: símbolo, nombre y
  precio de mercado, sin etiquetas de estado. Cargar un precio a mano o sacar un
  instrumento de seguimiento se hace desde su detalle.

## 0.29.21 — 6 de agosto de 2026

### Arreglado

- El bloqueo por PIN o huella ahora se activa también al minimizar la app o pasar a otra y
  volver — antes solo se activaba si cerrabas la app por completo.

## 0.29.20 — 6 de agosto de 2026

### Arreglado

- Al activar el PIN, si te equivocabas al confirmarlo, el aviso de "no coinciden" se quedaba
  en pantalla mientras lo volvías a escribir. Ya se limpia apenas empezás de nuevo.

## 0.29.19 — 6 de agosto de 2026

### Arreglado

- Algunas entradas de estas novedades se veían cortadas a mitad de frase — ya se muestran
  completas.

## 0.29.18 — 6 de agosto de 2026

### Nuevo

- En el detalle de un instrumento que cotiza en otra moneda (por ejemplo, un CEDEAR en pesos)
  ahora podés alternar entre ver los montos en esa moneda o convertidos a tu moneda base.

## 0.29.17 — 6 de agosto de 2026

### Nuevo

- "Estado de los precios" pasa a llamarse "Instrumentos" y ahora separa lo que tenés comprado de
  lo que solo seguís sin haber invertido todavía. "Agregar instrumento" se movió para adentro de
  esta pantalla.
- El detalle de un instrumento ahora muestra cómo se movió su precio en el tiempo, con selector
  de semana, mes, 6 meses o año.
- Podés sacar un instrumento de tu lista de seguimiento directamente desde su detalle, con el
  ícono de marcador.

## 0.29.16 — 6 de agosto de 2026

### Nuevo

- En el detalle de una posición de tu portfolio ahora hay un botón para registrar una compra o
  venta de ese mismo instrumento, ya con el ticket y el precio de mercado cargados.

## 0.29.15 — 6 de agosto de 2026

### Arreglado

- Al entrar a "mi portfolio" ya no ves nunca "$ 0,00" en una posición mientras se actualiza el
  precio — se muestra el último valor conocido hasta que llega el nuevo.

## 0.29.14 — 6 de agosto de 2026

### Nuevo

- Notificaciones push nuevas: te avisamos cuando te invitan a un hogar, cuando alguien se une al
  tuyo, y cuando hay una versión nueva de PERZE — cada una con su propio interruptor en Más →
  Notificaciones.

## 0.29.13 — 6 de agosto de 2026

### Nuevo

- "Estado de precios" ahora deja agregar o sacar instrumentos para seguirles la cotización, aunque
  todavía no hayas comprado nada — con un botón "Actualizar" para traer los precios reales de
  mercado cuando quieras.

### Cambiado

- Las posiciones de tu cartera y el detalle de cada instrumento dejan de mostrar un cartel de
  "Actualizado"/"Manual" por fila — ahora, al entrar a un portfolio, se traen los precios reales de
  una sola vez, con un único aviso de "última actualización" para toda la pantalla.

## 0.29.12 — 6 de agosto de 2026

### Nuevo

- El historial completo de Novedades, desde la primera versión de Perze hasta hoy.

## 0.29.11 — 6 de agosto de 2026

### Nuevo

- Esta pantalla — Más → Acerca de → Novedades, para ver qué cambió en cada versión.

## 0.29.10 — 6 de agosto de 2026

### Arreglado

- La captura por voz ahora entiende "ingresaron 2500 dólares de sueldo" — antes solo reconocía
  frases en primera persona ("ingresé", "gasté") y se perdía las más comunes.
- Los controles de dos opciones (como Gasto/Ingreso al cargar un movimiento) ya no se ven con un
  espacio vacío al costado.

## 0.29.9 — 6 de agosto de 2026

### Arreglado

- Agregar una moneda nueva en Monedas y tipos de cambio, sin tocar el valor sugerido, ya no la
  marca como "personalizada" por error.
- Una moneda sin cuenta propia (agregada solo para seguirle la cotización) ya no desaparece de la
  lista al volver a "Estándar".

### Nuevo

- Podés eliminar una moneda de la lista de tipos de cambio si ya no la necesitás.

## 0.29.7 — 6 de agosto de 2026

### Arreglado

- El total de una cartera de inversión con posiciones en distintas monedas ahora convierte cada
  una antes de sumar — antes, en ese caso, el número podía no tener sentido.

### Nuevo

- Al cargar una operación de inversión, la cantidad se edita con botones +/− o por teclado, y el
  precio muestra la moneda del instrumento.
- Podés ver el valor de tu cartera en su moneda original o convertido a tu moneda base, con un
  toggle.

## 0.29.4 — 6 de agosto de 2026

### Nuevo

- Crear un instrumento de inversión ahora empieza con un buscador (acciones, CEDEARs, bonos,
  cripto) en vez de pedirte que inventes el símbolo de memoria — cargar a mano sigue disponible
  para lo que el buscador no cubre.

## 0.29.0–0.29.3 — 6 de agosto de 2026

### Nuevo

- Podés tener más de un portfolio de inversión, y ver el detalle de cada instrumento con su
  historial completo de operaciones.
- Las cotizaciones de acciones, CEDEARs, bonos y cripto se actualizan contra el mercado real,
  no a mano.

### Arreglado

- Elegir una cotización distinta (blue, CCL, mayorista) para una moneda ahora funciona incluso
  si ya habías cargado un valor a mano antes.

## 0.28.0–0.28.8 — 6 de agosto de 2026

### Nuevo

- Landing pública para quien recibe un link de invitación: ahora ve primero de qué se trata
  Perze, en vez de caer directo en el formulario de registro.
- Aviso por mail cuando alguien pide acceso a tu instancia o acepta tu invitación al hogar, con
  un contador visible en la app para las solicitudes pendientes.
- El inicio sugiere, de a una cosa por vez, ajustes que capaz no conocías (formato de fecha,
  tema, instalar la app).

### Arreglado

- Sacar a alguien del grupo familiar ahora le corta el acceso real a los datos, no solo a la
  lista visible.
- Quien acepta una invitación ahora ve de verdad las cuentas y movimientos del hogar al que se
  unió.
- Agregar una moneda nueva, y el filtro Personal/Compartido/Todo, ya no fallaban en silencio.

## 0.27.0–0.27.2 — 6 de agosto de 2026

### Nuevo

- Podés entrar con tu cuenta de Google.
- Invitar a alguien al grupo familiar ahora manda un mail de verdad, en vez de tener que
  compartirle el código a mano.

### Arreglado

- El link del mail de invitación no dejaba entrar a quien todavía no había sido aprobado por el
  administrador de la instancia.

## 0.24.0–0.26.0 — 5 de agosto de 2026

### Nuevo

- Podés canjear una invitación al grupo familiar desde un link o escribiendo el código a mano.

### Arreglado

- Iniciar sesión con contraseña, o reabrir la app ya instalada, a veces te devolvía a la
  pantalla de login sin motivo.
- El mapa de calor del calendario ahora distingue un día de gasto chico de un día sin gastos, y
  respeta los filtros de categoría o cuenta que tengas activos.

## 0.21.0–0.23.0 — 5 de agosto de 2026

### Nuevo

- El calendario de gastos pasa a ser una vista dentro de Movimientos — se abre al toque y
  comparte los mismos filtros y el buscador de la lista, en vez de ser una pantalla aparte.

### Arreglado

- Cargar un gasto quedaba trabado para siempre en el modo "Probar con datos de ejemplo".

## 0.16.0–0.20.0 — 5 de agosto de 2026

### Nuevo

- Podés crear, editar y borrar tus propias categorías y subcategorías, con más de 100 íconos
  para elegir — antes solo se podía elegir entre plantillas fijas.
- Una sección "Archivadas" recupera cualquier categoría que hayas borrado por error.
- Las reglas de auto-categorización se pueden editar y borrar, no solo apagar.

### Mejorado

- Elegir otra cuenta o movimiento de la lista ya no recarga la pantalla — el cambio es
  instantáneo, con una transición suave.
- El calendario de gastos arranca mostrando el mes completo, en vez de una pantalla vacía hasta
  elegir un día.

### Arreglado

- Categorías duplicadas ("Supermercado" x2, "Transporte" x2) se unifican solas.

## 0.15.0 — 4 de agosto de 2026

### Nuevo

- Los movimientos recurrentes (alquiler, suscripciones) se registran solos en la fecha que
  corresponde, sin que tengas que cargarlos a mano cada vez.
- Podés elegir frecuencia semanal, quincenal, mensual o anual, no solo mensual.
- Un aumento de precio importante en una recurrente se te avisa, con el impacto anual
  calculado.

## 0.13.0–0.14.0 — 4 de agosto de 2026

### Nuevo

- Pagar una tarjeta de crédito queda vinculado a su resumen del mes, en vez de verse como una
  transferencia genérica.
- Si el monto que cargás supera el saldo disponible de la cuenta, la app avisa antes de
  guardar — no aplica a tarjetas de crédito ni préstamos, que pueden ir en negativo por diseño.
- Todo gráfico tiene una alternativa en tabla, para quien prefiere ver los números en vez de un
  dibujo.

### Mejorado

- Borrar un movimiento deslizando ahora pide una confirmación rápida en la misma fila, en vez
  de borrar directo con un solo gesto.

## 0.12.0 — 4 de agosto de 2026

### Nuevo

- Podés borrar todos los datos del hogar desde Datos y backup, con un resumen de lo que se va a
  perder antes de confirmar. Solo disponible para quien creó el hogar.

## 0.10.0–0.11.3 — 4 de agosto de 2026

### Nuevo

- Tarjetas de crédito: pagar el resumen desde una transferencia, aviso antes del vencimiento, y
  tu cumpleaños con un saludo en el inicio.
- Fondo de puntos sutil, opcional, para el área de contenido.

### Mejorado

- El resumen de cuentas del inicio pasa a un panel visual que se adapta a cuántas cuentas
  tenés, en vez de un carrusel de una sola fila.
- El modo privacidad (para difuminar montos en público) ahora cubre todos los números de la
  pantalla, no solo algunos.

## 0.9.28–0.9.31 — 3 de agosto de 2026

### Nuevo

- Podés ponerle una o más etiquetas a un movimiento, además de la categoría.
- El selector de categorías muestra las subcategorías (Salud → Farmacia, Transporte → Nafta) y
  te deja elegir la más específica; también podés editar nombre e ícono de tus categorías
  propias.

## 0.9.10–0.9.20 — 2 de agosto de 2026

### Nuevo

- Elegís tema claro, oscuro o según el sistema desde Ajustes.
- El separador decimal y el formato de fecha se configuran desde Ajustes y se aplican en toda
  la app.
- Cada cuenta puede tener su propio color, visible en su ícono en toda la app.
- Instalar la app pasa a un botón único que detecta tu dispositivo.

## 0.9.0–0.9.9 — 2 de agosto de 2026

### Nuevo

- Los cambios que hacés en un dispositivo (el celular, la tablet) ahora aparecen en los demás
  sin tener que restaurar manualmente — antes solo se traían los datos una vez, al principio.
- Decir "gasté 2500 en transporte" por voz ya carga el tipo de movimiento y la categoría, no
  solo el monto.

### Arreglado

- La app instalada en un iPhone con isla dinámica tapaba parte de la barra inferior y del
  encabezado.

## 0.8.0–0.8.5 — 2 de agosto de 2026

### Nuevo

- Entrar con tu cuenta en un dispositivo nuevo, o reinstalar la app, recupera tus cuentas,
  movimientos y configuración — antes había que empezar de cero.

### Arreglado

- La sincronización con el servidor no estaba funcionando nunca, para nadie, por un error de
  permisos; ahora sí.

## 0.6.0–0.7.1 — 2 de agosto de 2026

### Nuevo

- Las cuentas nuevas quedan pendientes de aprobación del administrador de la instancia antes de
  poder entrar — pensado para instalaciones propias, no abiertas a cualquiera con un mail
  válido.
- Podés desbloquear la app con tu huella o reconocimiento facial, además del PIN.
- Contraseña disponible como alternativa al código por mail para iniciar sesión.

## 0.5.0 — 1 de agosto de 2026

### Arreglado

- El mail para entrar a la app llegaba con un link roto en vez del código de 6 dígitos para
  escribir a mano.
- Pegar el código completo desde el mail ahora funciona con un botón "Pegar código".
- Varios colores de la app no tenían suficiente contraste para leerse bien; corregidos.

## 0.4.0–0.4.1 — 1 de agosto de 2026

### Nuevo

- Perze se conecta a un backend real: tus datos dejan de vivir solo en el teléfono y empiezan a
  sincronizar. La mayoría de las pantallas del diseño quedan funcionando de punta a punta —
  presupuestos, metas, recurrentes, deudas, inversiones, grupo familiar, buscador, y una
  versión para tablet y escritorio con navegación lateral.
- Podés dividir un gasto entre miembros del hogar, y ver cómo queda saldada cada deuda cruzada.

## 0.2.0 — 28 de julio de 2026

### Nuevo

- Perze se reconstruye de cero sobre un sistema de diseño propio: cargar un gasto en 2 toques,
  un inicio con tu patrimonio neto y una tira de cuentas, movimientos, cuentas y monedas, y una
  versión que sigue funcionando sin conexión.

## El principio

Perze nació de una necesidad simple: cargar un gasto en menos de 5 segundos, sin que la app te
haga pensar. Quien la hace vive entre dos países y varias monedas, así que desde el primer día
tenía que sentirse natural para eso — no como un caso raro, sino como el uso normal. La primera
versión fue un prototipo rápido para probar la idea, hecho en un fin de semana. Después se paró
la escritura de código por completo y se diseñó la app entera, pantalla por pantalla, antes de
programar una sola línea de la versión de verdad. Todo lo que vino después se construyó sobre
ese diseño ya cerrado, no al revés.

## 0.1.0–0.1.1 — 30 de mayo de 2026

### Nuevo

- Primera versión funcional: inicio, movimientos multi-moneda y multi-país, inversiones, un
  asistente de análisis financiero con inteligencia artificial, y escaneo de tickets con la
  cámara para cargar un gasto automáticamente.
