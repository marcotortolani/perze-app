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
