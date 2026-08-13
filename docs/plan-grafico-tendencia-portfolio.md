# Plan: gráfico de tendencia del portfolio con selector de rango (Fase C)

> Diseño, no implementación — Fase C del rediseño de portfolio tipo Google Finance
> (`docs/design/` no lo cubre, es alcance nuevo decidido en la conversación que trajo
> las capturas de referencia). Fase A (layout ancho + `PositionsTable` con lotes
> inline) y Fase B (highlights "Hoy"/"Total" + tab "Activity") ya están en producción,
> v0.32.0–v0.34.0. Esta fase queda **en espera**: es la más pesada de las tres y la que
> menos aporta hoy, con una sola posición cargada recién esta semana.

## Punto de partida

- **`portfolio_snapshots`** existe en el schema (`supabase/migrations/20260801011010_investments.sql`,
  columnas `portfolio_id, as_of, market_value, cost_basis, cash_flow`, comentario literal
  `-- para TWR y gráficos históricos`) pero es una **tabla fantasma**: cero cron, cero
  Edge Function, cero repo que la lea o escriba. Confirmado por búsqueda exhaustiva antes
  de escribir este plan.
- Lo que sí existe y corre todos los días: `price_snapshots` (serie histórica real de
  precios, PK `(instrument_id, as_of, provider)`, poblada por la Edge Function
  `daily-price-sync`). **Solo tiene datos desde que arrancó ese cron** — no hay backfill
  de precios viejos.
- `src/lib/investments/investments-trend.ts` (`computeInvestmentsTrend`) ya reconstruye
  una serie de valor a partir de `price_snapshots`, con dos simplificaciones documentadas
  en su propio docstring:
  1. La cantidad se mantiene fija en la de HOY para toda la ventana (un trade nuevo no
     "reescribe" el pasado).
  2. La conversión a moneda base usa la cotización de HOY para toda la ventana, no una
     cotización histórica por día.

  Es "cómo se movió el precio de lo que tenés ahora", no un histórico de patrimonio
  exacto — para eso haría falta `portfolio_snapshots` poblada de verdad. Hoy es
  **household-wide** (suma todos los portfolios, `src/hooks/use-investments-trend.ts`,
  consumida solo por el sparkline de "Investing" del home) con `days` fijo en 14.
- `price-snapshots-repo.ts` ya tiene, de la Fase A, dos helpers que esta fase reusa
  directo: `previousCloseFor()` (cierre de ayer, con carry-forward vía
  `nearestPriceOnOrBefore`) y `earliestFor()` (primer `as_of` por instrumento — se agregó
  ahí mismo pensando en esta fase, todavía sin caller).
- **Decisión ya tomada con el usuario**: el selector de rango se ofrece completo
  (1D/5D/1M/6M/YTD/1A/5A/MAX) pero **los rangos que excedan el historial real
  disponible quedan deshabilitados**, nunca ocultos — a medida que se migren datos
  históricos reales (el usuario tiene su propio historial de Google Finance viejo para
  importar más adelante), más opciones se habilitan solas porque la disponibilidad se
  calcula en vivo, sin tocar código.

## Diseño

### 1. `computeInvestmentsTrend` por portfolio, no solo household-wide

Agregar un parámetro opcional `portfolioIds?: string[]` (default: todos los del
household, no rompe al home que ya lo usa sin ese argumento) para poder pedir la serie
de UN solo portfolio — hoy itera `portfoliosRepo.listForHousehold` y suma todos sin
filtro. `days` ya es parametrizable.

### 2. Disponibilidad real, no una lista fija de rangos

`earliestFor(instrumentIds)` (ya existe) da el primer `price_snapshot` por instrumento.
La fecha desde la que hay datos usables para el gráfico de ESTE portfolio es la más
**reciente** entre:

- el primer trade del portfolio (`MIN(trades.executed_at)` sobre los instrumentos
  tenidos), y
- el primer `price_snapshot` de esos mismos instrumentos.

No alcanza con que exista uno de los dos — hace falta saber cuánto se tenía Y a qué
precio, el mismo día. Con esa fecha, `daysAvailable = hoy − esa fecha`.

