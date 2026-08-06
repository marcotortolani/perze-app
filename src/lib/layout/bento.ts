/**
 * Bento grid genérico de 12 columnas, sized por peso — nació en
 * `AccountCarousel.tsx` (D-carrusel de cuentas del home) y se generaliza
 * acá para que cualquier pantalla que necesite "bloques de tamaño
 * proporcional al peso, sin deformarse en tabla" lo reuse (p. ej. la
 * asignación de inversiones por posición, I9).
 */

/**
 * Filas de 3 cards, cada una una permutación de {3,4,5} — asimétricas a
 * propósito (`[4,4,4]` repetido es justo el look de tabla plana que se
 * busca evitar). Filas de 2, `[5,7]`/`[7,5]`.
 *
 * Elegir CUÁL variante usar en cada fila no es libre: dos filas vecinas
 * que compartan un límite de columna dibujan una línea recta vertical
 * entre ellas — dos cards apiladas de mismo ancho en la misma posición se
 * leen como una columna de tabla, no como bento. `rowBreakpoints()` +
 * `pickRow()` más abajo garantizan que ninguna fila comparta un límite
 * con la fila inmediatamente anterior.
 */
const THREE_ROW_POOL: readonly number[][] = [
  [5, 4, 3],
  [3, 4, 5],
  [4, 5, 3],
  [3, 5, 4],
  [5, 3, 4],
  [4, 3, 5],
];
const TWO_ROW_POOL: readonly number[][] = [
  [5, 7],
  [7, 5],
];

/** Límites internos de una fila (sumas parciales, sin contar 0 ni 12: esos son el borde del grid, no un límite entre cards). */
function rowBreakpoints(row: number[]): number[] {
  const bps: number[] = [];
  let acc = 0;
  for (let i = 0; i < row.length - 1; i++) {
    acc += row[i]!;
    bps.push(acc);
  }
  return bps;
}

/**
 * Primera fila del `pool`, empezando en `startIdx` (para variar cuál se
 * usa primero entre llamados) y rotando, que NO comparta ningún límite de
 * columna con `prevBreakpoints` — la fila anterior. Con pools de 2 y 6
 * filas y como mucho 2 límites por fila, siempre hay al menos una opción
 * libre (cada valor de límite aparece en, a lo sumo, la mitad del pool);
 * el `return` final es una salvaguarda que no debería alcanzarse nunca.
 */
function pickRow(pool: readonly number[][], startIdx: number, prevBreakpoints: Set<number>): number[] {
  for (let k = 0; k < pool.length; k++) {
    const candidate = pool[(startIdx + k) % pool.length]!;
    if (!rowBreakpoints(candidate).some((bp) => prevBreakpoints.has(bp))) return candidate;
  }
  return pool[startIdx % pool.length]!;
}

/**
 * Reparte el resto de `n - c1` cards (`c1` = tamaño de la primera fila) en
 * filas de 3 y de 2 que sumen exacto 12 (las columnas del grid) cada una,
 * MAXIMIZANDO las filas de 3 — son las que dan el look bento; una fila de
 * 2 sola se lee más parecida a una tabla. `r === 1` no tiene split válido
 * (ninguna combinación de filas de 3/2 deja exactamente 1 card sobrante):
 * se descarta probando el otro tamaño de primera fila.
 */
function splitRest(r: number): { threes: number; twos: number } | null {
  if (r === 0) return { threes: 0, twos: 0 };
  if (r % 3 === 0) return { threes: r / 3, twos: 0 };
  if (r % 3 === 2) return { threes: (r - 2) / 3, twos: 1 };
  if (r < 4) return null; // r === 1: sin split válido
  return { threes: (r - 4) / 3, twos: 2 };
}

/**
 * Forma del grid, una por cantidad de items — anchos de columna ELEGIDOS,
 * no calculados a partir del peso de cada item (eso es trabajo de
 * `assignBentoSlots()` más abajo, y solo decide QUIÉN va en cada slot,
 * nunca el ancho del slot). La primera fila lleva 2 o 3 items y es la que
 * ancla la pantalla (`[7,5]` o `[6,3,3]`); el resto se reparte en filas de
 * 3 y de 2 vía `splitRest()`, maximizando las de 3, y cada fila se elige
 * con `pickRow()` para que nunca comparta un límite de columna con la
 * fila anterior. Con empate en cantidad de filas de 3, gana la primera
 * fila de 2 items — dos anchos (7 y 5) en vez de tres leen mejor como
 * ancla.
 */
export function bentoLayout(n: number): number[][] {
  if (n <= 0) return [];
  if (n === 1) return [[12]];
  if (n === 2) return [[7, 5]];
  if (n === 3) return [[6, 3, 3]];

  const candidates = (
    [
      { c1: 2 as const, split: splitRest(n - 2) },
      { c1: 3 as const, split: splitRest(n - 3) },
    ] as const
  ).filter((c): c is { c1: 2 | 3; split: { threes: number; twos: number } } => c.split !== null);

  const best = candidates.reduce((a, b) => (b.split.threes > a.split.threes ? b : a));

  const rows: number[][] = [best.c1 === 2 ? [7, 5] : [6, 3, 3]];
  for (let i = 0; i < best.split.threes; i++) {
    const prev = new Set(rowBreakpoints(rows[rows.length - 1]!));
    rows.push(pickRow(THREE_ROW_POOL, i, prev));
  }
  for (let i = 0; i < best.split.twos; i++) {
    const prev = new Set(rowBreakpoints(rows[rows.length - 1]!));
    rows.push(pickRow(TWO_ROW_POOL, i, prev));
  }
  return rows;
}

/**
 * Ubica cada item en un slot de `bentoLayout(items.length)` — el caller
 * ordena vía `weightOf` (mayor peso primero), y ese peso va al slot más
 * ancho DE SU FILA, no al slot más ancho de toda la pantalla. Así el slot
 * angosto de una fila de 3 siempre recibe el peso más chico que le tocó
 * compartir fila, y la forma de la grilla (elegida en `bentoLayout`, no
 * acá) nunca la deforma un valor puntual. El item que cae en el slot más
 * ancho de la fila 1 es, por construcción, el de mayor peso global: es el
 * destacado.
 */
export function assignBentoSlots<T>(items: readonly T[], weightOf: (item: T) => number): { gridItems: T[]; gridSpans: number[] } {
  const sorted = [...items].sort((a, b) => weightOf(b) - weightOf(a));
  const rows = bentoLayout(sorted.length);

  const gridItems: T[] = [];
  const gridSpans: number[] = [];
  let pointer = 0;
  for (const rowSpans of rows) {
    const rowItems = sorted.slice(pointer, pointer + rowSpans.length);
    pointer += rowSpans.length;
    // Slots de la fila ordenados de más ancho a más angosto — el item más
    // pesado de la fila (rowItems[0], ya viene ordenado desc) va al
    // primero de esa lista, el segundo más pesado al segundo, etc.
    const slotsByWidthDesc = rowSpans.map((_, idx) => idx).sort((a, b) => rowSpans[b]! - rowSpans[a]!);
    const rowResult: T[] = new Array(rowSpans.length);
    slotsByWidthDesc.forEach((slotIdx, rank) => {
      rowResult[slotIdx] = rowItems[rank]!;
    });
    gridItems.push(...rowResult);
    gridSpans.push(...rowSpans);
  }
  return { gridItems, gridSpans };
}
