# 08 — Cierre de diseño y desbloqueo de C2

> Entrada: el reporte de reconciliación de la sesión 0, con el bloque K ya corregido.
> Salida: tres prompts para Claude Design, una lista de arreglos que **no** van a Claude Design, y las seis decisiones que destraban la primera migración.

---

## Lo que falta, en tres montones

**Montón 1 — va a Claude Design (3 prompts).** Los contratos de los 20 componentes sin ficha más la librería completa, las tres pantallas sin diseñar y las cinco entradas huérfanas, y el modo espejo de J4.

**Montón 2 — no va a Claude Design.** Diecisiete arreglos de la auditoría que son de token, de componente o de contenido. Rehacerlos en Claude Design es trabajo perdido: **el bundle está fijado por proyecto y no propaga**, así que lo que se arregle ahí no llega a ningún lado. Se aplican una vez, en código, en C4 y C6.

**Montón 3 — decisiones.** Seis, y son las que de verdad bloquean. C2 no puede escribir la primera migración sin ellas, y una además condiciona el diseño de J4.

El orden importa: **la decisión de visibilidad se toma antes del prompt 3**, o el modo espejo se diseña contra un modelo que no existe.

---

# Montón 1 · Los tres prompts

## PROMPT 1 — Los contratos que faltan y la librería completa

**Por qué este va primero:** es el que desbloquea C6, que es la fase más larga del desarrollo. Hoy el contrato documenta 27 piezas del delta v2, las pantallas usan 34 componentes, **20 no tienen ficha** y `perze-v2.jsx` importa un `./core` que no existe. Sin esto, C6 porta 31 componentes a ciegas y especifica 4 desde cero mientras programa — que es exactamente cómo se muere un design system.

Corré esto **en el proyecto del design system**, el mismo del contrato v2.

```
Este es el proyecto del design system de PERZE. El contrato de componentes que publicaste documenta el delta v2, 27 piezas, y eso resultó ser menos de la mitad de lo que las pantallas realmente usan. La reconciliación contra los once archivos de diseño midió el uso real con el patrón de instanciación del sistema y dio 34 componentes distintos, de los cuales VEINTE no tienen ficha en el contrato: Button, AppHeader, Amount, Icon, Chip, Card, SegmentedControl, SkeletonRow, Switch, Input, CurrencyChip, Sparkline, CategoryBubble, InsightCard, SyncDot, SeriesLegend, BarChart, DateStrip, FxEditor y AmountScrubber. Los cinco más usados de toda la app —ListRow, Button, AppHeader, Amount, Icon— están entre ellos. Necesito dos cosas y las dos son para que se pueda programar. PRIMERO, la ficha completa de esos veinte, con exactamente la misma forma que usaste en el contrato v2: nombre, para qué existe en una línea, props con tipos, todos los estados que soporta, qué tokens consume, qué reglas de accesibilidad tiene que cumplir, y en qué bloques aparece. Cuatro de los veinte no se mencionan en ninguna parte del contrato y son los que más me preocupan: FxEditor, AmountScrubber, CategoryBubble y DateStrip. Con FxEditor prestá atención especial porque hay un solapamiento sin resolver: en el bloque C se lo instancia con source, age-hours y stale, que es exactamente el territorio que el contrato le asigna a Rate y al PriceStatus especificado; decidí si FxEditor compone a los otros dos, si los reemplaza, o si son tres cosas distintas, y escribí la relación en las tres fichas. Y con Sparkline resolvé la otra ambigüedad: el contrato lo declara placeholder a reemplazar por LineChart pero el diseño lo usa nueve veces, así que decidí si se porta como componente propio o se migra, y si se migra decime qué cambia en las nueve. SEGUNDO, la librería completa en un solo archivo. Hoy perze-v2.jsx tiene 27 exports y su línea 12 importa desde './core' —Icon, Button, Chip, Card y Switch— y ese archivo no existe en ningún lado, así que la implementación de referencia no corre. Entregame un único archivo con TODOS los componentes del sistema, sin imports externos más allá de React, con los tokens como variables CSS y sin dependencias del bundle del proyecto. Ese archivo se porta a TypeScript directo, así que la prioridad es que esté completo y sea consistente, no que sea corto. Marcá con un comentario cuáles son las once piezas que el contrato pide cambiar al portarlas —Skeleton, TabBar, TransactionRow, AccountCarousel, ErrorState, UndoToast, OfflineBanner, EmptyState, SplitBar, StatTile y Keypad— y qué cambia en cada una. Tres correcciones que van adentro de la librería y no como nota: EmptyState tiene que usar ZMark y no el ícono de línea, SplitBar no puede pintar sus partes con la paleta de datos porque charts.css lo prohíbe textualmente, y StatTile necesita la prop size con la variante compact de 22 px. Al final decime qué componentes del bundle NO incluiste y por qué, y cuáles de los veinte te obligaron a tomar una decisión de diseño en vez de solo documentar lo que ya existía.
```

