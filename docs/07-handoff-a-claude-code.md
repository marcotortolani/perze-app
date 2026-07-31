# 07 — Handoff a Claude Code

> Los prompts de desarrollo ya existen en `05-prompts-desarrollo.md`. Lo que falta es lo que hace que Claude Code los pueda usar **sin inventar**. Eso es este documento.

---

## La respuesta corta

Le das tres cosas, en este orden de importancia:

1. **Un `CLAUDE.md` en la raíz del repo** — está escrito y listo en `CLAUDE.md` de este paquete. Es lo único que se lee en *cada* sesión, así que es donde viven las decisiones cerradas y el orden de autoridad entre documentos.
2. **Los archivos del diseño dentro del repo**, en `docs/`. Hoy el diseño vive en proyectos web de Claude Design y **Claude Code no los puede abrir**. Si no los exportás, va a inventar pantallas.
3. **Los prompts del `05`, con tres correcciones** que se detallan más abajo.

Y una cosa que **no** le das todavía: la orden de programar pantallas. La auditoría dice por qué.

---

## 1 · Antes que nada: el repo tiene que poder ver el diseño

Esto es el bloqueo real. Claude Code lee archivos, no proyectos de Claude Design.

```
docs/
  00-producto.md
  01-arquitectura-datos.md
  02-design-system.md
  03-prompts-wireframes.md          ← historia, no spec (ver CLAUDE.md)
  04-prompts-ui.md                  ← historia, no spec
  05-prompts-desarrollo.md
  contrato-componentes.md           ← ESENCIAL
  auditoria-visual.md               ← ESENCIAL
  library/
    perze-v2.jsx                    ← implementación de referencia: se porta, no se reescribe
  design/
    bloque-a-onboarding.html        ← exportá el .dc.html de cada proyecto
    bloque-b-home.html
    bloque-c-captura.html
    bloque-d-movimientos.html
    bloque-e-cuentas.html
    bloque-fg-presupuestos.html
    bloque-h-analisis.html
    bloque-i-inversiones.html
    bloque-j-familiar.html
    bloque-k-ajustes.html
    bloque-l-sistemas.html
  marca/                            ← el kit de marca completo
CLAUDE.md
```

Los `.html` son grandes pero son texto: Claude Code los lee, extrae copy, jerarquía y estados, y puede compararlos contra lo que programa. Sin ellos, el "coincide con el diseño" del checklist no se puede verificar y va a reconstruir las pantallas desde los prompts del `03`/`04` — que tienen listas viejas. El bloque A figura ahí con once pantallas y terminó con ocho.

`perze-v2.jsx` es la pieza que más tiempo ahorra: son los componentes ya resueltos. Portarlos a TypeScript con los tokens reales es una tarea mecánica; reescribirlos desde el contrato es una semana y un resultado distinto.

---

## 2 · Lo que dice la auditoría, y qué significa en la práctica

El cierre de `auditoria-visual.md` es explícito: **arreglar los cinco primeros defectos en la biblioteca, diseñar K9 y los cuatro pasos faltantes, y recién entonces empezar a programar.**

Eso suena a freno, pero mirado de cerca es más suave de lo que parece. **Cuatro de los cinco son de token o de componente**, o sea que caen exactamente en las fases que venían después de todos modos:

| Defecto | Dónde cae realmente |
|---|---|
| D01 · `EmptyState` con ícono de línea en vez de `ZMark` | **C6** — biblioteca de componentes |
| D02 · selección invisible en modo claro | **C4** — tokens. Y es la más urgente de todas |
| D03 · trece agregados sin declarar `needs_fx` | **C3 + C6** — capa de dinero y `NeedsFxBanner` |
| D04 · `SplitBar` pintando con la paleta de datos | **C6** — biblioteca |
| D05/D06 · faltan 4 pantallas y hay 5 vistas huérfanas | **Vuelve a diseño.** Es el único |

