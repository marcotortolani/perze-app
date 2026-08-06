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