---

## PROMPT 2 — Las tres pantallas y las cinco entradas

**Por qué:** son huecos reales de navegación. Dos de los tres son pasos del medio que un flujo promete y no tiene, y las cinco huérfanas son vistas diseñadas a las que no se llega desde ningún lado — programarlas sin entrada es escribir rutas muertas.

Este prompt **no** incluye el modo espejo de J4: ese depende de la decisión de visibilidad y va en el prompt 3.

```
Faltan dos pantallas y cinco entradas de navegación que la reconciliación confirmó contra los archivos de diseño. Diseñá en alta fidelidad, con los mismos tokens y componentes del sistema, con los cinco estados cada una y con anotaciones numeradas. PRIMERO, el selector de transacción con tarjeta que alimenta G6. Hoy G6 arranca con "Compra de origen" ya elegida y el paso del medio no existe ni en el bloque D ni en el G: es un hueco en uno de los diez flujos críticos. Tiene que listar las transacciones con tarjeta de crédito del período, buscables, mostrando comercio, fecha y monto, y desde la fila elegida entrar directo al armado del plan. Ojo con dos cosas: una compra que ya tiene plan de cuotas no puede volver a elegirse y hay que decir por qué en la fila, y si no hay ninguna transacción con tarjeta el estado vacío tiene que ofrecer crear el plan desde cero en vez de dejar al usuario sin salida. SEGUNDO, el formulario de crear instrumento a mano que I7 promete y que hoy termina en un botón. Son cuatro campos mínimos —nombre, clase de activo, moneda y precio inicial— pero es el camino de primera clase para las ONs poco líquidas, los FCI, los plazos fijos y los inmuebles, no un fallback de emergencia, así que diseñalo con esa dignidad. El precio inicial va con el keypad. Y aclarará en pantalla que un instrumento manual no va a tener actualización automática de precio y cómo se actualiza después. TERCERO, resolvé las cinco vistas huérfanas dándoles entrada desde una pantalla que ya existe: I9 allocation y rebalanceo, I10 rendimiento, I11 calendario de renta futura, H12 wrapped y J8 comparativa entre miembros. Los dos casos concretos que ya detectamos: en I2 hay dos tiles que deberían llevar a I10 pero son tiles y no filas, y J2 tiene filas a J4 y a J9 pero ninguna a J8. Decime en cada uno de los cinco desde dónde se entra, qué elemento cambió para permitirlo, y si ese cambio rompe el presupuesto de ruido de la pantalla de origen. Ojo con J8: la comparativa entre miembros necesita opt-in explícito de los dos, así que su entrada tiene que existir también cuando uno solo lo activó, y en ese caso llevar al estado asimétrico y no a la comparativa. Se aplican las reglas de siempre: selección por superficie, un solo violeta por pantalla y es la acción primaria, cero íconos decorativos, gastos en tinta neutra e ingresos en aqua, y todo agregado declara los movimientos sin cotización que excluye —con CONTEO, nunca con monto, porque un movimiento sin rate no tiene monto base y sumar tres monedas distintas da un número sin significado—. Al final, chequeo de ruido de cada pantalla nueva y de cada pantalla que hayas modificado, volcado también al chat.
```

---

## PROMPT 3 — El modo espejo de J4

**Listo para correr.** La decisión de visibilidad está cerrada y ya va escrita adentro del prompt. Es lo último que falta de diseño en todo el proyecto.