Traducido: **las fundaciones no están bloqueadas.** C1 (setup), C2 (schema y RLS), C3 (dinero y FX) y C5 (offline) se pueden arrancar hoy y no los toca ningún defecto de la auditoría. Lo que está bloqueado es escribir pantallas, y lo que lo desbloquea es hacer C4 y C6 bien, con los arreglos adentro.

### D02 merece números, porque es la que más cuesta si se pasa

El mecanismo central de selección de toda la app —segmentados, chips, burbujas de categoría, tira de días, carrusel de cuentas, pills, `SelectableRow`, `OptionCard`, `InstitutionTile`— se muestra con `--surface-3` sobre `--surface-2`. Medido:

| Modo | Par | Contraste |
|---|---|---|
| Claro | `#F5F5F4` → `#EEEEEC` | **1,065 : 1** |
| Oscuro | `#1B1B1E` → `#26262A` | 1,14 : 1 |

1,065:1 es invisible. No "sutil": invisible en un teléfono al sol. Y 1,14 en oscuro es apenas.

**No se arregla oscureciendo `--surface-3`**, porque ese token también es inputs y keypad y cambiarlo mueve todo el modo claro. Hace falta un token propio de selección más un anillo que se vea. Los valores medidos que funcionan:

| Pieza | Claro | Contra | Contraste |
|---|---|---|---|
| Superficie de selección | `#DEDEDA` | surface-2 | 1,24 : 1 |
| Anillo de 1 px | `#C9C9C4` | la selección | 1,43 : 1 |

El anillo actual (`--border` `#E4E4E1`) da 1,097:1 sobre la selección, o sea que tampoco aporta. En oscuro conviene sumar el mismo anillo por simetría: la superficie sola está al límite.

**Esta decisión se toma en C4 y antes de escribir un solo componente seleccionable.** Después son catorce componentes re-auditados.

### Lo único que vuelve a Claude Design

Cuatro pantallas sin diseñar y cinco vistas sin entrada. Es un solo prompt:

```
Faltan cuatro pantallas y cinco entradas de navegación que la auditoría detectó. Diseñá en alta fidelidad, con los mismos tokens y componentes del resto del sistema, y con los cinco estados cada una: UNO, K9 el importador de CSV completo, que es uno de los diez flujos críticos y el único que trae datos sucios: subir el archivo, mapeo guiado de columnas, preview de las primeras filas, detección de duplicados y resumen del resultado, con sus estados de archivo ilegible, columnas que no matchean y import parcial. DOS, el selector de transacción con tarjeta que alimenta G6: hoy G6 arranca con la compra ya elegida y el paso del medio no existe en ningún bloque. TRES, el formulario de crear instrumento a mano que promete I7 y termina en un botón: nombre, clase, moneda y precio inicial. CUATRO, el modo espejo de J4, ver la app como la ve el otro miembro, que es lo que convierte a J4 de promesa en prueba, con la barra persistente de salida (MirrorBanner en el contrato). Y resolvé las cinco vistas huérfanas dándoles entrada desde una pantalla que ya existe: I9, I10, I11, H12 y J8. I2 tiene dos tiles que deberían llevar a I10 pero no son filas, y J2 tiene filas a J4 y J9 pero ninguna a J8. Decime en cada caso desde dónde se entra y qué elemento cambió para permitirlo. Se aplican las reglas de siempre: selección por superficie, un solo violeta por pantalla y es la acción primaria, cero íconos decorativos, y todo agregado declara sus movimientos sin cotización. Al final, chequeo de ruido de cada pantalla nueva volcado al chat.
```

---

## 3 · Las tres correcciones al `05`

**a) El orden de bloques del `C9` ya es correcto y hay que respetarlo.** L va primero porque todo lo demás lo consume. No lo cambies por "empecemos por el home".

