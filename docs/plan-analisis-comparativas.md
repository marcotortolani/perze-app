# Plan — Análisis comparativo e interanual

Documento de estado y planificación para la sección de Análisis: qué existe hoy, qué está
diseñado pero no construido, qué haría falta construir para comparar años/meses/categorías, y
qué requisito de datos hay que cumplir antes de poder mostrar cualquiera de esas comparaciones
con sentido. Se abre a partir de la migración en curso del Excel histórico de finanzas
personales (planillas mensuales, todavía sin normalizar) y de la pregunta de si el bloque de
Análisis ya contempla comparar años. Nada de lo que sigue está implementado; es una foto de
dónde estamos y un borrador de dónde ir.

> **Estado — 16 de agosto de 2026, cierre de la auditoría técnica.** Este documento se citó al
> cerrar el plan de auditoría del bloque F/H/I (`docs/auditoria/` y la conversación que lo
> generó) para decidir qué hacer con "comparación mes-a-mes/año-a-año" (gap #06 de esa
> auditoría). **Decisión: se postergó por completo**, sin tocar código — el bloqueador real
> (migración del Excel histórico, § 4) sigue sin resolverse, y las dos alternativas de § 3.2
> (extender pantallas vs. panel de análisis avanzado) siguen sin decidirse. Nada de lo que sigue
> en este documento cambió de estado por ese cierre.
>
> En la misma sesión se construyeron dos pantallas nuevas bajo Análisis que **no son
> comparación interanual** y no resuelven nada de lo que pide este documento, pero conviene
> anotar acá para que no se confundan con lo de arriba:
>
> - **`/analytics/anomalies`** (detección de anomalías por movimiento, mediana + MAD) — mira
>   solo la categoría de un movimiento contra su propio historial, nunca compara dos rangos de
>   tiempo ni dos años. El mínimo de historial que usa (20 movimientos en la categoría) ya estaba
>   listado en § 4 como spec sin código; ahora tiene código detrás.
> - **`/analytics/balance-projection`** (proyección de saldo 30/60/90 días) — mira hacia
>   adelante con lo ya comprometido (cuotas, recurrentes, renta fija), nunca hacia atrás. No
>   tiene relación con año contra año.

## 1. Qué existe hoy

Diez pantallas viven bajo `src/app/(app)/analytics/`, todas correspondientes a IDs del bloque H
(`docs/design/bloque-h-analisis.html`, ver `docs/design/INDEX.md`). Cada una mira **un solo
período a la vez** — el ciclo actual del household o una ventana fija — y ninguna ofrece
selector de año ni comparación entre dos rangos elegidos por el usuario.

| Pantalla                    | ID | Ruta                            | Ventana que muestra hoy                              |
| ---------------------------- | -- | -------------------------------- | ------------------------------------------------------ |
| Categorías · treemap         | H2 | `analytics/categories`           | Período actual (ciclo del household)                   |
| Tendencias                   | H3 | `analytics/trends`               | Últimos 14 días, gráfico diario                        |
| Flujo de dinero · Sankey     | H4 | `analytics/flow`                 | Período actual                                         |
| Patrimonio neto · waterfall  | H5 | `analytics/net-worth`            | Serie desde que hay datos, sin agregación anual         |
| Multi-moneda                 | H6 | `analytics/currencies`           | Cotizaciones vigentes / histórico corto                 |
| Inflación                    | H7 | `analytics/inflation`            | Mes actual vs. mes anterior                              |
| Calendario · heatmap         | H8 | `analytics/calendar`             | Mes en curso                                             |
| Comercios                    | H9 | `analytics/merchants`            | Período actual                                           |
| Insights                     | H10 | `analytics/insights`            | Derivado de presupuestos activos, sin corte temporal      |
| Resumen semanal              | H11 | `analytics/weekly`              | Semana en curso                                           |
| Wrapped                      | H12 | `analytics/wrapped`             | Retrospectiva anual, generada una vez al cierre del año   |
| Exportar / reportes          | H13 | `analytics/export`              | Exporta lo que ya está cargado, sin recorte comparativo   |