```
Falta el modo espejo de J4, que es lo que convierte a esa pantalla de promesa en prueba: hoy J4 dice "ver la app como la ve Ana" y esa vista no existe. Diseñalo en alta fidelidad con los cinco estados y anotaciones numeradas. El modelo de visibilidad quedó cerrado así y no se rediscute: cada cuenta y cada categoría tiene un campo de visibilidad con tres valores. 'private' significa que solo la ve quien la creó. 'household' significa que la ven todos los miembros. Y 'custom' significa que hay una lista explícita de quiénes la ven, guardada aparte, que registra quién otorgó el permiso y cuándo, y que también registra las revocaciones para que J9 las pueda auditar. El caso frecuente es todo compartido o todo privado; 'custom' es la excepción. Y la regla dura del modo espejo, que es de arquitectura y no de diseño: el espejo NUNCA amplía el acceso de quien mira. Solo muestra lo que ese otro miembro ya podría ver por sí mismo, así que no existe ninguna combinación en la que el espejo revele algo que el otro no eligió compartir. El objetivo duro de esta pantalla es la confianza: alguien que comparte sus finanzas con su pareja tiene que poder COMPROBAR, no deducir, qué ve la otra persona. Si después de usar el modo espejo le queda alguna duda, la pantalla falló. Requisitos. UNO, la barra persistente de salida que el contrato llama MirrorBanner: mientras el modo está activo tiene que ser imposible olvidarse de que se está mirando en espejo, y salir tiene que ser un tap desde cualquier pantalla. Diseñá esa barra sobre al menos tres pantallas distintas —home, movimientos y cuentas— para que se vea que no tapa nada crítico ni empuja el contenido de forma incómoda. DOS, el modo espejo es de SOLO LECTURA y eso tiene que ser evidente sin leer: el FAB, los botones primarios y las acciones de edición no pueden estar simplemente deshabilitados en gris, porque un control gris se lee como un error de la app. Decidí cómo desaparecen y mostralo. TRES, lo que el otro miembro NO ve tiene que verse como ausencia, no como un candado en cada fila: si Ana no ve tres de tus cinco cuentas, el espejo muestra dos cuentas, no cinco con tres tachadas. Un candado por fila es exactamente la estética de vigilancia que este bloque tiene que evitar. Pero el usuario sí necesita saber cuánto está ocultando, así que resolvé eso con un resumen de una línea en la barra, no marca por marca. CUATRO, el estado en que no hay nada oculto: si el usuario comparte todo, el espejo es idéntico a su app y hay que decirlo explícitamente, porque una pantalla que se ve igual sin explicación se lee como que el modo no funcionó. CINCO, desde dónde se entra y cómo se sale, y qué pasa si el otro miembro cambia sus permisos mientras vos estás en espejo. Se aplican las reglas de siempre: selección por superficie, un solo violeta por pantalla, cero íconos decorativos, y todo agregado declara con conteo los movimientos sin cotización que excluye. DIEZ: ojo con una consecuencia de navegación. J2 ya fue modificada por el prompt anterior para sumarle la entrada a J8, y esa versión vive en el archivo de huecos, no en el del bloque J. Si para entrar al espejo necesitás tocar J2 de nuevo, partí de esa versión y no de la original, y avisámelo explícitamente para que se actualice el índice de vistas. Al final decime qué te faltó de la biblioteca, cuántos taps hay entre J4 y estar mirando en espejo, y si en algún momento el modo espejo puede revelarle al usuario algo del otro miembro que el otro miembro no eligió compartir — porque ese sería el peor defecto posible de esta pantalla.
```

---

# Montón 2 · Lo que NO va a Claude Design

Diecisiete arreglos de la auditoría son de token, de componente o de contenido. **El bundle está fijado por proyecto y no propaga**, así que arreglarlos en Claude Design no llega al código. Se aplican una vez, donde corresponde.

| Fase | Arreglos |
|---|---|
| **C4 · tokens** | D02 token de selección con contraste real en claro · D42 rampa del heatmap invertida en claro · D43 mezcla del Sankey en claro · D44 `ZMark` al 28% en claro · D45 inicial del avatar en blanco o tinta según luminancia del slot · pieza 29: `--ramp-1..7` en `charts.css`, que hoy no existe |
| **C6 · componentes** | D01 `EmptyState` con `ZMark` · D04 `SplitBar` sin paleta de datos · `StatTile size="compact"` · `NeedsFxBanner` **sin prop `amount`** |
| **En cada pantalla** | D03 los trece agregados que no declaran exclusión · D19/D20 H1 e I2 a `StatTile compact` · D21/D24 partir I5 · D28 bajar el título de card de F2 a caption · D31 K1 oculta las filas que no aplican con los flags en mínimo · D32 el chip "Resolver" solo si hay más de una moneda · D36 sacar el verde de H11 y J7 · corregir H1a, H5 y H7 para que el banner muestre conteo y no monto |
| **Motion** | D46 unificar lista→detalle en shared element · D47 unificar la animación de deshacer · D48 definir la transición de la tab bar al prender inversiones |