**b) `C11` dice "home en sus 3 variantes de perfil".** Eso es lenguaje viejo: el perfil se eliminó del producto en favor de flags ortogonales. Las tres variantes del home son combinaciones de flags —una moneda / varias monedas / módulo de inversiones encendido— y **no existe un campo `perfil` en el modelo de datos**. Corregilo antes de pasarle ese prompt.

**c) `C4` y `C6` cargan ahora los arreglos de la auditoría.** No son las fases livianas que parecían. En concreto:

- **C4** decide el token de selección con los números de arriba, y agrega `--ramp-1..7` en `charts.css` exponiendo la rampa secuencial violeta — hoy los heatmaps referencian `--violet-300..700` de `palette.css`, que el propio archivo dice no referenciar directo.
- **C6** porta `perze-v2.jsx`, arregla `EmptyState` y `SplitBar`, y escribe las **29 piezas `[spec]`** del contrato. Las cuatro primeras desbloquean pantallas enteras: `SkeletonBlock`, `PriceStatus`, `PositionRow` y `NeedsFxBanner`.

---

## 4 · Las tres trampas, convertidas en código

El § 7 del contrato nombra las tres piezas con más chance de romperse. Las tres se pueden blindar con algo automático, y conviene hacerlo en C1/C4 y no descubrirlas en QA:

**1 · La precisión decimal.** Toca `Rate`, `Quantity`, `Amount`, `PositionRow`, importación, exportación y todos los totales, y se arregla mal muy fácil: alguien mete un `toFixed(2)` en un helper y bitcoin redondea a dos decimales sin que nada falle visiblemente.
→ `formatNumber` exige `decimals` y no tiene default. Regla de lint que prohíbe `toFixed` fuera de `lib/money`. Test que renderiza BTC (8), un FCI (4) y UYU (0) **en la misma lista**.

**2 · Props numéricas pasadas a CSS.** Ya rompió dos veces en el proyecto: `SplitBar height="20"` y `Skeleton height="40"` renderizaron en cero porque React no le agrega `px` a un string.
→ Toda prop de tamaño se normaliza dentro del componente. Con TypeScript strict el tipo lo ataja, pero la normalización va igual porque los datos pueden venir de la base.

**3 · El presupuesto de ruido.** No es un componente: es una invariante *entre* componentes, y ninguno la puede verificar solo. La primera pantalla con `Switch` encendido + botón primario + chip seleccionado la viola sin que nadie lo note.
→ Regla de lint que cuenta usos de `--primary-fill` por archivo de pantalla. Y `StatTile size="compact"` tiene que existir **antes** de que se escriba H1, o H1 nace con cuatro niveles tipográficos.

---

## 5 · Los tres gates

No avanzar de fase sin esto. Es lo único que evita descubrir en el bloque J que la fundación estaba mal.

**Gate 1 — después de C2 (schema y RLS).** Un test que, autenticado como usuario del household A, intente leer, escribir, actualizar y **mover** una fila del household B, por cada tabla. El caso que más se olvida: un `UPDATE` sin `WITH CHECK` deja mover una fila al household ajeno. Si ese test no existe, la fase no está terminada.

**Gate 2 — después de C3 y C4.** Tres cosas: no hay un solo `number` ni `parseFloat` sobre un monto en todo el repo; un movimiento sin cotización se guarda con `fx_rate` y `amount_base` en `NULL` y **nunca** con rate = 1; y el token de selección se ve en los dos modos, verificado con el medidor de contraste y no a ojo.

**Gate 3 — después de C6 (biblioteca).** Las 29 piezas `[spec]` existen o están explícitamente diferidas con motivo. `EmptyState` usa `ZMark`. `SplitBar` no toca la paleta de datos. `ScopeSwitcher` no existe ni como alias.

---

## 6 · La sesión 0: reconciliación antes de escribir código

Antes del primer prompt del `05`, corré esta. Es barata y hace lo mismo que hicieron las auditorías de diseño: encontrar las contradicciones cuando todavía valen una tarde.