`Wrapped` (H12) es la única pantalla con una noción de "año" hoy, y es una retrospectiva
narrativa de cierre — no una herramienta de comparación que el usuario pueda accionar
(elegir dos años, dos meses, dos categorías) fuera de esa narrativa fija.

**Confirmado leyendo el código de `TrendsPage`** (`src/app/(app)/analytics/trends/page.tsx`):
la pantalla trae `useTransactions` sin filtro de fecha, recorta a los últimos 14 días en
memoria, y compara "esta semana" contra "la semana pasada" con un `StatTile` de delta. No hay
ningún parámetro de año, ni un segundo rango para comparar contra un período no adyacente.

## 2. Qué está diseñado pero no construido

`docs/design/bloque-h-analisis.html` sí contempla comparación interanual, pero **el diseño le
sacó ventaja al código**: hay contenido de UI ya pensado en el archivo de diseño que ninguna
pantalla implementa todavía.

- **H3 (Tendencias) — "año contra año".** El diseño describe una vista de 13 meses en la que
  cada mes se compara contra el mismo mes del año anterior ("comparar con el mismo mes del año
  pasado"). Necesita 13 meses de datos para armar el primer punto de comparación. La pantalla
  construida (`trends/page.tsx`) no tiene ninguno de estos elementos: ni el selector de año, ni
  la ventana de 13 meses, ni la comparación mes-contra-mismo-mes.
- **H6 (Multi-moneda) — cotizaciones año contra año.** El diseño anota que esa comparación "usa
  cotizaciones del último año" y que hacen falta dos años de datos para que la comparación
  tenga sentido. Tampoco está construido.

No hay evidencia en `docs/design/` de una pantalla dedicada a **comparar categorías entre
años** (ej. "cuánto gasté en Comida en 2025 vs. 2026") ni de un panel único de "análisis
avanzado" que centralice comparaciones libres (elegir dos rangos cualesquiera, cualquier
dimensión). Lo que existe es la comparación año-contra-año acotada a H3 y H6.

## 3. Qué haría falta construir

Separado en dos grupos: extender lo que el diseño ya previó, y lo que no está ni diseñado ni
construido y habría que definir desde cero.

### 3.1 Completar lo ya diseñado (H3, H6)

- Rehacer `TrendsPage` (o agregar una vista hermana) con la ventana de 13 meses y el selector
  de mes/año que el diseño describe, comparando cada mes contra el mismo mes del año anterior.
  Esto reemplaza o convive con la vista actual de 14 días — a definir si conviven como dos tabs
  o si la de 14 días queda como el "detalle reciente" y la anual como una pantalla aparte.
- Sumar a H6 la serie de cotizaciones de los últimos 12 meses con el mismo criterio de
  comparación año-contra-año que ya anota el diseño.
- Ambas dependen de la regla de mínimo de historial (ver § 4) — hasta cumplir el mínimo, la
  pantalla muestra cuánto falta en vez del gráfico, siguiendo el patrón ya establecido en
  `CLAUDE.md` para el resto de los análisis.

### 3.2 Sin diseñar todavía — a definir antes de programar

Nada de esto tiene verdad de píxel en `docs/design/`. Antes de escribir código hay que decidir
alcance y, si corresponde, diseñarlo (no programar contra una idea sin pantalla, como ya
advierte `CLAUDE.md` sobre no inventar componentes).

- **Comparación de categorías entre períodos arbitrarios.** Elegir dos rangos (dos meses, dos
  años, un mes de un año contra el mismo mes de otro) y ver el treemap o una tabla de categorías
  lado a lado con el delta. Hoy `H2` (Categorías) es de un solo período.