**Sobre re-correr la auditoría visual:** no la corras entera. A–E ya se están programando y el bundle no propaga, así que el rendimiento es bajo. Lo que sí vale es verificar a mano los cuatro defectos marcados `[cruzado]` —D12, D34, D41 y D47— que se dedujeron sin abrir los archivos y ahora sí se pueden abrir.

---

# Montón 3 · Las seis decisiones que destraban C2

Mi recomendación en cada una. La 1 además condiciona el prompt 3.

### 1 · Modelo de visibilidad por miembro — la que más superficie toca

J4 muestra, por cada cuenta y cada categoría, si un miembro concreto la ve. Hoy `accounts.visibility` es binario y `categories` no tiene ninguna columna de visibilidad.

**Recomiendo: `visibility` se queda como camino rápido y suma un tercer valor.**

- `'private'` — solo quien la creó
- `'household'` — todos los miembros
- `'custom'` — mirá `visibility_grants`

Y una tabla `visibility_grants(household_id, subject_type, subject_id, member_id, granted_by, granted_at)` que **solo guarda las excepciones**.

Por qué así y no un `shared_with uuid[]`: J9 audita los cambios de visibilidad y necesita quién y cuándo, que un array no puede llevar. Y van a aparecer más tipos compartibles —metas, presupuestos— que con arrays son una columna nueva por tabla y con `subject_type` son filas.

Por qué no la tabla sola: el caso común es "todo compartido" o "todo privado", y resolverlo con un join en cada política de RLS es pagar el precio del caso raro en el caso frecuente. Con el tercer valor, el 95% de las filas se resuelve con una comparación de columna.

El costo real es la política: `tx_select` pasa a necesitar el conjunto visible. Se resuelve con un helper `visible_accounts()` `SECURITY DEFINER` + `SET search_path = ''`, el mismo patrón que ya usa `current_households()`, más un índice sobre `(member_id, subject_type, subject_id)`.

### 2 · RLS de las filas de catálogo global

`institutions`, `instruments` y `asset_classes` con `household_id IS NULL` no encajan en ninguno de los dos patrones del documento 01.

**Recomiendo: lectura para todo usuario autenticado, escritura solo por seeds y Edge Functions, y clonado al editar.** Cuando I8 renombra una clase de activo global o I7 modifica un instrumento del catálogo, **no se muta la fila global**: se clona al household con un `source_id` que apunta al original. Es lo que mantiene el catálogo compartido utilizable y lo que evita que un usuario le rompa el nombre de un CEDEAR a todos los demás.

### 3 · `fx_source` en `trades`

**No es una decisión, es un bug.** Va con la misma forma que `transactions`: `fx_rate` y `amount_base` nullables, `fx_source` con el mismo `CHECK` de cinco valores, y el `CONSTRAINT fx_pair`. Lo mismo para `transaction_splits`, `transaction_shares` y `settlements`. Hacerlo en la migración inicial y no después.

### 4 · Estado de sincronización

El reporte lo plantea como "columna o Dexie". **Son las dos, y la línea está en otro lado del que parece.**

Una fila que todavía no llegó al servidor no puede tener una columna en el servidor: eso vive solo en el outbox de Dexie. Lo que sí necesita columna es lo que **llegó y salió mal**: `sync_state` en `transactions` con `'ok' | 'rejected' | 'conflict'` más un `sync_error text`. D2 filtra "Sin sincronizar" mezclando las dos fuentes del lado cliente, y L3 escala a warning a los 7 días usando la columna.

### 5 · Override manual de FX con vigencia

**Recomiendo una tabla, no columnas.** `household_fx_preferences` guarda proveedor y tipo de cotización, que son preferencias. El override es un hecho con fecha: E6.3 dice "fija un rate hasta que lo cambies", y el paso 1 de la cadena de resolución tiene que ser consultable **por fecha del movimiento**, no por "el último".

`fx_overrides(household_id, base_currency, quote_currency, rate, valid_from, valid_to, created_by)` con `valid_to` nullable. Sin esto, E6.3 y K8 no son implementables y la cadena de resolución arranca en el paso 2.

### 6 · Clasificación raíz/hija de las doce tablas

Esta no la decidas vos: es mecánica y la puede proponer Claude Code en una pasada. La regla es una sola — **raíz es la que lleva `household_id` y ancla la política; hija es la que se alcanza con `EXISTS` sobre su padre y nunca duplica `household_id`**. Pedile la tabla de clasificación con las columnas de auditoría de cada una y aprobala de un saque.

---

## Qué queda después de esto