```
Leé todo lo que hay en docs/ y CLAUDE.md. No escribas código todavía. Quiero un reporte de reconciliación antes de empezar. Contexto que necesitás: los documentos 03 y 04 son los prompts que se usaron para GENERAR el diseño y quedaron versionados como historia, así que no son especificación; el diseño real está en docs/design/, el contrato de componentes manda sobre la API de cada pieza, y la auditoría visual corrige a todos. UNO: recorré los once archivos de docs/design/ y armá el inventario real de vistas por bloque, con su ruta propuesta. Comparalo contra las listas de los documentos 03 y 04 y decime cada pantalla que figura en los prompts y no existe en el diseño, y cada una que existe en el diseño y no figura en los prompts. Sé exhaustivo: el bloque A figura con once pantallas en el 03 y terminó con ocho, y ese tipo de desfasaje es exactamente lo que busco. DOS: cruzá el contrato de componentes contra lo que las pantallas del diseño realmente usan, y decime qué componente se usa en alguna pantalla y no está en el contrato, y qué componente está en el contrato y no lo usa nadie. TRES: cruzá el schema del documento 01 contra los datos que las pantallas muestran, y decime qué campo se muestra en pantalla y no existe en el schema, y qué relación hace falta para que una pantalla se pueda consultar sin N+1. CUATRO: listame toda contradicción entre documentos que el orden de autoridad de CLAUDE.md no resuelva. CINCO: decime qué necesitás que decida yo antes de que puedas escribir la primera migración. No arregles nada todavía: entregame el reporte y esperá.
```

Lo que salga de acá se agrega a `CLAUDE.md` como decisión cerrada, y recién ahí arranca `C1`.

---

## 7 · Qué NO le des

- **No le pases `03` ni `04` como especificación.** Están en `docs/` como historia y `CLAUDE.md` lo aclara, pero si además se los nombrás en un prompt como fuente de pantallas, va a construir listas viejas.
- **No le pidas que "haga el diseño más lindo".** El diseño está auditado; una mejora suelta rompe la consistencia que costó once bloques.
- **No le pidas dos bloques en la misma rama.** Un bloque, una rama, un PR.
- **No dejes las tres decisiones abiertas sin cerrar.** Están al pie de `CLAUDE.md`: el arranque sin conexión, el orden de A2 y la licencia. Mientras estén abiertas va a preguntar, que es lo correcto, pero te va a preguntar una vez por sesión.

---

## 8 · El orden completo, corregido

| Fase | Qué | Bloqueada por la auditoría |
|---|---|---|
| Sesión 0 | Reconciliación | No |
| C1 | Setup del proyecto | No |
| C2 | Schema y RLS → **Gate 1** | No |
| C3 | Capa de dinero y FX | No |
| C4 | Tokens, tema y motion → **+ D02** | Contiene el arreglo |
| C5 | Capa offline y datos | No |
| C6 | Componentes → **+ D01, D04, 29 spec** → **Gate 3** | Contiene los arreglos |
| — | *(en paralelo, en Claude Design: las 4 pantallas y las 5 entradas)* | — |
| C7 | Auth y onboarding (bloque A) | Necesita C6 |
| C8 | Captura rápida (bloque C) | Necesita C6 |
| C9 | Bloque L — sistemas transversales | Necesita C6 |
| C10–C18 | D · B · E · H1 · F+G · J · I · H2 · K | Necesitan L |
| C19 | Desktop | — |
| C20 | i18n, accesibilidad, performance | — |
| C21 | Preparación para open source | Necesita la licencia decidida |
| CQ | Auditoría de código | — |

C7 y C8 van antes que el resto de los bloques a propósito: son el camino crítico del producto —entrar y cargar un gasto— y si algo de la fundación está mal, aparece ahí y no en el bloque nueve.