- **Comparación de ingresos entre años.** Ninguna pantalla hoy aísla "ingresos" como serie
  comparable año a año — `H4` (Flujo) y `H5` (Patrimonio neto) muestran la relación
  ingreso/gasto de un período, no una serie multi-año de ingresos solos.
  `classifyCashFlow`/`classifyConsumption` (`src/lib/analytics/cash-flow.ts`) ya dan la base de
  clasificación correcta para construir esto sin reinventar el signo de cada `kind`.
  Cuidado con no volver a esta discusión mezclando flujo de caja y consumo con conversiones de
  moneda al comparar ingreso/gasto entre monedas distintas.
- **Un panel de "análisis avanzado" propio**, con selector de rango libre + selector de
  dimensión (categoría, comercio, cuenta, tag) + comparación contra un rango de referencia. Esto
  sería la herramienta general que el usuario pidió ("mayores herramientas para ver datos,
  compararlos"), más que agregar comparación año-contra-año pantalla por pantalla. Es la opción
  de mayor alcance y la que más justifica pasar primero por diseño antes de tocar código.

**No hay una recomendación cerrada entre "extender cada pantalla existente con su propio
selector de año" y "un panel de análisis avanzado separado que cubra varias dimensiones a la
vez"**: son dos enfoques válidos con costos de diseño distintos y quedan para decidir cuando
haya datos reales con los que probar cualquiera de los dos.

## 4. Qué falta de datos para que esto tenga sentido

La migración del Excel histórico (ver memoria de sesión — planillas mensuales desprolijas,
todavía sin normalizar) es el bloqueador real, no el código. Ninguna comparación interanual
sirve de nada sin al menos un año completo cargado, y `CLAUDE.md` ya fija el principio general:
*"Un gráfico con dos puntos enseña una tendencia que no existe. Cada análisis declara su mínimo
y, hasta alcanzarlo, muestra cuánto falta en vez del gráfico."*

Mínimos que ya existen (tabla completa en `docs/00-producto.md`) y que aplican a lo que hoy está
construido:

- Patrimonio neto: 7 días
- Categorías, flujo y comercios: 1 período cerrado
- Tendencias y calendario: 30 días
- Inflación y multi-moneda: 2 meses
- Anomalías: 20 movimientos en la categoría (implementado — `/analytics/anomalies`, ver nota de
  estado al comienzo del documento)
- XIRR: 2 flujos y 30 días

**Mínimos que todavía no están definidos** y hay que fijar antes de construir lo del § 3:

- **Año contra año (H3, H6 extendidos)**: el diseño dice "13 meses" pero no está escrito como
  regla formal en `docs/00-producto.md` — falta decidir si son 13 meses calendario o 12 meses
  cerrados + el actual, y qué se muestra con menos (¿el mes suelto sin comparación? ¿nada?).
- **Comparación de categorías entre rangos arbitrarios**: un mínimo por rango elegido, no fijo —
  probablemente "cada uno de los dos rangos debe tener al menos 1 período cerrado", heredando
  el mínimo que ya usa H2, pero hay que decidir qué pasa si un rango cumple y el otro no.
- **Comparación de ingresos multi-año**: sin mínimo definido, análogo al de patrimonio neto (7
  días) pero para una serie de más largo plazo — a definir junto con el diseño de esa pantalla.

Requisito de datos concreto para el usuario, hoy: con el Excel migrado vas a tener,
probablemente, entre 1 y pocos años de historia real. Eso alcanza para year-over-year en el
sentido más simple (año actual vs. año anterior, o mes vs. mismo mes del año pasado) pero no
para series largas tipo "últimos 5 años" — esas van a ir madurando solas a medida que pase el
tiempo y no son bloqueo para arrancar.

## 5. Próximo paso

Confirmado el 16 de agosto de 2026: se posterga en bloque, sin abrir ninguna de las dos
alternativas de § 3.2 todavía. Cuando el Excel esté migrado y haya datos reales para probar
contra ellos, retomar acá: primero decidir entre "extender pantallas existentes" vs. "panel de
análisis avanzado" (§ 3.2), después fijar los mínimos de historial que faltan (§ 4), y recién
ahí pasar a diseño si corresponde.