Con el prompt 1 corrido y las seis decisiones tomadas, **C1 a C6 quedan libres**. Los prompts 2 y 3 pueden correr en paralelo al desarrollo de las fundaciones, porque las pantallas que producen son de bloques tardíos (G, I, J) y no están en el camino de C7 ni C8.

Sigue abierto, y no bloquea: el arranque sin conexión, el orden de A2 y la licencia.

---

# Después de los prompts: cómo aterriza esto

**No se vuelve a correr el handoff.** La sesión 0 era un gate de una vez: ya corrió, ya produjo el reporte y sus hallazgos ya están aplicados en `CLAUDE.md`. Volver a correrla re-deriva lo que ya sabemos y cuesta una sesión larga.

## La trampa que crean los prompts 2 y 3

El prompt 2 no solo dibuja pantallas nuevas: **modifica pantallas que ya existen**. Para darle entrada a I10 cambia los tiles de I2, y para darle entrada a J8 agrega una fila en J2. Como cada prompt corre en su propio proyecto, esas modificaciones quedan en un archivo nuevo — y entonces **hay dos archivos que definen I2**: `bloque-i-inversiones.html` con la versión vieja y el archivo nuevo con la corregida.

El orden de autoridad de `CLAUDE.md` no resuelve eso: los dos son `docs/design/`. Y es la clase de ambigüedad que no falla ruidosamente: Claude Code abre el primero que encuentra y programa la versión vieja sin que nada avise.

**La solución es un índice de vistas**, y de paso mata tres problemas más que ya teníamos sueltos: que `L6` vive en el archivo del bloque A, que `E8` no figura en `03` ni en `04`, y que `K9` se partió en tres.

Creá `docs/design/INDEX.md` con una fila por vista canónica:

| Vista | Archivo que manda | Nota |
|---|---|---|
| `L6` | `bloque-a-onboarding.html` | No está en el archivo del bloque L |
| `E8.1` · `E8.2` | `bloque-e-cuentas.html` | No figura en `03` ni en `04` |
| `K9a` · `K9b` · `K9c` | `bloque-k-ajustes.html` | K9 se partió en tres |
| `I2` | `adenda-navegacion.html` | **Reemplaza** la versión de `bloque-i-inversiones.html` |
| `J2` | `adenda-navegacion.html` | **Reemplaza** la de `bloque-j-familiar.html` |
| … | … | … |

Y una línea en `CLAUDE.md`: *cuando dos archivos de `docs/design/` definen la misma vista, manda el que dice `INDEX.md`.*

Se lo podés pedir a Claude Code de una: que censere los IDs de vista de los once archivos, detecte los duplicados y genere el índice. Es un `grep` y una tabla.

## Qué archivos cambian, y cuáles no

| Archivo | Qué hacer |
|---|---|
| `contrato-componentes.md` | **Fusionar** la salida del prompt 1. Un solo archivo con las 47 fichas, no dos documentos que se reparten la autoridad |
| `docs/library/` | **Reemplazar** `perze-v2.jsx` por la librería completa, y **borrar el viejo**. Mientras siga ahí, alguien va a portar desde el archivo que no compila |
| `docs/design/` | Sumar el o los archivos nuevos **más `INDEX.md`** |
| `01-arquitectura-datos.md` | **El cambio grande, y recién después de las seis decisiones.** Visibilidad, RLS de catálogos, `fx_source` en `trades`, `sync_state`, `fx_overrides` y la clasificación de las doce tablas |
| `CLAUDE.md` | Sumar las seis decisiones como cerradas y la regla del `INDEX.md`. Borrar de la sección de abiertas lo que se cierre |
| `README.md` | Una línea de estado |

**No se tocan:** `00`, `02`, `03`, `04`, `05`, `06`, `07`, `auditoria-visual.md` ni `marca/`. Los prompts `03` y `04` siguen siendo historia y está bien que queden desactualizados: para eso está la regla de precedencia.

## La secuencia

1. Terminan los prompts 1 y 2 → aterrizan en el repo con el `INDEX.md`
2. **Se toman las seis decisiones** → se reescriben las partes afectadas de `01` → se suman a `CLAUDE.md`
3. Con la decisión de visibilidad tomada, corre el prompt 3 (modo espejo de J4)
4. **Chequeo delta, no sesión 0 de nuevo**: que el contrato fusionado cubra los 34 componentes, que el `INDEX.md` no tenga duplicados sin resolver, y que `01` ya no tenga ninguna de las nueve violaciones V1–V9
5. `C1`

El paso 3 no bloquea al 4 ni al 5: J4 es de un bloque tardío y no está en el camino de C7 ni C8.