**Mínimo declarado, como pide el sistema para todo análisis**
(`docs/00-producto.md` no tiene uno para tendencia de portfolio — se declara acá):
**7 días**, igual que patrimonio neto. Por debajo, la card muestra "Necesitás al menos
una semana de historial. Tenés {n} día(s)." en vez del gráfico — nunca una línea de 1-2
puntos fingiendo una tendencia. Con el estado actual del household (una posición inicial
recién cargada), este es el estado que se va a ver hasta que pase una semana o se migre
historial real.

Por encima del mínimo, cada opción del selector se **deshabilita** (nunca se oculta) si
pide más días de los que `daysAvailable` cubre:

| Rango | Días que pide          |
| ----- | ----------------------- |
| 1D    | 1                        |
| 5D    | 5                        |
| 1M    | 30                       |
| 6M    | 180                      |
| YTD   | días desde el 1° de enero |
| 1A    | 365                      |
| 5A    | 1825                     |
| MAX   | `daysAvailable` (siempre disponible) |

### 3. Componente nuevo — `RangeSelector`, requiere OK explícito

`src/design-system/finance/RangeSelector.tsx`. Fila de `Chip` (no `SegmentedControl`: el
contrato lo tapea en 2-4 opciones y acá van hasta 8). Props: opciones con su umbral en
días, valor activo, cuáles quedan deshabilitadas — la lógica de habilitación vive en el
caller (el cálculo de `daysAvailable` de arriba), el componente solo renderiza el estado
que le pasan. Primer caller: este gráfico; queda disponible para cualquier otro análisis
con rango temporal en el futuro (nada lo usa hoy).

### 4. El gráfico en sí

`ChartCard` (ya existe — obligatorio, es lo que garantiza el toggle "ver como tabla" del
sistema) envolviendo `LineChart` (ya existe, eje temporal + tooltip), alimentado por
`computeInvestmentsTrend`. La vista de tabla usa `DataList` (especificado en
`docs/contrato-componentes.md`, **nunca implementado hasta ahora** — mismo caso que
`SelectableRow`/`RangeSelector`: contrato sin código). `RangeSelector` va en el slot
`controls` de `ChartCard`, que existe desde siempre y **nadie lo usa hoy** (0 hits en
todo `src/`).

Se monta en `OverviewContent.tsx`, rama desktop, arriba de los highlights de la Fase B —
mismo lugar que ocupaba el gráfico de evolución en la versión vieja (pre-adenda) de I2.

### 5. Qué NO se resuelve en esta fase

- **No se puebla `portfolio_snapshots`** — es infraestructura de backfill (cron +
  migración de datos históricos), un proyecto aparte que tiene sentido recién cuando el
  usuario importe su historial real de Google Finance. Sin eso, ni MAX ni 5A van a ser
  gráficos "correctos" en el sentido de patrimonio exacto — van a seguir siendo la
  aproximación de `computeInvestmentsTrend` (cantidad y FX de hoy proyectados al
  pasado), simplemente con más días de por medio.
- **No se hace backfill de `price_snapshots`** tampoco. La vía más barata si se
  necesitara sería CoinGecko (`/market_chart`) y ArgentinaDatos, que sí ofrecen series
  históricas; Finnhub tiene `/stock/candle` fuera del free tier.

## Verificación

- Tests unitarios de la disponibilidad (fecha mínima calculada bien contra fixtures de
  trades + `price_snapshots`, incluyendo el caso "un instrumento con precio pero sin
  trade todavía" y viceversa).
- Tests de `computeInvestmentsTrend` con `portfolioIds` filtrando (hoy no tiene tests con
  ese parámetro porque no existe).
- En la app: con el estado real de hoy (posición inicial recién cargada) debe verse el
  mensaje de "falta una semana", no un gráfico con un punto. Simular con datos de prueba
  con ≥30 días de `price_snapshots` (o esperar a que pase el tiempo real) para confirmar
  que 1D/5D/1M se habilitan y 6M/YTD/1A/5A quedan grises hasta que haya más historial.
- `pnpm lint` y `pnpm build` limpios, `CHANGELOG.md`/`CHANGELOG-PUBLIC.md` al cerrar.
