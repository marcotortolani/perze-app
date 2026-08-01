# Índice de vistas — `docs/design/`

Una fila por vista canónica. La columna **Archivo que manda** es la que `CLAUDE.md` referencia
cuando dos archivos definen la misma vista: _"cuando dos archivos definen la misma vista, manda
el que indica `docs/design/INDEX.md`"_.

Fuente: censo de los once bloques más las dos adendas de cierre, cruzado contra
`Mapa-del-sistema.dc.html`. Ver `docs/reconciliacion-sesion-0.md` para el detalle de cómo se
armó el censo, y § _Cómo se verifica_ al final para los comandos que lo reproducen.

> Las celdas de J2 y J4 estaban sin verificar y ya se resolvieron corriendo los comandos de
> § _Cómo se verifica_ — ninguna quedó pisada por `adenda-02-modo-espejo.html`. No quedan
> celdas ⚠ pendientes en este índice.

---

## Los archivos

| Archivo                                               | Qué es                                                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bloque-a-onboarding.html` … `bloque-l-sistemas.html` | Los once bloques originales                                                                                                                                                                             |
| `adenda-01-huecos-navegacion.html`                    | Primer prompt de cierre: G6a, I7b y las cinco entradas huérfanas. **Antes se llamaba `bloque-g-Huecos.html`** — el nombre viejo mentía, porque ese archivo no es del bloque G y es dueño de H1, I2 y J2 |
| `adenda-02-modo-espejo.html`                          | Segundo prompt de cierre: el modo espejo de J4                                                                                                                                                          |
| `Mapa-del-sistema.dc.html`                            | El mapa maestro. No es dueño de ninguna vista: es el censo de IDs                                                                                                                                       |

Las adendas **no son bloques**. Entran después y modifican pantallas que ya existían desde otro
proyecto de Claude Design, así que la versión vieja queda en su archivo original sin fallar
ruidosamente. Por eso existe este índice.

### Ojo con las etiquetas internas de las adendas

Cada adenda se dibujó en un proyecto nuevo y **numera sus frames localmente**: `1a`, `2a`, `1b`…
Esas etiquetas **no son IDs canónicos** y **colisionan entre adendas** — `1a` existe en la
adenda 01 y también en la adenda 02, y son pantallas distintas.

La regla es simple: **el ID canónico es el de este índice** (`G6a`, `I7b`, `J4b`, `H1`, `I2`,
`J2`). Adentro del archivo, la pantalla se ubica **por su título**, no por la etiqueta local. Y
nunca uses una etiqueta local en el código, en una ruta ni en un nombre de componente: `1a` no
significa nada fuera de su propio archivo.

---

## Bloque A · Onboarding

| ID     | Nombre                           | Archivo que manda          | Nota                                                                                                                                           |
| ------ | -------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | Welcome · 3 slides               | `bloque-a-onboarding.html` | Fuera del camino crítico.                                                                                                                      |
| A2     | Auth · magic link, Google, Apple | `bloque-a-onboarding.html` |                                                                                                                                                |
| A3     | Verificación del link            | `bloque-a-onboarding.html` |                                                                                                                                                |
| A4     | País y moneda                    | `bloque-a-onboarding.html` |                                                                                                                                                |
| A5     | Con quién la vas a usar          | `bloque-a-onboarding.html` |                                                                                                                                                |
| A6     | Primera cuenta                   | `bloque-a-onboarding.html` |                                                                                                                                                |
| A7     | Saldo inicial                    | `bloque-a-onboarding.html` |                                                                                                                                                |
| A8     | Plantilla de categorías          | `bloque-a-onboarding.html` | Fuera del camino crítico.                                                                                                                      |
| A9     | Los seis módulos                 | `bloque-a-onboarding.html` | Fuera del camino crítico. Es el destino de "activar/apagar módulos" citado desde I1 y desde el mapa.                                           |
| A10    | Instalar como app                | `bloque-a-onboarding.html` | Se ofrece después del primer gasto, no en el onboarding.                                                                                       |
| A11    | Éxito — primer gasto             | `bloque-a-onboarding.html` |                                                                                                                                                |
| **L6** | **Bloqueo por PIN**              | `bloque-a-onboarding.html` | **No vive en `bloque-l-sistemas.html`.** Es la excepción más citada del inventario: quien busca L6 en el archivo del bloque L no la encuentra. |

## Bloque B · Home

| ID  | Nombre                      | Archivo que manda    | Nota                                            |
| --- | --------------------------- | -------------------- | ----------------------------------------------- |
| B1  | Home · 3 variantes de flags | `bloque-b-home.html` | Incluye los estados de scope que antes eran B5. |
| B2  | Home vacío                  | `bloque-b-home.html` |                                                 |
| B3  | Home cargando               | `bloque-b-home.html` |                                                 |
| B4  | Home offline                | `bloque-b-home.html` |                                                 |
| B6  | Tab bar                     | `bloque-b-home.html` |                                                 |
| B7  | Más · índice                | `bloque-b-home.html` |                                                 |
| B8  | Búsqueda global             | `bloque-b-home.html` |                                                 |

> **B5** — no es una vista propia. Reclasificada como estados de B1 dentro del mismo archivo.

## Bloque C · Captura

| ID  | Nombre                  | Archivo que manda       | Nota                                                                                                             |
| --- | ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| C1  | Paso monto · keypad     | `bloque-c-captura.html` |                                                                                                                  |
| C2  | Paso categoría          | `bloque-c-captura.html` |                                                                                                                  |
| C3  | Detalles colapsados     | `bloque-c-captura.html` |                                                                                                                  |
| C4  | Moneda distinta · rate  | `bloque-c-captura.html` |                                                                                                                  |
| C5  | Ingreso                 | `bloque-c-captura.html` |                                                                                                                  |
| C6  | Transferencia           | `bloque-c-captura.html` |                                                                                                                  |
| C7  | Guardado y deshacer     | `bloque-c-captura.html` |                                                                                                                  |
| C8  | Modo ráfaga             | `bloque-c-captura.html` |                                                                                                                  |
| C9  | Captura por voz         | `bloque-c-captura.html` |                                                                                                                  |
| C10 | Foto de ticket          | `bloque-c-captura.html` | Parcial: solo punto de entrada (C10a) y flujo previsto (C10b). Fase futura, ya declarada así en el mapa maestro. |
| C11 | Sin conexión al guardar | `bloque-c-captura.html` |                                                                                                                  |

## Bloque D · Movimientos

| ID  | Nombre                 | Archivo que manda           | Nota |
| --- | ---------------------- | --------------------------- | ---- |
| D1  | Lista agrupada por día | `bloque-d-movimientos.html` |      |
| D2  | Filtros                | `bloque-d-movimientos.html` |      |
| D3  | Detalle                | `bloque-d-movimientos.html` |      |
| D4  | Editar                 | `bloque-d-movimientos.html` |      |
| D5  | Calendario del mes     | `bloque-d-movimientos.html` |      |
| D6  | Estados                | `bloque-d-movimientos.html` |      |
| D7  | Selección múltiple     | `bloque-d-movimientos.html` |      |

## Bloque E · Cuentas

| ID       | Nombre                           | Archivo que manda       | Nota                                                                                                                                                           |
| -------- | -------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1       | Lista de cuentas                 | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E2       | Detalle de cuenta                | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E3       | Crear / editar cuenta            | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E3.1     | Tipo de cuenta                   | `bloque-e-cuentas.html` | Paso 1 de E3.                                                                                                                                                  |
| E3.2     | Datos de la cuenta               | `bloque-e-cuentas.html` | Paso 2 de E3.                                                                                                                                                  |
| E4       | Tarjeta de crédito               | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E4.1     | Ciclo actual                     | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E4.2     | Cuotas y proyección              | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E5       | Conciliación                     | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E5.1     | La pregunta                      | `bloque-e-cuentas.html` | Paso 1 de E5.                                                                                                                                                  |
| E5.2     | La diferencia                    | `bloque-e-cuentas.html` | Paso 2 de E5.                                                                                                                                                  |
| E5.3     | Conciliada                       | `bloque-e-cuentas.html` | Paso 3 de E5.                                                                                                                                                  |
| E6       | Monedas y tipos de cambio        | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E6.1     | Monedas                          | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E6.2     | El par                           | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E6.3     | Override manual                  | `bloque-e-cuentas.html` | Es el paso 1 de la cadena de resolución de FX. Se guarda en `fx_overrides`, con `valid_from` / `valid_to`.                                                     |
| E6.4     | Histórico                        | `bloque-e-cuentas.html` |                                                                                                                                                                |
| E7       | Estados                          | `bloque-e-cuentas.html` |                                                                                                                                                                |
| **E8**   | **Resolver FX faltantes · lote** | `bloque-e-cuentas.html` | **Está en el mapa maestro y NO figura en `03` ni en `04`.** Es la única vista canónica que los dos prompts no mencionan. Cierra la cadena de resolución de FX. |
| **E8.1** | **El lote**                      | `bloque-e-cuentas.html` | Es la referencia de cómo se declara un `needs_fx`: **conteo, nunca monto**.                                                                                    |
| **E8.2** | **Grupo aplicado**               | `bloque-e-cuentas.html` |                                                                                                                                                                |

## Bloques F+G · Presupuestos, metas, recurrentes, deudas

| ID      | Nombre                  | Archivo que manda                  | Nota                                                                                                                                                   |
| ------- | ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F0      | Activar presupuestos    | `bloque-fg-presupuestos.html`      | Sin ID propio en `04` — ahí es la frase genérica "más la pantalla de activación de cada módulo".                                                       |
| F1      | Presupuestos overview   | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| F2      | Detalle por categoría   | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| F3      | Crear presupuesto       | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| F4      | Alerta de excedido      | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| F0m     | Activar metas           | `bloque-fg-presupuestos.html`      | Sin ID propio en `04`.                                                                                                                                 |
| F5      | Metas                   | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| F6      | Detalle de meta         | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| F7      | Crear meta              | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| G0r     | Activar recurrentes     | `bloque-fg-presupuestos.html`      | Sin ID propio en `04`.                                                                                                                                 |
| G1      | Recurrentes             | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| G2      | Detalle de recurrente   | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| G3      | Crear recurrente        | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| G0d     | Activar deudas y cuotas | `bloque-fg-presupuestos.html`      | Sin ID propio en `04`.                                                                                                                                 |
| G4      | Deudas y cuotas         | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| G5      | Detalle de deuda        | `bloque-fg-presupuestos.html`      |                                                                                                                                                        |
| G6      | Crear plan de cuotas    | `bloque-fg-presupuestos.html`      | Arranca con la compra de origen ya elegida. Ese paso previo es **G6a**, ver abajo.                                                                     |
| **G6a** | **Elegir la compra**    | `adenda-01-huecos-navegacion.html` | **Nueva.** El selector de transacción con tarjeta que alimenta G6. No es una versión alternativa de otra pantalla: es el paso que faltaba entre D y G. |

## Bloque H · Análisis

| ID     | Nombre                        | Archivo que manda                      | Nota                                                                                                                                                                                                                                                                      |
| ------ | ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H1** | **Analytics home**            | **`adenda-01-huecos-navegacion.html`** | **Vista con dos versiones.** La base vive en `bloque-h-analisis.html`; la de la adenda la reemplaza porque agrega la fila de entrada a H12 ("Tu 2026 en números", deshabilitada hasta los 12 meses cerrados). No programar contra la versión de `bloque-h-analisis.html`. |
| H2     | Categorías · treemap          | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H3     | Tendencias                    | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H4     | Flujo de dinero · Sankey      | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H5     | Patrimonio neto · waterfall   | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H6     | Multi-moneda                  | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H7     | Inflación                     | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H8     | Calendario · heatmap          | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H9     | Comercios                     | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H10    | Insights                      | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H11    | Resumen semanal               | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H12    | Wrapped                       | `bloque-h-analisis.html`               | Antes huérfana (D06a). Entrada resuelta desde H1 en la adenda 01.                                                                                                                                                                                                         |
| H13    | Exportar / reportes           | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |
| H14    | Estados · umbral por análisis | `bloque-h-analisis.html`               |                                                                                                                                                                                                                                                                           |

## Bloque I · Inversiones

| ID      | Nombre                          | Archivo que manda                      | Nota                                                                                                                                                                                                                                                                                                                                            |
| ------- | ------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1      | Activación · clases de activo   | `bloque-i-inversiones.html`            |                                                                                                                                                                                                                                                                                                                                                 |
| **I2**  | **Portfolio overview**          | **`adenda-01-huecos-navegacion.html`** | **Vista con dos versiones.** La base vive en `bloque-i-inversiones.html`; la de la adenda la reemplaza: agrega las entradas a I9/I10/I11 y de paso corrige D20 y D26 (los dos `StatTile` de 30 px se convierten en una fila, bajando la pantalla de 4 a 3 niveles tipográficos). No programar contra la versión de `bloque-i-inversiones.html`. |
| I3      | Posiciones                      | `bloque-i-inversiones.html`            | Objetivo duro del bloque.                                                                                                                                                                                                                                                                                                                       |
| I4      | Detalle de instrumento          | `bloque-i-inversiones.html`            |                                                                                                                                                                                                                                                                                                                                                 |
| I5      | Registrar operación             | `bloque-i-inversiones.html`            |                                                                                                                                                                                                                                                                                                                                                 |
| I6      | Registrar renta                 | `bloque-i-inversiones.html`            |                                                                                                                                                                                                                                                                                                                                                 |
| I7      | Buscar / agregar instrumento    | `bloque-i-inversiones.html`            | El botón "Crear a mano" entra a **I7b**, ver abajo.                                                                                                                                                                                                                                                                                             |
| **I7b** | **Crear un instrumento a mano** | `adenda-01-huecos-navegacion.html`     | **Nueva.** El formulario de cuatro campos que I7 prometía: nombre, clase, moneda, precio inicial con keypad. No es una versión alternativa de I7.                                                                                                                                                                                               |
| I8      | Clases de activo · CRUD         | `bloque-i-inversiones.html`            |                                                                                                                                                                                                                                                                                                                                                 |
| I9      | Allocation y rebalanceo         | `bloque-i-inversiones.html`            | Antes huérfana (D06a). Entrada resuelta desde I2 en la adenda 01: fila al pie de la card del donut.                                                                                                                                                                                                                                             |
| I10     | Rendimiento · TWR / XIRR        | `bloque-i-inversiones.html`            | Antes huérfana. Entrada resuelta desde I2: reemplaza los dos `StatTile` sueltos por una fila.                                                                                                                                                                                                                                                   |
| I11     | Calendario de renta futura      | `bloque-i-inversiones.html`            | Antes huérfana. Entrada resuelta desde I2: fila hermana de I10.                                                                                                                                                                                                                                                                                 |
| I12     | Estados · precio viejo          | `bloque-i-inversiones.html`            |                                                                                                                                                                                                                                                                                                                                                 |

## Bloque J · Grupo familiar

| ID      | Nombre                                            | Archivo que manda                        | Nota                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J1      | Activación + primer miembro                       | `bloque-j-familiar.html`                 |                                                                                                                                                                                                                                                                                                                                                                       |
| **J2**  | **Household overview**                            | `adenda-01-huecos-navegacion.html` | **Verificado.** La base vive en `bloque-j-familiar.html`; la de la adenda 01 la reemplaza porque agrega la fila de entrada a J8 ("Vos y Ana"). `adenda-02-modo-espejo.html` no la tocó otra vez — su propio texto lo dice explícitamente: "J2 no se tocó". Sigue mandando la adenda 01. |
| J3      | Invitar · email o QR                              | `bloque-j-familiar.html`                 |                                                                                                                                                                                                                                                                                                                                                                       |
| **J4**  | **Permisos y visibilidad**                        | `bloque-j-familiar.html`       | **Verificado.** El botón "Ver la app como Ana" que promete el modo espejo vive en J4, en `bloque-j-familiar.html`, y la adenda 02 no rediseña esa pantalla — solo dibuja el destino nuevo (`J4b`). J4 sigue mandando desde el bloque base. |
| **J4b** | **Modo espejo · ver la app como el otro miembro** | `adenda-02-modo-espejo.html`             | **Nueva.** `J4b` es el ID canónico que le asignamos acá; adentro del archivo está etiquetada `1a`, que es numeración local de la adenda y no significa nada afuera. Lleva el `MirrorBanner` persistente. Regla de arquitectura que la pantalla asume: el espejo **nunca amplía el acceso de quien mira**, solo muestra lo que ese miembro ya podría ver por sí mismo. |
| J5      | Gastos compartidos                                | `bloque-j-familiar.html`                 |                                                                                                                                                                                                                                                                                                                                                                       |
| J6      | Dividir un gasto                                  | `bloque-j-familiar.html`                 | Tres pasos ilustrados dentro del mismo archivo (preset, arrastre, proporcional al ingreso); no son IDs propios.                                                                                                                                                                                                                                                       |
| J7      | Liquidar                                          | `bloque-j-familiar.html`                 | El agregado más delicado de la app: un gasto compartido en otra moneda sin cotización cambia quién le debe a quién.                                                                                                                                                                                                                                                   |
| J8      | Comparativa entre miembros                        | `bloque-j-familiar.html`                 | Antes huérfana (D06a). Entrada resuelta desde J2 en la adenda 01: fila permanente que enruta a J8 o a J8b según el opt-in mutuo.                                                                                                                                                                                                                                      |
| J9      | Actividad del household                           | `bloque-j-familiar.html`                 | Audita los cambios de visibilidad. Por eso `visibility_grants` guarda `granted_by`, `granted_at` y `revoked_at`.                                                                                                                                                                                                                                                      |
| J10     | Estados · conflicto de sync                       | `bloque-j-familiar.html`                 | Unificada con L3.                                                                                                                                                                                                                                                                                                                                                     |

## Bloque K · Ajustes

| ID      | Nombre                        | Archivo que manda       | Nota                                                                                                      |
| ------- | ----------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| K1      | Índice de ajustes             | `bloque-k-ajustes.html` |                                                                                                           |
| K2      | Perfil                        | `bloque-k-ajustes.html` |                                                                                                           |
| K3      | Preferencias                  | `bloque-k-ajustes.html` | Tiene el cuarto slot del tab bar y el día de cierre, que es **por household**.                            |
| K3a     | Una sola moneda               | `bloque-k-ajustes.html` | Dice "tu moneda", no "moneda base".                                                                       |
| K3b     | Tres monedas en uso           | `bloque-k-ajustes.html` | Recién acá aparece "moneda base".                                                                         |
| K3c     | Color de la app               | `bloque-k-ajustes.html` | El primario es personalizable; aqua y naranja no, porque portan significado.                              |
| K4      | Módulos                       | `bloque-k-ajustes.html` | Destino más citado del sistema (desde A9, desde I1, desde el mapa).                                       |
| K5      | Categorías                    | `bloque-k-ajustes.html` |                                                                                                           |
| K6      | Tags y comercios              | `bloque-k-ajustes.html` |                                                                                                           |
| K7      | Reglas de auto-categorización | `bloque-k-ajustes.html` |                                                                                                           |
| K8      | Fuentes de tipo de cambio     | `bloque-k-ajustes.html` |                                                                                                           |
| **K9**  | **Importar CSV**              | `bloque-k-ajustes.html` | Uno de los diez flujos críticos. **Se partió en tres pasos**, ver abajo.                                  |
| **K9a** | **Archivo**                   | `bloque-k-ajustes.html` | Paso 1 de K9.                                                                                             |
| **K9b** | **Columnas**                  | `bloque-k-ajustes.html` | Paso 2 de K9 — mapeo guiado. El mapeo se guarda en `import_batches.mapping` para reutilizarlo.            |
| **K9c** | **Duplicados**                | `bloque-k-ajustes.html` | Paso 3 de K9.                                                                                             |
| K10     | Exportar y backup             | `bloque-k-ajustes.html` |                                                                                                           |
| K11     | Seguridad                     | `bloque-k-ajustes.html` | El PIN es opcional y apagado por defecto. La pantalla de bloqueo en sí es L6, en el archivo del bloque A. |
| K12     | Notificaciones                | `bloque-k-ajustes.html` |                                                                                                           |
| K13     | Acerca de                     | `bloque-k-ajustes.html` | Necesita la licencia decidida (MIT o AGPL).                                                               |

## Bloque L · Sistemas transversales

| ID  | Nombre                                 | Archivo que manda        | Nota                                                                                                         |
| --- | -------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| L1  | Sistema de estados vacíos              | `bloque-l-sistemas.html` | El patrón es `ZMark` al 20%, no un ícono de línea. `EmptyState` del bundle todavía usa el ícono viejo (D01). |
| L2  | Sistema de skeletons                   | `bloque-l-sistemas.html` | Cuatro plantillas por layout, no una por pantalla.                                                           |
| L3  | Sistema de errores + conflicto de sync | `bloque-l-sistemas.html` | Unificada con J10.                                                                                           |
| L4  | Toasts y deshacer                      | `bloque-l-sistemas.html` | Reversible, no confirmable: el diálogo es la excepción.                                                      |
| L5  | Onboarding contextual                  | `bloque-l-sistemas.html` |                                                                                                              |

> **L6** — no vive acá. Ver la fila de L6 en el bloque A, arriba.

---

## Vistas con dos versiones — por qué existen

Una adenda **modifica pantallas existentes desde un proyecto de Claude Design distinto** al que
las dibujó la primera vez. La pantalla vieja no se reemplaza en su archivo original: queda ahí,
sin fallar ruidosamente. Claude Code abre el primero que encuentra y programa la versión vieja
sin que nada avise. Este índice es lo único que lo evita.

Confirmadas hoy: **H1**, **I2** y **J2** mandan desde `adenda-01-huecos-navegacion.html`.
Pendientes de verificar: **J2** de nuevo y **J4**, contra `adenda-02-modo-espejo.html`.

---

## Cómo se verifica

Este índice **no se actualiza solo**. Estos tres comandos lo reproducen y resuelven las celdas
marcadas con ⚠. Corrélos desde la raíz del repo.

Los archivos de bloque etiquetan sus frames con el ID canónico (`>J4 · …`). **Las adendas no**:
usan numeración local. Así que hacen falta dos censos distintos.

**1 · Los bloques, por ID canónico:**

```bash
cd docs/design && for f in bloque-*.html; do
  grep -oE '>[A-L][0-9]{1,2}[a-z]?(\.[0-9])? ·' "$f" | tr -d '>· ' | sort -u | sed "s|$| $f|"
done | sort
```

**2 · Las adendas, por título** — la etiqueta local no sirve, así que se busca el nombre de la
pantalla:

```bash
grep -oE '>[^<]{3,70}' docs/design/adenda-02-modo-espejo.html \
  | grep -viE 'lorem|^\>\s*$' | sort -u | head -60
```

Con esa lista, mirá cuáles títulos coinciden con pantallas que ya existen en un bloque: **esas
son las pisadas** y su fila acá tiene que apuntar a la adenda.

**3 · En qué archivos está un ID canónico** — para desempatar entre bloques:

```bash
grep -lE '>J4 ·' docs/design/*.html
```

Cada vez que aterrice una adenda nueva: corré el 2 sobre ella, cruzá los títulos contra este
índice, y por cada pantalla pisada actualizá su fila **dejando escrito qué cambió**. Pisar el
nombre del archivo sin decir por qué convierte al índice en una lista de rutas y le saca lo único
que lo hace útil.

Si un ID falta acá, o apunta a un archivo que no existe, el índice está desactualizado y hay que
corregirlo **antes** de programar esa pantalla.
